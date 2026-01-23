import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { FutureSelfController } from '../future-self.controller';
import { FutureSelfService } from '../future-self.service';
import { FutureSimulation, LetterFromFuture, TimelineProjection } from '../interfaces';

describe('FutureSelfController', () => {
  let controller: FutureSelfController;
  let service: {
    getSimulation: Mock;
    getLetter: Mock;
    getTimeline: Mock;
  };

  const mockUserId = 'user-123';

  const mockSimulation: FutureSimulation = {
    currentBehavior: {
      savingsRate: 0.12,
      projectedNetWorth: {
        '6mo': 550000,
        '1yr': 620000,
        '5yr': 2100000,
        '10yr': 4800000,
        '20yr': 12000000,
      },
    },
    withIKPA: {
      savingsRate: 0.18,
      projectedNetWorth: {
        '6mo': 580000,
        '1yr': 700000,
        '5yr': 3200000,
        '10yr': 8500000,
        '20yr': 28000000,
      },
    },
    difference_20yr: 16000000,
  };

  const mockLetter: LetterFromFuture = {
    content: `Dear Aisha,

I'm writing this from the balcony of our flat in Victoria Island.
Yes, OUR flat—we own it now, mortgage-free.

Keep going. I'm proof it works.

With love from your future,
Aisha (Age 60)`,
    generatedAt: new Date('2026-01-22T10:00:00.000Z'),
    simulationData: mockSimulation,
    userAge: 28,
    futureAge: 60,
  };

  const mockTimeline: TimelineProjection = {
    currentPath: 4800000,
    optimizedPath: 8500000,
    difference: 3700000,
    years: 10,
  };

  beforeEach(async () => {
    const mockService = {
      getSimulation: vi.fn(),
      getLetter: vi.fn(),
      getTimeline: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FutureSelfController],
      providers: [
        { provide: FutureSelfService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<FutureSelfController>(FutureSelfController);
    service = module.get(FutureSelfService);
  });

  describe('getSimulation', () => {
    it('should return simulation response DTO', async () => {
      service.getSimulation.mockResolvedValue(mockSimulation);

      const result = await controller.getSimulation(mockUserId);

      expect(result).toEqual({
        currentBehavior: {
          savingsRate: 0.12,
          projectedNetWorth: mockSimulation.currentBehavior.projectedNetWorth,
        },
        withIKPA: {
          savingsRate: 0.18,
          projectedNetWorth: mockSimulation.withIKPA.projectedNetWorth,
        },
        difference_20yr: 16000000,
      });
      expect(service.getSimulation).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('getLetter', () => {
    it('should return letter response DTO', async () => {
      service.getLetter.mockResolvedValue(mockLetter);

      const result = await controller.getLetter(mockUserId);

      expect(result.content).toContain('Dear Aisha');
      expect(result.userAge).toBe(28);
      expect(result.futureAge).toBe(60);
      expect(result.simulationData).toBeDefined();
      expect(result.simulationData.difference_20yr).toBe(16000000);
      expect(service.getLetter).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('getTimeline', () => {
    it('should return timeline response DTO for 10 years', async () => {
      service.getTimeline.mockResolvedValue(mockTimeline);

      const result = await controller.getTimeline(mockUserId, 10);

      expect(result).toEqual({
        currentPath: 4800000,
        optimizedPath: 8500000,
        difference: 3700000,
        years: 10,
      });
      expect(service.getTimeline).toHaveBeenCalledWith(mockUserId, 10);
    });

    it('should accept different year values', async () => {
      const timeline5yr: TimelineProjection = {
        currentPath: 2100000,
        optimizedPath: 3200000,
        difference: 1100000,
        years: 5,
      };
      service.getTimeline.mockResolvedValue(timeline5yr);

      const result = await controller.getTimeline(mockUserId, 5);

      expect(result.years).toBe(5);
      expect(result.currentPath).toBe(2100000);
      expect(service.getTimeline).toHaveBeenCalledWith(mockUserId, 5);
    });
  });
});
