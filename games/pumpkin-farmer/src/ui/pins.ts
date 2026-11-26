// World pins (design §12): 48px DOM markers positioned every frame from projected 3D points (R.project), at most
// 12. A pin whose point is off screen (or under the HUD or tray) becomes an edge arrow at the nearest screen edge,
// pointing at it, so the player always knows where to look.
import { $, el, icon, need } from './dom.js';
import { REG } from './registry.js';
import { T } from '../sim/tuning.js';
import type { Api, PinDef, At } from './types.js';
import type { Projected } from '../render/types.js';
import type { State } from '../sim/types.js';

/** A pin's spot on screen: its node and its point, edge arrows carry edge. */
interface PlacedPin { n: HTMLElement; x: number; y: number; edge?: boolean }
/** The safe rectangle pins live in. */
interface SafeRect { l: number; r: number; t: number; b: number }

// Pins never overlap as tap targets: a few [?] families in line at the stand fan out side by side over their heads
// instead of stacking 3-5 deep. A few passes of pairwise pushes, from the same projected points every frame (so the fan
// is steady, not jittery); the earlier pin of a pair keeps its place where it can.
const GAP = 52;
export function spread(ps: PlacedPin[], rect: SafeRect) {
  for (let it = 0; it < 6; it++) {
    let moved = false;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      if (!a || !b) continue;
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d >= GAP) continue;
      const edge = a.edge || b.edge;
      if (d < 1) { dx = edge ? 0 : j % 2 ? 1 : -1; dy = edge ? 1 : 0; d = 1; }
      // side by side reads best above heads: push mostly sideways (edge arrows slide along their edge instead)
      const ux = dx / d, uy = dy / d, push = (GAP - d) / 2;
      const kx = edge ? ux : Math.abs(ux) < 0.5 ? (ux < 0 ? -1 : 1) : ux, ky = edge ? (Math.abs(uy) < 0.5 ? (uy < 0 ? -1 : 1) : uy) : uy * 0.5;
      a.x -= kx * push; b.x += kx * push; a.y -= ky * push; b.y += ky * push;
      moved = true;
    }
    for (const p of ps) { p.x = Math.max(rect.l, Math.min(rect.r, p.x)); p.y = Math.max(rect.t + (p.edge ? 0 : 30), Math.min(rect.b, p.y)); }
    if (!moved) break;
  }
}

// A popup anchored to a world point (the squish buttons) is placed with the pins every frame, so it follows the camera
// as the player pans, and is kept inside the same safe rectangle: the #pins layer sits under the HUD and the tray, so a
// popup left at its raw projected point could end up behind them where it can't be tapped. The popup is drawn centred
// above its point (translate(-50%, -100%)), w x h px; returns the clamped point.
export const anchored = new Map<HTMLElement, { pos: () => At; lift?: number; place?: (pr: Projected, rect: SafeRect, n: HTMLElement) => void }>();   // node -> { pos: () => world point { x, y, z }, lift: px the popup sits above it,
                                     //   place?(pr, rect, node): places the node itself (the bubble flips below its point) }
export function fitPopup(x: number, y: number, w: number, h: number, rect: SafeRect) {
  const l = rect.l - 30 + w / 2 + 8, r = rect.r + 30 - w / 2 - 8;
  return { x: l > r ? (rect.l + rect.r) / 2 : Math.max(l, Math.min(r, x)), y: Math.max(rect.t + h, Math.min(rect.b, y)) };
}

export function createPins(api: Api) {
  const root = need('#pins');
  const nodes = new Map<string, HTMLElement>();

  function node(def: PinDef) {
    let n = nodes.get(def.id);
    if (!n) {
      // (def.cls: a pin style, e.g. track A's gold ✦ "delight" pin: something happened, have a look)
      n = el('button.pin', { class: def.cls || null, 'aria-label': def.label || def.id, 'data-tip': def.label || null, html: icon(def.icon || 'alert') + '<span class="arrow"></span>' });
      n.addEventListener('click', (e) => { e.stopPropagation(); api.haptic(8); api.sound('tick'); def.onTap(api); });
      root.append(n);
      nodes.set(def.id, n);
    }
    return n;
  }
  // Safe rectangle for pins: below everything at the top (the HUD, the goal chip and, on weekends, the Route 46 row),
  // above the tray. A pin is drawn 58 px above its point (.pin margin), so a pin is inside when its point is 58 px below t.
  const bottomOf = (sel: string) => { const n = $(sel); return n && n.offsetParent !== null ? n.getBoundingClientRect().bottom : 0; };
  function safeRect() {
    const top = Math.max(bottomOf('#hud') || 60, bottomOf('#nextup .goal'), bottomOf('#wkrow .wk')) + 6;
    const bottom = ($('#tray')?.getBoundingClientRect().top || innerHeight - 130) - 10;
    return { l: 30, r: innerWidth - 30, t: top, b: Math.max(top + 100, bottom) };
  }

  return {
    sync(s: State) {
      const live = new Set<string>();
      if (s && api.R?.project) {
        // edge arrows (44 px, centred on their point) keep inside the same band
        const rect = safeRect(), cx = (rect.l + rect.r) / 2, cy = (rect.t + rect.b) / 2, edgeR = { ...rect, t: rect.t + 26 };
        let count = 0;
        const placed: PlacedPin[] = [];
        for (const def of REG.pins) {
          if (count >= T.ui.maxPins) break;
          let on = false;
          try { on = def.when(s); } catch { on = false; }
          if (!on) continue;
          const p = def.pos(s);
          if (!p) continue;
          const pr = api.R.project(p.x, p.y ?? 0, p.z);
          if (!pr) continue;
          count++; live.add(def.id);
          const n = node(def);
          n.classList.toggle('urgent', !!def.urgent?.(s));
          const inside = pr.visible !== false && pr.x >= rect.l && pr.x <= rect.r && pr.y - 58 >= rect.t && pr.y <= rect.b;
          if (inside) {
            n.classList.remove('edge');
            placed.push({ n, x: pr.x, y: pr.y });
          } else {
            // walk from the centre toward the point until the safe rectangle's edge
            let dx = pr.x - cx, dy = pr.y - cy;
            if (pr.visible === false && dx === 0 && dy === 0) dy = 1;
            const k = Math.min(Math.abs((edgeR.r - cx) / (dx || 1e-6)), Math.abs(((dy < 0 ? edgeR.t : edgeR.b) - cy) / (dy || 1e-6)));
            const ex = cx + dx * Math.min(1, k), ey = cy + dy * Math.min(1, k);
            n.classList.add('edge');
            placed.push({ n, x: ex, y: ey, edge: true });
            const arrow = n.querySelector<HTMLElement>('.arrow');
            if (arrow) arrow.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
          }
        }
        spread(placed, rect);
        for (const p of placed) p.n.style.transform = `translate(${p.x}px, ${p.y}px)`;
        for (const [n, a] of anchored) {
          if (!n.isConnected) { anchored.delete(n); continue; }
          const p = a.pos(), pr = api.R.project(p.x, p.y ?? 0, p.z);
          if (!pr) continue;
          if (a.place) { a.place(pr, rect, n); continue; }
          const f = fitPopup(pr.x, pr.y - (a.lift || 0), n.offsetWidth, n.offsetHeight, rect);
          n.style.left = `${f.x}px`; n.style.top = `${f.y}px`;
        }
      }
      for (const [id, n] of nodes) if (!live.has(id)) { n.remove(); nodes.delete(id); }
    },
    clear() { for (const n of nodes.values()) n.remove(); nodes.clear(); },
    get count() { return nodes.size; },      // pins on screen now (rulings R12: at most 12; the quiet-day hurry waits for none)
  };
}
