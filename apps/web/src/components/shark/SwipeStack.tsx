'use client';

import { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { SwipeCard } from './SwipeCard';
import type { Subscription, SwipeAction } from '@/hooks/useShark';

interface SwipeStackProps {
  subscriptions: Subscription[];
  onSwipe: (subscriptionId: string, action: SwipeAction) => void;
  onComplete: () => void;
  isSwiping: boolean;
}

export function SwipeStack({ subscriptions, onSwipe, onComplete, isSwiping }: SwipeStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const visibleCards = subscriptions.slice(currentIndex, currentIndex + 3);

  const handleSwipe = useCallback(
    (action: SwipeAction) => {
      if (isSwiping) return;

      const current = subscriptions[currentIndex];
      if (!current) return;

      onSwipe(current.id, action);

      const nextIndex = currentIndex + 1;
      if (nextIndex >= subscriptions.length) {
        // Small delay to let exit animation play
        setTimeout(onComplete, 400);
      }
      setCurrentIndex(nextIndex);
    },
    [currentIndex, subscriptions, onSwipe, onComplete, isSwiping]
  );

  if (visibleCards.length === 0) return null;

  return (
    <div className="relative w-full" style={{ height: '420px' }}>
      <AnimatePresence>
        {visibleCards.map((sub, i) => (
          <SwipeCard
            key={sub.id}
            subscription={sub}
            onSwipe={handleSwipe}
            isActive={i === 0}
            stackIndex={i}
            isProcessing={isSwiping}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Expose a way to trigger swipe from external buttons */
SwipeStack.displayName = 'SwipeStack';
