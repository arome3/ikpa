import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'EUR' | 'GHS' | 'KES' | 'ZAR';

export interface FinancialSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  cashFlowScore: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  category: string;
}

interface UserState {
  // Preferences
  currency: CurrencyCode;
  darkMode: boolean;

  // Financial data (cached for quick access)
  financialSummary: FinancialSummary | null;
  goals: Goal[];

  // UI state
  sidebarCollapsed: boolean;
  lastSync: string | null;
}

interface UserActions {
  setCurrency: (currency: CurrencyCode) => void;
  setDarkMode: (darkMode: boolean) => void;
  toggleDarkMode: () => void;
  setFinancialSummary: (summary: FinancialSummary) => void;
  setGoals: (goals: Goal[]) => void;
  updateGoal: (goalId: string, updates: Partial<Goal>) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setLastSync: (timestamp: string) => void;
  reset: () => void;
}

type UserStore = UserState & UserActions;

const initialState: UserState = {
  currency: 'NGN',
  darkMode: false,
  financialSummary: null,
  goals: [],
  sidebarCollapsed: false,
  lastSync: null,
};

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrency: (currency: CurrencyCode) => {
        set({ currency });
      },

      setDarkMode: (darkMode: boolean) => {
        set({ darkMode });
        // Apply to document for Tailwind dark mode
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', darkMode);
        }
      },

      toggleDarkMode: () => {
        const newDarkMode = !get().darkMode;
        get().setDarkMode(newDarkMode);
      },

      setFinancialSummary: (summary: FinancialSummary) => {
        set({ financialSummary: summary });
      },

      setGoals: (goals: Goal[]) => {
        set({ goals });
      },

      updateGoal: (goalId: string, updates: Partial<Goal>) => {
        set({
          goals: get().goals.map((goal) =>
            goal.id === goalId ? { ...goal, ...updates } : goal
          ),
        });
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set({ sidebarCollapsed: collapsed });
      },

      setLastSync: (timestamp: string) => {
        set({ lastSync: timestamp });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'ikpa-user',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currency: state.currency,
        darkMode: state.darkMode,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply dark mode on hydration
        if (state?.darkMode && typeof document !== 'undefined') {
          document.documentElement.classList.add('dark');
        }
      },
    }
  )
);

// Selectors
export const selectCurrency = (state: UserStore) => state.currency;
export const selectDarkMode = (state: UserStore) => state.darkMode;
export const selectFinancialSummary = (state: UserStore) => state.financialSummary;
export const selectGoals = (state: UserStore) => state.goals;
