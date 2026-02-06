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
    token ? 'verifying' : 'pending'
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
      <div className="w-full max-w-[420px] text-center">
        <div className="inline-flex p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-3">Email verified</h1>
        <p className="text-slate-400 mb-8">Your email has been verified successfully. You can now access all features.</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-lg shadow-emerald-500/20 transition-all"
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="w-full max-w-[420px] text-center">
        <div className="inline-flex p-5 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-3">Verification failed</h1>
        <p className="text-slate-400 mb-8">{error}</p>
        <Link
          href="/signin"
          className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  // Verifying state
  if (status === 'verifying') {
    return (
      <div className="w-full max-w-[420px] text-center">
        <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6" />
        <h1 className="text-2xl font-bold tracking-tight mb-3">Verifying your email...</h1>
        <p className="text-slate-400">Please wait a moment</p>
      </div>
    );
  }

  // Pending state (just registered, waiting for user to check email)
  return (
    <div className="w-full max-w-[420px] text-center">
      <div className="inline-flex p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-6">
        <Mail className="w-10 h-10 text-amber-400" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-3">
        {justRegistered ? 'Verify your email' : 'Email verification required'}
      </h1>
      <p className="text-slate-400 mb-2 leading-relaxed">
        {justRegistered
          ? 'We sent a verification link to your email. Click the link to activate your account.'
          : 'Please verify your email address to access all features.'}
      </p>
      {user?.email && (
        <p className="text-white font-medium mb-8">{user.email}</p>
      )}

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 mb-6">
        <div className="space-y-3 text-sm text-slate-400 text-left">
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-emerald-400">1</span>
            </span>
            <p>Open your email inbox</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-emerald-400">2</span>
            </span>
            <p>Find the email from Ikpa</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-emerald-400">3</span>
            </span>
            <p>Click the verification link</p>
          </div>
        </div>
      </div>

      {/* Resend */}
      {resendSent ? (
        <p className="text-emerald-400 text-sm">Verification email sent again. Check your inbox.</p>
      ) : (
        <button
          onClick={handleResend}
          disabled={resendLoading || !user?.email}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${resendLoading ? 'animate-spin' : ''}`} />
          Resend verification email
        </button>
      )}

      {/* Continue to dashboard */}
      <div className="mt-8 pt-6 border-t border-white/[0.06]">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Skip for now — continue to dashboard
        </button>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-[420px] text-center">
        <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6" />
        <p className="text-slate-400">Loading...</p>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
