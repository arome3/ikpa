'use client';

import { useState } from 'react';
import { Container, Button } from '@/components/ui';

const countries = [
  { value: 'ng', label: 'Nigeria' },
  { value: 'gh', label: 'Ghana' },
  { value: 'ke', label: 'Kenya' },
  { value: 'za', label: 'South Africa' },
  { value: 'other', label: 'Other' },
];

export function FinalCTA() {
  const [formData, setFormData] = useState({
    firstName: '',
    email: '',
    country: 'ng',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle waitlist signup
    console.log('Waitlist signup:', formData);
  };

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-primary-700 to-primary-800">
      <Container size="sm">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Your future self is waiting
          </h2>
          <p className="text-lg md:text-xl text-primary-200 max-w-2xl mx-auto">
            Every month you wait is a month of compounding clarity you miss. Join the waitlist. See
            where you&apos;re headed. Choose your path.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 max-w-md mx-auto"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-primary-100 mb-2">
                First name
              </label>
              <input
                type="text"
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-lg bg-white text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Your first name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-primary-100 mb-2">
                Email address
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-lg bg-white text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="country" className="block text-sm font-medium text-primary-100 mb-2">
                Country
              </label>
              <select
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white text-primary-900 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {countries.map((country) => (
                  <option key={country.value} value={country.value}>
                    {country.label}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" fullWidth size="lg" className="mt-2">
              Join the Waitlist →
            </Button>
          </div>

          <p className="text-xs text-primary-300 text-center mt-4">
            By joining, you agree to our{' '}
            <a href="/privacy" className="underline hover:text-white">
              Privacy Policy
            </a>
            . We only email you about Ikpa.
          </p>
        </form>

        {/* Referral Hook */}
        <p className="text-center text-primary-300 mt-8">
          Already on the list?{' '}
          <a href="#" className="text-accent hover:underline">
            Share your link to move up.
          </a>
        </p>
      </Container>
    </section>
  );
}
