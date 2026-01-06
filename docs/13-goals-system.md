# Goals System

## Overview

This document covers Ikpa's financial goals tracking system, enabling users to set, track, and achieve savings goals. Goals can range from emergency funds to major purchases, with automated progress tracking and contribution recommendations.

---

## Technical Specifications

### Prisma Schema

```prisma
enum GoalCategory {
  EMERGENCY_FUND
  EDUCATION
  TRAVEL
  VEHICLE
  PROPERTY
  WEDDING
  BUSINESS
  RETIREMENT
  GENERAL_SAVINGS
  OTHER
}

enum GoalStatus {
  ACTIVE
  PAUSED
  COMPLETED
  CANCELLED
}

enum GoalPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

model Goal {
  id                  String         @id @default(cuid())
  userId              String
  user                User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  name                String
  category            GoalCategory
  status              GoalStatus     @default(ACTIVE)
  priority            GoalPriority   @default(MEDIUM)
  targetAmount        Decimal        @db.Decimal(12, 2)
  currentAmount       Decimal        @db.Decimal(12, 2) @default(0)
  currency            Currency       @default(NGN)
  targetDate          DateTime?
  monthlyContribution Decimal?       @db.Decimal(12, 2)
  autoContribute      Boolean        @default(false)
  linkedAccountId     String?        // Savings account to link
  iconName            String         @default("target")
  colorHex            String         @default("#10B981")
  notes               String?
  contributions       GoalContribution[]
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  @@index([userId, status])
  @@index([userId, priority])
}

model GoalContribution {
  id          String   @id @default(cuid())
  goalId      String
  goal        Goal     @relation(fields: [goalId], references: [id], onDelete: Cascade)
  amount      Decimal  @db.Decimal(12, 2)
  date        DateTime
  notes       String?
  isAutomatic Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([goalId, date])
}
```

---

## Module Structure

```
apps/api/src/modules/goals/
├── goals.module.ts
├── goals.controller.ts
├── goals.service.ts
├── contributions/
│   ├── contributions.controller.ts
│   └── contributions.service.ts
├── calculators/
│   └── goal-calculator.service.ts
├── dto/
│   ├── create-goal.dto.ts
│   ├── update-goal.dto.ts
│   └── create-contribution.dto.ts
└── entities/
    ├── goal.entity.ts
    └── goal-contribution.entity.ts
```

---

## DTOs

### Create Goal DTO

```typescript
// apps/api/src/modules/goals/dto/create-goal.dto.ts

import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';
import { Currency, GoalCategory, GoalPriority } from '@prisma/client';

export class CreateGoalDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(GoalCategory)
  category: GoalCategory;

  @IsOptional()
  @IsEnum(GoalPriority)
  priority?: GoalPriority;

  @IsNumber()
  @Min(1)
  targetAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyContribution?: number;

  @IsOptional()
  @IsBoolean()
  autoContribute?: boolean;

  @IsOptional()
  @IsString()
  linkedAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  iconName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  colorHex?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

### Update Goal DTO

```typescript
// apps/api/src/modules/goals/dto/update-goal.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { GoalStatus } from '@prisma/client';
import { CreateGoalDto } from './create-goal.dto';

export class UpdateGoalDto extends PartialType(CreateGoalDto) {
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;
}
```

### Create Contribution DTO

```typescript
// apps/api/src/modules/goals/dto/create-contribution.dto.ts

import {
  IsNumber,
  IsDateString,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateContributionDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isAutomatic?: boolean;
}
```

---

## Service Implementation

### Goals Service

```typescript
// apps/api/src/modules/goals/goals.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoalCalculatorService } from './calculators/goal-calculator.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalCategory, GoalStatus, GoalPriority } from '@prisma/client';

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: GoalCalculatorService,
  ) {}

  async create(userId: string, dto: CreateGoalDto) {
    // Validate linked account if provided
    if (dto.linkedAccountId) {
      const account = await this.prisma.savingsAccount.findFirst({
        where: { id: dto.linkedAccountId, userId },
      });
      if (!account) {
        throw new BadRequestException('Invalid linked savings account');
      }
    }

    return this.prisma.goal.create({
      data: {
        userId,
        name: dto.name,
        category: dto.category,
        priority: dto.priority ?? GoalPriority.MEDIUM,
        targetAmount: dto.targetAmount,
        currentAmount: dto.currentAmount ?? 0,
        currency: dto.currency,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        monthlyContribution: dto.monthlyContribution,
        autoContribute: dto.autoContribute ?? false,
        linkedAccountId: dto.linkedAccountId,
        iconName: dto.iconName ?? this.getDefaultIcon(dto.category),
        colorHex: dto.colorHex ?? this.getDefaultColor(dto.category),
        notes: dto.notes,
      },
    });
  }

  async findAll(userId: string, status?: GoalStatus) {
    const goals = await this.prisma.goal.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      orderBy: [
        { priority: 'desc' },
        { targetDate: 'asc' },
      ],
      include: {
        contributions: {
          orderBy: { date: 'desc' },
          take: 5,
        },
        _count: {
          select: { contributions: true },
        },
      },
    });

    // Add calculated fields
    return goals.map((goal) => ({
      ...goal,
      progress: this.calculator.calculateProgress(
        Number(goal.currentAmount),
        Number(goal.targetAmount),
      ),
      projection: this.calculator.projectCompletion(goal),
      isOnTrack: this.calculator.isOnTrack(goal),
    }));
  }

  async findOne(userId: string, id: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
      include: {
        contributions: {
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    if (goal.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return {
      ...goal,
      progress: this.calculator.calculateProgress(
        Number(goal.currentAmount),
        Number(goal.targetAmount),
      ),
      projection: this.calculator.projectCompletion(goal),
      isOnTrack: this.calculator.isOnTrack(goal),
      recommendedContribution: this.calculator.recommendMonthlyContribution(goal),
    };
  }

  async update(userId: string, id: string, dto: UpdateGoalDto) {
    await this.findOne(userId, id);

    // Check if marking as completed
    if (dto.status === GoalStatus.COMPLETED) {
      const goal = await this.prisma.goal.findUnique({ where: { id } });
      if (Number(goal!.currentAmount) < Number(goal!.targetAmount)) {
        throw new BadRequestException(
          'Cannot mark goal as completed before reaching target amount',
        );
      }
    }

    return this.prisma.goal.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.category && { category: dto.category }),
        ...(dto.priority && { priority: dto.priority }),
        ...(dto.targetAmount !== undefined && { targetAmount: dto.targetAmount }),
        ...(dto.currentAmount !== undefined && { currentAmount: dto.currentAmount }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.targetDate !== undefined && {
          targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        }),
        ...(dto.monthlyContribution !== undefined && {
          monthlyContribution: dto.monthlyContribution,
        }),
        ...(dto.autoContribute !== undefined && { autoContribute: dto.autoContribute }),
        ...(dto.linkedAccountId !== undefined && { linkedAccountId: dto.linkedAccountId }),
        ...(dto.iconName && { iconName: dto.iconName }),
        ...(dto.colorHex && { colorHex: dto.colorHex }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.status && { status: dto.status }),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.goal.delete({ where: { id } });

    return { message: 'Goal deleted successfully' };
  }

  // Summary & Analytics
  async getGoalsSummary(userId: string) {
    const goals = await this.prisma.goal.findMany({
      where: { userId, status: GoalStatus.ACTIVE },
    });

    const totalTarget = goals.reduce(
      (sum, g) => sum + Number(g.targetAmount),
      0,
    );
    const totalSaved = goals.reduce(
      (sum, g) => sum + Number(g.currentAmount),
      0,
    );
    const totalRemaining = totalTarget - totalSaved;

    const byPriority = goals.reduce((acc, goal) => {
      const priority = goal.priority;
      if (!acc[priority]) {
        acc[priority] = { priority, count: 0, totalSaved: 0, totalTarget: 0 };
      }
      acc[priority].count += 1;
      acc[priority].totalSaved += Number(goal.currentAmount);
      acc[priority].totalTarget += Number(goal.targetAmount);
      return acc;
    }, {} as Record<GoalPriority, { priority: GoalPriority; count: number; totalSaved: number; totalTarget: number }>);

    const byCategory = goals.reduce((acc, goal) => {
      const category = goal.category;
      if (!acc[category]) {
        acc[category] = { category, count: 0, totalSaved: 0, totalTarget: 0 };
      }
      acc[category].count += 1;
      acc[category].totalSaved += Number(goal.currentAmount);
      acc[category].totalTarget += Number(goal.targetAmount);
      return acc;
    }, {} as Record<GoalCategory, { category: GoalCategory; count: number; totalSaved: number; totalTarget: number }>);

    const atRisk = goals.filter((g) => !this.calculator.isOnTrack(g));

    return {
      activeGoals: goals.length,
      totalTarget,
      totalSaved,
      totalRemaining,
      overallProgress: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0,
      goalsAtRisk: atRisk.length,
      byPriority: Object.values(byPriority),
      byCategory: Object.values(byCategory),
    };
  }

  async getRecommendations(userId: string, monthlyBudget: number) {
    const goals = await this.prisma.goal.findMany({
      where: { userId, status: GoalStatus.ACTIVE },
      orderBy: { priority: 'desc' },
    });

    return this.calculator.allocateMonthlyBudget(goals, monthlyBudget);
  }

  async reorderGoals(userId: string, goalIds: string[]) {
    // Verify all goals belong to user
    const goals = await this.prisma.goal.findMany({
      where: { id: { in: goalIds }, userId },
    });

    if (goals.length !== goalIds.length) {
      throw new ForbiddenException('Some goals not found or access denied');
    }

    // Update priorities based on order
    const priorities = [
      GoalPriority.CRITICAL,
      GoalPriority.HIGH,
      GoalPriority.MEDIUM,
      GoalPriority.LOW,
    ];

    const updates = goalIds.map((id, index) => {
      const priorityIndex = Math.min(
        Math.floor(index / Math.ceil(goalIds.length / 4)),
        3,
      );
      return this.prisma.goal.update({
        where: { id },
        data: { priority: priorities[priorityIndex] },
      });
    });

    await this.prisma.$transaction(updates);

    return { message: 'Goals reordered successfully' };
  }

  // Helpers
  private getDefaultIcon(category: GoalCategory): string {
    const icons: Record<GoalCategory, string> = {
      EMERGENCY_FUND: 'shield',
      EDUCATION: 'graduation-cap',
      TRAVEL: 'plane',
      VEHICLE: 'car',
      PROPERTY: 'home',
      WEDDING: 'heart',
      BUSINESS: 'briefcase',
      RETIREMENT: 'umbrella',
      GENERAL_SAVINGS: 'piggy-bank',
      OTHER: 'target',
    };
    return icons[category];
  }

  private getDefaultColor(category: GoalCategory): string {
    const colors: Record<GoalCategory, string> = {
      EMERGENCY_FUND: '#EF4444',
      EDUCATION: '#3B82F6',
      TRAVEL: '#06B6D4',
      VEHICLE: '#8B5CF6',
      PROPERTY: '#10B981',
      WEDDING: '#EC4899',
      BUSINESS: '#F59E0B',
      RETIREMENT: '#6366F1',
      GENERAL_SAVINGS: '#10B981',
      OTHER: '#6B7280',
    };
    return colors[category];
  }
}
```

### Goal Calculator Service

```typescript
// apps/api/src/modules/goals/calculators/goal-calculator.service.ts

import { Injectable } from '@nestjs/common';
import { Goal, GoalPriority } from '@prisma/client';

interface GoalProjection {
  completionDate: Date | null;
  monthsRemaining: number | null;
  requiredMonthly: number | null;
  confidenceLevel: 'high' | 'medium' | 'low' | 'unknown';
}

interface AllocationRecommendation {
  goalId: string;
  goalName: string;
  priority: GoalPriority;
  recommendedAmount: number;
  percentageOfBudget: number;
  reason: string;
}

@Injectable()
export class GoalCalculatorService {
  calculateProgress(current: number, target: number): number {
    if (target <= 0) return 0;
    return Math.min(100, (current / target) * 100);
  }

  projectCompletion(goal: Goal): GoalProjection {
    const current = Number(goal.currentAmount);
    const target = Number(goal.targetAmount);
    const monthly = Number(goal.monthlyContribution ?? 0);

    if (current >= target) {
      return {
        completionDate: new Date(),
        monthsRemaining: 0,
        requiredMonthly: 0,
        confidenceLevel: 'high',
      };
    }

    const remaining = target - current;

    if (monthly <= 0) {
      // No monthly contribution set
      if (goal.targetDate) {
        const months = this.monthsUntil(new Date(goal.targetDate));
        return {
          completionDate: goal.targetDate,
          monthsRemaining: months,
          requiredMonthly: months > 0 ? remaining / months : remaining,
          confidenceLevel: 'unknown',
        };
      }
      return {
        completionDate: null,
        monthsRemaining: null,
        requiredMonthly: null,
        confidenceLevel: 'unknown',
      };
    }

    const monthsNeeded = Math.ceil(remaining / monthly);
    const completionDate = new Date();
    completionDate.setMonth(completionDate.getMonth() + monthsNeeded);

    let confidenceLevel: 'high' | 'medium' | 'low' = 'high';
    if (goal.targetDate) {
      const targetMonths = this.monthsUntil(new Date(goal.targetDate));
      if (monthsNeeded > targetMonths * 1.5) {
        confidenceLevel = 'low';
      } else if (monthsNeeded > targetMonths) {
        confidenceLevel = 'medium';
      }
    }

    return {
      completionDate,
      monthsRemaining: monthsNeeded,
      requiredMonthly: monthly,
      confidenceLevel,
    };
  }

  isOnTrack(goal: Goal): boolean {
    if (!goal.targetDate) return true; // No deadline = always on track

    const current = Number(goal.currentAmount);
    const target = Number(goal.targetAmount);
    const monthly = Number(goal.monthlyContribution ?? 0);

    if (current >= target) return true;

    const monthsRemaining = this.monthsUntil(new Date(goal.targetDate));
    if (monthsRemaining <= 0) return current >= target;

    const requiredMonthly = (target - current) / monthsRemaining;
    return monthly >= requiredMonthly * 0.9; // 10% buffer
  }

  recommendMonthlyContribution(goal: Goal): number {
    const current = Number(goal.currentAmount);
    const target = Number(goal.targetAmount);

    if (current >= target) return 0;

    const remaining = target - current;

    if (goal.targetDate) {
      const monthsRemaining = Math.max(1, this.monthsUntil(new Date(goal.targetDate)));
      return Math.ceil(remaining / monthsRemaining);
    }

    // Default: 12 months
    return Math.ceil(remaining / 12);
  }

  allocateMonthlyBudget(
    goals: Goal[],
    monthlyBudget: number,
  ): AllocationRecommendation[] {
    if (goals.length === 0 || monthlyBudget <= 0) {
      return [];
    }

    // Priority weights
    const priorityWeights: Record<GoalPriority, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    // Calculate weighted scores
    const goalsWithScores = goals.map((goal) => {
      const remaining = Number(goal.targetAmount) - Number(goal.currentAmount);
      const urgency = goal.targetDate
        ? 1 / Math.max(1, this.monthsUntil(new Date(goal.targetDate)))
        : 0.1;

      const score =
        priorityWeights[goal.priority] * (1 + urgency) * (remaining > 0 ? 1 : 0);

      return { goal, score, remaining };
    });

    const totalScore = goalsWithScores.reduce((sum, g) => sum + g.score, 0);

    if (totalScore === 0) {
      return goals.map((goal) => ({
        goalId: goal.id,
        goalName: goal.name,
        priority: goal.priority,
        recommendedAmount: 0,
        percentageOfBudget: 0,
        reason: 'Goal already completed',
      }));
    }

    return goalsWithScores.map(({ goal, score, remaining }) => {
      const percentage = (score / totalScore) * 100;
      const recommended = Math.min(
        Math.round((monthlyBudget * score) / totalScore),
        remaining,
      );

      let reason = '';
      if (goal.priority === GoalPriority.CRITICAL) {
        reason = 'Critical priority - allocate first';
      } else if (goal.targetDate && this.monthsUntil(new Date(goal.targetDate)) <= 3) {
        reason = 'Approaching deadline';
      } else if (this.isOnTrack(goal)) {
        reason = 'On track to completion';
      } else {
        reason = 'Needs attention to stay on track';
      }

      return {
        goalId: goal.id,
        goalName: goal.name,
        priority: goal.priority,
        recommendedAmount: recommended,
        percentageOfBudget: Math.round(percentage * 10) / 10,
        reason,
      };
    });
  }

  private monthsUntil(date: Date): number {
    const now = new Date();
    const months =
      (date.getFullYear() - now.getFullYear()) * 12 +
      (date.getMonth() - now.getMonth());
    return Math.max(0, months);
  }
}
```

### Contributions Service

```typescript
// apps/api/src/modules/goals/contributions/contributions.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContributionDto } from '../dto/create-contribution.dto';
import { GoalStatus } from '@prisma/client';

@Injectable()
export class ContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, goalId: string, dto: CreateContributionDto) {
    const goal = await this.validateGoalOwnership(userId, goalId);

    if (goal.status !== GoalStatus.ACTIVE) {
      throw new BadRequestException('Cannot contribute to inactive goal');
    }

    // Create contribution and update goal in transaction
    const [contribution, updatedGoal] = await this.prisma.$transaction([
      this.prisma.goalContribution.create({
        data: {
          goalId,
          amount: dto.amount,
          date: new Date(dto.date),
          notes: dto.notes,
          isAutomatic: dto.isAutomatic ?? false,
        },
      }),
      this.prisma.goal.update({
        where: { id: goalId },
        data: {
          currentAmount: { increment: dto.amount },
        },
      }),
    ]);

    // Check if goal is now complete
    const newAmount = Number(updatedGoal.currentAmount);
    const targetAmount = Number(updatedGoal.targetAmount);

    return {
      contribution,
      newBalance: newAmount,
      isComplete: newAmount >= targetAmount,
      progress: (newAmount / targetAmount) * 100,
    };
  }

  async findAll(userId: string, goalId: string, page = 1, limit = 20) {
    await this.validateGoalOwnership(userId, goalId);

    const [contributions, total] = await Promise.all([
      this.prisma.goalContribution.findMany({
        where: { goalId },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.goalContribution.count({ where: { goalId } }),
    ]);

    return {
      contributions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getContributionStats(userId: string, goalId: string) {
    await this.validateGoalOwnership(userId, goalId);

    const contributions = await this.prisma.goalContribution.findMany({
      where: { goalId },
      orderBy: { date: 'asc' },
    });

    const total = contributions.reduce((sum, c) => sum + Number(c.amount), 0);
    const automatic = contributions.filter((c) => c.isAutomatic);
    const manual = contributions.filter((c) => !c.isAutomatic);

    // Group by month
    const byMonth = contributions.reduce((acc, c) => {
      const key = c.date.toISOString().slice(0, 7);
      acc[key] = (acc[key] || 0) + Number(c.amount);
      return acc;
    }, {} as Record<string, number>);

    const monthlyAverage =
      Object.keys(byMonth).length > 0
        ? total / Object.keys(byMonth).length
        : 0;

    return {
      totalContributed: total,
      contributionCount: contributions.length,
      automaticCount: automatic.length,
      automaticTotal: automatic.reduce((sum, c) => sum + Number(c.amount), 0),
      manualCount: manual.length,
      manualTotal: manual.reduce((sum, c) => sum + Number(c.amount), 0),
      averageContribution: contributions.length > 0 ? total / contributions.length : 0,
      monthlyAverage,
      byMonth: Object.entries(byMonth)
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      firstContribution: contributions[0]?.date,
      lastContribution: contributions[contributions.length - 1]?.date,
    };
  }

  async remove(userId: string, goalId: string, contributionId: string) {
    const goal = await this.validateGoalOwnership(userId, goalId);

    const contribution = await this.prisma.goalContribution.findUnique({
      where: { id: contributionId },
    });

    if (!contribution || contribution.goalId !== goalId) {
      throw new NotFoundException('Contribution not found');
    }

    // Delete contribution and update goal balance
    await this.prisma.$transaction([
      this.prisma.goalContribution.delete({ where: { id: contributionId } }),
      this.prisma.goal.update({
        where: { id: goalId },
        data: {
          currentAmount: { decrement: Number(contribution.amount) },
          // Reactivate if was completed
          status:
            goal.status === GoalStatus.COMPLETED ? GoalStatus.ACTIVE : goal.status,
        },
      }),
    ]);

    return { message: 'Contribution deleted successfully' };
  }

  private async validateGoalOwnership(userId: string, goalId: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    if (goal.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return goal;
  }
}
```

---

## Controller Implementation

```typescript
// apps/api/src/modules/goals/goals.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalStatus } from '@prisma/client';

@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(userId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query('status') status?: GoalStatus,
  ) {
    return this.goalsService.findAll(userId, status);
  }

  @Get('summary')
  getSummary(@CurrentUser('id') userId: string) {
    return this.goalsService.getGoalsSummary(userId);
  }

  @Get('recommendations')
  getRecommendations(
    @CurrentUser('id') userId: string,
    @Query('budget') budget: number,
  ) {
    return this.goalsService.getRecommendations(userId, budget);
  }

  @Post('reorder')
  reorderGoals(
    @CurrentUser('id') userId: string,
    @Body() body: { goalIds: string[] },
  ) {
    return this.goalsService.reorderGoals(userId, body.goalIds);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.goalsService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.goalsService.remove(userId, id);
  }
}
```

---

## API Endpoints

### Goal Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/goals` | Create goal |
| GET | `/goals` | List all goals |
| GET | `/goals/summary` | Get goals summary |
| GET | `/goals/recommendations` | Get allocation recommendations |
| POST | `/goals/reorder` | Reorder goals by priority |
| GET | `/goals/:id` | Get single goal |
| PATCH | `/goals/:id` | Update goal |
| DELETE | `/goals/:id` | Delete goal |

### Contribution Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/goals/:goalId/contributions` | Add contribution |
| GET | `/goals/:goalId/contributions` | List contributions |
| GET | `/goals/:goalId/contributions/stats` | Contribution statistics |
| DELETE | `/goals/:goalId/contributions/:id` | Delete contribution |

---

## UI Components

### Goal Progress Card

```tsx
// Mobile: apps/mobile/src/components/goals/GoalCard.tsx

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Goal } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';

interface GoalCardProps {
  goal: Goal;
  onPress: () => void;
}

export function GoalCard({ goal, onPress }: GoalCardProps) {
  const progress = (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100;
  const remaining = Number(goal.targetAmount) - Number(goal.currentAmount);

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: goal.colorHex }]}>
          <Text style={styles.iconText}>{goal.iconName[0].toUpperCase()}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name}>{goal.name}</Text>
          <Text style={styles.category}>
            {goal.category.replace('_', ' ')}
            {goal.targetDate && ` • Due ${formatDate(goal.targetDate)}`}
          </Text>
        </View>
      </View>

      <View style={styles.amounts}>
        <Text style={styles.current}>
          {formatCurrency(Number(goal.currentAmount), goal.currency)}
        </Text>
        <Text style={styles.target}>
          of {formatCurrency(Number(goal.targetAmount), goal.currency)}
        </Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: goal.colorHex,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
      </View>

      {remaining > 0 && (
        <Text style={styles.remaining}>
          {formatCurrency(remaining, goal.currency)} to go
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  category: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  amounts: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  current: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'JetBrains Mono',
  },
  target: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    width: 40,
    textAlign: 'right',
  },
  remaining: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },
});
```

---

## Key Capabilities

1. **Goal Categories**: 10 predefined categories with custom icons/colors
2. **Priority System**: CRITICAL, HIGH, MEDIUM, LOW priorities
3. **Progress Tracking**: Real-time progress calculation
4. **Projections**: Estimated completion dates based on contributions
5. **On-Track Detection**: Alerts when goals fall behind
6. **Allocation Recommendations**: Smart budget allocation across goals
7. **Contribution History**: Full audit trail of contributions
8. **Auto-Contribute**: Link to savings accounts for automation

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@nestjs/common` | Core NestJS decorators |
| `class-validator` | DTO validation |
| `@prisma/client` | Database ORM |

---

## Next Steps

After goals system, proceed to:
1. [14-ai-service.md](./14-ai-service.md) - AI coach integration
