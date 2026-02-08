'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { X, Clock, TrendingUp } from 'lucide-react';
import { useTimeMachine, TimeMachineFrequency } from '@/hooks/useTimeMachine';

interface TimeMachineCardProps {
  amount: number;
  currency?: string;
  onClose: () => void;
}

const frequencyOptions: { value: TimeMachineFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function formatCurrency(value: number, currency = 'NGN'): string {
  const symbol = currency === 'NGN' ? '\u20A6' : '$';
  if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${symbol}${(value / 1_000).toFixed(1)}K`;
  return `${symbol}${value.toLocaleString()}`;
}

export function TimeMachineCard({ amount, currency = 'NGN', onClose }: TimeMachineCardProps) {
  const [frequency, setFrequency] = useState<TimeMachineFrequency>('daily');
  const { calculate, result, isCalculating } = useTimeMachine();

  useEffect(() => {
    calculate({ amount, frequency });
  }, [amount, frequency]);

  const symbol = currency === 'NGN' ? '\u20A6' : '$';

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          <h3 className="font-semibold text-lg">What if you invested this instead?</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Frequency Selector */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          {frequencyOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFrequency(opt.value)}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${
                frequency === opt.value
                  ? 'bg-white dark:bg-slate-600 shadow text-violet-600 dark:text-violet-300'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          {symbol}{amount.toLocaleString()} {frequency} for 20 years
        </p>
      </div>

      {/* Chart */}
      <div className="px-2 pt-4">
        {isCalculating ? (
          <div className="h-52 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
          </div>
        ) : result ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={result.projections} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="spentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${v}yr`}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => formatCurrency(v, currency)}
                width={55}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                  name === 'spent' ? 'Total Spent' : 'If Invested',
                ]}
                labelFormatter={(v) => `Year ${v}`}
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  fontSize: '12px',
                }}
              />
              <Legend
                formatter={(val) => (val === 'spent' ? 'Cumulative Spending' : 'Investment Growth')}
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="spent"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#spentGrad)"
              />
              <Area
                type="monotone"
                dataKey="invested"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#investGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      {/* Bottom Stats */}
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-4 pb-4 pt-2"
        >
          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Opportunity Cost
              </span>
            </div>
            <motion.span
              key={result.difference}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-lg font-bold text-emerald-600 dark:text-emerald-400"
            >
              {symbol}{result.difference.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </motion.span>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Total spent: {symbol}{result.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <span>If invested: {symbol}{result.investedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
