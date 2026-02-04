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
};

/**
 * API Client for making authenticated requests
 */
class ApiClient {
  private baseUrl: string;
  private getToken: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
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

    if (!response.ok) {
      throw new ApiError(
        responseData?.message || `Request failed with status ${response.status}`,
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
