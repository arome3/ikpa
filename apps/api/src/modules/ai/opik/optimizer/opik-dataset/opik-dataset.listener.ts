/**
 * Opik Dataset Event Listener
 *
 * Listens for dataset lifecycle events and syncs them to Opik.
 * Uses NestJS event emitter pattern to decouple from DatasetService.
 *
 * Events handled:
 * - dataset.created: Register new dataset with Opik
 * - dataset.updated: Sync updated dataset to Opik
 * - dataset.activated: Sync newly activated dataset
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OpikDatasetService } from './opik-dataset.service';
import {
  DATASET_EVENTS,
  DatasetCreatedEvent,
  DatasetUpdatedEvent,
  DatasetActivatedEvent,
} from './opik-dataset.events';

@Injectable()
export class OpikDatasetListener {
  private readonly logger = new Logger(OpikDatasetListener.name);

  constructor(private readonly opikDatasetService: OpikDatasetService) {}

  /**
   * Handle dataset created event
   *
   * Registers the new dataset with Opik for visibility in the dashboard.
   */
  @OnEvent(DATASET_EVENTS.CREATED)
  async handleDatasetCreated(event: DatasetCreatedEvent): Promise<void> {
    this.logger.debug(
      `[handleDatasetCreated] Dataset created: ${event.dataset.name} (type: ${event.dataset.type})`,
    );

    try {
      await this.opikDatasetService.onDatasetCreatedOrUpdated(event.dataset);
      this.logger.log(`Synced new dataset to Opik: ${event.dataset.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to sync new dataset ${event.dataset.name} to Opik: ${errorMessage}`,
      );
      // Don't throw - allow graceful degradation
    }
  }

  /**
   * Handle dataset updated event
   *
   * Re-syncs the dataset with Opik when data or metadata changes.
   */
  @OnEvent(DATASET_EVENTS.UPDATED)
  async handleDatasetUpdated(event: DatasetUpdatedEvent): Promise<void> {
    this.logger.debug(
      `[handleDatasetUpdated] Dataset updated: ${event.dataset.name} (v${event.dataset.version})`,
    );

    try {
      await this.opikDatasetService.onDatasetCreatedOrUpdated(event.dataset);
      this.logger.log(`Synced updated dataset to Opik: ${event.dataset.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to sync updated dataset ${event.dataset.name} to Opik: ${errorMessage}`,
      );
    }
  }

  /**
   * Handle dataset activated event
   *
   * Syncs the activated dataset to ensure it's available in Opik.
   */
  @OnEvent(DATASET_EVENTS.ACTIVATED)
  async handleDatasetActivated(event: DatasetActivatedEvent): Promise<void> {
    this.logger.debug(
      `[handleDatasetActivated] Dataset activated: ${event.dataset.name}`,
    );

    try {
      await this.opikDatasetService.onDatasetCreatedOrUpdated(event.dataset);
      this.logger.log(`Synced activated dataset to Opik: ${event.dataset.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to sync activated dataset ${event.dataset.name} to Opik: ${errorMessage}`,
      );
    }
  }
}
