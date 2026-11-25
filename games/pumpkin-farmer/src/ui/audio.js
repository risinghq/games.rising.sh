// Synthesised WebAudio blips by name (no audio files, design §1) plus haptics. Every sound has a caption so
// sound cues are never the only signal (design §12 accessibility).
//   play('ching', { pitch: 1.2 })  -> plays if sound is on; returns the caption text
//   haptic(8)                       -> navigator.vibrate if haptics are on
let ac = null, master = null, noiseBuf = null, gestured = false;
const S = { sound: true, haptics: true };
const last = new Map();

export function configure(settings) { S.sound = !!settings.sound; S.haptics = !!settings.haptics; if (master) master.gain.value = S.sound ? 0.55 : 0; }

function ctx() {
  if (!gestured) return null;           // browsers refuse audio before the first tap or key; stay silent until then
  if (!ac) {
    const C = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!C) return null;
    ac = new C();
    master = ac.createGain(); master.gain.value = S.sound ? 0.55 : 0;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
// Browsers only allow audio after a user gesture: create the context on the first tap or key.
const unlock = () => { gestured = true; if (S.sound) ctx(); };
addEventListener('pointerdown', unlock, { capture: true, passive: true });
addEventListener('keydown', unlock, { capture: true });

function env(g, t0, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}
function tone({ type = 'sine', f0, f1 = f0, dur = 0.15, a = 0.006, gain = 0.25, delay = 0, filter, vib }) {
  const c = ctx(); if (!c) return;
  const t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib.rate; lg.gain.value = vib.depth; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
  env(g, t0, a, gain, dur);
  let n = o;
  if (filter) { const f = c.createBiquadFilter(); f.type = filter.type || 'lowpass'; f.frequency.value = filter.f; f.Q.value = filter.q || 1; o.connect(f); n = f; }
  n.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise({ dur = 0.2, gain = 0.2, f = 1200, f1 = f, q = 1, type = 'bandpass', delay = 0, a = 0.005 }) {
  const c = ctx(); if (!c) return;
  const t0 = c.currentTime + delay, src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuf; flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f, t0);
  if (f1 !== f) flt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  env(g, t0, a, gain, dur);
  src.connect(flt); flt.connect(g); g.connect(master);
  src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
}

const SOUNDS = {
  tick: () => tone({ type: 'triangle', f0: 920, f1: 700, dur: 0.045, gain: 0.07 }),
  ching: ({ pitch = 1 } = {}) => {
    tone({ type: 'triangle', f0: 1568 * pitch, dur: 0.45, gain: 0.16 });
    tone({ type: 'sine', f0: 2093 * pitch, dur: 0.55, gain: 0.11, delay: 0.045 });
    tone({ type: 'sine', f0: 3136 * pitch, dur: 0.25, gain: 0.04, delay: 0.045 });
  },
  pop: () => tone({ type: 'sine', f0: 640, f1: 170, dur: 0.12, gain: 0.26 }),
  plink: ({ pitch = 1 } = {}) => tone({ type: 'sine', f0: 1320 * pitch, f1: 1290 * pitch, dur: 0.22, gain: 0.14 }),
  squish: ({ pitch = 1 } = {}) => { noise({ dur: 0.16, gain: 0.3, f: 900 * pitch, f1: 260, q: 2.5 }); tone({ type: 'sine', f0: 240 * pitch, f1: 80, dur: 0.14, gain: 0.18 }); },
  creak: () => {
    tone({ type: 'sawtooth', f0: 96, f1: 68, dur: 1.1, a: 0.08, gain: 0.13, filter: { f: 460, q: 7 }, vib: { rate: 11, depth: 7 } });
    noise({ dur: 0.9, gain: 0.05, f: 300, q: 8, delay: 0.1, a: 0.2 });
  },
  foghorn: () => {
    tone({ type: 'sawtooth', f0: 98, f1: 93, dur: 1.7, a: 0.15, gain: 0.15, filter: { f: 360, q: 2 } });
    tone({ type: 'sawtooth', f0: 147, f1: 140, dur: 1.7, a: 0.15, gain: 0.08, filter: { f: 420, q: 2 } });
  },
  thunk: () => { tone({ type: 'sine', f0: 150, f1: 55, dur: 0.22, gain: 0.36 }); noise({ dur: 0.05, gain: 0.12, f: 2200, q: 0.8 }); },
  // crowd "HEY": detuned voices through a vowel-ish bandpass
  chant: ({ pitch = 1 } = {}) => { for (let i = 0; i < 5; i++) tone({ type: 'sawtooth', f0: (180 + i * 23) * pitch, f1: (160 + i * 20) * pitch, dur: 0.34, a: 0.03, gain: 0.05, filter: { type: 'bandpass', f: 760, q: 3 } }); },
  goal: () => { tone({ type: 'triangle', f0: 659, dur: 0.18, gain: 0.12 }); tone({ type: 'triangle', f0: 988, dur: 0.32, gain: 0.12, delay: 0.11 }); },
  done: () => { tone({ type: 'triangle', f0: 784, dur: 0.16, gain: 0.12 }); tone({ type: 'triangle', f0: 1047, dur: 0.16, gain: 0.12, delay: 0.09 }); tone({ type: 'triangle', f0: 1319, dur: 0.3, gain: 0.12, delay: 0.18 }); },
  open: () => noise({ dur: 0.16, gain: 0.05, f: 500, f1: 1800, q: 1.2 }),
  close: () => noise({ dur: 0.14, gain: 0.04, f: 1600, f1: 500, q: 1.2 }),
  alert: () => { tone({ type: 'sine', f0: 1046, dur: 0.12, gain: 0.13 }); tone({ type: 'sine', f0: 784, dur: 0.2, gain: 0.13, delay: 0.12 }); },
  toot: () => { tone({ type: 'square', f0: 330, f1: 315, dur: 0.22, gain: 0.06, filter: { f: 900 } }); tone({ type: 'square', f0: 330, f1: 315, dur: 0.3, gain: 0.06, filter: { f: 900 }, delay: 0.28 }); },
  bark: () => { noise({ dur: 0.09, gain: 0.25, f: 700, q: 3 }); tone({ type: 'sawtooth', f0: 420, f1: 260, dur: 0.1, gain: 0.08, filter: { f: 1200 } }); },
  buzz: () => tone({ type: 'sawtooth', f0: 210, dur: 0.5, gain: 0.04, filter: { type: 'bandpass', f: 600, q: 4 }, vib: { rate: 30, depth: 12 } }),
  // dialogue babble: one soft syllable, pitched per speaker
  babble: ({ pitch = 1 } = {}) => tone({ type: 'triangle', f0: 420 * pitch * (0.92 + Math.random() * 0.16), f1: 360 * pitch, dur: 0.055, gain: 0.05 }),
};
const CAPTIONS = {
  ching: 'ching!', pop: 'pop', plink: 'plink', squish: 'squish', creak: 'a low creak...', foghorn: 'BWAAAMP (foghorn)', thunk: 'thunk',
  chant: 'the crowd chants', alert: 'ding-dong', toot: 'toot toot', bark: 'woof!', buzz: 'bzzz',
};
const QUIET = new Set(['tick', 'babble', 'open', 'close', 'goal', 'done']);

export function play(name, opts) {
  const now = performance.now();
  if (now - (last.get(name) || 0) < (name === 'babble' ? 50 : 35)) return null;  // no machine-gunning
  last.set(name, now);
  if (S.sound && SOUNDS[name]) { try { SOUNDS[name](opts || {}); } catch { /* audio is best effort */ } }
  return QUIET.has(name) ? null : CAPTIONS[name] || null;
}
// (only after the player has touched the page: browsers refuse, and complain in the console, before that)
export function haptic(ms = 8) { if (S.haptics && navigator.userActivation?.hasBeenActive !== false) { try { navigator.vibrate?.(ms); } catch { /* not supported */ } } }
export const SOUND_NAMES = Object.keys(SOUNDS);
