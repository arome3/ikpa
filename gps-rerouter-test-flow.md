# GPS Re-Router — End-to-End Test Flow

## Test Persona

**Amara, 28 — Lagos, Nigeria**
- Monthly income: ₦450,000
- Saving for house down payment: ₦15M goal, 3-year deadline
- Budgets: Food & Dining (₦80,000/mo), Transportation (₦45,000/mo), Entertainment (₦30,000/mo)
- Has at least one active goal in the system

---

## Prerequisites

Before running through the acts, ensure:

1. A test user exists with:
   - At least 1 active goal (with `targetAmount` and `targetDate`)
   - At least 2 budget categories set up (one that will be overspent, one with surplus)
   - A financial snapshot (income, expenses, net worth)
   - Some recent expenses in the last 30 days
2. `ANTHROPIC_API_KEY` is set in `.env` (for AI agent) — or leave unset to test fallback
3. API server is running: `npm run start:dev` from `apps/api`
4. Web app is running: `npm run dev` from `apps/web`

---

## Act 1: The Trigger (Automatic Expense Detection)

**What happens:** A new expense pushes a budget category over its limit. The system detects this automatically and creates a notification.

### API Test

```bash
# 1. Create an expense that pushes Food & Dining over budget
#    Replace USER_TOKEN with a valid JWT and CATEGORY_ID with the Food & Dining category ID

curl -X POST http://localhost:3000/api/expenses \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 12000,
    "categoryId": "CATEGORY_ID",
    "description": "Dinner at restaurant",
    "date": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

### Expected Behavior

- Expense is created successfully
- `BudgetEventListener` fires on the `expense.created` event
- Budget threshold check runs for the category
- If spending crosses 80% → `BUDGET_WARNING` notification created
- If spending crosses 100% → `BUDGET_EXCEEDED` notification created
- If spending crosses 120% → `BUDGET_CRITICAL` notification created

### Verify Notification Was Created

```bash
# Check for GPS notifications
curl -X GET "http://localhost:3000/api/gps/notifications?unreadOnly=true" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Expected Response

```json
{
  "notifications": [
    {
      "id": "...",
      "type": "BUDGET_EXCEEDED",
      "title": "Budget limit reached",
      "message": "Your Food & Dining spending has crossed your budget limit.",
      "isRead": false,
      "createdAt": "..."
    }
  ],
  "total": 1
}
```

### Verify Unread Count

```bash
curl -X GET "http://localhost:3000/api/gps/notifications/unread-count" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Expected Response

```json
{
  "count": 1
}
```

---

## Act 2: The GPS Command Center

**What happens:** User opens the GPS dashboard and sees their spending velocity, active adjustments, streaks, and alert cards.

### UI Test

Navigate to: `http://localhost:3000/dashboard/gps`

### API Tests

```bash
# 1. Get spending velocity for Food & Dining
curl -X GET "http://localhost:3000/api/gps/spending-velocity/Food%20%26%20Dining" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Expected Response

```json
{
  "category": "Food & Dining",
  "categoryId": "...",
  "velocity": {
    "ratio": 1.35,
    "status": "significantly_ahead",
    "dailySpendingRate": { "amount": 5867, "formatted": "₦5,867", "currency": "NGN" },
    "safeDailyRate": { "amount": 4000, "formatted": "₦4,000", "currency": "NGN" },
    "courseCorrectionDaily": { "amount": 2133, "formatted": "₦2,133", "currency": "NGN" }
  },
  "timeline": {
    "daysElapsed": 15,
    "daysRemaining": 15,
    "projectedOverspendDate": "2026-02-12T...",
    "willOverspend": true
  },
  "budget": {
    "budgeted": { "amount": 80000, "formatted": "₦80,000", "currency": "NGN" },
    "spent": { "amount": 88000, "formatted": "₦88,000", "currency": "NGN" },
    "remaining": { "amount": -8000, "formatted": "-₦8,000", "currency": "NGN" }
  },
  "recommendations": [
    "Reduce daily spending to ₦2,133 to stay on track",
    "At current pace, budget will be exceeded around 2/12/2026"
  ]
}
```

```bash
# 2. Get active adjustments (should be empty before any recovery)
curl -X GET "http://localhost:3000/api/gps/active-adjustments" \
  -H "Authorization: Bearer $USER_TOKEN"
```

```bash
# 3. Get streak status
curl -X GET "http://localhost:3000/api/gps/streaks" \
  -H "Authorization: Bearer $USER_TOKEN"
```

```bash
# 4. Get achievements
curl -X GET "http://localhost:3000/api/gps/achievements" \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## Act 3: The AI Agent Recalculation

**What happens:** User triggers a recalculation. The AI agent gathers context via tools, runs Monte Carlo simulations, generates recovery paths, and crafts a personalized message.

### API Test

```bash
# Trigger recalculation for Food & Dining
curl -X POST http://localhost:3000/api/gps/recalculate \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "Food & Dining"
  }'
```

### Expected Response

```json
{
  "sessionId": "uuid-of-recovery-session",
  "budgetStatus": {
    "category": "Food & Dining",
    "categoryId": "...",
    "budgeted": { "amount": 80000, "formatted": "₦80,000", "currency": "NGN" },
    "spent": { "amount": 88000, "formatted": "₦88,000", "currency": "NGN" },
    "remaining": { "amount": -8000, "formatted": "-₦8,000", "currency": "NGN" },
    "overagePercent": 10,
    "trigger": "BUDGET_EXCEEDED",
    "period": "MONTHLY"
  },
  "goalImpact": {
    "goalId": "...",
    "goalName": "House Down Payment",
    "goalAmount": { "amount": 15000000, "formatted": "₦15,000,000", "currency": "NGN" },
    "goalDeadline": "2029-02-06T...",
    "previousProbability": 0.74,
    "newProbability": 0.712,
    "probabilityDrop": -0.028,
    "message": "Your goal probability decreased by 2.8 percentage points"
  },
  "multiGoalImpact": {
    "primaryGoal": { "..." : "same as goalImpact above" },
    "otherGoals": [],
    "summary": {
      "totalGoalsAffected": 1,
      "averageProbabilityDrop": -0.028,
      "mostAffectedGoal": "House Down Payment",
      "leastAffectedGoal": "House Down Payment"
    }
  },
  "recoveryPaths": [
    {
      "id": "category_rebalance",
      "name": "Smart Swap",
      "description": "Cover this with your Transportation surplus (₦6,200 available)",
      "newProbability": 0.738,
      "effort": "None",
      "rebalanceInfo": {
        "fromCategory": "Transportation",
        "fromCategoryId": "...",
        "availableSurplus": 6200,
        "coverageAmount": 6200,
        "isFullCoverage": false
      }
    },
    {
      "id": "time_adjustment",
      "name": "Timeline Flex",
      "description": "Extend your goal deadline by 2 weeks",
      "newProbability": 0.735,
      "effort": "Low",
      "timelineImpact": "+2 weeks"
    },
    {
      "id": "rate_adjustment",
      "name": "Savings Boost",
      "description": "Increase your savings rate by 5% for 4 weeks",
      "newProbability": 0.751,
      "effort": "Medium",
      "savingsImpact": "+5% for 4 weeks"
    },
    {
      "id": "freeze_protocol",
      "name": "Category Pause",
      "description": "Pause spending in Food & Dining for 4 weeks",
      "newProbability": 0.763,
      "effort": "High",
      "freezeDuration": "Pause Food & Dining for 4 weeks"
    }
  ],
  "message": {
    "tone": "Supportive",
    "headline": "Quick detour on your dining budget",
    "subtext": "You're ₦8,000 over in Food & Dining, but your house fund is still at 71% — and your Transportation surplus can cover most of it instantly."
  }
}
```

### What to Verify

| Check | With `ANTHROPIC_API_KEY` set | Without `ANTHROPIC_API_KEY` |
|-------|------------------------------|----------------------------|
| `message.headline` | Personalized, references specific categories/amounts | Generic from static template (e.g., "Let's recalculate your route") |
| `message.subtext` | References user's specific goal name, probability, category | Generic supportive text |
| Banned words | No banned words in headline or subtext | No banned words |
| Recovery paths | 3-4 paths with probabilities | Same — paths are algorithmic, not AI-dependent |
| Response time | ~8-20 seconds (Claude + blocking tone eval) | ~1-3 seconds (no LLM call) |
| Math integrity | Percentages in message match pre-computed values (±2%) | N/A — static templates don't contain dynamic numbers |

### Verify Opik Trace (if Opik is configured)

Check the Opik dashboard for a trace named `gps_rerouter_agent_trace` containing:
- `llm_turn_1` — initial reasoning
- `tool_check_budget_status` — budget data tool call
- `tool_calculate_goal_impact` — goal impact tool call
- `tool_generate_recovery_paths` — recovery paths tool call
- `tool_analyze_spending_trend` — 3-month category trend query (queries Prisma directly)
- `tool_find_rebalance_opportunities` — surplus category discovery (queries all budgets)
- `llm_turn_2` (or 3, 4) — final message generation
- `eval_financial_safety` — safety guardrail, BLOCKING (0 or 1). Score 0 = message rejected, falls back to static templates
- `eval_tone_empathy` — LLM-as-Judge tone score, BLOCKING (1-5). Must score >= 3 to pass
- `llm_tone_retry` — only appears if tone score < 3; Claude retries with tone correction feedback

**Save the `sessionId` from the response — you need it for Act 4.**

---

## Act 4: Recovery Path Selection

**What happens:** User selects a recovery path. The system executes the corresponding action (rebalance, deadline extension, savings boost, or category freeze) and emits a cross-agent event.

### UI Test

Navigate to: `http://localhost:3000/dashboard/gps/recovery/SESSION_ID`

### API Test — Select Smart Swap (category_rebalance)

```bash
# Select the Smart Swap path
curl -X POST "http://localhost:3000/api/gps/recovery-paths/category_rebalance/select" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID_FROM_ACT_3"
  }'
```

### Expected Response

```json
{
  "success": true,
  "message": "Great choice! We've activated Smart Swap.",
  "selectedPathId": "category_rebalance",
  "selectedAt": "2026-02-06T...",
  "details": {
    "fromCategory": "Transportation",
    "toCategory": "Food & Dining",
    "amount": 6200
  },
  "nextSteps": [
    "Budget moved from Transportation to Food & Dining",
    "Your savings goal remains on track",
    "Monitor both categories for the rest of this period"
  ]
}
```

### Alternative: Select Timeline Flex (time_adjustment)

```bash
curl -X POST "http://localhost:3000/api/gps/recovery-paths/time_adjustment/select" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID"
  }'
```

### Alternative: Select Savings Boost (rate_adjustment)

```bash
curl -X POST "http://localhost:3000/api/gps/recovery-paths/rate_adjustment/select" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID"
  }'
```

### Alternative: Select Category Pause (freeze_protocol)

```bash
curl -X POST "http://localhost:3000/api/gps/recovery-paths/freeze_protocol/select" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID"
  }'
```

### What to Verify

| Path | Action Executed | Database Record Created |
|------|----------------|------------------------|
| `category_rebalance` | Budget amounts rebalanced between categories | `BudgetRebalance` record |
| `time_adjustment` | Goal `targetDate` extended | Goal updated, `GpsAnalyticsEvent` with `DEADLINE_EXTENDED` |
| `rate_adjustment` | Savings rate boost activated | `SavingsRateAdjustment` record (isActive=true) |
| `freeze_protocol` | Category spending frozen | `CategoryFreeze` record (isActive=true) |

### Verify Cross-Agent Event (GPS → Future Self)

Check server logs for **both** of these messages:

**1. GPS side — event emitted:**
```
[GpsIntegrationService] [handleRecoveryPathSelected] Requesting Future Self reinforcement for user USER_ID
```

**2. Future Self side — event received:**
```
[FutureSelfCacheListener] [handleReinforcementRequested] Generating reinforcement context for user USER_ID after Smart Swap
```

This confirms:
- `future_self.reinforcement_requested` event was emitted by GPS and received by Future Self
- Recovery context stored in Redis (`gps_recovery_context:USER_ID`, 24h TTL)
- Future Self letter cache invalidated (next letter will include recovery commitment)

**Optional deep verification — request a Future Self letter after recovery path selection:**

```bash
curl -X GET "http://localhost:3000/api/future-self/letter" \
  -H "Authorization: Bearer $USER_TOKEN"
```

The letter should reference the recovery path choice (e.g., "Chose Smart Swap recovery path after budget overspend"). This context is consumed once — a second letter request won't include it.

### Verify Session Cannot Be Re-Selected

```bash
# Attempting to select again should return 409
curl -X POST "http://localhost:3000/api/gps/recovery-paths/time_adjustment/select" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID"
  }'
```

Expected: `409 Conflict` — "Session already resolved"

---

## Act 5: Ongoing Recovery Tracking

**What happens:** After selecting a path, the user tracks their recovery progress over time with milestones, streaks, and active adjustment monitoring.

### 5a. Check Session Progress

```bash
curl -X GET "http://localhost:3000/api/gps/sessions/SESSION_ID" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Expected Response

```json
{
  "id": "SESSION_ID",
  "category": "Food & Dining",
  "overspendAmount": 8000,
  "previousProbability": 0.74,
  "newProbability": 0.712,
  "selectedPathId": "category_rebalance",
  "selectedAt": "2026-02-06T...",
  "status": "PATH_SELECTED",
  "recoveryProgress": {
    "percentComplete": 25,
    "currentMilestone": "Getting started",
    "nextMilestone": "Halfway there",
    "milestones": [
      { "percent": 25, "reached": true, "message": "Great start! You're on your way." },
      { "percent": 50, "reached": false, "message": "Halfway there — keep going!" },
      { "percent": 75, "reached": false, "message": "Almost there — the finish line is in sight." },
      { "percent": 100, "reached": false, "message": "You did it! Recovery complete." }
    ]
  },
  "selectedPath": {
    "id": "category_rebalance",
    "name": "Smart Swap",
    "expectedCompletion": "2026-02-20T..."
  }
}
```

### 5b. Check Active Adjustments

```bash
curl -X GET "http://localhost:3000/api/gps/active-adjustments" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Expected Response (after selecting rate_adjustment)

```json
{
  "savingsAdjustment": {
    "id": "...",
    "sessionId": "SESSION_ID",
    "originalRate": 0.15,
    "additionalRate": 0.05,
    "effectiveRate": 0.20,
    "durationWeeks": 4,
    "startDate": "2026-02-06T...",
    "endDate": "2026-03-06T...",
    "daysRemaining": 28
  },
  "categoryFreezes": [],
  "timelineExtensions": [],
  "budgetRebalances": [],
  "summary": {
    "totalActiveFreezes": 0,
    "totalActiveBoosts": 1,
    "totalTimelineExtensions": 0,
    "estimatedMonthlySavings": { "amount": 0, "formatted": "$0", "currency": "USD" },
    "estimatedRecoveryDate": "2026-03-06T..."
  },
  "hasActiveAdjustments": true
}
```

### 5c. Check if Category Is Frozen (after selecting freeze_protocol)

```bash
curl -X GET "http://localhost:3000/api/gps/active-adjustments/frozen/Food%20%26%20Dining" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Expected Response

```json
{
  "categoryId": "...",
  "categoryName": "Food & Dining",
  "isFrozen": true,
  "freezeDetails": {
    "startDate": "2026-02-06T...",
    "endDate": "2026-03-06T...",
    "daysRemaining": 28,
    "reason": "Category frozen as part of recovery action (Session: SESSION_ID)"
  }
}
```

### 5d. Check Streaks

```bash
curl -X GET "http://localhost:3000/api/gps/streaks" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### 5e. Mark Notifications as Read

```bash
# Mark specific notification
curl -X POST "http://localhost:3000/api/gps/notifications/NOTIFICATION_ID/read" \
  -H "Authorization: Bearer $USER_TOKEN"

# Or mark all as read
curl -X POST "http://localhost:3000/api/gps/notifications/read-all" \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## Bonus: What-If Simulator (Pre-Purchase Decision Support)

**What happens:** Before making a purchase, the user previews the impact on their budget and goals.

### API Test

```bash
curl -X POST http://localhost:3000/api/gps/what-if \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "Food & Dining",
    "additionalSpend": 15000
  }'
```

### Expected Response

```json
{
  "category": "Food & Dining",
  "simulatedAmount": 15000,
  "budgetImpact": {
    "budgetAmount": 80000,
    "currentSpending": 88000,
    "projectedSpending": 103000,
    "currentPercentUsed": 110,
    "projectedPercentUsed": 129,
    "remainingAfterSpend": -23000
  },
  "probabilityImpact": {
    "goalId": "...",
    "goalName": "House Down Payment",
    "currentProbability": 0.712,
    "projectedProbability": 0.681,
    "probabilityChange": -0.031,
    "changePercentPoints": -3
  },
  "triggerPreview": {
    "wouldTrigger": true,
    "triggerLevel": "BUDGET_CRITICAL",
    "description": "This would put you at 129% of your budget - well over the limit."
  },
  "recoveryPreview": [
    { "id": "time_adjustment", "name": "Timeline Flex", "..." : "..." },
    { "id": "rate_adjustment", "name": "Savings Boost", "..." : "..." },
    { "id": "freeze_protocol", "name": "Category Pause", "..." : "..." }
  ],
  "recommendation": "This purchase would significantly impact your budget and goal probability. Consider alternatives or delaying.",
  "severity": "high"
}
```

### UI Test

Navigate to: `http://localhost:3000/dashboard/gps/what-if`

1. Select "Food & Dining" from the category dropdown
2. Enter ₦15,000 as the amount
3. Tap "Simulate"
4. Verify the impact visualization shows budget and probability changes
5. Verify recovery preview paths are shown
6. Verify severity is displayed (low/medium/high)

---

## Graceful Degradation Test

**Purpose:** Verify the system works identically without an API key — the only difference should be generic vs personalized messages.

### Steps

1. Stop the API server
2. Remove or comment out `ANTHROPIC_API_KEY` from `.env`
3. Restart the API server
4. Re-run the Act 3 recalculate call
5. Verify:
   - Response structure is identical
   - `message.headline` is from the static template list (e.g., "Let's recalculate your route")
   - `message.subtext` is from the static template list
   - All recovery paths, probabilities, and goal impacts are unchanged
   - No errors in server logs (just a warning: "AI agent failed, falling back to static templates")

---

## Analytics Verification

After running all acts, verify analytics were captured.

```bash
# System-wide dashboard
curl -X GET "http://localhost:3000/api/gps/analytics/dashboard?days=30" \
  -H "Authorization: Bearer $USER_TOKEN"

# Personal analytics
curl -X GET "http://localhost:3000/api/gps/analytics/me?days=30" \
  -H "Authorization: Bearer $USER_TOKEN"

# Category breakdown
curl -X GET "http://localhost:3000/api/gps/analytics/categories?days=30" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Expected Analytics Data

- `totalSessions` >= 1
- `pathSelectionDistribution` shows the path you selected
- `goalSurvivalRate` > 0 (at least one session was resolved)
- Personal analytics show your recovery history

---

## Bonus: Evaluation Dataset Runner

**Purpose:** Run the 20-scenario evaluation batch to baseline agent message quality. This is a code-level test, not an API call.

### How to Run

From a test file or script:

```typescript
import { GpsEvalRunner, GPS_EVAL_DATASET } from './modules/gps/agents';

// Requires a running NestJS app context with injected services
const runner = new GpsEvalRunner(agent, metricsService);
const report = await runner.runBatch(GPS_EVAL_DATASET);

console.log(`Pass rate: ${(report.summary.passRate * 100).toFixed(1)}%`);
console.log(`Avg tone: ${report.summary.avgToneScore.toFixed(2)}/5`);
console.log(`Failed: ${report.summary.failedScenarios.join(', ')}`);
```

### Expected Baseline

| Metric | Target |
|--------|--------|
| Pass rate | >= 80% (16/20 scenarios) |
| Average tone score | >= 3.5/5 |
| Hallucinated percentages | Zero scenarios |
| GPS metaphor usage | All scenarios use at least one GPS-related word |

### Scenarios Covered

The 20 scenarios cover these edge cases:
- Mild warnings (80% threshold) through critical overspend (300% of budget)
- Goal probability dropping to 0%
- Small budget + high percentage vs large budget + low percentage
- Multiple currencies (NGN, USD, GBP)
- Very short deadlines (1 month) vs very long deadlines (20 years)
- Already-low probability users (extra empathy needed)
- Zero-budget edge case
- Near-perfect probability with small dip (reassuring tone)
