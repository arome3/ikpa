'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface QuickReplyBarProps {
  replies: string[];
  onSelect: (reply: string) => void;
  disabled?: boolean;
}

export function QuickReplyBar({ replies, onSelect, disabled }: QuickReplyBarProps) {
  if (replies.length === 0) return null;

  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto px-4 py-3"
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
          className="bg-white border border-stone-200 p-4 rounded-lg hover:border-[#064E3B] hover:shadow-md text-left group transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[#44403C]">{reply}</span>
            <ArrowRight className="w-4 h-4 text-stone-300 opacity-0 group-hover:opacity-100 group-hover:text-[#064E3B] transition-all -translate-x-1 group-hover:translate-x-0" />
          </div>
        </button>
      ))}
    </motion.div>
  );
}
