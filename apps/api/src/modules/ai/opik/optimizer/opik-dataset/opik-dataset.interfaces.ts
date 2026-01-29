/**
 * Opik Dataset Interfaces
 *
 * Type definitions for Opik Dataset integration.
 */

/**
 * Supported dataset types in IKPA
 */
export type OpikDatasetType = 'FRAMING' | 'LETTER' | 'TOOL';

/**
 * Configuration for syncing a dataset to Opik
 */
export interface OpikDatasetSyncConfig {
  /** Name of the dataset in Opik */
  name: string;
  /** Description for the dataset */
  description?: string;
  /** Type of dataset */
  type: OpikDatasetType;
  /** Dataset items to sync */
  items: OpikDatasetItem[];
  /** Version number (for tracking) */
  version?: number;
}

/**
 * Generic dataset item for Opik
 * Maps to Opik's DatasetItemData type
 */
export interface OpikDatasetItem {
  /** Optional item ID (auto-generated if not provided) */
  id?: string;
  /** Input data for the item */
  input?: Record<string, unknown>;
  /** Expected output for evaluation */
  expectedOutput?: Record<string, unknown>;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Any additional fields */
  [key: string]: unknown;
}

/**
 * Result of a dataset sync operation
 */
export interface OpikDatasetSyncResult {
  /** Whether sync was successful */
  success: boolean;
  /** Opik dataset ID */
  datasetId?: string;
  /** Opik dataset name */
  datasetName: string;
  /** Number of items synced */
  itemCount: number;
  /** Error message if failed */
  error?: string;
  /** Timestamp of sync */
  syncedAt: Date;
}

/**
 * Dataset registry entry for tracking synced datasets
 */
export interface DatasetRegistryEntry {
  /** Local database ID */
  localId: string;
  /** Opik dataset ID */
  opikId: string;
  /** Opik dataset name */
  opikName: string;
  /** Dataset type */
  type: OpikDatasetType;
  /** Version number */
  version: number;
  /** Last sync timestamp */
  lastSyncedAt: Date;
  /** Item count at sync time */
  itemCount: number;
}

/**
 * Options for linking a dataset to a trace
 */
export interface DatasetTraceLinkOptions {
  /** Trace ID to link to */
  traceId: string;
  /** Dataset name */
  datasetName: string;
  /** Optional dataset item IDs being used in this trace */
  itemIds?: string[];
  /** Additional context about the usage */
  context?: Record<string, unknown>;
}

/**
 * Interface for the OpikDatasetService
 */
export interface IOpikDatasetService {
  /**
   * Register a dataset with Opik
   *
   * @param name - Dataset name
   * @param type - Dataset type (FRAMING, LETTER, TOOL)
   * @param items - Array of dataset items
   * @returns Opik dataset ID
   */
  registerDataset(
    name: string,
    type: OpikDatasetType,
    items: OpikDatasetItem[],
  ): Promise<string>;

  /**
   * Get dataset ID from Opik by name
   *
   * @param name - Dataset name
   * @returns Dataset ID or null if not found
   */
  getDatasetId(name: string): Promise<string | null>;

  /**
   * Sync all local datasets to Opik
   */
  syncAllDatasets(): Promise<void>;

  /**
   * Link dataset to trace metadata
   *
   * @param options - Link options
   */
  linkDatasetToTrace(options: DatasetTraceLinkOptions): Promise<void>;
}
