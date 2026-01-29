/**
 * Optimizer Constants
 *
 * Configuration values for the Opik optimization system.
 */

// ==========================================
// TRACE NAMES
// ==========================================

/** Trace name for framing A/B experiments */
export const TRACE_FRAMING_EXPERIMENT = 'framing_experiment';

/** Trace name for evolutionary optimization */
export const TRACE_EVOLUTIONARY_OPTIMIZATION = 'evolutionary_optimization';

/** Trace name for GEPA tool optimization */
export const TRACE_GEPA_OPTIMIZATION = 'gepa_optimization';

// ==========================================
// SPAN NAMES
// ==========================================

/** Span name for baseline evaluation in A/B tests */
export const SPAN_BASELINE_EVALUATION = 'baseline_evaluation';

/** Span name for variant evaluation in A/B tests */
export const SPAN_VARIANT_EVALUATION = 'variant_evaluation';

/** Span name for statistical analysis */
export const SPAN_STATISTICAL_ANALYSIS = 'statistical_analysis';

/** Span name for pattern analysis in GEPA */
export const SPAN_PATTERN_ANALYSIS = 'pattern_analysis';

/** Span name for rule generation in GEPA */
export const SPAN_RULE_GENERATION = 'rule_generation';

// ==========================================
// FEEDBACK NAMES
// ==========================================

/** Feedback name for experiment winner */
export const FEEDBACK_EXPERIMENT_WINNER = 'ExperimentWinner';

/** Feedback name for improvement percentage */
export const FEEDBACK_IMPROVEMENT_PERCENTAGE = 'ImprovementPercentage';

/** Feedback name for generation fitness */
export const FEEDBACK_GENERATION_FITNESS = 'GenerationFitness';

/** Feedback name for tool policy accuracy */
export const FEEDBACK_TOOL_POLICY_ACCURACY = 'ToolPolicyAccuracy';

// ==========================================
// FRAMING OPTIMIZER CONFIGURATION
// ==========================================

/** Default number of samples per evaluation round */
export const DEFAULT_FRAMING_N_SAMPLES = 100;

/** Default maximum rounds for A/B testing */
export const DEFAULT_FRAMING_MAX_ROUNDS = 10;

/** p-value threshold for statistical significance */
export const SIGNIFICANCE_THRESHOLD = 0.05;

// ==========================================
// EVOLUTIONARY OPTIMIZER CONFIGURATION
// ==========================================

/** Default population size for evolutionary optimization */
export const DEFAULT_POPULATION_SIZE = 10;

/** Default number of generations */
export const DEFAULT_GENERATIONS = 5;

/** Default survival rate (top percentage kept each generation) */
export const DEFAULT_SURVIVAL_RATE = 0.3;

/** Default mutation rate */
export const DEFAULT_MUTATION_RATE = 0.2;

/** Default number of elite individuals (kept unchanged) */
export const DEFAULT_ELITISM_COUNT = 2;

/** Timeout for LLM evaluation calls (ms) */
export const EVOLUTION_EVALUATION_TIMEOUT_MS = 60000;

/** Max tokens for LLM generation calls */
export const EVOLUTION_MAX_TOKENS = 1000;

// ==========================================
// ADAPTIVE GA PARAMETERS CONFIGURATION
// ==========================================

/** Minimum mutation rate bound */
export const ADAPTIVE_MUTATION_RATE_MIN = 0.05;

/** Maximum mutation rate bound */
export const ADAPTIVE_MUTATION_RATE_MAX = 0.5;

/** Minimum survival rate bound */
export const ADAPTIVE_SURVIVAL_RATE_MIN = 0.2;

/** Maximum survival rate bound */
export const ADAPTIVE_SURVIVAL_RATE_MAX = 0.5;

/** Number of stagnant generations before increasing exploration */
export const ADAPTIVE_STAGNATION_THRESHOLD = 3;

/** Diversity threshold below which parameters are adjusted */
export const ADAPTIVE_DIVERSITY_THRESHOLD = 0.3;

/** Factor to increase mutation rate when stagnation detected */
export const ADAPTIVE_MUTATION_INCREASE_FACTOR = 1.5;

/** Factor to decrease mutation rate when improvement is good */
export const ADAPTIVE_MUTATION_DECREASE_FACTOR = 0.9;

/** Factor to decrease survival rate when diversity is low */
export const ADAPTIVE_SURVIVAL_DECREASE_FACTOR = 0.85;

/** Improvement rate threshold considered "good" */
export const ADAPTIVE_GOOD_IMPROVEMENT_THRESHOLD = 0.05;

/** Default adaptive configuration */
export const DEFAULT_ADAPTIVE_CONFIG = {
  mutationRateBounds: { min: ADAPTIVE_MUTATION_RATE_MIN, max: ADAPTIVE_MUTATION_RATE_MAX },
  survivalRateBounds: { min: ADAPTIVE_SURVIVAL_RATE_MIN, max: ADAPTIVE_SURVIVAL_RATE_MAX },
  stagnationThreshold: ADAPTIVE_STAGNATION_THRESHOLD,
  diversityThreshold: ADAPTIVE_DIVERSITY_THRESHOLD,
};

// ==========================================
// GEPA OPTIMIZER CONFIGURATION
// ==========================================

/** Minimum sample size for a rule to be considered valid */
export const GEPA_MIN_SAMPLE_SIZE = 10;

/** Minimum confidence threshold for rules */
export const GEPA_MIN_CONFIDENCE = 0.6;

/** Minimum success rate for a rule to be active */
export const GEPA_MIN_SUCCESS_RATE = 0.5;

/** Default tool when no rules match */
export const GEPA_DEFAULT_TOOL = 'time_adjustment';

// ==========================================
// CRON CONFIGURATION
// ==========================================

/** Lock TTL for cron jobs (ms) */
export const OPTIMIZER_CRON_LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Redis lock key prefix for optimizer cron jobs */
export const OPTIMIZER_LOCK_PREFIX = 'optimizer:cron';

// ==========================================
// RECOVERY TOOLS
// ==========================================

/** Available recovery tools for GPS Re-Router */
export const RECOVERY_TOOLS = ['time_adjustment', 'rate_adjustment', 'freeze_protocol'] as const;

/** Recovery tool type */
export type RecoveryTool = (typeof RECOVERY_TOOLS)[number];

// ==========================================
// SLIP SEVERITY LEVELS
// ==========================================

/** Slip severity levels */
export const SLIP_SEVERITY_LEVELS = ['minor', 'moderate', 'severe'] as const;

/** Slip severity type */
export type SlipSeverity = (typeof SLIP_SEVERITY_LEVELS)[number];
