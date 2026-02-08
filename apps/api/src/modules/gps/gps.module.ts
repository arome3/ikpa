/**
 * GPS Re-Router Module
 *
 * Helps users recover from budget overspending without abandoning their
 * financial goals. Implements behavioral economics principles to combat
 * the "What-The-Hell Effect" where one slip leads to total abandonment.
 *
 * Features:
 * - Budget overspend detection (80%, 100%, 120% thresholds)
 * - Monte Carlo simulation for goal probability calculation
 * - Three recovery paths with action execution (timeline, rate, freeze)
 * - Non-judgmental messaging (banned words validation)
 * - Full Opik distributed tracing integration
 * - Recovery session tracking for analytics
 * - Proactive budget threshold event listening
 * - Multi-goal impact assessment
 * - Comprehensive analytics and metrics collection
 *
 * @module GpsModule
 */

import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../../prisma/prisma.module';
import { FinanceModule } from '../finance/finance.module';
import { CommitmentModule } from '../commitment/commitment.module';
import { RedisModule } from '../../redis';
import { GpsService } from './gps.service';
import { GpsController } from './gps.controller';
import { BudgetService } from './budget.service';
import { GoalService } from './goal.service';
import { RecoveryActionService } from './recovery-action.service';
import { GpsAnalyticsService } from './gps-analytics.service';
import { BudgetEventListener } from './budget-event.listener';
import { GpsCronService } from './gps.cron';
import { CategoryFreezeGuardService } from './category-freeze-guard.service';
import { GpsIntegrationService } from './gps-integration.service';
import { StreakService } from './streaks';
import { ProgressService } from './progress';
import {
  GpsNotificationService,
  GpsNotificationListener,
  WhatsAppService,
  GpsWhatsAppNotificationService,
} from './notification';
import { GpsRerouterAgent } from './agents';

/**
 * Module for the GPS Re-Router budget recovery system
 *
 * Dependencies:
 * - PrismaModule: Database access for budgets, sessions, expenses
 * - FinanceModule: SimulationEngineCalculator for probability calculations
 * - EventEmitterModule: For proactive budget threshold events
 * - OpikModule: Global module for distributed tracing (auto-injected)
 */
@Module({
  imports: [
    PrismaModule,
    FinanceModule,
    CommitmentModule,
    RedisModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [GpsController],
  providers: [
    GpsService,
    BudgetService,
    GoalService,
    RecoveryActionService,
    GpsAnalyticsService,
    BudgetEventListener,
    GpsCronService,
    CategoryFreezeGuardService,
    GpsIntegrationService,
    StreakService,
    ProgressService,
    GpsNotificationService,
    GpsNotificationListener,
    WhatsAppService,
    GpsWhatsAppNotificationService,
    GpsRerouterAgent,
  ],
  exports: [
    GpsService,
    BudgetService,
    GoalService,
    RecoveryActionService,
    GpsAnalyticsService,
    GpsCronService,
    CategoryFreezeGuardService,
    BudgetEventListener,
    GpsIntegrationService, // Primary integration point for other modules
    StreakService,
    ProgressService,
    GpsNotificationService,
    GpsRerouterAgent,
  ],
})
export class GpsModule {}
