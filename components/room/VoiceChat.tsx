'use client';

import { Headphones, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import { useVoiceChat, type VoiceChatOptions } from '@/hooks/useVoiceChat';

export interface VoiceChatProps extends VoiceChatOptions {
  partnerName: string;
}

export function VoiceChat({ partnerName, ...options }: VoiceChatProps) {
  const { state, error, muted, playbackBlocked, audioRef, canJoin, active, join, leave, toggleMute, playRemote } = useVoiceChat(options);
  const status = {
    idle: 'Microphone off. Voice chat is optional.',
    requesting: 'Waiting for microphone permission…',
    joining: 'Joining voice chat…',
    waiting: `Waiting for ${partnerName || 'your partner'} to join voice…`,
    connecting: 'Connecting private audio…',
    connected: `Voice connected with ${partnerName || 'your partner'}.${muted ? ' Your microphone is muted.' : ''}`,
    error: 'Voice chat stopped. You can join again to retry.',
  }[state];
  const button = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <section aria-label="Voice chat" className="min-w-0 rounded-2xl border border-purple-400/25 bg-gradient-to-br from-purple-950/70 to-slate-950 p-4 text-purple-50 shadow-lg shadow-purple-950/20">
      {/* Always mounted so a remote track never needs a video element or a UI remount. */}
      <audio ref={audioRef} autoPlay playsInline aria-label="Partner voice audio" />
      <div className="flex min-w-0 items-start gap-3">
        <Headphones aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-purple-300" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Cinema voice chat</h2>
          <p role="status" aria-live="polite" className="mt-1 break-words text-sm text-purple-200">{status}</p>
          <p className="mt-1 text-xs text-purple-200/80">Audio only · Headphones recommended</p>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
      {!active && !canJoin && (
        <p className="mt-3 text-sm text-purple-200">Waiting for your authenticated room connection…</p>
      )}
      <div className="mt-4 flex flex-col flex-wrap gap-2 sm:flex-row">
        {!active ? (
          <button type="button" className={`${button} bg-purple-600 text-white hover:bg-purple-500`} disabled={!canJoin} onClick={join}>
            <Mic aria-hidden="true" className="h-4 w-4" />
            Join Voice Chat
          </button>
        ) : (
          <>
            <button type="button" className={`${button} border border-purple-300/30 bg-purple-900/60 hover:bg-purple-800`} aria-pressed={muted} disabled={state === 'requesting'} onClick={toggleMute}>
              {muted ? <MicOff aria-hidden="true" className="h-4 w-4" /> : <Mic aria-hidden="true" className="h-4 w-4" />}
              {muted ? 'Unmute microphone' : 'Mute microphone'}
            </button>
            <button type="button" className={`${button} border border-rose-300/30 bg-rose-950/70 text-rose-100 hover:bg-rose-900`} onClick={leave}>
              <PhoneOff aria-hidden="true" className="h-4 w-4" /> Leave voice chat
            </button>
          </>
        )}
        {playbackBlocked && (
          <button type="button" className={`${button} border border-purple-300/40 bg-purple-800 hover:bg-purple-700`} onClick={() => { void playRemote(); }}>
            <Volume2 aria-hidden="true" className="h-4 w-4" /> Play remote sound
          </button>
        )}
      </div>
    </section>
  );
}
