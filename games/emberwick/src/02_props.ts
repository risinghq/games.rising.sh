// ============================================================================
//  Furniture & prop library. Each function builds in the Builder's current
//  frame: (x, z) on the floor, ry = rotation, local +z is the "front".
// ============================================================================
type GeomColor = number | THREE.Color;
type GeomVec2 = [number, number];
type GeomVec3 = [number, number, number];
type GeomRng = () => number;
type GeomAnim = (dt: number, t: number) => void;

interface GeomCtx {
  b: Building | null;
  f: number;
  grp: FadeGroup | null;
  ug: boolean;
  zone: string | null;
}
interface GeomEmitter {
  p: THREE.Vector3;
  color: THREE.Color;
  int: number;
  range: number;
  flick: number;
  night: number;
  b: Building | null;
  f: number;
  glow: number;
  grp: FadeGroup | null;
  seed: number;
  on: number;
  outdoor: boolean;
  prio: number;
  ug: boolean;
  zone: string | null;
  day: number;
}
interface GeomLightOptions {
  color?: GeomColor;
  int?: number;
  range?: number;
  flick?: number;
  night?: number;
  glow?: number;
  prio?: number;
  day?: number;
  ug?: boolean;
  zone?: string | null;
  b?: Building | null;
  f?: number;
  grp?: FadeGroup | null;
}
interface GeomPropOptions extends GeomLightOptions {
  h?: number;
  s?: number;
  w?: number;
  d?: number;
  r?: number;
  y?: number;
  c?: GeomColor;
  len?: number;
  cloth?: GeomColor;
  blanket?: GeomColor;
  cushion?: GeomColor;
  fill?: 'apples' | 'cabbage';
  top?: 'apples' | null;
  goods?: 'produce' | 'cloth' | 'pots';
  holder?: boolean;
  light?: boolean;
  nocol?: boolean;
  back?: boolean;
  candle?: boolean;
  lying?: boolean;
  ry?: number;
  n?: number;
  chain?: number;
  kf?: string;
  kind?: string;
  lit?: boolean;
  label?: string;
  memory?: unknown;
  teach?: unknown;
  locked?: string;
  ground?: boolean;
}
interface GeomFireSource {
  p: THREE.Vector3;
  s: number;
  b: Building | null;
  f: number;
  ug?: boolean;
  kf?: { lit: boolean; kind: string };
  forge?: boolean;
}
interface GeomSmokeSource {
  p: THREE.Vector3;
  rate: number;
  acc: number;
  when?: () => boolean;
}
interface GeomBubbler {
  p: THREE.Vector3;
  c: THREE.Color;
  b: Building | null;
  f: number;
  r: number;
  ug?: boolean;
}
interface GeomSparkle {
  p: THREE.Vector3;
  r: number;
  c: THREE.Color;
  rate: number;
  b?: Building | null;
  f?: number;
  ug?: boolean;
}
interface GeomFestivalLight {
  p: THREE.Vector3;
  c: GeomColor;
}

const WOOD: Record<'dark' | 'mid' | 'light' | 'red' | 'pale' | 'ash' | 'black', number> = { dark: 0x4a2f1f, mid: 0x7b5233, light: 0xa47a4c, red: 0x6b3a24, pale: 0xc4a073, ash: 0x8d7b62, black: 0x2c2018 };
const MET: Record<'iron' | 'brass' | 'copper' | 'steel' | 'gold', number> = { iron: 0x3c3d42, brass: 0xc79b3e, copper: 0xb0643a, steel: 0x9aa1a8, gold: 0xe0b44a };
const CTX: GeomCtx = { b: null, f: 0, grp: null, ug: false, zone: null };

// outdoor props sit on the terrain: at the frame depth stored in B.ground a prop's local
// origin is lifted to the ground under it (indoors and inside nested props this is 0)
function gy(x: number, z: number) {
  if (B.ground < 0 || B.st.length !== B.ground) return 0;
  const p= B.wp(x, 0, z);
  return terrainH(p.x, p.z) - p.y;
}
const FIRES: GeomFireSource[] = [];      // ember / flame particle sources
const SMOKES: GeomSmokeSource[] = [];     // chimney smoke sources
const BUBBLERS: GeomBubbler[] = [];   // cauldron bubble sources
const SPARKLES: GeomSparkle[] = [];   // magic sparkle sources
const ANIMS: GeomAnim[] = [];      // animated scenery callbacks (dt, t)

function light(x: number, y: number, z: number, o: GeomPropOptions) { return addEmitter(x, y, z, { b: CTX.b, f: CTX.f, grp: CTX.grp, ...o }); }

function flame(x: number, y: number, z: number, s: number = 1) {
  cyl(x, y, z, 0, 0.036 * s, 0.11 * s, 5, 0xffa63c, 0, { em: 3.2, occ: 0 });
  sph(x, y + 0.03 * s, z, 0.022 * s, 0xfff0c0, 0, { em: 4, det: 0, occ: 0 });
}
function candle(x: number, y: number, z: number, o: GeomPropOptions = {}) {
  const h= o.h ?? 0.16;
  if (o.holder !== false) cyl(x, y, z, 0.05, 0.06, 0.02, 8, MET.brass, PAT.METAL);
  cyl(x, y + 0.02, z, 0.022, 0.024, h, 6, 0xf1e4c0, 0);
  flame(x, y + 0.02 + h, z, o.s || 1);
  if (o.light) light(x, y + h + 0.14, z, { color: 0xffb35a, int: o.int ?? 1.4, range: o.range ?? 4, glow: o.glow ?? 0.3, flick: 0.2 });
}
function fire(x: number, y: number, z: number, s: number = 1, o: GeomPropOptions = {}) {
  box(x - 0.12 * s, y, z, 0.6 * s, 0.1 * s, 0.12 * s, WOOD.black, PAT.BARK, { ry: 0.45 });
  box(x + 0.1 * s, y, z + 0.04, 0.55 * s, 0.1 * s, 0.12 * s, WOOD.dark, PAT.BARK, { ry: -0.5 });
  if (o.kf) {   // a fire the lantern can kindle: the flames are built live by the magic system
    const p= B.wp(x, y + 0.08 * s, z);
    return kfire(o.kf, o.kind ?? 'hearth', p.x, p.y, p.z, { s, lit: o.lit ?? true, b: CTX.b, f: CTX.f, ug: CTX.ug, zone: CTX.zone, color: o.color, int: o.int, range: o.range, label: o.label, memory: o.memory, teach: o.teach, locked: o.locked });
  }
  const fr= makeRng(Math.floor((x + 9) * 131 + (z + 7) * 71));
  for (let i= 0; i < 6; i++) {
    cyl(x + (fr() - 0.5) * 0.34 * s, y + 0.08 * s, z + (fr() - 0.5) * 0.16 * s, 0, (0.06 + fr() * 0.06) * s, (0.22 + fr() * 0.3) * s, 5,
      [0xff8a2a, 0xffb347, 0xff6a1a][i % 3], 0, { em: 3.0, occ: 0 });
  }
  sph(x, y + 0.08 * s, z, 0.13 * s, 0xffd27a, 0, { em: 3.5, det: 0, sy: 0.55, occ: 0 });
  FIRES.push({ p: B.wp(x, y + 0.15 * s, z), s, b: CTX.b, f: CTX.f, ug: CTX.ug });
  if (o.light !== false) light(x, y + 0.5 * s, z + 0.2, { color: o.color ?? 0xff8c3c, int: (o.int ?? 9) * s, range: o.range ?? 8, flick: 0.35, glow: 1.3 * s, prio: 2 });
}

function table(x: number, z: number, ry: number = 0, w: number = 1.6, d: number = 0.9, o: GeomPropOptions = {}) {
  const h= o.h ?? 0.78, c: GeomColor = o.c ?? WOOD.mid, t: number = 0.06;
  B.push(x, gy(x, z), z, ry);
  box(0, h - t, 0, w, t, d, c, PAT.PLANK);
  const lx: number = w / 2 - 0.09, lz: number = d / 2 - 0.09;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * lx, 0, sz * lz, 0.08, h - t, 0.08, shade(c, 0.78), PAT.PLANK);
  box(0, h - t - 0.09, lz, w - 0.22, 0.09, 0.04, shade(c, 0.8), PAT.PLANK);
  box(0, h - t - 0.09, -lz, w - 0.22, 0.09, 0.04, shade(c, 0.8), PAT.PLANK);
  if (o.cloth) box(0, h, 0, w * 0.5, 0.012, d + 0.03, o.cloth, PAT.NOISE);
  if (!o.nocol) colBox(0, 0, w, d, 0, h);
  B.pop();
}
function roundTable(x: number, z: number, r: number = 0.6, o: GeomPropOptions = {}) {
  const h= o.h ?? 0.76, c: GeomColor = o.c ?? WOOD.mid;
  B.push(x, gy(x, z), z, 0);
  cyl(0, h - 0.06, 0, r, r, 0.06, 14, c, PAT.PLANK);
  cyl(0, 0.05, 0, 0.07, 0.09, h - 0.1, 8, shade(c, 0.8), PAT.PLANK);
  cyl(0, 0, 0, r * 0.45, r * 0.5, 0.06, 10, shade(c, 0.7), PAT.PLANK);
  colCirc(0, 0, r, 0, h);
  B.pop();
}
function chair(x: number, z: number, ry: number = 0, o: GeomPropOptions = {}) {
  const c= o.c ?? WOOD.mid;
  B.push(x, gy(x, z), z, ry);
  box(0, 0.42, 0, 0.44, 0.05, 0.44, c, PAT.PLANK);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * 0.18, 0, sz * 0.18, 0.05, 0.42, 0.05, shade(c, 0.8));
  box(0, 0.47, -0.2, 0.44, 0.52, 0.05, c, PAT.PLANK);
  box(0, 0.92, -0.2, 0.5, 0.06, 0.07, shade(c, 0.85), PAT.PLANK);
  if (o.cushion) box(0, 0.47, 0.02, 0.38, 0.045, 0.36, o.cushion, PAT.NOISE);
  colCirc(0, 0, 0.22, 0, 0.9);
  B.pop();
}
function armchair(x: number, z: number, ry: number = 0, c: GeomColor = 0x7a2f2a) {
  B.push(x, gy(x, z), z, ry);
  box(0, 0, 0, 0.86, 0.42, 0.8, shade(c, 0.85), PAT.NOISE, { ao: 0.3 });
  box(0, 0.42, 0.04, 0.62, 0.1, 0.68, c, PAT.NOISE);
  box(0, 0.42, -0.34, 0.86, 0.62, 0.16, c, PAT.NOISE);
  for (const s of [-1, 1]) box(s * 0.36, 0.42, 0.02, 0.14, 0.26, 0.76, shade(c, 0.92), PAT.NOISE);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * 0.36, -0.02, sz * 0.32, 0.07, 0.06, 0.07, WOOD.dark);
  colBox(0, 0, 0.86, 0.8, 0, 1);
  B.pop();
}
function stool(x: number, z: number, c: GeomColor = WOOD.light) {
  B.push(x, gy(x, z), z, rnd(0, 3));
  cyl(0, 0.45, 0, 0.18, 0.18, 0.05, 9, c, PAT.PLANK);
  for (let i= 0; i < 3; i++) { const a= (i / 3) * TAU; box(Math.cos(a) * 0.11, 0, Math.sin(a) * 0.11, 0.04, 0.45, 0.04, shade(c, 0.75), 0, { rz: Math.cos(a) * 0.1, rx: -Math.sin(a) * 0.1 }); }
  colCirc(0, 0, 0.17, 0, 0.5);
  B.pop();
}
function bench(x: number, z: number, ry: number = 0, len: number = 1.6, o: GeomPropOptions = {}) {
  const c= o.c ?? WOOD.mid;
  B.push(x, gy(x, z), z, ry);
  box(0, 0.42, 0, len, 0.06, 0.36, c, PAT.PLANK);
  for (const s of [-1, 1]) box(s * (len / 2 - 0.12), 0, 0, 0.07, 0.42, 0.32, shade(c, 0.8), PAT.PLANK);
  if (o.back) { box(0, 0.48, -0.16, len, 0.45, 0.05, c, PAT.PLANK); }
  if (!o.nocol) colBox(0, 0, len, 0.4, 0, 0.5);
  B.pop();
}
function bed(x: number, z: number, ry: number = 0, o: GeomPropOptions = {}) {
  const w= o.w ?? 1.15, L: number = o.len ?? 2.0, c: GeomColor = o.c ?? WOOD.mid, bl: GeomColor = o.blanket ?? 0x8c2f2f;
  B.push(x, gy(x, z), z, ry);
  box(0, 0.16, 0, w, 0.22, L, c, PAT.PLANK);
  for (const sx of [-1, 1]) {
    box(sx * (w / 2 - 0.04), 0, -L / 2 + 0.04, 0.08, 1.05, 0.08, shade(c, 0.85));
    box(sx * (w / 2 - 0.04), 0, L / 2 - 0.04, 0.08, 0.62, 0.08, shade(c, 0.85));
  }
  box(0, 0.38, -L / 2 + 0.04, w - 0.08, 0.55, 0.05, c, PAT.PLANK);
  box(0, 0.38, L / 2 - 0.04, w - 0.08, 0.16, 0.05, c, PAT.PLANK);
  box(0, 0.38, 0.03, w - 0.1, 0.16, L - 0.18, 0xe9e1cd, PAT.NOISE);
  box(0, 0.54, -L / 2 + 0.3, w - 0.32, 0.11, 0.36, 0xf6f1e6, PAT.NOISE);
  box(0, 0.54, 0.24, w - 0.04, 0.07, L - 0.72, bl, PAT.RUG, { uv: 2 });
  box(0, 0.42, 0.24, w + 0.02, 0.16, L - 0.72, shade(bl, 0.8), PAT.NOISE);
  colBox(0, 0, w, L, 0, 0.75);
  B.pop();
}
function wardrobe(x: number, z: number, ry: number = 0, o: GeomPropOptions = {}) {
  const _occ= B.occ; B.occ = 1;
  const w= o.w ?? 1.2, h: number = o.h ?? 2.0, d: number = 0.56, c: GeomColor = o.c ?? WOOD.red;
  B.push(x, gy(x, z), z, ry);
  box(0, 0.05, 0, w, h - 0.05, d, c, PAT.PLANK, { ao: 0.25 });
  box(0, h, 0, w + 0.1, 0.09, d + 0.07, shade(c, 0.8), PAT.PLANK);
  box(0, 0, 0, w + 0.04, 0.08, d + 0.02, shade(c, 0.7));
  for (const s of [-1, 1]) {
    box(s * w / 4, 0.16, d / 2, w / 2 - 0.08, h - 0.3, 0.025, shade(c, 1.12), PAT.PLANK);
    box(s * 0.05, h / 2, d / 2 + 0.03, 0.03, 0.12, 0.025, MET.brass, PAT.METAL);
  }
  colBox(0, 0, w, d, 0, h);
  B.pop();
  B.occ = _occ;
}
function dresser(x: number, z: number, ry: number = 0, o: GeomPropOptions = {}) {
  const w= o.w ?? 1.1, h: number = 0.85, d: number = 0.5, c: GeomColor = o.c ?? WOOD.mid;
  B.push(x, gy(x, z), z, ry);
  box(0, 0.06, 0, w, h - 0.06, d, c, PAT.PLANK, { ao: 0.25 });
  box(0, h, 0, w + 0.06, 0.04, d + 0.04, shade(c, 1.15), PAT.PLANK);
  for (let i= 0; i < 3; i++) {
    box(0, 0.12 + i * 0.24, d / 2, w - 0.1, 0.2, 0.02, shade(c, 1.1), PAT.PLANK);
    box(0, 0.2 + i * 0.24, d / 2 + 0.02, 0.12, 0.03, 0.02, MET.brass, PAT.METAL);
  }
  colBox(0, 0, w, d, 0, h);
  B.pop();
}
function nightstand(x: number, z: number, ry: number = 0, o: GeomPropOptions = {}) {
  B.push(x, gy(x, z), z, ry);
  box(0, 0, 0, 0.45, 0.55, 0.4, WOOD.mid, PAT.PLANK, { ao: 0.3 });
  box(0, 0.55, 0, 0.5, 0.04, 0.44, WOOD.light, PAT.PLANK);
  if (o.candle !== false) candle(0.06, 0.59, 0.02, { light: !!o.light });
  colBox(0, 0, 0.45, 0.4, 0, 0.6);
  B.pop();
}
function bookshelf(x: number, z: number, ry: number = 0, o: GeomPropOptions = {}) {
  const _occ= B.occ; B.occ = 1;
  const w= o.w ?? 1.2, h: number = o.h ?? 2.1, d: number = 0.36, c: GeomColor = o.c ?? WOOD.dark, n: number = o.n ?? 5;
  B.push(x, gy(x, z), z, ry);
  box(0, 0, -d / 2 + 0.02, w, h, 0.04, shade(c, 0.7), PAT.PLANK);
  box(-w / 2 + 0.03, 0, 0, 0.06, h, d, c, PAT.PLANK);
  box(w / 2 - 0.03, 0, 0, 0.06, h, d, c, PAT.PLANK);
  box(0, h - 0.05, 0, w, 0.06, d, c, PAT.PLANK);
  const sh= (h - 0.15) / n;
  for (let i= 0; i < n; i++) {
    const y= 0.06 + i * sh;
    box(0, y, 0, w - 0.1, 0.04, d - 0.02, c, PAT.PLANK);
    const gap= R() < 0.35 ? rnd(0.12, 0.4) : 0;
    const bw= w - 0.16 - gap, side: number = R() < 0.5 ? 1 : -1;
    box(side * gap / 2, y + 0.04, 0.01, bw, Math.min(0.31, sh - 0.07), d - 0.1, 0xffffff, PAT.BOOKS, { uv: 1, uo: rnd(0, 40) });
    if (gap > 0.2 && R() < 0.7) bottle(-side * ((w - 0.16) / 2 - gap / 2), y + 0.04, 0, pick([0x3c7a4a, 0x7a2a2a, 0x3a4a8a]));
  }
  colBox(0, 0, w, d, 0, h);
  B.pop();
  B.occ = _occ;
}
function wallShelf(x: number, y: number, z: number, ry: number = 0, w: number = 1.2, items: 'jars' | 'bottles' | 'mugs' | 'mixed' = 'jars') {
  B.push(x, y + gy(x, z), z, ry);
  box(0, 0, 0, w, 0.04, 0.26, WOOD.mid, PAT.PLANK);
  for (const s of [-1, 1]) box(s * (w / 2 - 0.1), -0.16, -0.08, 0.04, 0.16, 0.1, WOOD.dark);
  let px: number = -w / 2 + 0.1;
  while (px < w / 2 - 0.1) {
    const kind= items === 'mixed' ? pick(['jar', 'bottle', 'mug', 'pot']) : items === 'bottles' ? (R() < 0.8 ? 'bottle' : 'jar') : items === 'mugs' ? 'mug' : pick(['jar', 'jar', 'pot', 'bottle']);
    if (kind === 'jar') jar(px, 0.04, 0, pick([0xc9b48a, 0x9e6a3c, 0x7d8a5a, 0xb05a3a]));
    else if (kind === 'bottle') bottle(px, 0.04, 0, pick([0x2f6a3a, 0x6a2424, 0x2a3f7a, 0x8a6a2a, 0x4a2a6a]));
    else if (kind === 'mug') mug(px, 0.04, 0);
    else lathe(px, 0.04, 0, [[0.001, 0], [0.07, 0.01], [0.09, 0.08], [0.06, 0.16], [0.07, 0.18], [0.001, 0.18]], 8, pick([0xa2563a, 0x8a7a5a, 0x5a6a7a]), PAT.NOISE);
    px += rnd(0.14, 0.24);
  }
  B.pop();
}
function jar(x: number, y: number, z: number, c: GeomColor) { lathe(x, y, z, [[0.001, 0], [0.06, 0], [0.07, 0.08], [0.05, 0.14], [0.045, 0.16], [0.001, 0.16]], 8, c, PAT.NOISE); box(x, y + 0.155, z, 0.08, 0.02, 0.08, 0xd8c8a0, 0); }
function bottle(x: number, y: number, z: number, c: GeomColor, s: number = 1) {
  lathe(x, y, z, [[0.001, 0], [0.045 * s, 0], [0.05 * s, 0.13 * s], [0.02 * s, 0.19 * s], [0.016 * s, 0.26 * s], [0.001, 0.26 * s]], 8, c, PAT.METAL);
  cyl(x, y + 0.255 * s, z, 0.018 * s, 0.018 * s, 0.03 * s, 5, 0x8a6a3a);
}
function potion(x: number, y: number, z: number, c: GeomColor) {
  lathe(x, y, z, [[0.001, 0], [0.06, 0.02], [0.07, 0.07], [0.04, 0.12], [0.018, 0.14], [0.018, 0.19], [0.001, 0.19]], 9, c, PAT.METAL, { em: 0.6, occ: 0 });
  cyl(x, y + 0.185, z, 0.02, 0.02, 0.03, 5, 0x8a6a3a);
}
function mug(x: number, y: number, z: number, c: GeomColor = WOOD.light) {
  cyl(x, y, z, 0.05, 0.045, 0.11, 8, c, PAT.PLANK);
  box(x + 0.06, y + 0.03, z, 0.02, 0.06, 0.02, shade(c, 0.8));
  cyl(x, y + 0.1, z, 0.042, 0.042, 0.012, 8, 0xe8d8a8);
}
function plate(x: number, y: number, z: number, food?: 'bread' | 'pie' | 'apple') {
  cyl(x, y, z, 0.13, 0.1, 0.02, 10, 0xe2dccb, 0);
  if (food === 'bread') ball(x, y + 0.04, z, 0.07, 0xb87a3a, PAT.NOISE, { sx: 1.4, sy: 0.6 });
  else if (food === 'apple') { ball(x - 0.04, y + 0.05, z, 0.04, 0xb8302a, 0); ball(x + 0.04, y + 0.05, z + 0.02, 0.04, 0x9cbf3a, 0); }
  else if (food === 'pie') { cyl(x, y + 0.02, z, 0.1, 0.09, 0.04, 12, 0xd98a2a, PAT.NOISE); }
}
function chest(x: number, z: number, ry: number = 0, c: GeomColor = WOOD.red) {
  B.push(x, gy(x, z), z, ry);
  box(0, 0, 0, 0.9, 0.42, 0.52, c, PAT.PLANK, { ao: 0.3 });
  cyl(0.45, 0.42, 0, 0.26, 0.26, 0.9, 8, shade(c, 1.1), PAT.PLANK, { rz: PI / 2 });
  for (const s of [-0.3, 0.3]) box(s, 0, 0, 0.06, 0.62, 0.55, MET.iron, PAT.METAL);
  box(0, 0.3, 0.27, 0.1, 0.12, 0.03, MET.brass, PAT.METAL);
  colBox(0, 0, 0.9, 0.52, 0, 0.6);
  B.pop();
}
function barrel(x: number, z: number, o: GeomPropOptions = {}) {
  const h= o.h ?? 0.9, r: number = o.r ?? 0.32, c: GeomColor = o.c ?? WOOD.mid, y: number = o.y ?? 0;
  B.push(x, y + gy(x, z), z, o.ry || 0, o.lying ? PI / 2 : 0);
  if (o.lying) B.push(0, -h / 2, -r * 1.02, 0);
  lathe(0, 0, 0, [[0.001, 0], [r * 0.83, 0], [r * 0.97, h * 0.25], [r * 1.02, h * 0.5], [r * 0.97, h * 0.75], [r * 0.83, h], [0.001, h]], 12, c, PAT.BARK, { uvs: 0.5 });
  for (const t of [0.14, 0.86]) cyl(0, h * t - 0.025, 0, r * 0.93, r * 0.93, 0.05, 12, MET.iron, PAT.METAL);
  if (o.top === 'apples') for (let i= 0; i < 7; i++) ball(rnd(-0.6, 0.6) * r, h + 0.02, rnd(-0.6, 0.6) * r, 0.055, pick([0xb8302a, 0xc8452a, 0x9cbf3a]), 0);
  if (o.lying) B.pop();
  if (!o.lying && !o.nocol) colCirc(0, 0, r, 0, h);
  B.pop();
}
function crate(x: number, z: number, ry: number = 0, s: number = 0.6, o: GeomPropOptions = {}) {
  const y= o.y ?? 0, c: GeomColor = o.c ?? WOOD.light;
  B.push(x, y + gy(x, z), z, ry);
  box(0, 0, 0, s, s, s, c, PAT.PLANK);
  for (const e of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(e[0] * (s / 2 - 0.02), 0, e[1] * (s / 2 - 0.02), 0.06, s, 0.06, shade(c, 0.7));
  box(0, s - 0.03, 0, s + 0.02, 0.05, s + 0.02, shade(c, 0.78));
  if (o.fill === 'apples') for (let i= 0; i < 9; i++) ball(rnd(-0.35, 0.35) * s, s - 0.02, rnd(-0.35, 0.35) * s, 0.05, pick([0xb8302a, 0xd0542e, 0x9cbf3a]), 0);
  if (o.fill === 'cabbage') for (let i= 0; i < 4; i++) sph(rnd(-0.25, 0.25) * s, s, rnd(-0.25, 0.25) * s, 0.11, 0x7aa84a, PAT.LEAF, { det: 1, jit: 0.15 });
  if (!o.nocol) colBox(0, 0, s, s, 0, s + y);
  B.pop();
}
function sack(x: number, z: number, ry: number = 0, c: GeomColor = 0xc8b48a) {
  B.push(x, gy(x, z), z, ry);
  lathe(0, 0, 0, [[0.001, 0], [0.22, 0.02], [0.26, 0.2], [0.22, 0.42], [0.12, 0.52], [0.06, 0.56], [0.001, 0.58]], 9, c, PAT.NOISE);
  cyl(0, 0.5, 0, 0.07, 0.07, 0.04, 6, 0x8a6a3a);
  colCirc(0, 0, 0.24, 0, 0.55);
  B.pop();
}
function rug(x: number, z: number, ry: number, w: number, d: number, c: GeomColor) { B.push(x, gy(x, z), z, ry); box(0, 0.004, 0, w, 0.014, d, c, PAT.RUG, { uv: 2, occ: 0 }); B.pop(); }
function painting(x: number, y: number, z: number, ry: number, w: number, h: number, scene: number = 0) {
  B.push(x, y + gy(x, z), z, ry);
  box(0, 0, 0, w + 0.12, h + 0.12, 0.05, MET.gold, PAT.METAL);
  const sky= [0x7aa6c8, 0xe9a46a, 0x3b4a7a][scene % 3], land: number = [0x5a7a3a, 0x7a5a3a, 0x2a4a3a][scene % 3];
  box(0, 0.06 + h * 0.45, 0.026, w, h * 0.55, 0.01, sky, PAT.NOISE);
  box(0, 0.06, 0.026, w, h * 0.45, 0.01, land, PAT.NOISE);
  sph(w * 0.22, 0.06 + h * 0.78, 0.035, Math.min(w, h) * 0.08, 0xf4e6b0, 0, { det: 0, sz: 0.2 });
  B.pop();
}
function banner(x: number, y: number, z: number, ry: number, w: number, h: number, c: GeomColor, emblem: GeomColor = MET.gold) {
  B.push(x, y + gy(x, z), z, ry);
  box(0, h, 0.02, w + 0.2, 0.04, 0.04, WOOD.dark);
  box(0, 0.25, 0.03, w, h - 0.25, 0.015, c, PAT.NOISE);
  tris([-w / 2, 0.25, 0.03, 0, 0, 0.03, w / 2, 0.25, 0.03], c, PAT.NOISE);
  sph(0, h * 0.55, 0.045, w * 0.22, emblem, PAT.METAL, { det: 0, sz: 0.15 });
  B.pop();
}
function counter(x: number, z: number, ry: number, len: number, o: GeomPropOptions = {}) {
  const h= 1.05, d: number = 0.66, c: GeomColor = o.c ?? WOOD.red;
  B.push(x, gy(x, z), z, ry);
  box(0, 0, 0, len, h - 0.06, d - 0.12, c, PAT.PLANK, { ao: 0.3 });
  box(0, h - 0.07, 0, len + 0.1, 0.07, d + 0.04, shade(c, 1.25), PAT.PLANK);
  box(0, 0, d / 2 - 0.05, len, 0.1, 0.05, shade(c, 0.6));
  const n= Math.max(2, Math.floor(len / 0.8));
  for (let i= 0; i <= n; i++) box(-len / 2 + 0.05 + (i * (len - 0.1)) / n, 0.1, d / 2 - 0.05, 0.07, h - 0.22, 0.04, shade(c, 0.72));
  if (!o.nocol) colBox(0, 0, len + 0.1, d + 0.04, 0, h);
  B.pop();
}
function kegRack(x: number, z: number, ry: number, n: number = 3) {
  const _occ= B.occ; B.occ = 1;
  B.push(x, gy(x, z), z, ry);
  box(0, 0, 0, n * 0.62 + 0.1, 0.35, 0.5, WOOD.dark, PAT.PLANK);
  for (let i= 0; i < n; i++) {
    const px: number = -((n - 1) * 0.62) / 2 + i * 0.62;
    B.push(px, 0.35 + 0.3, 0.25, 0, -PI / 2);
    lathe(0, 0, 0, [[0.001, 0], [0.24, 0], [0.29, 0.25], [0.24, 0.5], [0.001, 0.5]], 12, WOOD.mid, PAT.BARK, { uvs: 0.5 });
    for (const t of [0.08, 0.42]) cyl(0, t, 0, 0.27, 0.27, 0.04, 12, MET.iron, PAT.METAL);
    B.pop();
    box(px, 0.62, 0.27, 0.04, 0.08, 0.06, MET.brass, PAT.METAL);
  }
  colBox(0, 0, n * 0.62 + 0.1, 0.6, 0, 1);
  B.pop();
  B.occ = _occ;
}
function chandelier(x: number, y: number, z: number, r: number = 0.6, n: number = 6, o: GeomPropOptions = {}) {
  B.push(x, y + gy(x, z), z, 0);
  box(0, 0.05, 0, 0.03, o.chain ?? 0.7, 0.03, MET.iron);
  torus(0, 0, 0, r, 0.028, 4, 18, MET.iron, PAT.METAL, { rx: PI / 2 });
  for (let i= 0; i < n; i++) {
    const a= (i / n) * TAU;
    box(Math.cos(a) * r / 2, 0, Math.sin(a) * r / 2, r, 0.025, 0.025, MET.iron, 0, { ry: -a });
    candle(Math.cos(a) * r, 0.01, Math.sin(a) * r, { h: 0.12 });
  }
  B.pop();
  light(x, y + 0.2, z, { color: 0xffb55e, int: o.int ?? 6, range: o.range ?? 9, glow: 0.7, flick: 0.12, prio: 1 });
}
function lanternHang(x: number, y: number, z: number, o: GeomPropOptions = {}) {
  B.push(x, y + gy(x, z), z, 0);
  box(0, 0, 0, 0.2, 0.26, 0.2, MET.iron, PAT.METAL);
  box(0, 0.03, 0, 0.16, 0.2, 0.16, 0xffc66a, 0, { em: -2.6, occ: 0 });
  cyl(0, 0.26, 0, 0, 0.16, 0.12, 4, MET.iron, PAT.METAL, { r0: PI / 4 });
  box(0, 0.38, 0, 0.03, o.chain ?? 0.08, 0.03, MET.iron);
  B.pop();
  return light(x, y + 0.13, z, { color: 0xffae55, int: o.int ?? 5, range: o.range ?? 8, night: o.night ?? 1, glow: o.glow ?? 0.9, flick: 0.1, prio: o.prio || 0 });
}
function wallLantern(x: number, y: number, z: number, ry: number, o: GeomPropOptions = {}) {
  B.push(x, y + gy(x, z), z, ry);
  box(0, 0.3, 0.14, 0.04, 0.04, 0.3, MET.iron);
  const e= lanternHang(0, -0.05, 0.3, { ...o, chain: 0.04 });
  B.pop();
  return e;
}
function plantPot(x: number, z: number, o: GeomPropOptions = {}) {
  const y= o.y ?? 0;
  B.push(x, y + gy(x, z), z, 0);
  lathe(0, 0, 0, [[0.001, 0], [0.13, 0], [0.18, 0.28], [0.2, 0.3], [0.001, 0.3]], 9, 0xa7553a, PAT.NOISE);
  for (let i= 0; i < 4; i++) sph(rnd(-0.08, 0.08), 0.36 + rnd(0, 0.12), rnd(-0.08, 0.08), rnd(0.1, 0.15), pick([0x4a7a3a, 0x5a8a3a, 0x3e6a32]), PAT.LEAF, { det: 0, jit: 0.2 });
  if (!o.nocol) colCirc(0, 0, 0.2, 0, 0.6);
  B.pop();
}
function flowerBox(x: number, y: number, z: number, ry: number, w: number) {
  B.push(x, y + gy(x, z), z, ry);
  box(0, 0, 0, w, 0.2, 0.22, WOOD.mid, PAT.PLANK);
  box(0, 0.18, 0, w - 0.04, 0.03, 0.18, 0x4a3426, PAT.NOISE);
  for (let i= 0; i < Math.floor(w / 0.12); i++) {
    const px: number = -w / 2 + 0.08 + i * 0.12;
    sph(px, 0.24, rnd(-0.04, 0.04), 0.07, pick([0x4f7d36, 0x5f8f3a]), PAT.LEAF, { det: 0, occ: 0 });
    sph(px + rnd(-0.03, 0.03), 0.3, rnd(-0.04, 0.04), 0.04, pick([0xd8433a, 0xf2c94a, 0xe86fa0, 0xf4f0e8, 0x9b5ad8]), 0, { det: 0, occ: 0 });
  }
  B.pop();
}
function cauldron(x: number, z: number, o: GeomPropOptions = {}) {
  B.push(x, gy(x, z), z, 0);
  for (let i= 0; i < 3; i++) { const a= (i / 3) * TAU + 0.3; box(Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38, 0.06, 0.3, 0.06, MET.iron, PAT.METAL, { rz: Math.cos(a) * 0.2, rx: -Math.sin(a) * 0.2 }); }
  lathe(0, 0.18, 0, [[0.001, 0], [0.3, 0.02], [0.46, 0.22], [0.48, 0.42], [0.42, 0.62], [0.46, 0.66], [0.44, 0.68]], 14, MET.iron, PAT.METAL, { smooth: true });
  cyl(0, 0.76, 0, 0.42, 0.42, 0.02, 14, o.c ?? 0x3cc85a, 0, { em: 0.7, occ: 0 });
  fire(0, 0, 0, 0.55, { int: 4, range: 4, kf: o.kf, label: o.label, lit: o.lit });
  BUBBLERS.push({ p: B.wp(0, 0.8, 0), c: col(o.c ?? 0x7aff7a), b: CTX.b, f: CTX.f, r: 0.36, ug: CTX.ug });
  light(0, 1.2, 0, { color: o.c ?? 0x60ff7a, int: 5, range: 6, glow: 0.9, flick: 0.2, prio: 2 });
  colCirc(0, 0, 0.5, 0, 0.9);
  B.pop();
}
function anvil(x: number, z: number, ry: number = 0) {
  B.push(x, gy(x, z), z, ry);
  cyl(0, 0, 0, 0.26, 0.3, 0.55, 8, WOOD.dark, PAT.BARK);
  box(0, 0.55, 0, 0.26, 0.14, 0.2, MET.iron, PAT.METAL);
  box(0, 0.69, 0, 0.62, 0.15, 0.26, MET.iron, PAT.METAL);
  cyl(0.38, 0.73, 0, 0, 0.07, 0.25, 6, MET.iron, PAT.METAL, { rz: -PI / 2 });
  colCirc(0, 0, 0.35, 0, 0.85);
  B.pop();
}
function grindstone(x: number, z: number, ry: number = 0) {
  B.push(x, gy(x, z), z, ry);
  for (const s of [-1, 1]) box(s * 0.2, 0, 0, 0.08, 0.75, 0.12, WOOD.mid, PAT.PLANK);
  box(0, 0.08, 0, 0.5, 0.06, 0.4, WOOD.mid, PAT.PLANK);
  cyl(-0.12, 0.72, 0, 0.32, 0.32, 0.14, 14, 0x9a948a, PAT.STONE, { rz: PI / 2 });
  cyl(-0.3, 0.72, 0, 0.03, 0.03, 0.62, 6, MET.iron, 0, { rz: PI / 2 });
  colBox(0, 0, 0.6, 0.6, 0, 1);
  B.pop();
}
function weaponRack(x: number, z: number, ry: number = 0) {
  const _occ= B.occ; B.occ = 1;
  B.push(x, gy(x, z), z, ry);
  box(0, 0, -0.1, 1.6, 0.1, 0.3, WOOD.dark, PAT.PLANK);
  box(0, 1.2, -0.12, 1.6, 0.08, 0.1, WOOD.dark, PAT.PLANK);
  for (const s of [-1, 1]) box(s * 0.76, 0, -0.12, 0.08, 1.6, 0.08, WOOD.dark);
  for (let i= 0; i < 5; i++) {
    const px: number = -0.6 + i * 0.3;
    if (i % 2 === 0) { // sword
      box(px, 0.12, -0.05, 0.06, 1.0, 0.02, MET.steel, PAT.METAL);
      box(px, 1.08, -0.05, 0.22, 0.04, 0.05, MET.brass, PAT.METAL);
      box(px, 1.12, -0.05, 0.04, 0.18, 0.04, 0x4a2a1a);
    } else { // spear / axe
      box(px, 0.1, -0.05, 0.035, 1.4, 0.035, WOOD.mid);
      cyl(px, 1.5, -0.05, 0, 0.05, 0.22, 4, MET.steel, PAT.METAL);
    }
  }
  colBox(0, -0.05, 1.6, 0.35, 0, 1.6);
  B.pop();
  B.occ = _occ;
}
function armorStand(x: number, z: number, ry: number = 0) {
  const _occ= B.occ; B.occ = 1;
  B.push(x, gy(x, z), z, ry);
  cyl(0, 0, 0, 0.28, 0.32, 0.06, 8, WOOD.dark);
  box(0, 0.06, 0, 0.06, 1.3, 0.06, WOOD.dark);
  lathe(0, 0.75, 0, [[0.001, 0], [0.26, 0.02], [0.3, 0.3], [0.24, 0.55], [0.12, 0.62], [0.001, 0.62]], 10, MET.steel, PAT.METAL);
  ball(0, 1.5, 0, 0.17, MET.steel, PAT.METAL, { sy: 1.1 });
  box(0, 1.47, 0.14, 0.04, 0.12, 0.04, MET.steel, PAT.METAL);
  for (const s of [-1, 1]) ball(s * 0.3, 1.32, 0, 0.11, MET.steel, PAT.METAL);
  colCirc(0, 0, 0.32, 0, 1.7);
  B.pop();
  B.occ = _occ;
}
function telescope(x: number, z: number, ry: number = 0) {
  B.push(x, gy(x, z), z, ry);
  for (let i= 0; i < 3; i++) { const a= (i / 3) * TAU; box(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25, 0.05, 1.1, 0.05, WOOD.dark, 0, { rz: Math.cos(a) * 0.22, rx: -Math.sin(a) * 0.22 }); }
  B.push(0, 1.08, 0, 0, -0.55);
  cyl(0, -0.5, 0, 0.09, 0.07, 1.5, 10, MET.brass, PAT.METAL, { smooth: true });
  cyl(0, 0.95, 0, 0.11, 0.11, 0.08, 10, MET.brass, PAT.METAL);
  B.pop();
  colCirc(0, 0, 0.4, 0, 1.6);
  B.pop();
}
function globe(x: number, z: number) {
  B.push(x, gy(x, z), z, 0);
  cyl(0, 0, 0, 0.18, 0.22, 0.06, 8, WOOD.dark);
  cyl(0, 0.06, 0, 0.03, 0.03, 0.62, 6, WOOD.dark);
  torus(0, 0.92, 0, 0.29, 0.015, 4, 20, MET.brass, PAT.METAL, { ry: 0.4 });
  ball(0, 0.92, 0, 0.26, 0x3f6f9a, PAT.NOISE, { ws: 12, hs: 9 });
  for (let i= 0; i < 4; i++) sph(Math.cos(i * 1.7) * 0.18, 0.92 + Math.sin(i * 2.3) * 0.12, Math.sin(i * 1.7) * 0.18, 0.1, 0x7a9a4a, 0, { det: 0, sz: 0.5 });
  colCirc(0, 0, 0.3, 0, 1.2);
  B.pop();
}
function pew(x: number, z: number, ry: number, len: number) {
  B.push(x, gy(x, z), z, ry);
  box(0, 0.42, 0, len, 0.06, 0.42, WOOD.mid, PAT.PLANK);
  box(0, 0.48, -0.19, len, 0.55, 0.05, WOOD.mid, PAT.PLANK);
  for (const s of [-1, 1]) box(s * (len / 2 - 0.03), 0, 0, 0.06, 0.95, 0.46, WOOD.dark, PAT.PLANK);
  colBox(0, 0, len, 0.46, 0, 1);
  B.pop();
}
function lectern(x: number, z: number, ry: number) {
  B.push(x, gy(x, z), z, ry);
  cyl(0, 0, 0, 0.22, 0.26, 0.06, 8, WOOD.dark);
  box(0, 0.06, 0, 0.12, 1.0, 0.12, WOOD.dark, PAT.PLANK);
  box(0, 1.08, 0, 0.55, 0.06, 0.42, WOOD.mid, PAT.PLANK, { rx: 0.35 });
  box(0, 1.15, 0.02, 0.42, 0.05, 0.3, 0xefe4c8, PAT.NOISE, { rx: 0.35 });
  colCirc(0, 0, 0.3, 0, 1.3);
  B.pop();
}
function hayBale(x: number, z: number, ry: number = 0, y: number = 0) {
  B.push(x, y + gy(x, z), z, ry);
  box(0, 0, 0, 1.0, 0.5, 0.6, 0xd6b25a, PAT.STRAW);
  for (const s of [-0.25, 0.25]) box(s, -0.005, 0, 0.03, 0.51, 0.61, 0x9c7a3a);
  colBox(0, 0, 1.0, 0.6, 0, 0.5 + y);
  B.pop();
}
function lampPost(x: number, z: number, o: GeomPropOptions = {}) {
  B.push(x, gy(x, z), z, o.ry || 0);
  cyl(0, 0, 0, 0.16, 0.2, 0.3, 6, 0x6a6458, PAT.STONE);
  cyl(0, 0.3, 0, 0.06, 0.08, 2.6, 6, WOOD.dark, PAT.BARK);
  box(0, 2.75, 0.25, 0.06, 0.06, 0.55, WOOD.dark, 0);
  colCirc(0, 0, 0.18, 0, 3);
  B.pop();
  B.push(x, gy(x, z), z, o.ry || 0);
  const e= lanternHang(0, 2.32, 0.48, { int: o.int ?? 7, range: 9, chain: 0.12 });
  B.pop();
  return e;
}
function fence(points: GeomVec2[], o: GeomPropOptions = {}) { // polyline of [x,z] in frame coords; picket fence that follows the ground
  const c= o.c ?? 0x8a6a48, h: number = o.h ?? 0.9;
  const follow= o.ground || (B.ground >= 0 && B.st.length === B.ground);
  const gh= (x: number, z: number) => { if (!follow) return 0; const p= B.wp(x, 0, z); return terrainH(p.x, p.z) - p.y; };
  for (let i= 0; i < points.length - 1; i++) {
    const [x0, z0]= points[i], [x1, z1] = points[i + 1];
    const L= Math.hypot(x1 - x0, z1 - z0), a: number = Math.atan2(-(z1 - z0), x1 - x0);
    const ns= follow ? Math.max(1, Math.ceil(L / 2.2)) : 1, l: number = L / ns;
    for (let k= 0; k < ns; k++) {
      const xa= lerp(x0, x1, k / ns), za: number = lerp(z0, z1, k / ns), xb: number = lerp(x0, x1, (k + 1) / ns), zb: number = lerp(z0, z1, (k + 1) / ns);
      const ya= gh(xa, za), yb: number = gh(xb, zb), ym: number = (ya + yb) / 2, tilt: number = Math.atan2(yb - ya, l);
      B.push((xa + xb) / 2, ym, (za + zb) / 2, a);
      for (const yy of [0.3, h - 0.18]) box(0, yy - 0.035, 0, l / Math.cos(tilt) + 0.03, 0.07, 0.05, shade(c, 0.85), PAT.PLANK, { rz: tilt });
      const n= Math.max(1, Math.round(l / 0.22));
      for (let q= 0; q <= n; q++) {
        if (q === 0 && k > 0) continue;
        const px: number = -l / 2 + (q * l) / n, py: number = lerp(ya, yb, q / n) - ym;
        const post= (q === 0 && k === 0) || (q === n && k === ns - 1) || (q === 0 || q === n);
        box(px, py - 0.08, 0.04, post ? 0.1 : 0.07, (post ? h + 0.1 : h - 0.05 + ((q % 2) * 0.05)) + 0.03, post ? 0.1 : 0.03, post ? shade(c, 0.7) : vary(c, 0.06), PAT.PLANK, { occ: 0 });
      }
      colBox(0, 0, l, 0.16, Math.min(ya, yb) - ym - 0.3, Math.max(ya, yb) - ym + h);
      B.pop();
    }
  }
}
function marketStall(x: number, z: number, ry: number, o: GeomPropOptions = {}) {
  const w= o.w ?? 2.8, d: number = o.d ?? 1.6, cloth: GeomColor = o.cloth ?? 0xb83a30;
  B.push(x, gy(x, z), z, ry);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08), 0.1, sz < 0 ? 2.5 : 2.2, 0.1, WOOD.mid, PAT.PLANK);
  box(0, 0.85, d / 2 - 0.35, w - 0.1, 0.08, 0.7, WOOD.light, PAT.PLANK);
  box(0, 0, d / 2 - 0.35, w - 0.2, 0.85, 0.06, WOOD.mid, PAT.PLANK, { ao: 0.3 });
  B.push(0, 2.35, 0, 0, -0.18);
  box(0, 0, 0, w + 0.3, 0.05, d + 0.5, cloth, PAT.STRIPE, { uv: 0 });
  B.pop();
  for (let i= 0; i < 9; i++) tris([-w / 2 - 0.15 + i * (w + 0.3) / 9, 2.2, d / 2 + 0.28, -w / 2 - 0.15 + (i + 1) * (w + 0.3) / 9, 2.2, d / 2 + 0.28, -w / 2 - 0.15 + (i + 0.5) * (w + 0.3) / 9, 2.0, d / 2 + 0.3], i % 2 ? cloth : 0xeee4cc, 0);
  const goods= o.goods || 'produce';
  for (let i= 0; i < 6; i++) {
    const px: number = -w / 2 + 0.35 + i * ((w - 0.7) / 5);
    if (goods === 'produce') { if (i % 2) pumpkin(px, 0.93, d / 2 - 0.35, 0.13); else crate(px, d / 2 - 0.35, 0.1, 0.3, { y: 0.93, fill: i % 4 ? 'apples' : 'cabbage', nocol: true }); }
    else if (goods === 'cloth') box(px, 0.93, d / 2 - 0.35, 0.34, 0.08 + (i % 3) * 0.05, 0.4, pick([0x7a3a6a, 0x3a5a8a, 0xc8a03a, 0x4a7a4a, 0xa83a2a]), PAT.NOISE);
    else if (goods === 'pots') lathe(px, 0.93, d / 2 - 0.35, [[0.001, 0], [0.1, 0], [0.15, 0.12], [0.09, 0.26], [0.11, 0.3], [0.001, 0.3]], 9, pick([0xa2563a, 0x8a6a4a, 0x6a7a8a]), PAT.NOISE);
  }
  colBox(0, 0, w, d, 0, 2.3);
  B.pop();
}
function well(x: number, z: number) {
  B.push(x, gy(x, z), z, 0);
  cyl(0, 0, 0, 1.0, 1.05, 0.85, 10, 0x8f877a, PAT.STONE);
  cyl(0, 0.84, 0, 0.82, 0.82, 0.02, 10, 0x1d3a44, 0, { occ: 0 });
  for (const s of [-1, 1]) box(s * 0.85, 0.8, 0, 0.12, 1.5, 0.12, WOOD.dark, PAT.PLANK);
  box(0, 2.2, 0, 2.0, 0.08, 0.12, WOOD.dark);
  cyl(0.75, 1.75, 0, 0.12, 0.12, 1.5, 8, WOOD.mid, PAT.PLANK, { rz: PI / 2 });
  B.push(0, 2.25, 0, 0);
  box(-0.6, 0, -0.75, 1.5, 0.06, 1.6, 0x6b4a33, PAT.SLATE, { rz: -0.55, uv: 3 });
  box(0.6, 0, -0.75, 1.5, 0.06, 1.6, 0x6b4a33, PAT.SLATE, { rz: 0.55, uv: 3, ry: 0 });
  B.pop();
  cyl(0.2, 1.1, 0, 0.13, 0.11, 0.25, 8, WOOD.mid, PAT.PLANK);
  colCirc(0, 0, 1.1, 0, 2.5);
  B.pop();
}
function noticeBoard(x: number, z: number, ry: number) {
  B.push(x, gy(x, z), z, ry);
  for (const s of [-1, 1]) box(s * 0.75, 0, 0, 0.12, 2.1, 0.12, WOOD.dark, PAT.BARK);
  box(0, 0.9, 0.02, 1.5, 1.0, 0.06, WOOD.mid, PAT.PLANK);
  box(0, 2.0, 0.02, 1.8, 0.06, 0.4, WOOD.dark, PAT.PLANK, { rx: -0.2 });
  for (let i= 0; i < 5; i++) box(rnd(-0.55, 0.55), rnd(1.0, 1.65), 0.06, rnd(0.22, 0.34), rnd(0.25, 0.3), 0.01, pick([0xefe4c8, 0xe8d8b0, 0xf4ecd8]), 0, { rz: rnd(-0.15, 0.15) });
  colBox(0, 0, 1.7, 0.3, 0, 2);
  B.pop();
}
function signpost(x: number, z: number, ry: number, labels: number[]) {
  B.push(x, gy(x, z), z, ry);
  cyl(0, 0, 0, 0.07, 0.08, 2.4, 6, WOOD.dark, PAT.BARK);
  labels.forEach((a: number, i: number) => {
    B.push(0, 1.9 - i * 0.32, 0, a);
    box(0.45, 0, 0.06, 0.9, 0.22, 0.05, WOOD.light, PAT.PLANK);
    tris([0.9, 0, 0.06, 1.05, 0.11, 0.06, 0.9, 0.22, 0.06], WOOD.light, 0);
    B.pop();
  });
  colCirc(0, 0, 0.12, 0, 2.4);
  B.pop();
}
function scarecrow(x: number, z: number, ry: number) {
  B.push(x, gy(x, z), z, ry);
  box(0, 0, 0, 0.08, 1.9, 0.08, WOOD.dark, PAT.BARK);
  box(0, 1.35, 0, 1.4, 0.07, 0.07, WOOD.dark, PAT.BARK);
  box(0, 0.9, 0, 0.5, 0.65, 0.28, 0x8a5a3a, PAT.NOISE);
  for (const s of [-1, 1]) box(s * 0.45, 1.25, 0, 0.5, 0.18, 0.2, 0x8a5a3a, PAT.NOISE);
  ball(0, 1.75, 0, 0.18, 0xd8b65a, PAT.STRAW);
  cyl(0, 1.85, 0, 0.36, 0.36, 0.03, 12, 0xc89a4a, PAT.STRAW);
  cyl(0, 1.87, 0, 0.14, 0.18, 0.2, 10, 0xc89a4a, PAT.STRAW);
  colCirc(0, 0, 0.3, 0, 2);
  B.pop();
}
function gravestone(x: number, z: number, ry: number, k = 0) {
  B.push(x, gy(x, z), z, ry + rnd(-0.12, 0.12), rnd(-0.08, 0.08), rnd(-0.06, 0.06));
  const c= vary(0x8c8a84, 0.12);
  if (k % 3 === 0) { box(0, 0, 0, 0.55, 0.7, 0.14, c, PAT.STONE); cyl(0, 0.7, -0.07, 0.275, 0.275, 0.14, 10, c, PAT.STONE, { rx: PI / 2 }); }
  else if (k % 3 === 1) { box(0, 0, 0, 0.12, 1.0, 0.12, c, PAT.STONE); box(0, 0.62, 0, 0.5, 0.12, 0.12, c, PAT.STONE); }
  else box(0, 0, 0, 0.6, 0.55, 0.16, c, PAT.STONE);
  box(0, 0, 0.55, 0.7, 0.06, 0.9, 0x5a6a3a, PAT.LEAF, { occ: 0 });
  colBox(0, 0, 0.6, 0.2, 0, 1);
  B.pop();
}
function woodpile(x: number, z: number, ry: number) {
  B.push(x, gy(x, z), z, ry);
  for (let r= 0; r < 4; r++) for (let i= 0; i < 6 - r; i++) cyl(-0.75 + i * 0.3 + r * 0.15, 0.13 + r * 0.25, -0.5, 0.13, 0.13, 1.0, 7, vary(0x7a5634, 0.1), PAT.BARK, { rx: PI / 2 });
  box(0, 0, 0, 2.0, 0.08, 1.1, WOOD.dark);
  colBox(0, 0, 1.9, 1.1, 0, 1.1);
  B.pop();
}
function cart(x: number, z: number, ry: number) {
  B.push(x, gy(x, z), z, ry);
  box(0, 0.62, 0, 1.4, 0.08, 2.1, WOOD.mid, PAT.PLANK);
  for (const s of [-1, 1]) box(s * 0.68, 0.7, 0, 0.06, 0.4, 2.1, WOOD.mid, PAT.PLANK);
  box(0, 0.7, -1.02, 1.4, 0.4, 0.06, WOOD.mid, PAT.PLANK);
  for (const s of [-1, 1]) {
    cyl(s * 0.8, 0.45, 0.3, 0.45, 0.45, 0.08, 12, WOOD.dark, PAT.PLANK, { rz: PI / 2 });
    torus(s * 0.84, 0.45, 0.3, 0.43, 0.035, 4, 16, MET.iron, PAT.METAL, { ry: PI / 2 });
  }
  for (const s of [-1, 1]) box(s * 0.35, 0.4, 1.6, 0.07, 0.07, 1.4, WOOD.dark, 0, { rx: 0.25 });
  hayBale(0, 0.15, 0.2, 0.7);
  pumpkin(-0.35, 0.7, -0.6, 0.18); pumpkin(0.3, 0.7, -0.7, 0.15, 0xe07a24);
  colBox(0, 0.1, 1.7, 2.3, 0, 1.4);
  B.pop();
}
function jackOLantern(x: number, z: number, s: number = 0.24, ry: number = 0, y: number = 0) {
  B.push(x, y + gy(x, z), z, ry);
  emit(pumpkinSrc(s), null, 0xd8661c, PAT.NOISE, {});
  cyl(0, s * 1.4, 0, s * 0.07, s * 0.1, s * 0.3, 5, 0x5a4a1e, 0);
  // carved face: glowing triangles hugging the pumpkin's front surface
  const em= { em: -3.5, occ: 0 };
  const fy= s * 0.72;
  const sz= (px: number, py: number) => s * 1.09 * Math.sqrt(Math.max(0, 1 - (px / (s * 1.09)) ** 2 - ((py - fy) / (s * 0.72)) ** 2)) + 0.012;
  const T= (pts: GeomVec2[]) => tris(pts.flatMap(([px, py]) => [px, py, sz(px, py)]), 0xffc04a, 0, em);
  T([[-s * 0.44, fy + s * 0.1], [-s * 0.16, fy + s * 0.1], [-s * 0.3, fy + s * 0.34]]);
  T([[s * 0.16, fy + s * 0.1], [s * 0.44, fy + s * 0.1], [s * 0.3, fy + s * 0.34]]);
  T([[-s * 0.46, fy - s * 0.14], [s * 0.46, fy - s * 0.14], [0, fy - s * 0.42]]);
  const e= light(0, s * 0.8, 0, { color: 0xff9a3a, int: 1.6, range: 3.5, night: 1, glow: 0.55, flick: 0.3 });
  B.pop();
  return e;
}
function festivalLine(a: GeomVec3, b: GeomVec3, sag: number, n: number, colors: GeomColor[]) { // catenary of little lanterns between two posts (frame coords [x,y,z])
  const pts= [];
  for (let i= 0; i <= 24; i++) {
    const t= i / 24;
    pts.push(new V3(lerp(a[0], b[0], t), lerp(a[1], b[1], t) - Math.sin(t * PI) * sag, lerp(a[2], b[2], t)));
  }
  for (let i= 0; i < 24; i++) {
    const p0= pts[i], p1 = pts[i + 1], L = p0.distanceTo(p1);
    const mid= p0.clone().add(p1).multiplyScalar(0.5);
    const yaw= Math.atan2(-(p1.z - p0.z), p1.x - p0.x);
    const pitch= Math.atan2(p1.y - p0.y, Math.hypot(p1.x - p0.x, p1.z - p0.z));
    box(mid.x, mid.y - 0.01, mid.z, L + 0.02, 0.02, 0.02, 0x3a2a1e, 0, { ry: yaw, rz: pitch, occ: 0 });
  }
  const out= [];
  for (let i= 1; i < n; i++) {
    const t= i / n, p = new V3(lerp(a[0], b[0], t), lerp(a[1], b[1], t) - Math.sin(t * PI) * sag, lerp(a[2], b[2], t));
    const c= colors[i % colors.length];
    box(p.x, p.y - 0.06, p.z, 0.012, 0.06, 0.012, 0x3a2a1e, 0, { occ: 0 });
    lathe(p.x, p.y - 0.32, p.z, [[0.001, 0], [0.08, 0.03], [0.11, 0.13], [0.08, 0.24], [0.001, 0.26]], 8, c, 0, { em: -1.25, occ: 0 });
    out.push({ p: B.wp(p.x, p.y - 0.2, p.z), c });
  }
  return out;
}
