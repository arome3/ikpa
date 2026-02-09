'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await apiClient.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: unknown) {
      // Always show success to prevent email enumeration
      setSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-2xl p-10 sm:p-12 text-center">
          {/* Logo */}
          <div className="mb-8">
            <h2 className="font-serif text-2xl font-semibold text-gray-900 tracking-tight">Ikpa</h2>
            <p className="text-xs text-gray-400 mt-0.5">Arnen</p>
          </div>

          <div className="inline-flex p-5 rounded-2xl bg-[#064E3B]/10 mb-6">
            <Mail className="w-10 h-10 text-[#064E3B]" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 tracking-tight mb-3">
            Check your email
          </h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            If an account exists for <span className="text-gray-900 font-medium">{email}</span>,
            we&apos;ve sent a password reset link. Check your inbox and spam folder.
          </p>
          <Link
            href="/signin"
            className="inline-flex items-center gap-2 text-[#064E3B] hover:underline font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-2xl p-10 sm:p-12">
        {/* Logo */}
        <div className="text-center mb-8">
          <h2 className="font-serif text-2xl font-semibold text-gray-900 tracking-tight">Ikpa</h2>
          <p className="text-xs text-gray-400 mt-0.5">Arnen</p>
        </div>

        {/* Back link */}
        <Link
          href="/signin"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>

        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-gray-900 tracking-tight mb-2">
            Reset password
          </h1>
          <p className="text-gray-500">Enter your email and we&apos;ll send you a reset link</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-md bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#064E3B] focus:ring-2 focus:ring-[#064E3B]/20 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full h-12 rounded-md font-semibold text-white bg-[#064E3B] hover:bg-[#053F30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Send reset link'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
