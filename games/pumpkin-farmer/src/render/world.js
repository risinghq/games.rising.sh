// The static diorama: tile, strata, beach, bluff, sea, barn, stand, hives, maze, hay, fences, scarecrow,
// trees, lighthouse, cottage, dock, boat, lanterns, string lights, the Q.S.C. Official Scale, stars,
// lighthouse beam and fog puffs, plus their ambient animation (water, boat, beam, bees, puffs).
//
// Ported from aesthetics/prototype-1.html as of commit fe9c2cd. Changes from the prototype:
// - The 7 patch rows, the giant, its leaves, sail cloth and sign are dynamic and live in render/patch.js
//   and render/giant.js. The looping demo walkers are gone (the season slice adds families).
// - Tappable "hero" objects (barn, stand, hives, scarecrow, lighthouse, boat, scale) are merged in their
//   own local groups so they can squash-and-stretch on tap; everything else merges into one mesh per
//   material bucket (see kit.mergeStatic). Glows and fog puffs are billboards (one draw call each).
// - Each section draws from its own seeded stream, so the corn maze matches the prototype exactly
//   and editing one section never reshuffles another.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  PI, clamp, lerp, smooth, rng, M, C, PC, VC, part, prepGeo, mergeStatic, mergeLocal, canvasTex, liveTex, instanced,
  billboards, glowTex, PG, STEM, ICO0, ICO1, CYL, CYL8, CONE, BOX, dummy,
} from './kit.js';
import { fogPatch } from './fog.js';
import { PLACES, ROWS, ROAD, rowZ } from '../sim/layout.js';

export const LAND_E = 8.5, SHORE_E = 11.5;
// visual paths (sandy strips on the tile); the walkable graph lives in sim/layout.js. The lane itself is a one-way road
// (ROAD, drawn as packed earth, two lanes wide) with its footpath on the stand's side; at its end it bends north up the
// beach.
const WALK = ROAD.walk;
const PATHS = [
  [[-20, WALK], [7.9, WALK]],                                           // the lane's footpath, to the patch's east path
  [[-10.6, WALK], [-10.6, 14.4], [7.4, 14.4], [7.4, WALK]],            // around the patch
  [[-14, WALK], [-14, -11]],                                            // barn
  [[4.3, WALK], [4.3, -7.6]],                                           // corn maze
  [[-6.25, -2.2], [-6.25, -5.75], [-5, -6.4]],                         // farm stand, through its little gate
  [[-15.5, WALK], [-15.5, 4.6]],                                        // to the giant
  [[-18.6, 4.6], [-12.4, 4.6], [-12.4, 13.4], [-18.6, 13.4], [-18.6, 4.6]], // around the giant
  [[-15.5, 13.4], [-15.5, 15.5]],                                       // to the weigh station
];
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
// the road: both lanes from Marlene along the patch, and their bends at the lane's end up onto the sand (the beach road
// beyond is ruts)
const RZ = ROAD.z, RS = ROAD.zStand, BENDS = [[RZ, ...ROAD.bend.patch], [RS, ...ROAD.bend.stand]];
const onRoad = (x, z) => (x > -20 && x <= ROAD.bend.stand[0] && z > RS - 0.5 && z < RZ + 0.45)
  || (x > ROAD.bend.stand[0] && x < LAND_E && BENDS.some(([z0, e, r]) => (x <= e ? Math.abs(z - z0) < 0.47
    : z < z0 + 0.45 && Math.abs(Math.hypot(x - e, z - (z0 - r)) - r) < 0.47)));
export function pathDist(x, z) {
  let d = 1e9;
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) d = Math.min(d, segDist(x, z, ...p[i], ...p[i + 1]));
  return d;
}
// ground height: flat land, sloping beach, the dock
export function heightAt(x, z) {
  if (x <= LAND_E) return 0;
  let y = -Math.min(x - LAND_E, 3) / 3 * 1.23;
  if (z > 5.45 && z < 6.55 && x > 9.6 && x < 16.4) y = Math.max(y, -0.3);
  return y;
}

// corn maze grid, carved from the prototype's seed so the maze is the same one
const MZ = { x0: 0.3, z0: -19.8, u: 0.727, cols: 5, rows: 8 };
const GW = MZ.cols * 2 + 1, GH = MZ.rows * 2 + 1;
const R0 = rng(11);
const maze = Array.from({ length: GW }, () => Array(GH).fill(true));
(function carve(cx, cz) {
  maze[cx * 2 + 1][cz * 2 + 1] = false;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].map((d) => [d, R0.rand()]).sort((a, b) => a[1] - b[1]).map((d) => d[0]);
  for (const [dx, dz] of dirs) {
    const nx = cx + dx, nz = cz + dz;
    if (nx < 0 || nz < 0 || nx >= MZ.cols || nz >= MZ.rows || !maze[nx * 2 + 1][nz * 2 + 1]) continue;
    maze[cx * 2 + 1 + dx][cz * 2 + 1 + dz] = false;
    carve(nx, nz);
  }
})(2, 7);
maze[5][GH - 1] = false; maze[1][0] = false;
export const mazeWallAt = (x, z) => {
  const gx = Math.floor((x - MZ.x0) / MZ.u), gz = Math.floor((z - MZ.z0) / MZ.u);
  return gx >= 0 && gz >= 0 && gx < GW && gz < GH && maze[gx][gz];
};

const GRASS = [0x95a87f, 0x8da279, 0x9cae86, 0x889b73, 0xa3b38c, 0x90a57a];
const SCRUB = [0x6d7a52, 0x75804f, 0x68704a, 0x7b7a50, 0x707c56];
const inRowBand = (x, z) => {
  if (x <= ROWS.x0 || x >= ROWS.x1) return -1;
  const r = Math.round((z + 1) / 2);
  return r >= 0 && r < ROWS.count && Math.abs(z - rowZ(r)) < 0.6 ? r : -1;
};
// HIVES: the 4 built hives, then the 2 spots the shop can fill (layout.PLACES.hives)
const HIVE_COLS = [[0xa8c6c0, 0xefe5c8], [0xe9d18a, 0xa8c6c0], [0xefe5c8, 0xe2a68f], [0xe2a68f, 0xe9d18a], [0xa8c6c0, 0xe9d18a], [0xefe5c8, 0xa8c6c0]];
const BALES = [[-9.2, -11.6, 0, 0], [-8.2, -11.6, 0, 0], [-7.2, -11.6, 0, 0], [-8.7, -11.6, 1, 0], [-7.7, -11.6, 1, 0], [-8.2, -11.6, 2, 0],
  [-12, -6.85, 0, 0.1], [-1, -6.85, 0, -0.1], [6.4, -6.85, 0, 0.3], [-18.9, 2.6, 0, 1.4], [-18.9, 1.5, 0, 1.6], [3.3, -7.9, 0, 0], [5.3, -7.9, 0, 0], [-3.1, -8.4, 0, 0.5]];
const JACKS = [[-12, 0.5, -6.85, 0.2], [-1, 0.5, -6.85, -0.2], [-5.8, 0.96, -7.25, 0], [-4.3, 0.96, -7.25, 0.1], [-12.9, 0, 6.4, -0.6], [-12.4, 0, -10.6, 0.3], [3.3, 0.5, -7.9, 0.2], [5.3, 0.5, -7.9, -0.2]];
// lanterns and the string-light poles stand back off the road's verges (cars pass between them)
const LANTERNS = [[-11.5, -3.15], [7.95, -2.85], [8.3, 15.3], [-11.5, 15.3], [-17, -3.15]];
const POLES = [-19, -13.5, -8, -1.6, 3, 7.8].map((x) => [x, 2.6, -6.55]);
// shade sail frame (the cloth itself is giant.js state); NW, NE, SW, SE corner heights
const GX = PLACES.giant.x, GZ = PLACES.giant.z;
export const SAIL = { x: GX + 0.7, z: GZ + 0.6, h: 1.6, y: [3.7, 3.35, 3.35, 3.0] };
export const sailY = (u, v) => lerp(lerp(SAIL.y[0], SAIL.y[1], u), lerp(SAIL.y[2], SAIL.y[3], u), v);
const sailCorners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => [SAIL.x + (u * 2 - 1) * SAIL.h, sailY(u, v), SAIL.z + (v * 2 - 1) * SAIL.h]);

// first-person obstacles (the prototype's OBST)
const OBST = [
  ...BALES.map(([x, z]) => [x, z, 0.62]), ...PLACES.hives.slice(0, 4).map(([x, z]) => [x, z, 0.6]), ...POLES.map(([x, , z]) => [x, z, 0.2]),
  ...JACKS.filter((j) => j[1] === 0).map(([x, , z]) => [x, z, 0.45]), ...sailCorners.map(([x, , z]) => [x, z, 0.2]),
  [-3, -6.6, 0.75], [-1.6, 6, 0.4], [-13.2, 12.4, 0.25], [9.6, -1.5, 0.4],
  [-13.4, 17.45, 1.3], [-11.6, 16.95, 1.15], [-10.4, 16.7, 0.8], [-14.9, 15.55, 0.25],
  ...LANTERNS.map(([x, z]) => [x, z, 0.2]),
  [-19.0, -19.0, 0.6], [-19.2, 16.4, 0.5], [7.4, 18.4, 0.5], [-8.6, 18.6, 0.6],
];
export function blocked(x, z) {
  for (const [ox, oz, r] of OBST) if ((x - ox) ** 2 + (z - oz) ** 2 < (r + 0.25) ** 2) return true;
  if (x > -6.8 && x < -3.2 && z > -8.1 && z < -6.8) return true; // farm stand
  if (x < -19.4 || x > 19.4 || z < -19.4 || z > 19.4) return true;
  const onDock = z > 5.55 && z < 6.45 && x < 16.2;
  if (x > 10.3 && !onDock) return true;
  if (x > -17.6 && x < -10.4 && z > -17.1 && z < -10.9) return true;
  if (Math.hypot(x - GX, z - GZ) < 2.6) return true;
  for (const [ox, oz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) if (mazeWallAt(x + ox, z + oz)) return true;
  return false;
}

export function createWorld(K) {
  const { scene } = K;
  const root = new THREE.Group(); root.name = 'world'; scene.add(root);
  const statics = new THREE.Group();
  const heroes = {};                 // id -> group that squashes on tap
  const glows = [];                  // [x, y, z, size, strength] -> one additive billboard set
  const noShadow = (m) => ((m.castShadow = false), m);
  const hero = (id, x, y, z, ry = 0) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.name = id;
    heroes[id] = g; root.add(g); return g;
  };
  const glow = (x, y, z, s, k = 1) => glows.push([x, y, z, s, k]);

  // ---------------------------------------------------------------- the diorama tile
  // Vertex-coloured ground. Row strips remember their triangles so patch.js can repaint them
  // (bramble scrub before a row is cleared, darker soil after watering).
  const rowTris = Array.from({ length: ROWS.count }, () => []);
  let ground, groundCols, groundBase, scrubCols;
  {
    const r = R0; // continue the maze stream, as the prototype did
    const groundColor = (x, z, c) => {
      if (onRoad(x, z)) return c.setHex(r.rand() < 0.5 ? 0xb4a383 : 0xae9d7e);
      if (pathDist(x, z) < 0.62) return c.setHex(r.rand() < 0.5 ? 0xcdb894 : 0xc4ae89);
      if (x > -9.6 && x < 6.6 && z > -2.6 && z < 12.6) {
        const rz = Math.round((z + 1) / 2) * 2 - 1;
        return c.setHex(Math.abs(z - rz) < 0.6 ? (r.rand() < 0.5 ? 0x7a5d43 : 0x735740) : (r.rand() < 0.3 ? 0x8fa078 : 0x947658));
      }
      if (x > 0 && x < 8.4 && z > -19.8 && z < -7.4) return c.setHex(r.rand() < 0.5 ? 0xb9aa7c : 0xb1a274);
      if (Math.hypot(x + 15.5, z - 9) < 3.0) return c.setHex(r.rand() < 0.5 ? 0xd6c49c : 0xcdbb93);
      if (x > -19.2 && x < -9.2 && z > -19.2 && z < -9) return c.setHex(r.rand() < 0.5 ? 0xb3ab98 : 0xaaa28f);
      if (x > -18.4 && x < -14.2 && z > 15.2 && z < 19.0) return c.setHex(r.rand() < 0.5 ? 0xb3ab98 : 0xaaa28f);
      c.setHex(r.pick(GRASS));
      if (r.rand() < 0.04) c.setHex(0xb8b07c);
      return c;
    };
    const W = 20 + LAND_E, g = new THREE.PlaneGeometry(W, 40, Math.round(W * 2), 80);
    g.rotateX(-PI / 2); g.translate(-20 + W / 2, 0, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      if (x > -19.9 && x < LAND_E - 0.1 && Math.abs(z) < 19.9 && pathDist(x, z) > 0.8 && !onRoad(x, z)) p.setY(i, r.rr(-0.035, 0.035));
    }
    const ng = g.toNonIndexed(); g.dispose();
    const pos = ng.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
    const scrub = rng(4242); scrubCols = new Float32Array(pos.count * 3);
    for (let t = 0; t < pos.count; t += 3) {
      const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3, cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
      groundColor(cx, cz, c);
      for (let k = 0; k < 3; k++) cols.set([c.r, c.g, c.b], (t + k) * 3);
      const row = inRowBand(cx, cz);
      if (row >= 0) {
        rowTris[row].push(t);
        c.setHex(scrub.pick(SCRUB));
        for (let k = 0; k < 3; k++) scrubCols.set([c.r, c.g, c.b], (t + k) * 3);
      }
    }
    groundBase = cols.slice();
    ng.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    ng.computeVertexNormals();
    groundCols = ng.attributes.color;
    ground = new THREE.Mesh(ng, VC);
    ground.receiveShadow = true;
    root.add(ground);
  }
  // Repaint a row strip: mode 'soil' (tilled, darkened by wetness 0..1) or 'scrub' (overgrown).
  function paintRow(r, mode, wet = 0) {
    const a = groundCols.array, k = lerp(1, 0.66, clamp(wet, 0, 1));
    for (const t of rowTris[r]) {
      for (let i = t * 3; i < t * 3 + 9; i++) a[i] = mode === 'scrub' ? scrubCols[i] : groundBase[i] * k;
    }
    groundCols.needsUpdate = true;
  }

  // ---------------------------------------------------------------- strata, beach, bluff, rocks
  {
    const r = rng(101);
    const slab = (x0, x1, y0, y1, z0, z1, hex) =>
      part(BOX, C(hex), [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], [0, 0, 0], statics);
    slab(-20, LAND_E, -0.26, -0.02, -20, 20, 0x7f9469);
    slab(-20, LAND_E, -1.3, -0.26, -20, 20, 0x7a5c43);
    slab(-20, LAND_E, -2.3, -1.3, -20, 20, 0xa28768);
    slab(-20, 20, -3.3, -2.3, -20, 20, 0x9a958c);
    slab(-20, 20, -4.3, -3.3, -20, 20, 0x858079);
    slab(SHORE_E, 20, -2.3, -1.9, -11, 20, 0xc9b891);
    { // beach wedge
      const s = new THREE.Shape();
      s.moveTo(LAND_E, -0.02); s.lineTo(SHORE_E, -1.25); s.lineTo(SHORE_E, -2.3); s.lineTo(LAND_E, -2.3); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 40, bevelEnabled: false });
      g.translate(0, 0, -20);
      part(g, C(0xd8c8a1), [0, 0, 0], [1, 1, 1], [0, 0, 0], statics);
    }
    // bluff + lighthouse corner
    slab(SHORE_E, 20, -2.3, 2.6, -20, -11, 0xa29e95);
    slab(SHORE_E - 0.1, 20.05, 2.6, 2.8, -20.05, -10.95, 0x8fa278);
    for (let i = 0; i < 26; i++) {
      const onX = i < 13, s = r.rr(0.6, 1.4);
      const x = onX ? SHORE_E + r.rr(-0.3, 0.2) : r.rr(SHORE_E, 20), z = onX ? r.rr(-19.6, -11) : -11 + r.rr(-0.2, 0.3);
      part(ICO0, C(r.pick([0x9c988f, 0xa8a49b, 0x8f8b84])), [x, r.rr(-1.6, 2.2), z], [s, s * r.rr(0.8, 1.3), s], [r.rand() * 3, r.rand() * 3, 0], statics);
    }
    // stones poking out of the cut faces
    for (let i = 0; i < 60; i++) {
      const side = i % 4, s = r.rr(0.18, 0.42);
      let x, z, y = r.rr(-3.9, -0.6);
      if (side === 0) { x = r.rr(-19.5, 19.5); z = 20; } else if (side === 1) { x = r.rr(-19.5, 19.5); z = -20; }
      else if (side === 2) { x = -20; z = r.rr(-19.5, 19.5); } else { x = 20; z = r.rr(-19.5, 19.5); }
      if (x > LAND_E && y > -2.4 && !(z < -11 && x > SHORE_E)) y = r.rr(-3.9, -2.5);
      part(ICO0, C(r.pick([0x8a867f, 0x77736d, 0xa39f97])), [x, y, z], [s, s * 0.8, s], [r.rand() * 3, r.rand() * 3, 0], statics);
    }
    // rocks hanging under the floating tile
    // (their random tilt must never poke a corner up through the tile, so sink any that would)
    const box = new THREE.Box3();
    for (const [x, z, sx, sy, sz] of [[-12, -8, 7, 4.5, 6], [2, 6, 8, 5, 7], [-5, 12, 6, 4, 6], [13, -12, 6, 5, 6], [14, 9, 5, 3.5, 6], [-15, 12, 5, 3.5, 5], [5, -13, 5, 4, 5]]) {
      const m = part(ICO0, C(0x8a8680), [x, -5.4, z], [sx, sy, sz], [r.rand(), r.rand() * 3, r.rand() * 0.4], statics);
      m.updateMatrixWorld(true);
      const top = box.setFromObject(m, true).max.y;
      if (top > -2.6) m.position.y -= top + 2.6;
    }
  }
  // sea
  const waterSideMat = M(0x7aaba6, { transparent: true, opacity: 0.55, depthWrite: false });
  const waterSide = new THREE.Mesh(BOX, waterSideMat);
  waterSide.position.set((SHORE_E + 20) / 2, -1.43, 4.5); waterSide.scale.set(20 - SHORE_E, 0.94, 31);
  root.add(waterSide);
  const waterGeo = new THREE.PlaneGeometry(10, 31, 20, 62);
  waterGeo.rotateX(-PI / 2); waterGeo.translate(15, -0.88, 4.5);
  const waterBase = waterGeo.attributes.position.array.slice();
  const waterMat = M(0x8cbdb6, { transparent: true, opacity: 0.9, roughness: 0.35 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.receiveShadow = true;
  root.add(water);

  // ---------------------------------------------------------------- giant corner frame (sail posts)
  const woodMat = C(0x9b8774), driftMat = C(0xb1aa9c);
  for (const [x, y, z] of sailCorners) part(CYL, driftMat, [x, y / 2, z], [0.07, y, 0.07], [0, 0, 0], statics);

  // ---------------------------------------------------------------- barn
  const barnGlow = M(0x3b2f26, { emissive: 0xff9a45, emissiveIntensity: 0 });
  {
    const g = hero('barn', PLACES.barn.x, 0, PLACES.barn.z), bw = 3.25, depth = 5.5;
    const prof = [[-bw, 0], [bw, 0], [bw, 3], [2.35, 4.35], [0, 5.2], [-2.35, 4.35], [-bw, 3]];
    const s = new THREE.Shape(); prof.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    const eg = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); eg.translate(0, 0, -depth / 2);
    part(eg, C(0xa6574a), [0, 0, 0], [1, 1, 1], [0, 0, 0], g);
    const roof = C(0x5d6168);
    const edge = [[-bw, 3], [-2.35, 4.35], [0, 5.2], [2.35, 4.35], [bw, 3]];
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = edge[i], [bx, by] = edge[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      part(BOX, roof, [(ax + bx) / 2 - dy / L * 0.08, (ay + by) / 2 + dx / L * 0.08, 0], [L + 0.24, 0.16, depth + 0.5], [0, 0, Math.atan2(dy, dx)], g);
    }
    const white = C(0xf1ede4), fz = depth / 2;
    part(BOX, white, [0, 1.25, fz + 0.03], [2.4, 2.55, 0.06], [0, 0, 0], g);
    noShadow(part(BOX, barnGlow, [0, 1.2, fz + 0.05], [2.0, 2.3, 0.06], [0, 0, 0], g));
    for (const sx of [-1, 1]) { // open door leaves
      const leaf = new THREE.Group(); leaf.position.set(sx * 1.0, 0, fz + 0.06); leaf.rotation.y = sx * 1.15; g.add(leaf);
      part(BOX, C(0x8a463b), [sx * 0.5, 1.2, 0], [1.0, 2.3, 0.08], [0, 0, 0], leaf);
      part(BOX, white, [sx * 0.5, 1.2, 0.05], [0.08, 2.5, 0.05], [0, 0, 0.42 * sx], leaf);
    }
    part(BOX, white, [0, 3.55, fz + 0.03], [1.1, 1.0, 0.06], [0, 0, 0], g);
    noShadow(part(BOX, barnGlow, [0, 3.55, fz + 0.05], [0.8, 0.72, 0.06], [0, 0, 0], g));
    part(BOX, white, [0, 5.45, 0], [0.8, 0.7, 0.8], [0, 0, 0], g);
    part(new THREE.ConeGeometry(0.68, 0.6, 4), roof, [0, 6.1, 0], [1, 1, 1], [0, PI / 4, 0], g);
    mergeLocal(g, true);
  }

  // ---------------------------------------------------------------- farm stand (+ live farm-name sign)
  const glowMat = M(0x5a4a38, { emissive: 0xffc070, emissiveIntensity: 0 });
  const standSign = liveTex(512, 96, (g, w, h, name) => {
    g.fillStyle = '#efe8d8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3f4c43'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    let px = 40; g.font = `700 ${px}px Georgia, serif`;
    while (g.measureText(name).width > w - 70 && px > 18) g.font = `700 ${--px}px Georgia, serif`;
    g.fillText(name, w / 2, 48 + px * 0.35);
    g.fillStyle = '#d9782d'; g.beginPath(); g.arc(22, 48, 10, 0, 7); g.arc(w - 22, 48, 10, 0, 7); g.fill();
  });
  standSign.paint('Quarter Sun Cove Pumpkins');
  {
    const r = rng(202), g = hero('stand', PLACES.stand.x, 0, PLACES.stand.z);
    part(BOX, woodMat, [0, 0.48, 0.2], [3.2, 0.95, 0.9], [0, 0, 0], g);
    for (const [dx, dz] of [[-1.55, -0.3], [1.55, -0.3], [-1.55, 0.6], [1.55, 0.6]]) part(CYL, driftMat, [dx, 1.15, dz], [0.06, 2.3, 0.06], [0, 0, 0], g);
    for (let i = 0; i < 6; i++) part(BOX, C(i % 2 ? 0xf1ede4 : 0x8fb9b1), [-1.5 + 0.6 * i + 0.3, 2.35, 0.15], [0.6, 0.08, 1.6], [0.22, 0, 0], g);
    // the sign hangs from the canopy's front edge (the prototype had it under the canopy, where the overhead
    // camera can't see it, and the new-farm flow repaints it in front of the player)
    noShadow(part(new THREE.PlaneGeometry(3.0, 0.56), M(0xffffff, { map: standSign.tex, flatShading: false }), [0, 1.9, 0.99], [1, 1, 1], [-0.12, 0, 0], g));
    for (let i = 0; i < 5; i++) part(PG, PC(r.pick([0xe6913f, 0xf0e7d6, 0xeaa04a])), [-1.2 + i * 0.32, 0.96, 0.35], [0.15, 0.15, 0.15], [0, r.rand() * 6, 0], g);
    const honey = M(0xd9a443, { roughness: 0.3, emissive: 0x6a3a00, emissiveIntensity: 0.25 });
    for (let i = 0; i < 4; i++) noShadow(part(CYL8, honey, [0.5 + i * 0.22, 1.04, 0.05], [0.07, 0.17, 0.07], [0, 0, 0], g));
    part(CYL8, C(0xc79a62), [1.2, 0.99, 0.4], [0.2, 0.06, 0.2], [0, 0, 0], g);
    mergeLocal(g, true);
  }
  // the red wagon in the corral: its own group so the season slice can hide or move it
  const wagon = new THREE.Group();
  {
    const r = rng(203);
    wagon.position.set(PLACES.corral.x, 0, PLACES.corral.z); wagon.rotation.y = 0.2; root.add(wagon);
    part(BOX, C(0xa6574a), [0, 0.42, 0], [1.0, 0.28, 0.6], [0, 0, 0], wagon);
    for (const [dx, dz] of [[-0.35, -0.3], [0.35, -0.3], [-0.35, 0.3], [0.35, 0.3]]) part(CYL8, C(0x3e3b38), [dx, 0.17, dz], [0.17, 0.06, 0.17], [PI / 2, 0, 0], wagon);
    for (let i = 0; i < 3; i++) part(PG, PC(0xd8762c), [-0.25 + i * 0.25, 0.55, r.rr(-0.1, 0.1)], [0.17, 0.17, 0.17], [0, r.rand() * 6, 0], wagon);
    mergeLocal(wagon, true);
  }

  // ---------------------------------------------------------------- beehives & bees
  const HV = PLACES.hives, hx = -4.8, hz = -16.25;
  const buildHives = (g, from, to) => {
    const r = rng(300 + from);
    for (let i = from; i < to; i++) {
      const [x0, z0] = HV[i], x = x0 - g.position.x, z = z0 - g.position.z, cols = HIVE_COLS[i], ry = r.rr(-0.15, 0.15);
      part(BOX, C(0x6b5a4a), [x, 0.12, z], [0.9, 0.24, 0.75], [0, ry, 0], g);
      part(BOX, C(cols[0]), [x, 0.5, z], [0.78, 0.52, 0.64], [0, ry, 0], g);
      part(BOX, C(cols[1]), [x, 0.96, z], [0.78, 0.4, 0.64], [0, ry, 0], g);
      part(BOX, C(0xf1ede4), [x, 1.21, z], [0.9, 0.1, 0.76], [0, ry, 0], g);
      part(BOX, C(0x3a3330), [x, 0.3, z + 0.32], [0.4, 0.06, 0.04], [0, ry, 0], g);
    }
    mergeLocal(g, true);
  };
  buildHives(hero('hives', hx, 0, hz), 0, 4);
  const extraHives = [4, 5].map((i) => { const g = new THREE.Group(); g.position.set(hx, 0, hz); root.add(g); buildHives(g, i, i + 1); g.visible = false; return g; });
  {
    const r = rng(310), flowers = [];
    for (let i = 0; i < 140; i++) flowers.push([r.rr(-9, -0.6), r.rr(-19.4, -17.6)]);
    for (let i = 0; i < 40; i++) flowers.push([r.rr(12, 19.5), r.rr(-19.5, -11.5)]);
    instanced(ICO0, M(0xffffff), flowers, ([x, z], d) => { d.position.set(x, (x > 11 ? 2.85 : 0.08) + r.rr(0, 0.15), z); d.scale.setScalar(r.rr(0.05, 0.09)); return r.pick([0x9d86b8, 0xe8c95a, 0xf4f1ea, 0xd98aa0]); }, false, root);
  }
  const beeGeo = (() => {
    const parts = [[ICO0, [0, 0, 0], [0.06, 0.055, 0.085], 0xf2c14e], [ICO0, [0, 0.005, 0.07], [0.045, 0.045, 0.045], 0x2d2a26], [ICO0, [0.06, 0.05, 0], [0.06, 0.012, 0.035], 0xffffff], [ICO0, [-0.06, 0.05, 0], [0.06, 0.012, 0.035], 0xffffff]];
    return mergeGeometries(parts.map(([g, p, s, hex]) => prepGeo(g, new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion(), new THREE.Vector3(...s)), new THREE.Color(hex))));
  })();
  const BEES = 26;
  const bees = new THREE.InstancedMesh(beeGeo, VC, BEES);
  bees.frustumCulled = false; bees.castShadow = false;
  root.add(bees);
  const MEADOW = (() => { const r = rng(320); return Array.from({ length: 12 }, () => new THREE.Vector3(r.rr(-8, -1), 0.4, r.rr(-19, -17.8))); })();
  const beeData = (() => {
    const r = rng(321);
    return Array.from({ length: BEES }, (_, i) => ({
      hive: i % 6, bloomIdx: i * 7,
      r: r.rr(0.4, 1.0), a: r.rr(0.6, 1.4), b: r.rr(0.8, 1.8), p: r.rand() * 10, commute: r.rr(0.12, 0.22),
    }));
  })();
  const beeHome = (i) => new THREE.Vector3(HV[i][0], 0.9, HV[i][1]);
  const HOMES = HV.map((_, i) => beeHome(i));

  // ---------------------------------------------------------------- corn maze
  {
    const r = rng(400);
    // ~420 stalks, each drawn twice (the shadow pass too), so every triangle counts on a phone: no caps nobody sees
    // (the stalk's ends, the tassel's base), and each leaf is one bent, double-sided strip instead of a paper-thin box
    // (46 triangles a stalk, was 164; the same silhouette from every angle)
    const cornGeo = (() => {
      const gs = [new THREE.CylinderGeometry(0.03, 0.05, 1.7, 4, 1, true).translate(0, 0.85, 0), new THREE.ConeGeometry(0.06, 0.28, 4, 1, true).translate(0, 1.8, 0)];
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Matrix4().compose(new THREE.Vector3(0, 0.4 + i * 0.22, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i * 2.3, 0.45 + (i % 2) * 0.25)), new THREE.Vector3(1, 1, 1));
        const leaf = new THREE.PlaneGeometry(0.62, 0.11, 2, 1).rotateX(-PI / 2).translate(0.29, 0, 0);
        const lp = leaf.attributes.position;
        for (let k = 0; k < lp.count; k++) { const x = lp.getX(k); lp.setY(k, lp.getY(k) - 0.35 * (x / 0.6) ** 2); if (x > 0.5) lp.setZ(k, lp.getZ(k) * 0.3); }
        gs.push(leaf.applyMatrix4(m));
      }
      gs.push(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 5, 1, true).rotateZ(0.5).translate(0.06, 1.0, 0));
      return mergeGeometries(gs.map((g) => prepGeo(g, new THREE.Matrix4())));
    })();
    const corn = [];
    for (let gx = 0; gx < GW; gx++) for (let gz = 0; gz < GH; gz++) {
      if (!maze[gx][gz]) continue;
      for (const [ox, oz] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) corn.push([MZ.x0 + (gx + ox) * MZ.u + r.rr(-0.08, 0.08), MZ.z0 + (gz + oz) * MZ.u + r.rr(-0.08, 0.08)]);
    }
    instanced(cornGeo, M(0xffffff, { side: THREE.DoubleSide }), corn, ([x, z], d) => { d.position.set(x, 0, z); d.rotation.y = r.rand() * PI * 2; d.scale.set(1, r.rr(0.85, 1.15), 1); return r.pick([0xc9b77a, 0xbfae70, 0xb2ad6c, 0xd2c286]); }, true, root);
  }

  // ---------------------------------------------------------------- hay, fences, scarecrow, trees
  {
    const r = rng(500);
    instanced(new THREE.BoxGeometry(1, 0.5, 0.62).translate(0, 0.25, 0), M(0xffffff), BALES, ([x, z, lvl, ry], d) => {
      d.position.set(x, lvl * 0.5, z); d.rotation.y = ry + r.rr(-0.06, 0.06); return r.pick([0xd8bc72, 0xd2b569, 0xddc37c]);
    }, true, root);
    const posts = [], rails = [];
    const fence = (pts) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.2));
        for (let k = 0; k <= n; k++) posts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
        for (let k = 0; k < n; k++) for (const y of [0.35, 0.72]) rails.push([ax + (bx - ax) * (k + 0.5) / n, y, az + (bz - az) * (k + 0.5) / n, L / n, Math.atan2(bz - az, bx - ax)]);
      }
    };
    fence([[-19.6, 19.6], [8.0, 19.6]]); fence([[-19.6, -19.6], [-19.6, -5.8]]); fence([[-19.6, -3.4], [-19.6, 19.6]]);
    // the patch's front: the fence stops at the little gate and starts again past the main gate; between them, the open
    // front where cars pull up (the drop-off)
    fence([[-9.8, -3.4], [PLACES.standGate.x0, -3.4]]); fence([[ROAD.front[1], -3.4], [6.6, -3.4]]);
    const fenceMat = M(0xb1aa9c);
    instanced(new THREE.BoxGeometry(0.13, 0.95, 0.13).translate(0, 0.47, 0), fenceMat, posts, ([x, z], d) => { d.position.set(x, 0, z); d.rotation.y = r.rr(-0.2, 0.2); }, true, root);
    instanced(BOX, fenceMat, rails, ([x, y, z, L, a], d) => { d.position.set(x, y, z); d.rotation.y = -a; d.scale.set(L, 0.07, 0.05); }, true, root);
  }
  const scarecrowHat = new THREE.Group();
  {
    const S = hero('scarecrow', PLACES.scarecrow.x, 0, PLACES.scarecrow.z, -0.5);
    part(CYL, woodMat, [0, 1.15, 0], [0.05, 2.3, 0.05], [0, 0, 0], S);
    part(BOX, C(0x8a5a4a), [0, 1.45, 0], [0.62, 0.72, 0.3], [0, 0, 0], S);
    part(BOX, C(0x6f8b7b), [0, 1.0, 0], [0.56, 0.3, 0.28], [0, 0, 0], S);
    for (const sx of [-1, 1]) { part(BOX, C(0x8a5a4a), [sx * 0.58, 1.68, 0], [0.62, 0.2, 0.22], [0, 0, sx * 0.1], S); part(CONE, C(0xe2c26b), [sx * 0.95, 1.7, 0], [0.09, 0.2, 0.09], [0, 0, sx * -PI / 2], S); }
    part(ICO1, C(0xcdb68a), [0, 2.05, 0], [0.27, 0.27, 0.27], [0, 0, 0], S);
    part(ICO0, C(0x2d2c30), [-0.09, 2.08, 0.24], [0.035, 0.035, 0.02], [0, 0, 0], S);
    part(ICO0, C(0x2d2c30), [0.09, 2.08, 0.24], [0.035, 0.035, 0.02], [0, 0, 0], S);
    // the hat spins when tapped, so it stays its own little mesh
    scarecrowHat.position.set(0, 2.27, 0); scarecrowHat.rotation.z = 0.12; scarecrowHat.userData.keep = true; S.add(scarecrowHat);
    part(CYL8, C(0xc9a75e), [0, 0, 0], [0.42, 0.04, 0.42], [0, 0, 0], scarecrowHat);
    part(CONE, C(0xc9a75e), [0, 0.18, 0], [0.24, 0.36, 0.24], [0, 0, 0], scarecrowHat);
    mergeLocal(S, true); mergeLocal(scarecrowHat);
  }
  {
    const r = rng(600);
    const cypress = (x, y, z, s = 1) => {
      part(CYL, C(0x6b5a4a), [x + 0.15 * s, y + 0.9 * s, z], [0.14 * s, 1.8 * s, 0.14 * s], [0, 0, 0.22], statics);
      for (const [dx, dy, sx, sy, sz] of [[-0.1, 1.5, 1.3, 0.5, 0.95], [-0.5, 2.0, 1.1, 0.45, 0.85], [0.2, 2.3, 0.9, 0.42, 0.7], [-0.9, 1.7, 0.7, 0.38, 0.6]]) {
        part(ICO0, C(r.pick([0x5f7a5c, 0x6e8a69, 0x587254])), [x + dx * s, y + dy * s, z + r.rr(-0.2, 0.2)], [sx * s, sy * s, sz * s], [0, r.rand() * 3, 0], statics);
      }
    };
    cypress(13.2, 2.8, -12.4, 1.1); cypress(19.0, 2.8, -12.6, 0.9); cypress(-19.0, 0, -19.0, 1.2); cypress(-19.2, 0, 16.4, 1.0); cypress(7.4, 0, 18.4, 0.9); cypress(-8.6, 0, 18.6, 1.1);
  }

  // ---------------------------------------------------------------- lighthouse, cottage, dock, boat
  const lampMat = M(0xfff1b8, { emissive: 0xffe08a, emissiveIntensity: 0.4 });
  const LH = PLACES.lighthouse, LY = 2.8;
  {
    const white = C(0xf1ede4), red = C(0xb5543f), g = hero('lighthouse', LH.x, LY, LH.z);
    part(new THREE.CylinderGeometry(0.5, 0.8, 4.0, 8), white, [0, 2, 0], [1, 1, 1], [0, 0, 0], g);
    part(new THREE.CylinderGeometry(0.585, 0.625, 0.55, 8), red, [0, 2.6, 0], [1, 1, 1], [0, 0, 0], g);
    part(CYL8, C(0x3e3b38), [0, 4.06, 0], [0.82, 0.12, 0.82], [0, 0, 0], g);
    noShadow(part(CYL8, lampMat, [0, 4.42, 0], [0.42, 0.6, 0.42], [0, 0, 0], g));
    part(new THREE.ConeGeometry(0.58, 0.6, 8), red, [0, 5.0, 0], [1, 1, 1], [0, 0, 0], g);
    part(ICO0, C(0x3e3b38), [0, 5.38, 0], [0.09, 0.09, 0.09], [0, 0, 0], g);
    part(BOX, C(0x5a4a3c), [-0.62, 0.45, 0.35], [0.06, 0.9, 0.5], [0, 0.5, 0], g);
    mergeLocal(g, true);
    part(BOX, white, [13.9, LY + 0.7, -18.2], [2.2, 1.4, 1.8], [0, 0, 0], statics);
    part(new THREE.ConeGeometry(1.75, 0.9, 4), C(0x6e6a6a), [13.9, LY + 1.85, -18.2], [1, 1, 0.82], [0, PI / 4, 0], statics);
    for (const dx of [-0.5, 0.5]) noShadow(part(BOX, glowMat, [13.9 + dx, LY + 0.8, -17.28], [0.36, 0.4, 0.04], [0, 0, 0], statics));
  }
  part(BOX, woodMat, [13.0, -0.36, 6.0], [6.6, 0.12, 1.1], [0, 0, 0], statics);
  for (const x of [10.4, 12.4, 14.4, 16.1]) for (const dz of [-0.5, 0.5]) part(CYL, C(0x7d6a58), [x, -1.1, 6 + dz], [0.08, 1.6, 0.08], [0, 0, 0], statics);
  const boat = hero('boat', PLACES.boat.x, -0.88, PLACES.boat.z, 0.4);
  part(new THREE.SphereGeometry(1, 8, 4, 0, PI * 2, PI / 2, PI / 2), M(0xe8e0cf, { side: THREE.DoubleSide }), [0, 0.18, 0], [0.55, 0.38, 1.3], [0, 0, 0], boat);
  part(BOX, C(0x8fb9b1), [0, 0.12, 0], [0.9, 0.06, 0.2], [0, 0, 0], boat);
  mergeLocal(boat);
  { // driftwood + pebbles on the beach
    const r = rng(700);
    part(CYL, C(0xc2b8a6), [9.6, -0.42, 8.6], [0.12, 2.2, 0.12], [0, 0, 1.35], statics);
    for (let i = 0; i < 18; i++) { const x = r.rr(8.8, 10.4); part(ICO0, C(r.pick([0xb8b1a3, 0x9e988c, 0xcfc6b4])), [x, heightAt(x, 0), r.rr(-10, 19)], [r.rr(0.06, 0.14), r.rr(0.05, 0.09), r.rr(0.06, 0.14)], [0, r.rand() * 3, 0], statics); }
    // ruts in the sand: the beach road's two lanes north into the fog, the beach lot's spur, and into each of its spaces
    const rut = C(0xc4b088), tilt = Math.atan(1.23 / 3), D = ROAD.sand, SPX = D.at + D.turn;
    const rutZ = (x, z0, z1) => part(BOX, rut, [x, heightAt(x, 0) + 0.012, (z0 + z1) / 2], [0.16, 0.02, Math.abs(z1 - z0)], [0, 0, -tilt], statics);
    for (const [z0, e, r] of BENDS) for (const dx of [-0.32, 0.32]) rutZ(e + r + dx, z0 - r, -20.2);
    for (const dx of [-0.32, 0.32]) rutZ(SPX + dx, ROAD.z + D.turn, D.spots.at(-1) + D.bay + 0.6);
    for (const z of D.spots) for (const dz of [-0.32, 0.32]) {
      const x0 = SPX + D.bay, x1 = D.x + 0.5, xm = (x0 + x1) / 2;
      part(BOX, rut, [xm, heightAt(xm, 0) + 0.012, z + dz], [(x1 - x0) / Math.cos(tilt), 0.02, 0.16], [0, 0, -tilt], statics);
    }
  }

  // ---------------------------------------------------------------- jack-o'-lanterns, lanterns and string lights
  const faceMat = M(0x2a1a0e, { emissive: 0xff9a3c, emissiveIntensity: 0 });
  const faceGeo = (() => {
    const eye = new THREE.CircleGeometry(0.2, 3);
    const s = new THREE.Shape(); s.moveTo(-0.42, 0.05);
    [[-0.28, -0.08], [-0.18, 0.02], [-0.06, -0.1], [0.06, 0.0], [0.18, -0.1], [0.28, 0.02], [0.42, 0.05], [0.25, -0.28], [-0.25, -0.28]].forEach(([x, y]) => s.lineTo(x, y));
    const gs = [eye.clone().rotateZ(PI / 2).translate(-0.27, 0.28, 0), eye.clone().rotateZ(PI / 2).translate(0.27, 0.28, 0), new THREE.CircleGeometry(0.09, 3).rotateZ(PI / 2).translate(0, 0.08, 0), new THREE.ShapeGeometry(s).translate(0, -0.1, 0)];
    return mergeGeometries(gs.map((g) => prepGeo(g, new THREE.Matrix4())));
  })();
  for (const [x, y, z, ry] of JACKS) {
    const s = y > 0.9 ? 0.26 : 0.4;
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; statics.add(g);
    part(PG, PC(0xd8762c), [0, 0, 0], [s, s * 0.95, s], [0, 0, 0], g);
    part(STEM, C(0x6e6a3e), [0, PG.userData.top * s * 0.95 - 0.02, 0], [s * 2.4, s * 2.4, s * 2.4], [0.3, 0, 0], g);
    noShadow(part(faceGeo, faceMat, [0, 0.62 * s, 0.99 * s], [s * 0.9, s * 0.9, 1], [0, 0, 0], g));
    glow(x + Math.sin(ry) * s, y + 0.6 * s, z + Math.cos(ry) * s, 2.2 * s / 0.4, 1);
  }
  const lanternMat = M(0x4a3d30, { emissive: 0xffc070, emissiveIntensity: 0 });
  for (const [x, z] of LANTERNS) {
    part(CYL, C(0x5a4a3c), [x, 0.8, z], [0.05, 1.6, 0.05], [0, 0, 0], statics);
    noShadow(part(BOX, lanternMat, [x, 1.72, z], [0.22, 0.28, 0.22], [0, 0, 0], statics));
    part(new THREE.ConeGeometry(0.2, 0.16, 4), C(0x3e3b38), [x, 1.94, z], [1, 1, 1], [0, PI / 4, 0], statics);
    glow(x, 1.72, z, 1.6, 0.9);
  }
  const bulbs = [], wire = [];
  const strand = (pts, sag, per) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]);
      let prev = a.clone();
      for (let k = 1; k <= per; k++) {
        const u = k / per, p = a.clone().lerp(b, u); p.y -= sag * 4 * u * (1 - u);
        wire.push(prev.x, prev.y, prev.z, p.x, p.y, p.z); prev = p;
        if (k < per) { bulbs.push(p.clone().setY(p.y - 0.06)); if (k % 3 === 0) glow(p.x, p.y - 0.06, p.z, 0.85, 0.6); }
      }
    }
  };
  POLES.forEach(([x, y, z]) => part(CYL, C(0x6b5a4a), [x, y / 2, z], [0.06, y, 0.06], [0, 0, 0], statics));
  strand(POLES, 0.5, 10);
  strand([...sailCorners, sailCorners[0]].map(([x, y, z]) => [x, y - 0.08, z]), 0.2, 6);
  const bulbMat = M(0xfff3c4, { emissive: 0xffd27a, emissiveIntensity: 0.15 });
  instanced(new THREE.IcosahedronGeometry(0.045, 1), bulbMat, bulbs, (p, d) => { d.position.copy(p); }, false, root);
  {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    const lm = new THREE.LineBasicMaterial({ color: 0x3d3a36 }); lm.onBeforeCompile = fogPatch;
    root.add(new THREE.LineSegments(g, lm));
  }
  const nightLights = [[-12, 1.3, -6], [-5, 1.8, -6.9], [-14, 1.4, -10.4], [GX, 2.2, GZ + 2.6], [4.3, 1.1, -7.2], [-15.2, 2.8, 19.3]].map(([x, y, z]) => {
    const l = new THREE.PointLight(0xffa04a, 0, 9, 1.6); l.position.set(x, y, z); root.add(l); return l;
  });
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1c2, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const beamGeo = mergeGeometries([
    new THREE.ConeGeometry(1.4, 18, 16, 6, true).translate(0, -9, 0).rotateZ(PI / 2),
    new THREE.ConeGeometry(1.4, 18, 16, 6, true).translate(0, -9, 0).rotateZ(-PI / 2),
  ]);
  { // fade the beam out along its length
    const p = beamGeo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const f = Math.pow(1 - Math.min(1, Math.abs(p.getX(i)) / 18), 1.6); c.set([f, f, f], i * 3); }
    beamGeo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(LH.x, 7.22, LH.z); beam.visible = false;
  root.add(beam);
  const stars = (() => {
    const r = rng(800), a = [];
    for (let i = 0; i < 420; i++) { const th = r.rand() * PI * 2, ph = r.rr(0.05, 1.3), R = 160; a.push(Math.cos(th) * Math.cos(ph) * R, Math.sin(ph) * R, Math.sin(th) * Math.cos(ph) * R); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  })();
  stars.visible = false;
  root.add(stars);

  // ---------------------------------------------------------------- the Q.S.C. Official Scale
  // The readout is a live canvas: weighoff.js paints the digits with world.readout.paint(text).
  const readout = liveTex(256, 128, (g, w, h, text = '0000', label = 'Q.S.C. OFFICIAL SCALE') => {
    g.fillStyle = '#1d2420'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9fb3a8'; g.font = '700 15px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(label, w / 2, 24);
    g.fillStyle = '#ffb347'; g.font = '700 58px ui-monospace, Menlo, monospace'; g.fillText(String(text), w / 2 - 22, 92);
    g.font = '700 24px ui-monospace, Menlo, monospace'; g.fillText('LB', w / 2 + 88, 92);
  });
  readout.paint('0000');
  const readoutMat = M(0xffffff, { map: readout.tex, emissive: 0xffffff, emissiveMap: readout.tex, emissiveIntensity: 0.35, flatShading: false });
  {
    const WS = PLACES.scale, g = hero('scale', WS.x, 0, WS.z);
    part(BOX, C(0x5d6266), [0, 0.09, 0], [2.7, 0.18, 2.7], [0, 0, 0], g);
    part(BOX, C(0x9aa1a5), [0, 0.2, 0], [2.45, 0.06, 2.45], [0, 0, 0], g);
    for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [1.3, 1.3], [-1.3, 1.3]]) part(BOX, C(0xe5c66b), [dx, 0.2, dz], [0.16, 0.1, 0.16], [0, 0, 0], g);
    const Rd = new THREE.Group(); Rd.position.set(PLACES.readout.x - WS.x, 0, PLACES.readout.z - WS.z); Rd.rotation.y = -PI / 4; g.add(Rd);
    part(CYL, C(0x4a4f53), [0, 0.95, -0.05], [0.07, 1.9, 0.07], [0, 0, 0], Rd);
    part(BOX, C(0x3a3f43), [0, 1.95, 0], [1.15, 0.64, 0.14], [0, 0, 0], Rd);
    noShadow(part(new THREE.PlaneGeometry(1.0, 0.5), readoutMat, [0, 1.95, 0.075], [1, 1, 1], [0, 0, 0], Rd));
    glow(PLACES.readout.x - 0.12, 1.95, PLACES.readout.z + 0.12, 1.5, 0.5);
    mergeLocal(g, true);
  }

  // ---------------------------------------------------------------- glows and fog puffs (billboards)
  const glowB = billboards(glows.length, { map: glowTex(), blending: THREE.AdditiveBlending });
  glows.forEach(([x, y, z, s, k], i) => glowB.set(i, x, y, z, s, s, k));
  glowB.commit(); glowB.mesh.visible = false; root.add(glowB.mesh);
  const puffTex = canvasTex(256, 128, (g) => {
    const r = rng(900);
    for (let i = 0; i < 9; i++) {
      const x = 78 + r.rand() * 100, y = 58 + r.rand() * 12, rad = 24 + r.rand() * 22;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    }
  });
  const puffs = billboards(16, { map: puffTex, toneMapped: false, color: 0xd3dcdb });
  const puffData = (() => {
    const r = rng(901);
    return Array.from({ length: 16 }, (_, i) => ({ a: (i / 16) * PI * 2 + r.rr(-0.15, 0.15), r: r.rr(24, 33), y: r.rr(-1.5, 3.5), w: r.rr(11, 17), sp: r.rr(0.006, 0.014) * (r.rand() < 0.5 ? 1 : -1) }));
  })();
  root.add(puffs.mesh);

  // the growing-season whale (events.js 'whale', design §10): while the event is active a dark back rolls through
  // the swell off the bluff and spouts every few seconds, so its pin points at something worth tapping
  const whale = new THREE.Group();
  {
    const skin = C(0x3e4a53), belly = C(0x6f7d84);
    part(ICO1, skin, [0, 0, 0], [0.85, 0.42, 2.3], [0, 0, 0], whale);
    part(ICO1, belly, [0, -0.12, 0.25], [0.7, 0.22, 1.7], [0, 0, 0], whale);
    part(CONE, skin, [0, 0.42, -0.85], [0.16, 0.36, 0.3], [-0.55, 0, 0], whale);
    for (const sx of [-1, 1]) part(ICO0, skin, [sx * 0.55, 0.05, -2.45], [0.6, 0.08, 0.32], [0, sx * 0.5, 0], whale);
    mergeLocal(whale);
    whale.position.set(PLACES.whale.x, -2, PLACES.whale.z); whale.rotation.y = 0.5; whale.visible = false;
    root.add(whale);
  }
  let whaleT = 0;
  function syncWhale(s, dt) {
    const on = !!s?.events?.active?.some?.((e) => e?.id === 'whale');
    if (!on && !whale.visible) return;
    whaleT = on ? whaleT + dt : Math.max(whaleT, 0) + dt * 2;
    // a 7 s roll: surface, spout at 1.6 s, glide, sink; it finishes its dive when the event ends
    const k = (whaleT % 7) / 7, up = smooth(k, 0, 0.18) * (1 - smooth(k, 0.62, 0.85));
    whale.visible = on || up > 0.01;
    whale.position.y = lerp(-2.1, -0.95, up) + Math.sin(whaleT * 1.3) * 0.04;
    whale.rotation.x = lerp(0.18, -0.06, up);
    const sp = (whaleT - 1.6) % 7;
    if (on && sp >= 0 && sp < 0.5 && Math.floor(sp * 12) !== Math.floor((sp - dt) * 12)) {
      const fwd = 1.5;
      K.fx?.spout(whale.position.x + Math.sin(whale.rotation.y) * fwd, -0.6, whale.position.z + Math.cos(whale.rotation.y) * fwd);
    }
  }

  root.add(mergeStatic(statics));

  // ---------------------------------------------------------------- per-frame
  let farmName = null, hiveCount = 4, beeOn = 1, glowAmt = 0;
  // world toys (design §10): the scarecrow's hat spins, the foghorn flashes the lamp, the boat toots
  const toys = { scarecrow: 0, lighthouse: 0, boat: 0 };
  function toy(id) {
    if (id in toys) toys[id] = 1;
    if (id === 'hives') K.fx?.pop(hx, 1.4, hz, 0xf2c14e, 8);
  }
  const v3 = new THREE.Vector3();
  function sync(s, dt, t) {
    const name = s?.meta?.farmName || 'Quarter Sun Cove Pumpkins';
    if (name !== farmName) { farmName = name; standSign.paint(name); }
    const hives = clamp(s?.patch?.hives ?? 4, 0, 6);
    if (hives !== hiveCount) { hiveCount = hives; extraHives.forEach((g, i) => (g.visible = hives > 4 + i)); }
    // water
    const wp = waterGeo.attributes.position.array;
    for (let i = 0; i < wp.length; i += 3) wp[i + 1] = waterBase[i + 1] + Math.sin(wp[i] * 1.3 + t * 1.2) * 0.05 + Math.sin(wp[i + 2] * 0.9 - t * 0.9 + wp[i] * 0.4) * 0.04;
    waterGeo.attributes.position.needsUpdate = true;
    for (const k in toys) toys[k] = Math.max(0, toys[k] - dt / 1.1);
    boat.position.y = -0.88 + Math.sin(t * 1.1) * 0.05 + Math.sin(toys.boat * PI) * 0.12;
    boat.rotation.z = Math.sin(t * 0.9) * 0.06 + Math.sin(t * 13) * 0.12 * toys.boat;
    scarecrowHat.rotation.y = toys.scarecrow > 0 ? Math.sqrt(1 - toys.scarecrow) * PI * 4 : 0;
    beam.rotation.y = t * 0.6;
    syncWhale(s, dt);
    // bees fly only when Marlene is thin (f < 0.6, design §5) and never at night
    const fog = K.sky?.fog ?? 0.35;
    beeOn = lerp(beeOn, fog < 0.6 && glowAmt < 0.6 ? 1 : 0, Math.min(1, dt * 2));
    const bloom = K.bloom?.length ? K.bloom : MEADOW;
    beeData.forEach((b, i) => {
      const show = beeOn > 0.02 && b.hive < hiveCount;
      const c = 0.5 - 0.5 * Math.cos(t * b.commute * PI * 2 + b.p);
      // ease toward the current flower so bees don't jump when a row starts or stops blooming
      (b.cur ||= bloom[b.bloomIdx % bloom.length].clone()).lerp(bloom[b.bloomIdx % bloom.length], Math.min(1, dt * 0.6));
      v3.copy(HOMES[b.hive]).lerp(b.cur, c);
      dummy.position.set(v3.x + Math.sin(t * b.a * 3 + b.p) * b.r * 0.5, v3.y + 0.25 * Math.sin(t * b.b * 2 + b.p), v3.z + Math.sin(t * b.b * 3 + b.p) * Math.cos(t * b.a * 3 + b.p) * b.r * 0.5);
      dummy.rotation.set(0, t * b.a * 3 + b.p, 0);
      dummy.scale.setScalar(show ? 1.4 * beeOn : 0);
      dummy.updateMatrix(); bees.setMatrixAt(i, dummy.matrix);
    });
    bees.instanceMatrix.needsUpdate = true;
    // fog puffs drift around the tile
    const fp = K.cam?.view === 'stroll' ? 0.6 : 1;
    puffData.forEach((u, i) => {
      u.a += u.sp * dt * 6;
      puffs.set(i, Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.2 + u.r) * 0.5, Math.sin(u.a) * u.r, u.w, u.w * 0.45, lerp(0.2, 0.95, fog) * fp);
    });
    puffs.commit();
  }
  // Night glow and sky colour, called by sky.js every frame (g: 0 day .. 1 night).
  function setLight(cur) {
    const g = glowAmt = cur.glow;
    waterMat.color.copy(cur.water);
    faceMat.emissiveIntensity = g * 3.2; barnGlow.emissiveIntensity = g * 1.6; glowMat.emissiveIntensity = g * 1.8;
    lanternMat.emissiveIntensity = g * 3; readoutMat.emissiveIntensity = 0.35 + g * 1.2; bulbMat.emissiveIntensity = 0.15 + g * 3.4; lampMat.emissiveIntensity = 0.4 + g * 4 + Math.sin(toys.lighthouse * PI * 3) ** 2 * 5;
    glowB.mat.uniforms.opacity.value = g * 0.85;
    glowB.mesh.visible = g > 0.02;
    for (const l of nightLights) l.intensity = g * 7;
    beam.visible = g > 0.05; beamMat.opacity = Math.max(0, g - 0.3) * 0.4;
    stars.material.opacity = Math.max(0, g - 0.4) * 1.4; stars.visible = g > 0.4;
    puffs.mat.uniforms.color.value.copy(cur.bg);
  }

  return {
    root, sync, setLight, paintRow, toy, readout, standSign, heroes, scarecrowHat,
    props: { wagon }, heightAt, blocked, pathDist, mazeWallAt, sailCorners,
  };
}
