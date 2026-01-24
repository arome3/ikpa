import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FinanceModule } from '../finance/finance.module';
import { UbuntuService } from './ubuntu.service';
import { UbuntuController } from './ubuntu.controller';
import { DependencyRatioCalculator } from './calculators';

/**
 * Ubuntu Manager Module
 *
 * Implements the Ubuntu philosophy: "I am because we are."
 *
 * This module recognizes that in African cultures, supporting family is a VALUE,
 * not a problem. It reframes family transfers as "Social Capital Investment" and
 * provides non-judgmental adjustments for family emergencies.
 *
 * Key Features:
 * - Dependency ratio tracking with culturally-calibrated thresholds
 * - Family support tracking with positive reframing
 * - Emergency reporting with multiple adjustment options
 * - Non-judgmental messaging throughout
 *
 * Dependencies:
 * - PrismaModule: Database access for financial data
 * - OpikModule: Global module providing distributed tracing (auto-injected)
 *
 * Exports:
 * - UbuntuService: For use in other modules
 * - DependencyRatioCalculator: For dependency ratio calculations
 */
@Module({
  imports: [PrismaModule, FinanceModule],
  controllers: [UbuntuController],
  providers: [UbuntuService, DependencyRatioCalculator],
  exports: [UbuntuService, DependencyRatioCalculator],
})
export class UbuntuModule {}
