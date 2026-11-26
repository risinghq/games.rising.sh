// Analytic hitboxes and tap detection (design §12 "World taps -> actions").
// No raycasts against meshes: a tap's ray is tested against circles and rectangles in XZ, each with an
// optional height range so tall things (the lighthouse, the giant, the Weighmaster) are tappable on
// their sides too. pick() returns the nearest hitbox within 24 px of screen distance; when several are
// equally near (a toy standing in a row both contain the tap) the higher priority wins.
// Priorities (layout.ZONES): toys 4 > heroes 3 > stations 2 > rows 1.
//
// Gestures: a tap is < 10 px of movement and < 300 ms; holding still for 450 ms is a longpress
// (the giant's Talk ritual). Two quick taps on the same spot also fire 'doubletap'. Anything else is
// left to the camera (pan, pinch, twist).
import * as THREE from 'three';
import { ZONES } from '../sim/layout.js';
import type { Zone } from '../sim/layout.js';
import type { Hit, HitHandler, Kit } from './types.js';

const TAP_PX = 10, TAP_MS = 300, LONG_MS = 450, REACH_PX = 24;
// render-side heights for the static zones, [y0, y1]
const HEIGHTS: Record<string, [number, number]> = {
  giant: [0, 3.2], stand: [0, 2.6], barn: [0, 6.2], hives: [0, 1.3], scale: [0, 2.4], lot: [0, 0.5],
  lighthouse: [2.8, 8.2], scarecrow: [0, 2.6], weighmaster: [0, 2.8], boat: [-0.9, 0.3], row: [0, 0.6],
};

export function createHit(K: Kit) {
  const { renderer } = K, dom = renderer.domElement;
  const boxes = new Map<string, Zone & { y: [number, number]; priority: number }>();
  const handlers: Record<string, HitHandler[]> = { tap: [], longpress: [], doubletap: [] };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const P = new THREE.Vector3(), Q = new THREE.Vector3();
  const keyOf = (kind: string, id: string | number | null) => `${kind}:${id}`;

  // { id, kind, circle: [x, z, r] } or { id, kind, rect: [x0, z0, x1, z1] }; optional y: [y0, y1].
  // Adding the same kind+id again moves/replaces it, so moving things can re-add every frame.
  function add(box: Zone, priority = box.priority ?? 1) {
    const y = box.y ?? HEIGHTS[String(box.id)] ?? HEIGHTS[box.kind] ?? [0, 0];
    boxes.set(keyOf(box.kind, box.id), { ...box, y, priority });
  }
  function remove(id: string | number, kind?: string) {
    for (const [k, b] of boxes) if (b.id === id && (kind === undefined || b.kind === kind)) boxes.delete(k);
  }
  for (const z of ZONES) add(z, z.priority);

  const rect = () => dom.getBoundingClientRect();
  function rayAt(cx: number, cy: number) {
    const r = rect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, K.cam.active);
    return r;
  }
  // screen px of a world point
  function toScreen(v: THREE.Vector3Like, r: DOMRect) {
    Q.copy(v).project(K.cam.active);
    return [r.left + (Q.x + 1) / 2 * r.width, r.top + (1 - Q.y) / 2 * r.height];
  }
  // nearest point of a box to (x, z) at height y
  function nearest(b: Zone, x: number, z: number, y: number) {
    if (b.circle) {
      const [cx, cz, cr] = b.circle, d = Math.hypot(x - cx, z - cz);
      return d <= cr ? P.set(x, y, z) : P.set(cx + (x - cx) / d * cr, y, cz + (z - cz) / d * cr);
    }
    const [x0, z0, x1, z1] = b.rect;
    return P.set(Math.min(Math.max(x, x0), x1), y, Math.min(Math.max(z, z0), z1));
  }
  function pick(cx: number, cy: number) {
    const r = rayAt(cx, cy);
    let best: { kind: string; id: string | number; x: number; z: number; d: number; priority: number } | null = null;
    for (const b of boxes.values()) {
      if (b.enabled === false) continue;
      const [y0, y1] = b.y;
      let d = Infinity, hx = 0, hz = 0;
      for (const y of y1 > y0 ? [y0, (y0 + y1) / 2, y1] : [y0]) {
        plane.constant = -y;
        if (!ray.ray.intersectPlane(plane, Q)) continue;
        const qx = Q.x, qz = Q.z;
        const [sx = 0, sy = 0] = toScreen(nearest(b, qx, qz, y), r);
        const dd = Math.hypot(sx - cx, sy - cy);
        if (dd < d) { d = dd; hx = P.x; hz = P.z; }
      }
      if (d > REACH_PX) continue;
      // nearest wins; when two are about as near (e.g. both contain the tap), the higher priority wins
      const better = !best || d < best.d - 3 || (Math.abs(d - best.d) <= 3 && b.priority > best.priority);
      if (better) best = { kind: b.kind, id: b.id, x: hx, z: hz, d, priority: b.priority };
    }
    return best && { kind: best.kind, id: best.id, x: best.x, z: best.z };
  }
  // where a screen point meets the ground (y = 0), or null
  function ground(cx: number, cy: number) {
    rayAt(cx, cy); plane.constant = 0;
    return ray.ray.intersectPlane(plane, Q) ? { x: Q.x, z: Q.z } : null;
  }
  const hitOrGround = (cx: number, cy: number): Hit | null => {
    const h = pick(cx, cy);
    if (h) return h;
    const g = ground(cx, cy);
    return g && { kind: 'ground', id: null, x: g.x, z: g.z };
  };

  // ---------------------------------------------------------------- gestures
  const downs = new Map<number, { x: number; y: number; t: number; moved: boolean; long: boolean }>();
  let longTimer: ReturnType<typeof setTimeout> | undefined, lastTap: { t: number; x: number; y: number } | null = null;
  const emit = (type: string, hit: Hit, e: PointerEvent) => { for (const fn of handlers[type] ?? []) fn(hit, e); };
  const onDown = (e: PointerEvent) => {
    downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: downs.size > 0, long: false });
    if (downs.size > 1) { for (const d of downs.values()) d.moved = true; clearTimeout(longTimer); return; }
    clearTimeout(longTimer);
    longTimer = setTimeout(() => {
      const d = downs.get(e.pointerId);
      if (!d || d.moved) return;
      d.long = true;
      const h = hitOrGround(d.x, d.y);
      if (h) emit('longpress', h, e);
    }, LONG_MS);
  };
  const onMove = (e: PointerEvent) => {
    const d = downs.get(e.pointerId);
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_PX) { d.moved = true; clearTimeout(longTimer); }
  };
  const onUp = (e: PointerEvent) => {
    const d = downs.get(e.pointerId);
    downs.delete(e.pointerId);
    if (!d) return;
    clearTimeout(longTimer);
    if (d.moved || d.long || performance.now() - d.t > TAP_MS) return;
    const h = hitOrGround(e.clientX, e.clientY);
    if (!h) return;
    emit('tap', h, e);
    const t = performance.now();
    if (lastTap && t - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { emit('doubletap', h, e); lastTap = null; }
    else lastTap = { t, x: e.clientX, y: e.clientY };
  };
  const onCancel = (e: PointerEvent) => { downs.delete(e.pointerId); clearTimeout(longTimer); };
  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onCancel);
  const noMenu = (e: Event) => e.preventDefault();   // right-drag rotates; no context menu
  dom.addEventListener('contextmenu', noMenu);

  return {
    add, remove, pick, ground, boxes,
    on(type: string, fn: HitHandler) { (handlers[type] ||= []).push(fn); return () => { handlers[type] = (handlers[type] ?? []).filter((f) => f !== fn); }; },
    dispose() {
      clearTimeout(longTimer);
      dom.removeEventListener('pointerdown', onDown); dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp); dom.removeEventListener('pointercancel', onCancel); dom.removeEventListener('contextmenu', noMenu);
    },
  };
}
