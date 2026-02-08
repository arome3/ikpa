/**
 * Commitment Coach Evaluation Dataset
 *
 * 15 test scenarios covering different user profiles and financial situations.
 * Used by the eval runner to score the commitment coach agent's recommendations.
 */

export interface EvalScenario {
  id: string;
  name: string;
  description: string;
  userProfile: {
    monthlyIncome: number;
    monthlyExpenses: number;
    totalSavings: number;
    totalDebt: number;
    hasCommitmentHistory: boolean;
    pastSuccessRate: number; // 0-1
    hasUsedMonetaryStakes: boolean;
  };
  goalProfile: {
    name: string;
    targetAmount: number;
    currentAmount: number;
    daysRemaining: number;
  };
  expectedOutcome: {
    /** Expected stake type recommendation */
    expectedStakeType: 'SOCIAL' | 'ANTI_CHARITY' | 'LOSS_POOL';
    /** Max acceptable stake amount (null = no monetary stake) */
    maxAcceptableStake: number | null;
    /** Whether monetary stakes should be avoided */
    shouldAvoidMonetaryStake: boolean;
    /** Expected risk tolerance (1-5) */
    expectedRiskScore: number;
  };
}

export const EVAL_DATASET: EvalScenario[] = [
  // Low-income scenarios
  {
    id: 'low-income-first-time',
    name: 'Low-income first-time user',
    description: 'User with minimal income, no history, should get SOCIAL only',
    userProfile: { monthlyIncome: 5000, monthlyExpenses: 4800, totalSavings: 2000, totalDebt: 0, hasCommitmentHistory: false, pastSuccessRate: 0, hasUsedMonetaryStakes: false },
    goalProfile: { name: 'Emergency Fund', targetAmount: 50000, currentAmount: 2000, daysRemaining: 180 },
    expectedOutcome: { expectedStakeType: 'SOCIAL', maxAcceptableStake: null, shouldAvoidMonetaryStake: true, expectedRiskScore: 2 },
  },
  {
    id: 'low-income-negative-discretionary',
    name: 'Expenses exceed income',
    description: 'User spending more than they earn, must be SOCIAL only',
    userProfile: { monthlyIncome: 3000, monthlyExpenses: 3200, totalSavings: 500, totalDebt: 5000, hasCommitmentHistory: false, pastSuccessRate: 0, hasUsedMonetaryStakes: false },
    goalProfile: { name: 'Debt Payoff', targetAmount: 5000, currentAmount: 0, daysRemaining: 365 },
    expectedOutcome: { expectedStakeType: 'SOCIAL', maxAcceptableStake: null, shouldAvoidMonetaryStake: true, expectedRiskScore: 1 },
  },
  {
    id: 'low-income-with-history',
    name: 'Low-income with some success',
    description: 'User has succeeded with SOCIAL before, still should stay SOCIAL',
    userProfile: { monthlyIncome: 8000, monthlyExpenses: 7500, totalSavings: 5000, totalDebt: 2000, hasCommitmentHistory: true, pastSuccessRate: 0.8, hasUsedMonetaryStakes: false },
    goalProfile: { name: 'Vacation Fund', targetAmount: 20000, currentAmount: 5000, daysRemaining: 120 },
    expectedOutcome: { expectedStakeType: 'SOCIAL', maxAcceptableStake: 500, shouldAvoidMonetaryStake: false, expectedRiskScore: 3 },
  },

  // Medium-income scenarios
  {
    id: 'medium-income-first-time',
    name: 'Medium-income first commitment',
    description: 'Healthy income, no history, should suggest moderate LOSS_POOL',
    userProfile: { monthlyIncome: 50000, monthlyExpenses: 30000, totalSavings: 100000, totalDebt: 0, hasCommitmentHistory: false, pastSuccessRate: 0, hasUsedMonetaryStakes: false },
    goalProfile: { name: 'House Fund', targetAmount: 500000, currentAmount: 100000, daysRemaining: 365 },
    expectedOutcome: { expectedStakeType: 'LOSS_POOL', maxAcceptableStake: 5000, shouldAvoidMonetaryStake: false, expectedRiskScore: 3 },
  },
  {
    id: 'medium-income-failed-before',
    name: 'Failed commitment user',
    description: 'User who failed a previous LOSS_POOL, should suggest gentler approach',
    userProfile: { monthlyIncome: 45000, monthlyExpenses: 25000, totalSavings: 80000, totalDebt: 10000, hasCommitmentHistory: true, pastSuccessRate: 0.3, hasUsedMonetaryStakes: true },
    goalProfile: { name: 'Education Fund', targetAmount: 200000, currentAmount: 40000, daysRemaining: 270 },
    expectedOutcome: { expectedStakeType: 'SOCIAL', maxAcceptableStake: 2000, shouldAvoidMonetaryStake: false, expectedRiskScore: 2 },
  },
  {
    id: 'medium-income-repeat-success',
    name: 'Repeat successful user',
    description: 'User with strong track record, should suggest scaling up',
    userProfile: { monthlyIncome: 60000, monthlyExpenses: 35000, totalSavings: 200000, totalDebt: 0, hasCommitmentHistory: true, pastSuccessRate: 0.9, hasUsedMonetaryStakes: true },
    goalProfile: { name: 'Investment Goal', targetAmount: 300000, currentAmount: 150000, daysRemaining: 180 },
    expectedOutcome: { expectedStakeType: 'ANTI_CHARITY', maxAcceptableStake: 6000, shouldAvoidMonetaryStake: false, expectedRiskScore: 4 },
  },

  // High-income scenarios
  {
    id: 'high-income-first-time',
    name: 'High-income first commitment',
    description: 'High earner, first commitment, should suggest meaningful stake',
    userProfile: { monthlyIncome: 200000, monthlyExpenses: 80000, totalSavings: 500000, totalDebt: 0, hasCommitmentHistory: false, pastSuccessRate: 0, hasUsedMonetaryStakes: false },
    goalProfile: { name: 'Business Fund', targetAmount: 1000000, currentAmount: 200000, daysRemaining: 365 },
    expectedOutcome: { expectedStakeType: 'LOSS_POOL', maxAcceptableStake: 20000, shouldAvoidMonetaryStake: false, expectedRiskScore: 3 },
  },
  {
    id: 'high-income-anti-charity',
    name: 'High-income with anti-charity preference',
    description: 'Experienced user with high risk tolerance',
    userProfile: { monthlyIncome: 150000, monthlyExpenses: 60000, totalSavings: 800000, totalDebt: 0, hasCommitmentHistory: true, pastSuccessRate: 0.85, hasUsedMonetaryStakes: true },
    goalProfile: { name: 'Retirement Boost', targetAmount: 2000000, currentAmount: 800000, daysRemaining: 720 },
    expectedOutcome: { expectedStakeType: 'ANTI_CHARITY', maxAcceptableStake: 15000, shouldAvoidMonetaryStake: false, expectedRiskScore: 5 },
  },

  // Edge cases
  {
    id: 'near-goal-completion',
    name: 'Almost at goal (90%)',
    description: 'User is 90% to their goal, minimal stake needed',
    userProfile: { monthlyIncome: 40000, monthlyExpenses: 25000, totalSavings: 45000, totalDebt: 0, hasCommitmentHistory: true, pastSuccessRate: 1.0, hasUsedMonetaryStakes: false },
    goalProfile: { name: 'Travel Fund', targetAmount: 50000, currentAmount: 45000, daysRemaining: 30 },
    expectedOutcome: { expectedStakeType: 'SOCIAL', maxAcceptableStake: 1000, shouldAvoidMonetaryStake: false, expectedRiskScore: 3 },
  },
  {
    id: 'very-short-deadline',
    name: 'Very short deadline (7 days)',
    description: 'Urgent goal, high pressure',
    userProfile: { monthlyIncome: 30000, monthlyExpenses: 20000, totalSavings: 25000, totalDebt: 5000, hasCommitmentHistory: false, pastSuccessRate: 0, hasUsedMonetaryStakes: false },
    goalProfile: { name: 'Bill Payment', targetAmount: 5000, currentAmount: 3000, daysRemaining: 7 },
    expectedOutcome: { expectedStakeType: 'SOCIAL', maxAcceptableStake: null, shouldAvoidMonetaryStake: true, expectedRiskScore: 2 },
  },
  {
    id: 'high-debt-user',
    name: 'High debt user',
    description: 'User with significant debt, should not add financial pressure',
    userProfile: { monthlyIncome: 35000, monthlyExpenses: 28000, totalSavings: 10000, totalDebt: 200000, hasCommitmentHistory: false, pastSuccessRate: 0, hasUsedMonetaryStakes: false },
    goalProfile: { name: 'Debt Freedom', targetAmount: 200000, currentAmount: 0, daysRemaining: 730 },
    expectedOutcome: { expectedStakeType: 'SOCIAL', maxAcceptableStake: null, shouldAvoidMonetaryStake: true, expectedRiskScore: 1 },
  },
  {
    id: 'multiple-income-streams',
    name: 'Multiple income streams',
    description: 'User with diverse income, higher risk capacity',
    userProfile: { monthlyIncome: 100000, monthlyExpenses: 50000, totalSavings: 300000, totalDebt: 0, hasCommitmentHistory: true, pastSuccessRate: 0.75, hasUsedMonetaryStakes: true },
    goalProfile: { name: 'Emergency Fund Top-up', targetAmount: 150000, currentAmount: 80000, daysRemaining: 90 },
    expectedOutcome: { expectedStakeType: 'LOSS_POOL', maxAcceptableStake: 10000, shouldAvoidMonetaryStake: false, expectedRiskScore: 4 },
  },
  {
    id: 'streak-upgrader',
    name: 'Micro-commitment streak upgrader',
    description: 'User with 5-day streak upgrading from Future Self',
    userProfile: { monthlyIncome: 55000, monthlyExpenses: 30000, totalSavings: 120000, totalDebt: 15000, hasCommitmentHistory: false, pastSuccessRate: 0, hasUsedMonetaryStakes: false },
    goalProfile: { name: 'Savings Goal', targetAmount: 200000, currentAmount: 50000, daysRemaining: 200 },
    expectedOutcome: { expectedStakeType: 'LOSS_POOL', maxAcceptableStake: 5500, shouldAvoidMonetaryStake: false, expectedRiskScore: 3 },
  },
  {
    id: 'zero-savings',
    name: 'Zero savings user',
    description: 'User just starting out, no safety net',
    userProfile: { monthlyIncome: 20000, monthlyExpenses: 18000, totalSavings: 0, totalDebt: 3000, hasCommitmentHistory: false, pastSuccessRate: 0, hasUsedMonetaryStakes: false },
    goalProfile: { name: 'First Emergency Fund', targetAmount: 30000, currentAmount: 0, daysRemaining: 365 },
    expectedOutcome: { expectedStakeType: 'SOCIAL', maxAcceptableStake: null, shouldAvoidMonetaryStake: true, expectedRiskScore: 1 },
  },
  {
    id: 'experienced-mixed-results',
    name: 'Experienced user with mixed results',
    description: 'Has tried all stake types with varied success',
    userProfile: { monthlyIncome: 80000, monthlyExpenses: 45000, totalSavings: 250000, totalDebt: 20000, hasCommitmentHistory: true, pastSuccessRate: 0.6, hasUsedMonetaryStakes: true },
    goalProfile: { name: 'Car Fund', targetAmount: 300000, currentAmount: 100000, daysRemaining: 240 },
    expectedOutcome: { expectedStakeType: 'ANTI_CHARITY', maxAcceptableStake: 8000, shouldAvoidMonetaryStake: false, expectedRiskScore: 3 },
  },
];
