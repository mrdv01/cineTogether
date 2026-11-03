'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Loader2,
} from 'lucide-react';
import { formatTime } from '@/lib/utils';
import type { SyncPlayEvent, SyncPauseEvent, SyncSeekEvent, SyncHeartbeatEvent, PlaybackState } from '@/types';

const DRIFT_THRESHOLD = 2.5; // seconds — only re-sync if drift exceeds this
const HEARTBEAT_INTERVAL = 10000; // 10 seconds

interface VideoPlayerProps {
  videoSrc: string;
  role: 'host' | 'guest';
  roomState: PlaybackState | null;
  // Host emitters
  onPlay: (currentTime: number) => void;
  onPause: (currentTime: number) => void;
  onSeek: (currentTime: number) => void;
  onHeartbeat: (currentTime: number) => void;
  onEnded: () => void;
  // Guest sync registrations
  onSyncPlay: (cb: (e: SyncPlayEvent) => void) => void;
  onSyncPause: (cb: (e: SyncPauseEvent) => void) => void;
  onSyncSeek: (cb: (e: SyncSeekEvent) => void) => void;
  onSyncHeartbeat: (cb: (e: SyncHeartbeatEvent) => void) => void;
  onSyncState: (cb: (e: PlaybackState) => void) => void;
}

export function VideoPlayer({
  videoSrc,
  role,
  roomState,
  onPlay,
  onPause,
  onSeek,
  onHeartbeat,
  onEnded,
  onSyncPlay,
  onSyncPause,
  onSyncSeek,
  onSyncHeartbeat,
  onSyncState,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSeekingRef = useRef(false);
  const isSyncing = useRef(false); // prevent event loops
  const guestShouldPlay = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSyncMsg, setShowSyncMsg] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [needsPlaybackTap, setNeedsPlaybackTap] = useState(false);

  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHost = role === 'host';

  const playGuestVideo = useCallback((video: HTMLVideoElement) => {
    // Socket events are not user gestures: mobile browsers may reject play().
    void video.play().then(() => {
      setNeedsPlaybackTap(false);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setNeedsPlaybackTap(true);
      } else if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('[Video] Guest playback failed:', error);
      }
    });
  }, []);

  function handleEnableSound() {
    const video = videoRef.current;
    if (!video) return;
    // Must run directly in the tap handler, not after a socket event or await.
    video.muted = false;
    if (video.volume === 0) video.volume = 1;
    setMuted(false);
    setVolume(video.volume);
    setSoundEnabled(true);
    if (guestShouldPlay.current) playGuestVideo(video);
    else setNeedsPlaybackTap(false);
  }

  // ─── Initial sync from room state ─────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !roomState) return;

    let targetTime = roomState.currentTime;
    if (roomState.isPlaying) {
      // Compensate for time elapsed since server sent state
      targetTime += (Date.now() - roomState.serverTime) / 1000;
    }

    video.currentTime = Math.max(0, targetTime);
    if (roomState.isPlaying && !isHost) {
      // Guest auto-plays when allowed; otherwise show a tap-to-enable action.
      guestShouldPlay.current = true;
      playGuestVideo(video);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // ─── Sync event listeners (guest) ─────────────────────────────────
  useEffect(() => {
    if (isHost) return;

    onSyncPlay(({ currentTime: ct, serverTime }) => {
      const video = videoRef.current;
      if (!video) return;
      isSyncing.current = true;
      const latency = (Date.now() - serverTime) / 1000 / 2;
      video.currentTime = ct + latency;
      guestShouldPlay.current = true;
      playGuestVideo(video);
      flashSyncMsg('▶️ Play sync');
      setTimeout(() => { isSyncing.current = false; }, 500);
    });

    onSyncPause(({ currentTime: ct }) => {
      const video = videoRef.current;
      if (!video) return;
      isSyncing.current = true;
      guestShouldPlay.current = false;
      video.pause();
      video.currentTime = ct;
      setIsPlaying(false);
      flashSyncMsg('⏸ Pause sync');
      setTimeout(() => { isSyncing.current = false; }, 500);
    });

    onSyncSeek(({ currentTime: ct }) => {
      const video = videoRef.current;
      if (!video) return;
      isSyncing.current = true;
      video.currentTime = ct;
      flashSyncMsg('⏩ Seeking...');
      setTimeout(() => { isSyncing.current = false; }, 500);
    });

    onSyncHeartbeat(({ currentTime: ct, serverTime }) => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      const latency = (Date.now() - serverTime) / 1000 / 2;
      const expected = ct + latency;
      const drift = Math.abs(video.currentTime - expected);
      if (drift > DRIFT_THRESHOLD) {
        isSyncing.current = true;
        video.currentTime = expected;
        flashSyncMsg(`🔄 Correcting drift (${drift.toFixed(1)}s)`);
        setTimeout(() => { isSyncing.current = false; }, 500);
      }
    });

    onSyncState(({ isPlaying: playing, currentTime: ct, serverTime }) => {
      const video = videoRef.current;
      if (!video) return;
      isSyncing.current = true;
      let targetTime = ct;
      if (playing) targetTime += (Date.now() - serverTime) / 1000;
      video.currentTime = Math.max(0, targetTime);
      guestShouldPlay.current = playing;
      if (playing) {
        playGuestVideo(video);
      } else {
        video.pause();
        setIsPlaying(false);
      }
      setTimeout(() => { isSyncing.current = false; }, 500);
    });
  }, [isHost, onSyncPlay, onSyncPause, onSyncSeek, onSyncHeartbeat, onSyncState, playGuestVideo]);

  // ─── Host heartbeat ────────────────────────────────────────────────
  useEffect(() => {
    if (!isHost) return;
    heartbeatRef.current = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        onHeartbeat(video.currentTime);
      }
    }, HEARTBEAT_INTERVAL);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [isHost, onHeartbeat]);

  // ─── Video event handlers ──────────────────────────────────────────
  function handleTimeUpdate() {
    const video = videoRef.current;
    if (video) setCurrentTime(video.currentTime);
  }

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (video) setDuration(video.duration);
  }

  function handleWaiting() { setBuffering(true); }
  function handleCanPlay() { setBuffering(false); }
  function handleEnded() { setIsPlaying(false); onEnded(); }

  // ─── Host controls ─────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (!isHost) return;
    const video = videoRef.current;
    if (!video) return;
    video.play().then(() => {
      setIsPlaying(true);
      onPlay(video.currentTime);
    }).catch(() => {});
  }, [isHost, onPlay]);

  const handlePause = useCallback(() => {
    if (!isHost) return;
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    onPause(video.currentTime);
  }, [isHost, onPause]);

  const handleTogglePlay = useCallback(() => {
    if (!isHost) return;
    if (isPlaying) handlePause();
    else handlePlay();
  }, [isHost, isPlaying, handlePlay, handlePause]);

  const handleSeekBy = useCallback((seconds: number) => {
    if (!isHost) return;
    const video = videoRef.current;
    if (!video) return;
    const newTime = Math.max(0, Math.min(video.currentTime + seconds, duration));
    video.currentTime = newTime;
    onSeek(newTime);
  }, [isHost, duration, onSeek]);

  const handleRestart = useCallback(() => {
    if (!isHost) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    onSeek(0);
  }, [isHost, onSeek]);

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isHost) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const newTime = ratio * duration;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = newTime;
    onSeek(newTime);
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setMuted(val === 0);
    }
  }

  function handleToggleMute() {
    if (!videoRef.current) return;
    const newMuted = !videoRef.current.muted;
    if (!newMuted && !isHost) {
      handleEnableSound();
      return;
    }
    setMuted(newMuted);
    videoRef.current.muted = newMuted;
  }

  function handleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ─── Auto-hide controls ────────────────────────────────────────────
  function handleMouseMove() {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (isPlaying && window.matchMedia('(hover: hover) and (pointer: fine)').matches) setShowControls(false);
    }, 3000);
  }

  function flashSyncMsg(msg: string) {
    setShowSyncMsg(msg);
    setTimeout(() => setShowSyncMsg(''), 2500);
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative flex w-full min-w-0 flex-col rounded-xl overflow-hidden bg-black group sm:aspect-video fullscreen:h-dvh fullscreen:rounded-none fullscreen:aspect-auto [&:fullscreen>video]:flex-1 [&:fullscreen>video]:h-0"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && window.matchMedia('(hover: hover) and (pointer: fine)').matches && setShowControls(false)}
      onFocusCapture={() => setShowControls(true)}
      onTouchStart={() => setShowControls(true)}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={videoSrc}
        className="aspect-video w-full min-h-0 object-contain sm:h-full sm:aspect-auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onVolumeChange={() => {
          const video = videoRef.current;
          if (!video) return;
          setMuted(video.muted);
          setVolume(video.volume);
        }}
        playsInline
        preload="metadata"
        onClick={handleTogglePlay}
        style={{ cursor: isHost ? 'pointer' : 'default' }}
      />

      {/* Buffering overlay */}
      <AnimatePresence>
        {buffering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.4)' }}
          >
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <Loader2 className="w-12 h-12 text-purple-400" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync message */}
      <AnimatePresence>
        {showSyncMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-3 left-3 max-w-[calc(100%-1.5rem)] px-3 py-2 rounded-full text-xs font-medium backdrop-blur-md pointer-events-none sm:left-1/2 sm:-translate-x-1/2"
            style={{ background: 'rgba(168,85,247,0.4)', border: '1px solid rgba(168,85,247,0.5)', color: '#f1f0ff' }}
          >
            {showSyncMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Local audio permission is independent of the host's playback controls. */}
      {!isHost && (!soundEnabled || needsPlaybackTap) && (
        <div className="absolute inset-x-3 top-12 z-20 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={handleEnableSound}
            className="min-h-11 max-w-full rounded-xl border border-purple-400/50 bg-purple-950/95 px-4 py-3 text-sm font-medium text-white shadow-lg pointer-events-auto touch-manipulation"
          >
            {needsPlaybackTap ? 'Tap to enable playback & sound' : '🔊 Enable sound on this device'}
          </button>
        </div>
      )}

      {/* Guest indicator */}
      {!isHost && (
        <div
          className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs backdrop-blur-sm"
          style={{ background: 'rgba(0,0,0,0.5)', color: '#9ca3af' }}
        >
          👤 Watching
        </div>
      )}

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative flex shrink-0 flex-col justify-end bg-black/90 sm:absolute sm:inset-0 sm:bg-transparent sm:pointer-events-none"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)',
            }}
          >
            {/* Progress bar */}
            <div
              className={`mx-3 flex h-11 shrink-0 items-center sm:mx-4 pointer-events-auto ${isHost ? 'cursor-pointer touch-manipulation' : 'cursor-default'}`}
              onClick={handleProgressClick}
            >
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
                  }}
                />
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex flex-wrap items-center justify-between gap-x-0.5 gap-y-1 px-2 pb-2 sm:justify-start sm:gap-2 sm:px-4 sm:pb-4 pointer-events-auto [&>button]:h-11 [&>button]:w-11 [&>button]:shrink-0 [&>button]:touch-manipulation [&>button]:focus-visible:outline-2 [&>button]:focus-visible:outline-purple-400">
              {/* Restart (host only) */}
              {isHost && (
                <button id="restart-btn" aria-label="Restart video" onClick={handleRestart} className="text-white/70 hover:text-white transition-colors p-1.5">
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              {/* Rewind 10s */}
              {isHost && (
                <button id="rewind-btn" aria-label="Rewind 10 seconds" onClick={() => handleSeekBy(-10)} className="text-white/70 hover:text-white transition-colors p-1.5">
                  <SkipBack className="w-5 h-5" />
                </button>
              )}

              {/* Play/Pause */}
              <button
                id="play-pause-btn"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                onClick={handleTogglePlay}
                disabled={!isHost}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-50"
                style={{ background: isHost ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(255,255,255,0.15)' }}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              {/* Forward 10s */}
              {isHost && (
                <button id="forward-btn" aria-label="Forward 10 seconds" onClick={() => handleSeekBy(10)} className="text-white/70 hover:text-white transition-colors p-1.5">
                  <SkipForward className="w-5 h-5" />
                </button>
              )}

              {/* Time display */}
              <span className="order-first w-full whitespace-nowrap px-1 text-xs font-mono tabular-nums sm:order-none sm:w-auto sm:flex-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              {/* Volume */}
              <button aria-label={muted ? 'Unmute' : 'Mute'} onClick={handleToggleMute} className="text-white/70 hover:text-white p-1.5 transition-colors">
                {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                aria-label="Volume"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="hidden sm:block h-11 w-16 shrink-0 accent-purple-500"
                style={{ cursor: 'pointer' }}
              />

              {/* Fullscreen */}
              <button id="fullscreen-btn" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={handleFullscreen} className="text-white/70 hover:text-white p-1.5 transition-colors">
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
