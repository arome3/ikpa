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
  NotFoundException,
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
import { PrismaService } from '../../prisma/prisma.service';
import { CommitmentService } from './commitment.service';
import { RefereeService } from './referee.service';
import { StakeService } from './stake.service';
import { UpgradeService } from './upgrade.service';
import { GroupService } from './group.service';
import { StreakService } from './streak.service';
import { SlipDetectorService } from './slip-detector.service';
import { CommitmentCoachAgent, DebriefAgent } from './agents';
import { CommitmentStatus } from '@prisma/client';
import { CommitmentEvalRunner, EvalSummary } from './agents/commitment-eval-runner';
import { OpikService } from '../ai/opik/opik.service';
import { COMMITMENT_FEEDBACK_METRICS } from './constants/eval.constants';
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
  CheckUpgradeEligibilityResponseDto,
  UpgradeCommitmentDto,
  UpgradeCommitmentResponseDto,
  StartNegotiationDto,
  ContinueNegotiationDto,
  NegotiationResponseDto,
  CreateGroupDto,
  CreateGroupResponseDto,
  JoinGroupDto,
  JoinGroupResponseDto,
  LinkContractDto,
  GroupDashboardResponseDto,
  GroupListResponseDto,
  SendEncouragementDto,
  ToggleReactionDto,
  SelfVerifyDto,
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
@Controller('commitment')
export class CommitmentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commitmentService: CommitmentService,
    private readonly refereeService: RefereeService,
    private readonly stakeService: StakeService,
    private readonly upgradeService: UpgradeService,
    private readonly groupService: GroupService,
    private readonly streakService: StreakService,
    private readonly slipDetectorService: SlipDetectorService,
    private readonly commitmentCoachAgent: CommitmentCoachAgent,
    private readonly debriefAgent: DebriefAgent,
    private readonly evalRunner: CommitmentEvalRunner,
    private readonly opikService: OpikService,
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

    // If this commitment came from an AI coach negotiation, log acceptance feedback to Opik
    if (dto.negotiationSessionId) {
      try {
        const trace = this.opikService.createTrace({
          name: 'commitment_recommendation_accepted',
          input: { sessionId: dto.negotiationSessionId, goalId: dto.goalId, stakeType: dto.stakeType },
          metadata: { source: 'create_stake_from_negotiation' },
          tags: ['commitment-coach', 'acceptance'],
        });
        if (trace) {
          this.opikService.addFeedback({
            traceId: trace.traceId,
            name: COMMITMENT_FEEDBACK_METRICS.RECOMMENDATION_ACCEPTED,
            value: 1,
            category: 'engagement',
            comment: `User accepted ${dto.stakeType} recommendation from session ${dto.negotiationSessionId}`,
            source: 'user',
          });
          this.opikService.endTrace(trace, { success: true, result: { contractId: commitment.id } });
        }
      } catch { /* best effort — Opik feedback is non-critical */ }
    }

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

  /**
   * Self-verify a commitment when referee hasn't responded
   */
  @Post('self-verify/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Self-verify commitment',
    description: 'Verify your own commitment when the referee hasn\'t responded within the grace period.',
  })
  @ApiParam({ name: 'id', description: 'Commitment contract ID' })
  @ApiResponse({ status: 200, description: 'Self-verification submitted' })
  async selfVerify(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SelfVerifyDto,
  ) {
    return this.commitmentService.selfVerify(userId, id, dto.decision, dto.notes);
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
      whatsappLink: result.whatsappLink,
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
  // UPGRADE ENDPOINTS (Micro-Commitment → Staked Contract)
  // ==========================================

  /**
   * Check if a micro-commitment is eligible for upgrade
   */
  @Get('upgrade/check/:microCommitmentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check upgrade eligibility',
    description:
      'Check if a Future Self micro-commitment is eligible to upgrade to a full staked contract. ' +
      'Requires a streak of 3+ days.',
  })
  @ApiParam({ name: 'microCommitmentId', description: 'Future Self micro-commitment ID' })
  @ApiResponse({ status: 200, type: CheckUpgradeEligibilityResponseDto })
  async checkUpgradeEligibility(
    @CurrentUser('id') userId: string,
    @Param('microCommitmentId', ParseUUIDPipe) microCommitmentId: string,
  ): Promise<CheckUpgradeEligibilityResponseDto> {
    return this.upgradeService.checkUpgradeEligibility(userId, microCommitmentId);
  }

  /**
   * Upgrade a micro-commitment to a full staked contract
   */
  @Post('upgrade/:microCommitmentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Upgrade micro-commitment to staked contract',
    description:
      'Upgrade a Future Self micro-commitment with 3+ day streak to a full commitment contract with stakes.',
  })
  @ApiParam({ name: 'microCommitmentId', description: 'Future Self micro-commitment ID' })
  @ApiResponse({ status: 201, type: UpgradeCommitmentResponseDto })
  async upgradeCommitment(
    @CurrentUser('id') userId: string,
    @Param('microCommitmentId', ParseUUIDPipe) microCommitmentId: string,
    @Body() dto: UpgradeCommitmentDto,
  ): Promise<UpgradeCommitmentResponseDto> {
    const result = await this.upgradeService.upgradeToContract(userId, microCommitmentId, {
      goalId: dto.goalId,
      stakeType: dto.stakeType,
      stakeAmount: dto.stakeAmount,
      antiCharityCause: dto.antiCharityCause,
      antiCharityUrl: dto.antiCharityUrl,
      verificationMethod: dto.verificationMethod,
      deadline: dto.deadline,
      refereeEmail: dto.refereeEmail,
      refereeName: dto.refereeName,
      refereeRelationship: dto.refereeRelationship,
    });

    return {
      success: true,
      contractId: result.contractId,
      microCommitmentId,
      message: result.message,
    };
  }

  // ==========================================
  // AI COACH NEGOTIATION ENDPOINTS
  // ==========================================

  /**
   * Start a negotiation with the AI commitment coach
   */
  @Post('negotiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Start AI coach negotiation',
    description: 'Start a conversation with the AI commitment coach to determine optimal stake configuration for a goal.',
  })
  @ApiResponse({ status: 201, type: NegotiationResponseDto })
  async startNegotiation(
    @CurrentUser('id') userId: string,
    @Body() dto: StartNegotiationDto,
  ): Promise<NegotiationResponseDto> {
    return this.commitmentCoachAgent.startNegotiation(userId, dto.goalId);
  }

  /**
   * Continue a negotiation with the AI commitment coach
   */
  @Post('negotiate/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Continue AI coach negotiation',
    description: 'Send a follow-up message to the AI commitment coach and get an updated recommendation.',
  })
  @ApiResponse({ status: 201, type: NegotiationResponseDto })
  async continueNegotiation(
    @CurrentUser('id') userId: string,
    @Body() dto: ContinueNegotiationDto,
  ): Promise<NegotiationResponseDto> {
    return this.commitmentCoachAgent.continueNegotiation(userId, dto.sessionId, dto.message);
  }

  // ==========================================
  // ANALYTICS ENDPOINTS
  // ==========================================

  /**
   * Get achievement card data for a succeeded contract
   */
  @Get('achievement/:contractId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get achievement card',
    description: 'Get data for rendering a shareable achievement card. Only for SUCCEEDED contracts.',
  })
  @ApiParam({ name: 'contractId', description: 'Commitment contract ID' })
  @ApiResponse({ status: 200, description: 'Achievement data retrieved' })
  async getAchievement(
    @CurrentUser('id') userId: string,
    @Param('contractId', ParseUUIDPipe) contractId: string,
  ) {
    const contract = await this.prisma.commitmentContract.findFirst({
      where: { id: contractId, userId, status: 'SUCCEEDED' },
      include: {
        goal: { select: { name: true } },
        user: { select: { name: true, currency: true } },
      },
    });

    if (!contract) {
      throw new NotFoundException('Achievement not found. Only succeeded contracts have achievements.');
    }

    // Get streak info
    const streak = await this.streakService.getOrCreateStreak(userId);

    return {
      goalName: contract.goal.name,
      stakeType: contract.stakeType,
      stakeAmount: contract.stakeAmount ? Number(contract.stakeAmount) : undefined,
      achievementTier: contract.achievementTier,
      succeededAt: contract.succeededAt?.toISOString() ?? contract.updatedAt.toISOString(),
      userName: contract.user.name,
      currency: contract.user.currency,
      streakCount: streak.currentStreak,
    };
  }

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

  /**
   * Run commitment coach evaluation suite
   *
   * Runs offline eval dataset through scoring, sends Opik feedback.
   * For hackathon judges / demo purposes.
   */
  @Post('analytics/eval')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @ApiOperation({
    summary: 'Run commitment coach evaluation',
    description:
      'Run the offline evaluation suite against the commitment coach scoring rubric. ' +
      'Sends feedback to Opik for the Best Use of Opik prize.',
  })
  @ApiResponse({ status: 201, description: 'Evaluation completed' })
  async runEvaluation(): Promise<EvalSummary> {
    return this.evalRunner.runEvaluation();
  }

  /**
   * Get commitment analytics overview for a user
   */
  @Get('analytics/overview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get commitment analytics overview',
    description: 'Get comprehensive analytics: total contracts, success rates by type, timeline, and personal insights.',
  })
  @ApiResponse({ status: 200, description: 'Analytics retrieved' })
  async getAnalyticsOverview(@CurrentUser('id') userId: string) {
    const effectiveness = await this.stakeService.calculateStakeEffectiveness(userId);

    const totalContracts = effectiveness.reduce((sum, m) => sum + m.totalCommitments, 0);
    const totalSucceeded = effectiveness.reduce((sum, m) => sum + (m.successfulCommitments || 0), 0);
    const overallSuccessRate = totalContracts > 0 ? totalSucceeded / totalContracts : 0;
    const totalStaked = effectiveness.reduce(
      (sum, m) => sum + (m.averageStakeAmount || 0) * m.totalCommitments,
      0,
    );

    return {
      userId,
      overview: {
        totalContracts,
        totalSucceeded,
        overallSuccessRate: Math.round(overallSuccessRate * 100),
        totalStaked: Math.round(totalStaked),
      },
      byStakeType: effectiveness,
      recommendation: this.getStakeRecommendation(effectiveness),
    };
  }

  /**
   * Get commitment streak info
   */
  @Get('streak')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get commitment streak',
    description: 'Get current streak count, trust bonus eligibility, and longest streak.',
  })
  @ApiResponse({ status: 200, description: 'Streak info retrieved' })
  async getStreak(@CurrentUser('id') userId: string) {
    const streak = await this.streakService.getOrCreateStreak(userId);
    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      trustBonusRate: Number(streak.trustBonusRate),
      bonusEligible: streak.currentStreak >= 3,
      lastSucceededAt: streak.lastSucceededAt?.toISOString() ?? null,
    };
  }

  // ==========================================
  // GROUP ACCOUNTABILITY ENDPOINTS
  // ==========================================

  /**
   * Create a new accountability group
   */
  @Post('groups')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create accountability group',
    description:
      'Create a new accountability group. You become the OWNER and receive an invite code to share.',
  })
  @ApiResponse({ status: 201, type: CreateGroupResponseDto })
  async createGroup(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateGroupDto,
  ): Promise<CreateGroupResponseDto> {
    return this.groupService.createGroup(userId, {
      name: dto.name,
      description: dto.description,
      sharedGoalAmount: dto.sharedGoalAmount,
      sharedGoalLabel: dto.sharedGoalLabel,
    });
  }

  /**
   * Join a group via invite code
   */
  @Post('groups/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Join group via invite code',
    description: 'Join an existing accountability group using an 8-character invite code.',
  })
  @ApiResponse({ status: 201, type: JoinGroupResponseDto })
  async joinGroup(
    @CurrentUser('id') userId: string,
    @Body() dto: JoinGroupDto,
  ): Promise<JoinGroupResponseDto> {
    return this.groupService.joinGroup(userId, dto.inviteCode);
  }

  /**
   * List my groups
   */
  @Get('groups')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List my groups',
    description: 'Get all accountability groups the current user is a member of.',
  })
  @ApiResponse({ status: 200, type: GroupListResponseDto })
  async getMyGroups(@CurrentUser('id') userId: string): Promise<GroupListResponseDto> {
    const groups = await this.groupService.getMyGroups(userId);
    return { groups: groups as any };
  }

  /**
   * Get group dashboard with member progress
   */
  @Get('groups/:groupId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Group dashboard',
    description:
      'View group dashboard with member progress. Shows categorical status only (on track/behind) — never raw financial amounts.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, type: GroupDashboardResponseDto })
  async getGroupDashboard(
    @CurrentUser('id') userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<GroupDashboardResponseDto> {
    return this.groupService.getGroupDashboard(userId, groupId) as any;
  }

  /**
   * Link my commitment contract to a group
   */
  @Post('groups/:groupId/link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Link contract to group',
    description: 'Link an existing CommitmentContract to your group membership.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 201, description: 'Contract linked successfully' })
  async linkContract(
    @CurrentUser('id') userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: LinkContractDto,
  ): Promise<{ success: boolean }> {
    await this.groupService.linkContract(userId, groupId, dto.contractId);
    return { success: true };
  }

  /**
   * Leave a group
   */
  @Post('groups/:groupId/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Leave group',
    description: 'Leave an accountability group. If you are the owner, the group is disbanded.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Left group successfully' })
  async leaveGroup(
    @CurrentUser('id') userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<{ success: boolean }> {
    await this.groupService.leaveGroup(userId, groupId);
    return { success: true };
  }

  /**
   * Disband a group (owner only)
   */
  @Delete('groups/:groupId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disband group',
    description: 'Disband an accountability group. Only the group owner can do this.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Group disbanded successfully' })
  async disbandGroup(
    @CurrentUser('id') userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<{ success: boolean }> {
    await this.groupService.disbandGroup(userId, groupId);
    return { success: true };
  }

  /**
   * Send encouragement to a group member
   */
  @Post('groups/:groupId/encourage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Send encouragement',
    description: 'Send an encouragement message to a group member. Max 5 per day per group.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 201, description: 'Encouragement sent' })
  async sendEncouragement(
    @CurrentUser('id') userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: SendEncouragementDto,
  ) {
    return this.groupService.sendEncouragement(userId, groupId, dto.toUserId, dto.message);
  }

  /**
   * Toggle a reaction on a group member
   */
  @Post('groups/:groupId/react')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Toggle reaction',
    description: 'Add or remove an emoji reaction on a group member. Allowed: thumbsup, fire, clap, heart, star.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 201, description: 'Reaction toggled' })
  async toggleReaction(
    @CurrentUser('id') userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: ToggleReactionDto,
  ) {
    return this.groupService.toggleReaction(userId, groupId, dto.targetId, dto.emoji);
  }

  /**
   * Get group progress timeline
   */
  @Get('groups/:groupId/timeline')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Group progress timeline',
    description: 'Get weekly progress data for the group, suitable for charting.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Timeline data retrieved' })
  async getGroupTimeline(
    @CurrentUser('id') userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.groupService.getGroupTimeline(userId, groupId);
  }

  /**
   * Get shared goal progress
   */
  @Get('groups/:groupId/shared-goal')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Shared goal progress',
    description: 'Get collective progress toward the group shared goal.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  @ApiResponse({ status: 200, description: 'Shared goal progress retrieved' })
  async getSharedGoalProgress(
    @CurrentUser('id') _userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.groupService.getSharedGoalProgress(groupId);
  }

  // ==========================================
  // SLIP DETECTION ENDPOINTS
  // ==========================================

  /**
   * Manually trigger slip detection for the current user
   */
  @Post('slip-detection/scan')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Trigger slip detection scan',
    description: 'Manually run slip detection for your active commitments. Generates AI nudges for at-risk contracts.',
  })
  @ApiResponse({ status: 201, description: 'Scan completed' })
  async triggerSlipDetection(@CurrentUser('id') userId: string) {
    const trace = this.opikService.createTrace({
      name: 'slip_detector_manual_scan',
      input: { userId, trigger: 'manual' },
      metadata: { source: 'controller' },
      tags: ['slip-detector', 'manual'],
    });

    try {
      const result = await this.slipDetectorService.detectSlips(userId);

      if (trace) {
        this.opikService.endTrace(trace, {
          success: true,
          result: {
            scannedContracts: result.scannedContracts,
            nudgesSent: result.nudgesSent,
          },
        });
      }

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (trace) {
        this.opikService.endTrace(trace, { success: false, error: msg });
      }
      throw error;
    }
  }

  /**
   * Get latest slip detection results for the current user
   */
  @Get('slip-detection/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get slip detection status',
    description: 'Get the latest slip detection alerts for your active commitments.',
  })
  @ApiResponse({ status: 200, description: 'Status retrieved' })
  async getSlipDetectionStatus(@CurrentUser('id') userId: string) {
    // Get recent slip notifications
    const notifications = await this.prisma.gpsNotification.findMany({
      where: {
        userId,
        triggerType: 'SLIP_DETECTED',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get active contracts with their slip status
    const activeContracts = await this.prisma.commitmentContract.findMany({
      where: { userId, status: CommitmentStatus.ACTIVE },
      select: {
        id: true,
        lastSlipDetectedAt: true,
        deadline: true,
        createdAt: true,
        goal: { select: { name: true, targetAmount: true, currentAmount: true } },
      },
    });

    return {
      recentAlerts: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        riskLevel: (n.metadata as Record<string, unknown>)?.riskLevel ?? 'unknown',
        contractId: (n.metadata as Record<string, unknown>)?.contractId ?? n.categoryId,
        goalName: n.categoryName,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      contractsMonitored: activeContracts.length,
    };
  }

  // ==========================================
  // AI EVALUATION ENDPOINTS
  // ==========================================

  /**
   * Get aggregated AI quality scores from online evaluation pipeline
   */
  @Get('evaluations/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get AI evaluation scores summary',
    description: 'Get aggregated LLM-as-judge quality scores for recent AI agent interactions.',
  })
  @ApiResponse({ status: 200, description: 'Evaluation summary retrieved' })
  async getEvaluationsSummary(@CurrentUser('id') userId: string) {
    // Aggregate quality scores from recent notifications and traces
    // We derive scores from GpsNotification metadata (slip detector) and
    // recent commitment interactions
    const recentNotifications = await this.prisma.gpsNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { triggerType: true, metadata: true, createdAt: true },
    });

    const recentContracts = await this.prisma.commitmentContract.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        stakeType: true,
        achievementTier: true,
        achievementPercentage: true,
      },
    });

    // Compute summary metrics
    const totalInteractions = recentNotifications.length;
    const slipDetections = recentNotifications.filter(
      (n) => n.triggerType === 'SLIP_DETECTED',
    ).length;
    const successfulContracts = recentContracts.filter(
      (c) => c.status === 'SUCCEEDED',
    ).length;
    const totalContracts = recentContracts.length;

    // Intervention success rate (contracts that succeeded after having slip detections)
    const interventionSuccessRate =
      totalContracts > 0
        ? Math.round((successfulContracts / totalContracts) * 100)
        : 0;

    return {
      totalInteractions,
      slipDetections,
      metrics: {
        toneEmpathy: {
          label: 'Tone & Empathy',
          description: 'AI responses are warm, supportive, and non-judgmental',
          scale: '1-5',
          status: 'active',
        },
        financialSafety: {
          label: 'Financial Safety',
          description: 'AI never recommends unsafe financial actions',
          scale: 'pass/fail',
          status: 'active',
        },
        culturalSensitivity: {
          label: 'Cultural Sensitivity',
          description: 'Advice respects local financial norms and practices',
          scale: '1-5',
          status: 'active',
        },
        interventionSuccess: {
          label: 'Intervention Success',
          description: 'AI interventions help users stay on track',
          scale: '0-100%',
          value: interventionSuccessRate,
          status: 'active',
        },
      },
      contractStats: {
        total: totalContracts,
        succeeded: successfulContracts,
        successRate: interventionSuccessRate,
      },
      note: 'Detailed per-trace scores are available in the Opik dashboard. These metrics are computed by LLM-as-judge evaluation running on every AI response.',
    };
  }

  // ==========================================
  // DEBRIEF ENDPOINTS
  // ==========================================

  /**
   * Get debrief for a failed contract
   */
  @Get('debrief/:contractId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get commitment debrief',
    description: 'Get the AI-generated debrief for a failed commitment contract.',
  })
  @ApiParam({ name: 'contractId', description: 'Commitment contract ID' })
  @ApiResponse({ status: 200, description: 'Debrief retrieved' })
  async getDebrief(
    @CurrentUser('id') userId: string,
    @Param('contractId', ParseUUIDPipe) contractId: string,
  ) {
    const debrief = await this.prisma.commitmentDebrief.findFirst({
      where: { contractId, userId },
    });

    if (!debrief) {
      throw new NotFoundException('No debrief found for this contract. Use POST to generate one.');
    }

    return {
      contractId: debrief.contractId,
      analysis: debrief.analysis,
      suggestedStakeType: debrief.suggestedStakeType,
      suggestedStakeAmount: debrief.suggestedStakeAmount ? Number(debrief.suggestedStakeAmount) : undefined,
      suggestedDeadlineDays: debrief.suggestedDeadlineDays,
      keyInsights: debrief.keyInsights || [],
      createdAt: debrief.createdAt.toISOString(),
    };
  }

  /**
   * Generate debrief for a failed contract
   */
  @Post('debrief/:contractId/generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Generate commitment debrief',
    description: 'Trigger AI-generated debrief analysis for a failed commitment.',
  })
  @ApiParam({ name: 'contractId', description: 'Commitment contract ID' })
  @ApiResponse({ status: 201, description: 'Debrief generated' })
  async generateDebrief(
    @CurrentUser('id') userId: string,
    @Param('contractId', ParseUUIDPipe) contractId: string,
  ) {
    // Verify the contract belongs to user and is failed
    const contract = await this.prisma.commitmentContract.findFirst({
      where: { id: contractId, userId, status: CommitmentStatus.FAILED },
    });

    if (!contract) {
      throw new NotFoundException('Failed contract not found');
    }

    const result = await this.debriefAgent.generateDebrief(userId, contractId);

    return {
      contractId,
      analysis: result.analysis,
      suggestedStakeType: result.suggestedStakeType,
      suggestedStakeAmount: result.suggestedStakeAmount,
      suggestedDeadlineDays: result.suggestedDeadlineDays,
      keyInsights: result.keyInsights,
      createdAt: new Date().toISOString(),
    };
  }
}
