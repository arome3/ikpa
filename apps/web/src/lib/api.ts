import { QueryClient } from '@tanstack/react-query';

/**
 * Global QueryClient configuration
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Custom API error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * API response wrapper type
 */
export interface ApiResponse<T> {
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

type RequestOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  _skipRefresh?: boolean; // Internal: prevent infinite refresh loops
};

// Auth callbacks — set by the auth store to avoid circular imports
let onTokenRefreshed: ((token: string) => void) | null = null;
let onAuthExpired: (() => void) | null = null;

export function setAuthCallbacks(
  callbacks: { onTokenRefreshed: (token: string) => void; onAuthExpired: () => void }
) {
  onTokenRefreshed = callbacks.onTokenRefreshed;
  onAuthExpired = callbacks.onAuthExpired;
}

// Refresh lock — ensures only one refresh happens at a time
let refreshPromise: Promise<string | null> | null = null;

/**
 * API Client for making authenticated requests
 * Includes automatic token refresh on 401
 */
class ApiClient {
  private baseUrl: string;
  private getToken: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
  }

  private async refreshToken(): Promise<string | null> {
    // If a refresh is already in progress, wait for it
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const refreshToken = typeof window !== 'undefined'
          ? localStorage.getItem('ikpa-refresh-token')
          : null;

        if (!refreshToken) return null;

        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) return null;

        const data = await response.json();
        const tokens = data?.data ?? data;

        if (tokens?.accessToken) {
          // Store new tokens
          if (tokens.refreshToken && typeof window !== 'undefined') {
            localStorage.setItem('ikpa-refresh-token', tokens.refreshToken);
          }
          onTokenRefreshed?.(tokens.accessToken);
          return tokens.accessToken;
        }
        return null;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      signal: options?.signal,
    });

    // Handle no content responses
    if (response.status === 204) {
      return undefined as T;
    }

    const responseData = await response.json().catch(() => null);

    // Auto-refresh on 401 (skip for auth endpoints and retry requests)
    if (
      response.status === 401 &&
      !options?._skipRefresh &&
      !endpoint.startsWith('/auth/')
    ) {
      const newToken = await this.refreshToken();
      if (newToken) {
        // Retry the original request with the new token
        return this.request<T>(method, endpoint, data, { ...options, _skipRefresh: true });
      }
      // Refresh failed — session is dead
      onAuthExpired?.();
      throw new ApiError('Session expired', 401, responseData);
    }

    if (!response.ok) {
      const errorMessage =
        responseData?.error?.message ||
        responseData?.message ||
        `Request failed with status ${response.status}`;
      throw new ApiError(
        errorMessage,
        response.status,
        responseData
      );
    }

    return responseData;
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', endpoint, data, options);
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', endpoint, data, options);
  }

  async patch<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', endpoint, data, options);
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }

  async upload<T>(endpoint: string, formData: FormData, options?: RequestOptions): Promise<T> {
    const token = this.getToken();

    const headers: Record<string, string> = {
      // No Content-Type — browser sets multipart boundary automatically
      ...options?.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: options?.signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const responseData = await response.json().catch(() => null);

    if (
      response.status === 401 &&
      !options?._skipRefresh &&
      !endpoint.startsWith('/auth/')
    ) {
      const newToken = await this.refreshToken();
      if (newToken) {
        return this.upload<T>(endpoint, formData, { ...options, _skipRefresh: true });
      }
      onAuthExpired?.();
      throw new ApiError('Session expired', 401, responseData);
    }

    if (!response.ok) {
      const errorMessage =
        responseData?.error?.message ||
        responseData?.message ||
        `Request failed with status ${response.status}`;
      throw new ApiError(
        errorMessage,
        response.status,
        responseData
      );
    }

    return responseData;
  }
}

/**
 * Create API client instance
 * Token getter is passed in to avoid circular dependency with auth store
 */
export function createApiClient(getToken: () => string | null): ApiClient {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
  return new ApiClient(baseUrl, getToken);
}

// Default client instance (token can be set later)
let tokenGetter: () => string | null = () => null;

export function setTokenGetter(getter: () => string | null) {
  tokenGetter = getter;
}

export const api = new Proxy({} as ApiClient, {
  get(_, prop: keyof ApiClient) {
    const client = createApiClient(tokenGetter);
    return client[prop].bind(client);
  },
});

// Alias for backward compatibility
export const apiClient = api;
