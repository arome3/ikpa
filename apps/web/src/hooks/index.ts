// Animation hooks
export { useCountUp, formatWithSeparators } from './useCountUp';
export { useBlurReveal } from './useBlurReveal';
export { useScrollProgress, useHorizontalScrollProgress } from './useScrollProgress';

// Data fetching hooks
export { useCashFlowScore, useInvalidateCashFlowScore, cashFlowScoreKeys } from './useCashFlowScore';
export { useFinancialSummary, useInvalidateFinancialSummary, useRefreshSnapshot, financialSummaryKeys } from './useFinancialSummary';
export { useRecentTransactions, useInvalidateTransactions, transactionKeys } from './useRecentTransactions';

// Currency hook
export { useCurrency } from './useCurrency';

// Onboarding & Finance hooks
export { useOnboarding } from './useOnboarding';
export {
  useIncome,
  useSavings,
  useInvestments,
  useDebts,
  useGoals,
  useBudgets,
  useCategories,
} from './useFinance';
export type {
  Income,
  Savings,
  Investment,
  Debt,
  Goal,
  Budget,
  ExpenseCategory,
  CreateIncomeData,
  CreateSavingsData,
  CreateInvestmentData,
  CreateDebtData,
  CreateGoalData,
  CreateBudgetData,
} from './useFinance';

// Expenses hook
export { useExpenses } from './useExpenses';
export type { Expense, CreateExpenseData, ExpenseFilters } from './useExpenses';

// GPS Re-Router hooks
export { useGps } from './useGps';
export type {
  RecoveryPath,
  RecoveryResponse,
  RecoverySession,
  BudgetStatus,
  GoalImpact,
  WhatIfResponse,
  ActiveAdjustments,
  StreakStatus,
  Achievement,
} from './useGps';

// Notifications hook
export { useNotifications } from './useNotifications';
export type { GpsNotification } from './useNotifications';

// Import hook
export { useImport } from './useImport';
export type {
  ImportJobStatus,
  ParsedTransactionStatus,
  ImportSource,
  SupportedBank,
  UploadResponse,
  ImportJobSummary,
  ParsedTransaction,
  ImportJobDetails,
  ConfirmResponse,
} from './useImport';

// Shark Auditor hook
export { useShark } from './useShark';
export type {
  Subscription,
  SubscriptionCategory,
  SubscriptionStatus,
  SubscriptionSummary,
  SwipeAction,
  AuditResult,
  SharkFilters,
} from './useShark';

// Shark Chat hook
export { useSharkChat } from './useSharkChat';
export type { ChatMessage, ChatMeta, ChatPhase } from './useSharkChat';
