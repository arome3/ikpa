'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { BottomNav, Sidebar } from '@/components/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (isLoading) return;

    // Redirect unauthenticated users to sign in
    if (!isAuthenticated) {
      router.replace('/signin');
      return;
    }

    // Redirect users who haven't completed onboarding
    if (user && !user.onboardingCompleted) {
      router.replace('/onboarding');
    }
  }, [isLoading, isAuthenticated, user, pathname, router]);

  // Show nothing while checking auth / redirecting
  if (isLoading || !isAuthenticated || (user && !user.onboardingCompleted)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FDFCF8]">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content with bottom padding for mobile nav, left offset for sidebar on desktop */}
      <main className="pb-20 md:pb-0 md:ml-64">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}
