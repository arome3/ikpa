# Income Sources

## Overview

This document covers income source management for Ikpa. Users can track multiple income streams with varying frequencies and amounts, which is essential for African users who often have multiple income sources (salary, freelance, business, etc.) with irregular payment patterns.

---

## Technical Specifications

### Data Model

```prisma
model IncomeSource {
  id                 String      @id @default(uuid())
  userId             String
  name               String
  type               IncomeType
  amount             Decimal     @db.Decimal(15, 2)
  currency           Currency    @default(NGN)
  frequency          Frequency
  variancePercentage Int         @default(0)  // 0-100% for irregular income
  description        String?
  isActive           Boolean     @default(true)
  startDate          DateTime    @default(now())
  endDate            DateTime?
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isActive])
}

enum IncomeType {
  SALARY          // Regular employment
  FREELANCE       // Contract/gig work
  BUSINESS        // Business income
  INVESTMENT      // Dividends, interest
  RENTAL          // Property income
  ALLOWANCE       // Family allowance
  GIFT            // One-time gifts
  OTHER
}

enum Frequency {
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
  QUARTERLY
  ANNUALLY
  ONE_TIME
}
```

### API Endpoints

```yaml
GET /v1/income:
  query: { active?: boolean }
  response: IncomeSource[]

POST /v1/income:
  body: { name, type, amount, currency?, frequency, variancePercentage?, description? }
  response: IncomeSource

GET /v1/income/:id:
  response: IncomeSource

PATCH /v1/income/:id:
  body: { name?, type?, amount?, frequency?, isActive?, variancePercentage?, description? }
  response: IncomeSource

DELETE /v1/income/:id:
  response: { message }

GET /v1/income/summary:
  response: {
    totalMonthly: number,
    byType: { type, amount, percentage }[],
    activeCount: number
  }
```

---

## Key Capabilities

- Multiple income source tracking
- Various income types (salary, freelance, business, etc.)
- Flexible frequency options
- Variance percentage for irregular income
- Active/inactive status management
- Monthly income normalization for calculations

---

## Implementation Guide

### Step 1: DTOs

```typescript
// apps/api/src/modules/income/dto/create-income.dto.ts

import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IncomeType, Frequency, Currency } from '@prisma/client';

export class CreateIncomeDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(IncomeType)
  type: IncomeType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsEnum(Frequency)
  frequency: Frequency;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  variancePercentage?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
```

```typescript
// apps/api/src/modules/income/dto/update-income.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateIncomeDto } from './create-income.dto';

export class UpdateIncomeDto extends PartialType(CreateIncomeDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

### Step 2: Income Service

```typescript
// apps/api/src/modules/income/income.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { NotFoundException, ForbiddenException } from '../../common/exceptions/api.exception';
import { IncomeSource, Frequency } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class IncomeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, active?: boolean): Promise<IncomeSource[]> {
    return this.prisma.incomeSource.findMany({
      where: {
        userId,
        ...(active !== undefined ? { isActive: active } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(userId: string, id: string): Promise<IncomeSource> {
    const income = await this.prisma.incomeSource.findUnique({
      where: { id },
    });

    if (!income) {
      throw new NotFoundException('Income source', id);
    }

    if (income.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return income;
  }

  async create(userId: string, dto: CreateIncomeDto): Promise<IncomeSource> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    return this.prisma.incomeSource.create({
      data: {
        ...dto,
        userId,
        currency: dto.currency || user?.currency || 'NGN',
      },
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateIncomeDto,
  ): Promise<IncomeSource> {
    await this.findById(userId, id); // Verify ownership

    return this.prisma.incomeSource.update({
      where: { id },
      data: dto,
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.findById(userId, id); // Verify ownership

    await this.prisma.incomeSource.delete({
      where: { id },
    });
  }

  async getSummary(userId: string): Promise<{
    totalMonthly: number;
    byType: { type: string; amount: number; percentage: number }[];
    activeCount: number;
  }> {
    const incomeSources = await this.prisma.incomeSource.findMany({
      where: { userId, isActive: true },
    });

    // Calculate monthly amounts
    const monthlyAmounts = incomeSources.map((source) => ({
      ...source,
      monthlyAmount: this.toMonthlyAmount(source.amount, source.frequency),
    }));

    const totalMonthly = monthlyAmounts.reduce(
      (sum, s) => sum.plus(s.monthlyAmount),
      new Decimal(0),
    );

    // Group by type
    const byType = Object.values(
      monthlyAmounts.reduce(
        (acc, source) => {
          if (!acc[source.type]) {
            acc[source.type] = { type: source.type, amount: new Decimal(0) };
          }
          acc[source.type].amount = acc[source.type].amount.plus(source.monthlyAmount);
          return acc;
        },
        {} as Record<string, { type: string; amount: Decimal }>,
      ),
    ).map((item) => ({
      type: item.type,
      amount: item.amount.toNumber(),
      percentage: totalMonthly.isZero()
        ? 0
        : item.amount.dividedBy(totalMonthly).times(100).toNumber(),
    }));

    return {
      totalMonthly: totalMonthly.toNumber(),
      byType,
      activeCount: incomeSources.length,
    };
  }

  /**
   * Convert any frequency to monthly equivalent
   */
  toMonthlyAmount(amount: Decimal | number, frequency: Frequency): Decimal {
    const value = new Decimal(amount);

    switch (frequency) {
      case Frequency.DAILY:
        return value.times(30);
      case Frequency.WEEKLY:
        return value.times(4.33);
      case Frequency.BIWEEKLY:
        return value.times(2.17);
      case Frequency.MONTHLY:
        return value;
      case Frequency.QUARTERLY:
        return value.dividedBy(3);
      case Frequency.ANNUALLY:
        return value.dividedBy(12);
      case Frequency.ONE_TIME:
        return new Decimal(0); // One-time doesn't contribute to monthly
      default:
        return value;
    }
  }

  /**
   * Get total monthly income for a user (for financial calculations)
   */
  async getTotalMonthlyIncome(userId: string): Promise<Decimal> {
    const incomeSources = await this.prisma.incomeSource.findMany({
      where: { userId, isActive: true },
    });

    return incomeSources.reduce(
      (sum, source) => sum.plus(this.toMonthlyAmount(source.amount, source.frequency)),
      new Decimal(0),
    );
  }
}
```

### Step 3: Income Controller

```typescript
// apps/api/src/modules/income/income.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IncomeService } from './income.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('active') active?: string,
  ) {
    const activeFilter = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.incomeService.findAll(userId, activeFilter);
  }

  @Get('summary')
  async getSummary(@CurrentUser('id') userId: string) {
    return this.incomeService.getSummary(userId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.incomeService.findById(userId, id);
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateIncomeDto,
  ) {
    return this.incomeService.create(userId, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIncomeDto,
  ) {
    return this.incomeService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.incomeService.delete(userId, id);
    return { message: 'Income source deleted' };
  }
}
```

### Step 4: Income Module

```typescript
// apps/api/src/modules/income/income.module.ts

import { Module } from '@nestjs/common';
import { IncomeController } from './income.controller';
import { IncomeService } from './income.service';

@Module({
  controllers: [IncomeController],
  providers: [IncomeService],
  exports: [IncomeService],
})
export class IncomeModule {}
```

---

## UI/UX Specifications

### Income List Screen

```
┌─────────────────────────────────────────┐
│ ← Income Sources                    +   │
├─────────────────────────────────────────┤
│                                         │
│  Total Monthly Income                   │
│  ┌─────────────────────────────────┐   │
│  │         ₦850,000                 │   │
│  │      from 3 sources              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 💼 Tech Solutions Ltd            │   │
│  │    Salary • Monthly              │   │
│  │    ₦650,000                  ●   │   │
│  ├─────────────────────────────────┤   │
│  │ 💻 Freelance Projects            │   │
│  │    Freelance • Varies            │   │
│  │    ₦150,000 ±20%             ●   │   │
│  ├─────────────────────────────────┤   │
│  │ 📈 Stock Dividends               │   │
│  │    Investment • Quarterly        │   │
│  │    ₦50,000                   ●   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Income by Type                         │
│  ┌─────────────────────────────────┐   │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░ Salary 76%   │   │
│  │ ▓▓▓▓░░░░░░░░░░░░░░ Freelance 18%│   │
│  │ ▓░░░░░░░░░░░░░░░░░ Investment 6%│   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Add Income Form

```
┌─────────────────────────────────────────┐
│ ← Add Income Source                     │
├─────────────────────────────────────────┤
│                                         │
│  Income Name *                          │
│  ┌─────────────────────────────────┐   │
│  │  Tech Solutions Ltd              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Income Type *                          │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│  │ 💼 │ │ 💻 │ │ 🏢 │ │ 📈 │     │
│  │Salary│ │Free │ │Biz  │ │Invest│    │
│  └─────┘ └─────┘ └─────┘ └─────┘     │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│  │ 🏠 │ │ 👨‍👩‍👧 │ │ 🎁 │ │ ••• │     │
│  │Rental│ │Allow │ │Gift │ │Other│    │
│  └─────┘ └─────┘ └─────┘ └─────┘     │
│                                         │
│  Amount *                               │
│  ┌─────────────────────────────────┐   │
│  │  ₦ 650,000                       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Frequency *                            │
│  ┌─────────────────────────────────┐   │
│  │  Monthly                       ▼ │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ☐ This income varies                   │
│    (Show variance slider when checked)  │
│                                         │
│  Description (optional)                 │
│  ┌─────────────────────────────────┐   │
│  │  Senior Developer position       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │          Save Income             │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Income Type Icons & Colors

| Type | Icon | Color |
|------|------|-------|
| Salary | 💼 | `#3B82F6` (Blue) |
| Freelance | 💻 | `#8B5CF6` (Purple) |
| Business | 🏢 | `#10B981` (Green) |
| Investment | 📈 | `#F59E0B` (Amber) |
| Rental | 🏠 | `#EC4899` (Pink) |
| Allowance | 👨‍👩‍👧 | `#F97316` (Orange) |
| Gift | 🎁 | `#EF4444` (Red) |
| Other | ••• | `#6B7280` (Gray) |

---

## Variance Handling

For irregular income (freelance, business), the variance percentage indicates expected fluctuation:

```typescript
// Example: ₦150,000 with 20% variance
// Expected range: ₦120,000 - ₦180,000

interface IncomeWithVariance {
  amount: number;           // 150000
  variancePercentage: number; // 20
  minExpected: number;      // 120000
  maxExpected: number;      // 180000
  averageMonthly: number;   // 150000
}
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `decimal.js` | Precise decimal calculations |
| `class-validator` | Request validation |

---

## Next Steps

After income sources, proceed to:
1. [06-expense-management.md](./06-expense-management.md) - Expense tracking
2. [07-savings-assets.md](./07-savings-assets.md) - Savings management
