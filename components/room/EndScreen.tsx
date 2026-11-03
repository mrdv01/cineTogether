'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface EndScreenProps {
  hostName: string;
  guestName: string;
  role: 'host' | 'guest';
  onReplay: () => void;
}

const FLOATING_ITEMS = ['❤️', '💜', '🌙', '⭐', '✨', '🎬', '🍿', '💫'];

export function EndScreen({ hostName, guestName, role, onReplay }: EndScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto overscroll-contain px-4 py-8 text-center sm:px-6 sm:py-12"
      style={{ background: 'rgba(7,7,26,0.97)' }}
    >
      {/* Floating celebration items */}
      {FLOATING_ITEMS.map((item, i) => (
        <motion.span
          key={i}
          className="fixed text-2xl pointer-events-none select-none"
          style={{
            left: `${10 + i * 11}%`,
            bottom: '-10%',
          }}
          animate={{ y: ['0vh', '-120vh'], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 4 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.3,
            ease: 'easeOut',
          }}
        >
          {item}
        </motion.span>
      ))}

      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative my-auto flex w-full min-w-0 max-w-md shrink-0 flex-col items-center gap-6 sm:gap-8"
      >
        {/* Icon */}
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="text-6xl sm:text-8xl"
        >
          🎬
        </motion.div>

        {/* Title */}
        <div className="w-full space-y-4 break-words">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold gradient-text"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            The End
          </h1>
          <p className="text-xl" style={{ color: '#f1f0ff' }}>
            What a beautiful night! 🌙
          </p>
          <p className="text-base leading-relaxed" style={{ color: '#9ca3af' }}>
            Hope you and{' '}
            <span style={{ color: '#f472b6' }}>
              {role === 'host' ? guestName : hostName}
            </span>{' '}
            loved every moment of it together. ❤️
          </p>
          <p
            className="text-lg italic"
            style={{ fontFamily: "'Playfair Display', serif", color: '#c4b5fd' }}
          >
            &ldquo;Distance means so little when someone means so much.&rdquo;
          </p>
        </div>

        {/* Actions */}
        <div className="flex w-full flex-col gap-3 min-[360px]:flex-row sm:gap-4">
          <motion.button
            id="replay-btn"
            onClick={onReplay}
            className="min-h-11 flex-1 rounded-xl px-4 py-3 text-sm font-medium text-white touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              boxShadow: '0 0 24px rgba(168, 85, 247, 0.4)',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            🔄 Watch Again
          </motion.button>
          <Link
            id="go-home-btn"
            href="/"
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 py-3 text-sm font-medium touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#c4b5fd',
            }}
          >
            🏠 Home
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
