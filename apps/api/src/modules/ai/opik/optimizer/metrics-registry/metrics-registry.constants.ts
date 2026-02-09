/**
 * Metrics Registry Constants
 *
 * Defines all custom IKPA metrics that are registered with Opik.
 * These metrics provide scoring dimensions for AI evaluation.
 */

import {
  NumericalMetricDefinition,
  IKPAMetricDefinition,
} from './metrics-registry.interface';

// ==========================================
// METRIC NAMES (for consistent usage)
// ==========================================

/** Metric name for tone empathy evaluation */
export const METRIC_NAME_TONE_EMPATHY = 'ToneEmpathy';

/** Metric name for subscription cancellation rate */
export const METRIC_NAME_CANCELLATION_RATE = 'CancellationRate';

/** Metric name for tool policy accuracy */
export const METRIC_NAME_TOOL_POLICY_ACCURACY = 'ToolPolicyAccuracy';

/** Metric name for generation fitness */
export const METRIC_NAME_GENERATION_FITNESS = 'GenerationFitness';

/** Metric name for intervention success */
export const METRIC_NAME_INTERVENTION_SUCCESS = 'InterventionSuccess';

/** Metric name for cultural sensitivity */
export const METRIC_NAME_CULTURAL_SENSITIVITY = 'CulturalSensitivity';

/** Metric name for financial safety */
export const METRIC_NAME_FINANCIAL_SAFETY = 'FinancialSafety';

/** Metric name for stake effectiveness */
export const METRIC_NAME_STAKE_EFFECTIVENESS = 'StakeEffectiveness';

// ==========================================
// METRIC DEFINITIONS
// ==========================================

/**
 * ToneEmpathy metric (0-5 scale)
 *
 * Measures the empathy and supportiveness of AI responses,
 * particularly in future self letters and coach interactions.
 *
 * Scale:
 * - 0: Not evaluated
 * - 1: Harsh, judgmental, shaming language
 * - 2: Cold, clinical, lacks warmth
 * - 3: Neutral, neither supportive nor discouraging
 * - 4: Warm and supportive with minor issues
 * - 5: Exceptionally empathetic and encouraging
 */
export const TONE_EMPATHY_METRIC: NumericalMetricDefinition = {
  name: METRIC_NAME_TONE_EMPATHY,
  description:
    'Measures empathy and supportiveness in AI responses. Scale: 1=harsh/judgmental, 5=exceptionally empathetic',
  type: 'numerical',
  min: 0,
  max: 5,
  unit: 'points',
};

/**
 * CancellationRate metric (0-1 scale)
 *
 * Measures the rate at which the Shark Auditor recommends
 * subscription cancellations for zombie/unused subscriptions.
 *
 * Scale:
 * - 0: Recommended keeping the subscription
 * - 0.5: Unclear/neutral recommendation
 * - 1: Recommended cancellation
 */
export const CANCELLATION_RATE_METRIC: NumericalMetricDefinition = {
  name: METRIC_NAME_CANCELLATION_RATE,
  description:
    'Measures subscription cancellation recommendation rate. 0=keep, 0.5=unclear, 1=cancel',
  type: 'numerical',
  min: 0,
  max: 1,
  unit: 'rate',
};

/**
 * ToolPolicyAccuracy metric (0-1 scale)
 *
 * Measures the accuracy of GEPA (Genetic Evolution for Policy Adaptation)
 * tool selection policies against expected outcomes.
 *
 * Scale:
 * - 0: Completely wrong tool selection
 * - 0.5: Partially correct selection
 * - 1: Perfect tool selection for the context
 */
export const TOOL_POLICY_ACCURACY_METRIC: NumericalMetricDefinition = {
  name: METRIC_NAME_TOOL_POLICY_ACCURACY,
  description:
    'Measures GEPA policy accuracy for tool selection. 0=wrong, 1=perfect match',
  type: 'numerical',
  min: 0,
  max: 1,
  unit: 'accuracy',
};

/**
 * GenerationFitness metric (0-1 scale)
 *
 * Measures the fitness score of individuals in evolutionary
 * prompt optimization (letter optimizer).
 *
 * Scale:
 * - 0: Completely unfit (fails all evaluation criteria)
 * - 0.5: Average fitness
 * - 1: Perfect fitness (optimal prompt)
 */
export const GENERATION_FITNESS_METRIC: NumericalMetricDefinition = {
  name: METRIC_NAME_GENERATION_FITNESS,
  description:
    'Measures evolutionary generation fitness for prompt optimization. 0=unfit, 1=optimal',
  type: 'numerical',
  min: 0,
  max: 1,
  unit: 'fitness',
};

/**
 * InterventionSuccess metric (0-1 binary)
 *
 * Measures whether a GPS Re-Router intervention led to
 * the user saving instead of spending.
 *
 * Scale:
 * - 0: User spent (intervention failed)
 * - 1: User saved (intervention succeeded)
 */
export const INTERVENTION_SUCCESS_METRIC: NumericalMetricDefinition = {
  name: METRIC_NAME_INTERVENTION_SUCCESS,
  description:
    'Binary metric for intervention success. 0=user spent, 1=user saved',
  type: 'numerical',
  min: 0,
  max: 1,
  unit: 'binary',
};

/**
 * CulturalSensitivity metric (0-5 scale)
 *
 * Measures how well AI responses adapt to the user's personal context,
 * including values, family dynamics, and individual circumstances.
 *
 * Scale:
 * - 1: Insensitive or inappropriate
 * - 2: Generic, ignores personal context
 * - 3: Neutral, basic personal awareness
 * - 4: Good personal adaptation
 * - 5: Excellent sensitivity and personalization
 */
export const CULTURAL_SENSITIVITY_METRIC: NumericalMetricDefinition = {
  name: METRIC_NAME_CULTURAL_SENSITIVITY,
  description:
    'Measures personal sensitivity of responses. 1=inappropriate, 5=excellent personalization',
  type: 'numerical',
  min: 0,
  max: 5,
  unit: 'points',
};

/**
 * FinancialSafety metric (0-1 binary guardrail)
 *
 * Guardrail metric that checks if AI advice is financially safe.
 * Blocks responses that recommend dangerous financial actions.
 *
 * Scale:
 * - 0: Unsafe advice detected (blocks response)
 * - 1: Safe advice (passes guardrail)
 */
export const FINANCIAL_SAFETY_METRIC: NumericalMetricDefinition = {
  name: METRIC_NAME_FINANCIAL_SAFETY,
  description:
    'Guardrail metric for financial safety. 0=unsafe (blocked), 1=safe (passed)',
  type: 'numerical',
  min: 0,
  max: 1,
  unit: 'guardrail',
};

/**
 * StakeEffectiveness metric (0-1 weighted)
 *
 * Measures the effectiveness of commitment stakes in achieving goals.
 * Considers stake type (social, anti-charity, loss pool) vs outcome.
 *
 * Scale:
 * - 0: Stake had no effect or negative effect
 * - 0.5: Average effectiveness
 * - 1: Maximum stake effectiveness (goal achieved with minimal stake)
 */
export const STAKE_EFFECTIVENESS_METRIC: NumericalMetricDefinition = {
  name: METRIC_NAME_STAKE_EFFECTIVENESS,
  description:
    'Measures commitment stake effectiveness. 0=ineffective, 1=highly effective',
  type: 'numerical',
  min: 0,
  max: 1,
  unit: 'effectiveness',
};

// ==========================================
// ALL METRICS COLLECTION
// ==========================================

/**
 * All IKPA metrics registered with Opik
 *
 * This array is used by the MetricsRegistryService to
 * register all metrics on module initialization.
 */
export const ALL_IKPA_METRICS: IKPAMetricDefinition[] = [
  // Core optimizer metrics (Task #16 requirements)
  TONE_EMPATHY_METRIC,
  CANCELLATION_RATE_METRIC,
  TOOL_POLICY_ACCURACY_METRIC,
  GENERATION_FITNESS_METRIC,

  // Additional evaluation metrics (existing in codebase)
  INTERVENTION_SUCCESS_METRIC,
  CULTURAL_SENSITIVITY_METRIC,
  FINANCIAL_SAFETY_METRIC,
  STAKE_EFFECTIVENESS_METRIC,
];

/**
 * Metric names grouped by category for documentation
 */
export const METRIC_CATEGORIES = {
  /** Metrics for optimizer feedback */
  optimizer: [
    METRIC_NAME_CANCELLATION_RATE,
    METRIC_NAME_TOOL_POLICY_ACCURACY,
    METRIC_NAME_GENERATION_FITNESS,
  ],
  /** Metrics for response evaluation */
  evaluation: [
    METRIC_NAME_TONE_EMPATHY,
    METRIC_NAME_CULTURAL_SENSITIVITY,
    METRIC_NAME_INTERVENTION_SUCCESS,
  ],
  /** Metrics for safety guardrails */
  guardrails: [METRIC_NAME_FINANCIAL_SAFETY],
  /** Metrics for commitment effectiveness */
  commitment: [METRIC_NAME_STAKE_EFFECTIVENESS],
} as const;
