'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'amber';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  // Ikpa Emerald - Primary action buttons
  primary: 'bg-emerald-500 text-white hover:bg-emerald-600 focus-visible:ring-emerald-500',
  // Emerald secondary - lighter background
  secondary: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 focus-visible:ring-emerald-400',
  // Outline with emerald accent
  outline: 'border border-neutral-300 text-neutral-900 bg-transparent hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 focus-visible:ring-emerald-400',
  // Ghost - subtle hover
  ghost: 'text-neutral-600 hover:text-emerald-600 hover:bg-emerald-50 focus-visible:ring-emerald-400',
  // Amber - celebration/premium CTAs
  amber: 'bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-500',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth, className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center font-medium rounded-lg
          transition-all duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
