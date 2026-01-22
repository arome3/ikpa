# Shark Auditor

**Week:** 2 | **Tier:** 1-2 | **Depends On:** [01-opik-integration](./01-opik-integration.md)

---

## Overview

The Shark Auditor finds and eliminates "zombie subscriptions"—forgotten recurring charges that silently drain money. It uses regex pattern matching, anomaly detection, and **annualized framing** to make the true cost visible.

**Failure Mode Defeated:** Invisible Leakage

**Why It Matters:**
- Average user has 12 forgotten subscriptions
- 84% of people underestimate their monthly subscription costs
- "Zombie subscriptions" cost users an average of $273/year
- Tinder-style swipe UI creates viral demo moment

---

## Technical Spec

### Trigger Mechanism

- Daily cron job scans transaction history
- Webhook on new recurring charge detection
- User-requested audit

### Interfaces

```typescript
interface Subscription {
  id: string;
  name: string;
  monthlyCost: number;
  annualCost: number;
  lastUsageDate: Date | null;
  status: 'ACTIVE' | 'ZOMBIE' | 'UNKNOWN';
  category: string;
  detectedAt: Date;
}

interface AnnualizedFraming {
  monthly: string;
  annual: string;
  context: string;
  impact: string;
}

interface SwipeDecision {
  subscriptionId: string;
  action: 'KEEP' | 'CANCEL' | 'REVIEW_LATER';
  decidedAt: Date;
}
```

### Core Logic

```typescript
// SHARK AUDITOR: Find and eliminate zombie subscriptions

// Step 1: Regex Pattern Matching
const subscriptionPatterns = [
  /netflix|spotify|amazon prime|youtube premium/i,
  /DSTV|GOTV|Showmax/i,
  /gym|fitness|wellness/i,
  /cloud|storage|backup/i
];

// Step 2: Anomaly Detection for "Zombie Subscriptions"
// Usage-based detection: Subscription active but no related activity
const zombieDetection = {
  hasActiveCharge: true,
  lastUsageDate: '2025-08-15', // 5 months ago
  status: 'ZOMBIE'
};

// Step 3: Annualized Framing (Cognitive Reframe)
const framing = {
  monthly: '₦3,000/month',
  annual: '₦36,000/year',
  context: "That's 7% of your monthly rent.",
  impact: "Canceling saves you ₦36,000 this year."
};

// Step 4: Tinder-Style Swipe UI
const swipeOptions = {
  swipeLeft: 'Cancel subscription',
  swipeRight: 'Keep subscription',
  tapForDetails: 'View usage history'
};
```

### Full Implementation

```typescript
// apps/api/src/modules/ai/agents/shark-auditor.agent.ts
import { Injectable } from '@nestjs/common';
import { OpikService } from '../opik/opik.service';
import { TransactionService } from '../../finance/transaction.service';

interface SubscriptionMatch {
  id: string;
  merchantName: string;
  amount: number;
  frequency: 'monthly' | 'annual' | 'weekly';
  firstChargeDate: Date;
  lastChargeDate: Date;
  chargeCount: number;
}

@Injectable()
export class SharkAuditorAgent {
  private readonly subscriptionPatterns = [
    { pattern: /netflix|spotify|amazon prime|youtube premium|apple music|disney\+/i, category: 'Streaming' },
    { pattern: /DSTV|GOTV|Showmax|multichoice/i, category: 'TV/Cable' },
    { pattern: /gym|fitness|wellness|planet fitness|equinox/i, category: 'Fitness' },
    { pattern: /cloud|storage|backup|dropbox|icloud|google one/i, category: 'Cloud Storage' },
    { pattern: /adobe|microsoft 365|office|canva|figma/i, category: 'Software' },
    { pattern: /vpn|nord|express|surfshark/i, category: 'VPN' },
    { pattern: /coursera|udemy|skillshare|linkedin learning/i, category: 'Learning' },
  ];

  private readonly ZOMBIE_THRESHOLD_DAYS = 90; // No usage in 90 days = zombie

  constructor(
    private opikService: OpikService,
    private transactionService: TransactionService,
  ) {}

  async runAudit(userId: string): Promise<AuditResult> {
    const trace = this.opikService.createTrace('shark_audit_cognitive_chain', { userId }, { agent: 'shark_auditor', version: '1.0' });

    // Span 1: Transaction Analysis
    const txSpan = trace.span({ name: 'transaction_analysis', type: 'tool' });
    const transactions = await this.transactionService.getRecurringTransactions(userId);
    const subscriptions = this.detectSubscriptions(transactions);
    txSpan.end({ output: { subscriptionCount: subscriptions.length } });

    // Span 2: Zombie Detection
    const zombieSpan = trace.span({ name: 'zombie_detection', type: 'tool' });
    const zombieSubscriptions = await this.detectZombies(userId, subscriptions);
    zombieSpan.end({ output: { zombieCount: zombieSubscriptions.length } });

    // Span 3: Calculate Savings Potential
    const savingsSpan = trace.span({ name: 'calculate_savings_potential', type: 'tool' });
    const savingsPotential = this.calculateAnnualizedSavings(zombieSubscriptions);
    savingsSpan.end({ output: { potentialSavings: savingsPotential } });

    // Span 4: Generate Framing
    const framingSpan = trace.span({ name: 'generate_framing', type: 'tool' });
    const framedSubscriptions = subscriptions.map(sub => ({
      ...sub,
      framing: this.generateAnnualizedFraming(sub, userId),
    }));
    framingSpan.end({ output: { framedCount: framedSubscriptions.length } });

    const result = {
      subscriptions: framedSubscriptions,
      zombieCount: zombieSubscriptions.length,
      totalMonthlyCost: subscriptions.reduce((sum, s) => sum + s.monthlyCost, 0),
      potentialAnnualSavings: savingsPotential,
    };

    trace.end({ output: { success: true, ...result } });
    await this.opikService.flush();

    return result;
  }

  private detectSubscriptions(transactions: Transaction[]): Subscription[] {
    const subscriptions: Subscription[] = [];

    for (const tx of transactions) {
      for (const { pattern, category } of this.subscriptionPatterns) {
        if (pattern.test(tx.merchantName) || pattern.test(tx.description)) {
          subscriptions.push({
            id: tx.id,
            name: tx.merchantName,
            monthlyCost: tx.amount,
            annualCost: tx.amount * 12,
            lastUsageDate: null, // Will be populated by zombie detection
            status: 'UNKNOWN',
            category,
            detectedAt: new Date(),
          });
          break;
        }
      }
    }

    return subscriptions;
  }

  private async detectZombies(userId: string, subscriptions: Subscription[]): Promise<Subscription[]> {
    const zombies: Subscription[] = [];

    for (const sub of subscriptions) {
      // Check usage data (simplified - would integrate with usage APIs)
      const lastUsage = await this.getLastUsageDate(userId, sub.name);

      if (lastUsage) {
        const daysSinceUsage = Math.floor((Date.now() - lastUsage.getTime()) / (1000 * 60 * 60 * 24));
        sub.lastUsageDate = lastUsage;

        if (daysSinceUsage > this.ZOMBIE_THRESHOLD_DAYS) {
          sub.status = 'ZOMBIE';
          zombies.push(sub);
        } else {
          sub.status = 'ACTIVE';
        }
      } else {
        // No usage data available
        sub.status = 'UNKNOWN';
      }
    }

    return zombies;
  }

  private async getLastUsageDate(userId: string, serviceName: string): Promise<Date | null> {
    // In production: integrate with service APIs or track app usage
    // For now: return mock data
    return null;
  }

  private calculateAnnualizedSavings(zombies: Subscription[]): number {
    return zombies.reduce((sum, sub) => sum + sub.annualCost, 0);
  }

  private generateAnnualizedFraming(subscription: Subscription, userId: string): AnnualizedFraming {
    const monthly = `₦${subscription.monthlyCost.toLocaleString()}/month`;
    const annual = `₦${subscription.annualCost.toLocaleString()}/year`;

    // Generate context (percentage of rent, meals, etc.)
    const contextOptions = [
      { threshold: 50000, text: `That's ${Math.round(subscription.annualCost / 50000 * 100)}% of one month's rent.` },
      { threshold: 10000, text: `That's ${Math.round(subscription.annualCost / 10000)} meals out.` },
      { threshold: 5000, text: `That's a weekend trip to Calabar.` },
    ];

    const context = contextOptions.find(opt => subscription.annualCost >= opt.threshold)?.text
      || `That's money you could save.`;

    const impact = `Canceling saves you ₦${subscription.annualCost.toLocaleString()} this year.`;

    return { monthly, annual, context, impact };
  }

  async processSwipeDecision(userId: string, decision: SwipeDecision): Promise<void> {
    const trace = this.opikService.createTrace('swipe_decision', { userId, decision });

    if (decision.action === 'CANCEL') {
      // Queue for cancellation
      await this.queueCancellation(userId, decision.subscriptionId);
    }

    trace.end({ output: { processed: true, action: decision.action } });
    await this.opikService.flush();
  }

  private async queueCancellation(userId: string, subscriptionId: string): Promise<void> {
    // In production: integrate with cancellation services
    // For now: mark in database
  }
}
```

---

## Annualized Framing Examples

| Monthly Cost | Annual Cost | Context |
|--------------|-------------|---------|
| $15/month | $180/year | That's 8% of your rent |
| ₦5,000/month | ₦60,000/year | That's a weekend trip to Calabar |
| £9.99/month | £120/year | That's 3 months of groceries |

---

## Implementation Checklist

- [ ] Create file: `apps/api/src/modules/ai/agents/shark-auditor.agent.ts`
- [ ] Create file: `apps/api/src/modules/finance/subscription.service.ts`
- [ ] Add Prisma models for `Subscription`, `SwipeDecision`
- [ ] Create swipe UI endpoint DTOs
- [ ] Implement regex pattern matching
- [ ] Add zombie detection logic
- [ ] Build annualized framing generator
- [ ] Add Opik tracing spans
- [ ] Write unit tests for pattern matching
- [ ] Add Swagger documentation

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/shark/subscriptions` | Get detected subscriptions |
| POST | `/v1/shark/subscriptions/:id/cancel` | Process cancellation |
| POST | `/v1/shark/audit` | Trigger manual audit |
| POST | `/v1/shark/swipe` | Record swipe decision |

---

## Opik Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `SubscriptionDetectionAccuracy` | Percentage | True positives / (True positives + False positives) |
| `CancellationRate` | Percentage | Subscriptions cancelled / Subscriptions surfaced |
| `AnnualSavingsGenerated` | Currency | Sum of cancelled subscription values |
| `ZombieDetectionRate` | Percentage | Zombies detected / Total subscriptions |

---

## Verification

### curl Commands

```bash
# Get detected subscriptions
curl -X GET http://localhost:3000/v1/shark/subscriptions \
  -H "Authorization: Bearer $TOKEN"

# Trigger manual audit
curl -X POST http://localhost:3000/v1/shark/audit \
  -H "Authorization: Bearer $TOKEN"

# Record swipe decision
curl -X POST http://localhost:3000/v1/shark/swipe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "sub_123",
    "action": "CANCEL"
  }'
```

### Expected Response (GET /v1/shark/subscriptions)

```json
{
  "subscriptions": [
    {
      "id": "sub_001",
      "name": "Netflix",
      "monthlyCost": 5000,
      "annualCost": 60000,
      "lastUsageDate": "2025-12-01",
      "status": "ACTIVE",
      "category": "Streaming",
      "framing": {
        "monthly": "₦5,000/month",
        "annual": "₦60,000/year",
        "context": "That's a weekend trip to Calabar.",
        "impact": "Canceling saves you ₦60,000 this year."
      }
    },
    {
      "id": "sub_002",
      "name": "Planet Fitness",
      "monthlyCost": 15000,
      "annualCost": 180000,
      "lastUsageDate": "2025-08-15",
      "status": "ZOMBIE",
      "category": "Fitness",
      "framing": {
        "monthly": "₦15,000/month",
        "annual": "₦180,000/year",
        "context": "That's 36% of one month's rent.",
        "impact": "Canceling saves you ₦180,000 this year."
      }
    }
  ],
  "zombieCount": 1,
  "totalMonthlyCost": 20000,
  "potentialAnnualSavings": 180000
}
```

### Tinder-Style Swipe UI Component Spec

```typescript
// Frontend component interface
interface SubscriptionCard {
  subscription: Subscription;
  onSwipeLeft: () => void;  // Cancel
  onSwipeRight: () => void; // Keep
  onTap: () => void;        // View details
}

// Animation: Card slides off screen on swipe
// Visual: Red glow on swipe left, green glow on swipe right
// Zombie indicator: Skull icon + "No usage in X months"
```
