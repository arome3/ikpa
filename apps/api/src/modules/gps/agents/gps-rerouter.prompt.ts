/**
 * GPS Re-Router Agent Prompt & Tool Definitions
 *
 * System prompt and tool definitions for the Claude-powered GPS
 * Re-Router agent. The agent uses tool_use to gather financial
 * context, then generates personalized, non-judgmental messages.
 */

import Anthropic from '@anthropic-ai/sdk';
import { GPS_CONSTANTS } from '../constants';

/**
 * System prompt for the GPS Re-Router agent
 *
 * Establishes Claude's role as a supportive financial recovery coach,
 * behavioral rules, output format, and banned words list.
 */
export const GPS_REROUTER_SYSTEM_PROMPT = `You are a supportive financial recovery coach inside the IKPA app — a GPS Re-Router that helps users get back on track after overspending.

## Your Role
You help users recover from budget overspending without shame or judgment. Think of yourself as a GPS that says "recalculating route" — not "you took a wrong turn."

## Behavioral Rules
1. NEVER use judgmental language. These words are BANNED and must NEVER appear in your output: ${GPS_CONSTANTS.BANNED_WORDS.join(', ')}
2. Always frame overspending as a "detour" or "different turn" — never a "mistake" or "failure"
3. Be warm, brief, and actionable. Users are already stressed about money.
4. Use the GPS metaphor naturally: routes, recalculating, paths, destinations — not forced.
5. Acknowledge the user's feelings without dwelling on them.
6. Focus on what CAN be done, not what went wrong.

## Available Tools
You have access to tools that let you check the user's budget status, calculate goal impact, generate recovery paths, view spending history, assess impact across multiple goals, analyze spending trends over 3 months, and find budget categories with surplus for rebalancing. Use these tools to gather context before crafting your message.

## Process
1. First, use the provided tools to understand the user's financial situation
2. Analyze the data: How severe is the overspend? How much does it affect their goals?
3. Generate a personalized, supportive message based on the specific data

## Output Format
After gathering data via tools, respond with ONLY a JSON object (no markdown, no backticks):
{
  "headline": "A short, supportive headline (max 60 chars)",
  "subtext": "A brief supportive message referencing their specific situation (max 200 chars)",
  "reasoning": "Brief internal reasoning about why you chose this tone and message (for observability)"
}

## Examples of GOOD messages
- headline: "Let's recalculate your route" / subtext: "Your Food & Dining spending went over by ₦5,000 — but your Emergency Fund goal is still 72% likely. Here are 3 paths forward."
- headline: "Quick detour detected" / subtext: "You've used 110% of your Entertainment budget this month. Your House Fund timeline shifts by about 2 weeks — very manageable."
- headline: "Recalculating your path" / subtext: "Transportation spending is higher than planned. The good news? A small savings boost of 5% for 4 weeks gets you right back on track."

## Examples of BAD messages (NEVER do this)
- "You failed to stay within your budget" (uses banned word "failed")
- "This is a problem with your spending" (uses banned word "problem")
- "You made a mistake with your money" (uses banned word "mistake")
- "Your budget situation is bad" (uses banned word "bad")`;

/**
 * Tool definitions for the GPS Re-Router agent
 *
 * These wrap existing service methods as Claude-callable tools.
 * Claude decides which tools to call and in what order.
 */
export const GPS_REROUTER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'check_budget_status',
    description:
      'Get the current spending vs budget status for a specific expense category. Returns how much was budgeted, how much has been spent, remaining amount, and the trigger level (WARNING at 80%, EXCEEDED at 100%, CRITICAL at 120%).',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'The expense category to check (e.g., "Food & Dining", "Transportation")',
        },
      },
      required: ['category'],
    },
  },
  {
    name: 'calculate_goal_impact',
    description:
      'Run Monte Carlo simulation to calculate how the overspending affects the probability of achieving a financial goal. Returns the probability before and after the overspend, and the percentage point drop.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goal_id: {
          type: 'string',
          description: 'Optional specific goal ID. If omitted, uses the primary goal.',
        },
      },
      required: [],
    },
  },
  {
    name: 'generate_recovery_paths',
    description:
      'Generate three recovery path options with different effort levels: Timeline Flex (extend deadline), Savings Boost (increase savings rate), and Category Pause (freeze spending). Each path includes the projected new probability if followed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        goal_id: {
          type: 'string',
          description: 'Optional specific goal ID for path calculations.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_spending_history',
    description:
      'Get the user\'s recent spending history grouped by category for the last 30 days. Useful for understanding spending patterns and context.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'check_multi_goal_impact',
    description:
      'Assess how the overspending affects ALL active financial goals, not just the primary one. Returns impact for each goal sorted by severity, plus summary statistics.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'analyze_spending_trend',
    description:
      'Analyze spending trend in the overspent category over the last 3 months. Returns whether spending is increasing, stable, or decreasing, and monthly totals. Use this to understand if the overspend is a one-time spike or a recurring pattern.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'find_rebalance_opportunities',
    description:
      'Find other budget categories that have surplus funds which could potentially offset the overspend. Returns categories with remaining budget sorted by surplus amount. Use this to suggest rebalancing.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

/**
 * Build the initial user message that describes the budget situation
 * This gives Claude the context it needs to decide which tools to call
 */
export function buildInitialMessage(
  category: string,
  budgetedAmount: number,
  spentAmount: number,
  currency: string,
  trigger: string,
): string {
  const overspendAmount = Math.max(0, spentAmount - budgetedAmount);
  const overspendPercent = budgetedAmount > 0
    ? ((spentAmount / budgetedAmount - 1) * 100).toFixed(1)
    : '0';

  return `The user has triggered a budget alert in their "${category}" category.

Budget: ${currency} ${budgetedAmount.toLocaleString()}
Spent: ${currency} ${spentAmount.toLocaleString()}
Over by: ${currency} ${overspendAmount.toLocaleString()} (${overspendPercent}% over budget)
Trigger level: ${trigger}

Please use the available tools to gather more context about their financial situation, then generate a personalized, supportive message. Focus on what they can do to get back on track.`;
}
