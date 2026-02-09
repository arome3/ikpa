# Cash Flow Score

**Week:** 1 | **Tier:** 1 | **Depends On:** [01-opik-integration](./01-opik-integration.md)

---

## Overview

The Cash Flow Score is IKPA's primary financial health metric (0-100), calculated daily via NestJS Cron Job. It provides a single, easy-to-understand number that represents the user's overall financial health.

**Why It Matters:**

- Single metric for financial health (like a credit score for cash flow)
- Includes Dependency Ratio component
- Powers alerts when financial health changes significantly
- Foundation for simulation engine projections

---

## Technical Spec

### Interfaces

```typescript
interface CashFlowScoreComponents {
  savingsRate: { value: number; score: number };
  runwayMonths: { value: number; score: number };
  debtToIncome: { value: number; score: number };
  incomeStability: { value: number; score: number };
  dependencyRatio: { value: number; score: number };
}

interface CashFlowScoreResult {
  finalScore: number;
  components: CashFlowScoreComponents;
  calculation: string;
  timestamp: Date;
}
```

### Core Logic

```typescript
const cashFlowScore = {
  // Component weights (must sum to 100%)
  weights: {
    savingsRate: 0.3, // 30%
    runwayMonths: 0.25, // 25%
    debtToIncome: 0.2, // 20%
    incomeStability: 0.15, // 15%
    dependencyRatio: 0.1, // 10% (NEW - cultural component)
  },

  // Component calculations
  components: {
    // Savings Rate Score (0-100)
    savingsRate: {
      formula: '(Monthly Savings / Monthly Income) * 100',
      scoring: {
        '0-5%': 20,
        '5-10%': 40,
        '10-15%': 60,
        '15-20%': 80,
        '20%+': 100,
      },
    },

    // Runway Months Score (0-100)
    runwayMonths: {
      formula: 'Emergency Fund / Monthly Expenses',
      scoring: {
        '0-1 months': 20,
        '1-3 months': 40,
        '3-6 months': 60,
        '6-9 months': 80,
        '9+ months': 100,
      },
    },

    // Debt-to-Income Score (0-100, inverse)
    debtToIncome: {
      formula: '(Monthly Debt Payments / Monthly Income) * 100',
      scoring: {
        '50%+': 20,
        '36-50%': 40,
        '20-35%': 60,
        '10-20%': 80,
        '0-10%': 100,
      },
    },

    // Income Stability Score (0-100)
    incomeStability: {
      formula: '1 - (Standard Deviation of Last 6 Months / Average)',
      scoring: {
        'High variance (>30%)': 20,
        'Moderate variance (15-30%)': 60,
        'Low variance (<15%)': 100,
      },
    },

    // Dependency Ratio Health Score (0-100, NEW)
    dependencyRatio: {
      formula: '(Total Family Support / Net Income) * 100',
      scoring: {
        '35%+': 40, // High but not penalized harshly
        '10-35%': 80, // Healthy moderate level
        '0-10%': 100, // Low family support
      },
    },
  },

  // Example calculation
  example: {
    savingsRate: { value: 12, score: 60 },
    runwayMonths: { value: 4.2, score: 60 },
    debtToIncome: { value: 18, score: 80 },
    incomeStability: { value: 8, score: 100 },
    dependencyRatio: { value: 21, score: 80 },

    calculation: '(60*0.30) + (60*0.25) + (80*0.20) + (100*0.15) + (80*0.10)',
    finalScore: 70,
  },
};
```

### NestJS Cron Job

```typescript
// apps/api/src/modules/finance/finance.cron.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FinanceService } from './finance.service';
import { UserService } from '../user/user.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class FinanceCronService {
  constructor(
    private financeService: FinanceService,
    private userService: UserService,
    private notificationService: NotificationService,
  ) {}

  @Cron('0 2 * * *') // Run at 2 AM daily
  async calculateDailyCashFlowScores() {
    const users = await this.userService.getAllActiveUsers();
    for (const user of users) {
      const score = await this.financeService.calculateCashFlowScore(user.id);
      await this.financeService.saveDailyScore(user.id, score);

      // Trigger alerts if significant change
      const previousScore = await this.financeService.getPreviousScore(user.id);
      if (Math.abs(score - previousScore) > 5) {
        await this.notificationService.sendScoreChangeAlert(user.id, previousScore, score);
      }
    }
  }
}
```

### Score Calculator Implementation

```typescript
// apps/api/src/modules/finance/calculators/cash-flow-score.ts
import { Injectable } from '@nestjs/common';
import { OpikService } from '../../ai/opik/opik.service';

@Injectable()
export class CashFlowScoreCalculator {
  private readonly weights = {
    savingsRate: 0.3,
    runwayMonths: 0.25,
    debtToIncome: 0.2,
    incomeStability: 0.15,
    dependencyRatio: 0.1,
  };

  constructor(private opikService: OpikService) {}

  async calculate(userId: string, financialData: FinancialData): Promise<CashFlowScoreResult> {
    const trace = this.opikService.createTrace('cash_flow_score_calculation', { userId });

    const components = {
      savingsRate: this.calculateSavingsRateScore(financialData),
      runwayMonths: this.calculateRunwayScore(financialData),
      debtToIncome: this.calculateDebtToIncomeScore(financialData),
      incomeStability: this.calculateIncomeStabilityScore(financialData),
      dependencyRatio: this.calculateDependencyRatioScore(financialData),
    };

    const finalScore =
      components.savingsRate.score * this.weights.savingsRate +
      components.runwayMonths.score * this.weights.runwayMonths +
      components.debtToIncome.score * this.weights.debtToIncome +
      components.incomeStability.score * this.weights.incomeStability +
      components.dependencyRatio.score * this.weights.dependencyRatio;

    trace.end({ output: { finalScore, components } });
    await this.opikService.flush();

    return {
      finalScore: Math.round(finalScore),
      components,
      calculation: this.formatCalculation(components),
      timestamp: new Date(),
    };
  }

  private calculateSavingsRateScore(data: FinancialData): { value: number; score: number } {
    const rate = (data.monthlySavings / data.monthlyIncome) * 100;
    let score: number;

    if (rate >= 20) score = 100;
    else if (rate >= 15) score = 80;
    else if (rate >= 10) score = 60;
    else if (rate >= 5) score = 40;
    else score = 20;

    return { value: rate, score };
  }

  private calculateRunwayScore(data: FinancialData): { value: number; score: number } {
    const months = data.emergencyFund / data.monthlyExpenses;
    let score: number;

    if (months >= 9) score = 100;
    else if (months >= 6) score = 80;
    else if (months >= 3) score = 60;
    else if (months >= 1) score = 40;
    else score = 20;

    return { value: months, score };
  }

  private calculateDebtToIncomeScore(data: FinancialData): { value: number; score: number } {
    const ratio = (data.monthlyDebtPayments / data.monthlyIncome) * 100;
    let score: number;

    if (ratio <= 10) score = 100;
    else if (ratio <= 20) score = 80;
    else if (ratio <= 35) score = 60;
    else if (ratio <= 50) score = 40;
    else score = 20;

    return { value: ratio, score };
  }

  private calculateIncomeStabilityScore(data: FinancialData): { value: number; score: number } {
    const avg = data.last6MonthsIncome.reduce((a, b) => a + b, 0) / 6;
    const variance = Math.sqrt(
      data.last6MonthsIncome.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / 6,
    );
    const coefficientOfVariation = (variance / avg) * 100;
    let score: number;

    if (coefficientOfVariation < 15) score = 100;
    else if (coefficientOfVariation <= 30) score = 60;
    else score = 20;

    return { value: coefficientOfVariation, score };
  }

  private calculateDependencyRatioScore(data: FinancialData): { value: number; score: number } {
    const ratio = (data.totalFamilySupport / data.netIncome) * 100;
    let score: number;

    if (ratio <= 10) score = 100;
    else if (ratio <= 35) score = 80;
    else score = 40;

    return { value: ratio, score };
  }

  private formatCalculation(components: CashFlowScoreComponents): string {
    return (
      `(${components.savingsRate.score}*0.30) + (${components.runwayMonths.score}*0.25) + ` +
      `(${components.debtToIncome.score}*0.20) + (${components.incomeStability.score}*0.15) + ` +
      `(${components.dependencyRatio.score}*0.10)`
    );
  }
}
```

---

## Implementation Checklist

- [ ] Create file: `apps/api/src/modules/finance/finance.module.ts`
- [ ] Create file: `apps/api/src/modules/finance/finance.service.ts`
- [ ] Create file: `apps/api/src/modules/finance/finance.controller.ts`
- [ ] Create file: `apps/api/src/modules/finance/finance.cron.ts`
- [ ] Create file: `apps/api/src/modules/finance/calculators/cash-flow-score.ts`
- [ ] Add Prisma model for `CashFlowScoreHistory`
- [ ] Register ScheduleModule in `app.module.ts`
- [ ] Add Opik tracing spans for each component calculation
- [ ] Write unit tests for each scoring function
- [ ] Add Swagger documentation

---

## API Routes

| Method | Path                        | Description                             |
| ------ | --------------------------- | --------------------------------------- |
| GET    | `/v1/finance/score`         | Get current Cash Flow Score             |
| GET    | `/v1/finance/score/history` | Get score history (last 30/90/365 days) |

---

## Opik Metrics

| Metric                    | Type     | Description                       |
| ------------------------- | -------- | --------------------------------- |
| `CashFlowScoreCalculated` | Event    | Score calculated for user         |
| `ScoreChangeAlert`        | Event    | Significant score change detected |
| `ComponentBreakdown`      | Metadata | Individual component scores       |

---

## Verification

### curl Commands

```bash
# Get current Cash Flow Score
curl -X GET http://localhost:3000/v1/finance/score \
  -H "Authorization: Bearer $TOKEN"

# Get score history (last 30 days)
curl -X GET "http://localhost:3000/v1/finance/score/history?days=30" \
  -H "Authorization: Bearer $TOKEN"
```

### Expected Response

```json
{
  "finalScore": 70,
  "components": {
    "savingsRate": { "value": 12, "score": 60 },
    "runwayMonths": { "value": 4.2, "score": 60 },
    "debtToIncome": { "value": 18, "score": 80 },
    "incomeStability": { "value": 8, "score": 100 },
    "dependencyRatio": { "value": 21, "score": 80 }
  },
  "calculation": "(60*0.30) + (60*0.25) + (80*0.20) + (100*0.15) + (80*0.10)",
  "timestamp": "2026-01-16T02:00:00.000Z"
}
```

### Score History Response

```json
{
  "history": [
    { "date": "2026-01-16", "score": 70 },
    { "date": "2026-01-15", "score": 68 },
    { "date": "2026-01-14", "score": 72 }
  ],
  "trend": "stable",
  "averageScore": 70
}
```
