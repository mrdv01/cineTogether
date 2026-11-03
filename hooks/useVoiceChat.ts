'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

export interface VoiceChatOptions {
  socket: Socket | null;
  roomId: string;
  /** Must come from the parent's authenticated room-joined event. */
  role: 'host' | 'guest';
  connectionStatus: string;
}

type VoiceState = 'idle' | 'requesting' | 'joining' | 'waiting' | 'connecting' | 'connected' | 'error';
type Description = { type: 'offer' | 'answer'; sdp: string };
type Signal = { peerId: string; description?: Description; candidate?: RTCIceCandidateInit };
type JoinReply = { ok: true; selfId: string; peerId: string | null } | { ok: false; error: string };
type Attempt = {
  generation: number;
  stream: MediaStream | null;
  remote: MediaStream | null;
  pc: RTCPeerConnection | null;
  peerId: string | null;
  selfId: string | null;
  joined: boolean;
  emitted: boolean;
  offered: boolean;
  pendingPeer: string | null;
  pendingSignals: Signal[];
  candidates: RTCIceCandidateInit[];
  queue: Promise<void>;
  timer: ReturnType<typeof setTimeout> | null;
};

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  const urls = process.env.NEXT_PUBLIC_TURN_URLS?.split(',').map(url => url.trim()).filter(Boolean);
  if (urls?.length) {
    servers.push({
      urls,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

/** Audio only, opt-in per call. Never reacquires a microphone after a disconnect. */
export function useVoiceChat({ socket, roomId, role, connectionStatus }: VoiceChatOptions) {
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [roomReady, setRoomReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const controls = useRef<{ join: () => void; leave: () => void; mute: () => void } | null>(null);
  const generation = useRef(0);
  const membership = useRef<{ socket: Socket; roomId: string; role: string; authenticated: boolean } | null>(null);

  useEffect(() => {
    if (!socket) return;
    let disposed = false;
    // Initial role is supplied by the parent's authenticated room-joined handler.
    // Reconnects must subsequently prove room membership again.
    if (!membership.current || membership.current.socket !== socket ||
        membership.current.roomId !== roomId || membership.current.role !== role) {
      membership.current = { socket, roomId, role, authenticated: socket.connected && connectionStatus === 'connected' };
    }
    const room = membership.current;
    let authenticated = room.authenticated && socket.connected;
    setRoomReady(authenticated);
    setState('idle');
    setError(null);
    setMuted(false);
    setRemoteStream(null);
    setPlaybackBlocked(false);
    let attempt: Attempt | null = null;
    const live = (call: Attempt) => !disposed && attempt === call && call.generation === generation.current;

    function stop(message: string | null = null, notify = true) {
      const call = attempt;
      attempt = null;
      generation.current += 1;
      if (call) {
        if (call.timer) clearTimeout(call.timer);
        if (notify && call.emitted && socket?.connected) socket.emit('voice:leave', { roomId });
        if (call.pc) {
          call.pc.onicecandidate = null;
          call.pc.ontrack = null;
          call.pc.onconnectionstatechange = null;
          call.pc.oniceconnectionstatechange = null;
          call.pc.close();
        }
        call.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
        call.remote?.getTracks().forEach(track => track.stop());
        call.pendingSignals = [];
        call.candidates = [];
      }
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.srcObject = null; }
      if (!disposed) {
        setRemoteStream(null);
        setPlaybackBlocked(false);
        setMuted(false);
        setError(message);
        setState(message ? 'error' : 'idle');
      }
    }

    function fail(call: Attempt, message: string) {
      if (live(call)) stop(message);
    }

    function negotiateTimeout(call: Attempt) {
      if (call.timer) clearTimeout(call.timer);
      call.timer = setTimeout(() => fail(call, 'Voice connection timed out. Join again to retry.'), 25000);
    }

    function peer(call: Attempt, peerId: string): RTCPeerConnection | null {
      if (!live(call) || !call.joined || peerId === call.selfId) return null;
      if (call.peerId && call.peerId !== peerId) return null;
      if (call.pc) return call.pc;
      call.peerId = peerId;
      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      call.pc = pc;
      call.stream!.getAudioTracks().forEach(track => pc.addTrack(track, call.stream!));
      setState('connecting');
      negotiateTimeout(call);
      pc.onicecandidate = event => {
        if (live(call) && event.candidate) {
          socket!.emit('voice:signal', { roomId, peerId, candidate: event.candidate.toJSON() });
        }
      };
      pc.ontrack = event => {
        if (!live(call) || event.track.kind !== 'audio') return;
        if (!call.remote) call.remote = new MediaStream();
        call.remote.addTrack(event.track);
        setRemoteStream(call.remote);
      };
      const checkConnection = () => {
        if (!live(call)) return;
        if (['failed', 'disconnected'].includes(pc.iceConnectionState) ||
            ['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          fail(call, 'Voice connection lost. Join again to retry.');
        } else if (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          if (call.timer) clearTimeout(call.timer);
          call.timer = null;
          setState('connected');
        }
      };
      pc.onconnectionstatechange = checkConnection;
      pc.oniceconnectionstatechange = checkConnection;
      return pc;
    }

    function enqueue(call: Attempt, task: () => Promise<void>) {
      call.queue = call.queue.then(async () => { if (live(call)) await task(); })
        .catch(() => fail(call, 'Could not establish voice chat. Join again to retry.'));
    }

    function ready(call: Attempt, peerId: string) {
      enqueue(call, async () => {
        const pc = peer(call, peerId);
        if (!pc || role !== 'host' || call.offered) return;
        call.offered = true;
        const offer = await pc.createOffer();
        if (!live(call)) return;
        await pc.setLocalDescription(offer);
        if (!live(call)) return;
        socket!.emit('voice:signal', { roomId, peerId, description: { type: 'offer', sdp: pc.localDescription!.sdp } });
      });
    }

    function signal(call: Attempt, event: Signal) {
      enqueue(call, async () => {
        if (event.peerId !== call.peerId) return;
        const pc = peer(call, event.peerId);
        if (!pc) return;
        if (event.description) {
          const description = event.description;
          // The host is the sole offerer: no glare or unsolicited renegotiation.
          if (role === 'host' ? description.type !== 'answer' || pc.signalingState !== 'have-local-offer'
            : description.type !== 'offer' || pc.signalingState !== 'stable' || !!pc.remoteDescription) return;
          await pc.setRemoteDescription(description);
          if (!live(call)) return;
          for (const candidate of call.candidates.splice(0)) {
            await pc.addIceCandidate(candidate);
            if (!live(call)) return;
          }
          if (role === 'guest') {
            const answer = await pc.createAnswer();
            if (!live(call)) return;
            await pc.setLocalDescription(answer);
            if (!live(call)) return;
            socket!.emit('voice:signal', { roomId, peerId: event.peerId, description: { type: 'answer', sdp: pc.localDescription!.sdp } });
          }
        } else if (event.candidate) {
          if (pc.remoteDescription) await pc.addIceCandidate(event.candidate);
          else if (call.candidates.length < 128) call.candidates.push(event.candidate);
        }
      });
    }

    async function join() {
      if (attempt || disposed || !authenticated || !socket?.connected || connectionStatus !== 'connected') return;
      const call: Attempt = {
        generation: ++generation.current, stream: null, remote: null, pc: null,
        peerId: null, selfId: null, joined: false, emitted: false, offered: false,
        pendingPeer: null, pendingSignals: [], candidates: [], queue: Promise.resolve(), timer: null,
      };
      attempt = call;
      setError(null);
      setState('requesting');
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
          fail(call, 'Voice chat requires a supported browser and HTTPS (or localhost).');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false,
        });
        if (!live(call)) { stream.getTracks().forEach(track => track.stop()); return; }
        call.stream = stream;
        stream.getAudioTracks().forEach(track => {
          track.onended = () => fail(call, 'Microphone stopped. Join again to retry.');
        });
        if (!authenticated || !socket.connected) { stop(); return; }
        call.emitted = true;
        setState('joining');
        call.timer = setTimeout(() => fail(call, 'Joining voice chat timed out. Join again to retry.'), 10000);
        socket.emit('voice:join', { roomId }, (reply: JoinReply) => {
          if (!live(call) || call.joined) return;
          if (!reply || reply.ok !== true || !reply.selfId) {
            fail(call, 'Voice join was refused. Check your room connection and try again.');
            return;
          }
          if (call.timer) clearTimeout(call.timer);
          call.timer = null;
          call.joined = true;
          call.selfId = reply.selfId;
          setState('waiting');
          const peerId = reply.peerId ?? call.pendingPeer;
          if (peerId && peerId !== call.selfId) {
            call.peerId = peerId;
            ready(call, peerId);
            call.pendingSignals.splice(0).forEach(event => signal(call, event));
          } else call.pendingSignals = [];
        });
      } catch (cause) {
        const denied = cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'SecurityError');
        fail(call, denied ? 'Microphone permission denied. Allow microphone access, then join again.'
          : 'Microphone unavailable. Check your device, then join again.');
      }
    }

    const onReady = ({ peerId }: { peerId: string }) => {
      const call = attempt;
      if (!call?.emitted || !peerId) return;
      if (!call.joined) { call.pendingPeer = peerId; return; }
      if (peerId === call.selfId || (call.peerId && call.peerId !== peerId)) return;
      call.peerId = peerId;
      ready(call, peerId);
    };
    const onSignal = (event: Signal) => {
      const call = attempt;
      if (!call?.emitted || !event?.peerId) return;
      if (!call.joined) {
        if (call.pendingSignals.length < 128) call.pendingSignals.push(event);
      } else if (event.peerId === call.peerId) signal(call, event);
    };
    const onPeerLeft = ({ peerId }: { peerId: string }) => {
      const call = attempt;
      if (call && (peerId === call.peerId || peerId === call.pendingPeer || !call.joined)) {
        stop('Your partner left voice chat. Join again when you are ready.');
      }
    };
    const onRevoked = ({ selfId }: { selfId: string }) => {
      if (!attempt || (attempt.selfId && attempt.selfId !== selfId)) return;
      authenticated = false;
      room.authenticated = false;
      setRoomReady(false);
      stop('This room session was replaced or expired. Reload to rejoin.', false);
    };
    const onPartnerDisconnected = () => {
      if (attempt) stop('Your partner disconnected. Join again when they return.');
    };
    const onDisconnect = () => {
      authenticated = false;
      room.authenticated = false;
      setRoomReady(false);
      stop(attempt ? 'Room disconnected. Reconnect, then join voice again.' : null, false);
    };
    const onRoomJoined = (event: { roomId: string; role: string }) => {
      authenticated = event.roomId === roomId && event.role === role && socket.connected;
      room.authenticated = authenticated;
      setRoomReady(authenticated);
      if (!authenticated) stop('Room authentication changed. Rejoin the room first.');
    };
    socket.on('voice:ready', onReady);
    socket.on('voice:signal', onSignal);
    socket.on('voice:peer-left', onPeerLeft);
    socket.on('voice:revoked', onRevoked);
    socket.on('partner-disconnected', onPartnerDisconnected);
    socket.on('disconnect', onDisconnect);
    socket.on('room-joined', onRoomJoined);
    controls.current = {
      join: () => { void join(); },
      leave: () => stop(),
      mute: () => {
        const tracks = attempt?.stream?.getAudioTracks();
        if (!tracks?.length) return;
        const enabled = !tracks[0].enabled;
        tracks.forEach(track => { track.enabled = enabled; });
        setMuted(!enabled);
      },
    };
    return () => {
      disposed = true;
      stop();
      controls.current = null;
      socket.off('voice:ready', onReady);
      socket.off('voice:signal', onSignal);
      socket.off('voice:peer-left', onPeerLeft);
      socket.off('voice:revoked', onRevoked);
      socket.off('partner-disconnected', onPartnerDisconnected);
      socket.off('disconnect', onDisconnect);
      socket.off('room-joined', onRoomJoined);
    };
  }, [socket, roomId, role, connectionStatus]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let cancelled = false;
    audio.srcObject = remoteStream;
    if (remoteStream) {
      void audio.play().then(() => { if (!cancelled) setPlaybackBlocked(false); })
        .catch(() => { if (!cancelled) setPlaybackBlocked(true); });
    }
    return () => { cancelled = true; audio.pause(); audio.srcObject = null; };
  }, [remoteStream]);

  const playRemote = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio?.srcObject) return;
    const stream = audio.srcObject;
    try {
      await audio.play();
      if (audio.srcObject === stream) setPlaybackBlocked(false);
    } catch {
      if (audio.srcObject === stream) setPlaybackBlocked(true);
    }
  }, []);

  return {
    state, error, muted, playbackBlocked, audioRef,
    canJoin: roomReady && connectionStatus === 'connected' && !!socket?.connected && (state === 'idle' || state === 'error'),
    active: !['idle', 'error'].includes(state),
    join: useCallback(() => controls.current?.join(), []),
    leave: useCallback(() => controls.current?.leave(), []),
    toggleMute: useCallback(() => controls.current?.mute(), []),
    playRemote,
  };
}
