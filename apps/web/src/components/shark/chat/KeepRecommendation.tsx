'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Loader2, Lightbulb, TrendingDown } from 'lucide-react';
import type { KeepRecommendation as KeepRecommendationType } from '@/hooks/useShark';

interface KeepRecommendationProps {
  subscriptionId: string;
  subscriptionName: string;
  fetchRecommendation: (id: string) => Promise<KeepRecommendationType>;
}

export function KeepRecommendation({
  subscriptionId,
  subscriptionName,
  fetchRecommendation,
}: KeepRecommendationProps) {
  const [recommendation, setRecommendation] = useState<KeepRecommendationType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchRecommendation(subscriptionId)
      .then((r) => {
        if (!cancelled) {
          setRecommendation(r);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subscriptionId, fetchRecommendation]);

  if (isLoading) {
    return (
      <motion.div
        className="mx-4 mb-4 p-4 rounded-lg bg-white border border-stone-200 shadow-sm"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 text-stone-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Finding ways to save on {subscriptionName}...
        </div>
      </motion.div>
    );
  }

  if (!recommendation) return null;

  return (
    <motion.div
      className="mx-4 mb-4 p-4 rounded-lg bg-white border border-stone-200 shadow-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-stone-500" />
        <h3 className="text-sm font-medium text-[#1A2E22]">
          Smart tips for {recommendation.subscriptionName}
        </h3>
      </div>

      {/* Tips */}
      <ol className="space-y-3 mb-3">
        {recommendation.tips.map((tip, i) => (
          <motion.li
            key={i}
            className="flex items-start gap-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#064E3B] text-white text-xs flex items-center justify-center mt-0.5 font-medium">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1A2E22]">{tip.title}</p>
              <p className="text-xs text-stone-500 mt-0.5">{tip.description}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {tip.estimatedSavings && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-[#064E3B]">
                    <TrendingDown className="w-3 h-3" />
                    {tip.estimatedSavings}
                  </span>
                )}
                {tip.actionUrl && (
                  <a
                    href={tip.actionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#064E3B] hover:text-[#053D2E] transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View plans
                  </a>
                )}
              </div>
            </div>
          </motion.li>
        ))}
      </ol>

      {/* Summary */}
      {recommendation.summary && (
        <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
          <p className="text-xs text-stone-600">{recommendation.summary}</p>
        </div>
      )}
    </motion.div>
  );
}
