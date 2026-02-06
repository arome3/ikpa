'use client';

import { motion } from 'framer-motion';
import { Radar, CheckCircle2, Fish } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCurrencySymbol } from '@/lib/utils';
import type { AuditResult } from '@/hooks/useShark';

interface AuditTriggerCardProps {
  onTrigger: (force?: boolean) => void;
  isAuditing: boolean;
  lastResult?: AuditResult | null;
}

export function AuditTriggerCard({ onTrigger, isAuditing, lastResult }: AuditTriggerCardProps) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border backdrop-blur-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      {isAuditing ? (
        // Scanning state with sonar animation
        <div className="p-6 bg-gradient-to-br from-cyan-950/80 to-slate-900 border-cyan-500/20">
          <div className="flex flex-col items-center py-4">
            <div className="relative w-24 h-24 mb-4">
              {/* Sonar rings */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
                  initial={{ scale: 0.3, opacity: 0.8 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    delay: i * 0.6,
                    ease: 'easeOut',
                  }}
                />
              ))}
              {/* Center icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                >
                  <Radar className="w-10 h-10 text-cyan-400" />
                </motion.div>
              </div>
            </div>
            <p className="text-cyan-300 font-medium">Scanning your expenses...</p>
            <p className="text-sm text-slate-400 mt-1">Detecting recurring charges</p>
          </div>
        </div>
      ) : lastResult ? (
        // Results state
        <div className="p-6 bg-gradient-to-br from-teal-950/50 to-slate-900 border-teal-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-teal-500/20 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <p className="font-medium text-white">Scan Complete</p>
              <p className="text-xs text-slate-400">
                {new Date(lastResult.auditedAt).toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{lastResult.totalSubscriptions}</p>
              <p className="text-xs text-slate-400">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-cyan-300">{lastResult.newlyDetected}</p>
              <p className="text-xs text-slate-400">New</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">{lastResult.zombiesDetected}</p>
              <p className="text-xs text-slate-400">Zombies</p>
            </div>
          </div>

          {lastResult.potentialAnnualSavings > 0 && (
            <div className="px-4 py-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-center mb-4">
              <p className="text-xs text-teal-300/70">Potential savings</p>
              <p className="text-lg font-bold text-teal-300">
                {getCurrencySymbol(lastResult.currency)}
                {lastResult.potentialAnnualSavings.toLocaleString()}/yr
              </p>
            </div>
          )}

          <button
            onClick={() => onTrigger(true)}
            className="w-full px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm border border-white/10 transition-colors"
          >
            Scan Again
          </button>
        </div>
      ) : (
        // Default CTA state
        <div className="p-6 bg-gradient-to-br from-slate-800/80 to-slate-900 border-white/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-500/15 rounded-xl">
              <Fish className="w-7 h-7 text-cyan-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">Scan Your Expenses</p>
              <p className="text-sm text-slate-400 mt-0.5">
                Detect recurring charges and find zombie subscriptions
              </p>
            </div>
          </div>
          <button
            onClick={() => onTrigger()}
            className={cn(
              'w-full mt-4 px-4 py-3 rounded-xl font-semibold text-sm transition-all',
              'bg-gradient-to-r from-cyan-500 to-teal-500 text-white',
              'hover:from-cyan-400 hover:to-teal-400',
              'shadow-lg shadow-cyan-500/20'
            )}
          >
            Start Scan
          </button>
        </div>
      )}
    </motion.div>
  );
}
