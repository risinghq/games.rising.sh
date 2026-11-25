export const SAVE_KEY = "chroma.save";
const VERSION = 1;

export interface Settings {
  colorblind: boolean;
  music: boolean;
  sfx: boolean;
}

export interface Stats {
  runs: number;
  shots: number;
  hits: number;
  bestScore: number;
  bestStreak: number;
  bestWave: number;
  mixes: number;
  ruins: number;
  playMs: number;
  // Ducks painted, keyed by colour mask.
  painted: Record<string, number>;
}

export interface Save {
  version: number;
  settings: Settings;
  stats: Stats;
}

export interface RunResult {
  score: number;
  shots: number;
  hits: number;
  bestStreak: number;
  wave: number;
  mixes: number;
  ruins: number;
  playMs: number;
  painted: Record<string, number>;
}

export function emptySave(): Save {
  return {
    version: VERSION,
    settings: { colorblind: false, music: true, sfx: true },
    stats: {
      runs: 0,
      shots: 0,
      hits: 0,
      bestScore: 0,
      bestStreak: 0,
      bestWave: 0,
      mixes: 0,
      ruins: 0,
      playMs: 0,
      painted: {},
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Keeps only fields whose type matches the default, so a damaged or older save
// still loads and loses only the fields it got wrong.
function merge<T extends object>(defaults: T, raw: unknown): T {
  if (!isRecord(raw)) return defaults;
  const out: Record<string, unknown> = {
    ...(defaults as Record<string, unknown>),
  };
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = raw[key];
    if (isRecord(fallback))
      out[key] = isRecord(value) ? { ...fallback, ...value } : fallback;
    else if (typeof value === typeof fallback) out[key] = value;
  }
  return out as T;
}

export function parseSave(text: string | null): Save {
  const fresh = emptySave();
  if (!text) return fresh;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fresh;
  }
  if (!isRecord(raw)) return fresh;
  // The first release had one sound switch; a player who muted it wants quiet.
  if (isRecord(raw.settings) && raw.settings.muted === true) {
    fresh.settings.music = false;
    fresh.settings.sfx = false;
  }
  return {
    version: VERSION,
    settings: merge(fresh.settings, raw.settings),
    stats: merge(fresh.stats, raw.stats),
  };
}

export function recordRun(save: Save, run: RunResult): Save {
  const s = save.stats;
  const painted = { ...s.painted };
  for (const [mask, count] of Object.entries(run.painted)) {
    painted[mask] = (painted[mask] ?? 0) + count;
  }
  return {
    ...save,
    stats: {
      runs: s.runs + 1,
      shots: s.shots + run.shots,
      hits: s.hits + run.hits,
      bestScore: Math.max(s.bestScore, run.score),
      bestStreak: Math.max(s.bestStreak, run.bestStreak),
      bestWave: Math.max(s.bestWave, run.wave),
      mixes: s.mixes + run.mixes,
      ruins: s.ruins + run.ruins,
      playMs: s.playMs + run.playMs,
      painted,
    },
  };
}

export function accuracy(shots: number, hits: number): number {
  return shots === 0 ? 0 : Math.round((hits / shots) * 100);
}
