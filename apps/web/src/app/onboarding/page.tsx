'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useAuthStore } from '@/stores/auth.store';
import {
  useIncome,
  useDebts,
  useGoals,
  useBudgets,
  useCategories,
} from '@/hooks/useFinance';
import {
  StepIndicator,
  ProfileStep,
  IncomeStep,
  FinancialSnapshotStep,
  DebtsStep,
  GoalsStep,
  BudgetsStep,
  CompletionStep,
} from '@/components/onboarding';
import { Spinner } from '@/components/ui';

export default function OnboardingPage() {
  const router = useRouter();

  // Onboarding state
  const {
    status,
    isLoading: isLoadingStatus,
    currentStepIndex,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    updateProfile,
    isUpdatingProfile,
    completeStep,
    isCompletingStep,
    skipStep,
    isSkippingStep,
    completeOnboarding,
    isCompletingOnboarding,
    submitEstimate,
    isSubmittingEstimate,
    uploadStatement,
    isUploadingStatement,
  } = useOnboarding();

  // Financial data
  const { items: incomeItems, create: createIncome, delete: deleteIncome, isCreating: isCreatingIncome, isDeleting: isDeletingIncome } = useIncome();
  const { items: debtItems, create: createDebt, delete: deleteDebt, isCreating: isCreatingDebt, isDeleting: isDeletingDebt } = useDebts();
  const { items: goalItems, create: createGoal, delete: deleteGoal, isCreating: isCreatingGoal, isDeleting: isDeletingGoal } = useGoals();
  const { items: budgetItems, create: createBudget, delete: deleteBudget, isCreating: isCreatingBudget, isDeleting: isDeletingBudget } = useBudgets();
  const { categories } = useCategories();

  // Redirect if onboarding is already complete
  useEffect(() => {
    if (status?.isCompleted) {
      router.push('/dashboard');
    }
  }, [status?.isCompleted, router]);

  // Loading state
  if (isLoadingStatus) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-neutral-500">Unable to load onboarding status</p>
      </div>
    );
  }

  const currency = status.profile.currency || 'USD';
  const currentStep = status.steps[currentStepIndex];

  // Handle step actions
  const handleProfileSubmit = async (data: {
    country: string;
    currency: string;
    employmentType: string;
    dateOfBirth?: string;
  }) => {
    await updateProfile(data);
    await completeStep('profile');
    goToNextStep();
  };

  const handleIncomeComplete = async () => {
    await completeStep('income');
    goToNextStep();
  };

  const handleFinancialSnapshotComplete = async () => {
    await completeStep('financial-snapshot');
    goToNextStep();
  };

  const handleFinancialSnapshotSkip = async () => {
    await skipStep('financial-snapshot');
    goToNextStep();
  };

  const handleDebtsComplete = async () => {
    if (debtItems.length > 0) {
      await completeStep('debts');
    }
    goToNextStep();
  };

  const handleDebtsSkip = async () => {
    await skipStep('debts');
    goToNextStep();
  };

  const handleGoalsComplete = async () => {
    await completeStep('goals');
    goToNextStep();
  };

  const handleBudgetsComplete = async () => {
    if (budgetItems.length > 0) {
      await completeStep('budgets');
    }
    goToNextStep();
  };

  const handleBudgetsSkip = async () => {
    await skipStep('budgets');
    goToNextStep();
  };

  const handleFinalComplete = async () => {
    await completeOnboarding();
    // Update auth store so dashboard gate allows access
    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      useAuthStore.getState().setUser({ ...currentUser, onboardingCompleted: true, currency });
    }
    router.push('/dashboard');
  };

  // Render current step content
  const renderStepContent = () => {
    const stepId = currentStep?.id;

    // If all steps are done, show completion
    if (currentStepIndex >= status.steps.length || status.progressPercent === 100) {
      return (
        <CompletionStep
          onComplete={handleFinalComplete}
          isCompleting={isCompletingOnboarding}
        />
      );
    }

    switch (stepId) {
      case 'profile':
        return (
          <ProfileStep
            initialData={status.profile}
            onSubmit={handleProfileSubmit}
            isSubmitting={isUpdatingProfile || isCompletingStep}
          />
        );

      case 'income':
        return (
          <IncomeStep
            items={incomeItems.filter(i => i.isActive)}
            currency={currency}
            onAdd={createIncome}
            onDelete={deleteIncome}
            onContinue={handleIncomeComplete}
            isAdding={isCreatingIncome}
            isDeleting={isDeletingIncome}
            isRequired={currentStep?.required ?? true}
          />
        );

      case 'financial-snapshot':
        return (
          <FinancialSnapshotStep
            currency={currency}
            onSubmitEstimate={submitEstimate}
            onUploadStatement={uploadStatement}
            onContinue={handleFinancialSnapshotComplete}
            onSkip={handleFinancialSnapshotSkip}
            isSubmittingEstimate={isSubmittingEstimate}
            isUploadingStatement={isUploadingStatement}
          />
        );

      case 'debts':
        return (
          <DebtsStep
            items={debtItems.filter(d => d.isActive)}
            currency={currency}
            onAdd={createDebt}
            onDelete={deleteDebt}
            onContinue={handleDebtsComplete}
            onSkip={handleDebtsSkip}
            isAdding={isCreatingDebt}
            isDeleting={isDeletingDebt}
            isRequired={currentStep?.required ?? false}
          />
        );

      case 'goals':
        return (
          <GoalsStep
            items={goalItems.filter(g => g.status === 'ACTIVE')}
            currency={currency}
            onAdd={createGoal}
            onDelete={deleteGoal}
            onContinue={handleGoalsComplete}
            isAdding={isCreatingGoal}
            isDeleting={isDeletingGoal}
            isRequired={currentStep?.required ?? true}
          />
        );

      case 'budgets':
        return (
          <BudgetsStep
            items={budgetItems.filter(b => b.isActive)}
            categories={categories}
            currency={currency}
            onAdd={createBudget}
            onDelete={deleteBudget}
            onContinue={handleBudgetsComplete}
            onSkip={handleBudgetsSkip}
            isAdding={isCreatingBudget}
            isDeleting={isDeletingBudget}
            isRequired={currentStep?.required ?? false}
          />
        );

      default:
        return (
          <CompletionStep
            onComplete={handleFinalComplete}
            isCompleting={isCompletingOnboarding}
          />
        );
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step Indicator */}
      <motion.div
        className="mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <StepIndicator
          steps={status.steps}
          currentStepIndex={currentStepIndex}
          onStepClick={goToStep}
        />
      </motion.div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {renderStepContent()}
        </motion.div>
      </AnimatePresence>

      {/* Back Button (except for first step and completion) */}
      {currentStepIndex > 0 && currentStepIndex < status.steps.length && (
        <motion.button
          onClick={goToPreviousStep}
          className="mt-6 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          ← Go back
        </motion.button>
      )}
    </div>
  );
}
