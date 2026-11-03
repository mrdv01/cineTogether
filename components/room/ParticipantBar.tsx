'use client';

import { Wifi, WifiOff, User } from 'lucide-react';

interface ParticipantBarProps {
  hostName: string;
  guestName: string;
  hostConnected: boolean;
  guestConnected: boolean;
  role: 'host' | 'guest';
}

function Avatar({
  name,
  role,
  connected,
  isMe,
}: {
  name: string;
  role: 'host' | 'guest';
  connected: boolean;
  isMe: boolean;
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
      <div className="relative shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
          style={{
            background:
              role === 'host'
                ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                : 'linear-gradient(135deg, #be185d, #ec4899)',
          }}
        >
          {initials || <User className="w-4 h-4" />}
        </div>
        {/* Connection dot */}
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 transition-colors duration-300`}
          style={{
            background: connected ? '#10b981' : '#6b7280',
            borderColor: 'var(--bg-deep)',
          }}
        />
      </div>
      <div className="min-w-0">
        <p className="flex min-w-0 items-baseline text-xs font-medium leading-tight" style={{ color: '#f1f0ff' }}>
          <span className="truncate" title={name}>{name}</span>
          {isMe && (
            <span className="ml-1 shrink-0 text-xs" style={{ color: '#6b7280' }}>
              (you)
            </span>
          )}
        </p>
        <p
          className="text-xs mt-0.5 flex items-center gap-1"
          style={{ color: connected ? '#10b981' : '#6b7280' }}
        >
          {connected ? (
            <>
              <Wifi className="w-2.5 h-2.5" /> Online
            </>
          ) : (
            <>
              <WifiOff className="w-2.5 h-2.5" /> Offline
            </>
          )}
        </p>
      </div>
      {/* Role badge */}
      <span
        className="hidden shrink-0 xl:block text-xs px-2 py-0.5 rounded-full font-medium"
        style={{
          background:
            role === 'host'
              ? 'rgba(168, 85, 247, 0.2)'
              : 'rgba(244, 114, 182, 0.2)',
          color: role === 'host' ? '#c4b5fd' : '#f9a8d4',
          border: `1px solid ${role === 'host' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(244, 114, 182, 0.3)'}`,
        }}
      >
        {role === 'host' ? '👑 Host' : '👤 Guest'}
      </span>
    </div>
  );
}

export function ParticipantBar({
  hostName,
  guestName,
  hostConnected,
  guestConnected,
  role,
}: ParticipantBarProps) {
  return (
    <div
      className="glass flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 sm:gap-4 sm:px-4"
      style={{ border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <Avatar
        name={hostName}
        role="host"
        connected={hostConnected}
        isMe={role === 'host'}
      />
      <div className="hidden shrink-0 items-center gap-1.5 text-xs xl:flex" style={{ color: '#6b7280' }}>
        <span>•</span>
        <span>Private Cinema</span>
        <span>•</span>
      </div>
      <Avatar
        name={guestName}
        role="guest"
        connected={guestConnected}
        isMe={role === 'guest'}
      />
    </div>
  );
}
