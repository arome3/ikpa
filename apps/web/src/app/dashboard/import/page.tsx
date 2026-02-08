'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Upload, ChevronDown, AlertTriangle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { useImport } from '@/hooks/useImport';
import { useCategories } from '@/hooks/useFinance';
import {
  FileUploadZone,
  ProcessingIndicator,
  TransactionReviewList,
  ImportSuccess,
} from '@/components/import';

// ============================================
// TYPES
// ============================================

type WizardStep = 'upload' | 'processing' | 'review' | 'done' | 'error';

// ============================================
// PAGE
// ============================================

export default function ImportPage() {
  const router = useRouter();
  const {
    uploadStatement,
    isUploading,
    uploadError,
    job,
    jobError,
    confirmTransactions,
    isConfirming,
    confirmResult,
    confirmError,
    reset: resetImport,
  } = useImport();

  const { categories } = useCategories();

  // Local state
  const [step, setStep] = useState<WizardStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryId, setCategoryId] = useState<string>('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [hideDuplicates, setHideDuplicates] = useState(false);

  // Auto-transition: when job status changes, move to appropriate step
  useEffect(() => {
    if (!job) return;

    if (job.status === 'PENDING' || job.status === 'PROCESSING') {
      if (step !== 'processing') setStep('processing');
    } else if (job.status === 'AWAITING_REVIEW') {
      if (step !== 'review' && step !== 'done') {
        setStep('review');
        // Pre-select all non-created transactions (duplicates included by default)
        const selectableIds = job.transactions
          .filter((t) => t.status !== 'CREATED')
          .map((t) => t.id);
        setSelectedIds(new Set(selectableIds));
      }
    } else if (job.status === 'FAILED') {
      setStep('error');
    }
  }, [job, step]);

  // When hideDuplicates toggle changes, update selection
  useEffect(() => {
    if (!job || step !== 'review') return;
    const ids = job.transactions
      .filter((t) => t.status !== 'CREATED' && (!hideDuplicates || t.status !== 'DUPLICATE'))
      .map((t) => t.id);
    setSelectedIds(new Set(ids));
  }, [hideDuplicates]); // eslint-disable-line react-hooks/exhaustive-deps

  // After confirm success, move to done
  useEffect(() => {
    if (confirmResult) {
      setStep('done');
    }
  }, [confirmResult]);

  // Default category to "auto" so the backend auto-categorizes by merchant
  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId('auto');
    }
  }, [categories, categoryId]);

  // Count duplicates for UI
  const duplicateCount = useMemo(
    () => job?.transactions?.filter((t) => t.status === 'DUPLICATE').length ?? 0,
    [job?.transactions],
  );

  // Selectable transactions (exclude already-created, optionally hide duplicates)
  const selectableTransactions = useMemo(
    () => job?.transactions?.filter((t) => {
      if (t.status === 'CREATED') return false;
      if (t.status === 'DUPLICATE' && hideDuplicates) return false;
      return true;
    }) ?? [],
    [job?.transactions, hideDuplicates],
  );

  // Handlers
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
  }, []);

  const handleFileClear = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    try {
      await uploadStatement(selectedFile);
      setStep('processing');
    } catch {
      // Upload error is captured by the mutation
    }
  }, [selectedFile, uploadStatement]);

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allIds = selectableTransactions.map((t) => t.id);
      const allSelected = allIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(allIds);
    });
  }, [selectableTransactions]);

  const handleConfirm = useCallback(async () => {
    if (!job || selectedIds.size === 0 || !categoryId) return;
    try {
      await confirmTransactions(job.id, Array.from(selectedIds), categoryId);
    } catch {
      // Confirm error is captured by the mutation
    }
  }, [job, selectedIds, categoryId, confirmTransactions]);

  const handleRetry = useCallback(() => {
    resetImport();
    setStep('upload');
    setSelectedFile(null);
    setSelectedIds(new Set());
  }, [resetImport]);

  const autoDetectOption = { id: 'auto', name: 'Auto-detect by Merchant', icon: '🔍', color: '#6366F1' };
  const selectedCategory = categoryId === 'auto'
    ? autoDetectOption
    : categories.find((c) => c.id === categoryId);

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
              Import Statement
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Upload a bank statement to import transactions
            </p>
          </div>
        </motion.header>

        <AnimatePresence mode="wait">
          {/* ======================== */}
          {/* STEP 1: UPLOAD           */}
          {/* ======================== */}
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Upload zone */}
              <FileUploadZone
                onFileSelect={handleFileSelect}
                isUploading={isUploading}
                selectedFile={selectedFile}
                onClear={handleFileClear}
              />

              {/* Upload error */}
              {uploadError && (
                <motion.div
                  className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-red-700 dark:text-red-400">
                      {uploadError.message || 'Upload failed. Please try again.'}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Upload button */}
              <div className="mt-6">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  leftIcon={<Upload className="w-5 h-5" />}
                >
                  {isUploading ? 'Uploading...' : 'Upload Statement'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ======================== */}
          {/* STEP 2a: PROCESSING      */}
          {/* ======================== */}
          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ProcessingIndicator
                fileName={job?.fileName}
                status={job?.status ?? 'PENDING'}
                totalParsed={job?.totalParsed}
              />
            </motion.div>
          )}

          {/* ======================== */}
          {/* STEP 2b: REVIEW          */}
          {/* ======================== */}
          {step === 'review' && job && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Transaction list */}
              <TransactionReviewList
                transactions={job.transactions}
                selectedIds={selectedIds}
                onToggle={handleToggle}
                onToggleAll={handleToggleAll}
                currency={job.transactions[0]?.currency ?? 'USD'}
                hideDuplicates={hideDuplicates}
              />

              {/* Hide duplicates toggle */}
              {duplicateCount > 0 && (
                <button
                  type="button"
                  onClick={() => setHideDuplicates(!hideDuplicates)}
                  className={cn(
                    'mt-4 w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-sm',
                    'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-slate-700 dark:text-slate-300">
                      {duplicateCount} possible duplicate{duplicateCount !== 1 ? 's' : ''} included
                    </span>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400">
                    {hideDuplicates ? 'Show' : 'Hide'}
                  </span>
                </button>
              )}

              {/* Category selector */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Category for imported expenses
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors',
                      'bg-white dark:bg-white/5',
                      'border-slate-200 dark:border-white/10',
                      'hover:border-slate-300 dark:hover:border-white/20',
                    )}
                  >
                    {selectedCategory ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-md flex items-center justify-center text-sm"
                          style={{ backgroundColor: selectedCategory.color + '30' }}
                        >
                          {selectedCategory.icon}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200">{selectedCategory.name}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">Select category</span>
                    )}
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-slate-400 transition-transform',
                        showCategoryDropdown && 'rotate-180',
                      )}
                    />
                  </button>

                  <AnimatePresence>
                    {showCategoryDropdown && (
                      <motion.div
                        className={cn(
                          'absolute z-10 mt-2 w-full rounded-xl border shadow-lg overflow-hidden max-h-60 overflow-y-auto',
                          'bg-white dark:bg-slate-800',
                          'border-slate-200 dark:border-white/10',
                        )}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                      >
                        {[autoDetectOption, ...categories].map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setCategoryId(cat.id);
                              setShowCategoryDropdown(false);
                            }}
                            className={cn(
                              'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2',
                              cat.id === categoryId
                                ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5',
                            )}
                          >
                            <span
                              className="w-6 h-6 rounded-md flex items-center justify-center text-sm"
                              style={{ backgroundColor: cat.color + '30' }}
                            >
                              {cat.icon}
                            </span>
                            {cat.name}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Confirm error */}
              {confirmError && (
                <motion.div
                  className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-red-700 dark:text-red-400">
                      {confirmError.message || 'Failed to import transactions.'}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Nothing to import case */}
              {selectableTransactions.length === 0 && job.transactions.length > 0 && (
                <motion.div
                  className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    All transactions are duplicates or already imported. Nothing new to import.
                  </p>
                </motion.div>
              )}

              {/* Confirm button */}
              <div className="mt-6">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleConfirm}
                  disabled={selectedIds.size === 0 || !categoryId || isConfirming}
                >
                  {isConfirming
                    ? 'Importing...'
                    : `Import ${selectedIds.size} Transaction${selectedIds.size !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ======================== */}
          {/* STEP 3: DONE             */}
          {/* ======================== */}
          {step === 'done' && confirmResult && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ImportSuccess
                expensesCreated={confirmResult.expensesCreated}
                skipped={confirmResult.skipped}
                onViewExpenses={() => router.push('/dashboard/expenses')}
                onRunShark={() => router.push('/dashboard/shark')}
              />
            </motion.div>
          )}

          {/* ======================== */}
          {/* ERROR STATE              */}
          {/* ======================== */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={cn(
                'rounded-2xl p-8 text-center',
                'bg-red-50 border border-red-200',
                'dark:bg-red-500/5 dark:border-red-500/20',
              )}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/10 mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Import Failed
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                {job?.errorMessage || jobError?.message || 'Something went wrong processing your file.'}
              </p>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleRetry}
                leftIcon={<RotateCcw className="w-4 h-4" />}
              >
                Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
