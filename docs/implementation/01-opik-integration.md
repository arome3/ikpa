# Opik Integration

**Week:** 1 | **Tier:** 1 | **Depends On:** None

---

## Overview

Opik provides distributed tracing, LLM-as-a-Judge evaluation, and prompt optimization for IKPA. This is the **foundation layer** that all other agents depend on for observability and evolution.

**Why It Matters:**
- Traces every "cognitive chain" from transaction detection to user decision
- Enables G-Eval metrics for tone, empathy, and cultural sensitivity
- Powers prompt optimization (MetaPromptOptimizer, EvolutionaryOptimizer, GEPA)
- Critical for winning "Best Use of Opik" prize

---

## Technical Spec

### Interfaces

```typescript
// Opik Client Configuration
import { Opik } from 'opik';

const client = new Opik({
  apiKey: process.env.OPIK_API_KEY,
  apiUrl: 'https://www.comet.com/opik/api',
  projectName: 'ikpa-financial-coach',
  workspaceName: process.env.OPIK_WORKSPACE_NAME,
});
```

### Core Logic

```typescript
// Example: Full cognitive chain trace
async function handleSharkAudit(userId: string) {
  const trace = client.trace({
    name: 'shark_audit_cognitive_chain',
    input: { userId },
    metadata: { agent: 'shark_auditor', version: '1.0' }
  });

  // Span 1: Transaction Analysis
  const txSpan = trace.span({
    name: 'transaction_analysis',
    type: 'tool'
  });
  const subscriptions = await analyzeTransactions(userId);
  txSpan.end({ output: { subscriptionCount: subscriptions.length } });

  // Span 2: Metrics Calculation
  const metricsSpan = trace.span({
    name: 'calculate_savings_potential',
    type: 'tool'
  });
  const savingsPotential = calculateAnnualizedSavings(subscriptions);
  metricsSpan.end({ output: { potentialSavings: savingsPotential } });

  // Span 3: LLM Framing Generation
  const llmSpan = trace.span({
    name: 'generate_framing',
    type: 'llm',
    input: { subscriptions, savingsPotential }
  });
  const framing = await generateAnnualizedFraming(subscriptions);
  llmSpan.end({
    output: { framing },
    metadata: { model: 'claude-sonnet', tokens: 450 }
  });

  // Span 4: User Decision Recording
  const decisionSpan = trace.span({
    name: 'await_user_decision',
    type: 'tool'
  });
  // ... await user swipe decisions
  decisionSpan.end({ output: { decisionsRecorded: true } });

  trace.end({ output: { success: true, subscriptionsReviewed: subscriptions.length } });
  await client.flush();
}
```

### OpikService Wrapper Class

```typescript
// apps/api/src/modules/ai/opik/opik.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Opik } from 'opik';

@Injectable()
export class OpikService implements OnModuleInit, OnModuleDestroy {
  private client: Opik;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.client = new Opik({
      apiKey: this.configService.get('OPIK_API_KEY'),
      apiUrl: this.configService.get('OPIK_URL_OVERRIDE', 'https://www.comet.com/opik/api'),
      projectName: this.configService.get('OPIK_PROJECT_NAME', 'ikpa-financial-coach'),
      workspaceName: this.configService.get('OPIK_WORKSPACE_NAME'),
    });
  }

  async onModuleDestroy() {
    await this.client.flush();
  }

  createTrace(name: string, input: Record<string, any>, metadata?: Record<string, any>) {
    return this.client.trace({
      name,
      input,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async flush() {
    await this.client.flush();
  }

  getClient() {
    return this.client;
  }
}
```

---

## Implementation Checklist

- [ ] Create file: `apps/api/src/modules/ai/opik/opik.module.ts`
- [ ] Create file: `apps/api/src/modules/ai/opik/opik.service.ts`
- [ ] Add Opik environment variables to `.env`
- [ ] Register OpikModule in `app.module.ts`
- [ ] Create trace helper methods for each agent type
- [ ] Test trace visibility in Opik dashboard
- [ ] Add span types: `tool`, `llm`, `retrieval`

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| N/A | Internal service | No external API routes |

*Opik is an internal service. All tracing happens automatically within other agent endpoints.*

---

## Environment Variables

```env
# Required for Opik Integration
OPIK_API_KEY=your-opik-key
OPIK_URL_OVERRIDE=https://www.comet.com/opik/api
OPIK_PROJECT_NAME=ikpa-financial-coach
OPIK_WORKSPACE_NAME=your-workspace
```

---

## Opik Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `TraceCount` | Counter | Total traces created |
| `SpanDuration` | Histogram | Time spent in each span |
| `LLMTokenUsage` | Counter | Tokens consumed per model |
| `ErrorRate` | Percentage | Failed traces / total traces |

---

## Distributed Tracing Patterns

### Pattern 1: Agent Cognitive Chain

```typescript
// Every agent follows this pattern
async function agentCognitiveChain(agentName: string, userId: string, handler: Function) {
  const trace = opikService.createTrace(`${agentName}_cognitive_chain`, { userId }, { agent: agentName });

  try {
    const result = await handler(trace);
    trace.end({ output: { success: true, ...result } });
    return result;
  } catch (error) {
    trace.end({ output: { success: false, error: error.message } });
    throw error;
  } finally {
    await opikService.flush();
  }
}
```

### Pattern 2: LLM Call Span

```typescript
async function tracedLLMCall(trace: Trace, name: string, prompt: string, model: string) {
  const span = trace.span({ name, type: 'llm', input: { prompt } });

  const response = await anthropic.messages.create({
    model,
    messages: [{ role: 'user', content: prompt }],
  });

  span.end({
    output: { response: response.content[0].text },
    metadata: {
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  });

  return response.content[0].text;
}
```

### Pattern 3: Tool Execution Span

```typescript
async function tracedToolExecution(trace: Trace, name: string, executor: Function) {
  const span = trace.span({ name, type: 'tool' });

  const startTime = Date.now();
  const result = await executor();
  const duration = Date.now() - startTime;

  span.end({
    output: result,
    metadata: { durationMs: duration },
  });

  return result;
}
```

---

## Verification

### Dashboard Check

1. Navigate to [Opik Dashboard](https://www.comet.com/opik)
2. Select workspace and project `ikpa-financial-coach`
3. Verify traces appear with correct structure:
   - Trace name: `{agent}_cognitive_chain`
   - Spans: `transaction_analysis`, `calculate_*`, `generate_*`, etc.
   - Metadata: agent, version, timestamp

### Test Trace Creation

```typescript
// Test in development
const trace = opikService.createTrace('test_trace', { test: true });
const span = trace.span({ name: 'test_span', type: 'tool' });
span.end({ output: { message: 'Test successful' } });
trace.end({ output: { success: true } });
await opikService.flush();

// Check Opik dashboard for 'test_trace'
```

### Expected Dashboard View

```
┌─────────────────────────────────────────────────────┐
│ Trace: shark_audit_cognitive_chain                  │
│ Input: { userId: "user_123" }                       │
│ Duration: 2.3s                                      │
├─────────────────────────────────────────────────────┤
│ ├── transaction_analysis (tool) - 450ms            │
│ ├── calculate_savings_potential (tool) - 12ms      │
│ ├── generate_framing (llm) - 1.8s                  │
│ │   └── tokens: 450, model: claude-sonnet          │
│ └── await_user_decision (tool) - pending           │
└─────────────────────────────────────────────────────┘
```
