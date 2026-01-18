/**
 * Commitment Device Engine Controller
 *
 * API endpoints for the Commitment Device Engine.
 * Provides 7 routes for commitment management and referee verification.
 *
 * Research shows users with stakes are 3x more likely to achieve their goals.
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
import { CommitmentService } from './commitment.service';
import { RefereeService } from './referee.service';
import { StakeService } from './stake.service';
import {
  CreateStakeDto,
  UpdateStakeDto,
  CreateStakeResponseDto,
  StakeResponseDto,
  StakesListResponseDto,
  CancelStakeResponseDto,
  InviteRefereeDto,
  InviteRefereeResponseDto,
  VerifyCommitmentDto,
  VerifyCommitmentResponseDto,
  RefereePendingQueryDto,
  PendingVerificationsResponseDto,
  AcceptInviteDto,
  AcceptInviteResponseDto,
} from './dto';
import { CreateCommitmentInput, UpdateCommitmentInput } from './interfaces';

/**
 * Controller for the Commitment Device Engine
 *
 * Endpoints:
 * - POST /v1/commitment/stakes - Create commitment with stakes
 * - GET /v1/commitment/stakes/:goalId - Get stakes for a goal
 * - PUT /v1/commitment/stakes/:id - Update stake configuration
 * - DELETE /v1/commitment/stakes/:id - Cancel commitment
 * - POST /v1/commitment/verify/:id - Referee verification
 * - GET /v1/commitment/referee/pending - Pending verifications
 * - POST /v1/commitment/referee/invite - Invite referee
 */
@ApiTags('Commitment Device Engine')
@Controller('v1/commitment')
export class CommitmentController {
  constructor(
    private readonly commitmentService: CommitmentService,
    private readonly refereeService: RefereeService,
    private readonly stakeService: StakeService,
  ) {}

  // ==========================================
  // STAKE ENDPOINTS
  // ==========================================

  /**
   * Create a new commitment with stakes
   */
  @Post('stakes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create commitment with stakes',
    description:
      'Create a new commitment contract for a goal with stakes. ' +
      'Supports SOCIAL (referee verification), ANTI_CHARITY (donate to opposing cause if failed), ' +
      'and LOSS_POOL (funds locked until goal achieved). ' +
      'Research shows stakes increase goal achievement by 3x. ' +
      'Use idempotencyKey to safely retry requests without creating duplicates.',
  })
  @ApiResponse({
    status: 201,
    description: 'Commitment created successfully',
    type: CreateStakeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or stake validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 409,
    description: 'Active commitment already exists for this goal',
  })
  async createStake(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateStakeDto,
  ): Promise<CreateStakeResponseDto> {
    const input: CreateCommitmentInput = {
      goalId: dto.goalId,
      stakeType: dto.stakeType,
      stakeAmount: dto.stakeAmount,
      antiCharityCause: dto.antiCharityCause,
      antiCharityUrl: dto.antiCharityUrl,
      verificationMethod: dto.verificationMethod,
      deadline: new Date(dto.deadline),
      refereeEmail: dto.refereeEmail,
      refereeName: dto.refereeName,
      refereeRelationship: dto.refereeRelationship,
      idempotencyKey: dto.idempotencyKey, // Pass idempotency key
    };

    const { commitment, refereeInvited } = await this.commitmentService.createCommitment(
      userId,
      input,
    );

    return {
      ...commitment,
      refereeInvited,
    };
  }

  /**
   * Get stakes for a specific goal
   */
  @Get('stakes/:goalId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get stakes for a goal',
    description: 'Retrieve all commitment contracts for a specific goal with pagination.',
  })
  @ApiParam({
    name: 'goalId',
    description: 'Goal ID to get stakes for',
    example: 'goal-123-abc-def',
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
    description: 'Items per page (default: 20, max: 100)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Stakes retrieved successfully',
    type: StakesListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getStakes(
    @CurrentUser('id') userId: string,
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<StakesListResponseDto> {
    const result = await this.commitmentService.getCommitmentsByGoal(userId, goalId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return {
      data: result.data,
      goalId,
      pagination: result.pagination,
    };
  }

  /**
   * Update a stake configuration
   */
  @Put('stakes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update stake configuration',
    description:
      'Update an existing commitment. Deadline can only be extended. ' +
      'Stake amount can only be increased. Cannot modify after deadline passes.',
  })
  @ApiParam({
    name: 'id',
    description: 'Commitment contract ID',
    example: 'contract-123-abc',
  })
  @ApiResponse({
    status: 200,
    description: 'Stake updated successfully',
    type: StakeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid update (e.g., trying to shorten deadline)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Commitment not found',
  })
  async updateStake(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStakeDto,
  ): Promise<StakeResponseDto> {
    const input: UpdateCommitmentInput = {
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      stakeAmount: dto.stakeAmount,
      antiCharityCause: dto.antiCharityCause,
      antiCharityUrl: dto.antiCharityUrl,
    };

    return this.commitmentService.updateCommitment(userId, id, input);
  }

  /**
   * Cancel a commitment (before deadline)
   */
  @Delete('stakes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel commitment',
    description:
      'Cancel an active commitment before the deadline. ' +
      'For LOSS_POOL stakes, funds are refunded if cancelled more than 7 days before deadline.',
  })
  @ApiParam({
    name: 'id',
    description: 'Commitment contract ID',
    example: 'contract-123-abc',
  })
  @ApiResponse({
    status: 200,
    description: 'Commitment cancelled successfully',
    type: CancelStakeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel (e.g., deadline passed or within 7 days)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Commitment not found',
  })
  async cancelStake(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CancelStakeResponseDto> {
    const result = await this.commitmentService.cancelCommitment(userId, id);

    return {
      success: result.success,
      contractId: id,
      message: result.message,
      refundedAmount: result.refundedAmount,
      penaltyAmount: result.penaltyAmount,
    };
  }

  // ==========================================
  // VERIFICATION ENDPOINTS
  // ==========================================

  /**
   * Referee verification of commitment
   *
   * This endpoint is public (uses token-based auth via body)
   */
  @Post('verify/:id')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Referee verification',
    description:
      'Submit verification decision for a commitment. Requires verification token. ' +
      'Decision: true = goal achieved, false = goal not achieved.',
  })
  @ApiParam({
    name: 'id',
    description: 'Commitment contract ID',
    example: 'contract-123-abc',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification submitted successfully',
    type: VerifyCommitmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid verification token or request',
  })
  @ApiResponse({
    status: 403,
    description: 'Referee not authorized for this commitment',
  })
  @ApiResponse({
    status: 404,
    description: 'Commitment not found',
  })
  async verifyCommitment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyCommitmentDto,
  ): Promise<VerifyCommitmentResponseDto> {
    // Find the referee from token
    const { referee } = await this.refereeService.getPendingVerifications(dto.token);

    // Verify the commitment
    const result = await this.commitmentService.verifyCommitment(
      referee.id,
      id,
      dto.decision,
      dto.notes,
    );

    return {
      success: true,
      contractId: id,
      decision: dto.decision,
      newStatus: result.newStatus,
      message: result.message,
      stakeProcessed: result.stakeProcessed,
    };
  }

  // ==========================================
  // REFEREE ENDPOINTS
  // ==========================================

  /**
   * Get pending verifications for a referee
   *
   * This endpoint is public (uses token-based auth via query)
   * Rate limited to prevent abuse on public endpoint
   */
  @Get('referee/pending')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  @ApiOperation({
    summary: 'Get pending verifications',
    description: 'Get all commitments pending verification for a referee. Requires verification token.',
  })
  @ApiQuery({
    name: 'token',
    description: 'Referee verification token',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Pending verifications retrieved successfully',
    type: PendingVerificationsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'Referee not found',
  })
  async getPendingVerifications(
    @Query() query: RefereePendingQueryDto,
  ): Promise<PendingVerificationsResponseDto> {
    const { pending, referee } = await this.refereeService.getPendingVerifications(
      query.token,
    );

    return {
      pending,
      total: pending.length,
      refereeId: referee.id,
      refereeName: referee.name,
    };
  }

  /**
   * Invite a new referee
   */
  @Post('referee/invite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Invite referee',
    description:
      'Invite a new accountability partner (referee). ' +
      'They will receive an email invitation to accept the role.',
  })
  @ApiResponse({
    status: 201,
    description: 'Referee invitation sent successfully',
    type: InviteRefereeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async inviteReferee(
    @CurrentUser('id') userId: string,
    @Body() dto: InviteRefereeDto,
  ): Promise<InviteRefereeResponseDto> {
    const result = await this.refereeService.inviteReferee(userId, {
      email: dto.email,
      name: dto.name,
      relationship: dto.relationship,
    });

    return {
      success: true,
      refereeId: result.refereeId,
      email: dto.email,
      name: dto.name,
      message: `Invitation sent successfully. ${dto.name} will receive an email shortly.`,
      inviteExpires: result.inviteExpires,
    };
  }

  /**
   * Accept referee invitation
   *
   * This endpoint is public (uses token-based auth)
   */
  @Post('referee/accept')
  @Public()
  @ApiOperation({
    summary: 'Accept referee invitation',
    description: 'Accept an invitation to become an accountability partner.',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully',
    type: AcceptInviteResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired token',
  })
  async acceptInvite(@Body() dto: AcceptInviteDto): Promise<AcceptInviteResponseDto> {
    const result = await this.refereeService.acceptInvitation(dto.token);

    return {
      success: true,
      refereeId: result.refereeId,
      message: `Welcome! You're now an accountability partner for ${result.userName}.`,
      userName: result.userName,
    };
  }

  // ==========================================
  // ANALYTICS ENDPOINTS
  // ==========================================

  /**
   * Get stake effectiveness metrics
   */
  @Get('analytics/effectiveness')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get stake effectiveness metrics',
    description: 'Get success rate metrics by stake type. Shows how effective each stake type is.',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getStakeEffectiveness(@CurrentUser('id') userId: string) {
    const metrics = await this.stakeService.calculateStakeEffectiveness(userId);

    return {
      userId,
      metrics,
      recommendation: this.getStakeRecommendation(metrics),
    };
  }

  /**
   * Get stake recommendation based on metrics
   */
  private getStakeRecommendation(
    metrics: Array<{ stakeType: string; successRate: number; totalCommitments: number }>,
  ): string {
    // Find the most effective stake type for this user
    const sortedMetrics = [...metrics]
      .filter((m) => m.totalCommitments >= 1)
      .sort((a, b) => b.successRate - a.successRate);

    if (sortedMetrics.length === 0) {
      return 'Try starting with SOCIAL accountability - it has a 78% success rate in research studies.';
    }

    const best = sortedMetrics[0];
    if (best.successRate >= 0.8) {
      return `${best.stakeType} stakes work great for you! Keep using them.`;
    }

    return 'Consider trying ANTI_CHARITY stakes - research shows they have the highest success rate at 85%.';
  }
}
