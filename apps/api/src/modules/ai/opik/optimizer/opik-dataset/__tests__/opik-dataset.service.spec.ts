/**
 * Opik Dataset Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpikDatasetService } from '../opik-dataset.service';
import { OpikService } from '../../../opik.service';
import { DatasetService, EvaluationDatasetEntity } from '../../dataset';
import { OpikDatasetType, OpikDatasetItem } from '../opik-dataset.interfaces';
import { EvaluationDatasetType } from '@prisma/client';

describe('OpikDatasetService', () => {
  let service: OpikDatasetService;
  let opikService: jest.Mocked<OpikService>;
  let datasetService: jest.Mocked<DatasetService>;
  let configService: jest.Mocked<ConfigService>;

  // Mock Opik dataset object
  const mockOpikDataset = {
    id: 'opik-dataset-123',
    name: 'ikpa-framing-test-dataset',
    insert: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    getItems: jest.fn().mockResolvedValue([]),
  };

  // Mock Opik client
  const mockOpikClient = {
    getOrCreateDataset: jest.fn().mockResolvedValue(mockOpikDataset),
    getDataset: jest.fn().mockResolvedValue(mockOpikDataset),
    createDataset: jest.fn().mockResolvedValue(mockOpikDataset),
    deleteDataset: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpikDatasetService,
        {
          provide: OpikService,
          useValue: {
            isAvailable: jest.fn().mockReturnValue(true),
            getClient: jest.fn().mockReturnValue(mockOpikClient),
            addFeedback: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: DatasetService,
          useValue: {
            listDatasets: jest.fn().mockResolvedValue([]),
            getActiveDataset: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<OpikDatasetService>(OpikDatasetService);
    opikService = module.get(OpikService);
    datasetService = module.get(DatasetService);
    configService = module.get(ConfigService);
  });

  describe('registerDataset', () => {
    const testItems: OpikDatasetItem[] = [
      { id: 'item-1', input: { name: 'Netflix', monthly: '₦4,400' } },
      { id: 'item-2', input: { name: 'Spotify', monthly: '₦2,950' } },
    ];

    it('should register a dataset with Opik', async () => {
      const datasetId = await service.registerDataset(
        'test-dataset',
        'FRAMING',
        testItems,
      );

      expect(datasetId).toBe('opik-dataset-123');
      expect(mockOpikClient.getOrCreateDataset).toHaveBeenCalledWith(
        'ikpa-framing-test-dataset',
        expect.stringContaining('A/B test dataset'),
      );
      expect(mockOpikDataset.clear).toHaveBeenCalled();
      expect(mockOpikDataset.insert).toHaveBeenCalledWith(testItems);
    });

    it('should return placeholder ID when Opik is unavailable', async () => {
      opikService.isAvailable.mockReturnValue(false);

      const datasetId = await service.registerDataset(
        'test-dataset',
        'FRAMING',
        testItems,
      );

      expect(datasetId).toMatch(/^local:ikpa-framing-test-dataset:/);
      expect(mockOpikClient.getOrCreateDataset).not.toHaveBeenCalled();
    });

    it('should return error placeholder on failure', async () => {
      mockOpikClient.getOrCreateDataset.mockRejectedValueOnce(
        new Error('Network error'),
      );

      const datasetId = await service.registerDataset(
        'test-dataset',
        'FRAMING',
        testItems,
      );

      expect(datasetId).toMatch(/^error:ikpa-framing-test-dataset:/);
    });

    it('should build correct Opik dataset names for each type', async () => {
      const types: OpikDatasetType[] = ['FRAMING', 'LETTER', 'TOOL'];

      for (const type of types) {
        await service.registerDataset('my-dataset', type, testItems);
      }

      expect(mockOpikClient.getOrCreateDataset).toHaveBeenNthCalledWith(
        1,
        'ikpa-framing-my-dataset',
        expect.any(String),
      );
      expect(mockOpikClient.getOrCreateDataset).toHaveBeenNthCalledWith(
        2,
        'ikpa-letter-my-dataset',
        expect.any(String),
      );
      expect(mockOpikClient.getOrCreateDataset).toHaveBeenNthCalledWith(
        3,
        'ikpa-tool-my-dataset',
        expect.any(String),
      );
    });
  });

  describe('getDatasetId', () => {
    it('should return cached dataset ID', async () => {
      // First register to populate cache
      await service.registerDataset('test-dataset', 'FRAMING', []);

      // Now get should return from cache
      const datasetId = await service.getDatasetId('ikpa-framing-test-dataset');

      expect(datasetId).toBe('opik-dataset-123');
      // getOrCreateDataset was called once for register, but getDataset should not be called
      expect(mockOpikClient.getOrCreateDataset).toHaveBeenCalledTimes(1);
    });

    it('should fetch from Opik when not cached', async () => {
      const datasetId = await service.getDatasetId('unknown-dataset');

      expect(mockOpikClient.getDataset).toHaveBeenCalledWith('unknown-dataset');
      expect(datasetId).toBe('opik-dataset-123');
    });

    it('should return null when dataset not found', async () => {
      mockOpikClient.getDataset.mockRejectedValueOnce(
        new Error('Dataset not found'),
      );

      const datasetId = await service.getDatasetId('nonexistent');

      expect(datasetId).toBeNull();
    });

    it('should return null when Opik is unavailable', async () => {
      opikService.isAvailable.mockReturnValue(false);

      const datasetId = await service.getDatasetId('test-dataset');

      expect(datasetId).toBeNull();
    });
  });

  describe('syncAllDatasets', () => {
    const mockDatasets: EvaluationDatasetEntity[] = [
      {
        id: 'dataset-1',
        name: 'framing-v1',
        type: EvaluationDatasetType.FRAMING,
        description: 'Framing dataset',
        data: [
          { name: 'Netflix', monthly: '₦4,400', annual: '₦52,800' },
        ],
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'dataset-2',
        name: 'letter-v1',
        type: EvaluationDatasetType.LETTER,
        description: 'Letter dataset',
        data: [
          { input: { name: 'Chidi', age: 28 } },
        ],
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should sync all active datasets', async () => {
      datasetService.listDatasets.mockResolvedValue(mockDatasets);

      await service.syncAllDatasets();

      expect(datasetService.listDatasets).toHaveBeenCalledWith(undefined, false);
      expect(mockOpikClient.getOrCreateDataset).toHaveBeenCalledTimes(2);
    });

    it('should skip sync when Opik is unavailable', async () => {
      opikService.isAvailable.mockReturnValue(false);

      await service.syncAllDatasets();

      expect(datasetService.listDatasets).not.toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      datasetService.listDatasets.mockRejectedValueOnce(
        new Error('Database error'),
      );

      // Should not throw
      await expect(service.syncAllDatasets()).resolves.not.toThrow();
    });

    it('should update registry after sync', async () => {
      datasetService.listDatasets.mockResolvedValue([mockDatasets[0]]);

      await service.syncAllDatasets();

      const registry = service.getDatasetRegistry();
      expect(registry.has('dataset-1')).toBe(true);
      expect(registry.get('dataset-1')).toMatchObject({
        localId: 'dataset-1',
        opikId: 'opik-dataset-123',
        type: 'FRAMING',
        version: 1,
      });
    });
  });

  describe('linkDatasetToTrace', () => {
    it('should add feedback with dataset reference', async () => {
      // First register to populate cache
      await service.registerDataset('test-dataset', 'FRAMING', []);

      await service.linkDatasetToTrace({
        traceId: 'trace-123',
        datasetName: 'ikpa-framing-test-dataset',
        itemIds: ['item-1', 'item-2'],
        context: { experiment: 'framing-test' },
      });

      expect(opikService.addFeedback).toHaveBeenCalledWith({
        traceId: 'trace-123',
        name: 'dataset_reference',
        value: 1,
        category: 'custom',
        comment: 'Dataset: ikpa-framing-test-dataset',
        metadata: expect.objectContaining({
          datasetName: 'ikpa-framing-test-dataset',
          datasetId: 'opik-dataset-123',
          itemIds: ['item-1', 'item-2'],
          experiment: 'framing-test',
        }),
      });
    });

    it('should skip linking when Opik is unavailable', async () => {
      opikService.isAvailable.mockReturnValue(false);

      await service.linkDatasetToTrace({
        traceId: 'trace-123',
        datasetName: 'test-dataset',
      });

      expect(opikService.addFeedback).not.toHaveBeenCalled();
    });

    it('should handle linking errors gracefully', async () => {
      opikService.addFeedback.mockImplementation(() => {
        throw new Error('Feedback error');
      });

      // Should not throw
      await expect(
        service.linkDatasetToTrace({
          traceId: 'trace-123',
          datasetName: 'test-dataset',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('onDatasetCreatedOrUpdated', () => {
    const mockEntity: EvaluationDatasetEntity = {
      id: 'entity-123',
      name: 'new-dataset',
      type: EvaluationDatasetType.FRAMING,
      description: 'New dataset',
      data: [{ name: 'Test', monthly: '₦1,000' }],
      isActive: true,
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should register dataset and update registry', async () => {
      await service.onDatasetCreatedOrUpdated(mockEntity);

      expect(mockOpikClient.getOrCreateDataset).toHaveBeenCalledWith(
        'ikpa-framing-new-dataset',
        expect.any(String),
      );

      const registry = service.getDatasetRegistry();
      expect(registry.has('entity-123')).toBe(true);
      expect(registry.get('entity-123')).toMatchObject({
        localId: 'entity-123',
        opikId: 'opik-dataset-123',
        version: 2,
        itemCount: 1,
      });
    });
  });

  describe('retry logic', () => {
    it('should retry on transient failures', async () => {
      mockOpikClient.getOrCreateDataset
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce(mockOpikDataset);

      const datasetId = await service.registerDataset('test', 'FRAMING', []);

      expect(datasetId).toBe('opik-dataset-123');
      expect(mockOpikClient.getOrCreateDataset).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      mockOpikClient.getOrCreateDataset.mockRejectedValue(
        new Error('Persistent error'),
      );

      const datasetId = await service.registerDataset('test', 'FRAMING', []);

      // Should return error placeholder after retries exhausted
      expect(datasetId).toMatch(/^error:/);
      expect(mockOpikClient.getOrCreateDataset).toHaveBeenCalledTimes(3);
    });
  });

  describe('isStartupSyncComplete', () => {
    it('should return false initially', () => {
      expect(service.isStartupSyncComplete()).toBe(false);
    });
  });
});
