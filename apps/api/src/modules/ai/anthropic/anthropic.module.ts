/**
 * Anthropic Module
 *
 * Provides shared Claude API access for all AI modules in IKPA.
 *
 * The @Global() decorator makes AnthropicService available in all modules
 * without needing to import AnthropicModule in each feature module.
 * This follows the same pattern as OpikModule and PrismaModule.
 *
 * @example
 * ```typescript
 * // In app.module.ts
 * import { AnthropicModule } from './modules/ai/anthropic';
 *
 * @Module({
 *   imports: [AnthropicModule],
 * })
 * export class AppModule {}
 *
 * // In any service
 * import { AnthropicService } from './modules/ai/anthropic';
 *
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly anthropicService: AnthropicService) {}
 *
 *   async evaluate(text: string) {
 *     if (!this.anthropicService.isAvailable()) {
 *       return { score: 3, reason: 'AI service unavailable' };
 *     }
 *     const response = await this.anthropicService.generate(
 *       `Evaluate: ${text}`,
 *       500,
 *       'You are an evaluator'
 *     );
 *     return JSON.parse(response.content);
 *   }
 * }
 * ```
 *
 * @see AnthropicService for detailed API documentation
 */

import { Global, Module } from '@nestjs/common';
import { AnthropicService } from './anthropic.service';

@Global()
@Module({
  providers: [AnthropicService],
  exports: [AnthropicService],
})
export class AnthropicModule {}
