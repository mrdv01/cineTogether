'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';
import type {
  RoomJoinedEvent,
  PlaybackState,
  ChatMessage,
  ReactionOverlay,
  SyncPlayEvent,
  SyncPauseEvent,
  SyncSeekEvent,
  SyncHeartbeatEvent,
  PlayerRole,
} from '@/types';

interface UseRoomOptions {
  roomId: string;
  token: string;
}

interface UseRoomReturn {
  socket: Socket | null;
  role: PlayerRole | null;
  hostName: string;
  guestName: string;
  guestToken: string | null;
  partnerConnected: boolean;
  roomState: PlaybackState | null;
  messages: ChatMessage[];
  reactions: ReactionOverlay[];
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  sendMessage: (text: string) => void;
  sendReaction: (emoji: string) => void;
  emitPlay: (currentTime: number) => void;
  emitPause: (currentTime: number) => void;
  emitSeek: (currentTime: number) => void;
  emitHeartbeat: (currentTime: number) => void;
  requestSync: () => void;
  onSyncPlay: (cb: (event: SyncPlayEvent) => void) => void;
  onSyncPause: (cb: (event: SyncPauseEvent) => void) => void;
  onSyncSeek: (cb: (event: SyncSeekEvent) => void) => void;
  onSyncHeartbeat: (cb: (event: SyncHeartbeatEvent) => void) => void;
  onSyncState: (cb: (event: PlaybackState) => void) => void;
}

export function useRoom({ roomId, token }: UseRoomOptions): UseRoomReturn {
  const socketRef = useRef<Socket | null>(null);
  const [role, setRole] = useState<PlayerRole | null>(null);
  const [hostName, setHostName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [roomState, setRoomState] = useState<PlaybackState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<ReactionOverlay[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('connecting');

  // Sync callbacks stored in refs to avoid stale closures
  const syncPlayCb = useRef<((e: SyncPlayEvent) => void) | null>(null);
  const syncPauseCb = useRef<((e: SyncPauseEvent) => void) | null>(null);
  const syncSeekCb = useRef<((e: SyncSeekEvent) => void) | null>(null);
  const syncHeartbeatCb = useRef<((e: SyncHeartbeatEvent) => void) | null>(null);
  const syncStateCb = useRef<((e: PlaybackState) => void) | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.connect();
    setConnectionStatus('connecting');

    socket.on('connect', () => {
      setConnectionStatus('connected');
      socket.emit('join-room', { roomId, token });
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('error');
    });

    socket.on('room-joined', (event: RoomJoinedEvent) => {
      setRole(event.role);
      setHostName(event.hostName);
      setGuestName(event.guestName);
      setGuestToken(event.guestToken ?? null);
      setPartnerConnected(event.partnerConnected);
      setRoomState(event.roomState);
    });

    socket.on('partner-connected', () => setPartnerConnected(true));
    socket.on('partner-disconnected', () => setPartnerConnected(false));

    socket.on('sync-play', (e: SyncPlayEvent) => syncPlayCb.current?.(e));
    socket.on('sync-pause', (e: SyncPauseEvent) => syncPauseCb.current?.(e));
    socket.on('sync-seek', (e: SyncSeekEvent) => syncSeekCb.current?.(e));
    socket.on('sync-heartbeat', (e: SyncHeartbeatEvent) => syncHeartbeatCb.current?.(e));
    socket.on('sync-state', (e: PlaybackState) => syncStateCb.current?.(e));

    socket.on('new-message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('reaction-overlay', (reaction: ReactionOverlay) => {
      setReactions(prev => [...prev, reaction]);
      // Remove after 3 seconds
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== reaction.id));
      }, 3000);
    });

    socket.on('error', (err: { message: string }) => {
      console.error('[Socket] Error:', err.message);
      setConnectionStatus('error');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('room-joined');
      socket.off('partner-connected');
      socket.off('partner-disconnected');
      socket.off('sync-play');
      socket.off('sync-pause');
      socket.off('sync-seek');
      socket.off('sync-heartbeat');
      socket.off('sync-state');
      socket.off('new-message');
      socket.off('reaction-overlay');
      socket.off('error');
      socket.disconnect();
    };
  }, [roomId, token]);

  const emitPlay = useCallback((currentTime: number) => {
    socketRef.current?.emit('play', { roomId, currentTime });
  }, [roomId]);

  const emitPause = useCallback((currentTime: number) => {
    socketRef.current?.emit('pause', { roomId, currentTime });
  }, [roomId]);

  const emitSeek = useCallback((currentTime: number) => {
    socketRef.current?.emit('seek', { roomId, currentTime });
  }, [roomId]);

  const emitHeartbeat = useCallback((currentTime: number) => {
    socketRef.current?.emit('heartbeat', { roomId, currentTime });
  }, [roomId]);

  const requestSync = useCallback(() => {
    socketRef.current?.emit('request-sync', { roomId });
  }, [roomId]);

  const sendMessage = useCallback((text: string) => {
    socketRef.current?.emit('send-message', { roomId, text });
  }, [roomId]);

  const sendReaction = useCallback((emoji: string) => {
    socketRef.current?.emit('send-reaction', { roomId, emoji });
  }, [roomId]);

  const onSyncPlay = useCallback((cb: (e: SyncPlayEvent) => void) => {
    syncPlayCb.current = cb;
  }, []);

  const onSyncPause = useCallback((cb: (e: SyncPauseEvent) => void) => {
    syncPauseCb.current = cb;
  }, []);

  const onSyncSeek = useCallback((cb: (e: SyncSeekEvent) => void) => {
    syncSeekCb.current = cb;
  }, []);

  const onSyncHeartbeat = useCallback((cb: (e: SyncHeartbeatEvent) => void) => {
    syncHeartbeatCb.current = cb;
  }, []);

  const onSyncState = useCallback((cb: (e: PlaybackState) => void) => {
    syncStateCb.current = cb;
  }, []);

  return {
    socket: socketRef.current,
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
  };
}
