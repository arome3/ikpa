/**
 * Mock data for dashboard development
 * Replace with real API calls in production
 */

export interface CashFlowScoreData {
  score: number;
  previousScore: number;
  status: 'THRIVING' | 'STABLE' | 'CAUTION' | 'STRESS' | 'CRISIS';
  lastUpdated: string;
}

export interface FinancialSummary {
  totalSaved: number;
  totalSavedChange: number;
  savingsRate: number;
  savingsRateChange: number;
  runway: number; // months
  runwayChange: number;
  monthlyIncome: number;
  monthlyIncomeChange: number;
  monthlyExpenses: number;
  monthlyExpensesChange: number;
  currency: string;
}

export type TransactionCategory =
  | 'food'
  | 'transport'
  | 'entertainment'
  | 'utilities'
  | 'shopping'
  | 'health'
  | 'education'
  | 'salary'
  | 'freelance'
  | 'gift'
  | 'investment'
  | 'other';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: TransactionCategory;
  date: string;
  merchant?: string;
}

export type AIInsightType = 'tip' | 'warning' | 'celebration' | 'suggestion';

export interface AIInsight {
  id: string;
  type: AIInsightType;
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  dismissible: boolean;
  createdAt: string;
}

// Category icon and color mapping
export const categoryConfig: Record<TransactionCategory, { icon: string; color: string }> = {
  food: { icon: 'UtensilsCrossed', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  transport: { icon: 'Car', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  entertainment: { icon: 'Gamepad2', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  utilities: { icon: 'Zap', color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' },
  shopping: { icon: 'ShoppingBag', color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400' },
  health: { icon: 'Heart', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  education: { icon: 'GraduationCap', color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
  salary: { icon: 'Briefcase', color: 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' },
  freelance: { icon: 'Laptop', color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' },
  gift: { icon: 'Gift', color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
  investment: { icon: 'TrendingUp', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
  other: { icon: 'MoreHorizontal', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

// Helper to get score status
export function getScoreStatus(score: number): CashFlowScoreData['status'] {
  if (score >= 80) return 'THRIVING';
  if (score >= 60) return 'STABLE';
  if (score >= 40) return 'CAUTION';
  if (score >= 20) return 'STRESS';
  return 'CRISIS';
}

// Status color mapping
export const statusColors: Record<CashFlowScoreData['status'], string> = {
  THRIVING: 'text-emerald-500',
  STABLE: 'text-emerald-400',
  CAUTION: 'text-amber-400',
  STRESS: 'text-orange-500',
  CRISIS: 'text-orange-500',
};

// Mock data generators
export const mockCashFlowScore: CashFlowScoreData = {
  score: 72,
  previousScore: 67,
  status: 'STABLE',
  lastUpdated: new Date().toISOString(),
};

export const mockFinancialSummary: FinancialSummary = {
  totalSaved: 485000,
  totalSavedChange: 12.5,
  savingsRate: 28,
  savingsRateChange: 3.2,
  runway: 4.2,
  runwayChange: 0.3,
  monthlyIncome: 650000,
  monthlyIncomeChange: 8.5,
  monthlyExpenses: 468000,
  monthlyExpensesChange: -2.1,
  currency: 'USD',
};

const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

export const mockTransactions: Transaction[] = [
  {
    id: '1',
    description: 'Salary Deposit',
    amount: 650000,
    type: 'income',
    category: 'salary',
    date: daysAgo(0),
    merchant: 'TechCorp Ltd',
  },
  {
    id: '2',
    description: 'Jumia Order',
    amount: 15500,
    type: 'expense',
    category: 'shopping',
    date: daysAgo(1),
    merchant: 'Jumia',
  },
  {
    id: '3',
    description: 'Uber Trip',
    amount: 3200,
    type: 'expense',
    category: 'transport',
    date: daysAgo(1),
    merchant: 'Uber',
  },
  {
    id: '4',
    description: 'Chicken Republic',
    amount: 4500,
    type: 'expense',
    category: 'food',
    date: daysAgo(2),
    merchant: 'Chicken Republic',
  },
  {
    id: '5',
    description: 'Freelance Payment',
    amount: 85000,
    type: 'income',
    category: 'freelance',
    date: daysAgo(3),
    merchant: 'Client - Fintech App',
  },
  {
    id: '6',
    description: 'Netflix Subscription',
    amount: 4900,
    type: 'expense',
    category: 'entertainment',
    date: daysAgo(4),
    merchant: 'Netflix',
  },
  {
    id: '7',
    description: 'Electricity Bill',
    amount: 18500,
    type: 'expense',
    category: 'utilities',
    date: daysAgo(5),
    merchant: 'IKEDC',
  },
];

export const mockAIInsight: AIInsight = {
  id: '1',
  type: 'tip',
  title: 'Great savings momentum!',
  message: 'You\'re on track to reach your emergency fund goal 2 weeks early. Consider increasing your goal or starting a new one.',
  actionLabel: 'View Goals',
  actionUrl: '/goals',
  dismissible: true,
  createdAt: new Date().toISOString(),
};

export const mockAIInsights: AIInsight[] = [
  mockAIInsight,
  {
    id: '2',
    type: 'warning',
    title: 'Unusual spending detected',
    message: 'Your shopping expenses are 40% higher than usual this month. Consider reviewing your recent purchases.',
    actionLabel: 'Review Spending',
    actionUrl: '/transactions?category=shopping',
    dismissible: true,
    createdAt: daysAgo(1),
  },
  {
    id: '3',
    type: 'celebration',
    title: 'Milestone achieved!',
    message: 'You\'ve saved 6 months of expenses! This is a major financial milestone. Keep up the amazing work!',
    dismissible: true,
    createdAt: daysAgo(2),
  },
  {
    id: '4',
    type: 'suggestion',
    title: 'Optimize your subscriptions',
    message: 'I found 3 subscriptions you rarely use. Canceling them could save you ₦12,400 monthly.',
    actionLabel: 'See Suggestions',
    actionUrl: '/ai?context=subscriptions',
    dismissible: true,
    createdAt: daysAgo(3),
  },
];

// Simulate API delay
export async function delay(ms: number = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mock API functions
export async function fetchCashFlowScore(): Promise<CashFlowScoreData> {
  await delay(400);
  return mockCashFlowScore;
}

export async function fetchFinancialSummary(): Promise<FinancialSummary> {
  await delay(300);
  return mockFinancialSummary;
}

export async function fetchRecentTransactions(limit: number = 5): Promise<Transaction[]> {
  await delay(350);
  return mockTransactions.slice(0, limit);
}

export async function fetchAIInsight(): Promise<AIInsight | null> {
  await delay(450);
  // Return the first non-dismissed insight
  return mockAIInsights[0] ?? null;
}
