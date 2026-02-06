'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Upload, Shield, Lock, CheckCircle2,
  ChevronDown, FileText, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FinancialSnapshotStepProps {
  currency: string;
  onSubmitEstimate: (amount: number) => Promise<unknown>;
  onUploadStatement: (params: { file: File; bankName: string }) => Promise<unknown>;
  onContinue: () => void;
  onSkip: () => void;
  isSubmittingEstimate: boolean;
  isUploadingStatement: boolean;
}

const bankOptions = [
  'Chase',
  'Bank of America',
  'Wells Fargo',
  'Citibank',
  'Capital One',
  'TD Bank',
  'PNC',
  'US Bank',
  'Goldman Sachs',
  'Other',
] as const;

export function FinancialSnapshotStep({
  currency,
  onSubmitEstimate,
  onUploadStatement,
  onContinue,
  onSkip,
  isSubmittingEstimate,
  isUploadingStatement,
}: FinancialSnapshotStepProps) {
  // Emergency fund state
  const [hasEmergencySavings, setHasEmergencySavings] = useState(false);
  const [emergencyAmount, setEmergencyAmount] = useState('');
  const [estimateSaved, setEstimateSaved] = useState(false);

  // Upload state
  const [selectedBank, setSelectedBank] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<'6months' | '1year'>('6months');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ totalParsed?: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEstimateSubmit = async () => {
    const amount = parseFloat(emergencyAmount);
    if (isNaN(amount) || amount <= 0) return;
    await onSubmitEstimate(amount);
    setEstimateSaved(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setUploadError(null);
      setUploadSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadedFile || !selectedBank) return;
    setUploadError(null);
    try {
      const result = await onUploadStatement({
        file: uploadedFile,
        bankName: selectedBank,
      });
      setUploadSuccess(true);
      setUploadResult(result as { totalParsed?: number } | null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleContinue = () => {
    onContinue();
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 text-white mb-4 shadow-xl shadow-violet-500/25"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        >
          <Camera className="w-8 h-8" />
        </motion.div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-neutral-900 dark:text-white">
          Financial Snapshot
        </h2>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
          Help us understand your finances better. Everything here is optional — share what you&apos;re comfortable with.
        </p>
      </div>

      {/* Section A — Emergency Fund Estimate */}
      <motion.div
        className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-500" />
          Emergency Savings
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Do you have any money set aside for emergencies? A rough estimate is fine.
        </p>

        {/* Toggle */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setHasEmergencySavings(true);
              setEstimateSaved(false);
            }}
            className={cn(
              'flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all',
              hasEmergencySavings
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-emerald-300'
            )}
          >
            Yes, I have some
          </button>
          <button
            type="button"
            onClick={() => {
              setHasEmergencySavings(false);
              setEmergencyAmount('');
              setEstimateSaved(false);
            }}
            className={cn(
              'flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all',
              !hasEmergencySavings
                ? 'border-neutral-500 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
            )}
          >
            Not yet
          </button>
        </div>

        {/* Amount input (shown when "Yes") */}
        <AnimatePresence>
          {hasEmergencySavings && (
            <motion.div
              className="space-y-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
                  {currency}
                </span>
                <input
                  type="number"
                  placeholder="Roughly how much?"
                  value={emergencyAmount}
                  onChange={(e) => {
                    setEmergencyAmount(e.target.value);
                    setEstimateSaved(false);
                  }}
                  className="w-full p-3 pl-14 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                />
              </div>
              {!estimateSaved ? (
                <button
                  type="button"
                  onClick={handleEstimateSubmit}
                  disabled={!emergencyAmount || isSubmittingEstimate}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmittingEstimate ? 'Saving...' : 'Save Estimate'}
                </button>
              ) : (
                <motion.div
                  className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Estimate saved
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          No worries if you don&apos;t have emergency savings yet — that&apos;s something we can help you build.
        </p>
      </motion.div>

      {/* Section B — Bank Statement Upload */}
      <motion.div
        className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          Bank Statement Upload
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Upload a bank statement to automatically import your transaction history. Supports PDF and CSV formats.
        </p>

        {/* Bank Selector */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            Bank
          </label>
          <div className="relative">
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full p-3 pr-10 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none"
            >
              <option value="">Select your bank</option>
              {bankOptions.map((bank) => (
                <option key={bank} value={bank}>
                  {bank}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          </div>
        </div>

        {/* Period Selector */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            Statement Period
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSelectedPeriod('6months')}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-xl border text-sm font-medium transition-all',
                selectedPeriod === '6months'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-blue-300'
              )}
            >
              Last 6 months
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('1year')}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-xl border text-sm font-medium transition-all',
                selectedPeriod === '1year'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-blue-300'
              )}
            >
              Last 1 year
            </button>
          </div>
        </div>

        {/* File Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!uploadSuccess ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all text-center',
              uploadedFile
                ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                : 'border-neutral-300 dark:border-neutral-700 hover:border-blue-300 hover:bg-blue-50/30 dark:hover:bg-blue-900/5'
            )}
          >
            {uploadedFile ? (
              <div className="space-y-2">
                <FileText className="w-8 h-8 text-blue-500 mx-auto" />
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {uploadedFile.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {(uploadedFile.size / 1024).toFixed(0)} KB — Click to change
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-neutral-400 mx-auto" />
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Click to select a PDF or CSV file
                </p>
                <p className="text-xs text-neutral-400">
                  Max 10 MB
                </p>
              </div>
            )}
          </div>
        ) : (
          <motion.div
            className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-center space-y-2"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-medium text-emerald-700 dark:text-emerald-300">
              Statement uploaded successfully!
            </p>
            {uploadResult?.totalParsed !== undefined && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {uploadResult.totalParsed} transactions found — you can review them after onboarding.
              </p>
            )}
          </motion.div>
        )}

        {/* Upload Error */}
        {uploadError && (
          <motion.div
            className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {uploadError}
          </motion.div>
        )}

        {/* Upload Button */}
        {uploadedFile && !uploadSuccess && (
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedBank || isUploadingStatement}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isUploadingStatement ? 'Uploading...' : 'Upload Statement'}
          </button>
        )}
      </motion.div>

      {/* Section C — Security Trust Banner */}
      <motion.div
        className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 flex items-start gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="w-10 h-10 rounded-xl bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
          <Lock className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
        </div>
        <div>
          <p className="font-medium text-neutral-900 dark:text-white text-sm">
            Your financial data is encrypted and secured
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            All data is encrypted in transit and at rest. We never share your information
            with third parties. Your bank credentials are never stored.
          </p>
        </div>
      </motion.div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 py-4 px-6 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          Skip for Now
        </button>
        <motion.button
          type="button"
          onClick={handleContinue}
          className={cn(
            'flex-1 py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200',
            'bg-gradient-to-r from-emerald-500 to-emerald-600',
            'hover:from-emerald-600 hover:to-emerald-700',
            'shadow-lg shadow-emerald-500/25'
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Continue
        </motion.button>
      </div>
    </motion.div>
  );
}
