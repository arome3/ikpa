'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck } from 'lucide-react';
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
            <li key={i} className="text-stone-700">{item}</li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ol key={`list-${elements.length}`} className="list-decimal list-inside space-y-0.5 my-1.5">
          {listItems.items.map((item, i) => (
            <li key={i} className="text-stone-700">{item}</li>
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

/** Render inline markdown: **bold** and $X,XXX dollar highlights */
function renderInline(text: string): React.ReactNode {
  // First pass: split on **bold**
  const boldParts = text.split(/(\*\*.*?\*\*)/);
  return boldParts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-[#1A2E22]">
          {highlightDollars(part.slice(2, -2), `b${i}`)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{highlightDollars(part, `t${i}`)}</React.Fragment>;
  });
}

/** Wrap $X,XXX amounts in monospace emerald */
function highlightDollars(text: string, keyPrefix: string): React.ReactNode {
  const dollarPattern = /(\$[\d,]+(?:\.\d{2})?)/g;
  const parts = text.split(dollarPattern);
  if (parts.length === 1) return text;
  return parts.map((seg, j) => {
    if (dollarPattern.test(seg)) {
      // Reset regex lastIndex since we reuse it
      dollarPattern.lastIndex = 0;
      return (
        <span key={`${keyPrefix}-${j}`} className="font-mono font-semibold text-[#064E3B]">
          {seg}
        </span>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${j}`}>{seg}</React.Fragment>;
  });
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <motion.div
        className="max-w-2xl mx-auto my-4 flex justify-end"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div className="max-w-[70%] px-5 py-3 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-600 font-sans italic">
          {message.content}
        </div>
      </motion.div>
    );
  }

  // AI message — "Analyst Briefing Note"
  return (
    <motion.div
      className="max-w-2xl mx-auto my-6"
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="relative bg-white border border-stone-200 rounded-lg p-6 md:p-8 shadow-sm">
        {/* Stamp icon */}
        <ClipboardCheck className="absolute top-4 left-4 w-5 h-5 text-stone-200" />
        {/* Body */}
        <div className="pl-8 font-serif text-lg leading-relaxed text-stone-800">
          {renderMarkdown(message.content)}
        </div>
      </div>
    </motion.div>
  );
}
