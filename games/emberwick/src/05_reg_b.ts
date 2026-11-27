// ============================================================================
//  Region builders. Structures that need level ground go up before the terrain
//  is baked; everything else is dressed afterwards on the baked ground.
// ============================================================================
const KFIRES: any = [];      // fires the lantern can draw from or kindle: {id, kind, x, y, z, s, lit, ...}
const SITES: any = {};       // named places the story and the systems refer to
const STONESETS: any = [];   // wisp-raised stepping stones: {id, pts, y, up}
const WISPSPOTS: any = [];   // where wisps drift in the fen
const LAMPS: any = [];       // Gloamwood wisp-lamps
const THORNS: any = [];      // bramble walls a flare can burn away
function kfire(id: any, kind: any, x: any, y: any, z: any, o: any = {}) : any { const f: any = { id, kind, x, y, z, s: o.s ?? 1, lit: !!o.lit, ...o }; KFIRES.push(f); return f; }
const SOUTH_ROAD: any = [[0.5, 9.5], [1.5, 22], [3, 40], [4, 70], [5, 100], [6, 136], [9, 172]];
function polyAt(pts: any, z: any) : any {   // x of a north-south polyline at z
  for (let i: any = 0; i < pts.length - 1; i++) if (z >= pts[i][1] && z <= pts[i + 1][1]) return lerp(pts[i][0], pts[i + 1][0], (z - pts[i][1]) / (pts[i + 1][1] - pts[i][1]));
  return pts[z < pts[0][1] ? 0 : pts.length - 1][0];
}
const GLOAM_PATH: any = [[66.5, 13.5], [70, 0], [72, -20], [78, -34], [88, -48], [97, -60], [105, -72], [112, -82], [117.5, -86]];

function addRegionPaths() : any {
  addPath(3.6, SOUTH_ROAD);
  addPath(2.6, [[5, 93.5], [18, 94.5], [28.5, 94.5]]);                      // to Wil's farm
  addPath(2.4, [[28.5, 94.5], [40, 96], [43, 97]]);                         // and the barn
  addPath(2.2, [[5.2, 104], [1.5, 106]]);                                   // the Long Field gate
  addPath(3.0, [[6, 136], [24, 137], [40, 138], [56, 136.5], [74, 135], [90, 128], [102, 104]]);   // east road over the river
  addPath(3.0, [[6, 136], [-30, 142], [-70, 140], [-96, 130], [-104, 126]]);  // west road to the heath
  addPath(3.6, [[-60, 9], [-80, 8]]);                                       // the west road runs on
  addPath(2.8, [[-80, 8], [-86, -6], [-92, -20], [-97, -32], [-102, -42], [-106, -50], [-109, -53]]);   // up onto the downs
  addPath(2.4, [[-97, -32], [-112, -35], [-126, -37.5], [-131, -38]]);      // to the founders' barrow
  addPath(2.8, [[-80, 8], [-80, 22], [-79, 34], [-75, 44]]);                 // down to the fen
  addPath(2.8, [[66.5, 13.5], [70, 0], [72, -20]]);                         // north from the mill
  addPath(2.0, GLOAM_PATH.slice(2));                                        // into the Gloamwood
  addPath(2.6, [[58, 20], [64, 34], [70, 48], [72, 60]]);                   // to the orchard
  addPath(2.4, [[3.8, -12], [6, -26], [10, -34]]);                          // to the north watch
  addPath(2.0, [[72, -20], [100, -22], [124, -18]]);                        // the ridge path to the east beacon
  addPath(2.0, [[-92, -20], [-118, -6], [-138, 4]]);                        // and the west beacon
}

// ---- buildings that claim level ground (before the bake) -------------------------------------------
function buildRegionStructures() : any {
  addRegionPaths();
  V.farm = buildRect({
    id: 'farm', name: "Wil's Farmhouse", sub: 'Southfields', x: 30, z: 99, rot: 180, w: 9, d: 7,
    levels: [0.2], wallTop: 3.1, floorNames: ['Farmhouse'], mapColor: 0xc4a052,
    style: { ext: 0xe8dcc0, extPat: PAT.PLASTER, int: 0xdccfb2, intPat: PAT.PLASTER, timber: 0x5a3d26, plinth: { h: 0.6, c: 0x8b857a }, trim: 0x5a3d26 },
    open: {
      S: [[0, dr(1.6, 1.1, { color: 0x4a5a2a })], [0, wn(-2.2, { shutters: 0x4a5a2a, flowers: true })]],
      N: [[0, wn(0.5)]], E: [[0, wn(0, { w: 0.9 })]], W: [[0, wn(0.8, { w: 0.9 })]],
    },
    roof: { type: 'thatch', axis: 'x', pitch: 46, oh: 0.7, c: 0xc4a052, pat: PAT.THATCH, timber: 0x5a3d26 },
    chimneys: [{ x: -3.6, z: 0.2, from: 2.6, top: 6.9, w: 0.8, d: 1.0 }],
    furnish: (b: any, f: any) => {
      SITES.farmHearth = b.localY(-3.25, b.levels[0], 0.3);
      fireplace(-3.25, 0.3, PI / 2, { w: 1.8, d: 0.8, ch: 2.9, int: 8, pot: true, kf: 'hearth_farm', lit: false, label: "Wil's hearth" });
      rug(-1.6, 0.4, PI / 2, 2.0, 1.4, 0x7a4a2a);
      table(1.0, 0.6, 0, 1.4, 0.8); chair(1.0, 1.25, PI); chair(1.0, -0.05, 0); chair(1.95, 0.6, -PI / 2);
      plate(0.7, 0.79, 0.5, 'bread'); mug(1.3, 0.79, 0.7); candle(1.2, 0.79, 0.4, { light: true });
      bed(2.9, -2.2, PI / 2, { len: 1.9, blanket: 0x6a7a3a });
      dresser(-0.4, -2.95, 0); hangingHerbs(0.2, 2.85, -0.6, 5);
      barrel(3.6, 2.6, { top: 'apples' }); sack(3.0, 2.8); sack(3.6, 1.9, 1.2);
      for (let i: any = 0; i < 3; i++) pumpkin(-1.6 + i * 0.5, 0, 2.7, rnd(0.16, 0.24));
    },
    exterior: (b: any) => { bench(-2.4, 4.4, 0, 1.4); barrel(4.2, 4.2); crate(3.6, 4.5, 0.3, 0.5); woodpile(-5.6, -1.0, PI / 2); jackOLantern(0.2, 4.3, 0.24, 0.2); },
  });
  V.barn = buildRect({
    id: 'barn', name: 'The Old Barn', sub: 'Southfields', x: 44, z: 102, rot: 180, w: 10, d: 8, t: 0.25, openAir: true,
    levels: [0.12], wallTop: 4.0, floorNames: ['Barn'], mapColor: 0x8a3a2a,
    style: { ext: 0x8a3a2a, extPat: PAT.PLANK, int: 0x7a5a3a, intPat: PAT.PLANK, trim: 0x4a2a1a, sill: 0x6a4a2a },
    floorC: 0x8a7a5a, floorPat: PAT.STRAW,
    open: { S: [[0, { type: 'open', x: 0, w: 3.6, b: 0, h: 3.2 }]], E: [[0, wn(1.5, { w: 0.8, b: 1.8, h: 0.8 })]], W: [[0, wn(-1.5, { w: 0.8, b: 1.8, h: 0.8 })]] },
    roof: { type: 'gable', axis: 'x', pitch: 44, oh: 0.5, c: 0x5a4a3a, pat: PAT.SLATE, gableColor: 0x8a3a2a, gablePat: PAT.PLANK },
    onWall: (b: any, k: any) => { if (k === 'S') { for (const px of [-1.85, 1.85]) { box(px, 0, 0, 0.22, 3.3, 0.3, 0x4a2a1a, PAT.PLANK); } box(0, 3.2, 0.1, 4.0, 0.2, 0.3, 0x4a2a1a, PAT.PLANK); } },
    furnish: (b: any, f: any) => {
      for (const [x, z, r] of [[-3.6, -2.6, 0], [-3.6, -1.4, 0], [-2.5, -2.6, 0.1], [-3.6, -2.0, 0, 0.5]]) hayBale(x, z, r, 0);
      hayBale(-3.0, -2.0, PI / 2, 0.5); hayBale(-3.1, -2.6, 0.05, 1.0);
      hayBale(3.6, -2.8, 0); hayBale(3.6, -1.7, 0.05); hayBale(3.5, -2.2, PI / 2, 0.5);
      SITES.stash = b.localY(3.5, b.levels[0], -0.6);   // where the twins hid Wil's pumpkins
      cart(0.6, -1.4, 0.2);
      barrel(-4.2, 3.0); barrel(-3.6, 3.3, { h: 0.7, r: 0.26 });
      box(4.4, 1.1, 1.5, 0.06, 0.06, 2.4, WOOD.dark); for (let i: any = 0; i < 4; i++) box(4.38, 0.6, 0.6 + i * 0.6, 0.05, 1.0, 0.04, MET.iron, PAT.METAL, { rz: 0.1 });
      lanternHang(0, 3.1, 0, { night: 0, int: 3, range: 7, chain: 0.6 });
    },
  });
  // the north watch: a log platform on the cave road
  { const x: any = 12, z: any = -38; addPad({ x, z, hx: 2.6, hz: 2.6, m: 1.2, f: 3, y: Math.round(natH(x, z) * 10) / 10 }); SITES.watch = { x, z }; }
  // the founders' barrow: its entrance is cut into the mound's eastern flank
  { const [mx, mz]: any = BARROWS[0]; SITES.barrowMound = { x: mx, z: mz };
    const dx: any = mx + 8.4, dz: any = mz, y: any = Math.round(natH(dx + 2.5, dz) * 10) / 10;
    SITES.barrowDoor = { x: dx, z: dz, y };
    addPad({ x: dx + 2.4, z: dz, hx: 2.4, hz: 2.4, m: 0.8, f: 3, y });
    addPad({ x: dx - 1.2, z: dz, hx: 2.0, hz: 1.35, m: 0.1, f: 0.9, y: y - 0.05 }); }
  // the crossroads shrine and the south gate stand on their own little terraces
  addPad({ x: 12.5, z: 132, hx: 1.6, hz: 1.6, m: 1, f: 3, y: Math.round(natH(12.5, 132) * 10) / 10 });
}

// ---- small set pieces -------------------------------------------------------------------------------
function stoneWall(pts: any, h: any = 0.85, o: any = {}) : any {   // dry-stone wall following the ground (world coords)
  B.reset(); B.to(OUT); B.occ = 0;
  for (let i: any = 0; i < pts.length - 1; i++) {
    const [x0, z0]: any = pts[i], [x1, z1]: any = pts[i + 1], L: any = Math.hypot(x1 - x0, z1 - z0), a: any = Math.atan2(-(z1 - z0), x1 - x0);
    const n: any = Math.max(1, Math.round(L / 0.55));
    for (let k: any = 0; k < n; k++) {
      const t: any = (k + 0.5) / n, x: any = lerp(x0, x1, t), z: any = lerp(z0, z1, t), y: any = terrainH(x, z);
      for (let r: any = 0; r < 3; r++) {
        const ww: any = rnd(0.42, 0.66), hh: any = h / 3 * rnd(0.85, 1.1);
        box(x + rnd(-0.06, 0.06), y - 0.08 + r * h / 3, z + rnd(-0.06, 0.06), ww, hh, rnd(0.42, 0.55), vary(o.c ?? 0x9a948a, 0.12), PAT.STONE, { ry: a + rnd(-0.12, 0.12) });
      }
    }
    const cx: any = (x0 + x1) / 2, cz: any = (z0 + z1) / 2, yc: any = terrainH(cx, cz);
    addColW(cx, cz, L / 2, 0.3, (x1 - x0) / L, (z1 - z0) / L, yc - 1, yc + h + 0.2);
  }
}
function stook(x: any, z: any, s: any = 1) : any {   // sheaves leaning together in the stubble
  const y: any = terrainH(x, z), a0: any = rnd(0, TAU);
  for (let i: any = 0; i < 6; i++) {
    const a: any = a0 + (i / 6) * TAU;
    B.push(x + Math.cos(a) * 0.22 * s, y - 0.05, z + Math.sin(a) * 0.22 * s, -a + PI / 2, 0, 0.32);
    cyl(0, 0, 0, 0.13 * s, 0.09 * s, 0.95 * s, 6, vary(0xd8b860, 0.08), PAT.STRAW);
    cyl(0, 0.95 * s, 0, 0.04 * s, 0.14 * s, 0.32 * s, 6, vary(0xe2c470, 0.08), PAT.STRAW);
    B.pop();
  }
  cyl(x, y + 0.85 * s, z, 0.05, 0.3 * s, 0.35 * s, 7, 0xc8a850, PAT.STRAW);
  addCircW(x, z, 0.45 * s, y - 0.5, y + 1.2);
}
function standingStone(x: any, z: any, h: any = 2.2, o: any = {}) : any {
  const y: any = terrainH(x, z);
  B.push(x, y - 0.25, z, o.ry ?? rnd(0, TAU), rnd(-0.06, 0.06), rnd(-0.08, 0.08));
  sph(0, h * 0.5, 0, 0.55, vary(o.c ?? 0x8e8c84, 0.08), PAT.ROCK, { det: 1, jit: 0.18, sx: (o.w ?? 0.85), sy: h * 0.95, sz: 0.55, occ: 1 });
  if (o.rune) for (const sd of [-1, 1]) box(0, h * 0.62, sd * 0.31, 0.3, 0.38, 0.02, o.rune, o.runePat ?? 0, { em: o.runeEm ?? -1.6, occ: 0 });
  B.pop();
  addCircW(x, z, 0.55 * (o.w ?? 0.85), y - 0.5, y + h);
}
function brazier(x: any, z: any, o: any = {}) : any {   // iron fire basket on a stone foot; its fire is a kindle-able KFIRE
  const y: any = o.y ?? terrainH(x, z), h: any = o.h ?? 1.05;
  B.push(x, y, z, 0);
  cyl(0, 0, 0, 0.32, 0.38, 0.22, 8, 0x77746c, PAT.STONE);
  for (let i: any = 0; i < 3; i++) { const a: any = (i / 3) * TAU; box(Math.cos(a) * 0.18, 0.22, Math.sin(a) * 0.18, 0.05, h - 0.3, 0.05, MET.iron, PAT.METAL, { rz: Math.cos(a) * 0.12, rx: -Math.sin(a) * 0.12 }); }
  lathe(0, h - 0.12, 0, [[0.001, 0], [0.16, 0.0], [0.34, 0.2], [0.36, 0.26], [0.001, 0.08]], 10, MET.iron, PAT.METAL);
  B.pop();
  addCircW(x, z, 0.36, y - 0.3, y + h);
  return kfire(o.id, o.kind ?? 'hearth', x, y + h + 0.05, z, { s: o.s ?? 0.75, lit: o.lit, color: o.color, label: o.label, b: o.b ?? null });
}
function wayfirePillar(id: any, x: any, z: any, label: any) : any {
  const y: any = terrainH(x, z);
  B.reset(); B.to(OUT); B.occ = 1;
  B.push(x, y, z, rnd(0, 1));
  cyl(0, -0.3, 0, 0.62, 0.72, 0.5, 8, 0x8a857c, PAT.STONE);
  cyl(0, 0.2, 0, 0.3, 0.38, 1.5, 8, 0x9a948a, PAT.STONE);
  for (let i: any = 0; i < 4; i++) box(Math.cos(i * PI / 2) * 0.33, 0.7, Math.sin(i * PI / 2) * 0.33, 0.06, 0.6, 0.06, 0x6a665e, PAT.STONE, { ry: i * PI / 2 });
  lathe(0, 1.7, 0, [[0.001, 0], [0.3, 0.02], [0.46, 0.22], [0.42, 0.26], [0.001, 0.12]], 10, 0x6a665e, PAT.STONE);
  box(0, 0.9, 0.36, 0.3, 0.3, 0.04, 0xd8b060, 0, { em: -1.2, occ: 0 });   // the sun-and-flame mark
  B.pop();
  addCircW(x, z, 0.5, y - 0.5, y + 2);
  NO_GRASS.push({ x, z, r: 1.4 });
  MAPDOTS.push({ x, z, r: 1.6, c: '#ffcf7a' });
  return kfire(id, 'wayfire', x, y + 1.95, z, { s: 0.8, label, wayfire: true });
}
function beaconHill(id: any, x: any, z: any, label: any) : any {
  const y: any = terrainH(x, z);
  B.reset(); B.to(OUT); B.occ = 1;
  B.push(x, y, z, rnd(0, TAU));
  for (let i: any = 0; i < 10; i++) { const a: any = (i / 10) * TAU; sph(Math.cos(a) * 2.2, 0.05, Math.sin(a) * 2.2, rnd(0.25, 0.4), vary(0x8a857c, 0.1), PAT.STONE, { det: 0, jit: 0.25, sy: 0.6 }); }
  cyl(0, -0.2, 0, 0.9, 1.05, 0.7, 8, 0x8a857c, PAT.STONE);
  cyl(0, 0.5, 0, 0.12, 0.16, 2.2, 6, WOOD.dark, PAT.BARK);
  lathe(0, 2.5, 0, [[0.001, 0], [0.25, 0.0], [0.6, 0.4], [0.64, 0.5], [0.001, 0.2]], 10, MET.iron, PAT.METAL);
  for (let i: any = 0; i < 8; i++) { const a: any = (i / 8) * TAU; box(Math.cos(a) * 0.5, 2.6, Math.sin(a) * 0.5, 0.04, 0.5, 0.04, MET.iron, PAT.METAL, { ry: -a, rz: 0.4 }); }
  B.pop();
  addCircW(x, z, 1.0, y - 0.5, y + 2.5);
  NO_GRASS.push({ x, z, r: 2.5 });
  MAPDOTS.push({ x, z, r: 2, c: '#e8c27a' });
  return kfire(id, 'beacon', x, y + 2.95, z, { s: 1.6, label, beacon: true });
}

// ---- Southfields ----------------------------------------------------------------------------------------
function buildSouthfields() : any {
  B.reset(); B.to(OUT); B.occ = 1; B.ground = 0;
  // the gate over the road where the valley begins
  { const z: any = 158, x: any = polyAt(SOUTH_ROAD, z), y: any = terrainH(x, z);
    SITES.gate = { x, z };
    B.push(x, y, z, 0.08);
    for (const s of [-1, 1]) { cyl(s * 2.5, -0.3, 0, 0.16, 0.2, 4.3, 7, WOOD.dark, PAT.BARK); colCirc(s * 2.5, 0, 0.22, -0.5, 4); wallLantern(s * 2.5, 2.4, 0.14, 0, { int: 4, range: 7 }); }
    box(0, 3.75, 0, 5.6, 0.22, 0.24, WOOD.dark, PAT.BARK);
    box(0, 3.05, 0.1, 3.1, 0.62, 0.08, WOOD.mid, PAT.PLANK);
    for (const s of [-1, 1]) box(s * 0.9, 3.66, 0.1, 0.04, 0.12, 0.04, MET.iron);
    box(0, 3.12, 0.15, 2.7, 0.44, 0.02, 0x3a2a1a, PAT.NOISE);
    for (let i: any = 0; i < 9; i++) box(-1.05 + i * 0.26, 3.15, 0.17, 0.14, 0.34, 0.01, 0xe8c27a, 0, { em: -0.8 });   // carved letters, gilded
    B.pop();
    pumpkin(x + 3.4, 0, z + 0.8, 0.26); pumpkin(x + 3.0, 0, z + 1.4, 0.18); hayBale(x - 3.6, z + 0.6, 0.4);
  }
  // the crossroads: a signpost and the shrine of the travellers' flame
  { const cx: any = 6, cz: any = 136;
    signpost(cx + 3.2, cz - 3.4, 0.4, [0, PI / 2, PI, -PI / 2 + 0.3]);
    B.push(12.5, terrainH(12.5, 132), 132, -0.3);
    box(0, 0, 0, 1.9, 0.3, 1.5, 0x8a857c, PAT.STONE);
    box(0, 0.3, -0.35, 1.4, 1.6, 0.5, 0x9a948a, PAT.STONE);
    gable(0, 1.9, -0.25, 0.9, 0.6, 1.5, 0x6a5a4a, PAT.SLATE, { ry: PI / 2 });
    box(0, 0.3, 0.2, 0.5, 0.5, 0.4, 0x7a746c, PAT.STONE);
    for (let i: any = 0; i < 3; i++) { cyl(-0.3 + i * 0.3, 0.3, 0.45, 0.05, 0.06, 0.02, 8, MET.brass, PAT.METAL); cyl(-0.3 + i * 0.3, 0.32, 0.45, 0.025, 0.028, 0.12 + i * 0.05, 6, 0xf1e4c0); }
    { const p: any = B.wp(0, 0.55, 0.45); kfire('shrine', 'candle', p.x, p.y, p.z, { s: 0.45, lit: false, int: 3, range: 6, label: 'the travellers\u2019 shrine' }); }
    B.pop();
    colBox(12.5 - 0.0, 132, 2, 1.6, terrainH(12.5, 132) - 0.5, terrainH(12.5, 132) + 2.3);
    SITES.cross = { x: cx, z: cz };
  }
  wayfirePillar('wf_cross', 9.8, 130.6, 'Crossroads');
  // hedgerows along the south road, broken at the gates
  for (let z: any = 46; z < 132; z += 2.6) {
    const rx: any = polyAt(SOUTH_ROAD, z);
    for (const sd of [-1, 1]) {
      const x: any = rx + sd * rnd(4.0, 4.8);
      if ((z > 88 && z < 98 && sd > 0) || (z > 100 && z < 110 && sd < 0) || (z > 126 && z < 140)) continue;
      if (R() < 0.12) continue;
      if (R() < 0.08) plant(pick(['oak', 'maple']), x + sd * 1.2, z, rnd(0.9, 1.2)); else plant('hedge', x, z, rnd(0.8, 1.1), { ry: rnd(-0.3, 0.3) + PI / 2 });
    }
  }
  // the Long Field: stubble in rows, stooks, a dry-stone wall, the last sheaf standing alone
  const F: any = REG.field, fx0: any = F.x - 15, fx1: any = F.x + 15, fz0: any = F.z - 12, fz1: any = F.z + 12;
  stoneWall([[fx1, fz0 + 7], [fx1, fz0], [fx0, fz0], [fx0, fz1], [fx1, fz1], [fx1, fz0 + 11]]);
  B.reset(); B.to(OUT); B.occ = 0;
  for (const s of [-1, 1]) { const x: any = fx1 + 0.1, z: any = fz0 + 9 + s * 2, y: any = terrainH(x, z); box(x, y - 0.2, z, 0.3, 1.25, 0.3, 0x8a847a, PAT.STONE); }   // gateposts
  const BF: any = { x: F.x + 6.5, z: F.z };   // the Kindling bonfire, built and waiting
  for (let z: any = fz0 + 1.2; z < fz1 - 0.8; z += 1.1) for (let x: any = fx0 + 1.0; x < fx1 - 0.8; x += 0.95) {
    if (Math.hypot(x - F.x, z - F.z) < 1.8 || Math.hypot(x - BF.x, z - BF.z) < 2.6) continue;
    plant('stubble', x + rnd(-0.12, 0.12), z + rnd(-0.08, 0.08), rnd(0.9, 1.15), { col: false, dy: 0 });
  }
  B.reset(); B.to(OUT); B.occ = 1;
  for (let z: any = fz0 + 3; z < fz1 - 2; z += 4.2) for (let x: any = fx0 + 2.5; x < fx1 - 2; x += 3.8) {
    if (Math.hypot(x - F.x, z - F.z) < 10.5) continue;
    if (R() < 0.18) continue;
    stook(x + rnd(-0.6, 0.6), z + rnd(-0.5, 0.5), rnd(0.9, 1.1));
  }
  { const y: any = terrainH(BF.x, BF.z);
    B.push(BF.x, y, BF.z, 0.2);
    for (let i: any = 0; i < 14; i++) { const a: any = (i / 14) * TAU; B.push(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9, -a); cyl(0, 0, 0, 0.09, 0.12, 2.7, 6, vary(WOOD.dark, 0.12), PAT.BARK, { rz: 0.42 }); B.pop(); }
    for (let i: any = 0; i < 10; i++) { const a: any = rnd(0, TAU); box(Math.cos(a) * 0.6, 0.15, Math.sin(a) * 0.6, 1.2, 0.14, 0.14, vary(WOOD.mid, 0.1), PAT.BARK, { ry: rnd(0, 3) }); }
    for (let i: any = 0; i < 12; i++) { const a: any = (i / 12) * TAU; sph(Math.cos(a) * 1.9, 0.04, Math.sin(a) * 1.9, 0.22, vary(0x8a857c, 0.1), PAT.STONE, { det: 0, sy: 0.6 }); }
    B.pop();
    addCircW(BF.x, BF.z, 1.25, y - 0.5, y + 2.4);
    NO_GRASS.push({ x: BF.x, z: BF.z, r: 2.4 });
    SITES.bonfire = kfire('bonfire', 'hearth', BF.x, y + 0.6, BF.z, { s: 2.2, lit: false, int: 20, range: 16, label: 'the Kindling bonfire', locked: 'midnight' });
  }
  { // the Last Sheaf: tied with red ribbon, never cut, faintly gilded by the low sun
    const x: any = F.x, z: any = F.z, y: any = terrainH(x, z);
    SITES.sheaf = { x, z, y };
    B.push(x, y - 0.05, z, 0.3);
    for (let i: any = 0; i < 26; i++) { const a: any = rnd(0, TAU), r: any = rnd(0, 0.16); cyl(Math.cos(a) * r, 0, Math.sin(a) * r, 0.012, 0.02, rnd(1.15, 1.45), 4, vary(0xe2c060, 0.08), 0, { rx: Math.sin(a) * r * 0.5, rz: -Math.cos(a) * r * 0.5, em: -0.25, sway: 0.25, swayH: 1 }); }
    for (let i: any = 0; i < 14; i++) { const a: any = rnd(0, TAU); cyl(Math.cos(a) * 0.12, 1.28, Math.sin(a) * 0.12, 0.03, 0.03, 0.22, 4, 0xe8c870, PAT.STRAW, { rz: -Math.cos(a) * 0.5, rx: Math.sin(a) * 0.5, em: -0.3, sway: 0.4 }); }
    torus(0, 0.72, 0, 0.13, 0.025, 4, 12, 0xb8282a, 0, { rx: PI / 2 });
    box(0.1, 0.45, 0.12, 0.05, 0.3, 0.01, 0xb8282a, 0, { rz: 0.2 }); box(-0.06, 0.45, 0.13, 0.05, 0.28, 0.01, 0xb8282a, 0, { rz: -0.25 });
    for (let i: any = 0; i < 9; i++) { const a: any = (i / 9) * TAU; sph(Math.cos(a) * 1.3, 0.04, Math.sin(a) * 1.3, 0.16, vary(0x9a948a, 0.1), PAT.STONE, { det: 0, sy: 0.6 }); }
    B.pop();
    addCircW(x, z, 0.3, y - 0.5, y + 1.5);
    SPARKLES.push({ p: new V3(x, y + 1.1, z), r: 0.5, c: col(0xffe08a), rate: 1.2 });
    NO_GRASS.push({ x, z, r: 1.8 });
  }
  scarecrow(F.x - 9, F.z + 6, 0.7); scarecrow(F.x + 8, F.z - 7, -0.4);
  // Wil's farmyard: pumpkin patch, haystacks, a well and a cart
  B.reset(); B.to(OUT); B.occ = 1;
  for (let i: any = 0; i < 34; i++) { const x: any = 23 + (i % 7) * 1.7 + rnd(-0.3, 0.3), z: any = 108 + Math.floor(i / 7) * 1.7 + rnd(-0.3, 0.3); if (R() < 0.2) continue; pumpkin(x, 0, z, rnd(0.18, 0.36), pick([0xd8661c, 0xe07a24, 0xc85a1a, 0xe8a03a])); }
  for (let i: any = 0; i < 24; i++) { const x: any = 23 + rnd(0, 11), z: any = 108 + rnd(0, 7.5); box(x, terrainH(x, z), z, rnd(0.5, 1.0), 0.04, 0.1, 0x4a6a2a, PAT.LEAF, { ry: rnd(0, 3), occ: 0 }); }
  fence([[21.5, 106.5], [21.5, 117], [35.5, 117], [35.5, 106.5], [29, 106.5]], { ground: true });
  NO_GRASS.push({ x: 28.5, z: 111.5, r: 6.5 });
  scarecrow(33.5, 115.5, 2.4);
  hayBale(37.5, 95.5, 0.3); hayBale(38.4, 95.0, 1.4); hayBale(37.9, 95.3, 0.8, 0.5);
  well(23.5, 101.5);
  cart(48.5, 95.0, 2.6);
  fence([[39, 92], [50, 92], [50, 109], [39, 109]], { ground: true, c: 0x7a5a3a });
  // orchard of the east bank, beehives in the long grass, the cider shed
  B.reset(); B.to(OUT); B.occ = 1;
  for (let r: any = 0; r < 5; r++) for (let c: any = 0; c < 6; c++) { const x: any = 58 + c * 5.2 + (r % 2) * 2.4, z: any = 50 + r * 5.6; if (riverDist(x, z) < 9) continue; plant('apple', x + rnd(-0.4, 0.4), z + rnd(-0.4, 0.4), rnd(0.9, 1.15)); }
  for (let i: any = 0; i < 5; i++) { const x: any = 84 + i * 1.6, z: any = 56 + (i % 2) * 1.2, y: any = terrainH(x, z); B.push(x, y, z, rnd(-0.2, 0.2)); box(0, 0, 0, 0.5, 0.25, 0.5, WOOD.dark); box(0, 0.25, 0, 0.56, 0.62, 0.56, 0xe8d8b8, PAT.STRAW); box(0, 0.87, 0, 0.66, 0.08, 0.66, 0x7a5a3a, PAT.PLANK); B.pop(); addCircW(x, z, 0.35, y - 0.3, y + 1); }
  { const x: any = 80, z: any = 46, y: any = terrainH(x, z); B.push(x, y, z, 0.6);
    for (const [sx, sz] of [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]]) box(sx, 0, sz, 0.18, 2.4, 0.18, WOOD.dark, PAT.BARK);
    box(0, 2.3, 0, 3.6, 0.1, 2.6, 0x6a5a3a, PAT.PLANK, { rx: 0.12 }); box(0, 0, -1.2, 3.2, 1.2, 0.08, WOOD.mid, PAT.PLANK);
    barrel(-0.9, -0.4); barrel(0.0, -0.5, { h: 0.7, r: 0.26 }); barrel(1.0, 0.4, { lying: true });
    B.push(0.6, 0, -0.4, 0); cyl(0, 0, 0, 0.5, 0.55, 0.8, 10, WOOD.mid, PAT.BARK); box(0, 0.8, 0, 0.12, 0.9, 0.12, WOOD.dark); box(0, 1.6, 0, 1.0, 0.1, 0.1, WOOD.dark); B.pop();
    B.pop(); addColW(x, z, 1.8, 1.3, Math.cos(-0.6), Math.sin(-0.6), y - 0.5, y + 2.4); SITES.ciderShed = { x, z }; }
  // the east road's bridge over the river
  { const z0: any = 135.6, xa: any = 56.2, xb: any = 75.5, yd: any = 1.15;
    B.reset(); B.to(OUT); B.occ = 0;
    const ya: any = terrainH(xa, z0), yb: any = terrainH(xb, z0), x0d: any = 60, x1d: any = 71.5;
    const topAt: any = (x: any) => x < x0d ? lerp(ya, yd, (x - xa) / (x0d - xa)) : x > x1d ? lerp(yd, yb, (x - x1d) / (xb - x1d)) : yd;
    for (let x: any = xa; x < xb; x += 0.32) { const y: any = topAt(x + 0.16); box(x + 0.16, y - 0.12, z0, 0.3, 0.12, 2.8, vary(WOOD.mid, 0.08), PAT.PLANK, { uv: 0 }); }
    for (let x: any = xa + 1; x < xb; x += 2.4) for (const sd of [-1, 1]) { const y: any = topAt(x); cyl(x, -1.8, z0 + sd * 1.45, 0.11, 0.12, y + 2.8, 6, WOOD.dark, PAT.BARK); }
    for (const sd of [-1, 1]) for (let x: any = xa; x < xb - 0.1; x += 1.0) { const y0: any = topAt(x), y1: any = topAt(x + 1.0); box(x + 0.5, (y0 + y1) / 2 + 0.85, z0 + sd * 1.45, 1.02, 0.07, 0.07, WOOD.dark, PAT.PLANK, { rz: Math.atan2(y1 - y0, 1) }); }
    walkRamp((xa + x0d) / 2, z0, 2.6, x0d - xa, ya, yd, PI / 2); walkRect((x0d + x1d) / 2, z0, x1d - x0d, 2.6, yd); walkRamp((x1d + xb) / 2, z0, 2.6, xb - x1d, yb, yd, -PI / 2);
    for (const sd of [-1, 1]) addColW((xa + xb) / 2, z0 + sd * 1.5, (xb - xa) / 2, 0.12, 1, 0, -2, 3);
  }
  // scattered country: oaks in the field corners, gorse on the southern slopes
  for (let i: any = 0; i < 1800; i++) {
    const x: any = rnd(-80, 120), z: any = rnd(48, 172);
    if (!inWorld(x, z) || !farOk(x, z, 2.5)) continue;
    if (longFieldK(x, z) > 0 || wFen(x, z) > 0.3 || Math.abs(x - polyAt(SOUTH_ROAD, z)) < 7) continue;
    if (x > 18 && x < 52 && z > 86 && z < 120) continue;
    if (x > 54 && x < 92 && z > 42 && z < 82) continue;
    const n: any = fbm2(x * 0.03 + 3, z * 0.03 - 8);
    if (n < 0.52 && R() < 0.85) continue;
    const k: any = R(), rw: any = Math.hypot(x - WORLD.cx, z - WORLD.cz);
    if (rw > 140 || n > 0.66) plant(k < 0.5 ? 'oak' : k < 0.75 ? 'maple' : 'pine', x, z, rnd(0.9, 1.35));
    else if (k < 0.35) plant('gorse', x, z, rnd(0.8, 1.2), { col: false });
    else if (k < 0.6) plant('bush', x, z, rnd(0.8, 1.2), { col: false });
    else plant(k < 0.8 ? 'oak' : 'birch', x, z, rnd(0.9, 1.25));
  }
  B.ground = -1;
}
// keep trees off roads, out of the river, away from buildings and the set pieces
const FAR_KEEP: any = [];    // {x, z, r}
function nearPath(x: any, z: any, r: any) : any {
  for (const p of PATHS) {
    if (x < p.minx - r || x > p.maxx + r || z < p.minz - r || z > p.maxz + r) continue;
    for (let i: any = 0; i < p.pts.length - 1; i++) if (segDist(x, z, p.pts[i], p.pts[i + 1]) < p.w / 2 + r) return true;
  }
  return false;
}
function farOk(x: any, z: any, r: any = 2) : any {
  if (nearPath(x, z, r + 0.4) || riverDist(x, z) < 8 || terrainH(x, z) < WATER_Y + 0.15) return false;
  if (mountainH(x, z) > 0.8 || slopeAt(x, z) > 0.6) return false;
  if (inBuilding(x, z)) return false;
  for (const k of FAR_KEEP) if (Math.abs(x - k.x) < k.r + r && Math.abs(z - k.z) < k.r + r && Math.hypot(x - k.x, z - k.z) < k.r + r) return false;
  for (const b of BUILDINGS) { const c: any = b.localY(0, 0, 0); if (Math.hypot(x - c.x, z - c.z) < (b.s.R ? b.s.R + 4 : Math.hypot(b.s.w, b.s.d) / 2 + 3)) return false; }
  return Math.hypot(x, z) > 52;
}

// ---- the north watch --------------------------------------------------------------------------------------
function buildNorthWatch() : any {
  const { x, z }: any = SITES.watch, y: any = terrainH(x, z);
  B.reset(); B.to(OUT); B.occ = 1;
  B.push(x, y, z, -0.4);
  for (const [sx, sz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) { cyl(sx, -0.3, sz, 0.13, 0.16, 3.3, 6, WOOD.dark, PAT.BARK); colCirc(sx, sz, 0.18, -0.5, 3); }
  box(0, 2.3, 0, 3.0, 0.14, 3.0, WOOD.mid, PAT.PLANK);
  for (const [sx, sz, a] of [[0, -1.45, 0], [0, 1.45, 0], [-1.45, 0, PI / 2], [1.45, 0, PI / 2]]) box(sx, 3.15, sz, 3.0, 0.08, 0.08, WOOD.dark, PAT.PLANK, { ry: a });
  gable(0, 3.6, 0, 3.4, 1.2, 3.4, 0x6a4a33, PAT.THATCH, { ry: 0 });
  for (let i: any = 0; i < 9; i++) box(1.7, 0.2 + i * 0.25, 0.4, 0.5, 0.05, 0.08, WOOD.mid, 0);   // ladder rungs
  for (const s of [-1, 1]) box(1.7, -0.1, 0.4 + s * 0.24, 0.07, 2.5, 0.07, WOOD.dark);
  B.pop();
  // a palisade of sharpened stakes across the cave road's flank
  for (let i: any = 0; i < 9; i++) { const a: any = -0.4 + i * 0.09, px: any = x - 5 + i * 1.1, pz: any = z + 2.5 + Math.sin(i) * 0.4, py: any = terrainH(px, pz); B.push(px, py - 0.2, pz, 0, 0.25, 0); cyl(0, 0, 0, 0.0, 0.12, 1.8, 5, WOOD.mid, PAT.BARK); B.pop(); void a; addCircW(px, pz, 0.14, py - 0.5, py + 1.6); }
  brazier(x + 2.6, z + 1.2, { id: 'watch', kind: 'hearth', label: 'the watch brazier', h: 1.2, s: 0.85 });
  NO_GRASS.push({ x, z, r: 2.4 });
}

// ---- the valley's beacons and wayfires ----------------------------------------------------------------------
function buildBeacons() : any {
  const names: any = { heath: 'the Heath Beacon', meadow: 'the Meadow Beacon', gloamridge: 'the Gloamridge Beacon', westridge: 'the Westridge Beacon' };
  for (const [x, z, id] of BEACONS) { const f: any = beaconHill('bc_' + id, x, z, names[id]); SITES['bc_' + id] = f; FAR_KEEP.push({ x, z, r: 4 }); }
  wayfirePillar('wf_square', -7.5, 8.5, 'Emberwick square');
}
