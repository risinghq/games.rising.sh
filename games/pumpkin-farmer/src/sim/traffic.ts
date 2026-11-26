// Cars on the road (design §7 Route 46 and parking) [motion round 2]. Pure helpers for season.js: every car the eye
// sees is a sim object with a route and a distance along it, so the renderer draws exactly what the sim decided and two
// cars are never in the same place.
//
// The road (layout ROAD) is one-way and two lanes wide: every trip comes out of Marlene in the west and goes back into
// her up the beach, without ever turning round.
//   the patch's side ('patch'): drops families off. The patch's front is open, with five spaces along it; a car pulls up
//     at the frontmost free one (the nearest, with nobody behind it) and the family steps straight out into the patch.
//   the stand's side ('stand'): picks them up. Two spaces by the stand; a car waits in the fog until its family is
//     nearly ready, comes in, pulls up at the frontmost space it can get to (nobody parked in the other in its way) and
//     waits there for them, moving up when the space ahead comes free; the next waits its turn behind. Its family walks
//     along the verge to its door wherever it is, once it's within a few steps of the pick-up, and follows it up; a car
//     whose family is at its door stops for them right there.
//   at the lane's end both sides bend north and run up the beach, side by side, into the fog behind the lighthouse (round
//     to the car park, or home).
// The beach lot (when it's open) is a row of spaces on the sand south of the lane's end, nose to the sea, down a spur
// off the patch's side that takes one car at a time. A beach-lot car ('beach') drops its family off like everyone else
// and turns down the spur into its space; to fetch them ('sand') it backs out, drives up the spur, waits for a gap to
// join the patch's side in its bend, goes on into the fog and comes round again along the stand's side.
// Rules: a car keeps 0.5 behind the car ahead (they are 1.5 long); nobody passes; a car at a space holds it until its
// family is out, or in, and cars behind wait; nobody stops on a crossing; the spur takes one car at a time; a car off
// the spur joins the road at a gap, or (once it has waited a while) when the cars that can stop for it have; folks on
// foot wait at the kerb while a car is about to pass, and cars stop for anyone already on the road.
//
// Car (JSON): { id, fam, k, r, s, v, slot, wait, t, q, bx, bz }
//   k: 'drop' (bringing a family) | 'park' (empty, off to the car park or its space on the sand) | 'fetch' (coming for
//      them) | 'home' (with them, leaving) | 'round' (empty, off the sand and round through the fog to fetch them)
//      | 'parked' (on the sand)
//   r: 'patch' | 'stand' (a side of the lane, then the beach road) | 'beach' (the patch's side, then down the spur into a
//      space on the sand) | 'sand' (out of a space, up the spur and onto the patch's side in its bend)
//   s: distance along the route ; v: distance last tick ; slot: its space on its side, or -1 ; wait: ticks standing ;
//   t: ticks it has waited to join the road off the spur ('sand') ; q: >= 0 while waiting in the fog to come in (its
//   place in that line) ; bx, bz: its space on the sand
import { ROAD } from './layout.js';
import type { Car, Family, Season } from './state.js';
import { T } from './tuning.js';
import { round3 } from './util.js';

const C = T.season.car, TPS = T.calendar.weekend.ticksPerSecond;
const CRUISE = C.speed / TPS, ACC = C.accel / TPS / TPS, DEC = C.brake / TPS / TPS;
const BENDV = C.bend / TPS, SANDV = C.sand / TPS, BAYV = C.bay / TPS, BACKV = C.back / TPS;
const HALF = C.length / 2, SPACE = C.length + C.gap, ASK = Math.round(C.ask * TPS);
const { west: W, north: ZN } = ROAD;
const SPACES = [ROAD.stops.patch, ROAD.stops.stand];   // the spaces on each side, front (east) first
const spaces = (sd: number): number[] => SPACES[sd] ?? [];
const spaceX = (S: number[], i: number) => S[i] ?? 0;
const stopG = (x: number) => x - W;
const side = (c: Pick<Car, 'r'>) => (c.r === 'stand' ? 1 : 0);

type Pt = [number, number];
/** Where a car is on the road; see place(). */
interface Place { g: number; ln: number; road: boolean; ask?: boolean }
/** Someone on foot, by family id (the farmer is 0). */
export interface Walker { id: number; x: number; z: number }
const ORIGIN: Pt = [0, 0];         // 0 the patch's side, 1 the stand's

// ------------------------------------------------------------ geometry
// Each side: straight along the lane at z0 to x E, a left bend of radius R, then north at x E + R into the fog.
const mkLane = (z0: number, [E, R]: Pt) => {
  const L1 = E - W, A = (Math.PI * R) / 2;
  return { z0, E, R, L1, A, X: E + R, ZB: z0 - R, MAIN: L1 + A + (z0 - R - ZN) };
};
const PATCH = mkLane(ROAD.z, ROAD.bend.patch), STAND = mkLane(ROAD.zStand, ROAD.bend.stand);
const laneOf = (sd: number) => (sd === 1 ? STAND : PATCH);
function lanePose(sd: number, g: number) {
  const L = laneOf(sd);
  if (g <= L.L1) return { x: W + g, z: L.z0, yaw: 0 };
  if (g < L.L1 + L.A) { const t = (g - L.L1) / L.R; return { x: L.E + L.R * Math.sin(t), z: L.ZB + L.R * Math.cos(t), yaw: t }; }
  return { x: L.X, z: L.ZB - (g - L.L1 - L.A), yaw: Math.PI / 2 };
}
// The beach lot: off the patch's side at x AT, a right turn (radius TS) down the spur (x SPX), then a left turn (radius
// BR) into a space, nose to the sea at x SX. Out: back out (tail to the south) until facing north on the spur, up it to
// JZ, then a curve onto the patch's side partway round its bend (at angle JT).
const SD = ROAD.sand, AT = SD.at, TS = SD.turn, SPX = AT + TS, BR = SD.bay, SX = SD.x, JZ = SD.join, JT = SD.joinAt;
const P0 = PATCH, G_SPUR = AT - W, TURN = (Math.PI * TS) / 2, SPZ = P0.z0 + TS;     // where the spur's straight starts
const BAYARC = (Math.PI * BR) / 2, BAYIN = SX - SPX - BR, BACK = BAYIN + BAYARC;
const G_JOIN = P0.L1 + P0.R * JT;                      // where a car off the spur joins the patch's side
// while it's waiting to join (once it has asked) and joining, the patch's side stops short of the spur's mouth
const G_J0 = SPX - 0.55 - HALF - W + SPACE;
const TOK_G = stopG((ROAD.crossings.at(-1) ?? ORIGIN)[0]) - HALF;  // a beach-lot car waits for the spur short of the last crossing
// the join: a curve from (SPX, JZ) heading north to the bend at JT, sampled once
const JOIN = (() => {
  const a: Pt = [SPX, JZ], d = lanePose(0, G_JOIN), b: Pt = [d.x, d.z], k = 0.7;
  const c1: Pt = [a[0], a[1] - k], c2: Pt = [b[0] - Math.cos(JT) * k, b[1] + Math.sin(JT) * k], pts: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16, m = 1 - u, f0 = m * m * m, f1 = 3 * m * m * u, f2 = 3 * m * u * u, f3 = u * u * u;
    pts.push([f0 * a[0] + f1 * c1[0] + f2 * c2[0] + f3 * b[0], f0 * a[1] + f1 * c1[1] + f2 * c2[1] + f3 * b[1]]);
  }
  const cum = [0];
  let prev = pts[0] ?? a, total = 0;
  for (const p of pts.slice(1)) { total += Math.hypot(p[0] - prev[0], p[1] - prev[1]); cum.push(total); prev = p; }
  return { pts, cum, L: total };
})();
function joinPose(d: number) {
  const { pts, cum } = JOIN;
  let i = 1;
  while (i < pts.length - 1 && (cum[i] ?? 0) < d) i++;
  const c0 = cum[i - 1] ?? 0, c1 = cum[i] ?? 0, a = pts[i - 1] ?? ORIGIN, b = pts[i] ?? ORIGIN;
  const k = Math.min(1, Math.max(0, (d - c0) / (c1 - c0)));
  return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) };
}
const upLen = (bz: number) => bz + BR - JZ;                    // up the spur from a space's mouth to where it waits to join
const inLen = (bz: number) => TURN + (bz - BR - SPZ) + BAYARC + BAYIN;
// into a space: the turn off the road, down the spur, the turn into the space, nose in
function inPose(bz: number, d: number) {
  if (d < TURN) { const u = d / TS; return { x: AT + TS * Math.sin(u), z: P0.z0 + TS - TS * Math.cos(u), yaw: -u }; }
  d -= TURN;
  const run = bz - BR - SPZ;
  if (d < run) return { x: SPX, z: SPZ + d, yaw: -Math.PI / 2 };
  d -= run;
  if (d < BAYARC) { const v = d / BR; return { x: SPX + BR - BR * Math.cos(v), z: bz - BR + BR * Math.sin(v), yaw: Math.atan2(-Math.cos(v), Math.sin(v)) }; }
  return { x: SPX + BR + Math.min(d - BAYARC, BAYIN), z: bz, yaw: 0 };
}
// out of one: backing out (the car still faces the sea, then swings to face north), up the spur, the join
function outPose(bz: number, d: number) {
  if (d < BAYIN) return { x: SX - d, z: bz, yaw: 0 };
  d -= BAYIN;
  if (d < BAYARC) { const w = d / BR; return { x: SPX + BR - BR * Math.sin(w), z: bz + BR - BR * Math.cos(w), yaw: w }; }
  d -= BAYARC;
  const up = upLen(bz);
  if (d < up) return { x: SPX, z: bz + BR - d, yaw: Math.PI / 2 };
  d -= up;
  if (d < JOIN.L) return joinPose(d);
  return lanePose(0, G_JOIN + d - JOIN.L);
}
const joinS = (c: Pick<Car, 'bz'>) => round3(BACK + upLen(c.bz));       // where on its route a car off the sand waits to join
export function routeLen(c: Pick<Car, 'r' | 'bz'>) {
  if (c.r === 'beach') return G_SPUR + inLen(c.bz);
  if (c.r === 'sand') return joinS(c) + JOIN.L + P0.MAIN - G_JOIN;
  return laneOf(side(c)).MAIN;
}
/** Where a car is at distance s along its route: { x, z, yaw } of its middle (+x is the nose; yaw as THREE's rotation.y). */
export function pose(c: Pick<Car, 'r' | 'bz'>, s: number) {
  if (c.r === 'beach') return s <= G_SPUR ? lanePose(0, s) : inPose(c.bz, s - G_SPUR);
  if (c.r === 'sand') return outPose(c.bz, s);
  return lanePose(side(c), s);
}
// Where a car is on the road: its side (ln: 0 the patch's, 1 the stand's, 2 the spur), its distance along that side
// (g), and whether it's in the way there (road). A car turning onto the spur is until it's clear of the lane; one waiting
// to join off it asks for its gap once it has waited a while (ask: cars that can still stop short of it do), and holds
// it once it goes.
function place(c: Pick<Car, 'r' | 's' | 't' | 'bz'>): Place {
  if (c.r === 'beach') {
    if (c.s <= G_SPUR + TURN * 0.6) return { g: Math.min(c.s, G_SPUR + 0.5), ln: 0, road: true };
    return { g: 0, ln: 2, road: false };
  }
  if (c.r === 'sand') {
    const j = joinS(c);
    if (c.s < j) return { g: 0, ln: 2, road: false };
    if (c.s === j) return { g: G_J0, ln: 0, road: c.t >= ASK, ask: true };
    if (c.s < j + JOIN.L) return { g: G_J0, ln: 0, road: true };
    return { g: G_JOIN + c.s - j - JOIN.L, ln: 0, road: true };
  }
  return { g: c.s, ln: side(c), road: true };
}
// the spur takes one car at a time: one on its way down it (from short of the last crossing) or coming out of it
const onSpur = (c: Car) => (c.r === 'beach' && c.k !== 'parked' && c.q < 0 && c.s > TOK_G) || (c.r === 'sand' && c.s > 0 && c.s < joinS(c) + JOIN.L);

// ------------------------------------------------------------ the tick
const CROSS = ROAD.crossings.map(([a, b]): Pt => [stopG(a) - HALF, stopG(b) + HALF]);
// the lane's width on the ground: anyone on foot between these is on it
export const BAND0 = ROAD.zStand - 0.55, BAND1 = ROAD.z + 0.5;
const XEND = Math.max(P0.E, STAND.E) + HALF;
/** A car is coming at x on the lane: moving, and on it or about to be (too close to stop for someone stepping out). */
export function coming(se: Season, x: number) {
  for (const c of se.cars) {
    if (c.q >= 0 || c.k === 'parked' || c.v < 0.05) continue;
    const p = pose(c, c.s);
    if (p.z <= BAND0 - 0.4 || p.z >= BAND1 + 0.4 || p.x > XEND) continue;
    const rel = x - p.x;
    if (Math.abs(rel) < HALF + 0.7 || (rel > 0 && rel < HALF + 0.7 + c.v * 1.5)) return true;
  }
  return false;
}
/**
 * Move every car one tick. walkers: [{ x, z, id }] (families on foot by id, your farmer 0); a car ignores its own family.
 * Calls atStop(car) for each car standing at its space (the caller lets families out or in and sets car.wait / car.k),
 * backed(car) when a car has backed out of its space on the sand, and ready(car) to ask whether a pick-up car waiting in
 * the fog should come in yet. Returns the cars that reached the end of their route this tick.
 */
export function tick(se: Season, walkers: Walker[], atStop: (c: Car) => void, backed: (c: Car) => void, ready: (c: Car, door?: boolean) => boolean): Car[] {
  const cars = se.cars, n = cars.length, done: Car[] = [];
  // where everyone is (P[i] for cars[i]; null for cars in the fog line or parked on the sand)
  const P: (Place | null)[] = [];
  let spur: Car | null = null;
  for (let i = 0; i < n; i++) {
    const c = cars[i];
    if (!c) continue;
    const pi = c.q < 0 && c.k !== 'parked' ? place(c) : null;
    P[i] = pi;
    if (pi && onSpur(c)) spur = c;
  }
  // the line in the fog: the first car for each side comes in once that side's mouth is clear (to pick up, the first
  // whose family is nearly ready)
  for (let sd = 0; sd < 2; sd++) {
    let head = -1, clear = true;
    for (let i = 0; i < n; i++) {
      const c = cars[i], pi = P[i], h = cars[head];
      if (!c) continue;
      if (c.q >= 0 && side(c) === sd && (!h || c.q < h.q) && (sd === 0 || ready(c))) head = i;
      if (pi && pi.ln === sd && pi.g < SPACE) clear = false;
    }
    const first = cars[head];
    if (first && clear) { first.q = -1; first.s = 0; first.v = CRUISE; P[head] = place(first); }
  }
  assignStops(cars, P);
  for (let i = 0; i < n; i++) {
    const c = cars[i], p = P[i];
    if (!c || !p) continue;
    if (c.wait > 0) { c.wait--; c.v = 0; continue; }
    if (c.r === 'stand' && c.k === 'fetch' && ready(c, true)) { c.v = 0; continue; }   // its family's at the door
    if (c.r === 'sand' && c.s < joinS(c)) {              // out of its space and up the spur
      if (c.s === 0) { if (spur && spur !== c) { c.v = 0; continue; } spur = c; }
      const end = joinS(c), step = Math.min(c.s < BACK ? BACKV : Math.min(BAYV, c.v + ACC), end - c.s);
      const was = c.s;
      c.s = round3(c.s + step); c.v = c.s >= end ? 0 : round3(step); P[i] = place(c);
      if (was < BACK && c.s >= BACK) backed(c);
      continue;
    }
    let pp = p;
    if (c.r === 'sand' && c.s === joinS(c)) {            // waiting at the top of the spur for a gap
      if (!joinClear(c, cars, P)) { c.v = 0; c.t++; if (c.t === ASK) P[i] = place(c); continue; }
      pp = { g: G_J0, ln: 0, road: true };
      P[i] = pp;
    }
    let free = room(c, pp, cars, P, walkers);
    const st = stopAhead(c, pp);
    if (st >= -1e-6) free = Math.min(free, st);
    if (c.r === 'beach') {
      free = Math.min(free, routeLen(c) - c.s);                          // into its space and stop
      if (c.s <= TOK_G && spur && spur !== c) free = Math.min(free, Math.max(0, TOK_G - 0.01 - c.s));   // wait for the spur
    }
    const v = Math.min(c.v + ACC, limit(c, pp), brakeV(free));
    const step = Math.max(0, Math.min(v, free));
    c.v = round3(step); c.s = round3(c.s + step); P[i] = place(c);
    if (c.r === 'beach' && !spur && c.s > TOK_G) spur = c;
    if (c.slot >= 0 && Math.abs(st - step) < 1e-3) atStop(c);
    else if (c.s >= routeLen(c) - 1e-3) done.push(c);
  }
  return done;
}
// The fastest step this tick from which a car can still brake to a stop within `free` (this step plus v²/2DEC after it).
const brakeV = (free: number) => (free > 0 ? -DEC / 2 + Math.sqrt((DEC * DEC) / 4 + 2 * DEC * free) : 0);
// How fast a car may go here: cruising on the lane, easing round the bend, a little slower up the beach, crawling on the
// spur.
function limit(c: Car, p: Place) {
  if (p.ln === 2 || (c.r === 'beach' && c.s > G_SPUR)) return BAYV;
  if (c.r === 'sand' && c.s < joinS(c) + JOIN.L) return BAYV;
  const L = laneOf(side(c)), g = p.g;
  if (c.r === 'beach') return Math.min(CRUISE, Math.sqrt(BAYV * BAYV + 2 * DEC * Math.max(0, G_SPUR - g)));
  return g < L.L1 ? Math.min(CRUISE, Math.sqrt(BENDV * BENDV + 2 * DEC * (L.L1 - g))) : g < L.L1 + L.A ? BENDV : SANDV;
}
// The distance to this car's space, or (still waiting for one) to its side's front space: nobody who needs to stop
// drives past the spaces.
const wants = (c: Car) => c.k === 'drop' || c.k === 'fetch';
function stopAhead(c: Car, p: Place) {
  const S = spaces(side(c));
  if (!wants(c) || p.ln === 2 || p.g > stopG(spaceX(S, 0)) + 1e-3) return Infinity;
  return stopG(spaceX(S, c.slot >= 0 ? c.slot : 0)) - c.s;
}
// Spaces go to the cars that want one in the order they come up their side: the frontmost free space they can still
// stop at, so the cars behind can get to theirs; or, dropping off with nobody behind, the nearest. A pick-up may wait a
// while for its family, so one never takes a space with another car parked short of it.
function assignStops(cars: Car[], P: (Place | null)[]) {
  for (let sd = 0; sd < 2; sd++) {
    const S = spaces(sd), free = S.map(() => true), want: Car[] = [];
    let last = Infinity;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i], pi = P[i];
      if (!c || side(c) !== sd) continue;
      if (c.slot >= 0) free[c.slot] = false;
      if (c.q >= 0) last = Math.min(last, -1);
      else if (pi && pi.ln === sd) last = Math.min(last, pi.g);
      if (c.slot < 0 && wants(c) && pi && pi.ln === sd && pi.g <= stopG(spaceX(S, 0)) + 1e-3) want.push(c);
    }
    // picking up: a car waiting at the back space moves up to the front one when it comes free, so the next can pull in
    if (sd === 1) for (const c of cars) {
      if (side(c) !== 1 || c.slot < 1 || c.k !== 'fetch' || !free[c.slot - 1]) continue;
      if (cars.some((o) => o !== c && side(o) === 1 && o.q < 0 && o.s > c.s && o.s < stopG(spaceX(S, c.slot - 1)) + SPACE)) continue;   // nobody in the way
      free[c.slot] = true; c.slot--; free[c.slot] = false;
    }
    if (!want.length) continue;
    want.sort((a, b) => b.s - a.s);
    for (const c of want) {
      // one it can stop at (and, picking up, get to)
      const ok = (f: boolean, i: number) => f && stopG(spaceX(S, i)) - c.s >= (c.v * c.v) / (2 * DEC) - 1e-3 && (sd === 0 || !free.some((g, m) => !g && spaceX(S, m) < spaceX(S, i)));
      const k = sd === 0 && c.s <= last ? free.findLastIndex(ok) : free.findIndex(ok);
      if (k < 0) break;
      c.slot = k; free[k] = false;
    }
  }
}
// A car off the spur joins the patch's side when there's a gap: nobody at the join, and nobody coming round the bend
// who'd get there before it's in. Once it has asked (waited a while), it goes as soon as everyone coming has stopped
// for it or gone by.
const JOINT = Math.ceil(JOIN.L / BAYV) + 2;
function joinClear(c: Car, cars: Car[], P: (Place | null)[]) {
  const asked = c.t >= ASK;
  for (let j = 0; j < cars.length; j++) {
    const q = P[j], o = cars[j];
    if (!q || !o || !q.road || q.ask || q.ln !== 0 || o === c || o.r === 'beach' || q.g >= G_JOIN + SPACE) continue;
    if (q.g > G_J0 - SPACE + 0.01) return false;
    if (q.g + (asked ? o.v + (o.v * o.v) / (2 * DEC) : o.v * JOINT) > G_J0 - SPACE + 0.01) return false;
  }
  return true;
}
// How far a car may go before it must stop: behind the car ahead on its side, short of a crossing it can't get across,
// short of anyone on foot on the road ahead.
function room(c: Car, p: Place, cars: Car[], P: (Place | null)[], walkers: Walker[]) {
  if (!p.road || p.ln === 2) return Infinity;           // on the spur: nothing else is there
  let free = Infinity, lead: Car | null = null;
  for (let j = 0; j < cars.length; j++) {
    const q = P[j], o = cars[j];
    if (!q || !o || !q.road || q.ln !== p.ln || o === c || q.g <= p.g) continue;
    const d = q.g - p.g - SPACE;
    if (q.ask && d < (c.v * c.v) / (2 * DEC)) continue;   // too close to stop for a car waiting to join: go on by
    if (d < free) { free = d; lead = o; }
  }
  const L = laneOf(p.ln);
  // keep the crossings clear: don't drive onto one without room to get off it again (behind a car that has stopped)
  if (p.g < L.L1 && !(lead && lead.v > 0.1 && lead.wait === 0)) {
    for (const [a, b] of CROSS) {
      const near = a - p.g, far = b - p.g;
      if (near >= -1e-6 && near < free && free < far) free = near;
    }
  }
  // folks on foot on the road ahead (crossing at the gates; your farmer on an errand)
  if (!walkers.length || p.g > L.L1 + L.A) return free;
  const ps = pose(c, c.s), dx = Math.cos(ps.yaw), dz = -Math.sin(ps.yaw);
  for (const w of walkers) {
    if (w.id === c.fam || w.z <= BAND0 || w.z >= BAND1) continue;
    const rx = w.x - ps.x, rz = w.z - ps.z, d = rx * dx + rz * dz, sd = Math.abs(rx * dz - rz * dx);
    if (sd < C.lat && d > -HALF && d < HALF + C.look) free = Math.min(free, Math.max(0, d - HALF - 0.35));
  }
  return free;
}
// ------------------------------------------------------------ making cars
/**
 * A new car for a family: r 'patch' or 'beach' to drop them off, 'stand' to pick them up. at: 'fog' (joins the line in
 * Marlene) or 'stop' (already standing at its side's last space, by the little gate: scripted).
 */
export function addCar(se: Season, f: Family, k: string, r: string, at = 'fog', spot: { x: number; z: number } | null = null) {
  const c: Car = { id: ++se.carSeq, fam: f.id, k, r, s: 0, v: 0, slot: -1, wait: 0, t: 0, q: -1, bx: spot?.x ?? 0, bz: spot?.z ?? 0 };
  if (at === 'fog') c.q = ++se.fogSeq;
  else { const S = spaces(side(c)); c.slot = S.length - 1; c.s = stopG(spaceX(S, c.slot)); }
  se.cars.push(c);
  return c;
}
/** Where a car is, rounded: a riding family is carried along with it. */
export function carPos(c: Car) { const p = pose(c, c.s); return { x: round3(p.x), z: round3(p.z) }; }
/** A space on the sand is taken while a car is on its way to it, in it, or still backing out of it. */
export const holdsSpace = (c: Car) => c.r === 'beach' || (c.r === 'sand' && c.s < BACK);
/** A pick-up car within a few steps of the pick-up (at its space, or waiting its turn): its family can walk to it. */
export const nearPickup = (c: Car) => c.s >= stopG(ROAD.line);
/** The verge-side door of a pick-up car where it is now. */
export const doorOf = (c: Car) => ({ x: round3(W + c.s - 0.3), z: BAND0 - 0.1 });
/** Where a family gets out (the patch's side) or in (the stand's side) of a car standing at space k on its side. */
export const door = (r: string, k: number) => (r === 'stand' ? { x: spaceX(spaces(1), k) - 0.3, z: BAND0 - 0.1 } : { x: spaceX(spaces(0), k) + 0.3, z: BAND1 + 0.1 });
