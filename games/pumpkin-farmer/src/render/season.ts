// The October view [slice: season] (design §7, §12 performance): everything that comes with the crowds.
// - families from the instanced crowd (folk.createCrowd: 10 species x adult/kid, blob shadows, no shadow casting), gliding
//   at their true speed between the sim's once-a-tick positions (kit.glide), bobbing a step at a time; kids trail mom
//   (skunk kits in single file, possum joeys ride on mom, seal pups flump alongside) and keep up with a hop, scamper off to the hay fort while mom
//   waits in line, and hop when they get what they wanted; what each family has picked is visible: a pumpkin in their
//   arms or in their wagon
// - cars exactly where the sim drives them (sim/traffic.js), gliding along their route between ticks: out of Marlene along
//   the one-way lane, pulling up at the patch's open front to let a family out or pick one up, round the bend and up the
//   beach road into the fog (shuttle vans in yellow), sitting on the slope; beach-lot cars nosing into their spaces on the
//   sand and backing out; a few parked at the lot on the fog's edge, the line on Route 46 fading into the fog, U-turns
// - wagons: in the corral (one per free wagon, up to 4), pulled by families, strays in the rows, your restock wagon
// - Pamela the goat, the runaway pumpkin, the lost joey peeking from a hideout, the proposal, Dez and Howie (hires),
//   Gran out on Route 46 directing traffic
// - juice: restock pops along the row, green skunk puffs, Rush floats, coins (fx.js) on RING UP
// Budget: about 10 draw calls on top of the crowd's visible meshes; nothing here casts a shadow but the hero rigs.
import * as THREE from 'three';
import { lerp, damp, ease, glide, Glider, tickKey, gameDt, prepGeo, mergeGeometries, BOX, CYL8, PG, PG_LO, lodFar, PM, M, VC, VARIETY } from './kit.js';
import { makeQuad, makeTownsfolk } from './folk.js';
import { PLACES, HIDEOUTS, ROAD, rowZ, aisleZ } from '../sim/layout.js';
import { pose as carPose } from '../sim/traffic.js';
import { T } from '../sim/tuning.js';
import type { State, OutEvent } from '../sim/types.js';
import type { Kit } from './types.js';
import { Season } from '../sim/state.js';

const CAR_COLS = [0xb5543f, 0x6f8b7b, 0x34445a, 0xe9d18a, 0xa9a8ad, 0xd98aa0, 0x8fb9b1, 0xefe7cf];
const SHUTTLE = 0xe5b84a;
const VCOL = { classic: 0xe0843a, mini: 0xeaa04a, white: 0xebe4d2, warty: 0xc8a24c, cinderella: 0xc4532a, blue: 0x93a7a6 };
const C3 = (hex: THREE.ColorRepresentation|undefined) => new THREE.Color(hex);
const WATER = -0.88, AX = new THREE.Vector3();                   // the sea's surface (world.js)
const SEAL_COATS = 5, coatOf = (f: { species: string; id: number; }) => (f.species === 'seal' ? ((f.id * 2654435761) >>> 0) % SEAL_COATS : 0);   // per family
const turn = (a: number, b: number, k: number) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; };
// gaits: the crowd's bob is one step (pi of phase) per 0.75 world units walked, a kid's hop one per 0.9
const PH_STEP = Math.PI / 0.75, PH_HOP = Math.PI / 0.9, SCAMPER = 4.5;   // a kid running to the fort and back, u/s at 1x
const TPS = T.calendar.weekend.ticksPerSecond, LOT_Z = -6.9;     // the lot's roofs, south of the footpath at Marlene's edge
// the road's mouth on the tile's west edge, the line waiting there and the U-turns out of it (drawCars)
const CC = T.season.car, SPACE = CC.length + CC.gap, MOUTH = ROAD.west, LANE_Z = [ROAD.z, ROAD.zStand];
const LINE_END = -28.5, LINE_IN = -27;            // past here a car in the line is all fog; a newcomer drives up from here
const CREEP = 6, LAG_RATE = 4, IN_LAG = SPACE + 0.5; // u/s at 1x: the line moving up; a newcomer catching up; out of the fog
// the kerb (z): between the stand side's verge, where families wait for their ride, and the patch's front, where they
// step out of it; the line at the till (z -6.05) is not the kerb
const KERB = [ROAD.zStand - 0.9, ROAD.z + 1.1];
const U_ARC = 0.9, U_R = 0.75, U_BACK = 5;        // a U-turn: half a circle in 0.9 s, then back west at 5 u/s
// a car ahead of one swinging round must be this far ahead (its nose sweeps ~1.3 east as it swings south), and so the
// line's first car waits this far back from the mouth: a car coming onto the lane is never in a U-turn's sweep
const U_REACH = SPACE + 0.1, HEAD = U_REACH + 0.2;
const carCol = (f: unknown, id: number) => (f?.park === 'shuttle' ? SHUTTLE : CAR_COLS[id % CAR_COLS.length]);
// kids running between the queue and the hay fort go round the stand's north-west corner, not through the stand
const [SX0, SZ0, SX1, SZ1] = PLACES.stand.rect, STAND_NW = { x: SX0 - 0.35, z: SZ1 + 0.3 };
function aroundStand(x: number, z: number, tx: number, tz: number) {
  for (let k = 1; k < 8; k++) {
    const px = x + ((tx - x) * k) / 8, pz = z + ((tz - z) * k) / 8;
    if (px > SX0 - 0.2 && px < SX1 + 0.2 && pz > SZ0 - 0.2 && pz < SZ1 + 0.2) return STAND_NW;
  }
  return null;
}

// one merged, vertex-coloured geometry from boxes/cylinders: [geo, color, pos, scale, rot]
function build(parts: [any,any,any,any,(number[]|undefined)?][]|((number|any[]|THREE.CylinderGeometry)[]|(number|number[]|THREE.BoxGeometry)[])[]) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  return mergeGeometries(parts.map(([g, col, p, s, r = [0, 0, 0]]) => prepGeo(g, m.compose(new THREE.Vector3(...p), q.setFromEuler(e.set(...r)), new THREE.Vector3(...s)), C3(col))));
}
const WHEELS = (dx: number, dz: number, r: number, w: number) => [[-dx, -dz], [dx, -dz], [-dx, dz], [dx, dz]].map(([x, z]) => [CYL8, 0x2d2a28, [x, r, z], [r, w, r], [Math.PI / 2, 0, 0]]);

export default function createSeasonView(K: Kit) {
  const { scene, folk, hit, fx, phone, world } = K;
  const S = T.season, cap = phone ? S.visibleCap.phone : S.visibleCap.desktop;
  const root = new THREE.Group(); root.name = 'season'; scene.add(root);
  const crowd = folk.createCrowd(K, { adults: cap + 4, kids: cap * 2 + 2 });

  // ---- instanced cars (+x is the nose), wagons and carried pumpkins. A car is 1.5 long and 0.7 wide over its wheels,
  // so two side by side in the road's lanes (0.9 apart) clear each other in the bends too.
  const carGeo = build([
    [BOX, 0xffffff, [0, 0.36, 0], [1.5, 0.42, 0.64]], [BOX, 0x5d6b74, [-0.1, 0.72, 0], [0.82, 0.34, 0.58]],
    [BOX, 0xf3efe2, [0.76, 0.36, 0.2], [0.03, 0.1, 0.13]], [BOX, 0xf3efe2, [0.76, 0.36, -0.2], [0.03, 0.1, 0.13]],
    ...WHEELS(0.48, 0.3, 0.17, 0.1),
  ]);
  const cars = new THREE.InstancedMesh(carGeo, VC, 48);
  cars.count = 0; cars.frustumCulled = false; cars.castShadow = false; cars.receiveShadow = true; root.add(cars);
  const wagonGeo = build([[BOX, 0xa6574a, [0, 0.38, 0], [0.9, 0.26, 0.56]], [BOX, 0x6e4a3a, [0.62, 0.42, 0], [0.4, 0.04, 0.04]], ...WHEELS(0.3, 0.27, 0.15, 0.06)]);
  const wagons = new THREE.InstancedMesh(wagonGeo, VC, 28);
  wagons.count = 0; wagons.frustumCulled = false; wagons.castShadow = false; wagons.receiveShadow = true; root.add(wagons);
  const pumpGeo = PG;
  // PM carries Marlene's fog patch: a plain material gets three's first-person depth fog and draws fog-white from above
  const pumps = new THREE.InstancedMesh(pumpGeo, PM(0xffffff), 80);
  pumps.count = 0; pumps.frustumCulled = false; pumps.castShadow = false; root.add(pumps);
  for (let i = 0; i < 80; i++) pumps.setColorAt(i, C3(0xe0843a));
  for (let i = 0; i < 48; i++) cars.setColorAt(i, C3(0xffffff));
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), EC = new THREE.Euler(0, 0, 0, 'YZX'), P = new THREE.Vector3(), SC = new THREE.Vector3(), COL = new THREE.Color();
  let nCar = 0, nWag = 0, nPump = 0;
  // a car sits on the ground under its wheels: level on the land, pitched and rolled with the beach's slope
  const H = world?.heightAt || (() => 0);
  const putCar = (x: number, z: number, yaw: number, hex: number|undefined, lift = 0) => {
    if (nCar >= cars.instanceMatrix.count) return;
    const fx = Math.cos(yaw) * 0.5, fz = -Math.sin(yaw) * 0.5, sx = -fz * 0.8, sz = fx * 0.8;   // half a wheelbase; half a track
    const hf = H(x + fx, z + fz), hb = H(x - fx, z - fz), hr = H(x + sx, z + sz), hl = H(x - sx, z - sz);
    EC.set(Math.atan2(hl - hr, 1.2), yaw, Math.atan2(hf - hb, 1));
    cars.setMatrixAt(nCar, M4.compose(P.set(x, (hf + hb + hr + hl) / 4 + lift, z), Q.setFromEuler(EC), SC.set(1, 1, 1)));
    cars.setColorAt(nCar++, COL.setHex(hex));
  };
  const putWagon = (x: number, z: number, yaw: number) => {
    if (nWag >= wagons.instanceMatrix.count) return;
    E.set(0, yaw, 0);
    wagons.setMatrixAt(nWag++, M4.compose(P.set(x, world.heightAt?.(x, z) ?? 0, z), Q.setFromEuler(E), SC.set(1, 1, 1)));
  };
  const putPump = (x: number, y: number, z: number, v: string, s = 1) => {
    if (nPump >= pumps.instanceMatrix.count) return;
    const r = (v === 'mini' ? 0.14 : 0.24) * s, sy = VARIETY[v]?.sy ?? 1;
    pumps.setMatrixAt(nPump, M4.compose(P.set(x, (world.heightAt?.(x, z) ?? 0) + y, z), Q.identity(), SC.set(r, r * sy, r)));
    pumps.setColorAt(nPump++, COL.setHex(VCOL[v] || 0xe0843a));
  };

  // A harbor seal noses her pumpkins along in front of her (and her pups their minis): on the ground, rolling with the
  // distance walked about the axis across her heading; out past the water's edge they float.
  const putRoll = (x: number, z: number, v: string, s: number, yaw: number, dist: number) => {
    if (nPump >= pumps.instanceMatrix.count) return;
    const r = (v === 'mini' ? 0.14 : 0.24) * s, sy = VARIETY[v]?.sy ?? 1, g = H(x, z);
    const y = g < WATER - 0.05 ? WATER - r * sy * 0.35 + Math.sin(dist * 3 + x) * 0.02 : g + r * sy;
    Q.setFromAxisAngle(AX.set(Math.cos(yaw), 0, -Math.sin(yaw)), dist / r);
    pumps.setMatrixAt(nPump, M4.compose(P.set(x, y, z), Q, SC.set(r, r * sy, r)));
    pumps.setColorAt(nPump++, COL.setHex(VCOL[v] || 0xe0843a));
  };
  // ...and swims with just her head out of the water: how deep it is under her decides how far she's sunk
  const swimY = (x: any, z: any, kid: boolean) => {
    const g = H(x, z), wet = Math.min(1, Math.max(0, (WATER - g) / 0.3));   // the sea floor is only 0.35 under
    return { y: wet ? lerp(g, WATER - (kid ? 0.5 : 0.95), wet) : undefined, wet };
  };

  // A pelican's pumpkin rides in her pouch (design §7: pelicans never need a wagon): a sagging, stretched sack under the
  // bill, open at the top so the pumpkin peeks out. Placed in crowd-model space: the pouch runs 0.3-0.95 ahead, 1.07-1.25 up.
  const POUCH = { fwd: 0.74, y: 1.0, sag: [0.33, 0.3, 0.4], pumpY: 0.8, pumpS: 1.1 };
  const sacGeo = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58);
  const sacs = new THREE.InstancedMesh(sacGeo, M(0xd29a76, { side: THREE.DoubleSide }), 24);
  sacs.count = 0; sacs.frustumCulled = false; sacs.castShadow = false; root.add(sacs);
  let nSac = 0;
  const putPouch = (x: number, z: number, yaw: number, v: string) => {
    if (nSac >= sacs.instanceMatrix.count) return;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), h = world.heightAt?.(x, z) ?? 0, mini = v === 'mini';
    const k = mini ? 0.8 : 1, [sx, sy, sz] = POUCH.sag;
    E.set(0, yaw, 0);
    sacs.setMatrixAt(nSac++, M4.compose(P.set(x + fx * POUCH.fwd, h + POUCH.y, z + fz * POUCH.fwd), Q.setFromEuler(E), SC.set(sx * k, sy * k, sz * k)));
    putPump(x + fx * (POUCH.fwd + 0.02), POUCH.pumpY + (mini ? 0.06 : 0), z + fz * (POUCH.fwd + 0.02), v, mini ? 0.75 : POUCH.pumpS);
  };

  // ---- characters that come and go
  const goat = makeQuad('pamela'); goat.root.visible = false; scene.add(goat.root);
  const G = { x: 7.5, z: 0, on: false, eat: 0 };
  const runaway = new THREE.Mesh(PG, PM(0xe0843a)), RG = new Glider();
  runaway.scale.setScalar(0.3); runaway.visible = false; runaway.castShadow = true; scene.add(runaway);
  const hires = {};                                                 // dez, howie: built when first hired
  const hireRig = (who: string) => hires[who] ||= (() => { const r = makeTownsfolk(who); scene.add(r.root); return r; })();

  // ---- display state: eased positions, walk phase, kids trailing
  const disp = new Map(), carG = new Map();                         // families; cars' glide along their routes
  const timeline: any[] = [];                                              // delayed fx (restock pops 40 ms apart, puff wisps)
  const shown = new Set(), FR = new THREE.Frustum();                // families drawn (the phone's cap); the camera's view
  const famOf = (se: Season, id: unknown) => { for (const f of se.families) if (f.id === id) return f; return null; };
  const uturns: any[] = [], line = new Map(), colOf = new Map();          // the Route 46 line by key; each car's paint
  let lineKeys: Iterable<any>|null|undefined = [], lineDay = -1, turnedNow = 0;
  const uturnX = (u: { t: number; x: number; }) => (u.t < U_ARC ? u.x + U_R * Math.sin((Math.max(0, u.t) / U_ARC) * Math.PI) : u.x - (u.t - U_ARC) * U_BACK);
  let lastMin = -1, granHeld = false, waveT = 0, beachRows = 0;
  const clk: { t?: number } = {};
  const hitIds = new Set();

  // A family's drawn position glides between the sim's ticks; its speed, heading and walking phase come from what was
  // actually drawn, so the bob keeps time with the ground at 1x, 2x or in bullet time. (Riding in a car, it isn't drawn.)
  function follow(f: unknown, dt: number, gdt: number, key: number, acc: number) {
    let d = disp.get(f.id);
    if (!d) {
      d = { x: f.x, z: f.z, h: f.heading ?? 0, ph: Math.random() * 6, v: 0, g: new Glider(), dist: 0,
        k: [{ x: f.x, z: f.z, ph: Math.random() * 3, v: 0, dist: 0 }, { x: f.x, z: f.z, ph: Math.random() * 3, v: 0, dist: 0 }], hop: 0 };
      disp.set(f.id, d);
    }
    const px = d.x, pz = d.z;
    glide(d.g, f.x, f.z, key, acc);
    d.x = d.g.x; d.z = d.g.z;
    const mx = d.x - px, mz = d.z - pz, m = Math.hypot(mx, mz), jump = m > 3;
    if (!jump) d.v = lerp(d.v, dt > 0 ? m / dt : 0, damp(dt, 14));
    if (m > 1e-4 && !jump) {
      d.h = turn(d.h, Math.atan2(mx, mz), damp(gdt, 12));
      d.ph += m * PH_STEP; d.dist += m;
    } else if (f.heading != null && f.state !== 'car') d.h = turn(d.h, f.heading, damp(gdt, 4));
    d.seen = true;
    return d;
  }

  // dt: real seconds this frame (eases and blends); gdt: game seconds (motion), so 2x is exactly twice as brisk
  function drawFamily(s: State, f: unknown, d: { h: any; v: number; hop: number; x: number|undefined; z: number|undefined; ph: number|undefined; k: any[]; dist: any; }, dt: number, gdt: number) {
    const sp = f.species, yaw = d.h, fwx = Math.sin(yaw), fwz = Math.cos(yaw), sdx = Math.cos(yaw), sdz = -Math.sin(yaw);
    if (f.state === 'maze') return false;                           // lost in the corn
    const speed = f.state === 'pick' ? 0 : d.v * 0.4;
    d.hop = Math.max(0, d.hop - dt);
    if (f.kids?.some((k: { hop: any; }) => k.hop)) d.hop = 1.2;
    const seal = sp === 'seal', coat = coatOf(f), sw = seal ? swimY(d.x, d.z, false) : null;
    crowd.put(sp, false, d.x, d.z, yaw, d.ph, sw?.wet > 0.5 ? 0 : speed, seal ? { coat, y: sw.y, noBlob: sw.wet > 0 } : f.state === 'pick' ? { waddle: 0.05 } : {});
    // kids: possum joeys ride on mom, a sea otter's pup on her chest (in her geometry; the pup's mini sits on mom's tummy);
    // skunk kits single file; others side by side behind. They keep up with a hop, scamper up the hay fort while mom
    // waits in line (f.fort 2) and back, and hop for joy with a pumpkin.
    if (sp === 'otter') { if (f.kids?.[0]?.got && f.kids[0].v) putPump(d.x + fwx * 0.42, 0.62, d.z + fwz * 0.42, f.kids[0].v, 0.7); }
    else if (sp !== 'possum' || f.carpool) {
      const single = sp === 'skunk', fort = f.fort === 2 || f.state === 'fort';
      for (let i = 0; i < (f.kids?.length ?? 2); i++) {
        // seal pups flump alongside mom (her body is long), the others trail behind
        const back = single ? 0.75 + i * 0.6 : seal ? 0.35 : 0.7, side = single ? 0 : (i ? -1 : 1) * (seal ? 0.8 : 0.42);
        let tx = d.x - fwx * back + sdx * side, tz = d.z - fwz * back + sdz * side;
        if (fort) { tx = PLACES.hayfort.x + (i ? 0.5 : -0.5); tz = PLACES.hayfort.z + 0.2; }
        const kd = d.k[i], via = Math.hypot(tx - kd.x, tz - kd.z) > 2 ? aroundStand(kd.x, kd.z, tx, tz) : null;
        if (via) { tx = via.x; tz = via.z; }
        const dx = tx - kd.x, dz = tz - kd.z, dist = Math.hypot(dx, dz);
        let moved = 0;
        if (dist > 12) { kd.x = tx; kd.z = tz; }
        else if (dist > 1e-3) {
          moved = Math.min(dist, SCAMPER * gdt, dist * 6 * gdt + d.v * 0.5 * dt);
          kd.x += (dx / dist) * moved; kd.z += (dz / dist) * moved; kd.dist += moved;
        }
        kd.v = lerp(kd.v, dt > 0 ? moved / dt : 0, damp(dt, 14));
        const going = kd.v > 0.4, happy = d.hop > 0 || f.state === 'in' || (fort && dist < 0.3) || f.state === 'toddler';
        kd.ph += going ? moved * PH_HOP : happy ? gdt * 8 : 0;
        const ky = going && dist > 0.05 ? Math.atan2(dx, dz) : yaw, ksw = seal ? swimY(kd.x, kd.z, true) : null;
        crowd.put(sp, true, kd.x, kd.z, ky, kd.ph + i, ksw?.wet > 0.5 ? 0 : kd.v * 0.4,
          seal ? { coat, y: ksw.y, noBlob: ksw.wet > 0, hop: !going && happy } : { hop: going || happy });
        const kw = f.kids?.[i];
        if (kw?.got && kw.v && seal) putRoll(kd.x + Math.sin(ky) * 0.62, kd.z + Math.cos(ky) * 0.62, kw.v, 0.8, ky, kd.dist);
        else if (kw?.got && kw.v) putPump(kd.x + fwx * 0.18, 0.42, kd.z + fwz * 0.18, kw.v, 0.8);
      }
    }
    // what they've picked: in the wagon, else in mom's arms
    const big = (f.cart || []).filter((c: { kid: any; }) => !c.kid);
    if (f.wagon) {
      const wx = d.x - fwx * 1.0, wz = d.z - fwz * 1.0;
      putWagon(wx, wz, yaw + Math.PI / 2);
      big.slice(0, 3).forEach((c: { v: any; }, i: number) => putPump(wx + sdx * (i - 1) * 0.22, 0.62, wz + sdz * (i - 1) * 0.22, c.v, 0.75));
    } else if (big.length && sp === 'pelican') putPouch(d.x, d.z, yaw, big[0].v);
    else if (big.length && seal) big.slice(0, 2).forEach((c: { v: any; }, i: number, a: string|any[]) => {   // nosed along ahead of her
      const sd = (i - (a.length - 1) / 2) * 0.5;
      putRoll(d.x + fwx * 1.1 + sdx * sd, d.z + fwz * 1.1 + sdz * sd, c.v, 0.85, yaw, d.dist);
    });
    else if (big.length && sp === 'otter') putPump(d.x + sdx * 0.36 + fwx * 0.1, 0.6, d.z + sdz * 0.36 + fwz * 0.1, big[0].v, 0.75);   // her armpit pouch
    else if (big.length) putPump(d.x + fwx * 0.36, 0.78, d.z + fwz * 0.36, big[0].v, 0.85);
    return true;
  }

  // Cars: where the sim drives them. Each glides along its own route between the sim's ticks (so a bend is a smooth
  // swing, not a chord), and points where the road goes: nobody reverses, and two cars are never in one place.
  // Out of Marlene: a car coming onto the tile drives out of the line waiting at the road's mouth (or, for a pick-up from
  // the car park, out of the fog behind it), so it is drawn a little behind where the sim has it (lag) and catches up;
  // on the lane's straight no car is ever drawn closer than a car length and a gap to the one ahead, even for a frame.
  function drawCars(s: State, key: number, acc: number, gdt: number) {
    const se = s.season, fams = new Map(se.families.map((f) => [f.id, f]));
    if (s.clock.day !== lineDay) { lineDay = s.clock.day; line.clear(); lineKeys = []; uturns.length = 0; }
    for (const id of colOf.keys()) if (!se.cars.some((c) => c.id === id)) colOf.delete(id);
    const colFor = (c: unknown) => { let k = colOf.get(c.id); if (k == null) colOf.set(c.id, (k = carCol(fams.get(c.fam), c.fam))); return k; };
    // the line on Route 46 at the patch side's mouth: cars with a space waiting their turn to come in (fog cars, in the
    // order they go), then the cars still waiting for a space (s.season.road.cars), front first
    const fog0 = se.cars.filter((c) => c.q >= 0 && c.r !== 'stand').sort((a, b) => a.q - b.q);
    const keys = [...fog0.map((c) => `c${c.id}`), ...se.road.cars.map((rc) => `r${rc.e[1]}`)];
    const cur = new Set(keys), was = new Set(lineKeys), first = !lineKeys.length && !line.size;
    // a car that found a space keeps its place in the line (it was the front of the road's queue): same car, same spot
    const gone = lineKeys.filter((k) => k[0] === 'r' && !cur.has(k)), fresh = keys.filter((k) => k[0] === 'c' && !was.has(k));
    // (the sim parks the front of the road's queue first, then turns away whoever ran out of patience: the U-turns this
    // frame are the last of the cars gone from it)
    const nU = Math.min(gone.length, turnedNow), parked = gone.slice(0, gone.length - nU).map((k) => line.get(k)).filter(Boolean);
    turnedNow = 0;
    for (const k of fresh) if (parked.length) line.set(k, { ...parked.shift() });
    // ...and one whose driver gave up swings out of the line and back over the ridge (never through the line or another
    // car on its way back: it waits its turn in the line until the way back past it is clear)
    for (const k of gone.slice(gone.length - nU)) { const it = line.get(k); if (it && it.x > LINE_END) uturns.push({ t: -1e-6, x: it.x, col: it.col }); }
    const entered = new Map();
    for (const k of lineKeys) if (!cur.has(k)) { if (k[0] === 'c' && line.has(k)) entered.set(+k.slice(1), line.get(k)); line.delete(k); }
    lineKeys = keys;

    // the road's cars, newcomers lagging back to where they came from
    const lanes = [[], []], drawn = [], k = acc < 0 ? 0 : acc > 1 ? 1 : acc;
    for (const c of se.cars) {
      if (c.q >= 0) continue;                                       // still in Marlene, waiting to come in
      let g = carG.get(c.id);
      if (!g || g.r !== c.r) {
        // a car that went straight from the road's queue onto the lane (its space came free with the mouth clear)
        const from = entered.get(c.id) || (c.r !== 'stand' && c.s < 1.5 && !g ? parked.shift() : null), lag = from ? Math.min(0, Math.max(from.x - MOUTH, -SPACE - 1)) : g || c.s > 1.5 ? 0 : -IN_LAG;
        if (from) colOf.set(c.id, from.col);
        carG.set(c.id, (g = { key, r: c.r, s0: c.s, s1: c.s, lag }));
      }
      if (g.key !== key) { g.key = key; g.s0 = Math.abs(c.s - g.s1) > 3 ? c.s : g.s1; g.s1 = c.s; }
      g.seen = true;
      g.lag = Math.min(0, g.lag + LAG_RATE * gdt);
      g.ds = g.s0 + (g.s1 - g.s0) * k + g.lag;
      g.p = carPose(c, g.ds); g.c = c;
      const sd = c.r === 'stand' ? 1 : 0;
      if (Math.abs(g.p.yaw) < 1e-6 && Math.abs(g.p.z - LANE_Z[sd]) < 1e-3) lanes[sd].push(g);
      drawn.push(g);
    }
    // on each side's straight, front first: nobody is drawn into the car ahead (the lag takes up the difference)
    // (a car about to U-turn, or swinging round, holds its bit of the patch side's lane: whoever's behind waits)
    let rear0 = MOUTH;
    const held = uturns.filter((u) => u.t < U_ARC).map((u) => u.x), lane0: any[] = [];
    const swinging = uturns.filter((u) => u.t >= 0 && u.t < U_ARC).map((u) => u.x + U_REACH);
    lanes.forEach((L, sd) => {
      L.sort((a, b) => b.p.x - a.p.x);
      let ahead = Infinity;
      for (const g of L) {
        if (sd === 0) {
          // just ahead of a car swinging round (inside its nose's reach): drawn no further back than that, if the sim
          // has it there; anyone behind it waits
          for (const x of swinging) if (g.p.x > x - U_REACH && g.p.x < x && g.lag < 0) { const d = Math.min(-g.lag, x - g.p.x); g.lag += d; g.ds += d; g.p = carPose(g.c, g.ds); }
          for (const x of held) if (x > g.p.x - 1e-3) ahead = Math.min(ahead, x);
        }
        if (g.p.x > ahead - SPACE) { const d = ahead - SPACE - g.p.x; g.lag += d; g.ds += d; g.p = carPose(g.c, g.ds); }
        ahead = g.p.x;
        if (sd === 0) { rear0 = Math.min(rear0, g.p.x); lane0.push(g.p.x); }
      }
    });
    for (const g of drawn) putCar(g.p.x, g.p.z, g.p.yaw, colFor(g.c));   // in the sim's order (tools/speeds.mjs reads them so)
    for (const [id, g] of carG) { if (!g.seen) carG.delete(id); g.seen = false; }
    // the lot at Marlene's edge: a few roofs
    for (let i = 0; i < Math.min(3, se.parking.main); i++) putCar(-18.4 + i * 1.25, LOT_Z, Math.PI / 2, CAR_COLS[(i * 3 + 1) % CAR_COLS.length]);
    // the line itself, creeping up a car at a time and fading into the fog at the mouth (fog.js): a car length and a gap
    // apart, behind the last car on the lane, and behind anyone still swinging out of it
    let limit = rear0 - SPACE;
    keys.forEach((key2, i) => {
      const tgt = MOUTH - HEAD - SPACE * i;
      let it = line.get(key2);
      if (!it) {
        const col = key2[0] === 'c' ? colFor(fog0.find((c) => `c${c.id}` === key2)) : CAR_COLS[(+key2.slice(1) * 5 + 2) % CAR_COLS.length];
        line.set(key2, (it = { x: first ? Math.min(tgt, limit) : Math.min(tgt, limit, LINE_IN), col }));
      }
      it.x = Math.min(tgt, it.x + CREEP * gdt);
      for (const u of uturns) if (u.t < U_ARC && u.x > it.x - 1e-3) limit = Math.min(limit, u.x - SPACE);
      it.x = Math.min(it.x, limit);
      limit = it.x - SPACE;
      if (it.x > LINE_END) putCar(it.x, ROAD.z, 0, it.col);
    });
    // U-turns: out of the line to the south (away from the stand's lane), round, and back west into the fog
    for (let i = uturns.length - 1; i >= 0; i--) {
      const u = uturns[i];
      if (u.t < 0) {                                                // waiting: anyone out ahead of it still to come by?
        // (and room to swing: its nose sweeps a car length east of where it stands)
        if (uturns.some((o) => o !== u && o.t >= 0 && uturnX(o) > u.x - SPACE) || lane0.some((x) => x > u.x - SPACE && x < u.x + U_REACH)) { putCar(u.x, ROAD.z, 0, u.col); continue; }
        u.t = 0;
      }
      u.t += gdt;
      if (u.t < U_ARC) { const a = (u.t / U_ARC) * Math.PI; putCar(u.x + U_R * Math.sin(a), ROAD.z + U_R * (1 - Math.cos(a)), -a, u.col); continue; }
      const x = u.x - (u.t - U_ARC) * U_BACK;
      if (x < LINE_END) { uturns.splice(i, 1); continue; }
      putCar(x, ROAD.z + 2 * U_R, Math.PI, u.col);
    }
  }

  function drawWagons(s: State) {
    const W = s.season.wagons;
    for (let i = 0; i < Math.min(4, W.free); i++) putWagon(PLACES.corral.x + (i % 2) * 0.35 - 0.2, PLACES.corral.z + Math.floor(i / 2) * 0.62 - 0.3, 0.2 + i * 0.12);
    for (const w of W.strays) putWagon(w.x, w.z, (w.x * 7) % 3);
    // your restock wagon, loaded, behind you
    const F = K.cast.farmer;
    if (s.season.farmer.carry === 'wagon' && F) {
      const r = F.root, yaw = r.rotation.y, bx = r.position.x - Math.sin(yaw) * 0.95, bz = r.position.z - Math.cos(yaw) * 0.95;
      putWagon(bx, bz, yaw + Math.PI / 2);
      for (let i = 0; i < 4; i++) putPump(bx + Math.cos(yaw) * (i % 2 ? 0.16 : -0.16), 0.6 + (i > 1 ? 0.14 : 0), bz - Math.sin(yaw) * (i % 2 ? 0.16 : -0.16), 'classic', 0.7);
    }
  }

  // Pamela ambles in from the beach and between rows (~1.5-2 u/s), and trots off when you shoo her (up to 4 u/s).
  function drawGoat(s: State, dt: number, gdt: number) {
    const g = s.season.goat;
    if (!g && !G.on) { goat.root.visible = false; G.v = 0; return; }
    if (g && !G.on) { G.on = true; G.x = 8; G.z = g.z; goat.root.visible = true; }
    const tx = g ? g.x : 9, tz = g ? g.z : G.z;
    const dx = tx - G.x, dz = tz - G.z, d = Math.hypot(dx, dz), sp = Math.min(d, Math.min(4, 1.1 + d * 1.2) * gdt);
    if (d > 0.02) { G.x += dx / d * sp; G.z += dz / d * sp; goat.root.rotation.y = turn(goat.root.rotation.y, Math.atan2(dx, dz), damp(dt, 8)); }
    G.v = lerp(G.v || 0, dt > 0 ? sp / dt : 0, damp(dt, 14));
    goat.root.position.set(G.x, 0, G.z);
    goat.animate(dt, G.v, { sniff: d < 0.05, happy: true });
    if (!g && d < 0.2) { G.on = false; goat.root.visible = false; }
  }

  function syncHits(s: State) {
    const live = new Set(), se = s.season;
    const add = (box: { kind: string; id: number; rect: number[]; priority: number; }|{ kind: string; id: string; rect: number[]; priority: number; circle?: undefined; }|{ kind: string; id: string; circle: number[]; priority: number; rect?: undefined; }, pr = 3) => { hit.add(box, pr); live.add(`${box.kind}:${box.id}`); };
    if (s.unlocks.wants || s.clock.year > 1) for (const f of se.families) {
      if (f.state !== 'want' || f.bubble?.kind !== 'want') continue;
      const d = disp.get(f.id); if (d) add({ kind: 'family', id: f.id, circle: [d.x, d.z, 0.7], y: [0, 2] });
    }
    for (const w of se.wagons.strays) add({ kind: 'wagon', id: w.id, circle: [w.x, w.z, 0.6], y: [0, 0.8] });
    if (se.goat && G.on) add({ kind: 'goat', id: 'goat', circle: [G.x, G.z, 0.7], y: [0, 1.2] }, 4);
    if (se.runaway) add({ kind: 'runaway', id: 'runaway', circle: [runaway.position.x, runaway.position.z, 0.8], y: [0, 0.8] }, 4);
    const j = s.events.active.find((a) => a.id === 'lost_joey');
    if (j) add({ kind: 'joey', id: 'joey', circle: [j.x, j.z, 0.9], y: [0, 1.2] }, 4);
    for (const k of hitIds) if (!live.has(k)) { const [kind, id] = k.split(':'); hit.remove(kind === 'family' ? +id : id, kind); }
    hitIds.clear(); for (const k of live) hitIds.add(k);
  }

  const lod = { far: false };
  function sync(s: State, dt: number) {
    pumps.geometry = lodFar(lod, K.cam?.pxPerUnit ?? Infinity) ? PG_LO : PG;   // pumpkins in arms and wagons (render/patch.js)
    nCar = 0; nWag = 0; nPump = 0; nSac = 0;
    crowd.begin();
    const se = s?.season, oct = s?.clock?.phase === 'october';
    world.props?.wagon && (world.props.wagon.visible = !oct);
    const weekend = oct && s.clock.sub !== 'weekday' && s.clock.minute >= T.calendar.weekend.open;
    if (!weekend || !se) {
      disp.clear(); shown.clear(); crowd.end(); finish(); goat.root.visible = false; G.on = false; runaway.visible = false;
      if (granHeld) { K.cast.hold('gran', false); granHeld = false; }
      for (const h of Object.values(hires)) h.root.visible = false;
      for (const k of hitIds) { const [kind, id] = k.split(':'); hit.remove(kind === 'family' ? +id : id, kind); }
      hitIds.clear();
      if (oct && se) { drawWagons(s); finish(); }
      return;
    }
    if (s.clock.minute !== lastMin) lastMin = s.clock.minute;
    const gdt = gameDt(clk, s, dt, TPS);
    const key = tickKey(s), acc = s.clock.acc || 0;
    for (const d of disp.values()) d.seen = false;
    // Who is drawn (the phone draws at most `cap` families on foot): a family keeps its place until it gets in its car
    // (or vanishes into the corn); a newcomer only takes a free place where nobody sees it pop in: stepping out of its car,
    // at the kerb, or off screen. So on a heat wave nobody blinks in or out mid-field.
    for (const id of shown) { const f = famOf(se, id); if (!f || f.state === 'car' || f.state === 'maze') shown.delete(id); }
    if (shown.size < cap) {
      FR.setFromProjectionMatrix(M4.multiplyMatrices(K.cam.active.projectionMatrix, K.cam.active.matrixWorldInverse));
      for (const f of se.families) {
        if (shown.size >= cap) break;
        if (shown.has(f.id) || f.state === 'car' || f.state === 'maze') continue;
        if ((f.z < KERB[1] && f.z > KERB[0]) || !FR.containsPoint(P.set(f.x, 0.6, f.z))) shown.add(f.id);
      }
    }
    for (const f of se.families) {
      const d = follow(f, dt, gdt, key, acc);
      if (shown.has(f.id)) drawFamily(s, f, d, dt, gdt);
      else for (const kd of d.k) { kd.x = d.x; kd.z = d.z; kd.v = 0; }   // (undrawn: its kids stay with it, ready to be drawn)
    }
    for (const [id, d] of disp) if (!d.seen) disp.delete(id);
    // the lost joey peeks out of his hideout; the proposal's fox couple
    const j = s.events.active.find((a) => a.id === 'lost_joey');
    if (j) crowd.put('possum', true, j.x, j.z, Math.sin(K.t() * 2) * 0.6, K.t() * 4, 0.3, { hop: Math.sin(K.t() * 3) > 0.6 });
    const pr = s.events.active.find((a) => a.id === 'proposal');
    if (pr) { crowd.put('fox', false, pr.x - 0.4, pr.z, Math.PI / 2, 0, 0); crowd.put('fox', false, pr.x + 0.4, pr.z, -Math.PI / 2, 0, 0, { scale: 0.86 }); }
    drawCars(s, key, acc, gdt);
    drawWagons(s);
    drawGoat(s, dt, gdt);
    // the runaway pumpkin rolls toward the beach (~2 u/s), turning as far as it rolls
    if (se.runaway) {
      if (!runaway.visible) { RG.key = undefined; runaway.position.x = se.runaway.x; }
      runaway.visible = true;
      const x0 = runaway.position.x;
      glide(RG, se.runaway.x, -3.9, key, acc);
      runaway.position.set(RG.x, 0.22 + (world.heightAt?.(RG.x, -3.9) ?? 0), -3.9);
      runaway.rotation.z -= (RG.x - x0) / 0.3;
    } else runaway.visible = false;
    // Gran on Route 46 with her clipboard
    if (se.gran.direct !== granHeld) {
      granHeld = se.gran.direct; K.cast.hold('gran', granHeld);
      const g = K.cast.gran;
      if (g) { const p = granHeld ? { x: -17.3, z: -3.0 } : PLACES.gran; fx.dust(g.root.position.x, g.root.position.z); g.root.position.set(p.x, 0, p.z); fx.dust(p.x, p.z); }
    }
    if (granHeld && (waveT -= dt) <= 0) { waveT = 2.4; K.cast.fx?.({ type: 'cast', who: 'gran', act: 'wave', secs: 1.4 }); if (K.cast.gran) K.cast.gran.root.rotation.y = -Math.PI / 2; }
    // hires at work: Dez at the till (or in the hay fort), Howie waving cars in
    const hired = (who: string) => s.hires?.[who] === s.clock.year;
    for (const who of ['dez', 'howie']) {
      if (!hired(who)) { if (hires[who]) hires[who].root.visible = false; continue; }
      const r = hireRig(who);
      r.root.visible = true;
      const p = who === 'dez' ? (se.dez.away ? { x: PLACES.hayfort.x + 0.6, z: PLACES.hayfort.z + 0.9 } : { x: -4.15, z: -7.5 }) : { x: -16.6, z: -2.95 };
      r.root.position.set(p.x, 0, p.z); r.root.rotation.y = who === 'dez' ? 0.3 : -Math.PI / 2;
      r.animate(dt, 0, who === 'howie' ? { wave: se.road.q > 0 } : { nod: se.queue.length > 0 });
    }
    // delayed pops and wisps
    for (let i = timeline.length - 1; i >= 0; i--) { const e = timeline[i]; e.t -= dt; if (e.t <= 0) { e.fn(); timeline.splice(i, 1); } }
    crowd.end();
    finish();
    syncHits(s);
  }
  function finish() {
    cars.count = nCar; cars.instanceMatrix.needsUpdate = true; if (cars.instanceColor) cars.instanceColor.needsUpdate = true; cars.visible = nCar > 0;
    wagons.count = nWag; wagons.instanceMatrix.needsUpdate = true; wagons.visible = nWag > 0;
    pumps.count = nPump; pumps.instanceMatrix.needsUpdate = true; if (pumps.instanceColor) pumps.instanceColor.needsUpdate = true; pumps.visible = nPump > 0;
    sacs.count = nSac; sacs.instanceMatrix.needsUpdate = true; sacs.visible = nSac > 0;
  }

  // read-only handles for tools/speeds.mjs (what is drawn where, frame by frame)
  K.seasonView = { disp, shown, goat: G, runaway: runaway.position };
  const later = (t: number, fn: { (): void; (): void; }) => timeline.push({ t, fn });
  function fxEvent(ev: OutEvent) {
    switch (ev.type) {
      case 'patch/restock': {
        if (ev.by !== 'farmer' && ev.by !== 'bea') break;
        const z = rowZ(ev.row), n = Math.min(12, ev.n);
        for (let i = 0; i < n; i++) later(i * 0.04, () => fx.pop(-8 + (i / Math.max(1, n - 1)) * 13, 0.35, z, 0xe6913f, 4));
        break;
      }
      case 'season/served': {
        if (ev.by !== 'you') { fx.sparkle(-5, 1.2, -6.6, 3); break; }
        fx.float(`+$${Math.round(ev.amount)}`, -5, 1.9, -6.4, 'good');
        fx.sparkle(-5, 1.3, -6.5, 5);
        break;
      }
      case 'season/rush': fx.float(`Rush ×${ev.n}!`, -4.4, 2.6, -6.6, ev.n >= 3 ? 'good big' : 'good'); break;
      case 'season/walkoff': fx.float('Hmph.', ev.x, 1.8, ev.z, 'bad'); break;
      case 'season/answer': if (ev.ok && ev.x != null) fx.sparkle(ev.x, 1, ev.z, 6); break;
      case 'season/puff':
        fx.pop(ev.x, 0.6, ev.z, 0x8fbf6a, 18);
        for (let i = 0; i < 10; i++) later(i * 0.12, () => fx.dust(ev.x + Math.sin(i * 2.3) * 1.6, ev.z + Math.cos(i * 1.7) * 1.6, 0x9cc17a));
        break;
      case 'season/goat':
        if (ev.state === 'eat') fx.pop(ev.x, 0.3, ev.z, 0xe0843a, 5);
        if (ev.state === 'dodge') goat.trick?.('hop');
        break;
      case 'season/splash': fx.pop(ev.x, WATER + 0.1, ev.z, 0xe4f0ee, 10); fx.ripple?.(ev.x, ev.z, 0xcfe3e0, WATER + 0.03); break;
      case 'season/raft': fx.sparkle(ev.x, 1, ev.z, 8); fx.float('Holding paws!', ev.x, 1.8, ev.z, 'good'); break;
      case 'season/joey': if (ev.state === 'found') { fx.sparkle(ev.x, 0.6, ev.z, 10); fx.float('Pip!', ev.x, 1.4, ev.z, 'good big'); } break;
      case 'season/runaway':
        if (ev.state === 'saved') fx.sparkle(ev.x, 0.5, ev.z, 8);
        if (ev.state === 'splash') fx.spout?.(9.8, -0.8, -3.9);
        break;
      case 'season/car': if (ev.kind === 'uturn') turnedNow++; break;
      case 'season/lever': if (ev.id === 'beach' && ev.on) fx.ripple?.(9.8, -2, 0xe9d18a); break;
    }
  }

  return {
    sync, fx: fxEvent,
    dispose() {
      crowd.dispose(); scene.remove(root); carGeo.dispose(); wagonGeo.dispose(); pumps.material.dispose(); sacs.geometry.dispose(); sacs.material.dispose();
      goat.dispose(); scene.remove(runaway); runaway.material.dispose();
      for (const h of Object.values(hires)) h.dispose();
      for (const k of hitIds) { const [kind, id] = k.split(':'); hit.remove(kind === 'family' ? +id : id, kind); }
    },
  };
}
