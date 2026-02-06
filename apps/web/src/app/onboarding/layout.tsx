'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-emerald-50/30 dark:from-neutral-950 dark:via-neutral-900 dark:to-emerald-950/20">
      {/* Ambient background patterns */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Geometric grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgb(16 185 129 / 0.3) 1px, transparent 1px),
              linear-gradient(to bottom, rgb(16 185 129 / 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Floating orbs */}
        <motion.div
          className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-amber-400/10 blur-3xl"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
        />
      </div>

      {/* Logo */}
      <header className="fixed top-0 left-0 right-0 z-50 p-6">
        <motion.a
          href="/"
          className="inline-flex items-center gap-2 text-xl font-display font-bold text-neutral-900 dark:text-white"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-emerald-500/25">
            I
          </span>
          <span>IKPA</span>
        </motion.a>
      </header>

      {/* Main content */}
      <main className="relative z-10 min-h-screen pt-24 pb-12 px-4 sm:px-6">
        {children}
      </main>
    </div>
  );
}
