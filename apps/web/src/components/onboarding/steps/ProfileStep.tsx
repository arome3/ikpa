'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, Briefcase, Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileStepProps {
  initialData?: {
    country?: string;
    currency?: string;
    employmentType?: string;
    dateOfBirth?: string;
  };
  onSubmit: (data: {
    country: string;
    currency: string;
    employmentType: string;
    dateOfBirth?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

const countries = [
  { code: 'OTHER', name: 'United States', currency: 'USD', flag: '🇺🇸' },
  { code: 'NIGERIA', name: 'Nigeria', currency: 'NGN', flag: '🇳🇬' },
];

const employmentTypes = [
  { value: 'EMPLOYED', label: 'Employed', description: 'Working for a company', icon: '💼' },
  { value: 'SELF_EMPLOYED', label: 'Self-Employed', description: 'Running your own business', icon: '🚀' },
  { value: 'FREELANCER', label: 'Freelancer', description: 'Working independently', icon: '💻' },
  { value: 'STUDENT', label: 'Student', description: 'Currently studying', icon: '📚' },
  { value: 'UNEMPLOYED', label: 'Between Jobs', description: 'Looking for opportunities', icon: '🔍' },
  { value: 'RETIRED', label: 'Retired', description: 'Enjoying life', icon: '🌴' },
];

export function ProfileStep({ initialData, onSubmit, isSubmitting }: ProfileStepProps) {
  const [country, setCountry] = useState(initialData?.country || 'OTHER');
  const [currency, setCurrency] = useState(initialData?.currency || 'USD');
  const [employmentType, setEmploymentType] = useState(initialData?.employmentType || '');
  const [dateOfBirth, setDateOfBirth] = useState(initialData?.dateOfBirth || '');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  const selectedCountry = countries.find((c) => c.code === country);

  const handleCountrySelect = (c: (typeof countries)[0]) => {
    setCountry(c.code);
    setCurrency(c.currency);
    setShowCountryDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      country,
      currency,
      employmentType,
      dateOfBirth: dateOfBirth || undefined,
    });
  };

  const isValid = country && currency && employmentType;

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="text-center mb-10">
        <motion.div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white mb-4 shadow-xl shadow-emerald-500/25"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        >
          <Globe className="w-8 h-8" />
        </motion.div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-neutral-900 dark:text-white">
          Welcome to Your Financial Journey
        </h2>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
          Let&apos;s personalize your experience. This helps us provide relevant insights for your region.
        </p>
      </div>

      {/* Country Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <Globe className="w-4 h-4 inline mr-2" />
          Your Country
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
            className={cn(
              'w-full flex items-center justify-between gap-3 p-4 rounded-xl border-2 transition-all duration-200',
              'bg-white dark:bg-neutral-900',
              showCountryDropdown
                ? 'border-emerald-500 ring-4 ring-emerald-500/10'
                : 'border-neutral-200 dark:border-neutral-800 hover:border-emerald-300'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedCountry?.flag}</span>
              <div className="text-left">
                <p className="font-medium text-neutral-900 dark:text-white">
                  {selectedCountry?.name}
                </p>
                <p className="text-sm text-neutral-500">
                  Currency: {selectedCountry?.currency}
                </p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                'w-5 h-5 text-neutral-400 transition-transform',
                showCountryDropdown && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown */}
          {showCountryDropdown && (
            <motion.div
              className="absolute z-20 w-full mt-2 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="max-h-64 overflow-y-auto">
                {countries.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleCountrySelect(c)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors',
                      country === c.code && 'bg-emerald-50 dark:bg-emerald-900/20'
                    )}
                  >
                    <span className="text-xl">{c.flag}</span>
                    <div className="text-left flex-1">
                      <p className="font-medium text-neutral-900 dark:text-white">{c.name}</p>
                      <p className="text-xs text-neutral-500">{c.currency}</p>
                    </div>
                    {country === c.code && (
                      <motion.div
                        className="w-2 h-2 rounded-full bg-emerald-500"
                        layoutId="countryCheck"
                      />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Employment Type */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <Briefcase className="w-4 h-4 inline mr-2" />
          Employment Status
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {employmentTypes.map((type, index) => (
            <motion.button
              key={type.value}
              type="button"
              onClick={() => setEmploymentType(type.value)}
              className={cn(
                'relative p-4 rounded-xl border-2 text-left transition-all duration-200',
                employmentType === type.value
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-4 ring-emerald-500/10'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-emerald-300'
              )}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-2xl mb-2 block">{type.icon}</span>
              <p className="font-medium text-sm text-neutral-900 dark:text-white">
                {type.label}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">{type.description}</p>
              {employmentType === type.value && (
                <motion.div
                  className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500"
                  layoutId="employmentCheck"
                />
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Date of Birth (Optional) */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <Calendar className="w-4 h-4 inline mr-2" />
          Date of Birth
          <span className="ml-2 text-xs text-neutral-400">(Optional)</span>
        </label>
        <input
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className={cn(
            'w-full p-4 rounded-xl border-2 transition-all duration-200',
            'bg-white dark:bg-neutral-900',
            'border-neutral-200 dark:border-neutral-800',
            'focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none',
            'text-neutral-900 dark:text-white'
          )}
        />
        <p className="text-xs text-neutral-500">
          This helps us provide age-appropriate financial guidance
        </p>
      </div>

      {/* Submit Button */}
      <motion.button
        type="submit"
        disabled={!isValid || isSubmitting}
        className={cn(
          'w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200',
          'bg-gradient-to-r from-emerald-500 to-emerald-600',
          'hover:from-emerald-600 hover:to-emerald-700',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30',
          'focus:outline-none focus:ring-4 focus:ring-emerald-500/30'
        )}
        whileHover={isValid && !isSubmitting ? { scale: 1.02 } : {}}
        whileTap={isValid && !isSubmitting ? { scale: 0.98 } : {}}
      >
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <motion.span
              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            Saving...
          </span>
        ) : (
          'Continue'
        )}
      </motion.button>
    </motion.form>
  );
}
