// ============================================================================
//  Building system: walls with openings, timber framing, floors with stair
//  holes, stairs, partitions, roofs. Every piece lands in a FadeGroup so the
//  cutaway system can ghost walls, hide upper floors and lift the roof.
// ============================================================================
type GeomWallSide = 'S' | 'N' | 'E' | 'W';
type GeomRail = [number, number, number, number];
type GeomOpenType = 'door' | 'window' | 'open';
interface GeomPlane { px: number; pz: number; nx: number; nz: number; tx: number; tz: number; hl: number }
interface GeomOpening { type?: GeomOpenType; x: number; w: number; b: number; h: number; frame?: GeomColor; glass?: string; shutters?: GeomColor; flowers?: boolean; openAng?: number; color?: GeomColor; d?: number }
interface GeomWallStyle { ext: GeomColor; extPat?: number; int: GeomColor; intPat?: number; timber?: GeomColor; plinth?: { h: number; c: GeomColor; pat?: number }; wainscot?: GeomColor; trim?: GeomColor; sill?: GeomColor }
interface GeomGableOptions { thick?: number; fascia?: GeomColor; ridge?: boolean; gables?: boolean; gableColor?: GeomColor; gablePat?: number; gableT?: number; timber?: GeomColor; gableWindow?: boolean }
interface GeomBuildOptions { interior?: boolean; ground?: boolean; floorY?: number; noBraces?: boolean }
interface GeomStair { from: number; x: number; z: number; ry: number; w: number; len: number; open?: 'L' | 'R' | 'both' | 'none'; c?: GeomColor; hx?: number; hz?: number; hw?: number; hl?: number; holeW?: number; rails?: GeomRail[] }
interface GeomPart { f: number; a: GeomVec2; b: GeomVec2; ops?: Array<Partial<GeomOpening> & { d: number }>; c?: GeomColor; pat?: number }
interface GeomCellar { hole: [number, number, number, number]; rails?: GeomRail[] }
interface GeomRoof { type: 'gable' | 'thatch' | 'hip'; axis?: 'x' | 'z'; pitch: number; oh: number; c: GeomColor; pat: number; h?: number; gableColor?: GeomColor; gablePat?: number; timber?: GeomColor; gableWindow?: boolean; fascia?: GeomColor }
interface GeomChimney { x: number; z: number; top: number; from?: number; w?: number; d?: number; c?: GeomColor; pat?: number }
interface GeomOctRoof { h: number; oh: number; c: GeomColor; pat: number }
interface GeomBuildingBase {
  id: string; name: string; sub?: string; levels: number[]; wallTop: number; floorNames?: string[];
  x: number; z: number; y?: number; rot?: number; t?: number; openAir?: boolean;
  style: GeomWallStyle; styleUp?: GeomWallStyle; open?: Record<string | number, [number, GeomOpening][]>;
  skipWall?: string[]; cellar?: GeomCellar; stairs?: GeomStair[]; parts?: GeomPart[];
  chimneys?: GeomChimney[]; found?: GeomColor; foundDepth?: number; floorC?: GeomColor; floorPat?: number;
  floorUpC?: GeomColor; quoin?: GeomColor; mapColor?: GeomColor; noPad?: boolean; padM?: number; padF?: number;
  onWall?: (b: Building, side: GeomWallSide | number, floor: number, grp: FadeGroup) => void;
  roofExtra?: (b: Building) => void; furnish?: (b: Building, floor: number) => void; exterior?: (b: Building) => void;
}
type GeomRectSpec = GeomBuildingBase & { w: number; d: number; R?: undefined; roof: GeomRoof };
type GeomOctSpec = GeomBuildingBase & { R: number; w?: undefined; d?: undefined; roof: GeomOctRoof };
type GeomBuildingSpec = GeomRectSpec | GeomOctSpec;
interface GeomDoor { mesh: THREE.Mesh; base: THREE.Matrix4; ang: number; target: number; x: number; y: number; z: number; open: number; grp: FadeGroup }

const BUILDINGS: Building[] = [];
const DOORS: GeomDoor[] = [];

function withLocal(fn: () => void) { // build into a fresh identity frame (for animated meshes)
  const m= B.m.clone(), st = B.st.slice(), tg = B.tgt;
  B.m.identity(); B.st.length = 0;
  try { fn(); } finally { B.m.copy(m); B.st = st; B.tgt = tg; }
}
function planeHere(hl: number = 99) {
  const p= B.wp(0, 0, 0), n = B.wdir(0, 0, 1), t = B.wdir(1, 0, 0);
  return { px: p.x, pz: p.z, nx: n.x, nz: n.z, tx: t.x, tz: t.z, hl };
}

class Building {
  declare s: GeomBuildingSpec;
  declare id: string;
  declare name: string;
  declare sub: string;
  declare levels: number[];
  declare wallTop: number;
  declare floorNames: string[];
  declare M: THREE.Matrix4;
  declare groups: FadeGroup[];
  declare base: FadeGroup;
  declare roof: FadeGroup;
  declare furn: FadeGroup[];
  declare slabs: FadeGroup[];
  declare walls: Array<Partial<Record<GeomWallSide | number, FadeGroup>>>;
  declare zone: GeomVec2[] | null;
  declare zoneOut: GeomVec2[] | null;
  declare mapColor: GeomColor;
  declare footprint: GeomVec2[] | null;
  constructor(s: GeomBuildingSpec) {
    this.s = s; this.id = s.id; this.name = s.name; this.sub = s.sub || '';
    this.levels = s.levels; this.wallTop = s.wallTop;
    this.floorNames = s.floorNames || ['Ground floor', 'Upper floor', 'Top floor'];
    this.M = new THREE.Matrix4().makeRotationY((s.rot || 0) * DEG).setPosition(s.x, s.y || 0, s.z);
    this.groups = [];
    this.base = this.group('base', { kind: 'base', floor: -1 });
    this.roof = this.group('roof', { kind: 'roof', floor: 99 });
    this.furn = []; this.slabs = []; this.walls = [];
    this.zone = null; this.zoneOut = null;
    this.mapColor = s.mapColor || 0x8a5a3a;
    this.footprint = null;
    BUILDINGS.push(this);
  }
  group(name: string, o: Omit<CoreFadeGroupOpts, 'side'> & { side?: GeomWallSide | number }) {
    const { side, ...rest }= o;
    const g= new FadeGroup({ name: this.id + ':' + name, building: this, ...rest });
    if (side !== undefined) Object.assign(g, { side });
    this.groups.push(g); return g;
  }
  furnGroup(f: number) { return this.furn[f] || (this.furn[f] = this.group('furn' + f, { kind: 'furn', floor: f })); }
  slabGroup(f: number) { return this.slabs[f] || (this.slabs[f] = this.group('slab' + f, { kind: 'slab', floor: f })); }
  local(x: number, z: number): GeomVec2 { const v= new V3(x, 0, z).applyMatrix4(this.M); return [v.x, v.z]; }
  localY(x: number, y: number, z: number) { return new V3(x, y, z).applyMatrix4(this.M); }
  floorOf(y: number) { let f= 0; for (let i= 0; i < this.levels.length; i++) if (y >= this.levels[i] + (this.s.y || 0) - 0.6) f = i; return f; }
  frame() { B.reset(this.M); return this; }
  // run fn inside the floor's furniture group with emitter context
  furnish(f: number, fn: (b: Building, f: number) => void) {
    this.frame();
    const g= this.furnGroup(f);
    B.to(g.batch); B.occ = 0;
    CTX.b = this; CTX.f = f; CTX.grp = g;
    B.push(0, this.levels[f], 0, 0);
    fn(this, f);
    B.pop();
    CTX.b = null; CTX.f = 0; CTX.grp = null; B.occ = 1;
  }
}

// --- wall with openings, built along local x in the current frame ---------
// st: { ext, extPat, int, intPat, timber, plinth:{h,c,pat}, wainscot, trim }
function buildWall(L: number, y0: number, y1: number, t: number, openings: GeomOpening[], st: GeomWallStyle, grp: FadeGroup, o: GeomBuildOptions = {}) {
  const ops= openings.slice().sort((a, b) => a.x - b.x);
  B.to(grp.batch);
  const H= y1 - y0;
  const piece= (xa: number, xb: number, ya: number, yb: number) => {
    const w= xb - xa, cx = (xa + xb) / 2, h = yb - ya;
    if (w < 0.005 || h < 0.005) return;
    if (o.interior) { box(cx, ya, 0, w, h - 0.02, t, st.int, st.intPat); }
    else {
      box(cx, ya, t / 4, w, h - 0.02, t / 2, st.ext, st.extPat, { ao: 0.18 });
      box(cx, ya, -t / 4, w, h - 0.02, t / 2, st.int, st.intPat);
    }
    if (Math.abs(yb - y1) < 0.01) box(cx, yb - 0.02, 0, w, 0.02, t, 0x2b2119, 0);  // dark section cap on wall tops
  };
  const segs= [];
  let cur= -L / 2;
  for (const op of ops) { const a= op.x - op.w / 2; if (a > cur + 0.002) segs.push([cur, a]); cur = op.x + op.w / 2; }
  if (cur < L / 2 - 0.002) segs.push([cur, L / 2]);
  for (const [a, b] of segs) { piece(a, b, y0, y1); colBox((a + b) / 2, 0, b - a, t, y0, y1); }
  const tz= t / 2 + 0.025, tc = st.timber;
  for (const op of ops) {
    const a= op.x - op.w / 2, b = op.x + op.w / 2;
    const ob= y0 + op.b, ot = Math.min(y1, ob + op.h);
    if (op.type === 'open') {
      if (ot < y1 - 0.01) piece(a, b, ot, y1);
      continue;
    }
    if (ob > y0 + 0.001) piece(a, b, y0, ob);
    if (ot < y1 - 0.001) piece(a, b, ot, y1);
    if (op.type === 'window') colBox(op.x, 0, op.w, t, y0, y1);
    // frame / trim around the opening (both faces)
    const fc= op.frame ?? st.trim ?? WOOD.dark, fw = 0.09;
    for (const s of [-1, 1]) box(op.x + s * (op.w / 2 + fw / 2 - 0.02), ob - (op.type === 'door' ? 0 : 0.05), 0, fw, ot - ob + (op.type === 'door' ? 0.08 : 0.12), t + 0.08, fc, PAT.PLANK);
    box(op.x, ot - 0.02, 0, op.w + 0.14, 0.12, t + 0.1, fc, PAT.PLANK);
    if (op.type === 'window') {
      box(op.x, ob - 0.08, 0.04, op.w + 0.22, 0.08, t + 0.18, st.sill ?? shade(fc, 1.1), PAT.PLANK);
      // mullions
      box(op.x, ob, 0, 0.05, ot - ob, 0.06, fc);
      if (op.h > 0.9) box(op.x, ob + (ot - ob) * 0.55, 0, op.w, 0.05, 0.06, fc);
      // glass
      const gb= grp.glass();
      const kind= op.glass || 'lead';
      box(op.x, ob, 0, op.w, ot - ob, 0.02, kind === 'stained' ? 0xffffff : 0xb9d3dc, kind === 'stained' ? PAT.STAINED : PAT.LEAD,
        { to: gb, uv: kind === 'stained' ? 2 : 1, em: kind === 'stained' ? -1.6 : -1.1, occ: 1 });
      if (op.shutters) for (const s of [-1, 1]) {
        B.push(op.x + s * (op.w / 2 + 0.02), ob, t / 2 + 0.02, s * -0.35);
        box(s * (op.w / 4 + 0.02), 0, 0.03, op.w / 2 + 0.04, ot - ob, 0.04, op.shutters, PAT.PLANK);
        box(s * (op.w / 4 + 0.02), (ot - ob) * 0.25, 0.055, op.w / 2 - 0.06, 0.05, 0.02, shade(op.shutters, 0.7));
        box(s * (op.w / 4 + 0.02), (ot - ob) * 0.7, 0.055, op.w / 2 - 0.06, 0.05, 0.02, shade(op.shutters, 0.7));
        B.pop();
      }
      if (op.flowers) flowerBox(op.x, ob - 0.3, t / 2 + 0.12, 0, op.w + 0.1);
    }
    if (op.type === 'door') {
      const dh= ot - ob, dw = op.w;
      const base= B.m.clone().multiply(new THREE.Matrix4().makeTranslation(op.x - dw / 2 + 0.02, ob, 0));
      const db= new Batch();
      withLocal(() => {
        B.to(db);
        const dc= op.color ?? WOOD.red;
        box(dw / 2 - 0.02, 0, 0, dw - 0.06, dh - 0.03, 0.07, dc, PAT.PLANK, { occ: 1 });
        for (const yy of [0.25, dh - 0.45]) box(dw / 2 - 0.02, yy, 0.045, dw - 0.16, 0.08, 0.02, MET.iron, PAT.METAL);
        box(dw - 0.2, dh * 0.47, 0.06, 0.05, 0.12, 0.04, MET.brass, PAT.METAL);
        box(dw - 0.2, dh * 0.47, -0.06, 0.05, 0.12, 0.04, MET.brass, PAT.METAL);
      });
      const mesh= new THREE.Mesh(db.toGeometry(), grp.mat);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(base);
      grp.extra.push(mesh);
      const c= B.wp(op.x, ob, 0);
      DOORS.push({ mesh, base, ang: 0, target: 0, x: c.x, y: c.y, z: c.z, open: op.openAng ?? 1.75, grp });
    }
  }
  // exterior timber framing
  if (tc && !o.interior) {
    const yb= y0 + (st.plinth && o.ground ? st.plinth.h : 0.0);
    box(0, yb, tz, L, 0.14, 0.05, tc, PAT.PLANK);
    box(0, y1 - 0.16, tz, L, 0.16, 0.05, tc, PAT.PLANK);
    const posts= new Set([-L / 2 + 0.07, L / 2 - 0.07]);
    for (const op of ops) { if (op.type !== 'open') { posts.add(op.x - op.w / 2 - 0.07); posts.add(op.x + op.w / 2 + 0.07); } }
    for (const [a, b] of segs) {
      const w= b - a;
      const n= Math.floor(w / 1.4);
      for (let k= 1; k <= n; k++) posts.add(a + (k * w) / (n + 1));
      if (w > 1.2 && w < 3.2 && !o.noBraces) {
        const len= Math.hypot(w * 0.5, y1 - yb - 0.3);
        const ang= Math.atan2(y1 - yb - 0.3, w * 0.5);
        box(a + w * 0.25, (yb + 0.14 + y1 - 0.16) / 2 - 0.03, tz, len * 0.92, 0.1, 0.05, tc, PAT.PLANK, { rz: ang * 0.97 });
        box(b - w * 0.25, (yb + 0.14 + y1 - 0.16) / 2 - 0.03, tz, len * 0.92, 0.1, 0.05, tc, PAT.PLANK, { rz: -ang * 0.97 });
      }
    }
    for (const op of ops) if (op.type === 'window') box(op.x, y0 + op.b - 0.2, tz, op.w + 0.3, 0.1, 0.05, tc, PAT.PLANK);
    for (const px of posts) if (px > -L / 2 - 0.01 && px < L / 2 + 0.01) box(px, yb, tz, 0.13, y1 - yb, 0.05, tc, PAT.PLANK);
  }
  if (st.plinth && o.ground) {
    let c2= -L / 2;
    const doorOps= ops.filter((op) => op.type === 'door' || op.type === 'open');
    for (const op of doorOps) { const a= op.x - op.w / 2; if (a > c2) box((c2 + a) / 2, y0 - 0.05, t / 2 + 0.03, a - c2, st.plinth.h + 0.05, 0.1, st.plinth.c, st.plinth.pat ?? PAT.STONE, { uv: 0 }); c2 = op.x + op.w / 2; }
    if (c2 < L / 2) box((c2 + L / 2) / 2, y0 - 0.05, t / 2 + 0.03, L / 2 - c2, st.plinth.h + 0.05, 0.1, st.plinth.c, st.plinth.pat ?? PAT.STONE);
  }
  if (st.wainscot && o.ground !== undefined) {
    let c2= -L / 2;
    const yl= y0 + (o.floorY ?? 0);
    for (const op of ops.filter((op) => op.type === 'door' || op.type === 'open')) { const a= op.x - op.w / 2; if (a > c2) box((c2 + a) / 2, yl, -t / 2 - 0.015, a - c2, 0.95, 0.03, st.wainscot, PAT.PLANK); c2 = op.x + op.w / 2; }
    if (c2 < L / 2) box((c2 + L / 2) / 2, yl, -t / 2 - 0.015, L / 2 - c2, 0.95, 0.03, st.wainscot, PAT.PLANK);
  }
}

// straight staircase rising along local +z (bottom at -len/2), open on 'side' ('L','R','both','none')
function stairs(x: number, z: number, ry: number, w: number, len: number, y0: number, y1: number, o: { open?: GeomStair['open']; c?: GeomColor } = {}) {
  B.push(x, 0, z, ry);
  const rise= y1 - y0, n = Math.max(4, Math.round(rise / 0.2)), run = len / n, dy = rise / n;
  const c= o.c ?? WOOD.mid;
  for (let i= 0; i < n; i++) {
    const zz= -len / 2 + (i + 0.5) * run;
    box(0, y0 + i * dy + dy - 0.06, zz, w, 0.06, run + 0.03, c, PAT.PLANK);
    box(0, y0 + i * dy, zz - run / 2 + 0.015, w - 0.06, dy, 0.03, shade(c, 0.75), PAT.PLANK);
  }
  const sl= Math.hypot(len, rise), ang = Math.atan2(rise, len);
  for (const s of [-1, 1]) {
    B.push(s * (w / 2 + 0.04), (y0 + y1) / 2 - 0.12, 0, 0, -ang);
    box(0, -0.15, 0, 0.08, 0.3, sl, shade(c, 0.7), PAT.PLANK);
    B.pop();
  }
  walkRamp(0, 0, w + 0.05, len, y0, y1, 0);
  const sides= o.open ?? 'R';
  for (const s of [-1, 1]) {
    const open= sides === 'both' || (sides === 'R' && s > 0) || (sides === 'L' && s < 0);
    if (!open) continue;
    const px= s * (w / 2 + 0.06);
    const np= Math.max(2, Math.round(len / 0.9));
    for (let k= 0; k <= np; k++) {
      const zz= -len / 2 + 0.1 + (k * (len - 0.2)) / np, yy = y0 + ((zz + len / 2) / len) * rise;
      box(px, yy, zz, 0.06, 0.95, 0.06, shade(c, 0.8));
    }
    B.push(px, (y0 + y1) / 2 + 0.95, 0, 0, -ang);
    box(0, -0.03, 0, 0.08, 0.06, sl, c, PAT.PLANK);
    B.pop();
    colBox(px, 0, 0.12, len, y0 - 0.5, y1 + 1.2);
  }
  B.pop();
}

// railing along a frame segment at floor height y (frame-relative)
function railing(x0: number, z0: number, x1: number, z1: number, y: number, c: GeomColor = WOOD.mid, collide: boolean = true) {
  const L= Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(-(z1 - z0), x1 - x0);
  B.push((x0 + x1) / 2, y, (z0 + z1) / 2, a);
  box(0, 0.9, 0, L + 0.06, 0.07, 0.08, c, PAT.PLANK);
  box(0, 0.06, 0, L, 0.05, 0.06, shade(c, 0.8));
  const n= Math.max(1, Math.round(L / 0.16));
  for (let k= 0; k <= n; k++) box(-L / 2 + (k * L) / n, 0.06, 0, k === 0 || k === n ? 0.08 : 0.035, 0.85, k === 0 || k === n ? 0.08 : 0.035, shade(c, 0.85));
  if (collide) colBox(0, 0, L + 0.1, 0.16, -0.2, 1.2);
  B.pop();
}

function chimney(x: number, z: number, y0: number, top: number, w: number = 0.9, d: number = 0.9, c: GeomColor = 0x8a8278, pat: number = PAT.STONE) {
  box(x, y0, z, w, top - y0, d, c, pat, { ao: 0.1 });
  box(x, top, z, w + 0.14, 0.12, d + 0.14, shade(c, 0.85), pat);
  cyl(x - w * 0.15, top + 0.12, z, 0.12, 0.13, 0.35, 6, 0x9a6a4a, 0);
  cyl(x + w * 0.18, top + 0.12, z + 0.05, 0.1, 0.11, 0.28, 6, 0x9a6a4a, 0);
  SMOKES.push({ p: B.wp(x - w * 0.15, top + 0.5, z), rate: 2.2, acc: rnd(0, 1) });
}

function gableRoof(W: number, D: number, y: number, pitch: number, oh: number, c: GeomColor, pat: number, o: GeomGableOptions = {}) {
  const t= o.thick ?? 0.16, ang = pitch * DEG;
  const half= D / 2 + oh, rise = (D / 2) * Math.tan(ang), ridgeY = y + rise, sl = half / Math.cos(ang);
  for (const s of [1, -1]) {
    B.push(0, ridgeY + 0.02, 0, s > 0 ? 0 : PI, ang);
    box(0, -t, sl / 2, W + 2 * oh, t, sl, c, pat, { uv: 3 });
    box(0, -t - 0.06, sl - 0.06, W + 2 * oh, 0.08, 0.12, shade(o.fascia ?? WOOD.dark, 1), PAT.PLANK);
    B.pop();
  }
  if (o.ridge !== false) {
    cyl(W / 2 + oh, ridgeY - 0.02, 0, 0.11, 0.11, W + 2 * oh, 6, shade(c, 0.75), pat === PAT.THATCH ? PAT.THATCH : PAT.NOISE, { rz: PI / 2 });
  }
  if (o.gables !== false) {
    const gc= o.gableColor ?? 0xe6d8b8, gp = o.gablePat ?? PAT.PLASTER, gt = o.gableT ?? 0.3;
    for (const s of [-1, 1]) {
      gable(s * (W / 2 - gt / 2), y, 0, D, rise, gt, gc, gp);
      if (o.timber) {
        B.push(s * (W / 2 + 0.03), y, 0, s > 0 ? PI / 2 : -PI / 2);
        box(0, 0, 0, 0.13, rise * 0.92, 0.05, o.timber, PAT.PLANK);
        box(0, rise * 0.42, 0, D * 0.55, 0.12, 0.05, o.timber, PAT.PLANK);
        for (const k of [-1, 1]) box(k * D * 0.17, 0.05, 0, 0.1, rise * 0.4, 0.05, o.timber, PAT.PLANK, { rz: k * 0.6 });
        B.pop();
      }
      if (o.gableWindow) {
        B.push(s * (W / 2 + 0.02), y + rise * 0.3, 0, s > 0 ? PI / 2 : -PI / 2);
        box(0, 0, 0.02, 0.62, 0.78, 0.06, WOOD.dark, PAT.PLANK);
        box(0, 0.06, 0.05, 0.48, 0.64, 0.02, 0xb9d3dc, PAT.LEAD, { to: B.tgt, uv: 1, em: -1.1 });
        B.pop();
      }
    }
  }
}
function hipRoof(W: number, D: number, y: number, pitch: number, oh: number, c: GeomColor, pat: number) {
  const hw= W / 2 + oh, hd = D / 2 + oh, tn = Math.tan(pitch * DEG);
  const yE= y - oh * tn, rise = Math.min(hw, hd) * tn, yR = yE + rise, th = 0.16;
  let A: GeomVec3, Bv: GeomVec3, C: GeomVec3, Dv: GeomVec3, R1: GeomVec3, R2: GeomVec3;
  if (W >= D) {
    const rx= hw - hd;
    A = [-hw, yE, hd]; Bv = [hw, yE, hd]; C = [hw, yE, -hd]; Dv = [-hw, yE, -hd]; R1 = [-rx, yR, 0]; R2 = [rx, yR, 0];
    quad(A, Bv, R2, R1, c, pat, { uv: 3 }); quad(C, Dv, R1, R2, c, pat, { uv: 3 });
    tris([...Bv, ...C, ...R2], c, pat, { uv: 3 }); tris([...Dv, ...A, ...R1], c, pat, { uv: 3 });
  } else {
    const rz= hd - hw;
    A = [-hw, yE, hd]; Bv = [hw, yE, hd]; C = [hw, yE, -hd]; Dv = [-hw, yE, -hd]; R1 = [0, yR, rz]; R2 = [0, yR, -rz];
    tris([...A, ...Bv, ...R1], c, pat, { uv: 3 }); tris([...C, ...Dv, ...R2], c, pat, { uv: 3 });
    quad(Bv, C, R2, R1, c, pat, { uv: 3 }); quad(Dv, A, R1, R2, c, pat, { uv: 3 });
  }
  const yb= yE - th, f = WOOD.dark;
  quad([-hw, yb, hd], [hw, yb, hd], [hw, yE, hd], [-hw, yE, hd], f, PAT.PLANK);
  quad([hw, yb, -hd], [-hw, yb, -hd], [-hw, yE, -hd], [hw, yE, -hd], f, PAT.PLANK);
  quad([hw, yb, hd], [hw, yb, -hd], [hw, yE, -hd], [hw, yE, hd], f, PAT.PLANK);
  quad([-hw, yb, -hd], [-hw, yb, hd], [-hw, yE, hd], [-hw, yE, -hd], f, PAT.PLANK);
  quad([-hw, yb, hd], [-hw, yb, -hd], [hw, yb, -hd], [hw, yb, hd], f, 0);
  box(0, yR - 0.05, 0, W >= D ? (hw - hd) * 2 + 0.2 : 0.2, 0.12, W >= D ? 0.2 : (hd - hw) * 2 + 0.2, shade(c, 0.75), PAT.NOISE);
}

// ---- generic rectangular building --------------------------------------
// spec.open: { S: [[floor, opening], ...], N, E, W }  opening.x is building-local (x for S/N, z for E/W)
function buildRect(s: GeomRectSpec) {
  const W= s.w, D = s.d, t = s.t ?? 0.3, L = s.levels, nF = L.length, ry = (s.rot || 0) * DEG;
  if (s.y === undefined) s.y = padLevel(s.x, s.z, ry, W / 2, D / 2);   // level the ground the building stands on
  if (!s.noPad) addPad({ x: s.x, z: s.z, ry, hx: W / 2, hz: D / 2, m: s.padM ?? 1.6, f: s.padF ?? 5, y: s.y });
  const b= new Building(s);
  b.footprint = [b.local(-W / 2, -D / 2), b.local(W / 2, -D / 2), b.local(W / 2, D / 2), b.local(-W / 2, D / 2)];
  const iw= W - 2 * t, id = D - 2 * t;
  const zIn= rectPts(0, 0, iw - 0.1, id - 0.1).map((p) => b.local(p[0], p[1]));
  const zOut= rectPts(0, 0, iw + 0.25, id + 0.25).map((p) => b.local(p[0], p[1]));
  b.zone = zIn; b.zoneOut = zOut;
  const sides: Record<GeomWallSide, { pos: GeomVec2; ry: number; len: number; conv: (v: number) => number }> = {
    S: { pos: [0, D / 2 - t / 2], ry: 0, len: W, conv: (x: number) => x },
    N: { pos: [0, -D / 2 + t / 2], ry: PI, len: W, conv: (x: number) => -x },
    E: { pos: [W / 2 - t / 2, 0], ry: PI / 2, len: D - 2 * t, conv: (z: number) => -z },
    W: { pos: [-W / 2 + t / 2, 0], ry: -PI / 2, len: D - 2 * t, conv: (z: number) => z },
  };
  const style= (f: number) => (f > 0 && s.styleUp) ? s.styleUp : s.style;
  // walls
  for (let f= 0; f < nF; f++) {
    const y0= f === 0 ? 0 : L[f], y1 = f + 1 < nF ? L[f + 1] : s.wallTop;
    b.walls[f] = {};
    for (const k of ['S', 'N', 'E', 'W'] as GeomWallSide[]) {
      const sd= sides[k];
      if (s.skipWall && s.skipWall.includes(k + f)) continue;
      b.frame();
      B.push(sd.pos[0], 0, sd.pos[1], sd.ry);
      const g= b.group(`w${f}${k}`, { kind: 'wall', floor: f, plane: planeHere(sd.len / 2), side: k, ghost: 0.12 });
      b.walls[f][k] = g;
      const ops= ((s.open && s.open[k]) || []).filter((e) => e[0] === f).map((e) => ({ ...e[1], x: sd.conv(e[1].x), b: L[f] + (e[1].b ?? 0) - y0 }));
      buildWall(sd.len, y0, y1, t, ops, style(f), g, { ground: f === 0, floorY: L[f] - y0 });
      const timber= style(f).timber, plinth: GeomWallStyle['plinth'] = style(f).plinth;
      if (timber && (k === 'S' || k === 'N')) {
        const tb= f === 0 && plinth ? plinth.h : y0;
        for (const e of [-1, 1]) box(e * (W / 2 - 0.08), tb, t / 2 + 0.03, 0.18, y1 - tb, 0.07, timber, PAT.PLANK);
      }
      if (s.onWall) s.onWall(b, k, f, g);
      B.pop();
    }
  }
  // foundation + ground floor boards
  b.frame(); B.to(b.base.batch);
  if (s.cellar) {
    // hollow foundation ring and a floor slab with the cellar stairwell left open
    const fo= s.found ?? 0x8b857a, ft = t + 0.06, fh = 0.6 + L[0] - 0.06;
    for (const sz of [-1, 1]) box(0, -0.6, sz * (D / 2 - ft / 2 + 0.06), W + 0.12, fh, ft, fo, PAT.STONE);
    for (const sx of [-1, 1]) box(sx * (W / 2 - ft / 2 + 0.06), -0.6, 0, ft, fh, D - 2 * ft + 0.14, fo, PAT.STONE);
    const [hx0, hz0, hx1, hz1]= s.cellar.hole, hole: GeomVec2[] = [[hx0, hz0], [hx1, hz0], [hx1, hz1], [hx0, hz1]];
    slab(rectPts(0, 0, iw, id), [hole], L[0] - 0.3, 0.3, s.floorC ?? WOOD.mid, s.floorPat ?? PAT.PLANK);
    walkPoly(rectPts(0, 0, iw + 0.02, id + 0.02), L[0], [hole]);
    addCarve(hole.map((p) => b.local(p[0], p[1])));
    B.to(b.furnGroup(0).batch); B.occ = 0;
    for (const r of s.cellar.rails || []) railing(r[0], r[1], r[2], r[3], L[0]);
    B.occ = 1; B.to(b.base.batch);
  } else {
    box(0, -(s.foundDepth ?? 0.6), 0, W + 0.12, (s.foundDepth ?? 0.6) + L[0] - 0.06, D + 0.12, s.found ?? 0x8b857a, PAT.STONE);
    box(0, L[0] - 0.06, 0, iw, 0.06, id, s.floorC ?? WOOD.mid, s.floorPat ?? PAT.PLANK);
    walkRect(0, 0, iw + 0.02, id + 0.02, L[0]);
  }
  // door steps (walkable thresholds + a stone step outside)
  for (const k of ['S', 'N', 'E', 'W'] as GeomWallSide[]) for (const e of (s.open && s.open[k]) || []) {
    if (e[0] !== 0 || e[1].type !== 'door') continue;
    const sd= sides[k];
    b.frame(); B.push(sd.pos[0], 0, sd.pos[1], sd.ry); B.to(b.base.batch);
    const x= sd.conv(e[1].x);
    walkRect(x, 0.1, e[1].w + 0.1, t + 0.25, L[0]);
    box(x, 0, t / 2 + 0.3, e[1].w + 0.5, L[0] * 0.5, 0.55, 0x9a948a, PAT.STONE);
    walkRect(x, t / 2 + 0.3, e[1].w + 0.5, 0.55, L[0] * 0.5);
    B.pop();
  }
  // upper slabs with stair holes
  for (let f= 1; f < nF; f++) {
    b.frame();
    const g= b.slabGroup(f); B.to(g.batch); B.occ = 0;
    const holes= (s.stairs || []).filter((st) => st.from === f - 1).map((st) => rectPts(st.hx ?? st.x, st.hz ?? st.z, st.hw ?? st.holeW ?? st.w + 0.3, st.hl ?? st.len));
    const outer= rectPts(0, 0, iw, id);
    slab(outer, holes, L[f] - 0.24, 0.24, s.floorUpC ?? WOOD.light, PAT.PLANK);
    walkPoly(outer, L[f], holes);
    B.occ = 1;
  }
  // stairs
  for (const st of s.stairs || []) {
    b.frame(); const g= b.furnGroup(st.from); B.to(g.batch); B.occ = 0;
    stairs(st.x, st.z, st.ry, st.w, st.len, L[st.from], L[st.from + 1], { open: st.open ?? 'R', c: st.c });
    B.occ = 1;
    if (st.rails) {
      const g2= b.furnGroup(st.from + 1); B.to(g2.batch); B.occ = 0;
      for (const r of st.rails) railing(r[0], r[1], r[2], r[3], L[st.from + 1]);
      B.occ = 1;
    }
  }
  // interior partitions
  for (const p of s.parts || []) {
    const [x0, z0]= p.a, [x1, z1] = p.b, len = Math.hypot(x1 - x0, z1 - z0);
    const ang= Math.atan2(-(z1 - z0), x1 - x0);
    b.frame(); B.push((x0 + x1) / 2, 0, (z0 + z1) / 2, ang);
    const g= b.group(`p${p.f}_${x0}_${z0}`, { kind: 'iwall', floor: p.f, plane: planeHere(len / 2), ghost: 0.2 });
    const y0= L[p.f] - 0.02, y1 = p.f + 1 < nF ? L[p.f + 1] - 0.24 : s.wallTop;
    buildWall(len, y0, y1, 0.16, (p.ops || []).map((o) => ({ type: 'door', h: 2.15, b: 0.02, w: 1.0, ...o, x: o.d - len / 2 })), { ext: style(p.f).ext, int: p.c ?? style(p.f).int, intPat: p.pat ?? style(p.f).intPat, trim: WOOD.dark }, g, { interior: true });
    B.pop();
  }
  // roof
  b.frame(); B.to(b.roof.batch);
  const r= s.roof;
  if (r.type === 'gable' || r.type === 'thatch') {
    if (r.axis === 'z') B.push(0, 0, 0, PI / 2);
    const RW= r.axis === 'z' ? D : W, RD = r.axis === 'z' ? W : D;
    gableRoof(RW, RD, s.wallTop, r.pitch, r.oh, r.c, r.pat, { thick: r.type === 'thatch' ? 0.42 : 0.16, gableColor: r.gableColor ?? s.style.ext, gablePat: r.gablePat ?? s.style.extPat, timber: r.timber, gableWindow: r.gableWindow, fascia: r.fascia });
    if (r.axis === 'z') B.pop();
  } else if (r.type === 'hip') hipRoof(W, D, s.wallTop, r.pitch, r.oh, r.c, r.pat);
  for (const ch of s.chimneys || []) { b.frame(); B.to(b.roof.batch); chimney(ch.x, ch.z, ch.from ?? s.wallTop - 0.5, ch.top, ch.w, ch.d, ch.c, ch.pat); }
  if (s.roofExtra) { b.frame(); B.to(b.roof.batch); s.roofExtra(b); }
  // furniture
  if (s.furnish) for (let f= 0; f < nF; f++) b.furnish(f, (bb: Building, ff: number) => s.furnish?.(bb, ff));
  if (s.exterior) { b.frame(); B.to(OUT); B.ground = 0; s.exterior(b); B.ground = -1; }
  return b;
}

// ---- octagonal tower ------------------------------------------------------
function buildOct(s: GeomOctSpec) {
  const Rr= s.R, t = s.t ?? 0.35, L = s.levels, nF = L.length;
  if (s.y === undefined) s.y = padLevel(s.x, s.z, 0, Rr * 0.8, Rr * 0.8);
  addPad({ x: s.x, z: s.z, m: Rr + 1.6, f: 5, y: s.y });
  const b= new Building(s);
  const ap= Rr * Math.cos(PI / 8), side = 2 * Rr * Math.sin(PI / 8);
  const oct= (r: number): GeomVec2[] => { const out: GeomVec2[] = []; for (let k= 0; k < 8; k++) { const a= PI / 8 + k * PI / 4; out.push([Math.sin(a) * r, Math.cos(a) * r]); } return out; };
  const innerR= (ap - t) / Math.cos(PI / 8);
  b.footprint = oct(Rr).map((p) => b.local(p[0], p[1]));
  b.zone = oct(innerR - 0.08).map((p) => b.local(p[0], p[1]));
  b.zoneOut = oct(innerR + 0.25).map((p) => b.local(p[0], p[1]));
  for (let f= 0; f < nF; f++) {
    const y0= f === 0 ? 0 : L[f], y1 = f + 1 < nF ? L[f + 1] : s.wallTop;
    b.walls[f] = {};
    for (let k= 0; k < 8; k++) {
      b.frame(); B.push(Math.sin(k * PI / 4) * (ap - t / 2), 0, Math.cos(k * PI / 4) * (ap - t / 2), k * PI / 4);
      const g= b.group(`w${f}_${k}`, { kind: 'wall', floor: f, plane: planeHere(side / 2), side: k, ghost: 0.12 });
      b.walls[f][k] = g;
      const ops= ((s.open && s.open[k]) || []).filter((e) => e[0] === f).map((e) => ({ ...e[1], b: L[f] + (e[1].b ?? 0) - y0 }));
      buildWall(side + t * 0.45, y0, y1, t, ops, s.style, g, { ground: f === 0, floorY: L[f] - y0, noBraces: true });
      B.pop();
      // corner quoin
      const a= PI / 8 + k * PI / 4;
      b.frame(); B.to(g.batch);
      box(Math.sin(a) * (Rr - 0.12), y0, Math.cos(a) * (Rr - 0.12), 0.42, y1 - y0, 0.42, s.quoin ?? shade(s.style.ext, 1.15), PAT.STONE, { ry: a });
    }
  }
  b.frame(); B.to(b.base.batch);
  if (s.cellar) {
    const [hx0, hz0, hx1, hz1]= s.cellar.hole, hole: GeomVec2[] = [[hx0, hz0], [hx1, hz0], [hx1, hz1], [hx0, hz1]];
    slab(oct(Rr + 0.1), [oct(innerR - 0.05)], -0.6, 0.6 + L[0] - 0.06, s.found ?? 0x7d776c, PAT.STONE);
    slab(oct(innerR + 0.02), [hole], L[0] - 0.3, 0.3, s.floorC ?? 0x8a8478, s.floorPat ?? PAT.STONE);
    walkPoly(oct(innerR + 0.02), L[0], [hole]);
    addCarve(hole.map((p) => b.local(p[0], p[1])));
    B.to(b.furnGroup(0).batch); B.occ = 0;
    for (const r of s.cellar.rails || []) railing(r[0], r[1], r[2], r[3], L[0]);
    B.occ = 1; B.to(b.base.batch);
  } else {
    cyl(0, -0.6, 0, Rr + 0.1, Rr + 0.15, 0.6 + L[0] - 0.06, 8, s.found ?? 0x7d776c, PAT.STONE, { r0: PI / 8 });
    slab(oct(innerR + 0.02), null, L[0] - 0.08, 0.08, s.floorC ?? 0x8a8478, s.floorPat ?? PAT.STONE);
    walkPoly(oct(innerR + 0.02), L[0]);
  }
  for (const e of (s.open && s.open[0]) || []) if (e[0] === 0 && e[1].type === 'door') {
    b.frame(); B.push(0, 0, ap - t / 2, 0); B.to(b.base.batch);
    walkRect(e[1].x, 0.1, e[1].w + 0.1, t + 0.25, L[0]);
    box(e[1].x, 0, t / 2 + 0.3, e[1].w + 0.5, L[0] * 0.5, 0.55, 0x9a948a, PAT.STONE);
    walkRect(e[1].x, t / 2 + 0.3, e[1].w + 0.5, 0.55, L[0] * 0.5);
    B.pop();
  }
  for (let f= 1; f < nF; f++) {
    b.frame(); const g= b.slabGroup(f); B.to(g.batch); B.occ = 0;
    const holes= (s.stairs || []).filter((st) => st.from === f - 1).map((st) => rectPts(st.hx ?? st.x, st.hz ?? st.z, st.hw ?? st.w + 0.3, st.hl ?? st.len));
    slab(oct(innerR + 0.02), holes, L[f] - 0.24, 0.24, s.floorUpC ?? WOOD.mid, PAT.PLANK);
    walkPoly(oct(innerR + 0.02), L[f], holes);
    B.occ = 1;
  }
  for (const st of s.stairs || []) {
    b.frame(); B.to(b.furnGroup(st.from).batch); B.occ = 0;
    stairs(st.x, st.z, st.ry, st.w, st.len, L[st.from], L[st.from + 1], { open: st.open ?? 'R', c: st.c });
    if (st.rails) { B.to(b.furnGroup(st.from + 1).batch); for (const r of st.rails) railing(r[0], r[1], r[2], r[3], L[st.from + 1]); }
    B.occ = 1;
  }
  b.frame(); B.to(b.roof.batch);
  const r= s.roof;
  cyl(0, s.wallTop - 0.1, 0, Rr + 0.15, Rr + 0.2, 0.35, 8, shade(s.style.ext, 0.9), PAT.STONE, { r0: PI / 8 });
  cyl(0, s.wallTop + 0.2, 0, 0.0, Rr + r.oh, r.h, 8, r.c, r.pat, { r0: PI / 8, uv: 3 });
  if (s.roofExtra) s.roofExtra(b);
  if (s.furnish) for (let f= 0; f < nF; f++) b.furnish(f, (bb: Building, ff: number) => s.furnish?.(bb, ff));
  if (s.exterior) { b.frame(); B.to(OUT); B.ground = 0; s.exterior(b); B.ground = -1; }
  return b;
}
