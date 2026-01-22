# Story Cards

**Week:** 3 | **Tier:** Addon | **Depends On:** [07-future-self](./07-future-self.md), [06-commitment-device](./06-commitment-device.md)

---

## Overview

Story Cards generate beautiful, shareable cards that capture the user's financial journey for social media. They create **viral growth potential** by allowing users to share their Future Self letters, commitment milestones, and recovery stories.

**Why It Matters:**
- Viral coefficient for organic growth
- Celebrates user achievements publicly (with consent)
- Creates social proof for IKPA
- Reinforces user commitment through public declaration

---

## Technical Spec

### Interfaces

```typescript
// SHAREABLE STORY CARDS: Viral potential for organic growth

interface StoryCard {
  type: 'future_self' | 'commitment' | 'milestone' | 'recovery';
  userId: string;
  generatedAt: Date;

  // Visual elements
  headline: string;           // "My 60-year-old self wrote me a letter"
  subheadline: string;        // "Here's what changed everything"
  keyMetric: {
    label: string;            // "Potential Net Worth Difference"
    value: string;            // "₦16,000,000"
  };
  quote?: string;             // Excerpt from future self letter

  // Sharing metadata
  shareUrl: string;
  platforms: ('twitter' | 'linkedin' | 'whatsapp' | 'instagram')[];
  hashtags: string[];         // ['#IKPA', '#FinancialFreedom', '#FutureSelf']
}
```

### Story Card Templates

```typescript
// Story Card Templates
const storyCardTemplates = {
  future_self: {
    headline: "I talked to my 60-year-old self",
    subheadline: "The conversation that changed my financial future",
    gradient: ['#667eea', '#764ba2'],
    includeQuote: true
  },
  commitment: {
    headline: "I put my money where my goals are",
    subheadline: "{{stakeType}} activated for {{goalName}}",
    gradient: ['#f093fb', '#f5576c'],
    includeReferee: true
  },
  milestone: {
    headline: "Goal Achieved! 🎉",
    subheadline: "{{goalName}} - {{daysToComplete}} days of commitment",
    gradient: ['#4facfe', '#00f2fe'],
    includeStats: true
  },
  recovery: {
    headline: "I made a wrong turn. Then I recalculated.",
    subheadline: "Back on track with {{recoveryPath}}",
    gradient: ['#43e97b', '#38f9d7'],
    includeMessage: true
  }
};
```

### Core Logic

```typescript
// Generate shareable card
async function generateStoryCard(
  userId: string,
  type: StoryCard['type'],
  context: Record<string, any>
): Promise<StoryCard> {
  const template = storyCardTemplates[type];
  const userData = await getUserData(userId);

  return {
    type,
    userId,
    generatedAt: new Date(),
    headline: template.headline,
    subheadline: interpolate(template.subheadline, context),
    keyMetric: generateKeyMetric(type, context),
    quote: type === 'future_self' ? context.letterExcerpt : undefined,
    shareUrl: generateShareUrl(userId, type),
    platforms: ['twitter', 'linkedin', 'whatsapp', 'instagram'],
    hashtags: ['#IKPA', '#FinancialFreedom', `#${type.replace('_', '')}`]
  };
}
```

### Full Implementation

```typescript
// apps/api/src/modules/story-cards/story-cards.service.ts
import { Injectable } from '@nestjs/common';
import { OpikService } from '../ai/opik/opik.service';
import { ConfigService } from '@nestjs/config';
import { nanoid } from 'nanoid';

interface StoryCardTemplate {
  headline: string;
  subheadline: string;
  gradient: [string, string];
  includeQuote?: boolean;
  includeReferee?: boolean;
  includeStats?: boolean;
  includeMessage?: boolean;
}

@Injectable()
export class StoryCardsService {
  private readonly templates: Record<string, StoryCardTemplate> = {
    future_self: {
      headline: "I talked to my 60-year-old self",
      subheadline: "The conversation that changed my financial future",
      gradient: ['#667eea', '#764ba2'],
      includeQuote: true,
    },
    commitment: {
      headline: "I put my money where my goals are",
      subheadline: "{{stakeType}} activated for {{goalName}}",
      gradient: ['#f093fb', '#f5576c'],
      includeReferee: true,
    },
    milestone: {
      headline: "Goal Achieved!",
      subheadline: "{{goalName}} - {{daysToComplete}} days of commitment",
      gradient: ['#4facfe', '#00f2fe'],
      includeStats: true,
    },
    recovery: {
      headline: "I made a wrong turn. Then I recalculated.",
      subheadline: "Back on track with {{recoveryPath}}",
      gradient: ['#43e97b', '#38f9d7'],
      includeMessage: true,
    },
  };

  constructor(
    private opikService: OpikService,
    private configService: ConfigService,
  ) {}

  async generateStoryCard(
    userId: string,
    type: StoryCard['type'],
    context: Record<string, any>
  ): Promise<StoryCard> {
    const trace = this.opikService.createTrace('story_card_generation', { userId, type });

    const template = this.templates[type];
    const cardId = nanoid(10);

    const card: StoryCard = {
      type,
      userId,
      generatedAt: new Date(),
      headline: template.headline,
      subheadline: this.interpolate(template.subheadline, context),
      keyMetric: this.generateKeyMetric(type, context),
      quote: template.includeQuote ? context.letterExcerpt : undefined,
      shareUrl: this.generateShareUrl(cardId),
      platforms: ['twitter', 'linkedin', 'whatsapp', 'instagram'],
      hashtags: this.generateHashtags(type),
      gradient: template.gradient,
      id: cardId,
    };

    // Apply privacy controls
    if (context.anonymize !== false) {
      card.keyMetric = this.anonymizeMetric(card.keyMetric);
    }

    // Save card to database
    await this.saveCard(card);

    trace.end({ output: { cardId, type } });
    await this.opikService.flush();

    return card;
  }

  private generateKeyMetric(type: string, context: Record<string, any>): StoryCard['keyMetric'] {
    switch (type) {
      case 'future_self':
        return {
          label: 'Potential Net Worth Difference',
          value: `₦${(context.difference20yr || 0).toLocaleString()}`,
        };
      case 'commitment':
        return {
          label: 'Stake Type',
          value: this.formatStakeType(context.stakeType),
        };
      case 'milestone':
        return {
          label: 'Goal Amount',
          value: `₦${(context.goalAmount || 0).toLocaleString()}`,
        };
      case 'recovery':
        return {
          label: 'Probability Restored',
          value: `${Math.round((context.probabilityRestored || 0) * 100)}%`,
        };
      default:
        return { label: '', value: '' };
    }
  }

  private formatStakeType(stakeType: string): string {
    const labels: Record<string, string> = {
      social: 'Social Accountability',
      anti_charity: 'Anti-Charity Stakes',
      loss_pool: 'Loss Pool',
    };
    return labels[stakeType] || stakeType;
  }

  private anonymizeMetric(metric: StoryCard['keyMetric']): StoryCard['keyMetric'] {
    // Convert absolute values to percentages/ratios for privacy
    if (metric.value.startsWith('₦')) {
      // Keep the metric but indicate it's anonymized
      return {
        label: metric.label,
        value: metric.value, // In production: convert to percentage or range
      };
    }
    return metric;
  }

  private interpolate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
  }

  private generateShareUrl(cardId: string): string {
    const baseUrl = this.configService.get('APP_URL', 'https://ikpa.app');
    return `${baseUrl}/share/${cardId}`;
  }

  private generateHashtags(type: string): string[] {
    const baseHashtags = ['#IKPA', '#FinancialFreedom'];
    const typeHashtags: Record<string, string[]> = {
      future_self: ['#FutureSelf', '#LetterFromTheFuture'],
      commitment: ['#Commitment', '#Accountability'],
      milestone: ['#GoalAchieved', '#Winning'],
      recovery: ['#Recovery', '#BackOnTrack'],
    };
    return [...baseHashtags, ...(typeHashtags[type] || [])];
  }

  async trackShare(cardId: string, platform: string): Promise<void> {
    const trace = this.opikService.createTrace('story_card_share', { cardId, platform });

    await this.incrementShareCount(cardId, platform);

    trace.end({ output: { shared: true, platform } });
    await this.opikService.flush();
  }

  private async saveCard(card: StoryCard): Promise<void> {
    // Save to database
  }

  private async incrementShareCount(cardId: string, platform: string): Promise<void> {
    // Increment share count in database
  }
}
```

### Controller

```typescript
// apps/api/src/modules/story-cards/story-cards.controller.ts
import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { StoryCardsService } from './story-cards.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Story Cards')
@Controller('v1/story-cards')
@UseGuards(JwtAuthGuard)
export class StoryCardsController {
  constructor(private storyCardsService: StoryCardsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a shareable story card' })
  async generateCard(
    @CurrentUser() user: User,
    @Body() dto: GenerateStoryCardDto
  ): Promise<StoryCard> {
    return this.storyCardsService.generateStoryCard(user.id, dto.type, dto.context);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a generated story card' })
  async getCard(@Param('id') id: string): Promise<StoryCard> {
    return this.storyCardsService.getCard(id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all story cards for a user' })
  async getUserCards(@Param('userId') userId: string): Promise<StoryCard[]> {
    return this.storyCardsService.getUserCards(userId);
  }

  @Post(':id/share')
  @ApiOperation({ summary: 'Track a share event' })
  async trackShare(
    @Param('id') id: string,
    @Body() dto: TrackShareDto
  ): Promise<void> {
    await this.storyCardsService.trackShare(id, dto.platform);
  }
}
```

---

## Story Card Triggers

| Trigger | Card Type | When Generated |
|---------|-----------|----------------|
| Future Self | `future_self` | After reading letter from 2045 (with user consent) |
| Commitment | `commitment` | When user creates a commitment with stakes |
| Milestone | `milestone` | When goal is verified as achieved |
| Recovery | `recovery` | When user successfully completes a recovery path |

---

## Privacy Controls

```typescript
// Privacy settings for story cards
interface PrivacySettings {
  anonymizeAmounts: boolean;      // Default: true - shows percentages instead of ₦ amounts
  revealActualNumbers: boolean;   // User can opt-in to show real numbers
  includePersonalData: boolean;   // Default: false - no name/city in card
  requirePreview: boolean;        // Default: true - show preview before share
}

// Example: Anonymized vs. Revealed
// Anonymized: "Potential difference: 133% increase"
// Revealed: "Potential difference: ₦16,000,000"
```

---

## Visual Design Spec

```typescript
// Card dimensions for each platform
const cardDimensions = {
  twitter: { width: 1200, height: 675 },    // 16:9
  linkedin: { width: 1200, height: 627 },   // 1.91:1
  instagram: { width: 1080, height: 1080 }, // 1:1
  whatsapp: { width: 800, height: 418 },    // ~1.91:1
};

// Card visual structure
interface CardVisual {
  background: {
    type: 'gradient';
    colors: [string, string];
    direction: 'to-bottom-right';
  };
  logo: {
    position: 'top-left';
    size: 'small';
  };
  headline: {
    position: 'center-top';
    fontSize: 'large';
    color: 'white';
    fontWeight: 'bold';
  };
  keyMetric: {
    position: 'center';
    fontSize: 'xlarge';
    color: 'white';
  };
  quote: {
    position: 'center-bottom';
    fontSize: 'medium';
    color: 'white';
    maxLines: 3;
  };
  hashtags: {
    position: 'bottom';
    fontSize: 'small';
    color: 'white-70';
  };
}
```

---

## Implementation Checklist

- [ ] Create file: `apps/api/src/modules/story-cards/story-cards.module.ts`
- [ ] Create file: `apps/api/src/modules/story-cards/story-cards.service.ts`
- [ ] Create file: `apps/api/src/modules/story-cards/story-cards.controller.ts`
- [ ] Create template files for each card type
- [ ] Add Prisma model for `StoryCard`, `ShareEvent`
- [ ] Implement privacy controls
- [ ] Build card image generation (Canvas/Sharp)
- [ ] Add share tracking analytics
- [ ] Create public share page endpoint
- [ ] Add Opik tracing
- [ ] Write unit tests
- [ ] Add Swagger documentation

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/story-cards/generate` | Generate story card for sharing |
| GET | `/v1/story-cards/:id` | Get generated story card |
| GET | `/v1/story-cards/user/:userId` | Get all story cards for user |
| POST | `/v1/story-cards/:id/share` | Track share event by platform |

---

## Opik Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `StoryCardShares` | Counter | Number of cards shared by platform |
| `ViralCoefficient` | Ratio | New signups attributed to shared cards |
| `CardGenerationRate` | Counter | Cards generated per card type |
| `ShareConversion` | Percentage | Views that result in shares |

---

## Verification

### curl Commands

```bash
# Generate a future_self story card
curl -X POST http://localhost:3000/v1/story-cards/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "future_self",
    "context": {
      "letterExcerpt": "That ₦20,000 you saved in January 2026? It became ₦180,000 by now.",
      "difference20yr": 16000000
    }
  }'

# Generate a commitment story card
curl -X POST http://localhost:3000/v1/story-cards/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "commitment",
    "context": {
      "stakeType": "social",
      "goalName": "House Down Payment",
      "refereeName": "Funke"
    }
  }'

# Track share event
curl -X POST http://localhost:3000/v1/story-cards/abc123/share \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter"
  }'
```

### Expected Response (POST /v1/story-cards/generate)

```json
{
  "id": "abc123xyz",
  "type": "future_self",
  "userId": "user_456",
  "generatedAt": "2026-01-16T10:00:00.000Z",
  "headline": "I talked to my 60-year-old self",
  "subheadline": "The conversation that changed my financial future",
  "keyMetric": {
    "label": "Potential Net Worth Difference",
    "value": "₦16,000,000"
  },
  "quote": "That ₦20,000 you saved in January 2026? It became ₦180,000 by now.",
  "shareUrl": "https://ikpa.app/share/abc123xyz",
  "platforms": ["twitter", "linkedin", "whatsapp", "instagram"],
  "hashtags": ["#IKPA", "#FinancialFreedom", "#FutureSelf", "#LetterFromTheFuture"],
  "gradient": ["#667eea", "#764ba2"]
}
```

### Share Page (Public)

```
GET https://ikpa.app/share/abc123xyz

Returns: Beautiful rendered card with:
- Open Graph meta tags for social previews
- Download button for image
- "Try IKPA" call-to-action
- Referral tracking
```
