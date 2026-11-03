import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatChatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function getWhatsAppShareUrl(roomUrl: string, guestName: string): string {
  const message = encodeURIComponent(
    `🎬 Movie night! I've set up a private cinema just for us.\n\nJoin here: ${roomUrl}\n\nNo app needed — just tap the link! 🍿❤️`
  );
  return `https://wa.me/?text=${message}`;
}

export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
}

export function getVideoUrl(roomId: string, token: string): string {
  return `${getBackendUrl()}/api/video/${roomId}?token=${token}`;
}
