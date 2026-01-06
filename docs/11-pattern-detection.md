# Pattern Detection

## Overview

This document covers Ikpa's pattern detection system, which analyzes user financial behavior to identify spending patterns, anomalies, trends, and recurring transactions. These insights feed into the AI coach and help users understand their financial habits.

---

## Technical Specifications

### Pattern Types

```typescript
// apps/api/src/modules/patterns/types/pattern.types.ts

export enum PatternType {
  // Spending Patterns
  MONTH_END_SPIKE = 'month_end_spike',         // Increased spending at month end
  WEEKEND_SPENDER = 'weekend_spender',          // Higher weekend spending
  CATEGORY_TREND = 'category_trend',            // Rising/falling category spending
  IMPULSE_SPENDING = 'impulse_spending',        // Small frequent purchases

  // Income Patterns
  INCOME_IRREGULARITY = 'income_irregularity',  // Inconsistent income timing
  INCOME_DECLINE = 'income_decline',            // Decreasing income trend

  // Savings Patterns
  SAVINGS_DIPS = 'savings_dips',                // Withdrawing from savings often
  EMERGENCY_FUND_RAIDS = 'emergency_fund_raids', // Touching emergency fund

  // Recurring
  UNTRACKED_SUBSCRIPTION = 'untracked_subscription', // Detected recurring charge
  SUBSCRIPTION_CREEP = 'subscription_creep',    // Growing subscription costs

  // Anomalies
  UNUSUAL_EXPENSE = 'unusual_expense',          // Significantly higher than normal
  NEW_MERCHANT = 'new_merchant',                // First time spending here
  LOCATION_ANOMALY = 'location_anomaly',        // Spending in unusual place
}

export enum PatternSeverity {
  INFO = 'info',           // Informational
  ATTENTION = 'attention', // Worth noting
  WARNING = 'warning',     // Needs attention
  CRITICAL = 'critical',   // Urgent action needed
}

export interface DetectedPattern {
  type: PatternType;
  severity: PatternSeverity;
  title: string;
  description: string;
  data: Record<string, any>;
  confidence: number;      // 0-100
  detectedAt: Date;
  affectedPeriod: {
    start: Date;
    end: Date;
  };
  suggestedAction?: string;
  relatedTransactions?: string[]; // Transaction IDs
}
```

---

## Module Structure

```
apps/api/src/modules/patterns/
├── patterns.module.ts
├── patterns.controller.ts
├── patterns.service.ts
├── detectors/
│   ├── spending-pattern.detector.ts
│   ├── recurring-transaction.detector.ts
│   ├── anomaly.detector.ts
│   └── trend.detector.ts
├── analyzers/
│   ├── category-analyzer.ts
│   ├── time-series-analyzer.ts
│   └── merchant-analyzer.ts
├── types/
│   └── pattern.types.ts
└── entities/
    └── pattern.entity.ts
```

---

## Prisma Schema

```prisma
model DetectedPattern {
  id              String          @id @default(cuid())
  userId          String
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  type            String
  severity        String
  title           String
  description     String
  data            Json
  confidence      Int
  affectedStart   DateTime
  affectedEnd     DateTime
  suggestedAction String?
  isRead          Boolean         @default(false)
  isDismissed     Boolean         @default(false)
  createdAt       DateTime        @default(now())

  @@index([userId, createdAt])
  @@index([userId, type])
  @@index([userId, isRead])
}
```

---

## Detector Implementations

### Spending Pattern Detector

```typescript
// apps/api/src/modules/patterns/detectors/spending-pattern.detector.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DetectedPattern,
  PatternType,
  PatternSeverity,
} from '../types/pattern.types';

@Injectable()
export class SpendingPatternDetector {
  constructor(private readonly prisma: PrismaService) {}

  async detectMonthEndSpike(userId: string): Promise<DetectedPattern | null> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const day25 = new Date(now.getFullYear(), now.getMonth(), 25);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get expenses for current month
    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    // Split into before day 25 and after
    const beforeDay25 = expenses.filter((e) => e.date < day25);
    const afterDay25 = expenses.filter((e) => e.date >= day25);

    // Calculate daily averages
    const daysBeforeDay25 = 24;
    const daysAfterDay25 = endOfMonth.getDate() - 24;

    const avgBefore =
      beforeDay25.reduce((sum, e) => sum + Number(e.amount), 0) / daysBeforeDay25;
    const avgAfter =
      afterDay25.reduce((sum, e) => sum + Number(e.amount), 0) / daysAfterDay25;

    // Check if month-end spending is significantly higher (>50%)
    if (avgAfter > avgBefore * 1.5 && afterDay25.length > 3) {
      const percentIncrease = ((avgAfter - avgBefore) / avgBefore) * 100;

      return {
        type: PatternType.MONTH_END_SPIKE,
        severity:
          percentIncrease > 100
            ? PatternSeverity.WARNING
            : PatternSeverity.ATTENTION,
        title: 'Month-End Spending Spike',
        description: `Your spending increases by ${Math.round(percentIncrease)}% in the last week of the month.`,
        data: {
          averageBeforeDay25: Math.round(avgBefore),
          averageAfterDay25: Math.round(avgAfter),
          percentIncrease: Math.round(percentIncrease),
          transactionCount: afterDay25.length,
        },
        confidence: Math.min(90, 50 + afterDay25.length * 5),
        detectedAt: new Date(),
        affectedPeriod: { start: day25, end: endOfMonth },
        suggestedAction:
          'Consider spreading large purchases throughout the month to maintain consistent cash flow.',
        relatedTransactions: afterDay25.map((e) => e.id),
      };
    }

    return null;
  }

  async detectWeekendSpender(userId: string): Promise<DetectedPattern | null> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: { gte: threeMonthsAgo },
      },
    });

    // Separate weekend vs weekday
    const weekendExpenses = expenses.filter((e) => {
      const day = e.date.getDay();
      return day === 0 || day === 6;
    });
    const weekdayExpenses = expenses.filter((e) => {
      const day = e.date.getDay();
      return day !== 0 && day !== 6;
    });

    // Calculate per-day averages (2 weekend days vs 5 weekdays)
    const weekendDays = 2 * 13; // ~13 weeks in 3 months
    const weekdayDays = 5 * 13;

    const avgWeekend =
      weekendExpenses.reduce((sum, e) => sum + Number(e.amount), 0) / weekendDays;
    const avgWeekday =
      weekdayExpenses.reduce((sum, e) => sum + Number(e.amount), 0) / weekdayDays;

    if (avgWeekend > avgWeekday * 1.3 && weekendExpenses.length > 10) {
      const percentHigher = ((avgWeekend - avgWeekday) / avgWeekday) * 100;

      return {
        type: PatternType.WEEKEND_SPENDER,
        severity: PatternSeverity.INFO,
        title: 'Weekend Spending Pattern',
        description: `You spend ${Math.round(percentHigher)}% more per day on weekends than weekdays.`,
        data: {
          averageWeekendDaily: Math.round(avgWeekend),
          averageWeekdayDaily: Math.round(avgWeekday),
          weekendTotal: weekendExpenses.reduce(
            (sum, e) => sum + Number(e.amount),
            0,
          ),
        },
        confidence: Math.min(85, 50 + weekendExpenses.length),
        detectedAt: new Date(),
        affectedPeriod: { start: threeMonthsAgo, end: new Date() },
        suggestedAction:
          'Weekend spending is common, but consider planning weekend activities to avoid impulse purchases.',
      };
    }

    return null;
  }

  async detectImpulseSpending(userId: string): Promise<DetectedPattern | null> {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Find small, frequent expenses in entertainment/shopping categories
    const smallExpenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: { gte: lastMonth },
        amount: { lt: 5000 }, // Under ₦5,000
        category: {
          name: { in: ['Entertainment', 'Shopping', 'Food & Dining'] },
        },
      },
      include: { category: true },
    });

    // Group by day to find days with multiple small purchases
    const byDay = smallExpenses.reduce((acc, exp) => {
      const day = exp.date.toISOString().split('T')[0];
      if (!acc[day]) acc[day] = [];
      acc[day].push(exp);
      return acc;
    }, {} as Record<string, typeof smallExpenses>);

    const impulseDays = Object.entries(byDay).filter(
      ([_, expenses]) => expenses.length >= 3,
    );

    if (impulseDays.length >= 5) {
      const totalImpulse = impulseDays.reduce(
        (sum, [_, expenses]) =>
          sum + expenses.reduce((s, e) => s + Number(e.amount), 0),
        0,
      );

      return {
        type: PatternType.IMPULSE_SPENDING,
        severity: PatternSeverity.ATTENTION,
        title: 'Impulse Spending Pattern',
        description: `You had ${impulseDays.length} days with 3+ small purchases last month, totaling ₦${totalImpulse.toLocaleString()}.`,
        data: {
          impulseDayCount: impulseDays.length,
          totalAmount: totalImpulse,
          averagePerIncident:
            totalImpulse / impulseDays.reduce((c, [_, e]) => c + e.length, 0),
        },
        confidence: Math.min(80, 40 + impulseDays.length * 5),
        detectedAt: new Date(),
        affectedPeriod: { start: lastMonth, end: new Date() },
        suggestedAction:
          'Small purchases add up. Consider a 24-hour rule before non-essential purchases.',
      };
    }

    return null;
  }
}
```

### Recurring Transaction Detector

```typescript
// apps/api/src/modules/patterns/detectors/recurring-transaction.detector.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DetectedPattern,
  PatternType,
  PatternSeverity,
} from '../types/pattern.types';

interface PotentialSubscription {
  merchant: string;
  amount: number;
  occurrences: Date[];
  averageInterval: number; // days
  isMonthly: boolean;
}

@Injectable()
export class RecurringTransactionDetector {
  constructor(private readonly prisma: PrismaService) {}

  async detectUntrackedSubscriptions(
    userId: string,
  ): Promise<DetectedPattern[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: { gte: sixMonthsAgo },
        merchant: { not: null },
        isRecurring: false, // Not already marked as recurring
      },
    });

    // Group by merchant + similar amount
    const merchantGroups = this.groupByMerchantAndAmount(expenses);

    // Find potential subscriptions (3+ occurrences, regular interval)
    const potentialSubs = this.findPotentialSubscriptions(merchantGroups);

    return potentialSubs.map((sub) => ({
      type: PatternType.UNTRACKED_SUBSCRIPTION,
      severity: PatternSeverity.INFO,
      title: 'Potential Subscription Detected',
      description: `"${sub.merchant}" charges ₦${sub.amount.toLocaleString()} ${sub.isMonthly ? 'monthly' : `every ~${Math.round(sub.averageInterval)} days`}.`,
      data: {
        merchant: sub.merchant,
        amount: sub.amount,
        occurrences: sub.occurrences.length,
        averageInterval: Math.round(sub.averageInterval),
        isMonthly: sub.isMonthly,
        dates: sub.occurrences.map((d) => d.toISOString()),
      },
      confidence: Math.min(95, 60 + sub.occurrences.length * 8),
      detectedAt: new Date(),
      affectedPeriod: {
        start: sub.occurrences[0],
        end: sub.occurrences[sub.occurrences.length - 1],
      },
      suggestedAction:
        'Consider marking this as a recurring expense to better track your subscriptions.',
    }));
  }

  async detectSubscriptionCreep(userId: string): Promise<DetectedPattern | null> {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Get recurring expenses grouped by period
    const recentRecurring = await this.prisma.expense.findMany({
      where: {
        userId,
        isRecurring: true,
        date: { gte: sixMonthsAgo },
      },
    });

    const olderRecurring = await this.prisma.expense.findMany({
      where: {
        userId,
        isRecurring: true,
        date: { gte: oneYearAgo, lt: sixMonthsAgo },
      },
    });

    // Calculate monthly averages
    const recentMonthly = this.calculateMonthlyAverage(recentRecurring, 6);
    const olderMonthly = this.calculateMonthlyAverage(olderRecurring, 6);

    if (olderMonthly > 0 && recentMonthly > olderMonthly * 1.2) {
      const increase = recentMonthly - olderMonthly;
      const percentIncrease = (increase / olderMonthly) * 100;

      return {
        type: PatternType.SUBSCRIPTION_CREEP,
        severity: PatternSeverity.ATTENTION,
        title: 'Subscription Costs Rising',
        description: `Your recurring expenses have increased by ${Math.round(percentIncrease)}% (₦${Math.round(increase).toLocaleString()}/month) in the last 6 months.`,
        data: {
          previousMonthlyAverage: Math.round(olderMonthly),
          currentMonthlyAverage: Math.round(recentMonthly),
          monthlyIncrease: Math.round(increase),
          percentIncrease: Math.round(percentIncrease),
        },
        confidence: 75,
        detectedAt: new Date(),
        affectedPeriod: { start: sixMonthsAgo, end: now },
        suggestedAction:
          'Review your subscriptions and cancel any you no longer use regularly.',
      };
    }

    return null;
  }

  private groupByMerchantAndAmount(
    expenses: Array<{ merchant: string | null; amount: any; date: Date }>,
  ) {
    const groups: Record<
      string,
      Array<{ amount: number; date: Date }>
    > = {};

    for (const exp of expenses) {
      if (!exp.merchant) continue;

      const key = exp.merchant.toLowerCase().trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        amount: Number(exp.amount),
        date: exp.date,
      });
    }

    return groups;
  }

  private findPotentialSubscriptions(
    groups: Record<string, Array<{ amount: number; date: Date }>>,
  ): PotentialSubscription[] {
    const results: PotentialSubscription[] = [];

    for (const [merchant, transactions] of Object.entries(groups)) {
      if (transactions.length < 3) continue;

      // Group by similar amounts (within 10%)
      const amountGroups = this.groupBySimilarAmount(transactions);

      for (const [amount, txns] of Object.entries(amountGroups)) {
        if (txns.length < 3) continue;

        // Sort by date
        const sorted = txns.sort(
          (a, b) => a.date.getTime() - b.date.getTime(),
        );

        // Calculate intervals
        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          const days =
            (sorted[i].date.getTime() - sorted[i - 1].date.getTime()) /
            (1000 * 60 * 60 * 24);
          intervals.push(days);
        }

        const avgInterval =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance =
          intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) /
          intervals.length;
        const stdDev = Math.sqrt(variance);

        // If interval is consistent (low variance), it's likely a subscription
        if (stdDev < avgInterval * 0.3) {
          results.push({
            merchant,
            amount: Number(amount),
            occurrences: sorted.map((t) => t.date),
            averageInterval: avgInterval,
            isMonthly: avgInterval >= 25 && avgInterval <= 35,
          });
        }
      }
    }

    return results;
  }

  private groupBySimilarAmount(
    transactions: Array<{ amount: number; date: Date }>,
  ): Record<string, Array<{ amount: number; date: Date }>> {
    const groups: Record<string, Array<{ amount: number; date: Date }>> = {};

    for (const txn of transactions) {
      // Find existing group within 10%
      let found = false;
      for (const [key, group] of Object.entries(groups)) {
        const groupAmount = Number(key);
        if (Math.abs(txn.amount - groupAmount) / groupAmount <= 0.1) {
          group.push(txn);
          found = true;
          break;
        }
      }
      if (!found) {
        groups[txn.amount.toString()] = [txn];
      }
    }

    return groups;
  }

  private calculateMonthlyAverage(
    expenses: Array<{ amount: any }>,
    months: number,
  ): number {
    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    return total / months;
  }
}
```

### Anomaly Detector

```typescript
// apps/api/src/modules/patterns/detectors/anomaly.detector.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DetectedPattern,
  PatternType,
  PatternSeverity,
} from '../types/pattern.types';

@Injectable()
export class AnomalyDetector {
  constructor(private readonly prisma: PrismaService) {}

  async detectUnusualExpenses(userId: string): Promise<DetectedPattern[]> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Get expenses with category
    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: { gte: threeMonthsAgo },
        categoryId: { not: null },
      },
      include: { category: true },
    });

    // Calculate statistics per category
    const categoryStats = this.calculateCategoryStats(expenses);

    // Find recent anomalies (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentExpenses = expenses.filter((e) => e.date >= oneWeekAgo);
    const anomalies: DetectedPattern[] = [];

    for (const expense of recentExpenses) {
      const stats = categoryStats[expense.categoryId!];
      if (!stats) continue;

      const amount = Number(expense.amount);
      const zScore = (amount - stats.mean) / stats.stdDev;

      // If more than 2 standard deviations above mean
      if (zScore > 2 && amount > stats.mean * 2) {
        anomalies.push({
          type: PatternType.UNUSUAL_EXPENSE,
          severity:
            zScore > 3 ? PatternSeverity.WARNING : PatternSeverity.ATTENTION,
          title: 'Unusual Expense Detected',
          description: `This ${expense.category?.name} expense of ₦${amount.toLocaleString()} is ${Math.round((amount / stats.mean - 1) * 100)}% higher than your average.`,
          data: {
            expenseId: expense.id,
            amount,
            categoryName: expense.category?.name,
            categoryAverage: Math.round(stats.mean),
            percentAboveAverage: Math.round((amount / stats.mean - 1) * 100),
            zScore: Math.round(zScore * 10) / 10,
          },
          confidence: Math.min(90, 60 + zScore * 10),
          detectedAt: new Date(),
          affectedPeriod: { start: expense.date, end: expense.date },
          suggestedAction: 'Review this transaction to ensure it was intentional.',
          relatedTransactions: [expense.id],
        });
      }
    }

    return anomalies;
  }

  async detectNewMerchant(userId: string): Promise<DetectedPattern[]> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    // Get recent expenses with merchants
    const recentExpenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: { gte: oneWeekAgo },
        merchant: { not: null },
      },
    });

    // Get historical merchants
    const historicalExpenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: { gte: twoMonthsAgo, lt: oneWeekAgo },
        merchant: { not: null },
      },
      select: { merchant: true },
    });

    const knownMerchants = new Set(
      historicalExpenses.map((e) => e.merchant!.toLowerCase().trim()),
    );

    const patterns: DetectedPattern[] = [];

    for (const expense of recentExpenses) {
      const merchantKey = expense.merchant!.toLowerCase().trim();
      if (!knownMerchants.has(merchantKey)) {
        patterns.push({
          type: PatternType.NEW_MERCHANT,
          severity: PatternSeverity.INFO,
          title: 'New Merchant',
          description: `First time spending at "${expense.merchant}": ₦${Number(expense.amount).toLocaleString()}.`,
          data: {
            expenseId: expense.id,
            merchant: expense.merchant,
            amount: Number(expense.amount),
            date: expense.date.toISOString(),
          },
          confidence: 100,
          detectedAt: new Date(),
          affectedPeriod: { start: expense.date, end: expense.date },
          relatedTransactions: [expense.id],
        });
      }
    }

    return patterns;
  }

  private calculateCategoryStats(
    expenses: Array<{ categoryId: string | null; amount: any }>,
  ): Record<string, { mean: number; stdDev: number; count: number }> {
    // Group by category
    const byCategory: Record<string, number[]> = {};

    for (const exp of expenses) {
      if (!exp.categoryId) continue;
      if (!byCategory[exp.categoryId]) byCategory[exp.categoryId] = [];
      byCategory[exp.categoryId].push(Number(exp.amount));
    }

    // Calculate stats
    const stats: Record<string, { mean: number; stdDev: number; count: number }> = {};

    for (const [categoryId, amounts] of Object.entries(byCategory)) {
      if (amounts.length < 5) continue; // Need enough data

      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const variance =
        amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) /
        amounts.length;
      const stdDev = Math.sqrt(variance);

      stats[categoryId] = { mean, stdDev: stdDev || mean * 0.5, count: amounts.length };
    }

    return stats;
  }
}
```

### Trend Detector

```typescript
// apps/api/src/modules/patterns/detectors/trend.detector.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DetectedPattern,
  PatternType,
  PatternSeverity,
} from '../types/pattern.types';

@Injectable()
export class TrendDetector {
  constructor(private readonly prisma: PrismaService) {}

  async detectCategoryTrends(userId: string): Promise<DetectedPattern[]> {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get expenses for both periods
    const recentExpenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: { gte: threeMonthsAgo },
        categoryId: { not: null },
      },
      include: { category: true },
    });

    const olderExpenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: { gte: sixMonthsAgo, lt: threeMonthsAgo },
        categoryId: { not: null },
      },
      include: { category: true },
    });

    // Sum by category for each period
    const recentByCategory = this.sumByCategory(recentExpenses);
    const olderByCategory = this.sumByCategory(olderExpenses);

    const patterns: DetectedPattern[] = [];
    const allCategories = new Set([
      ...Object.keys(recentByCategory),
      ...Object.keys(olderByCategory),
    ]);

    for (const categoryId of allCategories) {
      const recent = recentByCategory[categoryId]?.total ?? 0;
      const older = olderByCategory[categoryId]?.total ?? 0;

      if (older < 5000) continue; // Skip small categories

      const monthlyRecent = recent / 3;
      const monthlyOlder = older / 3;
      const percentChange = ((monthlyRecent - monthlyOlder) / monthlyOlder) * 100;

      if (Math.abs(percentChange) >= 30) {
        const categoryName =
          recentByCategory[categoryId]?.name ??
          olderByCategory[categoryId]?.name ??
          'Unknown';

        const isIncreasing = percentChange > 0;

        patterns.push({
          type: PatternType.CATEGORY_TREND,
          severity:
            Math.abs(percentChange) > 50
              ? PatternSeverity.ATTENTION
              : PatternSeverity.INFO,
          title: `${categoryName} Spending ${isIncreasing ? 'Rising' : 'Falling'}`,
          description: `Your ${categoryName} spending has ${isIncreasing ? 'increased' : 'decreased'} by ${Math.abs(Math.round(percentChange))}% compared to 3 months ago.`,
          data: {
            categoryId,
            categoryName,
            currentMonthlyAverage: Math.round(monthlyRecent),
            previousMonthlyAverage: Math.round(monthlyOlder),
            percentChange: Math.round(percentChange),
            isIncreasing,
          },
          confidence: 70,
          detectedAt: new Date(),
          affectedPeriod: { start: sixMonthsAgo, end: now },
          suggestedAction: isIncreasing
            ? `Review your ${categoryName} expenses to identify areas to cut back.`
            : undefined,
        });
      }
    }

    return patterns.sort(
      (a, b) =>
        Math.abs(b.data.percentChange) - Math.abs(a.data.percentChange),
    );
  }

  async detectIncomeDecline(userId: string): Promise<DetectedPattern | null> {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get income for both periods
    const recentIncome = await this.prisma.incomeSource.findMany({
      where: {
        userId,
        isActive: true,
        createdAt: { lt: threeMonthsAgo },
      },
    });

    // Sum monthly income
    const calculateMonthly = (sources: typeof recentIncome) => {
      return sources.reduce((sum, source) => {
        let monthlyAmount = Number(source.amount);
        switch (source.frequency) {
          case 'WEEKLY':
            monthlyAmount *= 4.33;
            break;
          case 'BIWEEKLY':
            monthlyAmount *= 2.17;
            break;
          case 'QUARTERLY':
            monthlyAmount /= 3;
            break;
          case 'SEMI_ANNUALLY':
            monthlyAmount /= 6;
            break;
          case 'ANNUALLY':
            monthlyAmount /= 12;
            break;
        }
        return sum + monthlyAmount;
      }, 0);
    };

    const currentMonthlyIncome = calculateMonthly(recentIncome);

    // Get deleted or reduced income sources
    const historicalSnapshots = await this.prisma.financialSnapshot.findMany({
      where: {
        userId,
        createdAt: { gte: sixMonthsAgo, lt: threeMonthsAgo },
      },
      select: { totalIncome: true },
      orderBy: { createdAt: 'asc' },
    });

    if (historicalSnapshots.length < 2) return null;

    const avgHistoricalIncome =
      historicalSnapshots.reduce((sum, s) => sum + Number(s.totalIncome), 0) /
      historicalSnapshots.length;

    if (
      avgHistoricalIncome > 0 &&
      currentMonthlyIncome < avgHistoricalIncome * 0.8
    ) {
      const percentDecline =
        ((avgHistoricalIncome - currentMonthlyIncome) / avgHistoricalIncome) * 100;

      return {
        type: PatternType.INCOME_DECLINE,
        severity: PatternSeverity.WARNING,
        title: 'Income Decline Detected',
        description: `Your monthly income has decreased by approximately ${Math.round(percentDecline)}% compared to 3-6 months ago.`,
        data: {
          currentMonthlyIncome: Math.round(currentMonthlyIncome),
          previousMonthlyAverage: Math.round(avgHistoricalIncome),
          percentDecline: Math.round(percentDecline),
        },
        confidence: 65,
        detectedAt: new Date(),
        affectedPeriod: { start: threeMonthsAgo, end: now },
        suggestedAction:
          'Review your budget and consider adjusting expenses to match your current income.',
      };
    }

    return null;
  }

  private sumByCategory(
    expenses: Array<{
      categoryId: string | null;
      category: { name: string } | null;
      amount: any;
    }>,
  ): Record<string, { total: number; name: string }> {
    const result: Record<string, { total: number; name: string }> = {};

    for (const exp of expenses) {
      if (!exp.categoryId || !exp.category) continue;

      if (!result[exp.categoryId]) {
        result[exp.categoryId] = { total: 0, name: exp.category.name };
      }
      result[exp.categoryId].total += Number(exp.amount);
    }

    return result;
  }
}
```

---

## Service Implementation

```typescript
// apps/api/src/modules/patterns/patterns.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SpendingPatternDetector } from './detectors/spending-pattern.detector';
import { RecurringTransactionDetector } from './detectors/recurring-transaction.detector';
import { AnomalyDetector } from './detectors/anomaly.detector';
import { TrendDetector } from './detectors/trend.detector';
import { DetectedPattern, PatternSeverity } from './types/pattern.types';

@Injectable()
export class PatternsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spendingDetector: SpendingPatternDetector,
    private readonly recurringDetector: RecurringTransactionDetector,
    private readonly anomalyDetector: AnomalyDetector,
    private readonly trendDetector: TrendDetector,
  ) {}

  async runAllDetectors(userId: string): Promise<DetectedPattern[]> {
    const patterns: DetectedPattern[] = [];

    // Run all detectors in parallel
    const [
      monthEndSpike,
      weekendSpender,
      impulseSpending,
      untrackedSubs,
      subCreep,
      unusualExpenses,
      newMerchants,
      categoryTrends,
      incomeDecline,
    ] = await Promise.all([
      this.spendingDetector.detectMonthEndSpike(userId),
      this.spendingDetector.detectWeekendSpender(userId),
      this.spendingDetector.detectImpulseSpending(userId),
      this.recurringDetector.detectUntrackedSubscriptions(userId),
      this.recurringDetector.detectSubscriptionCreep(userId),
      this.anomalyDetector.detectUnusualExpenses(userId),
      this.anomalyDetector.detectNewMerchant(userId),
      this.trendDetector.detectCategoryTrends(userId),
      this.trendDetector.detectIncomeDecline(userId),
    ]);

    // Collect non-null patterns
    if (monthEndSpike) patterns.push(monthEndSpike);
    if (weekendSpender) patterns.push(weekendSpender);
    if (impulseSpending) patterns.push(impulseSpending);
    patterns.push(...untrackedSubs);
    if (subCreep) patterns.push(subCreep);
    patterns.push(...unusualExpenses);
    patterns.push(...newMerchants);
    patterns.push(...categoryTrends);
    if (incomeDecline) patterns.push(incomeDecline);

    // Sort by severity and confidence
    return this.sortPatterns(patterns);
  }

  async savePatterns(userId: string, patterns: DetectedPattern[]) {
    // Only save patterns we haven't seen recently
    for (const pattern of patterns) {
      const exists = await this.prisma.detectedPattern.findFirst({
        where: {
          userId,
          type: pattern.type,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });

      if (!exists) {
        await this.prisma.detectedPattern.create({
          data: {
            userId,
            type: pattern.type,
            severity: pattern.severity,
            title: pattern.title,
            description: pattern.description,
            data: pattern.data,
            confidence: pattern.confidence,
            affectedStart: pattern.affectedPeriod.start,
            affectedEnd: pattern.affectedPeriod.end,
            suggestedAction: pattern.suggestedAction,
          },
        });
      }
    }
  }

  async getPatterns(userId: string, includeRead = false, includeDismissed = false) {
    return this.prisma.detectedPattern.findMany({
      where: {
        userId,
        ...(!includeRead && { isRead: false }),
        ...(!includeDismissed && { isDismissed: false }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(userId: string, patternId: string) {
    return this.prisma.detectedPattern.updateMany({
      where: { id: patternId, userId },
      data: { isRead: true },
    });
  }

  async dismissPattern(userId: string, patternId: string) {
    return this.prisma.detectedPattern.updateMany({
      where: { id: patternId, userId },
      data: { isDismissed: true },
    });
  }

  private sortPatterns(patterns: DetectedPattern[]): DetectedPattern[] {
    const severityOrder: Record<PatternSeverity, number> = {
      [PatternSeverity.CRITICAL]: 0,
      [PatternSeverity.WARNING]: 1,
      [PatternSeverity.ATTENTION]: 2,
      [PatternSeverity.INFO]: 3,
    };

    return patterns.sort((a, b) => {
      // First by severity
      const severityDiff =
        severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // Then by confidence
      return b.confidence - a.confidence;
    });
  }
}
```

---

## Controller Implementation

```typescript
// apps/api/src/modules/patterns/patterns.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PatternsService } from './patterns.service';

@Controller('patterns')
@UseGuards(JwtAuthGuard)
export class PatternsController {
  constructor(private readonly patternsService: PatternsService) {}

  @Post('detect')
  async runDetection(@CurrentUser('id') userId: string) {
    const patterns = await this.patternsService.runAllDetectors(userId);
    await this.patternsService.savePatterns(userId, patterns);
    return patterns;
  }

  @Get()
  async getPatterns(
    @CurrentUser('id') userId: string,
    @Query('includeRead') includeRead?: string,
    @Query('includeDismissed') includeDismissed?: string,
  ) {
    return this.patternsService.getPatterns(
      userId,
      includeRead === 'true',
      includeDismissed === 'true',
    );
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') patternId: string,
  ) {
    await this.patternsService.markAsRead(userId, patternId);
    return { success: true };
  }

  @Patch(':id/dismiss')
  async dismiss(
    @CurrentUser('id') userId: string,
    @Param('id') patternId: string,
  ) {
    await this.patternsService.dismissPattern(userId, patternId);
    return { success: true };
  }
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/patterns/detect` | Run all pattern detectors |
| GET | `/patterns` | Get detected patterns |
| PATCH | `/patterns/:id/read` | Mark pattern as read |
| PATCH | `/patterns/:id/dismiss` | Dismiss pattern |

---

## Key Capabilities

1. **Spending Patterns**: Month-end spikes, weekend spending, impulse purchases
2. **Recurring Detection**: Find untracked subscriptions automatically
3. **Anomaly Detection**: Unusual expenses, new merchants
4. **Trend Analysis**: Category spending trends, income decline
5. **Confidence Scoring**: Each pattern has a confidence score (0-100)
6. **Severity Levels**: INFO, ATTENTION, WARNING, CRITICAL

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@nestjs/common` | Core NestJS decorators |
| `@prisma/client` | Database ORM |

---

## Next Steps

After pattern detection, proceed to:
1. [12-simulation-engine.md](./12-simulation-engine.md) - Future projections
