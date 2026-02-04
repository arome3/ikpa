'use client';

import { useRouter } from 'next/navigation';
import { Wallet, PiggyBank, Clock, TrendingUp } from 'lucide-react';
import {
  DashboardHeader,
  CashFlowScoreGauge,
  MetricCard,
  QuickActions,
  RecentTransactions,
  AIInsightCard,
} from '@/components/dashboard';
import { useCashFlowScore, useFinancialSummary, useRecentTransactions } from '@/hooks';
import { mockAIInsight } from '@/lib/mock/dashboard.mock';

export default function DashboardPage() {
  const router = useRouter();

  // Fetch dashboard data
  const { data: scoreData, isLoading: scoreLoading } = useCashFlowScore();
  const { data: summaryData, isLoading: summaryLoading } = useFinancialSummary();
  const { data: transactions, isLoading: transactionsLoading } = useRecentTransactions({ limit: 5 });

  // Navigation handlers
  const handleAddExpense = () => router.push('/transactions/new?type=expense');
  const handleAddIncome = () => router.push('/transactions/new?type=income');
  const handleSetGoal = () => router.push('/goals/new');
  const handleAskAI = () => router.push('/ai');
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
        firstName="Chidi"
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
        <h2 id="metrics-heading" className="sr-only">Financial Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Total Saved"
            value={summaryData?.totalSaved ?? 0}
            change={summaryData?.totalSavedChange}
            format="currency"
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

      {/* Recent Transactions */}
      <section className="mt-6 mb-6" aria-labelledby="transactions-heading">
        <h2 id="transactions-heading" className="sr-only">Recent Transactions</h2>
        <RecentTransactions
          transactions={transactions}
          isLoading={transactionsLoading}
          limit={5}
        />
      </section>
    </div>
  );
}
