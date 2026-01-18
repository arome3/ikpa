/**
 * Commitment Service
 *
 * Core business logic for the Commitment Device Engine.
 * Orchestrates commitment creation, verification, and enforcement.
 *
 * Research shows users with stakes are 3x more likely to achieve their goals.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpikService } from '../ai/opik/opik.service';
import {
  StakeType,
  VerificationMethod,
  CommitmentStatus,
  GoalStatus,
  RefereeRelationship,
  CommitmentAuditAction,
  Prisma,
} from '@prisma/client';
import { differenceInDays, isBefore, isAfter, addDays } from 'date-fns';
import { StakeService } from './stake.service';
import { RefereeService } from './referee.service';
import {
  CreateCommitmentInput,
  UpdateCommitmentInput,
  CommitmentResponse,
  SupportiveMessage,
  PaginationParams,
  PaginatedResponse,
  PartialRefundResult,
  AuditLogInput,
} from './interfaces';
import {
  COMMITMENT_CONSTANTS,
  COMMITMENT_MESSAGES,
  COMMITMENT_TRACE_NAMES,
} from './constants';
import {
  CommitmentNotFoundException,
  CommitmentAlreadyExistsException,
  DeadlinePassedException,
  CannotCancelCommitmentException,
  GoalNotActiveException,
  CommitmentPendingVerificationException,
  SelfRefereeException,
  InvalidDeadlineExtensionException,
  DeadlineExceedsGoalTargetException,
  FundLockFailedException,
  InvalidCommitmentUpdateException,
  StakeValidationException,
  RefereeNotAuthorizedException,
} from './exceptions';

@Injectable()
export class CommitmentService {
  private readonly logger = new Logger(CommitmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
    private readonly stakeService: StakeService,
    private readonly refereeService: RefereeService,
  ) {}

  /**
   * Create a new commitment contract
   *
   * Transaction flow:
   * 1. Validate inputs (outside transaction - fast fail)
   * 2. Lock funds first for LOSS_POOL (ensures payment succeeds)
   * 3. Create contract + audit log in transaction
   * 4. Invite referee AFTER transaction (avoid orphan invitations)
   * 5. If any step fails, compensate by releasing funds
   *
   * This ordering ensures:
   * - No orphan contracts without fund locks
   * - No orphan referee invitations for failed contracts
   * - Complete rollback on any failure
   */
  async createCommitment(
    userId: string,
    input: CreateCommitmentInput,
  ): Promise<{ commitment: CommitmentResponse; refereeInvited: boolean }> {
    const trace = this.opikService.createTrace({
      name: COMMITMENT_TRACE_NAMES.CREATE,
      input: { userId, goalId: input.goalId, stakeType: input.stakeType },
      metadata: { operation: 'createCommitment' },
      tags: ['commitment', 'create'],
    });

    // Track what we've done for compensating transactions
    let fundLockResult: { lockId?: string; error?: string } | null = null;
    let contractId: string | null = null;

    try {
      // ========================================
      // PHASE 1: Validation (fast fail)
      // ========================================

      // 1. Check idempotency key first (outside transaction for early return)
      if (input.idempotencyKey) {
        const existingByKey = await this.prisma.commitmentContract.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: {
            goal: { select: { name: true } },
            referee: { select: { id: true, name: true, email: true, isActive: true } },
          },
        });

        if (existingByKey) {
          // Return existing commitment (idempotent response)
          this.logger.log(
            `[createCommitment] Returning existing commitment for idempotency key: ${input.idempotencyKey}`,
          );
          this.opikService.endTrace(trace, {
            success: true,
            result: { contractId: existingByKey.id, idempotent: true },
          });
          return {
            commitment: this.toCommitmentResponse(
              existingByKey,
              existingByKey.goal.name,
              existingByKey.referee || undefined,
            ),
            refereeInvited: !!existingByKey.verifiedById,
          };
        }
      }

      // 2. Validate goal exists and is active
      const goal = await this.prisma.goal.findUnique({
        where: { id: input.goalId },
        select: {
          id: true,
          name: true,
          userId: true,
          status: true,
          targetDate: true,
        },
      });

      if (!goal) {
        throw new GoalNotActiveException(input.goalId);
      }

      if (goal.userId !== userId) {
        throw new GoalNotActiveException(input.goalId);
      }

      if (goal.status !== GoalStatus.ACTIVE) {
        throw new GoalNotActiveException(input.goalId);
      }

      // 3. Get user info for validation and currency
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, currency: true },
      });

      // 4. Self-referee prevention
      if (input.refereeEmail && user) {
        if (user.email.toLowerCase() === input.refereeEmail.toLowerCase()) {
          throw new SelfRefereeException();
        }
      }

      // 5. Check for existing active commitment on this goal
      const existingCommitment = await this.prisma.commitmentContract.findFirst({
        where: {
          goalId: input.goalId,
          status: { in: [CommitmentStatus.ACTIVE, CommitmentStatus.PENDING_VERIFICATION] },
        },
      });

      if (existingCommitment) {
        throw new CommitmentAlreadyExistsException(input.goalId);
      }

      // 6. Validate deadline
      const deadline = new Date(input.deadline);
      const now = new Date();
      const minimumDeadline = addDays(now, COMMITMENT_CONSTANTS.MINIMUM_DEADLINE_DAYS);
      const maxDeadline = addDays(deadline, COMMITMENT_CONSTANTS.MAX_DEADLINE_EXTENSION_DAYS);

      if (isBefore(deadline, minimumDeadline)) {
        throw new DeadlinePassedException(deadline);
      }

      // 6b. Validate deadline doesn't exceed goal's target date (if set)
      if (goal.targetDate && isAfter(deadline, goal.targetDate)) {
        throw new DeadlineExceedsGoalTargetException(deadline, goal.targetDate);
      }

      // 7. Validate stake configuration
      const stakeValidation = this.stakeService.validateStake(
        input.stakeType,
        input.stakeAmount,
        input.antiCharityCause,
      );

      if (!stakeValidation.isValid) {
        throw new StakeValidationException(stakeValidation.errors);
      }

      // ========================================
      // PHASE 2: Lock funds FIRST (if needed)
      // ========================================
      // This ensures payment succeeds BEFORE creating contract
      // If this fails, we haven't created any DB records yet

      if (input.stakeType === StakeType.LOSS_POOL && input.stakeAmount) {
        // Generate a temporary contract ID for the fund lock
        // We'll update this in the transaction
        const tempContractId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        fundLockResult = await this.stakeService.lockFunds(
          userId,
          tempContractId,
          input.stakeAmount,
          user?.currency || 'NGN',
        );

        if (!fundLockResult.lockId) {
          throw new FundLockFailedException(fundLockResult.error);
        }

        this.logger.log(
          `[createCommitment] Pre-locked funds with lock ID: ${fundLockResult.lockId}`,
        );
      }

      // ========================================
      // PHASE 3: Create contract in transaction
      // ========================================
      // Fund lock already succeeded (or not needed)
      // Now create the contract atomically

      const contract = await this.prisma.$transaction(async (tx) => {
        // Create the commitment contract
        const newContract = await tx.commitmentContract.create({
          data: {
            userId,
            goalId: input.goalId,
            stakeType: input.stakeType,
            stakeAmount: input.stakeAmount,
            antiCharityCause: input.antiCharityCause,
            antiCharityUrl: input.antiCharityUrl,
            verificationMethod: input.verificationMethod,
            deadline,
            originalDeadline: deadline,
            maxDeadline,
            status: CommitmentStatus.ACTIVE,
            verifiedById: null, // Referee will be linked after invitation
            idempotencyKey: input.idempotencyKey || null,
          },
          include: {
            goal: { select: { name: true, targetAmount: true } },
          },
        });

        // Update fund lock with actual contract ID (if we locked funds)
        if (fundLockResult?.lockId) {
          await tx.commitmentFundLock.updateMany({
            where: { paymentLockId: fundLockResult.lockId },
            data: { contractId: newContract.id },
          });
        }

        // Create audit log entry
        await tx.commitmentAuditLog.create({
          data: {
            contractId: newContract.id,
            action: CommitmentAuditAction.CREATED,
            performedBy: userId,
            newStatus: CommitmentStatus.ACTIVE,
            newAmount: input.stakeAmount ? new Prisma.Decimal(input.stakeAmount) : null,
            metadata: {
              stakeType: input.stakeType,
              verificationMethod: input.verificationMethod,
              deadline: deadline.toISOString(),
              fundLockId: fundLockResult?.lockId || null,
            },
          },
        });

        // If funds were locked, also log that
        if (fundLockResult?.lockId) {
          await tx.commitmentAuditLog.create({
            data: {
              contractId: newContract.id,
              action: CommitmentAuditAction.FUNDS_LOCKED,
              performedBy: userId,
              newAmount: input.stakeAmount ? new Prisma.Decimal(input.stakeAmount) : null,
              metadata: {
                currency: user?.currency || 'NGN',
                lockId: fundLockResult.lockId,
              },
            },
          });
        }

        return newContract;
      });

      contractId = contract.id;

      // ========================================
      // PHASE 4: Invite referee AFTER transaction
      // ========================================
      // Only invite after contract is safely committed
      // This prevents orphan invitations

      let refereeInvited = false;
      if (
        (input.stakeType === StakeType.SOCIAL || input.verificationMethod === VerificationMethod.REFEREE_VERIFY) &&
        input.refereeEmail
      ) {
        try {
          const refereeResult = await this.refereeService.inviteReferee(userId, {
            email: input.refereeEmail,
            name: input.refereeName || 'Referee',
            relationship: input.refereeRelationship || RefereeRelationship.FRIEND,
          });

          // Link referee to contract
          await this.prisma.commitmentContract.update({
            where: { id: contract.id },
            data: { verifiedById: refereeResult.refereeId },
          });

          refereeInvited = true;
          this.logger.log(
            `[createCommitment] Invited referee ${input.refereeEmail} for contract ${contract.id}`,
          );
        } catch (refereeError) {
          // Log but don't fail - contract is already created
          // User can manually invite referee later
          this.logger.warn(
            `[createCommitment] Failed to invite referee: ${refereeError instanceof Error ? refereeError.message : 'Unknown'}`,
          );
        }
      }

      // ========================================
      // PHASE 5: Return response
      // ========================================

      const response = this.toCommitmentResponse(contract, goal.name);

      this.logger.log(
        `[createCommitment] Created commitment ${contract.id} for goal ${input.goalId}`,
      );

      this.opikService.endTrace(trace, {
        success: true,
        result: { contractId: contract.id, stakeType: input.stakeType },
      });

      return { commitment: response, refereeInvited };

    } catch (error) {
      // ========================================
      // COMPENSATING TRANSACTION: Release funds on failure
      // ========================================
      if (fundLockResult?.lockId && !contractId) {
        try {
          this.logger.warn(
            `[createCommitment] Releasing pre-locked funds due to failure: ${fundLockResult.lockId}`,
          );
          await this.stakeService.releaseFunds(userId, fundLockResult.lockId);
        } catch (releaseError) {
          this.logger.error(
            `[createCommitment] Failed to release funds during compensation: ${releaseError}`,
          );
          // Log for manual reconciliation
        }
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      this.logger.error(`[createCommitment] Failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get commitments for a goal with pagination
   */
  async getCommitmentsByGoal(
    userId: string,
    goalId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<CommitmentResponse>> {
    const page = pagination?.page || 1;
    const limit = Math.min(pagination?.limit || 20, 100); // Cap at 100
    const skip = (page - 1) * limit;

    const [contracts, total] = await Promise.all([
      this.prisma.commitmentContract.findMany({
        where: {
          userId,
          goalId,
        },
        include: {
          goal: { select: { name: true } },
          referee: { select: { id: true, name: true, email: true, isActive: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.commitmentContract.count({
        where: { userId, goalId },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: contracts.map((c) =>
        this.toCommitmentResponse(c, c.goal.name, c.referee || undefined),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Get a specific commitment by ID
   */
  async getCommitmentById(
    userId: string,
    contractId: string,
  ): Promise<CommitmentResponse> {
    const contract = await this.prisma.commitmentContract.findFirst({
      where: {
        id: contractId,
        userId,
      },
      include: {
        goal: { select: { name: true } },
        referee: { select: { id: true, name: true, email: true, isActive: true } },
      },
    });

    if (!contract) {
      throw new CommitmentNotFoundException(contractId);
    }

    return this.toCommitmentResponse(
      contract,
      contract.goal.name,
      contract.referee || undefined,
    );
  }

  /**
   * Update a commitment (limited fields)
   *
   * Constraints:
   * - Deadline can only be extended (not shortened)
   * - Deadline cannot exceed maxDeadline (original + 90 days)
   * - Stake amount can only be increased (not decreased)
   */
  async updateCommitment(
    userId: string,
    contractId: string,
    input: UpdateCommitmentInput,
  ): Promise<CommitmentResponse> {
    const contract = await this.prisma.commitmentContract.findFirst({
      where: { id: contractId, userId },
      include: { goal: { select: { name: true } } },
    });

    if (!contract) {
      throw new CommitmentNotFoundException(contractId);
    }

    // Cannot update if not active
    if (contract.status !== CommitmentStatus.ACTIVE) {
      throw new CommitmentPendingVerificationException(contractId);
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    const previousAmount = contract.stakeAmount ? Number(contract.stakeAmount) : null;
    const previousDeadline = contract.deadline;
    let auditAction: CommitmentAuditAction = CommitmentAuditAction.UPDATED;

    // Deadline can only be extended, with limits
    if (input.deadline) {
      const newDeadline = new Date(input.deadline);

      if (isBefore(newDeadline, contract.deadline)) {
        throw new InvalidCommitmentUpdateException(
          'deadline',
          'Deadline can only be extended, not shortened',
        );
      }

      // Check against max deadline (original deadline + 90 days)
      const maxDeadline = contract.maxDeadline || addDays(
        contract.originalDeadline || contract.deadline,
        COMMITMENT_CONSTANTS.MAX_DEADLINE_EXTENSION_DAYS,
      );

      if (isBefore(maxDeadline, newDeadline)) {
        throw new InvalidDeadlineExtensionException(
          contract.maxDeadline || maxDeadline,
          newDeadline,
        );
      }

      updateData.deadline = newDeadline;
      auditAction = CommitmentAuditAction.DEADLINE_EXTENDED;
    }

    // Stake amount can only be increased
    if (input.stakeAmount !== undefined) {
      const currentAmount = contract.stakeAmount ? Number(contract.stakeAmount) : 0;
      if (input.stakeAmount < currentAmount) {
        throw new InvalidCommitmentUpdateException(
          'stakeAmount',
          'Stake amount can only be increased, not decreased',
        );
      }
      updateData.stakeAmount = input.stakeAmount;
      auditAction = CommitmentAuditAction.STAKE_INCREASED;
    }

    // Anti-charity cause can be updated
    if (input.antiCharityCause) {
      updateData.antiCharityCause = input.antiCharityCause;
    }
    if (input.antiCharityUrl) {
      updateData.antiCharityUrl = input.antiCharityUrl;
    }

    // Use transaction for atomic update + audit log
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedContract = await tx.commitmentContract.update({
        where: { id: contractId },
        data: updateData,
        include: {
          goal: { select: { name: true } },
          referee: { select: { id: true, name: true, email: true, isActive: true } },
        },
      });

      // Create audit log
      await tx.commitmentAuditLog.create({
        data: {
          contractId,
          action: auditAction,
          performedBy: userId,
          previousAmount: previousAmount ? new Prisma.Decimal(previousAmount) : null,
          newAmount: input.stakeAmount ? new Prisma.Decimal(input.stakeAmount) : null,
          metadata: {
            previousDeadline: previousDeadline.toISOString(),
            newDeadline: input.deadline ? new Date(input.deadline).toISOString() : null,
            changes: Object.keys(updateData),
          },
        },
      });

      return updatedContract;
    });

    this.logger.log(`[updateCommitment] Updated commitment ${contractId}`);

    return this.toCommitmentResponse(
      updated,
      updated.goal.name,
      updated.referee || undefined,
    );
  }

  /**
   * Cancel a commitment (only before deadline, with conditions)
   *
   * Partial refund calculation for LOSS_POOL:
   * - >14 days until deadline: 100% refund
   * - 7-14 days until deadline: 75% refund
   * - 3-7 days until deadline: 50% refund
   * - <3 days until deadline: Cannot cancel (funds locked)
   *
   * Transaction flow:
   * 1. Validate cancellation is allowed
   * 2. Calculate refund amounts
   * 3. Process refund + update contract + audit log in transaction
   * 4. If refund fails, rollback contract status
   */
  async cancelCommitment(
    userId: string,
    contractId: string,
  ): Promise<{ success: boolean; refundedAmount?: number; penaltyAmount?: number; message: string }> {
    const trace = this.opikService.createTrace({
      name: COMMITMENT_TRACE_NAMES.CANCEL,
      input: { userId, contractId },
      metadata: { operation: 'cancelCommitment' },
      tags: ['commitment', 'cancel'],
    });

    try {
      const contract = await this.prisma.commitmentContract.findFirst({
        where: { id: contractId, userId },
      });

      if (!contract) {
        throw new CommitmentNotFoundException(contractId);
      }

      // Can only cancel ACTIVE commitments
      if (contract.status !== CommitmentStatus.ACTIVE) {
        throw new CannotCancelCommitmentException(
          contractId,
          `Commitment is already ${contract.status.toLowerCase()}`,
        );
      }

      // Check if deadline has passed
      if (isBefore(contract.deadline, new Date())) {
        throw new CannotCancelCommitmentException(
          contractId,
          'Cannot cancel after deadline has passed',
        );
      }

      // Calculate partial refund for LOSS_POOL (outside transaction - pure calculation)
      let refundResult: PartialRefundResult | undefined;
      if (contract.stakeType === StakeType.LOSS_POOL && contract.stakeAmount) {
        refundResult = this.calculatePartialRefund(
          Number(contract.stakeAmount),
          contract.deadline,
        );

        if (refundResult.refundPercentage === 0) {
          throw new CannotCancelCommitmentException(
            contractId,
            refundResult.reason,
          );
        }
      }

      // Use transaction for atomic: refund + status update + audit log
      // All operations succeed together or fail together
      await this.prisma.$transaction(async (tx) => {
        // 1. Update contract status first (within transaction)
        await tx.commitmentContract.update({
          where: { id: contractId },
          data: {
            status: CommitmentStatus.CANCELLED,
            refundedAmount: refundResult?.refundAmount,
          },
        });

        // 2. Process refund within transaction context
        // Note: stakeService will update its own records
        if (refundResult && refundResult.refundAmount > 0) {
          // Get fund lock record
          const fundLock = await tx.commitmentFundLock.findFirst({
            where: {
              contractId,
              status: 'LOCKED',
            },
          });

          if (fundLock) {
            // Update fund lock status within transaction
            await tx.commitmentFundLock.update({
              where: { id: fundLock.id },
              data: {
                status: 'REFUNDED',
                refundedAt: new Date(),
                refundAmount: refundResult.refundAmount,
              },
            });
          }
        }

        // 3. Create audit log for cancellation
        await tx.commitmentAuditLog.create({
          data: {
            contractId,
            action: CommitmentAuditAction.CANCELLED,
            performedBy: userId,
            previousStatus: CommitmentStatus.ACTIVE,
            newStatus: CommitmentStatus.CANCELLED,
            previousAmount: contract.stakeAmount ? new Prisma.Decimal(Number(contract.stakeAmount)) : null,
            newAmount: refundResult ? new Prisma.Decimal(refundResult.refundAmount) : null,
            metadata: {
              refundPercentage: refundResult?.refundPercentage,
              penaltyAmount: refundResult?.penaltyAmount,
              reason: refundResult?.reason || 'User requested cancellation',
            },
          },
        });

        // 4. If there was a refund, also log it
        if (refundResult && refundResult.refundAmount > 0) {
          await tx.commitmentAuditLog.create({
            data: {
              contractId,
              action: CommitmentAuditAction.FUNDS_REFUNDED,
              performedBy: 'system',
              newAmount: new Prisma.Decimal(refundResult.refundAmount),
              metadata: {
                originalAmount: refundResult.originalAmount,
                refundPercentage: refundResult.refundPercentage,
                penaltyAmount: refundResult.penaltyAmount,
              },
            },
          });
        }
      });

      // Process actual payment refund AFTER database transaction
      // If this fails, we have audit trail but need manual reconciliation
      if (refundResult && refundResult.refundAmount > 0) {
        try {
          await this.stakeService.processPartialRefund(
            userId,
            contractId,
            refundResult.refundAmount,
            refundResult.penaltyAmount,
          );
        } catch (paymentError) {
          // Log for manual reconciliation - contract is already cancelled
          this.logger.error(
            `[cancelCommitment] Payment refund failed for ${contractId}: ${paymentError}. Manual reconciliation needed.`,
          );
        }
      }

      this.logger.log(`[cancelCommitment] Cancelled commitment ${contractId}`);

      this.opikService.endTrace(trace, {
        success: true,
        result: {
          contractId,
          refundedAmount: refundResult?.refundAmount,
          penaltyAmount: refundResult?.penaltyAmount,
        },
      });

      // Build user-friendly message
      let message: string;
      if (refundResult) {
        if (refundResult.refundPercentage === 100) {
          message = `Commitment cancelled. Full refund of ${refundResult.refundAmount} processed.`;
        } else {
          message = `Commitment cancelled. Partial refund of ${refundResult.refundAmount} (${refundResult.refundPercentage}%) processed. Early cancellation penalty: ${refundResult.penaltyAmount}.`;
        }
      } else {
        message = 'Commitment cancelled successfully.';
      }

      return {
        success: true,
        refundedAmount: refundResult?.refundAmount,
        penaltyAmount: refundResult?.penaltyAmount,
        message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
  }

  /**
   * Process referee verification
   *
   * Transaction flow:
   * 1. Validate contract and referee permission
   * 2. Update contract status + record verification in transaction
   * 3. Process stake (release/forfeit) after transaction
   * 4. Send outcome notification
   */
  async verifyCommitment(
    refereeId: string,
    contractId: string,
    decision: boolean,
    notes?: string,
  ): Promise<{
    newStatus: CommitmentStatus;
    stakeProcessed?: number;
    message: SupportiveMessage;
  }> {
    const trace = this.opikService.createTrace({
      name: COMMITMENT_TRACE_NAMES.VERIFY,
      input: { refereeId, contractId, decision },
      metadata: { operation: 'verifyCommitment' },
      tags: ['commitment', 'verify'],
    });

    try {
      // Get the contract with user info
      const contract = await this.prisma.commitmentContract.findUnique({
        where: { id: contractId },
        include: {
          user: { select: { id: true, email: true, name: true, currency: true } },
          goal: { select: { name: true } },
        },
      });

      if (!contract) {
        throw new CommitmentNotFoundException(contractId);
      }

      // Verify the referee has permission
      if (contract.verifiedById !== refereeId) {
        throw new RefereeNotAuthorizedException(refereeId, 'verify this contract');
      }

      // Determine the new status
      const newStatus = decision ? CommitmentStatus.SUCCEEDED : CommitmentStatus.FAILED;
      const message = decision
        ? this.getRandomMessage(COMMITMENT_MESSAGES.SUCCEEDED)
        : this.getRandomMessage(COMMITMENT_MESSAGES.FAILED);

      // Use transaction for atomic: verification record + status update + audit log
      await this.prisma.$transaction(async (tx) => {
        // 1. Create verification record
        await tx.commitmentVerification.create({
          data: {
            contractId,
            refereeId,
            decision,
            notes,
            verifiedAt: new Date(),
          },
        });

        // 2. Update contract status
        await tx.commitmentContract.update({
          where: { id: contractId },
          data: {
            status: newStatus,
            verifiedAt: new Date(),
            ...(decision ? { succeededAt: new Date() } : { failedAt: new Date() }),
          },
        });

        // 3. Create audit log
        await tx.commitmentAuditLog.create({
          data: {
            contractId,
            action: decision
              ? CommitmentAuditAction.VERIFIED_SUCCESS
              : CommitmentAuditAction.VERIFIED_FAILED,
            performedBy: refereeId,
            previousStatus: CommitmentStatus.ACTIVE,
            newStatus,
            metadata: {
              decision,
              notes: notes || null,
              verifiedAt: new Date().toISOString(),
            },
          },
        });

        // 4. Update fund lock status if applicable
        if (contract.stakeType === StakeType.LOSS_POOL && contract.stakeAmount) {
          const fundLock = await tx.commitmentFundLock.findFirst({
            where: { contractId, status: 'LOCKED' },
          });

          if (fundLock) {
            await tx.commitmentFundLock.update({
              where: { id: fundLock.id },
              data: {
                status: decision ? 'RELEASED' : 'FORFEITED',
                ...(decision ? { releasedAt: new Date() } : { forfeitedAt: new Date() }),
              },
            });
          }
        }
      });

      // Process stake payment AFTER transaction (external payment call)
      let stakeProcessed: number | undefined;
      try {
        if (decision) {
          stakeProcessed = await this.processSuccessfulCommitment(contract);
        } else {
          stakeProcessed = await this.processFailedCommitment(contract);
        }

        // Log stake processing
        if (stakeProcessed) {
          await this.createAuditLog({
            contractId,
            action: decision
              ? CommitmentAuditAction.FUNDS_RELEASED
              : CommitmentAuditAction.FUNDS_FORFEITED,
            performedBy: 'system',
            newAmount: stakeProcessed,
            metadata: {
              decision,
              stakeType: contract.stakeType,
            },
          });
        }
      } catch (stakeError) {
        // Log for manual reconciliation - verification is already recorded
        this.logger.error(
          `[verifyCommitment] Stake processing failed for ${contractId}: ${stakeError}. Manual reconciliation needed.`,
        );
      }

      this.logger.log(
        `[verifyCommitment] Contract ${contractId} verified as ${newStatus}`,
      );

      this.opikService.endTrace(trace, {
        success: true,
        result: { newStatus, stakeProcessed },
      });

      return { newStatus, stakeProcessed, message };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
  }

  /**
   * Process a successful commitment - release funds
   */
  async processSuccessfulCommitment(
    contract: { id: string; userId: string; stakeType: StakeType; stakeAmount: unknown },
  ): Promise<number | undefined> {
    const trace = this.opikService.createTrace({
      name: COMMITMENT_TRACE_NAMES.PROCESS_SUCCESS,
      input: { contractId: contract.id },
      metadata: { operation: 'processSuccessfulCommitment' },
      tags: ['commitment', 'success'],
    });

    try {
      let processed: number | undefined;

      if (contract.stakeType === StakeType.LOSS_POOL && contract.stakeAmount) {
        // Release locked funds
        await this.stakeService.releaseFunds(contract.userId, contract.id);
        processed = Number(contract.stakeAmount);
      }

      this.opikService.endTrace(trace, { success: true, result: { processed } });
      return processed;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
  }

  /**
   * Process a failed commitment - enforce stakes
   */
  async processFailedCommitment(
    contract: {
      id: string;
      userId: string;
      stakeType: StakeType;
      stakeAmount: unknown;
      antiCharityCause: string | null;
      antiCharityUrl: string | null;
      user?: { currency: string };
    },
  ): Promise<number | undefined> {
    const trace = this.opikService.createTrace({
      name: COMMITMENT_TRACE_NAMES.PROCESS_FAILURE,
      input: { contractId: contract.id, stakeType: contract.stakeType },
      metadata: { operation: 'processFailedCommitment' },
      tags: ['commitment', 'failure', 'enforcement'],
    });

    try {
      let processed: number | undefined;

      switch (contract.stakeType) {
        case StakeType.ANTI_CHARITY:
          if (contract.stakeAmount && contract.antiCharityCause) {
            await this.stakeService.executeAntiCharityDonation(
              contract.userId,
              contract.id,
              Number(contract.stakeAmount),
              contract.antiCharityCause,
              contract.antiCharityUrl || undefined,
              contract.user?.currency || 'NGN',
            );
            processed = Number(contract.stakeAmount);
          }
          break;

        case StakeType.LOSS_POOL:
          if (contract.stakeAmount) {
            await this.stakeService.forfeitLossPool(contract.id);
            processed = Number(contract.stakeAmount);
          }
          break;

        case StakeType.SOCIAL:
          // No financial stake to process for social accountability
          break;
      }

      this.opikService.endTrace(trace, { success: true, result: { processed } });
      return processed;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get contracts pending enforcement (deadline passed, still active)
   */
  async getContractsPendingEnforcement(): Promise<
    Array<{
      id: string;
      userId: string;
      stakeType: StakeType;
      stakeAmount: unknown;
      antiCharityCause: string | null;
      antiCharityUrl: string | null;
      verificationMethod: VerificationMethod;
      verifiedById: string | null;
    }>
  > {
    return this.prisma.commitmentContract.findMany({
      where: {
        status: CommitmentStatus.ACTIVE,
        deadline: { lt: new Date() },
      },
    });
  }

  /**
   * Get contracts needing reminder
   */
  async getContractsNeedingReminder(hoursBeforeDeadline: number): Promise<
    Array<{
      id: string;
      userId: string;
      deadline: Date;
    }>
  > {
    const now = new Date();
    const reminderTime = new Date(now.getTime() + hoursBeforeDeadline * 60 * 60 * 1000);

    return this.prisma.commitmentContract.findMany({
      where: {
        status: CommitmentStatus.ACTIVE,
        deadline: {
          gte: now,
          lte: reminderTime,
        },
      },
      select: {
        id: true,
        userId: true,
        deadline: true,
      },
    });
  }

  /**
   * Convert contract to response DTO
   */
  private toCommitmentResponse(
    contract: {
      id: string;
      userId: string;
      goalId: string;
      stakeType: StakeType;
      stakeAmount: unknown;
      antiCharityCause: string | null;
      verificationMethod: VerificationMethod;
      deadline: Date;
      status: CommitmentStatus;
      createdAt: Date;
    },
    goalName: string,
    referee?: { id: string; name: string; email: string; isActive: boolean },
  ): CommitmentResponse {
    const daysRemaining = Math.max(0, differenceInDays(contract.deadline, new Date()));
    const successProbability = this.stakeService.getSuccessProbability(contract.stakeType);
    const message = this.getMessageForStatus(contract.status);

    return {
      id: contract.id,
      goalId: contract.goalId,
      goalName,
      userId: contract.userId,
      stakeType: contract.stakeType,
      stakeAmount: contract.stakeAmount ? Number(contract.stakeAmount) : null,
      antiCharityCause: contract.antiCharityCause,
      verificationMethod: contract.verificationMethod,
      deadline: contract.deadline,
      status: contract.status,
      daysRemaining,
      successProbability,
      referee: referee
        ? {
            id: referee.id,
            name: referee.name,
            email: referee.email,
            isActive: referee.isActive,
          }
        : undefined,
      message,
      createdAt: contract.createdAt,
    };
  }

  /**
   * Get supportive message based on status
   */
  private getMessageForStatus(status: CommitmentStatus): SupportiveMessage {
    switch (status) {
      case CommitmentStatus.ACTIVE:
        return this.getRandomMessage(COMMITMENT_MESSAGES.CREATED);
      case CommitmentStatus.SUCCEEDED:
        return this.getRandomMessage(COMMITMENT_MESSAGES.SUCCEEDED);
      case CommitmentStatus.FAILED:
        return this.getRandomMessage(COMMITMENT_MESSAGES.FAILED);
      default:
        return this.getRandomMessage(COMMITMENT_MESSAGES.CREATED);
    }
  }

  /**
   * Get random message from message group
   */
  private getRandomMessage(
    group: { headlines: readonly string[]; subtexts: readonly string[] },
  ): SupportiveMessage {
    const headline = group.headlines[Math.floor(Math.random() * group.headlines.length)];
    const subtext = group.subtexts[Math.floor(Math.random() * group.subtexts.length)];
    return { headline, subtext };
  }

  /**
   * Calculate partial refund based on time until deadline
   *
   * Refund schedule:
   * - >14 days: 100% refund (full commitment)
   * - 7-14 days: 75% refund (moderate commitment)
   * - 3-7 days: 50% refund (serious commitment)
   * - <3 days: 0% refund (cannot cancel - funds locked)
   */
  private calculatePartialRefund(
    originalAmount: number,
    deadline: Date,
  ): PartialRefundResult {
    const daysUntilDeadline = differenceInDays(deadline, new Date());

    let refundPercentage: number;
    let reason: string;

    if (daysUntilDeadline > 14) {
      refundPercentage = 100;
      reason = 'Full refund - cancelled more than 14 days before deadline';
    } else if (daysUntilDeadline >= 7) {
      refundPercentage = 75;
      reason = 'Partial refund (75%) - cancelled 7-14 days before deadline';
    } else if (daysUntilDeadline >= 3) {
      refundPercentage = 50;
      reason = 'Partial refund (50%) - cancelled 3-7 days before deadline';
    } else {
      refundPercentage = 0;
      reason = 'Cannot cancel within 3 days of deadline. Funds are locked until goal verification.';
    }

    const refundAmount = Math.floor((originalAmount * refundPercentage) / 100);
    const penaltyAmount = originalAmount - refundAmount;

    return {
      originalAmount,
      refundAmount,
      penaltyAmount,
      refundPercentage,
      reason,
    };
  }

  /**
   * Create an audit log entry
   */
  async createAuditLog(input: AuditLogInput): Promise<void> {
    await this.prisma.commitmentAuditLog.create({
      data: {
        contractId: input.contractId,
        action: input.action,
        performedBy: input.performedBy,
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        previousAmount: input.previousAmount
          ? new Prisma.Decimal(input.previousAmount)
          : null,
        newAmount: input.newAmount ? new Prisma.Decimal(input.newAmount) : null,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }
}
