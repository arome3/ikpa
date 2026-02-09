'use client';

import { useEffect, useRef } from 'react';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import type { ChatMessage } from '@/hooks/useSharkChat';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
}

export function ChatMessageList({ messages, isTyping }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-0 py-6 space-y-2 scrollbar-thin scrollbar-thumb-stone-200">
      {messages.map((msg) => (
        <ChatBubble key={msg.id} message={msg} />
      ))}
      {isTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
