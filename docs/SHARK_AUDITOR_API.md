# Shark Auditor API Documentation

> **Agent 1 of 5** | Subscription Detection & Zombie Hunting System

The Shark Auditor detects recurring subscriptions from expense patterns, identifies "zombie" subscriptions (services you pay for but don't use), and presents them in a Tinder-style swiper interface with **annualized framing** to highlight the true cost.

**Key Insight**: A $10/month subscription feels small, but "$120/year" triggers loss aversion. The Shark frames all costs annually to motivate action.

---

## Base URL

```
/api/shark
```

All endpoints require JWT authentication via Bearer token.

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/subscriptions` | List all detected subscriptions |
| `GET` | `/subscriptions/:id` | Get single subscription details |
| `POST` | `/audit` | Trigger manual subscription scan |
| `POST` | `/swipe` | Record swipe decision (keep/cancel/review) |
| `POST` | `/subscriptions/:id/cancel` | Process cancellation |

---

## 1. List Subscriptions

Retrieve all detected subscriptions with annualized framing and summary statistics.

### Request

```http
GET /api/shark/subscriptions
Authorization: Bearer <token>
```

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | enum | No | - | Filter by status: `ACTIVE`, `ZOMBIE`, `UNKNOWN`, `CANCELLED` |
| `limit` | number | No | 20 | Results per page (1-100) |
| `offset` | number | No | 0 | Number of results to skip |

### Response

```json
{
  "subscriptions": [
    {
      "id": "sub-123-abc-def",
      "name": "Netflix",
      "category": "STREAMING",
      "monthlyCost": 5000,
      "annualCost": 60000,
      "currency": "NGN",
      "status": "ZOMBIE",
      "lastUsageDate": "2025-08-15T00:00:00.000Z",
      "detectedAt": "2026-01-10T00:00:00.000Z",
      "firstChargeDate": "2025-03-15T00:00:00.000Z",
      "lastChargeDate": "2026-01-15T00:00:00.000Z",
      "chargeCount": 12,
      "framing": {
        "monthly": "₦5,000/month",
        "annual": "₦60,000/year",
        "context": "That's 2 months of groceries",
        "impact": "Cancelling Netflix could save you ₦60,000 this year"
      },
      "lastDecision": {
        "action": "REVIEW_LATER",
        "decidedAt": "2026-01-16T02:00:00.000Z"
      }
    }
  ],
  "summary": {
    "totalSubscriptions": 8,
    "zombieCount": 3,
    "activeCount": 4,
    "unknownCount": 1,
    "totalMonthlyCost": 120000,
    "zombieMonthlyCost": 36000,
    "potentialAnnualSavings": 432000,
    "currency": "NGN"
  },
  "pagination": {
    "total": 8,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

### Example

```bash
# Get all zombie subscriptions
curl -X GET "http://localhost:3000/api/shark/subscriptions?status=ZOMBIE" \
  -H "Authorization: Bearer <token>"

# Paginated request
curl -X GET "http://localhost:3000/api/shark/subscriptions?limit=5&offset=0" \
  -H "Authorization: Bearer <token>"
```

---

## 2. Get Subscription Details

Retrieve detailed information about a specific subscription.

### Request

```http
GET /api/shark/subscriptions/:id
Authorization: Bearer <token>
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Subscription ID |

### Response

```json
{
  "id": "sub-123-abc-def",
  "name": "Netflix",
  "category": "STREAMING",
  "monthlyCost": 5000,
  "annualCost": 60000,
  "currency": "NGN",
  "status": "ZOMBIE",
  "lastUsageDate": "2025-08-15T00:00:00.000Z",
  "detectedAt": "2026-01-10T00:00:00.000Z",
  "firstChargeDate": "2025-03-15T00:00:00.000Z",
  "lastChargeDate": "2026-01-15T00:00:00.000Z",
  "chargeCount": 12,
  "framing": {
    "monthly": "₦5,000/month",
    "annual": "₦60,000/year",
    "context": "That's 2 months of groceries",
    "impact": "Cancelling Netflix could save you ₦60,000 this year"
  },
  "lastDecision": {
    "action": "REVIEW_LATER",
    "decidedAt": "2026-01-16T02:00:00.000Z"
  }
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized - Invalid or missing JWT token |
| 404 | Subscription not found |

### Example

```bash
curl -X GET "http://localhost:3000/api/shark/subscriptions/sub-123-abc-def" \
  -H "Authorization: Bearer <token>"
```

---

## 3. Trigger Manual Audit

Scan expense records to detect subscriptions and identify zombies. Returns audit summary with potential savings.

**Rate Limited**: 3 requests per hour per user.

### Request

```http
POST /api/shark/audit
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `force` | boolean | No | false | Force re-scan even if recently audited |

```json
{
  "force": false
}
```

### Response

```json
{
  "totalSubscriptions": 8,
  "newlyDetected": 3,
  "zombiesDetected": 2,
  "potentialAnnualSavings": 432000,
  "currency": "NGN",
  "auditedAt": "2026-01-16T02:00:00.000Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized - Invalid or missing JWT token |
| 422 | Insufficient expense data to detect subscriptions |
| 429 | Rate limit exceeded - Max 3 audits per hour |

### Example

```bash
# Normal audit
curl -X POST "http://localhost:3000/api/shark/audit" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'

# Force re-scan
curl -X POST "http://localhost:3000/api/shark/audit" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

---

## 4. Record Swipe Decision

Record a user's decision on a subscription using the Tinder-style swiper interface.

### Request

```http
POST /api/shark/swipe
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `subscriptionId` | UUID | Yes | The subscription to make a decision on |
| `action` | enum | Yes | `KEEP`, `CANCEL`, or `REVIEW_LATER` |

```json
{
  "subscriptionId": "sub-123-abc-def",
  "action": "CANCEL"
}
```

### Swipe Actions

| Action | Description | Effect |
|--------|-------------|--------|
| `KEEP` | User wants to keep the subscription | Marks as reviewed, no further action |
| `CANCEL` | User wants to cancel | Queues for cancellation processing |
| `REVIEW_LATER` | User is undecided | Will resurface in future audits |

### Response

```json
{
  "id": "decision-456-ghi-jkl",
  "subscriptionId": "sub-123-abc-def",
  "action": "CANCEL",
  "decidedAt": "2026-01-16T02:00:00.000Z",
  "message": "Subscription queued for cancellation"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Invalid swipe action |
| 401 | Unauthorized - Invalid or missing JWT token |
| 404 | Subscription not found |

### Example

```bash
# Cancel a subscription
curl -X POST "http://localhost:3000/api/shark/swipe" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "sub-123-abc-def",
    "action": "CANCEL"
  }'

# Keep a subscription
curl -X POST "http://localhost:3000/api/shark/swipe" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "sub-789-xyz",
    "action": "KEEP"
  }'
```

---

## 5. Process Cancellation

Mark a subscription as cancelled and calculate annual savings.

### Request

```http
POST /api/shark/subscriptions/:id/cancel
Authorization: Bearer <token>
Content-Type: application/json
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Subscription ID to cancel |

### Request Body

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| `reason` | string | No | 500 | Cancellation reason (for analytics) |

```json
{
  "reason": "Not using this service anymore"
}
```

### Response

```json
{
  "subscriptionId": "sub-123-abc-def",
  "success": true,
  "message": "Subscription marked as cancelled. Annual savings: ₦60,000",
  "annualSavings": 60000,
  "cancelledAt": "2026-01-16T02:00:00.000Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized - Invalid or missing JWT token |
| 404 | Subscription not found |
| 422 | Subscription cannot be cancelled (e.g., already cancelled) |

### Example

```bash
curl -X POST "http://localhost:3000/api/shark/subscriptions/sub-123-abc-def/cancel" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Never use this streaming service"}'
```

---

## Data Types

### Subscription Status

| Value | Description |
|-------|-------------|
| `ACTIVE` | Subscription is actively used |
| `ZOMBIE` | Paying but not using (candidate for cancellation) |
| `UNKNOWN` | Usage pattern unclear |
| `CANCELLED` | Already cancelled |

### Subscription Category

| Value | Description |
|-------|-------------|
| `STREAMING` | Video/music streaming (Netflix, Spotify) |
| `SOFTWARE` | SaaS tools (Adobe, Microsoft 365) |
| `GAMING` | Gaming subscriptions (Xbox, PlayStation) |
| `FITNESS` | Gym, fitness apps |
| `NEWS` | News/magazine subscriptions |
| `CLOUD` | Cloud storage (iCloud, Google One) |
| `FOOD` | Food delivery subscriptions |
| `FINANCE` | Financial services |
| `EDUCATION` | Learning platforms |
| `OTHER` | Uncategorized |

### Currency

| Code | Symbol | Country |
|------|--------|---------|
| `NGN` | ₦ | Nigeria |
| `GHS` | GH₵ | Ghana |
| `KES` | KSh | Kenya |
| `ZAR` | R | South Africa |
| `EGP` | E£ | Egypt |
| `USD` | $ | United States |

---

## Annualized Framing

Every subscription response includes a `framing` object designed to trigger loss aversion:

```json
{
  "framing": {
    "monthly": "₦5,000/month",
    "annual": "₦60,000/year",
    "context": "That's 2 months of groceries",
    "impact": "Cancelling Netflix could save you ₦60,000 this year"
  }
}
```

### Context Examples (NGN)

| Annual Cost | Context Message |
|-------------|-----------------|
| ≥ ₦500,000 | "That's equivalent to a month's rent in many cities" |
| ≥ ₦200,000 | "That's a weekend getaway" |
| ≥ ₦100,000 | "That's 2 months of groceries" |
| < ₦100,000 | "That's money that could be growing in savings" |

---

## Testing Workflow

### 1. Setup Test Data
First, ensure the user has expense records with recurring patterns (same merchant, similar amounts, monthly frequency).

### 2. Trigger Audit
```bash
curl -X POST "http://localhost:3000/api/shark/audit" \
  -H "Authorization: Bearer <token>"
```

### 3. List Detected Subscriptions
```bash
curl -X GET "http://localhost:3000/api/shark/subscriptions?status=ZOMBIE" \
  -H "Authorization: Bearer <token>"
```

### 4. Swipe on Subscriptions
```bash
# For each zombie, decide: KEEP, CANCEL, or REVIEW_LATER
curl -X POST "http://localhost:3000/api/shark/swipe" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"subscriptionId": "<id>", "action": "CANCEL"}'
```

### 5. Process Cancellations
```bash
curl -X POST "http://localhost:3000/api/shark/subscriptions/<id>/cancel" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Not using"}'
```

---

## Cron Jobs

The Shark Auditor runs automated background tasks:

| Schedule | Task | Description |
|----------|------|-------------|
| Daily | Zombie Detection | Scans for subscriptions with no recent usage |
| Weekly | Audit Reminder | Notifies users with unreviewed zombies |

See `shark.cron.ts` for implementation details.

---

## Related Files

| File | Purpose |
|------|---------|
| `shark.controller.ts` | API endpoint definitions |
| `shark.service.ts` | Business logic |
| `subscription-detector.calculator.ts` | Pattern detection from expenses |
| `zombie-detector.calculator.ts` | Identifies unused subscriptions |
| `annualized-framing.calculator.ts` | Generates impact messaging |
| `dto/*.ts` | Request/response type definitions |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Subscriptions detected per user | 5-15 |
| Zombie detection rate | 30-40% of subscriptions |
| User action rate (swipe decisions) | 80%+ |
| Average annual savings per user | $200+/month equivalent |
