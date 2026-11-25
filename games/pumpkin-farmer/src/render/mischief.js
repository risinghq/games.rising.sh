// [Track A] The visitors' view (plan §3.2, §3.3; rulings R4): Biscuit and Grandpa's old biscuit tin, the harbor seal (Biscuit
// guarding her), the otter and her pup in the cove (and floating in with every kelp bundle), the possum mom who keels over
// with her joeys beside her, the skunk family under the sail with their tails up like parasols, Pamela the goat, the bees on
// the scarecrow's hat, and Gran's washing line. Reads s.mischief (src/sim/mischief.js) and never mutates it.
//
// The sim says who is here and where; the walking in and out is render-only timing (a visitor strolls in from its
// MISCHIEF_ENTRY point in a few real seconds, does its pose, and strolls out when the sim lets it go). At most three
// visitors are on screen (a visitor, Pamela, and the otter's kelp run), each built the first time it is needed and kept.
// fx: mischief/look (a ✦ tap: the visitor's one animation, after the camera's glide), mischief/startle (a green puff, they
// bolt), mischief/whistle (Biscuit runs to Pamela and walks her home), mischief/leave, event 'kelp' (the otter delivers).
// Tap: each visitor is a hitbox (kind 'visitor'): tapping the seal is the same as tapping her ✦ (ui/mischief.js).
import * as THREE from 'three';
import { PI, clamp, lerp, damp, part, C, M, ICO0, ICO1, CYL, BOX, mergeLocal, pool, hideAt } from './kit.js';
import { makeFolk, makeQuad, addJoeys, addPup } from './folk.js';
import { MISCHIEF_ENTRY as ENTRY, SWARM_SPOTS, PLACES } from '../sim/layout.js';
import { COATS } from '../sim/lines-mischief.js';

const LOOK_DELAY = 0.6;                                 // the camera's glide (ui/mischief.js) before the visitor's animation
const HERD_FROM = 8;                                    // a whistled Biscuit runs in from at most this far (just outside the frame)
const SPEED = { walk: 1.1, trot: 2.2, run: 4.5, float: 0.9, flump: 0.7 };
const turnTo = (o, a, k) => { const d = Math.atan2(Math.sin(a - o.rotation.y), Math.cos(a - o.rotation.y)); o.rotation.y += d * k; };
const TEA = 0xefe8da;                                   // a tea towel's cream
const WATER_Y = -0.88;                                 // the sea's surface (world.js)

export default function createMischiefView(K) {
  const { scene, hit, fx } = K;
  const root = new THREE.Group(); root.name = 'mischief'; scene.add(root);
  const ground = (x, z) => K.world?.heightAt?.(x, z) ?? 0;
  const rigs = {};                                      // built lazily, kept
  const actors = new Map();                             // key -> actor
  let biscuitBy = null;                                 // who holds Biscuit right now ('dig' | 'seal' | 'otter' | 'herd')

  // ------------------------------------------------------------ props
  // Grandpa's old biscuit tin: rusty red, a cream label band, a lid that pops off when you look
  const tin = new THREE.Group();
  part(CYL, M(0x9a4a32, { roughness: 0.8 }), [0, 0.12, 0], [0.22, 0.24, 0.22], [0, 0, 0], tin);
  part(CYL, M(0xe8dcc0), [0, 0.12, 0], [0.225, 0.09, 0.225], [0, 0, 0], tin);
  const lid = part(CYL, M(0x7d3a27, { roughness: 0.7 }), [0, 0.255, 0], [0.235, 0.035, 0.235], [0, 0, 0], tin);
  tin.visible = false; root.add(tin);
  // Gran's washing line by the cottage: two posts, a line, a tea towel, and (until Pamela gets it) her good purple shawl
  const wash = new THREE.Group(), W = ENTRY.spots.washing;
  wash.position.set(W.x, 0, W.z);
  const wood = C(0x8d7458);
  for (const dx of [-1.1, 1.1]) part(CYL, wood, [dx, 0.6, 0], [0.04, 1.2, 0.04], [0, 0, 0], wash);
  part(CYL, C(0xd9d2c4), [0, 1.13, 0], [0.008, 2.2, 0.008], [0, 0, PI / 2], wash);
  part(BOX, C(TEA), [0.55, 0.95, 0], [0.32, 0.34, 0.02], [0, 0, 0], wash);
  part(BOX, C(0xb5543f), [0.55, 0.86, 0.012], [0.32, 0.03, 0.005], [0, 0, 0], wash);
  mergeLocal(wash);
  const shawl = part(BOX, M(0x9d86b8), [-0.4, 0.88, 0], [0.62, 0.5, 0.02], [0, 0, 0.04], wash);
  root.add(wash);
  // the bees on the scarecrow's hat (a look-only swarm, year 1 before the honey lesson)
  const BEES = 22, bees = pool(ICO0, M(0xe8b64a, { emissive: 0x3a2600, emissiveIntensity: 0.3 }), BEES, false, root);
  const beeM = new THREE.Matrix4(), beeQ = new THREE.Quaternion(), beeP = new THREE.Vector3(), beeS = new THREE.Vector3();

  // ------------------------------------------------------------ rigs
  function rig(key) {
    if (rigs[key]) return rigs[key];
    let r;
    if (key.startsWith('seal')) r = makeFolk('seal', { coat: Math.max(0, COATS.indexOf(key.split(':')[1])) });
    else if (key === 'otter') r = addPup(makeFolk('otter'));
    else if (key === 'possum') r = addJoeys(makeFolk('possum'));
    else if (key === 'pamela') r = makeQuad('pamela');
    else if (key === 'skunk') r = makeFolk('skunk');
    else if (key.startsWith('kit')) r = makeFolk('skunk', { kid: true });
    r.root.visible = false; root.add(r.root);
    return (rigs[key] = r);
  }
  // An actor walks in from `from` to its spot, stays, and walks out to `to` when its visit ends.
  function actor(key, rigKey, from, spot, opts = {}) {
    let a = actors.get(key);
    if (a) { a.spot = spot; return a; }
    const r = rig(rigKey);
    a = { key, rig: r, pos: new THREE.Vector3(from.x, 0, from.z), from, spot, to: opts.to || from, state: 'in', speed: opts.speed || SPEED.walk,
      look: -1, k: 0, t: 0, vel: 0, opts };
    // a visitor who was already here before this view saw her (a reload, a jump) is simply there, not walking in
    if (spot.day != null && spot.day < today) { a.pos.set(spot.x, 0, spot.z); a.state = 'here'; a.k = 1; }
    r.root.visible = true; r.root.position.copy(a.pos);
    actors.set(key, a);
    return a;
  }
  function leave(key) {
    const a = actors.get(key);
    if (!a || a.state === 'out') return;
    a.state = 'out'; a.k = 0;
    if (key === 'possum') joeysOn(a);                     // she comes back to life and the joeys climb back on
  }
  // step toward (x, z) at speed; true on arrival
  function step(a, x, z, speed, dt) {
    a.tx = x; a.tz = z;                                   // (where she's headed: a ✦ tap brings her straight there, fxEvent)
    const dx = x - a.pos.x, dz = z - a.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.04) { a.vel = lerp(a.vel, 0, damp(dt, 10)); return true; }
    const s = Math.min(d, speed * dt);
    a.pos.x += (dx / d) * s; a.pos.z += (dz / d) * s;
    a.vel = lerp(a.vel, s / Math.max(dt, 1e-4), damp(dt, 10));
    turnTo(a.rig.root, Math.atan2(dx, dz), damp(dt, 8));
    return false;
  }
  const place = (a, y = 0) => a.rig.root.position.set(a.pos.x, ground(a.pos.x, a.pos.z) + y, a.pos.z);

  // ------------------------------------------------------------ Biscuit (cast.js lends him: K.cast.hold)
  const dog = { pos: new THREE.Vector3(), vel: 0, goal: null, sit: false };
  function takeBiscuit(by) {
    const b = K.cast?.biscuit;
    if (!b) return null;
    if (biscuitBy !== by) { if (!biscuitBy) dog.pos.copy(b.root.position); biscuitBy = by; K.cast.hold('biscuit', true); }
    return b;
  }
  function freeBiscuit(by) { if (biscuitBy === by) { biscuitBy = null; K.cast?.hold('biscuit', false); } }
  function dogTo(x, z, dt, speed = SPEED.trot, opts = {}) {
    const b = K.cast.biscuit, dx = x - dog.pos.x, dz = z - dog.pos.z, d = Math.hypot(dx, dz);
    let v = 0;
    if (d > 0.05) { const s = Math.min(d, speed * dt); dog.pos.x += (dx / d) * s; dog.pos.z += (dz / d) * s; v = s / Math.max(dt, 1e-4); turnTo(b.root, Math.atan2(dx, dz), damp(dt, 10)); }
    else if (opts.face) turnTo(b.root, Math.atan2(opts.face.x - dog.pos.x, opts.face.z - dog.pos.z), damp(dt, 4));
    dog.vel = lerp(dog.vel, v, damp(dt, 12));
    b.root.position.set(dog.pos.x, ground(dog.pos.x, dog.pos.z), dog.pos.z);
    b.animate(dt, dog.vel, { sit: d <= 0.05 && opts.sit, happy: opts.happy ?? true, sniff: opts.sniff && d <= 0.05 });
    return d <= 0.05;
  }

  // ------------------------------------------------------------ per frame
  let herd = null;                                      // Biscuit walking Pamela home: { t, x, z }
  const digLook = { look: -1 };                         // the tin's lid after a ✦ tap
  let courier = null;                                   // the otter floating in with a kelp bundle: { t }
  let lastSig = '';
  let today = 0;
  function sync(s, dt, t) {
    const m = s?.mischief, grow = s?.clock?.phase === 'grow';
    today = s?.clock?.day ?? 0;
    const v = grow ? m?.visit : null, pv = grow ? m?.pamela?.visit : null;
    // Gran's washing line and her shawl (cast.js swaps the shawl for a tea towel on Gran herself)
    shawl.visible = !(m?.pamela?.shawl);
    K.cast?.granTeaTowel?.(!!m?.pamela?.shawl);
    // ---- the visitor
    const want = new Set();
    if (v) {
      const id = v.id;
      if (id === 'biscuit_dig') { want.add('dig'); digSync(v, dt); }
      if (id === 'seal_haulout') { want.add('seal'); sealSync(v, dt); }
      if (id === 'otter_look') { want.add('otter'); otterSync(v, dt); }
      if (id === 'possum_nap') { want.add('possum'); possumSync(v, dt); }
      if (id === 'skunk_shade') { want.add('skunk'); want.add('kit1'); want.add('kit2'); skunkSync(v, dt); }
    }
    if (pv) { want.add('pamela'); pamelaSync(pv, dt); } else if (herd && !herd.off) want.add('pamela');   // (she waits for Biscuit)
    if (!want.has('dig')) { tin.visible = false; freeBiscuit('dig'); }
    if (!want.has('seal')) freeBiscuit('seal');
    if (!want.has('otter')) freeBiscuit('otter');
    for (const [key, a] of actors) if (!want.has(key) && a.state !== 'out') leave(key);
    if (herd) herdSync(dt);
    if (courier) courierSync(dt);
    // ---- everyone walking out, and the animation of everyone here
    for (const [key, a] of actors) {
      if (a.state === 'out') {
        const exit = a.flee || a.to, done = step(a, exit.x, exit.z, a.flee ? SPEED.run : a.speed * 1.2, dt);
        if (a.key === 'otter' || a.key === 'courier') float(a, t); else place(a);
        if (key !== 'otter' && key !== 'courier') { a.rig.root.rotation.x = lerp(a.rig.root.rotation.x, 0, damp(dt, 6)); a.rig.root.rotation.z = lerp(a.rig.root.rotation.z, 0, damp(dt, 6)); }
        a.rig.animate(dt, a.vel, {});
        if (done) { a.rig.root.visible = false; actors.delete(key); hit.remove(`visitor:${key}`, 'visitor'); }
      }
    }
    // ---- the bees on the scarecrow
    const sw = grow && m?.look?.id === 'swarm' ? SWARM_SPOTS.scarecrow : null;
    for (let i = 0; i < BEES; i++) {
      if (!sw) { hideAt(bees, i); continue; }
      const a = t * (2.2 + (i % 5) * 0.4) + i * 2.4, rr = 0.25 + (i % 4) * 0.08, y = sw.y + 0.25 + Math.sin(a * 1.7 + i) * 0.18;
      bees.setMatrixAt(i, beeM.compose(beeP.set(sw.x + Math.cos(a) * rr, y, sw.z + Math.sin(a * 1.1) * rr), beeQ.identity(), beeS.setScalar(0.055)));
    }
    bees.instanceMatrix.needsUpdate = true; bees.visible = !!sw;
    // tap targets: each visitor here is a hitbox (the ✦ pin is the affordance; the visitor itself answers too)
    const sig = [...actors.values()].filter((a) => a.state !== 'out').map((a) => `${a.key}:${a.pos.x.toFixed(1)},${a.pos.z.toFixed(1)}`).join('|');
    if (sig !== lastSig) {
      lastSig = sig;
      for (const a of actors.values()) if (a.state !== 'out' && a.key !== 'courier') hit.add({ kind: 'visitor', id: `visitor:${a.key}`, circle: [a.pos.x, a.pos.z, 0.7], y: [0, 1.4] }, 5);
    }
  }
  // afloat: on the sea's surface (world.js: y -0.88), or on the sand where the beach rises above it
  const float = (a, t) => a.rig.root.position.set(a.pos.x, Math.max(ground(a.pos.x, a.pos.z), WATER_Y) - 0.06 + Math.sin(t * 1.3 + a.pos.x) * 0.04, a.pos.z);
  // how far through the visitor's one animation after a ✦ tap (0 .. 1), or -1
  function lookK(a, dt, dur = 1.6) {
    if (a.look < 0) return -1;
    a.look += dt;
    if (a.look < LOOK_DELAY) return -1;
    const k = (a.look - LOOK_DELAY) / dur;
    if (k >= 1) { a.look = -1; return -1; }
    return k;
  }

  // ---- Biscuit digs up the tin, and sits by it until you look
  function digSync(v, dt) {
    const fresh = biscuitBy !== 'dig', b = takeBiscuit('dig');
    if (!b) return;
    // (he's been at it since dawn: the ✦ goes up with the dig, so a tap at once must find him there, not trotting over)
    if (fresh) dog.pos.set(v.x, 0, v.z);
    const at = dogTo(v.x, v.z, dt, SPEED.trot, { sit: true, face: { x: v.x, z: v.z - 1 } });
    tin.visible = at; tin.position.set(v.x - 0.4, 0, v.z + 0.35);      // (in front of him, as the camera sees it)
    const k = lookK(digLook, dt);
    lid.position.y = 0.255 + (k >= 0 ? Math.sin(Math.min(1, k * 2) * PI) * 0.35 : 0);
    lid.rotation.z = k >= 0 ? k * 2.5 : 0;
  }
  // ---- the seal: flumps up out of the sea to her spot, lies down; Biscuit sits a metre off, guarding her
  function sealSync(v, dt) {
    const key = `seal:${v.coat || 'silver'}`;
    let a = actors.get('seal');
    if (a && a.rigKey !== key) { a.rig.root.visible = false; actors.delete('seal'); a = null; }
    if (!a) { a = actor('seal', key, ENTRY.seal.from, v, { speed: SPEED.flump }); a.rigKey = key; }
    const here = a.state === 'here' || step(a, v.x, v.z, a.speed, dt);
    if (here) a.state = 'here';
    place(a, here ? -0.08 : 0);
    const k = lookK(a, dt, 1.2);
    a.rig.animate(dt, here ? 0 : a.vel, { look: here ? Math.sin(a.t += dt) * 0.4 : 0, hop: k >= 0, nod: k >= 0 });
    a.rig.body.rotation.x = here && k < 0 ? 0.08 : a.rig.body.rotation.x;
    if (k >= 0) a.rig.head.rotation.x = -0.5 * Math.sin(k * PI);
    if (takeBiscuit('seal')) dogTo(v.x - 1.1, v.z - 0.6, dt, SPEED.trot, { sit: true, face: v, happy: false });
  }
  // ---- the otter: floats in on her back with her pup on her chest, rocks on the swell; Biscuit runs to the shore, barks
  function otterSync(v, dt) {
    const a = actors.get('otter') || actor('otter', 'otter', ENTRY.otter.from, v, { speed: SPEED.float, to: ENTRY.otter.to });
    const here = step(a, v.x, v.z, a.speed, dt);
    float(a, (a.t += dt));
    a.rig.root.rotation.x = lerp(a.rig.root.rotation.x, -1.25, damp(dt, 3));       // on her back
    const k = lookK(a, dt);
    a.rig.animate(dt, 0, { wave: k >= 0 });
    if (here && takeBiscuit('otter')) {
      const at = dogTo(PLACES.beach.x0 + 1.4, v.z - 0.2, dt, SPEED.run, { face: v });
      if (at && Math.random() < dt * 1.5) K.cast.biscuit.trick('bark');
    }
  }
  // ---- the possum: out of the corn, sees Biscuit, keels over in the aisle; the joeys hop off and sit beside her
  function possumSync(v, dt) {
    const a = actors.get('possum') || actor('possum', 'possum', ENTRY.possum.from, v, { speed: SPEED.walk });
    const r = a.rig, here = a.state === 'here' || step(a, v.x, v.z, a.speed, dt);
    if (here && a.state !== 'here') { a.state = 'here'; a.k = 0; joeysOff(a); }
    a.k = here ? Math.min(1, a.k + dt / 0.4) : 0;                                    // keeling over takes 0.4 s
    place(a, here ? 0.18 * a.k : 0);
    r.root.rotation.z = (PI / 2) * a.k;
    r.animate(dt, here ? 0 : a.vel, here ? { armsFixed: true } : {});
    if (here) { r.legs.forEach((l) => (l.rotation.x = 0.2)); r.arms.forEach((x) => (x.rotation.x = -0.3)); }
    const k = lookK(a, dt, 2);
    for (const [i, j] of (a.joeys || []).entries()) {
      j.animate(dt, 0, { wave: i === 0 && k >= 0, look: Math.sin(a.t += dt * 0.5) * 0.4 });
    }
  }
  function joeysOff(a) {
    const mom = a.rig;
    a.joeys = mom.joeys.map((j, i) => {
      root.attach(j.root);
      j.root.position.set(a.pos.x + 0.35 + i * 0.32, ground(a.pos.x, a.pos.z), a.pos.z + 0.45 - i * 0.1);
      j.root.rotation.set(0, PI + 0.3 - i * 0.6, 0);
      j.root.scale.setScalar(0.5 * 1.25);
      return j;
    });
  }
  function joeysOn(a) {
    for (const j of a.joeys || []) { a.rig.body.add(j.root); j.root.position.set(j.i ? 0.21 : -0.2, j.base, j.i ? -0.27 : -0.25); j.root.rotation.set(0.15, j.i ? -0.35 : 0.35, j.i ? -0.15 : 0.15); j.root.scale.setScalar(0.5); }
    a.joeys = null;
  }
  // ---- the skunks: a mom and two kits, single file from the west fence, lie down in the sail's shadow, tails up
  function skunkSync(v, dt) {
    const fam = [['skunk', 0, 0], ['kit1', 0.55, 0.35], ['kit2', -0.5, 0.42]];
    fam.forEach(([key, dx, dz], i) => {
      const a = actors.get(key) || actor(key, key === 'skunk' ? 'skunk' : key, { x: ENTRY.skunks.from.x - i * 0.9, z: ENTRY.skunks.from.z }, v, { speed: SPEED.walk });
      const here = step(a, v.x + dx, v.z + dz, a.speed, dt);
      a.k = here ? Math.min(1, a.k + dt / 0.6) : 0;
      place(a, -0.05 * a.k);
      a.rig.animate(dt, here ? 0 : a.vel, {});
      a.rig.root.rotation.x = (PI / 2.6) * a.k;                                      // lying down, nose to the ground
      const k = lookK(a, dt);
      a.rig.tail.rotation.x = -1.4 * a.k + (k >= 0 ? Math.sin(k * PI * 4) * 0.25 : 0);  // the tail up, a parasol
    });
  }
  // ---- Pamela: hops the north fence, ambles to her spot, grazes (head down, bell tinkling)
  function pamelaSync(v, dt) {
    const a = actors.get('pamela') || actor('pamela', 'pamela', ENTRY.pamela.from, v, { speed: SPEED.trot });
    a.spot = v;
    const here = step(a, v.x, v.z, a.state === 'here' ? 0.5 : a.speed, dt);
    if (here) a.state = 'here';
    place(a);
    a.rig.animate(dt, a.vel, { sniff: here, happy: !here });
  }
  // ---- Biscuit walks Pamela home (a whistle), the payoff of "my dog's a hero": she grazes on, unbothered, while he comes
  // sprinting into the camera's frame, runs a lap round her, and they trot to the fence together (sync keeps her here
  // until then). From far off he enters from just outside the close frame, so the whole thing takes ~4 s on screen.
  function herdSync(dt) {
    const a = actors.get('pamela'), b = takeBiscuit('herd');
    if (!a || !b) { herd = null; freeBiscuit('herd'); return; }
    if (herd.t === 0) {
      const dx = dog.pos.x - a.pos.x, dz = dog.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > HERD_FROM) dog.pos.set(a.pos.x + (dx / d) * HERD_FROM, 0, a.pos.z + (dz / d) * HERD_FROM);
    }
    herd.t += dt;
    if (herd.met == null) {
      if (dogTo(a.pos.x + 0.9, a.pos.z + 0.3, dt, SPEED.run) || herd.t > 6) herd.met = herd.t;
      place(a); a.rig.animate(dt, 0, { sniff: true });
      return;
    }
    const k = herd.t - herd.met;
    if (k < 1.2) {                                        // a lap round her: home, you
      dogTo(a.pos.x + Math.cos(k * 5.2) * 0.9, a.pos.z + Math.sin(k * 5.2) * 0.9, dt, SPEED.run);
      place(a); a.rig.animate(dt, 0, { look: Math.sin(k * 6) * 0.4 });
      return;
    }
    herd.off = true;
    if (a.state !== 'out') leave('pamela');
    dogTo(a.pos.x + 0.6, a.pos.z - 0.6, dt, SPEED.trot);
    if (!actors.has('pamela') || k > 10) { herd = null; freeBiscuit('herd'); }
  }
  // ---- the otter delivers kelp (every kelp event): she floats in to the beach, pats a bundle onto the sand, floats off
  function courierSync(dt) {
    courier.t += dt;
    const k = PLACES.kelp, a = actors.get('courier') || actor('courier', 'otter', ENTRY.otter.from, { x: k.x + 1.6, z: k.z }, { speed: SPEED.float, to: ENTRY.otter.to });
    if (courier.t > 7 && a.state !== 'out') leave('courier');
    if (a.state !== 'out') step(a, k.x + 1.6, k.z, a.speed, dt);
    float(a, courier.t);
    a.rig.root.rotation.x = lerp(a.rig.root.rotation.x, -1.25, damp(dt, 3));
    a.rig.animate(dt, 0, { cheer: courier.t > 4 && courier.t < 5.5 });
    if (courier.t > 12) courier = null;
  }

  function fxEvent(ev) {
    if (ev.type === 'mischief/look') {
      const key = { seal_haulout: 'seal', otter_look: 'otter', possum_nap: 'possum', skunk_shade: 'skunk', pamela: 'pamela' }[ev.id];
      for (const k of key === 'skunk' ? ['skunk', 'kit1', 'kit2'] : [key]) {
        const a = actors.get(k);
        if (!a) continue;
        a.look = 0;
        // the ✦ goes up as she sets off, so a quick tap can beat her there (Pamela trots ~9 s from the fence): the camera's
        // glide brings her to her spot, so the close frame has her in it, doing her thing (rulings R4)
        if (a.state === 'in' && a.tx != null) { fx.dust?.(a.pos.x, a.pos.z); a.pos.set(a.tx, 0, a.tz); a.vel = 0; }
      }
      if (ev.id === 'biscuit_dig') digLook.look = 0;
      if (ev.id === 'biscuit_dig') setTimeout(() => fx.sparkle?.(ev.x, 0.5, ev.z, 10), LOOK_DELAY * 1000);
      if (ev.id === 'swarm_look') setTimeout(() => fx.sparkle?.(ev.x, 2.8, ev.z, 12), LOOK_DELAY * 1000);
      if (ev.id === 'biscuit_dig' && K.cast?.biscuit) setTimeout(() => K.cast.biscuit.trick('hop'), LOOK_DELAY * 1000);
      // Pamela looks up from the bramble and tosses her head: "Mehh." (her bubble says it)
      if (ev.id === 'pamela') setTimeout(() => actors.get('pamela')?.rig.trick('bark', 0.9), LOOK_DELAY * 1000);
    }
    if (ev.type === 'mischief/startle') {
      for (let i = 0; i < 7; i++) fx.dust?.(ev.x + Math.cos(i) * 0.6, ev.z + Math.sin(i) * 0.6, 0x86b45a);
      for (const k of ['skunk', 'kit1', 'kit2', 'seal']) { const a = actors.get(k); if (a) { a.state = 'out'; a.flee = k === 'seal' ? ENTRY.seal.to : ENTRY.skunks.to; } }
    }
    if (ev.type === 'mischief/whistle') herd = { t: 0, x: ev.x, z: ev.z };
    if (ev.type === 'event' && ev.id === 'kelp' && !courier) courier = { t: 0 };
  }
  function dispose() {
    for (const r of Object.values(rigs)) r.dispose();
    for (const a of actors.values()) hit.remove(`visitor:${a.key}`, 'visitor');
    scene.remove(root); bees.dispose();
  }
  K.mischief = { actors, dog, get biscuitBy() { return biscuitBy; } };   // (for dev tools and screenshots)
  return { sync, fx: fxEvent, dispose };
}
