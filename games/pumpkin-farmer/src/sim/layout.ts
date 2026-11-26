// Shared world layout for the Foggy Diorama tile (aesthetics/prototype-1.html).
// The sim uses it for walking distances and family/farmer routes; the renderer uses it to place things
// and to register tap hitboxes. World units: the tile spans x, z in [-20, 20]; y is up; land ends at
// x = 8.5, then beach to x = 11.5, then sea. Pure data plus a few pure helpers.

export interface Pt { x: number; z: number }
export interface PathNode extends Pt { id: string }

export const TILE = { half: 20, landE: 8.5, shoreE: 11.5 };

// ---------------------------------------------------------------- the patch
// Seven rows, one variety and one planting date each. Row 0 (z = -1) is the front of the store,
// nearest the lane, the gate and the stand. Rows 0-3 are tilled in year 1, rows 4-6 start as bramble.
export const ROWS = { count: 7, x0: -9.6, x1: 6.6, half: 0.95 };
export const rowZ = (r: number) => -1 + 2 * r;
// families pick from the aisle in front of a row (row 0's "aisle" is the headland inside the gate)
export const aisleZ = (r: number) => rowZ(r) - 1;
export const PICK_X = [-8, -5, -2, 1, 4] as const;
export const pickSpot = (r: number, k: number): Pt => ({ x: PICK_X[((k % PICK_X.length) + PICK_X.length) % PICK_X.length] ?? PICK_X[0], z: aisleZ(r) });
export const rowAt = (x: number, z: number) => {
  if (x < ROWS.x0 || x > ROWS.x1) return -1;
  const r = Math.round((z + 1) / 2);
  return r >= 0 && r < ROWS.count && Math.abs(z - rowZ(r)) < ROWS.half ? r : -1;
};

// ---------------------------------------------------------------- places
export const PLACES = {
  stand: { x: -5, z: -7.6, rect: [-6.8, -8.6, -3.2, -6.4] },          // farm stand (checkout)
  standFront: { x: -5, z: -6.5 },                                     // where the farmer rings up
  gran: { x: -7.0, z: -7.45 },                                        // Gran's till, at the end of the counter (visible from above)
  corral: { x: -3, z: -6.6 },                                         // wagon corral (the red wagon)
  barn: { x: -14, z: -14, rect: [-17.6, -17.1, -10.4, -10.9], door: { x: -14, z: -11.2 } },
  giant: { x: -15.5, z: 9, r: 3.4 },                                  // giant pumpkin corner
  giantView: { x: -12.4, z: 9 },                                      // where visitors stand to gawk
  sail: { x: -14.8, z: 9.6 },                                         // shade sail centre
  sign: { x: -13.2, z: 12.4 },                                        // the giant's sign
  scale: { x: -16.4, z: 17.1, rect: [-18.4, 15.2, -12, 19.5] },       // Q.S.C. Official Scale
  readout: { x: -14.9, z: 15.55 },
  weighmaster: { x: -13.2, z: 17.4 },
  pallets: { x0: -12, x1: -4, z: 17.6 },                              // rivals' giants line the north fence
  hives: [[-7.2, -16.2], [-5.6, -16.4], [-4.0, -16.1], [-2.4, -16.3], [-8.8, -16.2], [-0.8, -16.3]] satisfies [number, number][], // 4 built, 2 extra spots
  hivesRect: [-9.4, -17, -0.2, -15.5],
  maze: { x0: 0.3, z0: -19.8, x1: 8.3, z1: -7.4, entrance: { x: 4.3, z: -7.6 } },
  hayfort: { x: -8.2, z: -11.6 },
  scarecrow: { x: -1.6, z: 6 },
  gate: { x0: -2.0, x1: 0.4, z: -3.4 },
  standGate: { x0: -6.75, x1: -5.75, z: -3.4 },                      // the little gate by the stand: out to the till
  lane: { z: -4.35, x0: -20, x1: 8.1 },                              // the road (ROAD below); its footpath is at z -5.75
  lot: { x: -18.5, z: -4.6, rect: [-20, -7.8, -16, -3] },           // west lane; the car park itself is lost in Marlene
  beachLot: { x0: 8.2, x1: 10.6, z0: -3.1, z1: 3.6 },               // overflow parking on the sand (ROAD.sand)
  beach: { x0: 8.5, x1: 11.5 },
  kelp: { x: 10.2, z: 2.5 },
  // harbor seals swim in and out (no car): offshore, a lane of sea north of the beach lot and south of the dock; the
  // water's edge (the sea's surface, y -0.88, meets the beach's slope here) and the beach path up to the patch
  sea: { x: 13.6, z0: 3.4, z1: 5.0, edge: 10.4, up: { x: 9.4, z: 3.9 } },
  dock: { x: 13, z: 6 },
  boat: { x: 14.6, z: 8 },
  lighthouse: { x: 16.6, z: -16.2, r: 1.5 },
  whale: { x: 17.5, z: 1 },
  farmhome: { x: -11.5, z: -6.4 },                                   // where the farmer idles off-season
};

// Spots where things can be lost, land, or sprout (lost joey, swarm, volunteer vine).
export const HIDEOUTS = {
  hayfort: { x: -8.2, z: -11.6 }, sail: { x: -14.8, z: 9.6 }, mazeEdge: { x: 2.6, z: -8.2 }, barnDoor: { x: -14, z: -10.9 },
  wagon: { x: -3, z: -6.6 }, stand: { x: -6.6, z: -7 }, scarecrow: { x: -1.6, z: 6.4 }, hives: { x: -4.8, z: -15.4 },
};
export const SWARM_SPOTS = {
  scarecrow: { x: -1.6, y: 2.5, z: 6 }, sail: { x: -14.8, y: 3.6, z: 9.6 }, cupola: { x: -14, y: 5.9, z: -14 },
  giantStem: { x: -15.4, y: 2.0, z: 9 }, weighmasterHat: { x: -13.0, y: 4.4, z: 17.6 },
};
export const VINE_SPOTS = {
  barnRoof: { x: -14, y: 5.2, z: -13 }, dockEnd: { x: 16.1, y: -0.3, z: 6 },
  lighthouse: { x: 15.6, y: 2.8, z: -15.2 }, maze: { x: 5.4, y: 0, z: -12.2 },
};

// ---------------------------------------------------------------- [growing-year tracks] reserved blocks (plan §6.0)
// [D] poke targets that aren't tap zones yet (corn, dock, sea, cottage, the giant's sign), each >= 44 px at Home zoom
// (plan §3.4): { kind: 'poke', id, circle | rect, priority }. They join ZONES below.
// (Small ones are fine at Home zoom: the nearest box within 24 px of the finger wins, so each is at least 48 px wide.)
/** A tap zone in XZ: a circle [x, z, r] or a rectangle [x0, z0, x1, z1], with an optional height range [y0, y1]. */
export type Zone = { kind: string; id: string | number; y?: [number, number]; priority?: number; enabled?: boolean } & (
  | { circle: [number, number, number]; rect?: undefined }
  | { rect: [number, number, number, number]; circle?: undefined });

export const POKE_ZONES: Zone[] = [
  { kind: 'poke', id: 'corn', rect: [0.3, -19.8, 8.3, -7.4], priority: 1 },          // the maze
  { kind: 'poke', id: 'dock', rect: [9.8, 5.35, 16.4, 6.65], priority: 3 },
  { kind: 'poke', id: 'sea', rect: [11.6, -11, 20, 20], priority: 0 },              // the boat, dock and whale win over it
  { kind: 'poke', id: 'cottage', rect: [12.7, -19.2, 15.1, -17.2], priority: 3 },   // the keeper's cottage on the bluff
  { kind: 'poke', id: 'sign', circle: [PLACES.sign.x, PLACES.sign.z, 0.7], priority: 4 },
];
// [A] where each visitor comes onto the farm and leaves it (plan §3.2): { [visitor]: { from: { x, z }, to: { x, z } } }, plus
// the few spots they visit that aren't PLACES yet (Gran's washing line by the cottage, the beach nap, the giant's warm side)
export const MISCHIEF_ENTRY = {
  pamela: { from: { x: -6.5, z: 20.5 }, to: { x: -6.5, z: 20.5 } },      // hops the north fence from next door
  possum: { from: { x: 2.6, z: -8.2 }, to: { x: 2.6, z: -8.2 } },        // out of the corn (HIDEOUTS.mazeEdge)
  seal: { from: { x: 13.6, z: 4.2 }, to: { x: 13.6, z: 4.2 } },          // up out of the sea lane (PLACES.sea)
  otter: { from: { x: 17.5, z: 3.5 }, to: { x: 17.5, z: -1.5 } },        // floats in with the tide, and out again
  skunks: { from: { x: -19.6, z: 6.0 }, to: { x: -19.6, z: 6.0 } },      // single file, through the west fence
  spots: {
    washing: { x: -12.6, z: -9.2 }, beach: { x: 10.3, z: 0.6 }, cove: { x: 13.2, z: 1.6 }, giantSide: { x: -12.9, z: 7.4 },
    sail: { x: -13.3, z: 10.9 }, bramble: { x: -3.8, z: 6.1 },   // Biscuit's dig: Row 5's bramble, clear of the scarecrow
  },
};

// ---------------------------------------------------------------- tap zones (design §12)
// Analytic hitboxes in XZ. Higher priority wins when several are within reach. (The Weighmaster's toy hitbox
// is added by render/cast.js only while he is on the farm: weigh-off day.)
const rowZone = (r: number): Zone => ({ kind: 'row', id: r, rect: [ROWS.x0, rowZ(r) - ROWS.half, ROWS.x1, rowZ(r) + ROWS.half], priority: 1 });
export const ZONES: Zone[] = [
  { kind: 'giant', id: 'giant', circle: [-15.5, 9, 3.4], priority: 3 },
  { kind: 'stand', id: 'stand', rect: [-6.8, -8.6, -3.2, -6.0], priority: 3 },
  { kind: 'barn', id: 'barn', rect: [-17.6, -17.1, -10.4, -10.9], priority: 2 },
  { kind: 'hives', id: 'hives', rect: [-9.4, -17, -0.2, -15.5], priority: 2 },
  { kind: 'lot', id: 'lot', rect: [-20, -7.8, -16, -3], priority: 2 },
  { kind: 'scale', id: 'scale', rect: [-18.4, 15.2, -12, 19.5], priority: 2 },
  { kind: 'toy', id: 'lighthouse', circle: [16.6, -16.2, 1.5], priority: 4 },
  { kind: 'toy', id: 'scarecrow', circle: [-1.6, 6, 0.6], priority: 4 },
  { kind: 'toy', id: 'boat', circle: [14.6, 8, 1.0], priority: 4 },
  ...Array.from({ length: 7 }, (_, r) => rowZone(r)),
  ...POKE_ZONES,
];

// ---------------------------------------------------------------- the road (design §7 Route 46 and parking)
// A one-way farm road off Route 46, out of Marlene at the tile's west edge, two lanes wide. It runs east along the
// patch: the patch's side drops families off (the patch's front is open between the stand's little gate and its east
// corner, so a family steps straight out into it) and the stand's side picks them up (a family waits on the stand's
// verge). At the lane's end both sides bend north and run up the beach into the fog behind the lighthouse (round to the
// car park, or home). The beach lot, when it's open, is a row of spaces on the sand south of the lane's end, down a spur
// off the patch's side. Folks walk the footpath on the stand's verge and cross to the patch at the gates.
// sim/traffic.js drives every car on it; the renderer draws them where the sim puts them.
export const ROAD = {
  z: -3.9, zStand: -4.8, walk: -5.75,            // the patch's side and the stand's side; the footpath
  west: -21, north: -21,                         // out of the fog; back into it up the beach
  // where each side bends north (x) and its radius: the beach road's lanes run at x 10.05 and 8.75, between the corn and
  // the sea, the stand's side round first so the two never run abreast in their bends
  bend: { patch: [8.1, 1.95] satisfies [number, number], stand: [7.4, 1.35] satisfies [number, number] },
  front: [-5.75, 6.6] satisfies [number, number],                         // the patch's open front (x from, to)
  // the spaces on each side, front (east) first: the drop-off along the patch's open front; the pick-up, a step from the
  // till and just past the little gate (the nearest the fog it can be without a long walk back along the line)
  stops: { patch: [3.45, 1.35, -0.75, -2.85, -4.95], stand: [-2.6, -4.7] },
  line: -19,                                     // (x) a pick-up car east of here is near enough for its family to walk to
  // the beach lot (when it's open): four spaces (T.season.parking.beach, a test keeps them equal) nose to the sea (x) at
  // z spots, down a spur off the patch's side (a right turn of radius `turn` at x `at`, a left turn of radius `bay` into
  // each space). Out: back out, up the spur to z `join`, and onto the patch's side `joinAt` radians round its bend.
  sand: { x: 9.85, at: 7.7, turn: 0.85, bay: 0.7, join: -2.6, joinAt: 0.87, spots: [-2.3, -1.2, -0.1, 1.0] },
  // where folks cross (x from, to): the giant's path, the patch's west path (and the grass to the giant), the little
  // gate, the patch's east path (and the way to the beach). A car never stops on one.
  crossings: [[-16.1, -14.9], [-11.5, -10.0], [-6.75, -5.75], [6.8, 8.0]] satisfies [number, number][],
};

// ---------------------------------------------------------------- path graph
// Families and the farmer walk on this graph (the prototype's PATHS plus the patch aisles).
const N: Record<string, PathNode> = {};
const node = (id: string, x: number, z: number) => (N[id] = { id, x, z });
const E: [string, string][] = [];
const edge = (a: string, b: string) => E.push([a, b]);

// the lane's footpath, west (in the fog) to the patch's east path (the beach road runs north past its end)
node('west', -21, ROAD.walk);
const LANE: [string, number][] = [['lot', -18.5], ['l_giant', -15.5], ['l_barn', -14], ['l_patchW', -10.6], ['l_hay', -8.2], ['l_stand', -6.25], ['l_gate', -0.8], ['l_maze', 4.3], ['l_patchE', 7.4]];
LANE.forEach(([id, x]) => node(id, x, ROAD.walk));
edge('west', 'lot');
LANE.slice(1).forEach(([id], i) => edge(LANE[i]![0], id));
// stand, corral, barn, maze, hay fort, hives, beach
node('stand', -5, -6.5); edge('l_stand', 'stand');
node('corral', -3, -6.3); edge('stand', 'corral'); edge('l_stand', 'corral');
node('barn', -14, -11.2); edge('l_barn', 'barn');
node('maze', 4.3, -7.6); edge('l_maze', 'maze');
node('hayfort', -8.2, -10.6); edge('l_hay', 'hayfort');
// the farmer's back way: out behind the stand, past the hay fort to the barn door (half the lane's way round)
node('standBack', -1.9, -9.3); edge('corral', 'standBack'); edge('standBack', 'hayfort'); edge('hayfort', 'barn');
node('hives', -6.0, -15.0); edge('hayfort', 'hives');
node('beach', 9.4, 3.9);                         // (edge from the patch's east path below, south of the beach lot)
node('kelp', 9.9, 4.7); edge('beach', 'kelp');
// giant corner and the weigh station
node('g_s', -15.5, 4.6); edge('l_giant', 'g_s');
node('g_sw', -18.6, 4.6); node('g_se', -12.4, 4.6); node('g_view', -12.4, 9); node('g_ne', -12.4, 13.4); node('g_n', -15.5, 13.4); node('g_nw', -18.6, 13.4);
edge('g_s', 'g_sw'); edge('g_s', 'g_se'); edge('g_se', 'g_view'); edge('g_view', 'g_ne'); edge('g_ne', 'g_n'); edge('g_n', 'g_nw'); edge('g_nw', 'g_sw');
node('scale', -15.5, 15.5); edge('g_n', 'scale');
// patch: gate onto the headland, then a ladder of aisles between the west (x = -10.6) and east (x = 7.4) paths
node('gate', -0.8, -3.4);                        // where cars drop families off (no crossing: the little gate is the way out)
node('sgate', -6.25, -3.4); edge('l_stand', 'sgate');        // its crossing is west of where the cars stop
for (let r = 0; r < ROWS.count; r++) {
  const z = aisleZ(r);
  node(`aw${r}`, -10.6, z); node(`ae${r}`, 7.4, z);
  PICK_X.forEach((x, k) => node(`p${r}_${k}`, x, z));
  edge(`aw${r}`, `p${r}_0`);
  for (let k = 0; k < PICK_X.length - 1; k++) edge(`p${r}_${k}`, `p${r}_${k + 1}`);
  edge(`p${r}_${PICK_X.length - 1}`, `ae${r}`);
  if (r > 0) { edge(`aw${r - 1}`, `aw${r}`); edge(`ae${r - 1}`, `ae${r}`); }
}
edge('l_patchW', 'aw0'); edge('l_patchE', 'ae0'); edge('ae3', 'beach');
edge('gate', 'p0_2'); edge('gate', 'p0_3'); edge('sgate', 'p0_1');
node('backW', -10.6, 14.4); node('backE', 7.4, 14.4);
edge(`aw${ROWS.count - 1}`, 'backW'); edge(`ae${ROWS.count - 1}`, 'backE'); edge('backW', 'backE');

export const NODES = N;
export const EDGES = E;
// Every edge names two nodes built above; a typo is a load-time error, not a NaN route.
export const nodeAt = (id: string) => {
  const n = N[id];
  if (!n) throw new Error(`layout: no node ${id}`);
  return n;
};
const ADJ: Record<string, [string, number][]> = {};
for (const [a, b] of E) {
  const d = Math.hypot(nodeAt(a).x - nodeAt(b).x, nodeAt(a).z - nodeAt(b).z);
  (ADJ[a] ||= []).push([b, d]); (ADJ[b] ||= []).push([a, d]);
}

// Shortest route between two nodes (Dijkstra; the graph is tiny). Returns [{ x, z, id }, ...] including both ends.
const routeCache = new Map<string, PathNode[]>();
export function route(from: string, to: string): PathNode[] {
  const key = from + '>' + to;
  const hit = routeCache.get(key);
  if (hit) return hit;
  const dist = new Map<string, number>([[from, 0]]), prev = new Map<string, string>(), open = new Set([from]);
  while (open.size) {
    let u: string | null = null, du = Infinity;
    for (const n of open) { const dn = dist.get(n) ?? Infinity; if (u === null || dn < du) { u = n; du = dn; } }
    if (u === null) break;
    open.delete(u);
    if (u === to) break;
    for (const [v, w] of ADJ[u] ?? []) {
      const d = du + w, dv = dist.get(v);
      if (dv === undefined || d < dv) { dist.set(v, d); prev.set(v, u); open.add(v); }
    }
  }
  const out: PathNode[] = [];
  if (dist.has(to)) for (let n: string | undefined = to; n !== undefined; n = prev.get(n)) out.unshift({ id: n, x: nodeAt(n).x, z: nodeAt(n).z });
  routeCache.set(key, out);
  return out;
}
export const routeLength = (pts: readonly Pt[]) => pts.reduce((a, p, i) => {
  const q = pts[i - 1];
  return q ? a + Math.hypot(p.x - q.x, p.z - q.z) : 0;
}, 0);
export function nearestNode(x: number, z: number, filter?: (n: PathNode) => boolean) {
  let best: PathNode | null = null, bd = Infinity;
  for (const n of Object.values(N)) {
    if (filter && !filter(n)) continue;
    const d = (n.x - x) ** 2 + (n.z - z) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

// Queue spots at the stand's counter, front of the line first, then back along the stand's front off the footpath.
export const QUEUE = ([[-5, -6.3], [-5.75, -6.05], [-6.45, -6.05], [-7.15, -6.05], [-7.85, -6.05], [-8.55, -6.05], [-9.25, -6.05], [-9.95, -6.05]] satisfies [number, number][]).map(([x, z]) => ({ x, z }));
