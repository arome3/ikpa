'use client';

import { useState } from 'react';
import { Container, Button } from '@/components/landing-ui';

export function FinalCTA() {
  const [formData, setFormData] = useState({
    email: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Waitlist signup:', formData);
    setIsSubmitted(true);
  };

  return (
    <section className="py-24 md:py-32 bg-neutral-950">
      <Container size="sm">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white mb-6">
            Your future self is waiting
          </h2>
          <p className="text-lg text-neutral-400 mb-10 max-w-xl mx-auto">
            92% of financial resolutions fail. Five AI agents. One mission: transform how you relate to money.
          </p>

          {isSubmitted ? (
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-8 max-w-md mx-auto">
              <p className="text-white font-medium mb-2">You're on the list.</p>
              <p className="text-neutral-400 text-sm">
                We'll let you know when Ikpa is ready.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
                />
                <Button type="submit" variant="secondary" size="lg">
                  Join Waitlist
                </Button>
              </div>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}
