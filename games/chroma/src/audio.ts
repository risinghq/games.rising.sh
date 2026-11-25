import Phaser from "phaser";
import { newSeed, stream } from "./run";

// Owns every sound the game makes. The music and most effects are synthesized
// on Phaser's AudioContext, all in C major, so a hit plays a note that fits the
// tune and a streak climbs the scale. Only the two impacts are samples.

export const SAMPLES = ["splat", "plank"] as const;

const BEAT = 0.56;
const MUSIC_LEVEL = 0.4;
const SFX_LEVEL = 0.9;

// Sixteen bars of waltz: a chord per bar and a melody of three beats per bar.
// In the melody, 0 holds the previous note.
const CHORDS: Record<string, { bass: number; triad: number[] }> = {
  C: { bass: 48, triad: [60, 64, 67] },
  Am: { bass: 45, triad: [57, 60, 64] },
  F: { bass: 41, triad: [53, 57, 60] },
  G: { bass: 43, triad: [55, 59, 62] },
};
const PROGRESSION = [
  "C",
  "C",
  "Am",
  "Am",
  "F",
  "F",
  "G",
  "G",
  "C",
  "C",
  "Am",
  "Am",
  "F",
  "G",
  "C",
  "C",
];
// prettier-ignore
const MELODY = [
  76, 76, 79,  84, 0, 83,  81, 0, 76,  72, 0, 0,
  77, 77, 81,  84, 0, 81,  79, 0, 74,  71, 0, 0,
  76, 76, 79,  84, 0, 88,  86, 84, 81, 76, 0, 0,
  77, 81, 84,  83, 0, 86,  84, 0, 79,  72, 0, 0,
];
// C major pentatonic from C5: each hit in a streak plays the next step.
const STREAK_SCALE = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93];

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

interface Graph {
  ctx: AudioContext;
  music: GainNode;
  sfx: GainNode;
  noise: AudioBuffer;
  samples: Map<string, AudioBuffer>;
}

let graph: Graph | null = null;
let musicOn = true;
let sfxOn = true;
let playing = false;
let ducked = false;
let step = 0;
let nextBeat = 0;
let tempo = 1;
let intensity = 1;
// Noise and pitch jitter; reseeded when the audio starts.
let rand = stream(0, "audio");

export function initAudio(
  scene: Phaser.Scene,
  music: boolean,
  sfx: boolean,
): void {
  rand = stream(newSeed(), "audio");
  musicOn = music;
  sfxOn = sfx;
  if (graph || !(scene.sound instanceof Phaser.Sound.WebAudioSoundManager))
    return;
  const ctx = scene.sound.context;

  const master = ctx.createDynamicsCompressor();
  master.connect(ctx.destination);
  const musicBus = ctx.createGain();
  musicBus.gain.value = music ? MUSIC_LEVEL : 0;
  musicBus.connect(master);
  // A short echo gives the music box a room to play in.
  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.28;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.28;
  const wet = ctx.createGain();
  wet.gain.value = 0.25;
  musicBus.connect(echo).connect(feedback).connect(echo);
  echo.connect(wet).connect(master);
  const sfxBus = ctx.createGain();
  sfxBus.gain.value = sfx ? SFX_LEVEL : 0;
  sfxBus.connect(master);

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = rand() * 2 - 1;

  const samples = new Map<string, AudioBuffer>();
  for (const key of SAMPLES) {
    const buffer: unknown = scene.cache.audio.get(key);
    if (buffer instanceof AudioBuffer) samples.set(key, buffer);
  }
  graph = { ctx, music: musicBus, sfx: sfxBus, noise, samples };
  setInterval(schedule, 50);
}

export function setMusicEnabled(on: boolean): void {
  musicOn = on;
  applyMusicLevel();
}

export function setSfxEnabled(on: boolean): void {
  sfxOn = on;
  if (graph)
    graph.sfx.gain.setTargetAtTime(
      on ? SFX_LEVEL : 0,
      graph.ctx.currentTime,
      0.05,
    );
}

function applyMusicLevel() {
  if (!graph) return;
  const level = musicOn && playing ? MUSIC_LEVEL * (ducked ? 0.35 : 1) : 0;
  graph.music.gain.setTargetAtTime(level, graph.ctx.currentTime, 0.15);
}

export function startMusic(): void {
  if (playing) return;
  playing = true;
  step = 0;
  nextBeat = 0;
  applyMusicLevel();
}

export function stopMusic(): void {
  playing = false;
  applyMusicLevel();
}

// Paused games keep the tune going quietly.
export function duckMusic(on: boolean): void {
  ducked = on;
  applyMusicLevel();
}

// Later waves play faster and add a ticking hi-hat.
export function setIntensity(wave: number): void {
  intensity = wave;
  tempo = Math.min(1.3, 1 + 0.04 * (wave - 1));
}

// Look-ahead scheduler: queue every beat that falls in the next 150 ms. A
// suspended context (hidden tab, no gesture yet) queues nothing, and a late
// timer skips the missed beats instead of playing them in a burst.
function schedule() {
  if (!graph || !playing || graph.ctx.state !== "running") return;
  const now = graph.ctx.currentTime;
  if (nextBeat < now) nextBeat = now + 0.05;
  while (nextBeat < now + 0.15) {
    playBeat(step, nextBeat);
    nextBeat += BEAT / tempo;
    step = (step + 1) % MELODY.length;
  }
}

function playBeat(i: number, t: number) {
  const beat = i % 3;
  const chord = CHORDS[PROGRESSION[Math.floor(i / 3)]!]!;
  const beatLen = BEAT / tempo;
  if (beat === 0) voice(t, freq(chord.bass), "sine", 0.22, 0.01, 0.5, "music");
  else
    for (const note of chord.triad)
      voice(t, freq(note), "triangle", 0.035, 0.005, 0.16, "music", 1800);
  const note = MELODY[i]!;
  if (note > 0) {
    let held = 1;
    while (MELODY[(i + held) % MELODY.length] === 0) held++;
    musicBox(t, note, held * beatLen, "music", 0.13);
  }
  if (intensity >= 3)
    hiss(t, 0.03, "highpass", 7000, beat === 0 ? 0.05 : 0.03, "music");
}

type Bus = "music" | "sfx";

function voice(
  t: number,
  hz: number,
  type: OscillatorType,
  peak: number,
  attack: number,
  decay: number,
  bus: Bus,
  lowpass?: number,
  glideTo?: number,
) {
  if (!graph) return;
  const { ctx } = graph;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(hz, t);
  if (glideTo)
    osc.frequency.exponentialRampToValueAtTime(glideTo, t + attack + decay);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  let out: AudioNode = osc.connect(env);
  if (lowpass) {
    const filter = ctx.createBiquadFilter();
    filter.frequency.value = lowpass;
    out = out.connect(filter);
  }
  out.connect(graph[bus]);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

// A plucked comb: the fundamental and a slightly detuned octave that dies first.
function musicBox(
  t: number,
  midi: number,
  length: number,
  bus: Bus,
  peak: number,
) {
  const decay = Math.min(1.6, length + 0.5);
  voice(t, freq(midi), "sine", peak, 0.004, decay, bus);
  voice(t, freq(midi) * 2.005, "sine", peak * 0.3, 0.002, decay * 0.4, bus);
}

function hiss(
  t: number,
  length: number,
  type: BiquadFilterType,
  hz: number,
  peak: number,
  bus: Bus,
) {
  if (!graph) return;
  const { ctx } = graph;
  const src = ctx.createBufferSource();
  src.buffer = graph.noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = hz;
  const env = ctx.createGain();
  env.gain.setValueAtTime(peak, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + length);
  src.connect(filter).connect(env).connect(graph[bus]);
  src.start(t, rand() * 0.5, length + 0.02);
}

function sample(key: (typeof SAMPLES)[number], gain: number, rate: number) {
  const buffer = graph?.samples.get(key);
  if (!graph || !buffer) return;
  const src = graph.ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const env = graph.ctx.createGain();
  env.gain.value = gain;
  src.connect(env).connect(graph.sfx);
  src.start();
}

// Effects return early when nothing can play, so callers never check.
function now(): number | null {
  if (!graph || !sfxOn || graph.ctx.state !== "running") return null;
  return graph.ctx.currentTime;
}

const jitter = () => 0.94 + rand() * 0.12;

export const sfx = {
  // The cork gun's pop.
  shoot() {
    const t = now();
    if (t === null) return;
    hiss(t, 0.05, "bandpass", 1700 * jitter(), 0.3, "sfx");
    voice(t, 520 * jitter(), "sine", 0.18, 0.003, 0.07, "sfx", undefined, 170);
  },
  // Wet paint, then a note that climbs the scale with the streak.
  splat(streak: number) {
    const t = now();
    if (t === null) return;
    sample("splat", 0.55, jitter());
    const note =
      STREAK_SCALE[Math.min(Math.max(streak - 1, 0), STREAK_SCALE.length - 1)]!;
    musicBox(t + 0.02, note, 0.3, "sfx", 0.16);
  },
  golden() {
    const t = now();
    if (t === null) return;
    sample("splat", 0.45, 1.1);
    [84, 88, 91, 96].forEach((n, i) =>
      musicBox(t + i * 0.06, n, 0.4, "sfx", 0.14),
    );
  },
  // Two rising bloops: the paints swirl together.
  mix() {
    const t = now();
    if (t === null) return;
    sample("splat", 0.35, 1.25);
    voice(t, 330, "sine", 0.16, 0.01, 0.16, "sfx", undefined, 620);
    voice(t + 0.11, 440, "sine", 0.14, 0.01, 0.18, "sfx", undefined, 880);
  },
  // A sour, sinking chord: too many paints make mud.
  ruin() {
    const t = now();
    if (t === null) return;
    sample("splat", 0.6, 0.62);
    voice(t, 220, "sawtooth", 0.09, 0.01, 0.5, "sfx", 900, 140);
    voice(t, 233, "sawtooth", 0.09, 0.01, 0.5, "sfx", 900, 148);
  },
  // Shooting a decoy knocks a wooden board.
  decoy() {
    const t = now();
    if (t === null) return;
    sample("plank", 0.8, jitter());
    voice(t, 140, "sine", 0.25, 0.005, 0.22, "sfx", undefined, 60);
  },
  // A slide whistle falling away.
  escape() {
    const t = now();
    if (t === null) return;
    voice(t, 900, "triangle", 0.1, 0.02, 0.4, "sfx", 3000, 380);
  },
  wave() {
    const t = now();
    if (t === null) return;
    [72, 76, 79, 84].forEach((n, i) =>
      musicBox(t + i * 0.1, n, i === 3 ? 0.9 : 0.2, "sfx", 0.15),
    );
  },
  gameOver() {
    const t = now();
    if (t === null) return;
    [79, 76, 72, 60].forEach((n, i) =>
      musicBox(t + i * 0.28, n, i === 3 ? 1.4 : 0.3, "sfx", 0.15),
    );
  },
  record() {
    const t = now();
    if (t === null) return;
    [72, 76, 79, 84, 88, 91].forEach((n, i) =>
      musicBox(t + 1.3 + i * 0.07, n, 0.5, "sfx", 0.13),
    );
  },
  click() {
    const t = now();
    if (t === null) return;
    voice(t, 1250, "sine", 0.1, 0.002, 0.05, "sfx");
    hiss(t, 0.02, "highpass", 4000, 0.06, "sfx");
  },
};
