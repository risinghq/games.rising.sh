// The giant corner (design §6): Grandpa's tin, the heat-mat cloche, the hoop house, the vine and its first female
// flower, three fruits on the vine before the cull, then HER: growing smoothly with her chart size every day, her
// colour and shape from the phenotype (tan, white, striped, tall, flat), the shade sail cloth rolling out and back,
// the tape wrapping her, the creak shimmer, scars and sunscald, a blowout ("The One That Got Away"), the live sign
// ("BIG EARL" over "est. 1,2?? lb"), wet or thirsty soil and drooping leaves, the kelp bucket, the radio, Grandpa's
// hat on the sign post, the second plot, the kelp pile on the beach and the Weighmaster's uninvited drive-by.
//
// Reads (never the hidden weight): s.giant { stage, name, seed, wc, gain, est, m, setDay, transplantDay, shade, feed,
//   kelpFree, radio, hat, creaking, softSpot, split, scarsBy, color, stripe, shape, twins, rotated, mustache,
//   plot2 } and s.events.active (kelp). Phase 'newgame' (title, new farm) shows Grandpa's
//   legendary BIG EARL; no state shows him too (render demo), null shows an empty corner.
// fx: giant/measure (the tape wraps her), giant/creak (a shudder), giant/grow (an overnight swell), giant/rotate,
//   giant/soak (a splash), giant/start (the tin pops open).
import * as THREE from 'three';
import { PI, clamp, lerp, damp, rng, M, C, PM, part, mergeLocal, pumpkinGeo, liveTex, CYL, CYL8, ICO0, ICO1, BOX, pool, hideAt, dummy, disposeTree } from './kit.js';
import { PLACES } from '../sim/layout.js';
import { SAIL, sailY } from './world.js';
import { estText } from '../sim/giant.js';
import { T } from '../sim/tuning.js';

const GX = PLACES.giant.x, GZ = PLACES.giant.z;
const P2 = { x: GX - 1.6, z: GZ + 1.6 }, P1 = { x: GX + 1.4, z: GZ - 1.2 };   // two plots (year 3) share the corner
const COLORS = { O: 0xe39a52, S: 0xe8a77a, T: 0xd8b07c, W: 0xebe4d2 };
const GREEN = new THREE.Color(0x7d9550);
const SHAPES = { tall: [0.9, 1.2], round: [1, 1], flat: [1.1, 0.78] };
const LEGEND = { stage: 'fruit', name: 'Big Earl', est: 1450, wc: 1450, shade: true, color: 'O', shape: 'round', setDay: -60, m: 0.6 };
// sqrt rather than the physical cube root: she should visibly grow from day to day (1,400 lb = the prototype's BIG EARL)
const sizeOf = (W) => clamp(2.4 * Math.sqrt(Math.max(W, 3) / 1400), 0.12, 3.1);
const PRE = new Set(['tin', 'started', 'sprout']);
const SEEDLING_LEAVES = T.firsts.seedling.leaves, SIGN_PAINT = T.firsts.signPaintS;   // [D]

// one fruit: a pivot (position), wob (tap squash), body (eased size) and her decals
function makeFruit(root, geo, x, z, r) {
  const pos = new THREE.Group(); pos.position.set(x, 0, z); pos.rotation.set(0, 0.4, 0.04); root.add(pos);
  const wob = new THREE.Group(); pos.add(wob);
  const body = new THREE.Group(); wob.add(body);
  const mat = PM(COLORS.O, { roughness: 0.7 });
  const shell = part(geo, mat, [0, 0, 0], [1, 1, 0.917], [0, 0, 0], body);
  part(new THREE.CylinderGeometry(0.16, 0.26, 0.5, 6), C(0x6e6a3e), [0.04, geo.userData.top + 0.04, -0.02], [0.42, 0.42, 0.42], [0.35, 0, -0.2], body);
  // stripes (a cosmetic mutation)
  const stripeMat = PM(0xf3ead6, { roughness: 0.7 }), stripes = new THREE.Group(); body.add(stripes);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2; part(new THREE.SphereGeometry(1, 6, 10, a - 0.06, 0.12, 0.15, 2.6), stripeMat, [0, 0.66 * 0.85, 0], [1.01, 0.66 * 0.97, 1.01], [0, 0, 0], stripes); }
  mergeLocal(stripes); stripes.children.forEach((m) => (m.castShadow = false)); stripes.visible = false;
  // marks on the skin: dark ones (cracks, scratches, a scuff) and pale ones (sunscald)
  const surface = (k, n, sx, sy) => {
    const im = new THREE.InstancedMesh(ICO0, M(k), n);
    for (let i = 0; i < n; i++) {
      const a = r.rr(-1.1, 1.1) + (i % 2 ? PI * 0.35 : 0), y = r.rr(0.35, 0.85), rad = Math.sqrt(Math.max(0, 1 - ((y - 0.56) / 0.66) ** 2)) * 0.98;
      dummy.position.set(Math.sin(a) * rad, y, Math.cos(a) * rad); dummy.rotation.set(r.rand(), a, r.rand()); dummy.scale.set(sx, sy, sx * 0.6);
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    }
    im.count = 0; im.castShadow = false; body.add(im);
    return im;
  };
  const scars = surface(0x5b3d26, 8, 0.1, 0.022), scald = surface(0xf2e3bf, 3, 0.2, 0.05);
  const crackMat = M(0x2a1a0e, { emissive: 0xff7a3a, emissiveIntensity: 0 });
  const crack = new THREE.Group(); body.add(crack);
  // The crack is drawn on her skin: each zig point is found by casting a ray at the shell (ribs and grooves included), and
  // each segment is laid along the surface between two hits. A treated crack is stitched shut with pale thread.
  const stitches = new THREE.Group(); crack.add(stitches);
  const thread = M(0xfff6e0, { emissive: 0xfff1d0, emissiveIntensity: 0.45 });
  {
    const probe = new THREE.Mesh(geo); probe.scale.set(1, 1, 0.917); probe.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(), o = new THREE.Vector3(), dir = new THREE.Vector3();
    const onSkin = (a, y) => {           // a: angle around her (0 faces +z), y: height in body space
      o.set(Math.sin(a) * 3, y, Math.cos(a) * 3); dir.set(-o.x, 0, -o.z).normalize();
      ray.set(o, dir);
      const h = ray.intersectObject(probe)[0];
      return h ? { p: h.point.clone(), n: h.face.normal.clone().divide(probe.scale).normalize() } : null;
    };
    // the zigzag in (angle, height), then a midpoint between each pair so every piece hugs the curve
    const zig = []; { let a = -0.9, y = 0.78; for (let i = 0; i <= 7; i++) { zig.push([a, y]); a += 0.095; y -= r.rr(0.03, 0.09) * (i % 2 ? -1 : 1); } }
    const pts = [];
    zig.forEach(([a, y], i) => { if (i) pts.push(onSkin((a + zig[i - 1][0]) / 2, (y + zig[i - 1][1]) / 2)); pts.push(onSkin(a, y)); });
    const m = new THREE.Matrix4(), tg = new THREE.Vector3(), bn = new THREE.Vector3(), nm = new THREE.Vector3(), eu = new THREE.Euler();
    const lay = (A, B, mat, size, into) => {
      tg.subVectors(B.p, A.p); const len = tg.length(); tg.divideScalar(len || 1);
      nm.addVectors(A.n, B.n).normalize(); bn.crossVectors(nm, tg).normalize(); nm.crossVectors(tg, bn);
      m.makeBasis(tg, bn, nm); eu.setFromRotationMatrix(m);
      const c = A.p.clone().add(B.p).multiplyScalar(0.5).addScaledVector(nm, size[3]);
      part(BOX, mat, [c.x, c.y, c.z], [size[0] ?? len + 0.006, size[1], size[2]], [eu.x, eu.y, eu.z], into);
    };
    for (let i = 1; i < pts.length; i++) if (pts[i - 1] && pts[i]) lay(pts[i - 1], pts[i], crackMat, [null, 0.022, 0.03, 0.004], crack);
    for (let i = 2; i < pts.length; i += 2) if (pts[i - 2] && pts[i]) lay(pts[i - 2], pts[i], thread, [0.022, 0.12, 0.03, 0.012], stitches);
  }
  mergeLocal(stitches); mergeLocal(crack); crack.traverse((m) => (m.castShadow = false)); crack.visible = false; stitches.visible = false;
  const gash = part(ICO1, M(0x3a2414), [0.2, 0.55, 0.85], [0.38, 0.24, 0.2], [0.2, 0, 0.5], body); gash.visible = false;
  const stache = part(new THREE.TorusGeometry(0.16, 0.05, 4, 10, PI), M(0x1d1a18), [0, 0.7, 0.99], [1.6, 1, 1], [0, 0, PI], body); stache.visible = false;
  const twin = part(geo, mat, [0.95, 0, -0.1], [0.78, 0.78, 0.72], [0, 1.1, 0], body); twin.visible = false;
  return { pos, wob, body, mat, shell, stripes, scars, scald, crack, crackMat, stitches, gash, stache, twin, size: null, col: new THREE.Color(COLORS.O), swell: 0, shudder: 0 };
}

export default function createGiantView(K) {
  const { scene } = K, r = rng(6100);
  const root = new THREE.Group(); root.name = 'giant'; scene.add(root);
  const gy = K.world?.heightAt?.(GX, GZ) ?? 0;
  const geo = pumpkinGeo({ ribs: 10, ws: 50, hs: 22, squash: 0.66, groove: 0.07 });
  const F1 = makeFruit(root, geo, GX, GZ, r), F2 = makeFruit(root, geo, P2.x, P2.z, r);
  // three little fruits on the vine before the cull (keep 1 of 3)
  const trio = new THREE.Group(); root.add(trio);
  const trioMat = PM(0x8fa55c, { roughness: 0.6 });
  for (const [dx, dz, s] of [[0, 0, 0.28], [1.1, -1.9, 0.22], [-1.2, -1.6, 0.24]]) part(geo, trioMat, [GX + dx, 0, GZ + dz], [s, s, s], [0, r.rand() * 3, 0], trio);
  mergeLocal(trio);
  // ---- soil: a dark ring when wet, pale and cracked when thirsty
  const soilMat = M(0x8a6e4e, { polygonOffset: true, polygonOffsetFactor: -2 });
  const soil = new THREE.Mesh(new THREE.CircleGeometry(2.3, 24).rotateX(-PI / 2), soilMat);
  soil.position.set(GX, gy + 0.025, GZ); soil.receiveShadow = true; root.add(soil);
  const DRY = new THREE.Color(0xc2ab84), WET = new THREE.Color(0x5e4a35), soilCol = new THREE.Color();
  // ---- vines, leaves, the first female flower, the seedling, the hoop house, the heat-mat cloche, Grandpa's tin
  const vineMat = C(0x6f7f4a), vines = new THREE.Group(); root.add(vines);
  const VINE_SEGS = [[GX, GZ - 1.6, GX - 0.4, GZ - 4.2], [GX - 0.4, GZ - 4.2, GX - 2.6, GZ - 4.4], [GX - 0.4, GZ - 4.2, GX + 2.4, GZ - 4.0], [GX, GZ, GX, GZ - 1.6]];
  for (const [x0, z0, x1, z1] of VINE_SEGS) part(CYL, vineMat, [(x0 + x1) / 2, gy + 0.08, (z0 + z1) / 2], [0.07, Math.hypot(x1 - x0, z1 - z0), 0.07], [PI / 2, 0, -Math.atan2(x1 - x0, z1 - z0)], vines);
  mergeLocal(vines);
  const leafGeo = new THREE.CircleGeometry(1, 6);
  { const lp = leafGeo.attributes.position; for (let i = 1; i < lp.count; i++) { const f = i % 2 ? 1 : 0.72; lp.setXY(i, lp.getX(i) * f, lp.getY(i) * f); } }
  leafGeo.rotateX(-PI / 2); leafGeo.translate(0, 0, 0.5);
  const LEAVES = 26, leaves = pool(leafGeo, M(0xffffff, { side: THREE.DoubleSide }), LEAVES, true, root);
  const leafData = Array.from({ length: LEAVES }, (_, i) => {
    const a = (i / LEAVES) * PI * 2, rad = r.rr(2.2, 3.4), [x0, z0, x1, z1] = VINE_SEGS[i % 4], u = r.rr(0.1, 1), off = r.rr(0.2, 0.55) * (i % 2 ? 1 : -1);
    const len = Math.hypot(x1 - x0, z1 - z0), nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
    return { x: GX + Math.cos(a) * rad, z: GZ + Math.sin(a) * rad, vx: lerp(x0, x1, u) + nx * off, vz: lerp(z0, z1, u) + nz * off, s: r.rr(0.6, 0.85), y: r.rr(0.2, 0.55),
      rx: r.rr(-0.5, 0.2), ry: r.rand() * PI * 2, rz: r.rr(-0.3, 0.3), c: new THREE.Color(r.pick([0x7d9a6a, 0x6b8a5c, 0x8fa877, 0x78935f, 0x9aae7c])), k: r.rand() };
  });
  const DROOP = new THREE.Color(0xa6a46a), lc = new THREE.Color();
  const blossom = part(new THREE.ConeGeometry(0.22, 0.36, 6).rotateX(PI), M(0xf2c14e, { emissive: 0x5a3a00, emissiveIntensity: 0.3 }), [GX + 0.4, gy + 0.5, GZ - 1.2], [1, 1, 1], [0, 0, 0], root);
  // [D] the seedling (plan §3.7 "SHE'S UP"): up in her pot from germination, two seed leaves and then a true leaf every
  // T.firsts.leafDays until she goes out to the corner; drawn bigger than life so it reads on a phone. One merged variant per
  // leaf count, only one shown (1-2 draw calls).
  const sprout = new THREE.Group(); sprout.position.set(GX, gy, GZ); root.add(sprout);
  const SEED_LEAF = C(0x9cbf74), TRUE_LEAF = C(0x6f9a52);
  const seedlings = Array.from({ length: SEEDLING_LEAVES + 1 }, (_, n) => {
    const g = new THREE.Group(), h = 0.3 + 0.045 * n;
    part(CYL, vineMat, [0, h / 2, 0], [0.035, h, 0.035], [0, 0, 0], g);
    for (const sx of [-1, 1]) part(ICO1, SEED_LEAF, [sx * 0.13, 0.31, 0], [0.13, 0.03, 0.08], [0, 0, sx * 0.35], g);
    for (let k = 1; k <= n; k++) {
      const a = k * 2.4, y = 0.3 + 0.045 * k, rr = 0.1 + 0.012 * (n - k), s = 0.1 + 0.012 * (n - k);
      part(ICO1, TRUE_LEAF, [Math.cos(a) * rr, y, Math.sin(a) * rr], [s, 0.025, s * 0.8], [0, -a, 0.25], g);
    }
    mergeLocal(g); g.visible = false; sprout.add(g);
    return g;
  });
  const hoop = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 14, 1, true, -PI / 2, PI).rotateX(-PI / 2),
    M(0xf4f1ea, { transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, roughness: 0.4 }));
  hoop.position.set(GX, gy, GZ); hoop.renderOrder = 1; root.add(hoop);
  const pot = new THREE.Group(); pot.position.set(GX, gy, GZ); root.add(pot);       // the heat mat and pot, under a cloche
  part(BOX, M(0x8a3b2a, { emissive: 0xff6a2a, emissiveIntensity: 0.35 }), [0, 0.03, 0], [0.9, 0.05, 0.6], [0, 0, 0], pot);
  part(new THREE.CylinderGeometry(0.2, 0.15, 0.26, 8), C(0xb7643e), [0, 0.18, 0], [1, 1, 1], [0, 0, 0], pot);
  const cloche = part(new THREE.SphereGeometry(0.36, 12, 6, 0, PI * 2, 0, PI / 2), M(0xdfeeea, { transparent: true, opacity: 0.45, roughness: 0.2, depthWrite: false }), [0, 0.06, 0], [1, 1.3, 1], [0, 0, 0], pot);
  cloche.castShadow = false;
  cloche.userData.keep = true; mergeLocal(pot);
  const tin = new THREE.Group(); tin.position.set(GX + 0.9, gy, GZ - 0.6); root.add(tin);  // Grandpa's tin on a stump
  part(CYL8, C(0x8b6b4a), [0, 0.18, 0], [0.32, 0.36, 0.32], [0, 0, 0], tin);
  part(CYL8, M(0x6f8b7b, { metalness: 0.4, roughness: 0.4 }), [0, 0.45, 0], [0.17, 0.18, 0.17], [0, 0, 0], tin);
  const lid = part(CYL8, M(0xb9a07a, { metalness: 0.5, roughness: 0.35 }), [0, 0.56, 0], [0.18, 0.04, 0.18], [0, 0, 0], tin);
  // ---- props that show her care: the kelp bucket, a fish can, the radio, Grandpa's hat, the soaker hose
  const bucket = new THREE.Group(); bucket.position.set(GX + 2.0, gy, GZ + 1.3); root.add(bucket);
  part(new THREE.CylinderGeometry(0.2, 0.16, 0.34, 10), C(0x9aa1a5), [0, 0.17, 0], [1, 1, 1], [0, 0, 0], bucket);
  part(new THREE.CircleGeometry(0.18, 10).rotateX(-PI / 2), C(0x4f5a2c), [0, 0.33, 0], [1, 1, 1], [0, 0, 0], bucket);
  const fishCan = part(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 10), C(0x5d7fa0), [GX + 2.4, gy + 0.11, GZ + 0.9], [1, 1, 1], [0, 0, 0], root);
  const radio = new THREE.Group(); radio.position.set(GX - 2.0, gy, GZ + 1.6); radio.rotation.y = 0.7; root.add(radio);
  part(BOX, C(0x9b8774), [0, 0.15, 0], [0.5, 0.3, 0.4], [0, 0, 0], radio);
  part(BOX, C(0x5d6168), [0, 0.42, 0], [0.42, 0.24, 0.16], [0, 0, 0], radio);
  part(CYL, C(0xd8d2c4), [0.14, 0.62, 0], [0.01, 0.3, 0.01], [0, 0, 0.3], radio);
  const hat = new THREE.Group(); hat.position.set(PLACES.sign.x, gy + 1.62, PLACES.sign.z); root.add(hat);
  part(CYL8, C(0x8a6e4e), [0, 0, 0], [0.3, 0.03, 0.3], [0, 0, 0], hat);
  part(CYL8, C(0x8a6e4e), [0, 0.1, 0], [0.17, 0.18, 0.17], [0, 0, 0], hat);
  part(CYL8, C(0xb5543f), [0, 0.04, 0], [0.175, 0.04, 0.175], [0, 0, 0], hat);
  mergeLocal(bucket); mergeLocal(radio); mergeLocal(hat); mergeLocal(tin, true);
  const hose = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.04, 4, 32).rotateX(PI / 2), C(0x2f3a35));
  hose.position.set(GX, gy + 0.05, GZ); root.add(hose);
  // ---- shade sail: the cloth stretched over the posts, rolling out from the furled edge
  const sailGeo = new THREE.PlaneGeometry(SAIL.h * 2, SAIL.h * 2, 6, 6); sailGeo.rotateX(-PI / 2);
  { const sp = sailGeo.attributes.position; for (let i = 0; i < sp.count; i++) { const u = sp.getX(i) / (2 * SAIL.h) + 0.5, v = sp.getZ(i) / (2 * SAIL.h) + 0.5; sp.setY(i, sailY(u, v) - 0.2 * Math.sin(u * PI) * Math.sin(v * PI)); } }
  sailGeo.translate(SAIL.h, 0, 0); sailGeo.computeVertexNormals();             // pivot on the furled (west) edge
  const sail = part(sailGeo, M(0xece5d3, { side: THREE.DoubleSide }), [SAIL.x - SAIL.h, 0, SAIL.z], [1, 1, 1], [0, 0, 0], root);
  const furl = part(CYL8, C(0xe2dac6), [SAIL.x - SAIL.h + 0.12, sailY(0, 0.5) - 0.05, SAIL.z], [0.12, SAIL.h * 2, 0.12], [PI / 2, 0, 0], root);
  // ---- the sign: post + live canvas
  // [D] k < 1: her name is being painted on, left to right with the brush at its edge (MEET {NAME}); the "est." comes last
  const sign = liveTex(256, 160, (g, w, h, name, est, k = 1) => {
    g.fillStyle = '#3f4c43'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b9a98c'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#f3efe4'; g.textAlign = 'center';
    let px = 46; g.font = `700 ${px}px Georgia, serif`;
    while (g.measureText(name).width > w - 34 && px > 16) g.font = `700 ${--px}px Georgia, serif`;
    if (k >= 1) g.fillText(name, w / 2, 58 + px * 0.3);
    else {
      const tw = g.measureText(name).width, x0 = (w - tw) / 2, edge = x0 + tw * Math.min(1, k / 0.85);
      g.save(); g.beginPath(); g.rect(0, 0, edge, h); g.clip(); g.fillText(name, w / 2, 58 + px * 0.3); g.restore();
      if (k < 0.85) { g.fillStyle = '#e9b27a'; g.beginPath(); g.arc(edge, 50 + Math.sin(k * 40) * 9, 6, 0, PI * 2); g.fill(); }
    }
    if (k < 0.85) return;
    px = 26; g.font = `italic ${px}px Georgia, serif`;
    while (g.measureText(est).width > w - 30 && px > 14) g.font = `italic ${--px}px Georgia, serif`;
    g.globalAlpha = Math.min(1, (k - 0.85) / 0.15);
    g.fillStyle = '#e9b27a'; g.fillText(est, w / 2, 124);
    g.globalAlpha = 1;
  });
  let paintT = 1;                                  // [D] 0..1 while her name is being painted on
  part(CYL, C(0x9b8774), [PLACES.sign.x, gy + 0.55, PLACES.sign.z], [0.05, 1.1, 0.05], [0, 0, 0], root);
  part(new THREE.PlaneGeometry(1.15, 0.72), M(0xffffff, { map: sign.tex, flatShading: false }), [PLACES.sign.x, gy + 1.15, PLACES.sign.z + 0.05], [1, 1, 1], [0, -PI / 4, 0], root);
  // ---- the tape: a band wraps her girth, then a second one goes over the top, ground to ground
  const tapeMat = M(0xf2c14e, { emissive: 0x6a4a00, emissiveIntensity: 0.5 });
  const girth = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 4, 48).rotateX(PI / 2), tapeMat);
  const over = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 4, 32, PI), tapeMat);
  girth.visible = over.visible = false; F1.body.add(girth, over);
  // ---- the kelp pile on the beach while the wash-up lasts
  const kelp = new THREE.Group(); kelp.position.set(PLACES.kelp.x, K.world?.heightAt?.(PLACES.kelp.x, PLACES.kelp.z) ?? 0, PLACES.kelp.z); root.add(kelp);
  for (let i = 0; i < 16; i++) part(ICO1, C(i % 3 ? 0x4f5a2c : 0x6b5a2c), [r.rr(-1.1, 1.1), 0.08, r.rr(-0.9, 0.9)], [r.rr(0.3, 0.55), 0.09, r.rr(0.14, 0.28)], [0, r.rand() * 3, 0], kelp);
  mergeLocal(kelp); kelp.visible = false;
  // ---- [C] Moving Day (rulings R7, R18): the hoop house rises over her when she goes out; she droops under it while she
  // sulks (a foggy move), and perks up with a new leaf the morning she roots. And the tin's three taps (lid, nick, mat).
  const MV = { hoopT: 1, perkT: 1, droop: 0, tin: 0, tinT: 1 };
  // ---- [C] syncDawnBees: the bees out at dawn, around her flower while the dawn card is up (8 on a clear dawn, 1 in fog):
  // one instanced cloud, at most 8 bees, one draw call
  const BEES = 8, bees = pool(new THREE.SphereGeometry(0.07, 6, 4).scale(1.3, 0.9, 0.9), M(0xf2c14e, { emissive: 0x3a2a00, emissiveIntensity: 0.25 }), BEES, false, root);
  const beeData = Array.from({ length: BEES }, (_, i) => ({ a: (i / BEES) * PI * 2, r: r.rr(0.35, 0.8), h: r.rr(0.35, 0.9), w: r.rr(1.6, 3.2) }));
  let beesShown = -1;

  let measureT = 1, lastLeaf = '', notesT = 0;
  const lerpSize = (F, want, dt) => { F.size = F.size == null ? want : lerp(F.size, want, damp(dt, 2.2)); };
  function fruitSync(F, p, dt, t, s, show) {
    F.pos.visible = show;
    if (!show) { F.size = null; return; }
    const day = s?.clock?.dayFrac ?? 0, live = p.split === 'blowout' ? 0 : (p.gain || 0) * day;
    lerpSize(F, sizeOf((p.wc || p.est || 0) + live), dt);
    const blow = p.split === 'blowout', [sxz, sy] = SHAPES[p.shape] || SHAPES.round;
    const swell = 1 + 0.035 * Math.sin(Math.min(1, F.swell) * PI);
    F.swell = Math.max(0, F.swell - dt * 1.4);
    F.body.scale.set(F.size * sxz * swell, F.size * sy * (blow ? 0.84 : 1) * swell, F.size * sxz * swell);
    // young fruit is green and ripens into her colour over three weeks
    const age = p.setDay != null && s?.clock ? (s.clock.day - p.setDay) : 60;
    F.col.setHex(COLORS[p.color] ?? COLORS.O).lerp(GREEN, clamp(1 - age / 22, 0, 1) * 0.85);
    if (blow) F.col.multiplyScalar(0.82);
    F.mat.color.copy(F.col);
    F.stripes.visible = !!p.stripe && age > 20;
    const sb = p.scarsBy || {};
    F.scars.count = clamp((sb.crack || 0) + (sb.heist || 0) + (sb.scuff || 0) + (p.split === 'crack' && !sb.crack ? 2 : 0) + (p.scarsBy ? 0 : p.scars | 0), 0, 8);
    F.scald.count = clamp(sb.sunscald || 0, 0, 3);
    F.gash.visible = blow;
    F.crack.visible = !!(p.creaking || p.softSpot) || p.split === 'crack';
    // creaking (or a soft spot) glows and throbs; a crack that has split stays dark; treated, it is stitched shut
    F.crackMat.emissiveIntensity = p.creaking ? 0.9 + 0.8 * Math.sin(t * 6) : 0;
    F.stitches.visible = p.split === 'crack' && !!p.treated && !p.creaking;
    F.stache.visible = !!p.mustache;
    F.twin.visible = !!p.twins;
    F.pos.rotation.y = 0.4 + (p.rotated ? PI / 2 : 0);
    const sh = F.shudder > 0 ? Math.sin(F.shudder * 55) * 0.025 * F.shudder : 0;
    F.pos.rotation.z = 0.04 + sh + (p.creaking ? Math.sin(t * 23) * 0.003 : 0);
    F.shudder = Math.max(0, F.shudder - dt);
  }

  function sync(s, dt, t) {
    const legend = s === undefined || s?.giant === undefined || s?.clock?.phase === 'newgame';
    const g = legend ? LEGEND : s.giant;
    if (!g) { root.visible = false; return; }
    root.visible = true;
    const stage = String(g.stage || 'none');
    const gone = /^(gone|carved|weighed)/.test(stage);
    const fruit = !gone && (g.setDay != null || g.wc > 0 || /^(set|fruit|grown)/.test(stage));
    const culled = fruit && stage !== 'set';
    const d = s?.clock?.day ?? 150;
    // the seed's first weeks
    tin.visible = stage === 'tin';
    lid.position.y = 0.56;
    pot.visible = stage === 'started' || stage === 'sprout';
    // [D] up in her pot (the cloche comes off so you can see her), then out in the corner under the hoop house
    const up = stage === 'sprout' || stage === 'seedling';
    sprout.visible = up;
    cloche.visible = stage === 'started';
    if (up) {
      const n = clamp(Math.floor((d - (g.germDay ?? d)) / T.firsts.seedling.leafDays), 0, SEEDLING_LEAVES);
      for (let i = 0; i < seedlings.length; i++) seedlings[i].visible = i === n;
      sprout.position.y = gy + (stage === 'sprout' ? 0.3 : 0.02);
      sprout.scale.setScalar(stage === 'sprout' ? 1.6 : 2);
    }
    hoop.visible = stage === 'seedling' || (stage === 'vine' && g.transplantDay != null && d - g.transplantDay < 24);
    const vine = fruit || stage === 'vine' || stage === 'flower';
    vines.visible = vine;
    blossom.visible = stage === 'flower';
    trio.visible = stage === 'set';
    // leaves: a few on a young vine, the full ring once she's fruiting; they droop when she's thirsty
    const grow = g.transplantDay != null && !legend ? clamp((d - g.transplantDay - 6) / 40, 0.2, 1) : 1;
    const leafK = !vine ? 0 : fruit ? 1 : Math.min(0.85, grow);
    const m = g.m ?? 0.6, droop = vine && m < 0.3 ? clamp((0.3 - m) / 0.15, 0, 1) : 0;
    const leafKey = `${leafK.toFixed(2)}|${droop.toFixed(2)}`;
    if (leafKey !== lastLeaf) {
      lastLeaf = leafKey;
      for (let i = 0; i < LEAVES; i++) {
        const l = leafData[i];
        if (l.k > leafK + 0.15 || leafK === 0) { hideAt(leaves, i); continue; }
        const k = clamp((leafK - l.k + 0.15) * 3, 0.3, 1), ring = leafK >= 1;
        dummy.position.set(ring ? l.x : l.vx, gy + l.y * (ring ? 1 : 0.7) * (1 - droop * 0.5), ring ? l.z : l.vz);
        dummy.rotation.set(l.rx + droop * 0.9, l.ry, l.rz); dummy.scale.setScalar(l.s * k * (ring ? 1 : 0.8));
        dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
        leaves.setColorAt(i, lc.copy(l.c).lerp(DROOP, droop * 0.7));
      }
      leaves.instanceMatrix.needsUpdate = true;
      if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    }
    // soil darkens with water (the thing the Water setting changes, visible from the sky)
    soil.visible = g.transplantDay != null && !legend;
    soilCol.copy(DRY).lerp(WET, clamp((m - 0.15) / 0.7, 0, 1));
    soilMat.color.lerp(soilCol, damp(dt, 3));
    // the fruit(s)
    fruitSync(F1, g, dt, t, s, culled);
    const p2 = legend ? null : g.plot2, two = !!p2 && p2.setDay != null && p2.stage !== 'set' && !gone;
    fruitSync(F2, p2 || {}, dt, t, s, two);
    F1.pos.position.x = lerp(F1.pos.position.x, two ? P1.x : GX, damp(dt, 3)); F1.pos.position.z = lerp(F1.pos.position.z, two ? P1.z : GZ, damp(dt, 3));
    // care props
    const fed = g.feed || 'none';
    bucket.visible = !legend && g.transplantDay != null && (fed === 'kelp' || fed === 'both' || (g.kelpFree || 0) > 0);
    fishCan.visible = !legend && (fed === 'fish' || fed === 'both');
    radio.visible = !legend && !!g.radio;
    hat.visible = !legend && !!g.hat;
    hose.visible = !legend && !!s?.owned?.soaker && g.transplantDay != null;
    if (radio.visible && (notesT -= dt) <= 0) { notesT = 1.6; K.fx?.float?.('♪', GX - 2.0 + Math.sin(t) * 0.2, 1.0, GZ + 1.6, ''); }
    // shade sail rolls out from the furled edge
    const want = g.shade ? 1 : 0.02, cur = sail.scale.x;
    sail.scale.x = lerp(cur, want, damp(dt, 4));
    sail.visible = sail.scale.x > 0.05;
    furl.visible = true;
    // the tape
    if (measureT < 1) {
      measureT = Math.min(1, measureT + dt / 1.8);
      const k = measureT, top = geo.userData.top;
      girth.visible = k < 0.95; over.visible = k > 0.45 && k < 0.98;
      girth.position.y = top * 0.42; girth.scale.setScalar(lerp(0.25, 1.03, Math.min(1, k * 2.2)));
      girth.rotation.y = k * 6;
      over.position.y = top * 0.42; over.scale.set(1.03, 1.06, 1.03);
      over.rotation.set(0, PI / 2, lerp(-PI / 2, 0, clamp((k - 0.45) / 0.4, 0, 1)));
      if (k >= 1) girth.visible = over.visible = false;
    }
    // the sign: her name over "est. 1,2?? lb", the motif of the hidden weight
    const blow = g.split === 'blowout';
    const name = blow ? 'THE ONE THAT GOT AWAY' : (g.name || (fruit ? 'Unnamed' : "Grandpa's corner")).toUpperCase();
    if (paintT < 1) paintT = Math.min(1, paintT + dt / SIGN_PAINT);
    sign.paint(name, blow ? (g.name || '') : fruit ? estText(g.est) : g.seed?.short || (typeof g.seed === 'string' ? g.seed : 'growing...'),
      Math.round(paintT * 48) / 48);
    // kelp on the beach
    const active = s?.events?.active || [];
    kelp.visible = active.some((a) => a.id === 'kelp');
    movingSync(g, stage, d, dt, t, legend);
    syncDawnBees(s, stage, t, legend);
  }
  // ---- [C] Moving Day and the tin: the hoop rises, she droops while she sulks and perks up when she roots
  function movingSync(g, stage, d, dt, t, legend) {
    if (stage === 'tin') {                         // the lid slides off on the first tap and stays off
      const k = MV.tin >= 1 ? 1 : 0;
      lid.position.set(lerp(0, 0.24, k), lerp(0.56, 0.44, k), 0); lid.rotation.z = -0.5 * k;
    } else { MV.tin = 0; lid.position.set(0, 0.56, 0); lid.rotation.z = 0; }
    const sulking = !legend && stage === 'seedling' && g.rootedDay != null && d < g.rootedDay && g.rootedDay - (g.transplantDay ?? d) > 1;
    MV.droop = lerp(MV.droop, sulking ? 1 : 0, damp(dt, 2));
    // a sulk you can see from the sky: a little grey "sulk" drifts up out of the hoop house now and then
    if (sulking && (MV.sulkT = (MV.sulkT ?? 0) - dt) <= 0) { MV.sulkT = 2.4; K.fx?.float?.('sulk…', GX + Math.sin(t) * 0.2, gy + 1.4, GZ, ''); }
    if (MV.hoopT < 1) MV.hoopT = Math.min(1, MV.hoopT + dt / 1.1);
    hoop.position.y = gy - 1.3 * (1 - easeOut(MV.hoopT));         // it rises out of the ground over her
    const perk = MV.perkT < 1 ? Math.sin(MV.perkT * PI) * 0.12 : 0;
    MV.perkT = Math.min(1, MV.perkT + dt / 0.9);
    // a sulk is a lean and a slump (the leaf colour belongs to the seedling's own leaves); a perk is a little hop
    sprout.rotation.z = 0.45 * MV.droop + Math.sin(t * 1.3) * 0.03 * MV.droop;
    sprout.rotation.x = -0.2 * MV.droop;
    if (sprout.visible) sprout.scale.multiplyScalar((1 + perk) * (1 - 0.12 * MV.droop));
  }
  const easeOut = (k) => 1 - (1 - k) ** 3;
  function syncDawnBees(s, stage, t, legend) {
    const card = !legend && stage === 'flower' && s?.story?.cards?.[0]?.kind === 'pollinate' ? s.story.cards[0] : null;
    const n = card ? clamp(card.data?.bees | 0, 0, BEES) : 0;
    bees.visible = n > 0;
    if (!n && beesShown === 0) return;
    beesShown = n;
    const bx = blossom.position.x, by = blossom.position.y, bz = blossom.position.z;
    for (let i = 0; i < BEES; i++) {
      if (i >= n) { hideAt(bees, i); continue; }
      const b = beeData[i], a = b.a + t * b.w * (i % 2 ? 1 : -1);
      dummy.position.set(bx + Math.cos(a) * b.r, by + b.h + Math.sin(t * 7 + i) * 0.05, bz + Math.sin(a) * b.r);
      dummy.rotation.set(0, -a, 0); dummy.scale.setScalar(n === 1 ? 1.6 : 1);   // one lonely bee is easy to spot
      dummy.updateMatrix(); bees.setMatrixAt(i, dummy.matrix);
    }
    bees.instanceMatrix.needsUpdate = true;
  }
  function fx(ev) {
    if (ev.type === 'giant/measure') { measureT = 0; }
    if (ev.type === 'giant/creak' || ev.type === 'giant/split') (ev.plot === 2 ? F2 : F1).shudder = ev.type === 'giant/split' ? 1.4 : 1;
    if (ev.type === 'giant/grow' && ev.gain >= 4) (ev.plot === 2 ? F2 : F1).swell = 1;
    if (ev.type === 'giant/start') lid.position.y = 0.7;
    if (ev.type === 'giant/cull' && ev.plot !== 2) paintT = 0;          // [D] the sign paints her new name
    if (ev.type === 'giant/tin') MV.tin = Math.max(MV.tin, ev.step);                          // [C] the lid slides off
    if (ev.type === 'giant/transplant' && ev.plot === 1) MV.hoopT = 0;                         // [C] the hoop house rises
    if (ev.type === 'giant/rooted' && ev.plot === 1) MV.perkT = 0;                             // [C] she roots: a perk
  }
  if (K.squashables) K.squashables.giant = F1.wob;
  return { sync, fx, root, fruit: F1.body, fruitPos: F1.pos, sign, dispose() { scene.remove(root); disposeTree(root); brow?.parent?.remove(brow); } };
}
