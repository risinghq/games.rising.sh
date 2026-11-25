// [B] The October crates (plan §3.9, rulings R3, R9): four crates, W1-W4, that fill with big fruit (orange, left) and small
// fruit (gold, right) up to their rim (the weekend's wants), and show their level in a word. The Planting Table draws them
// big and lets them fill live while a row's ripe window is dragged; the Row sheet's status view draws them small all summer.
// Only the selected crate shows its numbers (rulings R3: a phone has room for one line of figures).
//
// crateRow(sh, opts) -> node; fillCrates(node, sh, opts) updates it in place (the drag calls it every frame); crateCaption(c)
// is the selected crate's line. sh is patch.shelf(s, swap?).
import { el } from './dom.js';
import { label, weekends } from '../sim/calendar.js';
import { LINES } from '../sim/patch.js';

const WK = weekends();
const pct = (x) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;
const round5 = (n) => Math.max(0, Math.round(n / 5) * 5);
export const crateDates = (i) => `${label(WK[i].sat)}–${label(WK[i].sun).split(' ')[1]}`;

// opts: { sel: weekend index to show the figures for (-1 none), compact, onTap(i), pulse: [i], last: [[big, small]] }
// last (years 2+, rulings R13): last October's share of each weekend's wants that sold, a faint dashed line on each half
export function crateRow(sh, opts = {}) {
  const row = el('div.crates', { class: opts.compact ? 'compact' : null, role: 'list', 'aria-label': "October's crates" });
  for (const c of sh) {
    const box = el('div.cr-box', {}, el('i.cr-big'), el('i.cr-small'), el('i.cr-lb'), el('i.cr-ls'), el('i.cr-rim'));
    const node = el(opts.onTap ? 'button.crate' : 'div.crate', { role: 'listitem', data: { w: c.i }, onclick: opts.onTap ? () => opts.onTap(c.i) : null },
      box, el('b.cr-id', { text: c.id }), el('span.cr-lv'));
    row.append(node);
  }
  if (!opts.compact) row.append(el('div.cr-cap'));
  fillCrates(row, sh, opts);
  return row;
}
export function fillCrates(row, sh, { sel = -1, pulse = [], last = null } = {}) {
  const nodes = row.querySelectorAll('.crate');
  sh.forEach((c, k) => {
    const n = nodes[k];
    if (!n) return;
    const big = c.needBig ? c.big / c.needBig : 0, small = c.needSmall ? c.small / c.needSmall : 0;
    n.querySelector('.cr-big').style.height = pct(big);
    n.querySelector('.cr-small').style.height = pct(small);
    const lw = c.stage !== 'past' && last?.[c.i];
    for (const [cls, f] of [['.cr-lb', lw?.[0]], ['.cr-ls', lw?.[1]]]) {
      const m = n.querySelector(cls);
      if (m) { m.hidden = f == null; if (f != null) m.style.bottom = pct(f); }
    }
    const lv = c.stage === 'past' ? 'sold' : LINES.level[c.level];
    const was = n.dataset.lv;
    n.dataset.lv = String(c.level);
    n.className = n.className.replace(/\blv\d\b|\bsel\b|\bpast\b|\bpulse\b|\bplunk\b/g, '').trim() + ` lv${c.level}${c.i === sel ? ' sel' : ''}${c.stage === 'past' ? ' past' : ''}${pulse.includes(c.i) ? ' pulse' : ''}`;
    // a crate reaching its rim lands with a plunk (the Table plays the sound)
    if (was != null && +was < 3 && c.level === 3) { n.classList.add('plunk'); row.dispatchEvent(new CustomEvent('plunk', { detail: c.i })); }
    n.querySelector('.cr-lv').textContent = lv;
    n.setAttribute('aria-label', `${c.id}, ${crateDates(c.i)}: ${lv}`);
  });
  const cap = row.querySelector('.cr-cap');
  if (cap) cap.textContent = sel >= 0 && sh[sel] ? crateCaption(sh[sel]) : '';
}
// "W2 wants ~45 big, ~50 small · nothing yet", then "W2: 40 of ~45 big, 50 of ~50 small" (or "W2 · sold ..." once past)
export function crateCaption(c) {
  if (c.stage === 'past') return `${c.id} · sold ${c.big} big, ${c.small} small`;
  // "W1: 25 of ~25 big, 0 of ~30 small" once anything is coming; before that, what the weekend wants
  if (!(round5(c.big) + round5(c.small))) return `${c.id} wants ~${round5(c.needBig)} big, ~${round5(c.needSmall)} small · nothing yet`;
  return `${c.id}: ${round5(c.big)} of ~${round5(c.needBig)} big, ${round5(c.small)} of ~${round5(c.needSmall)} small`;
}
