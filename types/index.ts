export interface Room {
  id: string;
  role: 'host' | 'guest';
  hostName: string;
  guestName: string;
  hostToken?: string;
  guestToken?: string;
  token: string;
}

export type PlayerRole = 'host' | 'guest';

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  serverTime: number;
}

export interface ChatMessage {
  id: string;
  sender: 'host' | 'guest';
  senderName: string;
  text: string;
  timestamp: number;
  emoji?: string;
}

export interface ReactionOverlay {
  id: string;
  emoji: string;
  sender: 'host' | 'guest';
  timestamp: number;
}

export interface Participant {
  role: 'host' | 'guest';
  connected: boolean;
  name: string;
}

export interface RoomJoinedEvent {
  role: PlayerRole;
  roomId: string;
  hostName: string;
  guestName: string;
  partnerConnected: boolean;
  roomState: PlaybackState;
}

export interface SyncPlayEvent {
  currentTime: number;
  serverTime: number;
}

export interface SyncPauseEvent {
  currentTime: number;
}

export interface SyncSeekEvent {
  currentTime: number;
}

export interface SyncHeartbeatEvent {
  currentTime: number;
  serverTime: number;
}

export const EMOJI_REACTIONS = ['❤️', '😂', '😭', '🥹', '😱'] as const;
export type EmojiReaction = typeof EMOJI_REACTIONS[number];
