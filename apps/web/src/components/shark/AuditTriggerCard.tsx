'use client';

import { motion } from 'framer-motion';
import { Radar, CheckCircle2 } from 'lucide-react';
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
      className="bg-white border border-stone-100 rounded-xl overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      {isAuditing ? (
        // Scanning state with sonar animation
        <div className="p-6">
          <div className="flex flex-col items-center py-4">
            <div className="relative w-24 h-24 mb-4">
              {/* Sonar rings */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-emerald-300/40"
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
                  <Radar className="w-10 h-10 text-[#064E3B]" />
                </motion.div>
              </div>
            </div>
            <p className="text-[#1A2E22] font-medium">Scanning your expenses...</p>
            <p className="text-sm text-stone-400 mt-1">Detecting recurring charges</p>
          </div>
        </div>
      ) : lastResult ? (
        // Results state
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="font-medium text-[#1A2E22]">Scan Complete</p>
              <p className="text-xs text-stone-400">
                {new Date(lastResult.auditedAt).toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-2xl font-serif text-[#1A2E22] tabular-nums">{lastResult.totalSubscriptions}</p>
              <p className="text-xs uppercase tracking-wider text-stone-400">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-serif text-[#064E3B] tabular-nums">{lastResult.newlyDetected}</p>
              <p className="text-xs uppercase tracking-wider text-stone-400">New</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-serif text-[#C2410C] tabular-nums">{lastResult.zombiesDetected}</p>
              <p className="text-xs uppercase tracking-wider text-stone-400">Zombies</p>
            </div>
          </div>

          {lastResult.potentialAnnualSavings > 0 && (
            <div className="px-4 py-2.5 rounded-lg bg-green-50 border border-green-100 text-center mb-4">
              <p className="text-xs uppercase tracking-wider text-emerald-800">Potential savings</p>
              <p className="text-lg font-mono font-bold text-[#064E3B] tabular-nums">
                {getCurrencySymbol(lastResult.currency)}
                {lastResult.potentialAnnualSavings.toLocaleString()}/yr
              </p>
            </div>
          )}

          <button
            onClick={() => onTrigger(true)}
            className="w-full rounded-full border border-stone-300 hover:border-stone-400 text-stone-700 px-4 py-2.5 text-sm font-medium transition-colors"
          >
            Scan Again
          </button>
        </div>
      ) : (
        // Default CTA state
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-stone-100 rounded-xl">
              <Radar className="w-7 h-7 text-[#064E3B]" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-[#1A2E22]">Scan Your Expenses</p>
              <p className="text-sm text-stone-400 mt-0.5">
                Detect recurring charges and find zombie subscriptions
              </p>
            </div>
          </div>
          <button
            onClick={() => onTrigger()}
            className="w-full mt-4 rounded-full bg-[#064E3B] hover:bg-[#053D2E] text-white px-4 py-3 text-sm font-medium transition-colors"
          >
            Start Scan
          </button>
        </div>
      )}
    </motion.div>
  );
}
