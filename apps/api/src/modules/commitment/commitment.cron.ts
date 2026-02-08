/**
 * Commitment Device Engine Cron Service
 *
 * Handles scheduled tasks for the Commitment Device Engine:
 * - Daily enforcement check (process expired commitments)
 * - Hourly deadline reminders
 * - Weekly referee follow-up
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OpikService } from '../ai/opik/opik.service';
import { RedisService } from '../../redis';
import { CommitmentService } from './commitment.service';
import { GroupService } from './group.service';
import { DebriefAgent } from './agents';
import { CommitmentStatus, VerificationMethod } from '@prisma/client';
import { differenceInHours } from 'date-fns';
import {
  COMMITMENT_CONSTANTS,
  COMMITMENT_TRACE_NAMES,
} from './constants';
import { EnforcementResult, ReminderResult, GroupOutcomeResult } from './interfaces';

@Injectable()
export class CommitmentCronService {
  private readonly logger = new Logger(CommitmentCronService.name);

  /** Lock keys for distributed coordination */
  private readonly ENFORCEMENT_LOCK_KEY = 'commitment:cron:enforcement';
  private readonly REMINDER_LOCK_KEY = 'commitment:cron:reminder';
  private readonly FOLLOWUP_LOCK_KEY = 'commitment:cron:followup';
  private readonly GROUP_RESOLVE_LOCK_KEY = 'commitment:cron:group_resolve';
  private readonly GROUP_NUDGE_LOCK_KEY = 'commitment:cron:group_nudge';

  /** Lock TTL in milliseconds */
  private readonly LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
    private readonly redisService: RedisService,
    private readonly commitmentService: CommitmentService,
    private readonly groupService: GroupService,
    private readonly debriefAgent: DebriefAgent,
  ) {}

  /**
   * Daily enforcement check - runs at 6 AM Africa/Lagos time
   *
   * Processes commitments where:
   * 1. Deadline has passed
   * 2. Status is still ACTIVE
   *
   * For REFEREE_VERIFY commitments:
   * - Changes status to PENDING_VERIFICATION
   * - Sends notification to referee
   *
   * For SELF_REPORT commitments:
   * - If no self-report after verification window, marks as FAILED
   * - Enforces stakes
   *
   * IDEMPOTENCY:
   * - Uses atomic updates with status check in WHERE clause
   * - Only processes contracts that are still ACTIVE (prevents reprocessing)
   * - Distributed lock prevents concurrent execution across instances
   */
  @Cron('0 6 * * *', {
    name: 'commitment-enforcement',
    timeZone: 'Africa/Lagos',
  })
  async runEnforcement(): Promise<EnforcementResult> {
    const lockValue = randomUUID();
    const startTime = Date.now();

    // Try to acquire distributed lock
    const lockAcquired = await this.redisService.acquireLock(
      this.ENFORCEMENT_LOCK_KEY,
      this.LOCK_TTL_MS,
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.debug('Commitment enforcement skipped: another instance is processing');
      return {
        processedContracts: 0,
        succeededContracts: 0,
        failedContracts: 0,
        pendingVerification: 0,
        errors: [],
      };
    }

    this.logger.log('Starting commitment enforcement job');

    const trace = this.opikService.createTrace({
      name: COMMITMENT_TRACE_NAMES.ENFORCE,
      input: { trigger: 'cron', schedule: '0 6 * * *' },
      metadata: { job: 'commitment-enforcement', version: '1.0' },
      tags: ['commitment', 'cron', 'enforcement'],
    });

    const result: EnforcementResult = {
      processedContracts: 0,
      succeededContracts: 0,
      failedContracts: 0,
      pendingVerification: 0,
      errors: [],
    };

    try {
      // Get all contracts needing enforcement
      const contracts = await this.commitmentService.getContractsPendingEnforcement();
      result.processedContracts = contracts.length;

      for (const contract of contracts) {
        try {
          if (contract.verificationMethod === VerificationMethod.REFEREE_VERIFY) {
            // Check if already in PENDING_VERIFICATION with self-verify logic
            const currentContract = await this.prisma.commitmentContract.findUnique({
              where: { id: contract.id },
              select: { status: true, selfVerifyOfferedAt: true, selfVerifyExpiresAt: true, selfVerifiedAt: true },
            });

            if (currentContract?.status === CommitmentStatus.ACTIVE) {
              // First time: move to PENDING_VERIFICATION
              const updateResult = await this.prisma.commitmentContract.updateMany({
                where: { id: contract.id, status: CommitmentStatus.ACTIVE },
                data: { status: CommitmentStatus.PENDING_VERIFICATION },
              });
              if (updateResult.count > 0) {
                result.pendingVerification++;
                this.logger.log(`[enforcement] Contract ${contract.id} moved to PENDING_VERIFICATION`);
              }
            } else if (currentContract?.status === CommitmentStatus.PENDING_VERIFICATION) {
              // Already pending — check grace period for self-verify
              const hoursOverdue = differenceInHours(new Date(), await this.getContractDeadline(contract.id));

              if (hoursOverdue >= COMMITMENT_CONSTANTS.GRACE_PERIOD_HOURS && !currentContract.selfVerifyOfferedAt) {
                // Offer self-verify after 48h grace period
                const selfVerifyExpires = new Date(Date.now() + COMMITMENT_CONSTANTS.SELF_VERIFY_EXTENSION_HOURS * 60 * 60 * 1000);
                await this.prisma.commitmentContract.update({
                  where: { id: contract.id },
                  data: {
                    selfVerifyOfferedAt: new Date(),
                    selfVerifyExpiresAt: selfVerifyExpires,
                  },
                });
                this.logger.log(`[enforcement] Contract ${contract.id}: self-verify offered (expires ${selfVerifyExpires.toISOString()})`);
              } else if (
                currentContract.selfVerifyExpiresAt &&
                currentContract.selfVerifyExpiresAt < new Date() &&
                !currentContract.selfVerifiedAt
              ) {
                // Self-verify window expired — auto-fail
                await this.processContractFailure(contract);
                result.failedContracts++;
                this.logger.log(`[enforcement] Contract ${contract.id}: self-verify expired, auto-failed`);
              } else if (hoursOverdue >= 96) {
                // Hard cutoff at 96h regardless
                if (!currentContract.selfVerifiedAt) {
                  await this.processContractFailure(contract);
                  result.failedContracts++;
                  this.logger.log(`[enforcement] Contract ${contract.id}: 96h hard cutoff, auto-failed`);
                }
              }
            }
          } else {
            // Check if verification window has passed
            const hoursOverdue = differenceInHours(
              new Date(),
              await this.getContractDeadline(contract.id),
            );

            if (hoursOverdue >= COMMITMENT_CONSTANTS.VERIFICATION_WINDOW_HOURS) {
              // IDEMPOTENT: Check status before processing failure
              const currentContract = await this.prisma.commitmentContract.findUnique({
                where: { id: contract.id },
                select: { status: true },
              });

              if (currentContract?.status === CommitmentStatus.ACTIVE) {
                // Auto-fail after verification window
                await this.processContractFailure(contract);
                result.failedContracts++;
              } else {
                this.logger.debug(
                  `[enforcement] Contract ${contract.id} already processed (status: ${currentContract?.status})`,
                );
              }
            } else {
              // IDEMPOTENT: Atomic update only if status is still ACTIVE
              const updateResult = await this.prisma.commitmentContract.updateMany({
                where: {
                  id: contract.id,
                  status: CommitmentStatus.ACTIVE,
                },
                data: { status: CommitmentStatus.PENDING_VERIFICATION },
              });

              if (updateResult.count > 0) {
                result.pendingVerification++;
              } else {
                this.logger.debug(
                  `[enforcement] Contract ${contract.id} already processed (status changed)`,
                );
              }
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Contract ${contract.id}: ${errorMessage}`);
          this.logger.error(`[enforcement] Failed for contract ${contract.id}: ${errorMessage}`);
        }
      }

      // Also get contracts in PENDING_VERIFICATION for grace period processing
      const pendingContracts = await this.prisma.commitmentContract.findMany({
        where: {
          status: CommitmentStatus.PENDING_VERIFICATION,
          verificationMethod: VerificationMethod.REFEREE_VERIFY,
        },
      });

      // Process pending contracts for grace period
      for (const contract of pendingContracts) {
        try {
          const hoursOverdue = differenceInHours(new Date(), contract.deadline);

          if (hoursOverdue >= COMMITMENT_CONSTANTS.GRACE_PERIOD_HOURS && !contract.selfVerifyOfferedAt) {
            const selfVerifyExpires = new Date(Date.now() + COMMITMENT_CONSTANTS.SELF_VERIFY_EXTENSION_HOURS * 60 * 60 * 1000);
            await this.prisma.commitmentContract.update({
              where: { id: contract.id },
              data: {
                selfVerifyOfferedAt: new Date(),
                selfVerifyExpiresAt: selfVerifyExpires,
              },
            });
            this.logger.log(`[enforcement] Contract ${contract.id}: self-verify offered`);
          } else if (
            contract.selfVerifyExpiresAt &&
            contract.selfVerifyExpiresAt < new Date() &&
            !contract.selfVerifiedAt
          ) {
            await this.processContractFailure(contract as any);
            result.failedContracts++;
          } else if (hoursOverdue >= 96 && !contract.selfVerifiedAt) {
            await this.processContractFailure(contract as any);
            result.failedContracts++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Pending contract ${contract.id}: ${errorMessage}`);
        }
      }

      const duration = Date.now() - startTime;

      this.opikService.endTrace(trace, {
        success: true,
        result: { ...result, durationMs: duration },
      });

      this.logger.log(
        `Commitment enforcement completed: ${result.processedContracts} processed, ` +
          `${result.failedContracts} failed, ${result.pendingVerification} pending (${duration}ms)`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      this.logger.error(`Commitment enforcement job failed: ${errorMessage}`);
      result.errors.push(errorMessage);
    } finally {
      await this.redisService.releaseLock(this.ENFORCEMENT_LOCK_KEY, lockValue);
      await this.opikService.flush();
    }

    return result;
  }

  /**
   * Hourly deadline reminders
   *
   * Sends reminders at:
   * - 7 days before deadline (168 hours)
   * - 1 day before deadline (24 hours)
   * - 1 hour before deadline
   *
   * IDEMPOTENCY:
   * - Tracks lastReminderSentAt to prevent duplicate reminders
   * - Uses atomic updates to mark reminders as sent
   * - Only sends reminder if enough time has passed since last reminder
   */
  @Cron('0 * * * *', {
    name: 'commitment-reminders',
    timeZone: 'Africa/Lagos',
  })
  async sendReminders(): Promise<ReminderResult> {
    const lockValue = randomUUID();

    const lockAcquired = await this.redisService.acquireLock(
      this.REMINDER_LOCK_KEY,
      this.LOCK_TTL_MS,
      lockValue,
    );

    if (!lockAcquired) {
      return { sentReminders: 0, contracts: [], errors: [] };
    }

    const result: ReminderResult = {
      sentReminders: 0,
      contracts: [],
      errors: [],
    };

    try {
      // Minimum hours between reminders to prevent duplicates
      const MIN_HOURS_BETWEEN_REMINDERS = 12;
      const reminderCutoff = new Date(
        Date.now() - MIN_HOURS_BETWEEN_REMINDERS * 60 * 60 * 1000,
      );

      for (const hours of COMMITMENT_CONSTANTS.REMINDER_HOURS_BEFORE) {
        const contracts = await this.commitmentService.getContractsNeedingReminder(hours);

        for (const contract of contracts) {
          try {
            // IDEMPOTENT: Check if reminder was recently sent
            const currentContract = await this.prisma.commitmentContract.findUnique({
              where: { id: contract.id },
              select: { lastReminderSentAt: true, status: true },
            });

            // Skip if contract is no longer active
            if (currentContract?.status !== CommitmentStatus.ACTIVE) {
              continue;
            }

            // Skip if reminder was recently sent
            if (
              currentContract?.lastReminderSentAt &&
              currentContract.lastReminderSentAt > reminderCutoff
            ) {
              this.logger.debug(
                `[reminder] Skipping ${hours}h reminder for contract ${contract.id} (recently sent)`,
              );
              continue;
            }

            // IDEMPOTENT: Atomic update to mark reminder as sent
            const updateResult = await this.prisma.commitmentContract.updateMany({
              where: {
                id: contract.id,
                status: CommitmentStatus.ACTIVE,
                OR: [
                  { lastReminderSentAt: null },
                  { lastReminderSentAt: { lt: reminderCutoff } },
                ],
              },
              data: { lastReminderSentAt: new Date() },
            });

            if (updateResult.count > 0) {
              // TODO: Send reminder notification
              this.logger.log(
                `[reminder] Sent ${hours}h reminder for contract ${contract.id}`,
              );

              result.sentReminders++;
              result.contracts.push({
                contractId: contract.id,
                userId: contract.userId,
                hoursRemaining: hours,
              });
            } else {
              this.logger.debug(
                `[reminder] Contract ${contract.id} already received reminder`,
              );
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Contract ${contract.id}: ${errorMessage}`);
          }
        }
      }

      if (result.sentReminders > 0) {
        this.logger.log(`Sent ${result.sentReminders} commitment reminders`);
      }
    } finally {
      await this.redisService.releaseLock(this.REMINDER_LOCK_KEY, lockValue);
    }

    return result;
  }

  /**
   * Weekly referee follow-up - runs Monday at 9 AM Africa/Lagos time
   *
   * Sends follow-up emails to referees who haven't verified pending commitments.
   *
   * IDEMPOTENCY:
   * - Uses Redis keys to track sent follow-ups with 7-day TTL
   * - Checks if follow-up was already sent this week before sending
   * - Distributed lock prevents concurrent execution
   */
  @Cron('0 9 * * 1', {
    name: 'commitment-referee-followup',
    timeZone: 'Africa/Lagos',
  })
  async followUpReferees(): Promise<{ followupsSent: number; skipped: number }> {
    const lockValue = randomUUID();

    const lockAcquired = await this.redisService.acquireLock(
      this.FOLLOWUP_LOCK_KEY,
      this.LOCK_TTL_MS,
      lockValue,
    );

    if (!lockAcquired) {
      return { followupsSent: 0, skipped: 0 };
    }

    let followupsSent = 0;
    let skipped = 0;
    const FOLLOWUP_TTL_DAYS = 7;
    const FOLLOWUP_TTL_MS = FOLLOWUP_TTL_DAYS * 24 * 60 * 60 * 1000;

    try {
      // Get all contracts pending verification
      const pendingContracts = await this.prisma.commitmentContract.findMany({
        where: {
          status: CommitmentStatus.PENDING_VERIFICATION,
          verifiedById: { not: null },
        },
        include: {
          referee: { select: { id: true, email: true, name: true } },
          user: { select: { name: true } },
          goal: { select: { name: true } },
        },
      });

      // Group by referee
      const byReferee = new Map<string, typeof pendingContracts>();
      for (const contract of pendingContracts) {
        if (contract.referee) {
          const existing = byReferee.get(contract.referee.id) || [];
          existing.push(contract);
          byReferee.set(contract.referee.id, existing);
        }
      }

      // Send follow-up to each referee
      for (const [refereeId, contracts] of byReferee) {
        const referee = contracts[0].referee;
        if (!referee) continue;

        // IDEMPOTENT: Check if follow-up was already sent this week
        const followupKey = `commitment:followup:${refereeId}`;
        const alreadySent = await this.redisService.get(followupKey);

        if (alreadySent) {
          this.logger.debug(
            `[followup] Skipping referee ${referee.email} (follow-up already sent this week)`,
          );
          skipped++;
          continue;
        }

        // IDEMPOTENT: Mark follow-up as sent before sending (at-most-once delivery)
        await this.redisService.set(followupKey, new Date().toISOString(), FOLLOWUP_TTL_MS);

        // TODO: Send follow-up email
        this.logger.log(
          `[followup] Sent follow-up to referee ${referee.email} for ${contracts.length} contracts`,
        );
        followupsSent++;
      }

      if (followupsSent > 0 || skipped > 0) {
        this.logger.log(
          `Referee follow-up completed: ${followupsSent} sent, ${skipped} skipped`,
        );
      }
    } finally {
      await this.redisService.releaseLock(this.FOLLOWUP_LOCK_KEY, lockValue);
    }

    return { followupsSent, skipped };
  }

  /**
   * Daily group outcome resolution - runs at 7 AM Africa/Lagos time
   *
   * Checks all ACTIVE groups where all member contracts are resolved.
   * If all succeeded, awards the group bonus badge.
   */
  @Cron('0 7 * * *', {
    name: 'commitment-group-resolve',
    timeZone: 'Africa/Lagos',
  })
  async resolveGroupOutcomes(): Promise<GroupOutcomeResult[]> {
    const lockValue = randomUUID();
    const lockAcquired = await this.redisService.acquireLock(
      this.GROUP_RESOLVE_LOCK_KEY,
      this.LOCK_TTL_MS,
      lockValue,
    );

    if (!lockAcquired) {
      return [];
    }

    const results: GroupOutcomeResult[] = [];

    try {
      const groupIds = await this.groupService.getGroupsPendingResolution();

      for (const groupId of groupIds) {
        try {
          const result = await this.groupService.resolveGroupOutcome(groupId);
          results.push(result);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`[group-resolve] Failed for group ${groupId}: ${msg}`);
        }
      }

      if (results.length > 0) {
        const bonusCount = results.filter((r) => r.bonusAwarded).length;
        this.logger.log(
          `Group resolution completed: ${results.length} groups resolved, ${bonusCount} bonus awards`,
        );
      }
    } finally {
      await this.redisService.releaseLock(this.GROUP_RESOLVE_LOCK_KEY, lockValue);
    }

    return results;
  }

  /**
   * Weekly group nudge - runs Sunday at 10 AM Africa/Lagos time
   *
   * Sends a summary nudge for each ACTIVE group:
   * "3/4 members are on track this week!"
   */
  @Cron('0 10 * * 0', {
    name: 'commitment-group-nudge',
    timeZone: 'Africa/Lagos',
  })
  async sendGroupWeeklyNudges(): Promise<{ nudgesSent: number }> {
    const lockValue = randomUUID();
    const lockAcquired = await this.redisService.acquireLock(
      this.GROUP_NUDGE_LOCK_KEY,
      this.LOCK_TTL_MS,
      lockValue,
    );

    if (!lockAcquired) {
      return { nudgesSent: 0 };
    }

    let nudgesSent = 0;

    try {
      const activeGroups = await this.prisma.commitmentGroup.findMany({
        where: { status: 'ACTIVE' },
        include: {
          members: {
            where: { leftAt: null },
            include: {
              contract: { select: { status: true, deadline: true } },
            },
          },
        },
      });

      for (const group of activeGroups) {
        const total = group.members.length;
        const onTrack = group.members.filter((m) => {
          if (!m.contract) return false;
          if (m.contract.status === 'SUCCEEDED') return true;
          if (m.contract.status === 'ACTIVE') {
            return new Date(m.contract.deadline) > new Date();
          }
          return false;
        }).length;

        // TODO: Emit event for notification service
        this.logger.log(
          `[group-nudge] Group "${group.name}": ${onTrack}/${total} on track`,
        );
        nudgesSent++;
      }

      if (nudgesSent > 0) {
        this.logger.log(`Weekly group nudges sent: ${nudgesSent}`);
      }
    } finally {
      await this.redisService.releaseLock(this.GROUP_NUDGE_LOCK_KEY, lockValue);
    }

    return { nudgesSent };
  }

  /**
   * Process contract failure and enforce stakes
   */
  private async processContractFailure(contract: {
    id: string;
    userId: string;
    stakeType: unknown;
    stakeAmount: unknown;
    antiCharityCause: string | null;
    antiCharityUrl: string | null;
  }): Promise<void> {
    // Get full contract for processing
    const fullContract = await this.prisma.commitmentContract.findUnique({
      where: { id: contract.id },
      include: { user: { select: { currency: true } } },
    });

    if (!fullContract) return;

    // Process failure (enforce stakes)
    await this.commitmentService.processFailedCommitment({
      ...fullContract,
      stakeAmount: fullContract.stakeAmount,
      user: fullContract.user,
    });

    // Update status
    await this.prisma.commitmentContract.update({
      where: { id: contract.id },
      data: {
        status: CommitmentStatus.FAILED,
        failedAt: new Date(),
      },
    });

    this.logger.log(`[enforcement] Contract ${contract.id} marked as FAILED`);

    // Fire-and-forget debrief generation
    this.debriefAgent.generateDebrief(contract.userId, contract.id).catch((e) => {
      this.logger.warn(`[processContractFailure] Debrief generation failed: ${e}`);
    });
  }

  /**
   * Get contract deadline
   */
  private async getContractDeadline(contractId: string): Promise<Date> {
    const contract = await this.prisma.commitmentContract.findUnique({
      where: { id: contractId },
      select: { deadline: true },
    });
    return contract?.deadline || new Date();
  }

  /**
   * Health check for cron jobs
   */
  getJobStatus(): Array<{
    jobName: string;
    schedule: string;
    timezone: string;
    description: string;
  }> {
    return [
      {
        jobName: 'commitment-enforcement',
        schedule: '0 6 * * *',
        timezone: 'Africa/Lagos',
        description: 'Daily enforcement check for expired commitments',
      },
      {
        jobName: 'commitment-reminders',
        schedule: '0 * * * *',
        timezone: 'Africa/Lagos',
        description: 'Hourly deadline reminders (7d, 1d, 1h before)',
      },
      {
        jobName: 'commitment-referee-followup',
        schedule: '0 9 * * 1',
        timezone: 'Africa/Lagos',
        description: 'Weekly referee follow-up for pending verifications',
      },
      {
        jobName: 'commitment-group-resolve',
        schedule: '0 7 * * *',
        timezone: 'Africa/Lagos',
        description: 'Daily group outcome resolution (bonus awards)',
      },
      {
        jobName: 'commitment-group-nudge',
        schedule: '0 10 * * 0',
        timezone: 'Africa/Lagos',
        description: 'Weekly group nudge notifications (Sundays)',
      },
    ];
  }

  /**
   * Manually trigger enforcement (for testing/admin)
   */
  async triggerManualEnforcement(): Promise<EnforcementResult> {
    return this.runEnforcement();
  }
}
