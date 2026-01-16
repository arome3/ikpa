import { Controller, Get, Param, Query, UseGuards, ParseEnumPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { FinanceService } from './finance.service';
import {
  CashFlowScoreResponseDto,
  ScoreHistoryQueryDto,
  ScoreHistoryResponseDto,
  FinancialSnapshotDto,
  SnapshotHistoryQueryDto,
  SnapshotListResponseDto,
  MetricDetailResponseDto,
  ValidMetric,
} from './dto';
import { getScoreLabel, getScoreColor } from './interfaces';

/**
 * Finance Controller
 *
 * Provides endpoints for the Cash Flow Score and related financial metrics.
 * All endpoints require authentication via JWT.
 *
 * Key Features:
 * - Cash Flow Score (0-100) with component breakdown
 * - Score history with trend analysis
 * - Full financial snapshots
 * - Individual metric detail endpoints
 */
@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ==========================================
  // CASH FLOW SCORE ENDPOINTS
  // ==========================================

  /**
   * Get the current Cash Flow Score
   *
   * Rate limited more strictly since score calculation is expensive.
   * Allows 5 requests per minute per user.
   */
  @Get('score')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @ApiOperation({
    summary: 'Get Cash Flow Score',
    description:
      'Returns the current Cash Flow Score (0-100) with component breakdown. ' +
      'If a score was calculated today, returns the cached version. ' +
      'Otherwise, calculates a fresh score.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cash Flow Score retrieved successfully',
    type: CashFlowScoreResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 422,
    description: 'Insufficient financial data to calculate score',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async getCashFlowScore(
    @CurrentUser('id') userId: string,
  ): Promise<CashFlowScoreResponseDto> {
    const result = await this.financeService.getCashFlowScore(userId);
    const previousScore = await this.financeService.getPreviousScore(userId);

    return {
      finalScore: result.finalScore,
      components: {
        savingsRate: result.components.savingsRate,
        runwayMonths: result.components.runwayMonths,
        debtToIncome: result.components.debtToIncome,
        incomeStability: result.components.incomeStability,
        dependencyRatio: result.components.dependencyRatio,
      },
      calculation: result.calculation,
      timestamp: result.timestamp,
      label: getScoreLabel(result.finalScore),
      color: getScoreColor(result.finalScore),
      previousScore: previousScore ?? undefined,
      change: previousScore !== null ? result.finalScore - previousScore : undefined,
    };
  }

  /**
   * Get score history for trend analysis
   */
  @Get('score/history')
  @ApiOperation({
    summary: 'Get Score History',
    description:
      'Returns historical Cash Flow Scores for the specified period (30, 90, or 365 days). ' +
      'Includes trend analysis (up, down, stable) and average score.',
  })
  @ApiResponse({
    status: 200,
    description: 'Score history retrieved successfully',
    type: ScoreHistoryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'No score history found for the specified period',
  })
  async getScoreHistory(
    @CurrentUser('id') userId: string,
    @Query() query: ScoreHistoryQueryDto,
  ): Promise<ScoreHistoryResponseDto> {
    return this.financeService.getScoreHistory(userId, query.days ?? 30);
  }

  // ==========================================
  // FINANCIAL SNAPSHOT ENDPOINTS
  // ==========================================

  /**
   * Get current financial snapshot
   *
   * Rate limited since this may trigger score calculation.
   * Allows 5 requests per minute per user.
   */
  @Get('snapshot')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @ApiOperation({
    summary: 'Get Financial Snapshot',
    description:
      'Returns the complete financial snapshot including all metrics: ' +
      'Cash Flow Score, savings rate, runway months, burn rate, dependency ratio, ' +
      'net worth, totals for income, expenses, savings, debt, assets, and support.',
  })
  @ApiResponse({
    status: 200,
    description: 'Financial snapshot retrieved successfully',
    type: FinancialSnapshotDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 422,
    description: 'Insufficient financial data to generate snapshot',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async getCurrentSnapshot(
    @CurrentUser('id') userId: string,
  ): Promise<FinancialSnapshotDto> {
    const snapshot = await this.financeService.getCurrentSnapshot(userId);

    return {
      id: snapshot.id,
      userId: snapshot.userId,
      date: snapshot.date,
      cashFlowScore: snapshot.cashFlowScore,
      savingsRate: Number(snapshot.savingsRate),
      runwayMonths: Number(snapshot.runwayMonths),
      burnRate: Number(snapshot.burnRate),
      dependencyRatio: Number(snapshot.dependencyRatio),
      netWorth: Number(snapshot.netWorth),
      totalIncome: Number(snapshot.totalIncome),
      totalExpenses: Number(snapshot.totalExpenses),
      totalSavings: Number(snapshot.totalSavings),
      totalDebt: Number(snapshot.totalDebt),
      totalAssets: Number(snapshot.totalAssets),
      totalSupport: Number(snapshot.totalSupport),
      currency: snapshot.currency,
      createdAt: snapshot.createdAt,
    };
  }

  /**
   * Get historical snapshots with pagination
   */
  @Get('snapshot/history')
  @ApiOperation({
    summary: 'Get Snapshot History',
    description:
      'Returns historical financial snapshots for the specified date range. ' +
      'Supports pagination with limit/offset parameters. ' +
      'Useful for tracking financial health trends over time.',
  })
  @ApiResponse({
    status: 200,
    description: 'Snapshot history retrieved successfully',
    type: SnapshotListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getSnapshotHistory(
    @CurrentUser('id') userId: string,
    @Query() query: SnapshotHistoryQueryDto,
  ): Promise<SnapshotListResponseDto> {
    const result = await this.financeService.getSnapshotHistory(
      userId,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
      query.limit ?? 100,
      query.offset ?? 0,
    );

    return {
      snapshots: result.snapshots.map((snapshot) => ({
        id: snapshot.id,
        userId: snapshot.userId,
        date: snapshot.date,
        cashFlowScore: snapshot.cashFlowScore,
        savingsRate: Number(snapshot.savingsRate),
        runwayMonths: Number(snapshot.runwayMonths),
        burnRate: Number(snapshot.burnRate),
        dependencyRatio: Number(snapshot.dependencyRatio),
        netWorth: Number(snapshot.netWorth),
        totalIncome: Number(snapshot.totalIncome),
        totalExpenses: Number(snapshot.totalExpenses),
        totalSavings: Number(snapshot.totalSavings),
        totalDebt: Number(snapshot.totalDebt),
        totalAssets: Number(snapshot.totalAssets),
        totalSupport: Number(snapshot.totalSupport),
        currency: snapshot.currency,
        createdAt: snapshot.createdAt,
      })),
      count: result.snapshots.length,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore,
      },
    };
  }

  // ==========================================
  // INDIVIDUAL METRIC ENDPOINTS
  // ==========================================

  /**
   * Get detail for a specific metric
   *
   * Uses ParseEnumPipe for type-safe metric validation at the controller level.
   */
  @Get('metrics/:metric')
  @ApiOperation({
    summary: 'Get Metric Detail',
    description:
      'Returns detailed information for a specific metric including current value, ' +
      'change from previous period, trend direction, and historical values. ' +
      'Valid metrics: cash-flow, savings-rate, runway, dependency, net-worth.',
  })
  @ApiParam({
    name: 'metric',
    description: 'The metric to retrieve',
    enum: ValidMetric,
    example: 'cash-flow',
  })
  @ApiResponse({
    status: 200,
    description: 'Metric detail retrieved successfully',
    type: MetricDetailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid metric name',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getMetricDetail(
    @CurrentUser('id') userId: string,
    @Param('metric', new ParseEnumPipe(ValidMetric)) metric: ValidMetric,
  ): Promise<MetricDetailResponseDto> {
    const detail = await this.financeService.getMetricDetail(userId, metric);

    return {
      current: detail.current,
      change: detail.change,
      trend: detail.trend,
      history: detail.history.map((h) => ({
        date: h.date,
        value: h.value,
      })),
    };
  }
}
