# Ubuntu Manager

**Week:** 3 | **Tier:** 2 | **Depends On:** [02-cash-flow-score](./02-cash-flow-score.md)

---

## Overview

The Ubuntu Manager recognizes that in African cultures, supporting family is a **value, not a problem**. It reframes family transfers as "Social Capital Investment" instead of "financial leakage" and provides non-judgmental adjustments for family emergencies.

**Failure Mode Defeated:** Cultural Blindness

**Ubuntu Philosophy:** "I am because we are." Financial success in African context includes family prosperity, not just individual wealth.

**Why It Matters:**
- Average African professional supports 4-6 family members
- Family support averages 15-35% of net income
- 67% of African users abandon Western finance apps due to "irrelevant advice"
- Categorizing family support as "gifts" creates psychological conflict

---

## Technical Spec

### Trigger Mechanism

- Transaction categorized as family transfer
- User adds family obligation
- Monthly dependency ratio calculation

### Interfaces

```typescript
interface TransactionReframe {
  originalCategory: string;
  newCategory: string;
  subcategories: string[];
}

interface DependencyRatio {
  formula: string;
  components: {
    parentSupport: number;
    siblingEducation: number;
    extendedFamily: number;
    totalFamilySupport: number;
    netIncome: number;
  };
  ratio: number;
  interpretation: string;
}

interface RiskGaugeZone {
  range: [number, number];
  label: string;
  color: string;
}

interface FamilyEmergencyResponse {
  trigger: string;
  validation: string;
  adjustments: AdjustmentOption[];
  insight: string;
}

interface AdjustmentOption {
  option: string;
  impact: string;
  recovery: string;
}
```

### Core Logic

```typescript
// UBUNTU MANAGER: Recognize social capital

// Step 1: Smart Categorization
const transactionReframe = {
  originalCategory: 'Gifts/Transfers',
  newCategory: 'Social Capital Investment',
  subcategories: [
    'Parent Support',
    'Sibling Education',
    'Extended Family Emergency',
    'Community Contribution (Ajo/Esusu)'
  ]
};

// Step 2: Dependency Ratio Calculation
const dependencyRatio = {
  formula: '(Total Family Support / Net Income) * 100',
  components: {
    parentSupport: 40000,
    siblingEducation: 25000,
    extendedFamily: 10000,
    totalFamilySupport: 75000,
    netIncome: 350000
  },
  ratio: 21.4, // 21.4%
  interpretation: 'Healthy family support level'
};

// Step 3: Risk Gauge (Traffic Light System)
const riskGauge = {
  green: { range: [0, 10], label: 'Sustainable', color: '#22c55e' },
  orange: { range: [10, 35], label: 'Moderate', color: '#f59e0b' },
  red: { range: [35, 100], label: 'Review Needed', color: '#ef4444' },
  currentValue: 21.4,
  currentZone: 'orange',
  message: 'Your family support is at a healthy moderate level.'
};

// Step 4: Non-Judgmental Response to Family Emergency
const familyEmergencyResponse = {
  trigger: 'Mom needs ₦100,000 for medical bills',
  validation: "Family comes first—that's not a bug, it's a feature of who you are.",
  adjustments: [
    {
      option: 'Use emergency fund (recommended)',
      impact: 'Emergency fund: ₦250,000 → ₦150,000',
      recovery: 'Rebuild in 3 months at current savings rate'
    },
    {
      option: 'Adjust goal timeline',
      impact: 'House goal: Dec 2026 → Feb 2027',
      recovery: 'No monthly budget change needed'
    },
    {
      option: 'Temporary savings reduction',
      impact: 'This month: ₦50,000 → ₦25,000',
      recovery: 'Return to normal next month'
    }
  ],
  insight: "Your dependency ratio will temporarily rise to 28%—still in the healthy orange zone."
};
```

### Full Implementation

```typescript
// apps/api/src/modules/ai/agents/ubuntu-manager.agent.ts
import { Injectable } from '@nestjs/common';
import { OpikService } from '../opik/opik.service';
import { TransactionService } from '../../finance/transaction.service';
import { CashFlowScoreCalculator } from '../../finance/calculators/cash-flow-score';

interface FamilyObligation {
  id: string;
  type: 'parent_support' | 'sibling_education' | 'extended_family' | 'community';
  recipientName: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annual' | 'one_time';
  startDate: Date;
  notes?: string;
}

@Injectable()
export class UbuntuManagerAgent {
  private readonly FAMILY_CATEGORIES = [
    'Parent Support',
    'Sibling Education',
    'Extended Family Emergency',
    'Community Contribution (Ajo/Esusu)',
  ];

  private readonly RISK_ZONES = {
    green: { range: [0, 10] as [number, number], label: 'Sustainable', color: '#22c55e' },
    orange: { range: [10, 35] as [number, number], label: 'Moderate', color: '#f59e0b' },
    red: { range: [35, 100] as [number, number], label: 'Review Needed', color: '#ef4444' },
  };

  constructor(
    private opikService: OpikService,
    private transactionService: TransactionService,
    private cashFlowCalculator: CashFlowScoreCalculator,
  ) {}

  async calculateDependencyRatio(userId: string): Promise<DependencyRatioResult> {
    const trace = this.opikService.createTrace('dependency_ratio_calculation', { userId }, { agent: 'ubuntu_manager', version: '1.0' });

    // Span 1: Get family transactions
    const txSpan = trace.span({ name: 'get_family_transactions', type: 'tool' });
    const transactions = await this.transactionService.getFamilyTransactions(userId);
    txSpan.end({ output: { transactionCount: transactions.length } });

    // Span 2: Categorize transactions
    const catSpan = trace.span({ name: 'categorize_transactions', type: 'tool' });
    const categorized = this.categorizeTransactions(transactions);
    catSpan.end({ output: categorized });

    // Span 3: Calculate ratio
    const ratioSpan = trace.span({ name: 'calculate_ratio', type: 'tool' });
    const financialData = await this.transactionService.getFinancialSummary(userId);
    const ratio = this.computeDependencyRatio(categorized, financialData.netIncome);
    ratioSpan.end({ output: { ratio } });

    // Span 4: Determine risk zone
    const zoneSpan = trace.span({ name: 'determine_risk_zone', type: 'tool' });
    const riskGauge = this.determineRiskZone(ratio);
    zoneSpan.end({ output: riskGauge });

    const result: DependencyRatioResult = {
      ratio,
      components: categorized,
      riskGauge,
      interpretation: this.getInterpretation(ratio),
    };

    trace.end({ output: result });
    await this.opikService.flush();

    return result;
  }

  private categorizeTransactions(transactions: Transaction[]): CategorizedSupport {
    const categorized = {
      parentSupport: 0,
      siblingEducation: 0,
      extendedFamily: 0,
      community: 0,
      totalFamilySupport: 0,
    };

    for (const tx of transactions) {
      switch (tx.subcategory) {
        case 'Parent Support':
          categorized.parentSupport += tx.amount;
          break;
        case 'Sibling Education':
          categorized.siblingEducation += tx.amount;
          break;
        case 'Extended Family Emergency':
          categorized.extendedFamily += tx.amount;
          break;
        case 'Community Contribution (Ajo/Esusu)':
          categorized.community += tx.amount;
          break;
      }
    }

    categorized.totalFamilySupport =
      categorized.parentSupport +
      categorized.siblingEducation +
      categorized.extendedFamily +
      categorized.community;

    return categorized;
  }

  private computeDependencyRatio(categorized: CategorizedSupport, netIncome: number): number {
    return (categorized.totalFamilySupport / netIncome) * 100;
  }

  private determineRiskZone(ratio: number): RiskGaugeResult {
    let zone: 'green' | 'orange' | 'red';
    if (ratio <= 10) zone = 'green';
    else if (ratio <= 35) zone = 'orange';
    else zone = 'red';

    return {
      currentValue: ratio,
      currentZone: zone,
      ...this.RISK_ZONES[zone],
      message: this.getZoneMessage(zone, ratio),
    };
  }

  private getZoneMessage(zone: string, ratio: number): string {
    switch (zone) {
      case 'green':
        return `Your family support (${ratio.toFixed(1)}%) is sustainable and leaves room for growth.`;
      case 'orange':
        return `Your family support (${ratio.toFixed(1)}%) is at a healthy moderate level.`;
      case 'red':
        return `Your family support (${ratio.toFixed(1)}%) may need review to ensure your long-term goals aren't impacted.`;
      default:
        return '';
    }
  }

  private getInterpretation(ratio: number): string {
    if (ratio <= 10) return 'Low family support - sustainable level';
    if (ratio <= 35) return 'Healthy family support level';
    return 'High family support - consider reviewing obligations';
  }

  async handleFamilyEmergency(
    userId: string,
    emergencyDetails: { description: string; amount: number }
  ): Promise<FamilyEmergencyResponse> {
    const trace = this.opikService.createTrace('family_emergency_handling', { userId, amount: emergencyDetails.amount });

    const financialData = await this.transactionService.getFinancialSummary(userId);
    const currentRatio = await this.calculateDependencyRatio(userId);

    // Calculate new ratio after emergency
    const newTotalSupport = currentRatio.components.totalFamilySupport + emergencyDetails.amount;
    const newRatio = (newTotalSupport / financialData.netIncome) * 100;

    // Generate adjustment options
    const adjustments = await this.generateAdjustmentOptions(userId, emergencyDetails.amount, financialData);

    const response: FamilyEmergencyResponse = {
      trigger: emergencyDetails.description,
      validation: "Family comes first—that's not a bug, it's a feature of who you are.",
      adjustments,
      insight: `Your dependency ratio will temporarily rise to ${newRatio.toFixed(1)}%—${this.getZoneDescription(newRatio)}.`,
    };

    trace.end({ output: { adjustmentOptions: adjustments.length, newRatio } });
    await this.opikService.flush();

    return response;
  }

  private async generateAdjustmentOptions(
    userId: string,
    emergencyAmount: number,
    financialData: FinancialSummary
  ): Promise<AdjustmentOption[]> {
    const options: AdjustmentOption[] = [];

    // Option 1: Use emergency fund
    if (financialData.emergencyFund >= emergencyAmount) {
      const remainingFund = financialData.emergencyFund - emergencyAmount;
      const recoveryMonths = Math.ceil(emergencyAmount / financialData.monthlySavings);
      options.push({
        option: 'Use emergency fund (recommended)',
        impact: `Emergency fund: ₦${financialData.emergencyFund.toLocaleString()} → ₦${remainingFund.toLocaleString()}`,
        recovery: `Rebuild in ${recoveryMonths} months at current savings rate`,
      });
    }

    // Option 2: Adjust goal timeline
    const timelineExtension = Math.ceil(emergencyAmount / financialData.monthlySavings);
    options.push({
      option: 'Adjust goal timeline',
      impact: `Primary goal delayed by ~${timelineExtension} weeks`,
      recovery: 'No monthly budget change needed',
    });

    // Option 3: Temporary savings reduction
    const reducedSavings = Math.max(0, financialData.monthlySavings - emergencyAmount);
    options.push({
      option: 'Temporary savings reduction',
      impact: `This month: ₦${financialData.monthlySavings.toLocaleString()} → ₦${reducedSavings.toLocaleString()}`,
      recovery: 'Return to normal next month',
    });

    return options;
  }

  private getZoneDescription(ratio: number): string {
    if (ratio <= 10) return 'still in the sustainable green zone';
    if (ratio <= 35) return 'still in the healthy orange zone';
    return 'entering the review-needed red zone';
  }

  async addFamilyObligation(userId: string, obligation: Omit<FamilyObligation, 'id'>): Promise<FamilyObligation> {
    const trace = this.opikService.createTrace('add_family_obligation', { userId, type: obligation.type });

    const saved = await this.transactionService.saveFamilyObligation(userId, obligation);

    // Recalculate dependency ratio
    const newRatio = await this.calculateDependencyRatio(userId);

    trace.end({ output: { obligationId: saved.id, newRatio: newRatio.ratio } });
    await this.opikService.flush();

    return saved;
  }

  async reframeTransaction(transactionId: string): Promise<TransactionReframe> {
    return {
      originalCategory: 'Gifts/Transfers',
      newCategory: 'Social Capital Investment',
      subcategories: this.FAMILY_CATEGORIES,
    };
  }
}
```

---

## Cultural Features

| Feature | Description |
|---------|-------------|
| **Ajo/Esusu Tracking** | Rotating savings group support |
| **Multi-Currency** | NGN, GHS, KES, ZAR, EGP, USD |
| **Family Obligation Calendar** | Anticipate regular support needs |
| **Social Capital Score** | Track family support as investment, not expense |

---

## Implementation Checklist

- [ ] Create file: `apps/api/src/modules/ai/agents/ubuntu-manager.agent.ts`
- [ ] Add Prisma models for `FamilyObligation`, `DependencyRatioHistory`
- [ ] Create transaction reframing logic
- [ ] Build dependency ratio calculator
- [ ] Implement Risk Gauge component
- [ ] Add family emergency response generator
- [ ] Add Opik tracing with CulturalSensitivity metric
- [ ] Write unit tests
- [ ] Add Swagger documentation

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/ubuntu/dependency-ratio` | Get current ratio and risk gauge |
| POST | `/v1/ubuntu/family-support` | Add family obligation |
| GET | `/v1/ubuntu/adjustments` | Get non-judgmental adjustments |
| POST | `/v1/ubuntu/emergency` | Handle family emergency |

---

## Opik Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `CulturalSensitivity` | G-Eval (1-5) | Cultural appropriateness score |
| `DependencyRatioHealth` | Percentage | Ratio staying in healthy range |
| `FamilyEmergencyRecoveryTime` | Days | Time to return to normal savings rate |
| `ObligationTrackingAdoption` | Percentage | Users who track family obligations |

---

## Verification

### curl Commands

```bash
# Get dependency ratio
curl -X GET http://localhost:3000/v1/ubuntu/dependency-ratio \
  -H "Authorization: Bearer $TOKEN"

# Add family support obligation
curl -X POST http://localhost:3000/v1/ubuntu/family-support \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "parent_support",
    "recipientName": "Mom",
    "amount": 40000,
    "frequency": "monthly"
  }'

# Handle family emergency
curl -X POST http://localhost:3000/v1/ubuntu/emergency \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Mom needs ₦100,000 for medical bills",
    "amount": 100000
  }'
```

### Expected Response (GET /v1/ubuntu/dependency-ratio)

```json
{
  "ratio": 21.4,
  "components": {
    "parentSupport": 40000,
    "siblingEducation": 25000,
    "extendedFamily": 10000,
    "community": 0,
    "totalFamilySupport": 75000
  },
  "riskGauge": {
    "currentValue": 21.4,
    "currentZone": "orange",
    "range": [10, 35],
    "label": "Moderate",
    "color": "#f59e0b",
    "message": "Your family support (21.4%) is at a healthy moderate level."
  },
  "interpretation": "Healthy family support level"
}
```

### Expected Response (POST /v1/ubuntu/emergency)

```json
{
  "trigger": "Mom needs ₦100,000 for medical bills",
  "validation": "Family comes first—that's not a bug, it's a feature of who you are.",
  "adjustments": [
    {
      "option": "Use emergency fund (recommended)",
      "impact": "Emergency fund: ₦250,000 → ₦150,000",
      "recovery": "Rebuild in 3 months at current savings rate"
    },
    {
      "option": "Adjust goal timeline",
      "impact": "Primary goal delayed by ~4 weeks",
      "recovery": "No monthly budget change needed"
    },
    {
      "option": "Temporary savings reduction",
      "impact": "This month: ₦50,000 → ₦0",
      "recovery": "Return to normal next month"
    }
  ],
  "insight": "Your dependency ratio will temporarily rise to 28%—still in the healthy orange zone."
}
```
