'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { ReactionOverlay } from '@/types';

interface EmojiReactionsProps {
  reactions: ReactionOverlay[];
  hostName: string;
  guestName: string;
}

export function EmojiReactions({ reactions, hostName, guestName }: EmojiReactionsProps) {
  return (
    <AnimatePresence>
      {reactions.map((reaction) => (
        <motion.div
          key={reaction.id}
          className="fixed pointer-events-none z-40 flex flex-col items-center gap-1 select-none"
          style={{
            // Host reactions appear on left, guest on right
            left: reaction.sender === 'host' ? '10%' : 'auto',
            right: reaction.sender === 'guest' ? '10%' : 'auto',
            bottom: '30%',
          }}
          initial={{ opacity: 0, y: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 1, 0], y: [-20, -80, -130], scale: [0.5, 1.4, 1] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.5, ease: 'easeOut' }}
        >
          <span className="text-4xl md:text-5xl drop-shadow-lg">
            {reaction.emoji}
          </span>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(0,0,0,0.5)',
              color: reaction.sender === 'host' ? '#c4b5fd' : '#f9a8d4',
              backdropFilter: 'blur(4px)',
            }}
          >
            {reaction.sender === 'host' ? hostName : guestName}
          </span>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
