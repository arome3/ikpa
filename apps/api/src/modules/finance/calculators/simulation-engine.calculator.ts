import { Injectable, Logger } from '@nestjs/common';
import { OpikService } from '../../ai/opik/opik.service';
import {
  SimulationInput,
  SimulationOutput,
  MonteCarloIteration,
  MonteCarloAggregatedResults,
  PathResult,
  OptimizedPathResult,
  ProjectedNetWorth,
  WealthDifference,
  ConfidenceIntervalsByHorizon,
  GoalAchievementResult,
  GoalAggregatedResult,
  GoalPathResult,
  SimulationGoal,
  MarketRegime,
  MARKET_REGIMES,
  TIME_HORIZONS,
  TIME_HORIZON_MONTHS,
  SIMULATION_CONSTANTS,
} from '../interfaces';
import { SimulationCalculationException } from '../exceptions';

/**
 * Seeded Pseudo-Random Number Generator using Mulberry32 algorithm
 * Provides reproducible random sequences for testing
 */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /**
   * Generate next random number in [0, 1)
   * Uses Mulberry32 algorithm - fast and good statistical properties
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate a random number from normal distribution using Box-Muller
   */
  nextNormal(mean: number, stdDev: number): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }
}

/**
 * Cache entry for simulation results
 */
interface CacheEntry {
  result: SimulationOutput;
  expiresAt: number;
}

/**
 * Dual-Path Monte Carlo Simulation Engine
 *
 * Runs 10,000 Monte Carlo iterations to project financial futures,
 * comparing "Current Path" (user's current savings behavior) vs
 * "Optimized Path" (recommended savings strategy found via binary search).
 *
 * Projections are made at 6mo, 1yr, 5yr, 10yr, and 20yr horizons.
 *
 * Key features:
 * - Box-Muller transform for normally distributed returns
 * - Inflation-adjusted real returns
 * - Income growth modeling (salary increases over time)
 * - Binary search optimization to find savings rate for target probability
 * - Confidence intervals at all time horizons
 * - Full Opik tracing for observability
 * - In-memory caching with 5-minute TTL
 *
 * @example
 * ```typescript
 * const engine = new SimulationEngineCalculator(opikService);
 * const result = await engine.runDualPathSimulation(userId, input, 'NGN');
 * console.log(result.currentPath.probability); // 0.45
 * console.log(result.optimizedPath.probability); // 0.85
 * console.log(result.optimizedPath.requiredSavingsRate); // 0.18
 * ```
 */
@Injectable()
export class SimulationEngineCalculator {
  private readonly logger = new Logger(SimulationEngineCalculator.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly opikService: OpikService) {}

  /**
   * Run dual-path Monte Carlo simulation
   *
   * @param userId - User ID for tracing and caching
   * @param input - Simulation input parameters
   * @param currency - Currency code for metadata
   * @returns Complete simulation output with current and optimized paths
   */
  async runDualPathSimulation(
    userId: string,
    input: SimulationInput,
    currency: string,
  ): Promise<SimulationOutput> {
    const startTime = Date.now();

    // Check cache first
    const cacheKey = this.getCacheKey(userId, input);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for simulation: ${userId}`);
      return cached;
    }

    // Create Opik trace for the simulation
    const trace = this.opikService.createTrace({
      name: 'dual_path_simulation',
      input: { userId, ...this.sanitizeInputForTrace(input) },
      metadata: {
        calculator: 'SimulationEngineCalculator',
        version: '2.0',
        iterations: SIMULATION_CONSTANTS.ITERATIONS,
        timeHorizons: TIME_HORIZONS,
        targetProbability: SIMULATION_CONSTANTS.TARGET_PROBABILITY,
      },
      tags: ['finance', 'simulation', 'monte-carlo'],
    });

    try {
      // Run Monte Carlo simulation for current path
      const currentPathResults = this.withSpan(
        trace,
        'monte_carlo_current_path',
        () =>
          this.runMonteCarloSimulations(
            input,
            input.currentSavingsRate,
            SIMULATION_CONSTANTS.ITERATIONS,
          ),
      );

      // Aggregate current path results
      const currentAggregated = this.withSpan(
        trace,
        'aggregate_current_results',
        () => this.aggregateResults(currentPathResults),
      );

      // Find optimal savings rate using binary search
      const optimizedSavingsRate = this.withSpan(
        trace,
        'find_optimal_savings_rate',
        () =>
          this.findOptimalSavingsRate(
            input,
            currentAggregated.probability,
          ),
      );

      // Build optimized input with IKPA platform benefits:
      // 1. Immediate expense reduction (Shark auditor, GPS alerts cut waste)
      // 2. Reduced expense growth (budget tracking prevents spending creep)
      // 3. Improved investment returns (goal-aligned financial decisions)
      // 4. Accelerated income growth (financial confidence, career planning)
      const currentExpenseGrowth = input.expenseGrowthRate ?? input.inflationRate;
      const currentIncomeGrowth = input.incomeGrowthRate ?? SIMULATION_CONSTANTS.DEFAULT_INCOME_GROWTH_RATE;
      const monthlyExpenses = input.monthlyExpenses ?? 0;
      const expenseSavings = monthlyExpenses * SIMULATION_CONSTANTS.IKPA_EXPENSE_REDUCTION;
      const ikpaSavingsRate = input.monthlyIncome > 0
        ? Math.min(0.95, optimizedSavingsRate + (expenseSavings / input.monthlyIncome))
        : optimizedSavingsRate;

      const optimizedInput: SimulationInput = {
        ...input,
        expenseGrowthRate: currentExpenseGrowth * (1 - SIMULATION_CONSTANTS.IKPA_EXPENSE_GROWTH_REDUCTION),
        expectedReturnRate: input.expectedReturnRate + SIMULATION_CONSTANTS.IKPA_RETURN_BONUS,
        incomeGrowthRate: currentIncomeGrowth + SIMULATION_CONSTANTS.IKPA_INCOME_GROWTH_BONUS,
      };

      // Run Monte Carlo simulation for optimized path
      const optimizedPathResults = this.withSpan(
        trace,
        'monte_carlo_optimized_path',
        () =>
          this.runMonteCarloSimulations(
            optimizedInput,
            ikpaSavingsRate,
            SIMULATION_CONSTANTS.ITERATIONS,
          ),
      );

      // Aggregate optimized path results
      const optimizedAggregated = this.withSpan(
        trace,
        'aggregate_optimized_results',
        () => this.aggregateResults(optimizedPathResults),
      );

      // Build goals array for path results
      const goals = this.buildGoalsArray(input);

      // Build path results
      const currentPath = this.buildPathResult(currentAggregated, goals);
      const optimizedPath: OptimizedPathResult = {
        ...this.buildPathResult(optimizedAggregated, goals),
        requiredSavingsRate: ikpaSavingsRate,
      };

      // Calculate wealth difference
      const wealthDifference = this.calculateWealthDifference(
        currentPath.projectedNetWorth,
        optimizedPath.projectedNetWorth,
      );

      const durationMs = Date.now() - startTime;

      const result: SimulationOutput = {
        currentPath,
        optimizedPath,
        wealthDifference,
        metadata: {
          iterations: SIMULATION_CONSTANTS.ITERATIONS,
          durationMs,
          simulatedAt: new Date(),
          currency,
        },
      };

      // End trace with success
      this.opikService.endTrace(trace, {
        success: true,
        result: {
          currentPathProbability: currentPath.probability,
          optimizedPathProbability: optimizedPath.probability,
          requiredSavingsRate: optimizedSavingsRate,
          wealthDifference20yr: wealthDifference['20yr'],
          durationMs,
        },
      });

      // Cache the result
      this.setInCache(cacheKey, result);

      this.logger.log(
        `Simulation completed for user ${userId}: current=${(currentPath.probability * 100).toFixed(1)}%, ` +
          `optimized=${(optimizedPath.probability * 100).toFixed(1)}% (rate=${(optimizedSavingsRate * 100).toFixed(1)}%) in ${durationMs}ms`,
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // End trace with error
      this.opikService.endTrace(trace, {
        success: false,
        error: errorMessage,
      });

      this.logger.error(
        `Failed to run simulation for user ${userId}: ${errorMessage}`,
      );

      throw new SimulationCalculationException(errorMessage, { userId });
    }
  }

  // ==========================================
  // OPTIMIZATION: BINARY SEARCH
  // ==========================================

  /**
   * Find the optimal savings rate to achieve target probability using binary search
   *
   * If current probability already meets target, returns current rate.
   * Otherwise, searches between current rate and MAX_SAVINGS_RATE.
   *
   * @param input - Simulation input parameters
   * @param currentProbability - Probability with current savings rate
   * @returns Optimal savings rate (0.0 - MAX_SAVINGS_RATE)
   */
  private findOptimalSavingsRate(
    input: SimulationInput,
    currentProbability: number,
  ): number {
    const targetProbability = SIMULATION_CONSTANTS.TARGET_PROBABILITY;

    // If current rate already achieves target, return current rate
    if (currentProbability >= targetProbability) {
      return input.currentSavingsRate;
    }

    // The optimized rate must never be lower than the user's current rate.
    // If the user already saves above MAX_SAVINGS_RATE, the search ceiling
    // expands to accommodate their actual behavior (capped at 95%).
    const effectiveMax: number = Math.max(
      SIMULATION_CONSTANTS.MAX_SAVINGS_RATE,
      Math.min(input.currentSavingsRate, 0.95),
    );

    // Binary search bounds - explicitly type as number to avoid literal type inference
    let low: number = Math.max(input.currentSavingsRate, SIMULATION_CONSTANTS.MIN_SAVINGS_RATE);
    let high: number = effectiveMax;
    let bestRate: number = high; // Default to max if we can't achieve target
    let iterations = 0;

    // If the user's current rate already meets or exceeds the effective max,
    // no room to search — just return the current rate
    if (low >= high) {
      return input.currentSavingsRate;
    }

    // Check if max rate can achieve target
    const maxRateResults = this.runMonteCarloSimulations(
      input,
      high,
      SIMULATION_CONSTANTS.OPTIMIZATION_ITERATIONS,
    );
    const maxRateProbability = this.calculateProbability(maxRateResults);

    // If even max rate can't achieve target, return max rate
    if (maxRateProbability < targetProbability) {
      this.logger.debug(
        `Max savings rate ${(high * 100).toFixed(1)}% only achieves ${(maxRateProbability * 100).toFixed(1)}% probability`,
      );
      return high;
    }

    // Binary search for optimal rate
    while (
      high - low > SIMULATION_CONSTANTS.OPTIMIZATION_TOLERANCE &&
      iterations < SIMULATION_CONSTANTS.MAX_OPTIMIZATION_ITERATIONS
    ) {
      const mid = (low + high) / 2;

      const results = this.runMonteCarloSimulations(
        input,
        mid,
        SIMULATION_CONSTANTS.OPTIMIZATION_ITERATIONS,
      );
      const probability = this.calculateProbability(results);

      if (probability >= targetProbability) {
        bestRate = mid;
        high = mid; // Try to find a lower rate that still works
      } else {
        low = mid; // Need a higher rate
      }

      iterations++;
    }

    this.logger.debug(
      `Binary search found optimal rate ${(bestRate * 100).toFixed(1)}% in ${iterations} iterations`,
    );

    return bestRate;
  }

  /**
   * Calculate probability of goal achievement from iterations
   */
  private calculateProbability(iterations: MonteCarloIteration[]): number {
    const successCount = iterations.filter((i) => i.goalAchieved).length;
    return successCount / iterations.length;
  }

  // ==========================================
  // MONTE CARLO SIMULATION
  // ==========================================

  /**
   * Run Monte Carlo simulations for a given savings rate
   *
   * @param input - Simulation input parameters
   * @param savingsRate - Savings rate to simulate
   * @param iterations - Number of iterations to run
   * @returns Array of iteration results
   */
  private runMonteCarloSimulations(
    input: SimulationInput,
    savingsRate: number,
    iterations: number,
  ): MonteCarloIteration[] {
    const results: MonteCarloIteration[] = [];

    // Create seeded random generator if seed provided, otherwise use Math.random
    const rng = input.randomSeed !== undefined
      ? new SeededRandom(input.randomSeed)
      : null;

    // Calculate base monthly values
    const baseMonthlySavings = input.monthlyIncome * savingsRate;
    const baseMonthlyExpenses = input.monthlyExpenses ?? 0;

    // Calculate return rates
    const nominalReturnRate = input.expectedReturnRate;
    const taxRate = input.taxRateOnReturns ?? SIMULATION_CONSTANTS.DEFAULT_TAX_RATE;
    const afterTaxReturnRate = nominalReturnRate * (1 - taxRate);
    const realReturnRate = afterTaxReturnRate - input.inflationRate;
    const monthlyReturnRate = realReturnRate / 12;
    const monthlyVolatility = SIMULATION_CONSTANTS.RETURN_STD_DEV / Math.sqrt(12);

    // Growth rates
    const monthlyIncomeGrowthRate = (input.incomeGrowthRate ?? SIMULATION_CONSTANTS.DEFAULT_INCOME_GROWTH_RATE) / 12;
    const expenseGrowthRate = input.expenseGrowthRate ?? input.inflationRate;
    const monthlyExpenseGrowthRate = expenseGrowthRate / 12;

    // Monthly withdrawal after goal achievement
    const monthlyWithdrawal = input.monthlyWithdrawal ?? 0;

    // Build goals array (use multiple goals or single goal)
    const goals = this.buildGoalsArray(input);

    // Primary goal for backwards compatibility
    const primaryGoal = goals[0];
    const monthsToDeadline = this.monthsBetween(new Date(), primaryGoal.deadline);

    for (let i = 0; i < iterations; i++) {
      // Create iteration-specific RNG seed if using seeded random
      const iterationRng = rng
        ? new SeededRandom(input.randomSeed! + i)
        : null;

      const iteration = this.simulatePath(
        input.currentNetWorth,
        baseMonthlySavings,
        baseMonthlyExpenses,
        monthlyReturnRate,
        monthlyVolatility,
        monthlyIncomeGrowthRate,
        monthlyExpenseGrowthRate,
        monthlyWithdrawal,
        goals,
        primaryGoal.amount,
        monthsToDeadline,
        input.enableMarketRegimes ?? false,
        iterationRng,
      );
      results.push(iteration);
    }

    return results;
  }

  /**
   * Build normalized goals array from input
   */
  private buildGoalsArray(input: SimulationInput): SimulationGoal[] {
    if (input.goals && input.goals.length > 0) {
      // Sort by priority (lower = higher priority) and limit to MAX_GOALS
      return [...input.goals]
        .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
        .slice(0, SIMULATION_CONSTANTS.MAX_GOALS)
        .map((g, idx) => ({
          id: g.id ?? `goal-${idx}`,
          name: g.name ?? `Goal ${idx + 1}`,
          amount: g.amount,
          deadline: g.deadline,
          priority: g.priority ?? idx + 1,
        }));
    }

    // Fall back to single goal from legacy fields
    return [{
      id: 'primary',
      name: 'Primary Goal',
      amount: input.goalAmount,
      deadline: input.goalDeadline,
      priority: 1,
    }];
  }

  /**
   * Simulate a single path through time
   *
   * Models:
   * - Stochastic investment returns (Box-Muller normal distribution)
   * - Income growth over time (compounded monthly)
   * - Expense growth (tracks inflation or custom rate)
   * - Market regime correlation (bull/bear/normal cycles)
   * - Tax on investment returns
   * - Withdrawal/drawdown after goal achievement
   * - Multiple goal tracking
   * - Net worth floor at 0 (no negative wealth)
   */
  private simulatePath(
    startingNetWorth: number,
    baseMonthlySavings: number,
    baseMonthlyExpenses: number,
    monthlyReturnRate: number,
    monthlyVolatility: number,
    monthlyIncomeGrowthRate: number,
    monthlyExpenseGrowthRate: number,
    monthlyWithdrawal: number,
    goals: SimulationGoal[],
    primaryGoalAmount: number,
    primaryMonthsToDeadline: number,
    enableMarketRegimes: boolean,
    rng: SeededRandom | null,
  ): MonteCarloIteration {
    let netWorth = startingNetWorth;
    let currentMonthlySavings = baseMonthlySavings;
    let currentMonthlyExpenses = baseMonthlyExpenses;
    let primaryGoalAchieved = false;
    let primaryGoalAchievedMonth: number | null = null;
    const netWorthByHorizon: Partial<ProjectedNetWorth> = {};

    // Track multiple goals
    const goalResults: GoalAchievementResult[] = goals.map((g) => ({
      goalId: g.id ?? 'unknown',
      achieved: false,
      achievedMonth: null,
    }));
    const goalMonthsToDeadline = goals.map((g) =>
      this.monthsBetween(new Date(), g.deadline),
    );

    // Market regime tracking
    let currentRegime: MarketRegime = 'normal';
    let monthsInRegime = 0;

    // Maximum simulation horizon is 20 years (240 months)
    const maxMonths = TIME_HORIZON_MONTHS['20yr'];

    for (let month = 1; month <= maxMonths; month++) {
      // Update market regime if enabled
      if (enableMarketRegimes) {
        const regimeUpdate = this.updateMarketRegime(
          currentRegime,
          monthsInRegime,
          rng,
        );
        if (regimeUpdate.changed) {
          currentRegime = regimeUpdate.newRegime;
          monthsInRegime = 0;
        }
        monthsInRegime++;
      }

      // Get regime-adjusted return parameters
      const regimeParams = enableMarketRegimes
        ? MARKET_REGIMES[currentRegime]
        : null;
      const adjustedReturnRate = regimeParams
        ? monthlyReturnRate + regimeParams.returnAdjustment / 12
        : monthlyReturnRate;
      const adjustedVolatility = regimeParams
        ? monthlyVolatility * regimeParams.volatilityMultiplier
        : monthlyVolatility;

      // Grow income (and savings) over time
      if (month > 1 && monthlyIncomeGrowthRate > 0) {
        currentMonthlySavings *= 1 + monthlyIncomeGrowthRate;
      }

      // Model expense growth impact on savings
      // When expenses grow, they "eat into" potential future savings
      // This reduces the effective savings as expenses outpace income growth
      if (month > 1 && currentMonthlyExpenses > 0) {
        const previousExpenses = currentMonthlyExpenses;
        currentMonthlyExpenses *= 1 + monthlyExpenseGrowthRate;
        // The expense growth delta reduces what you can save
        const expenseGrowthDelta = currentMonthlyExpenses - previousExpenses;
        currentMonthlySavings = Math.max(0, currentMonthlySavings - expenseGrowthDelta);
      }

      // Monthly contribution is what you actually save
      // (Savings rate already accounts for base expenses - we only subtract growth impact)
      let monthlyContribution = currentMonthlySavings;

      // Apply withdrawal if primary goal achieved (retirement drawdown)
      if (primaryGoalAchieved && monthlyWithdrawal > 0) {
        monthlyContribution -= monthlyWithdrawal;
      }

      // Add net contribution
      netWorth += monthlyContribution;

      // Apply stochastic return
      const randomReturn = rng
        ? rng.nextNormal(adjustedReturnRate, adjustedVolatility)
        : this.randomNormal(adjustedReturnRate, adjustedVolatility);
      netWorth *= 1 + randomReturn;

      // Ensure net worth doesn't go negative (floor at 0)
      netWorth = Math.max(0, netWorth);

      // Check primary goal achievement
      if (!primaryGoalAchieved && netWorth >= primaryGoalAmount && month <= primaryMonthsToDeadline) {
        primaryGoalAchieved = true;
        primaryGoalAchievedMonth = month;
      }

      // Check all goals achievement
      for (let i = 0; i < goals.length; i++) {
        if (!goalResults[i].achieved && netWorth >= goals[i].amount && month <= goalMonthsToDeadline[i]) {
          goalResults[i].achieved = true;
          goalResults[i].achievedMonth = month;
        }
      }

      // Record net worth at each time horizon
      for (const horizon of TIME_HORIZONS) {
        if (month === TIME_HORIZON_MONTHS[horizon]) {
          netWorthByHorizon[horizon] = netWorth;
        }
      }
    }

    const allGoalsAchieved = goalResults.every((g) => g.achieved);

    return {
      netWorthByHorizon: netWorthByHorizon as ProjectedNetWorth,
      goalAchieved: primaryGoalAchieved,
      goalAchievedMonth: primaryGoalAchievedMonth,
      goalResults,
      allGoalsAchieved,
    };
  }

  /**
   * Update market regime based on transition probabilities
   */
  private updateMarketRegime(
    currentRegime: MarketRegime,
    monthsInRegime: number,
    rng: SeededRandom | null,
  ): { changed: boolean; newRegime: MarketRegime } {
    const params = MARKET_REGIMES[currentRegime];

    // Check if we should transition (probability increases with time in regime)
    const transitionProbability = Math.min(
      0.5,
      monthsInRegime / params.averageDuration * 0.3,
    );
    const rand = rng ? rng.next() : Math.random();

    if (rand < transitionProbability) {
      // Determine new regime based on transition probabilities
      const transitions = params.transitionProbabilities;
      const newRand = rng ? rng.next() : Math.random();

      let cumulative = 0;
      for (const [regime, prob] of Object.entries(transitions)) {
        cumulative += prob;
        if (newRand < cumulative && regime !== currentRegime) {
          return { changed: true, newRegime: regime as MarketRegime };
        }
      }
    }

    return { changed: false, newRegime: currentRegime };
  }

  // ==========================================
  // RESULTS AGGREGATION
  // ==========================================

  /**
   * Aggregate results from all Monte Carlo iterations
   *
   * Calculates:
   * - Goal achievement probability (primary and all goals)
   * - Median net worth at each horizon
   * - 10th and 90th percentiles at each horizon
   * - Median goal achievement month
   * - Individual goal probabilities
   */
  private aggregateResults(
    iterations: MonteCarloIteration[],
  ): MonteCarloAggregatedResults {
    const n = iterations.length;

    // Calculate probability of achieving primary goal
    const successCount = iterations.filter((i) => i.goalAchieved).length;
    const probability = successCount / n;

    // Calculate probability of achieving ALL goals
    const allGoalsSuccessCount = iterations.filter((i) => i.allGoalsAchieved).length;
    const allGoalsProbability = allGoalsSuccessCount / n;

    // Calculate median and percentiles at each horizon
    const medianNetWorth: Partial<ProjectedNetWorth> = {};
    const percentile10ByHorizon: Partial<ProjectedNetWorth> = {};
    const percentile90ByHorizon: Partial<ProjectedNetWorth> = {};

    for (const horizon of TIME_HORIZONS) {
      const values = iterations
        .map((i) => i.netWorthByHorizon[horizon])
        .sort((a, b) => a - b);

      medianNetWorth[horizon] = this.median(values);
      percentile10ByHorizon[horizon] = this.percentile(values, 10);
      percentile90ByHorizon[horizon] = this.percentile(values, 90);
    }

    // Calculate median goal achievement month for primary goal
    const achievedMonths = iterations
      .filter((i) => i.goalAchievedMonth !== null)
      .map((i) => i.goalAchievedMonth as number)
      .sort((a, b) => a - b);
    const medianGoalMonth =
      achievedMonths.length > 0 ? this.median(achievedMonths) : null;

    // Aggregate individual goal results
    let goalResults: GoalAggregatedResult[] | undefined;
    if (iterations[0]?.goalResults && iterations[0].goalResults.length > 0) {
      const numGoals = iterations[0].goalResults.length;
      goalResults = [];

      for (let i = 0; i < numGoals; i++) {
        const goalId = iterations[0].goalResults[i].goalId;

        // Count successes for this goal
        const goalSuccessCount = iterations.filter(
          (iter) => iter.goalResults?.[i]?.achieved,
        ).length;

        // Get achieved months for this goal
        const goalAchievedMonths = iterations
          .filter((iter) => iter.goalResults?.[i]?.achievedMonth !== null)
          .map((iter) => iter.goalResults![i].achievedMonth as number)
          .sort((a, b) => a - b);

        goalResults.push({
          goalId,
          probability: goalSuccessCount / n,
          medianAchievedMonth:
            goalAchievedMonths.length > 0
              ? this.median(goalAchievedMonths)
              : null,
        });
      }
    }

    return {
      probability,
      medianNetWorth: medianNetWorth as ProjectedNetWorth,
      percentile10ByHorizon: percentile10ByHorizon as ProjectedNetWorth,
      percentile90ByHorizon: percentile90ByHorizon as ProjectedNetWorth,
      medianGoalMonth,
      allGoalsProbability,
      goalResults,
    };
  }

  /**
   * Build a PathResult from aggregated data
   */
  private buildPathResult(
    aggregated: MonteCarloAggregatedResults,
    goals?: SimulationGoal[],
  ): PathResult {
    // Calculate achieve goal date from median month
    let achieveGoalDate: Date | null = null;
    if (aggregated.medianGoalMonth !== null) {
      achieveGoalDate = new Date();
      achieveGoalDate.setMonth(
        achieveGoalDate.getMonth() + aggregated.medianGoalMonth,
      );
    }

    // Build confidence intervals for all horizons
    const confidenceIntervals: Partial<ConfidenceIntervalsByHorizon> = {};
    for (const horizon of TIME_HORIZONS) {
      confidenceIntervals[horizon] = {
        low: Math.round(aggregated.percentile10ByHorizon[horizon]),
        high: Math.round(aggregated.percentile90ByHorizon[horizon]),
      };
    }

    // Build individual goal results
    let goalResults: GoalPathResult[] | undefined;
    if (aggregated.goalResults && goals && goals.length > 0) {
      goalResults = aggregated.goalResults.map((gr, idx) => {
        const goal = goals[idx];
        let achieveDate: Date | null = null;
        if (gr.medianAchievedMonth !== null) {
          achieveDate = new Date();
          achieveDate.setMonth(achieveDate.getMonth() + gr.medianAchievedMonth);
        }
        return {
          goalId: gr.goalId,
          goalName: goal?.name,
          targetAmount: goal?.amount ?? 0,
          probability: Number(gr.probability.toFixed(2)),
          achieveDate,
        };
      });
    }

    return {
      probability: Number(aggregated.probability.toFixed(2)),
      projectedNetWorth: this.roundNetWorth(aggregated.medianNetWorth),
      achieveGoalDate,
      confidenceIntervals: confidenceIntervals as ConfidenceIntervalsByHorizon,
      allGoalsProbability: aggregated.allGoalsProbability !== undefined
        ? Number(aggregated.allGoalsProbability.toFixed(2))
        : undefined,
      goalResults,
    };
  }

  /**
   * Calculate wealth difference between optimized and current paths
   */
  private calculateWealthDifference(
    current: ProjectedNetWorth,
    optimized: ProjectedNetWorth,
  ): WealthDifference {
    const diff: Partial<WealthDifference> = {};
    for (const horizon of TIME_HORIZONS) {
      // Floor at 0: optimized path should never be presented as worse
      diff[horizon] = Math.max(0, Math.round(optimized[horizon] - current[horizon]));
    }
    return diff as WealthDifference;
  }

  // ==========================================
  // STATISTICAL HELPER METHODS
  // ==========================================

  /**
   * Generate a random number from a normal distribution
   * using the Box-Muller transform
   */
  private randomNormal(mean: number, stdDev: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Calculate the median of a sorted array
   */
  private median(sortedArr: number[]): number {
    const n = sortedArr.length;
    if (n === 0) return 0;
    const mid = Math.floor(n / 2);
    return n % 2 !== 0
      ? sortedArr[mid]
      : (sortedArr[mid - 1] + sortedArr[mid]) / 2;
  }

  /**
   * Calculate a percentile of a sorted array
   */
  private percentile(sortedArr: number[], p: number): number {
    const n = sortedArr.length;
    if (n === 0) return 0;
    const index = Math.ceil((p / 100) * n) - 1;
    return sortedArr[Math.max(0, Math.min(index, n - 1))];
  }

  /**
   * Calculate months between two dates
   */
  private monthsBetween(start: Date, end: Date): number {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    return Math.max(0, months);
  }

  /**
   * Round net worth values to nearest integer
   */
  private roundNetWorth(netWorth: ProjectedNetWorth): ProjectedNetWorth {
    const rounded: Partial<ProjectedNetWorth> = {};
    for (const horizon of TIME_HORIZONS) {
      rounded[horizon] = Math.round(netWorth[horizon]);
    }
    return rounded as ProjectedNetWorth;
  }

  // ==========================================
  // CACHING METHODS
  // ==========================================

  /**
   * Generate a cache key for the simulation
   * Includes all input parameters that affect results
   */
  private getCacheKey(userId: string, input: SimulationInput): string {
    const incomeGrowth = input.incomeGrowthRate ?? SIMULATION_CONSTANTS.DEFAULT_INCOME_GROWTH_RATE;
    const expenseGrowth = input.expenseGrowthRate ?? input.inflationRate;
    const taxRate = input.taxRateOnReturns ?? SIMULATION_CONSTANTS.DEFAULT_TAX_RATE;
    const monthlyExpenses = input.monthlyExpenses ?? 0;
    const monthlyWithdrawal = input.monthlyWithdrawal ?? 0;
    const enableRegimes = input.enableMarketRegimes ?? false;
    const goalsHash = input.goals
      ? input.goals.map((g) => `${g.amount}:${g.deadline.getTime()}`).join('|')
      : '';

    return `sim:${userId}:${input.currentSavingsRate}:${input.monthlyIncome}:${monthlyExpenses}:${input.currentNetWorth}:${input.goalAmount}:${input.goalDeadline.getTime()}:${input.expectedReturnRate}:${input.inflationRate}:${incomeGrowth}:${expenseGrowth}:${taxRate}:${monthlyWithdrawal}:${enableRegimes}:${goalsHash}`;
  }

  /**
   * Get a cached result if not expired
   */
  private getFromCache(key: string): SimulationOutput | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * Store a result in the cache
   */
  private setInCache(key: string, result: SimulationOutput): void {
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + SIMULATION_CONSTANTS.CACHE_TTL_MS,
    });

    // Cleanup old entries periodically (every 100 sets)
    if (this.cache.size > 100) {
      this.cleanupCache();
    }
  }

  /**
   * Remove expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  // ==========================================
  // OPIK TRACING HELPERS
  // ==========================================

  /**
   * Wrap a calculation in an Opik span for tracing
   */
  private withSpan<T>(
    trace: ReturnType<OpikService['createTrace']>,
    spanName: string,
    calculation: () => T,
  ): T {
    if (!trace) {
      return calculation();
    }

    const span = this.opikService.createToolSpan({
      trace: trace.trace,
      name: spanName,
      input: { spanName },
      metadata: {},
    });

    const result = calculation();

    this.opikService.endSpan(span, {
      output: { completed: true },
      metadata: {},
    });

    return result;
  }

  /**
   * Sanitize input for Opik trace (remove sensitive data)
   */
  private sanitizeInputForTrace(
    input: SimulationInput,
  ): Record<string, unknown> {
    return {
      currentSavingsRate: input.currentSavingsRate,
      hasIncome: input.monthlyIncome > 0,
      hasExpenses: (input.monthlyExpenses ?? 0) > 0,
      hasNetWorth: input.currentNetWorth !== 0,
      goalAmount: input.goalAmount,
      goalCount: input.goals?.length ?? 1,
      expectedReturnRate: input.expectedReturnRate,
      inflationRate: input.inflationRate,
      incomeGrowthRate: input.incomeGrowthRate ?? SIMULATION_CONSTANTS.DEFAULT_INCOME_GROWTH_RATE,
      expenseGrowthRate: input.expenseGrowthRate ?? input.inflationRate,
      taxRateOnReturns: input.taxRateOnReturns ?? SIMULATION_CONSTANTS.DEFAULT_TAX_RATE,
      hasWithdrawal: (input.monthlyWithdrawal ?? 0) > 0,
      enableMarketRegimes: input.enableMarketRegimes ?? false,
      hasRandomSeed: input.randomSeed !== undefined,
    };
  }

  /**
   * Clear the cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
