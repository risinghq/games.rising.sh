// [D] Every tap answers (plan §3.4): a tap on the world that has nothing else to open dispatches world/poke and shows the
// answer in a caption anchored over the thing (api.captionAt, caption.js), so it reads as the object talking. Locked things
// (the rows before Gran's plan, the barn before September, the stand before opening day) answer with their stop and date
// instead of the old "later" toasts. The toys keep their instant sound (input.js); the words come from the sim.
// The first time the player sits idle in year 1's spring, one poke target sparkles for a few seconds ('ui/idle', n === 1).
//
// Import order matters: app.js imports this after the slices, so the taps it wraps (row, barn, hives, stand, lot, giant,
// toy) are already registered and keep doing what they do once their thing is open.
import { REG, registerTap, registerEvent } from './registry.js';
import { $, el, icon } from './dom.js';
import { anchored } from './pins.js';
import { PLACES, rowZ } from '../sim/layout.js';
import { T } from '../sim/tuning.js';
import { dayOf, isWeekend } from '../sim/calendar.js';
import type { State, OutEvent } from '../sim/types.js';
import type { Api, TapHandler } from './types.js';
import { Hit } from '../render/types.js';
// where each thing's caption sits (world points; a row's at the tap)
const TOP = { hives: [-4.8, 1.5, -16.2], lighthouse: [16.6, 5.6, -16.2], scarecrow: [-1.6, 2.7, 6], boat: [14.6, 0.8, 8], barn: [-14, 5.2, -14],
  stand: [-5, 2.4, -7.6], lot: [-18, 0.6, -5], scale: [-16.4, 1.6, 17.1], giant: [PLACES.giant.x, 1.5, PLACES.giant.z], corn: [4.3, 2.4, -8.4],
  dock: [13, 0.3, 6], cottage: [13.9, 4.8, -18.2], sign: [PLACES.sign.x, 1.9, PLACES.sign.z] };
const LIFT = { biscuit: 0.9, farmer: 2, row: 0.5, sea: 0.2 };
function anchor(id: string, hit: { x: any; z: any; id: unknown; }) {
  const t = TOP[id];
  return t ? { x: t[0], y: t[1], z: t[2] } : { x: hit.x ?? 0, y: LIFT[id] ?? 0.6, z: hit.z ?? (id === 'row' ? rowZ(hit.id) : 0) };
}

// The poke itself: the sim's answer over the thing.
export function poke(api: Api, id: string|number|null, hit: Hit, extra = {}) {
  const s = api.s();
  if (!s) return null;
  const r = api.dispatch({ type: 'world/poke', id, ...extra, quiet: true });
  if (!r.ok || !r.text) return null;
  // a locked thing: its stop and countdown on a line of their own ("Plan October · May 20 · 9 days")
  const i = r.text.indexOf(' · '), text = i > 0 ? `${r.text.slice(0, i)}\n${r.text.slice(i + 3)}` : r.text;
  api.captionAt(anchor(id, hit), text, { cls: r.note ? 'note' : r.burst ? 'burst' : i > 0 ? 'locked' : null });
  if (r.note) api.sound('plink', { pitch: 1.4 });
  return r;
}

// ------------------------------------------------------------ taps: the thing's own sheet when it's open, else its answer
const wrap = (kind: string, fn: { (hit: any,api: Api,e: any,orig: any): void; (hit: any,api: Api,e: any,orig: any): void; (hit: any,api: Api,e: any,orig: any): void; (hit: any,api: Api,e: any,orig: any): void; (hit: any,api: Api,e: any,orig: any): void; (hit: any,api: Api,e: any,orig: any): void; (hit: any,api: Api,e: any,orig: any): void; (arg0: Hit,arg1: Api,arg2: PointerEvent,arg3: TapHandler|undefined): void; }) => { const orig = REG.taps.get(kind); registerTap(kind, (hit, api: Api, e) => fn(hit, api, e, orig)); };
const weekend = (s: State) => s.clock.phase === 'october' && isWeekend(s.clock.day);
const growing = (s: State) => s.clock.phase === 'grow' || s.clock.phase === 'october';
// a tap that its own handler answered by opening something (a sheet, a screen) needs no caption
const opened = (api: Api, fn: { (): any; (): any; (): void; }) => { const before = api.currentSheet(); fn(); return api.currentSheet() !== before && !!api.currentSheet(); };

wrap('row', (hit: { id: string|number; }, api: Api, e: any, orig: (arg0: any,arg1: Api,arg2: any) => void) => {
  const s = api.s(), row = s.patch?.rows?.[hit.id];
  if ((!row?.open && !weekend(s)) || !s.unlocks.patch) poke(api, 'row', hit, { row: hit.id });
  else orig?.(hit, api, e);
});
wrap('barn', (hit: any, api: Api, e: any, orig: (arg0: any,arg1: Api,arg2: any) => void) => { if (api.s().unlocks.barn) orig?.(hit, api, e); else poke(api, 'barn', hit); });
wrap('hives', (hit: any, api: Api, e: any, orig: (arg0: any,arg1: Api,arg2: any) => void) => {
  const s = api.s();
  if (s.unlocks.hives || (s.clock.year > 1 && s.patch?.honeyReady >= 1)) orig?.(hit, api, e);
  else { api.sound('buzz'); poke(api, 'hives', hit); }
});
wrap('stand', (hit: any, api: Api, e: any, orig: (arg0: any,arg1: Api,arg2: any) => any) => { if (!opened(api, () => orig?.(hit, api, e))) poke(api, 'stand', hit); });
wrap('lot', (hit: any, api: Api, e: any, orig: (arg0: any,arg1: Api,arg2: any) => any) => { if (!opened(api, () => orig?.(hit, api, e))) poke(api, 'lot', hit); });
wrap('giant', (hit: any, api: Api, e: any, orig: (arg0: any,arg1: Api,arg2: any) => void) => { if (growing(api.s())) orig?.(hit, api, e); else poke(api, 'giant', hit); });
registerTap('farmer', (hit, api: Api) => poke(api, 'farmer', hit));
registerTap('poke', (hit, api: Api) => poke(api, hit.id, hit));

// the toys: their sound first (input.js, season.js), then their words; the lighthouse counts its blasts
const TOYS = new Set(['lighthouse', 'scarecrow', 'boat', 'biscuit']);
const blasts: number[] = [];
wrap('toy', (hit: { id: string; }, api: Api, e: any, orig: (arg0: any,arg1: Api,arg2: any) => void) => {
  orig?.(hit, api, e);
  if (!TOYS.has(hit.id)) return;
  let burst = 0;
  if (hit.id === 'lighthouse') {
    const now = performance.now(), B = T.pokes.burst;
    blasts.push(now);
    while (blasts.length && now - blasts[0] > B.ms) blasts.shift();
    if (blasts.length >= B.n) { burst = blasts.length; blasts.length = 0; }
  }
  poke(api, hit.id, hit, burst ? { burst } : {});
});

// ------------------------------------------------------------ the first idle: something on the farm twinkles
// (the first one on screen, in this order: one that's off screen would twinkle for nobody)
const SPARKLE = [['hives', -4.8, 1.3, -16.2], ['lighthouse', 16.6, 4.6, -16.2], ['scarecrow', -1.6, 2.4, 6], ['sign', PLACES.sign.x, 1.6, PLACES.sign.z],
  ['boat', 14.6, 0.6, 8]];
let lastDown = -1e9;
addEventListener('pointerdown', () => { lastDown = performance.now(); }, { capture: true, passive: true });
registerEvent('ui/idle', (ev: OutEvent, api: Api) => {
  const s = api.s(), I = T.pokes.idleSparkle;
  if (ev.n !== 1 || !s || s.clock.year !== 1 || s.clock.phase !== 'grow' || s.clock.day >= dayOf(I.until) || !api.R?.fx) return;
  // A player who starts her seed and watches sits idle just as SHE'S UP arrives: good news has the screen, and the star
  // waits for its banner to go (a star over the sign next to "SHE'S UP" reads as part of it). A tap meanwhile cancels it.
  const t0 = performance.now();
  const go = () => {
    if (lastDown > t0) return;
    if (!document.body.classList.contains('banner-on')) twinkle(api, s);
    else if (performance.now() - t0 < I.waitMs) setTimeout(go, 250);
  };
  go();
});
function twinkle(api: Api, s: State) {
  const I = T.pokes.idleSparkle;
  const seen = SPARKLE.filter(([, x, y, z]) => { const p = api.R.project?.(x, y, z); return p && p.visible !== false && p.x > 0 && p.x < innerWidth && p.y > 60 && p.y < innerHeight - 150; });
  if (!seen.length) return;
  const [, x, y, z] = seen[s.seed % seen.length];
  // a gold star over it, drawn on the screen (3D sparks are a few pixels at Home zoom), with the sparks around it
  const hint = el('div.poke-hint', { html: icon('sparkle') });
  $('#pins').append(hint);
  anchored.set(hint, { pos: () => ({ x, y, z }), lift: 8 });
  const t0 = performance.now();
  const tw = () => {
    if (performance.now() - t0 > I.ms) { anchored.delete(hint); hint.remove(); return; }
    api.R.fx({ type: 'sparkle', x, y, z, n: 10 });
    setTimeout(tw, 600);
  };
  tw();
}
