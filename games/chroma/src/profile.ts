import {
  parseSave,
  recordRun,
  SAVE_KEY,
  type RunResult,
  type Save,
  type Settings,
} from "./save";

// The one owner of the player's save. localStorage can throw (private mode,
// quota, blocked storage); the game keeps running on the in-memory copy.
function read(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

function write(save: Save): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Progress lives on in memory for this session.
  }
}

let current: Save = parseSave(read());

export function profile(): Save {
  return current;
}

export function updateSettings(patch: Partial<Settings>): Save {
  current = { ...current, settings: { ...current.settings, ...patch } };
  write(current);
  return current;
}

export function commitRun(run: RunResult): Save {
  current = recordRun(current, run);
  write(current);
  return current;
}

export function resetStats(): Save {
  current = { ...parseSave(null), settings: current.settings };
  write(current);
  return current;
}
