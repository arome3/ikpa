'use client';

import { BottomNav } from '@/components/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Main content with bottom padding for nav */}
      <main className="pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}
