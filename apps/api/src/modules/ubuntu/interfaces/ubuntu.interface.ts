import { Currency, RiskLevel, EmergencyType, AdjustmentType, RelationshipType } from '@prisma/client';

/**
 * Dependency ratio breakdown by relationship category
 */
export interface DependencyRatioComponents {
  parentSupport: number;
  siblingEducation: number;
  extendedFamily: number;
  communityContribution: number;
}

/**
 * Cultural message for the dependency ratio display
 */
export interface UbuntuMessage {
  headline: string;
  subtext: string;
}

/**
 * Full dependency ratio response
 */
export interface DependencyRatioResult {
  totalRatio: number;
  riskLevel: RiskLevel;
  components: DependencyRatioComponents;
  monthlyTotal: number;
  monthlyIncome: number;
  currency: Currency;
  message: UbuntuMessage;
  trend: 'improving' | 'stable' | 'increasing';
}

/**
 * Family support creation input
 */
export interface CreateFamilySupportInput {
  name: string;
  relationship: RelationshipType;
  amount: number;
  frequency: string;
  description?: string;
}

/**
 * Family emergency report input
 */
export interface ReportEmergencyInput {
  type: EmergencyType;
  recipientName: string;
  relationship: RelationshipType;
  amount: number;
  description?: string;
}

/**
 * Adjustment option for emergency handling
 */
export interface AdjustmentOption {
  type: AdjustmentType;
  label: string;
  description: string;
  recoveryWeeks: number;
  newGoalProbability: number;
  recommended: boolean;
  available: boolean;
  unavailableReason?: string;
  details: AdjustmentDetails;
}

/**
 * Specific details for each adjustment type
 */
export interface AdjustmentDetails {
  // For EMERGENCY_FUND_TAP
  availableFund?: number;
  amountToTap?: number;
  remainingFund?: number;
  /** Percentage of emergency covered by fund (0-100) */
  coveragePercent?: number;
  /** Amount not covered by fund (if partial coverage) */
  shortfall?: number;
  /** True if fund doesn't fully cover the emergency */
  isPartialCoverage?: boolean;

  // For GOAL_TIMELINE_EXTEND
  currentDeadline?: Date;
  newDeadline?: Date;
  extensionWeeks?: number;

  // For SAVINGS_RATE_REDUCE
  currentRate?: number;
  temporaryRate?: number;
  durationWeeks?: number;
}

/**
 * Full adjustments response for an emergency
 */
export interface AdjustmentsResponse {
  emergencyId: string;
  emergencyAmount: number;
  recipientName: string;
  relationship: RelationshipType;
  originalGoalProbability: number;
  options: AdjustmentOption[];
}

/**
 * Apply adjustment input
 */
export interface ApplyAdjustmentInput {
  emergencyId: string;
  adjustmentType: AdjustmentType;
}

/**
 * Result of applying an adjustment
 */
export interface AdjustmentResult {
  emergencyId: string;
  status: string;
  adjustmentType: AdjustmentType;
  recoveryWeeks: number;
  originalGoalProbability: number;
  newGoalProbability: number;
  message: string;
  details: AdjustmentDetails;
}

/**
 * Family support record (from Prisma but typed for service use)
 */
export interface FamilySupportRecord {
  id: string;
  userId: string;
  name: string;
  relationship: RelationshipType;
  amount: number;
  currency: Currency;
  frequency: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
