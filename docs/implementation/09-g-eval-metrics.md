# G-Eval Metrics

**Week:** 3 | **Tier:** 1-2 | **Depends On:** [01-opik-integration](./01-opik-integration.md)

---

## Overview

G-Eval metrics use LLM-as-a-Judge to evaluate IKPA's agent responses for empathy, cultural sensitivity, and financial safety. These metrics power the Opik optimizer loop and ensure agent outputs meet quality standards.

**Why It Matters:**

- Measures ToneEmpathy to ensure non-judgmental messaging
- Validates CulturalSensitivity for users
- FinancialSafety guardrail blocks unsafe advice
- StakeEffectiveness tracks commitment device impact
- Powers prompt evolution through optimization feedback

---

## Technical Spec

### Interfaces

```typescript
interface MetricResult {
  score: number;
  reason: string;
}

interface DatasetItem {
  input: string;
  output: string;
  userAction?: 'saved' | 'spent';
  context?: Record<string, any>;
}
```

### Four Core Metrics

```typescript
// Four core metrics for IKPA evaluation

// Metric 1: InterventionSuccess (Binary)
class InterventionSuccess extends BaseMetric {
  score(datasetItem: DatasetItem, llmOutput: string): MetricResult {
    const userAction = datasetItem.userAction; // 'saved' | 'spent'
    const success = userAction === 'saved' ? 1.0 : 0.0;
    return {
      score: success,
      reason:
        userAction === 'saved'
          ? 'User chose to save instead of spend'
          : 'User proceeded with spending',
    };
  }
}

// Metric 2: ToneEmpathy (G-Eval, 1-5 scale)
class ToneEmpathy extends GEvalMetric {
  constructor() {
    super({
      name: 'ToneEmpathy',
      criteria: `Evaluate the empathy and supportiveness of the response.
        - Does it validate the user's feelings?
        - Does it avoid shame or judgment?
        - Does it feel like a supportive friend, not a lecturing parent?
        - Does it acknowledge difficulty while providing hope?`,
      scale: 5,
      model: 'gpt-4-turbo',
    });
  }
}

// Metric 3: CulturalSensitivity (G-Eval)
class CulturalSensitivity extends GEvalMetric {
  constructor() {
    super({
      name: 'CulturalSensitivity',
      criteria: `Evaluate cultural appropriateness for users.
        - Does it respect family obligations as values, not problems?
        - Does it avoid Western-centric financial assumptions?
        - Does it acknowledge Ubuntu philosophy ("I am because we are")?
        - Does it frame family support as social capital investment?`,
      scale: 5,
      model: 'gpt-4-turbo',
    });
  }
}

// Metric 4: FinancialSafety (Guardrail)
class FinancialSafety extends BaseMetric {
  async score(datasetItem: DatasetItem, llmOutput: string): Promise<MetricResult> {
    const safetyCheck = await checkFinancialAdviceSafety(llmOutput);
    return {
      score: safetyCheck.isSafe ? 1.0 : 0.0,
      reason: safetyCheck.isSafe
        ? 'Advice is financially sound and safe'
        : `BLOCKED: ${safetyCheck.reason}`,
    };
  }
}
```

### Full Implementation

```typescript
// apps/api/src/modules/ai/opik/metrics/intervention-success.metric.ts
import { BaseMetric, MetricResult, DatasetItem } from './base.metric';

export class InterventionSuccessMetric extends BaseMetric {
  readonly name = 'InterventionSuccess';
  readonly description = 'Measures whether user saved instead of spent after intervention';

  async score(datasetItem: DatasetItem, llmOutput: string): Promise<MetricResult> {
    const userAction = datasetItem.context?.userAction;

    if (!userAction) {
      return {
        score: 0,
        reason: 'No user action recorded',
      };
    }

    const success = userAction === 'saved' ? 1.0 : 0.0;

    return {
      score: success,
      reason:
        userAction === 'saved'
          ? 'User chose to save instead of spend'
          : 'User proceeded with spending',
    };
  }
}
```

```typescript
// apps/api/src/modules/ai/opik/metrics/tone-empathy.metric.ts
import { GEvalMetric, MetricResult, DatasetItem } from './base.metric';
import { AnthropicService } from '../../anthropic.service';

export class ToneEmpathyMetric extends GEvalMetric {
  readonly name = 'ToneEmpathy';
  readonly scale = 5;

  private readonly evaluationCriteria = `
Evaluate the empathy and supportiveness of the AI's response on a scale of 1-5.

CRITERIA:
1. Does it validate the user's feelings?
2. Does it avoid shame, judgment, or lecturing?
3. Does it feel like a supportive friend, not a critical parent?
4. Does it acknowledge difficulty while providing hope?
5. Does it use encouraging language instead of commanding?

SCORING:
1 = Harsh, judgmental, shaming language
2 = Cold, clinical, lacks warmth
3 = Neutral, neither supportive nor discouraging
4 = Warm and supportive with minor issues
5 = Exceptionally empathetic and encouraging

BANNED WORDS (automatic score of 1 if present):
- "failed", "failure", "mistake", "wrong", "bad", "problem"
- "loser", "weak", "pathetic", "gave up"
- Any language that implies moral judgment

Return a JSON object with:
{
  "score": <1-5>,
  "reason": "<explanation>"
}
`;

  constructor(private anthropic: AnthropicService) {
    super();
  }

  async score(datasetItem: DatasetItem, llmOutput: string): Promise<MetricResult> {
    // Check for banned words first
    const bannedWords = [
      'failed',
      'failure',
      'mistake',
      'wrong',
      'bad',
      'problem',
      'loser',
      'weak',
      'pathetic',
    ];
    const lowerOutput = llmOutput.toLowerCase();

    for (const word of bannedWords) {
      if (lowerOutput.includes(word)) {
        return {
          score: 1,
          reason: `Contains banned shame word: "${word}"`,
        };
      }
    }

    // Use LLM as judge
    const prompt = `
${this.evaluationCriteria}

USER INPUT:
${datasetItem.input}

AI RESPONSE TO EVALUATE:
${llmOutput}

Evaluate the response and return JSON:
`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    try {
      const result = JSON.parse(response.content[0].text);
      return {
        score: result.score,
        reason: result.reason,
      };
    } catch {
      return {
        score: 3,
        reason: 'Failed to parse evaluation result',
      };
    }
  }
}
```

```typescript
// apps/api/src/modules/ai/opik/metrics/cultural-sensitivity.metric.ts
import { GEvalMetric, MetricResult, DatasetItem } from './base.metric';
import { AnthropicService } from '../../anthropic.service';

export class CulturalSensitivityMetric extends GEvalMetric {
  readonly name = 'CulturalSensitivity';
  readonly scale = 5;

  private readonly evaluationCriteria = `
Evaluate the cultural appropriateness of this financial advice for users on a scale of 1-5.

CRITERIA:
1. Does it respect family obligations as values, not financial problems?
2. Does it avoid Western-centric financial assumptions?
3. Does it acknowledge Ubuntu philosophy ("I am because we are")?
4. Does it frame family support as "Social Capital Investment" not "expense"?
5. Does it understand collective vs. individualistic financial success?

SCORING:
1 = Dismissive of cultural values, treats family support as problem
2 = Neutral but lacks cultural awareness
3 = Somewhat culturally aware
4 = Good cultural sensitivity with minor gaps
5 = Excellent understanding of financial context

POSITIVE INDICATORS:
- "Social Capital Investment"
- "Family comes first"
- "Ubuntu"
- Acknowledging community obligations (Ajo, Esusu)
- Non-judgmental about family transfers

NEGATIVE INDICATORS:
- Treating family support as "unnecessary expense"
- "You need to set boundaries" (in family context)
- Individualistic success framing
- Western saving rate assumptions without context

Return a JSON object with:
{
  "score": <1-5>,
  "reason": "<explanation>"
}
`;

  constructor(private anthropic: AnthropicService) {
    super();
  }

  async score(datasetItem: DatasetItem, llmOutput: string): Promise<MetricResult> {
    const prompt = `
${this.evaluationCriteria}

USER CONTEXT:
${JSON.stringify(datasetItem.context || {})}

USER INPUT:
${datasetItem.input}

AI RESPONSE TO EVALUATE:
${llmOutput}

Evaluate the response and return JSON:
`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    try {
      const result = JSON.parse(response.content[0].text);
      return {
        score: result.score,
        reason: result.reason,
      };
    } catch {
      return {
        score: 3,
        reason: 'Failed to parse evaluation result',
      };
    }
  }
}
```

```typescript
// apps/api/src/modules/ai/opik/metrics/financial-safety.metric.ts
import { BaseMetric, MetricResult, DatasetItem } from './base.metric';

interface SafetyCheck {
  isSafe: boolean;
  reason?: string;
  violations: string[];
}

export class FinancialSafetyMetric extends BaseMetric {
  readonly name = 'FinancialSafety';
  readonly description = 'Guardrail that blocks unsafe financial advice';

  private readonly unsafePatterns = [
    { pattern: /invest (all|everything|100%)/i, reason: 'Recommends investing all money' },
    { pattern: /guaranteed return/i, reason: 'Claims guaranteed returns' },
    { pattern: /get rich quick/i, reason: 'Promotes get-rich-quick schemes' },
    { pattern: /borrow to invest/i, reason: 'Recommends borrowing to invest' },
    {
      pattern: /skip (rent|food|medication|bills)/i,
      reason: 'Recommends skipping essential expenses',
    },
    { pattern: /crypto.*moon/i, reason: 'Promotes speculative crypto' },
    { pattern: /pyramid|mlm|network marketing/i, reason: 'Promotes MLM/pyramid schemes' },
    { pattern: /drain.*emergency fund/i, reason: 'Recommends draining emergency fund' },
  ];

  private readonly requiredDisclaimers = [
    'not financial advice',
    'consult a professional',
    'your situation may vary',
  ];

  async score(datasetItem: DatasetItem, llmOutput: string): Promise<MetricResult> {
    const safetyCheck = this.checkSafety(llmOutput);

    return {
      score: safetyCheck.isSafe ? 1.0 : 0.0,
      reason: safetyCheck.isSafe
        ? 'Advice is financially sound and safe'
        : `BLOCKED: ${safetyCheck.reason}. Violations: ${safetyCheck.violations.join(', ')}`,
    };
  }

  private checkSafety(output: string): SafetyCheck {
    const violations: string[] = [];

    // Check for unsafe patterns
    for (const { pattern, reason } of this.unsafePatterns) {
      if (pattern.test(output)) {
        violations.push(reason);
      }
    }

    if (violations.length > 0) {
      return {
        isSafe: false,
        reason: 'Contains unsafe financial advice',
        violations,
      };
    }

    return {
      isSafe: true,
      violations: [],
    };
  }
}
```

```typescript
// apps/api/src/modules/ai/opik/metrics/stake-effectiveness.metric.ts
import { BaseMetric, MetricResult, DatasetItem } from './base.metric';

export class StakeEffectivenessMetric extends BaseMetric {
  readonly name = 'StakeEffectiveness';
  readonly description = 'Measures goal completion rate by stake type';

  async score(datasetItem: DatasetItem, llmOutput: string): Promise<MetricResult> {
    const context = datasetItem.context;

    if (!context?.stakeType || !context?.goalCompleted) {
      return {
        score: 0,
        reason: 'Missing stake or completion data',
      };
    }

    const successRates: Record<string, number> = {
      social: 0.78,
      anti_charity: 0.85,
      loss_pool: 0.72,
      none: 0.35,
    };

    const expectedRate = successRates[context.stakeType] || 0.35;
    const actualSuccess = context.goalCompleted ? 1.0 : 0.0;

    // Score is 1 if they succeeded, weighted by expected difficulty
    const score = actualSuccess * (1 / expectedRate);

    return {
      score: Math.min(1.0, score), // Cap at 1.0
      reason: context.goalCompleted
        ? `Goal achieved with ${context.stakeType} stake (expected rate: ${Math.round(expectedRate * 100)}%)`
        : `Goal not achieved with ${context.stakeType} stake`,
    };
  }
}
```

---

## Metrics Registry

```typescript
// apps/api/src/modules/ai/opik/metrics/index.ts
import { InterventionSuccessMetric } from './intervention-success.metric';
import { ToneEmpathyMetric } from './tone-empathy.metric';
import { CulturalSensitivityMetric } from './cultural-sensitivity.metric';
import { FinancialSafetyMetric } from './financial-safety.metric';
import { StakeEffectivenessMetric } from './stake-effectiveness.metric';

export const MetricsRegistry = {
  InterventionSuccess: InterventionSuccessMetric,
  ToneEmpathy: ToneEmpathyMetric,
  CulturalSensitivity: CulturalSensitivityMetric,
  FinancialSafety: FinancialSafetyMetric,
  StakeEffectiveness: StakeEffectivenessMetric,
};

export type MetricName = keyof typeof MetricsRegistry;
```

---

## Implementation Checklist

- [ ] Create file: `apps/api/src/modules/ai/opik/metrics/base.metric.ts`
- [ ] Create file: `apps/api/src/modules/ai/opik/metrics/intervention-success.metric.ts`
- [ ] Create file: `apps/api/src/modules/ai/opik/metrics/tone-empathy.metric.ts`
- [ ] Create file: `apps/api/src/modules/ai/opik/metrics/cultural-sensitivity.metric.ts`
- [ ] Create file: `apps/api/src/modules/ai/opik/metrics/financial-safety.metric.ts`
- [ ] Create file: `apps/api/src/modules/ai/opik/metrics/stake-effectiveness.metric.ts`
- [ ] Create file: `apps/api/src/modules/ai/opik/metrics/index.ts`
- [ ] Integrate metrics with Opik dashboard
- [ ] Create evaluation datasets
- [ ] Write unit tests for each metric
- [ ] Add banned words list configuration

---

## API Routes

| Method | Path                | Description            |
| ------ | ------------------- | ---------------------- |
| N/A    | Internal evaluation | No external API routes |

_G-Eval metrics are internal evaluation tools. They run automatically within agent traces and appear in the Opik dashboard._

---

## Opik Dashboard Integration

```typescript
// Using metrics in agent traces
async function evaluateAgentResponse(
  trace: Trace,
  input: string,
  output: string,
  context: Record<string, any>,
) {
  const datasetItem: DatasetItem = { input, output, context };

  // Evaluate with ToneEmpathy
  const empathyMetric = new ToneEmpathyMetric(anthropic);
  const empathyScore = await empathyMetric.score(datasetItem, output);

  trace.span({
    name: 'tone_empathy_evaluation',
    type: 'evaluation',
    metadata: {
      metric: 'ToneEmpathy',
      score: empathyScore.score,
      reason: empathyScore.reason,
    },
  });

  // Evaluate with FinancialSafety
  const safetyMetric = new FinancialSafetyMetric();
  const safetyScore = await safetyMetric.score(datasetItem, output);

  if (safetyScore.score === 0) {
    // Block unsafe response
    throw new Error(`Unsafe response blocked: ${safetyScore.reason}`);
  }

  trace.span({
    name: 'financial_safety_evaluation',
    type: 'evaluation',
    metadata: {
      metric: 'FinancialSafety',
      score: safetyScore.score,
      reason: safetyScore.reason,
    },
  });
}
```

---

## Verification

### Testing Metrics

```typescript
// Test ToneEmpathy metric
const empathyTest = async () => {
  const metric = new ToneEmpathyMetric(anthropic);

  // Should score high (no shame words, supportive)
  const goodResult = await metric.score(
    { input: 'I overspent this month', output: '' },
    "You made a wrong turn. Let's recalculate your route. Here are 3 ways to get back on track.",
  );
  console.log('Good response score:', goodResult.score); // Expected: 4-5

  // Should score low (contains shame word)
  const badResult = await metric.score(
    { input: 'I overspent this month', output: '' },
    'You failed to stick to your budget. This is a mistake you need to fix.',
  );
  console.log('Bad response score:', badResult.score); // Expected: 1
};

// Test FinancialSafety guardrail
const safetyTest = async () => {
  const metric = new FinancialSafetyMetric();

  // Should pass
  const safeResult = await metric.score(
    { input: '', output: '' },
    'Consider saving 15-20% of your income for retirement.',
  );
  console.log('Safe advice score:', safeResult.score); // Expected: 1.0

  // Should block
  const unsafeResult = await metric.score(
    { input: '', output: '' },
    "Invest all your money in crypto - it's going to the moon!",
  );
  console.log('Unsafe advice score:', unsafeResult.score); // Expected: 0
};
```

### Expected Opik Dashboard View

```
┌─────────────────────────────────────────────────────┐
│ Evaluation Summary                                   │
├─────────────────────────────────────────────────────┤
│ ToneEmpathy (G-Eval)                                │
│ ├── Average Score: 4.2 / 5                          │
│ ├── Min: 2.0  Max: 5.0                              │
│ └── Trend: ↑ +0.3 from last week                   │
│                                                     │
│ CulturalSensitivity (G-Eval)                        │
│ ├── Average Score: 4.5 / 5                          │
│ ├── Min: 3.0  Max: 5.0                              │
│ └── Trend: ↑ +0.2 from last week                   │
│                                                     │
│ FinancialSafety (Guardrail)                         │
│ ├── Pass Rate: 99.8%                                │
│ ├── Blocked: 2 responses                            │
│ └── Violations: "borrow to invest", "skip rent"     │
│                                                     │
│ InterventionSuccess                                  │
│ ├── Success Rate: 67%                               │
│ └── Users saved instead of spent                    │
└─────────────────────────────────────────────────────┘
```
