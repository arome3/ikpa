import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RefereeService } from '../referee.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { OpikService } from '../../ai/opik/opik.service';
import { EmailService } from '../../auth/email.service';
import { RefereeRelationship } from '@prisma/client';
import {
  RefereeNotFoundException,
  InvalidInviteTokenException,
} from '../exceptions';
import { addDays } from 'date-fns';

describe('RefereeService', () => {
  let service: RefereeService;
  let prismaService: {
    commitmentReferee: {
      findFirst: Mock;
      findUnique: Mock;
      findMany: Mock;
      create: Mock;
      update: Mock;
    };
    commitmentContract: {
      findMany: Mock;
      findUnique: Mock;
      count: Mock;
    };
    commitmentVerification: {
      create: Mock;
      findMany: Mock;
    };
    user: {
      findUnique: Mock;
    };
  };

  const mockUserId = 'user-123';
  const mockRefereeId = 'referee-456';

  const mockReferee = {
    id: mockRefereeId,
    email: 'referee@example.com',
    name: 'Test Referee',
    relationship: RefereeRelationship.FRIEND,
    invitedById: mockUserId,
    inviteToken: null,
    inviteExpires: null,
    acceptedAt: new Date(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      commitmentReferee: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      commitmentContract: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
      },
      commitmentVerification: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
    };

    const mockOpikServiceImpl = {
      createTrace: vi.fn().mockReturnValue({ trace: {} }),
      endTrace: vi.fn(),
    };

    const mockEmailServiceImpl = {
      sendRefereeInviteEmail: vi.fn().mockResolvedValue({ success: true }),
    };

    const mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          FRONTEND_URL: 'https://app.ikpa.app',
          JWT_SECRET: 'test-jwt-secret',
        };
        return config[key] || null;
      }),
    };

    const mockJwtService = {
      sign: vi.fn().mockReturnValue('mock.jwt.token'),
      verify: vi.fn().mockReturnValue({ sub: 'referee-123', email: 'test@example.com', type: 'verify' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefereeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OpikService, useValue: mockOpikServiceImpl },
        { provide: EmailService, useValue: mockEmailServiceImpl },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<RefereeService>(RefereeService);
    prismaService = module.get(PrismaService);
  });

  describe('inviteReferee', () => {
    const inviteInput = {
      email: 'newreferee@example.com',
      name: 'New Referee',
      relationship: RefereeRelationship.FAMILY,
    };

    it('should create a new referee and send invitation', async () => {
      prismaService.commitmentReferee.findFirst.mockResolvedValue(null);
      prismaService.commitmentReferee.create.mockResolvedValue({
        ...mockReferee,
        id: 'new-referee-id',
        email: inviteInput.email,
        name: inviteInput.name,
        isActive: false,
        inviteExpires: addDays(new Date(), 7),
      });
      prismaService.user.findUnique.mockResolvedValue({
        name: 'Test User',
        email: 'user@example.com',
      });

      const result = await service.inviteReferee(mockUserId, inviteInput);

      expect(result.refereeId).toBe('new-referee-id');
      expect(result.inviteExpires).toBeDefined();
    });

    it('should resend invitation if referee exists but not active', async () => {
      const inactiveReferee = {
        ...mockReferee,
        isActive: false,
        invitedBy: { name: 'Test User' },
      };
      prismaService.commitmentReferee.findFirst.mockResolvedValue(inactiveReferee);
      prismaService.commitmentReferee.findUnique.mockResolvedValue(inactiveReferee);
      prismaService.commitmentReferee.update.mockResolvedValue(inactiveReferee);

      const result = await service.inviteReferee(mockUserId, inviteInput);

      expect(result.refereeId).toBe(mockRefereeId);
    });

    it('should return existing referee if already active', async () => {
      prismaService.commitmentReferee.findFirst.mockResolvedValue({
        ...mockReferee,
        isActive: true,
      });

      const result = await service.inviteReferee(mockUserId, inviteInput);

      expect(result.refereeId).toBe(mockRefereeId);
    });
  });

  describe('acceptInvitation', () => {
    it('should activate referee on valid token', async () => {
      prismaService.commitmentReferee.findFirst.mockResolvedValue({
        ...mockReferee,
        isActive: false,
        inviteExpires: addDays(new Date(), 1),
        invitedBy: { name: 'Test User' },
      });
      prismaService.commitmentReferee.update.mockResolvedValue({
        ...mockReferee,
        isActive: true,
      });

      const result = await service.acceptInvitation('some-token');

      expect(result.refereeId).toBe(mockRefereeId);
      expect(result.userName).toBe('Test User');
    });

    it('should throw InvalidInviteTokenException if token not found', async () => {
      prismaService.commitmentReferee.findFirst.mockResolvedValue(null);

      await expect(service.acceptInvitation('invalid-token')).rejects.toThrow(
        InvalidInviteTokenException,
      );
    });

    it('should throw InvalidInviteTokenException if invitation expired', async () => {
      prismaService.commitmentReferee.findFirst.mockResolvedValue({
        ...mockReferee,
        isActive: false,
        inviteExpires: new Date('2020-01-01'), // Expired
        invitedBy: { name: 'Test User' },
      });

      await expect(service.acceptInvitation('expired-token')).rejects.toThrow(
        InvalidInviteTokenException,
      );
    });
  });

  describe('getRefereeById', () => {
    it('should return referee if found', async () => {
      prismaService.commitmentReferee.findUnique.mockResolvedValue(mockReferee);

      const result = await service.getRefereeById(mockRefereeId);

      expect(result.id).toBe(mockRefereeId);
    });

    it('should throw RefereeNotFoundException if not found', async () => {
      prismaService.commitmentReferee.findUnique.mockResolvedValue(null);

      await expect(service.getRefereeById('nonexistent')).rejects.toThrow(
        RefereeNotFoundException,
      );
    });
  });

  describe('generateVerificationToken', () => {
    it('should generate JWT token with referee info', () => {
      const refereeId = 'referee-123';
      const email = 'test@example.com';
      const token = service.generateVerificationToken(refereeId, email);

      // JWT token format: header.payload.signature
      expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });
  });
});
