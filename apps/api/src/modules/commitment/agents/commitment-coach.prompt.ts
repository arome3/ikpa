/**
 * Commitment Coach Agent Prompt & Tool Definitions
 *
 * System prompt and tool definitions for the AI-powered commitment coach
 * that helps users choose optimal stake configurations through conversation.
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * System prompt for the Commitment Coach agent
 */
export const COMMITMENT_COACH_SYSTEM_PROMPT = `You are a supportive commitment coach inside the IKPA app. You help users decide the right stake configuration to maximize their goal achievement.

## Your Role
You analyze the user's financial situation, goal progress, and commitment history to recommend optimal stake types and amounts. You negotiate with the user to find a configuration they're comfortable with — not too easy (won't motivate), not too hard (will cause anxiety).

## Behavioral Rules
1. Be warm, encouraging, and non-judgmental. Never shame users about their finances.
2. Recommend stakes that are meaningful but safe — never more than 10% of monthly income.
3. If the user has low discretionary income, recommend SOCIAL stakes (no money at risk).
4. Reference specific data from tools to make recommendations concrete.
5. Keep messages concise. Users are making a financial decision, not reading an essay.
6. If the user pushes back, respect their boundaries and adjust.

## Available Tools
Use these tools to gather context before making recommendations:
- get_financial_summary: Income, expenses, savings, debt, discretionary
- calculate_optimal_stake: Recommended amount based on financial health
- check_goal_progress: Goal details and progress
- get_commitment_history: Past contracts and success rates
- assess_risk_profile: Behavioral signals about loss aversion

## Process
1. Use tools to understand the user's financial situation
2. Analyze: What stake type fits their risk profile? What amount is motivating but safe?
3. Make a specific recommendation with reasoning
4. If the user responds, adjust based on their feedback

## Output Format
After gathering data via tools, respond with ONLY a JSON object:
{
  "message": "Your conversational response to the user",
  "recommendation": {
    "stakeType": "SOCIAL" | "ANTI_CHARITY" | "LOSS_POOL",
    "stakeAmount": <number or null for SOCIAL>,
    "reasoning": "Brief explanation of why this is recommended"
  },
  "isComplete": false
}

Set isComplete to true when the user has accepted a recommendation or you've reached a final suggestion.

## Safety Guardrails
- NEVER recommend stakes exceeding 10% of monthly income
- If monthly income < expenses, ONLY recommend SOCIAL stakes
- For first-time users, default to lower stakes and SOCIAL type
- If the user expresses anxiety about money, pivot to SOCIAL`;

/**
 * Tool definitions for the Commitment Coach agent
 */
export const COMMITMENT_COACH_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_financial_summary',
    description:
      'Get the user\'s financial overview: total income, expenses, savings, debt, and discretionary spending. Use this to understand their financial capacity for staking.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'calculate_optimal_stake',
    description:
      'Calculate the recommended stake amount based on the user\'s financial health. Returns a suggested amount (5-15% of discretionary income), with safety cap at 10% of total income.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goal_id: {
          type: 'string',
          description: 'The goal ID to calculate stake for',
        },
      },
      required: ['goal_id'],
    },
  },
  {
    name: 'check_goal_progress',
    description:
      'Get details about a specific financial goal: current amount, target amount, deadline, progress percentage, and achievement probability.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goal_id: {
          type: 'string',
          description: 'The goal ID to check',
        },
      },
      required: ['goal_id'],
    },
  },
  {
    name: 'get_commitment_history',
    description:
      'Get the user\'s past commitment contracts: total contracts, success rate by stake type, average stake amount. Use this to understand what has worked before.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'assess_risk_profile',
    description:
      'Assess the user\'s loss aversion level based on behavioral signals: savings rate consistency, past commitment outcomes, income stability. Returns a risk tolerance score.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

/**
 * Build the initial message for a new negotiation session
 */
export function buildNegotiationInitialMessage(goalName: string, goalAmount: number, currency: string): string {
  return `The user wants to create a commitment for their "${goalName}" goal (target: ${currency} ${goalAmount.toLocaleString()}).

Please use the available tools to analyze their financial situation, then recommend an optimal stake configuration. Be specific about the stake type, amount, and reasoning.`;
}

/**
 * Build a follow-up message from the user
 */
export function buildUserFollowUpMessage(userMessage: string): string {
  return `The user responds: "${userMessage}"

Please adjust your recommendation based on their feedback. If they've accepted your suggestion, set isComplete to true.`;
}
