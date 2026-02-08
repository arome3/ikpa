/**
 * Commitment Device Engine Interfaces
 *
 * Type definitions for the commitment system.
 */

import {
  StakeType,
  VerificationMethod,
  CommitmentStatus,
  RefereeRelationship,
  FundLockStatus,
  CommitmentAuditAction,
} from '@prisma/client';

/**
 * Commitment contract data structure
 */
export interface CommitmentContract {
  id: string;
  userId: string;
  goalId: string;
  stakeType: StakeType;
  stakeAmount: number | null;
  antiCharityCause: string | null;
  antiCharityUrl: string | null;
  verificationMethod: VerificationMethod;
  deadline: Date;
  status: CommitmentStatus;
  failedAt: Date | null;
  succeededAt: Date | null;
  verifiedById: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Referee data structure
 */
export interface CommitmentReferee {
  id: string;
  email: string;
  name: string;
  relationship: RefereeRelationship;
  invitedById: string;
  inviteToken: string | null;
  inviteExpires: Date | null;
  acceptedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Verification record
 */
export interface CommitmentVerification {
  id: string;
  contractId: string;
  refereeId: string;
  decision: boolean;
  notes: string | null;
  verifiedAt: Date;
  createdAt: Date;
}

/**
 * Create commitment input
 */
export interface CreateCommitmentInput {
  goalId: string;
  stakeType: StakeType;
  stakeAmount?: number;
  antiCharityCause?: string;
  antiCharityUrl?: string;
  verificationMethod: VerificationMethod;
  deadline: Date;
  refereeEmail?: string;
  refereeName?: string;
  refereeRelationship?: RefereeRelationship;
  idempotencyKey?: string; // Client-provided key to prevent duplicates
}

/**
 * Update commitment input
 */
export interface UpdateCommitmentInput {
  deadline?: Date;
  stakeAmount?: number;
  antiCharityCause?: string;
  antiCharityUrl?: string;
}

/**
 * Invite referee input
 */
export interface InviteRefereeInput {
  email: string;
  name: string;
  relationship: RefereeRelationship;
}

/**
 * Verification decision input
 */
export interface VerifyCommitmentInput {
  decision: boolean;
  notes?: string;
}

/**
 * Stake validation result
 */
export interface StakeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Commitment response with enriched data
 */
export interface CommitmentResponse {
  id: string;
  goalId: string;
  goalName: string;
  userId: string;
  stakeType: StakeType;
  stakeAmount: number | null;
  antiCharityCause: string | null;
  verificationMethod: VerificationMethod;
  deadline: Date;
  status: CommitmentStatus;
  daysRemaining: number;
  successProbability: number;
  referee?: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
  };
  message: {
    headline: string;
    subtext: string;
  };
  createdAt: Date;
  achievementTier?: string | null;
  achievementPercentage?: number | null;
  tierRefundPercentage?: number | null;
  selfVerifyOfferedAt?: Date | null;
  selfVerifyExpiresAt?: Date | null;
  trustBonusApplied?: boolean;
  trustBonusAmount?: number | null;
}

/**
 * Referee pending verification item
 */
export interface PendingVerification {
  contractId: string;
  goalName: string;
  userName: string;
  userEmail: string;
  stakeType: StakeType;
  stakeAmount: number | null;
  deadline: Date;
  daysOverdue: number;
  createdAt: Date;
}

/**
 * Mock payment result
 */
export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

/**
 * Fund lock result
 */
export interface FundLockResult {
  success: boolean;
  lockId?: string;
  amount?: number;
  error?: string;
}

/**
 * Donation result for anti-charity
 */
export interface DonationResult {
  success: boolean;
  donationId?: string;
  amount?: number;
  cause?: string;
  error?: string;
}

/**
 * Stake effectiveness metrics
 */
export interface StakeEffectivenessMetrics {
  stakeType: StakeType;
  totalCommitments: number;
  successfulCommitments: number;
  successRate: number;
  averageStakeAmount: number | null;
  averageTimeToSuccess: number | null; // days
}

/**
 * Referee engagement metrics
 */
export interface RefereeEngagementMetrics {
  totalReferees: number;
  activeReferees: number;
  averageResponseTime: number; // hours
  verificationRate: number;
}

/**
 * Supportive message
 */
export interface SupportiveMessage {
  headline: string;
  subtext: string;
}

/**
 * Enforcement job result
 */
export interface EnforcementResult {
  processedContracts: number;
  succeededContracts: number;
  failedContracts: number;
  pendingVerification: number;
  errors: string[];
}

/**
 * Reminder job result
 */
export interface ReminderResult {
  sentReminders: number;
  contracts: Array<{
    contractId: string;
    userId: string;
    hoursRemaining: number;
  }>;
  errors: string[];
}

/**
 * Fund lock record (database-persisted)
 */
export interface FundLockRecord {
  id: string;
  contractId: string;
  paymentLockId: string;
  amount: number;
  currency: string;
  status: FundLockStatus;
  lockedAt: Date;
  releasedAt: Date | null;
  forfeitedAt: Date | null;
  refundedAt: Date | null;
  refundAmount: number | null;
}

/**
 * Audit log entry input
 */
export interface AuditLogInput {
  contractId: string;
  action: CommitmentAuditAction;
  performedBy: string; // User ID or "system"
  previousStatus?: CommitmentStatus;
  newStatus?: CommitmentStatus;
  previousAmount?: number;
  newAmount?: number;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Partial refund calculation result
 */
export interface PartialRefundResult {
  originalAmount: number;
  refundAmount: number;
  penaltyAmount: number;
  refundPercentage: number;
  reason: string;
}

/**
 * JWT verification token payload
 */
export interface VerificationTokenPayload {
  refereeId: string;
  contractId?: string;
  type: 'referee_verification' | 'referee_invite';
  exp: number;
  iat: number;
}

// ============================================
// GROUP ACCOUNTABILITY INTERFACES
// ============================================

/**
 * Group member's categorical progress (never exposes raw financial amounts)
 */
export type GroupProgressCategory =
  | 'on_track'
  | 'behind'
  | 'completed'
  | 'failed'
  | 'pending';

/**
 * Group info summary
 */
export interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  status: string;
  memberCount: number;
  maxMembers: number;
  myRole: string;
  createdAt: Date;
}

/**
 * Individual member progress for the group dashboard
 * Shows categorical status only — never dollar amounts (Beshears 401k study)
 */
export interface GroupMemberProgress {
  userId: string;
  name: string;
  role: string;
  hasContract: boolean;
  progress: GroupProgressCategory;
  groupBonusAwarded: boolean;
  joinedAt: Date;
  encouragementCount?: number;
  reactions?: Array<{ emoji: string; count: number; myReaction: boolean }>;
}

/**
 * Full group dashboard response
 */
export interface GroupDashboard {
  group: GroupInfo;
  members: GroupMemberProgress[];
  allResolved: boolean;
  allSucceeded: boolean;
  groupBonusAwarded: boolean;
  sharedGoal?: {
    target: number;
    current: number;
    percentage: number;
    currency: string;
    label: string | null;
  } | null;
  recentEncouragements?: Array<{
    id: string;
    fromName: string;
    toName: string;
    message: string;
    createdAt: Date;
  }>;
}

/**
 * Group outcome resolution result
 */
export interface GroupOutcomeResult {
  groupId: string;
  allSucceeded: boolean;
  bonusAwarded: boolean;
  membersResolved: number;
}

/**
 * Achievement tier types for partial success
 */
export type AchievementTier = 'GOLD' | 'SILVER' | 'BRONZE' | null;

export interface TierResult {
  tier: AchievementTier;
  refundPercentage: number;
  achievementPercentage: number;
}

/**
 * Self-verify result
 */
export interface SelfVerifyResult {
  success: boolean;
  newStatus: string;
  message: string;
}

/**
 * Streak info
 */
export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  trustBonusRate: number;
  bonusEligible: boolean;
  lastSucceededAt: string | null;
}
