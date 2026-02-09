'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Key, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface AuthResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      currency?: string;
      onboardingCompleted: boolean;
    };
    accessToken: string;
    refreshToken: string;
  };
}

export default function SignInPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
      const data =
        (res as unknown as AuthResponse).data ?? (res as unknown as AuthResponse['data']);
      const user = data.user ?? (data as unknown as AuthResponse['data']['user']);
      const token = data.accessToken ?? (res as unknown as AuthResponse).data?.accessToken;

      login(token, {
        id: user.id,
        email: user.email,
        name: user.name,
        currency: user.currency ?? 'USD',
        onboardingCompleted: user.onboardingCompleted ?? false,
        createdAt: new Date().toISOString(),
      });

      // Store refresh token
      if (data.refreshToken) {
        localStorage.setItem('ikpa-refresh-token', data.refreshToken);
      }

      router.push(user.onboardingCompleted ? '/dashboard' : '/onboarding');
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: { message?: string } }; message?: string };
      setError(apiErr?.data?.error?.message || apiErr?.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-2xl p-10 sm:p-12">
        {/* Logo */}
        <div className="text-center mb-8">
          <h2 className="font-serif text-2xl font-semibold text-gray-900 tracking-tight">Ikpa</h2>
          <p className="text-xs text-gray-400 mt-0.5">Arnen</p>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-gray-900 tracking-tight">Welcome</h1>
          <p className="text-gray-500 mt-2">Log in to your financial future</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-3.5 rounded-md bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 pr-11 bg-white border border-gray-200 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#064E3B] focus:ring-2 focus:ring-[#064E3B]/20 transition-all"
              />
              <Key className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <Link
                href="/forgot-password"
                className="text-xs font-bold text-gray-900 hover:text-[#064E3B] transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-12 bg-white border border-gray-200 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#064E3B] focus:ring-2 focus:ring-[#064E3B]/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4.5 h-4.5" />
                ) : (
                  <Eye className="w-4.5 h-4.5" />
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full h-12 rounded-md font-semibold text-white bg-[#064E3B] hover:bg-[#053F30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Continue'
            )}
          </button>
        </form>

        {/* Sign up link */}
        <p className="text-center mt-6 text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="text-[#064E3B] hover:underline font-medium transition-colors"
          >
            Sign up
          </Link>
        </p>

        {/* OR divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-4 text-gray-400">OR</span>
          </div>
        </div>

        {/* Google button */}
        <button
          type="button"
          className="w-full h-12 rounded-md font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
