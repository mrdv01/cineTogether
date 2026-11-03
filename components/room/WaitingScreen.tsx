'use client';

import { motion } from 'framer-motion';
import { Copy, MessageCircle, Wifi, Clock } from 'lucide-react';
import { useState } from 'react';
import { getWhatsAppShareUrl } from '@/lib/utils';

interface WaitingScreenProps {
  hostName: string;
  guestName: string;
  guestUrl: string;
  role: 'host' | 'guest';
}

export function WaitingScreen({ hostName, guestName, guestUrl, role }: WaitingScreenProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(guestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(124, 58, 237, 0.12) 0%, transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 my-auto flex w-full min-w-0 max-w-md flex-col items-center gap-6 text-center sm:gap-8"
      >
        {/* Animated cinema icon */}
        <div className="relative">
          <motion.div
            className="text-6xl sm:text-8xl"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            🎬
          </motion.div>
          <motion.div
            className="absolute -top-2 -right-2 text-2xl"
            animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            ✨
          </motion.div>
        </div>

        {/* Title */}
        <div className="w-full space-y-3 break-words">
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-semibold gradient-text"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {role === 'host' ? 'Your Cinema is Ready' : 'Joining the Cinema...'}
          </h1>
          <p className="text-base sm:text-lg" style={{ color: '#9ca3af' }}>
            {role === 'host' ? (
              <>
                Waiting for <span style={{ color: '#f472b6' }}>{guestName}</span> to arrive...
              </>
            ) : (
              <>
                Getting connected with <span style={{ color: '#c4b5fd' }}>{hostName}</span>...
              </>
            )}
          </p>
        </div>

        {/* Waiting animation */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: i === 1 ? '#f472b6' : '#a855f7' }}
              animate={{ y: [0, -8, 0] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>

        {/* Connection status */}
        <div
          className="glass flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl px-4 py-3 sm:rounded-full"
          style={{ border: '1px solid rgba(168, 85, 247, 0.2)' }}
        >
          <Wifi className="w-4 h-4 text-purple-400" />
          <span className="text-sm" style={{ color: '#c4b5fd' }}>
            Connected to room
          </span>
          <Clock className="w-4 h-4 text-pink-400" />
          <span className="text-sm" style={{ color: '#f472b6' }}>
            Expires in 8h
          </span>
        </div>

        {/* Share section - host only */}
        {role === 'host' && guestUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="glass w-full min-w-0 rounded-2xl p-4 sm:p-5"
            style={{ border: '1px solid rgba(168, 85, 247, 0.25)' }}
          >
            <p className="text-sm font-medium mb-3 break-words" style={{ color: '#c4b5fd' }}>
              🎟️ Share invitation with {guestName}
            </p>
            <div
              className="rounded-xl p-3 mb-4 text-xs break-all select-all"
              style={{ background: 'rgba(0,0,0,0.3)', color: '#9ca3af', fontFamily: 'monospace' }}
            >
              {guestUrl}
            </div>
            <div className="flex flex-col gap-3 min-[360px]:flex-row">
              <button
                id="waiting-copy-btn"
                onClick={handleCopy}
                className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400"
                style={{
                  background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                  border: `1px solid ${copied ? 'rgba(16, 185, 129, 0.4)' : 'rgba(168, 85, 247, 0.4)'}`,
                  color: '#fff',
                }}
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <a
                id="waiting-whatsapp-btn"
                href={getWhatsAppShareUrl(guestUrl, guestName)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400"
                style={{
                  background: 'rgba(37, 211, 102, 0.12)',
                  border: '1px solid rgba(37, 211, 102, 0.3)',
                  color: '#fff',
                }}
              >
                <MessageCircle className="w-4 h-4 text-green-400" />
                WhatsApp
              </a>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
