/**
 * Opik Dataset Events
 *
 * Event definitions for dataset sync operations.
 * Uses NestJS event emitter pattern to decouple DatasetService
 * from OpikDatasetService (avoids circular dependencies).
 */

import { EvaluationDatasetEntity } from '../dataset';

/**
 * Event names for dataset operations
 */
export const DATASET_EVENTS = {
  CREATED: 'dataset.created',
  UPDATED: 'dataset.updated',
  ACTIVATED: 'dataset.activated',
  DEACTIVATED: 'dataset.deactivated',
} as const;

/**
 * Payload for dataset created event
 */
export class DatasetCreatedEvent {
  constructor(public readonly dataset: EvaluationDatasetEntity) {}
}

/**
 * Payload for dataset updated event
 */
export class DatasetUpdatedEvent {
  constructor(public readonly dataset: EvaluationDatasetEntity) {}
}

/**
 * Payload for dataset activated event
 */
export class DatasetActivatedEvent {
  constructor(public readonly dataset: EvaluationDatasetEntity) {}
}

/**
 * Payload for dataset deactivated event
 */
export class DatasetDeactivatedEvent {
  constructor(public readonly dataset: EvaluationDatasetEntity) {}
}
