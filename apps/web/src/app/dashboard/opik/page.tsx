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
} from 'recharts';
import {
  Heart,
  Globe,
  Shield,
  Zap,
  TrendingUp,
  Activity,
  Loader2,
  FlaskConical,
  ChevronDown,
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

// ─── Icon mapping for metric names ────────────────────────────
const metricIcons: Record<string, typeof Activity> = {
  tone_empathy: Heart,
  cultural_sensitivity: Globe,
  financial_safety: Shield,
  actionability: Zap,
  engagement: TrendingUp,
};

// ─── Shared animation config ──────────────────────────────────
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

// ─── Recharts tooltip style (editorial) ───────────────────────
const tooltipStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #e7e5e4',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#1A2E22',
};

// ============================================================
// PAGE
// ============================================================
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
    <div className="min-h-screen bg-[#FDFCF8]">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-32">

        {/* ── Header: Lab Entry ───────────────────────────── */}
        <motion.header className="mb-10" {...fadeUp}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-serif text-4xl text-[#1A2E22]">
                AI Quality Assurance
              </h1>
              <p className="font-sans text-stone-500 mt-1">
                Real-time monitoring of agent reliability and safety.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 border border-green-200 text-green-700 text-xs px-3 py-1 rounded-full bg-green-50 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              All Systems Nominal
            </span>
          </div>
        </motion.header>

        {/* ── Lab Vitals Strip ────────────────────────────── */}
        <motion.section
          className="border-y border-stone-200 py-6 my-8"
          {...fadeUp}
          transition={{ delay: 0.05 }}
        >
          {dashLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-24 bg-stone-100 animate-pulse rounded" />
                  <div className="h-8 w-16 bg-stone-100 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <VitalStat
                label="Total Generations"
                value={String(dashboard?.overview?.totalTraces ?? 0)}
              />
              <VitalStat
                label="Mean Quality Score"
                value={`${((dashboard?.overview?.avgScore ?? 0) * 100).toFixed(0)}%`}
                mono
              />
              <VitalStat
                label="Active Experiments"
                value={String(dashboard?.overview?.activeExperiments ?? 0)}
              />
              <VitalStat
                label="Evaluations Completed"
                value={String(dashboard?.overview?.evaluationsRun ?? 0)}
              />
            </div>
          )}
        </motion.section>

        {/* ── Metric Spec Cards ───────────────────────────── */}
        <motion.section className="mb-10" {...fadeUp} transition={{ delay: 0.1 }}>
          <h2 className="font-serif text-2xl text-[#1A2E22] mb-5">
            Quality Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {metrics?.map((metric) => (
              <MetricSpecCard key={metric.name} metric={metric} />
            ))}
          </div>
        </motion.section>

        {/* ── Test Protocols (Eval Suites) ────────────────── */}
        <motion.section className="mb-10" {...fadeUp} transition={{ delay: 0.15 }}>
          <h2 className="font-serif text-2xl text-[#1A2E22] mb-5">
            Test Protocols
          </h2>
          <div className="space-y-4">
            <TestProtocolCard
              title="GPS Re-Router Eval"
              description="20 budget overspend scenarios — tests tone, safety, and recovery path quality"
              onRun={handleRunGpsEval}
              isRunning={gpsEval.isPending}
              result={gpsResult}
            />
            <TestProtocolCard
              title="Commitment Engine Eval"
              description="Tests commitment creation, verification, and debrief generation quality"
              onRun={handleRunCommitmentEval}
              isRunning={commitmentEval.isPending}
              result={commitmentResult}
            />
          </div>
        </motion.section>

        {/* ── Experiment Log ──────────────────────────────── */}
        <motion.section className="mb-10" {...fadeUp} transition={{ delay: 0.2 }}>
          <h2 className="font-serif text-2xl text-[#1A2E22] mb-5">
            Experiment Log
          </h2>
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_140px_100px_100px] gap-4 px-6 py-3 text-xs uppercase tracking-wider text-stone-400 font-sans border-b border-stone-200">
              <span>Name</span>
              <span>ID</span>
              <span>Status</span>
              <span>Action</span>
            </div>

            {experiments?.map((exp) => (
              <ExperimentRow
                key={exp.id}
                experiment={exp}
                isSelected={selectedExperimentId === exp.id}
                detail={selectedExperimentId === exp.id ? experimentDetail : undefined}
                onToggle={() =>
                  setSelectedExperimentId(
                    selectedExperimentId === exp.id ? null : exp.id,
                  )
                }
              />
            ))}

            {(!experiments || experiments.length === 0) && (
              <div className="text-center py-10 text-stone-400 font-sans text-sm">
                No experiments yet
              </div>
            )}
          </div>
        </motion.section>

        {/* ── Optimization History Chart ──────────────────── */}
        {optHistory && optHistory.length > 0 && (
          <motion.section className="mb-10" {...fadeUp} transition={{ delay: 0.25 }}>
            <h2 className="font-serif text-2xl text-[#1A2E22] mb-5">
              Prompt Optimization History
            </h2>
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={optHistory}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis
                    dataKey="generation"
                    tick={{ fontSize: 11, fill: '#a8a29e' }}
                    label={{
                      value: 'Generation',
                      position: 'insideBottom',
                      offset: -5,
                      style: { fontSize: 11, fill: '#a8a29e' },
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#a8a29e' }}
                    label={{
                      value: 'Fitness',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 11, fill: '#a8a29e' },
                    }}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="fitness"
                    stroke="#064E3B"
                    strokeWidth={2}
                    dot={{ fill: '#064E3B', r: 3 }}
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

// ============================================================
// COMPONENTS
// ============================================================

/** Single stat in the Lab Vitals strip */
function VitalStat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-stone-400 font-sans mb-1">
        {label}
      </p>
      <p
        className={cn(
          'text-3xl text-[#1A2E22]',
          mono ? 'font-mono text-[#064E3B]' : 'font-serif',
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Metric specification card — editorial style */
function MetricSpecCard({ metric }: { metric: { name: string; displayName: string; description: string; type: string; currentAvg: number; sampleSize: number } }) {
  const Icon = metricIcons[metric.name] || Activity;
  const score = metric.currentAvg;
  const hasScore = typeof score === 'number' && !isNaN(score);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <Icon className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
          <h3 className="font-semibold text-[#1A2E22]">
            {metric.displayName || metric.name}
          </h3>
        </div>
      </div>

      {hasScore ? (
        <p className="font-mono text-2xl text-[#064E3B] mb-2">
          {(score * 100).toFixed(0)}%
        </p>
      ) : (
        <div className="mb-2">
          <p className="text-sm italic text-stone-400">Calibrating...</p>
          <div className="mt-1.5 bg-stone-100 h-2 w-full rounded-full" />
        </div>
      )}

      <p className="text-sm text-stone-500 line-clamp-2 mb-3">
        {metric.description}
      </p>

      {hasScore && (
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-2">
          <motion.div
            className="h-full rounded-full bg-[#3F6212]"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(score * 100, 100)}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />
        </div>
      )}

      <p className="text-xs text-stone-400">
        {metric.sampleSize ?? 0} samples
      </p>
    </div>
  );
}

/** Test protocol card — replaces EvalSuiteCard */
function TestProtocolCard({
  title,
  description,
  onRun,
  isRunning,
  result,
}: {
  title: string;
  description: string;
  onRun: () => void;
  isRunning: boolean;
  result: EvalResult | null;
}) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h3 className="font-serif text-lg text-[#1A2E22]">{title}</h3>
          <p className="text-sm text-stone-500 mt-0.5">{description}</p>
        </div>
        <button
          onClick={onRun}
          disabled={isRunning}
          className={cn(
            'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
            isRunning
              ? 'border border-stone-300 text-stone-400 cursor-not-allowed'
              : 'border border-[#064E3B] text-[#064E3B] hover:bg-[#064E3B] hover:text-white',
          )}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Protocol...
            </>
          ) : (
            <>
              <FlaskConical className="w-4 h-4" />
              Initiate Protocol
            </>
          )}
        </button>
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 bg-white border border-stone-200 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-stone-600 font-sans">
              {result.passed}/{result.totalScenarios} passed
            </span>
            <span
              className={cn(
                'text-sm font-mono font-semibold',
                result.avgScore >= 0.7 ? 'text-[#3F6212]' : 'text-[#C2410C]',
              )}
            >
              {(result.avgScore * 100).toFixed(0)}% avg
            </span>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                result.avgScore >= 0.7 ? 'bg-[#3F6212]' : 'bg-[#C2410C]',
              )}
              style={{ width: `${result.avgScore * 100}%` }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}

/** Single row in the Experiment Log */
function ExperimentRow({
  experiment: exp,
  isSelected,
  detail,
  onToggle,
}: {
  experiment: { id: string; type: string; name: string; status: string };
  isSelected: boolean;
  detail?: { comparison?: { variantA: { label: string; scores: Record<string, number> }; variantB: { label: string; scores: Record<string, number> } } } | null;
  onToggle: () => void;
}) {
  const statusDot =
    exp.status === 'COMPLETED'
      ? 'bg-green-500'
      : exp.status === 'RUNNING'
        ? 'bg-amber-500'
        : 'bg-stone-300';

  return (
    <div className="border-b border-stone-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full text-left px-6 py-4 hover:bg-stone-50 transition-colors"
      >
        {/* Desktop row */}
        <div className="hidden md:grid grid-cols-[1fr_140px_100px_100px] gap-4 items-center">
          <span className="font-semibold text-[#1A2E22] text-sm">{exp.name}</span>
          <span className="font-mono text-sm text-stone-400 truncate">{exp.id.slice(0, 12)}</span>
          <span className="flex items-center gap-1.5 text-sm text-stone-600">
            <span className={cn('w-2 h-2 rounded-full', statusDot)} />
            {exp.status}
          </span>
          <span className="flex items-center gap-1 text-[#064E3B] text-sm hover:underline">
            View Results
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 transition-transform',
                isSelected && 'rotate-180',
              )}
            />
          </span>
        </div>

        {/* Mobile row */}
        <div className="md:hidden space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#1A2E22] text-sm">{exp.name}</span>
            <span className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className={cn('w-1.5 h-1.5 rounded-full', statusDot)} />
              {exp.status}
            </span>
          </div>
          <p className="font-mono text-xs text-stone-400">{exp.id.slice(0, 12)}</p>
        </div>
      </button>

      {/* Expanded detail: A/B chart */}
      {isSelected && detail?.comparison && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="px-6 pb-5"
        >
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
            <p className="text-sm font-sans text-stone-600 mb-3">A/B Test Results</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={Object.entries(detail.comparison.variantA.scores).map(
                  ([key, val]) => ({
                    metric: key,
                    [detail.comparison!.variantA.label]: val,
                    [detail.comparison!.variantB.label]:
                      detail.comparison!.variantB.scores[key] ?? 0,
                  }),
                )}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="metric" tick={{ fontSize: 10, fill: '#a8a29e' }} />
                <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  dataKey={detail.comparison.variantA.label}
                  fill="#064E3B"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey={detail.comparison.variantB.label}
                  fill="#a8a29e"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </div>
  );
}
