# IKPA Five-Agent AI Orchestra - API Testing Results

**Test Date**: 2026-01-31 (Re-tested with verified user account)
**Base URL**: `http://localhost:8007/v1`
**Swagger Docs**: `http://localhost:8007/docs`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Agent 1: Shark Auditor](#2-agent-1-shark-auditor)
3. [Agent 2: GPS Re-Router](#3-agent-2-gps-re-router)
4. [Agent 3: Commitment Device Engine](#4-agent-3-commitment-device-engine)
5. [Agent 4: Future Self Simulator](#5-agent-4-future-self-simulator)
6. [Agent 5: Ubuntu Manager](#6-agent-5-ubuntu-manager)

---

## 1. Authentication

### POST /auth/register
**Description**: Register a new user account

```bash
curl -X POST http://localhost:8007/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@ikpa.app",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### POST /auth/login
**Description**: Login to get JWT tokens

```bash
curl -X POST http://localhost:8007/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@ikpa.app",
    "password": "SecurePass123!"
  }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

## 2. Agent 1: Shark Auditor

**Purpose**: Hunt zombie subscriptions and forgotten recurring charges

### GET /v1/shark/subscriptions
**Description**: Get all detected subscriptions with annualized framing

```bash
curl -X GET "http://localhost:8007/v1/v1/shark/subscriptions" \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PASSED`
**Response**:
```json
{
  "success": true,
  "data": {
    "subscriptions": [],
    "summary": {
      "totalSubscriptions": 0,
      "zombieCount": 0,
      "activeCount": 0,
      "unknownCount": 0,
      "totalMonthlyCost": 0,
      "zombieMonthlyCost": 0,
      "potentialAnnualSavings": 0,
      "currency": "NGN"
    },
    "pagination": {
      "total": 0,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  },
  "timestamp": "2026-01-31T15:15:37.440Z"
}
```
**Note**: API endpoint is functional. Returns empty subscriptions list for user with no detected subscriptions. Response includes summary with counts and potential savings calculations.

---

### GET /v1/shark/subscriptions/:id
**Description**: Get a single subscription by ID

```bash
curl -X GET "http://localhost:8007/v1/v1/shark/subscriptions/<subscription-id>" \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PENDING`
**Response**:
```json

```

---

### POST /v1/shark/audit
**Description**: Trigger a manual subscription audit (Rate limited: 3/hour)

```bash
curl -X POST http://localhost:8007/v1/v1/shark/audit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "force": true }'
```

**Status**: `PASSED`
**Response**:
```json
{
  "success": false,
  "error": {
    "code": "SHARK_8002",
    "message": "Insufficient recurring expense data. At least 2 recurring expenses are needed to detect subscriptions. Please add more expense records.",
    "details": {
      "minRequired": 2
    }
  },
  "timestamp": "2026-01-31T15:15:54.324Z"
}
```
**Note**: API endpoint is functional. Returns business validation error indicating minimum 2 recurring expenses are required before audit can run. This is expected behavior for a new user with no expense data.

---

### POST /v1/shark/swipe
**Description**: Record a swipe decision (KEEP, CANCEL, REVIEW_LATER)

```bash
curl -X POST http://localhost:8007/v1/v1/shark/swipe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "<subscription-id>",
    "action": "CANCEL"
  }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### POST /v1/shark/subscriptions/:id/cancel
**Description**: Process subscription cancellation

```bash
curl -X POST http://localhost:8007/v1/v1/shark/subscriptions/<subscription-id>/cancel \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "Not using anymore" }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

## 3. Agent 2: GPS Re-Router

**Purpose**: Recalculate paths when users exceed budget (prevent "What-The-Hell Effect")

### POST /v1/gps/recalculate
**Description**: Recalculate goal probability after budget exceed (Rate limited: 5/min)

```bash
curl -X POST http://localhost:8007/v1/v1/gps/recalculate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "Entertainment",
    "goalId": "<goal-id>"
  }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### GET /v1/gps/recovery-paths
**Description**: Get available recovery paths

```bash
curl -X GET "http://localhost:8007/v1/v1/gps/recovery-paths?sessionId=<session-id>" \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PENDING`
**Response**:
```json

```

---

### POST /v1/gps/recovery-paths/:pathId/select
**Description**: Select a recovery path (time_adjustment, rate_adjustment, freeze_protocol)

```bash
curl -X POST http://localhost:8007/v1/v1/gps/recovery-paths/time_adjustment/select \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "sessionId": "<session-id>" }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### GET /v1/gps/sessions/:sessionId
**Description**: Get recovery session details

```bash
curl -X GET "http://localhost:8007/v1/v1/gps/sessions/<session-id>" \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PENDING`
**Response**:
```json

```

---

### GET /v1/gps/analytics/dashboard
**Description**: Get system-wide GPS analytics dashboard

```bash
curl -X GET "http://localhost:8007/v1/v1/gps/analytics/dashboard?days=30" \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PASSED`
**Response**:
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-01-01T15:23:12.732Z",
      "end": "2026-01-31T15:23:12.732Z"
    },
    "pathSelection": [],
    "goalSurvival": {
      "totalSlips": 0,
      "recovered": 0,
      "abandoned": 0,
      "pending": 0,
      "survivalRate": 0
    },
    "timeToRecovery": {
      "averageHours": 0,
      "medianHours": 0,
      "minHours": 0,
      "maxHours": 0,
      "distribution": {
        "under1Hour": 0,
        "hours1to6": 0,
        "hours6to24": 0,
        "over24Hours": 0
      }
    },
    "probabilityRestoration": {
      "averageDropPercent": 0,
      "averageRestoredPercent": 0,
      "fullyRestoredCount": 0,
      "partiallyRestoredCount": 0,
      "restorationRate": 0
    },
    "totalSessions": 0,
    "totalBudgetThresholdsCrossed": 0
  },
  "timestamp": "2026-01-31T15:23:12.749Z"
}
```
**Note**: Verified user account test passed. Returns comprehensive GPS analytics dashboard with goal survival metrics, time-to-recovery distribution, and probability restoration statistics.

---

### GET /v1/gps/analytics/me
**Description**: Get your personal GPS analytics

```bash
curl -X GET "http://localhost:8007/v1/v1/gps/analytics/me?days=30" \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PASSED`
**Response**:
```json
{
  "success": true,
  "data": {
    "totalSlips": 0,
    "recoveryRate": 0,
    "preferredPath": null,
    "averageTimeToRecovery": 0,
    "totalProbabilityRestored": 0
  },
  "timestamp": "2026-01-31T15:23:10.475Z"
}
```
**Note**: Verified user account test passed. Returns personal GPS analytics including total slips, recovery rate, preferred recovery path, and probability restoration metrics.

---

### GET /v1/gps/analytics/categories
**Description**: Get GPS analytics by spending category

```bash
curl -X GET "http://localhost:8007/v1/v1/gps/analytics/categories?days=30" \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PASSED`
**Response**:
```json
{
  "success": true,
  "data": [],
  "timestamp": "2026-01-31T15:23:15.687Z"
}
```
**Note**: Verified user account test passed. Returns GPS analytics broken down by spending category. Empty array for new user with no category-specific slip data.

---

### GET /v1/gps/active-adjustments
**Description**: Get your active recovery adjustments

```bash
curl -X GET http://localhost:8007/v1/v1/gps/active-adjustments \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PASSED`
**Response**:
```json
{
  "success": true,
  "data": {
    "savingsAdjustment": null,
    "categoryFreezes": [],
    "hasActiveAdjustments": false
  },
  "timestamp": "2026-01-31T15:22:40.242Z"
}
```
**Note**: Verified user account test passed. Returns active recovery adjustments including savings rate adjustments and category freezes. New user shows no active adjustments.

---

### GET /v1/gps/active-adjustments/frozen/:categoryId
**Description**: Check if a category is frozen

```bash
curl -X GET "http://localhost:8007/v1/v1/gps/active-adjustments/frozen/<category-id>" \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PENDING`
**Response**:
```json

```

---

## 4. Agent 3: Commitment Device Engine

**Purpose**: Create real stakes for financial goals (3x more likely to achieve)

### POST /v1/commitment/stakes
**Description**: Create commitment with stakes (SOCIAL, ANTI_CHARITY, LOSS_POOL)

```bash
curl -X POST http://localhost:8007/v1/v1/commitment/stakes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "goalId": "<goal-id>",
    "stakeType": "SOCIAL",
    "stakeAmount": 50000,
    "deadline": "2025-06-30T00:00:00Z",
    "refereeEmail": "friend@example.com",
    "refereeName": "John Doe",
    "refereeRelationship": "FRIEND",
    "verificationMethod": "REFEREE"
  }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### GET /v1/commitment/stakes/:goalId
**Description**: Get stakes for a goal

```bash
curl -X GET "http://localhost:8007/v1/v1/commitment/stakes/<goal-id>?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PENDING`
**Response**:
```json

```

---

### PUT /v1/commitment/stakes/:id
**Description**: Update stake configuration

```bash
curl -X PUT http://localhost:8007/v1/v1/commitment/stakes/<stake-id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deadline": "2025-07-30T00:00:00Z",
    "stakeAmount": 75000
  }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### DELETE /v1/commitment/stakes/:id
**Description**: Cancel commitment (before deadline)

```bash
curl -X DELETE http://localhost:8007/v1/v1/commitment/stakes/<stake-id> \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PENDING`
**Response**:
```json

```

---

### POST /v1/commitment/verify/:id (Public)
**Description**: Referee verification of commitment

```bash
curl -X POST http://localhost:8007/v1/v1/commitment/verify/<contract-id> \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<verification-token>",
    "decision": true,
    "notes": "Goal achieved successfully"
  }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### GET /v1/commitment/referee/pending (Public)
**Description**: Get pending verifications for a referee

```bash
curl -X GET "http://localhost:8007/v1/v1/commitment/referee/pending?token=<referee-token>"
```

**Status**: `PENDING`
**Response**:
```json

```

---

### POST /v1/commitment/referee/invite
**Description**: Invite a new referee

```bash
curl -X POST http://localhost:8007/v1/v1/commitment/referee/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "referee@example.com",
    "name": "Jane Smith",
    "relationship": "MENTOR"
  }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### POST /v1/commitment/referee/accept (Public)
**Description**: Accept referee invitation

```bash
curl -X POST http://localhost:8007/v1/v1/commitment/referee/accept \
  -H "Content-Type: application/json" \
  -d '{ "token": "<invite-token>" }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### GET /v1/commitment/analytics/effectiveness
**Description**: Get stake effectiveness metrics

```bash
curl -X GET http://localhost:8007/v1/v1/commitment/analytics/effectiveness \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PASSED`
**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "792a0667-e308-44bc-8592-dfa9be685150",
    "metrics": [
      {
        "stakeType": "SOCIAL",
        "totalCommitments": 0,
        "successfulCommitments": 0,
        "successRate": 0,
        "averageStakeAmount": null,
        "averageTimeToSuccess": null
      },
      {
        "stakeType": "ANTI_CHARITY",
        "totalCommitments": 0,
        "successfulCommitments": 0,
        "successRate": 0,
        "averageStakeAmount": null,
        "averageTimeToSuccess": null
      },
      {
        "stakeType": "LOSS_POOL",
        "totalCommitments": 0,
        "successfulCommitments": 0,
        "successRate": 0,
        "averageStakeAmount": null,
        "averageTimeToSuccess": null
      }
    ],
    "recommendation": "Try starting with SOCIAL accountability - it has a 78% success rate in research studies."
  },
  "timestamp": "2026-01-31T15:15:57.454Z"
}
```
**Note**: Endpoint returns stake effectiveness metrics with breakdowns by stake type (SOCIAL, ANTI_CHARITY, LOSS_POOL) and personalized recommendations. New users without any commitments receive starter recommendation.

---

## 5. Agent 4: Future Self Simulator

**Purpose**: Bridge gap to future self through letters and dual-path visualizations

### GET /v1/future-self/simulation
**Description**: Get dual-path Monte Carlo simulation (10,000 iterations)

```bash
curl -X GET http://localhost:8007/v1/v1/future-self/simulation \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PASSED`
**Response**:
```json
{
  "success": false,
  "error": {
    "code": "FS_12003",
    "message": "Insufficient user data for future self simulation. Missing: financial snapshot",
    "details": {
      "missingFields": ["financial snapshot"]
    }
  },
  "timestamp": "2026-01-31T15:15:45.221Z"
}
```
**Note**: API endpoint is functional. Returns business logic error indicating the user needs to complete their financial profile (add financial snapshot) before simulation can run. This is expected behavior for a new user account.

---

### GET /v1/future-self/letter
**Description**: Get personalized letter from your 60-year-old future self

```bash
curl -X GET http://localhost:8007/v1/v1/future-self/letter \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PENDING`
**Response**:
```json

```

---

### GET /v1/future-self/timeline/:years
**Description**: Get projection at specific year (1, 5, 10, or 20)

```bash
curl -X GET http://localhost:8007/v1/v1/future-self/timeline/10 \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PENDING`
**Response**:
```json

```

---

### GET /v1/future-self/preferences
**Description**: Get user's Future Self preferences

```bash
curl -X GET http://localhost:8007/v1/v1/future-self/preferences \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PASSED`
**Response**:
```json
{
  "success": true,
  "data": {
    "weeklyLettersEnabled": true,
    "updatedAt": "2026-01-31T15:15:21.056Z"
  },
  "timestamp": "2026-01-31T15:15:47.596Z"
}
```
**Note**: API endpoint is functional. Returns user preferences including weekly letters opt-in status and last update timestamp.

---

### PATCH /v1/future-self/preferences
**Description**: Update preferences (opt-in/out of weekly letters)

```bash
curl -X PATCH http://localhost:8007/v1/v1/future-self/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "weeklyLettersEnabled": true }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### GET /v1/future-self/letters
**Description**: Get letter history

```bash
curl -X GET "http://localhost:8007/v1/v1/future-self/letters?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PASSED`
**Response**:
```json
{
  "success": true,
  "data": {
    "letters": [],
    "total": 0,
    "hasMore": false
  },
  "timestamp": "2026-01-31T15:15:50.153Z"
}
```
**Note**: API endpoint is functional. Returns empty letter history for new user with pagination metadata (total count, hasMore flag).

---

### GET /v1/future-self/letters/:id
**Description**: Get a specific letter by ID

```bash
curl -X GET http://localhost:8007/v1/v1/future-self/letters/<letter-id> \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PENDING`
**Response**:
```json

```

---

### PATCH /v1/future-self/letters/:id/engagement
**Description**: Update letter engagement metrics

```bash
curl -X PATCH http://localhost:8007/v1/v1/future-self/letters/<letter-id>/engagement \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "readDurationMs": 45000 }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### GET /v1/future-self/stats
**Description**: Get Future Self statistics

```bash
curl -X GET http://localhost:8007/v1/v1/future-self/stats \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PASSED`
**Response**:
```json
{
  "success": true,
  "data": {
    "totalLetters": 0,
    "lettersRead": 0,
    "avgReadDurationMs": null,
    "avgToneScore": null,
    "firstLetterDate": null,
    "lastLetterDate": null,
    "byTrigger": {},
    "thisMonth": 0
  },
  "timestamp": "2026-01-31T15:15:52.706Z"
}
```
**Note**: API endpoint is functional. Returns comprehensive Future Self statistics including letter counts, engagement metrics (read duration, tone scores), and breakdown by trigger type. New users see zeroed/null values.

---

## 6. Agent 5: Ubuntu Manager

**Purpose**: Recognize family support as social capital investment (Africa-specific)

### GET /v1/ubuntu/dependency-ratio
**Description**: Get current dependency ratio with breakdown

```bash
curl -X GET http://localhost:8007/v1/v1/ubuntu/dependency-ratio \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PASSED`
**Response**:
```json
{
  "success": true,
  "data": {
    "totalRatio": 0,
    "riskLevel": "GREEN",
    "components": {
      "parentSupport": 0,
      "siblingEducation": 0,
      "extendedFamily": 0,
      "communityContribution": 0
    },
    "monthlyTotal": 0,
    "monthlyIncome": 0,
    "currency": "NGN",
    "message": {
      "headline": "Your family support is well-balanced",
      "subtext": "You're building wealth while honoring your responsibilities to loved ones."
    },
    "trend": "stable"
  },
  "timestamp": "2026-01-31T15:16:01.575Z"
}
```
**Note**: API endpoint is functional. Returns dependency ratio with risk level assessment (GREEN/YELLOW/RED), component breakdown (parent support, sibling education, extended family, community contribution), and contextual messaging for the user.

---

### POST /v1/ubuntu/family-support
**Description**: Add a new family support obligation

```bash
curl -X POST http://localhost:8007/v1/v1/ubuntu/family-support \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mom",
    "relationship": "PARENT",
    "amount": 50000,
    "currency": "NGN",
    "frequency": "MONTHLY",
    "description": "Monthly allowance"
  }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### GET /v1/ubuntu/family-support
**Description**: List family support records

```bash
curl -X GET "http://localhost:8007/v1/v1/ubuntu/family-support?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PASSED`
**Response**:
```json
{
  "success": true,
  "data": {
    "familySupport": [],
    "summary": {
      "totalMonthly": 0,
      "byRelationship": {}
    },
    "pagination": {
      "total": 0,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  },
  "timestamp": "2026-01-31T15:16:04.020Z"
}
```
**Note**: API endpoint is functional. Returns family support records with summary (total monthly amount, breakdown by relationship type) and pagination metadata. Empty array for user with no family support records.

---

### PATCH /v1/ubuntu/family-support/:id
**Description**: Update family support record

```bash
curl -X PATCH http://localhost:8007/v1/v1/ubuntu/family-support/<support-id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 60000,
    "description": "Increased monthly allowance"
  }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### DELETE /v1/ubuntu/family-support/:id
**Description**: Soft delete family support record

```bash
curl -X DELETE http://localhost:8007/v1/v1/ubuntu/family-support/<support-id> \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PENDING`
**Response**:
```json

```

---

### POST /v1/ubuntu/emergency
**Description**: Report a family emergency

```bash
curl -X POST http://localhost:8007/v1/v1/ubuntu/emergency \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MEDICAL",
    "recipientName": "Dad",
    "relationship": "PARENT",
    "amount": 200000,
    "currency": "NGN",
    "description": "Hospital bill"
  }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### GET /v1/ubuntu/emergency
**Description**: List family emergencies

```bash
curl -X GET "http://localhost:8007/v1/v1/ubuntu/emergency?status=PENDING" \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PASSED`
**Response**:
```json
{
  "success": true,
  "data": {
    "emergencies": [],
    "pagination": {
      "total": 0,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  },
  "timestamp": "2026-01-31T15:16:06.455Z"
}
```
**Note**: API endpoint is functional. Returns list of family emergencies with pagination metadata. Empty array for user with no emergencies recorded.

---

### GET /v1/ubuntu/adjustments/:emergencyId
**Description**: Get adjustment options for emergency

```bash
curl -X GET http://localhost:8007/v1/v1/ubuntu/adjustments/<emergency-id> \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PENDING`
**Response**:
```json

```

---

### POST /v1/ubuntu/emergency/adjust
**Description**: Apply adjustment (EMERGENCY_FUND_TAP, GOAL_EXTENSION, SAVINGS_REDUCTION)

```bash
curl -X POST http://localhost:8007/v1/v1/ubuntu/emergency/adjust \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "emergencyId": "<emergency-id>",
    "adjustmentType": "EMERGENCY_FUND_TAP"
  }'
```

**Status**: `PENDING`
**Response**:
```json

```

---

### GET /v1/ubuntu/dependency-ratio/history
**Description**: Get dependency ratio history for trends

```bash
curl -X GET "http://localhost:8007/v1/v1/ubuntu/dependency-ratio/history?days=30" \
  -H "Authorization: Bearer $TOKEN"
```

**Status**: `PENDING`
**Response**:
```json

```

---

## Summary

| Agent | Endpoints Tested | Passed | Failed | Pending |
|-------|-----------------|--------|--------|---------|
| Auth | 2 | 0 | 0 | 2 |
| Shark Auditor | 5 | 2 | 0 | 3 |
| GPS Re-Router | 9 | 4 | 0 | 5 |
| Commitment Device | 9 | 1 | 0 | 8 |
| Future Self | 9 | 4 | 0 | 5 |
| Ubuntu Manager | 10 | 3 | 0 | 7 |
| **Total** | **44** | **14** | **0** | **30** |

---

## Test Environment

- **Node Version**:
- **Database**: PostgreSQL
- **Redis**: Required for rate limiting
- **API Port**: 8007
