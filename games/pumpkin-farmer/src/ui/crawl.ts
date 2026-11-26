// [C] The first tape, in public (plan §3.13 lean, rulings R0, R5, R12): the Vine Crawl's card, and the count-up every tape
// gets. Styles: css/crawl.css.
//
// The card holds the clock like any card and walks three steps on one surface (no rigs on the farm, no review, no buzz):
//   1. Your guess   Hal is live on the radio; Vance and Big Tom call her weight by eye, each in their own words; you may
//                   knock first (the word is the pitch: THOONK means she'll tape heavier than she looks), then pick a range.
//   2. The tape     Edna hands you the end: PULL THE TAPE (56 px) dispatches crawl/pull, the real tape.
//   3. The reveal   the inches count up in a 40 px number, convert to pounds, the guesses within 10% turn green, Edna has
//                   her verdict, and the pace line says what it means. Done answers the card (the first rung of the ladder
//                   and Edna's Sunday-tape promise come with it).
// Every other tape you take (Measure) gets the same count-up in a small panel over the farm (countUp), which reads only the
// tape's own numbers (ott, est, the pace line): never the hidden weight.
import { $, el, icon, fmt } from './dom.js';
import { registerCard } from './registry.js';
import { portraitEl } from './dialog.js';
import { PLACES } from '../sim/layout.js';
import { CL } from '../sim/lines-giant.js';
import { T } from '../sim/tuning.js';
import type { ActionResult, OutEvent } from '../sim/types.js';
import type { Api } from './types.js';
import { Crawl } from '../sim/state.js';
import type { Pace } from '../sim/out-event.js';

const COUNT_MS = 1200, HOLD_MS = 3400;
// the knock's word is its pitch (sound may be off): deep means dense. The bands are the ones a knock-reading bot uses
// (T.crawl.knockRead), so "THOONK" means the same thing to a player as it does in the balance tests.
const band = (pitch: number) => (pitch < 1 - T.crawl.knockRead ? 'deep' : pitch > 1 + T.crawl.knockRead ? 'high' : 'mid');
export const knockWord = (pitch: number|undefined) => ({ deep: 'THOONK.', high: 'tonk.', mid: 'thunk.' })[band(pitch)];
const knockLine = (pitch: unknown) => CL.crawl.knockWords[band(pitch)];
const reduce = (api: Api) => !!api.settings?.reduceMotion;

// Count the inches up into `node`, then show the pounds. done() after the count.
function count(api: Api, node: { append: (arg0: any,arg1: any) => void; }, ott: number|undefined, est: number|undefined, done: { (): void; (): void; (): void; }) {
  const big = el('b.cu-num'), unit = el('span.cu-unit', { text: 'in' }), lb = el('div.cu-lb');
  node.append(el('div.cu-row', {}, big, unit), lb);
  const t0 = performance.now(), end = () => { big.textContent = fmt.int(ott); lb.textContent = `≈ ${fmt.int(est)} lb`; lb.classList.add('in'); api.sound('ching'); api.haptic(14); done?.(); };
  if (reduce(api)) { end(); return; }
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / COUNT_MS), e = 1 - (1 - k) ** 3;
    big.textContent = fmt.int(Math.round(ott * e));
    if (Math.floor(ott * e / 6) !== Math.floor(ott * Math.max(0, e - 0.04) / 6)) api.sound('tick', { pitch: 0.8 + e * 0.6 });
    if (k < 1) requestAnimationFrame(step); else end();
  };
  requestAnimationFrame(step);
}
const paceText = (pc: Pace | null | undefined) => (pc ? `${CL.pace.line.replace('{lb}', fmt.int(pc.lb)).replace('{give}', fmt.int(pc.give))} ${CL.pace.vance.replace('{v}', fmt.int(pc.vance))}` : CL.pace.none);

// ------------------------------------------------------------ your own Measure: the count-up
// In her sheet's tape bar, right under your thumb and clear of her (the pace line under it already says what it means);
// anywhere else, a small panel under the HUD.
let panel: { remove: () => void; }|null = null;
export function countUp(api: Api, ev: OutEvent, delta: string) {
  panel?.remove();
  const bar = document.querySelector('#sheet.open .giant-tapebar');
  const node = el(bar ? 'div.cu-inline' : 'div.cu-panel', { role: 'status', 'aria-live': 'polite' });
  const close = () => { if (panel === node) panel = null; node.classList.add('out'); setTimeout(() => node.remove(), 220); };
  node.addEventListener('pointerdown', (e: { preventDefault: () => void; stopPropagation: () => void; }) => { e.preventDefault(); e.stopPropagation(); close(); });
  if (bar) bar.insertBefore(node, bar.querySelector('.giant-pace')); else $('#game-ui').append(node);
  panel = node;
  count(api, node, ev.ott, ev.est, () => {
    node.querySelector('.cu-lb')?.append(el('span.cu-delta', { text: ` · ${delta}` }));
    if (!bar) node.append(el('div.cu-pace', { text: paceText(ev.pace) }));
    // it stays up long enough to read (frame time, so a paused or slow frame never cuts it short), then goes
    const t0 = performance.now(), wait = () => { if (panel !== node) return; if (performance.now() - t0 > HOLD_MS) close(); else requestAnimationFrame(wait); };
    requestAnimationFrame(wait);
  });
}

// ------------------------------------------------------------ the Vine Crawl's card
const who = (g: { who: string|number; }) => ({ vance: 'Vance', tom: 'Big Tom' }[g.who] || g.who);
registerCard('crawl', {
  build(box, s, card, api: Api) {
    const d = card.data, C = CL.crawl;
    box.classList.add('crawl-card');
    const h2 = el('h2', { text: d.title });
    box.append(el('div.head', {}, portraitEl(api, 'edna', s), el('div', {}, el('div.eyebrow', { text: d.eyebrow }), h2)));
    const body = el('div.crawl-body');
    box.append(body);
    let pick: null = null, knocked: unknown = null;
    // the fence: Hal on the radio, then Vance and Big Tom by eye
    const fence = () => el('div.crawl-fence', {},
      el('div.crawl-say.radio', {}, portraitEl(api, 'hal', s, 'small'), el('span', { text: d.hal })),
      ...d.guesses.map((g: { who: any; speaker: any; line: any; n: any; }) => el('div.crawl-say', { data: { who: g.who } }, portraitEl(api, g.speaker, s, 'small'),
        el('span', { text: g.line }), el('b.crawl-n', { text: `${fmt.int(g.n)} lb` }))));
    const guess = () => {
      body.innerHTML = '';
      const kb = el('button.crawl-knock', { onclick: () => {
        const r = api.dispatch({ type: 'giant/knock' });
        if (!r.ok) return;
        knocked = r.pitch;
        kb.querySelector('b').textContent = knockLine(r.pitch);
        kb.classList.toggle('deep', r.pitch < 0.95);
      } }, el('span', { html: icon('giant') }), el('span', {}, el('b', { text: knocked == null ? C.knock : knockLine(knocked) }), el('small', { text: C.knockSub })));
      body.append(fence(), kb, el('div.crawl-ask', { text: C.title }),
        el('div.choices.crawl-picks', {}, d.choices.map((ch: { id: any; label: any; }) => el('button.choice', { onclick: () => { pick = ch.id; api.sound('pop'); tape(); } }, el('b', { text: ch.label })))));
    };
    const tape = () => {
      body.innerHTML = ''; h2.textContent = C.tapeTitle;
      const mine = d.choices.find((c: { id: any; }) => c.id === pick);
      const pull = el('button.btn.primary.block.crawl-pull', { onclick: () => {
        pull.disabled = true;
        const r = api.dispatch({ type: 'crawl/pull', pick });
        if (!r.ok) { pull.disabled = false; return; }
        reveal(r);
      } }, el('span', { html: icon('scale') }), el('span', { text: d.pull }));
      body.append(el('div.crawl-say.edna', {}, portraitEl(api, 'edna', s, 'small'), el('span', { text: d.tapeLine })),
        el('div.crawl-mine', { html: `You said <b>${mine?.label || ''}</b>` }), pull);
    };
    const reveal = (r: ActionResult&{ events: OutEvent[]; }) => {
      body.innerHTML = ''; h2.textContent = C.revealTitle;
      const cu = el('div.crawl-count');
      body.append(cu);
      count(api, cu, r.ott, r.est, () => {
        const ev = api.s().crawl, green = ev?.tape?.green || {};
        const rows = el('div.crawl-results', {},
          ...d.guesses.map((g: { who: string|number; n: any; }) => el('div.crawl-res', { class: green[g.who] ? 'near' : 'off' }, el('span', { text: who(g) }), el('b', { text: `${fmt.int(g.n)} lb` }), el('i', { html: icon(green[g.who] ? 'check' : 'close', 's') }))),
          el('div.crawl-res.you', { class: ev?.right ? 'near' : 'off' }, el('span', { text: C.you }), el('b', { text: d.choices.find((c: { id: any; }) => c.id === pick)?.label || '' }),
            el('i', { html: icon(ev?.right ? 'check' : 'close', 's') })));
        // Edna's verdict, and her promise: she tapes her every Sunday for the Crier from now on (rulings R4)
        const verdict = el('div.crawl-say.edna.verdict', {}, portraitEl(api, 'edna', s, 'small'),
          el('span', {}, el('span', { text: r.right ? C.right : verdictOf(r, ev) }), el('span.sunday', { text: ` ${CL.sundayFirst}` })));
        const done = el('button.btn.primary.block.crawl-done', { onclick: () => api.dispatch({ type: 'card/answer', id: card.id, choice: pick || 'mid' }) }, el('span', { text: C.done }));
        body.append(rows, verdict, el('div.crawl-pace', { text: paceText(r.pace) }), done);
        if (r.right) { api.R?.fx?.({ type: 'sparkle', x: PLACES.giant.x, y: 1.6, z: PLACES.giant.z, n: 14 }); api.sound('done'); }
      });
    };
    guess();
  },
});
// Edna's verdict when your range missed: Vance's eyeball won, or nobody's did (the sim words it: crawl/tape's verdict)
function verdictOf(r: { est: any; }, c: Crawl) {
  const est = `${fmt.int(r.est)} lb`;
  return (c?.tape?.green?.vance ? CL.crawl.wrong : CL.crawl.nobody).replace('{est}', est);
}
