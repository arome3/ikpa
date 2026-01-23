/**
 * Future Self Controller
 *
 * HTTP endpoints for the Future Self Simulator feature.
 * Provides dual-path visualizations and personalized "Letters from 2045".
 *
 * All endpoints require authentication via JWT.
 */

import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { FutureSelfService } from './future-self.service';
import {
  SimulationResponseDto,
  LetterResponseDto,
  TimelineResponseDto,
  UpdatePreferencesDto,
  PreferencesResponseDto,
  LetterHistoryResponseDto,
  LetterDetailResponseDto,
  UpdateEngagementDto,
  EngagementResponseDto,
  StatisticsResponseDto,
} from './dto';
import {
  LETTER_RATE_LIMIT,
  SIMULATION_RATE_LIMIT,
  MAX_PAGINATION_OFFSET,
  MAX_PAGINATION_LIMIT,
} from './constants';
import { ParseYearsPipe } from './pipes/parse-years.pipe';

/**
 * Future Self Simulator Controller
 *
 * Bridges temporal disconnect through personalized "Letters from 2045"
 * and dual-path financial visualizations.
 *
 * Based on MIT Media Lab research showing 16% increase in savings
 * after future self interaction.
 */
@ApiTags('Future Self Simulator')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/future-self')
export class FutureSelfController {
  constructor(private readonly futureSelfService: FutureSelfService) {}

  // ==========================================
  // SIMULATION ENDPOINTS
  // ==========================================

  /**
   * Get dual-path simulation
   *
   * Compares "current behavior" vs "optimized IKPA path" using
   * Monte Carlo simulation with 10,000 iterations.
   */
  @Get('simulation')
  @Throttle({ default: { limit: SIMULATION_RATE_LIMIT.limit, ttl: SIMULATION_RATE_LIMIT.ttl } })
  @ApiOperation({
    summary: 'Get dual-path projection',
    description:
      'Returns a dual-path Monte Carlo simulation comparing the user\'s current ' +
      'savings behavior against an optimized IKPA path. Projections are made at ' +
      '6mo, 1yr, 5yr, 10yr, and 20yr horizons. Results are cached for 5 minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Simulation retrieved successfully',
    type: SimulationResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 422,
    description: 'Insufficient user data for simulation',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded (5/min)',
  })
  async getSimulation(
    @CurrentUser('id') userId: string,
  ): Promise<SimulationResponseDto> {
    const simulation = await this.futureSelfService.getSimulation(userId);

    return {
      currentBehavior: {
        savingsRate: simulation.currentBehavior.savingsRate,
        projectedNetWorth: simulation.currentBehavior.projectedNetWorth,
      },
      withIKPA: {
        savingsRate: simulation.withIKPA.savingsRate,
        projectedNetWorth: simulation.withIKPA.projectedNetWorth,
      },
      difference_20yr: simulation.difference_20yr,
    };
  }

  // ==========================================
  // LETTER ENDPOINTS
  // ==========================================

  /**
   * Get personalized letter from future self
   *
   * Generates a heartfelt, personalized letter from the user's
   * 60-year-old future self based on their current financial situation.
   */
  @Get('letter')
  @Throttle({ default: { limit: LETTER_RATE_LIMIT.limit, ttl: LETTER_RATE_LIMIT.ttl } })
  @ApiOperation({
    summary: 'Get letter from 2045',
    description:
      'Returns a personalized letter from the user\'s 60-year-old future self. ' +
      'The letter references the user\'s specific goals, city, and financial situation. ' +
      'Includes simulation data used to generate the letter. ' +
      'Letter generation is rate-limited and cached for 30 minutes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Letter retrieved successfully',
    type: LetterResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 422,
    description: 'Insufficient user data to generate letter',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded (3/min)',
  })
  @ApiResponse({
    status: 503,
    description: 'AI service temporarily unavailable',
  })
  async getLetter(
    @CurrentUser('id') userId: string,
  ): Promise<LetterResponseDto> {
    const letter = await this.futureSelfService.getLetter(userId);

    return {
      content: letter.content,
      generatedAt: letter.generatedAt,
      simulationData: {
        currentBehavior: {
          savingsRate: letter.simulationData.currentBehavior.savingsRate,
          projectedNetWorth: letter.simulationData.currentBehavior.projectedNetWorth,
        },
        withIKPA: {
          savingsRate: letter.simulationData.withIKPA.savingsRate,
          projectedNetWorth: letter.simulationData.withIKPA.projectedNetWorth,
        },
        difference_20yr: letter.simulationData.difference_20yr,
      },
      userAge: letter.userAge,
      futureAge: letter.futureAge,
    };
  }

  // ==========================================
  // TIMELINE ENDPOINTS
  // ==========================================

  /**
   * Get timeline projection at specific year
   *
   * Returns net worth comparison at a specific year horizon.
   * Valid values: 1, 5, 10, 20 (years)
   */
  @Get('timeline/:years')
  @Throttle({ default: { limit: SIMULATION_RATE_LIMIT.limit, ttl: SIMULATION_RATE_LIMIT.ttl } })
  @ApiOperation({
    summary: 'Get projection at specific year',
    description:
      'Returns net worth projection at a specific year horizon, comparing ' +
      'current path vs optimized IKPA path. Use with the time slider visualization. ' +
      'Years is rounded to nearest horizon: 1 (or less), 5, 10, 20 (or more).',
  })
  @ApiParam({
    name: 'years',
    description: 'Number of years in the future (1, 5, 10, or 20)',
    type: 'number',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Timeline projection retrieved successfully',
    type: TimelineResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid years parameter',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 422,
    description: 'Insufficient user data for projection',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded (5/min)',
  })
  async getTimeline(
    @CurrentUser('id') userId: string,
    @Param('years', ParseYearsPipe) years: number,
  ): Promise<TimelineResponseDto> {
    const timeline = await this.futureSelfService.getTimeline(userId, years);

    return {
      currentPath: timeline.currentPath,
      optimizedPath: timeline.optimizedPath,
      difference: timeline.difference,
      years: timeline.years,
    };
  }

  // ==========================================
  // PREFERENCES ENDPOINTS
  // ==========================================

  /**
   * Get user's Future Self preferences
   */
  @Get('preferences')
  @ApiOperation({
    summary: 'Get preferences',
    description: 'Returns the user\'s Future Self feature preferences including weekly letter opt-in status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferences retrieved successfully',
    type: PreferencesResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getPreferences(
    @CurrentUser('id') userId: string,
  ): Promise<PreferencesResponseDto> {
    return this.futureSelfService.getPreferences(userId);
  }

  /**
   * Update user's Future Self preferences (opt-in/out of weekly letters)
   */
  @Patch('preferences')
  @ApiOperation({
    summary: 'Update preferences',
    description: 'Updates the user\'s Future Self feature preferences. Use this to opt-in or opt-out of weekly "Letters from 2045".',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated successfully',
    type: PreferencesResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<PreferencesResponseDto> {
    return this.futureSelfService.updatePreferences(userId, dto.weeklyLettersEnabled);
  }

  // ==========================================
  // LETTER HISTORY ENDPOINTS
  // ==========================================

  /**
   * Get letter history
   */
  @Get('letters')
  @ApiOperation({
    summary: 'Get letter history',
    description: 'Returns a paginated list of previously generated letters with previews.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of letters to return (default: 10, max: 50)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of letters to skip (default: 0)',
  })
  @ApiResponse({
    status: 200,
    description: 'Letter history retrieved successfully',
    type: LetterHistoryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getLetterHistory(
    @CurrentUser('id') userId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<LetterHistoryResponseDto> {
    // Cap limit and offset to prevent slow queries
    const cappedLimit = Math.min(Math.max(1, limit), MAX_PAGINATION_LIMIT);
    const cappedOffset = Math.min(Math.max(0, offset), MAX_PAGINATION_OFFSET);

    const letters = await this.futureSelfService.getLetterHistory(userId, cappedLimit + 1, cappedOffset);
    const hasMore = letters.length > cappedLimit;
    const displayLetters = letters.slice(0, cappedLimit);

    return {
      letters: displayLetters.map((l) => ({
        id: l.id,
        preview: l.content.slice(0, 200) + (l.content.length > 200 ? '...' : ''),
        trigger: l.trigger,
        generatedAt: l.createdAt,
        readAt: l.readAt,
        toneScore: l.toneEmpathyScore,
      })),
      total: letters.length,
      hasMore,
    };
  }

  /**
   * Get a specific letter by ID
   */
  @Get('letters/:id')
  @ApiOperation({
    summary: 'Get letter by ID',
    description: 'Returns the full content and metadata of a specific letter.',
  })
  @ApiParam({
    name: 'id',
    description: 'Letter ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Letter retrieved successfully',
    type: LetterDetailResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Letter not found',
  })
  async getLetterById(
    @CurrentUser('id') userId: string,
    @Param('id') letterId: string,
  ): Promise<LetterDetailResponseDto> {
    const letter = await this.futureSelfService.getLetterById(userId, letterId);

    if (!letter) {
      throw new NotFoundException('Letter not found');
    }

    return letter;
  }

  /**
   * Update letter engagement metrics
   */
  @Patch('letters/:id/engagement')
  @ApiOperation({
    summary: 'Update engagement',
    description: 'Updates engagement metrics for a letter (e.g., read duration). Call this when the user reads a letter.',
  })
  @ApiParam({
    name: 'id',
    description: 'Letter ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Engagement updated successfully',
    type: EngagementResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Letter not found',
  })
  async updateEngagement(
    @CurrentUser('id') userId: string,
    @Param('id') letterId: string,
    @Body() dto: UpdateEngagementDto,
  ): Promise<EngagementResponseDto> {
    const result = await this.futureSelfService.updateEngagement(
      userId,
      letterId,
      dto.readDurationMs,
    );

    if (!result) {
      throw new NotFoundException('Letter not found');
    }

    return result;
  }

  // ==========================================
  // STATISTICS ENDPOINT
  // ==========================================

  /**
   * Get Future Self statistics
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get statistics',
    description: 'Returns comprehensive statistics about the user\'s Future Self letter engagement.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: StatisticsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getStatistics(
    @CurrentUser('id') userId: string,
  ): Promise<StatisticsResponseDto> {
    return this.futureSelfService.getStatistics(userId);
  }
}
