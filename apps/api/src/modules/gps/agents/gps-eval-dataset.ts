/**
 * GPS Re-Router Evaluation Dataset
 *
 * 20 scenarios covering edge cases for the GPS Re-Router agent.
 * Used by GpsEvalRunner to batch-evaluate message quality and
 * track agent performance over time.
 *
 * Each scenario defines:
 * - Input: budget status + goal impact parameters
 * - Expected traits: structural checks the output message should satisfy
 */

export interface GpsEvalScenario {
  id: string;
  name: string;
  input: {
    category: string;
    budgeted: number;
    spent: number;
    currency: string;
    trigger: 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'BUDGET_CRITICAL';
    goalName: string;
    goalAmount: number;
    goalDeadline: string; // ISO date
    previousProbability: number; // 0-1
    newProbability: number; // 0-1
  };
  expectedTraits: {
    mentionsCategoryName: boolean;
    mentionsGoalName: boolean;
    usesGpsMetaphor: boolean;
    toneMinScore: number; // minimum acceptable tone score (1-5)
  };
}

export const GPS_EVAL_DATASET: GpsEvalScenario[] = [
  // 1. Mild warning — small food overspend
  {
    id: 'mild_food_warning',
    name: 'Small food budget warning (80%)',
    input: {
      category: 'Food & Dining',
      budgeted: 50000,
      spent: 42000,
      currency: 'NGN',
      trigger: 'BUDGET_WARNING',
      goalName: 'Emergency Fund',
      goalAmount: 300000,
      goalDeadline: '2025-12-31',
      previousProbability: 0.82,
      newProbability: 0.78,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: false, // Mild — no need to alarm about goal
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 2. Major exceeded — entertainment 150% over
  {
    id: 'major_entertainment_exceeded',
    name: 'Entertainment 150% over',
    input: {
      category: 'Entertainment',
      budgeted: 20000,
      spent: 50000,
      currency: 'NGN',
      trigger: 'BUDGET_CRITICAL',
      goalName: 'House Fund',
      goalAmount: 5000000,
      goalDeadline: '2026-06-30',
      previousProbability: 0.65,
      newProbability: 0.52,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: true,
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 3. Critical — goal probability drops to 0%
  {
    id: 'critical_zero_probability',
    name: 'Goal probability dropped to 0%',
    input: {
      category: 'Shopping',
      budgeted: 30000,
      spent: 120000,
      currency: 'NGN',
      trigger: 'BUDGET_CRITICAL',
      goalName: 'Vacation Fund',
      goalAmount: 150000,
      goalDeadline: '2025-04-30',
      previousProbability: 0.15,
      newProbability: 0.0,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: true,
      usesGpsMetaphor: true,
      toneMinScore: 4, // Extra empathy needed when probability is 0
    },
  },

  // 4. Small amount but high percentage (tiny budget)
  {
    id: 'small_budget_high_percent',
    name: 'Small budget (₦5K) exceeded by 40%',
    input: {
      category: 'Personal Care',
      budgeted: 5000,
      spent: 7000,
      currency: 'NGN',
      trigger: 'BUDGET_EXCEEDED',
      goalName: 'Laptop Fund',
      goalAmount: 400000,
      goalDeadline: '2025-09-30',
      previousProbability: 0.72,
      newProbability: 0.70,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: false, // Small impact on goal
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 5. Large amount but low percentage (big budget)
  {
    id: 'large_budget_low_percent',
    name: 'Large budget (₦500K) at 85%',
    input: {
      category: 'Housing',
      budgeted: 500000,
      spent: 425000,
      currency: 'NGN',
      trigger: 'BUDGET_WARNING',
      goalName: 'Retirement Fund',
      goalAmount: 50000000,
      goalDeadline: '2045-01-01',
      previousProbability: 0.55,
      newProbability: 0.53,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: false,
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 6. Transportation exceeded — common category
  {
    id: 'transport_exceeded',
    name: 'Transportation 120% over',
    input: {
      category: 'Transportation',
      budgeted: 15000,
      spent: 18000,
      currency: 'NGN',
      trigger: 'BUDGET_EXCEEDED',
      goalName: 'Emergency Fund',
      goalAmount: 300000,
      goalDeadline: '2025-12-31',
      previousProbability: 0.74,
      newProbability: 0.68,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: true,
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 7. First-time warning — needs encouraging tone
  {
    id: 'first_time_warning',
    name: 'First budget warning ever',
    input: {
      category: 'Groceries',
      budgeted: 40000,
      spent: 35000,
      currency: 'NGN',
      trigger: 'BUDGET_WARNING',
      goalName: 'Wedding Fund',
      goalAmount: 2000000,
      goalDeadline: '2026-12-31',
      previousProbability: 0.88,
      newProbability: 0.86,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: false,
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 8. Multiple goals affected scenario (simulated as primary goal data)
  {
    id: 'multi_goal_impact',
    name: 'Overspend affects multiple goals',
    input: {
      category: 'Subscriptions',
      budgeted: 10000,
      spent: 25000,
      currency: 'NGN',
      trigger: 'BUDGET_CRITICAL',
      goalName: 'Car Fund',
      goalAmount: 3000000,
      goalDeadline: '2026-06-30',
      previousProbability: 0.60,
      newProbability: 0.42,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: true,
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 9. USD currency user
  {
    id: 'usd_user_warning',
    name: 'USD user with modest warning',
    input: {
      category: 'Dining Out',
      budgeted: 300,
      spent: 260,
      currency: 'USD',
      trigger: 'BUDGET_WARNING',
      goalName: 'Emergency Fund',
      goalAmount: 10000,
      goalDeadline: '2025-12-31',
      previousProbability: 0.90,
      newProbability: 0.87,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: false,
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 10. High probability drop but still achievable
  {
    id: 'high_drop_still_achievable',
    name: 'Probability drops 20pp but still >50%',
    input: {
      category: 'Healthcare',
      budgeted: 30000,
      spent: 80000,
      currency: 'NGN',
      trigger: 'BUDGET_CRITICAL',
      goalName: 'Education Fund',
      goalAmount: 1500000,
      goalDeadline: '2026-03-31',
      previousProbability: 0.72,
      newProbability: 0.52,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: true,
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 11. Very low initial probability (already struggling)
  {
    id: 'already_low_probability',
    name: 'Already at 20% probability before overspend',
    input: {
      category: 'Clothing',
      budgeted: 25000,
      spent: 45000,
      currency: 'NGN',
      trigger: 'BUDGET_CRITICAL',
      goalName: 'House Down Payment',
      goalAmount: 10000000,
      goalDeadline: '2025-12-31',
      previousProbability: 0.20,
      newProbability: 0.08,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: true,
      usesGpsMetaphor: true,
      toneMinScore: 4, // Extra empathy for struggling users
    },
  },

  // 12. Near-perfect probability (small dip)
  {
    id: 'near_perfect_small_dip',
    name: 'From 95% to 92% — reassuring tone',
    input: {
      category: 'Utilities',
      budgeted: 20000,
      spent: 22000,
      currency: 'NGN',
      trigger: 'BUDGET_EXCEEDED',
      goalName: 'New Phone',
      goalAmount: 200000,
      goalDeadline: '2025-08-30',
      previousProbability: 0.95,
      newProbability: 0.92,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: false,
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 13. Exactly at warning threshold (80%)
  {
    id: 'exact_warning_threshold',
    name: 'Exactly at 80% warning threshold',
    input: {
      category: 'Gift & Donations',
      budgeted: 50000,
      spent: 40000,
      currency: 'NGN',
      trigger: 'BUDGET_WARNING',
      goalName: 'Travel Fund',
      goalAmount: 500000,
      goalDeadline: '2025-12-31',
      previousProbability: 0.68,
      newProbability: 0.65,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: false,
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 14. Exactly at exceeded threshold (100%)
  {
    id: 'exact_exceeded_threshold',
    name: 'Exactly at 100% budget',
    input: {
      category: 'Education',
      budgeted: 80000,
      spent: 80000,
      currency: 'NGN',
      trigger: 'BUDGET_EXCEEDED',
      goalName: 'Startup Fund',
      goalAmount: 2000000,
      goalDeadline: '2026-06-30',
      previousProbability: 0.58,
      newProbability: 0.54,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: true,
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 15. Massive overspend (300% of budget)
  {
    id: 'massive_overspend',
    name: '300% of budget — emergency situation',
    input: {
      category: 'Medical',
      budgeted: 20000,
      spent: 60000,
      currency: 'NGN',
      trigger: 'BUDGET_CRITICAL',
      goalName: 'Emergency Fund',
      goalAmount: 500000,
      goalDeadline: '2025-12-31',
      previousProbability: 0.70,
      newProbability: 0.35,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: true,
      usesGpsMetaphor: true,
      toneMinScore: 4, // Medical expense — extra empathy
    },
  },

  // 16. GBP currency user
  {
    id: 'gbp_user_exceeded',
    name: 'GBP user exceeded budget',
    input: {
      category: 'Dining',
      budgeted: 200,
      spent: 280,
      currency: 'GBP',
      trigger: 'BUDGET_EXCEEDED',
      goalName: 'Holiday Fund',
      goalAmount: 3000,
      goalDeadline: '2025-08-01',
      previousProbability: 0.75,
      newProbability: 0.65,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: true,
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 17. Probability drops to exactly 50% (tipping point)
  {
    id: 'fifty_fifty_tipping_point',
    name: 'Probability drops to exactly 50%',
    input: {
      category: 'Shopping',
      budgeted: 35000,
      spent: 55000,
      currency: 'NGN',
      trigger: 'BUDGET_CRITICAL',
      goalName: 'Car Insurance',
      goalAmount: 250000,
      goalDeadline: '2025-09-30',
      previousProbability: 0.62,
      newProbability: 0.50,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: true,
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 18. Very short deadline (1 month away)
  {
    id: 'short_deadline_pressure',
    name: 'Goal deadline in 1 month',
    input: {
      category: 'Food & Dining',
      budgeted: 45000,
      spent: 62000,
      currency: 'NGN',
      trigger: 'BUDGET_CRITICAL',
      goalName: 'Birthday Party Fund',
      goalAmount: 100000,
      goalDeadline: '2025-03-15',
      previousProbability: 0.45,
      newProbability: 0.22,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: true,
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 19. Very long deadline (20 years away)
  {
    id: 'long_deadline_retirement',
    name: 'Retirement goal — 20 year horizon',
    input: {
      category: 'Entertainment',
      budgeted: 30000,
      spent: 42000,
      currency: 'NGN',
      trigger: 'BUDGET_EXCEEDED',
      goalName: 'Retirement',
      goalAmount: 100000000,
      goalDeadline: '2045-01-01',
      previousProbability: 0.45,
      newProbability: 0.44,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: false, // Long-term goal — negligible impact
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },

  // 20. Zero budget (edge case)
  {
    id: 'zero_budget_edge_case',
    name: 'Category has zero budget but spending occurred',
    input: {
      category: 'Miscellaneous',
      budgeted: 0,
      spent: 15000,
      currency: 'NGN',
      trigger: 'BUDGET_CRITICAL',
      goalName: 'Savings Goal',
      goalAmount: 500000,
      goalDeadline: '2025-12-31',
      previousProbability: 0.60,
      newProbability: 0.55,
    },
    expectedTraits: {
      mentionsCategoryName: true,
      mentionsGoalName: false,
      usesGpsMetaphor: true,
      toneMinScore: 3,
    },
  },
];
