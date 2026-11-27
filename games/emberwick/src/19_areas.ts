// ============================================================================
//  YOUR OWN PLACES — custom areas, written as a few lines of text and built
//  live on top of the valley. One area per text:
//
//    area "Hollyhock Green" at 92, 40 radius 26 title "a hamlet by the river"
//    house cottage "Rose Cottage" at 4, -6 rot 90 hearth lit
//    npc "Old Tam" at 2, -2 look farmer
//      say "Fine evening for it."
//    tree oak at -8, 10 scale 1.2
//    path width 2.4 points 0,0 10,4 20,4
//
//  Positions are metres from the area's centre: the first number is east (+)
//  or west (−), the second south (+) or north (−). rot turns a thing, in
//  degrees: at 0 its front faces south, 90 east, 180 north, 270 west.
//  Indented lines carry on the line above (what people say, what signs read).
//  The editor (20_editor.js) writes this same text, so either can be used.
// ============================================================================
const AREA_KEY: any = 'emberwick.areas.v1';
const ACATS: any = ['Buildings', 'Props', 'Nature', 'Fire & light', 'Folk & beasts', 'Ground', 'Danger'];

// ---- the catalogue ------------------------------------------------------------------------------------------------
// prop specs: t = num | int | enum | color | text | lines | script | size | points
const AP: any = {
  num: (def: any, min: any, max: any, step: any = 0.1, o: any) => ({ t: 'num', def, min, max, step, ...o }),
  int: (def: any, min: any, max: any, o: any) => ({ t: 'int', def, min, max, step: 1, ...o }),
  en: (def: any, opts: any, o: any) => ({ t: 'enum', def, opts, ...o }),
  col: (def: any, o: any) => ({ t: 'color', def, ...o }),
  str: (o: any) => ({ t: 'text', def: '', ...o }),
  lines: (o: any) => ({ t: 'lines', def: null, ...o }),
  size: (def: any, min: any, max: any, o: any) => ({ t: 'size', def, min, max, ...o }),
};
const AK: any = {};
const AKA: any = { houses: 'house', cottage: 'house', building: 'house', trees: 'tree', bushes: 'bush', rocks: 'rock', stone: 'rock', boulder: 'rock',
  chicken: 'chickens', hen: 'chickens', hens: 'chickens', duck: 'ducks', bat: 'bats', cats: 'cat', person: 'npc', villager: 'npc', folk: 'npc',
  lamp: 'lamppost', lantern: 'lamppost', fire: 'campfire', bonfire: 'campfire', forest: 'grove', wood: 'grove', woods: 'grove', orchard: 'grove',
  road: 'path', track: 'path', hedge: 'hedgerow', drystone: 'wall', level: 'flatten', lake: 'pond', pool: 'pond', mushroom: 'mushrooms', toadstools: 'mushrooms',
  flower: 'flowers', candle: 'candles', zone: 'gloam', enemies: 'gloam', grave: 'gravestone', notice: 'noticeboard', barrels: 'barrel', crates: 'crate', stall: 'stall', market: 'stall' };
function akind(name: any, d: any) : any {
  const K: any = Object.assign({ name, label: name[0].toUpperCase() + name.slice(1), desc: '', cat: 'Props', icon: 'prop', variants: null, def: null, named: false,
    rot: true, scale: null, lift: false, sticky: false, multi: false, r: 0.6, props: {}, order: 1, ground: null, build: null, clearGrass: 0 }, d);
  // every key the kind understands, in the order the text writes them
  K.keys = {}; K.korder = [];
  const add: any = (k: any, sp: any) => { K.keys[k] = sp; K.korder.push(k); };
  if (!K.multi) add('at', { t: 'xy' });
  if (K.rot) add('rot', AP.num(0, -720, 720, 15, { unit: '°' }));
  if (K.scale) add('scale', K.scale);
  if (K.lift) add('y', AP.num(0, -2, 12, 0.1, { label: 'lift' }));
  for (const [k, sp] of entriesAny(K.props)) if (sp.t !== 'lines' && sp.t !== 'script') add(k, sp);
  if (K.multi) add('points', { t: 'points' });
  for (const [k, sp] of entriesAny(K.props)) if (sp.t === 'lines' || sp.t === 'script') add(k, sp);
  // words that mean themselves: lit, unlit, thatch... (an enum value used on its own)
  K.bare = {};
  const seen: any = {};
  for (const [k, sp] of entriesAny(K.props)) if (sp.t === 'enum') for (const v of sp.opts) seen[v] = seen[v] ? '?' : k;
  for (const [v, k] of entriesAny(seen)) if (k !== '?' && !(v in K.keys) && !(K.variants || []).includes(v)) K.bare[v] = k;
  K.alias = { rotation: 'rot', turn: 'rot', angle: 'rot', size: 'size', colour: 'color', height: K.props.height ? 'height' : 'y', lift: 'y', points: 'points', pts: 'points' };
  for (const k of Object.keys(K.props)) if (k.endsWith('color')) K.alias[k.replace('color', 'colour')] = k;
  if (K.props.wall && !K.props.color) K.alias.color = K.alias.colour = 'wall';   // a house's colour is its walls
  if (K.props.title) K.alias.subtitle = 'title';   // the panel calls it that
  if (K.props.talk) { K.keys.say = { t: 'script', role: 'say', prop: 'talk' }; K.keys.reply = { t: 'script', role: 'reply', prop: 'talk' }; }
  K.words = [...Object.keys(K.keys), ...Object.keys(K.bare), ...(K.variants || [])];
  AK[name] = K;
  return K;
}
const hexc: any = (v: any) => typeof v === 'number' ? v : parseInt(String(v).slice(1), 16);
const AC_NAMES: any = { white: '#f2ece0', black: '#1e1a16', red: '#b83a30', green: '#4a7a3a', blue: '#3a5a8a', yellow: '#e0b44a', brown: '#7b5233', grey: '#8a8a84', gray: '#8a8a84',
  purple: '#6a3a7a', orange: '#d8661c', pink: '#e08aa8', gold: '#e0b44a', cream: '#ebe1ca', teal: '#2f6a6a', navy: '#24304a', maroon: '#6b2a2a' };
const fmtc: any = (n: any) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);

// ---- small helpers the builders share -----------------------------------------------------------------------------
function hashStr(s: any) : any { let h: any = 2166136261; for (let i: any = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const slug: any = (s: any) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
const q2: any = (v: any) => Math.round(v * 50) / 50;   // random sizes on a coarse grid (keeps the shape cache small)
function inF(o: any, fn: any, dy: any = 0) : any { B.push(o.x, o.y + dy, o.z, o.ry); try { fn(); } finally { B.pop(); } }
// the ground as it is right now, without whatever pad this object is about to add
function levelAt(x: any, z: any, ry: any, hx: any, hz: any) : any {
  const c: any = Math.cos(ry), s: any = Math.sin(ry); let sum: any = 0, n: any = 0;
  for (let i: any = -2; i <= 2; i++) for (let j: any = -2; j <= 2; j++) { const lx: any = (i / 2) * hx, lz: any = (j / 2) * hz; sum += terrainHA(x + lx * c + lz * s, z - lx * s + lz * c); n++; }
  return Math.round((sum / n) * 20) / 20;
}
function rangeAt(x: any, z: any, ry: any, hx: any, hz: any) : any {
  const c: any = Math.cos(ry), s: any = Math.sin(ry); let lo: any = 1e9, hi: any = -1e9;
  for (let i: any = -2; i <= 2; i++) for (let j: any = -2; j <= 2; j++) { const lx: any = (i / 2) * hx, lz: any = (j / 2) * hz, h: any = terrainH(x + lx * c + lz * s, z - lx * s + lz * c); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  return [lo, hi];
}
// where a thing stands: on the ground, or on a floor if there's one under it
function ystand(x: any, z: any, lift: any = 0) : any { const t: any = terrainH(x, z), g: any = groundAt(x, z, t + lift + 0.6).h; return Math.max(g, t + lift); }
function obbTest(x: any, z: any, ry: any, hx: any, hz: any) : any { const c: any = Math.cos(ry), s: any = Math.sin(ry); return (px: any, pz: any, r: any = 0) => { const dx: any = px - x, dz: any = pz - z, lx: any = dx * c - dz * s, lz: any = dx * s + dz * c; return Math.abs(lx) < hx + r && Math.abs(lz) < hz + r; }; }
function clearVeg(h: any, test: any) : any { for (const v of BASEVEG) if (test(v.x, v.z, v.r * 0.6)) { vegShow(v, false); h.veg.push(v); } }
function boundsAround(x: any, z: any, r: any) : any { return { x0: x - r, x1: x + r, z0: z - r, z1: z + r }; }
function boundsPts(pts: any, pad: any) : any { let x0: any = 1e9, x1: any = -1e9, z0: any = 1e9, z1: any = -1e9; for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { x0: x0 - pad, x1: x1 + pad, z0: z0 - pad, z1: z1 + pad }; }
function bUnion(a: any, b: any) : any { if (!a) return b ? { ...b } : null; if (!b) return a; return { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) }; }
const bHit: any = (a: any, b: any) => a && b && a.x0 <= b.x1 && a.x1 >= b.x0 && a.z0 <= b.z1 && a.z1 >= b.z0;
// plants from the valley's own instanced kinds, gathered per object and drawn as instances
function aPlant(h: any, kind: any, x: any, z: any, s: any = 1, o: any = {}) : any {
  const vs: any = IVEG.kinds.get(kind); if (!vs) return;
  const vi: any = o.v ?? Math.floor(R() * vs.length), meta: any = IVEG.meta.get(kind)[vi];
  const y: any = o.y ?? terrainH(x, z);
  const k: any = kind + ':' + vi; let L: any = h.plants.get(k); if (!L) h.plants.set(k, L = []);
  L.push({ x, y: y + (o.dy ?? -0.05), z, s, ry: o.ry ?? rnd(0, TAU), c: o.c ?? (1 + (R() - 0.5) * 0.16) });
  if (o.col !== false && meta.r) addCircW(x, z, meta.r * s, y - 1, y + (meta.h || 3) * s);
  if (meta.canopy && o.leaves !== false) CANOPIES.push({ x, y: y + meta.canopy.y * s, z, c: meta.canopy.c, r: meta.canopy.r * s, pine: meta.canopy.pine });
}
function flushPlants(h: any) : any {
  const m4: any = new THREE.Matrix4(), q: any = new THREE.Quaternion(), sc: any = new V3(), p: any = new V3(), c: any = new THREE.Color();
  for (const [k, L] of h.plants) {
    const [kind, vi]: any = k.split(':'), geo: any = IVEG.kinds.get(kind)[+vi];
    const mesh: any = new THREE.InstancedMesh(geo, AREAS.vegMat, L.length);
    L.forEach((it: any, i: any) => { q.setFromAxisAngle(UPV, it.ry); sc.set(it.s, it.s, it.s); p.set(it.x, it.y, it.z); mesh.setMatrixAt(i, m4.compose(p, q, sc)); mesh.setColorAt(i, c.setRGB(it.c, it.c, it.c)); });
    mesh.castShadow = mesh.receiveShadow = true; mesh.computeBoundingSphere(); mesh.computeBoundingBox();
    mesh.userData.keepGeo = true;
    h.group.add(mesh);
  }
  h.plants.clear();
}
// a readable thing: a sign, a notice board, a signpost
function readSpot(h: any, o: any, verb: any, what: any, lines: any) : any {
  if (!lines || !lines.length) return;
  SPOTS.push({ id: h.fid, x: o.x, y: o.y, z: o.z, r: 0.5, verb, name: o.name || what, title: '', act: () => converse(null, async () => { for (const l of lines) await say(o.name || 'It reads', l); }) });
}

// ---- buildings ------------------------------------------------------------------------------------------------------
const HOUSE: any = {
  cottage: { size: [8, 6], ext: 0xebe1ca, extPat: PAT.PLASTER, int: 0xe2d6bc, intPat: PAT.PLASTER, timber: 0x5a3d26, plinth: 0x8b857a, roof: 'thatch', roofC: 0xc4a052, door: 0x6a3a5a, shutters: true, flowers: true },
  timber: { size: [9, 7], ext: 0xeadcbc, extPat: PAT.PLASTER, int: 0xd9c9a6, intPat: PAT.PLASTER, timber: 0x4a3020, plinth: 0x8b857a, roof: 'tile', roofC: 0xb4553a, door: 0x6b3a24, shutters: true },
  stone: { size: [8, 6.5], ext: 0x9a948a, extPat: PAT.STONE, int: 0xd8ccb0, intPat: PAT.PLASTER, timber: null, plinth: null, roof: 'slate', roofC: 0x5d5f66, door: 0x3a4a5a },
  brick: { size: [9, 7], ext: 0x9c4a34, extPat: PAT.BRICK, int: 0xe6d5b8, intPat: PAT.PLASTER, timber: null, plinth: 0x7a746c, roof: 'tile', roofC: 0x8a3a2a, door: 0x2a4a3a, shutters: true },
  barn: { size: [10, 8], ext: 0x8a3a2a, extPat: PAT.PLANK, int: 0x7a5a3a, intPat: PAT.PLANK, timber: null, plinth: null, roof: 'slate', roofC: 0x5a4a3a, door: 0x4a2a1a },
};
const INSIDE_SUB: any = { home: 'Home', shop: 'Shop', tavern: 'Tavern', empty: 'Empty house' };
function winsAlong(len: any, avoid: any) : any {
  const out: any = [], n: any = Math.max(1, Math.floor((len - 1.2) / 2.6));
  for (let i: any = 0; i < n; i++) { const x: any = Math.round((-len / 2 + (i + 0.5) * len / n) * 10) / 10; if (!avoid.some((a: any) => Math.abs(a - x) < 1.45)) out.push(x); }
  return out;
}
function houseDims(P: any, v: any) : any {
  const W: any = clamp(P.size[0], 4, 18), D: any = clamp(P.size[1], 4, 14);
  const floors: any = P.floors >= 2 && D >= 6 && W >= 6 && v !== 'barn' ? 2 : 1;
  return { W, D, floors };
}
function buildHouse(h: any, o: any) : any {
  const P: any = o.P, v: any = o.variant, st: any = HOUSE[v];
  const { W, D, floors }: any = houseDims(P, v);
  const t: any = v === 'barn' ? 0.25 : 0.3, ix: any = W / 2 - t, iz: any = D / 2 - t;
  const levels: any = floors === 2 ? [0.2, 3.1] : [v === 'barn' ? 0.12 : 0.2];
  const wallTop: any = floors === 2 ? 5.8 : v === 'barn' ? 4.0 : 3.0;
  const ext: any = P.wall ? hexc(P.wall) : st.ext, roofC: any = P.roofcolor ? hexc(P.roofcolor) : st.roofC, doorC: any = P.door ? hexc(P.door) : st.door;
  const style: any = { ext, extPat: st.extPat, int: st.int, intPat: st.intPat, timber: st.timber, plinth: st.plinth ? { h: 0.55, c: st.plinth } : null, trim: st.timber ?? 0x4a3020, sill: 0x6e4a2e };
  const hearth: any = v === 'barn' ? 'none' : P.hearth;
  // roof
  const axis: any = W >= D ? 'x' : 'z', RD: any = axis === 'x' ? D : W, RW: any = axis === 'x' ? W : D;
  const rt: any = P.roof || st.roof;
  let roof: any, rise: any;
  if (rt === 'hip') { roof = { type: 'hip', pitch: 30, oh: 0.5, c: roofC, pat: PAT.TILE }; rise = (Math.min(W, D) / 2 + 0.5) * Math.tan(30 * DEG); }
  else {
    const pitch: any = rt === 'thatch' ? 46 : rt === 'slate' ? 40 : 38;
    roof = { type: rt === 'thatch' ? 'thatch' : 'gable', axis, pitch, oh: rt === 'thatch' ? 0.7 : 0.55, c: roofC, pat: rt === 'thatch' ? PAT.THATCH : rt === 'slate' ? PAT.SLATE : PAT.TILE, timber: st.timber, gableWindow: floors === 1 && RW >= 8 && rt !== 'thatch' && v !== 'barn' };
    if (v === 'barn') { roof.gableColor = ext; roof.gablePat = PAT.PLANK; }
    rise = (RD / 2) * Math.tan(pitch * DEG);
  }
  // openings: the door is always on the house's own south wall (turn the house to face it elsewhere)
  const open: any = { S: [], N: [], E: [], W: [] };
  const dx: any = v === 'barn' || W < 6 ? 0 : -Math.round(W * 1.7) / 10;
  if (v === 'barn') {
    open.S.push([0, { type: 'open', x: 0, w: Math.min(3.6, W - 2.4), b: 0, h: 3.2 }]);
    open.E.push([0, wn(1.2, { w: 0.8, b: 1.8, h: 0.8 })]); open.W.push([0, wn(-1.2, { w: 0.8, b: 1.8, h: 0.8 })]);
  } else {
    const wo: any = st.shutters ? { shutters: doorC } : {};
    open.S.push([0, dr(dx, 1.1, { color: doorC })]);
    for (const x of winsAlong(W, [dx])) open.S.push([0, wn(x, { ...wo, flowers: !!st.flowers })]);
    for (const x of winsAlong(W, [])) open.N.push([0, wn(x, wo)]);
    for (const x of winsAlong(D - 2 * t, [])) { open.E.push([0, wn(x, { w: 0.9, ...wo })]); if (hearth === 'none') open.W.push([0, wn(x, { w: 0.9, ...wo })]); }
    if (floors === 2) {
      for (const k of ['S', 'N']) for (const x of winsAlong(W, [])) open[k].push([1, wn(x, { w: 0.9, h: 1.1, b: 0.9, ...wo, flowers: k === 'S' && !!st.flowers })]);
      for (const x of winsAlong(D - 2 * t, [])) open.W.push([1, wn(x, { w: 0.9, h: 1.1, b: 0.9, ...wo })]);
    }
  }
  const sx: any = ix - 0.62;   // stairs up the east wall
  const stairsSpec: any = floors === 2 ? [{ from: 0, x: sx, z: 0, ry: 0, w: 1.1, len: 3.6, open: 'L', rails: [[sx - 0.68, -1.85, sx - 0.68, 1.6], [sx - 0.68, -1.85, ix, -1.85]] }] : [];
  const label: any = o.name ? `the hearth of ${o.name}` : 'the hearth';
  const ctx: any = { h, P, v, W, D, t, ix, iz, dx, floors, levels, wallTop, hearth, label, sx, fire: null };
  const spec: any = {
    id: h.fid, name: o.name || ({ cottage: 'Cottage', timber: 'Timber house', stone: 'Stone house', brick: 'Brick house', barn: 'Barn' } as any)[v],
    sub: P.title || (v === 'barn' ? 'Barn' : INSIDE_SUB[P.inside]), x: o.x, z: o.z, rot: o.rot, y: h.y0, noPad: true, foundDepth: h.found ?? 0.6,
    w: W, d: D, t, levels, wallTop, floorNames: floors === 2 ? ['Downstairs', 'Upstairs'] : [v === 'barn' ? 'Barn' : 'Inside'], mapColor: roofC, openAir: v === 'barn',
    style, open, roof, stairs: stairsSpec,
    chimneys: hearth !== 'none' ? [{ x: -W / 2 + 0.45, z: 0, from: wallTop - 0.5, top: wallTop + rise + 0.55, w: 0.8, d: 1.0 }] : [],
    floorC: v === 'barn' ? 0x8a7a5a : undefined, floorPat: v === 'barn' ? PAT.STRAW : undefined,
    onWall: (b: any, k: any, f: any) => { if (k === 'S' && f === 0 && v !== 'barn') { const lx: any = dx + 1.0 < W / 2 - 0.5 ? dx + 1.0 : dx - 1.0; wallLantern(lx, 1.95, 0.15, 0, { int: 4.5 }); } },
    furnish: (b: any, f: any) => furnishHouse(b, f, ctx),
  };
  const s0: any = SMOKES.length;
  const b: any = buildRect(spec);
  for (let i: any = s0; i < SMOKES.length; i++) SMOKES[i].when = () => !!(ctx.fire && ctx.fire.lit);
  h.building = b; h.fp = b.footprint;
  return b;
}
function furnishHouse(b: any, f: any, c: any) : any {
  const { ix, iz, P, v }: any = c, two: any = c.floors === 2;
  const ceil: any = (f + 1 < c.levels.length ? c.levels[f + 1] - 0.24 : c.wallTop) - c.levels[f];
  const lamp: any = (x: any = 0, z: any = 0.2, int: any = 3.2) => lanternHang(x, ceil - 0.45, z, { night: 0, int, range: 7, chain: 0.25 });
  const blanket: any = pick([0x8a4a6a, 0x2a4a6a, 0x6a7a3a, 0x8c2f2f, 0x7a5a2a]), rugC: any = pick([0x6a3a5a, 0x8a2f2a, 0x3a5a6a, 0x7a4a2a]), chairC: any = pick([0x6a5a3a, 0x7a2f2a, 0x3a5a6a]);
  if (v === 'barn') {
    hayBale(-ix + 0.6, -iz + 0.4, 0); hayBale(-ix + 0.6, -iz + 1.1, 0.04); hayBale(-ix + 0.62, -iz + 0.75, PI / 2, 0.5);
    hayBale(ix - 0.6, -iz + 0.4, 0); hayBale(ix - 0.62, -iz + 1.1, -0.05);
    if (ix > 4) cart(0.3, -iz * 0.3, 0.2);
    barrel(-ix + 0.5, iz - 0.6); barrel(-ix + 1.12, iz - 0.5, { h: 0.7, r: 0.26 });
    lanternHang(0, ceil - 0.9, 0, { night: 0, int: 3, range: 7, chain: 0.6 });
    return;
  }
  if (f === 0) {
    if (c.hearth !== 'none') {
      const fw: any = Math.max(1.2, Math.min(1.8, iz * 2 - 1.3));
      c.fire = fireplace(-ix + 0.45, 0, PI / 2, { w: fw, d: 0.8, ch: ceil - 0.02, int: 8, pot: P.inside !== 'shop', kf: c.h.fid + ':hearth', lit: c.hearth === 'lit', label: c.label });
      if (c.fire) c.fire.teach = false;   // a home-made hearth fills the lantern but teaches nothing
    }
    const H: any = c.hearth !== 'none';
    if (P.inside === 'home') {
      if (H) { rug(-ix + 1.7, 0, PI / 2, 2.0, 1.5, rugC); if (iz > 2.0) armchair(-ix + 1.75, Math.min(0.95, iz - 0.75), -PI / 2 + 0.35, chairC); }
      const tx: any = two ? Math.min(0.5, c.sx - 1.9) : ix * 0.22, tz: any = -Math.min(0.5, iz * 0.2);
      table(tx, tz, 0, 1.2, 0.75); chair(tx, tz + 0.62, PI); if (!two || tx + 1.0 < c.sx - 0.75) chair(tx + 0.8, tz, -PI / 2);
      candle(tx + 0.15, 0.78, tz - 0.05, { light: true }); mug(tx - 0.25, 0.78, tz + 0.1); plate(tx - 0.05, 0.78, tz + 0.15, 'bread');
      if (!two) { if (ix >= 2.6) bed(ix - 1.15, -iz + 0.62, PI / 2, { len: 1.9, blanket }); if (ix >= 3.2) dresser(-ix * 0.15, -iz + 0.3, 0); }
      else if (ix >= 3) dresser(-ix * 0.2, -iz + 0.3, 0);
      hangingHerbs(tx, ceil - 0.02, tz - 0.9, 4);
      if (!two && ix >= 3) { barrel(ix - 0.45, iz - 0.45, { top: 'apples' }); sack(ix - 1.15, iz - 0.4, 0.3); }
      lamp(tx, 0.4);
    } else if (P.inside === 'shop') {
      const cl: any = Math.min(2.8, ix * 1.1), cx: any = -ix * 0.1, cz: any = -iz * 0.15;
      counter(cx, cz, 0, cl);
      candle(cx + cl * 0.35, 1.05, cz, { light: true });
      for (let i: any = 0; i < 3; i++) jar(cx - cl * 0.3 + i * 0.25, 1.05, cz - 0.1, pick([0xc9b48a, 0x9e6a3c, 0x7d8a5a, 0xb05a3a]));
      shelfUnit(-ix * 0.45, -iz + 0.22, 0, 1.6, 2.0, 'mixed');
      if (!two) shelfUnit(ix * 0.45, -iz + 0.22, 0, 1.6, 2.0, 'mixed');
      crate(-ix + 0.45, iz - 0.45, 0.2, 0.55, { fill: 'apples' });
      if (!two) { barrel(ix - 0.45, iz - 0.45, { top: 'apples' }); sack(ix - 0.5, iz - 1.2, 0.4); }
      lamp(cx, 0.6);
    } else if (P.inside === 'tavern') {
      const cl: any = Math.min(3.2, ix * 1.1), cx: any = two ? Math.min(ix * 0.1, c.sx - 1.4 - cl / 2) : ix * 0.1;
      counter(cx, -iz + 1.05, 0, cl);
      kegRack(cx, -iz + 0.35, 0, Math.max(2, Math.min(4, Math.floor(cl / 0.7))));
      for (let i: any = 0; i < 3; i++) mug(cx - cl * 0.3 + i * cl * 0.3, 1.05, -iz + 1.0);
      const tables: any = [[-ix * 0.25, iz * 0.4]]; if (!two && ix > 3) tables.push([ix * 0.45, iz * 0.35]);
      for (const [x, z] of tables) { roundTable(x, z, 0.55); for (let i: any = 0; i < 3; i++) { const a: any = i * TAU / 3 + 0.5; stool(x + Math.cos(a) * 0.9, z + Math.sin(a) * 0.9); } candle(x, 0.76, z, { light: true }); mug(x + 0.2, 0.76, z - 0.1); }
      chandelier(0, ceil - 0.15, 0.2, 0.55, 6, { int: 6, chain: 0.3 });
    } else lamp();
  } else {   // upstairs: a bedroom, kept to the west side, clear of the stairwell
    bed(-ix + 1.15, -iz + 0.62, PI / 2, { len: 1.9, blanket });
    nightstand(-ix + 0.35, -iz + 1.55, PI / 2);
    if (ix > 3.4) bed(-ix + 3.3, -iz + 0.62, PI / 2, { len: 1.9, blanket: pick([0x2a4a6a, 0x6a7a3a, 0x8c2f2f]) });
    rug(-ix * 0.35, 0.4, 0, 2.2, 1.4, rugC);
    chest(-ix + 0.6, iz - 0.55, PI / 2);
    if (iz > 2.6) wardrobe(-ix + 0.32, iz - 1.8, PI / 2);
    plantPot(-ix * 0.1, iz - 0.3);
    lamp(-ix * 0.3, 0);
  }
}
akind('house', { cat: 'Buildings', icon: 'house', desc: 'A house you can walk into. The door is on its south side: turn it to face the way you want.', variants: Object.keys(HOUSE), def: 'cottage', named: true, r: 4, order: 0,
  props: {
    title: AP.str({ label: 'subtitle' }),
    size: AP.size((v: any) => HOUSE[v].size.slice(), [4, 4], [18, 14]),
    floors: AP.int(1, 1, 2),
    roof: AP.en((v: any) => HOUSE[v].roof, ['thatch', 'tile', 'slate', 'hip']),
    wall: AP.col((v: any) => fmtc(HOUSE[v].ext), { label: 'walls' }), roofcolor: AP.col((v: any) => fmtc(HOUSE[v].roofC), { label: 'roof colour' }), door: AP.col((v: any) => fmtc(HOUSE[v].door)),
    inside: AP.en('home', ['home', 'shop', 'tavern', 'empty']),
    hearth: AP.en((v: any) => v === 'barn' ? 'none' : 'lit', ['lit', 'unlit', 'none']),
    level: AP.en('yes', ['yes', 'no'], { label: 'level the ground' }),
  },
  pickR: (P: any) => Math.hypot(P.size[0], P.size[1]) / 2,
  ground(h: any, o: any) : any {
    const { W, D }: any = houseDims(o.P, o.variant);
    if (o.P.level === 'yes') {
      h.y0 = levelAt(o.x, o.z, o.ry, W / 2, D / 2);
      h.pads.push(addPad({ x: o.x, z: o.z, ry: o.ry, hx: W / 2, hz: D / 2, m: 1.2, f: 3.5, y: h.y0 }));
    } else { const [lo, hi]: any = rangeAt(o.x, o.z, o.ry, W / 2, D / 2); h.y0 = Math.round(hi * 20) / 20; h.found = hi - lo + 0.6; }
    clearVeg(h, obbTest(o.x, o.z, o.ry, W / 2 + 1.4, D / 2 + 1.4));
    h.gb = boundsAround(o.x, o.z, Math.hypot(W, D) / 2 + 5);
  },
  build: buildHouse,
});
akind('stall', { cat: 'Buildings', icon: 'stall', label: 'Market stall', desc: 'A striped market stall with goods on the counter.', r: 1.6, order: 0, clearGrass: 1.8,
  props: { cloth: AP.col('#b83a30'), goods: AP.en('produce', ['produce', 'cloth', 'pots', 'none']) },
  build(h: any, o: any) : any { inF(o, () => marketStall(0, 0, 0, { cloth: hexc(o.P.cloth), goods: o.P.goods === 'none' ? 'empty' : o.P.goods })); h.fp = rectWorld(o, 2.8, 1.6); } });
akind('well', { cat: 'Buildings', icon: 'well', desc: 'A stone well with a little roof.', r: 1.2, order: 0, clearGrass: 1.6, build(h: any, o: any) : any { inF(o, () => well(0, 0)); } });
akind('tent', { cat: 'Buildings', icon: 'tent', desc: 'A canvas tent on poles.', r: 1.8, order: 0, clearGrass: 1.8,
  props: { color: AP.col('#d8ccb0') },
  build(h: any, o: any) : any {
    const c: any = hexc(o.P.color), w: any = 2.6, d: any = 3.2, hh: any = 1.9, half: any = w / 2, ang: any = Math.atan2(hh, half), sl: any = Math.hypot(hh, half);
    inF(o, () => {
      for (const s of [-1, 1]) { B.push(s * half / 2, hh / 2, 0, 0, 0, -s * ang); box(0, -0.02, 0, sl + 0.08, 0.04, d, s < 0 ? c : shade(c, 0.9), PAT.NOISE); B.pop(); }
      tris([-half, 0, -d / 2, half, 0, -d / 2, 0, hh, -d / 2], shade(c, 0.85), PAT.NOISE);
      tris([-half, 0, -d / 2, 0, hh, -d / 2, half, 0, -d / 2], shade(c, 0.85), PAT.NOISE);
      for (const s of [-1, 1]) tris([s * half, 0, d / 2, s * 0.18, hh * 0.86, d / 2 + 0.06, s * 0.5, 0, d / 2 + 0.5], shade(c, 0.95), PAT.NOISE);
      for (const zz of [-d / 2 - 0.05, d / 2 + 0.05]) cyl(0, 0, zz, 0.035, 0.04, hh + 0.25, 5, WOOD.dark, PAT.BARK);
      box(0, 0.0, 0, w - 0.2, 0.02, d - 0.2, 0x6a5a3a, PAT.RUG, { uv: 2, occ: 0 });
      colBox(0, 0, w, d, 0, hh);
    });
    h.fp = rectWorld(o, w, d);
  } });

// ---- props ----------------------------------------------------------------------------------------------------------------
function rectWorld(o: any, w: any, d: any) : any { const c: any = Math.cos(o.ry), s: any = Math.sin(o.ry); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]: any) => { const lx: any = a * w / 2, lz: any = b * d / 2; return [o.x + lx * c + lz * s, o.z - lx * s + lz * c]; }); }
const simple: any = (name: any, label: any, desc: any, r: any, fn: any, extra: any = {}) => akind(name, { cat: 'Props', icon: name, label, desc, r, lift: true, sticky: true, build(h: any, o: any) : any { inF(o, () => fn(o, h)); }, ...extra });
simple('barrel', 'Barrel', 'A wooden barrel, standing or on its side.', 0.4, (o: any) => barrel(0, 0, { lying: o.P.pose === 'lying', top: o.P.top === 'apples' ? 'apples' : null }), { props: { pose: AP.en('standing', ['standing', 'lying'], { bare: true }), top: AP.en('none', ['none', 'apples'], { label: 'filled with' }) } });
simple('crate', 'Crate', 'A wooden crate, empty or full of apples or cabbages.', 0.4, (o: any) => crate(0, 0, 0, o.P.size, { fill: o.P.fill === 'empty' ? null : o.P.fill }), { props: { size: AP.num(0.6, 0.3, 1.4, 0.05), fill: AP.en('empty', ['empty', 'apples', 'cabbage']) } });
simple('sack', 'Sack', 'A sack of flour or grain.', 0.3, (o: any) => sack(0, 0, 0, hexc(o.P.color)), { props: { color: AP.col('#c8b48a') } });
simple('chest', 'Chest', 'A sturdy chest with iron bands.', 0.5, (o: any) => chest(0, 0, 0, hexc(o.P.color)), { props: { color: AP.col(fmtc(WOOD.red)) } });
simple('bench', 'Bench', 'A plank bench.', 0.8, (o: any) => bench(0, 0, 0, o.P.length, { back: o.P.back === 'yes' }), { props: { length: AP.num(1.6, 0.8, 4, 0.1), back: AP.en('no', ['no', 'yes'], { label: 'backrest' }) } });
simple('table', 'Table', 'A table, with or without a cloth.', 0.8, (o: any) => table(0, 0, 0, o.P.size[0], o.P.size[1], { cloth: o.P.cloth ? hexc(o.P.cloth) : undefined }), { props: { size: AP.size([1.6, 0.9], [0.6, 0.5], [4, 2]), cloth: AP.col(null, { none: true }) } });
simple('chair', 'Chair', 'A wooden chair.', 0.3, () => chair(0, 0, 0));
simple('stool', 'Stool', 'A three-legged stool.', 0.25, () => stool(0, 0));
simple('haybale', 'Hay bale', 'A bale of hay.', 0.6, () => hayBale(0, 0, 0));
simple('woodpile', 'Woodpile', 'Split logs stacked for winter.', 1.0, () => woodpile(0, 0, 0));
simple('cart', 'Cart', 'A hay cart with a couple of pumpkins.', 1.2, () => cart(0, 0, 0));
simple('scarecrow', 'Scarecrow', 'He is doing his best.', 0.5, () => scarecrow(0, 0, 0));
simple('pumpkin', 'Pumpkin', 'A pumpkin. Scale it up for a prize-winner.', 0.3, (o: any) => { const r: any = 0.22 * o.s; pumpkin(0, 0, 0, r); colCirc(0, 0, r * 1.05, 0, r * 1.6); }, { scale: AP.num(1, 0.4, 4, 0.1) });
simple('jackolantern', 'Jack-o’-lantern', 'A carved pumpkin that glows after dark.', 0.3, (o: any) => { jackOLantern(0, 0, q2(0.24 * o.s), 0); colCirc(0, 0, 0.26 * o.s, 0, 0.4 * o.s); }, { scale: AP.num(1, 0.5, 3, 0.1), icon: 'pumpkin' });
simple('plantpot', 'Plant pot', 'A pot of greenery.', 0.25, () => plantPot(0, 0));
simple('anvil', 'Anvil', 'An anvil on a stump.', 0.4, () => anvil(0, 0, 0));
simple('grindstone', 'Grindstone', 'A grindstone in a wooden frame.', 0.4, () => grindstone(0, 0, 0));
simple('cauldron', 'Cauldron', 'A bubbling cauldron over a little fire.', 0.5, (o: any) => cauldron(0, 0, { c: hexc(o.P.brew) }), { props: { brew: AP.col('#3cc85a') } });
simple('gravestone', 'Gravestone', 'A weathered headstone.', 0.4, (o: any) => gravestone(0, 0, 0, ['round', 'cross', 'slab'].indexOf(o.P.style)), { props: { style: AP.en('round', ['round', 'cross', 'slab']) } });
simple('noticeboard', 'Notice board', 'A board of pinned notices. Give it text and it can be read.', 0.9, () => noticeBoard(0, 0, 0), { named: true, props: { text: AP.lines() }, after(h: any, o: any) : any { readSpot(h, o, 'Read', 'the notices', o.P.text); } });
simple('signpost', 'Signpost', 'A post with pointing arms. Give it text and it can be read.', 0.3, (o: any) => signpost(0, 0, 0, [[0], [0, PI], [0, PI / 2, PI], [0, PI / 2, PI, -PI / 2]][o.P.arms - 1]), { named: true, props: { arms: AP.int(2, 1, 4), text: AP.lines() }, after(h: any, o: any) : any { readSpot(h, o, 'Read', 'the signpost', o.P.text); } });
simple('sign', 'Sign', 'A painted board on a post, with words on it.', 0.3, () => {
  cyl(0, 0, 0, 0.06, 0.07, 1.35, 6, WOOD.dark, PAT.BARK);
  box(0, 0.85, 0.07, 0.95, 0.52, 0.06, WOOD.light, PAT.PLANK); box(0, 0.88, 0.105, 0.82, 0.4, 0.01, 0x3a2a1a, PAT.NOISE);
  for (let i: any = 0; i < 3; i++) box(rnd(-0.18, 0.18), 0.95 + i * 0.1, 0.112, q2(rnd(0.2, 0.5)), 0.035, 0.005, 0xe8c27a, 0, { em: -0.8 });
  colCirc(0, 0, 0.12, 0, 1.4);
}, { named: true, props: { text: AP.lines() }, icon: 'sign', after(h: any, o: any) : any { readSpot(h, o, 'Read', 'the sign', o.P.text); } });
simple('weaponrack', 'Weapon rack', 'Swords and spears on a rack.', 0.9, () => weaponRack(0, 0, 0));
simple('armorstand', 'Armour stand', 'A suit of armour on a stand.', 0.4, () => armorStand(0, 0, 0));
simple('telescope', 'Telescope', 'A brass telescope on a tripod.', 0.5, () => telescope(0, 0, 0));
simple('lectern', 'Lectern', 'A reading stand.', 0.35, () => lectern(0, 0, 0));
simple('standingstone', 'Standing stone', 'A tall old stone.', 0.6, (o: any) => { const s: any = o.s; sph(0, 1.05 * s, 0, q2(0.6 * s), vary(0x8a857c, 0.08), PAT.STONE, { det: 1, jit: 0.22, sy: 2.0, sx: 0.8, sz: 0.55 }); colCirc(0, 0, 0.42 * s, -0.5, 2.3 * s); }, { scale: AP.num(1, 0.4, 4, 0.1) });
simple('banner', 'Banner', 'A cloth banner on a pole.', 0.3, (o: any) => { cyl(0, 0, 0, 0.05, 0.06, 2.9, 6, WOOD.dark, PAT.BARK); box(0, 2.7, 0.06, 0.95, 0.05, 0.05, WOOD.dark); banner(0, 1.25, 0.06, 0, 0.75, 1.45, hexc(o.P.color)); colCirc(0, 0, 0.1, 0, 2.9); }, { props: { color: AP.col('#2e4a7a') }, icon: 'flag' });

// ---- nature ----------------------------------------------------------------------------------------------------------------
const TREE_KINDS: any = ['oak', 'maple', 'birch', 'pine', 'apple', 'willow', 'dead', 'hawthorn', 'gloam'];
// shape picks one of the kind's own variant meshes (0 lets the object's name or place in the list decide)
const SHAPE: any = AP.int(0, 0, 6, { label: 'shape' });
const shapeOf: any = (o: any, kind: any) => o.P.shape ? (o.P.shape - 1) % IVEG.kinds.get(kind).length : undefined;
akind('tree', { cat: 'Nature', icon: 'tree', desc: 'A tree. Gloam trees are the cold black ones from the Gloamwood.', variants: TREE_KINDS, def: 'oak', r: 1.6, sticky: true, scale: AP.num(1, 0.4, 2.5, 0.05), props: { shape: SHAPE }, plant: (o: any) => o.variant,
  build(h: any, o: any) : any { aPlant(h, o.variant, o.x, o.z, o.s, { ry: o.ry, v: shapeOf(o, o.variant) }); } });
akind('bush', { cat: 'Nature', icon: 'bush', desc: 'A bush, a clipped hedge or a clump of gorse.', variants: ['bush', 'hedge', 'gorse'], def: 'bush', r: 0.8, sticky: true, scale: AP.num(1, 0.4, 2.5, 0.05), props: { shape: SHAPE }, plant: (o: any) => o.variant,
  build(h: any, o: any) : any { aPlant(h, o.variant, o.x, o.z, o.s, { ry: o.ry, v: shapeOf(o, o.variant) }); } });
akind('rock', { cat: 'Nature', icon: 'rock', desc: 'A rock. Scale it up for a boulder.', r: 0.6, sticky: true, scale: AP.num(1, 0.3, 6, 0.1), props: { shape: SHAPE }, plant: () => 'stone',
  build(h: any, o: any) : any { aPlant(h, 'stone', o.x, o.z, o.s, { ry: o.ry, dy: -0.12 * o.s, v: shapeOf(o, 'stone') }); } });
akind('reeds', { cat: 'Nature', icon: 'reeds', desc: 'A clump of reeds, for the water’s edge.', r: 0.6, sticky: true, scale: AP.num(1, 0.4, 2.5, 0.05), props: { shape: SHAPE }, plant: () => 'reeds', build(h: any, o: any) : any { aPlant(h, 'reeds', o.x, o.z, o.s, { ry: o.ry, v: shapeOf(o, 'reeds') }); } });
akind('mushrooms', { cat: 'Nature', icon: 'shroom', desc: 'Glowing toadstools.', r: 0.5, sticky: true, scale: AP.num(1, 0.4, 3, 0.05), props: { shape: SHAPE }, plant: () => 'shrooms', build(h: any, o: any) : any { aPlant(h, 'shrooms', o.x, o.z, o.s, { ry: o.ry, v: shapeOf(o, 'shrooms') }); } });
const FLOWER_COLS: any = { mixed: [0xe8e2f4, 0xf2c94a, 0xd8433a, 0x9b6ad8, 0xf09ab8, 0xffffff], red: [0xd8433a, 0xc8302a], yellow: [0xf2c94a, 0xf0e070], white: [0xf4f0e8, 0xe8e2f4], purple: [0x9a5ab8, 0xb87ad0], blue: [0x5a7ad8, 0x7a9ae8], pink: [0xf09ab8, 0xe07aa0] };
akind('flowers', { cat: 'Nature', icon: 'flower', desc: 'A patch of wildflowers.', r: 1.2, sticky: true, rot: false,
  props: { color: AP.en('mixed', Object.keys(FLOWER_COLS), { label: 'colours' }), radius: AP.num(1.5, 0.5, 8, 0.1), count: AP.int(24, 4, 120) },
  pickR: (P: any) => P.radius,
  build(h: any, o: any) : any {
    const pal: any = FLOWER_COLS[o.P.color] || FLOWER_COLS.mixed, r: any = o.P.radius;
    for (let i: any = 0; i < o.P.count; i++) {
      const a: any = R() * TAU, d: any = Math.sqrt(R()) * r, x: any = o.x + Math.cos(a) * d, z: any = o.z + Math.sin(a) * d, y: any = terrainH(x, z), hh: any = q2(rnd(0.22, 0.4));
      cyl(x, y - 0.02, z, 0.008, 0.012, hh, 3, 0x4a7a34, 0, { sway: 0.5 });
      sph(x, y + hh, z, q2(rnd(0.045, 0.07)), vary(pick(pal), 0.06), 0, { det: 0, sway: 0.7, occ: 0 });
    }
  } });
const GROVES: any = { mixed: ['oak', 'maple', 'birch', 'oak', 'pine'], oak: ['oak'], pine: ['pine'], birch: ['birch'], orchard: ['apple'], willow: ['willow'], gloam: ['gloam', 'gloam', 'dead'], dead: ['dead', 'hawthorn'] };
akind('grove', { cat: 'Nature', icon: 'grove', desc: 'A whole stand of trees at once. Orchards come in rows.', variants: Object.keys(GROVES), def: 'mixed', r: 6, sticky: false, rot: false,
  props: { radius: AP.num(10, 3, 40, 0.5), count: AP.int(12, 2, 80) },
  pickR: (P: any) => P.radius,
  build(h: any, o: any) : any {
    const r: any = o.P.radius, n: any = o.P.count, kinds: any = GROVES[o.variant], placed: any = [];
    if (o.variant === 'orchard') {
      const step: any = 4.2, m: any = Math.max(1, Math.round(r / step));
      for (let i: any = -m; i <= m; i++) for (let j: any = -m; j <= m; j++) { if (placed.length >= n) break; const x: any = o.x + i * step + rnd(-0.3, 0.3), z: any = o.z + j * step + rnd(-0.3, 0.3); if (Math.hypot(x - o.x, z - o.z) > r) continue; placed.push([x, z]); aPlant(h, 'apple', x, z, rnd(0.9, 1.15)); }
      return;
    }
    for (let k: any = 0; k < n * 12 && placed.length < n; k++) {
      const a: any = R() * TAU, d: any = Math.sqrt(R()) * r, x: any = o.x + Math.cos(a) * d, z: any = o.z + Math.sin(a) * d;
      if (placed.some(([px, pz]: any) => Math.hypot(px - x, pz - z) < 2.6)) continue;
      if (terrainH(x, z) < WATER_Y + 0.1) continue;
      placed.push([x, z]); aPlant(h, pick(kinds), x, z, rnd(0.85, 1.3));
    }
    if (o.variant === 'mixed' || o.variant === 'oak') for (let i: any = 0; i < Math.round(n / 3); i++) { const a: any = R() * TAU, d: any = Math.sqrt(R()) * r; aPlant(h, 'bush', o.x + Math.cos(a) * d, o.z + Math.sin(a) * d, rnd(0.7, 1.1)); }
  } });

// ---- fire & light -----------------------------------------------------------------------------------------------------
const FLAME_KIND: any = { warm: 'hearth', white: 'forge', blue: 'ghost', violet: 'gloam' };
akind('campfire', { cat: 'Fire & light', icon: 'fire', desc: 'A ring of stones and a fire your lantern can kindle or draw from.', named: true, r: 0.7, lift: true, clearGrass: 1.1, scale: AP.num(1, 0.5, 2.5, 0.1),
  props: { state: AP.en('lit', ['lit', 'unlit'], { bare: true, label: 'fire' }) },
  build(h: any, o: any) : any {
    const s: any = o.s;
    inF(o, () => {
      for (let i: any = 0; i < 9; i++) { const a: any = i / 9 * TAU; sph(Math.cos(a) * 0.55 * s, 0.05, Math.sin(a) * 0.55 * s, q2(rnd(0.11, 0.16) * s), vary(0x8a857c, 0.12), PAT.STONE, { det: 0, jit: 0.25, sy: 0.7 }); }
      box(-0.12 * s, 0, 0, 0.6 * s, 0.1 * s, 0.12 * s, WOOD.black, PAT.BARK, { ry: 0.45 }); box(0.1 * s, 0, 0.04, 0.55 * s, 0.1 * s, 0.12 * s, WOOD.dark, PAT.BARK, { ry: -0.5 });
      box(0, -0.01, 0, 0.9 * s, 0.02, 0.9 * s, 0x2a2420, PAT.NOISE, { occ: 0 });
      colCirc(0, 0, 0.55 * s, -0.2, 0.45);
    });
    kfire(h.fid, 'hearth', o.x, o.y + 0.1 * s, o.z, { s: 0.9 * s, lit: o.P.state === 'lit', label: o.name || 'the campfire', teach: false });
  } });
akind('brazier', { cat: 'Fire & light', icon: 'fire', desc: 'An iron fire basket on a stone foot. Its flame can be any colour.', named: true, r: 0.4, lift: true, rot: false,
  props: { state: AP.en('lit', ['lit', 'unlit'], { bare: true, label: 'fire' }), flame: AP.en('warm', Object.keys(FLAME_KIND)) },
  build(h: any, o: any) : any { const f: any = brazier(o.x, o.z, { y: o.y, id: h.fid, kind: FLAME_KIND[o.P.flame], lit: o.P.state === 'lit', label: o.name || 'the brazier' }); f.teach = false; } });
akind('wayfire', { cat: 'Fire & light', icon: 'wayfire', desc: 'A stone wayfire. Kindle it and you can travel here from the map — and the gloam keep away.', named: true, r: 0.8, clearGrass: 1.4,
  props: { state: AP.en('unlit', ['lit', 'unlit'], { bare: true, label: 'fire' }) },
  build(h: any, o: any) : any {
    const y: any = o.y;
    B.push(o.x, y, o.z, o.ry);
    cyl(0, -0.3, 0, 0.62, 0.72, 0.5, 8, 0x8a857c, PAT.STONE);
    cyl(0, 0.2, 0, 0.3, 0.38, 1.5, 8, 0x9a948a, PAT.STONE);
    for (let i: any = 0; i < 4; i++) box(Math.cos(i * PI / 2) * 0.33, 0.7, Math.sin(i * PI / 2) * 0.33, 0.06, 0.6, 0.06, 0x6a665e, PAT.STONE, { ry: i * PI / 2 });
    lathe(0, 1.7, 0, [[0.001, 0], [0.3, 0.02], [0.46, 0.22], [0.42, 0.26], [0.001, 0.12]], 10, 0x6a665e, PAT.STONE);
    box(0, 0.9, 0.36, 0.3, 0.3, 0.04, 0xd8b060, 0, { em: -1.2, occ: 0 });
    B.pop();
    addCircW(o.x, o.z, 0.5, y - 0.5, y + 2);
    MAPDOTS.push({ x: o.x, z: o.z, r: 1.6, c: '#ffcf7a' });
    kfire(h.fid, 'wayfire', o.x, y + 1.95, o.z, { s: 0.8, label: o.name || h.area.hdr.name, wayfire: true, lit: o.P.state === 'lit' });
  } });
akind('lamppost', { cat: 'Fire & light', icon: 'lamp', label: 'Lamp post', desc: 'A lantern on a post that lights itself at dusk.', r: 0.3, sticky: true, build(h: any, o: any) : any { inF(o, () => lampPost(0, 0, { int: 7 })); } });
akind('torch', { cat: 'Fire & light', icon: 'torch', desc: 'A burning torch on a post, day and night.', r: 0.2, sticky: true, lift: true,
  build(h: any, o: any) : any { inF(o, () => { cyl(0, 0, 0, 0.05, 0.07, 1.5, 6, WOOD.dark, PAT.BARK); lathe(0, 1.45, 0, [[0.001, 0], [0.09, 0.02], [0.13, 0.16], [0.001, 0.1]], 8, MET.iron, PAT.METAL); fire(0, 1.55, 0, 0.3, { int: 3.5, range: 6 }); colCirc(0, 0, 0.1, 0, 1.6); }); } });
akind('candles', { cat: 'Fire & light', icon: 'candle', desc: 'A cluster of candles.', r: 0.3, sticky: true, lift: true, rot: false,
  props: { count: AP.int(5, 1, 12) },
  build(h: any, o: any) : any { inF(o, () => { for (let i: any = 0; i < o.P.count; i++) { const a: any = i * 2.4, d: any = i === 0 ? 0 : 0.08 + Math.sqrt(i) * 0.07; candle(Math.cos(a) * d, 0, Math.sin(a) * d, { h: q2(rnd(0.08, 0.26)), holder: false }); } light(0, 0.4, 0, { color: 0xffb35a, int: 1.8, range: 4.5, glow: 0.5, flick: 0.25 }); }); } });
akind('light', { cat: 'Fire & light', icon: 'light', desc: 'A light with nothing to see: a glow to set the mood.', r: 0.4, rot: false, lift: false,
  props: { color: AP.col('#ffb060'), strength: AP.num(6, 0.5, 20, 0.5), range: AP.num(8, 2, 30, 0.5), height: AP.num(1.5, 0, 12, 0.1), when: AP.en('always', ['always', 'night']), glow: AP.en('yes', ['yes', 'no'], { label: 'glow' }) },
  build(h: any, o: any) : any { inF(o, () => light(0, o.P.height, 0, { color: hexc(o.P.color), int: o.P.strength, range: o.P.range, glow: o.P.glow === 'yes' ? 0.8 : 0, night: o.P.when === 'night' ? 1 : 0, flick: 0.08, prio: 1 })); } });
const LANTERN_COLS: any = { festival: [0xff6a3a, 0xffc04a, 0x8adf6a, 0x6ab8ff, 0xd88aff], warm: [0xffb04a, 0xff8a3a, 0xffd07a], blue: [0x6ab8ff, 0x8ad0ff, 0xbfe0ff], green: [0x7affa0, 0xb0ff8a] };
akind('lanterns', { cat: 'Fire & light', icon: 'lanterns', desc: 'Strings of paper lanterns between posts — click post by post.', multi: true, r: 0.4, rot: false,
  props: { colors: AP.en('festival', Object.keys(LANTERN_COLS), { label: 'colours' }) },
  build(h: any, o: any) : any {
    const pts: any = o.pts, pal: any = LANTERN_COLS[o.P.colors], top: any = 2.75;
    for (const [x, z] of pts) { const y: any = terrainH(x, z); cyl(x, y - 0.2, z, 0.06, 0.08, 3.05, 6, WOOD.dark, PAT.BARK); sph(x, y + 2.85, z, 0.09, MET.iron, PAT.METAL, { det: 0 }); addCircW(x, z, 0.1, y - 0.5, y + 3); }
    for (let i: any = 0; i < pts.length - 1; i++) {
      const [x0, z0]: any = pts[i], [x1, z1]: any = pts[i + 1], L: any = Math.hypot(x1 - x0, z1 - z0);
      if (L < 0.5) continue;
      const ls: any = festivalLine([x0, terrainH(x0, z0) + top, z0], [x1, terrainH(x1, z1) + top, z1], Math.min(0.6, L * 0.06), Math.max(3, Math.round(L / 0.9)), pal);
      for (const l of ls) addEmitter(l.p.x, l.p.y, l.p.z, { color: l.c, int: 0, glow: 0.32, night: 1, flick: 0.04 });
      const m: any = ls[Math.floor(ls.length / 2)]; if (m) addEmitter(m.p.x, m.p.y - 0.3, m.p.z, { color: 0xffb060, int: 2.4, range: 6, glow: 0, night: 1, flick: 0.05 });
    }
  } });

// ---- folk & beasts --------------------------------------------------------------------------------------------------
const SKINS: any = [0xe8c0a0, 0xe0b08a, 0xd8a888, 0xc89070, 0xb87a58, 0x8a5a3a, 0xf0d2b8];
const HAIRS: any = [0x2a1a12, 0x4a2e1e, 0x6a3a1e, 0x8a5a2a, 0xd8a040, 0x5a5a5a, 0xd8d4cc, 0xa8442a];
const CLOTHS: any = [0x6a4a3a, 0x8a3a3a, 0x3a5a6a, 0x5a7a4a, 0x8a6a2a, 0x6a4a6a, 0x4a6a8a, 0x7a5a3a, 0x8a2a4a];
const NPC_LOOKS: any = {
  villager: {}, farmer: { hat: 'straw', item: 'pitchfork', beard: 'full', pants: 0x5a4a3a }, guard: { hat: 'helmet', item: 'spear', mail: true, shirt: 0x7a2a22, beard: 'mustache' },
  elder: { hairStyle: 'bald', beard: 'full', hair: 0xe8e4dc, beardC: 0xf0ece4, cloak: 0x6a2a2a, dress: 0x3a2a4a }, child: { build: 'child' },
  smith: { build: 'stout', apron: 0x3a2a1e, item: 'hammer', sleeve: 'skin' }, baker: { build: 'stout', apron: 0xf4efe4, hat: 'chef', shirt: 0xe8dcc8, dress: 0x8a5a2a },
  wizard: { build: 'tall', hat: 'wizard', hatC: 0x3a2a7a, beard: 'long', hair: 0xe8e8f0, item: 'staff', shirt: 0x3a2a6a, dress: 0x2a1e5a }, fisher: { hat: 'cap', hatC: 0x2a3a4a, item: 'rod', shirt: 0x3a5a6a, beard: 'full' },
  bard: { hat: 'cap', hatC: 0x8a2a4a, chest: 'lute', shirt: 0x8a2a4a, sleeve: 0xd8c8a8, hairStyle: 'pony' }, traveller: { hat: 'hood', hatC: 0x4a5a3a, cloak: 0x4a5a3a, back: 'pack', item: 'staff' },
  monk: { hat: 'hood', hatC: 0x6a5a4a, dress: 0x6a5a4a, shirt: 0x6a5a4a, item: 'candle' }, noble: { cloak: 0x5a2a6a, shirt: 0x7a3a8a, sleeve: 0xe8dcc8, hip: 'sword', beard: 'mustache' },
  witch: { hat: 'wizard', hatC: 0x2a2a2a, dress: 0x2a2a3a, shirt: 0x3a2a3a, hairStyle: 'long', hair: 0x2a2a2a, item: 'staff' },
};
const NPC_HELLO: any = { villager: ['Evening.', 'Lovely night for it.'], farmer: ['Fine weather for the harvest.', 'Mind the furrows.'], guard: ['Move along, traveller.', 'All quiet. So far.'], elder: ['When I was young, this was all fields.'],
  child: ['You can’t catch me!'], smith: ['Mind the sparks.'], baker: ['Bread’s still warm.'], wizard: ['Hmm? Ah. A visitor.'], fisher: ['Shh. You’ll scare the fish.'], bard: ['♪ la la la ♪'], traveller: ['Long road behind me. Longer one ahead.'],
  monk: ['Peace to you.'], noble: ['Do you know who I am?'], witch: ['Don’t touch the cauldron, dear.'] };
function npcLook(P: any, key: any) : any {
  const r: any = makeRng(hashStr(key)), pk: any = (a: any) => a[Math.floor(r() * a.length)];
  const base: any = { skin: pk(SKINS), hair: pk(HAIRS), hairStyle: pk(['short', 'short', 'long', 'bun', 'pony', 'braids']), shirt: pk(CLOTHS), pants: pk([0x4a3a2e, 0x3a3a3a, 0x5a4a3a, 0x3a3028]), boots: pk([0x3a2a1e, 0x2a2018]) };
  if (r() < 0.3) base.dress = pk(CLOTHS);
  if (r() < 0.25) { base.hat = pk(['cap', 'kerchief', 'hood']); base.hatC = pk(CLOTHS); }
  const L: any = Object.assign(base, NPC_LOOKS[P.look] || {});
  if (L.sleeve === 'skin') L.sleeve = L.skin;
  if (P.shirt) { L.shirt = hexc(P.shirt); if (L.dress && !NPC_LOOKS[P.look]?.dress) L.dress = shade(hexc(P.shirt), 0.75); }
  if (P.hair) L.hair = hexc(P.hair);
  if (P.hat && P.hat !== 'auto') { if (P.hat === 'none') delete L.hat; else { L.hat = P.hat; if (!L.hatC) L.hatC = pk(CLOTHS); } }
  return L;
}
akind('npc', { cat: 'Folk & beasts', icon: 'person', label: 'Person', desc: 'Someone to talk to. Give them lines to say, and replies for you.', named: true, r: 0.5, lift: true,
  props: {
    title: AP.str(), look: AP.en('villager', Object.keys(NPC_LOOKS)),
    shirt: AP.col(null, { none: true }), hair: AP.col(null, { none: true }), hat: AP.en('auto', ['auto', 'none', 'hood', 'cap', 'straw', 'wizard', 'helmet', 'kerchief', 'chef', 'veil']),
    pose: AP.en('stand', ['stand', 'sit', 'ground', 'kneel', 'lie']), act: AP.en('none', ['none', 'wave', 'hammer', 'stir', 'wipe', 'read', 'knit', 'fish', 'pray', 'drink', 'strum', 'write', 'warm', 'point'], { label: 'doing' }),
    mode: AP.en('idle', ['idle', 'wander', 'patrol']), roam: AP.num(4, 1, 20, 0.5, { label: 'wander radius' }), route: { t: 'points', def: null, rel: true, label: 'patrol route' },
    talk: { t: 'script', def: null }, mutter: AP.lines({ label: 'mutters' }),
  },
  build(h: any, o: any) : any {
    const P: any = o.P, talk: any = P.talk && P.talk.length ? P.talk : null;
    const c: any = new Character({ id: h.fid, name: o.name || 'Stranger', title: P.title, x: o.x, z: o.z, y: o.y, face: o.ry, look: npcLook(P, h.fid),
      pose: P.pose === 'ground' ? 'sit' : P.pose, sitY: P.pose === 'ground' ? 0.12 : 0.46, act: P.act === 'none' ? null : P.act,
      lines: talk ? null : (NPC_HELLO[P.look] || NPC_HELLO.villager), amb: P.mutter && P.mutter.length ? P.mutter.slice() : null });
    if (P.pose === 'lie') c.yaw0 = o.ry;
    if (talk) c.talkFn = async () => { for (const [w, line] of talk) await say(w === 'reply' ? 'you' : c, line); };
    if (P.mode === 'patrol' && P.route && P.route.length >= 2) { c.mode = 'patrol'; c.wp = P.route.map(([x, z]: any) => [h.area.hdr.x + x, h.area.hdr.z + z]); c.x = c.wp[0][0]; c.z = c.wp[0][1]; c.y = ystand(c.x, c.z); c.smoothY = c.y; }
    else if (P.mode === 'wander') c.wander = P.roam;
    h.group.add(c.root);
  } });
function areaAnimals(kind: any, h: any, o: any, n: any, r: any, fn: any) : any {
  for (let i: any = 0; i < n; i++) {
    const a: any = makeAnimal(kind), ang: any = R() * TAU, d: any = Math.sqrt(R()) * r;
    a.x = o.x + Math.cos(ang) * d; a.z = o.z + Math.sin(ang) * d; a.y = terrainH(a.x, a.z); a.ry = rnd(0, TAU); a.t = rnd(0, 5);
    if (fn) fn(a, i);
    h.group.add(a.root);
  }
}
akind('chickens', { cat: 'Folk & beasts', icon: 'chicken', desc: 'A few hens scratching about.', r: 1, rot: false, props: { count: AP.int(5, 1, 16), radius: AP.num(3, 1, 12, 0.5) }, pickR: (P: any) => P.radius,
  build(h: any, o: any) : any { const r: any = o.P.radius; areaAnimals('chicken', h, o, o.P.count, r, (a: any) => { a.area = [o.x - r, o.z - r, o.x + r, o.z + r]; }); } });
akind('sheep', { cat: 'Folk & beasts', icon: 'sheep', desc: 'A small flock.', r: 2, rot: false, props: { count: AP.int(4, 1, 16), radius: AP.num(6, 2, 20, 0.5) }, pickR: (P: any) => P.radius,
  build(h: any, o: any) : any { const r: any = o.P.radius; areaAnimals('sheep', h, o, o.P.count, r, (a: any) => { a.area = [o.x - r, o.z - r, o.x + r, o.z + r]; }); } });
akind('ducks', { cat: 'Folk & beasts', icon: 'duck', desc: 'Ducks paddling in circles. Put them on water.', r: 1.5, rot: false, props: { count: AP.int(3, 1, 10), radius: AP.num(3, 1, 12, 0.5) }, pickR: (P: any) => P.radius,
  build(h: any, o: any) : any { const r: any = o.P.radius; areaAnimals('duck', h, o, o.P.count, r, (a: any) => { a.orbit = { x: o.x, z: o.z, r: rnd(0.35, 1) * r, sp: rnd(0.25, 0.4) * (R() < 0.5 ? 1 : -1), a: rnd(0, TAU) }; }); } });
akind('cat', { cat: 'Folk & beasts', icon: 'cat', desc: 'A cat, asleep. There’s always a cat.', r: 0.3, lift: true, sticky: true,
  build(h: any, o: any) : any { const a: any = makeAnimal('cat'); a.x = o.x; a.z = o.z; a.y = o.y; a.ry = o.ry; a.sleep = true; h.group.add(a.root); } });
akind('bats', { cat: 'Folk & beasts', icon: 'bat', desc: 'Bats circling overhead.', r: 1.5, rot: false, props: { count: AP.int(4, 1, 12), radius: AP.num(3, 1, 12, 0.5), height: AP.num(3, 1, 12, 0.5) }, pickR: (P: any) => P.radius,
  build(h: any, o: any) : any { const r: any = o.P.radius; areaAnimals('bat', h, o, o.P.count, r, (a: any) => { a.orbit = { x: o.x, z: o.z, r: rnd(0.4, 1) * r, sp: rnd(0.8, 1.4) * (R() < 0.5 ? 1 : -1), a: rnd(0, TAU), y: o.y + o.P.height, ph: rnd(0, TAU) }; }); } });

// ---- ground ---------------------------------------------------------------------------------------------------------------
function areaStoneWall(pts: any, h: any, c: any) : any {   // a dry-stone wall that follows the ground (world coordinates, into the current batch)
  for (let i: any = 0; i < pts.length - 1; i++) {
    const [x0, z0]: any = pts[i], [x1, z1]: any = pts[i + 1], L: any = Math.hypot(x1 - x0, z1 - z0), a: any = Math.atan2(-(z1 - z0), x1 - x0);
    if (L < 0.05) continue;
    const n: any = Math.max(1, Math.round(L / 0.55));
    for (let k: any = 0; k < n; k++) {
      const t: any = (k + 0.5) / n, x: any = lerp(x0, x1, t), z: any = lerp(z0, z1, t), y: any = terrainH(x, z);
      for (let r: any = 0; r < 3; r++) box(x + rnd(-0.06, 0.06), y - 0.08 + r * h / 3, z + rnd(-0.06, 0.06), q2(rnd(0.42, 0.66)), q2(h / 3 * rnd(0.85, 1.1)), q2(rnd(0.42, 0.55)), vary(c, 0.12), PAT.STONE, { ry: a + rnd(-0.12, 0.12) });
    }
    const cx: any = (x0 + x1) / 2, cz: any = (z0 + z1) / 2, yc: any = terrainH(cx, cz);
    addColW(cx, cz, L / 2, 0.3, (x1 - x0) / L, (z1 - z0) / L, yc - 1, yc + h + 0.2);
  }
}
const mpts: any = (h: any, o: any) => o.pts;
akind('path', { cat: 'Ground', icon: 'path', desc: 'A worn earth path — click along its course, then press Enter.', multi: true, r: 1, rot: false, order: 0,
  props: { width: AP.num(2.4, 0.8, 8, 0.1) },
  ground(h: any, o: any) : any {
    addPath(o.P.width, o.pts.map((p: any) => p.slice()));
    const w: any = o.P.width / 2 + 0.6;
    clearVeg(h, (x: any, z: any, r: any) => { for (let i: any = 0; i < o.pts.length - 1; i++) if (segDist(x, z, o.pts[i], o.pts[i + 1]) < w + r) return true; return false; });
    h.gb = boundsPts(o.pts, o.P.width / 2 + 2.5);
  } });
akind('fence', { cat: 'Ground', icon: 'fence', desc: 'A picket fence — click post by post, then press Enter.', multi: true, r: 0.5, rot: false, sticky: false,
  props: { color: AP.col('#8a6a48'), height: AP.num(0.9, 0.5, 2, 0.05) },
  build(h: any, o: any) : any { fence(mpts(h, o), { c: hexc(o.P.color), h: o.P.height, ground: true }); } });
akind('wall', { cat: 'Ground', icon: 'wall', label: 'Stone wall', desc: 'A dry-stone field wall — click along it, then press Enter.', multi: true, r: 0.5, rot: false,
  props: { height: AP.num(0.85, 0.4, 2, 0.05), color: AP.col('#9a948a') },
  build(h: any, o: any) : any { areaStoneWall(mpts(h, o), o.P.height, hexc(o.P.color)); } });
akind('hedgerow', { cat: 'Ground', icon: 'hedge', desc: 'A line of hedge — click along it, then press Enter.', multi: true, r: 0.8, rot: false,
  build(h: any, o: any) : any {
    const pts: any = o.pts;
    for (let i: any = 0; i < pts.length - 1; i++) {
      const [x0, z0]: any = pts[i], [x1, z1]: any = pts[i + 1], L: any = Math.hypot(x1 - x0, z1 - z0), a: any = Math.atan2(x1 - x0, z1 - z0);
      const n: any = Math.max(1, Math.round(L / 1.25));
      for (let k: any = 0; k < n; k++) { const t: any = (k + 0.5) / n; aPlant(h, 'hedge', lerp(x0, x1, t) + rnd(-0.12, 0.12), lerp(z0, z1, t) + rnd(-0.12, 0.12), rnd(0.85, 1.1), { ry: a + PI / 2 + rnd(-0.25, 0.25) }); }
    }
  } });
akind('flatten', { cat: 'Ground', icon: 'flatten', label: 'Level ground', desc: 'Levels a patch of ground, and can raise or sink it.', r: 3, order: 0,
  props: { size: AP.size([10, 8], [2, 2], [60, 60]), raise: AP.num(0, -6, 6, 0.1), soft: AP.num(4, 1, 16, 0.5, { label: 'edge' }) },
  pickR: (P: any) => Math.hypot(P.size[0], P.size[1]) / 2,
  ground(h: any, o: any) : any {
    const [W, D]: any = o.P.size, y: any = levelAt(o.x, o.z, o.ry, W / 2, D / 2) + o.P.raise;
    h.pads.push(addPad({ x: o.x, z: o.z, ry: o.ry, hx: W / 2, hz: D / 2, m: 0, f: o.P.soft, y }));
    clearVeg(h, obbTest(o.x, o.z, o.ry, W / 2 + o.P.soft * 0.4, D / 2 + o.P.soft * 0.4));
    h.gb = boundsAround(o.x, o.z, Math.hypot(W, D) / 2 + o.P.soft + 1);
    h.fp = rectWorld(o, W, D);
  } });
akind('pond', { cat: 'Ground', icon: 'water', desc: 'Sinks the ground below the water line to make a pond.', r: 3, rot: false, order: 0,
  props: { radius: AP.num(6, 2, 30, 0.5), depth: AP.num(1, 0.3, 3, 0.1) },
  pickR: (P: any) => P.radius,
  ground(h: any, o: any) : any {
    const r: any = o.P.radius;
    h.pads.push(addPad({ x: o.x, z: o.z, m: r * 0.55, f: r * 0.75, y: WATER_Y - o.P.depth }));
    clearVeg(h, (x: any, z: any, rr: any) => Math.hypot(x - o.x, z - o.z) < r * 1.05 + rr);
    h.gb = boundsAround(o.x, o.z, r * 1.35 + 1);
  } });
akind('clear', { cat: 'Ground', icon: 'clear', label: 'Clear trees', desc: 'Takes away the valley’s own trees, bushes and rocks in a circle, to make room.', r: 3, rot: false, order: 0,
  props: { radius: AP.num(6, 1, 40, 0.5) },
  pickR: (P: any) => P.radius,
  ground(h: any, o: any) : any { const r: any = o.P.radius; clearVeg(h, (x: any, z: any, rr: any) => Math.hypot(x - o.x, z - o.z) < r + rr * 0.5); } });

// ---- danger ---------------------------------------------------------------------------------------------------------------
akind('gloam', { cat: 'Danger', icon: 'gloam', label: 'Gloam haunt', desc: 'The gloam gather here — at night, or always. Lit wayfires keep them off.', r: 3, rot: false,
  props: { radius: AP.num(18, 4, 60, 1), max: AP.int(3, 1, 8, { label: 'at most' }), when: AP.en('night', ['night', 'always']), foes: AP.en('gloamling', ['gloamling', 'shade', 'mixed']) },
  pickR: (P: any) => P.radius,
  build(h: any, o: any) : any {
    const P: any = o.P;
    COMBAT.zones.push({ id: h.fid, x: o.x, z: o.z, r: P.radius, max: P.max, types: P.foes === 'mixed' ? ['gloamling', 'gloamling', 'shade'] : [P.foes],
      when: () => G.started && !EDIT.on && !G.ending && (P.when === 'always' || NIGHT > 0.55) });
  } });

// ---- reading the text -----------------------------------------------------------------------------------------------------
const AQ_OPEN: any = '"“”„', AQ_CLOSE: any = '"“”';
function atokenize(line: any) : any {
  const toks: any = []; let i: any = 0, comment: any = null, err: any = null; const n: any = line.length;
  while (i < n) {
    const ch: any = line[i];
    if (ch === ' ' || ch === '\t' || ch === ',' || ch === '\r') { i++; continue; }
    if (ch === '#') {
      const m: any = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![^\s,])/.exec(line.slice(i));
      if (m) { const hx: any = m[1].length === 3 ? m[1].split('').map((c: any) => c + c).join('') : m[1]; toks.push({ t: 'col', v: '#' + hx.toLowerCase(), c0: i, c1: i + m[0].length }); i += m[0].length; continue; }
      comment = { c0: i, text: line.slice(i) }; break;
    }
    if (AQ_OPEN.includes(ch)) {
      let j: any = i + 1, s: any = '';
      while (j < n && !AQ_CLOSE.includes(line[j])) { if (line[j] === '\\' && j + 1 < n) { s += line[j + 1]; j += 2; } else s += line[j++]; }
      if (j >= n) { err = { c0: i, c1: n, msg: 'This text needs a closing quote mark.' }; toks.push({ t: 'str', v: s, c0: i, c1: n }); break; }
      toks.push({ t: 'str', v: s, c0: i, c1: j + 1 }); i = j + 1; continue;
    }
    let j: any = i; while (j < n && !' \t,#\r'.includes(line[j]) && !AQ_OPEN.includes(line[j])) j++;
    const w: any = line.slice(i, j);
    if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(w)) toks.push({ t: 'num', v: parseFloat(w), c0: i, c1: j });
    else toks.push({ t: 'word', v: w.toLowerCase(), raw: w, c0: i, c1: j });
    i = j;
  }
  return { toks, comment, err };
}
function lev(a: any, b: any) : any {
  const m: any = a.length, n: any = b.length; if (Math.abs(m - n) > 3) return 9;
  let p: any = Array.from({ length: n + 1 }, (_: any, j: any) => j);
  for (let i: any = 1; i <= m; i++) { const c: any = [i]; for (let j: any = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[n];
}
function suggest(w: any, list: any) : any {
  let best: any = null, bd: any = w.length < 4 ? 1 : 2;
  for (const c of list) { const d: any = c.startsWith(w) && w.length >= 3 ? 0.5 : lev(w, c); if (d <= bd) { bd = d; best = c; } }
  return best ? ` Did you mean “${best}”?` : '';
}
function readValue(o: any, K: any, key: any, sp: any, toks: any, i: any, li: any, E: any, kt: any) : any {
  const need: any = (msg: any) => { E(li, kt.c0, kt.c1, msg); return i; };
  const num: any = (j: any) => toks[j] && toks[j].t === 'num' ? toks[j].v : null;
  const clampN: any = (v: any, j: any) => {
    if (sp.min !== undefined && (v < sp.min || v > sp.max)) { E(li, toks[j].c0, toks[j].c1, `${key} goes from ${sp.min} to ${sp.max}.`, true); v = clamp(v, sp.min, sp.max); }
    return sp.t === 'int' ? Math.round(v) : v;
  };
  switch (sp.t) {
    case 'xy': { const a: any = num(i), b: any = num(i + 1); if (a === null || b === null) { need(`${key} needs two numbers: east and south, like ${key} 4, -2`); return a === null ? i : i + 1; } o.p[key] = [a, b]; return i + 2; }
    case 'num': case 'int': { const a: any = num(i); if (a === null) return need(`${key} needs a number.`); o.p[key] = key === 'rot' ? ((a % 360) + 360) % 360 : clampN(a, i); return i + 1; }
    case 'size': {
      const t: any = toks[i]; let w: any = null, d: any = null, j: any = i;
      const m: any = t && t.t === 'word' && /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(t.v);
      if (m) { w = +m[1]; d = +m[2]; j = i + 1; }
      else if (num(i) !== null) { w = num(i); j = i + 1; if (toks[j] && toks[j].t === 'word' && toks[j].v === 'x') j++; else if (toks[j] && toks[j].t === 'word' && /^x\d/.test(toks[j].v)) { d = +toks[j].v.slice(1); j++; } if (d === null) { d = num(j); if (d !== null) j++; } }
      if (w === null || d === null || isNaN(d)) return need(`${key} needs width x depth, like ${key} 8x6`);
      const lo: any = sp.min, hi: any = sp.max; if (w < lo[0] || d < lo[1] || w > hi[0] || d > hi[1]) E(li, t.c0, toks[j - 1].c1, `${key} goes from ${lo[0]}x${lo[1]} to ${hi[0]}x${hi[1]}.`, true);
      o.p[key] = [clamp(w, lo[0], hi[0]), clamp(d, lo[1], hi[1])]; return j;
    }
    case 'color': {
      const t: any = toks[i];
      if (t && t.t === 'col') { o.p[key] = t.v; return i + 1; }
      if (t && t.t === 'word' && AC_NAMES[t.v]) { o.p[key] = AC_NAMES[t.v]; return i + 1; }
      if (t && t.t === 'word' && t.v === 'none' && sp.none) { delete o.p[key]; return i + 1; }
      return need(`${key} needs a colour, like ${key} #b83a30 or ${key} red`);
    }
    case 'enum': {
      const t: any = toks[i];
      if (t && t.t === 'word' && sp.opts.includes(t.v)) { o.p[key] = t.v; return i + 1; }
      if (t && t.t === 'word') { E(li, t.c0, t.c1, `${key} can be ${sp.opts.join(', ')}.` + suggest(t.v, sp.opts)); return i + 1; }
      return need(`${key} can be ${sp.opts.join(', ')}.`);
    }
    case 'text': { const t: any = toks[i]; if (!t || t.t !== 'str') return need(`${key} needs some words in quotes, like ${key} "…"`); o.p[key] = t.v; return i + 1; }
    case 'lines': { const t: any = toks[i]; if (!t || t.t !== 'str') return need(`${key} needs some words in quotes, like ${key} "…"`); (o.p[key] ||= []).push(t.v); return i + 1; }
    case 'script': { const t: any = toks[i]; if (!t || t.t !== 'str') return need(`${key} needs some words in quotes, like ${key} "…"`); (o.p[sp.prop] ||= []).push([sp.role, t.v]); return i + 1; }
    case 'points': {
      const arr: any = []; let j: any = i;
      while (num(j) !== null && num(j + 1) !== null) { arr.push([num(j), num(j + 1)]); j += 2; }
      if (num(j) !== null) { E(li, toks[j].c0, toks[j].c1, 'Points come in pairs: east, south.'); j++; }
      if (!arr.length) return need(`${key} needs pairs of numbers, like ${key} 0,0 6,2 10,8`);
      o.p[key] = (o.p[key] || []).concat(arr); return j;
    }
  }
  return i;
}
function readProps(o: any, toks: any, i: any, li: any, E: any) : any {
  const K: any = AK[o.kind];
  while (i < toks.length) {
    const t: any = toks[i];
    if (t.t === 'str') {
      if (K.named && !o._named) { o.name = t.v; o._named = 1; i++; continue; }
      E(li, t.c0, t.c1, K.named ? 'This already has a name. Words in quotes need a word in front, like say "…"' : `A ${K.label.toLowerCase()} doesn’t take a name.`); i++; continue;
    }
    if (t.t !== 'word') { E(li, t.c0, t.c1, t.t === 'col' ? 'A colour on its own — which part is it for? (like color #b83a30)' : 'A number on its own — what is it for? (like at 4, 2 or scale 1.5)'); i++; continue; }
    const w: any = t.v;
    if (K.variants && K.variants.includes(w)) { o.variant = w; i++; continue; }
    const key: any = K.alias[w] && K.keys[K.alias[w]] ? K.alias[w] : w;
    const sp: any = K.keys[key];
    // a word that is both a setting and one of its own values ("lit") stands for the value when no value follows
    if (sp && sp.t === 'enum' && sp.opts.includes(w) && !(toks[i + 1] && toks[i + 1].t === 'word' && sp.opts.includes(toks[i + 1].v))) { o.p[key] = w; i++; continue; }
    if (sp) { i = readValue(o, K, sp.t === 'script' ? w : key, sp, toks, i + 1, li, E, t); continue; }
    if (K.bare[w]) { o.p[K.bare[w]] = w; i++; continue; }
    E(li, t.c0, t.c1, `A ${K.label.toLowerCase()} doesn’t know “${t.raw}”.` + suggest(w, K.words));
    i++;
  }
}
function readHeader(toks: any, li: any, E: any) : any {
  const hd: any = { name: 'Unnamed place', x: 0, z: 0, r: 24, title: '' };
  for (let i: any = 1; i < toks.length;) {
    const t: any = toks[i];
    if (t.t === 'str' && i === 1) { hd.name = t.v; i++; continue; }
    if (t.t === 'word' && t.v === 'at' && toks[i + 1]?.t === 'num' && toks[i + 2]?.t === 'num') { hd.x = toks[i + 1].v; hd.z = toks[i + 2].v; i += 3; continue; }
    if (t.t === 'word' && (t.v === 'radius' || t.v === 'size') && toks[i + 1]?.t === 'num') { hd.r = clamp(toks[i + 1].v, 4, 120); i += 2; continue; }
    if (t.t === 'word' && (t.v === 'title' || t.v === 'subtitle') && toks[i + 1]?.t === 'str') { hd.title = toks[i + 1].v; i += 2; continue; }
    E(li, t.c0, t.c1, t.t === 'str' ? 'An area’s name comes straight after the word area.' : `An area line knows: a "name", at x, z, radius and title.` + (t.t === 'word' ? suggest(t.v, ['at', 'radius', 'title']) : ''));
    i++;
  }
  return hd;
}
// text → { hdr, objs: [{ kind, variant, name, p, line0, line1, comment }], errs: [{ line, c0, c1, msg, warn }], more: [further areas] }
function aparse(text: any) : any {
  const lines: any = String(text).split('\n');
  const first: any = { hdr: null, objs: [], errs: [], line0: 0 }, out: any = [first];
  let A: any = first, cur: any = null;
  const E: any = (line: any, c0: any, c1: any, msg: any, warn?: any) => { A.errs.push({ line, c0, c1, msg, warn: !!warn }); if (!warn && cur) cur.bad = true; };
  for (let li: any = 0; li < lines.length; li++) {
    const raw: any = lines[li], { toks, comment, err }: any = atokenize(raw);
    const indented: any = /^[ \t]/.test(raw);
    if (!toks.length) { if (!indented || !cur) cur = null; if (err) E(li, err.c0, err.c1, err.msg); if (!raw.trim()) cur = null; continue; }
    if (indented && cur) { if (err) E(li, err.c0, err.c1, err.msg); readProps(cur, toks, 0, li, E); cur.line1 = li; continue; }
    cur = null;
    if (err) E(li, err.c0, err.c1, err.msg);
    const t0: any = toks[0];
    if (t0.t !== 'word') { E(li, t0.c0, t0.c1, 'Each line starts with what it is, like tree or house.'); cur = null; continue; }
    if (t0.v === 'area') {
      if (A.hdr) { A = { hdr: null, objs: [], errs: [], line0: li }; out.push(A); }
      A.hdr = readHeader(toks, li, E); A.hdr.line = li; cur = null; continue;
    }
    const K: any = AK[t0.v] || AK[AKA[t0.v]];
    if (!K) { E(li, t0.c0, t0.c1, `I don’t know “${t0.raw}”.` + suggest(t0.v, [...Object.keys(AK), 'area'])); cur = null; continue; }
    const o: any = { kind: K.name, variant: null, name: '', p: {}, line0: li, line1: li, comment: comment ? comment.text : '' };
    if (AKA[t0.v] && K.variants && K.variants.includes(t0.v)) o.variant = t0.v;   // "orchard" is a grove, "cottage" a house
    cur = o;
    if (err) o.bad = true;
    readProps(o, toks, 1, li, E);
    delete o._named;
    if (K.variants && !o.variant) o.variant = K.def;
    if (K.multi && (!o.p.points || o.p.points.length < 2)) { E(li, t0.c0, t0.c1, `A ${K.label.toLowerCase()} needs at least two points, like points 0,0 6,2`); continue; }
    if (!K.multi && !o.p.at) o.p.at = [0, 0];
    A.objs.push(o);
  }
  // a line with a mistake in it isn't built until it's put right
  for (const ar of out) ar.objs = ar.objs.filter((o: any) => !o.bad);
  return { ...first, more: out.slice(1) };
}

// ---- writing the text -----------------------------------------------------------------------------------------------------
const fnum: any = (v: any, d: any = 2) => { const k: any = 10 ** d; const s: any = String(Math.round(v * k) / k); return s === '-0' ? '0' : s; };
const fq: any = (s: any) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
function aserialize(o: any) : any {
  const K: any = AK[o.kind], parts: any = [K.name], cont: any = [];
  if (K.variants) parts.push(o.variant || K.def);
  if (o.name) parts.push(fq(o.name));
  for (const key of K.korder) {
    const v: any = o.p[key]; if (v === undefined || v === null) continue;
    const sp: any = K.keys[key];
    switch (sp.t) {
      case 'xy': parts.push(key, fnum(v[0]) + ', ' + fnum(v[1])); break;
      case 'num': case 'int': parts.push(key, fnum(v, key === 'rot' ? 0 : 2)); break;
      case 'size': parts.push(key, fnum(v[0]) + 'x' + fnum(v[1])); break;
      case 'color': parts.push(key, v); break;
      case 'enum': if (sp.bare) parts.push(v); else parts.push(key, v); break;
      case 'text': if (v !== '') parts.push(key, fq(v)); break;
      case 'points': if (v.length) parts.push(key, v.map((p: any) => fnum(p[0]) + ',' + fnum(p[1])).join(' ')); break;
      case 'lines': for (const s of v) cont.push(`  ${key} ${fq(s)}`); break;
      case 'script': for (const [r, s] of v) cont.push(`  ${r} ${fq(s)}`); break;
    }
  }
  return [parts.join(' ') + (o.comment ? '  ' + o.comment : ''), ...cont].join('\n');
}
function aheader(hd: any) : any { return `area ${fq(hd.name)} at ${fnum(hd.x, 1)}, ${fnum(hd.z, 1)} radius ${fnum(hd.r, 1)}` + (hd.title ? ` title ${fq(hd.title)}` : ''); }
// resolved settings for an object: what the text says, with the kind's defaults filled in
function aprops(o: any) : any {
  const K: any = AK[o.kind], P: any = {};
  for (const [k, sp] of entriesAny(K.props)) { let v: any = o.p[k]; if (v === undefined) v = typeof sp.def === 'function' ? sp.def(o.variant || K.def) : sp.def; P[k] = Array.isArray(v) ? v.map((x: any) => Array.isArray(x) ? x.slice() : x) : v; }
  return P;
}

// ---- building it into the world --------------------------------------------------------------------------------------------
// every list a builder can add to; what an object added is remembered so it can be taken away again
const AREG: any = () => [['cols', PHYS.cols], ['walks', PHYS.walks], ['emitters', emitters], ['fires', FIRES], ['smokes', SMOKES], ['bubblers', BUBBLERS], ['sparkles', SPARKLES], ['anims', ANIMS],
  ['kfires', KFIRES], ['chars', CHARS], ['animals', ANIMALS], ['spots', SPOTS], ['zones', COMBAT.zones], ['canopies', CANOPIES], ['mapdots', MAPDOTS],
  ['buildings', BUILDINGS], ['doors', DOORS], ['fades', fadeGroups], ['nograss', NO_GRASS], ['pads', PADS], ['paths', PATHS], ['carves', CARVES], ['reveals', REVEALS], ['breakables', BREAKABLES]];
function capture(fn: any) : any {   // runs a builder; whatever it added to the world's lists comes back (even if it failed halfway)
  const R0: any = AREG().map(([k, a]: any) => [k, a, a.length]), out: any = { err: null };
  try { fn(); } catch (e: any) { out.err = e; }
  for (const [k, a, n] of R0) out[k] = a.slice(n);
  return out;
}
function removeMany(arr: any, list: any) : any { if (!list || !list.length) return; const s: any = new Set(list); let j: any = 0; for (let i: any = 0; i < arr.length; i++) if (!s.has(arr[i])) arr[j++] = arr[i]; arr.length = j; }
function release(cap: any) : any {
  if (!cap) return;
  for (const c of cap.cols) gridRemove(PHYS.cgrid, c);
  for (const w of cap.walks) gridRemove(PHYS.wgrid, w);
  const R1: any = AREG();
  for (const [k, arr] of R1) removeMany(arr, cap[k]);
  if (cap.buildings.includes(CUT.b)) { CUT.b = null; CUT.f = 0; }
  for (const g of cap.fades) { g.mat.dispose(); if (g.glassMat) g.glassMat.dispose(); }
  for (const e of cap.chars) { e.root.visible = false; if (DLG.c === e) DLG.c = null; if (INTERACT.cur && INTERACT.cur.c === e) INTERACT.cur = null; }
}
function disposeGroup(g: any) : any {
  g.traverse((m: any) => { if ((m.isMesh || m.isInstancedMesh) && m.geometry && !m.userData.keepGeo && m.geometry !== BLOB_GEO) m.geometry.dispose(); if (m.isInstancedMesh) m.dispose?.(); });
  if (g.parent) g.parent.remove(g);
}

const AREAS: any = {
  list: [], root: null, mat: null, vegMat: null, version: 0, next: 1, loaded: false, saveT: null,
  init() : any {
    if (this.root) return;
    this.root = new THREE.Group(); this.root.name = 'areas';
    scene.add(this.root); SURF.push(this.root);
    this.mat = worldMat(); this.vegMat = worldMat({ rough: 0.9 });
  },
  boot() : any {
    this.init();
    let data: any = null;
    try { data = JSON.parse(localStorage.getItem(AREA_KEY) || 'null'); } catch (e: any) { data = null; }
    if (data && Array.isArray(data.areas)) {
      this.next = data.next || 1;
      for (const s of data.areas) { if (!s || typeof s.text !== 'string') continue; const a: any = { id: s.id || 'a' + this.next++, text: s.text, hdr: null, objs: [], errs: [], handles: [] }; this.list.push(a); this.sync(a, true); }
      this.cur = data.cur;
    }
    this.loaded = true;
    initGlows();
  },
  save(now: any) : any {
    clearTimeout(this.saveT);
    const go: any = () => { try { localStorage.setItem(AREA_KEY, JSON.stringify({ v: 1, next: this.next, cur: EDIT.area?.id ?? this.cur, areas: this.list.map((a: any) => ({ id: a.id, text: a.text })) })); } catch (e: any) { /* storage full or private: the editor says so */ this.saveErr = e; } };
    if (now) go(); else this.saveT = setTimeout(go, 350);
  },
  byId(id: any) : any { return this.list.find((a: any) => a.id === id); },
  add(text: any) : any {
    const a: any = { id: 'a' + this.next++, text, hdr: null, objs: [], errs: [], handles: [] };
    this.list.push(a); this.sync(a); this.save();
    return a;
  },
  remove(a: any) : any {
    let dirty: any = null;
    for (const h of a.handles) { dirty = bUnion(dirty, h.gb); dirty = bUnion(dirty, h.grassB); this.destroy(h); }
    a.handles = [];
    this.list = this.list.filter((x: any) => x !== a);
    if (dirty) { const redo: any = new Set(); this.reground(dirty, redo); for (const h of redo) this.buildPass(h); refreshGrass(dirty.x0, dirty.x1, dirty.z0, dirty.z1); }
    initGlows(); this.version++; this.save();
  },
  setText(a: any, text: any) : any { if (a.text === text) return false; a.text = text; this.sync(a); this.save(); return true; },
  handles() : any { const out: any = []; for (const a of this.list) out.push(...a.handles); return out; },
  at(x: any, z: any) : any { let best: any = null, bd: any = 1e9; for (const a of this.list) { if (!a.hdr) continue; const d: any = Math.hypot(x - a.hdr.x, z - a.hdr.z); if (d < a.hdr.r && d < bd) { bd = d; best = a; } } return best; },
  // text → world: rebuild only what changed (and whatever stands on ground that changed)
  sync(a: any, quiet: any) : any {
    const P: any = aparse(a.text);
    if (P.hdr) a.hdr = P.hdr; else if (!a.hdr) a.hdr = { name: 'Unnamed place', x: 0, z: 0, r: 24, title: '' };
    a.objs = P.objs; a.errs = P.errs.slice();
    if (!P.hdr) a.errs.unshift({ line: 0, c0: 0, c1: 0, msg: 'The text should begin with an area line, like: area "Name" at 0, 0 radius 24', warn: true });
    if (P.more.length) a.errs.push({ line: P.more[0].line0, c0: 0, c1: 4, msg: 'A second area starts here, and nothing from here on is built. Each area has its own text: make a new area, or use Import to add several at once.' });
    // keys: a name if it has one, else kind + count; they make the ids of fires and folk
    const seen: any = {};
    for (const o of a.objs) { let k: any = o.name ? slug(o.name) : o.kind; if (!k) k = o.kind; seen[k] = (seen[k] || 0) + 1; o.key = seen[k] > 1 || !o.name ? `${k}-${seen[k]}` : k; }
    const sig: any = (o: any) => JSON.stringify([o.kind, o.variant, o.name, o.p, o.key, a.hdr.x, a.hdr.z, a.id, o.kind === 'wayfire' && !o.name ? a.hdr.name : '']);
    const pool: any = new Map(); for (const h of a.handles) { const L: any = pool.get(h.sig); if (L) L.push(h); else pool.set(h.sig, [h]); }
    const next: any = [], fresh: any = [];
    for (const o of a.objs) {
      const s: any = sig(o), L: any = pool.get(s);
      if (L && L.length) { const h: any = L.shift(); h.obj = o; next.push(h); }
      else { const h: any = { area: a, obj: o, sig: s, fid: `a:${a.id}:${o.key}`, group: null, cap: null, gcap: null, veg: [], pads: [], paths: [], plants: new Map(), gb: null, grassB: null, bb: null }; next.push(h); fresh.push(h); }
    }
    let terr: any = null, grass: any = null;
    for (const L of pool.values()) for (const h of L) { terr = bUnion(terr, h.gb); grass = bUnion(grass, h.grassB); if (!quiet) this.forgetFires(h); this.destroy(h); }
    a.handles = next;
    fresh.sort((p: any, q: any) => AK[p.obj.kind].order - AK[q.obj.kind].order);
    for (const h of fresh) { this.groundPass(h); terr = bUnion(terr, h.gb); grass = bUnion(grass, h.grassB); }
    const redo: any = new Set(fresh);
    if (terr) this.reground(terr, redo);
    const order: any = [...redo].sort((p: any, q: any) => AK[p.obj.kind].order - AK[q.obj.kind].order);
    for (const h of order) this.buildPass(h);
    for (const ar of new Set(order.map((h: any) => h.area))) this.settleFolk(ar);
    const gb: any = bUnion(terr, grass);
    if (gb) refreshGrass(gb.x0, gb.x1, gb.z0, gb.z1);   // last, once the houses are up (no grass grows indoors)
    if (!quiet) { initGlows(); SAFE.t = 0; }
    this.version++;
    return a;
  },
  // the ground changed under `b`: re-bake it, and take down anything that stood on it (to be built again)
  reground(b: any, redo: any) : any {
    terrainRefresh(b.x0, b.x1, b.z0, b.z1, true, true);
    for (const h of this.handles()) if (!redo.has(h) && h.cap && bHit(h.bb, b)) { this.unbuild(h); redo.add(h); }
  },
  resolve(h: any) : any {
    const o: any = h.obj, K: any = AK[o.kind], a: any = h.area, P: any = aprops(o);
    const r: any = { K, P, name: o.name, variant: o.variant || K.def, rot: o.p.rot || 0, ry: (o.p.rot || 0) * DEG, s: o.p.scale ?? (K.scale ? K.scale.def : 1), lift: o.p.y || 0 };
    if (K.multi) { r.pts = (o.p.points || []).map(([x, z]: any) => [a.hdr.x + x, a.hdr.z + z]); r.x = r.pts[0][0]; r.z = r.pts[0][1]; }
    else { r.x = a.hdr.x + o.p.at[0]; r.z = a.hdr.z + o.p.at[1]; }
    r.t = terrainH(r.x, r.z);
    r.y = K.lift || !K.multi ? ystand(r.x, r.z, r.lift) : r.t;
    return r;
  },
  groundPass(h: any) : any {
    const K: any = AK[h.obj.kind];
    const saved: any = R; R = makeRng(hashStr(h.fid + ':g'));
    let o: any = null;
    h.gcap = capture(() => {
      o = this.resolve(h);
      if (K.ground) K.ground(h, o);
      if (K.clearGrass) { NO_GRASS.push({ x: o.x, z: o.z, r: K.clearGrass }); h.grassB = boundsAround(o.x, o.z, K.clearGrass + 1); }
    });
    R = saved;
    if (h.gcap.err) { console.error('area ground', h.obj.kind, h.gcap.err); h.err = String(h.gcap.err.message || h.gcap.err); }
  },
  buildPass(h: any) : any {
    const K: any = AK[h.obj.kind];
    h.group = new THREE.Group(); h.group.userData.h = h; this.root.add(h.group);
    const saved: any = R; R = makeRng(hashStr(h.fid));
    const bt: any = new Batch();
    let o: any = null;
    h.cap = capture(() => {
      o = this.resolve(h); h.o = o;
      B.reset(); B.to(bt); B.occ = 1; B.ground = -1; B.sway = 0; B.em = 0; B.ud = UD0;
      CTX.b = null; CTX.f = 0; CTX.grp = null; CTX.ug = false; CTX.zone = null;
      if (K.build) K.build(h, o);
      B.reset();
      if (K.after) K.after(h, o);
    });
    R = saved; B.reset(); B.to(null); B.ground = -1; CTX.b = null; CTX.f = 0; CTX.grp = null;
    h.err = h.cap.err ? String(h.cap.err.message || h.cap.err) : null;
    if (h.cap.err) console.error('area build', h.obj.kind, h.cap.err);
    // what the builders made: merged geometry, building pieces, live flames, instanced plants
    if (bt.count) { const m: any = new THREE.Mesh(bt.toGeometry(), this.mat); m.castShadow = m.receiveShadow = true; h.group.add(m); }
    for (const g of h.cap.fades) { g.build(h.group); for (const m of g.extra) h.group.add(m); }
    for (const f of h.cap.kfires) { fireVisual(f, h.group); h.cap.emitters.push(f.e); h.cap.fires.push(f.src); }
    flushPlants(h);
    for (const c of h.cap.chars) if (c.root.parent !== h.group) h.group.add(c.root);
    for (const an of h.cap.animals) if (an.root.parent !== h.group) h.group.add(an.root);
    // where it is, for picking, outlines and rebuilding
    const box: any = new THREE.Box3().setFromObject(h.group);
    if (o) {
      const pr: any = K.pickR ? K.pickR(o.P) : K.r;
      h.anchor = { x: o.x, y: o.y, z: o.z, r: pr };
      let b: any = boundsAround(o.x, o.z, pr + 0.5);
      if (o.pts) b = bUnion(b, boundsPts(o.pts, 1));
      if (!box.isEmpty()) b = bUnion(b, { x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z });
      h.bb = b;
    }
  },
  unbuild(h: any) : any {
    if (h.cap) { release(h.cap); h.cap = null; }
    if (h.group) { disposeGroup(h.group); h.group = null; }
    h.building = null;
  },
  destroy(h: any) : any {
    this.unbuild(h);
    if (h.gcap) { release(h.gcap); h.gcap = null; }
    for (const v of h.veg) vegShow(v, true);
    h.veg = []; h.pads = []; h.paths = [];
    h.dead = true;
  },
  // an edited fire starts from what the text says, not from what happened to it last
  forgetFires(h: any) : any { if (!h.cap) return; for (const f of h.cap.kfires) delete G.fires[f.id]; },
  // folk inside a custom house belong to it (so they hide with its floors); wanderers get a round to walk
  settleFolk(a: any) : any {
    const blds: any = a.handles.filter((h: any) => h.building).map((h: any) => h.building);
    for (const h of a.handles) {
      if (!h.cap) continue;
      for (const c of h.cap.chars) {
        c.b = null; c.f = 0;
        for (const b of blds) if (pip(b.zone, c.x, c.z) && c.y > b.s.y - 0.5 && c.y < b.s.y + b.wallTop) { c.b = b; c.f = b.floorOf(c.y); break; }
        if (c.wander && !c.wp) {
          const pts: any = [], r0: any = makeRng(hashStr(c.id + ':w'));
          for (let k: any = 0; k < 30 && pts.length < 4; k++) { const ang: any = r0() * TAU, d: any = c.wander * (0.35 + r0() * 0.65), x: any = c.x + Math.cos(ang) * d, z: any = c.z + Math.sin(ang) * d; if (clearWalk(c.x, c.z, x, z, c.y)) pts.push([x, z]); }
          if (pts.length) { c.wp = []; for (const p of pts) c.wp.push([c.x, c.z], p); c.mode = 'patrol'; }
        }
      }
    }
  },
};
function clearWalk(x0: any, z0: any, x1: any, z1: any, y: any) : any {   // can someone walk straight from one point to the other?
  const L: any = Math.hypot(x1 - x0, z1 - z0), n: any = Math.max(1, Math.ceil(L / 0.4)), p: any = { x: 0, z: 0 };
  for (let i: any = 1; i <= n; i++) {
    const x: any = lerp(x0, x1, i / n), z: any = lerp(z0, z1, i / n);
    p.x = x; p.z = z; pushOut(p, 0.34, y + 0.3, y + 1.5);
    if (Math.hypot(p.x - x, p.z - z) > 0.04) return false;
    const g: any = groundAt(x, z, y + 0.5);
    if (g.blocked || g.water || Math.abs(g.h - y) > 0.5) return false;
  }
  return true;
}
// a fresh area: a comment that explains the format, and a place to start
function areaTemplate(name: any, x: any, z: any) : any {
  return `${aheader({ name, x: Math.round(x), z: Math.round(z), r: 24, title: '' })}
# Each line is one thing: what it is, then where it goes and how it looks.
#   at 4, -2   means 4 m east and 2 m north of the middle (south is +).
#   rot 90     turns it: its front faces south at 0, east at 90.
# Pick things from the list on the left and click to place them,
# or type them here. Indented lines carry on the line above.
`;
}
const AREA_EXAMPLE: any = (x: any, z: any) => `${aheader({ name: 'Hollyhock Green', x: Math.round(x), z: Math.round(z), r: 26, title: 'a hamlet of your own' })}
# A small example to take apart. Try changing a number.
clear radius 18
house cottage "Rose Cottage" at -6, -4 rot 0 hearth lit
house timber "The Crooked Mug" at 9, -6 rot 0 size 10x7 inside tavern
well at 2, 3
path width 2.2 points -6,0 2,3 9,-2 16,6
npc "Old Tam" at 4, 5 rot 200 look farmer title "Retired ploughman"
  say "Fine evening for it."
  reply "Is it always this quiet?"
  say "Quiet? Wait till the geese start."
chickens at -9, 6 count 5 radius 3
fence color #9a7a52 points -13,3 -13,9 -5,9 -5,4
lamppost at 0, -1
lamppost at 12, 2
campfire "the green fire" at 4, 10 lit
bench at 4, 12 rot 180
tree oak at -16, -8 scale 1.2
tree birch at 18, -14
grove mixed at -2, -18 radius 7 count 6
wayfire "Hollyhock Green" at 14, 10 unlit
`;
