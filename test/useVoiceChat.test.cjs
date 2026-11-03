'use strict';

// Contract tests, not a browser/React integration test: effects are committed
// explicitly (no concurrent rendering/StrictMode), and SDP, ICE and playback are
// deterministic fakes. No microphone, network, real timers or React dependency.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../hooks/useVoiceChat.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const sameDeps = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

function hookHarness() {
  const slots = [];
  let cursor = 0, dirty = true, mounted = true, hook, props, value;
  let effects = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => {
        if (!mounted) return;
        const result = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(result, slots[index].value)) { slots[index].value = result; dirty = true; }
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) slots[index] = { callback, deps };
      return slots[index].callback;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) {
        const previous = slots[index];
        slots[index] = { deps, cleanup: previous?.cleanup };
        effects.push(() => {
          slots[index].cleanup?.();
          slots[index].cleanup = effect();
        });
      }
    },
  };
  function render(audio) {
    let renders = 0;
    while (mounted && dirty) {
      assert.ok(++renders < 50, 'hook render loop should settle');
      dirty = false;
      cursor = 0;
      value = hook(props);
      // Model the audio element's ref assignment before passive effects commit.
      value.audioRef.current = audio;
      const pending = effects;
      effects = [];
      pending.forEach(effect => effect());
    }
    return value;
  }
  return {
    react,
    mount(fn, options, audio) { hook = fn; props = options; return render(audio); },
    render,
    get value() { return value; },
    unmount() {
      if (!mounted) return;
      mounted = false;
      slots.forEach(slot => slot.cleanup?.());
    },
  };
}

class Track {
  kind = 'audio';
  enabled = true;
  stopped = 0;
  onended = null;
  stop() { this.stopped++; }
}
class Stream {
  constructor(tracks = []) { this.tracks = [...tracks]; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio'); }
  addTrack(track) { this.tracks.push(track); }
}
class Socket {
  connected = true;
  listeners = new Map();
  sent = [];
  on(event, listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(listener);
  }
  off(event, listener) { this.listeners.get(event)?.delete(listener); }
  emit(event, payload, ack) { this.sent.push({ event, payload, ack }); }
  receive(event, payload) { this.listeners.get(event)?.forEach(listener => listener(payload)); }
  messages(event) { return this.sent.filter(message => message.event === event); }
  ack(reply) { this.messages('voice:join').at(-1).ack(reply); }
}

function setup(t, role = 'host') {
  const harness = hookHarness();
  const socket = new Socket();
  const permission = deferred();
  const captures = [], peers = [], timers = new Map();
  let timerId = 0;
  class Peer {
    signalingState = 'stable';
    connectionState = 'new';
    iceConnectionState = 'new';
    localDescription = null;
    remoteDescription = null;
    tracks = [];
    candidates = [];
    operations = [];
    offers = 0;
    answers = 0;
    closed = 0;
    constructor(config) { this.config = config; peers.push(this); }
    addTrack(track, stream) { this.tracks.push({ track, stream }); }
    async createOffer() { this.offers++; return { type: 'offer', sdp: 'fake-offer' }; }
    async createAnswer() { this.answers++; return { type: 'answer', sdp: 'fake-answer' }; }
    async setLocalDescription(description) {
      this.localDescription = description;
      this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable';
    }
    async setRemoteDescription(description) {
      this.operations.push('remote');
      this.remoteDescription = description;
      this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable';
    }
    async addIceCandidate(candidate) {
      assert.ok(this.remoteDescription, 'ICE must wait for a remote description');
      this.operations.push('ice');
      this.candidates.push(candidate);
    }
    close() { this.closed++; this.connectionState = 'closed'; }
  }
  const audio = {
    srcObject: null, plays: 0, pauses: 0, blocked: false,
    play() { this.plays++; return this.blocked ? Promise.reject(new Error('autoplay blocked')) : Promise.resolve(); },
    pause() { this.pauses++; },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) { assert.equal(name, 'react'); return harness.react; },
    navigator: { mediaDevices: { getUserMedia(options) { captures.push(options); return permission.promise; } } },
    RTCPeerConnection: Peer, MediaStream: Stream, DOMException,
    process: { env: {} },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  }, { filename: 'useVoiceChat.transpiled.cjs' });
  harness.mount(exports.useVoiceChat, { socket, roomId: 'room', role, connectionStatus: 'connected' }, audio);
  // Drain promise continuations and commit their state updates, without sleeps.
  async function flush() {
    for (let i = 0; i < 8; i++) {
      await new Promise(resolve => setImmediate(resolve));
      harness.render(audio);
    }
  }
  t.after(() => {
    harness.unmount();
    assert.equal(timers.size, 0, 'cleanup clears every timer');
    assert.ok([...socket.listeners.values()].every(set => set.size === 0), 'cleanup removes socket listeners');
  });
  return {
    socket, permission, captures, peers, audio, timers, harness, flush,
    get value() { return harness.value; },
    async join(peerId = 'partner') {
      harness.value.join();
      const track = new Track();
      const stream = new Stream([track]);
      permission.resolve(stream);
      await flush();
      socket.ack({ ok: true, selfId: 'self', peerId });
      await flush();
      return { track, stream, pc: peers[0] };
    },
  };
}

test('temporary ICE disconnection preserves the call and recovers', async t => {
  const f = setup(t);
  const { track, pc } = await f.join();
  pc.connectionState = 'connected';
  pc.iceConnectionState = 'connected';
  pc.onconnectionstatechange();
  await f.flush();
  assert.equal(f.value.state, 'connected');
  pc.iceConnectionState = 'disconnected';
  pc.oniceconnectionstatechange();
  pc.oniceconnectionstatechange();
  await f.flush();
  assert.equal(f.value.state, 'reconnecting');
  assert.equal(track.stopped, 0);
  assert.equal(pc.closed, 0);
  assert.equal([...f.timers.values()].filter(timer => timer.delay === 12000).length, 1);
  pc.iceConnectionState = 'connected';
  pc.oniceconnectionstatechange();
  await f.flush();
  assert.equal(f.value.state, 'connected');
  assert.equal(f.timers.size, 0);
});

test('persistent ICE disconnection times out and stops microphone', async t => {
  const f = setup(t);
  const { track, pc } = await f.join();
  pc.iceConnectionState = 'disconnected';
  pc.oniceconnectionstatechange();
  const timer = [...f.timers.values()].find(timer => timer.delay === 12000);
  assert.ok(timer);
  timer.callback();
  await f.flush();
  assert.equal(f.value.state, 'error');
  assert.ok(track.stopped > 0);
  assert.equal(pc.closed, 1);
  assert.match(f.value.error, /TURN/);
});

test('failed ICE stops the call without waiting for recovery', async t => {
  const f = setup(t);
  const { track, pc } = await f.join();
  pc.iceConnectionState = 'failed';
  pc.oniceconnectionstatechange();
  await f.flush();
  assert.equal(f.value.state, 'error');
  assert.ok(track.stopped > 0);
  assert.equal(pc.closed, 1);
});

test('opt-in: mounting and unsolicited signaling never capture; join captures audio once', async t => {
  const f = setup(t);
  await f.flush();
  assert.equal(f.value.canJoin, true);
  assert.equal(f.value.state, 'idle');
  f.socket.receive('voice:ready', { peerId: 'partner' });
  f.socket.receive('voice:signal', { peerId: 'partner', description: { type: 'offer', sdp: 'ignored' } });
  await f.flush();
  assert.equal(f.captures.length, 0);
  assert.equal(f.peers.length, 0);
  assert.equal(f.socket.sent.length, 0);
  f.value.join();
  f.value.join();
  await f.flush();
  assert.equal(f.value.state, 'requesting');
  assert.equal(f.captures.length, 1);
  assert.equal(f.captures[0].video, false);
  assert.equal(f.captures[0].audio.echoCancellation, true);
  assert.equal(f.socket.messages('voice:join').length, 0, 'join waits for permission');
});

for (const role of ['host', 'guest']) {
  for (const order of ['first', 'second', 'ready-before-ack']) {
    test(`${role} joins ${order}: only host offers; remote ICE is buffered`, async t => {
      const f = setup(t, role);
      f.value.join();
      const track = new Track();
      f.permission.resolve(new Stream([track]));
      await f.flush();
      const candidate = { candidate: 'remote-candidate' };
      if (order === 'ready-before-ack') {
        f.socket.receive('voice:ready', { peerId: 'partner' });
        f.socket.receive('voice:signal', { peerId: 'partner', candidate });
        await f.flush();
        assert.equal(f.peers.length, 0, 'no peer before membership acknowledgement');
      }
      f.socket.ack({ ok: true, selfId: 'self', peerId: order === 'second' ? 'partner' : null });
      await f.flush();
      if (order === 'first') {
        assert.equal(f.value.state, 'waiting');
        assert.equal(f.peers.length, 0);
        f.socket.receive('voice:ready', { peerId: 'partner' });
      }
      await f.flush();
      assert.equal(f.peers.length, 1);
      const pc = f.peers[0];
      assert.equal(pc.tracks[0].track, track);
      if (order !== 'ready-before-ack') f.socket.receive('voice:signal', { peerId: 'partner', candidate });
      f.socket.receive('voice:ready', { peerId: 'partner' });
      await f.flush();
      assert.equal(pc.candidates.length, 0);
      assert.equal(pc.offers, role === 'host' ? 1 : 0, 'duplicate ready cannot offer twice');
      f.socket.receive('voice:signal', {
        peerId: 'partner', description: { type: role === 'host' ? 'answer' : 'offer', sdp: 'remote-sdp' },
      });
      await f.flush();
      assert.equal(pc.candidates[0], candidate);
      assert.deepEqual(pc.operations, ['remote', 'ice']);
      assert.equal(pc.answers, role === 'guest' ? 1 : 0);
      const descriptions = f.socket.messages('voice:signal').filter(message => message.payload.description);
      assert.equal(descriptions.length, 1);
      assert.equal(descriptions[0].payload.description.type, role === 'host' ? 'offer' : 'answer');
      pc.onicecandidate({ candidate: { toJSON: () => ({ candidate: 'local-candidate' }) } });
      assert.equal(f.socket.messages('voice:signal').at(-1).payload.candidate.candidate, 'local-candidate');
      pc.connectionState = 'connected';
      pc.onconnectionstatechange();
      await f.flush();
      assert.equal(f.value.state, 'connected');
      assert.equal(f.timers.size, 0);
    });
  }
}

for (const cancel of ['leave', 'unmount', 'disconnect', 'revoked']) {
  test(`late microphone permission after ${cancel} stops tracks without joining`, async t => {
    const f = setup(t);
    f.value.join();
    if (cancel === 'leave') f.value.leave();
    if (cancel === 'unmount') f.harness.unmount();
    if (cancel === 'disconnect') { f.socket.connected = false; f.socket.receive('disconnect'); }
    if (cancel === 'revoked') f.socket.receive('voice:revoked', { selfId: 'self' });
    const track = new Track();
    f.permission.resolve(new Stream([track]));
    await f.flush();
    assert.equal(track.stopped, 1);
    assert.equal(f.socket.messages('voice:join').length, 0);
    assert.equal(f.peers.length, 0);
    if (cancel === 'revoked' || cancel === 'disconnect') {
      assert.equal(f.value.canJoin, false);
      f.value.join();
      assert.equal(f.captures.length, 1, 'invalid session cannot reacquire microphone');
    }
  });
}

for (const ending of ['leave', 'unmount', 'disconnect', 'revoked']) {
  test(`${ending} stops local/remote tracks, closes peer and clears audio`, async t => {
    const f = setup(t);
    const { track, pc } = await f.join();
    const remote = new Track();
    pc.ontrack({ track: remote });
    await f.flush();
    assert.equal(f.audio.srcObject.getTracks()[0], remote);
    const staleConnection = pc.onconnectionstatechange;
    if (ending === 'leave') f.value.leave();
    if (ending === 'unmount') f.harness.unmount();
    if (ending === 'disconnect') { f.socket.connected = false; f.socket.receive('disconnect'); }
    if (ending === 'revoked') f.socket.receive('voice:revoked', { selfId: 'self' });
    await f.flush();
    assert.equal(track.stopped, 1);
    assert.equal(remote.stopped, 1);
    assert.equal(pc.closed, 1);
    assert.equal(pc.onicecandidate, null);
    assert.equal(pc.ontrack, null);
    assert.equal(pc.onconnectionstatechange, null);
    assert.equal(pc.oniceconnectionstatechange, null);
    assert.equal(f.audio.srcObject, null);
    assert.ok(f.audio.pauses > 0);
    assert.equal(f.timers.size, 0);
    assert.equal(f.socket.messages('voice:leave').length, ['leave', 'unmount'].includes(ending) ? 1 : 0);
    staleConnection();
    await f.flush();
    if (ending !== 'unmount') assert.equal(f.value.active, false);
    if (ending === 'revoked') {
      assert.match(f.value.error, /replaced or expired/);
      assert.equal(f.value.canJoin, false);
      f.value.join();
      await f.flush();
      assert.equal(f.captures.length, 1);
    }
  });
}

test('revocation invalidates an unacknowledged join and ignores its late ack', async t => {
  const f = setup(t);
  f.value.join();
  const track = new Track();
  f.permission.resolve(new Stream([track]));
  await f.flush();
  f.socket.receive('voice:revoked', { selfId: 'self' });
  f.socket.ack({ ok: true, selfId: 'self', peerId: 'partner' });
  await f.flush();
  assert.equal(track.stopped, 1);
  assert.equal(f.peers.length, 0, 'late ack cannot resurrect revoked attempt');
  assert.equal(f.value.canJoin, false);
});

test('revocation for a different acknowledged selfId does not stop the call', async t => {
  const f = setup(t);
  const { track, pc } = await f.join();
  f.socket.receive('voice:revoked', { selfId: 'other-session' });
  await f.flush();
  assert.equal(track.stopped, 0);
  assert.equal(pc.closed, 0);
  assert.equal(f.value.active, true);
});

test('permission denial reports a retryable error without joining or creating a peer', async t => {
  const f = setup(t);
  f.value.join();
  f.permission.reject(new DOMException('Permission denied', 'NotAllowedError'));
  await f.flush();
  assert.equal(f.value.state, 'error');
  assert.match(f.value.error, /Microphone permission denied/);
  assert.equal(f.value.canJoin, true);
  assert.equal(f.value.active, false);
  assert.equal(f.socket.messages('voice:join').length, 0);
  assert.equal(f.peers.length, 0);
  assert.equal(f.timers.size, 0);
});

test('blocked autoplay can be retried explicitly and leave clears playback state', async t => {
  const f = setup(t);
  const { pc } = await f.join();
  f.audio.blocked = true;
  pc.ontrack({ track: new Track() });
  await f.flush();
  assert.equal(f.audio.plays, 1);
  assert.equal(f.value.playbackBlocked, true);
  f.audio.blocked = false;
  await f.value.playRemote();
  await f.flush();
  assert.equal(f.audio.plays, 2);
  assert.equal(f.value.playbackBlocked, false);
  f.value.leave();
  await f.flush();
  await f.value.playRemote();
  assert.equal(f.audio.plays, 2, 'no playback without a remote stream');
  assert.equal(f.audio.srcObject, null);
  assert.equal(f.value.playbackBlocked, false);
});
