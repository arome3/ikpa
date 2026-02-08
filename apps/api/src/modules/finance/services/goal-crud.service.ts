import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateGoalDto,
  UpdateGoalDto,
  GoalResponseDto,
  GoalListResponseDto,
  ContributeGoalDto,
  ContributionResponseDto,
} from '../dto';
import { ErrorCodes } from '../../../common/constants/error-codes';
import { GoalStatus } from '@prisma/client';

/**
 * Goal CRUD Service
 *
 * Manages CRUD operations for financial goals.
 * Named GoalCrudService to avoid conflicts with existing goal-related services.
 * Includes contribution tracking for goal progress.
 */
@Injectable()
export class GoalCrudService {
  private readonly logger = new Logger(GoalCrudService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new financial goal
   */
  async create(userId: string, dto: CreateGoalDto): Promise<GoalResponseDto> {
    // Get user's default currency if not provided
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    const goal = await this.prisma.goal.create({
      data: {
        userId,
        name: dto.name,
        category: dto.category,
        targetAmount: dto.targetAmount,
        currentAmount: dto.currentAmount ?? 0,
        currency: dto.currency ?? user?.currency ?? 'NGN',
        description: dto.description ?? null,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        priority: dto.priority ?? 0,
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Created goal ${goal.id} for user ${userId}`);
    return this.toResponseDto(goal);
  }

  /**
   * List all goals for a user
   */
  async findAll(userId: string, status?: GoalStatus): Promise<GoalListResponseDto> {
    const where = {
      userId,
      ...(status ? { status } : {}),
    };

    const goals = await this.prisma.goal.findMany({
      where,
      orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
    });

    const items = goals.map((goal) => this.toResponseDto(goal));

    // Calculate totals for active goals
    const activeGoals = goals.filter((g) => g.status === 'ACTIVE');
    const totalTarget = activeGoals.reduce((sum, g) => sum + Number(g.targetAmount), 0);
    const totalCurrent = activeGoals.reduce((sum, g) => sum + Number(g.currentAmount), 0);
    const overallProgress = totalTarget > 0
      ? Math.round((totalCurrent / totalTarget) * 100)
      : 0;

    return {
      items,
      count: items.length,
      totalTarget: Math.round(totalTarget * 100) / 100,
      totalCurrent: Math.round(totalCurrent * 100) / 100,
      overallProgress,
    };
  }

  /**
   * Get a single goal by ID
   */
  async findOne(userId: string, goalId: string): Promise<GoalResponseDto> {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundException({
        code: ErrorCodes.GOAL_NOT_FOUND,
        message: 'Goal not found',
      });
    }

    return this.toResponseDto(goal);
  }

  /**
   * Update a goal
   */
  async update(userId: string, goalId: string, dto: UpdateGoalDto): Promise<GoalResponseDto> {
    // Verify ownership
    const existing = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.GOAL_NOT_FOUND,
        message: 'Goal not found',
      });
    }

    const goal = await this.prisma.goal.update({
      where: { id: goalId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.targetAmount !== undefined && { targetAmount: dto.targetAmount }),
        ...(dto.currentAmount !== undefined && { currentAmount: dto.currentAmount }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.targetDate !== undefined && {
          targetDate: dto.targetDate ? new Date(dto.targetDate) : null
        }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    this.logger.log(`Updated goal ${goalId} for user ${userId}`);
    return this.toResponseDto(goal);
  }

  /**
   * Cancel a goal (soft delete)
   */
  async remove(userId: string, goalId: string): Promise<void> {
    // Verify ownership
    const existing = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.GOAL_NOT_FOUND,
        message: 'Goal not found',
      });
    }

    await this.prisma.goal.update({
      where: { id: goalId },
      data: { status: 'CANCELLED' },
    });

    this.logger.log(`Cancelled goal ${goalId} for user ${userId}`);
  }

  /**
   * Add a contribution to a goal
   */
  async contribute(
    userId: string,
    goalId: string,
    dto: ContributeGoalDto,
  ): Promise<ContributionResponseDto> {
    // Verify ownership and get current state
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundException({
        code: ErrorCodes.GOAL_NOT_FOUND,
        message: 'Goal not found',
      });
    }

    // Create contribution and update goal in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create contribution record
      const contribution = await tx.goalContribution.create({
        data: {
          goalId,
          amount: dto.amount,
          note: dto.note ?? null,
        },
      });

      // Update goal's current amount
      const newCurrentAmount = Number(goal.currentAmount) + dto.amount;
      const updatedGoal = await tx.goal.update({
        where: { id: goalId },
        data: {
          currentAmount: newCurrentAmount,
          // Auto-complete if target reached
          ...(newCurrentAmount >= Number(goal.targetAmount) && { status: 'COMPLETED' }),
        },
      });

      return { contribution, updatedGoal };
    });

    const { contribution, updatedGoal } = result;
    const newCurrentAmount = Number(updatedGoal.currentAmount);
    const targetAmount = Number(updatedGoal.targetAmount);
    const newProgressPercent = targetAmount > 0
      ? Math.round((newCurrentAmount / targetAmount) * 100)
      : 0;

    this.logger.log(`Added contribution ${contribution.id} to goal ${goalId} for user ${userId}`);

    // Emit event for milestone tracking (Future Self triggered letters)
    this.eventEmitter.emit('goal.contribution.created', {
      userId,
      goalId,
      goalName: goal.name,
      contributionAmount: dto.amount,
      currentAmount: newCurrentAmount,
      targetAmount,
      progressPercent: newProgressPercent,
      currency: goal.currency,
    });

    return {
      id: contribution.id,
      goalId: contribution.goalId,
      amount: Number(contribution.amount),
      date: contribution.date,
      note: contribution.note,
      createdAt: contribution.createdAt,
      newCurrentAmount,
      newProgressPercent,
    };
  }

  /**
   * Convert database model to response DTO
   */
  private toResponseDto(goal: any): GoalResponseDto {
    const targetAmount = Number(goal.targetAmount);
    const currentAmount = Number(goal.currentAmount);
    const progressPercent = targetAmount > 0
      ? Math.round((currentAmount / targetAmount) * 100)
      : 0;
    const remainingAmount = Math.max(0, targetAmount - currentAmount);

    return {
      id: goal.id,
      name: goal.name,
      category: goal.category,
      targetAmount,
      currentAmount,
      currency: goal.currency,
      description: goal.description,
      targetDate: goal.targetDate,
      priority: goal.priority,
      status: goal.status,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      progressPercent,
      remainingAmount,
    };
  }
}
