# Simulation Engine

## Overview

This document covers Ikpa's financial simulation engine, which projects future financial states based on current data and hypothetical scenarios. It powers the "Future Self" feature by generating dual-path projections showing where the user could be with different financial decisions.

---

## Technical Specifications

### Core Concepts

```typescript
// apps/api/src/modules/simulation/types/simulation.types.ts

export interface SimulationInput {
  currentState: FinancialState;
  timeHorizonMonths: number;
  scenario: Scenario;
  economicContext: EconomicContext;
}

export interface FinancialState {
  income: MonthlyIncome;
  expenses: MonthlyExpenses;
  savings: SavingsState;
  debts: DebtState[];
  goals: GoalState[];
  familySupport: number;
}

export interface MonthlyIncome {
  total: number;
  sources: { name: string; amount: number; variance: number }[];
  stability: number; // 0-100
}

export interface MonthlyExpenses {
  fixed: number;
  variable: number;
  discretionary: number;
  byCategory: Record<string, number>;
}

export interface SavingsState {
  total: number;
  emergencyFund: number;
  investments: number;
  savingsRate: number; // percentage
}

export interface DebtState {
  id: string;
  name: string;
  balance: number;
  monthlyPayment: number;
  interestRate: number;
  monthsRemaining: number;
}

export interface GoalState {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  deadline?: Date;
}

export interface EconomicContext {
  inflationRate: number;      // Annual inflation (e.g., 0.25 for 25%)
  currencyDepreciation: number; // FX impact on savings
  interestOnSavings: number;  // Average savings interest rate
}

export interface Scenario {
  type: ScenarioType;
  parameters: Record<string, any>;
}

export enum ScenarioType {
  CURRENT_PATH = 'current_path',           // No changes
  OPTIMIZED = 'optimized',                  // Best case with discipline
  INCOME_INCREASE = 'income_increase',      // Salary raise or new income
  INCOME_DECREASE = 'income_decrease',      // Job loss or income cut
  EXPENSE_REDUCTION = 'expense_reduction',  // Cutting spending
  DEBT_PAYOFF = 'debt_payoff',              // Aggressive debt repayment
  MAJOR_PURCHASE = 'major_purchase',        // Car, house, wedding
  EMERGENCY = 'emergency',                  // Unexpected expense
  FAMILY_INCREASE = 'family_increase',      // More family obligations
  INVESTMENT_FOCUS = 'investment_focus',    // Prioritize investments
}

export interface SimulationResult {
  scenario: ScenarioType;
  monthlySnapshots: MonthlySnapshot[];
  finalState: FinancialState;
  milestones: Milestone[];
  riskEvents: RiskEvent[];
  summary: SimulationSummary;
}

export interface MonthlySnapshot {
  month: number;
  date: Date;
  income: number;
  expenses: number;
  netCashFlow: number;
  totalSavings: number;
  totalDebt: number;
  netWorth: number;
  cashFlowScore: number;
  goalsProgress: Record<string, number>;
}

export interface Milestone {
  month: number;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
  amount?: number;
}

export interface RiskEvent {
  month: number;
  type: string;
  probability: number;
  impact: number;
  description: string;
}

export interface SimulationSummary {
  endNetWorth: number;
  netWorthChange: number;
  totalSaved: number;
  totalDebtPaid: number;
  goalsAchieved: string[];
  goalsAtRisk: string[];
  averageCashFlowScore: number;
  monthsToEmergencyFund: number | null;
  monthsToDebtFree: number | null;
}
```

---

## Module Structure

```
apps/api/src/modules/simulation/
├── simulation.module.ts
├── simulation.controller.ts
├── simulation.service.ts
├── engines/
│   ├── projection.engine.ts
│   ├── scenario.engine.ts
│   └── monte-carlo.engine.ts
├── builders/
│   ├── state-builder.service.ts
│   └── context-builder.service.ts
├── types/
│   └── simulation.types.ts
└── dto/
    ├── run-simulation.dto.ts
    └── compare-scenarios.dto.ts
```

---

## Service Implementations

### Projection Engine

```typescript
// apps/api/src/modules/simulation/engines/projection.engine.ts

import { Injectable } from '@nestjs/common';
import {
  SimulationInput,
  SimulationResult,
  MonthlySnapshot,
  Milestone,
  FinancialState,
  EconomicContext,
} from '../types/simulation.types';

@Injectable()
export class ProjectionEngine {
  projectFuture(input: SimulationInput): SimulationResult {
    const { currentState, timeHorizonMonths, economicContext } = input;

    const snapshots: MonthlySnapshot[] = [];
    const milestones: Milestone[] = [];
    let state = this.cloneState(currentState);

    const startDate = new Date();

    for (let month = 1; month <= timeHorizonMonths; month++) {
      // Apply monthly inflation to expenses
      state = this.applyInflation(state, economicContext, month);

      // Calculate monthly cash flow
      const income = this.calculateMonthlyIncome(state.income);
      const expenses = this.calculateMonthlyExpenses(state.expenses);
      const debtPayments = state.debts.reduce(
        (sum, d) => sum + d.monthlyPayment,
        0
      );
      const familySupport = state.familySupport;
      const goalContributions = state.goals.reduce(
        (sum, g) => sum + g.monthlyContribution,
        0
      );

      const totalOutflow =
        expenses + debtPayments + familySupport + goalContributions;
      const netCashFlow = income - totalOutflow;

      // Update savings
      state.savings.total += netCashFlow > 0 ? netCashFlow : 0;

      // Apply savings interest (monthly)
      state.savings.total *= 1 + economicContext.interestOnSavings / 12;

      // Update debts
      for (const debt of state.debts) {
        if (debt.balance > 0) {
          const interestPayment = debt.balance * (debt.interestRate / 12);
          const principalPayment = Math.max(0, debt.monthlyPayment - interestPayment);
          debt.balance = Math.max(0, debt.balance - principalPayment);
          debt.monthsRemaining = Math.max(0, debt.monthsRemaining - 1);

          // Check for debt payoff milestone
          if (debt.balance === 0 && debt.monthsRemaining >= 0) {
            milestones.push({
              month,
              description: `Paid off ${debt.name}`,
              type: 'positive',
              amount: 0,
            });
          }
        }
      }

      // Update goals
      for (const goal of state.goals) {
        goal.currentAmount += goal.monthlyContribution;

        // Check for goal achievement
        if (
          goal.currentAmount >= goal.targetAmount &&
          !milestones.find(
            (m) => m.description.includes(goal.name) && m.type === 'positive'
          )
        ) {
          milestones.push({
            month,
            description: `Achieved goal: ${goal.name}`,
            type: 'positive',
            amount: goal.targetAmount,
          });
        }
      }

      // Calculate net worth
      const totalDebt = state.debts.reduce((sum, d) => sum + d.balance, 0);
      const netWorth = state.savings.total - totalDebt;

      // Calculate cash flow score
      const cashFlowScore = this.calculateCashFlowScore(state, income, expenses);

      // Create snapshot
      const snapshotDate = new Date(startDate);
      snapshotDate.setMonth(snapshotDate.getMonth() + month);

      snapshots.push({
        month,
        date: snapshotDate,
        income,
        expenses: totalOutflow,
        netCashFlow,
        totalSavings: state.savings.total,
        totalDebt,
        netWorth,
        cashFlowScore,
        goalsProgress: Object.fromEntries(
          state.goals.map((g) => [
            g.id,
            (g.currentAmount / g.targetAmount) * 100,
          ])
        ),
      });

      // Check for risk events
      this.checkRiskEvents(state, month, netCashFlow, milestones);
    }

    return {
      scenario: input.scenario.type,
      monthlySnapshots: snapshots,
      finalState: state,
      milestones,
      riskEvents: [],
      summary: this.generateSummary(currentState, state, snapshots, milestones),
    };
  }

  private cloneState(state: FinancialState): FinancialState {
    return JSON.parse(JSON.stringify(state));
  }

  private applyInflation(
    state: FinancialState,
    context: EconomicContext,
    month: number,
  ): FinancialState {
    // Apply monthly inflation (compound)
    const monthlyInflation = Math.pow(1 + context.inflationRate, 1 / 12) - 1;

    state.expenses.fixed *= 1 + monthlyInflation;
    state.expenses.variable *= 1 + monthlyInflation;
    state.expenses.discretionary *= 1 + monthlyInflation;

    for (const category in state.expenses.byCategory) {
      state.expenses.byCategory[category] *= 1 + monthlyInflation;
    }

    return state;
  }

  private calculateMonthlyIncome(income: FinancialState['income']): number {
    // Add some variance based on income stability
    const variance = (100 - income.stability) / 100;
    const randomFactor = 1 + (Math.random() - 0.5) * variance * 0.2;
    return income.total * randomFactor;
  }

  private calculateMonthlyExpenses(expenses: FinancialState['expenses']): number {
    // Variable expenses have some randomness
    const variableVariance = 1 + (Math.random() - 0.5) * 0.2;
    return expenses.fixed + expenses.variable * variableVariance + expenses.discretionary;
  }

  private calculateCashFlowScore(
    state: FinancialState,
    income: number,
    expenses: number,
  ): number {
    const savingsRate = (income - expenses) / income;
    const totalDebt = state.debts.reduce((sum, d) => sum + d.balance, 0);
    const debtRatio = income > 0 ? totalDebt / (income * 12) : 1;
    const emergencyMonths =
      income > 0 ? state.savings.emergencyFund / (expenses / state.income.stability * 100) : 0;

    let score = 50;
    score += savingsRate > 0.2 ? 20 : savingsRate > 0.1 ? 10 : savingsRate > 0 ? 5 : -10;
    score += debtRatio < 1 ? 15 : debtRatio < 3 ? 5 : -10;
    score += emergencyMonths >= 3 ? 15 : emergencyMonths >= 1 ? 5 : -5;

    return Math.max(0, Math.min(100, score));
  }

  private checkRiskEvents(
    state: FinancialState,
    month: number,
    netCashFlow: number,
    milestones: Milestone[],
  ) {
    // Check for negative cash flow
    if (netCashFlow < 0) {
      milestones.push({
        month,
        description: 'Negative cash flow this month',
        type: 'negative',
        amount: netCashFlow,
      });
    }

    // Check for depleted savings
    if (state.savings.total < 0) {
      milestones.push({
        month,
        description: 'Savings depleted',
        type: 'negative',
      });
    }

    // Check for emergency fund threshold
    const monthlyExpenses =
      state.expenses.fixed + state.expenses.variable + state.expenses.discretionary;
    if (
      state.savings.emergencyFund >= monthlyExpenses * 3 &&
      !milestones.find((m) => m.description.includes('Emergency fund'))
    ) {
      milestones.push({
        month,
        description: 'Emergency fund reached 3 months of expenses',
        type: 'positive',
      });
    }
  }

  private generateSummary(
    initial: FinancialState,
    final: FinancialState,
    snapshots: MonthlySnapshot[],
    milestones: Milestone[],
  ): SimulationResult['summary'] {
    const initialNetWorth =
      initial.savings.total -
      initial.debts.reduce((sum, d) => sum + d.balance, 0);
    const finalNetWorth =
      final.savings.total -
      final.debts.reduce((sum, d) => sum + d.balance, 0);

    const avgCashFlowScore =
      snapshots.reduce((sum, s) => sum + s.cashFlowScore, 0) / snapshots.length;

    const goalsAchieved = final.goals
      .filter((g) => g.currentAmount >= g.targetAmount)
      .map((g) => g.name);

    const goalsAtRisk = final.goals
      .filter(
        (g) =>
          g.currentAmount < g.targetAmount * 0.5 &&
          g.deadline &&
          new Date(g.deadline) < new Date(snapshots[snapshots.length - 1].date)
      )
      .map((g) => g.name);

    // Find months to debt free
    const debtFreeMonth = snapshots.find(
      (s) => s.totalDebt === 0 && initial.debts.length > 0
    );

    return {
      endNetWorth: finalNetWorth,
      netWorthChange: finalNetWorth - initialNetWorth,
      totalSaved: final.savings.total - initial.savings.total,
      totalDebtPaid:
        initial.debts.reduce((sum, d) => sum + d.balance, 0) -
        final.debts.reduce((sum, d) => sum + d.balance, 0),
      goalsAchieved,
      goalsAtRisk,
      averageCashFlowScore: Math.round(avgCashFlowScore),
      monthsToEmergencyFund: null, // Calculate based on snapshots
      monthsToDebtFree: debtFreeMonth?.month ?? null,
    };
  }
}
```

### Scenario Engine

```typescript
// apps/api/src/modules/simulation/engines/scenario.engine.ts

import { Injectable } from '@nestjs/common';
import {
  FinancialState,
  Scenario,
  ScenarioType,
} from '../types/simulation.types';

@Injectable()
export class ScenarioEngine {
  applyScenario(state: FinancialState, scenario: Scenario): FinancialState {
    const modifiedState = JSON.parse(JSON.stringify(state));

    switch (scenario.type) {
      case ScenarioType.CURRENT_PATH:
        return modifiedState;

      case ScenarioType.OPTIMIZED:
        return this.applyOptimizedScenario(modifiedState, scenario.parameters);

      case ScenarioType.INCOME_INCREASE:
        return this.applyIncomeIncrease(modifiedState, scenario.parameters);

      case ScenarioType.INCOME_DECREASE:
        return this.applyIncomeDecrease(modifiedState, scenario.parameters);

      case ScenarioType.EXPENSE_REDUCTION:
        return this.applyExpenseReduction(modifiedState, scenario.parameters);

      case ScenarioType.DEBT_PAYOFF:
        return this.applyDebtPayoff(modifiedState, scenario.parameters);

      case ScenarioType.MAJOR_PURCHASE:
        return this.applyMajorPurchase(modifiedState, scenario.parameters);

      case ScenarioType.EMERGENCY:
        return this.applyEmergency(modifiedState, scenario.parameters);

      case ScenarioType.FAMILY_INCREASE:
        return this.applyFamilyIncrease(modifiedState, scenario.parameters);

      case ScenarioType.INVESTMENT_FOCUS:
        return this.applyInvestmentFocus(modifiedState, scenario.parameters);

      default:
        return modifiedState;
    }
  }

  private applyOptimizedScenario(
    state: FinancialState,
    params: Record<string, any>,
  ): FinancialState {
    // Cut discretionary spending by 30%
    state.expenses.discretionary *= 0.7;

    // Increase savings rate
    const additionalSavings = state.expenses.discretionary * 0.3;
    state.savings.savingsRate += 5;

    // Allocate extra to highest priority goal
    if (state.goals.length > 0) {
      state.goals[0].monthlyContribution += additionalSavings * 0.5;
    }

    // Allocate to debt with highest interest
    const highestInterestDebt = state.debts.sort(
      (a, b) => b.interestRate - a.interestRate
    )[0];
    if (highestInterestDebt) {
      highestInterestDebt.monthlyPayment += additionalSavings * 0.5;
    }

    return state;
  }

  private applyIncomeIncrease(
    state: FinancialState,
    params: { percentage?: number; amount?: number },
  ): FinancialState {
    const increase = params.amount ?? state.income.total * (params.percentage ?? 0.1);
    state.income.total += increase;

    // Assume higher income = more stability
    state.income.stability = Math.min(100, state.income.stability + 5);

    return state;
  }

  private applyIncomeDecrease(
    state: FinancialState,
    params: { percentage?: number; amount?: number },
  ): FinancialState {
    const decrease = params.amount ?? state.income.total * (params.percentage ?? 0.3);
    state.income.total = Math.max(0, state.income.total - decrease);
    state.income.stability = Math.max(0, state.income.stability - 20);

    return state;
  }

  private applyExpenseReduction(
    state: FinancialState,
    params: { percentage?: number; category?: string },
  ): FinancialState {
    const reduction = params.percentage ?? 0.2;

    if (params.category && state.expenses.byCategory[params.category]) {
      state.expenses.byCategory[params.category] *= 1 - reduction;
    } else {
      state.expenses.discretionary *= 1 - reduction;
      state.expenses.variable *= 1 - reduction * 0.5;
    }

    return state;
  }

  private applyDebtPayoff(
    state: FinancialState,
    params: { extraMonthly?: number; strategy?: 'avalanche' | 'snowball' },
  ): FinancialState {
    const extra = params.extraMonthly ?? state.income.total * 0.1;
    const strategy = params.strategy ?? 'avalanche';

    // Sort debts by strategy
    const sortedDebts = [...state.debts].sort((a, b) =>
      strategy === 'avalanche'
        ? b.interestRate - a.interestRate
        : a.balance - b.balance
    );

    // Apply extra to first debt
    if (sortedDebts.length > 0) {
      sortedDebts[0].monthlyPayment += extra;
    }

    return state;
  }

  private applyMajorPurchase(
    state: FinancialState,
    params: { amount: number; financingMonths?: number; interestRate?: number },
  ): FinancialState {
    const { amount, financingMonths, interestRate } = params;

    if (financingMonths && financingMonths > 0) {
      // Add as new debt
      const monthlyPayment = interestRate
        ? (amount * (interestRate / 12)) /
          (1 - Math.pow(1 + interestRate / 12, -financingMonths))
        : amount / financingMonths;

      state.debts.push({
        id: `major-purchase-${Date.now()}`,
        name: 'Major Purchase',
        balance: amount,
        monthlyPayment,
        interestRate: interestRate ?? 0,
        monthsRemaining: financingMonths,
      });
    } else {
      // Pay from savings
      state.savings.total -= amount;
    }

    return state;
  }

  private applyEmergency(
    state: FinancialState,
    params: { amount: number },
  ): FinancialState {
    const { amount } = params;

    // First use emergency fund
    if (state.savings.emergencyFund >= amount) {
      state.savings.emergencyFund -= amount;
      state.savings.total -= amount;
    } else {
      // Use all emergency fund and dip into regular savings
      const remaining = amount - state.savings.emergencyFund;
      state.savings.emergencyFund = 0;
      state.savings.total -= amount;
    }

    return state;
  }

  private applyFamilyIncrease(
    state: FinancialState,
    params: { additionalMonthly: number },
  ): FinancialState {
    state.familySupport += params.additionalMonthly;
    return state;
  }

  private applyInvestmentFocus(
    state: FinancialState,
    params: { monthlyInvestment: number },
  ): FinancialState {
    // Reduce discretionary spending to fund investments
    const investment = params.monthlyInvestment;
    state.expenses.discretionary = Math.max(
      0,
      state.expenses.discretionary - investment
    );

    // Add to investments
    state.savings.investments += investment;

    return state;
  }
}
```

### State Builder Service

```typescript
// apps/api/src/modules/simulation/builders/state-builder.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialState, EconomicContext } from '../types/simulation.types';
import { Frequency } from '@prisma/client';

@Injectable()
export class StateBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async buildCurrentState(userId: string): Promise<FinancialState> {
    const [incomeSources, expenses, savings, investments, debts, goals, familySupport] =
      await Promise.all([
        this.prisma.incomeSource.findMany({
          where: { userId, isActive: true },
        }),
        this.prisma.expense.findMany({
          where: {
            userId,
            date: { gte: this.threeMonthsAgo() },
          },
          include: { category: true },
        }),
        this.prisma.savingsAccount.findMany({
          where: { userId, isActive: true },
        }),
        this.prisma.investment.findMany({
          where: { userId, isActive: true },
        }),
        this.prisma.debt.findMany({
          where: { userId, isActive: true },
        }),
        this.prisma.goal.findMany({
          where: { userId, status: 'ACTIVE' },
        }),
        this.prisma.familySupport.findMany({
          where: { userId, status: 'ACTIVE' },
        }),
      ]);

    // Calculate monthly income
    const income = this.calculateMonthlyIncome(incomeSources);

    // Calculate monthly expenses
    const monthlyExpenses = this.calculateMonthlyExpenses(expenses);

    // Calculate savings state
    const savingsState = this.calculateSavingsState(savings, investments, income.total);

    // Map debts
    const debtStates = debts.map((debt) => ({
      id: debt.id,
      name: debt.name,
      balance: Number(debt.currentBalance),
      monthlyPayment: Number(debt.minimumPayment ?? 0),
      interestRate: Number(debt.interestRate ?? 0) / 100,
      monthsRemaining: this.calculateMonthsRemaining(debt),
    }));

    // Map goals
    const goalStates = goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      monthlyContribution: Number(goal.monthlyContribution ?? 0),
      deadline: goal.targetDate,
    }));

    // Calculate family support
    const monthlyFamilySupport = familySupport.reduce((sum, support) => {
      return sum + this.toMonthly(Number(support.amount), support.frequency);
    }, 0);

    return {
      income,
      expenses: monthlyExpenses,
      savings: savingsState,
      debts: debtStates,
      goals: goalStates,
      familySupport: monthlyFamilySupport,
    };
  }

  getDefaultEconomicContext(): EconomicContext {
    // Nigeria-specific defaults
    return {
      inflationRate: 0.25,        // 25% annual inflation
      currencyDepreciation: 0.15, // 15% annual NGN depreciation
      interestOnSavings: 0.10,    // 10% savings interest
    };
  }

  private calculateMonthlyIncome(
    sources: Array<{ amount: any; frequency: Frequency; variance: any }>,
  ): FinancialState['income'] {
    const monthlyTotal = sources.reduce((sum, source) => {
      return sum + this.toMonthly(Number(source.amount), source.frequency);
    }, 0);

    const avgVariance =
      sources.reduce((sum, s) => sum + (Number(s.variance) || 0), 0) /
      (sources.length || 1);

    return {
      total: monthlyTotal,
      sources: sources.map((s) => ({
        name: 'Income Source',
        amount: this.toMonthly(Number(s.amount), s.frequency),
        variance: Number(s.variance) || 0,
      })),
      stability: Math.max(0, 100 - avgVariance),
    };
  }

  private calculateMonthlyExpenses(
    expenses: Array<{ amount: any; category: { name: string } | null; isRecurring: boolean }>,
  ): FinancialState['expenses'] {
    const threeMonths = 3;
    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const monthlyTotal = total / threeMonths;

    // Categorize expenses
    const byCategory: Record<string, number> = {};
    let fixed = 0;
    let variable = 0;

    for (const expense of expenses) {
      const categoryName = expense.category?.name ?? 'Other';
      const amount = Number(expense.amount) / threeMonths;

      byCategory[categoryName] = (byCategory[categoryName] || 0) + amount;

      if (expense.isRecurring) {
        fixed += amount;
      } else {
        variable += amount;
      }
    }

    // Estimate discretionary as a portion of variable
    const discretionary = variable * 0.4;

    return {
      fixed,
      variable: variable - discretionary,
      discretionary,
      byCategory,
    };
  }

  private calculateSavingsState(
    savings: Array<{ balance: any; type: string }>,
    investments: Array<{ currentValue: any }>,
    monthlyIncome: number,
  ): FinancialState['savings'] {
    const totalSavings = savings.reduce((sum, s) => sum + Number(s.balance), 0);
    const emergencyFund = savings
      .filter((s) => s.type === 'EMERGENCY_FUND')
      .reduce((sum, s) => sum + Number(s.balance), 0);
    const totalInvestments = investments.reduce(
      (sum, i) => sum + Number(i.currentValue),
      0
    );

    return {
      total: totalSavings + totalInvestments,
      emergencyFund,
      investments: totalInvestments,
      savingsRate: 0, // Will be calculated from cash flow
    };
  }

  private toMonthly(amount: number, frequency: Frequency): number {
    switch (frequency) {
      case 'DAILY':
        return amount * 30;
      case 'WEEKLY':
        return amount * 4.33;
      case 'BIWEEKLY':
        return amount * 2.17;
      case 'MONTHLY':
        return amount;
      case 'QUARTERLY':
        return amount / 3;
      case 'SEMI_ANNUALLY':
        return amount / 6;
      case 'ANNUALLY':
        return amount / 12;
      default:
        return amount;
    }
  }

  private calculateMonthsRemaining(debt: { currentBalance: any; minimumPayment: any; interestRate: any }): number {
    const balance = Number(debt.currentBalance);
    const payment = Number(debt.minimumPayment) || 0;
    const rate = (Number(debt.interestRate) || 0) / 100 / 12;

    if (payment <= 0 || balance <= 0) return 0;
    if (rate === 0) return Math.ceil(balance / payment);

    if (payment <= balance * rate) return Infinity; // Can't pay off

    return Math.ceil(
      -Math.log(1 - (rate * balance) / payment) / Math.log(1 + rate)
    );
  }

  private threeMonthsAgo(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date;
  }
}
```

---

## Controller Implementation

```typescript
// apps/api/src/modules/simulation/simulation.controller.ts

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SimulationService } from './simulation.service';
import { ScenarioType } from './types/simulation.types';

@Controller('simulation')
@UseGuards(JwtAuthGuard)
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Get('current-state')
  async getCurrentState(@CurrentUser('id') userId: string) {
    return this.simulationService.getCurrentState(userId);
  }

  @Post('run')
  async runSimulation(
    @CurrentUser('id') userId: string,
    @Body() body: {
      scenario: ScenarioType;
      parameters?: Record<string, any>;
      timeHorizonMonths?: number;
    },
  ) {
    return this.simulationService.runSimulation(
      userId,
      body.scenario,
      body.parameters ?? {},
      body.timeHorizonMonths ?? 12,
    );
  }

  @Post('compare')
  async compareScenarios(
    @CurrentUser('id') userId: string,
    @Body() body: {
      scenarios: Array<{
        type: ScenarioType;
        parameters?: Record<string, any>;
      }>;
      timeHorizonMonths?: number;
    },
  ) {
    return this.simulationService.compareScenarios(
      userId,
      body.scenarios,
      body.timeHorizonMonths ?? 12,
    );
  }

  @Get('future-self')
  async getFutureSelfPaths(
    @CurrentUser('id') userId: string,
    @Query('months') months?: number,
  ) {
    return this.simulationService.generateFutureSelfPaths(userId, months ?? 24);
  }
}
```

---

## Simulation Service

```typescript
// apps/api/src/modules/simulation/simulation.service.ts

import { Injectable } from '@nestjs/common';
import { ProjectionEngine } from './engines/projection.engine';
import { ScenarioEngine } from './engines/scenario.engine';
import { StateBuilderService } from './builders/state-builder.service';
import {
  ScenarioType,
  SimulationResult,
  Scenario,
} from './types/simulation.types';

@Injectable()
export class SimulationService {
  constructor(
    private readonly projectionEngine: ProjectionEngine,
    private readonly scenarioEngine: ScenarioEngine,
    private readonly stateBuilder: StateBuilderService,
  ) {}

  async getCurrentState(userId: string) {
    return this.stateBuilder.buildCurrentState(userId);
  }

  async runSimulation(
    userId: string,
    scenarioType: ScenarioType,
    parameters: Record<string, any>,
    timeHorizonMonths: number,
  ): Promise<SimulationResult> {
    const currentState = await this.stateBuilder.buildCurrentState(userId);
    const economicContext = this.stateBuilder.getDefaultEconomicContext();

    const scenario: Scenario = { type: scenarioType, parameters };
    const modifiedState = this.scenarioEngine.applyScenario(currentState, scenario);

    return this.projectionEngine.projectFuture({
      currentState: modifiedState,
      timeHorizonMonths,
      scenario,
      economicContext,
    });
  }

  async compareScenarios(
    userId: string,
    scenarios: Array<{ type: ScenarioType; parameters?: Record<string, any> }>,
    timeHorizonMonths: number,
  ): Promise<SimulationResult[]> {
    const results: SimulationResult[] = [];

    for (const scenario of scenarios) {
      const result = await this.runSimulation(
        userId,
        scenario.type,
        scenario.parameters ?? {},
        timeHorizonMonths,
      );
      results.push(result);
    }

    return results;
  }

  async generateFutureSelfPaths(
    userId: string,
    timeHorizonMonths: number,
  ): Promise<{ currentPath: SimulationResult; optimizedPath: SimulationResult }> {
    const [currentPath, optimizedPath] = await Promise.all([
      this.runSimulation(userId, ScenarioType.CURRENT_PATH, {}, timeHorizonMonths),
      this.runSimulation(userId, ScenarioType.OPTIMIZED, {}, timeHorizonMonths),
    ]);

    return { currentPath, optimizedPath };
  }
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/simulation/current-state` | Get user's current financial state |
| POST | `/simulation/run` | Run single scenario simulation |
| POST | `/simulation/compare` | Compare multiple scenarios |
| GET | `/simulation/future-self` | Get dual-path projection |

---

## Key Capabilities

1. **State Building**: Automatically constructs financial state from user data
2. **Scenario Modeling**: 10+ scenario types for different situations
3. **Economic Context**: Accounts for inflation and currency depreciation
4. **Milestone Detection**: Identifies key events (debt payoff, goal achievement)
5. **Cash Flow Scoring**: Ongoing score calculation throughout projection
6. **Comparison Engine**: Side-by-side scenario comparison

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@nestjs/common` | Core NestJS decorators |
| `@prisma/client` | Database ORM |

---

## Next Steps

After simulation engine, proceed to:
1. [13-goals-system.md](./13-goals-system.md) - Goal tracking and management
