# Future Self Engine

## Overview

This document covers Ikpa's Future Self feature, the emotional core of the application. It generates two parallel visions of the user's financial future—the "Current Path" (where they're heading now) and the "Optimized Path" (where they could be with better habits). The AI generates personalized narratives and "letters from your future self" to create emotional connection and motivation.

---

## Feature Concept

### The Dual-Path Vision

The Future Self feature shows users two possible futures:

1. **Current Path**: What happens if nothing changes
   - Continue current spending patterns
   - Maintain existing savings rate
   - Keep current debt repayment pace

2. **Optimized Path**: What's achievable with discipline
   - Reduce discretionary spending
   - Increase savings rate
   - Accelerate debt payoff

### Emotional Elements

- **Time Slider**: Drag to see yourself at 6 months, 1 year, 2 years, 5 years
- **Visual Contrast**: Side-by-side comparison of both paths
- **Narrative Generation**: AI-written stories of daily life in each future
- **Future Self Letters**: Motivational messages from your optimized future self
- **Milestone Celebrations**: Achievements unlocked on the optimized path

---

## Technical Specifications

### Types

```typescript
// apps/api/src/modules/future-self/types/future-self.types.ts

export interface FutureSelfPaths {
  currentPath: FuturePath;
  optimizedPath: FuturePath;
  timeHorizonMonths: number;
  generatedAt: Date;
}

export interface FuturePath {
  type: 'current' | 'optimized';
  snapshots: TimeSnapshot[];
  narrative: PathNarrative;
  milestones: FutureMilestone[];
  finalState: FutureState;
}

export interface TimeSnapshot {
  monthsFromNow: number;
  date: Date;
  netWorth: number;
  savings: number;
  debt: number;
  cashFlowScore: number;
  monthlyDisposable: number;
  goalsProgress: Record<string, number>;
}

export interface FutureState {
  netWorth: number;
  totalSavings: number;
  totalDebt: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  debtFreeDate: Date | null;
  emergencyFundMonths: number;
  goalsCompleted: string[];
  goalsInProgress: string[];
}

export interface PathNarrative {
  title: string;
  summary: string;
  dayInTheLife: string;
  keyMoments: string[];
  emotionalTone: 'hopeful' | 'neutral' | 'concerning';
}

export interface FutureMilestone {
  monthsFromNow: number;
  type: MilestoneType;
  title: string;
  description: string;
  impact: string;
  achieved: boolean;
}

export enum MilestoneType {
  EMERGENCY_FUND = 'emergency_fund',
  DEBT_PAYOFF = 'debt_payoff',
  GOAL_ACHIEVED = 'goal_achieved',
  SAVINGS_MILESTONE = 'savings_milestone',
  NET_WORTH_MILESTONE = 'net_worth_milestone',
  INCOME_MILESTONE = 'income_milestone',
}

export interface FutureLetterRequest {
  timeHorizonMonths: number;
  focusArea?: 'savings' | 'debt' | 'goals' | 'general';
  tone?: 'encouraging' | 'honest' | 'celebratory';
}

export interface FutureLetter {
  fromPath: 'optimized';
  monthsFromNow: number;
  subject: string;
  body: string;
  keyInsights: string[];
  actionItems: string[];
  generatedAt: Date;
}
```

---

## Module Structure

```
apps/api/src/modules/future-self/
├── future-self.module.ts
├── future-self.controller.ts
├── future-self.service.ts
├── generators/
│   ├── path-generator.service.ts
│   ├── narrative-generator.service.ts
│   ├── letter-generator.service.ts
│   └── milestone-generator.service.ts
├── types/
│   └── future-self.types.ts
└── dto/
    ├── generate-paths.dto.ts
    └── generate-letter.dto.ts
```

---

## Service Implementation

### Future Self Service

```typescript
// apps/api/src/modules/future-self/future-self.service.ts

import { Injectable } from '@nestjs/common';
import { PathGeneratorService } from './generators/path-generator.service';
import { NarrativeGeneratorService } from './generators/narrative-generator.service';
import { LetterGeneratorService } from './generators/letter-generator.service';
import { MilestoneGeneratorService } from './generators/milestone-generator.service';
import {
  FutureSelfPaths,
  FutureLetter,
  FutureLetterRequest,
} from './types/future-self.types';

@Injectable()
export class FutureSelfService {
  constructor(
    private readonly pathGenerator: PathGeneratorService,
    private readonly narrativeGenerator: NarrativeGeneratorService,
    private readonly letterGenerator: LetterGeneratorService,
    private readonly milestoneGenerator: MilestoneGeneratorService,
  ) {}

  async generatePaths(
    userId: string,
    timeHorizonMonths = 24,
  ): Promise<FutureSelfPaths> {
    // Generate both paths using simulation engine
    const { currentPath, optimizedPath } = await this.pathGenerator.generate(
      userId,
      timeHorizonMonths,
    );

    // Generate narratives for both paths
    const [currentNarrative, optimizedNarrative] = await Promise.all([
      this.narrativeGenerator.generate(userId, currentPath, 'current'),
      this.narrativeGenerator.generate(userId, optimizedPath, 'optimized'),
    ]);

    // Identify milestones
    const [currentMilestones, optimizedMilestones] = await Promise.all([
      this.milestoneGenerator.identify(currentPath),
      this.milestoneGenerator.identify(optimizedPath),
    ]);

    return {
      currentPath: {
        type: 'current',
        snapshots: currentPath.snapshots,
        narrative: currentNarrative,
        milestones: currentMilestones,
        finalState: currentPath.finalState,
      },
      optimizedPath: {
        type: 'optimized',
        snapshots: optimizedPath.snapshots,
        narrative: optimizedNarrative,
        milestones: optimizedMilestones,
        finalState: optimizedPath.finalState,
      },
      timeHorizonMonths,
      generatedAt: new Date(),
    };
  }

  async generateLetter(
    userId: string,
    request: FutureLetterRequest,
  ): Promise<FutureLetter> {
    return this.letterGenerator.generate(userId, request);
  }

  async getSnapshot(userId: string, monthsFromNow: number) {
    const paths = await this.generatePaths(userId, monthsFromNow);

    const currentSnapshot = paths.currentPath.snapshots.find(
      (s) => s.monthsFromNow === monthsFromNow,
    );
    const optimizedSnapshot = paths.optimizedPath.snapshots.find(
      (s) => s.monthsFromNow === monthsFromNow,
    );

    return {
      monthsFromNow,
      date: currentSnapshot?.date ?? new Date(),
      current: currentSnapshot,
      optimized: optimizedSnapshot,
      difference: {
        netWorth:
          (optimizedSnapshot?.netWorth ?? 0) - (currentSnapshot?.netWorth ?? 0),
        savings:
          (optimizedSnapshot?.savings ?? 0) - (currentSnapshot?.savings ?? 0),
        debt: (currentSnapshot?.debt ?? 0) - (optimizedSnapshot?.debt ?? 0),
      },
    };
  }

  async compareAtMilestone(userId: string, milestoneType: string) {
    const paths = await this.generatePaths(userId, 60); // 5 years

    const optimizedMilestone = paths.optimizedPath.milestones.find(
      (m) => m.type === milestoneType && m.achieved,
    );

    if (!optimizedMilestone) {
      return null;
    }

    const month = optimizedMilestone.monthsFromNow;
    const currentAtMilestone = paths.currentPath.snapshots.find(
      (s) => s.monthsFromNow === month,
    );
    const optimizedAtMilestone = paths.optimizedPath.snapshots.find(
      (s) => s.monthsFromNow === month,
    );

    return {
      milestone: optimizedMilestone,
      current: currentAtMilestone,
      optimized: optimizedAtMilestone,
      monthsAhead:
        (paths.currentPath.milestones.find(
          (m) => m.type === milestoneType && m.achieved,
        )?.monthsFromNow ?? 999) - month,
    };
  }
}
```

### Path Generator Service

```typescript
// apps/api/src/modules/future-self/generators/path-generator.service.ts

import { Injectable } from '@nestjs/common';
import { SimulationService } from '../../simulation/simulation.service';
import { ScenarioType } from '../../simulation/types/simulation.types';
import { TimeSnapshot, FutureState } from '../types/future-self.types';

interface GeneratedPath {
  snapshots: TimeSnapshot[];
  finalState: FutureState;
}

@Injectable()
export class PathGeneratorService {
  constructor(private readonly simulationService: SimulationService) {}

  async generate(
    userId: string,
    timeHorizonMonths: number,
  ): Promise<{ currentPath: GeneratedPath; optimizedPath: GeneratedPath }> {
    // Run simulations
    const [currentResult, optimizedResult] = await Promise.all([
      this.simulationService.runSimulation(
        userId,
        ScenarioType.CURRENT_PATH,
        {},
        timeHorizonMonths,
      ),
      this.simulationService.runSimulation(
        userId,
        ScenarioType.OPTIMIZED,
        {},
        timeHorizonMonths,
      ),
    ]);

    // Convert to snapshots at key intervals
    const intervals = this.getSnapshotIntervals(timeHorizonMonths);

    const currentSnapshots = this.extractSnapshots(
      currentResult.monthlySnapshots,
      intervals,
    );
    const optimizedSnapshots = this.extractSnapshots(
      optimizedResult.monthlySnapshots,
      intervals,
    );

    return {
      currentPath: {
        snapshots: currentSnapshots,
        finalState: this.extractFinalState(currentResult),
      },
      optimizedPath: {
        snapshots: optimizedSnapshots,
        finalState: this.extractFinalState(optimizedResult),
      },
    };
  }

  private getSnapshotIntervals(horizonMonths: number): number[] {
    const intervals: number[] = [];

    // Always include: 3, 6, 12 months
    if (horizonMonths >= 3) intervals.push(3);
    if (horizonMonths >= 6) intervals.push(6);
    if (horizonMonths >= 12) intervals.push(12);

    // Add yearly after that
    for (let year = 2; year * 12 <= horizonMonths; year++) {
      intervals.push(year * 12);
    }

    // Always include final month
    if (!intervals.includes(horizonMonths)) {
      intervals.push(horizonMonths);
    }

    return intervals;
  }

  private extractSnapshots(
    monthlyData: any[],
    intervals: number[],
  ): TimeSnapshot[] {
    return intervals
      .map((month) => {
        const data = monthlyData.find((m) => m.month === month);
        if (!data) return null;

        return {
          monthsFromNow: month,
          date: data.date,
          netWorth: data.netWorth,
          savings: data.totalSavings,
          debt: data.totalDebt,
          cashFlowScore: data.cashFlowScore,
          monthlyDisposable: data.income - data.expenses,
          goalsProgress: data.goalsProgress,
        };
      })
      .filter(Boolean) as TimeSnapshot[];
  }

  private extractFinalState(result: any): FutureState {
    const final = result.monthlySnapshots[result.monthlySnapshots.length - 1];
    const debtFreeMilestone = result.milestones.find(
      (m: any) => m.description.includes('debt') && m.type === 'positive',
    );

    return {
      netWorth: final.netWorth,
      totalSavings: final.totalSavings,
      totalDebt: final.totalDebt,
      monthlyIncome: final.income,
      monthlyExpenses: final.expenses,
      savingsRate:
        final.income > 0
          ? ((final.income - final.expenses) / final.income) * 100
          : 0,
      debtFreeDate: debtFreeMilestone
        ? new Date(
            Date.now() + debtFreeMilestone.month * 30 * 24 * 60 * 60 * 1000,
          )
        : null,
      emergencyFundMonths:
        final.expenses > 0 ? final.totalSavings / final.expenses : 0,
      goalsCompleted: result.summary.goalsAchieved,
      goalsInProgress: result.summary.goalsAtRisk,
    };
  }
}
```

### Narrative Generator Service

```typescript
// apps/api/src/modules/future-self/generators/narrative-generator.service.ts

import { Injectable } from '@nestjs/common';
import { AIService } from '../../ai/ai.service';
import { ContextBuilderService } from '../../ai/context-builder.service';
import { PathNarrative } from '../types/future-self.types';

@Injectable()
export class NarrativeGeneratorService {
  constructor(
    private readonly aiService: AIService,
    private readonly contextBuilder: ContextBuilderService,
  ) {}

  async generate(
    userId: string,
    path: any,
    pathType: 'current' | 'optimized',
  ): Promise<PathNarrative> {
    const context = await this.contextBuilder.buildContext(userId);
    const finalState = path.finalState;

    const prompt = this.buildNarrativePrompt(context, finalState, pathType);

    const response = await this.aiService.generateCompletion(prompt, {
      operation: 'future_narrative',
      userId,
    });

    return this.parseNarrativeResponse(response, pathType, finalState);
  }

  private buildNarrativePrompt(
    context: any,
    finalState: any,
    pathType: 'current' | 'optimized',
  ): string {
    const userName = context.user.firstName;
    const monthsFromNow = 24; // Default 2 years

    return `
You are writing a narrative about ${userName}'s financial future ${monthsFromNow} months from now.
This is the "${pathType === 'current' ? 'Current Path' : 'Optimized Path'}" scenario.

User Context:
- Current age: ${context.user.age || 'unknown'}
- Country: ${context.user.country}
- Primary goal: ${context.goals?.[0]?.name || 'Financial freedom'}

Financial State in ${monthsFromNow} months:
- Net Worth: ₦${finalState.netWorth.toLocaleString()}
- Total Savings: ₦${finalState.totalSavings.toLocaleString()}
- Total Debt: ₦${finalState.totalDebt.toLocaleString()}
- Monthly Disposable: ₦${(finalState.monthlyIncome - finalState.monthlyExpenses).toLocaleString()}
- Savings Rate: ${finalState.savingsRate.toFixed(1)}%
- Emergency Fund: ${finalState.emergencyFundMonths.toFixed(1)} months of expenses

Generate a narrative with:
1. A compelling title (5-7 words)
2. A 2-3 sentence summary
3. A "day in the life" paragraph (how does ${userName} feel about money on a typical day?)
4. 3 key moments/feelings in this future

Tone: ${pathType === 'optimized' ? 'hopeful and empowering' : 'honest and realistic'}

Format your response as JSON:
{
  "title": "...",
  "summary": "...",
  "dayInTheLife": "...",
  "keyMoments": ["...", "...", "..."],
  "emotionalTone": "hopeful" | "neutral" | "concerning"
}
`;
  }

  private parseNarrativeResponse(
    response: string,
    pathType: 'current' | 'optimized',
    finalState: any,
  ): PathNarrative {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Fallback narrative
    }

    // Default fallback
    return {
      title:
        pathType === 'optimized'
          ? 'A Future of Financial Confidence'
          : 'Where the Current Road Leads',
      summary:
        pathType === 'optimized'
          ? `With discipline and smart choices, you could have ₦${finalState.totalSavings.toLocaleString()} saved and a ${finalState.savingsRate.toFixed(0)}% savings rate.`
          : `Continuing on your current path, you'll have ₦${finalState.totalSavings.toLocaleString()} saved with ${finalState.totalDebt > 0 ? 'ongoing debt obligations' : 'manageable finances'}.`,
      dayInTheLife:
        pathType === 'optimized'
          ? 'You wake up knowing your bills are covered, your emergency fund is strong, and you're making real progress on your goals. Financial stress no longer keeps you up at night.'
          : 'Your finances are on autopilot, but you sometimes wonder if you could be doing better. There's always that nagging feeling that you should be saving more.',
      keyMoments: [
        pathType === 'optimized'
          ? 'The relief of having a fully-funded emergency fund'
          : 'Another month passing without significant progress',
        pathType === 'optimized'
          ? 'Confidently saying yes to opportunities without financial fear'
          : 'Having to decline opportunities due to tight finances',
        pathType === 'optimized'
          ? 'Watching your net worth grow month after month'
          : 'The status quo continues, for better or worse',
      ],
      emotionalTone: pathType === 'optimized' ? 'hopeful' : 'neutral',
    };
  }
}
```

### Letter Generator Service

```typescript
// apps/api/src/modules/future-self/generators/letter-generator.service.ts

import { Injectable } from '@nestjs/common';
import { AIService } from '../../ai/ai.service';
import { ContextBuilderService } from '../../ai/context-builder.service';
import { SimulationService } from '../../simulation/simulation.service';
import { ScenarioType } from '../../simulation/types/simulation.types';
import { FutureLetter, FutureLetterRequest } from '../types/future-self.types';

@Injectable()
export class LetterGeneratorService {
  constructor(
    private readonly aiService: AIService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly simulationService: SimulationService,
  ) {}

  async generate(
    userId: string,
    request: FutureLetterRequest,
  ): Promise<FutureLetter> {
    const [context, simulation] = await Promise.all([
      this.contextBuilder.buildContext(userId),
      this.simulationService.runSimulation(
        userId,
        ScenarioType.OPTIMIZED,
        {},
        request.timeHorizonMonths,
      ),
    ]);

    const prompt = this.buildLetterPrompt(
      context,
      simulation,
      request,
    );

    const response = await this.aiService.generateCompletion(prompt, {
      operation: 'future_letter',
      userId,
    });

    return this.parseLetterResponse(response, request);
  }

  private buildLetterPrompt(
    context: any,
    simulation: any,
    request: FutureLetterRequest,
  ): string {
    const userName = context.user.firstName;
    const months = request.timeHorizonMonths;
    const final = simulation.monthlySnapshots[simulation.monthlySnapshots.length - 1];
    const milestones = simulation.milestones.filter((m: any) => m.type === 'positive');

    const focusContent = this.getFocusContent(request.focusArea, simulation, context);
    const toneGuidance = this.getToneGuidance(request.tone);

    return `
You are ${userName}'s future self, writing a letter from ${months} months in the future.
This is the "optimized path" version of ${userName} - the one who made consistent, disciplined financial choices.

Current ${userName}'s situation:
- Net Worth: ₦${context.metrics?.netWorth?.toLocaleString() || 'unknown'}
- Savings: ₦${context.metrics?.totalSavings?.toLocaleString() || 'unknown'}
- Debt: ₦${context.metrics?.totalDebt?.toLocaleString() || 'unknown'}
- Cash Flow Score: ${context.metrics?.cashFlowScore || 'unknown'}

Future ${userName}'s situation (${months} months later):
- Net Worth: ₦${final.netWorth.toLocaleString()}
- Savings: ₦${final.totalSavings.toLocaleString()}
- Debt: ₦${final.totalDebt.toLocaleString()}
- Cash Flow Score: ${final.cashFlowScore}
- Milestones Achieved: ${milestones.map((m: any) => m.description).join(', ')}

${focusContent}

Tone guidance: ${toneGuidance}

Write a personal, heartfelt letter from Future ${userName} to Present ${userName}.
The letter should:
1. Open with a warm greeting
2. Share what life is like now (emotionally, not just financially)
3. Reflect on the key decisions that made the difference
4. Encourage the present self with specific, actionable advice
5. End with hope and confidence

After the letter, provide:
- 3 key insights (what future self wants present self to understand)
- 3 action items (specific steps to take this week)

Format as JSON:
{
  "subject": "...",
  "body": "...",
  "keyInsights": ["...", "...", "..."],
  "actionItems": ["...", "...", "..."]
}
`;
  }

  private getFocusContent(
    focusArea: string | undefined,
    simulation: any,
    context: any,
  ): string {
    switch (focusArea) {
      case 'savings':
        return `Focus on the savings journey. Current savings: ₦${context.metrics?.totalSavings?.toLocaleString() || 0}. Future savings: ₦${simulation.summary.totalSaved.toLocaleString()}.`;
      case 'debt':
        return `Focus on the debt-free journey. ${simulation.summary.monthsToDebtFree ? `Debt-free in ${simulation.summary.monthsToDebtFree} months!` : 'Debt situation has improved.'}`;
      case 'goals':
        return `Focus on achieved goals: ${simulation.summary.goalsAchieved.join(', ') || 'Multiple goals achieved'}.`;
      default:
        return 'Focus on overall financial wellness and peace of mind.';
    }
  }

  private getToneGuidance(tone: string | undefined): string {
    switch (tone) {
      case 'honest':
        return 'Be truthful and direct. Acknowledge past mistakes without judgment. Focus on practical steps.';
      case 'celebratory':
        return 'Celebrate the achievements! Be joyful and proud. Share the excitement of milestones reached.';
      case 'encouraging':
      default:
        return 'Be warm, supportive, and encouraging. Focus on potential and possibility. Inspire action with kindness.';
    }
  }

  private parseLetterResponse(
    response: string,
    request: FutureLetterRequest,
  ): FutureLetter {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          fromPath: 'optimized',
          monthsFromNow: request.timeHorizonMonths,
          subject: parsed.subject,
          body: parsed.body,
          keyInsights: parsed.keyInsights,
          actionItems: parsed.actionItems,
          generatedAt: new Date(),
        };
      }
    } catch (error) {
      // Fallback
    }

    // Default letter
    return {
      fromPath: 'optimized',
      monthsFromNow: request.timeHorizonMonths,
      subject: `A Message from Your Future Self`,
      body: `Dear Present Me,

I'm writing to you from ${request.timeHorizonMonths} months in the future, and I want you to know—the effort is worth it.

Right now, you might be wondering if small changes really matter. They do. Every naira saved, every conscious spending decision, every time you said "not now" to an impulse purchase—it all adds up.

The peace of mind I have now? You built that. One decision at a time.

Keep going. Your future self is grateful.

With love and belief in you,
Future You`,
      keyInsights: [
        'Small, consistent actions compound over time',
        'Financial peace is possible and closer than you think',
        'The sacrifices you make today create tomorrow\'s opportunities',
      ],
      actionItems: [
        'Review your expenses this week and identify one area to reduce',
        'Set up an automatic transfer to savings, even if it\'s small',
        'Track every expense for 3 days to build awareness',
      ],
      generatedAt: new Date(),
    };
  }
}
```

---

## Controller Implementation

```typescript
// apps/api/src/modules/future-self/future-self.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FutureSelfService } from './future-self.service';
import { FutureLetterRequest } from './types/future-self.types';

@Controller('future-self')
@UseGuards(JwtAuthGuard)
export class FutureSelfController {
  constructor(private readonly futureSelfService: FutureSelfService) {}

  @Get('paths')
  async getPaths(
    @CurrentUser('id') userId: string,
    @Query('months') months?: number,
  ) {
    return this.futureSelfService.generatePaths(userId, months ?? 24);
  }

  @Get('snapshot')
  async getSnapshot(
    @CurrentUser('id') userId: string,
    @Query('months') monthsFromNow: number,
  ) {
    return this.futureSelfService.getSnapshot(userId, monthsFromNow);
  }

  @Get('compare-milestone')
  async compareMilestone(
    @CurrentUser('id') userId: string,
    @Query('type') milestoneType: string,
  ) {
    return this.futureSelfService.compareAtMilestone(userId, milestoneType);
  }

  @Post('letter')
  async generateLetter(
    @CurrentUser('id') userId: string,
    @Body() request: FutureLetterRequest,
  ) {
    return this.futureSelfService.generateLetter(userId, request);
  }
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/future-self/paths` | Generate dual-path projections |
| GET | `/future-self/snapshot` | Get comparison at specific time |
| GET | `/future-self/compare-milestone` | Compare paths at milestone |
| POST | `/future-self/letter` | Generate letter from future self |

---

## UI Components

### Dual Path Comparison

```tsx
// Mobile: apps/mobile/src/components/future-self/DualPathView.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { FutureSelfPaths } from '../../types';
import { formatCurrency } from '../../utils/format';

interface DualPathViewProps {
  paths: FutureSelfPaths;
}

export function DualPathView({ paths }: DualPathViewProps) {
  const [selectedMonth, setSelectedMonth] = useState(12);

  const currentSnapshot = paths.currentPath.snapshots.find(
    (s) => s.monthsFromNow >= selectedMonth,
  );
  const optimizedSnapshot = paths.optimizedPath.snapshots.find(
    (s) => s.monthsFromNow >= selectedMonth,
  );

  const difference = (optimizedSnapshot?.netWorth ?? 0) - (currentSnapshot?.netWorth ?? 0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Financial Future</Text>

      {/* Time Slider */}
      <View style={styles.sliderContainer}>
        <Text style={styles.sliderLabel}>
          {selectedMonth} months from now
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={3}
          maximumValue={paths.timeHorizonMonths}
          step={3}
          value={selectedMonth}
          onValueChange={setSelectedMonth}
          minimumTrackTintColor="#10B981"
          maximumTrackTintColor="#E5E7EB"
          thumbTintColor="#10B981"
        />
      </View>

      {/* Path Comparison */}
      <View style={styles.pathsContainer}>
        {/* Current Path */}
        <View style={[styles.pathCard, styles.currentPath]}>
          <Text style={styles.pathLabel}>Current Path</Text>
          <Text style={styles.pathNetWorth}>
            {formatCurrency(currentSnapshot?.netWorth ?? 0, 'NGN')}
          </Text>
          <Text style={styles.pathSubtext}>Net Worth</Text>

          <View style={styles.pathMetrics}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {formatCurrency(currentSnapshot?.savings ?? 0, 'NGN')}
              </Text>
              <Text style={styles.metricLabel}>Savings</Text>
            </View>
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: '#EF4444' }]}>
                {formatCurrency(currentSnapshot?.debt ?? 0, 'NGN')}
              </Text>
              <Text style={styles.metricLabel}>Debt</Text>
            </View>
          </View>
        </View>

        {/* VS Divider */}
        <View style={styles.divider}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        {/* Optimized Path */}
        <View style={[styles.pathCard, styles.optimizedPath]}>
          <Text style={styles.pathLabel}>Optimized Path</Text>
          <Text style={[styles.pathNetWorth, { color: '#10B981' }]}>
            {formatCurrency(optimizedSnapshot?.netWorth ?? 0, 'NGN')}
          </Text>
          <Text style={styles.pathSubtext}>Net Worth</Text>

          <View style={styles.pathMetrics}>
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: '#10B981' }]}>
                {formatCurrency(optimizedSnapshot?.savings ?? 0, 'NGN')}
              </Text>
              <Text style={styles.metricLabel}>Savings</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {formatCurrency(optimizedSnapshot?.debt ?? 0, 'NGN')}
              </Text>
              <Text style={styles.metricLabel}>Debt</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Difference Highlight */}
      <View style={styles.differenceBox}>
        <Text style={styles.differenceLabel}>
          Potential difference in {selectedMonth} months
        </Text>
        <Text style={styles.differenceValue}>
          +{formatCurrency(difference, 'NGN')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 24,
  },
  sliderContainer: {
    marginBottom: 24,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  pathsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  pathCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  currentPath: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optimizedPath: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pathLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  pathNetWorth: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'JetBrains Mono',
  },
  pathSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  pathMetrics: {
    width: '100%',
    gap: 8,
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'JetBrains Mono',
  },
  metricLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  divider: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 30,
  },
  vsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  differenceBox: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  differenceLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  differenceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    fontFamily: 'JetBrains Mono',
    marginTop: 4,
  },
});
```

---

## Key Capabilities

1. **Dual-Path Projections**: Side-by-side current vs optimized futures
2. **Time Slider**: Explore any point from 3 months to 5 years
3. **AI Narratives**: Personalized stories of each future
4. **Future Letters**: Motivational letters from optimized future self
5. **Milestone Comparison**: When would you hit goals on each path?
6. **Emotional Connection**: Focus on feelings, not just numbers

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@nestjs/common` | Core NestJS decorators |
| `@anthropic-ai/sdk` | Claude API |
| `@react-native-community/slider` | Time slider (mobile) |

---

## Next Steps

After Future Self Engine, proceed to:
1. [16-mobile-app.md](./16-mobile-app.md) - React Native mobile app
