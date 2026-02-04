import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateInvestmentDto, UpdateInvestmentDto, InvestmentResponseDto, InvestmentListResponseDto } from '../dto';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * Investment Service
 *
 * Manages CRUD operations for investments.
 * Tracks stocks, bonds, real estate, crypto, and pension contributions.
 */
@Injectable()
export class InvestmentService {
  private readonly logger = new Logger(InvestmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new investment
   */
  async create(userId: string, dto: CreateInvestmentDto): Promise<InvestmentResponseDto> {
    // Get user's default currency if not provided
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    const investment = await this.prisma.investment.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        value: dto.value,
        currency: dto.currency ?? user?.currency ?? 'NGN',
        costBasis: dto.costBasis ?? null,
        institution: dto.institution ?? null,
        notes: dto.notes ?? null,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
      },
    });

    this.logger.log(`Created investment ${investment.id} for user ${userId}`);
    return this.toResponseDto(investment);
  }

  /**
   * List all investments for a user
   */
  async findAll(userId: string, includeInactive = false): Promise<InvestmentListResponseDto> {
    const where = {
      userId,
      ...(includeInactive ? {} : { isActive: true }),
    };

    const investments = await this.prisma.investment.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { value: 'desc' }],
    });

    const items = investments.map((investment) => this.toResponseDto(investment));

    // Calculate totals
    const activeInvestments = investments.filter((i) => i.isActive);
    const totalValue = activeInvestments.reduce((sum, i) => sum + Number(i.value), 0);
    const totalUnrealizedGain = activeInvestments.reduce((sum, i) => {
      if (i.costBasis) {
        return sum + (Number(i.value) - Number(i.costBasis));
      }
      return sum;
    }, 0);

    return {
      items,
      count: items.length,
      totalValue: Math.round(totalValue * 100) / 100,
      totalUnrealizedGain: Math.round(totalUnrealizedGain * 100) / 100,
    };
  }

  /**
   * Get a single investment by ID
   */
  async findOne(userId: string, investmentId: string): Promise<InvestmentResponseDto> {
    const investment = await this.prisma.investment.findFirst({
      where: { id: investmentId, userId },
    });

    if (!investment) {
      throw new NotFoundException({
        code: ErrorCodes.INVESTMENT_NOT_FOUND,
        message: 'Investment not found',
      });
    }

    return this.toResponseDto(investment);
  }

  /**
   * Update an investment
   */
  async update(userId: string, investmentId: string, dto: UpdateInvestmentDto): Promise<InvestmentResponseDto> {
    // Verify ownership
    const existing = await this.prisma.investment.findFirst({
      where: { id: investmentId, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.INVESTMENT_NOT_FOUND,
        message: 'Investment not found',
      });
    }

    const investment = await this.prisma.investment.update({
      where: { id: investmentId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.costBasis !== undefined && { costBasis: dto.costBasis }),
        ...(dto.institution !== undefined && { institution: dto.institution }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.purchaseDate !== undefined && {
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`Updated investment ${investmentId} for user ${userId}`);
    return this.toResponseDto(investment);
  }

  /**
   * Soft delete an investment
   */
  async remove(userId: string, investmentId: string): Promise<void> {
    // Verify ownership
    const existing = await this.prisma.investment.findFirst({
      where: { id: investmentId, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.INVESTMENT_NOT_FOUND,
        message: 'Investment not found',
      });
    }

    await this.prisma.investment.update({
      where: { id: investmentId },
      data: { isActive: false },
    });

    this.logger.log(`Soft deleted investment ${investmentId} for user ${userId}`);
  }

  /**
   * Convert database model to response DTO
   */
  private toResponseDto(investment: any): InvestmentResponseDto {
    const unrealizedGain = investment.costBasis
      ? Number(investment.value) - Number(investment.costBasis)
      : undefined;

    return {
      id: investment.id,
      name: investment.name,
      type: investment.type,
      value: Number(investment.value),
      currency: investment.currency,
      costBasis: investment.costBasis ? Number(investment.costBasis) : null,
      institution: investment.institution,
      notes: investment.notes,
      purchaseDate: investment.purchaseDate,
      isActive: investment.isActive,
      createdAt: investment.createdAt,
      updatedAt: investment.updatedAt,
      unrealizedGain,
    };
  }
}
