// ============================================================================
//  THE VALLEY — instanced vegetation for the far country, and the regions
//  beyond the village: Southfields, the Wisp Fen, the Barrow Downs, the
//  Gloamwood, the eastern orchards, the north watch and the hilltop beacons.
// ============================================================================

// ---- instanced vegetation ------------------------------------------------------------------------
// Each kind is a handful of variant meshes built once; every planted copy is an instance,
// grouped per 64 m tile so the far woods still frustum-cull.
const IVEG = { kinds: new Map(), groups: new Map(), meta: new Map(), meshes: [] };
function vegKind(name, n, make) {
  const arr = [], meta = [];
  const occ = B.occ;
  for (let v = 0; v < n; v++) {
    const b = new Batch();
    let m = null;
    withLocal(() => { B.to(b); B.occ = 1; m = make(v) || {}; });
    arr.push(b.toGeometry()); meta.push(m);
  }
  B.occ = occ;
  IVEG.kinds.set(name, arr); IVEG.meta.set(name, meta);
}
function plant(kind, x, z, s = 1, o = {}) {
  const vs = IVEG.kinds.get(kind); if (!vs) return null;
  const vi = o.v ?? Math.floor(R() * vs.length), meta = IVEG.meta.get(kind)[vi];
  const key = kind + ':' + vi + ':' + Math.floor(x / 64) + ',' + Math.floor(z / 64);
  let g = IVEG.groups.get(key);
  if (!g) IVEG.groups.set(key, g = { kind, v: vi, list: [] });
  const y = o.y ?? terrainH(x, z);
  const it = { x, y: y + (o.dy ?? -0.05), z, s, ry: o.ry ?? rnd(0, TAU), c: o.c ?? (1 + (R() - 0.5) * 0.16) };
  g.list.push(it);
  const v = { x, z, r: (meta.canopy ? meta.canopy.r : meta.r ? meta.r * 2 : 0.6) * s, recs: [], cols: [], canopies: [], hid: 0, inst: it };
  if (o.col !== false && meta.r) v.cols.push(addCircW(x, z, meta.r * s, y - 1, y + (meta.h || 3) * s));
  if (meta.canopy && o.leaves !== false) { const k = { x, y: y + meta.canopy.y * s, z, c: meta.canopy.c, r: meta.canopy.r * s, pine: meta.canopy.pine }; CANOPIES.push(k); v.canopies.push(k); }
  BASEVEG.push(v);
  return it;
}
function buildIVeg() {
  const mat = worldMat({ rough: 0.9 }), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V3(), p = new V3(), c = new THREE.Color();
  for (const g of IVEG.groups.values()) {
    const geo = IVEG.kinds.get(g.kind)[g.v], mesh = new THREE.InstancedMesh(geo, mat, g.list.length);
    g.list.forEach((it, i) => {
      it.mesh = mesh; it.i = i;
      q.setFromAxisAngle(UPV, it.ry); sc.set(it.s, it.s, it.s); p.set(it.x, it.y, it.z);
      mesh.setMatrixAt(i, m4.compose(p, q, sc));
      if (typeof it.c === 'number') c.setRGB(it.c, it.c, it.c); else c.copy(it.c);
      mesh.setColorAt(i, c);
    });
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingSphere();
    scene.add(mesh); IVEG.meshes.push(mesh);
  }
  IVEG.groups.clear();
}

// ---- the kinds -------------------------------------------------------------------------------------
function defineVegKinds() {
  const trunk = (h, r0, r1, c) => cyl(0, 0, 0, r1, r0, h, 7, c, PAT.BARK);
  const branches = (h, s, c, n = 3) => { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), tl = rnd(0.7, 1.1) * s; cyl(0, h * rnd(0.55, 0.8), 0, 0.05 * s, 0.1 * s, tl, 5, c, PAT.BARK, { ry: a, rz: 0.9 }); } };
  const canopy = (h, cr, pal, n = 5, sy = 0.9) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd(-0.4, 0.4), d = i === 0 ? 0 : cr * rnd(0.6, 0.85), yy = h + cr * (i === 0 ? 0.55 : rnd(0.0, 0.45));
      sph(Math.cos(a) * d, yy, Math.sin(a) * d, cr * (i === 0 ? 1.15 : rnd(0.8, 1.0)), vary(pick(pal), 0.1), PAT.LEAF, { det: 1, jit: 0.18, sway: 0.7, sy });
    }
  };
  vegKind('oak', 6, v => {
    const pal = v < 2 ? [pick(GREENS)] : v < 4 ? [pick(GREENS), pick(AUTUMN)] : [pick(AUTUMN)];
    const tc = vary(0x5e4532, 0.1), h = 2.3;
    trunk(h, 0.3, 0.17, tc); branches(h, 1, tc); canopy(h, 1.35, pal);
    return { r: 0.32, h: 3, canopy: { y: h + 0.8, c: pal[0], r: 1.6 } };
  });
  vegKind('maple', 4, v => {
    const pal = [AUTUMN[v % AUTUMN.length]];
    const tc = vary(0x5a4232, 0.1), h = 2.4;
    trunk(h, 0.28, 0.16, tc); branches(h, 1, tc); canopy(h, 1.3, pal);
    return { r: 0.3, h: 3, canopy: { y: h + 0.8, c: pal[0], r: 1.55 } };
  });
  vegKind('birch', 3, v => {
    const h = 3.0, pal = [0xe0b23a, 0xd8a030, 0xc8b040];
    trunk(h, 0.2, 0.12, 0xd9d4c6);
    for (let i = 0; i < 4; i++) box(0, rnd(0.4, h - 0.3), 0, 0.26, 0.05, 0.26, 0x2a2a28, 0, { ry: rnd(0, 3) });
    branches(h, 1, 0xd9d4c6); canopy(h, 0.95, pal, 4, 1.25);
    return { r: 0.22, h: 3, canopy: { y: h + 0.6, c: pal[v % 3], r: 1.1 } };
  });
  vegKind('pine', 4, v => {
    const gc = vary(pick([0x2f5a34, 0x355f37, 0x2a4f30]), 0.08);
    cyl(0, 0, 0, 0.14, 0.24, 2.2, 6, vary(0x5e4532, 0.1), PAT.BARK);
    for (let i = 0; i < 4; i++) { const yy = 1.0 + i * 1.05, r = 1.9 - i * 0.38; cyl(0, yy, 0, 0, r, 1.9, 7, shade(gc, 1 + i * 0.06), PAT.LEAF, { sway: 0.45 + i * 0.25, swayH: 1, r0: i * 0.4 + v }); }
    return { r: 0.3, h: 3, canopy: { y: 3, c: 0x3a6a3a, r: 1.5, pine: 1 } };
  });
  vegKind('apple', 3, v => {
    const tc = vary(0x5e4532, 0.1), h = 1.25;
    trunk(h, 0.2, 0.12, tc); branches(h, 0.7, tc); canopy(h, 0.8, [0x5f8c38, 0x6a943c], 4);
    const fruit = v === 2 ? 0xd8b030 : 0xc4302a;
    for (let i = 0; i < 9; i++) { const a = rnd(0, TAU), el = rnd(-0.2, 0.9); ball(Math.cos(a) * 0.85 * Math.cos(el), h + 0.42 + Math.sin(el) * 0.8, Math.sin(a) * 0.85 * Math.cos(el), 0.07, fruit, 0, { sway: 0.7, ws: 6, hs: 4 }); }
    return { r: 0.22, h: 2.2, canopy: { y: h + 0.5, c: 0x5f8c38, r: 1.0 } };
  });
  vegKind('willow', 3, v => {
    const tc = vary(0x5a4a38, 0.1), h = 2.2;
    cyl(0, 0, 0, 0.22, 0.38, h, 7, tc, PAT.BARK, { rz: rnd(-0.12, 0.12) });
    for (let i = 0; i < 4; i++) { const a = rnd(0, TAU); cyl(0, h * 0.8, 0, 0.06, 0.12, 1.3, 5, tc, PAT.BARK, { ry: a, rz: 0.7 }); }
    const gc = vary(0x7a9a4a, 0.08);
    sph(0, h + 1.0, 0, 1.5, gc, PAT.LEAF, { det: 1, jit: 0.2, sy: 0.5, sway: 0.5 });
    for (let i = 0; i < 34; i++) {   // the trailing fronds, thin and many
      const a = (i / 34) * TAU + rnd(-0.1, 0.1), r = rnd(1.1, 1.65), L = rnd(1.3, 2.3);
      cyl(Math.cos(a) * r, h + 1.0 - L, Math.sin(a) * r, 0.11, 0.025, L, 3, shade(gc, rnd(0.8, 1.15)), PAT.LEAF, { sway: 1.2, swayH: 1, rx: Math.sin(a) * 0.12, rz: -Math.cos(a) * 0.12 });
    }
    return { r: 0.36, h: 3, canopy: { y: h + 0.8, c: 0x8aa04a, r: 1.6 } };
  });
  vegKind('dead', 4, v => {
    const tc = vary(v % 2 ? 0x4a4038 : 0x5e554a, 0.08), h = rnd(2.0, 3.0);
    cyl(0, 0, 0, 0.1, 0.24, h, 6, tc, PAT.BARK, { rz: rnd(-0.1, 0.1) });
    for (let i = 0; i < 5; i++) {
      const a = rnd(0, TAU), yy = h * rnd(0.4, 0.95), L = rnd(0.6, 1.5);
      B.push(0, yy, 0, a, 0, rnd(0.6, 1.1)); cyl(0, 0, 0, 0.02, 0.07, L, 5, tc, PAT.BARK);
      cyl(0, L * 0.7, 0, 0.01, 0.035, L * 0.5, 4, tc, PAT.BARK, { rz: rnd(-0.8, 0.8) }); B.pop();
    }
    return { r: 0.22, h: 3 };
  });
  vegKind('hawthorn', 3, v => {
    const tc = vary(0x4e3e30, 0.1);
    cyl(0, 0, 0, 0.1, 0.18, 1.2, 6, tc, PAT.BARK, { rz: 0.25, rx: 0.1 });
    cyl(0.3, 1.1, 0, 0.05, 0.09, 0.9, 5, tc, PAT.BARK, { rz: -0.6 });
    const gc = vary(v === 2 ? 0x8a7a3a : 0x5a7a34, 0.1);
    for (let i = 0; i < 3; i++) sph(rnd(-0.4, 0.9), 1.5 + rnd(0, 0.5), rnd(-0.5, 0.5), rnd(0.6, 0.85), gc, PAT.LEAF, { det: 1, jit: 0.25, sy: 0.7, sway: 0.4 });
    for (let i = 0; i < 12; i++) ball(rnd(-0.7, 1.2), 1.4 + rnd(0, 0.8), rnd(-0.8, 0.8), 0.05, v === 1 ? 0xf2ece0 : 0xb8282a, 0, { ws: 5, hs: 4 });
    return { r: 0.2, h: 2, canopy: { y: 1.8, c: 0x5a7a34, r: 1.0 } };
  });
  vegKind('gloam', 5, v => {
    // the wood that went cold: black, bare and twisted, a few clots of dead violet leaves, grey moss,
    // and pale fungus that glows on the trunks after dark
    const tc = vary(0x241e26, 0.12), h = rnd(3.4, 4.8), lean = rnd(-0.12, 0.12);
    B.push(0, 0, 0, 0, lean, 0);
    cyl(0, 0, 0, 0.24, 0.5, h * 0.55, 7, tc, PAT.BARK);
    cyl(0, h * 0.55 - 0.05, 0, 0.12, 0.25, h * 0.47, 6, tc, PAT.BARK, { rz: rnd(-0.18, 0.18), rx: rnd(-0.12, 0.12) });
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + rnd(-0.3, 0.3); B.push(0, 0.05, 0, a); cyl(0.3, 0, 0, 0.12, 0.3, 0.9, 5, tc, PAT.BARK, { rz: -1.25 }); B.pop(); }   // roots
    const tips = [];
    for (let i = 0; i < 7; i++) {   // bare limbs reaching up and out, each with a crooked twig or two
      const a = (i / 7) * TAU + rnd(-0.35, 0.35), yy = h * rnd(0.5, 0.95), L = rnd(1.3, 2.3), tilt = rnd(0.55, 1.0);
      B.push(0, yy, 0, a, 0, tilt);
      cyl(0, 0, 0, 0.025, 0.1, L, 5, tc, PAT.BARK);
      for (let k = 0; k < 2; k++) cyl(0, L * rnd(0.45, 0.85), 0, 0.01, 0.04, L * rnd(0.35, 0.6), 4, tc, PAT.BARK, { rz: rnd(-0.9, 0.9), rx: rnd(-0.5, 0.5) });
      B.pop();
      tips.push([-Math.cos(a) * Math.sin(tilt) * L, yy + Math.cos(tilt) * L, Math.sin(a) * Math.sin(tilt) * L]);
    }
    const pal = [0x2e2440, 0x3a2a4e, 0x26323a];
    for (let i = 0; i < 3; i++) { const t = tips[i * 2]; sph(t[0] * 0.8, t[1] - 0.2, t[2] * 0.8, rnd(0.45, 0.75), vary(pick(pal), 0.12), PAT.LEAF, { det: 1, jit: 0.3, sy: 0.7, sway: 0.35 }); }
    for (let i = 0; i < 6; i++) { const t = pick(tips); cyl(t[0] * 0.7, t[1] - rnd(0.9, 1.6), t[2] * 0.7, 0.025, 0.06, rnd(0.8, 1.4), 4, 0x6a6a62, PAT.NOISE, { sway: 0.9, swayH: 1 }); }
    for (let i = 0; i < 4; i++) { const a = rnd(0, TAU), yy = rnd(0.4, h * 0.6); B.push(Math.cos(a) * 0.34, yy, Math.sin(a) * 0.34, -a + PI / 2); cyl(0, 0, 0, 0.17, 0.05, 0.06, 7, 0x7ae8d8, 0, { em: -2.4, occ: 0 }); B.pop(); }
    B.pop();
    return { r: 0.45, h: 4, canopy: { y: h, c: 0x3a2a4e, r: 1.2 } };
  });
  vegKind('bush', 4, v => {
    const cc = vary([0x4a7a32, 0x5a8a36, 0x6a8a3a, 0x8a7a32][v], 0.1);
    for (let i = 0; i < 3; i++) sph(rnd(-0.4, 0.4), 0.35, rnd(-0.4, 0.4), rnd(0.45, 0.65), vary(cc, 0.08), PAT.LEAF, { det: 1, jit: 0.2, sway: 0.25, sy: 0.75 });
    if (v === 3) for (let i = 0; i < 6; i++) ball(rnd(-0.5, 0.5), rnd(0.4, 0.7), rnd(-0.5, 0.5), 0.05, pick([0xc8302a, 0x9b5ad8]), 0, { ws: 5, hs: 4 });
    return {};
  });
  vegKind('hedge', 3, v => {
    const cc = vary(0x3f6a2e, 0.1);
    for (let i = 0; i < 4; i++) sph(rnd(-0.9, 0.9), 0.55 + rnd(-0.1, 0.25), rnd(-0.25, 0.25), rnd(0.55, 0.75), vary(cc, 0.1), PAT.LEAF, { det: 1, jit: 0.2, sway: 0.2, sy: 0.85 });
    if (v === 2) for (let i = 0; i < 8; i++) ball(rnd(-1, 1), rnd(0.5, 1.1), rnd(-0.4, 0.4), 0.045, 0xb8282a, 0, { ws: 5, hs: 4 });
    return { r: 0.7, h: 1.4 };
  });
  vegKind('gorse', 2, v => {
    for (let i = 0; i < 3; i++) sph(rnd(-0.35, 0.35), 0.3, rnd(-0.35, 0.35), rnd(0.35, 0.5), vary(0x4a5a2a, 0.1), PAT.LEAF, { det: 0, jit: 0.25, sy: 0.8 });
    for (let i = 0; i < 16; i++) ball(rnd(-0.5, 0.5), rnd(0.2, 0.7), rnd(-0.5, 0.5), 0.045, v ? 0xf2c030 : 0xe8a820, 0, { ws: 4, hs: 3 });
    return {};
  });
  vegKind('reeds', 3, v => {
    for (let i = 0; i < 9; i++) {
      const px = rnd(-0.6, 0.6), pz = rnd(-0.6, 0.6), h = rnd(0.9, 1.7);
      cyl(px, -0.3, pz, 0.012, 0.022, h + 0.3, 4, vary(0x6a7a3a, 0.1), 0, { sway: 0.6, swayH: 1, rx: rnd(-0.12, 0.12), rz: rnd(-0.12, 0.12) });
      if (R() < 0.55) cyl(px, h * 0.72, pz, 0.035, 0.035, 0.22, 5, 0x5a3a22, 0, { sway: 0.6 });
    }
    return {};
  });
  vegKind('shrooms', 3, v => {   // glowing toadstools of the Gloamwood
    const c = [0x2aa890, 0x5a48c8, 0x3a8ab8][v];
    for (let i = 0; i < 4; i++) {
      const px = rnd(-0.45, 0.45), pz = rnd(-0.45, 0.45), h = rnd(0.1, 0.3), r = h * rnd(0.4, 0.6);
      cyl(px, -0.02, pz, r * 0.22, r * 0.3, h, 6, 0x8a8478, 0, { occ: 0 });
      lathe(px, h - 0.02, pz, [[0.001, 0], [r, 0.02], [r * 0.85, r * 0.45], [r * 0.4, r * 0.75], [0.001, r * 0.8]], 9, c, 0, { em: -0.9, occ: 0 });
    }
    return {};
  });
  vegKind('stone', 4, v => {
    sph(0, 0.1, 0, 0.6, vary(v === 3 ? 0xa8a49a : 0x8a8a84, 0.12), PAT.ROCK, { det: 0, jit: 0.3, sy: 0.6 });
    return { r: 0.4, h: 1 };
  });
  vegKind('stubble', 2, v => {   // cut stalks in the Long Field
    for (let i = 0; i < 8; i++) cyl(rnd(-0.25, 0.25), 0, rnd(-0.25, 0.25), 0.012, 0.018, rnd(0.12, 0.26), 4, vary(0xc8b070, 0.12), 0);
    return {};
  });
}
