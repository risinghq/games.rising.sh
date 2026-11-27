// ============================================================================
//  THE GLOAM — cold shadows that drift out of the wild places after dark and
//  go for your lantern. Warmth is your health; fire is your weapon.
// ============================================================================
const COMBAT: any = { enemies: [], down: false, regenT: 0, spawnT: 0, zones: [], hurtFx: 0, calm: false, boss: null, decals: [], kills: 0 };
const ENEMY: any = {
  gloamling: { hp: 3, speed: 2.4, r: 0.38, dmg: 1, rate: 1.0, reach: 0.95, size: 0.42, h: 0.85 },
  shade: { hp: 6, speed: 1.85, r: 0.5, dmg: 2, rate: 1.7, reach: 1.45, size: 0.62, h: 1.25 },
};
const GLOAM_VS: any = `uniform float uT; uniform float uSeed; varying vec3 vN; varying vec3 vV; varying float vY;
void main(){ vec3 p = position; float w = sin(p.y * 7.0 + uT * 4.0 + uSeed) * 0.07 + sin(p.x * 6.0 - uT * 3.1 + uSeed * 2.0) * 0.06 + sin(p.z * 5.0 + uT * 2.3) * 0.05;
  p += normal * w; vY = position.y; vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const GLOAM_FS: any = `uniform vec3 uCore; uniform vec3 uRim; uniform float uHit; uniform float uFade; varying vec3 vN; varying vec3 vV; varying float vY;
void main(){ float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.0);
  vec3 c = mix(uCore, uRim, f) + uHit * vec3(1.6, 1.4, 1.1);
  gl_FragColor = vec4(c, (0.82 + f * 0.18) * uFade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function gloamMaterial(core: any = 0x07040c, rim: any = 0x7a52d8) : any {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uSeed: { value: rnd(0, 10) }, uCore: { value: new THREE.Color(core) }, uRim: { value: new THREE.Color(rim) }, uHit: { value: 0 }, uFade: { value: 1 } },
    vertexShader: GLOAM_VS, fragmentShader: GLOAM_FS, transparent: true, depthWrite: true,
  });
}
const GL_GEO: any = { body: new THREE.IcosahedronGeometry(1, 2), eye: new THREE.SphereGeometry(1, 8, 6) };
const EYE_MAT: any = new THREE.MeshBasicMaterial({ color: 0xd8f0ff });
const BOSS_EYE_MAT: any = new THREE.MeshBasicMaterial({ color: 0xffe0a0 });
function makeGloamMesh(type: any) : any {
  const T: any = ENEMY[type] || ENEMY.gloamling, g: any = new THREE.Group(), mat: any = gloamMaterial();
  if (type === 'shade') {
    const lg: any = new THREE.LatheGeometry([[0.001, 0], [0.42, 0.08], [0.5, 0.5], [0.4, 1.1], [0.3, 1.5], [0.36, 1.75], [0.3, 2.0], [0.001, 2.1]].map((p: any) => new THREE.Vector2(p[0], p[1])), 12);
    const body: any = new THREE.Mesh(lg, mat); g.add(body);
    for (const s of [-1, 1]) { const e: any = new THREE.Mesh(GL_GEO.eye, EYE_MAT); e.scale.setScalar(0.055); e.position.set(s * 0.12, 1.82, 0.3); g.add(e); }
    for (const s of [-1, 1]) { const a: any = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.1, 6), mat); a.position.set(s * 0.52, 1.1, 0.1); a.rotation.z = s * 0.5; g.add(a); }
  } else {
    const body: any = new THREE.Mesh(GL_GEO.body, mat); body.scale.set(T.size, T.size * 1.1, T.size); g.add(body);
    const tail: any = new THREE.Mesh(new THREE.ConeGeometry(T.size * 0.7, T.size * 2.2, 8), mat); tail.rotation.x = PI / 2 + 0.3; tail.position.set(0, -0.05, -T.size * 1.2); g.add(tail);
    for (const s of [-1, 1]) { const e: any = new THREE.Mesh(GL_GEO.eye, EYE_MAT); e.scale.setScalar(T.size * 0.16); e.position.set(s * T.size * 0.38, T.size * 0.2, T.size * 0.86); g.add(e); }
  }
  g.traverse((o: any) => { if (o.isMesh) o.castShadow = false; });
  scene.add(g);
  return { g, mat };
}
function spawnEnemy(type: any, x: any, z: any, o: any = {}) : any {
  const T: any = ENEMY[type], m: any = makeGloamMesh(type);
  const y: any = groundAt(x, z, 60).h;
  const e: any = { type, T, x, z, y, vx: 0, vz: 0, hp: o.hp ?? T.hp, hpMax: o.hp ?? T.hp, atkT: rnd(0.3, 1), stag: 0, hitT: 0, t: rnd(0, 10), home: { x, z }, zone: o.zone, g: m.g, mat: m.mat, alive: true, fade: 0, ug: !!o.ug, ry: rnd(0, TAU), lure: null };
  COMBAT.enemies.push(e);
  return e;
}
function killEnemy(e: any, quiet?: any) : any {
  e.alive = false; e.dieT = 0;
  if (quiet) { e.dieT = 1; return; }
  COMBAT.kills++; G.stats.gloam++;
  AUDIO.gloamDie?.();
  // the shadow unravels and drifts away north-east, home toward the Hollow
  for (let i: any = 0; i < 34; i++) PS.n.spawn(e.x + rnd(-0.4, 0.4), e.y + rnd(0.3, 1.2) * (e.type === 'shade' ? 1.6 : 1), e.z + rnd(-0.4, 0.4), rnd(0.2, 1.2), rnd(0.6, 1.6), rnd(-1.8, -0.4), rnd(1.4, 2.6), 0.25, 0.6, _pc.set(pick([0x1a1024, 0x2a1a3a, 0x120a1a])), 0.75, 0, { drag: 0.6, ly: e.ug ? 1 : 0 });
  for (let i: any = 0; i < 16; i++) PS.a.spawn(e.x, e.y + 0.6, e.z, rnd(-2, 2), rnd(0.5, 3), rnd(-2, 2), rnd(0.4, 0.9), 0.12, 0.02, _pc.set(pick([0xb08aff, 0x7a52d8, 0xe0d0ff])), 1.3, 0, { shape: 2, drag: 2, ly: e.ug ? 1 : 0 });
  if (G.flags.lantern) G.flame = Math.min(G.flameMax, G.flame + (e.type === 'shade' ? 1 : 0.5));
}
function hurtEnemiesAround(x: any, z: any, r: any, dmg: any, kb: any) : any {
  let n: any = 0;
  for (const e of COMBAT.enemies) {
    if (!e.alive || e.boss && !e.vulnerable) { if (e.boss && Math.hypot(e.x - x, e.z - z) < r + 2.5) e.bossShrugT = 0.6; continue; }
    const dx: any = e.x - x, dz: any = e.z - z, d: any = Math.hypot(dx, dz);
    if (d > r + (e.boss ? 2.6 : 0)) continue;
    e.hp -= dmg; e.hitT = 0.25; n++;
    if (!e.boss) { e.stag = 0.6; e.vx = dx / (d || 1) * kb; e.vz = dz / (d || 1) * kb; }
    if (e.hp <= 0) { if (e.boss) bossDefeated(e); else killEnemy(e); }
  }
  return n;
}
function hurtEnemy(e: any, dmg: any) : any {
  if (!e.alive || (e.boss && !e.vulnerable)) return;
  e.hp -= dmg; e.hitT = 0.2;
  if (e.hp <= 0) { if (e.boss) bossDefeated(e); else killEnemy(e); }
}

// ---- the player's warmth --------------------------------------------------------------------------------------------
function hurtPlayer(dmg: any, from: any) : any {
  if (COMBAT.down || SCENE.active || DLG.active || PV.iframes > 0) return;
  player.warmth = Math.max(0, (player.warmth ?? 10) - dmg);
  COMBAT.hurtFx = Math.min(1, COMBAT.hurtFx + 0.5 * dmg);
  COMBAT.regenT = 0;
  player.flinch = 0.25;
  AUDIO.hurt?.();
  // a word of advice, the first time
  if (!G.seen.tipGloam) { G.seen.tipGloam = true; UI.toast('The gloam', IS_TOUCH ? 'They go for your lantern. Flare (2) drives them back, Mend (1) warms you, and » dashes clear.' : 'They go for your lantern. Flare (2) drives them back, Mend (1) warms you, and Space dashes clear.', 'combat', 6); }
  else if (player.warmth <= 4 && !G.seen.tipCold) { G.seen.tipCold = true; UI.toast('You\u2019re going cold', 'Cast Mend (1), or get close to a fire. If your warmth runs out, your friends will carry you back to the nearest wayfire.', 'cold', 6); }
  if (from) for (let i: any = 0; i < 10; i++) PS.n.spawn(lerp(from.x, player.x, i / 10), player.y + 0.9, lerp(from.z, player.z, i / 10), 0, 0.2, 0, 0.5, 0.18, 0.05, _pc.set(0x1a1024), 0.7, 0, { ly: UG.zone ? 1 : 0 });
  if (player.warmth <= 0) faint();
}
function faint() : any {
  if (COMBAT.down) return;
  COMBAT.down = true; G.stats.faints++;
  cutscene('faint', async () => {
    player.pose = 'lie'; player.yaw0 = player.face;
    UI.toast('The cold takes you', 'Everything goes grey and quiet…', 'cold', 2.5);
    AUDIO.faint?.();
    await wait(1.4);
    await fadeOut(0.8);
    for (const e of COMBAT.enemies) if (!e.boss && !e.ring && Math.hypot(e.x - player.x, e.z - player.z) < (COMBAT.faintHook ? 9 : 60)) killEnemy(e, true);
    if (COMBAT.faintHook) COMBAT.faintHook();
    else { const wf: any = nearestWayfire(player.x, player.z) || { x: -7.5, z: 11, y: 0 }; teleportParty(wf.x + 1.6, wf.z + 1.6, PI * 0.75); }
    player.pose = 'stand';
    player.warmth = player.warmthMax ?? 10;
    G.flame = Math.max(G.flame, 3);
    COMBAT.down = false;
    await wait(0.3);
    await fadeIn(0.8);
    UI.bubble(PARTY[1], pick(['Easy. We dragged you to the fire. You\'re heavier than you look.', 'Up you get. That\'s twice I\'ve carried someone this week.', 'Back with us? Good. Don\'t do that again.']), 4);
    if (COMBAT.boss && COMBAT.boss.alive) resetBoss();
  });
}
function nearestWayfire(x: any, z: any) : any {
  let best: any = null, bd: any = 1e9;
  for (const f of KFIRES) if ((f.wayfire || f.beacon) && f.lit) { const d: any = Math.hypot(f.x - x, f.z - z); if (d < bd) { bd = d; best = f; } }
  return best;
}

// ---- spawning ---------------------------------------------------------------------------------------------------------
// zones: { x, z, r, max, types, when() } — supplied by the story
function updateSpawns(dt: any) : any {
  if (COMBAT.calm || SCENE.active || DLG.active || UG.zone || CUT.b) return;   // nothing comes for you underground or indoors
  COMBAT.spawnT -= dt;
  if (COMBAT.spawnT > 0) return;
  COMBAT.spawnT = rnd(2.5, 5);
  const alive: any = COMBAT.enemies.filter((e: any) => e.alive && !e.boss).length;
  if (alive >= 7) return;
  for (const zn of COMBAT.zones) {
    if (zn.when && !zn.when()) continue;
    const dz: any = Math.hypot(zn.x - player.x, zn.z - player.z);
    if (dz > zn.r + 34) continue;
    const here: any = COMBAT.enemies.filter((e: any) => e.alive && e.zone === zn).length;
    if (here >= zn.max) continue;
    for (let tries: any = 0; tries < 12; tries++) {
      const a: any = rnd(0, TAU), r: any = Math.sqrt(R()) * zn.r, x: any = zn.x + Math.cos(a) * r, z: any = zn.z + Math.sin(a) * r;
      const pd: any = Math.hypot(x - player.x, z - player.z);
      if (pd < 13 || pd > 34 || !inWorld(x, z) || terrainH(x, z) < WATER_Y - 0.6 && !zn.water) continue;
      if (safeFromGloam(x, z)) continue;
      const type: any = pick(zn.types || ['gloamling']);
      const e: any = spawnEnemy(type, x, z, { zone: zn });
      for (let i: any = 0; i < 20; i++) PS.n.spawn(x + rnd(-0.6, 0.6), e.y + rnd(0, 1), z + rnd(-0.6, 0.6), 0, rnd(0.2, 0.6), 0, rnd(0.8, 1.5), 0.3, 0.8, _pc.set(0x140c1c), 0.6, 0, {});
      break;
    }
    break;
  }
}
// places the gloam won't go: the lamplit village, Hesk's warded isle, lit wayfires, beacons and wisp-lamps
const SAFE: any = { list: [], t: 0 };
function safeCircles() : any {
  if (SAFE.t > 0) return SAFE.list;
  SAFE.t = 0.5;
  const L: any = SAFE.list; L.length = 0;
  if (!COMBAT.villageOpen) L.push({ x: 0, z: 0, r: 50, village: true });
  L.push({ x: -118, z: 90.4, r: 9 });
  for (const f of KFIRES) if (f.lit && (f.wayfire || f.beacon)) L.push({ x: f.x, z: f.z, r: 6 });
  for (const l of LAMPS) if (l.lit) L.push({ x: l.x, z: l.z, r: 4.5 });
  return L;
}
function safeFromGloam(x: any, z: any) : any {
  for (const c of safeCircles()) if (Math.hypot(x - c.x, z - c.z) < c.r + 2) return true;
  return false;
}

// ---- per frame -----------------------------------------------------------------------------------------------------------
const _ep: any = new V3();
function updateEnemies(dt: any, t: any) : any {
  SAFE.t -= dt;
  updateSpawns(dt);
  const calmNow: any = COMBAT.calm;
  for (let i: any = COMBAT.enemies.length - 1; i >= 0; i--) {
    const e: any = COMBAT.enemies[i];
    e.t += dt;
    if (!e.alive) {
      e.dieT += dt * 2.5;
      e.g.scale.setScalar(Math.max(0.01, 1 - e.dieT) * (e.boss ? e.bossScale : 1));
      e.mat.uniforms.uFade.value = Math.max(0, 1 - e.dieT);
      if (e.dieT >= 1) { scene.remove(e.g); e.mat.dispose(); COMBAT.enemies.splice(i, 1); }
      continue;
    }
    if (e.boss) { updateBoss(e, dt, t); continue; }
    const pd: any = Math.hypot(player.x - e.x, player.z - e.z);
    if ((pd > 80 || (UG.zone && !e.ug)) && !e.ring) { killEnemy(e, true); continue; }   // gone below ground: they lose you
    e.fade = Math.min(1, e.fade + dt * 1.5);
    // what it wants: your lantern — unless a wisp is dancing nearby, or it's been told to keep its distance
    let tx: any = player.x, tz: any = player.z, want: any = true;
    const wisp: any = MAGIC.wisps.find((w: any) => Math.hypot(w.x - e.x, w.z - e.z) < 12);
    if (wisp) { tx = wisp.x; tz = wisp.z; }
    if (e.homeward) { e.x += 1.6 * dt; e.z -= 2.2 * dt; e.y += 0.6 * dt; e.g.position.set(e.x, e.y, e.z); e.mat.uniforms.uT.value = e.t; e.mat.uniforms.uFade.value = Math.max(0, e.mat.uniforms.uFade.value - dt * 0.3); if (R() < dt * 8) PS.a.spawn(e.x, e.y + 0.4, e.z, rnd(-0.3, 0.3), rnd(0.2, 0.6), rnd(-0.3, 0.3), 1.2, 0.14, 0.02, _pc.set(0x9affb0), 1.2, 0, { shape: 2 }); continue; }
    if (e.ring) { const r: any = e.ring; r.a += r.sp * dt; tx = r.cx + Math.cos(r.a) * r.r; tz = r.cz + Math.sin(r.a) * r.r; want = false; }
    else if (calmNow) { const a: any = e.t * 0.4 + e.home.x; tx = player.x + Math.cos(a) * 7; tz = player.z + Math.sin(a) * 7; want = false; }
    if ((pd > 26 || CUT.b) && !wisp && !calmNow && !e.ring) { tx = e.home.x + Math.cos(e.t * 0.3) * 4; tz = e.home.z + Math.sin(e.t * 0.3) * 4; want = false; }   // indoors, they lose the scent
    let dx: any = tx - e.x, dz: any = tz - e.z;
    const d: any = Math.hypot(dx, dz) || 1;
    let sp: any = e.T.speed * (e.stag > 0 ? 0 : 1) * (want ? 1 : 0.5);
    dx /= d; dz /= d;
    // shy of light: lit lamps and wayfires push them away
    for (const l of LAMPS) if (l.lit) { const lx: any = e.x - l.x, lz: any = e.z - l.z, ld: any = Math.hypot(lx, lz); if (ld < 6 && ld > 1e-3) { dx += lx / ld * 1.5; dz += lz / ld * 1.5; } }
    // keep apart from each other
    for (const o of COMBAT.enemies) if (o !== e && o.alive && !o.boss) { const ox: any = e.x - o.x, oz: any = e.z - o.z, od: any = Math.hypot(ox, oz); if (od < 1.1 && od > 1e-3) { dx += ox / od * 0.8; dz += oz / od * 0.8; } }
    if (want && d < e.T.reach * 0.8) sp = 0;
    const dl: any = Math.hypot(dx, dz) || 1;
    e.vx = dampf(e.vx, dx / dl * sp, e.stag > 0 ? 2 : 5, dt); e.vz = dampf(e.vz, dz / dl * sp, e.stag > 0 ? 2 : 5, dt);
    e.x += e.vx * dt; e.z += e.vz * dt;
    if (!inWorld(e.x, e.z)) { e.x -= e.vx * dt; e.z -= e.vz * dt; }
    if (!e.ring) for (const c of safeCircles()) {
      if (c.village && e.zone?.inside) continue;
      const ox: any = e.x - c.x, oz: any = e.z - c.z, od: any = Math.hypot(ox, oz);
      if (od < c.r && od > 1e-3) { e.x = c.x + ox / od * c.r; e.z = c.z + oz / od * c.r; }
    }
    const gy0: any = groundAt(e.x, e.z, e.y + 2).h;
    e.y = dampf(e.y, Math.max(gy0, WATER_Y) + (e.type === 'shade' ? 0.05 : 0.55) + Math.sin(e.t * 2.4) * 0.12, 6, dt);
    e.stag = Math.max(0, e.stag - dt); e.hitT = Math.max(0, e.hitT - dt);
    // attack
    e.atkT -= dt;
    if (want && !wisp && pd < e.T.reach && e.atkT <= 0 && e.stag <= 0) { e.atkT = e.T.rate; hurtPlayer(e.T.dmg, e); e.lunge = 0.3; }
    e.lunge = Math.max(0, (e.lunge || 0) - dt);
    // pose
    e.ry = dampA(e.ry, Math.atan2(player.x - e.x, player.z - e.z), 6, dt);
    e.g.position.set(e.x + Math.sin(e.ry) * e.lunge * 1.2, e.y, e.z + Math.cos(e.ry) * e.lunge * 1.2);
    e.g.rotation.y = e.ry;
    e.g.scale.setScalar(e.fade * (1 + Math.sin(e.t * 5) * 0.03));
    e.mat.uniforms.uT.value = e.t; e.mat.uniforms.uHit.value = e.hitT * 3;
    e.g.visible = e.ug ? UG.ugShown : !UG.surfHidden;
    if (R() < dt * 9) PS.n.spawn(e.x + rnd(-0.2, 0.2), e.y + (e.type === 'shade' ? rnd(0.3, 1.6) : rnd(-0.1, 0.3)), e.z + rnd(-0.2, 0.2), -e.vx * 0.3, rnd(0.1, 0.4), -e.vz * 0.3, rnd(0.6, 1.1), 0.18, 0.5, _pc.set(pick([0x140c1c, 0x24183a])), 0.55, 0, { drag: 1 });
  }
  // the player's warmth comes back away from danger, and quickly by a fire
  COMBAT.regenT += dt;
  const fireNear: any = KFIRES.some((f: any) => f.lit && Math.hypot(f.x - player.x, f.z - player.z) < 4);
  if (!COMBAT.down && player.warmth < (player.warmthMax ?? 10) && (COMBAT.regenT > 4 || fireNear)) player.warmth = Math.min(player.warmthMax ?? 10, player.warmth + dt * (fireNear ? 1.5 : 0.3));
  COMBAT.hurtFx = Math.max(0, COMBAT.hurtFx - dt * 0.8);
  updateCompanionFight(dt, t);
  updateDecals(dt);
}

// ---- Brakka and Elowen join in ----------------------------------------------------------------------------------------------
function nearestEnemy(x: any, z: any, maxD: any) : any {
  let best: any = null, bd: any = maxD;
  for (const e of COMBAT.enemies) { if (!e.alive || (e.boss && !e.vulnerable)) continue; const d: any = Math.hypot(e.x - x, e.z - z); if (d < bd) { bd = d; best = e; } }
  return best;
}
function updateCompanionFight(dt: any, t: any) : any {
  const brakka: any = PARTY[1], elowen: any = PARTY[2];
  if (!brakka || COMBAT.calm) { if (brakka) brakka.fightTarget = null; return; }
  // Brakka wades in once his axe carries fire
  if (G.flags.axeKindled) {
    const e: any = nearestEnemy(player.x, player.z, 7.5);
    brakka.fightTarget = e;
    brakka.atkT = (brakka.atkT || 0) - dt;
    if (e && Math.hypot(e.x - brakka.x, e.z - brakka.z) < 1.5 && brakka.atkT <= 0) {
      brakka.atkT = 1.15; brakka.swingT = 0.4;
      hurtEnemy(e, 1.5); e.stag = 0.4;
      AUDIO.thud?.();
      for (let i: any = 0; i < 10; i++) PS.a.spawn(e.x, e.y + 0.4, e.z, rnd(-2, 2), rnd(0.5, 2), rnd(-2, 2), 0.4, 0.1, 0.02, _pc.set(0xffa040), 1.3, 0, { shape: 2 });
    }
  } else brakka.fightTarget = null;
  // Elowen's staff speaks in starlight
  if (elowen) {
    elowen.boltT = (elowen.boltT || 0) - dt;
    const e: any = nearestEnemy(elowen.x, elowen.z, 10);
    if (e && elowen.boltT <= 0 && elowen.rig.orb) {
      elowen.boltT = 1.7; elowen.castT = 0.45;
      elowen.rig.item.updateWorldMatrix(true, false);
      const o: any = elowen.rig.orb.clone().applyMatrix4(elowen.rig.item.matrixWorld);
      COMBAT.decals.push({ bolt: true, x: o.x, y: o.y, z: o.z, e, t: 0 });
      AUDIO.bolt?.();
    }
  }
}
function updateDecals(dt: any) : any {
  for (let i: any = COMBAT.decals.length - 1; i >= 0; i--) {
    const d: any = COMBAT.decals[i];
    if (d.bolt) {
      const e: any = d.e, tx: any = e.x, ty: any = e.y + 0.5, tz: any = e.z, dx: any = tx - d.x, dy: any = ty - d.y, dz: any = tz - d.z, L: any = Math.hypot(dx, dy, dz), st: any = Math.min(L, 16 * dt);
      d.x += dx / (L || 1) * st; d.y += dy / (L || 1) * st; d.z += dz / (L || 1) * st;
      for (let k: any = 0; k < 3; k++) PS.a.spawn(d.x + rnd(-0.05, 0.05), d.y, d.z + rnd(-0.05, 0.05), 0, 0, 0, 0.25, 0.16, 0.02, _pc.set(pick([0x9ae8ff, 0xffffff, 0xc8f0ff])), 1.5, 0, { shape: 2, ly: UG.zone ? 1 : 0 });
      d.t += dt;
      if (L < 0.35 || !e.alive || d.t > 2) { if (e.alive && L < 0.6) { hurtEnemy(e, 1); e.stag = Math.max(e.stag, 0.25); } COMBAT.decals.splice(i, 1); }
      continue;
    }
    d.t += dt;
    if (d.mesh) {
      const u: any = clamp(d.t / d.warn, 0, 1);
      d.mesh.scale.setScalar(d.r * (0.3 + 0.7 * u));
      d.mesh.material.opacity = 0.25 + 0.55 * u;
      if (d.t >= d.warn && !d.fired) {
        d.fired = true;
        if (Math.hypot(player.x - d.x, player.z - d.z) < d.r) hurtPlayer(d.dmg, d);
        for (let k: any = 0; k < 30; k++) PS.n.spawn(d.x + rnd(-d.r, d.r) * 0.7, d.y + 0.1, d.z + rnd(-d.r, d.r) * 0.7, rnd(-1, 1), rnd(2, 5), rnd(-1, 1), rnd(0.5, 0.9), 0.3, 0.6, _pc.set(0x120a1a), 0.8, 0, { grav: 4 });
        AUDIO.slam?.();
      }
      if (d.t > d.warn + 0.4) { scene.remove(d.mesh); d.mesh.material.dispose(); COMBAT.decals.splice(i, 1); }
    }
  }
}
const DECAL_GEO: any = new THREE.CircleGeometry(1, 32).rotateX(-PI / 2);
function shadowSlam(x: any, z: any, r: any = 2.2, warn: any = 1.2, dmg: any = 2) : any {
  const y: any = groundAt(x, z, player.y + 2).h + 0.05;
  const m: any = new THREE.Mesh(DECAL_GEO, new THREE.MeshBasicMaterial({ color: 0x1a0a2a, transparent: true, opacity: 0.3, depthWrite: false }));
  m.position.set(x, y, z); m.renderOrder = 4; scene.add(m);
  COMBAT.decals.push({ mesh: m, x, y, z, r, warn, dmg, t: 0 });
}

// ---- the Hollow: a knot of gloam as big as a barn, wrapped round the wizard ---------------------------------------------------
function spawnBoss() : any {
  const H: any = SITES.hollow, gt: any = SITES.greatTree;
  const e: any = spawnEnemy('shade', H.x + 1.5, H.z - 4.5, { hp: 12 });
  e.boss = true; e.bossScale = 2.6; e.vulnerable = false; e.phase = 0; e.slamT = 3; e.spawnT = 4; e.vulnT = 0; e.homeX = e.x; e.homeZ = e.z;
  e.g.scale.setScalar(e.bossScale);
  e.mat.uniforms.uRim.value.set(0x9a6af8);
  e.g.children.forEach((c: any) => { if (c.material === EYE_MAT) c.material = BOSS_EYE_MAT; });
  // its three hats, stacked
  const hatMat: any = new THREE.MeshBasicMaterial({ color: 0x0c0814 });
  for (let i: any = 0; i < 3; i++) { const h: any = new THREE.Mesh(new THREE.ConeGeometry(0.26 - i * 0.03, 0.5, 8), hatMat); h.position.set(0, 2.25 + i * 0.32, 0); h.rotation.z = (i - 1) * 0.18; e.g.add(h); const br: any = new THREE.Mesh(new THREE.CylinderGeometry(0.38 - i * 0.05, 0.38 - i * 0.05, 0.03, 12), hatMat); br.position.set(0, 2.02 + i * 0.32, 0); e.g.add(br); }
  e.shroud = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 2), gloamMaterial(0x05030a, 0x4a2a8a));
  e.shroud.position.set(0, 1.1, 0); e.shroud.material.uniforms.uFade.value = 0.85; e.g.add(e.shroud);
  COMBAT.boss = e;
  for (const f of SITES.hollow.braziers) setFireLit(f, false, true);
  return e;
}
function bossBraziersLit() : any { return SITES.hollow.braziers.filter((f: any) => f.lit).length; }
function updateBoss(e: any, dt: any, t: any) : any {
  e.mat.uniforms.uT.value = t; e.mat.uniforms.uHit.value = e.hitT * 3; e.hitT = Math.max(0, e.hitT - dt);
  e.shroud.material.uniforms.uT.value = t * 1.3;
  const lit: any = bossBraziersLit();
  if (!e.vulnerable) {
    e.shroud.scale.setScalar(1 + (4 - lit) * 0.12 + Math.sin(t * 3) * 0.05);
    e.shroud.material.uniforms.uFade.value = 0.25 + (4 - lit) * 0.18;
    if (lit >= 4) { e.vulnerable = true; e.vulnT = 11; UI.toast('The shroud burns away', 'Now — flare it while the braziers burn!', 'combat', 2.4); AUDIO.roar?.(); }
  } else {
    e.vulnT -= dt;
    e.shroud.material.uniforms.uFade.value = 0;
    if (e.vulnT <= 0) {   // it breathes the braziers out and pulls its shroud back on
      e.vulnerable = false;
      for (const f of SITES.hollow.braziers) setFireLit(f, false, true);
      UI.toast('The Hollow breathes out', 'The braziers gutter and die. Light them again.', 'combat', 2.4);
      for (let k: any = 0; k < 60; k++) { const a: any = rnd(0, TAU); PS.n.spawn(e.x, e.y + 1.5, e.z, Math.cos(a) * rnd(4, 9), rnd(0, 1), Math.sin(a) * rnd(4, 9), rnd(0.8, 1.4), 0.4, 1.2, _pc.set(0x0c0814), 0.7, 0, { drag: 1.5 }); }
      AUDIO.roar?.();
    }
  }
  e.bossShrugT = Math.max(0, (e.bossShrugT || 0) - dt);
  // sway in place, reach out with slams, spit out gloamlings
  e.x = e.homeX + Math.sin(t * 0.5) * 1.2; e.z = e.homeZ + Math.cos(t * 0.37) * 0.8;
  e.y = dampf(e.y, terrainH(e.x, e.z) + 0.1, 3, dt);
  e.ry = dampA(e.ry, Math.atan2(player.x - e.x, player.z - e.z), 2, dt);
  e.g.position.set(e.x, e.y, e.z); e.g.rotation.y = e.ry;
  e.g.scale.setScalar(e.bossScale * (1 + Math.sin(t * 1.6) * 0.03) * (e.bossShrugT > 0 ? 1.05 : 1));
  if (SCENE.active || DLG.active || COMBAT.down) return;
  e.slamT -= dt; e.spawnT -= dt;
  const pd: any = Math.hypot(player.x - e.x, player.z - e.z);
  if (e.slamT <= 0 && pd < 22) { e.slamT = e.vulnerable ? 3.2 : 2.4; shadowSlam(player.x + rnd(-0.6, 0.6), player.z + rnd(-0.6, 0.6), 2.3, 1.15, 2); if (e.hp < 6) shadowSlam(player.x + rnd(-4, 4), player.z + rnd(-4, 4), 2.0, 1.4, 2); }
  if (e.spawnT <= 0) {
    e.spawnT = 7;
    const n: any = COMBAT.enemies.filter((o: any) => o.alive && !o.boss).length;
    if (n < 4) for (let k: any = 0; k < 2; k++) { const a: any = rnd(0, TAU); const g: any = spawnEnemy('gloamling', e.x + Math.cos(a) * 3, e.z + Math.sin(a) * 3, { zone: 'boss' }); g.fade = 0.3; }
  }
}
function resetBoss() : any {
  const e: any = COMBAT.boss; if (!e) return;
  e.hp = e.hpMax; e.vulnerable = false;
  for (const f of SITES.hollow.braziers) setFireLit(f, false, true);
}
function bossDefeated(e: any) : any {
  e.alive = false; e.dieT = 0; COMBAT.boss = null;
  for (const o of COMBAT.enemies) if (o.alive) killEnemy(o);
  AUDIO.bossDie?.();
  for (let i: any = 0; i < 160; i++) PS.n.spawn(e.x + rnd(-1.5, 1.5), e.y + rnd(0.5, 5), e.z + rnd(-1.5, 1.5), rnd(-2, 2), rnd(1, 4), rnd(-4, -0.5), rnd(2, 4), 0.4, 1.4, _pc.set(pick([0x1a1024, 0x2a1a3a, 0x120a1a])), 0.75, 0, { drag: 0.4 });
  for (const h of HOOK.fire) h('boss', e);
}
