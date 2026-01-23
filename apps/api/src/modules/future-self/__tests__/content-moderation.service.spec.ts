/**
 * Content Moderation Service Tests
 *
 * Tests for content safety validation including:
 * - Standard pattern matching
 * - Bypass prevention (homoglyphs, leetspeak, spacing)
 * - Severity classification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ContentModerationService,
  normalizeText,
} from '../services/content-moderation.service';

describe('ContentModerationService', () => {
  let service: ContentModerationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContentModerationService],
    }).compile();

    service = module.get<ContentModerationService>(ContentModerationService);
  });

  describe('moderate', () => {
    // ==========================================
    // STANDARD PATTERN MATCHING
    // ==========================================

    describe('standard patterns', () => {
      it('should pass clean content', () => {
        const content = `
          Dear Future You,

          I'm writing from 2045 to remind you of the amazing journey ahead.
          Keep saving consistently and your financial goals will become reality.

          With hope,
          Your Future Self
        `;

        const result = service.moderate(content);

        expect(result.passed).toBe(true);
        expect(result.severity).toBe('passed');
      });

      it('should flag specific investment recommendations', () => {
        const content = 'You should buy Bitcoin now while prices are low!';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.severity).toBe('critical');
        expect(result.flags).toContainEqual(
          expect.stringContaining('SPECIFIC_INVESTMENT'),
        );
      });

      it('should flag guaranteed returns language', () => {
        const content = 'This investment offers guaranteed returns of 50%!';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.severity).toBe('critical');
        expect(result.flags).toContainEqual(
          expect.stringContaining('GUARANTEED_RETURNS'),
        );
      });

      it('should flag get-rich-quick schemes', () => {
        const content = 'This easy money method will make you rich overnight!';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.severity).toBe('critical');
        expect(result.flags).toContainEqual(
          expect.stringContaining('GET_RICH_QUICK'),
        );
      });

      it('should flag profanity', () => {
        const content = 'What the fuck were you thinking?';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.severity).toBe('critical');
        expect(result.flags).toContainEqual(
          expect.stringContaining('PROFANITY'),
        );
      });

      it('should flag discriminatory language', () => {
        const content = "You failed because you're of your ethnicity";

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.severity).toBe('critical');
      });

      it('should allow warnings but pass content', () => {
        const content = 'Act now! You need to start saving immediately!';

        const result = service.moderate(content);

        expect(result.passed).toBe(true);
        expect(result.severity).toBe('warning');
        expect(result.flags).toContainEqual(
          expect.stringContaining('URGENT_ACTION'),
        );
      });

      it('should mark currency mentions as info only', () => {
        const content = 'By 2045, you could have 5,000,000 naira saved.';

        const result = service.moderate(content);

        expect(result.passed).toBe(true);
        expect(result.severity).toBe('info');
        expect(result.flags).toContainEqual(
          expect.stringContaining('CURRENCY_MENTION'),
        );
      });
    });

    // ==========================================
    // BYPASS PREVENTION - LEETSPEAK
    // ==========================================

    describe('leetspeak bypass prevention', () => {
      it('should catch profanity with asterisk censoring (f*ck)', () => {
        const content = 'What the f*ck is this?';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.flags).toContainEqual(
          expect.stringContaining('PROFANITY'),
        );
      });

      it('should catch profanity with number substitution (sh1t)', () => {
        const content = 'This is sh1t advice';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.flags).toContainEqual(
          expect.stringContaining('PROFANITY'),
        );
      });

      it('should catch profanity with @ symbol (f@ck)', () => {
        const content = 'F@ck this investment strategy';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.flags).toContainEqual(
          expect.stringContaining('PROFANITY'),
        );
      });

      it('should catch profanity with dollar sign (a$$)', () => {
        const content = 'Get off your a$$ and start saving';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.flags).toContainEqual(
          expect.stringContaining('PROFANITY'),
        );
      });
    });

    // ==========================================
    // BYPASS PREVENTION - SPACING
    // ==========================================

    describe('spacing bypass prevention', () => {
      it('should catch profanity with spaces (f u c k)', () => {
        const content = 'What the f u c k?';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.flags).toContainEqual(
          expect.stringContaining('PROFANITY'),
        );
      });

      it('should catch profanity with dots (s.h.i.t)', () => {
        const content = 'This is s.h.i.t advice';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.flags).toContainEqual(
          expect.stringContaining('PROFANITY'),
        );
      });

      it('should catch profanity with dashes (f-u-c-k)', () => {
        const content = 'F-u-c-k this strategy';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.flags).toContainEqual(
          expect.stringContaining('PROFANITY'),
        );
      });
    });

    // ==========================================
    // BYPASS PREVENTION - DIACRITICS
    // ==========================================

    describe('diacritics bypass prevention', () => {
      it('should catch profanity with accents (fück)', () => {
        const content = 'What the fück?';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.flags).toContainEqual(
          expect.stringContaining('PROFANITY'),
        );
      });

      it('should catch profanity with multiple diacritics (shït)', () => {
        const content = 'This is shït';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.flags).toContainEqual(
          expect.stringContaining('PROFANITY'),
        );
      });
    });

    // ==========================================
    // PROFANITY VARIANTS
    // ==========================================

    describe('profanity variants', () => {
      it('should catch fck variant', () => {
        const content = 'What the fck is this?';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.flags).toContainEqual(
          expect.stringContaining('PROFANITY_VARIANTS'),
        );
      });

      it('should catch a55 variant', () => {
        const content = 'Get off your a55';

        const result = service.moderate(content);

        expect(result.passed).toBe(false);
        expect(result.flags).toContainEqual(
          expect.stringContaining('PROFANITY_VARIANTS'),
        );
      });
    });
  });

  // ==========================================
  // NORMALIZATION FUNCTION
  // ==========================================

  describe('normalizeText', () => {
    it('should convert to lowercase', () => {
      expect(normalizeText('HELLO WORLD')).toBe('hello world');
    });

    it('should remove diacritics', () => {
      expect(normalizeText('café')).toBe('cafe');
      expect(normalizeText('naïve')).toBe('naive');
    });

    it('should replace leetspeak characters', () => {
      expect(normalizeText('h3ll0')).toBe('hello');
      expect(normalizeText('t3st')).toBe('test');
    });

    it('should collapse spaced characters', () => {
      expect(normalizeText('f u c k')).toBe('fuck');
      expect(normalizeText('s.h.i.t')).toBe('shit');
    });

    it('should handle mixed bypass attempts', () => {
      expect(normalizeText('F*U*C*K')).toBe('fuck');
      expect(normalizeText('$h!t')).toBe('siit'); // $ -> s, ! -> i
    });

    it('should replace Cyrillic homoglyphs', () => {
      // Cyrillic 'а' (U+0430) looks like Latin 'a'
      const cyrillicA = '\u0430';
      expect(normalizeText(`f${cyrillicA}ke`)).toBe('fake');
    });
  });

  // ==========================================
  // CONVENIENCE METHODS
  // ==========================================

  describe('isSafe', () => {
    it('should return true for clean content', () => {
      expect(service.isSafe('This is clean content')).toBe(true);
    });

    it('should return false for content with critical flags', () => {
      expect(service.isSafe('Buy Bitcoin now!')).toBe(false);
    });
  });

  describe('getRules', () => {
    it('should return all rules with id, severity, and description', () => {
      const rules = service.getRules();

      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0]).toHaveProperty('id');
      expect(rules[0]).toHaveProperty('severity');
      expect(rules[0]).toHaveProperty('description');
    });
  });

  describe('getNormalizedText', () => {
    it('should return normalized version of text', () => {
      const original = 'F*CK THIS';
      const normalized = service.getNormalizedText(original);

      expect(normalized).toBe('fck this');
    });
  });
});
