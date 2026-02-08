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
import { findBestMatches, generateDidYouMeanMessage } from '../../common/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { createMonetaryValue } from '../../common/utils';
import { GpsService } from './gps.service';
import { GpsAnalyticsService } from './gps-analytics.service';
import { RecoveryActionService } from './recovery-action.service';
import { BudgetService } from './budget.service';
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
  ActiveBudgetRebalanceDto,
  TimelineExtensionDto,
  ActiveAdjustmentsSummaryDto,
  MonetaryValueDto,
  StreakStatusDto,
  AchievementsResponseDto,
  WhatIfRequestDto,
  WhatIfResponseDto,
  NotificationsQueryDto,
  NotificationsResponseDto,
  UnreadCountResponseDto,
  MarkReadResponseDto,
  ForecastResponseDto,
  BudgetForecastDto,
  QuickRebalanceDto,
  QuickRebalanceResponseDto,
  RebalanceOptionsResponseDto,
  BudgetInsightsResponseDto,
  ApplyBudgetInsightRequestDto,
  ApplyBudgetInsightResponseDto,
} from './dto';
import { BudgetStatus, GoalImpact } from './interfaces';
import { StreakService } from './streaks';
import { ProgressService } from './progress';
import { GpsNotificationService } from './notification';

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
@Controller('gps')
export class GpsController {
  constructor(
    private readonly gpsService: GpsService,
    private readonly analyticsService: GpsAnalyticsService,
    private readonly recoveryActionService: RecoveryActionService,
    private readonly budgetService: BudgetService,
    private readonly prisma: PrismaService,
    private readonly streakService: StreakService,
    private readonly progressService: ProgressService,
    private readonly notificationService: GpsNotificationService,
  ) {}


  // ==========================================
  // FORECAST ENDPOINTS
  // ==========================================

  /**
   * Get spending forecasts for all budgeted categories
   *
   * Returns projected end-of-period spending, risk levels, and suggested
   * daily limits for each budget. Used for proactive budget alerts.
   */
  @Get('forecast')
  @ApiOperation({
    summary: 'Get spending forecasts for all budgeted categories',
    description:
      'Projects end-of-period spending based on current daily spending rate. ' +
      'Returns risk levels (safe/caution/warning) and suggested daily limits. ' +
      'Use this to warn users BEFORE they overspend.',
  })
  @ApiResponse({
    status: 200,
    description: 'Forecasts retrieved successfully',
    type: ForecastResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getAllForecasts(
    @CurrentUser('id') userId: string,
  ): Promise<ForecastResponseDto> {
    const forecasts = await this.budgetService.getAllProactiveForecasts(userId);

    const atRiskCount = forecasts.filter(
      (f) => f.riskLevel === 'caution' || f.riskLevel === 'warning',
    ).length;

    return {
      forecasts,
      atRiskCount,
      totalCategories: forecasts.length,
    };
  }

  /**
   * Get spending forecast for a specific category
   *
   * Returns projected spending, risk level, and suggested daily limit
   * for a single budgeted category. Accepts category ID or name.
   */
  @Get('forecast/:categoryId')
  @ApiOperation({
    summary: 'Get spending forecast for a specific category',
    description:
      'Returns projected end-of-period spending for one category. ' +
      'Accepts category ID (UUID) or category name.',
  })
  @ApiParam({
    name: 'categoryId',
    description: 'Category ID (UUID) or category name',
    example: 'Food & Dining',
  })
  @ApiResponse({
    status: 200,
    description: 'Forecast retrieved successfully',
    type: BudgetForecastDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Budget not found for the specified category',
  })
  async getCategoryForecast(
    @CurrentUser('id') userId: string,
    @Param('categoryId') categoryId: string,
  ): Promise<BudgetForecastDto | { error: string; category: string }> {
    // Try by category ID first, then by name (follows existing pattern)
    let budget = await this.budgetService.getBudgetByCategoryId(userId, categoryId);
    if (!budget) {
      budget = await this.budgetService.getBudget(userId, categoryId);
    }
    if (!budget) {
      return {
        error: 'Budget not found',
        category: categoryId,
      };
    }

    const forecast = await this.budgetService.getProactiveForecast(
      userId,
      budget.categoryId,
    );

    if (!forecast) {
      return {
        error: 'Insufficient data for forecast',
        category: categoryId,
      };
    }

    return forecast;
  }

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
      goalImpact: result.goalImpact ? this.toGoalImpactDto(result.goalImpact) : null,
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
    const result = await this.gpsService.getRecoveryPaths(userId, query.sessionId);

    return {
      paths: result.paths.map((path) => this.toRecoveryPathDto(path)),
      sessionId: result.sessionId,
      category: result.category,
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
    enum: ['category_rebalance', 'time_adjustment', 'rate_adjustment', 'freeze_protocol'],
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
      details: result.details,
      nextSteps: result.nextSteps,
    };
  }

  // ==========================================
  // WHAT-IF SIMULATION ENDPOINTS
  // ==========================================

  /**
   * Simulate spending impact before committing
   *
   * READ-ONLY operation that previews budget and goal impact.
   * Answers the user need: "What happens if I spend more?"
   */
  @Post('what-if')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  @ApiOperation({
    summary: 'Simulate spending impact',
    description:
      'Preview the impact of additional spending before committing. ' +
      'Shows budget impact, goal probability change, and potential triggers. ' +
      'This is a READ-ONLY operation - no database changes are made.',
  })
  @ApiResponse({
    status: 200,
    description: 'Simulation completed successfully',
    type: WhatIfResponseDto,
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
    description: 'No active goal found',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded - Max 10 requests per minute',
  })
  async simulateWhatIf(
    @CurrentUser('id') userId: string,
    @Body() dto: WhatIfRequestDto,
  ): Promise<WhatIfResponseDto> {
    return this.gpsService.simulateWhatIf(
      userId,
      dto.category,
      dto.additionalSpend,
      dto.goalId,
    );
  }

  // ==========================================
  // SESSION ENDPOINTS
  // ==========================================

  /**
   * Get a recovery session by ID
   *
   * Includes enhanced recovery progress with milestones when a path has been selected.
   * Progress tracking answers the user need: "How far along am I?"
   */
  @Get('sessions/:sessionId')
  @ApiOperation({
    summary: 'Get recovery session details',
    description:
      'Returns details of a specific recovery session including status, selected path, ' +
      'enhanced recovery progress with milestones (25%, 50%, 75%, 100%), ' +
      'and encouraging messages. Progress tracking helps users see their journey.',
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

    // Build the base response
    const baseResponse = {
      id: session.id,
      goalId: session.goalId,
      goalName: session.goal?.name ?? session.category,
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

    // If no path selected yet, return base response without progress
    if (!session.selectedPathId || !session.selectedAt) {
      return baseResponse;
    }

    // Check and record any new milestones
    await this.progressService.checkAndRecordMilestones(userId, sessionId);

    // Get enhanced recovery progress with milestones
    const recoveryProgress = await this.progressService.getRecoveryProgress(userId, sessionId);

    // Get selected path details
    const selectedPath = await this.getSelectedPathDetails(userId, session);

    return {
      ...baseResponse,
      recoveryProgress,
      selectedPath,
    };
  }

  /**
   * Get selected path details for a session
   */
  private async getSelectedPathDetails(
    userId: string,
    session: { selectedPathId: string | null; selectedAt: Date | null },
  ): Promise<{
    id: string;
    name: string;
    expectedCompletion: Date;
  } | undefined> {
    if (!session.selectedPathId || !session.selectedAt) {
      return undefined;
    }

    // Get path name from constants
    const pathNames: Record<string, string> = {
      time_adjustment: 'Timeline Flex',
      rate_adjustment: 'Savings Boost',
      freeze_protocol: 'Category Pause',
    };

    const pathName = pathNames[session.selectedPathId] || session.selectedPathId;
    let expectedCompletion: Date;

    // Calculate expected completion based on path type and active adjustments
    if (session.selectedPathId === 'rate_adjustment') {
      const adjustment = await this.recoveryActionService.getActiveSavingsAdjustment(userId);
      expectedCompletion = adjustment?.endDate || new Date(session.selectedAt.getTime() + 28 * 24 * 60 * 60 * 1000);
    } else if (session.selectedPathId === 'freeze_protocol') {
      const freezes = await this.recoveryActionService.getActiveCategoryFreezes(userId);
      expectedCompletion = freezes.length > 0 ? freezes[0].endDate : new Date(session.selectedAt.getTime() + 28 * 24 * 60 * 60 * 1000);
    } else {
      // For time_adjustment, use 2 weeks as default
      expectedCompletion = new Date(session.selectedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    }

    return {
      id: session.selectedPathId,
      name: pathName,
      expectedCompletion,
    };
  }

  // ==========================================
  // WEEKLY MICRO-BUDGET ENDPOINTS
  // ==========================================

  /**
   * Get weekly breakdown for a budget category
   *
   * Splits the monthly budget into calendar weeks with spending per week,
   * daily limits for the current week, and adjusted allocations for future weeks.
   */
  @Get('budget/:categoryId/weekly')
  @ApiOperation({
    summary: 'Get weekly budget breakdown for a category',
    description:
      'Breaks down a monthly budget into calendar weeks (Mon-Sun). ' +
      'Shows spending per week, daily limit for the current week, ' +
      'and adjusted weekly budgets for remaining weeks. ' +
      'Accepts category ID (UUID) or category name.',
  })
  @ApiParam({
    name: 'categoryId',
    description: 'Category ID (UUID) or category name',
    example: 'Food & Dining',
  })
  @ApiResponse({
    status: 200,
    description: 'Weekly breakdown retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Budget not found for the specified category',
  })
  async getWeeklyBreakdown(
    @CurrentUser('id') userId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.budgetService.getWeeklyBreakdown(userId, categoryId);
  }

  /**
   * Get daily spending limits for all budgeted categories
   *
   * Returns today's safe spending limit per category based on
   * remaining budget divided by remaining days in the period.
   */
  @Get('daily-limits')
  @ApiOperation({
    summary: 'Get daily spending limits for all categories',
    description:
      'Calculates today\'s safe spending limit for every active budget category. ' +
      'Formula: (budget - spent) / daysRemaining. Also shows today\'s actual spending ' +
      'and highlights categories where the daily limit has been exceeded.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daily limits retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getDailyLimits(
    @CurrentUser('id') userId: string,
  ) {
    return this.budgetService.getDailyLimits(userId);
  }

  // ==========================================
  // SPENDING VELOCITY ENDPOINTS
  // ==========================================

  /**
   * Get spending velocity analysis for a category
   *
   * Returns velocity ratio, projected overspend date, and course correction amount.
   * Accepts category ID or category name.
   */
  @Get('spending-velocity/:categoryId')
  @ApiOperation({
    summary: 'Get spending velocity analysis for a category',
    description:
      'Analyzes spending pace relative to budget and time elapsed. ' +
      'Returns velocity ratio, projected overspend date, and recommended daily spend. ' +
      'Accepts category ID (UUID) or category name.',
  })
  @ApiParam({
    name: 'categoryId',
    description: 'Category ID (UUID) or category name',
    example: 'Food & Dining',
  })
  @ApiResponse({
    status: 200,
    description: 'Velocity analysis completed successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Budget not found for the specified category',
  })
  async getSpendingVelocity(
    @CurrentUser('id') userId: string,
    @Param('categoryId') categoryId: string,
  ) {
    // Resolve category by ID or name (follows checkBudgetStatus pattern)
    let budget = await this.budgetService.getBudgetByCategoryId(userId, categoryId);
    if (!budget) {
      budget = await this.budgetService.getBudget(userId, categoryId);
    }
    if (!budget) {
      return {
        error: 'Budget not found',
        category: categoryId,
        velocity: null,
      };
    }

    const velocity = await this.budgetService.calculateSpendingVelocity(
      userId,
      budget.categoryId,
      budget.period,
    );

    if (!velocity) {
      return {
        category: budget.category.name,
        categoryId: budget.categoryId,
        velocity: null,
        message: 'Insufficient data for velocity analysis',
      };
    }

    const budgetAmount = Number(budget.amount);
    const spentAmount = await this.budgetService.getSpent(userId, budget.categoryId, budget.period);
    const currency = budget.currency || 'USD';

    // Determine velocity status
    let status: 'on_pace' | 'slightly_ahead' | 'significantly_ahead';
    if (velocity.velocityRatio < 1.1) {
      status = 'on_pace';
    } else if (velocity.velocityRatio < 1.3) {
      status = 'slightly_ahead';
    } else {
      status = 'significantly_ahead';
    }

    // Build recommendations
    const recommendations: string[] = [];
    if (status === 'significantly_ahead') {
      recommendations.push(
        `Reduce daily spending to ${createMonetaryValue(Math.round(velocity.courseCorrectionDaily), currency).formatted} to stay on track`,
      );
      if (velocity.projectedOverspendDate) {
        recommendations.push(
          `At current pace, budget will be exceeded around ${velocity.projectedOverspendDate.toLocaleDateString()}`,
        );
      }
    } else if (status === 'slightly_ahead') {
      recommendations.push('Spending is slightly above pace — consider slowing down');
    } else {
      recommendations.push('Spending is on pace — keep it up!');
    }

    return {
      category: budget.category.name,
      categoryId: budget.categoryId,
      velocity: {
        ratio: velocity.velocityRatio,
        status,
        dailySpendingRate: createMonetaryValue(Math.round(velocity.spendingVelocity), currency),
        safeDailyRate: createMonetaryValue(Math.round(velocity.safeBurnRate), currency),
        courseCorrectionDaily: createMonetaryValue(Math.round(velocity.courseCorrectionDaily), currency),
      },
      timeline: {
        daysElapsed: velocity.daysElapsed,
        daysRemaining: velocity.daysRemaining,
        projectedOverspendDate: velocity.projectedOverspendDate,
        willOverspend: velocity.willOverspend,
      },
      budget: {
        budgeted: createMonetaryValue(budgetAmount, currency),
        spent: createMonetaryValue(spentAmount, currency),
        remaining: createMonetaryValue(budgetAmount - spentAmount, currency),
      },
      recommendations,
    };
  }

  // ==========================================
  // ANALYTICS ENDPOINTS
  // ==========================================

  /**
   * Get user's analytics dashboard
   *
   * Returns aggregate metrics for the current user for the specified time period.
   */
  @Get('analytics/dashboard')
  @ApiOperation({
    summary: 'Get your GPS analytics dashboard',
    description:
      'Returns your analytics including path selection distribution, goal survival rate, ' +
      'time to recovery metrics, and probability restoration metrics.',
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
    @CurrentUser('id') userId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsDashboardDto> {
    return this.analyticsService.getDashboard(userId, query.days);
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
    @CurrentUser('id') userId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<CategoryAnalyticsDto[]> {
    return this.analyticsService.getCategoryAnalytics(userId, query.days);
  }

  // ==========================================
  // STREAK ENDPOINTS
  // ==========================================

  /**
   * Get current streak status
   *
   * Returns the user's current streak of consecutive days staying under budget.
   * Answers the user need: "Am I doing well?"
   */
  @Get('streaks')
  @ApiOperation({
    summary: 'Get your current streak status',
    description:
      'Returns your streak of consecutive days staying under budget. ' +
      'Includes current streak, longest streak, and encouragement messages.',
  })
  @ApiResponse({
    status: 200,
    description: 'Streak status retrieved successfully',
    type: StreakStatusDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getStreakStatus(
    @CurrentUser('id') userId: string,
  ): Promise<StreakStatusDto> {
    return this.streakService.getStreakStatus(userId);
  }

  /**
   * Get user's achievements
   *
   * Returns earned and available achievements for gamification.
   */
  @Get('achievements')
  @ApiOperation({
    summary: 'Get your achievements',
    description:
      'Returns your earned achievements and available achievements to unlock. ' +
      'Achievements reward positive financial behaviors with encouraging names.',
  })
  @ApiResponse({
    status: 200,
    description: 'Achievements retrieved successfully',
    type: AchievementsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getAchievements(
    @CurrentUser('id') userId: string,
  ): Promise<AchievementsResponseDto> {
    return this.streakService.getAchievements(userId);
  }

  // ==========================================
  // NOTIFICATION ENDPOINTS
  // ==========================================

  /**
   * Get user's notifications
   *
   * Returns proactive alerts about budget events.
   * Answers the user need: "Tell me when I overspend"
   */
  @Get('notifications')
  @ApiOperation({
    summary: 'Get your GPS notifications',
    description:
      'Returns proactive notifications about budget threshold crossings. ' +
      'Notifications are created automatically when you approach or exceed budget limits.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    type: NotificationsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query() query: NotificationsQueryDto,
  ): Promise<NotificationsResponseDto> {
    return this.notificationService.getNotifications(userId, query.limit, query.unreadOnly);
  }

  /**
   * Get unread notification count
   *
   * Useful for displaying a badge on the notifications icon.
   */
  @Get('notifications/unread-count')
  @ApiOperation({
    summary: 'Get unread notification count',
    description:
      'Returns the count of unread notifications. Use this for displaying ' +
      'a notification badge in your UI.',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
    type: UnreadCountResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getUnreadCount(
    @CurrentUser('id') userId: string,
  ): Promise<UnreadCountResponseDto> {
    return this.notificationService.getUnreadCount(userId);
  }

  /**
   * Mark a notification as read
   */
  @Post('notifications/:notificationId/read')
  @ApiOperation({
    summary: 'Mark a notification as read',
    description: 'Marks a specific notification as read.',
  })
  @ApiParam({
    name: 'notificationId',
    description: 'Notification ID to mark as read',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    type: MarkReadResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async markNotificationAsRead(
    @CurrentUser('id') userId: string,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ): Promise<MarkReadResponseDto> {
    return this.notificationService.markAsRead(userId, notificationId);
  }

  /**
   * Mark all notifications as read
   */
  @Post('notifications/read-all')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Marks all unread notifications as read.',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
    type: MarkReadResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async markAllNotificationsAsRead(
    @CurrentUser('id') userId: string,
  ): Promise<MarkReadResponseDto> {
    return this.notificationService.markAllAsRead(userId);
  }

  // ==========================================
  // RECOVERY TRACKING ENDPOINTS
  // ==========================================

  /**
   * Get recovery progress for an active session
   *
   * Returns adherence tracking, actual vs target savings, and
   * encouraging status messages.
   */
  @Get('recovery-progress/:sessionId')
  @ApiOperation({
    summary: 'Get recovery progress for an active session',
    description:
      'Returns progress tracking for a recovery session including adherence percentage, ' +
      'actual vs target savings, and encouraging messages.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Recovery session ID',
    example: 'session-789-ghi',
  })
  @ApiResponse({
    status: 200,
    description: 'Recovery progress retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async getRecoveryProgress(
    @CurrentUser('id') userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.gpsService.getRecoveryProgress(userId, sessionId);
  }

  /**
   * Get recovery history
   *
   * Returns past recovery sessions with outcomes - whether
   * each recovery path actually worked.
   */
  @Get('recovery-history')
  @ApiOperation({
    summary: 'Get past recovery sessions with outcomes',
    description:
      'Returns a history of past recovery sessions showing the path chosen, ' +
      'target vs actual savings, and whether each recovery was successful.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recovery history retrieved successfully',
  })
  async getRecoveryHistory(
    @CurrentUser('id') userId: string,
  ) {
    return this.gpsService.getRecoveryHistory(userId);
  }

  // ==========================================
  // SPENDING BREAKDOWN ENDPOINTS
  // ==========================================

  /**
   * Get spending breakdown for a category
   *
   * Shows where money is going within a budget category,
   * grouped by merchant with actionable insights.
   */
  @Get('spending-breakdown/:categoryId')
  @ApiOperation({
    summary: 'Get spending breakdown for a category',
    description:
      'Returns a detailed breakdown of spending within a budget category, ' +
      'grouped by merchant or description. Shows top 5 subcategories with ' +
      'percentages and generates actionable reduction insights.',
  })
  @ApiParam({
    name: 'categoryId',
    description: 'Category ID (UUID) or category name',
    example: 'Food & Dining',
  })
  @ApiResponse({
    status: 200,
    description: 'Spending breakdown retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Budget not found for the specified category',
  })
  async getSpendingBreakdown(
    @CurrentUser('id') userId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.budgetService.getSpendingBreakdown(userId, categoryId);
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
    // Get user currency for rebalance formatting
    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });
    const currency = userRecord?.currency || 'NGN';

    const [savingsAdjustment, categoryFreezes, timelineExtensionsData, rebalancesData] =
      await Promise.all([
        this.getActiveSavingsAdjustmentDto(userId),
        this.getActiveCategoryFreezeDtos(userId),
        this.gpsService.getTimelineExtensions(userId),
        this.recoveryActionService.getActiveBudgetRebalances(userId),
      ]);

    // Convert timeline extensions to DTOs
    const timelineExtensions: TimelineExtensionDto[] = timelineExtensionsData.map((ext) => ({
      goalId: ext.goalId,
      goalName: ext.goalName,
      originalDeadline: ext.originalDeadline,
      newDeadline: ext.newDeadline,
      extensionDays: ext.extensionDays,
      sessionId: ext.sessionId,
    }));

    // Convert rebalances to DTOs
    const budgetRebalances: ActiveBudgetRebalanceDto[] = rebalancesData.map((r) => ({
      id: r.id,
      fromCategoryId: r.fromCategoryId,
      fromCategoryName: r.fromCategoryName,
      toCategoryId: r.toCategoryId,
      toCategoryName: r.toCategoryName,
      amount: createMonetaryValue(r.amount, currency),
      createdAt: r.createdAt,
    }));

    // Calculate summary
    const summary = this.calculateAdjustmentsSummary(
      savingsAdjustment,
      categoryFreezes,
      timelineExtensions,
    );

    return {
      savingsAdjustment,
      categoryFreezes,
      timelineExtensions,
      budgetRebalances,
      summary,
      hasActiveAdjustments:
        savingsAdjustment !== null ||
        categoryFreezes.length > 0 ||
        timelineExtensions.length > 0 ||
        budgetRebalances.length > 0,
    };
  }

  /**
   * Check if a specific category is frozen
   *
   * Accepts either a category ID (UUID) or category name (e.g., "Food & Dining").
   * Returns detailed freeze information when the category is frozen.
   */
  @Get('active-adjustments/frozen/:categoryId')
  @ApiOperation({
    summary: 'Check if a category is frozen',
    description:
      'Checks whether a specific spending category is currently frozen. ' +
      'Accepts either a category ID (UUID) or category name (e.g., "Food & Dining"). ' +
      'Returns freeze status and detailed information when frozen.',
  })
  @ApiParam({
    name: 'categoryId',
    description: 'Category ID (UUID) or category name (e.g., "Food & Dining")',
    example: 'Food & Dining',
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
    @Param('categoryId') categoryId: string,
  ): Promise<{
    categoryId: string;
    categoryName: string;
    isFrozen: boolean;
    freezeDetails?: {
      startDate: Date;
      endDate: Date;
      daysRemaining: number;
      reason: string;
    };
    suggestions?: Array<{ id: string; name: string }>;
    didYouMean?: string;
  }> {
    const freezeDetails = await this.recoveryActionService.getCategoryFreezeDetails(
      userId,
      categoryId,
    );

    if (!freezeDetails) {
      // Category is not frozen - try to find similar categories for suggestions
      const allCategories = await this.prisma.expenseCategory.findMany({
        where: { isDefault: true },
        select: { id: true, name: true },
      });

      // Check if the provided categoryId matches any known category
      const matchedCategory = allCategories.find(
        (c) =>
          c.id.toLowerCase() === categoryId.toLowerCase() ||
          c.name.toLowerCase() === categoryId.toLowerCase(),
      );

      if (matchedCategory) {
        // Valid category, just not frozen
        return {
          categoryId: matchedCategory.id,
          categoryName: matchedCategory.name,
          isFrozen: false,
        };
      }

      // Unknown category - provide "Did you mean?" suggestions
      const suggestions = findBestMatches(categoryId, allCategories, {
        maxResults: 3,
        minSimilarity: 0.3,
      });

      const didYouMean = generateDidYouMeanMessage(categoryId, suggestions);

      return {
        categoryId: categoryId,
        categoryName: categoryId,
        isFrozen: false,
        suggestions: suggestions.length > 0 ? suggestions.map((s) => ({ id: s.id, name: s.name })) : undefined,
        didYouMean: didYouMean || undefined,
      };
    }

    // Category is frozen - return detailed information
    const now = new Date();
    const daysRemaining = Math.max(0, differenceInDays(freezeDetails.endDate, now));

    return {
      categoryId: freezeDetails.categoryId,
      categoryName: freezeDetails.categoryName,
      isFrozen: true,
      freezeDetails: {
        startDate: freezeDetails.startDate,
        endDate: freezeDetails.endDate,
        daysRemaining,
        reason: `Category frozen as part of recovery action (Session: ${freezeDetails.sessionId})`,
      },
    };
  }


  // ==========================================
  // QUICK REBALANCE ENDPOINTS
  // ==========================================

  /**
   * Quick rebalance: move budget between categories
   *
   * Lightweight budget move without Monte Carlo simulation or recovery sessions.
   * User picks source category, destination category, and amount. Done.
   */
  @Post('quick-rebalance')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  @ApiOperation({
    summary: 'Quick budget rebalance between categories',
    description:
      'Move budget from one category to another without creating a recovery session. ' +
      'No simulation, no multi-step flow. Validates surplus availability and rebalance cap. ' +
      'Rate limited to 10 requests per minute.',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget moved successfully',
    type: QuickRebalanceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (insufficient budget, same category, etc.)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded or rebalance frequency cap reached',
  })
  async quickRebalance(
    @CurrentUser('id') userId: string,
    @Body() dto: QuickRebalanceDto,
  ): Promise<QuickRebalanceResponseDto> {
    return this.budgetService.quickRebalance(
      userId,
      dto.fromCategoryId,
      dto.toCategoryId,
      dto.amount,
    );
  }

  /**
   * Get rebalance options for a category
   *
   * Returns surplus categories that can be used as source for budget moves.
   * Excludes the given category from results.
   */
  @Get('rebalance-options/:categoryId')
  @ApiOperation({
    summary: 'Get available rebalance source categories',
    description:
      'Returns categories with budget surplus that can be used as source for quick rebalance. ' +
      'Excludes the specified category. Includes rebalance frequency cap status.',
  })
  @ApiParam({
    name: 'categoryId',
    description: 'Category ID to exclude (the destination category)',
    example: 'food-dining',
  })
  @ApiResponse({
    status: 200,
    description: 'Rebalance options retrieved successfully',
    type: RebalanceOptionsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getRebalanceOptions(
    @CurrentUser('id') userId: string,
    @Param('categoryId') categoryId: string,
  ): Promise<RebalanceOptionsResponseDto> {
    return this.budgetService.getRebalanceOptions(userId, categoryId);
  }


  // ==========================================
  // BUDGET HEALTH CHECK ENDPOINTS
  // ==========================================

  /**
   * Get budget realism insights
   *
   * Analyzes spending patterns over the last 3 months to detect
   * budgets that are consistently exceeded. Returns suggestions
   * for budget adjustments with offset categories.
   */
  @Get('budget-insights')
  @ApiOperation({
    summary: 'Get budget realism insights',
    description:
      'Analyzes spending patterns over the last 3 months to detect unrealistic budgets. ' +
      'If someone overspends on a category 2+ months in a row by 15%+, the budget is ' +
      'flagged as unrealistic with a suggested adjustment and offset category.',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget insights retrieved successfully',
    type: BudgetInsightsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getBudgetInsights(
    @CurrentUser('id') userId: string,
  ): Promise<BudgetInsightsResponseDto> {
    const insights = await this.budgetService.analyzeBudgetRealism(userId);

    return {
      insights,
      hasUnrealisticBudgets: insights.length > 0,
    };
  }

  /**
   * Apply a budget insight adjustment
   *
   * Updates both budgets in a single transaction:
   * increases the underfunded category and decreases the surplus category.
   */
  @Post('budget-insights/apply')
  @ApiOperation({
    summary: 'Apply a budget insight adjustment',
    description:
      'Applies a budget realism adjustment by increasing the underfunded category budget ' +
      'and optionally decreasing a surplus category budget. Both changes happen atomically.',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget adjustment applied successfully',
    type: ApplyBudgetInsightResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body',
  })
  async applyBudgetInsight(
    @CurrentUser('id') userId: string,
    @Body() dto: ApplyBudgetInsightRequestDto,
  ): Promise<ApplyBudgetInsightResponseDto> {
    const result = await this.budgetService.applyBudgetInsight(userId, {
      categoryId: dto.categoryId,
      suggestedBudget: dto.suggestedBudget,
      offsetCategoryId: dto.offsetCategoryId,
      offsetAmount: dto.offsetAmount,
    });

    return {
      success: true,
      updated: result.updated,
      message: 'Budget adjusted successfully',
    };
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
      savedAmount: createMonetaryValue(Number(freeze.savedAmount), 'USD'),
      daysRemaining: Math.max(0, differenceInDays(freeze.endDate, now)),
    }));
  }

  /**
   * Calculate summary of all active adjustments
   */
  private calculateAdjustmentsSummary(
    savingsAdjustment: ActiveSavingsAdjustmentDto | null,
    categoryFreezes: ActiveCategoryFreezeDto[],
    timelineExtensions: TimelineExtensionDto[],
  ): ActiveAdjustmentsSummaryDto {
    // Calculate estimated monthly savings
    // From category freezes: sum of savedAmount (which is estimated savings over the freeze period)
    // Convert to monthly: savedAmount / durationWeeks * 4 (approx weeks per month)
    const freezeMonthlySavings = categoryFreezes.reduce((total, freeze) => {
      const monthlyEquivalent = (freeze.savedAmount.amount / freeze.durationWeeks) * 4;
      return total + monthlyEquivalent;
    }, 0);

    // Note: Savings boost impact is measured in percentage points (additionalRate), not absolute amounts.
    // We would need the user's monthly income to calculate monetary impact.
    // For now, estimatedMonthlySavings only includes concrete monetary amounts from freezes.
    const estimatedMonthlySavingsAmount = Math.round(freezeMonthlySavings);

    // Find the earliest end date of active adjustments
    const endDates: Date[] = [];

    if (savingsAdjustment) {
      endDates.push(savingsAdjustment.endDate);
    }

    categoryFreezes.forEach((freeze) => {
      endDates.push(freeze.endDate);
    });

    // Note: Timeline extensions don't have an "end date" - they permanently extend the goal deadline
    // So we only consider savings adjustments and freezes for recovery date

    const estimatedRecoveryDate =
      endDates.length > 0
        ? new Date(Math.min(...endDates.map((d) => d.getTime())))
        : null;

    return {
      totalActiveFreezes: categoryFreezes.length,
      totalActiveBoosts: savingsAdjustment ? 1 : 0,
      totalTimelineExtensions: timelineExtensions.length,
      estimatedMonthlySavings: createMonetaryValue(estimatedMonthlySavingsAmount, 'USD'),
      estimatedRecoveryDate,
    };
  }

  /**
   * Convert budget status to DTO
   */
  private toBudgetStatusDto(status: BudgetStatus): BudgetStatusDto {
    return {
      category: status.category,
      categoryId: status.categoryId,
      budgeted: status.budgeted as MonetaryValueDto,
      spent: status.spent as MonetaryValueDto,
      remaining: status.remaining as MonetaryValueDto,
      overagePercent: status.overagePercent,
      trigger: status.trigger as BudgetStatusDto['trigger'],
      period: status.period,
    };
  }

  /**
   * Convert goal impact to DTO
   */
  private toGoalImpactDto(impact: GoalImpact): GoalImpactDto {
    return {
      goalId: impact.goalId,
      goalName: impact.goalName,
      goalAmount: impact.goalAmount as MonetaryValueDto,
      goalDeadline: impact.goalDeadline,
      previousProbability: impact.previousProbability,
      newProbability: impact.newProbability,
      probabilityDrop: impact.probabilityDrop,
      message: impact.message,
      projectedDate: impact.projectedDate,
      humanReadable: impact.humanReadable,
      scheduleStatus: impact.scheduleStatus,
    };
  }

  /**
   * Convert recovery path to DTO
   */
  private toRecoveryPathDto(path: {
    id: string;
    name: string;
    description: string;
    newProbability: number | null;
    effort: string;
    timelineImpact?: string;
    savingsImpact?: string;
    freezeDuration?: string;
    rebalanceInfo?: {
      fromCategory: string;
      fromCategoryId: string;
      availableSurplus: number;
      coverageAmount: number;
      isFullCoverage: boolean;
    };
    concreteActions?: string[];
    budgetImpact?: string;
    timelineEffect?: string;
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
      rebalanceInfo: path.rebalanceInfo,
      concreteActions: path.concreteActions,
      budgetImpact: path.budgetImpact,
      timelineEffect: path.timelineEffect,
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
