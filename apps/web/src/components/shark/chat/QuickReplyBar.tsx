'use client';

import { motion } from 'framer-motion';

interface QuickReplyBarProps {
  replies: string[];
  onSelect: (reply: string) => void;
  disabled?: boolean;
}

export function QuickReplyBar({ replies, onSelect, disabled }: QuickReplyBarProps) {
  if (replies.length === 0) return null;

  return (
    <motion.div
      className="flex flex-wrap gap-2 px-4 py-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      {replies.map((reply) => (
        <button
          key={reply}
          onClick={() => onSelect(reply)}
          disabled={disabled}
          className="px-3.5 py-2 text-sm rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reply}
        </button>
      ))}
    </motion.div>
  );
}
