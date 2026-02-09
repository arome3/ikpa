'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Wallet,
  Navigation,
  Target,
  Fish,
  Clock,
  ShieldCheck,
  Gauge,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SidebarProps {
  className?: string;
}

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home, exact: true },
  { href: '/dashboard/expenses', label: 'Spending', icon: Wallet },
  { href: '/dashboard/gps', label: 'GPS', icon: Navigation },
  { href: '/dashboard/finance/goals', label: 'Goals', icon: Target },
  { href: '/dashboard/shark', label: 'Shark', icon: Fish },
  { href: '/dashboard/future-self', label: 'Future Self', icon: Clock },
  { href: '/dashboard/commitments', label: 'Stakes', icon: ShieldCheck },
  // { href: '/dashboard/opik', label: 'Opik', icon: Gauge },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

/**
 * Fixed left sidebar for desktop navigation.
 * Hidden on mobile — BottomNav handles mobile navigation.
 */
export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 w-64',
        'hidden md:flex flex-col',
        'bg-[#FDFCF8]/90 backdrop-blur-sm',
        'border-r border-stone-200/60',
        className
      )}
    >
      {/* Brand */}
      <div className="px-6 py-6">
        <Link href="/dashboard" className="block">
          <span className="font-serif text-xl text-[#1A2E22] tracking-tight">
            Ikpa
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto" aria-label="Sidebar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg',
                'font-serif text-sm transition-colors duration-150',
                isActive
                  ? 'text-green-900 bg-stone-100/50 border-l-2 border-green-800 -ml-px'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom spacer */}
      <div className="px-6 py-4" />
    </aside>
  );
}
