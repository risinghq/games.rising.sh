// ============================================================================
//  UNDERGROUND — the Gilded Goose's cellar, the smugglers' tunnels and den,
//  Orrin's undercroft and the troll's cave under the mountain.
//
//  Layout is a set of walkable "regions" (flat polygons or ramps). Walls rise
//  wherever a region's edge doesn't open onto another region at roughly the
//  same floor height, so rooms, passages and junctions join up on their own.
//  Everything here uses the underground material: no ceilings, camera-side
//  walls cut down low, and the whole layer is sliced a few metres above the
//  player so the camera can always look straight in.
// ============================================================================
const UGR: any = [];   // regions
const UGM: any = [];   // meshes of the underground layer
const UGB: any = {};   // zone id -> Batch
const UGP: any = {};   // notable places (troll, imp, rats' runs...)
const UGZ: any = {
  cellar: { id: 'cellar', name: 'The Gilded Goose', sub: 'Cellar' },
  tunnels: { id: 'tunnels', name: "Smugglers' Tunnels", sub: 'Beneath Emberwick' },
  den: { id: 'den', name: "Smugglers' Den", sub: 'Beneath Emberwick' },
  vault: { id: 'vault', name: "Orrin's Undercroft", sub: 'Beneath the tower' },
  cave: { id: 'cave', name: "Grumblethorn's Cave", sub: 'Under the mountain' },
  crypt: { id: 'crypt', name: "The Founders' Barrow", sub: 'Beneath the Downs' },
};
const UGS: any = {
  masonry: { wall: 0xa3977f, pat: PAT.STONE, out: 0x5a5248, top: 0x4a4136, floor: 0x958a7a, floorPat: PAT.COBBLE, T: 0.5 },
  earth: { wall: 0x9a8468, pat: PAT.COBBLE, out: 0x4e4032, top: 0x4c3e30, floor: 0x8e7656, floorPat: PAT.GROUND, T: 0.5 },
  arcane: { wall: 0x8a8ca0, pat: PAT.STONE, out: 0x45465a, top: 0x3c3c4a, floor: 0x77798a, floorPat: PAT.STONE, T: 0.5 },
  rock: { wall: 0x8e867c, pat: PAT.ROCK, out: 0x4e4842, top: 0x47413a, floor: 0x7a7266, floorPat: PAT.GROUND, T: 0.65 },
  crypt: { wall: 0x9a988a, pat: PAT.STONE, out: 0x4a4840, top: 0x3a3832, floor: 0x7e7c70, floorPat: PAT.COBBLE, T: 0.55 },
};
let UGMAT: any = null;
// layer state: which underground zone the party is in, the slice transition, what's shown
const UG: any = { zone: null, k: 0, dir: 0, sweepT: 1, candT: 0, surfHidden: false, ugShown: false, peek: false, smY: 0 };
const UGL: any = { sky: new THREE.Color(0xa8967e), gnd: new THREE.Color(0x3e3226), hi: 1.3, fog: new THREE.Color(0x0e0b09), ex: 1.42, near: 16, far: 48 };
function ugBatch(z: any) : any { return UGB[z] || (UGB[z] = new Batch(true)); }

// ---- regions ---------------------------------------------------------------------
function polyArea(pts: any) : any { let a: any = 0; for (let i: any = 0; i < pts.length; i++) { const p: any = pts[i], q: any = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function ugFloorAt(r: any, x: any, z: any) : any {
  if (!r.ramp) return r.y;
  const q: any = r.ramp, t: any = clamp(((x - q.a[0]) * q.dx + (z - q.a[1]) * q.dz) / q.L2, 0, 1);
  return q.ya + (q.yb - q.ya) * t;
}
function ugRegion(o: any) : any {
  const r: any = { wall: true, floor: true, walk: true, h: 2.6, ceil: Infinity, style: UGS.earth, zone: 'tunnels', open: [], lift: 0, ...o };
  if (polyArea(r.pts) < 0) r.pts = r.pts.slice().reverse();          // counter-clockwise: interior on the left
  polyBounds(r, r.pts);
  if (r.ramp) { const q: any = r.ramp; q.dx = q.b[0] - q.a[0]; q.dz = q.b[1] - q.a[1]; q.L2 = q.dx * q.dx + q.dz * q.dz; }
  for (const p of o.openAt || []) {   // edges nearest these points stay open (no wall)
    let bi: any = 0, bd: any = 1e9;
    for (let i: any = 0; i < r.pts.length; i++) { const d: any = segDist(p[0], p[1], r.pts[i], r.pts[(i + 1) % r.pts.length]); if (d < bd) { bd = d; bi = i; } }
    r.open.push(bi);
  }
  UGR.push(r);
  return r;
}
function ugRect(cx: any, cz: any, w: any, d: any, o: any) : any { return ugRegion({ ...o, pts: [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]] }); }
function ugSeg(a: any, b: any, w: any, ya: any, yb: any, o: any = {}) : any {
  const dx: any = b[0] - a[0], dz: any = b[1] - a[1], L: any = Math.hypot(dx, dz), px: any = (-dz / L) * w / 2, pz: any = (dx / L) * w / 2;
  const pts: any = [[a[0] + px, a[1] + pz], [b[0] + px, b[1] + pz], [b[0] - px, b[1] - pz], [a[0] - px, a[1] - pz]];
  return ugRegion({ ...o, pts, y: ya, ramp: Math.abs(yb - ya) > 0.004 ? { a, b, ya, yb } : null, seg: { a, b, w, ya, yb } });
}
function ugJoint(p: any, w: any, y: any, o: any = {}) : any {
  const R: any = w / 2 / Math.cos(PI / 8), pts: any = [];
  for (let k: any = 0; k < 8; k++) { const ang: any = PI / 8 + k * PI / 4; pts.push([p[0] + Math.cos(ang) * R, p[1] + Math.sin(ang) * R]); }
  return ugRegion({ ...o, pts, y, lift: -0.012 });
}
// a passage along a polyline; ys = floor height at each point; stairs: indices of segments built as steps
function ugCorridor(pts: any, ys: any, w: any, o: any = {}) : any {
  const out: any = [];
  for (let i: any = 0; i < pts.length - 1; i++) {
    out.push(ugSeg(pts[i], pts[i + 1], w, ys[i], ys[i + 1], { ...o, lift: -0.006, stairs: (o.stairs || []).includes(i) }));
    // joints fill the outside of bends; never at the top of a stair, where a flat plate would trip you
    const st: any = o.stairs || [], topOfStair: any = (st.includes(i - 1) && ys[i] > ys[i - 1]) || (st.includes(i) && ys[i] > ys[i + 1]);
    if (i > 0 && !topOfStair) out.push(ugJoint(pts[i], w, ys[i], { ...o, stairs: false }));
  }
  return out;
}
function ugInside(x: any, z: any, yRef: any, except: any) : any {
  for (const r of UGR) {
    if (r === except || r.portal === false || x < r.minx || x > r.maxx || z < r.minz || z > r.maxz) continue;
    if (!pip(r.pts, x, z)) continue;
    if (Math.abs(ugFloorAt(r, x, z) - yRef) < 0.8) return r;
  }
  return null;
}
// the region a character at (x, y, z) is standing in
function ugRegionAt(x: any, z: any, y: any, tol: any = 1.7) : any {
  let best: any = null, bd: any = tol;
  for (const r of UGR) {
    if (r.portal || x < r.minx || x > r.maxx || z < r.minz || z > r.maxz || !pip(r.pts, x, z)) continue;
    const d: any = Math.abs(y - ugFloorAt(r, x, z)) - (r.lift || 0) * 8;   // rooms win over the corridor ends poking into them
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

// ---- walls, floors, steps --------------------------------------------------------------
function ugWallPrism(a: any, b: any, nix: any, niz: any, T: any, ya: any, yb: any, ta: any, tb: any, st: any, kind: any = 1) : any {
  const dx: any = b[0] - a[0], dz: any = b[1] - a[1], L2: any = dx * dx + dz * dz, k: any = (yb - ya) / L2;
  B.ud = { fy: ya - k * (dx * a[0] + dz * a[1]), ax: k * dx, az: k * dz, nx: nix, nz: niz, k: kind };
  const ox: any = -nix * T, oz: any = -niz * T, bot: any = Math.min(ya, yb) - 0.45;
  const A0: any = [a[0], bot, a[1]], B0: any = [b[0], bot, b[1]], A1: any = [a[0], ta, a[1]], B1: any = [b[0], tb, b[1]];
  const A0o: any = [a[0] + ox, bot, a[1] + oz], B0o: any = [b[0] + ox, bot, b[1] + oz], A1o: any = [a[0] + ox, ta, a[1] + oz], B1o: any = [b[0] + ox, tb, b[1] + oz];
  const oo: any = { occ: 0, uv: 0 };
  quad(A0, B0, B1, A1, st.wall, st.pat, oo);          // inner face
  quad(B0o, A0o, A1o, B1o, st.out, st.pat, oo);       // outer face
  quad(A1, B1, B1o, A1o, st.top, PAT.NOISE, oo);      // top (section colour)
  quad(A0o, A0, A1, A1o, st.out, st.pat, oo);
  quad(B0, B0o, B1o, B1, st.out, st.pat, oo);
  quad(A0o, B0o, B0, A0, st.top, 0, oo);
  B.ud = UD0;
}
function ugWall(r: any, a: any, b: any, nix: any, niz: any) : any {
  const st: any = r.style, T: any = r.T ?? st.T;
  const ya: any = ugFloorAt(r, a[0], a[1]), yb: any = ugFloorAt(r, b[0], b[1]);
  const ta: any = Math.min(ya + r.h, r.ceil), tb: any = Math.min(yb + r.h, r.ceil);
  if (ta < ya + 0.05 && tb < yb + 0.05) return;
  ugWallPrism(a, b, nix, niz, T, ya, yb, Math.max(ta, ya + 0.05), Math.max(tb, yb + 0.05), st);
  (UGP.walls || (UGP.walls = [])).push([a, b]);
  const L: any = Math.hypot(b[0] - a[0], b[1] - a[1]), ux: any = (b[0] - a[0]) / L, uz: any = (b[1] - a[1]) / L;
  addColW((a[0] + b[0]) / 2 - nix * T / 2, (a[1] + b[1]) / 2 - niz * T / 2, L / 2, T / 2, ux, uz, Math.min(ya, yb) - 0.5, Math.max(ta, tb), 'ug');
  if (r.onWall) r.onWall(r, a, b, nix, niz, ya, yb);
}
function ugBuildWalls() : any {
  for (const r of UGR) {
    if (!r.wall) continue;
    B.reset(); B.to(ugBatch(r.batch || r.zone || 'cave')); B.occ = 0;
    const n: any = r.pts.length, runs: any = [];
    for (let i: any = 0; i < n; i++) {
      const a: any = r.pts[i], b: any = r.pts[(i + 1) % n];
      const L: any = Math.hypot(b[0] - a[0], b[1] - a[1]), ux: any = (b[0] - a[0]) / L, uz: any = (b[1] - a[1]) / L, nix: any = -uz, niz: any = ux;
      const segs: any = [];
      if (!r.open.includes(i)) {
        const ns: any = Math.max(1, Math.round(L / 0.05));
        let st: any = -1;
        for (let k: any = 0; k <= ns; k++) {
          let wall: any = false;
          if (k < ns) {
            const t: any = ((k + 0.5) * L) / ns, qx: any = a[0] + ux * t, qz: any = a[1] + uz * t;
            wall = !ugInside(qx - nix * 0.07, qz - niz * 0.07, ugFloorAt(r, qx, qz), r);
          }
          if (wall && st < 0) st = (k * L) / ns;
          if (!wall && st >= 0) { segs.push([st, (k * L) / ns]); st = -1; }
        }
      }
      runs.push({ segs, L, nix, niz, ux, uz });
      for (const [t0, t1] of segs) if (t1 - t0 > 0.05) ugWall(r, [a[0] + ux * t0, a[1] + uz * t0], [a[0] + ux * t1, a[1] + uz * t1], nix, niz);
    }
    // fill the outside corner where two walled edges meet at a convex vertex
    for (let i: any = 0; i < n; i++) {
      const p: any = runs[(i + n - 1) % n], q: any = runs[i];
      if (!p.segs.length || !q.segs.length) continue;
      if (Math.abs(p.segs[p.segs.length - 1][1] - p.L) > 0.08 || q.segs[0][0] > 0.08) continue;
      if (p.ux * q.uz - p.uz * q.ux <= 0.01) continue;     // reflex vertex: walls already overlap
      const v: any = r.pts[i], T: any = r.T ?? r.style.T, y: any = ugFloorAt(r, v[0], v[1]), top: any = Math.max(Math.min(y + r.h, r.ceil), y + 0.05);
      const a: any = [v[0] - p.nix * T, v[1] - p.niz * T], bq: any = [v[0] - p.nix * T - q.nix * T, v[1] - p.niz * T - q.niz * T];
      let bx: any = p.nix + q.nix, bz: any = p.niz + q.niz; const bl: any = Math.hypot(bx, bz) || 1; bx /= bl; bz /= bl;
      B.ud = { fy: y, ax: 0, az: 0, nx: bx, nz: bz, k: 1 };
      const st: any = r.style, c4: any = [v, a, bq, [v[0] - q.nix * T, v[1] - q.niz * T]], bot: any = y - 0.45;
      const P: any = c4.map((c: any) => [c[0], top, c[1]]), Q: any = c4.map((c: any) => [c[0], bot, c[1]]);
      quad(P[0], P[3], P[2], P[1], st.top, PAT.NOISE, { occ: 0 });
      for (let k: any = 0; k < 4; k++) { const k2: any = (k + 1) % 4; quad(Q[k2], Q[k], P[k], P[k2], st.out, st.pat, { occ: 0, uv: 0 }); }
      B.ud = UD0;
    }
  }
}
// floor surface following the region (flat or ramp), with a short skirt
function ugFloor(r: any) : any {
  const st: any = r.style, pts: any = r.pts;
  B.reset(); B.to(ugBatch(r.batch || r.zone || 'cave')); B.occ = 0;
  const tri: any = THREE.ShapeUtils.triangulateShape(pts.map((p: any) => new THREE.Vector2(p[0], p[1])), []);
  const V: any = [], lift: any = r.lift || 0;
  for (const [i, j, k] of tri) {
    let A: any = pts[i], Bq: any = pts[j], Cq: any = pts[k];
    if ((Bq[0] - A[0]) * (Cq[1] - A[1]) - (Bq[1] - A[1]) * (Cq[0] - A[0]) > 0) [Bq, Cq] = [Cq, Bq];
    for (const p of [A, Bq, Cq]) V.push(p[0], ugFloorAt(r, p[0], p[1]) + lift, p[1]);
  }
  tris(V, r.floorC ?? st.floor, r.floorPat ?? st.floorPat, { uv: 0, occ: 0 });
  for (let i: any = 0; i < pts.length; i++) {
    const a: any = pts[i], b: any = pts[(i + 1) % pts.length], ya: any = ugFloorAt(r, a[0], a[1]) + lift, yb: any = ugFloorAt(r, b[0], b[1]) + lift;
    quad([b[0], yb, b[1]], [a[0], ya, a[1]], [a[0], ya - 0.4, a[1]], [b[0], yb - 0.4, b[1]], shade(st.floor, 0.6), 0, { occ: 0 });
  }
}
// steps for a ramp segment (world coords), walkable ramp registered by stairs()
function ugSteps(r: any) : any {
  const s: any = r.seg, dx: any = s.b[0] - s.a[0], dz: any = s.b[1] - s.a[1], L: any = Math.hypot(dx, dz);
  const up: any = s.yb > s.ya, a: any = up ? s.a : s.b, y0: any = Math.min(s.ya, s.yb), y1: any = Math.max(s.ya, s.yb);
  const ry: any = Math.atan2(up ? dx : -dx, up ? dz : -dz);
  B.reset(); B.to(ugBatch(r.batch || r.zone || 'cave')); B.occ = 0;
  stairs((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, ry, s.w + 0.02, L, y0, y1, { open: 'none', c: r.stepC ?? 0x6e665c });
  void a;
}
function ugWalkables(r: any) : any {
  if (!r.walk) return;
  if (r.stairs) return;                       // stairs() registers its own ramp
  if (r.ramp && r.seg) { walkRampW(r.seg.a, r.seg.b, r.seg.w + 0.04, r.seg.ya, r.seg.yb, 'ug'); return; }
  walkPolyW(r.pts, r.y, null, 'ug');
}
function walkRampW(a: any, b: any, w: any, ya: any, yb: any, tag: any) : any {
  const dx: any = b[0] - a[0], dz: any = b[1] - a[1], L: any = Math.hypot(dx, dz), s: any = -dx / L, c: any = dz / L;
  const cx: any = (a[0] + b[0]) / 2, cz: any = (a[1] + b[1]) / 2, hx: any = w / 2, hz: any = L / 2;
  const ex: any = Math.abs(c) * hx + Math.abs(s) * hz, ez: any = Math.abs(s) * hx + Math.abs(c) * hz;
  const o: any = { t: 1, cx, cz, hx, hz, c, s, y0: ya, y1: yb, tag, minx: cx - ex, maxx: cx + ex, minz: cz - ez, maxz: cz + ez };
  PHYS.walks.push(o); gridAdd(PHYS.wgrid, o);
  return o;
}

// ---- underground props ------------------------------------------------------------------
// run fn with emitters tagged for a zone and geometry going into that zone's batch
function ugIn(zone: any, fn: any) : any {
  const pz: any = CTX.zone, pu: any = CTX.ug, pt: any = B.tgt;
  CTX.zone = zone; CTX.ug = true; B.to(ugBatch(zone));
  try { fn(); } finally { CTX.zone = pz; CTX.ug = pu; B.tgt = pt; }
}
function torchSconce(x: any, y: any, z: any, ry: any, o: any = {}) : any {
  B.push(x, y, z, ry);
  box(0, -0.25, 0.04, 0.1, 0.5, 0.08, MET.iron, PAT.METAL);
  B.push(0, 0.1, 0.16, 0, 0.45);
  cyl(0, -0.25, 0, 0.035, 0.045, 0.5, 6, WOOD.dark, PAT.BARK);
  cyl(0, 0.2, 0, 0.07, 0.05, 0.1, 6, MET.iron, PAT.METAL);
  B.pop();
  fire(0, 0.38, 0.3, 0.42, { int: o.int ?? 4.5, range: o.range ?? 7.5, color: o.color ?? 0xff8a3a });
  B.pop();
}
function postLantern(x: any, z: any, ry: any, h: any = 2.3) : any {
  B.push(x, gy(x, z), z, ry);
  box(0, 0, 0, 0.22, h, 0.22, WOOD.dark, PAT.BARK, { occ: 1 });
  box(0, h - 0.12, 0.25, 0.08, 0.08, 0.5, WOOD.dark, PAT.PLANK);
  B.pop();
  B.push(x, 0, z, ry);
  const e: any = lanternHang(0, h - 0.62, 0.45, { night: 0, int: 4.5, range: 8, chain: 0.25 });
  B.pop();
  return e;
}
function wineRack(x: any, z: any, ry: any, w: any = 1.8, h: any = 2.0, o: any = {}) : any {
  B.push(x, 0, z, ry);
  const _occ: any = B.occ; B.occ = 1;
  const nx: any = Math.max(2, Math.round(w / 0.3)), ny: any = Math.max(2, Math.round(h / 0.3)), cw: any = w / nx, ch: any = h / ny;
  box(0, 0, -0.18, w, h, 0.04, shade(WOOD.dark, 0.8), PAT.PLANK);
  for (let i: any = 0; i <= nx; i++) box(-w / 2 + i * cw, 0, 0, 0.04, h, 0.36, WOOD.mid, PAT.PLANK);
  for (let j: any = 0; j <= ny; j++) box(0, j * ch - 0.02, 0, w, 0.04, 0.36, WOOD.mid, PAT.PLANK);
  for (let i: any = 0; i < nx; i++) for (let j: any = 0; j < ny; j++) {
    if (R() < (o.empty ?? 0.18)) continue;
    const bc: any = pick([0x1f3a24, 0x3a1218, 0x2a2a14, 0x4a2410]);
    for (const k of [-1, 1]) cyl(-w / 2 + (i + 0.5) * cw + k * 0.06, j * ch + 0.07, 0.12, 0.045, 0.045, 0.28, 7, bc, PAT.METAL, { rx: PI / 2 + 0.02 });
  }
  B.occ = _occ;
  colBox(0, 0, w, 0.4, 0, h);
  B.pop();
}
function barrelRack(x: any, z: any, ry: any, n: any = 3, tiers: any = 2) : any {
  B.push(x, gy(x, z), z, ry);
  const _occ: any = B.occ; B.occ = 1;
  const len: any = n * 0.78;
  for (let t: any = 0; t < tiers; t++) {
    const y: any = t * 0.72;
    for (const s of [-1, 1]) box(0, y, s * 0.32, len + 0.1, 0.1, 0.1, WOOD.dark, PAT.PLANK);
    for (let i: any = 0; i < n; i++) {
      const px: any = -len / 2 + (i + 0.5) * 0.78;
      B.push(px, y + 0.1 + 0.33, -0.45, 0, PI / 2);
      lathe(0, 0, 0, [[0.001, 0], [0.27, 0], [0.33, 0.22], [0.35, 0.45], [0.33, 0.68], [0.27, 0.9], [0.001, 0.9]], 12, vary(WOOD.mid, 0.08), PAT.BARK, { uvs: 0.5 });
      for (const tt of [0.12, 0.78]) cyl(0, tt, 0, 0.33, 0.33, 0.04, 12, MET.iron, PAT.METAL);
      B.pop();
      box(px, y + 0.38, 0.47, 0.05, 0.08, 0.06, MET.brass, PAT.METAL);
    }
  }
  for (const s of [-1, 1]) for (const e of [-1, 1]) box(e * (len / 2 + 0.02), 0, s * 0.32, 0.1, tiers * 0.72 + 0.1, 0.1, WOOD.dark, PAT.PLANK);
  B.occ = _occ;
  colBox(0, 0, len + 0.2, 1.0, 0, tiers * 0.72 + 0.6);
  B.pop();
}
function hangingMeat(x: any, y: any, z: any, n: any = 3, ry: any = 0) : any {
  B.push(x, y, z, ry);
  box(0, 0, 0, n * 0.4 + 0.3, 0.08, 0.08, WOOD.dark, PAT.PLANK);
  for (let i: any = 0; i < n; i++) {
    const px: any = -n * 0.2 + 0.2 + i * 0.4;
    box(px, -0.25, 0, 0.012, 0.25, 0.012, 0x8a7a5a);
    if (i % 2) lathe(px, -0.85, 0, [[0.001, 0], [0.08, 0.05], [0.14, 0.3], [0.1, 0.55], [0.04, 0.62], [0.001, 0.62]], 8, 0x8a3a2a, PAT.NOISE);
    else for (let k: any = 0; k < 4; k++) cyl(px + (k - 1.5) * 0.04, -0.7 + k * 0.03, 0, 0.025, 0.025, 0.42, 5, 0x7a3a22, PAT.NOISE, { rz: (k - 1.5) * 0.08 });
  }
  B.pop();
}
function cobweb(x: any, y: any, z: any, ry: any, s: any = 0.8) : any {
  B.push(x, y, z, ry);
  for (let i: any = 0; i < 6; i++) { const a: any = -PI / 2 + (i / 5) * (PI / 2); box(Math.cos(a) * s / 2, Math.sin(a) * s / 2, 0, s, 0.008, 0.008, 0xd8d8d0, 0, { rz: a, occ: 0 }); }
  for (let k: any = 1; k <= 3; k++) { const r: any = (k / 3) * s; for (let i: any = 0; i < 5; i++) { const a0: any = -PI / 2 + (i / 5) * (PI / 2), a1: any = -PI / 2 + ((i + 1) / 5) * (PI / 2); const x0: any = Math.cos(a0) * r, y0: any = Math.sin(a0) * r, x1: any = Math.cos(a1) * r, y1: any = Math.sin(a1) * r; box((x0 + x1) / 2, (y0 + y1) / 2 - 0.004, 0, Math.hypot(x1 - x0, y1 - y0), 0.008, 0.008, 0xd8d8d0, 0, { rz: Math.atan2(y1 - y0, x1 - x0), occ: 0 }); } }
  B.pop();
}
function rubble(x: any, z: any, n: any = 8, s: any = 1, c: any = 0x6e6860) : any {
  for (let i: any = 0; i < n; i++) { const r: any = rnd(0.1, 0.32) * s; sph(x + rnd(-0.8, 0.8) * s, gy(x, z) + r * 0.3, z + rnd(-0.8, 0.8) * s, r, vary(c, 0.12), PAT.STONE, { det: 0, jit: 0.3, sy: 0.7, ry: rnd(0, 3), occ: 0 }); }
}
function boulder(x: any, z: any, s: any, c: any = 0x77706a, o: any = {}) : any {
  const y: any = (o.y ?? gy(x, z)) - s * 0.2;
  sph(x, y, z, s, vary(c, 0.1), PAT.ROCK, { det: 1, jit: 0.3, sy: o.sy ?? 0.75, sx: o.sx ?? rnd(0.9, 1.3), ry: rnd(0, TAU), occ: o.occ ?? 1 });
  if (o.col !== false) colCirc(x, z, s * 0.85, y - 0.5, y + s * 1.4);
}
function stalagmite(x: any, z: any, h: any, c: any = 0x8a8278) : any {
  const y: any = gy(x, z), r: any = h * rnd(0.18, 0.26);
  lathe(x, y - 0.05, z, [[0.001, 0], [r, 0], [r * 0.8, h * 0.25], [r * 0.5, h * 0.6], [r * 0.18, h * 0.9], [0.001, h]], 7, vary(c, 0.1), PAT.ROCK, { ry: rnd(0, TAU), occ: h > 1.2 ? 1 : 0 });
  if (h > 0.5) colCirc(x, z, r * 0.9, y - 0.3, y + h);
}
function crystalCluster(x: any, z: any, s: any, c: any, o: any = {}) : any {
  const y: any = (o.y ?? gy(x, z));
  B.push(x, y, z, rnd(0, TAU));
  for (let i: any = 0; i < 6; i++) cyl(rnd(-0.25, 0.25) * s, -0.05, rnd(-0.2, 0.2) * s, 0, rnd(0.06, 0.12) * s, rnd(0.4, 1.0) * s, 5, c, 0, { em: 1.7, rx: rnd(-0.45, 0.45), rz: rnd(-0.45, 0.45), occ: 0 });
  sph(0, -0.05, 0, 0.3 * s, 0x5a5560, PAT.STONE, { det: 0, sy: 0.4, occ: 0 });
  B.pop();
  if (o.light !== false) light(x, y + 0.6 * s, z, { color: c, int: o.int ?? 3, range: o.range ?? 6, flick: 0.04, glow: 0.7 * s, prio: 1 });
  SPARKLES.push({ p: B.wp(x, y + 0.4 * s, z), r: 0.5 * s, c: col(c).clone().lerp(col(0xffffff), 0.4), rate: 1.6, ug: CTX.ug });
  colCirc(x, z, 0.35 * s, y - 0.3, y + s);
}
function mushrooms(x: any, z: any, n: any, c: any = 0x5af0d0, o: any = {}) : any {
  const y0: any = gy(x, z);
  for (let i: any = 0; i < n; i++) {
    const px: any = x + rnd(-0.7, 0.7), pz: any = z + rnd(-0.7, 0.7), h: any = rnd(0.12, 0.45), r: any = h * rnd(0.45, 0.7);
    cyl(px, y0 - 0.02, pz, r * 0.22, r * 0.3, h, 6, 0xd8d0c0, 0, { occ: 0 });
    lathe(px, y0 + h - 0.02, pz, [[0.001, 0], [r, 0.02], [r * 0.85, r * 0.45], [r * 0.4, r * 0.75], [0.001, r * 0.8]], 9, c, 0, { em: 1.2, occ: 0 });
  }
  if (o.light !== false) light(x, y0 + 0.5, z, { color: c, int: o.int ?? 2.2, range: o.range ?? 5, flick: 0.03, glow: 0.45, prio: 0 });
}
function skull(x: any, y: any, z: any, ry: any = 0, s: any = 1, c: any = 0xe8e0c8) : any {
  B.push(x, y, z, ry);
  ball(0, 0.11 * s, 0, 0.1 * s, c, 0, { sy: 0.9, ws: 8, hs: 6 });
  box(0, 0.0, 0.04 * s, 0.11 * s, 0.05 * s, 0.09 * s, c, 0);
  for (const k of [-1, 1]) ball(k * 0.035 * s, 0.11 * s, 0.085 * s, 0.025 * s, 0x1a1410, 0, { ws: 5, hs: 4 });
  B.pop();
}
function bones(x: any, z: any, n: any = 6, s: any = 1) : any {
  const y: any = gy(x, z);
  for (let i: any = 0; i < n; i++) {
    const px: any = x + rnd(-0.7, 0.7) * s, pz: any = z + rnd(-0.7, 0.7) * s, L: any = rnd(0.25, 0.6) * s, a: any = rnd(0, TAU);
    B.push(px, y + 0.04, pz, a);
    cyl(-L / 2, 0, 0, 0.025, 0.025, L, 5, 0xe0d8c0, 0, { rz: -PI / 2, occ: 0 });
    for (const e of [-1, 1]) ball(e * L / 2, 0.01, 0, 0.045, 0xe8e0c8, 0, { ws: 5, hs: 4, occ: 0 });
    B.pop();
  }
  if (R() < 0.7) skull(x + rnd(-0.4, 0.4), y, z + rnd(-0.4, 0.4), rnd(-1, 1), s * rnd(0.9, 1.6));
}
function coinPile(x: any, z: any, r: any) : any {
  const y: any = gy(x, z);
  lathe(x, y - 0.02, z, [[0.001, 0], [r, 0], [r * 0.75, r * 0.22], [r * 0.35, r * 0.4], [0.001, r * 0.45]], 14, MET.gold, PAT.METAL, { smooth: true, em: 0.25, occ: 0 });
  for (let i: any = 0; i < 40; i++) { const a: any = rnd(0, TAU), d: any = rnd(0, r * 1.5); cyl(x + Math.cos(a) * d, y + Math.max(0, (r - d) * 0.4) + 0.005, z + Math.sin(a) * d, 0.04, 0.04, 0.012, 7, MET.gold, PAT.METAL, { rx: rnd(-0.3, 0.3), rz: rnd(-0.3, 0.3), occ: 0 }); }
  for (let i: any = 0; i < 5; i++) { const a: any = rnd(0, TAU), d: any = rnd(0, r * 0.6); sph(x + Math.cos(a) * d, y + r * 0.3, z + Math.sin(a) * d, 0.05, pick([0xd8203a, 0x2a8ad8, 0x3ad86a, 0xb04ad8]), 0, { det: 0, em: 1.4, occ: 0 }); }
  // a goblet and a dented crown
  B.push(x + r * 0.5, y + r * 0.15, z - r * 0.3, 0.4, 0.25);
  lathe(0, 0, 0, [[0.001, 0], [0.07, 0], [0.02, 0.03], [0.015, 0.12], [0.06, 0.16], [0.07, 0.26], [0.001, 0.22]], 9, MET.gold, PAT.METAL, { occ: 0 });
  B.pop();
  B.push(x - r * 0.3, y + r * 0.38, z + r * 0.1, 0.3, 0.3);
  cyl(0, 0, 0, 0.13, 0.13, 0.08, 10, MET.gold, PAT.METAL, { open: true, occ: 0 });
  for (let i: any = 0; i < 6; i++) { const a: any = (i / 6) * TAU; cyl(Math.cos(a) * 0.13, 0.08, Math.sin(a) * 0.13, 0, 0.03, 0.08, 4, MET.gold, PAT.METAL, { occ: 0 }); }
  B.pop();
  SPARKLES.push({ p: B.wp(x, y + r * 0.4, z), r: r * 0.9, c: col(0xffe08a), rate: 2.5, ug: CTX.ug });
}
function timberFrame(a: any, b: any, nix: any, niz: any, ya: any, yb: any, h: any, every: any = 3.0) : any {
  // shoring posts against a tunnel wall; they're cut away with the wall they lean on
  const L: any = Math.hypot(b[0] - a[0], b[1] - a[1]), n: any = Math.floor(L / every);
  if (n < 1) return;
  for (let i: any = 1; i <= n; i++) {
    const t: any = (i - 0.5) / n, x: any = lerp(a[0], b[0], t) + nix * 0.12, z: any = lerp(a[1], b[1], t) + niz * 0.12, y: any = lerp(ya, yb, t);
    B.ud = { fy: y, ax: 0, az: 0, nx: nix, nz: niz, k: 1 };
    box(x, y - 0.1, z, 0.22, h + 0.1, 0.22, WOOD.dark, PAT.BARK, { ry: Math.atan2(nix, niz), occ: 0 });
    box(x - nix * 0.05, y + h - 0.24, z - niz * 0.05, 0.36, 0.2, 0.36, shade(WOOD.dark, 0.85), PAT.PLANK, { ry: Math.atan2(nix, niz), occ: 0 });
    B.ud = UD0;
  }
}
function cage(x: any, z: any, r: any = 0.75, h: any = 1.9) : any {
  const y: any = gy(x, z);
  B.push(x, y, z, 0);
  cyl(0, 0, 0, r + 0.08, r + 0.12, 0.12, 14, MET.iron, PAT.METAL, { occ: 0 });
  cyl(0, h, 0, r + 0.06, r + 0.06, 0.1, 14, MET.iron, PAT.METAL, { occ: 0 });
  cyl(0, h + 0.1, 0, 0.1, r * 0.7, 0.3, 10, MET.iron, PAT.METAL, { occ: 0 });
  box(0, h + 0.4, 0, 0.04, 0.6, 0.04, MET.iron, 0);
  for (let i: any = 0; i < 14; i++) { const a: any = (i / 14) * TAU; cyl(Math.cos(a) * r, 0.1, Math.sin(a) * r, 0.022, 0.022, h - 0.05, 4, MET.iron, PAT.METAL, { occ: 0 }); }
  B.pop();
  colCirc(x, z, r + 0.1, y - 0.3, y + h);
}
function magicCircle(x: any, z: any, r: any, c: any = 0x9a7aff) : any {
  const y: any = gy(x, z) + 0.012;
  B.push(x, y, z, 0);
  for (const rr of [r, r * 0.84]) torus(0, 0, 0, rr, 0.03, 4, 48, c, 0, { rx: PI / 2, em: 2.2, occ: 0 });
  for (let i: any = 0; i < 5; i++) {   // pentagram
    const a0: any = (i / 5) * TAU - PI / 2, a1: any = ((i + 2) / 5) * TAU - PI / 2, rr: any = r * 0.82;
    const x0: any = Math.cos(a0) * rr, z0: any = Math.sin(a0) * rr, x1: any = Math.cos(a1) * rr, z1: any = Math.sin(a1) * rr;
    box((x0 + x1) / 2, -0.004, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0), 0.012, 0.045, c, 0, { ry: -Math.atan2(z1 - z0, x1 - x0), em: 2.0, occ: 0 });
  }
  for (let i: any = 0; i < 16; i++) { const a: any = (i / 16) * TAU; box(Math.cos(a) * r * 0.92, -0.004, Math.sin(a) * r * 0.92, 0.1, 0.012, 0.06 + (i % 3) * 0.03, c, 0, { ry: -a, em: 2.0, occ: 0 }); }
  for (let i: any = 0; i < 5; i++) { const a: any = (i / 5) * TAU - PI / 2; candle(Math.cos(a) * r * 1.12, 0, Math.sin(a) * r * 1.12, { h: 0.22 }); }
  B.pop();
}
function runeStone(x: any, z: any, ry: any, c: any = 0x8ab0ff) : any {
  B.push(x, gy(x, z), z, ry);
  box(0, 0, 0, 0.55, 1.3, 0.3, 0x5a5c68, PAT.STONE, { occ: 0 });
  box(0, 0.55, 0.155, 0.22, 0.42, 0.01, c, 0, { em: 1.8, occ: 0 });
  B.pop();
}

// ---- the build ---------------------------------------------------------------------------------
function buildUnderground() : any {
  UGMAT = worldMat({ ug: true, rough: 0.92 });
  const I: any = V.inn, T: any = V.tower, F: any = MOUTH.F;
  const P: any = I.s.y, CY: any = P + I.levels[0] - 3.3, CC: any = P + I.levels[0] - 0.3;     // cellar floor / underside of the taproom
  const PT: any = T.s.y, VY: any = PT + T.levels[0] - 3.3, VC: any = PT + T.levels[0] - 0.3;  // undercroft floor / ceiling
  const DY: any = Math.round(((CY + VY) / 2) * 20) / 20;                            // the smugglers' den
  const wI: any = (x: any, z: any) => I.local(x, z), wT: any = (x: any, z: any) => T.local(x, z);
  Object.assign(UGP, { CY, VY, DY, F });

  // ---- the Gilded Goose's cellar ----
  const cellarPts: any = [[-6.6, -4.72], [6.6, -4.72], [6.6, 4.1], [-6.6, 4.1]].map((p: any) => wI(p[0], p[1]));
  ugRegion({ pts: cellarPts, y: CY, h: 3.2, ceil: CC, style: UGS.masonry, zone: 'cellar', lift: 0.01 });
  ugRegion({ pts: [[0.95, -4.72], [5.45, -4.72], [5.45, -3.32], [0.95, -3.32]].map((p: any) => wI(p[0], p[1])), y: CY, wall: false, floor: false, walk: false, zone: 'cellar', maxY: P + I.levels[0] - 1.25, portal: false });
  UGZ.cellar.stairTop = wI(6.2, -4.0);

  // ---- Orrin's undercroft (same octagon as the tower) ----
  const octR: any = (4.6 * Math.cos(PI / 8) - 0.38) / Math.cos(PI / 8);
  const octPts: any = []; for (let k: any = 0; k < 8; k++) { const a: any = PI / 8 + k * PI / 4; octPts.push(wT(Math.sin(a) * octR, Math.cos(a) * octR)); }
  ugRegion({ pts: octPts, y: VY, h: 3.2, ceil: VC, style: UGS.arcane, zone: 'vault', lift: 0.01 });
  ugRegion({ pts: [[-3.15, -2.25], [-1.95, -2.25], [-1.95, 2.25], [-3.15, 2.25]].map((p: any) => wT(p[0], p[1])), y: VY, wall: false, floor: false, walk: false, zone: 'vault', maxY: PT + T.levels[0] - 1.25, portal: false });

  // ---- the smugglers' den and its three tunnels ----
  const den: any = [-17.4, -26.0];
  ugRect(den[0], den[1], 6.4, 5.2, { y: DY, h: 2.9, style: UGS.earth, zone: 'den', lift: 0.01 });
  const cDoor: any = wI(-6.0, 0), vDoor: any = wT(3.5, 0);
  ugCorridor([cDoor, wI(-10.2, 0), [-12.4, -23.8], [den[0] + 2.4, den[1] + 1.0]], [CY, CY + 0.08, lerp(CY, DY, 0.6), DY], 2.5, { h: 2.6, style: UGS.earth, zone: 'tunnels', onWall: tunnelDress });
  ugCorridor([[den[0] - 2.6, den[1] - 0.8], [-22.4, -29.2], [vDoor[0] + 1.2, vDoor[1]], vDoor], [DY, lerp(DY, VY, 0.45), VY, VY], 2.5, { h: 2.6, style: UGS.earth, zone: 'tunnels', onWall: tunnelDress });
  // north: under the hill, then up a rough stair into the troll's cave
  const cA: any = [den[0] + 0.2, den[1] - 2.2], cB: any = [-17.6, -36.5], cC: any = [-16.8, -44.6], cD: any = [-16.22, -47.9], cE: any = [-14.65, -52.0], cF: any = [-12.9, -55.6];
  const yC: any = [DY, DY + 0.35, DY + 0.75, DY + 1.0, F, F];
  ugCorridor([cA, cB, cC, cD, cE, cF], yC, 2.4, { h: 2.6, style: UGS.earth, zone: 'tunnels', stairs: [3], onWall: tunnelDress });
  UGP.collapse = [-17.2, -40.4];

  // ---- the troll's cave ----
  const cavern: any = [[-14.6, -53.6], [-9.6, -52.6], [-4.0, -52.8], [0.4, -54.8], [2.1, -59.4], [1.0, -64.4], [-3.0, -67.4], [-9.0, -68.4], [-14.4, -66.4], [-16.9, -62.0], [-16.9, -57.6]];
  ugRegion({ pts: cavern, y: F, h: 4.6, style: UGS.rock, zone: 'cave', lift: 0.012, onWall: caveDress, T: 0.75 });
  const mz: any = MOUTH.z;
  ugSeg([MOUTH.x, mz + 1.7], [MOUTH.x, mz + 0.1], 3.6, F, F, { h: 3.8, style: UGS.rock, zone: null, openAt: [[MOUTH.x, mz + 1.7]], onWall: caveDress, T: 0.65, lift: -0.004, floorC: 0x4e4740 });
  ugCorridor([[MOUTH.x, mz + 0.1], [MOUTH.x, mz - 3.6], [MOUTH.x + 0.9, -53.4]], [F, F, F], 3.6, { h: 3.8, style: UGS.rock, zone: 'cave', onWall: caveDress, T: 0.65 });
  UGP.mouthIn = [MOUTH.x, mz - 1.5];
  // the hillside over the cave stays solid underfoot; only the way in at the mouth is open
  for (const r of UGR) if (r.zone === 'cave' || r.zone === null) addCarve(r.pts, { maxY: F + 0.35 });
  cryptRegions();

  // ---- geometry ----
  for (const r of UGR) {
    if (r.stairs) ugSteps(r);
    else if (r.floor) ugFloor(r);
    ugWalkables(r);
  }
  ugBuildWalls();
  dressCellar(I, P, CY, CC);
  dressVault(T, PT, VY);
  dressTunnels(den, DY, cA, cB, cC);
  dressCave(F);
  dressCrypt();
  // meshes
  for (const [z, bt] of entriesAny(UGB)) {
    if (!bt.count) continue;
    const m: any = new THREE.Mesh(bt.toGeometry(), UGMAT);
    m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
    m.userData.ug = z; m.visible = false;
    scene.add(m); UGM.push(m);
  }
  for (const k in UGB) delete UGB[k];
  if (UGP.pool) {   // a still pool in the cave, with the same water as the river
    const g: any = new THREE.CircleGeometry(1.5, 20).rotateX(-PI / 2); g.scale(1, 1, 0.78);
    const w: any = new THREE.Mesh(g, makeWater(0.7, true)); w.position.set(UGP.pool.x, UGP.pool.y, UGP.pool.z); w.renderOrder = 1;
    w.userData.ug = 'cave'; w.visible = false; scene.add(w); UGM.push(w);
  }
  ugCheckDepth();
}

// ---- the founders' barrow: a stair down under the mound, two niches of bones, Ada's chamber ----------------
function cryptRegions() : any {
  const D: any = SITES.barrowDoor; if (!D) return;
  const y0: any = D.y - 0.05, yL: any = y0 - 1.3, dx: any = D.x, dz: any = D.z;
  UGP.crypt = { y0, yL, dx, dz };
  // the doorway between the standing stones, still open to the sky
  ugSeg([dx + 1.2, dz], [dx - 1.2, dz], 2.4, y0, y0, { h: 2.9, style: UGS.crypt, zone: null, batch: 'crypt', openAt: [[dx + 1.2, dz]], T: 0.5, lift: -0.004 });
  // the passage: a short stair down, then level under the mound
  ugCorridor([[dx - 1.2, dz], [dx - 3.4, dz], [dx - 7.7, dz]], [y0, yL, yL], 2.3, { h: 2.7, style: UGS.crypt, zone: 'crypt', stairs: [0] });
  ugRect(dx - 5.0, dz - 2.25, 1.7, 2.3, { y: yL, h: 2.4, style: UGS.crypt, zone: 'crypt', lift: 0.008 });
  ugRect(dx - 5.0, dz + 2.25, 1.7, 2.3, { y: yL, h: 2.4, style: UGS.crypt, zone: 'crypt', lift: 0.008 });
  // the founders' chamber
  const cx: any = dx - 10.9, R0: any = 3.6, pts: any = [];
  for (let k: any = 0; k < 8; k++) { const a: any = PI / 8 + k * PI / 4; pts.push([cx + Math.cos(a) * R0, dz + Math.sin(a) * R0]); }
  ugRegion({ pts, y: yL, h: 3.1, style: UGS.crypt, zone: 'crypt', lift: 0.012 });
  UGP.cryptC = { x: cx, z: dz, y: yL };
  // sealed until the stones open the door, and never a hole in the mound for anyone walking on top of it
  for (const r of UGR) if (r.zone === 'crypt' || r.batch === 'crypt') addCarve(r.pts, { maxY: y0 + 0.35, when: () => !!G.flags.slabOpen });
}
function ghostSconce(id: any, x: any, y: any, z: any, ry: any) : any {
  B.push(x, y, z, ry);
  box(0, -0.2, 0.03, 0.12, 0.42, 0.06, MET.iron, PAT.METAL);
  B.push(0, 0.05, 0.14, 0); lathe(0, 0, 0, [[0.001, 0], [0.06, 0.0], [0.12, 0.1], [0.11, 0.13], [0.001, 0.06]], 8, MET.iron, PAT.METAL); B.pop();
  const p: any = B.wp(0, 0.18, 0.14);
  B.pop();
  return kfire(id, 'ghost', p.x, p.y, p.z, { s: 0.42, lit: true, ug: true, zone: 'crypt', int: 3.2, range: 7, label: 'a ghost-light' });
}
function dressCrypt() : any {
  const D: any = SITES.barrowDoor; if (!D || !UGP.crypt) return;
  const { yL }: any = UGP.crypt, dx: any = D.x, dz: any = D.z, C: any = UGP.cryptC;
  ugIn('crypt', () => {
    B.reset(); B.to(ugBatch('crypt')); B.occ = 0;
    // lintel stones over the inner end of the doorway
    box(dx - 1.25, D.y + 2.35, dz, 0.6, 0.5, 3.0, 0x8a887e, PAT.STONE);
    // ghost-lights down the passage
    ghostSconce('crypt0', dx - 3.9, yL + 1.7, dz - 1.12, 0);
    ghostSconce('crypt1', dx - 6.4, yL + 1.7, dz + 1.12, PI);
    B.push(0, yL, 0, 0);   // everything below is relative to the crypt floor
    // the niches: shelves of bones and the founders' urns
    for (const sd of [-1, 1]) {
      const nz: any = dz + sd * 3.25;
      for (const hy of [0.45, 1.25]) {
        box(dx - 5.0, hy, nz, 1.5, 0.08, 0.5, 0x8a887e, PAT.STONE);
        for (let i: any = 0; i < 3; i++) { const x: any = dx - 5.55 + i * 0.55; if (R() < 0.5) skull(x, hy + 0.04, nz, sd > 0 ? PI : 0, 1.1); else lathe(x, hy + 0.04, nz, [[0.001, 0], [0.1, 0], [0.14, 0.12], [0.1, 0.26], [0.07, 0.3], [0.001, 0.3]], 9, pick([0x8a6a4a, 0x6a5a4a, 0x9a8a6a]), PAT.NOISE); }
      }
      bones(dx - 5.0, dz + sd * 2.6, 5, 0.9);
    }
    // the chamber: four squat pillars, the names of the founders, and Ada's tomb
    for (const [ox, oz] of [[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]]) {
      box(C.x + ox, 0, C.z + oz, 0.62, 3.1, 0.62, 0x8e8c80, PAT.STONE, { occ: 1 });
      box(C.x + ox, 2.75, C.z + oz, 0.84, 0.3, 0.84, 0x7e7c70, PAT.STONE);
      colBox(C.x + ox, C.z + oz, 0.66, 0.66, -0.2, 3);
    }
    for (let k: any = 0; k < 7; k++) { const a: any = PI * 0.62 + (k / 6) * PI * 0.76, r: any = 3.35; box(C.x + Math.cos(a) * r, 1.5, C.z + Math.sin(a) * r, 0.5, 0.16, 0.03, 0xd8d0b0, 0, { ry: -a + PI / 2, em: -0.8, occ: 0 }); }
    // Ada's tomb: a stone chest, her effigy holding a lantern to her breast
    box(C.x, 0, C.z, 2.3, 0.85, 1.05, 0xa09e90, PAT.STONE);
    box(C.x, 0.85, C.z, 2.45, 0.1, 1.15, 0x8e8c80, PAT.STONE);
    box(C.x - 0.1, 0.95, C.z, 1.6, 0.18, 0.5, 0xb0ae9e, PAT.STONE);
    ball(C.x + 0.85, 1.08, C.z, 0.16, 0xb0ae9e, PAT.STONE);
    for (const sd of [-1, 1]) box(C.x - 0.6, 0.98, C.z + sd * 0.12, 0.9, 0.06, 0.1, 0xb0ae9e, PAT.STONE);
    box(C.x + 0.25, 1.13, C.z, 0.18, 0.2, 0.18, 0xc0b89a, PAT.STONE);
    colBox(C.x, C.z, 2.5, 1.2, -0.2, 1.2);
    for (const [ox, oz] of [[-1.35, -0.7], [-1.35, 0.7], [1.35, -0.7], [1.35, 0.7]]) { cyl(C.x + ox, 0, C.z + oz, 0.07, 0.09, 0.85, 6, 0x8a887e, PAT.STONE); cyl(C.x + ox, 0.85, C.z + oz, 0.03, 0.035, 0.18, 6, 0xf1e4c0); }
    rubble(C.x - 2.6, C.z + 2.4, 6, 0.5, 0x7a786c); rubble(C.x + 1.2, C.z - 2.9, 5, 0.4, 0x7a786c);
    B.pop();
    { const p: any = B.wp(C.x - 1.62, yL + 0.55, C.z); kfire('ada', 'ghost', p.x, p.y, p.z, { s: 0.6, lit: false, ug: true, zone: 'crypt', int: 4, range: 8, label: 'the founders’ candles', locked: 'slabOpen' }); }
    UGP.adaTomb = { x: C.x, z: C.z, y: yL };
    light(C.x, yL + 2.6, C.z, { color: 0x8ab0d8, int: 1.2, range: 7, flick: 0.03, glow: 0, prio: 0 });
    cobweb(dx - 7.4, yL + 2.5, dz - 1.1, -PI / 4, 0.8);
  });
  // a wall that was never there: built the same as the passage walls, it melts under Reveal
  { const x: any = dx - 6.95, b: any = new Batch(true);
    withLocal(() => { B.to(b); B.occ = 0; box(x, yL - 0.05, dz, 0.55, 2.75, 2.5, 0x9a988a, 200 + PAT.STONE); for (let i: any = 0; i < 5; i++) box(x + 0.29, yL + 0.3 + i * 0.5, dz + rnd(-0.8, 0.8), 0.02, 0.06, rnd(0.3, 0.8), 0x7a786c, 200, { occ: 0 }); });
    const m: any = new THREE.Mesh(b.toGeometry(), UGMAT); m.matrixAutoUpdate = false; m.userData.ug = 'crypt'; m.visible = false; scene.add(m); UGM.push(m);
    const col: any = addColW(x, dz, 0.3, 1.25, 1, 0, yL - 0.5, yL + 2.7, 'ug');
    UGP.cryptWall = { x, z: dz, y: yL, mesh: m, col };
  }
}

// walls dressed as they're raised
function tunnelDress(r: any, a: any, b: any, nix: any, niz: any, ya: any, yb: any) : any {
  if (r.stairs) return;
  timberFrame(a, b, nix, niz, ya, yb, Math.min(r.h, 2.5), 3.2);
}
function caveDress(r: any, a: any, b: any, nix: any, niz: any, ya: any, yb: any) : any {
  // lumpy rock against the wall so the cave never reads as a box
  const L: any = Math.hypot(b[0] - a[0], b[1] - a[1]), n: any = Math.max(1, Math.round(L / 1.1));
  for (let i: any = 0; i < n; i++) {
    const t: any = (i + rnd(0.2, 0.8)) / n, x: any = lerp(a[0], b[0], t) + nix * rnd(0.05, 0.3), z: any = lerp(a[1], b[1], t) + niz * rnd(0.05, 0.3), y: any = lerp(ya, yb, t);
    const s: any = rnd(0.55, 1.1), hh: any = rnd(0.5, 1.0) * r.h;
    B.ud = { fy: y, ax: 0, az: 0, nx: nix, nz: niz, k: 1 };
    sph(x - nix * s * 0.45, y - 0.2, z - niz * s * 0.45, s, vary(0x857d72, 0.12), PAT.ROCK, { det: 1, jit: 0.3, sy: hh / s * 0.62, ry: rnd(0, TAU), occ: 0 });
    B.ud = UD0;
  }
}

// does any underground wall poke out of the hillside? (logged for testing)
function ugCheckDepth() : any {
  const bad: any = [];
  for (const r of UGR) {
    if (!r.wall || r.zone === null) continue;
    for (const p of r.pts) {
      const top: any = Math.min(ugFloorAt(r, p[0], p[1]) + r.h, r.ceil), th: any = terrainH(p[0], p[1]);
      if (top > th - 0.15 && !inCarve(p[0], p[1], undefined, true) && !inMouth(p[0], p[1])) {
        let inB: any = false; for (const b of BUILDINGS) if (b.footprint && pip(b.footprint, p[0], p[1])) inB = true;
        if (!inB) bad.push(`${r.zone}@${p[0].toFixed(1)},${p[1].toFixed(1)} top ${top.toFixed(2)} ground ${th.toFixed(2)}`);
      }
    }
  }
  if (bad.length) console.warn('underground pokes out:', bad.slice(0, 12).join(' | '));
  UGP.depthIssues = bad.length;
}

// ---- dressing: the cellar ---------------------------------------------------------------------
function dressCellar(I: any, P: any, CY: any, CC: any) : any {
  ugIn('cellar', () => {
    // stairs down from the taproom, built in the inn's own frame
    I.frame(); B.to(ugBatch('cellar')); B.occ = 0;
    stairs(3.2, -4.02, PI / 2, 1.35, 4.4, CY - P, I.levels[0], { open: 'L', c: WOOD.mid });
    I.frame(); B.to(ugBatch('cellar')); B.occ = 0;
    B.push(0, CY - P, 0, 0);
    const H: any = CC - CY;
    // stone pillars holding up the taproom
    for (const [x, z] of [[-2.6, 0.3], [2.3, 0.3]]) {
      box(x, 0, z, 0.66, H, 0.66, 0x8a8070, PAT.STONE, { occ: 1 });
      box(x, H - 0.3, z, 0.86, 0.3, 0.86, 0x7a7062, PAT.STONE, { occ: 1 });
      box(x, 0, z, 0.86, 0.25, 0.86, 0x7a7062, PAT.STONE, { occ: 0 });
      colBox(x, z, 0.7, 0.7, 0, H);
      wallLantern(x, 1.75, z + 0.33, 0, { night: 0, int: 4.5, range: 8 });
    }
    // barrels racked along the north wall, wine down the west wall either side of the old door
    barrelRack(-4.65, -4.1, 0, 3, 2); barrelRack(-1.85, -4.1, 0, 3, 2);
    wineRack(-6.32, -2.75, PI / 2, 2.2, 2.3); wineRack(-6.32, 2.75, PI / 2, 2.2, 2.3);
    { // the rack that hides the tunnel — swung open on its hinge
      const ry: any = PI / 2 - 1.3, hx: any = -6.32, hz: any = 1.3;
      wineRack(hx + 1.1 * Math.cos(ry), hz - 1.1 * Math.sin(ry), ry, 2.2, 2.3, { empty: 0.5 });
      box(hx, 0, hz, 0.12, 2.3, 0.12, MET.iron, PAT.METAL);
    }
    // kegs and casks in the east end, crates under the high end of the stair
    barrel(5.85, 1.1, { h: 1.25, r: 0.52 }); barrel(5.85, 2.55, { h: 1.25, r: 0.52 }); barrel(4.65, 3.45, { h: 0.9, r: 0.36 });
    for (const z of [1.1, 2.55]) { box(5.3, 0.55, z, 0.12, 0.1, 0.1, MET.brass, PAT.METAL); }
    crate(4.55, -4.15, 0.2, 0.62); crate(5.35, -4.05, -0.25, 0.55); crate(5.0, -4.1, 0.5, 0.42, { y: 0.62, nocol: true });
    // shelves of preserves, sacks of flour, the cellarman's table
    shelfUnit(-3.6, 3.78, PI, 2.2, 2.0); shelfUnit(-1.1, 3.78, PI, 2.0, 2.0);
    wallShelf(2.1, 1.25, 3.95, PI, 1.6, 'jars');
    for (let i: any = 0; i < 4; i++) cyl(1.5 + i * 0.4, 1.29, 3.95, 0.16, 0.16, 0.12, 12, 0xe0b84a, PAT.NOISE);
    sack(3.3, 3.62); sack(3.85, 3.35, 1.0, 0xb8a47a); sack(3.55, 2.85, 2.0); sack(3.0, 3.1, 0.4, 0xd8ccb0);
    table(1.6, 1.9, 0, 1.7, 0.8, { c: WOOD.dark });
    candle(1.1, 0.79, 1.75, { light: true, int: 2.2, range: 5 });
    box(1.75, 0.79, 1.95, 0.42, 0.06, 0.3, 0x6a2a1a, PAT.NOISE, { ry: 0.2 }); box(1.75, 0.85, 1.95, 0.4, 0.01, 0.28, 0xefe4c8, 0, { ry: 0.2 });
    mug(2.2, 0.79, 1.7); bottle(2.05, 0.79, 2.15, 0x2a3f1a);
    hangingMeat(-2.2, H - 0.12, 2.4, 4); hangingMeat(-0.1, H - 0.12, -1.2, 3, 0.3);
    // a mousetrap baited with cheese, and plenty of cobwebs
    box(-5.1, 0, 0.1, 0.25, 0.03, 0.12, WOOD.light, PAT.PLANK); box(-5.1, 0.03, 0.1, 0.22, 0.02, 0.02, MET.steel); box(-5.0, 0.03, 0.12, 0.06, 0.05, 0.05, 0xe0b84a);
    cobweb(-6.55, H - 0.1, -4.65, PI / 4, 1.1); cobweb(6.55, H - 0.1, 4.05, -PI * 0.75, 0.9); cobweb(-6.55, H - 0.1, 4.05, PI * 0.75, 0.8);
    rug(0.1, -0.9, 0, 1.4, 2.6, 0x5a3a2a);
    B.pop();
  });
  UGP.dunstan = I.localY(-3.3, CY - P, -2.55);
  UGP.cellarRats = [[-5.7, -2.7], [-5.7, -0.7], [-4.2, 3.3], [0.6, 3.35]].map((p: any) => [...I.local(p[0], p[1]), CY]);
}

// ---- dressing: Orrin's undercroft ---------------------------------------------------------------------
function dressVault(T: any, PT: any, VY: any) : any {
  const wallPos: any = (k: any, inset: any = 0.25) => { const a: any = k * PI / 4, d: any = 4.6 * Math.cos(PI / 8) - 0.38 - inset; return [Math.sin(a) * d, Math.cos(a) * d, a + PI]; };
  ugIn('vault', () => {
    T.frame(); B.to(ugBatch('vault')); B.occ = 0;
    stairs(-2.55, 0, 0, 1.1, 4.5, VY - PT, T.levels[0], { open: 'R', c: 0x5d5f6c });
    T.frame(); B.to(ugBatch('vault')); B.occ = 0;
    B.push(0, VY - PT, 0, 0);
    // the summoning circle and the Hearthstone's cradle, empty
    magicCircle(0.75, 0.2, 1.35, 0xa080ff);
    B.push(0.75, 0, 0.2, 0);
    cyl(0, 0, 0, 0.3, 0.38, 0.12, 8, 0x4a4c58, PAT.STONE, { r0: PI / 8 }); cyl(0, 0.12, 0, 0.14, 0.2, 0.75, 8, 0x5a5c68, PAT.STONE, { r0: PI / 8 });
    cyl(0, 0.87, 0, 0.26, 0.16, 0.1, 8, 0x4a4c58, PAT.STONE, { r0: PI / 8 }); colCirc(0, 0, 0.42, 0, 1.2);
    for (let i: any = 0; i < 5; i++) { const a: any = (i / 5) * TAU; cyl(Math.cos(a) * 0.15, 0.97, Math.sin(a) * 0.15, 0.012, 0.02, 0.26, 4, MET.iron, PAT.METAL, { rz: Math.cos(a) * 0.45, rx: -Math.sin(a) * 0.45 }); }
    torus(0, 1.0, 0, 0.13, 0.02, 4, 12, MET.brass, PAT.METAL, { rx: PI / 2 });
    B.pop();
    // three tall candles on an iron stand beside the cradle: they were burning when it happened
    B.push(1.95, 0, -0.55, 0.4);
    cyl(0, 0, 0, 0.18, 0.22, 0.06, 8, MET.iron, PAT.METAL); cyl(0, 0.06, 0, 0.025, 0.03, 1.05, 6, MET.iron, PAT.METAL);
    box(0, 1.1, 0, 0.5, 0.03, 0.06, MET.iron, PAT.METAL);
    for (const k of [-0.21, 0, 0.21]) cyl(k, 1.12, 0, 0.03, 0.032, 0.22 + Math.abs(k) * 0.3, 6, 0xf1e4c0);
    colCirc(0, 0, 0.25, 0, 1.4);
    { const p: any = B.wp(0, 1.42, 0); kfire('vault', 'candle', p.x, p.y, p.z, { s: 0.55, lit: false, ug: true, zone: 'vault', int: 3, range: 6, label: 'the candles by the cradle', memory: 'vault' }); }
    B.pop();
    light(0.75, 1.6, 0.2, { color: 0x8a70d8, int: 2.5, range: 7, flick: 0.06, glow: 0.4, prio: 3 });
    // the invisible hat, on top of the bookshelf, for those who look properly
    { const [x, z, a]: any = wallPos(4, 0.45); B.push(x, 2.52, z, a); UGP.hatInvisible = B.wp(0, 0, 0); B.pop(); }
    // books, a strongbox, jars of things best not named
    { const [x, z, a]: any = wallPos(4, 0.2); bookshelf(x, z, a, { w: 1.9, h: 2.5, n: 6, c: 0x3a2a3a }); }
    { const [x, z, a]: any = wallPos(0, 0.5); chest(x - 0.4, z, a, 0x4a2a3a); coinPile(x + 0.75, z - 0.15, 0.3); }
    { const [x, z, a]: any = wallPos(7, 0.2); wallShelf(x, 1.15, z, a, 1.5, 'jars'); wallShelf(x, 1.7, z, a, 1.5, 'bottles'); }
    { const [x, z]: any = wallPos(1, 0.75); crystalCluster(x, z, 0.9, 0x7ac8ff, { int: 3.5 }); }
    for (const k of [0, 1, 3, 4, 7]) { const [x, z, a]: any = wallPos(k, -0.02); if (k === 4) continue; B.push(x, 1.55, z, a + PI); box(0, 0, -0.04, 0.42, 0.62, 0.08, 0x3e4050, PAT.STONE); box(0, 0.12, 0.005, 0.16, 0.32, 0.02, 0x8ab0ff, 0, { em: 1.8, occ: 0 }); B.pop(); }
    { const [x, z]: any = wallPos(3, 0.95); cage(x, z, 0.62, 1.75); UGP.imp = T.localY(x, VY - PT, z); }
    rug(0.75, 0.2, 0, 3.3, 3.3, 0x2a1e3a);
    { const [x, z, a]: any = wallPos(6, 0.15); torchSconce(x, 1.6, z, a + PI, { color: 0x8a6aff, int: 3 }); }
    B.pop();
  });
}

// ---- dressing: tunnels and the smugglers' den ---------------------------------------------------------------
function dressTunnels(den: any, DY: any, cA: any, cB: any, cC: any) : any {
  const [dx, dz]: any = den;
  ugIn('den', () => {
    B.reset(); B.to(ugBatch('den')); B.occ = 0; B.push(0, DY, 0, 0);
    const tx: any = dx - 1.0, tz: any = dz + 1.0;    // card table in the south-west corner
    table(tx, tz, 0.08, 1.5, 0.9);
    stool(tx - 0.95, tz + 0.1); stool(tx + 0.95, tz + 0.05); stool(tx, tz + 0.85);
    for (let i: any = 0; i < 8; i++) box(tx + rnd(-0.55, 0.55), 0.79, tz + rnd(-0.3, 0.3), 0.09, 0.006, 0.13, pick([0xf4ecd8, 0xe8dcc0, 0xd84a3a]), 0, { ry: rnd(0, 3), occ: 0 });
    for (let i: any = 0; i < 6; i++) cyl(tx - 0.3 + rnd(-0.2, 0.2), 0.79, tz + 0.15 + rnd(-0.15, 0.15), 0.035, 0.035, 0.012 + i * 0.012, 7, MET.gold, PAT.METAL);
    candle(tx + 0.45, 0.79, tz - 0.25, { light: true, int: 2.6, range: 5 });
    bottle(tx - 0.45, 0.79, tz + 0.25, 0x3a1a10); mug(tx + 0.3, 0.79, tz + 0.3);
    barrel(dx - 2.6, dz + 2.05); barrel(dx - 1.95, dz + 2.2, { h: 0.7, r: 0.27 });
    crate(dx - 2.6, dz - 0.35, 0.2, 0.6); crate(dx - 2.6, dz - 0.35, 0.6, 0.45, { y: 0.6, nocol: true });
    crate(dx + 2.5, dz - 1.95, 0.1, 0.7); crate(dx + 1.75, dz - 2.0, -0.2, 0.5); sack(dx + 2.6, dz - 1.2, 0.3);
    // a bedroll, a map of the tunnels and a lantern on a post
    rug(dx + 1.0, dz + 2.05, 0, 1.9, 0.8, 0x4a3a5a); box(dx + 0.3, 0.01, dz + 2.05, 0.4, 0.14, 0.6, 0xd8ccb0, PAT.NOISE);
    box(dx - 1.6, 0.9, dz - 2.56, 1.3, 0.85, 0.02, 0xe8dcb8, PAT.NOISE);
    for (const [a, b] of [[[-0.5, 0.2], [0.4, -0.1]], [[0.4, -0.1], [0.5, 0.3]], [[-0.1, 0.05], [-0.2, -0.3]]]) {
      const x0: any = dx - 1.6 + a[0], y0: any = 1.32 + a[1], x1: any = dx - 1.6 + b[0], y1: any = 1.32 + b[1];
      box((x0 + x1) / 2, (y0 + y1) / 2, dz - 2.54, Math.hypot(x1 - x0, y1 - y0), 0.025, 0.01, 0x8a2a1a, 0, { rz: Math.atan2(y1 - y0, x1 - x0), occ: 0 });
    }
    sph(dx - 1.1, 1.62, dz - 2.53, 0.04, 0xc82a2a, 0, { det: 0, sz: 0.4 });
    postLantern(dx + 1.4, dz - 0.9, 0.6);
    cobweb(dx + 3.15, 2.8, dz - 2.55, -PI / 4, 0.9);
    B.pop();
  });
  ugIn('tunnels', () => {
    B.reset(); B.to(ugBatch('tunnels')); B.occ = 0;
    // lanterns on the walls, roughly every other stretch
    for (const r of UGR) {
      if (r.zone !== 'tunnels' || !r.seg || r.stairs) continue;
      const s: any = r.seg, L: any = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      if (L < 3.5) continue;
      const ux: any = (s.b[0] - s.a[0]) / L, uz: any = (s.b[1] - s.a[1]) / L, nlx: any = -uz, nlz: any = ux;
      const t: any = 0.5, x: any = lerp(s.a[0], s.b[0], t) + nlx * (s.w / 2 - 0.05), z: any = lerp(s.a[1], s.b[1], t) + nlz * (s.w / 2 - 0.05);
      wallLantern(x, lerp(s.ya, s.yb, t) + 1.85, z, Math.atan2(-nlx, -nlz), { night: 0, int: 4, range: 8 });
    }
    // crates and casks left along the way
    const along: any = (a: any, b?: any, t?: any, side?: any, w?: any) => { const L: any = Math.hypot(b[0] - a[0], b[1] - a[1]), nx: any = -(b[1] - a[1]) / L, nz: any = (b[0] - a[0]) / L; return [lerp(a[0], b[0], t) + nx * side * w, lerp(a[1], b[1], t) + nz * side * w]; };
    { const [x, z]: any = along(cA, cB, 0.25, 1, 0.75); B.push(0, lerp(UGP.DY, UGP.DY + 0.35, 0.25), 0, 0); crate(x, z, 0.3, 0.6); crate(x + 0.1, z - 0.6, -0.2, 0.45); B.pop(); }
    { const [x, z]: any = along(cB, cC, 0.7, -1, 0.7); B.push(0, lerp(UGP.DY + 0.35, UGP.DY + 0.75, 0.7), 0, 0); barrel(x, z); B.pop(); }
    // where the north tunnel caved in: a fallen beam and a wall of rubble (a flare will shift it)
    { const [x, z]: any = UGP.collapse, y: any = lerp(UGP.DY + 0.35, UGP.DY + 0.75, 0.48);
      const rb: any = new Batch(true), cols: any = [];
      withLocal(() => {
        B.to(rb); B.occ = 0;
        for (let i: any = 0; i < 9; i++) sph(x + rnd(-1.0, 1.0), y + rnd(0.1, 1.4), z + rnd(-0.5, 0.5), rnd(0.35, 0.6), vary(0x6e6458, 0.1), PAT.ROCK, { det: 1, jit: 0.3, sy: 0.8, occ: 0 });
        rubble(x, z, 18, 1.1, 0x6a5e50);
        B.push(x + 0.2, y + 0.9, z - 0.2, 0.5, 0, 0.35); box(0, 0, 0, 2.6, 0.2, 0.2, WOOD.dark, PAT.BARK); B.pop();
      });
      const m: any = new THREE.Mesh(rb.toGeometry(), UGMAT); m.matrixAutoUpdate = false; m.userData.ug = 'tunnels'; m.visible = false; scene.add(m); UGM.push(m);
      cols.push(addColW(x, z, 1.3, 0.6, 1, 0, y - 0.5, y + 2.6, 'ug'));
      BREAKABLES.push({ id: 'collapse', x, z, y, r: 1.4, mesh: m, cols, ug: true, broken: false });
      B.push(0, y, 0, 0); boulder(x + 1.6, z + 0.9, 0.5, 0x6e6458, { y: 0 }); B.pop(); }
    { const x: any = -16.4, z: any = -44.2, y: any = UGP.DY + 0.75; B.push(0, y, 0, 0); sack(x + 0.3, z, 0.4, 0x5a4a3a); B.pop(); UGP.nettleSack = { x, z, y }; }
    cobweb(cB[0] - 1.1, UGP.DY + 2.6, cB[1] + 0.4, PI / 2, 0.9);
  });
  UGP.ratRuns = [
    [[cA[0], cA[1] - 0.5, UGP.DY], [cB[0] - 0.6, cB[1], UGP.DY + 0.35]],
    [[-9.6, -21.6, UGP.CY + 0.05], [-12.2, -22.4, UGP.CY + 0.12]],
    [[-21.4, -28.6, lerp(UGP.DY, UGP.VY, 0.4)], [-24.6, -30.6, UGP.VY]],
  ];
}

// ---- dressing: the troll's cave ---------------------------------------------------------------------------------
function dressCave(F: any) : any {
  ugIn('cave', () => {
    B.reset(); B.to(ugBatch('cave')); B.occ = 0; B.push(0, F, 0, 0);
    // the troll's nest against the back wall, his club, his supper and his hoard
    const tx: any = -6.2, tz: any = -66.0;
    UGP.troll = { x: tx, y: F, z: tz };
    lathe(tx, -0.02, tz + 0.3, [[0.001, 0], [2.5, 0], [2.3, 0.22], [1.6, 0.38], [0.001, 0.32]], 16, 0xb89a52, PAT.STRAW, { sx: 1.25 });
    for (let i: any = 0; i < 4; i++) box(tx + rnd(-1.6, 1.6), 0.3, tz + rnd(-0.4, 1.4), rnd(0.8, 1.3), 0.08, rnd(0.6, 1.0), pick([0x4a3a2a, 0x6a5a48, 0x3a2e24]), PAT.NOISE, { ry: rnd(0, 3), rx: rnd(-0.1, 0.1) });
    B.push(tx + 3.0, 0, tz - 0.7, -0.4, 0, 0.25);   // the club, leaning on the wall
    cyl(0, 0, 0, 0.13, 0.09, 2.2, 7, 0x6a4a30, PAT.BARK); sph(0, 2.15, 0, 0.32, 0x5a3e28, PAT.BARK, { det: 1, jit: 0.25, sy: 1.4 });
    for (let i: any = 0; i < 5; i++) cyl(0, 1.9 + i * 0.12, 0, 0.0, 0.07, 0.22, 4, 0x8a8a8a, PAT.METAL, { rz: PI / 2, ry: i * 1.3 });
    B.pop();
    colCirc(tx + 3.0, tz - 0.7, 0.3, -0.5, 2.5);
    bones(tx - 2.6, tz + 1.4, 7); bones(tx + 2.3, tz + 2.3, 5); skull(tx + 1.3, 0.3, tz + 2.6, 0.6, 1.8);
    // campfire with a pumpkin on the spit
    const fx: any = -5.3, fz: any = -61.4;
    for (let i: any = 0; i < 9; i++) { const a: any = (i / 9) * TAU; sph(fx + Math.cos(a) * 0.62, 0.05, fz + Math.sin(a) * 0.62, 0.17, vary(0x6a645c, 0.1), PAT.STONE, { det: 0, jit: 0.2, sy: 0.7 }); }
    fire(fx, 0.02, fz, 0.95, { int: 9, range: 10, color: 0xff7a2a, kf: 'troll_fire', lit: false, label: 'the troll\u2019s fire' });
    for (const s of [-1, 1]) { B.push(fx + s * 0.85, 0, fz, 0); cyl(0, 0, 0, 0.03, 0.04, 1.2, 5, WOOD.dark, PAT.BARK); cyl(0, 1.1, 0, 0.02, 0.03, 0.25, 4, WOOD.dark, 0, { rz: s * 0.5 }); B.pop(); }
    cyl(fx + 1.1, 1.12, fz, 0.03, 0.03, 2.2, 5, WOOD.mid, 0, { rz: PI / 2 });
    pumpkin(fx, 0.82, fz, 0.3, 0xc8561a);
    colCirc(fx, fz, 0.9, -0.5, 1.4);
    // stolen goods: a hill of pumpkins, a crate stencilled for Farmer Wil, festival lanterns
    const px: any = 0.1, pz: any = -60.4;
    for (let i: any = 0; i < 11; i++) { const a: any = rnd(0, TAU), d: any = rnd(0, 0.9); pumpkin(px + Math.cos(a) * d, i > 7 ? 0.3 : 0, pz + Math.sin(a) * d, rnd(0.2, 0.36), pick([0xd8661c, 0xe07a24, 0xc85a1a, 0xe8a03a])); }
    crate(px - 1.2, pz + 1.1, 0.4, 0.6); box(px - 1.2, 0.3, pz + 1.41, 0.36, 0.12, 0.01, 0x2a2018, 0, { ry: 0.4 });
    colCirc(px, pz, 1.0, -0.5, 1.2);
    // the hoard
    coinPile(-13.1, -63.6, 0.95);
    chest(-14.5, -62.0, 0.9, 0x5a3a24); chest(-11.9, -65.2, -0.6, 0x4a2a1a);
    B.push(-12.3, 0.02, -61.9, 0.7, 0, PI / 2 - 0.15); armorStand(0, 0, 0); B.pop();
    for (let i: any = 0; i < 3; i++) box(-14.0 + i * 0.35, 0.05, -64.8 + i * 0.2, 0.06, 0.02, 1.0, MET.steel, PAT.METAL, { ry: 0.6 + i * 0.5 });
    B.push(-15.0, 0.25, -64.2, 0.3, 1.2); cyl(0, 0, 0, 0.42, 0.42, 0.06, 12, 0x7a2a2a, PAT.NOISE); sph(0, 0.06, 0, 0.11, MET.gold, PAT.METAL, { det: 0, sy: 0.4 }); B.pop();
    colCirc(-13.1, -63.6, 1.1, -0.5, 1.0);
    // the missing sheep, penned with sticks
    fence([[-2.9, -55.4], [-2.9, -57.9], [-0.2, -57.9], [-0.2, -55.4], [-1.9, -55.4]], { c: 0x5a4a38, h: 0.8 });
    UGP.sheepPen = [-2.6, -57.6, -0.5, -55.7];
    // a still pool fed by drips
    { const x: any = -11.4, z: any = -58.4;
      for (let i: any = 0; i < 14; i++) { const a: any = (i / 14) * TAU; sph(x + Math.cos(a) * 1.6, 0.02, z + Math.sin(a) * 1.25, rnd(0.18, 0.32), vary(0x5f5850, 0.1), PAT.STONE, { det: 0, jit: 0.25, sy: 0.5 }); }
      cyl(x, -0.03, z, 1.55, 1.55, 0.05, 18, 0x10181a, 0, { sz: 0.78 });
      colCirc(x, z, 1.4, -0.5, 0.6);
      UGP.pool = { x, y: F + 0.05, z }; }
    // stalagmites, boulders and bones around the edges
    for (const [x, z, h] of [[-15.6, -55.6, 1.6], [-16.0, -58.6, 1.1], [-15.4, -64.6, 2.0], [-10.8, -67.5, 1.4], [-1.2, -66.4, 1.8], [1.0, -61.2, 1.2], [1.3, -56.6, 1.5], [-4.8, -53.6, 1.0], [-12.6, -53.9, 0.9], [-8.8, -57.4, 0.7], [-2.8, -63.4, 0.6]]) stalagmite(x, z, h);
    for (const [x, z, s] of [[-16.2, -61.2, 0.8], [1.6, -64.0, 0.9], [-0.4, -53.9, 0.7], [-9.6, -68.0, 0.9]]) boulder(x, z, s, 0x6a645c, { y: 0 });
    bones(-8.6, -55.6, 5); bones(-2.4, -64.6, 4); bones(MOUTH.x + 0.8, -52.0, 4);
    // glowing things
    mushrooms(-15.9, -59.6, 7, 0x5af0d0); mushrooms(1.3, -58.0, 6, 0x7af08a); mushrooms(-10.6, -53.4, 6, 0x5ad8f0, { int: 1.6 }); mushrooms(-1.8, -67.0, 6, 0x5af0d0);
    mushrooms(MOUTH.x - 1.3, MOUTH.z - 3.4, 4, 0x5af0d0, { int: 1.2 });
    crystalCluster(-14.8, -65.6, 1.2, 0xb07aff); crystalCluster(1.2, -62.6, 1.0, 0x7ab0ff, { int: 2.5 });
    // grey daylight spilling in at the mouth
    light(MOUTH.x, 2.4, MOUTH.z - 1.2, { color: 0xc8d8ff, int: 3.5, range: 8, glow: 0, flick: 0, day: 1, prio: 1 });
    B.pop();
  });
  UGP.bats = [[-7.0, -60.0, F + 2.8, 2.6], [-10.0, -63.5, F + 3.1, 2.0], [-2.5, -59.5, F + 2.6, 1.7], [-12.5, -57.0, F + 2.9, 1.4]];
}

// ---- the cave mouth on the mountainside (surface layer) --------------------------------------------
function signTexture() : any {
  const cv: any = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const g: any = cv.getContext('2d');
  g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, 256, 128);
  for (let i: any = 0; i < 5; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,220,170,0.07)'; g.fillRect(0, i * 26, 256, 2); }
  g.fillStyle = '#3a0f0a'; g.font = 'bold 58px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate(128, 50); g.rotate(-0.04); g.fillText('TROLL', 0, 0); g.restore();
  g.font = 'italic 26px Georgia, serif'; g.fillText('do not wake', 128, 100);
  const t: any = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function buildCaveMouth() : any {
  const F: any = MOUTH.F, mx: any = MOUTH.x, mz: any = MOUTH.z;
  B.reset(); B.to(OUT); B.occ = 1; B.ground = 0;
  // a rough arch: two standing stones and a lintel jammed across them
  for (const s of [-1, 1]) {
    sph(mx + s * 3.25, F + 0.6, mz + 0.7, 1.4, vary(0x7f786e, 0.06), PAT.ROCK, { det: 1, jit: 0.22, sy: 2.7, sx: 0.9, ry: s * 0.3, rz: -s * 0.1, occ: 1 });
    sph(mx + s * 4.3, F - 0.2, mz + 1.6, 1.1, vary(0x857e74, 0.06), PAT.ROCK, { det: 1, jit: 0.25, sy: 1.1, occ: 1 });
    addCircW(mx + s * 3.25, mz + 0.7, 1.2, F - 1, F + 5);
  }
  sph(mx, F + 5.6, mz + 0.2, 1.3, 0x7a736a, PAT.ROCK, { det: 1, jit: 0.2, sx: 3.0, sy: 0.6, sz: 1.0, occ: 1 });
  sph(mx - 2.0, F + 6.3, mz - 0.4, 1.1, 0x857e74, PAT.ROCK, { det: 1, jit: 0.25, sy: 0.8, occ: 1 });
  sph(mx + 2.1, F + 6.2, mz - 0.6, 1.0, 0x6f695f, PAT.ROCK, { det: 1, jit: 0.25, sy: 0.9, occ: 1 });
  for (let i: any = 0; i < 5; i++) cyl(mx - 1.6 + i * 0.8, F + 4.95, mz + 0.6, 0.0, 0.09, rnd(0.25, 0.6), 5, 0x6a645c, PAT.ROCK, { rx: PI, occ: 1 });
  // the cut behind the arch is roofed over with fallen slabs, so from above it reads as a hole in the cliff
  sph(mx - 0.2, F + 6.7, mz - 1.9, 1.5, vary(0x7c756b, 0.05), PAT.ROCK, { det: 1, jit: 0.22, sx: 2.4, sy: 0.85, sz: 1.7, ry: 0.12, occ: 1 });
  sph(mx + 0.6, F + 8.3, mz - 3.9, 1.4, vary(0x81796e, 0.05), PAT.ROCK, { det: 1, jit: 0.25, sx: 2.1, sy: 1.0, sz: 1.3, ry: -0.2, occ: 1 });
  sph(mx - 2.6, F + 7.6, mz - 2.6, 1.2, vary(0x766f65, 0.05), PAT.ROCK, { det: 1, jit: 0.25, sx: 1.2, sy: 1.1, sz: 1.5, occ: 1 });
  sph(mx + 2.7, F + 7.3, mz - 1.4, 1.1, vary(0x857e74, 0.05), PAT.ROCK, { det: 1, jit: 0.25, sx: 1.2, sy: 1.0, sz: 1.4, occ: 1 });
  // bones, a smashed cart wheel, pumpkin rinds and some very large footprints
  bones(mx + 2.2, mz + 3.4, 6); bones(mx - 3.4, mz + 4.6, 4, 0.8);
  B.push(mx - 3.6, gy(mx - 3.6, mz + 2.2) + 0.55, mz + 2.2, 0.9, 0.35, 0);
  torus(0, 0, 0, 0.55, 0.05, 4, 14, WOOD.dark, PAT.PLANK, { arc: PI * 1.3 });
  for (let i: any = 0; i < 4; i++) box(0, 0, 0, 0.05, 0.05, 1.05, WOOD.mid, 0, { ry: i * 0.8 });
  B.pop();
  for (let i: any = 0; i < 6; i++) { const x: any = mx + rnd(-2, 2.5), z: any = mz + rnd(2, 5); sph(x, gy(x, z) + 0.04, z, rnd(0.08, 0.16), pick([0xd8661c, 0xe07a24]), PAT.NOISE, { det: 0, sy: 0.35, ry: rnd(0, 3), occ: 0 }); }
  for (let k: any = 0; k < 4; k++) {
    const side: any = k % 2 ? 1 : -1, x: any = mx + side * 0.7 + rnd(-0.1, 0.1), z: any = mz + 7.6 - k * 1.9, a: any = rnd(-0.15, 0.15);
    const y: any = gy(x, z) + 0.006;
    cyl(x, y, z, 0.34, 0.34, 0.01, 12, 0x6e6a3a, PAT.NOISE, { sz: 1.6, ry: a, occ: 0 });
    for (let t: any = 0; t < 3; t++) cyl(x + (t - 1) * 0.18, y, z - 0.7, 0.08, 0.08, 0.01, 8, 0x6e6a3a, 0, { occ: 0 });
  }
  // the villagers' warning sign
  { const x: any = mx + 4.4, z: any = mz + 4.6, y: any = gy(x, z);
    cyl(x, y, z, 0.07, 0.09, 2.3, 6, WOOD.dark, PAT.BARK);
    colCirc(x, z, 0.15, y - 0.3, y + 2.3);
    const sign: any = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.62, 0.06), [
      new THREE.MeshStandardMaterial({ color: 0x5a3e26, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x5a3e26, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x5a3e26, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x5a3e26, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.85 }), new THREE.MeshStandardMaterial({ color: 0x5a3e26, roughness: 0.9 })]);
    sign.position.set(x, y + 1.75, z + 0.06); sign.rotation.set(-0.05, -0.55, 0.06); sign.castShadow = true; sign.receiveShadow = true;
    scene.add(sign); }
  // darkness at the back of the cut: a soft black curtain the eye reads as depth
  { const N: any = 64, cv: any = document.createElement('canvas'); cv.width = N; cv.height = N; const g: any = cv.getContext('2d');
    const img: any = g.createImageData(N, N);
    for (let j: any = 0; j < N; j++) for (let i: any = 0; i < N; i++) {
      const u: any = (i + 0.5) / N, v: any = 1 - (j + 0.5) / N;   // v: 0 at the bottom
      const a: any = sstep(0, 0.2, u) * sstep(0, 0.2, 1 - u) * sstep(0, 0.3, 1 - v);
      const o: any = (j * N + i) * 4; img.data[o] = 3; img.data[o + 1] = 2; img.data[o + 2] = 2; img.data[o + 3] = Math.round(255 * a);
    }
    g.putImageData(img, 0, 0);
    const tex: any = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const m: any = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 4.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true }));
    m.position.set(mx, F + 2.1, mz - 0.7); m.scale.set(1.05, 1.1, 1); m.renderOrder = 2;
    scene.add(m); UGP.curtain = m; }
  B.ground = -1;
}
