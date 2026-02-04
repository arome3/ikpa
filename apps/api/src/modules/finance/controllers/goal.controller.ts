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
import { JwtAuthGuard } from '../../../common/guards';
import { CurrentUser } from '../../../common/decorators';
import { GoalCrudService } from '../services';
import {
  CreateGoalDto,
  UpdateGoalDto,
  GoalResponseDto,
  GoalListResponseDto,
  ContributeGoalDto,
  ContributionResponseDto,
} from '../dto';
import { GoalStatus } from '@prisma/client';

/**
 * Goal Controller
 *
 * CRUD endpoints for managing financial goals.
 * Part of the onboarding flow - users must create at least one goal.
 * Includes contribution tracking for goal progress.
 */
@ApiTags('Finance - Goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance/goals')
export class GoalController {
  constructor(private readonly goalService: GoalCrudService) {}

  /**
   * Create a new financial goal
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create Goal',
    description:
      'Creates a new financial goal. During onboarding, users must create at least ' +
      'one goal. Categories: emergency fund, savings, investment, debt payoff, ' +
      'major purchase, education, travel, family, business, retirement.',
  })
  @ApiResponse({
    status: 201,
    description: 'Goal created successfully',
    type: GoalResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateGoalDto,
  ): Promise<GoalResponseDto> {
    return this.goalService.create(userId, dto);
  }

  /**
   * List all goals
   */
  @Get()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'List Goals',
    description:
      'Returns all goals for the authenticated user. ' +
      'Includes overall progress across all active goals.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: GoalStatus,
    description: 'Filter by goal status',
  })
  @ApiResponse({
    status: 200,
    description: 'Goals retrieved successfully',
    type: GoalListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('status') status?: GoalStatus,
  ): Promise<GoalListResponseDto> {
    return this.goalService.findAll(userId, status);
  }

  /**
   * Get a single goal
   */
  @Get(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get Goal',
    description: 'Returns a single goal by ID with progress calculation.',
  })
  @ApiParam({ name: 'id', description: 'Goal ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Goal retrieved successfully',
    type: GoalResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) goalId: string,
  ): Promise<GoalResponseDto> {
    return this.goalService.findOne(userId, goalId);
  }

  /**
   * Update a goal
   */
  @Patch(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Update Goal',
    description:
      'Updates an existing goal. Only provided fields will be updated. ' +
      'Use status to change goal state (ACTIVE, PAUSED, COMPLETED, CANCELLED).',
  })
  @ApiParam({ name: 'id', description: 'Goal ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Goal updated successfully',
    type: GoalResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) goalId: string,
    @Body() dto: UpdateGoalDto,
  ): Promise<GoalResponseDto> {
    return this.goalService.update(userId, goalId, dto);
  }

  /**
   * Delete (cancel) a goal
   */
  @Delete(':id')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Cancel Goal',
    description:
      'Cancels a goal (sets status to CANCELLED). ' +
      'The goal remains in the database for historical tracking.',
  })
  @ApiParam({ name: 'id', description: 'Goal ID', type: String })
  @ApiResponse({ status: 204, description: 'Goal cancelled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) goalId: string,
  ): Promise<void> {
    await this.goalService.remove(userId, goalId);
  }

  /**
   * Add a contribution to a goal
   */
  @Post(':id/contribute')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Add Contribution',
    description:
      'Adds a contribution to a goal, increasing the current amount. ' +
      'If the contribution causes currentAmount to reach or exceed targetAmount, ' +
      'the goal is automatically marked as COMPLETED.',
  })
  @ApiParam({ name: 'id', description: 'Goal ID', type: String })
  @ApiResponse({
    status: 201,
    description: 'Contribution added successfully',
    type: ContributionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async contribute(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) goalId: string,
    @Body() dto: ContributeGoalDto,
  ): Promise<ContributionResponseDto> {
    return this.goalService.contribute(userId, goalId, dto);
  }
}
