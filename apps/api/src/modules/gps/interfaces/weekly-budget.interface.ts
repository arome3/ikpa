/**
 * Weekly Micro-Budget Interfaces
 */

export interface WeeklyBreakdown {
  categoryId: string;
  categoryName: string;
  monthlyBudget: number;
  totalSpent: number;
  currency: string;
  weeks: WeekBreakdown[];
  currentWeek: CurrentWeekInfo;
  adjustedWeeklyBudget: number;
}

export interface WeekBreakdown {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  allocated: number;
  spent: number;
  remaining: number;
  status: 'under' | 'on_track' | 'over';
}

export interface CurrentWeekInfo {
  weekNumber: number;
  dailyLimit: number;
  spentToday: number;
  daysRemaining: number;
}

export interface DailyLimit {
  categoryId: string;
  categoryName: string;
  dailyLimit: number;
  spentToday: number;
  remaining: number;
  daysRemaining: number;
  currency: string;
  status: 'under' | 'on_track' | 'over';
}
