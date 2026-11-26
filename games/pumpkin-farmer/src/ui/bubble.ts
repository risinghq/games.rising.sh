// The anchored two-button bubble (plan §3.1, rulings R12): a small choice that sits over the thing it is about (Pamela in the
// bramble, the possum in a row, Gran asking about an empty row) instead of a centred modal. min(320 px, 100vw - 32 px)
// wide; a title line; at most a short text; stacked choices at least 48 px tall with a 16 px label and a 14-15 px sub that
// says the consequence plainly. Tapping outside the bubble picks the default. It follows its anchor as the camera moves and
// always stays fully on screen, between the HUD and the tray (pins.js fitPopup).
//
// Sim cards (they hold the clock, like any card):
//   registerCard(kind, bubbleCard({ anchor?(s, card) -> world point | null, lift? }))   anchor defaults to card.data.at
//   data: { title, text?, speaker?, choices: [{ id, label, sub?, primary? }], defaultChoice, at?: { x, y?, z } }
// UI only (no sim card): api.bubble({ title, text?, speaker?, choices, defaultChoice, at? }) -> Promise<choice id>
import { $, el } from './dom.js';
import { anchored, fitPopup } from './pins.js';
import { portraitEl } from './dialog.js';
import type { Api } from './types.js';
import { OutEvent } from '../sim/out-event.js';
import { State } from '../sim/state.js';
import { ActionResult } from '../sim/types.js';

const LIFT = 64;                                     // px above the anchor point: clear of a pin drawn over it
const BELOW = 18;                                    // px below the point when there's no room above (the pin stays clear)
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

// Fill `box` with the bubble's content; onPick(id) when a choice (or the default, from outside) is picked.
export function buildBubble(box: { classList: { add: (arg0: string) => void; }; _picked: boolean; _pickDefault: () => void; append: (arg0: any) => void; }, s: State|null, d: { choices: string|any[]; defaultChoice: any; speaker: any; title: any; text: any; }, api: Api, onPick: { (choice: any): ActionResult&{ events: OutEvent[]; }; (id: any): void; (arg0: any): void; }) {
  box.classList.add('bubble');
  const choices = d.choices?.length ? d.choices : [{ id: 'ok', label: 'OK' }];
  const pick = (id: any) => { if (box._picked) return; box._picked = true; onPick(id); };
  box._pickDefault = () => pick(d.defaultChoice ?? choices[0].id);
  box.append(el('div.bb-head', {}, d.speaker ? portraitEl(api, d.speaker, s, 'small') : null, el('div.bb-title', { text: d.title || '' })));
  if (d.text) box.append(el('p.bb-text', { text: d.text }));
  box.append(el('div.bb-choices', {}, choices.map((ch: { primary: any; id: any; label: any; sub: any; }) => el('button.bb-choice', { class: ch.primary ? 'primary' : null, data: { choice: ch.id },
    onclick: (e: { stopPropagation: () => void; }) => { e.stopPropagation(); pick(ch.id); } }, el('b', { text: ch.label }), ch.sub ? el('span', { text: ch.sub }) : null))));
  return box;
}
// Keep the bubble over its world point, its tail pointing at it (or low in the middle of the screen when it has none). Near
// the top of the screen it flips below the point; either way it stays inside the band between the HUD and the tray.
function anchorTo(box: { classList: { add: (arg0: string) => void; }; append: (arg0: any) => void; }, pos: any, lift = LIFT) {
  if (!pos) { box.classList.add('free'); return; }
  const tail = el('i.bb-tail');
  box.append(tail);
  anchored.set(box, { pos: () => pos, lift, place: (pr: any, rect: any, n: any) => place(n, tail, pr, rect, lift) });
}
function place(n: { offsetWidth: any; offsetHeight: any; classList: { toggle: (arg0: string,arg1: boolean) => void; }; style: { left: string; top: string; }; }, tail: { hidden: boolean; style: { left: string; }; }, pr: { x: number; y: number; }, rect: { l: number; r: number; t: number; b: number; }, lift: number) {
  const w = n.offsetWidth, h = n.offsetHeight;
  const x = clamp(pr.x, rect.l - 30 + w / 2 + 8, rect.r + 30 - w / 2 - 8);
  const above = pr.y - lift - h >= rect.t, below = !above && pr.y + BELOW + h <= rect.b;
  let y;
  if (above) y = pr.y - lift;
  else if (below) y = pr.y + BELOW;
  else ({ y } = fitPopup(x, pr.y - lift, w, h, rect));
  n.classList.toggle('below', below);
  n.style.left = `${x}px`; n.style.top = `${y}px`;
  tail.hidden = !above && !below;
  tail.style.left = `${clamp(pr.x - x, -w / 2 + 22, w / 2 - 22) + w / 2}px`;
}
// One listener on the cards layer: a tap outside an open bubble picks its default (and never reaches the farm).
let outsideReady = false;
function listenOutside() {
  const root = $('#cards');
  if (outsideReady || !root) return;
  outsideReady = true;
  root.addEventListener('pointerdown', (e: { target: any; preventDefault: () => void; stopPropagation: () => void; }) => {
    if (e.target !== root) return;
    const b = root.querySelector('.decision.bubble');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    b._pickDefault?.();
  });
}

export function bubbleCard({ anchor = (s: any, card: { data: string|any[]; }) => card.data?.at || null, lift = LIFT } = {}) {
  return {
    build(box: any, s: any, card: { data: any; id: any; }, api: Api) {
      listenOutside();
      buildBubble(box, s, card.data || {}, api, (choice: any) => api.dispatch({ type: 'card/answer', id: card.id, choice }));
      const at = anchor(s, card);
      anchorTo(box, at && { x: at.x, y: at.y ?? 0.4, z: at.z }, lift);
    },
  };
}

// A bubble that isn't a sim card (the UI asks something quick). Shown on the cards layer like api.confirm; resolves with the
// picked choice id.
export function openBubble(api: Api, d: { at: { x: any; y: any; z: any; }; lift: any; }) {
  const root = $('#cards');
  listenOutside();
  return new Promise((resolve) => {
    const prev = [...root.childNodes], wasOn = root.classList.contains('on');
    const box = el('div.decision', { role: 'dialog', 'aria-modal': 'true' });
    const done = (id: unknown) => { anchored.delete(box); box.remove(); prev.forEach((n) => root.append(n)); root.classList.toggle('on', wasOn); resolve(id); };
    buildBubble(box, api.s(), d, api, done);
    prev.forEach((n) => n.remove());
    root.append(box);
    root.classList.add('on');
    anchorTo(box, d.at && { x: d.at.x, y: d.at.y ?? 0.4, z: d.at.z }, d.lift ?? LIFT);
    api.sound('pop'); api.haptic(10);
  });
}
