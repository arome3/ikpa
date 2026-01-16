/**
 * Opik Module Barrel Export
 *
 * Re-exports all public APIs for convenient importing:
 *
 * ```typescript
 * import {
 *   OpikModule,
 *   OpikService,
 *   CreateTraceInput,
 *   TrackedSpan,
 *   OpikException,
 * } from '@/modules/ai/opik';
 * ```
 *
 * Or with relative imports:
 * ```typescript
 * import { OpikModule, OpikService } from './modules/ai/opik';
 * ```
 */

// Module
export * from './opik.module';

// Service
export * from './opik.service';

// Interfaces
export * from './interfaces';

// Exceptions
export * from './exceptions';
