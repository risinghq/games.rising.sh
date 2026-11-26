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
import type { Api, At, BubbleSpec } from './types.js';
import type { State, Card } from '../sim/types.js';
import type { Projected } from '../render/types.js';

const LIFT = 64;                                     // px above the anchor point: clear of a pin drawn over it
const BELOW = 18;                                    // px below the point when there's no room above (the pin stays clear)
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** The bubble's box carries its one-pick latch and the outside-tap default picker. */
type BubbleBox = HTMLElement & { _picked?: boolean; _pickDefault?: () => void };
/** The content half of a BubbleSpec; the anchor fields go to anchorTo instead. */
type BubbleData = Pick<BubbleSpec, 'text' | 'title' | 'speaker' | 'choices' | 'defaultChoice'>;

// Fill `box` with the bubble's content; onPick(id) when a choice (or the default, from outside) is picked.
export function buildBubble(box: BubbleBox, s: State|null, d: BubbleData, api: Api, onPick: (id: string) => void) {
  box.classList.add('bubble');
  const choices = d.choices?.length ? d.choices : [{ id: 'ok', label: 'OK' }];
  const pick = (id: string) => { if (box._picked) return; box._picked = true; onPick(id); };
  box._pickDefault = () => pick(d.defaultChoice ?? choices[0]?.id ?? 'ok');
  box.append(el('div.bb-head', {}, d.speaker ? portraitEl(api, d.speaker, s, 'small') : null, el('div.bb-title', { text: d.title || '' })));
  if (d.text) box.append(el('p.bb-text', { text: d.text }));
  box.append(el('div.bb-choices', {}, choices.map((ch) => el('button.bb-choice', { class: ch.primary ? 'primary' : null, data: { choice: ch.id },
    onclick: (e) => { e.stopPropagation(); pick(ch.id); } }, el('b', { text: ch.label }), ch.sub ? el('span', { text: String(ch.sub) }) : null))));
  return box;
}
// Keep the bubble over its world point, its tail pointing at it (or low in the middle of the screen when it has none). Near
// the top of the screen it flips below the point; either way it stays inside the band between the HUD and the tray.
function anchorTo(box: BubbleBox, pos: At | null, lift = LIFT) {
  if (!pos) { box.classList.add('free'); return; }
  const tail = el('i.bb-tail');
  box.append(tail);
  anchored.set(box, { pos: () => pos, lift, place: (pr, rect, n) => place(n, tail, pr, rect, lift) });
}
function place(n: HTMLElement, tail: HTMLElement, pr: Projected, rect: { l: number; r: number; t: number; b: number }, lift: number) {
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
  root.addEventListener('pointerdown', (e) => {
    if (e.target !== root) return;
    const b = root.querySelector<BubbleBox>('.decision.bubble');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    b._pickDefault?.();
  });
}

export function bubbleCard({ anchor = (_s: State, card: Card) => card.data?.at || null, lift = LIFT }: { anchor?: (s: State, card: Card) => At | null; lift?: number } = {}) {
  return {
    build(box: BubbleBox, s: State, card: Card, api: Api) {
      listenOutside();
      buildBubble(box, s, { text: card.data.text ?? undefined, title: card.data.title, speaker: card.data.speaker, choices: card.data.choices.map((ch) => ({ ...ch })), defaultChoice: card.data.defaultChoice }, api, (choice) => api.dispatch({ type: 'card/answer', id: card.id, choice }));
      const at = anchor(s, card);
      anchorTo(box, at && { x: at.x, y: at.y ?? 0.4, z: at.z }, lift);
    },
  };
}

// A bubble that isn't a sim card (the UI asks something quick). Shown on the cards layer like api.confirm; resolves with the
// picked choice id.
export function openBubble(api: Api, d: BubbleSpec) {
  const root = $('#cards');
  listenOutside();
  return new Promise<string>((resolve) => {
    if (!root) return resolve('');
    const prev = [...root.childNodes], wasOn = root.classList.contains('on');
    const box = el('div.decision', { role: 'dialog', 'aria-modal': 'true' });
    const done = (id: string) => { anchored.delete(box); box.remove(); prev.forEach((n) => root.append(n)); root.classList.toggle('on', wasOn); resolve(id); };
    buildBubble(box, api.s(), d, api, done);
    prev.forEach((n) => n.remove());
    root.append(box);
    root.classList.add('on');
    anchorTo(box, d.at ? { x: d.at.x, y: d.at.y ?? 0.4, z: d.at.z } : null, d.lift ?? LIFT);
    api.sound('pop'); api.haptic(10);
  });
}
