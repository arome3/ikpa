# GPS Re-Router: Product Review & Gap Analysis

**Date:** February 4, 2026
**Reviewer:** Senior Product Manager
**Status:** Backend Complete, Frontend Missing, Critical Gaps Identified

---

## Executive Summary

The GPS Re-Router is IKPA's flagship behavioral economics feature designed to combat the **"What-The-Hell Effect"** - where one budget slip causes users to abandon their financial goals entirely. Instead of judgmental "you failed" messaging, it reframes overspending as "taking a wrong turn" that can be recalculated.

### Current State

| Layer | Status | Completion |
|-------|--------|------------|
| **Backend API** | ✅ Production-Ready | 95% |
| **Database Models** | ✅ Complete | 100% |
| **Event System** | ✅ Functional | 90% |
| **Frontend UI** | ❌ Not Built | 0% |
| **Expense Entry** | ⚠️ Import-Only | 40% |
| **End-to-End Flow** | ❌ Broken | 20% |

**Bottom Line:** The sophisticated backend sits unused because users have no way to interact with it.

---

## 1. What Works (Backend Strengths)

### 1.1 Core GPS Engine
```
POST /gps/recalculate → Detects overspend, calculates goal impact, generates 3 recovery paths
GET  /gps/recovery-paths → Retrieves available paths
POST /gps/recovery-paths/:pathId/select → Executes chosen recovery action
```

**Features:**
- ✅ Monte Carlo simulation for goal probability calculation
- ✅ Multi-goal impact assessment (affects ALL goals, not just one)
- ✅ Three recovery paths with different effort levels:
  - **Timeline Flex** (Low effort) - Extend goal deadline
  - **Savings Boost** (Medium effort) - Temporarily increase savings rate
  - **Category Pause** (High effort) - Freeze spending in category
- ✅ Non-judgmental messaging with banned word validation
- ✅ Recovery session tracking with progress milestones

### 1.2 Notification System
```
GET  /gps/notifications → Proactive budget alerts
GET  /gps/notifications/unread-count → Badge count for UI
POST /gps/notifications/:id/read → Mark as read
```

**Features:**
- ✅ Automatic alerts at 80%, 100%, 120% budget thresholds
- ✅ Fatigue prevention (max 5/day, no duplicates within 24h)
- ✅ Non-judgmental tone templates
- ✅ Deep links to recovery paths

### 1.3 Gamification
```
GET /gps/streaks → Days under budget streak
GET /gps/achievements → Earned badges
```

**Features:**
- ✅ Streak tracking with freeze protection
- ✅ Achievement system (7-day streak, first recovery, etc.)
- ✅ Progress milestones (25%, 50%, 75%, 100%)

### 1.4 Analytics
```
GET /gps/analytics/dashboard → System metrics
GET /gps/analytics/me → Personal recovery history
GET /gps/analytics/categories → Per-category analysis
```

### 1.5 What-If Simulator
```
POST /gps/what-if → Preview impact before spending
```

**Features:**
- ✅ Read-only simulation (no database changes)
- ✅ Shows budget impact and goal probability change
- ✅ Recommends action based on severity

---

## 2. Critical Gaps

### 2.1 🚨 NO EXPENSE ENTRY SYSTEM

**The Problem:**
The GPS triggers when expenses exceed budgets. But users have **no way to manually enter expenses**.

**Current State:**
```
Expense Entry Methods:
├── Bank Statement Import (CSV/PDF) ✅ Works
├── Screenshot/Receipt Upload ✅ Works
├── Email Forwarding ✅ Works
└── Manual Entry ❌ DOES NOT EXIST
```

**Impact:**
- Users must import data to trigger GPS
- Real-time expense tracking impossible
- GPS alerts delayed until next import
- Completely breaks the "catch overspending early" value proposition

**Required:**
```
POST /finance/expenses → Create expense
GET  /finance/expenses → List expenses
PATCH /finance/expenses/:id → Update expense
DELETE /finance/expenses/:id → Delete expense
```

### 2.2 🚨 NO FRONTEND GPS MODULE

**The Problem:**
16 sophisticated API endpoints exist with zero frontend UI.

**Missing Pages:**

| Page | Purpose | Priority |
|------|---------|----------|
| `/dashboard/gps` | GPS command center | P0 |
| `/dashboard/gps/recovery/:sessionId` | Recovery path selection | P0 |
| `/dashboard/gps/sessions` | Recovery history | P1 |
| `/dashboard/gps/what-if` | Spending simulator | P1 |
| `/dashboard/gps/streaks` | Streak & achievements | P2 |
| `/dashboard/notifications` | Alert center | P0 |

### 2.3 🚨 DISCONNECTED BUDGET PAGE

**The Problem:**
The `/dashboard/finance/budgets` page shows budgets and overspend status, but:
- ❌ Does NOT link to GPS recovery
- ❌ Does NOT show "Recalculate" button
- ❌ Does NOT display recovery paths
- ❌ Does NOT integrate notifications

**Required Integration:**
```tsx
// When budget is over 80%
<Button onClick={() => triggerRecalculate(category)}>
  Recalculate Route
</Button>
```

### 2.4 ⚠️ EXPENSE CATEGORIES MISMATCH

**The Problem:**
Budget categories and expense categories must match for GPS to work.

**Current State:**
- ExpenseCategory table exists with defaults
- Budgets reference categories by ID
- GPS queries by category NAME (potential mismatch)

**Required:**
- Verify category ID/name consistency
- Add expense category selector to expense entry

---

## 3. Data Flow Analysis

### Current Flow (Broken)
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Import Module   │────▶│ Expense Created │────▶│ Event Emitted   │
│ (CSV/PDF/Image) │     │ (in database)   │     │ expense.created │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┘
                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Budget Listener │────▶│ Check Threshold │────▶│ Create Alert    │
│ (event handler) │     │ (80/100/120%)   │     │ (notification)  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ❌ STOPS HERE - NO FRONTEND      │
                        ┌────────────────────────────────┘
                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Notifications   │     │ Recovery Paths  │     │ Action Executed │
│ (sits in DB)    │     │ (never shown)   │     │ (never called)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Required Flow (Complete)
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ EXPENSE ENTRY   │────▶│ Expense Created │────▶│ Event Emitted   │
│ Manual + Import │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┘
                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Budget Check    │────▶│ Threshold Hit   │────▶│ Notification    │
│                 │     │ (80%+)          │     │ Created         │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┘
                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ FRONTEND ALERT  │────▶│ User Clicks     │────▶│ Recovery UI     │
│ Bell icon badge │     │ "See Options"   │     │ Shows 3 paths   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┘
                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ User Selects    │────▶│ Action Executed │────▶│ Progress Track  │
│ Path (1 of 3)   │     │ (DB updated)    │     │ (milestones)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 4. Implementation Roadmap

### Phase 1: Critical Path (Must Have)
**Goal:** Make GPS minimally functional end-to-end

#### 1.1 Expense Entry Module
```
Backend:
├── POST   /finance/expenses
├── GET    /finance/expenses
├── GET    /finance/expenses/:id
├── PATCH  /finance/expenses/:id
├── DELETE /finance/expenses/:id
└── Event emission on create/update

Frontend:
├── /dashboard/expenses (list view)
├── Quick-add expense modal
└── Category selector with budget warnings
```

**Why First:** Without expense entry, GPS cannot trigger.

#### 1.2 GPS Recovery UI
```
Frontend:
├── /dashboard/gps (command center)
│   ├── Current budget status cards
│   ├── Active alerts
│   └── "Recalculate" CTA
│
├── /dashboard/gps/recovery/:sessionId
│   ├── Non-judgmental message
│   ├── Goal impact visualization
│   ├── 3 recovery path cards
│   └── Path selection with confirmation
│
└── Recovery success animation
```

#### 1.3 Notification Integration
```
Frontend:
├── Bell icon in dashboard header
├── Unread count badge
├── Notification dropdown/panel
├── Click → Navigate to recovery
└── Mark as read on view
```

#### 1.4 Budget Page Integration
```
Frontend (modify existing):
├── Add "Over Budget" alert banner
├── "Recalculate Route" button when >80%
└── Link to recovery session
```

### Phase 2: Enhanced Experience (Should Have)

#### 2.1 What-If Simulator
```
/dashboard/gps/what-if
├── Category selector
├── Amount input slider
├── Real-time impact preview
├── "If I spend ₦X on Food..."
└── Shows: budget %, goal probability change
```

#### 2.2 Streaks & Achievements
```
/dashboard/gps/achievements
├── Current streak display
├── Streak history chart
├── Achievement badges grid
└── Share to social (optional)
```

#### 2.3 Recovery History
```
/dashboard/gps/sessions
├── Past recovery sessions
├── Which paths were chosen
├── Success rate analytics
└── "You recovered 5 times this year!"
```

### Phase 3: Delight Features (Nice to Have)

#### 3.1 Smart Expense Entry
- Receipt scanning with category auto-detect
- Voice input: "Spent 5k on lunch"
- Widget for quick logging

#### 3.2 Predictive Alerts
- "At current pace, you'll exceed Food budget in 3 days"
- Weekly spending forecast

#### 3.3 Social Features
- Share recovery wins
- Community challenges
- Accountability partners

---

## 5. Technical Requirements

### 5.1 New API Endpoints Needed

```typescript
// Expense CRUD (NEW MODULE)
POST   /v1/finance/expenses
GET    /v1/finance/expenses
GET    /v1/finance/expenses/:id
PATCH  /v1/finance/expenses/:id
DELETE /v1/finance/expenses/:id

// Expense Categories (may exist, verify)
GET    /v1/finance/expense-categories
```

### 5.2 Frontend Hooks Needed

```typescript
// New hooks to create
useGps()           // Core GPS operations
useNotifications() // Alert system
useExpenses()      // Expense CRUD
useStreaks()       // Gamification
useWhatIf()        // Simulator
```

### 5.3 State Management

```typescript
// Zustand stores needed
gpsStore: {
  activeSessions: RecoverySession[]
  notifications: Notification[]
  unreadCount: number
  streaks: StreakData
}

expenseStore: {
  recentExpenses: Expense[]
  categories: Category[]
}
```

### 5.4 Real-time Updates (Optional but Recommended)

```typescript
// WebSocket events for live updates
BUDGET_THRESHOLD_CROSSED → Show toast + update bell
RECOVERY_MILESTONE_REACHED → Show celebration
STREAK_UPDATED → Update streak display
```

---

## 6. Success Metrics

### Primary KPIs
| Metric | Target | Measurement |
|--------|--------|-------------|
| Recovery Path Selection Rate | >60% | Users who see paths and select one |
| Goal Retention After Slip | >80% | Users who don't abandon goals after overspend |
| Time to Recovery Action | <24h | Hours from alert to path selection |

### Secondary KPIs
| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily Expense Entry Rate | >3/day | Manual expenses logged per user |
| Notification Open Rate | >50% | Alerts that lead to app open |
| Streak Length Average | >14 days | Average consecutive days under budget |
| What-If Usage | >2/week | Simulator sessions per user |

---

## 7. Risk Assessment

### High Risk
| Risk | Mitigation |
|------|------------|
| Users don't enter expenses | Make entry frictionless (1-tap, voice) |
| Notification fatigue | Already limited to 5/day, but monitor |
| Path selection paralysis | Default recommendation, clear effort labels |

### Medium Risk
| Risk | Mitigation |
|------|------------|
| Category mismatch bugs | Strict category validation |
| Simulation accuracy | Calibrate Monte Carlo with real data |
| Gamification feels hollow | Tie achievements to real progress |

---

## 8. Immediate Action Items

### This Sprint (P0)
1. [ ] Build expense entry API endpoints
2. [ ] Build expense entry frontend page
3. [ ] Build GPS recovery UI (3 pages)
4. [ ] Add notification bell to dashboard header
5. [ ] Connect budget page to GPS recovery

### Next Sprint (P1)
6. [ ] Build What-If simulator
7. [ ] Build streaks/achievements page
8. [ ] Add quick-expense widget to dashboard
9. [ ] Build recovery history page

### Backlog (P2)
10. [ ] Receipt scanning integration
11. [ ] Voice expense entry
12. [ ] Predictive alerts
13. [ ] Social sharing

---

## 9. Appendix: Existing Backend Endpoints

### GPS Module (16 endpoints)
```
POST /gps/recalculate
GET  /gps/recovery-paths
POST /gps/recovery-paths/:pathId/select
GET  /gps/sessions/:sessionId
POST /gps/what-if
GET  /gps/analytics/dashboard
GET  /gps/analytics/me
GET  /gps/analytics/categories
GET  /gps/streaks
GET  /gps/achievements
GET  /gps/notifications
GET  /gps/notifications/unread-count
POST /gps/notifications/:id/read
POST /gps/notifications/read-all
GET  /gps/active-adjustments
GET  /gps/active-adjustments/frozen/:categoryId
```

### Finance Module (Existing)
```
Income:      GET/POST/PATCH/DELETE /finance/income
Savings:     GET/POST/PATCH/DELETE /finance/savings
Investments: GET/POST/PATCH/DELETE /finance/investments
Debts:       GET/POST/PATCH/DELETE /finance/debts
Goals:       GET/POST/PATCH/DELETE /finance/goals
Budgets:     GET/POST/PATCH/DELETE /finance/budgets
Categories:  GET /finance/categories
```

### Import Module (Existing)
```
POST /import/statement      (CSV/PDF upload)
POST /import/screenshots    (Receipt images)
POST /import/email/generate (Get unique email)
GET  /import/jobs           (Import history)
```

---

## Conclusion

The GPS Re-Router has a **world-class backend** implementing sophisticated behavioral economics principles. However, it's currently a "tree falling in the forest" - all that power with no one to hear it.

**The path forward is clear:**
1. **Expense entry** - Users need to log spending
2. **GPS frontend** - Users need to see and interact with recovery
3. **Notification UI** - Users need to receive alerts
4. **Budget integration** - Connect existing pages to GPS

With these pieces connected, IKPA will have a truly differentiated product that helps users recover from financial slips instead of abandoning their goals.

---

*Review completed. Ready for implementation planning.*
