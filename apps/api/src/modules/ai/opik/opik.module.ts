/**
 * Opik Module
 *
 * Provides distributed tracing for all AI agents in IKPA.
 *
 * The @Global() decorator makes OpikService available in all modules
 * without needing to import OpikModule in each feature module.
 * This follows the same pattern as PrismaModule.
 *
 * @example
 * ```typescript
 * // In app.module.ts
 * import { OpikModule } from './modules/ai/opik';
 *
 * @Module({
 *   imports: [OpikModule],
 * })
 * export class AppModule {}
 *
 * // In any service
 * import { OpikService } from './modules/ai/opik';
 *
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly opikService: OpikService) {}
 *
 *   async handleRequest(userId: string) {
 *     const trace = this.opikService.createAgentTrace({
 *       agentName: 'my_agent',
 *       userId,
 *       input: { action: 'process' },
 *     });
 *     // ... use trace
 *   }
 * }
 * ```
 *
 * @see OpikService for detailed API documentation
 */

import { Global, Module } from '@nestjs/common';
import { OpikService } from './opik.service';

@Global()
@Module({
  providers: [OpikService],
  exports: [OpikService],
})
export class OpikModule {}
