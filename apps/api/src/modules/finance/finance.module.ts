import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { FinanceCronService } from './finance.cron';
import { CashFlowScoreCalculator, SimulationEngineCalculator } from './calculators';
import {
  IncomeController,
  SavingsController,
  InvestmentController,
  DebtController,
  GoalController,
  BudgetController,
  ExpenseController,
} from './controllers';
import {
  IncomeService,
  SavingsService,
  InvestmentService,
  DebtService,
  GoalCrudService,
  BudgetCrudService,
  ExpenseService,
  TimeMachineService,
} from './services';

/**
 * Finance Module
 *
 * Provides financial health metrics and analysis for IKPA users.
 *
 * Key Features:
 * - Cash Flow Score calculation (0-100)
 * - Financial snapshot management
 * - Score history and trend analysis
 * - Daily automated score calculations via cron
 * - Monte Carlo simulation engine for financial projections
 *
 * Dependencies:
 * - PrismaModule: Database access for financial data
 * - OpikModule: Global module providing distributed tracing (auto-injected)
 * - UserModule: User service for batch processing
 *
 * Exports:
 * - FinanceService: For use in other modules (e.g., AI coaching)
 * - SimulationEngineCalculator: For AI agents to run projections
 */
@Module({
  imports: [
    PrismaModule,
    UserModule,
  ],
  controllers: [
    FinanceController,
    IncomeController,
    SavingsController,
    InvestmentController,
    DebtController,
    GoalController,
    BudgetController,
    ExpenseController,
  ],
  providers: [
    FinanceService,
    FinanceCronService,
    CashFlowScoreCalculator,
    SimulationEngineCalculator,
    // CRUD Services
    IncomeService,
    SavingsService,
    InvestmentService,
    DebtService,
    GoalCrudService,
    BudgetCrudService,
    ExpenseService,
    TimeMachineService,
  ],
  exports: [
    FinanceService,
    SimulationEngineCalculator,
    // Export CRUD services for use in other modules
    IncomeService,
    SavingsService,
    InvestmentService,
    DebtService,
    GoalCrudService,
    BudgetCrudService,
    ExpenseService,
    TimeMachineService,
  ],
})
export class FinanceModule {}
