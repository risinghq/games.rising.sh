// ============================================================================
//  STORY WORLD — the things the story puts into the valley: Orrin's hats,
//  the fen's wisps, the barrow slab, the cocoon, the Wood's own shape, the
//  toad and the cat, and where everyone stands at each point of the night.
// ============================================================================
const HAT_OBJ: any = {};       // id -> { mesh, x, y, z, b, f, ug }
const WISPS: any = [];         // fen wisps: { f (kfire), home, mesh, e, t, hold }
const STORY: any = { slab: null, cocoon: null, hart: null, toad: null, cat: null, carry: null, lastFieldAsk: -99 };
const storyMat: any = { surf: null, free: null };

// ---- small helpers -----------------------------------------------------------------------------------------
function face(c: any, t: any) : any { c.face = Math.atan2(t.x - c.x, t.z - c.z); if (c.home) c.home.face = c.face; }
function putAt(c: any, x: any, z: any, fc: any, o: any = {}) : any {
  c.b = o.b ?? null; c.f = o.f ?? 0; c.ug = !!o.ug;
  c.x = x; c.z = z; c.y = o.y ?? groundAt(x, z, 60).h; c.smoothY = c.y; c.vy = 0;
  if (fc !== undefined && fc !== null) c.face = fc;
  c.home = { x, z, face: c.face };
  c.mode = o.mode ?? 'idle'; c.pose = o.pose ?? 'stand';
  if (o.act !== undefined) c.act = o.act;
  c.away = false; c.talking = false;
  c.root.position.set(c.x, c.y, c.z);
}
function remember(c: any) : any { c.spawn = { x: c.x, y: c.y, z: c.z, face: c.face, b: c.b, f: c.f, pose: c.pose, act: c.act, mode: c.mode, ug: c.ug, sitY: c.sitY, wp: c.wp, circle: c.circle }; }
function goHome(c: any) : any {
  const s: any = c.spawn; if (!s) return;
  Object.assign(c, { x: s.x, y: s.y, z: s.z, face: s.face, b: s.b, f: s.f, pose: s.pose, act: s.act, mode: s.mode, ug: s.ug, sitY: s.sitY, wp: s.wp, circle: s.circle, away: false, talking: false });
  c.smoothY = c.y; c.home = { x: s.x, z: s.z, face: s.face }; c.wpi = 0;
}
function hatMesh(c: any = 0x3a2a6a, band: any = 0xc79b3e, pat: any = PAT.NOISE) : any {
  const b: any = new Batch();
  withLocal(() => {
    B.to(b); B.occ = 0;
    cyl(0, 0, 0, 0.27, 0.28, 0.025, 14, c, pat);
    cyl(0, 0.02, 0, 0.0, 0.16, 0.46, 10, c, pat, { rx: -0.18 });
    cyl(0, 0.03, 0, 0.165, 0.17, 0.05, 10, band, PAT.METAL);
    sph(0.0, 0.43, -0.08, 0.035, MET.gold, 0, { det: 0, em: 0.8 });
  });
  return b.toGeometry();
}

// ---- setup: runs once at boot, after everything is built and everyone is spawned ---------------------------
function setupStory() : any {
  storyMat.surf = worldMat({ rough: 0.8 });
  storyMat.free = worldMat({ rough: 0.8, layer: 0 });
  for (const c of CHARS) remember(c);
  // Orrin is not in his tower: he is in a cocoon of gloam at the foot of the great tree
  const orrin: any = N('orrin');
  if (orrin) { orrin.talkable = false; orrin.act = null; putAt(orrin, SITES.cocoon.x, SITES.cocoon.z, PI * 0.9, { pose: 'kneel' }); remember(orrin); }
  // Mother Hesk, in her hut on the fen
  { const p: any = V.hesk.localY(0.6, V.hesk.levels[0], -0.9);
    const h: any = new Character({ id: 'hesk', name: 'Mother Hesk', title: 'Wisp-wife of the fen', x: p.x, z: p.z, y: p.y, face: V.hesk.s.rot * DEG + PI * 0.15, act: 'stir', b: V.hesk, f: 0,
      look: { skin: 0xd8b49a, hair: 0xe0dcd0, hairStyle: 'long', build: 'slim', shirt: 0x4a5a3a, sleeve: 0x4a5a3a, dress: 0x3a4a2e, cloak: 0x5a6a4a, hat: 'hood', hatC: 0x5a6a4a, item: 'ladle', boots: 0x3a2e22 },
      amb: ['*stir stir*', 'Don’t touch the jars.', 'Hmph.'] });
    remember(h); }
  // Ada, who waits in her barrow (unseen until her candles are lit)
  { const T: any = UGP.adaTomb; const a: any = makeEcho({ id: 'ada', name: 'Ada Emberwick', title: 'The first Kindler', x: T.x - 0.2, z: T.z + 1.4, y: T.y, face: PI, ug: true,
      look: { skin: 0xd8c8b8, hair: 0x5a4a3a, hairStyle: 'braids', shirt: 0x5a5a6a, sleeve: 0x5a5a6a, dress: 0x4a4a5a, cloak: 0x3a3a4a, item: 'candle' } });
    a.talkable = true; a.away = true; a.ug = true; a.ghost = true; remember(a); a.spawn.away = true; }
  // hats in the world
  const T: any = V.tower;
  addHat('thinking', T.localY(0.35, T.levels[2] + 0.8, -3.35), { b: T, f: 2, c: 0x2a3a6a });
  addHat('camping', { x: SITES.camp.x + 1.5, y: terrainH(SITES.camp.x + 1.5, SITES.camp.z + 0.9) + 0.02, z: SITES.camp.z + 0.9 }, { c: 0x4a5a2a });
  addHat('visiting', { x: UGP.adaTomb.x - 0.55, y: UGP.adaTomb.y + 1.02, z: UGP.adaTomb.z + 0.15 }, { ug: true, c: 0x3a2a3a });
  { const sx: any = SITES.sheaf.x - 9, sz: any = SITES.sheaf.z + 6; addHat('garden', { x: sx, y: terrainH(sx, sz) + 1.92, z: sz }, { c: 0x5a3a2a }); }
  addHat('invisible', UGP.hatInvisible, { ug: true, c: 0x4a5a8a, hidden: true });
  // the tiny hat on the sleeping troll's head
  { const tr: any = N('troll'); if (tr && tr.headG) { const m: any = new THREE.Mesh(hatMesh(0x6a2a5a), storyMat.free); m.position.set(0.08, 0.86, -0.02); m.rotation.set(-0.3, 0, 0.35); m.scale.setScalar(0.9); tr.headG.add(m); HAT_OBJ.diplomacy = { mesh: m, worn: true }; } }
  // the barrow's sealing slab
  { const D: any = SITES.barrowDoor, b: any = new Batch();
    withLocal(() => { B.to(b); B.occ = 1; box(0, -0.3, 0, 0.4, 2.85, 2.7, 0x8e8c82, PAT.STONE); for (let i: any = 0; i < 3; i++) box(0.21, 0.6 + i * 0.6, 0, 0.02, 0.06, 1.6 - i * 0.3, 0xd8d0b0, 0, { em: -0.6, occ: 0 }); });
    const m: any = new THREE.Mesh(b.toGeometry(), storyMat.surf); m.position.set(D.x + 0.65, D.y, D.z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    // while the slab is shut it also fills the passage cut into the mound behind it, so nobody can climb
    // down off the barrow into the doorway and get stuck there
    const col: any = addColW(D.x - 1.2, D.z, 2.1, 1.45, 1, 0, D.y - 0.5, D.y + 6, 'slab');
    STORY.slab = { mesh: m, col, y0: D.y, t: null }; }
  // the cocoon round Orrin
  { const c: any = SITES.cocoon, m: any = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), gloamMaterial(0x07040c, 0x5a3a9a));
    m.scale.set(0.95, 1.2, 0.95); m.position.set(c.x, c.y + 0.75, c.z); m.material.uniforms.uFade.value = 0.92; scene.add(m); STORY.cocoon = m; }
  buildHart();
  // the fen's wisps
  for (const s of WISPSPOTS) addWisp(s.x, s.z);
  // the cat on the mere and the toad on his island
  { const a: any = makeAnimal('cat'); a.x = SITES.catIsle.x - 0.3; a.z = SITES.catIsle.z + 0.2; a.y = terrainH(a.x, a.z); a.ry = 2.2; a.sleep = true; STORY.cat = a; }
  { const b: any = new Batch(); withLocal(() => { B.to(b); B.occ = 0; toadGeo(); });
    const m: any = new THREE.Mesh(b.toGeometry(), storyMat.surf); const x: any = SITES.toadIsle.x - 0.6, z: any = SITES.toadIsle.z + 0.2; m.position.set(x, terrainH(x, z) + 0.02, z); m.rotation.y = 2.4; m.castShadow = true; scene.add(m); STORY.toad = m; }
  // the weaver's own cat is out on the fen, not by the fire
  STORY.homeCat = ANIMALS.find((a: any) => a.kind === 'cat' && a.b === V.weaver);
  // spots you can use
  setupSpots();
  setupZones();
  // fires that are only for later
  for (const id of ['bonfire']) { const f: any = fireById(id); if (f) f.locked = 'midnight'; }
  LOCKED_MSG.bonfire = () => q('main') < 15 ? 'The Kindling bonfire is for midnight, and for the Hearthstone.' : 'Not yet. Midnight.';
  LOCKED_MSG.hollow0 = LOCKED_MSG.hollow1 = LOCKED_MSG.hollow2 = LOCKED_MSG.hollow3 = () => 'A cold brazier, full of grey ash. It will take fire once the Hollow wakes.';
  for (let k: any = 0; k < 4; k++) { const f: any = fireById('hollow' + k); if (f) f.locked = 'hollowAwake'; }
  for (let k: any = 0; k < 7; k++) { const f: any = fireById('stone' + k); if (f) { f.puzzle = k; } }
  { const f: any = fireById('camp_orrin'); if (f) f.locked = 'campOpen'; LOCKED_MSG.camp_orrin = () => 'A cold campfire, a bedroll, an empty biscuit tin. Somebody camped here for days, and left in a hurry.'; }
  const wf: any = fireById('wf_square'); if (wf) setFireLit(wf, true, true);
  REVEALS.push({ x: UGP.cryptWall.x, z: UGP.cryptWall.z, r: 2.5, show(k: any) : any { if (k > 0.8 && UG.zone === 'crypt' && !G.flags.cryptWall) dispelCryptWall(); } });
  REVEALS.push({ x: UGP.hatInvisible.x, z: UGP.hatInvisible.z, r: 1, show(k: any) : any { if (k > 0.6 && UG.zone === 'vault') G.flags.sawInvisible = true; } });
  REVEALS.push({ x: SITES.altar.x, z: SITES.altar.z, r: 2, show(k: any) : any { if (k > 0.6) G.flags.readAltar = true; } });
}
function toadGeo() : any {
  ball(0, 0.09, 0, 0.13, 0x6a7a3a, PAT.NOISE, { sx: 1.2, sy: 0.75, sz: 1.0 });
  for (const s of [-1, 1]) { ball(s * 0.07, 0.17, 0.08, 0.04, 0x7a8a4a, 0); ball(s * 0.075, 0.185, 0.105, 0.018, 0x1a1a10, 0); box(s * 0.12, 0.02, 0.06, 0.08, 0.04, 0.06, 0x5a6a2a, 0); }
  box(0, 0.11, 0.135, 0.12, 0.012, 0.01, 0x3a3a1a, 0);
  cyl(0, 0.17, -0.02, 0.0, 0.05, 0.1, 6, 0x3a2a5a, 0);   // a very small hat. Of course.
}
function addHat(id: any, p: any, o: any = {}) : any {
  if (!p) return;
  const m: any = new THREE.Mesh(hatMesh(o.c), o.ug ? storyMat.free : storyMat.surf);
  if (o.hidden) {   // hidden hats only show under Reveal: re-tag the pattern so the shader hides them
    const pd: any = m.geometry.getAttribute('pd'); for (let i: any = 0; i < pd.count; i++) pd.setX(i, pd.getX(i) + 100); pd.needsUpdate = true;
  }
  m.position.set(p.x, p.y, p.z); m.rotation.y = rnd(0, TAU); m.castShadow = true;
  if (o.ug) m.userData.ug = true;
  scene.add(m);
  HAT_OBJ[id] = { mesh: m, x: p.x, y: p.y, z: p.z, b: o.b || null, f: o.f ?? 0, ug: !!o.ug, hidden: !!o.hidden };
  SPOTS.push({ id: 'hat_' + id, x: p.x, y: p.y - 0.6, z: p.z, ug: !!o.ug, verb: 'Pick up', name: () => HATS.find((h: any) => h.id === id).name, title: 'one of Orrin’s hats',
    when: () => !G.hats.includes(id) && (!o.hidden || G.flags.sawInvisible) && (!o.b || (CUT.b === o.b && CUT.f === o.f)), act: () => { AUDIO.chime?.(3); giveHat(id); } });
}
function hideHat(id: any) : any {
  const h: any = HAT_OBJ[id]; if (!h) return;
  if (h.mesh.parent) h.mesh.parent.remove(h.mesh);
}
function updateHats(t: any) : any {
  for (const id in HAT_OBJ) {
    const h: any = HAT_OBJ[id]; if (h.worn || !h.mesh.parent || h.mesh.parent !== scene) continue;
    let vis: any = h.ug ? UG.ugShown : !UG.surfHidden;
    if (h.b && CUT.enabled && CUT.b === h.b && h.f > CUT.f) vis = false;
    h.mesh.visible = vis;
    if (vis) { h.mesh.position.y = h.y + Math.sin(t * 2 + h.x) * 0.03; h.mesh.rotation.y += 0.004; }
  }
}
function dropHats(x: any, y: any, z: any) : any {   // the Hollow's three hats tumble out of it when it falls
  ['worry1', 'worry2', 'worry3'].forEach((id: any, i: any) => {
    if (G.hats.includes(id)) return;
    const a: any = i * TAU / 3 + 0.4, px: any = x + Math.cos(a) * 2.2, pz: any = z + Math.sin(a) * 2.2;
    addHat(id, { x: px, y: terrainH(px, pz) + 0.05, z: pz }, { c: 0x14101c });
  });
}

// ---- the wisps of the fen -------------------------------------------------------------------------------------
const WISP_GEO: any = new THREE.IcosahedronGeometry(0.12, 1);
function addWisp(x: any, z: any) : any {
  const y: any = Math.max(terrainH(x, z), WATER_Y) + 1.1;
  const f: any = kfire('wisp' + WISPS.length, 'wisp', x, y, z, { s: 0.5, lit: true, label: 'the wisp' });
  const mesh: any = new THREE.Mesh(WISP_GEO, new THREE.MeshBasicMaterial({ color: 0xc8ffd8 }));
  mesh.position.set(x, y, z); scene.add(mesh);
  const e: any = addEmitter(x, y, z, { color: 0x6aff9a, int: 3, range: 6, flick: 0.1, glow: 0.7, prio: 0 }); e.dynamic = true;
  WISPS.push({ f, home: { x, z }, mesh, e, t: rnd(0, 20), x, z, y, hold: 0, still: 0 });
}
function nearestWispFire() : any {
  let best: any = null, bd: any = 1e9;
  for (const w of WISPS) { const d: any = Math.hypot(w.x - player.x, w.z - player.z); if (d < bd) { bd = d; best = w.f; } }
  return best;
}
function updateFenWisps(dt: any, t: any) : any {
  const taught: any = G.flags.wispTaught, still: any = player.speed < 0.35 && !DLG.active;
  for (const w of WISPS) {
    w.t += dt;
    const d: any = Math.hypot(w.x - player.x, w.z - player.z);
    if (d > 70) continue;
    let tx: any = w.home.x + Math.cos(w.t * 0.31) * 2.6 + Math.sin(w.t * 0.13) * 1.4, tz: any = w.home.z + Math.sin(w.t * 0.27) * 2.6, sp: any = 1.0;
    if (MAGIC.drawing && MAGIC.drawing.f === w.f) { tx = w.x; tz = w.z; sp = 0; }
    else if (d < 9 && G.flags.lantern) {
      w.still = still ? w.still + dt : 0;
      if (taught && w.still > 0.6) { tx = player.x + (w.x - player.x) / d * 1.5; tz = player.z + (w.z - player.z) / d * 1.5; sp = 1.6; }   // shy, but curious
      else if (!still || !taught) { const k: any = (d < 5 ? 1 : 0.4); tx = w.x + (w.x - player.x) / d * 4 * k; tz = w.z + (w.z - player.z) / d * 4 * k; sp = d < 5 ? 3.4 : 1.4; }   // bolts away from anyone rushing at it
    }
    const dx: any = tx - w.x, dz: any = tz - w.z, dl: any = Math.hypot(dx, dz);
    if (dl > 0.02) { const st: any = Math.min(dl, sp * dt); w.x += dx / dl * st; w.z += dz / dl * st; }
    if (Math.hypot(w.x - w.home.x, w.z - w.home.z) > 14) { w.x = lerp(w.x, w.home.x, dt); w.z = lerp(w.z, w.home.z, dt); }
    w.y = Math.max(terrainH(w.x, w.z), WATER_Y) + 1.0 + Math.sin(w.t * 2.1) * 0.25;
    w.f.x = w.x; w.f.z = w.z; w.f.y = w.y - 0.3;
    w.mesh.position.set(w.x, w.y, w.z); w.mesh.visible = !UG.surfHidden;
    w.e.p.set(w.x, w.y, w.z); w.e.int = 2 + NIGHT * 3;
    if (R() < dt * 12 && w.mesh.visible) PS.a.spawn(w.x + rnd(-0.08, 0.08), w.y, w.z + rnd(-0.08, 0.08), rnd(-0.2, 0.2), rnd(-0.1, 0.2), rnd(-0.2, 0.2), rnd(0.4, 0.8), 0.16, 0.02, _pc.set(pick([0x7affa8, 0xd0ffe0, 0x4ae880])), 1.2, 0, { shape: 2 });
  }
}

// ---- the barrow slab, the crypt wall ----------------------------------------------------------------------------
function openSlab(quiet?: any) : any {
  const s: any = STORY.slab; if (!s) return;
  G.flags.slabOpen = true;
  if (s.open) return;
  s.open = true; s.col.off = true;
  if (quiet) { s.mesh.visible = false; return; }
  s.t = 0; AUDIO.crash?.(); CAM.shake = 0.6;
}
function updateSlab(dt: any) : any {
  const s: any = STORY.slab; if (!s || s.t === null || s.t === undefined) return;
  s.t += dt;
  const u: any = clamp(s.t / 2.6, 0, 1);
  s.mesh.position.y = s.y0 - u * 3.1 + Math.sin(s.t * 40) * 0.01 * (1 - u);
  if (R() < dt * 30 * (1 - u)) PS.n.spawn(s.mesh.position.x + rnd(-0.3, 0.3), s.y0 + 0.1, s.mesh.position.z + rnd(-1.3, 1.3), rnd(-0.5, 0.5), rnd(0.5, 1.5), rnd(-0.5, 0.5), rnd(0.6, 1.2), 0.25, 0.8, _pc.set(0x9a9488), 0.5, 0, { grav: 3 });
  if (u >= 1) { s.t = null; s.mesh.visible = false; }
}
function dispelCryptWall(quiet?: any) : any {
  const w: any = UGP.cryptWall; if (!w) return;
  G.flags.cryptWall = true; w.col.off = true;
  const i: any = UGM.indexOf(w.mesh); if (i >= 0) UGM.splice(i, 1);
  scene.remove(w.mesh);
  if (!quiet) { AUDIO.chime?.(4); UI.toast('The wall was never there', 'Reveal showed it for what it was: an old ward, and nothing more.', 'spell'); saveGame(); }
}

// ---- carrying things: the toad, the cat, Nettle's sack ------------------------------------------------------------
function carryShow(kind: any) : any {
  if (STORY.carry) { STORY.carry.parent?.remove(STORY.carry); STORY.carry = null; }
  player.carryItem = kind || null;
  if (!kind) return;
  const b: any = new Batch();
  withLocal(() => {
    B.to(b); B.occ = 0;
    if (kind === 'toad') toadGeo();
    else if (kind === 'cat') { ball(0, 0.13, 0, 0.2, 0x8a8a8a, PAT.NOISE, { sx: 1.0, sy: 0.6, sz: 1.2 }); ball(0.12, 0.15, 0.16, 0.1, 0x8a8a8a, PAT.NOISE); for (const s of [-1, 1]) cone(0.12 + s * 0.05, 0.22, 0.16, 0.035, 0.07, 4, 0x8a8a8a, 0); box(-0.1, 0.03, 0.14, 0.05, 0.06, 0.05, 0xf0ece0, 0); }
    else if (kind === 'sack') { ball(0, 0.15, 0, 0.18, 0x5a4a3a, PAT.NOISE, { sy: 1.2 }); cyl(0, 0.33, 0, 0.04, 0.07, 0.08, 6, 0x5a4a3a, PAT.NOISE); }
  });
  const m: any = new THREE.Mesh(b.toGeometry(), charMatFree);
  m.castShadow = true;
  m.position.set(0.05, -0.62, 0.22); m.rotation.y = -PI / 2;
  player.rig.armR.add(m); STORY.carry = m;
}
function placeCatHome() : any { if (STORY.homeCat) STORY.homeCat.root.visible = true, STORY.homeCat.hidden = false; }
function placeToadHome() : any {
  const p: any = SITES.toadTank; if (!p || !STORY.toad) return;
  if (!STORY.toad.parent) scene.add(STORY.toad);
  STORY.toad.position.set(p.x, p.y + 0.86, p.z); STORY.toad.rotation.y = rnd(0, TAU); STORY.toad.visible = true; STORY.toad.userData.home = true;
}

// ---- the Wood: what the gloam become when they all come home at once -------------------------------------------------
function buildHart() : any {
  const g: any = new THREE.Group(), mat: any = gloamMaterial(0x05030a, 0x6a4ac8);
  const part: any = (geo: any, x?: any, y?: any, z?: any, sx?: any, sy?: any, sz?: any, rx: any = 0, ry: any = 0, rz: any = 0) => { const m: any = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  const S: any = new THREE.IcosahedronGeometry(1, 3), C: any = new THREE.ConeGeometry(1, 1, 8), Cy: any = new THREE.CylinderGeometry(1, 1, 1, 7);
  part(S, 0, 4.2, 0, 1.5, 1.35, 2.6);                 // body
  part(S, 0, 4.6, 2.2, 1.1, 1.35, 1.0, -0.3);         // chest
  part(Cy, 0, 5.9, 2.9, 0.45, 2.2, 0.5, 0.55);        // neck
  const head: any = part(S, 0, 7.2, 3.9, 0.55, 0.6, 1.05, 0.25);
  for (const [x, z] of [[-0.8, 1.9], [0.8, 1.9], [-0.8, -1.9], [0.8, -1.9]]) part(C, x, 1.6, z, 0.38, 3.6, 0.38, PI);   // legs, tapering to points
  for (const s of [-1, 1]) {                          // antlers like dead branches
    const base: any = [s * 0.35, 7.7, 3.7];
    part(Cy, base[0] + s * 0.4, base[1] + 1.0, base[2] - 0.2, 0.09, 2.2, 0.09, -0.3, 0, -s * 0.5);
    part(Cy, base[0] + s * 1.1, base[1] + 2.1, base[2] - 0.5, 0.07, 1.6, 0.07, -0.2, 0, -s * 1.0);
    part(Cy, base[0] + s * 0.7, base[1] + 2.5, base[2] + 0.1, 0.06, 1.4, 0.06, 0.5, 0, -s * 0.2);
    part(Cy, base[0] + s * 1.7, base[1] + 2.9, base[2] - 0.8, 0.05, 1.2, 0.05, -0.4, 0, -s * 0.7);
    part(Cy, base[0] + s * 0.5, base[1] + 3.2, base[2] - 0.6, 0.05, 1.1, 0.05, -0.6, 0, s * 0.3);
    const eye: any = new THREE.Mesh(GL_GEO.eye, BOSS_EYE_MAT); eye.scale.setScalar(0.11); eye.position.set(s * 0.32, 7.35, 4.5); g.add(eye);
  }
  g.visible = false; scene.add(g);
  STORY.hart = { g, mat, head, t: 0, heal: 0 };
}
function updateHart(dt: any, t: any) : any {
  const H: any = STORY.hart; if (!H || !H.g.visible) return;
  H.t += dt;
  H.mat.uniforms.uT.value = t;
  H.g.position.y = H.y + Math.sin(H.t * 0.9) * 0.15;
  H.head.rotation.x = 0.25 + (H.bow || 0) * 0.65 + Math.sin(H.t * 0.5) * 0.06;
  if (H.heal > 0) {
    const k: any = clamp(H.heal, 0, 1);
    H.mat.uniforms.uCore.value.setRGB(lerp(0.02, 0.08, k), lerp(0.012, 0.22, k), lerp(0.04, 0.06, k));
    H.mat.uniforms.uRim.value.setRGB(lerp(0.42, 0.75, k), lerp(0.29, 1.0, k), lerp(0.78, 0.45, k));
    H.mat.uniforms.uFade.value = H.fade ?? 1;
  }
  if (R() < dt * 25) PS.n.spawn(H.g.position.x + rnd(-2, 2), H.g.position.y + rnd(1, 6), H.g.position.z + rnd(-2.5, 2.5), rnd(-0.3, 0.3), rnd(0.2, 0.6), rnd(-0.3, 0.3), rnd(1, 2), 0.3, 0.9, _pc.set(H.heal > 0.5 ? 0x4a8a3a : 0x140c1c), 0.5, 0, { drag: 0.8 });
}

// ---- interactive spots that aren't fires or people ---------------------------------------------------------------------
function setupSpots() : any {
  const D: any = SITES.barrowDoor;
  SPOTS.push({ id: 'slab', x: D.x + 1.4, z: D.z, verb: 'Read', name: 'the sealing stone', title: 'the founders’ barrow', when: () => !G.flags.slabOpen, act: () => cutscene('slab', async () => {
    await say('nar', 'A slab of grey stone fills the doorway, cut with seven flames in a ring. Beneath them: “The founders sleep. The stones keep the door.”');
    if (q('main') < 7) await say(BR(), 'Locked. Good. I don’t like the dead and they don’t like me.');
    else await say(EL(), 'The Kindling Stones, on the hill to the south. Light them, and the door will open.');
  }) });
  SPOTS.push({ id: 'altar', x: SITES.altar.x, z: SITES.altar.z, r: 0.6, verb: 'Examine', name: 'the altar stone', title: 'the Kindling Stones', act: () => cutscene('altar', async () => {
    if (G.flags.readAltar || MAGIC.rev.t !== null && MAGIC.rev.t < 16 && Math.hypot(MAGIC.rev.x - SITES.altar.x, MAGIC.rev.z - SITES.altar.z) < 14) {
      G.flags.readAltar = true;
      await say('nar', 'Under the candle-light the carving stands out sharp: seven flames in a ring, and a sun rising over the one to the east. A line of old letters: “As the sun walks, so walks the fire.”');
      await say(EL(), 'East first, where the sun rises. Then round the way the sun goes: south, west, and north last.');
    } else {
      await say('nar', 'Something is carved into the capstone, worn almost smooth. You can make out a ring, and not much else.');
      await say(EL(), G.spells.reveal ? 'Candle-light shows what is hidden. Try Reveal here.' : 'Old candle-light would show it. Draw from the chapel’s altar candles, or any candle that remembers the Hearthstone.');
    }
  }) });
  SPOTS.push({ id: 'cocoon', x: SITES.cocoon.x, z: SITES.cocoon.z, r: 1, verb: 'Look at', name: 'the cocoon', title: 'at the foot of the great tree', when: () => q('main') < 12, act: () => cutscene('cocoon', async () => {
    await say('nar', 'A shape of cold shadow is wrapped around something against the trunk of the dead tree. Inside, faintly, a tall pointed hat.');
    await say(BR(), 'That’s a wizard. That’s a wizard in a… a gloam pudding.');
  }) });
  SPOTS.push({ id: 'toad', x: SITES.toadIsle.x - 0.6, z: SITES.toadIsle.z + 0.2, verb: 'Pick up', name: 'Bartholomew', title: 'a toad of enormous dignity', when: () => q('toad') === 0 && !G.carry, act: () => cutscene('toad', async () => {
    await say('nar', 'The toad regards you with the weary contempt of a duke who has been kept waiting. He is wearing a very small hat.');
    if (STORY.toad) STORY.toad.visible = false;
    G.carry = 'toad'; G.items.toad = true; carryShow('toad'); qSet('toad', 1);
    await say(BR(), 'Why is the toad wearing a hat.');
    await say(EL(), 'I think the wizard has been here.');
  }) });
  SPOTS.push({ id: 'cat', x: SITES.catIsle.x - 0.3, z: SITES.catIsle.z + 0.2, verb: 'Pick up', name: 'Smudge', title: 'a grey cat, one white sock', when: () => q('cat') >= 0 && q('cat') < 2 && !G.carry, act: () => cutscene('catpick', async () => {
    await say('nar', 'Smudge allows himself to be picked up, on the clear understanding that this was his idea.');
    if (STORY.cat) { STORY.cat.root.visible = false; STORY.cat.gone = true; }
    G.carry = 'cat'; G.items.cat = true; carryShow('cat'); qSet('cat', 2);
  }) });
  SPOTS.push({ id: 'stash', x: SITES.stash.x, z: SITES.stash.z, verb: 'Search', name: 'the hay', title: 'in the old barn', when: () => q('pumpkins') === 1 && CUT.b === V.barn, act: () => cutscene('stash', async () => {
    await say('nar', 'Under the hay: three enormous pumpkins, each with a name painted on it. BERTHA. BIG BERTHA. THE OTHER BERTHA. And a pair of very large old boots.');
    await say(BR(), 'Washtub footprints. Of course.');
    qSet('pumpkins', 2);
  }) });
  SPOTS.push({ id: 'sack', x: UGP.nettleSack.x, z: UGP.nettleSack.z, y: UGP.nettleSack.y, ug: true, verb: 'Take', name: 'Nettle’s sack', when: () => q('tunnel') === 1 && !G.carry, act: () => { G.carry = 'sack'; G.items.sack = true; carryShow('sack'); qSet('tunnel', 2); } });
  SPOTS.push({ id: 'sheaf', x: SITES.sheaf.x, z: SITES.sheaf.z, r: 0.4, verb: 'Look at', name: 'the Last Sheaf', title: 'never cut', when: () => q('main') < 15, act: () => cutscene('sheaf', async () => {
    await say('nar', 'One sheaf of wheat stands alone in the middle of the stubble, tied with a red ribbon. Every other stalk on the Long Field has been cut.');
    await say(q('main') >= 14 ? EL() : BR(), q('main') >= 14 ? 'Every year they leave it for the Wood, and every year they forget why.' : 'They missed a bit.');
  }) });
}

// ---- where the gloam come from ------------------------------------------------------------------------------------------
function setupZones() : any {
  const night: any = () => NIGHT > 0.55 && q('main') >= 6 && !G.flags.woodHealed && !G.ending;
  COMBAT.zones.push(
    { id: 'downs', x: -112, z: -38, r: 40, max: 4, types: ['gloamling', 'gloamling', 'shade'], when: night },
    { id: 'fen', x: -102, z: 82, r: 38, max: 3, types: ['gloamling'], when: night },
    { id: 'gloam', x: 100, z: -56, r: 48, max: 6, types: ['gloamling', 'gloamling', 'shade'], when: () => q('main') >= 6 && !G.flags.woodHealed && !G.ending && !COMBAT.boss },
    { id: 'fields', x: 20, z: 116, r: 48, max: 2, types: ['gloamling'], when: () => night() && q('main') < 15 },
    { id: 'road', x: 8, z: -50, r: 16, max: 3, types: ['gloamling', 'gloamling', 'shade'], when: () => night() && q('watch') !== 1 && q('watch') < 4 },
  );
}

// ---- where everyone should be, given how far the night has gone -----------------------------------------------------------------
const FIELD: any = () => ({ x: SITES.sheaf.x, z: SITES.sheaf.z, bx: SITES.bonfire.x, bz: SITES.bonfire.z });
const FIELD_CROWD: any = [   // [id, dx, dz] from the Last Sheaf, south of it, facing the bonfire
  ['marta', -3.0, 3.6], ['hilda', -1.6, 3.4], ['agnes', 0.0, 3.6], ['mira', 1.5, 3.4], ['bess', 3.0, 3.7], ['pell', 4.4, 3.4],
  ['wil', -3.6, 5.0], ['pip', -2.4, 4.9], ['nell', -1.5, 5.1], ['greta', -0.3, 5.0], ['tobias', 1.0, 5.1], ['wren', 2.2, 4.9], ['hob', 3.5, 5.0], ['ned', 4.8, 5.1],
  ['lyle', -3.0, 6.4], ['fennick', -1.6, 6.5], ['quill', -0.2, 6.3], ['tamsin', 1.2, 6.5], ['dunstan', 2.6, 6.4], ['basil', 4.0, 6.5],
];
function placeFieldCrowd() : any {
  const F: any = FIELD(), mx: any = (F.x + F.bx) / 2, mz: any = F.z - 1;
  for (const [id, dx, dz] of FIELD_CROWD) {
    const c: any = N(id); if (!c) continue;
    if (id === 'basil' && q('basil') < 1) { c.away = true; continue; }
    const x: any = F.x + dx + 2, z: any = F.z + dz + 1;   // a step back from the bonfire, so the front row can be talked to from the front
    putAt(c, x, z, Math.atan2(mx - x, mz - z), { act: null });
  }
  const th: any = N('thom'); if (th) { putAt(th, F.bx - 1.7, F.bz + 0.8, 0, { act: 'warm' }); face(th, { x: F.bx, z: F.bz }); }
  // Rook holds the cave road until his errand is done ("if they get past me they get to the Long Field"); the finale fetches him
  const rk: any = N('rook'), w: any = q('watch'); if (rk && (w < 0 || w >= 4 || q('main') >= 15)) putAt(rk, F.bx + 0.4, F.bz + 2.2, -PI * 0.75, { act: 'spear' });
  const o: any = N('orrin'); if (o) { putAt(o, F.x + 3.4, F.z - 2.2, -PI / 2, { act: null }); o.talkable = true; }
}
function applyNPCState() : any {
  const m: any = q('main');
  for (const c of CHARS) if (!PARTY.includes(c) && c.spawn && c.id !== 'troll' && !c.echo) goHome(c);
  const rook: any = N('rook'), orrin: any = N('orrin'), ada: any = N('ada');
  if (m >= 6 && m < 15 && !G.ending && rook) putAt(rook, SITES.watch.x + 2.4, SITES.watch.z + 4.3, PI, { act: "spear" });
  if (orrin) {
    if (G.ending) { putAt(orrin, -29.2, -24.6, 0, { act: null }); orrin.talkable = true; }
    else if (m >= 14) { const F: any = FIELD(); putAt(orrin, F.x + 2.6, F.z - 3.2, -PI / 2, { act: null }); orrin.talkable = true; }
    else { orrin.talkable = false; putAt(orrin, SITES.cocoon.x, SITES.cocoon.z, PI * 0.9, { pose: 'kneel' }); }
  }
  if (ada) { ada.away = !G.flags.adaMet; }
  if (m >= 14 && !G.ending) placeFieldCrowd();
  // the troll
  const tr: any = N('troll');
  if (tr) {
    if (G.flags.trollAwake) trollAwakePose(tr);
    if (G.flags.trollAwake && m >= 15 && !G.ending) trollToField(tr);
  }
  // the toad, the cat
  if (q('toad') >= 2) { placeToadHome(); } else if (q('toad') === 1 && STORY.toad) STORY.toad.visible = false;
  if (STORY.homeCat) STORY.homeCat.hidden = q('cat') < 3;
  if (STORY.cat && q('cat') >= 2) { STORY.cat.root.visible = false; STORY.cat.gone = true; }
  if (G.carry) carryShow(G.carry); else carryShow(null);
  if (STORY.cocoon) STORY.cocoon.visible = m < 14;
  // Elowen has gone into the wood in two of the endings
  const el: any = EL(); if (el) el.away = G.ending === 'old' || G.ending === 'wick';
}
function trollAwakePose(tr: any) : any {
  tr.awake = true; tr.title = 'Troll · awake'; tr.amb = ['Hrrm.', 'Duchess. Sit.', '*yawns enormously*'];
  if (tr.headG) tr.headG.rotation.set(0.05, 0, 0.05);
  if (HAT_OBJ.diplomacy && HAT_OBJ.diplomacy.worn && G.hats.includes('diplomacy')) { HAT_OBJ.diplomacy.mesh.parent?.remove(HAT_OBJ.diplomacy.mesh); HAT_OBJ.diplomacy.worn = false; }
}
function trollToField(tr: any) : any {
  const F: any = FIELD(), x: any = F.x - 13.6, z: any = F.z - 8.2, y: any = terrainH(x, z);
  tr.root.position.set(x, y, z); tr.root.rotation.y = 0.9;
  tr.hx = x; tr.hz = z; tr.y = y; tr.smoothY = y; tr.x = x + 2.2; tr.z = z + 2.6; tr.ug = false; tr.home = { x: tr.x, z: tr.z, face: 0 };
  if (!tr.fieldCol) tr.fieldCol = addCircW(x, z, 1.6, y - 0.5, y + 3);
}
