# Commitment Device Engine

**Week:** 2 | **Tier:** 1 | **Depends On:** [01-opik-integration](./01-opik-integration.md)

---

## Overview

The Commitment Device Engine creates **real stakes** for financial goals. Users can choose between Social Accountability (referee verification), Anti-Charity Stakes (donate to a cause you oppose if you fail), or Loss Pool (funds locked until goal achieved). Research shows users with stakes are **3x more likely to achieve goals**.

**Failure Mode Defeated:** Commitment Decay

**Why It Matters:**
- Users with stakes are 3x more likely to achieve goals (stickK.com data)
- Social accountability increases success rates by 65%
- Loss aversion is 2x stronger than gain motivation (Kahneman & Tversky)
- 78% of goals with referees are achieved vs. 35% without

---

## Technical Spec

### Trigger Mechanism

- User creates a new goal
- Goal milestone approaches (7 days, 3 days, 1 day)
- Referee verification request
- Stake enforcement deadline

### Interfaces

```typescript
// Step 1: Commitment Contract Definition
interface CommitmentContract {
  goalId: string;
  userId: string;
  stakeType: 'social' | 'anti_charity' | 'loss_pool';
  stakeAmount?: number;          // In user's currency
  antiCharityCause?: string;     // For anti-charity stakes
  refereeId?: string;            // For social accountability
  refereeEmail?: string;         // Referee notification
  verificationMethod: 'self_report' | 'referee_verify' | 'auto_detect';
  deadline: Date;
  status: 'active' | 'pending_verification' | 'succeeded' | 'failed';
}

// Step 3: Referee System
interface Referee {
  id: string;
  name: string;
  email: string;
  relationship: 'friend' | 'family' | 'colleague' | 'coach';
  verificationHistory: {
    goalId: string;
    verified: boolean;
    verifiedAt: Date;
    notes?: string;
  }[];
}
```

### Core Logic

```typescript
// Step 2: Stake Type Configurations
const stakeTypes = {
  social: {
    name: 'Social Accountability',
    description: 'Designate a referee who verifies your progress',
    requirements: ['refereeId', 'refereeEmail'],
    enforcement: 'Referee receives weekly updates and final verification request',
    successRate: 0.78  // 78% success with referee
  },
  anti_charity: {
    name: 'Anti-Charity Stakes',
    description: 'Pre-commit funds to a cause you oppose if you fail',
    requirements: ['stakeAmount', 'antiCharityCause'],
    enforcement: 'Funds automatically donated if goal not verified by deadline',
    suggestedCauses: [
      'Political party you oppose',
      'Sports rival team foundation',
      'Organization with opposing values'
    ],
    successRate: 0.85  // Loss aversion is powerful
  },
  loss_pool: {
    name: 'Loss Pool',
    description: 'Lock funds until goal achieved',
    requirements: ['stakeAmount'],
    enforcement: 'Funds locked in escrow, released only on goal completion',
    successRate: 0.72
  }
};
```

### Referee Notification Templates

```typescript
const refereeNotifications = {
  onGoalCreated: {
    subject: '{{userName}} needs your help staying accountable!',
    body: `Your friend {{userName}} has set a financial goal and chose you as their referee.

Goal: {{goalName}}
Target: {{targetAmount}}
Deadline: {{deadline}}

You'll receive weekly progress updates and a final verification request.
Your role: Verify whether they actually achieved the goal.

This accountability partnership increases success rates by 65%!`
  },
  weeklyUpdate: {
    subject: '{{userName}}'s progress update',
    body: `{{userName}} is {{progressPercent}}% toward their goal "{{goalName}}".

Current: {{currentAmount}} / {{targetAmount}}
Days remaining: {{daysRemaining}}

Keep encouraging them!`
  },
  verificationRequest: {
    subject: 'Please verify: Did {{userName}} achieve their goal?',
    body: `{{userName}}'s goal deadline has arrived!

Goal: {{goalName}}
Target: {{targetAmount}}
Final Amount: {{finalAmount}}

As their referee, please verify:
[✓ VERIFIED] - They achieved the goal
[✗ NOT VERIFIED] - They did not achieve the goal

Your honest verification helps them grow.`
  }
};
```

### Enforcement Logic

```typescript
// Step 4: Enforcement Logic
async function enforceCommitment(contract: CommitmentContract): Promise<void> {
  const goal = await getGoal(contract.goalId);

  if (contract.status !== 'pending_verification') return;

  const isVerified = await checkVerification(contract);

  if (isVerified) {
    // Success path
    contract.status = 'succeeded';
    if (contract.stakeType === 'loss_pool') {
      await releaseFunds(contract.userId, contract.stakeAmount);
    }
    await notifyUser(contract.userId, 'goal_achieved', {
      goalName: goal.name,
      message: "Congratulations! Your commitment paid off. Your 60-year-old self is smiling."
    });
  } else {
    // Failure path - enforce stakes
    contract.status = 'failed';
    switch (contract.stakeType) {
      case 'anti_charity':
        await processDonation(contract.stakeAmount, contract.antiCharityCause);
        await notifyUser(contract.userId, 'stake_enforced', {
          message: `Your anti-charity stake of ${formatCurrency(contract.stakeAmount)} has been donated to ${contract.antiCharityCause}. Use this feeling to fuel your next attempt.`
        });
        break;
      case 'loss_pool':
        await forfeitFunds(contract.userId, contract.stakeAmount);
        break;
      case 'social':
        await notifyReferee(contract.refereeId, 'goal_failed', {
          userName: await getUserName(contract.userId),
          goalName: goal.name
        });
        break;
    }
  }
}
```

### Non-Judgmental Failure Response

```typescript
// Step 5: Non-Judgmental Failure Response
const failureResponse = {
  tone: 'Supportive',
  headline: "This round didn't go as planned. That's data, not defeat.",
  subtext: "Research shows people who try again with adjusted stakes succeed 67% of the time.",
  nextSteps: [
    {
      action: 'Try again with same goal',
      suggestion: 'Consider a smaller target or longer timeline'
    },
    {
      action: 'Try different stake type',
      suggestion: 'Social accountability might work better for you'
    },
    {
      action: 'Talk to your future self',
      suggestion: 'Reconnect with why this goal matters'
    }
  ],
  NO_shame_words: ['failed', 'loser', 'gave up', 'weak', 'pathetic']
};
```

### Full Implementation

```typescript
// apps/api/src/modules/ai/agents/commitment-device.agent.ts
import { Injectable } from '@nestjs/common';
import { OpikService } from '../opik/opik.service';
import { GoalService } from '../../finance/goal.service';
import { NotificationService } from '../../notification/notification.service';
import { PaymentService } from '../../payment/payment.service';

@Injectable()
export class CommitmentDeviceAgent {
  constructor(
    private opikService: OpikService,
    private goalService: GoalService,
    private notificationService: NotificationService,
    private paymentService: PaymentService,
  ) {}

  async createCommitment(
    userId: string,
    goalId: string,
    stakeConfig: Partial<CommitmentContract>
  ): Promise<CommitmentContract> {
    const trace = this.opikService.createTrace('commitment_creation', { userId, goalId, stakeType: stakeConfig.stakeType });

    // Validate stake requirements
    const validationSpan = trace.span({ name: 'validate_stake', type: 'tool' });
    this.validateStakeRequirements(stakeConfig);
    validationSpan.end({ output: { valid: true } });

    // Create contract
    const contractSpan = trace.span({ name: 'create_contract', type: 'tool' });
    const contract: CommitmentContract = {
      goalId,
      userId,
      stakeType: stakeConfig.stakeType!,
      stakeAmount: stakeConfig.stakeAmount,
      antiCharityCause: stakeConfig.antiCharityCause,
      refereeId: stakeConfig.refereeId,
      refereeEmail: stakeConfig.refereeEmail,
      verificationMethod: stakeConfig.verificationMethod || 'self_report',
      deadline: stakeConfig.deadline!,
      status: 'active',
    };
    await this.goalService.saveCommitmentContract(contract);
    contractSpan.end({ output: { contractCreated: true } });

    // Process based on stake type
    if (contract.stakeType === 'social' && contract.refereeEmail) {
      await this.inviteReferee(contract);
    }

    if (contract.stakeType === 'anti_charity' || contract.stakeType === 'loss_pool') {
      await this.lockStakeFunds(contract);
    }

    trace.end({ output: { success: true, contractId: contract.goalId } });
    await this.opikService.flush();

    return contract;
  }

  private validateStakeRequirements(config: Partial<CommitmentContract>): void {
    const requirements = stakeTypes[config.stakeType!].requirements;

    for (const req of requirements) {
      if (!config[req as keyof CommitmentContract]) {
        throw new Error(`${config.stakeType} stake requires ${req}`);
      }
    }
  }

  private async inviteReferee(contract: CommitmentContract): Promise<void> {
    const user = await this.goalService.getUser(contract.userId);
    const goal = await this.goalService.getGoal(contract.goalId);

    await this.notificationService.sendEmail(contract.refereeEmail!, {
      template: 'referee_invitation',
      data: {
        userName: user.name,
        goalName: goal.name,
        targetAmount: goal.targetAmount,
        deadline: goal.deadline,
      },
    });
  }

  private async lockStakeFunds(contract: CommitmentContract): Promise<void> {
    await this.paymentService.lockFunds(
      contract.userId,
      contract.stakeAmount!,
      `commitment_${contract.goalId}`
    );
  }

  async sendWeeklyUpdate(contract: CommitmentContract): Promise<void> {
    if (contract.stakeType !== 'social' || !contract.refereeEmail) return;

    const user = await this.goalService.getUser(contract.userId);
    const goal = await this.goalService.getGoal(contract.goalId);
    const progress = await this.goalService.getProgress(contract.goalId);

    await this.notificationService.sendEmail(contract.refereeEmail, {
      template: 'weekly_update',
      data: {
        userName: user.name,
        goalName: goal.name,
        progressPercent: Math.round(progress.currentAmount / goal.targetAmount * 100),
        currentAmount: progress.currentAmount,
        targetAmount: goal.targetAmount,
        daysRemaining: Math.ceil((goal.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      },
    });
  }

  async requestVerification(contract: CommitmentContract): Promise<void> {
    const trace = this.opikService.createTrace('verification_request', { contractId: contract.goalId });

    contract.status = 'pending_verification';
    await this.goalService.saveCommitmentContract(contract);

    if (contract.stakeType === 'social' && contract.refereeEmail) {
      const user = await this.goalService.getUser(contract.userId);
      const goal = await this.goalService.getGoal(contract.goalId);
      const progress = await this.goalService.getProgress(contract.goalId);

      await this.notificationService.sendEmail(contract.refereeEmail, {
        template: 'verification_request',
        data: {
          userName: user.name,
          goalName: goal.name,
          targetAmount: goal.targetAmount,
          finalAmount: progress.currentAmount,
          verificationUrl: `${process.env.APP_URL}/verify/${contract.goalId}`,
        },
      });
    }

    trace.end({ output: { verificationRequested: true } });
    await this.opikService.flush();
  }

  async processVerification(contractId: string, verified: boolean, refereeNotes?: string): Promise<void> {
    const trace = this.opikService.createTrace('verification_processing', { contractId, verified });

    const contract = await this.goalService.getCommitmentContract(contractId);

    if (verified) {
      contract.status = 'succeeded';

      if (contract.stakeType === 'loss_pool') {
        await this.paymentService.releaseFunds(contract.userId, `commitment_${contract.goalId}`);
      }

      await this.notificationService.sendPush(contract.userId, {
        title: 'Goal Achieved! 🎉',
        body: "Congratulations! Your commitment paid off. Your 60-year-old self is smiling.",
      });
    } else {
      contract.status = 'failed';
      await this.enforceStakes(contract);
    }

    await this.goalService.saveCommitmentContract(contract);

    trace.end({ output: { processed: true, status: contract.status } });
    await this.opikService.flush();
  }

  private async enforceStakes(contract: CommitmentContract): Promise<void> {
    switch (contract.stakeType) {
      case 'anti_charity':
        await this.paymentService.processDonation(
          contract.userId,
          contract.stakeAmount!,
          contract.antiCharityCause!
        );
        await this.notificationService.sendPush(contract.userId, {
          title: 'Stake Enforced',
          body: `Your stake has been donated to ${contract.antiCharityCause}. Use this feeling to fuel your next attempt.`,
        });
        break;

      case 'loss_pool':
        await this.paymentService.forfeitFunds(contract.userId, `commitment_${contract.goalId}`);
        break;

      case 'social':
        // Social accountability - just notify
        await this.notificationService.sendPush(contract.userId, {
          title: "This round didn't go as planned",
          body: "That's data, not defeat. Research shows people who try again succeed 67% of the time.",
        });
        break;
    }
  }
}
```

---

## Stake Selection UI Flow

1. **Goal Creation** → User sets target and deadline
2. **Stakes Prompt** → "Add stakes to increase your success rate by 3x"
3. **Type Selection** → Choose between Social, Anti-Charity, or Loss Pool
4. **Configuration** → Set amount/referee based on type
5. **Confirmation** → "This commitment is binding. Are you ready?"
6. **Active Tracking** → Progress updates with stake reminder
7. **Share Your Commitment** → Generate story card to share on social media (optional)

---

## Integration with Other Agents

- **GPS Re-Router**: When budget slip detected, remind user of active stakes
- **Future Self Simulator**: Letters mention active commitments for motivation
- **Ubuntu Manager**: Stakes can be paused for family emergencies (with referee approval)
- **Story Cards**: Generate shareable "commitment" cards when stakes are created, and "milestone" cards when goals are achieved

---

## Implementation Checklist

- [ ] Create file: `apps/api/src/modules/ai/agents/commitment-device.agent.ts`
- [ ] Add Prisma models for `CommitmentContract`, `Referee`
- [ ] Create referee invitation system
- [ ] Implement stake locking with payment service
- [ ] Build verification flow
- [ ] Add enforcement cron job
- [ ] Create email templates
- [ ] Add Opik tracing spans
- [ ] Write unit tests
- [ ] Add Swagger documentation

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/commitment/stakes` | Create commitment contract with stakes |
| GET | `/v1/commitment/stakes/:goalId` | Get stakes for a specific goal |
| PUT | `/v1/commitment/stakes/:id` | Update stake configuration |
| DELETE | `/v1/commitment/stakes/:id` | Remove stakes (before deadline only) |
| POST | `/v1/commitment/verify/:id` | Referee verification endpoint |
| GET | `/v1/commitment/referee/pending` | Get pending verifications for referee |
| POST | `/v1/commitment/referee/invite` | Invite referee via email |

---

## Opik Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `StakeEffectiveness` | Percentage | Goal completion rate by stake type |
| `RefereeEngagement` | Percentage | How often referees verify vs. ignore |
| `CommitmentStrength` | Correlation | Stake amount vs. success rate |
| `RetryRate` | Percentage | Users who try again after failed commitment |
| `StakeTypeConversion` | Distribution | Which stake types users choose |

---

## Verification

### curl Commands

```bash
# Create commitment with social accountability
curl -X POST http://localhost:3000/v1/commitment/stakes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "goalId": "goal_123",
    "stakeType": "social",
    "refereeEmail": "sister@example.com",
    "verificationMethod": "referee_verify",
    "deadline": "2026-12-31"
  }'

# Create commitment with anti-charity stake
curl -X POST http://localhost:3000/v1/commitment/stakes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "goalId": "goal_123",
    "stakeType": "anti_charity",
    "stakeAmount": 50000,
    "antiCharityCause": "Opposing Political Party Foundation",
    "deadline": "2026-12-31"
  }'

# Referee verification
curl -X POST http://localhost:3000/v1/commitment/verify/goal_123 \
  -H "Content-Type: application/json" \
  -d '{
    "verified": true,
    "notes": "Confirmed via bank statement"
  }'
```

### Expected Response (POST /v1/commitment/stakes)

```json
{
  "goalId": "goal_123",
  "userId": "user_456",
  "stakeType": "social",
  "refereeEmail": "sister@example.com",
  "verificationMethod": "referee_verify",
  "deadline": "2026-12-31T00:00:00.000Z",
  "status": "active",
  "refereeInvited": true,
  "message": "Your commitment is now active. Your referee has been notified. Success rate with social accountability: 78%"
}
```
