'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api';

// ============================================
// TYPES
// ============================================

export interface ImportEmailInfo {
  emailAddress: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  instructions: string;
}

export interface RegenerateEmailResult {
  emailAddress: string;
  message: string;
  remainingToday: number;
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

export function useImportEmail() {
  const queryClient = useQueryClient();

  // Fetch the user's import email address
  const {
    data: importEmail,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['import', 'email'],
    queryFn: async () => {
      const res = await apiClient.get('/import/email');
      return unwrap<ImportEmailInfo>(res);
    },
  });

  // Regenerate mutation
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/import/email/regenerate');
      return unwrap<RegenerateEmailResult>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import', 'email'] });
    },
  });

  return {
    importEmail: importEmail ?? null,
    isLoading,
    error: error as ApiError | null,
    regenerate: regenerateMutation.mutateAsync,
    isRegenerating: regenerateMutation.isPending,
    regenerateError: regenerateMutation.error as ApiError | null,
  };
}
