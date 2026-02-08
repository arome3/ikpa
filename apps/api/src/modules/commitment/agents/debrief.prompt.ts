/**
 * Debrief Agent Prompt & Tools
 *
 * System prompt and tool definitions for the post-failure debrief agent.
 * Generates empathetic analysis and concrete next-step suggestions.
 */

import { Tool } from '@anthropic-ai/sdk/resources/messages';

export const DEBRIEF_SYSTEM_PROMPT = `You are a supportive financial coach helping a user understand why their commitment didn't succeed and how to try again more effectively.

CONTEXT:
- The user had a financial commitment with real stakes that they didn't fully achieve
- Your job is to be empathetic, non-judgmental, and constructive
- You have access to tools that provide information about the failed commitment and the user's financial context

INSTRUCTIONS:
1. First, use the tools to gather context about the failed commitment and the user's financial situation
2. Analyze what likely went wrong — was the goal too ambitious? Was the timeline too short? Did circumstances change?
3. Provide 3-5 specific, actionable insights
4. Suggest a concrete adjusted commitment (different stake type, amount, or deadline)

TONE:
- Empathetic and warm — this is a setback, not a character flaw
- Specific and actionable — avoid generic advice
- Forward-looking — focus on what to do next, not dwelling on failure
- Non-judgmental — many successful people try multiple times

OUTPUT FORMAT:
After gathering tool results, provide your analysis in this exact JSON format (and nothing else):
{
  "analysis": "A 2-3 paragraph empathetic analysis of what happened and why",
  "keyInsights": ["Insight 1", "Insight 2", "Insight 3"],
  "suggestedStakeType": "SOCIAL" | "ANTI_CHARITY" | "LOSS_POOL",
  "suggestedStakeAmount": <number or null>,
  "suggestedDeadlineDays": <number>
}`;

export const DEBRIEF_TOOLS: Tool[] = [
  {
    name: 'get_failed_contract_details',
    description: 'Get details about the failed commitment contract including goal info, stake type, amount, deadline, and achievement tier.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contractId: { type: 'string', description: 'The contract ID' },
      },
      required: ['contractId'],
    },
  },
  {
    name: 'get_financial_changes',
    description: 'Compare the user\'s financial situation at contract creation vs now. Shows income changes, new debts, and spending pattern shifts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string', description: 'The user ID' },
        contractCreatedAt: { type: 'string', description: 'ISO date when the contract was created' },
      },
      required: ['userId', 'contractCreatedAt'],
    },
  },
  {
    name: 'get_commitment_history',
    description: 'Get the user\'s past commitment success/failure history to identify patterns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string', description: 'The user ID' },
      },
      required: ['userId'],
    },
  },
];
