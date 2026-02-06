'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, Wallet, Navigation, Target, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BottomNavProps extends React.HTMLAttributes<HTMLElement> {}

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/expenses', label: 'Spend', icon: Wallet },
  { href: '/dashboard/gps', label: 'GPS', icon: Navigation },
  { href: '/dashboard/finance/goals', label: 'Goals', icon: Target },
  { href: '/profile', label: 'Profile', icon: User },
];

/**
 * Fixed mobile bottom navigation bar
 * Hidden on desktop (md+) viewports
 */
export const BottomNav = forwardRef<HTMLElement, BottomNavProps>(
  ({ className, ...props }, ref) => {
    const pathname = usePathname();

    return (
      <nav
        ref={ref}
        className={cn(
          // Positioning
          'fixed bottom-0 left-0 right-0 z-50',
          // Glass effect
          'bg-white/80 dark:bg-slate-900/80',
          'backdrop-blur-lg border-t border-gray-200 dark:border-slate-700',
          // Safe area for iPhone notch
          'pb-safe-bottom',
          // Hide on desktop
          'md:hidden',
          className
        )}
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        }}
        role="navigation"
        aria-label="Main navigation"
        {...props}
      >
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center justify-center',
                  'w-16 h-full',
                  'transition-colors duration-200',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <motion.div
                  className="relative"
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.1 }}
                >
                  <Icon className="h-6 w-6" />

                  {/* Active indicator dot */}
                  {isActive && (
                    <motion.span
                      layoutId="bottomNavIndicator"
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-500"
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  )}
                </motion.div>

                <span
                  className={cn(
                    'text-xs mt-1 font-medium',
                    isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }
);

BottomNav.displayName = 'BottomNav';
