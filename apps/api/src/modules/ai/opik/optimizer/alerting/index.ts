/**
 * Alerting Module Barrel Export
 *
 * Provides alerting capabilities for optimization experiment failures.
 *
 * @example
 * ```typescript
 * import { AlertService, AlertPayload } from './alerting';
 *
 * // Inject AlertService in your service
 * constructor(private readonly alertService: AlertService) {}
 *
 * // Send an optimization failure alert
 * await this.alertService.sendOptimizationFailure(
 *   experimentId,
 *   'FRAMING',
 *   error,
 * );
 * ```
 */

export * from './alert.types';
export * from './alert.service';
