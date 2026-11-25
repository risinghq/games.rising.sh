// [E] The bug hunt's little world (plan §3.14, rulings R0): one row's squash bugs, close up, for the length of one hunt.
// Pure and deterministic. The UI owns one while the close-up is open (it steps it every frame and picks bugs from it in
// screen space), the render draws it (render/patch.js's bug section: the bugs where the hunt has them, the hiding leaves,
// the splats), and the bots and the balance tests play it headlessly with a player model (playHunt). So the hits a bot
// reports are what this mechanic gives a thumb of that skill, not a formula; retune T.hands and the bots follow.
//
// What the player should feel (plan §6.6, Jul 22: "a small panic, then triumph"):
//   - arriving: a handful of slow bugs ambling in the leaves. The first squish is easy and loud.
//   - each squish sends the near ones running for the nearest big leaf (0.9 u/s for 0.6 s), and makes the rest 10% quicker
//     (at most +60%): the last bug is the hardest. That's the small panic.
//   - one gets under a leaf and the leaf wiggles; you flip it and they scatter into the open (a flipped leaf stays open).
//   - squishes within 0.7 s of each other chain (x2, x3...). Clearing the row before the ring runs out is the triumph; when
//     it runs out the rest go to ground (they stay on the row with its pin, and you can hunt again).
//
// Coordinates are world units: x along the row, z across it, the cluster at (cx, cz). The screen is the UI's business;
// headless picking squashes z by T.hands.squashZ, which is how the close-up's camera foreshortens the ground.
import { T } from './tuning.js';
import { makeRng, next, gauss } from './rng.js';
import { clamp, lerp } from './util.js';

export const CRAWL = 0, FLEE = 1, HID = 2, DEAD = 3;
const TH = () => T.hands;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// The hunt's words: Gran's in the hint strip (the start, a hide, the combo, the two endings: patch/hunt picks the ending's
// line with fresh()), the floaters, and the Row sheet's bug panel.
export const LINES = {
  hint: 'Squish them! Quick, they scatter.',
  hid: "One's under that leaf. Flip it!",
  combo: 'Ooh, paws!',
  squish: 'Squish!', found: { one: 'Found one!', many: '{n} of them!' },
  panel: { small: 'Squish them before they settle in.', big: 'A big cluster. Quick, before it spreads.', hunt: 'Free · {s} seconds',
    spray: 'Loses the bee bonus', sprayLate: 'Blocks bugs {d} days' },
  clear: ["That's my sweet pea. Wash your paws.", 'Not a bug left. Your grandpa would have whistled.',
    "Row clear. They'll tell their friends. Good.", 'Quick paws! Supper tastes better after that.'],
  ground: ["They've gone to ground. They'll be back up for lunch.", "Gone to ground. Bugs are patient. So am I.",
    "They're hiding. Leave the pin up, we'll go again."],
  done: { clear: 'Row clear!', ground: "They've gone to ground." },
};

// ------------------------------------------------------------ the count a row shows (sim, render and the hunt agree)
// A fresh cluster (T.patch.bugs.start) shows 4 bugs and a full row (1.0) shows T.hands.bugs; a hunt that leaves k bugs
// leaves an infestation that shows exactly k (under the fresh-cluster level, only a hunt ever gets a row: one bug a quarter
// of it). Squishing three of five must never leave "four".
const START = () => T.patch.bugs.start, PER = () => 1 / TH().bugs;
export const bugsShown = (b) => (!(b > 0) ? 0 : b < START() ? Math.ceil(b / (START() / 4) - 1e-9)
  : Math.min(TH().bugs, Math.max(4, Math.ceil(b / PER() - 1e-9))));
function shownRange(k) {
  const q = START() / 4;
  return k < 4 ? [(k - 1) * q, k * q] : k === 4 ? [3 * q, 4 * PER()] : [(k - 1) * PER(), k * PER()];
}
// the infestation after a hunt with `hits` of the bugsShown(b) squished: the plan's b x (1 - hits/n), nudged inside the
// band that shows the bugs actually left
export function bugsAfter(b, hits) {
  const n = bugsShown(b), k = n - clamp(Math.round(hits) || 0, 0, n);
  if (k <= 0) return 0;
  if (k === n) return b;
  const [lo, hi] = shownRange(k);
  return Math.round(clamp((b * k) / n, lo + 0.002, hi - 0.002) * 1000) / 1000;
}
// the clock a hunt holds: the camera coming in and the ending, plus the play (never longer than the ring); the pacing
// harness charges it per hunt, and tests/balance/bugs.test.js holds it to what playHunt measures
export const sessionSeconds = (n) => TH().session.base + Math.min(TH().timerS, TH().session.perBug * n);

// fast: a speed multiplier on every bug (Reduce Motion halves it); timerS: the ring (Simple gestures adds half again)
export function createHunt({ n, cx = 0, cz = 0, seed = 1, fast = 1, timerS = TH().timerS }) {
  const h = TH(), r = makeRng(seed);
  const leaves = h.leaves.filter((_, k) => n >= h.leavesFrom[k]).map(([dx, dz]) => ({ x: cx + dx, z: cz + dz, hid: 0, open: false, wig: 0 }));
  const bugs = Array.from({ length: Math.max(0, n) }, () => ({
    x: cx + (next(r) * 2 - 1) * h.area[0] * 0.8, z: cz + (next(r) * 2 - 1) * h.area[1] * 0.8,
    h: next(r) * Math.PI * 2, st: CRAWL, t: 0, leaf: -1, at: -1,
  }));
  return { n: bugs.length, cx, cz, r, bugs, leaves, fast, timerS, time: 0, hits: 0, combo: 0, best: 0, lastHit: -1e9, flips: 0, over: bugs.length ? null : 'clear' };
}

// The render's first frame of a hunt starts its bugs where they were crawling on the row (so the close-up doesn't jump).
export function seatBugs(H, pts) {
  if (H.seated) return;
  H.seated = true;
  H.bugs.forEach((b, i) => { if (pts[i] && b.st === CRAWL && H.time < 0.5) { b.x = pts[i].x; b.z = pts[i].z; } });
}

// every squish makes the rest a little quicker (the last bug is the hardest)
export const speedOf = (H) => H.fast * (1 + Math.min(TH().speedCap, TH().speedUp * H.hits));
export const live = (b) => b.st === CRAWL || b.st === FLEE;
export const left = (H) => H.n - H.hits;

// the leaf a running bug can make it under before its legs give out (open, not full), else -1
function coverFor(H, b) {
  const h = TH(), reach = h.flee.speed * speedOf(H) * (h.flee.ms / 1000) + h.hideR;
  let best = -1, bd = reach;
  H.leaves.forEach((L, k) => { const d = dist(L, b); if (!L.open && L.hid < h.leafCap && d <= bd) { bd = d; best = k; } });
  return best;
}

export function stepHunt(H, dt) {
  if (H.over) return;
  const h = TH(), sp = speedOf(H);
  H.time += dt;
  for (const L of H.leaves) L.wig = L.hid ? 1 : Math.max(0, L.wig - dt * 3);
  for (const b of H.bugs) {
    if (!live(b)) continue;
    if (b.st === FLEE) {
      const L = H.leaves[b.leaf], step = h.flee.speed * sp * dt;
      if (L && !L.open && L.hid < h.leafCap) {
        const d = dist(L, b);
        if (d <= step + h.hideR) { b.st = HID; b.x = L.x; b.z = L.z; L.hid++; L.wig = 1; continue; }
        b.h = Math.atan2(L.z - b.z, L.x - b.x);
      }
      b.x += Math.cos(b.h) * step; b.z += Math.sin(b.h) * step;
      if ((b.t -= dt) <= 0) { b.st = CRAWL; b.leaf = -1; }
    } else {
      // an amble: a wandering heading, kept to the cluster's patch of leaves (turned back toward the middle at its edge)
      b.h += gauss(H.r) * h.wander * Math.sqrt(dt);
      const ox = b.x - H.cx, oz = b.z - H.cz;
      if (Math.abs(ox) > h.area[0] || Math.abs(oz) > h.area[1]) b.h = Math.atan2(-oz, -ox) + (next(H.r) - 0.5);
      const step = h.crawl * sp * dt;
      b.x += Math.cos(b.h) * step; b.z += Math.sin(b.h) * step;
    }
  }
  if (H.time >= H.timerS) H.over = 'ground';
}

// A squish: the bug's done, the combo counts on, and the near ones run: for a leaf they can reach, else away from it.
export function squish(H, i) {
  const b = H.bugs[i], h = TH();
  if (H.over || !b || !live(b)) return null;
  b.st = DEAD; b.at = H.time;
  H.hits++;
  H.combo = H.time - H.lastHit <= h.comboS ? H.combo + 1 : 1;
  H.lastHit = H.time; H.best = Math.max(H.best, H.combo);
  for (const o of H.bugs) {
    if (!live(o) || dist(o, b) > h.flee.r) continue;
    o.st = FLEE; o.t = h.flee.ms / 1000; o.leaf = coverFor(H, o);
    if (o.leaf < 0) o.h = Math.atan2(o.z - b.z, o.x - b.x) + (next(H.r) - 0.5) * 0.8;
  }
  if (H.hits >= H.n) H.over = 'clear';
  return { combo: H.combo, clear: H.over === 'clear', x: b.x, z: b.z };
}

// Flip a wiggling leaf: whoever hid there scatters back toward the middle of the cluster (a flipped leaf stays open).
export function flip(H, k) {
  const L = H.leaves[k], h = TH();
  if (H.over || !L || L.open || !L.hid) return 0;
  L.open = true; L.hid = 0; H.flips++;
  let n = 0;
  for (const b of H.bugs) {
    if (b.st !== HID || dist(b, L) > 1e-6) continue;
    b.st = FLEE; b.t = h.flee.ms / 1000; b.leaf = -1; n++;
    b.h = Math.atan2(H.cz - L.z, H.cx - L.x) + (next(H.r) - 0.5) * 1.6;
  }
  return n;
}

// Headless picking: the live bug nearest a tap at world (x, z) within reach px, measured on the screen (z squashed as the
// close-up's camera squashes it); else a wiggling leaf within its own reach. -> { bug } | { leaf } | null
export function pickAt(H, x, z, ppu = TH().ppu) {
  const h = TH(), sd = (p) => Math.hypot(p.x - x, (p.z - z) * h.squashZ) * ppu;
  let bi = -1, bd = h.reachPx;
  H.bugs.forEach((b, i) => { if (live(b)) { const d = sd(b); if (d <= bd) { bd = d; bi = i; } } });
  if (bi >= 0) return { bug: bi };
  const k = H.leaves.findIndex((L) => L.hid && !L.open && sd(L) <= h.leafReachPx);
  return k >= 0 ? { leaf: k } : null;
}

// ------------------------------------------------------------ the headless hunter (bots and balance tests)
// A thumb of skill 0..1: it taps every `gap` seconds at the bug nearest its last tap, aiming where the bug was `react`
// seconds ago (eyes and thumb lag a moving bug) with a Gaussian miss of `aim` px; with nothing in the open it flips a
// wiggling leaf. The numbers are T.hands.player's [skill 0, skill 1] ends.
export function playerOf(skill) {
  const p = TH().player, k = clamp(skill, 0, 1), at = ([a, b]) => lerp(a, b, k);
  return { gap: at(p.gap), react: at(p.react), aim: at(p.aim), first: at(p.first) };
}
export function playHunt({ n, skill = 0.5, seed = 1, dt = 1 / 30, fast = 1, timerS } = {}) {
  const H = createHunt({ n, seed, fast, timerS }), p = playerOf(skill), pr = makeRng(seed ^ 0x5bd1e995), ppu = TH().ppu;
  const seen = H.bugs.map((b) => ({ x: b.x, z: b.z }));   // where the eyes have each bug: the true spot, lagged by react
  let at = p.first, last = { x: H.cx, z: H.cz }, taps = 0;
  while (!H.over) {
    stepHunt(H, dt);
    const k = Math.min(1, dt / p.react);
    H.bugs.forEach((b, i) => { seen[i].x += (b.x - seen[i].x) * k; seen[i].z += (b.z - seen[i].z) * k; });
    if (H.over || H.time < at) continue;
    at = H.time + p.gap * (0.75 + 0.5 * next(pr));
    let tgt = null, td = Infinity;
    H.bugs.forEach((b, i) => { if (live(b)) { const d = dist(seen[i], last); if (d < td) { td = d; tgt = seen[i]; } } });
    if (!tgt) tgt = H.leaves.find((L) => L.hid && !L.open);
    if (!tgt) continue;
    const x = tgt.x + (gauss(pr) * p.aim) / ppu, z = tgt.z + (gauss(pr) * p.aim) / ppu / TH().squashZ;
    taps++; last = { x, z };
    const hit = pickAt(H, x, z, ppu);
    if (hit?.bug != null) squish(H, hit.bug);
    else if (hit?.leaf != null) flip(H, hit.leaf);
  }
  return { hits: H.hits, seconds: H.time, over: H.over, best: H.best, flips: H.flips, taps };
}
