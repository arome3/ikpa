/**
 * GPS Re-Router Controller
 *
 * API endpoints for the GPS Re-Router feature that helps users recover
 * from budget overspending without abandoning their financial goals.
 *
 * @module GpsController
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { differenceInDays } from 'date-fns';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { GpsService } from './gps.service';
import { GpsAnalyticsService } from './gps-analytics.service';
import { RecoveryActionService } from './recovery-action.service';
import {
  RecalculateRequestDto,
  RecalculateResponseDto,
  BudgetStatusDto,
  GoalImpactDto,
  RecoveryPathDto,
  NonJudgmentalMessageDto,
  GetRecoveryPathsQueryDto,
  GetRecoveryPathsResponseDto,
  SelectPathRequestDto,
  SelectPathResponseDto,
  AnalyticsQueryDto,
  AnalyticsDashboardDto,
  UserAnalyticsDto,
  CategoryAnalyticsDto,
  ActiveAdjustmentsResponseDto,
  ActiveSavingsAdjustmentDto,
  ActiveCategoryFreezeDto,
} from './dto';

/**
 * Controller for GPS Re-Router budget recovery system
 *
 * Provides endpoints for:
 * - Recalculating goal probability after budget exceed
 * - Getting available recovery paths
 * - Selecting a recovery path
 *
 * All messages are validated to be non-judgmental, combating the
 * "What-The-Hell Effect" where one slip leads to total abandonment.
 */
@ApiTags('GPS Re-Router')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/gps')
export class GpsController {
  constructor(
    private readonly gpsService: GpsService,
    private readonly analyticsService: GpsAnalyticsService,
    private readonly recoveryActionService: RecoveryActionService,
  ) {}

  // ==========================================
  // RECALCULATE ENDPOINTS
  // ==========================================

  /**
   * Recalculate goal probability after budget exceed
   *
   * This is the main endpoint that:
   * 1. Detects the budget overspend severity
   * 2. Calculates the impact on goal achievement probability
   * 3. Generates three recovery paths with different effort levels
   * 4. Returns a supportive, non-judgmental message
   *
   * Rate limited to 5 requests per minute to prevent abuse.
   */
  @Post('recalculate')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute
  @ApiOperation({
    summary: 'Recalculate goal probability after budget exceed',
    description:
      'Analyzes budget overspending and calculates the impact on goal achievement. ' +
      'Returns three recovery paths with different effort levels and projected probabilities. ' +
      'All messages are supportive and non-judgmental. Rate limited to 5 requests per minute.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recovery analysis completed successfully',
    type: RecalculateResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Budget not found for the specified category',
  })
  @ApiResponse({
    status: 422,
    description: 'No active goal found or insufficient data',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded - Max 5 requests per minute',
  })
  async recalculate(
    @CurrentUser('id') userId: string,
    @Body() dto: RecalculateRequestDto,
  ): Promise<RecalculateResponseDto> {
    const result = await this.gpsService.recalculate(
      userId,
      dto.category,
      dto.goalId,
    );

    return {
      sessionId: result.sessionId,
      budgetStatus: this.toBudgetStatusDto(result.budgetStatus),
      goalImpact: this.toGoalImpactDto(result.goalImpact),
      multiGoalImpact: result.multiGoalImpact
        ? {
            primaryGoal: this.toGoalImpactDto(result.multiGoalImpact.primaryGoal),
            otherGoals: result.multiGoalImpact.otherGoals.map((g) => this.toGoalImpactDto(g)),
            summary: result.multiGoalImpact.summary,
          }
        : undefined,
      recoveryPaths: result.recoveryPaths.map((path) => this.toRecoveryPathDto(path)),
      message: this.toMessageDto(result.message),
    };
  }

  // ==========================================
  // RECOVERY PATH ENDPOINTS
  // ==========================================

  /**
   * Get available recovery paths
   *
   * Returns recovery paths for an existing session or generates new ones
   * based on the most severely exceeded budget.
   */
  @Get('recovery-paths')
  @ApiOperation({
    summary: 'Get available recovery paths',
    description:
      'Returns available recovery paths. If sessionId is provided, returns paths ' +
      'for that specific session. Otherwise, analyzes current budget statuses and ' +
      'generates paths for the most severely exceeded budget.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recovery paths retrieved successfully',
    type: GetRecoveryPathsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  @ApiResponse({
    status: 422,
    description: 'No exceeded budgets found',
  })
  async getRecoveryPaths(
    @CurrentUser('id') userId: string,
    @Query() query: GetRecoveryPathsQueryDto,
  ): Promise<GetRecoveryPathsResponseDto> {
    const paths = await this.gpsService.getRecoveryPaths(userId, query.sessionId);

    return {
      paths: paths.map((path) => this.toRecoveryPathDto(path)),
      sessionId: query.sessionId,
    };
  }

  /**
   * Select a recovery path
   *
   * Records the user's selection and updates the recovery session status.
   */
  @Post('recovery-paths/:pathId/select')
  @ApiOperation({
    summary: 'Select a recovery path',
    description:
      'Records the user selection of a recovery path. Updates the session status ' +
      'and provides a supportive confirmation message. Valid paths are: ' +
      'time_adjustment, rate_adjustment, freeze_protocol.',
  })
  @ApiParam({
    name: 'pathId',
    description: 'Recovery path ID to select',
    example: 'time_adjustment',
    enum: ['time_adjustment', 'rate_adjustment', 'freeze_protocol'],
  })
  @ApiResponse({
    status: 200,
    description: 'Path selected successfully',
    type: SelectPathResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid recovery path ID',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Session already resolved',
  })
  async selectRecoveryPath(
    @CurrentUser('id') userId: string,
    @Param('pathId') pathId: string,
    @Body() dto: SelectPathRequestDto,
  ): Promise<SelectPathResponseDto> {
    const result = await this.gpsService.selectRecoveryPath(
      userId,
      dto.sessionId,
      pathId,
    );

    return {
      success: result.success,
      message: result.message,
      selectedPathId: result.selectedPathId,
      selectedAt: result.selectedAt,
    };
  }

  // ==========================================
  // SESSION ENDPOINTS
  // ==========================================

  /**
   * Get a recovery session by ID
   */
  @Get('sessions/:sessionId')
  @ApiOperation({
    summary: 'Get recovery session details',
    description: 'Returns details of a specific recovery session including status and selected path.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Recovery session ID',
    example: 'session-789-ghi',
  })
  @ApiResponse({
    status: 200,
    description: 'Session retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async getSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    const session = await this.gpsService.getRecoverySession(userId, sessionId);

    return {
      id: session.id,
      category: session.category,
      overspendAmount: Number(session.overspendAmount),
      previousProbability: Number(session.previousProbability),
      newProbability: Number(session.newProbability),
      selectedPathId: session.selectedPathId,
      selectedAt: session.selectedAt,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  // ==========================================
  // ANALYTICS ENDPOINTS
  // ==========================================

  /**
   * Get system-wide analytics dashboard
   *
   * Returns aggregate metrics across all users for the specified time period.
   * Useful for monitoring overall GPS Re-Router effectiveness.
   */
  @Get('analytics/dashboard')
  @ApiOperation({
    summary: 'Get system-wide GPS analytics dashboard',
    description:
      'Returns aggregate analytics including path selection distribution, goal survival rate, ' +
      'time to recovery metrics, and probability restoration metrics. Useful for monitoring ' +
      'overall GPS Re-Router feature effectiveness.',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics dashboard retrieved successfully',
    type: AnalyticsDashboardDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getAnalyticsDashboard(
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsDashboardDto> {
    return this.analyticsService.getDashboard(query.days);
  }

  /**
   * Get current user's GPS analytics
   */
  @Get('analytics/me')
  @ApiOperation({
    summary: 'Get your personal GPS analytics',
    description:
      'Returns your personal GPS Re-Router analytics including total slips, recovery rate, ' +
      'preferred recovery path, and average time to recovery.',
  })
  @ApiResponse({
    status: 200,
    description: 'User analytics retrieved successfully',
    type: UserAnalyticsDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getUserAnalytics(
    @CurrentUser('id') userId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<UserAnalyticsDto> {
    return this.analyticsService.getUserAnalytics(userId, query.days);
  }

  /**
   * Get category-level analytics
   */
  @Get('analytics/categories')
  @ApiOperation({
    summary: 'Get GPS analytics by spending category',
    description:
      'Returns analytics broken down by spending category, showing which categories ' +
      'have the most slips and their recovery rates.',
  })
  @ApiResponse({
    status: 200,
    description: 'Category analytics retrieved successfully',
    type: [CategoryAnalyticsDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getCategoryAnalytics(
    @Query() query: AnalyticsQueryDto,
  ): Promise<CategoryAnalyticsDto[]> {
    return this.analyticsService.getCategoryAnalytics(query.days);
  }

  // ==========================================
  // ACTIVE ADJUSTMENTS ENDPOINTS
  // ==========================================

  /**
   * Get user's active recovery adjustments
   *
   * Returns active savings rate boosts and category freezes.
   */
  @Get('active-adjustments')
  @ApiOperation({
    summary: 'Get your active recovery adjustments',
    description:
      'Returns your currently active recovery adjustments including savings rate boosts ' +
      'and category freezes. Use this to see what recovery actions are currently in effect.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active adjustments retrieved successfully',
    type: ActiveAdjustmentsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getActiveAdjustments(
    @CurrentUser('id') userId: string,
  ): Promise<ActiveAdjustmentsResponseDto> {
    const [savingsAdjustment, categoryFreezes] = await Promise.all([
      this.getActiveSavingsAdjustmentDto(userId),
      this.getActiveCategoryFreezeDtos(userId),
    ]);

    return {
      savingsAdjustment,
      categoryFreezes,
      hasActiveAdjustments: savingsAdjustment !== null || categoryFreezes.length > 0,
    };
  }

  /**
   * Check if a specific category is frozen
   */
  @Get('active-adjustments/frozen/:categoryId')
  @ApiOperation({
    summary: 'Check if a category is frozen',
    description:
      'Checks whether a specific spending category is currently frozen. ' +
      'Returns a boolean indicating the freeze status.',
  })
  @ApiParam({
    name: 'categoryId',
    description: 'Category ID to check',
    example: 'cat-uuid-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Freeze status retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async isCategoryFrozen(
    @CurrentUser('id') userId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ): Promise<{ categoryId: string; isFrozen: boolean }> {
    const isFrozen = await this.recoveryActionService.isCategoryFrozen(userId, categoryId);
    return { categoryId, isFrozen };
  }

  // ==========================================
  // DTO CONVERSION HELPERS
  // ==========================================

  /**
   * Get active savings adjustment as DTO
   */
  private async getActiveSavingsAdjustmentDto(
    userId: string,
  ): Promise<ActiveSavingsAdjustmentDto | null> {
    const adjustment = await this.recoveryActionService.getActiveSavingsAdjustment(userId);
    if (!adjustment) return null;

    // Fetch full adjustment record for additional details
    const fullAdjustment = await this.gpsService.getActiveSavingsAdjustmentDetails(userId);
    if (!fullAdjustment) return null;

    const now = new Date();
    const daysRemaining = Math.max(0, differenceInDays(fullAdjustment.endDate, now));

    return {
      id: fullAdjustment.id,
      sessionId: fullAdjustment.sessionId,
      originalRate: Number(fullAdjustment.originalRate),
      additionalRate: Number(fullAdjustment.additionalRate),
      effectiveRate: Number(fullAdjustment.originalRate) + Number(fullAdjustment.additionalRate),
      durationWeeks: fullAdjustment.durationWeeks,
      startDate: fullAdjustment.startDate,
      endDate: fullAdjustment.endDate,
      daysRemaining,
    };
  }

  /**
   * Get active category freezes as DTOs
   */
  private async getActiveCategoryFreezeDtos(userId: string): Promise<ActiveCategoryFreezeDto[]> {
    const freezes = await this.gpsService.getActiveCategoryFreezeDetails(userId);
    const now = new Date();

    return freezes.map((freeze) => ({
      id: freeze.id,
      sessionId: freeze.sessionId,
      categoryId: freeze.categoryId,
      categoryName: freeze.categoryName,
      durationWeeks: freeze.durationWeeks,
      startDate: freeze.startDate,
      endDate: freeze.endDate,
      savedAmount: Number(freeze.savedAmount),
      daysRemaining: Math.max(0, differenceInDays(freeze.endDate, now)),
    }));
  }

  /**
   * Convert budget status to DTO
   */
  private toBudgetStatusDto(status: {
    category: string;
    categoryId: string;
    budgeted: number;
    spent: number;
    remaining: number;
    overagePercent: number;
    trigger: string;
    period: string;
  }): BudgetStatusDto {
    return {
      category: status.category,
      categoryId: status.categoryId,
      budgeted: status.budgeted,
      spent: status.spent,
      remaining: status.remaining,
      overagePercent: status.overagePercent,
      trigger: status.trigger as BudgetStatusDto['trigger'],
      period: status.period,
    };
  }

  /**
   * Convert goal impact to DTO
   */
  private toGoalImpactDto(impact: {
    goalId: string;
    goalName: string;
    goalAmount: number;
    goalDeadline: Date;
    previousProbability: number;
    newProbability: number;
    probabilityDrop: number;
    message: string;
  }): GoalImpactDto {
    return {
      goalId: impact.goalId,
      goalName: impact.goalName,
      goalAmount: impact.goalAmount,
      goalDeadline: impact.goalDeadline,
      previousProbability: impact.previousProbability,
      newProbability: impact.newProbability,
      probabilityDrop: impact.probabilityDrop,
      message: impact.message,
    };
  }

  /**
   * Convert recovery path to DTO
   */
  private toRecoveryPathDto(path: {
    id: string;
    name: string;
    description: string;
    newProbability: number;
    effort: string;
    timelineImpact?: string;
    savingsImpact?: string;
    freezeDuration?: string;
  }): RecoveryPathDto {
    return {
      id: path.id,
      name: path.name,
      description: path.description,
      newProbability: path.newProbability,
      effort: path.effort as RecoveryPathDto['effort'],
      timelineImpact: path.timelineImpact,
      savingsImpact: path.savingsImpact,
      freezeDuration: path.freezeDuration,
    };
  }

  /**
   * Convert message to DTO
   */
  private toMessageDto(message: {
    tone: string;
    headline: string;
    subtext: string;
  }): NonJudgmentalMessageDto {
    return {
      tone: 'Supportive',
      headline: message.headline,
      subtext: message.subtext,
    };
  }
}
