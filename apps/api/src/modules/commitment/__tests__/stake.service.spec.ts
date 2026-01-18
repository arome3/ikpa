import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { StakeService } from '../stake.service';
import { MockPaymentService } from '../payment.service.mock';
import { PrismaService } from '../../../prisma/prisma.service';
import { OpikService } from '../../ai/opik/opik.service';
import { StakeType } from '@prisma/client';
import { InsufficientStakeException } from '../exceptions';
import { COMMITMENT_CONSTANTS } from '../constants';

describe('StakeService', () => {
  let service: StakeService;
  let paymentService: {
    verifyPaymentMethod: Mock;
    lockFunds: Mock;
    releaseFunds: Mock;
    processDonation: Mock;
    forfeitToPool: Mock;
  };

  const mockUserId = 'user-123';
  const mockContractId = 'contract-456';

  beforeEach(async () => {
    const mockPaymentServiceImpl = {
      verifyPaymentMethod: vi.fn().mockResolvedValue(true),
      lockFunds: vi.fn(),
      releaseFunds: vi.fn(),
      processDonation: vi.fn(),
      forfeitToPool: vi.fn(),
    };

    const mockPrisma = {
      commitmentContract: {
        count: vi.fn(),
        aggregate: vi.fn(),
      },
    };

    const mockOpikService = {
      createTrace: vi.fn().mockReturnValue({ trace: {} }),
      endTrace: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StakeService,
        { provide: MockPaymentService, useValue: mockPaymentServiceImpl },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OpikService, useValue: mockOpikService },
      ],
    }).compile();

    service = module.get<StakeService>(StakeService);
    paymentService = module.get(MockPaymentService);
  });

  describe('validateStake', () => {
    it('should validate SOCIAL stake without amount', () => {
      const result = service.validateStake(StakeType.SOCIAL);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require amount for ANTI_CHARITY stake', () => {
      const result = service.validateStake(StakeType.ANTI_CHARITY);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Stake amount is required for ANTI_CHARITY type');
    });

    it('should require cause for ANTI_CHARITY stake', () => {
      const result = service.validateStake(StakeType.ANTI_CHARITY, 50000);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Anti-charity cause is required for ANTI_CHARITY type');
    });

    it('should validate valid ANTI_CHARITY stake', () => {
      const result = service.validateStake(
        StakeType.ANTI_CHARITY,
        50000,
        'Opposing Cause',
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require amount for LOSS_POOL stake', () => {
      const result = service.validateStake(StakeType.LOSS_POOL);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Stake amount is required for LOSS_POOL type');
    });

    it('should reject amount below minimum', () => {
      const result = service.validateStake(StakeType.LOSS_POOL, 100);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('must be at least');
    });

    it('should reject amount above maximum', () => {
      const result = service.validateStake(
        StakeType.LOSS_POOL,
        COMMITMENT_CONSTANTS.MAXIMUM_STAKE_AMOUNT + 1,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('cannot exceed');
    });
  });

  describe('lockFunds', () => {
    it('should lock funds successfully', async () => {
      paymentService.lockFunds.mockResolvedValue({
        success: true,
        lockId: 'lock-123',
        amount: 50000,
      });

      const result = await service.lockFunds(
        mockUserId,
        mockContractId,
        50000,
        'NGN',
      );

      expect(result.success).toBe(true);
      expect(result.lockId).toBe('lock-123');
    });

    it('should throw InsufficientStakeException for amount below minimum', async () => {
      await expect(
        service.lockFunds(mockUserId, mockContractId, 100, 'NGN'),
      ).rejects.toThrow(InsufficientStakeException);
    });

    it('should return error if no payment method', async () => {
      paymentService.verifyPaymentMethod.mockResolvedValue(false);

      const result = await service.lockFunds(
        mockUserId,
        mockContractId,
        50000,
        'NGN',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('payment method');
    });
  });

  describe('executeAntiCharityDonation', () => {
    it('should process donation successfully', async () => {
      paymentService.processDonation.mockResolvedValue({
        success: true,
        donationId: 'donation-123',
        amount: 50000,
        cause: 'Test Cause',
      });

      const result = await service.executeAntiCharityDonation(
        mockUserId,
        mockContractId,
        50000,
        'Test Cause',
        'https://example.com',
        'NGN',
      );

      expect(result.success).toBe(true);
      expect(result.donationId).toBe('donation-123');
    });
  });

  describe('getSuccessProbability', () => {
    it('should return correct probability for SOCIAL stake', () => {
      const probability = service.getSuccessProbability(StakeType.SOCIAL);

      expect(probability).toBeGreaterThan(0);
      expect(probability).toBeLessThanOrEqual(1);
    });

    it('should return highest probability for ANTI_CHARITY', () => {
      const socialProb = service.getSuccessProbability(StakeType.SOCIAL);
      const antiCharityProb = service.getSuccessProbability(StakeType.ANTI_CHARITY);

      expect(antiCharityProb).toBeGreaterThan(socialProb);
    });
  });
});
