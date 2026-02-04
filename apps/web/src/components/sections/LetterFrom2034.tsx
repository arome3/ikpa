'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/landing-ui';
import { PaperTexture } from '@/components/landing-ui/effects';
import { Pen, Heart } from 'lucide-react';

export function LetterFrom2034() {
  return (
    <section
      className="py-24 md:py-32"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <Container>
        <div className="max-w-3xl mx-auto">
          {/* Section intro */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-700 text-sm font-medium mb-4">
              <Pen className="w-4 h-4" />
              A message from the future
            </div>
          </motion.div>

          {/* Letter */}
          <motion.div
            initial={{ opacity: 0, y: 30, rotateX: 10 }}
            whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <PaperTexture
              variant="warm"
              showFolds={true}
              className="p-8 md:p-12"
            >
              {/* Letter content */}
              <div className="space-y-6">
                {/* Date */}
                <p
                  className="text-sm font-mono"
                  style={{ color: 'rgba(30, 58, 95, 0.6)' }}
                >
                  December 15, 2034
                </p>

                {/* Greeting */}
                <p
                  className="text-xl md:text-2xl font-serif italic"
                  style={{ color: '#1E3A5F' }}
                >
                  Dear Chidi,
                </p>

                {/* Body */}
                <div className="space-y-4 text-lg leading-relaxed" style={{ color: '#2D4A6F' }}>
                  <p>
                    I&apos;m writing this from 2034. I know you can&apos;t see it yet,
                    but that decision to start tracking your spending? It changed everything.
                  </p>

                  <p>
                    We own the apartment now. The one mama always dreamed about.
                    We bought it outright.
                  </p>

                  <p>
                    The small changes you&apos;re about to make—the ones that feel
                    invisible right now—they compound. Not just financially, but in
                    confidence. In options. In peace of mind.
                  </p>

                  <p className="font-medium" style={{ color: '#1E3A5F' }}>
                    Keep going.
                  </p>
                </div>

                {/* Signature */}
                <div className="pt-6">
                  <p
                    className="text-lg font-serif italic"
                    style={{ color: '#1E3A5F' }}
                  >
                    — You, 10 years from now
                  </p>
                </div>

                {/* Heart decoration */}
                <div className="flex justify-end">
                  <Heart
                    className="w-5 h-5"
                    style={{ color: 'rgba(245, 158, 11, 0.4)' }}
                    fill="rgba(245, 158, 11, 0.2)"
                  />
                </div>
              </div>
            </PaperTexture>
          </motion.div>

          {/* Caption below letter */}
          <motion.div
            className="text-center mt-8"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Your future self is rooting for you. Ikpa helps you become them.
            </p>
          </motion.div>

          {/* CTA */}
          <motion.div
            className="text-center mt-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <motion.button
              className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Write Your Own Story
            </motion.button>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
