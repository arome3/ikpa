'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Copy, Check, Loader2, BookOpen } from 'lucide-react';
import type { CancellationGuide as CancellationGuideType } from '@/hooks/useShark';

interface CancellationGuideProps {
  subscriptionId: string;
  subscriptionName: string;
  fetchGuide: (id: string) => Promise<CancellationGuideType>;
}

export function CancellationGuide({
  subscriptionId,
  subscriptionName,
  fetchGuide,
}: CancellationGuideProps) {
  const [guide, setGuide] = useState<CancellationGuideType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchGuide(subscriptionId).then((g) => {
      if (!cancelled) {
        setGuide(g);
        setIsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [subscriptionId, fetchGuide]);

  const copySteps = async (index?: number) => {
    if (!guide) return;
    const text = index !== undefined
      ? guide.steps[index]
      : guide.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    await navigator.clipboard.writeText(text);
    setCopiedStep(index ?? -1);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  if (isLoading) {
    return (
      <motion.div
        className="mx-4 mb-4 p-4 rounded-lg bg-white border border-stone-200 shadow-sm"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 text-stone-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating cancellation guide for {subscriptionName}...
        </div>
      </motion.div>
    );
  }

  if (!guide) return null;

  return (
    <motion.div
      className="mx-4 mb-4 p-4 rounded-lg bg-white border border-stone-200 shadow-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-stone-500" />
          <h3 className="text-sm font-medium text-[#1A2E22]">
            How to cancel {guide.subscriptionName}
          </h3>
        </div>
        <span className="text-xs text-stone-400">{guide.estimatedTime}</span>
      </div>

      {/* Steps */}
      <ol className="space-y-2 mb-3">
        {guide.steps.map((step, i) => (
          <motion.li
            key={i}
            className="flex items-start gap-2 group"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#064E3B] text-white text-xs flex items-center justify-center mt-0.5 font-medium">
              {i + 1}
            </span>
            <span className="text-sm text-stone-700 flex-1">{step}</span>
            <button
              onClick={() => copySteps(i)}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
              title="Copy step"
            >
              {copiedStep === i ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-stone-400 hover:text-stone-600" />
              )}
            </button>
          </motion.li>
        ))}
      </ol>

      {/* Tips */}
      {guide.tips.length > 0 && (
        <div className="mb-3 p-2.5 rounded-lg bg-stone-50 border border-stone-200">
          <p className="text-xs font-medium text-stone-600 mb-1">Tips</p>
          <ul className="space-y-1">
            {guide.tips.map((tip, i) => (
              <li key={i} className="text-xs text-stone-500 flex items-start gap-1.5">
                <span className="text-stone-400 mt-0.5">-</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => copySteps()}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-600 hover:bg-stone-100 transition-colors"
        >
          {copiedStep === -1 ? (
            <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!</>
          ) : (
            <><Copy className="w-3.5 h-3.5" /> Copy all steps</>
          )}
        </button>
        {guide.directUrl && (
          <a
            href={guide.directUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#064E3B] text-xs text-white hover:bg-[#053D2E] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open {guide.subscriptionName}
          </a>
        )}
      </div>
    </motion.div>
  );
}
