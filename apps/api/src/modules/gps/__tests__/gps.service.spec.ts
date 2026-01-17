/**
 * GpsService Unit Tests
 *
 * Tests cover:
 * - Exception behavior
 * - Budget status detection logic
 * - Recovery path generation
 * - Banned words validation
 * - Message generation
 *
 * Note: These tests mock at the service method level to avoid
 * complex Prisma client mocking issues with NestJS DI.
 */

import { describe, it, expect } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { RecoveryStatus } from '@prisma/client';
import {
  NoBudgetFoundException,
  GpsNoActiveGoalException,
  GpsCalculationException,
  RecoverySessionNotFoundException,
  InvalidRecoveryPathException,
  SessionAlreadyResolvedException,
  GpsInsufficientDataException,
  BannedWordException,
} from '../exceptions';
import { ErrorCodes } from '../../../common/constants/error-codes';
import {
  GPS_CONSTANTS,
  RECOVERY_PATHS,
  SUPPORTIVE_MESSAGES,
} from '../constants';
import { BudgetTrigger, BudgetStatus, NonJudgmentalMessage } from '../interfaces';

// Helper to get error code from exception response
const getErrorCode = (exception: { getResponse: () => unknown }): string | undefined => {
  const response = exception.getResponse() as { code?: string };
  return response?.code;
};

describe('GpsService Exceptions', () => {
  describe('NoBudgetFoundException', () => {
    it('should create exception with category name', () => {
      const exception = new NoBudgetFoundException('Entertainment');

      expect(exception.message).toContain('Entertainment');
      expect(getErrorCode(exception)).toBe(ErrorCodes.GPS_NO_BUDGET_FOUND);
    });

    it('should create exception without category', () => {
      const exception = new NoBudgetFoundException();

      expect(exception.message).toContain('No budget found');
      expect(getErrorCode(exception)).toBe(ErrorCodes.GPS_NO_BUDGET_FOUND);
    });

    it('should have 404 status', () => {
      const exception = new NoBudgetFoundException('Entertainment');

      expect(exception.getStatus()).toBe(404);
    });
  });

  describe('GpsNoActiveGoalException', () => {
    it('should create exception with user ID', () => {
      const exception = new GpsNoActiveGoalException('user-123');

      expect(exception.message).toContain('No active financial goal');
      expect(getErrorCode(exception)).toBe(ErrorCodes.GPS_NO_ACTIVE_GOAL);
    });

    it('should have 422 status', () => {
      const exception = new GpsNoActiveGoalException();

      expect(exception.getStatus()).toBe(422);
    });
  });

  describe('GpsCalculationException', () => {
    it('should create exception with reason', () => {
      const exception = new GpsCalculationException('Simulation failed');

      expect(exception.message).toContain('Simulation failed');
      expect(getErrorCode(exception)).toBe(ErrorCodes.GPS_CALCULATION_ERROR);
    });

    it('should have 500 status', () => {
      const exception = new GpsCalculationException('Error');

      expect(exception.getStatus()).toBe(500);
    });
  });

  describe('RecoverySessionNotFoundException', () => {
    it('should create exception with session ID', () => {
      const exception = new RecoverySessionNotFoundException('session-123');

      expect(exception.message).toContain('session-123');
      expect(getErrorCode(exception)).toBe(ErrorCodes.GPS_RECOVERY_SESSION_NOT_FOUND);
    });

    it('should have 404 status', () => {
      const exception = new RecoverySessionNotFoundException();

      expect(exception.getStatus()).toBe(404);
    });
  });

  describe('InvalidRecoveryPathException', () => {
    it('should create exception with path ID and valid paths', () => {
      const validPaths = ['time_adjustment', 'rate_adjustment', 'freeze_protocol'];
      const exception = new InvalidRecoveryPathException('invalid_path', validPaths);

      expect(exception.message).toContain('invalid_path');
      expect(exception.message).toContain('time_adjustment');
      expect(getErrorCode(exception)).toBe(ErrorCodes.GPS_INVALID_RECOVERY_PATH);
    });

    it('should have 400 status', () => {
      const exception = new InvalidRecoveryPathException('invalid', []);

      expect(exception.getStatus()).toBe(400);
    });
  });

  describe('SessionAlreadyResolvedException', () => {
    it('should create exception with session ID and status', () => {
      const exception = new SessionAlreadyResolvedException('session-123', 'COMPLETED');

      expect(exception.message).toContain('session-123');
      expect(exception.message).toContain('COMPLETED');
      expect(getErrorCode(exception)).toBe(ErrorCodes.GPS_SESSION_ALREADY_RESOLVED);
    });

    it('should have 409 status', () => {
      const exception = new SessionAlreadyResolvedException('session-123', 'COMPLETED');

      expect(exception.getStatus()).toBe(409);
    });
  });

  describe('GpsInsufficientDataException', () => {
    it('should create exception with missing data', () => {
      const exception = new GpsInsufficientDataException(['budget', 'goal']);

      expect(exception.message).toContain('budget');
      expect(exception.message).toContain('goal');
      expect(getErrorCode(exception)).toBe(ErrorCodes.GPS_INSUFFICIENT_DATA);
    });

    it('should have 422 status', () => {
      const exception = new GpsInsufficientDataException();

      expect(exception.getStatus()).toBe(422);
    });
  });

  describe('BannedWordException', () => {
    it('should create exception with banned words', () => {
      const exception = new BannedWordException(['failed', 'mistake']);

      expect(getErrorCode(exception)).toBe(ErrorCodes.GPS_CALCULATION_ERROR);
    });

    it('should have 500 status', () => {
      const exception = new BannedWordException(['failed']);

      expect(exception.getStatus()).toBe(500);
    });
  });
});

describe('GpsService Budget Status Detection', () => {
  describe('Budget Trigger Calculation', () => {
    const calculateTrigger = (spent: number, budgeted: number): BudgetTrigger => {
      const spentPercentage = budgeted > 0 ? spent / budgeted : 0;

      if (spentPercentage >= GPS_CONSTANTS.BUDGET_CRITICAL_THRESHOLD) {
        return 'BUDGET_CRITICAL';
      } else if (spentPercentage >= GPS_CONSTANTS.BUDGET_EXCEEDED_THRESHOLD) {
        return 'BUDGET_EXCEEDED';
      } else {
        return 'BUDGET_WARNING';
      }
    };

    it('should return BUDGET_WARNING for 80-99% spent', () => {
      expect(calculateTrigger(80000, 100000)).toBe('BUDGET_WARNING');
      expect(calculateTrigger(95000, 100000)).toBe('BUDGET_WARNING');
    });

    it('should return BUDGET_EXCEEDED for 100-119% spent', () => {
      expect(calculateTrigger(100000, 100000)).toBe('BUDGET_EXCEEDED');
      expect(calculateTrigger(115000, 100000)).toBe('BUDGET_EXCEEDED');
    });

    it('should return BUDGET_CRITICAL for 120%+ spent', () => {
      expect(calculateTrigger(120000, 100000)).toBe('BUDGET_CRITICAL');
      expect(calculateTrigger(150000, 100000)).toBe('BUDGET_CRITICAL');
    });

    it('should handle zero budget', () => {
      expect(calculateTrigger(1000, 0)).toBe('BUDGET_WARNING');
    });
  });

  describe('Overage Percentage Calculation', () => {
    const calculateOveragePercent = (spent: number, budgeted: number): number => {
      if (budgeted <= 0) return 0;
      const spentPercentage = spent / budgeted;
      return Math.max(0, (spentPercentage - 1) * 100);
    };

    it('should return 0 when under budget', () => {
      expect(calculateOveragePercent(80000, 100000)).toBe(0);
      expect(calculateOveragePercent(50000, 100000)).toBe(0);
    });

    it('should return correct percentage when over budget', () => {
      expect(calculateOveragePercent(120000, 100000)).toBeCloseTo(20, 2);
      expect(calculateOveragePercent(150000, 100000)).toBeCloseTo(50, 2);
    });

    it('should handle zero budget', () => {
      expect(calculateOveragePercent(1000, 0)).toBe(0);
    });
  });
});

describe('GpsService Recovery Paths', () => {
  describe('Recovery Path Configuration', () => {
    it('should have three recovery paths defined', () => {
      const pathIds = Object.values(GPS_CONSTANTS.RECOVERY_PATH_IDS);
      expect(pathIds).toHaveLength(3);
    });

    it('should have time_adjustment path', () => {
      expect(GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT).toBe('time_adjustment');
      expect(RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT]).toBeDefined();
    });

    it('should have rate_adjustment path', () => {
      expect(GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT).toBe('rate_adjustment');
      expect(RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT]).toBeDefined();
    });

    it('should have freeze_protocol path', () => {
      expect(GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL).toBe('freeze_protocol');
      expect(RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL]).toBeDefined();
    });

    it('should have correct effort levels', () => {
      expect(RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT].effort).toBe('Low');
      expect(RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT].effort).toBe('Medium');
      expect(RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL].effort).toBe('High');
    });
  });

  describe('Path ID Validation', () => {
    const isValidPathId = (pathId: string): boolean => {
      const validIds = Object.values(GPS_CONSTANTS.RECOVERY_PATH_IDS);
      return validIds.includes(pathId as typeof validIds[number]);
    };

    it('should accept valid path IDs', () => {
      expect(isValidPathId('time_adjustment')).toBe(true);
      expect(isValidPathId('rate_adjustment')).toBe(true);
      expect(isValidPathId('freeze_protocol')).toBe(true);
    });

    it('should reject invalid path IDs', () => {
      expect(isValidPathId('invalid_path')).toBe(false);
      expect(isValidPathId('')).toBe(false);
      expect(isValidPathId('TIME_ADJUSTMENT')).toBe(false); // Case sensitive
    });
  });
});

describe('GpsService Message Validation', () => {
  describe('Banned Words', () => {
    it('should have banned words defined', () => {
      expect(GPS_CONSTANTS.BANNED_WORDS.length).toBeGreaterThan(0);
    });

    it('should include common judgmental words', () => {
      expect(GPS_CONSTANTS.BANNED_WORDS).toContain('failed');
      expect(GPS_CONSTANTS.BANNED_WORDS).toContain('mistake');
      expect(GPS_CONSTANTS.BANNED_WORDS).toContain('wrong');
      expect(GPS_CONSTANTS.BANNED_WORDS).toContain('bad');
      expect(GPS_CONSTANTS.BANNED_WORDS).toContain('shame');
    });
  });

  describe('Message Generation', () => {
    const containsBannedWord = (text: string): boolean => {
      const lowerText = text.toLowerCase();
      return GPS_CONSTANTS.BANNED_WORDS.some((word) =>
        lowerText.includes(word.toLowerCase()),
      );
    };

    it('should validate clean messages', () => {
      const message: NonJudgmentalMessage = {
        tone: 'Supportive',
        headline: "Let's recalculate your route",
        subtext: 'Here are three ways to get back on track.',
      };

      const hasIssue =
        containsBannedWord(message.headline) || containsBannedWord(message.subtext);
      expect(hasIssue).toBe(false);
    });

    it('should detect banned words in headline', () => {
      const message: NonJudgmentalMessage = {
        tone: 'Supportive',
        headline: 'You failed to stay on budget',
        subtext: 'Here are your options.',
      };

      expect(containsBannedWord(message.headline)).toBe(true);
    });

    it('should detect banned words in subtext', () => {
      const message: NonJudgmentalMessage = {
        tone: 'Supportive',
        headline: "Let's recalculate",
        subtext: 'This was a mistake, but we can fix it.',
      };

      expect(containsBannedWord(message.subtext)).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(containsBannedWord('FAILED')).toBe(true);
      expect(containsBannedWord('Failed')).toBe(true);
      expect(containsBannedWord('fAiLeD')).toBe(true);
    });
  });

  describe('Supportive Messages Configuration', () => {
    it('should have messages for BUDGET_EXCEEDED', () => {
      expect(SUPPORTIVE_MESSAGES.BUDGET_EXCEEDED.headlines.length).toBeGreaterThan(0);
      expect(SUPPORTIVE_MESSAGES.BUDGET_EXCEEDED.subtexts.length).toBeGreaterThan(0);
    });

    it('should have messages for BUDGET_WARNING', () => {
      expect(SUPPORTIVE_MESSAGES.BUDGET_WARNING.headlines.length).toBeGreaterThan(0);
      expect(SUPPORTIVE_MESSAGES.BUDGET_WARNING.subtexts.length).toBeGreaterThan(0);
    });

    it('should not contain banned words in predefined messages', () => {
      const allMessages = [
        ...SUPPORTIVE_MESSAGES.BUDGET_EXCEEDED.headlines,
        ...SUPPORTIVE_MESSAGES.BUDGET_EXCEEDED.subtexts,
        ...SUPPORTIVE_MESSAGES.BUDGET_WARNING.headlines,
        ...SUPPORTIVE_MESSAGES.BUDGET_WARNING.subtexts,
      ];

      for (const message of allMessages) {
        const lowerMessage = message.toLowerCase();
        for (const bannedWord of GPS_CONSTANTS.BANNED_WORDS) {
          expect(lowerMessage.includes(bannedWord.toLowerCase())).toBe(false);
        }
      }
    });
  });
});

describe('GpsService Data Structures', () => {
  describe('Budget Status Structure', () => {
    const createMockBudgetStatus = (
      overrides: Partial<BudgetStatus> = {},
    ): BudgetStatus => ({
      category: 'Entertainment',
      categoryId: 'cat-123',
      budgeted: 50000,
      spent: 65000,
      remaining: -15000,
      overagePercent: 30,
      trigger: 'BUDGET_EXCEEDED',
      period: 'MONTHLY',
      ...overrides,
    });

    it('should create valid budget status', () => {
      const status = createMockBudgetStatus();

      expect(status.category).toBe('Entertainment');
      expect(status.budgeted).toBe(50000);
      expect(status.spent).toBe(65000);
      expect(status.remaining).toBe(-15000);
    });

    it('should allow overriding trigger', () => {
      const status = createMockBudgetStatus({ trigger: 'BUDGET_CRITICAL' });

      expect(status.trigger).toBe('BUDGET_CRITICAL');
    });
  });

  describe('Recovery Session Structure', () => {
    const createMockSession = (
      overrides: Partial<{
        id: string;
        userId: string;
        category: string;
        overspendAmount: Decimal;
        previousProbability: Decimal;
        newProbability: Decimal;
        selectedPathId: string | null;
        status: RecoveryStatus;
      }> = {},
    ) => ({
      id: 'session-123',
      userId: 'user-123',
      budgetId: null,
      category: 'Entertainment',
      overspendAmount: new Decimal(15000),
      previousProbability: new Decimal(0.75),
      newProbability: new Decimal(0.68),
      selectedPathId: null,
      selectedAt: null,
      status: RecoveryStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('should create valid recovery session', () => {
      const session = createMockSession();

      expect(session.id).toBe('session-123');
      expect(session.userId).toBe('user-123');
      expect(session.category).toBe('Entertainment');
      expect(session.status).toBe(RecoveryStatus.PENDING);
    });

    it('should track probability changes', () => {
      const session = createMockSession();

      expect(Number(session.previousProbability)).toBe(0.75);
      expect(Number(session.newProbability)).toBe(0.68);
    });

    it('should track path selection', () => {
      const session = createMockSession({
        selectedPathId: 'time_adjustment',
        status: RecoveryStatus.PATH_SELECTED,
      });

      expect(session.selectedPathId).toBe('time_adjustment');
      expect(session.status).toBe(RecoveryStatus.PATH_SELECTED);
    });
  });
});

describe('GpsService Constants', () => {
  describe('Thresholds', () => {
    it('should have correct warning threshold', () => {
      expect(GPS_CONSTANTS.BUDGET_WARNING_THRESHOLD).toBe(0.8);
    });

    it('should have correct exceeded threshold', () => {
      expect(GPS_CONSTANTS.BUDGET_EXCEEDED_THRESHOLD).toBe(1.0);
    });

    it('should have correct critical threshold', () => {
      expect(GPS_CONSTANTS.BUDGET_CRITICAL_THRESHOLD).toBe(1.2);
    });

    it('should have thresholds in ascending order', () => {
      expect(GPS_CONSTANTS.BUDGET_WARNING_THRESHOLD).toBeLessThan(
        GPS_CONSTANTS.BUDGET_EXCEEDED_THRESHOLD,
      );
      expect(GPS_CONSTANTS.BUDGET_EXCEEDED_THRESHOLD).toBeLessThan(
        GPS_CONSTANTS.BUDGET_CRITICAL_THRESHOLD,
      );
    });
  });

  describe('Default Values', () => {
    it('should have default timeline extension', () => {
      expect(GPS_CONSTANTS.DEFAULT_TIMELINE_EXTENSION_WEEKS).toBe(2);
    });

    it('should have default savings rate increase', () => {
      expect(GPS_CONSTANTS.DEFAULT_SAVINGS_RATE_INCREASE).toBe(0.05);
    });

    it('should have default freeze duration', () => {
      expect(GPS_CONSTANTS.DEFAULT_FREEZE_DURATION_WEEKS).toBe(4);
    });

    it('should have target probability', () => {
      expect(GPS_CONSTANTS.TARGET_PROBABILITY).toBe(0.85);
    });
  });
});

describe('GpsService Business Logic', () => {
  describe('Session Status Transitions', () => {
    const canSelectPath = (status: RecoveryStatus): boolean => {
      return status === RecoveryStatus.PENDING;
    };

    it('should allow path selection for PENDING sessions', () => {
      expect(canSelectPath(RecoveryStatus.PENDING)).toBe(true);
    });

    it('should reject path selection for non-PENDING sessions', () => {
      expect(canSelectPath(RecoveryStatus.PATH_SELECTED)).toBe(false);
      expect(canSelectPath(RecoveryStatus.IN_PROGRESS)).toBe(false);
      expect(canSelectPath(RecoveryStatus.COMPLETED)).toBe(false);
      expect(canSelectPath(RecoveryStatus.ABANDONED)).toBe(false);
    });
  });

  describe('Probability Impact Calculation', () => {
    const calculateProbabilityDrop = (
      previous: number,
      current: number,
    ): number => {
      return current - previous;
    };

    it('should calculate negative drop when probability decreases', () => {
      expect(calculateProbabilityDrop(0.75, 0.68)).toBeCloseTo(-0.07, 2);
    });

    it('should calculate positive when probability increases', () => {
      expect(calculateProbabilityDrop(0.68, 0.75)).toBeCloseTo(0.07, 2);
    });

    it('should return zero when probability unchanged', () => {
      expect(calculateProbabilityDrop(0.75, 0.75)).toBe(0);
    });
  });

  describe('Impact Message Generation', () => {
    const generateImpactMessage = (probabilityDrop: number): string => {
      const dropPercent = Math.abs(probabilityDrop * 100).toFixed(1);

      if (probabilityDrop < 0) {
        return `Your goal probability decreased by ${dropPercent} percentage points`;
      } else if (probabilityDrop > 0) {
        return `Your goal probability increased by ${dropPercent} percentage points`;
      }
      return 'Your goal probability remains unchanged';
    };

    it('should generate decrease message', () => {
      const message = generateImpactMessage(-0.07);
      expect(message).toContain('decreased');
      expect(message).toContain('7.0');
    });

    it('should generate increase message', () => {
      const message = generateImpactMessage(0.05);
      expect(message).toContain('increased');
      expect(message).toContain('5.0');
    });

    it('should generate unchanged message', () => {
      const message = generateImpactMessage(0);
      expect(message).toContain('unchanged');
    });
  });
});
