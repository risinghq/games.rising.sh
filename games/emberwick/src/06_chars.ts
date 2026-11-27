// ============================================================================
//  Characters: procedural humanoids & animals, NPC behaviours, companions
// ============================================================================
const charMat: any = worldMat({ rough: 0.78 });                // villagers: sliced away with the surface
const charMatFree: any = worldMat({ rough: 0.78, layer: 0 });   // the party and the folk who live underground
let PART_MAT: any = charMat;
const CHARS: any = [];
const ANIMALS: any = [];

function partMesh(fn: any, parent: any, x: any = 0, y: any = 0, z: any = 0) : any {
  const b: any = new Batch();
  withLocal(() => { B.to(b); B.occ = 0; fn(); B.occ = 1; });
  const g: any = new THREE.Group();
  g.position.set(x, y, z);
  if (b.count) {
    const m: any = new THREE.Mesh(b.toGeometry(), PART_MAT);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  parent.add(g);
  return g;
}

// look: { skin, hair, hairStyle, beard, shirt, pants, boots, belt, cloak, hood, hat, hatC, apron, dress, build, item, itemL, back }
function makeHumanoid(look: any) : any {
  const L: any = Object.assign({ skin: 0xe0b08a, hair: 0x4a2e1e, hairStyle: 'short', shirt: 0x6a4a3a, pants: 0x4a3a2e, boots: 0x3a2a1e, belt: 0x2a1e14, build: 'normal' }, look);
  const k: any = ({ normal: [1, 1, 1], stout: [1, 1.18, 0.96], slim: [1, 0.9, 1.04], child: [0.66, 0.92, 0.95], dwarf: [0.74, 1.32, 0.8], tall: [1.08, 0.95, 1.06] } as any)[L.build];
  const S: any = k[0], W: any = k[1], LG: any = k[2];
  const legH: any = 0.8 * S * LG, thigh: any = legH * 0.5, torsoH: any = 0.6 * S * (L.build === 'dwarf' ? 1.1 : 1), tw: any = 0.4 * S * W, td: any = 0.25 * S * W, hr: any = (L.build === 'child' ? 0.18 : 0.158) * (L.build === 'child' ? 1 : S) * (L.build === 'dwarf' ? 1.22 : 1);
  const root: any = new THREE.Group();
  const hips: any = new THREE.Group(); hips.position.y = legH; root.add(hips);
  const c: any = {};
  // body (torso, head, hair, hat, beard, cloak...)
  c.body = partMesh(() => {
    const shirt: any = L.shirt;
    box(0, 0, 0, tw * 0.92, torsoH * 0.45, td, L.dress ?? L.pants, PAT.NOISE);
    box(0, torsoH * 0.38, 0, tw, torsoH * 0.62, td * 1.05, shirt, PAT.NOISE, { ao: 0.15 });
    box(0, torsoH * 0.32, 0, tw * 0.96, 0.07, td * 1.1, L.belt, 0);
    box(0, torsoH * 0.33, td * 0.56, 0.06, 0.05, 0.02, MET.brass, PAT.METAL);
    if (L.apron) box(0, -torsoH * 0.6, td * 0.55, tw * 0.75, torsoH * 1.15, 0.02, L.apron, PAT.NOISE);
    if (L.dress) lathe(0, -legH * 0.8, 0, [[tw * 0.82, 0], [tw * 0.62, legH * 0.55], [tw * 0.5, legH * 0.8 + 0.02], [0.001, legH * 0.8 + 0.02]], 9, L.dress, PAT.NOISE);
    if (L.mail) box(0, torsoH * 0.05, 0, tw * 1.04, torsoH * 0.55, td * 1.08, MET.steel, PAT.METAL);
    // neck & head
    cyl(0, torsoH, 0, 0.05 * S, 0.06 * S, 0.07, 6, L.skin, 0);
    const hy: any = torsoH + 0.06 + hr;
    ball(0, hy - hr, 0, hr, L.skin, 0, { sy: 1.08, ws: 12, hs: 9 });
    for (const s of [-1, 1]) {
      ball(s * hr * 0.36, hy + hr * 0.08, hr * 0.9, hr * 0.13, 0x1e1612, 0, { ws: 6, hs: 4 });
      box(s * hr * 0.36, hy + hr * 0.3, hr * 0.92, hr * 0.32, 0.018, 0.02, L.brow ?? L.hair, 0);
      ball(s * hr * 0.98, hy - hr * 0.05, 0, hr * 0.18, L.skin, 0, { ws: 6, hs: 4, sx: 0.5 });
    }
    cone(0, hy - hr * 0.25, hr * 0.98, hr * 0.13, hr * 0.32, 5, shade(L.skin, 0.92), 0, { rx: PI / 2 });
    box(0, hy - hr * 0.48, hr * 0.9, hr * 0.38, 0.02, 0.02, 0x8a4a3a, 0);
    // hair
    const hc: any = L.hair;
    if (L.hairStyle !== 'bald') {
      ball(0, hy - hr + hr * 0.12, -hr * 0.06, hr * 1.06, hc, PAT.NOISE, { sy: 1.02, ws: 12, hs: 8 });
      box(0, hy + hr * 0.15, hr * 0.55, hr * 1.7, hr * 0.42, hr * 0.5, hc, PAT.NOISE, { rx: -0.25 });
    }
    if (L.hairStyle === 'long') box(0, hy - hr * 2.4, -hr * 0.45, hr * 1.9, hr * 2.2, hr * 0.9, hc, PAT.NOISE);
    if (L.hairStyle === 'bun') ball(0, hy + hr * 0.75, -hr * 0.6, hr * 0.45, hc, PAT.NOISE);
    if (L.hairStyle === 'pony') { ball(0, hy + hr * 0.2, -hr * 1.0, hr * 0.3, hc, PAT.NOISE); box(0, hy - hr * 1.6, -hr * 1.1, hr * 0.4, hr * 1.7, hr * 0.4, hc, PAT.NOISE, { rx: 0.15 }); }
    if (L.hairStyle === 'braids') for (const s of [-1, 1]) box(s * hr * 0.7, hy - hr * 2.2, hr * 0.1, hr * 0.32, hr * 1.9, hr * 0.32, hc, PAT.NOISE);
    if (L.ears === 'elf') for (const s of [-1, 1]) cone(s * hr * 0.95, hy - hr * 0.1, 0, hr * 0.14, hr * 0.7, 4, L.skin, 0, { rz: -s * 1.1 });
    if (L.horns && L.hat !== 'helmet') for (const s of [-1, 1]) cone(s * hr * 0.55, hy + hr * 0.55, hr * 0.1, hr * 0.2, hr * 0.85, 5, L.hornC ?? 0x2a1a14, 0, { rz: -s * 0.45, rx: -0.2 });
    if (L.tail) { B.push(0, -torsoH * 0.05, -td * 0.55, 0, 0.9); cyl(0, -0.4, 0, 0.02, 0.035, 0.55, 5, L.skin, 0); cone(0, 0.12, 0, 0.06, 0.14, 4, L.skin, 0); B.pop(); }
    // beard
    if (L.beard === 'full') ball(0, hy - hr * 1.25, hr * 0.48, hr * 0.62, L.beardC ?? hc, PAT.NOISE, { sy: 1.1, sz: 0.8 });
    if (L.beard === 'long') { ball(0, hy - hr * 1.2, hr * 0.5, hr * 0.7, L.beardC ?? hc, PAT.NOISE, { sz: 0.8 }); cone(0, hy - hr * 2.9, hr * 0.62, hr * 0.62, hr * 1.9, 6, L.beardC ?? hc, PAT.NOISE, { rx: PI }); for (const s of [-1, 1]) cyl(s * hr * 0.25, hy - hr * 3.1, hr * 0.7, hr * 0.12, hr * 0.12, hr * 0.14, 6, MET.gold, PAT.METAL); }
    if (L.beard === 'mustache') box(0, hy - hr * 0.42, hr * 0.95, hr * 0.8, hr * 0.14, 0.04, L.beardC ?? hc, 0);
    // hats
    const hc2: any = L.hatC ?? 0x3a2a5a;
    if (L.hat === 'wizard') { cyl(0, hy + hr * 0.45, 0, hr * 1.9, hr * 1.9, 0.03, 14, hc2, PAT.NOISE); cone(0, hy + hr * 0.45, 0, hr * 1.05, hr * 3.6, 9, hc2, PAT.NOISE, { rx: -0.18 }); sph(0, hy + hr * 1.6, -hr * 0.1, hr * 0.18, MET.gold, 0, { det: 0, em: 1 }); }
    if (L.hat === 'hood') { ball(0, hy - hr * 0.95, -hr * 0.08, hr * 1.22, hc2, PAT.NOISE, { sy: 1.15, ws: 12, hs: 8 }); cone(0, hy + hr * 0.1, -hr * 1.05, hr * 0.5, hr * 1.2, 6, hc2, PAT.NOISE, { rx: -2.3 }); }
    if (L.hat === 'cap') { cyl(0, hy + hr * 0.3, -hr * 0.05, hr * 1.02, hr * 1.06, hr * 0.5, 12, hc2, PAT.NOISE); box(0, hy + hr * 0.32, hr * 0.95, hr * 1.4, 0.03, hr * 0.7, hc2, 0); }
    if (L.hat === 'chef') { cyl(0, hy + hr * 0.3, 0, hr * 1.02, hr * 1.02, hr * 0.5, 12, 0xf4f0e8, PAT.NOISE); ball(0, hy + hr * 1.1, 0, hr * 1.15, 0xf4f0e8, PAT.NOISE, { sy: 0.7 }); }
    if (L.hat === 'helmet') { ball(0, hy - hr * 0.4, 0, hr * 1.18, MET.steel, PAT.METAL, { ws: 12, hs: 8, sy: 0.95 }); box(0, hy - hr * 0.6, hr * 1.12, 0.05, hr * 0.9, 0.05, MET.steel, PAT.METAL); if (L.horns) for (const s of [-1, 1]) cone(s * hr * 1.05, hy + hr * 0.1, 0, hr * 0.22, hr * 0.9, 6, 0xe8dcc0, 0, { rz: -s * 0.9 }); }
    if (L.hat === 'kerchief') ball(0, hy - hr * 0.88, -hr * 0.1, hr * 1.12, hc2, PAT.NOISE, { sy: 1.0, ws: 12, hs: 8 });
    if (L.hat === 'straw') { cyl(0, hy + hr * 0.42, 0, hr * 2.3, hr * 2.3, 0.03, 14, 0xd8b65a, PAT.STRAW); cyl(0, hy + hr * 0.42, 0, hr * 0.9, hr * 1.05, hr * 0.6, 12, 0xd8b65a, PAT.STRAW); box(0, hy + hr * 0.5, 0, hr * 2.12, hr * 0.12, hr * 2.12, 0x8a3a2a, 0, { ry: PI / 4, sx: 0.0 + 1 }); }
    if (L.hat === 'veil') { ball(0, hy - hr * 0.95, -hr * 0.12, hr * 1.2, hc2, PAT.NOISE, { sy: 1.2, ws: 12, hs: 8 }); box(0, hy - hr * 2.2, -hr * 0.7, hr * 2.3, hr * 2.2, hr * 0.6, hc2, PAT.NOISE); box(0, hy + hr * 0.25, hr * 0.75, hr * 2.1, hr * 0.28, hr * 0.3, 0xf4f0e8, 0); }
    // cloak / cape
    if (L.cloak) { box(0, -torsoH * 0.55, -td * 0.62, tw * 1.15, torsoH * 1.5, 0.05, L.cloak, PAT.NOISE, { rx: 0.08 }); box(0, torsoH * 0.88, -td * 0.2, tw * 1.1, 0.1, td * 0.9, L.cloak, PAT.NOISE); }
    // back items
    if (L.back === 'axe') { B.push(0, torsoH * 0.5, -td * 0.75, 0, 0, 0.6); cyl(0, -0.55, 0, 0.025, 0.025, 1.15, 5, WOOD.mid); box(0.12, 0.4, 0, 0.26, 0.24, 0.03, MET.steel, PAT.METAL); box(-0.12, 0.4, 0, 0.26, 0.24, 0.03, MET.steel, PAT.METAL); B.pop(); }
    if (L.back === 'pack') { box(0, torsoH * 0.3, -td * 0.85, tw * 0.7, torsoH * 0.55, 0.18, 0x6a4a2a, PAT.NOISE); cyl(tw * 0.3, torsoH * 0.88, -td * 0.85, 0.06, 0.06, tw * 0.6, 7, 0x8a6a4a, PAT.NOISE, { rz: PI / 2 }); }
    if (L.hip === 'sword') { B.push(-tw * 0.55, torsoH * 0.3, 0.02, 0, 0.35, 0.1); box(0, -0.75, 0, 0.07, 0.75, 0.04, 0x3a2a1e); box(0, 0, 0, 0.2, 0.04, 0.05, MET.brass, PAT.METAL); box(0, 0.04, 0, 0.035, 0.15, 0.035, 0x4a2a1a); B.pop(); }
    if (L.chest === 'lute') { B.push(0.02, torsoH * 0.2, td * 0.7, 0, 0, -0.8); ball(0, 0, 0, 0.17, 0xb07a3a, PAT.PLANK, { sz: 0.45, sy: 1.15 }); box(0, 0.14, 0.03, 0.05, 0.45, 0.03, 0x6a4a2a); B.pop(); }
  }, hips, 0, 0, 0);
  // arms
  const armLen: any = 0.62 * S * (L.build === 'dwarf' ? 0.92 : 1);
  const shY: any = torsoH * 0.92;
  for (const s of [-1, 1]) {
    const arm: any = partMesh(() => {
      box(0, -armLen * 0.55, 0, 0.11 * S * W * 0.95, armLen * 0.62, 0.12 * S, L.sleeve ?? L.shirt, PAT.NOISE);
      box(0, -armLen * 0.95, 0, 0.095 * S, armLen * 0.42, 0.1 * S, L.sleeve2 ?? L.sleeve ?? L.shirt, PAT.NOISE);
      ball(0, -armLen, 0.01, 0.06 * S, L.skin, 0, { ws: 6, hs: 5 });
    }, hips, s * (tw / 2 + 0.065 * S), shY, 0);
    if (s > 0) c.armR = arm; else c.armL = arm;
  }
  // held items
  const hand: any = (side: any, fn: any) => partMesh(fn, side > 0 ? c.armR : c.armL, 0, -armLen, 0.02);
  if (L.item === 'staff') { c.item = hand(1, () => { cyl(0, -0.5, 0, 0.025, 0.03, 1.75, 6, 0x5a3a24, PAT.BARK); torus(0, 1.25, 0, 0.09, 0.02, 4, 8, 0x6a4a2a); sph(0, 1.3, 0, 0.075, 0x9ae8ff, 0, { det: 1, em: 3.2 }); }); c.orb = new V3(0, 1.3, 0); }
  if (L.item === 'hammer') c.item = hand(1, () => { cyl(0, -0.05, 0, 0.022, 0.022, 0.45, 5, WOOD.mid, 0, { rx: PI / 2 + 0.2 }); box(0, -0.03, 0.42, 0.22, 0.1, 0.1, MET.iron, PAT.METAL); });
  if (L.item === 'ladle') c.item = hand(1, () => { cyl(0, 0, 0, 0.018, 0.018, 0.75, 5, WOOD.light, 0, { rx: PI - 0.3 }); ball(0, -0.7, -0.2, 0.07, MET.iron, 0); });
  if (L.item === 'book') c.item = hand(-1, () => { box(0, 0, 0.1, 0.22, 0.04, 0.3, 0x6a2a2a, PAT.NOISE, { rx: -0.6 }); });
  if (L.item === 'mug') c.item = hand(1, () => { cyl(0, -0.02, 0.06, 0.05, 0.045, 0.12, 8, WOOD.light, PAT.PLANK); });
  if (L.item === 'spear') c.item = hand(1, () => { cyl(0, -0.9, 0, 0.022, 0.022, 2.3, 5, WOOD.mid); cone(0, 1.4, 0, 0.05, 0.25, 4, MET.steel, PAT.METAL); });
  if (L.item === 'basket') c.item = hand(-1, () => { lathe(0, -0.12, 0.06, [[0.001, 0], [0.13, 0], [0.18, 0.15], [0.001, 0.15]], 8, 0xa8844e, PAT.STRAW); torus(0, 0.03, 0.06, 0.15, 0.012, 3, 8, 0x8a6a3a, 0, { ry: PI / 2, arc: PI }); ball(0.05, 0.05, 0.06, 0.05, 0xc0302a, 0); ball(-0.05, 0.05, 0.08, 0.05, 0x9cbf3a, 0); });
  if (L.item === 'rod') c.item = hand(1, () => { cyl(0, 0, 0, 0.015, 0.02, 2.4, 5, WOOD.light, 0, { rx: 1.05 }); });
  if (L.item === 'pitchfork') c.item = hand(1, () => { cyl(0, -0.9, 0, 0.022, 0.022, 2.0, 5, WOOD.mid); for (const s of [-1, 0, 1]) cyl(s * 0.06, 1.1, 0, 0.01, 0.012, 0.3, 4, MET.iron); box(0, 1.08, 0, 0.16, 0.03, 0.03, MET.iron); });
  if (L.item === 'candle') { c.item = hand(1, () => { cyl(0, 0, 0.08, 0.025, 0.025, 0.2, 6, 0xf1e4c0); flame(0, 0.2, 0.08, 1.1); }); }
  if (L.item === 'needles') c.item = hand(1, () => { for (const s of [-1, 1]) cyl(s * 0.04, 0, 0.1, 0.006, 0.006, 0.28, 4, 0xc8b08a, 0, { rz: s * 0.6 }); ball(0, -0.05, 0.12, 0.06, 0xb83a5a, PAT.NOISE); });
  if (L.item === 'quill') c.item = hand(1, () => { cyl(0, 0, 0.05, 0.004, 0.012, 0.25, 4, 0xf4f0e8, 0, { rx: 0.4 }); });
  // legs (thigh + shin with knee)
  for (const s of [-1, 1]) {
    const leg: any = partMesh(() => { box(0, -thigh, 0, 0.13 * S * W * 0.9, thigh + 0.02, 0.14 * S, L.pants, PAT.NOISE); }, hips, s * tw * 0.24, 0, 0);
    const knee: any = partMesh(() => {
      box(0, -thigh + 0.1, 0, 0.12 * S * W * 0.9, thigh - 0.1, 0.13 * S, L.pants, PAT.NOISE);
      box(0, -thigh, 0.03, 0.135 * S * W * 0.9, 0.22, 0.2 * S, L.boots, PAT.NOISE);
    }, leg, 0, -thigh, 0);
    if (s > 0) { c.legR = leg; c.kneeR = knee; } else { c.legL = leg; c.kneeL = knee; }
  }
  // blob shadow
  const blob: any = new THREE.Mesh(BLOB_GEO, blobMat);
  blob.scale.setScalar(tw * 2.4 + 0.2); blob.position.y = 0.02; blob.renderOrder = 2;
  root.add(blob);
  c.blob = blob;
  return Object.assign(c, { root, hips, legH, torsoH, headY: legH + torsoH + 0.1 + hr * 2.2, look: L, tw });
}
const BLOB_GEO: any = new THREE.CircleGeometry(0.5, 20).rotateX(-PI / 2);
const blobMat: any = (() => {
  const cv: any = document.createElement('canvas'); cv.width = cv.height = 64;
  const g: any = cv.getContext('2d'), gr: any = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t: any = new THREE.CanvasTexture(cv);
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
})();
function cone(x: any, y: any, z: any, r: any, h: any, seg: any, c: any, pat: any = 0, o: any = {}) : any { cyl(x, y, z, 0, r, h, seg, c, pat, o); }

// ---- character state & animation ------------------------------------------
class Character {
  [key: string]: any;
  constructor(o: any) {
    this.id = o.id; this.name = o.name; this.title = o.title || '';
    this.ug = !!o.ug;
    const pm: any = PART_MAT; if (o.free || o.ug) PART_MAT = charMatFree;
    this.rig = makeHumanoid(o.look);
    PART_MAT = pm;
    this.root = this.rig.root;
    this.x = o.x; this.z = o.z; this.y = o.y ?? groundAt(o.x, o.z, 50).h; this.vy = 0;
    this.face = o.face ?? 0; this.faceTarget = this.face; this.r = o.r ?? 0.32;
    this.speed = 0; this.phase = rnd(0, 6); this.t = rnd(0, 10);
    this.pose = o.pose || 'stand'; this.act = o.act || null; this.sitY = o.sitY ?? 0.46;
    this.lines = o.lines || []; this.lineIdx = 0; this.amb = o.amb || null; this.ambT = rnd(4, 12);
    this.mode = o.mode || 'idle'; this.wp = o.wp || null; this.wpi = 0; this.wait = rnd(0, 2);
    this.b = o.b || null; this.f = o.f ?? 0; this.talkable = o.talk !== false;
    this.home = { x: this.x, z: this.z, face: this.face };
    this.circle = o.circle || null;
    this.yaw0 = o.lieYaw ?? 0;
    this.lookYaw = 0; this.talking = false;
    this.seed = rnd(0, 100);
    this.smoothY = this.y;
    scene.add(this.root);
    CHARS.push(this);
    this.place();
  }
  place() : any {
    this.root.position.set(this.x, this.smoothY, this.z);
    this.root.rotation.y = this.face;
  }
  animate(dt: any) : any {
    const g: any = this.rig, t: any = (this.t += dt);
    const amp: any = clamp(this.speed / 3.6, 0, 1.25);
    this.phase += dt * this.speed * 2.5;
    const sw: any = Math.sin(this.phase);
    g.root.rotation.x = 0; g.root.rotation.z = 0;
    g.hips.rotation.set(0, 0, 0);
    g.body.rotation.set(0, 0, 0);
    if (this.pose === 'sit') {
      g.hips.position.y = this.sitY;
      g.legL.rotation.x = g.legR.rotation.x = -PI / 2 + 0.1;
      g.kneeL.rotation.x = g.kneeR.rotation.x = PI / 2 - 0.15;
      g.armL.rotation.x = g.armR.rotation.x = -0.5;
      g.armL.rotation.z = 0.1; g.armR.rotation.z = -0.1;
      g.body.rotation.x = -0.05;
    } else if (this.pose === 'kneel') {
      g.hips.position.y = g.legH * 0.55;
      g.legL.rotation.x = -1.35; g.kneeL.rotation.x = 1.45;
      g.legR.rotation.x = 0.15; g.kneeR.rotation.x = 1.75;
      g.armL.rotation.x = g.armR.rotation.x = -0.25; g.armL.rotation.z = 0.12; g.armR.rotation.z = -0.12;
      g.body.rotation.x = 0.22;
    } else if (this.pose === 'lie') {
      g.hips.position.y = g.legH;
      g.root.rotation.x = -PI / 2;
      g.legL.rotation.x = g.legR.rotation.x = 0; g.kneeL.rotation.x = g.kneeR.rotation.x = 0;
      g.armL.rotation.set(0, 0, 0.15); g.armR.rotation.set(0, 0, -0.15);
      g.body.scale.y = 1 + Math.sin(t * 1.4) * 0.02;
    } else {
      g.hips.position.y = g.legH + Math.abs(Math.cos(this.phase)) * 0.045 * amp - 0.025 * amp;
      g.legL.rotation.x = sw * 0.75 * amp; g.legR.rotation.x = -sw * 0.75 * amp;
      g.kneeL.rotation.x = Math.max(0, Math.sin(this.phase + 1.4)) * 0.9 * amp;
      g.kneeR.rotation.x = Math.max(0, Math.sin(this.phase + 1.4 + PI)) * 0.9 * amp;
      g.armL.rotation.x = -sw * 0.65 * amp; g.armR.rotation.x = sw * 0.65 * amp;
      g.armL.rotation.z = 0.08 + Math.sin(t * 1.3) * 0.02; g.armR.rotation.z = -0.08 - Math.sin(t * 1.3) * 0.02;
      g.body.rotation.x = 0.07 * amp;
      g.body.scale.y = 1 + Math.sin(t * 2.1 + this.seed) * 0.012 * (1 - amp);
    }
    // actions override arms
    const a: any = this.castT > 0 ? 'cast' : this.swingT > 0 ? 'swing' : this.talking && this.act !== 'lantern' ? 'talk' : this.act;
    this.castT = Math.max(0, (this.castT || 0) - dt); this.swingT = Math.max(0, (this.swingT || 0) - dt); this.flinch = Math.max(0, (this.flinch || 0) - dt);
    if (a === 'hammer') {
      const c: any = (t * 1.15) % 1, up: any = c < 0.65 ? sstep(0, 0.65, c) : 1 - sstep(0.65, 0.78, c);
      g.armR.rotation.x = -0.5 - up * 1.9; g.armL.rotation.x = -0.7; g.body.rotation.x = 0.12 - up * 0.1;
      if (c > 0.76 && this._lastC <= 0.76) this.onStrike && this.onStrike();
      this._lastC = c;
    } else if (a === 'stir') {
      g.armR.rotation.x = -1.0 + Math.sin(t * 2.6) * 0.18; g.armR.rotation.z = -0.25 + Math.cos(t * 2.6) * 0.2;
      g.armL.rotation.x = -0.9 + Math.sin(t * 2.6) * 0.15; g.body.rotation.x = 0.15;
    } else if (a === 'wipe') {
      g.armR.rotation.x = -1.05; g.armR.rotation.z = -0.3 + Math.sin(t * 3.2) * 0.35; g.body.rotation.x = 0.12;
    } else if (a === 'drink') {
      const c: any = (t * 0.18) % 1, up: any = c > 0.8 ? Math.sin((c - 0.8) / 0.2 * PI) : 0;
      g.armR.rotation.x = -0.9 - up * 1.1; g.body.rotation.x = -up * 0.15;
    } else if (a === 'strum') {
      g.armR.rotation.x = -0.75; g.armR.rotation.z = -0.55 + Math.sin(t * 9) * 0.12; g.armL.rotation.x = -1.0; g.armL.rotation.z = 0.7;
    } else if (a === 'knit' || a === 'write') {
      g.armR.rotation.x = -1.1 + Math.sin(t * 7) * 0.06; g.armL.rotation.x = -1.1 + Math.cos(t * 7) * 0.06; g.armR.rotation.z = 0.25; g.armL.rotation.z = -0.25; g.body.rotation.x = 0.18;
    } else if (a === 'read') {
      g.armL.rotation.x = -1.15; g.armL.rotation.z = -0.3; g.armR.rotation.x = -0.4 + Math.sin(t * 0.7) * 0.1; g.body.rotation.x = 0.1;
    } else if (a === 'fish') {
      g.armR.rotation.x = -1.0 + Math.sin(t * 0.8) * 0.05; g.armL.rotation.x = -1.0; g.armL.rotation.z = -0.3;
    } else if (a === 'pray') {
      g.armR.rotation.x = g.armL.rotation.x = -1.2; g.armR.rotation.z = 0.45; g.armL.rotation.z = -0.45; g.body.rotation.x = 0.2;
    } else if (a === 'wave' || a === 'talk') {
      g.armR.rotation.x = -0.4 + Math.sin(t * 4) * 0.25; g.armR.rotation.z = -0.4;
      g.body.rotation.y = Math.sin(t * 1.7) * 0.05;
    } else if (a === 'staff') {
      g.armR.rotation.x = -0.35 + Math.sin(t * 1.1) * 0.04 + (this.speed > 0.1 ? sw * 0.2 * amp : 0);
    } else if (a === 'spear') {
      g.armR.rotation.x = -0.25 + (this.speed > 0.1 ? sw * 0.15 : 0);
    } else if (a === 'candle') {
      g.armR.rotation.x = -0.95; g.armR.rotation.z = 0.15;
    } else if (a === 'carry') {
      g.armL.rotation.x = -0.35;
    } else if (a === 'lantern') {
      g.armL.rotation.x = -0.42 + (this.speed > 0.2 ? Math.sin(this.phase) * 0.12 * amp : Math.sin(t * 1.2) * 0.03); g.armL.rotation.z = 0.12;
      if (this.talking) { g.armR.rotation.x = -0.4 + Math.sin(t * 4) * 0.2; g.armR.rotation.z = -0.3; }
      if (this.carryItem) { g.armR.rotation.x = -0.95; g.armR.rotation.z = 0.35; }
    } else if (a === 'cast') {
      const k: any = Math.sin(clamp(this.castT / 0.45, 0, 1) * PI);
      g.armL.rotation.x = -0.42 - k * 1.1; g.armL.rotation.z = 0.12 + k * 0.2;
      g.armR.rotation.x = -0.3 - k * 1.5; g.armR.rotation.z = -0.2 - k * 0.3;
      g.body.rotation.x = -0.08 * k;
      if (this.rig.orb) g.armR.rotation.x = -0.35 - k * 1.7;
    } else if (a === 'swing') {
      const u: any = 1 - clamp(this.swingT / 0.4, 0, 1);
      g.armR.rotation.x = -2.7 + sstep(0.15, 0.7, u) * 3.0; g.armL.rotation.x = -2.2 + sstep(0.15, 0.7, u) * 2.4;
      g.body.rotation.x = -0.15 + sstep(0.15, 0.7, u) * 0.4;
    } else if (a === 'warm') {
      g.armR.rotation.x = g.armL.rotation.x = -1.05; g.armR.rotation.z = 0.2; g.armL.rotation.z = -0.2; g.body.rotation.x = 0.12;
    } else if (a === 'point') {
      g.armR.rotation.x = -1.45; g.armR.rotation.z = -0.1;
    } else if (a === 'shiver') {
      g.armR.rotation.x = g.armL.rotation.x = -0.75; g.armR.rotation.z = 0.55; g.armL.rotation.z = -0.55; g.body.rotation.z = Math.sin(t * 31) * 0.012;
    }
    if (this.flinch > 0) g.body.rotation.x -= this.flinch * 1.2;
    const fy: any = this.pose === 'lie' ? this.y : this.y;
    this.smoothY = this.pose === 'stand' ? dampf(this.smoothY, fy, 18, dt) : fy;
    this.root.position.set(this.x, this.smoothY, this.z);
    this.root.rotation.y = this.face;
    if (this.pose === 'lie') this.root.rotation.y = this.yaw0;
    g.blob.visible = this.pose === 'stand';
  }
  head(out: any = new V3()) : any { return out.set(this.x, this.smoothY + this.rig.headY * (this.pose === 'sit' ? 0.78 : this.pose === 'lie' ? 0.35 : 1), this.z); }
}

// ---- animals ---------------------------------------------------------------
function makeAnimal(kind: any, ug: any = false) : any {
  const pm: any = PART_MAT; if (ug) PART_MAT = charMatFree;
  const root: any = new THREE.Group();
  const part: any = (fn: any, x: any = 0, y: any = 0, z: any = 0) => partMesh(fn, root, x, y, z);
  const a: any = { kind, root, parts: {} };
  if (kind === 'chicken') {
    const wc: any = pick([0xf2ece0, 0xc8783a, 0x8a5a3a]);
    a.parts.body = part(() => {
      ball(0, 0.25, 0, 0.16, wc, PAT.NOISE, { sx: 0.85, sz: 1.15 });
      cone(0, 0.3, -0.18, 0.1, 0.2, 5, wc, PAT.NOISE, { rx: -2.2 });
      ball(0, 0.42, 0.13, 0.08, wc, PAT.NOISE);
      box(0, 0.48, 0.13, 0.025, 0.06, 0.09, 0xd8302a);
      cone(0, 0.42, 0.2, 0.025, 0.08, 4, 0xe8a03a, 0, { rx: PI / 2 });
      ball(0, 0.37, 0.18, 0.025, 0xd8302a, 0, { ws: 5, hs: 4 });
      for (const s of [-1, 1]) { box(s * 0.05, 0, 0, 0.02, 0.13, 0.02, 0xe8a03a); ball(s * 0.06, 0.44, 0.17, 0.015, 0x101010, 0, { ws: 4, hs: 3 }); }
    });
  } else if (kind === 'cat') {
    const cc: any = pick([0xe08a3a, 0x3a3434, 0x8a8a8a, 0xf0e8d8]);
    a.parts.body = part(() => {
      ball(0, 0.13, 0, 0.2, cc, PAT.NOISE, { sx: 1.0, sy: 0.6, sz: 1.2 });
      ball(0.12, 0.15, 0.16, 0.1, cc, PAT.NOISE);
      for (const s of [-1, 1]) cone(0.12 + s * 0.05, 0.22, 0.16, 0.035, 0.07, 4, cc, 0);
      torus(-0.05, 0.08, -0.05, 0.18, 0.035, 4, 10, cc, PAT.NOISE, { rx: PI / 2, arc: PI * 1.3 });
    });
  } else if (kind === 'dog') {
    const dc: any = pick([0xa86a3a, 0xd8c8a8, 0x4a3a2e]);
    a.parts.body = part(() => {
      box(0, 0.32, 0, 0.24, 0.24, 0.55, dc, PAT.NOISE);
      ball(0, 0.58, 0.32, 0.13, dc, PAT.NOISE);
      box(0, 0.54, 0.45, 0.1, 0.09, 0.14, dc, PAT.NOISE);
      ball(0, 0.57, 0.53, 0.03, 0x1a1414, 0, { ws: 5, hs: 4 });
      for (const s of [-1, 1]) { box(s * 0.1, 0.62, 0.28, 0.05, 0.12, 0.08, shade(dc, 0.7), 0, { rz: s * 0.3 }); ball(s * 0.05, 0.62, 0.43, 0.018, 0x101010, 0, { ws: 4, hs: 3 }); }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * 0.08, 0, sz * 0.2, 0.07, 0.24, 0.07, dc, PAT.NOISE);
    });
    a.parts.tail = part(() => { cyl(0, 0, 0, 0.02, 0.035, 0.28, 5, dc, 0, { rx: -0.9 }); }, 0, 0.42, -0.27);
  } else if (kind === 'duck') {
    a.parts.body = part(() => {
      ball(0, 0.08, 0, 0.13, 0x8a6a4a, PAT.NOISE, { sx: 0.8, sy: 0.6, sz: 1.2 });
      ball(0, 0.22, 0.12, 0.07, 0x2a6a3a, PAT.METAL);
      cone(0, 0.21, 0.2, 0.025, 0.08, 4, 0xe8a03a, 0, { rx: PI / 2 });
      box(0, 0.16, 0.06, 0.08, 0.03, 0.03, 0xf4f0e8);
    });
  } else if (kind === 'sheep') {
    a.parts.body = part(() => {
      sph(0, 0.55, 0, 0.36, 0xf0ece2, PAT.NOISE, { det: 1, jit: 0.22, sz: 1.3 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * 0.13, 0, sz * 0.22, 0.07, 0.36, 0.07, 0x2a2420);
    });
    a.parts.head = part(() => { ball(0, 0, 0.08, 0.13, 0x2a2420, 0, { sz: 1.4 }); for (const s of [-1, 1]) box(s * 0.12, 0.04, 0.0, 0.1, 0.04, 0.06, 0x2a2420); sph(0, 0.1, 0, 0.12, 0xf0ece2, PAT.NOISE, { det: 0 }); }, 0, 0.62, 0.45);
  } else if (kind === 'rat') {
    a.parts.body = part(() => {
      ball(0, 0.075, 0, 0.075, 0x6a5a50, PAT.NOISE, { sx: 0.85, sz: 1.65 });
      cone(0, 0.08, 0.12, 0.05, 0.12, 5, 0x6a5a50, 0, { rx: PI / 2 });
      for (const s of [-1, 1]) { ball(s * 0.035, 0.125, 0.1, 0.024, 0xd8a0a0, 0, { ws: 5, hs: 4 }); ball(s * 0.022, 0.1, 0.17, 0.01, 0x101010, 0, { ws: 4, hs: 3 }); }
      ball(0, 0.08, 0.235, 0.013, 0xd88a8a, 0, { ws: 4, hs: 3 });
    });
    a.parts.tail = part(() => { cyl(0, 0, 0, 0.006, 0.016, 0.3, 4, 0xc89a90, 0, { rx: -PI / 2 - 0.12 }); }, 0, 0.05, -0.1);
  } else if (kind === 'bat') {
    a.parts.body = part(() => { ball(0, 0, 0, 0.075, 0x2a2420, PAT.NOISE, { sy: 1.25 }); for (const s of [-1, 1]) cone(s * 0.035, 0.07, 0, 0.022, 0.06, 3, 0x2a2420); });
    a.parts.wl = part(() => { box(-0.17, 0, 0, 0.34, 0.012, 0.2, 0x3a302a, 0); }, -0.04, 0.01, 0);
    a.parts.wr = part(() => { box(0.17, 0, 0, 0.34, 0.012, 0.2, 0x3a302a, 0); }, 0.04, 0.01, 0);
  }
  a.ug = ug;
  PART_MAT = pm;
  a.root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; } });
  scene.add(root);
  ANIMALS.push(a);
  return a;
}

// ---- spawn everyone ----------------------------------------------------------
const PARTY: any = [];
let player: any = null;
function inB(b: any, f: any, x: any, z: any, face: any = 0, extra: any = {}) : any {
  const p: any = b.localY(x, b.levels[f], z);
  return { x: p.x, y: p.y, z: p.z, face: face + (b.s.rot || 0) * DEG, b, f, ...extra };
}
const LOOKS: any = {
  hero: { skin: 0xe8b894, hair: 0x6a3a1e, hairStyle: 'short', shirt: 0x7a5a3a, sleeve: 0x7a5a3a, pants: 0x4a3a2e, boots: 0x3a2618, cloak: 0x2f5a3a, hat: 'hood', hatC: 0x2f5a3a, hip: 'sword', back: 'pack' },
  dwarf: { skin: 0xd8a07a, hair: 0xb8562a, beard: 'long', build: 'dwarf', shirt: 0x7a2a22, mail: true, pants: 0x4a3a2a, boots: 0x2a2018, hat: 'helmet', horns: true, back: 'axe', belt: 0x5a3a1e },
  elf: { skin: 0xf0d2b8, hair: 0xe8e0c8, hairStyle: 'long', ears: 'elf', build: 'tall', shirt: 0x3a4a8a, sleeve: 0x3a4a8a, dress: 0x2a3a6a, boots: 0x3a2a3a, cloak: 0x5a3a7a, item: 'staff', belt: 0xc79b3e },
};
function spawnPeople() : any {
  const P: any = [-4.5, -14.8];
  player = new Character({ id: 'player', name: 'You', x: P[0], z: P[1], face: PI, look: LOOKS.hero, r: 0.34, talk: false, free: true });
  player.act = null;
  const brakka: any = new Character({ id: 'brakka', name: 'Brakka', title: 'Dwarf · Axe-for-hire', x: P[0] + 1.3, z: P[1] + 1.6, face: PI, look: LOOKS.dwarf, r: 0.32, free: true,
    lines: ['Lead on. I\'ll be right behind you. Well — slightly behind, and a bit below.', 'If anything in this village needs hitting, I\'m your dwarf.', 'Never trusted magic. Very handy, though.'] });
  const elowen: any = new Character({ id: 'elowen', name: 'Elowen', title: 'Elven mage', x: P[0] - 1.2, z: P[1] + 2.4, face: PI, look: LOOKS.elf, r: 0.3, act: 'staff', free: true,
    lines: ['After sundown my staff will light the way. Stay close.'] });
  PARTY.push(player, brakka, elowen);
  brakka.follow = 1.7; elowen.follow = 3.3;

  const I: any = V.inn, S: any = V.store, F: any = V.smithy, C: any = V.chapel, T: any = V.tower, K: any = V.bakery, W: any = V.weaver;
  const npc: any = (o: any) => new Character(o);
  npc({ id: 'marta', name: 'Marta', title: 'Innkeeper', ...inB(I, 0, -3.8, -3.85, 0), act: 'wipe',
    look: { skin: 0xe8b090, hair: 0xa8442a, hairStyle: 'bun', build: 'stout', shirt: 0xe8dcc8, sleeve: 0xe8dcc8, dress: 0x4a6a3a, apron: 0xf4efe4, boots: 0x3a2a1e },
    lines: ['Welcome to the Gilded Goose, love! Hot cider\'s on the hob, and the stew is only slightly haunted.', 'Rooms are up the stairs at the back. Mind the creaky one, fourth from the top.', 'If you\'re after the good cider, Dunstan\'s down in the cellar. Stairs by the back wall.', 'Hot cider, on the house tonight.'],
    amb: ['Cider\'s hot!', 'Who ordered the stew?'] });
  const st0: any = [-2.9 + 0.98 * Math.cos(0.4), 1.5 + 0.98 * Math.sin(0.4)];
  npc({ id: 'fennick', name: 'Old Fennick', title: 'Regular', ...inB(I, 0, st0[0], st0[1], Math.atan2(-2.9 - st0[0], 1.5 - st0[1])), pose: 'sit', sitY: 0.5, act: 'drink',
    look: { skin: 0xd8a888, hair: 0xd8d4cc, hairStyle: 'bald', beard: 'full', beardC: 0xe0dcd4, shirt: 0x5a4a6a, pants: 0x3a3a3a, item: 'mug' },
    lines: ['Sixty harvests I\'ve sat on this stool. Sixty! The stool\'s held up better than I have.', 'In my day smugglers ran brandy under this very floor. Tunnels everywhere. Probably still are.', 'Sixty Harvests. Never missed a Kindling.'],
    amb: ['*hic*', 'Another round!'] });
  npc({ id: 'lyle', name: 'Lyle', title: 'Bard', ...inB(I, 0, -4.75, 1.1, -PI / 2 - 0.3), pose: 'sit', sitY: 0.52, act: 'strum',
    look: { skin: 0xe8c0a0, hair: 0x2a1a12, hairStyle: 'pony', shirt: 0x8a2a4a, sleeve: 0xd8c8a8, pants: 0x3a2a4a, hat: 'cap', hatC: 0x8a2a4a, chest: 'lute' },
    lines: ['Oh, the goose was gold and the ale was brown... I\'m still working on the second verse.', 'Every song needs an ending. Tonight\'s is still being written.'],
    amb: ['♪ la la la ♪', '♪ the goose was gold... ♪'] });
  npc({ id: 'basil', name: 'Sir Basil', title: 'Sleeping guest', ...inB(I, 1, -5.3, -2.75, 0), y: V.inn.localY(0, V.inn.levels[1] + 0.72, 0).y, pose: 'lie', lieYaw: 0,
    look: { skin: 0xe8b894, hair: 0x8a6a3a, beard: 'mustache', shirt: 0xd8d0c0, sleeve: 0xd8d0c0, pants: 0x5a4a8a, boots: 0x5a4a8a },
    lines: ['Zzz... five more minutes... the dragon can wait...', '...mmf... festival cider... never again...'], amb: ['Zzz...'] });
  npc({ id: 'quill', name: 'Quill', title: 'Travelling scribe', ...inB(I, 1, 3.1, 0.4, 0), pose: 'sit', sitY: 0.47, act: 'write',
    look: { skin: 0xc89070, hair: 0x1a1210, hairStyle: 'short', shirt: 0x2a4a5a, pants: 0x3a3a3a, item: 'quill' },
    lines: ['Writing to my sister about Emberwick. She\'ll never believe me.', 'Room three has the best view. Of the stairwell, mostly.'] });
  const hilda: any = npc({ id: 'hilda', name: 'Hilda', title: 'Blacksmith', ...inB(F, 0, 3.2, -0.05, PI), act: 'hammer',
    look: { skin: 0xd09878, hair: 0x2a1a12, hairStyle: 'braids', build: 'stout', shirt: 0x6a4a3a, sleeve: 0xd09878, apron: 0x3a2a1e, pants: 0x3a3028, item: 'hammer' },
    lines: ['Mind the sparks. They don\'t mind you.', 'That forge has burned nine years straight. I\'m not letting it go out for a festival.', 'Your dwarf keeps eyeing my anvil. Tell him it\'s not for sale.'], amb: ['*CLANG*', '*CLANG*'] });
  hilda.onStrike = () => { const p: any = V.smithy.localY(3.2, 0.95, -0.85); burst(p.x, p.y, p.z, 14); };
  npc({ id: 'orrin', name: 'Archmage Orrin', title: 'Wizard', ...inB(T, 2, 0.7, -0.9, -PI * 0.75), act: 'read',
    look: { skin: 0xe0b898, hair: 0xe8e8f0, beard: 'long', beardC: 0xf0f0f4, build: 'tall', shirt: 0x3a2a6a, sleeve: 0x3a2a6a, dress: 0x2a1e5a, hat: 'wizard', hatC: 0x3a2a7a, item: 'book', boots: 0x2a1e3a },
    lines: ['A visitor who climbed all three floors! Notice how each floor above you tucks itself away until you arrive? Simple courtesy.', 'I have a hat for every occasion. Several, for some.', 'The stars over Emberwick are worth the climb.', 'My undercroft lies beneath the lab. Mind the circle, and do not, under any circumstances, open the cage.'] });
  npc({ id: 'pell', name: 'Pell', title: 'Apprentice', ...inB(T, 0, 0.35, 0.5, PI), act: 'stir',
    look: { skin: 0xe8c0a0, hair: 0xd8a040, hairStyle: 'short', build: 'slim', shirt: 0x4a6a8a, sleeve: 0x4a6a8a, dress: 0x3a4a6a, item: 'ladle' },
    lines: ['Don\'t touch the green one. Or the purple one. Actually, don\'t touch anything.', 'Master Orrin is upstairs. Two flights. He says the climb is good for wizards.', 'The stairs going down? The undercroft. I\'m not allowed. You probably aren\'t either. ...Go on, then.'], amb: ['*blub blub*'] });
  npc({ id: 'tobias', name: 'Tobias', title: 'Provisioner', ...inB(S, 0, 1.45, -1.4, PI / 2),
    look: { skin: 0xe0b08a, hair: 0x5a5a5a, hairStyle: 'short', beard: 'mustache', beardC: 0x6a6a6a, build: 'stout', shirt: 0x8a6a3a, sleeve: 0xe8dcc8, apron: 0x3a5a6a, pants: 0x3a3a3a },
    lines: ['Tobias & Daughters: rope, lamp oil, pumpkin seeds and potions of questionable origin.', 'My girls run things upstairs. I just count the coppers.'] });
  npc({ id: 'wren', name: 'Wren', title: 'Seamstress', ...inB(S, 1, 1.3, -3.4, PI / 4), pose: 'sit', sitY: 0.52, act: 'knit',
    look: { skin: 0xe8c0a0, hair: 0x6a3a1e, hairStyle: 'braids', build: 'slim', shirt: 0x8a3a3a, sleeve: 0xe8dcc8, dress: 0x6a2a2a, item: 'needles' },
    lines: ['Sewing festival banners. Twelve down, forty to go.', 'Papa says the lamps keep the gloam out of the village.'] });
  npc({ id: 'mira', name: 'Mira', title: 'Baker', ...inB(K, 0, -2.2, 0.85, 0),
    look: { skin: 0xc8906a, hair: 0x2a1a12, hairStyle: 'bun', build: 'stout', shirt: 0xe8dcc8, sleeve: 0xe8dcc8, dress: 0x8a5a2a, apron: 0xf4efe4, hat: 'chef' },
    lines: ['Pumpkin loaf, fresh from the oven! Careful, it\'s hotter than gossip.', 'I\'ve been baking since before dawn. The oven never sleeps, so neither do I.'], amb: ['Fresh bread!', 'Pumpkin loaf!'] });
  npc({ id: 'agnes', name: 'Sister Agnes', title: 'Chapel keeper', ...inB(C, 0, 1.3, -5.4, 0), y: C.localY(0, C.levels[0] + 0.3, 0).y, act: 'candle',
    look: { skin: 0xe8c0a0, hair: 0x5a3a2a, dress: 0x2a2a3a, shirt: 0x2a2a3a, sleeve: 0x2a2a3a, hat: 'veil', hatC: 0x2a2a3a, item: 'candle' },
    lines: ['Light a candle for the harvest, traveller. The Harvest Moon rises tonight.', 'The windows glow after sundown. Come back when the lanterns are lit.'] });
  npc({ id: 'tamsin', name: 'Tamsin', title: 'Villager', ...inB(C, 0, 2.3, -1.65, PI), pose: 'sit', sitY: 0.47, act: 'pray',
    look: { skin: 0xd8a888, hair: 0x8a5a2a, hairStyle: 'long', shirt: 0x5a7a4a, dress: 0x4a5a3a, hat: 'kerchief', hatC: 0x8a3a3a },
    lines: ['...and bless the bakers, and the brewers, and whoever keeps fixing the fountain...'] });
  npc({ id: 'bess', name: 'Old Bess', title: 'Weaver', ...inB(W, 0, -1.75, 0.95, -PI / 2 + 0.35), pose: 'sit', sitY: 0.52, act: 'knit',
    look: { skin: 0xe0b8a0, hair: 0xd8d4cc, hairStyle: 'bun', shirt: 0x6a4a6a, sleeve: 0x6a4a6a, dress: 0x4a3a5a, hat: 'kerchief', hatC: 0xa86a8a, item: 'needles' },
    lines: ['Sit, sit. Mind the cat. There\'s always a cat.', 'Fifty years at that loom. My fingers know the pattern better than I do.'] });
  npc({ id: 'rook', name: 'Captain Rook', title: 'Town guard', x: -11, z: 4.4, face: -PI / 2, act: 'spear', mode: 'patrol', wp: [[-11, 4.4], [-27, 7.0], [-38, 8.0], [-27, 7.0]],
    look: { skin: 0xd8a080, hair: 0x2a2a2a, beard: 'mustache', shirt: 0x7a2a22, mail: true, pants: 0x3a3028, hat: 'helmet', item: 'spear' },
    lines: ['Keep your companions close after dark, traveller.', 'There\'s a troll asleep in the cave up on the mountain. Grumblethorn. Snores like a rockslide. Let him lie.', 'Quiet patrol. Lost goats, loud bards, a missing sheep. The usual.'], amb: ['Evening.', 'Move along.'] });
  const kidLook: any = (h: any, s: any, d: any) => ({ skin: 0xe8c0a0, hair: h, hairStyle: s, build: 'child', shirt: d, pants: 0x4a3a2e, dress: s === 'braids' ? d : undefined });
  npc({ id: 'pip', name: 'Pip', title: 'Village kid', x: 4, z: 0, mode: 'circle', circle: { x: 0, z: 0, r: 4.1, sp: 2.9, a: 0 }, look: kidLook(0xd8a040, 'short', 0x3a6a8a), lines: ['You can\'t catch us!', 'Nell cheats. Don\'t tell her I said that.'], amb: ['Can\'t catch me!', 'Tag!'] });
  npc({ id: 'nell', name: 'Nell', title: 'Village kid', x: -4, z: 0, mode: 'circle', circle: { x: 0, z: 0, r: 4.1, sp: 2.9, a: 0.9 }, look: kidLook(0x6a3a1e, 'braids', 0x8a3a5a), lines: ['Tag! You\'re it!', 'The lanterns come on at dusk. It\'s the best bit.'], amb: ['You\'re it!', 'Wait up!'] });
  const stallP: any = [-5.6, 5.2], sd: any = Math.hypot(...stallP);
  npc({ id: 'greta', name: 'Greta', title: 'Grocer', x: stallP[0] * (sd + 0.45) / sd, z: stallP[1] * (sd + 0.45) / sd, face: Math.atan2(-stallP[0], -stallP[1]),
    look: { skin: 0xd8a888, hair: 0x8a6a4a, hairStyle: 'bun', build: 'stout', shirt: 0x6a8a4a, dress: 0x5a4a3a, apron: 0xe8dcc8, hat: 'kerchief', hatC: 0xb83a30 },
    lines: ['Apples! Three for a copper! Pumpkins, two for a smile!', 'Best view of the lanterns is right here by the fountain.'], amb: ['Apples! Three for a copper!', 'Fresh pumpkins!'] });
  npc({ id: 'wil', name: 'Farmer Wil', title: 'Pumpkin grower', x: -26.3, z: 21.6, face: -2.4, act: 'carry',
    look: { skin: 0xc89070, hair: 0x6a5a4a, beard: 'full', shirt: 0x8a8a5a, pants: 0x5a4a3a, hat: 'straw', item: 'pitchfork' },
    lines: ['Biggest pumpkin contest is tomorrow. Mine\'s the one I\'m not telling you about.', 'Something\'s been stealing my pumpkins. Big footprints. VERY big footprints, heading up the mountain.', 'That scarecrow\'s name is Gerald. He\'s doing his best.'] });
  npc({ id: 'ned', name: 'Ned', title: 'Fisherman', x: 43.7, z: 28, y: DOCK.y, face: PI / 2, pose: 'sit', sitY: 0.12, act: 'fish',
    look: { skin: 0xc89070, hair: 0x5a5a5a, beard: 'full', beardC: 0x7a7a7a, shirt: 0x3a5a6a, pants: 0x4a4a3a, hat: 'cap', hatC: 0x2a3a4a, item: 'rod' },
    lines: ['Shh. You\'ll scare the fish. And the fish are already very nervous.', 'Caught a boot this morning. Left boot. Still waiting on the right one.'], amb: ['Bite... bite... no.'] });
  npc({ id: 'hob', name: 'Hob', title: 'Villager', x: 5.5, z: 8.0, mode: 'patrol', wp: [[5.5, 8.0], [11.6, 11.0], [14.6, 14.8], [11.6, 11.0]], act: 'carry',
    look: { skin: 0xe0b08a, hair: 0x3a2a1e, shirt: 0x8a6a2a, pants: 0x4a3a2e, hat: 'cap', hatC: 0x5a3a2a, item: 'basket' },
    lines: ['Off to Mira\'s for a pumpkin loaf. Don\'t tell my wife.', 'Have you seen the windmill across the river? Lovely at sunset.'] });
  npc({ id: 'thom', name: 'Elder Thom', title: 'Village elder', x: -8.4, z: -4.0, face: Math.atan2(-0.8, -0.6),
    look: { skin: 0xe0b8a0, hair: 0xe8e4dc, hairStyle: 'bald', beard: 'full', beardC: 0xf0ece4, shirt: 0x4a3a5a, dress: 0x3a2a4a, cloak: 0x6a2a2a },
    lines: ['Festival notice: lanterns lit at dusk, pie judging at noon, and absolutely no more goat races.', 'And will somebody please ask whoever is snoring under the mountain to keep it down during the speeches.', 'Welcome to Emberwick, traveller. Wander where you like. Every door is open for the Harvest Festival.'] });
}

function spawnAnimals() : any {
  for (let i: any = 0; i < 6; i++) { const a: any = makeAnimal('chicken'); a.x = rnd(-13.8, -8.2); a.z = rnd(25.2, 29.8); a.ry = rnd(0, TAU); a.area = [-14, 24.9, -8.0, 30.1]; a.t = rnd(0, 5); }
  for (let i: any = 0; i < 5; i++) { const a: any = makeAnimal('sheep'); a.x = rnd(72, 82); a.z = rnd(-4, 4); a.ry = rnd(0, TAU); a.area = [71, -5, 83, 5]; a.t = rnd(0, 5); }
  for (let i: any = 0; i < 4; i++) { const a: any = makeAnimal('duck'); a.orbit = { x: POND.x, z: POND.z, r: rnd(2.0, 4.5), sp: rnd(0.25, 0.4) * (R() < 0.5 ? 1 : -1), a: rnd(0, TAU) }; }
  const dog: any = makeAnimal('dog'); dog.chase = true; dog.x = 3; dog.z = 3;
  const cat1: any = makeAnimal('cat'); { const p: any = V.inn.localY(-5.5, V.inn.levels[0], -1.2); cat1.x = p.x; cat1.z = p.z; cat1.y = p.y; cat1.ry = 1.2; cat1.b = V.inn; cat1.f = 0; cat1.sleep = true; }
  const cat2: any = makeAnimal('cat'); { const p: any = V.store.localY(-3.0, V.store.levels[1] + 0.62, -3.3); cat2.x = p.x; cat2.z = p.z; cat2.y = p.y; cat2.ry = 0.4; cat2.b = V.store; cat2.f = 1; cat2.sleep = true; }
  const cat3: any = makeAnimal('cat'); { const p: any = V.weaver.localY(-2.3, V.weaver.levels[0], -0.4); cat3.x = p.x; cat3.z = p.z; cat3.y = p.y; cat3.ry = 2.2; cat3.b = V.weaver; cat3.f = 0; cat3.sleep = true; }
}

function updateAnimals(dt: any, t: any) : any {
  for (const a of ANIMALS) {
    a.t = (a.t || 0) + dt;
    if (a.kind === 'chicken' || a.kind === 'sheep') {
      if (!a.tx || Math.hypot(a.tx - a.x, a.tz - a.z) < 0.2) { if ((a.wait = (a.wait || 0) - dt) < 0) { a.tx = rnd(a.area[0], a.area[2]); a.tz = rnd(a.area[1], a.area[3]); a.wait = rnd(1, a.kind === 'sheep' ? 6 : 3); } }
      const dx: any = (a.tx ?? a.x) - a.x, dz: any = (a.tz ?? a.z) - a.z, d: any = Math.hypot(dx, dz);
      const sp: any = a.kind === 'sheep' ? 0.5 : 0.9;
      // shy of the player
      const px: any = a.x - player.x, pz: any = a.z - player.z, pd: any = Math.hypot(px, pz);
      if (pd < 2.2 && a.kind === 'chicken') { a.tx = clamp(a.x + px / pd * 2, a.area[0], a.area[2]); a.tz = clamp(a.z + pz / pd * 2, a.area[1], a.area[3]); }
      if (d > 0.2 && a.wait <= 0) { a.x += dx / d * sp * dt * (pd < 2.2 ? 2.5 : 1); a.z += dz / d * sp * dt * (pd < 2.2 ? 2.5 : 1); a.ry = dampA(a.ry, Math.atan2(dx, dz), 6, dt); }
      a.y = a.ug ? a.floorY : terrainH(a.x, a.z);
      const moving: any = d > 0.2 && a.wait <= 0;
      if (a.kind === 'chicken') a.parts.body.rotation.x = moving ? Math.sin(a.t * 14) * 0.08 : (Math.sin(a.t * 3) > 0.7 ? 0.7 : 0);
      if (a.kind === 'sheep') a.parts.head.rotation.x = moving ? 0 : 0.6 + Math.sin(a.t * 2) * 0.1;
    } else if (a.kind === 'duck') {
      const o: any = a.orbit; o.a += o.sp * dt;
      a.x = o.x + Math.cos(o.a) * o.r; a.z = o.z + Math.sin(o.a) * o.r; a.y = WATER_Y - 0.03 + Math.sin(a.t * 2) * 0.015;
      a.ry = Math.atan2(-Math.sin(o.a) * Math.sign(o.sp), Math.cos(o.a) * Math.sign(o.sp));
    } else if (a.kind === 'dog') {
      const kid: any = CHARS.find((c: any) => c.id === 'nell');
      const ang: any = kid.circle.a - 0.55;
      const tx: any = Math.cos(ang) * 4.6, tz: any = Math.sin(ang) * 4.6;
      const dx: any = tx - a.x, dz: any = tz - a.z, d: any = Math.hypot(dx, dz);
      if (d > 0.1) { const sp: any = Math.min(d * 3, 3.6); a.x += dx / d * sp * dt; a.z += dz / d * sp * dt; a.ry = dampA(a.ry || 0, Math.atan2(dx, dz), 8, dt); }
      a.y = 0.04;
      a.parts.tail.rotation.y = Math.sin(a.t * 14) * 0.6;
      a.parts.body.position.y = Math.abs(Math.sin(a.t * 9)) * 0.04;
    } else if (a.kind === 'cat') {
      a.parts.body.scale.y = 1 + Math.sin(a.t * 1.6) * 0.04;
    } else if (a.kind === 'rat') {
      const r0: any = a.run[0], r1: any = a.run[1];
      if (!a.root.visible) { /* asleep while nobody's watching */ }
      else if (a.wait > 0) a.wait -= dt;
      else {
        const tg: any = a.dir ? r1 : r0, dx: any = tg[0] - a.x, dz: any = tg[1] - a.z, d: any = Math.hypot(dx, dz);
        const scared: any = Math.hypot(player.x - a.x, player.z - a.z) < 2.8 && Math.abs(player.y - a.y) < 1.5;
        const sp: any = scared ? 3.8 : 1.4;
        if (d < 0.12) { a.dir = 1 - a.dir; a.wait = scared ? 0.05 : rnd(0.6, 4.5); }
        else { const st: any = Math.min(d, sp * dt); a.x += dx / d * st; a.z += dz / d * st; a.ry = dampA(a.ry || 0, Math.atan2(dx, dz), 14, dt); }
      }
      const L2: any = (r1[0] - r0[0]) ** 2 + (r1[1] - r0[1]) ** 2, u: any = clamp(((a.x - r0[0]) * (r1[0] - r0[0]) + (a.z - r0[1]) * (r1[1] - r0[1])) / L2, 0, 1);
      a.y = lerp(r0[2], r1[2], u) + 0.01;
      a.parts.tail.rotation.y = Math.sin(a.t * 9) * 0.35;
      a.parts.body.position.y = a.wait > 0 ? 0 : Math.abs(Math.sin(a.t * 26)) * 0.012;
    } else if (a.kind === 'bat') {
      const o: any = a.orbit; o.a += o.sp * dt;
      a.x = o.x + Math.cos(o.a) * o.r; a.z = o.z + Math.sin(o.a) * o.r * 0.75; a.y = o.y + Math.sin(a.t * 2.1 + o.ph) * 0.28;
      a.ry = Math.atan2(-Math.sin(o.a) * Math.sign(o.sp), Math.cos(o.a) * Math.sign(o.sp) * 0.75);
      const fl: any = Math.sin(a.t * 21 + o.ph) * 0.95; a.parts.wl.rotation.z = fl; a.parts.wr.rotation.z = -fl;
    }
    a.root.position.set(a.x, a.y ?? 0, a.z);
    a.root.rotation.y = a.ry || 0;
  }
}

// ---- Grumblethorn, the sleeping troll ------------------------------------------------------
function limb(a: any, b: any, r0: any, r1: any, c: any, pat: any = PAT.NOISE, seg: any = 9) : any {
  const d: any = new V3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L: any = d.length();
  const e: any = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UPV, d.normalize()), 'YXZ');
  cyl(a[0], a[1], a[2], r1, r0, L, seg, c, pat, { rx: e.x, ry: e.y, rz: e.z, smooth: true });
  ball(b[0], b[1], b[2], r1 * 1.02, c, pat, { ws: 10, hs: 7 });
}
class Troll {
  [key: string]: any;
  constructor(p: any) {
    Object.assign(this, { id: 'troll', name: 'Grumblethorn', title: 'Troll · fast asleep', ug: true, fixed: true, talkable: true, talking: false,
      pose: 'sit', speed: 0, r: 0.6, b: null, f: 0, lineIdx: 0, mode: 'idle', t: rnd(0, 10), seed: rnd(0, 100), face: 0, _ph: 0 });
    this.lines = ['ZZZZzzzzz... *SNNNNRRRRK*... zzz...', '...mmmf... pumpkin pie... with a sheep on top... zzz...', '...five more... centuries... *snrk*... not the bridge... my bridge...', '(He rolls his tongue round a tusk, sighs enormously, and goes on snoring.)'];
    this.amb = ['Zzzz...', '*SNNRRRK*', '...mmf... pumpkins...', '*snore*', '...sheep... friend...'];
    this.ambT = 5;
    this.hx = p.x; this.hz = p.z; this.y = p.y; this.smoothY = p.y;
    this.x = p.x; this.z = p.z + 3.4;            // where you stand to talk: by his feet
    this.home = { x: this.x, z: this.z, face: 0 };
    const pm: any = PART_MAT; PART_MAT = charMatFree;
    const SK: any = 0x7d8c6a, BE: any = 0x98a47e, DK: any = 0x5c684c, FUR: any = 0x5a4630;
    const root: any = this.root = new THREE.Group();
    // legs stretched out in front, loincloth, big flat feet
    partMesh(() => {
      for (const s of [-1, 1]) {
        limb([s * 0.5, 0.45, 0.2], [s * 0.72, 0.8, 1.5], 0.46, 0.37, SK);
        limb([s * 0.72, 0.8, 1.5], [s * 0.8, 0.36, 2.55], 0.35, 0.27, SK);
        ball(s * 0.82, 0.3, 2.8, 0.31, SK, PAT.NOISE, { sx: 1.15, sy: 0.75, sz: 1.5 });
        for (let k: any = -1; k <= 1; k++) { ball(s * 0.82 + k * 0.14, 0.42, 3.18, 0.09, DK, PAT.NOISE); cone(s * 0.82 + k * 0.14, 0.44, 3.24, 0.045, 0.1, 4, 0xd8d0b8, 0, { rx: PI / 2 }); }
        ball(s * 0.74, 0.85, 1.55, 0.12, DK, PAT.NOISE);   // knobbly knees
      }
      lathe(0, 0.22, 0.05, [[1.0, 0], [0.96, 0.28], [0.82, 0.62], [0.001, 0.62]], 12, FUR, PAT.NOISE, { sz: 0.9 });
      torus(0, 0.82, 0.05, 0.8, 0.05, 4, 16, 0x3a2a1a, 0, { rx: PI / 2, sz: 0.9 });
      for (let i: any = 0; i < 5; i++) box(-0.6 + i * 0.3, 0.24, 0.92, 0.22, 0.42, 0.06, shade(FUR, 0.85 + i % 2 * 0.2), PAT.NOISE, { rx: 0.15 });
    }, root);
    // torso (breathes), arms, necklace
    this.torso = partMesh(() => {
      ball(0, 0.45, 0.35, 0.82, BE, PAT.NOISE, { sx: 1.15, sy: 0.95, sz: 0.95 });
      ball(0, 1.2, -0.15, 0.95, SK, PAT.NOISE, { sx: 1.3, sy: 0.85, sz: 0.85 });
      ball(0, 1.6, -0.5, 0.72, DK, PAT.NOISE, { sx: 1.25 });
      for (const s of [-1, 1]) ball(s * 1.05, 1.5, -0.25, 0.48, SK, PAT.NOISE);
      ball(0, 1.85, -0.05, 0.4, SK, PAT.NOISE);
      for (let i: any = 0; i < 9; i++) { const a: any = PI * 0.15 + (i / 8) * PI * 0.7; cone(Math.cos(a) * 0.5, 1.68 - Math.sin(a) * 0.12, Math.sin(a) * 0.42, 0.04, 0.13, 4, 0xe8e0c8, 0, { rx: PI }); }
      torus(0, 1.74, 0.0, 0.5, 0.025, 4, 16, 0x5a3a24, 0, { rx: PI / 2 + 0.25 });
      limb([-1.1, 1.4, -0.25], [-1.45, 0.45, 0.15], 0.3, 0.25, SK);
      limb([-1.45, 0.45, 0.15], [-1.52, -0.32, 0.75], 0.25, 0.2, SK);
      ball(-1.52, -0.36, 0.86, 0.3, SK, PAT.NOISE, { sx: 1.1, sy: 0.55, sz: 1.3 });
      for (let k: any = 0; k < 4; k++) { limb([-1.66 + k * 0.1, -0.4, 1.05], [-1.7 + k * 0.11, -0.45, 1.3], 0.065, 0.06, SK); }
      limb([1.1, 1.4, -0.25], [1.38, 0.55, 0.35], 0.3, 0.25, SK);
      limb([1.38, 0.55, 0.35], [0.58, 0.66, 0.98], 0.25, 0.21, SK);
      ball(0.42, 0.68, 1.04, 0.31, SK, PAT.NOISE, { sx: 1.25, sy: 0.7, sz: 1.1 });
      for (let i: any = 0; i < 6; i++) ball(rnd(-0.6, 0.6), rnd(0.6, 1.5), rnd(0.2, 0.6), rnd(0.05, 0.09), DK, PAT.NOISE);   // warts
    }, root, 0, 0.55, -0.1);
    // head, drooped on his chest
    this.headG = partMesh(() => {
      ball(0, 0.3, 0.1, 0.56, SK, PAT.NOISE, { sx: 1.05, sy: 0.9 });
      box(0, 0.4, 0.5, 0.86, 0.16, 0.26, DK, PAT.NOISE, { rx: 0.2 });
      ball(0, 0.18, 0.7, 0.21, 0x8e8a6a, PAT.NOISE, { sy: 1.25, sz: 1.35 });
      ball(0.08, 0.28, 0.86, 0.05, DK, PAT.NOISE);
      ball(0, -0.02, 0.3, 0.46, SK, PAT.NOISE, { sx: 1.2, sy: 0.62, sz: 1.05 });
      for (const s of [-1, 1]) { cone(s * 0.25, 0.04, 0.68, 0.06, 0.24, 5, 0xe8e0c8, 0, { rx: -0.2 }); box(s * 0.2, 0.31, 0.6, 0.16, 0.025, 0.03, 0x2a2018, 0, { rz: s * 0.15 }); }
      for (let i: any = 0; i < 5; i++) cone(rnd(-0.25, 0.25), 0.72, rnd(-0.25, 0.15), 0.07, rnd(0.2, 0.35), 4, 0x3a3428, PAT.NOISE, { rx: rnd(-0.6, 0.2), rz: rnd(-0.5, 0.5) });
      cone(-0.58, 0.3, 0.05, 0.14, 0.5, 5, SK, PAT.NOISE, { rz: 1.25 });
    }, this.torso, 0, 1.98, 0.05);
    this.earR = partMesh(() => { cone(0, 0, 0, 0.14, 0.5, 5, SK, PAT.NOISE, { rz: -1.25 }); }, this.headG, 0.58, 0.3, 0.05);
    this.headG.rotation.set(0.52, 0, 0.22);
    PART_MAT = pm;
    root.traverse((o: any) => { if (o.isMesh) o.castShadow = true; });
    root.position.set(p.x, p.y, p.z);
    scene.add(root);
    CHARS.push(this);
    addCircW(p.x, p.z - 0.15, 1.35, p.y - 0.5, p.y + 3.2);
    addColW(p.x, p.z + 1.75, 1.25, 1.25, 1, 0, p.y - 0.5, p.y + 1.2);
    for (const s of [-1, 1]) addCircW(p.x + s * 1.6, p.z + 0.5, 0.45, p.y - 0.5, p.y + 1.2);
  }
  animate(dt: any) : any {
    const t: any = (this.t += dt), ph: any = (t % 4.8) / 4.8;
    const b: any = Math.sin(ph * TAU - PI / 2) * 0.5 + 0.5;
    this.torso.scale.set(1 + b * 0.022, 1 + b * 0.03, 1 + b * 0.045);
    this.headG.rotation.x = 0.52 - b * 0.07 + Math.sin(t * 0.37) * 0.02;
    if (ph > 0.5 && this._ph <= 0.5 && this.root.visible) this.snore();
    this._ph = ph;
    const near: any = Math.hypot(player.x - this.x, player.z - this.z) < 4.5;
    this.earR.rotation.z = near && Math.sin(t * 1.9 + this.seed) > 0.75 ? Math.sin(t * 15) * 0.3 : 0;
    this.speed = 0;
  }
  snore() : any {
    const h: any = this.headG.getWorldPosition(_pv);
    for (let i: any = 0; i < 3; i++) PS.a.spawn(h.x + 0.1, h.y + 0.25 + i * 0.05, h.z + 0.75, 0.08 + i * 0.05, 0.45, 0.05, 2.6, 0.16 + i * 0.07, 0.34, _pc.set(0xc8d8ff), 0.75, 0, { shape: 2, ly: 1 });
    if (R() < 0.35) for (let i: any = 0; i < 6; i++) PS.n.spawn(h.x + rnd(-0.2, 0.2), h.y - 0.1, h.z + 0.9, rnd(-0.3, 0.3), rnd(0.05, 0.2), rnd(0.4, 0.8), rnd(0.8, 1.4), 0.12, 0.45, _pc.set(0x9a8a72), 0.35, 0, { drag: 1.5, ly: 1 });
  }
  head(out: any = new V3()) : any { return out.set(this.hx, this.y + 3.0, this.hz + 0.45); }
}

// ---- folk under the village ---------------------------------------------------------------------
function spawnUnderground() : any {
  const npc: any = (o: any) => new Character({ ug: true, ...o });
  if (UGP.dunstan) npc({ id: 'dunstan', name: 'Dunstan', title: 'Cellarman', x: UGP.dunstan.x, z: UGP.dunstan.z, y: UGP.dunstan.y, face: PI, act: 'candle',
    look: { skin: 0xe0b08a, hair: 0x6a4a2a, hairStyle: 'bald', beard: 'full', beardC: 0x7a5a3a, build: 'stout', shirt: 0xd8ccb0, sleeve: 0xd8ccb0, apron: 0x6a4a2a, pants: 0x4a3a2a, item: 'candle' },
    lines: ['Dunstan. I keep the cellar. Forty barrels of cider, nineteen of ale, and one Marta says not to ask about.', 'That wine rack has always stood open like that. Nothing behind it. Just a draught. A very long, very old draught.', 'Mind the stairs going back up. Fourth step\'s loose. Fifth step\'s looser.'],
    amb: ['...thirty-eight, thirty-nine...', 'Where did I put that cheese?'] });
  const [dx, dz]: any = [-17.4, -26.0];
  npc({ id: 'nettle', name: 'Nettle', title: 'Smuggler · off duty', x: dx - 1.95, z: dz + 1.1, y: UGP.DY, face: PI / 2, pose: 'sit', sitY: 0.47, act: 'drink',
    look: { skin: 0xd8a888, hair: 0x2a1a12, hairStyle: 'pony', build: 'slim', shirt: 0x3a3a2a, sleeve: 0x3a3a2a, pants: 0x2a2a2a, cloak: 0x2a2a30, hat: 'hood', hatC: 0x2a2a30, item: 'mug' },
    lines: ['You didn\'t see me, I didn\'t see you. Lovely arrangement.', 'East tunnel runs up to the inn cellar. West goes under the wizard\'s tower. North...', '...north is where the snoring comes from. We stopped going north.', 'We used to bring brandy down off the mountain through that cave. Then something big moved in and ate the delivery. And the mule.'],
    amb: ['*shuffles cards*', 'Raise you a copper.'] });
  if (UGP.imp) npc({ id: 'fizz', name: 'Fizzwick', title: 'Bound imp', x: UGP.imp.x, z: UGP.imp.z, y: UGP.imp.y, face: PI * 1.25, act: 'wave', r: 0.25,
    look: { skin: 0xb8402a, hair: 0x1a0a08, hairStyle: 'bald', build: 'child', shirt: 0xb8402a, sleeve: 0xb8402a, pants: 0x3a1410, boots: 0x8a2a1a, belt: 0x1a0a08, ears: 'elf', horns: true, tail: true, brow: 0x1a0a08 },
    lines: ['Psst! You! Open the cage and I\'ll grant you three wishes!', 'Fine. Two wishes. One and a half. A strongly worded suggestion?', 'Orrin calls me "a lesson in reading the small print". The small print was VERY small.'],
    amb: ['Let me ouuut!', 'Psst!', 'I can see you!'] });
  if (UGP.troll) new Troll(UGP.troll);
}
function spawnUgAnimals() : any {
  for (const run of [...(UGP.ratRuns || []), [UGP.cellarRats[0], UGP.cellarRats[1]], [UGP.cellarRats[2], UGP.cellarRats[3]]]) {
    const a: any = makeAnimal('rat', true); a.run = run; a.dir = 1; a.x = run[0][0]; a.z = run[0][1]; a.y = run[0][2]; a.wait = rnd(0, 3); a.t = rnd(0, 5);
  }
  for (const [x, z, y, r] of UGP.bats || []) { const a: any = makeAnimal('bat', true); a.orbit = { x, z, y, r, sp: rnd(1.2, 1.9) * (R() < 0.5 ? 1 : -1), a: rnd(0, TAU), ph: rnd(0, 6) }; a.t = rnd(0, 5); }
  if (UGP.sheepPen) { const [x0, z0, x1, z1]: any = UGP.sheepPen; const a: any = makeAnimal('sheep', true); a.area = [x0, z0, x1, z1]; a.x = (x0 + x1) / 2; a.z = (z0 + z1) / 2; a.ry = 1; a.floorY = UGP.F; a.y = UGP.F; a.t = 0; }
}
