/**
 * Referee Service
 *
 * Manages accountability partners (referees) for the Commitment Device Engine.
 * Responsible for:
 * - Inviting and managing referees
 * - Processing verification tokens (JWT-based for security)
 * - Tracking referee engagement metrics
 * - Sending invitation/verification emails
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { OpikService } from '../ai/opik/opik.service';
import { EmailService } from '../auth/email.service';
import { CommitmentStatus } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import { addDays, differenceInHours, differenceInDays } from 'date-fns';
import {
  InviteRefereeInput,
  RefereeEngagementMetrics,
  PendingVerification,
} from './interfaces';
import {
  COMMITMENT_CONSTANTS,
  COMMITMENT_TRACE_NAMES,
} from './constants';
import {
  RefereeNotFoundException,
  RefereeNotAuthorizedException,
  InvalidInviteTokenException,
  RefereeLimitExceededException,
} from './exceptions';

/**
 * JWT payload for referee verification tokens
 */
interface RefereeTokenPayload {
  sub: string;       // Referee ID
  email: string;     // Referee email
  type: 'verify';    // Token type
  iat?: number;      // Issued at
  exp?: number;      // Expiration
}

@Injectable()
export class RefereeService implements OnModuleInit {
  private readonly logger = new Logger(RefereeService.name);
  private readonly frontendUrl: string;
  private readonly jwtSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || '';
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'commitment-referee-secret';
  }

  /**
   * Validate configuration on module init
   */
  onModuleInit() {
    if (!this.frontendUrl) {
      this.logger.warn(
        '[RefereeService] FRONTEND_URL not configured - using default. Set this in production!',
      );
      // Use a default for development, but log warning
      // TypeScript workaround for readonly property assignment
      Object.defineProperty(this, 'frontendUrl', {
        value: 'https://app.ikpa.app',
        writable: false,
      });
    }
  }

  /**
   * Invite a new referee
   */
  async inviteReferee(
    userId: string,
    input: InviteRefereeInput,
  ): Promise<{ refereeId: string; inviteExpires: Date }> {
    const trace = this.opikService.createTrace({
      name: COMMITMENT_TRACE_NAMES.INVITE_REFEREE,
      input: { userId, email: input.email },
      metadata: { operation: 'inviteReferee' },
      tags: ['commitment', 'referee', 'invite'],
    });

    try {
      // Check if referee already exists for this user
      const existingReferee = await this.prisma.commitmentReferee.findFirst({
        where: {
          email: input.email,
          invitedById: userId,
        },
      });

      // If referee doesn't exist, check the limit before creating
      if (!existingReferee) {
        const refereeCount = await this.prisma.commitmentReferee.count({
          where: { invitedById: userId },
        });

        if (refereeCount >= COMMITMENT_CONSTANTS.MAX_REFEREES_PER_USER) {
          throw new RefereeLimitExceededException(
            refereeCount,
            COMMITMENT_CONSTANTS.MAX_REFEREES_PER_USER,
          );
        }
      }

      if (existingReferee) {
        // Resend invitation if not yet accepted
        if (!existingReferee.isActive) {
          return this.resendInvitation(existingReferee.id);
        }

        this.opikService.endTrace(trace, {
          success: true,
          result: { refereeId: existingReferee.id, alreadyActive: true },
        });

        return {
          refereeId: existingReferee.id,
          inviteExpires: existingReferee.inviteExpires || new Date(),
        };
      }

      // Generate invite token
      const rawToken = randomBytes(32).toString('hex');
      const hashedToken = this.hashToken(rawToken);
      const inviteExpires = addDays(new Date(), COMMITMENT_CONSTANTS.REFEREE_INVITE_EXPIRY_DAYS);

      // Create referee record
      const referee = await this.prisma.commitmentReferee.create({
        data: {
          email: input.email,
          name: input.name,
          relationship: input.relationship,
          invitedById: userId,
          inviteToken: hashedToken,
          inviteExpires,
          isActive: false,
        },
      });

      // Get user info for email
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      // Send invitation email
      await this.sendRefereeInviteEmail(
        input.email,
        input.name,
        user?.name || 'A friend',
        rawToken,
      );

      this.logger.log(
        `[inviteReferee] Invited ${input.email} as referee for user ${userId}`,
      );

      this.opikService.endTrace(trace, {
        success: true,
        result: { refereeId: referee.id },
      });

      return {
        refereeId: referee.id,
        inviteExpires,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      this.logger.error(`[inviteReferee] Failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Resend invitation to an existing inactive referee
   */
  async resendInvitation(refereeId: string): Promise<{ refereeId: string; inviteExpires: Date }> {
    const referee = await this.prisma.commitmentReferee.findUnique({
      where: { id: refereeId },
      include: { invitedBy: { select: { name: true } } },
    });

    if (!referee) {
      throw new RefereeNotFoundException(refereeId);
    }

    // Generate new token
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = this.hashToken(rawToken);
    const inviteExpires = addDays(new Date(), COMMITMENT_CONSTANTS.REFEREE_INVITE_EXPIRY_DAYS);

    // Update referee with new token
    await this.prisma.commitmentReferee.update({
      where: { id: refereeId },
      data: {
        inviteToken: hashedToken,
        inviteExpires,
      },
    });

    // Resend email
    await this.sendRefereeInviteEmail(
      referee.email,
      referee.name,
      referee.invitedBy.name,
      rawToken,
    );

    this.logger.log(`[resendInvitation] Resent invitation to ${referee.email}`);

    return {
      refereeId,
      inviteExpires,
    };
  }

  /**
   * Accept referee invitation
   */
  async acceptInvitation(token: string): Promise<{
    refereeId: string;
    userName: string;
  }> {
    const hashedToken = this.hashToken(token);

    const referee = await this.prisma.commitmentReferee.findFirst({
      where: { inviteToken: hashedToken },
      include: { invitedBy: { select: { name: true } } },
    });

    if (!referee) {
      throw new InvalidInviteTokenException('Token not found or invalid');
    }

    if (referee.inviteExpires && referee.inviteExpires < new Date()) {
      throw new InvalidInviteTokenException('Invitation has expired');
    }

    if (referee.isActive) {
      // Already accepted
      return {
        refereeId: referee.id,
        userName: referee.invitedBy.name,
      };
    }

    // Activate the referee
    await this.prisma.commitmentReferee.update({
      where: { id: referee.id },
      data: {
        isActive: true,
        acceptedAt: new Date(),
        inviteToken: null, // Clear the token
      },
    });

    this.logger.log(`[acceptInvitation] Referee ${referee.id} accepted invitation`);

    return {
      refereeId: referee.id,
      userName: referee.invitedBy.name,
    };
  }

  /**
   * Get pending verifications for a referee by JWT token
   *
   * Token is verified and decoded to extract referee identity.
   * More secure than base64 as it prevents token tampering.
   */
  async getPendingVerifications(token: string): Promise<{
    pending: PendingVerification[];
    referee: { id: string; name: string };
  }> {
    // Verify and decode JWT token
    let payload: RefereeTokenPayload;
    try {
      payload = this.jwtService.verify<RefereeTokenPayload>(token, {
        secret: this.jwtSecret,
      });
    } catch (jwtError) {
      // Try legacy base64 format for backwards compatibility during migration
      try {
        const legacyEmail = Buffer.from(token, 'base64').toString('utf-8');
        if (legacyEmail.includes('@')) {
          this.logger.warn(
            `[getPendingVerifications] Legacy base64 token used for ${legacyEmail}. Should migrate to JWT.`,
          );
          // Fall through to lookup by email
          const legacyReferee = await this.prisma.commitmentReferee.findFirst({
            where: { email: legacyEmail, isActive: true },
          });
          if (legacyReferee) {
            payload = { sub: legacyReferee.id, email: legacyEmail, type: 'verify' };
          } else {
            throw new InvalidInviteTokenException('Invalid or expired verification token');
          }
        } else {
          throw new InvalidInviteTokenException('Invalid verification token format');
        }
      } catch {
        throw new InvalidInviteTokenException('Invalid or expired verification token');
      }
    }

    // Validate token type
    if (payload.type !== 'verify') {
      throw new InvalidInviteTokenException('Invalid token type');
    }

    // Lookup referee by ID from token
    const referee = await this.prisma.commitmentReferee.findFirst({
      where: {
        id: payload.sub,
        isActive: true,
      },
    });

    if (!referee) {
      throw new RefereeNotFoundException(payload.sub, payload.email);
    }

    // Find all contracts pending verification that this referee can verify
    const contracts = await this.prisma.commitmentContract.findMany({
      where: {
        verifiedById: referee.id,
        status: CommitmentStatus.PENDING_VERIFICATION,
      },
      include: {
        goal: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    });

    // Also find contracts where referee is assigned but status is still active (deadline passed)
    const activeContractsPastDeadline = await this.prisma.commitmentContract.findMany({
      where: {
        verifiedById: referee.id,
        status: CommitmentStatus.ACTIVE,
        deadline: { lt: new Date() },
      },
      include: {
        goal: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    });

    const allPendingContracts = [...contracts, ...activeContractsPastDeadline];

    const pending: PendingVerification[] = allPendingContracts.map((contract) => ({
      contractId: contract.id,
      goalName: contract.goal.name,
      userName: contract.user.name,
      userEmail: contract.user.email,
      stakeType: contract.stakeType,
      stakeAmount: contract.stakeAmount ? Number(contract.stakeAmount) : null,
      deadline: contract.deadline,
      daysOverdue: Math.max(0, differenceInDays(new Date(), contract.deadline)),
      createdAt: contract.createdAt,
    }));

    return {
      pending,
      referee: {
        id: referee.id,
        name: referee.name,
      },
    };
  }

  /**
   * Submit verification for a contract
   */
  async verifyContract(
    refereeId: string,
    contractId: string,
    decision: boolean,
    notes?: string,
  ): Promise<{ verificationId: string }> {
    const trace = this.opikService.createTrace({
      name: COMMITMENT_TRACE_NAMES.VERIFY,
      input: { refereeId, contractId, decision },
      metadata: { operation: 'verifyContract' },
      tags: ['commitment', 'referee', 'verify'],
    });

    try {
      // Verify the referee has permission
      const contract = await this.prisma.commitmentContract.findUnique({
        where: { id: contractId },
      });

      if (!contract) {
        throw new RefereeNotFoundException(contractId);
      }

      if (contract.verifiedById !== refereeId) {
        throw new RefereeNotAuthorizedException(refereeId, 'verify this contract');
      }

      // Create verification record
      const verification = await this.prisma.commitmentVerification.create({
        data: {
          contractId,
          refereeId,
          decision,
          notes,
          verifiedAt: new Date(),
        },
      });

      this.logger.log(
        `[verifyContract] Referee ${refereeId} verified contract ${contractId}: ${decision}`,
      );

      this.opikService.endTrace(trace, {
        success: true,
        result: { verificationId: verification.id, decision },
      });

      return { verificationId: verification.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get referee by ID
   */
  async getRefereeById(refereeId: string) {
    const referee = await this.prisma.commitmentReferee.findUnique({
      where: { id: refereeId },
    });

    if (!referee) {
      throw new RefereeNotFoundException(refereeId);
    }

    return referee;
  }

  /**
   * Get referees for a user
   */
  async getUserReferees(userId: string) {
    return this.prisma.commitmentReferee.findMany({
      where: { invitedById: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Calculate referee engagement metrics
   */
  async calculateRefereeEngagement(refereeId?: string): Promise<RefereeEngagementMetrics> {
    const whereClause = refereeId ? { id: refereeId } : {};

    const [totalReferees, activeReferees, verifications] = await Promise.all([
      this.prisma.commitmentReferee.count({ where: whereClause }),
      this.prisma.commitmentReferee.count({
        where: { ...whereClause, isActive: true },
      }),
      this.prisma.commitmentVerification.findMany({
        where: refereeId ? { refereeId } : {},
        select: { createdAt: true, verifiedAt: true },
      }),
    ]);

    // Calculate average response time
    let averageResponseTime = 0;
    if (verifications.length > 0) {
      const totalHours = verifications.reduce(
        (sum: number, v: { createdAt: Date; verifiedAt: Date }) => {
          return sum + differenceInHours(v.verifiedAt, v.createdAt);
        },
        0,
      );
      averageResponseTime = totalHours / verifications.length;
    }

    // Calculate verification rate
    const contractsNeedingVerification = await this.prisma.commitmentContract.count({
      where: {
        verifiedById: { not: null },
        status: { in: [CommitmentStatus.PENDING_VERIFICATION, CommitmentStatus.SUCCEEDED, CommitmentStatus.FAILED] },
      },
    });

    const verificationRate =
      contractsNeedingVerification > 0
        ? verifications.length / contractsNeedingVerification
        : 0;

    const metrics: RefereeEngagementMetrics = {
      totalReferees,
      activeReferees,
      averageResponseTime,
      verificationRate,
    };

    return metrics;
  }

  /**
   * Hash a token using SHA256
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Send referee invitation email using EmailService
   */
  private async sendRefereeInviteEmail(
    to: string,
    refereeName: string,
    userName: string,
    token: string,
  ): Promise<void> {
    const acceptUrl = `${this.frontendUrl}/commitment/accept-invite?token=${encodeURIComponent(token)}`;

    try {
      const result = await this.emailService.sendRefereeInviteEmail(
        to,
        refereeName,
        userName,
        acceptUrl,
      );

      if (result.success) {
        this.logger.log(
          `[sendRefereeInviteEmail] Sent invitation to ${to} (messageId: ${result.messageId})`,
        );
      } else {
        this.logger.warn(
          `[sendRefereeInviteEmail] Failed to send email to ${to}: ${result.error}`,
        );
      }
    } catch (error) {
      // Don't fail the whole flow if email fails
      this.logger.error(
        `[sendRefereeInviteEmail] Exception sending email to ${to}: ${error}`,
      );
    }
  }

  /**
   * Generate JWT verification token for an active referee
   *
   * Token contains:
   * - sub: referee ID
   * - email: referee email
   * - type: 'verify'
   *
   * Token expires in 30 days (configurable via constants)
   */
  generateVerificationToken(refereeId: string, email: string): string {
    const payload: RefereeTokenPayload = {
      sub: refereeId,
      email,
      type: 'verify',
    };

    return this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: `${COMMITMENT_CONSTANTS.REFEREE_VERIFICATION_TOKEN_DAYS}d`,
    });
  }

  /**
   * Send verification request email to referee when deadline passes
   */
  async sendVerificationRequestEmail(
    referee: { id: string; email: string; name: string },
    contract: { id: string; goalName: string; userName: string },
  ): Promise<void> {
    const token = this.generateVerificationToken(referee.id, referee.email);
    const verifyUrl = `${this.frontendUrl}/commitment/verify?token=${encodeURIComponent(token)}&contractId=${contract.id}`;

    try {
      const result = await this.emailService.sendVerificationRequestEmail(
        referee.email,
        referee.name,
        contract.userName,
        contract.goalName,
        verifyUrl,
      );

      if (result.success) {
        this.logger.log(
          `[sendVerificationRequestEmail] Sent request to ${referee.email} for contract ${contract.id}`,
        );
      } else {
        this.logger.warn(
          `[sendVerificationRequestEmail] Failed to send to ${referee.email}: ${result.error}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[sendVerificationRequestEmail] Exception: ${error}`,
      );
    }
  }
}
