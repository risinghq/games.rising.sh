// ============================================================================
//  Environment: renderer, sky, sun/moon, terrain, water, vegetation
// ============================================================================
const OUT = new Chunked(26);      // outdoor static scenery
const VEG = new Chunked(30);      // trees, bushes, rocks
const CANOPIES = [];              // {x, y, z, c} for falling leaves
const PATHS = [];                 // {w, pts:[[x,z]...]}
const PLAZA = { x: 0, z: 0, r: 9.5 };
const NO_GRASS = [];              // {x, z, r} circles kept clear of grass / trees

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfd9e3, 55, 150);
const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 600);

// ---- lights ----------------------------------------------------------------
const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_TOUCH ? 1536 : 2048, IS_TOUCH ? 1536 : 2048);
const SHADOW_HALF = 26;
Object.assign(sun.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: 160 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xbcd4ee, 0x5b4a32, 1.1);
scene.add(hemi);
const LIGHT_POOL = 7;
const pool = [];
for (let i = 0; i < LIGHT_POOL; i++) {
  const l = new THREE.PointLight(0xffaa55, 0, 8, 2);
  l.userData = { em: null, k: 0 };
  scene.add(l); pool.push(l);
}

// ---- sky dome --------------------------------------------------------------
const skyU = {
  uTop: { value: new THREE.Color(0x5b8fd0) }, uHor: { value: new THREE.Color(0xcfe0ee) }, uBot: { value: new THREE.Color(0x6a7a6a) },
  uSunDir: { value: new V3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0xfff2d0) }, uMoonDir: { value: new V3(0, 1, 0) },
  uNight: SU.uNight, uTime: SU.uTime,
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
  fragmentShader: `varying vec3 vDir; uniform vec3 uTop, uHor, uBot, uSunDir, uSunCol, uMoonDir; uniform float uNight, uTime;
  ${GLSL_NOISE}
  void main(){
    vec3 d = normalize(vDir); float h = d.y;
    vec3 c = mix(uHor, uTop, pow(clamp(h, 0.0, 1.0), 0.55));
    c = mix(c, uBot, smoothstep(0.0, -0.25, h));
    float sd = max(dot(d, normalize(uSunDir)), 0.0);
    c += uSunCol * (pow(sd, 900.0) * 8.0 + pow(sd, 10.0) * 0.28) * (1.0 - uNight);
    float md = max(dot(d, normalize(uMoonDir)), 0.0);
    c += vec3(0.85, 0.9, 1.0) * (smoothstep(0.9993, 0.9996, md) * 1.6 + pow(md, 40.0) * 0.12) * uNight;
    if (h > 0.0) {
      vec2 sp = vec2(atan(d.z, d.x) * 70.0, asin(h) * 90.0);
      vec2 id = floor(sp); float r = h12(id);
      float st = step(0.987, r) * smoothstep(0.35, 0.0, length(fract(sp) - 0.5 - (h22(id) - 0.5) * 0.4));
      st *= 0.6 + 0.4 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
      c += vec3(st) * uNight * smoothstep(0.0, 0.25, h) * 1.4;
      float cl = fbm3(d.xz / (h + 0.25) * 2.2 + vec2(uTime * 0.004, 0.0));
      c = mix(c, mix(uHor * 1.08, vec3(0.08, 0.1, 0.16), uNight), smoothstep(0.55, 0.85, cl) * 0.5 * smoothstep(0.0, 0.3, h));
    }
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`,
}));
sky.renderOrder = -10;
sky.frustumCulled = false;
scene.add(sky);

// ---- paths & ground colour ---------------------------------------------------
function pathInfo(x, z) {
  let m = 0;
  for (const p of PATHS) {
    if (x < p.minx || x > p.maxx || z < p.minz || z > p.maxz) continue;
    for (let i = 0; i < p.pts.length - 1; i++) {
      const d = segDist(x, z, p.pts[i], p.pts[i + 1]);
      m = Math.max(m, 1 - sstep(p.w / 2 - 0.55, p.w / 2 + 0.5, d));
    }
  }
  return m;
}
function addPath(w, pts) {
  const p = { w, pts };
  polyBounds(p, pts);
  p.minx -= w + 2; p.maxx += w + 2; p.minz -= w + 2; p.maxz += w + 2;
  PATHS.push(p);
}
const GC = {
  lush: col(0x5a8a34), dry: col(0x8d9a43), gold: col(0xb39a45), forest: col(0x3f5f2a),
  dirt: col(0x9b7b52), dirtDark: col(0x6e5638), mud: col(0x6f6142), sand: col(0xa48f66),
  rock: col(0x8a847b), rockDark: col(0x5f5a53), rockWarm: col(0x94806a), moss: col(0x617238), scree: col(0xa29b8f), snow: col(0xe9edf2),
  farm: col(0x6c9236), fen: col(0x4a6230), fenMud: col(0x4c4430), reed: col(0x9a8a4a), downs: col(0x9aa64e), chalk: col(0xcfc6a8),
  gloam: col(0x2a3a22), gloamLeaf: col(0x4a3426), gloamPurple: col(0x372d42), stubble: col(0xc6ae66), stubbleDark: col(0x9c8648),
};
function slopeAt(x, z, e = 0.6) {
  const dx = terrainH(x + e, z) - terrainH(x - e, z), dz = terrainH(x, z + e) - terrainH(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}
// 0 = grass, 1 = bare rock (cliffs, the mountain, the cave mouth)
function rockiness(x, z, slope) {
  const mt = mountainH(x, z);
  if (mt < 0.05 && slope < 0.9) return 0;
  return clamp(sstep(0.5, 0.95, slope) * sstep(0.05, 1.2, mt) + sstep(1.1, 1.8, slope) + sstep(9, 22, mt) * 0.55 * sstep(0.2, 0.5, slope), 0, 1);
}
function inMouth(x, z) { return Math.abs(x - MOUTH.x) < 3.4 && z < MOUTH.z + 1.4 && z > MOUTH.z - 4.6; }
const _gcT = new THREE.Color();
function groundColor(x, z, h, pm, slope = slopeAt(x, z)) {
  const n1 = fbm2(x * 0.045, z * 0.045), n2 = fbm2(x * 0.18 + 7, z * 0.18 - 3);
  const c = GC.lush.clone().lerp(GC.dry, sstep(0.42, 0.72, n1));
  c.lerp(GC.gold, sstep(0.55, 0.85, n2) * 0.55);
  const r = Math.hypot(x, z);
  let wfn = 0;
  if (r > 48) {
    // the far country takes on the colours of its region
    const wf = wFields(x, z), wd = wDowns(x, z), wg = wGloam(x, z);
    wfn = wFen(x, z);
    if (wf > 0) c.lerp(_gcT.copy(GC.farm).lerp(GC.gold, sstep(0.5, 0.8, n1) * 0.55), wf * 0.55);
    if (wd > 0) c.lerp(_gcT.copy(GC.downs).lerp(GC.gold, sstep(0.45, 0.75, n2) * 0.5), wd * 0.8);
    if (wg > 0) c.lerp(_gcT.copy(GC.gloam).lerp(GC.gloamPurple, sstep(0.45, 0.75, n1)).lerp(GC.gloamLeaf, sstep(0.55, 0.8, n2) * 0.6), wg * 0.9);
    if (wfn > 0) c.lerp(_gcT.copy(GC.fen).lerp(GC.reed, sstep(0.55, 0.8, n2) * 0.5), wfn * 0.85);
    const lf = longFieldK(x, z);
    if (lf > 0) c.lerp(Math.sin((x + z * 0.12) * 1.7) > 0 ? GC.stubble : GC.stubbleDark, lf * 0.9);
    const rw = Math.hypot(x - WORLD.cx, z - WORLD.cz);
    c.lerp(GC.forest, sstep(140, 165, rw) * 0.55);
  }
  if (h < 0.15) c.lerp(wfn > 0.3 ? GC.fenMud : GC.sand, sstep(0.15, -0.35, h));
  if (h < -0.35) c.lerp(GC.mud, sstep(-0.35, -1.0, h));
  if (pm > 0) {
    const chalkK = wDowns(x, z);
    c.lerp(n2 > 0.5 ? GC.dirt : _gcT.copy(GC.dirtDark).lerp(GC.dirt, 0.6), pm * 0.92 * (1 - chalkK * 0.5));
    if (chalkK > 0) c.lerp(GC.chalk, pm * chalkK * 0.8);
  }
  const pdd = Math.hypot(x - PLAZA.x, z - PLAZA.z);
  if (pdd < PLAZA.r + 1.5) c.lerp(GC.dirtDark, sstep(PLAZA.r + 1.5, PLAZA.r, pdd));
  // the mountain: scree at the foot, banded rock faces, mossy ledges, a dusting of snow up high
  const mt = mountainH(x, z);
  if (mt > 0.02 || slope > 0.9) {
    const rk = rockiness(x, z, slope), n3 = fbm2(x * 0.3 + 2, z * 0.3 - 5, 2);
    const rc = GC.rock.clone().lerp(GC.rockWarm, sstep(0.35, 0.7, n2)).lerp(GC.rockDark, sstep(0.45, 0.8, n3) * 0.6 + sstep(1.2, 2.2, slope) * 0.3);
    rc.multiplyScalar(0.86 + 0.28 * ((Math.sin(h * 2.3 + n1 * 6) * 0.5 + 0.5)));   // strata
    if (mt > 0.3 && mt < 6 && slope < 0.75) c.lerp(GC.scree, sstep(0.3, 1.5, mt) * (1 - sstep(3, 6, mt)) * 0.7);
    if (mt > 4 && slope < 0.5) c.lerp(GC.moss, 0.35);
    c.lerp(rc, rk);
    if (h > 33 && slope < 0.75) c.lerp(GC.snow, sstep(33, 40, h) * (1 - sstep(0.45, 0.75, slope)));
  }
  if (inMouth(x, z)) c.multiplyScalar(lerp(1, 0.22, sstep(MOUTH.z + 1.4, MOUTH.z - 1.2, z) * (1 - sstep(2.0, 3.4, Math.abs(x - MOUTH.x)))));
  return c;
}

// ---- the ground: one mesh per tile so the far country frustum-culls --------------------------------
let heightTex = null;
const TERRAIN = [];
function buildTerrain() {
  const { x0, z0, st, nx, nz, h: H, m: MT } = HC, N = nx * nz;
  const nor = new Float32Array(N * 3), colA = new Float32Array(N * 3), pdA = new Float32Array(N * 4), hv = Float32Array.from(H);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = x0 + i * st, z = z0 + j * st;
    const gx = (H[j * nx + Math.min(nx - 1, i + 1)] - H[j * nx + Math.max(0, i - 1)]) / (2 * st);
    const gz = (H[Math.min(nz - 1, j + 1) * nx + i] - H[Math.max(0, j - 1) * nx + i]) / (2 * st);
    const il = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
    nor[k * 3] = -gx * il; nor[k * 3 + 1] = il; nor[k * 3 + 2] = -gz * il;
    const slope = Math.hypot(gx, gz), wx = x - WORLD.cx, wz = z - WORLD.cz;
    if (wx * wx + wz * wz > (WORLD.r + 46) ** 2) continue;   // never seen
    const pm = pathInfo(x, z);
    hv[k] = H[k] - pm * 0.03;
    const c = groundColor(x, z, H[k], pm, slope);
    colA[k * 3] = c.r; colA[k * 3 + 1] = c.g; colA[k * 3 + 2] = c.b;
    pdA[k * 4] = rockiness(x, z, slope) > 0.5 ? PAT.ROCK : PAT.GROUND;
    pdA[k * 4 + 2] = MT[k] > 1.5 ? 1 : 0;   // the mountain can be seen through around the player
  }
  const mat = worldMat({ rough: 0.96 }), T = Math.round(48 / st);
  for (let tj = 0; tj < nz - 1; tj += T) for (let ti = 0; ti < nx - 1; ti += T) {
    const i1 = Math.min(nx - 1, ti + T), j1 = Math.min(nz - 1, tj + T), w = i1 - ti + 1, d = j1 - tj + 1;
    const cx = x0 + (ti + i1) / 2 * st - WORLD.cx, cz = z0 + (tj + j1) / 2 * st - WORLD.cz;
    if (Math.hypot(cx, cz) - T * st * 0.71 > WORLD.r + 44) continue;
    const pos = new Float32Array(w * d * 3), nr = new Float32Array(w * d * 3), cl = new Float32Array(w * d * 3), uv = new Float32Array(w * d * 2), pd = new Float32Array(w * d * 4);
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) {
      const k = (tj + j) * nx + ti + i, q = j * w + i, x = x0 + (ti + i) * st, z = z0 + (tj + j) * st;
      pos[q * 3] = x; pos[q * 3 + 1] = hv[k]; pos[q * 3 + 2] = z;
      nr.set(nor.subarray(k * 3, k * 3 + 3), q * 3); cl.set(colA.subarray(k * 3, k * 3 + 3), q * 3); pd.set(pdA.subarray(k * 4, k * 4 + 4), q * 4);
      uv[q * 2] = x; uv[q * 2 + 1] = z;
    }
    const idx = new Uint32Array((w - 1) * (d - 1) * 6);
    let n = 0;
    for (let j = 0; j < d - 1; j++) for (let i = 0; i < w - 1; i++) {
      const a = j * w + i, b = a + 1, c = a + w, e = c + 1;
      idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = b; idx[n++] = c; idx[n++] = e;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nr, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cl, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('pd', new THREE.BufferAttribute(pd, 4));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
    m.userData.tile = { ti, tj, w, d };
    scene.add(m); TERRAIN.push(m);
  }
  // heightmap for the water shader (depth below the surface gives colour, foam and clarity)
  const HN = 512, data = new Uint8Array(HN * HN * 4);
  for (let j = 0; j < HN; j++) for (let i = 0; i < HN; i++) {
    const x = HC.x0 + (i + 0.5) * ((HC.x1 - HC.x0) / HN), z = HC.z0 + (j + 0.5) * ((HC.z1 - HC.z0) / HN);
    data[(j * HN + i) * 4] = clamp((terrainH(x, z) + 3) / 4, 0, 1) * 255; data[(j * HN + i) * 4 + 3] = 255;
  }
  heightTex = new THREE.DataTexture(data, HN, HN, THREE.RGBAFormat);
  heightTex.magFilter = THREE.LinearFilter; heightTex.minFilter = THREE.LinearFilter;
  heightTex.needsUpdate = true;
}

// re-bake and re-colour a patch of ground (custom areas level ground and lay paths), then regrow its grass
function terrainRefresh(x0, x1, z0, z1, rebake = true, noGrass = false) {
  const { x0: X0, z0: Z0, st, nx, nz } = HC, H = HC.h, MT = HC.m;
  if (!H) return;
  const i0 = clamp(Math.floor((x0 - X0) / st) - 1, 0, nx - 1), i1 = clamp(Math.ceil((x1 - X0) / st) + 1, 0, nx - 1);
  const j0 = clamp(Math.floor((z0 - Z0) / st) - 1, 0, nz - 1), j1 = clamp(Math.ceil((z1 - Z0) / st) + 1, 0, nz - 1);
  if (rebake) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) H[j * nx + i] = terrainHA(X0 + i * st, Z0 + j * st);
  const R2 = (WORLD.r + 46) ** 2;
  for (const m of TERRAIN) {
    const T = m.userData.tile; if (!T) continue;
    if (T.ti + T.w - 1 < i0 || T.ti > i1 || T.tj + T.d - 1 < j0 || T.tj > j1) continue;
    const g = m.geometry, A = g.attributes, P = A.position.array, Nn = A.normal.array, C = A.color.array, PD = A.pd.array;
    for (let j = Math.max(j0, T.tj); j <= Math.min(j1, T.tj + T.d - 1); j++) for (let i = Math.max(i0, T.ti); i <= Math.min(i1, T.ti + T.w - 1); i++) {
      const k = j * nx + i, q = (j - T.tj) * T.w + (i - T.ti), x = X0 + i * st, z = Z0 + j * st;
      const gx = (H[j * nx + Math.min(nx - 1, i + 1)] - H[j * nx + Math.max(0, i - 1)]) / (2 * st);
      const gz = (H[Math.min(nz - 1, j + 1) * nx + i] - H[Math.max(0, j - 1) * nx + i]) / (2 * st);
      const il = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
      Nn[q * 3] = -gx * il; Nn[q * 3 + 1] = il; Nn[q * 3 + 2] = -gz * il;
      if ((x - WORLD.cx) ** 2 + (z - WORLD.cz) ** 2 > R2) { P[q * 3 + 1] = H[k]; continue; }
      const pm = pathInfo(x, z), slope = Math.hypot(gx, gz);
      P[q * 3 + 1] = H[k] - pm * 0.03;
      const c = groundColor(x, z, H[k], pm, slope);
      C[q * 3] = c.r; C[q * 3 + 1] = c.g; C[q * 3 + 2] = c.b;
      PD[q * 4] = rockiness(x, z, slope) > 0.5 ? PAT.ROCK : PAT.GROUND;
      PD[q * 4 + 2] = MT[k] > 1.5 ? 1 : 0;
    }
    A.position.needsUpdate = A.normal.needsUpdate = A.color.needsUpdate = A.pd.needsUpdate = true;
    g.computeBoundingSphere(); g.computeBoundingBox();
  }
  // the water shader's depth map
  if (heightTex && rebake) {
    const HN = heightTex.image.width, data = heightTex.image.data, sx = (HC.x1 - HC.x0) / HN, sz = (HC.z1 - HC.z0) / HN;
    const a0 = clamp(Math.floor((x0 - HC.x0) / sx) - 1, 0, HN - 1), a1 = clamp(Math.ceil((x1 - HC.x0) / sx) + 1, 0, HN - 1);
    const b0 = clamp(Math.floor((z0 - HC.z0) / sz) - 1, 0, HN - 1), b1 = clamp(Math.ceil((z1 - HC.z0) / sz) + 1, 0, HN - 1);
    for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) data[(j * HN + i) * 4] = clamp((terrainH(HC.x0 + (i + 0.5) * sx, HC.z0 + (j + 0.5) * sz) + 3) / 4, 0, 1) * 255;
    heightTex.needsUpdate = true;
  }
  if (!noGrass) refreshGrass(x0, x1, z0, z1);
}

// ---- water ------------------------------------------------------------------
const waterU = { uSky: { value: new THREE.Color(0x9cc4e4) } };
function makeWater(flatDepth, ug = false) {
  const m = new THREE.MeshStandardMaterial({ color: 0x2a6f7d, roughness: 0.1, metalness: 0, transparent: true, opacity: 1, depthWrite: false });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = SU.uTime; sh.uniforms.uSky = waterU.uSky; sh.uniforms.uHeight = { value: heightTex }; sh.uniforms.uSurfY = SU.uSurfY;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWp; uniform float uTime; uniform vec3 uSky; uniform sampler2D uHeight; uniform float uSurfY;
${GLSL_NOISE}
float wv(vec2 p, float t){ return vn2(p + vec2(t * 0.35, t * 0.2)) * 0.6 + vn2(p * 2.3 - vec2(t * 0.5, -t * 0.3)) * 0.4; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
${ug ? '' : 'if (vWp.y > uSurfY) discard;'}
float depth = ${flatDepth ? flatDepth.toFixed(2) : `clamp(${WATER_Y.toFixed(2)} - (texture2D(uHeight, (vWp.xz - vec2(${HC.x0.toFixed(1)}, ${HC.z0.toFixed(1)})) / vec2(${(HC.x1 - HC.x0).toFixed(1)}, ${(HC.z1 - HC.z0).toFixed(1)})).r * 4.0 - 3.0), 0.0, 3.0)`};
diffuseColor.rgb = mix(vec3(0.17, 0.42, 0.38), vec3(0.03, 0.13, 0.17), smoothstep(0.0, 1.3, depth));
float foam = (1.0 - smoothstep(0.0, 0.16, depth)) * (0.55 + 0.45 * vn2(vWp.xz * 3.0 + uTime * 0.5));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.92, 0.9), foam * 0.75);
diffuseColor.a = clamp(mix(0.42, 0.93, smoothstep(0.0, 0.9, depth)) + foam * 0.3, 0.0, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec2 p = vWp.xz * 0.7; float e = 0.06; float h0 = wv(p, uTime), hx = wv(p + vec2(e, 0.0), uTime), hz = wv(p + vec2(0.0, e), uTime);
  vec3 nW = normalize(vec3(-(hx - h0) / e * 0.28, 1.0, -(hz - h0) / e * 0.28));
  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0); totalEmissiveRadiance += uSky * fr * 0.55; }`);
  };
  m.customProgramCacheKey = () => 'water' + (flatDepth || 0) + (ug ? 'u' : '');
  return m;
}
function buildWater() {
  const g = new THREE.PlaneGeometry(HC.x1 - HC.x0, HC.z1 - HC.z0, 1, 1); g.rotateX(-PI / 2); g.translate((HC.x0 + HC.x1) / 2, 0, (HC.z0 + HC.z1) / 2);
  const m = new THREE.Mesh(g, makeWater(0));
  m.position.y = WATER_Y; m.receiveShadow = true; m.renderOrder = 1;
  scene.add(m);
}

// ---- vegetation ---------------------------------------------------------------
// Every tree, bush and rock of the base world is remembered (where its triangles went, its collider,
// its falling-leaf canopy) so a custom area can clear the ground it is built on.
const BASEVEG = [];
function trackVeg(x, z, r, fn) {
  const prev = EMIT_TRACK, c0 = PHYS.cols.length, k0 = CANOPIES.length;
  EMIT_TRACK = [];
  try { fn(); }
  finally { BASEVEG.push({ x, z, r, recs: EMIT_TRACK, cols: PHYS.cols.slice(c0), canopies: CANOPIES.slice(k0), hid: 0 }); EMIT_TRACK = prev; }
}
const _vegM = new THREE.Matrix4(), _vegZ = new THREE.Matrix4().makeScale(0, 0, 0);
function vegShow(v, on) {
  if (on ? --v.hid > 0 : v.hid++ > 0) return;   // reference counted: several clearings can overlap
  for (const c of v.cols) c.off = !on;
  for (const k of v.canopies) { const i = CANOPIES.indexOf(k); if (on && i < 0) CANOPIES.push(k); if (!on && i >= 0) CANOPIES.splice(i, 1); }
  if (v.inst) {   // an instanced plant
    const { mesh, i } = v.inst; if (!mesh) return;
    if (!on) { mesh.getMatrixAt(i, _vegM); v.saved = _vegM.clone(); mesh.setMatrixAt(i, _vegZ); }
    else if (v.saved) mesh.setMatrixAt(i, v.saved);
    mesh.instanceMatrix.needsUpdate = true;
    return;
  }
  for (const [b, start, n] of v.recs) {
    const m = b.mesh; if (!m) continue;
    const pa = m.geometry.attributes.position, arr = pa.array, o = start * 3;
    if (!on) {
      (v.saved || (v.saved = new Map())).set(b, arr.slice(o, o + n * 3));
      for (let k = 1; k < n; k++) { arr[o + k * 3] = arr[o]; arr[o + k * 3 + 1] = arr[o + 1]; arr[o + k * 3 + 2] = arr[o + 2]; }
    } else { const sv = v.saved && v.saved.get(b); if (sv) arr.set(sv, o); }
    pa.needsUpdate = true;
  }
}
const AUTUMN = [0xd4752a, 0xc8462a, 0xe0a33a, 0xb85a26, 0xd9902e];
const GREENS = [0x4f7f33, 0x5f8c38, 0x3f6e2e, 0x6b8f3a];
function tree(x, z, type = 'oak', s = 1, o = {}) { trackVeg(x, z, (type === 'pine' ? 1.5 : 1.4) * s, () => treeRaw(x, z, type, s, o)); }
function treeRaw(x, z, type = 'oak', s = 1, o = {}) {
  const y = o.y ?? terrainH(x, z);
  B.reset(); B.to(VEG); B.occ = 1;
  B.push(x, y - 0.05, z, rnd(0, TAU));
  const trunkC = type === 'birch' ? 0xd9d4c6 : vary(0x5e4532, 0.1);
  if (type === 'pine') {
    cyl(0, 0, 0, 0.14 * s, 0.24 * s, 2.2 * s, 6, trunkC, PAT.BARK);
    const gc = vary(pick([0x2f5a34, 0x355f37, 0x2a4f30]), 0.08);
    for (let i = 0; i < 4; i++) {
      const yy = (1.0 + i * 1.05) * s, r = (1.9 - i * 0.38) * s;
      cyl(0, yy, 0, 0, r, 1.9 * s, 7, shade(gc, 1 + i * 0.06), PAT.LEAF, { sway: 0.45 + i * 0.25, swayH: 1, r0: i * 0.4 });
    }
    CANOPIES.push({ x, y: y + 3 * s, z, c: 0x3a6a3a, r: 1.5 * s, pine: 1 });
    colCirc(0, 0, 0.3 * s, -1, 3);
    B.pop();
    return;
  }
  const h = (type === 'birch' ? 3.0 : type === 'apple' ? 1.6 : 2.3) * s;
  cyl(0, 0, 0, 0.17 * s * (type === 'birch' ? 0.7 : 1), 0.3 * s * (type === 'birch' ? 0.7 : 1), h, 7, trunkC, PAT.BARK);
  if (type === 'birch') for (let i = 0; i < 4; i++) box(0, rnd(0.4, h - 0.3), 0, 0.26 * s, 0.05, 0.26 * s, 0x2a2a28, 0, { ry: rnd(0, 3) });
  for (let i = 0; i < 3; i++) {
    const a = rnd(0, TAU), tl = rnd(0.7, 1.1) * s;
    cyl(0, h * rnd(0.55, 0.8), 0, 0.05 * s, 0.1 * s, tl, 5, trunkC, PAT.BARK, { ry: a, rz: 0.9 });
  }
  let palette;
  if (type === 'maple') palette = [pick(AUTUMN)];
  else if (type === 'birch') palette = [0xe0b23a, 0xd8a030, 0xc8b040];
  else if (type === 'apple') palette = [0x5f8c38];
  else palette = R() < 0.35 ? [pick(GREENS), pick(AUTUMN)] : [pick(GREENS)];
  const n = type === 'birch' ? 4 : 5;
  const cr = (type === 'birch' ? 0.95 : type === 'apple' ? 1.1 : 1.35) * s;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd(-0.4, 0.4), d = i === 0 ? 0 : cr * rnd(0.6, 0.85);
    const yy = h + cr * (i === 0 ? 0.55 : rnd(0.0, 0.45));
    const c = vary(pick(palette), 0.1);
    sph(Math.cos(a) * d, yy, Math.sin(a) * d, cr * (i === 0 ? 1.15 : rnd(0.8, 1.0)), c, PAT.LEAF, { det: 1, jit: 0.18, sway: 0.7, sy: type === 'birch' ? 1.25 : 0.9 });
    if (i === 0) CANOPIES.push({ x, y: y + yy, z, c: palette[0], r: cr * 1.2 });
  }
  if (type === 'apple') for (let i = 0; i < 9; i++) {
    const a = rnd(0, TAU), el = rnd(-0.2, 0.9);
    ball(Math.cos(a) * cr * 1.05 * Math.cos(el), h + cr * 0.5 + Math.sin(el) * cr, Math.sin(a) * cr * 1.05 * Math.cos(el), 0.08, 0xc4302a, 0, { sway: 0.7, ws: 6, hs: 4 });
  }
  colCirc(0, 0, 0.32 * s, -1, 3);
  B.pop();
}
function bush(x, z, s = 1, c) { trackVeg(x, z, 0.8 * s, () => bushRaw(x, z, s, c)); }
function bushRaw(x, z, s = 1, c) {
  const y = terrainH(x, z);
  B.reset(); B.to(VEG); B.occ = 0;
  const cc = c ?? vary(pick([0x4a7a32, 0x5a8a36, 0x6a8a3a, 0x8a7a32]), 0.1);
  for (let i = 0; i < 3; i++) sph(x + rnd(-0.4, 0.4) * s, y + 0.35 * s, z + rnd(-0.4, 0.4) * s, rnd(0.45, 0.65) * s, vary(cc, 0.08), PAT.LEAF, { det: 1, jit: 0.2, sway: 0.25, sy: 0.75 });
  if (R() < 0.3) for (let i = 0; i < 5; i++) ball(x + rnd(-0.5, 0.5) * s, y + rnd(0.4, 0.7) * s, z + rnd(-0.5, 0.5) * s, 0.05, pick([0xc8302a, 0xe8e0f0, 0x9b5ad8]), 0, { ws: 5, hs: 4 });
  B.occ = 1;
}
function rock(x, z, s = 1) { trackVeg(x, z, 0.7 * s, () => rockRaw(x, z, s)); }
function rockRaw(x, z, s = 1) {
  const y = terrainH(x, z);
  B.reset(); B.to(VEG);
  sph(x, y + 0.1 * s, z, 0.6 * s, vary(0x8a8a84, 0.12), PAT.ROCK, { det: 0, jit: 0.3, sy: 0.6, ry: rnd(0, 3) });
  if (s > 0.8) addCircW(x, z, 0.5 * s, y - 1, y + 1);
}
function reeds(x, z, n = 6) {
  const y = terrainH(x, z);
  B.reset(); B.to(VEG); B.occ = 0;
  for (let i = 0; i < n; i++) {
    const px = x + rnd(-0.6, 0.6), pz = z + rnd(-0.6, 0.6), h = rnd(0.9, 1.6);
    cyl(px, Math.max(y, WATER_Y - 0.3), pz, 0.012, 0.02, h, 4, 0x6a7a3a, 0, { sway: 0.6, swayH: 1, rx: rnd(-0.1, 0.1), rz: rnd(-0.1, 0.1) });
    if (R() < 0.6) cyl(px, Math.max(y, WATER_Y - 0.3) + h * 0.75, pz, 0.035, 0.035, 0.2, 5, 0x5a3a22, 0, { sway: 0.6 });
  }
  B.occ = 1;
}

// grass & flowers as instanced, wind-swayed clumps
function grassGeometry(h = 0.5, blades = 6, dark = 0x3f6a2a, tip = 0x9cbf55) {
  const b = new Batch();
  B.reset(); B.to(b);
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * TAU + rnd(-0.3, 0.3), r = rnd(0.02, 0.12), hh = h * rnd(0.6, 1.1), w = 0.035;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r, lean = rnd(0.05, 0.18);
    const tx = bx + Math.cos(a) * lean, tz = bz + Math.sin(a) * lean;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    const P = b.P, Nn = b.N, C = b.C, U = b.U, D = b.D;
    const verts = [[bx - px, 0, bz - pz, 0], [bx + px, 0, bz + pz, 0], [tx, hh, tz, 1]];
    for (const [vx, vy, vz, s] of verts) {
      P.push(vx, vy, vz); Nn.push(0, 1, 0);
      const c = col(dark).clone().lerp(col(tip), s);
      C.push(c.r, c.g, c.b); U.push(0, 0); D.push(0, s, 0, 0);
    }
    for (const [vx, vy, vz, s] of [verts[0], verts[2], verts[1]]) {
      P.push(vx, vy, vz); Nn.push(0, 1, 0);
      const c = col(dark).clone().lerp(col(tip), s);
      C.push(c.r, c.g, c.b); U.push(0, 0); D.push(0, s, 0, 0);
    }
  }
  return b.toGeometry();
}
let _bbx = null;
function inBuilding(x, z) {
  if (!_bbx || _bbx.n !== BUILDINGS.length) _bbx = { n: BUILDINGS.length, list: BUILDINGS.filter(b => b.footprint).map(b => { const o = { fp: b.footprint }; polyBounds(o, b.footprint); return o; }) };
  for (const o of _bbx.list) if (x >= o.minx && x <= o.maxx && z >= o.minz && z <= o.maxz && pip(o.fp, x, z)) return true;
  return false;
}
function grassBlocked(x, z) {
  if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 0.3) return true;
  if (!inWorld(x, z)) return true;
  if (pathInfo(x, z) > 0.35) return true;
  if (terrainH(x, z) < WATER_Y + 0.05) return true;
  if (mountainH(x, z) > 0.2 && rockiness(x, z, slopeAt(x, z)) > 0.35) return true;
  if (inMouth(x, z) || longFieldK(x, z) > 0.4) return true;
  if (inBuilding(x, z)) return true;
  for (const c of NO_GRASS) if (Math.abs(x - c.x) < c.r && Math.abs(z - c.z) < c.r && Math.hypot(x - c.x, z - c.z) < c.r) return true;
  return false;
}
// how thick the grass grows, and what colour it takes, across the regions
function grassDensity(x, z) {
  const r = Math.hypot(x, z);
  let d = r < 60 ? 1.0 : lerp(1.0, 0.5, sstep(60, 80, r));
  if (r > 50) { d = lerp(d, 0.42, wFields(x, z)); d = lerp(d, 0.8, wDowns(x, z)); d = lerp(d, 0.16, wGloam(x, z)); d = lerp(d, 0.7, wFen(x, z)); }
  return d;
}
const GRASS_TINT = { fields: col(0xd8c070), downs: col(0xe0c878), gloam: col(0x6a6688), fen: col(0x9aa060) };
function grassTint(x, z, c) {
  const g = fbm2(x * 0.045, z * 0.045);
  c.setRGB(1, 1, 1).lerp(col(0xd8c070), sstep(0.45, 0.8, g) * 0.6);
  if (Math.hypot(x, z) > 50) {
    const wf = wFields(x, z), wd = wDowns(x, z), wg = wGloam(x, z), wfn = wFen(x, z);
    if (wf > 0) c.lerp(GRASS_TINT.fields, wf * 0.45);
    if (wd > 0) c.lerp(GRASS_TINT.downs, wd * 0.6);
    if (wg > 0) c.lerp(GRASS_TINT.gloam, wg * 0.75);
    if (wfn > 0) c.lerp(GRASS_TINT.fen, wfn * 0.6);
  }
  return c.multiplyScalar(rnd(0.85, 1.1));
}
// grass & flowers in 32 m tiles of instanced clumps (each tile frustum-culls on its own, and can be regrown)
const _gm4 = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gs = new V3(), _gp = new V3(), _gc = new THREE.Color();
function grassTile(tx, tz) {
  const TS = 32, geo = GRASS.geo, mat = GRASS.mat, scale = GRASS.scale;
  const m4 = _gm4, q = _gq, s = _gs, p = _gp, c = _gc;
  {
    const cx = tx + TS / 2, cz = tz + TS / 2;
    if (Math.hypot(cx - WORLD.cx, cz - WORLD.cz) - TS * 0.71 > WORLD.r) return null;
    let dsum = 0; for (const [ox, oz] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0.5]]) dsum += grassDensity(tx + ox * TS, tz + oz * TS);
    const want = Math.round(TS * TS * (dsum / 5) * 1.05 * scale);
    if (want < 8) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, want);
    let n = 0, tries = 0;
    while (n < want && tries < want * 3) {
      tries++;
      const x = tx + R() * TS, z = tz + R() * TS;
      if (R() > grassDensity(x, z)) continue;
      if (grassBlocked(x, z)) continue;
      const dens = fbm2(x * 0.08 + 11, z * 0.08 - 4);
      if (dens < 0.38 && R() < 0.7) continue;
      p.set(x, terrainH(x, z) - 0.02, z);
      q.setFromAxisAngle(UPV, rnd(0, TAU));
      const k = rnd(0.7, 1.35) * (0.8 + dens * 0.5) * (wFen(x, z) > 0.5 ? 1.35 : 1);
      s.set(k, k * rnd(0.8, 1.3), k);
      m4.compose(p, q, s);
      mesh.setMatrixAt(n, m4);
      mesh.setColorAt(n, grassTint(x, z, c));
      n++;
    }
    if (!n) { mesh.dispose(); return null; }
    mesh.count = n;
    mesh.receiveShadow = true; mesh.castShadow = false;
    mesh.computeBoundingSphere();
    return mesh;
  }
}
function flowerBlock(tx, tz) {
  const FS = 96, fg = GRASS.fgeo, fmat = GRASS.fmat;
  const m4 = _gm4, q = _gq, s = _gs, p = _gp, c = _gc;
  {
    const fl = new THREE.InstancedMesh(fg, fmat, 700);
    let nf = 0;
    for (let patch = 0; patch < 26 && nf < 700; patch++) {
      const cx = tx + R() * FS, cz = tz + R() * FS;
      if (grassBlocked(cx, cz)) continue;
      const r0 = Math.hypot(cx, cz);
      if (r0 < 8) continue;
      const wd = wDowns(cx, cz), wfn = wFen(cx, cz), wg = wGloam(cx, cz), wf = wFields(cx, cz);
      if (wg > 0.5 && R() < 0.7) continue;
      const fcol = wd > 0.5 ? pick([0x9a5ab8, 0xb87ad0, 0xf2e8c0]) : wfn > 0.5 ? pick([0xf2c94a, 0xf0e070, 0xf4f0e8]) : wf > 0.5 ? pick([0xd8433a, 0xc8302a, 0xf2c94a]) : wg > 0.5 ? 0x6ad8ff : pick([0xe8e2f4, 0xf2c94a, 0xd8433a, 0x9b6ad8, 0xf09ab8, 0xffffff]);
      for (let i = 0; i < 14 && nf < 700; i++) {
        const x = cx + rnd(-1.6, 1.6), z = cz + rnd(-1.6, 1.6);
        if (grassBlocked(x, z)) continue;
        p.set(x, terrainH(x, z), z); q.setFromAxisAngle(UPV, rnd(0, TAU)); const k = rnd(0.8, 1.3); s.set(k, k * rnd(0.7, 1.3), k);
        m4.compose(p, q, s); fl.setMatrixAt(nf, m4); c.set(fcol).multiplyScalar(rnd(0.85, 1.1)); fl.setColorAt(nf, c); nf++;
      }
    }
    if (!nf) { fl.dispose(); return null; }
    fl.count = nf; fl.receiveShadow = true; fl.computeBoundingSphere();
    return fl;
  }
}
const GRASS = { n: 0, tiles: 0, scale: 1, geo: null, mat: null, fgeo: null, fmat: null, map: new Map(), fmap: new Map() };
function buildGrass(scale = 1) {
  GRASS.scale = scale; GRASS.geo = grassGeometry(); GRASS.mat = worldMat({ rough: 1 });
  const TS = 32, FS = 96;
  let total = 0;
  for (let tz = HC.z0; tz < HC.z1; tz += TS) for (let tx = HC.x0; tx < HC.x1; tx += TS) {
    const m = grassTile(tx, tz);
    if (m) { scene.add(m); GRASS.map.set(tx + ',' + tz, m); total += m.count; }
  }
  // flowers: a few patches per 96 m block, in each region's own colours
  const fg = new THREE.IcosahedronGeometry(0.06, 0).toNonIndexed();
  fg.translate(0, 0.32, 0);
  const fp = new Float32Array(fg.attributes.position.count * 4);
  for (let i = 0; i < fg.attributes.position.count; i++) fp[i * 4 + 1] = 0.8;
  fg.setAttribute('pd', new THREE.BufferAttribute(fp, 4));
  fg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(fg.attributes.position.count * 3).fill(1), 3));
  fg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(fg.attributes.position.count * 2), 2));
  GRASS.fgeo = fg; GRASS.fmat = worldMat();
  for (let tz = HC.z0; tz < HC.z1; tz += FS) for (let tx = HC.x0; tx < HC.x1; tx += FS) {
    const f = flowerBlock(tx, tz);
    if (f) { scene.add(f); GRASS.fmap.set(tx + ',' + tz, f); }
  }
  GRASS.n = total; GRASS.tiles = GRASS.map.size;
}
// regrow the grass and flowers over a patch of ground (each tile from its own seed, so the rest stays put)
function refreshGrass(x0, x1, z0, z1) {
  if (!GRASS.geo) return;
  _bbx = null;
  const redo = (map, S, make) => {
    for (let tz = HC.z0; tz < HC.z1; tz += S) for (let tx = HC.x0; tx < HC.x1; tx += S) {
      if (tx > x1 || tx + S < x0 || tz > z1 || tz + S < z0) continue;
      const k = tx + ',' + tz, old = map.get(k);
      if (old) { scene.remove(old); const si = SURF.indexOf(old); if (si >= 0) SURF.splice(si, 1); old.dispose(); map.delete(k); }
      const saved = R; R = makeRng(((tx + 1000) * 7919 + (tz + 1000) * 104729 + S) >>> 0);
      let m = null; try { m = make(tx, tz); } finally { R = saved; }
      if (m) { m.visible = !UG.surfHidden; scene.add(m); SURF.push(m); map.set(k, m); }
    }
  };
  redo(GRASS.map, 32, grassTile);
  redo(GRASS.fmap, 96, flowerBlock);
}
function buildWheat(cx, cz, w, d, ry) {
  const geo = grassGeometry(1.0, 5, 0x9a7a2a, 0xe8c860);
  const n = Math.floor(w * d * 7);
  const mesh = new THREE.InstancedMesh(geo, worldMat({ rough: 1 }), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), p = new V3();
  const cs = Math.cos(ry), sn = Math.sin(ry);
  for (let i = 0; i < n; i++) {
    const lx = rnd(-w / 2, w / 2), lz = rnd(-d / 2, d / 2);
    const x = cx + lx * cs + lz * sn, z = cz - lx * sn + lz * cs;
    p.set(x, terrainH(x, z) - 0.02, z); q.setFromAxisAngle(UPV, rnd(0, TAU)); const k = rnd(0.85, 1.15); s.set(k, k * rnd(0.9, 1.2), k);
    m4.compose(p, q, s); mesh.setMatrixAt(i, m4);
  }
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// ---- the mountain: crags on the faces, scree at the foot, pines on the ledges ---------------------
function buildMountain() {
  B.reset(); B.to(VEG); B.occ = 1; B.ground = -1;
  const near = (x, z, m = 30) => Math.hypot(x - WORLD.cx, z - WORLD.cz) < WORLD.r + m;
  let n = 0;
  for (let i = 0; i < 14000 && n < 430; i++) {
    const x = rnd(-185, 185), z = rnd(-182, -38), mt = mountainH(x, z);
    if (!near(x, z) || mt < 1.0 || slopeAt(x, z, 0.9) < 0.65) continue;
    if (Math.abs(x - MOUTH.x) < 6.5 && z > MOUTH.z - 7) continue;
    const s = rnd(0.9, 2.2) * (0.75 + sstep(4, 26, mt) * 0.9), y = terrainH(x, z);
    sph(x, y - s * 0.35, z, s, vary(pick([0x8a847b, 0x7d776f, 0x948c80, 0x6f6a63]), 0.07), PAT.ROCK, { det: 1, jit: 0.3, sy: rnd(0.5, 1.0), sx: rnd(0.9, 1.6), ry: rnd(0, TAU), occ: 1 });
    n++;
  }
  for (let i = 0; i < 700; i++) {
    const x = rnd(-180, 180), z = footZ(x) + rnd(-1.0, 4.5);
    if (!near(x, z, 0)) continue;
    if (Math.abs(x - MOUTH.x) < 5.5 && z > MOUTH.z - 3) continue;
    if (pathInfo(x, z) > 0.2 || riverDist(x, z) < 7) continue;
    const big = R() < 0.08, s = big ? rnd(0.7, 1.3) : rnd(0.12, 0.4), y = terrainH(x, z);
    sph(x, y + (big ? -s * 0.25 : s * 0.12), z, s, vary(pick([0x8a847b, 0x9a948a, 0x7a746c]), 0.1), PAT.ROCK, { det: big ? 1 : 0, jit: 0.3, sy: 0.65, ry: rnd(0, TAU), occ: big ? 1 : 0 });
    if (big) addCircW(x, z, s * 0.85, y - 1, y + s * 1.2);
  }
  let np = 0;
  for (let i = 0; i < 9000 && np < 190; i++) {
    const x = rnd(-185, 185), z = rnd(-182, -42), mt = mountainH(x, z);
    if (!near(x, z, 10) || mt < 2.0 || terrainH(x, z) > 34 || slopeAt(x, z, 0.8) > 0.42) continue;
    if (Math.abs(x - MOUTH.x) < 7 && z > MOUTH.z - 9) continue;
    tree(x, z, 'pine', rnd(0.75, 1.25));
    np++;
  }
}
