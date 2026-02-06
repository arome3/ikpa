'use client';

import { motion } from 'framer-motion';
import { MinusCircle, PlusCircle, Target, Sparkles, Fish, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

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
}

const actions = [
  {
    id: 'expense',
    label: 'Add Expense',
    icon: MinusCircle,
    variant: 'secondary' as const,
  },
  {
    id: 'income',
    label: 'Add Income',
    icon: PlusCircle,
    variant: 'secondary' as const,
  },
  {
    id: 'goal',
    label: 'Set Goal',
    icon: Target,
    variant: 'secondary' as const,
  },
  {
    id: 'ai',
    label: 'Ask AI',
    icon: Sparkles,
    variant: 'ghost' as const,
  },
  {
    id: 'shark',
    label: 'Shark',
    icon: Fish,
    variant: 'ghost' as const,
  },
  {
    id: 'import',
    label: 'Import',
    icon: Upload,
    variant: 'secondary' as const,
  },
];

/**
 * Row of quick action buttons for common dashboard tasks
 */
export function QuickActions({ className, onAddExpense, onAddIncome, onSetGoal, onAskAI, onShark, onImport }: QuickActionsProps) {
  const handlers: Record<string, (() => void) | undefined> = {
    expense: onAddExpense,
    income: onAddIncome,
    goal: onSetGoal,
    ai: onAskAI,
    shark: onShark,
    import: onImport,
  };

  return (
    <motion.div
      className={cn(
        // Mobile: horizontal scroll
        'flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4',
        // Desktop: grid layout
        'md:grid md:grid-cols-3 lg:grid-cols-6 md:mx-0 md:px-0 md:overflow-visible',
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
              <Button
                variant={action.variant}
                size="md"
                onClick={handler}
                leftIcon={<Icon className="h-5 w-5" />}
                className={cn(
                  'whitespace-nowrap',
                  // Make all buttons consistent width on desktop
                  'md:w-full md:justify-center'
                )}
              >
                {action.label}
              </Button>
            </motion.div>
          );
        })}
    </motion.div>
  );
}
