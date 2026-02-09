import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateSavingsDto,
  UpdateSavingsDto,
  SavingsResponseDto,
  SavingsListResponseDto,
} from '../dto';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * Savings Service
 *
 * Manages CRUD operations for savings accounts.
 * Supports savings mechanisms including mobile money and ajo/susu.
 */
@Injectable()
export class SavingsService {
  private readonly logger = new Logger(SavingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new savings account
   */
  async create(userId: string, dto: CreateSavingsDto): Promise<SavingsResponseDto> {
    // Get user's default currency if not provided
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    const savings = await this.prisma.savingsAccount.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        balance: dto.balance,
        currency: dto.currency ?? user?.currency ?? 'NGN',
        interestRate: dto.interestRate ?? null,
        institution: dto.institution ?? null,
        accountNumber: dto.accountNumber ?? null,
        isEmergencyFund: dto.isEmergencyFund ?? false,
      },
    });

    this.logger.log(`Created savings account ${savings.id} for user ${userId}`);
    return this.toResponseDto(savings);
  }

  /**
   * List all savings accounts for a user
   */
  async findAll(userId: string, includeInactive = false): Promise<SavingsListResponseDto> {
    const where = {
      userId,
      ...(includeInactive ? {} : { isActive: true }),
    };

    const accounts = await this.prisma.savingsAccount.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { balance: 'desc' }],
    });

    const items = accounts.map((account) => this.toResponseDto(account));

    // Calculate totals
    const activeAccounts = accounts.filter((a) => a.isActive);
    const totalBalance = activeAccounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const emergencyFundTotal = activeAccounts
      .filter((a) => a.isEmergencyFund)
      .reduce((sum, a) => sum + Number(a.balance), 0);

    return {
      items,
      count: items.length,
      totalBalance: Math.round(totalBalance * 100) / 100,
      emergencyFundTotal: Math.round(emergencyFundTotal * 100) / 100,
    };
  }

  /**
   * Get a single savings account by ID
   */
  async findOne(userId: string, savingsId: string): Promise<SavingsResponseDto> {
    const savings = await this.prisma.savingsAccount.findFirst({
      where: { id: savingsId, userId },
    });

    if (!savings) {
      throw new NotFoundException({
        code: ErrorCodes.SAVINGS_NOT_FOUND,
        message: 'Savings account not found',
      });
    }

    return this.toResponseDto(savings);
  }

  /**
   * Update a savings account
   */
  async update(
    userId: string,
    savingsId: string,
    dto: UpdateSavingsDto,
  ): Promise<SavingsResponseDto> {
    // Verify ownership
    const existing = await this.prisma.savingsAccount.findFirst({
      where: { id: savingsId, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.SAVINGS_NOT_FOUND,
        message: 'Savings account not found',
      });
    }

    const savings = await this.prisma.savingsAccount.update({
      where: { id: savingsId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.balance !== undefined && { balance: dto.balance }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.interestRate !== undefined && { interestRate: dto.interestRate }),
        ...(dto.institution !== undefined && { institution: dto.institution }),
        ...(dto.accountNumber !== undefined && { accountNumber: dto.accountNumber }),
        ...(dto.isEmergencyFund !== undefined && { isEmergencyFund: dto.isEmergencyFund }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`Updated savings account ${savingsId} for user ${userId}`);
    return this.toResponseDto(savings);
  }

  /**
   * Soft delete a savings account
   */
  async remove(userId: string, savingsId: string): Promise<void> {
    // Verify ownership
    const existing = await this.prisma.savingsAccount.findFirst({
      where: { id: savingsId, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.SAVINGS_NOT_FOUND,
        message: 'Savings account not found',
      });
    }

    await this.prisma.savingsAccount.update({
      where: { id: savingsId },
      data: { isActive: false },
    });

    this.logger.log(`Soft deleted savings account ${savingsId} for user ${userId}`);
  }

  /**
   * Convert database model to response DTO
   */
  private toResponseDto(savings: any): SavingsResponseDto {
    return {
      id: savings.id,
      name: savings.name,
      type: savings.type,
      balance: Number(savings.balance),
      currency: savings.currency,
      interestRate: savings.interestRate ? Number(savings.interestRate) : null,
      institution: savings.institution,
      accountNumber: savings.accountNumber,
      isEmergencyFund: savings.isEmergencyFund,
      isActive: savings.isActive,
      createdAt: savings.createdAt,
      updatedAt: savings.updatedAt,
    };
  }
}
