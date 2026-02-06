'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api';

// Types
export interface OnboardingStep {
  id: string;
  name: string;
  order: number;
  required: boolean;
  status: 'pending' | 'completed' | 'skipped';
  description: string;
}

export interface OnboardingStatus {
  isCompleted: boolean;
  currentStep: string;
  progressPercent: number;
  steps: OnboardingStep[];
  profile: {
    country?: string;
    currency?: string;
    employmentType?: string;
    dateOfBirth?: string;
  };
  startedAt: string;
  completedAt?: string;
  nextAction: string;
}

export interface UpdateProfileData {
  country?: string;
  currency?: string;
  employmentType?: string;
  dateOfBirth?: string;
}

// Unwrap API envelope { success, data } → data
function unwrap<T>(res: unknown): T {
  const r = res as { success?: boolean; data?: T };
  return (r?.data ?? res) as T;
}

// API Functions
const fetchOnboardingStatus = async (): Promise<OnboardingStatus> => {
  const res = await apiClient.get('/onboarding/status');
  return unwrap<OnboardingStatus>(res);
};

const updateProfile = async (data: UpdateProfileData) => {
  const res = await apiClient.patch('/onboarding/profile', data);
  return unwrap(res);
};

const completeStep = async (step: string) => {
  const res = await apiClient.post(`/onboarding/steps/${step}/complete`);
  return unwrap(res);
};

const skipStep = async (step: string) => {
  const res = await apiClient.post(`/onboarding/steps/${step}/skip`);
  return unwrap(res);
};

const completeOnboarding = async () => {
  const res = await apiClient.post('/onboarding/complete');
  return unwrap(res);
};

const submitEmergencyEstimate = async (amount: number) => {
  const res = await apiClient.post('/onboarding/emergency-estimate', { amount });
  return unwrap(res);
};

const uploadStatement = async ({
  file,
  bankName,
}: {
  file: File;
  bankName: string;
}) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bankName', bankName);
  const res = await apiClient.upload('/import/statement', formData);
  return unwrap(res);
};

// Hook
export function useOnboarding() {
  const queryClient = useQueryClient();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Fetch onboarding status
  const {
    data: status,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['onboarding', 'status'],
    queryFn: fetchOnboardingStatus,
    staleTime: 30000, // 30 seconds
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  // Complete step mutation
  const completeStepMutation = useMutation({
    mutationFn: completeStep,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  // Skip step mutation
  const skipStepMutation = useMutation({
    mutationFn: skipStep,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  // Submit emergency fund estimate mutation
  const submitEstimateMutation = useMutation({
    mutationFn: submitEmergencyEstimate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  // Upload bank statement mutation
  const uploadStatementMutation = useMutation({
    mutationFn: uploadStatement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['import'] });
    },
  });

  // Navigation helpers
  const goToNextStep = useCallback(() => {
    if (status && currentStepIndex < status.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [status, currentStepIndex]);

  const goToPreviousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const goToStep = useCallback((index: number) => {
    setCurrentStepIndex(index);
  }, []);

  // Current step info
  const currentStep = status?.steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = status ? currentStepIndex === status.steps.length - 1 : false;

  return {
    // Status
    status,
    isLoading,
    error: error as ApiError | null,
    refetch,

    // Current step
    currentStep,
    currentStepIndex,
    isFirstStep,
    isLastStep,

    // Navigation
    goToNextStep,
    goToPreviousStep,
    goToStep,

    // Mutations
    updateProfile: updateProfileMutation.mutateAsync,
    isUpdatingProfile: updateProfileMutation.isPending,

    completeStep: completeStepMutation.mutateAsync,
    isCompletingStep: completeStepMutation.isPending,

    skipStep: skipStepMutation.mutateAsync,
    isSkippingStep: skipStepMutation.isPending,

    completeOnboarding: completeOnboardingMutation.mutateAsync,
    isCompletingOnboarding: completeOnboardingMutation.isPending,

    submitEstimate: submitEstimateMutation.mutateAsync,
    isSubmittingEstimate: submitEstimateMutation.isPending,

    uploadStatement: uploadStatementMutation.mutateAsync,
    isUploadingStatement: uploadStatementMutation.isPending,
  };
}
