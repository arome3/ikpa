'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/hooks/useSharkChat';

interface ChatBubbleProps {
  message: ChatMessage;
}

/**
 * Render lightweight markdown for AI messages:
 * **bold**, - bullets, 1. numbered lists, \n line breaks
 * User messages render as plain text.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (!listItems) return;
    if (listItems.type === 'ul') {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-0.5 my-1.5">
          {listItems.items.map((item, i) => (
            <li key={i} className="text-slate-200">{item}</li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ol key={`list-${elements.length}`} className="list-decimal list-inside space-y-0.5 my-1.5">
          {listItems.items.map((item, i) => (
            <li key={i} className="text-slate-200">{item}</li>
          ))}
        </ol>
      );
    }
    listItems = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Unordered list: "- item" or "• item"
    const ulMatch = line.match(/^\s*[-•]\s+(.+)$/);
    if (ulMatch) {
      if (!listItems || listItems.type !== 'ul') {
        flushList();
        listItems = { type: 'ul', items: [] };
      }
      listItems.items.push(renderInline(ulMatch[1]));
      continue;
    }

    // Ordered list: "1. item", "2. item"
    const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!listItems || listItems.type !== 'ol') {
        flushList();
        listItems = { type: 'ol', items: [] };
      }
      listItems.items.push(renderInline(olMatch[1]));
      continue;
    }

    // Not a list item — flush any pending list
    flushList();

    // Empty line → spacing
    if (line.trim() === '') {
      elements.push(<br key={`br-${i}`} />);
      continue;
    }

    // Regular paragraph line
    elements.push(
      <span key={`line-${i}`}>
        {i > 0 && elements.length > 0 && lines[i - 1].trim() !== '' && <br />}
        {renderInline(line)}
      </span>
    );
  }

  flushList();
  return elements;
}

/** Render inline markdown: **bold** */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div
        className={cn(
          'max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
          isUser
            ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-50 rounded-tr-sm'
            : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-sm',
        )}
      >
        {isUser ? message.content : renderMarkdown(message.content)}
      </div>
    </motion.div>
  );
}
