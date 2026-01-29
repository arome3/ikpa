/**
 * Dataset Service
 *
 * Manages evaluation datasets for optimizer cron jobs.
 * Provides CRUD operations for datasets stored in the database.
 *
 * Emits events for Opik integration:
 * - dataset.created: When a new dataset is created
 * - dataset.updated: When a dataset is updated
 * - dataset.activated: When a dataset is activated
 * - dataset.deactivated: When a dataset is deactivated
 *
 * @example
 * ```typescript
 * // Get active dataset for letter optimization
 * const dataset = await datasetService.getActiveDataset('LETTER');
 *
 * // Create a new dataset
 * await datasetService.createDataset({
 *   name: 'subscription-decisions-v2',
 *   type: 'FRAMING',
 *   data: [{ name: 'Netflix', monthly: '₦4,400', annual: '₦52,800' }],
 * });
 * ```
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { EvaluationDatasetType } from '@prisma/client';
import { EvaluationDatasetItem } from '../optimizer.types';
import { FramingDatasetItem } from '../interfaces';
import {
  DATASET_EVENTS,
  DatasetCreatedEvent,
  DatasetUpdatedEvent,
  DatasetActivatedEvent,
  DatasetDeactivatedEvent,
} from '../opik-dataset/opik-dataset.events';

/**
 * DTO for creating a new evaluation dataset
 */
export interface CreateDatasetDto {
  /** Unique name for the dataset */
  name: string;
  /** Type of dataset: FRAMING, LETTER, or TOOL */
  type: EvaluationDatasetType;
  /** Optional description */
  description?: string;
  /** Array of dataset items (structure depends on type) */
  data: unknown[];
}

/**
 * DTO for updating an existing dataset
 */
export interface UpdateDatasetDto {
  /** Updated name (optional) */
  name?: string;
  /** Updated description (optional) */
  description?: string;
  /** Updated data array (optional) */
  data?: unknown[];
  /** Whether the dataset is active (optional) */
  isActive?: boolean;
}

/**
 * Evaluation dataset entity returned from database
 */
export interface EvaluationDatasetEntity {
  id: string;
  name: string;
  type: EvaluationDatasetType;
  description: string | null;
  data: unknown;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DatasetService {
  private readonly logger = new Logger(DatasetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get the active dataset for a specific type
   *
   * Returns the most recently updated active dataset for the given type.
   * If no active dataset exists, returns null.
   *
   * @param type - Dataset type (FRAMING, LETTER, or TOOL)
   * @returns Active dataset or null if none found
   */
  async getActiveDataset(
    type: EvaluationDatasetType,
  ): Promise<EvaluationDatasetEntity | null> {
    const dataset = await this.prisma.evaluationDataset.findFirst({
      where: {
        type,
        isActive: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (dataset) {
      this.logger.debug(`Found active dataset: ${dataset.name} (v${dataset.version})`);
    } else {
      this.logger.warn(`No active dataset found for type: ${type}`);
    }

    return dataset;
  }

  /**
   * Get active dataset data typed for letter optimization
   *
   * @returns Array of EvaluationDatasetItem or null
   */
  async getActiveLetterDataset(): Promise<EvaluationDatasetItem[] | null> {
    const dataset = await this.getActiveDataset(EvaluationDatasetType.LETTER);
    if (!dataset) return null;

    return dataset.data as EvaluationDatasetItem[];
  }

  /**
   * Get active dataset data typed for framing experiments
   *
   * @returns Array of FramingDatasetItem or null
   */
  async getActiveFramingDataset(): Promise<FramingDatasetItem[] | null> {
    const dataset = await this.getActiveDataset(EvaluationDatasetType.FRAMING);
    if (!dataset) return null;

    return dataset.data as FramingDatasetItem[];
  }

  /**
   * Get active dataset data typed for tool optimization
   *
   * @returns Array of tool selection training data or null
   */
  async getActiveToolDataset(): Promise<unknown[] | null> {
    const dataset = await this.getActiveDataset(EvaluationDatasetType.TOOL);
    if (!dataset) return null;

    return dataset.data as unknown[];
  }

  /**
   * Get a dataset by its ID
   *
   * @param id - Dataset UUID
   * @returns Dataset entity
   * @throws NotFoundException if dataset not found
   */
  async getDatasetById(id: string): Promise<EvaluationDatasetEntity> {
    const dataset = await this.prisma.evaluationDataset.findUnique({
      where: { id },
    });

    if (!dataset) {
      throw new NotFoundException(`Dataset with ID ${id} not found`);
    }

    return dataset;
  }

  /**
   * Get a dataset by its name
   *
   * @param name - Dataset name
   * @returns Dataset entity
   * @throws NotFoundException if dataset not found
   */
  async getDatasetByName(name: string): Promise<EvaluationDatasetEntity> {
    const dataset = await this.prisma.evaluationDataset.findUnique({
      where: { name },
    });

    if (!dataset) {
      throw new NotFoundException(`Dataset with name "${name}" not found`);
    }

    return dataset;
  }

  /**
   * List all datasets, optionally filtered by type
   *
   * @param type - Optional type filter
   * @param includeInactive - Whether to include inactive datasets (default: false)
   * @returns Array of dataset entities
   */
  async listDatasets(
    type?: EvaluationDatasetType,
    includeInactive = false,
  ): Promise<EvaluationDatasetEntity[]> {
    return this.prisma.evaluationDataset.findMany({
      where: {
        ...(type && { type }),
        ...(!includeInactive && { isActive: true }),
      },
      orderBy: [{ type: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  /**
   * Create a new evaluation dataset
   *
   * @param dto - Dataset creation data
   * @returns Created dataset entity
   */
  async createDataset(dto: CreateDatasetDto): Promise<EvaluationDatasetEntity> {
    const dataset = await this.prisma.evaluationDataset.create({
      data: {
        name: dto.name,
        type: dto.type,
        description: dto.description,
        data: dto.data as object,
      },
    });

    this.logger.log(`Created dataset: ${dataset.name} (type: ${dataset.type})`);

    // Emit event for Opik sync
    this.eventEmitter.emit(DATASET_EVENTS.CREATED, new DatasetCreatedEvent(dataset));

    return dataset;
  }

  /**
   * Update an existing dataset
   *
   * Automatically increments the version number when data is updated.
   *
   * @param id - Dataset UUID
   * @param dto - Update data
   * @returns Updated dataset entity
   * @throws NotFoundException if dataset not found
   */
  async updateDataset(
    id: string,
    dto: UpdateDatasetDto,
  ): Promise<EvaluationDatasetEntity> {
    // First verify the dataset exists
    await this.getDatasetById(id);

    // If data is being updated, increment version
    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    if (dto.data !== undefined) {
      updateData.data = dto.data as object;
      updateData.version = { increment: 1 };
    }

    const dataset = await this.prisma.evaluationDataset.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Updated dataset: ${dataset.name} (v${dataset.version})`);

    // Emit event for Opik sync (only if data was updated)
    if (dto.data !== undefined) {
      this.eventEmitter.emit(DATASET_EVENTS.UPDATED, new DatasetUpdatedEvent(dataset));
    }

    return dataset;
  }

  /**
   * Deactivate a dataset
   *
   * Marks the dataset as inactive. This is preferred over deletion
   * to maintain audit history.
   *
   * @param id - Dataset UUID
   * @returns Deactivated dataset entity
   * @throws NotFoundException if dataset not found
   */
  async deactivateDataset(id: string): Promise<EvaluationDatasetEntity> {
    const dataset = await this.updateDataset(id, { isActive: false });
    this.logger.log(`Deactivated dataset: ${dataset.name}`);

    // Emit event for tracking
    this.eventEmitter.emit(DATASET_EVENTS.DEACTIVATED, new DatasetDeactivatedEvent(dataset));

    return dataset;
  }

  /**
   * Activate a dataset
   *
   * Marks the dataset as active and optionally deactivates other datasets
   * of the same type (to ensure only one active dataset per type).
   *
   * @param id - Dataset UUID
   * @param deactivateOthers - Whether to deactivate other datasets of the same type
   * @returns Activated dataset entity
   */
  async activateDataset(
    id: string,
    deactivateOthers = true,
  ): Promise<EvaluationDatasetEntity> {
    const dataset = await this.getDatasetById(id);

    if (deactivateOthers) {
      // Deactivate all other datasets of the same type
      await this.prisma.evaluationDataset.updateMany({
        where: {
          type: dataset.type,
          isActive: true,
          id: { not: id },
        },
        data: { isActive: false },
      });
    }

    const activated = await this.prisma.evaluationDataset.update({
      where: { id },
      data: { isActive: true },
    });

    this.logger.log(`Activated dataset: ${activated.name} (type: ${activated.type})`);

    // Emit event for Opik sync
    this.eventEmitter.emit(DATASET_EVENTS.ACTIVATED, new DatasetActivatedEvent(activated));

    return activated;
  }

  /**
   * Delete a dataset permanently
   *
   * Use with caution - prefer deactivateDataset for audit purposes.
   *
   * @param id - Dataset UUID
   * @throws NotFoundException if dataset not found
   */
  async deleteDataset(id: string): Promise<void> {
    await this.getDatasetById(id); // Verify exists

    await this.prisma.evaluationDataset.delete({
      where: { id },
    });

    this.logger.log(`Deleted dataset: ${id}`);
  }

  /**
   * Seed initial datasets (for development/testing)
   *
   * Creates default datasets if they don't exist.
   */
  async seedDefaultDatasets(): Promise<void> {
    // Check if datasets already exist
    const existingCount = await this.prisma.evaluationDataset.count();
    if (existingCount > 0) {
      this.logger.debug('Datasets already seeded, skipping');
      return;
    }

    // Seed letter optimization dataset
    await this.createDataset({
      name: 'future-self-letters-v1',
      type: EvaluationDatasetType.LETTER,
      description: 'Default dataset for Future Self letter optimization',
      data: [
        {
          input: {
            name: 'Chidi',
            age: 28,
            savingsRate: 10,
            currentNetWorth: '₦15,000,000',
            optimizedNetWorth: '₦45,000,000',
          },
        },
        {
          input: {
            name: 'Amara',
            age: 32,
            savingsRate: 5,
            currentNetWorth: '₦8,000,000',
            optimizedNetWorth: '₦35,000,000',
          },
        },
        {
          input: {
            name: 'Emeka',
            age: 25,
            savingsRate: 15,
            currentNetWorth: '₦25,000,000',
            optimizedNetWorth: '₦65,000,000',
          },
        },
        {
          input: {
            name: 'Ngozi',
            age: 35,
            savingsRate: 8,
            currentNetWorth: '₦12,000,000',
            optimizedNetWorth: '₦40,000,000',
          },
        },
        {
          input: {
            name: 'Tunde',
            age: 30,
            savingsRate: 3,
            currentNetWorth: '₦5,000,000',
            optimizedNetWorth: '₦28,000,000',
          },
        },
      ],
    });

    // Seed framing experiment dataset
    await this.createDataset({
      name: 'subscription-decisions-v1',
      type: EvaluationDatasetType.FRAMING,
      description: 'Default dataset for subscription framing A/B tests',
      data: [
        {
          name: 'Netflix Premium',
          monthly: '₦4,400',
          annual: '₦52,800',
          category: 'streaming',
          expectedDecision: 'cancel',
        },
        {
          name: 'Spotify Family',
          monthly: '₦2,950',
          annual: '₦35,400',
          category: 'streaming',
          expectedDecision: 'keep',
        },
        {
          name: 'YouTube Premium',
          monthly: '₦1,100',
          annual: '₦13,200',
          category: 'streaming',
          expectedDecision: 'keep',
        },
        {
          name: 'Adobe Creative Cloud',
          monthly: '₦22,000',
          annual: '₦264,000',
          category: 'software',
          expectedDecision: 'cancel',
        },
        {
          name: 'Gym Membership',
          monthly: '₦15,000',
          annual: '₦180,000',
          category: 'fitness',
          expectedDecision: 'cancel',
        },
      ],
    });

    this.logger.log('Seeded default evaluation datasets');
  }
}
