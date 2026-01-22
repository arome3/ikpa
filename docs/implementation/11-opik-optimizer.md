# Opik Optimizer

**Week:** 2-3 | **Tier:** 2-3 | **Depends On:** [09-g-eval-metrics](./09-g-eval-metrics.md)

---

## Overview

The Opik Optimizer uses three advanced optimization techniques to **evolve** IKPA's prompts over time:
1. **MetaPromptOptimizer** - A/B test Shark Auditor framing
2. **EvolutionaryOptimizer** - Evolve Future Self letter prompts
3. **GEPA** - Optimize GPS Re-Router tool selection

This is the **winning edge** for the "Best Use of Opik" prize—most teams use observability for logging, we use it for evolution.

**Why It Matters:**
- Prompts automatically improve based on user behavior data
- A/B testing reveals what messaging works best
- Evolutionary optimization finds better emotional resonance
- GEPA learns optimal tool selection for user profiles

---

## Technical Spec

### 1. MetaPromptOptimizer: A/B Test Shark Auditor Framing

```typescript
import { MetaPromptOptimizer } from 'opik-optimizer';

// Test: Annual framing vs Monthly framing
const framingExperiment = {
  baseline: `You found a subscription: {{subscription_name}} at {{monthly_cost}}/month.
    Do you want to keep it or cancel it?`,

  variant: `You found a subscription: {{subscription_name}}.
    Monthly: {{monthly_cost}}
    Annual: {{annual_cost}} (that's {{percentage_of_rent}}% of your rent)
    Over 5 years: {{five_year_cost}}
    Do you want to keep it or cancel it?`
};

const optimizer = new MetaPromptOptimizer({
  model: 'claude-sonnet-4-20250514',
  reasoningModel: 'gpt-4-turbo'
});

const result = await optimizer.optimizePrompt({
  prompt: framingExperiment.baseline,
  dataset: subscriptionDecisionDataset,
  metric: new CancellationRate(),
  nSamples: 100,
  maxRounds: 10
});

// Expected: Annual framing increases cancellation rate by 40%
```

### 2. EvolutionaryOptimizer: Evolve Future Self Letter Prompts

```typescript
import { EvolutionaryOptimizer } from 'opik-optimizer';

const letterOptimizer = new EvolutionaryOptimizer({
  model: 'claude-sonnet-4-20250514',
  populationSize: 10,
  generations: 5
});

const evolvedPrompt = await letterOptimizer.evolve({
  basePrompt: futureSelLetterBasePrompt,
  dataset: letterEngagementDataset,
  metrics: [new ToneEmpathy(), new PostLetterSavingsChange()],
  survivalRate: 0.3
});

// Tracks prompt evolution across generations
// Shows which phrasings increase emotional resonance
```

### 3. GEPA: Optimize GPS Re-Router Tool Selection

```typescript
import { GEPA } from 'opik-optimizer';

const routerOptimizer = new GEPA({
  model: 'claude-sonnet-4-20250514',
  tools: [
    { name: 'time_adjustment', description: 'Extend goal deadline' },
    { name: 'rate_adjustment', description: 'Increase savings rate' },
    { name: 'freeze_protocol', description: 'Pause category spending' }
  ]
});

const optimizedToolSelection = await routerOptimizer.optimize({
  dataset: recoveryPathDataset,
  metric: new GoalSurvivalRate(),
  maxIterations: 20
});

// Learns which recovery path works best for different user profiles
// E.g., "Users with high income stability prefer rate_adjustment"
```

### Full Implementation

```typescript
// apps/api/src/modules/ai/opik/optimizer/framing-optimizer.ts
import { Injectable } from '@nestjs/common';
import { OpikService } from '../opik.service';
import { ConfigService } from '@nestjs/config';

interface ExperimentResult {
  baseline: {
    prompt: string;
    score: number;
    sampleSize: number;
  };
  variant: {
    prompt: string;
    score: number;
    sampleSize: number;
  };
  winner: 'baseline' | 'variant';
  improvement: number;
  confidence: number;
}

@Injectable()
export class FramingOptimizer {
  constructor(
    private opikService: OpikService,
    private configService: ConfigService,
  ) {}

  async runFramingExperiment(
    baselinePrompt: string,
    variantPrompt: string,
    datasetName: string,
    metricName: string
  ): Promise<ExperimentResult> {
    const trace = this.opikService.createTrace('framing_experiment', {
      datasetName,
      metricName,
    });

    // Span 1: Run baseline
    const baselineSpan = trace.span({ name: 'baseline_evaluation', type: 'tool' });
    const baselineResults = await this.evaluatePrompt(baselinePrompt, datasetName, metricName);
    baselineSpan.end({ output: { score: baselineResults.score } });

    // Span 2: Run variant
    const variantSpan = trace.span({ name: 'variant_evaluation', type: 'tool' });
    const variantResults = await this.evaluatePrompt(variantPrompt, datasetName, metricName);
    variantSpan.end({ output: { score: variantResults.score } });

    // Span 3: Statistical analysis
    const analysisSpan = trace.span({ name: 'statistical_analysis', type: 'tool' });
    const analysis = this.analyzeResults(baselineResults, variantResults);
    analysisSpan.end({ output: analysis });

    const result: ExperimentResult = {
      baseline: {
        prompt: baselinePrompt,
        score: baselineResults.score,
        sampleSize: baselineResults.sampleSize,
      },
      variant: {
        prompt: variantPrompt,
        score: variantResults.score,
        sampleSize: variantResults.sampleSize,
      },
      winner: analysis.winner,
      improvement: analysis.improvement,
      confidence: analysis.confidence,
    };

    trace.end({ output: result });
    await this.opikService.flush();

    return result;
  }

  private async evaluatePrompt(
    prompt: string,
    datasetName: string,
    metricName: string
  ): Promise<{ score: number; sampleSize: number }> {
    // In production: Use Opik SDK to run evaluation
    // For now: Return mock results
    return {
      score: Math.random() * 0.5 + 0.5, // 0.5-1.0
      sampleSize: 100,
    };
  }

  private analyzeResults(
    baseline: { score: number; sampleSize: number },
    variant: { score: number; sampleSize: number }
  ): { winner: 'baseline' | 'variant'; improvement: number; confidence: number } {
    const improvement = ((variant.score - baseline.score) / baseline.score) * 100;
    const winner = variant.score > baseline.score ? 'variant' : 'baseline';

    // Simplified confidence calculation
    const pooledVariance = 0.1; // Placeholder
    const zScore = Math.abs(variant.score - baseline.score) / Math.sqrt(pooledVariance);
    const confidence = Math.min(0.99, 0.5 + zScore * 0.15);

    return { winner, improvement, confidence };
  }
}
```

```typescript
// apps/api/src/modules/ai/opik/optimizer/letter-optimizer.ts
import { Injectable } from '@nestjs/common';
import { OpikService } from '../opik.service';
import { AnthropicService } from '../../anthropic.service';
import { ToneEmpathyMetric } from '../metrics/tone-empathy.metric';

interface PromptGeneration {
  prompt: string;
  fitness: number;
  generation: number;
}

@Injectable()
export class LetterOptimizer {
  private readonly POPULATION_SIZE = 10;
  private readonly GENERATIONS = 5;
  private readonly SURVIVAL_RATE = 0.3;

  constructor(
    private opikService: OpikService,
    private anthropic: AnthropicService,
    private toneEmpathyMetric: ToneEmpathyMetric,
  ) {}

  async evolveLetterPrompt(
    basePrompt: string,
    evaluationDataset: DatasetItem[]
  ): Promise<PromptGeneration[]> {
    const trace = this.opikService.createTrace('evolutionary_optimization', {
      populationSize: this.POPULATION_SIZE,
      generations: this.GENERATIONS,
    });

    const evolutionHistory: PromptGeneration[] = [];

    // Initialize population
    let population = await this.initializePopulation(basePrompt);

    for (let gen = 0; gen < this.GENERATIONS; gen++) {
      const genSpan = trace.span({ name: `generation_${gen}`, type: 'tool' });

      // Evaluate fitness
      const evaluated = await this.evaluatePopulation(population, evaluationDataset);

      // Record best of generation
      const best = evaluated.reduce((a, b) => a.fitness > b.fitness ? a : b);
      evolutionHistory.push({ ...best, generation: gen });

      // Select survivors
      const survivors = this.selectSurvivors(evaluated);

      // Generate next generation
      population = await this.crossoverAndMutate(survivors);

      genSpan.end({ output: { bestFitness: best.fitness, survivors: survivors.length } });
    }

    // Final evaluation
    const finalEvaluated = await this.evaluatePopulation(population, evaluationDataset);
    const winner = finalEvaluated.reduce((a, b) => a.fitness > b.fitness ? a : b);
    evolutionHistory.push({ ...winner, generation: this.GENERATIONS });

    trace.end({ output: { finalFitness: winner.fitness, generations: evolutionHistory.length } });
    await this.opikService.flush();

    return evolutionHistory;
  }

  private async initializePopulation(basePrompt: string): Promise<string[]> {
    const population = [basePrompt];

    // Generate variants using LLM
    for (let i = 1; i < this.POPULATION_SIZE; i++) {
      const variant = await this.generateVariant(basePrompt, i);
      population.push(variant);
    }

    return population;
  }

  private async generateVariant(basePrompt: string, seed: number): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Generate a variation of this prompt for writing future self letters.
Keep the core structure but vary the tone, phrasing, or emotional hooks.
Variation seed: ${seed}

Original prompt:
${basePrompt}

Generate a variation that might produce more emotionally resonant letters:`
      }],
    });

    return response.content[0].text;
  }

  private async evaluatePopulation(
    population: string[],
    dataset: DatasetItem[]
  ): Promise<Array<{ prompt: string; fitness: number }>> {
    const evaluated = [];

    for (const prompt of population) {
      let totalScore = 0;
      const sampleSize = Math.min(10, dataset.length);

      for (let i = 0; i < sampleSize; i++) {
        // Generate letter with this prompt
        const letter = await this.generateLetterWithPrompt(prompt, dataset[i]);

        // Evaluate with ToneEmpathy metric
        const score = await this.toneEmpathyMetric.score(dataset[i], letter);
        totalScore += score.score;
      }

      evaluated.push({
        prompt,
        fitness: totalScore / sampleSize,
      });
    }

    return evaluated;
  }

  private async generateLetterWithPrompt(prompt: string, datasetItem: DatasetItem): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt.replace('{{userData}}', JSON.stringify(datasetItem.context)),
      }],
    });

    return response.content[0].text;
  }

  private selectSurvivors(evaluated: Array<{ prompt: string; fitness: number }>): string[] {
    // Sort by fitness descending
    const sorted = [...evaluated].sort((a, b) => b.fitness - a.fitness);

    // Select top performers
    const numSurvivors = Math.ceil(evaluated.length * this.SURVIVAL_RATE);
    return sorted.slice(0, numSurvivors).map(e => e.prompt);
  }

  private async crossoverAndMutate(survivors: string[]): Promise<string[]> {
    const nextGen: string[] = [...survivors]; // Elitism: keep survivors

    while (nextGen.length < this.POPULATION_SIZE) {
      // Select two parents
      const parent1 = survivors[Math.floor(Math.random() * survivors.length)];
      const parent2 = survivors[Math.floor(Math.random() * survivors.length)];

      // Crossover + mutate
      const child = await this.crossover(parent1, parent2);
      nextGen.push(child);
    }

    return nextGen;
  }

  private async crossover(parent1: string, parent2: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Combine the best elements of these two prompts into a new prompt.
Add small creative mutations to potentially improve emotional resonance.

Parent 1:
${parent1}

Parent 2:
${parent2}

Generate a child prompt that combines their strengths:`
      }],
    });

    return response.content[0].text;
  }
}
```

```typescript
// apps/api/src/modules/ai/opik/optimizer/tool-optimizer.ts (GEPA)
import { Injectable } from '@nestjs/common';
import { OpikService } from '../opik.service';

interface ToolSelection {
  tool: string;
  userProfile: Record<string, any>;
  success: boolean;
}

interface OptimizedToolPolicy {
  rules: Array<{
    condition: string;
    recommendedTool: string;
    confidence: number;
  }>;
}

@Injectable()
export class ToolOptimizer {
  private readonly tools = [
    { name: 'time_adjustment', description: 'Extend goal deadline' },
    { name: 'rate_adjustment', description: 'Increase savings rate' },
    { name: 'freeze_protocol', description: 'Pause category spending' },
  ];

  constructor(private opikService: OpikService) {}

  async optimizeToolSelection(
    historicalData: ToolSelection[]
  ): Promise<OptimizedToolPolicy> {
    const trace = this.opikService.createTrace('gepa_optimization', {
      dataPoints: historicalData.length,
    });

    // Analyze patterns
    const patterns = this.analyzePatterns(historicalData);

    // Generate rules
    const rules = this.generateRules(patterns);

    const policy: OptimizedToolPolicy = { rules };

    trace.end({ output: { rulesGenerated: rules.length } });
    await this.opikService.flush();

    return policy;
  }

  private analyzePatterns(data: ToolSelection[]): Map<string, ToolSuccessRate> {
    const patterns = new Map<string, ToolSuccessRate>();

    for (const selection of data) {
      const profileKey = this.generateProfileKey(selection.userProfile);

      if (!patterns.has(profileKey)) {
        patterns.set(profileKey, {
          time_adjustment: { success: 0, total: 0 },
          rate_adjustment: { success: 0, total: 0 },
          freeze_protocol: { success: 0, total: 0 },
        });
      }

      const toolStats = patterns.get(profileKey)![selection.tool];
      toolStats.total++;
      if (selection.success) toolStats.success++;
    }

    return patterns;
  }

  private generateProfileKey(profile: Record<string, any>): string {
    // Segment by key characteristics
    const incomeStability = profile.incomeStability > 0.8 ? 'stable' : 'variable';
    const savingsRate = profile.savingsRate > 0.15 ? 'high_saver' : 'low_saver';
    const dependencyRatio = profile.dependencyRatio > 0.25 ? 'high_dependency' : 'low_dependency';

    return `${incomeStability}_${savingsRate}_${dependencyRatio}`;
  }

  private generateRules(patterns: Map<string, ToolSuccessRate>): OptimizedToolPolicy['rules'] {
    const rules: OptimizedToolPolicy['rules'] = [];

    for (const [profileKey, toolStats] of patterns) {
      // Find best tool for this profile
      let bestTool = '';
      let bestRate = 0;

      for (const [tool, stats] of Object.entries(toolStats)) {
        if (stats.total > 0) {
          const rate = stats.success / stats.total;
          if (rate > bestRate) {
            bestRate = rate;
            bestTool = tool;
          }
        }
      }

      if (bestTool) {
        rules.push({
          condition: profileKey,
          recommendedTool: bestTool,
          confidence: bestRate,
        });
      }
    }

    return rules.sort((a, b) => b.confidence - a.confidence);
  }

  async recommendTool(userProfile: Record<string, any>, policy: OptimizedToolPolicy): Promise<string> {
    const profileKey = this.generateProfileKey(userProfile);

    const matchingRule = policy.rules.find(r => r.condition === profileKey);

    if (matchingRule && matchingRule.confidence > 0.6) {
      return matchingRule.recommendedTool;
    }

    // Default to time_adjustment (lowest effort)
    return 'time_adjustment';
  }
}

interface ToolSuccessRate {
  [tool: string]: { success: number; total: number };
}
```

---

## Opik Dashboard Must-Haves for Demo

1. **Tracing View**: Complete cognitive chain with token counts
2. **G-Eval Scores**: Real-time ToneEmpathy and CulturalSensitivity
3. **Experiment Comparison**: Annual vs Monthly framing A/B results
4. **Learning Curve**: Show prompt evolution over development period
5. **Cost Analysis**: Token usage optimization insights

```
┌─────────────────────────────────────────────────────┐
│ Opik Dashboard - IKPA Financial Coach               │
├─────────────────────────────────────────────────────┤
│                                                     │
│ EXPERIMENT: Shark Auditor Framing                   │
│ ┌─────────────────┬─────────────────┐              │
│ │ Monthly Only    │ Annualized      │              │
│ │ Cancellation:   │ Cancellation:   │              │
│ │ 34%             │ 49% (+43%)      │              │
│ │ n=100           │ n=100           │              │
│ │ p<0.01          │ WINNER ★        │              │
│ └─────────────────┴─────────────────┘              │
│                                                     │
│ EVOLUTION: Future Self Letters                      │
│ ToneEmpathy Score by Generation:                    │
│ Gen 0: 3.2 ───┐                                    │
│ Gen 1: 3.5 ───┼─> Improving                        │
│ Gen 2: 3.8 ───┤                                    │
│ Gen 3: 4.1 ───┤                                    │
│ Gen 4: 4.4 ───┤                                    │
│ Gen 5: 4.6 ───┘  (+44% improvement)                │
│                                                     │
│ GEPA: Recovery Path Optimization                    │
│ User Profile → Best Tool:                           │
│ • stable_high_saver → rate_adjustment (87%)         │
│ • variable_low_saver → time_adjustment (72%)        │
│ • high_dependency → time_adjustment (68%)           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

- [ ] Create file: `apps/api/src/modules/ai/opik/optimizer/framing-optimizer.ts`
- [ ] Create file: `apps/api/src/modules/ai/opik/optimizer/letter-optimizer.ts`
- [ ] Create file: `apps/api/src/modules/ai/opik/optimizer/tool-optimizer.ts`
- [ ] Create evaluation datasets for each optimizer
- [ ] Integrate with Opik SDK experiment tracking
- [ ] Set up A/B test infrastructure
- [ ] Build evolutionary optimization loop
- [ ] Implement GEPA tool selection learning
- [ ] Create dashboard visualizations
- [ ] Add scheduled optimization jobs
- [ ] Write unit tests
- [ ] Document optimization results

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| N/A | Background optimization | No external API routes |

*Optimizers run as background jobs and their results are viewed in the Opik dashboard.*

---

## Opik Metrics (Meta-Level)

| Metric | Type | Description |
|--------|------|-------------|
| `ExperimentWinner` | Categorical | Which variant won A/B test |
| `ImprovementPercentage` | Percentage | Performance gain from optimization |
| `GenerationFitness` | Time series | Fitness score per generation |
| `ToolPolicyAccuracy` | Percentage | Correct tool recommendations |

---

## Verification

### Running Framing Experiment

```typescript
// Test the framing optimizer
const optimizer = new FramingOptimizer(opikService, configService);

const result = await optimizer.runFramingExperiment(
  // Baseline: Monthly only
  'You found {{subscription_name}} at {{monthly_cost}}/month. Keep or cancel?',
  // Variant: Annualized framing
  'You found {{subscription_name}}. Monthly: {{monthly_cost}}. Annual: {{annual_cost}}. Keep or cancel?',
  'subscription_decisions',
  'CancellationRate'
);

console.log('Winner:', result.winner);
console.log('Improvement:', result.improvement.toFixed(1) + '%');
console.log('Confidence:', result.confidence.toFixed(2));

// Expected output:
// Winner: variant
// Improvement: 43.2%
// Confidence: 0.95
```

### Running Letter Evolution

```typescript
// Test the letter optimizer
const optimizer = new LetterOptimizer(opikService, anthropic, toneEmpathyMetric);

const history = await optimizer.evolveLetterPrompt(
  futureSelLetterBasePrompt,
  letterEngagementDataset
);

console.log('Evolution history:');
for (const gen of history) {
  console.log(`Gen ${gen.generation}: Fitness ${gen.fitness.toFixed(2)}`);
}

// Expected output:
// Gen 0: Fitness 3.20
// Gen 1: Fitness 3.54
// Gen 2: Fitness 3.81
// Gen 3: Fitness 4.12
// Gen 4: Fitness 4.45
// Gen 5: Fitness 4.62
```

### Viewing Results in Opik Dashboard

1. Navigate to Opik Dashboard → Experiments
2. Select "IKPA Financial Coach" project
3. View "Shark Auditor Framing" experiment
4. Check A/B test results and statistical significance
5. View "Future Self Letter Evolution" experiment
6. Check generation-by-generation fitness improvement
7. Export results for documentation
