// The anchored caption (plan §2.2, §3.4): a poke's answer, shown right above the thing that was tapped so it reads as the
// object talking ("Nobody's home. Marlene's in, so the bees are too."). At most one at a time (a new one replaces it), it
// lives 1.8 s + 40 ms a character, is never queued, and never shows while a sheet is open or a lesson is being read. It
// follows the camera and stays on screen at every edge (pins.js anchored + fitPopup). Taps go through it to the farm unless
// it has an onTap (a locked thing's caption can open what's coming).
//
// api.captionAt(at: { x, y?, z }, text, { onTap?, cls?, ms? }) -> the node, or null when it can't show now
import { $, el } from './dom.js';
import { anchored } from './pins.js';
import { T } from '../sim/tuning.js';

const C = T.ui.caption;
export const captionMs = (text, ms) => ms ?? C.ms + String(text).length * C.perChar;

export function createCaption(api) {
  let cur = null;
  function hide() {
    if (!cur) return;
    const { node, timer } = cur;
    cur = null;
    clearTimeout(timer);
    anchored.delete(node);
    node.classList.add('out');
    setTimeout(() => node.remove(), 220);
  }
  function show(at, text, { onTap = null, cls = null, ms } = {}) {
    const s = api.s();
    if (!s || !text || !at || api.currentSheet() || s.story.dialog[0]?.pause || api.blockedByUi()) return null;
    hide();
    const t = String(text).slice(0, C.maxChars);
    const node = el('div.caption-pop', { class: [cls, onTap ? 'tappable' : null].filter(Boolean).join(' ') || null, role: 'status' }, el('span', { text: t }));
    if (onTap) node.addEventListener('click', (e) => { e.stopPropagation(); hide(); onTap(api); });
    $('#pins').append(node);
    anchored.set(node, { pos: () => ({ x: at.x, y: at.y ?? 0.6, z: at.z }), lift: 16 });
    cur = { node, timer: setTimeout(hide, captionMs(t, ms)) };
    return node;
  }
  return { show, hide, get open() { return !!cur; } };
}
