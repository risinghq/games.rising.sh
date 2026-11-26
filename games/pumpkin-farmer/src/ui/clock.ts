// The app clock's multiplier (plan §2.3): the frame loop runs the sim at realDt x clockMul(...). Pure (no DOM), so the
// stop-while-planning rule is tested in Node.
//   0           a registered planning sheet is open (registerPlanning: the Planting Table): the clock is stopped
//   bulletTime  an October weekend with any sheet open (0.5x, as before)
//   quiet.mul   a quiet growing day and the "Hurry quiet days" setting is on (off by default, rulings R10)
//   1           otherwise
import { REG } from './registry.js';
import { quiet } from '../sim/story.js';
import { makeCtx } from '../sim/game.js';
import { T } from '../sim/tuning.js';
import type { State } from '../sim/types.js';
import type { Settings } from './types.js';

export function planningOpen(s: State, sheetId: string|null, arg: unknown) {
  const when = sheetId && REG.planning.get(sheetId);
  if (!when) return false;
  try { return !!when(s, arg); } catch { return false; }
}
// ui: { sheetId, sheetArg, settings, livePins (DOM pins on screen now), quietNow (quiet(s) if the caller has it cached) }
export function clockMul(s: State | null, { sheetId = null, sheetArg, settings = {}, livePins = 0, quietNow }: { sheetId?: string | null; sheetArg?: unknown; settings?: Partial<Settings>; livePins?: number; quietNow?: boolean } = {}) {
  if (!s) return 1;
  if (planningOpen(s, sheetId, sheetArg)) return 0;
  const c = s.clock;
  if (c.phase === 'october' && c.sub === 'weekend') return sheetId ? T.clock.bulletTime : 1;
  if (!settings.hurryQuiet || c.phase !== 'grow' || !(c.speed > 0 && c.speed <= 4) || sheetId || livePins) return 1;
  return (quietNow ?? quiet(s, makeCtx(s))) ? T.road.quiet.mul : 1;
}
