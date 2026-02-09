import { Currency } from './user';

/**
 * Frequency for recurring items
 */
export enum Frequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
  ONE_TIME = 'ONE_TIME',
  IRREGULAR = 'IRREGULAR',
}

/**
 * Income source types
 */
export enum IncomeType {
  SALARY = 'SALARY',
  FREELANCE = 'FREELANCE',
  BUSINESS = 'BUSINESS',
  INVESTMENT = 'INVESTMENT',
  RENTAL = 'RENTAL',
  GIFT = 'GIFT',
  OTHER = 'OTHER',
}

/**
 * Income source
 */
export interface IncomeSource {
  id: string;
  userId: string;
  name: string;
  type: IncomeType;
  amount: number;
  currency: Currency;
  frequency: Frequency;
  isActive: boolean;
  description?: string;
  variancePercentage?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Expense category types
 */
export enum ExpenseCategoryType {
  FIXED = 'FIXED',
  VARIABLE = 'VARIABLE',
  DISCRETIONARY = 'DISCRETIONARY',
}

/**
 * Expense category
 */
export interface ExpenseCategory {
  id: string;
  name: string;
  type: ExpenseCategoryType;
  icon: string;
  color: string;
  isSystem: boolean;
}

/**
 * Expense
 */
export interface Expense {
  id: string;
  userId: string;
  categoryId: string;
  category?: ExpenseCategory;
  amount: number;
  currency: Currency;
  date: string;
  description?: string;
  isRecurring: boolean;
  frequency?: Frequency;
  merchant?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Savings account types
 */
export enum SavingsType {
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  MOBILE_MONEY = 'MOBILE_MONEY',
  CASH = 'CASH',
  FIXED_DEPOSIT = 'FIXED_DEPOSIT',
  OTHER = 'OTHER',
}

/**
 * Savings account
 */
export interface SavingsAccount {
  id: string;
  userId: string;
  name: string;
  type: SavingsType;
  balance: number;
  currency: Currency;
  contributionAmount?: number;
  contributionFrequency?: Frequency;
  nextContributionDate?: string;
  lastUpdated: string;
  createdAt: string;
}

/**
 * Investment types
 */
export enum InvestmentType {
  STOCKS = 'STOCKS',
  BONDS = 'BONDS',
  MUTUAL_FUND = 'MUTUAL_FUND',
  REAL_ESTATE = 'REAL_ESTATE',
  LAND = 'LAND',
  CRYPTO = 'CRYPTO',
  BUSINESS_STAKE = 'BUSINESS_STAKE',
  PENSION = 'PENSION',
  OTHER = 'OTHER',
}

/**
 * Investment
 */
export interface Investment {
  id: string;
  userId: string;
  name: string;
  type: InvestmentType;
  value: number;
  currency: Currency;
  acquisitionDate?: string;
  acquisitionCost?: number;
  notes?: string;
  lastUpdated: string;
  createdAt: string;
}

/**
 * Debt types
 */
export enum DebtType {
  BANK_LOAN = 'BANK_LOAN',
  CREDIT_CARD = 'CREDIT_CARD',
  MORTGAGE = 'MORTGAGE',
  CAR_LOAN = 'CAR_LOAN',
  PERSONAL_LOAN = 'PERSONAL_LOAN',
  BNPL = 'BNPL', // Buy Now Pay Later
  INFORMAL = 'INFORMAL', // Family/friends
  OTHER = 'OTHER',
}

/**
 * Debt
 */
export interface Debt {
  id: string;
  userId: string;
  name: string;
  type: DebtType;
  principal: number;
  interestRate: number;
  monthlyPayment: number;
  remainingBalance: number;
  currency: Currency;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Family relationship types
 */
export enum Relationship {
  PARENT = 'PARENT',
  SIBLING = 'SIBLING',
  CHILD = 'CHILD',
  SPOUSE = 'SPOUSE',
  EXTENDED_FAMILY = 'EXTENDED_FAMILY',
  FRIEND = 'FRIEND',
  OTHER = 'OTHER',
}

/**
 * Family support obligation
 */
export interface FamilySupport {
  id: string;
  userId: string;
  recipientName: string;
  relationship: Relationship;
  amount: number;
  currency: Currency;
  frequency: Frequency;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Goal status
 */
export enum GoalStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * Goal categories
 */
export enum GoalCategory {
  EMERGENCY_FUND = 'EMERGENCY_FUND',
  DEBT_PAYOFF = 'DEBT_PAYOFF',
  SAVINGS = 'SAVINGS',
  INVESTMENT = 'INVESTMENT',
  MAJOR_PURCHASE = 'MAJOR_PURCHASE',
  EDUCATION = 'EDUCATION',
  TRAVEL = 'TRAVEL',
  RETIREMENT = 'RETIREMENT',
  BUSINESS = 'BUSINESS',
  OTHER = 'OTHER',
}

/**
 * Financial goal
 */
export interface Goal {
  id: string;
  userId: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  currency: Currency;
  targetDate?: string;
  priority: number;
  status: GoalStatus;
  category: GoalCategory;
  createdAt: string;
  updatedAt: string;
}

/**
 * Financial snapshot - point-in-time metrics
 */
export interface FinancialSnapshot {
  id: string;
  userId: string;
  date: string;
  cashFlowScore: number; // 0-100
  savingsRate: number; // percentage
  runwayMonths: number;
  burnRate: number;
  dependencyRatio: number; // percentage of income supporting others
  netWorth: number;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  totalDebt: number;
  totalAssets: number;
  totalSupport: number;
  currency: Currency;
  createdAt: string;
}
