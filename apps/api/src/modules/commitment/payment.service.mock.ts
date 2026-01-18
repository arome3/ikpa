/**
 * Mock Payment Service
 *
 * Simulates payment operations for the Commitment Device Engine.
 * This is a hackathon mock implementation - in production, this would
 * integrate with actual payment providers like Paystack, Flutterwave, etc.
 *
 * Operations:
 * - Lock funds for LOSS_POOL commitments
 * - Release funds on successful goal completion
 * - Process anti-charity donations on failure
 * - Forfeit locked funds on failure
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  PaymentResult,
  FundLockResult,
  DonationResult,
} from './interfaces';

/**
 * Mock lock record stored in memory
 */
interface MockLockRecord {
  lockId: string;
  userId: string;
  contractId: string;
  amount: number;
  currency: string;
  lockedAt: Date;
  status: 'LOCKED' | 'RELEASED' | 'FORFEITED';
}

/**
 * Mock donation record stored in memory
 */
interface MockDonationRecord {
  donationId: string;
  userId: string;
  contractId: string;
  amount: number;
  currency: string;
  cause: string;
  causeUrl?: string;
  processedAt: Date;
}

@Injectable()
export class MockPaymentService {
  private readonly logger = new Logger(MockPaymentService.name);

  /**
   * In-memory storage for mock locks (would be database in production)
   */
  private readonly locks = new Map<string, MockLockRecord>();

  /**
   * In-memory storage for mock donations
   */
  private readonly donations = new Map<string, MockDonationRecord>();

  /**
   * Lock funds for a LOSS_POOL commitment
   *
   * In production, this would:
   * 1. Verify user has sufficient balance
   * 2. Create a hold/escrow on the payment provider
   * 3. Store the lock reference in database
   *
   * @param userId - User whose funds to lock
   * @param contractId - Associated commitment contract ID
   * @param amount - Amount to lock
   * @param currency - Currency code (NGN, GHS, etc.)
   */
  async lockFunds(
    userId: string,
    contractId: string,
    amount: number,
    currency: string = 'NGN',
  ): Promise<FundLockResult> {
    // Simulate network delay
    await this.simulateDelay(100, 300);

    // Simulate occasional failures (5% chance)
    if (Math.random() < 0.05) {
      this.logger.warn(`[lockFunds] Simulated failure for user ${userId}`);
      return {
        success: false,
        error: 'Payment provider temporarily unavailable. Please try again.',
      };
    }

    const lockId = `lock_${randomUUID().substring(0, 8)}`;
    const lockRecord: MockLockRecord = {
      lockId,
      userId,
      contractId,
      amount,
      currency,
      lockedAt: new Date(),
      status: 'LOCKED',
    };

    this.locks.set(lockId, lockRecord);

    this.logger.log(
      `[lockFunds] Locked ${amount} ${currency} for user ${userId}, contract ${contractId}`,
    );

    return {
      success: true,
      lockId,
      amount,
    };
  }

  /**
   * Release locked funds back to user on successful goal completion
   *
   * In production, this would:
   * 1. Verify the lock exists and belongs to the contract
   * 2. Release the hold on the payment provider
   * 3. Update the lock status in database
   *
   * @param lockId - ID of the lock to release
   */
  async releaseFunds(lockId: string): Promise<PaymentResult> {
    await this.simulateDelay(100, 200);

    const lock = this.locks.get(lockId);

    if (!lock) {
      return {
        success: false,
        error: `Lock ${lockId} not found`,
      };
    }

    if (lock.status !== 'LOCKED') {
      return {
        success: false,
        error: `Lock ${lockId} is already ${lock.status.toLowerCase()}`,
      };
    }

    lock.status = 'RELEASED';
    this.locks.set(lockId, lock);

    this.logger.log(
      `[releaseFunds] Released ${lock.amount} ${lock.currency} back to user ${lock.userId}`,
    );

    return {
      success: true,
      transactionId: `release_${randomUUID().substring(0, 8)}`,
    };
  }

  /**
   * Process anti-charity donation on failed commitment
   *
   * In production, this would:
   * 1. Charge the user's payment method
   * 2. Transfer funds to the anti-charity organization
   * 3. Generate donation receipt
   * 4. Store donation record for tax/audit purposes
   *
   * @param userId - User to charge
   * @param contractId - Associated commitment contract
   * @param amount - Amount to donate
   * @param cause - Name of the anti-charity cause
   * @param causeUrl - Optional URL of the organization
   * @param currency - Currency code
   */
  async processDonation(
    userId: string,
    contractId: string,
    amount: number,
    cause: string,
    causeUrl?: string,
    currency: string = 'NGN',
  ): Promise<DonationResult> {
    await this.simulateDelay(200, 500);

    // Simulate occasional failures (5% chance)
    if (Math.random() < 0.05) {
      this.logger.warn(`[processDonation] Simulated failure for user ${userId}`);
      return {
        success: false,
        error: 'Donation processing failed. Will retry automatically.',
      };
    }

    const donationId = `donation_${randomUUID().substring(0, 8)}`;
    const donationRecord: MockDonationRecord = {
      donationId,
      userId,
      contractId,
      amount,
      currency,
      cause,
      causeUrl,
      processedAt: new Date(),
    };

    this.donations.set(donationId, donationRecord);

    this.logger.log(
      `[processDonation] Processed ${amount} ${currency} donation to "${cause}" from user ${userId}`,
    );

    return {
      success: true,
      donationId,
      amount,
      cause,
    };
  }

  /**
   * Forfeit locked funds on failed commitment (LOSS_POOL)
   *
   * In production, this would:
   * 1. Verify the lock exists
   * 2. Transfer funds to a general loss pool (or community pot)
   * 3. Mark the lock as forfeited
   *
   * @param lockId - ID of the lock to forfeit
   */
  async forfeitToPool(lockId: string): Promise<PaymentResult> {
    await this.simulateDelay(100, 200);

    const lock = this.locks.get(lockId);

    if (!lock) {
      return {
        success: false,
        error: `Lock ${lockId} not found`,
      };
    }

    if (lock.status !== 'LOCKED') {
      return {
        success: false,
        error: `Lock ${lockId} is already ${lock.status.toLowerCase()}`,
      };
    }

    lock.status = 'FORFEITED';
    this.locks.set(lockId, lock);

    this.logger.log(
      `[forfeitToPool] Forfeited ${lock.amount} ${lock.currency} from user ${lock.userId} to loss pool`,
    );

    return {
      success: true,
      transactionId: `forfeit_${randomUUID().substring(0, 8)}`,
    };
  }

  /**
   * Get lock status
   */
  async getLockStatus(lockId: string): Promise<MockLockRecord | null> {
    return this.locks.get(lockId) || null;
  }

  /**
   * Get all locks for a user (for admin/debugging)
   */
  async getUserLocks(userId: string): Promise<MockLockRecord[]> {
    return Array.from(this.locks.values()).filter(
      (lock) => lock.userId === userId,
    );
  }

  /**
   * Get all donations for a user (for admin/debugging)
   */
  async getUserDonations(userId: string): Promise<MockDonationRecord[]> {
    return Array.from(this.donations.values()).filter(
      (donation) => donation.userId === userId,
    );
  }

  /**
   * Verify payment method is valid (mock)
   * In production, this would verify the user has a valid payment method on file
   */
  async verifyPaymentMethod(userId: string): Promise<boolean> {
    await this.simulateDelay(50, 100);
    // Always return true in mock mode
    // In production, check if user has valid card/bank account
    this.logger.debug(`[verifyPaymentMethod] Mock verified for user ${userId}`);
    return true;
  }

  /**
   * Process partial refund on commitment cancellation
   *
   * In production, this would:
   * 1. Verify the lock exists and is in LOCKED status
   * 2. Process partial refund to user's original payment method
   * 3. Transfer penalty amount to platform/loss pool
   * 4. Update lock status
   *
   * @param lockId - ID of the lock
   * @param refundAmount - Amount to refund to user
   * @param penaltyAmount - Amount to retain as penalty
   */
  async processPartialRefund(
    lockId: string,
    refundAmount: number,
    penaltyAmount: number,
  ): Promise<PaymentResult> {
    await this.simulateDelay(150, 300);

    const lock = this.locks.get(lockId);

    if (!lock) {
      return {
        success: false,
        error: `Lock ${lockId} not found`,
      };
    }

    if (lock.status !== 'LOCKED') {
      return {
        success: false,
        error: `Lock ${lockId} is already ${lock.status.toLowerCase()}`,
      };
    }

    // Simulate occasional failures (5% chance)
    if (Math.random() < 0.05) {
      this.logger.warn(`[processPartialRefund] Simulated failure for lock ${lockId}`);
      return {
        success: false,
        error: 'Refund processing failed. Will retry automatically.',
      };
    }

    // Update lock status to RELEASED (partial refund is still a release)
    lock.status = 'RELEASED';
    this.locks.set(lockId, lock);

    this.logger.log(
      `[processPartialRefund] Processed partial refund: ${refundAmount} ${lock.currency} refunded, ${penaltyAmount} ${lock.currency} retained as penalty for user ${lock.userId}`,
    );

    return {
      success: true,
      transactionId: `partial_refund_${randomUUID().substring(0, 8)}`,
    };
  }

  /**
   * Clear all stored locks (for testing cleanup)
   */
  clearAllLocks(): void {
    this.locks.clear();
    this.logger.debug('[clearAllLocks] Cleared all mock locks');
  }

  /**
   * Clear all stored donations (for testing cleanup)
   */
  clearAllDonations(): void {
    this.donations.clear();
    this.logger.debug('[clearAllDonations] Cleared all mock donations');
  }

  /**
   * Clear all data (for testing cleanup)
   */
  clearAll(): void {
    this.clearAllLocks();
    this.clearAllDonations();
    this.logger.debug('[clearAll] Cleared all mock data');
  }

  /**
   * Get stats for monitoring
   */
  getStats(): { totalLocks: number; activeLocks: number; totalDonations: number } {
    const locks = Array.from(this.locks.values());
    return {
      totalLocks: locks.length,
      activeLocks: locks.filter(l => l.status === 'LOCKED').length,
      totalDonations: this.donations.size,
    };
  }

  /**
   * Simulate network delay
   */
  private async simulateDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs) + minMs);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
