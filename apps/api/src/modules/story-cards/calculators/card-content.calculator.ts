/**
 * Card Content Calculator
 *
 * Generates headlines, metrics, quotes, and styling for each card type.
 * Implements content generation strategies for viral story cards.
 */

import { Injectable } from '@nestjs/common';
import { StoryCardType } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';
import {
  CardContent,
  SourceData,
  PrivacySettings,
  FutureSelfSource,
  CommitmentSource,
  MilestoneSource,
  RecoverySource,
} from '../interfaces';
import {
  GRADIENTS_BY_TYPE,
  HASHTAGS_BY_TYPE,
  STORY_CARD_LIMITS,
} from '../constants';

/**
 * Sanitize HTML configuration for quote extraction
 * Strips all HTML tags and dangerous content to prevent XSS
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [], // Strip ALL HTML tags
  allowedAttributes: {}, // No attributes allowed
  disallowedTagsMode: 'recursiveEscape', // Escape content inside disallowed tags
  textFilter: (text: string) => {
    // Remove any remaining HTML entities that could be harmful
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  },
};

@Injectable()
export class CardContentCalculator {
  /**
   * Generate content for a story card based on type and source data
   */
  generateContent(
    type: StoryCardType,
    sourceData: SourceData,
    privacy: PrivacySettings,
  ): CardContent {
    switch (type) {
      case 'FUTURE_SELF':
        return this.generateFutureSelfContent(
          sourceData.data as FutureSelfSource,
          privacy,
        );
      case 'COMMITMENT':
        return this.generateCommitmentContent(
          sourceData.data as CommitmentSource,
          privacy,
        );
      case 'MILESTONE':
        return this.generateMilestoneContent(
          sourceData.data as MilestoneSource,
          privacy,
        );
      case 'RECOVERY':
        return this.generateRecoveryContent(
          sourceData.data as RecoverySource,
          privacy,
        );
      default:
        throw new Error(`Unknown card type: ${type}`);
    }
  }

  /**
   * Generate content for Future Self card type
   *
   * Shows the emotional impact of receiving a letter from your future self.
   */
  private generateFutureSelfContent(
    source: FutureSelfSource,
    privacy: PrivacySettings,
  ): CardContent {
    // Calculate the metric value based on privacy settings
    const metricValue = this.formatMetricValue(
      source.wealthDifference20yr,
      source.currentNetWorth,
      privacy,
      'wealth_gain',
    );

    // Extract a compelling quote from the letter
    const quote = this.extractQuote(source.content);

    // Select gradient with index for A/B tracking
    const { gradient, index: gradientIndex } =
      this.selectGradient('FUTURE_SELF');

    return {
      headline: 'A Letter From My Future Self',
      subheadline: `Just received a letter from my ${source.futureAge}-year-old self`,
      keyMetric: {
        label: 'Potential 20-year wealth gain',
        value: metricValue,
      },
      quote,
      hashtags: [...HASHTAGS_BY_TYPE.FUTURE_SELF],
      gradient,
      gradientIndex,
    };
  }

  /**
   * Generate content for Commitment card type
   *
   * Highlights the commitment made and the stakes involved.
   */
  private generateCommitmentContent(
    source: CommitmentSource,
    privacy: PrivacySettings,
  ): CardContent {
    // Format stake information based on privacy settings
    const stakeLabel = this.formatStakeType(source.stakeType);
    const metricValue = this.formatStakeMetric(source, privacy);

    // Generate a compelling subheadline based on stake type
    const subheadline = this.generateCommitmentSubheadline(source);

    // Select gradient with index for A/B tracking
    const { gradient, index: gradientIndex } =
      this.selectGradient('COMMITMENT');

    return {
      headline: 'I Made a Commitment',
      subheadline,
      keyMetric: {
        label: stakeLabel,
        value: metricValue,
      },
      hashtags: [...HASHTAGS_BY_TYPE.COMMITMENT],
      gradient,
      gradientIndex,
    };
  }

  /**
   * Generate content for Milestone card type
   *
   * Celebrates goal achievement with impressive metrics.
   */
  private generateMilestoneContent(
    source: MilestoneSource,
    privacy: PrivacySettings,
  ): CardContent {
    // Format the achievement metric
    const metricValue = this.formatMetricValue(
      source.targetAmount,
      source.targetAmount,
      privacy,
      'goal_amount',
    );

    // Calculate achievement timeframe
    const timeframe = this.formatTimeframe(source.daysToAchieve);

    // Select gradient with index for A/B tracking
    const { gradient, index: gradientIndex } =
      this.selectGradient('MILESTONE');

    return {
      headline: 'Goal Achieved!',
      subheadline: `Reached my ${source.goalName} goal in ${timeframe}`,
      keyMetric: {
        label: 'Goal Amount',
        value: metricValue,
      },
      hashtags: [...HASHTAGS_BY_TYPE.MILESTONE],
      gradient,
      gradientIndex,
    };
  }

  /**
   * Generate content for Recovery card type
   *
   * Shows resilience and getting back on track.
   */
  private generateRecoveryContent(
    source: RecoverySource,
    _privacy: PrivacySettings,
  ): CardContent {
    // Calculate probability restored percentage
    const probabilityRestored = Math.round(source.probabilityRestored * 100);

    // Format the recovery path name
    const pathName = this.formatRecoveryPath(source.selectedPath);

    // Select gradient with index for A/B tracking
    const { gradient, index: gradientIndex } = this.selectGradient('RECOVERY');

    return {
      headline: 'Back on Track',
      subheadline: `Recovered from a spending slip in ${source.category}`,
      keyMetric: {
        label: 'Goal probability restored',
        value: `+${probabilityRestored}%`,
      },
      quote: `Chose the "${pathName}" recovery path`,
      hashtags: [...HASHTAGS_BY_TYPE.RECOVERY],
      gradient,
      gradientIndex,
    };
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Format metric value based on privacy settings
   */
  private formatMetricValue(
    amount: number,
    baseAmount: number,
    privacy: PrivacySettings,
    type: 'wealth_gain' | 'goal_amount' | 'stake_amount',
  ): string {
    if (privacy.anonymizeAmounts && !privacy.revealActualNumbers) {
      // Show as percentage
      const percentage = Math.round((amount / baseAmount) * 100);
      return type === 'wealth_gain' ? `+${percentage}%` : `${percentage}%`;
    }

    // Show actual amount (formatted)
    return this.formatCurrency(amount);
  }

  /**
   * Format currency amount
   */
  private formatCurrency(amount: number): string {
    if (amount >= 1000000000) {
      return `₦${(amount / 1000000000).toFixed(1)}B`;
    }
    if (amount >= 1000000) {
      return `₦${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `₦${(amount / 1000).toFixed(0)}K`;
    }
    return `₦${amount.toLocaleString()}`;
  }

  /**
   * Extract a compelling quote from letter content
   *
   * Uses multi-currency patterns and sentence scoring for better extraction.
   * SECURITY: All extracted quotes are sanitized to prevent XSS attacks.
   */
  private extractQuote(content: string): string | undefined {
    // SECURITY: Sanitize input content first to remove any HTML/scripts
    const sanitizedContent = this.sanitizeText(content);

    // Multi-currency patterns for international support
    const currencySymbols = '₦\\$€£¥₹';
    const emotionalPatterns = [
      // Money-related sentences with any currency
      new RegExp(`That [${currencySymbols}][\\d,]+.*?[.!]`, 'i'),
      new RegExp(`[${currencySymbols}][\\d,]+.*?became.*?[.!]`, 'i'),
      // Emotional/motivational sentences
      /I'm so proud.*?[.!]/i,
      /Remember when.*?[.!]/i,
      /Your [\w]+ today.*?[.!]/i,
      /The [\w]+ you.*?[.!]/i,
      /Look at what.*?[.!]/i,
      /You did it.*?[.!]/i,
      /This is just the beginning.*?[.!]/i,
    ];

    for (const pattern of emotionalPatterns) {
      const match = sanitizedContent.match(pattern);
      if (match && match[0].length <= STORY_CARD_LIMITS.MAX_QUOTE_LENGTH) {
        return this.cleanQuote(match[0].trim());
      }
    }

    // Fallback: Find best sentence by scoring
    return this.findBestSentence(sanitizedContent);
  }

  /**
   * Clean a quote by removing common prefixes and sanitizing content
   *
   * SECURITY: Sanitizes the quote to strip HTML tags and dangerous content.
   */
  private cleanQuote(quote: string): string {
    // SECURITY: Sanitize first to remove any HTML/scripts
    const sanitized = this.sanitizeText(quote);

    // Remove leading "Dear future me," or similar
    return sanitized
      .replace(/^(Dear.*?,\s*)/i, '')
      .replace(/^\s*-\s*/, '')
      .trim();
  }

  /**
   * Sanitize text by stripping all HTML tags and dangerous content
   *
   * SECURITY: This method prevents XSS attacks by removing HTML tags,
   * script content, and other potentially malicious content from text.
   *
   * @param text - The text to sanitize
   * @returns Sanitized plain text
   */
  private sanitizeText(text: string): string {
    if (!text) {
      return '';
    }

    // Use sanitize-html to strip all HTML tags and dangerous content
    return sanitizeHtml(text, SANITIZE_OPTIONS).trim();
  }

  /**
   * Find the best sentence in content using engagement scoring
   */
  private findBestSentence(content: string): string | undefined {
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];

    // Score sentences by engagement potential
    const scoredSentences = sentences.map((s) => ({
      sentence: s.trim(),
      score: this.scoreSentence(s),
    }));

    // Filter by length and sort by score
    const valid = scoredSentences
      .filter(
        (s) =>
          s.sentence.length >= 30 &&
          s.sentence.length <= STORY_CARD_LIMITS.MAX_QUOTE_LENGTH,
      )
      .sort((a, b) => b.score - a.score);

    return valid[0]?.sentence;
  }

  /**
   * Score a sentence by engagement potential
   *
   * Higher scores indicate more shareable content.
   */
  private scoreSentence(sentence: string): number {
    let score = 0;

    // Positive indicators
    if (/you|your/i.test(sentence)) score += 2;
    if (/proud|amazing|incredible|achieve/i.test(sentence)) score += 3;
    if (/₦|\$|€|£|¥|₹/.test(sentence)) score += 2; // Has currency
    if (/future|journey|goal/i.test(sentence)) score += 1;
    if (/!$/.test(sentence)) score += 1; // Excitement

    // Negative indicators
    if (/dear|sincerely|regards/i.test(sentence)) score -= 3;
    if (sentence.length < 40) score -= 1;

    return score;
  }

  /**
   * Format stake type for display
   */
  private formatStakeType(stakeType: string): string {
    switch (stakeType) {
      case 'SOCIAL':
        return 'Accountability partner';
      case 'ANTI_CHARITY':
        return 'Anti-charity stake';
      case 'LOSS_POOL':
        return 'Funds at stake';
      default:
        return 'Commitment stake';
    }
  }

  /**
   * Format stake metric based on type and privacy
   */
  private formatStakeMetric(
    source: CommitmentSource,
    privacy: PrivacySettings,
  ): string {
    if (source.stakeType === 'SOCIAL') {
      return `${Math.round(source.successProbability * 100)}% success rate`;
    }

    if (source.stakeAmount) {
      if (privacy.anonymizeAmounts && !privacy.revealActualNumbers) {
        return `${Math.round(source.successProbability * 100 * 3)}% more likely`;
      }
      return this.formatCurrency(source.stakeAmount);
    }

    return `${Math.round(source.successProbability * 100)}% success rate`;
  }

  /**
   * Generate subheadline for commitment cards
   */
  private generateCommitmentSubheadline(source: CommitmentSource): string {
    const daysUntil = Math.ceil(
      (source.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    const timeframe = this.formatTimeframe(daysUntil);

    switch (source.stakeType) {
      case 'SOCIAL':
        return `Committed to my ${source.goalName} goal with an accountability partner`;
      case 'ANTI_CHARITY':
        return `Put money on the line for my ${source.goalName} goal`;
      case 'LOSS_POOL':
        return `Locked funds until I achieve my ${source.goalName} goal`;
      default:
        return `Made a commitment to achieve ${source.goalName} in ${timeframe}`;
    }
  }

  /**
   * Format timeframe for display
   */
  private formatTimeframe(days: number): string {
    if (days < 0) {
      return 'record time';
    }
    if (days === 0) {
      return 'today';
    }
    if (days === 1) {
      return '1 day';
    }
    if (days < 7) {
      return `${days} days`;
    }
    if (days < 30) {
      const weeks = Math.round(days / 7);
      return weeks === 1 ? '1 week' : `${weeks} weeks`;
    }
    if (days < 365) {
      const months = Math.round(days / 30);
      return months === 1 ? '1 month' : `${months} months`;
    }
    const years = Math.round(days / 365);
    return years === 1 ? '1 year' : `${years} years`;
  }

  /**
   * Format recovery path name for display
   */
  private formatRecoveryPath(path: string): string {
    // Convert snake_case or camelCase to Title Case
    return path
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }

  /**
   * Select a gradient for the card type
   *
   * Randomly selects from available gradients for variety.
   * Returns both the gradient and its index for A/B testing analytics.
   */
  private selectGradient(
    type: StoryCardType,
  ): { gradient: [string, string]; index: number } {
    const gradients = GRADIENTS_BY_TYPE[type];
    const index = Math.floor(Math.random() * gradients.length);
    return {
      gradient: [...gradients[index]] as [string, string],
      index,
    };
  }
}
