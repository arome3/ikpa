import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CommitmentController } from '../commitment.controller';
import { CommitmentService } from '../commitment.service';
import { RefereeService } from '../referee.service';
import { StakeService } from '../stake.service';
import {
  StakeType,
  VerificationMethod,
  CommitmentStatus,
  RefereeRelationship,
} from '@prisma/client';
import { addDays } from 'date-fns';

describe('CommitmentController', () => {
  let controller: CommitmentController;
  let commitmentService: {
    createCommitment: Mock;
    getCommitmentsByGoal: Mock;
    getCommitmentById: Mock;
    updateCommitment: Mock;
    cancelCommitment: Mock;
    verifyCommitment: Mock;
  };
  let refereeService: {
    inviteReferee: Mock;
    acceptInvitation: Mock;
    getPendingVerifications: Mock;
  };
  let stakeService: {
    calculateStakeEffectiveness: Mock;
  };

  const mockUserId = 'user-123';
  const mockGoalId = 'goal-456';
  const mockContractId = 'contract-789';

  const mockCommitmentResponse = {
    id: mockContractId,
    goalId: mockGoalId,
    goalName: 'Emergency Fund',
    userId: mockUserId,
    stakeType: StakeType.SOCIAL,
    stakeAmount: null,
    antiCharityCause: null,
    verificationMethod: VerificationMethod.REFEREE_VERIFY,
    deadline: addDays(new Date(), 30),
    status: CommitmentStatus.ACTIVE,
    daysRemaining: 30,
    successProbability: 0.78,
    message: {
      headline: "You've raised the stakes",
      subtext: 'Research shows you are now 3x more likely to achieve your goal.',
    },
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockCommitmentService = {
      createCommitment: vi.fn(),
      getCommitmentsByGoal: vi.fn(),
      getCommitmentById: vi.fn(),
      updateCommitment: vi.fn(),
      cancelCommitment: vi.fn(),
      verifyCommitment: vi.fn(),
    };

    const mockRefereeService = {
      inviteReferee: vi.fn(),
      acceptInvitation: vi.fn(),
      getPendingVerifications: vi.fn(),
    };

    const mockStakeService = {
      calculateStakeEffectiveness: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommitmentController],
      providers: [
        { provide: CommitmentService, useValue: mockCommitmentService },
        { provide: RefereeService, useValue: mockRefereeService },
        { provide: StakeService, useValue: mockStakeService },
      ],
    }).compile();

    controller = module.get<CommitmentController>(CommitmentController);
    commitmentService = module.get(CommitmentService);
    refereeService = module.get(RefereeService);
    stakeService = module.get(StakeService);
  });

  describe('createStake', () => {
    it('should create a commitment with social stakes', async () => {
      const dto = {
        goalId: mockGoalId,
        stakeType: StakeType.SOCIAL,
        verificationMethod: VerificationMethod.REFEREE_VERIFY,
        deadline: addDays(new Date(), 30).toISOString(),
        refereeEmail: 'referee@example.com',
        refereeName: 'Test Referee',
        refereeRelationship: RefereeRelationship.FRIEND,
      };

      commitmentService.createCommitment.mockResolvedValue({
        commitment: mockCommitmentResponse,
        refereeInvited: true,
      });

      const result = await controller.createStake(mockUserId, dto);

      expect(result.id).toBe(mockContractId);
      expect(result.refereeInvited).toBe(true);
      expect(commitmentService.createCommitment).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          goalId: mockGoalId,
          stakeType: StakeType.SOCIAL,
        }),
      );
    });

    it('should create a commitment with anti-charity stakes', async () => {
      const dto = {
        goalId: mockGoalId,
        stakeType: StakeType.ANTI_CHARITY,
        stakeAmount: 50000,
        antiCharityCause: 'Opposing Cause',
        verificationMethod: VerificationMethod.SELF_REPORT,
        deadline: addDays(new Date(), 30).toISOString(),
      };

      const antiCharityResponse = {
        ...mockCommitmentResponse,
        stakeType: StakeType.ANTI_CHARITY,
        stakeAmount: 50000,
        antiCharityCause: 'Opposing Cause',
      };

      commitmentService.createCommitment.mockResolvedValue({
        commitment: antiCharityResponse,
        refereeInvited: false,
      });

      const result = await controller.createStake(mockUserId, dto);

      expect(result.stakeType).toBe(StakeType.ANTI_CHARITY);
      expect(result.stakeAmount).toBe(50000);
      expect(result.refereeInvited).toBe(false);
    });
  });

  describe('getStakes', () => {
    it('should return stakes for a goal', async () => {
      commitmentService.getCommitmentsByGoal.mockResolvedValue({
        data: [mockCommitmentResponse],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
      });

      const result = await controller.getStakes(mockUserId, mockGoalId);

      expect(result.data).toHaveLength(1);
      expect(result.goalId).toBe(mockGoalId);
      expect(result.pagination.total).toBe(1);
    });

    it('should return empty array if no stakes', async () => {
      commitmentService.getCommitmentsByGoal.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
      });

      const result = await controller.getStakes(mockUserId, mockGoalId);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('updateStake', () => {
    it('should update stake deadline', async () => {
      const newDeadline = addDays(new Date(), 60);
      const dto = {
        deadline: newDeadline.toISOString(),
      };

      commitmentService.updateCommitment.mockResolvedValue({
        ...mockCommitmentResponse,
        deadline: newDeadline,
        daysRemaining: 60,
      });

      const result = await controller.updateStake(mockUserId, mockContractId, dto);

      expect(result.daysRemaining).toBe(60);
    });
  });

  describe('cancelStake', () => {
    it('should cancel a commitment', async () => {
      commitmentService.cancelCommitment.mockResolvedValue({
        success: true,
        message: 'Commitment cancelled successfully.',
      });

      const result = await controller.cancelStake(mockUserId, mockContractId);

      expect(result.success).toBe(true);
      expect(result.contractId).toBe(mockContractId);
    });

    it('should include refunded amount for loss pool', async () => {
      commitmentService.cancelCommitment.mockResolvedValue({
        success: true,
        refundedAmount: 50000,
        message: 'Commitment cancelled. 50000 has been refunded.',
      });

      const result = await controller.cancelStake(mockUserId, mockContractId);

      expect(result.success).toBe(true);
      expect(result.refundedAmount).toBe(50000);
    });
  });

  describe('inviteReferee', () => {
    it('should invite a new referee', async () => {
      const dto = {
        email: 'referee@example.com',
        name: 'Test Referee',
        relationship: RefereeRelationship.FRIEND,
      };

      refereeService.inviteReferee.mockResolvedValue({
        refereeId: 'referee-123',
        inviteExpires: addDays(new Date(), 7),
      });

      const result = await controller.inviteReferee(mockUserId, dto);

      expect(result.success).toBe(true);
      expect(result.refereeId).toBe('referee-123');
      expect(result.email).toBe(dto.email);
    });
  });

  describe('acceptInvite', () => {
    it('should accept referee invitation', async () => {
      const dto = { token: 'valid-token' };

      refereeService.acceptInvitation.mockResolvedValue({
        refereeId: 'referee-123',
        userName: 'Test User',
      });

      const result = await controller.acceptInvite(dto);

      expect(result.success).toBe(true);
      expect(result.refereeId).toBe('referee-123');
      expect(result.userName).toBe('Test User');
    });
  });

  describe('getStakeEffectiveness', () => {
    it('should return stake effectiveness metrics', async () => {
      const metrics = [
        {
          stakeType: StakeType.SOCIAL,
          totalCommitments: 10,
          successfulCommitments: 8,
          successRate: 0.8,
          averageStakeAmount: null,
          averageTimeToSuccess: null,
        },
        {
          stakeType: StakeType.ANTI_CHARITY,
          totalCommitments: 5,
          successfulCommitments: 4,
          successRate: 0.8,
          averageStakeAmount: 50000,
          averageTimeToSuccess: null,
        },
      ];

      stakeService.calculateStakeEffectiveness.mockResolvedValue(metrics);

      const result = await controller.getStakeEffectiveness(mockUserId);

      expect(result.userId).toBe(mockUserId);
      expect(result.metrics).toEqual(metrics);
      expect(result.recommendation).toBeDefined();
    });
  });
});
