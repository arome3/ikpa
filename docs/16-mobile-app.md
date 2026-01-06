# Mobile App

## Overview

This document covers Ikpa's React Native mobile application built with Expo. The app is the primary interface for users, featuring native-feeling navigation, offline support, and real-time synchronization. It follows a mobile-first design optimized for the African smartphone market.

---

## Technical Specifications

### Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React Native + Expo | Cross-platform mobile |
| Navigation | React Navigation v6 | Native navigation |
| State | Zustand | Global state management |
| Server State | TanStack Query | API caching & sync |
| Storage | MMKV | Fast local storage |
| Forms | React Hook Form | Form handling |
| Styling | StyleSheet + Custom Tokens | Native styling |
| Charts | Victory Native | Data visualization |
| Animation | Reanimated 3 | 60fps animations |

---

## Project Structure

```
apps/mobile/
├── app.json
├── app/
│   ├── _layout.tsx           # Root layout
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   └── (main)/
│       ├── _layout.tsx        # Tab navigation
│       ├── index.tsx          # Dashboard
│       ├── transactions.tsx   # Transactions
│       ├── ai-coach.tsx       # AI Chat
│       ├── goals.tsx          # Goals
│       └── profile.tsx        # Profile
├── src/
│   ├── components/
│   │   ├── common/
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── ai/
│   │   ├── goals/
│   │   └── future-self/
│   ├── hooks/
│   ├── stores/
│   ├── services/
│   ├── utils/
│   ├── types/
│   └── theme/
├── assets/
└── package.json
```

---

## App Configuration

### app.json

```json
{
  "expo": {
    "name": "Ikpa",
    "slug": "ikpa",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#10B981"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.ikpa.app",
      "buildNumber": "1"
    },
    "android": {
      "package": "com.ikpa.app",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#10B981"
      }
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-font",
        {
          "fonts": ["./assets/fonts/Inter.ttf", "./assets/fonts/JetBrainsMono.ttf"]
        }
      ]
    ],
    "extra": {
      "apiUrl": "https://api.ikpa.app",
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}
```

### package.json

```json
{
  "name": "@ikpa/mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "build:android": "eas build -p android",
    "build:ios": "eas build -p ios"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.17.0",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/bottom-tabs": "^6.5.11",
    "expo": "~50.0.0",
    "expo-router": "~3.4.0",
    "expo-secure-store": "~12.8.0",
    "expo-haptics": "~12.8.0",
    "react": "18.2.0",
    "react-native": "0.73.0",
    "react-native-mmkv": "^2.11.0",
    "react-native-reanimated": "~3.6.0",
    "react-native-gesture-handler": "~2.14.0",
    "react-native-safe-area-context": "4.8.2",
    "react-hook-form": "^7.49.0",
    "zustand": "^4.4.7",
    "victory-native": "^37.0.0",
    "lucide-react-native": "^0.303.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@types/react": "~18.2.0",
    "typescript": "^5.3.0"
  }
}
```

---

## Navigation Structure

### Root Layout

```tsx
// apps/mobile/app/_layout.tsx

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/auth.store';
import { ThemeProvider } from '../src/theme/ThemeProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const { initialize, isLoading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  if (isLoading) {
    return null; // Or splash screen
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(main)" />
            </Stack>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

### Tab Navigation

```tsx
// apps/mobile/app/(main)/_layout.tsx

import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import {
  Home,
  CreditCard,
  MessageSquare,
  Target,
  User,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme/useTheme';

export default function MainLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: theme.colors.primary[500],
        tabBarInactiveTintColor: theme.colors.gray[400],
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Money',
          tabBarIcon: ({ color, size }) => <CreditCard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ai-coach"
        options={{
          title: 'Coach',
          tabBarIcon: ({ color, size }) => (
            <View style={styles.centerTab}>
              <MessageSquare color="white" size={size} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Goals',
          tabBarIcon: ({ color, size }) => <Target color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 0,
    elevation: 0,
    height: 84,
    paddingTop: 8,
    paddingBottom: 24,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  centerTab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
```

---

## State Management

### Auth Store

```typescript
// apps/mobile/src/stores/auth.store.ts

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../services/auth.service';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      if (accessToken && refreshToken) {
        // Validate token and get user
        const user = await authService.getMe(accessToken);
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      // Token expired, try refresh
      try {
        await get().refreshTokens();
      } catch {
        set({ isLoading: false });
      }
    }
  },

  login: async (email: string, password: string) => {
    const response = await authService.login(email, password);

    await SecureStore.setItemAsync('accessToken', response.accessToken);
    await SecureStore.setItemAsync('refreshToken', response.refreshToken);

    set({
      user: response.user,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      isAuthenticated: true,
    });
  },

  register: async (data: RegisterData) => {
    const response = await authService.register(data);

    await SecureStore.setItemAsync('accessToken', response.accessToken);
    await SecureStore.setItemAsync('refreshToken', response.refreshToken);

    set({
      user: response.user,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  refreshTokens: async () => {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');

    const response = await authService.refresh(refreshToken);

    await SecureStore.setItemAsync('accessToken', response.accessToken);
    await SecureStore.setItemAsync('refreshToken', response.refreshToken);

    set({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });
  },
}));
```

### Finance Store

```typescript
// apps/mobile/src/stores/finance.store.ts

import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

interface FinanceState {
  // Quick access data (cached)
  metrics: FinancialMetrics | null;
  recentTransactions: Transaction[];
  activeGoals: Goal[];

  // UI state
  selectedPeriod: 'week' | 'month' | 'year';
  selectedCurrency: Currency;

  // Actions
  setMetrics: (metrics: FinancialMetrics) => void;
  setRecentTransactions: (transactions: Transaction[]) => void;
  setActiveGoals: (goals: Goal[]) => void;
  setSelectedPeriod: (period: 'week' | 'month' | 'year') => void;
  hydrate: () => void;
}

export const useFinanceStore = create<FinanceState>((set) => ({
  metrics: null,
  recentTransactions: [],
  activeGoals: [],
  selectedPeriod: 'month',
  selectedCurrency: 'NGN',

  setMetrics: (metrics) => {
    storage.set('metrics', JSON.stringify(metrics));
    set({ metrics });
  },

  setRecentTransactions: (transactions) => {
    storage.set('recentTransactions', JSON.stringify(transactions));
    set({ recentTransactions: transactions });
  },

  setActiveGoals: (goals) => {
    storage.set('activeGoals', JSON.stringify(goals));
    set({ activeGoals: goals });
  },

  setSelectedPeriod: (period) => set({ selectedPeriod: period }),

  hydrate: () => {
    const metrics = storage.getString('metrics');
    const transactions = storage.getString('recentTransactions');
    const goals = storage.getString('activeGoals');

    set({
      metrics: metrics ? JSON.parse(metrics) : null,
      recentTransactions: transactions ? JSON.parse(transactions) : [],
      activeGoals: goals ? JSON.parse(goals) : [],
    });
  },
}));
```

---

## API Hooks

### useMetrics Hook

```typescript
// apps/mobile/src/hooks/useMetrics.ts

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api.client';
import { useFinanceStore } from '../stores/finance.store';

export function useMetrics() {
  const setMetrics = useFinanceStore((state) => state.setMetrics);

  return useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const response = await apiClient.get('/metrics');
      return response.data;
    },
    onSuccess: (data) => {
      setMetrics(data);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

### useTransactions Hook

```typescript
// apps/mobile/src/hooks/useTransactions.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api.client';

export function useExpenses(params?: ExpenseQueryParams) {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: async () => {
      const response = await apiClient.get('/expenses', { params });
      return response.data;
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateExpenseDto) => {
      const response = await apiClient.post('/expenses', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });
}

export function useIncome(params?: IncomeQueryParams) {
  return useQuery({
    queryKey: ['income', params],
    queryFn: async () => {
      const response = await apiClient.get('/income', { params });
      return response.data;
    },
  });
}
```

### useAIChat Hook

```typescript
// apps/mobile/src/hooks/useAIChat.ts

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/api.client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiClient.post('/ai/ask', {
        message,
        conversationHistory: messages.slice(-10), // Last 10 messages
      });
      return response.data;
    },
    onMutate: (message) => {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    },
    onError: () => {
      setIsTyping(false);
    },
  });

  const send = useCallback(
    (message: string) => {
      if (message.trim()) {
        sendMutation.mutate(message);
      }
    },
    [sendMutation],
  );

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isTyping,
    send,
    clear,
    isLoading: sendMutation.isPending,
  };
}
```

---

## Screen Implementations

### Dashboard Screen

```tsx
// apps/mobile/app/(main)/index.tsx

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useMetrics } from '../../src/hooks/useMetrics';
import { useExpenses } from '../../src/hooks/useTransactions';
import { CashFlowScoreCard } from '../../src/components/dashboard/CashFlowScoreCard';
import { QuickStats } from '../../src/components/dashboard/QuickStats';
import { RecentTransactions } from '../../src/components/dashboard/RecentTransactions';
import { GoalsPreview } from '../../src/components/dashboard/GoalsPreview';
import { FutureSelfPreview } from '../../src/components/dashboard/FutureSelfPreview';
import { useAuthStore } from '../../src/stores/auth.store';

export default function DashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const { data: metrics, isLoading, refetch } = useMetrics();
  const { data: expenses } = useExpenses({ limit: 5 });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {getGreeting()}, {user?.firstName} 👋
          </Text>
          <Text style={styles.date}>{formatDate(new Date())}</Text>
        </View>
      </View>

      {/* Cash Flow Score */}
      <CashFlowScoreCard
        score={metrics?.cashFlowScore ?? 0}
        trend={metrics?.scoreTrend}
      />

      {/* Quick Stats */}
      <QuickStats
        income={metrics?.monthlyIncome ?? 0}
        expenses={metrics?.monthlyExpenses ?? 0}
        savings={metrics?.totalSavings ?? 0}
        debt={metrics?.totalDebt ?? 0}
      />

      {/* Future Self Preview */}
      <FutureSelfPreview />

      {/* Goals Preview */}
      <GoalsPreview />

      {/* Recent Transactions */}
      <RecentTransactions transactions={expenses?.expenses ?? []} />
    </ScrollView>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  date: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
});
```

### AI Coach Screen

```tsx
// apps/mobile/app/(main)/ai-coach.tsx

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Send } from 'lucide-react-native';
import { useAIChat } from '../../src/hooks/useAIChat';
import { ChatMessage } from '../../src/components/ai/ChatMessage';
import { TypingIndicator } from '../../src/components/ai/TypingIndicator';
import { QuickActions } from '../../src/components/ai/QuickActions';

export default function AICoachScreen() {
  const { messages, isTyping, send, isLoading } = useAIChat();
  const [input, setInput] = React.useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      send(input);
      setInput('');
    }
  };

  const handleQuickAction = (action: string) => {
    send(action);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>🤖</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Ikpa Coach</Text>
          <Text style={styles.headerSubtitle}>Your AI financial advisor</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatMessage message={item} />}
        contentContainerStyle={styles.messageList}
        ListHeaderComponent={
          messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                Hi! I'm your Ikpa financial coach 👋
              </Text>
              <Text style={styles.emptyText}>
                Ask me anything about your finances, or try one of these:
              </Text>
              <QuickActions onSelect={handleQuickAction} />
            </View>
          ) : null
        }
        ListFooterComponent={isTyping ? <TypingIndicator /> : null}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask me anything..."
          placeholderTextColor="#9CA3AF"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
        />
        <Pressable
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <Send color="white" size={20} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  messageList: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
});
```

---

## API Client

```typescript
// apps/mobile/src/services/api.client.ts

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../stores/auth.store';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await useAuthStore.getState().refreshTokens();
        const newToken = await SecureStore.getItemAsync('accessToken');
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        await useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
```

---

## Key Capabilities

1. **Native Performance**: React Native with Expo for 60fps animations
2. **Offline Support**: MMKV caching for offline-first experience
3. **Secure Storage**: Expo SecureStore for tokens and sensitive data
4. **Real-time Sync**: TanStack Query for server state management
5. **Native Navigation**: Expo Router with tab and stack navigation
6. **Haptic Feedback**: Native haptics for interactions
7. **AI Chat**: Real-time conversation with streaming support

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `expo` | React Native framework |
| `expo-router` | File-based routing |
| `@tanstack/react-query` | Server state management |
| `zustand` | Client state management |
| `react-native-mmkv` | Fast local storage |
| `expo-secure-store` | Encrypted storage |
| `lucide-react-native` | Icons |

---

## Next Steps

After mobile app, proceed to:
1. [17-web-pwa.md](./17-web-pwa.md) - Next.js PWA
