# Financial Metrics

## Overview

This document covers Ikpa's financial metrics engine - the core intelligence layer that calculates key financial health indicators. The Cash Flow Score is the signature metric, providing a 0-100 health score that users can understand at a glance. Additional metrics include savings rate, runway months, burn rate, dependency ratio, and net worth.

---

## Technical Specifications

### Core Metrics

| Metric | Description | Range |
|--------|-------------|-------|
| **Cash Flow Score** | Overall financial health | 0-100 |
| **Savings Rate** | (Income - Expenses) / Income | -100% to 100%+ |
| **Runway Months** | Liquid Savings / Monthly Expenses | 0-24+ months |
| **Burn Rate** | Monthly cash outflow | Currency amount |
| **Dependency Ratio** | Family Support / Income | 0-100% |
| **Net Worth** | Assets - Liabilities | Currency amount |

### Data Model

```prisma
model FinancialSnapshot {
  id              String   @id @default(uuid())
  userId          String
  date            DateTime @default(now())

  // Core metrics
  cashFlowScore   Int      // 0-100
  savingsRate     Decimal  @db.Decimal(5, 2)
  runwayMonths    Decimal  @db.Decimal(5, 2)
  burnRate        Decimal  @db.Decimal(15, 2)
  dependencyRatio Decimal  @db.Decimal(5, 2)

  // Totals
  netWorth        Decimal  @db.Decimal(15, 2)
  totalIncome     Decimal  @db.Decimal(15, 2)
  totalExpenses   Decimal  @db.Decimal(15, 2)
  totalSavings    Decimal  @db.Decimal(15, 2)
  totalDebt       Decimal  @db.Decimal(15, 2)
  totalAssets     Decimal  @db.Decimal(15, 2)
  totalSupport    Decimal  @db.Decimal(15, 2)

  currency        Currency @default(NGN)
  createdAt       DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, date])
}
```

### API Endpoints

```yaml
GET /v1/finance/snapshot:
  description: Get current financial snapshot
  response: FinancialSnapshot

GET /v1/finance/snapshot/history:
  query: { startDate?, endDate?, interval?: "day" | "week" | "month" }
  response: FinancialSnapshot[]

GET /v1/finance/metrics/:metric:
  params: { metric: "cash-flow" | "savings-rate" | "runway" | "dependency" | "net-worth" }
  response: {
    current: number,
    change: number,
    trend: "up" | "down" | "stable",
    history: { date, value }[],
    breakdown: object
  }
```

---

## Key Capabilities

- Real-time financial health scoring
- Historical snapshot tracking
- Trend analysis over time
- Metric breakdowns with explanations
- Automatic daily snapshot generation
- Multi-currency normalization

---

## Implementation Guide

### Step 1: Metrics Calculator Service

```typescript
// apps/api/src/modules/finance/calculators/metrics.calculator.ts

import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';

interface FinancialData {
  totalIncome: Decimal;
  totalExpenses: Decimal;
  totalSavings: Decimal;
  totalDebt: Decimal;
  totalAssets: Decimal;
  totalSupport: Decimal;
  incomeStability: number;      // 0-100 based on variance
  expenseVariance: number;      // Standard deviation of monthly expenses
  liquidSavings: Decimal;       // Easily accessible savings
}

interface ScoreBreakdown {
  savingsScore: number;
  runwayScore: number;
  debtScore: number;
  stabilityScore: number;
  controlScore: number;
}

@Injectable()
export class MetricsCalculator {
  /**
   * Cash Flow Health Score (0-100)
   *
   * Components:
   * - Savings rate (30%)
   * - Runway months (25%)
   * - Debt-to-income (20%)
   * - Income stability (15%)
   * - Expense control (10%)
   */
  calculateCashFlowScore(data: FinancialData): { score: number; breakdown: ScoreBreakdown } {
    const savingsRate = this.calculateSavingsRate(data.totalIncome, data.totalExpenses);

    const savingsScore = this.scoreSavingsRate(savingsRate);
    const runwayScore = this.scoreRunway(
      this.calculateRunway(data.liquidSavings, data.totalExpenses),
    );
    const debtScore = this.scoreDebtRatio(data.totalDebt, data.totalIncome);
    const stabilityScore = data.incomeStability;
    const controlScore = this.scoreExpenseControl(data.expenseVariance);

    const weightedScore =
      savingsScore * 0.30 +
      runwayScore * 0.25 +
      debtScore * 0.20 +
      stabilityScore * 0.15 +
      controlScore * 0.10;

    return {
      score: Math.round(Math.max(0, Math.min(100, weightedScore))),
      breakdown: {
        savingsScore,
        runwayScore,
        debtScore,
        stabilityScore,
        controlScore,
      },
    };
  }

  /**
   * Savings Rate = (Income - Expenses) / Income * 100
   */
  calculateSavingsRate(income: Decimal, expenses: Decimal): number {
    if (income.isZero()) return 0;
    return income.minus(expenses).dividedBy(income).times(100).toNumber();
  }

  /**
   * Runway = Liquid Savings / Monthly Expenses
   * Capped at 24 months for scoring purposes
   */
  calculateRunway(liquidSavings: Decimal, monthlyExpenses: Decimal): number {
    if (monthlyExpenses.isZero()) return 24;
    return Math.min(24, liquidSavings.dividedBy(monthlyExpenses).toNumber());
  }

  /**
   * Burn Rate = Total Monthly Expenses (including debt payments)
   */
  calculateBurnRate(expenses: Decimal, debtPayments: Decimal): Decimal {
    return expenses.plus(debtPayments);
  }

  /**
   * Dependency Ratio = Monthly Support / Monthly Income * 100
   */
  calculateDependencyRatio(monthlySupport: Decimal, monthlyIncome: Decimal): number {
    if (monthlyIncome.isZero()) return 0;
    return monthlySupport.dividedBy(monthlyIncome).times(100).toNumber();
  }

  /**
   * Net Worth = Assets - Liabilities
   */
  calculateNetWorth(
    totalSavings: Decimal,
    totalInvestments: Decimal,
    totalDebt: Decimal,
  ): Decimal {
    return totalSavings.plus(totalInvestments).minus(totalDebt);
  }

  // ========================
  // Scoring Functions
  // ========================

  private scoreSavingsRate(rate: number): number {
    if (rate >= 30) return 100;
    if (rate >= 25) return 90;
    if (rate >= 20) return 80;
    if (rate >= 15) return 65;
    if (rate >= 10) return 50;
    if (rate >= 5) return 35;
    if (rate > 0) return 20;
    if (rate === 0) return 10;
    return 0; // Negative savings rate
  }

  private scoreRunway(months: number): number {
    if (months >= 12) return 100;
    if (months >= 9) return 90;
    if (months >= 6) return 80;
    if (months >= 3) return 60;
    if (months >= 2) return 40;
    if (months >= 1) return 25;
    return 10;
  }

  private scoreDebtRatio(debt: Decimal, income: Decimal): number {
    if (income.isZero()) return 50;
    const ratio = debt.dividedBy(income).toNumber();

    if (ratio === 0) return 100;
    if (ratio < 0.1) return 95;
    if (ratio < 0.2) return 85;
    if (ratio < 0.3) return 70;
    if (ratio < 0.4) return 55;
    if (ratio < 0.5) return 40;
    if (ratio < 0.6) return 30;
    return 20;
  }

  private scoreExpenseControl(variance: number): number {
    // Lower variance = more controlled spending
    if (variance < 5) return 100;
    if (variance < 10) return 85;
    if (variance < 15) return 70;
    if (variance < 20) return 55;
    if (variance < 30) return 40;
    return 25;
  }

  /**
   * Calculate income stability based on variance percentages
   */
  calculateIncomeStability(incomeSources: { variancePercentage: number; amount: number }[]): number {
    if (incomeSources.length === 0) return 50;

    const totalAmount = incomeSources.reduce((sum, s) => sum + s.amount, 0);
    if (totalAmount === 0) return 50;

    // Weighted average of stability (100 - variance)
    const weightedStability = incomeSources.reduce((sum, source) => {
      const weight = source.amount / totalAmount;
      const stability = 100 - source.variancePercentage;
      return sum + stability * weight;
    }, 0);

    return Math.round(weightedStability);
  }
}
```

### Step 2: Finance Service

```typescript
// apps/api/src/modules/finance/finance.service.ts

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsCalculator } from './calculators/metrics.calculator';
import { IncomeService } from '../income/income.service';
import Decimal from 'decimal.js';
import { subMonths, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: MetricsCalculator,
    private readonly incomeService: IncomeService,
  ) {}

  async getCurrentSnapshot(userId: string) {
    // Get latest snapshot or calculate fresh
    const existing = await this.prisma.financialSnapshot.findFirst({
      where: {
        userId,
        date: {
          gte: startOfDay(new Date()),
          lte: endOfDay(new Date()),
        },
      },
      orderBy: { date: 'desc' },
    });

    if (existing) {
      return existing;
    }

    return this.calculateAndSaveSnapshot(userId);
  }

  async calculateAndSaveSnapshot(userId: string) {
    // Gather all financial data
    const [
      incomeSources,
      expenses,
      savingsAccounts,
      investments,
      debts,
      familySupport,
    ] = await Promise.all([
      this.prisma.incomeSource.findMany({ where: { userId, isActive: true } }),
      this.prisma.expense.findMany({
        where: {
          userId,
          date: { gte: subMonths(new Date(), 1) },
        },
      }),
      this.prisma.savingsAccount.findMany({ where: { userId, isActive: true } }),
      this.prisma.investment.findMany({ where: { userId, isActive: true } }),
      this.prisma.debt.findMany({ where: { userId, isActive: true } }),
      this.prisma.familySupport.findMany({ where: { userId, isActive: true } }),
    ]);

    // Calculate monthly totals
    const totalIncome = incomeSources.reduce(
      (sum, s) => sum.plus(this.incomeService.toMonthlyAmount(s.amount, s.frequency)),
      new Decimal(0),
    );

    const totalExpenses = expenses.reduce(
      (sum, e) => sum.plus(e.amount),
      new Decimal(0),
    );

    const totalSavings = savingsAccounts.reduce(
      (sum, s) => sum.plus(s.balance),
      new Decimal(0),
    );

    const totalInvestments = investments.reduce(
      (sum, i) => sum.plus(i.value),
      new Decimal(0),
    );

    const totalDebt = debts.reduce(
      (sum, d) => sum.plus(d.remainingBalance),
      new Decimal(0),
    );

    const totalSupport = familySupport.reduce(
      (sum, f) => sum.plus(this.incomeService.toMonthlyAmount(f.amount, f.frequency)),
      new Decimal(0),
    );

    // Calculate liquid savings (bank accounts + mobile money, not fixed deposits)
    const liquidSavings = savingsAccounts
      .filter((s) => ['BANK_ACCOUNT', 'MOBILE_MONEY', 'CASH'].includes(s.type))
      .reduce((sum, s) => sum.plus(s.balance), new Decimal(0));

    // Calculate income stability
    const incomeStability = this.calculator.calculateIncomeStability(
      incomeSources.map((s) => ({
        variancePercentage: s.variancePercentage,
        amount: Number(s.amount),
      })),
    );

    // Calculate expense variance (simplified)
    const expenseVariance = 10; // TODO: Calculate actual variance

    // Build financial data
    const financialData = {
      totalIncome,
      totalExpenses,
      totalSavings,
      totalDebt,
      totalAssets: totalSavings.plus(totalInvestments),
      totalSupport,
      incomeStability,
      expenseVariance,
      liquidSavings,
    };

    // Calculate metrics
    const { score: cashFlowScore } = this.calculator.calculateCashFlowScore(financialData);
    const savingsRate = this.calculator.calculateSavingsRate(totalIncome, totalExpenses);
    const runwayMonths = this.calculator.calculateRunway(liquidSavings, totalExpenses);
    const burnRate = this.calculator.calculateBurnRate(
      totalExpenses,
      debts.reduce((sum, d) => sum.plus(d.minimumPayment), new Decimal(0)),
    );
    const dependencyRatio = this.calculator.calculateDependencyRatio(totalSupport, totalIncome);
    const netWorth = this.calculator.calculateNetWorth(totalSavings, totalInvestments, totalDebt);

    // Get user's currency
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    // Save snapshot
    return this.prisma.financialSnapshot.create({
      data: {
        userId,
        cashFlowScore,
        savingsRate,
        runwayMonths,
        burnRate,
        dependencyRatio,
        netWorth,
        totalIncome,
        totalExpenses,
        totalSavings,
        totalDebt,
        totalAssets: totalSavings.plus(totalInvestments),
        totalSupport,
        currency: user?.currency || 'NGN',
      },
    });
  }

  async getSnapshotHistory(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    interval: 'day' | 'week' | 'month' = 'day',
  ) {
    const where = {
      userId,
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    };

    return this.prisma.financialSnapshot.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async getMetricDetail(userId: string, metric: string) {
    const current = await this.getCurrentSnapshot(userId);
    const history = await this.getSnapshotHistory(
      userId,
      subMonths(new Date(), 3),
    );

    const previousSnapshot = history.length > 1 ? history[history.length - 2] : null;

    let currentValue: number;
    let previousValue: number | null;

    switch (metric) {
      case 'cash-flow':
        currentValue = current.cashFlowScore;
        previousValue = previousSnapshot?.cashFlowScore || null;
        break;
      case 'savings-rate':
        currentValue = Number(current.savingsRate);
        previousValue = previousSnapshot ? Number(previousSnapshot.savingsRate) : null;
        break;
      case 'runway':
        currentValue = Number(current.runwayMonths);
        previousValue = previousSnapshot ? Number(previousSnapshot.runwayMonths) : null;
        break;
      case 'dependency':
        currentValue = Number(current.dependencyRatio);
        previousValue = previousSnapshot ? Number(previousSnapshot.dependencyRatio) : null;
        break;
      case 'net-worth':
        currentValue = Number(current.netWorth);
        previousValue = previousSnapshot ? Number(previousSnapshot.netWorth) : null;
        break;
      default:
        currentValue = 0;
        previousValue = null;
    }

    const change = previousValue !== null ? currentValue - previousValue : 0;
    const trend = change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'stable';

    return {
      current: currentValue,
      change,
      trend,
      history: history.map((s) => ({
        date: s.date,
        value: this.getMetricValue(s, metric),
      })),
    };
  }

  private getMetricValue(snapshot: any, metric: string): number {
    switch (metric) {
      case 'cash-flow':
        return snapshot.cashFlowScore;
      case 'savings-rate':
        return Number(snapshot.savingsRate);
      case 'runway':
        return Number(snapshot.runwayMonths);
      case 'dependency':
        return Number(snapshot.dependencyRatio);
      case 'net-worth':
        return Number(snapshot.netWorth);
      default:
        return 0;
    }
  }

  /**
   * Daily cron job to calculate snapshots for all active users
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateDailySnapshots() {
    const users = await this.prisma.user.findMany({
      where: { onboardingCompleted: true },
      select: { id: true },
    });

    for (const user of users) {
      try {
        await this.calculateAndSaveSnapshot(user.id);
      } catch (error) {
        console.error(`Failed to calculate snapshot for user ${user.id}:`, error);
      }
    }
  }
}
```

### Step 3: Finance Controller

```typescript
// apps/api/src/modules/finance/finance.controller.ts

import { Controller, Get, Query, Param } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('snapshot')
  async getSnapshot(@CurrentUser('id') userId: string) {
    return this.financeService.getCurrentSnapshot(userId);
  }

  @Get('snapshot/history')
  async getSnapshotHistory(
    @CurrentUser('id') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('interval') interval?: 'day' | 'week' | 'month',
  ) {
    return this.financeService.getSnapshotHistory(
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      interval,
    );
  }

  @Get('metrics/:metric')
  async getMetricDetail(
    @CurrentUser('id') userId: string,
    @Param('metric') metric: string,
  ) {
    return this.financeService.getMetricDetail(userId, metric);
  }
}
```

---

## UI/UX Specifications

### Cash Flow Score Display

```
┌─────────────────────────────────────────┐
│                                         │
│           ╭───────────────╮             │
│         ╱                   ╲           │
│        ╱    ▓▓▓▓▓▓▓░░░░░    ╲          │
│       │                       │         │
│        ╲         78          ╱          │
│         ╲                   ╱           │
│           ╰───────────────╯             │
│                                         │
│          Cash Flow Score                │
│          +5 from last month             │
│                                         │
│   🟢 Good (60-79): Room to improve      │
│                                         │
└─────────────────────────────────────────┘
```

### Score Color Ranges

| Range | Color | Label |
|-------|-------|-------|
| 80-100 | `#10B981` (Green) | Excellent |
| 60-79 | `#84CC16` (Lime) | Good |
| 40-59 | `#F59E0B` (Amber) | Fair |
| 20-39 | `#F97316` (Orange) | Needs Attention |
| 0-19 | `#EF4444` (Red) | Critical |

### Dashboard Metrics Grid

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ┌─────────────────┐  ┌─────────────────┐                 │
│  │     ₦850K       │  │      18%        │                 │
│  │  Total Income   │  │  Savings Rate   │                 │
│  │                 │  │     ↑ +2%       │                 │
│  └─────────────────┘  └─────────────────┘                 │
│                                                            │
│  ┌─────────────────┐  ┌─────────────────┐                 │
│  │    4.2 months   │  │      15%        │                 │
│  │     Runway      │  │ Dependency Ratio│                 │
│  │     ↓ -0.3      │  │                 │                 │
│  └─────────────────┘  └─────────────────┘                 │
│                                                            │
│  ┌───────────────────────────────────────┐                │
│  │            ₦2,450,000                 │                │
│  │             Net Worth                 │                │
│  │            ↑ +₦120,000               │                │
│  └───────────────────────────────────────┘                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Trend Indicators

| Trend | Icon | Color |
|-------|------|-------|
| Up (positive) | `↑` | `#10B981` |
| Down (negative) | `↓` | `#EF4444` |
| Stable | `→` | `#6B7280` |

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `decimal.js` | Precise decimal calculations |
| `date-fns` | Date manipulation |
| `@nestjs/schedule` | Cron job scheduling |

---

## Next Steps

After financial metrics, proceed to:
1. [11-pattern-detection.md](./11-pattern-detection.md) - Spending pattern analysis
2. [12-simulation-engine.md](./12-simulation-engine.md) - Future projections
