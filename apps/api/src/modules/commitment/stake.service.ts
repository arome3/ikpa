/**
 * Stake Service
 *
 * Handles stake validation and processing for the Commitment Device Engine.
 * Responsible for:
 * - Validating stake requirements by type
 * - Locking/releasing funds for LOSS_POOL (database-backed)
 * - Processing anti-charity donations
 * - Calculating stake effectiveness metrics
 * - Processing partial refunds on cancellation
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpikService } from '../ai/opik/opik.service';
import { StakeType, CommitmentStatus, FundLockStatus } from '@prisma/client';
import { MockPaymentService } from './payment.service.mock';
import {
  StakeValidationResult,
  FundLockResult,
  DonationResult,
  PaymentResult,
  StakeEffectivenessMetrics,
} from './interfaces';
import {
  COMMITMENT_CONSTANTS,
  COMMITMENT_TRACE_NAMES,
} from './constants';
import { InsufficientStakeException } from './exceptions';

/**
 * Maximum retry attempts for payment operations
 */
const MAX_PAYMENT_RETRIES = 3;

/**
 * Base delay between retries (exponential backoff)
 */
const RETRY_BASE_DELAY_MS = 1000;

@Injectable()
export class StakeService {
  private readonly logger = new Logger(StakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
    private readonly paymentService: MockPaymentService,
  ) {}

  /**
   * Execute a payment operation with exponential backoff retry
   *
   * @param operation - The async payment operation to execute
   * @param operationName - Name for logging
   * @param maxRetries - Maximum retry attempts
   */
  private async withRetry<T>(
    operation: () => Promise<T & { success: boolean; error?: string }>,
    operationName: string,
    maxRetries: number = MAX_PAYMENT_RETRIES,
  ): Promise<T & { success: boolean; error?: string }> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();

        if (result.success) {
          if (attempt > 1) {
            this.logger.log(`[${operationName}] Succeeded after ${attempt} attempts`);
          }
          return result;
        }

        // Operation returned failure - check if retryable
        lastError = result.error;
        const isRetryable = this.isRetryableError(result.error || '');

        if (!isRetryable || attempt >= maxRetries) {
          this.logger.warn(
            `[${operationName}] Failed after ${attempt} attempts: ${lastError}`,
          );
          return result;
        }

        // Calculate delay with exponential backoff
        const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          `[${operationName}] Attempt ${attempt}/${maxRetries} failed: ${lastError}. Retrying in ${delayMs}ms...`,
        );
        await this.delay(delayMs);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        lastError = message;

        const isRetryable = this.isRetryableError(message);

        if (!isRetryable || attempt >= maxRetries) {
          this.logger.error(
            `[${operationName}] Exception after ${attempt} attempts: ${message}`,
          );
          throw error;
        }

        const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          `[${operationName}] Attempt ${attempt}/${maxRetries} threw: ${message}. Retrying in ${delayMs}ms...`,
        );
        await this.delay(delayMs);
      }
    }

    // Should not reach here, but return failure if we do
    return { success: false, error: lastError || 'Max retries exceeded' } as T & { success: boolean; error?: string };
  }

  /**
   * Check if an error is retryable (transient failure)
   */
  private isRetryableError(errorMessage: string): boolean {
    const retryablePatterns = [
      'temporarily unavailable',
      'timeout',
      'network error',
      'rate limit',
      'try again',
      'retry',
      'unavailable',
      '429',
      '502',
      '503',
      '504',
    ];

    const lowerMessage = errorMessage.toLowerCase();
    return retryablePatterns.some((pattern) =>
      lowerMessage.includes(pattern.toLowerCase()),
    );
  }

  /**
   * Delay helper for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate stake requirements for a given stake type
   */
  validateStake(
    stakeType: StakeType,
    amount?: number,
    antiCharityCause?: string,
  ): StakeValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (stakeType) {
      case StakeType.SOCIAL:
        // Social stakes don't require amount, just referee
        if (amount && amount > 0) {
          warnings.push('Amount is not used for SOCIAL stake type');
        }
        break;

      case StakeType.ANTI_CHARITY:
        // Anti-charity requires amount and cause
        if (!amount || amount <= 0) {
          errors.push('Stake amount is required for ANTI_CHARITY type');
        } else if (amount < COMMITMENT_CONSTANTS.MINIMUM_STAKE_AMOUNT) {
          errors.push(
            `Stake amount must be at least ${COMMITMENT_CONSTANTS.MINIMUM_STAKE_AMOUNT}`,
          );
        } else if (amount > COMMITMENT_CONSTANTS.MAXIMUM_STAKE_AMOUNT) {
          errors.push(
            `Stake amount cannot exceed ${COMMITMENT_CONSTANTS.MAXIMUM_STAKE_AMOUNT}`,
          );
        }

        if (!antiCharityCause || antiCharityCause.trim().length === 0) {
          errors.push('Anti-charity cause is required for ANTI_CHARITY type');
        }
        break;

      case StakeType.LOSS_POOL:
        // Loss pool requires amount
        if (!amount || amount <= 0) {
          errors.push('Stake amount is required for LOSS_POOL type');
        } else if (amount < COMMITMENT_CONSTANTS.MINIMUM_STAKE_AMOUNT) {
          errors.push(
            `Stake amount must be at least ${COMMITMENT_CONSTANTS.MINIMUM_STAKE_AMOUNT}`,
          );
        } else if (amount > COMMITMENT_CONSTANTS.MAXIMUM_STAKE_AMOUNT) {
          errors.push(
            `Stake amount cannot exceed ${COMMITMENT_CONSTANTS.MAXIMUM_STAKE_AMOUNT}`,
          );
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Lock funds for a LOSS_POOL commitment
   *
   * Uses database-backed storage for fund lock records to ensure:
   * - Persistence across server restarts
   * - Consistency across multiple API instances
   * - Complete audit trail
   */
  async lockFunds(
    userId: string,
    contractId: string,
    amount: number,
    currency: string = 'NGN',
  ): Promise<FundLockResult> {
    const trace = this.opikService.createTrace({
      name: COMMITMENT_TRACE_NAMES.CREATE,
      input: { userId, contractId, amount, currency },
      metadata: { operation: 'lockFunds' },
      tags: ['commitment', 'stake', 'lock'],
    });

    try {
      // Validate amount
      if (amount < COMMITMENT_CONSTANTS.MINIMUM_STAKE_AMOUNT) {
        throw new InsufficientStakeException(
          amount,
          COMMITMENT_CONSTANTS.MINIMUM_STAKE_AMOUNT,
          COMMITMENT_CONSTANTS.MAXIMUM_STAKE_AMOUNT,
        );
      }

      // Check if lock already exists for this contract (idempotency)
      const existingLock = await this.prisma.commitmentFundLock.findFirst({
        where: {
          contractId,
          status: FundLockStatus.LOCKED,
        },
      });

      if (existingLock) {
        this.logger.log(
          `[lockFunds] Lock already exists for contract ${contractId}, returning existing`,
        );
        return {
          success: true,
          lockId: existingLock.id,
          amount: Number(existingLock.amount),
        };
      }

      // Verify user has valid payment method
      const hasPaymentMethod = await this.paymentService.verifyPaymentMethod(userId);
      if (!hasPaymentMethod) {
        return {
          success: false,
          error: 'No valid payment method on file. Please add a payment method first.',
        };
      }

      // Lock the funds via payment service (with retry)
      const result = await this.withRetry(
        () => this.paymentService.lockFunds(userId, contractId, amount, currency),
        'lockFunds',
      );

      if (result.success && result.lockId) {
        // Store in database for persistence
        await this.prisma.commitmentFundLock.create({
          data: {
            contractId,
            paymentLockId: result.lockId,
            amount,
            currency,
            status: FundLockStatus.LOCKED,
            lockedAt: new Date(),
          },
        });

        this.logger.log(
          `[lockFunds] Successfully locked ${amount} ${currency} for contract ${contractId}`,
        );
      }

      this.opikService.endTrace(trace, {
        success: result.success,
        result: { lockId: result.lockId, amount },
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      this.logger.error(`[lockFunds] Failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Release funds on successful goal completion
   */
  async releaseFunds(_userId: string, contractId: string): Promise<PaymentResult> {
    // Get lock from database
    const fundLock = await this.prisma.commitmentFundLock.findFirst({
      where: {
        contractId,
        status: FundLockStatus.LOCKED,
      },
    });

    if (!fundLock) {
      this.logger.warn(`[releaseFunds] No lock found for contract ${contractId}`);
      return {
        success: true, // Consider it success if there's nothing to release
        transactionId: 'no_lock',
      };
    }

    // Release via payment service (with retry)
    const result = await this.withRetry(
      () => this.paymentService.releaseFunds(fundLock.paymentLockId),
      'releaseFunds',
    );

    if (result.success) {
      // Update database record
      await this.prisma.commitmentFundLock.update({
        where: { id: fundLock.id },
        data: {
          status: FundLockStatus.RELEASED,
          releasedAt: new Date(),
        },
      });
      this.logger.log(`[releaseFunds] Released funds for contract ${contractId}`);
    }

    return result;
  }

  /**
   * Execute anti-charity donation on failed commitment
   */
  async executeAntiCharityDonation(
    userId: string,
    contractId: string,
    amount: number,
    cause: string,
    causeUrl?: string,
    currency: string = 'NGN',
  ): Promise<DonationResult> {
    const trace = this.opikService.createTrace({
      name: COMMITMENT_TRACE_NAMES.PROCESS_FAILURE,
      input: { userId, contractId, amount, cause },
      metadata: { operation: 'executeAntiCharityDonation' },
      tags: ['commitment', 'stake', 'anti-charity', 'donation'],
    });

    try {
      // Process donation via payment service (with retry)
      const result = await this.withRetry(
        () => this.paymentService.processDonation(userId, contractId, amount, cause, causeUrl, currency),
        'processDonation',
      );

      this.opikService.endTrace(trace, {
        success: result.success,
        result: { donationId: result.donationId, amount, cause },
      });

      if (result.success) {
        this.logger.log(
          `[executeAntiCharityDonation] Donated ${amount} ${currency} to "${cause}" for contract ${contractId}`,
        );
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      this.logger.error(`[executeAntiCharityDonation] Failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Forfeit loss pool funds on failed commitment
   */
  async forfeitLossPool(contractId: string): Promise<PaymentResult> {
    // Get lock from database
    const fundLock = await this.prisma.commitmentFundLock.findFirst({
      where: {
        contractId,
        status: FundLockStatus.LOCKED,
      },
    });

    if (!fundLock) {
      this.logger.warn(`[forfeitLossPool] No lock found for contract ${contractId}`);
      return {
        success: true,
        transactionId: 'no_lock',
      };
    }

    // Forfeit via payment service (with retry)
    const result = await this.withRetry(
      () => this.paymentService.forfeitToPool(fundLock.paymentLockId),
      'forfeitToPool',
    );

    if (result.success) {
      // Update database record
      await this.prisma.commitmentFundLock.update({
        where: { id: fundLock.id },
        data: {
          status: FundLockStatus.FORFEITED,
          forfeitedAt: new Date(),
        },
      });
      this.logger.log(`[forfeitLossPool] Forfeited funds for contract ${contractId}`);
    }

    return result;
  }

  /**
   * Process partial refund on commitment cancellation
   *
   * @param userId - User ID
   * @param contractId - Contract ID
   * @param refundAmount - Amount to refund
   * @param penaltyAmount - Amount to forfeit as penalty
   */
  async processPartialRefund(
    userId: string,
    contractId: string,
    refundAmount: number,
    penaltyAmount: number,
  ): Promise<PaymentResult> {
    const trace = this.opikService.createTrace({
      name: COMMITMENT_TRACE_NAMES.CANCEL,
      input: { userId, contractId, refundAmount, penaltyAmount },
      metadata: { operation: 'processPartialRefund' },
      tags: ['commitment', 'stake', 'refund', 'partial'],
    });

    try {
      // Get lock from database
      const fundLock = await this.prisma.commitmentFundLock.findFirst({
        where: {
          contractId,
          status: FundLockStatus.LOCKED,
        },
      });

      if (!fundLock) {
        this.logger.warn(`[processPartialRefund] No lock found for contract ${contractId}`);
        return {
          success: true,
          transactionId: 'no_lock',
        };
      }

      // Process refund via payment service with retry (mock will handle the split)
      const result = await this.withRetry(
        () => this.paymentService.processPartialRefund(fundLock.paymentLockId, refundAmount, penaltyAmount),
        'processPartialRefund',
      );

      if (result.success) {
        // Update database record
        await this.prisma.commitmentFundLock.update({
          where: { id: fundLock.id },
          data: {
            status: FundLockStatus.REFUNDED,
            refundedAt: new Date(),
            refundAmount,
          },
        });
        this.logger.log(
          `[processPartialRefund] Refunded ${refundAmount} for contract ${contractId} (penalty: ${penaltyAmount})`,
        );
      }

      this.opikService.endTrace(trace, {
        success: result.success,
        result: { refundAmount, penaltyAmount },
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      this.logger.error(`[processPartialRefund] Failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Calculate stake effectiveness metrics for analytics
   */
  async calculateStakeEffectiveness(userId?: string): Promise<StakeEffectivenessMetrics[]> {
    const whereClause = userId ? { userId } : {};

    // Get all completed contracts grouped by stake type
    const stakeTypes = Object.values(StakeType);
    const metrics: StakeEffectivenessMetrics[] = [];

    for (const stakeType of stakeTypes) {
      const [total, successful, amountStats] = await Promise.all([
        // Total commitments
        this.prisma.commitmentContract.count({
          where: {
            ...whereClause,
            stakeType,
            status: { in: [CommitmentStatus.SUCCEEDED, CommitmentStatus.FAILED] },
          },
        }),
        // Successful commitments
        this.prisma.commitmentContract.count({
          where: {
            ...whereClause,
            stakeType,
            status: CommitmentStatus.SUCCEEDED,
          },
        }),
        // Average stake amount
        this.prisma.commitmentContract.aggregate({
          where: {
            ...whereClause,
            stakeType,
            stakeAmount: { not: null },
          },
          _avg: { stakeAmount: true },
        }),
      ]);

      const successRate = total > 0 ? successful / total : 0;

      metrics.push({
        stakeType,
        totalCommitments: total,
        successfulCommitments: successful,
        successRate,
        averageStakeAmount: amountStats._avg.stakeAmount
          ? Number(amountStats._avg.stakeAmount)
          : null,
        averageTimeToSuccess: null, // TODO: Calculate from succeededAt - createdAt
      });
    }

    return metrics;
  }

  /**
   * Get success probability based on stake type (research-backed)
   */
  getSuccessProbability(stakeType: StakeType): number {
    const multipliers = COMMITMENT_CONSTANTS.SUCCESS_RATE_MULTIPLIERS as Record<
      string,
      number
    >;
    const baseRate = 0.26; // Base success rate without commitment (26%)

    const multiplier = multipliers[stakeType] || 1;
    return Math.min(baseRate * multiplier, 0.95); // Cap at 95%
  }
}
