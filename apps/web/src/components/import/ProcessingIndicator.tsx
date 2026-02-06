'use client';

import { motion } from 'framer-motion';
import { FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImportJobStatus } from '@/hooks/useImport';

interface ProcessingIndicatorProps {
  fileName?: string | null;
  status: ImportJobStatus;
  totalParsed?: number;
}

const statusText: Record<string, string> = {
  PENDING: 'Queued for processing...',
  PROCESSING: 'Parsing your transactions...',
};

export function ProcessingIndicator({ fileName, status, totalParsed }: ProcessingIndicatorProps) {
  return (
    <motion.div
      className={cn(
        'rounded-2xl p-8 text-center',
        'bg-slate-50 border border-slate-200',
        'dark:bg-white/5 dark:border-white/10',
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Animated icon */}
      <div className="relative inline-flex items-center justify-center mb-6">
        <motion.div
          className="absolute inset-0 rounded-full bg-primary-500/20 dark:bg-primary-400/15"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        />
        <motion.div
          className="relative w-20 h-20 rounded-2xl bg-primary-500/10 dark:bg-primary-400/10 flex items-center justify-center"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        >
          <FileText className="w-10 h-10 text-primary-500 dark:text-primary-400" />
        </motion.div>
      </div>

      {/* Spinner */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        >
          <Loader2 className="w-5 h-5 text-primary-500 dark:text-primary-400" />
        </motion.div>
        <p className="font-medium text-slate-700 dark:text-slate-200">
          {statusText[status] || 'Processing...'}
        </p>
      </div>

      {/* File name */}
      {fileName && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 truncate max-w-xs mx-auto">
          {fileName}
        </p>
      )}

      {/* Transaction count (during PROCESSING) */}
      {status === 'PROCESSING' && totalParsed != null && totalParsed > 0 && (
        <motion.p
          className="text-sm text-primary-600 dark:text-primary-400 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {totalParsed} transaction{totalParsed !== 1 ? 's' : ''} found so far
        </motion.p>
      )}

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 mt-5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              repeat: Infinity,
              duration: 1.2,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
