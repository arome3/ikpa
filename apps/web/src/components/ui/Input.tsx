'use client';

import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  hint?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  currencySymbol?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      hint,
      leftAddon,
      rightAddon,
      currencySymbol,
      id: propId,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = propId || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {(leftAddon || currencySymbol) && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              {currencySymbol ? (
                <span className="text-gray-500 dark:text-gray-400 font-medium">
                  {currencySymbol}
                </span>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">{leftAddon}</span>
              )}
            </div>
          )}
          <input
            ref={ref}
            id={id}
            type={type}
            className={cn(
              // Base styles
              'w-full h-14 rounded-xl transition-all duration-200',
              'bg-white dark:bg-slate-800',
              'text-gray-900 dark:text-slate-100',
              'placeholder-gray-400 dark:placeholder-slate-400',
              // Border
              error
                ? 'border-2 border-caution-500 focus:border-caution-500 focus:ring-caution-500'
                : 'border border-gray-200 dark:border-slate-600 focus:border-primary-500 focus:ring-primary-500 dark:focus:border-primary-400 dark:focus:ring-primary-400',
              // Focus
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              // Padding
              leftAddon || currencySymbol ? 'pl-12 pr-4' : 'px-4',
              rightAddon ? 'pr-12' : '',
              // Number input - tabular nums
              type === 'number' && 'tabular-nums',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={
              error ? `${id}-error` : hint ? `${id}-hint` : undefined
            }
            {...props}
          />
          {rightAddon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
              <span className="text-gray-500 dark:text-gray-400">{rightAddon}</span>
            </div>
          )}
        </div>
        {error && (
          <p id={`${id}-error`} className="mt-1.5 text-sm text-caution-600 dark:text-caution-400">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${id}-hint`} className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea variant
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id: propId, ...props }, ref) => {
    const generatedId = useId();
    const id = propId || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={cn(
            // Base styles
            'w-full min-h-[120px] rounded-xl transition-all duration-200 resize-y',
            'bg-white dark:bg-slate-800',
            'text-gray-900 dark:text-slate-100',
            'placeholder-gray-400 dark:placeholder-slate-400',
            'px-4 py-3',
            // Border
            error
              ? 'border-2 border-caution-500 focus:border-caution-500 focus:ring-caution-500'
              : 'border border-gray-200 dark:border-slate-600 focus:border-primary-500 focus:ring-primary-500 dark:focus:border-primary-400 dark:focus:ring-primary-400',
            // Focus
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          {...props}
        />
        {error && (
          <p id={`${id}-error`} className="mt-1.5 text-sm text-caution-600 dark:text-caution-400">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${id}-hint`} className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
