/**
 * Local File Storage Adapter
 *
 * Implements file storage using the local filesystem.
 * Files are organized by user ID: ./uploads/{userId}/{filename}
 *
 * This adapter is suitable for development and single-server deployments.
 * For production with multiple servers, migrate to S3 or similar.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IFileStorage } from './file-storage.interface';
import { StoredFile } from '../interfaces';
import { ImportStorageException } from '../exceptions';
import { UPLOADS_DIR } from '../constants';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class LocalStorageAdapter implements IFileStorage, OnModuleInit {
  private readonly logger = new Logger(LocalStorageAdapter.name);
  private readonly baseDir = UPLOADS_DIR;

  /**
   * Ensure uploads directory exists on startup
   */
  async onModuleInit(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      this.logger.log(`Local storage initialized at: ${this.baseDir}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize local storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Generate a unique filename to prevent collisions
   */
  private generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `${timestamp}-${random}${ext}`;
  }

  /**
   * Get the full path for a user's storage directory
   */
  private getUserDir(userId: string): string {
    return path.join(this.baseDir, userId);
  }

  /**
   * Store a file in local filesystem
   */
  async store(
    userId: string,
    file: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<StoredFile> {
    try {
      // Create user directory if it doesn't exist
      const userDir = this.getUserDir(userId);
      await fs.mkdir(userDir, { recursive: true });

      // Generate unique filename
      const filename = this.generateUniqueFilename(originalName);
      const filePath = path.join(userDir, filename);

      // Write file
      await fs.writeFile(filePath, file);

      // Store metadata alongside the file
      const metadata: StoredFile = {
        path: filePath,
        size: file.length,
        mimeType,
        originalName,
      };

      // Write metadata file
      const metadataPath = `${filePath}.meta.json`;
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      this.logger.debug(`Stored file: ${filePath} (${file.length} bytes)`);

      return metadata;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to store file: ${message}`);
      throw new ImportStorageException(`Failed to store file: ${message}`);
    }
  }

  /**
   * Read a file from local filesystem
   */
  async read(storagePath: string): Promise<Buffer> {
    try {
      const buffer = await fs.readFile(storagePath);
      return buffer;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to read file ${storagePath}: ${message}`);
      throw new ImportStorageException(`Failed to read file: ${message}`);
    }
  }

  /**
   * Delete a file from local filesystem
   */
  async delete(storagePath: string): Promise<void> {
    try {
      // Delete the file
      await fs.unlink(storagePath);

      // Delete metadata file if exists
      const metadataPath = `${storagePath}.meta.json`;
      try {
        await fs.unlink(metadataPath);
      } catch {
        // Metadata file may not exist, ignore
      }

      this.logger.debug(`Deleted file: ${storagePath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete file ${storagePath}: ${message}`);
      throw new ImportStorageException(`Failed to delete file: ${message}`);
    }
  }

  /**
   * Check if a file exists
   */
  async exists(storagePath: string): Promise<boolean> {
    try {
      await fs.access(storagePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getMetadata(storagePath: string): Promise<StoredFile | null> {
    try {
      const metadataPath = `${storagePath}.meta.json`;
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(metadataContent) as StoredFile;
    } catch {
      // If metadata file doesn't exist, try to reconstruct from file
      try {
        const stats = await fs.stat(storagePath);
        return {
          path: storagePath,
          size: stats.size,
          mimeType: 'application/octet-stream',
          originalName: path.basename(storagePath),
        };
      } catch {
        return null;
      }
    }
  }
}
