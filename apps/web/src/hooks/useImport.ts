'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api';

// ============================================
// TYPES
// ============================================

export type ImportJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'AWAITING_REVIEW'
  | 'COMPLETED'
  | 'FAILED';

export type ParsedTransactionStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CREATED'
  | 'DUPLICATE';

export type ImportSource =
  | 'BANK_STATEMENT_PDF'
  | 'BANK_STATEMENT_CSV'
  | 'EMAIL_FORWARD'
  | 'SCREENSHOT';

export type SupportedBank =
  | 'GTBank'
  | 'Access Bank'
  | 'First Bank'
  | 'Zenith Bank'
  | 'UBA'
  | 'Kuda'
  | 'Opay'
  | 'Moniepoint'
  | 'Other';

export interface UploadResponse {
  jobId: string;
  status: string;
  fileName: string;
  fileSize: number;
  message: string;
}

export interface ImportJobSummary {
  id: string;
  source: ImportSource;
  status: ImportJobStatus;
  fileName?: string | null;
  bankName?: string | null;
  totalParsed: number;
  pendingReview: number;
  created: number;
  duplicates: number;
  createdAt: string;
}

export interface ParsedTransaction {
  id: string;
  amount: number;
  currency: string;
  date: string;
  description?: string;
  merchant?: string;
  normalizedMerchant?: string;
  isRecurringGuess: boolean;
  status: ParsedTransactionStatus;
  duplicateOfId?: string | null;
  confidence?: number;
}

export interface ImportJobDetails extends ImportJobSummary {
  errorMessage?: string | null;
  transactions: ParsedTransaction[];
}

export interface ConfirmResponse {
  expensesCreated: number;
  skipped: number;
  expenseIds: string[];
  message: string;
}

// ============================================
// UNWRAP HELPER
// ============================================

function unwrap<T>(res: unknown): T {
  const r = res as { success?: boolean; data?: T };
  return (r?.data ?? res) as T;
}

// ============================================
// HOOK
// ============================================

const POLLING_STATUSES: ImportJobStatus[] = ['PENDING', 'PROCESSING'];

export function useImport() {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);

  // Upload statement mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, bankName }: { file: File; bankName?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (bankName) formData.append('bankName', bankName);

      const res = await apiClient.upload('/import/statement', formData);
      return unwrap<UploadResponse>(res);
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
    },
  });

  // Poll job details when jobId is set
  const {
    data: job,
    isLoading: isLoadingJob,
    error: jobError,
  } = useQuery({
    queryKey: ['import', 'job', jobId],
    queryFn: async () => {
      const res = await apiClient.get(`/import/jobs/${jobId}`);
      return unwrap<ImportJobDetails>(res);
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && POLLING_STATUSES.includes(status)) {
        return 2000;
      }
      return false;
    },
  });

  // Confirm transactions mutation
  const confirmMutation = useMutation({
    mutationFn: async ({
      jobId: jId,
      transactionIds,
      categoryId,
    }: {
      jobId: string;
      transactionIds: string[];
      categoryId: string;
    }) => {
      const res = await apiClient.post(`/import/jobs/${jId}/confirm`, {
        transactionIds,
        categoryId,
      });
      return unwrap<ConfirmResponse>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financialSummary'] });
      queryClient.invalidateQueries({ queryKey: ['shark'] });
      queryClient.invalidateQueries({ queryKey: ['cashFlowScore'] });
      if (jobId) {
        queryClient.invalidateQueries({ queryKey: ['import', 'job', jobId] });
      }
    },
  });

  // Update a parsed transaction
  const updateTransactionMutation = useMutation({
    mutationFn: async ({
      transactionId,
      updates,
    }: {
      transactionId: string;
      updates: { status?: ParsedTransactionStatus; merchant?: string; isRecurring?: boolean };
    }) => {
      const res = await apiClient.patch(`/import/transactions/${transactionId}`, updates);
      return unwrap<{ message: string }>(res);
    },
    onSuccess: () => {
      if (jobId) {
        queryClient.invalidateQueries({ queryKey: ['import', 'job', jobId] });
      }
    },
  });

  // Upload helper
  const uploadStatement = useCallback(
    (file: File, bankName?: string) => uploadMutation.mutateAsync({ file, bankName }),
    [uploadMutation],
  );

  // Confirm helper
  const confirmTransactions = useCallback(
    (jId: string, transactionIds: string[], categoryId: string) =>
      confirmMutation.mutateAsync({ jobId: jId, transactionIds, categoryId }),
    [confirmMutation],
  );

  // Update transaction helper
  const updateTransaction = useCallback(
    (transactionId: string, updates: { status?: ParsedTransactionStatus; merchant?: string; isRecurring?: boolean }) =>
      updateTransactionMutation.mutateAsync({ transactionId, updates }),
    [updateTransactionMutation],
  );

  // Reset state
  const reset = useCallback(() => {
    setJobId(null);
    uploadMutation.reset();
    confirmMutation.reset();
  }, [uploadMutation, confirmMutation]);

  return {
    // Upload
    uploadStatement,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error as ApiError | null,

    // Job polling
    job,
    isLoadingJob,
    jobError: jobError as ApiError | null,
    setJobId,
    jobId,

    // Confirm
    confirmTransactions,
    isConfirming: confirmMutation.isPending,
    confirmResult: confirmMutation.data ?? null,
    confirmError: confirmMutation.error as ApiError | null,

    // Update transaction
    updateTransaction,
    isUpdatingTransaction: updateTransactionMutation.isPending,

    // Reset
    reset,
  };
}
