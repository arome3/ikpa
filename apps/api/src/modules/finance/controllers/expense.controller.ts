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
import { CurrentUser, SkipEmailVerification } from '../../../common/decorators';
import { ExpenseService } from '../services';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseResponseDto,
  ExpenseListResponseDto,
} from '../dto';

/**
 * Expense Controller
 *
 * CRUD endpoints for managing expenses.
 * Integrates with GPS Re-Router for budget tracking and overspending alerts.
 *
 * Key Features:
 * - Manual expense entry with category assignment
 * - Category freeze check (GPS feature)
 * - Emits events for GPS budget tracking pipeline
 * - Filters by date range, category, amount
 */
@ApiTags('Finance - Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipEmailVerification()
@Controller('finance/expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  /**
   * Create a new expense
   */
  @Post()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create Expense',
    description:
      'Records a new expense. Emits an event for GPS Re-Router to track ' +
      'budget spending. Returns 403 if the category is currently frozen.',
  })
  @ApiResponse({
    status: 201,
    description: 'Expense created successfully',
    type: ExpenseResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Category is frozen' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateExpenseDto,
  ): Promise<ExpenseResponseDto> {
    return this.expenseService.create(userId, dto);
  }

  /**
   * List all expenses with filters
   */
  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'List Expenses',
    description:
      'Returns expenses for the authenticated user with optional filters. ' +
      'Defaults to current month if no date range specified. ' +
      'Includes spending breakdown by category.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter start date (ISO 8601)',
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter end date (ISO 8601)',
    example: '2025-01-31',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'minAmount',
    required: false,
    type: Number,
    description: 'Minimum expense amount',
  })
  @ApiQuery({
    name: 'maxAmount',
    required: false,
    type: Number,
    description: 'Maximum expense amount',
  })
  @ApiResponse({
    status: 200,
    description: 'Expenses retrieved successfully',
    type: ExpenseListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('categoryId') categoryId?: string,
    @Query('minAmount') minAmount?: string,
    @Query('maxAmount') maxAmount?: string,
  ): Promise<ExpenseListResponseDto> {
    return this.expenseService.findAll(userId, {
      startDate,
      endDate,
      categoryId,
      minAmount: minAmount ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
    });
  }

  /**
   * Get a single expense
   */
  @Get(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get Expense',
    description: 'Returns a single expense by ID.',
  })
  @ApiParam({ name: 'id', description: 'Expense ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Expense retrieved successfully',
    type: ExpenseResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) expenseId: string,
  ): Promise<ExpenseResponseDto> {
    return this.expenseService.findOne(userId, expenseId);
  }

  /**
   * Update an expense
   */
  @Patch(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Update Expense',
    description:
      'Updates an existing expense. Emits an event for GPS Re-Router ' +
      'to recalculate budget spending. Returns 403 if changing to a frozen category.',
  })
  @ApiParam({ name: 'id', description: 'Expense ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Expense updated successfully',
    type: ExpenseResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Target category is frozen' })
  @ApiResponse({ status: 404, description: 'Expense or category not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) expenseId: string,
    @Body() dto: UpdateExpenseDto,
  ): Promise<ExpenseResponseDto> {
    return this.expenseService.update(userId, expenseId, dto);
  }

  /**
   * Delete an expense
   */
  @Delete(':id')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Delete Expense',
    description:
      'Permanently deletes an expense. Emits an event for GPS Re-Router ' +
      'to recalculate budget spending.',
  })
  @ApiParam({ name: 'id', description: 'Expense ID', type: String })
  @ApiResponse({ status: 204, description: 'Expense deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) expenseId: string,
  ): Promise<void> {
    await this.expenseService.remove(userId, expenseId);
  }
}
