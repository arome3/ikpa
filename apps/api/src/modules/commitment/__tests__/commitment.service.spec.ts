import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CommitmentService } from '../commitment.service';
import { StakeService } from '../stake.service';
import { RefereeService } from '../referee.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { OpikService } from '../../ai/opik/opik.service';
import {
  StakeType,
  VerificationMethod,
  CommitmentStatus,
  GoalStatus,
} from '@prisma/client';
import { CommitmentAlreadyExistsException, GoalNotActiveException } from '../exceptions';
import { addDays } from 'date-fns';

describe('CommitmentService', () => {
  let service: CommitmentService;
  let prismaService: {
    goal: { findUnique: Mock };
    commitmentContract: {
      findFirst: Mock;
      findUnique: Mock;
      findMany: Mock;
      create: Mock;
      update: Mock;
      count: Mock;
    };
    user: { findUnique: Mock };
  };
  let stakeService: {
    validateStake: Mock;
    lockFunds: Mock;
    releaseFunds: Mock;
    getSuccessProbability: Mock;
  };
  let refereeService: {
    inviteReferee: Mock;
    verifyContract: Mock;
  };

  const mockUserId = 'user-123';
  const mockGoalId = 'goal-456';
  const mockContractId = 'contract-789';

  const mockGoal = {
    id: mockGoalId,
    userId: mockUserId,
    name: 'Emergency Fund',
    status: GoalStatus.ACTIVE,
    targetAmount: 500000,
  };

  const mockContract = {
    id: mockContractId,
    userId: mockUserId,
    goalId: mockGoalId,
    stakeType: StakeType.SOCIAL,
    stakeAmount: null,
    antiCharityCause: null,
    antiCharityUrl: null,
    verificationMethod: VerificationMethod.REFEREE_VERIFY,
    deadline: addDays(new Date(), 30),
    status: CommitmentStatus.ACTIVE,
    failedAt: null,
    succeededAt: null,
    verifiedById: null,
    verifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      goal: {
        findUnique: vi.fn(),
      },
      commitmentContract: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
    };

    const mockStakeService = {
      validateStake: vi.fn(),
      lockFunds: vi.fn(),
      releaseFunds: vi.fn(),
      getSuccessProbability: vi.fn(),
    };

    const mockRefereeService = {
      inviteReferee: vi.fn(),
      verifyContract: vi.fn(),
    };

    const mockOpikService = {
      createTrace: vi.fn().mockReturnValue({ trace: {} }),
      endTrace: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommitmentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StakeService, useValue: mockStakeService },
        { provide: RefereeService, useValue: mockRefereeService },
        { provide: OpikService, useValue: mockOpikService },
      ],
    }).compile();

    service = module.get<CommitmentService>(CommitmentService);
    prismaService = module.get(PrismaService);
    stakeService = module.get(StakeService);
    refereeService = module.get(RefereeService);
  });

  describe('createCommitment', () => {
    const createInput = {
      goalId: mockGoalId,
      stakeType: StakeType.SOCIAL,
      verificationMethod: VerificationMethod.REFEREE_VERIFY,
      deadline: addDays(new Date(), 30),
      refereeEmail: 'referee@example.com',
      refereeName: 'Referee Name',
    };

    it('should create a commitment successfully', async () => {
      prismaService.goal.findUnique.mockResolvedValue(mockGoal);
      prismaService.commitmentContract.findFirst.mockResolvedValue(null);
      prismaService.commitmentContract.create.mockResolvedValue({
        ...mockContract,
        goal: { name: mockGoal.name },
      });
      stakeService.validateStake.mockReturnValue({ isValid: true, errors: [], warnings: [] });
      stakeService.getSuccessProbability.mockReturnValue(0.78);
      refereeService.inviteReferee.mockResolvedValue({
        refereeId: 'referee-123',
        inviteExpires: addDays(new Date(), 7),
      });

      const result = await service.createCommitment(mockUserId, createInput);

      expect(result.commitment).toBeDefined();
      expect(result.commitment.stakeType).toBe(StakeType.SOCIAL);
      expect(result.refereeInvited).toBe(true);
    });

    it('should throw GoalNotActiveException if goal not found', async () => {
      prismaService.goal.findUnique.mockResolvedValue(null);

      await expect(service.createCommitment(mockUserId, createInput)).rejects.toThrow(
        GoalNotActiveException,
      );
    });

    it('should throw CommitmentAlreadyExistsException if active commitment exists', async () => {
      prismaService.goal.findUnique.mockResolvedValue(mockGoal);
      prismaService.commitmentContract.findFirst.mockResolvedValue(mockContract);

      await expect(service.createCommitment(mockUserId, createInput)).rejects.toThrow(
        CommitmentAlreadyExistsException,
      );
    });
  });

  describe('getCommitmentsByGoal', () => {
    it('should return commitments for a goal', async () => {
      prismaService.commitmentContract.findMany.mockResolvedValue([
        { ...mockContract, goal: { name: 'Test Goal' }, referee: null },
      ]);
      prismaService.commitmentContract.count.mockResolvedValue(1);
      stakeService.getSuccessProbability.mockReturnValue(0.78);

      const result = await service.getCommitmentsByGoal(mockUserId, mockGoalId);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].goalId).toBe(mockGoalId);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('cancelCommitment', () => {
    it('should cancel an active commitment', async () => {
      const futureDeadline = addDays(new Date(), 30);
      prismaService.commitmentContract.findFirst.mockResolvedValue({
        ...mockContract,
        deadline: futureDeadline,
      });
      prismaService.commitmentContract.update.mockResolvedValue({
        ...mockContract,
        status: CommitmentStatus.CANCELLED,
      });

      const result = await service.cancelCommitment(mockUserId, mockContractId);

      expect(result.success).toBe(true);
    });
  });
});
