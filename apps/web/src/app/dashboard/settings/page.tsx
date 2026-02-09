'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Inbox, Copy, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui';
import { useImportEmail } from '@/hooks/useImportEmail';
import { useAuthStore } from '@/stores/auth.store';
import { useCurrency } from '@/hooks';

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { currency } = useCurrency();
  const {
    importEmail,
    isLoading,
    regenerate,
    isRegenerating,
    regenerateError,
  } = useImportEmail();

  const [copied, setCopied] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  const handleCopy = useCallback(async () => {
    if (!importEmail?.emailAddress) return;
    try {
      await navigator.clipboard.writeText(importEmail.emailAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = importEmail.emailAddress;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [importEmail?.emailAddress]);

  const handleRegenerate = useCallback(async () => {
    try {
      await regenerate();
      setShowRegenConfirm(false);
    } catch {
      // Error is captured by the mutation
    }
  }, [regenerate]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* Header — Account Overview */}
      <motion.header
        className="flex items-start justify-between mb-12"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="font-serif text-4xl text-[#1A2E22] dark:text-white">
            Account Configuration
          </h1>
          <p className="mt-2 text-stone-500 dark:text-stone-400">
            Manage your data inputs and privacy preferences.
          </p>
        </div>
        {memberSince && (
          <span className="flex-shrink-0 ml-4 mt-2 font-mono text-xs text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-white/10 rounded-full px-3 py-1">
            Member since {memberSince}
          </span>
        )}
      </motion.header>

      {/* Ingestion Protocol — Email Forwarding */}
      <motion.section
        className="bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-lg p-8 shadow-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <Inbox className="w-5 h-5 text-[#1A2E22] dark:text-emerald-400" strokeWidth={1.5} />
          <h2 className="font-serif text-lg font-semibold text-[#1A2E22] dark:text-white">
            Transaction Import Address
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4 rounded" />
          </div>
        ) : importEmail ? (
          <>
            {/* Email address display + copy */}
            <div
              className={cn(
                'flex items-center gap-2 p-4 rounded',
                'bg-stone-50 dark:bg-white/5',
                'border border-stone-200 dark:border-white/10',
              )}
            >
              <code className="flex-1 font-mono text-sm text-[#1A2E22] dark:text-stone-300 truncate">
                {importEmail.emailAddress}
              </code>
              <button
                onClick={handleCopy}
                className={cn(
                  'flex-shrink-0 p-2 rounded transition-colors',
                  copied
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300',
                )}
                title={copied ? 'Copied!' : 'Copy to clipboard'}
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Instructions */}
            <p className="mt-4 text-sm italic text-stone-400 dark:text-stone-500 leading-relaxed">
              Forward bank alerts to this secure address to automatically import
              transactions. Works with any bank that sends email notifications.
            </p>

            {/* Regenerate */}
            <div className="mt-5">
              {showRegenConfirm ? (
                <div className="p-4 rounded bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/10">
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                    This will create a new email address. The old address will
                    stop receiving emails. Are you sure?
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="text-xs font-medium text-red-700 dark:text-red-400 hover:underline disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <RefreshCw className={cn('w-3.5 h-3.5', isRegenerating && 'animate-spin')} />
                      Regenerate
                    </button>
                    <button
                      onClick={() => setShowRegenConfirm(false)}
                      disabled={isRegenerating}
                      className="text-xs text-stone-500 dark:text-stone-400 hover:underline disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  {regenerateError && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                      {regenerateError.message}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowRegenConfirm(true)}
                  className="text-xs text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate email address
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Unable to load your import email address. Please try again later.
          </p>
        )}
      </motion.section>

      {/* Configuration Grid — Profile + Preferences + Security merged */}
      <motion.section
        className="bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-lg p-8 mt-8 shadow-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
          {/* Full Name */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-2">
              Full Name
            </div>
            <div className="text-base text-[#1A2E22] dark:text-white border-b border-stone-200 dark:border-white/10 pb-2">
              {user?.name ?? '---'}
            </div>
          </div>

          {/* Primary Email */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-2">
              Primary Email
            </div>
            <div className="text-base text-[#1A2E22] dark:text-white border-b border-stone-200 dark:border-white/10 pb-2 truncate">
              {user?.email ?? '---'}
            </div>
          </div>

          {/* Base Currency */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-2">
              Base Currency
            </div>
            <div className="text-base text-[#1A2E22] dark:text-white border-b border-stone-200 dark:border-white/10 pb-2">
              {currency || '---'}
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-2">
              Password
            </div>
            <div className="border-b border-stone-200 dark:border-white/10 pb-2">
              <button
                onClick={() => router.push('/forgot-password')}
                className="text-base text-[#1A2E22] dark:text-white hover:underline"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Session Control Footer */}
      <motion.footer
        className="mt-12 flex items-center justify-between"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <button
          onClick={() => {
            logout();
            localStorage.removeItem('ikpa-refresh-token');
            router.push('/signin');
          }}
          className="text-sm font-medium text-red-800 dark:text-red-400 hover:underline"
        >
          Sign Out
        </button>
        <button
          onClick={() => {}}
          className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
        >
          Delete Account
        </button>
      </motion.footer>
    </div>
  );
}
