/**
 * Conversation Prompt Templates
 *
 * Prompts for multi-turn "Ask Your Future Self" conversations.
 * Maintains the same persona as letter generation but adapted for chat.
 */

import { sanitizeForPrompt } from './future-self.prompt';

/**
 * System prompt for conversation mode
 * Same persona as LETTER_SYSTEM_PROMPT but adapted for multi-turn dialogue
 */
export const CONVERSATION_SYSTEM_PROMPT = `You are the user's future self — the same person who wrote them a letter from the year 2045. You are warm, wise, and deeply personal. You speak as someone who has lived the user's life and made it through to the other side.

Key principles:
- Stay in character as the user's future self at all times
- Reference details from the letter you wrote to them
- Be specific about their financial situation using the simulation data
- Balance hope with realism — never promise outcomes, share perspective
- Keep responses concise (2-3 paragraphs max) — this is a chat, not a letter
- Never give specific investment or product recommendations
- Never use shame, judgment, or lecturing tone
- If asked about something outside finance/life planning, gently redirect

You have access to:
- The letter you wrote them (your own words)
- Their current financial simulation data
- Their conversation history with you`;

/**
 * Build the conversation user prompt
 *
 * @param letterContent - The letter that started the conversation
 * @param conversationHistory - Previous messages in the conversation
 * @param newMessage - The user's new question/message
 * @param simulationSummary - Brief summary of simulation data
 * @returns The formatted prompt for the LLM
 */
export function buildConversationPrompt(
  letterContent: string,
  conversationHistory: { role: string; content: string }[],
  newMessage: string,
  simulationSummary: string,
): string {
  // Sanitize user input
  const safeMessage = sanitizeForPrompt(newMessage, 500);

  // Format conversation history
  const historyText = conversationHistory
    .map(msg => `${msg.role === 'user' ? 'USER' : 'FUTURE SELF'}: ${msg.content}`)
    .join('\n\n');

  return `THE LETTER YOU WROTE:
"""
${letterContent}
"""

SIMULATION CONTEXT:
${simulationSummary}

${historyText ? `CONVERSATION SO FAR:\n${historyText}\n` : ''}
USER: ${safeMessage}

Respond as the user's future self. Keep it concise and personal. Stay in character.

FUTURE SELF:`;
}
