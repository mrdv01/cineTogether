'use client';

import { useState, useEffect } from 'react';
import { useRoom } from '@/hooks/useRoom';
import { VideoPlayer } from '@/components/room/VideoPlayer';
import { ChatPanel } from '@/components/room/ChatPanel';
import { WaitingScreen } from '@/components/room/WaitingScreen';
import { EndScreen } from '@/components/room/EndScreen';
import { ParticipantBar } from '@/components/room/ParticipantBar';
import { EmojiReactions } from '@/components/room/EmojiReactions';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';

interface RoomClientProps {
  roomId: string;
  token: string;
  backendUrl: string;
}

export function RoomClient({ roomId, token, backendUrl }: RoomClientProps) {
  const {
    role,
    hostName,
    guestName,
    guestToken,
    partnerConnected,
    roomState,
    messages,
    reactions,
    connectionStatus,
    sendMessage,
    sendReaction,
    emitPlay,
    emitPause,
    emitSeek,
    emitHeartbeat,
    requestSync,
    onSyncPlay,
    onSyncPause,
    onSyncSeek,
    onSyncHeartbeat,
    onSyncState,
  } = useRoom({ roomId, token });

  const [showEnd, setShowEnd] = useState(false);

  // Request sync on reconnect
  useEffect(() => {
    if (connectionStatus === 'connected' && role && !showEnd) {
      requestSync();
    }
  }, [connectionStatus, role]);

  const videoSrc = `${backendUrl}/api/video/${roomId}?token=${token}`;
  const guestInviteUrl =
    role === 'host' && guestToken && typeof window !== 'undefined'
      ? `${window.location.origin}/room/${roomId}?token=${encodeURIComponent(guestToken)}`
      : '';

  // Wait until role is determined
  if (!role || connectionStatus === 'connecting') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <div
              className="w-12 h-12 rounded-full border-4 border-t-purple-500"
              style={{ borderColor: 'rgba(168,85,247,0.2)' }}
            />
          </motion.div>
          <p style={{ color: '#9ca3af' }}>Connecting to your cinema...</p>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="glass rounded-2xl p-8 max-w-md text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-semibold" style={{ color: '#f1f0ff' }}>
            Connection Failed
          </h2>
          <p style={{ color: '#9ca3af' }}>
            Could not connect to the room server. Make sure the backend is running and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-xl text-white text-sm font-medium"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show waiting screen when partner hasn't joined yet
  if (!partnerConnected) {
    return (
      <WaitingScreen
        hostName={hostName}
        guestName={guestName}
        guestUrl={guestInviteUrl}
        role={role}
      />
    );
  }

  return (
    <>
      {/* Emoji reaction overlays */}
      <EmojiReactions reactions={reactions} hostName={hostName} guestName={guestName} />

      {/* End screen */}
      <AnimatePresence>
        {showEnd && (
          <EndScreen
            hostName={hostName}
            guestName={guestName}
            role={role}
            onReplay={() => setShowEnd(false)}
          />
        )}
      </AnimatePresence>

      {/* Connection status banner */}
      <AnimatePresence>
        {connectionStatus === 'disconnected' && (
          <motion.div
            initial={{ y: -60 }}
            animate={{ y: 0 }}
            exit={{ y: -60 }}
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 text-sm"
            style={{ background: 'rgba(239, 68, 68, 0.9)', color: 'white' }}
          >
            <WifiOff className="w-4 h-4" /> Reconnecting...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main layout */}
      <div
        className="flex h-screen supports-[height:100dvh]:h-dvh min-h-0 min-w-0 flex-col overflow-hidden lg:flex-row"
        style={{
          background: '#07071a',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        }}
      >
          {/* One player tree: CSS changes layout without interrupting playback. */}
          <div className="flex min-h-0 min-w-0 shrink-0 flex-col gap-2 overflow-hidden p-2 lg:flex-1 lg:gap-4 lg:p-4 lg:pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
            {/* Header bar */}
            <div className="hidden shrink-0 items-center justify-between gap-2 lg:flex">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎬</span>
                <span
                  className="font-semibold gradient-text"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  CineTogether
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs`}
                  style={{
                    background: connectionStatus === 'connected' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: connectionStatus === 'connected' ? '#10b981' : '#ef4444',
                    border: `1px solid ${connectionStatus === 'connected' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}
                >
                  {connectionStatus === 'connected' ? (
                    <><Wifi className="w-3 h-3" /> Connected</>
                  ) : (
                    <><WifiOff className="w-3 h-3" /> Reconnecting</>
                  )}
                </div>
              </div>
            </div>

            {/* Participant bar */}
            <div className="order-2 min-w-0 shrink-0 lg:order-none">
              <ParticipantBar
                hostName={hostName}
                guestName={guestName}
                hostConnected={true}
                guestConnected={partnerConnected}
                role={role}
              />
            </div>

            {/* Video player */}
            <div className="order-1 flex h-[min(56.25vw,32dvh)] min-h-0 min-w-0 items-center lg:order-none lg:h-auto lg:flex-1 [&>div]:h-full [&>div]:max-h-full">
              <VideoPlayer
                videoSrc={videoSrc}
                role={role}
                roomState={roomState}
                onPlay={emitPlay}
                onPause={emitPause}
                onSeek={emitSeek}
                onHeartbeat={emitHeartbeat}
                onEnded={() => setShowEnd(true)}
                onSyncPlay={onSyncPlay}
                onSyncPause={onSyncPause}
                onSyncSeek={onSyncSeek}
                onSyncHeartbeat={onSyncHeartbeat}
                onSyncState={onSyncState}
              />
            </div>
          </div>

          {/* Right: Chat sidebar */}
          <div
            className="min-h-0 min-w-0 flex-1 overflow-hidden border-t border-white/[0.06] lg:h-full lg:w-80 lg:flex-none lg:border-t-0 lg:border-l"
          >
            <ChatPanel
              messages={messages}
              role={role}
              hostName={hostName}
              guestName={guestName}
              onSendMessage={sendMessage}
              onSendReaction={sendReaction}
            />
          </div>
      </div>
    </>
  );
}
