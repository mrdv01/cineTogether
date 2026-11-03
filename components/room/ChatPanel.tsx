'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage } from '@/types';
import { EMOJI_REACTIONS } from '@/types';
import { formatChatTime } from '@/lib/utils';

interface ChatPanelProps {
  messages: ChatMessage[];
  role: 'host' | 'guest';
  hostName: string;
  guestName: string;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
}

export function ChatPanel({
  messages,
  role,
  hostName,
  guestName,
  onSendMessage,
  onSendReaction,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesRef.current;
    container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    onSendMessage(text);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const myName = role === 'host' ? hostName : guestName;

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.2)' }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2 sm:px-4 sm:py-3"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <span className="text-sm font-semibold" style={{ color: '#f1f0ff' }}>
            Movie Chat
          </span>
        </div>
        <span className="text-xs" style={{ color: '#6b7280' }}>
          {messages.length} messages
        </span>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 mt-8 opacity-50">
            <span className="text-3xl">🌙</span>
            <p className="text-xs text-center" style={{ color: '#6b7280' }}>
              Chat with each other while watching!
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.sender === role;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}
              >
                <span className="max-w-full break-words px-1 text-xs [overflow-wrap:anywhere]" style={{ color: '#6b7280' }}>
                  {msg.senderName}
                </span>
                <div
                  className="min-w-0 max-w-[90%] px-3 py-2 rounded-2xl text-sm leading-relaxed [overflow-wrap:anywhere] sm:max-w-[85%]"
                  style={{
                    background: isMe
                      ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.6), rgba(168, 85, 247, 0.4))'
                      : 'rgba(255,255,255,0.07)',
                    border: isMe
                      ? '1px solid rgba(168, 85, 247, 0.3)'
                      : '1px solid rgba(255,255,255,0.08)',
                    color: '#f1f0ff',
                    borderRadius: isMe
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                  }}
                >
                  {msg.text}
                </div>
                <span className="text-xs px-1" style={{ color: '#4b5563' }}>
                  {formatChatTime(msg.timestamp)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Emoji reactions */}
      <div
        className="flex shrink-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain px-3 py-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        {EMOJI_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            id={`reaction-${emoji}`}
            onClick={() => onSendReaction(emoji)}
            className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl text-xl transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-purple-400"
            style={{ background: 'rgba(255,255,255,0.05)' }}
            title={`Send ${emoji}`}
            aria-label={`Send ${emoji} reaction`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input */}
      <div
        className="flex shrink-0 gap-2 px-3 pt-2"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message as ${myName}...`}
          maxLength={500}
          aria-label={`Message as ${myName}`}
          className="min-h-11 min-w-0 flex-1 rounded-xl px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-purple-400 sm:text-sm"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#f1f0ff',
          }}
        />
        <button
          id="chat-send-btn"
          onClick={handleSend}
          disabled={!input.trim()}
          aria-label="Send message"
          className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl transition-all disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-purple-400"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          }}
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
