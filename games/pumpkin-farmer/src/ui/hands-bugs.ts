// [E] The bug hunt (plan §3.14, rulings R0, R18): the close-up on a row's squash bugs. Its ways in are the bug pin (a hand:
// "touch this") and the Hunt button in the Row sheet's bug panel (the slot track B's Row sheet keeps for it). Inside:
//   - the camera comes down to the row front-on (T.hands.fit), the bugs a little bigger, three big leaves around them;
//   - tap a bug: squish (a splat, a pop, "Squish!"), a blip a semitone higher for every quick one after it; squishes within
//     T.hands.comboS chain (x2, x3...) and at x5 Gran's face pops up: "Ooh, paws!";
//   - each squish sends the near ones running for a leaf; one that gets under it hides and the leaf wiggles: tap it and it
//     flips, and they scatter back into the open;
//   - picking is forgiving: the live bug nearest the finger within T.hands.reachPx (a moving 14 px bug is a small target);
//   - the ring: T.hands.timerS (half again with Simple gestures). Clear the row: "Row clear!" and Gran's line. When the ring
//     runs out: "They've gone to ground." The rest stay on the row with their pin (hunt again).
// The hunt itself (bugs, flee, leaves, combo) is src/sim/hunt.js, so the bots and the balance tests play the same thing; the
// result is one patch/hunt { row, hits } (the sim clamps it).
import { el, icon } from './dom.js';
import { registerHands, registerPin } from './registry.js';
import { registerRowPanel } from './patch.js';
import { openHands } from './hands.js';
import { T } from '../sim/tuning.js';
import { rowZ } from '../sim/layout.js';
import { bugSpot } from '../sim/patch.js';
import { createHunt, stepHunt, squish, flip, live, left, bugsShown, LINES } from '../sim/hunt.js';
import { fill } from '../sim/util.js';
import type { State } from '../sim/types.js';
import type { Api } from './types.js';
import { Renderer,Projected } from '../render/types.js';
const TH = T.hands, BUG_Y = 0.42, LEAF_Y = 0.47, GREEN = 0x7fa043;
const inSeason = (s: State) => s.clock.phase === 'grow' || s.clock.phase === 'october';
const timerOf = (api: Api) => TH.timerS * (api.settings.simpleGestures ? TH.simpleTimer : 1);
let hunt: { hidden?: any; r?: any; H: any; said?: any; }|null = null;          // the open hunt: { r, H, hidden, said }

// (only over bugs that are there: a pin tapped as its row clears opens nothing rather than an empty hunt)
export const openHunt = (api: Api, r: number) => api.s()?.patch.rows[r]?.bugs > 0 && openHands(api, 'hunt', r);
const dist = (a: { x: number; y: number; }, b: { x: number; y: number; }) => Math.hypot(a.x - b.x, a.y - b.y);

registerHands({
  id: 'hunt', speaker: 'gran',
  frame: (s: any, r: unknown) => ({ x: bugSpot(r), z: rowZ(r), fit: TH.fit, az: 0 }),
  hint: () => LINES.hint,
  timer: timerOf,
  start(K, r) {
    const row = K.api.s().patch.rows[r];
    const H = createHunt({ n: bugsShown(row.bugs), cx: bugSpot(r), cz: rowZ(r), seed: (Math.random() * 4294967296) >>> 0,
      fast: K.api.settings.reduceMotion ? 0.5 : 1, timerS: K.timer });
    hunt = { r, H, hidden: 0, said: false };
    K.R.fx({ type: 'hunt/start', row: r, hunt: H });
    K.count(`${left(H)} left`);
  },
  // a touch: the nearest live bug within reach on the screen, else a wiggling leaf, else a miss (a ripple, nothing more)
  down(pt: { x: any; y: any; }, K: { api?: Api; R?: Renderer; arg?: any; timer?: any; left?: () => number; hint?: (text: any,speaker: any) => void; count?: (text: any) => void; combo?: (text: any,at: any) => void; big?: (text: any,cls?: string) => void; project: any; ground: any; juice: any; end?: (reason: any) => void; }) {
    const { H } = hunt;
    let bi = -1, bd = TH.reachPx;
    H.bugs.forEach((b: { x: any; z: any; h?: number|undefined; st?: any; t?: number|undefined; leaf?: number|undefined; at?: number|undefined; }, i: number) => { if (live(b)) { const d = dist(K.project(b.x, BUG_Y, b.z), pt); if (d <= bd) { bd = d; bi = i; } } });
    if (bi >= 0) { squished(K, squish(H, bi), pt); return; }
    const k = H.leaves.findIndex((L: { hid: any; open: any; x: any; z: any; }) => L.hid && !L.open && dist(K.project(L.x, LEAF_Y, L.z), pt) <= TH.leafReachPx);
    if (k >= 0) {
      const L = H.leaves[k], n = flip(H, k);
      K.juice.blip('open'); K.juice.buzz(8);
      K.juice.pop(L.x, LEAF_Y + 0.2, L.z, 0x6f9a5a, 6);
      K.juice.float(n > 1 ? fill(LINES.found.many, { n }) : LINES.found.one, L.x, 0.95, L.z, 'good');
      return;
    }
    const g = K.ground(pt.x, pt.y);
    if (g) K.juice.ripple(g.x, g.z, 0xdfe7e1);
    K.juice.blip('tick'); K.juice.buzz(6);
  },
  update(dt: number, K: { api?: Api; R?: Renderer; arg?: any; timer?: any; left?: () => number; hint: any; count?: (text: any) => void; combo?: (text: any,at: any) => void; big?: (text: any,cls?: string) => void; project?: (x: any,y: any,z: any) => Projected; ground?: (px: any,py: any) => { x: number; z: number; }|null; juice?: { ripple: (x: any,z: any,color: any) => void; pop: (x: any,y: any,z: any,color: any,n: any,sparkles?: number) => void; sparkle: (x: any,y: any,z: any,n: any) => void; float: (text: any,x: any,y: any,z: any,cls: any) => void; blip: (name: any,step?: number) => void; buzz: (ms: any) => void; }; end: any; }) {
    const { H } = hunt;
    stepHunt(H, dt);
    const hid = H.leaves.reduce((a: any, L: { hid: any; }) => a + L.hid, 0);
    if (hid > hunt.hidden) K.hint(LINES.hid, 'gran');
    hunt.hidden = hid;
    if (H.over === 'clear') K.end('clear');
  },
  finish: () => ({ type: 'patch/hunt', row: hunt.r, hits: hunt.H.hits }),
  // the ending: "Row clear!" with a sparkle down the row, or "They've gone to ground." Gran's line from the result.
  ended(res: { cleared: any; line: any; }, K: { count: (arg0: string) => void; hint: (arg0: any,arg1: string) => void; combo: (arg0: string) => void; big: (arg0: string,arg1: string) => void; api: { sound: (arg0: string) => void; }; juice: { buzz: (arg0: number) => void; sparkle: (arg0: number,arg1: number,arg2: number,arg3: number) => void; }; }, reason: string) {
    const { H, r } = hunt, x = bugSpot(r), z = rowZ(r);
    if (reason === 'done' && !res?.cleared) return;
    const clear = !!res?.cleared;
    K.count(clear ? '' : `${left(H)} left`);
    if (res?.line) K.hint(res.line, 'gran');
    K.combo('');
    K.big(clear ? LINES.done.clear : LINES.done.ground, clear ? 'good' : '');
    if (clear) {
      K.api.sound('done'); K.juice.buzz(10);
      for (let k = 0; k < 5; k++) K.juice.sparkle(x - 1.6 + k * 0.8, 0.5, z, 2);
    } else K.api.sound('thunk');
  },
  close(K: { R: { fx: (arg0: { type: string; }) => void; }; }) { K.R.fx({ type: 'hunt/end' }); hunt = null; },
});

// a squish's juice: the splat is the render's; the pop, the rising blip and the word are here ("Squish!" over the bug,
// then one combo badge over the finger that grows with the chain)
function squished(K: { juice: { pop: (arg0: any,arg1: number,arg2: any,arg3: number,arg4: number,arg5: number) => void; blip: (arg0: string,arg1: number) => void; buzz: (arg0: number) => void; float: (arg0: string,arg1: any,arg2: number,arg3: any,arg4: string) => void; }; combo: (arg0: string,arg1: undefined) => void; count: (arg0: string) => void; hint: (arg0: string,arg1: string) => void; }, res: { combo: any; clear: boolean; x: any; z: any; }|null, pt: any) {
  if (!res) return;
  const { H } = hunt, c = res.combo;
  K.juice.pop(res.x, BUG_Y, res.z, GREEN, 7, c >= 3 ? 1 : 0);
  K.juice.blip('squish', c - 1); K.juice.buzz(6 + Math.min(4, c));
  if (c === 1) { K.juice.float(LINES.squish, res.x, 0.9, res.z, 'good'); K.combo(''); } else K.combo(`×${c}`, pt);
  K.count(left(H) ? `${left(H)} left` : '');
  if (c === TH.comboGran && !hunt.said) { hunt.said = true; K.hint(LINES.combo, 'gran'); }
}

// ------------------------------------------------------------ the ways in
// The bug pin: a hand (the task-pin look with a hand glyph, plan §2.2). It never alerts and never stops Skip (the cluster's
// own alert does what it does); it hides while a close-up is open.
for (let r = 0; r < T.patch.rows; r++) {
  registerPin({ id: `bugs-${r}`, icon: 'hand', label: `Hunt the bugs on row ${r + 1}`, urgent: () => true,
    when: (s: State) => inSeason(s) && s.patch.rows[r]?.bugs > 0 && (s.unlocks.bugs || s.clock.year > 1) && !s.clock.hands,
    pos: () => ({ x: bugSpot(r), y: 0.7, z: rowZ(r) }), onTap: (api) => openHunt(api, r) });
}
// The Row sheet's bug panel: how many, and the two answers side by side (the hunt is free; the spray is sure, and costs).
registerRowPanel('bugs', (api: Api, s: State, r: any, row: { bugs: number; set: any; }) => {
  const n = bugsShown(row.bugs), B = T.patch.bugs, L = LINES.panel;
  return el('div.alertbox.bugs.huntbox', {},
    el('div', {}, el('b', { text: `Bugs: ${n}` }), ` ${n >= 8 ? L.big : L.small}`),
    el('div.huntacts', {},
      el('button.btn.primary.hunt', { 'data-target': `row:${r}`, onclick: () => openHunt(api, r) },
        el('span', { html: `${icon('hand', 's')} Hunt` }), el('span.sub', { text: fill(L.hunt, { s: Math.round(timerOf(api)) }) })),
      // (a spray after fruit set keeps the bee bonus: then all it says is how long it keeps them off)
      el('button.btn.spray', { disabled: s.cash < B.spray, onclick: () => { if (api.dispatch({ type: 'patch/spray', row: r }).ok) { api.sound('pop'); api.haptic(10); } } },
        el('span', { text: `Spray · $${B.spray}` }), el('span.sub', { text: row.set ? fill(L.sprayLate, { d: B.block }) : L.spray }))));
});
