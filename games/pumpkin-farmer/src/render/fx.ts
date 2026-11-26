// Feedback effects (architecture §5.3, design §1 "10-second loop"): every tap gets something within
// a frame. 3D bits (ripples, squash, particles, dust) live in the scene; coin arcs and floating text
// are DOM in an overlay inside the renderer's container, because they fly to and sit beside DOM UI.
//
// R.fx(ev) types handled here (others are ignored, view modules get them too):
//   { type: 'tap', x, z, kind?, id? }        ripple + squash the tapped thing
//   { type: 'ripple', x, z, color? }
//   { type: 'squash', id, kind?, amount? }   squash-and-stretch a hero object (barn, stand, giant, ...)
//   { type: 'coins', amount, x, z }           coins arc from the world point to the cash counter
//                                            (the element with [data-coin-target], else top-right)
//   { type: 'pop', x, y?, z, color?, n? }    burst of chunky particles
//   { type: 'sparkle', x, y?, z, n? }        twinkles (shinies, ripe rows, records)
//   { type: 'float', text, x, y?, z, cls? }  floating text that rises and fades
//   { type: 'dust', x, z }                   a puff of dust (the farmer's sprint trail)
// The world calls spout(x, y?, z) directly: a misty plume (the whale), particles fall back into the sea.
import * as THREE from 'three';
import { clamp, lerp, billboards, dotTex, starTex } from './kit.js';
import type { V3 } from './kit.js';
import type { FxEvent, Kit } from './types.js';

const CSS = `
.qfx { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1; }
.qfx-coin { position: absolute; left: 0; top: 0; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff3c4, #f2c14e 45%, #c98a1c); box-shadow: 0 1px 2px rgba(60,40,10,.35); will-change: transform; }
.qfx-text { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); white-space: nowrap; will-change: transform, opacity;
  font: 800 16px/1.1 'Nunito Sans', system-ui, sans-serif; color: #fffaf0; text-shadow: 0 1px 0 rgba(40,30,20,.55), 0 0 8px rgba(40,30,20,.35); }
.qfx-text.good { color: #fff3c4; } .qfx-text.bad { color: #ffd2c4; } .qfx-text.big { font-size: 22px; }
`;

interface Particle {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; g: number; t: number; life: number;
  s0: number; s1: number; a0: number; color: number; twinkle?: boolean; floor?: number;
}
interface CoinItem { kind: 'coin'; el: HTMLElement; t: number; life: number; from: Pt; to: Pt; lift: number }
interface TextItem { kind: 'text'; el: HTMLElement; t: number; life: number; at: V3; stack: number }
interface Pt { x: number; y: number }

export function createFx(K: Kit) {
  const { scene, container } = K;
  // ---------------------------------------------------------------- DOM layer
  if (!document.getElementById('qfx-css')) { const st = document.createElement('style'); st.id = 'qfx-css'; st.textContent = CSS; document.head.appendChild(st); }
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const layer = document.createElement('div'); layer.className = 'qfx'; container.appendChild(layer);
  const domItems: (CoinItem | TextItem)[] = [];

  // ---------------------------------------------------------------- ripples (ground rings)
  const ringGeo = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
  const ripples = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.visible = false; m.renderOrder = 3; scene.add(m);
    return { m, t: 1, dur: 0.55, delay: 0 };
  });
  let rippleNext = 0;
  function ripple(x: number, z: number, color = 0xffffff, y0?: number) {              // y0: on the water, not the ground under it
    const y = y0 ?? K.world.heightAt(x, z) + 0.06;
    for (const delay of [0, 0.12]) {
      const r = ripples[rippleNext++ % ripples.length];
      if (!r) break;
      r.m.position.set(x, y, z); r.m.material.color.setHex(color); r.t = -delay; r.delay = delay; r.m.visible = false;
    }
  }

  // ---------------------------------------------------------------- squash and stretch
  interface Squash { t: number; amount: number; dur: number; base: THREE.Vector3 }
  const squashes = new Map<THREE.Object3D, Squash>();
  // obj: an Object3D; amount ~0.15. A damped wobble around the object's resting scale.
  function squash(obj: THREE.Object3D | null | undefined, amount = 0.16, dur = 0.5) {
    if (!obj) return;
    const stored: unknown = obj.userData.baseScale;
    const base = stored instanceof THREE.Vector3 ? stored : obj.scale.clone();
    obj.userData.baseScale = base;
    squashes.set(obj, { t: 0, amount: K.settings.reduceMotion ? amount * 0.4 : amount, dur, base });
  }
  const squashTarget = (...keys: (string | number | null | undefined)[]) => {
    for (const k of keys) {
      const o = k == null ? undefined : K.squashables[String(k)];
      if (o) return o;
    }
    return null;
  };

  // ---------------------------------------------------------------- particles (billboards)
  const sparks = billboards(64, { map: starTex(), blending: THREE.AdditiveBlending });
  const chunks = billboards(96, { map: dotTex() });
  scene.add(sparks.mesh, chunks.mesh);
  const P: { sparks: Particle[]; chunks: Particle[] } = { sparks: [], chunks: [] };
  const col = new THREE.Color();
  function spawn(list: Particle[], cap: number, p: Particle) { if (list.length >= cap) list.shift(); list.push(p); }
  // sparkles: the twinkles that go with it (a close-up passes fewer: up close they are the size of a thumb)
  function pop(x: number, y: number, z: number, color = 0xe0843a, n = 10, sparkles = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 1.2 + Math.random() * 2.2;
      spawn(P.chunks, 96, { x, y, z, vx: Math.cos(a) * v, vy: 2.5 + Math.random() * 2.5, vz: Math.sin(a) * v, g: 9, t: 0, life: 0.6 + Math.random() * 0.3, s0: 0.22, s1: 0.05, a0: 1, color });
    }
    if (sparkles > 0) sparkle(x, y + 0.3, z, sparkles);
  }
  function sparkle(x: number, y: number, z: number, n = 7) {
    for (let i = 0; i < n; i++) {
      spawn(P.sparks, 64, { x: x + (Math.random() - 0.5) * 1.2, y: y + Math.random() * 0.9, z: z + (Math.random() - 0.5) * 1.2, vx: 0, vy: 0.5, vz: 0, g: 0, t: -i * 0.06, life: 0.7, s0: 0.1, s1: 0.5, a0: 1, color: 0xfff3c4, twinkle: true });
    }
  }
  function dust(x: number, z: number, color = 0xcdb894) {
    const y = K.world.heightAt(x, z) + 0.12;
    spawn(P.chunks, 96, { x: x + (Math.random() - 0.5) * 0.3, y, z: z + (Math.random() - 0.5) * 0.3, vx: (Math.random() - 0.5) * 0.4, vy: 0.5, vz: (Math.random() - 0.5) * 0.4, g: 0, t: 0, life: 0.6, s0: 0.25, s1: 0.75, a0: 0.55, color });
  }
  function spout(x: number, y: number, z: number) {
    for (let i = 0; i < 3; i++) {
      spawn(P.chunks, 96, { x: x + (Math.random() - 0.5) * 0.2, y, z: z + (Math.random() - 0.5) * 0.2, vx: (Math.random() - 0.5) * 0.7, vy: 4.2 + Math.random() * 1.6,
        vz: (Math.random() - 0.5) * 0.7, g: 4.5, floor: -5, t: 0, life: 1.3, s0: 0.3, s1: 1.1, a0: 0.7, color: 0xf2f6f5 });
    }
  }
  function stepParticles(b: ReturnType<typeof billboards>, list: Particle[], dt: number) {
    let i = 0;
    for (let k = list.length - 1; k >= 0; k--) {
      const p = list[k];
      if (!p) continue;
      p.t += dt;
      if (p.t >= p.life) { list.splice(k, 1); continue; }
    }
    for (const p of list) {
      if (p.t < 0) { b.hide(i++); continue; }
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.g && p.y < (p.floor ?? 0.05)) { p.y = p.floor ?? 0.05; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
      const k = p.t / p.life, s = lerp(p.s0, p.s1, p.twinkle ? Math.sin(k * Math.PI) : k);
      const a = p.a0 * (p.twinkle ? Math.sin(k * Math.PI) : 1 - k * k);
      b.set(i, p.x, p.y, p.z, s, s, a); b.setColor(i, col.setHex(p.color)); i++;
    }
    for (; i < b.cap; i++) b.hide(i);
    b.commit();
    b.mesh.visible = list.length > 0;
  }

  // ---------------------------------------------------------------- DOM: coins and floating text
  const proj = new THREE.Vector3();
  function screenOf(x: number, y: number, z: number): Pt {
    proj.set(x, y, z).project(K.cam.active);
    return { x: (proj.x + 1) / 2 * layer.clientWidth, y: (1 - proj.y) / 2 * layer.clientHeight };
  }
  function coinTarget(): Pt {
    const el = document.querySelector('[data-coin-target]'), lr = layer.getBoundingClientRect();
    if (el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2 - lr.left, y: r.top + r.height / 2 - lr.top }; }
    return { x: layer.clientWidth - 40, y: 26 };
  }
  function coins(amount: number, x: number, z: number) {
    const from = screenOf(x, 0.8, z);
    const dst = coinTarget(), n = clamp(Math.round(Math.abs(amount) / 6), 3, 9);
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div'); el.className = 'qfx-coin'; layer.appendChild(el);
      const spread = (i - (n - 1) / 2) * 7;
      domItems.push({ el, kind: 'coin', t: -i * 0.05, life: 0.75, from: { x: from.x + spread, y: from.y }, to: dst, lift: 70 + Math.random() * 40 });
    }
  }
  // two floaters at one spot ("+50% water" and "Squish!") stack instead of printing over each other
  function float(text: string, x: number, y: number, z: number, cls = '') {
    const at = screenOf(x, y, z);
    let stack = 0;
    for (const d of domItems) {
      if (d.kind !== 'text' || d.t > d.life * 0.6) continue;
      const o = screenOf(...d.at);
      if (Math.abs(o.x - at.x) < 90 && Math.abs(o.y - d.stack * 30 - at.y) < 34) stack = Math.max(stack, d.stack + 1);
    }
    const el = document.createElement('div'); el.className = 'qfx-text ' + cls; el.textContent = text; layer.appendChild(el);
    domItems.push({ el, kind: 'text', t: 0, life: 1.4, at: [x, y, z], stack: Math.min(stack, 3) });
  }
  function stepDom(dt: number) {
    for (let k = domItems.length - 1; k >= 0; k--) {
      const d = domItems[k];
      if (!d) continue;
      d.t += dt;
      if (d.t >= d.life) { d.el.remove(); domItems.splice(k, 1); continue; }
      if (d.t < 0) { d.el.style.opacity = '0'; continue; }
      const u = d.t / d.life;
      if (d.kind === 'coin') {
        const e = u * u * (3 - 2 * u), x = lerp(d.from.x, d.to.x, e), y = lerp(d.from.y, d.to.y, e) - Math.sin(u * Math.PI) * d.lift;
        d.el.style.opacity = String(u > 0.9 ? (1 - u) * 10 : 1);
        d.el.style.transform = `translate(${x}px, ${y}px) scale(${1 - u * 0.35})`;
      } else {
        const s = screenOf(...d.at);
        d.el.style.opacity = String(u < 0.15 ? u / 0.15 : 1 - smoothish((u - 0.6) / 0.4));
        d.el.style.transform = `translate(-50%, -100%) translate(${s.x}px, ${s.y - 46 * Math.sqrt(u) - d.stack * 30}px) scale(${u < 0.12 ? 0.7 + u * 2.5 : 1})`;
      }
    }
  }
  const smoothish = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

  // ---------------------------------------------------------------- per frame + events
  function update(dt: number) {
    for (const r of ripples) {
      if (r.t >= r.dur) { r.m.visible = false; continue; }
      r.t += dt;
      if (r.t < 0) continue;
      const k = clamp(r.t / r.dur, 0, 1);
      r.m.visible = k < 1;
      r.m.scale.setScalar(lerp(0.25, 1.5, 1 - (1 - k) ** 3) * (r.delay ? 0.75 : 1));
      r.m.material.opacity = 0.85 * (1 - k);
    }
    for (const [obj, q] of squashes) {
      q.t += dt;
      const k = q.t / q.dur;
      if (k >= 1) { obj.scale.copy(q.base); squashes.delete(obj); continue; }
      const w = q.amount * Math.exp(-5 * k) * Math.cos(k * Math.PI * 3.2);
      obj.scale.set(q.base.x * (1 + w * 0.5), q.base.y * (1 - w), q.base.z * (1 + w * 0.5));
    }
    stepParticles(sparks, P.sparks, dt);
    stepParticles(chunks, P.chunks, dt);
    stepDom(dt);
  }
  function handle(ev: FxEvent) {
    switch (ev.type) {
      case 'tap': ripple(ev.x, ev.z); squash(squashTarget(ev.id, ev.kind)); break;
      case 'ripple': ripple(ev.x, ev.z, ev.color); break;
      case 'squash': squash(squashTarget(ev.id, ev.kind), ev.amount); break;
      case 'coins': coins(ev.amount, ev.x, ev.z); break;
      case 'pop': pop(ev.x, ev.y ?? 0.5, ev.z, ev.color, ev.n, ev.sparkles); break;
      case 'sparkle': sparkle(ev.x, ev.y ?? 0.3, ev.z, ev.n); break;
      case 'float': float(ev.text, ev.x, ev.y ?? 1.6, ev.z, ev.cls); break;
      case 'dust': dust(ev.x, ev.z, ev.color); break;
    }
  }
  return {
    handle, update, ripple, squash, pop, sparkle, dust, spout, coins, float,
    dispose() { layer.remove(); ringGeo.dispose(); for (const r of ripples) r.m.material.dispose(); },
  };
}
