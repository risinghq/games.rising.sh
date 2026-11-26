// Between years (design §9, §12): Halloween (the porch carving panel, the seed lot popping out, trick-or-treaters), then
// the winter flow as full-screen pages: the Ledger (with row report cards and her chart over last year's), the Quarter
// Sun Crier (a little newspaper with the reveal photo), the Scrapbook page, and the winter hub (Seeds · Grange · Hardware
// · KQSC · Almanac) whose FAB is "Year N+1". The FAB is Next / Goodnight / Year N+1 throughout.
import { $, el, icon, fmt, bump } from './dom.js';
import { registerScreen, registerFab, registerTap, registerSheet, registerEvent } from './registry.js';
import { T } from '../sim/tuning.js';
import { LINES, SPEAKERS } from '../sim/story.js';
import { CATALOGUE, blocker, count, forYear, hired, priceOf, goatCut } from '../sim/economy.js';
import { seedCard, commas } from '../sim/genetics.js';
import { ledgerSummary, porchPlant } from '../sim/winter.js';
import { judgesFor } from '../sim/weighoff.js';
import { genYear } from '../sim/weather.js';
import { LINES as PL } from '../sim/patch.js';
import type { State, OutEvent } from '../sim/types.js';
import type { Api } from './types.js';
import { Scrapbook } from '../sim/state.js';

const LW = LINES.winter, CARVE_KEY = 'qsc.carve';
const UI = { api: null };
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const store = { get(k: string) { try { return localStorage.getItem(k); } catch { return null; } }, set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* full */ } } };
const pctText = (p: number|null) => (p == null ? '' : `${p >= 0 ? '+' : '−'}${Math.abs(p * 100).toFixed(1)}% vs chart`);

// ------------------------------------------------------------ the carving panel (Halloween, stage 'carve')
// The face is a canvas with rib shading; strokes go to a second, hidden mask canvas (R = Shave, a soft glow; G = Punch,
// a blaze) that the renderer projects onto her front hemisphere when you press Done.
const N = 256;
const STENCILS = {
  grin: [{ t: 'punch', fill: [[0.27, 0.42], [0.4, 0.42], [0.335, 0.3]] }, { t: 'punch', fill: [[0.6, 0.42], [0.73, 0.42], [0.665, 0.3]] },
    { t: 'punch', fill: [[0.46, 0.55], [0.54, 0.55], [0.5, 0.47]] },
    { t: 'punch', fill: [[0.24, 0.62], [0.32, 0.7], [0.4, 0.64], [0.5, 0.72], [0.6, 0.64], [0.68, 0.7], [0.76, 0.62], [0.68, 0.82], [0.5, 0.86], [0.32, 0.82]] }],
  whiskers: [{ t: 'punch', dot: [0.38, 0.38, 0.035] }, { t: 'punch', dot: [0.62, 0.38, 0.035] }, { t: 'shave', line: [[0.5, 0.42], [0.52, 0.52], [0.5, 0.62], [0.46, 0.7]] },
    ...[[-1, 0.56], [-1, 0.62], [-1, 0.68], [1, 0.56], [1, 0.62], [1, 0.68]].map(([s, y]) => ({ t: 'shave', line: [[0.5 + s * 0.08, y], [0.5 + s * 0.36, y - 0.04 + (y - 0.62) * 0.8]] })),
    { t: 'punch', line: [[0.4, 0.78], [0.6, 0.78]] }],
  cloud: [{ t: 'shave', line: Array.from({ length: 33 }, (_, i) => { const a = (i / 32) * Math.PI * 2; const r = 0.28 + 0.04 * Math.cos(a * 6); return [0.5 + Math.cos(a) * r * 1.1, 0.55 + Math.sin(a) * r * 0.7]; }) },
    { t: 'punch', line: [[0.36, 0.5], [0.42, 0.53], [0.47, 0.5]] }, { t: 'punch', line: [[0.53, 0.5], [0.58, 0.53], [0.64, 0.5]] },
    { t: 'punch', line: [[0.45, 0.64], [0.5, 0.66], [0.55, 0.64]] }, { t: 'shave', line: [[0.2, 0.86], [0.35, 0.83], [0.5, 0.87], [0.65, 0.83], [0.8, 0.86]] }],
  possum: [{ t: 'shave', dot: [0.28, 0.26, 0.09] }, { t: 'shave', dot: [0.72, 0.26, 0.09] }, { t: 'punch', dot: [0.4, 0.45, 0.035] }, { t: 'punch', dot: [0.6, 0.45, 0.035] },
    { t: 'punch', fill: [[0.46, 0.56], [0.54, 0.56], [0.5, 0.64]] }, { t: 'shave', line: [[0.3, 0.6], [0.44, 0.62]] }, { t: 'shave', line: [[0.56, 0.62], [0.7, 0.6]] },
    { t: 'punch', line: [[0.4, 0.72], [0.5, 0.76], [0.6, 0.72]] }],
};
const BRUSH = { shave: 15, punch: 9 };
function faceBg(g: { createRadialGradient: (arg0: number,arg1: number,arg2: number,arg3: number,arg4: number,arg5: number) => any; fillStyle: any; fillRect: (arg0: number,arg1: number,arg2: number,arg3: number) => void; strokeStyle: string; lineWidth: number; beginPath: () => void; moveTo: (arg0: number,arg1: number) => void; quadraticCurveTo: (arg0: number,arg1: number,arg2: number,arg3: number) => void; stroke: () => void; }, col = '#e39a52') {
  const gr = g.createRadialGradient(N * 0.45, N * 0.38, N * 0.1, N / 2, N / 2, N * 0.7);
  gr.addColorStop(0, '#f2b977'); gr.addColorStop(0.55, col); gr.addColorStop(1, '#a8571f');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  g.strokeStyle = 'rgba(120, 55, 15, 0.28)'; g.lineWidth = 3;
  for (let i = 1; i < 6; i++) { const x = (i / 6) * N; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (x - N / 2) * 0.35, N / 2, x, N); g.stroke(); }
}
function carvePanel(s: State, api: Api) {
  const p = porchPlant(s), face = el('canvas.wi-face', { width: N, height: N, 'aria-label': 'Carve her: draw with your finger' });
  const mask = document.createElement('canvas'); mask.width = mask.height = N;
  const fg = face.getContext('2d', { willReadFrequently: true }), mg = mask.getContext('2d', { willReadFrequently: true });
  const COL = { O: '#e39a52', S: '#e8a77a', T: '#d8b07c', W: '#ebe4d2' }[p?.color] || '#e39a52';
  faceBg(fg, COL);
  let tool = 'punch', stencil: null = null, drawing: number[][]|null = null;
  const undo: any[][] = [];
  const snap = () => { undo.push([fg.getImageData(0, 0, N, N), mg.getImageData(0, 0, N, N)]); if (undo.length > 8) undo.shift(); };
  const ink = (t: string) => ({ face: t === 'punch' ? '#2a1a0e' : '#f6c886', mask: t === 'punch' ? 'rgb(0,255,0)' : 'rgb(255,0,0)', w: BRUSH[t] });
  const stroke = (t: string, pts: any[], width?: undefined) => {
    const I = ink(t);
    for (const [g, c] of [[fg, I.face], [mg, I.mask]]) {
      g.save(); g.globalCompositeOperation = g === mg ? 'lighter' : 'source-over';
      g.strokeStyle = c; g.lineWidth = width ?? I.w; g.lineCap = g.lineJoin = 'round';
      if (t === 'shave' && g === fg) { g.shadowColor = 'rgba(255, 220, 150, 0.8)'; g.shadowBlur = 6; }
      g.beginPath(); pts.forEach(([x, y]: any, i: any) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (pts.length === 1) g.lineTo(pts[0][0] + 0.1, pts[0][1]); g.stroke(); g.restore();
    }
    if (t === 'punch') { fg.save(); fg.strokeStyle = 'rgba(255, 196, 92, 0.55)'; fg.lineWidth = 2; fg.beginPath(); pts.forEach(([x, y]: any, i: any) => (i ? fg.lineTo(x, y) : fg.moveTo(x, y))); fg.stroke(); fg.restore(); }
  };
  const fill = (t: any, pts: number[][]|[any,any][]) => {
    const I = ink(t);
    for (const [g, c] of [[fg, I.face], [mg, I.mask]]) { g.save(); g.globalCompositeOperation = g === mg ? 'lighter' : 'source-over'; g.fillStyle = c; g.beginPath(); pts.forEach(([x, y]: any, i: any) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); g.restore(); }
  };
  const at = (e: PointerEvent) => { const r = face.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * N, ((e.clientY - r.top) / r.height) * N]; };
  face.addEventListener('pointerdown', (e) => { e.preventDefault(); try { face.setPointerCapture(e.pointerId); } catch { /* synthetic or lost pointer */ } snap(); drawing = [at(e)]; stroke(tool, drawing); api.haptic(6); });
  face.addEventListener('pointermove', (e) => { if (!drawing) return; const q = at(e); stroke(tool, [drawing.at(-1), q]); drawing.push(q); });
  const end = () => { if (drawing) { drawing = null; api.sound(tool === 'punch' ? 'squish' : 'tick'); } };
  face.addEventListener('pointerup', end); face.addEventListener('pointercancel', end);
  const applyStencil = (id: string) => {
    snap(); stencil = id;
    for (const sh of STENCILS[id]) {
      const sc = (pts: [any,any][]) => pts.map(([x, y]) => [x * N, y * N]);
      if (sh.fill) fill(sh.t, sc(sh.fill));
      else if (sh.dot) { const [x, y, r] = sh.dot; fill(sh.t, Array.from({ length: 16 }, (_, i) => [(x + Math.cos(i / 16 * Math.PI * 2) * r) * N, (y + Math.sin(i / 16 * Math.PI * 2) * r) * N])); }
      else stroke(sh.t, sc(sh.line));
    }
    api.sound('plink'); api.haptic(10);
  };
  const tools = el('div.seg.wi-tools', { role: 'group', 'aria-label': 'Brush' }, ['shave', 'punch'].map((t) => el('button', { class: t === tool ? 'on' : null, data: { t },
    onclick: (e: any) => { tool = t; tools.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); api.sound('tick'); } },
  el('span', {}, el('b', { text: LW.brushes[t][0] }), el('small', { text: LW.brushes[t][1] })))));
  const sten = el('div.wi-stencils', {}, Object.keys(STENCILS).map((id) => el('button.chip', { onclick: () => applyStencil(id) }, LW.stencils[id])));
  const done = el('button.btn.primary', { html: `${icon('check')}<span>Done: light her up</span>`, onclick: () => {
    const d = mg.getImageData(0, 0, N, N).data; let g = 0;
    for (let i = 1; i < d.length; i += 16) g += d[i] > 40 ? 1 : 0;
    const r = api.dispatch({ type: 'winter/carve', plot: p?.plot, stencil, ink: Math.min(1, g / (d.length / 16) * 6) });
    if (!r.ok) return;
    api.R?.fx?.({ type: 'winter/carve', canvas: mask });
    try { store.set(CARVE_KEY, JSON.stringify({ year: s.clock.year, url: mask.toDataURL('image/png') })); } catch { /* big */ }
    UI.lot = r.seeds || []; UI.lotShown = 0;
  } });
  const skip = el('button.btn.ghost', { text: 'Skip (keep the seeds)', onclick: () => { const r = api.dispatch({ type: 'winter/skipCarve', plot: p?.plot }); if (r.ok) { UI.lot = r.seeds || []; UI.lotShown = 0; } } });
  const undoB = el('button.iconbtn', { html: icon('back'), 'aria-label': 'Undo', onclick: () => { const u = undo.pop(); if (u) { fg.putImageData(u[0], 0, 0); mg.putImageData(u[1], 0, 0); api.sound('tick'); } } });
  return el('div.wi-carve.card', {},
    el('div.wi-head', {}, el('div.eyebrow', { text: `Halloween · ${p?.name || 'your giant'}` }), el('h2', { text: 'Carve her' })),
    el('div.wi-carve-row', {}, face, el('div.wi-carve-side', {}, tools, undoB)), sten, el('div.wi-actions', {}, done, skip));
}
function lotRow(s: State) {
  // (after a reload the lot comes from the save: the carving's own list is gone with the page)
  const ids = UI.lot?.length ? UI.lot : s.winter.lot || [], seeds = ids.map((id: string) => s.genetics.seeds.find((x) => x.id === id)).filter(Boolean);
  if (!seeds.length) return el('p.wi-note', { text: LW.noSeeds });
  const row = el('div.wi-lot', {}, seeds.map((x: any, i: any) => seedTile(x, i)));
  return el('div', {}, el('p.wi-note', { html: `${icon('pumpkin', 's')} <span>${LW.seeds.replace('{short}', `<b>${seeds[0].short}</b>`)}</span>` }), row);
}
function seedTile(x: { mother: {}; father: {}; id: any; short: any; name: any; source: any; year: any; plump: any; F: number; }, i: number) {
  const c = seedCard(x);
  return el('div.wi-seed', { style: { animationDelay: `${i * 0.18}s` } }, el('b', { text: c.plump }), el('span', { text: c.colour }), el('i', { text: c.father === 'open' ? 'open' : c.father }));
}

registerScreen('halloween', {
  auto: (s: State) => s.clock.phase === 'halloween',
  build(node, s: State, api: Api) {
    UI.api = api; node.classList.add('wi', 'wi-night'); document.body.classList.add('wi-on'); UI.hwStage = null;
    if (s.winter.carved) restoreCarving(api, s);
    this.update(node, s, api);
  },
  update(node, s: State, api: Api) {
    const st = s.winter.stage;
    if (st !== UI.hwStage) {
      UI.hwStage = st;
      node.innerHTML = '';
      if (st === 'carve') node.append(carvePanel(s, api));
      else {
        UI.lotNode = el('div.wi-treats.card', {}, el('div.wi-head', {}, el('div.eyebrow', { text: 'Halloween night' }), el('h2', { text: 'Trick-or-treat!' })),
          lotRow(s), el('p.wi-note', { html: `${icon('sparkle', 's')} ${LW.treats}` }), UI.candy = el('p.wi-candy', { text: '' }));
        node.append(UI.lotNode);
        UI.lot?.forEach((_: any, i: number) => setTimeout(() => api.sound('plink', { pitch: 1 + i * 0.08 }), 200 + i * 180));
      }
    }
    if (UI.candy) { const c = s.winter.candy || 0; const t = c ? `Candy handed out: ${c}` : ''; if (UI.candy.textContent !== t) UI.candy.textContent = t; }
    const tray = $('#tray')?.getBoundingClientRect(), card = node.firstChild?.getBoundingClientRect();
    if (tray && card) {
      const sig = `${Math.round(card.top)}|${innerWidth}`;
      if (sig !== UI.hwInset) { UI.hwInset = sig; api.R?.cam?.setInset?.(innerWidth >= 900 ? innerHeight - tray.top + 6 : innerHeight - card.top + 6, 60, innerWidth >= 900 ? innerWidth - card.left + 8 : 0); }
      node.style.setProperty('--wi-bottom', `${Math.max(80, innerHeight - tray.top + 8)}px`);
    }
  },
  onClose(api: Api) { document.body.classList.remove('wi-on'); UI.hwStage = null; UI.hwInset = ''; UI.candy = null; api?.R?.cam?.setInset?.(0, 0, 0); },
});
// tap a group of trick-or-treaters: candy!
registerTap('treat', (hit, api: Api) => {
  const g = +String(hit.id).replace('treat', '') || 0;
  if (api.dispatch({ type: 'winter/treat', group: g, quiet: true }).ok) { api.sound('plink', { pitch: 1.2 }); api.haptic(12); api.toast(LW.candy.replace('{kids}', LW.kids[['raccoon', 'possum', 'owl'][g]] || 'kids'), 'good', 'sparkle'); }
});
// a reload after Done: her face is still carved
registerEvent('phase', (ev: OutEvent, api: Api) => {
  if (ev.to !== 'halloween') return;
  UI.lot = []; UI.lotShown = 0;
});

// ------------------------------------------------------------ winter pages
function sparkSvg(vals: any[], w = 300, h = 54, cls = '') {
  if (!vals.length) return '';
  const lo = Math.min(0, ...vals), hi = Math.max(1, ...vals), x = (i: number) => (vals.length === 1 ? w / 2 : (i / (vals.length - 1)) * (w - 12) + 6), y = (v: number) => h - 6 - ((v - lo) / (hi - lo)) * (h - 14);
  const pts = vals.map((v: any, i: any) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg class="wi-spark ${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="${w}" y1="${y(0)}" y2="${y(0)}" stroke="#dcd6c8" stroke-dasharray="3 3"/>`
    + `<polyline points="${pts}" fill="none" stroke="#d9782d" stroke-width="2.5" stroke-linejoin="round"/>${vals.map((v: number, i: any) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="${v >= 0 ? '#5d8a69' : '#b5543f'}"/>`).join('')}</svg>`;
}
function chartSvg(cur: any[], last: any[]) {
  const all = [...cur, ...last], W = 320, H = 120;
  if (!all.length) return '';
  const tMax = Math.max(60, ...all.map((m) => m.t)), eMax = Math.max(100, ...all.map((m) => m.est));
  const P = (m: { t: number; est: number; }) => `${(8 + (m.t / tMax) * (W - 16)).toFixed(1)},${(H - 10 - (m.est / eMax) * (H - 22)).toFixed(1)}`;
  return `<svg class="wi-chart" viewBox="0 0 ${W} ${H}" aria-label="Her growth chart">${last.length ? `<polyline points="${last.map(P).join(' ')}" fill="none" stroke="#a9b3ad" stroke-width="2" stroke-dasharray="5 4"/>` : ''}`
    + `<polyline points="${cur.map(P).join(' ')}" fill="none" stroke="#d9782d" stroke-width="3" stroke-linejoin="round"/></svg>`;
}
const row = (label: any, v: number, neg?: boolean|undefined) => el('div.ledger-row', {}, el('span', { text: label }), el('span.v', { class: neg ? 'neg' : null, text: (neg ? '−' : '') + fmt.money(v) }));
function ledgerPage(s: State) {
  const L = ledgerSummary(s), g = L.giant;
  const sec = (title: string, ...kids: (HTMLElement|null)[]) => el('div.wi-sec', {}, el('div.eyebrow', { text: title }), ...kids);
  const out = [el('div.wi-title', {}, el('div.eyebrow', { text: `Year ${L.year} · ${s.meta.farmName}` }), el('h1', { text: 'The ledger' })),
    el('div.wi-net', { class: L.net < 0 ? 'neg' : null }, el('span', { text: 'Net for the year' }), el('b', { text: fmt.money(L.net) }), el('div', { html: sparkSvg(L.nets.map((x) => x.net)) }),
      L.nets.length > 1 ? el('small', { text: L.nets.map((x) => `Y${x.year} ${fmt.money(x.net)}`).join(' · ') }) : null)];
  out.push(sec('Income', ...(L.income.length ? L.income.map((x) => row(x.label, x.v)) : [el('p.wi-note', { text: 'Nothing came in this year.' })]), el('div.ledger-total', {}, el('span', { text: 'Total' }), el('span.num', { text: fmt.money(L.totalIn) }))));
  out.push(sec('Spending', ...(L.expense.length ? L.expense.map((x) => row(x.label, x.v, true)) : [el('p.wi-note', { text: 'Nothing spent.' })]), el('div.ledger-total', {}, el('span', { text: 'Total' }), el('span.num', { text: `−${fmt.money(L.totalOut)}` }))));
  const fam = L.families;
  out.push(sec('The season', el('div.wi-facts', {},
    fam ? [fact('Families served', fmt.int(fam.served)), fact('Turned away on Route 46', fmt.int(fam.turned)), fact('Walked off', fmt.int(fam.walkOffs))] : null,
    fact('Stars', `★ ${L.stars[0].toFixed(1)} → ${L.stars[1].toFixed(1)}`), L.buzzPeak != null ? fact('Buzz peak', `${Math.round(L.buzzPeak * 100)}%`) : null,
    fact('Went soft', fmt.int(L.waste.soft)), fact('Rotted', fmt.int(L.waste.rotten)), fact('Never ripened', fmt.int(L.waste.green)), L.waste.goat ? fact('Goat-eaten', fmt.int(L.waste.goat)) : null)));
  if (L.cards.length) out.push(sec('Row report cards', ...L.cards.map((c) => el('div.wi-card', { text: c.text }))));
  if (g) {
    const kept = Object.entries(g.rituals || {}).filter(([, v]) => v).map(([k]) => ({ talk: 'talked to her', hat: 'wore the hat', moon: 'full moon', radio: 'played the radio', secret: 'kept the secret' }[k]));
    out.push(sec('Your giant', el('div.wi-giant', {}, el('b', { text: g.name || 'Your giant' }),
      el('span', { text: g.split === 'blowout' ? LW.split : g.W ? `${commas(g.W)} lb · ${pctText(g.pct)}${g.place ? ` · ${ord(g.place)} Heaviest` : ''}${g.exhibition ? ' · exhibition only' : ''}` : '' }),
      el('span', { text: `${g.creaks} creak${g.creaks === 1 ? '' : 's'}${g.pretty ? ` · ${ord(g.pretty)} Prettiest` : ''}` })),
    el('div', { html: chartSvg(g.chart, g.last) }), g.last.length ? el('p.wi-legend', { text: `Dashed: ${g.lastName || 'last year'}` }) : null,
    kept.length ? el('div.wi-chips', {}, kept.map((k) => el('span.chip', { text: k }))) : el('p.wi-note', { text: 'No rituals kept. She grew anyway.' })));
  }
  if (L.loan) out.push(sec("Gran's cookie tin", el('p.wi-note', { text: `${fmt.money(L.loan)} still owed, repaid from 20% of next season's sales.` })));
  return out;
}
const fact = (k: string, v: string) => el('div.wi-fact', {}, el('b', { text: v }), el('span', { text: k }));

function crierPage(s: State, api: Api) {
  const ed = s.winter.edition;
  if (!ed) return [el('p', { text: 'The presses are warming up.' })];
  const photo = api.photo.load(ed.year);
  const box = (title: string, ...kids: HTMLElement[]) => el('section.cr-box', {}, el('h3', { text: title }), ...kids);
  return [el('article.crier', {},
    el('header.cr-mast', {}, el('div.cr-top', {}, el('span', { text: fill(LW.edition, { year: ed.year }) }), el('span', { text: LW.price })),
      el('h1', { text: LW.masthead }), el('div.cr-motto', { text: LW.motto })),
    el('h2.cr-head', { text: ed.headline }), ed.sub ? el('div.cr-sub', { text: ed.sub }) : null,
    el('figure.cr-photo', {}, photo ? el('img', { src: photo, alt: 'The reveal' }) : el('div.cr-nophoto', { text: LW.noPhoto }),
      el('figcaption', { text: `On the Q.S.C. Official Scale, Mon Oct 26.` })),
    ed.briefs.length ? el('div.cr-briefs', {}, ed.briefs.map((b) => el('p', { text: b }))) : null,
    box(LW.marleneHead, el('p', { text: ed.marlene.text }), el('div.cr-fog', {}, ed.marlene.spark.map((f, i) => el('i', { style: { height: `${Math.round(8 + f * 40)}px` }, title: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][i] })))),
    box('Next year', ...[ed.fad, ed.judges, ed.mood].filter(Boolean).map((t) => el('p', { text: t }))),
    box('Letters to the editor', ...ed.letters.map((t) => el('p.cr-letter', { text: t }))),
    box(LW.oldTimer.head, el('div.cr-by', { text: LW.oldTimer.by }), ...ed.column.map((t) => el('p', { text: t }))),
    el('section.cr-ad', {}, el('h3', { text: LW.classifieds.head }), el('p', { text: ed.classified })))];
}
const fill = (str: string, v: { [x: string]: any; year?: number; }) => String(str).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);

function scrapPage(s: State, api: Api, p: Scrapbook|undefined, big = true) {
  if (!p) return el('p.wi-note', { text: 'Your first page is printed after the weigh-off.' });
  const photo = api.photo.load(p.year);
  return el('div.sb-page', { class: big ? 'big' : null },
    el('div.sb-photo', {}, photo ? el('img', { src: photo, alt: `Year ${p.year}` }) : el('div.cr-nophoto', { text: LW.noPhoto }), el('i.tape')),
    el('div.sb-text', {}, el('div.eyebrow', { text: `Year ${p.year}` }), el('h3', { text: p.split ? LW.split : p.name || 'Your giant' }),
      el('p.sb-head', { text: p.headline }),
      el('div.wi-facts', {}, p.weight ? fact('Weight', `${commas(p.weight)} lb`) : fact('Weight', p.est ? `est. ${commas(p.est)} lb` : '—'),
        p.pct != null ? fact('vs chart', pctText(p.pct).replace(' vs chart', '')) : null, fact('Heaviest', p.place ? ord(p.place) : p.exhibition ? 'exhibition' : '—'),
        fact('Prettiest', p.pretty ? ord(p.pretty) : p.mustache ? 'mustache' : '—'), fact('Stars', `★ ${p.stars}`), fact('Net', fmt.money(p.net))),
      p.moment ? el('p.sb-moment', { text: `Best moment: ${p.moment}` }) : null));
}
function scrapbookPage(s: State, api: Api) {
  const pages = s.scrapbook || [], cur = pages.at(-1);
  return [el('div.wi-title', {}, el('div.eyebrow', { text: s.meta.farmName }), el('h1', { text: 'The scrapbook' })), scrapPage(s, api, cur),
    pages.length > 1 ? el('div.wi-sec', {}, el('div.eyebrow', { text: 'Earlier pages' }), ...pages.slice(0, -1).reverse().map((p) => scrapPage(s, api, p, false))) : null];
}

// ------------------------------------------------------------ the hub: Seeds · Grange · Hardware · KQSC · Almanac
const TABS = ['seeds', 'grange', 'hardware', 'kqsc', 'almanac'];
function hubPage(s: State, api: Api, rerender: () => void) {
  const tab = UI.tab || 'seeds', fy = forYear(s);
  const tabs = el('div.seg.wi-tabs', { role: 'tablist' }, TABS.filter((t) => t !== 'grange' || fy >= T.genetics.grange.fromYear).map((t) => el('button', { class: t === tab ? 'on' : null, role: 'tab',
    onclick: () => { UI.tab = t; api.sound('tick'); rerender(); } }, LW.hubTabs[t])));
  const body = { seeds: seedsTab, grange: grangeTab, hardware: (a: any, b: Api, c: any) => shopTab(a, b, c, 'hardware'), kqsc: (a: any, b: Api, c: any) => shopTab(a, b, c, 'kqsc'), almanac: almanacTab }[tab](s, api, rerender);
  return [el('div.wi-title', {}, el('div.eyebrow', { text: `Winter · before year ${fy}` }), el('h1', { text: 'The winter hub' })),
    el('div.wi-cash', { html: `${icon('coin')}<span>${fmt.money(s.cash)} in the tin</span>${s.loan.owed > 0 ? `<small>Gran's tin: ${fmt.money(s.loan.owed)} owed</small>` : ''}` }),
    tabs, el('div.wi-tab', {}, body)];
}
function seedsTab(s: State, api: Api, rerender: () => void) {
  const S = s.genetics, fy = forYear(s), two = !!s.owned.plot2;
  const latest = Math.max(0, ...S.seeds.filter((x) => x.source === 'own').map((x) => x.year));
  const groups = [['This year\'s lot', S.seeds.filter((x) => x.source === 'own' && x.year === latest)], ['From the Grange', S.seeds.filter((x) => x.source === 'grange' || x.source === 'mystery')],
    ["Grandpa's tin", S.seeds.filter((x) => x.source === 'tin')], ['Older seeds', S.seeds.filter((x) => x.source === 'own' && x.year !== latest)], ['On the porch', S.seeds.filter((x) => x.source === 'moss')]];
  const sell = fy >= T.genetics.sales.fromYear;
  const pick = (id: any, plot: number) => { const r = api.dispatch({ type: 'genetics/choose', id, plot }); if (r.ok) { api.sound('plink'); api.haptic(10); api.dispatch({ type: 'story/goalDone', id: 'carve' }); rerender(); } };
  return [el('p.wi-note', { text: LW.autoSeed }), ...groups.filter(([, xs]) => xs.length).map(([title, xs]) => el('div.wi-sec', {}, el('div.eyebrow', { text: title }),
    ...xs.map((x: { id: any; name: any; source: any; mother: any; father?: {}; short?: any; year?: any; plump?: any; F?: number; }, i: number) => {
      const c = seedCard(x), on1 = S.plant[0] === x.id, on2 = S.plant[1] === x.id;
      const sib = i > 0 && xs[i - 1].name === x.name, n = xs.slice(0, i + 1).filter((y: { name: any; }) => y.name === x.name).length;
      const facts = sib ? [el('span', { text: 'Same mother and father as above.' })]
        : [c.pedigree !== `${c.title} (open)` ? el('span', { text: c.pedigree }) : null, el('span', { text: [c.weightText, c.pct, c.colour, c.shape, `father: ${c.father}`].filter(Boolean).join(' · ') })];
      return el('div.wi-seedcard', { class: [on1 || on2 ? 'on' : '', sib ? 'sib' : ''].join(' ').trim() || null },
        el('div.grow', {}, el('b', { text: sib ? `${c.title}, seed ${n}` : c.title }), ...facts,
          el('div.wi-chips', {}, el('span.chip', { class: c.plump === 'Plump' ? 'gold' : null, text: c.plump }), c.inbred ? el('span.chip.bad', { text: c.inbred }) : null)),
        el('div.wi-seedbtns', {}, el('button.btn', { class: on1 ? 'sage' : null, text: on1 ? 'Planting' : two ? 'Plot 1' : 'Plant this', onclick: () => pick(x.id, 1) }),
          two ? el('button.btn', { class: on2 ? 'sage' : null, text: on2 ? 'Plot 2 ✓' : 'Plot 2', onclick: () => pick(x.id, 2) }) : null,
          sell && x.source === 'own' && x.mother?.weight ? el('button.btn.ghost', { text: 'Sell', onclick: () => { const r = api.dispatch({ type: 'genetics/sell', id: x.id }); if (r.ok) { api.toast(`Sold for ${fmt.money(r.value)}`, 'good', 'coin'); rerender(); } } }) : null));
    })))];
}
function grangeTab(s: State, api: Api, rerender: () => void) {
  const offers = s.genetics.offers || [];
  const items = Object.values(CATALOGUE).filter((it) => it.tab === 'grange' && it.from <= forYear(s));
  return [el('p.wi-note', { text: 'Seed lots and pollen from the rival lines, named by their last official weights.' }),
    el('div.wi-sec', {}, el('div.eyebrow', { text: 'Seeds and pollen' }), ...offers.map((o) => el('div.wi-item', { class: o.bought ? 'owned' : null },
      el('div.grow', {}, el('b', { text: o.name }), el('span', { text: o.kind === 'pollen' ? 'Pollen pack: cross her with this line next July.' : o.kind === 'mystery' ? 'Who knows. Not the raccoons. Allegedly.' : `A seed lot of ${o.genomes?.length || 3}. Plant one next spring.` })),
      el('button.btn', { class: o.bought ? 'sage' : 'primary', disabled: o.bought || s.cash < o.price ? true : null, text: o.bought ? 'Bought' : fmt.money(o.price),
        onclick: (e: { currentTarget: Element; }) => { const r = api.dispatch({ type: 'genetics/buy', id: o.id }); if (r.ok) { bump(e.currentTarget); api.haptic(15); rerender(); } } })))),
    shopList(s, api, rerender, items)];
}
function shopTab(s: State, api: Api, rerender: any, tab: string) {
  const items = Object.values(CATALOGUE).filter((it) => it.tab === tab && it.from <= forYear(s) && it.where === 'winter');
  const later = Object.values(CATALOGUE).filter((it) => it.tab === tab && it.where !== 'winter' && it.from <= forYear(s));
  return [shopList(s, api, rerender, items), later.length ? el('div.wi-sec', {}, el('div.eyebrow', { text: 'Booked during the season' }),
    ...later.map((it) => el('div.wi-item.later', {}, el('div.grow', {}, el('b', { text: it.name }), el('span', { text: it.desc })), el('span.wi-price', { text: `${fmt.money(it.price)}/${it.per}` })))) : null,
    el('p.wi-note', { text: 'Coming later: ' + (Object.values(CATALOGUE).filter((it) => it.tab === tab && it.from > forYear(s)).map((it) => it.name).join(', ') || 'nothing. You have seen it all.') })];
}
function shopList(s: State, api: Api, rerender: () => void, items: any[]) {
  const fy = forYear(s);
  return el('div.wi-sec', {}, ...items.map((it: { id: string|undefined; kind: string; per: string; max: any; name: string; desc: any; price: number; }) => {
    const why = blocker(s, it.id), hire = it.kind === 'hire', owned = hire ? hired(s, it.id, fy) : it.per === 'year' ? s.owned[it.id] === fy : count(s, it.id) >= (it.max || 1);
    const label = owned ? (hire ? 'Hired' : 'Owned') : fmt.money(priceOf(s, it.id)) + (it.per === 'season' ? '/season' : it.per === 'year' ? '/year' : '');
    const n = !hire && (it.max || 1) > 1 ? ` (${count(s, it.id)}/${it.max})` : '';
    // [A] a bramble row Pamela grazed is cheaper to clear (plan §3.3): the first time the player sees Row 5, with her in it
    const cut = owned ? 0 : goatCut(s, it.id);
    return el('div.wi-item', { class: owned ? 'owned' : null }, el('div.grow', {}, el('b', { text: it.name + n }), el('span', { text: it.desc }),
      cut ? el('small.goat', { text: `${fmt.money(it.price)} less ${fmt.money(cut)}: Pamela cleared some` }) : null,
      why && !owned && why !== 'not enough cash' ? el('small', { text: why }) : null),
      el('button.btn', { class: owned ? 'sage' : 'primary', disabled: why ? true : null, text: label, 'aria-label': `${it.name}: ${label}`,
        onclick: (e: { currentTarget: Element; }) => {
          const r = api.dispatch(hire ? { type: 'economy/hire', who: it.id } : { type: 'economy/buy', item: it.id });
          if (r.ok) { bump(e.currentTarget); api.haptic(15); api.toast(`${hire ? 'Hired' : 'Bought'}: ${it.name}`, 'good', 'coin'); rerender(); }
        } }));
  }));
}
function almanacTab(s: State) {
  const y = forYear(s), nf = s.patch?.nextFad, mood = y >= T.weather.archetypeFromYear ? LINES.moss.mood[genYear(s.seed, y).hint] : null;
  return [el('div.wi-sec', {}, el('div.eyebrow', { text: `Year ${y}` }),
    nf ? el('div.wi-item', {}, el('div.grow', {}, el('b', { text: 'The fad' }), el('span', { text: `${PL.names?.[nf.variety] || nf.variety}, ${Math.round(nf.confidence * 100)}% sure (Edna)` }))) : null,
    el('div.wi-item', {}, el('div.grow', {}, el('b', { text: 'The judges' }), el('span', { text: judgesFor(y).map((j) => SPEAKERS[j]?.name || j).join(', ') }))),
    mood ? el('div.wi-item', {}, el('div.grow', {}, el('b', { text: "Marlene's mood" }), el('span', { text: `Old Moss: "${mood}"` }))) : null,
    el('div.wi-item', {}, el('div.grow', {}, el('b', { text: 'The Cove record' }), el('span', { text: `${commas(s.weighoff?.record?.W ?? 1612)} lb, ${s.weighoff?.record?.who ?? 'Vance Sr.'}, ${s.weighoff?.record?.you ? `year ${s.weighoff.record.year}` : '1987'}` }))))];
}

const PAGES = { ledger: ledgerPage, crier: crierPage, scrapbook: scrapbookPage, hub: hubPage };
registerScreen('winter', {
  auto: (s: State) => s.clock.phase === 'winter',
  build(node, s, api: Api) { UI.api = api; node.classList.add('wi', 'wi-day'); document.body.classList.add('wi-on'); UI.page = el('div.wi-page'); node.append(UI.page); UI.wStage = null; UI.tab = 'seeds'; this.update(node, s, api); },
  update(node, s: State, api: Api) {
    const st = s.winter.stage;
    if (st !== UI.wStage) { UI.wStage = st; render(s, api); UI.page.scrollTop = 0; }
    const tray = $('#tray')?.getBoundingClientRect();
    if (tray) node.style.setProperty('--wi-bottom', `${Math.max(80, innerHeight - tray.top + 8)}px`);
  },
  onClose() { document.body.classList.remove('wi-on'); UI.wStage = null; },
});
function render(s: State, api: Api) {
  const top = UI.page.scrollTop;
  UI.page.innerHTML = '';
  UI.page.className = `wi-page wi-${s.winter.stage}`;
  UI.page.append(...(PAGES[s.winter.stage]?.(s, api, () => render(api.s(), api)) || []).flat().filter(Boolean));
  UI.page.scrollTop = top;
}

// ------------------------------------------------------------ the FAB: Next, Goodnight, Year N+1
registerFab({
  id: 'winter', priority: 40,
  when: (s: State) => s.clock.phase === 'halloween' || s.clock.phase === 'winter',
  label: (s: State) => (s.clock.phase === 'halloween' ? (s.winter.stage === 'carve' ? '' : 'Bedtime') : s.winter.stage === 'hub' ? `Year ${s.clock.year + 1}` : 'Next'),
  icon: (s: State) => (s.clock.phase === 'halloween' ? 'moon' : s.winter.stage === 'hub' ? 'sun' : 'next'),
  cls: (s: State) => (s.clock.phase === 'halloween' && s.winter.stage === 'carve' ? 'wo-hide' : s.winter.stage === 'hub' ? '' : 'sage'),
  onTap: (api: Api) => {
    const s = api.s();
    if (s.clock.phase === 'halloween' && s.winter.stage === 'carve') return;
    if (s.clock.phase === 'winter' && s.winter.stage === 'hub') { api.dispatch({ type: 'winter/beginYear' }); return; }
    api.dispatch({ type: 'winter/next' });
    api.sound('open');
  },
});

// ------------------------------------------------------------ the menu's Scrapbook (every page, with photos)
registerSheet('scrapbook', {
  title: () => 'Scrapbook', eyebrow: (s: State) => s.meta.farmName,
  build(body, s: State, arg, api: Api) {
    const pages = s.scrapbook || [];
    body.append(...(pages.length ? pages.slice().reverse().map((p) => scrapPage(s, api, p, false))
      : [el('div.empty-note', { html: `${icon('scrapbook')}<span>Your first page is printed after the weigh-off: one photo, one headline, one year.</span>` })]));
  },
});

// a carving survives a reload (the porch giant keeps her face until winter)
function restoreCarving(api: Api, s: State) {
  try {
    const c = JSON.parse(store.get(CARVE_KEY) || 'null');
    if (!c || c.year !== s.clock.year || !s.winter.carved) return;
    const img = new Image();
    img.onload = () => { const cv = document.createElement('canvas'); cv.width = cv.height = N; cv.getContext('2d').drawImage(img, 0, 0); api.R?.fx?.({ type: 'winter/carve', canvas: cv }); };
    img.src = c.url;
  } catch { /* nothing to restore */ }
}
