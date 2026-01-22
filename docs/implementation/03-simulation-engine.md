# Simulation Engine (Dual-Path Monte Carlo)

**Week:** 1 | **Tier:** 1 | **Depends On:** [01-opik-integration](./01-opik-integration.md), [02-cash-flow-score](./02-cash-flow-score.md)

---

## Overview

The Simulation Engine runs Dual-Path Monte Carlo simulations with 10,000 iterations to project the user's financial future. It compares "Current Path" (continuing current behavior) vs "Optimized Path" (following IKPA recommendations).

**Why It Matters:**
- Powers Future Self visualizations (6mo → 20yr projections)
- Shows concrete wealth divergence between paths
- Probability calculations for goal achievement
- Foundation for GPS Re-Router recovery path generation

**Failure Mode Defeated:** Temporal Disconnect - by making future consequences tangible

---

## Technical Spec

### Interfaces

```typescript
interface SimulationInput {
  currentSavingsRate: number;
  monthlyIncome: number;
  currentNetWorth: number;
  goalAmount: number;
  goalDeadline: Date;
  expectedReturnRate: number; // 7% default
  inflationRate: number;      // 5% Nigeria, 2% US
}

interface SimulationOutput {
  currentPath: {
    probability: number;
    projectedNetWorth: Record<string, number>;
    achieveGoalDate: Date | null;
  };
  optimizedPath: {
    probability: number;
    projectedNetWorth: Record<string, number>;
    achieveGoalDate: Date | null;
    requiredSavingsRate: number;
  };
}
```

### Core Logic

```typescript
// Monte Carlo with 10,000 simulations
function runDualPathSimulation(input: SimulationInput): SimulationOutput {
  const iterations = 10000;
  const currentPathResults = [];
  const optimizedPathResults = [];

  for (let i = 0; i < iterations; i++) {
    // Add random variance to returns (normal distribution)
    const variance = randomNormal(0, 0.15);

    // Current path simulation
    currentPathResults.push(
      simulatePath(input, input.currentSavingsRate, variance)
    );

    // Optimized path simulation (IKPA recommendations)
    const optimizedRate = Math.min(input.currentSavingsRate * 1.5, 0.35);
    optimizedPathResults.push(
      simulatePath(input, optimizedRate, variance)
    );
  }

  return {
    currentPath: aggregateResults(currentPathResults),
    optimizedPath: aggregateResults(optimizedPathResults)
  };
}
```

### Full Implementation

```typescript
// apps/api/src/modules/finance/calculators/simulation-engine.ts
import { Injectable } from '@nestjs/common';
import { OpikService } from '../../ai/opik/opik.service';

interface SimulationInput {
  currentSavingsRate: number;
  monthlyIncome: number;
  currentNetWorth: number;
  goalAmount: number;
  goalDeadline: Date;
  expectedReturnRate: number;
  inflationRate: number;
}

interface PathResult {
  finalNetWorth: number;
  goalAchieved: boolean;
  achieveDate: Date | null;
  netWorthTimeline: Record<string, number>;
}

interface SimulationOutput {
  currentPath: {
    probability: number;
    projectedNetWorth: Record<string, number>;
    achieveGoalDate: Date | null;
    confidenceInterval: { low: number; high: number };
  };
  optimizedPath: {
    probability: number;
    projectedNetWorth: Record<string, number>;
    achieveGoalDate: Date | null;
    requiredSavingsRate: number;
    confidenceInterval: { low: number; high: number };
  };
  wealthDifference: Record<string, number>;
}

@Injectable()
export class SimulationEngine {
  private readonly ITERATIONS = 10000;
  private readonly TIME_HORIZONS = ['6mo', '1yr', '5yr', '10yr', '20yr'];

  constructor(private opikService: OpikService) {}

  async runDualPathSimulation(input: SimulationInput): Promise<SimulationOutput> {
    const trace = this.opikService.createTrace('dual_path_simulation', {
      input,
      iterations: this.ITERATIONS
    });

    const currentPathResults: PathResult[] = [];
    const optimizedPathResults: PathResult[] = [];

    // Run Monte Carlo simulations
    const simulationSpan = trace.span({ name: 'monte_carlo_iterations', type: 'tool' });

    for (let i = 0; i < this.ITERATIONS; i++) {
      const variance = this.randomNormal(0, 0.15);

      currentPathResults.push(
        this.simulatePath(input, input.currentSavingsRate, variance)
      );

      const optimizedRate = Math.min(input.currentSavingsRate * 1.5, 0.35);
      optimizedPathResults.push(
        this.simulatePath(input, optimizedRate, variance)
      );
    }

    simulationSpan.end({ output: { completed: this.ITERATIONS } });

    // Aggregate results
    const aggregationSpan = trace.span({ name: 'aggregate_results', type: 'tool' });

    const currentPath = this.aggregateResults(currentPathResults, input.goalAmount);
    const optimizedPath = this.aggregateResults(optimizedPathResults, input.goalAmount);
    optimizedPath.requiredSavingsRate = Math.min(input.currentSavingsRate * 1.5, 0.35);

    const wealthDifference = this.calculateWealthDifference(
      currentPath.projectedNetWorth,
      optimizedPath.projectedNetWorth
    );

    aggregationSpan.end({ output: { currentPathProb: currentPath.probability, optimizedPathProb: optimizedPath.probability } });

    const result: SimulationOutput = {
      currentPath,
      optimizedPath,
      wealthDifference,
    };

    trace.end({ output: result });
    await this.opikService.flush();

    return result;
  }

  private simulatePath(
    input: SimulationInput,
    savingsRate: number,
    returnVariance: number
  ): PathResult {
    let netWorth = input.currentNetWorth;
    const monthlySavings = input.monthlyIncome * savingsRate;
    const monthlyReturn = (input.expectedReturnRate + returnVariance) / 12;
    const monthlyInflation = input.inflationRate / 12;

    const netWorthTimeline: Record<string, number> = {};
    let goalAchieved = false;
    let achieveDate: Date | null = null;

    const horizonMonths = { '6mo': 6, '1yr': 12, '5yr': 60, '10yr': 120, '20yr': 240 };

    for (let month = 1; month <= 240; month++) {
      // Compound growth + savings
      netWorth = netWorth * (1 + monthlyReturn - monthlyInflation) + monthlySavings;

      // Check time horizons
      for (const [horizon, months] of Object.entries(horizonMonths)) {
        if (month === months) {
          netWorthTimeline[horizon] = Math.round(netWorth);
        }
      }

      // Check goal achievement
      if (!goalAchieved && netWorth >= input.goalAmount) {
        goalAchieved = true;
        achieveDate = new Date();
        achieveDate.setMonth(achieveDate.getMonth() + month);
      }
    }

    return {
      finalNetWorth: netWorth,
      goalAchieved,
      achieveDate,
      netWorthTimeline,
    };
  }

  private aggregateResults(results: PathResult[], goalAmount: number) {
    const successCount = results.filter(r => r.goalAchieved).length;
    const probability = successCount / results.length;

    // Aggregate timelines (median)
    const projectedNetWorth: Record<string, number> = {};
    for (const horizon of this.TIME_HORIZONS) {
      const values = results.map(r => r.netWorthTimeline[horizon]).sort((a, b) => a - b);
      projectedNetWorth[horizon] = values[Math.floor(values.length / 2)]; // Median
    }

    // Confidence interval (10th and 90th percentile)
    const finalValues = results.map(r => r.finalNetWorth).sort((a, b) => a - b);
    const confidenceInterval = {
      low: finalValues[Math.floor(results.length * 0.1)],
      high: finalValues[Math.floor(results.length * 0.9)],
    };

    // Median achieve date
    const achieveDates = results
      .filter(r => r.achieveDate)
      .map(r => r.achieveDate!.getTime())
      .sort((a, b) => a - b);
    const achieveGoalDate = achieveDates.length > 0
      ? new Date(achieveDates[Math.floor(achieveDates.length / 2)])
      : null;

    return {
      probability,
      projectedNetWorth,
      achieveGoalDate,
      confidenceInterval,
    };
  }

  private calculateWealthDifference(
    current: Record<string, number>,
    optimized: Record<string, number>
  ): Record<string, number> {
    const difference: Record<string, number> = {};
    for (const horizon of this.TIME_HORIZONS) {
      difference[horizon] = optimized[horizon] - current[horizon];
    }
    return difference;
  }

  private randomNormal(mean: number, stdDev: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }
}
```

---

## Implementation Checklist

- [ ] Create file: `apps/api/src/modules/finance/calculators/simulation-engine.ts`
- [ ] Add SimulationEngine to FinanceModule providers
- [ ] Create `/v1/finance/simulation` endpoint in controller
- [ ] Add Opik tracing for Monte Carlo iterations
- [ ] Implement caching for expensive simulations
- [ ] Write unit tests with known seed values
- [ ] Add Swagger documentation
- [ ] Test with sample user data

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/finance/simulation` | Get dual-path simulation results |
| POST | `/v1/finance/simulation` | Run simulation with custom parameters |

---

## Opik Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `SimulationIterations` | Counter | Number of Monte Carlo iterations |
| `CurrentPathProbability` | Gauge | Goal achievement probability (current) |
| `OptimizedPathProbability` | Gauge | Goal achievement probability (optimized) |
| `WealthDifference20yr` | Gauge | Net worth difference at 20 years |

---

## Verification

### curl Commands

```bash
# Get simulation with default user data
curl -X GET http://localhost:3000/v1/finance/simulation \
  -H "Authorization: Bearer $TOKEN"

# Run simulation with custom parameters
curl -X POST http://localhost:3000/v1/finance/simulation \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentSavingsRate": 0.08,
    "monthlyIncome": 400000,
    "currentNetWorth": 500000,
    "goalAmount": 2000000,
    "goalDeadline": "2026-12-31",
    "expectedReturnRate": 0.07,
    "inflationRate": 0.05
  }'
```

### Expected Response

```json
{
  "currentPath": {
    "probability": 0.71,
    "projectedNetWorth": {
      "6mo": 550000,
      "1yr": 620000,
      "5yr": 1200000,
      "10yr": 2400000,
      "20yr": 8500000
    },
    "achieveGoalDate": "2027-08-15",
    "confidenceInterval": {
      "low": 6800000,
      "high": 12000000
    }
  },
  "optimizedPath": {
    "probability": 0.89,
    "projectedNetWorth": {
      "6mo": 580000,
      "1yr": 700000,
      "5yr": 1800000,
      "10yr": 4200000,
      "20yr": 18000000
    },
    "achieveGoalDate": "2026-11-20",
    "requiredSavingsRate": 0.12,
    "confidenceInterval": {
      "low": 14000000,
      "high": 24000000
    }
  },
  "wealthDifference": {
    "6mo": 30000,
    "1yr": 80000,
    "5yr": 600000,
    "10yr": 1800000,
    "20yr": 9500000
  }
}
```

### Integration with Future Self

The simulation output directly feeds into the Future Self letter generator:

```typescript
// In future-self.agent.ts
const simulation = await simulationEngine.runDualPathSimulation(userInput);

const letterContext = {
  currentPath: simulation.currentPath.projectedNetWorth,
  optimizedPath: simulation.optimizedPath.projectedNetWorth,
  difference_20yr: simulation.wealthDifference['20yr'],
  currentProbability: simulation.currentPath.probability,
  optimizedProbability: simulation.optimizedPath.probability,
};
```
