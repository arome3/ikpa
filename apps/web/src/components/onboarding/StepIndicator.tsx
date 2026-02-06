'use client';

import { motion } from 'framer-motion';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnboardingStep } from '@/hooks/useOnboarding';

interface StepIndicatorProps {
  steps: OnboardingStep[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
}

export function StepIndicator({ steps, currentStepIndex, onStepClick }: StepIndicatorProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Mobile: Progress bar */}
      <div className="sm:hidden mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {Math.round(((currentStepIndex + 1) / steps.length) * 100)}%
          </span>
        </div>
        <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          {steps[currentStepIndex]?.name}
        </p>
      </div>

      {/* Desktop: Step circles */}
      <div className="hidden sm:flex items-center justify-between relative">
        {/* Connection line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-neutral-200 dark:bg-neutral-800" />
        <motion.div
          className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-emerald-500 to-emerald-400"
          initial={{ width: 0 }}
          animate={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />

        {steps.map((step, index) => {
          const isCompleted = step.status === 'completed' || step.status === 'skipped';
          const isCurrent = index === currentStepIndex;
          const isPast = index < currentStepIndex;
          const isClickable = onStepClick && (isPast || isCompleted);

          return (
            <motion.button
              key={step.id}
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
              className={cn(
                'relative z-10 flex flex-col items-center gap-2 group',
                isClickable && 'cursor-pointer',
                !isClickable && 'cursor-default'
              )}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
            >
              {/* Step circle */}
              <motion.div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300',
                  isCompleted && 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
                  isCurrent && 'bg-white dark:bg-neutral-900 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/20',
                  !isCompleted && !isCurrent && 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600'
                )}
                whileHover={isClickable ? { scale: 1.1 } : {}}
                whileTap={isClickable ? { scale: 0.95 } : {}}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : isCurrent ? (
                  <motion.div
                    className="w-3 h-3 rounded-full bg-emerald-500"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </motion.div>

              {/* Step label */}
              <span
                className={cn(
                  'text-xs font-medium max-w-[80px] text-center leading-tight transition-colors',
                  isCurrent && 'text-emerald-600 dark:text-emerald-400',
                  isCompleted && 'text-neutral-600 dark:text-neutral-400',
                  !isCompleted && !isCurrent && 'text-neutral-400 dark:text-neutral-600'
                )}
              >
                {step.name}
              </span>

              {/* Optional badge */}
              {!step.required && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-500 rounded-full">
                  Optional
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
