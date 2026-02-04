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
import { BudgetCrudService } from '../services';
import { CreateBudgetDto, UpdateBudgetDto, BudgetResponseDto, BudgetListResponseDto } from '../dto';

/**
 * Budget Controller
 *
 * CRUD endpoints for managing category budgets.
 * Budgets are used by GPS Re-Router to detect overspending
 * and trigger recovery paths.
 */
@ApiTags('Finance - Budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance/budgets')
export class BudgetController {
  constructor(private readonly budgetService: BudgetCrudService) {}

  /**
   * Create a new budget
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create Budget',
    description:
      'Creates a new category budget. Budgets define spending limits for expense ' +
      'categories. GPS Re-Router monitors budgets and triggers recovery paths ' +
      'when overspending is detected. Only one budget per category/period is allowed.',
  })
  @ApiResponse({
    status: 201,
    description: 'Budget created successfully',
    type: BudgetResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Expense category not found' })
  @ApiResponse({ status: 409, description: 'Budget for this category/period already exists' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBudgetDto,
  ): Promise<BudgetResponseDto> {
    return this.budgetService.create(userId, dto);
  }

  /**
   * List all budgets with spending
   */
  @Get()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'List Budgets',
    description:
      'Returns all budgets for the authenticated user with spending calculations. ' +
      'Each budget includes spent amount, remaining amount, and percentage used ' +
      'for the current period.',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted budgets',
  })
  @ApiResponse({
    status: 200,
    description: 'Budgets retrieved successfully',
    type: BudgetListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<BudgetListResponseDto> {
    return this.budgetService.findAll(userId, includeInactive === 'true');
  }

  /**
   * Get a single budget with spending
   */
  @Get(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get Budget',
    description:
      'Returns a single budget by ID with spending calculation for the current period.',
  })
  @ApiParam({ name: 'id', description: 'Budget ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Budget retrieved successfully',
    type: BudgetResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) budgetId: string,
  ): Promise<BudgetResponseDto> {
    return this.budgetService.findOne(userId, budgetId);
  }

  /**
   * Update a budget
   */
  @Patch(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Update Budget',
    description:
      'Updates an existing budget. Only provided fields will be updated. ' +
      'Note: categoryId cannot be changed; create a new budget instead. ' +
      'Use isActive: false to soft-delete.',
  })
  @ApiParam({ name: 'id', description: 'Budget ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Budget updated successfully',
    type: BudgetResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) budgetId: string,
    @Body() dto: UpdateBudgetDto,
  ): Promise<BudgetResponseDto> {
    return this.budgetService.update(userId, budgetId, dto);
  }

  /**
   * Delete a budget
   */
  @Delete(':id')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Delete Budget',
    description:
      'Soft deletes (deactivates) a budget. GPS Re-Router will no longer ' +
      'monitor this category for overspending.',
  })
  @ApiParam({ name: 'id', description: 'Budget ID', type: String })
  @ApiResponse({ status: 204, description: 'Budget deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) budgetId: string,
  ): Promise<void> {
    await this.budgetService.remove(userId, budgetId);
  }
}
