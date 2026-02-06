'use client';

import { useRouter } from 'next/navigation';
import { Wallet, PiggyBank, Clock, TrendingUp, RefreshCw } from 'lucide-react';
import {
  DashboardHeader,
  CashFlowScoreGauge,
  MetricCard,
  type MetricCardProps,
  QuickActions,
  RecentTransactions,
  AIInsightCard,
} from '@/components/dashboard';
import { useCashFlowScore, useFinancialSummary, useRefreshSnapshot, useRecentTransactions, useCurrency, useShark } from '@/hooks';
import { useAuthStore } from '@/stores/auth.store';
import { mockAIInsight } from '@/lib/mock/dashboard.mock';
import { ZombieAlertBadge } from '@/components/shark';

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // Currency
  const { currency } = useCurrency();

  // Fetch dashboard data
  const { data: scoreData, isLoading: scoreLoading } = useCashFlowScore();
  const { data: summaryData, isLoading: summaryLoading } = useFinancialSummary();
  const { data: transactions, isLoading: transactionsLoading } = useRecentTransactions({ limit: 5 });
  const { summary: sharkSummary } = useShark({ limit: 1 });
  const { refresh: refreshSnapshot, isRefreshing } = useRefreshSnapshot();

  // Navigation handlers
  const handleAddExpense = () => router.push('/dashboard/expenses');
  const handleAddIncome = () => router.push('/dashboard/finance/income');
  const handleSetGoal = () => router.push('/dashboard/finance/goals');
  const handleAskAI = () => router.push('/dashboard/gps');
  const handleShark = () => router.push('/dashboard/shark');
  const handleImport = () => router.push('/dashboard/import');
  const handleNotifications = () => router.push('/notifications');
  const handleSettings = () => router.push('/settings');

  // AI insight handlers
  const handleInsightDismiss = (insightId: string) => {
    // TODO: Persist dismissal to backend
    console.log('Dismissed insight:', insightId);
  };

  const handleInsightAction = (_id: string, url: string) => {
    router.push(url);
  };

  return (
    <div className="max-w-lg mx-auto md:max-w-4xl px-4 safe-top">
      {/* Header */}
      <DashboardHeader
        firstName={user?.name?.split(' ')[0] ?? 'there'}
        hasNotifications={true}
        onNotificationsClick={handleNotifications}
        onSettingsClick={handleSettings}
      />

      {/* Cash Flow Score Gauge */}
      <section className="mt-2" aria-labelledby="score-heading">
        <h2 id="score-heading" className="sr-only">Cash Flow Score</h2>
        <CashFlowScoreGauge data={scoreData} isLoading={scoreLoading} />
      </section>

      {/* Metrics Grid */}
      <section className="mt-6" aria-labelledby="metrics-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="metrics-heading" className="text-sm font-medium text-muted-foreground">Financial Metrics</h2>
          <button
            onClick={refreshSnapshot}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            title="Refresh snapshot"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Total Saved"
            value={summaryData?.totalSaved ?? 0}
            change={summaryData?.totalSavedChange}
            format="currency"
            currency={currency as MetricCardProps['currency']}
            icon={PiggyBank}
            iconBgColor="bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
            isLoading={summaryLoading}
            delay={0}
            onClick={() => router.push('/savings')}
          />
          <MetricCard
            label="Savings Rate"
            value={summaryData?.savingsRate ?? 0}
            change={summaryData?.savingsRateChange}
            format="percent"
            icon={TrendingUp}
            iconBgColor="bg-secondary-100 text-secondary-600 dark:bg-secondary-900/30 dark:text-secondary-400"
            isLoading={summaryLoading}
            delay={0.05}
            onClick={() => router.push('/analytics')}
          />
          <MetricCard
            label="Runway"
            value={summaryData?.runway ?? 0}
            change={summaryData?.runwayChange}
            format="months"
            icon={Clock}
            iconBgColor="bg-info-100 text-info-600 dark:bg-info-900/30 dark:text-info-400"
            isLoading={summaryLoading}
            delay={0.1}
            onClick={() => router.push('/runway')}
          />
          <MetricCard
            label="Income"
            value={summaryData?.monthlyIncome ?? 0}
            change={summaryData?.monthlyIncomeChange}
            format="currency"
            currency={currency as MetricCardProps['currency']}
            icon={Wallet}
            iconBgColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
            isLoading={summaryLoading}
            delay={0.15}
            onClick={() => router.push('/income')}
          />
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mt-6" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="sr-only">Quick Actions</h2>
        <QuickActions
          onAddExpense={handleAddExpense}
          onAddIncome={handleAddIncome}
          onSetGoal={handleSetGoal}
          onAskAI={handleAskAI}
          onShark={handleShark}
          onImport={handleImport}
        />
      </section>

      {/* AI Insight */}
      <section className="mt-6" aria-labelledby="insight-heading">
        <h2 id="insight-heading" className="sr-only">AI Insights</h2>
        <AIInsightCard
          insight={mockAIInsight}
          onDismiss={handleInsightDismiss}
          onAction={handleInsightAction}
        />
      </section>

      {/* Zombie Alert */}
      {sharkSummary && sharkSummary.zombieCount > 0 && (
        <section className="mt-6" aria-labelledby="shark-heading">
          <h2 id="shark-heading" className="sr-only">Subscription Alerts</h2>
          <ZombieAlertBadge
            zombieCount={sharkSummary.zombieCount}
            potentialSavings={sharkSummary.potentialAnnualSavings}
            currency={sharkSummary.currency}
            onClick={() => router.push('/dashboard/shark')}
          />
        </section>
      )}

      {/* Recent Transactions */}
      <section className="mt-6 mb-6" aria-labelledby="transactions-heading">
        <h2 id="transactions-heading" className="sr-only">Recent Transactions</h2>
        <RecentTransactions
          transactions={transactions}
          isLoading={transactionsLoading}
          currency={currency as 'NGN' | 'USD' | 'GBP' | 'EUR' | 'GHS' | 'KES' | 'ZAR'}
          limit={5}
        />
      </section>
    </div>
  );
}
