// Pumpkin season [slice: season] (design §7, §3 beats 17-23, §10 events; numbers in T.season, T.species, T.events.cat).
// October is where the slow year snaps into a loud, frantic, joyful scramble: cars come out of Marlene, families of
// ten species walk your rows and pick, and your farmer is the one resource you have to spend.
//
// What the player should feel at each step (design §13), and what makes it so:
//   Season opens   delight: the first families come out of the fog (cars on the west lane, kids hopping). At 1x they
//                  stroll (2-3.4 u/s by species), your farmer sprints at 6 and cars cruise at 8: an 80 s day (§2)
//   RING UP        a satisfying rhythm: one tap serves the front family at once, coins arc to the cash, and serving
//                  again within 12 ticks (2 s) builds Rush x2..x5 (+5% tip a level, rising "ching"). Gran rings up 1
//                  per 18 ticks (3 s) on her own, so tapping always helps and never feels mandatory.
//   Want bubble    a heroic little save: a [?] lasts 24 ticks (4 s), your farmer sprints (6 u/s), "Fetch from barn"
//                  meets the want (+15) or "Try ___" turns a -10 into +8 (70%, Regulars 85%).
//   Restock        pride in a full patch: load 12 at the barn, the wagon trundles to the emptiest front row, fruit pops
//                  in; full rows (>= 60%) are +5, thin ones (< 25%) -8, and families pick rows by stock x fullness.
//   Route 46       pressure, then relief: the meter fills (Q/12), Hal howls at 50% and 75%, cars U-turn (R -0.005
//                  each); the beach lot (+4), Gran on traffic (+3, patience x1.5, she stops ringing) or "Tell Hal
//                  we're full" (arrivals x0.5 for 60 ticks) open the valve. Worth it on heat-wave days, wasted in fog.
//   Lost joey      panic then joy: Biscuit barks toward one of 8 hideouts, you have 60 ticks (10 s); +25 for mom, +5 for all.
//   Evening card   exhale, closing time: served and turned away, $ by variety, stars, the day's best moment, stock,
//                  tomorrow's forecast.
//
// State. Render-facing fields first (architecture §3.2):
//   s.season.families[] = { id, species, type, state, x, z, heading, kids: [{ v, got }], want, bubble: { v, kind, t, held }
//     | null, wagon (0 none | 1 pulling one), joey (a joey is lost), carpool, park: 'lot'|'beach'|'shuttle'|'sea' (seals),
//     fort (0 no | 1 planned | 2 the kits are up the hay fort while mom queues | 3 back), ...internals }
//     state: 'car' (riding in their car: f.car its id) | 'in' | 'walk' | 'pick' | 'want' | 'gawk' | 'maze' | 'fort'
//       | 'toddler' | 'toQueue' | 'queue' | 'out' (out to the stand's verge by the pick-up, and along it to their car's
//       door) | 'curb' (waiting there) | 'whale'
//   s.season.queue = [family ids] (front first; QUEUE spots, then further west along the stand's front)
//   s.season.cars = [{ id, fam, k, r, s, v, slot, wait, t, q, bx, bz }]: every car on the road (sim/traffic.js), drawn
//     where the sim puts them; carSeq, fogSeq
//   s.season.farmer = { x, z, heading, target: { x, z } | null, busy, at: 'stand'|'barn'|'giant'|'lot'|'patch'|null,
//     tasks: [{ k, step, ... }] (k: go restock cut fetch try stray lever chase treat), carry: variety | 'wagon' | null }
//   s.season.parking = { used, cap, main, beach, beachOpen }, s.season.road = { q, turned, cars: [{ pat }] }
//   s.season.wagons = { total, free, strays: [{ id, x, z, lesson? }] }, s.season.gran = { t, direct }, s.season.dez = { t, away }
//   s.season.you = { buffer, rush, last, auto }, s.season.golden (golden hour on), s.season.puffs = [{ x, z, until }]
//   s.season.goat = { x, z, row, ate, shoo } | null, s.season.runaway = { x, z, v } | null, s.season.whale = { end } | null
//   s.season.tier ('bargain'|'fair'|'premium', Y2+), shuttleOn, radioW, halUntil, reviews: [{ stars, species, text, cause }]
//   s.season.day = this weekend day (planned families, sched, served, turned, walkoffs, revenue by variety, stars, best)
//   s.season.totals = this year's season (families, served, turned, walkoffs, weekday, revenue, byV, tips, honey, stars,
//     buzzPeak, goatAte, bind: { supply, checkout, wagons, parking, road }, acts: [per weekend day], conc: [histogram])
//   (The winter ledger reads totals: "Families: served, turned away on Route 46, walk-offs; stars start -> end; buzz peak".)
//   s.season.offstage = true switches the season off for this year (no crowd, weekday sales or overnight restock): for
//     balance harnesses that bring their own demand model (tests/balance/patch-standin.js).
//
// Out-events: season/arrive { id, species, park }, season/car { kind: 'park'|'queue'|'uturn'|'leave', lot },
//   season/served { id, by: 'you'|'gran'|'dez'|'relaxed', amount, rush, tips, n, x, z }, season/walkoff { id, x, z },
//   season/bubble { id, v, kind }, season/answer { id, ok, how, v }, season/review { stars, species, text },
//   season/howl { level }, season/puff { x, z }, season/goat { state, x, z }, season/joey { state, x, z, spot },
//   season/runaway { state, x, z }, season/lever { id, on }, season/task { k, state }, season/load { n },
//   season/weekday { n, amt }, season/rush { n }, season/panic { n, sold, amt }, plus patch/restock and patch/cut
//   (the patch UI's juice), cast { who, act }, coins, toast, sound.
//
// Cross-slice helpers (exported): weekendNow(s), atStand(s), families(s), queueReady(s), roadMeter(s), parkingCap(s),
//   expectedFamilies(s, d), tierMul(s), panicNight(s, ctx), seasonSummary(s), addFamily(s, ctx, opts), FARMER_SPOTS.
import { T } from './tuning.js';
import { dayOf, isWeekend as calWeekend, isSaturday, weekendIndex as calWeekendIndex, weekendMult, nextWeekendDay, dowName, label, OPEN, CLOSE, GATE_CLOSE, EVE } from './calendar.js';
import { PLACES, NODES, EDGES, QUEUE, HIDEOUTS, ROAD, rowZ, aisleZ, PICK_X } from './layout.js';
import * as traffic from './traffic.js';
import { makeRng, next, pick, weighted } from './rng.js';
import { clamp, round2, round3, hash32, fill, sum } from './util.js';
import { has, count, hired, spend, canAfford } from './economy.js';
import { activate, deactivate, isActive, getActive, fireNow } from './events.js';
import { LINES, SPECIES as NAMES } from './story.js';
import * as patch from './patch.js';
import * as giant from './giant.js';

const S = T.season, SP = T.species, VT = T.varieties, CAT = T.events.cat, Y1 = T.story.y1, L = LINES.season;
const dCache = new Map();
const D = (x) => { if (typeof x === 'number') return x; let d = dCache.get(x); if (d === undefined) dCache.set(x, (d = dayOf(x))); return d; };
const OCT1 = D('Oct 1');
const SPECIES = SP.list;
const LARGE = Object.keys(VT).filter((v) => VT[v].large);
const fail = (reason) => ({ ok: false, reason });
const u01 = (...k) => hash32(...k) / 4294967296;            // stable keyed noise: crowd draws never depend on the player
const vname = (v) => patch.LINES.names[v] || v;
const r3 = round3;
// selling-weekend lookups by day (calendar's are a search; these run every minute for every family)
const WK_INDEX = Array.from({ length: 400 }, (_, d) => calWeekendIndex(d));
const weekendIndex = (d) => (d >= 0 && d < WK_INDEX.length ? WK_INDEX[d] : calWeekendIndex(d));
const isWeekend = (d) => weekendIndex(d) >= 0;
export const weekendNow = (s) => s.clock.phase === 'october' && isWeekend(s.clock.day) && !s.season?.offstage;
const pinsOk = (s) => !!s.unlocks.pins || s.clock.year > 1;   // year 1: event pins wait for the W3 Sunday lesson

// ------------------------------------------------------------ the path graph (layout's, plus season shortcuts)
// Folks cut straight through the patch in line with its two gates (x = -0.8 from the main gate, x = -5 from the stand's
// little gate, stepping over the vines) instead of walking each aisle to its end, and across the grass to the giant
// corner (from the patch's west path, and from the lane by the patch). Fun beats fidelity: at a stroll it keeps a
// visit near ~100 game-minutes. Your farmer knows the farm's short cuts [motion round 2]: out behind the stand and
// straight across the yard to the barn door (2.2 s), the wagon straight from the barn door to the end of a front row,
// from the stand's corner over the lane and past the patch's corner to the giant (3 s), and over the lane at the main
// gate (the cars stop for you).
const G = { ...NODES };
G.standSE = { id: 'standSE', x: -3.0, z: -8.8 };                    // round the back of the stand
G.fenceW = { id: 'fenceW', x: -9.95, z: -3.25 };                    // the patch fence's west end
G.g_tend = { id: 'g_tend', x: -12.7, z: 5.4 };                      // where your farmer tends the giant
const EXTRA = [['aw5', 'g_view'], ['l_patchW', 'g_view'], ['gate', 'x0']];
const FARMER_EXTRA = [['corral', 'standSE'], ['standSE', 'barn'], ['corral', 'fenceW'], ['fenceW', 'g_tend'], ['g_tend', 'g_se'],
  ['g_tend', 'g_view'], ['corral', 'l_gate'], ['l_gate', 'gate'], ...[0, 1, 2, 3, 4].map((r) => ['barn', `aw${r}`])];
for (let r = 0; r < 7; r++) {
  G[`x${r}`] = { id: `x${r}`, x: NODES.gate.x, z: aisleZ(r) };
  EXTRA.push([`x${r}`, `p${r}_2`], [`x${r}`, `p${r}_3`]);
  if (r) EXTRA.push([`x${r - 1}`, `x${r}`], [`p${r - 1}_1`, `p${r}_1`]);
}
// Nodes by index; shortest paths come from one array Dijkstra per source node (computed on first use, then kept). Two
// graphs: the folks' and your farmer's (theirs plus the short cuts).
const NODE_IDS = Object.keys(G), NN = NODE_IDS.length, NODE_I = Object.fromEntries(NODE_IDS.map((id, i) => [id, i]));
const NX = Float64Array.from(NODE_IDS, (id) => G[id].x), NZ = Float64Array.from(NODE_IDS, (id) => G[id].z);
function graph(edges) {
  const adj = NODE_IDS.map(() => []);
  for (const [a, b] of edges) {
    const ia = NODE_I[a], ib = NODE_I[b], d = Math.hypot(NX[ia] - NX[ib], NZ[ia] - NZ[ib]);
    adj[ia].push(ib, d); adj[ib].push(ia, d);
  }
  return { adj, prev: new Array(NN), routes: NODE_IDS.map(() => new Array(NN)), live: adj.map((a) => a.length > 0), nearest: new Map() };
}
const FOLK = graph([...EDGES, ...EXTRA]), FARM = graph([...EDGES, ...EXTRA, ...FARMER_EXTRA]);
function prevFrom(src, g) {
  const dist = new Float64Array(NN).fill(Infinity), prev = new Int16Array(NN).fill(-1), done = new Uint8Array(NN);
  dist[src] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < NN; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) break;
    done[u] = 1;
    const adj = g.adj[u];
    for (let k = 0; k < adj.length; k += 2) { const v = adj[k], nd = dist[u] + adj[k + 1]; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; } }
  }
  return prev;
}
// The route from node ia to node ib (indexes) as [x, z] points (cached; callers copy the outer array, never the points).
function routePts(ia, ib, g = FOLK) {
  let out = g.routes[ia][ib];
  if (out) return out;
  const prev = (g.prev[ia] ||= prevFrom(ia, g));
  out = [];
  if (ia === ib || prev[ib] >= 0) for (let n = ib; n >= 0; n = n === ia ? -1 : prev[n]) out.unshift([NX[n], NZ[n]]);
  return (g.routes[ia][ib] = out);
}
// The node nearest a point (index) on a graph. Walkers stand on a few hundred distinct spots, so answers are remembered.
function nearestIdx(x, z, g = FOLK) {
  const key = Math.round(x * 1000) * 1e6 + Math.round(z * 1000);
  let best = g.nearest.get(key);
  if (best !== undefined) return best;
  let bd = Infinity;
  best = 0;
  for (let i = 0; i < NN; i++) { if (!g.live[i]) continue; const dx = NX[i] - x, dz = NZ[i] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
  if (g.nearest.size > 20000) g.nearest.clear();
  g.nearest.set(key, best);
  return best;
}
// Point a walker (family or farmer) at (x, z) along the graph; node: arrive exactly on that node.
function walkTo(w, x, z, node) {
  const g = w.tasks ? FARM : FOLK;                                     // your farmer (with tasks) knows the short cuts
  // routes are cached: copy the points too, or two walkers share them and a save can't carry the state (saves.test)
  const pts = routePts(nearestIdx(w.x, w.z, g), node ? NODE_I[node] : nearestIdx(x, z, g), g).map((p) => p.slice());
  // don't step back to a node we have already passed, nor walk past the spot to its node and back
  if (pts.length >= 2 && (pts[0][0] - w.x) * (pts[1][0] - pts[0][0]) + (pts[0][1] - w.z) * (pts[1][1] - pts[0][1]) < 0) pts.shift();
  if (!node && pts.length >= 2) {
    const a = pts.at(-2), b = pts.at(-1);
    if ((b[0] - a[0]) * (x - b[0]) + (b[1] - a[1]) * (z - b[1]) < 0) pts.pop();
  }
  if (!node && (!pts.length || Math.abs(pts.at(-1)[0] - x) + Math.abs(pts.at(-1)[1] - z) > 0.01)) pts.push([r3(x), r3(z)]);
  w.path = pts; w.pi = 0;
  w.target = { x: r3(x), z: r3(z) };
}
// Move along the path; true when there.
function step(w, dist) {
  if (w.kerb) return false;                                   // waiting at the kerb for a gap in the traffic
  if (w.kerb === false && w.z > ROAD_B0 && w.z < ROAD_B1) dist *= S.crossHurry;   // folks hurry across the road
  const path = w.path;
  let hx = 0, hz = 0, turned = false;
  while (w.pi < path.length && dist > 1e-9) {
    const p = path[w.pi], px = p[0], pz = p[1], dx = px - w.x, dz = pz - w.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d > 1e-6) { hx = dx; hz = dz; turned = true; }
    if (d <= dist) { w.x = px; w.z = pz; dist -= d; w.pi++; } else { w.x = r3(w.x + dx / d * dist); w.z = r3(w.z + dz / d * dist); dist = 0; }
  }
  if (turned) w.heading = r3(Math.atan2(hx, hz));
  return w.pi >= path.length;
}
const near = (a, x, z, r) => (a.x - x) ** 2 + (a.z - z) ** 2 <= r * r;

// Where your farmer goes for each station (design §7 station bar: Stand · Patch · Barn · Giant · Lot).
export const FARMER_SPOTS = {
  stand: { x: -3.05, z: -7.45 }, barn: { ...PLACES.barn.door }, giant: { x: G.g_tend.x, z: G.g_tend.z },
  lot: { x: -17.2, z: ROAD.walk }, patch: { x: PICK_X[2], z: aisleZ(0) },
};
const rowSpot = (r) => ({ x: PICK_X[2], z: aisleZ(r) });
const PICK_NEAR = [0, 1, 1, 2, 2, 2, 3, 3];                          // pick-spot indexes, weighted between the two gates
const queueSpot = (i) => (i < QUEUE.length ? QUEUE[i] : { x: QUEUE.at(-1).x - 0.7 * (i - QUEUE.length + 1), z: QUEUE.at(-1).z });
// Motion (design §7): T.season speeds are what the eye sees at 1x, in world units per real second; each tick moves a
// walker speed / ticksPerSecond, so the weekend's length in real time never changes how fast anyone looks.
const TPS = T.calendar.weekend.ticksPerSecond;
const perTick = (uPerS) => r3(uPerS / TPS);
const sec = (x) => Math.round(x * TPS);                       // real seconds at 1x -> ticks
const SPRINT = perTick(S.farmer.speed), HAUL = perTick(S.farmer.speed * S.farmer.wagon);
// Cars come out of Marlene along the patch and pull up at its open front (sim/traffic.js): the family steps straight into
// the patch and the car drives on, up the beach road into the fog (the car park is lost in her; beach-lot cars park on
// the sand). When the family is nearly at the till their car comes out of the fog along the stand's side of the lane and
// pulls up in front of the stand, a few steps away, about as they pay.
const ROAD_B0 = traffic.BAND0, ROAD_B1 = traffic.BAND1;          // the lane's width on the ground
const ROAD_Z0 = ROAD_B0 - 0.1, ROAD_Z1 = ROAD_B1 + 0.1;          // (walkers the cars look out for)
const WAIT_SPOTS = [[-4.2, -5.95], [-3.6, -5.85], [-3.0, -5.95], [-2.4, -5.85]];   // on the stand's verge, by the pick-up

// ------------------------------------------------------------ state
function freshDay(s) {
  return { d: s.clock.day, rStart: round3(s.rep.R), n: 0, sched: [], ptr: 0, arrived: 0, served: 0, byYou: 0, turned: 0, walkoffs: 0, queued: 0, halSkipped: 0,
    rev: 0, byV: {}, tips: 0, honey: 0, starsSum: 0, starsN: 0, photo5: 0, low: 0, best: null, firstBad: false, golden: false,
    acts: 0, maxRush: 0, howl: 0, howlAt: -999, fetches: 0, rafts: 0, soldOut: [] };
}
function freshTotals(s) {
  return { families: 0, served: 0, turned: 0, walkoffs: 0, weekday: { families: 0, amt: 0 }, revenue: 0, byV: {}, tips: 0, honey: 0,
    starsSum: 0, starsN: 0, rStart: round3(s.rep.R), buzzPeak: s.rep.buzz || 0, goatAte: 0, uturnDays: 0,
    bind: { supply: 0, checkout: 0, wagons: 0, parking: 0, road: 0 }, acts: [], conc: [], fetched: 0, rushTips: 0, rafts: 0, raftDays: 0,
    why: {}, starsHist: [0, 0, 0, 0, 0] };
}
function freshSeason(s) {
  const p = FARMER_SPOTS.stand;
  return {
    families: [], queue: [], seq: 0, cars: [], carSeq: 0, fogSeq: 0,
    farmer: { x: PLACES.farmhome.x, z: PLACES.farmhome.z, heading: 0, target: null, busy: false, at: null, tasks: [], path: [], pi: 0, carry: null, home: p, since: 0 },
    parking: { used: 0, cap: S.parking.y1, main: 0, beach: 0, beachOpen: false },
    road: { q: 0, turned: 0, cars: [] },
    wagons: { total: S.wagons.y1, free: S.wagons.y1, strays: [] },
    gran: { t: 0, direct: false }, dez: { t: 0, away: false }, you: { buffer: 0, rush: 0, last: -99, auto: 0 },
    tier: 'fair', shuttleOn: false, radioW: -1, halUntil: -1, golden: false, puffs: [], goat: null, runaway: null, whale: null,
    closed: {}, reviews: [], next: { viral: -1, backfire: -1 }, viralW: -1, oldTimerW: -1, decorator: null, panic: null,
    day: freshDay(s), totals: freshTotals(s), acts: [], bea: 0, census: { on: 0, gawk: 0, possums: 0, want: 0 },
  };
}
export const families = (s) => s.season?.families || [];
const famById = (s, id) => s.season.families.find((f) => f.id === id);

// ------------------------------------------------------------ visitor generation (design §7)
const baseY = (s) => S.base * (1 + S.growth * (Math.min(s.clock.year, S.capYear) - 1));
const radioOn = (s) => s.season.radioW >= 0 && s.season.radioW === weekendIndex(s.clock.day);
/** N_day (weekend) or the weekday trickle for day d, before rounding. Weather comes from Marlene's real day. */
export function expectedFamilies(s, d = s.clock.day) {
  const w = s.weather.days[d] || s.weather, rep = S.rep[0] + S.rep[1] * s.rep.R;
  const wx = (S.wx.base - S.wx.fog * w.f) * (w.heat ? S.wx.heat : 1) * (w.rain ? S.wx.rain : 1);
  if (!isWeekend(d)) return S.weekday * baseY(s) * rep * wx;
  const buzz = 1 + clamp(s.rep.buzz || 0, S.buzz[0], S.buzz[1]);
  const mkt = (s.season.radioW === weekendIndex(d) ? T.shop.radio.arrivals : 1) * (has(s, 'billboard') ? T.shop.billboard.arrivals : 1);
  const riv = (s.season.next.backfire === d ? CAT.big_tom_backfire.arrivals : 1) * (s.clock.year >= S.parkingLotPatch.fromYear ? S.parkingLotPatch.arrivals : 1);
  const ev = (w.f > CAT.pea_soup.f ? CAT.pea_soup.arrivals : 1) * (s.season.next.viral === d ? CAT.viral.arrivals : 1);
  return baseY(s) * rep * weekendMult(d) * wx * buzz * mkt * riv * ev;
}
// Arrival minute: hourly weights spread over 9:00-16:00; owls only from 15:00.
let HOURLY_SUM = null;
function arrivalMinute(sp, u) {
  if (sp === 'owl') return SP.owl.from + Math.floor(u * (GATE_CLOSE - SP.owl.from));
  const w = S.hourly, slot = (GATE_CLOSE - OPEN) / w.length;
  let x = u * (HOURLY_SUM ??= sum(w));
  for (let h = 0; h < w.length; h++) { if (x < w[h]) return OPEN + Math.floor((h + x / w[h]) * slot); x -= w[h]; }
  return GATE_CLOSE - 1;
}
// The day's families are pre-drawn by index (species, arrival time, everything about them), so N only decides how
// many come: every bot faces the same crowd (common random numbers) and nobody can reroll a family.
function planDay(s) {
  const d = s.clock.day, y = s.clock.year, day = s.season.day;
  const n = Math.min(S.candidates, Math.floor(expectedFamilies(s, d) + u01(s.seed, y, d, 'n')));
  const sched = [];
  for (let i = 0; i < n; i++) {
    const sp = SPECIES[Math.floor(u01(s.seed, y, d, i, 'sp') * SPECIES.length)];
    sched.push([arrivalMinute(sp, u01(s.seed, y, d, i, 't')), i, sp]);
  }
  // year-1 lessons need a particular family early in the day. The very first one is already at the curb when the gate
  // opens, so "Ring up the queue" has someone to ring up a few seconds after Gran says it.
  if (y === 1 && d === D(Y1.ringUp)) sched.push([OPEN, 997, S.scripted.first, 'first']);
  if (y === 1 && d === D(Y1.wants)) sched.push([S.scripted.foxAt, 999, 'fox', 'fox']);
  if (y === 1 && d === D(Y1.pins)) sched.push([S.scripted.possumAt, 998, 'possum', 'possum']);
  sched.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  Object.assign(day, { n, sched, ptr: 0 });
  const w = s.weather;
  day.golden = !!w.heat || (w.f < CAT.golden_hour.f && u01(s.seed, y, d, 'golden') < CAT.golden_hour.chance);
  day.firstBad = patch.firstImpressionBad(s);
}

// ------------------------------------------------------------ families: who they are and what they want
function newFamily(s, d, i, sp, minute, script) {
  const y = s.clock.year, r = makeRng(hash32(s.seed, y, d, i, 'fam')), TY = SP.types, W = SP.wants;
  let type = 'regular';
  if (script === 'fox') type = 'regular';
  else if (s.weather.heat && next(r) < TY.dayTripper.share) type = 'day';
  else if (next(r) < (sp === 'fox' ? TY.photo.fox : TY.photo.share)) type = 'photo';
  else if (y >= TY.seeker.fromYear && next(r) < TY.seeker.share) type = 'seeker';
  else if (y >= TY.oldTimer.fromYear && next(r) < (TY.oldTimer[sp] ?? TY.oldTimer.share)) type = 'old';
  const wants = [];
  const large = LARGE.filter((v) => VT[v].unlock <= y);
  const nAdult = script === 'first' ? 1 : type === 'day' ? TY.dayTripper.large : next(r) < W.adultLarge ? (type === 'seeker' || next(r) >= W.two ? 1 : 2) : 0;
  for (let k = 0; k < nAdult; k++) wants.push({ v: script === 'fox' ? 'white' : adultVariety(s, r, sp, type, large), kid: false, k: -1, st: 'open', got: null });
  const kids = [];
  for (let k = 0; k < (SP[sp].kids ?? 2); k++) {                  // a sea otter has the one pup, on her chest
    let v = null;
    if (next(r) < (SP[sp].kidMini ?? W.kidMini)) v = 'mini';
    if (v && y >= W.weirdFromYear && next(r) < W.weird) v = pick(r, ['warty', 'white'].filter((x) => VT[x].unlock <= y)) || 'mini';
    if (script) v = script === 'possum' ? 'mini' : null;
    kids.push({ v, got: false, hop: 0 });
    if (v) wants.push({ v, kid: true, k, st: 'open', got: null });
  }
  const dets = [];
  if (next(r) < S.detour.maze) dets.push('maze');
  if (next(r) < (type === 'photo' ? S.detour.giantPhoto : S.detour.giant * giant.crierEffects(s).gawkMul)) dets.push('giant');
  if (script === 'first') dets.length = 0;                          // straight to the front row and back to the till
  const fort = sp !== 'possum' && next(r) < (sp === 'raccoon' ? S.fort.raccoon : S.fort.others) ? 1 : 0;   // kits up the hay fort while mom queues
  return {
    id: ++s.season.seq, species: sp, type, state: 'in', x: 0, z: 0, heading: Math.PI / 2, path: [], pi: 0, target: null,
    spd: perTick(S.walk * SP[sp].walk), wants, kids, want: wants[0]?.v || null, bubble: null, cart: [], sat: S.sat.start, why: {},
    rows: [], fulls: [], t: 0, wait: 0, pat: 0, park: 'lot', wagon: 0, noWagon: false, dets, rng: r, arr: minute, script: script || null,
    joey: false, carpool: false, raft: 0, dead: false, golden: false, bubbled: false, fort, near: false, kerb: false,
    // set later in the visit; declared here so every family shares one object shape (fast, stable property access)
    car: null, go: null, row: -1, noticed: false, stars: 0, resume: null,
  };
}
function adultVariety(s, r, sp, type, large) {
  if (s.clock.year === 1) return 'classic';
  const pr = SP[sp].prefs, tw = type === 'photo' ? SP.types.photo.weights : {};
  return weighted(r, large.map((v) => [v, (pr[v] ?? 1) * (tw[v] ?? 1) * patch.fadMul(s, v)]));
}
const openWants = (f) => f.wants.filter((w) => w.st === 'open');
const needsWagon = (f) => !SP[f.species].noWagon && f.wants.filter((w) => !w.kid).length >= 2;   // a pouch; a nose
// satisfaction: one place, so reviews can name the dominant cause
function mod(f, cause, delta) {
  if (!delta) return;
  f.sat += delta;
  f.why[cause] = (f.why[cause] || 0) + delta;
}

// ------------------------------------------------------------ parking and Route 46
export function parkingCap(s) {
  const pk = S.parking;
  const main = pk.y1 + (has(s, 'gravel') ? pk.gravel : 0) + (hired(s, 'howie') ? pk.howie : 0) + (s.season.gran.direct ? pk.gran : 0);
  return { main, beach: s.season.parking.beachOpen ? pk.beach : 0 };
}
function syncParking(s) {
  const P = s.season.parking, c = parkingCap(s);
  P.used = P.main + P.beach; P.cap = c.main + c.beach;
}
function parkSpace(s) {
  const P = s.season.parking, c = parkingCap(s);
  if (P.main < c.main) return 'lot';
  if (P.beachOpen && P.beach < c.beach) return 'beach';
  return null;
}
export const roadMeter = (s) => clamp((s.season?.road?.q || 0) / S.road.meterCars, 0, 1);
const halActive = (s) => s.season.halUntil > s.clock.minute;

function arrive(s, ctx, entry) {
  const [m, i, sp, script] = entry, d = s.clock.day, y = s.clock.year;
  if (sp === 'seal') {                                             // by sea: no radio, no shuttle, no parking, no Route 46
    // ...but only one seal family hauls out at a time (T.species.seal.haulOut): with one ashore, the next stays at sea
    if (s.season.families.filter((f) => f.park === 'sea').length >= SP.seal.haulOut) return;
    spawn(s, ctx, entry, 'sea'); return;
  }
  if (!script && halActive(s) && u01(s.seed, y, d, i, 'hal') >= S.tellHal.mul) { s.season.day.halSkipped++; return; }
  if (!script && s.season.shuttleOn && m >= T.shop.shuttle.from11 && u01(s.seed, y, d, i, 'bus') < T.shop.shuttle.share) { spawn(s, ctx, entry, 'shuttle'); return; }
  const lot = parkSpace(s);
  if (lot) { park(s, ctx, lot); spawn(s, ctx, entry, lot); return; }
  const heat = s.weather.heat ? S.road.heat : 1;
  const pat = (S.road.patience[0] + u01(s.seed, y, d, i, 'road') * (S.road.patience[1] - S.road.patience[0])) * heat;
  s.season.road.cars.push({ e: entry.slice(), pat: r3(pat) });     // a copy: the day's schedule keeps its own
  s.season.road.q = s.season.road.cars.length;
  s.season.day.queued++; s.season.totals.bind.parking++;
  ctx.emit({ type: 'season/car', kind: 'queue', lot: 'road' });
}
function park(s, ctx, lot) {
  const P = s.season.parking;
  if (lot === 'beach') P.beach++; else P.main++;
  syncParking(s);
  ctx.emit({ type: 'season/car', kind: 'park', lot });
}
function roadTick(s, ctx) {
  const R = s.season.road, day = s.season.day;
  for (let lot; R.cars.length && (lot = parkSpace(s));) { const c = R.cars.shift(); park(s, ctx, lot); spawn(s, ctx, c.e, lot); }
  if (!R.cars.length && !R.q && !day.howl) return;
  const k = (hired(s, 'howie') ? S.road.howie : 1) * (s.season.gran.direct ? S.road.gran : 1);
  let turned = 0;
  for (const c of R.cars) { c.pat = r3(c.pat - 1 / k); if (!(c.pat > 0)) turned++; }
  if (turned) R.cars = R.cars.filter((c) => c.pat > 0);
  for (let t = 0; t < turned; t++) {
    R.turned++; day.turned++; s.season.totals.turned++; s.season.totals.bind.road++;
    s.rep.R = round3(clamp(s.rep.R + S.road.turnR, 1, 5));
    ctx.emit({ type: 'season/car', kind: 'uturn', lot: 'road' });
  }
  if (turned && (s.unlocks.route46 || s.clock.year > 1)) ctx.emit({ type: 'toast', text: L.uturn, cls: 'warn', icon: 'lot' });
  R.q = R.cars.length;
  // Hal howls on the radio at 50% and 75% of the meter (from W3 in year 1)
  const meter = roadMeter(s), lvl = meter >= S.road.howls[1] ? 2 : meter >= S.road.howls[0] ? 1 : 0;
  if (lvl > day.howl && (s.unlocks.route46 || s.clock.year > 1) && s.clock.minute - day.howlAt >= S.howlCooldown) {
    day.howl = lvl; day.howlAt = s.clock.minute;
    const pool = lvl === 2 ? L.howl75 : s.weather.f < 0.5 ? L.howl50clear : L.howl50;   // Hal looks out of the window first
    ctx.emit({ type: 'season/howl', level: lvl });
    ctx.emit({ type: 'toast', text: `Hal: ${pool[day.howlAt % pool.length]}`, cls: lvl === 2 ? 'bad' : 'warn', icon: 'radio' });
  }
  if (lvl === 0 && day.howl && R.q === 0) day.howl = 0;
}

// ------------------------------------------------------------ a family's visit (design §7 state machine)
function spawn(s, ctx, entry, park) {
  const [m, i, sp, script] = entry, d = s.clock.day;
  const f = newFamily(s, d, i, sp, m, script);
  f.park = park;
  if (park === 'sea') {                                            // swimming in, then flumping up the beach to the patch
    const W = PLACES.sea, z = r3(W.z0 + u01(s.seed, s.clock.year, d, i, 'sea') * (W.z1 - W.z0)), e = NODES.ae3;
    Object.assign(f, { state: 'in', x: W.x, z, heading: -Math.PI / 2, t: 0, pi: 0, target: { x: e.x, z: e.z },
      path: [[W.edge, r3((z + W.up.z) / 2)], [W.up.x, W.up.z], [e.x, e.z]] });
    s.season.families.push(f);
    s.season.day.arrived++; s.season.totals.families++;
    ctx.emit({ type: 'season/arrive', id: f.id, species: sp, park });
    return;
  }
  // into their car, which joins the line coming out of the fog (the year's first family is already at the drop-off)
  const se = s.season, c = traffic.addCar(se, f, 'drop', park === 'beach' ? 'beach' : 'patch', script === 'first' ? 'stop' : 'fog',
    park === 'beach' ? beachSpot(se) : null);
  Object.assign(f, traffic.carPos(c), { state: 'car', car: c.id, t: 0, path: [], pi: 0 });
  s.season.families.push(f);
  s.season.day.arrived++; s.season.totals.families++;
  ctx.emit({ type: 'season/arrive', id: f.id, species: sp, park });
  if (sp === 'possum' && !script && next(f.rng) < CAT.possum_carpool.chance) fireNow(s, ctx, 'possum_carpool', { id: f.id });
}

/**
 * Add one family to today's crowd right now (scripted moments, tests). opts: { species, park: 'lot'|'beach'|'shuttle'|'sea',
 * script: 'fox'|'possum'|null, i (the crowd index their dice come from) }. Returns the family (in its car, arriving).
 */
export function addFamily(s, ctx, { species = 'fox', park: lot = 'lot', script = null, i = 900 + (s.season.seq % 50) } = {}) {
  if (species === 'seal') lot = 'sea';                             // seals always come by sea
  if (lot === 'lot' || lot === 'beach') park(s, ctx, lot);
  spawn(s, ctx, [s.clock.minute, i, species, script], lot);
  return s.season.families.at(-1);
}

// At the gate: first impressions, the field's variety, the weather, the parking, a wagon if they need one.
function enterPatch(s, ctx, f) {
  if (s.season.day.firstBad) mod(f, 'first', T.patch.fullness.firstSat);
  mod(f, 'variety', patch.varietyBonus(s));
  if (s.weather.f > T.weather.effects.cosyF) mod(f, 'cosy', S.sat.cosy);
  if (f.park === 'beach') mod(f, 'beach', f.species === 'pelican' ? S.sat.beachPelican : S.sat.beach);
  if (f.park === 'sea') mod(f, 'sea', SP.seal.seaSat);
  if (s.season.golden) goldenFor(f);
  if (f.species === 'otter') raftUp(s, ctx, f);
  if (needsWagon(f)) {
    const W = s.season.wagons;
    if (W.free > 0) { W.free--; f.wagon = 1; } else f.noWagon = true;
  }
  nextRow(s, ctx, f);
}
// Sea otters raft: an otter family coming into the patch while another is still browsing takes her paw, so neither
// drifts off. Both get +raftSat; the first raft of a day gets a toast and a float over the pair.
function raftUp(s, ctx, f) {
  const o = s.season.families.find((x) => x !== f && x.species === 'otter' && !x.raft && browsing(x));
  if (!o) return;
  f.raft = o.id; o.raft = f.id;
  mod(f, 'raft', SP.otter.raftSat); mod(o, 'raft', SP.otter.raftSat);
  ctx.emit({ type: 'season/raft', a: f.id, b: o.id, x: o.x, z: o.z });
  const day = s.season.day;
  day.rafts = (day.rafts || 0) + 1;
  if (day.rafts === 1) {
    s.season.totals.raftDays = (s.season.totals.raftDays || 0) + 1;
    ctx.emit({ type: 'toast', text: L.raft, cls: 'good', icon: 'sparkle' });
    moment(s, 20, L.moments.raft);
  }
  s.season.totals.rafts = (s.season.totals.rafts || 0) + 1;
}
const pickTicks = (s, f) => {
  const [a, b] = S.pickTicks;
  if (f.script === 'first') return a;
  const cosy = s.weather.f > T.weather.effects.cosyF || s.weather.f > CAT.pea_soup.f ? CAT.pea_soup.linger : 1;
  return Math.round((a + next(f.rng) * (b - a)) * (f.species === 'possum' ? S.possumPick : 1) * cosy);
};
const rowOpen = (s, r) => s.patch.rows[r]?.open && !(s.season.closed[r] > s.clock.minute);
const inPuff = (s, x, z) => s.season.puffs.some((p) => near({ x, z }, p.x, p.z, CAT.skunk_startle.radius));
// Pick the next row: weight = prime stock of what they want x fullness x front bonus; kids pull toward minis.
function chooseRow(s, f) {
  const wants = openWants(f), kidsMini = wants.some((w) => w.kid && w.v === 'mini');
  let best = null, total = 0;
  const opts = [];
  s.patch.rows.forEach((row, r) => {
    if (!rowOpen(s, r) || f.rows.includes(r) || inPuff(s, PICK_X[2], aisleZ(r))) return;
    let stock = 0;
    for (const w of wants) stock += patch.primeStock(s, r, w.v);
    if (!stock) return;
    const wgt = stock * Math.max(0.05, patch.fullness(s, r)) * (r < T.patch.fullness.frontRows ? T.patch.fullness.frontBonus : 1)
      * (kidsMini && patch.primeStock(s, r, 'mini') > 0 ? 1.5 : 1);
    opts.push([r, wgt]); total += wgt;
  });
  if (!total) return null;
  let x = next(f.rng) * total;
  for (const [r, w] of opts) { x -= w; best = r; if (x < 0) break; }
  return best;
}
function nextRow(s, ctx, f) {
  if (f.rows.length < (f.type === 'seeker' ? SP.types.seeker.rows : S.maxRows) && openWants(f).length) {
    const r = f.script === 'first' ? s.patch.rows.findIndex((row, i) => rowOpen(s, i) && openWants(f).some((w) => patch.primeStock(s, i, w.v))) : chooseRow(s, f);
    if (r != null && r >= 0) {
      const k = f.script === 'first' ? 1 : PICK_NEAR[Math.floor(next(f.rng) * PICK_NEAR.length)];   // mostly near the path through the middle
      f.row = r; f.state = 'walk'; f.go = 'row';
      walkTo(f, PICK_X[k], aisleZ(r), `p${r}_${k}`);
      return;
    }
  }
  if (wantBubble(s, ctx, f)) return;
  afterBrowse(s, ctx, f);
}
// What they want isn't anywhere in the field: the [?] bubble (once per family), right where they stand.
function wantBubble(s, ctx, f) {
  const missing = openWants(f).find((w) => !patch.rowsWithPrime(s, w.v).length);
  if (!missing || f.bubbled) return false;
  // only a [?] you could do something about: with nothing in the barn and nothing else to offer (a picked-clean field),
  // a tap target would be a dead end, so they just make do (polish wave: they piled up over the stand on bare Sundays)
  if (!f.script && !answerable(s, openWants(f)[0])) return false;
  f.bubbled = true; f.state = 'want';
  showBubble(s, ctx, f, missing.v, 'want');
  return true;
}
// Picking at a row: buy each open want this row has in prime (Premium makes some think twice; Perfect Seekers only buy
// from a row at least 60% full; a second large pumpkin needs a wagon).
function pickAt(s, ctx, f) {
  const r = f.row, full = patch.fullness(s, r);
  f.rows.push(r); f.fulls.push(r3(full));
  const tier = s.season.tier, y = s.clock.year;
  let large = f.cart.filter((c) => VT[c.v].large && !c.kid).length;
  for (const w of openWants(f)) {
    if (!patch.primeStock(s, r, w.v)) continue;
    if (f.type === 'seeker' && full < SP.types.seeker.minFull) continue;
    if (!w.kid && large >= 1 && f.noWagon) { w.st = 'nowagon'; mod(f, 'noWagon', S.sat.noWagon); showBubble(s, ctx, f, w.v, 'wagon'); s.season.totals.bind.wagons++; continue; }
    if (y >= S.tiers.fromYear && tier === 'premium' && f.type !== 'day' && f.type !== 'seeker' && !patch.fadTolerance(s, w.v)) {
      const no = f.type === 'old' ? -SP.types.oldTimer.premium : -S.premium.chance;
      if (next(f.rng) < no) { w.st = 'price'; mod(f, 'premium', w.kid ? S.sat.kidMiss : S.sat.adultMiss); continue; }
    }
    if (buy(s, ctx, f, r, w, w.v)) { if (!w.kid) large++; }
  }
  // a visiting kid grabs the row's shiny 20% of visits (it sells as a plain pumpkin)
  if (f.kids.some((k) => k.v) && patch.shinyAt(s, r) && next(f.rng) < CAT.shiny.kidGrab) {
    if (patch.shinyGrab(s, ctx, r)) ctx.emit({ type: 'toast', text: fill(L.kidShiny, { row: r + 1 }), cls: 'warn', icon: 'sparkle' });
  }
  if (!patch.primeStock(s, r) && !s.season.day.soldOut.includes(r)) {
    s.season.day.soldOut.push(r);
    if (s.clock.minute < 720 && r < 2) moment(s, 22, fill(L.moments.soldOut, { row: r + 1 }));
    // the whole field picked clean before noon: the Crier's "{FARM} SELLS OUT BY NOON" (design §9, score 50), once a year
    if (s.clock.minute < 720 && !s.season.soldOutNoon && s.patch.rows.every((row, i) => !row.open || !patch.primeStock(s, i))) {
      s.season.soldOutNoon = s.clock.year;
      ctx.story('soldOut', 50, { day: s.clock.day });
    }
  }
}
function buy(s, ctx, f, r, w, v, how = 'got') {
  const out = {};
  if (!patch.take(s, r, v, 1, { out })) return false;
  f.cart.push({ v, soft: false, tr: !!out.trucked, kid: w.kid });
  w.st = how; w.got = v;
  if (w.kid) f.kids[w.k].got = true;
  if (how === 'got') mod(f, w.kid ? 'kids' : 'adult', w.kid ? S.sat.kid : S.sat.adult);
  else if (how === 'sug') mod(f, 'suggested', S.sat.suggested);
  else if (how === 'sub') mod(f, 'suggested', S.sat.alone);
  if (out.trucked) noticeTrucked(s, f);
  return true;
}
function noticeTrucked(s, f) {
  if (f.noticed) return;
  const Tk = T.patch.trucked, p = f.type === 'old' ? SP.types.oldTimer.trucked : Tk[f.species] ?? Tk.notice;
  if (next(f.rng) < p) { f.noticed = true; mod(f, 'trucked', S.sat.trucked); }
}
function afterPick(s, ctx, f) {
  const left = openWants(f);
  if (!left.length) return afterBrowse(s, ctx, f);
  // something they want exists somewhere else in the field: keep browsing
  if (left.some((w) => patch.rowsWithPrime(s, w.v).some((r) => !f.rows.includes(r) && rowOpen(s, r))) && f.rows.length < (f.type === 'seeker' ? SP.types.seeker.rows : S.maxRows)) return nextRow(s, ctx, f);
  // not in the field at all: the [?] bubble
  if (wantBubble(s, ctx, f)) return;
  afterBrowse(s, ctx, f);
}
// A want you can answer: "Fetch from barn" (the barn has it) or "Try ___" (another prime variety in the field, a large one
// for the grown-ups), the same choices the [?] chooser offers.
const answerable = (s, w) => !!w && (patch.barnStock(s, w.v) > 0
  || Object.keys(VT).some((v) => v !== w.v && (w.kid || VT[v].large) && patch.rowsWithPrime(s, v).length));
function showBubble(s, ctx, f, v, kind) {
  f.bubble = { v, kind, t: kind === 'wagon' ? S.noWagonTicks : S.bubbleTicks, held: 0, t0: s.clock.minute, looked: false };
  ctx.emit({ type: 'season/bubble', id: f.id, v, kind });
}
// Unanswered wants: substitute another large prime (50%), else soft fruit of the want at half price (50%), else go without.
function settleWants(s, ctx, f) {
  for (const w of openWants(f)) {
    if (!w.kid || w.v !== 'mini') {
      if (next(f.rng) < S.substitute) {
        const subs = LARGE.filter((v) => v !== w.v).map((v) => [v, patch.rowsWithPrime(s, v)]).filter(([, rs]) => rs.length);
        if (subs.length) { const [v, rs] = subs[Math.floor(next(f.rng) * subs.length)]; if (buy(s, ctx, f, rs[0], w, v, 'sub')) continue; }   // a substitute is still a sale: not a lost one
      }
    }
    if (next(f.rng) < S.softInstead) {
      const r = s.patch.rows.findIndex((row) => row.by[w.v]?.soft > 0);
      if (r >= 0 && patch.take(s, r, w.v, 1, { soft: true })) {
        f.cart.push({ v: w.v, soft: true, tr: false, kid: w.kid }); w.st = 'soft'; w.got = w.v;
        if (w.kid) f.kids[w.k].got = true;
        mod(f, 'soft', S.sat.soft); s.season.totals.bind.supply += 0.5; continue;   // half a sale lost
      }
    }
    w.st = 'none';
    patch.noteUnmet(s, w.v, 1);
    mod(f, w.kid ? 'kidsMiss' : 'unmet', w.kid ? S.sat.kidMiss : S.sat.adultMiss);
    s.season.totals.bind.supply++;
  }
}
function afterBrowse(s, ctx, f) {
  settleWants(s, ctx, f);
  if (f.park === 'beach') fetchCar(s, f);          // it's a long way round from the sand: off it goes, to wait in the fog
  if (f.bubble?.kind === 'want') f.bubble = null;
  // how the rows looked: full rows +5, bare ones -8 (Photo Families want half full)
  if (f.fulls.length) {
    const m = sum(f.fulls) / f.fulls.length, bad = f.type === 'photo' ? SP.types.photo.minFull : T.patch.fullness.bad;
    if (m >= T.patch.fullness.good) mod(f, 'full', T.patch.fullness.goodSat);
    else if (m < bad) mod(f, 'thin', T.patch.fullness.badSat);
  }
  // done in the back rows, right beside her: half of them wander over to see the giant (once, and not at closing)
  if (!f.near && f.rows.length && f.rows.at(-1) >= S.detour.nearRow && !f.dets.includes('giant') && s.clock.minute < S.closing) {
    f.near = true;
    if (next(f.rng) < S.detour.giantNear) f.dets.unshift('giant');
  }
  nextDetour(s, ctx, f);
}
const DETOUR = {
  giant: { node: 'g_view', state: 'gawk', ticks: () => S.giantTicks },
  maze: { node: 'maze', state: 'maze', ticks: () => S.detour.mazeTicks },
  fort: { node: 'hayfort', state: 'fort', ticks: () => S.fort.ticks },
};
function nextDetour(s, ctx, f) {
  const dz = f.dets.shift();
  if (!dz) return toStand(s, ctx, f);
  const n = NODES[DETOUR[dz].node];
  f.state = 'walk'; f.go = dz;
  walkTo(f, n.x, n.z, DETOUR[dz].node);
}
function atDetour(s, ctx, f, dz) {
  f.state = DETOUR[dz].state; f.t = DETOUR[dz].ticks();
  if (dz === 'giant') {
    const est = s.giant && giant.hasFruit(s.giant) ? giant.publishedEstimate(s, s.giant) : 0, C = giant.crierEffects(s);
    if (est >= C.gawkEst) mod(f, 'gawk', C.gawkSat);
    if (f.species === 'skunk' && /fish|both/.test(s.giant?.feed || '')) mod(f, 'gawk', T.giant.fishSkunkSat);
  } else mod(f, dz, dz === 'maze' ? S.detour.mazeKids : S.detour.fortKids);   // the kids' favourite part
}
// Walk to the back of the line; patience only starts counting once they're standing in it.
function toStand(s, ctx, f) {
  f.bubble = null;
  if (!f.cart.length) return leave(s, ctx, f);
  f.state = 'toQueue'; f.go = null;
  if (f.park !== 'sea') fetchCar(s, f);                            // their car gets ready to pick them up
  const p = queueSpot(s.season.queue.length);
  walkTo(f, p.x, p.z);
}
function joinQueue(s, ctx, f) {
  f.state = 'queue'; f.wait = 0;
  if (f.fort === 1) { f.fort = 2; mod(f, 'fort', S.detour.fortKids); }   // the kits are off up the hay fort (render: f.fort 2)
  f.pat = Math.round(S.queue.patience * SP[f.species].patience * (f.type === 'day' ? SP.types.dayTripper.patience : 1));
  s.season.queue.push(f.id);
}
function leave(s, ctx, f) {
  f.state = 'out'; f.bubble = null; f.go = 'exit';
  if (f.fort === 2) f.fort = 3;                                    // down from the fort, back with mom
  const qi = s.season.queue.indexOf(f.id);
  if (qi >= 0) s.season.queue.splice(qi, 1);
  // 30% leave their wagon in the field as a stray at their last row (once you've met the wagons)
  if (f.wagon) {
    f.wagon = 0;
    const W = s.season.wagons;
    if (f.rows.length && (s.unlocks.wagons || s.clock.year > 1) && next(f.rng) < S.strays) {
      const r = f.rows.at(-1);
      W.strays.push({ id: `w${s.season.seq}-${f.id}`, x: r3(-8.5 + next(f.rng) * 15), z: r3(aisleZ(r) + 0.35), lesson: false });
    } else W.free++;
  }
  if (f.park === 'sea') {                                          // down the beach and home by sea, pumpkins rolling ahead
    const W = PLACES.sea, z = r3(W.z0 + next(f.rng) * (W.z1 - W.z0));
    walkTo(f, W.up.x, W.up.z, 'beach');
    f.path.push([W.edge, r3((z + W.up.z) / 2)], [W.x, z]); f.target = { x: W.x, z }; f.go = 'sea';
    return;
  }
  // out to the stand's verge by the pick-up (over the road at a crossing if they're still on the patch's side); their car
  // is on its way
  const w = WAIT_SPOTS[f.id % WAIT_SPOTS.length];
  walkTo(f, w[0], w[1]);
  fetchCar(s, f); f.go = 'wait';
}
// Their car has picked them up: their space in the lot (or on the sand) is free as it pulls away. (A beach-lot car
// leaves its space on the sand earlier, to come round for them; the space counts as theirs until they're in.)
function freeSpace(s, ctx, f) {
  const P = s.season.parking;
  if (f.park === 'lot') P.main = Math.max(0, P.main - 1);
  else if (f.park === 'beach') P.beach = Math.max(0, P.beach - 1);
  syncParking(s);
  if (f.park !== 'shuttle') ctx.emit({ type: 'season/car', kind: 'leave', lot: f.park });
}
// Their car gets ready to fetch them, once: when they head for the line at the till (a beach-lot car backs off the sand
// and goes round through Marlene as soon as they're done browsing), or as they leave without paying. It waits in the
// fog until they're nearly ready (carReady), and holds its space at the pick-up until they're in.
function fetchCar(s, f) {
  const se = s.season, c = carOf(s, f);
  if (c && (c.k === 'fetch' || c.k === 'round' || c.k === 'home')) return;   // already on its way
  if (f.park === 'beach' && c?.k === 'parked') Object.assign(c, { k: 'round', r: 'sand', s: 0, v: 0, t: 0 });
  else if (f.park === 'beach' && c?.r === 'beach') c.k = 'round';   // (still on its way to the sand: it backs out again from there)
  else f.car = traffic.addCar(se, f, 'fetch', 'stand').id;
}
// families on their way home: in their car, walking to the curb, waiting there
const LEAVING = new Set(['car', 'out', 'curb']);
const atSea = (f) => f.x > PLACES.sea.edge;                        // a seal in the water swims (quicker than a flump)
const carOf = (s, f) => s.season.cars.find((c) => c.id === f.car) || null;
const beachSpot = (se) => {
  const used = se.cars.filter(traffic.holdsSpace).map((c) => c.bz), B = ROAD.sand;
  return { x: B.x, z: B.spots.find((z) => !used.includes(z)) ?? B.spots[0] };
};
function gone(s, ctx, f) {
  const i = s.season.families.indexOf(f);
  if (i >= 0) s.season.families.splice(i, 1);
}
// The road, one tick (sim/traffic.js): cars come in, pull up at the drop-off and drive on up the beach. There a family
// hops out into the patch, or hops in from the verge once they're at the door; riding families go where their car goes.
function carsTick(s, ctx) {
  const se = s.season;
  if (!se.cars.length) return;
  // anyone on foot on the road or about to step off its verge (the cars look out for them)
  const walkers = [];
  if (se.farmer.z > ROAD_Z0 && se.farmer.z < ROAD_Z1) walkers.push({ id: 0, x: se.farmer.x, z: se.farmer.z });
  for (const f of se.families) if (f.state !== 'car' && f.z > ROAD_Z0 && f.z < ROAD_Z1) walkers.push({ id: f.id, x: f.x, z: f.z });
  if (se.runaway) walkers.push({ id: -1, x: se.runaway.x, z: se.runaway.z });
  // a car's family (a dozen or so on the farm: a scan beats building a Map every tick)
  const fam = { get: (id) => { for (const f of se.families) if (f.id === id) return f; return undefined; } };
  const done = traffic.tick(se, walkers, (c) => atStop(s, ctx, c, fam.get(c.fam)), () => {},
    (c, door) => (door ? atDoor(fam.get(c.fam), c) : carReady(s, fam.get(c.fam))));
  for (const c of done) {
    const f = fam.get(c.fam);
    if (c.k === 'home') { if (f) gone(s, ctx, f); se.cars.splice(se.cars.indexOf(c), 1); }
    else if (c.r === 'beach') { if (c.k === 'round') Object.assign(c, { r: 'sand', s: 0, v: 0, t: 0 }); else { c.k = 'parked'; c.v = 0; } }
    else if (c.r === 'sand') Object.assign(c, { r: 'stand', k: 'fetch', s: 0, v: 0, t: 0, q: ++se.fogSeq });   // round and back for them
    else se.cars.splice(se.cars.indexOf(c), 1);                    // parked in the lot, in the fog
  }
  // a pick-up car standing still with its family at its door (at its space, or still waiting its turn): in they hop
  for (const c of se.cars) {
    if (c.k !== 'fetch' || c.r !== 'stand' || c.q >= 0 || c.v > 0 || c.wait > 0) continue;
    const f = fam.get(c.fam);
    if (!f) { c.k = 'home'; c.slot = -1; continue; }
    const d = traffic.doorOf(c);
    if (f.state !== 'curb' || f.go !== 'door' || !near(f, d.x, d.z, 0.3)) continue;
    Object.assign(c, { k: 'home', slot: -1, wait: S.car.board });
    Object.assign(f, traffic.carPos(c), { state: 'car', bubble: null }); freeSpace(s, ctx, f);
  }
  for (const c of se.cars) {                                      // riding families go where their car goes
    if (c.q >= 0 || c.v <= 0) continue;                           // (in the fog, or standing: where they were)
    const f = fam.get(c.fam);
    if (f && f.state === 'car' && f.car === c.id) { const p = traffic.carPos(c); f.x = p.x; f.z = p.z; }
  }
}
// A pick-up car waiting in the fog comes in once its family is about as far from the pick-up as it is (S.car.call ticks):
// the rest of their walk to the line and a turn at the till for each family ahead of them (quick with you behind the
// counter, Gran's pace without), or the rest of their walk out. A car there too soon would hold up everyone behind it.
function carReady(s, f) {
  if (!f || f.state === 'curb') return true;
  if (f.state === 'out') return pathLeft(f) / f.spd <= S.car.call;
  if (f.state !== 'queue' && f.state !== 'toQueue') return false;
  const se = s.season, turn = atStand(s) ? 2 : hired(s, 'dez') && !se.dez.away ? S.servers.dez : S.servers.gran;
  const ahead = f.state === 'queue' ? se.queue.indexOf(f.id) : se.queue.length;
  return (f.state === 'toQueue' ? pathLeft(f) / f.spd : 0) + ahead * turn <= S.car.call;
}
// ...and its family is right by its door, about to hop in (it stops for them)
function atDoor(f, c) {
  if (!f || f.go !== 'door' || (f.state !== 'out' && f.state !== 'curb')) return false;
  const d = traffic.doorOf(c);
  return near(f, d.x, d.z, 1.2);
}
function pathLeft(w) {
  let d = 0, x = w.x, z = w.z;
  for (let i = w.pi; i < w.path.length && d <= 99; i++) { const p = w.path[i]; d += Math.hypot(p[0] - x, p[1] - z); x = p[0]; z = p[1]; }
  return d;
}
function atStop(s, ctx, c, f) {
  const d = traffic.door(c.r, c.slot), x = r3(d.x), z = r3(d.z);
  if (c.k === 'drop') {
    // out of the door on the patch side and straight into the front row's aisle
    c.k = 'park'; c.wait = S.car.drop; c.slot = -1;
    if (!f || f.state !== 'car') return;
    Object.assign(f, { state: 'in', x, z, path: [[x, aisleZ(0)]], pi: 0, target: { x, z: aisleZ(0) } });
  }                                                        // (a pick-up waits there for its family: carsTick)
}

// One family, one tick: a small handler per state (rare states never disturb the common ones' compiled code).
const STATE_TICK = {
  car() {},                                               // riding: carsTick moves them with their car
  in(s, ctx, f) { if (step(f, f.spd * (atSea(f) ? SP.seal.swim : 1.15))) enterPatch(s, ctx, f); },   // a skip in their step
  walk(s, ctx, f) {
    if (!step(f, f.spd)) return;
    if (f.go === 'row') { f.state = 'pick'; f.t = pickTicks(s, f); }
    else if (DETOUR[f.go]) atDetour(s, ctx, f, f.go);
  },
  pick(s, ctx, f) { if (--f.t <= 0) { pickAt(s, ctx, f); if (f.state === 'pick') afterPick(s, ctx, f); } },
  want(s, ctx, f) {
    const b = f.bubble;
    if (!b) { afterBrowse(s, ctx, f); return; }
    if (answering(s, f)) {                                  // your farmer is on the way: they wait, but not forever
      if (--b.held <= 0) { s.season.farmer.tasks = s.season.farmer.tasks.filter((t) => t.fam !== f.id); startStep(s, ctx); afterBrowse(s, ctx, f); }
      return;
    }
    if (--b.t <= 0) afterBrowse(s, ctx, f);
  },
  gawk(s, ctx, f) { if (--f.t <= 0) nextDetour(s, ctx, f); },
  maze(s, ctx, f) { if (--f.t <= 0) nextDetour(s, ctx, f); },
  fort(s, ctx, f) { if (--f.t <= 0) nextDetour(s, ctx, f); },
  toddler() {},                                           // posing: the toddler event moves them on
  whale(s, ctx, f) { step(f, f.spd); },
  toQueue(s, ctx, f) {
    const p = queueSpot(s.season.queue.length);           // the back of the line moves up as folks are served
    const x = r3(p.x), z = r3(p.z), n = f.path.length;
    if (f.pi < n && (f.path[n - 1][0] !== x || f.path[n - 1][1] !== z)) f.path[n - 1] = [x, z];
    if (step(f, f.spd) || near(f, p.x, p.z, 0.3)) joinQueue(s, ctx, f);
  },
  queue(s, ctx, f) { queueTick(s, ctx, f); },
  out(s, ctx, f) {                                          // out to the verge, and along it to their car's door
    if (f.go === 'sea') { if (step(f, f.spd * (atSea(f) ? SP.seal.swim : 1))) { ctx.emit({ type: 'season/splash', id: f.id, x: f.x, z: f.z }); gone(s, ctx, f); } return; }
    toDoor(s, f);
    if (step(f, f.spd)) f.state = 'curb';
  },
  curb(s, ctx, f) { if (toDoor(s, f)) f.state = 'out'; },                     // waiting there for it
};
// Their car is at the pick-up, or waiting its turn on the stand's side a few steps from it: along the verge to its door
// (once they're on the stand's side of the road), following it as it moves up. True when they set off (again).
function toDoor(s, f) {
  const c = carOf(s, f);
  if (!c || c.k !== 'fetch' || c.r !== 'stand' || c.q >= 0 || f.z > ROAD_B0 - 0.05 || !traffic.nearPickup(c)) return false;
  const d = traffic.doorOf(c), x = r3(d.x), z = r3(d.z);
  if (f.go === 'door' && Math.abs(f.target.x - x) < 0.05) return false;
  f.go = 'door'; f.path = [[x, z]]; f.pi = 0; f.target = { x, z };
  return true;
}
function famTick(s, ctx, f) {
  const fn = STATE_TICK[f.state];
  if (fn) fn(s, ctx, f);
  if (f.bubble !== null && f.bubble.kind === 'wagon' && --f.bubble.t <= 0) f.bubble = null;
  if (s.clock.minute >= S.closing && CLOSING.has(f.state) && !(f.state === 'want' && answering(s, f))) { f.dets = []; afterBrowse(s, ctx, f); }
}
const CLOSING = new Set(['walk', 'pick', 'gawk', 'maze', 'fort', 'want']);
const answering = (s, f) => s.season.farmer.tasks.some((t) => t.fam === f.id && (t.k === 'fetch' || t.k === 'try'));
function queueTick(s, ctx, f) {
  const i = s.season.queue.indexOf(f.id), p = queueSpot(Math.max(0, i));
  // the line moved up: still on the way in, keep the route and just change where it ends
  if (!f.target || f.target.x !== r3(p.x) || f.target.z !== r3(p.z)) {
    f.target = { x: r3(p.x), z: r3(p.z) };
    if (f.pi < f.path.length - 1) f.path[f.path.length - 1] = [f.target.x, f.target.z];
    else { f.path = [[f.target.x, f.target.z]]; f.pi = 0; }
  }
  step(f, f.spd);
  if (i === 0 && f.fort === 2) f.fort = 3;                         // at the front: the kits come down from the fort
  if (i === 0 && near(f, p.x, p.z, 0.1)) f.heading = 3.14;        // face the counter
  f.wait++;
  if (s.season.whale) return;                                       // everybody's watching the whale
  if (f.wait > f.pat) {
    if (f.species === 'possum' && !f.dead) {                        // she keels over and plays dead for another full patience
      f.dead = true; f.pat += Math.round(S.queue.patience * SP.possum.patience);
      ctx.emit({ type: 'toast', text: L.playDead, cls: 'warn', icon: 'stand' });
      return;
    }
    walkOff(s, ctx, f);
  }
}
// Queue patience ran out: they drop their pumpkins (Gran puts them back in the barn) and give 1 star.
function walkOff(s, ctx, f) {
  for (const c of f.cart) s.patch.barnLots.push({ v: c.v, n: 1, age: 0, st: c.soft ? 'soft' : 'prime', sa: 0, tr: c.tr });
  patch.refreshRows(s);
  f.cart = [];
  mod(f, 'walkoff', -100);
  s.season.day.walkoffs++; s.season.totals.walkoffs++; s.season.totals.bind.checkout++;
  finish(s, ctx, f, 1);
  ctx.emit({ type: 'season/walkoff', id: f.id, x: f.x, z: f.z });
  ctx.emit({ type: 'toast', text: fill(L.walkoff, { many: NAMES[f.species]?.many ?? f.species }), cls: 'bad', icon: 'stand' });
  leave(s, ctx, f);
}

// ------------------------------------------------------------ checkout (Gran, Dez, you)
const TIERS = ['bargain', 'fair', 'premium'];
export const tierMul = (s) => (s.clock.year >= S.tiers.fromYear ? S.tiers[s.season.tier] ?? 1 : 1);
const frontFamily = (s) => (s.season.queue.length ? famById(s, s.season.queue[0]) : null);
/** The front family is at the counter and can be rung up. */
export function queueReady(s) {
  const f = frontFamily(s);
  return !!f && f.state === 'queue' && near(f, QUEUE[0].x, QUEUE[0].z, S.queueReady);
}
/** Your farmer is behind the counter with nothing else to do. */
export const atStand = (s) => s.season?.farmer.at === 'stand' && !s.season.farmer.tasks.length;

function serve(s, ctx, f, by) {
  const day = s.season.day, tot = s.season.totals, you = s.season.you, m = s.clock.minute, y = s.clock.year;
  const tm = f.type === 'panic' ? 1 : tierMul(s);
  let amount = 0;
  for (const c of f.cart) {
    const p = round2((c.tr ? VT.classic.price : VT[c.v].price) * (c.soft && f.type !== 'panic' ? T.patch.aging.softPrice : 1) * tm);
    amount = round2(amount + p);
    day.byV[c.v] = round2((day.byV[c.v] || 0) + p); tot.byV[c.v] = round2((tot.byV[c.v] || 0) + p);
  }
  // the price board (Y2+): Bargain pleases the price-sensitive, Premium grates (Day-Trippers don't care)
  if (y >= S.tiers.fromYear && f.type !== 'day' && f.type !== 'panic') {
    if (s.season.tier === 'bargain' && f.type === 'old') mod(f, 'bargain', S.sat.bargain);
    if (s.season.tier === 'premium') mod(f, 'premium', f.type === 'old' ? S.sat.premiumSensitive : S.sat.premiumOther);
  }
  const waited = Math.max(0, f.wait - S.queue.waitFree);
  mod(f, 'wait', -Math.min(S.queue.maxPenalty, Math.floor(waited / S.queue.perTicks)));
  if (f.dead) mod(f, 'playDead', S.sat.playDead);                    // she gasps awake at the till
  if (s.patch.shinies.some((x) => x.state === 'display')) mod(f, 'shiny', CAT.shiny.displaySat);
  let rush = 0, tips = 0, honey = 0;
  if (by === 'you') {
    rush = m - you.last <= S.rush.window ? Math.min(S.rush.max, you.rush + 1) : 1;
    you.rush = rush; you.last = m; day.byYou++;
    if (rush >= 2) tips = round2(amount * S.rush.tip * rush);
    day.maxRush = Math.max(day.maxRush, rush);
    if (rush >= 4) moment(s, 12 + rush, fill(L.moments.rush, { n: rush }));
    tot.rushTips = round2(tot.rushTips + tips);
  }
  if (next(f.rng) < T.patch.hives.honeyBuy && patch.honeyTake(s, 1)) honey = S.honeyPrice;
  if (f.species === 'beaver' && f.fulls.length && sum(f.fulls) / f.fulls.length >= SP.beaver.tipFull) {
    tips = round2(tips + SP.beaver.tips[0] + Math.floor(next(f.rng) * (SP.beaver.tips[1] - SP.beaver.tips[0] + 1)));
  }
  if (amount) ctx.money(amount, 'pumpkins');
  if (honey) ctx.money(honey, 'honey');
  if (tips) ctx.money(tips, 'tips');
  day.rev = round2(day.rev + amount + honey + tips); day.tips = round2(day.tips + tips); day.honey += honey; day.served++;
  tot.revenue = round2(tot.revenue + amount + honey + tips); tot.tips = round2(tot.tips + tips); tot.honey += honey; tot.served++;
  if (f.wait > S.queue.waitFree * 2) tot.bind.checkout += 0.25;     // a long wait costs goodwill, not the sale (a walk-off is 1)
  ctx.emit({ type: 'season/served', id: f.id, by, amount: round2(amount + honey + tips), rush, tips, n: f.cart.length, x: f.x, z: f.z });
  if (by === 'you') { ctx.emit({ type: 'coins', amount: amount + honey + tips, x: f.x, z: f.z }); if (rush >= 2) ctx.emit({ type: 'season/rush', n: rush }); }
  f.kids.forEach((k) => { if (k.got) k.hop = 1; });
  finish(s, ctx, f);
  const qi = s.season.queue.indexOf(f.id);
  if (qi >= 0) s.season.queue.splice(qi, 1);
  leave(s, ctx, f);
  if (by === 'you') ctx.goalDone('ringUp');
}
// Stars, reputation, buzz counters, the review ticker.
function finish(s, ctx, f, forced) {
  const sat = clamp(f.sat, S.sat.min, S.sat.max);
  const stars = forced ?? clamp(Math.round(sat / S.stars.div), S.stars.min, S.stars.max);
  f.stars = stars;
  const day = s.season.day, tot = s.season.totals;
  day.starsSum += stars; day.starsN++; tot.starsSum += stars; tot.starsN++;
  tot.starsHist[stars - 1]++;
  for (const k in f.why) tot.why[k] = (tot.why[k] || 0) + f.why[k];       // what moved satisfaction, summed (tuning)
  if (stars === 5 && f.type === 'photo') { day.photo5++; viralRoll(s, ctx, f); }
  if (stars <= 2) day.low++;
  s.rep.R = round3(clamp(s.rep.R + S.R.k * (stars - s.rep.R), 1, 5));
  review(s, ctx, f, stars);
}
// A line nobody has posted lately: the species' own voice about half the time, else the general pool for the cause.
// Recent lines (the last S.review.fresh) are skipped while an unused one is left.
function reviewLine(s, f, own, pool) {
  const recent = (s.season.recentLines ||= []);
  const fresh = (xs) => (xs || []).filter((t) => !recent.includes(t));
  const sp = fresh(own), gen = fresh(pool);
  let list = sp.length && (!gen.length || next(f.rng) < 0.5) ? sp : gen;
  if (!list.length) list = (own || []).concat(pool || []);
  if (!list.length) return null;
  const text = list[Math.floor(next(f.rng) * list.length)];
  recent.push(text);
  if (recent.length > S.review.fresh) recent.shift();
  return text;
}
function review(s, ctx, f, stars) {
  if (!(stars === 1 || stars === 5 || next(f.rng) < S.review.chance)) return;
  const ws = Object.entries(f.why);
  if (!ws.length) return;
  const pos = ws.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]), neg = ws.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  const cause = (stars >= 4 ? pos[0] : stars <= 2 ? neg[0] : (Math.abs(pos[0]?.[1] || 0) >= Math.abs(neg[0]?.[1] || 0) ? pos[0] : neg[0]) || pos[0] || neg[0])?.[0];
  const need = L.reviewsSpNeed[`${f.species}.${cause}`];
  const own = need && !f.cart.some((c) => c.v === need) ? null : L.reviewsSp[f.species]?.[cause];
  const text = reviewLine(s, f, own, L.reviewsBy[cause]);
  if (!text) return;
  const rv = { stars, species: f.species, text, cause, d: s.clock.day, m: s.clock.minute };
  s.season.reviews.unshift(rv);
  if (s.season.reviews.length > S.review.keep) s.season.reviews.length = S.review.keep;
  ctx.emit({ type: 'season/review', ...rv });
  if (stars === 5) moment(s, 8, `“${text}”`);
}
function moment(s, score, text) {
  const d = s.season.day;
  if (!d.best || score > d.best.score) d.best = { score, text };
}
function checkoutTick(s, ctx) {
  if (s.season.whale || !s.season.queue.length) return;                                       // checkout freezes while everybody watches the whale
  const g = s.season.gran, dz = s.season.dez, you = s.season.you;
  if (atStand(s) && you.buffer > 0 && queueReady(s)) { you.buffer--; serve(s, ctx, frontFamily(s), 'you'); }
  if (!g.direct) { if (queueReady(s)) { if (++g.t >= S.servers.gran) { g.t = 0; serve(s, ctx, frontFamily(s), 'gran'); } } }
  if (hired(s, 'dez') && !dz.away) { if (queueReady(s)) { if (++dz.t >= S.servers.dez) { dz.t = 0; serve(s, ctx, frontFamily(s), 'dez'); } } }
  if (s.prefs.relaxedRegister && atStand(s)) { if (queueReady(s)) { if (++you.auto >= S.servers.gran) { you.auto = 0; serve(s, ctx, frontFamily(s), 'relaxed'); } } }
}

// ------------------------------------------------------------ your farmer (attention is the resource)
// Tasks are plain data: { k, step, wait, ...args }. STEPS lists each kind's legs: moves ('to:*'), waits ('wait:*')
// and actions. A task resolves on arrival; anything you're away from keeps running at its automatic rate.
const STEPS = {
  go: ['to:dest'], restock: ['to:barn', 'wait:load', 'to:rowEnd', 'restock'], cut: ['to:row', 'wait:cut', 'cut'],
  fetch: ['to:barn', 'to:fam', 'fetch'], try: ['to:fam', 'try'], stray: ['to:stray', 'stray'], lever: ['to:lot', 'lever'],
  chase: ['to:event', 'chase'], treat: ['to:giant', 'wait:treat', 'treat'],
};
const MAX_TASKS = 4;
function legTarget(s, t, leg) {
  const what = leg.slice(3);
  if (what === 'dest') return t.to === 'row' || t.to === 'patch' ? rowSpot(t.row ?? 0) : FARMER_SPOTS[t.to];
  if (what === 'barn') return FARMER_SPOTS.barn;
  if (what === 'lot') return FARMER_SPOTS.lot;
  if (what === 'giant') return FARMER_SPOTS.giant;
  if (what === 'row') { if (t.row == null) t.row = restockRow(s); return t.row == null ? null : rowSpot(t.row); }
  // the wagon pulls up at the row's west end, on the path beside it, and the fruit go in from there
  if (what === 'rowEnd') { if (t.row == null) t.row = frontRestockRow(s); return t.row == null ? null : { x: NODES.aw0.x, z: aisleZ(t.row) }; }
  if (what === 'fam') { const f = famById(s, t.fam); return f ? { x: f.x, z: f.z } : null; }
  if (what === 'stray') return s.season.wagons.strays.find((w) => w.id === t.id) || null;
  if (what === 'event') return eventSpot(s, t.ev);
  return null;
}
function startStep(s, ctx) {
  const F = s.season.farmer;
  for (let guard = 0; guard < 8; guard++) {
    const t = F.tasks[0];
    if (!t) { F.busy = false; F.target = null; F.since = s.clock.minute; return; }
    F.busy = true;
    const leg = STEPS[t.k][t.step];
    if (leg == null) {                                             // done: where did we end up?
      F.tasks.shift();
      if (t.k === 'go') F.at = t.to === 'row' ? 'patch' : t.to;
      else if (near(F, FARMER_SPOTS.stand.x, FARMER_SPOTS.stand.z, 0.5)) F.at = 'stand';
      ctx.emit({ type: 'season/task', k: t.k, state: 'done' });
      continue;
    }
    if (leg.startsWith('to:')) {
      const p = legTarget(s, t, leg);
      if (!p) { F.tasks.shift(); continue; }                       // the family left, the stray was picked up...
      F.at = null;
      walkTo(F, p.x, p.z);
      return;
    }
    if (leg.startsWith('wait:')) {
      const what = leg.slice(5);
      if (what === 'load' && !patch.barnStock(s)) { ctx.emit({ type: 'toast', text: L.loadEmpty, cls: 'warn', icon: 'barn' }); F.tasks.shift(); continue; }
      t.wait = what === 'load' ? S.actions.restockLoad : what === 'cut' ? S.actions.cutTicks : what === 'treat' ? S.actions.treatTicks : 1;
      if (what === 'load') { F.carry = 'wagon'; ctx.emit({ type: 'season/load', n: Math.min(S.actions.restockN, patch.barnStock(s)) }); }
      return;
    }
    act(s, ctx, t, leg);
    if (F.tasks[0] === t && t.wait > 0) return;                    // the action started a wait of its own (posing)
    if (F.tasks[0] === t) t.step++;
  }
}
function farmerTick(s, ctx) {
  const F = s.season.farmer, t = F.tasks[0];
  if (!t) { F.busy = false; return; }
  if (t.wait > 0) { if (--t.wait <= 0) { t.wait = 0; t.step++; startStep(s, ctx); } return; }
  // chasing something that moves (a family): re-aim when it has wandered off
  if (STEPS[t.k][t.step] === 'to:fam') {
    const f = famById(s, t.fam);
    if (!f) { F.tasks.shift(); startStep(s, ctx); return; }
    if (!near(f, F.target?.x ?? f.x, F.target?.z ?? f.z, 1)) walkTo(F, f.x, f.z);
  }
  const there = step(F, F.carry === 'wagon' ? HAUL : SPRINT);
  collectStrays(s, ctx);
  if (there) { t.step++; startStep(s, ctx); }
}
function collectStrays(s, ctx) {
  const F = s.season.farmer, W = s.season.wagons;
  const got = W.strays.filter((w) => near(F, w.x, w.z, S.strayRadius));
  if (!got.length) return;
  W.strays = W.strays.filter((w) => !got.includes(w));
  W.free += got.length;
  ctx.emit({ type: 'toast', text: L.strayBack, cls: 'good', icon: 'stand' });
  ctx.emit({ type: 'sound', name: 'plink', pitch: 1.2 });
  if (!W.strays.some((w) => w.lesson)) ctx.goalDone('wagons');
}
function restockRow(s) {
  // the emptiest front row (rows 1-2 first), else the emptiest row
  let best = null, bf = Infinity;
  s.patch.rows.forEach((row, r) => { if (!row.open) return; const f = patch.fullness(s, r) + (r < 2 ? -0.25 : 0) + r * 0.001; if (f < bf && patch.fullness(s, r) < 1) { bf = f; best = r; } });
  return best;
}
/** The row your farmer's restock wagon is bound for (the camera frames the haul as it is loaded), or null. */
export function haulRow(s) {
  const t = s.season.farmer.tasks[0];
  return t?.k === 'restock' ? t.row ?? frontRestockRow(s) : null;
}
// "Restock" with no row picked (design §7: the emptiest front row): the emptiest of the three rows by the lane that has
// room, else the emptiest row anywhere. A row's own Restock button picks that row.
function frontRestockRow(s) {
  let best = null, bf = Infinity;
  for (let r = 0; r < 3; r++) { const row = s.patch.rows[r]; if (!row?.open) continue; const f = patch.fullness(s, r); if (f < 0.9 && f < bf) { bf = f; best = r; } }
  return best ?? restockRow(s);
}
function act(s, ctx, t, leg) {
  const F = s.season.farmer;
  switch (leg) {
    case 'restock': {
      F.carry = null;
      const n = patch.restockRow(s, t.row, S.actions.restockN);
      if (n) {
        ctx.emit({ type: 'patch/restock', row: t.row, n, by: 'farmer' });
        ctx.goalDone('restock');
      } else ctx.emit({ type: 'toast', text: patch.barnStock(s) ? 'That row is full.' : L.loadEmpty, cls: 'warn', icon: 'barn' });
      F.at = 'patch';
      break;
    }
    case 'cut': {
      const n = patch.cutToBarn(s, t.row);
      if (n) { ctx.emit({ type: 'patch/cut', row: t.row, n }); ctx.emit({ type: 'toast', text: fill(patch.LINES.toast.cut, { n }), cls: 'good', icon: 'barn' }); }
      F.at = 'patch';
      break;
    }
    case 'fetch': case 'try': answerArrive(s, ctx, t); break;
    case 'stray': collectStrays(s, ctx); break;
    case 'lever': applyLever(s, ctx, t.id, t.on); F.at = 'lot'; break;
    case 'chase': chaseArrive(s, ctx, t); break;
    case 'treat': {
      const g = ctx.mod('giant').default.actions['giant/treat'];
      const r = g(s, { plot: t.plot }, ctx);
      if (!r.ok) ctx.emit({ type: 'toast', text: r.reason, cls: 'warn' });
      F.at = 'giant';
      break;
    }
  }
}
// Every task has the same fields (one object shape); unused ones stay null.
function taskOf(a) {
  const t = { k: null, to: null, row: null, fam: null, want: null, v: null, id: null, on: null, ev: null, plot: null, step: 0, wait: 0 };
  for (const key in a) if (a[key] !== undefined) t[key] = a[key];
  return t;
}
function addTask(s, ctx, a) {
  const F = s.season.farmer, t = taskOf(a);
  if (t.k === 'go') {
    // a new destination replaces any trip that is only a trip
    F.tasks = F.tasks.filter((x, i) => x.k !== 'go' || (i === 0 && false));
    if (F.tasks.length && F.tasks[0].k !== 'go') { F.tasks.push(t); return true; }
    F.tasks.unshift(t);
    startStep(s, ctx);
    return true;
  }
  if (F.tasks.length >= MAX_TASKS) return false;
  // don't stack the same errand twice
  if (F.tasks.some((x) => x.k === t.k && x.fam === t.fam && x.id === t.id && x.ev === t.ev && x.row === t.row && t.k !== 'restock')) return false;
  const idle = !F.tasks.length || F.tasks[0].k === 'go';
  if (idle) F.tasks = F.tasks.filter((x) => x.k !== 'go');
  F.tasks.push(t);
  if (idle) startStep(s, ctx);
  return true;
}

// ------------------------------------------------------------ want bubbles: Fetch from barn, or Try ___
function answerArrive(s, ctx, t) {
  const f = famById(s, t.fam);
  if (!f || LEAVING.has(f.state) || f.state === 'queue' || f.state === 'toQueue') return;
  const w = openWants(f).find((x) => x.v === t.want) || openWants(f)[0];
  if (!w) return;
  if (t.k === 'fetch') {
    if (!patch.barnTake(s, w.v, 1)) { ctx.emit({ type: 'toast', text: fill(L.noBarn, { variety: vname(w.v) }), cls: 'warn', icon: 'barn' }); return; }
    f.cart.push({ v: w.v, soft: false, tr: false, kid: w.kid });
    w.st = 'got'; w.got = w.v;
    if (w.kid) f.kids[w.k].got = true;
    mod(f, 'fetch', w.kid ? S.sat.kid : S.actions.fetchSat);
    s.season.day.fetches++; s.season.totals.fetched++;
    moment(s, 18, fill(L.moments.fetch, { many: NAMES[f.species]?.many ?? f.species }));
    ctx.emit({ type: 'season/answer', id: f.id, ok: true, how: 'fetch', v: w.v, x: f.x, z: f.z });
    ctx.emit({ type: 'toast', text: L.fetched, cls: 'good', icon: 'barn' });
    f.kids.forEach((k) => { k.hop = 1; });
  } else {
    const rs = patch.rowsWithPrime(s, t.v);
    const p = f.script === 'fox' ? 1 : f.type === 'regular' ? S.actions.tryRegular : S.actions.tryAccept;
    if (rs.length && next(f.rng) < p && buy(s, ctx, f, rs[0], w, t.v, 'sug')) {
      ctx.emit({ type: 'season/answer', id: f.id, ok: true, how: 'try', v: t.v, x: f.x, z: f.z });
      ctx.emit({ type: 'toast', text: fill(L.tryYes, { variety: vname(t.v) }), cls: 'good', icon: 'pumpkin' });
    } else {
      ctx.emit({ type: 'season/answer', id: f.id, ok: false, how: 'try', v: t.v });
      ctx.emit({ type: 'toast', text: fill(L.tryNo, { want: vname(w.v) }), cls: 'warn', icon: 'pumpkin' });
    }
  }
  ctx.goalDone('wants');
  f.bubble = null;
  afterBrowse(s, ctx, f);
}

// ------------------------------------------------------------ traffic levers
function applyLever(s, ctx, id, on) {
  const se = s.season;
  if (id === 'beach') {
    se.parking.beachOpen = on ?? !se.parking.beachOpen;
    ctx.emit({ type: 'toast', text: se.parking.beachOpen ? L.beachOpen : L.beachClosed, cls: 'good', icon: 'lot' });
    if (se.parking.beachOpen) ctx.goalDone('route46');
  } else if (id === 'gran') {
    se.gran.direct = on ?? !se.gran.direct; se.gran.t = 0;
    ctx.emit({ type: 'toast', text: se.gran.direct ? L.granDirect : L.granBack, cls: 'good', icon: 'lot' });
    ctx.emit({ type: 'cast', who: 'gran', act: 'wave' });
  }
  syncParking(s);
  ctx.emit({ type: 'season/lever', id, on: id === 'beach' ? se.parking.beachOpen : se.gran.direct });
}

// ------------------------------------------------------------ events that need your farmer (design §10)
const HIDE = Object.keys(HIDEOUTS);
function eventSpot(s, ev) {
  const a = getActive(s, ev);
  if (ev === 'goat') return s.season.goat ? { x: s.season.goat.x, z: s.season.goat.z } : null;
  if (ev === 'toddler_giant') return a ? FARMER_SPOTS.giant : null;
  if (ev === 'dez_wanders') return a ? { x: PLACES.hayfort.x + 0.8, z: PLACES.hayfort.z + 1.2 } : null;
  return a ? { x: a.x, z: a.z } : null;
}
function chaseArrive(s, ctx, t) {
  const C = CAT;
  if (t.ev === 'goat') {
    const g = s.season.goat;
    if (!g) return;
    g.shoo++;
    if (g.shoo >= C.goat.taps) return goatLeaves(s, ctx);
    ctx.emit({ type: 'toast', text: L.goatShoo[g.shoo % L.goatShoo.length], cls: 'event', icon: 'sparkle' });
    // she dodges to another row
    const rows = s.patch.rows.map((row, r) => r).filter((r) => r !== g.row && patch.primeStock(s, r) > 0);
    if (rows.length) { g.row = rows[(g.shoo * 7 + g.ate) % rows.length]; g.x = r3(clamp(g.x + (g.shoo % 2 ? C.goat.hop : -C.goat.hop), -8, 5)); g.z = aisleZ(g.row); }
    ctx.emit({ type: 'season/goat', state: 'dodge', x: g.x, z: g.z });
    activate(s, { id: 'goat', until: s.clock.day, x: g.x, z: g.z, data: null });
  } else if (t.ev === 'lost_joey') {
    const a = getActive(s, 'lost_joey');
    if (!a) return;
    joeyFound(s, ctx, a);
  } else if (t.ev === 'toddler_giant') {
    const a = getActive(s, 'toddler_giant');
    if (!a || a.data.posing) return;
    a.data.posing = true;
    t.wait = C.toddler_giant.poseTicks;                              // stand there and let them pose
  } else if (t.ev === 'proposal') {
    const a = getActive(s, 'proposal');
    if (!a) return;
    s.season.closed[a.data.row] = s.clock.minute + C.proposal.ticks;
    s.rep.R = round3(clamp(s.rep.R + C.proposal.dR, 1, 5));
    deactivate(s, 'proposal');
    ctx.story('proposal', 30, { row: a.data.row + 1 });
    moment(s, 40, fill(L.moments.proposal, { row: a.data.row + 1 }));
    ctx.emit({ type: 'toast', text: fill(L.proposalGiven, { row: a.data.row + 1 }), cls: 'good', icon: 'sparkle' });
    ctx.emit({ type: 'sound', name: 'done' });
  } else if (t.ev === 'dez_wanders') {
    s.season.dez.away = false; s.season.dez.t = 0;
    deactivate(s, 'dez_wanders');
    ctx.emit({ type: 'toast', text: L.dezBack, cls: 'good', icon: 'stand' });
  }
}
function goatLeaves(s, ctx) {
  const g = s.season.goat;
  if (!g) return;
  ctx.emit({ type: 'toast', text: fill(L.goatGone, { n: g.ate }), cls: 'event', icon: 'sparkle' });
  ctx.emit({ type: 'season/goat', state: 'gone', x: g.x, z: g.z });
  s.season.totals.goatAte += g.ate;
  if (s.season.totals.goatAte >= 10 && !s.season.goatLogged) { s.season.goatLogged = true; ctx.story('goat', 60, { N: s.season.totals.goatAte }); }
  if (g.ate >= 4) moment(s, 14, fill(L.moments.goat, { n: g.ate }));
  s.season.goat = null;
  deactivate(s, 'goat');
}
// A hideout id as the toast says it: 'hayfort' -> 'hay fort', 'barnDoor' -> 'barn door'.
const spotName = (id) => ({ hayfort: 'hay fort', sail: 'shade sail' }[id] || id.replace(/([A-Z])/g, ' $1').toLowerCase());
function joeyFound(s, ctx, a) {
  const C = CAT.lost_joey, f = famById(s, a.data.fam);
  if (f) { mod(f, 'joey', C.family); f.joey = false; }
  for (const x of s.season.families) if (x !== f && !LEAVING.has(x.state)) mod(x, 'joey', C.everyone);
  s.rep.buzz = round3(clamp((s.rep.buzz || 0) + C.buzz, S.buzz[0], S.buzz[1]));
  const spot = spotName(a.data.spot || 'hayfort');
  ctx.emit({ type: 'toast', text: fill(L.joeyFound, { spot }), cls: 'good', icon: 'sparkle' });
  ctx.emit({ type: 'season/joey', state: 'found', x: a.x, z: a.z, spot: a.data.spot });
  ctx.emit({ type: 'sound', name: 'done' });
  ctx.story('joey', 35, { R: nearestRow(a.z) + 1, spot });
  moment(s, 35, fill(L.moments.joey, { spot }));
  deactivate(s, 'joey_pin'); deactivate(s, 'lost_joey');
  ctx.goalDone('pins');
  if (f) viralRoll(s, ctx, f, true);
}
const nearestRow = (z) => clamp(Math.round((z + 1) / 2), 0, 6);

// viral (chain): a 5-star Photo Family at golden hour, with a displayed shiny, or a joey reunion. 30% (fox x2, golden x1.5).
function viralRoll(s, ctx, f, joey = false) {
  const C = CAT.viral, wi = weekendIndex(s.clock.day);
  if (s.season.viralW === wi) return;
  const cause = joey || f.golden || s.patch.shinies.some((x) => x.state === 'display');
  if (!cause || f.type !== 'photo' && !joey) return;
  const p = C.chance * (f.species === 'fox' ? SP.fox.viral : 1) * (f.golden ? CAT.golden_hour.viralMul : 1);
  if (next(ctx.rng('events')) < p) fireNow(s, ctx, 'viral');
}
function goldenFor(f) {
  if (f.golden) return;
  f.golden = true;
  mod(f, 'golden', f.type === 'photo' ? CAT.golden_hour.photoSat : CAT.golden_hour.sat);
}
// a green puff: families inside the radius drop what they're doing and pick a row outside it
const startle = (s, ctx, x, z) => fireNow(s, ctx, 'skunk_startle', { x, z });

// ------------------------------------------------------------ the catalogue (design §10)
// Surprises keep their real-time pace (design §10 counts notables a minute at 1x): the catalogue's chances are per
// 60-second selling day, and a day now runs (CLOSE - OPEN) / TPS seconds, so they are scaled by PACE (80 / 60).
const PACE = (CLOSE - OPEN) / TPS / 60;
const RATES = new Map();
const tickRate = (perDay, ticks = GATE_CLOSE - OPEN) => {
  const k = perDay * 1e4 + ticks;
  let p = RATES.get(k);
  if (p === undefined) RATES.set(k, (p = 1 - Math.pow(1 - Math.min(1, perDay * PACE), 1 / ticks)));
  return p;
};
const onSite = (s) => s.season.families.filter((f) => !LEAVING.has(f.state));
const browsing = (f) => !LEAVING.has(f.state) && f.state !== 'queue' && f.state !== 'toQueue';
const someRowPrime = (s) => s.patch.rows.some((row) => row.stock.prime > 0);
const EVENTS = [
  { // goat (notable): Pamela from next door eats 1 pumpkin per 15 ticks from the nearest row until shooed (3 taps)
    id: 'goat', cls: 'notable', per: 'tick', cooldownDays: CAT.goat.cooldown, capSeason: CAT.goat.capSeason,
    when: (s) => weekendNow(s) && weekendIndex(s.clock.day) + 1 >= CAT.goat.fromWeekend && s.clock.minute >= CAT.goat.after
      && s.clock.minute < GATE_CLOSE && !s.season.goat && pinsOk(s) && someRowPrime(s),
    rate: () => tickRate(CAT.goat.rate, GATE_CLOSE - CAT.goat.after),
    fire(s, ctx) {
      const rows = s.patch.rows.map((row, r) => r).filter((r) => patch.primeStock(s, r) > 0);
      const row = rows.at(-1) ?? 0;
      s.season.goat = { x: 6.2, z: aisleZ(row), row, ate: 0, shoo: 0, t: 0 };
      activate(s, { id: 'goat', until: s.clock.day, x: 6.2, z: aisleZ(row), data: null });
      ctx.emit({ type: 'season/goat', state: 'in', x: 6.2, z: aisleZ(row) });
      ctx.emit({ type: 'sound', name: 'bark' });
      const sk = onSite(s).find((f) => f.species === 'skunk');
      if (sk) startle(s, ctx, sk.x, sk.z);
    },
  },
  { // skunk startle (chain): a green puff; families avoid radius 4 for 30 ticks. A restock window.
    id: 'skunk_startle', cls: 'chain', per: 'tick', cooldownTicks: CAT.skunk_startle.cooldownTicks,
    when: () => false, rate: () => 0,
    fire(s, ctx, data) {
      const C = CAT.skunk_startle, x = data?.x ?? 0, z = data?.z ?? 0;
      s.season.puffs.push({ x: r3(x), z: r3(z), until: s.clock.minute + C.ticks });
      for (const f of s.season.families) {
        if (!near(f, x, z, C.radius) || !['walk', 'pick'].includes(f.state) || f.go === 'exit') continue;
        f.state = 'walk'; f.rows = f.rows.filter((r) => r !== f.row);
        nextRow(s, ctx, f);
      }
      ctx.emit({ type: 'season/puff', x, z });
    },
  },
  { // lost joey (notable): 10% per possum family; a joey hides at 1 of 8 spots; Biscuit barks toward it after 3 s
    id: 'lost_joey', cls: 'notable', per: 'tick', cooldownDays: CAT.lost_joey.cooldown, capYear: CAT.lost_joey.cap,
    when: (s) => weekendNow(s) && s.season.census.possums > 0 && pinsOk(s) && !isActive(s, 'lost_joey') && s.clock.minute < S.closing,
    rate: (s) => 1 - Math.pow(1 - CAT.lost_joey.rate, (s.season.census.possums / 90) * PACE),
    fire(s, ctx, data) {
      const C = CAT.lost_joey;
      const f = data?.fam ? famById(s, data.fam) : s.season.families.find((x) => x.species === 'possum' && browsing(x));
      if (!f) return;
      const spot = data?.spot || HIDE[Math.floor(next(ctx.rng('events')) * HIDE.length)], p = HIDEOUTS[spot];
      f.joey = true;
      activate(s, { id: 'lost_joey', until: s.clock.day, x: p.x, z: p.z, data: { fam: f.id, spot, end: s.clock.minute + (data?.ticks || C.findTicks), bark: s.clock.minute + sec(C.barkSeconds) } });
      ctx.emit({ type: 'season/joey', state: 'lost', x: p.x, z: p.z, spot, fam: f.id });
    },
  },
  { // golden hour (notable, weather-driven): weekend 15:00-16:30 when Marlene is thin (50%) or a heat wave (always)
    id: 'golden_hour', cls: 'notable', per: 'tick', urgent: true, cooldownDays: 1,
    when: (s) => weekendNow(s) && s.season.day.golden && !s.season.golden && s.clock.minute >= CAT.golden_hour.from && s.clock.minute < CAT.golden_hour.to,
    rate: () => 1,
    fire(s, ctx) {
      s.season.golden = true;
      activate(s, { id: 'golden_hour', until: s.clock.day, x: null, z: null, data: null });
      for (const f of onSite(s)) goldenFor(f);
      moment(s, 15, L.moments.golden);
      const C = CAT.proposal;
      if (s.clock.year >= C.fromYear && s.rep.R >= C.R && next(ctx.rng('events')) < C.chance) fireNow(s, ctx, 'proposal');
    },
  },
  { // viral (chain): next selling day +35% arrivals, buzz +0.35, one per weekend
    id: 'viral', cls: 'chain', per: 'day', when: () => false, rate: () => 0,
    fire(s, ctx) {
      const C = CAT.viral;
      s.season.viralW = weekendIndex(s.clock.day);
      s.season.next.viral = nextWeekendDay(s.clock.day);
      s.rep.buzz = round3(clamp((s.rep.buzz || 0) + C.buzz, S.buzz[0], S.buzz[1]));
      const K = 20 + Math.floor(next(ctx.rng('events')) * 60);
      ctx.story('viral', 55, { K: `${K},000` });
      moment(s, 55, L.moments.viral);
      ctx.emit({ type: 'toast', text: `Hal: ${LINES.hal.viral}`, cls: 'event', icon: 'radio' });
    },
    text: () => LINES.events.viral,
  },
  { // pea soup (notable, weather): arrivals x0.65 (in N_day), families linger +20%, cosy +3
    id: 'pea_soup', cls: 'notable', per: 'day', urgent: true,
    when: (s) => weekendNow(s) && s.weather.f > CAT.pea_soup.f, rate: () => 1,
    fire() {},
  },
  { // Big Tom's pumpkin cannon backfires (notable): skunks startle; next selling day +15%
    id: 'big_tom_backfire', cls: 'notable', per: 'tick', cooldownDays: CAT.big_tom_backfire.cooldown,
    when: (s) => weekendNow(s) && s.clock.minute < GATE_CLOSE, rate: () => tickRate(CAT.big_tom_backfire.rate),
    fire(s, ctx) {
      s.season.next.backfire = nextWeekendDay(s.clock.day);
      ctx.emit({ type: 'sound', name: 'thunk' });
      const sk = onSite(s).find((f) => f.species === 'skunk');
      if (sk) startle(s, ctx, sk.x, sk.z);
    },
  },
  { // runaway pumpkin (minor): rolls down the lane toward the beach; tap within 5 s and Biscuit fetches it ($8)
    id: 'runaway_pumpkin', cls: 'minor', per: 'tick', cooldownDays: CAT.runaway_pumpkin.cooldown,
    when: (s) => weekendNow(s) && pinsOk(s) && !s.season.runaway && s.clock.minute < S.closing && patch.primeStock(s, 0) > 0,
    rate: () => 1 - Math.pow(1 - CAT.runaway_pumpkin.perHour, PACE / 60),
    fire(s, ctx) {
      const C = CAT.runaway_pumpkin, v = patch.displayVariety(s.patch.rows[0]) || 'classic';
      if (!patch.take(s, 0, null, 1)) return;
      s.season.runaway = { x: C.roll[0], z: -3.9, v, end: s.clock.minute + sec(C.tapSeconds) };
      activate(s, { id: 'runaway_pumpkin', until: s.clock.day, x: C.roll[0], z: -3.9, data: null });
      ctx.emit({ type: 'season/runaway', state: 'roll', x: C.roll[0], z: -3.9 });
      const sk = onSite(s).find((f) => f.species === 'skunk' && near(f, C.roll[0], -3.9, CAT.skunk_startle.radius));
      if (sk) startle(s, ctx, sk.x, sk.z);                          // a dropped pumpkin near a skunk family
    },
    tap(s, ctx) {
      const rp = s.season.runaway;
      if (!rp) return;
      s.season.runaway = null;
      ctx.money(CAT.runaway_pumpkin.price, 'pumpkins');
      s.season.day.rev += CAT.runaway_pumpkin.price;
      ctx.emit({ type: 'season/runaway', state: 'saved', x: rp.x, z: rp.z });
      ctx.emit({ type: 'cast', who: 'biscuit', act: 'hop' });
      ctx.emit({ type: 'coins', amount: CAT.runaway_pumpkin.price, x: rp.x, z: rp.z });
      ctx.emit({ type: 'toast', text: L.runawaySaved, cls: 'good', icon: 'coin' });
    },
  },
  { // toddler at the giant (notable, Y3+): pose with them (20 ticks) for +20 and buzz; ignore them, -5
    id: 'toddler_giant', cls: 'notable', per: 'tick', cooldownDays: CAT.toddler_giant.cooldown,
    when: (s) => weekendNow(s) && s.clock.year >= CAT.toddler_giant.fromYear && !isActive(s, 'toddler_giant')
      && s.season.census.gawk > 0 && giant.hasFruit(s.giant) && giant.publishedEstimate(s, s.giant) >= CAT.toddler_giant.est,
    rate: () => tickRate(CAT.toddler_giant.rate, CAT.toddler_giant.gawkTicks),
    fire(s, ctx) {
      const f = onSite(s).find((x) => x.state === 'gawk');
      if (!f) return;
      f.state = 'toddler';
      activate(s, { id: 'toddler_giant', until: s.clock.day, x: PLACES.giantView.x, z: PLACES.giantView.z, data: { fam: f.id, end: s.clock.minute + CAT.toddler_giant.window, posing: false } });
    },
    text: () => LINES.events.toddler_giant.join(' '),
  },
  { // possum carpool (minor): one mom carrying four joeys; the other mom plays dead in a wagon
    id: 'possum_carpool', cls: 'minor', per: 'day', when: () => false, rate: () => 0,
    fire(s, ctx, data) { const f = famById(s, data?.id); if (f) f.carpool = true; },
    text: () => L.carpool,
  },
  { // proposal (story, Y2+): a fox couple in the patch at golden hour; give them the row: R +0.1, a Crier brief
    id: 'proposal', cls: 'story', per: 'day', capYear: 1, when: () => false, rate: () => 0,
    fire(s, ctx) {
      let row = 0, best = -1;
      s.patch.rows.forEach((x, r) => { if (x.open && patch.fullness(s, r) > best) { best = patch.fullness(s, r); row = r; } });
      activate(s, { id: 'proposal', until: s.clock.day, x: PICK_X[1], z: aisleZ(row), data: { row, end: s.clock.minute + CAT.proposal.window } });
    },
    text: (s) => fill(L.proposal, { row: (getActive(s, 'proposal')?.data.row ?? 0) + 1 }),
  },
  { // Dez wanders off to the hay fort (minor): register lane 2 stops until you fetch him
    id: 'dez_wanders', cls: 'minor', per: 'tick', cooldownDays: 1,
    when: (s) => weekendNow(s) && hired(s, 'dez') && !s.season.dez.away && s.clock.minute >= CAT.dez_wanders.from && s.clock.minute < CAT.dez_wanders.to,
    rate: () => tickRate(CAT.dez_wanders.rate, CAT.dez_wanders.to - CAT.dez_wanders.from),
    fire(s) { s.season.dez.away = true; activate(s, { id: 'dez_wanders', until: s.clock.day, x: PLACES.hayfort.x, z: PLACES.hayfort.z, data: null }); },
  },
  { // the Old-Timer (minor): one review a weekend in the ticker, from year 2 (when Old-Timers start coming, design §3)
    id: 'old_timer', cls: 'minor', per: 'tick',
    when: (s) => weekendNow(s) && s.clock.year >= SP.types.oldTimer.fromYear && s.season.census.on > 0 && s.season.oldTimerW !== weekendIndex(s.clock.day) && s.clock.minute > 600,
    rate: () => 1 / 500,
    fire(s, ctx) {
      s.season.oldTimerW = weekendIndex(s.clock.day);
      const rec = (s.giant?.history || []).some((h) => (h.result?.W || 0) >= T.rivals.record.W);
      const text = rec ? L.oldTimerRecord : L.oldTimer[(s.clock.day + s.clock.year) % L.oldTimer.length];
      const rv = { stars: 3, species: s.clock.day % 2 ? 'owl' : 'beaver', text, cause: 'oldTimer', d: s.clock.day, m: s.clock.minute };
      s.season.reviews.unshift(rv);
      if (s.season.reviews.length > S.review.keep) s.season.reviews.length = S.review.keep;
      ctx.emit({ type: 'season/review', ...rv });
    },
    quiet: true,
  },
  { // a whale off the bluff on a weekend (notable): half the crowd walks to the beach for 40 ticks; checkout freezes;
    // everyone +8 on return. A quiet restock window.
    id: 'whale_weekend', cls: 'notable', per: 'tick', capSeason: CAT.whale.capSeason,
    when: (s) => weekendNow(s) && s.season.census.on >= 4 && s.weather.f < CAT.whale.f && !s.season.whale && s.clock.minute < S.closing - CAT.whale.crowdTicks,
    rate: () => tickRate(CAT.whale.weekendRate),
    fire(s, ctx) {
      const C = CAT.whale;
      s.season.whale = { end: s.clock.minute + C.crowdTicks };
      activate(s, { id: 'whale_weekend', until: s.clock.day, x: PLACES.whale.x, z: PLACES.whale.z, data: null });
      for (const f of onSite(s)) {
        if (f.state === 'queue' || f.state === 'toQueue' || f.state === 'in' || next(ctx.rng('events')) >= C.crowdShare) continue;
        f.resume = { state: f.state, go: f.go, t: f.t };
        f.state = 'whale';
        walkTo(f, 9.3, 3.6 + (f.id % 7) * 0.75);                // down on the sand past the beach lot
      }
      ctx.emit({ type: 'toast', text: L.whaleGo, cls: 'event', icon: 'whale' });
      ctx.emit({ type: 'sound', name: 'foghorn' });
      ctx.story('whale', 30, {});
      moment(s, 30, L.moments.whale);
    },
    text: () => LINES.events.whale,
  },
  { // Hotel Marlene's decorator order (notable, Y3+, Sep 5, 50%/yr): 40 by Friday Oct 9 at x1.3; a miss costs R -0.1
    id: 'decorator_order', cls: 'notable', per: 'day', capYear: 1, urgent: true,
    when: (s) => s.clock.phase === 'grow' && s.clock.year >= CAT.decorator_order.fromYear && s.clock.day >= D(CAT.decorator_order.date)
      && s.clock.day < D(CAT.decorator_order.date) + 5 && u01(s.seed, s.clock.year, 'decorator') < CAT.decorator_order.chance,
    rate: () => 1,
    fire(s, ctx) {
      const v = VT.cinderella.unlock <= s.clock.year && s.patch.rows.some((r) => r.variety === 'cinderella' || r.plan?.variety === 'cinderella') ? 'cinderella' : 'classic';
      const D2 = L.decorator, V = vname(v);
      ctx.card('decorator', { speaker: 'mayor', eyebrow: D2.eyebrow, title: D2.title, text: fill(D2.text, { Variety: V }), variety: v,
        choices: [{ id: 'yes', label: D2.yes, sub: fill(D2.yesSub, { Variety: V }), primary: true }, { id: 'no', label: D2.no, sub: D2.noSub }], defaultChoice: 'no' });
    },
  },
];

// ------------------------------------------------------------ per-tick event upkeep
function eventsTick(s, ctx) {
  const m = s.clock.minute, se = s.season;
  // Pamela eats one pumpkin every 15 ticks from her row
  const g = se.goat;
  if (g && ++g.t % CAT.goat.eatTicks === 0) {
    if (!patch.primeStock(s, g.row)) { const rs = patch.rowsWithPrime(s); if (rs.length) { g.row = rs.at(-1); g.z = aisleZ(g.row); } }
    if (patch.take(s, g.row, null, 1)) { g.ate++; ctx.emit({ type: 'season/goat', state: 'eat', x: g.x, z: g.z, row: g.row }); }
  }
  // the joey: Biscuit barks toward him after 3 s; at the end of the window mom finds him playing dead
  const anyActive = s.events.active.length > 0;
  const j = anyActive && getActive(s, 'lost_joey');
  if (j) {
    if (m === j.data.bark) { ctx.emit({ type: 'cast', who: 'biscuit', act: 'bark' }); ctx.emit({ type: 'season/joey', state: 'bark', x: j.x, z: j.z, spot: j.data.spot }); ctx.emit({ type: 'sound', name: 'bark' }); }
    if (m >= j.data.end) {
      const f = famById(s, j.data.fam);
      if (f) f.joey = false;
      const spot = spotName(j.data.spot || '');
      ctx.emit({ type: 'toast', text: fill(L.joeyMissed, { spot }), cls: 'event', icon: 'sparkle' });
      ctx.emit({ type: 'season/joey', state: 'missed', x: j.x, z: j.z });
      deactivate(s, 'lost_joey');
      se.farmer.tasks = se.farmer.tasks.filter((t, i) => i === 0 || t.ev !== 'lost_joey');
      ctx.goalLapse('pins', false);              // mom found him herself: no "Done", the toast tells it
    }
  }
  // the runaway pumpkin rolls toward the beach; splash
  const rp = se.runaway;
  if (rp) {
    const C = CAT.runaway_pumpkin, k = 1 - (rp.end - m) / sec(C.tapSeconds);
    rp.x = r3(C.roll[0] + (C.roll[1] - C.roll[0]) * clamp(k, 0, 1));
    const a = anyActive && getActive(s, 'runaway_pumpkin'); if (a) a.x = rp.x;
    if (m >= rp.end) { se.runaway = null; deactivate(s, 'runaway_pumpkin'); ctx.emit({ type: 'season/runaway', state: 'splash', x: rp.x, z: rp.z }); ctx.emit({ type: 'toast', text: L.runawaySplash, cls: 'event', icon: 'sparkle' }); }
  }
  // golden hour ends at 16:30
  if (se.golden && m >= CAT.golden_hour.to) { se.golden = false; deactivate(s, 'golden_hour'); }
  if (se.puffs.length) se.puffs = se.puffs.filter((p) => p.until > m);
  // the toddler: pose done, or ignored
  const td = anyActive && getActive(s, 'toddler_giant');
  if (td) {
    const f = famById(s, td.data.fam), C = CAT.toddler_giant;
    const posed = td.data.posing && !se.farmer.tasks.some((t) => t.ev === 'toddler_giant');
    if (posed || m >= td.data.end) {
      if (f) {
        if (posed) { mod(f, 'toddler', C.sat); s.rep.buzz = round3(clamp((s.rep.buzz || 0) + C.buzz, S.buzz[0], S.buzz[1])); moment(s, 20, L.moments.toddler); ctx.emit({ type: 'toast', text: L.toddlerPose, cls: 'good', icon: 'giant' }); }
        else { mod(f, 'toddler', C.ignore); ctx.emit({ type: 'toast', text: L.toddlerIgnored, cls: 'warn', icon: 'giant' }); }
        f.state = 'gawk'; f.t = 1;
      }
      deactivate(s, 'toddler_giant');
    }
  }
  const pr = anyActive && getActive(s, 'proposal');
  if (pr && m >= pr.data.end) deactivate(s, 'proposal');
  // the whale dives; everybody wanders back, glowing
  if (se.whale && m >= se.whale.end) {
    se.whale = null; deactivate(s, 'whale_weekend');
    for (const f of se.families) {
      if (f.state !== 'whale') continue;
      mod(f, 'whale', CAT.whale.returnSat);
      f.state = 'walk'; f.go = null; f.resume = null;
      if (openWants(f).length) nextRow(s, ctx, f); else afterBrowse(s, ctx, f);
    }
    ctx.emit({ type: 'toast', text: L.whaleBack, cls: 'good', icon: 'whale' });
  }
  for (const r in se.closed) if (se.closed[r] <= m) delete se.closed[r];
}

// Bea (hire): a daytime restock trip every 40 ticks when a row is under 30% (never on Sundays: she's at the dam).
function beaTick(s, ctx) {
  if (!hired(s, 'bea') || !isSaturday(s.clock.day)) return;
  if (++s.season.bea < T.hires.bea.tripTicks) return;
  s.season.bea = 0;
  const r = s.patch.rows.findIndex((row, i) => row.open && patch.fullness(s, i) < T.hires.bea.below);
  if (r < 0 || !patch.barnStock(s)) return;
  const n = patch.restockRow(s, r, S.actions.restockN);
  if (n) ctx.emit({ type: 'patch/restock', row: r, n, by: 'bea' });
}

// ------------------------------------------------------------ the day: weekend, weekday, overnight
function weekendStart(s, ctx) {
  const se = s.season, F = se.farmer;
  se.day = freshDay(s);
  Object.assign(se, { families: [], queue: [], cars: [], goat: null, runaway: null, whale: null, golden: false, puffs: [], closed: {}, halUntil: -1, bea: 0,
    census: { on: 0, gawk: 0, possums: 0 } });
  Object.assign(se.gran, { t: 0, direct: false });
  Object.assign(se.dez, { t: 0, away: false });
  Object.assign(se.you, { buffer: 0, rush: 0, last: -99, auto: 0 });
  se.road = { q: 0, turned: se.road.turned, cars: [] };
  se.parking.main = 0; se.parking.beach = 0;
  se.wagons.total = S.wagons.y1 + S.wagons.add * count(s, 'wagons');
  se.wagons.free = se.wagons.total; se.wagons.strays = [];
  Object.assign(F, { x: FARMER_SPOTS.stand.x, z: FARMER_SPOTS.stand.z, heading: Math.PI, at: 'stand', tasks: [], path: [], pi: 0, busy: false, target: null, carry: null });
  syncParking(s);
  planDay(s);
  if (s.clock.year >= S.tiers.fromYear) morningCard(s, ctx);
}
function weekendEnd(s, ctx) {
  const se = s.season, day = se.day, tot = se.totals;
  // closing time: whoever is still in the queue is rung up by Gran staying late; browsers check out what they hold
  for (const f of [...se.families]) {
    if (LEAVING.has(f.state) || f.state === 'in') continue;      // on their way home, or still on the way in: no harm done
    if (f.cart.length) serve(s, ctx, f, 'gran'); else { settleWants(s, ctx, f); finish(s, ctx, f); }
  }
  for (const c of se.road.cars) { day.turned++; tot.turned++; }
  se.families = []; se.queue = []; se.road.cars = []; se.road.q = 0; se.cars = [];
  tot.acts.push(day.acts);
  if (day.turned && day.turned >= 0.3 * (day.turned + day.arrived)) { tot.uturnDays++; ctx.story('traffic', 45, {}); moment(s, 24, L.moments.traffic); }
  // buzz: b' = 0.6 b + 0.04 (5-star Photo Families) - 0.03 (1-2 star families) + a displayed shiny 0.1/day, Crier floor
  const B = S.buzzK, shiny = s.patch.shinies.some((x) => x.state === 'display') ? CAT.shiny.displayBuzz : 0;
  let b = B.decay * (s.rep.buzz || 0) + B.photo5 * day.photo5 + B.low * day.low + shiny;
  b = Math.max(b, giant.crierEffects(s).buzzFloor);
  s.rep.buzz = round3(clamp(b, S.buzz[0], S.buzz[1]));
  tot.buzzPeak = Math.max(tot.buzzPeak, s.rep.buzz);
  if (se.goat) goatLeaves(s, ctx);
  eveningCard(s, ctx);
}
// Weekdays: Gran minds the stand. A trickle of families is served automatically (0.15 x Base x REP x WX), one toast.
function weekdaySales(s, ctx) {
  const d = s.clock.day, y = s.clock.year;
  const n = Math.floor(expectedFamilies(s, d) + u01(s.seed, y, d, 'n'));
  let amt = 0;
  const tm = tierMul(s);
  for (let i = 0; i < n; i++) {
    const sp = SPECIES[Math.floor(u01(s.seed, y, d, i, 'sp') * SPECIES.length)];
    const f = newFamily(s, d, i, sp, OPEN, null);
    if (s.weather.f > T.weather.effects.cosyF) mod(f, 'cosy', S.sat.cosy);
    mod(f, 'variety', patch.varietyBonus(s));
    for (const w of openWants(f)) {
      const rs = patch.rowsWithPrime(s, w.v);
      if (rs.length) buy(s, ctx, f, rs[0], w, w.v);
    }
    settleWants(s, ctx, f);
    for (const c of f.cart) amt += round2((c.tr ? VT.classic.price : VT[c.v].price) * (c.soft ? T.patch.aging.softPrice : 1) * tm);
    if (f.cart.length && next(f.rng) < T.patch.hives.honeyBuy && patch.honeyTake(s, 1)) amt += S.honeyPrice;
    const stars = clamp(Math.round(clamp(f.sat, 0, 100) / S.stars.div), S.stars.min, S.stars.max);
    s.rep.R = round3(clamp(s.rep.R + S.R.k * S.R.weekdayWeight * (stars - s.rep.R), 1, 5));
  }
  amt = round2(amt);
  if (amt) ctx.money(amt, 'weekday');
  const W = s.season.totals.weekday;
  W.families += n; W.amt = round2(W.amt + amt);
  s.season.totals.revenue = round2(s.season.totals.revenue + amt);
  const text = n ? fill(L.weekday, { day: dowName(d), fam: n === 1 ? '1 family' : `${n} families`, amt: `$${Math.round(amt)}` }) : fill(L.weekdayNone, { day: dowName(d) });
  ctx.emit({ type: 'season/weekday', n, amt });
  ctx.emit({ type: 'toast', text, cls: '', icon: 'stand', key: 'weekday' });   // one pill the week's days rewrite in place
}
// Overnight: 20 fruit (40 with Bea) from the barn into rows under 50% fullness, front rows first, matching variety.
function overnightRestock(s, ctx) {
  let left = hired(s, 'bea') ? S.overnight.bea : S.overnight.n;
  let moved = 0;
  s.patch.rows.forEach((row, r) => {
    if (left <= 0 || !row.open || patch.fullness(s, r) >= S.overnight.below || !patch.barnStock(s)) return;
    const n = patch.restockRow(s, r, left);
    left -= n; moved += n;
  });
  return moved;
}

// ------------------------------------------------------------ morning and evening cards
function morningCard(s, ctx) {
  const d = s.clock.day, fc = s.weather;
  ctx.card('morning', {
    title: fill(L.morning.title, { day: dowName(d, true) }), day: d, f: fc.f, heat: fc.heat, rain: fc.rain,
    expect: Math.round(expectedFamilies(s, d)), first: s.clock.year === S.tiers.fromYear && weekendIndex(d) === 0 && isSaturday(d),
    choices: [{ id: 'open', label: L.morning.open, primary: true }], defaultChoice: 'open',
  });
}
function eveningCard(s, ctx) {
  const d = s.clock.day, day = s.season.day, fc = s.weather.forecast?.[0];
  const stock = s.patch.rows.reduce((a, r) => ({ prime: a.prime + r.stock.prime, green: a.green + r.stock.green, soft: a.soft + r.stock.soft }), { prime: 0, green: 0, soft: 0 });
  ctx.card('evening', {
    title: fill(L.evening.title, { day: `${dowName(d, true)}, ${label(d)}` }), day: d,
    served: day.served, turned: day.turned, walkoffs: day.walkoffs, arrived: day.arrived, rev: day.rev, byV: { ...day.byV }, tips: day.tips,
    stars: day.starsN ? round2(day.starsSum / day.starsN) : null, R: round2(s.rep.R), byYou: day.byYou, maxRush: day.maxRush,
    best: day.best?.text || null, stock: { ...stock, barn: patch.barnStock(s, null, { soft: true }) },
    tomorrow: d >= EVE ? null : fc ? { day: fc.day, f: fc.f, heat: fc.heat, rain: fc.rain } : null, weighoff: d >= EVE,
    choices: [{ id: 'ok', label: L.evening.ok, primary: true }], defaultChoice: 'ok',
  });
}

// ------------------------------------------------------------ Panic Night (Y3+, Fri Oct 30): everything sells
/** Run Halloween Panic Night (once a year from year 3): 0.5 x Base families who take anything, soft too, at full price. */
export function panicNight(s, ctx) {
  const PN = T.calendar.panicNight;
  if (s.clock.year < PN.fromYear || s.season.panic?.y === s.clock.year) return null;
  const n = Math.round(S.panic * baseY(s)), r = makeRng(hash32(s.seed, s.clock.year, 'panic'));
  let sold = 0, amt = 0;
  const grab = (large) => {
    for (const soft of [false, true]) for (let i = 0; i < s.patch.rows.length; i++) {
      const row = s.patch.rows[i];
      for (const [v, b] of Object.entries(row.by)) {
        if (VT[v].large !== large || !(soft ? b.soft : b.prime)) continue;
        if (patch.take(s, i, v, 1, { soft })) return v;
      }
    }
    if (patch.barnTake(s, large ? null : 'mini', 1)) return large ? 'classic' : 'mini';
    return null;
  };
  for (let i = 0; i < n; i++) {
    const wants = [true, ...(next(r) < 0.3 ? [true] : []), ...(next(r) < 0.7 ? [false] : []), ...(next(r) < 0.7 ? [false] : [])];
    for (const large of wants) { const v = grab(large); if (v) { sold++; amt += VT[v].price; } }
  }
  amt = round2(amt);
  if (amt) ctx.money(amt, 'pumpkins');
  s.season.panic = { y: s.clock.year, n, sold, amt };
  s.season.totals.revenue = round2(s.season.totals.revenue + amt);
  const P = L.panic;
  ctx.card('panic', { speaker: 'gran', eyebrow: P.eyebrow, title: P.title, text: fill(sold ? P.text : P.none, { n, sold, amt: `$${Math.round(amt)}` }), n, sold, amt,
    choices: [{ id: 'ok', label: P.ok, primary: true }], defaultChoice: 'ok' });
  ctx.emit({ type: 'season/panic', n, sold, amt });
  ctx.story('panic', 32, { n, sold });
  return s.season.panic;
}

// ------------------------------------------------------------ actions (the UI's verbs; bots use the same ones)
const weekendAct = (s) => (weekendNow(s) ? null : fail('the stand is only busy on weekends'));
function counted(s, r) {
  if (r.ok) { s.season.day.acts++; s.season.acts.push(s.clock.minute); if (s.season.acts.length > 24) s.season.acts.shift(); }
  return r;
}
const ACTIONS = {
  // RING UP: serve the front family at once (taps buffer up to 2 while they walk up). Rush within 12 ticks.
  'season/ringUp': (s, a, ctx) => {
    const no = weekendAct(s); if (no) return no;
    if (!atStand(s)) return fail('get back to the stand first');
    if (queueReady(s)) { const f = frontFamily(s); serve(s, ctx, f, 'you'); return counted(s, { ok: true, served: f.id, rush: s.season.you.rush }); }
    if (!s.season.queue.length) return fail('nobody in line yet');
    if (s.season.you.buffer >= S.you.buffer) return fail('they are on their way');
    s.season.you.buffer++;
    return counted(s, { ok: true, buffered: s.season.you.buffer });
  },
  // Send your farmer to a station or a row (the station bar, a world tap, "Back to the stand").
  'season/go': (s, a, ctx) => {
    const no = weekendAct(s); if (no) return no;
    const to = a.to;
    if (!FARMER_SPOTS[to] && to !== 'row') return fail('nowhere to go');
    if (to === 'row' && !s.patch.rows[a.row]) return fail('no such row');
    if (s.season.farmer.at === to && to !== 'row' && !s.season.farmer.tasks.length) return { ok: true, already: true };
    if (to === 'lot' && !(s.unlocks.route46 || s.clock.year > 1)) return fail('Hal will tell you about the lot');
    addTask(s, ctx, { k: 'go', to, row: a.row });
    return counted(s, { ok: true });
  },
  'season/restock': (s, a, ctx) => {
    const no = weekendAct(s); if (no) return no;
    if (!patch.barnStock(s)) return fail('the barn is empty');
    if (a.row != null && !s.patch.rows[a.row]?.open) return fail('that row is still bramble');
    if (a.row != null && patch.fullness(s, a.row) >= 1) return fail('that row is full');
    if (!addTask(s, ctx, { k: 'restock', row: a.row ?? null })) return fail('your farmer has their paws full');
    return counted(s, { ok: true });
  },
  'season/cut': (s, a, ctx) => {
    const no = weekendAct(s); if (no) return no;
    if (!s.patch.rows[a.row]?.stock.prime) return fail('nothing ripe in that row');
    if (!patch.barnFree(s)) return fail('the barn is full');
    if (!addTask(s, ctx, { k: 'cut', row: a.row })) return fail('your farmer has their paws full');
    return counted(s, { ok: true });
  },
  // Answer a [?] bubble: choice 'fetch' (the barn has it) or a variety to suggest ("Try ___"); 'look' holds it a moment.
  'season/answer': (s, a, ctx) => {
    const no = weekendAct(s); if (no) return no;
    const f = famById(s, a.id);
    if (!f?.bubble || f.bubble.kind !== 'want' || f.state !== 'want') return fail('they have moved on');
    if (!(s.unlocks.wants || s.clock.year > 1)) return fail('Gran will show you on Sunday');
    if (a.choice === 'look') { if (!f.bubble.looked) { f.bubble.looked = true; f.bubble.t += S.bubbleHold; } return { ok: true }; }
    if (answering(s, f)) return fail('your farmer is already on it');
    const w = openWants(f)[0];
    if (a.choice === 'fetch') {
      if (!patch.barnStock(s, w.v)) return fail(`no ${vname(w.v)} in the barn`);
      if (!addTask(s, ctx, { k: 'fetch', fam: f.id, want: w.v })) return fail('your farmer has their paws full');
    } else {
      if (!VT[a.choice] || !patch.rowsWithPrime(s, a.choice).length) return fail('none of those in the field');
      if (!addTask(s, ctx, { k: 'try', fam: f.id, v: a.choice, want: w.v })) return fail('your farmer has their paws full');
    }
    f.bubble.held = S.answerWait;
    ctx.emit({ type: 'season/answer', id: f.id, ok: null, how: a.choice === 'fetch' ? 'fetch' : 'try', v: a.choice });
    return counted(s, { ok: true });
  },
  'season/stray': (s, a, ctx) => {
    const no = weekendAct(s); if (no) return no;
    const W = s.season.wagons, F = s.season.farmer;
    const taken = new Set(F.tasks.filter((t) => t.k === 'stray').map((t) => t.id));
    const w = a.id ? W.strays.find((x) => x.id === a.id) : W.strays.filter((x) => !taken.has(x.id)).sort((p, q) => (p.x - F.x) ** 2 + (p.z - F.z) ** 2 - (q.x - F.x) ** 2 - (q.z - F.z) ** 2)[0];
    if (!w) return fail('no stray wagons out there');
    if (!addTask(s, ctx, { k: 'stray', id: w.id })) return fail('your farmer has their paws full');
    return counted(s, { ok: true });
  },
  // Traffic levers: the beach lot and Gran on traffic need you at the lot; "Tell Hal we're full" is a phone call.
  'season/lever': (s, a, ctx) => {
    const no = weekendAct(s); if (no) return no;
    if (!(s.unlocks.route46 || s.clock.year > 1)) return fail('Hal will tell you about Route 46');
    if (a.id === 'hal') {
      s.season.halUntil = s.clock.minute + S.tellHal.ticks;
      ctx.emit({ type: 'toast', text: L.halFull, cls: 'event', icon: 'radio' });
      ctx.emit({ type: 'season/lever', id: 'hal', on: true });
      return counted(s, { ok: true });
    }
    if (a.id !== 'beach' && a.id !== 'gran') return fail('no such lever');
    const cur = a.id === 'beach' ? s.season.parking.beachOpen : s.season.gran.direct;
    const on = a.on ?? !cur;
    if (on === cur) return { ok: true, already: true };
    if (!addTask(s, ctx, { k: 'lever', id: a.id, on })) return fail('your farmer has their paws full');
    return counted(s, { ok: true });
  },
  // Events that need your farmer: the goat, the lost joey, the toddler, the proposal, Dez.
  'season/chase': (s, a, ctx) => {
    const no = weekendAct(s); if (no) return no;
    if (a.id === 'goat' ? !s.season.goat : !isActive(s, a.id)) return fail('it is over');
    if (!['goat', 'lost_joey', 'toddler_giant', 'proposal', 'dez_wanders'].includes(a.id)) return fail('nothing to chase');
    if (!addTask(s, ctx, { k: 'chase', ev: a.id })) return fail('your farmer has their paws full');
    return counted(s, { ok: true });
  },
  'season/treat': (s, a, ctx) => {
    const no = weekendAct(s); if (no) return no;
    if (!addTask(s, ctx, { k: 'treat', plot: a.plot ?? 1 })) return fail('your farmer has their paws full');
    return counted(s, { ok: true });
  },
  // The morning card's price board, shuttle and radio spot (Y2+). Charged when the gate opens.
  'season/plan': (s, a, ctx) => {
    if (s.clock.phase !== 'october' || s.clock.year < S.tiers.fromYear) return fail('the price board arrives in year 2');
    if (a.tier != null) { if (!TIERS.includes(a.tier)) return fail('no such price'); s.season.tier = a.tier; }
    if (a.shuttle != null) s.season.shuttlePlan = !!a.shuttle;
    if (a.radio != null) s.season.radioPlan = !!a.radio;
    return { ok: true };
  },
  // The lighthouse foghorn three times in five seconds: the coyote pups howl back, the harbor seals bark back and the
  // skunks startle.
  'season/foghorn': (s, a, ctx) => {
    if (!weekendNow(s)) return { ok: true };
    for (const f of onSite(s)) if (f.species === 'coyote') mod(f, 'cosy', SP.coyote.howlSat);
    for (const f of onSite(s)) if (f.species === 'seal') mod(f, 'cosy', SP.seal.barkSat);
    const howl = onSite(s).some((f) => f.species === 'coyote'), bark = onSite(s).some((f) => f.species === 'seal');
    if (howl || bark) ctx.emit({ type: 'toast', text: howl && bark ? L.foghornBoth : howl ? L.foghornHowl : L.foghornBark, cls: 'event', icon: 'sound' });
    const sk = onSite(s).find((f) => f.species === 'skunk');
    if (sk) startle(s, ctx, sk.x, sk.z);
    return { ok: true };
  },
  'season/panic': (s, a, ctx) => { const r = panicNight(s, ctx); return r ? { ok: true, ...r } : fail('no panic tonight'); },
};

// ------------------------------------------------------------ onboarding beats (design §3, year 1: one verb a day)
const standGlide = { x: -5, z: -5.6, zoom: 1.5 };
const BEATS = [
  { // #17 RING UP (W1 Sat): the Mayor opens the gate, Gran explains the till
    id: 'season.ringUp', year: 1, order: 18, at: Y1.ringUp,
    when: (s) => weekendNow(s) && s.clock.day >= D(Y1.ringUp),
    run(s, ctx) {
      ctx.unlock('ringup');
      ctx.say('mayor', [L.gate], { glide: standGlide });
      ctx.say('gran', [LINES.gran.ringUp, L.ringUp2], { goal: { id: 'ringUp', target: { kind: 'fab', id: 'ringup' } } });
    },
  },
  { // #18 your farmer runs; want bubbles (W1 Sun): the fox who wants a white one
    id: 'season.wants', year: 1, order: 19, at: Y1.wants,
    when: (s) => weekendNow(s) && s.clock.day >= D(Y1.wants)
      && (s.season.families.some((f) => f.bubble?.kind === 'want') || s.clock.minute >= 600),
    run(s, ctx) {
      ctx.unlock('wants');
      const f = s.season.families.find((x) => x.script === 'fox' && x.bubble) || s.season.families.find((x) => x.bubble?.kind === 'want');
      if (f) f.bubble.t = Math.max(f.bubble.t, S.answerWait);       // the lesson's bubble waits for you
      ctx.say('gran', [LINES.gran.wants, L.wants2], { goal: { id: 'wants', target: { kind: 'pin', id: 'want-0' } },
        glide: f ? { x: f.x, z: f.z, zoom: 1.3 } : undefined });
    },
  },
  { // #19 restock (W2 Sat). If the barn is empty Gran stocks 12 "from her own little patch" so the lesson always works.
    id: 'season.restock', year: 1, order: 20, at: Y1.restock,
    when: (s) => weekendNow(s) && s.clock.day >= D(Y1.restock),
    run(s, ctx) {
      ctx.unlock('restock');
      const lines = [LINES.gran.restock, L.restock2];
      if (!patch.barnStock(s)) {
        s.patch.barnLots.push({ v: 'classic', n: S.scripted.granStock, age: 0, st: 'prime', sa: 0, tr: false });
        patch.refreshRows(s);
        lines.splice(1, 1, LINES.gran.ownPatch);
      }
      // Gran names the row the barn's Restock button will fill (the emptiest, front rows first), and so does the goal
      const row = (frontRestockRow(s) ?? 0) + 1;
      ctx.say('gran', lines, { vars: { row }, goal: { id: 'restock', text: fill(LINES.goals.restock, { row }), target: { kind: 'station', id: 'barn' } },
        glide: { x: -9, z: -8, zoom: 0.9 } });
    },
  },
  { // #20 wagons and strays (W2 Sun, Dez's cameo): three wagons are already out in row 4
    id: 'season.wagons', year: 1, order: 21, at: Y1.wagons,
    when: (s) => weekendNow(s) && s.clock.day >= D(Y1.wagons),
    run(s, ctx) {
      ctx.unlock('wagons');
      const W = s.season.wagons, r = S.scripted.wagonRow;
      for (let i = 0; i < S.scripted.wagons && W.free > 0; i++) { W.free--; W.strays.push({ id: `lesson${i}`, x: -6 + i * 4.5, z: aisleZ(r) + 0.35, lesson: true }); }
      ctx.say('dez', [LINES.dez.wagons, L.wagons2], { goal: { id: 'wagons', target: { kind: 'pin', id: 'stray-0' } }, glide: { x: -1.5, z: aisleZ(r), zoom: 1 } });
    },
  },
  { // #21 the Route 46 meter and the levers (W3 Sat, the scripted heat wave): Hal
    id: 'season.route46', year: 1, order: 22, at: Y1.route46,
    when: (s) => weekendNow(s) && s.clock.day >= D(Y1.route46),
    run(s, ctx) {
      ctx.unlock('route46');
      ctx.say('hal', [LINES.hal.route46, L.route46b], { goal: { id: 'route46', target: { kind: 'station', id: 'lot' } }, glide: { x: -15, z: -4.6, zoom: 1.1 } });
    },
  },
  { // #22 event pins (W3 Sun, a scripted lost joey): a possum mom ("PIP!") with Biscuit barking
    id: 'season.pins', year: 1, order: 23, at: Y1.pins,
    when: (s) => weekendNow(s) && s.clock.day >= D(Y1.pins)
      && s.season.families.some((f) => f.script === 'possum' && ['walk', 'pick', 'want'].includes(f.state) && s.clock.minute >= f.arr + S.scripted.joeyAfter),
    run(s, ctx) {
      ctx.unlock('pins');
      const f = s.season.families.find((x) => x.script === 'possum');
      fireNow(s, ctx, 'lost_joey', { fam: f.id, spot: 'hayfort', ticks: CAT.lost_joey.lessonTicks });
      ctx.markIntro();
      ctx.say('possumMom', [LINES.possumMom.lostJoey, L.joey2], { goal: { id: 'pins', target: { kind: 'pin', id: 'lost_joey' } },
        glide: { x: (f.x + HIDEOUTS.hayfort.x) / 2, z: (f.z + HIDEOUTS.hayfort.z) / 2, zoom: 1.1 } });   // mom and the hay fort in one frame
    },
  },
  { // Y2: Hal announces the morning card the Friday before (the card itself would hide him)
    id: 'season.y2morning', year: 2, order: 40,
    when: (s) => s.clock.phase === 'october' && s.clock.day >= D('Oct 2'),
    run(s, ctx) { ctx.say('hal', [L.y2morning]); },
  },
  { // Y2: Perfect Seekers and Old-Timers (Gran), a week later
    id: 'season.y2types', year: 2, order: 41,
    when: (s) => weekendNow(s) && s.clock.day >= D('Oct 10'),
    run(s, ctx) { ctx.say('gran', [L.y2types]); },
  },
];

// ------------------------------------------------------------ bots: the attention models (design §14)
// attentive: instant and unlimited; realistic (the balanced bot): 1.5-4 s to react, <= 25 actions/min; novice: rings up
// at half pace and answers 40% of bubbles late; lazy (idle): never taps on weekends. Decisions are keyed noise, never a
// stream, and timings come from state, so a saved game replays exactly.
const modeOf = (P) => P.season || (P.name === 'novice' ? 'novice' : P.name === 'idle' ? 'lazy' : 'realistic');
// keyed reaction time: has the player noticed something that started at `since`?
const REACT = { novice: S.bot.novice.react.map(sec), realistic: S.bot.realistic.react.map(sec) };
function reacted(s, mode, id, since) {
  if (mode === 'attentive') return true;
  const [a, b] = mode === 'novice' ? REACT.novice : REACT.realistic;
  return s.clock.minute - since >= a + u01(s.seed, s.clock.year, s.clock.day, id, 'react') * (b - a);
}
function hasTask(F, k) { for (const t of F.tasks) if (t.k === k) return true; return false; }
function hasTaskEv(F, ev) { for (const t of F.tasks) if (t.ev === ev) return true; return false; }
function goingToStand(F) { for (const t of F.tasks) if (t.k === 'go' && t.to === 'stand') return true; return false; }
function busyHands(s, mode) {                                       // the realistic player's <= 25 actions a minute
  if (mode !== 'realistic') return false;
  const se = s.season, m = s.clock.minute, B = S.bot.realistic, win = sec(B.window);
  let recent = 0;
  for (let i = se.acts.length - 1; i >= 0 && m - se.acts[i] < win; i--) if (se.acts[i] <= m) recent++;
  return recent >= B.perWindow;
}
// 1. the line comes first: ring up, or hurry back when it builds
function botLine(s, mode) {
  const se = s.season, F = se.farmer, m = s.clock.minute, B = S.bot, Q = se.queue.length, front = frontFamily(s);
  if (front && atStand(s) && queueReady(s)) {
    if (mode === 'attentive' && (Q >= 2 || front.wait >= B.attentive.serveWait)) return RING_UP;
    if (mode === 'realistic' && (Q >= 2 || reacted(s, mode, `q${front.id}`, m - front.wait))) return RING_UP;
    if (mode === 'novice' && m - se.you.last >= sec(B.novice.serveEvery) && reacted(s, mode, `q${front.id}`, m - front.wait)) return RING_UP;
  }
  const away = F.at !== 'stand' || F.tasks.length > 0;
  const urgent = Q >= 2 || (Q === 1 && mode === 'attentive' && front?.state === 'queue' && front.pat - front.wait < 24);
  if (away && urgent && !goingToStand(F) && reacted(s, mode, `back${front?.id}`, m - (front?.wait ?? 0))) return { type: 'season/go', to: 'stand' };
  return null;
}
// 3. a [?] bubble: fetch it from the barn, else suggest something that's in the field
function botBubble(s, mode) {
  const se = s.season;
  for (const f of se.families) {
    if (f.state !== 'want' || f.bubble?.kind !== 'want' || answering(s, f)) continue;
    if (mode === 'novice' && u01(s.seed, s.clock.year, s.clock.day, f.id, 'nb') >= S.bot.novice.bubbles) continue;
    if (!reacted(s, mode, `b${f.id}`, f.bubble.t0)) continue;
    const w = openWants(f)[0];
    if (w && patch.barnStock(s, w.v)) return { type: 'season/answer', id: f.id, choice: 'fetch' };
    for (const v of BOT_SUBS) if ((w?.kid ? v === 'mini' || v === 'warty' || v === 'white' : VT[v].large) && patch.rowsWithPrime(s, v).length) return { type: 'season/answer', id: f.id, choice: v };
  }
  return null;
}
// 4. traffic: open the beach when the road backs up (Gran too when it's bad; she comes back when it clears)
function botTraffic(s, mode) {
  const se = s.season, B = S.bot, Q = se.queue.length;
  if (hasTask(se.farmer, 'lever')) return null;
  if (!se.parking.beachOpen && (se.road.q >= B.roadAt || (s.weather.heat && se.parking.used >= se.parking.cap - 2)) && reacted(s, mode, 'beach', s.clock.minute - se.road.q * 4)) return { type: 'season/lever', id: 'beach', on: true };
  // Gran on traffic means nobody else rings up: only a player who can keep the till going alone sends her
  if (mode === 'attentive' && se.parking.beachOpen && se.road.q >= B.roadAt * 2 && !se.gran.direct) return { type: 'season/lever', id: 'gran', on: true };
  if (se.gran.direct && se.road.q === 0 && Q >= 3) return { type: 'season/lever', id: 'gran', on: false };
  return null;
}
// the realistic player's restock slot for the day, keyed noise kept for the day: it was a hash every minute
const RS = { seed: null, y: 0, d: -1, slot: 0 };
const LOOK = Math.max(1, Math.round(TPS / 2));                       // a person looks up twice a second (bots.js tickStep)
const ROWS_A = sec(S.bot.attentive.rows), ROWS_R = Math.max(1, Math.round(sec(S.bot.realistic.rows) / LOOK));
function restockSlot(s) {
  const y = s.clock.year, d = s.clock.day;
  if (RS.seed !== s.seed || RS.y !== y || RS.d !== d) Object.assign(RS, { seed: s.seed, y, d, slot: Math.floor(u01(s.seed, y, d, 'rs') * ROWS_R) });
  return RS.slot;
}
// 6.-8. the errands: Pamela, a thin front row, strays, events worth a trip
function botErrands(s, mode) {
  const se = s.season, F = se.farmer, m = s.clock.minute, B = S.bot;
  if (se.goat && !hasTaskEv(F, 'goat') && reacted(s, mode, 'goat', m - se.goat.t)) return { type: 'season/chase', id: 'goat' };
  // restock: the attentive player checks the rows every second, the realistic one every ~3 s (a keyed slot as wide as
  // the realistic bot's look, so each slot holds exactly one look)
  const look = mode === 'attentive' ? m % ROWS_A === 0 : Math.floor((m % (ROWS_R * LOOK)) / LOOK) === restockSlot(s);
  if ((s.unlocks.restock || s.clock.year > 1) && look && !hasTask(F, 'restock') && patch.barnStock(s)) {
    // (a player following Next Up restocks the row the lesson names, however full it is, as with the strays' lesson)
    const lesson = s.story.goal?.id === 'restock', r = lesson ? frontRestockRow(s) : restockRow(s);
    if (r != null && (lesson || patch.fullness(s, r) < B.restockBelow)) return { type: 'season/restock', row: r };
  }
  if (se.wagons.strays.length && !hasTask(F, 'stray') && (se.wagons.free <= B.strayAt || se.wagons.strays.some((w) => w.lesson))) return { type: 'season/stray' };
  if (s.events.active.length) {
    for (const id of BOT_TRIPS) if (isActive(s, id) && !hasTaskEv(F, id) && reacted(s, mode, id, m - sec(1))) return { type: 'season/chase', id };
  }
  return null;
}
const RING_UP = Object.freeze({ type: 'season/ringUp' });
const BOT_SUBS = [...LARGE, 'mini'];
const BOT_TRIPS = ['toddler_giant', 'proposal', 'dez_wanders'];
function botAct(s, P) {
  const mode = modeOf(P), staff = !!P.delegate && hired(s, 'dez');   // the Operator leaves the till to Dez and works the floor
  if (mode === 'lazy' || !weekendNow(s)) return null;
  if (busyHands(s, mode)) return null;
  const se = s.season, F = se.farmer, m = s.clock.minute;
  const free = F.tasks.length < 2, line = !staff && se.queue.length >= 2;      // stay put when folks are waiting
  let a = staff ? null : botLine(s, mode);
  if (a) return a === RING_UP ? { type: 'season/ringUp' } : a;
  // 2. a lost joey
  const j = s.events.active.length ? getActive(s, 'lost_joey') : null;
  if (j && mode !== 'novice' && free && !hasTaskEv(F, 'lost_joey') && reacted(s, mode, 'joey', j.data.bark - sec(3))) return { type: 'season/chase', id: 'lost_joey' };
  if ((s.unlocks.wants || s.clock.year > 1) && !line && free && se.census.want && (a = botBubble(s, mode))) return a;
  if (mode === 'novice') return !F.tasks.length && F.at !== 'stand' && reacted(s, mode, 'back', F.since ?? m) ? { type: 'season/go', to: 'stand' } : null;
  if ((s.unlocks.route46 || s.clock.year > 1) && free && P.levers !== false && (a = botTraffic(s, mode))) return a;   // levers: false = never touch them
  if (free && !line && (a = botErrands(s, mode))) return a;
  if (se.runaway && reacted(s, mode, 'run', se.runaway.end - sec(CAT.runaway_pumpkin.tapSeconds))) return { type: 'events/tap', id: 'runaway_pumpkin' };
  // 9. back to the stand when the errands are done
  if (!staff && !F.tasks.length && F.at !== 'stand' && reacted(s, mode, 'back', F.since ?? m)) return { type: 'season/go', to: 'stand' };
  return null;
}
// Plans for tomorrow's morning card (Y2+): Fair prices; the shuttle and radio when Hal calls heat or a big weekend.
function botPlan(s, P) {
  // the morning card is a plan made before the gate opens, not weekend attention: the lazy player books what the realistic
  // one does (so the attention comparison measures the day itself); the novice never opens the price board, idle never acts
  if (s.clock.year < S.tiers.fromYear || P.name === 'idle' || modeOf(P) === 'novice') return null;
  const t = s.clock.day + 1;
  if (!isWeekend(t)) return null;
  const fc = s.weather.forecast?.find((x) => x.day === t), heat = !!fc?.heat;
  const big = weekendIndex(t) >= 2 && isSaturday(t), ads = P.marketing !== false;
  const want = { tier: 'fair', shuttle: ads && heat, radio: ads && big && s.cash > 1200 };
  if (s.season.tier === want.tier && !!s.season.shuttlePlan === want.shuttle && !!s.season.radioPlan === want.radio) return null;
  return { type: 'season/plan', ...want };
}

// One weekend minute, in order. Called through a table so each part is compiled on its own (a rare branch in one of
// them never forces the whole minute to be recompiled).
function arrivals(s, ctx) {
  const day = s.season.day, m = s.clock.minute;
  while (day.ptr < day.sched.length && day.sched[day.ptr][0] <= m && m < GATE_CLOSE) arrive(s, ctx, day.sched[day.ptr++]);
}
function familiesTick(s, ctx) {
  const fs = s.season.families;
  for (let i = fs.length - 1; i >= 0; i--) if (fs[i]) { fs[i].kerb = s.season.cars.length > 0 && atKerb(s, fs[i]); famTick(s, ctx, fs[i]); }
}
// Folks wait at the kerb for a gap: someone about to step onto the road waits while a car is coming (and cars stop for
// anyone already on it). Your farmer never waits: the cars stop for you.
function atKerb(s, f) {
  if (f.z > traffic.BAND0 && f.z < traffic.BAND1) return false;                 // already on the road: keep going
  const p = f.path[f.pi];
  if (!p) return false;
  const below = f.z <= traffic.BAND0, edge = below ? traffic.BAND0 : traffic.BAND1;
  if ((p[1] <= traffic.BAND0) === below && (p[1] >= traffic.BAND1) === !below) return false;   // not stepping onto it
  if (Math.abs(f.z - edge) > 0.55) return false;                                 // not at the kerb yet
  const x = p[1] === f.z ? f.x : f.x + (p[0] - f.x) * ((edge - f.z) / (p[1] - f.z));
  return traffic.coming(s.season, x);
}
// a census for the director's checks (and the concurrency histogram: families on foot that the phone draws, not those
// in cars or lost in the corn maze)
function census(s) {
  const se = s.season;
  let on = 0, gawk = 0, possums = 0, want = 0, maze = 0;
  for (const f of se.families) {
    if (f.state === 'car') continue;
    if (f.state === 'maze') { maze++; continue; }
    on++;
    if (f.state === 'gawk') gawk++;
    else if (f.state === 'want') want++;
    if (f.species === 'possum' && browsing(f)) possums++;
  }
  const cs = se.census; cs.on = on + maze; cs.gawk = gawk; cs.possums = possums; cs.want = want;
  const c = se.totals.conc;
  while (c.length <= on) c.push(0);
  c[on]++;
}
const TICK_PARTS = [arrivals, roadTick, carsTick, familiesTick, checkoutTick, farmerTick, eventsTick, beaTick, census];

// Every catalogue entry gets the same fields in the same order (absent ones undefined): the director and runBeats walk
// them every weekend minute, and one object shape keeps those loops fast.
const EVENT_KEYS = ['id', 'cls', 'per', 'urgent', 'quiet', 'cooldownDays', 'cooldownTicks', 'capYear', 'capSeason', 'when', 'rate', 'fire', 'text', 'tap'];
const BEAT_KEYS = ['id', 'year', 'years', 'order', 'gap', 'urgent', 'when', 'run'];
const shaped = (keys) => (e) => {
  const o = {};
  for (const k of keys) o[k] = e[k];
  for (const k of Object.keys(e)) if (!keys.includes(k)) o[k] = e[k];
  return o;
};

// ------------------------------------------------------------ the module
export default {
  id: 'season',
  init(s) { s.season = freshSeason(s); },
  // Reputation carries over between years (§7): R' = 3 + 0.75 (R - 3).
  newYear(s) {
    const R = S.R;
    s.rep.R = round3(R.carryMid + R.carry * (s.rep.R - R.carryMid));
    s.rep.buzz = 0;
    const tier = s.season.tier;
    s.season = freshSeason(s);
    s.season.tier = tier;
  },
  phase(s, ctx, from, to) {
    if (to === 'october') { s.season.totals = freshTotals(s); s.season.totals.rStart = round3(s.rep.R); }
    if (to === 'halloween') panicNight(s, ctx);
    if (to === 'weighoff') { s.season.families = []; s.season.queue = []; s.season.road.cars = []; s.season.road.q = 0; }
  },
  dayStart(s, ctx) {
    if (s.clock.phase !== 'october' || s.season.offstage) return;
    const d = s.clock.day, dec = s.season.decorator;
    if (isWeekend(d)) weekendStart(s, ctx);
    else if (d <= D(S.weekdayLast)) weekdaySales(s, ctx);
    // Oct 1, year 1: the Mayor's "the field is the store" reminder. Not a new system, so it's chatter: it never holds
    // the clock or waits for the intro gap.
    if (s.clock.year === 1 && d === OCT1) ctx.say('mayor', L.open);
    // Hotel Marlene's order: delivered from the barn the first weekday morning there are 40 ready, by Oct 9
    if (dec?.state === 'open' && !isWeekend(d)) {
      if (patch.barnStock(s, dec.v) >= dec.n) {
        patch.barnTake(s, dec.v, dec.n);
        const amt = round2(dec.n * VT[dec.v].price * dec.mul);
        ctx.money(amt, 'pumpkins');
        dec.state = 'done';
        ctx.emit({ type: 'toast', text: fill(L.decoratorDone, { Variety: vname(dec.v), amt: `$${Math.round(amt)}` }), cls: 'good', icon: 'coin' });
        ctx.story('decorator', 26, { n: dec.n });
      } else if (d >= D(dec.due)) {
        dec.state = 'failed';
        s.rep.R = round3(clamp(s.rep.R + CAT.decorator_order.failR, 1, 5));
        ctx.emit({ type: 'toast', text: L.decoratorFail, cls: 'bad', icon: 'stand' });
      }
    }
  },
  tick(s, ctx) {
    if (!weekendNow(s) || s.season.offstage) return;
    for (let i = 0; i < TICK_PARTS.length; i++) TICK_PARTS[i](s, ctx);
  },
  dayEnd(s, ctx) {
    if (s.clock.phase !== 'october' || s.season.offstage) return;
    if (isWeekend(s.clock.day)) weekendEnd(s, ctx);
    // Gran's overnight restock readies the store for a selling day (Friday and Saturday nights). On other nights the
    // barn keeps its fruit: it ages at 0.35x in there, and moving it back out would only undo a cut.
    if (isWeekend(s.clock.day + 1)) overnightRestock(s, ctx);
  },
  actions: ACTIONS,
  cards: {
    morning(s, card, choice, ctx) {
      const se = s.season, d = s.clock.day, wi = weekendIndex(d);
      if (se.radioPlan && se.radioW !== wi) { if (spend(s, ctx, T.shop.radio.price, 'marketing')) { se.radioW = wi; ctx.emit({ type: 'toast', text: L.radio, cls: 'good', icon: 'radio' }); } }
      se.shuttleOn = !!se.shuttlePlan && spend(s, ctx, T.shop.shuttle.price, 'marketing');
      if (se.shuttleOn) ctx.emit({ type: 'toast', text: L.shuttle, cls: 'good', icon: 'lot' });
      // the radio brings more families today: re-plan the crowd with the weekend's marketing in place
      planDay(s);
    },
    evening() {},
    panic() {},
    decorator(s, card, choice) {
      if (choice !== 'yes') return;
      s.season.decorator = { v: card.data.variety, n: CAT.decorator_order.n, due: CAT.decorator_order.due, mul: CAT.decorator_order.mul, state: 'open' };
    },
  },
  beats: BEATS.map(shaped(BEAT_KEYS)),
  events: EVENTS.map(shaped(EVENT_KEYS)),
  // a lesson's goal lets go when its moment has passed (story.js): no [?] left to answer
  goals: { wants: (s) => !weekendNow(s) || s.season.families.some((f) => f.bubble?.kind === 'want') },
  bot(s, ctx, P) {
    if (s.clock.phase !== 'october') return;
    if (!weekendNow(s)) return botPlan(s, P);
    return botAct(s, P);
  },
  summary: (s) => seasonSummary(s),
};

// a weekend day in real minutes at 1x (actions per minute are per real minute, as a player feels them)
const DAY_MINUTES_1X = (CLOSE - OPEN) / TPS / 60;
/** This year's season in numbers (tools/simulate.mjs, the winter ledger, balance tests). */
export function seasonSummary(s) {
  const t = s.season.totals, c = t.conc, n = sum(c);
  let acc = 0, p95 = 0;
  for (let i = 0; i < c.length; i++) { acc += c[i]; if (acc >= 0.95 * n) { p95 = i; break; } }
  return { families: t.families, served: t.served, turned: t.turned, walkoffs: t.walkoffs, revenue: t.revenue, weekday: t.weekday.amt,
    stars: t.starsN ? round2(t.starsSum / t.starsN) : null, R: round2(s.rep.R), conc95: p95, concMax: c.length - 1, bind: { ...t.bind },
    actsPerMin: t.acts.length ? round2(sum(t.acts) / t.acts.length / DAY_MINUTES_1X) : 0, actsPerDay: t.acts.length ? round2(sum(t.acts) / t.acts.length) : 0, goatAte: t.goatAte, tips: t.tips, honey: t.honey,
    rafts: t.rafts || 0, raftDays: t.raftDays || 0, starsHist: [...t.starsHist], why: Object.fromEntries(Object.entries(t.why).map(([k, v]) => [k, t.starsN ? round2(v / t.starsN) : 0])) };
}
