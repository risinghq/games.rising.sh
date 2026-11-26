// Shared materials and geometry helpers, ported from aesthetics/prototype-1.html.
// Everything is low-poly and flat-shaded except pumpkins, which are the one thing drawn smooth.
//
// Draw calls are the phone budget (≤ 150), so the merges here differ from the prototype in one way:
// plain colour materials made by C() / PC() are merged into ONE vertex-coloured mesh (flat or smooth)
// instead of one mesh per colour. Special materials (emissive, textured, transparent, double-sided)
// still get a mesh each, exactly as in the prototype.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { fogPatch } from './fog.js';
import type { State } from '../sim/types.js';

export { THREE, mergeGeometries, mergeVertices };
export const PI = Math.PI;
export const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp, smooth = THREE.MathUtils.smoothstep;
export const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const damp = (rdt: number, rate: number) => 1 - Math.exp(-rdt * rate);   // frame-rate independent lerp factor

// Weekend walkers move once a tick (6 times a real second at 1x). Drawn where the sim put them they lurch, and eased
// after it they pulse, so each one glides at constant speed instead: from where the previous tick put it to where the
// latest one did, over the tick the clock is now running (s.clock.acc, 0..1). One tick behind and smooth at any speed
// or frame rate; a jump further than `snap` units (a teleport) snaps.
export const tickKey = (s: State) => s.clock.day * 2000 + s.clock.minute;
/** The state one walker keeps between frames; see glide. */
export class Glider {
  key: number | undefined = undefined;
  tx = 0; tz = 0; fx = 0; fz = 0; x = 0; z = 0;
}
export function glide(g: Glider, x: number, z: number, key: number, acc: number, snap = 3) {
  if (g.key !== key) {
    const far = g.key === undefined || Math.hypot(x - g.tx, z - g.tz) > snap;
    g.fx = far ? x : g.tx; g.fz = far ? z : g.tz; g.key = key;
  }
  g.tx = x; g.tz = z;
  const k = acc < 0 ? 0 : acc > 1 ? 1 : acc;
  g.x = g.fx + (g.tx - g.fx) * k; g.z = g.fz + (g.tz - g.fz) * k;
  return g;
}
// Game seconds that passed this frame on a weekend day: the ticks the clock ran / ticks a second, so 2x is twice the
// real frame, bullet time half and a pause (or held dialogue) nothing. Everything the renderer moves on its own (kids
// scampering, Biscuit bounding, Pamela trotting) caps its speed per game second, so 2x is exactly twice as brisk for
// everyone and nobody falls behind. Real seconds on other days, and across a load, a jump or a new day.
export function gameDt(st: { t?: number }, s: State, dt: number, tps: number) {
  const c = s?.clock;
  if (!c || c.phase !== 'october' || c.sub === 'weekday') { st.t = undefined; return dt; }
  const t = tickKey(s) + (c.acc || 0), last = st.t;
  st.t = t;
  return last === undefined || t < last || t - last > tps ? dt : (t - last) / tps;
}

// A gait that keeps the feet on the ground: legs of length L swinging +-A cover 2 L sin(A) of ground a step. Past a
// walk the swing widens and a little flight stretches each stride, so a sprint reads as running, not as a blur of legs
// or a skate. run: 0 walk .. 1 full run, from `from` to `to` leg-lengths a second. Returns the swing, the run share and
// the phase rate (radians a second, pi a step).
export function gait(speed: number, L: number, walkA = 0.7, runA = 1.05, from = 7, to = 11) {
  const run = clamp((speed / L - from) / (to - from), 0, 1), A = walkA + (runA - walkA) * run;
  const step = 2 * L * Math.sin(A) * (1 + 0.8 * run);
  return { A, run, rate: speed > 1e-3 ? (Math.PI * speed) / step : 0 };
}

// Cosmetic seeded random (the prototype's Park-Miller). Each builder takes its own stream so that
// editing one part of the diorama never reshuffles the layout of every other part.
export function rng(seed = 11) {
  let s = seed % 2147483647 || 11;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return { rand, rr: (a: number, b: number) => a + (b - a) * rand(), pick: <T>(arr: readonly T[]): T => {
      const v = arr[(rand() * arr.length) | 0];
      if (v === undefined) throw new Error('rng.pick: empty list');
      return v;
    } };
}

// ---------------------------------------------------------------- materials
export const M = (color: number, opts: THREE.MeshStandardMaterialParameters = {}) => {
  const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...opts });
  m.onBeforeCompile = fogPatch;
  return m;
};
export const PM = (hex: number, opts: THREE.MeshStandardMaterialParameters = {}) => M(hex, { flatShading: false, roughness: 0.62, ...opts });
const matCache = new Map<number, THREE.MeshStandardMaterial>(), pmCache = new Map<number, THREE.MeshStandardMaterial>();
// Plain cached colours. userData.vc marks them as safe to bake into vertex colours when merged.
export const C = (hex: number) => {
  let m = matCache.get(hex);
  if (!m) { m = M(hex); m.userData.vc = 'flat'; matCache.set(hex, m); }
  return m;
};
export const PC = (hex: number) => {
  let m = pmCache.get(hex);
  if (!m) { m = PM(hex); m.userData.vc = 'smooth'; pmCache.set(hex, m); }
  return m;
};
// the shared vertex-coloured twins every merge bakes into
export const VC = M(0xffffff, { vertexColors: true });
export const VCS = PM(0xffffff, { vertexColors: true });
const VC_MAT = { flat: VC, smooth: VCS } as const;

// ---------------------------------------------------------------- unit geometries
export const ICO0 = new THREE.IcosahedronGeometry(1, 0);
export const ICO1 = new THREE.IcosahedronGeometry(1, 1);
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 6);
export const CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
export const CONE = new THREE.ConeGeometry(1, 1, 6);
export const BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT = new Set<THREE.BufferGeometry>([ICO0, ICO1, CYL, CYL8, CONE, BOX]);

export type V3 = [number, number, number];
export function part(geo: THREE.BufferGeometry, mat: THREE.Material, p: V3 = [0, 0, 0], s: V3 = [1, 1, 1], r: V3 = [0, 0, 0], parent?: THREE.Object3D) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...p); m.scale.set(...s); m.rotation.set(...r);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

// Bake a geometry into a merge-ready, non-indexed copy (position, normal, uv and optionally colour).
export function prepGeo(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, color?: THREE.Color | null) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(matrix);
  const keepColor = !color && g.hasAttribute('color');
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k) && !(k === 'color' && keepColor)) g.deleteAttribute(k);
  const n = g.getAttribute('position').count;
  if (!g.hasAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.hasAttribute('normal')) g.computeVertexNormals();
  if (color) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = color.r; a[i * 3 + 1] = color.g; a[i * 3 + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  }
  g.clearGroups();
  return g;
}

// Which merged mesh a part belongs to: a vertex-colour bucket, or its own special material.
interface Bucket { mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean }
function bucketOf(mesh: THREE.Mesh) {
  const m = mesh.material;
  if (!(m instanceof THREE.MeshStandardMaterial)) throw new Error('kit: a merged mesh needs a single standard material');
  const vc: unknown = m.userData.vc;
  if (vc === 'flat' || vc === 'smooth') return { key: VC_MAT[vc], mat: VC_MAT[vc], color: m.color };
  return { key: m, mat: m, color: null };
}
function collect(buckets: Map<THREE.Material, Bucket>, mesh: THREE.Mesh, matrix: THREE.Matrix4) {
  const b = bucketOf(mesh);
  const e: Bucket = buckets.get(b.key) ?? { mat: b.mat, geos: [], cast: false };
  e.geos.push(prepGeo(mesh.geometry, matrix, b.color));
  e.cast ||= mesh.castShadow;
  buckets.set(b.key, e);
}
function emit<T extends THREE.Object3D>(buckets: Map<THREE.Material, Bucket>, into: T): T {
  for (const { mat, geos, cast } of buckets.values()) {
    const merged = mergeGeometries(geos);
    if (!merged) throw new Error('kit: geometries to merge have mismatched attributes');
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = cast; m.receiveShadow = true;
    into.add(m);
  }
  return into;
}

// Merge every static mesh under root into as few meshes as possible (world space).
export function mergeStatic(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, Bucket>();
  root.traverse((o) => { if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh)) collect(buckets, o, o.matrixWorld); });
  disposeOwnGeos(root);
  return emit(buckets, new THREE.Group());
}
// Merge the mesh children of a pivot group, in its local space (deep: also nested groups).
export function mergeLocal<T extends THREE.Object3D>(group: T, deep = false): T {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert(), buckets = new Map<THREE.Material, Bucket>(), dead: THREE.Object3D[] = [];
  const visit = (o: THREE.Object3D) => {
    for (const c of [...o.children]) {
      if (c instanceof THREE.Mesh && !(c instanceof THREE.InstancedMesh) && !c.userData.keep) {
        collect(buckets, c, new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld)); dead.push(c);
      } else if (deep && !(c instanceof THREE.Mesh) && !c.userData.keep) { visit(c); dead.push(c); }
    }
  };
  visit(group);
  for (const d of dead) {
    d.parent?.remove(d);
    if (d instanceof THREE.Mesh && !UNIT.has(d.geometry) && !d.geometry.userData.shared) d.geometry.dispose();
  }
  return emit(buckets, group);
}
function disposeOwnGeos(root: THREE.Object3D) {
  root.traverse((o) => { if (o instanceof THREE.Mesh && !UNIT.has(o.geometry) && !o.geometry.userData.shared) o.geometry.dispose(); });
}

// ---------------------------------------------------------------- textures
function ctx2d(c: HTMLCanvasElement) {
  const g = c.getContext('2d');
  if (!g) throw new Error('kit: no 2d canvas context');
  return g;
}
export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(ctx2d(c), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// A canvas texture that can be repainted (signs, the scale readout). redraw only when text changes.
export function liveTex<A extends unknown[]>(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number, ...args: A) => void) {
  const tex = canvasTex(w, h, () => {}), canvas: HTMLCanvasElement = tex.image, g = ctx2d(canvas);
  let last: string | null = null;
  const paint = (...args: A) => {
    const key = JSON.stringify(args);
    if (key === last) return false;
    last = key; g.clearRect(0, 0, w, h); draw(g, w, h, ...args); tex.needsUpdate = true;
    return true;
  };
  return { tex, paint, canvas };
}

// ---------------------------------------------------------------- pumpkins
// Round silhouettes with soft ribs (the prototype's latest, rounder pumpkins).
export function pumpkinGeo({ ribs = 8, ws = 32, hs = 14, squash = 0.8, groove = 0.1, wart = 0 } = {}) {
  const g = new THREE.SphereGeometry(1, ws, hs), p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = Math.hypot(x, z), a = Math.atan2(z, x);
    const k = 1 - groove * (0.5 - 0.5 * Math.cos(a * ribs));
    x *= k; z *= k; y *= squash;
    if (y > 0) y -= 0.28 * squash * Math.pow(1 - h, 3); else y += 0.15 * squash * Math.pow(1 - h, 3);
    if (wart) {
      const w = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1;
      if (w > 0.62 && h > 0.25) { const f = 1 + wart * (w - 0.62) * 2.6; x *= f; y *= f; z *= f; }
    }
    p.setXYZ(i, x, y, z);
  }
  g.translate(0, 0.85 * squash, 0);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  const sm = mergeVertices(g); // weld the seam so smooth normals have no crease
  sm.computeVertexNormals();
  sm.userData.top = 1.57 * squash;
  sm.userData.shared = true;
  return sm;
}
export const PG = pumpkinGeo();
export const PG_WART = pumpkinGeo({ ws: 32, hs: 16, wart: 0.22, groove: 0.06 });
// Their far-off twins (224 / 256 triangles, not 832 / 960): a field of pumpkins seen from the Home view is ~70
// pumpkins a few pixels across, each drawn twice (the shadow pass too). The instanced fields swap to these while a
// pumpkin is under ~15 px (lodFar) and back as you zoom in; the silhouette at that size is the same.
export const PG_LO = pumpkinGeo({ ws: 16, hs: 8 });
export const PG_WART_LO = pumpkinGeo({ ws: 16, hs: 9, wart: 0.22, groove: 0.06 });
// Far or near for one view, with a little hysteresis so a pinch at the threshold doesn't flicker. ppu: screen px per
// world unit (K.cam.pxPerUnit; Infinity in Stroll and swoops, where things come close).
export function lodFar(st: { far?: boolean }, ppu: number) { st.far = st.far ? ppu < 28 : ppu < 22; return st.far; }
export const STEM = new THREE.CylinderGeometry(0.06, 0.1, 0.32, 5).translate(0, 0.12, 0);
STEM.userData.shared = true;
// The six varieties prototype 1 renders (design §4). green: unripe fruit colours.
export const VARIETY = {
  classic: { geo: PG, cols: [0xd8762c, 0xe0843a, 0xcf6c28], s: [0.34, 0.42], sy: 1 },
  white: { geo: PG, cols: [0xebe4d2, 0xe2dccb], s: [0.3, 0.36], sy: 0.95 },
  blue: { geo: PG, cols: [0x93a7a6, 0x8a9e9f], s: [0.36, 0.42], sy: 0.78 },
  mini: { geo: PG, cols: [0xe6913f, 0xeaa04a, 0xf0e7d6], s: [0.13, 0.17], sy: 1 },
  cinderella: { geo: PG, cols: [0xc4532a, 0xcc5f30], s: [0.38, 0.44], sy: 0.7 },
  warty: { geo: PG_WART, cols: [0xc8a24c, 0xbfa24f, 0xd28a3a], s: [0.3, 0.36], sy: 1 },
} satisfies Record<string, { geo: THREE.BufferGeometry; cols: number[]; s: [number, number]; sy: number }>;
export const GREENS = [0x6f8a4a, 0x7d9550, 0x637f43];

// ---------------------------------------------------------------- instancing
const dummy = new THREE.Object3D(), tmpC = new THREE.Color();
export { dummy };
// The prototype's helper: one InstancedMesh for a list of items; set(item, dummy) poses each and may
// return a colour. Pass parent to add it (the prototype added straight to the scene).
export function instanced<T>(geo: THREE.BufferGeometry, mat: THREE.Material, items: readonly T[], set: (item: T, d: THREE.Object3D, i: number) => number | void, cast = true, parent?: THREE.Object3D) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  im.count = items.length;
  items.forEach((it, i) => {
    dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    const col = set(it, dummy, i);
    dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    if (typeof col === 'number') im.setColorAt(i, tmpC.setHex(col));
  });
  im.castShadow = cast; im.receiveShadow = true;
  im.instanceMatrix.needsUpdate = true;
  if (parent) parent.add(im);
  return im;
}
// A fixed-capacity instanced mesh for dynamic content; every slot starts hidden (zero scale).
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
export function pool(geo: THREE.BufferGeometry, mat: THREE.Material, cap: number, cast = true, parent?: THREE.Object3D) {
  const im = new THREE.InstancedMesh(geo, mat, cap);
  for (let i = 0; i < cap; i++) { im.setMatrixAt(i, ZERO); im.setColorAt(i, tmpC.setHex(0xffffff)); }
  im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false;
  if (parent) parent.add(im);
  return im;
}
export const hideAt = (im: THREE.InstancedMesh, i: number) => im.setMatrixAt(i, ZERO);
export const setColorAt = (im: THREE.InstancedMesh, i: number, hex: number) => im.setColorAt(i, tmpC.setHex(hex));

// ---------------------------------------------------------------- billboards
// Camera-facing quads in ONE draw call (glows, fog puffs, particles). Each instance stores its
// position and size in its matrix and its alpha in aAlpha, so no per-sprite draw calls.
export function billboards(cap: number, { map, blending = THREE.NormalBlending, color = 0xffffff, toneMapped = true, opacity = 1, depthTest = true }: {
  map?: THREE.Texture | null; blending?: THREE.Blending; color?: THREE.ColorRepresentation; toneMapped?: boolean; opacity?: number; depthTest?: boolean;
} = {}) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
  alpha.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aAlpha', alpha);
  const uniforms = { map: { value: map ?? null }, color: { value: new THREE.Color(color) }, opacity: { value: opacity } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `attribute float aAlpha; varying vec2 vUv; varying float vA; varying vec3 vC;
      void main() {
        vec2 s = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
        vec4 mv = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
        mv.xy += position.xy * s;
        gl_Position = projectionMatrix * mv;
        vUv = uv; vA = aAlpha;
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #else
          vC = vec3(1.0);
        #endif
      }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 color; uniform float opacity;
      varying vec2 vUv; varying float vA; varying vec3 vC;
      void main() {
        vec4 t = texture2D(map, vUv);
        gl_FragColor = vec4(t.rgb * color * vC, t.a * vA * opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, depthTest, blending, toneMapped,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.frustumCulled = false; mesh.renderOrder = 2;
  for (let i = 0; i < cap; i++) { mesh.setMatrixAt(i, ZERO); mesh.setColorAt(i, tmpC.setHex(0xffffff)); }
  const m4 = new THREE.Matrix4();
  return {
    mesh, cap, mat, uniforms,
    set(i: number, x: number, y: number, z: number, sx: number, sy = sx, a = 1, hex?: number) {
      m4.makeScale(sx, sy, 1).setPosition(x, y, z); mesh.setMatrixAt(i, m4);
      alpha.array[i] = a;
      if (hex !== undefined) mesh.setColorAt(i, tmpC.setHex(hex));
    },
    setColor(i: number, c: THREE.Color) { mesh.setColorAt(i, c); },
    hide(i: number) { mesh.setMatrixAt(i, ZERO); alpha.array[i] = 0; },
    commit() { mesh.instanceMatrix.needsUpdate = true; alpha.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; },
  };
}
// soft radial glow (lanterns, jack-o'-lanterns, string lights)
let _glowTex: THREE.CanvasTexture | null = null;
export const glowTex = () => _glowTex ||= canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,225,160,1)'); gr.addColorStop(0.22, 'rgba(255,170,80,0.55)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
// plain soft dot (dust, smoke), white so instance colour tints it
let _dotTex: THREE.CanvasTexture | null = null;
export const dotTex = () => _dotTex ||= canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
// four-point twinkle (sparkles, shinies)
let _starTex: THREE.CanvasTexture | null = null;
export const starTex = () => _starTex ||= canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 12);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath(); g.moveTo(32, 2); g.quadraticCurveTo(35, 29, 62, 32); g.quadraticCurveTo(35, 35, 32, 62); g.quadraticCurveTo(29, 35, 2, 32); g.quadraticCurveTo(29, 29, 32, 2); g.fill();
});

// ---------------------------------------------------------------- misc helpers
// A tube that tapers from r0 to r1 along a Catmull-Rom curve (tails, the Weighmaster's nose).
export function taperTube(points: V3[], r0: number, r1: number, mat: THREE.Material, parent?: THREE.Object3D) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const segs = 20, rad = 5, g = new THREE.TubeGeometry(curve, segs, 1, rad, false), p = g.getAttribute('position');
  for (let i = 0; i <= segs; i++) {
    const c = curve.getPointAt(i / segs), r = lerp(r0, r1, i / segs);
    for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; p.setXYZ(k, c.x + (p.getX(k) - c.x) * r, c.y + (p.getY(k) - c.y) * r, c.z + (p.getZ(k) - c.z) * r); }
  }
  g.computeVertexNormals();
  return part(g, mat, [0, 0, 0], [1, 1, 1], [0, 0, 0], parent);
}

// Free GPU memory for a subtree (shared unit geometries and cached materials are left alone).
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line)) return;
    if (!UNIT.has(o.geometry) && !o.geometry.userData.shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m.userData.vc || m === VC || m === VCS) continue;
      if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose();
      m.dispose();
    }
  });
}
