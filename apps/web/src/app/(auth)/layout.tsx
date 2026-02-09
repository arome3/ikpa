'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCF8]">
        <div className="w-8 h-8 border-2 border-[#064E3B]/30 border-t-[#064E3B] rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#FDFCF8] relative overflow-hidden">
      {/* Architectural line art */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMinYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="-60"
          y="120"
          width="380"
          height="260"
          rx="4"
          transform="rotate(-12 -60 120)"
          stroke="#E8F0E8"
          strokeWidth="14"
        />
        <rect
          x="80"
          y="-40"
          width="300"
          height="480"
          rx="4"
          transform="rotate(8 80 -40)"
          stroke="#E8F0E8"
          strokeWidth="18"
        />
        <rect
          x="-120"
          y="400"
          width="440"
          height="320"
          rx="4"
          transform="rotate(-40 -120 400)"
          stroke="#E8F0E8"
          strokeWidth="16"
        />
        <rect
          x="200"
          y="300"
          width="260"
          height="400"
          rx="4"
          transform="rotate(20 200 300)"
          stroke="#E8F0E8"
          strokeWidth="22"
        />
        <rect
          x="40"
          y="600"
          width="360"
          height="280"
          rx="4"
          transform="rotate(-8 40 600)"
          stroke="#E8F0E8"
          strokeWidth="14"
        />
      </svg>

      {/* Content */}
      <main className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        {children}
      </main>
    </div>
  );
}
