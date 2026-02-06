import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Currency } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseResponseDto,
  ExpenseListResponseDto,
  CategorySpendingDto,
} from '../dto';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * GPS Event names for budget tracking
 */
const GPS_EVENTS = {
  EXPENSE_CREATED: 'expense.created',
  EXPENSE_UPDATED: 'expense.updated',
  EXPENSE_DELETED: 'expense.deleted',
};

/**
 * Expense Service
 *
 * Manages CRUD operations for expenses.
 * Emits events for GPS Re-Router budget tracking.
 */
@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new expense
   */
  async create(userId: string, dto: CreateExpenseDto): Promise<ExpenseResponseDto> {
    // Verify category exists
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException({
        code: ErrorCodes.EXPENSE_CATEGORY_NOT_FOUND,
        message: 'Expense category not found',
      });
    }

    // Check if category is frozen (GPS feature)
    const freeze = await this.prisma.categoryFreeze.findFirst({
      where: {
        userId,
        categoryId: dto.categoryId,
        isActive: true,
        endDate: { gte: new Date() },
      },
    });

    if (freeze) {
      throw new ForbiddenException({
        code: ErrorCodes.CATEGORY_FROZEN,
        message: `Spending in ${category.name} is paused until ${freeze.endDate.toLocaleDateString()}`,
      });
    }

    // Get user's default currency if not provided
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    const expense = await this.prisma.expense.create({
      data: {
        userId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        currency: (dto.currency as Currency) ?? user?.currency ?? Currency.NGN,
        date: dto.date ? new Date(dto.date) : new Date(),
        description: dto.description,
        merchant: dto.merchant,
        isRecurring: dto.isRecurring ?? false,
        frequency: dto.frequency,
      },
      include: {
        category: true,
      },
    });

    this.logger.log(`Created expense ${expense.id} for user ${userId} in category ${category.name}`);

    // Invalidate cached snapshot so dashboard recalculates
    await this.invalidateTodaySnapshot(userId);

    // Emit event for GPS budget tracking
    this.eventEmitter.emit(GPS_EVENTS.EXPENSE_CREATED, {
      userId,
      expenseId: expense.id,
      categoryId: dto.categoryId,
      categoryName: category.name,
      amount: dto.amount,
      currency: expense.currency,
    });

    return this.toResponseDto(expense);
  }

  /**
   * List all expenses for a user with optional filters
   */
  async findAll(
    userId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      categoryId?: string;
      minAmount?: number;
      maxAmount?: number;
    },
  ): Promise<ExpenseListResponseDto> {
    const where: any = { userId };

    // Apply date filters (no default — returns all expenses when unfiltered)
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.date.lte = new Date(filters.endDate);
      }
    }

    // Apply category filter
    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    // Apply amount filters
    if (filters?.minAmount !== undefined || filters?.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) {
        where.amount.gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        where.amount.lte = filters.maxAmount;
      }
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const items = expenses.map((expense) => this.toResponseDto(expense));

    // Calculate total amount
    const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    // Calculate by category
    const categoryMap = new Map<string, { name: string; total: number; count: number }>();
    for (const expense of expenses) {
      const catId = expense.categoryId;
      const existing = categoryMap.get(catId);
      if (existing) {
        existing.total += Number(expense.amount);
        existing.count += 1;
      } else {
        categoryMap.set(catId, {
          name: expense.category?.name ?? 'Unknown',
          total: Number(expense.amount),
          count: 1,
        });
      }
    }

    const byCategory: CategorySpendingDto[] = Array.from(categoryMap.entries()).map(
      ([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        total: Math.round(data.total * 100) / 100,
        count: data.count,
      }),
    );

    // Sort by total descending
    byCategory.sort((a, b) => b.total - a.total);

    return {
      items,
      count: items.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      byCategory,
    };
  }

  /**
   * Get a single expense by ID
   */
  async findOne(userId: string, expenseId: string): Promise<ExpenseResponseDto> {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, userId },
      include: { category: true },
    });

    if (!expense) {
      throw new NotFoundException({
        code: ErrorCodes.EXPENSE_NOT_FOUND,
        message: 'Expense not found',
      });
    }

    return this.toResponseDto(expense);
  }

  /**
   * Update an expense
   */
  async update(userId: string, expenseId: string, dto: UpdateExpenseDto): Promise<ExpenseResponseDto> {
    // Verify ownership
    const existing = await this.prisma.expense.findFirst({
      where: { id: expenseId, userId },
      include: { category: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.EXPENSE_NOT_FOUND,
        message: 'Expense not found',
      });
    }

    // If changing category, verify new category exists and is not frozen
    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      const category = await this.prisma.expenseCategory.findUnique({
        where: { id: dto.categoryId },
      });

      if (!category) {
        throw new NotFoundException({
          code: ErrorCodes.EXPENSE_CATEGORY_NOT_FOUND,
          message: 'Expense category not found',
        });
      }

      // Check if new category is frozen
      const freeze = await this.prisma.categoryFreeze.findFirst({
        where: {
          userId,
          categoryId: dto.categoryId,
          isActive: true,
          endDate: { gte: new Date() },
        },
      });

      if (freeze) {
        throw new ForbiddenException({
          code: ErrorCodes.CATEGORY_FROZEN,
          message: `Spending in ${category.name} is paused until ${freeze.endDate.toLocaleDateString()}`,
        });
      }
    }

    // Perform the update
    await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency !== undefined && { currency: dto.currency as Currency }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.merchant !== undefined && { merchant: dto.merchant }),
        ...(dto.isRecurring !== undefined && { isRecurring: dto.isRecurring }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
      },
    });

    // Fetch the updated expense with category
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { category: true },
    });

    if (!expense) {
      throw new NotFoundException({
        code: ErrorCodes.EXPENSE_NOT_FOUND,
        message: 'Expense not found after update',
      });
    }

    this.logger.log(`Updated expense ${expenseId} for user ${userId}`);

    // Invalidate cached snapshot so dashboard recalculates
    await this.invalidateTodaySnapshot(userId);

    // Emit event for GPS budget tracking
    this.eventEmitter.emit(GPS_EVENTS.EXPENSE_UPDATED, {
      userId,
      expenseId: expense.id,
      categoryId: expense.categoryId,
      categoryName: expense.category?.name ?? 'Unknown',
      amount: Number(expense.amount),
      previousAmount: Number(existing.amount),
      previousCategoryId: existing.categoryId,
    });

    return this.toResponseDto(expense);
  }

  /**
   * Delete an expense
   */
  async remove(userId: string, expenseId: string): Promise<void> {
    // Verify ownership
    const existing = await this.prisma.expense.findFirst({
      where: { id: expenseId, userId },
      include: { category: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.EXPENSE_NOT_FOUND,
        message: 'Expense not found',
      });
    }

    await this.prisma.expense.delete({
      where: { id: expenseId },
    });

    this.logger.log(`Deleted expense ${expenseId} for user ${userId}`);

    // Invalidate cached snapshot so dashboard recalculates
    await this.invalidateTodaySnapshot(userId);

    // Emit event for GPS budget tracking
    this.eventEmitter.emit(GPS_EVENTS.EXPENSE_DELETED, {
      userId,
      expenseId,
      categoryId: existing.categoryId,
      categoryName: existing.category?.name,
      amount: Number(existing.amount),
    });
  }

  /**
   * Invalidate today's cached financial snapshot so the next
   * score/snapshot request recalculates with fresh expense data.
   */
  private async invalidateTodaySnapshot(userId: string): Promise<void> {
    try {
      await this.prisma.financialSnapshot.deleteMany({
        where: {
          userId,
          date: {
            gte: startOfDay(new Date()),
            lte: endOfDay(new Date()),
          },
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to invalidate snapshot for user ${userId}: ${error}`);
    }
  }

  /**
   * Convert database model to response DTO
   */
  private toResponseDto(expense: any): ExpenseResponseDto {
    return {
      id: expense.id,
      categoryId: expense.categoryId,
      category: expense.category
        ? {
            id: expense.category.id,
            name: expense.category.name,
            icon: expense.category.icon,
            color: expense.category.color,
          }
        : undefined,
      amount: Number(expense.amount),
      currency: expense.currency,
      date: expense.date,
      description: expense.description,
      merchant: expense.merchant,
      isRecurring: expense.isRecurring,
      frequency: expense.frequency,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    };
  }
}
