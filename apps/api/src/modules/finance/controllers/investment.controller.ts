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
import { InvestmentService } from '../services';
import { CreateInvestmentDto, UpdateInvestmentDto, InvestmentResponseDto, InvestmentListResponseDto } from '../dto';

/**
 * Investment Controller
 *
 * CRUD endpoints for managing investments.
 * Tracks stocks, bonds, mutual funds, real estate, crypto, and pension.
 */
@ApiTags('Finance - Investments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipEmailVerification()
@Controller('finance/investments')
export class InvestmentController {
  constructor(private readonly investmentService: InvestmentService) {}

  /**
   * Create a new investment
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create Investment',
    description:
      'Creates a new investment record. Track stocks, bonds, mutual funds, ' +
      'real estate, cryptocurrency, and pension contributions. Include costBasis ' +
      'to track unrealized gains/losses.',
  })
  @ApiResponse({
    status: 201,
    description: 'Investment created successfully',
    type: InvestmentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInvestmentDto,
  ): Promise<InvestmentResponseDto> {
    return this.investmentService.create(userId, dto);
  }

  /**
   * List all investments
   */
  @Get()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'List Investments',
    description:
      'Returns all investments for the authenticated user. ' +
      'Includes total value and total unrealized gain/loss.',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted investments',
  })
  @ApiResponse({
    status: 200,
    description: 'Investments retrieved successfully',
    type: InvestmentListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<InvestmentListResponseDto> {
    return this.investmentService.findAll(userId, includeInactive === 'true');
  }

  /**
   * Get a single investment
   */
  @Get(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get Investment',
    description: 'Returns a single investment by ID.',
  })
  @ApiParam({ name: 'id', description: 'Investment ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Investment retrieved successfully',
    type: InvestmentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Investment not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) investmentId: string,
  ): Promise<InvestmentResponseDto> {
    return this.investmentService.findOne(userId, investmentId);
  }

  /**
   * Update an investment
   */
  @Patch(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Update Investment',
    description:
      'Updates an existing investment. Only provided fields will be updated. ' +
      'Use this to update current market value. Use isActive: false to soft-delete.',
  })
  @ApiParam({ name: 'id', description: 'Investment ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Investment updated successfully',
    type: InvestmentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Investment not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) investmentId: string,
    @Body() dto: UpdateInvestmentDto,
  ): Promise<InvestmentResponseDto> {
    return this.investmentService.update(userId, investmentId, dto);
  }

  /**
   * Delete an investment
   */
  @Delete(':id')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Delete Investment',
    description:
      'Soft deletes (deactivates) an investment. ' +
      'The record remains in the database but is excluded from calculations.',
  })
  @ApiParam({ name: 'id', description: 'Investment ID', type: String })
  @ApiResponse({ status: 204, description: 'Investment deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Investment not found' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) investmentId: string,
  ): Promise<void> {
    await this.investmentService.remove(userId, investmentId);
  }
}
