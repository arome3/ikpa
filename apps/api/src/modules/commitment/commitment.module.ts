/**
 * Commitment Device Engine Module
 *
 * Creates real stakes for financial goals to increase achievement probability.
 * Research shows users with stakes are 3x more likely to achieve their goals.
 *
 * Features:
 * - Social Accountability (referee verification)
 * - Anti-Charity Stakes (donate to opposing cause if failed)
 * - Loss Pool (funds locked until goal achieved)
 * - Scheduled enforcement and reminders
 * - Full Opik distributed tracing integration
 *
 * @module CommitmentModule
 */

import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis';
import { AuthModule } from '../auth/auth.module';
import { CommitmentController } from './commitment.controller';
import { CommitmentService } from './commitment.service';
import { StakeService } from './stake.service';
import { RefereeService } from './referee.service';
import { UpgradeService } from './upgrade.service';
import { GroupService } from './group.service';
import { CommitmentCoachAgent, DebriefAgent } from './agents';
import { CommitmentEvalRunner } from './agents/commitment-eval-runner';
import { CommitmentRiskService } from './commitment-risk.service';
import { MockPaymentService } from './payment.service.mock';
import { CommitmentCronService } from './commitment.cron';
import { StreakService } from './streak.service';
import { SlipDetectorService } from './slip-detector.service';

/**
 * Module for the Commitment Device Engine
 *
 * Dependencies:
 * - PrismaModule: Database access for commitments, referees, verifications
 * - RedisModule: Distributed locking for cron jobs
 * - AuthModule: EmailService for referee invitations and notifications
 * - OpikModule: Global module for distributed tracing (auto-injected)
 */
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    forwardRef(() => AuthModule), // For EmailService
  ],
  controllers: [CommitmentController],
  providers: [
    CommitmentService,
    StakeService,
    RefereeService,
    UpgradeService,
    GroupService,
    CommitmentCoachAgent,
    DebriefAgent,
    CommitmentEvalRunner,
    CommitmentRiskService,
    MockPaymentService,
    CommitmentCronService,
    StreakService,
    SlipDetectorService,
  ],
  exports: [
    CommitmentService,
    StakeService,
    RefereeService,
    UpgradeService,
    GroupService,
    CommitmentCoachAgent,
    DebriefAgent,
    CommitmentEvalRunner,
    CommitmentRiskService,
    CommitmentCronService,
    StreakService,
    SlipDetectorService,
  ],
})
export class CommitmentModule {}
