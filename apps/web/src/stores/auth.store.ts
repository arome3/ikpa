import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { setTokenGetter, setAuthCallbacks } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  currency?: string;
  onboardingCompleted: boolean;
  createdAt: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      // State
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: true,

      // Actions
      login: (token: string, user: User) => {
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setUser: (user: User) => {
        set({ user });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'ikpa-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Set loading to false after hydration
        state?.setLoading(false);
      },
    }
  )
);

// Connect auth store to API client
setTokenGetter(() => useAuthStore.getState().token);

// Register auth callbacks for automatic token refresh
setAuthCallbacks({
  onTokenRefreshed: (newToken: string) => {
    useAuthStore.setState({ token: newToken });
  },
  onAuthExpired: () => {
    useAuthStore.getState().logout();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ikpa-refresh-token');
      window.location.href = '/signin';
    }
  },
});

// Selectors for common use cases
export const selectUser = (state: AuthStore) => state.user;
export const selectIsAuthenticated = (state: AuthStore) => state.isAuthenticated;
export const selectIsLoading = (state: AuthStore) => state.isLoading;
