# Expense Management

## Overview

This document covers Ikpa's expense tracking system, including expense categories, recurring expense detection, bulk operations, and spending summaries. The system is designed to handle both one-time and recurring expenses with intelligent categorization.

---

## Technical Specifications

### Prisma Schema

```prisma
// Already defined in schema.prisma

model Expense {
  id          String          @id @default(cuid())
  userId      String
  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  categoryId  String?
  category    ExpenseCategory? @relation(fields: [categoryId], references: [id])
  amount      Decimal         @db.Decimal(12, 2)
  currency    Currency        @default(NGN)
  description String
  date        DateTime
  isRecurring Boolean         @default(false)
  frequency   Frequency?
  merchant    String?
  notes       String?
  tags        String[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([userId, date])
  @@index([userId, categoryId])
}

model ExpenseCategory {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  icon      String
  color     String
  budget    Decimal?  @db.Decimal(12, 2)
  isDefault Boolean   @default(false)
  expenses  Expense[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([userId, name])
  @@index([userId])
}
```

---

## Module Structure

```
apps/api/src/modules/expenses/
├── expenses.module.ts
├── expenses.controller.ts
├── expenses.service.ts
├── categories/
│   ├── categories.controller.ts
│   └── categories.service.ts
├── dto/
│   ├── create-expense.dto.ts
│   ├── update-expense.dto.ts
│   ├── expense-query.dto.ts
│   ├── bulk-expense.dto.ts
│   ├── create-category.dto.ts
│   └── update-category.dto.ts
└── entities/
    ├── expense.entity.ts
    └── expense-category.entity.ts
```

---

## DTOs

### Create Expense DTO

```typescript
// apps/api/src/modules/expenses/dto/create-expense.dto.ts

import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsDateString,
  IsArray,
  Min,
  MaxLength,
} from 'class-validator';
import { Currency, Frequency } from '@prisma/client';

export class CreateExpenseDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsString()
  @MaxLength(200)
  description: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsEnum(Frequency)
  frequency?: Frequency;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  merchant?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
```

### Update Expense DTO

```typescript
// apps/api/src/modules/expenses/dto/update-expense.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { CreateExpenseDto } from './create-expense.dto';

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
```

### Expense Query DTO

```typescript
// apps/api/src/modules/expenses/dto/expense-query.dto.ts

import {
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum ExpenseSortBy {
  DATE = 'date',
  AMOUNT = 'amount',
  CREATED_AT = 'createdAt',
}

export class ExpenseQueryDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  merchant?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  @IsEnum(ExpenseSortBy)
  sortBy?: ExpenseSortBy = ExpenseSortBy.DATE;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

### Bulk Expense DTO

```typescript
// apps/api/src/modules/expenses/dto/bulk-expense.dto.ts

import { Type } from 'class-transformer';
import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  IsString,
} from 'class-validator';
import { CreateExpenseDto } from './create-expense.dto';

export class BulkCreateExpenseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Type(() => CreateExpenseDto)
  expenses: CreateExpenseDto[];
}

export class BulkDeleteExpenseDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  ids: string[];
}

export class BulkUpdateCategoryDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  expenseIds: string[];

  @IsString()
  categoryId: string;
}
```

### Category DTOs

```typescript
// apps/api/src/modules/expenses/dto/create-category.dto.ts

import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(50)
  name: string;

  @IsString()
  @MaxLength(50)
  icon: string;  // Lucide icon name, e.g., 'shopping-cart'

  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color (e.g., #10B981)',
  })
  color: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

// apps/api/src/modules/expenses/dto/update-category.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
```

---

## Service Implementation

### Expenses Service

```typescript
// apps/api/src/modules/expenses/expenses.service.ts

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto, ExpenseSortBy, SortOrder } from './dto/expense-query.dto';
import { BulkCreateExpenseDto, BulkDeleteExpenseDto, BulkUpdateCategoryDto } from './dto/bulk-expense.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateExpenseDto) {
    // Validate category belongs to user if provided
    if (dto.categoryId) {
      await this.validateCategoryOwnership(userId, dto.categoryId);
    }

    return this.prisma.expense.create({
      data: {
        userId,
        amount: dto.amount,
        currency: dto.currency,
        description: dto.description,
        date: new Date(dto.date),
        categoryId: dto.categoryId,
        isRecurring: dto.isRecurring ?? false,
        frequency: dto.frequency,
        merchant: dto.merchant,
        notes: dto.notes,
        tags: dto.tags ?? [],
      },
      include: {
        category: true,
      },
    });
  }

  async findAll(userId: string, query: ExpenseQueryDto) {
    const {
      categoryId,
      startDate,
      endDate,
      search,
      merchant,
      minAmount,
      maxAmount,
      sortBy = ExpenseSortBy.DATE,
      sortOrder = SortOrder.DESC,
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.ExpenseWhereInput = {
      userId,
      ...(categoryId && { categoryId }),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
      ...(search && {
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          { merchant: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(merchant && { merchant: { contains: merchant, mode: 'insensitive' } }),
      ...(minAmount !== undefined || maxAmount !== undefined
        ? {
            amount: {
              ...(minAmount !== undefined && { gte: minAmount }),
              ...(maxAmount !== undefined && { lte: maxAmount }),
            },
          }
        : {}),
    };

    const [expenses, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: true,
        },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    if (expense.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return expense;
  }

  async update(userId: string, id: string, dto: UpdateExpenseDto) {
    await this.findOne(userId, id); // Validates ownership

    if (dto.categoryId) {
      await this.validateCategoryOwnership(userId, dto.categoryId);
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.description && { description: dto.description }),
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.isRecurring !== undefined && { isRecurring: dto.isRecurring }),
        ...(dto.frequency !== undefined && { frequency: dto.frequency }),
        ...(dto.merchant !== undefined && { merchant: dto.merchant }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.tags && { tags: dto.tags }),
      },
      include: { category: true },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id); // Validates ownership

    await this.prisma.expense.delete({ where: { id } });

    return { message: 'Expense deleted successfully' };
  }

  // Bulk Operations
  async bulkCreate(userId: string, dto: BulkCreateExpenseDto) {
    // Validate all categories belong to user
    const categoryIds = [...new Set(dto.expenses.map((e) => e.categoryId).filter(Boolean))];
    for (const categoryId of categoryIds) {
      await this.validateCategoryOwnership(userId, categoryId!);
    }

    const expenses = await this.prisma.$transaction(
      dto.expenses.map((expense) =>
        this.prisma.expense.create({
          data: {
            userId,
            amount: expense.amount,
            currency: expense.currency,
            description: expense.description,
            date: new Date(expense.date),
            categoryId: expense.categoryId,
            isRecurring: expense.isRecurring ?? false,
            frequency: expense.frequency,
            merchant: expense.merchant,
            notes: expense.notes,
            tags: expense.tags ?? [],
          },
          include: { category: true },
        })
      )
    );

    return { created: expenses.length, expenses };
  }

  async bulkDelete(userId: string, dto: BulkDeleteExpenseDto) {
    // Verify ownership of all expenses
    const expenses = await this.prisma.expense.findMany({
      where: {
        id: { in: dto.ids },
        userId,
      },
    });

    if (expenses.length !== dto.ids.length) {
      throw new ForbiddenException('Some expenses not found or access denied');
    }

    await this.prisma.expense.deleteMany({
      where: {
        id: { in: dto.ids },
        userId,
      },
    });

    return { deleted: dto.ids.length };
  }

  async bulkUpdateCategory(userId: string, dto: BulkUpdateCategoryDto) {
    // Verify ownership of all expenses
    const expenses = await this.prisma.expense.findMany({
      where: {
        id: { in: dto.expenseIds },
        userId,
      },
    });

    if (expenses.length !== dto.expenseIds.length) {
      throw new ForbiddenException('Some expenses not found or access denied');
    }

    // Verify category ownership
    await this.validateCategoryOwnership(userId, dto.categoryId);

    await this.prisma.expense.updateMany({
      where: {
        id: { in: dto.expenseIds },
        userId,
      },
      data: { categoryId: dto.categoryId },
    });

    return { updated: dto.expenseIds.length };
  }

  // Summary & Analytics
  async getSummary(userId: string, startDate: Date, endDate: Date) {
    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { category: true },
    });

    const total = expenses.reduce(
      (sum, exp) => sum + Number(exp.amount),
      0
    );

    const byCategory = expenses.reduce((acc, exp) => {
      const categoryName = exp.category?.name ?? 'Uncategorized';
      if (!acc[categoryName]) {
        acc[categoryName] = {
          categoryId: exp.categoryId,
          name: categoryName,
          icon: exp.category?.icon ?? 'help-circle',
          color: exp.category?.color ?? '#6B7280',
          total: 0,
          count: 0,
        };
      }
      acc[categoryName].total += Number(exp.amount);
      acc[categoryName].count += 1;
      return acc;
    }, {} as Record<string, { categoryId: string | null; name: string; icon: string; color: string; total: number; count: number }>);

    const byDay = expenses.reduce((acc, exp) => {
      const day = exp.date.toISOString().split('T')[0];
      if (!acc[day]) {
        acc[day] = { date: day, total: 0, count: 0 };
      }
      acc[day].total += Number(exp.amount);
      acc[day].count += 1;
      return acc;
    }, {} as Record<string, { date: string; total: number; count: number }>);

    return {
      total,
      count: expenses.length,
      average: expenses.length > 0 ? total / expenses.length : 0,
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async getRecurringExpenses(userId: string) {
    return this.prisma.expense.findMany({
      where: {
        userId,
        isRecurring: true,
      },
      include: { category: true },
      orderBy: { amount: 'desc' },
    });
  }

  async getTopMerchants(userId: string, limit = 10) {
    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        merchant: { not: null },
      },
      select: {
        merchant: true,
        amount: true,
      },
    });

    const merchantTotals = expenses.reduce((acc, exp) => {
      const merchant = exp.merchant!;
      if (!acc[merchant]) {
        acc[merchant] = { merchant, total: 0, count: 0 };
      }
      acc[merchant].total += Number(exp.amount);
      acc[merchant].count += 1;
      return acc;
    }, {} as Record<string, { merchant: string; total: number; count: number }>);

    return Object.values(merchantTotals)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  // Private Helpers
  private async validateCategoryOwnership(userId: string, categoryId: string) {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category || category.userId !== userId) {
      throw new ForbiddenException('Category not found or access denied');
    }

    return category;
  }
}
```

### Categories Service

```typescript
// apps/api/src/modules/expenses/categories/categories.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

// Default categories with African-inspired color palette
const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', icon: 'utensils', color: '#F59E0B' },
  { name: 'Transportation', icon: 'car', color: '#3B82F6' },
  { name: 'Housing', icon: 'home', color: '#8B5CF6' },
  { name: 'Utilities', icon: 'zap', color: '#EC4899' },
  { name: 'Healthcare', icon: 'heart-pulse', color: '#EF4444' },
  { name: 'Entertainment', icon: 'film', color: '#06B6D4' },
  { name: 'Shopping', icon: 'shopping-bag', color: '#10B981' },
  { name: 'Education', icon: 'graduation-cap', color: '#6366F1' },
  { name: 'Personal Care', icon: 'user', color: '#F97316' },
  { name: 'Family Support', icon: 'users', color: '#84CC16' },
  { name: 'Subscriptions', icon: 'repeat', color: '#A855F7' },
  { name: 'Other', icon: 'more-horizontal', color: '#6B7280' },
];

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async initializeDefaults(userId: string) {
    const existing = await this.prisma.expenseCategory.findFirst({
      where: { userId },
    });

    if (existing) {
      return; // Already initialized
    }

    await this.prisma.expenseCategory.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        userId,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        isDefault: true,
      })),
    });
  }

  async create(userId: string, dto: CreateCategoryDto) {
    // Check for duplicate name
    const existing = await this.prisma.expenseCategory.findUnique({
      where: {
        userId_name: {
          userId,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }

    return this.prisma.expenseCategory.create({
      data: {
        userId,
        name: dto.name,
        icon: dto.icon,
        color: dto.color,
        budget: dto.budget,
        isDefault: false,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.expenseCategory.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { expenses: true },
        },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { expenses: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return category;
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOne(userId, id); // Validates ownership

    // Check for duplicate name if changing
    if (dto.name) {
      const existing = await this.prisma.expenseCategory.findFirst({
        where: {
          userId,
          name: dto.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException('Category with this name already exists');
      }
    }

    return this.prisma.expenseCategory.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.icon && { icon: dto.icon }),
        ...(dto.color && { color: dto.color }),
        ...(dto.budget !== undefined && { budget: dto.budget }),
      },
    });
  }

  async remove(userId: string, id: string) {
    const category = await this.findOne(userId, id);

    // Check if category has expenses
    if (category._count.expenses > 0) {
      throw new ConflictException(
        `Cannot delete category with ${category._count.expenses} expenses. Move expenses first.`
      );
    }

    await this.prisma.expenseCategory.delete({ where: { id } });

    return { message: 'Category deleted successfully' };
  }

  async getCategoryBudgetStatus(userId: string) {
    const categories = await this.prisma.expenseCategory.findMany({
      where: {
        userId,
        budget: { not: null },
      },
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const results = await Promise.all(
      categories.map(async (category) => {
        const spent = await this.prisma.expense.aggregate({
          where: {
            userId,
            categoryId: category.id,
            date: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          _sum: { amount: true },
        });

        const spentAmount = Number(spent._sum.amount ?? 0);
        const budgetAmount = Number(category.budget);
        const percentage = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;

        return {
          categoryId: category.id,
          name: category.name,
          icon: category.icon,
          color: category.color,
          budget: budgetAmount,
          spent: spentAmount,
          remaining: budgetAmount - spentAmount,
          percentage: Math.round(percentage * 10) / 10,
          status:
            percentage >= 100
              ? 'exceeded'
              : percentage >= 80
              ? 'warning'
              : 'on_track',
        };
      })
    );

    return results;
  }
}
```

---

## Controller Implementation

### Expenses Controller

```typescript
// apps/api/src/modules/expenses/expenses.controller.ts

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
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import {
  BulkCreateExpenseDto,
  BulkDeleteExpenseDto,
  BulkUpdateCategoryDto,
} from './dto/bulk-expense.dto';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string, @Query() query: ExpenseQueryDto) {
    return this.expensesService.findAll(userId, query);
  }

  @Get('summary')
  getSummary(
    @CurrentUser('id') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.expensesService.getSummary(
      userId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('recurring')
  getRecurring(@CurrentUser('id') userId: string) {
    return this.expensesService.getRecurringExpenses(userId);
  }

  @Get('top-merchants')
  getTopMerchants(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.expensesService.getTopMerchants(userId, limit);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.expensesService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.expensesService.remove(userId, id);
  }

  // Bulk Operations
  @Post('bulk')
  bulkCreate(@CurrentUser('id') userId: string, @Body() dto: BulkCreateExpenseDto) {
    return this.expensesService.bulkCreate(userId, dto);
  }

  @Delete('bulk')
  bulkDelete(@CurrentUser('id') userId: string, @Body() dto: BulkDeleteExpenseDto) {
    return this.expensesService.bulkDelete(userId, dto);
  }

  @Patch('bulk/category')
  bulkUpdateCategory(
    @CurrentUser('id') userId: string,
    @Body() dto: BulkUpdateCategoryDto,
  ) {
    return this.expensesService.bulkUpdateCategory(userId, dto);
  }
}
```

### Categories Controller

```typescript
// apps/api/src/modules/expenses/categories/categories.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

@Controller('expenses/categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.categoriesService.findAll(userId);
  }

  @Get('budget-status')
  getBudgetStatus(@CurrentUser('id') userId: string) {
    return this.categoriesService.getCategoryBudgetStatus(userId);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.categoriesService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.categoriesService.remove(userId, id);
  }
}
```

---

## Module Definition

```typescript
// apps/api/src/modules/expenses/expenses.module.ts

import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExpensesController, CategoriesController],
  providers: [ExpensesService, CategoriesService],
  exports: [ExpensesService, CategoriesService],
})
export class ExpensesModule {}
```

---

## API Endpoints

### Expense Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/expenses` | Create expense |
| GET | `/expenses` | List expenses (paginated, filterable) |
| GET | `/expenses/summary` | Get expense summary by period |
| GET | `/expenses/recurring` | Get recurring expenses |
| GET | `/expenses/top-merchants` | Get top merchants by spend |
| GET | `/expenses/:id` | Get single expense |
| PATCH | `/expenses/:id` | Update expense |
| DELETE | `/expenses/:id` | Delete expense |
| POST | `/expenses/bulk` | Bulk create expenses |
| DELETE | `/expenses/bulk` | Bulk delete expenses |
| PATCH | `/expenses/bulk/category` | Bulk update category |

### Category Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/expenses/categories` | Create category |
| GET | `/expenses/categories` | List all categories |
| GET | `/expenses/categories/budget-status` | Get budget tracking |
| GET | `/expenses/categories/:id` | Get single category |
| PATCH | `/expenses/categories/:id` | Update category |
| DELETE | `/expenses/categories/:id` | Delete category |

---

## UI Components

### Expense List Card

```tsx
// Mobile: apps/mobile/src/components/expenses/ExpenseCard.tsx

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Expense } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';

interface ExpenseCardProps {
  expense: Expense;
  onPress: () => void;
}

export function ExpenseCard({ expense, onPress }: ExpenseCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: expense.category?.color ?? '#6B7280' },
        ]}
      >
        {/* Lucide icon would go here */}
        <Text style={styles.iconText}>
          {expense.category?.icon?.[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description} numberOfLines={1}>
          {expense.description}
        </Text>
        <Text style={styles.meta}>
          {expense.category?.name ?? 'Uncategorized'} • {formatDate(expense.date)}
        </Text>
      </View>

      <Text style={styles.amount}>
        -{formatCurrency(expense.amount, expense.currency)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 8,
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
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  description: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  meta: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    fontFamily: 'JetBrains Mono',
  },
});
```

### Category Budget Progress

```tsx
// Mobile: apps/mobile/src/components/expenses/CategoryBudget.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency } from '../../utils/format';

interface CategoryBudgetProps {
  name: string;
  icon: string;
  color: string;
  budget: number;
  spent: number;
  currency: string;
}

export function CategoryBudget({
  name,
  icon,
  color,
  budget,
  spent,
  currency,
}: CategoryBudgetProps) {
  const percentage = Math.min((spent / budget) * 100, 100);
  const remaining = budget - spent;
  const isOverBudget = spent > budget;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          <Text style={styles.iconText}>{icon[0]?.toUpperCase()}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.budget}>
            {formatCurrency(budget, currency)} budget
          </Text>
        </View>
        <Text
          style={[
            styles.remaining,
            { color: isOverBudget ? '#EF4444' : '#10B981' },
          ]}
        >
          {isOverBudget ? '-' : ''}
          {formatCurrency(Math.abs(remaining), currency)}
        </Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${percentage}%`,
                backgroundColor: isOverBudget ? '#EF4444' : color,
              },
            ]}
          />
        </View>
        <Text style={styles.percentage}>{Math.round(percentage)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  budget: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  remaining: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'JetBrains Mono',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
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
  percentage: {
    marginLeft: 8,
    fontSize: 12,
    color: '#6B7280',
    width: 35,
    textAlign: 'right',
  },
});
```

### Add Expense Form

```tsx
// Mobile: apps/mobile/src/screens/expenses/AddExpenseScreen.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCategories } from '../../hooks/useCategories';
import { useCreateExpense } from '../../hooks/useExpenses';
import { CategoryPicker } from '../../components/expenses/CategoryPicker';
import { CurrencyInput } from '../../components/common/CurrencyInput';

interface ExpenseFormData {
  amount: number;
  description: string;
  date: Date;
  categoryId: string;
  merchant?: string;
  notes?: string;
}

export function AddExpenseScreen({ navigation }) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { data: categories } = useCategories();
  const createExpense = useCreateExpense();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    defaultValues: {
      date: new Date(),
    },
  });

  const onSubmit = async (data: ExpenseFormData) => {
    await createExpense.mutateAsync({
      ...data,
      date: data.date.toISOString(),
    });
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Add Expense</Text>

      {/* Amount Input */}
      <View style={styles.field}>
        <Text style={styles.label}>Amount</Text>
        <Controller
          control={control}
          name="amount"
          rules={{ required: 'Amount is required', min: 0.01 }}
          render={({ field: { onChange, value } }) => (
            <CurrencyInput
              value={value}
              onChangeValue={onChange}
              currency="NGN"
            />
          )}
        />
        {errors.amount && (
          <Text style={styles.error}>{errors.amount.message}</Text>
        )}
      </View>

      {/* Description */}
      <View style={styles.field}>
        <Text style={styles.label}>Description</Text>
        <Controller
          control={control}
          name="description"
          rules={{ required: 'Description is required' }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="What did you spend on?"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        {errors.description && (
          <Text style={styles.error}>{errors.description.message}</Text>
        )}
      </View>

      {/* Category Picker */}
      <View style={styles.field}>
        <Text style={styles.label}>Category</Text>
        <Controller
          control={control}
          name="categoryId"
          render={({ field: { onChange, value } }) => (
            <CategoryPicker
              categories={categories ?? []}
              selectedId={value}
              onSelect={onChange}
            />
          )}
        />
      </View>

      {/* Date Picker */}
      <View style={styles.field}>
        <Text style={styles.label}>Date</Text>
        <Controller
          control={control}
          name="date"
          render={({ field: { onChange, value } }) => (
            <>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateText}>
                  {value.toLocaleDateString()}
                </Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={value}
                  mode="date"
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) onChange(date);
                  }}
                />
              )}
            </>
          )}
        />
      </View>

      {/* Merchant (Optional) */}
      <View style={styles.field}>
        <Text style={styles.label}>Merchant (Optional)</Text>
        <Controller
          control={control}
          name="merchant"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="e.g., Shoprite, Jumia"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
      </View>

      {/* Submit Button */}
      <Pressable
        style={[
          styles.submitButton,
          createExpense.isPending && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit(onSubmit)}
        disabled={createExpense.isPending}
      >
        <Text style={styles.submitButtonText}>
          {createExpense.isPending ? 'Saving...' : 'Add Expense'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 24,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  dateButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
  },
  dateText: {
    fontSize: 16,
    color: '#111827',
  },
  error: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

## Key Capabilities

1. **CRUD Operations**: Full create, read, update, delete for expenses
2. **Category Management**: User-customizable categories with budgets
3. **Bulk Operations**: Create, delete, or re-categorize multiple expenses at once
4. **Filtering & Search**: Filter by category, date range, amount, merchant
5. **Spending Summaries**: Aggregated views by category and time period
6. **Budget Tracking**: Monitor spending against category budgets
7. **Recurring Expense Detection**: Flag recurring expenses for better planning
8. **Merchant Analytics**: Identify top spending merchants

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@nestjs/common` | Core NestJS decorators |
| `class-validator` | DTO validation |
| `class-transformer` | Type transformation |
| `@prisma/client` | Database ORM |
| `react-hook-form` | Form handling (mobile) |
| `@react-native-community/datetimepicker` | Date picker (mobile) |

---

## Next Steps

After expense management, proceed to:
1. [07-savings-assets.md](./07-savings-assets.md) - Savings & asset tracking
