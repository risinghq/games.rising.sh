// ============================================================================
//  The Wisp Fen, the Barrow Downs and the Gloamwood
// ============================================================================

// ---- boardwalks over the fen -----------------------------------------------------------------------------
function boardwalk(pts: any, w: any = 1.6, o: any = {}) : any {
  const S: any = [];
  for (let i: any = 0; i < pts.length - 1; i++) {
    const [x0, z0]: any = pts[i], [x1, z1]: any = pts[i + 1], L: any = Math.hypot(x1 - x0, z1 - z0), n: any = Math.max(1, Math.ceil(L / 1.8));
    for (let k: any = 0; k < n; k++) S.push([lerp(x0, x1, k / n), lerp(z0, z1, k / n)]);
  }
  S.push(pts[pts.length - 1]);
  const ys: any = S.map(([x, z]: any) => Math.max(terrainH(x, z) + 0.14, WATER_Y + 0.4));
  for (let it: any = 0; it < 3; it++) for (let i: any = 1; i < ys.length - 1; i++) ys[i] = Math.max(ys[i], (ys[i - 1] + ys[i + 1]) / 2);
  B.reset(); B.to(OUT); B.occ = 0;
  const gaps: any = o.gaps || [];
  for (let i: any = 0; i < S.length - 1; i++) {
    if (gaps.some(([a, b]: any) => i >= a && i < b)) continue;
    const [x0, z0]: any = S[i], [x1, z1]: any = S[i + 1], y0: any = ys[i], y1: any = ys[i + 1], L: any = Math.hypot(x1 - x0, z1 - z0);
    const ux: any = (x1 - x0) / L, uz: any = (z1 - z0) / L, a: any = Math.atan2(-uz, ux), tilt: any = Math.atan2(y1 - y0, L);
    const n: any = Math.max(1, Math.round(L / 0.3));
    for (let k: any = 0; k < n; k++) {
      const t: any = (k + 0.5) / n, x: any = lerp(x0, x1, t), z: any = lerp(z0, z1, t), y: any = lerp(y0, y1, t);
      if (R() < 0.04) continue;   // a missing plank here and there
      box(x, y - 0.07, z, 0.26, 0.07, w * rnd(0.94, 1.04), vary(0x7a6248, 0.12), PAT.PLANK, { ry: a + rnd(-0.03, 0.03), rx: 0, rz: tilt });
    }
    for (const sd of [-1, 1]) {
      const px: any = -uz * sd * (w / 2 - 0.1), pz: any = ux * sd * (w / 2 - 0.1);
      box((x0 + x1) / 2 + px, (y0 + y1) / 2 - 0.16, (z0 + z1) / 2 + pz, L + 0.04, 0.09, 0.1, 0x4a3a2a, PAT.PLANK, { ry: a, rz: tilt });
      if (terrainH(x0, z0) < y0 - 0.35) cyl(x0 + px, terrainH(x0, z0) - 0.3, z0 + pz, 0.07, 0.08, y0 - terrainH(x0, z0) + 0.2, 5, 0x3e3226, PAT.BARK);
    }
    walkRampW([x0, z0], [x1, z1], w + 0.05, y0, y1, 'walk');
  }
  return { S, ys };
}
// stepping stones over whatever open water lies between a and b: close enough that every step lands on stone,
// with a walkable strip under the line so nobody slips between them
function wispStones(id: any, a: any, b: any) : any {
  const L: any = Math.hypot(b[0] - a[0], b[1] - a[1]), ux: any = (b[0] - a[0]) / L, uz: any = (b[1] - a[1]) / L, P: any = (d: any) => [a[0] + ux * d, a[1] + uz * d];
  let w0: any = -1, w1: any = -1;
  for (let d: any = 0; d <= L; d += 0.1) { const [x, z]: any = P(d); if (terrainH(x, z) < WATER_Y - 0.12) { if (w0 < 0) w0 = d; w1 = d; } }
  if (w0 < 0) return;
  const k: any = Math.max(1, Math.ceil((w1 - w0) / 1.05)), pts: any = [];
  for (let i: any = 0; i <= k; i++) { const [x, z]: any = P(w0 + (w1 - w0) * i / k), j: any = i % 2 ? 0.13 : -0.13; pts.push([x - uz * j, z + ux * j]); }   // a gentle zigzag
  const [x0, z0]: any = P(Math.max(0, w0 - 0.7)), [x1, z1]: any = P(Math.min(L, w1 + 0.7)), hw: any = 0.42;
  STONESETS.push({ id, pts, y: 0.08, strip: [[x0 - uz * hw, z0 + ux * hw], [x1 - uz * hw, z1 + ux * hw], [x1 + uz * hw, z1 - ux * hw], [x0 + uz * hw, z0 - ux * hw]] });
}
function lilyPads(cx: any, cz: any, r: any, n: any) : any {
  B.reset(); B.to(OUT); B.occ = 0;
  for (let i: any = 0; i < n; i++) {
    const a: any = rnd(0, TAU), d: any = Math.sqrt(R()) * r, x: any = cx + Math.cos(a) * d, z: any = cz + Math.sin(a) * d;
    if (terrainH(x, z) > WATER_Y - 0.1) continue;
    cyl(x, WATER_Y + 0.015, z, 0.32, 0.32, 0.015, 9, vary(0x4a7a3a, 0.12), 0, { occ: 0 });
    if (R() < 0.25) sph(x + 0.08, WATER_Y + 0.07, z, 0.07, pick([0xf0d8e8, 0xf4f0e8, 0xf2d070]), 0, { det: 0, occ: 0 });
  }
}

// ---- the Wisp Fen --------------------------------------------------------------------------------------------
function buildFen() : any {
  B.ground = 0;
  // the walk out to Mother Hesk's island
  SITES.fenWalk = boardwalk([[-75.5, 45], [-83, 55], [-92, 63], [-100, 71.5], [-106, 78.5], [-111, 84], [-114.6, 87.2]], 1.7);
  // a spur south-east toward the cat's mere, broken where the planks rotted away
  SITES.catWalk = boardwalk([[-100, 71.5], [-98, 84], [-95.5, 97], [-93.5, 106.6]], 1.4, { gaps: [[5, 6]] });
  // Mother Hesk's hut on her island
  V.hesk = buildRect({
    id: 'hesk', name: "Mother Hesk's", sub: 'Wisp Fen', x: -118, z: 90.4, y: 0.36, rot: 135, w: 5.4, d: 4.4, noPad: true, foundDepth: 1.2,
    levels: [0.2], wallTop: 2.65, floorNames: ['Hut'], mapColor: 0x5a6a3a,
    style: { ext: 0x9aa070, extPat: PAT.PLASTER, int: 0x8a8a62, intPat: PAT.PLASTER, timber: 0x3e3226, plinth: { h: 0.4, c: 0x6a665a }, trim: 0x3e3226 },
    floorC: 0x6a5a42,
    open: { S: [[0, dr(0.6, 1.0, { color: 0x3a4a2a, h: 2.05 })], [0, wn(-1.6, { w: 0.7, h: 0.8, b: 1.0, shutters: 0x4a5a2a })]], N: [[0, wn(0.4, { w: 0.6, h: 0.7, b: 1.1 })]], E: [[0, wn(0, { w: 0.6, h: 0.7, b: 1.1 })]] },
    roof: { type: 'thatch', axis: 'x', pitch: 50, oh: 0.6, c: 0x6a7a3a, pat: PAT.THATCH, timber: 0x3e3226 },
    chimneys: [{ x: 1.9, z: -1.4, from: 2.2, top: 5.6, w: 0.6, d: 0.6, c: 0x6a665a }],
    furnish: (b: any, f: any) => {
      cauldron(1.3, -0.8, { c: 0x6ae08a });
      wallShelf(-1.2, 1.3, -1.95, 0, 1.8, 'jars'); wallShelf(-1.2, 1.85, -1.95, 0, 1.8, 'bottles');
      bed(-1.7, 0.6, 0, { w: 0.95, len: 1.8, blanket: 0x4a5a3a });
      hangingHerbs(0.0, 2.45, 0.2, 6);
      B.push(2.25, 0, 1.4, 0); box(0, 0, 0, 0.7, 0.75, 0.5, WOOD.dark, PAT.PLANK); box(0, 0.75, 0, 0.66, 0.42, 0.46, 0x9ab8b0, PAT.LEAD, { em: -0.3 }); box(0, 0.76, 0, 0.6, 0.08, 0.4, 0x4a6a3a, PAT.NOISE); colBox(0, 0, 0.7, 0.5, 0, 1.2); B.pop();   // the empty toad tank
      SITES.toadTank = b.localY(2.25, b.levels[0], 1.4);
      B.push(-2.2, 0, -1.4, 0.4); box(0, 0, 0, 0.12, 1.1, 0.12, WOOD.dark); ball(0, 1.25, 0, 0.16, 0x8a6a4a, PAT.NOISE, { sy: 1.3 }); for (const s of [-1, 1]) ball(s * 0.06, 1.33, 0.12, 0.04, 0xf2c94a, 0, { em: 0.8 }); B.pop();   // the stuffed owl
      rug(0.3, 0.3, 0, 1.8, 1.4, 0x5a3a4a);
      candle(-0.4, 0, 1.6, { h: 0.3, light: true, int: 1.2 });
    },
  });
  FAR_KEEP.push({ x: -118, z: 90.4, r: 5 });
  // islands, reeds, willows and drowned trees
  const isles: any = [];
  for (let i: any = 0; i < 2600; i++) {
    const x: any = rnd(-160, -50), z: any = rnd(25, 135), w: any = wFen(x, z);
    if (w < 0.25 || !inWorld(x, z)) continue;
    const h: any = terrainH(x, z);
    if (Math.abs(x + 118) < 6 && Math.abs(z - 90.4) < 6) continue;
    if (pathInfo(x, z) > 0.02) continue;
    let nearWalk: any = false;
    for (const S of [SITES.fenWalk.S, SITES.catWalk.S]) for (const p of S) if (Math.abs(p[0] - x) < 2.4 && Math.abs(p[1] - z) < 2.4) nearWalk = true;
    if (nearWalk) continue;
    if (h > WATER_Y - 0.15 && h < WATER_Y + 0.35 && R() < 0.5) plant('reeds', x, z, rnd(0.8, 1.2), { col: false, dy: 0 });
    else if (h > WATER_Y + 0.25) {
      const k: any = R();
      if (k < 0.07) plant('willow', x, z, rnd(0.85, 1.2));
      else if (k < 0.12) plant('dead', x, z, rnd(0.8, 1.2));
      else if (k < 0.2) plant('bush', x, z, rnd(0.7, 1.0), { col: false, v: 1 });
      else if (k < 0.24) isles.push([x, z]);
    } else if (h < WATER_Y - 0.35 && R() < 0.035) plant('dead', x, z, rnd(0.7, 1.0), { dy: -0.25 });
  }
  for (let i: any = 0; i < 26; i++) { const a: any = rnd(0, TAU), r: any = rnd(5.4, 10); const x: any = -118 + Math.cos(a) * r, z: any = 90.4 + Math.sin(a) * r; if (terrainH(x, z) < WATER_Y - 0.2 && R() < 0.6) plant('reeds', x, z, rnd(0.8, 1.1), { col: false, dy: 0 }); }
  lilyPads(-118, 90.4, 10, 26); lilyPads(-137, 64, 7, 16); lilyPads(-92, 113, 6, 12); lilyPads(-100, 60, 8, 10);
  // the drowned rowboat and the posts of an older walk
  B.reset(); B.to(OUT); B.occ = 0;
  { const x: any = -108, z: any = 94, y: any = WATER_Y - 0.25; B.push(x, y, z, 0.7, 0.25, 0.15); lathe(0, 0, 0, [[0.001, -1.4], [0.35, -1.0], [0.55, 0], [0.4, 1.0], [0.001, 1.5]], 10, 0x4a3a2a, PAT.PLANK, { rx: PI / 2, sz: 0.45 }); B.pop(); }
  for (let i: any = 0; i < 9; i++) { const x: any = -128 + i * 1.9 + rnd(-0.2, 0.2), z: any = 78 + i * 0.6; if (terrainH(x, z) > WATER_Y) continue; cyl(x, WATER_Y - 0.6, z, 0.07, 0.09, rnd(0.7, 1.1), 5, 0x3e3226, PAT.BARK, { rz: rnd(-0.15, 0.15) }); }
  // wisps drift over these pools after dark
  for (const [x, z] of [[-90, 58], [-104, 66], [-112, 98], [-124, 80], [-133, 70], [-96, 104], [-140, 92], [-84, 72], [-128, 104], [-110, 112]]) WISPSPOTS.push({ x, z });
  // wisp-stones: from the western hummocks out to Bartholomew's island, and over the gap to the cat's mere
  wispStones('toad', [-127.4, 69.9], [-136.0, 64.5]);
  { const S: any = SITES.catWalk.S; wispStones('cat', S[S.length - 1], [-92.3, 111.6]); }   // where the boardwalk gives out
  SITES.toadIsle = { x: -137, z: 64 }; SITES.catIsle = { x: -92, z: 113 };
  B.reset(); B.to(OUT); B.occ = 1;
  { const x: any = -137, z: any = 64, y: any = terrainH(x, z); sph(x + 0.6, y - 0.2, z - 0.4, 0.55, 0x6a6a5a, PAT.ROCK, { det: 1, jit: 0.25, sy: 0.6 }); plant('reeds', x - 1.4, z + 0.9, 0.8, { col: false, dy: 0 }); mushrooms(x - 0.4, z + 0.6, 4, 0x9ad87a, { light: false }); }
  { const x: any = -92, z: any = 113; plant('dead', x + 0.7, z - 0.6, 0.9); }
  wayfirePillar('wf_fen', -73.2, 41.6, 'Fen edge');
  B.ground = -1;
}

// ---- the Barrow Downs --------------------------------------------------------------------------------------------
function buildDowns() : any {
  B.ground = 0;
  const C: any = REG.circle, cy: any = terrainH(C.x, C.z);
  SITES.circle = { x: C.x, z: C.z, y: cy, stones: [] };
  // the Kindling Stones: seven stones, a brazier at each foot, an altar in the middle
  for (let k: any = 0; k < 7; k++) {
    const a: any = -PI / 2 + (k / 7) * TAU, sx: any = C.x + Math.cos(a) * 8.2, sz: any = C.z + Math.sin(a) * 8.2;
    B.reset(); B.to(OUT); B.occ = 1;
    standingStone(sx, sz, rnd(2.3, 2.9), { ry: -a + PI / 2, w: 1.0, c: 0x9a988e, ...(k === 2 ? { rune: 0xffd070, runePat: 100, runeEm: 1.2 } : {}) });   // the sun-stone's mark shows only to candle-light
    const bx: any = C.x + Math.cos(a) * 6.6, bz: any = C.z + Math.sin(a) * 6.6;
    B.reset(); B.to(OUT);
    const f: any = brazier(bx, bz, { id: 'stone' + k, kind: 'ghost', label: 'a stone brazier', h: 0.8, s: 0.6 });
    SITES.circle.stones.push({ k, a, x: sx, z: sz, fire: f });
  }
  B.reset(); B.to(OUT); B.occ = 1;
  B.push(C.x, cy, C.z, 0.3);
  for (const s of [-1, 1]) box(s * 0.75, -0.2, 0, 0.42, 1.1, 0.8, 0x8a887e, PAT.STONE);
  box(0, 0.85, 0, 2.3, 0.3, 1.25, 0x9a988e, PAT.STONE);
  box(0, 1.15, 0, 0.9, 0.012, 0.6, 0xd8c890, 0, { em: -0.5, occ: 0 });   // something carved in the capstone
  B.pop();
  addColW(C.x, C.z, 1.2, 0.65, Math.cos(-0.3), Math.sin(-0.3), cy - 0.5, cy + 1.2);
  SITES.altar = { x: C.x, z: C.z, y: cy + 1.15 };
  NO_GRASS.push({ x: C.x, z: C.z, r: 3 });
  FAR_KEEP.push({ x: C.x, z: C.z, r: 11 });
  // the founders' barrow: a passage of standing stones into the mound's eastern side
  { const bx: any = SITES.barrowDoor.x, bz: any = SITES.barrowDoor.z, y: any = SITES.barrowDoor.y;
    B.reset(); B.to(OUT); B.occ = 1;
    for (const s of [-1, 1]) {
      sph(bx + 0.2, y + 1.0, bz + s * 1.55, 0.6, vary(0x8a887e, 0.06), PAT.ROCK, { det: 1, jit: 0.15, sx: 0.8, sy: 2.0, sz: 0.55, occ: 1 });
      addCircW(bx + 0.2, bz + s * 1.55, 0.5, y - 1, y + 3);
      for (let i: any = 1; i < 4; i++) sph(bx - i * 1.1, y + 0.6 + i * 0.25, bz + s * 1.7, 0.5, vary(0x7f7d74, 0.06), PAT.ROCK, { det: 1, jit: 0.2, sy: 1.2, occ: 1 });
    }
    sph(bx + 0.1, y + 2.35, bz, 0.6, 0x8e8c82, PAT.ROCK, { det: 1, jit: 0.12, sx: 1.0, sy: 0.38, sz: 3.2, occ: 1 });
    for (let i: any = 0; i < 9; i++) { const a: any = PI / 2 + (i - 4) * 0.17, r: any = 12.4; standingStone(SITES.barrowMound.x + Math.cos(a) * r * 0.85, SITES.barrowMound.z + Math.sin(a) * r, rnd(0.7, 1.1), { w: 0.6 }); }   // kerbstones
    // a dark curtain inside the doorway
    { const cv: any = document.createElement('canvas'); cv.width = cv.height = 32; const g: any = cv.getContext('2d'), img: any = g.createImageData(32, 32);
      for (let j: any = 0; j < 32; j++) for (let i: any = 0; i < 32; i++) { const u: any = (i + 0.5) / 32, v: any = 1 - (j + 0.5) / 32, a: any = sstep(0, 0.25, u) * sstep(0, 0.25, 1 - u) * sstep(0, 0.3, 1 - v); const o: any = (j * 32 + i) * 4; img.data[o] = 3; img.data[o + 1] = 2; img.data[o + 2] = 2; img.data[o + 3] = 255 * a; }
      g.putImageData(img, 0, 0);
      const tex: any = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const m: any = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true }));
      m.position.set(bx - 1.3, y + 1.05, bz); m.rotation.y = PI / 2; m.renderOrder = 2; scene.add(m); SITES.barrowCurtain = m; }
    NO_GRASS.push({ x: bx, z: bz, r: 2.5 });
    FAR_KEEP.push({ x: SITES.barrowMound.x, z: SITES.barrowMound.z, r: 12 });
  }
  // the lesser barrows, sealed with slabs
  B.reset(); B.to(OUT); B.occ = 1;
  for (const [bx, bz, br] of BARROWS.slice(1)) {
    const a: any = rnd(0, TAU), x: any = bx + Math.cos(a) * br * 0.95, z: any = bz + Math.sin(a) * br * 0.95, y: any = terrainH(x, z);
    B.push(x, y - 0.3, z, -a + PI / 2);
    box(0, 0, 0, 1.3, 1.5, 0.3, 0x8a887e, PAT.STONE); for (const s of [-1, 1]) box(s * 0.85, 0, -0.2, 0.4, 1.8, 0.5, 0x7f7d74, PAT.STONE); box(0, 1.5, -0.2, 2.1, 0.35, 0.6, 0x8e8c82, PAT.STONE);
    B.pop();
    addCircW(x, z, 0.9, y - 0.5, y + 1.8);
    FAR_KEEP.push({ x: bx, z: bz, r: br + 1 });
  }
  // Orrin's camp, three nights cold
  { const x: any = -99.5, z: any = -49.5, y: any = terrainH(x, z);
    SITES.camp = { x, z, y };
    B.reset(); B.to(OUT); B.occ = 0; B.ground = 0;
    for (let i: any = 0; i < 8; i++) { const a: any = (i / 8) * TAU; sph(x + Math.cos(a) * 0.55, y + 0.05, z + Math.sin(a) * 0.55, 0.15, vary(0x7a746a, 0.1), PAT.STONE, { det: 0, sy: 0.7 }); }
    B.push(x, y, z, 0); const f: any = fire(0, 0.02, 0, 0.8, { kf: 'camp_orrin', lit: false, kind: 'hearth', label: "Orrin's campfire" }); B.pop(); f.memory = 'camp';
    rug(x + 1.8, z + 0.6, 0.4, 1.9, 0.8, 0x3a2a5a); box(x + 1.1, y + 0.02, z + 0.3, 0.42, 0.14, 0.6, 0xd8ccb0, PAT.NOISE, { ry: 0.4 });
    B.push(x - 1.5, y, z + 0.9, 0.8); box(0, 0, 0, 0.5, 0.35, 0.3, 0x5a3a24, PAT.NOISE); box(0, 0.35, 0, 0.52, 0.06, 0.32, 0x4a2a1a); box(0.4, 0, 0.2, 0.3, 0.06, 0.22, 0x6a2a2a, PAT.NOISE, { ry: 0.5 }); box(0.45, 0.06, 0.25, 0.28, 0.02, 0.2, 0xefe4c8, 0, { ry: 0.5 }); B.pop();
    B.push(x + 0.9, y, z - 1.0, 0); for (let i: any = 0; i < 3; i++) { const a: any = (i / 3) * TAU; box(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, 0.04, 1.1, 0.04, WOOD.dark, 0, { rz: Math.cos(a) * 0.25, rx: -Math.sin(a) * 0.25 }); } lathe(0, 0.45, 0, [[0.001, 0], [0.16, 0.02], [0.2, 0.15], [0.18, 0.26]], 9, MET.iron, PAT.METAL); B.pop();
    B.ground = -1;
    FAR_KEEP.push({ x, z, r: 3 });
  }
  // hawthorns bent by the wind, old stones on the skyline, gorse in the hollows
  for (let i: any = 0; i < 2400; i++) {
    const x: any = rnd(-170, -62), z: any = rnd(-105, 22), w: any = wDowns(x, z);
    if (w < 0.3 || !inWorld(x, z) || !farOk(x, z, 2)) continue;
    const k: any = R();
    if (k < 0.022) plant('hawthorn', x, z, rnd(0.8, 1.25), { ry: rnd(-0.4, 0.4) + 2.4 });
    else if (k < 0.03) plant('oak', x, z, rnd(0.9, 1.2));
    else if (k < 0.05) plant('gorse', x, z, rnd(0.8, 1.2), { col: false });
    else if (k < 0.058) plant('stone', x, z, rnd(0.5, 1.2), { v: 3 });
    else if (k < 0.0605) { B.reset(); B.to(OUT); B.occ = 1; standingStone(x, z, rnd(1.6, 2.6), { w: rnd(0.6, 0.9) }); }
  }
  wayfirePillar('wf_downs', -86.5, -13, 'The Downs road');
  SITES.downsSheep = [-128, -20, -100, 4];
  B.ground = -1;
}

// ---- the Gloamwood -----------------------------------------------------------------------------------------------
function thornWall(id: any, x: any, z: any, ry: any, w: any = 5) : any {
  const b: any = new Batch(), y: any = terrainH(x, z);
  withLocal(() => {
    B.to(b); B.occ = 0;
    for (let i: any = 0; i < 26; i++) {
      const px: any = rnd(-w / 2, w / 2), pz: any = rnd(-0.5, 0.5), h: any = rnd(0.6, 2.1), a: any = rnd(0, TAU);
      B.push(px, terrainH(x + px * Math.cos(ry), z - px * Math.sin(ry)) - y - 0.1, pz, a, rnd(-0.5, 0.5), rnd(-0.6, 0.6));
      cyl(0, 0, 0, 0.02, 0.06, h, 5, vary(0x2a2420, 0.15), PAT.BARK);
      for (let t: any = 0; t < 4; t++) cyl(0, h * rnd(0.2, 0.9), 0, 0, 0.025, 0.14, 3, 0x4a3a30, 0, { rz: PI / 2, ry: rnd(0, TAU) });
      B.pop();
    }
    for (let i: any = 0; i < 7; i++) sph(rnd(-w / 2, w / 2), rnd(0.3, 1.2), rnd(-0.4, 0.4), rnd(0.35, 0.6), vary(0x2a2a30, 0.1), PAT.LEAF, { det: 0, jit: 0.35, sy: 0.7 });
  });
  const m: any = new THREE.Mesh(b.toGeometry(), worldMat({ rough: 0.95 }));
  m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  const col: any = addColW(x, z, w / 2, 0.5, Math.cos(ry), -Math.sin(ry), y - 1, y + 2.5, 'thorn');
  const t: any = { id, x, y, z, ry, w, mesh: m, col, burnt: false };
  THORNS.push(t);
  return t;
}
function wispLamp(id: any, x: any, z: any) : any {
  const y: any = terrainH(x, z);
  B.reset(); B.to(OUT); B.occ = 1;
  B.push(x, y, z, rnd(0, TAU));
  cyl(0, -0.2, 0, 0.18, 0.24, 1.75, 6, 0x5a5a5c, PAT.STONE);
  box(0, 1.55, 0, 0.42, 0.06, 0.42, 0x4a4a4c, PAT.STONE);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(sx * 0.15, 1.6, sz * 0.15, 0.03, 0.42, 0.03, MET.iron, PAT.METAL);
  cyl(0, 2.02, 0, 0.0, 0.26, 0.2, 4, MET.iron, PAT.METAL, { r0: PI / 4 });
  box(0, 1.62, 0, 0.26, 0.36, 0.26, 0x4a8a6a, PAT.LEAD, { em: -0.25, occ: 0 });
  B.pop();
  addCircW(x, z, 0.25, y - 0.5, y + 2);
  const l: any = { id, x, y: y + 1.8, z, lit: false };
  LAMPS.push(l);
  return l;
}
function buildGloamwood() : any {
  B.ground = 0;
  // the old path through the trees, with wisp-lamps along it and brambles across it
  const P: any = GLOAM_PATH;
  const along: any = (t: any) => {   // point at fraction t of the path
    let L: any = 0; const seg: any = [];
    for (let i: any = 0; i < P.length - 1; i++) { const l: any = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); seg.push(l); L += l; }
    let d: any = t * L;
    for (let i: any = 0; i < seg.length; i++) { if (d <= seg[i]) { const k: any = d / seg[i]; return [lerp(P[i][0], P[i + 1][0], k), lerp(P[i][1], P[i + 1][1], k), Math.atan2(P[i + 1][1] - P[i][1], P[i + 1][0] - P[i][0])]; } d -= seg[i]; }
    return [...P[P.length - 1], 0];
  };
  for (let i: any = 0; i < 8; i++) {
    const [x, z, a]: any = along(0.3 + i * 0.088), side: any = i % 2 ? 1 : -1;
    wispLamp('lamp' + i, x - Math.sin(a) * side * 2.0, z + Math.cos(a) * side * 2.0);
  }
  for (const [k, t] of [[0, 0.42], [1, 0.64], [2, 0.84]]) { const [x, z, a]: any = along(t); thornWall('thorn' + k, x, z, -a + PI / 2, 5.4); }
  // the Hollow: a bowl in the wood, four braziers, the great dead tree
  const H: any = REG.hollow, hy: any = terrainH(H.x, H.z);
  SITES.hollow = { x: H.x, z: H.z, y: hy, braziers: [] };
  for (let k: any = 0; k < 4; k++) {
    const a: any = PI / 4 + k * PI / 2, x: any = H.x + Math.cos(a) * 8.5, z: any = H.z + Math.sin(a) * 8.5;
    B.reset(); B.to(OUT);
    SITES.hollow.braziers.push(brazier(x, z, { id: 'hollow' + k, kind: 'gloam', label: 'a gloam brazier', h: 1.1, s: 0.8 }));
  }
  { const x: any = H.x + 5, z: any = H.z - 9.5, y: any = terrainH(x, z);
    B.reset(); B.to(OUT); B.occ = 1;
    B.push(x, y - 0.2, z, 0.4);
    cyl(0, 0, 0, 1.0, 2.2, 7.5, 9, 0x1e1a1e, PAT.BARK);
    for (let i: any = 0; i < 6; i++) { const a: any = (i / 6) * TAU; B.push(0, 0.1, 0, a); cyl(1.6, 0, 0, 0.3, 0.7, 2.6, 6, 0x1e1a1e, PAT.BARK, { rz: -1.2 }); B.pop(); }
    for (let i: any = 0; i < 5; i++) { const a: any = rnd(0, TAU); cyl(0, rnd(5, 7), 0, 0.12, 0.4, rnd(2.5, 4), 6, 0x1e1a1e, PAT.BARK, { ry: a, rz: rnd(0.7, 1.1) }); }
    box(0, 0.4, 1.55, 1.2, 2.4, 0.4, 0x050405, 0, { occ: 0 });   // the hollow itself
    B.pop();
    addCircW(x, z, 2.1, y - 1, y + 8);
    SITES.greatTree = { x, z, y };
    SITES.cocoon = { x: x + 0.4, z: z + 2.6, y };
  }
  NO_GRASS.push({ x: H.x, z: H.z, r: 12 });
  FAR_KEEP.push({ x: H.x, z: H.z, r: 13 });
  // the wood itself
  const pathD: any = (x: any, z: any) => { let d: any = 1e9; for (let i: any = 0; i < P.length - 1; i++) d = Math.min(d, segDist(x, z, P[i], P[i + 1])); return d; };
  let n: any = 0;
  for (let i: any = 0; i < 9000 && n < 400; i++) {
    const x: any = rnd(50, 172), z: any = rnd(-150, 10), w: any = wGloam(x, z);
    if (w < 0.22 || !inWorld(x, z)) continue;
    if (pathD(x, z) < 6.2 || riverDist(x, z) < 9 || mountainH(x, z) > 5 || slopeAt(x, z) > 0.7) continue;
    let ok: any = true; for (const k of FAR_KEEP) if (Math.hypot(x - k.x, z - k.z) < k.r + 1) { ok = false; break; }
    if (!ok) continue;
    if (w < 0.55 && R() < 0.5) { plant(R() < 0.5 ? 'pine' : 'dead', x, z, rnd(0.9, 1.3)); n++; continue; }
    plant('gloam', x, z, rnd(0.85, 1.35)); n++;
    if (R() < 0.35) plant('shrooms', x + rnd(-1.5, 1.5), z + rnd(-1.5, 1.5), rnd(0.8, 1.3), { col: false, dy: 0 });
  }
  for (let i: any = 0; i < 40; i++) { const [x, z]: any = along(R()), o: any = rnd(2.6, 4.6) * (R() < 0.5 ? -1 : 1); plant('shrooms', x + o, z - o * 0.4, rnd(0.7, 1.0), { col: false, dy: 0 }); }
  wayfirePillar('wf_gloam', 69.5, -11, 'Gloamwood edge');
  B.ground = -1;
}
