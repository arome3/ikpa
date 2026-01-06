# Debt Management

## Overview

This document covers Ikpa's debt tracking system, including bank loans, credit cards, Buy Now Pay Later (BNPL) services, personal loans, and cooperative loans. The system calculates interest, tracks payments, and provides payoff projections.

---

## Technical Specifications

### Prisma Schema

```prisma
// Already defined in schema.prisma

enum DebtType {
  BANK_LOAN
  CREDIT_CARD
  BNPL           // Buy Now Pay Later (Carbon, FairMoney, etc.)
  PERSONAL_LOAN  // Borrowed from friends/family
  COOPERATIVE    // Cooperative society loans
  OVERDRAFT
  SALARY_ADVANCE
  OTHER
}

model Debt {
  id               String       @id @default(cuid())
  userId           String
  user             User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  name             String
  type             DebtType
  lender           String?      // Bank name, app name, person's name
  principalAmount  Decimal      @db.Decimal(12, 2)
  currentBalance   Decimal      @db.Decimal(12, 2)
  currency         Currency     @default(NGN)
  interestRate     Decimal?     @db.Decimal(5, 2)  // Annual interest rate
  interestType     InterestType @default(FIXED)
  minimumPayment   Decimal?     @db.Decimal(12, 2)
  dueDate          Int?         // Day of month payment is due
  startDate        DateTime
  endDate          DateTime?
  isActive         Boolean      @default(true)
  notes            String?
  payments         DebtPayment[]
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@index([userId, isActive])
  @@index([userId, type])
}

enum InterestType {
  FIXED
  VARIABLE
  REDUCING_BALANCE
  FLAT_RATE
}

model DebtPayment {
  id          String   @id @default(cuid())
  debtId      String
  debt        Debt     @relation(fields: [debtId], references: [id], onDelete: Cascade)
  amount      Decimal  @db.Decimal(12, 2)
  principal   Decimal  @db.Decimal(12, 2)  // Amount applied to principal
  interest    Decimal  @db.Decimal(12, 2)  // Amount applied to interest
  date        DateTime
  notes       String?
  createdAt   DateTime @default(now())

  @@index([debtId, date])
}
```

---

## Module Structure

```
apps/api/src/modules/debts/
├── debts.module.ts
├── debts.controller.ts
├── debts.service.ts
├── payments/
│   ├── payments.controller.ts
│   └── payments.service.ts
├── calculators/
│   └── debt-calculator.service.ts
├── dto/
│   ├── create-debt.dto.ts
│   ├── update-debt.dto.ts
│   ├── create-payment.dto.ts
│   └── payoff-simulation.dto.ts
└── entities/
    ├── debt.entity.ts
    └── debt-payment.entity.ts
```

---

## DTOs

### Create Debt DTO

```typescript
// apps/api/src/modules/debts/dto/create-debt.dto.ts

import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Currency, DebtType, InterestType } from '@prisma/client';

export class CreateDebtDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(DebtType)
  type: DebtType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lender?: string;

  @IsNumber()
  @Min(0.01)
  principalAmount: number;

  @IsNumber()
  @Min(0)
  currentBalance: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate?: number;

  @IsOptional()
  @IsEnum(InterestType)
  interestType?: InterestType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumPayment?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDate?: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

### Update Debt DTO

```typescript
// apps/api/src/modules/debts/dto/update-debt.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateDebtDto } from './create-debt.dto';

export class UpdateDebtDto extends PartialType(CreateDebtDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

### Create Payment DTO

```typescript
// apps/api/src/modules/debts/dto/create-payment.dto.ts

import {
  IsNumber,
  IsDateString,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  principalPortion?: number; // If not provided, calculated automatically

  @IsOptional()
  @IsNumber()
  @Min(0)
  interestPortion?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

### Payoff Simulation DTO

```typescript
// apps/api/src/modules/debts/dto/payoff-simulation.dto.ts

import { IsNumber, IsOptional, Min, IsEnum } from 'class-validator';

export enum PayoffStrategy {
  MINIMUM_PAYMENTS = 'minimum_payments',
  DEBT_AVALANCHE = 'debt_avalanche',   // Highest interest first
  DEBT_SNOWBALL = 'debt_snowball',     // Smallest balance first
  CUSTOM = 'custom',
}

export class PayoffSimulationDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  extraMonthlyPayment?: number;

  @IsOptional()
  @IsEnum(PayoffStrategy)
  strategy?: PayoffStrategy;
}
```

---

## Service Implementation

### Debts Service

```typescript
// apps/api/src/modules/debts/debts.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DebtCalculatorService } from './calculators/debt-calculator.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { PayoffSimulationDto, PayoffStrategy } from './dto/payoff-simulation.dto';
import { DebtType } from '@prisma/client';

@Injectable()
export class DebtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: DebtCalculatorService,
  ) {}

  async create(userId: string, dto: CreateDebtDto) {
    return this.prisma.debt.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        lender: dto.lender,
        principalAmount: dto.principalAmount,
        currentBalance: dto.currentBalance,
        currency: dto.currency,
        interestRate: dto.interestRate,
        interestType: dto.interestType,
        minimumPayment: dto.minimumPayment,
        dueDate: dto.dueDate,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notes: dto.notes,
      },
    });
  }

  async findAll(userId: string, includeInactive = false) {
    return this.prisma.debt.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { currentBalance: 'desc' },
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });
  }

  async findByType(userId: string, type: DebtType) {
    return this.prisma.debt.findMany({
      where: { userId, type, isActive: true },
      orderBy: { currentBalance: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const debt = await this.prisma.debt.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });

    if (!debt) {
      throw new NotFoundException('Debt not found');
    }

    if (debt.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return debt;
  }

  async update(userId: string, id: string, dto: UpdateDebtDto) {
    await this.findOne(userId, id);

    return this.prisma.debt.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.type && { type: dto.type }),
        ...(dto.lender !== undefined && { lender: dto.lender }),
        ...(dto.principalAmount !== undefined && { principalAmount: dto.principalAmount }),
        ...(dto.currentBalance !== undefined && { currentBalance: dto.currentBalance }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.interestRate !== undefined && { interestRate: dto.interestRate }),
        ...(dto.interestType && { interestType: dto.interestType }),
        ...(dto.minimumPayment !== undefined && { minimumPayment: dto.minimumPayment }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.debt.delete({ where: { id } });

    return { message: 'Debt deleted successfully' };
  }

  // Summary & Analytics
  async getDebtSummary(userId: string) {
    const debts = await this.prisma.debt.findMany({
      where: { userId, isActive: true },
    });

    const summary = debts.reduce(
      (acc, debt) => {
        const balance = Number(debt.currentBalance);
        const principal = Number(debt.principalAmount);
        const rate = Number(debt.interestRate ?? 0);

        acc.totalDebt += balance;
        acc.totalPrincipal += principal;
        acc.totalPaid += principal - balance;

        // Weight by balance for average interest rate
        acc.weightedInterest += rate * balance;

        // Group by type
        const type = debt.type;
        if (!acc.byType[type]) {
          acc.byType[type] = { type, total: 0, count: 0 };
        }
        acc.byType[type].total += balance;
        acc.byType[type].count += 1;

        return acc;
      },
      {
        totalDebt: 0,
        totalPrincipal: 0,
        totalPaid: 0,
        weightedInterest: 0,
        byType: {} as Record<DebtType, { type: DebtType; total: number; count: number }>,
      }
    );

    const averageInterestRate =
      summary.totalDebt > 0
        ? summary.weightedInterest / summary.totalDebt
        : 0;

    return {
      totalDebt: summary.totalDebt,
      totalPrincipal: summary.totalPrincipal,
      totalPaid: summary.totalPaid,
      payoffProgress:
        summary.totalPrincipal > 0
          ? (summary.totalPaid / summary.totalPrincipal) * 100
          : 0,
      debtCount: debts.length,
      averageInterestRate: Math.round(averageInterestRate * 100) / 100,
      byType: Object.values(summary.byType).sort((a, b) => b.total - a.total),
    };
  }

  async getMonthlyPaymentObligation(userId: string) {
    const debts = await this.prisma.debt.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        name: true,
        minimumPayment: true,
        dueDate: true,
        currentBalance: true,
      },
    });

    const obligations = debts
      .filter((d) => d.minimumPayment && Number(d.minimumPayment) > 0)
      .map((d) => ({
        debtId: d.id,
        name: d.name,
        amount: Number(d.minimumPayment),
        dueDate: d.dueDate,
        balance: Number(d.currentBalance),
      }));

    const totalMonthly = obligations.reduce((sum, o) => sum + o.amount, 0);

    return {
      totalMonthlyPayment: totalMonthly,
      obligations: obligations.sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0)),
    };
  }

  async simulatePayoff(userId: string, dto: PayoffSimulationDto) {
    const debts = await this.prisma.debt.findMany({
      where: { userId, isActive: true },
    });

    return this.calculator.simulatePayoff(
      debts,
      dto.extraMonthlyPayment ?? 0,
      dto.strategy ?? PayoffStrategy.MINIMUM_PAYMENTS,
    );
  }

  async getUpcomingPayments(userId: string, days = 30) {
    const today = new Date();
    const currentDay = today.getDate();

    const debts = await this.prisma.debt.findMany({
      where: {
        userId,
        isActive: true,
        dueDate: { not: null },
      },
      select: {
        id: true,
        name: true,
        minimumPayment: true,
        dueDate: true,
        lender: true,
      },
    });

    return debts
      .map((debt) => {
        const dueDay = debt.dueDate!;
        let nextDueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);

        // If the due date has passed this month, move to next month
        if (dueDay < currentDay) {
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        }

        const daysUntilDue = Math.ceil(
          (nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          debtId: debt.id,
          name: debt.name,
          lender: debt.lender,
          amount: Number(debt.minimumPayment),
          dueDate: nextDueDate,
          daysUntilDue,
        };
      })
      .filter((p) => p.daysUntilDue <= days)
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }
}
```

### Debt Calculator Service

```typescript
// apps/api/src/modules/debts/calculators/debt-calculator.service.ts

import { Injectable } from '@nestjs/common';
import { Debt, InterestType } from '@prisma/client';
import { PayoffStrategy } from '../dto/payoff-simulation.dto';

interface PayoffProjection {
  debtId: string;
  name: string;
  initialBalance: number;
  monthlyPayment: number;
  payoffDate: Date;
  monthsToPayoff: number;
  totalInterestPaid: number;
  totalPaid: number;
}

interface SimulationResult {
  strategy: PayoffStrategy;
  extraMonthlyPayment: number;
  projections: PayoffProjection[];
  totalMonthsToDebtFree: number;
  totalInterestPaid: number;
  totalPaid: number;
  monthsSaved: number; // Compared to minimum payments
  interestSaved: number;
}

@Injectable()
export class DebtCalculatorService {
  calculateMonthlyInterest(
    balance: number,
    annualRate: number,
    interestType: InterestType,
  ): number {
    if (annualRate === 0) return 0;

    switch (interestType) {
      case InterestType.REDUCING_BALANCE:
        // Interest calculated on remaining balance
        return balance * (annualRate / 100 / 12);

      case InterestType.FLAT_RATE:
        // Interest calculated on original principal (already factored into payments)
        return 0;

      case InterestType.FIXED:
      case InterestType.VARIABLE:
      default:
        // Standard monthly interest
        return balance * (annualRate / 100 / 12);
    }
  }

  calculatePayoffMonths(
    balance: number,
    monthlyPayment: number,
    annualRate: number,
    interestType: InterestType,
  ): { months: number; totalInterest: number } {
    if (monthlyPayment <= 0) {
      return { months: Infinity, totalInterest: Infinity };
    }

    let remaining = balance;
    let months = 0;
    let totalInterest = 0;
    const maxMonths = 360; // 30 years cap

    while (remaining > 0 && months < maxMonths) {
      const monthlyInterest = this.calculateMonthlyInterest(
        remaining,
        annualRate,
        interestType,
      );
      totalInterest += monthlyInterest;

      const principalPayment = Math.min(
        monthlyPayment - monthlyInterest,
        remaining,
      );

      if (principalPayment <= 0) {
        // Payment doesn't cover interest - debt will never be paid off
        return { months: Infinity, totalInterest: Infinity };
      }

      remaining -= principalPayment;
      months++;
    }

    return { months, totalInterest };
  }

  simulatePayoff(
    debts: Debt[],
    extraMonthlyPayment: number,
    strategy: PayoffStrategy,
  ): SimulationResult {
    const activeDebts = debts.filter((d) => Number(d.currentBalance) > 0);

    if (activeDebts.length === 0) {
      return {
        strategy,
        extraMonthlyPayment,
        projections: [],
        totalMonthsToDebtFree: 0,
        totalInterestPaid: 0,
        totalPaid: 0,
        monthsSaved: 0,
        interestSaved: 0,
      };
    }

    // Sort debts based on strategy
    const sortedDebts = this.sortDebtsByStrategy(activeDebts, strategy);

    // Calculate baseline (minimum payments only)
    const baselineResult = this.runSimulation(activeDebts, 0);

    // Calculate with extra payment
    const projections = this.runSimulation(sortedDebts, extraMonthlyPayment);

    const totalMonths = Math.max(...projections.map((p) => p.monthsToPayoff));
    const baselineTotalMonths = Math.max(...baselineResult.map((p) => p.monthsToPayoff));

    const totalInterest = projections.reduce((sum, p) => sum + p.totalInterestPaid, 0);
    const baselineTotalInterest = baselineResult.reduce(
      (sum, p) => sum + p.totalInterestPaid,
      0,
    );

    const totalPaid = projections.reduce((sum, p) => sum + p.totalPaid, 0);

    return {
      strategy,
      extraMonthlyPayment,
      projections,
      totalMonthsToDebtFree: totalMonths,
      totalInterestPaid: Math.round(totalInterest * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      monthsSaved: baselineTotalMonths - totalMonths,
      interestSaved: Math.round((baselineTotalInterest - totalInterest) * 100) / 100,
    };
  }

  private sortDebtsByStrategy(debts: Debt[], strategy: PayoffStrategy): Debt[] {
    switch (strategy) {
      case PayoffStrategy.DEBT_AVALANCHE:
        // Highest interest rate first
        return [...debts].sort(
          (a, b) => Number(b.interestRate ?? 0) - Number(a.interestRate ?? 0),
        );

      case PayoffStrategy.DEBT_SNOWBALL:
        // Smallest balance first
        return [...debts].sort(
          (a, b) => Number(a.currentBalance) - Number(b.currentBalance),
        );

      case PayoffStrategy.MINIMUM_PAYMENTS:
      case PayoffStrategy.CUSTOM:
      default:
        return debts;
    }
  }

  private runSimulation(
    debts: Debt[],
    extraMonthlyPayment: number,
  ): PayoffProjection[] {
    const debtStates = debts.map((debt) => ({
      debt,
      balance: Number(debt.currentBalance),
      monthlyPayment: Number(debt.minimumPayment ?? 0),
      totalInterestPaid: 0,
      totalPaid: 0,
      monthsToPayoff: 0,
      isPaidOff: false,
    }));

    const today = new Date();
    let month = 0;
    let availableExtra = extraMonthlyPayment;
    const maxMonths = 360;

    while (
      debtStates.some((s) => !s.isPaidOff) &&
      month < maxMonths
    ) {
      month++;

      // Reset extra payment each month
      let extraThisMonth = availableExtra;

      for (const state of debtStates) {
        if (state.isPaidOff) continue;

        // Calculate interest
        const interest = this.calculateMonthlyInterest(
          state.balance,
          Number(state.debt.interestRate ?? 0),
          state.debt.interestType,
        );
        state.totalInterestPaid += interest;

        // Apply regular payment
        let payment = state.monthlyPayment;

        // Add extra payment to first non-paid-off debt (debt avalanche/snowball effect)
        if (extraThisMonth > 0 && state === debtStates.find((s) => !s.isPaidOff)) {
          payment += extraThisMonth;
          extraThisMonth = 0;
        }

        // Apply payment
        const principalPayment = Math.min(payment - interest, state.balance);
        state.balance -= principalPayment;
        state.totalPaid += payment;

        if (state.balance <= 0) {
          state.balance = 0;
          state.isPaidOff = true;
          state.monthsToPayoff = month;

          // Free up this debt's minimum payment for other debts
          availableExtra += state.monthlyPayment;
        }
      }
    }

    // Set months for any debts not paid off
    debtStates
      .filter((s) => !s.isPaidOff)
      .forEach((s) => {
        s.monthsToPayoff = maxMonths;
      });

    return debtStates.map((state) => {
      const payoffDate = new Date(today);
      payoffDate.setMonth(payoffDate.getMonth() + state.monthsToPayoff);

      return {
        debtId: state.debt.id,
        name: state.debt.name,
        initialBalance: Number(state.debt.currentBalance),
        monthlyPayment: state.monthlyPayment,
        payoffDate,
        monthsToPayoff: state.monthsToPayoff,
        totalInterestPaid: Math.round(state.totalInterestPaid * 100) / 100,
        totalPaid: Math.round(state.totalPaid * 100) / 100,
      };
    });
  }
}
```

### Payments Service

```typescript
// apps/api/src/modules/debts/payments/payments.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DebtCalculatorService } from '../calculators/debt-calculator.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: DebtCalculatorService,
  ) {}

  async create(userId: string, debtId: string, dto: CreatePaymentDto) {
    const debt = await this.validateDebtOwnership(userId, debtId);

    // Calculate interest and principal portions if not provided
    let principal = dto.principalPortion ?? 0;
    let interest = dto.interestPortion ?? 0;

    if (dto.principalPortion === undefined && dto.interestPortion === undefined) {
      // Auto-calculate based on debt terms
      const monthlyInterest = this.calculator.calculateMonthlyInterest(
        Number(debt.currentBalance),
        Number(debt.interestRate ?? 0),
        debt.interestType,
      );

      interest = Math.min(monthlyInterest, dto.amount);
      principal = dto.amount - interest;
    }

    // Validate payment doesn't exceed balance
    const newBalance = Number(debt.currentBalance) - principal;
    if (newBalance < 0) {
      throw new BadRequestException('Payment exceeds remaining balance');
    }

    // Create payment and update balance in transaction
    const [payment] = await this.prisma.$transaction([
      this.prisma.debtPayment.create({
        data: {
          debtId,
          amount: dto.amount,
          principal,
          interest,
          date: new Date(dto.date),
          notes: dto.notes,
        },
      }),
      this.prisma.debt.update({
        where: { id: debtId },
        data: {
          currentBalance: { decrement: principal },
          // Mark as inactive if paid off
          ...(newBalance === 0 && { isActive: false }),
        },
      }),
    ]);

    return {
      payment,
      newBalance,
      isPaidOff: newBalance === 0,
    };
  }

  async findAll(userId: string, debtId: string, page = 1, limit = 20) {
    await this.validateDebtOwnership(userId, debtId);

    const [payments, total] = await Promise.all([
      this.prisma.debtPayment.findMany({
        where: { debtId },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.debtPayment.count({ where: { debtId } }),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentHistory(userId: string, debtId: string) {
    await this.validateDebtOwnership(userId, debtId);

    const payments = await this.prisma.debtPayment.findMany({
      where: { debtId },
      orderBy: { date: 'asc' },
    });

    const summary = payments.reduce(
      (acc, payment) => {
        acc.totalPaid += Number(payment.amount);
        acc.totalPrincipal += Number(payment.principal);
        acc.totalInterest += Number(payment.interest);
        return acc;
      },
      { totalPaid: 0, totalPrincipal: 0, totalInterest: 0 },
    );

    return {
      paymentCount: payments.length,
      ...summary,
      payments,
    };
  }

  async remove(userId: string, debtId: string, paymentId: string) {
    const debt = await this.validateDebtOwnership(userId, debtId);

    const payment = await this.prisma.debtPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.debtId !== debtId) {
      throw new NotFoundException('Payment not found');
    }

    // Restore the balance
    await this.prisma.$transaction([
      this.prisma.debtPayment.delete({ where: { id: paymentId } }),
      this.prisma.debt.update({
        where: { id: debtId },
        data: {
          currentBalance: { increment: Number(payment.principal) },
          isActive: true, // Reactivate if it was paid off
        },
      }),
    ]);

    return { message: 'Payment deleted successfully' };
  }

  private async validateDebtOwnership(userId: string, debtId: string) {
    const debt = await this.prisma.debt.findUnique({
      where: { id: debtId },
    });

    if (!debt) {
      throw new NotFoundException('Debt not found');
    }

    if (debt.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return debt;
  }
}
```

---

## Controller Implementation

### Debts Controller

```typescript
// apps/api/src/modules/debts/debts.controller.ts

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
import { DebtsService } from './debts.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { PayoffSimulationDto } from './dto/payoff-simulation.dto';
import { DebtType } from '@prisma/client';

@Controller('debts')
@UseGuards(JwtAuthGuard)
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateDebtDto) {
    return this.debtsService.create(userId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.debtsService.findAll(userId, includeInactive === 'true');
  }

  @Get('summary')
  getSummary(@CurrentUser('id') userId: string) {
    return this.debtsService.getDebtSummary(userId);
  }

  @Get('monthly-obligations')
  getMonthlyObligations(@CurrentUser('id') userId: string) {
    return this.debtsService.getMonthlyPaymentObligation(userId);
  }

  @Get('upcoming-payments')
  getUpcomingPayments(
    @CurrentUser('id') userId: string,
    @Query('days') days?: number,
  ) {
    return this.debtsService.getUpcomingPayments(userId, days);
  }

  @Post('simulate-payoff')
  simulatePayoff(
    @CurrentUser('id') userId: string,
    @Body() dto: PayoffSimulationDto,
  ) {
    return this.debtsService.simulatePayoff(userId, dto);
  }

  @Get('type/:type')
  findByType(
    @CurrentUser('id') userId: string,
    @Param('type') type: DebtType,
  ) {
    return this.debtsService.findByType(userId, type);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.debtsService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDebtDto,
  ) {
    return this.debtsService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.debtsService.remove(userId, id);
  }
}
```

### Payments Controller

```typescript
// apps/api/src/modules/debts/payments/payments.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';

@Controller('debts/:debtId/payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Param('debtId') debtId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(userId, debtId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Param('debtId') debtId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.paymentsService.findAll(userId, debtId, page, limit);
  }

  @Get('history')
  getHistory(
    @CurrentUser('id') userId: string,
    @Param('debtId') debtId: string,
  ) {
    return this.paymentsService.getPaymentHistory(userId, debtId);
  }

  @Delete(':id')
  remove(
    @CurrentUser('id') userId: string,
    @Param('debtId') debtId: string,
    @Param('id') id: string,
  ) {
    return this.paymentsService.remove(userId, debtId, id);
  }
}
```

---

## API Endpoints

### Debt Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/debts` | Create debt |
| GET | `/debts` | List all debts |
| GET | `/debts/summary` | Get debt summary |
| GET | `/debts/monthly-obligations` | Monthly payment requirements |
| GET | `/debts/upcoming-payments` | Payments due soon |
| POST | `/debts/simulate-payoff` | Simulate payoff strategies |
| GET | `/debts/type/:type` | Get debts by type |
| GET | `/debts/:id` | Get single debt |
| PATCH | `/debts/:id` | Update debt |
| DELETE | `/debts/:id` | Delete debt |

### Payment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/debts/:debtId/payments` | Record payment |
| GET | `/debts/:debtId/payments` | List payments |
| GET | `/debts/:debtId/payments/history` | Payment history with totals |
| DELETE | `/debts/:debtId/payments/:id` | Delete payment |

---

## UI Components

### Debt Card

```tsx
// Mobile: apps/mobile/src/components/debts/DebtCard.tsx

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Debt } from '../../types';
import { formatCurrency, formatPercentage } from '../../utils/format';

const TYPE_ICONS = {
  BANK_LOAN: { icon: 'building', color: '#3B82F6' },
  CREDIT_CARD: { icon: 'credit-card', color: '#EF4444' },
  BNPL: { icon: 'smartphone', color: '#F59E0B' },
  PERSONAL_LOAN: { icon: 'users', color: '#10B981' },
  COOPERATIVE: { icon: 'briefcase', color: '#8B5CF6' },
  OVERDRAFT: { icon: 'minus-circle', color: '#EC4899' },
  SALARY_ADVANCE: { icon: 'calendar', color: '#6366F1' },
  OTHER: { icon: 'help-circle', color: '#6B7280' },
};

interface DebtCardProps {
  debt: Debt;
  onPress: () => void;
}

export function DebtCard({ debt, onPress }: DebtCardProps) {
  const config = TYPE_ICONS[debt.type];
  const progress = ((Number(debt.principalAmount) - Number(debt.currentBalance)) /
    Number(debt.principalAmount)) * 100;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: config.color }]}>
          <Text style={styles.iconText}>{config.icon[0].toUpperCase()}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name}>{debt.name}</Text>
          <Text style={styles.lender}>
            {debt.lender ?? debt.type.replace('_', ' ')}
          </Text>
        </View>
        {debt.interestRate && (
          <View style={styles.rateBadge}>
            <Text style={styles.rateText}>
              {formatPercentage(Number(debt.interestRate))} APR
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.balance}>
        {formatCurrency(Number(debt.currentBalance), debt.currency)}
      </Text>
      <Text style={styles.original}>
        of {formatCurrency(Number(debt.principalAmount), debt.currency)}
      </Text>

      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%`, backgroundColor: '#10B981' },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {Math.round(progress)}% paid off
        </Text>
      </View>

      {debt.minimumPayment && debt.dueDate && (
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentLabel}>Next payment:</Text>
          <Text style={styles.paymentAmount}>
            {formatCurrency(Number(debt.minimumPayment), debt.currency)} due on {debt.dueDate}th
          </Text>
        </View>
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
    marginBottom: 12,
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
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  lender: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  rateBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  balance: {
    fontSize: 28,
    fontWeight: '700',
    color: '#EF4444',
    fontFamily: 'JetBrains Mono',
  },
  original: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  progressSection: {
    marginTop: 16,
  },
  progressBar: {
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
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  },
  paymentInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  paymentAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
});
```

### Payoff Strategy Comparison

```tsx
// Mobile: apps/mobile/src/components/debts/PayoffComparison.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SimulationResult } from '../../types';
import { formatCurrency } from '../../utils/format';

interface PayoffComparisonProps {
  results: SimulationResult[];
  currency: string;
}

export function PayoffComparison({ results, currency }: PayoffComparisonProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payoff Strategies</Text>

      {results.map((result, index) => (
        <View key={result.strategy} style={styles.strategyCard}>
          <View style={styles.strategyHeader}>
            <Text style={styles.strategyName}>
              {formatStrategyName(result.strategy)}
            </Text>
            {index === 0 && (
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>Best</Text>
              </View>
            )}
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {result.totalMonthsToDebtFree}
              </Text>
              <Text style={styles.metricLabel}>Months</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {formatCurrency(result.totalInterestPaid, currency)}
              </Text>
              <Text style={styles.metricLabel}>Interest</Text>
            </View>
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: '#10B981' }]}>
                {formatCurrency(result.interestSaved, currency)}
              </Text>
              <Text style={styles.metricLabel}>Saved</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function formatStrategyName(strategy: string): string {
  return strategy
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  strategyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  strategyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  strategyName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  recommendedBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recommendedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'JetBrains Mono',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
});
```

---

## Key Capabilities

1. **Multi-Type Debt Tracking**: Bank loans, credit cards, BNPL, personal loans
2. **Interest Calculation**: Fixed, variable, reducing balance, flat rate
3. **Payment Recording**: Track principal vs interest portions
4. **Payoff Projections**: Calculate time and interest for payoff
5. **Strategy Comparison**: Compare avalanche vs snowball methods
6. **Payment Reminders**: Track upcoming due dates
7. **Monthly Obligations**: Total required monthly payments
8. **Progress Tracking**: Visual payoff progress

---

## Debt Payoff Strategies

### Debt Avalanche
Pay minimums on all debts, then put extra money toward the highest interest rate debt first. Mathematically optimal - saves the most interest.

### Debt Snowball
Pay minimums on all debts, then put extra money toward the smallest balance first. Provides psychological wins as debts are eliminated faster.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@nestjs/common` | Core NestJS decorators |
| `class-validator` | DTO validation |
| `@prisma/client` | Database ORM |

---

## Next Steps

After debt management, proceed to:
1. [09-family-support.md](./09-family-support.md) - Family financial obligations
