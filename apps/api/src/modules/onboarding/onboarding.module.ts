import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

/**
 * Onboarding Module
 *
 * Manages the 6-step onboarding flow for new users:
 * 1. Profile - Set country, currency, employment type
 * 2. Income - Add income sources (required)
 * 3. Savings - Add savings accounts (optional)
 * 4. Debts - Add debts (optional)
 * 5. Goals - Create financial goals (required)
 * 6. Budgets - Set category budgets (optional)
 *
 * Features:
 * - Progress tracking across steps
 * - Step validation (minimum requirements)
 * - Skip functionality for optional steps
 * - Profile updates during onboarding
 *
 * Dependencies:
 * - PrismaModule: Database access
 */
@Module({
  imports: [PrismaModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
