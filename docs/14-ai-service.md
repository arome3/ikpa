# AI Service

## Overview

This document covers Ikpa's AI service powered by Claude (Anthropic). The AI serves as a personal financial advisor, providing conversational assistance, concept explanations, personalized insights, and financial planning. The AI is context-aware, understanding each user's financial situation to provide relevant, actionable guidance.

---

## Technical Specifications

### Technology Stack

| Technology | Purpose |
|------------|---------|
| Anthropic Claude API | AI reasoning engine |
| claude-sonnet-4-20250514 | Primary model |
| Redis | Rate limiting, caching |

### AI Capabilities

| Feature | Description | Rate Limit |
|---------|-------------|------------|
| **Ask** | Conversational Q&A | 20/min |
| **Explain** | Concept explanations | 30/min |
| **Insight** | Proactive insights | 20/min |
| **Plan** | Financial planning | 10/hour |
| **Future Self** | Path projections | 5/hour |

### API Endpoints

```yaml
POST /v1/ai/ask:
  body: {
    message: string,
    conversationId?: string,
    context?: { includeSnapshot?, includeGoals?, includePatterns? }
  }
  response: {
    response: string,
    conversationId: string,
    suggestedActions?: { type, label, payload }[]
  }

POST /v1/ai/explain:
  body: {
    topic: string,
    context?: "metric" | "concept" | "recommendation",
    userValue?: number
  }
  response: {
    explanation: string,
    relevance: string,
    actions?: string[]
  }

POST /v1/ai/insight:
  body: { type?: "spending" | "saving" | "goal" | "general" }
  response: {
    insight: string,
    category: string,
    actionable: boolean,
    suggestedAction?: object
  }

POST /v1/ai/plan:
  body: {
    horizon: "short" | "medium" | "long" | "all",
    focusAreas?: string[]
  }
  response: {
    phases: { name, duration, goals[], actions[] }[],
    projectedOutcome: string
  }

GET /v1/ai/conversations:
  response: AIConversation[]

GET /v1/ai/conversations/:id:
  response: AIConversation
```

---

## Key Capabilities

- Context-aware financial conversations
- Personalized explanations of financial concepts
- Proactive insights based on user data
- Multi-horizon financial planning
- Conversation persistence
- Rate limiting per operation

---

## Implementation Guide

### Step 1: Install Dependencies

```bash
cd apps/api
pnpm add @anthropic-ai/sdk
```

### Step 2: AI Module Structure

```
src/modules/ai/
├── ai.module.ts
├── ai.controller.ts
├── ai.service.ts
├── context-builder.ts
├── prompt-templates.ts
├── response-parser.ts
├── ai-rate-limiter.ts
└── dto/
    ├── ask.dto.ts
    ├── explain.dto.ts
    └── plan.dto.ts
```

### Step 3: Context Builder

```typescript
// apps/api/src/modules/ai/context-builder.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { GoalService } from '../goals/goal.service';

export interface AIContext {
  user: {
    name: string;
    country: string;
    currency: string;
    employmentType?: string;
  };
  snapshot?: {
    cashFlowScore: number;
    savingsRate: number;
    runwayMonths: number;
    dependencyRatio: number;
    netWorth: number;
    totalIncome: number;
    totalExpenses: number;
  };
  goals?: {
    name: string;
    targetAmount: number;
    currentAmount: number;
    targetDate?: Date;
    progress: number;
  }[];
  patterns?: {
    type: string;
    description: string;
    impact: string;
  }[];
  income?: {
    total: number;
    sources: { name: string; type: string; amount: number }[];
  };
  expenses?: {
    total: number;
    byCategory: { category: string; amount: number; percentage: number }[];
  };
  debts?: {
    total: number;
    items: { name: string; balance: number; interestRate: number }[];
  };
  familySupport?: {
    total: number;
    items: { name: string; relationship: string; amount: number }[];
  };
}

interface ContextOptions {
  includeSnapshot?: boolean;
  includeGoals?: boolean;
  includePatterns?: boolean;
  includeIncome?: boolean;
  includeExpenses?: boolean;
  includeDebts?: boolean;
  includeSupport?: boolean;
}

@Injectable()
export class ContextBuilder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
    private readonly goalService: GoalService,
  ) {}

  async buildContext(userId: string, options: ContextOptions = {}): Promise<AIContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const context: AIContext = {
      user: {
        name: user.name,
        country: user.country,
        currency: user.currency,
        employmentType: user.employmentType || undefined,
      },
    };

    // Fetch requested context in parallel
    const promises: Promise<void>[] = [];

    if (options.includeSnapshot) {
      promises.push(
        this.financeService.getCurrentSnapshot(userId).then((snapshot) => {
          context.snapshot = {
            cashFlowScore: snapshot.cashFlowScore,
            savingsRate: Number(snapshot.savingsRate),
            runwayMonths: Number(snapshot.runwayMonths),
            dependencyRatio: Number(snapshot.dependencyRatio),
            netWorth: Number(snapshot.netWorth),
            totalIncome: Number(snapshot.totalIncome),
            totalExpenses: Number(snapshot.totalExpenses),
          };
        }),
      );
    }

    if (options.includeGoals) {
      promises.push(
        this.prisma.goal.findMany({
          where: { userId, status: 'ACTIVE' },
        }).then((goals) => {
          context.goals = goals.map((g) => ({
            name: g.name,
            targetAmount: Number(g.targetAmount),
            currentAmount: Number(g.currentAmount),
            targetDate: g.targetDate || undefined,
            progress: Number(g.targetAmount) > 0
              ? (Number(g.currentAmount) / Number(g.targetAmount)) * 100
              : 0,
          }));
        }),
      );
    }

    if (options.includeDebts) {
      promises.push(
        this.prisma.debt.findMany({
          where: { userId, isActive: true },
        }).then((debts) => {
          context.debts = {
            total: debts.reduce((sum, d) => sum + Number(d.remainingBalance), 0),
            items: debts.map((d) => ({
              name: d.name,
              balance: Number(d.remainingBalance),
              interestRate: Number(d.interestRate),
            })),
          };
        }),
      );
    }

    if (options.includeSupport) {
      promises.push(
        this.prisma.familySupport.findMany({
          where: { userId, isActive: true },
        }).then((support) => {
          context.familySupport = {
            total: support.reduce((sum, s) => sum + Number(s.amount), 0),
            items: support.map((s) => ({
              name: s.name,
              relationship: s.relationship,
              amount: Number(s.amount),
            })),
          };
        }),
      );
    }

    await Promise.all(promises);

    return context;
  }

  async buildFullContext(userId: string): Promise<AIContext> {
    return this.buildContext(userId, {
      includeSnapshot: true,
      includeGoals: true,
      includePatterns: true,
      includeIncome: true,
      includeExpenses: true,
      includeDebts: true,
      includeSupport: true,
    });
  }
}
```

### Step 4: Prompt Templates

```typescript
// apps/api/src/modules/ai/prompt-templates.ts

import { AIContext } from './context-builder';

export class PromptTemplates {
  static systemPrompt(context: AIContext): string {
    return `You are Ikpa, an AI-powered personal finance co-pilot for young Africans.

Your role is to help users understand their finances, make better decisions, and build wealth.

USER CONTEXT:
Name: ${context.user.name}
Country: ${context.user.country}
Currency: ${context.user.currency}
Employment: ${context.user.employmentType || 'Not specified'}

${context.snapshot ? this.formatSnapshot(context.snapshot) : ''}

${context.goals?.length ? this.formatGoals(context.goals) : ''}

${context.familySupport ? this.formatFamilySupport(context.familySupport) : ''}

GUIDELINES:
1. Always use ${context.user.currency} for monetary values
2. Consider family obligations as normal, not obstacles - this is Africa
3. Acknowledge economic realities (inflation, currency volatility, informal sector)
4. Provide specific, actionable guidance
5. Explain concepts simply, avoid jargon
6. Never promise specific returns or guarantee outcomes
7. Encourage progress without moralizing about spending choices
8. Be culturally aware - understand ajo/susu, mobile money, family expectations
9. Keep responses concise but complete`;
  }

  private static formatSnapshot(snapshot: AIContext['snapshot']): string {
    if (!snapshot) return '';
    return `
FINANCIAL SNAPSHOT:
• Cash Flow Score: ${snapshot.cashFlowScore}/100
• Savings Rate: ${snapshot.savingsRate.toFixed(1)}%
• Runway: ${snapshot.runwayMonths.toFixed(1)} months of expenses saved
• Dependency Ratio: ${snapshot.dependencyRatio.toFixed(1)}% of income to family
• Net Worth: ${snapshot.netWorth.toLocaleString()}
• Monthly Income: ${snapshot.totalIncome.toLocaleString()}
• Monthly Expenses: ${snapshot.totalExpenses.toLocaleString()}`;
  }

  private static formatGoals(goals: AIContext['goals']): string {
    if (!goals?.length) return '';
    const goalList = goals
      .map((g) => `• ${g.name}: ${g.progress.toFixed(0)}% complete (${g.currentAmount.toLocaleString()}/${g.targetAmount.toLocaleString()})`)
      .join('\n');
    return `\nACTIVE GOALS:\n${goalList}`;
  }

  private static formatFamilySupport(support: AIContext['familySupport']): string {
    if (!support?.items?.length) return '';
    const supportList = support.items
      .map((s) => `• ${s.name} (${s.relationship}): ${s.amount.toLocaleString()}/month`)
      .join('\n');
    return `\nFAMILY SUPPORT OBLIGATIONS:\n${supportList}\nTotal: ${support.total.toLocaleString()}/month`;
  }

  static educatorSystemPrompt(): string {
    return `You are Ikpa's Financial Educator. Your role is to explain financial concepts clearly and personally.

GUIDELINES:
- Use simple, everyday language
- Connect explanations to the user's actual situation and numbers
- Explain why the concept matters for their specific case
- Suggest 1-2 actionable next steps
- Use analogies and examples relevant to African context
- Keep explanations under 200 words unless asked for more detail`;
  }

  static explainPrompt(topic: string, context: AIContext, userValue?: number): string {
    return `Explain "${topic}" to ${context.user.name}.

${userValue !== undefined ? `Their current value for this metric is: ${userValue}` : ''}

Their context:
- Country: ${context.user.country}
- Currency: ${context.user.currency}
${context.snapshot ? `- Cash Flow Score: ${context.snapshot.cashFlowScore}/100` : ''}
${context.snapshot ? `- Savings Rate: ${context.snapshot.savingsRate.toFixed(1)}%` : ''}

Provide:
1. Simple explanation (what it means)
2. Why it matters for them specifically
3. One actionable step they can take`;
  }

  static plannerSystemPrompt(): string {
    return `You are Ikpa's Financial Planner. Create realistic, sequenced financial plans.

GUIDELINES:
- Prioritize actions by impact and feasibility
- Explain the rationale for the sequence
- Account for African economic context (inflation, currency risk)
- Be realistic about timelines
- Build in flexibility for unexpected expenses (medical, family emergencies)
- Consider both formal and informal financial instruments`;
  }

  static planPrompt(context: AIContext, horizon: string): string {
    return `Create a financial plan for ${context.user.name}.

HORIZON: ${horizon === 'short' ? '0-6 months' : horizon === 'medium' ? '6-24 months' : horizon === 'long' ? '2-5 years' : 'All horizons'}

CURRENT SITUATION:
${JSON.stringify(context, null, 2)}

Create a phased plan with:
1. Clear phase names and durations
2. Specific goals for each phase
3. Prioritized actions with rationale
4. Expected outcomes

Format the plan as structured JSON matching this schema:
{
  "phases": [
    {
      "name": "Phase name",
      "duration": "Time period",
      "goals": ["Goal 1", "Goal 2"],
      "actions": [
        {
          "priority": 1,
          "action": "Specific action",
          "rationale": "Why this matters",
          "impact": "Expected result"
        }
      ]
    }
  ],
  "projectedOutcome": "Summary of where they'll be"
}`;
  }

  static futureSelfSystemPrompt(): string {
    return `You are Ikpa's Future Self Engine. Create vivid narratives that help users connect with their future selves.

Generate two parallel futures:
1. CURRENT PATH: What happens if they continue as-is
2. OPTIMIZED PATH: What happens with achievable improvements

GUIDELINES:
- Be specific and personal - use their actual numbers
- Show life outcomes, not just financial metrics
- Make both paths realistic - don't exaggerate
- Identify the key divergence point (the one change that matters most)
- Use narrative storytelling, not bullet points
- Account for African context (property ownership patterns, family dynamics, economic cycles)
- The optimized path should feel achievable, not fantasy`;
  }
}
```

### Step 5: AI Service

```typescript
// apps/api/src/modules/ai/ai.service.ts

import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ContextBuilder } from './context-builder';
import { PromptTemplates } from './prompt-templates';
import { AIRateLimiter } from './ai-rate-limiter';
import { AskDto } from './dto/ask.dto';
import { ExplainDto } from './dto/explain.dto';
import { PlanDto } from './dto/plan.dto';

@Injectable()
export class AIService {
  private readonly client: Anthropic;
  private readonly model = 'claude-sonnet-4-20250514';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly contextBuilder: ContextBuilder,
    private readonly rateLimiter: AIRateLimiter,
  ) {
    this.client = new Anthropic({
      apiKey: this.config.get('ANTHROPIC_API_KEY'),
    });
  }

  async ask(userId: string, dto: AskDto) {
    await this.rateLimiter.checkLimit(userId, 'ask');

    const context = await this.contextBuilder.buildContext(userId, {
      includeSnapshot: dto.context?.includeSnapshot ?? true,
      includeGoals: dto.context?.includeGoals ?? true,
      includePatterns: dto.context?.includePatterns ?? false,
    });

    // Get or create conversation
    let conversation = dto.conversationId
      ? await this.prisma.aIConversation.findUnique({
          where: { id: dto.conversationId },
          include: { messages: { orderBy: { createdAt: 'asc' } } },
        })
      : null;

    if (!conversation) {
      conversation = await this.prisma.aIConversation.create({
        data: { userId },
        include: { messages: true },
      });
    }

    // Build message history
    const history = conversation.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Call Claude
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: PromptTemplates.systemPrompt(context),
      messages: [...history, { role: 'user', content: dto.message }],
    });

    const assistantMessage =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Save messages
    await this.prisma.aIMessage.createMany({
      data: [
        {
          conversationId: conversation.id,
          role: 'user',
          content: dto.message,
        },
        {
          conversationId: conversation.id,
          role: 'assistant',
          content: assistantMessage,
        },
      ],
    });

    // Update conversation title if first message
    if (conversation.messages.length === 0) {
      const title = dto.message.slice(0, 50) + (dto.message.length > 50 ? '...' : '');
      await this.prisma.aIConversation.update({
        where: { id: conversation.id },
        data: { title },
      });
    }

    return {
      response: assistantMessage,
      conversationId: conversation.id,
    };
  }

  async explain(userId: string, dto: ExplainDto) {
    await this.rateLimiter.checkLimit(userId, 'explain');

    const context = await this.contextBuilder.buildContext(userId, {
      includeSnapshot: true,
    });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: PromptTemplates.educatorSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: PromptTemplates.explainPrompt(dto.topic, context, dto.userValue),
        },
      ],
    });

    const explanation =
      response.content[0].type === 'text' ? response.content[0].text : '';

    return {
      explanation,
      topic: dto.topic,
    };
  }

  async generatePlan(userId: string, dto: PlanDto) {
    await this.rateLimiter.checkLimit(userId, 'plan');

    const context = await this.contextBuilder.buildFullContext(userId);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: PromptTemplates.plannerSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: PromptTemplates.planPrompt(context, dto.horizon),
        },
      ],
    });

    const planText =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON from response
    try {
      const jsonMatch = planText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Return as text if JSON parsing fails
    }

    return { rawPlan: planText };
  }

  async getConversations(userId: string) {
    return this.prisma.aIConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
  }

  async getConversation(userId: string, conversationId: string) {
    return this.prisma.aIConversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async deleteConversation(userId: string, conversationId: string) {
    await this.prisma.aIConversation.deleteMany({
      where: { id: conversationId, userId },
    });
  }
}
```

### Step 6: Rate Limiter

```typescript
// apps/api/src/modules/ai/ai-rate-limiter.ts

import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../../common/exceptions/api.exception';
import { ErrorCodes } from '../../common/constants/error-codes';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class AIRateLimiter {
  private readonly redis: Redis;
  private readonly limits: Record<string, { points: number; duration: number }> = {
    ask: { points: 20, duration: 60 },       // 20 per minute
    explain: { points: 30, duration: 60 },   // 30 per minute
    insight: { points: 20, duration: 60 },   // 20 per minute
    plan: { points: 10, duration: 3600 },    // 10 per hour
    futureSelf: { points: 5, duration: 3600 }, // 5 per hour
  };

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis(this.config.get('REDIS_URL'));
  }

  async checkLimit(userId: string, operation: string): Promise<void> {
    const key = `ai:${operation}:${userId}`;
    const limit = this.limits[operation];

    if (!limit) {
      throw new Error(`Unknown AI operation: ${operation}`);
    }

    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, limit.duration);
    }

    if (current > limit.points) {
      throw new ApiException(
        ErrorCodes.AI_RATE_LIMIT,
        `AI rate limit exceeded for ${operation}. Try again later.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
```

### Step 7: AI Controller

```typescript
// apps/api/src/modules/ai/ai.controller.ts

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { AIService } from './ai.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AskDto } from './dto/ask.dto';
import { ExplainDto } from './dto/explain.dto';
import { PlanDto } from './dto/plan.dto';

@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('ask')
  async ask(@CurrentUser('id') userId: string, @Body() dto: AskDto) {
    return this.aiService.ask(userId, dto);
  }

  @Post('explain')
  async explain(@CurrentUser('id') userId: string, @Body() dto: ExplainDto) {
    return this.aiService.explain(userId, dto);
  }

  @Post('plan')
  async plan(@CurrentUser('id') userId: string, @Body() dto: PlanDto) {
    return this.aiService.generatePlan(userId, dto);
  }

  @Get('conversations')
  async getConversations(@CurrentUser('id') userId: string) {
    return this.aiService.getConversations(userId);
  }

  @Get('conversations/:id')
  async getConversation(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.aiService.getConversation(userId, id);
  }

  @Delete('conversations/:id')
  async deleteConversation(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.aiService.deleteConversation(userId, id);
    return { message: 'Conversation deleted' };
  }
}
```

---

## UI/UX Specifications

### AI Chat Interface

```
┌─────────────────────────────────────────┐
│ ← Ask Ikpa                          •••│
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🤖 Hi Arome! How can I help    │   │
│  │    you with your finances      │   │
│  │    today?                       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │            How can I save more? │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🤖 Based on your spending, I    │   │
│  │    see you spend about ₦45K     │   │
│  │    on food monthly. Here are    │   │
│  │    3 ways to reduce this:       │   │
│  │                                  │   │
│  │    1. Meal prep on Sundays...   │   │
│  │    2. Use apps for discounts... │   │
│  │    3. Limit eating out to...    │   │
│  │                                  │   │
│  │    Would you like me to create  │   │
│  │    a detailed plan?             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Suggested:                             │
│  ┌──────────┐ ┌──────────────────────┐ │
│  │ Yes!     │ │ Show my spending     │ │
│  └──────────┘ └──────────────────────┘ │
│                                         │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────┐    │
│ │ Type a message...           🎤 📎│    │
│ └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Design Tokens

| Element | Value |
|---------|-------|
| User bubble | `#10B981` (Ikpa Green) |
| AI bubble | `#F3F4F6` (Gray-100) |
| AI avatar | `🤖` or custom icon |
| Suggested chips | Outline style, rounded |

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/sdk` | Claude API client |
| `ioredis` | Redis client for rate limiting |

---

## Next Steps

After AI service, proceed to:
1. [15-future-self-engine.md](./15-future-self-engine.md) - Future Self visualization
2. [16-mobile-app.md](./16-mobile-app.md) - Mobile implementation
