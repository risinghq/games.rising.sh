// ============================================================================
//  EMBERWICK — the village. Buildings, interiors, plaza, river and fields.
// ============================================================================
const dr = (x, w = 1.2, o = {}) => ({ type: 'door', x, w, h: 2.25, b: 0, ...o });
const wn = (x, o = {}) => ({ type: 'window', x, w: 1.0, h: 1.2, b: 0.95, glass: 'lead', ...o });
const V = {};      // named buildings
const DOCK = { y: 0.16 };

function shelfUnit(x, z, ry, w = 1.6, h = 2.0, items = 'mixed') {
  const _occ = B.occ; B.occ = 1;
  B.push(x, 0, z, ry);
  box(0, 0, -0.16, w, h, 0.04, shade(WOOD.mid, 0.7), PAT.PLANK);
  for (const s of [-1, 1]) box(s * (w / 2 - 0.03), 0, 0, 0.06, h, 0.36, WOOD.mid, PAT.PLANK);
  box(0, h - 0.04, 0, w, 0.05, 0.36, WOOD.mid, PAT.PLANK);
  for (let i = 0; i < 4; i++) {
    const y = 0.05 + i * (h - 0.1) / 3.6;
    box(0, y, 0, w - 0.1, 0.04, 0.34, WOOD.mid, PAT.PLANK);
    let px = -w / 2 + 0.16;
    while (px < w / 2 - 0.14) {
      const k = items === 'bread' ? 'bread' : pick(['jar', 'bottle', 'pot', 'box', 'jar', 'cloth']);
      if (k === 'jar') jar(px, y + 0.04, 0, pick([0xc9b48a, 0x9e6a3c, 0x7d8a5a, 0xb05a3a]));
      else if (k === 'bottle') bottle(px, y + 0.04, 0, pick([0x2f6a3a, 0x6a2424, 0x2a3f7a, 0x8a6a2a]));
      else if (k === 'pot') lathe(px, y + 0.04, 0, [[0.001, 0], [0.08, 0], [0.1, 0.1], [0.06, 0.18], [0.07, 0.2], [0.001, 0.2]], 8, pick([0xa2563a, 0x8a7a5a, 0x5a6a7a]), PAT.NOISE);
      else if (k === 'box') box(px, y + 0.04, 0, 0.16, rnd(0.1, 0.22), 0.22, pick([0x8a5a3a, 0xa88a5a, 0x5a4a3a]), PAT.PLANK);
      else if (k === 'cloth') box(px, y + 0.04, 0, 0.18, 0.12, 0.26, pick([0x7a3a6a, 0x3a5a8a, 0xc8a03a, 0x4a7a4a]), PAT.NOISE);
      else ball(px, y + 0.1, 0.02, 0.07, pick([0xb87a3a, 0xc68a44, 0x9a5a2a]), PAT.NOISE, { sx: 1.6, sy: 0.75 });
      px += k === 'bread' ? 0.24 : rnd(0.15, 0.26);
    }
  }
  colBox(0, 0, w, 0.42, 0, h);
  B.pop();
  B.occ = _occ;
}
function fireplace(x, z, ry, o = {}) {
  const _occ = B.occ; B.occ = 1;
  const w = o.w ?? 2.2, d = o.d ?? 0.9, ch = o.ch ?? 3.0, c = o.c ?? 0x8e877c;
  B.push(x, 0, z, ry);
  box(0, 0, 0.25, w + 0.5, 0.1, d + 0.5, shade(c, 0.85), PAT.STONE);
  for (const s of [-1, 1]) box(s * (w / 2 - 0.25), 0.1, 0, 0.5, 1.15, d, c, PAT.STONE);
  box(0, 1.25, 0, w, 0.55, d, c, PAT.STONE);
  box(0, 1.8, 0.1, w + 0.24, 0.1, d + 0.2, WOOD.dark, PAT.PLANK);
  box(0, 1.9, -0.12, w - 0.3, ch - 1.9, d - 0.24, c, PAT.STONE);
  box(0, 0.1, -d / 2 + 0.06, w - 0.95, 1.15, 0.08, 0x1d1915, PAT.NOISE);
  const kf = fire(0, 0.1, 0.02, o.fs ?? 1.0, { int: o.int ?? 9, kf: o.kf, lit: o.lit, label: o.label, memory: o.memory });
  candle(-w / 2 + 0.3, 1.9, 0.18); candle(w / 2 - 0.3, 1.9, 0.18);
  if (o.pot) {
    box(0, 1.15, 0.05, 0.03, 0.12, 0.03, MET.iron);
    lathe(0, 0.55, 0.05, [[0.001, 0], [0.18, 0.02], [0.24, 0.16], [0.22, 0.3], [0.2, 0.32]], 10, MET.iron, PAT.METAL);
  }
  colBox(0, 0.05, w + 0.5, d + 0.4, 0, 2);
  B.pop();
  B.occ = _occ;
  return kf;
}
function hangingHerbs(x, y, z, n = 5) {
  for (let i = 0; i < n; i++) {
    const px = x + (i - n / 2) * 0.22;
    box(px, y - 0.3, z, 0.015, 0.3, 0.015, 0x6a5a3a);
    sph(px, y - 0.42, z, 0.08, pick([0x6a8a3a, 0x8a7a3a, 0x7a5a6a, 0x5a7a4a]), PAT.LEAF, { det: 0, sy: 1.8, occ: 0 });
  }
}
function loaf(x, y, z, s = 1) { ball(x, y + 0.05 * s, z, 0.1 * s, pick([0xb87a3a, 0xc68a44, 0xa8642e]), PAT.NOISE, { sx: 1.7, sy: 0.75 }); }

// ---------------------------------------------------------------------------
function buildVillage() {
  // ======================= THE GILDED GOOSE (inn, 2 floors) ===============
  V.inn = buildRect({
    id: 'inn', name: 'The Gilded Goose', sub: 'Tavern & lodging', x: -2, z: -21, rot: 0, w: 15, d: 10,
    levels: [0.2, 3.4], wallTop: 6.25, floorNames: ['Taproom', 'Guest rooms'], mapColor: 0xb4553a,
    style: { ext: 0xeadcbc, extPat: PAT.PLASTER, int: 0xd9c9a6, intPat: PAT.PLASTER, timber: 0x4a3020, plinth: { h: 0.75, c: 0x8b857a }, wainscot: 0x6e4a2e, trim: 0x4a3020, sill: 0x6e4a2e },
    styleUp: { ext: 0xf2e4c2, extPat: PAT.PLASTER, int: 0xe4d6b6, intPat: PAT.PLASTER, timber: 0x4a3020, trim: 0x4a3020 },
    open: {
      S: [[0, dr(-2.5, 1.3, { h: 2.3, color: 0x6b3a24 })], [0, wn(-5.6, { w: 1.1, h: 1.3, shutters: 0x4a6a3a })], [0, wn(1.1, { w: 1.1, h: 1.3, shutters: 0x4a6a3a })], [0, wn(4.8, { w: 1.1, h: 1.3, shutters: 0x4a6a3a })],
        [1, wn(-5.0, { w: 0.9, h: 1.1, b: 0.9, flowers: true })], [1, wn(-0.6, { w: 0.9, h: 1.1, b: 0.9, flowers: true })], [1, wn(3.6, { w: 0.9, h: 1.1, b: 0.9, flowers: true })]],
      N: [[0, wn(3.0)], [0, wn(5.7, { w: 0.8 })], [1, wn(-4.9, { w: 0.9 })], [1, wn(-0.3, { w: 0.9 })], [1, wn(3.8, { w: 0.9 })]],
      E: [[0, wn(3.6, { w: 0.9 })], [0, wn(-3.6, { w: 0.9 })], [1, wn(3.3, { w: 0.9 })], [1, wn(-3.5, { w: 0.8 })]],
      W: [[0, wn(-3.3, { w: 0.9 })], [0, wn(3.3, { w: 0.9 })], [1, wn(-2.4, { w: 0.9 })]],
    },
    stairs: [{ from: 0, x: 6.45, z: 0, ry: 0, w: 1.2, len: 4.4, open: 'L', rails: [[5.72, -2.25, 5.72, 2.05], [5.72, -2.25, 7.2, -2.25]] }],
    cellar: { hole: [0.95, -4.72, 5.45, -3.32], rails: [[0.93, -3.28, 5.45, -3.28], [0.93, -4.7, 0.93, -3.28]] },
    parts: [
      { f: 1, a: [-7.2, 1.9], b: [5.6, 1.9], ops: [{ d: 2.7, w: 0.95 }, { d: 6.9, w: 0.95 }, { d: 10.8, w: 0.95 }] },
      { f: 1, a: [-2.6, 1.82], b: [-2.6, -4.7] },
      { f: 1, a: [2.0, 1.82], b: [2.0, -4.7] },
    ],
    roof: { type: 'gable', axis: 'x', pitch: 40, oh: 0.6, c: 0xb4553a, pat: PAT.TILE, timber: 0x4a3020, gableWindow: true },
    chimneys: [{ x: -6.85, z: 0.5, from: 5.8, top: 11.4, w: 1.0, d: 1.3 }],
    onWall: (b, k, f, g) => {
      if (k === 'S' && f === 0) {
        wallLantern(-3.55, 1.95, 0.15, 0, { int: 5 }); wallLantern(-1.45, 1.95, 0.15, 0, { int: 5 });
        // hanging sign perpendicular to the facade
        box(0.3, 2.95, 0.6, 0.07, 0.07, 1.0, MET.iron);
        box(0.3, 2.0, 0.85, 0.07, 0.85, 1.1, WOOD.dark, PAT.PLANK);
        box(0.3, 2.06, 0.85, 0.09, 0.73, 0.98, 0x2d4a3a, PAT.NOISE);
        sph(0.3, 2.45, 0.85, 0.27, MET.gold, PAT.METAL, { det: 1, sx: 0.5, sz: 1.2 });
        sph(0.3, 2.68, 1.12, 0.1, MET.gold, PAT.METAL, { det: 1, sx: 0.5 });
        cyl(0.3, 2.62, 1.2, 0.0, 0.04, 0.12, 4, 0xe08a2a, 0, { rx: PI / 2 });
      }
    },
    furnish: (b, f) => {
      if (f === 0) {
        fireplace(-6.75, 0.5, PI / 2, { w: 2.3, ch: 3.2, int: 10, pot: true, kf: 'hearth_inn', label: "the Goose's hearth", memory: 'inn' });
        painting(-7.13, 2.3, 0.5, PI / 2, 1.2, 0.7, 1);
        rug(-5.35, 0.5, PI / 2, 2.6, 1.7, 0x8a2f2a);
        armchair(-4.75, 1.1, -PI / 2 - 0.3, 0x7a2f2a);
        armchair(-4.75, -0.3, -PI / 2 + 0.3, 0x3a5a6a);
        counter(-3.6, -2.9, 0, 4.8);
        for (let i = 0; i < 4; i++) mug(-5.4 + i * 1.2, 1.05, -2.85);
        candle(-2.2, 1.05, -2.8, { light: true, int: 1.6 });
        kegRack(-5.6, -4.35, 0, 3);
        wallShelf(-2.6, 1.45, -4.55, 0, 2.6, 'bottles'); wallShelf(-2.6, 2.0, -4.55, 0, 2.6, 'mugs');
        barrel(-1.5, -4.2); barrel(-0.8, -4.25, { h: 0.7, r: 0.26 });
        painting(-3.9, 2.45, -4.66, 0, 1.1, 0.6, 0);
        roundTable(-2.9, 1.5, 0.66);
        for (let i = 0; i < 4; i++) { const a = i * PI / 2 + 0.4; stool(-2.9 + Math.cos(a) * 0.98, 1.5 + Math.sin(a) * 0.98); }
        candle(-2.9, 0.76, 1.5, { light: true }); mug(-2.6, 0.76, 1.3); mug(-3.2, 0.76, 1.75); plate(-2.8, 0.76, 1.85, 'bread');
        table(1.3, 1.45, 0, 2.5, 0.9, { cloth: 0xc9b98a });
        bench(1.3, 0.65, 0, 2.3); bench(1.3, 2.25, PI, 2.3);
        candle(1.3, 0.79, 1.45, { light: true }); plate(0.5, 0.79, 1.3, 'pie'); plate(2.1, 0.79, 1.6, 'apple'); mug(0.9, 0.79, 1.7); mug(1.8, 0.79, 1.2);
        roundTable(2.9, -1.55, 0.6);
        chair(2.9, -2.5, 0); chair(1.95, -1.35, PI / 2); chair(3.85, -1.25, -PI / 2);
        candle(2.9, 0.76, -1.55, { light: true }); mug(3.1, 0.76, -1.35);
        chandelier(-0.2, 2.72, 0.3, 0.7, 6, { int: 7 });
        banner(2.6, 1.3, -4.66, 0, 0.9, 1.6, 0x2e4a7a);
        barrel(-6.5, 4.1); barrel(-6.6, 3.3, { h: 0.7, r: 0.26 }); crate(-5.8, 4.2, 0.3, 0.55);
        plantPot(-0.6, 4.25); plantPot(4.4, 4.2);
        wallShelf(4.2, 1.6, 4.55, PI, 1.4, 'mixed');
      } else {
        rug(-0.5, 3.35, 0, 11.0, 1.0, 0x6a2a4a);
        bench(-5.6, 4.32, PI, 1.4, { back: true });
        plantPot(4.9, 4.25);
        wallLantern(-2.1, 1.75, 1.98, 0, { night: 0, int: 3, range: 6 });
        wallLantern(1.4, 1.75, 1.98, 0, { night: 0, int: 3, range: 6 });
        painting(-2.0, 1.3, 4.66, PI, 0.8, 0.55, 2);
        // room 1
        box(-6.85, 0, 0.5, 0.7, 2.85, 1.3, 0x8e877c, PAT.STONE);
        { B.push(-6.32, 0, 0.5, PI / 2);   // a little iron grate against the chimney breast, gone cold
          box(0, 0, 0, 0.8, 0.12, 0.42, MET.iron, PAT.METAL);
          for (let i = 0; i < 5; i++) box(-0.32 + i * 0.16, 0.12, 0.2, 0.03, 0.34, 0.03, MET.iron, PAT.METAL);
          box(0, 0.44, 0.2, 0.7, 0.04, 0.04, MET.iron, PAT.METAL);
          fire(0, 0.12, 0, 0.5, { kf: 'grate_basil', lit: false, int: 5, range: 6, label: 'Sir Basil\u2019s grate' });
          colBox(0, 0, 0.85, 0.5, 0, 0.6);
          B.pop(); }
        bed(-5.3, -3.55, 0, { blanket: 0x7a2a3a });
        nightstand(-4.2, -4.4, 0, { light: true });
        wardrobe(-3.35, -4.35, 0);
        chest(-5.3, -1.95, 0);
        rug(-4.9, -0.75, 0, 2.2, 1.5, 0x3a5a7a);
        // room 2
        bed(-1.55, -3.55, 0, { w: 0.95, blanket: 0x3a6a4a });
        bed(0.95, -3.55, 0, { w: 0.95, blanket: 0x7a6a2a });
        nightstand(-0.3, -4.4, 0, { light: true });
        dresser(-0.3, 1.45, PI);
        rug(-0.3, -1.2, 0, 2.6, 1.4, 0x7a4a2a);
        // room 3
        bed(3.3, -3.55, 0, { blanket: 0x2a3a6a });
        table(3.1, 0.95, 0, 1.1, 0.6); chair(3.1, 0.4, 0); candle(3.4, 0.78, 1.05, { light: true });
        box(3.0, 0.78, 0.95, 0.3, 0.02, 0.22, 0xefe4c8, 0);
        B.push(6.4, 0, -3.55, 0);
        lathe(0, 0, 0, [[0.001, 0], [0.55, 0], [0.62, 0.55], [0.6, 0.58], [0.001, 0.58]], 14, WOOD.mid, PAT.BARK);
        cyl(0, 0.48, 0, 0.56, 0.56, 0.02, 14, 0x8ab8c8, 0);
        for (const t of [0.12, 0.42]) cyl(0, t, 0, 0.6, 0.6, 0.04, 14, MET.iron, PAT.METAL);
        colCirc(0, 0, 0.62, 0, 0.6);
        B.pop();
      }
    },
    exterior: (b) => {
      bench(3.0, 5.65, 0, 1.8); bench(-6.2, 5.65, 0, 1.6);
      barrel(6.7, 5.6); barrel(7.25, 5.0, { h: 0.7, r: 0.26 }); crate(6.0, 5.75, 0.4, 0.5);
      plantPot(-3.8, 5.55); plantPot(-1.2, 5.55);
      cart(10.6, 1.5, 0.2);
      hayBale(9.9, -2.4, 0.3); jackOLantern(9.6, -1.6, 0.26, 0.4, 0.5);
    },
  });

  // ======================= TOBIAS & DAUGHTERS (store, 2 floors) ===========
  V.store = buildRect({
    id: 'store', name: 'Tobias & Daughters', sub: 'Provisioner', x: -22, z: -3, rot: 0, w: 10, d: 9,
    levels: [0.2, 3.3], wallTop: 6.0, floorNames: ['Shop floor', 'Family rooms'], mapColor: 0x5b6272,
    style: { ext: 0xb9ae99, extPat: PAT.STONE, int: 0xd8cdb4, intPat: PAT.PLASTER, trim: WOOD.dark, wainscot: 0x5a3e2a, sill: 0x8a7a62 },
    styleUp: { ext: 0xdfe3d6, extPat: PAT.PLASTER, int: 0xe6dcc4, intPat: PAT.PLASTER, timber: 0x3e2c1e, trim: 0x3e2c1e },
    open: {
      E: [[0, dr(1.0, 1.25, { color: 0x2f4a5a })], [0, wn(-2.6, { w: 1.8, h: 1.4, b: 0.8, shutters: 0x6a3a2a, flowers: true })], [1, wn(-2.4, { w: 0.9 })], [1, wn(2.0, { w: 0.9, flowers: true })]],
      S: [[0, wn(-3.6, { w: 0.9 })], [0, wn(3.6, { w: 0.9 })], [1, wn(-3.0, { w: 0.9 })], [1, wn(3.0, { w: 0.9 })]],
      N: [[0, wn(-1.5)], [1, wn(-2.6, { w: 0.9 })], [1, wn(2.4, { w: 0.9 })]],
      W: [[0, wn(0)], [1, wn(-1.5, { w: 0.9 })]],
    },
    stairs: [{ from: 0, x: 0, z: 3.6, ry: -PI / 2, w: 1.1, len: 4.2, open: 'L', hx: 0, hz: 3.6, hw: 4.2, hl: 1.4, rails: [[2.1, 2.88, -1.95, 2.88], [2.1, 2.88, 2.1, 4.2]] }],
    parts: [
      { f: 1, a: [-4.7, 1.2], b: [4.7, 1.2], ops: [{ d: 2.4, w: 0.95 }, { d: 6.9, w: 0.95 }] },
      { f: 1, a: [0.5, 1.12], b: [0.5, -4.2] },
    ],
    roof: { type: 'hip', pitch: 33, oh: 0.55, c: 0x5b6272, pat: PAT.SLATE },
    chimneys: [{ x: -3.5, z: -3.4, from: 5.4, top: 8.8, w: 0.8, d: 0.8, c: 0x9a8a78 }],
    onWall: (b, k, f) => {
      if (k === 'E' && f === 0) {
        wallLantern(-0.35, 2.0, 0.15, 0, { int: 5 });
        box(-2.6, 2.75, 0.32, 2.4, 0.06, 0.5, 0x7a3a2a, PAT.STRIPE, { rx: -0.35 });
        box(1.0, 2.65, 0.2, 1.8, 0.4, 0.06, WOOD.dark, PAT.PLANK);
        box(1.0, 2.7, 0.24, 1.6, 0.3, 0.02, 0xd8c48a, PAT.NOISE);
      }
    },
    furnish: (b, f) => {
      if (f === 0) {
        counter(2.3, -1.4, PI / 2, 3.0, { c: WOOD.mid });
        box(2.3, 1.05, -2.3, 0.4, 0.03, 0.3, MET.brass, PAT.METAL); cyl(2.3, 1.08, -2.3, 0.02, 0.02, 0.3, 5, MET.brass);
        candle(2.25, 1.05, -0.4, { light: true, int: 1.8 }); box(2.3, 1.05, -1.2, 0.36, 0.06, 0.26, 0x5a2a1a, PAT.NOISE);
        shelfUnit(-3.0, -3.95, 0, 2.6); shelfUnit(0.2, -3.95, 0, 2.4);
        shelfUnit(-4.45, -0.6, PI / 2, 2.2);
        table(-1.4, 0.4, 0, 1.6, 0.9);
        for (let i = 0; i < 5; i++) potion(-2.0 + i * 0.3, 0.79, 0.2 + (i % 2) * 0.25, pick([0xd83a5a, 0x3a8ad8, 0x5ad86a, 0xd8b03a, 0x9a4ad8]));
        lanternHang(-0.9, 0.78, 0.55, { int: 2, range: 4, night: 0, chain: 0.02 });
        barrel(4.0, 3.25, { top: 'apples' }); barrel(4.15, 2.45, { top: 'apples', h: 0.8 });
        crate(4.1, -3.65, 0.2, 0.6, { fill: 'cabbage' }); sack(3.4, -3.8); sack(3.6, -3.1, 1.2);
        sack(-3.8, 3.55); sack(-4.25, 2.95, 1.0, 0xb8a47a); crate(-3.1, 3.65, 0.1, 0.55);
        hangingHerbs(-1.4, 3.05, -1.2, 6); hangingHerbs(1.0, 3.05, 1.6, 4);
        lanternHang(0.0, 2.55, -1.0, { night: 0, int: 4, range: 7, chain: 0.4 });
        rug(3.6, 1.0, 0, 1.4, 1.0, 0x5a3a2a);
      } else {
        wallLantern(-0.6, 1.75, 1.28, 0, { night: 0, int: 3, range: 6 });
        bed(-3.0, -3.15, 0, { blanket: 0x5a3a7a });
        nightstand(-1.75, -3.95, 0, { light: true });
        wardrobe(-0.45, -3.9, 0, { w: 1.0 });
        chest(-3.0, -1.35, 0, WOOD.mid);
        rug(-2.1, -1.0, 0, 2.2, 1.5, 0x2e5a5a);
        table(2.7, -1.7, 0, 1.2, 0.8); chair(2.7, -2.4, 0); chair(2.7, -1.0, PI);
        candle(2.9, 0.78, -1.7, { light: true }); plate(2.5, 0.78, -1.7, 'apple');
        bookshelf(4.42, -2.6, -PI / 2, { w: 1.2, h: 1.9 });
        armchair(1.3, -3.4, PI / 4, 0x4a6a3a);
        rug(2.6, -2.0, 0, 2.4, 1.8, 0x6a3a2a);
        painting(-3.0, 1.3, -4.15, 0, 0.8, 0.5, 0);
      }
    },
    exterior: (b) => {
      barrel(6.2, -4.6); crate(6.1, -3.7, 0.2, 0.6); crate(6.2, -3.7, 0.5, 0.45, { y: 0.6, nocol: true });
      bench(5.8, 3.4, -PI / 2, 1.6);
      sack(6.0, 2.2); hayBale(-6.6, 3.0, 1.2); pumpkin(-6.2, 0, 3.5, 0.2);
    },
  });

  // ======================= HILDA'S FORGE (smithy, open workshop) ===========
  V.smithy = buildRect({
    id: 'smithy', name: "Hilda's Forge", sub: 'Smithy', x: 22, z: -6, rot: 0, w: 12, d: 9, t: 0.35, openAir: true,
    levels: [0.15], wallTop: 3.9, floorNames: ['Workshop'], mapColor: 0x535a66,
    style: { ext: 0x9a9184, extPat: PAT.STONE, int: 0x8c8478, intPat: PAT.STONE, trim: WOOD.dark, sill: 0x6a6258 },
    floorC: 0x6a6258, floorPat: PAT.COBBLE,
    open: {
      S: [[0, dr(-3.0, 1.2, { color: 0x4a2a1a })], [0, wn(-5.0, { w: 0.8 })], [0, { type: 'open', x: 3.1, w: 5.8, b: 0, h: 3.0 }]],
      E: [[0, { type: 'open', x: 0, w: 8.3, b: 0, h: 3.0 }]],
      W: [[0, wn(0.5, { w: 0.9 })]],
      N: [[0, wn(-3.0, { w: 0.9 })]],
    },
    parts: [{ f: 0, a: [0, -4.15], b: [0, 4.15], ops: [{ d: 6.0, w: 1.1 }], c: 0x8c8478, pat: PAT.STONE }],
    roof: { type: 'gable', axis: 'x', pitch: 30, oh: 0.5, c: 0x535a66, pat: PAT.SLATE, gableColor: 0x9a9184, gablePat: PAT.STONE },
    chimneys: [{ x: 3.4, z: -3.5, from: 2.6, top: 7.6, w: 1.1, d: 1.0, c: 0x7a7268 }],
    onWall: (b, k, f) => {
      if (k === 'S') {
        for (const px of [3.1, 5.82]) { box(px, 0, 0, 0.32, 3.15, 0.32, WOOD.dark, PAT.BARK); colBox(px, 0, 0.32, 0.32, 0, 3.2); }
        box(3.1, 3.0, 0.2, 5.8, 0.22, 0.12, WOOD.dark, PAT.PLANK);
        wallLantern(-3.0, 2.45, 0.17, 0, { int: 5 });
        B.push(1.2, 2.2, 0.2, 0); box(0, 0, 0.06, 0.06, 0.06, 0.6, MET.iron); box(0, -0.75, 0.42, 0.7, 0.55, 0.06, WOOD.dark, PAT.PLANK);
        box(0, -0.6, 0.46, 0.4, 0.12, 0.03, MET.iron, PAT.METAL); box(0, -0.5, 0.46, 0.14, 0.1, 0.03, MET.iron, PAT.METAL); B.pop();
      }
      if (k === 'E') { box(0, 0, 0, 0.32, 3.15, 0.32, WOOD.dark, PAT.BARK); colBox(0, 0, 0.32, 0.32, 0, 3.2); box(0, 3.0, 0.2, 8.6, 0.22, 0.12, WOOD.dark, PAT.PLANK); }
    },
    furnish: (b, f) => {
      // forge
      B.push(3.4, 0, -3.45, 0);
      box(0, 0, 0, 2.4, 0.95, 1.1, 0x7a7268, PAT.STONE, { ao: 0.2 });
      box(0, 0.95, 0.05, 1.7, 0.06, 0.8, 0xff6a1a, 0, { em: 2.6, occ: 0 });
      for (let i = 0; i < 14; i++) sph(rnd(-0.75, 0.75), 1.0, rnd(-0.3, 0.35), rnd(0.06, 0.1), pick([0x2a2420, 0xff8a2a, 0x3a3028]), 0, { det: 0, em: R() < 0.4 ? 2.5 : 0 });
      cyl(0, 1.75, -0.05, 0.42, 1.3, 0.9, 4, 0x6a625a, PAT.STONE, { r0: PI / 4, sz: 0.65 });
      box(0, 2.65, -0.1, 0.9, 1.3, 0.8, 0x6a625a, PAT.STONE);
      colBox(0, 0, 2.5, 1.2, 0, 2);
      B.pop();
      { const p = B.wp(3.4, 1.0, -3.4); kfire('forge', 'forge', p.x, p.y, p.z, { s: 1.0, lit: true, b, f: 0, int: 14, range: 9, label: "Hilda's forge" }); }
      // bellows
      B.push(1.75, 0.55, -3.6, 0); box(0, 0, 0, 0.7, 0.18, 0.5, 0x5a3a24, PAT.NOISE, { rz: 0.15 }); box(0.45, 0.05, 0, 0.3, 0.05, 0.1, MET.iron); B.pop();
      box(1.75, 0, -3.6, 0.1, 0.55, 0.1, WOOD.dark);
      anvil(3.2, -0.9, 0);
      B.push(5.0, 0, -1.6, PI / 2); box(0, 0, 0, 1.4, 0.6, 0.6, WOOD.dark, PAT.PLANK); box(0, 0.6, 0, 1.25, 0.02, 0.45, 0x2a4a5a, 0, { occ: 0 }); colBox(0, 0, 1.4, 0.6, 0, 0.7); B.pop();
      grindstone(1.4, 2.6, 0);
      for (let i = 0; i < 18; i++) sph(5.0 + rnd(-0.5, 0.5), rnd(0, 0.35), -3.5 + rnd(-0.4, 0.4), rnd(0.1, 0.18), 0x24201c, 0, { det: 0 });
      // tool wall
      box(1.4, 1.2, -4.1, 1.2, 0.9, 0.05, WOOD.mid, PAT.PLANK);
      for (let i = 0; i < 4; i++) { box(1.0 + i * 0.27, 1.35, -4.04, 0.04, 0.55, 0.04, WOOD.dark); box(1.0 + i * 0.27, 1.85, -4.04, 0.16, 0.08, 0.08, MET.iron, PAT.METAL); }
      for (let i = 0; i < 5; i++) torus(4.6 + (i % 3) * 0.3, 1.5 + Math.floor(i / 3) * 0.3, -4.12, 0.1, 0.02, 4, 10, MET.iron, PAT.METAL, { arc: PI * 1.4 });
      barrel(5.2, 1.4);
      for (let i = 0; i < 3; i++) box(5.1 + i * 0.1 - 0.1, 0.8, 1.4 + (i - 1) * 0.08, 0.04, 0.8, 0.02, MET.steel, PAT.METAL, { rz: (i - 1) * 0.15 });
      // shop half
      weaponRack(-5.4, -0.6, PI / 2);
      armorStand(-1.0, -3.4, -PI / 4); armorStand(-4.5, -3.4, PI / 4);
      counter(-2.8, -1.2, 0, 2.2, { c: WOOD.mid });
      table(-2.9, 1.9, 0, 1.4, 0.8);
      for (let i = 0; i < 3; i++) box(-3.3 + i * 0.4, 0.79, 1.85, 0.06, 0.02, 0.45, MET.steel, PAT.METAL, { ry: 0.2 });
      ball(-2.5, 0.92, 2.0, 0.14, MET.steel, PAT.METAL, { sy: 0.9 });
      for (let i = 0; i < 3; i++) { B.push(-4.6 + i * 1.3, 1.7, -4.1, 0); cyl(0, 0, 0, 0.36, 0.36, 0.06, 10, pick([0x7a2a2a, 0x2a4a7a, 0x4a6a2a]), PAT.NOISE, { rx: PI / 2 }); sph(0, 0, 0.07, 0.1, MET.gold, PAT.METAL, { det: 0, sz: 0.4 }); B.pop(); }
      barrel(-0.6, 3.6);
      candle(-2.2, 1.05, -1.2, { light: true, int: 1.6 });
      lanternHang(-2.9, 2.7, 0.5, { night: 0, int: 4, range: 7, chain: 0.5 });
    },
    exterior: (b) => {
      woodpile(7.6, -2.5, PI / 2);
      B.push(7.4, gy(7.4, 2.6), 2.6, 0); box(0, 0, 0, 1.8, 0.55, 0.7, WOOD.dark, PAT.PLANK); box(0, 0.55, 0, 1.6, 0.02, 0.5, 0x2a4a5a, 0); colBox(0, 0, 1.8, 0.7, 0, 0.6); B.pop();
      barrel(-6.6, 5.0); crate(-5.8, 5.2, 0.3, 0.55);
    },
  });

  // ======================= CHAPEL OF THE HARVEST MOON ======================
  V.chapel = buildRect({
    id: 'chapel', name: 'Chapel of the Harvest Moon', sub: 'Chapel', x: 26, z: -33, rot: 0, w: 9, d: 15, t: 0.4,
    levels: [0.3], wallTop: 6.2, floorNames: ['Nave'], mapColor: 0x56606e,
    style: { ext: 0xd4c5a5, extPat: PAT.STONE, int: 0xe4d8be, intPat: PAT.PLASTER, trim: 0x5a4632, sill: 0xb8aa8a },
    floorC: 0xa89c86, floorPat: PAT.STONE,
    open: {
      S: [[0, dr(0, 1.7, { h: 3.0, color: 0x5a2a1a, openAng: 1.6 })], [0, wn(-2.75, { w: 0.7, h: 1.8, b: 1.8, glass: 'stained' })], [0, wn(2.75, { w: 0.7, h: 1.8, b: 1.8, glass: 'stained' })]],
      E: [-4.5, -0.5, 3.5].map(z => [0, wn(z, { w: 1.0, h: 2.9, b: 1.6, glass: 'stained' })]),
      W: [-4.5, -0.5, 3.5].map(z => [0, wn(z, { w: 1.0, h: 2.9, b: 1.6, glass: 'stained' })]),
      N: [[0, wn(0, { w: 1.6, h: 2.2, b: 2.8, glass: 'stained' })]],
    },
    roof: { type: 'gable', axis: 'z', pitch: 52, oh: 0.45, c: 0x56606e, pat: PAT.SLATE, gableColor: 0xd4c5a5, gablePat: PAT.STONE },
    roofExtra: (b) => {
      const ridge = 6.2 + 4.5 * Math.tan(52 * DEG);
      B.push(0, ridge - 0.6, 5.6, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * 0.6, 0, sz * 0.6, 0.16, 1.9, 0.16, 0xd4c5a5, PAT.STONE);
      box(0, 0, 0, 1.5, 0.5, 1.5, 0xd4c5a5, PAT.STONE);
      box(0, 1.9, 0, 1.6, 0.16, 1.6, 0xc4b595, PAT.STONE);
      cyl(0, 2.06, 0, 0, 1.15, 1.6, 4, 0x56606e, PAT.SLATE, { r0: PI / 4, uv: 3 });
      cyl(0, 3.6, 0, 0.03, 0.03, 0.5, 4, MET.gold); box(0, 3.9, 0, 0.3, 0.05, 0.05, MET.gold);
      lathe(0, 0.75, 0, [[0.001, 1.0], [0.12, 0.98], [0.2, 0.7], [0.32, 0.2], [0.38, 0.0]], 12, MET.brass, PAT.METAL, { smooth: true });
      B.pop();
      B.push(0, 6.2 + 2.1, 7.52, 0);
      cyl(0, 0, 0, 0.95, 0.95, 0.08, 18, 0x5a4632, PAT.STONE, { rx: PI / 2 });
      cyl(0, 0, 0.02, 0.8, 0.8, 0.08, 18, 0xffffff, PAT.STAINED, { rx: PI / 2, uv: 2, em: -1.6 });
      B.pop();
    },
    onWall: (b, k) => {
      if (k === 'S') { wallLantern(-1.4, 2.6, 0.2, 0, { int: 5 }); wallLantern(1.4, 2.6, 0.2, 0, { int: 5 }); }
    },
    furnish: (b, f) => {
      box(0, 0, -6.1, 8.2, 0.3, 2.0, 0xc8bca4, PAT.STONE);
      walkRect(0, -6.1, 8.2, 2.0, 0.3);
      box(0, 0.3, -6.45, 2.1, 0.95, 0.85, 0xeae2d0, PAT.STONE);
      box(0, 1.25, -6.45, 2.3, 0.05, 0.95, 0xeae2d0, PAT.STONE);
      box(0, 0.6, -6.0, 0.7, 0.66, 0.02, 0x8a2a2a, PAT.NOISE);
      box(0, 1.3, -6.45, 0.5, 0.02, 1.0, 0xc9a043, PAT.NOISE);
      colBox(0, -6.45, 2.3, 0.95, 0.3, 1.5);
      for (const s of [-0.7, 0.7]) candle(s, 1.3, -6.5, { h: 0.3 });
      { const p = B.wp(0, 1.33, -6.4); kfire('chapel', 'candle', p.x, p.y, p.z, { s: 0.7, lit: true, b, f: 0, int: 3, range: 6, label: 'the altar candles' }); }
      B.push(0, 3.5, -7.08, 0);
      cyl(0, 0, 0, 0.55, 0.55, 0.06, 16, MET.gold, PAT.METAL, { rx: PI / 2 });
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12; box(Math.cos(a) * 0.8, Math.sin(a) * 0.8 - 0.12, 0.03, 0.08, 0.32, 0.04, MET.gold, PAT.METAL, { rz: a - PI / 2 }); }
      B.pop();
      for (const s of [-1, 1]) {
        B.push(s * 1.9, 0.3, -5.7, 0);
        cyl(0, 0, 0, 0.18, 0.22, 0.08, 8, MET.brass, PAT.METAL); cyl(0, 0.08, 0, 0.03, 0.04, 1.3, 6, MET.brass, PAT.METAL);
        box(0, 1.38, 0, 0.6, 0.03, 0.04, MET.brass, PAT.METAL);
        for (const k of [-0.28, 0, 0.28]) candle(k, 1.4, 0, { holder: false, h: 0.22 });
        B.pop();
        light(s * 1.9, 2.0, -5.6, { color: 0xffba66, int: 3.2, range: 6, glow: 0.6 });
      }
      for (let i = 0; i < 5; i++) { const z = -3.3 + i * 1.6; pew(-2.15, z, PI, 2.8); pew(2.15, z, PI, 2.8); }
      rug(0, 0.6, 0, 1.3, 12.4, 0x8a2a2a);
      lectern(1.6, -4.5, 0.2);
      for (const z of [-2.5, 1.5]) { banner(-4.08, 2.4, z, PI / 2, 0.8, 1.8, 0x2a3a6a); banner(4.08, 2.4, z, -PI / 2, 0.8, 1.8, 0x6a2a2a); }
      chandelier(0, 4.4, -2.0, 0.8, 8, { chain: 1.6, int: 6 }); chandelier(0, 4.4, 3.0, 0.8, 8, { chain: 1.6, int: 6 });
      // harvest offerings
      pumpkin(-1.6, 0.3, -5.3, 0.22); pumpkin(-1.15, 0.3, -5.25, 0.16, 0xe8a03a); pumpkin(1.4, 0.3, -5.3, 0.25, 0xc85a1a);
      for (const s of [-1, 1]) { B.push(s * 2.9, 0.3, -6.6, 0); cyl(0, 0, 0, 0.22, 0.18, 1.0, 9, 0xd8b65a, PAT.STRAW); cyl(0, 1.0, 0, 0.32, 0.22, 0.35, 9, 0xe0c060, PAT.STRAW); box(0, 0.5, 0, 0.47, 0.06, 0.47, 0x8a5a2a, 0); B.pop(); }
      B.push(-0.9, 0, 6.4, 0); lathe(0, 0, 0, [[0.001, 0], [0.22, 0], [0.28, 0.25], [0.001, 0.25]], 10, 0xa88a5a, PAT.STRAW); for (let i = 0; i < 6; i++) ball(rnd(-0.15, 0.15), 0.27, rnd(-0.15, 0.15), 0.06, 0xc0302a, 0); B.pop();
    },
    exterior: (b) => {
      bench(-3.2, 9.3, 0, 1.8); bench(3.2, 9.3, 0, 1.8);
      jackOLantern(-1.4, 8.3, 0.24, 0.2); jackOLantern(1.4, 8.3, 0.22, -0.3);
    },
  });

  // ======================= ORRIN'S TOWER (3 floors) ========================
  V.tower = buildOct({
    id: 'tower', name: "Orrin's Tower", sub: 'Wizard', x: -30, z: -31, R: 4.6, t: 0.38,
    levels: [0.3, 3.7, 7.1], wallTop: 10.4, floorNames: ['Alchemy lab', 'Library', 'Observatory'], mapColor: 0x4b4a78,
    style: { ext: 0x8e95a2, extPat: PAT.STONE, int: 0x8c877c, intPat: PAT.STONE, trim: 0x3a3040, sill: 0x6a6a74 },
    floorC: 0x77726a,
    open: (() => {
      const w = (o = {}) => wn(0, { w: 0.7, h: 1.4, b: 1.0, frame: 0x3a3040, ...o });
      const st = { glass: 'stained' };
      return {
        0: [[0, dr(0, 1.2, { h: 2.4, color: 0x3a2a4a })], [1, w()], [2, w(st)]],
        1: [[0, w()], [2, w(st)]],
        2: [[1, w()]],
        3: [[0, w()], [1, w()], [2, w(st)]],
        4: [[0, w()], [1, w()], [2, w(st)]],
        5: [[1, w()], [2, w(st)]],
        6: [[2, w(st)]],
        7: [[0, w()], [1, w()], [2, w(st)]],
      };
    })(),
    cellar: { hole: [-3.15, -2.25, -1.95, 2.25], rails: [[-1.92, -2.28, -1.92, 2.25], [-3.3, -2.28, -1.92, -2.28]] },
    stairs: [
      { from: 0, x: 2.15, z: 0, ry: 0, w: 1.1, len: 4.4, open: 'L', rails: [[1.45, -2.25, 1.45, 2.05], [1.45, -2.25, 2.95, -2.25]] },
      { from: 1, x: -2.15, z: 0, ry: PI, w: 1.1, len: 4.4, open: 'L', rails: [[-1.45, 2.25, -1.45, -2.05], [-1.45, 2.25, -2.95, 2.25]] },
    ],
    roof: { h: 7.6, oh: 0.6, c: 0x4b4a78, pat: PAT.SLATE },
    roofExtra: (b) => {
      const top = 10.4 + 0.2 + 7.6;
      cyl(0, top - 0.4, 0, 0.03, 0.08, 1.4, 6, MET.gold, PAT.METAL);
      sph(0, top + 1.05, 0, 0.26, 0xb69cff, 0, { det: 0, em: 2.2, sy: 1.5 });
      torus(0, top + 1.05, 0, 0.36, 0.025, 4, 16, MET.gold, PAT.METAL);
      SPARKLES.push({ p: B.wp(0, top + 1.05, 0), r: 0.6, c: col(0xc8b0ff), rate: 6 });
      light(0, top + 1.0, 0, { color: 0xa080ff, int: 6, range: 10, night: 1, glow: 1.6 });
    },
    furnish: (b, f) => {
      const wallPos = (k, inset = 0.25) => { const a = k * PI / 4, d = 4.6 * Math.cos(PI / 8) - 0.38 - inset; return [Math.sin(a) * d, Math.cos(a) * d, a + PI]; };
      if (f === 0) {
        cauldron(0.35, -0.45, { c: 0x5ae07a, kf: 'cauldron', label: 'the fire under the cauldron' });
        for (const k of [4, 5, 6]) { const [x, z, a] = wallPos(k, 0.15); wallShelf(x, 1.25, z, a, 1.6, 'bottles'); wallShelf(x, 1.8, z, a, 1.6, 'bottles'); }
        { const [x, z, a] = wallPos(4, 0.45); table(x, z, a, 1.5, 0.7, { c: WOOD.dark });
          B.push(x, 0, z, a); for (let i = 0; i < 4; i++) potion(-0.5 + i * 0.32, 0.79, 0, pick([0xd83a8a, 0x3ad8c8, 0xd8c83a, 0x8a3ad8])); B.pop(); }
        { const [x, z, a] = wallPos(1, 0.5);
          B.push(x, 0, z, a);
          for (let i = 0; i < 7; i++) cyl(rnd(-0.35, 0.35), 0, rnd(-0.2, 0.2), 0, rnd(0.07, 0.13), rnd(0.4, 0.9), 5, 0xb07aff, 0, { em: 1.6, rx: rnd(-0.3, 0.3), rz: rnd(-0.3, 0.3), occ: 0 });
          sph(0, 0, 0, 0.35, 0x5a5a64, PAT.STONE, { det: 0, sy: 0.4 });
          B.pop();
          light(x, 0.8, z, { color: 0xa070ff, int: 4, range: 6, glow: 1.0, flick: 0.05 });
          SPARKLES.push({ p: B.wp(x, 0.6, z), r: 0.5, c: col(0xc8a0ff), rate: 3, b, f: 0 }); }
        barrel(-1.25, -3.0, { h: 0.8, r: 0.28 }); crate(1.0, 3.0, 0.5, 0.5); sack(1.25, 2.3, 0.4);
        rug(0.35, -0.45, 0, 2.6, 2.6, 0x3a2a5a);
        hangingHerbs(0.4, 3.4, 1.2, 5);
        lanternHang(0.6, 2.9, 1.4, { night: 0, int: 3, range: 6, chain: 0.4 });
      } else if (f === 1) {
        for (const k of [0, 3, 4, 5]) { const [x, z, a] = wallPos(k, 0.2); bookshelf(x, z, a, { w: 1.9, h: 2.4, n: 6 }); }
        { const [x, z, a] = wallPos(6, 0.2); bookshelf(x, z, a, { w: 1.5, h: 2.0, n: 5 }); }
        table(0.0, -1.2, 0, 1.4, 0.8, { c: WOOD.dark }); chair(0.0, -0.55, PI, { cushion: 0x5a2a6a });
        box(-0.1, 0.79, -1.25, 0.6, 0.04, 0.42, 0xefe4c8, PAT.NOISE, { ry: 0.1 }); box(-0.1, 0.82, -1.25, 0.03, 0.03, 0.42, 0x6a3a2a, 0, { ry: 0.1 });
        candle(0.5, 0.79, -1.4, { light: true, int: 2 }); bottle(-0.55, 0.79, -1.4, 0x2a2a5a, 0.8);
        globe(0.95, 1.2); armchair(-0.6, 1.4, PI * 0.85, 0x5a2a6a);
        rug(0, -0.1, 0, 2.6, 2.2, 0x2a3a5a);
        lanternHang(0, 2.9, 0.2, { night: 0, int: 4, range: 7, chain: 0.4 });
        SPARKLES.push({ p: B.wp(0, 1.6, -1.2), r: 0.8, c: col(0xffe8a0), rate: 1.5, b, f: 1 });
      } else {
        telescope(1.85, -1.9, -PI / 4);
        rug(0, 0.1, 0, 3.0, 3.0, 0x1e2a5a);
        // orrery: brass rings & planets on a slowly turning arm (animated mesh)
        B.push(0, 0, 0.5, 0); cyl(0, 0, 0, 0.28, 0.34, 0.08, 10, WOOD.dark); cyl(0, 0.08, 0, 0.05, 0.05, 1.0, 6, MET.brass, PAT.METAL); colCirc(0, 0, 0.5, 0, 1.6); B.pop();
        const g = b.furnGroup(2), ob = new Batch(), base = B.m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 1.12, 0.5));
        withLocal(() => {
          B.to(ob);
          ball(0, 0, 0, 0.13, 0xffc04a, 0, { em: 1.8 });
          for (let i = 0; i < 4; i++) { const r = 0.3 + i * 0.16, a = i * 1.9; box(Math.cos(a) * r / 2, -0.01, Math.sin(a) * r / 2, r, 0.015, 0.015, MET.brass, PAT.METAL, { ry: -a }); ball(Math.cos(a) * r, 0, Math.sin(a) * r, 0.04 + i * 0.012, [0x8ab0d8, 0xd87a4a, 0x6ad89a, 0xd8c8a0][i], 0); }
          torus(0, 0, 0, 0.62, 0.012, 4, 24, MET.brass, PAT.METAL, { rx: PI / 2 + 0.3 });
        });
        const om = new THREE.Mesh(ob.toGeometry(), g.mat); om.matrixAutoUpdate = false; om.castShadow = true; g.extra.push(om);
        const rotM = new THREE.Matrix4();
        ANIMS.push((dt, t) => { rotM.makeRotationY(t * 0.25); om.matrix.multiplyMatrices(base, rotM); });
        B.push(-1.2, 0, 1.9, 0); cyl(0, 0, 0, 0.2, 0.25, 0.9, 6, WOOD.dark, PAT.PLANK); ball(0, 1.05, 0, 0.2, 0xc6a8ff, 0, { em: 1.2 }); torus(0, 0.92, 0, 0.16, 0.03, 4, 10, MET.brass, PAT.METAL, { rx: PI / 2 }); colCirc(0, 0, 0.3, 0, 1.3); B.pop();
        light(-1.2, 1.4, 1.9, { color: 0xb090ff, int: 3.5, range: 6, glow: 0.8, flick: 0.04 });
        SPARKLES.push({ p: B.wp(-1.2, 1.05, 1.9), r: 0.3, c: col(0xd8c0ff), rate: 2, b, f: 2 });
        { const [x, z, a] = wallPos(4, 0.45); table(x, z, a, 1.4, 0.7, { c: WOOD.dark }); B.push(x, 0, z, a); box(0, 0.79, 0, 0.9, 0.01, 0.5, 0xe8dcb8, PAT.NOISE); candle(0.5, 0.79, 0.1, { light: true }); B.pop(); }
        for (const k of [1, 6]) { const [x, z, a] = wallPos(k, 0.2); bookshelf(x, z, a, { w: 1.4, h: 1.6, n: 4 }); }
        chair(0.2, -0.2, -PI / 3, { cushion: 0x2a3a6a });
      }
    },
    exterior: (b) => {
      for (let i = 0; i < 9; i++) { const a = i * TAU / 9, r = 7.2, sx = Math.sin(a) * r, sz = 1.5 + Math.cos(a) * r * 0.8; B.push(sx, gy(sx, sz), sz, 0);
        if (i !== 0) { box(0, 0, 0, 0.5, 1.0 + (i % 3) * 0.3, 0.4, 0x7a7f88, PAT.STONE, { ry: a }); box(0, 0.5, 0.21, 0.2, 0.3, 0.01, 0x8ab0ff, 0, { em: -2.2, occ: 0, ry: a }); colBox(0, 0, 0.5, 0.4, 0, 1.2, a); }
        B.pop(); }
      for (let i = 0; i < 12; i++) { const a = rnd(0, TAU), r = rnd(5.5, 6.8), mx = Math.sin(a) * r, mz = Math.cos(a) * r; B.push(mx, gy(mx, mz), mz, 0);
        cyl(0, 0, 0, 0.03, 0.04, 0.2, 5, 0xe8e0d0); cyl(0, 0.18, 0, 0.0, 0.14, 0.1, 7, 0x7ad8ff, 0, { em: -2.5, occ: 0, sy: -1 }); sph(0, 0.2, 0, 0.12, 0x7ad8ff, 0, { det: 0, sy: 0.5, em: -2.5, occ: 0 }); B.pop(); }
      light(0, 0.6 + gy(0, 6.2), 6.2, { color: 0x7ad8ff, int: 2.5, range: 6, night: 1, glow: 0.4, b: null });
    },
  });

  // ======================= THE WARM LOAF (bakery) =========================
  V.bakery = buildRect({
    id: 'bakery', name: 'The Warm Loaf', sub: 'Bakery', x: 16, z: 19.5, rot: 180, w: 9, d: 7,
    levels: [0.2], wallTop: 3.6, floorNames: ['Bakehouse'], mapColor: 0xa2462f,
    style: { ext: 0xead6b6, extPat: PAT.PLASTER, int: 0xe6d5b8, intPat: PAT.PLASTER, timber: 0x5a3a24, plinth: { h: 0.9, c: 0x9c4a34, pat: PAT.BRICK }, trim: 0x5a3a24 },
    floorC: 0xa8896a, floorPat: PAT.BRICK,
    open: {
      S: [[0, dr(1.2, 1.2, { color: 0x3a5a3a })], [0, wn(-2.4, { w: 1.8, h: 1.3, b: 0.85, shutters: 0x3a5a3a, flowers: true })], [0, wn(3.3, { w: 0.8, shutters: 0x3a5a3a })]],
      N: [[0, wn(1.0)]], E: [[0, wn(0, { w: 0.9 })]], W: [[0, wn(1.5, { w: 0.8 })]],
    },
    roof: { type: 'gable', axis: 'x', pitch: 36, oh: 0.55, c: 0xa2462f, pat: PAT.TILE, timber: 0x5a3a24 },
    chimneys: [{ x: -3.0, z: -2.4, from: 2.4, top: 7.0, w: 0.9, d: 0.9, c: 0x9c4a34, pat: PAT.BRICK }],
    onWall: (b, k) => {
      if (k === 'S') {
        wallLantern(0.3, 2.1, 0.15, 0, { int: 5 });
        B.push(2.5, 2.7, 0.15, 0); box(0, 0, 0.3, 0.06, 0.06, 0.6, MET.iron); box(0, -0.55, 0.55, 0.06, 0.5, 0.8, WOOD.dark, PAT.PLANK); ball(0, -0.3, 0.55, 0.14, 0xc68a44, PAT.NOISE, { sz: 2.2, sx: 0.8, sy: 0.9 }); B.pop();
      }
    },
    furnish: (b, f) => {
      B.push(-3.0, 0, -2.3, 0);
      box(0, 0, 0, 2.0, 0.9, 1.6, 0x9c4a34, PAT.BRICK);
      ball(0, 0.9, -0.05, 0.85, 0x9c4a34, PAT.BRICK, { sy: 0.75, ws: 12, hs: 8 });
      box(0, 0.9, 0.62, 0.7, 0.55, 0.3, 0x1d1510, 0);
      fire(0, 0.9, 0.35, 0.6, { int: 7, range: 7, kf: 'oven', lit: false, label: "Mira's oven" });
      box(0, 1.5, -0.3, 0.6, 1.6, 0.6, 0x9c4a34, PAT.BRICK);
      colBox(0, 0, 2.0, 1.7, 0, 2);
      B.pop();
      table(0.6, -1.9, 0, 2.3, 0.95, { c: WOOD.light });
      box(0.6, 0.79, -1.9, 1.4, 0.005, 0.7, 0xf4efe6, 0);
      for (let i = 0; i < 5; i++) ball(0.0 + i * 0.3, 0.84, -1.8 + (i % 2) * 0.2, 0.08, 0xf0e2c4, PAT.NOISE, { sy: 0.7 });
      cyl(1.4, 0.84, -2.1, 0.035, 0.035, 0.5, 6, WOOD.pale, 0, { rz: PI / 2 });
      counter(-2.2, 1.6, 0, 2.6, { c: WOOD.mid });
      for (let i = 0; i < 5; i++) loaf(-3.2 + i * 0.5, 1.05, 1.55);
      plate(-1.4, 1.05, 1.7, 'pie'); plate(-2.9, 1.05, 1.75, 'pie');
      shelfUnit(-4.0, -0.2, PI / 2, 2.0, 1.9, 'bread');
      sack(3.6, -2.6, 0.2, 0xe8e0c8); sack(3.0, -2.8, 1.0, 0xe8e0c8); sack(3.7, -1.9, 2.0, 0xd8d0b8);
      barrel(3.7, 2.5, { h: 0.8 }); crate(3.6, 1.6, 0.2, 0.5);
      lanternHang(0.5, 2.6, 0.4, { night: 0, int: 4, range: 7, chain: 0.4 });
      candle(-1.2, 1.05, 1.5, { light: true, int: 1.4 });
    },
    exterior: (b) => {
      bench(-1.6, 4.4, 0, 1.6);
      B.push(-1.0, 0.48 + gy(-1.0, 4.4), 4.4, 0); lathe(0, 0, 0, [[0.001, 0], [0.18, 0], [0.24, 0.18], [0.001, 0.18]], 9, 0xa8844e, PAT.STRAW); for (let i = 0; i < 3; i++) loaf(rnd(-0.1, 0.1), 0.15, rnd(-0.1, 0.1), 0.7); B.pop();
      plantPot(2.0, 4.0); jackOLantern(-3.5, 4.1, 0.25, 0.3);
    },
  });

  // ======================= WEAVER'S COTTAGE (thatch) ======================
  V.weaver = buildRect({
    id: 'weaver', name: "Weaver's Cottage", sub: 'Home of Old Bess', x: -20, z: 20, rot: 180, w: 8, d: 6.5,
    levels: [0.2], wallTop: 3.0, floorNames: ['Cottage'], mapColor: 0xc4a052,
    style: { ext: 0xebe1ca, extPat: PAT.PLASTER, int: 0xe2d6bc, intPat: PAT.PLASTER, timber: 0x5a3d26, plinth: { h: 0.55, c: 0x8b857a }, trim: 0x5a3d26 },
    open: {
      S: [[0, dr(-1.0, 1.1, { color: 0x6a3a5a })], [0, wn(1.8, { shutters: 0x6a3a5a, flowers: true })], [0, wn(-3.0, { w: 0.8, shutters: 0x6a3a5a })]],
      N: [[0, wn(0.8)]], E: [[0, wn(0, { w: 0.9 })]],
    },
    roof: { type: 'thatch', axis: 'x', pitch: 47, oh: 0.75, c: 0xc4a052, pat: PAT.THATCH, timber: 0x5a3d26 },
    chimneys: [{ x: -3.55, z: 0.3, from: 2.5, top: 6.9, w: 0.8, d: 1.0 }],
    furnish: (b, f) => {
      fireplace(-3.25, 0.3, PI / 2, { w: 1.8, d: 0.8, ch: 2.9, int: 8, pot: true, kf: 'hearth_bess', label: "Bess's hearth" });
      rug(-1.6, 0.5, PI / 2, 2.0, 1.5, 0x6a3a5a);
      armchair(-1.75, 0.95, -PI / 2 + 0.35, 0x6a5a3a);
      bed(-1.0, -2.0, PI / 2, { len: 1.9, blanket: 0x8a4a6a });
      table(1.1, 0.7, 0, 1.1, 0.75); chair(1.1, 1.3, PI); chair(1.75, 0.7, -PI / 2);
      candle(1.2, 0.78, 0.6, { light: true }); mug(0.85, 0.78, 0.8);
      dresser(3.4, -1.2, -PI / 2);
      for (let i = 0; i < 3; i++) plate(3.4, 0.89, -1.6 + i * 0.4);
      // loom
      B.push(2.0, 0, -2.4, 0);
      for (const s of [-1, 1]) { box(s * 0.7, 0, 0, 0.08, 1.7, 0.08, WOOD.mid); box(s * 0.7, 0, 0.6, 0.08, 1.0, 0.08, WOOD.mid); box(s * 0.7, 0.95, 0.3, 0.06, 0.06, 0.7, WOOD.mid); }
      box(0, 1.6, 0, 1.5, 0.08, 0.08, WOOD.mid); box(0, 0.85, 0.6, 1.5, 0.08, 0.08, WOOD.mid);
      box(0, 0.9, 0.3, 1.2, 0.02, 0.62, 0x8a3a5a, PAT.RUG, { uv: 2, rx: -0.85 });
      colBox(0, 0.3, 1.6, 0.8, 0, 1.7);
      B.pop();
      // spinning wheel
      B.push(2.6, 0, 1.7, 0.6);
      box(0, 0.3, 0, 0.7, 0.06, 0.25, WOOD.mid);
      for (const s of [-1, 1]) box(s * 0.3, 0, 0, 0.05, 0.32, 0.05, WOOD.mid);
      torus(0.1, 0.75, 0, 0.32, 0.025, 4, 16, WOOD.mid, 0, {});
      box(0.1, 0.3, 0, 0.04, 0.45, 0.04, WOOD.mid);
      colCirc(0, 0, 0.4, 0, 1.1);
      B.pop();
      for (let i = 0; i < 4; i++) ball(3.3, 0.06 + i * 0.0, 2.4 - i * 0.22, 0.09, pick([0xc84a3a, 0x3a6ac8, 0xe8c84a, 0x6a3a8a]), PAT.NOISE);
      hangingHerbs(0.4, 2.95, -0.3, 4);
    },
    exterior: (b) => {
      fence([[-5.0, -4.6], [-5.0, -9.0], [5.0, -9.0], [5.0, -4.6], [2.0, -4.6]], { c: 0x9a7a52 });
      for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) sph(-4.0 + i * 1.3, 0.2 + gy(-4.0 + i * 1.3, -6.0 - r * 1.0), -6.0 - r * 1.0, 0.24, vary(0x6a9a4a, 0.1), PAT.LEAF, { det: 1, jit: 0.2, sy: 0.7 });
      bench(-2.6, 4.0, 0, 1.4);
    },
  });

  // ======================= FISHER'S COTTAGE ==============================
  V.fisher = buildRect({
    id: 'fisher', name: "Fisher's Cottage", sub: 'Home of Ned & his nets', x: 34, z: 25, rot: -90, w: 7, d: 6,
    levels: [0.2], wallTop: 2.9, floorNames: ['Cottage'], mapColor: 0xb39150,
    style: { ext: 0xd8d0bc, extPat: PAT.PLASTER, int: 0xb89a74, intPat: PAT.PLANK, timber: 0x4a3626, plinth: { h: 0.5, c: 0x8b857a }, trim: 0x4a3626 },
    open: {
      S: [[0, dr(0.8, 1.1, { color: 0x2a4a6a })], [0, wn(-1.8, { shutters: 0x2a4a6a })]],
      N: [[0, wn(0)]], E: [[0, wn(0, { w: 0.8 })]], W: [[0, wn(0.6, { w: 0.8 })]],
    },
    roof: { type: 'thatch', axis: 'x', pitch: 45, oh: 0.7, c: 0xb39150, pat: PAT.THATCH },
    chimneys: [{ x: 2.9, z: -0.8, from: 2.4, top: 6.3, w: 0.7, d: 0.8 }],
    furnish: (b, f) => {
      B.push(2.75, 0, -0.8, -PI / 2); box(0, 0, 0, 0.8, 0.8, 0.8, MET.iron, PAT.METAL); box(0, 0.25, 0.41, 0.4, 0.3, 0.02, 0xff7a2a, 0, { em: 2.2 }); box(0, 0.8, 0, 0.25, 2.1, 0.25, MET.iron, PAT.METAL); colBox(0, 0, 0.8, 0.8, 0, 1); B.pop();
      light(2.4, 0.6, -0.8, { color: 0xff8a3a, int: 5, range: 6, flick: 0.3, glow: 0.5 });
      bed(-2.3, -1.9, PI / 2, { len: 1.9, blanket: 0x2a4a6a });
      table(-0.4, 0.9, 0, 1.0, 0.7); chair(-0.4, 1.5, PI); candle(-0.3, 0.78, 0.8, { light: true });
      plate(-0.6, 0.78, 0.9, 'bread');
      barrel(2.6, 2.2); barrel(2.0, 2.4, { h: 0.7, r: 0.26 });
      // drying rack with fish
      B.push(0.8, 0, -2.4, 0); for (const s of [-1, 1]) box(s * 0.7, 0, 0, 0.06, 1.7, 0.06, WOOD.mid); box(0, 1.6, 0, 1.5, 0.05, 0.05, WOOD.mid);
      for (let i = 0; i < 5; i++) ball(-0.5 + i * 0.25, 1.3, 0, 0.06, 0x8a9aa8, PAT.METAL, { sy: 3.2, sx: 0.6 }); B.pop();
      box(-3.1, 0.8, 1.2, 0.04, 1.6, 1.6, 0x6a5a3a, PAT.LEAD, { uv: 1 });
      cyl(-3.1, 0, -0.2, 0.03, 0.03, 2.0, 5, WOOD.light, 0, { rz: 0.1 });
    },
    exterior: (b) => {
      // little rowboat on the shore
      B.push(5.8, 0.05 + gy(5.8, -4.5), -4.5, 0.3);
      lathe(0, 0, 0, [[0.001, -1.4], [0.35, -1.0], [0.55, 0], [0.4, 1.0], [0.001, 1.5]], 10, 0x6a4a32, PAT.PLANK, { rx: PI / 2, sx: 1.0, sy: 1, sz: 0.45 });
      B.pop();
      barrel(-4.2, 3.6); crate(-4.0, 2.8, 0.4, 0.5);
    },
  });
}

// ---------------------------------------------------------------------------
function buildOutdoors() {
  B.reset(); B.to(OUT); B.occ = 1; B.ground = 0;
  // ---- plaza ----
  {
    const g = new THREE.CircleGeometry(PLAZA.r, 56); g.rotateX(-PI / 2);
    const b = new Batch(); B.to(b);
    emit(geoSrc('plaza', () => g, true), null, 0xa29a8a, PAT.COBBLE, { occ: 0 });
    torus(0, 0.02, 0, PLAZA.r, 0.14, 4, 56, 0x8a8478, PAT.STONE, { rx: PI / 2, occ: 0 });
    const m = new THREE.Mesh(b.toGeometry(), worldMat({ rough: 0.9 }));
    m.position.y = 0.035; m.receiveShadow = true; scene.add(m);
    B.to(OUT);
  }
  // fountain
  B.push(0, 0, 0, 0);
  cyl(0, 0, 0, 2.7, 2.8, 0.65, 8, 0x9a948a, PAT.STONE, { r0: PI / 8 });
  cyl(0, 0.65, 0, 2.85, 2.85, 0.12, 8, 0xb0aa9e, PAT.STONE, { r0: PI / 8 });
  cyl(0, 0, 0, 0.45, 0.6, 1.9, 8, 0xa8a296, PAT.STONE, { r0: PI / 8 });
  lathe(0, 1.8, 0, [[0.2, 0], [0.8, 0.2], [1.05, 0.42], [0.95, 0.45], [0.001, 0.3]], 12, 0xb0aa9e, PAT.STONE);
  cyl(0, 2.2, 0, 0.12, 0.2, 0.7, 8, 0xa8a296, PAT.STONE);
  sph(0, 2.95, 0, 0.18, MET.gold, PAT.METAL, { det: 1 });
  addCircW(0, 0, 2.9, -1, 2);
  B.pop();
  {
    const w1 = new THREE.Mesh(new THREE.CircleGeometry(2.55, 8).rotateX(-PI / 2).rotateY(PI / 8), makeWater(0.6));
    w1.position.set(0, 0.58, 0); w1.renderOrder = 1; scene.add(w1);
    const w2 = new THREE.Mesh(new THREE.CircleGeometry(0.95, 12).rotateX(-PI / 2), makeWater(0.25));
    w2.position.set(0, 2.18, 0); w2.renderOrder = 1; scene.add(w2);
  }
  // festival poles + lantern lines across the plaza
  const poles = [];
  for (let k = 0; k < 8; k++) {
    const a = PI / 8 + k * PI / 4, r = 8.7, x = Math.sin(a) * r, z = Math.cos(a) * r;
    B.push(x, 0, z, -a);
    cyl(0, 0, 0, 0.12, 0.15, 4.7, 6, WOOD.dark, PAT.BARK);
    cyl(0, 4.7, 0, 0.0, 0.14, 0.3, 6, MET.gold, PAT.METAL);
    box(0, 3.6, 0.06, 0.05, 1.1, 0.4, k % 2 ? 0xb83a30 : 0xe0b23a, PAT.NOISE);
    colCirc(0, 0, 0.18, 0, 4);
    B.pop();
    poles.push([x, 4.45, z]);
  }
  const FEST = [];
  const fcols = [0xff5a3a, 0xffc04a, 0xff8a2a, 0xe8e0a0, 0xff6aa0];
  for (let k = 0; k < 4; k++) FEST.push(...festivalLine(poles[k], poles[k + 4], 1.2, 13, fcols));
  for (let k = 0; k < 8; k++) FEST.push(...festivalLine(poles[k], poles[(k + 1) % 8], 0.7, 5, fcols));
  for (const f of FEST) addEmitter(f.p.x, f.p.y, f.p.z, { color: f.c, int: 0, range: 1, glow: 0.5, night: 1 });
  addEmitter(0, 3.6, 0, { color: 0xffb060, int: 9, range: 13, glow: 0, night: 1, prio: 1 });
  addEmitter(5.0, 3.4, 0, { color: 0xff9a50, int: 5, range: 9, glow: 0, night: 1 });
  addEmitter(-5.0, 3.4, 0, { color: 0xff9a50, int: 5, range: 9, glow: 0, night: 1 });
  // market stalls
  const stall = (x, z, goods, cloth) => { const ry = Math.atan2(-x, -z); marketStall(x, z, ry, { goods, cloth }); };
  stall(-5.6, 5.2, 'produce', 0xb83a30);
  stall(5.9, 4.9, 'cloth', 0x3a6a8a);
  stall(6.0, -5.0, 'pots', 0x6a8a3a);
  // harvest decorations round the plaza
  for (const [x, z, r] of [[-6.9, -4.6, 0.5], [-1.2, -8.2, -0.3], [0.8, 8.3, 0.2], [8.6, 0.6, 1.4]]) {
    hayBale(x, z, r); pumpkin(x + 0.3, 0.5, z + 0.1, 0.18); jackOLantern(x - 0.25, z - 0.1, 0.2, r, 0.5);
    pumpkin(x + 0.7, 0, z - 0.6, 0.24); pumpkin(x - 0.9, 0, z + 0.5, 0.16, 0xe8a03a);
  }
  for (const [x, z] of [[-2.6, 7.1], [2.6, -7.2], [-7.4, 1.6]]) bench(x, z, Math.atan2(-x, -z), 1.6, { back: true });
  noticeBoard(-9.2, -4.6, Math.atan2(9.2, 4.6));
  scarecrow(9.4, -3.2, -0.8);
  signpost(10.8, 7.4, 0.3, [0, PI * 0.5, PI]);
  well(-12.5, 13.0);
  // ---- lamp posts along the roads ----
  for (const [x, z] of [[-13, 6.6], [-26, 8.0], [-40, 9.2], [-54, 9.6], [13, 6.8], [25, 8.2], [55.5, 10.2], [-6.5, -12.5], [-19, -17], [17.5, -16.5], [11.5, 13.0], [-17.5, 11.5], [29, 16], [3.8, -12.0]]) lampPost(x, z);
  // ---- paths ----
  addPath(3.6, [[-92, 10], [-60, 9], [-40, 7.4], [-24, 6.0], [-12, 4.6], [-8.6, 3.2]]);
  addPath(3.6, [[8.6, 3.2], [16, 4.6], [28, 6.2], [36.5, 6.6]]);
  addPath(3.0, [[53.5, 6.8], [58, 8.2], [63, 10.8], [66.5, 13.5]]);
  addPath(2.6, [[-1.2, -8.8], [-3.2, -13], [-4.5, -16.6]]);
  addPath(2.4, [[-9.0, -2.6], [-13, -2.4], [-16.6, -2.0]]);
  addPath(2.4, [[-6.4, -6.6], [-14, -13.5], [-22, -20], [-28, -25], [-30, -26.2]]);
  addPath(2.4, [[6.3, -6.6], [14, -14], [21, -21], [26, -25.2]]);
  addPath(2.4, [[13, 4.5], [17, 1.5], [19.0, -1.0]]);
  addPath(2.4, [[22, 4.8], [25.5, 0.2]]);
  addPath(2.4, [[6.4, 6.6], [11, 11], [15, 15.6]]);
  addPath(2.2, [[-15.5, 4.8], [-18.5, 10.5], [-19, 16.4]]);
  addPath(2.2, [[28, 6.5], [29.5, 14], [30, 21], [30.2, 25.8]]);
  addPath(2.0, [[36.5, 27], [40.5, 28]]);
  addPath(2.2, [[-22, -20], [-20.5, -26.5], [-17, -33], [-12.5, -39], [-9.6, -42.4], [MOUTH.x, MOUTH.z + 3.2]]);
  // ---- bridge over the river ----
  {
    const z0 = 6.6, xa = 36.2, xb = 53.6, xd0 = 40.4, xd1 = 49.4;
    const ya = Math.max(0, terrainH(xa, z0)), yb = Math.max(0, terrainH(xb, z0)), yd = Math.max(1.3, Math.max(ya, yb) + 0.7);
    const topAt = x => x < xd0 ? lerp(ya, yd, (x - xa) / (xd0 - xa)) : x > xd1 ? lerp(yd, yb, (x - xd1) / (xb - xd1)) : yd;
    B.reset(); B.to(OUT);
    const N = 30, W = 3.6, hw = W / 2 - 0.3;
    for (let i = 0; i < N; i++) {
      const x0 = xa + (i * (xb - xa)) / N, x1 = xa + ((i + 1) * (xb - xa)) / N, xm = (x0 + x1) / 2;
      const y0 = topAt(x0), y1 = topAt(x1), top = Math.min(y0, y1), u = (xm - 39.2) / (50.6 - 39.2);
      const archBot = u > 0 && u < 1 ? WATER_Y + Math.sin(u * PI) * (yd - 0.65 - WATER_Y) : -1.8;
      const bot = Math.min(archBot, top - 0.5);
      box(xm, bot, z0, x1 - x0 + 0.02, top - 0.02 - bot, W, 0x9a9488, PAT.STONE, { uv: 0 });
      quad([x0, y0 + 0.01, z0 + hw], [x1, y1 + 0.01, z0 + hw], [x1, y1 + 0.01, z0 - hw], [x0, y0 + 0.01, z0 - hw], 0xa8a092, PAT.COBBLE, { occ: 0 });
      const L = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
      for (const sd of [-1, 1]) box(xm, (y0 + y1) / 2 - 0.25, z0 + sd * (W / 2 - 0.15), L + 0.03, 0.95, 0.3, 0xa8a296, PAT.STONE, { rz: ang });
    }
    for (const sd of [-1, 1]) for (const x of [xa, xb]) box(x, topAt(x) - 0.2, z0 + sd * (W / 2 - 0.15), 0.45, 1.2, 0.45, 0xb0aa9e, PAT.STONE);
    walkRamp((xa + xd0) / 2, z0, W - 0.5, xd0 - xa, ya, yd, PI / 2);
    walkRect((xd0 + xd1) / 2, z0, xd1 - xd0, W - 0.5, yd);
    walkRamp((xd1 + xb) / 2, z0, W - 0.5, xb - xd1, yb, yd, -PI / 2);
    for (const s of [-1, 1]) addColW((xa + xb) / 2, z0 + s * (W / 2 - 0.15), (xb - xa) / 2 + 0.2, 0.18, 1, 0, -2, 3.5);
    lampPost(xa - 0.6, z0 + 2.4); lampPost(xb + 0.6, z0 - 2.4);
  }
  // ---- fisher's dock on the river ----
  {
    const z0 = 28, x0 = 39.6, x1 = 44.2;
    DOCK.y = Math.max(0.16, terrainH(x0 + 0.4, z0) + 0.1);
    const y = DOCK.y;
    B.reset(); B.to(OUT);
    box((x0 + x1) / 2, y - 0.12, z0, x1 - x0, 0.12, 1.8, WOOD.mid, PAT.PLANK);
    for (const x of [x0 + 0.3, (x0 + x1) / 2, x1 - 0.2]) for (const s of [-1, 1]) cyl(x, -1.6, z0 + s * 0.8, 0.09, 0.1, 1.95, 6, WOOD.dark, PAT.BARK);
    walkRect((x0 + x1) / 2, z0, x1 - x0, 1.8, y);
    barrel(x1 - 0.5, z0 + 0.55, { h: 0.6, r: 0.22, y });
    crate(x0 + 1.2, z0 - 0.5, 0.2, 0.4, { y });
  }
  // ---- pond ----
  B.reset(); B.to(VEG);
  for (let i = 0; i < 10; i++) { const a = rnd(0, TAU), r = rnd(1.5, POND.r - 2); cyl(POND.x + Math.cos(a) * r, WATER_Y + 0.02, POND.z + Math.sin(a) * r, 0.38, 0.38, 0.02, 9, 0x4a7a3a, 0, { occ: 0 }); if (R() < 0.4) sph(POND.x + Math.cos(a) * r + 0.1, WATER_Y + 0.08, POND.z + Math.sin(a) * r, 0.07, 0xf0d8e8, 0, { det: 0, occ: 0 }); }
  for (let i = 0; i < 14; i++) { const a = rnd(0, TAU); reeds(POND.x + Math.cos(a) * (POND.r - 0.6), POND.z + Math.sin(a) * (POND.r - 0.6), 5); }
  for (let i = 0; i < 26; i++) { const z = rnd(-80, 80); let x = 0; for (let k = 0; k < RIVER.length - 1; k++) if (z >= RIVER[k][1] && z <= RIVER[k + 1][1]) x = lerp(RIVER[k][0], RIVER[k + 1][0], (z - RIVER[k][1]) / (RIVER[k + 1][1] - RIVER[k][1])); const side = R() < 0.5 ? -1 : 1; if (Math.abs(z - 6.6) < 5 || Math.abs(z - 28) < 3) continue; reeds(x + side * rnd(3.2, 4.2), z, 6); }
  // ---- gardens, pens, fields ----
  B.reset(); B.to(OUT);
  // pumpkin patch & scarecrow west of the weaver
  for (let i = 0; i < 26; i++) { const x = -34 + (i % 6) * 1.5 + rnd(-0.3, 0.3), z = 24 + Math.floor(i / 6) * 1.6 + rnd(-0.3, 0.3); pumpkin(x, 0, z, rnd(0.18, 0.34), pick([0xd8661c, 0xe07a24, 0xc85a1a, 0xe8a03a])); }
  for (let i = 0; i < 18; i++) { const x = -34 + rnd(0, 8), z = 24 + rnd(0, 6.4); box(x, terrainH(x, z), z, rnd(0.5, 1.0), 0.04, 0.1, 0x4a6a2a, PAT.LEAF, { ry: rnd(0, 3), occ: 0 }); }
  scarecrow(-30.5, 27.0, 0.6);
  fence([[-35.2, 22.8], [-35.2, 31.4], [-25.0, 31.4], [-25.0, 22.8], [-28.5, 22.8]], { ground: true });
  NO_GRASS.push({ x: -30, z: 27, r: 5.5 });
  // chicken pen & coop
  fence([[-14.5, 24.5], [-14.5, 30.5], [-7.5, 30.5], [-7.5, 24.5], [-10.0, 24.5]], { h: 0.8 });
  B.push(-12.8, gy(-12.8, 29.2), 29.2, 0); box(0, 0.3, 0, 1.8, 1.0, 1.2, WOOD.mid, PAT.PLANK); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * 0.8, 0, sz * 0.5, 0.08, 0.3, 0.08, WOOD.dark);
  B.push(0, 1.3, 0, 0); box(0, 0, -0.35, 2.0, 0.06, 0.8, 0xa2462f, PAT.TILE, { rx: -0.45, uv: 3 }); box(0, 0, 0.35, 2.0, 0.06, 0.8, 0xa2462f, PAT.TILE, { rx: 0.45, uv: 3 }); B.pop();
  box(0, 0.3, 0.62, 0.35, 0.4, 0.04, 0x2a1e16); colBox(0, 0, 1.9, 1.3, 0, 1.6); B.pop();
  hayBale(-9.0, 29.4, 0.2);
  // wheat field & windmill
  buildWheat(61, 27, 14, 9, 0.15);
  NO_GRASS.push({ x: 61, z: 27, r: 8.5 });
  fence([[53.5, 21.5], [53.5, 32.5], [68.5, 32.5], [68.5, 21.5], [58, 21.5]], { ground: true, c: 0x8a6a48 });
  buildWindmill(68, 13.5);
  fence([[70, -6], [70, 6], [84, 6], [84, -6], [74, -6]], { ground: true, c: 0x8a6a48 });
  // graveyard beside the chapel
  B.reset(); B.to(OUT);
  fence([[31.6, -26.5], [31.6, -40], [41, -40], [41, -26.5], [35, -26.5]], { c: 0x3a3a3a, h: 1.0 });
  let gk = 0;
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) gravestone(33.4 + i * 2.1 + rnd(-0.3, 0.3), -29 - r * 3.4 + rnd(-0.3, 0.3), 0, gk++);
  jackOLantern(36.8, -36.8, 0.22, 0.3); jackOLantern(34.2, -30.4, 0.2, -0.4);
  // woodland bits
  cart(-44, 4, 1.2);
  woodpile(-9.5, 22.2, 0.3);
  hayBale(55.5, 17.5, 0.5); hayBale(56.1, 16.8, 1.6, 0.5); hayBale(55.2, 16.6, 1.1);
  B.ground = -1;
}

function buildWindmill(x, z) {
  const y = terrainH(x, z) - 0.2;
  B.reset(); B.to(OUT);
  B.push(x, y, z, -PI / 2 + 0.2);
  cyl(0, 0, 0, 2.3, 3.1, 9.5, 8, 0xd8ccb2, PAT.PLASTER, { r0: PI / 8 });
  cyl(0, 0, 0, 3.2, 3.3, 0.6, 8, 0x8b857a, PAT.STONE, { r0: PI / 8 });
  box(0, 0.4, 2.85, 1.1, 2.1, 0.2, WOOD.red, PAT.PLANK);
  for (const [yy, a] of [[4.2, 0.6], [6.8, -0.8], [3.0, 2.4]]) { box(Math.sin(a) * 2.75, yy, Math.cos(a) * 2.75, 0.55, 0.8, 0.18, 0x3a3040, 0, { ry: a }); }
  cyl(0, 9.4, 0, 0.3, 2.65, 2.8, 10, 0x6b4a33, PAT.SLATE, { uv: 3 });
  cyl(0, 12.0, 0, 0.05, 0.08, 0.8, 5, MET.iron);
  box(0, 9.5, 2.45, 0.5, 0.5, 0.9, 0x5a3a24, PAT.PLANK);
  colCirc(0, 0, 3.1, -2, 12);
  const hubWorld = B.wp(0, 9.75, 3.0);
  const hubDir = B.wdir(0, 0, 1);
  B.pop();
  const sb = new Batch();
  withLocal(() => {
    B.to(sb);
    cyl(0, -0.3, 0, 0.32, 0.32, 0.6, 8, WOOD.dark, PAT.PLANK, { rx: PI / 2 });
    for (let i = 0; i < 4; i++) {
      B.push(0, 0, 0.2, 0, 0, i * PI / 2);
      box(0, 0.2, 0, 0.16, 6.3, 0.14, WOOD.mid, PAT.PLANK);
      for (let k = 0; k < 8; k++) box(0.55, 1.2 + k * 0.68, 0, 1.2, 0.05, 0.05, WOOD.light);
      box(1.12, 1.2, 0, 0.06, 5.0, 0.06, WOOD.light);
      box(0.6, 1.25, -0.02, 1.0, 4.9, 0.02, 0xe8e0cc, PAT.NOISE, { occ: 1 });
      B.pop();
    }
  });
  const sails = new THREE.Mesh(sb.toGeometry(), worldMat());
  sails.castShadow = true; sails.receiveShadow = true;
  sails.position.copy(hubWorld);
  sails.lookAt(hubWorld.clone().add(hubDir));
  scene.add(sails);
  ANIMS.push((dt) => { sails.rotateZ(dt * 0.55); });
}

function scatterVegetation() {
  const trees = [];
  const ok = (x, z, r) => {
    if (grassBlocked(x, z)) return false;
    for (const b of BUILDINGS) { const c = b.localY(0, 0, 0); if (Math.hypot(x - c.x, z - c.z) < (b.s.R ? b.s.R + 4 : Math.hypot(b.s.w, b.s.d) / 2 + 3)) return false; }
    if (riverDist(x, z) < 7.5) return false;
    if (mountainH(x, z) > 0.6 || slopeAt(x, z) > 0.5) return false;
    if (Math.hypot(x - MOUTH.x, z - MOUTH.z - 3) < 8) return false;
    if (Math.hypot(x - 68, z - 13.5) < 7) return false;
    if (pathInfo(x, z) > 0.02) return false;
    for (const t of trees) if ((t[0] - x) ** 2 + (t[1] - z) ** 2 < r * r) return false;
    return true;
  };
  // hand-placed village trees (autumn showpieces)
  const hand = [[11.5, -14.5, 'oak', 1.55], [-12, -10, 'maple', 1.1], [9.6, 14.6, 'maple', 1.0], [-10, 9.5, 'birch', 1.0], [-25.5, 11, 'oak', 1.1],
    [-34, 6, 'maple', 1.1], [-14, -27, 'birch', 1.0], [15, -27, 'maple', 1.15], [38, -14, 'oak', 1.2], [30, 13, 'birch', 0.95], [-27, -13, 'oak', 1.0],
    [5, 26, 'oak', 1.25], [-4, 31, 'maple', 1.0], [22, 30, 'apple', 1.0], [25.5, 31, 'apple', 0.95], [-38, -18, 'pine', 1.1], [-42, 20, 'maple', 1.0],
    [40, -24, 'oak', 1.0], [34, -43, 'birch', 0.9], [12, -38, 'pine', 1.0], [-3, -34, 'oak', 1.3], [-46, -4, 'pine', 1.15]];
  for (const [x, z, t, s] of hand) { trees.push([x, z]); tree(x, z, t, s); }
  for (let i = 0; i < 2600 && trees.length < 330; i++) {
    const a = rnd(0, TAU), r = 18 + Math.sqrt(R()) * 67;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const inner = r < 50;
    if (inner && R() < 0.8) continue;
    if (!ok(x, z, inner ? 7 : 3.6)) continue;
    trees.push([x, z]);
    const n = fbm2(x * 0.02 + 5, z * 0.02);
    const t = z < -45 || n > 0.62 ? (R() < 0.75 ? 'pine' : 'oak') : R() < 0.42 ? 'maple' : R() < 0.2 ? 'birch' : 'oak';
    tree(x, z, t, rnd(0.85, 1.3));
  }
  for (let i = 0; i < 160; i++) {
    const a = rnd(0, TAU), r = rnd(12, 82), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!ok(x, z, 1.5)) continue;
    if (R() < 0.6) bush(x, z, rnd(0.7, 1.2)); else rock(x, z, rnd(0.4, 1.3));
  }
}
