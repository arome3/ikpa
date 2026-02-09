'use client';

import { motion } from 'framer-motion';

export function TypingIndicator() {
  return (
    <div className="max-w-2xl mx-auto my-4">
      <div className="inline-flex items-center gap-2.5 px-5 py-3 rounded-lg bg-white border border-stone-200 shadow-sm">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-stone-400"
              animate={{ y: [0, -5, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
        <span className="text-xs uppercase tracking-wider text-stone-400">
          Analyst is writing
        </span>
      </div>
    </div>
  );
}
