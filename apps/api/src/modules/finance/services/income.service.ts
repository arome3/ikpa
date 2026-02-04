import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateIncomeDto, UpdateIncomeDto, IncomeResponseDto, IncomeListResponseDto } from '../dto';
import { ErrorCodes } from '../../../common/constants/error-codes';
import { Frequency } from '@prisma/client';

/**
 * Income Service
 *
 * Manages CRUD operations for income sources.
 * Provides normalized monthly income calculations for financial metrics.
 */
@Injectable()
export class IncomeService {
  private readonly logger = new Logger(IncomeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new income source
   */
  async create(userId: string, dto: CreateIncomeDto): Promise<IncomeResponseDto> {
    // Get user's default currency if not provided
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    const income = await this.prisma.incomeSource.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        amount: dto.amount,
        currency: dto.currency ?? user?.currency ?? 'NGN',
        frequency: dto.frequency,
        variancePercentage: dto.variancePercentage ?? 0,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });

    this.logger.log(`Created income source ${income.id} for user ${userId}`);
    return this.toResponseDto(income);
  }

  /**
   * List all income sources for a user
   */
  async findAll(userId: string, includeInactive = false): Promise<IncomeListResponseDto> {
    const where = {
      userId,
      ...(includeInactive ? {} : { isActive: true }),
    };

    const incomes = await this.prisma.incomeSource.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    const items = incomes.map((income) => this.toResponseDto(income));

    // Calculate total monthly income (normalized from all frequencies)
    const totalMonthly = incomes
      .filter((i) => i.isActive)
      .reduce((sum, income) => sum + this.normalizeToMonthly(Number(income.amount), income.frequency), 0);

    return {
      items,
      count: items.length,
      totalMonthly: Math.round(totalMonthly * 100) / 100,
    };
  }

  /**
   * Get a single income source by ID
   */
  async findOne(userId: string, incomeId: string): Promise<IncomeResponseDto> {
    const income = await this.prisma.incomeSource.findFirst({
      where: { id: incomeId, userId },
    });

    if (!income) {
      throw new NotFoundException({
        code: ErrorCodes.INCOME_NOT_FOUND,
        message: 'Income source not found',
      });
    }

    return this.toResponseDto(income);
  }

  /**
   * Update an income source
   */
  async update(userId: string, incomeId: string, dto: UpdateIncomeDto): Promise<IncomeResponseDto> {
    // Verify ownership
    const existing = await this.prisma.incomeSource.findFirst({
      where: { id: incomeId, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.INCOME_NOT_FOUND,
        message: 'Income source not found',
      });
    }

    const income = await this.prisma.incomeSource.update({
      where: { id: incomeId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.variancePercentage !== undefined && { variancePercentage: dto.variancePercentage }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`Updated income source ${incomeId} for user ${userId}`);
    return this.toResponseDto(income);
  }

  /**
   * Soft delete an income source
   */
  async remove(userId: string, incomeId: string): Promise<void> {
    // Verify ownership
    const existing = await this.prisma.incomeSource.findFirst({
      where: { id: incomeId, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.INCOME_NOT_FOUND,
        message: 'Income source not found',
      });
    }

    await this.prisma.incomeSource.update({
      where: { id: incomeId },
      data: { isActive: false },
    });

    this.logger.log(`Soft deleted income source ${incomeId} for user ${userId}`);
  }

  /**
   * Normalize amount to monthly value based on frequency
   */
  private normalizeToMonthly(amount: number, frequency: Frequency): number {
    const multipliers: Record<Frequency, number> = {
      DAILY: 30,
      WEEKLY: 4.33,
      BIWEEKLY: 2.17,
      MONTHLY: 1,
      QUARTERLY: 1 / 3,
      ANNUALLY: 1 / 12,
      ONE_TIME: 0, // One-time income not counted in monthly
    };
    return amount * (multipliers[frequency] ?? 1);
  }

  /**
   * Convert database model to response DTO
   */
  private toResponseDto(income: any): IncomeResponseDto {
    return {
      id: income.id,
      name: income.name,
      type: income.type,
      amount: Number(income.amount),
      currency: income.currency,
      frequency: income.frequency,
      variancePercentage: income.variancePercentage,
      description: income.description,
      isActive: income.isActive,
      startDate: income.startDate,
      endDate: income.endDate,
      createdAt: income.createdAt,
      updatedAt: income.updatedAt,
    };
  }
}
