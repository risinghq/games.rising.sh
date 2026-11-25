// A SMALL test renderer implementing the full R API (architecture §4.1), used only with ?render=stub so the UI can be
// built and screenshotted while the real renderer (src/render/) is written. Plain THREE: a ground tile, row boxes from
// layout.js, a sphere for the giant, simple landmarks, a 2D-canvas portrait per speaker. Not the game's look.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ROWS, rowZ, PLACES, ZONES } from '../src/sim/layout.js';

const SPC = { possum: [0xd9d6d0, 0x2d2c30, 0xe9a3a7], skunk: [0x2a2a30, 0xf3f0e8, 0x5a4148], raccoon: [0x8f8b86, 0x2f2b29, 0x2f2b29], beaver: [0x8a6248, 0x5d4030, 0xf1ede4],
  coyote: [0xc79a62, 0x8a6a48, 0x2d2a28], fox: [0xd9782d, 0xf1ede4, 0x2d2a28], owl: [0x8a6f55, 0xe5c66b, 0x3a302a], pelican: [0xefe7cf, 0xc2a37e, 0xc4553a] };
const WHO = { gran: null, farmer: null, moss: 'possum', hal: 'coyote', mayor: 'pelican', edna: 'owl', sasha: 'fox', vance: 'beaver', dez: 'raccoon', bea: 'beaver', howie: 'coyote',
  mavis: 'possum', ladybug: 'fox', vale: 'fox', hoot: 'owl', bigtom: 'coyote', lindqvist: 'skunk', possumMom: 'possum', weighmaster: 'beaver' };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export async function createRenderer({ container, phone, settings }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.5 : 2));
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd3dcdb);
  scene.fog = new THREE.Fog(0xd3dcdb, 40, 140);
  scene.add(new THREE.HemisphereLight(0xe3ecee, 0x8c8a6c, 1.4));
  const sun = new THREE.DirectionalLight(0xfff4e2, 2.2); sun.position.set(18, 30, 14); scene.add(sun);
  const M = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9 });
  const box = (x0, x1, y0, y1, z0, z1, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), M(c)); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); scene.add(m); return m; };
  box(-20, 8.5, -1.3, 0, -20, 20, 0x95a87f); box(-20, 8.5, -3, -1.3, -20, 20, 0x7a5c43); box(8.5, 11.5, -1.6, -0.5, -20, 20, 0xd8c8a1);
  box(11.5, 20, -3, -0.9, -11, 20, 0x8cbdb6); box(11.5, 20, -3, 2.6, -20, -11, 0xa29e95); box(-20, 8.7, 0, 0.03, -5.2, -4, 0xcdb894);
  const rows = Array.from({ length: ROWS.count }, (_, r) => box(ROWS.x0, ROWS.x1, 0, 0.14, rowZ(r) - 0.6, rowZ(r) + 0.6, 0x7a5d43));
  box(-17.6, -10.4, 0, 3.2, -17.1, -10.9, 0xa6574a); box(-17.8, -10.2, 3.2, 3.6, -17.3, -10.7, 0x5d6168);
  const standM = new THREE.MeshStandardMaterial({ color: 0xffffff });
  box(-6.6, -3.4, 0, 1, -8.2, -7.2, 0x9b8774);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.6), standM); sign.position.set(-5, 1.6, -7.15); scene.add(sign);
  box(-18.4, -14.2, 0, 0.2, 15.6, 18.6, 0x5d6266); box(-8.6, -1.4, 0, 1.2, -16.6, -15.8, 0xe9d18a);
  const lh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 4, 8), M(0xf1ede4)); lh.position.set(16.6, 4.8, -16.2); scene.add(lh);
  const giant = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: 0xe3a35e, roughness: 0.7 })); giant.position.set(-15.5, 0, 9); scene.add(giant);
  const farmer = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 8), M(0xa9a8ad)); scene.add(farmer);
  const mayor = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 8), M(0xefe7cf)); mayor.position.set(PLACES.dock.x - 1, 0.5, PLACES.dock.z); scene.add(mayor);
  const ripples = [];

  // ---------------------------------------------------------- camera (prototype framing)
  const VIEW_H = 52, cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  const controls = new OrbitControls(cam, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, screenSpacePanning: false, minZoom: 0.3, maxZoom: 6, minPolarAngle: 0.3, maxPolarAngle: 1.2 });
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  const DIR = new THREE.Vector3(-1, 1.25, 1).normalize();
  controls.target.set(-0.5, 0, -0.5); cam.position.copy(controls.target).addScaledVector(DIR, 100);
  let W = 1, H = 1, inset = 0, insetTop = 0, glideA = null, orbit = false, fogAdd = 0, fogCur = 0.35;
  const homeZoom = () => Math.min(1.05, Math.max(0.38, (VIEW_H * W / H) / 60));
  function frameOrtho() {
    const aspect = W / H, shift = Math.max(-0.35, Math.min(0.35, (inset - insetTop) / H / 2)); // subject between HUD and sheet
    Object.assign(cam, { left: -VIEW_H * aspect / 2, right: VIEW_H * aspect / 2, top: VIEW_H * (0.5 - shift), bottom: -VIEW_H * (0.5 + shift) });
    cam.updateProjectionMatrix();
  }
  function resize() { W = container.clientWidth || innerWidth; H = container.clientHeight || innerHeight; renderer.setSize(W, H); frameOrtho(); }
  addEventListener('resize', resize); resize();
  cam.zoom = homeZoom(); cam.updateProjectionMatrix();
  function glide(x, z, zoom = cam.zoom, ms = 600) {
    glideA = { t0: performance.now(), ms: Math.max(1, ms), a: controls.target.clone(), b: new THREE.Vector3(x, 0, z), z0: cam.zoom, z1: zoom };
  }
  const FR = { patch: [-1.5, 5, 1.1], giant: [-15.2, 9.6, 1.8], stand: [-5, -7, 1.8], barn: [-14, -13.4, 1.5], lot: [-17.6, -4.6, 1.6], scale: [-15, 16.6, 1.7], hives: [-4.8, -16, 1.8], dock: [12.7, 5.6, 3], sign: [-5, -7.3, 3] };

  // ---------------------------------------------------------- taps (tap vs pan: < 10 px and < 300 ms; hold 500 ms)
  const handlers = { tap: [], longpress: [] };
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, held: false, timer: setTimeout(() => { if (down && !down.moved) { down.held = true; emit('longpress', e); } }, 500) };
  });
  renderer.domElement.addEventListener('pointermove', (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) down.moved = true; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down) return;
    clearTimeout(down.timer);
    if (!down.moved && !down.held && performance.now() - down.t < 300) emit('tap', e);
    down = null;
  });
  const emit = (type, e) => { const hit = pick(e.clientX, e.clientY); for (const fn of handlers[type]) fn(hit, e); };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function ground(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), cam);
    return ray.ray.intersectPlane(plane, new THREE.Vector3());
  }
  function project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(cam);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, visible: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1 };
  }
  function pick(cx, cy) {
    const g = ground(cx, cy);
    if (!g) return null;
    let best = null, bd = 24, bp = -1;
    for (const zn of ZONES) {
      let nx, nz;
      if (zn.circle) { const [x, z, r] = zn.circle, d = Math.hypot(g.x - x, g.z - z), k = d > r ? r / d : 1; nx = x + (g.x - x) * k; nz = z + (g.z - z) * k; }
      else { const [x0, z0, x1, z1] = zn.rect; nx = Math.max(x0, Math.min(x1, g.x)); nz = Math.max(z0, Math.min(z1, g.z)); }
      const p = project(nx, 0, nz), d = Math.hypot(p.x - (cx - renderer.domElement.getBoundingClientRect().left), p.y - (cy - renderer.domElement.getBoundingClientRect().top));
      if (d < bd - 0.5 || (d <= bd + 0.5 && zn.priority > bp)) { best = zn; bd = d; bp = zn.priority; }
    }
    return best ? { kind: best.kind, id: best.id, x: g.x, z: g.z } : { kind: 'ground', id: null, x: g.x, z: g.z };
  }

  // ---------------------------------------------------------- portraits: a quick 2D face per species
  const pcache = new Map();
  function portrait(key, opts = {}) {
    const sp = SPC[key] ? key : WHO[key] ?? opts.species ?? 'possum', ck = `${key}|${sp}`;
    if (pcache.has(ck)) return pcache.get(ck);
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), [fur, mark, nose] = SPC[sp] || SPC.possum;
    const ear = (x) => { g.fillStyle = hex(mark); g.beginPath(); g.ellipse(x, 34, 16, 22, x < 64 ? -0.4 : 0.4, 0, 7); g.fill(); };
    ear(36); ear(92);
    g.fillStyle = hex(fur); g.beginPath(); g.ellipse(64, 70, 44, 40, 0, 0, 7); g.fill();
    if (sp === 'skunk') { g.fillStyle = hex(mark); g.fillRect(58, 30, 12, 34); }
    if (sp === 'raccoon') { g.fillStyle = hex(mark); g.beginPath(); g.ellipse(64, 64, 38, 11, 0, 0, 7); g.fill(); }
    g.fillStyle = '#221f1d'; for (const x of [48, 80]) { g.beginPath(); g.arc(x, 64, sp === 'owl' ? 9 : 6, 0, 7); g.fill(); }
    g.fillStyle = hex(nose); g.beginPath();
    if (sp === 'pelican') { g.ellipse(64, 92, 9, 26, 0, 0, 7); } else g.ellipse(64, 84, 8, 6, 0, 0, 7);
    g.fill();
    if (key === 'gran') { g.strokeStyle = '#3a302a'; g.lineWidth = 3; for (const x of [48, 80]) { g.beginPath(); g.arc(x, 64, 11, 0, 7); g.stroke(); } }
    const url = c.toDataURL();
    pcache.set(ck, url);
    return url;
  }

  // ---------------------------------------------------------- sync
  let signText = '', species = '';
  function repaintSign(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const g = c.getContext('2d'); g.fillStyle = '#efe8d8'; g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#3f4c43'; g.font = '700 40px Georgia, serif'; g.textAlign = 'center'; g.fillText(text, 256, 62, 480);
    standM.map?.dispose(); standM.map = new THREE.CanvasTexture(c); standM.map.colorSpace = THREE.SRGBColorSpace; standM.needsUpdate = true;
  }
  function sync(s, rdt) {
    const night = s.clock.phase === 'halloween' || (s.clock.phase === 'weighoff' && s.weighoff?.stage === 'eve') || s.clock.phase === 'winter';
    fogCur += ((s.weather?.f ?? 0.35) + fogAdd - fogCur) * Math.min(1, rdt * 3);
    scene.background.setHex(night ? 0x1a2130 : 0xd3dcdb); scene.fog.color.copy(scene.background);
    scene.fog.near = 92 + 14 * (1 - fogCur); scene.fog.far = 118 + 60 * (1 - fogCur);  // the ortho camera sits ~100 away
    s.patch?.rows?.forEach((r, i) => rows[i].material.color.setHex(!r.open ? 0x5f6b45 : r.stock?.prime ? 0xd9782d : r.variety ? 0x6b8a5c : 0x7a5d43));
    const gs = s.giant?.wc ? 0.4 + 2 * Math.min(1, s.giant.wc / 900) : 0.25; giant.scale.set(gs, gs * 0.75, gs);
    if (s.meta.farmName !== signText) repaintSign(signText = s.meta.farmName);
    if (s.meta.species !== species) { species = s.meta.species; farmer.material.color.setHex((SPC[species] || SPC.possum)[0]); }
    const f = s.season?.farmer || PLACES.farmhome; farmer.position.set(f.x, 0.8, f.z);
    mayor.visible = s.clock.phase === 'newgame';
    if (glideA) {
      const k = Math.min(1, (performance.now() - glideA.t0) / glideA.ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const t = glideA.a.clone().lerp(glideA.b, e), d = t.clone().sub(controls.target);
      controls.target.add(d); cam.position.add(d); cam.zoom = glideA.z0 + (glideA.z1 - glideA.z0) * e; cam.updateProjectionMatrix();
      if (k >= 1) glideA = null;
    }
    if (orbit) cam.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), rdt * 0.06).add(controls.target);
    for (const r of ripples) { r.t += rdt; r.m.scale.setScalar(0.3 + r.t * 3); r.m.material.opacity = Math.max(0, 0.8 - r.t * 1.6); }
    while (ripples.length && ripples[0].t > 0.5) { const r = ripples.shift(); scene.remove(r.m); }
    controls.update();
    renderer.render(scene, cam);
  }

  return {
    sync,
    fx(ev) {
      if ((ev.type !== 'ripple' && ev.type !== 'tap') || ev.x == null || settings?.reduceMotion) return;
      const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
      m.position.set(ev.x, 0.2, ev.z); scene.add(m); ripples.push({ m, t: 0 });
    },
    pick, project, portrait,
    cam: {
      glide, home: (ms = 700) => glide(-0.5, -0.5, homeZoom(), ms), frame: (k) => FR[k] && glide(FR[k][0], FR[k][1], FR[k][2]),
      setInset(px = 0, top = insetTop) { inset = Math.max(0, px); insetTop = Math.max(0, top); frameOrtho(); }, view: 'overhead', stroll() {}, title(on) { orbit = !!on; controls.enabled = !on; },
    },
    setFogOverride(d) { fogAdd = d; },
    photo(w = 240, h = 180) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(renderer.domElement, 0, 0, w, h); return c.toDataURL('image/jpeg', 0.7); },
    on(type, fn) { handlers[type]?.push(fn); },
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    dispose() { renderer.dispose(); renderer.domElement.remove(); },
  };
}
