# GPS Re-Router API - Test Report & Status

**Date:** 2026-02-02 | **Version:** v1 | **Currency:** USD

---

## What is GPS Re-Router?

GPS Re-Router is a **behavioral economics feature** that helps users recover when they overspend their budget. Instead of showing "you failed," it offers recovery paths that adjust savings rates, freeze spending categories, or extend goal timelines.

**Core Flow:**
1. User overspends in a budget category
2. System calculates probability impact on financial goals
3. User is offered 3 recovery paths (behavioral interventions)
4. User selects a path → system tracks recovery progress

---

## Endpoint Status

| Endpoint | Status | Issue |
|----------|--------|-------|
| `GET /analytics/dashboard` | Working | - |
| `GET /analytics/me` | Working | Returns zeros for new users |
| `GET /analytics/categories` | Working | - |
| `GET /active-adjustments` | Working | - |
| `GET /active-adjustments/frozen/:categoryId` | Working | Fuzzy matching enabled |
| `GET /recovery-paths` | Blocked | Requires exceeded budget |
| `POST /recovery-paths/:pathId/select` | Blocked | Requires valid session |
| `GET /sessions/:sessionId` | Blocked | Requires valid session |
| `POST /recalculate` | Blocked | Requires goal + budget setup |

**5 of 9 endpoints functional** - Core recovery flow requires user to have budget data with overspending.

---

## Key Findings

### 1. System Analytics (30-day period)

| Metric | Value | Insight |
|--------|-------|---------|
| Total slip events | 14 | Users are overspending |
| Recovery rate | 50% | Half of slips have recovery action |
| Abandonment rate | 0% | No one is giving up entirely |
| Pending sessions | 7 | Users who haven't chosen a path yet |

**Interpretation:** Users engage with recovery options when prompted. Zero abandonment suggests the feature provides value rather than frustration.

### 2. Recovery Path Preferences

| Path | Usage | Description |
|------|-------|-------------|
| Category Pause | 42.86% | Freeze the overspent category temporarily |
| Timeline Flex | 28.57% | Extend goal deadline |
| Savings Boost | 28.57% | Increase savings rate temporarily |

**Interpretation:** Users prefer immediate behavioral constraints (freezing a category) over timeline or savings adjustments. This aligns with behavioral economics research on commitment devices.

### 3. Problem Categories

| Category | Slips | Recovery Rate | Total Overspend |
|----------|-------|---------------|-----------------|
| Food & Dining | 7 | 57% | $900.00 |
| food-dining | 4 | 25% | $100.00 |
| Entertainment | 1 | 100% | $0.00 |
| Shopping | 1 | 100% | $0.00 |

**Data Quality Issue:** "Food & Dining" and "food-dining" are the same category with inconsistent naming. This inflates category count and fragments analytics.

### 4. Recovery Speed

All 7 recoveries happened within 1 hour of the slip event. Users make decisions quickly when prompted.

---

## Issues Identified

### Critical

1. **Category Naming Inconsistency**
   - "Food & Dining" vs "food-dining" vs "Entertainment" vs "entertainment"
   - Causes fragmented analytics and confusing reports
   - **Fix:** Normalize category IDs on ingestion

2. **Recovery Flow Requires Pre-existing Budget Overage**
   - Cannot test path selection without real overspending data
   - New users see error: `"Missing: exceeded budget"`
   - **Impact:** Onboarding users can't see the feature

### Minor

3. **Fuzzy Matching Works But Returns `isFrozen: false` for Unknown Categories**
   - When user types "entertanment", system suggests "Entertainment"
   - But also returns `isFrozen: false` which is misleading for non-existent categories
   - **Suggestion:** Return clearer status like `categoryExists: false`

---

## API Reference (Correct Paths)

### Analytics Endpoints
```
GET /v1/gps/analytics/dashboard     # System-wide metrics
GET /v1/gps/analytics/me            # Current user's recovery history
GET /v1/gps/analytics/categories    # Per-category breakdown
```

### Active Adjustments
```
GET /v1/gps/active-adjustments                    # All active recovery actions
GET /v1/gps/active-adjustments/frozen/:categoryId # Check if category is frozen
```

### Recovery Flow (requires overspent budget)
```
GET  /v1/gps/recovery-paths                    # Get available paths
POST /v1/gps/recovery-paths/:pathId/select     # Select a recovery path
GET  /v1/gps/sessions/:sessionId               # Get session details
POST /v1/gps/recalculate                       # Recalculate after new spending
```

---

## Sample Responses

### User Analytics (`/analytics/me`)
```json
{
  "totalSlips": 0,
  "recoveryRate": 0,
  "recoveryRateFormatted": "0%",
  "preferredPath": null,
  "averageTimeToRecovery": {
    "hours": 0,
    "formatted": "No data"
  },
  "totalProbabilityRestored": 0
}
```

### Fuzzy Matching (`/active-adjustments/frozen/entertanment`)
```json
{
  "categoryId": "entertanment",
  "categoryName": "entertanment",
  "isFrozen": false,
  "suggestions": [
    { "id": "entertainment", "name": "Entertainment" }
  ],
  "didYouMean": "Category 'entertanment' not found. Did you mean \"Entertainment\"?"
}
```

### MonetaryValue Format
```json
{
  "estimatedMonthlySavings": {
    "amount": 0,
    "formatted": "$0",
    "currency": "USD"
  }
}
```

---

## Recommendations

1. **Fix category normalization** - Critical for accurate analytics
2. **Add demo/sandbox mode** - Let users explore recovery paths without real overspending
3. **Track "pending" sessions** - 7 users haven't chosen a path; consider nudge notifications
4. **Food & Dining intervention** - Highest slip count + lowest recovery rate = opportunity for targeted UX

---

*Report generated from live API testing on 2026-02-02*
