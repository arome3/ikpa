'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Mail,
  Copy,
  Check,
  RefreshCw,
  User,
  Globe,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, Button, Skeleton } from '@/components/ui';
import { useImportEmail } from '@/hooks/useImportEmail';
import { useAuthStore } from '@/stores/auth.store';
import { useCurrency } from '@/hooks';

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <div className="max-w-lg mx-auto px-4 py-6 safe-top pb-32">
        {/* Header */}
        <motion.header
          className="flex items-center gap-3 mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Settings
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage your account and preferences
            </p>
          </div>
        </motion.header>

        {/* Email Forwarding Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card variant="default" padding="lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Email Forwarding
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Auto-import transactions from bank alerts
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4 rounded" />
              </div>
            ) : importEmail ? (
              <>
                {/* Email address display + copy */}
                <div
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-xl',
                    'bg-slate-50 dark:bg-white/5',
                    'border border-slate-200 dark:border-white/10',
                  )}
                >
                  <code className="flex-1 text-sm font-mono text-slate-700 dark:text-slate-300 truncate">
                    {importEmail.emailAddress}
                  </code>
                  <button
                    onClick={handleCopy}
                    className={cn(
                      'flex-shrink-0 p-2 rounded-lg transition-colors',
                      copied
                        ? 'bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15',
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

                {/* Status row */}
                <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full',
                        importEmail.isActive
                          ? 'bg-green-500'
                          : 'bg-slate-300 dark:bg-slate-600',
                      )}
                    />
                    {importEmail.isActive ? 'Active' : 'Inactive'}
                  </div>
                  <span>Last used: {formatDate(importEmail.lastUsedAt)}</span>
                </div>

                {/* Instructions */}
                <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10">
                  <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                    Forward your bank alerts to this address to automatically
                    import transactions. Works with any bank that sends email
                    notifications.
                  </p>
                </div>

                {/* Regenerate */}
                <div className="mt-4">
                  {showRegenConfirm ? (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/10">
                      <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                        This will create a new email address. The old address
                        will stop receiving emails. Are you sure?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={handleRegenerate}
                          isLoading={isRegenerating}
                          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                        >
                          Regenerate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowRegenConfirm(false)}
                          disabled={isRegenerating}
                        >
                          Cancel
                        </Button>
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
                      className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Regenerate email address
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Unable to load your import email address. Please try again
                later.
              </p>
            )}
          </Card>
        </motion.div>

        {/* Profile Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4"
        >
          <Card variant="default" padding="lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                <User className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Profile
              </h2>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Name
                </span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {user?.name ?? '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Email
                </span>
                <span className="text-sm font-medium text-slate-900 dark:text-white truncate ml-4 max-w-[200px]">
                  {user?.email ?? '—'}
                </span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Preferences Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-4"
        >
          <Card variant="default" padding="lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-info-100 text-info-600 dark:bg-info-900/30 dark:text-info-400">
                <Globe className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Preferences
              </h2>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Currency
                </span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {currency || '—'}
                </span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Security Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4"
        >
          <Card variant="default" padding="lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Security
              </h2>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Account created
                </span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {user?.createdAt ? formatDate(user.createdAt) : '—'}
                </span>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
