import * as THREE from '__THREE__';

// ============================================================================
//  EMBERWICK ENGINE · core
//  math helpers, procedural surface shader, geometry batching, physics world
// ============================================================================

const PI: any = Math.PI, TAU: any = PI * 2;
const V3: any = THREE.Vector3;
const clamp: any = (v: any, a: any, b: any) => (v < a ? a : v > b ? b : v);
const lerp: any = (a: any, b: any, t: any) => a + (b - a) * t;
const sstep: any = (e0: any, e1: any, x: any) => { const t: any = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const dampf: any = (a: any, b: any, k: any, dt: any) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrapA: any = (a: any) => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
const dampA: any = (a: any, b: any, k: any, dt: any) => a + wrapA(b - a) * (1 - Math.exp(-k * dt));
const DEG: any = PI / 180;
const UPV: any = new V3(0, 1, 0);
const IS_TOUCH: any = matchMedia('(hover: none) and (pointer: coarse)').matches;
const entriesAny: any = Object.entries;
const valuesAny: any = Object.values;
const qsaAll: any = (s: any) => [...document.querySelectorAll(s)];

declare global {
  interface Window { [key: string]: any }
}

function makeRng(seed: any) : any {
  let a: any = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t: any = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let R: any = makeRng(20261020);
const rnd: any = (a: any = 0, b: any = 1) => a + (b - a) * R();
const rint: any = (a: any, b: any) => Math.floor(rnd(a, b + 1));
const pick: any = (arr: any) => arr[Math.floor(R() * arr.length)];

function hash2(x: any, z: any) : any {
  let h: any = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: any, z: any) : any {
  const xi: any = Math.floor(x), zi: any = Math.floor(z), xf: any = x - xi, zf: any = z - zi;
  const u: any = xf * xf * (3 - 2 * xf), v: any = zf * zf * (3 - 2 * zf);
  const a: any = hash2(xi, zi), b: any = hash2(xi + 1, zi), c: any = hash2(xi, zi + 1), d: any = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm2(x: any, z: any, oct: any = 4) : any {
  let s: any = 0, a: any = 0.5, f: any = 1, n: any = 0;
  for (let i: any = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); n += a; f *= 2.03; a *= 0.5; }
  return s / n;
}

// ---- colours (THREE.Color converts sRGB hex -> linear working space) -------
const _colCache: any = new Map();
function col(c: any) : any {
  if (c && c.isColor) return c;
  let v: any = _colCache.get(c);
  if (!v) { v = new THREE.Color(c); _colCache.set(c, v); }
  return v;
}
const shade: any = (c: any, k: any) => col(c).clone().multiplyScalar(k);
const mixc: any = (a: any, b: any, t: any) => col(a).clone().lerp(col(b), t);
const vary: any = (c: any, amt: any = 0.08) => col(c).clone().multiplyScalar(1 + (R() - 0.5) * 2 * amt);

// ============================================================================
//  Procedural surface shader — one MeshStandardMaterial program for the world.
//  Per-vertex attribute pd = (pattern id, wind sway, occluder flag, emissive)
// ============================================================================
const PAT: any = {
  NONE: 0, NOISE: 1, PLANK: 2, STONE: 3, COBBLE: 4, TILE: 5, SLATE: 6, THATCH: 7, GROUND: 8,
  BRICK: 9, BARK: 10, LEAF: 11, RUG: 12, BOOKS: 13, STAINED: 14, METAL: 15, STRAW: 16,
  LEAD: 17, STRIPE: 18, PLASTER: 19, ROCK: 20,
};

// shared uniforms (every world material points at the same objects)
const SU: any = {
  uTime: { value: 0 }, uWind: { value: 1 }, uNight: { value: 0 },
  uOccC: { value: new THREE.Vector2(-9999, -9999) }, uOccR: { value: 120 },
  uOccP: { value: new V3() }, uOccDir: { value: new THREE.Vector2(0, 1) }, uOccOn: { value: 1 },
  // layers: the surface world can be sliced away from the top (uSurfY) when the party goes
  // underground; underground geometry is sliced above the player (uUgTop) and its walls on the
  // camera side are cut down low (uCutK) so tunnels read like a cutaway map
  uSurfY: { value: 1e5 }, uUgTop: { value: 1e5 }, uCutK: { value: 0 }, uCamDir: { value: new THREE.Vector2(-0.7, -0.7) },
  uNearCut: { value: 0.42 }, uFullCut: { value: 5.0 }, uSectCol: { value: new THREE.Color(0x3a3128) },
  // the Reveal spell: (x, z, radius, strength). Pattern ids 100+ are hidden until revealed,
  // 200+ are illusions that vanish while revealed
  uRev: { value: new THREE.Vector4(0, 0, 0, 0) },
};

const GLSL_NOISE: any = /* glsl */`
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vn2(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), u.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm3(vec2 p){ float s = 0.0; float a = 0.5; for (int i = 0; i < 3; i++) { s += a * vn2(p); p = p * 2.07 + vec2(1.7, 9.2); a *= 0.5; } return s / 0.875; }
`;

const GLSL_PATTERNS: any = /* glsl */`
float patA = 1.0;
float patR = 0.0;
float gapm(float x, float w, float fw){ float d = 0.5 - abs(fract(x) - 0.5); float a = fw * 0.85 + 1e-4; return 1.0 - smoothstep(w - a, w + a, d); }
vec3 bookCol(float r){
  if (r < 0.16) return vec3(0.34, 0.05, 0.04);
  if (r < 0.32) return vec3(0.05, 0.18, 0.08);
  if (r < 0.48) return vec3(0.05, 0.08, 0.24);
  if (r < 0.62) return vec3(0.48, 0.3, 0.06);
  if (r < 0.78) return vec3(0.2, 0.1, 0.04);
  if (r < 0.9) return vec3(0.05, 0.22, 0.22);
  return vec3(0.4, 0.34, 0.24);
}
vec3 glassCol(float r){
  if (r < 0.2) return vec3(0.8, 0.06, 0.05);
  if (r < 0.4) return vec3(0.06, 0.16, 0.75);
  if (r < 0.6) return vec3(0.1, 0.58, 0.12);
  if (r < 0.8) return vec3(1.0, 0.62, 0.08);
  return vec3(0.48, 0.1, 0.62);
}
float pattern(int k, vec2 uv, vec3 wp, vec2 fw, inout vec3 c){
  if (k == 1) { float n = fbm3(uv * 2.5); c *= 0.9 + 0.2 * n; return n * 0.3; }
  if (k == 2) {
    float qy = uv.y / 0.24; float row = floor(qy);
    float qx = (uv.x + h12(vec2(row, 1.7)) * 9.0) / 2.4; float sg = floor(qx);
    float r1 = h12(vec2(row, sg) + 0.37);
    float gr = vn2(vec2(uv.x * 1.6 + r1 * 13.0, uv.y * 26.0));
    float m = max(gapm(qy, 0.045, fw.y / 0.24), gapm(qx, 0.008, fw.x / 2.4));
    c *= (0.74 + 0.36 * r1) * (0.86 + 0.24 * gr) * (1.0 - 0.6 * m);
    return (1.0 - m) * (0.8 + 0.2 * gr);
  }
  if (k == 3) {
    vec2 p = uv + (vec2(vn2(uv * 2.3), vn2(uv * 2.3 + 7.1)) - 0.5) * 0.06;
    float qy = p.y / 0.4; float row = floor(qy);
    float bl = 0.55 + 0.45 * h12(vec2(row, 3.1));
    float qx = (p.x + row * 0.37) / bl; float cc = floor(qx);
    float r = h12(vec2(row, cc) + 0.71);
    float m = max(gapm(qy, 0.06, fw.y / 0.4), gapm(qx, 0.024 / bl, fw.x / bl));
    float n = fbm3(uv * 5.0);
    c *= mix((0.72 + 0.42 * r) * (0.84 + 0.26 * n), 0.62, m);
    return (1.0 - m) * (0.7 + 0.3 * n);
  }
  if (k == 4) {
    vec2 p = uv * 2.4; vec2 i = floor(p); vec2 f = fract(p);
    float d1 = 8.0; float d2 = 8.0; vec2 id = vec2(0.0);
    for (int y = -1; y <= 1; y++) { for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y)); vec2 o = h22(i + g) * 0.75 + 0.125; vec2 rr = g + o - f;
      float d = dot(rr, rr);
      if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) { d2 = d; }
    } }
    float e = sqrt(d2) - sqrt(d1);
    float a = (fw.x + fw.y) * 2.4;
    float m = 1.0 - smoothstep(0.05 - a, 0.12 + a, e);
    c *= (0.66 + 0.48 * h12(id)) * (1.0 - 0.55 * m);
    return smoothstep(0.0, 0.4, e);
  }
  if (k == 5) {
    vec2 q = vec2(uv.x / 0.27, uv.y / 0.3);
    float row = floor(q.y); float qx = q.x + mod(row, 2.0) * 0.5; float cx = floor(qx);
    vec2 f = vec2(fract(qx), fract(q.y));
    float barrel = sin(f.x * PI);
    float lip = smoothstep(0.0, 0.22, f.y);
    c *= (0.8 + 0.32 * h12(vec2(row, cx))) * (0.62 + 0.42 * barrel) * (0.55 + 0.45 * lip);
    return barrel * 0.6 + lip * 0.5;
  }
  if (k == 6) {
    vec2 q = vec2(uv.x / 0.38, uv.y / 0.26);
    float row = floor(q.y); float qx = q.x + h12(vec2(row, 0.3)); float cx = floor(qx);
    float r = h12(vec2(row, cx) + 0.4); float fy = fract(q.y);
    float m = gapm(qx, 0.03, fw.x / 0.38);
    float lip = smoothstep(0.0, 0.25, fy);
    c *= (0.78 + 0.34 * r) * (0.6 + 0.4 * lip) * (1.0 - 0.5 * m);
    return lip * (1.0 - m);
  }
  if (k == 7) {
    float n = vn2(vec2(uv.x * 10.0, uv.y * 1.5)) * 0.6 + vn2(vec2(uv.x * 27.0, uv.y * 3.0)) * 0.4;
    float band = smoothstep(0.0, 0.3, fract(uv.y / 0.5));
    c *= (0.72 + 0.42 * n) * (0.68 + 0.32 * band);
    return n * 0.7 + band * 0.4;
  }
  if (k == 8) {
    float n = fbm3(wp.xz * 0.3); float n2 = vn2(wp.xz * 2.7); float n3 = vn2(wp.xz * 11.0);
    c *= (0.84 + 0.3 * n) * (0.9 + 0.12 * n2) * (0.94 + 0.1 * n3);
    return n2 * 0.35 + n3 * 0.25;
  }
  if (k == 9) {
    float qy = uv.y / 0.14; float row = floor(qy);
    float qx = uv.x / 0.3 + mod(row, 2.0) * 0.5; float cx = floor(qx);
    float r = h12(vec2(row, cx) + 0.13);
    float m = max(gapm(qy, 0.09, fw.y / 0.14), gapm(qx, 0.04, fw.x / 0.3));
    c = mix(c * (0.75 + 0.38 * r), vec3(0.5, 0.46, 0.4), m);
    return 1.0 - m;
  }
  if (k == 10) {
    float n = vn2(vec2(uv.x * 9.0, uv.y * 0.9)); float n2 = vn2(vec2(uv.x * 25.0, uv.y * 2.0));
    c *= 0.68 + 0.36 * n + 0.16 * n2; return n * 0.8 + n2 * 0.2;
  }
  if (k == 11) {
    float n = fbm3(wp.xz * 1.5 + wp.y * 1.1); float n2 = vn2(wp.xz * 5.0 + wp.y * 4.0);
    c *= 0.6 + 0.55 * n + 0.18 * n2; return n2 * 0.8;
  }
  if (k == 12) {
    float b = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float border = step(b, 0.1) - step(b, 0.065);
    float edge = step(b, 0.035);
    vec2 d = abs(fract(uv * vec2(4.0, 3.0)) - 0.5);
    float dia = (step(d.x + d.y, 0.34) - step(d.x + d.y, 0.2)) * step(0.13, b);
    c = mix(c, c * 0.42, max(edge, dia));
    c = mix(c, vec3(0.62, 0.42, 0.12), border);
    c *= 0.9 + 0.16 * vn2(uv * 90.0);
    return max(edge, dia) * 0.3;
  }
  if (k == 13) {
    float qx = uv.x / 0.075; float i = floor(qx);
    float r = h12(vec2(i, 2.3)); float top = 0.19 + 0.11 * h12(vec2(i, 5.1));
    float sp = step(uv.y, top) * (1.0 - gapm(qx, 0.05, fw.x / 0.075));
    vec3 bc = bookCol(r) * (0.8 + 0.4 * h12(vec2(i, 9.7)));
    float band = step(abs(uv.y - (top - 0.04)), 0.008);
    bc = mix(bc, vec3(0.6, 0.45, 0.12), band);
    c = mix(vec3(0.04, 0.03, 0.02), bc, sp);
    return sp;
  }
  if (k == 14) {
    vec2 q = uv * vec2(3.0, 7.0); vec2 i = floor(q);
    float lead = max(gapm(q.x, 0.07, fw.x * 3.0), gapm(q.y, 0.07, fw.y * 7.0));
    c = mix(glassCol(h12(i + 0.5)), vec3(0.03), lead);
    patA = mix(1.0, 2.5, lead); patR = -0.5;
    return 1.0 - lead;
  }
  if (k == 15) { float n = vn2(uv * vec2(30.0, 3.0)); c *= 0.85 + 0.25 * n; patR = -0.45; return n * 0.15; }
  if (k == 16) {
    float n = vn2(vec2(uv.x * 14.0, uv.y * 2.5)) * 0.6 + vn2(vec2(uv.x * 40.0, uv.y * 6.0)) * 0.4;
    c *= 0.72 + 0.48 * n; return n;
  }
  if (k == 17) {
    float a1 = (uv.x + uv.y) / 0.17; float a2 = (uv.x - uv.y) / 0.17; float f2 = (fw.x + fw.y) / 0.17;
    float lead = max(gapm(a1, 0.05, f2), gapm(a2, 0.05, f2));
    c = mix(c, vec3(0.05), lead); patA = mix(1.0, 3.0, lead); patR = -0.6;
    return 1.0 - lead;
  }
  if (k == 18) {
    float s = step(0.5, fract(uv.x / 0.7));
    c = mix(c, vec3(0.9, 0.85, 0.75), s); c *= 0.93 + 0.12 * vn2(uv * 20.0); return 0.0;
  }
  if (k == 19) {
    float n = fbm3(uv * 1.7); float n2 = vn2(uv * 13.0);
    c *= 0.9 + 0.14 * n + 0.05 * n2; return n2 * 0.25 + n * 0.2;
  }
  if (k == 20) {
    // fractured rock: layered blocks split by dark joints, mottled by weathering
    vec2 p = vec2(uv.x * 0.9, uv.y * 1.7) + vec2(0.0, fbm3(uv * 0.45 + 2.0) * 0.9);
    vec2 i = floor(p); vec2 f = fract(p);
    float d1 = 8.0; float d2 = 8.0; vec2 id = vec2(0.0);
    for (int y = -1; y <= 1; y++) { for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y)); vec2 o = h22(i + g) * 0.8 + 0.1; vec2 rr = g + o - f;
      float d = dot(rr, rr);
      if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) { d2 = d; }
    } }
    float e = sqrt(d2) - sqrt(d1);
    float a = (fw.x + fw.y) * 1.6;
    float m = 1.0 - smoothstep(0.015 - a, 0.07 + a, e);
    float n = fbm3(uv * 1.9 + 5.0);
    c *= (0.76 + 0.34 * h12(id)) * (0.84 + 0.26 * n) * (1.0 - 0.5 * m);
    return smoothstep(0.0, 0.3, e) * 0.7 + n * 0.3;
  }
  return 0.0;
}
`;

function worldMatCompile(sh: any, m: any) : any {
  Object.assign(sh.uniforms, SU);
  sh.uniforms.uLayerK = m.userData.layer;
  const pre: any = m.userData.ug ? '#define EW_UG\n' : '';
  sh.vertexShader = pre + sh.vertexShader
    .replace('#include <common>', `#include <common>
attribute vec4 pd;
#ifdef EW_UG
attribute vec4 ud; varying vec4 vUd;
#endif
flat varying vec4 vPd; varying vec2 vPUv; varying vec3 vWPos;
uniform float uTime; uniform float uWind;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
vPd = pd; vPUv = uv;
#ifdef EW_UG
vUd = ud;
#endif
{
#ifdef USE_INSTANCING
  vec4 wq = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
#else
  vec4 wq = modelMatrix * vec4(transformed, 1.0);
#endif
  if (pd.y > 0.0) {
    float ph = wq.x * 0.37 + wq.z * 0.23;
    float s = pd.y * uWind;
    transformed.x += (sin(uTime * 1.7 + ph) * 0.65 + sin(uTime * 3.9 + ph * 2.3) * 0.25) * 0.06 * s;
    transformed.z += cos(uTime * 1.3 + ph * 1.37) * 0.05 * s;
  }
  vWPos = wq.xyz;
}`);
  sh.fragmentShader = pre + sh.fragmentShader
    .replace('#include <common>', `#include <common>
flat varying vec4 vPd; varying vec2 vPUv; varying vec3 vWPos;
uniform float uTime; uniform float uNight; uniform vec2 uOccC; uniform float uOccR; uniform vec3 uOccP; uniform vec2 uOccDir; uniform float uOccOn;
uniform float uSurfY; uniform float uLayerK; uniform vec4 uRev;
#ifdef EW_UG
varying vec4 vUd;
uniform float uUgTop; uniform float uCutK; uniform vec2 uCamDir; uniform float uNearCut; uniform float uFullCut; uniform vec3 uSectCol;
#endif
${GLSL_NOISE}
${GLSL_PATTERNS}
const float BAYER[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
float bayer4(vec2 p){ ivec2 q = ivec2(mod(p, 4.0)); return (BAYER[q.x + q.y * 4] + 0.5) / 16.0; }
vec3 pnArb(vec3 sp, vec3 sn, vec2 dh, float fd){
  vec3 sx = normalize(dFdx(sp)); vec3 sy = normalize(dFdy(sp));
  vec3 r1 = cross(sy, sn); vec3 r2 = cross(sn, sx);
  float det = dot(sx, r1) * fd;
  vec3 g = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * sn - g);
}`)
    .replace('#include <color_fragment>', `#include <color_fragment>
if (uLayerK > 0.5 && vWPos.y > uSurfY) discard;
#ifdef EW_UG
if (vWPos.y > uUgTop) discard;
if (vUd.w > 0.5 && uCutK > 0.001) {
  float facing = dot(vUd.yz, uCamDir);
  if (vWPos.y > vUd.x + mix(uFullCut, uNearCut, smoothstep(0.08, 0.3, facing) * uCutK)) discard;
}
#endif
float patH = 0.0;
vec2 pfw = fwidth(vPUv);
float revGlow = 0.0;
{
  int pk = int(vPd.x + 0.5);
  if (pk >= 100) {
    float rd = length(vWPos.xz - uRev.xy);
    float rk = (1.0 - smoothstep(uRev.z - 2.0, uRev.z, rd)) * uRev.w;
    float vis = pk >= 200 ? 1.0 - rk : rk;
    if (vis < bayer4(gl_FragCoord.xy) * 0.98 + 0.01) discard;
    revGlow = pk >= 200 ? 0.0 : (1.0 - vis * 0.6);
    pk -= pk >= 200 ? 200 : 100;
  }
  vec3 pc = diffuseColor.rgb;
  if (pk > 0) patH = pattern(pk, vPUv, vWPos, pfw, pc);
  diffuseColor.rgb = pc;
  diffuseColor.a = clamp(diffuseColor.a * patA, 0.0, 1.0);
  if (vPd.z > 0.5 && uOccOn > 0.001) {
    vec2 dd = (gl_FragCoord.xy - uOccC) / uOccR;
    float rr = length(dd);
    if (rr < 1.0 && dot(vWPos.xz - uOccP.xz, uOccDir) > 0.35 && vWPos.y > uOccP.y + 0.25) {
      float keep = mix(1.0, smoothstep(0.45, 1.0, rr), uOccOn);
      if (keep < bayer4(gl_FragCoord.xy)) discard;
    }
  }
}`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + patR, 0.04, 1.0);`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec2 dH = vec2(dFdx(patH), dFdy(patH)) * 0.55; if (dot(dH, dH) > 1e-9) normal = pnArb(-vViewPosition, normal, dH, faceDirection); }`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float em = max(vPd.w, 0.0) + max(-vPd.w, 0.0) * uNight; totalEmissiveRadiance += diffuseColor.rgb * em; }
totalEmissiveRadiance += vec3(0.45, 0.7, 1.0) * revGlow * 0.8;
float emberK = 0.0;   // glowing rim just under the slice plane, on steep faces only
if (uSurfY < 9999.0 && uLayerK > 0.5) {
  vec3 gn = normalize(cross(dFdx(vWPos), dFdy(vWPos)));
  emberK = 0.8 * (1.0 - smoothstep(0.0, 0.3, uSurfY - vWPos.y)) * (1.0 - smoothstep(0.55, 0.85, abs(gn.y)));
}`)
    .replace('#include <opaque_fragment>', `#include <opaque_fragment>
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.15, 0.33, 0.06), emberK);
#ifdef EW_UG
if (!gl_FrontFacing) gl_FragColor = vec4(uSectCol, 1.0);
#endif`);
}

function worldMat(o: any = {}) : any {
  const m: any = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: o.rough ?? 0.86, metalness: o.metal ?? 0,
    transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: o.depthWrite ?? true,
    side: o.ug ? THREE.DoubleSide : (o.side ?? THREE.FrontSide),
  });
  m.shadowSide = THREE.DoubleSide;
  m.userData.layer = { value: o.layer ?? (o.ug ? 0 : 1) };   // 1: surface (sliced away when underground)
  m.userData.ug = !!o.ug;
  m.onBeforeCompile = (sh: any) => worldMatCompile(sh, m);
  m.customProgramCacheKey = () => (o.ug ? 'emberwick-ug-2' : 'emberwick-world-2');
  m.userData.baseOpacity = m.opacity;
  m.userData.baseTransparent = m.transparent;
  return m;
}

// ============================================================================
//  Geometry batching. Everything static is emitted into Batches (flat arrays)
//  through a matrix-stack Builder, then merged into a few hundred meshes.
// ============================================================================
class Batch {
  [key: string]: any;
  constructor(ug: any = false) { this.P = []; this.N = []; this.C = []; this.U = []; this.D = []; this.UD = ug ? [] : null; }
  get count() : any { return this.P.length / 3; }
  toGeometry() : any {
    const g: any = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setAttribute('pd', new THREE.Float32BufferAttribute(this.D, 4));
    if (this.UD) g.setAttribute('ud', new THREE.Float32BufferAttribute(this.UD, 4));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// spatially chunked batches so big static scenery still frustum-culls
class Chunked {
  [key: string]: any;
  constructor(size: any = 26) { this.size = size; this.map = new Map(); }
  at(x: any, z: any) : any {
    const k: any = Math.floor(x / this.size) + ',' + Math.floor(z / this.size);
    let b: any = this.map.get(k);
    if (!b) { b = new Batch(); this.map.set(k, b); }
    return b;
  }
  build(scene: any, mat: any, cast: any = true) : any {
    const out: any = [];
    for (const b of this.map.values()) if (b.count) {
      const m: any = new THREE.Mesh(b.toGeometry(), mat);
      m.castShadow = cast; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
      scene.add(m); out.push(m);
      b.mesh = m;   // so things emitted into it can be found again (see EMIT_TRACK)
      b.P = b.N = b.C = b.U = b.D = b.UD = null;   // the data lives on the GPU now
    }
    this.map.clear();
    return out;
  }
}

const UD0: any = { fy: 0, ax: 0, az: 0, nx: 0, nz: 0, k: 0 };
const B: any = {
  tgt: null, m: new THREE.Matrix4(), st: [], occ: 1, sway: 0, em: 0, ground: -1,
  ud: UD0,   // underground per-vertex data: floor height (fy + ax*x + az*z), inward wall normal, kind (1 = cuttable wall)
  _e: new THREE.Euler(), _q: new THREE.Quaternion(), _t: new THREE.Matrix4(), _p: new V3(), _s: new V3(1, 1, 1),
  to(t: any) : any { this.tgt = t; return this; },
  reset(m: any) : any { this.m.identity(); if (m) this.m.copy(m); this.st.length = 0; return this; },
  push(x: any = 0, y: any = 0, z: any = 0, ry: any = 0, rx: any = 0, rz: any = 0, s: any = 1) : any {
    this.st.push(this.m.clone());
    this._e.set(rx, ry, rz, 'YXZ'); this._q.setFromEuler(this._e);
    this._p.set(x, y, z); this._s.set(s, s, s);
    this._t.compose(this._p, this._q, this._s);
    this.m.multiply(this._t);
    return this;
  },
  pop() : any { this.m.copy(this.st.pop()); return this; },
  wp(x: any, y: any, z: any) : any { return new V3(x, y, z).applyMatrix4(this.m); },
  wdir(x: any, y: any, z: any) : any { return new V3(x, y, z).transformDirection(this.m); },
};

const srcCache: any = new Map();
let EMIT_TRACK: any = null;   // when an array, every emit() records [batch, firstVertex, count] into it
const _A: any = new V3(), _Nn: any = new V3(), _NM: any = new THREE.Matrix3(), _LNM: any = new THREE.Matrix3();
const _L: any = new THREE.Matrix4(), _tE: any = new THREE.Euler(), _tQ: any = new THREE.Quaternion(), _tV: any = new V3(), _tS: any = new V3();

function emit(src: any, L: any, color: any, pat: any, o: any) : any {
  let tgt: any = o.to || B.tgt;
  if (tgt instanceof Chunked) {
    _tV.set((src.min[0] + src.max[0]) / 2, 0, (src.min[2] + src.max[2]) / 2);
    if (L) _tV.applyMatrix4(L);
    _tV.applyMatrix4(B.m);
    tgt = tgt.at(_tV.x, _tV.z);
  }
  const P: any = tgt.P, N: any = tgt.N, Cc: any = tgt.C, U: any = tgt.U, D: any = tgt.D, UDa: any = tgt.UD, ud: any = B.ud;
  if (EMIT_TRACK) EMIT_TRACK.push([tgt, P.length / 3, src.n]);
  const M: any = B.m;
  _NM.getNormalMatrix(M);
  if (L) _LNM.getNormalMatrix(L);
  const c: any = col(color);
  const ao: any = o.ao || 0, sw: any = o.sway ?? B.sway, oc: any = o.occ ?? B.occ, em: any = o.em ?? B.em;
  const uvm: any = o.uv || 0, uvs: any = o.uvs || 1, uo: any = o.uo || 0, vo: any = o.vo || 0;
  const mn: any = src.min, mx: any = src.max;
  const spanY: any = Math.max(1e-6, mx[1] - mn[1]);
  const sx: any = Math.max(1e-6, mx[0] - mn[0]), sy: any = spanY, sz: any = Math.max(1e-6, mx[2] - mn[2]);
  const pos: any = src.pos, nor: any = src.nor, n: any = src.n;
  const swayH: any = o.swayH || 0;   // sway grows with local height when > 0
  for (let i: any = 0; i < n; i++) {
    const i3: any = i * 3;
    const lx: any = pos[i3], ly: any = pos[i3 + 1], lz: any = pos[i3 + 2];
    const nx: any = nor[i3], ny: any = nor[i3 + 1], nz: any = nor[i3 + 2];
    let u: any = 0, v: any = 0;
    if (uvm === 1 || uvm === 2) {
      const ax: any = Math.abs(nx), ay: any = Math.abs(ny), az: any = Math.abs(nz);
      const dx: any = lx - mn[0], dy: any = ly - mn[1], dz: any = lz - mn[2];
      if (ay >= ax && ay >= az) { u = dx; v = dz; if (uvm === 2) { u /= sx; v /= sz; } }
      else if (ax >= az) { u = dz; v = dy; if (uvm === 2) { u /= sz; v /= sy; } }
      else { u = dx; v = dy; if (uvm === 2) { u /= sx; v /= sy; } }
    }
    _A.set(lx, ly, lz); _Nn.set(nx, ny, nz);
    if (L) { _A.applyMatrix4(L); _Nn.applyMatrix3(_LNM).normalize(); }
    if (uvm === 0) {
      const ax: any = Math.abs(_Nn.x), ay: any = Math.abs(_Nn.y), az: any = Math.abs(_Nn.z);
      if (ay >= ax && ay >= az) { u = _A.x; v = _A.z; }
      else if (ax >= az) { u = _A.z; v = _A.y; }
      else { u = _A.x; v = _A.y; }
    } else if (uvm === 3) {
      const ex: any = _Nn.z, ez: any = -_Nn.x, el: any = Math.hypot(ex, ez);
      if (el < 0.2) { u = _A.x; v = _A.z; }
      else {
        const exn: any = ex / el, ezn: any = ez / el;
        u = _A.x * exn + _A.z * ezn;
        const sxx: any = _Nn.y * ezn, syy: any = _Nn.z * exn - _Nn.x * ezn, szz: any = -_Nn.y * exn;
        v = -(_A.x * sxx + _A.y * syy + _A.z * szz);
      }
    }
    _A.applyMatrix4(M); _Nn.applyMatrix3(_NM).normalize();
    P.push(_A.x, _A.y, _A.z); N.push(_Nn.x, _Nn.y, _Nn.z);
    const k: any = ao ? (1 - ao) + ao * ((ly - mn[1]) / spanY) : 1;
    Cc.push(c.r * k, c.g * k, c.b * k);
    U.push(u * uvs + uo, v * uvs + vo);
    const s: any = swayH ? sw * clamp((ly - mn[1]) / spanY, 0, 1) : sw;
    D.push(pat, s, oc, em);
    if (UDa) UDa.push(ud.fy + ud.ax * _A.x + ud.az * _A.z, ud.nx, ud.nz, ud.k);
  }
}

function placeL(x: any, y: any, z: any, o: any) : any {
  if (!o.ry && !o.rx && !o.rz && !o.sx && !o.sy && !o.sz && x === 0 && y === 0 && z === 0) return null;
  _tE.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _tQ.setFromEuler(_tE);
  _tV.set(x, y, z); _tS.set(o.sx || 1, o.sy || 1, o.sz || 1);
  return _L.compose(_tV, _tQ, _tS);
}

function boxSrc(w: any, h: any, d: any) : any {
  const key: any = 'b' + w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3);
  let s: any = srcCache.get(key);
  if (s) return s;
  const x0: any = -w / 2, x1: any = w / 2, y0: any = 0, y1: any = h, z0: any = -d / 2, z1: any = d / 2;
  const pos: any = [], nor: any = [];
  const q: any = (a: any, b: any, c: any, e: any, nn: any) => { pos.push(...a, ...b, ...c, ...a, ...c, ...e); for (let i: any = 0; i < 6; i++) nor.push(...nn); };
  q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
  q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
  q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
  q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
  q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
  s = { pos: new Float32Array(pos), nor: new Float32Array(nor), n: 36, min: [x0, y0, z0], max: [x1, y1, z1] };
  srcCache.set(key, s);
  return s;
}

function geoSrc(key: any, make: any, flat: any = true) : any {
  let s: any = srcCache.get(key);
  if (s) return s;
  let g: any = make();
  if (g.index) g = g.toNonIndexed();
  if (flat) g.computeVertexNormals();
  g.computeBoundingBox();
  s = {
    pos: g.attributes.position.array, nor: g.attributes.normal.array, n: g.attributes.position.count,
    min: g.boundingBox.min.toArray(), max: g.boundingBox.max.toArray(),
  };
  srcCache.set(key, s);
  return s;
}

function hash3f(x: any, y: any, z: any) : any { return hash2(Math.round(x * 997) + Math.round(z * 131), Math.round(y * 619)); }
function jitterGeo(g: any, amt: any) : any {
  const p: any = g.attributes.position, v: any = new V3();
  for (let i: any = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const len: any = v.length() || 1;
    const k: any = hash3f(v.x, v.y, v.z);
    v.multiplyScalar(1 + ((k - 0.5) * 2 * amt) / len);
    p.setXYZ(i, v.x, v.y, v.z);
  }
}

// --- primitives (frame coordinates; boxes/cylinders are bottom-anchored) ----
function box(x: any, y: any, z: any, w: any, h: any, d: any, c: any, pat: any = 0, o: any = {}) : any { emit(boxSrc(w, h, d), placeL(x, y, z, o), c, pat, o); }
function cyl(x: any, y: any, z: any, rt: any, rb: any, h: any, seg: any, c: any, pat: any = 0, o: any = {}) : any {
  const s: any = geoSrc(`c${rt},${rb},${h},${seg},${o.open ? 1 : 0},${o.smooth ? 1 : 0},${o.r0 || 0}`, () => {
    const g: any = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open);
    g.translate(0, h / 2, 0);
    if (o.r0) g.rotateY(o.r0);
    return g;
  }, !o.smooth);
  emit(s, placeL(x, y, z, o), c, pat, o);
}
function sph(x: any, y: any, z: any, r: any, c: any, pat: any = 0, o: any = {}) : any {
  const det: any = o.det ?? 1;
  const s: any = geoSrc(`s${r},${det},${o.jit || 0},${o.smooth ? 1 : 0}`, () => {
    const g: any = new THREE.IcosahedronGeometry(r, det);
    if (o.jit) jitterGeo(g, o.jit * r);
    return g;
  }, !o.smooth);
  emit(s, placeL(x, y, z, o), c, pat, o);
}
function ball(x: any, y: any, z: any, r: any, c: any, pat: any = 0, o: any = {}) : any { // smooth uv-sphere (fruit, bread, heads)
  const ws: any = o.ws || 10, hs: any = o.hs || 7;
  const s: any = geoSrc(`u${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs), false);
  emit(s, placeL(x, y, z, o), c, pat, o);
}
function lathe(x: any, y: any, z: any, pts: any, seg: any, c: any, pat: any = 0, o: any = {}) : any {
  const key: any = 'l' + pts.map((p: any) => p[0].toFixed(3) + ':' + p[1].toFixed(3)).join(';') + '|' + seg + (o.smooth ? 's' : '');
  const s: any = geoSrc(key, () => new THREE.LatheGeometry(pts.map((p: any) => new THREE.Vector2(p[0], p[1])), seg), !o.smooth);
  emit(s, placeL(x, y, z, o), c, pat, o);
}
function torus(x: any, y: any, z: any, r: any, t: any, rs: any, ts: any, c: any, pat: any = 0, o: any = {}) : any {
  const s: any = geoSrc(`t${r},${t},${rs},${ts},${o.arc || TAU}`, () => new THREE.TorusGeometry(r, t, rs, ts, o.arc || TAU), true);
  emit(s, placeL(x, y, z, o), c, pat, o);
}
function pumpkinSrc(r: any) : any {
  return geoSrc('pk' + r, () => {
    const g: any = new THREE.SphereGeometry(r, 16, 9);
    const p: any = g.attributes.position, v: any = new V3();
    for (let i: any = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const a: any = Math.atan2(v.z, v.x);
      const k: any = 1 + 0.09 * Math.cos(a * 8);
      p.setXYZ(i, v.x * k, v.y * 0.72, v.z * k);
    }
    g.translate(0, r * 0.72, 0);
    g.computeVertexNormals();
    return g;
  }, false);
}
function pumpkin(x: any, y: any, z: any, r: any, c: any = 0xd8661c, o: any = {}) : any {
  const yy: any = y + gy(x, z);
  emit(pumpkinSrc(r), placeL(x, yy, z, o), c, PAT.NOISE, o);
  cyl(x, yy + r * 1.4, z, r * 0.07, r * 0.1, r * 0.3, 5, 0x5a4a1e, 0, { rz: 0.25 });
}
// gable triangle prism: base along local z (width w), apex up (height h), thickness t along x
function gableSrc(w: any, h: any, t: any) : any {
  return geoSrc(`g${w},${h},${t}`, () => {
    const s: any = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
    const g: any = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
    g.translate(0, 0, -t / 2);
    g.rotateY(PI / 2);
    return g;
  }, true);
}
function gable(x: any, y: any, z: any, w: any, h: any, t: any, c: any, pat: any = 0, o: any = {}) : any { emit(gableSrc(w, h, t), placeL(x, y, z, o), c, pat, o); }
// arbitrary polygon slab (frame xz, may contain holes), from y to y+t
function slab(pts: any, holes: any, y: any, t: any, c: any, pat: any = 0, o: any = {}) : any {
  const sh: any = new THREE.Shape(pts.map((p: any) => new THREE.Vector2(p[0], -p[1])));
  for (const h of holes || []) sh.holes.push(new THREE.Path(h.map((p: any) => new THREE.Vector2(p[0], -p[1]))));
  let g: any = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false });
  g.rotateX(-PI / 2);
  g.translate(0, y, 0);
  if (g.index) g = g.toNonIndexed();
  g.computeVertexNormals(); g.computeBoundingBox();
  const s: any = { pos: g.attributes.position.array, nor: g.attributes.normal.array, n: g.attributes.position.count, min: g.boundingBox.min.toArray(), max: g.boundingBox.max.toArray() };
  emit(s, null, c, pat, o);
}
// raw triangles in frame coords (flat shaded)
function tris(verts: any, c: any, pat: any = 0, o: any = {}) : any {
  const n: any = verts.length / 3, nor: any = new Float32Array(verts.length);
  const a: any = new V3(), b: any = new V3(), d: any = new V3();
  for (let i: any = 0; i < n; i += 3) {
    a.fromArray(verts, i * 3); b.fromArray(verts, i * 3 + 3); d.fromArray(verts, i * 3 + 6);
    b.sub(a); d.sub(a); b.cross(d).normalize();
    for (let k: any = 0; k < 3; k++) nor.set([b.x, b.y, b.z], (i + k) * 3);
  }
  let mn: any = [1e9, 1e9, 1e9], mx: any = [-1e9, -1e9, -1e9];
  for (let i: any = 0; i < n; i++) for (let k: any = 0; k < 3; k++) { mn[k] = Math.min(mn[k], verts[i * 3 + k]); mx[k] = Math.max(mx[k], verts[i * 3 + k]); }
  emit({ pos: verts, nor, n, min: mn, max: mx }, null, c, pat, o);
}
function quad(a: any, b: any, c2: any, d: any, c: any, pat: any = 0, o: any = {}) : any { tris([...a, ...b, ...c2, ...a, ...c2, ...d], c, pat, o); }

// ============================================================================
//  Physics world: oriented-box & circle colliders, walkable surfaces
//  (flat polygons with holes, ramps), terrain heightfield, water.
// ============================================================================
const STEP: any = 0.48, HEADROOM: any = 1.75, DROP: any = 0.7;
const WATER_Y: any = -0.42;
const PHYS: any = { cs: 4, cgrid: new Map(), wgrid: new Map(), cols: [], walks: [], stamp: 1 };
const gkey: any = (gx: any, gz: any) => (gx + 512) * 1024 + (gz + 512);

function gridAdd(grid: any, item: any) : any {
  const cs: any = PHYS.cs;
  for (let gx: any = Math.floor(item.minx / cs); gx <= Math.floor(item.maxx / cs); gx++)
    for (let gz: any = Math.floor(item.minz / cs); gz <= Math.floor(item.maxz / cs); gz++) {
      const k: any = gkey(gx, gz);
      let a: any = grid.get(k);
      if (!a) { a = []; grid.set(k, a); }
      a.push(item);
    }
}
function gridRemove(grid: any, item: any) : any {
  const cs: any = PHYS.cs;
  for (let gx: any = Math.floor(item.minx / cs); gx <= Math.floor(item.maxx / cs); gx++)
    for (let gz: any = Math.floor(item.minz / cs); gz <= Math.floor(item.maxz / cs); gz++) {
      const a: any = grid.get(gkey(gx, gz)); if (!a) continue;
      const i: any = a.indexOf(item); if (i >= 0) a.splice(i, 1);
    }
}
// take a collider or a walkable surface back out of the physics world
function physRemove(o: any) : any {
  let i: any = PHYS.cols.indexOf(o);
  if (i >= 0) { PHYS.cols.splice(i, 1); gridRemove(PHYS.cgrid, o); return; }
  i = PHYS.walks.indexOf(o);
  if (i >= 0) { PHYS.walks.splice(i, 1); gridRemove(PHYS.wgrid, o); }
}
function gridQuery(grid: any, x: any, z: any, r: any, out: any) : any {
  out.length = 0;
  const cs: any = PHYS.cs, st: any = ++PHYS.stamp;
  for (let gx: any = Math.floor((x - r) / cs); gx <= Math.floor((x + r) / cs); gx++)
    for (let gz: any = Math.floor((z - r) / cs); gz <= Math.floor((z + r) / cs); gz++) {
      const a: any = grid.get(gkey(gx, gz));
      if (!a) continue;
      for (const it of a) if (it._st !== st) { it._st = st; out.push(it); }
    }
  return out;
}

// world-space collider: oriented box, local x axis = (c, s) in the xz plane
function addColW(cx: any, cz: any, hx: any, hz: any, c: any, s: any, y0: any, y1: any, tag?: any) : any {
  const ex: any = Math.abs(c) * hx + Math.abs(s) * hz, ez: any = Math.abs(s) * hx + Math.abs(c) * hz;
  const o: any = { t: 0, cx, cz, hx, hz, c, s, y0, y1, tag, minx: cx - ex, maxx: cx + ex, minz: cz - ez, maxz: cz + ez };
  PHYS.cols.push(o); gridAdd(PHYS.cgrid, o);
  return o;
}
function addCircW(x: any, z: any, r: any, y0: any, y1: any, tag?: any) : any {
  const o: any = { t: 1, cx: x, cz: z, r, y0, y1, tag, minx: x - r, maxx: x + r, minz: z - r, maxz: z + r };
  PHYS.cols.push(o); gridAdd(PHYS.cgrid, o);
  return o;
}
// frame-coordinate helpers (use the Builder's current matrix)
function colBox(x: any, z: any, w: any, d: any, y0: any, y1: any, ry: any = 0, tag?: any) : any {
  const p: any = B.wp(x, 0, z);
  const ax: any = B.wdir(Math.cos(ry), 0, -Math.sin(ry));
  const yb: any = B.m.elements[13];
  return addColW(p.x, p.z, w / 2, d / 2, ax.x, ax.z, y0 + yb, y1 + yb, tag);
}
function colCirc(x: any, z: any, r: any, y0: any, y1: any, tag?: any) : any {
  const p: any = B.wp(x, 0, z);
  const yb: any = B.m.elements[13];
  return addCircW(p.x, p.z, r, y0 + yb, y1 + yb, tag);
}
function polyBounds(o: any, pts: any) : any {
  o.minx = Infinity; o.maxx = -Infinity; o.minz = Infinity; o.maxz = -Infinity;
  for (const p of pts) { o.minx = Math.min(o.minx, p[0]); o.maxx = Math.max(o.maxx, p[0]); o.minz = Math.min(o.minz, p[1]); o.maxz = Math.max(o.maxz, p[1]); }
}
function walkPolyW(pts: any, y: any, holes: any, tag: any) : any {
  const o: any = { t: 0, pts, holes: holes || null, y, tag };
  polyBounds(o, pts);
  PHYS.walks.push(o); gridAdd(PHYS.wgrid, o);
  return o;
}
function walkPoly(pts: any, y: any, holes?: any, tag?: any) : any {
  const tf: any = (p: any) => { const v: any = B.wp(p[0], 0, p[1]); return [v.x, v.z]; };
  return walkPolyW(pts.map(tf), y + B.m.elements[13], holes ? holes.map((h: any) => h.map(tf)) : null, tag);
}
function rectPts(x: any, z: any, w: any, d: any) : any { return [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]]; }
function walkRect(x: any, z: any, w: any, d: any, y: any, holes?: any, tag?: any) : any { return walkPoly(rectPts(x, z, w, d), y, holes, tag); }
// ramp: rises along local +z from y0 (at -len/2) to y1 (at +len/2)
function walkRamp(x: any, z: any, w: any, len: any, y0: any, y1: any, ry: any = 0, tag?: any) : any {
  const p: any = B.wp(x, 0, z), ax: any = B.wdir(Math.cos(ry), 0, -Math.sin(ry)), yb: any = B.m.elements[13];
  const hx: any = w / 2, hz: any = len / 2, c: any = ax.x, s: any = ax.z;
  const ex: any = Math.abs(c) * hx + Math.abs(s) * hz, ez: any = Math.abs(s) * hx + Math.abs(c) * hz;
  const o: any = { t: 1, cx: p.x, cz: p.z, hx, hz, c, s, y0: y0 + yb, y1: y1 + yb, tag, minx: p.x - ex, maxx: p.x + ex, minz: p.z - ez, maxz: p.z + ez };
  PHYS.walks.push(o); gridAdd(PHYS.wgrid, o);
  return o;
}
function pip(pts: any, x: any, z: any) : any {
  let inside: any = false;
  for (let i: any = 0, j: any = pts.length - 1; i < pts.length; j = i++) {
    const xi: any = pts[i][0], zi: any = pts[i][1], xj: any = pts[j][0], zj: any = pts[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function walkHeight(s: any, x: any, z: any) : any {
  if (x < s.minx || x > s.maxx || z < s.minz || z > s.maxz) return null;
  if (s.t === 1) {
    const dx: any = x - s.cx, dz: any = z - s.cz;
    const lx: any = dx * s.c + dz * s.s, lz: any = -dx * s.s + dz * s.c;
    if (Math.abs(lx) > s.hx || Math.abs(lz) > s.hz) return null;
    return s.y0 + (s.y1 - s.y0) * (lz / (2 * s.hz) + 0.5);
  }
  if (!pip(s.pts, x, z)) return null;
  if (s.holes) for (const h of s.holes) if (pip(h, x, z)) return null;
  return s.y;
}

// ---- terrain -------------------------------------------------------------------
// The village sits in a bowl of rolling country. Beyond it the land becomes a set of
// regions: farmland to the south, the Wisp Fen to the south-west, the Barrow Downs to the
// west, the Gloamwood under the mountain to the north-east, and the mountain across the north.
const RIVER: any = [[57, -100], [52, -62], [47.5, -32], [45, -8], [44.8, 12], [48, 36], [54, 62], [60, 100], [66, 138], [72, 185]];
const POND: any = { x: -41, z: 35, r: 7.5 };
const PADS: any = [];     // flattened ground: oriented rects with a flat margin and a blend falloff
const CARVES: any = [];   // polygons where the terrain never counts as ground (stairwells, the cave)
const MOUTH: any = { x: -8, z: 0, F: 0 };   // troll cave mouth (z and floor height set below)
const WORLD: any = { cx: -5, cz: 8, r: 166 };
// region anchors (also used by the region builders and the story)
const REG: any = {
  fen: { x: -100, z: 78, rx: 50, rz: 44 },
  downs: { x: -112, z: -42, rx: 52, rz: 50 },
  gloam: { x: 100, z: -60, rx: 52, rz: 46 },
  circle: { x: -112, z: -61, r: 10 },
  barrow: { x: -140, z: -38 },
  hollow: { x: 118, z: -88 },
  field: { x: -13, z: 108 },
};
function wFen(x: any, z: any) : any { return regionW(REG.fen, x, z, 0.35, 0.22); }
function wDowns(x: any, z: any) : any { return regionW(REG.downs, x, z, 0.4, 0.2); }
function wGloam(x: any, z: any) : any { return regionW(REG.gloam, x, z, 0.4, 0.2); }
function wFields(x: any, z: any) : any { return sstep(48, 75, z) * (1 - sstep(-75, -95, x)); }
function longFieldK(x: any, z: any) : any { return (1 - sstep(15, 18, Math.abs(x - REG.field.x))) * (1 - sstep(12.5, 15.5, Math.abs(z - REG.field.z))); }
// hilltop beacons (fast-travel wayfires once lit)
const BEACONS: any = [[-104, 126, 'heath'], [102, 98, 'meadow'], [126, -18, 'gloamridge'], [-140, 6, 'westridge']];
function segDist(px: any, pz: any, a: any, b: any) : any {
  const dx: any = b[0] - a[0], dz: any = b[1] - a[1];
  const t: any = clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t);
}
function riverDist(x: any, z: any) : any {
  let best: any = 1e9;
  for (let i: any = 0; i < RIVER.length - 1; i++) best = Math.min(best, segDist(x, z, RIVER[i], RIVER[i + 1]));
  return best;
}
// the mountain's foot line wanders in spurs and bays
function footZ(x: any) : any {
  return -51 + 3.6 * Math.sin(x * 0.07 + 0.9) + 2.0 * Math.sin(x * 0.17 + 2.6) + 0.9 * Math.sin(x * 0.41) - 18 * sstep(2, 44, x) - 5 * sstep(-58, -95, x)
    - 26 * sstep(60, 110, x) - 36 * sstep(-80, -130, x)
    + 1.2 * Math.exp(-(((x - MOUTH.x) / 6) ** 2));
}
function terrace(h: any, step: any, a: any) : any {
  const q: any = h / step, i: any = Math.floor(q), f: any = q - i;
  return lerp(h, (i + sstep(0.5, 0.93, f)) * step, a);
}
function mountainHA(x: any, z: any) : any {
  const u: any = footZ(x) - z;                   // metres north of the foot
  if (u < -4) return 0;
  const env: any = 1 - 0.55 * sstep(-6, 42, x) + 0.4 * sstep(90, 140, x);   // lower toward the east, rising again past the Gloamwood
  const cb: any = 2.2 + 5.5 * fbm2(x * 0.06 + 5, 3.3, 3) + 6 * Math.exp(-(((x - MOUTH.x) / 8) ** 2));   // lowest cliff band
  const cw: any = 1.4 + 3.5 * fbm2(x * 0.09 - 2, 7.1, 2);
  let p: any = cb * sstep(-1.2, cw, u) + 11 * sstep(cw, 22, u) + 12 * sstep(14, 46, u) + 14 * sstep(40, 90, u);
  const rn: any = 1 - Math.abs(fbm2(x * 0.045 + 11, z * 0.045 - 3, 4) * 2 - 1);
  const rn2: any = 1 - Math.abs(fbm2(x * 0.12 - 4, z * 0.12 + 9, 3) * 2 - 1);
  p += (rn * 10 + rn2 * 2.2) * sstep(2, 30, u);
  p += 11 * Math.exp(-(((x + 38) / 16) ** 2 + ((z + 104) / 12) ** 2));
  p += 9 * Math.exp(-(((x - 6) / 13) ** 2 + ((z + 104) / 10) ** 2));
  p += 7 * Math.exp(-(((x + 72) / 12) ** 2 + ((z + 96) / 12) ** 2));
  p += 16 * Math.exp(-(((x - 20) / 30) ** 2 + ((z + 150) / 18) ** 2));
  p *= env;
  const stp: any = 2.6 + 1.8 * fbm2(x * 0.03 + 1, z * 0.03 + 4, 2);
  return terrace(p, stp, 0.42 * sstep(3, 10, p));
}
let NAT0: any = 0;
// the countryside close to the village (unchanged from the first build)
function natNearRaw(x: any, z: any) : any {
  const n1: any = fbm2(x * 0.024 + 3.1, z * 0.024 - 7.4, 3);
  const n2: any = fbm2(x * 0.075 - 1.7, z * 0.075 + 2.3, 3);
  let h: any = (n1 - 0.5) * 8.5 + (n2 - 0.5) * 1.8;
  h += 0.06 * clamp(-z - 2, 0, 60);                                // climbs toward the mountain
  h += 0.03 * clamp(-x - 14, 0, 60);                               // and the western hills
  h += 0.055 * clamp(z - 4, 0, 50) * (1 - sstep(10, 40, x));       // and the southern woods
  const r: any = Math.hypot(x * 0.92, z);
  h += sstep(52, 90, r) * (1.0 + fbm2(x * 0.035 + 3, z * 0.035 - 2) * 8.5) * sstep(-30, -5, z);
  h += 2.8 * Math.exp(-((x - 68) ** 2 + (z - 14) ** 2) / 200);    // windmill hill
  return h;
}
// soft 0..1 mask for an ellipse with a wobbly edge
function regionW(R: any, x: any, z: any, edge: any = 0.3, wob: any = 0.18) : any {
  const d: any = Math.hypot((x - R.x) / R.rx, (z - R.z) / R.rz) + (fbm2(x * 0.05 + R.x, z * 0.05 - R.z, 2) - 0.5) * wob * 2;
  return 1 - sstep(1 - edge, 1, d);
}
function gauss(x: any, z: any, cx: any, cz: any, r: any) : any { return Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r)); }
const BARROWS: any = [[-140, -38, 9.5, 4.2], [-126, -24, 5, 2.2], [-150, -58, 6, 2.6], [-131, -56, 4.5, 1.9], [-152, -22, 5.5, 2.4], [-100, -30, 4, 1.6]];
// the far country: absolute heights, before the river, pond and mountain are applied
function farH(x: any, z: any) : any {
  const n1: any = fbm2(x * 0.024 + 3.1, z * 0.024 - 7.4, 3), n2: any = fbm2(x * 0.075 - 1.7, z * 0.075 + 2.3, 3);
  let base: any = 1.6 + (n1 - 0.5) * 6.5 + (n2 - 0.5) * 1.6;
  let wsum: any = 1, hsum: any = base;
  // southern farmland: broad and gentle
  const wf: any = sstep(48, 75, z) * (1 - sstep(-75, -95, x));
  if (wf > 0) {
    let h: any = 1.3 + (n1 - 0.5) * 2.6 + (n2 - 0.5) * 0.5 + 0.01 * (z - 60);
    h = lerp(h, 1.25, (1 - sstep(16, 26, Math.hypot((x - REG.field.x) / 1.4, z - REG.field.z))) * 0.85);   // the Long Field lies flat
    hsum += h * wf * 3; wsum += wf * 3;
  }
  // the Wisp Fen: a drowned basin of pools and hummocks
  const wfen: any = regionW(REG.fen, x, z, 0.35, 0.22);
  if (wfen > 0) {
    const isl: any = fbm2(x * 0.11 + 31, z * 0.11 - 17, 3), isl2: any = fbm2(x * 0.24 + 3, z * 0.24 + 8, 2), big: any = fbm2(x * 0.03 - 5, z * 0.03 + 9, 2);
    let h: any = -1.3 + 1.9 * sstep(0.42, 0.58, isl * 0.62 + isl2 * 0.18 + big * 0.2 + 0.02) + 0.25 * (isl2 - 0.5);
    hsum += h * wfen * 10; wsum += wfen * 10;
  }
  // the Barrow Downs: long smooth chalk swells, barrows, the circle on its hill
  const wd: any = regionW(REG.downs, x, z, 0.4, 0.2);
  if (wd > 0) {
    const s: any = fbm2(x * 0.016 + 7, z * 0.016 + 2, 3);
    let h: any = 2.0 + 9.0 * sstep(0.3, 0.75, s) + (n2 - 0.5) * 0.8;
    const cd: any = Math.hypot(x - REG.circle.x, z - REG.circle.z);
    h = lerp(h, 8.5, 1 - sstep(REG.circle.r + 2, REG.circle.r + 18, cd));       // the circle's hill, flat-topped
    hsum += h * wd * 4; wsum += wd * 4;
  }
  // the Gloamwood: knotted forest hills under the mountain
  const wg: any = regionW(REG.gloam, x, z, 0.4, 0.2);
  if (wg > 0) {
    const s: any = fbm2(x * 0.035 - 13, z * 0.035 + 5, 3);
    let h: any = 2.2 + 6.0 * s + 2.2 * sstep(-30, -100, z);
    h = lerp(h, 3.0, 1 - sstep(14, 26, Math.hypot(x - REG.hollow.x, z - REG.hollow.z)));   // the Hollow: a bowl in the trees
    hsum += h * wg * 4; wsum += wg * 4;
  }
  let h: any = hsum / wsum;
  // barrow mounds sit on whatever the downs are doing
  for (const [bx, bz, br, bh] of BARROWS) {
    const d: any = Math.hypot(x - bx, z - bz);
    if (d < br * 1.6) h += bh * (1 - sstep(br * 0.25, br * 1.15, d)) ** 1.2;
  }
  for (const [bx, bz] of BEACONS) {   // each beacon crowns a little hill
    const d: any = Math.hypot(x - bx, z - bz);
    if (d < 30) h = lerp(h, Math.max(h, 7.5), (1 - sstep(4, 26, d)) * 0.9) + 2.5 * (1 - sstep(0, 24, d));
  }
  // the world's rim: hills and cliffs closing the valley in
  const rw: any = Math.hypot((x - WORLD.cx) * 0.97, z - WORLD.cz);
  const pass: any = 1 - sstep(8, 22, Math.abs(x - 7 - (z - 140) * 0.05)) * 1;   // the south road's way in through the hills
  h += sstep(146, 176, rw) * (9 + 14 * fbm2(x * 0.04 + 9, z * 0.04 - 6, 3)) * (1 - pass * sstep(120, 140, z) * 0.85);
  return h;
}
function natH(x: any, z: any) : any {
  let near: any = natNearRaw(x, z) - NAT0;
  near = (near - 0.05 + Math.sqrt((near + 0.05) ** 2 + 0.02)) / 2;    // stay above the water table
  const r: any = Math.hypot(x * 0.92, z);
  const w: any = sstep(56, 92, r);
  let h: any = w > 0 ? lerp(near, farH(x, z), w) : near;
  h = lerp(0.3, h, sstep(POND.r + 1, POND.r + 14, Math.hypot(x - POND.x, z - POND.z)));
  h = lerp(0.35, h, sstep(7, 22, riverDist(x, z)));                // river floodplain
  return h + mountainHA(x, z);
}
{ let s: any = 0, n: any = 0; for (let i: any = -4; i <= 4; i++) for (let j: any = -4; j <= 4; j++) if (i * i + j * j <= 16) { s += natNearRaw(i * 2.5, j * 2.5); n++; } NAT0 = s / n; }
MOUTH.z = Math.round((footZ(MOUTH.x) - 0.3) * 10) / 10;
MOUTH.F = Math.round(natH(MOUTH.x, MOUTH.z + 5) * 10) / 10;

function addPad(o: any) : any { // {x, z, ry (rad), hx, hz, m: flat margin, f: falloff, y}
  const p: any = { hx: 0, hz: 0, m: 1.5, f: 5, ...o };
  p.c = Math.cos(o.ry || 0); p.s = Math.sin(o.ry || 0); p.reach = Math.hypot(p.hx, p.hz) + p.m + p.f;
  PADS.push(p);
  return p;
}
function padDist(p: any, x: any, z: any) : any {
  const dx: any = x - p.x, dz: any = z - p.z;
  const lx: any = dx * p.c - dz * p.s, lz: any = dx * p.s + dz * p.c;
  return Math.hypot(Math.max(Math.abs(lx) - p.hx, 0), Math.max(Math.abs(lz) - p.hz, 0));
}
function padLevel(x: any, z: any, ry: any, hx: any, hz: any) : any { // average natural height over a footprint
  const c: any = Math.cos(ry), s: any = Math.sin(ry);
  let sum: any = 0, n: any = 0;
  for (let i: any = -2; i <= 2; i++) for (let j: any = -2; j <= 2; j++) {
    const lx: any = (i / 2) * hx, lz: any = (j / 2) * hz;
    sum += natH(x + lx * c + lz * s, z - lx * s + lz * c); n++;
  }
  return Math.round((sum / n) * 20) / 20;
}
// the square, the cave mouth (apron + a notch cut into the cliff) and the windmill knoll
addPad({ x: 0, z: 0, m: 10.5, f: 6, y: 0 });
addPad({ x: MOUTH.x, z: MOUTH.z + 4.6, hx: 3.6, hz: 3.0, m: 1.0, f: 5, y: MOUTH.F });
addPad({ x: MOUTH.x, z: MOUTH.z - 1.0, hx: 2.5, hz: 2.6, m: 0.1, f: 1.1, y: MOUTH.F - 0.05 });
addPad({ x: 68, z: 13.5, m: 3.4, f: 4, y: Math.round(natH(68, 13.5) * 20) / 20 });
// meres in the fen: open water round Mother Hesk's island, Bartholomew's island and the cat's island
const MERES: any = [{ x: -118, z: 90, r: 11, ir: 3.6 }, { x: -137, z: 64, r: 7.5, ir: 2.2 }, { x: -92, z: 113, r: 6.5, ir: 1.9 }];
for (const m of MERES) { addPad({ x: m.x, z: m.z, m: m.r, f: 4, y: -1.15 }); addPad({ x: m.x, z: m.z, m: m.ir, f: 1.4, y: 0.32 }); }
// the stone circle's hilltop and the Hollow's floor
addPad({ x: REG.circle.x, z: REG.circle.z, m: REG.circle.r + 1.5, f: 6, y: Math.round(natH(REG.circle.x, REG.circle.z) * 10) / 10 });
addPad({ x: REG.hollow.x, z: REG.hollow.z, m: 12.5, f: 6, y: Math.round(natH(REG.hollow.x, REG.hollow.z) * 10) / 10 });
for (const [bx, bz] of BEACONS) addPad({ x: bx, z: bz, m: 3.2, f: 3, y: Math.round(natH(bx, bz) * 10) / 10 });

function terrainHA(x: any, z: any) : any {
  let h: any = natH(x, z);
  for (const p of PADS) {
    if (Math.abs(x - p.x) > p.reach || Math.abs(z - p.z) > p.reach) continue;
    const d: any = padDist(p, x, z);
    if (d < p.m + p.f) h = lerp(p.y, h, sstep(p.m, p.m + p.f, d));
  }
  const rd: any = riverDist(x, z);
  if (rd < 8.2) h = lerp(-1.75, h, sstep(3.4, 8.0, rd));
  const pdd: any = Math.hypot(x - POND.x, z - POND.z);
  if (pdd < POND.r + 3) h = lerp(-1.35, h, sstep(POND.r - 2.8, POND.r + 2.2, pdd));
  return h;
}

// Height cache: once every building has claimed its level ground the whole terrain is baked
// into a 1 m grid. The ground mesh is built from exactly these samples and terrainH
// interpolates them along the same triangles, so feet, props and physics sit on the visible
// surface, and the per-frame cost is a couple of array reads.
const HC: any = { x0: -192, z0: -182, x1: 192, z1: 200, st: 1, nx: 0, nz: 0, h: null, m: null };
function bakeTerrain() : any {
  HC.nx = Math.round((HC.x1 - HC.x0) / HC.st) + 1; HC.nz = Math.round((HC.z1 - HC.z0) / HC.st) + 1;
  const h: any = new Float32Array(HC.nx * HC.nz), m: any = new Float32Array(HC.nx * HC.nz);
  for (let j: any = 0; j < HC.nz; j++) for (let i: any = 0; i < HC.nx; i++) {
    const x: any = HC.x0 + i * HC.st, z: any = HC.z0 + j * HC.st, k: any = j * HC.nx + i;
    h[k] = terrainHA(x, z); m[k] = mountainHA(x, z);
  }
  HC.h = h; HC.m = m;
}
function hcSample(arr: any, x: any, z: any) : any {
  const fx: any = (x - HC.x0) / HC.st, fz: any = (z - HC.z0) / HC.st;
  const i: any = Math.floor(fx), j: any = Math.floor(fz);
  if (i < 0 || j < 0 || i >= HC.nx - 1 || j >= HC.nz - 1) return null;
  const u: any = fx - i, v: any = fz - j, k: any = j * HC.nx + i;
  const a: any = arr[k], b: any = arr[k + 1], c: any = arr[k + HC.nx], d: any = arr[k + HC.nx + 1];
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
function terrainH(x: any, z: any) : any {
  if (HC.h) { const v: any = hcSample(HC.h, x, z); if (v !== null) return v; }
  return terrainHA(x, z);
}
function mountainH(x: any, z: any) : any {
  if (HC.m) { const v: any = hcSample(HC.m, x, z); if (v !== null) return v; }
  return mountainHA(x, z);
}
function inWorld(x: any, z: any) : any { return Math.hypot(x - WORLD.cx, z - WORLD.cz) < WORLD.r; }

// a carve can stop at a height (maxY: whoever walks on the hill above it stays on the hill) and
// can be switched off altogether (when: the barrow stays sealed until its door opens)
function addCarve(pts: any, o: any = {}) : any { const c: any = { pts, maxY: o.maxY, when: o.when }; polyBounds(c, pts); CARVES.push(c); return c; }
function inCarve(x: any, z: any, y: any, always?: any) : any {
  for (const c of CARVES) {
    if (x < c.minx || x > c.maxx || z < c.minz || z > c.maxz) continue;
    if (y !== undefined && c.maxY !== undefined && y > c.maxY) continue;
    if (c.when && !always && !c.when()) continue;
    if (pip(c.pts, x, z)) return true;
  }
  return false;
}

const _wq: any = [], _cq: any = [];
const GROUND: any = { h: 0, blocked: false, water: false, surf: null, under: false };
// ground under (x, z) for something standing at height y. Underground (well below the
// terrain surface) or inside a carved stairwell/cave the terrain is ignored and only
// walkable surfaces count; with nothing to stand on the spot is blocked.
function groundAt(x: any, z: any, y: any, out: any = GROUND) : any {
  const th: any = terrainH(x, z);
  const under: any = y < th - 1.0 || (CARVES.length > 0 && inCarve(x, z, y));
  let best: any = under ? -Infinity : th, blocked: any = false, surf: any = null;
  gridQuery(PHYS.wgrid, x, z, 0, _wq);
  for (const s of _wq) {
    const h: any = walkHeight(s, x, z);
    if (h === null) continue;
    if (h <= y + STEP) { if (h > best) { best = h; surf = s; } }
    else if (h < y + HEADROOM) blocked = true;
  }
  if (best === -Infinity) { best = y; blocked = true; }
  out.h = best; out.blocked = blocked; out.surf = surf; out.under = under;
  out.water = !surf && !under && th < WATER_Y - 0.16;
  return out;
}
function pushOut(p: any, r: any, y0: any, y1: any) : any {
  for (let it: any = 0; it < 3; it++) {
    let moved: any = false;
    gridQuery(PHYS.cgrid, p.x, p.z, r + 0.5, _cq);
    for (const c of _cq) {
      if (c.y1 < y0 || c.y0 > y1 || c.off) continue;
      if (c.t === 1) {
        const dx: any = p.x - c.cx, dz: any = p.z - c.cz, d: any = Math.hypot(dx, dz), m: any = r + c.r;
        if (d < m) {
          if (d > 1e-5) { p.x += (dx / d) * (m - d); p.z += (dz / d) * (m - d); }
          else p.x += m;
          moved = true;
        }
        continue;
      }
      const dx: any = p.x - c.cx, dz: any = p.z - c.cz;
      const lx: any = dx * c.c + dz * c.s, lz: any = -dx * c.s + dz * c.c;
      const qx: any = clamp(lx, -c.hx, c.hx), qz: any = clamp(lz, -c.hz, c.hz);
      let ex: any = lx - qx, ez: any = lz - qz;
      const d2: any = ex * ex + ez * ez;
      if (d2 >= r * r) continue;
      if (d2 > 1e-10) { const d: any = Math.sqrt(d2), k: any = (r - d) / d; ex *= k; ez *= k; }
      else {
        const px: any = c.hx - Math.abs(lx), pz: any = c.hz - Math.abs(lz);
        if (px < pz) { ex = (lx >= 0 ? 1 : -1) * (px + r); ez = 0; } else { ez = (lz >= 0 ? 1 : -1) * (pz + r); ex = 0; }
      }
      p.x += ex * c.c - ez * c.s;
      p.z += ex * c.s + ez * c.c;
      moved = true;
    }
    const wx: any = p.x - WORLD.cx, wz: any = p.z - WORLD.cz, rr: any = Math.hypot(wx, wz);
    if (rr > WORLD.r) { p.x = WORLD.cx + wx * WORLD.r / rr; p.z = WORLD.cz + wz * WORLD.r / rr; }
    if (!moved) break;
  }
}

// character controller: slide along colliders, climb ramps, block steps & water
const _mp: any = { x: 0, z: 0 }, _mg: any = { h: 0, blocked: false, water: false, surf: null, under: false };
function tryMove(ch: any, nx: any, nz: any) : any {
  _mp.x = nx; _mp.z = nz;
  pushOut(_mp, ch.r, ch.y + 0.3, ch.y + 1.55);
  groundAt(_mp.x, _mp.z, ch.y, _mg);
  if (_mg.blocked || _mg.h > ch.y + STEP || _mg.water) return false;
  if (!_mg.surf && !_mg.under) {   // bare hillside: too steep to climb, and the high mountain is off limits
    const rise: any = _mg.h - ch.y;
    if (rise > 0.02 && rise > Math.max(Math.hypot(_mp.x - ch.x, _mp.z - ch.z), 0.01) * 0.95) return false;
    if (mountainH(_mp.x, _mp.z) > 9.5) return false;
  }
  return true;
}
function moveChar(ch: any, dx: any, dz: any, dt: any) : any {
  let ok: any = tryMove(ch, ch.x + dx, ch.z + dz);
  if (!ok && (dx || dz)) ok = tryMove(ch, ch.x + dx, ch.z) || tryMove(ch, ch.x, ch.z + dz);
  if (!ok) { ok = tryMove(ch, ch.x, ch.z); if (!ok) return false; }
  const mvx: any = _mp.x - ch.x, mvz: any = _mp.z - ch.z;
  ch.x = _mp.x; ch.z = _mp.z;
  const h: any = _mg.h;
  if (h >= ch.y - DROP && (ch.vy || 0) >= -0.01) { ch.y = h; ch.vy = 0; }
  else {
    ch.vy = (ch.vy || 0) - 24 * dt;
    ch.y = Math.max(h, ch.y + ch.vy * dt);
    if (ch.y <= h + 1e-4) { ch.y = h; ch.vy = 0; }
  }
  ch.floorSurf = _mg.surf;
  return Math.hypot(mvx, mvz) > 1e-5;
}

// ============================================================================
//  Fade groups: every building is split into groups (walls per side & floor,
//  interior partitions, slabs, furniture, roof). The cutaway system animates
//  their opacity; hidden groups still render into the shadow map.
// ============================================================================
const fadeGroups: any = [];
class FadeGroup {
  [key: string]: any;
  constructor(o: any) {
    Object.assign(this, { name: '', kind: 'static', floor: 0, building: null, plane: null, ghost: 0.14 }, o);
    this.batch = new Batch();
    this.glassBatch = null;
    this.fade = 1; this.target = 1; this.shown = 1;
    this.mat = worldMat();
    this.glassMat = null;
    this.meshes = [];
    this.extra = [];   // animated meshes (doors) sharing this group's materials
    fadeGroups.push(this);
  }
  glass() : any {
    if (!this.glassBatch) {
      this.glassBatch = new Batch();
      this.glassMat = worldMat({ transparent: true, opacity: 0.5, rough: 0.12, depthWrite: false });
    }
    return this.glassBatch;
  }
  build(scene: any) : any {
    if (this.batch.count) {
      const m: any = new THREE.Mesh(this.batch.toGeometry(), this.mat);
      m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
      scene.add(m); this.meshes.push(m);
    }
    if (this.glassBatch && this.glassBatch.count) {
      const m: any = new THREE.Mesh(this.glassBatch.toGeometry(), this.glassMat);
      m.castShadow = false; m.receiveShadow = true; m.renderOrder = 3; m.matrixAutoUpdate = false; m.updateMatrix();
      scene.add(m); this.meshes.push(m);
    }
    this.batch = null; this.glassBatch = null;
  }
  apply() : any {
    const f: any = this.fade;
    for (const m of [this.mat, this.glassMat]) {
      if (!m) continue;
      const tr: any = f < 0.995 || m.userData.baseTransparent;
      if (tr !== m.transparent) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = m.userData.baseOpacity * f;
      m.depthWrite = m === this.mat ? !tr : false;
    }
  }
}

// light emitters (lamps, hearths, candles...) — a fixed pool of real point
// lights is assigned each frame to the most relevant emitters
const emitters: any = [];
function addEmitter(x: any, y: any, z: any, o: any = {}) : any {
  const p: any = B.wp(x, y, z);
  const e: any = {
    p, color: col(o.color ?? 0xffa548).clone(), int: o.int ?? 6, range: o.range ?? 7,
    flick: o.flick ?? 0.12, night: o.night ?? 0, b: o.b || null, f: o.f ?? 0,
    glow: o.glow ?? 1.0, grp: o.grp || null, seed: rnd(0, 100), on: 1, outdoor: !o.b, prio: o.prio || 0,
    ug: o.ug ?? !!CTX.ug, zone: o.zone ?? CTX.zone ?? null, day: o.day ?? 0,
  };
  emitters.push(e);
  return e;
}
