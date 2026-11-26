// The commercial patch view [slice: patch] (design §4): 7 dynamic rows plus the patch's props elsewhere on the tile
// (the barn pile, honey jars on the hives, a swarm, the volunteer vine). Reads s.patch (see src/sim/patch.js) and never
// mutates it.
//
// Per row: bramble lumps, canes and berries until a row is cleared; tilled soil (darker after watering, via
// world.paintRow); by progress: sprouts (5), spreading vines (20), yellow blossoms in the bee window (40), green fruit
// growing with progress (55), ripe fruit in variety colours, soft fruit slumped (y x 0.8) and darkened, rotten brown
// lumps for a few days. "The field is the store": each variety shows round(slots x stock / yield) pumpkins (16 slots
// large, 28 mini), so a picked-over row visibly empties; rows can hold restocked varieties. Each fruit keeps its slot
// (green ripens in place, a sale removes one), so a row never reshuffles. Leaves droop and yellow when the patch is dry
// (M < 0.3), wear white dust with mildew and brown off when a row is done; squash bugs crawl in a visible cluster; a
// shiny twinkles; a seed-packet stake marks a planned row and a red flag a row that won't make it by Oct 25.
// [B] (plan §3.9, rulings R18) From the day Gran plans October the open rows are tilled furrows (two ridges a row); a planned
// or young row's stake carries a flag naming the weekends it is for ("W2–3"); a sowing day puffs dust along the row, pops
// its flag and sends Biscuit running down it; Water All straightens drooping rows in a wave from the hose end (the perk
// wave, 0.8 s: the only thing that animates a row's leaves, besides their redraw).
// Instance matrices are rewritten only when a row's signature changes (bugs, glints and the swarm animate every frame).
// fx: tap/squash on a row (bounce), patch/ripe (sparkle), patch/watered (splashes), patch/squish (green pop),
//     patch/cut, patch/restock, patch/planted, patch/cleared, patch/honeyCollected, patch/swarm, patch/volunteer.
// Sets K.bloom (blossom positions) so the bees commute to flowering rows.
import * as THREE from 'three';
import {
  PI, clamp, lerp, smooth, rng, M, PM, VARIETY, GREENS, PG, PG_WART, PG_LO, PG_WART_LO, lodFar, STEM, ICO0, ICO1, CYL8, BOX, pool, hideAt, billboards, starTex, canvasTex,
} from './kit.js';
import { ROWS, rowZ, PLACES, SWARM_SPOTS, VINE_SPOTS } from '../sim/layout.js';
import { bugsShown, seatBugs, FLEE, HID, DEAD } from '../sim/hunt.js';   // [E] the bug hunt
import { T } from '../sim/tuning.js';
import { bugSpot, rowTargets, spanText } from '../sim/patch.js';
import { brambleGrazed } from '../sim/mischief.js';
import { own } from '../sim/util.js';
import type { State } from '../sim/types.js';
import type { Kit, FxEvent } from './types.js';
import type { PatchRow, PatchRowBy, PatchRowStock, PatchVolunteer } from '../sim/state.js';
const N = ROWS.count, SLOTS = { large: T.patch.display.large, mini: T.patch.display.mini };
type SlotKind = keyof typeof SLOTS;
const BRAM_W = -9.8, BRAM_E = 6.6;                       // [A] a bramble row's lumps span x -9.2 .. 5.8 (+ a little)
const LEAF_X = 38, LEAVES = LEAF_X * 2, VINES = 16, BLOOMS = 8, BUGS = 14, ROT = 10, BRAM = 18, CANES = 16, BERRIES = 10;
const PILE = 18, JARS = 12, SWARM = 28, VLEAVES = 9;
const HUNT_SCALE = 1.4;                                   // [E] bugs in a hunt's close-up are drawn this much bigger
const LEAF_COLS = [0x7d9a6a, 0x6b8a5c, 0x8fa877, 0x78935f, 0x9aae7c];
const VT = T.varieties, yieldOf = (v: string | null) => own(VT, v ?? '')?.fruit ?? 80, dtmOf = (v: string) => own(VT, v)?.dtm ?? 90;
// what the title screen shows: the prototype's full, ripe patch
const DEMO_ROWS = ['classic', 'white', 'classic', 'blue', 'mini', 'cinderella', 'warty'].map((v) => {
  const n = Math.round(yieldOf(v) * 0.62);
  return { open: true, variety: v, plantedDay: 70, progress: 130, stage: 'ripe', stock: { green: 0, prime: n, soft: 0, rotten: 0 }, by: { [v]: { green: 0, prime: n, soft: 0 } }, health: 1 };
});

/** One variety's look (kit's VARIETY row). */
type VarietyArt = (typeof VARIETY)[keyof typeof VARIETY];
/** A display slot: which (variety, state) it holds; c 0 empty, 1 green, 2 prime, 3 soft. */
interface Slot { c: number; v: string | null }
/** What view() normalises a sim row into for drawing. */
interface RowView {
  open: boolean; v: string | null; planted: boolean; prog: number; by: Record<string, PatchRowBy>;
  rotten: number; health: number; bugs: number; mildew: number; shiny: boolean; done: boolean; late: boolean;
  plan: string | null; set: number; furrow: boolean; flag: string | null; grazed: number;
}
/** The part of a sim row (or a fixture / the demo diorama) view() tolerates. */
type RowLike = Partial<PatchRow> & Pick<PatchRow, 'open'>;
/** Per-row draw state: the signature the instances were last drawn for, and the live animation fields. */
interface RowState {
  sig: string; kind: SlotKind | null; slots: Slot[] | null; bounce: number; soil: string; bugs: number;
  shiny: boolean; w: RowView | null; squishT: number; dryDrawn: boolean; perk: number; bounceNow: number;
}

const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
const mixHex = (a: number, b: number, k: number) => tmpC.setHex(a).lerp(tmpC2.setHex(b), k);

// How many of each (variety, state) a row shows: the display rule per variety, split by state.
function wantedSlots(w: RowView, cap: number) {
  const want = new Map<string, number>();
  let used = 0;
  const order = Object.keys(w.by).sort((a, b) => (a === w.v ? -1 : b === w.v ? 1 : 0));
  for (const v of order) {
    const b = w.by[v], total = (b?.green ?? 0) + (b?.prime ?? 0) + (b?.soft ?? 0);
    if (!b || total <= 0) continue;
    const slots = own(VT, v)?.large === false ? SLOTS.mini : SLOTS.large;
    const n = Math.min(cap - used, Math.min(slots, Math.max(1, Math.round(slots * total / yieldOf(v)))));
    if (n <= 0) break;
    used += n;
    const pr = Math.round(n * b.prime / total), so = Math.min(n - pr, Math.round(n * b.soft / total));
    const split: [number, number][] = [[2, pr], [3, so], [1, n - pr - so]];
    for (const [c, k] of split) if (k > 0) want.set(`${v}|${c}`, k);
  }
  return want;
}
// Move slots toward the wanted (variety, state) counts with as few visible changes as possible: ripening converts
// in place (green -> prime -> soft), sales clear slots from the back of the order, new fruit fills from the front.
function settle(slots: Slot[], order: readonly number[], want: Map<string, number>) {
  const have = new Map<string, number>();
  const key = (sl: Slot) => `${sl.v}|${sl.c}`;
  for (const sl of slots) if (sl.c) have.set(key(sl), (have.get(key(sl)) || 0) + 1);
  const n = (k: string) => have.get(k) || 0, w = (k: string) => want.get(k) || 0;
  const vs = new Set([...want.keys(), ...have.keys()].map((k) => k.split('|')[0]));
  for (const v of vs) for (const a of [1, 2]) {
    const b = a + 1;
    let k = Math.min(n(`${v}|${a}`) - w(`${v}|${a}`), w(`${v}|${b}`) - n(`${v}|${b}`));
    for (const i of order) {
      if (k <= 0) break;
      const sl = slots[i];
      if (sl && sl.v === v && sl.c === a) { sl.c = b; have.set(`${v}|${a}`, n(`${v}|${a}`) - 1); have.set(`${v}|${b}`, n(`${v}|${b}`) + 1); k--; }
    }
  }
  for (let j = order.length - 1; j >= 0; j--) {
    const i = order[j], sl = i === undefined ? undefined : slots[i];
    if (sl && sl.c && n(key(sl)) > w(key(sl))) { have.set(key(sl), n(key(sl)) - 1); sl.c = 0; sl.v = null; }
  }
  for (const [k, cnt] of want) {
    let need = cnt - n(k);
    const v = k.slice(0, k.indexOf('|')), c = +k.slice(k.indexOf('|') + 1);
    for (const i of order) { const sl = slots[i]; if (need <= 0 || !sl) break; if (!sl.c) { sl.c = c; sl.v = v; need--; } }
    have.set(k, cnt - Math.max(0, need));
  }
}

export default function createPatchView(K: Kit) {
  const { scene } = K;
  const root = new THREE.Group(); root.name = 'patch'; scene.add(root);
  const pumpMat = PM(0xffffff);
  const pumps = pool(PG, pumpMat, N * SLOTS.mini + PILE + 1, true, root);
  const warts = pool(PG_WART, pumpMat, N * SLOTS.large + PILE, true, root);
  const stems = pool(STEM, M(0x6e6a3e), N * SLOTS.mini + PILE + 1, false, root);
  const leafGeo = new THREE.CircleGeometry(1, 6);
  { const lp = leafGeo.getAttribute('position'); for (let i = 1; i < lp.count; i++) { const f = i % 2 ? 1 : 0.72; lp.setXY(i, lp.getX(i) * f, lp.getY(i) * f); } }
  leafGeo.rotateX(-PI / 2); leafGeo.translate(0, 0, 0.5);
  const leaves = pool(leafGeo, M(0xffffff, { side: THREE.DoubleSide }), N * LEAVES + VLEAVES, true, root);
  const vines = pool(new THREE.CylinderGeometry(0.035, 0.035, 1, 4).rotateZ(PI / 2), M(0x6f7f4a), N * VINES + 3, false, root);
  const blooms = pool(new THREE.ConeGeometry(0.1, 0.18, 5).rotateX(PI), M(0xf2c14e, { emissive: 0x5a3a00, emissiveIntensity: 0.3 }), N * BLOOMS, false, root);
  const lumps = pool(ICO1, M(0xffffff), N * (BRAM + ROT), true, root);           // brambles and rotten fruit
  const canes = pool(new THREE.CylinderGeometry(0.02, 0.035, 1, 4).translate(0, 0.5, 0), M(0x6a4a4e), N * CANES, false, root);
  const berries = pool(ICO0, M(0x3d2a3e, { roughness: 0.5 }), N * BERRIES, false, root);
  const bugs = pool(ICO0, M(0x2f2a26, { roughness: 0.4 }), N * BUGS, false, root);
  const posts = pool(BOX, M(0xb9a88d), N, false, root);
  const tags = pool(BOX, M(0xffffff, { emissive: 0x222222, emissiveIntensity: 0.15 }), N, false, root);
  const jars = pool(CYL8, M(0xd9a443, { roughness: 0.3, emissive: 0x6a3a00, emissiveIntensity: 0.35 }), JARS, false, root);
  const swarm = pool(ICO0, M(0xe8b64a, { emissive: 0x3a2600, emissiveIntensity: 0.3 }), SWARM, false, root);
  const glint = billboards(N + 2, { map: starTex(), blending: THREE.AdditiveBlending });
  root.add(glint.mesh);
  // [B] furrows, and the stake flags' labels: one atlas of the weekend spans, a sprite a row (shown only on planned and
  // young rows, so at most a few draw calls)
  const ridges = pool(BOX, M(0x6b4a30, { roughness: 1 }), N * 2, false, root);
  const LABELS = ['W1', 'W2', 'W3', 'W4', 'W1–2', 'W2–3', 'W3–4', 'W1–3', 'W2–4', 'W1–4', 'Oct'];
  const ATLAS = { cols: 4, rows: 3, w: 512, h: 192 };
  const atlas = canvasTex(ATLAS.w, ATLAS.h, (g, w, h) => {
    const cw = w / ATLAS.cols, ch = h / ATLAS.rows;
    LABELS.forEach((t, i) => {
      const x = (i % ATLAS.cols) * cw, y = Math.floor(i / ATLAS.cols) * ch;
      g.fillStyle = '#fff8ea'; g.strokeStyle = '#7a5a3c'; g.lineWidth = 5;
      g.beginPath(); g.roundRect(x + 4, y + 4, cw - 8, ch - 8, 12); g.fill(); g.stroke();
      g.fillStyle = '#4a3624'; g.font = '900 40px "Nunito Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t, x + cw / 2, y + ch / 2 + 2);
    });
  });
  const flagTex = (label: string) => {
    const i = Math.max(0, LABELS.indexOf(label)), t = atlas.clone();
    t.repeat.set(1 / ATLAS.cols, 1 / ATLAS.rows);
    t.offset.set((i % ATLAS.cols) / ATLAS.cols, 1 - (Math.floor(i / ATLAS.cols) + 1) / ATLAS.rows);
    t.needsUpdate = true;
    return t;
  };
  const flags = Array.from({ length: N }, (): { sp: THREE.Sprite; label: string | null; pop: number } => {
    // (no fog: Marlene would wash a little card to a white blank)
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false }));
    sp.visible = false; sp.renderOrder = 2; root.add(sp);
    return { sp, label: null, pop: 0 };
  });
  const targetCache = new Map<number, { key: string; label: string | null }>();

  // fixed, seeded layout per row: slots for each size class, leaves, vines, blossoms, brambles, rot, bugs
  const L = Array.from({ length: N }, (_, r) => {
    const z = rowZ(r), R = rng(5000 + r * 37);
    const slotsFor = (kind: SlotKind) => {
      const S = SLOTS[kind], step = 15.3 / S;
      const s = Array.from({ length: S }, (_, i) => ({ x: -9.1 + (i + 0.5) * step + R.rr(-0.22, 0.22) * step, z: z + R.rr(-0.35, 0.35), rx: R.rr(-0.08, 0.08), ry: R.rand() * PI * 2, rz: R.rr(-0.08, 0.08), u: R.rand(), c: R.rand(), sr: R.rr(-0.3, 0.3), sx: R.rr(-0.4, 0.4) }));
      const order = s.map((_, i) => i).sort(() => R.rand() - 0.5);
      return { s, order };
    };
    const leaf = [];
    for (let k = 0; k < LEAF_X; k++) for (const side of [-1, 1]) leaf.push({ k, side, x: -9.3 + k * 0.42 + R.rr(-0.15, 0.15), zo: R.rr(0.25, 0.7), s: R.rr(0.32, 0.5), y: R.rr(0.18, 0.4), rx: R.rr(-0.5, 0.2), ry: R.rand() * PI * 2, rz: R.rr(-0.3, 0.3), c: R.pick(LEAF_COLS), mil: R.rand() });
    const vine = Array.from({ length: VINES }, (_, i) => ({ x0: -9.4 + i, z0: z + R.rr(-0.15, 0.15), x1: -8.4 + i, z1: z + R.rr(-0.15, 0.15) }));
    const bloom = Array.from({ length: BLOOMS }, () => new THREE.Vector3(R.rr(-9.2, 6.2), 0.32, z + R.rr(-0.3, 0.3)));
    const bramble = Array.from({ length: BRAM }, (_, i) => ({ x: -9.2 + i * 0.88 + R.rr(-0.3, 0.3), z: z + R.rr(-0.45, 0.45), s: R.rr(0.38, 0.62), sy: R.rr(0.5, 0.75), ry: R.rand() * 3, c: R.pick([0x55603f, 0x4d5a3a, 0x5f6a43, 0x5a5236, 0x4a5538]) }));
    const cane = Array.from({ length: CANES }, () => ({ x: R.rr(-9.3, 6.3), z: z + R.rr(-0.6, 0.6), h: R.rr(0.6, 1.1), rx: R.rr(-0.9, 0.9), rz: R.rr(-0.9, 0.9) }));
    const berry = Array.from({ length: BERRIES }, () => ({ x: R.rr(-9.2, 6.2), z: z + R.rr(-0.5, 0.5), y: R.rr(0.25, 0.5) }));
    const rot = Array.from({ length: ROT }, () => ({ x: R.rr(-9, 6), z: z + R.rr(-0.4, 0.4), s: R.rr(0.26, 0.38), ry: R.rand() * 3, c: R.pick([0x3f3a2c, 0x4a4434, 0x6f7358, 0x5a4a34]) }));
    const cluster = bugSpot(r);   // squash bugs gather around one spot on the row (the bug pin points at it)
    const bug = Array.from({ length: BUGS }, () => ({ dx: R.rr(-0.9, 0.9), dz: R.rr(-0.55, 0.55), a: R.rand() * 6, sp: R.rr(0.6, 1.4), r: R.rr(0.05, 0.16) }));
    return { z, large: slotsFor('large'), mini: slotsFor('mini'), leaf, vine, bloom, bramble, cane, berry, rot, cluster, bug };
  });
  const st = Array.from({ length: N }, (): RowState => ({ sig: '', kind: null, slots: null, bounce: 0, soil: '', bugs: 0, shiny: false, w: null, squishT: 0, dryDrawn: false, perk: 0, bounceNow: 0 }));
  // the barn pile: pumpkins stacked either side of the barn door, as many as the barn holds (scaled to its capacity)
  const PILE_AT = (() => {
    const R = rng(777), out: { x: number; z: number; y: number; ry: number; c: number; u: number }[] = [];
    for (let i = 0; i < PILE; i++) {
      const side = i % 2 ? 1 : -1, k = i >> 1, layer = k < 6 ? 0 : 1;
      out.push({ x: PLACES.barn.x + side * (1.75 + (k % 3) * 0.42 + (layer ? 0.21 : 0)) + R.rr(-0.05, 0.05), z: -10.55 + (Math.floor((k % 6) / 3)) * -0.42 + R.rr(-0.06, 0.06),
        y: layer * 0.3, ry: R.rand() * 6, c: R.rand(), u: R.rand() });
    }
    return out;
  })();

  // normalise a sim row (tolerant of missing fields, so fixtures and the title diorama work too)
  function view(row: RowLike | null): RowView {
    const v = row?.variety && own(VARIETY, row.variety) ? row.variety : null;
    const planted = !!v && row?.plantedDay != null;
    const prog = planted ? row?.progress ?? 0 : 0;
    const stock: PatchRowStock = row?.stock || { green: 0, prime: 0, soft: 0, rotten: 0 };
    const by = row?.by && Object.keys(row.by).length ? row.by : v ? { [v]: { green: stock.green || 0, prime: stock.prime || 0, soft: stock.soft || 0 } } : {};
    return { open: row?.open !== false, v, planted, prog, by, rotten: stock.rotten || 0, health: row?.health ?? 1, bugs: row?.bugs ?? 0, mildew: row?.mildew ?? 0,
      shiny: !!row?.shiny, done: row?.stage === 'done', late: !!row?.late && row?.stage !== 'ripe' && row?.stage !== 'done', plan: row?.plan?.variety || null, set: row?.set || 0,
      furrow: false, flag: null, grazed: 0 };
  }

  // [A] Pamela's grazing (plan §3.3; rulings R5: the payoff shows at once): each goat-day clears a sixth of a bramble row's
  // lumps, canes and berries, from the east end (the path) inwards. grazed: lumps eaten (sim mischief.brambleGrazed).
  const grazedCut = (grazed: number) => (grazed > 0 ? BRAM_E - (grazed / BRAM) * (BRAM_E - BRAM_W) : Infinity);
  function drawRow(r: number, w: RowView, M_: number, bounce: number) {
    const lay = L[r], S = st[r];
    if (!lay || !S) return;
    const z = lay.z;
    // ---- brambles (until the row is cleared) and rotten lumps (for a few days after fruit rots)
    const xCut = grazedCut(w.grazed);
    for (let i = 0; i < BRAM; i++) {
      const b = lay.bramble[i], k = r * (BRAM + ROT) + i;
      if (!b || w.open || b.x > xCut) { hideAt(lumps, k); continue; }
      e.set(0, b.ry, 0); lumps.setMatrixAt(k, m4.compose(p.set(b.x, b.s * b.sy * 0.55, b.z), q.setFromEuler(e), sc.set(b.s, b.s * b.sy, b.s * 0.9)));
      lumps.setColorAt(k, tmpC.setHex(b.c));
    }
    const nRot = w.open && w.v ? Math.min(ROT, Math.ceil(ROT * w.rotten / (yieldOf(w.v) * 0.5))) : 0;
    for (let i = 0; i < ROT; i++) {
      const o = lay.rot[i], k = r * (BRAM + ROT) + BRAM + i;
      if (!o || i >= nRot) { hideAt(lumps, k); continue; }
      e.set(0.15, o.ry, 0.1); lumps.setMatrixAt(k, m4.compose(p.set(o.x, 0.05, o.z), q.setFromEuler(e), sc.set(o.s, o.s * 0.38, o.s * 0.85)));
      lumps.setColorAt(k, tmpC.setHex(o.c));
    }
    for (let i = 0; i < CANES; i++) {
      const c = lay.cane[i], k = r * CANES + i;
      if (!c || w.open || c.x > xCut) { hideAt(canes, k); continue; }
      e.set(c.rx, 0, c.rz); canes.setMatrixAt(k, m4.compose(p.set(c.x, 0, c.z), q.setFromEuler(e), sc.set(1, c.h, 1)));
    }
    for (let i = 0; i < BERRIES; i++) {
      const b = lay.berry[i], k = r * BERRIES + i;
      if (!b || w.open || b.x > xCut) { hideAt(berries, k); continue; }
      berries.setMatrixAt(k, m4.compose(p.set(b.x, b.y + 0.2, b.z), q.identity(), sc.setScalar(0.06)));
    }
    // ---- leaves: sprout pairs grow into the prototype's spreading leaves; dry droops them; done browns them off
    const prog = w.prog, sprout = smooth(prog, 5, 20), spread = smooth(prog, 20, 40), dry = M_ < T.patch.moisture.dry && !w.done;
    S.dryDrawn = dry && w.planted;
    for (let i = 0; i < LEAVES; i++) {
      const l = lay.leaf[i], k = r * LEAVES + i;
      if (!l) continue;
      const visible = w.open && w.planted && prog >= 5 && (prog >= 20 || l.k % 2 === 0) && !(w.done && l.k % 3 === 0);
      if (!visible) { hideAt(leaves, k); continue; }
      // [B] droop: 1 while thirsty; just watered, it lifts in a wave from the hose end (x0) along the row (the perk wave)
      const droop = dry ? 1 : S.perk > 0 ? 1 - clamp((S.perk - 0.45 * (l.x - ROWS.x0) / (ROWS.x1 - ROWS.x0)) / 0.3, 0, 1) : 0;
      const sc0 = lerp(0.1, 0.22, sprout), s = lerp(sc0, l.s, spread) * (prog >= 20 ? 1 : 0.9) * (w.done ? 0.8 : 1) * (w.late ? 0.85 : 1);
      const lz = z + l.side * lerp(0.1, l.zo, spread), ly = lerp(0.05, l.y, spread) * lerp(1, 0.6, droop) * (w.done ? 0.5 : 1);
      e.set(prog < 20 ? -0.6 : l.rx + 0.7 * droop + (w.done ? 0.5 : 0), prog < 20 ? (l.side > 0 ? 0 : PI) + l.rz : l.ry, l.rz);
      leaves.setMatrixAt(k, m4.compose(p.set(l.x, ly, lz), q.setFromEuler(e), sc.setScalar(s)));
      let col = tmpC.setHex(l.c);
      if (w.done) col = mixHex(l.c, 0x8f7a52, 0.65);
      else {
        if (w.mildew > 0 && l.mil < 0.3 + w.mildew * 0.65) col.lerp(tmpC2.setHex(0xeef0e6), 0.35 + w.mildew * 0.35);
        if (droop > 0) col.lerp(tmpC2.setHex(0xb8ac5e), 0.38 * droop);
        if (w.health < 0.85) col.lerp(tmpC2.setHex(0xb8a858), (0.85 - w.health) * 1.4);
      }
      leaves.setColorAt(k, col);
    }
    // ---- vines and blossoms (the bee window)
    const vl = w.open && w.planted ? clamp((prog - 16) / 22, 0, 1) : 0;
    for (let i = 0; i < VINES; i++) {
      const v = lay.vine[i], k = r * VINES + i;
      if (!v || vl <= 0) { hideAt(vines, k); continue; }
      e.set(0, -Math.atan2(v.z1 - v.z0, v.x1 - v.x0), 0);
      vines.setMatrixAt(k, m4.compose(p.set((v.x0 + v.x1) / 2, 0.07, (v.z0 + v.z1) / 2), q.setFromEuler(e), sc.set(Math.hypot(v.x1 - v.x0, v.z1 - v.z0) * vl, 1, 1)));
    }
    const bl = w.open && w.planted ? smooth(prog, 38, 42) * (1 - smooth(prog, 58, 64)) : 0;
    for (let i = 0; i < BLOOMS; i++) {
      const b = lay.bloom[i], k = r * BLOOMS + i;
      if (!b || bl <= 0.01) { hideAt(blooms, k); continue; }
      blooms.setMatrixAt(k, m4.compose(p.set(b.x, b.y + 0.09, b.z), q.identity(), sc.setScalar(bl * 1.15)));
    }
    // ---- furrows: two ridges along a tilled row once Gran plans October (and every year after)
    for (let k = 0; k < 2; k++) {
      const idx = r * 2 + k;
      if (!w.open || !w.furrow || (w.planted && prog >= 40)) { hideAt(ridges, idx); continue; }
      ridges.setMatrixAt(idx, m4.compose(p.set((ROWS.x0 + ROWS.x1) / 2, 0.02, z + (k ? 0.22 : -0.22)), q.identity(), sc.set(ROWS.x1 - ROWS.x0 + 0.4, 0.05, 0.09)));
    }
    // ---- stakes: a seed packet in the variety's colour on a planned or young row (with its weekends on a flag above it);
    // a red flag on a row that won't make it
    const stake = w.open && (w.plan || w.late || (w.flag && w.planted));
    if (stake) {
      posts.setMatrixAt(r, m4.compose(p.set(ROWS.x0 - 0.1, 0.5, z + 0.55), q.identity(), sc.set(0.08, 1.0, 0.08)));
      const hex = w.late ? 0xc9553a : own(VARIETY, w.plan || w.v || '')?.cols[0] ?? 0xd8762c;
      e.set(0, 0.6, w.late ? 0 : 0.05);
      tags.setMatrixAt(r, m4.compose(p.set(ROWS.x0 - 0.1 + (w.late ? 0.2 : 0), 0.85, z + 0.55), q.setFromEuler(e), w.late ? sc.set(0.4, 0.24, 0.03) : sc.set(0.38, 0.46, 0.04)));
      tags.setColorAt(r, tmpC.setHex(hex));
    } else { hideAt(posts, r); hideAt(tags, r); }
    // ---- pumpkins: settle which slots hold which (variety, state)
    if (!w.open || !Object.keys(w.by).length) { S.slots = null; return; }
    const main = w.v || Object.keys(w.by)[0] || '';
    const kind: SlotKind = own(VT, main)?.large === false ? 'mini' : 'large';
    if (S.kind !== kind || !S.slots) { S.kind = kind; S.slots = Array.from({ length: SLOTS[kind] }, (): Slot => ({ c: 0, v: null })); }
    settle(S.slots, lay[kind].order, wantedSlots(w, SLOTS[kind]));
    S.bounceNow = bounce;
  }

  // Pack every visible pumpkin into the front of its pool and draw only that many instances (hidden slots cost no
  // vertices; a full patch is ~140 pumpkins). The barn pile and the volunteer pumpkin share the pools.
  let pileSig = '', vSig = '';
  function drawPumpkins(s: State | null) {
    let np = 0, nw = 0, ns = 0;
    const put = (wart: boolean, x: number, y: number, z: number, rx: number, ry: number, rz: number, sxz: number, sy: number, hex: number | THREE.Color, stemOn: boolean, V: VarietyArt) => {
      const im = wart ? warts : pumps, k = wart ? nw++ : np++;
      e.set(rx, ry, rz);
      im.setMatrixAt(k, m4.compose(p.set(x, y, z), q.setFromEuler(e), sc.set(sxz, sy, sxz)));
      im.setColorAt(k, typeof hex === 'number' ? tmpC.setHex(hex) : hex);
      if (stemOn) { e.set(rx * 2, 0, rz * 2); stems.setMatrixAt(ns++, m4.compose(p.set(x, y + V.geo.userData.top * sy - 0.03, z), q.setFromEuler(e), sc.setScalar(sxz * 2.4))); }
    };
    for (let r = 0; r < N; r++) {
      const S = st[r];
      if (!S || !S.slots || !S.w?.open) continue;
      const w = S.w;
      const set = S.kind ? L[r]?.[S.kind] : undefined, bounce = S.bounceNow || 0;
      if (!set) continue;
      for (let i = 0; i < S.slots.length; i++) {
        const sl0 = S.slots[i];
        if (!sl0) continue;
        const { c, v } = sl0, sl = set.s[i], V = v ? own(VARIETY, v) : undefined;
        if (!c || !V || !sl) continue;
        const home = v === w.v && w.planted;
        const fp = home ? clamp((w.prog - 55) / Math.max(1, dtmOf(v ?? '') - 55), 0, 1) : 1, greenS = lerp(0.35, 0.95, fp);
        const sz = lerp(V.s[0], V.s[1], sl.u) * (c === 1 ? greenS : 1), soft = c === 3;
        const sy = sz * V.sy * (soft ? T.patch.aging.softSlump * 0.85 : 1) * (1 - bounce * 0.3), sxz = sz * (1 + bounce * 0.15) * (soft ? 1.1 : 1);
        const hex = c === 1 ? GREENS[(sl.c * 3) | 0] ?? 0x7d9550 : V.cols[(sl.c * V.cols.length) | 0] ?? 0xd8762c;
        put(V.geo === PG_WART, sl.x, 0, sl.z, sl.rx + (soft ? 0.22 : 0), sl.ry, sl.rz + (soft ? 0.12 : 0), sxz, sy, soft ? mixHex(hex, 0x5a3d28, 0.58) : hex, true, V);
      }
    }
    // barn pile, scaled to the barn's capacity, in the barn's mix of varieties
    const barn = s?.patch?.barn || {}, cap = s?.patch && (s.owned?.loft ? T.patch.barn.loft : T.patch.barn.cap);
    const total = Object.values(barn).reduce((a, b) => a + b, 0), shown = cap ? Math.min(PILE, Math.ceil(PILE * total / cap)) : 0;
    const vs = Object.entries(barn).filter(([, n]) => n > 0).flatMap(([v, n]) => Array(Math.max(1, Math.round(shown * n / Math.max(1, total)))).fill(v));
    for (let i = 0; i < shown; i++) {
      const a = PILE_AT[i];
      if (!a) continue;
      const v = vs[i % Math.max(1, vs.length)] || 'classic', V = own(VARIETY, v) ?? VARIETY.classic, sz = lerp(V.s[0], V.s[1], a.u) * 0.9;
      put(V.geo === PG_WART, a.x, a.y, a.z, 0, a.ry, 0, sz, sz * V.sy, V.cols[(a.c * V.cols.length) | 0] ?? 0xd8762c, true, V);
    }
    // the volunteer vine's one pumpkin, green until Oct 1
    const vv = s?.patch?.volunteer;
    if (vv && vv.state !== 'harvested') {
      const sp = own(VINE_SPOTS, vv.spot), k = volunteerGrowth(s, vv);
      if (sp && k > 0.35) {
        const V = VARIETY.classic, sz = lerp(0.12, 0.4, (k - 0.35) / 0.65);
        put(false, sp.x + 0.25, sp.y, sp.z + 0.1, 0, 1.3, 0, sz, sz, vv.state === 'ripe' ? (vv.shiny ? 0xf0a040 : (V.cols[0] ?? 0xd8762c)) : (GREENS[1] ?? 0x7d9550), true, V);
      }
    }
    pumps.count = np; warts.count = nw; stems.count = ns;
    for (const im of [pumps, warts, stems]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
  const volunteerGrowth = (s: State | null, vv: PatchVolunteer) => (vv.state === 'ripe' ? 1 : clamp(((s?.clock.day ?? 0) - vv.day) / Math.max(1, 183 - vv.day), 0, 1));
  function drawVolunteer(s: State | null) {
    const vv = s?.patch?.volunteer, sp = vv ? own(VINE_SPOTS, vv.spot) : undefined;
    const k = vv && vv.state !== 'harvested' && sp ? volunteerGrowth(s, vv) : 0;
    for (let i = 0; i < VLEAVES; i++) {
      const idx = N * LEAVES + i;
      if (!sp || k <= i / VLEAVES * 0.8) { hideAt(leaves, idx); continue; }
      const a = i * 2.4, rr = 0.2 + i * 0.07;
      e.set(-0.3, a, 0.2);
      leaves.setMatrixAt(idx, m4.compose(p.set(sp.x + Math.cos(a) * rr, sp.y + 0.08, sp.z + Math.sin(a) * rr), q.setFromEuler(e), sc.setScalar(0.22 + 0.16 * k)));
      leaves.setColorAt(idx, tmpC.setHex(LEAF_COLS[i % LEAF_COLS.length] ?? 0x7d9a6a));
    }
    for (let i = 0; i < 3; i++) {
      const idx = N * VINES + i;
      if (!sp || !k) { hideAt(vines, idx); continue; }
      e.set(0, i * 2.1, 0);
      vines.setMatrixAt(idx, m4.compose(p.set(sp.x + Math.cos(i * 2.1) * 0.3, sp.y + 0.05, sp.z - Math.sin(i * 2.1) * 0.3), q.setFromEuler(e), sc.set(0.9 * k, 1, 1)));
    }
  }

  function paintSoil(r: number, w: RowView, M_: number) {
    const wet = clamp((M_ - 0.2) / 0.6, 0, 1), key = !w.open ? 'scrub' : 'soil' + Math.round(wet * 10), S = st[r];
    if (!S || key === S.soil) return;
    S.soil = key;
    K.world.paintRow(r, w.open ? 'soil' : 'scrub', wet);
  }

  const bloomPts: THREE.Vector3[] = [];
  const lod = { far: false };
  function sync(s: State | null, dt: number, t: number) {
    // the field's pumpkins: their far-off twins while they are a few pixels across (instances keep their matrices)
    const far = lodFar(lod, K.cam?.pxPerUnit ?? Infinity);
    pumps.geometry = far ? PG_LO : PG; warts.geometry = far ? PG_WART_LO : PG_WART;
    const rows: RowLike[] = s?.patch?.rows || (s?.patch ? [] : DEMO_ROWS);
    const M_ = s?.patch?.wet ? s.patch.moisture ?? 0.6 : 0.6;
    let dirty = false, bloomDirty = false;
    if (perkPending) { perkPending = false; for (const S of st) if (S.dryDrawn) S.perk = 1e-3; }
    const furrowed = !!s?.patch && (!!s.unlocks?.patch || s.clock.year > 1);
    for (let r = 0; r < N; r++) {
      const w = view(rows[r] ?? (s?.patch ? { open: r < 4 } : null)), S = st[r];
      if (!S) continue;
      w.grazed = w.open || !s ? 0 : brambleGrazed(s, r);               // [A] Pamela's bites
      w.furrow = furrowed;
      w.flag = s?.patch ? flagLabel(s, r, rows[r], w) : null;
      if (S.perk > 0) { S.perk += dt; if (S.perk > 0.9) S.perk = 0; }
      if (S.bounce > 0) S.bounce = Math.max(0, S.bounce - dt * 2.5);
      const b = S.bounce > 0 ? Math.sin(S.bounce * PI * 3) * S.bounce : 0;
      const bySig = Object.entries(w.by).map(([v, x]) => `${v}${x.green},${x.prime},${x.soft}`).join(';');
      const sig = `${w.open}|${w.v}|${w.planted}|${Math.round(w.prog * 2)}|${bySig}|${Math.ceil(w.rotten / 4)}|${M_ < T.patch.moisture.dry}|${Math.round(w.health * 20)}|${w.mildew > 0 ? Math.round(w.mildew * 6) : 0}|${w.done}|${w.late}|${w.plan}|${b.toFixed(3)}|${w.grazed}|${w.furrow}|${w.flag}|${S.perk > 0 ? Math.round(S.perk * 30) : 0}`;
      paintSoil(r, w, M_);
      S.bugs = w.open ? bugsShown(w.bugs) : 0;
      S.shiny = w.shiny; S.w = w;
      if (sig === S.sig) continue;
      if (S.sig.split('|').slice(0, 4).join() !== sig.split('|').slice(0, 4).join()) bloomDirty = true;
      S.sig = sig; dirty = true;
      drawRow(r, w, M_, b);
    }
    const ps = s?.patch ? `${JSON.stringify(s.patch.barn)}|${s.owned?.loft ? 1 : 0}` : '';
    const vv = s?.patch?.volunteer, vs = vv ? `${vv.spot}|${vv.state}|${Math.round(volunteerGrowth(s, vv) * 20)}` : '';
    if (ps !== pileSig || vs !== vSig) { pileSig = ps; dirty = true; }
    if (vs !== vSig) { vSig = vs; drawVolunteer(s); }
    if (dirty) {
      drawPumpkins(s);
      // skip whole pools that have nothing to show (no draw call, no shadow pass)
      const ws = st.map((S) => S.w);
      lumps.visible = ws.some((w) => !w?.open || w.rotten > 0);
      canes.visible = berries.visible = ws.some((w) => !w?.open);
      leaves.visible = ws.some((w) => w?.open && w.planted && w.prog >= 5) || !!vs;
      vines.visible = ws.some((w) => w?.open && w.planted && w.prog > 16) || !!vs;
      blooms.visible = ws.some((w) => w?.open && w.planted && w.prog > 38 && w.prog < 64);
      posts.visible = tags.visible = ws.some((w) => w?.open && (w.plan || w.late || (w.flag && w.planted)));
      ridges.visible = ws.some((w) => w?.open && w.furrow);
      for (const im of [leaves, vines, blooms, lumps, canes, berries, posts, tags, ridges]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    }
    if (bloomDirty) {
      bloomPts.length = 0;
      for (let r = 0; r < N; r++) { const w = st[r]?.w, lay = L[r]; if (lay && w?.open && w.planted && w.prog >= 38 && w.prog < 62) bloomPts.push(...lay.bloom); }
      K.bloom = bloomPts;
    }
    drawFlags(dt, t);
    stepRun(dt);
    animate(s, dt, t);
  }
  // [B] a planned or young row's flag says the weekends it is for (its own projection: patch.rowTargets), until its fruit sets
  function flagLabel(s: State, r: number, row: RowLike | undefined, w: RowView): string | null {
    if (!row?.open || !(row.plan || (w.planted && w.prog < T.patch.fruitSetAt))) return null;
    const key = `${s.clock.year}|${row.plan?.day}|${row.plan?.variety}|${row.plantedDay}|${Math.floor((row.progress || 0) / 10)}`;
    let c = targetCache.get(r);
    if (c?.key !== key) targetCache.set(r, (c = { key, label: spanText(rowTargets(s, r)) || null }));
    return c.label;
  }
  function drawFlags(dt: number, t: number) {
    for (let r = 0; r < N; r++) {
      const F = flags[r], w = st[r]?.w;
      if (!F) continue;
      const label = w?.open ? w.flag : null;
      if (!label) { F.sp.visible = false; continue; }
      if (label !== F.label) { F.label = label; F.sp.material.map?.dispose(); F.sp.material.map = flagTex(LABELS.includes(label) ? label : 'Oct'); F.sp.material.needsUpdate = true; }
      F.pop = Math.max(0, F.pop - dt * 2.2);
      // about 56 px wide on screen at any zoom (readable over the patch, not a billboard over the whole farm from home)
      const ppu = K.cam?.pxPerUnit, fw = clamp(Number.isFinite(ppu) && ppu > 0 ? 56 / ppu : 1.4, 0.7, 2.4);
      const k = 1 + 0.7 * Math.sin(F.pop * PI) * F.pop, bob = 0.03 * Math.sin(t * 2 + r);
      F.sp.visible = true;
      F.sp.position.set(ROWS.x0 - 0.1, 1.1 + fw * 0.25 + bob + 0.25 * F.pop, (L[r]?.z ?? rowZ(r)) + 0.55);
      F.sp.scale.set(fw * k, fw * 0.5 * k, 1);
    }
  }
  // [B] Biscuit runs a newly sown row, end to end, and comes back to where he was (the cast lets him go after)
  const run: { t: number; path: THREE.Vector3[] | null; len: number } = { t: -1, path: null, len: 0 };
  function startRun(z: number) {
    const dog = K.cast?.biscuit;
    if (!dog || run.t >= 0) return;
    const p0 = dog.root.position.clone();
    const path = run.path = [p0, new THREE.Vector3(ROWS.x0 - 0.3, 0, z + 0.42), new THREE.Vector3(ROWS.x1 + 0.3, 0, z + 0.42), p0.clone()];
    run.len = path.slice(1).reduce((a, x, i) => a + x.distanceTo(path[i] ?? x), 0);
    run.t = 0; K.cast.hold('biscuit', true);
  }
  function stepRun(dt: number) {
    if (run.t < 0) return;
    const dog = K.cast?.biscuit, path = run.path;
    if (!dog || !path) return;
    const speed = 6.5;
    run.t += dt;
    let d = Math.min(run.len, run.t * speed), i = 0;
    while (i < path.length - 2) { const a0 = path[i], b0 = path[i + 1]; if (!a0 || !b0 || d <= a0.distanceTo(b0)) break; d -= a0.distanceTo(b0); i++; }
    const a = path[i], b = path[i + 1];
    if (!a || !b) { run.t = -1; K.cast.hold('biscuit', false); return; }
    const k = clamp(d / Math.max(1e-3, a.distanceTo(b)), 0, 1), x = lerp(a.x, b.x, k), z = lerp(a.z, b.z, k);
    dog.root.position.set(x, K.world?.heightAt?.(x, z) ?? 0, z);
    dog.root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    dog.animate(dt, speed, { happy: true });
    if (run.t * speed >= run.len) { run.t = -1; K.cast.hold('biscuit', false); }
  }
  let perkPending = false;

  // every frame: bugs crawl in their cluster (they jump when squished), shinies twinkle, honey jars, the swarm buzzes
  function animate(s: State | null, dt: number, t: number) {
    let bi = 0;
    for (let r = 0; r < N; r++) {
      const S = st[r], lay = L[r];
      if (!S || !lay) { bi += BUGS; continue; }
      if (S.squishT > 0) S.squishT = Math.max(0, S.squishT - dt * 3);
      drawBugs(r, S, lay, t, bi); bi += BUGS;
      const slot = S.shiny && S.slots ? S.slots.findIndex((sl) => sl.c === 2) : -1;
      const sl = slot >= 0 && S.kind ? L[r]?.[S.kind]?.s[slot] : undefined;
      if (sl) {
        const tw = 0.55 + 0.45 * Math.sin(t * 4 + r * 1.7);
        glint.set(r, sl.x, 0.85 + 0.12 * Math.sin(t * 2), sl.z, 0.75 * tw + 0.35, 0.75 * tw + 0.35, 0.6 + 0.4 * tw, 0xfff3c4);
      } else glint.hide(r);
    }
    bugs.instanceMatrix.needsUpdate = true;
    bugs.visible = st.some((S) => S.bugs > 0) || !!K.hunt;
    // the volunteer pumpkin twinkles when it's ripe and shiny
    const vv = s?.patch?.volunteer, sp = vv ? own(VINE_SPOTS, vv.spot) : undefined;
    if (vv && sp && vv.state === 'ripe' && vv.shiny) { const tw = 0.6 + 0.4 * Math.sin(t * 4); glint.set(N, sp.x + 0.25, sp.y + 0.5, sp.z + 0.1, 0.7 * tw + 0.3, 0.7 * tw + 0.3, tw, 0xfff3c4); }
    else glint.hide(N);
    glint.commit();
    glint.mesh.visible = st.some((S) => S.shiny) || !!(vv && sp && vv.shiny && vv.state === 'ripe');
    // honey jars sit on the hives until collected (one per hive first, then a second)
    const ready = Math.floor(s?.patch?.honeyReady || 0), hives = s?.patch?.hives ?? 4, shown = s?.patch && (s.unlocks?.hives || s.clock.year > 1) ? Math.min(JARS, ready, hives * 2) : 0;
    for (let j = 0; j < JARS; j++) {
      if (j >= shown) { hideAt(jars, j); continue; }
      const h: readonly [number, number] = PLACES.hives[j % hives] ?? [0, 0], two = j >= hives ? 1 : 0;
      jars.setMatrixAt(j, m4.compose(p.set(h[0] - 0.18 + two * 0.36, 1.38 + 0.03 * Math.sin(t * 3 + j), h[1]), q.identity(), sc.set(0.11, 0.2, 0.11)));
    }
    jars.instanceMatrix.needsUpdate = true; jars.visible = shown > 0;
    // a swarm: a buzzing knot of bees on its landing spot
    const sw = s?.events?.active?.find((a) => a.id === 'swarm'), spot = sw ? own(SWARM_SPOTS, sw.data?.spot ?? '') : undefined;
    for (let i = 0; i < SWARM; i++) {
      if (!spot) { hideAt(swarm, i); continue; }
      const a = i * 2.39 + t * (2 + (i % 5) * 0.7), rr = 0.25 + (i % 7) * 0.06, y = spot.y + 0.25 + Math.sin(t * 5 + i) * 0.18 + (i % 4) * 0.08;
      swarm.setMatrixAt(i, m4.compose(p.set(spot.x + Math.cos(a) * rr, y, spot.z + Math.sin(a * 1.1) * rr), q.identity(), sc.setScalar(0.055)));
    }
    swarm.instanceMatrix.needsUpdate = true; swarm.visible = !!spot;
  }

  // ---- [E] the bug section (plan §3.14, rulings R18). A row's squash bugs crawl round their cluster; while a bug hunt is
  // open on the row (K.hunt, which render/hands.js keeps from the UI's 'hunt/start') they are where the hunt has them,
  // a little bigger so a thumb can see them: crawling or running for a leaf, under a leaf (a back end peeking out of its
  // rim), squished (flat for a moment; the splat is render/hands.js's). The hunt starts with its bugs where they crawled.
  type RowLay = (typeof L)[number];
  const crawlAt = (lay: RowLay, b: RowLay['bug'][number], t: number, k: number) => {
    const a = b.a + t * b.sp * (1 + k * 4);
    return { a, x: lay.cluster + b.dx + Math.cos(a) * b.r, z: lay.z + b.dz + Math.sin(a * 1.3) * b.r };
  };
  function drawBugs(r: number, S: RowState, lay: RowLay, t: number, b0: number) {
    const hunt = K.hunt?.row === r ? K.hunt.H : null;
    if (hunt && !hunt.seated) seatBugs(hunt, lay.bug.slice(0, hunt.n).map((b) => crawlAt(lay, b, t, 0)));
    for (let i = 0, bi = b0; i < BUGS; i++, bi++) {
      if (hunt) {
        const h = hunt.bugs[i], flat = h && h.st === DEAD ? clamp(1 - (hunt.time - h.at) / 0.35, 0, 1) : 1;
        if (!h || (h.st === DEAD && flat <= 0)) { hideAt(bugs, bi); continue; }
        const k = HUNT_SCALE, squashed = h.st === DEAD;
        if (h.st === HID) {
          // under a leaf: a back end peeks out of its near rim, twitching (the leaf wiggles too: flip it)
          e.set(0, PI + Math.sin(t * 9 + i) * 0.4, 0);
          bugs.setMatrixAt(bi, m4.compose(p.set(h.x + ((i % 3) - 1) * 0.14, 0.4, h.z + 0.38), q.setFromEuler(e), sc.set(0.09 * k, 0.06 * k, 0.12 * k)));
          continue;
        }
        e.set(0, PI / 2 - h.h, 0);
        bugs.setMatrixAt(bi, m4.compose(p.set(h.x, squashed ? 0.36 : 0.42, h.z), q.setFromEuler(e),
          squashed ? sc.set(0.16 * k, 0.015, 0.2 * k) : sc.set(0.11 * k, 0.07 * k, (h.st === FLEE ? 0.17 : 0.15) * k)));
        continue;
      }
      if (i >= S.bugs) { hideAt(bugs, bi); continue; }
      const bb = lay.bug[i];
      if (!bb) { hideAt(bugs, bi); continue; }
      const { a, x, z: zz } = crawlAt(lay, bb, t, S.squishT);
      e.set(0, -a, 0);
      bugs.setMatrixAt(bi, m4.compose(p.set(x, 0.42 + S.squishT * 0.3 * Math.abs(Math.sin(a * 3)), zz), q.setFromEuler(e), sc.set(0.11, 0.07, 0.15)));
    }
  }

  const rowMid = (r: number) => ({ x: (ROWS.x0 + ROWS.x1) / 2, z: rowZ(r) });
  function fx(ev: FxEvent) {
    const F = K.fx;
    if ((ev.type === 'tap' || ev.type === 'squash') && ev.kind === 'row' && typeof ev.id === 'number') { const S0 = st[ev.id]; if (S0) S0.bounce = 1; }
    switch (ev.type) {
      case 'patch/ripe': F.sparkle(-1.5, 0.5, rowZ(ev.row), ev.first ? 12 : 5); break;
      case 'patch/watered':
        for (let r = 0; r < N; r++) { const w = st[r]?.w; if (w?.open && w.planted) for (let k = 0; k < 3; k++) F.pop(-8 + k * 6 + (r % 2) * 2, 0.3, rowZ(r), 0x9cc6d6, 4); }
        perkPending = true;                                   // [B] the drooping rows lift in a wave
        break;
      case 'patch/sowing':                                    // [B] a sowing day: dust along the row, the flag pops, Biscuit runs it
        (ev.rows || []).forEach((r, i) => {
          const S = st[r];
          if (!S) return;
          S.bounce = 1; const F0 = flags[r]; if (F0) F0.pop = 1;
          for (let k = 0; k < 6; k++) setTimeout(() => F.dust(ROWS.x0 + 0.5 + k * 2.6, rowZ(r)), k * 110 + i * 300);
        });
        { const r0 = ev.rows?.[0]; if (r0 !== undefined) startRun(rowZ(r0)); }
        break;
      case 'patch/squish': {
        const S = st[ev.row]; if (!S) break;
        S.squishT = 1;
        const lay = L[ev.row]; if (lay) F.pop(lay.cluster, 0.45, rowZ(ev.row), 0x6f8a4a, 6);
        break;
      }
      case 'patch/bugsCleared': { const S = st[ev.row], lay = L[ev.row]; if (S && lay) F.sparkle(lay.cluster, 0.4, rowZ(ev.row), 6); break; }
      case 'patch/sprayed': if (st[ev.row]) for (let k = 0; k < 4; k++) F.pop(-8 + k * 4.5, 0.6, rowZ(ev.row), ev.kind === 'milk' ? 0xf4f1ea : 0xc9d6c0, 5); break;
      case 'patch/cut': { const S = st[ev.row]; if (S) { S.bounce = 1; F.pop(rowMid(ev.row).x, 0.5, rowZ(ev.row), 0xe0843a, 10); F.pop(PLACES.barn.x, 0.8, -10.5, 0xe0843a, 8); } break; }
      case 'patch/restock': { const S = st[ev.row]; if (S) { S.bounce = 1; F.sparkle(-2, 0.4, rowZ(ev.row), 8); } break; }
      case 'patch/planted': { const S = st[ev.row]; if (!ev.scheduled && S) { S.bounce = 1; for (let k = 0; k < 5; k++) F.dust(-8 + k * 3.5, rowZ(ev.row)); } break; }
      case 'patch/cleared': for (let k = 0; k < 6; k++) F.pop(-8.5 + k * 2.8, 0.5, rowZ(ev.row), 0x55603f, 8); break;
      case 'patch/honeyCollected': F.sparkle(-4.8, 1.4, -16.2, 10); break;
      case 'patch/swarm': if (ev.state === 'caught') F.sparkle(-4.8, 1.4, -16.2, 12); break;
      case 'patch/shiny': if (ev.row != null && st[ev.row]) F.sparkle(-1.5, 0.8, rowZ(ev.row), 10); break;
      case 'patch/volunteer': { const sp = own(VINE_SPOTS, ev.spot); if (sp) F.pop(sp.x, sp.y + 0.4, sp.z, ev.state === 'harvested' ? 0xe0843a : 0x7d9a6a, 8); break; }
    }
  }
  return {
    sync, fx, root,
    dispose() {
      scene.remove(root); K.bloom = null;
      if (run.t >= 0) K.cast?.hold?.('biscuit', false);
      for (const im of [pumps, warts, stems, leaves, vines, blooms, lumps, canes, berries, bugs, posts, tags, jars, swarm, glint.mesh, ridges]) im.dispose();
      for (const F of flags) { F.sp.material.map?.dispose(); F.sp.material.dispose(); }
      atlas.dispose();
    },
  };
}
