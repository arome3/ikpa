import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateDebtDto, UpdateDebtDto, DebtResponseDto, DebtListResponseDto } from '../dto';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * Debt Service
 *
 * Manages CRUD operations for debts.
 * Tracks loans, credit cards, BNPL, and other debt obligations.
 */
@Injectable()
export class DebtService {
  private readonly logger = new Logger(DebtService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new debt
   */
  async create(userId: string, dto: CreateDebtDto): Promise<DebtResponseDto> {
    // Get user's default currency if not provided
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    const debt = await this.prisma.debt.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        originalAmount: dto.originalAmount,
        remainingBalance: dto.remainingBalance,
        currency: dto.currency ?? user?.currency ?? 'NGN',
        interestRate: dto.interestRate,
        minimumPayment: dto.minimumPayment,
        dueDate: dto.dueDate ?? null,
        institution: dto.institution ?? null,
        notes: dto.notes ?? null,
        startDate: new Date(dto.startDate),
        targetPayoffDate: dto.targetPayoffDate ? new Date(dto.targetPayoffDate) : null,
      },
    });

    this.logger.log(`Created debt ${debt.id} for user ${userId}`);
    return this.toResponseDto(debt);
  }

  /**
   * List all debts for a user
   */
  async findAll(userId: string, includeInactive = false): Promise<DebtListResponseDto> {
    const where = {
      userId,
      ...(includeInactive ? {} : { isActive: true }),
    };

    const debts = await this.prisma.debt.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { interestRate: 'desc' }], // High interest first
    });

    const items = debts.map((debt) => this.toResponseDto(debt));

    // Calculate totals
    const activeDebts = debts.filter((d) => d.isActive);
    const totalRemainingBalance = activeDebts.reduce((sum, d) => sum + Number(d.remainingBalance), 0);
    const totalMinimumPayments = activeDebts.reduce((sum, d) => sum + Number(d.minimumPayment), 0);

    return {
      items,
      count: items.length,
      totalRemainingBalance: Math.round(totalRemainingBalance * 100) / 100,
      totalMinimumPayments: Math.round(totalMinimumPayments * 100) / 100,
    };
  }

  /**
   * Get a single debt by ID
   */
  async findOne(userId: string, debtId: string): Promise<DebtResponseDto> {
    const debt = await this.prisma.debt.findFirst({
      where: { id: debtId, userId },
    });

    if (!debt) {
      throw new NotFoundException({
        code: ErrorCodes.DEBT_NOT_FOUND,
        message: 'Debt not found',
      });
    }

    return this.toResponseDto(debt);
  }

  /**
   * Update a debt
   */
  async update(userId: string, debtId: string, dto: UpdateDebtDto): Promise<DebtResponseDto> {
    // Verify ownership
    const existing = await this.prisma.debt.findFirst({
      where: { id: debtId, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.DEBT_NOT_FOUND,
        message: 'Debt not found',
      });
    }

    const debt = await this.prisma.debt.update({
      where: { id: debtId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.originalAmount !== undefined && { originalAmount: dto.originalAmount }),
        ...(dto.remainingBalance !== undefined && { remainingBalance: dto.remainingBalance }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.interestRate !== undefined && { interestRate: dto.interestRate }),
        ...(dto.minimumPayment !== undefined && { minimumPayment: dto.minimumPayment }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate }),
        ...(dto.institution !== undefined && { institution: dto.institution }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.targetPayoffDate !== undefined && {
          targetPayoffDate: dto.targetPayoffDate ? new Date(dto.targetPayoffDate) : null
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`Updated debt ${debtId} for user ${userId}`);
    return this.toResponseDto(debt);
  }

  /**
   * Soft delete a debt
   */
  async remove(userId: string, debtId: string): Promise<void> {
    // Verify ownership
    const existing = await this.prisma.debt.findFirst({
      where: { id: debtId, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.DEBT_NOT_FOUND,
        message: 'Debt not found',
      });
    }

    await this.prisma.debt.update({
      where: { id: debtId },
      data: { isActive: false },
    });

    this.logger.log(`Soft deleted debt ${debtId} for user ${userId}`);
  }

  /**
   * Convert database model to response DTO
   */
  private toResponseDto(debt: any): DebtResponseDto {
    const originalAmount = Number(debt.originalAmount);
    const remainingBalance = Number(debt.remainingBalance);
    const percentPaidOff = originalAmount > 0
      ? Math.round(((originalAmount - remainingBalance) / originalAmount) * 100)
      : 0;

    return {
      id: debt.id,
      name: debt.name,
      type: debt.type,
      originalAmount,
      remainingBalance,
      currency: debt.currency,
      interestRate: Number(debt.interestRate),
      minimumPayment: Number(debt.minimumPayment),
      dueDate: debt.dueDate,
      institution: debt.institution,
      notes: debt.notes,
      isActive: debt.isActive,
      startDate: debt.startDate,
      targetPayoffDate: debt.targetPayoffDate,
      createdAt: debt.createdAt,
      updatedAt: debt.updatedAt,
      percentPaidOff,
    };
  }
}
