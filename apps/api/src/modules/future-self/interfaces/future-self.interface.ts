/**
 * Future Self Simulator Interfaces
 *
 * Type definitions for the Future Self feature that bridges temporal disconnect
 * through personalized "Letters from 2045" and dual-path financial visualizations.
 */

import { TimeHorizon } from '../../finance/interfaces';

/**
 * Projected net worth at each time horizon
 * Uses the same time horizons as the simulation engine
 */
export type ProjectedNetWorthByHorizon = Record<TimeHorizon, number>;

/**
 * Single path behavior data showing savings rate and projections
 */
export interface PathBehavior {
  /** Savings rate as a decimal (0.0 - 1.0) */
  savingsRate: number;
  /** Projected net worth at each time horizon */
  projectedNetWorth: ProjectedNetWorthByHorizon;
}

/**
 * Dual-path simulation comparing current behavior vs optimized IKPA path
 */
export interface FutureSimulation {
  /** User's current savings behavior projection */
  currentBehavior: PathBehavior;
  /** Optimized path with IKPA recommendations */
  withIKPA: PathBehavior;
  /** Net worth difference at 20 years (optimized - current) */
  difference_20yr: number;
}

/**
 * User's financial goal
 */
export interface UserGoal {
  /** Goal name/description */
  name: string;
  /** Target amount in local currency */
  amount: number;
  /** Target deadline */
  deadline: Date;
}

/**
 * User context for letter personalization
 * Contains all data needed to generate a personalized future self letter
 */
export interface UserContext {
  /** User's first name */
  name: string;
  /** Current age in years */
  age: number;
  /** City of residence */
  city: string;
  /** User's financial goals */
  goals: UserGoal[];
  /** Current savings rate as decimal (0.0 - 1.0) */
  currentSavingsRate: number;
  /** Monthly income in local currency */
  monthlyIncome: number;
  /** Current net worth (assets - liabilities) */
  currentNetWorth: number;
  /** Recent financial decisions for context */
  recentDecisions?: string[];
  /** Recent financial struggles for empathetic response */
  struggles?: string[];
  /** User's currency code */
  currency: string;
}

/**
 * Letter from the user's future self
 */
export interface LetterFromFuture {
  /** The letter content */
  content: string;
  /** When the letter was generated */
  generatedAt: Date;
  /** The simulation data used to generate the letter */
  simulationData: FutureSimulation;
  /** User's current age */
  userAge: number;
  /** Age of the "future self" writing the letter */
  futureAge: number;
  /** Tone empathy score (1-5) from G-Eval */
  toneScore?: number;
  /** Token usage from LLM generation */
  tokenUsage?: TokenUsage;
}

/**
 * Single timeline projection at a specific year horizon
 */
export interface TimelineProjection {
  /** Net worth on current savings path */
  currentPath: number;
  /** Net worth on optimized IKPA path */
  optimizedPath: number;
  /** Difference (optimized - current) */
  difference: number;
  /** Number of years in the future */
  years: number;
}

/**
 * Token usage statistics from LLM calls
 */
export interface TokenUsage {
  /** Tokens in the prompt */
  promptTokens: number;
  /** Tokens in the response */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
}

/**
 * Result of tone empathy evaluation
 */
export interface ToneEvaluationResult {
  /** Score from 1-5 */
  score: number;
  /** Explanation of the score */
  reasoning: string;
}
