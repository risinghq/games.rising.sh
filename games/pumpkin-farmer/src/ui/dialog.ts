// The townsfolk dialogue card (design §12): slides down under the HUD with a portrait (each character's head
// rendered once from its 3D model via R.portrait), name and 1-3 lines typed out with a soft babble. Tap to finish
// the line, tap again for the next; the last tap dismisses (story/dialogSeen). Intros hold the clock until read;
// chatter dismisses itself after a few seconds.
import { $, el } from './dom.js';
import { SPEAKERS, SPECIES } from '../sim/story.js';
import type { State } from '../sim/types.js';
import type { Api } from './types.js';
import { StoryDialog } from '../sim/state.js';

const CPS = 48;                                   // typewriter characters per second
const PITCH = { possum: 1.25, skunk: 1.1, raccoon: 1.15, beaver: 0.95, coyote: 0.9, fox: 1.05, owl: 0.8, pelican: 0.85, otter: 1.2, seal: 0.75, weighmaster: 0.55 };
const urlCache = new Map();

// A speaker's portrait as a data URL (rendered once from the 3D model, then cached), or null.
function portraitUrl(api: Api, key: string, s: State) {
  const sp = SPEAKERS[key], species = s?.meta?.species || 'possum';
  if (sp?.portrait === false) return null;           // a voice with no face (Grandpa's notes): the initial on paper
  const pkey = sp?.portrait || key, ck = `${pkey}|${pkey === 'gran' || pkey === 'farmer' ? species : ''}`;
  let url = urlCache.get(ck);
  if (url === undefined) {
    try { url = api.R?.portrait?.(pkey, { species }) || null; } catch { url = null; }
    if (url && typeof url === 'string') urlCache.set(ck, url);
  }
  return url;
}
// A round portrait for a speaker id (SPEAKERS) or a species key, with an initial-letter fallback.
export function portraitEl(api: Api, key: string, s: State|null, cls = '') {
  const sp = SPEAKERS[key], url = portraitUrl(api, key, s);
  const n = el('div.portrait', { class: cls || null, style: { '--accent': sp?.accent || 'var(--sage)' } });
  if (typeof url === 'string') n.append(el('img', { src: url, alt: '', draggable: 'false' }));
  else n.append(el('span.initial', { text: (sp?.name || SPECIES[key]?.one || key || '?').replace(/^(The|Mayor|Officer|Prof\.|Old)\s+/, '')[0].toUpperCase() }));
  return n;
}
export const clearPortraits = () => urlCache.clear();
// The year's speakers, rendered a frame apart while the fog curtain hides the farm: a portrait's first render builds a
// WebGL context, which can stall a phone for a frame or two, better in the fog than on Gran's first line. Gran first.
// (Never the Weighmaster: he is nobody's business before the weigh-off.)
const YEAR_SPEAKERS = ['gran', 'hal', 'moss', 'edna', 'vance', 'mayor', 'dez', 'possumMom'];
export function warmPortraits(api: Api, s: State, keys = YEAR_SPEAKERS) {
  const list = [...keys];
  const step = () => { const k = list.shift(); if (k == null) return; portraitUrl(api, k, s); requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

export function createDialog(api: Api) {
  const root = $('#dialog');
  let cur: { node: any; idx?: any; shown?: any; age?: any; item: any; pips?: any; lineEl?: any; more?: any; pitch?: any; }|null = null, tappedAt = -1e9;

  function speakerInfo(key: string, s: State) {
    const sp = SPEAKERS[key] || { name: key };
    return { name: sp.name, role: key === 'gran' ? `Your grandmother · ${s.meta.surname} farm` : sp.role || '', species: sp.species || s.meta.species };
  }
  function show(item: StoryDialog, s: State) {
    cur?.node.remove();
    const info = speakerInfo(item.speaker, s);
    const lineEl = el('div.line'), pips = el('div.pips'), more = el('span.more');
    // (Hal is on the radio; Grandpa is a note in his hand: firsts.css draws it on paper)
    const node = el('div.talk', { class: item.speaker === 'hal' ? 'radio' : item.speaker === 'grandpa' ? 'note' : null, role: 'status', 'aria-label': `${info.name} says` },
      portraitEl(api, item.speaker, s),
      el('div.body', {}, el('div.who', {}, el('b', { text: info.name }), info.role ? el('span', { text: info.role }) : null), lineEl,
        el('div.foot', {}, pips, more)));
    node.addEventListener('click', tap);
    root.append(node);
    requestAnimationFrame(() => node.classList.add('in'));
    document.body.classList.add('talking');
    cur = { item, node, lineEl, pips, more, idx: 0, shown: 0, age: 0, pitch: PITCH[info.species] || 1 };
    if (item.glide && !api.settings.reduceMotion) api.glide(item.glide.x, item.glide.z, item.glide.zoom);
    setLine(0);
    api.sound('pop');
  }
  function setLine(i: number) {
    cur.idx = i; cur.shown = api.settings.reduceMotion ? 1e9 : 0; cur.age = 0;
    const n = cur.item.lines.length;
    cur.pips.innerHTML = n > 1 ? cur.item.lines.map((_: any, k: number) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('') : '';
    render();
  }
  function render() {
    const text = cur.item.lines[cur.idx] || '', k = Math.min(text.length, Math.floor(cur.shown));
    // *word* is emphasis in the line pools
    const html = (s: string) => s.replace(/[&<>]/g, (c: string|number) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\*([^*]+)\*/g, '<em>$1</em>');
    cur.lineEl.innerHTML = html(text.slice(0, k)) + (k < text.length ? `<span style="opacity:0">${html(text.slice(k))}</span>` : '');
    const last = cur.idx >= cur.item.lines.length - 1;
    cur.more.textContent = k < text.length ? '' : last ? 'Tap to close' : 'Tap ▸';
  }
  function typing() { return cur && Math.floor(cur.shown) < (cur.item.lines[cur.idx] || '').length; }
  function tap(e?: { stopPropagation: () => void; }|undefined) {
    e?.stopPropagation();
    if (!cur) return;
    if (e) tappedAt = performance.now();
    api.haptic(6);
    if (typing()) { cur.shown = 1e9; render(); return; }
    if (cur.idx < cur.item.lines.length - 1) { setLine(cur.idx + 1); api.sound('tick'); return; }
    dismiss();
  }
  function dismiss() {
    const { node, item } = cur;
    cur = null;
    node.classList.add('out');
    setTimeout(() => node.remove(), 220);
    document.body.classList.remove('talking');
    api.dispatch({ type: 'story/dialogSeen', id: item.id });
  }

  return {
    sync(s: State, rdt: number) {
      const head = s.story.dialog[0];
      // chatter waits while a decision card is up (a lapse line at closing time would talk over the evening card)
      const hold = head && !head.pause && api.blockedByUi?.() && cur?.item.id !== head.id;
      if (!head || hold) { if (cur) { cur.node.remove(); cur = null; document.body.classList.remove('talking'); } return; }
      if (!cur || cur.item.id !== head.id) show(head, s);
      const before = Math.floor(cur.shown);
      cur.shown += rdt * CPS; cur.age += rdt;
      const after = Math.floor(Math.min(cur.shown, (cur.item.lines[cur.idx] || '').length));
      if (after !== before) {
        if (after % 3 === 0 && after > before) api.sound('babble', { pitch: cur.pitch });
        render();
      }
      // chatter (not an intro) moves itself along so it never parks on screen
      const text = cur.item.lines[cur.idx] || '';
      if (!head.pause && !typing() && cur.age > 2.6 + text.length * 0.035) tap();
    },
    tap,
    get open() { return !!cur; },
    // A quick extra tap after the last line closes the card would land on the farm behind it (a row sheet, a giant
    // sheet): swallow world taps for a moment after the player taps a card.
    get justTapped() { return performance.now() - tappedAt < 650; },
  };
}
