/**
 * Opik Dataset Service
 *
 * Integrates with Opik's Datasets API to register evaluation datasets
 * for visibility in the Opik UI. Provides versioned dataset management
 * and sync capabilities.
 *
 * Key Features:
 * - Automatic dataset registration with Opik on create/update
 * - Dataset version tracking and sync status
 * - Graceful degradation when Opik is unavailable
 * - Dataset-to-trace linking for experiment tracking
 * - Startup sync of existing datasets
 *
 * @example
 * ```typescript
 * // Register a new dataset
 * const datasetId = await opikDatasetService.registerDataset(
 *   'subscription-decisions-v2',
 *   'FRAMING',
 *   [{ name: 'Netflix', monthly: '₦4,400', annual: '₦52,800' }],
 * );
 *
 * // Link dataset to trace
 * await opikDatasetService.linkDatasetToTrace({
 *   traceId: 'trace-123',
 *   datasetName: 'subscription-decisions-v2',
 *   itemIds: ['item-1', 'item-2'],
 * });
 * ```
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { OpikService } from '../../opik.service';
import { DatasetService, EvaluationDatasetEntity } from '../dataset';
import {
  OpikDatasetType,
  OpikDatasetItem,
  OpikDatasetSyncResult,
  DatasetRegistryEntry,
  DatasetTraceLinkOptions,
  IOpikDatasetService,
} from './opik-dataset.interfaces';

/**
 * Default retry configuration for Opik operations
 */
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const MAX_BACKOFF_DELAY_MS = 10000;

/**
 * Naming convention for Opik datasets
 */
const OPIK_DATASET_PREFIX = 'ikpa';

@Injectable()
export class OpikDatasetService implements IOpikDatasetService, OnModuleInit {
  private readonly logger = new Logger(OpikDatasetService.name);

  /**
   * In-memory registry of synced datasets
   * Maps local dataset ID to Opik registry entry
   */
  private readonly datasetRegistry = new Map<string, DatasetRegistryEntry>();

  /**
   * Cache of Opik dataset names to IDs for quick lookup
   */
  private readonly datasetIdCache = new Map<string, string>();

  /**
   * Flag to track if startup sync has completed
   */
  private startupSyncComplete = false;

  constructor(
    private readonly opikService: OpikService,
    private readonly datasetService: DatasetService,
  ) {}

  /**
   * Sync existing datasets on module initialization
   */
  async onModuleInit(): Promise<void> {
    // Only sync if Opik is available
    if (!this.opikService.isAvailable()) {
      this.logger.warn('Opik not available, skipping startup dataset sync');
      return;
    }

    // Perform async sync in background to not block startup
    this.syncAllDatasetsInBackground();
  }

  /**
   * Register a dataset with Opik
   *
   * Creates or updates a dataset in Opik with the given items.
   * Uses getOrCreateDataset to handle idempotent creation.
   *
   * @param name - Dataset name
   * @param type - Dataset type
   * @param items - Dataset items
   * @returns Opik dataset ID
   */
  async registerDataset(
    name: string,
    type: OpikDatasetType,
    items: OpikDatasetItem[],
  ): Promise<string> {
    const opikName = this.buildOpikDatasetName(name, type);

    if (!this.opikService.isAvailable()) {
      this.logger.debug(`Opik unavailable, storing dataset reference locally: ${opikName}`);
      // Return a placeholder ID when Opik is unavailable
      return `local:${opikName}:${randomUUID()}`;
    }

    try {
      const client = this.opikService.getClient();
      if (!client) {
        throw new Error('Opik client not initialized');
      }

      // Create or get existing dataset
      const description = this.buildDatasetDescription(type, items.length);
      const dataset = await this.withRetry(
        () => client.getOrCreateDataset(opikName, description),
        'getOrCreateDataset',
      );

      // Clear existing items and insert new ones for version sync
      // This ensures the Opik dataset matches our local state
      await this.syncDatasetItems(dataset, items);

      // Update cache
      this.datasetIdCache.set(opikName, dataset.id);

      this.logger.log(
        `Registered dataset with Opik: ${opikName} (ID: ${dataset.id}, items: ${items.length})`,
      );

      return dataset.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to register dataset ${opikName}: ${errorMessage}`);
      // Return placeholder on failure to allow graceful degradation
      return `error:${opikName}:${randomUUID()}`;
    }
  }

  /**
   * Get dataset ID from Opik by name
   *
   * @param name - Dataset name (without prefix)
   * @returns Dataset ID or null if not found
   */
  async getDatasetId(name: string): Promise<string | null> {
    // Check cache first
    if (this.datasetIdCache.has(name)) {
      return this.datasetIdCache.get(name) || null;
    }

    // Also check with prefix
    const prefixedName = this.buildOpikDatasetName(name, 'FRAMING');
    if (this.datasetIdCache.has(prefixedName)) {
      return this.datasetIdCache.get(prefixedName) || null;
    }

    if (!this.opikService.isAvailable()) {
      return null;
    }

    try {
      const client = this.opikService.getClient();
      if (!client) {
        return null;
      }

      // Try to get the dataset
      const dataset = await client.getDataset(name);
      this.datasetIdCache.set(name, dataset.id);
      return dataset.id;
    } catch {
      // Dataset not found
      this.logger.debug(`Dataset not found in Opik: ${name}`);
      return null;
    }
  }

  /**
   * Sync all local datasets to Opik
   *
   * Iterates through all active datasets in the database
   * and ensures they are registered with Opik.
   */
  async syncAllDatasets(): Promise<void> {
    if (!this.opikService.isAvailable()) {
      this.logger.warn('Opik unavailable, skipping dataset sync');
      return;
    }

    this.logger.log('Starting full dataset sync to Opik');

    try {
      // Get all active datasets from database
      const datasets = await this.datasetService.listDatasets(undefined, false);

      const results: OpikDatasetSyncResult[] = [];

      for (const dataset of datasets) {
        const result = await this.syncSingleDataset(dataset);
        results.push(result);
      }

      // Log summary
      const successful = results.filter((r) => r.success).length;
      const failed = results.length - successful;

      this.logger.log(
        `Dataset sync complete: ${successful} successful, ${failed} failed out of ${results.length} total`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Dataset sync failed: ${errorMessage}`);
    }
  }

  /**
   * Link dataset to trace metadata
   *
   * Stores dataset reference in trace metadata for visibility
   * in Opik UI and experiment tracking.
   *
   * @param options - Link options
   */
  async linkDatasetToTrace(options: DatasetTraceLinkOptions): Promise<void> {
    const { traceId, datasetName, itemIds, context } = options;

    if (!this.opikService.isAvailable()) {
      this.logger.debug(`Opik unavailable, skipping trace link: ${traceId} -> ${datasetName}`);
      return;
    }

    try {
      // Get or create the dataset ID
      let datasetId = await this.getDatasetId(datasetName);

      // If not found, try to find with prefix patterns
      if (!datasetId) {
        for (const type of ['FRAMING', 'LETTER', 'TOOL'] as OpikDatasetType[]) {
          const prefixedName = this.buildOpikDatasetName(datasetName, type);
          datasetId = await this.getDatasetId(prefixedName);
          if (datasetId) break;
        }
      }

      // Log the link for debugging
      this.logger.debug(
        `Linked dataset to trace: ${datasetName} (${datasetId || 'unknown'}) -> trace ${traceId}`,
      );

      // Add feedback/score to trace with dataset reference
      // This creates visibility in Opik UI
      this.opikService.addFeedback({
        traceId,
        name: 'dataset_reference',
        value: 1,
        category: 'custom',
        comment: `Dataset: ${datasetName}`,
        metadata: {
          datasetName,
          datasetId,
          itemIds,
          ...context,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to link dataset to trace: ${errorMessage}`);
    }
  }

  /**
   * Get the dataset registry (for debugging/monitoring)
   */
  getDatasetRegistry(): Map<string, DatasetRegistryEntry> {
    return new Map(this.datasetRegistry);
  }

  /**
   * Check if startup sync has completed
   */
  isStartupSyncComplete(): boolean {
    return this.startupSyncComplete;
  }

  /**
   * Register a dataset with Opik and update the registry
   *
   * Called when a dataset is created or updated in the database.
   *
   * @param entity - Dataset entity from database
   */
  async onDatasetCreatedOrUpdated(entity: EvaluationDatasetEntity): Promise<void> {
    const items = this.convertEntityToItems(entity);
    const type = entity.type as OpikDatasetType;

    const opikId = await this.registerDataset(entity.name, type, items);

    // Update registry
    this.datasetRegistry.set(entity.id, {
      localId: entity.id,
      opikId,
      opikName: this.buildOpikDatasetName(entity.name, type),
      type,
      version: entity.version,
      lastSyncedAt: new Date(),
      itemCount: items.length,
    });
  }

  // ==========================================
  // PRIVATE METHODS
  // ==========================================

  /**
   * Sync datasets in background without blocking startup
   */
  private syncAllDatasetsInBackground(): void {
    setImmediate(async () => {
      try {
        await this.syncAllDatasets();
        this.startupSyncComplete = true;
        this.logger.log('Startup dataset sync completed');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Startup dataset sync failed: ${errorMessage}`);
        this.startupSyncComplete = true; // Mark complete even on failure
      }
    });
  }

  /**
   * Sync a single dataset to Opik
   */
  private async syncSingleDataset(
    entity: EvaluationDatasetEntity,
  ): Promise<OpikDatasetSyncResult> {
    const type = entity.type as OpikDatasetType;
    const opikName = this.buildOpikDatasetName(entity.name, type);
    const items = this.convertEntityToItems(entity);

    try {
      const opikId = await this.registerDataset(entity.name, type, items);

      // Update registry
      this.datasetRegistry.set(entity.id, {
        localId: entity.id,
        opikId,
        opikName,
        type,
        version: entity.version,
        lastSyncedAt: new Date(),
        itemCount: items.length,
      });

      return {
        success: true,
        datasetId: opikId,
        datasetName: opikName,
        itemCount: items.length,
        syncedAt: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        datasetName: opikName,
        itemCount: items.length,
        error: errorMessage,
        syncedAt: new Date(),
      };
    }
  }

  /**
   * Sync items to an Opik dataset
   */
  private async syncDatasetItems(
    dataset: { id: string; name: string; insert: (items: OpikDatasetItem[]) => Promise<void>; clear: () => Promise<void> },
    items: OpikDatasetItem[],
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    try {
      // Clear existing items to ensure clean sync
      await this.withRetry(
        () => dataset.clear(),
        'clearDataset',
      );

      // Insert new items
      await this.withRetry(
        () => dataset.insert(items),
        'insertDatasetItems',
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to sync dataset items: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Convert database entity to Opik dataset items
   */
  private convertEntityToItems(entity: EvaluationDatasetEntity): OpikDatasetItem[] {
    const data = entity.data as unknown[];
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item, index) => {
      const baseItem = item as Record<string, unknown>;
      return {
        id: `${entity.id}-item-${index}`,
        input: baseItem.input as Record<string, unknown> || baseItem,
        expectedOutput: baseItem.expectedOutput as Record<string, unknown>,
        metadata: {
          sourceDatasetId: entity.id,
          sourceDatasetVersion: entity.version,
          sourceDatasetType: entity.type,
          itemIndex: index,
        },
        // Spread any additional fields
        ...baseItem,
      };
    });
  }

  /**
   * Build consistent Opik dataset name
   */
  private buildOpikDatasetName(name: string, type: OpikDatasetType): string {
    // Remove any existing prefix to avoid duplication
    const cleanName = name.replace(new RegExp(`^${OPIK_DATASET_PREFIX}-`), '');
    const cleanType = type.toLowerCase();
    return `${OPIK_DATASET_PREFIX}-${cleanType}-${cleanName}`;
  }

  /**
   * Build dataset description
   */
  private buildDatasetDescription(type: OpikDatasetType, itemCount: number): string {
    const typeDescriptions: Record<OpikDatasetType, string> = {
      FRAMING: 'A/B test dataset for subscription framing experiments',
      LETTER: 'Evaluation dataset for Future Self letter optimization',
      TOOL: 'Training dataset for GPS Re-Router tool selection',
    };

    return `${typeDescriptions[type]}. Items: ${itemCount}. Managed by IKPA.`;
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxAttempts = DEFAULT_RETRY_ATTEMPTS,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        this.logger.warn(
          `${operationName} attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`,
        );

        if (attempt < maxAttempts) {
          const delay = this.calculateBackoff(attempt);
          await this.delay(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = DEFAULT_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.3 * baseDelay;
    return Math.min(baseDelay + jitter, MAX_BACKOFF_DELAY_MS);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
