'use client';

import { motion } from 'framer-motion';
import { CategoryBadge } from '../CategoryBadge';
import { getCurrencySymbol } from '@/lib/utils';
import type { Subscription } from '@/hooks/useShark';

interface ChatSubscriptionHeaderProps {
  subscription: Subscription;
}

export function ChatSubscriptionHeader({
  subscription,
}: ChatSubscriptionHeaderProps) {
  const symbol = getCurrencySymbol(subscription.currency);
  const monthlyCost = Math.abs(subscription.monthlyCost);
  const annualCost = monthlyCost * 12;

  return (
    <motion.div
      className="w-full max-w-3xl mx-auto pt-8 pb-6 text-center"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <motion.h1
        className="text-4xl md:text-5xl font-serif text-[#1A2E22] tracking-tight"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {subscription.name}
      </motion.h1>

      <motion.p
        className="font-mono text-xl text-stone-500 mt-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {symbol}{monthlyCost.toLocaleString()}/mo
        <span className="text-sm text-stone-400 ml-2">
          ({symbol}{annualCost.toLocaleString()}/yr)
        </span>
      </motion.p>

      <motion.div
        className="flex justify-center mt-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <CategoryBadge category={subscription.category} size="sm" />
      </motion.div>
    </motion.div>
  );
}
