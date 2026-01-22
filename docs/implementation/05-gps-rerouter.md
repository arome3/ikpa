# GPS Re-Router

**Week:** 2 | **Tier:** 2 | **Depends On:** [03-simulation-engine](./03-simulation-engine.md)

---

## Overview

The GPS Re-Router reframes budget slips as "wrong turns, not dead ends." When users exceed their budget, it recalculates goal probability and presents three recovery paths without judgment. This defeats the **What-The-Hell Effect** where one slip cascades into total abandonment.

**Failure Mode Defeated:** Failure Spiral

**Why It Matters:**
- 88% of resolutions fail within 2 weeks
- First slip is the #1 predictor of total abandonment
- Users who recover from first slip are 3x more likely to succeed
- Non-judgmental framing prevents shame → avoidance → abandonment cycle

---

## Technical Spec

### Trigger Mechanism

- Webhook on budget threshold exceed (80%, 100%, 120%)
- Manual trigger ("I overspent, help me recover")
- Scheduled weekly goal check

### Interfaces

```typescript
interface BudgetStatus {
  category: string;
  budgeted: number;
  spent: number;
  overagePercent: number;
  trigger: 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'BUDGET_CRITICAL';
}

interface GoalImpact {
  goalName: string;
  previousProbability: number;
  newProbability: number;
  probabilityDrop: number;
  message: string;
}

interface RecoveryPath {
  id: string;
  name: string;
  description: string;
  newProbability: number;
  effort: 'Low' | 'Medium' | 'High';
  timelineImpact?: string;
  savingsImpact?: string;
}

interface RecoveryResponse {
  budgetStatus: BudgetStatus;
  goalImpact: GoalImpact;
  recoveryPaths: RecoveryPath[];
  message: NonJudgmentalMessage;
}
```

### Core Logic

```typescript
// GPS RE-ROUTER: Turn wrong turns into recalculations

// Step 1: Detect Budget Exceed
const budgetStatus = {
  category: 'Entertainment',
  budgeted: 50000,
  spent: 72000,
  overagePercent: 44,
  trigger: 'BUDGET_EXCEEDED'
};

// Step 2: Probability Engine Recalculation
const goalImpact = {
  goalName: 'House Down Payment',
  previousProbability: 0.78,
  newProbability: 0.71,
  probabilityDrop: 0.07,
  message: 'This spending reduced your goal probability from 78% to 71%.'
};

// Step 3: Generate 3 Recovery Paths
const recoveryPaths = [
  {
    name: 'Time Adjustment',
    description: 'Extend goal deadline by 3 weeks',
    newProbability: 0.78,
    effort: 'Low'
  },
  {
    name: 'Rate Adjustment',
    description: 'Increase weekly savings by ₦5,000 for next month',
    newProbability: 0.80,
    effort: 'Medium'
  },
  {
    name: 'Freeze Protocol',
    description: 'Pause entertainment spending for 2 weeks',
    newProbability: 0.82,
    effort: 'High'
  }
];

// Step 4: Non-Judgmental Framing
const message = {
  tone: 'Supportive',
  headline: "You made a wrong turn. Let's recalculate.",
  subtext: "This isn't failure—it's navigation. Choose your recovery path:",
  NO_shame_words: ['failed', 'mistake', 'problem', 'wrong', 'bad']
};
```

### Full Implementation

```typescript
// apps/api/src/modules/ai/agents/gps-rerouter.agent.ts
import { Injectable } from '@nestjs/common';
import { OpikService } from '../opik/opik.service';
import { SimulationEngine } from '../../finance/calculators/simulation-engine';
import { BudgetService } from '../../finance/budget.service';
import { GoalService } from '../../finance/goal.service';

interface NonJudgmentalMessage {
  tone: 'Supportive';
  headline: string;
  subtext: string;
}

@Injectable()
export class GpsRerouterAgent {
  // Words to NEVER use in recovery messages
  private readonly BANNED_WORDS = ['failed', 'mistake', 'problem', 'wrong', 'bad', 'terrible', 'awful', 'shame'];

  constructor(
    private opikService: OpikService,
    private simulationEngine: SimulationEngine,
    private budgetService: BudgetService,
    private goalService: GoalService,
  ) {}

  async handleBudgetExceed(userId: string, category: string): Promise<RecoveryResponse> {
    const trace = this.opikService.createTrace('gps_rerouter_cognitive_chain', { userId, category }, { agent: 'gps_rerouter', version: '1.0' });

    // Span 1: Detect Budget Status
    const budgetSpan = trace.span({ name: 'detect_budget_status', type: 'tool' });
    const budgetStatus = await this.detectBudgetStatus(userId, category);
    budgetSpan.end({ output: budgetStatus });

    // Span 2: Calculate Goal Impact
    const impactSpan = trace.span({ name: 'calculate_goal_impact', type: 'tool' });
    const goalImpact = await this.calculateGoalImpact(userId, budgetStatus);
    impactSpan.end({ output: goalImpact });

    // Span 3: Generate Recovery Paths
    const pathsSpan = trace.span({ name: 'generate_recovery_paths', type: 'tool' });
    const recoveryPaths = await this.generateRecoveryPaths(userId, budgetStatus, goalImpact);
    pathsSpan.end({ output: { pathCount: recoveryPaths.length } });

    // Span 4: Generate Non-Judgmental Message
    const messageSpan = trace.span({ name: 'generate_message', type: 'llm' });
    const message = this.generateNonJudgmentalMessage(budgetStatus, goalImpact);
    this.validateNoBannedWords(message);
    messageSpan.end({ output: message });

    const result: RecoveryResponse = {
      budgetStatus,
      goalImpact,
      recoveryPaths,
      message,
    };

    trace.end({ output: { success: true, pathsGenerated: recoveryPaths.length } });
    await this.opikService.flush();

    return result;
  }

  private async detectBudgetStatus(userId: string, category: string): Promise<BudgetStatus> {
    const budget = await this.budgetService.getBudget(userId, category);
    const spent = await this.budgetService.getSpent(userId, category);

    const overagePercent = Math.round(((spent - budget.amount) / budget.amount) * 100);

    let trigger: BudgetStatus['trigger'];
    if (overagePercent >= 20) trigger = 'BUDGET_CRITICAL';
    else if (overagePercent >= 0) trigger = 'BUDGET_EXCEEDED';
    else trigger = 'BUDGET_WARNING'; // 80-100% range

    return {
      category,
      budgeted: budget.amount,
      spent,
      overagePercent: Math.max(0, overagePercent),
      trigger,
    };
  }

  private async calculateGoalImpact(userId: string, budgetStatus: BudgetStatus): Promise<GoalImpact> {
    const primaryGoal = await this.goalService.getPrimaryGoal(userId);
    const overspend = budgetStatus.spent - budgetStatus.budgeted;

    // Run simulation with reduced savings
    const userData = await this.goalService.getSimulationInput(userId);
    const adjustedSavings = userData.currentSavingsRate - (overspend / userData.monthlyIncome);

    const currentSimulation = await this.simulationEngine.runDualPathSimulation(userData);
    const adjustedSimulation = await this.simulationEngine.runDualPathSimulation({
      ...userData,
      currentSavingsRate: Math.max(0, adjustedSavings),
    });

    const probabilityDrop = currentSimulation.currentPath.probability - adjustedSimulation.currentPath.probability;

    return {
      goalName: primaryGoal.name,
      previousProbability: currentSimulation.currentPath.probability,
      newProbability: adjustedSimulation.currentPath.probability,
      probabilityDrop,
      message: `This spending reduced your goal probability from ${Math.round(currentSimulation.currentPath.probability * 100)}% to ${Math.round(adjustedSimulation.currentPath.probability * 100)}%.`,
    };
  }

  private async generateRecoveryPaths(
    userId: string,
    budgetStatus: BudgetStatus,
    goalImpact: GoalImpact
  ): Promise<RecoveryPath[]> {
    const userData = await this.goalService.getSimulationInput(userId);
    const overspend = budgetStatus.spent - budgetStatus.budgeted;

    // Path 1: Time Adjustment (Low Effort)
    const timeExtension = Math.ceil(overspend / (userData.monthlyIncome * userData.currentSavingsRate / 4)); // weeks
    const timeAdjustedSimulation = await this.simulationEngine.runDualPathSimulation({
      ...userData,
      goalDeadline: new Date(userData.goalDeadline.getTime() + timeExtension * 7 * 24 * 60 * 60 * 1000),
    });

    // Path 2: Rate Adjustment (Medium Effort)
    const additionalWeeklySavings = Math.ceil(overspend / 4); // Spread over 4 weeks
    const rateAdjustedSimulation = await this.simulationEngine.runDualPathSimulation({
      ...userData,
      currentSavingsRate: userData.currentSavingsRate + (additionalWeeklySavings * 4 / userData.monthlyIncome),
    });

    // Path 3: Freeze Protocol (High Effort)
    const freezeSimulation = await this.simulationEngine.runDualPathSimulation({
      ...userData,
      currentSavingsRate: userData.currentSavingsRate + (budgetStatus.budgeted / userData.monthlyIncome),
    });

    return [
      {
        id: 'time_adjustment',
        name: 'Time Adjustment',
        description: `Extend goal deadline by ${timeExtension} weeks`,
        newProbability: timeAdjustedSimulation.currentPath.probability,
        effort: 'Low',
        timelineImpact: `+${timeExtension} weeks`,
      },
      {
        id: 'rate_adjustment',
        name: 'Rate Adjustment',
        description: `Increase weekly savings by ₦${additionalWeeklySavings.toLocaleString()} for next month`,
        newProbability: rateAdjustedSimulation.currentPath.probability,
        effort: 'Medium',
        savingsImpact: `+₦${additionalWeeklySavings.toLocaleString()}/week for 4 weeks`,
      },
      {
        id: 'freeze_protocol',
        name: 'Freeze Protocol',
        description: `Pause ${budgetStatus.category.toLowerCase()} spending for 2 weeks`,
        newProbability: freezeSimulation.currentPath.probability,
        effort: 'High',
        savingsImpact: `₦0 on ${budgetStatus.category.toLowerCase()} for 2 weeks`,
      },
    ];
  }

  private generateNonJudgmentalMessage(budgetStatus: BudgetStatus, goalImpact: GoalImpact): NonJudgmentalMessage {
    return {
      tone: 'Supportive',
      headline: "You made a wrong turn. Let's recalculate.",
      subtext: "This isn't failure—it's navigation. Choose your recovery path:",
    };
  }

  private validateNoBannedWords(message: NonJudgmentalMessage): void {
    const text = `${message.headline} ${message.subtext}`.toLowerCase();
    for (const word of this.BANNED_WORDS) {
      if (text.includes(word)) {
        throw new Error(`Message contains banned shame word: ${word}`);
      }
    }
  }

  async selectRecoveryPath(userId: string, pathId: string): Promise<void> {
    const trace = this.opikService.createTrace('recovery_path_selection', { userId, pathId });

    // Apply the selected recovery path
    switch (pathId) {
      case 'time_adjustment':
        await this.goalService.extendDeadline(userId);
        break;
      case 'rate_adjustment':
        await this.budgetService.adjustSavingsRate(userId);
        break;
      case 'freeze_protocol':
        await this.budgetService.freezeCategory(userId);
        break;
    }

    trace.end({ output: { applied: true, pathId } });
    await this.opikService.flush();
  }
}
```

---

## Non-Judgmental Framing Examples

| Judgmental (DON'T) | Non-Judgmental (DO) |
|--------------------|---------------------|
| "You exceeded your budget by 44%" | "You made a wrong turn. Let's recalculate your route." |
| "You failed to stay within your entertainment budget" | "Your entertainment spending took an unexpected detour. Here are 3 ways to get back on track." |
| "You have a spending problem" | "Let's adjust your route to your goal" |

---

## Implementation Checklist

- [ ] Create file: `apps/api/src/modules/ai/agents/gps-rerouter.agent.ts`
- [ ] Create budget threshold webhook triggers
- [ ] Implement probability recalculation engine
- [ ] Build 3 recovery path generators
- [ ] Add banned words validation
- [ ] Integrate with Simulation Engine
- [ ] Add Opik tracing spans
- [ ] Write unit tests for recovery paths
- [ ] Add Swagger documentation

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/gps/recalculate` | Recalculate after budget exceed |
| GET | `/v1/gps/recovery-paths` | Get 3 recovery options |
| POST | `/v1/gps/recovery-paths/:id/select` | Select a recovery path |

---

## Opik Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `RecoveryPathSelection` | Distribution | Which path users choose most often |
| `GoalSurvivalRate` | Percentage | Users who don't abandon goal after slip |
| `TimeToRecovery` | Duration | Hours between slip and recovery path selection |
| `ProbabilityRestored` | Percentage | How much probability was recovered |

---

## Verification

### curl Commands

```bash
# Recalculate after budget exceed
curl -X POST http://localhost:3000/v1/gps/recalculate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "Entertainment"
  }'

# Get recovery paths
curl -X GET http://localhost:3000/v1/gps/recovery-paths \
  -H "Authorization: Bearer $TOKEN"

# Select a recovery path
curl -X POST http://localhost:3000/v1/gps/recovery-paths/rate_adjustment/select \
  -H "Authorization: Bearer $TOKEN"
```

### Expected Response (POST /v1/gps/recalculate)

```json
{
  "budgetStatus": {
    "category": "Entertainment",
    "budgeted": 50000,
    "spent": 72000,
    "overagePercent": 44,
    "trigger": "BUDGET_EXCEEDED"
  },
  "goalImpact": {
    "goalName": "House Down Payment",
    "previousProbability": 0.78,
    "newProbability": 0.71,
    "probabilityDrop": 0.07,
    "message": "This spending reduced your goal probability from 78% to 71%."
  },
  "recoveryPaths": [
    {
      "id": "time_adjustment",
      "name": "Time Adjustment",
      "description": "Extend goal deadline by 3 weeks",
      "newProbability": 0.78,
      "effort": "Low",
      "timelineImpact": "+3 weeks"
    },
    {
      "id": "rate_adjustment",
      "name": "Rate Adjustment",
      "description": "Increase weekly savings by ₦5,000 for next month",
      "newProbability": 0.80,
      "effort": "Medium",
      "savingsImpact": "+₦5,000/week for 4 weeks"
    },
    {
      "id": "freeze_protocol",
      "name": "Freeze Protocol",
      "description": "Pause entertainment spending for 2 weeks",
      "newProbability": 0.82,
      "effort": "High",
      "savingsImpact": "₦0 on entertainment for 2 weeks"
    }
  ],
  "message": {
    "tone": "Supportive",
    "headline": "You made a wrong turn. Let's recalculate.",
    "subtext": "This isn't failure—it's navigation. Choose your recovery path:"
  }
}
```
