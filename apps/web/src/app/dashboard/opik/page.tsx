'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import {
  Activity,
  Beaker,
  Brain,
  ChevronRight,
  Gauge,
  Play,
  TrendingUp,
  Zap,
  Shield,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useOpikDashboard,
  useOpikMetrics,
  useOpikExperiments,
  useOpikExperimentDetail,
  useRunGpsEval,
  useRunCommitmentEval,
  useOptimizationHistory,
  EvalResult,
} from '@/hooks/useOpikDashboard';

const metricIcons: Record<string, typeof Activity> = {
  tone_empathy: Brain,
  cultural_sensitivity: Shield,
  financial_safety: Shield,
  actionability: Zap,
  engagement: TrendingUp,
};

const metricColors = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];

export default function OpikDashboardPage() {
  const { data: dashboard, isLoading: dashLoading } = useOpikDashboard();
  const { data: metrics } = useOpikMetrics();
  const { data: experiments } = useOpikExperiments();
  const { data: optHistory } = useOptimizationHistory();
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const { data: experimentDetail } = useOpikExperimentDetail(selectedExperimentId);
  const gpsEval = useRunGpsEval();
  const commitmentEval = useRunCommitmentEval();
  const [gpsResult, setGpsResult] = useState<EvalResult | null>(null);
  const [commitmentResult, setCommitmentResult] = useState<EvalResult | null>(null);

  const handleRunGpsEval = async () => {
    const result = await gpsEval.mutateAsync();
    setGpsResult(result);
  };

  const handleRunCommitmentEval = async () => {
    const result = await commitmentEval.mutateAsync();
    setCommitmentResult(result);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-20 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-40 -left-20 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-6 safe-top pb-32">
        {/* Header */}
        <motion.header
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-violet-500/20 rounded-xl">
              <Gauge className="w-7 h-7 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Opik AI Observatory</h1>
              <p className="text-sm text-slate-400">
                Real-time AI quality metrics, experiments, and evaluation
              </p>
            </div>
          </div>
        </motion.header>

        {/* Hero Stats */}
        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {dashLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-white/5 animate-pulse rounded-2xl" />
              ))
            ) : (
              <>
                <StatCard
                  label="Total Traces"
                  value={dashboard?.overview?.totalTraces ?? 0}
                  icon={Activity}
                  color="violet"
                />
                <StatCard
                  label="Avg Score"
                  value={`${((dashboard?.overview?.avgScore ?? 0) * 100).toFixed(0)}%`}
                  icon={TrendingUp}
                  color="cyan"
                />
                <StatCard
                  label="Experiments"
                  value={dashboard?.overview?.activeExperiments ?? 0}
                  icon={Beaker}
                  color="amber"
                />
                <StatCard
                  label="Evals Run"
                  value={dashboard?.overview?.evaluationsRun ?? 0}
                  icon={Zap}
                  color="emerald"
                />
              </>
            )}
          </div>
        </motion.section>

        {/* Metrics Cards */}
        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-400" />
            AI Quality Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics?.map((metric, i) => {
              const Icon = metricIcons[metric.name] || Activity;
              const score = metric.currentAvg;
              return (
                <div
                  key={metric.name}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: metricColors[i % 5] + '20' }}
                      >
                        <Icon
                          className="w-4 h-4"
                          style={{ color: metricColors[i % 5] }}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{metric.displayName || metric.name}</p>
                        <p className="text-xs text-slate-500">{metric.type}</p>
                      </div>
                    </div>
                    <span
                      className="text-lg font-bold"
                      style={{ color: metricColors[i % 5] }}
                    >
                      {typeof score === 'number' ? `${(score * 100).toFixed(0)}%` : 'N/A'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{metric.description}</p>
                  <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: metricColors[i % 5] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((score || 0) * 100, 100)}%` }}
                      transition={{ delay: 0.3 + i * 0.1, duration: 0.8 }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{metric.sampleSize ?? 0} samples</p>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Live Eval Buttons */}
        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Play className="w-5 h-5 text-emerald-400" />
            Live Evaluation Suites
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EvalSuiteCard
              title="GPS Re-Router Eval"
              description="20 budget overspend scenarios — tests tone, safety, and recovery path quality"
              onRun={handleRunGpsEval}
              isRunning={gpsEval.isPending}
              result={gpsResult}
              color="cyan"
            />
            <EvalSuiteCard
              title="Commitment Engine Eval"
              description="Tests commitment creation, verification, and debrief generation quality"
              onRun={handleRunCommitmentEval}
              isRunning={commitmentEval.isPending}
              result={commitmentResult}
              color="violet"
            />
          </div>
        </motion.section>

        {/* Experiments Table */}
        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Beaker className="w-5 h-5 text-amber-400" />
            Experiments
          </h2>
          <div className="space-y-2">
            {experiments?.map((exp) => (
              <button
                key={exp.id}
                onClick={() =>
                  setSelectedExperimentId(
                    selectedExperimentId === exp.id ? null : exp.id,
                  )
                }
                className={cn(
                  'w-full p-4 rounded-xl border backdrop-blur-sm text-left transition-colors',
                  selectedExperimentId === exp.id
                    ? 'bg-violet-500/10 border-violet-500/30'
                    : 'bg-white/5 border-white/10 hover:bg-white/10',
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{exp.name}</p>
                    <p className="text-xs text-slate-400">
                      {exp.type} | {exp.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        exp.status === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : exp.status === 'RUNNING'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-500/20 text-slate-400',
                      )}
                    >
                      {exp.status}
                    </span>
                    <ChevronRight
                      className={cn(
                        'w-4 h-4 text-slate-400 transition-transform',
                        selectedExperimentId === exp.id && 'rotate-90',
                      )}
                    />
                  </div>
                </div>

                {/* Expanded detail */}
                {selectedExperimentId === exp.id && experimentDetail?.comparison && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-sm text-slate-300 mb-3">A/B Test Results</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart
                        data={Object.entries(
                          experimentDetail.comparison.variantA.scores,
                        ).map(([key, val]) => ({
                          metric: key,
                          [experimentDetail.comparison!.variantA.label]: val,
                          [experimentDetail.comparison!.variantB.label]:
                            experimentDetail.comparison!.variantB.scores[key] ?? 0,
                        }))}
                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="metric" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(15,23,42,0.95)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar
                          dataKey={experimentDetail.comparison.variantA.label}
                          fill="#8b5cf6"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey={experimentDetail.comparison.variantB.label}
                          fill="#06b6d4"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </button>
            ))}
            {(!experiments || experiments.length === 0) && (
              <div className="text-center py-8 text-slate-500">No experiments yet</div>
            )}
          </div>
        </motion.section>

        {/* Optimization History */}
        {optHistory && optHistory.length > 0 && (
          <motion.section
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Prompt Optimization History
            </h2>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={optHistory}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis
                    dataKey="generation"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    label={{ value: 'Generation', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#64748b' } }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    label={{ value: 'Fitness', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15,23,42,0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="fitness"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPONENTS
// ============================================

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: typeof Activity;
  color: string;
}) {
  const bgMap: Record<string, string> = {
    violet: 'from-violet-500/10 to-violet-600/5 border-violet-500/20',
    cyan: 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20',
    amber: 'from-amber-500/10 to-amber-600/5 border-amber-500/20',
    emerald: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
  };
  const iconMap: Record<string, string> = {
    violet: 'text-violet-400 bg-violet-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/20',
    amber: 'text-amber-400 bg-amber-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/20',
  };

  return (
    <div
      className={cn(
        'p-4 rounded-2xl bg-gradient-to-br border backdrop-blur-sm',
        bgMap[color],
      )}
    >
      <div className={cn('inline-flex p-2 rounded-lg mb-2', iconMap[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function EvalSuiteCard({
  title,
  description,
  onRun,
  isRunning,
  result,
  color,
}: {
  title: string;
  description: string;
  onRun: () => void;
  isRunning: boolean;
  result: EvalResult | null;
  color: string;
}) {
  const borderColor = color === 'cyan' ? 'border-cyan-500/20' : 'border-violet-500/20';
  const btnColor =
    color === 'cyan'
      ? 'from-cyan-500 to-cyan-600'
      : 'from-violet-500 to-violet-600';

  return (
    <div className={cn('p-5 rounded-2xl bg-white/5 border backdrop-blur-sm', borderColor)}>
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-slate-400 mb-4">{description}</p>

      <button
        onClick={onRun}
        disabled={isRunning}
        className={cn(
          'w-full py-3 rounded-xl font-medium text-white transition-all',
          `bg-gradient-to-r ${btnColor}`,
          'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
          'flex items-center justify-center gap-2',
        )}
      >
        {isRunning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Running...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Run Evaluation
          </>
        )}
      </button>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 rounded-xl bg-white/5"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300">
              {result.passed}/{result.totalScenarios} passed
            </span>
            <span
              className={cn(
                'text-sm font-bold',
                result.avgScore >= 0.7 ? 'text-emerald-400' : 'text-amber-400',
              )}
            >
              {(result.avgScore * 100).toFixed(0)}% avg
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                result.avgScore >= 0.7 ? 'bg-emerald-500' : 'bg-amber-500',
              )}
              style={{ width: `${result.avgScore * 100}%` }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
