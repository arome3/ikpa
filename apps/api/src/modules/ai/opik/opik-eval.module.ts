/**
 * Opik Evaluation Showcase Module
 *
 * Registers the OpikEvalController which exposes evaluation endpoints
 * for judges to trigger eval runs, view metrics, and inspect experiments.
 *
 * Imports GpsModule and CommitmentModule to access their eval runners
 * and agents. Global modules (OpikModule, PrismaModule) are auto-injected.
 */

import { Module } from '@nestjs/common';
import { GpsModule } from '../../gps/gps.module';
import { CommitmentModule } from '../../commitment/commitment.module';
import { OpikEvalController } from './opik-eval.controller';

@Module({
  imports: [GpsModule, CommitmentModule],
  controllers: [OpikEvalController],
})
export class OpikEvalModule {}
