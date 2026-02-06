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
import { SavingsService } from '../services';
import { CreateSavingsDto, UpdateSavingsDto, SavingsResponseDto, SavingsListResponseDto } from '../dto';

/**
 * Savings Controller
 *
 * CRUD endpoints for managing savings accounts.
 * Supports African savings mechanisms: mobile money, ajo/susu, cooperatives.
 */
@ApiTags('Finance - Savings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipEmailVerification()
@Controller('finance/savings')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  /**
   * Create a new savings account
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create Savings Account',
    description:
      'Creates a new savings account. Supports various types: bank accounts, ' +
      'mobile money (M-Pesa, OPay), fixed deposits, ajo/susu (traditional ' +
      'African rotating savings), and cooperatives. Mark isEmergencyFund=true ' +
      'for accounts that count toward your emergency runway.',
  })
  @ApiResponse({
    status: 201,
    description: 'Savings account created successfully',
    type: SavingsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSavingsDto,
  ): Promise<SavingsResponseDto> {
    return this.savingsService.create(userId, dto);
  }

  /**
   * List all savings accounts
   */
  @Get()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'List Savings Accounts',
    description:
      'Returns all savings accounts for the authenticated user. ' +
      'Includes total balance and emergency fund total.',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted accounts',
  })
  @ApiResponse({
    status: 200,
    description: 'Savings accounts retrieved successfully',
    type: SavingsListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<SavingsListResponseDto> {
    return this.savingsService.findAll(userId, includeInactive === 'true');
  }

  /**
   * Get a single savings account
   */
  @Get(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get Savings Account',
    description: 'Returns a single savings account by ID.',
  })
  @ApiParam({ name: 'id', description: 'Savings account ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Savings account retrieved successfully',
    type: SavingsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Savings account not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) savingsId: string,
  ): Promise<SavingsResponseDto> {
    return this.savingsService.findOne(userId, savingsId);
  }

  /**
   * Update a savings account
   */
  @Patch(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Update Savings Account',
    description:
      'Updates an existing savings account. Only provided fields will be updated. ' +
      'Use isActive: false to soft-delete.',
  })
  @ApiParam({ name: 'id', description: 'Savings account ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Savings account updated successfully',
    type: SavingsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Savings account not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) savingsId: string,
    @Body() dto: UpdateSavingsDto,
  ): Promise<SavingsResponseDto> {
    return this.savingsService.update(userId, savingsId, dto);
  }

  /**
   * Delete a savings account
   */
  @Delete(':id')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Delete Savings Account',
    description:
      'Soft deletes (deactivates) a savings account. ' +
      'The record remains in the database but is excluded from calculations.',
  })
  @ApiParam({ name: 'id', description: 'Savings account ID', type: String })
  @ApiResponse({ status: 204, description: 'Savings account deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Savings account not found' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) savingsId: string,
  ): Promise<void> {
    await this.savingsService.remove(userId, savingsId);
  }
}
