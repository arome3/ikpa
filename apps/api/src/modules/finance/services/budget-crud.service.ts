import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBudgetDto, UpdateBudgetDto, BudgetResponseDto, BudgetListResponseDto } from '../dto';
import { ErrorCodes } from '../../../common/constants/error-codes';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import { BudgetPeriod } from '@prisma/client';

/**
 * Budget CRUD Service
 *
 * Manages CRUD operations for budgets.
 * Named BudgetCrudService to avoid conflicts with GPS module's BudgetService.
 * Includes spending calculations for budget tracking.
 */
@Injectable()
export class BudgetCrudService {
  private readonly logger = new Logger(BudgetCrudService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new budget
   */
  async create(userId: string, dto: CreateBudgetDto): Promise<BudgetResponseDto> {
    // Check for duplicate budget (same user, category, period)
    const existing = await this.prisma.budget.findFirst({
      where: {
        userId,
        categoryId: dto.categoryId,
        period: dto.period,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictException({
        code: ErrorCodes.BUDGET_DUPLICATE,
        message: 'A budget for this category and period already exists',
      });
    }

    // Get user's default currency if not provided
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    // Verify category exists
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException({
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        message: 'Expense category not found',
      });
    }

    const budget = await this.prisma.budget.create({
      data: {
        userId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        currency: dto.currency ?? user?.currency ?? 'NGN',
        period: dto.period,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      },
      include: {
        category: true,
      },
    });

    this.logger.log(`Created budget ${budget.id} for user ${userId}`);
    return this.toResponseDto(budget);
  }

  /**
   * List all budgets for a user with spending calculations
   */
  async findAll(userId: string, includeInactive = false): Promise<BudgetListResponseDto> {
    const where = {
      userId,
      ...(includeInactive ? {} : { isActive: true }),
    };

    const budgets = await this.prisma.budget.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: [{ isActive: 'desc' }, { category: { name: 'asc' } }],
    });

    // Fetch all active rebalances for this user in the current period
    const periodStart = startOfMonth(new Date());
    const activeRebalances = await this.prisma.budgetRebalance.findMany({
      where: { userId, isActive: true, createdAt: { gte: periodStart } },
      select: { fromCategoryId: true, toCategoryId: true, amount: true },
    });

    // Build a map of net rebalance adjustments per category
    const rebalanceMap = new Map<string, number>();
    for (const rb of activeRebalances) {
      rebalanceMap.set(rb.toCategoryId, (rebalanceMap.get(rb.toCategoryId) ?? 0) + Number(rb.amount));
      rebalanceMap.set(rb.fromCategoryId, (rebalanceMap.get(rb.fromCategoryId) ?? 0) - Number(rb.amount));
    }

    // Calculate spending for each budget
    const items = await Promise.all(
      budgets.map(async (budget) => {
        const spent = await this.calculateSpentInPeriod(userId, budget.categoryId, budget.period);
        const rebalanceAdj = rebalanceMap.get(budget.categoryId) ?? 0;
        return this.toResponseDto(budget, spent, rebalanceAdj);
      }),
    );

    // Calculate totals
    const activeBudgets = items.filter((b) => b.isActive);
    const totalBudget = activeBudgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = activeBudgets.reduce((sum, b) => sum + (b.spent ?? 0), 0);
    const totalRemaining = activeBudgets.reduce((sum, b) => sum + (b.remaining ?? 0), 0);

    return {
      items,
      count: items.length,
      totalBudget: Math.round(totalBudget * 100) / 100,
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
    };
  }

  /**
   * Get a single budget by ID
   */
  async findOne(userId: string, budgetId: string): Promise<BudgetResponseDto> {
    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, userId },
      include: {
        category: true,
      },
    });

    if (!budget) {
      throw new NotFoundException({
        code: ErrorCodes.BUDGET_NOT_FOUND,
        message: 'Budget not found',
      });
    }

    const spent = await this.calculateSpentInPeriod(userId, budget.categoryId, budget.period);
    return this.toResponseDto(budget, spent);
  }

  /**
   * Update a budget
   */
  async update(userId: string, budgetId: string, dto: UpdateBudgetDto): Promise<BudgetResponseDto> {
    // Verify ownership
    const existing = await this.prisma.budget.findFirst({
      where: { id: budgetId, userId },
      include: { category: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.BUDGET_NOT_FOUND,
        message: 'Budget not found',
      });
    }

    const budget = await this.prisma.budget.update({
      where: { id: budgetId },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.period !== undefined && { period: dto.period }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        category: true,
      },
    });

    const spent = await this.calculateSpentInPeriod(userId, budget.categoryId, budget.period);

    this.logger.log(`Updated budget ${budgetId} for user ${userId}`);
    return this.toResponseDto(budget, spent);
  }

  /**
   * Soft delete a budget
   */
  async remove(userId: string, budgetId: string): Promise<void> {
    // Verify ownership
    const existing = await this.prisma.budget.findFirst({
      where: { id: budgetId, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.BUDGET_NOT_FOUND,
        message: 'Budget not found',
      });
    }

    await this.prisma.budget.update({
      where: { id: budgetId },
      data: { isActive: false },
    });

    this.logger.log(`Soft deleted budget ${budgetId} for user ${userId}`);
  }

  /**
   * Calculate spending in the current period for a category
   */
  private async calculateSpentInPeriod(
    userId: string,
    categoryId: string,
    period: BudgetPeriod,
  ): Promise<number> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'WEEKLY':
        startDate = startOfWeek(now);
        endDate = endOfWeek(now);
        break;
      case 'MONTHLY':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'QUARTERLY':
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        break;
      case 'ANNUALLY':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      default:
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
    }

    const result = await this.prisma.expense.aggregate({
      where: {
        userId,
        categoryId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return Number(result._sum.amount ?? 0);
  }

  /**
   * Convert database model to response DTO
   */
  private toResponseDto(budget: any, spent?: number, rebalanceAdjustment = 0): BudgetResponseDto {
    const amount = Number(budget.amount) + rebalanceAdjustment;
    const remaining = spent !== undefined ? amount - spent : undefined;
    const percentUsed = spent !== undefined && amount > 0
      ? Math.round((spent / amount) * 100)
      : undefined;

    return {
      id: budget.id,
      categoryId: budget.categoryId ?? budget.category?.id,
      category: {
        id: budget.category.id,
        name: budget.category.name,
        icon: budget.category.icon,
        color: budget.category.color,
      },
      amount,
      currency: budget.currency,
      period: budget.period,
      startDate: budget.startDate,
      isActive: budget.isActive,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
      spent,
      remaining,
      percentUsed,
    };
  }
}
