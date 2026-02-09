'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertCircle, Check } from 'lucide-react';
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

const passwordRules = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number', test: (p: string) => /\d/.test(p) },
];

export default function SignUpPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const allRulesPassed = passwordRules.every((r) => r.test(password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!allRulesPassed) {
      setError('Please meet all password requirements');
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiClient.post<AuthResponse>('/auth/register', { name, email, password });
      const data =
        (res as unknown as AuthResponse).data ?? (res as unknown as AuthResponse['data']);
      const user = data.user ?? (data as unknown as AuthResponse['data']['user']);
      const token = data.accessToken ?? (res as unknown as AuthResponse).data?.accessToken;

      login(token, {
        id: user.id,
        email: user.email,
        name: user.name,
        currency: user.currency ?? 'USD',
        onboardingCompleted: false,
        createdAt: new Date().toISOString(),
      });

      if (data.refreshToken) {
        localStorage.setItem('ikpa-refresh-token', data.refreshToken);
      }

      router.push('/verify-email?registered=true');
    } catch (err: unknown) {
      const apiErr = err as {
        data?: { error?: { message?: string; details?: { errors?: string[] } } };
        message?: string;
      };
      const details = apiErr?.data?.error?.details?.errors;
      setError(
        details?.join('. ') ||
          apiErr?.data?.error?.message ||
          apiErr?.message ||
          'Registration failed',
      );
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
          <h1 className="font-serif text-3xl font-bold text-gray-900 tracking-tight">
            Create your account
          </h1>
          <p className="text-gray-500 mt-2">Start your journey to financial freedom</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-3.5 rounded-md bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              autoComplete="name"
              minLength={2}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#064E3B] focus:ring-2 focus:ring-[#064E3B]/20 transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#064E3B] focus:ring-2 focus:ring-[#064E3B]/20 transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                required
                autoComplete="new-password"
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

            {/* Password strength indicators */}
            {password.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {passwordRules.map((rule) => {
                  const passed = rule.test(password);
                  return (
                    <div key={rule.label} className="flex items-center gap-1.5">
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${passed ? 'bg-[#064E3B]' : 'bg-gray-200'}`}
                      >
                        {passed && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className={`text-xs ${passed ? 'text-[#064E3B]' : 'text-gray-400'}`}>
                        {rule.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !name || !email || !allRulesPassed}
            className="w-full h-12 rounded-md font-semibold text-white bg-[#064E3B] hover:bg-[#053F30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Create account'
            )}
          </button>
        </form>

        {/* Terms */}
        <p className="mt-5 text-xs text-center text-gray-500 leading-relaxed">
          By creating an account, you agree to our{' '}
          <Link
            href="/terms"
            className="text-gray-600 hover:text-[#064E3B] transition-colors underline underline-offset-2"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            className="text-gray-600 hover:text-[#064E3B] transition-colors underline underline-offset-2"
          >
            Privacy Policy
          </Link>
        </p>

        {/* Sign in link */}
        <p className="text-center mt-6 text-sm text-gray-500">
          Already have an account?{' '}
          <Link
            href="/signin"
            className="text-[#064E3B] hover:underline font-medium transition-colors"
          >
            Sign in
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
