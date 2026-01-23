/**
 * Content Moderation Service
 *
 * Validates generated content to ensure letters don't contain:
 * - Harmful financial advice (specific investment recommendations)
 * - Inappropriate content (profanity, discrimination)
 * - Misleading claims (guaranteed returns, unrealistic promises)
 *
 * This is a safety layer between LLM generation and user delivery.
 *
 * Features:
 * - Unicode normalization to prevent homoglyph attacks
 * - Leetspeak and character substitution detection
 * - Spacing/separator bypass prevention
 * - Diacritics removal for consistent matching
 */

import { Injectable, Logger } from '@nestjs/common';

/**
 * Result of content moderation check
 */
export interface ModerationResult {
  /** Whether the content passed moderation */
  passed: boolean;
  /** Flags that were triggered */
  flags: string[];
  /** Severity level (info, warning, critical) */
  severity: 'passed' | 'info' | 'warning' | 'critical';
  /** Optional sanitized content (if auto-fix was possible) */
  sanitizedContent?: string;
}

/**
 * Moderation rule definition
 */
interface ModerationRule {
  /** Rule identifier */
  id: string;
  /** Pattern to match (case-insensitive) */
  pattern: RegExp;
  /** Severity if matched */
  severity: 'info' | 'warning' | 'critical';
  /** Description for logging */
  description: string;
  /** Whether to apply text normalization before matching */
  requiresNormalization?: boolean;
}

// ==========================================
// TEXT NORMALIZATION UTILITIES
// ==========================================

/**
 * Common homoglyph mappings (characters that look similar)
 * Maps Unicode lookalikes to their ASCII equivalents
 */
const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic lookalikes
  'а': 'a', 'с': 'c', 'е': 'e', 'о': 'o', 'р': 'p', 'х': 'x', 'у': 'y',
  'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'К': 'K', 'М': 'M',
  'О': 'O', 'Р': 'P', 'Т': 'T', 'Х': 'X',
  // Greek lookalikes
  'α': 'a', 'β': 'b', 'ε': 'e', 'η': 'n', 'ι': 'i', 'κ': 'k', 'ν': 'v',
  'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x',
  // Common substitutions
  '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
  '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
  'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e',
  'ｆ': 'f', 'ｇ': 'g', 'ｈ': 'h', 'ｉ': 'i', 'ｊ': 'j',
  'ｋ': 'k', 'ｌ': 'l', 'ｍ': 'm', 'ｎ': 'n', 'ｏ': 'o',
  'ｐ': 'p', 'ｑ': 'q', 'ｒ': 'r', 'ｓ': 's', 'ｔ': 't',
  'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x', 'ｙ': 'y', 'ｚ': 'z',
};

/**
 * Leetspeak character substitutions
 */
const LEETSPEAK_MAP: Record<string, string> = {
  '@': 'a', '4': 'a', '^': 'a',
  '8': 'b',
  '(': 'c', '<': 'c', '{': 'c',
  '3': 'e', '€': 'e',
  '6': 'g', '9': 'g',
  '#': 'h',
  '1': 'i', '!': 'i', '|': 'i',
  '7': 't', '+': 't',
  '0': 'o',
  '5': 's', '$': 's',
  '2': 'z',
  '*': '',  // Remove asterisks used as censoring
};

/**
 * Normalize text for consistent pattern matching
 *
 * This function handles common bypass techniques:
 * 1. Unicode homoglyphs (Cyrillic/Greek lookalikes)
 * 2. Leetspeak substitutions
 * 3. Diacritics/accents removal
 * 4. Separator/spacing removal between characters
 * 5. Case normalization
 */
function normalizeText(text: string): string {
  let normalized = text;

  // Step 1: Unicode NFC normalization
  normalized = normalized.normalize('NFC');

  // Step 2: Remove diacritics (é → e, ü → u, etc.)
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Step 3: Replace homoglyphs
  normalized = normalized
    .split('')
    .map((char) => HOMOGLYPH_MAP[char] || char)
    .join('');

  // Step 4: Replace leetspeak characters
  normalized = normalized
    .split('')
    .map((char) => LEETSPEAK_MAP[char] || char)
    .join('');

  // Step 5: Remove separators between letters (f.u.c.k → fuck, f u c k → fuck)
  // Only collapse if pattern looks like separated letters
  normalized = normalized.replace(/(\w)[.\-_\s]+(?=\w)/g, '$1');

  // Step 6: Convert to lowercase
  normalized = normalized.toLowerCase();

  return normalized;
}

@Injectable()
export class ContentModerationService {
  private readonly logger = new Logger(ContentModerationService.name);

  /**
   * Content moderation rules
   *
   * These patterns flag potentially problematic content in generated letters.
   * Rules are ordered by severity (critical first).
   *
   * Rules with `requiresNormalization: true` are checked against normalized text
   * to detect bypass attempts (homoglyphs, leetspeak, spacing).
   */
  private readonly rules: ModerationRule[] = [
    // Critical: Content that should never appear
    {
      id: 'SPECIFIC_INVESTMENT',
      pattern: /\b(buy|sell|invest in)\s+(bitcoin|ethereum|crypto|stock|shares?\s+of\s+\w+)/i,
      severity: 'critical',
      description: 'Specific investment recommendations',
    },
    {
      id: 'GUARANTEED_RETURNS',
      pattern: /\b(guaranteed|certain|definite|100%|risk-free)\s+(returns?|gains?|profits?|growth)/i,
      severity: 'critical',
      description: 'Unrealistic return promises',
    },
    {
      id: 'GET_RICH_QUICK',
      pattern: /\b(get rich quick|easy money|make millions fast|overnight success|instant wealth)/i,
      severity: 'critical',
      description: 'Get-rich-quick schemes',
      requiresNormalization: true,
    },
    {
      id: 'PROFANITY',
      pattern: /\b(fuck|shit|damn|hell|ass|bitch|bastard)\b/i,
      severity: 'critical',
      description: 'Profanity detected',
      requiresNormalization: true, // Important: catch f*ck, sh!t, etc.
    },
    {
      id: 'DISCRIMINATION',
      pattern: /\b(because you're|due to your)\s+(race|gender|religion|ethnicity|tribe)/i,
      severity: 'critical',
      description: 'Discriminatory language',
    },
    // Additional profanity patterns for common variations
    {
      id: 'PROFANITY_VARIANTS',
      pattern: /\b(fck|fuk|fuq|sht|btch|a55|azz|d4mn)\b/i,
      severity: 'critical',
      description: 'Profanity variant detected',
    },

    // Warning: Content that should be reviewed
    {
      id: 'SPECIFIC_AMOUNT',
      pattern: /\b(exactly|precisely)\s+(₦|NGN|GHS|KES|ZAR|EGP|\$|USD)\s*\d{6,}/i,
      severity: 'warning',
      description: 'Very specific large amount prediction',
    },
    {
      id: 'FINANCIAL_ADVICE_DISCLAIMER',
      pattern: /\b(not financial advice|consult a financial advisor|professional advice)\b/i,
      severity: 'info',
      description: 'Contains appropriate disclaimer',
    },
    {
      id: 'URGENT_ACTION',
      pattern: /\b(act now|don't wait|immediately|urgent|time-sensitive)\b/i,
      severity: 'warning',
      description: 'Urgency language that could pressure users',
    },
    {
      id: 'COMPARISON_TO_OTHERS',
      pattern: /\b(unlike others|most people fail|you're special because|others can't)\b/i,
      severity: 'warning',
      description: 'Potentially manipulative comparison language',
    },

    // Info: Content that's fine but notable
    {
      id: 'CURRENCY_MENTION',
      pattern: /₦\d{1,3}(,\d{3})*|\d{1,3}(,\d{3})*\s*(naira|cedis?|shillings?|rand)/i,
      severity: 'info',
      description: 'Currency amounts mentioned (normal for financial letters)',
    },
  ];

  /**
   * Moderate content for safety and appropriateness
   *
   * Applies both standard pattern matching and normalized text analysis
   * to detect bypass attempts using homoglyphs, leetspeak, or spacing.
   *
   * @param content - The generated letter content
   * @returns Moderation result with pass/fail status and flags
   */
  moderate(content: string): ModerationResult {
    const flags: string[] = [];
    let highestSeverity: 'passed' | 'info' | 'warning' | 'critical' = 'passed';

    // Pre-compute normalized content for rules that need it
    const normalizedContent = normalizeText(content);

    // Run all rules against content
    for (const rule of this.rules) {
      // Determine which text to check against
      const textToCheck = rule.requiresNormalization ? normalizedContent : content;

      if (rule.pattern.test(textToCheck)) {
        // Avoid duplicate flags
        const flagMessage = `${rule.id}: ${rule.description}`;
        if (!flags.includes(flagMessage)) {
          flags.push(flagMessage);
        }

        // Track highest severity
        if (rule.severity === 'critical') {
          highestSeverity = 'critical';
        } else if (rule.severity === 'warning' && highestSeverity !== 'critical') {
          highestSeverity = 'warning';
        } else if (rule.severity === 'info' && highestSeverity === 'passed') {
          highestSeverity = 'info';
        }
      }

      // For critical rules, also check original content to catch direct matches
      if (rule.requiresNormalization && rule.severity === 'critical') {
        if (rule.pattern.test(content) && !rule.pattern.test(textToCheck)) {
          const flagMessage = `${rule.id}: ${rule.description}`;
          if (!flags.includes(flagMessage)) {
            flags.push(flagMessage);
            highestSeverity = 'critical';
          }
        }
      }
    }

    // Log moderation results
    if (highestSeverity === 'critical') {
      this.logger.warn(`Content moderation FAILED: ${flags.join(', ')}`);
    } else if (highestSeverity === 'warning') {
      this.logger.debug(`Content moderation passed with warnings: ${flags.join(', ')}`);
    }

    return {
      passed: highestSeverity !== 'critical',
      flags,
      severity: highestSeverity,
    };
  }

  /**
   * Check if content is safe to deliver
   *
   * This is a convenience method that returns a simple boolean.
   *
   * @param content - The generated letter content
   * @returns true if content is safe, false if it should be blocked
   */
  isSafe(content: string): boolean {
    return this.moderate(content).passed;
  }

  /**
   * Get all moderation rules (for admin/debugging)
   */
  getRules(): Array<{ id: string; severity: string; description: string }> {
    return this.rules.map((rule) => ({
      id: rule.id,
      severity: rule.severity,
      description: rule.description,
    }));
  }

  /**
   * Get normalized version of text (for testing/debugging)
   *
   * Shows how text is transformed before pattern matching
   * to help understand why certain content was flagged.
   *
   * @param text - The text to normalize
   * @returns The normalized version of the text
   */
  getNormalizedText(text: string): string {
    return normalizeText(text);
  }
}

// Export normalizeText for testing purposes
export { normalizeText };
