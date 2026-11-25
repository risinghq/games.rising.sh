// ============================================================================
//  WICKCRAFT — the lantern carries fire. Draw from any flame to fill it, kindle
//  dead fires with it, and spend it on spells. Each kind of fire teaches one.
// ============================================================================
const SPELLS = {
  mend: { key: 1, name: 'Mend', cost: 3, cd: 1.5, kind: 'hearth', desc: 'hearth-warmth that closes hurts and drives out the chill', color: 0xffb04a },
  flare: { key: 2, name: 'Flare', cost: 2, cd: 0.8, kind: 'forge', desc: 'a burst of white heat that scatters gloam and burns bramble', color: 0xfff0c0 },
  reveal: { key: 3, name: 'Reveal', cost: 2, cd: 2.0, kind: 'candle', desc: 'pale candle-light that shows what was hidden', color: 0xbfe0ff },
  wisp: { key: 4, name: 'Wisp', cost: 3, cd: 1.2, kind: 'wisp', desc: 'send a wisp-light ahead to light lamps, raise stones and lure gloam', color: 0x8affb0 },
};
const SPELL_ORDER = ['mend', 'flare', 'reveal', 'wisp'];
const KIND_SPELL = { hearth: 'mend', forge: 'flare', candle: 'reveal', wisp: 'wisp' };
const FIRE_COL = {
  hearth: [0xff8a2a, 0xffb347, 0xff6a1a], forge: [0xffd890, 0xfff0c0, 0xffb060], candle: [0xffe8b0, 0xfff4d8, 0xffd890],
  ghost: [0x5aa8f8, 0xa8d8ff, 0x3a88e0], gloam: [0xb08aff, 0xe0d0ff, 0x8a6aff], wisp: [0x7affa0, 0xd0ffd8, 0x4ae880],
  wayfire: [0xff9a3a, 0xffc060, 0xff7a2a], beacon: [0xff8a2a, 0xffc04a, 0xff5a1a],
};
const FIRE_LIGHT = { hearth: 0xff8c3c, forge: 0xffa060, candle: 0xffcf8a, ghost: 0x8ac8ff, gloam: 0xa080ff, wisp: 0x6aff9a, wayfire: 0xff9a4a, beacon: 0xff8a3a };
const MAGIC = { cd: {}, drawing: null, wisps: [], rings: [], rev: { t: 0, x: 0, z: 0 }, lantern: null, lanternE: null, glowMat: null, hiddenK: 0 };
const REVEALS = [];       // JS-side revealables: { x, z, r, show(k) }
const BREAKABLES = [];    // things a flare can smash: { id, x, z, y, r, mesh, col, broken }

// ---- fires: live flames for every kindle-able fire -----------------------------------------------------------
function flameMesh(kind, s, mat) {
  const b = new Batch(), cols = FIRE_COL[kind] || FIRE_COL.hearth, fr = makeRng(Math.floor(s * 1000) + kind.length * 77);
  withLocal(() => {
    B.to(b); B.occ = 0;
    const n = kind === 'candle' ? 3 : 6;
    const em = kind === 'ghost' || kind === 'gloam' ? 1.9 : 3.0;
    for (let i = 0; i < n; i++) cyl((fr() - 0.5) * 0.34 * s, 0, (fr() - 0.5) * 0.18 * s, 0, (0.06 + fr() * 0.06) * s, (0.24 + fr() * 0.32) * s, 5, cols[i % 3], 0, { em, occ: 0 });
    sph(0, 0.02, 0, 0.13 * s, cols[1], 0, { em: em + 0.5, det: 0, sy: 0.55, occ: 0 });
  });
  const m = new THREE.Mesh(b.toGeometry(), mat);
  m.castShadow = false; m.receiveShadow = false;
  return m;
}
const FIRE_MATS = { s: null, u: null };
function initFires() { for (const f of KFIRES) fireVisual(f); }
// the live flame, its light and its embers (fires added later, by a custom area, come through here too)
function fireVisual(f, parent = scene) {
  if (f.kind === 'wisp') return;
  if (!FIRE_MATS.s) { FIRE_MATS.s = worldMat({ rough: 1 }); FIRE_MATS.u = worldMat({ rough: 1, ug: true }); }
  {
    f.mesh = flameMesh(f.kind, f.s * (f.kind === 'beacon' ? 1.6 : 1), f.ug ? FIRE_MATS.u : FIRE_MATS.s);
    f.mesh.position.set(f.x, f.y, f.z);
    if (f.ug) f.mesh.userData.ug = f.zone || 'cave';
    parent.add(f.mesh);
    f.base = 0.85 + Math.random() * 0.3;
    const bm = B.m.clone(); B.m.identity();   // the light goes where the fire is, whatever frame the builder is in
    f.e = addEmitter(f.x, f.y + 0.35 * f.s, f.z, { color: f.color ?? FIRE_LIGHT[f.kind] ?? 0xff8c3c, int: f.int ?? (f.kind === 'beacon' ? 16 : f.kind === 'candle' ? 3 : 8 * f.s), range: f.range ?? (f.kind === 'beacon' ? 16 : f.kind === 'candle' ? 5 : 8), flick: 0.3, glow: f.kind === 'candle' ? 0.4 : 1.2 * f.s, prio: f.kind === 'beacon' || f.kind === 'wayfire' ? 2 : 1, b: f.b, f: f.f, ug: !!f.ug, zone: f.zone });
    f.src = { p: new V3(f.x, f.y + 0.1, f.z), s: f.s, b: f.b, f: f.f, ug: !!f.ug, kf: f, forge: f.kind === 'forge' };
    FIRES.push(f.src);
    B.m.copy(bm);
    if (G.fires[f.id] !== undefined) f.lit = G.fires[f.id];
    setFireLit(f, f.lit, true);
  }
}
function setFireLit(f, lit, quiet) {
  f.lit = !!lit;
  if (f.mesh) f.mesh.visible = f.lit;
  if (f.e) f.e.on = f.lit ? 1 : 0;
  if (!quiet) {
    G.fires[f.id] = f.lit;
    if (f.lit) { burst(f.x, f.y + 0.2, f.z, 26); AUDIO.whoosh?.(f.kind); }
  }
}
function fireById(id) { return KFIRES.find(f => f.id === id); }
function updateFires(dt, t) {
  for (const f of KFIRES) {
    if (!f.mesh || !f.lit) continue;
    let vis = true;
    if (f.ug) vis = UG.ugShown;
    else if (UG.surfHidden || UG.dir > 0) vis = false;
    else if (CUT.enabled && f.b && CUT.b === f.b && f.f > CUT.f) vis = false;
    f.mesh.visible = vis;
    if (vis) { const k = 1 + Math.sin(t * 9 + f.base * 10) * 0.07 + Math.sin(t * 13.7 + f.base * 4) * 0.05, sc = f.small ? 0.35 : 1; f.mesh.scale.set(sc, k * f.base * sc, sc); }
  }
}

// ---- the lantern -----------------------------------------------------------------------------------------------
function giveLantern() {
  if (MAGIC.lantern || !player) return;
  const arm = player.rig.armL, b = new Batch();
  withLocal(() => {
    B.to(b); B.occ = 0;
    box(0, -0.05, 0, 0.02, 0.12, 0.02, MET.iron);
    B.push(0, -0.3, 0.05, 0);
    box(0, 0, 0, 0.17, 0.03, 0.17, MET.iron, PAT.METAL);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(sx * 0.07, 0.02, sz * 0.07, 0.022, 0.2, 0.022, MET.brass, PAT.METAL);
    box(0, 0.03, 0, 0.13, 0.17, 0.13, 0xfff0c8, PAT.LEAD, { em: -0.2 });
    cyl(0, 0.21, 0, 0.02, 0.11, 0.08, 4, MET.brass, PAT.METAL, { r0: PI / 4 });
    torus(0, 0.31, 0, 0.035, 0.008, 3, 8, MET.iron, 0);
    B.pop();
  });
  const pm = new THREE.Mesh(b.toGeometry(), charMatFree);
  pm.castShadow = true;
  const g = new THREE.Group(); g.position.set(0, -0.62 * 1, 0.02); g.add(pm);
  MAGIC.glowMat = new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true, opacity: 0.95 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 1), MAGIC.glowMat);
  core.position.set(0, -0.26, 0.05); g.add(core);
  arm.add(g);
  MAGIC.lantern = g; MAGIC.core = core;
  if (!MAGIC.lanternE) { MAGIC.lanternE = addEmitter(0, 0, 0, { color: 0xffa04a, int: 2, range: 7, flick: 0.12, glow: 0.45, prio: 5 }); MAGIC.lanternE.dynamic = true; }
  MAGIC.lanternE.on = 1;
  player.act = 'lantern';
}
function initMagic() {   // before the glow sprites are built, so the lantern and wisps get halos
  MAGIC.lanternE = addEmitter(0, -50, 0, { color: 0xffa04a, int: 2, range: 7, flick: 0.12, glow: 0.45, prio: 5 });
  MAGIC.lanternE.dynamic = true; MAGIC.lanternE.on = 0;
}
const _lp = new V3();
function updateLantern(dt, t) {
  if (!MAGIC.lantern) return;
  MAGIC.core.getWorldPosition(_lp);
  const e = MAGIC.lanternE, k = G.flame / Math.max(1, G.flameMax);
  e.p.copy(_lp);
  e.int = (0.5 + k * 1.8) * (0.55 + Math.max(NIGHT, UG.k) * 0.9) * (MAGIC.drawing ? 1.8 : 1);
  e.range = 5 + k * 4;
  e.b = CUT.b; e.f = CUT.f;
  MAGIC.core.scale.setScalar(0.5 + k * 0.8 + Math.sin(t * 11) * 0.05);
  MAGIC.glowMat.color.setHex(MAGIC.tint ?? 0xffb050);
  e.color.setHex(MAGIC.tint === HEART_TINT ? 0xffc060 : 0xffa04a);
  if (MAGIC.tint === HEART_TINT) e.int *= 1.35;
  if (R() < dt * (1 + k * 4)) PS.a.spawn(_lp.x, _lp.y + 0.05, _lp.z, rnd(-0.1, 0.1), rnd(0.2, 0.5), rnd(-0.1, 0.1), rnd(0.4, 0.8), 0.07, 0.01, _pc.set(MAGIC.tint ?? 0xffb050), 1.2, 0, { shape: 2, ly: UG.zone ? 1 : 0 });
}

// ---- drawing flame & kindling ------------------------------------------------------------------------------------------
function nearestFire(maxD = 2.4) {
  let best = null, bd = maxD;
  for (const f of KFIRES) {
    const d = Math.hypot(f.x - player.x, f.z - player.z);
    if (d > bd || Math.abs(f.y - player.y) > 3.2) continue;
    if (!!f.ug !== !!UG.zone && !(f.ug && UG.peek)) continue;
    if (f.b && CUT.b !== f.b) continue;
    bd = d; best = f;
  }
  return best;
}
function kindleAction(f) {
  if (!G.flags.lantern) return null;
  if (f.kind === 'wisp' && !f.lit) return null;
  if (f.puzzle !== undefined && !G.flags.stonesOpen && !f.lit) return { verb: 'Look at', label: f.label, act: () => UI.toast('A stone brazier', 'Cold, and old, and full of grey ash. You don\u2019t know what it\u2019s for. Yet.', 'info', 3) };
  if (f.lit) {
    if (f.kind === 'wisp' && !G.flags.wispTaught) return { verb: 'Watch', label: 'the wisp', act: () => UI.toast('Wisp', 'It bobs away from your lantern, curious and shy. Mother Hesk would know how to catch one.', 'info') };
    return { verb: 'Draw flame from', label: f.label || (f.kind === 'wisp' ? 'the wisp' : 'the fire'), act: () => drawFlame(f) };
  }
  return { verb: 'Kindle', label: f.label || 'the fire', act: () => kindleFire(f) };
}
function drawFlame(f) {
  if (MAGIC.drawing) return;
  if (f.locked && !flag(f.locked)) { const msg = (LOCKED_MSG[f.id] || LOCKED_MSG.default)(); UI.toast('Not now', msg, 'info'); return; }
  if (G.flame >= G.flameMax - 0.05 && !(KIND_SPELL[f.kind] && !G.spells[KIND_SPELL[f.kind]]) && !(f.memory && !G.seen['mem_' + f.memory])) { UI.toast('Your lantern is full', 'It can\u2019t hold any more flame.', 'info', 2); return; }
  MAGIC.drawing = { f, t: 0 };
  AUDIO.draw?.();
}
function updateDrawing(dt) {
  const d = MAGIC.drawing;
  if (!d) return;
  d.t += dt;
  const f = d.f;
  MAGIC.core.getWorldPosition(_lp);
  for (let i = 0; i < 3; i++) {   // a stream of sparks from the fire into the lantern
    const u = R(), x = lerp(f.x, _lp.x, u), y = lerp(f.y + 0.3, _lp.y, u) + Math.sin(u * PI) * 0.5, z = lerp(f.z, _lp.z, u);
    PS.a.spawn(x, y, z, (_lp.x - f.x) * 0.6, 0.2, (_lp.z - f.z) * 0.6, 0.35, 0.09, 0.02, _pc.set(pick(FIRE_COL[f.kind] || FIRE_COL.hearth)), 1.4, 0, { shape: 2, ly: f.ug ? 1 : 0 });
  }
  player.face = dampA(player.face, Math.atan2(f.x - player.x, f.z - player.z), 10, dt);
  if (d.t > 0.9) {
    MAGIC.drawing = null;
    G.flame = G.flameMax;
    MAGIC.tint = (FIRE_COL[f.kind] || FIRE_COL.hearth)[1];
    const sp = KIND_SPELL[f.kind];
    const learned = sp && !G.spells[sp] && !(f.teach === false) && learn(sp);
    for (const h of HOOK.fire) h('draw', f, learned ? sp : null);
    if (!learned) UI.toast('Lantern filled', `${f.label ? f.label[0].toUpperCase() + f.label.slice(1) : 'The fire'} fills your lantern.`, 'flame', 1.8);
    if (f.memory && !G.seen['mem_' + f.memory]) playMemory(f);
    saveGame();
  }
}
function kindleFire(f) {
  if (f.locked && !flag(f.locked)) { UI.toast('Not now', (LOCKED_MSG[f.id] || LOCKED_MSG.default)(), 'info'); return; }
  if (G.flame < 1) { UI.toast('Your lantern is cold', 'Draw flame from a lit fire first.', 'info'); AUDIO.fizzle?.(); return; }
  G.flame -= 1;
  MAGIC.core.getWorldPosition(_lp);
  for (let i = 0; i < 18; i++) { const u = i / 18; PS.a.spawn(lerp(_lp.x, f.x, u), lerp(_lp.y, f.y, u) + Math.sin(u * PI) * 0.6, lerp(_lp.z, f.z, u), 0, 0.3, 0, 0.5, 0.1, 0.02, _pc.set(0xffc060), 1.4, 0, { shape: 2 }); }
  setFireLit(f, true);
  for (const h of HOOK.fire) h('kindle', f);
  if (f.memory && !G.seen['mem_' + f.memory]) playMemory(f);
  saveGame();
}
const LOCKED_MSG = { default: () => 'This flame is spoken for.' };

// ---- spells --------------------------------------------------------------------------------------------------------------
function canCast(id) {
  const S = SPELLS[id];
  return G.spells[id] && G.flame >= S.cost && !(MAGIC.cd[id] > 0) && !DLG.active && !SCENE.active && !MAGIC.drawing && !COMBAT.down;
}
function cast(id, tx, tz) {
  const S = SPELLS[id];
  if (!G.spells[id]) return false;
  if (!canCast(id)) { if (G.flame < S.cost) { UI.flash?.('flame'); AUDIO.fizzle?.(); } return false; }
  G.flame -= S.cost; MAGIC.cd[id] = S.cd; G.stats.casts++;
  player.castT = 0.45;
  if (id === 'mend') castMend();
  else if (id === 'flare') castFlare();
  else if (id === 'reveal') castReveal();
  else if (id === 'wisp') castWisp(tx, tz);
  for (const h of HOOK.spell) h('cast', id);
  return true;
}
function castMend() {
  AUDIO.mend?.();
  for (const c of PARTY) {
    c.warmth = Math.min(c.warmthMax ?? 10, (c.warmth ?? 10) + 6);
    if (c.down) { c.down = false; c.pose = 'stand'; }
    for (let i = 0; i < 14; i++) { const a = rnd(0, TAU), r = rnd(0.2, 0.6); PS.a.spawn(c.x + Math.cos(a) * r, c.y + rnd(0.1, 1.2), c.z + Math.sin(a) * r, 0, rnd(0.5, 1.2), 0, rnd(0.8, 1.4), 0.12, 0.02, _pc.set(pick([0xffc060, 0xffe0a0, 0xff9a4a])), 1.3, 0, { shape: 2, kind: 1, ly: UG.zone ? 1 : 0 }); }
  }
  ring(player.x, player.y + 0.05, player.z, 0.5, 3.2, 0.7, 0xffb04a);
}
function castFlare() {
  AUDIO.flare?.();
  const x = player.x, z = player.z, y = player.y;
  ring(x, y + 0.08, z, 0.6, 6.2, 0.45, 0xfff0c0);
  flash(x, y + 1.2, z, 0xfff0d0, 26, 9, 0.35);
  for (let i = 0; i < 46; i++) { const a = rnd(0, TAU), s = rnd(5, 11); PS.a.spawn(x, y + rnd(0.4, 1.2), z, Math.cos(a) * s, rnd(0.5, 2.5), Math.sin(a) * s, rnd(0.25, 0.5), 0.12, 0.03, _pc.set(pick([0xfff0c0, 0xffd080, 0xffffff])), 1.6, 0, { shape: 2, drag: 3, ly: UG.zone ? 1 : 0 }); }
  hurtEnemiesAround(x, z, 5.6, 3, 7);
  for (const t of THORNS) if (!t.burnt && Math.hypot(t.x - x, t.z - z) < 4.6 + t.w * 0.25) burnThorns(t);
  for (const b of BREAKABLES) if (!b.broken && Math.hypot(b.x - x, b.z - z) < b.r + 3.2 && Math.abs(b.y - y) < 3) breakIt(b);
}
function castReveal() {
  AUDIO.reveal?.();
  MAGIC.rev = { t: 0, x: player.x, z: player.z, y: player.y };
  ring(player.x, player.y + 0.08, player.z, 0.6, 14, 1.2, 0xbfe0ff);
  for (let i = 0; i < 30; i++) { const a = rnd(0, TAU), r = rnd(1, 10); PS.a.spawn(player.x + Math.cos(a) * r, player.y + rnd(0.2, 2), player.z + Math.sin(a) * r, 0, rnd(0.1, 0.3), 0, rnd(1.5, 2.6), 0.1, 0.02, _pc.set(0xd8ecff), 1.0, 0, { shape: 2, kind: 1, ly: UG.zone ? 1 : 0 }); }
}
function castWisp(tx, tz) {
  AUDIO.wisp?.();
  MAGIC.core.getWorldPosition(_lp);
  let x = tx, z = tz;
  if (x === undefined || !Number.isFinite(x)) { x = player.x + Math.sin(player.face) * 9; z = player.z + Math.cos(player.face) * 9; }
  const dx = x - player.x, dz = z - player.z, d = Math.hypot(dx, dz);
  if (d > 16) { x = player.x + dx / d * 16; z = player.z + dz / d * 16; }
  const w = { x: _lp.x, y: _lp.y, z: _lp.z, tx: x, tz: z, ty: groundAt(x, z, player.y + 2).h + 1.6, life: 22, t: 0, arrived: false };
  w.e = addEmitter(w.x, w.y, w.z, { color: 0x7affa8, int: 6, range: 9, flick: 0.1, glow: 0.9, prio: 6, ug: !!UG.zone, zone: UG.zone });
  w.e.dynamic = true;
  MAGIC.wisps.push(w);
}
function updateWisps(dt, t) {
  for (let i = MAGIC.wisps.length - 1; i >= 0; i--) {
    const w = MAGIC.wisps[i];
    w.t += dt; w.life -= dt;
    if (!w.arrived) {
      const dx = w.tx - w.x, dz = w.tz - w.z, dy = w.ty - w.y, d = Math.hypot(dx, dz, dy), st = Math.min(d, 11 * dt);
      w.x += dx / (d || 1) * st; w.y += dy / (d || 1) * st + Math.sin(w.t * 9) * 0.02; w.z += dz / (d || 1) * st;
      if (d < 0.2) { w.arrived = true; wispArrive(w); }
    } else { w.y = w.ty + Math.sin(w.t * 2.3) * 0.18; w.x = w.tx + Math.cos(w.t * 1.7) * 0.3; w.z = w.tz + Math.sin(w.t * 1.3) * 0.3; }
    w.e.p.set(w.x, w.y, w.z);
    w.e.int = Math.min(1, w.life / 2) * 6;
    if (R() < dt * 30) PS.a.spawn(w.x + rnd(-0.1, 0.1), w.y, w.z + rnd(-0.1, 0.1), rnd(-0.2, 0.2), rnd(-0.1, 0.3), rnd(-0.2, 0.2), rnd(0.4, 0.9), 0.22, 0.02, _pc.set(pick([0x7affa8, 0xd0ffe0, 0x4ae880])), 1.4, 0, { shape: 2, ly: UG.zone ? 1 : 0 });
    if (w.life <= 0) { w.e.int = 0; w.e.on = 0; emitters.splice(emitters.indexOf(w.e), 1); MAGIC.wisps.splice(i, 1); }
  }
}
function wispArrive(w) {
  for (const l of LAMPS) if (!l.lit && Math.hypot(l.x - w.tx, l.z - w.tz) < 3.6) lightLamp(l);
  for (const s of STONESETS) if (!s.up && s.pts.some(p => Math.hypot(p[0] - w.tx, p[1] - w.tz) < 4.5)) raiseStones(s);
  for (const f of KFIRES) if (!f.lit && f.kind !== 'wisp' && Math.hypot(f.x - w.tx, f.z - w.tz) < 2.2 && !(f.locked && !flag(f.locked))) { setFireLit(f, true); for (const h of HOOK.fire) h('kindle', f); }
  for (const h of HOOK.spell) h('wisp', w);
}

// ---- effect helpers: expanding rings, flashes --------------------------------------------------------------------------
const RING_GEO = new THREE.RingGeometry(0.92, 1, 64).rotateX(-PI / 2);
function ring(x, y, z, r0, r1, dur, c) {
  const m = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.scale.setScalar(r0); m.renderOrder = 9; m.frustumCulled = false;
  scene.add(m);
  MAGIC.rings.push({ m, r0, r1, dur, t: 0 });
}
function flash(x, y, z, c, int, range, dur) {
  const e = addEmitter(x, y, z, { color: c, int, range, flick: 0, glow: 0, prio: 9, ug: !!UG.zone, zone: UG.zone });
  e.dynamic = true; e.p.set(x, y, z);
  MAGIC.rings.push({ e, int, dur, t: 0 });
}
function updateRings(dt) {
  for (let i = MAGIC.rings.length - 1; i >= 0; i--) {
    const r = MAGIC.rings[i];
    r.t += dt;
    const u = Math.min(1, r.t / r.dur);
    if (r.m) { r.m.scale.setScalar(lerp(r.r0, r.r1, 1 - (1 - u) * (1 - u))); r.m.material.opacity = 0.9 * (1 - u); }
    if (r.e) r.e.int = r.int * (1 - u);
    if (u >= 1) {
      if (r.m) { scene.remove(r.m); r.m.material.dispose(); }
      if (r.e) { r.e.on = 0; emitters.splice(emitters.indexOf(r.e), 1); }
      MAGIC.rings.splice(i, 1);
    }
  }
}

// ---- the world's magical furniture: wisp-lamps, wisp-stones, brambles, rubble -----------------------------------------
function initMagicWorld() {
  for (const l of LAMPS) {
    l.glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), new THREE.MeshBasicMaterial({ color: 0x9affc0 }));
    l.glow.position.set(l.x, l.y - 0.15, l.z); l.glow.visible = false; scene.add(l.glow);
    l.e = addEmitter(l.x, l.y, l.z, { color: 0x7affa8, int: 6, range: 11, flick: 0.08, glow: 0.8, prio: 1 });
    l.e.on = 0;
    if (G.lamps[l.id]) lightLamp(l, true);
  }
  for (const s of STONESETS) {
    s.meshes = s.pts.map(([x, z]) => {
      const b = new Batch();
      withLocal(() => { B.to(b); B.occ = 0; cyl(0, -0.5, 0, 0.62, 0.72, 0.5, 9, 0x8a9a8a, PAT.ROCK); torus(0, 0.0, 0, 0.5, 0.03, 3, 18, 0x7affb0, 0, { rx: PI / 2, em: 1.6 }); });
      const m = new THREE.Mesh(b.toGeometry(), worldMat({ rough: 0.9 }));
      m.position.set(x, WATER_Y - 0.7, z); m.visible = false; scene.add(m);
      return m;
    });
    if (G.stones[s.id]) raiseStones(s, true);
  }
  for (const t of THORNS) if (G.thorns[t.id]) burnThorns(t, true);
  for (const b of BREAKABLES) if (G.flags['broke_' + b.id]) breakIt(b, true);
}
function lightLamp(l, quiet) {
  l.lit = true; l.glow.visible = true; l.e.on = 1;
  G.lamps[l.id] = true;
  if (!quiet) { burst(l.x, l.y, l.z, 12); AUDIO.chime?.(4); for (const h of HOOK.fire) h('lamp', l); saveGame(); }
}
function raiseStones(s, quiet) {
  s.up = true; G.stones[s.id] = true;
  s.meshes.forEach((m, i) => {
    m.visible = true;
    const [x, z] = s.pts[i];
    if (quiet) m.position.y = WATER_Y + 0.22; else s.anim = 0;
    walkPolyW(Array.from({ length: 8 }, (_, k) => [x + Math.cos(k / 8 * TAU) * 0.62, z + Math.sin(k / 8 * TAU) * 0.62]), WATER_Y + 0.24, null, 'stone');
  });
  if (s.strip && !s.stripW) s.stripW = walkPolyW(s.strip, WATER_Y + 0.24, null, 'stone');
  if (!quiet) { AUDIO.chime?.(2); for (const [x, z] of s.pts) for (let i = 0; i < 8; i++) PS.n.spawn(x + rnd(-0.5, 0.5), WATER_Y + 0.05, z + rnd(-0.5, 0.5), rnd(-0.6, 0.6), rnd(1, 2), rnd(-0.6, 0.6), 0.6, 0.08, 0.04, _pc.set(0xd8ecf4), 0.7, 0, { grav: 9 }); for (const h of HOOK.fire) h('stones', s); saveGame(); }
}
function updateStones(dt) {
  for (const s of STONESETS) {
    if (s.anim === undefined || s.anim === null) continue;
    s.anim += dt;
    s.meshes.forEach((m, i) => { const u = clamp((s.anim - i * 0.18) / 0.7, 0, 1); m.position.y = lerp(WATER_Y - 0.7, WATER_Y + 0.22, 1 - (1 - u) ** 3); });
    if (s.anim > 2) s.anim = null;
  }
}
function burnThorns(t, quiet) {
  t.burnt = true; G.thorns[t.id] = true;
  t.col.off = true;
  if (quiet) { t.mesh.visible = false; return; }
  t.burnT = 0;
  AUDIO.burn?.();
  for (const h of HOOK.fire) h('thorns', t);
  saveGame();
}
function breakIt(b, quiet) {
  b.broken = true; G.flags['broke_' + b.id] = true;
  if (b.col) b.col.off = true;
  for (const c of b.cols || []) c.off = true;
  if (b.mesh) { b.mesh.visible = false; const i = UGM.indexOf(b.mesh); if (i >= 0) UGM.splice(i, 1); scene.remove(b.mesh); }
  if (!quiet) { AUDIO.crash?.(); for (let i = 0; i < 40; i++) PS.n.spawn(b.x + rnd(-1, 1), b.y + rnd(0.2, 1.4), b.z + rnd(-1, 1), rnd(-3, 3), rnd(1, 5), rnd(-3, 3), rnd(0.6, 1.2), 0.18, 0.08, _pc.set(pick([0x6e6458, 0x8a7a68, 0x5a5048])), 0.9, 0, { grav: 12, ly: b.ug ? 1 : 0 }); for (const h of HOOK.fire) h('break', b); saveGame(); }
}
function updateThorns(dt) {
  for (const t of THORNS) {
    if (t.burnT === undefined || t.burnT === null) continue;
    t.burnT += dt;
    const u = clamp(t.burnT / 1.2, 0, 1);
    t.mesh.scale.set(1, 1 - u * 0.95, 1);
    if (R() < dt * 40 * (1 - u)) PS.a.spawn(t.x + rnd(-t.w / 2, t.w / 2) * Math.cos(t.ry), t.y + rnd(0.2, 1.6) * (1 - u), t.z - rnd(-t.w / 2, t.w / 2) * Math.sin(t.ry), rnd(-0.3, 0.3), rnd(0.8, 2), rnd(-0.3, 0.3), rnd(0.4, 0.8), 0.18, 0.04, _pc.set(pick([0xff8a2a, 0xffc060, 0xb08aff])), 1.4, 0, { shape: 2 });
    if (u >= 1) { t.mesh.visible = false; t.burnT = null; }
  }
}

// ---- reveal: hidden geometry (pattern id + 100) and JS revealables -----------------------------------------------------
function updateReveal(dt) {
  const r = MAGIC.rev;
  if (r.t !== null && r.t !== undefined && r.t < 18) {
    r.t += dt;
    const rad = Math.min(14, 0.6 + r.t * 26), k = r.t < 14 ? 1 : 1 - (r.t - 14) / 4;
    SU.uRev.value.set(r.x, r.z, rad, Math.max(0, k));
    for (const v of REVEALS) { const d = Math.hypot(v.x - r.x, v.z - r.z); v.show(d < rad + (v.r || 0) ? Math.max(0, k) : 0, r); }
  } else if (SU.uRev.value.w !== 0) { SU.uRev.value.w = 0; for (const v of REVEALS) v.show(0, r); }
}

// ---- memories: some flames remember what they saw ---------------------------------------------------------------------------
function playMemory(f) {
  const M = MEMORIES[f.memory];
  if (!M || SCENE.active) return;
  G.seen['mem_' + f.memory] = true;
  cutscene('memory', async () => {
    UI.vision(true); AUDIO.vision?.(); AUDIO.forceMood = 'hush';
    UI.toast('A memory', 'Old fire remembers what it saw\u2026', 'spell', 2.5);
    await wait(0.6);
    await M.play(f);
    UI.vision(false); AUDIO.forceMood = null;
    await wait(0.5);
    CAM.focus = null;
    if (M.after) await M.after(f);
  });
}
const ECHO_MAT = new THREE.MeshBasicMaterial({ color: 0x5aa8f0, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false });
function makeEcho(o) {
  const pm = PART_MAT; PART_MAT = ECHO_MAT;
  const c = new Character({ ...o, free: true, talk: false });
  PART_MAT = pm;
  c.rig.root.traverse(m => { if (m.isMesh) { m.material = m.material === blobMat ? m.material : ECHO_MAT; m.castShadow = false; } });
  c.rig.blob.visible = false; c.ghost = true; c.echo = true;
  return c;
}
function removeEcho(c) {
  scene.remove(c.root);
  const i = CHARS.indexOf(c); if (i >= 0) CHARS.splice(i, 1);
}

// ---- per-frame --------------------------------------------------------------------------------------------------------------
function updateMagic(dt, t) {
  for (const k in MAGIC.cd) if (MAGIC.cd[k] > 0) MAGIC.cd[k] -= dt;
  updateLantern(dt, t);
  updateDrawing(dt);
  updateWisps(dt, t);
  updateRings(dt);
  updateFires(dt, t);
  updateStones(dt);
  updateThorns(dt);
  updateReveal(dt);
  // a lantern that runs dry slowly gathers a spark or two of its own
  if (G.flags.lantern && G.flame < 2) G.flame = Math.min(2, G.flame + dt / 9);
}
