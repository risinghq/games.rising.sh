// Cameras: the prototype's overhead orthographic view with OrbitControls (one-finger pan, pinch zoom,
// two-finger twist; mouse left-drag pans, right-drag rotates, wheel zooms), plus:
// - twist/rotate snaps to the nearest of 4 isometric angles on release
// - glide(x, z, zoom, ms) and frame(kind) presets sized to the screen, home(), and a bottom inset so the
//   subject of an open sheet stays above it (setInset)
// - the prototype's first-person Stroll with its swoop in and out, WASD/arrows and a joystick hook
// - follow(object) and a slow title orbit
// Zoom is the ortho camera's zoom over a frustum VIEW_H world units tall (prototype). Presets are
// expressed as "world units that must fit", so they read the same on a phone and a desktop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp, lerp, ease, damp, smooth } from './kit.js';
import { fogU } from './fog.js';

const VIEW_H = 52, ISO = -Math.PI / 4, POLAR = Math.acos(1.25 / Math.hypot(1, 1.25, 1)), EYE = 1.7;
const HOME = { x: -2.6, z: -0.4 };
// x, z to look at, the size (world units) that must fit on screen and, optionally, an azimuth to look from
export const FRAMES = {
  home: { x: HOME.x, z: HOME.z, fit: 0 },
  patch: { x: -1.5, z: 5, fit: 22 },
  giant: { x: -15.2, z: 9.6, fit: 12.5 },
  stand: { x: -5, z: -7, fit: 12.5 },
  barn: { x: -14, z: -13.4, fit: 15 },
  lot: { x: -17.6, z: -4.6, fit: 14 },
  scale: { x: -15, z: 16.6, fit: 13 },
  hives: { x: -4.8, z: -16, fit: 12 },
  maze: { x: 4.3, z: -13.5, fit: 15 },
  beach: { x: 11, z: 2, fit: 18 },
  // the new-farm flow, looked at from the +z side (az 0) so the dock runs straight across the screen, and then the
  // stand's sign face-on while you name the farm
  dock: { x: 12.7, z: 5.6, fit: 6.5, az: 0 },
  sign: { x: -5, z: -7.3, fit: 5.5, az: 0 },
};
const azOf = (v) => Math.atan2(v.x, v.z);
const isoAz = (a) => ISO + Math.round((a - ISO) / (Math.PI / 2)) * (Math.PI / 2);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createCamera(K) {
  const { renderer, settings } = K, dom = renderer.domElement;
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  const persp = new THREE.PerspectiveCamera(70, 1, 0.05, 900);
  let W = 1, H = 1, active = ortho, view = 'overhead', trans = null, glideA = null, followObj = null, titleOn = false;
  // screen px covered by UI: bottom (tray + sheet, eased), top (HUD), right (the desktop sheet panel, eased)
  let inset = { want: 0, cur: 0, top: 0, right: 0, rcur: 0 }, snapPending = false, lastAz = 0, touchedAt = -1e9;
  const now = () => performance.now();
  const reduce = () => !!settings?.reduceMotion;

  const controls = new OrbitControls(ortho, dom);
  controls.target.set(HOME.x, 0, HOME.z);
  ortho.position.copy(controls.target).add(new THREE.Vector3(-1, 1.25, 1).normalize().multiplyScalar(100));
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  // two fingers pinch-zoom and pan; the twist is ours (below) so it can snap on release
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.screenSpacePanning = false;
  controls.minZoom = 0.3; controls.maxZoom = 6;
  controls.minPolarAngle = 0.3; controls.maxPolarAngle = 1.2;
  controls.zoomToCursor = true;
  controls.addEventListener('start', () => { glideA = null; followObj = null; snapPending = false; touchedAt = now(); });
  controls.addEventListener('end', () => { snapPending = true; });
  controls.addEventListener('change', () => {
    const t = controls.target, cx = clamp(t.x, -18, 18), cz = clamp(t.z, -18, 18), dy = -t.y;
    if (cx !== t.x || cz !== t.z || dy) {
      ortho.position.x += cx - t.x; ortho.position.z += cz - t.z; ortho.position.y += dy;
      t.set(cx, 0, cz);
    }
  });

  // ---------------------------------------------------------------- twist (two-finger rotate)
  const touches = new Map();
  let twistA = null;
  const twistAngle = () => { const [a, b] = [...touches.values()]; return Math.atan2(b.y - a.y, b.x - a.x); };
  dom.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && view === 'overhead' && !titleOn) twistA = twistAngle();
  });
  dom.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (twistA === null || touches.size !== 2) return;
    const a = twistAngle(), d = wrap(a - twistA); twistA = a;
    if (Math.abs(d) < 0.3) rotateBy(-d);
  });
  const endTouch = (e) => {
    if (!touches.delete(e.pointerId)) return;
    if (twistA !== null && touches.size < 2) { twistA = null; snapPending = true; }
  };
  dom.addEventListener('pointerup', endTouch); dom.addEventListener('pointercancel', endTouch);
  function rotateBy(a) {
    const o = ortho.position.clone().sub(controls.target).applyAxisAngle(THREE.Object3D.DEFAULT_UP, a);
    ortho.position.copy(controls.target).add(o); ortho.lookAt(controls.target);
  }

  // ---------------------------------------------------------------- framing
  const aspect = () => W / H;
  function frameOrtho() {
    ortho.left = -VIEW_H * aspect() * 0.5; ortho.right = VIEW_H * aspect() * 0.5;
    ortho.top = VIEW_H * 0.5; ortho.bottom = -VIEW_H * 0.5;
    // the subject (controls.target) sits in the middle of the area left between the HUD, the sheet and (on
    // desktop) the sheet panel. A pixel view offset (not a frustum shift) so the effect doesn't scale with zoom.
    const dy = clamp((inset.cur - inset.top) / 2, -H * 0.35, H * 0.35), dx = clamp(inset.rcur / 2, 0, W * 0.3);
    if (Math.abs(dy) > 0.5 || dx > 0.5) ortho.setViewOffset(W, H, dx, dy, W, H); else ortho.clearViewOffset();
    ortho.updateProjectionMatrix();
  }
  // zoom that fits `fit` world units in the visible area (0 = the whole farm, the Home view). Uses the insets the
  // UI asked for, not the eased ones, so a glide started as a sheet opens lands right.
  function zoomFor(fit) {
    const visH = VIEW_H * clamp(1 - (inset.want + inset.top) / H, 0.25, 1), visW = VIEW_H * aspect() * clamp(1 - inset.right / W, 0.4, 1);
    // the whole tile seen from the isometric corner: ~46 units across, ~56 tall (lighthouse to the rocks under it)
    if (!fit) return clamp(Math.min(visW / 46, visH / 56, 1.05), 0.38, 1.05);
    return clamp(Math.min(visW, visH) / fit, 0.38, controls.maxZoom);
  }
  function resize(w, h) {
    W = Math.max(1, w); H = Math.max(1, h);
    persp.aspect = W / H; persp.updateProjectionMatrix();
    frameOrtho();
  }

  // ---------------------------------------------------------------- glides
  // Glide target, zoom and (optionally) azimuth and polar angle together. Any touch cancels a glide.
  function glide(x, z, zoom = ortho.zoom, ms = 600, az, polar) {
    if (view !== 'overhead') return;
    const off = ortho.position.clone().sub(controls.target), r = off.length(), p0 = Math.acos(clamp(off.y / r, -1, 1));
    glideA = {
      t0: now(), ms: reduce() ? 0 : ms, from: controls.target.clone(), to: new THREE.Vector3(clamp(x, -18, 18), 0, clamp(z, -18, 18)),
      // no azimuth asked for: the nearest of the 4 isometric angles (a glide that starts mid-swing, like Gran's first
      // line interrupting the new-farm flow's turn from the dock, used to freeze the farm at 45 degrees off)
      z0: ortho.zoom, z1: clamp(zoom, controls.minZoom, controls.maxZoom), az0: azOf(off), az1: az ?? isoAz(azOf(off)), p0, p1: polar ?? p0, r,
    };
    if (glideA.ms === 0) stepGlide(1);
  }
  function stepGlide(k) {
    const g = glideA, e = ease(k);
    controls.target.copy(g.from).lerp(g.to, e);
    const az = g.az0 + wrap(g.az1 - g.az0) * e, p = lerp(g.p0, g.p1, e);
    ortho.position.copy(controls.target).add(new THREE.Vector3(Math.sin(p) * Math.sin(az), Math.cos(p), Math.sin(p) * Math.cos(az)).multiplyScalar(g.r));
    ortho.zoom = lerp(g.z0, g.z1, e); ortho.updateProjectionMatrix();
    ortho.lookAt(controls.target);
    if (k >= 1) glideA = null;
  }
  const frame = (kind, ms = 650) => {
    const f = FRAMES[kind] || FRAMES.home;
    glide(f.x, f.z, zoomFor(f.fit), ms, f.az);
  };
  // Home: the whole farm, from the prototype's isometric corner
  const home = (ms = 700) => { followObj = null; glide(HOME.x, HOME.z, zoomFor(0), ms, ISO, POLAR); };
  // snap the azimuth to the nearest isometric angle once a rotate gesture (and its damping) has settled
  function snapStep() {
    const az = azOf(ortho.position.clone().sub(controls.target));
    if (Math.abs(wrap(az - lastAz)) > 0.002) { lastAz = az; return; }
    snapPending = false;
    const k = Math.round((az - ISO) / (Math.PI / 2)), want = ISO + k * Math.PI / 2;
    if (Math.abs(wrap(want - az)) > 0.01) glide(controls.target.x, controls.target.z, ortho.zoom, 280, want);
  }

  // ---------------------------------------------------------------- stroll (first person)
  const player = { pos: new THREE.Vector3(), yaw: 0, pitch: -0.08, bob: 0 };
  const keys = new Set(), joy = new THREE.Vector2();
  const onKey = (e) => {
    if (view !== 'stroll' || /INPUT|TEXTAREA/.test(e.target?.tagName)) return;
    keys.add(e.key.toLowerCase());
  };
  const offKey = (e) => keys.delete(e.key.toLowerCase());
  const blur = () => keys.clear();
  addEventListener('keydown', onKey); addEventListener('keyup', offKey); addEventListener('blur', blur);
  const fpDir = (yaw, pitch) => new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  let look = null;
  dom.addEventListener('pointerdown', (e) => {
    if (view !== 'stroll' || trans) return;
    look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  dom.addEventListener('pointermove', (e) => {
    if (!look || e.pointerId !== look.id) return;
    const k = e.pointerType === 'touch' ? 0.006 : 0.0045;
    player.yaw += (e.clientX - look.x) * k;
    player.pitch = clamp(player.pitch + (e.clientY - look.y) * k, -1.2, 1.1);
    look.x = e.clientX; look.y = e.clientY;
  });
  const endLook = (e) => { if (look && e.pointerId === look.id) look = null; };
  dom.addEventListener('pointerup', endLook); dom.addEventListener('pointercancel', endLook);
  const W_ = () => K.world;
  function updateFP(dt) {
    const blocked = W_().blocked, heightAt = W_().heightAt;
    let f = 0, s = 0;
    if (keys.has('w') || keys.has('arrowup')) f += 1;
    if (keys.has('s') || keys.has('arrowdown')) f -= 1;
    if (keys.has('a')) s -= 1;
    if (keys.has('d')) s += 1;
    if (keys.has('arrowleft')) player.yaw += dt * 1.8;
    if (keys.has('arrowright')) player.yaw -= dt * 1.8;
    f -= joy.y; s += joy.x;
    const mag = Math.min(1, Math.hypot(f, s));
    if (mag > 0.05) {
      const sp = 3.2 * (keys.has('shift') ? 1.8 : 1) * dt / Math.max(1, Math.hypot(f, s));
      const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
      const dx = (fx * f - fz * s) * sp, dz = (fz * f + fx * s) * sp;
      if (!blocked(player.pos.x + dx, player.pos.z)) player.pos.x += dx;
      if (!blocked(player.pos.x, player.pos.z + dz)) player.pos.z += dz;
      player.bob += mag * dt * 9;
    }
    const y = heightAt(player.pos.x, player.pos.z) + EYE + Math.sin(player.bob) * 0.035;
    persp.position.set(player.pos.x, y, player.pos.z);
    persp.lookAt(persp.position.clone().add(fpDir(player.yaw, player.pitch)));
  }
  // the swoop between the two cameras, from the prototype
  function overheadState() {
    const Hh = (ortho.top - ortho.bottom) / ortho.zoom;
    return { look: controls.target.clone(), dir: ortho.position.clone().sub(controls.target).normalize(), H: Hh, fov: 9 };
  }
  function fpState() {
    const fwd = fpDir(player.yaw, player.pitch);
    const eye = new THREE.Vector3(player.pos.x, W_().heightAt(player.pos.x, player.pos.z) + EYE, player.pos.z);
    return { look: eye.clone().addScaledVector(fwd, 10), dir: fwd.clone().negate(), H: 2 * 10 * Math.tan(THREE.MathUtils.degToRad(35)), fov: 70 };
  }
  function applyTrans(k) {
    const { a, b } = trans, e = ease(k);
    const lk = a.look.clone().lerp(b.look, e), dir = a.dir.clone().lerp(b.dir, e).normalize();
    const fov = lerp(a.fov, b.fov, e), Hh = Math.exp(lerp(Math.log(a.H), Math.log(b.H), e));
    const d = Hh / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    persp.fov = fov; persp.updateProjectionMatrix();
    persp.position.copy(lk).addScaledVector(dir, d);
    persp.position.y = Math.max(persp.position.y, W_().heightAt(persp.position.x, persp.position.z) + 0.6);
    persp.lookAt(lk);
    fogU.uFogFP.value = 1 - smooth(d, 14, 70);
  }
  function stroll(on = view !== 'stroll') {
    if (trans || (on && view === 'stroll') || (!on && view !== 'stroll')) return;
    titleOn = false; followObj = null; glideA = null;
    const { blocked, pathDist } = W_();
    if (on) {
      const t = controls.target, fwd = t.clone().sub(ortho.position); fwd.y = 0; fwd.normalize();
      player.pos.set(t.x, 0, t.z);
      // zoomed out: start at a favourite spot; zoomed in: drop onto a path near the view centre
      let best = ortho.zoom < 1.6 ? [-10.6, 2.6, 0] : null;
      if (best) fwd.set(0.86, 0, -0.5);
      const clear = (x, z) => { for (let k = 0.6; k < 7; k += 0.6) if (blocked(x + fwd.x * k, z + fwd.z * k)) return false; return true; };
      for (let i = 0; i < 600 && !(best && best[2] === 0); i++) {
        const x = t.x + (i * 7.31 % 16) - 8, z = t.z + (i * 3.77 % 16) - 8;
        if (blocked(x, z) || pathDist(x, z) > 0.4 || !clear(x, z)) continue;
        const d = Math.hypot(x - t.x, z - t.z); if (!best || d < best[2]) best = [x, z, d];
      }
      if (best) player.pos.set(best[0], 0, best[1]); else if (blocked(t.x, t.z)) player.pos.set(-8, 0, -4.6);
      player.yaw = Math.atan2(fwd.x, fwd.z); player.pitch = -0.08;
      trans = { a: overheadState(), b: fpState(), start: now(), dur: reduce() ? 1 : 1700, to: 'stroll' };
      active = persp; controls.enabled = false;
    } else {
      const fwd = fpDir(player.yaw, 0);
      const target = new THREE.Vector3(clamp(player.pos.x + fwd.x * 5, -16, 16), 0, clamp(player.pos.z + fwd.z * 5, -16, 16));
      const back = fwd.clone().negate();
      const dir = new THREE.Vector3(back.x * Math.sin(POLAR), Math.cos(POLAR), back.z * Math.sin(POLAR)).normalize();
      trans = { a: fpState(), b: { look: target, dir, H: (ortho.top - ortho.bottom) / ortho.zoom, fov: 9 }, start: now(), dur: reduce() ? 1 : 1700, to: 'overhead' };
    }
    view = 'moving';
    K.emit?.('view', trans.to);
  }
  function finishTrans() {
    const to = trans.to;
    if (to === 'stroll') { fogU.uFogFP.value = 1; view = 'stroll'; }
    else {
      controls.target.copy(trans.b.look);
      ortho.position.copy(trans.b.look).addScaledVector(trans.b.dir, 100);
      ortho.lookAt(controls.target);
      active = ortho; controls.enabled = true; controls.update();
      fogU.uFogFP.value = 0; view = 'overhead';
      snapPending = true;
    }
    trans = null;
    K.emit?.('view', view);
  }

  // ---------------------------------------------------------------- per frame
  function update(rdt) {
    const dt = Math.min(rdt, 0.1);
    if (Math.abs(inset.cur - inset.want) > 0.5 || Math.abs(inset.rcur - inset.right) > 0.5) {
      const k = reduce() ? 1 : damp(rdt, 9);
      inset.cur = lerp(inset.cur, inset.want, k); inset.rcur = lerp(inset.rcur, inset.right, k);
      frameOrtho();
    }
    if (trans) {
      const k = clamp((now() - trans.start) / trans.dur, 0, 1);
      applyTrans(k);
      if (k >= 1) finishTrans();
      return;
    }
    if (view === 'stroll') { updateFP(dt); return; }
    if (titleOn) {
      rotateBy(dt * 0.06);
      controls.update();
      return;
    }
    if (glideA) stepGlide(glideA.ms ? clamp((now() - glideA.t0) / glideA.ms, 0, 1) : 1);
    else if (followObj) {
      const p = followObj.getWorldPosition?.(new THREE.Vector3()) ?? followObj, k = damp(rdt, 4);
      const dx = (p.x - controls.target.x) * k, dz = (p.z - controls.target.z) * k;
      controls.target.x += dx; controls.target.z += dz; ortho.position.x += dx; ortho.position.z += dz;
    }
    if (snapPending && !glideA && !touches.size) snapStep();
    controls.update();
  }

  resize(dom.clientWidth || innerWidth, dom.clientHeight || innerHeight);
  ortho.zoom = zoomFor(0); ortho.updateProjectionMatrix();
  controls.update();

  return {
    ortho, persp, controls, FRAMES, update, resize, glide, frame, home, stroll, zoomFor,
    get active() { return active; },
    get view() { return titleOn ? 'title' : view; },
    get zoom() { return ortho.zoom; },
    // screen px a world unit spans (level-of-detail choices); Infinity when not in the overhead view
    get pxPerUnit() { return view === 'overhead' && !trans ? (ortho.zoom * H) / VIEW_H : Infinity; },
    get target() { return controls.target; },
    get touchedAt() { return touchedAt; },
    // bottom inset (px) of the tray and an open sheet; optional top inset for the HUD and right inset for the desktop
    // sheet panel. The view re-centres smoothly.
    setInset(px = 0, top = inset.top, right = inset.right) {
      inset.want = Math.max(0, px); inset.top = Math.max(0, top); inset.right = Math.max(0, right); frameOrtho();
    },
    follow(obj) { followObj = obj || null; },
    // turn the view by an angle (a desktop rotate button, tests); it snaps to an isometric angle after
    rotate(a = Math.PI / 2, ms = 450) {
      if (view !== 'overhead') return;
      const az = azOf(ortho.position.clone().sub(controls.target));
      glide(controls.target.x, controls.target.z, ortho.zoom, ms, az + a);
      snapPending = true;
    },
    get azimuth() { return azOf(ortho.position.clone().sub(controls.target)); },
    // thumb joystick: x right, y down, each -1..1 (the prototype's #joy)
    setJoy(x = 0, y = 0) { joy.set(clamp(x, -1, 1), clamp(y, -1, 1)); },
    title(on) {
      if (on === titleOn) return;
      titleOn = !!on; controls.enabled = !on; glideA = null; followObj = null;
      if (on) glide(-2, 0, zoomFor(0) * 0.92, 0); else home(900);
    },
    dispose() {
      controls.dispose();
      removeEventListener('keydown', onKey); removeEventListener('keyup', offKey); removeEventListener('blur', blur);
    },
  };
}
