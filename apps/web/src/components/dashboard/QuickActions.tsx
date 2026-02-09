'use client';

import { motion } from 'framer-motion';
import { MinusCircle, PlusCircle, Target, Navigation, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuickActionsProps {
  /** Additional class names */
  className?: string;
  /** Callback when Add Expense is clicked */
  onAddExpense?: () => void;
  /** Callback when Add Income is clicked */
  onAddIncome?: () => void;
  /** Callback when Set Goal is clicked */
  onSetGoal?: () => void;
  /** Callback when Ask AI is clicked */
  onAskAI?: () => void;
  /** Callback when Shark Auditor is clicked */
  onShark?: () => void;
  /** Callback when Import is clicked */
  onImport?: () => void;
  /** Callback when Future Self is clicked */
  onFutureSelf?: () => void;
  /** Callback when Commitments is clicked */
  onCommitments?: () => void;
}

const actions = [
  {
    id: 'expense',
    label: 'Add Expense',
    icon: MinusCircle,
    primary: true,
  },
  {
    id: 'income',
    label: 'Add Income',
    icon: PlusCircle,
    primary: false,
  },
  {
    id: 'goal',
    label: 'Set Goal',
    icon: Target,
    primary: false,
  },
  {
    id: 'ai',
    label: 'GPS',
    icon: Navigation,
    primary: false,
  },
  {
    id: 'import',
    label: 'Import',
    icon: Upload,
    primary: false,
  },
];

/**
 * Editorial quick action buttons — 5 visible, primary action filled
 */
export function QuickActions({ className, onAddExpense, onAddIncome, onSetGoal, onAskAI, onShark, onImport, onFutureSelf, onCommitments }: QuickActionsProps) {
  const handlers: Record<string, (() => void) | undefined> = {
    expense: onAddExpense,
    income: onAddIncome,
    goal: onSetGoal,
    ai: onAskAI,
    shark: onShark,
    import: onImport,
    futureSelf: onFutureSelf,
    commitments: onCommitments,
  };

  return (
    <motion.div
      className={cn(
        'flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4',
        'md:grid md:grid-cols-5 md:mx-0 md:px-0 md:overflow-visible',
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3, ease: 'easeOut' }}
    >
        {actions.map((action, index) => {
          const Icon = action.icon;
          const handler = handlers[action.id];

          return (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + index * 0.05, duration: 0.2 }}
              className="flex-shrink-0"
            >
              <button
                onClick={handler}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-2.5 rounded-full',
                  'text-sm font-sans whitespace-nowrap',
                  'transition-colors duration-150',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
                  action.primary
                    ? 'bg-emerald-900 text-white hover:bg-emerald-800'
                    : 'border border-stone-200 text-stone-600 hover:bg-stone-50',
                  'md:w-full'
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                {action.label}
              </button>
            </motion.div>
          );
        })}
    </motion.div>
  );
}
