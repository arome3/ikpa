/**
 * Story Cards Controller
 *
 * API endpoints for the Story Cards viral sharing system.
 * Provides 6 routes for card generation, retrieval, sharing, and analytics.
 *
 * Features:
 * - Generate shareable cards from achievements
 * - Track share events for viral coefficient calculation
 * - Get viral metrics for growth analytics
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, Public } from '../../common/decorators';
import { StoryCardsService } from './story-cards.service';
import { StoryCardsCronService } from './story-cards.cron';
import { StoryCardsMetrics } from './story-cards.metrics';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  GenerateStoryCardDto,
  TrackShareDto,
  StoryCardResponseDto,
  CreateStoryCardResponseDto,
  StoryCardsListResponseDto,
  TrackShareResponseDto,
  ViralMetricsResponseDto,
  DeleteCardResponseDto,
  UpdateStoryCardDto,
  UpdateStoryCardResponseDto,
  PreviewStoryCardDto,
  PreviewStoryCardResponseDto,
  BulkDeleteDto,
  BulkDeleteResponseDto,
  BulkGenerateDto,
  BulkGenerateResponseDto,
} from './dto';
import { STORY_CARD_RATE_LIMITS } from './constants';
import { PreviewCardResponse, BulkDeleteResult, BulkGenerateResult } from './interfaces';

/**
 * Controller for the Story Cards viral sharing system
 *
 * Endpoints:
 * - POST /story-cards/generate - Generate a story card
 * - GET /story-cards/:id - Get a story card by ID
 * - GET /story-cards/user/:userId - Get all story cards for a user
 * - POST /story-cards/:id/share - Track share event
 * - GET /story-cards/analytics/viral - Get viral metrics
 */
@ApiTags('Story Cards')
@Controller('story-cards')
export class StoryCardsController {
  constructor(
    private readonly storyCardsService: StoryCardsService,
    private readonly cronService: StoryCardsCronService,
    private readonly metrics: StoryCardsMetrics,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  // ==========================================
  // HEALTH CHECK ENDPOINT
  // ==========================================

  /**
   * Health check endpoint for k8s probes
   * No authentication required
   */
  @Get('health')
  @Public()
  @ApiOperation({
    summary: 'Health check',
    description:
      'Check the health status of the Story Cards service including database, Redis, and cron job status. ' +
      'No authentication required - designed for Kubernetes liveness/readiness probes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        timestamp: { type: 'string', format: 'date-time' },
        components: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down'] },
                latencyMs: { type: 'number' },
              },
            },
            redis: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down'] },
                latencyMs: { type: 'number' },
              },
            },
            cron: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'down'] },
                jobs: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
    },
  })
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    components: {
      database: { status: 'up' | 'down'; latencyMs?: number; error?: string };
      redis: { status: 'up' | 'down'; latencyMs?: number; error?: string };
      cron: { status: 'up' | 'down'; jobs: Array<{ jobName: string; schedule: string; timezone: string; description: string }> };
    };
  }> {
    // Increment health check metric
    this.metrics.incHealthCheck();

    const timestamp = new Date().toISOString();

    // Component status results
    let databaseStatus: 'up' | 'down' = 'down';
    let databaseLatency: number | undefined;
    let databaseError: string | undefined;

    let redisStatus: 'up' | 'down' = 'down';
    let redisLatency: number | undefined;
    let redisError: string | undefined;

    let cronStatus: 'up' | 'down' = 'up';
    let cronJobs: Array<{ jobName: string; schedule: string; timezone: string; description: string }> = [];

    // Check Prisma connection
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'up';
      databaseLatency = Date.now() - dbStart;
    } catch (error) {
      databaseStatus = 'down';
      databaseLatency = Date.now() - dbStart;
      databaseError = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check Redis connection
    const redisStart = Date.now();
    try {
      const client = this.redisService.getClient();
      if (client && this.redisService.isAvailable()) {
        await client.ping();
        redisStatus = 'up';
        redisLatency = Date.now() - redisStart;
      } else {
        redisStatus = 'down';
        redisLatency = Date.now() - redisStart;
        redisError = 'Redis client not available';
      }
    } catch (error) {
      redisStatus = 'down';
      redisLatency = Date.now() - redisStart;
      redisError = error instanceof Error ? error.message : 'Unknown error';
    }

    // Get cron job status
    try {
      cronJobs = this.cronService.getJobStatus();
      cronStatus = 'up';
    } catch {
      cronStatus = 'down';
      cronJobs = [];
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (databaseStatus === 'up' && redisStatus === 'up') {
      status = 'healthy';
    } else if (databaseStatus === 'up') {
      // Database is critical, Redis is optional (graceful degradation)
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp,
      components: {
        database: { status: databaseStatus, latencyMs: databaseLatency, error: databaseError },
        redis: { status: redisStatus, latencyMs: redisLatency, error: redisError },
        cron: { status: cronStatus, jobs: cronJobs },
      },
    };
  }

  /**
   * Get Prometheus metrics
   * No authentication required for scraping
   */
  @Get('metrics')
  @Public()
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description:
      'Export metrics in Prometheus text format for scraping. ' +
      'No authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics in text format',
    content: {
      'text/plain': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  getMetrics(): string {
    return this.metrics.toPrometheusFormat();
  }

  // ==========================================
  // GENERATION ENDPOINTS
  // ==========================================

  /**
   * Generate a new story card for sharing
   */
  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({
    default: {
      limit: STORY_CARD_RATE_LIMITS.GENERATE.limit,
      ttl: STORY_CARD_RATE_LIMITS.GENERATE.ttl,
    },
  })
  @ApiOperation({
    summary: 'Generate a story card',
    description:
      'Generate a shareable story card from a Future Self letter, Commitment, Milestone, or Recovery session. ' +
      'Cards are designed for viral sharing with privacy-first defaults (amounts shown as percentages). ' +
      'Use sourceId to reference the specific letter, commitment, goal, or recovery session.',
  })
  @ApiResponse({
    status: 201,
    description: 'Story card generated successfully',
    type: CreateStoryCardResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or source data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Source (letter, commitment, goal, or recovery session) not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit or daily/total card limit exceeded',
  })
  async generateCard(
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateStoryCardDto,
  ): Promise<CreateStoryCardResponseDto> {
    const card = await this.storyCardsService.generateCard(userId, {
      type: dto.type,
      sourceId: dto.sourceId,
      anonymizeAmounts: dto.anonymizeAmounts,
      revealActualNumbers: dto.revealActualNumbers,
      includePersonalData: dto.includePersonalData,
    });

    return {
      ...card,
      generated: true,
    };
  }

  /**
   * Preview a story card without saving to database
   */
  @Post('preview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: STORY_CARD_RATE_LIMITS.PREVIEW.limit, ttl: STORY_CARD_RATE_LIMITS.PREVIEW.ttl } })
  @ApiOperation({ summary: 'Preview a story card', description: 'Generate a preview of a story card without saving it to the database.' })
  @ApiResponse({ status: 200, description: 'Story card preview generated successfully', type: PreviewStoryCardResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Source not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async previewCard(@CurrentUser('id') userId: string, @Body() dto: PreviewStoryCardDto): Promise<PreviewCardResponse> {
    return this.storyCardsService.previewCard(userId, { type: dto.type, sourceId: dto.sourceId, anonymizeAmounts: dto.anonymizeAmounts, revealActualNumbers: dto.revealActualNumbers, includePersonalData: dto.includePersonalData });
  }

  // ==========================================
  // BULK OPERATIONS ENDPOINTS
  // ==========================================

  /**
   * Bulk delete story cards (GDPR compliance)
   */
  @Delete('bulk')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: STORY_CARD_RATE_LIMITS.BULK_DELETE.limit, ttl: STORY_CARD_RATE_LIMITS.BULK_DELETE.ttl } })
  @ApiOperation({ summary: 'Bulk delete story cards', description: 'Delete multiple story cards at once. Maximum 100 cards per request.' })
  @ApiResponse({ status: 200, description: 'Bulk delete completed', type: BulkDeleteResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async bulkDeleteCards(@CurrentUser('id') userId: string, @Body() dto: BulkDeleteDto): Promise<BulkDeleteResult> {
    return this.storyCardsService.bulkDelete(userId, dto.cardIds, dto.hardDelete);
  }

  /**
   * Bulk generate story cards
   */
  @Post('bulk/generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: STORY_CARD_RATE_LIMITS.BULK_GENERATE.limit, ttl: STORY_CARD_RATE_LIMITS.BULK_GENERATE.ttl } })
  @ApiOperation({ summary: 'Bulk generate story cards', description: 'Generate multiple story cards at once. Maximum 10 cards per request.' })
  @ApiResponse({ status: 201, description: 'Bulk generation completed', type: BulkGenerateResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async bulkGenerateCards(@CurrentUser('id') userId: string, @Body() dto: BulkGenerateDto): Promise<BulkGenerateResult> {
    return this.storyCardsService.bulkGenerate(userId, dto.items);
  }

  // ==========================================
  // RETRIEVAL ENDPOINTS
  // ==========================================

  /**
   * Get a story card by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get a story card by ID',
    description: 'Retrieve a specific story card by its ID. User must own the card.',
  })
  @ApiParam({
    name: 'id',
    description: 'Story card ID',
    example: 'card-uuid-here',
  })
  @ApiResponse({
    status: 200,
    description: 'Story card retrieved successfully',
    type: StoryCardResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - Card belongs to another user',
  })
  @ApiResponse({
    status: 404,
    description: 'Story card not found',
  })
  @ApiResponse({
    status: 410,
    description: 'Story card has expired',
  })
  async getCardById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StoryCardResponseDto> {
    return this.storyCardsService.getCardById(userId, id);
  }

  /**
   * Get all story cards for a user
   */
  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all story cards for a user',
    description: 'Retrieve all story cards created by the authenticated user with pagination.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID (must match authenticated user)',
    example: 'user-uuid-here',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10, max: 100)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Story cards retrieved successfully',
    type: StoryCardsListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - Cannot access other user cards',
  })
  async getUserCards(
    @CurrentUser('id') currentUserId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<StoryCardsListResponseDto> {
    // Ensure user can only access their own cards
    if (currentUserId !== userId) {
      // Return empty list for non-matching users (security through obscurity)
      return {
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      };
    }

    return this.storyCardsService.getUserCards(userId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    });
  }

  // ==========================================
  // CARD MANAGEMENT ENDPOINTS
  // ==========================================

  /**
   * Delete a story card (GDPR compliance)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a story card',
    description:
      'Delete a story card. By default, performs a soft delete (sets isActive=false). ' +
      'Use ?hard=true for permanent deletion (GDPR right to erasure). ' +
      'Hard delete removes the card and all associated share events.',
  })
  @ApiParam({
    name: 'id',
    description: 'Story card ID',
    example: 'card-uuid-here',
  })
  @ApiQuery({
    name: 'hard',
    required: false,
    description: 'If "true", permanently delete the card (default: soft delete)',
    example: 'false',
  })
  @ApiResponse({
    status: 200,
    description: 'Story card deleted successfully',
    type: DeleteCardResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Story card not found',
  })
  async deleteCard(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('hard') hard?: string,
  ): Promise<DeleteCardResponseDto> {
    const hardDelete = hard === 'true';
    return this.storyCardsService.deleteCard(userId, id, hardDelete);
  }

  /**
   * Update a story card
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a story card',
    description:
      'Update a story card\'s privacy settings or regenerate content. ' +
      'Set regenerateContent=true to re-fetch source data and regenerate the card content.',
  })
  @ApiParam({
    name: 'id',
    description: 'Story card ID',
    example: 'card-uuid-here',
  })
  @ApiResponse({
    status: 200,
    description: 'Story card updated successfully',
    type: UpdateStoryCardResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Story card not found',
  })
  @ApiResponse({
    status: 410,
    description: 'Story card has expired',
  })
  async updateCard(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStoryCardDto,
  ): Promise<UpdateStoryCardResponseDto> {
    return this.storyCardsService.updateCard(userId, id, {
      anonymizeAmounts: dto.anonymizeAmounts,
      revealActualNumbers: dto.revealActualNumbers,
      includePersonalData: dto.includePersonalData,
      regenerateContent: dto.regenerateContent,
    });
  }

  // ==========================================
  // SHARE TRACKING ENDPOINTS
  // ==========================================

  /**
   * Track a share event
   */
  @Post(':id/share')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: STORY_CARD_RATE_LIMITS.SHARE_TRACK.limit,
      ttl: STORY_CARD_RATE_LIMITS.SHARE_TRACK.ttl,
    },
  })
  @ApiOperation({
    summary: 'Track share event',
    description:
      'Record when a user shares a story card on a social platform. ' +
      'Used for viral coefficient calculation and growth analytics.',
  })
  @ApiParam({
    name: 'id',
    description: 'Story card ID',
    example: 'card-uuid-here',
  })
  @ApiResponse({
    status: 200,
    description: 'Share event tracked successfully',
    type: TrackShareResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Story card not found',
  })
  async trackShare(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TrackShareDto,
  ): Promise<TrackShareResponseDto> {
    return this.storyCardsService.trackShare(userId, id, {
      platform: dto.platform,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
    });
  }

  // ==========================================
  // ANALYTICS ENDPOINTS
  // ==========================================

  /**
   * Get viral metrics for the authenticated user
   */
  @Get('analytics/viral')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get viral metrics',
    description:
      'Get comprehensive viral metrics including total shares, signups from shares, ' +
      'viral coefficient, and breakdown by platform and card type.',
  })
  @ApiResponse({
    status: 200,
    description: 'Viral metrics retrieved successfully',
    type: ViralMetricsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getViralMetrics(
    @CurrentUser('id') userId: string,
  ): Promise<ViralMetricsResponseDto> {
    return this.storyCardsService.getViralMetrics(userId);
  }
}
