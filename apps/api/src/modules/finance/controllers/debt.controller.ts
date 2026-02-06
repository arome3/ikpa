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
import { DebtService } from '../services';
import { CreateDebtDto, UpdateDebtDto, DebtResponseDto, DebtListResponseDto } from '../dto';

/**
 * Debt Controller
 *
 * CRUD endpoints for managing debts.
 * Tracks loans, credit cards, BNPL, and other debt obligations.
 */
@ApiTags('Finance - Debts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipEmailVerification()
@Controller('finance/debts')
export class DebtController {
  constructor(private readonly debtService: DebtService) {}

  /**
   * Create a new debt
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create Debt',
    description:
      'Creates a new debt record. Track bank loans, credit cards, ' +
      'BNPL (Buy Now Pay Later), personal loans, mortgages, student loans, ' +
      'and business loans. The debt-to-income ratio affects your Cash Flow Score.',
  })
  @ApiResponse({
    status: 201,
    description: 'Debt created successfully',
    type: DebtResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDebtDto,
  ): Promise<DebtResponseDto> {
    return this.debtService.create(userId, dto);
  }

  /**
   * List all debts
   */
  @Get()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'List Debts',
    description:
      'Returns all debts for the authenticated user, sorted by interest rate ' +
      '(highest first for debt payoff prioritization). Includes total remaining ' +
      'balance and total minimum payments.',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include paid-off debts',
  })
  @ApiResponse({
    status: 200,
    description: 'Debts retrieved successfully',
    type: DebtListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<DebtListResponseDto> {
    return this.debtService.findAll(userId, includeInactive === 'true');
  }

  /**
   * Get a single debt
   */
  @Get(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get Debt',
    description: 'Returns a single debt by ID.',
  })
  @ApiParam({ name: 'id', description: 'Debt ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Debt retrieved successfully',
    type: DebtResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Debt not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) debtId: string,
  ): Promise<DebtResponseDto> {
    return this.debtService.findOne(userId, debtId);
  }

  /**
   * Update a debt
   */
  @Patch(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Update Debt',
    description:
      'Updates an existing debt. Only provided fields will be updated. ' +
      'Update remainingBalance as you make payments. Use isActive: false when paid off.',
  })
  @ApiParam({ name: 'id', description: 'Debt ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Debt updated successfully',
    type: DebtResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Debt not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) debtId: string,
    @Body() dto: UpdateDebtDto,
  ): Promise<DebtResponseDto> {
    return this.debtService.update(userId, debtId, dto);
  }

  /**
   * Delete a debt
   */
  @Delete(':id')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Delete Debt',
    description:
      'Soft deletes (deactivates) a debt. Use this when a debt is paid off. ' +
      'The record remains in the database for historical tracking.',
  })
  @ApiParam({ name: 'id', description: 'Debt ID', type: String })
  @ApiResponse({ status: 204, description: 'Debt deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Debt not found' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) debtId: string,
  ): Promise<void> {
    await this.debtService.remove(userId, debtId);
  }
}
