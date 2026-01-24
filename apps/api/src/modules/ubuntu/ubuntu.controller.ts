import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
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
import { UbuntuService } from './ubuntu.service';
import {
  DependencyRatioResponseDto,
  CreateFamilySupportDto,
  FamilySupportResponseDto,
  ReportEmergencyDto,
  EmergencyResponseDto,
  SelectAdjustmentDto,
  AdjustmentsResponseDto,
  AdjustmentResultDto,
  FamilySupportListQueryDto,
  FamilySupportListResponseDto,
  UpdateFamilySupportDto,
  EmergencyListQueryDto,
  EmergencyListResponseDto,
  RatioHistoryQueryDto,
  RatioHistoryResponseDto,
} from './dto';

/**
 * Ubuntu Manager Controller
 *
 * The Ubuntu Manager recognizes that in African cultures, supporting family
 * is a VALUE, not a problem. It reframes family transfers as "Social Capital
 * Investment" and provides non-judgmental adjustments for family emergencies.
 *
 * Ubuntu Philosophy: "I am because we are."
 *
 * Key Features:
 * - Dependency ratio tracking with culturally-calibrated thresholds
 * - Family support tracking with positive reframing
 * - Emergency reporting with multiple adjustment options
 * - Non-judgmental messaging throughout
 */
@ApiTags('Ubuntu Manager')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/ubuntu')
export class UbuntuController {
  constructor(private readonly ubuntuService: UbuntuService) {}

  // ==========================================
  // DEPENDENCY RATIO ENDPOINTS
  // ==========================================

  /**
   * Get current dependency ratio with component breakdown
   */
  @Get('dependency-ratio')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get Dependency Ratio',
    description:
      'Returns the current dependency ratio (family support / income) with ' +
      'breakdown by relationship category. Uses culturally-calibrated thresholds: ' +
      'GREEN (0-10%), ORANGE (10-35%), RED (35%+). The ORANGE zone is considered ' +
      '"healthy" in African context, not problematic.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dependency ratio retrieved successfully',
    type: DependencyRatioResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async getDependencyRatio(
    @CurrentUser('id') userId: string,
  ): Promise<DependencyRatioResponseDto> {
    const result = await this.ubuntuService.getDependencyRatio(userId);

    return {
      totalRatio: result.totalRatio,
      riskLevel: result.riskLevel,
      components: {
        parentSupport: result.components.parentSupport,
        siblingEducation: result.components.siblingEducation,
        extendedFamily: result.components.extendedFamily,
        communityContribution: result.components.communityContribution,
      },
      monthlyTotal: result.monthlyTotal,
      monthlyIncome: result.monthlyIncome,
      currency: result.currency,
      message: {
        headline: result.message.headline,
        subtext: result.message.subtext,
      },
      trend: result.trend,
    };
  }

  // ==========================================
  // FAMILY SUPPORT ENDPOINTS
  // ==========================================

  /**
   * Add a new family support obligation
   */
  @Post('family-support')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Add Family Support',
    description:
      'Creates a new family support obligation. This represents ongoing ' +
      'commitments like monthly allowance to parents, sibling school fees, ' +
      'or extended family contributions. The system reframes these as ' +
      '"Social Capital Investment" rather than expenses.',
  })
  @ApiResponse({
    status: 201,
    description: 'Family support created successfully',
    type: FamilySupportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async addFamilySupport(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateFamilySupportDto,
  ): Promise<FamilySupportResponseDto> {
    const result = await this.ubuntuService.addFamilySupport(userId, dto);

    return {
      id: result.id,
      name: result.name,
      relationship: result.relationship,
      amount: Number(result.amount),
      currency: result.currency,
      frequency: result.frequency as any,
      description: result.description,
      isActive: result.isActive,
      createdAt: result.createdAt,
      reframedLabel: result.reframedLabel,
    };
  }

  // ==========================================
  // EMERGENCY ENDPOINTS
  // ==========================================

  /**
   * Report a family emergency
   */
  @Post('emergency')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Report Family Emergency',
    description:
      'Reports a family emergency that requires financial support. ' +
      'This creates a pending emergency record that can then be addressed ' +
      'using one of the adjustment options (emergency fund tap, goal extension, ' +
      'or temporary savings reduction).',
  })
  @ApiResponse({
    status: 201,
    description: 'Emergency reported successfully',
    type: EmergencyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async reportEmergency(
    @CurrentUser('id') userId: string,
    @Body() dto: ReportEmergencyDto,
  ): Promise<EmergencyResponseDto> {
    const emergency = await this.ubuntuService.reportEmergency(userId, dto);

    return {
      id: emergency.id,
      type: emergency.type,
      recipientName: emergency.recipientName,
      relationship: emergency.relationship,
      amount: Number(emergency.amount),
      currency: emergency.currency,
      description: emergency.description,
      status: emergency.status,
      reportedAt: emergency.reportedAt,
      message:
        'Review your adjustment options to handle this emergency while protecting your goals.',
    };
  }

  /**
   * Get adjustment options for an emergency
   */
  @Get('adjustments/:emergencyId')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get Adjustment Options',
    description:
      'Returns available adjustment options for handling a family emergency. ' +
      'Options include: Emergency Fund Tap (recommended if fund >= 50% of need), ' +
      'Goal Timeline Extension (add 4 weeks to deadline), and Temporary Savings ' +
      'Reduction (reduce rate by 50% for 8 weeks). Each option shows the impact ' +
      'on goal probability and estimated recovery time.',
  })
  @ApiParam({
    name: 'emergencyId',
    description: 'ID of the emergency to get adjustment options for',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Adjustment options retrieved successfully',
    type: AdjustmentsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Emergency not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async getAdjustmentOptions(
    @CurrentUser('id') userId: string,
    @Param('emergencyId', new ParseUUIDPipe()) emergencyId: string,
  ): Promise<AdjustmentsResponseDto> {
    const result = await this.ubuntuService.getAdjustmentOptions(userId, emergencyId);

    return {
      emergencyId: result.emergencyId,
      emergencyAmount: result.emergencyAmount,
      recipientName: result.recipientName,
      relationship: result.relationship,
      originalGoalProbability: result.originalGoalProbability,
      options: result.options.map((option) => ({
        type: option.type,
        label: option.label,
        description: option.description,
        recoveryWeeks: option.recoveryWeeks,
        newGoalProbability: option.newGoalProbability,
        recommended: option.recommended,
        available: option.available,
        unavailableReason: option.unavailableReason,
        details: option.details,
      })),
      message:
        "We understand family comes first. Here are your options to handle this while protecting your future.",
    };
  }

  /**
   * Select an adjustment to apply
   */
  @Post('emergency/adjust')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Apply Adjustment',
    description:
      'Applies the selected adjustment to handle the emergency. This will ' +
      'update the emergency status to RESOLVED and apply the chosen adjustment ' +
      '(tap emergency fund, extend goal deadline, or reduce savings rate). ' +
      'Returns the new goal probability and estimated recovery time.',
  })
  @ApiResponse({
    status: 200,
    description: 'Adjustment applied successfully',
    type: AdjustmentResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid adjustment type or emergency status',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Emergency not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Emergency already resolved',
  })
  @ApiResponse({
    status: 422,
    description: 'Insufficient emergency fund for selected adjustment',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async applyAdjustment(
    @CurrentUser('id') userId: string,
    @Body() dto: SelectAdjustmentDto,
  ): Promise<AdjustmentResultDto> {
    const result = await this.ubuntuService.handleEmergency(
      userId,
      dto.emergencyId,
      dto.adjustmentType,
    );

    return {
      emergencyId: result.emergencyId,
      status: result.status,
      adjustmentType: result.adjustmentType,
      recoveryWeeks: result.recoveryWeeks,
      originalGoalProbability: result.originalGoalProbability,
      newGoalProbability: result.newGoalProbability,
      message: result.message,
      details: result.details,
    };
  }

  // ==========================================
  // FAMILY SUPPORT CRUD ENDPOINTS
  // ==========================================

  /**
   * List family support records with pagination
   */
  @Get('family-support')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'List Family Support',
    description:
      'Returns a paginated list of family support records with a summary ' +
      'of total monthly obligations grouped by relationship type.',
  })
  @ApiResponse({
    status: 200,
    description: 'Family support list retrieved successfully',
    type: FamilySupportListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async listFamilySupport(
    @CurrentUser('id') userId: string,
    @Query() query: FamilySupportListQueryDto,
  ): Promise<FamilySupportListResponseDto> {
    return this.ubuntuService.listFamilySupport(userId, query);
  }

  /**
   * Update an existing family support record
   */
  @Patch('family-support/:id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Update Family Support',
    description:
      'Updates an existing family support record. Only provided fields ' +
      'will be updated. Use isActive: false to soft-delete.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID of the family support record to update',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Family support updated successfully',
    type: FamilySupportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Family support record not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async updateFamilySupport(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) supportId: string,
    @Body() dto: UpdateFamilySupportDto,
  ): Promise<FamilySupportResponseDto> {
    const result = await this.ubuntuService.updateFamilySupport(userId, supportId, dto);

    return {
      id: result.id,
      name: result.name,
      relationship: result.relationship,
      amount: Number(result.amount),
      currency: result.currency,
      frequency: result.frequency,
      description: result.description,
      isActive: result.isActive,
      createdAt: result.createdAt,
      reframedLabel: result.reframedLabel,
    };
  }

  /**
   * Soft delete a family support record
   */
  @Delete('family-support/:id')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Delete Family Support',
    description:
      'Soft deletes (deactivates) a family support record. The record ' +
      'remains in the database but is excluded from calculations.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID of the family support record to delete',
    type: String,
  })
  @ApiResponse({
    status: 204,
    description: 'Family support deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Family support record not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async deleteFamilySupport(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) supportId: string,
  ): Promise<void> {
    await this.ubuntuService.deleteFamilySupport(userId, supportId);
  }

  // ==========================================
  // EMERGENCY LIST ENDPOINT
  // ==========================================

  /**
   * List family emergencies with pagination
   */
  @Get('emergency')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'List Emergencies',
    description:
      'Returns a paginated list of family emergencies. Can be filtered ' +
      'by status (PENDING, ADJUSTING, RESOLVED, CANCELLED).',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'ADJUSTING', 'RESOLVED', 'CANCELLED'],
    description: 'Filter by emergency status',
  })
  @ApiResponse({
    status: 200,
    description: 'Emergency list retrieved successfully',
    type: EmergencyListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async listEmergencies(
    @CurrentUser('id') userId: string,
    @Query() query: EmergencyListQueryDto,
  ): Promise<EmergencyListResponseDto> {
    return this.ubuntuService.listEmergencies(userId, query);
  }

  // ==========================================
  // RATIO HISTORY ENDPOINT
  // ==========================================

  /**
   * Get dependency ratio history for trend analysis
   */
  @Get('dependency-ratio/history')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get Dependency Ratio History',
    description:
      'Returns historical dependency ratio data for trend analysis. ' +
      'Includes daily snapshots, average ratio, and trend direction ' +
      '(improving, stable, or increasing).',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days of history to retrieve (7-365, default: 30)',
  })
  @ApiResponse({
    status: 200,
    description: 'Ratio history retrieved successfully',
    type: RatioHistoryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async getRatioHistory(
    @CurrentUser('id') userId: string,
    @Query() query: RatioHistoryQueryDto,
  ): Promise<RatioHistoryResponseDto> {
    return this.ubuntuService.getRatioHistory(userId, query);
  }
}
