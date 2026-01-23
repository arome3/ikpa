/**
 * Future Self Prompt Templates
 *
 * Prompt engineering for the Future Self Simulator.
 * Includes letter generation and tone evaluation prompts.
 *
 * SECURITY: All user inputs are sanitized before prompt interpolation
 * to prevent prompt injection attacks.
 */

import { UserContext, FutureSimulation } from '../interfaces';
import { FUTURE_AGE, MIN_SAVINGS_RATE_ON_TRACK } from '../constants';

// ==========================================
// PROMPT INJECTION PROTECTION
// ==========================================

/**
 * Maximum allowed length for user-provided text inputs
 */
const MAX_INPUT_LENGTH = 200;

/**
 * Patterns that indicate potential prompt injection attempts
 */
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+instructions?/i,
  /disregard\s+(previous|above|all)\s+instructions?/i,
  /forget\s+(previous|above|all)\s+instructions?/i,
  /new\s+instructions?:/i,
  /system\s*prompt/i,
  /you\s+are\s+now/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /act\s+as\s+(if|a)/i,
  /role\s*play/i,
  /\[\s*INST\s*\]/i,
  /<\s*\/?system\s*>/i,
  /```\s*(system|instruction)/i,
];

/**
 * Sanitize user input to prevent prompt injection attacks
 *
 * This function:
 * 1. Removes control characters
 * 2. Escapes triple quotes that could break prompt structure
 * 3. Detects and neutralizes injection patterns
 * 4. Truncates overly long inputs
 *
 * @param input - The raw user input
 * @param maxLength - Maximum allowed length (default: MAX_INPUT_LENGTH)
 * @returns Sanitized string safe for prompt interpolation
 */
export function sanitizeForPrompt(input: string, maxLength = MAX_INPUT_LENGTH): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Escape triple quotes that could break out of prompt strings
  sanitized = sanitized.replace(/"""/g, '"\\""\\""\\"');

  // Replace backticks that could create code blocks
  sanitized = sanitized.replace(/```/g, "'''");

  // Check for injection patterns and replace if found
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      // Replace the injection attempt with a safe placeholder
      sanitized = sanitized.replace(pattern, '[FILTERED]');
    }
  }

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }

  return sanitized.trim();
}

/**
 * Sanitize an array of strings for prompt interpolation
 */
export function sanitizeArrayForPrompt(items: string[] | undefined, maxLength = MAX_INPUT_LENGTH): string[] {
  if (!items || !Array.isArray(items)) {
    return [];
  }
  return items.map((item) => sanitizeForPrompt(item, maxLength));
}

/**
 * Format currency with proper locale formatting
 */
function formatCurrency(amount: number, currency: string): string {
  const currencySymbols: Record<string, string> = {
    NGN: '\u20A6',
    GHS: 'GH\u20B5',
    KES: 'KSh',
    ZAR: 'R',
    USD: '$',
    GBP: '\u00A3',
  };

  const symbol = currencySymbols[currency] || currency;
  return `${symbol}${amount.toLocaleString()}`;
}

/**
 * Build the letter generation prompt
 *
 * @param context - User context data
 * @param simulation - Dual-path simulation results
 * @returns The complete prompt for letter generation
 */
export function buildLetterPrompt(
  context: UserContext,
  simulation: FutureSimulation,
): string {
  // Sanitize all user-provided inputs to prevent prompt injection
  const safeName = sanitizeForPrompt(context.name, 50) || 'Friend';
  const safeCity = sanitizeForPrompt(context.city, 50) || 'your city';
  const safeStruggles = sanitizeArrayForPrompt(context.struggles, 100);
  const safeDecisions = sanitizeArrayForPrompt(context.recentDecisions, 100);

  const primaryGoal = context.goals[0];
  const safeGoalName = primaryGoal
    ? sanitizeForPrompt(primaryGoal.name, 100)
    : 'Financial Freedom';

  const futureYear = new Date().getFullYear() + (FUTURE_AGE - context.age);
  const isOnTrack = context.currentSavingsRate >= MIN_SAVINGS_RATE_ON_TRACK;
  const currency = context.currency || 'NGN';

  const currentPathFormatted = formatCurrency(
    simulation.currentBehavior.projectedNetWorth['20yr'],
    currency,
  );
  const optimizedPathFormatted = formatCurrency(
    simulation.withIKPA.projectedNetWorth['20yr'],
    currency,
  );
  const differenceFormatted = formatCurrency(simulation.difference_20yr, currency);
  const incomeFormatted = formatCurrency(context.monthlyIncome, currency);
  const netWorthFormatted = formatCurrency(context.currentNetWorth, currency);

  const goalAmount = primaryGoal
    ? formatCurrency(primaryGoal.amount, currency)
    : 'your target';

  return `You are writing as ${safeName}'s ${FUTURE_AGE}-year-old future self in the year ${futureYear}.

CURRENT USER DATA:
- Name: ${safeName}
- Current Age: ${context.age}
- City: ${safeCity}
- Current Savings Rate: ${Math.round(context.currentSavingsRate * 100)}%
- Monthly Income: ${incomeFormatted}
- Current Net Worth: ${netWorthFormatted}
- Primary Goal: ${safeGoalName}${primaryGoal ? ` (${goalAmount})` : ''}

SIMULATION RESULTS:
- Current Path Net Worth (20 years): ${currentPathFormatted}
- Optimized Path Net Worth (20 years): ${optimizedPathFormatted}
- Difference: ${differenceFormatted}

${safeStruggles.length ? `RECENT STRUGGLES: ${safeStruggles.join(', ')}` : ''}
${safeDecisions.length ? `RECENT DECISIONS: ${safeDecisions.join(', ')}` : ''}

INSTRUCTIONS:
Write a heartfelt, personal letter from their ${FUTURE_AGE}-year-old self.

${
  isOnTrack
    ? 'They are ON TRACK - celebrate their progress and encourage them to keep going.'
    : 'They are STRUGGLING - empathize with their challenges and provide hope.'
}

REQUIREMENTS:
1. Start with "Dear ${safeName},"
2. Reference their specific city (${safeCity})
3. Reference their specific goal (${safeGoalName})
4. Include ONE specific financial number from the simulation
5. Make it feel like a letter from someone who KNOWS them
6. End with warmth and hope
7. Sign as "${safeName} (Age ${FUTURE_AGE})"
8. Keep it under 250 words

AVOID:
- Generic advice
- Lecturing tone
- Shame or judgment
- Overly formal language
- Technical financial jargon

Write the letter now:`;
}

/**
 * Build the tone empathy evaluation prompt (G-Eval)
 *
 * Evaluates the generated letter for emotional resonance and empathy.
 * Uses a 1-5 scale based on G-Eval methodology.
 *
 * @param letter - The generated letter content
 * @returns The prompt for tone evaluation
 */
export function buildToneEvaluationPrompt(letter: string): string {
  // Sanitize the letter content (even though it's LLM-generated, be defensive)
  const safeLetter = sanitizeForPrompt(letter, 2000);

  return `You are evaluating the emotional quality of a "Letter from Future Self" - a letter written as if from someone's 60-year-old future self to their present self.

LETTER TO EVALUATE:
"""
${safeLetter}
"""

EVALUATION CRITERIA (ToneEmpathy):
Rate the letter on a scale of 1-5 based on these criteria:

1 (Poor): Generic, preachy, or lecture-like. Feels like advice from a stranger. Uses shame or judgment.

2 (Below Average): Somewhat personal but still feels formulaic. May have some specific details but lacks emotional depth.

3 (Average): Personal and warm, but could be more specific. References user's situation but doesn't feel deeply connected.

4 (Good): Warm, personal, and empathetic. References specific details from the user's life. Creates a sense of connection to their future self.

5 (Excellent): Deeply moving and personal. Creates genuine emotional resonance. Feels like it was truly written by someone who knows the recipient intimately. Balances hope with realism.

Respond with ONLY a JSON object in this exact format:
{
  "score": <number 1-5>,
  "reasoning": "<brief explanation of the score>"
}`;
}

/**
 * System prompt for letter generation
 */
export const LETTER_SYSTEM_PROMPT = `You are a creative writer specializing in personal, emotionally resonant letters. Your goal is to create a letter that makes the reader feel deeply connected to their future self.

Key principles:
- Use specific, concrete details from the user's life
- Balance hope with realism
- Avoid generic financial advice
- Write as if you ARE the future version of this person
- Keep the tone warm, personal, and conversational`;

/**
 * System prompt for tone evaluation
 */
export const TONE_EVAL_SYSTEM_PROMPT = `You are an expert evaluator of emotional writing quality. You evaluate letters for their ability to create genuine emotional connection and empathy. Always respond with valid JSON only.`;
