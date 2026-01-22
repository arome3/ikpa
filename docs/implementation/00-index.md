# IKPA Implementation Guides - Master Index

**Hackathon:** Commit to Change: An AI Agents Hackathon
**Timeline:** 4 weeks (January 13 - February 10, 2026)
**Maximum Prize:** $10,000

---

## Visual Dependency Graph

```
                           ┌─────────────────────────┐
                           │   01-opik-integration   │
                           │      (Foundation)       │
                           └───────────┬─────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│ 02-cash-flow-score  │  │ 06-commitment-device│  │  09-g-eval-metrics  │
│      (Week 1)       │  │      (Week 2)       │  │      (Week 3)       │
└──────────┬──────────┘  └─────────────────────┘  └──────────┬──────────┘
           │                                                  │
           ▼                                                  ▼
┌─────────────────────┐                          ┌─────────────────────┐
│ 03-simulation-engine│                          │  11-opik-optimizer  │
│      (Week 1)       │                          │     (Week 2-3)      │
└──────────┬──────────┘                          └─────────────────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌──────────┐  ┌─────────────────────┐
│04-shark- │  │  05-gps-rerouter    │
│ auditor  │  │      (Week 2)       │
│ (Week 2) │  └──────────┬──────────┘
└──────────┘             │
                         ▼
              ┌─────────────────────┐
              │   07-future-self    │
              │      (Week 3)       │
              └──────────┬──────────┘
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
     ▼                   ▼                   ▼
┌──────────┐  ┌─────────────────┐  ┌─────────────────┐
│08-ubuntu-│  │  10-story-cards │  │ 06-commitment-  │
│ manager  │  │     (Week 3)    │  │ device (linked) │
│ (Week 3) │  └─────────────────┘  └─────────────────┘
└──────────┘
```

---

## Quick Reference Table

| # | Feature | Week | Tier | Depends On | Failure Mode Defeated |
|---|---------|------|------|------------|----------------------|
| [01](./01-opik-integration.md) | Opik Integration | 1 | 1 | None | All (Foundation) |
| [02](./02-cash-flow-score.md) | Cash Flow Score | 1 | 1 | 01 | Foundation Metric |
| [03](./03-simulation-engine.md) | Simulation Engine | 1 | 1 | 01, 02 | Foundation Metric |
| [04](./04-shark-auditor.md) | Shark Auditor | 2 | 1-2 | 01 | Invisible Leakage |
| [05](./05-gps-rerouter.md) | GPS Re-Router | 2 | 2 | 03 | Failure Spiral |
| [06](./06-commitment-device.md) | Commitment Device | 2 | 1 | 01 | Commitment Decay |
| [07](./07-future-self.md) | Future Self Simulator | 3 | 1 | 03 | Temporal Disconnect |
| [08](./08-ubuntu-manager.md) | Ubuntu Manager | 3 | 2 | 02 | Cultural Blindness |
| [09](./09-g-eval-metrics.md) | G-Eval Metrics | 3 | 1-2 | 01 | All (Evaluation) |
| [10](./10-story-cards.md) | Story Cards | 3 | Addon | 06, 07 | Viral Growth |
| [11](./11-opik-optimizer.md) | Opik Optimizer | 2-3 | 2-3 | 09 | Prompt Evolution |

---

## Implementation Order (Recommended)

### Phase 1: Foundation (Week 1)
1. **[01-opik-integration.md](./01-opik-integration.md)** - Start here. All other features depend on tracing.
2. **[02-cash-flow-score.md](./02-cash-flow-score.md)** - Primary financial health metric.
3. **[03-simulation-engine.md](./03-simulation-engine.md)** - Powers Future Self visualizations.

### Phase 2: Core Agents (Week 2)
4. **[04-shark-auditor.md](./04-shark-auditor.md)** - Subscription detection (viral demo moment).
5. **[05-gps-rerouter.md](./05-gps-rerouter.md)** - Recovery path generation.
6. **[06-commitment-device.md](./06-commitment-device.md)** - Stakes and accountability system.

### Phase 3: Differentiation (Week 3)
7. **[07-future-self.md](./07-future-self.md)** - Letter from 2045 generator.
8. **[08-ubuntu-manager.md](./08-ubuntu-manager.md)** - Africa differentiation.
9. **[09-g-eval-metrics.md](./09-g-eval-metrics.md)** - LLM evaluation metrics.
10. **[10-story-cards.md](./10-story-cards.md)** - Shareable social content.
11. **[11-opik-optimizer.md](./11-opik-optimizer.md)** - Prompt evolution (winning edge).

---

## MVP Tiers

### Tier 1: Must Ship (Demo-Critical)
- Cash Flow Score
- Simulation Engine (Dual-Path)
- Future Self Letter Generator
- Commitment Device Engine
- Opik Distributed Tracing
- One G-Eval Metric (ToneEmpathy)

### Tier 2: Should Ship (High Impact)
- Tinder-Style Subscription Swiper
- GPS Recovery Paths
- Dependency Ratio + Risk Gauge
- Opik Optimizer Experiment

### Tier 3: Cut If Behind
- GEPA Tool Optimization
- Full A/B Testing Pipeline
- Push Notifications
- Time Slider Animation

---

## Critical Codebase Paths

| Purpose | Path |
|---------|------|
| API Entry | `apps/api/src/main.ts` |
| Root Module | `apps/api/src/app.module.ts` |
| DB Schema | `apps/api/prisma/schema.prisma` |
| Auth Pattern | `apps/api/src/modules/auth/` |
| Common Utils | `apps/api/src/common/` |
| Shared Types | `packages/shared/src/types/` |
| AI Agents | `apps/api/src/modules/ai/agents/` |
| Opik Services | `apps/api/src/modules/ai/opik/` |
| Finance Calculators | `apps/api/src/modules/finance/calculators/` |

---

## Checkpoints

| Day | Action |
|-----|--------|
| **Day 14** | If behind, cut Tier 3 entirely |
| **Day 21** | If still behind, simplify Tier 2 |
| **Day 25** | Feature freeze - polish only |
| **Day 27** | Record demo video |
| **Day 28** | Submit |

---

## Five Failure Modes → Five Agents

| Failure Mode | Agent | Description |
|--------------|-------|-------------|
| Invisible Leakage | Shark Auditor | Finds zombie subscriptions |
| Failure Spiral | GPS Re-Router | Turns slips into recalculations |
| Temporal Disconnect | Future Self Simulator | Connects present to future self |
| Cultural Blindness | Ubuntu Manager | Respects family obligations |
| Commitment Decay | Commitment Device | Creates real stakes |

---

*Navigate to individual guides using the links above. Each guide contains complete TypeScript code, API routes, Opik metrics, and verification commands.*
