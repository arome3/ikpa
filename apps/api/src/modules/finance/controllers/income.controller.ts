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
import { IncomeService } from '../services';
import { CreateIncomeDto, UpdateIncomeDto, IncomeResponseDto, IncomeListResponseDto } from '../dto';

/**
 * Income Controller
 *
 * CRUD endpoints for managing income sources.
 * Part of the onboarding flow - users must add at least one income source.
 */
@ApiTags('Finance - Income')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipEmailVerification()
@Controller('finance/income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  /**
   * Create a new income source
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create Income Source',
    description:
      'Creates a new income source. During onboarding, users must add at least ' +
      'one income source to proceed. Supports various income types: salary, ' +
      'freelance, business, investment, rental, allowance, gift.',
  })
  @ApiResponse({
    status: 201,
    description: 'Income source created successfully',
    type: IncomeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateIncomeDto,
  ): Promise<IncomeResponseDto> {
    return this.incomeService.create(userId, dto);
  }

  /**
   * List all income sources
   */
  @Get()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'List Income Sources',
    description:
      'Returns all income sources for the authenticated user. ' +
      'Includes total monthly income normalized from all frequencies.',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted income sources',
  })
  @ApiResponse({
    status: 200,
    description: 'Income sources retrieved successfully',
    type: IncomeListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<IncomeListResponseDto> {
    return this.incomeService.findAll(userId, includeInactive === 'true');
  }

  /**
   * Get a single income source
   */
  @Get(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get Income Source',
    description: 'Returns a single income source by ID.',
  })
  @ApiParam({ name: 'id', description: 'Income source ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Income source retrieved successfully',
    type: IncomeResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Income source not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) incomeId: string,
  ): Promise<IncomeResponseDto> {
    return this.incomeService.findOne(userId, incomeId);
  }

  /**
   * Update an income source
   */
  @Patch(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Update Income Source',
    description:
      'Updates an existing income source. Only provided fields will be updated. ' +
      'Use isActive: false to soft-delete.',
  })
  @ApiParam({ name: 'id', description: 'Income source ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Income source updated successfully',
    type: IncomeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Income source not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) incomeId: string,
    @Body() dto: UpdateIncomeDto,
  ): Promise<IncomeResponseDto> {
    return this.incomeService.update(userId, incomeId, dto);
  }

  /**
   * Delete an income source
   */
  @Delete(':id')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Delete Income Source',
    description:
      'Soft deletes (deactivates) an income source. ' +
      'The record remains in the database but is excluded from calculations.',
  })
  @ApiParam({ name: 'id', description: 'Income source ID', type: String })
  @ApiResponse({ status: 204, description: 'Income source deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Income source not found' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) incomeId: string,
  ): Promise<void> {
    await this.incomeService.remove(userId, incomeId);
  }
}
