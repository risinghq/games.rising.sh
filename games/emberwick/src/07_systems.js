// ============================================================================
//  Systems: particles, light pool, day/night, cutaway, camera, input, AI
// ============================================================================

// ---- particles ---------------------------------------------------------------
const PUni = { uScale: { value: 800 } };
const P_VS = `attribute vec4 pcol; attribute float psize; attribute vec2 pshape;
uniform float uScale; varying vec4 vC; varying vec2 vS;
void main(){ vC = pcol; vS = pshape; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = psize * uScale / max(0.5, -mv.z); }`;
const P_FS = `varying vec4 vC; varying vec2 vS;
void main(){
  vec2 p = gl_PointCoord - 0.5; float a;
  if (vS.x < 0.5) { a = smoothstep(0.5, 0.0, length(p)); a *= a; }
  else if (vS.x < 1.5) { float cs = cos(vS.y), sn = sin(vS.y); vec2 q = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y); q.x *= 2.3; a = 1.0 - smoothstep(0.36, 0.46, length(q)); }
  else { a = smoothstep(0.5, 0.15, length(p)); }
  gl_FragColor = vec4(vC.rgb, vC.a * a);
  if (gl_FragColor.a < 0.003) discard;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
class PSys {
  constructor(max, additive) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max); this.shape = new Float32Array(max * 2);
    this.vel = new Float32Array(max * 3); this.age = new Float32Array(max); this.life = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max); this.a1 = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.spin = new Float32Array(max); this.kind = new Uint8Array(max); this.seed = new Float32Array(max);
    this.ly = new Uint8Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aShape = new THREE.BufferAttribute(this.shape, 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('pcol', this.aCol); g.setAttribute('psize', this.aSize); g.setAttribute('pshape', this.aShape);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({ uniforms: PUni, vertexShader: P_VS, fragmentShader: P_FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 6 : 5;
    scene.add(this.pts);
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, c, a0, a1, o = {}) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    this.col[i * 4] = c.r; this.col[i * 4 + 1] = c.g; this.col[i * 4 + 2] = c.b; this.col[i * 4 + 3] = a0;
    this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0; this.a1[i] = a1;
    this.grav[i] = o.grav || 0; this.drag[i] = o.drag || 0; this.spin[i] = o.spin || 0; this.kind[i] = o.kind || 0; this.seed[i] = R() * 100;
    this.ly[i] = o.ly ?? 0;
    this.shape[i * 2] = o.shape || 0; this.shape[i * 2 + 1] = R() * 6;
    this.size[i] = s0;
  }
  kill(i) {
    const j = --this.n;
    if (i === j) return;
    const cp3 = (a) => { a[i * 3] = a[j * 3]; a[i * 3 + 1] = a[j * 3 + 1]; a[i * 3 + 2] = a[j * 3 + 2]; };
    cp3(this.pos); cp3(this.vel);
    for (let k = 0; k < 4; k++) this.col[i * 4 + k] = this.col[j * 4 + k];
    for (const a of [this.age, this.life, this.s0, this.s1, this.a0, this.a1, this.grav, this.drag, this.spin, this.kind, this.seed, this.size, this.ly]) a[i] = a[j];
    this.shape[i * 2] = this.shape[j * 2]; this.shape[i * 2 + 1] = this.shape[j * 2 + 1];
  }
  update(dt, t) {
    const hideS = UG.surfHidden || UG.dir > 0, hideU = !UG.ugShown;
    for (let i = 0; i < this.n; i++) {
      const age = (this.age[i] += dt), life = this.life[i];
      if (age >= life) { this.kill(i); i--; continue; }
      const u = age / life, i3 = i * 3, k = this.kind[i];
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i3] *= dr; this.vel[i3 + 2] *= dr; this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt;
      if (k === 1) { const s = this.seed[i]; this.vel[i3] += Math.sin(t * 1.3 + s) * 0.9 * dt; this.vel[i3 + 2] += Math.cos(t * 1.1 + s * 1.7) * 0.9 * dt; this.vel[i3 + 1] += Math.sin(t * 0.9 + s * 3) * 0.4 * dt; }
      if (k === 2) { const s = this.seed[i]; this.vel[i3] = Math.sin(t * 1.6 + s) * 0.55; }
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      this.size[i] = lerp(this.s0[i], this.s1[i], u);
      let a = lerp(this.a0[i], this.a1[i], u);
      if (k === 1) a *= 0.5 + 0.5 * Math.sin(t * 3 + this.seed[i] * 7);
      if (u < 0.12) a *= u / 0.12;
      const ly = this.ly[i];
      if ((ly === 0 && hideS) || (ly === 1 && hideU)) a = 0;
      this.col[i * 4 + 3] = a;
      this.shape[i * 2 + 1] += this.spin[i] * dt;
    }
    this.geo.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aShape.needsUpdate = true;
  }
}
const PS = {}; // normal & additive systems
function initParticles() { PS.n = new PSys(2600, false); PS.a = new PSys(3000, true); }
const _pc = new THREE.Color();
function burst(x, y, z, n) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), s = rnd(1.5, 4.5);
    PS.a.spawn(x, y, z, Math.cos(a) * s * 0.6, rnd(1.5, 4), Math.sin(a) * s * 0.6, rnd(0.25, 0.6), 0.09, 0.02, _pc.set(pick([0xffc060, 0xff8a2a, 0xfff0a0])), 1.6, 0, { grav: 9, shape: 2 });
  }
}

// ---- glow sprites at light emitters --------------------------------------------
let GLOW = null;
function initGlows() {   // run again whenever custom areas add or take away lights
  if (GLOW && GLOW.pts) { scene.remove(GLOW.pts); GLOW.pts.geometry.dispose(); }
  const list = emitters.filter(e => e.glow > 0);
  const n = list.length;
  const pos = new Float32Array(n * 3), colA = new Float32Array(n * 4), size = new Float32Array(n), shape = new Float32Array(n * 2);
  list.forEach((e, i) => { pos.set([e.p.x, e.p.y, e.p.z], i * 3); size[i] = e.glow * 1.6; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('pcol', new THREE.BufferAttribute(colA, 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('psize', new THREE.BufferAttribute(size, 1)); g.setAttribute('pshape', new THREE.BufferAttribute(shape, 2));
  const m = (GLOW && GLOW.mat) || new THREE.ShaderMaterial({ uniforms: PUni, vertexShader: P_VS, fragmentShader: P_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 7;
  scene.add(pts);
  GLOW = { list, colA, attr: g.attributes.pcol, pos, posAttr: g.attributes.position, pts, mat: m };
}
function updateGlows(t) {
  if (!GLOW) return;
  const N = SU.uNight.value, c = GLOW.colA;
  GLOW.list.forEach((e, i) => {
    let a = e.night ? N : e.day ? (1 - N) * 0.5 : e.ug ? 0.85 : (e.b ? 0.35 + 0.65 * N : 0.4 + 0.6 * N);
    if (e.grp) a *= e.grp.fade < 0.5 ? 0 : e.grp.fade;
    if (e !== ORB.e && (e.ug ? !UG.ugShown : (UG.surfHidden || UG.dir > 0))) a = 0;
    if (e.b && CUT.b === e.b && e.f > CUT.f && CUT.enabled) a = 0;
    const fl = 1 - e.flick * 0.6 * (0.5 + 0.5 * Math.sin(t * 9 + e.seed) * Math.sin(t * 5.3 + e.seed * 2));
    if (e.dynamic) { GLOW.pos[i * 3] = e.p.x; GLOW.pos[i * 3 + 1] = e.p.y; GLOW.pos[i * 3 + 2] = e.p.z; GLOW.posAttr.needsUpdate = true; }
    c[i * 4] = e.color.r; c[i * 4 + 1] = e.color.g; c[i * 4 + 2] = e.color.b; c[i * 4 + 3] = a * 0.55 * fl * e.on * (1 - DARK.k);
  });
  GLOW.attr.needsUpdate = true;
}

// ---- light pool -------------------------------------------------------------------
let NIGHT = 0;
const ORB = { e: null };
function updateLights(dt, t) {
  const ugz = UG.zone, inside = !ugz && CUT.enabled ? CUT.b : null, fl = CUT.f;
  const peekZ = !ugz && UG.peek ? (CUT.b === V.inn ? 'cellar' : CUT.b === V.tower ? 'vault' : null) : null;
  const fx = EDIT.on ? CAM.tgt.x : player.x, fz = EDIT.on ? CAM.tgt.z : player.z, fy = EDIT.on ? CAM.tgt.y : player.y;
  const cand = [];
  for (const e of emitters) {
    if (e.int <= 0 || !e.on) continue;
    const nk = e.night ? NIGHT : e.day ? 1 - NIGHT : 1;
    if (nk < 0.03) continue;
    let pen = 0;
    if (e === ORB.e) { /* the staff orb goes everywhere the party goes */ }
    else if (ugz) { if (!e.ug) continue; }
    else if (e.ug) { if (e.zone !== peekZ) continue; pen = 5; }
    else if (inside) { if (e.b !== inside || e.f !== fl) continue; }
    else if (e.b && !e.b.s.openAir) continue;
    const d = Math.hypot(e.p.x - fx, e.p.z - fz) + Math.abs(e.p.y - fy) * (ugz ? 1.2 : 0.5) + pen;
    if (d > 34) continue;
    cand.push([d - e.prio * 3, e]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  const want = new Set(cand.slice(0, pool.length).map(c => c[1]));
  for (const l of pool) if (l.userData.em && !want.has(l.userData.em)) l.userData.em = null;
  for (const e of want) {
    if (pool.some(l => l.userData.em === e)) continue;
    const free = pool.find(l => !l.userData.em);
    if (free) { free.userData.em = e; free.intensity = 0; }
  }
  for (const l of pool) {
    const e = l.userData.em;
    if (!e) { l.intensity = dampf(l.intensity, 0, 10, dt); continue; }
    const nk = e.night ? NIGHT : e.day ? 1 - NIGHT : 1;
    const flick = 1 - e.flick * (0.5 + 0.5 * Math.sin(t * 11 + e.seed) * Math.sin(t * 6.7 + e.seed * 3));
    let target = e.int * nk * flick * (1 - DARK.k);
    if (!e.b && !e.ug && !inside && e !== ORB.e) target *= 0.5 + NIGHT * 0.5;
    if (e.ug) target *= 1.7;   // the dark down there needs lamps to carry
    l.position.copy(e.p); l.color.copy(e.color); l.distance = e.range * (e.ug ? 1.25 : 1);
    l.intensity = dampf(l.intensity, target, 9, dt);
  }
}

// ---- day / night ---------------------------------------------------------------------
const TIME = { h: 17.25, rate: 1 / 40, paused: false };
const TKEYS = [
  { h: 0.0, sun: 0x9db4ff, si: 0.95, sky: 0x34467a, gnd: 0x1c1a22, hi: 1.05, fog: 0x121a2c, top: 0x060b1c, hor: 0x1c2a4c, ex: 1.42, n: 1 },
  { h: 5.0, sun: 0x9db4ff, si: 0.9, sky: 0x34467a, gnd: 0x1c1a22, hi: 1.05, fog: 0x161e34, top: 0x0a1226, hor: 0x2a3456, ex: 1.36, n: 1 },
  { h: 6.0, sun: 0xffa070, si: 1.2, sky: 0x9a98c8, gnd: 0x463830, hi: 1.0, fog: 0xc8a4a4, top: 0x4a5a9a, hor: 0xf0a888, ex: 1.12, n: 0.5 },
  { h: 7.5, sun: 0xffd8ac, si: 2.4, sky: 0xbfd2ee, gnd: 0x66553a, hi: 1.15, fog: 0xd8dce0, top: 0x6a98d8, hor: 0xe8d8c8, ex: 1.0, n: 0 },
  { h: 12.0, sun: 0xfff4e4, si: 3.0, sky: 0xc4daf2, gnd: 0x66553a, hi: 1.25, fog: 0xcfdbe6, top: 0x5a8fd6, hor: 0xcfe0ee, ex: 0.95, n: 0 },
  { h: 16.5, sun: 0xffc98a, si: 2.8, sky: 0xcad0e0, gnd: 0x705638, hi: 1.2, fog: 0xe6d0b4, top: 0x6a90cc, hor: 0xf2d6b0, ex: 1.0, n: 0 },
  { h: 18.2, sun: 0xff9050, si: 2.1, sky: 0xb0a0c8, gnd: 0x5a4030, hi: 1.1, fog: 0xd89a80, top: 0x4a5a9a, hor: 0xff9a70, ex: 1.1, n: 0.3 },
  { h: 19.3, sun: 0xb098e0, si: 0.9, sky: 0x58588a, gnd: 0x2a2026, hi: 0.95, fog: 0x3a3456, top: 0x1a2050, hor: 0x7a5a7a, ex: 1.3, n: 0.82 },
  { h: 21.0, sun: 0x9db4ff, si: 0.95, sky: 0x34467a, gnd: 0x1c1a22, hi: 1.05, fog: 0x121a2c, top: 0x060b1c, hor: 0x1c2a4c, ex: 1.42, n: 1 },
  { h: 24.0, sun: 0x9db4ff, si: 0.95, sky: 0x34467a, gnd: 0x1c1a22, hi: 1.05, fog: 0x121a2c, top: 0x060b1c, hor: 0x1c2a4c, ex: 1.42, n: 1 },
];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const SUNDIR = new V3(), INTERIOR_EX = { v: 0 };
function lerpKey(name, h) {
  let i = 0;
  while (i < TKEYS.length - 2 && TKEYS[i + 1].h <= h) i++;
  const a = TKEYS[i], b = TKEYS[i + 1], t = clamp((h - a.h) / (b.h - a.h), 0, 1);
  const s = t * t * (3 - 2 * t);
  if (typeof a[name] === 'number' && name !== 'sun' && !['sky', 'gnd', 'fog', 'top', 'hor'].includes(name)) return lerp(a[name], b[name], s);
  return _c1.set(a[name]).lerp(_c2.set(b[name]), s).clone();
}
function applyTime(dt) {
  const h = TIME.h;
  NIGHT = lerpKey('n', h);
  SU.uNight.value = NIGHT;
  const day = h >= 5.6 && h <= 18.9;
  let th, dir;
  if (day) { th = (h - 5.6) / 13.3 * PI; dir = SUNDIR.set(Math.cos(th), Math.max(0.16, Math.sin(th) * 0.95), Math.sin(th) * 0.5 + 0.2); }
  else { const hh = h < 12 ? h + 24 : h; th = (hh - 18.9) / 10.7 * PI; dir = SUNDIR.set(-Math.cos(th) * 0.8, Math.max(0.25, Math.sin(th) * 0.9), 0.35); }
  dir.normalize();
  sun.color.copy(lerpKey('sun', h));
  sun.intensity = lerpKey('si', h);
  hemi.color.copy(lerpKey('sky', h)); hemi.groundColor.copy(lerpKey('gnd', h)); hemi.intensity = lerpKey('hi', h);
  scene.fog.color.copy(lerpKey('fog', h));
  renderer.setClearColor(scene.fog.color);
  skyU.uTop.value.copy(lerpKey('top', h)); skyU.uHor.value.copy(lerpKey('hor', h)); skyU.uBot.value.copy(scene.fog.color);
  const sth = (h - 5.6) / 13.3 * PI;
  skyU.uSunDir.value.set(Math.cos(sth), Math.sin(sth) * 0.95, Math.sin(sth) * 0.5 + 0.2).normalize();
  skyU.uSunCol.value.copy(sun.color);
  { const hh = h < 12 ? h + 24 : h; const mth = (hh - 18.9) / 10.7 * PI; skyU.uMoonDir.value.set(-Math.cos(mth) * 0.8, Math.sin(mth) * 0.9, 0.35).normalize(); }
  waterU.uSky.value.copy(skyU.uHor.value).lerp(skyU.uTop.value, 0.4).multiplyScalar(1 - NIGHT * 0.6);
  const inside = CUT.enabled && CUT.b && !UG.zone ? 1 : 0;
  INTERIOR_EX.v = dampf(INTERIOR_EX.v, inside, 2.5, dt);
  renderer.toneMappingExposure = lerpKey('ex', h) * (1 + INTERIOR_EX.v * (0.28 - NIGHT * 0.12));
  hemi.intensity *= 1 + INTERIOR_EX.v * 0.25;
  // underground: the sun goes out, the fog closes in warm and dark. Going down the dark
  // arrives with the slice; coming back up the sky fades in as the world rebuilds
  const k = UG.k, kb = UG.dir > 0 ? 1 : k;
  const fx = EDIT.on ? Math.max(0, EDIT.cam.dist - 25) * 1.3 : 0;   // the editor's camera can stand far back: push the haze back with it
  scene.fog.near = lerp(55, UGL.near, k) + fx; scene.fog.far = lerp(150, UGL.far, k) + fx;
  if (kb > 0.001) {
    sun.intensity *= 1 - k;
    hemi.color.lerp(UGL.sky, k); hemi.groundColor.lerp(UGL.gnd, k); hemi.intensity = lerp(hemi.intensity, UGL.hi, k);
    scene.fog.color.lerp(UGL.fog, kb);
    renderer.setClearColor(scene.fog.color);
    skyU.uTop.value.lerp(UGL.fog, kb); skyU.uHor.value.lerp(UGL.fog, kb); skyU.uBot.value.copy(scene.fog.color);
    renderer.toneMappingExposure = lerp(renderer.toneMappingExposure, UGL.ex, k);
  }
}

// ---- shadow camera follows the focus, snapped to texels -------------------------------
const _sv = new V3(), _sx = new V3(), _sy = new V3();
function updateSun(focus) {
  const d = SUNDIR;
  _sx.crossVectors(d, UPV).normalize(); _sy.crossVectors(_sx, d).normalize();
  const texel = (SHADOW_HALF * 2) / sun.shadow.mapSize.x;
  const a = Math.round(focus.dot(_sx) / texel) * texel, b = Math.round(focus.dot(_sy) / texel) * texel, c = focus.dot(d);
  _sv.copy(_sx).multiplyScalar(a).addScaledVector(_sy, b).addScaledVector(d, c);
  sun.target.position.copy(_sv);
  sun.position.copy(_sv).addScaledVector(d, 70);
  sun.target.updateMatrixWorld();
}

// ---- cutaway ---------------------------------------------------------------------------
const CUT = { b: null, f: 0, enabled: true, occ: true, occK: 1, faded: 0 };
const HOOKS = { enter: [], floor: [] };
function updateCutaway(dt) {
  let nb = null;
  for (const b of BUILDINGS) {
    const poly = b === CUT.b ? b.zoneOut : b.zone;
    if (!poly) continue;
    if (pip(poly, player.x, player.z) && player.y > (b.s.y || 0) - (b.s.cellar ? 2.2 : 0.6) && player.y < (b.s.y || 0) + b.wallTop + 0.5) { nb = b; break; }
  }
  if (UG.zone || EDIT.on) nb = null;
  const f = nb ? nb.floorOf(player.y) : 0;
  if (nb !== CUT.b) { CUT.b = nb; CUT.f = f; HOOKS.enter.forEach(h => h(nb, f)); }
  else if (nb && f !== CUT.f) { CUT.f = f; HOOKS.floor.forEach(h => h(nb, f)); }
  const cx = camera.position.x, cz = camera.position.z;
  let faded = 0;
  for (const g of fadeGroups) {
    let t = 1;
    const b = g.building;
    if (CUT.enabled && b && b === nb) {
      if (g.kind === 'roof') t = 0;
      else if (g.kind !== 'base' && g.floor > f) t = 0;
      else if (g.plane && g.floor === f) {
        const P = g.plane;
        const sp = (player.x - P.px) * P.nx + (player.z - P.pz) * P.nz;
        const sc = (cx - P.px) * P.nx + (cz - P.pz) * P.nz;
        if (sp * sc < 0 && Math.abs(sp) > 0.04) {
          if (g.kind === 'iwall') {
            const k = sp / (sp - sc), ix = player.x + (cx - player.x) * k, iz = player.z + (cz - player.z) * k;
            const u = (ix - P.px) * P.tx + (iz - P.pz) * P.tz;
            if (Math.abs(u) < P.hl + 1.2) t = g.ghost;
          } else t = g.ghost;
        }
      }
    }
    g.target = t;
    if (t < 0.99) faded++;
    if (g.fade !== t) {
      g.fade = dampf(g.fade, t, 7.5, dt);
      if (Math.abs(g.fade - t) < 0.004) g.fade = t;
      g.apply();
    }
  }
  CUT.faded = faded;
  // screen-space occlusion circle around the player (outdoor trees, roofs, other buildings)
  CUT.occK = dampf(CUT.occK, CUT.occ ? 1 : 0, 6, dt);
  SU.uOccOn.value = CAM.intro || EDIT.on ? 0 : CUT.occK;
}
// ---- underground: which layer the party is in, the slice between layers, what's shown ----------------
const SURF = [];   // every surface mesh, hidden once the party is fully underground
function collectSurface() {
  SURF.length = 0;
  for (const o of scene.children) if ((o.isMesh || o.isInstancedMesh) && o !== sky && o !== marker && !o.userData.ug) SURF.push(o);
}
function setSurface(on) {
  if (UG.surfHidden === !on) return;
  UG.surfHidden = !on;
  for (const o of SURF) o.visible = on;
  sky.visible = on;
}
function ugZoneAt(x, z, y) {
  const r = ugRegionAt(x, z, y, UG.zone ? 2.0 : 1.6);
  if (!r || !r.zone) return null;
  // the barrow and the cave lie under hills: you only go in through the door, on foot, at floor level
  if (!UG.zone && (r.zone === 'crypt' || r.zone === 'cave')) {
    if (r.zone === 'crypt' && !G.flags.slabOpen) return null;
    if (Math.abs(y - ugFloorAt(r, x, z)) > 0.6) return null;
  }
  return r.zone;
}
function finishSweep() {
  if (UG.dir > 0) setSurface(false);
  SU.uSurfY.value = 1e5; UG.dir = 0; UG.sweepT = 1;
}
function ugApply(zone, snap) {
  const prev = UG.zone;
  UG.zone = zone;
  if (!!prev !== !!zone) {
    UG.sweepT = 0;
    if (zone) UG.dir = 1; else { UG.dir = -1; setSurface(true); }
    if (snap) { finishSweep(); UG.k = zone ? 1 : 0; }
  }
  if (zone && zone !== prev && UGZ[zone]) {
    UI.showBanner(UGZ[zone].name, UGZ[zone].sub, !!prev);
    if (!snap) UI.partyBanter({ id: zone });
  }
}
function ugSnap() {
  UG.smY = player.y; UG.candT = 0;
  const z = ugZoneAt(player.x, player.z, player.y);
  if (z !== UG.zone) ugApply(z, true);
  else if (UG.dir !== 0) finishSweep();
}
// height of the slice plane: whips down past the rooftops, then lingers through the storey
// the party is standing in and finishes just below their feet
function sliceH(t, y0) {
  if (t < 0.16) return lerp(y0 + 46, y0 + 12, t / 0.16);
  return y0 + 12 - 13.5 * Math.pow((t - 0.16) / 0.84, 0.8);
}
function updateUnderground(dt) {
  const cand = ugZoneAt(player.x, player.z, player.y);
  if (cand !== UG.zone) { UG.candT += dt; if (UG.candT > 0.15) { ugApply(cand, false); UG.candT = 0; } }
  else UG.candT = 0;
  // going down the world is sliced away from the top; coming up it builds back from below
  if (UG.dir !== 0) {
    if (!UG.hold) UG.sweepT = Math.min(1, UG.sweepT + dt / 1.35);
    const t = UG.sweepT;
    SU.uSurfY.value = sliceH(UG.dir > 0 ? t : 1 - t, player.smoothY);
    if (t >= 1) finishSweep();
  }
  UG.k = dampf(UG.k, UG.zone ? 1 : 0, 2.4, dt);
  UG.smY = dampf(UG.smY, player.y, 5, dt);
  SU.uUgTop.value = UG.zone ? UG.smY + 3.4 : 1e5;
  SU.uCutK.value = dampf(SU.uCutK.value, UG.zone && CUT.enabled ? 1 : 0, 5, dt);
  const dx = CAM.tgt.x - camera.position.x, dz = CAM.tgt.z - camera.position.z, dl = Math.hypot(dx, dz) || 1;
  SU.uCamDir.value.set(dx / dl, dz / dl);
  // standing on the ground floor of the inn or the tower you can see down the stairwell into the cellar below
  UG.peek = !UG.zone && ((CUT.b === V.inn && CUT.f === 0) || (CUT.b === V.tower && CUT.f === 0));
  const show = !!UG.zone || UG.dir !== 0 || UG.peek;
  if (show !== UG.ugShown) { UG.ugShown = show; for (const m of UGM) m.visible = show; }
  // the painted darkness inside the cave mouth melts away as the party steps into the cave
  if (UGP.curtain) { const o = clamp(1 - UG.k * 1.6, 0, 1); UGP.curtain.material.opacity = o; UGP.curtain.visible = o > 0.01; }
}
const UGFX = { mote: 0 };
function ugEffects(dt, t) {
  if (!UG.zone) return;
  UGFX.mote += dt * 7;
  while (UGFX.mote > 1) {
    UGFX.mote--;
    const a = rnd(0, TAU), r = rnd(0.5, 8), x = player.x + Math.cos(a) * r, z = player.z + Math.sin(a) * r;
    const reg = ugRegionAt(x, z, player.y, 2.6); if (!reg) continue;
    PS.a.spawn(x, ugFloorAt(reg, x, z) + rnd(0.3, 2.6), z, rnd(-0.04, 0.04), rnd(-0.02, 0.05), rnd(-0.04, 0.04), rnd(4, 8), 0.05, 0.05, _pc.set(UG.zone === 'vault' ? 0xd8c8ff : 0xffe2b8), 0.4, 0.1, { kind: 1, drag: 1.2, ly: 1 });
  }
  if (UG.zone === 'cave' && R() < dt * 3) {   // drips from the dark overhead
    const a = rnd(0, TAU), r = rnd(1, 9), x = player.x + Math.cos(a) * r, z = player.z + Math.sin(a) * r;
    const reg = ugRegionAt(x, z, player.y, 2.6);
    if (reg) PS.n.spawn(x, ugFloorAt(reg, x, z) + 3.3, z, 0, -2, 0, 0.62, 0.05, 0.04, _pc.set(0xa8d0e8), 0.8, 0.6, { grav: 9.8, ly: 1 });
  }
}
const _pv = new V3();
function updateOcclusionUniforms() {
  _pv.set(player.x, player.smoothY + 1.0, player.z).project(camera);
  const bw = renderer.domElement.width, bh = renderer.domElement.height;
  SU.uOccC.value.set((_pv.x * 0.5 + 0.5) * bw, (_pv.y * 0.5 + 0.5) * bh);
  const depth = _pv.set(player.x, player.smoothY + 1.0, player.z).applyMatrix4(camera.matrixWorldInverse).z * -1;
  const focal = bh / (2 * Math.tan(camera.fov * DEG / 2));
  SU.uOccR.value = (2.3 * (1 + wGloam(player.x, player.z) * 0.9) / Math.max(depth, 1)) * focal;
  const dx = camera.position.x - player.x, dz = camera.position.z - player.z, dl = Math.hypot(dx, dz) || 1;
  SU.uOccP.value.set(player.x, player.smoothY, player.z);
  SU.uOccDir.value.set(dx / dl, dz / dl);
}

// ---- camera -------------------------------------------------------------------------------
const CAM = { yaw: PI / 4, yawT: PI / 4, pitch: 0.92, dist: 21, distT: 21, tgt: new V3(), intro: true, introA: 0.6, inK: 0, focus: null, talk: null, shake: 0 };
function updateCamera(dt) {
  if (EDIT.on) { editorCamera(dt); return; }
  if (CAM.intro) {
    CAM.introA += dt * 0.05;
    const r = 46, h = 19;
    camera.position.set(Math.sin(CAM.introA) * r, h, Math.cos(CAM.introA) * r);
    camera.lookAt(0, 3, 0);
    return;
  }
  CAM.yaw = dampA(CAM.yaw, CAM.yawT, CAM.focus ? 1.8 : 7, dt);
  let fx = player.x, fy = player.smoothY + 1.0, fz = player.z, distT = CAM.distT, rate = 7;
  const F = CAM.focus, T = CAM.talk;
  if (F) { fx = F.x; fy = F.y; fz = F.z; if (F.dist) distT = F.dist; rate = F.rate ?? 2.6; }
  else if (T) { fx = (player.x + T.x) / 2; fz = (player.z + T.z) / 2; fy = (player.smoothY + T.smoothY) / 2 + 1.0; distT = Math.min(CAM.distT, 15); rate = 4; }
  CAM.dist = dampf(CAM.dist, distT, F ? 2.2 : 5, dt);
  CAM.inK = dampf(CAM.inK, (CUT.b && CUT.enabled) || UG.zone ? 1 : 0, 3, dt);
  // while the dialogue box covers the lower part of the screen, lift whoever is talking above it
  CAM.dlgK = dampf(CAM.dlgK || 0, (CAM._dlgEl ||= document.getElementById('dialog')).hidden ? 0 : 1, 2.4, dt);
  if (CAM.dlgK > 0.001) { const off = CAM.dlgK * CAM.dist * 0.13; fx += Math.sin(CAM.yaw) * off; fz += Math.cos(CAM.yaw) * off; }
  CAM.tgt.x = dampf(CAM.tgt.x, fx, rate, dt); CAM.tgt.y = dampf(CAM.tgt.y, fy, Math.min(rate, 5), dt); CAM.tgt.z = dampf(CAM.tgt.z, fz, rate, dt);
  const d = CAM.dist * (1 - CAM.inK * 0.1), p = CAM.pitch + CAM.inK * 0.06;
  camera.position.set(CAM.tgt.x + Math.sin(CAM.yaw) * Math.cos(p) * d, CAM.tgt.y + Math.sin(p) * d, CAM.tgt.z + Math.cos(CAM.yaw) * Math.cos(p) * d);
  if (CAM.shake > 0.001) { CAM.shake = Math.max(0, CAM.shake - dt * 2.2); const k = CAM.shake * CAM.shake * 0.5; camera.position.x += rnd(-k, k); camera.position.y += rnd(-k, k); camera.position.z += rnd(-k, k); }
  camera.lookAt(CAM.tgt);
}

// ---- input ------------------------------------------------------------------------------------
const KEYS = new Set();
const INPUT = { jx: 0, jy: 0, joy: null, drag: null, target: null, goal: null, run: false, mx: -1, my: -1, mT: -99 };
const marker = (() => {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 24).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false }));
  m.renderOrder = 8; scene.add(m); return m;
})();
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
function screenToGround(cx, cy, y) {
  const r = renderer.domElement.getBoundingClientRect();
  _ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  _ray.setFromCamera(_ndc, camera);
  const o = _ray.ray.origin, d = _ray.ray.direction;
  if (Math.abs(d.y) < 1e-4) return null;
  const t = (y - o.y) / d.y;
  if (t < 0) return null;
  return new V3(o.x + d.x * t, y, o.z + d.z * t);
}
// what's under the cursor: a character, or one of the interactable things
function pickAt(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  let best = null, bd = 44;
  const test = (x, y, z, it) => {
    _pv.set(x, y, z).project(camera);
    if (_pv.z > 1) return;
    const sx = r.left + (_pv.x * 0.5 + 0.5) * r.width, sy = r.top + (-_pv.y * 0.5 + 0.5) * r.height, d = Math.hypot(sx - cx, sy - cy);
    if (d < bd) { bd = d; best = it; }
  };
  for (const c of CHARS) {
    if (c === player || !c.talkable || !c.root.visible || c.away || PARTY.includes(c)) continue;
    test(c.x, c.smoothY + (c.pose === 'stand' ? 1.0 : 0.7), c.z, { x: c.x, z: c.z, c, reach: 2.4, act: () => startTalk(c) });
  }
  for (const it of interactables()) if (it.kind !== 'npc') test(it.x, (it.y ?? player.y) + 0.4, it.z, { ...it, reach: 2.0 });
  return best;
}
function clickAt(cx, cy) {
  if (CAM.intro || UI.paused) return;
  if (DLG.active) { dlgAdvance(); return; }
  if (SCENE.active || COMBAT.down) return;
  const it = pickAt(cx, cy);
  if (it) {
    if (Math.hypot(it.x - player.x, it.z - player.z) < it.reach) { it.act(); return; }
    INPUT.goal = it; INPUT.target = new V3(it.x, player.y, it.z);
    return;
  }
  const p = screenToGround(cx, cy, player.y + 0.02);
  if (p) { INPUT.target = p; INPUT.goal = null; marker.position.copy(p); marker.material.opacity = 0.9; marker.scale.setScalar(1.4); }
}
function castSpellKey(k, tx, tz) {
  const id = SPELL_ORDER[k - 1];
  if (!id || CAM.intro || UI.paused) return;
  if (!G.spells[id]) { if (G.flags.lantern) UI.toast('Not yet', `Your lantern hasn’t learned this. Draw from ${{ hearth: 'a hearth', forge: 'a forge', candle: 'old candles', wisp: 'a wisp' }[SPELLS[id].kind]}.`, 'info', 2.5); return; }
  if (id === 'wisp' && tx === undefined && performance.now() - INPUT.mT < 6000) {
    const p = screenToGround(INPUT.mx, INPUT.my, player.y);
    if (p && Math.hypot(p.x - player.x, p.z - player.z) > 1.5) { tx = p.x; tz = p.z; }
  }
  cast(id, tx, tz);
}
function dash() {
  if (DLG.active || SCENE.active || COMBAT.down || PV.dashCd > 0 || UI.paused || CAM.intro) return;
  let dx = PV.vx, dz = PV.vz, l = Math.hypot(dx, dz);
  if (l < 0.6) { dx = Math.sin(player.face); dz = Math.cos(player.face); l = 1; }
  PV.dashDir = [dx / l, dz / l]; PV.dashT = 0.2; PV.dashCd = 0.7; PV.iframes = 0.32;
  INPUT.target = null; INPUT.goal = null;
  AUDIO.dash?.();
  for (let i = 0; i < 10; i++) PS.n.spawn(player.x + rnd(-0.2, 0.2), player.y + 0.1, player.z + rnd(-0.2, 0.2), -dx / l * rnd(0.5, 2), rnd(0.2, 0.6), -dz / l * rnd(0.5, 2), rnd(0.4, 0.7), 0.25, 0.7, _pc.set(UG.zone ? 0x8a7a68 : 0xb8a07a), 0.35, 0, { drag: 2, ly: UG.zone ? 1 : 0 });
}
function bindInput(el) {
  addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (EDIT.on) return;
    if (e.target && e.target.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
    if (CAM.intro) { if (e.code === 'Enter') { e.preventDefault(); $('go').click(); } return; }
    if (UI.modalOpen()) {
      if (e.code === 'Escape' || (e.code === 'KeyJ' && !$('journal').hidden) || (e.code === 'KeyM' && !$('worldmap').hidden)) { e.preventDefault(); UI.closeModals(); }
      return;
    }
    if (!$('ending').hidden) return;
    KEYS.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (DLG.active) {
      const ch = DLG.choices;
      if (ch) {
        const n = ch.list.length;
        if (e.code === 'ArrowUp' || e.code === 'KeyW') { DLG.sel = (DLG.sel + n - 1) % n; UI.selChoice(); }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') { DLG.sel = (DLG.sel + 1) % n; UI.selChoice(); }
        if (/^(Digit|Numpad)[1-9]$/.test(e.code)) pickChoice(+e.code.slice(-1) - 1);
      }
      if ((e.code === 'KeyF' || e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') && !e.repeat) { e.preventDefault(); dlgAdvance(); }
      return;
    }
    if (e.code === 'Escape') { UI.openMenu(); return; }
    if (e.code === 'KeyJ') { UI.openJournal(); return; }
    if (e.code === 'KeyM') { UI.openMap(); return; }
    if (e.code === 'Backquote') UI.togglePanel();
    if (SCENE.active) return;
    if (e.code === 'KeyQ') CAM.yawT -= PI / 4;
    if (e.code === 'KeyE') CAM.yawT += PI / 4;
    if ((e.code === 'KeyF' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); interact(); }
    if (e.code === 'Space' && !e.repeat) dash();
    if (/^(Digit|Numpad)[1-4]$/.test(e.code) && !e.repeat) castSpellKey(+e.code.slice(-1));
    if (e.code === 'KeyC') UI.toggleCutaway();
    if (e.code === 'Equal' || e.code === 'NumpadAdd') CAM.distT = clamp(CAM.distT * 0.88, 10, 44);
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') CAM.distT = clamp(CAM.distT * 1.12, 10, 44);
  });
  addEventListener('keyup', e => KEYS.delete(e.code));
  addEventListener('blur', () => KEYS.clear());
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('wheel', e => { e.preventDefault(); if (EDIT.on) return; CAM.distT = clamp(CAM.distT * (e.deltaY > 0 ? 1.1 : 0.9), 10, 44); }, { passive: false });
  el.addEventListener('pointerdown', e => {
    if (EDIT.on) return;
    el.setPointerCapture?.(e.pointerId);
    if (e.pointerType === 'mouse') {
      INPUT.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, btn: e.button, moved: 0, t: performance.now() };
    } else {
      INPUT.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
      UI.joyShow(e.clientX, e.clientY);
    }
  });
  el.addEventListener('pointermove', e => {
    if (EDIT.on) return;
    if (e.pointerType === 'mouse') { INPUT.mx = e.clientX; INPUT.my = e.clientY; INPUT.mT = performance.now(); }
    const d = INPUT.drag;
    if (d && d.id === e.pointerId) {
      const dx = e.clientX - d.x; d.moved += Math.abs(dx) + Math.abs(e.clientY - d.y); d.x = e.clientX; d.y = e.clientY;
      if (d.btn === 2 || (d.btn === 0 && d.moved > 12 && e.shiftKey)) CAM.yawT -= dx * 0.006;
    }
    const j = INPUT.joy;
    if (j && j.id === e.pointerId) {
      j.x = e.clientX; j.y = e.clientY; j.moved = Math.max(j.moved, Math.hypot(j.x - j.x0, j.y - j.y0));
      const dx = j.x - j.x0, dy = j.y - j.y0, len = Math.hypot(dx, dy), m = Math.min(1, len / 55);
      INPUT.jx = len > 6 ? (dx / len) * m : 0; INPUT.jy = len > 6 ? (-dy / len) * m : 0;
      UI.joyMove(dx, dy);
    }
  });
  const up = e => {
    if (EDIT.on) { INPUT.drag = null; INPUT.joy = null; return; }
    const d = INPUT.drag;
    if (d && d.id === e.pointerId) {
      if (d.btn === 0 && d.moved < 8) clickAt(e.clientX, e.clientY);
      if (d.btn === 2 && d.moved < 8 && G.spells.wisp && !DLG.active && !SCENE.active) { const p = screenToGround(e.clientX, e.clientY, player.y); if (p) castSpellKey(4, p.x, p.z); }
      INPUT.drag = null;
    }
    const j = INPUT.joy;
    if (j && j.id === e.pointerId) { if (j.moved < 10 && performance.now() - j.t < 350) clickAt(e.clientX, e.clientY); INPUT.joy = null; INPUT.jx = INPUT.jy = 0; UI.joyHide(); }
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}

// ---- player ----------------------------------------------------------------------------------
const TRAIL = [];
function trailPush(x, y, z) {
  const last = TRAIL[TRAIL.length - 1];
  if (last) { const d = Math.hypot(x - last.x, z - last.z, (y - last.y) * 0.6); if (d < 0.22) return; TRAIL.push({ x, y, z, d: last.d + d }); }
  else TRAIL.push({ x, y, z, d: 0 });
  if (TRAIL.length > 260) TRAIL.splice(0, TRAIL.length - 260);
}
function trailAt(dist) {
  for (let i = TRAIL.length - 1; i > 0; i--) {
    const a = TRAIL[i - 1], b = TRAIL[i];
    if (a.d <= dist) { const t = (dist - a.d) / Math.max(1e-5, b.d - a.d); return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) }; }
  }
  return TRAIL[0];
}
const PV = { vx: 0, vz: 0, stuck: 0, side: 1, sideT: 0 };
const _fa = { x: 0, z: 0 }, _fg = { h: 0, blocked: false, water: false, surf: null };
function freeAhead(dx, dz, dist) {
  for (const k of [0.5, 1]) {
    const d = dist * k, px = player.x + dx * d, pz = player.z + dz * d;
    _fa.x = px; _fa.z = pz;
    pushOut(_fa, player.r, player.y + 0.3, player.y + 1.55);
    if (Math.hypot(_fa.x - px, _fa.z - pz) > 0.06) return false;
    groundAt(px, pz, player.y + d, _fg);   // look a little higher so a stair ahead counts as a way on
    if (_fg.blocked || _fg.water || _fg.h > player.y + STEP + d) return false;
    if (!_fg.surf && !_fg.under && _fg.h - player.y > d * 0.95 + 0.02) return false;
  }
  return true;
}
function updatePlayer(dt) {
  let ix = 0, iy = 0;
  const locked = DLG.active || SCENE.active || COMBAT.down || UI.paused || EDIT.on;
  PV.dashCd = Math.max(0, (PV.dashCd || 0) - dt); PV.iframes = Math.max(0, (PV.iframes || 0) - dt);
  if (locked) { INPUT.target = null; INPUT.goal = null; }
  if (!CAM.intro && !locked) {
    if (KEYS.has('KeyW') || KEYS.has('ArrowUp')) iy += 1;
    if (KEYS.has('KeyS') || KEYS.has('ArrowDown')) iy -= 1;
    if (KEYS.has('KeyA') || KEYS.has('ArrowLeft')) ix -= 1;
    if (KEYS.has('KeyD') || KEYS.has('ArrowRight')) ix += 1;
    ix += INPUT.jx; iy += INPUT.jy;
  }
  let len = Math.hypot(ix, iy);
  if (len > 1) { ix /= len; iy /= len; len = 1; }
  const fwx = -Math.sin(CAM.yaw), fwz = -Math.cos(CAM.yaw), rtx = Math.cos(CAM.yaw), rtz = -Math.sin(CAM.yaw);
  let dx = 0, dz = 0, sp = (KEYS.has('ShiftLeft') || KEYS.has('ShiftRight') ? 6.4 : 4.2) * (G.carry ? 0.85 : 1);
  if (len > 0.05) {
    INPUT.target = null; INPUT.goal = null;
    dx = rtx * ix + fwx * iy; dz = rtz * ix + fwz * iy;
    sp *= len;
  } else if (INPUT.target) {
    const tx = INPUT.target.x - player.x, tz = INPUT.target.z - player.z, d = Math.hypot(tx, tz);
    const g = INPUT.goal, stopAt = g ? Math.min(1.6, g.reach - 0.3) : 0.2;
    if (d < stopAt) { INPUT.target = null; INPUT.goal = null; if (g) g.act(); }
    else {
      dx = tx / d; dz = tz / d;
      // whisker steering around furniture and corners
      if (!freeAhead(dx, dz, Math.min(0.75, d))) {
        PV.side = PV.sideT > 0 ? PV.side : (R() < 0.5 ? 1 : -1);
        for (const a of [0.5, 1.0, 1.5, -0.5, -1.0, -1.5]) {
          const ang = a * PV.side, c = Math.cos(ang), sn = Math.sin(ang);
          const ex = dx * c - dz * sn, ez = dx * sn + dz * c;
          if (freeAhead(ex, ez, 0.75)) { dx = ex; dz = ez; PV.sideT = 0.8; break; }
        }
      }
      if (d < 1.2 && !INPUT.goal) sp *= 0.6;
    }
  }
  PV.sideT = (PV.sideT || 0) - dt;
  const dl = Math.hypot(dx, dz);
  if (dl > 1e-4) { dx /= dl; dz /= dl; }
  if (locked) sp = 0;
  if (PV.dashT > 0) { PV.dashT -= dt; PV.vx = PV.dashDir[0] * 13; PV.vz = PV.dashDir[1] * 13; }
  else { PV.vx = dampf(PV.vx, dx * sp, 12, dt); PV.vz = dampf(PV.vz, dz * sp, 12, dt); }
  const ox = player.x, oz = player.z;
  moveChar(player, PV.vx * dt, PV.vz * dt, dt);
  const moved = Math.hypot(player.x - ox, player.z - oz);
  player.speed = dampf(player.speed, moved / Math.max(dt, 1e-4), 14, dt);
  if (INPUT.target) { if (moved < dt * sp * 0.2) PV.stuck += dt; else PV.stuck = 0; if (PV.stuck > 0.9) { INPUT.target = null; INPUT.goal = null; PV.stuck = 0; } }
  if (Math.hypot(PV.vx, PV.vz) > 0.3) player.face = dampA(player.face, Math.atan2(PV.vx, PV.vz), 12, dt);
  else if (DLG.active && DLG.c && DLG.c.root && DLG.c !== player && !isMoving(player)) player.face = dampA(player.face, Math.atan2(DLG.c.x - player.x, DLG.c.z - player.z), 8, dt);
  if (moved > 0.01 && player.speed > 1) { PV.stepD = (PV.stepD || 0) + moved; if (PV.stepD > (player.speed > 5 ? 0.95 : 0.8)) { PV.stepD = 0; AUDIO.step?.(player.floorSurf ? (CUT.b || UG.zone ? 'wood' : 'stone') : 'grass'); } }
  trailPush(player.x, player.y, player.z);
  if (marker.material.opacity > 0) { marker.material.opacity = Math.max(0, marker.material.opacity - dt * (INPUT.target ? 0.6 : 2.5)); marker.scale.setScalar(Math.max(1, marker.scale.x - dt * 1.2)); }
}

// ---- companions --------------------------------------------------------------------------------
function teleportParty(x, z, face = PI, y = null) {
  player.x = x; player.z = z; player.y = y ?? groundAt(x, z, 60).h; player.vy = 0; player.smoothY = player.y; player.face = face;
  TRAIL.length = 0;
  trailPush(x, player.y, z);
  const bx = -Math.sin(face), bz = -Math.cos(face), sx = Math.cos(face), sz = -Math.sin(face);
  PARTY.slice(1).forEach((c, i) => {
    const s = i ? -1 : 1;
    const p = { x: x + sx * 0.9 * s + bx * (0.6 + i * 0.5), z: z + sz * 0.9 * s + bz * (0.6 + i * 0.5) };
    pushOut(p, c.r, player.y + 0.3, player.y + 1.5);
    const g = groundAt(p.x, p.z, player.y + 0.2);
    if (g.blocked || Math.abs(g.h - player.y) > 0.6) { p.x = x; p.z = z; }
    c.x = p.x; c.z = p.z; c.y = player.y; c.vy = 0; c.smoothY = c.y; c.face = face; c.vx = c.vz = 0; c.stuck = 0; c.tD = 0;
  });
  CAM.tgt.set(x, player.y + 1, z);
  INPUT.target = null; INPUT.goal = null; PV.vx = PV.vz = 0;
  ugSnap();
}
function updateCompanions(dt) {
  if (!TRAIL.length) return;
  const total = TRAIL[TRAIL.length - 1].d;
  const lo = Math.max(0, TRAIL.length - 160);
  for (const c of PARTY.slice(1)) {
    // where along your trail this companion has got to. Progress only ever goes forward, so when you
    // double back past them they don't flicker between the old stretch of trail and the new one
    if (!(c.tD <= total)) c.tD = 0;   // the trail was cleared (a teleport)
    let bi = -1, bd = Infinity;
    for (let i = TRAIL.length - 1; i >= lo; i--) {
      const p = TRAIL[i];
      if (p.d < c.tD - 0.6) break;
      const d = (p.x - c.x) ** 2 + (p.z - c.z) ** 2 + ((p.y - c.y) * 2) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    if (bi < 0) bi = TRAIL.length - 1;
    // a later pass of the trail right beside them (you came back this way): skip ahead to it
    for (let i = TRAIL.length - 1; i > bi && TRAIL[i].d > TRAIL[bi].d + 2.5; i--) {
      const p = TRAIL[i];
      if ((p.x - c.x) ** 2 + (p.z - c.z) ** 2 + ((p.y - c.y) * 2) ** 2 < 1.44) { bi = i; break; }
    }
    c.tD = Math.max(c.tD, TRAIL[bi].d);
    const remaining = total - TRAIL[bi].d;
    const pd = Math.hypot(player.x - c.x, player.z - c.z);
    let dx = 0, dz = 0, sp = 0;
    if (remaining > c.follow + 0.25 && pd > 1.3) {
      const tgt = trailAt(Math.min(TRAIL[bi].d + 1.3, total - c.follow * 0.9));
      dx = tgt.x - c.x; dz = tgt.z - c.z;
      const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      sp = clamp((remaining - c.follow) * 2.4, 1.2, 7.2);
    }
    // personal space: keep off you, and whoever walks further back steps aside for whoever walks in front
    // (sideways, never forward: after you double back they swap places instead of shoving each other along)
    for (const o of PARTY) {
      if (o === c || (o !== player && (o.follow ?? 0) > (c.follow ?? 0))) continue;
      const ox = c.x - o.x, oz = c.z - o.z, od = Math.hypot(ox, oz);
      if (od >= 0.85 || od < 1e-3) continue;
      let px = ox / od, pz = oz / od;
      if (o !== player) {
        const tx = player.x - c.x, tz = player.z - c.z, tl = Math.hypot(tx, tz) || 1, f = (px * tx + pz * tz) / tl;
        if (f > 0) { px -= f * tx / tl; pz -= f * tz / tl; const l = Math.hypot(px, pz); if (l < 0.25) { px = -tz / tl; pz = tx / tl; } else { px /= l; pz /= l; } }
      }
      dx += px * 0.9; dz += pz * 0.9; sp = Math.max(sp, 1.2);
    }
    c.vx = dampf(c.vx || 0, dx * sp, 9, dt); c.vz = dampf(c.vz || 0, dz * sp, 9, dt);
    const ox = c.x, oz = c.z;
    moveChar(c, c.vx * dt, c.vz * dt, dt);
    const moved = Math.hypot(c.x - ox, c.z - oz);
    c.speed = dampf(c.speed, moved / Math.max(dt, 1e-4), 12, dt);
    if (sp > 1.5 && moved < sp * dt * 0.15) c.stuck = (c.stuck || 0) + dt; else c.stuck = 0;
    if (Math.hypot(c.vx, c.vz) > 0.4) c.face = dampA(c.face, Math.atan2(c.vx, c.vz), 9, dt);
    else c.face = dampA(c.face, Math.atan2(player.x - c.x, player.z - c.z), 3, dt);
    if (pd > 18 || c.stuck > 1.6 || Math.abs(c.y - player.y) > 2.5) {
      const p = trailAt(Math.max(0, total - c.follow)); c.x = p.x; c.z = p.z; c.y = p.y; c.vy = 0; c.smoothY = c.y; c.stuck = 0; c.tD = Math.max(0, total - c.follow);
    }
    if (c.rig.orb) {
      c.rig.item.updateWorldMatrix(true, false);
      const w = c.rig.orb.clone().applyMatrix4(c.rig.item.matrixWorld);
      ORB.e.p.copy(w);
      ORB.e.int = 0.6 + Math.max(NIGHT, UG.k) * 1.6;
      ORB.e.b = CUT.b; ORB.e.f = CUT.f;
      if (R() < dt * (2 + NIGHT * 6)) PS.a.spawn(w.x, w.y, w.z, rnd(-0.2, 0.2), rnd(0.1, 0.4), rnd(-0.2, 0.2), rnd(0.6, 1.2), 0.12, 0.02, _pc.set(0x9ae8ff), 1.0, 0, { shape: 2 });
    }
  }
}

// ---- NPCs --------------------------------------------------------------------------------------------
function updateNPCs(dt, t) {
  for (const c of CHARS) {
    if (PARTY.includes(c)) continue;
    if (c.talking && !c.fixed && !isMoving(c)) {
      if (!SCENE.active) c.face = dampA(c.face, Math.atan2(player.x - c.x, player.z - c.z), 6, dt);
      c.speed = dampf(c.speed, 0, 10, dt);
    } else if (c.mode === 'patrol' && c.wp) {
      if (c.wait > 0) { c.wait -= dt; c.speed = dampf(c.speed, 0, 8, dt); }
      else {
        const w = c.wp[c.wpi], dx = w[0] - c.x, dz = w[1] - c.z, d = Math.hypot(dx, dz);
        const pb = Math.hypot(player.x - c.x, player.z - c.z) < 1.1 && ((player.x - c.x) * dx + (player.z - c.z) * dz) > 0;
        if (d < 0.15) { c.wpi = (c.wpi + 1) % c.wp.length; c.wait = rnd(1.0, 3.5); }
        else if (!pb) {
          const s = 1.35; c.x += dx / d * s * dt; c.z += dz / d * s * dt; c.speed = dampf(c.speed, s, 8, dt);
          c.face = dampA(c.face, Math.atan2(dx, dz), 6, dt);
          c.y = groundAt(c.x, c.z, c.y + 0.3).h;
        } else c.speed = dampf(c.speed, 0, 8, dt);
      }
    } else if (c.mode === 'circle' && c.circle) {
      const k = c.circle;
      k.rest = (k.rest ?? rnd(8, 16)) - dt;
      if (k.rest < 0) { k.pause = rnd(2, 4); k.rest = rnd(10, 20); }
      if (k.pause > 0) { k.pause -= dt; c.speed = dampf(c.speed, 0, 6, dt); c.face = dampA(c.face, Math.atan2(-c.x, -c.z), 4, dt); }
      else {
        k.a += (k.sp / k.r) * dt;
        c.x = k.x + Math.cos(k.a) * k.r; c.z = k.z + Math.sin(k.a) * k.r; c.y = 0.04;
        c.speed = dampf(c.speed, k.sp, 6, dt);
        c.face = dampA(c.face, Math.atan2(-Math.sin(k.a), Math.cos(k.a)), 10, dt);
      }
    } else if (c.mode === 'follow' && !isMoving(c)) {
      const dx = player.x - c.x, dz = player.z - c.z, d = Math.hypot(dx, dz);
      if (d > (c.followD ?? 3.2)) {
        const s = clamp((d - (c.followD ?? 3.2)) * 2.5, 1.2, 6.5);
        moveChar(c, dx / d * s * dt, dz / d * s * dt, dt);
        c.speed = dampf(c.speed, s, 8, dt); c.face = dampA(c.face, Math.atan2(dx, dz), 8, dt);
        if (d > 22 || Math.abs(c.y - player.y) > 2.5) { const p = trailAt(Math.max(0, TRAIL[TRAIL.length - 1].d - 4.5)); c.x = p.x; c.z = p.z; c.y = p.y; c.smoothY = c.y; }
      } else { c.speed = dampf(c.speed, 0, 8, dt); c.face = dampA(c.face, Math.atan2(dx, dz), 3, dt); }
    } else if (!isMoving(c)) {
      c.face = dampA(c.face, c.home.face, 2, dt);
      c.speed = dampf(c.speed, 0, 8, dt);
    }
    if (c.amb && !c.talking && !c.away && !SCENE.active) {
      c.ambT -= dt;
      if (c.ambT < 0) { c.ambT = rnd(9, 20); if (Math.hypot(player.x - c.x, player.z - c.z) < 11 && c.root.visible) UI.bubble(c, pick(c.amb), 2.6); }
    }
  }
  for (const c of CHARS) {
    let vis;
    if (c.away) vis = false;
    else if (PARTY.includes(c)) vis = true;
    else if (c.ug) vis = UG.ugShown;
    else vis = !UG.surfHidden && !(CUT.enabled && c.b && CUT.b === c.b && c.f > CUT.f);
    c.root.visible = vis;
    c.animate(dt);
  }
  for (const a of ANIMALS) a.root.visible = !a.hidden && !a.gone && (a.ug ? UG.ugShown : !UG.surfHidden && !(CUT.enabled && a.b && CUT.b === a.b && a.f > CUT.f));
}

// ---- interaction: the nearest thing you can talk to, kindle, draw from or pick up -----------------------
const INTERACT = { cur: null };
const SPOTS = [];   // story-defined: { id, x, y, z, r, ug, verb, name, title, when(), act() }
function interactables() {
  const out = [];
  for (const c of CHARS) {
    if (c === player || !c.talkable || !c.root.visible || c.away || PARTY.includes(c)) continue;
    if (Math.abs(c.y - player.y) > 1.4) continue;
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    if (d < 9) out.push({ kind: 'npc', c, d, verb: c.verb || 'Talk to', name: c.name, title: c.title, x: c.x, y: c.y, z: c.z, act: () => startTalk(c) });
  }
  for (const s of SPOTS) {
    if (s.done || (s.when && !s.when()) || (!!s.ug !== !!UG.zone)) continue;
    const d = Math.hypot(s.x - player.x, s.z - player.z) - (s.r || 0);
    if (d > 9 || (s.y !== undefined && Math.abs(s.y - player.y) > 2.6)) continue;
    out.push({ kind: 'spot', s, d: d - 0.25, verb: typeof s.verb === 'function' ? s.verb() : s.verb, name: typeof s.name === 'function' ? s.name() : s.name, title: s.title, x: s.x, y: s.y, z: s.z, act: () => s.act() });
  }
  if (G.flags.lantern) for (const f of KFIRES) {
    const d = Math.hypot(f.x - player.x, f.z - player.z);
    if (d > 9 || Math.abs(f.y - player.y) > 3.2 || f.hidden) continue;
    if (!!f.ug !== !!UG.zone) continue;
    if (f.b && CUT.b !== f.b) continue;
    const a = kindleAction(f);
    if (a) out.push({ kind: 'fire', f, d: d + 0.35, verb: a.verb, name: a.label, title: '', x: f.x, y: f.y, z: f.z, act: a.act });
  }
  return out;
}
function updateInteract() {
  let best = null;
  // in reach, then whoever you're facing: in a crowd the nearest shoulder isn't always the person you walked up to
  const fx = Math.sin(player.face), fz = Math.cos(player.face);
  const score = it => { const dx = it.x - player.x, dz = it.z - player.z, l = Math.hypot(dx, dz) || 1; return it.d + (1 - (dx * fx + dz * fz) / l) * 0.6; };
  if (!DLG.active && !SCENE.active && !CAM.intro) for (const it of interactables()) if (it.d < (it.kind === 'fire' ? 2.6 : it.kind === 'npc' ? 2.5 : 2.2) && (!best || score(it) < best.sc)) { best = it; best.sc = score(it); }
  INTERACT.cur = best;
}
function interact() {
  if (DLG.active) { dlgAdvance(); return; }
  if (SCENE.active || COMBAT.down || MAGIC.drawing || UI.paused) return;
  const it = INTERACT.cur;
  if (it) { INPUT.target = null; INPUT.goal = null; it.act(); }
}

// ---- ambient particle sources ------------------------------------------------------------------------
const PT = { leaf: 0, ff: 0 };
function hiddenSrc(s) {
  if (s.ug) return !UG.ugShown;
  if (UG.surfHidden || UG.dir > 0) return true;
  return CUT.enabled && s.b && CUT.b === s.b && s.f > CUT.f;
}
function updateEffects(dt, t) {
  const px = EDIT.on ? CAM.tgt.x : player.x, pz = EDIT.on ? CAM.tgt.z : player.z, surf = !UG.surfHidden && UG.dir <= 0;
  ugEffects(dt, t);
  for (const s of SMOKES) {
    if (!surf) break;
    if (Math.abs(s.p.x - px) > 60 || Math.abs(s.p.z - pz) > 60) continue;
    if (s.when && !s.when()) continue;   // a chimney over a cold hearth
    s.acc += dt * s.rate;
    while (s.acc > 1) { s.acc--; PS.n.spawn(s.p.x + rnd(-0.1, 0.1), s.p.y, s.p.z + rnd(-0.1, 0.1), 0.25 + rnd(-0.1, 0.1), rnd(0.7, 1.0), 0.12, rnd(4, 6), 0.5, 2.6, _pc.set(NIGHT > 0.5 ? 0x5a5a66 : 0xb8b4ae), 0.42, 0, { drag: 0.15 }); }
  }
  for (const f of FIRES) {
    if (f.kf && (!f.kf.lit || f.kf.kind === 'ghost' || f.kf.kind === 'wisp')) continue;
    if (Math.abs(f.p.x - px) > 40 || Math.abs(f.p.z - pz) > 40 || hiddenSrc(f)) continue;
    const fl = f.ug ? 1 : 0;
    if (R() < dt * 9 * f.s) PS.a.spawn(f.p.x + rnd(-0.15, 0.15) * f.s, f.p.y + 0.05, f.p.z + rnd(-0.08, 0.08) * f.s, 0, rnd(0.6, 1.0), 0, rnd(0.35, 0.6), 0.5 * f.s, 0.12, _pc.set(pick([0xff8a2a, 0xffb347])), 0.7, 0, { ly: fl });
    if (R() < dt * (f.forge ? 6 : 2.5)) PS.a.spawn(f.p.x + rnd(-0.2, 0.2) * f.s, f.p.y + 0.2, f.p.z, rnd(-0.2, 0.2), rnd(1.0, 2.2), rnd(-0.2, 0.2), rnd(0.8, 1.6), 0.07, 0.03, _pc.set(0xffb060), 1.4, 0, { shape: 2, drag: 0.5, ly: fl });
  }
  for (const s of BUBBLERS) {
    if (Math.hypot(s.p.x - px, s.p.z - pz) > 30 || hiddenSrc(s)) continue;
    if (R() < dt * 8) { const a = rnd(0, TAU), r = rnd(0, s.r); PS.a.spawn(s.p.x + Math.cos(a) * r, s.p.y, s.p.z + Math.sin(a) * r, 0, rnd(0.2, 0.5), 0, rnd(0.4, 0.9), 0.1, 0.18, s.c, 0.9, 0, { shape: 2, ly: s.ug ? 1 : 0 }); }
  }
  for (const s of SPARKLES) {
    if (Math.hypot(s.p.x - px, s.p.z - pz) > 50 || hiddenSrc(s)) continue;
    if (R() < dt * s.rate) PS.a.spawn(s.p.x + rnd(-s.r, s.r), s.p.y + rnd(-s.r, s.r) * 0.5, s.p.z + rnd(-s.r, s.r), rnd(-0.1, 0.1), rnd(0.05, 0.25), rnd(-0.1, 0.1), rnd(1.5, 3), 0.12, 0.0, s.c, 1.2, 0, { shape: 2, kind: 1, ly: s.ug ? 1 : 0 });
  }
  if (!surf) return;
  // fountain
  if (Math.hypot(px, pz) < 45) {
    for (let i = 0; i < 3; i++) {
      const a = rnd(0, TAU);
      PS.n.spawn(Math.cos(a) * 0.95, 2.22, Math.sin(a) * 0.95, Math.cos(a) * rnd(0.45, 0.7), rnd(0.1, 0.4), Math.sin(a) * rnd(0.45, 0.7), 0.75, 0.09, 0.05, _pc.set(0xd8ecf4), 0.55, 0.25, { grav: 9.8 });
    }
    if (R() < 0.6) PS.n.spawn(rnd(-0.03, 0.03), 3.1, rnd(-0.03, 0.03), rnd(-0.3, 0.3), rnd(1.5, 2.0), rnd(-0.3, 0.3), 0.45, 0.08, 0.05, _pc.set(0xe0f0f8), 0.6, 0.2, { grav: 9.8 });
  }
  // falling leaves
  PT.leaf += dt * 7;
  while (PT.leaf > 1) {
    PT.leaf--;
    const c = CANOPIES[Math.floor(R() * CANOPIES.length)];
    if (!c || c.pine || Math.abs(c.x - px) > 28 || Math.abs(c.z - pz) > 28) continue;
    PS.n.spawn(c.x + rnd(-c.r, c.r), c.y + rnd(-0.5, 0.5), c.z + rnd(-c.r, c.r), 0.3, -rnd(0.35, 0.6), 0.1, rnd(5, 8), 0.16, 0.16, _pc.set(c.c).multiplyScalar(rnd(0.75, 1.1)), 1, 0.9, { shape: 1, kind: 2, spin: rnd(-2, 2) });
  }
  // fireflies
  if (NIGHT > 0.4) {
    PT.ff += dt * 14 * NIGHT;
    while (PT.ff > 1) {
      PT.ff--;
      const a = rnd(0, TAU), r = rnd(4, 26), x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      if (grassBlocked(x, z)) continue;
      PS.a.spawn(x, terrainH(x, z) + rnd(0.3, 1.6), z, 0, 0, 0, rnd(5, 9), 0.18, 0.14, _pc.set(0xd8ff7a), 1.2, 0.4, { kind: 1, drag: 1.5 });
    }
  }
  // dust kicked up by running feet (outdoors only)
  for (const c of PARTY) {
    if (c.speed > 4.6 && !CUT.b && R() < dt * 10) PS.n.spawn(c.x + rnd(-0.2, 0.2), c.y + 0.08, c.z + rnd(-0.2, 0.2), rnd(-0.3, 0.3), rnd(0.2, 0.5), rnd(-0.3, 0.3), rnd(0.6, 1.0), 0.25, 0.9, _pc.set(0xb8a07a), 0.32, 0, { drag: 2 });
  }
  // sleeping guest
  const basil = CHARS.find(c => c.id === 'basil');
  if (basil && basil.root.visible && R() < dt * 0.8 && Math.hypot(basil.x - px, basil.z - pz) < 14) PS.a.spawn(basil.x, basil.smoothY + 0.45, basil.z - 1.4, 0.05, 0.35, 0, 2.2, 0.12, 0.3, _pc.set(0xb8d0ff), 0.8, 0, { shape: 2 });
}

// ---- doors ---------------------------------------------------------------------------------------------------
const _dm = new THREE.Matrix4();
function updateDoors(dt) {
  for (const d of DOORS) {
    let open = false;
    for (const c of CHARS) { if (Math.abs(c.y - d.y) < 1.5 && (c.x - d.x) ** 2 + (c.z - d.z) ** 2 < 3.2) { open = true; break; } }
    d.target = open ? d.open : 0;
    if (Math.abs(d.ang - d.target) > 0.001) {
      d.ang = dampf(d.ang, d.target, open ? 6 : 3, dt);
      d.mesh.matrix.multiplyMatrices(d.base, _dm.makeRotationY(d.ang));
    }
  }
}
