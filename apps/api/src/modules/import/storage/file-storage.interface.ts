/**
 * File Storage Interface
 *
 * Abstraction for file storage to allow easy migration from
 * local filesystem to S3 or other cloud storage.
 */

import { StoredFile } from '../interfaces';

/**
 * Abstract file storage service
 */
export interface IFileStorage {
  /**
   * Store a file
   * @param userId - User ID for organizing files
   * @param file - File buffer
   * @param originalName - Original file name
   * @param mimeType - MIME type of the file
   * @returns Stored file metadata
   */
  store(
    userId: string,
    file: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<StoredFile>;

  /**
   * Read a file
   * @param path - Storage path from store() result
   * @returns File buffer
   */
  read(path: string): Promise<Buffer>;

  /**
   * Delete a file
   * @param path - Storage path from store() result
   */
  delete(path: string): Promise<void>;

  /**
   * Check if a file exists
   * @param path - Storage path to check
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file metadata
   * @param path - Storage path
   */
  getMetadata(path: string): Promise<StoredFile | null>;
}

/**
 * Storage provider token for dependency injection
 */
export const FILE_STORAGE = Symbol('FILE_STORAGE');
