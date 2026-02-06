'use client';

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api';
import type { SwipeAction } from './useShark';

// ============================================
// TYPES
// ============================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatMeta {
  quickReplies: string[];
  isDecisionPoint: boolean;
  recommendation: 'KEEP' | 'CANCEL' | null;
}

export type ChatPhase = 'idle' | 'loading' | 'chatting' | 'deciding' | 'decided';
export type ChatMode = 'advisor' | 'roast' | 'supportive';

export interface SessionContext {
  cancelledNames: string[];
  cancelledTotal: number;
  keptNames: string[];
  remainingCount: number;
}

interface ChatApiResponse {
  reply: string;
  quickReplies?: string[];
  isDecisionPoint: boolean;
  recommendation?: 'KEEP' | 'CANCEL' | null;
}

function unwrap<T>(res: unknown): T {
  const r = res as { success?: boolean; data?: T };
  return (r?.data ?? res) as T;
}

let messageIdCounter = 0;
function nextId(): string {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

// ============================================
// HOOK
// ============================================

export function useSharkChat() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [mode, setMode] = useState<ChatMode>('advisor');

  // Track current subscription ID and session context
  const subscriptionIdRef = useRef<string | null>(null);
  const sessionContextRef = useRef<SessionContext | undefined>(undefined);

  /**
   * Update session context (call from review page to track decisions)
   */
  const updateSessionContext = useCallback((ctx: SessionContext) => {
    sessionContextRef.current = ctx;
  }, []);

  /**
   * Send messages to the chat endpoint and process the response
   */
  const sendToApi = useCallback(
    async (
      subId: string,
      history: { role: 'user' | 'assistant'; content: string }[],
    ): Promise<ChatApiResponse> => {
      const res = await apiClient.post(`/shark/subscriptions/${subId}/chat`, {
        messages: history,
        mode,
        sessionContext: sessionContextRef.current,
      });
      return unwrap<ChatApiResponse>(res);
    },
    [mode],
  );

  /**
   * Start a chat for a subscription — gets the AI's opening message
   */
  const startChat = useCallback(
    async (subscriptionId: string) => {
      subscriptionIdRef.current = subscriptionId;
      setMessages([]);
      setMeta(null);
      setError(null);
      setPhase('loading');
      setIsSending(true);

      try {
        const response = await sendToApi(subscriptionId, []);

        const aiMessage: ChatMessage = {
          id: nextId(),
          role: 'assistant',
          content: response.reply,
          timestamp: new Date(),
        };

        setMessages([aiMessage]);
        setMeta({
          quickReplies: response.quickReplies ?? [],
          isDecisionPoint: response.isDecisionPoint,
          recommendation: response.recommendation ?? null,
        });
        setPhase(response.isDecisionPoint ? 'deciding' : 'chatting');
      } catch (err) {
        setError(err instanceof ApiError ? err : new ApiError('Chat failed', 500));
        setPhase('chatting');
      } finally {
        setIsSending(false);
      }
    },
    [sendToApi],
  );

  /**
   * Send a user message and get AI response
   */
  const sendMessage = useCallback(
    async (text: string) => {
      const subId = subscriptionIdRef.current;
      if (!subId || !text.trim()) return;

      setError(null);
      setIsSending(true);

      // Optimistically append user message
      const userMessage: ChatMessage = {
        id: nextId(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      try {
        // Send full history (excluding IDs/timestamps — API only needs role+content)
        const history = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await sendToApi(subId, history);

        const aiMessage: ChatMessage = {
          id: nextId(),
          role: 'assistant',
          content: response.reply,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMessage]);
        setMeta({
          quickReplies: response.quickReplies ?? [],
          isDecisionPoint: response.isDecisionPoint,
          recommendation: response.recommendation ?? null,
        });

        if (response.isDecisionPoint) {
          setPhase('deciding');
        }
      } catch (err) {
        setError(err instanceof ApiError ? err : new ApiError('Chat failed', 500));
      } finally {
        setIsSending(false);
      }
    },
    [messages, sendToApi],
  );

  /**
   * Record the keep/cancel decision using the existing swipe endpoint
   */
  const recordDecision = useCallback(
    async (action: SwipeAction) => {
      const subId = subscriptionIdRef.current;
      if (!subId) return;

      try {
        await apiClient.post('/shark/swipe', {
          subscriptionId: subId,
          action,
        });
        setPhase('decided');
        // Invalidate subscription caches so lists/summary update
        queryClient.invalidateQueries({ queryKey: ['shark', 'subscriptions'] });
      } catch (err) {
        const apiErr = err instanceof ApiError ? err : new ApiError('Decision failed', 500);
        setError(apiErr);
        throw apiErr; // Re-throw so caller knows the decision failed
      }
    },
    [queryClient],
  );

  /**
   * Force the chat into 'deciding' phase — escape hatch when AI
   * never sets isDecisionPoint: true
   */
  const forceDeciding = useCallback(() => {
    if (phase === 'chatting') {
      setPhase('deciding');
    }
  }, [phase]);

  /**
   * Reset chat state for next subscription
   */
  const reset = useCallback(() => {
    subscriptionIdRef.current = null;
    setMessages([]);
    setPhase('idle');
    setMeta(null);
    setIsSending(false);
    setError(null);
  }, []);

  return {
    messages,
    phase,
    meta,
    isSending,
    error,
    mode,
    setMode,
    startChat,
    sendMessage,
    recordDecision,
    forceDeciding,
    reset,
    updateSessionContext,
  };
}
