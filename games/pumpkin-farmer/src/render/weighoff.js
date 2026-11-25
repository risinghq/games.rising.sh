// The weigh-off and Halloween view (design §8, §9). Reads s.weighoff / s.winter and the giant's visible fields (never the
// hidden weight: sizes come from published estimates), and takes its timing from the UI's fx events:
//   weighoff/beat { k, n, grade }      a HEAVE beat: she lifts a notch toward the scale (a wobble shakes her)
//   weighoff/readout { text, label? }  the scale's live canvas mirrors the DOM digits
//   weighoff/reveal { phase: 'read'|'count'|'lock'|'done', heavy?, light?, exhibition? }   Marlene thickens, then the sun
//                                      breaks through to golden hour (heavy) or the fog rolls in (light)
//   weighoff/eyes { k, on, caught? }   the Night Watch: glowing eyes come and go; caught ones scamper off in a flash
//   winter/carve { canvas }            the carving mask (R = shave glow, G = punch blaze) projected onto her front
//   winter/treat { group }             (sim) a trick-or-treat group gets candy and hops
// Draws: rivals' giants on pallets with placards and their growers, the raccoons' disguise of the year, your entries
// (lifted onto the scale, inspected by flashlight, weighed), the ring of neighbours, the Mayor and the judges, Night Watch
// eyes and raccoon footprints, scripted orthographic push-ins, and on Halloween her carved face glowing by the barn door
// while trick-or-treaters in sheets walk up for candy. Everything here is built lazily and hidden outside its phases.
import * as THREE from 'three';
import {
  PI, clamp, lerp, damp, rng, M, C, PM, VCS, part, mergeLocal, pumpkinGeo, canvasTex, billboards, glowTex, dotTex, prepGeo,
  mergeGeometries, CYL, CYL8, ICO0, ICO1, BOX, CONE, pool, hideAt, dummy, disposeTree,
} from './kit.js';
import { fogPatch } from './fog.js';
import { PLACES } from '../sim/layout.js';
import { T } from '../sim/tuning.js';
import { makeTownsfolk, makeFolk, createCrowd, SPECIES_KEYS } from './folk.js';

const SC = PLACES.scale, GX = PLACES.giant.x, GZ = PLACES.giant.z;
const TOP = 0.23, YAW = -PI / 4;                                   // the scale's platform; facing the isometric camera
const LIFT = { x: -16.4, z: 13.6 };
const PALLET = (k) => ({ x: -11.0 + k * 2.4, z: 17.0 });
const PORCH = { x: -12.3, z: -10.0 };
const MAYOR = { x: -13.4, z: 14.4 };
const JUDGES = [{ x: -8.6, z: 19.0 }, { x: -7.2, z: 19.1 }, { x: -5.8, z: 19.0 }];
const WM_HOME = { x: PLACES.weighmaster.x, z: PLACES.weighmaster.z, yaw: -1.33 };
const COLORS = { O: 0xe39a52, S: 0xe8a77a, T: 0xd8b07c, W: 0xebe4d2 };
const SHAPES = { tall: [0.9, 1.2], round: [1, 1], flat: [1.1, 0.78] };
const RIVAL_LOOK = { vance: [0xe8b07a, 'round'], tom: [0xd8b07c, 'flat'], mavis: [0xe39a52, 'round'], hoot: [0xe0904a, 'tall'],
  vale: [0xe6863a, 'tall'], lindqvist: [0xdcae86, 'flat'], raccoons: [0xd98a3e, 'round'] };
const GROWER = { vance: 'vance', tom: 'bigtom', mavis: 'mavis', hoot: 'hoot', vale: 'vale', lindqvist: 'lindqvist' };
// camera shots per step: look-at x, z and the world units that must fit
const SHOTS = {
  eve: [GX + 0.4, GZ + 0.6, 11], watch: [GX + 0.6, GZ + 0.8, 13.5], dawn: [-9.5, 16.0, 22], arrive: [SC.x + 2.2, SC.z - 2.2, 9.5],
  welcome: [SC.x + 2.2, SC.z - 1.2, 11.5], lift: [LIFT.x + 0.4, LIFT.z + 1.3, 10.5], inspect: [SC.x + 0.2, SC.z - 0.2, 6.2],
  pretty: [-6.4, 17.2, 19], weigh: [SC.x + 0.9, SC.z - 0.5, 8.8], results: [-11.5, 16.4, 17],
  carve: [PORCH.x - 0.2, PORCH.z + 0.6, 7.5], treats: [-13.6, -8.0, 7.6],
  // "Done: light her up": the reveal is the reward, so the camera pushes in on her glowing face for a beat first
  lit: [PORCH.x - 0.1, PORCH.z + 0.5, 4.2],
};
const LIT_HOLD = 2.6;                              // s on her lit face before the trick-or-treaters come up the path
const sizeOf = (est) => clamp(1.2 * Math.sqrt(Math.max(est || 300, 50) / 1400), 0.42, 1.45);
const smoothK = (x) => x * x * (3 - 2 * x);

export default function createWeighoffView(K) {
  const { scene, hit, fx } = K, r = rng(7700);
  const root = new THREE.Group(); root.name = 'weighoff'; scene.add(root);
  const FG = pumpkinGeo({ ribs: 10, ws: 40, hs: 18, squash: 0.66, groove: 0.07 });
  const STEMG = new THREE.CylinderGeometry(0.16, 0.26, 0.5, 6);

  // ---------------------------------------------------------------- your entries (and the porch giant on Halloween)
  const surf = (k, n, sx, sy, parent) => {
    const im = new THREE.InstancedMesh(ICO0, M(k), n);
    for (let i = 0; i < n; i++) {
      const a = r.rr(-1.0, 1.0) + (i % 2 ? 0.5 : -0.3), y = r.rr(0.3, 0.85), rad = Math.sqrt(Math.max(0, 1 - ((y - 0.56) / 0.66) ** 2)) * 0.98;
      dummy.position.set(Math.sin(a) * rad, y, Math.cos(a) * rad); dummy.rotation.set(r.rand(), a, r.rand()); dummy.scale.set(sx, sy, sx * 0.6);
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    }
    im.count = 0; im.castShadow = false; parent.add(im);
    return im;
  };
  function makeFruit(mat) {
    const g = new THREE.Group(); g.visible = false; root.add(g);
    const tilt = new THREE.Group(); g.add(tilt);
    const body = new THREE.Group(); tilt.add(body);
    mat ||= PM(COLORS.O, { roughness: 0.7 });
    const shell = part(FG, mat, [0, 0, 0], [1, 1, 1], [0, 0, 0], body);
    part(STEMG, C(0x6e6a3e), [0.04, FG.userData.top + 0.03, -0.02], [0.42, 0.42, 0.42], [0.35, 0, -0.2], body);
    const stache = part(new THREE.TorusGeometry(0.16, 0.05, 4, 10, PI), M(0x1d1a18), [0, 0.66, 0.99], [1.6, 1, 1], [0, 0, PI], body);
    stache.visible = false;
    return { g, tilt, body, mat, shell, stache, scars: surf(0x5b3d26, 10, 0.1, 0.022, body), x: 0, z: 0, y: 0, size: 0, shake: 0, hop: 0, place: null };
  }
  const mine = [makeFruit(), makeFruit()];
  function dressFruit(F, p, est) {
    if (!p) return;
    const [sxz, sy] = SHAPES[p.shape] || SHAPES.round, s = sizeOf(est);
    F.size = F.size ? lerp(F.size, s, 0.2) : s;
    F.body.scale.set(F.size * sxz, F.size * sy, F.size * sxz);
    F.mat.color.setHex(COLORS[p.color] ?? COLORS.O);
    const sb = p.scarsBy || {};
    F.scars.count = clamp((sb.crack || 0) + (sb.heist || 0) + (sb.scuff || 0) + (sb.sunscald || 0), 0, 10);
    F.stache.visible = !!p.mustache;
  }

  // the porch giant: her front hemisphere takes the carving as an emissive map (planar UVs from object space)
  const carveCanvas = document.createElement('canvas'); carveCanvas.width = carveCanvas.height = 256;
  const carveTex = new THREE.CanvasTexture(carveCanvas); carveTex.colorSpace = THREE.NoColorSpace;
  const carveU = { uCarve: { value: carveTex }, uCarveOn: { value: 0 }, uGlow: { value: 0 } };
  const porchMat = PM(COLORS.O, { roughness: 0.7 });
  porchMat.onBeforeCompile = (sh) => {
    fogPatch(sh);
    Object.assign(sh.uniforms, carveU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nuniform sampler2D uCarve;\nuniform float uCarveOn, uGlow;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 cuv = vec2(vObj.x / 1.7 + 0.5, (vObj.y - 0.02) / 1.0);
        float front = smoothstep(0.05, 0.4, vObj.z) * step(0.0, cuv.x) * step(cuv.x, 1.0) * step(0.0, cuv.y) * step(cuv.y, 1.0);
        vec4 ck = texture2D(uCarve, cuv) * front * uCarveOn;
        diffuseColor.rgb *= 1.0 - 0.8 * ck.g - 0.25 * ck.r;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlow * (vec3(1.0, 0.62, 0.22) * ck.r * 0.9 + vec3(1.0, 0.82, 0.38) * ck.g * 2.6);`);
  };
  porchMat.customProgramCacheKey = () => 'porch-carve';
  const porch = makeFruit(porchMat);
  const porchGlow = billboards(1, { map: glowTex(), blending: THREE.AdditiveBlending });
  porchGlow.mesh.visible = false; root.add(porchGlow.mesh);

  // ---------------------------------------------------------------- the rivals: pallets, giants, placards, growers
  const pallets = pool(new THREE.BoxGeometry(1.9, 0.18, 1.9).translate(0, 0.09, 0), C(0x9b7a52), 9, true, root);
  const fruitPool = pool(FG, PM(0xffffff, { roughness: 0.7 }), 9, true, root);
  const stemPool = pool(STEMG, C(0x6e6a3e), 9, true, root);
  const posts = pool(new THREE.BoxGeometry(0.07, 1.0, 0.07).translate(0, 0.5, 0), C(0x7d6a58), 9, true, root);
  const atlas = canvasTex(512, 256, () => {});
  const placardMat = M(0xffffff, { map: atlas, flatShading: false });
  let placards = null, field = '', gag = null, gagYear = 0;
  const growers = new Map();
  const rivalPos = new Map();
  function paintAtlas(entries) {
    const g = atlas.image.getContext('2d');
    g.clearRect(0, 0, 512, 256);
    entries.forEach((e, i) => {
      const x = (i % 4) * 128, y = Math.floor(i / 4) * 85;
      g.fillStyle = e.you ? '#d9782d' : '#f4efe4'; g.fillRect(x + 2, y + 2, 124, 81);
      g.strokeStyle = '#3f4c43'; g.lineWidth = 4; g.strokeRect(x + 4, y + 4, 120, 77);
      g.fillStyle = e.you ? '#fff' : '#2f3a35'; g.textAlign = 'center';
      g.font = '800 17px system-ui, sans-serif'; g.fillText((e.you ? e.grower : e.grower.split(' ').pop()).toUpperCase().slice(0, 12), x + 64, y + 27);
      g.font = 'italic 600 13px Georgia, serif'; g.fillText(`'${e.name}'`.slice(0, 18), x + 64, y + 47);
      g.font = '800 17px ui-monospace, Menlo, monospace'; g.fillText(e.gag ? 'est. 1 (one)' : e.est ? estShort(e.est) : "won't say", x + 64, y + 70);
    });
    atlas.needsUpdate = true;
  }
  function buildPlacards(entries) {
    placards?.geometry.dispose(); if (placards) root.remove(placards);
    const geos = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, YAW, 0, 'YXZ'));
    entries.forEach((e, i) => {
      const p = PALLET(e.pallet), plane = new THREE.PlaneGeometry(1.25, 0.83), uv = plane.attributes.uv;
      const u0 = (i % 4) / 4, v1 = 1 - Math.floor(i / 4) * 85 / 256, v0 = v1 - 83 / 256;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * 0.25 - 0.002 * (uv.getX(k) - 0.5), v0 + uv.getY(k) * (v1 - v0));
      geos.push(prepGeo(plane, m4.compose(new THREE.Vector3(p.x + 1.05, 1.05, p.z + 1.0), q, new THREE.Vector3(1, 1, 1))));
      plane.dispose();
    });
    placards = new THREE.Mesh(mergeGeometries(geos), placardMat); placards.castShadow = false; root.add(placards);
    geos.forEach((g) => g.dispose());
  }
  // the raccoons' disguise of the year (a tarp, a beach ball, a trench coat, a hollow pumpkin; from year 5, the real thing)
  function buildGag(y) {
    if (gag) { root.remove(gag); disposeTree(gag); }
    gag = new THREE.Group(); root.add(gag);
    if (y === 1) {
      for (const [dx, dz] of [[-0.35, 0.1], [0.3, 0.15], [0, -0.3]]) part(ICO1, C(0x5d7fa0), [dx, 0.32, dz], [0.42, 0.34, 0.42], [0, r.rand(), 0], gag);
      part(BOX, C(0x4d6b8a), [0.05, 0.45, 0.0], [1.0, 0.06, 0.9], [0.1, 0.3, 0.05], gag);
    } else if (y === 2) {
      part(new THREE.SphereGeometry(0.5, 16, 10), PM(0xe0843a), [0, 0.5, 0], [1, 1, 1], [0, 0, 0], gag);
      part(new THREE.TorusGeometry(0.5, 0.06, 6, 24), PM(0xf4efe4), [0, 0.5, 0], [1, 1, 1], [0, 0, 0.4], gag);
    } else if (y === 3) {
      part(new THREE.CylinderGeometry(0.28, 0.5, 1.6, 8), C(0x8a6e4e), [0, 0.8, 0], [1, 1, 1], [0, 0, 0], gag);
      part(ICO1, C(0x8f8b86), [0, 1.78, 0.02], [0.3, 0.27, 0.28], [0, 0, 0], gag);
      part(ICO1, C(0x2f2b29), [0, 1.8, 0.2], [0.24, 0.07, 0.1], [0, 0, 0], gag);
      part(CYL8, C(0x3a302a), [0, 2.05, 0], [0.3, 0.05, 0.3], [0, 0, 0], gag);
      part(CYL8, C(0x3a302a), [0, 2.15, 0], [0.18, 0.18, 0.18], [0, 0, 0], gag);
    } else {
      part(FG, PM(0xd98a3e), [0, 0, 0], [0.62, 0.62, 0.62], [0, 0, 0], gag);
      part(ICO1, C(0x8f8b86), [0.05, 0.72, 0.05], [0.18, 0.16, 0.17], [0, 0, 0], gag);
      part(ICO1, C(0x2f2b29), [0.05, 0.74, 0.19], [0.15, 0.045, 0.06], [0, 0, 0], gag);
    }
    mergeLocal(gag);
    gagYear = y;
  }
  function grower(id) {
    if (!growers.has(id)) {
      const rig = id === 'raccoons' ? makeFolk('raccoon', { kid: true }) : makeTownsfolk(GROWER[id] || 'possum');
      root.add(rig.root); growers.set(id, rig);
    }
    return growers.get(id);
  }

  // ---------------------------------------------------------------- townsfolk on duty: the Mayor, the judges, the crowd
  const folks = new Map();
  const townie = (key) => { if (!folks.has(key)) { const f = makeTownsfolk(key); root.add(f.root); folks.set(key, f); } return folks.get(key); };
  let crowd = null, crowdSpecies = [], crowdN = 0, crowdYear = 0;
  const hop = { t: 0 };

  // ---------------------------------------------------------------- the lift: the ring, the forklift
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 36).rotateX(PI / 2), M(0xc9a75e, { roughness: 0.6 }));
  ringMesh.visible = false; root.add(ringMesh);
  const fork = new THREE.Group(); fork.visible = false; root.add(fork);
  part(BOX, C(0xe5c66b), [0, 0.5, -0.9], [1.1, 0.7, 1.3], [0, 0, 0], fork);
  part(BOX, C(0x3a3f43), [0, 1.3, -0.25], [0.9, 1.6, 0.1], [0, 0, 0], fork);
  for (const sx of [-0.3, 0.3]) part(BOX, C(0x3a3f43), [sx, 0.12, 0.45], [0.1, 0.06, 1.2], [0, 0, 0], fork);
  for (const [x, z] of [[-0.5, -1.4], [0.5, -1.4], [-0.5, -0.4], [0.5, -0.4]]) part(CYL8, C(0x26211e), [x, 0.2, z], [0.2, 0.15, 0.2], [0, 0, PI / 2], fork);
  mergeLocal(fork);

  // ---------------------------------------------------------------- the inspection: flashlight beam, his eyebrow
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.7, 1, 12, 1, true).translate(0, -0.5, 0), beamMat);
  beam.visible = false; root.add(beam);
  const spot = billboards(1, { map: glowTex(), blending: THREE.AdditiveBlending, color: 0xfff1c2 });
  spot.mesh.visible = false; root.add(spot.mesh);
  const wm = K.cast?.weighmaster;
  const brow = wm ? part(BOX, M(0x3a312a), [0.3, 0.3, 0.55], [0.22, 0.05, 0.06], [0, 0, -0.2], wm.head) : null;
  const brow2 = wm ? part(BOX, M(0x3a312a), [-0.3, 0.3, 0.55], [0.22, 0.05, 0.06], [0, 0, 0.2], wm.head) : null;
  if (brow) brow.castShadow = brow2.castShadow = false;

  // ---------------------------------------------------------------- the night: eyes, a kit scampering off, footprints
  const eyes = billboards(16, { map: dotTex(), blending: THREE.AdditiveBlending, toneMapped: false });
  eyes.mesh.visible = false; root.add(eyes.mesh);
  const flash = billboards(2, { map: glowTex(), blending: THREE.AdditiveBlending, toneMapped: false });
  flash.mesh.visible = false; root.add(flash.mesh);
  const eyeOn = new Map();             // k -> { x, y, z, t, caught }
  let flashT = 9, flashAt = null, glint = -1;
  const kit = makeFolk('raccoon', { kid: true }); kit.root.visible = false; root.add(kit.root);
  const scamper = { t: 9, x: 0, z: 0, dx: 0, dz: 0 };
  const prints = pool(new THREE.CircleGeometry(0.07, 6).rotateX(-PI / 2), M(0x4a3a2c), 34, false, root);
  const printsAt = [];
  { const pr = rng(7800); let x = -11.4, z = 11.6; for (let i = 0; i < 34; i++) { const tx = i < 17 ? GX + 1.6 : LIFT.x + 1.6, tz = i < 17 ? GZ + 1.0 : LIFT.z - 0.6; x = lerp(x, tx, 0.14) + pr.rr(-0.2, 0.2); z = lerp(z, tz, 0.14) + (i % 2 ? 0.12 : -0.12); printsAt.push([x, z, pr.rand() * PI]); } }
  let printsShown = false;

  // ---------------------------------------------------------------- Halloween: trick-or-treaters in sheets
  const GHOST_TYPES = ['raccoon', 'possum', 'owl'];
  const GHOST_SCALE = 1.3;                          // kids in sheets, a little larger than life so they read on a phone
  const ghostGeo = (type) => {
    const geos = [], m = new THREE.Matrix4(), cl = (h) => new THREE.Color(h);
    const pts = Array.from({ length: 12 }, (_, i) => { const k = i / 11; return new THREE.Vector2(0.36 * Math.sqrt(Math.max(1e-4, 1 - k ** 2.4)) + 0.02 * Math.sin(k * 9) * (1 - k), 0.95 * k); });
    const sheet = new THREE.LatheGeometry(pts, 12);
    geos.push(prepGeo(sheet, m.identity(), cl(0xf3efe6)));
    for (const sx of [-1, 1]) geos.push(prepGeo(ICO0, m.compose(new THREE.Vector3(sx * 0.1, 0.72, 0.27), new THREE.Quaternion(), new THREE.Vector3(0.05, 0.06, 0.03)), cl(0x1d1a18)));
    const ear = type === 'owl' ? [CONE, 0x7d6a58, [0.04, 0.12, 0.04]] : type === 'raccoon' ? [CONE, 0x8f8b86, [0.07, 0.13, 0.05]] : [ICO1, 0xe9c4c6, [0.08, 0.08, 0.03]];
    for (const sx of [-1, 1]) geos.push(prepGeo(ear[0], m.compose(new THREE.Vector3(sx * 0.15, 0.97, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, sx * -0.35)), new THREE.Vector3(...ear[2])), cl(ear[1])));
    if (type === 'possum') geos.push(prepGeo(CYL, m.compose(new THREE.Vector3(0, 0.12, -0.38), new THREE.Quaternion().setFromEuler(new THREE.Euler(1.2, 0, 0)), new THREE.Vector3(0.025, 0.3, 0.025)), cl(0xe9a3a7)));
    if (type === 'raccoon') for (let i = 0; i < 3; i++) geos.push(prepGeo(CYL, m.compose(new THREE.Vector3(0, 0.15 + i * 0.08, -0.36 - i * 0.04), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.9, 0, 0)), new THREE.Vector3(0.06, 0.07, 0.06)), cl(i % 2 ? 0x2f2b29 : 0xa29d96)));
    geos.push(prepGeo(FG, m.compose(new THREE.Vector3(0.3, 0.2, 0.12), new THREE.Quaternion(), new THREE.Vector3(0.13, 0.13, 0.13)), cl(0xe0843a)));
    const g = mergeGeometries(geos); geos.forEach((x) => x.dispose()); sheet.dispose();
    return g;
  };
  // the sheets glow a little so the kids read against the night
  const ghostMat = PM(0xffffff, { vertexColors: true, emissive: 0x6b675e, emissiveIntensity: 0.6 });
  const ghosts = GHOST_TYPES.map((tp) => { const im = pool(ghostGeo(tp), ghostMat, 3, true, root); im.visible = false; return im; });
  const groups = GHOST_TYPES.map((type, g) => ({ type, g, n: 2 + (g % 2), state: 'away', t: 0, x: -14, z: -4.6, hop: 0, treated: false }));
  let treatsT = 0, litT = 0;

  // ---------------------------------------------------------------- per-frame state
  const lifted = new Set();
  let lastKey = '', stepT = 0, lift = { p: 0, want: 0, hop: 0, shake: 0, auto: false }, revealFx = null, inspectT = -1, year = 0;
  const readoutLabel = 'Q.S.C. OFFICIAL SCALE';

  function hideAll() {
    for (const F of [...mine, porch]) F.g.visible = false;
    for (const im of [pallets, fruitPool, stemPool, posts, prints]) im.visible = false;
    if (placards) placards.visible = false;
    if (gag) gag.visible = false;
    for (const rig of growers.values()) rig.root.visible = false;
    for (const f of folks.values()) f.root.visible = false;
    if (crowd) crowd.group.visible = false;
    ringMesh.visible = fork.visible = beam.visible = spot.mesh.visible = eyes.mesh.visible = flash.mesh.visible = kit.root.visible = false;
    porchGlow.mesh.visible = false;
    for (const im of ghosts) im.visible = false;
    for (const gr of groups) hit.remove(`treat${gr.g}`, 'treat');
    if (brow) { brow.position.y = brow2.position.y = 0.3; }
  }
  hideAll();

  function shot(k, ms = 900) {
    const S = SHOTS[k];
    if (!S || !K.cam?.glide) return;
    K.cam.glide(S[0], S[1], K.cam.zoomFor(S[2]), ms);
  }

  // ---------------------------------------------------------------- the weigh-off
  function syncWeighoff(s, dt, t) {
    const wo = s.weighoff, st = wo.steps?.[wo.i], k = st?.k, key = `${wo.year}|${wo.i}`;
    if (!st) return;
    if (key !== lastKey) {
      const fresh = lastKey === '' || !lastKey.startsWith(`${wo.year}|`);
      onStep(s, st, k, fresh);
      // a load mid-weigh-off: whoever was already lifted is on their pallet, not back at the lift
      if (fresh) for (const x of wo.steps.slice(0, wo.i)) if (x.k === 'lift' && x.done) lifted.add(x.id);
    }
    lastKey = key; stepT += dt;
    const day = k !== 'eve' && k !== 'watch';
    const entries = wo.entries || [];
    // the field: pallets, rival giants, placards, growers (from dawn)
    const fkey = `${wo.year}|${entries.map((e) => e.id).join(',')}`;
    if (fkey !== field) {
      field = fkey;
      paintAtlas(entries.slice().sort((a, b) => a.pallet - b.pallet));
      buildPlacards(entries.slice().sort((a, b) => a.pallet - b.pallet));
      const rac = entries.find((e) => e.id === 'raccoons');
      if (rac?.gag) buildGag(Math.min(wo.year, 4)); else if (gag) { gag.visible = false; gagYear = 0; }
    }
    pallets.visible = fruitPool.visible = stemPool.visible = posts.visible = day;
    if (placards) placards.visible = day;
    const onScale = k === 'weigh' ? st.id : null;
    let n = 0;
    for (const e of entries) {
      const p = PALLET(e.pallet), want = e.id === onScale ? { x: SC.x, z: SC.z, y: TOP } : { x: p.x, z: p.z, y: 0.18 };
      dummy.position.set(p.x, 0, p.z); dummy.rotation.set(0, 0.1, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      pallets.setMatrixAt(e.pallet, dummy.matrix);
      dummy.position.set(p.x + 1.05, 0, p.z + 1.0); dummy.updateMatrix(); posts.setMatrixAt(e.pallet, dummy.matrix);
      if (e.you) continue;
      const cur = rivalPos.get(e.id) || { ...want };
      const kk = damp(dt, 3.2);
      cur.x = lerp(cur.x, want.x, kk); cur.z = lerp(cur.z, want.z, kk); cur.y = lerp(cur.y, want.y, kk);
      const moving = Math.hypot(cur.x - want.x, cur.z - want.z);
      rivalPos.set(e.id, cur);
      const lift = Math.min(0.6, moving * 0.2);
      if (e.gag && gag) { gag.visible = day; gag.position.set(cur.x, cur.y + lift, cur.z); gag.rotation.y = YAW; hideAt(fruitPool, n); hideAt(stemPool, n); n++; }
      else {
        const [hex, shape] = RIVAL_LOOK[e.id] || [0xe39a52, 'round'], [sxz, sy] = SHAPES[shape], sz = sizeOf(e.est || e.sortEst);
        dummy.position.set(cur.x, cur.y + lift, cur.z); dummy.rotation.set(0, YAW + 0.4, 0); dummy.scale.set(sz * sxz, sz * sy, sz * sxz); dummy.updateMatrix();
        fruitPool.setMatrixAt(n, dummy.matrix); fruitPool.setColorAt(n, new THREE.Color(hex));
        dummy.position.y = cur.y + lift + FG.userData.top * sz * sy + 0.02; dummy.scale.setScalar(0.42 * Math.max(0.7, sz)); dummy.updateMatrix(); stemPool.setMatrixAt(n, dummy.matrix);
        n++;
      }
      // the grower stands by the pallet; cheers when their giant is on the scale
      const rig = grower(e.id);
      rig.root.visible = day && !(k === 'pretty' && (st.judges || []).includes(e.id));
      rig.root.position.set(p.x - 0.95, 0, p.z + 1.25); rig.root.rotation.y = YAW;
      rig.animate(dt, 0, e.id === onScale ? { cheer: stepT > 3 && !e.dq, hop: stepT > 3 && !e.dq } : { look: Math.sin(t * 0.5 + e.pallet) * 0.4 });
    }
    for (let i = n; i < 9; i++) { hideAt(fruitPool, i); hideAt(stemPool, i); }
    for (let i = entries.length; i < 9; i++) { hideAt(pallets, i); hideAt(posts, i); }
    for (const [id, rig] of growers) if (!entries.some((e) => e.id === id && !e.you)) rig.root.visible = false;
    for (const im of [pallets, fruitPool, stemPool, posts]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    // your entries
    const yours = entries.filter((e) => e.you);
    mine.forEach((F, i) => {
      const e = yours[i], p = e ? s.giant && (e.plot === 2 ? s.giant.plot2 : s.giant) : null;
      F.g.visible = !!p && day;
      if (!F.g.visible) return;
      dressFruit(F, p, e.est);
      const pal = PALLET(e.pallet);
      let want;
      if (k === 'lift' && st.id === e.id) want = liftPos(st);
      else if (k === 'inspect' && st.id === e.id) want = { x: SC.x, z: SC.z, y: TOP };
      else if (k === 'weigh' && st.id === e.id) want = { x: SC.x, z: SC.z, y: TOP };
      else if (!lifted.has(e.id) && ['dawn', 'arrive', 'welcome', 'lift'].includes(k)) want = { x: LIFT.x + (i ? 2.2 : 0), z: LIFT.z - (i ? 0.6 : 0), y: 0 };
      else want = { x: pal.x, z: pal.z, y: 0.18 };
      if (F.place == null) { F.x = want.x; F.z = want.z; F.y = want.y; F.place = 1; }
      const kk = k === 'lift' && st.id === e.id ? damp(dt, 6) : damp(dt, 3);
      F.x = lerp(F.x, want.x, kk); F.z = lerp(F.z, want.z, kk); F.y = lerp(F.y, want.y + (want.hop || 0), kk * 1.5);
      F.g.position.set(F.x, F.y, F.z); F.g.rotation.y = YAW;
      F.shake = Math.max(0, F.shake - dt * 2.2);
      F.tilt.rotation.z = Math.sin(t * 38) * 0.06 * F.shake; F.tilt.rotation.x = Math.sin(t * 29) * 0.04 * F.shake;
    });
    // the Mayor emcees from beside the scale (from the Weighmaster's entrance on)
    const mayor = townie('mayor');
    mayor.root.visible = ['arrive', 'welcome', 'lift', 'pretty', 'weigh', 'results'].includes(k);
    mayor.root.position.set(MAYOR.x, 0, MAYOR.z); mayor.root.rotation.y = YAW - 0.3;
    mayor.animate(dt, 0, k === 'welcome' || k === 'results' ? { wave: stepT < 2.5 } : k === 'lift' ? { cheer: lift.hop > 0.2 } : {});
    // the judges hold up their cards for the Prettiest
    const judges = st.judges || (k === 'pretty' ? wo.pretty?.judges : null) || [];
    for (const [key, f] of folks) if (key !== 'mayor' && !(k === 'pretty' && judges.includes(key))) f.root.visible = false;
    if (k === 'pretty') judges.forEach((j, i) => {
      const f = townie(j);
      f.root.visible = true; f.root.position.set(JUDGES[i].x, 0, JUDGES[i].z); f.root.rotation.y = YAW;
      f.animate(dt, 0, { cheer: stepT > 1 + i * 0.7 && stepT < 2.2 + i * 0.7 });
    });
    syncCrowd(s, st, k, dt, t);
    syncLift(s, st, k, dt);
    syncInspect(s, st, k, dt, t);
    syncNight(s, st, k, dt, t);
    // footprints the morning after the giggles (year 1) or a Night Watch
    const showPrints = day && (wo.year === 1 || wo.heist) && ['dawn', 'arrive', 'welcome'].includes(k);
    if (showPrints !== printsShown) {
      printsShown = showPrints;
      printsAt.forEach(([x, z, a], i) => { dummy.position.set(x, 0.03, z); dummy.rotation.set(0, a, 0); dummy.scale.set(1, 1, 1.4); dummy.updateMatrix(); prints.setMatrixAt(i, dummy.matrix); });
      prints.instanceMatrix.needsUpdate = true;
    }
    prints.visible = showPrints;
    // the reveal's weather: the fog thickens for the card read, then breaks to golden light or rolls in
    if (revealFx && k !== 'weigh') { K.sky.override(null); K.sky.setFogOverride(0); revealFx = null; }
  }
  function liftPos(st) {
    const p = smoothK(clamp(lift.p, 0, 1));
    return { x: lerp(LIFT.x, SC.x, p), z: lerp(LIFT.z, SC.z, p), y: lerp(0, TOP, p) + lift.hop * 0.7, hop: 0 };
  }
  function syncLift(s, st, k, dt) {
    const active = k === 'lift';
    lift.want = active ? (st.done ? 1 : lift.want) : 0;
    if (active && st.auto) lift.want = Math.min(1, stepT / 2.4);
    lift.p = lerp(lift.p, lift.want, damp(dt, 4));
    lift.hop = Math.max(0, lift.hop - dt * 2.6);
    const e = active ? s.weighoff.entries.find((x) => x.id === st.id) : null, F = e ? mine[s.weighoff.entries.filter((x) => x.you).indexOf(e)] : null;
    ringMesh.visible = active && !!F && st.auto !== 'forklift';
    fork.visible = active && st.auto === 'forklift';
    if (F) {
      const R = F.size * 1.08 + 0.12;
      ringMesh.position.set(F.x, F.y + F.size * 0.45, F.z); ringMesh.scale.set(R, 1, R);
      ringMesh.material.color.setHex(st.auto === 'ring' ? 0xe5c66b : 0xc9a75e);
      if (fork.visible) { fork.position.set(F.x - 1.2, 0, F.z + 0.6); fork.rotation.y = YAW + PI * 0.75; }
    }
    if (st.done && active) lifted.add(st.id);
    if (k === 'inspect' || k === 'pretty' || k === 'weigh' || k === 'results') for (const x of s.weighoff.entries) if (x.you) lifted.add(x.id);
  }
  function syncCrowd(s, st, k, dt, t) {
    const show = ['dawn', 'arrive', 'welcome', 'lift', 'inspect', 'pretty', 'weigh', 'results'].includes(k);
    if (!show) { if (crowd) crowd.group.visible = false; return; }
    if (!crowd) crowd = createCrowd(K, { adults: 16, kids: 10 });
    const wo = s.weighoff;
    if (crowdYear !== wo.year) {
      crowdYear = wo.year;
      const cr = rng(9100 + wo.year);
      const liftStep = wo.steps.find((x) => x.k === 'lift');
      crowdN = clamp(liftStep?.neighbours ?? 6, 6, 16);
      crowdSpecies = Array.from({ length: crowdN + 6 }, () => SPECIES_KEYS[(cr.rand() * SPECIES_KEYS.length) | 0]);
    }
    crowd.group.visible = true;
    crowd.begin();
    const yours = wo.entries.filter((e) => e.you);
    const liftE = k === 'lift' ? yours.find((e) => e.id === st.id) : null, F = liftE ? mine[yours.indexOf(liftE)] : null;
    const hopNow = hop.t > 0;
    hop.t = Math.max(0, hop.t - dt);
    for (let i = 0; i < crowdN; i++) {
      let x, z, h;
      if (F && !st.auto) {           // around the lifting ring, moving with her
        const a = (i / crowdN) * PI * 2 + 0.3, R = F.size + 0.75;
        x = F.x + Math.cos(a) * R; z = F.z + Math.sin(a) * R; h = Math.atan2(F.x - x, F.z - z);
      } else {                       // a loose crowd watching the scale from the path
        const row = i % 2, col = Math.floor(i / 2);
        x = -19.0 + col * 0.95 + row * 0.45; z = 13.2 + row * 0.9 + Math.sin(i * 7.1) * 0.2; h = Math.atan2(SC.x - x, SC.z - z);
      }
      crowd.put(crowdSpecies[i], false, x, z, h, t * 3 + i, hopNow ? 0.6 : 0, { hop: hopNow || (k === 'results' && i % 3 === 0) });
    }
    // a few kids at the front
    for (let i = 0; i < Math.min(6, Math.floor(crowdN / 2)); i++) {
      const x = -18.6 + i * 0.7, z = 15.1 + (i % 2) * 0.3;
      crowd.put(crowdSpecies[crowdN + i], true, x, z, Math.atan2(SC.x - x, SC.z - z), t * 4 + i, 0, { hop: hopNow || k === 'weigh' && i % 2 === 0 });
    }
    crowd.end();
  }
  function syncInspect(s, st, k, dt, t) {
    const on = k === 'inspect';
    if (!wm) return;
    if (!on) {
      beam.visible = spot.mesh.visible = false;
      if (inspectT >= 0) { wm.root.position.x = WM_HOME.x; wm.root.position.z = WM_HOME.z; wm.root.rotation.y = WM_HOME.yaw; inspectT = -1; }
      if (brow) { brow.position.y = lerp(brow.position.y, 0.3, damp(dt, 4)); brow2.position.y = lerp(brow2.position.y, 0.3, damp(dt, 4)); }
      return;
    }
    inspectT += dt;
    // he circles the scale once with the flashlight, then stops facing her and the eyebrow does the talking
    const T1 = 2.6, a0 = -0.9, k01 = clamp(inspectT / T1, 0, 1), a = a0 + smoothK(k01) * PI * 2, R = 2.3;
    wm.root.position.x = SC.x + Math.cos(a) * R; wm.root.position.z = SC.z + Math.sin(a) * R;
    wm.root.rotation.y = Math.atan2(SC.x - wm.root.position.x, SC.z - wm.root.position.z);
    const lit = inspectT < T1 + 0.4;
    beam.visible = spot.mesh.visible = lit;
    if (lit) {
      const hx = wm.root.position.x + (SC.x - wm.root.position.x) * 0.25, hz = wm.root.position.z + (SC.z - wm.root.position.z) * 0.25, hy = 2.6;
      const sx = SC.x + Math.sin(t * 2.3) * 0.5, sz = SC.z + Math.cos(t * 1.7) * 0.5, sy = 0.8;
      beam.position.set(hx, hy, hz);
      const dir = new THREE.Vector3(sx - hx, sy - hy, sz - hz), L = dir.length();
      beam.scale.set(1, L, 1);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
      beamMat.opacity = 0.22 * (1 - clamp((inspectT - T1) / 0.4, 0, 1));
      spot.set(0, sx, sy, sz, 1.6, 1.6, 0.75); spot.commit();
    }
    const up = st.brow === 'up' ? 0.14 : st.brow === 'slight' ? 0.06 : 0;
    if (brow && inspectT > T1) { brow.position.y = lerp(brow.position.y, 0.3 + up, damp(dt, 8)); brow2.position.y = lerp(brow2.position.y, 0.3 + up * 0.4, damp(dt, 8)); }
  }
  function syncNight(s, st, k, dt, t) {
    const night = k === 'eve' || k === 'watch';
    eyes.mesh.visible = night && eyeOn.size > 0;
    let i = 0;
    for (const [, e] of eyeOn) {
      e.t += dt;
      const blink = Math.sin(e.t * 9) > 0.92 ? 0.1 : 1, a = Math.min(1, e.t * 6) * blink;
      for (const sx of [-1, 1]) { eyes.set(i++, e.x + sx * 0.09, e.y, e.z + sx * 0.09, 0.16, 0.16, a, 0xd8ff8a); }
    }
    for (; i < 16; i++) eyes.hide(i);
    eyes.commit();
    // a camera flash where you caught a pair
    flashT += dt;
    flash.mesh.visible = night && flashT < 0.5 && !!flashAt;
    if (flash.mesh.visible) { const k2 = flashT / 0.5; flash.set(0, flashAt.x, flashAt.y + 0.3, flashAt.z, 3 + 4 * k2, 3 + 4 * k2, 1 - k2, 0xfffbe8); flash.commit(); }
    // the kit scampers off into the dark
    scamper.t += dt;
    kit.root.visible = night && scamper.t < 0.9;
    if (kit.root.visible) {
      kit.root.position.set(scamper.x + scamper.dx * scamper.t * 4, 0, scamper.z + scamper.dz * scamper.t * 4);
      kit.root.rotation.y = Math.atan2(scamper.dx, scamper.dz);
      kit.animate(dt, 4 * Math.hypot(scamper.dx, scamper.dz));
    }
    // year 1: a glint of a mask in the corn, then giggles (the UI plays them)
    if (glint >= 0) {
      glint += dt;
      if (glint > 1.4 && glint - dt <= 1.4) fx.sparkle(-11.9, 0.7, 11.2, 5);
      if (glint > 1.4 && glint < 2.1) { eyes.mesh.visible = true; eyes.set(0, -11.95, 0.55, 11.15, 0.12, 0.12, 1, 0xd8ff8a); eyes.set(1, -11.78, 0.55, 11.3, 0.12, 0.12, 1, 0xd8ff8a); eyes.commit(); }
      if (glint > 3) glint = -1;
    }
  }
  function onStep(s, st, k, fresh) {
    stepT = 0;
    if (k !== 'lift') { lift.want = 0; lift.p = k === 'inspect' ? 1 : 0; }
    if (k === 'lift') { lift.p = 0; lift.want = 0; }
    if (k === 'eve' && s.weighoff.year === 1) glint = 0;
    if (k === 'inspect') inspectT = 0;
    if (k !== 'watch') eyeOn.clear();
    if (k === 'weigh') K.world?.readout?.paint('0000', readoutLabel);
    if (k === 'dawn') {
      // the swoop: from the whole farm down to the scale as the trucks roll in
      K.cam?.home?.(0);
      setTimeout(() => shot('dawn', 1800), 60);
      for (const F of mine) F.place = null;
      rivalPos.clear(); lifted.clear();
      return;
    }
    shot(k, k === 'inspect' ? 1400 : 900);
  }

  // ---------------------------------------------------------------- Halloween
  function syncHalloween(s, dt, t) {
    const w = s.winter || {}, p = w.plot === 2 ? s.giant?.plot2 : s.giant, has = !!p && p.setDay != null;
    const key = `hw|${s.clock.year}|${w.stage}`;
    if (key !== lastKey) {
      stepT = 0;
      // just carved: push in on her lit face, then pull back for the trick-or-treaters (who wait for the pull-back)
      const lit = w.stage === 'treats' && w.carved && lastKey.startsWith('hw|') && lastKey.endsWith('|carve');
      if (lit) { shot('lit', 1300); litT = LIT_HOLD; treatsT = -LIT_HOLD; } else if (SHOTS[w.stage]) shot(w.stage, 1100);
      if (w.stage === 'treats' && !lit) treatsT = 0;
    }
    if (litT > 0 && (litT -= dt) <= 0) shot('treats', 1500);
    lastKey = key; stepT += dt;
    porch.g.visible = has;
    if (has) {
      dressFruit(porch, p, p.est || p.wc);
      porch.g.position.set(PORCH.x, 0, PORCH.z); porch.g.rotation.y = YAW;
      porch.stache.visible = !!p.mustache && !w.carved;
      if (!w.carved) carveU.uCarveOn.value = 0;      // last year's face never shows on this year's uncarved giant
      carveU.uGlow.value = lerp(carveU.uGlow.value, w.carved ? 1.4 + Math.sin(t * 7.3) * 0.12 + Math.sin(t * 3.1) * 0.08 : 0, damp(dt, 3));
      porchGlow.mesh.visible = w.carved;
      if (w.carved) { porchGlow.set(0, PORCH.x + 0.5, 0.7, PORCH.z + 0.5, 3.2, 3.2, 0.55 + Math.sin(t * 6) * 0.06); porchGlow.commit(); }
    }
    // trick-or-treaters: up the barn path in sheets, wait by the porch for candy, hop, wander back into the fog
    const live = w.stage === 'treats';
    treatsT += dt;
    groups.forEach((gr) => {
      if (!live) { gr.state = 'away'; gr.t = 0; }
      else if (gr.state === 'away' && treatsT > 0.6 + gr.g * 4.5) { gr.state = 'walk'; gr.t = 0; gr.treated = false; }
      gr.t += dt; gr.hop = Math.max(0, gr.hop - dt * 1.6);
      const door = { x: PORCH.x - 1.6 + gr.g * 0.75, z: PORCH.z + 1.6 + gr.g * 0.35 }, lane = { x: -14 + gr.g * 0.5, z: -4.4 };
      if (gr.state === 'walk') { const k2 = clamp(gr.t / 4, 0, 1); gr.x = lerp(lane.x, door.x, k2); gr.z = lerp(lane.z, door.z, k2); if (k2 >= 1) { gr.state = 'wait'; gr.t = 0; } }
      else if (gr.state === 'leave') { const k2 = clamp(gr.t / 4, 0, 1); gr.x = lerp(door.x, lane.x - 1.5, k2); gr.z = lerp(door.z, lane.z - 0.4, k2); if (k2 >= 1) { gr.state = 'gone'; } }
      else if (gr.state === 'wait' && gr.treated && gr.t > 1.2) { gr.state = 'leave'; gr.t = 0; }
      const im = ghosts[gr.g], vis = gr.state === 'walk' || gr.state === 'wait' || gr.state === 'leave';
      im.visible = vis;
      for (let i = 0; i < 3; i++) {
        if (!vis || i >= gr.n) { hideAt(im, i); continue; }
        const bob = Math.abs(Math.sin((t + i * 0.37) * (gr.state === 'wait' ? 3 : 9))) * (gr.state === 'wait' ? 0.04 : 0.08) + gr.hop * Math.abs(Math.sin((gr.hop + i * 0.2) * 9)) * 0.35;
        const h = gr.state === 'leave' ? PI * 0.9 : gr.state === 'wait' ? Math.atan2(PORCH.x - gr.x, PORCH.z - gr.z) : 0.2 + PI;
        dummy.position.set(gr.x + (i - 1) * 0.5, bob, gr.z + (i % 2) * 0.4); dummy.rotation.set(0, h, 0); dummy.scale.setScalar(GHOST_SCALE); dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      if (vis && gr.state !== 'leave') hit.add({ kind: 'treat', id: `treat${gr.g}`, circle: [gr.x, gr.z + 0.2, 1.15], y: [0, 1.5] }, 5);
      else hit.remove(`treat${gr.g}`, 'treat');
    });
  }

  // ---------------------------------------------------------------- frame
  let lastState = null;
  const reset = () => { hideAll(); lastKey = ''; field = ''; if (revealFx) { K.sky.override(null); K.sky.setFogOverride(0); revealFx = null; } };
  function sync(s, dt, t) {
    // a different game (Continue from the title, which drew the same save as its backdrop; a new farm): start over,
    // so the camera frames the step again and nothing of the old one lingers
    if (s !== lastState) { lastState = s; if (lastKey) reset(); }
    const ph = s?.clock?.phase;
    if (ph !== 'weighoff' && ph !== 'halloween') {
      if (lastKey) reset();
      if (ph === 'grow' && year !== s?.clock?.year) { year = s.clock.year; K.world?.readout?.paint('0000', readoutLabel); }
      return;
    }
    if (ph === 'weighoff') {
      if (lastKey.startsWith('hw|')) hideAll();
      porch.g.visible = false;
      syncWeighoff(s, dt, t);
    } else {
      if (!lastKey.startsWith('hw|')) { hideAll(); }
      syncHalloween(s, dt, t);
    }
  }

  function fxEvent(ev) {
    switch (ev.type) {
      case 'weighoff/beat':
        lift.want = Math.min(1, (ev.k + 1) / Math.max(1, ev.n));
        lift.hop = ev.grade === 'wobble' ? 0.35 : 1;
        hop.t = 0.45;
        if (ev.grade === 'wobble') for (const F of mine) F.shake = 1;
        for (const F of mine) if (F.g.visible) fx.dust(F.x + (Math.random() - 0.5), F.z + (Math.random() - 0.5));
        break;
      case 'weighoff/heaved': lift.want = 1; if (ev.crack) for (const F of mine) F.shake = 1.6; break;
      case 'weighoff/readout': K.world?.readout?.paint(String(ev.text ?? '0000'), ev.label || readoutLabel); break;
      case 'weighoff/reveal':
        revealFx = ev.phase;
        if (ev.phase === 'read') { K.sky.override(null); K.sky.setFogOverride(T.weather.revealThicken); shot('weigh', 1600); }
        if (ev.phase === 'lock') {
          if (ev.exhibition) K.sky.setFogOverride(0.35);
          else if (ev.heavy) { K.sky.override('golden'); K.sky.setFogOverride(-0.25); hop.t = 1.6; }
          else if (ev.light) K.sky.setFogOverride(0.45);
          else K.sky.setFogOverride(0);
        }
        if (ev.phase === 'done') { K.sky.override(null); K.sky.setFogOverride(0); revealFx = null; }
        break;
      case 'weighoff/eyes': {
        if (ev.on) eyeOn.set(ev.k, { x: ev.x, y: ev.y, z: ev.z, t: 0 });
        else {
          const e = eyeOn.get(ev.k);
          eyeOn.delete(ev.k);
          if (e && ev.caught) {
            flashT = 0; flashAt = e;
            scamper.t = 0; scamper.x = e.x; scamper.z = e.z;
            const dx = e.x - GX, dz = e.z - GZ, L = Math.hypot(dx, dz) || 1; scamper.dx = dx / L; scamper.dz = dz / L;
          }
        }
        break;
      }
      case 'winter/carve': {
        const g = carveCanvas.getContext('2d');
        g.clearRect(0, 0, 256, 256);
        if (ev.canvas) g.drawImage(ev.canvas, 0, 0, 256, 256);
        carveTex.needsUpdate = true;
        carveU.uCarveOn.value = ev.canvas ? 1 : 0;
        break;
      }
      case 'winter/treat': {
        const gr = groups[ev.group | 0];
        if (gr && gr.state === 'wait') { gr.treated = true; gr.t = 0; gr.hop = 1; fx.pop(gr.x, 0.9, gr.z, 0xf2c14e, 7); fx.sparkle(gr.x, 1.1, gr.z, 4); }
        break;
      }
    }
  }
  return {
    sync, fx: fxEvent, root,
    dispose() {
      hideAll(); scene.remove(root); disposeTree(root);
      for (const rig of growers.values()) rig.dispose();
      for (const f of folks.values()) f.dispose();
      crowd?.dispose();
      brow?.parent?.remove(brow); brow2?.parent?.remove(brow2);
    },
  };
}
// "est. 1,0??" on a placard: hundreds shown, the last two digits are always ?? (the hidden-weight motif)
function estShort(est) {
  const h = String(Math.floor(est / 100));
  return `est. ${h.length > 1 ? h.slice(0, -1) + ',' + h.slice(-1) : h}??`;
}
