// The always-present characters, placed per phase:
// - your farmer (species s.meta.species, overalls + hat) potters about near PLACES.farmhome in growing
//   phases and on weekend days glides after s.season.farmer { x, z } at its true speed (kit.glide), sprinting with
//   a dust trail and legs that keep pace with the ground;
// - Gran (your species, greyer, glasses, shawl) minds the stand;
// - the Weighmaster is never seen before the weigh-off (he is the year's surprise): on weigh-off morning
//   Marlene rolls in thick over the scale, he plops down inside her, and she lifts to reveal him;
// - Biscuit the farm dog trots at the farmer's heel (bounding to keep up with a sprint) and sits when the farmer stops.
// - before the farm opens (phase 'newgame': the new-farm flow and the title preview) Mayor Pouch waits on the
//   dock with your farmer beside him, so picking a species swaps a real 3D avatar (design §12 screen flow 2).
// Slices can take any of them over: set K.cast.farmer.hold = true and move its rig yourself.
// Handles fx: toy taps on 'weighmaster' (Hmph) and 'biscuit' (rolls over), 'season/served' (Gran nods),
// 'meta' (the new farmer hops), and { type: 'cast', who, act: 'wave'|'cheer'|'hop'|'bark'|'roll' } for scripted beats.
import * as THREE from 'three';
import { PLACES } from '../sim/layout.js';
import { clamp, lerp, damp, rng, glide, tickKey, gameDt } from './kit.js';
import { T } from '../sim/tuning.js';
import { makeTownsfolk, makeWeighmaster, makeQuad, makeFolk, TOWNSFOLK } from './folk.js';
const TEA_TOWEL = 0xefe8da;                             // [A] Gran's tea towel, once Pamela has had her shawl

const IDLE = [[-11.1, -6.7], [-10.4, -7.5], [-11.9, -7.4], [-10.1, -6.0], [-12.6, -7.0]];
// on the dock (top at y = -0.3), facing the camera's 'dock' frame (from +z), turned a little toward each other
const DOCK = { farmer: [12.55, 6.05, 0.35], mayor: [13.95, 5.95, -0.4], biscuit: [11.6, 6.2, 0.6] };
const HEEL = [[0.9, 0.55], [0.9, -0.55], [1.4, 0], [0, 1.0], [0, -1.0], [-0.8, 0.8]];
// weigh-off stages (sim/weighoff.js STAGES) at which the Weighmaster is on the farm: from his entrance to the results
const WM_STAGES = new Set(['arrive', 'lift', 'inspect', 'pretty', 'heavy', 'results', 'done']);
const turnTo = (obj, yaw, k) => { let d = yaw - obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); obj.rotation.y += d * k; };

export default function createCast(K) {
  const { scene, hit, fx } = K;
  const r = rng(1301);
  let species = null, farmer = null, gran = null;
  const actor = (rig) => ({ rig, pos: new THREE.Vector3(), vel: 0, act: null, actT: 0, hold: false, g: {} });
  const F = actor(null), G = actor(null);

  const wm = makeWeighmaster();
  wm.root.position.set(PLACES.weighmaster.x, 0, PLACES.weighmaster.z); wm.root.rotation.y = -1.33;
  wm.root.visible = false;
  scene.add(wm.root);
  // his reveal: fog in (0 -> FOG_IN s), plop (at FOG_IN), fog lifts (to REVEAL s)
  const WM_REVEAL = { fogIn: 1.4, plop: 0.3, lift: 2.6, fog: 0.7 };
  let wmState = 'away', wmT = 0;
  const dog = actor(makeQuad('biscuit'));
  scene.add(dog.rig.root);

  function build(sp) {
    species = sp;
    farmer?.dispose(); gran?.dispose();
    farmer = F.rig = makeTownsfolk('farmer', sp);
    gran = G.rig = makeTownsfolk('gran', sp); G.teaTowel = false;
    scene.add(farmer.root, gran.root);
    if (!F.pos.lengthSq()) { F.pos.set(IDLE[0][0], 0, IDLE[0][1]); dog.pos.set(IDLE[0][0] - 0.8, 0, IDLE[0][1] - 0.6); }
    // at the till end of the counter rather than behind it, so the overhead camera can see her
    G.pos.set(PLACES.gran.x, 0, PLACES.gran.z);
    gran.root.position.copy(G.pos);
  }

  // idle wander near the farmhouse corner
  let idleI = 0, idleWait = 2;
  function idleTarget(dt) {
    const [x, z] = IDLE[idleI];
    if (Math.hypot(F.pos.x - x, F.pos.z - z) < 0.08) {
      idleWait -= dt;
      if (idleWait <= 0) { idleI = (idleI + 1 + ((r.rand() * (IDLE.length - 1)) | 0)) % IDLE.length; idleWait = 3 + r.rand() * 4; }
    }
    return IDLE[idleI];
  }

  // ---- the new-farm stage: the Mayor is built the first time he is needed and hidden afterwards
  let mayor = null, wasNew = false;
  const M = actor(null);
  function stageNewFarm(on, dt) {
    if (on && !mayor) {
      mayor = M.rig = makeTownsfolk('mayor');
      scene.add(mayor.root);
      M.act = 'wave'; M.actT = 2.2;
    }
    if (mayor) mayor.root.visible = on;
    if (on) {
      const [x, z, yaw] = DOCK.mayor;
      mayor.root.position.set(x, K.world.heightAt(x, z), z); mayor.root.rotation.y = yaw;
      actAnimate(M, dt, 0, { look: 0.25 });
      if (!F.hold) { F.pos.set(DOCK.farmer[0], 0, DOCK.farmer[1]); farmer.root.rotation.y = DOCK.farmer[2]; }
      if (!dog.hold) { dog.pos.set(DOCK.biscuit[0], 0, DOCK.biscuit[1]); dog.rig.root.rotation.y = DOCK.biscuit[2]; }
    } else if (wasNew && !F.hold) {
      // the farm just opened (behind the fog curtain): back to the farmhouse, no walk across the map
      F.pos.set(IDLE[0][0], 0, IDLE[0][1]); dog.pos.set(IDLE[0][0] - 0.8, 0, IDLE[0][1] - 0.6);
    }
    wasNew = on;
  }

  const last = new THREE.Vector3(), clk = {}, TPS = T.calendar.weekend.ticksPerSecond;
  let dustT = 0, served = 0;
  function sync(s, dt, t) {
    const sp = s?.meta?.species || 'possum', gdt = gameDt(clk, s, dt, TPS);
    // game seconds a real second (2 at 2x): what counts as a snap rather than a run scales with it
    const snapV = 12 * Math.max(1, dt > 1e-6 ? gdt / dt : 1);
    if (sp !== species) build(sp);
    const newFarm = s?.clock?.phase === 'newgame';
    stageNewFarm(newFarm, dt);
    // weekend days run 9:00-17:00 (minute >= 540); on weekdays the season state still has a farmer, idle
    const weekend = s?.clock?.phase === 'october' && (s.clock.minute ?? 0) >= 540 && !!s.season?.farmer;
    // ---- the farmer
    if (newFarm && !F.hold) {
      farmer.root.position.set(F.pos.x, K.world.heightAt(F.pos.x, F.pos.z), F.pos.z);
      F.vel = 0;
    } else if (!F.hold) {
      last.copy(F.pos);
      let dx, dz, d;
      if (weekend) {
        // weekends: glide after the sim's once-a-tick positions at the farmer's true speed (a load or a new day snaps)
        const g = glide(F.g, s.season.farmer.x, s.season.farmer.z, tickKey(s), s.clock.acc || 0, 6);
        dx = g.x - F.pos.x; dz = g.z - F.pos.z; d = Math.hypot(dx, dz);
        F.pos.set(g.x, 0, g.z);
      } else {
        // idle: a steady amble between favourite spots
        F.g.key = undefined;
        const [tx, tz] = idleTarget(dt);
        dx = tx - F.pos.x; dz = tz - F.pos.z; d = Math.hypot(dx, dz);
        if (d > 1e-3) { const step = Math.min(d, 1.25 * dt); F.pos.x += dx / d * step; F.pos.z += dz / d * step; }
      }
      const v = last.distanceTo(F.pos) / Math.max(dt, 1e-4);
      F.vel = v > snapV ? F.vel : lerp(F.vel, v, damp(dt, 14));  // ignore a snap
      if (d > 1e-3 && (weekend ? v > 0.05 : d > 0.05)) turnTo(farmer.root, Math.atan2(dx, dz), damp(weekend ? gdt : dt, 12));
      else if (!weekend) turnTo(farmer.root, Math.atan2(-3 - F.pos.x, 0 - F.pos.z), damp(dt, 2));
      farmer.root.position.set(F.pos.x, K.world.heightAt(F.pos.x, F.pos.z), F.pos.z);
      if (F.vel > 4 && (dustT -= dt) <= 0) { fx.dust(F.pos.x - Math.sin(farmer.root.rotation.y) * 0.3, F.pos.z - Math.cos(farmer.root.rotation.y) * 0.3); dustT = 0.07; }
    }
    // the legs keep pace with the ground (folk.js gait): a walk, a real run at a sprint, a heavy stride with the wagon
    actAnimate(F, dt, F.vel, weekend && s.season.farmer.carry === 'wagon' ? { pull: true } : {});
    // ---- Gran at the stand
    if (!G.hold) { gran.root.position.copy(G.pos); turnTo(gran.root, 0.9, damp(dt, 3)); }
    served = Math.max(0, served - dt);
    actAnimate(G, dt, 0, served > 0 ? { nod: true } : {});
    // ---- the Weighmaster: only on weigh-off day, from his entrance (the 'arrive' step of the dawn swoop) on.
    // Never on the eve, the Night Watch or while the pallets roll in at dawn: the camera is on the empty scale first.
    const wmDue = s?.clock?.phase === 'weighoff' && WM_STAGES.has(s.weighoff?.stage);
    // (a load later in the day finds him already there: the entrance plays once, at the 'arrive' step)
    if (wmDue && wmState === 'away') { if (s.weighoff.stage === 'arrive') { wmState = 'arriving'; wmT = 0; } else wmLanded(); }
    if (!wmDue && wmState !== 'away') {
      wmState = 'away'; wm.root.visible = false; hit.remove('weighmaster', 'toy'); K.sky.setFogOverride(0);
    }
    if (wmState === 'arriving') revealWeighmaster(dt);
    if (wm.root.visible) wm.update(dt);
    // ---- Biscuit at heel: behind and a little to the side, sits when the farmer stops (on the dock: his spot)
    if (newFarm && !dog.hold) {
      dog.rig.root.position.set(dog.pos.x, K.world.heightAt(dog.pos.x, dog.pos.z), dog.pos.z);
      dog.vel = 0;
    } else if (!dog.hold) {
      // heel: behind and to one side, or the other side, or further back, whichever isn't inside the stand
      const fr = farmer.root, sy = Math.sin(fr.rotation.y), cy = Math.cos(fr.rotation.y);
      let hx = F.pos.x, hz = F.pos.z;
      for (const [back, side] of HEEL) {
        hx = F.pos.x - sy * back + cy * side; hz = F.pos.z - cy * back - sy * side;
        if (!K.world.blocked(hx, hz)) break;
      }
      last.copy(dog.pos);
      const dx = hx - dog.pos.x, dz = hz - dog.pos.z, d = Math.hypot(dx, dz);
      // he matches the farmer's pace and closes the gap to his heel spot, bounding up to 8 u/s (game time: 16 at 2x) to
      // catch a sprint
      if (d > 8) dog.pos.set(hx, 0, hz);
      else if (d > 0.15) { const step = Math.min(d - 0.1, 8 * gdt, F.vel * dt + 2 * d * gdt); dog.pos.x += dx / d * step; dog.pos.z += dz / d * step; }
      const dv = last.distanceTo(dog.pos) / Math.max(dt, 1e-4);
      dog.vel = dv > snapV ? dog.vel : lerp(dog.vel, dv, damp(dt, 14));
      if (dog.vel > 0.1) turnTo(dog.rig.root, Math.atan2(dog.pos.x - last.x, dog.pos.z - last.z), damp(gdt, 10));
      else turnTo(dog.rig.root, Math.atan2(F.pos.x - dog.pos.x, F.pos.z - dog.pos.z), damp(dt, 3));
      dog.rig.root.position.set(dog.pos.x, K.world.heightAt(dog.pos.x, dog.pos.z), dog.pos.z);
    }
    dog.rig.animate(dt, dog.vel, { sit: F.vel < 0.2 && dog.vel < 0.2, happy: F.vel > 2 || dog.happy > 0 });
    dog.happy = Math.max(0, (dog.happy || 0) - dt);
    // Biscuit is a toy (he rolls over); the farmer only wins taps nothing else claims
    hit.add({ kind: 'toy', id: 'biscuit', circle: [dog.pos.x, dog.pos.z, 0.45], y: [0, 0.8] }, 4);
    hit.add({ kind: 'farmer', id: 'farmer', circle: [F.pos.x, F.pos.z, 0.45], y: [0, 1.8] }, 0);
  }
  // Marlene rolls in over the scale, he plops down unseen inside her, then she lifts and there he is.
  function revealWeighmaster(dt) {
    const R = WM_REVEAL, { x, z } = PLACES.weighmaster;
    wmT += dt;
    if (wmT < R.fogIn) { K.sky.setFogOverride(R.fog * clamp(wmT / R.fogIn, 0, 1)); return; }
    const k = clamp((wmT - R.fogIn) / R.plop, 0, 1);
    if (!wm.root.visible) {
      wm.root.visible = true;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; fx.dust(x + Math.cos(a) * 1.6, z + Math.sin(a) * 1.6); }
    }
    // drop the last half unit and land with a squash
    wm.root.position.y = (1 - k) * (1 - k) * 0.6;
    const sq = k < 1 ? 0 : Math.max(0, 1 - (wmT - R.fogIn - R.plop) / 0.35);
    wm.root.scale.set(1 + sq * 0.08, 1 - sq * 0.12, 1 + sq * 0.08);
    const lift = clamp((wmT - R.fogIn - R.plop) / R.lift, 0, 1);
    K.sky.setFogOverride(R.fog * (1 - lift));
    if (lift >= 1) { wmLanded(); wm.hmph(); }
  }
  function wmLanded() {
    const { x, z } = PLACES.weighmaster;
    wmState = 'here'; wm.root.visible = true; wm.root.scale.set(1, 1, 1); wm.root.position.y = 0;
    hit.add({ kind: 'toy', id: 'weighmaster', circle: [x, z, 1.5] }, 4);
  }
  // one-off acts (wave, cheer, hop) layered on the walk cycle
  function actAnimate(a, dt, speed, o = {}) {
    if (a.act) { a.actT -= dt; o = { ...o, [a.act]: true }; if (a.actT <= 0) a.act = null; }
    a.rig.animate(dt, speed, o);
  }
  function fxEvent(ev) {
    if (ev.type === 'tap' && ev.id === 'weighmaster') wm.hmph();
    if (ev.type === 'tap' && ev.id === 'biscuit') { dog.rig.trick('roll'); dog.happy = 1.5; }
    if (ev.type === 'season/served') served = 0.8;
    // a new species on the dock: the fresh farmer hops and the Mayor nods his approval
    if (ev.type === 'meta' && wasNew) { F.act = 'hop'; F.actT = 0.6; if (mayor) { M.act = 'nod'; M.actT = 0.9; } }
    if (ev.type === 'cast') {
      const a = { farmer: F, gran: G, biscuit: dog, mayor: mayor && M }[ev.who];
      if (!a) { if (ev.who === 'weighmaster') wm.hmph(); return; }
      if (a === dog) { dog.rig.trick(ev.act || 'bark'); dog.happy = 1; }
      else { a.act = ev.act || 'wave'; a.actT = ev.secs ?? 1.6; }
    }
  }
  const api = {
    sync, fx: fxEvent,
    get farmer() { return F.rig && Object.assign(F.rig, { hold: F.hold, actor: F }); },
    get gran() { return G.rig; },
    weighmaster: wm, biscuit: dog.rig,
    get weighmasterHere() { return wmState === 'here'; },
    hold(who, on = true) {
      const a = ({ farmer: F, gran: G, biscuit: dog })[who];
      // (let Biscuit go: he trots on from where the borrower left him, not from where he was taken. Gran's pos is her home
      // spot, which she snaps back to: season.js sets her down at the stand itself when October's direct sale lets her go)
      if (!on && a === dog && a.hold && a.rig?.root) a.pos.set(a.rig.root.position.x, 0, a.rig.root.position.z);
      a.hold = on;
    },
    // [A] Pamela ate Gran's good shawl (plan §3.3): she wears a tea towel for the rest of the year (cosmetic)
    granTeaTowel(on) {
      if (!!on === !!G.teaTowel || !species) return;
      G.teaTowel = !!on;
      const was = gran;
      gran = G.rig = on ? makeFolk(species, { ...TOWNSFOLK.gran(species), accessories: ['glasses', ['shawl', { color: TEA_TOWEL, pin: 0xb5543f }]] }) : makeTownsfolk('gran', species);
      gran.root.position.copy(G.pos); gran.root.rotation.y = was?.root.rotation.y ?? 0.9;
      scene.add(gran.root);
      was?.dispose();
    },
    dispose() { farmer?.dispose(); gran?.dispose(); mayor?.dispose(); wm.dispose(); dog.rig.dispose(); hit.remove('biscuit'); hit.remove('farmer'); hit.remove('weighmaster'); },
  };
  K.cast = api;
  return api;
}
