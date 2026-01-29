/**
 * Crossover Mutation Service
 *
 * Implements LLM-based genetic operators for evolutionary prompt optimization.
 * Uses Claude to intelligently combine and mutate prompts.
 *
 * Circuit Breaker Integration:
 * All LLM calls are wrapped with circuit breaker protection to prevent
 * cascade failures when the Anthropic API is slow or failing.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AnthropicService } from '../../../anthropic';
import { ICrossoverMutation, PromptIndividual } from '../interfaces';
import { EVOLUTION_MAX_TOKENS, EVOLUTION_EVALUATION_TIMEOUT_MS } from '../optimizer.constants';
import { CircuitBreakerService } from '../circuit-breaker';

/**
 * Prompt for crossover operation
 */
const CROSSOVER_PROMPT = `You are an expert prompt engineer. Combine the best elements of these two prompts to create an offspring prompt that:

1. Takes the most effective phrases and structures from both parents
2. Maintains coherence and readability
3. Preserves all template variables ({{name}}, {{age}}, etc.)
4. Creates something meaningfully different from either parent

PARENT 1:
{PARENT1}

PARENT 2:
{PARENT2}

Create the offspring prompt by combining the best elements. Return ONLY the new prompt, no explanations:`;

/**
 * Prompt for mutation operation
 */
const MUTATION_PROMPT = `You are an expert prompt engineer. Apply a small but meaningful mutation to this prompt:

1. Change the tone slightly (warmer, more direct, more encouraging)
2. Rephrase a key section
3. Adjust the structure
4. Add or remove emphasis

Keep all template variables ({{name}}, {{age}}, etc.) intact.

ORIGINAL PROMPT:
{PROMPT}

Apply a mutation and return ONLY the mutated prompt, no explanations:`;

/**
 * Prompt for generating initial variants
 */
const VARIANT_PROMPT = `You are an expert prompt engineer. Create a variant of this prompt that maintains the core message but:

1. Uses different phrasing and structure
2. May change the emotional tone
3. Could reorder sections
4. Keeps all template variables ({{name}}, {{age}}, etc.)

ORIGINAL PROMPT:
{PROMPT}

Create a meaningfully different variant. Return ONLY the variant prompt, no explanations:`;

@Injectable()
export class CrossoverMutationService implements ICrossoverMutation {
  private readonly logger = new Logger(CrossoverMutationService.name);

  constructor(
    private readonly anthropicService: AnthropicService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  /**
   * Generate offspring through crossover of two parents
   *
   * Uses LLM to intelligently combine elements from both parents,
   * creating a new prompt that inherits qualities from both.
   *
   * Circuit Breaker Fallback: Returns first parent unchanged
   */
  async crossover(
    parent1: PromptIndividual,
    parent2: PromptIndividual,
    generation: number,
  ): Promise<PromptIndividual> {
    let offspringPrompt: string;

    if (this.anthropicService.isAvailable()) {
      // Execute crossover with circuit breaker protection
      const result = await this.circuitBreaker.execute(
        'crossover',
        () => this.llmCrossover(parent1.prompt, parent2.prompt),
        () => parent1.prompt, // Fallback: return first parent unchanged
      );

      if (result.usedFallback) {
        this.logger.debug(
          `Crossover used fallback (circuit state: ${result.circuitState})`,
        );
      }

      offspringPrompt = result.data ?? this.simpleCrossover(parent1.prompt, parent2.prompt);
    } else {
      offspringPrompt = this.simpleCrossover(parent1.prompt, parent2.prompt);
    }

    return {
      id: randomUUID(),
      prompt: offspringPrompt,
      generation,
      fitness: 0,
      parentIds: [parent1.id, parent2.id],
      isElite: false,
    };
  }

  /**
   * Apply mutation to an individual
   *
   * Probabilistically mutates the prompt using LLM to make
   * small but meaningful changes.
   *
   * Circuit Breaker Fallback: Returns individual unchanged
   */
  async mutate(individual: PromptIndividual, mutationRate: number): Promise<PromptIndividual> {
    // Check if mutation should occur
    if (Math.random() > mutationRate) {
      return individual; // No mutation
    }

    let mutatedPrompt: string;

    if (this.anthropicService.isAvailable()) {
      // Execute mutation with circuit breaker protection
      const result = await this.circuitBreaker.execute(
        'mutation',
        () => this.llmMutate(individual.prompt),
        () => individual.prompt, // Fallback: return individual unchanged
      );

      if (result.usedFallback) {
        this.logger.debug(
          `Mutation used fallback (circuit state: ${result.circuitState})`,
        );
      }

      mutatedPrompt = result.data ?? this.simpleMutate(individual.prompt);
    } else {
      mutatedPrompt = this.simpleMutate(individual.prompt);
    }

    return {
      ...individual,
      id: randomUUID(), // New ID for mutated individual
      prompt: mutatedPrompt,
    };
  }

  /**
   * Generate a variant of the base prompt using LLM
   *
   * Circuit Breaker Fallback: Uses simple mutation
   */
  async generateVariant(basePrompt: string): Promise<string> {
    if (!this.anthropicService.isAvailable()) {
      return this.simpleMutate(basePrompt);
    }

    // Execute variant generation with circuit breaker protection
    const result = await this.circuitBreaker.execute(
      'variant_generation',
      async () => {
        const prompt = VARIANT_PROMPT.replace('{PROMPT}', basePrompt);
        const response = await this.anthropicService.generate(
          prompt,
          EVOLUTION_MAX_TOKENS,
          'You are a prompt engineering expert creating diverse variants.',
          EVOLUTION_EVALUATION_TIMEOUT_MS,
        );
        return response.content.trim();
      },
      () => this.simpleMutate(basePrompt), // Fallback: use simple mutation
    );

    if (result.usedFallback) {
      this.logger.debug(
        `Variant generation used fallback (circuit state: ${result.circuitState})`,
      );
    }

    return result.data ?? this.simpleMutate(basePrompt);
  }

  /**
   * Get circuit breaker health status for this service's operations
   */
  getCircuitBreakerStatus(): {
    crossover: string;
    mutation: string;
    variantGeneration: string;
  } {
    return {
      crossover: this.circuitBreaker.getState('crossover'),
      mutation: this.circuitBreaker.getState('mutation'),
      variantGeneration: this.circuitBreaker.getState('variant_generation'),
    };
  }

  /**
   * LLM-based crossover
   */
  private async llmCrossover(prompt1: string, prompt2: string): Promise<string> {
    const prompt = CROSSOVER_PROMPT.replace('{PARENT1}', prompt1).replace('{PARENT2}', prompt2);

    const response = await this.anthropicService.generate(
      prompt,
      EVOLUTION_MAX_TOKENS,
      'You are a prompt engineering expert combining prompts.',
      EVOLUTION_EVALUATION_TIMEOUT_MS,
    );

    return response.content.trim();
  }

  /**
   * LLM-based mutation
   */
  private async llmMutate(originalPrompt: string): Promise<string> {
    const prompt = MUTATION_PROMPT.replace('{PROMPT}', originalPrompt);

    const response = await this.anthropicService.generate(
      prompt,
      EVOLUTION_MAX_TOKENS,
      'You are a prompt engineering expert applying mutations.',
      EVOLUTION_EVALUATION_TIMEOUT_MS,
    );

    return response.content.trim();
  }

  /**
   * Simple crossover without LLM (fallback)
   *
   * Splits both prompts at sentence boundaries and combines
   * alternating sections from each parent.
   */
  private simpleCrossover(prompt1: string, prompt2: string): string {
    const sentences1 = this.splitIntoSentences(prompt1);
    const sentences2 = this.splitIntoSentences(prompt2);

    const result: string[] = [];
    const maxLength = Math.max(sentences1.length, sentences2.length);

    for (let i = 0; i < maxLength; i++) {
      // Alternate between parents
      if (i % 2 === 0 && i < sentences1.length) {
        result.push(sentences1[i]);
      } else if (i < sentences2.length) {
        result.push(sentences2[i]);
      }
    }

    return result.join(' ');
  }

  /**
   * Simple mutation without LLM (fallback)
   *
   * Applies random simple transformations to the prompt.
   */
  private simpleMutate(prompt: string): string {
    const mutations = [
      // Tone adjustments
      (p: string) =>
        p.replace(/remember/gi, 'always remember').replace(/think/gi, 'carefully consider'),
      (p: string) =>
        p.replace(/always /gi, '').replace(/carefully /gi, '').replace(/very /gi, ''),
      // Emphasis changes
      (p: string) => p.replace(/important/gi, 'crucial').replace(/good/gi, 'excellent'),
      (p: string) => p.replace(/crucial/gi, 'important').replace(/excellent/gi, 'good'),
      // Structure changes
      (p: string) => {
        const sentences = this.splitIntoSentences(p);
        if (sentences.length > 2) {
          // Swap two random sentences
          const i = Math.floor(Math.random() * sentences.length);
          const j = Math.floor(Math.random() * sentences.length);
          [sentences[i], sentences[j]] = [sentences[j], sentences[i]];
        }
        return sentences.join(' ');
      },
      // Formality changes
      (p: string) =>
        p.replace(/you're/gi, 'you are').replace(/don't/gi, 'do not').replace(/won't/gi, 'will not'),
      (p: string) =>
        p.replace(/you are/gi, "you're").replace(/do not/gi, "don't").replace(/will not/gi, "won't"),
    ];

    // Apply a random mutation
    const mutation = mutations[Math.floor(Math.random() * mutations.length)];
    return mutation(prompt);
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - splits on . ! ? followed by space or end
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
}
