'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Copy, Check, MessageCircle } from 'lucide-react';
import { getWhatsAppShareUrl } from '@/lib/utils';

interface CreateRoomButtonProps {
  backendUrl: string;
}

interface RoomData {
  roomId: string;
  hostToken: string;
  guestToken: string;
  guestName: string;
}

export function CreateRoomButton({ backendUrl }: CreateRoomButtonProps) {
  const [loading, setLoading] = useState(false);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const guestUrl = roomData
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/room/${roomData.roomId}?token=${roomData.guestToken}`
    : '';

  async function handleCreate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${backendUrl}/api/rooms`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create room');
      const data = await res.json();
      setRoomData(data);
      // Redirect host to the room
      setTimeout(() => {
        window.location.href = `/room/${data.roomId}?token=${data.hostToken}&role=host`;
      }, 2500);
    } catch (e) {
      setError('Could not connect to server. Make sure the backend is running.');
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(guestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex min-w-0 flex-col items-center gap-6 w-full max-w-md">
      {/* Main Create Button */}
      <motion.button
        id="create-room-btn"
        onClick={handleCreate}
        disabled={loading || !!roomData}
        className="relative min-h-14 w-full rounded-2xl px-4 py-4 text-base font-semibold text-white overflow-hidden group disabled:opacity-70 sm:px-8 sm:py-5 sm:text-lg touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-400"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)',
          boxShadow: '0 0 40px rgba(168, 85, 247, 0.4)',
        }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        {/* Animated shimmer */}
        <span
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
          }}
        />
        <span className="relative flex items-center justify-center gap-2 sm:gap-3 [&>svg]:shrink-0 [&>div]:shrink-0">
          {loading ? (
            <>
              <motion.div
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
              Creating your cinema...
            </>
          ) : roomData ? (
            <>
              <Check className="w-5 h-5" />
              Room created! Redirecting...
            </>
          ) : (
            <>
              <Film className="w-5 h-5" />
              Create Movie Room
            </>
          )}
        </span>
      </motion.button>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-red-400 text-sm text-center"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Share invite card */}
      <AnimatePresence>
        {roomData && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="glass w-full min-w-0 rounded-2xl p-4 sm:p-5"
            style={{ border: '1px solid rgba(168, 85, 247, 0.3)' }}
          >
            <p className="text-lavender text-sm font-medium mb-3 text-center break-words">
              🎟️ Share this invitation with {roomData.guestName}
            </p>
            <div
              className="rounded-xl p-3 mb-4 text-xs text-muted break-all select-all"
              style={{ background: 'rgba(0,0,0,0.3)', color: '#9ca3af', fontFamily: 'monospace' }}
            >
              {guestUrl}
            </div>
            <div className="flex flex-col gap-3 min-[360px]:flex-row">
              <button
                id="copy-invite-btn"
                onClick={handleCopy}
                className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-white transition-all touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400"
                style={{
                  background: copied
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(168, 85, 247, 0.2)',
                  border: `1px solid ${copied ? 'rgba(16, 185, 129, 0.4)' : 'rgba(168, 85, 247, 0.4)'}`,
                }}
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <a
                id="whatsapp-share-btn"
                href={getWhatsAppShareUrl(guestUrl, roomData.guestName)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-white transition-all touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400"
                style={{
                  background: 'rgba(37, 211, 102, 0.15)',
                  border: '1px solid rgba(37, 211, 102, 0.3)',
                }}
              >
                <MessageCircle className="w-4 h-4 text-green-400" />
                WhatsApp
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
