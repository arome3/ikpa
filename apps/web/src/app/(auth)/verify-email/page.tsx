'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, CheckCircle2, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const justRegistered = searchParams.get('registered') === 'true';
  const user = useAuthStore((s) => s.user);

  const [status, setStatus] = useState<'pending' | 'verifying' | 'verified' | 'error'>(
    token ? 'verifying' : 'pending',
  );
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  // Auto-verify if token provided
  useEffect(() => {
    if (!token) return;

    const verify = async () => {
      try {
        await apiClient.post('/auth/verify-email', { token });
        setStatus('verified');
      } catch (err: unknown) {
        setStatus('error');
        const apiErr = err as { data?: { error?: { message?: string } }; message?: string };
        setError(apiErr?.data?.error?.message || 'Verification link is invalid or expired');
      }
    };

    verify();
  }, [token]);

  const handleResend = async () => {
    if (!user?.email) return;
    setResendLoading(true);
    try {
      await apiClient.post('/auth/resend-verification', { email: user.email });
      setResendSent(true);
    } catch {
      setResendSent(true); // Show success anyway to prevent enumeration
    } finally {
      setResendLoading(false);
    }
  };

  // Verified state
  if (status === 'verified') {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-2xl p-10 sm:p-12 text-center">
          <div className="mb-8">
            <h2 className="font-serif text-2xl font-semibold text-gray-900 tracking-tight">Ikpa</h2>
            <p className="text-xs text-gray-400 mt-0.5">Arnen</p>
          </div>

          <div className="inline-flex p-5 rounded-2xl bg-[#064E3B]/10 mb-6">
            <CheckCircle2 className="w-10 h-10 text-[#064E3B]" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 tracking-tight mb-3">
            Email verified
          </h1>
          <p className="text-gray-500 mb-8">
            Your email has been verified successfully. You can now access all features.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 px-6 h-12 rounded-md font-semibold text-white bg-[#064E3B] hover:bg-[#053F30] transition-colors"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-2xl p-10 sm:p-12 text-center">
          <div className="mb-8">
            <h2 className="font-serif text-2xl font-semibold text-gray-900 tracking-tight">Ikpa</h2>
            <p className="text-xs text-gray-400 mt-0.5">Arnen</p>
          </div>

          <div className="inline-flex p-5 rounded-2xl bg-red-50 mb-6">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 tracking-tight mb-3">
            Verification failed
          </h1>
          <p className="text-gray-500 mb-8">{error}</p>
          <Link
            href="/signin"
            className="inline-flex items-center gap-2 text-[#064E3B] hover:underline font-medium transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  // Verifying state
  if (status === 'verifying') {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-2xl p-10 sm:p-12 text-center">
          <div className="mb-8">
            <h2 className="font-serif text-2xl font-semibold text-gray-900 tracking-tight">Ikpa</h2>
            <p className="text-xs text-gray-400 mt-0.5">Arnen</p>
          </div>

          <div className="w-10 h-10 border-2 border-[#064E3B]/30 border-t-[#064E3B] rounded-full animate-spin mx-auto mb-6" />
          <h1 className="font-serif text-2xl font-bold text-gray-900 tracking-tight mb-3">
            Verifying your email...
          </h1>
          <p className="text-gray-500">Please wait a moment</p>
        </div>
      </div>
    );
  }

  // Pending state (just registered, waiting for user to check email)
  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-2xl p-10 sm:p-12 text-center">
        <div className="mb-8">
          <h2 className="font-serif text-2xl font-semibold text-gray-900 tracking-tight">Ikpa</h2>
          <p className="text-xs text-gray-400 mt-0.5">Arnen</p>
        </div>

        <div className="inline-flex p-5 rounded-2xl bg-amber-50 mb-6">
          <Mail className="w-10 h-10 text-amber-600" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-gray-900 tracking-tight mb-3">
          {justRegistered ? 'Verify your email' : 'Email verification required'}
        </h1>
        <p className="text-gray-500 mb-2 leading-relaxed">
          {justRegistered
            ? 'We sent a verification link to your email. Click the link to activate your account.'
            : 'Please verify your email address to access all features.'}
        </p>
        {user?.email && <p className="text-gray-900 font-medium mb-8">{user.email}</p>}

        <div className="rounded-lg bg-gray-50 p-6 mb-6">
          <div className="space-y-3 text-sm text-gray-500 text-left">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#064E3B]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-[#064E3B]">1</span>
              </span>
              <p>Open your email inbox</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#064E3B]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-[#064E3B]">2</span>
              </span>
              <p>Find the email from Ikpa</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#064E3B]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-[#064E3B]">3</span>
              </span>
              <p>Click the verification link</p>
            </div>
          </div>
        </div>

        {/* Resend */}
        {resendSent ? (
          <p className="text-[#064E3B] text-sm">Verification email sent again. Check your inbox.</p>
        ) : (
          <button
            onClick={handleResend}
            disabled={resendLoading || !user?.email}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${resendLoading ? 'animate-spin' : ''}`} />
            Resend verification email
          </button>
        )}

        {/* Continue to dashboard */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip for now — continue to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-2xl p-10 sm:p-12 text-center">
            <div className="mb-8">
              <h2 className="font-serif text-2xl font-semibold text-gray-900 tracking-tight">
                Ikpa
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Arnen</p>
            </div>
            <div className="w-10 h-10 border-2 border-[#064E3B]/30 border-t-[#064E3B] rounded-full animate-spin mx-auto mb-6" />
            <p className="text-gray-500">Loading...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
