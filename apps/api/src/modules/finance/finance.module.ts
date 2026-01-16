import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { FinanceCronService } from './finance.cron';
import { CashFlowScoreCalculator } from './calculators';

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
 *
 * Dependencies:
 * - PrismaModule: Database access for financial data
 * - OpikModule: Global module providing distributed tracing (auto-injected)
 * - UserModule: User service for batch processing
 *
 * Exports:
 * - FinanceService: For use in other modules (e.g., AI coaching)
 */
@Module({
  imports: [
    PrismaModule,
    UserModule,
  ],
  controllers: [FinanceController],
  providers: [
    FinanceService,
    FinanceCronService,
    CashFlowScoreCalculator,
  ],
  exports: [FinanceService],
})
export class FinanceModule {}
