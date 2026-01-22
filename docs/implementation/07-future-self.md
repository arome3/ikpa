# Future Self Simulator

**Week:** 3 | **Tier:** 1 | **Depends On:** [03-simulation-engine](./03-simulation-engine.md)

---

## Overview

The Future Self Simulator bridges the gap between present and future self through personalized "Letters from 2045" and dual-path visualizations. Based on MIT Media Lab research showing users who interact with AI-generated future selves are **16% more likely to save**.

**Failure Mode Defeated:** Temporal Disconnect

**Why It Matters:**
- fMRI studies show future self activates "stranger" brain regions
- 16% increase in savings after future self interaction (MIT)
- Dual-path visualizations increase commitment by 23%
- Numbers don't motivate; narratives do

---

## Technical Spec

### Trigger Mechanism

- User requests future self conversation
- Weekly scheduled "letter from the future"
- After major financial decision

### Interfaces

```typescript
interface FutureSimulation {
  currentBehavior: {
    savingsRate: number;
    projectedNetWorth: Record<string, number>;
  };
  withIKPA: {
    savingsRate: number;
    projectedNetWorth: Record<string, number>;
  };
  difference_20yr: number;
}

interface TimeSlider {
  positions: string[];
  currentPosition: string;
  showDualPaths: boolean;
  animateTransition: boolean;
}

interface LetterFromFuture {
  content: string;
  generatedAt: Date;
  simulationData: FutureSimulation;
  userAge: number;
  futureAge: number;
}
```

### Core Logic

```typescript
// FUTURE SELF SIMULATOR: Bridge the temporal gap

// Step 1: Dual-Path Monte Carlo Simulation
const simulation = {
  currentBehavior: {
    savingsRate: 0.08,
    projectedNetWorth: {
      '1_year': 450000,
      '5_years': 2100000,
      '10_years': 4800000,
      '20_years': 12000000
    }
  },
  withIKPA: {
    savingsRate: 0.18,
    projectedNetWorth: {
      '1_year': 520000,
      '5_years': 3200000,
      '10_years': 8500000,
      '20_years': 28000000
    }
  },
  difference_20yr: 16000000 // ₦16M difference
};

// Step 2: Generate "Letter from 2045"
const letterPrompt = `
You are writing as the user's 60-year-old future self.
Current user data: ${JSON.stringify(userData)}
Simulation results: ${JSON.stringify(simulation)}

Write a heartfelt, personal letter from their 60-year-old self.
Include specific details from their current goals and situation.
If they're on track: celebrate and encourage.
If they're struggling: empathize and provide hope.

IMPORTANT: Make it feel REAL. Reference their specific goals,
their city, their dreams. This should feel like a letter from
a future that actually knows them.
`;

// Step 3: Time Slider Visualization
const timeSlider = {
  positions: ['6mo', '1yr', '5yr', '10yr', '20yr'],
  currentPosition: '10yr',
  showDualPaths: true,
  animateTransition: true
};
```

### Example Letter Output

```typescript
const letterFrom2045 = `
Dear Aisha,

I'm writing this from the balcony of our flat in Victoria Island.
Yes, OUR flat—we own it now, mortgage-free.

I know right now you're wondering if the sacrifices are worth it.
You're 28, everyone's going to Dubai, and you're cooking at home
to hit your savings target. I remember that feeling.

Here's what I can tell you from 60:
That ₦20,000 you saved instead of buying those shoes in January 2026?
It became ₦180,000 by the time I'm writing this.

But it's not just about the money. It's about who you become.
The discipline you're building right now? It compounds too.

Keep going. I'm proof it works.

With love from your future,
Aisha (Age 60)
`;
```

### Full Implementation

```typescript
// apps/api/src/modules/ai/agents/future-self.agent.ts
import { Injectable } from '@nestjs/common';
import { OpikService } from '../opik/opik.service';
import { SimulationEngine } from '../../finance/calculators/simulation-engine';
import { AnthropicService } from '../anthropic.service';

interface UserContext {
  name: string;
  age: number;
  city: string;
  goals: Array<{ name: string; amount: number; deadline: Date }>;
  currentSavingsRate: number;
  monthlyIncome: number;
  currentNetWorth: number;
  recentDecisions?: string[];
  struggles?: string[];
}

@Injectable()
export class FutureSelfAgent {
  private readonly FUTURE_AGE = 60;
  private readonly TIME_HORIZONS = ['6mo', '1yr', '5yr', '10yr', '20yr'];

  constructor(
    private opikService: OpikService,
    private simulationEngine: SimulationEngine,
    private anthropic: AnthropicService,
  ) {}

  async generateSimulation(userId: string): Promise<FutureSimulation> {
    const trace = this.opikService.createTrace('future_self_simulation', { userId });

    const userData = await this.getUserData(userId);
    const simulation = await this.simulationEngine.runDualPathSimulation({
      currentSavingsRate: userData.currentSavingsRate,
      monthlyIncome: userData.monthlyIncome,
      currentNetWorth: userData.currentNetWorth,
      goalAmount: userData.goals[0]?.amount || 2000000,
      goalDeadline: userData.goals[0]?.deadline || new Date('2026-12-31'),
      expectedReturnRate: 0.07,
      inflationRate: 0.05,
    });

    const result: FutureSimulation = {
      currentBehavior: {
        savingsRate: userData.currentSavingsRate,
        projectedNetWorth: simulation.currentPath.projectedNetWorth,
      },
      withIKPA: {
        savingsRate: simulation.optimizedPath.requiredSavingsRate,
        projectedNetWorth: simulation.optimizedPath.projectedNetWorth,
      },
      difference_20yr: simulation.wealthDifference['20yr'],
    };

    trace.end({ output: result });
    await this.opikService.flush();

    return result;
  }

  async generateLetter(userId: string): Promise<LetterFromFuture> {
    const trace = this.opikService.createTrace('future_self_letter', { userId }, { agent: 'future_self', version: '1.0' });

    // Span 1: Get user context
    const contextSpan = trace.span({ name: 'get_user_context', type: 'tool' });
    const userContext = await this.getUserContext(userId);
    contextSpan.end({ output: { hasContext: true } });

    // Span 2: Run simulation
    const simSpan = trace.span({ name: 'run_simulation', type: 'tool' });
    const simulation = await this.generateSimulation(userId);
    simSpan.end({ output: { difference20yr: simulation.difference_20yr } });

    // Span 3: Generate letter with LLM
    const llmSpan = trace.span({ name: 'generate_letter', type: 'llm' });
    const letterContent = await this.generateLetterContent(userContext, simulation);
    llmSpan.end({ output: { letterLength: letterContent.length } });

    const result: LetterFromFuture = {
      content: letterContent,
      generatedAt: new Date(),
      simulationData: simulation,
      userAge: userContext.age,
      futureAge: this.FUTURE_AGE,
    };

    trace.end({ output: { success: true } });
    await this.opikService.flush();

    return result;
  }

  private async generateLetterContent(context: UserContext, simulation: FutureSimulation): Promise<string> {
    const prompt = this.buildLetterPrompt(context, simulation);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].text;
  }

  private buildLetterPrompt(context: UserContext, simulation: FutureSimulation): string {
    const futureYear = new Date().getFullYear() + (this.FUTURE_AGE - context.age);
    const isOnTrack = context.currentSavingsRate >= 0.15;

    return `You are writing as ${context.name}'s ${this.FUTURE_AGE}-year-old future self in the year ${futureYear}.

CURRENT USER DATA:
- Name: ${context.name}
- Current Age: ${context.age}
- City: ${context.city}
- Current Savings Rate: ${Math.round(context.currentSavingsRate * 100)}%
- Monthly Income: ₦${context.monthlyIncome.toLocaleString()}
- Current Net Worth: ₦${context.currentNetWorth.toLocaleString()}
- Primary Goal: ${context.goals[0]?.name || 'Financial Freedom'}

SIMULATION RESULTS:
- Current Path Net Worth (20 years): ₦${simulation.currentBehavior.projectedNetWorth['20yr'].toLocaleString()}
- Optimized Path Net Worth (20 years): ₦${simulation.withIKPA.projectedNetWorth['20yr'].toLocaleString()}
- Difference: ₦${simulation.difference_20yr.toLocaleString()}

${context.struggles?.length ? `RECENT STRUGGLES: ${context.struggles.join(', ')}` : ''}
${context.recentDecisions?.length ? `RECENT DECISIONS: ${context.recentDecisions.join(', ')}` : ''}

INSTRUCTIONS:
Write a heartfelt, personal letter from their ${this.FUTURE_AGE}-year-old self.

${isOnTrack ? 'They are ON TRACK - celebrate their progress and encourage them to keep going.' : 'They are STRUGGLING - empathize with their challenges and provide hope.'}

REQUIREMENTS:
1. Start with "Dear ${context.name},"
2. Reference their specific city (${context.city})
3. Reference their specific goal (${context.goals[0]?.name || 'financial freedom'})
4. Include ONE specific financial number from the simulation
5. Make it feel like a letter from someone who KNOWS them
6. End with warmth and hope
7. Sign as "${context.name} (Age ${this.FUTURE_AGE})"

AVOID:
- Generic advice
- Lecturing tone
- Shame or judgment
- Overly formal language

Write the letter now:`;
  }

  async getTimeline(userId: string, years: number): Promise<TimelineProjection> {
    const simulation = await this.generateSimulation(userId);

    const horizonKey = this.getHorizonKey(years);

    return {
      currentPath: simulation.currentBehavior.projectedNetWorth[horizonKey],
      optimizedPath: simulation.withIKPA.projectedNetWorth[horizonKey],
      difference: simulation.withIKPA.projectedNetWorth[horizonKey] - simulation.currentBehavior.projectedNetWorth[horizonKey],
      years,
    };
  }

  private getHorizonKey(years: number): string {
    if (years <= 0.5) return '6mo';
    if (years <= 1) return '1yr';
    if (years <= 5) return '5yr';
    if (years <= 10) return '10yr';
    return '20yr';
  }

  private async getUserData(userId: string): Promise<any> {
    // Fetch from database
    return {};
  }

  private async getUserContext(userId: string): Promise<UserContext> {
    // Fetch full context from database
    return {
      name: 'Aisha',
      age: 28,
      city: 'Lagos',
      goals: [{ name: 'House Down Payment', amount: 2000000, deadline: new Date('2026-12-31') }],
      currentSavingsRate: 0.12,
      monthlyIncome: 400000,
      currentNetWorth: 500000,
    };
  }
}
```

---

## Visualization Features

- **Time Slider**: Drag between 6mo → 1yr → 5yr → 10yr → 20yr
- **Dual Path View**: Side-by-side comparison of "Current Path" vs "IKPA Path"
- **Animation**: Smooth transitions showing wealth divergence over time
- **Milestone Markers**: Show when major goals become achievable

```typescript
// Frontend Time Slider Component Spec
interface TimeSliderProps {
  positions: string[];
  currentPosition: string;
  currentPathData: Record<string, number>;
  optimizedPathData: Record<string, number>;
  onPositionChange: (position: string) => void;
}

// Animation: Wealth lines animate as slider moves
// Visual: Green line (optimized) above orange line (current)
// Markers: Goal achievement dates highlighted
```

---

## Implementation Checklist

- [ ] Create file: `apps/api/src/modules/ai/agents/future-self.agent.ts`
- [ ] Create file: `apps/api/src/modules/ai/prompts/future-self.prompt.ts`
- [ ] Integrate with Simulation Engine
- [ ] Build letter generation with Claude
- [ ] Add user context enrichment
- [ ] Create timeline endpoint
- [ ] Add Opik tracing with ToneEmpathy metric
- [ ] Write unit tests
- [ ] Add Swagger documentation

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/future-self/simulation` | Get dual-path projection |
| GET | `/v1/future-self/letter` | Get letter from 2045 |
| GET | `/v1/future-self/timeline/:years` | Get projection at specific year |

---

## Opik Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `LetterEngagement` | Duration | Time spent reading letter |
| `PostLetterSavingsChange` | Percentage | Savings rate change within 7 days |
| `ToneEmpathy` | G-Eval (1-5) | Emotional resonance score |
| `TimeSliderInteraction` | Count | Number of slider position changes |

---

## Verification

### curl Commands

```bash
# Get dual-path simulation
curl -X GET http://localhost:3000/v1/future-self/simulation \
  -H "Authorization: Bearer $TOKEN"

# Get letter from 2045
curl -X GET http://localhost:3000/v1/future-self/letter \
  -H "Authorization: Bearer $TOKEN"

# Get projection at 10 years
curl -X GET http://localhost:3000/v1/future-self/timeline/10 \
  -H "Authorization: Bearer $TOKEN"
```

### Expected Response (GET /v1/future-self/letter)

```json
{
  "content": "Dear Aisha,\n\nI'm writing this from the balcony of our flat in Victoria Island.\nYes, OUR flat—we own it now, mortgage-free.\n\nI know right now you're wondering if the sacrifices are worth it.\nYou're 28, everyone's going to Dubai, and you're cooking at home\nto hit your savings target. I remember that feeling.\n\nHere's what I can tell you from 60:\nThat ₦20,000 you saved instead of buying those shoes in January 2026?\nIt became ₦180,000 by the time I'm writing this.\n\nBut it's not just about the money. It's about who you become.\nThe discipline you're building right now? It compounds too.\n\nKeep going. I'm proof it works.\n\nWith love from your future,\nAisha (Age 60)",
  "generatedAt": "2026-01-16T10:00:00.000Z",
  "simulationData": {
    "currentBehavior": {
      "savingsRate": 0.12,
      "projectedNetWorth": {
        "6mo": 550000,
        "1yr": 620000,
        "5yr": 2100000,
        "10yr": 4800000,
        "20yr": 12000000
      }
    },
    "withIKPA": {
      "savingsRate": 0.18,
      "projectedNetWorth": {
        "6mo": 580000,
        "1yr": 700000,
        "5yr": 3200000,
        "10yr": 8500000,
        "20yr": 28000000
      }
    },
    "difference_20yr": 16000000
  },
  "userAge": 28,
  "futureAge": 60
}
```

### Expected Response (GET /v1/future-self/timeline/10)

```json
{
  "currentPath": 4800000,
  "optimizedPath": 8500000,
  "difference": 3700000,
  "years": 10
}
```
