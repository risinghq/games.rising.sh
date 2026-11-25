// Foundation sheets: the Almanac (Hal's 3-day forecast, Marlene's year so far, the October calendar with the four
// weekends, the fad and judges), the Ledger (this year's money, past years) and the Cove record board at the
// scale. Plus the Almanac station, and ([A]) who to expect when Marlene's in or out.
import { el, icon, fmt, weatherIcon } from './dom.js';
import { registerSheet, registerStation, registerTap } from './registry.js';
import { chip, word, inShare } from '../sim/weather.js';
import { label, dowName, dayOf, weekends, isWeekend, isSaturday, weekendIndex, WEIGHOFF, HALLOWEEN } from '../sim/calendar.js';
import { shelf } from '../sim/patch.js';
import { isActive } from '../sim/events.js';
import { LINES } from '../sim/story.js';
import { ledgerNet } from '../sim/economy.js';
import { whoToExpect } from '../sim/mischief.js';
import { T } from '../sim/tuning.js';

const W = T.weather;

// ------------------------------------------------------------ Almanac
function today(s) {
  const c = chip(s);
  return el('div.today', {},
    el('div.glyph', { html: icon(weatherIcon(c.f, c.heat, c.rain)) }),
    el('div', {}, el('div.big', { html: `${c.word} <small>${c.pct}% fog</small>` }),
      el('div.muted', { text: c.heat ? `${W.heatLine}. Shade anything you love.` : c.rain ? 'Rain on the roof. The patch drinks for free.' : c.line || 'Marlene is making up her mind.' })));
}
function forecast(s) {
  const fc = s.weather.forecast || [];
  if (!fc.length) return el('div.empty-note', { html: `${icon('radio')}<span>Hal is off the air until spring.</span>` });
  return el('div.fc', {}, fc.map((d, k) => el('div.fcday', { class: d.heat ? 'heat' : null },
    d.heat ? el('span.flag', { text: 'HEAT' }) : d.rain ? el('span.flag.rain', { text: 'RAIN' }) : null,
    el('div.d', { text: k === 0 ? 'Tomorrow' : dowName(d.day, true).slice(0, 3) + ' ' + label(d.day).split(' ')[1] }),
    el('div', { html: icon(weatherIcon(d.f, d.heat, d.rain)) }),
    el('div.w', { text: d.heat ? 'Heat' : word(d.f) }),
    // [C] plain words (rulings R11): "give or take", never ±
    el('div.p', { text: `about ${Math.round(d.f * 100)}%` }), el('div.p.gt', { text: `give or take ${Math.round(d.sd * 100)}` }))));
}
// Marlene's year so far: daily fog as an area chart Apr -> Oct, heat days in red, the "in" line at 50%.
function sparkline(s) {
  const days = s.weather.days.slice(0, s.clock.phase === 'winter' || s.clock.phase === 'halloween' ? 214 : s.clock.day + 1);
  const Wd = 320, H = 76, N = 214, x = (i) => (i / (N - 1)) * Wd, y = (f) => H - 6 - f * (H - 14);
  let path = `M0 ${H}`, line = '';
  days.forEach((d, i) => { path += ` L${x(i).toFixed(1)} ${y(d.f).toFixed(1)}`; line += `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.f).toFixed(1)} `; });
  path += ` L${x(days.length - 1).toFixed(1)} ${H} Z`;
  const heat = days.map((d, i) => (d.heat ? `<rect x="${(x(i) - 1).toFixed(1)}" y="${H - 5}" width="2.4" height="5" fill="#c9553a"/>` : '')).join('');
  const months = ['Apr 1', 'May 1', 'Jun 1', 'Jul 1', 'Aug 1', 'Sep 1', 'Oct 1'].map((m) => `<line x1="${x(dayOf(m))}" x2="${x(dayOf(m))}" y1="4" y2="${H}" stroke="#ece7dc"/>`).join('');
  const wk = weekends().map((w) => `<rect x="${x(w.sat)}" y="4" width="${x(2) - x(0)}" height="${H - 4}" fill="rgba(217,120,45,${0.08 + 0.1 * w.mult})"/>`).join('');
  const svg = `<svg class="spark" viewBox="0 0 ${Wd} ${H}" preserveAspectRatio="none" role="img" aria-label="Fog every day this year">
    ${months}${wk}<line x1="0" x2="${Wd}" y1="${y(0.5)}" y2="${y(0.5)}" stroke="#b8c2bd" stroke-dasharray="3 3"/>
    <path d="${path}" fill="rgba(111,139,123,0.28)"/><path d="${line}" fill="none" stroke="#6f8b7b" stroke-width="1.6"/>${heat}
    <line x1="${x(WEIGHOFF)}" x2="${x(WEIGHOFF)}" y1="2" y2="${H}" stroke="#2f3a35" stroke-width="1.5"/></svg>`;
  const share = inShare(s, Math.min(s.clock.day, 213));
  return el('div', {}, el('div', { html: svg }),
    el('div.spark-legend', {}, ...['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((m) => el('span', { text: m }))),
    el('div.muted', { style: { marginTop: '6px', fontWeight: 700, fontSize: 'var(--fs-s)' }, text: `Marlene has been in on ${Math.round(share * 100)}% of days this year.` }));
}
// The October calendar: Oct 1 is always a Thursday; the four weekends sized by their crowds. [C] Plain words (rulings R11):
// the crowd numbers and next year's items stay hidden until Gran opens the Planting Table (they mean nothing before it);
// once the crates exist, each weekend shows how full its crate looks.
function october(s) {
  const table = !!s.unlocks.patch || s.clock.year > 1, crates = table && (s.patch?.rows || []).some((r) => r.plan || r.plantedDay != null) ? shelf(s) : null;
  const grid = el('div.octcal', {}, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => el('div.h', { text: d })));
  const first = dayOf('Oct 1'), lead = 3;                       // Mon-first grid: Thu is the 4th column
  for (let i = 0; i < lead; i++) grid.append(el('div.c.blank'));
  for (let d = first; d <= HALLOWEEN; d++) {
    const n = d - first + 1, wi = weekendIndex(d), past = s.clock.phase !== 'winter' && d < s.clock.day;
    const cls = [isWeekend(d) ? 'wk' : '', d === WEIGHOFF ? 'wo' : '', d === HALLOWEEN ? 'hw' : '', past ? 'past' : '', d === s.clock.day && s.clock.phase !== 'winter' ? 'today' : ''].filter(Boolean).join(' ');
    const tag = d === WEIGHOFF ? 'WEIGH' : d === HALLOWEEN ? 'BOO' : wi >= 0 ? `W${wi + 1}` : '';
    const crowd = wi >= 0 ? 0.1 + 0.32 * (T.calendar.weekends[wi].mult - 0.6) : null;   // deeper orange = bigger crowds
    const crate = wi >= 0 && crates ? crates[wi] : null;
    grid.append(el('div.c', { class: cls || null, title: label(d), style: crowd ? { '--crowd': crowd.toFixed(2) } : null }, el('span', { text: n }), tag ? el('small', { text: tag }) : null,
      crate && isSaturday(d) ? el('i.crate', { class: `l${crate.level}`, title: `W${wi + 1}'s crate` }) : null));
  }
  const legend = el('div.octlegend', {}, table ? [el('span', { text: 'Crowds:' }), T.calendar.weekends.map((w, i) => el('span', { html: `<b>W${i + 1}</b> ${CROWD_WORDS[Math.min(3, Math.round((w.mult - 0.6) * 4))]}` }))] : null,
    crates ? el('span', { html: '<i class="crate l2"></i> how full each crate looks' }) : null, el('span', { text: 'Weigh-off Mon Oct 26' }));
  return el('div', {}, grid, legend);
}
// ------------------------------------------------------------ [A] who to expect (plan §6.2): Marlene's moods bring visitors
// After Hal's intro, today and his three days get a weather word when it brings someone: "Pea soup" (f >= 0.82, or rain),
// "Bee day" (the first clear morning after a sulk), "Out" (f < 0.45); the visitor's name joins it once you've met them
// ("seal weather", "swarm weather", "goat weather"), so the fog's company is learned by meeting it, never told first.
function expect(s) {
  if (s.clock.phase !== 'grow') return null;
  const days = [{ day: s.clock.day, f: s.weather.f, rain: s.weather.rain }, ...(s.weather.forecast || [])];
  const chips = days.map((d, k) => [d, k, whoToExpect(s, d)]).filter(([, , x]) => x).map(([d, k, x]) => el('div.xchip', {},
    el('span.when', { text: k === 0 ? 'Today' : k === 1 ? 'Tomorrow' : dowName(d.day, true).slice(0, 3) }), el('b', { text: x.word }),
    x.who ? el('span.who', { text: x.who }) : null));
  return chips.length ? el('div.expect', {}, chips) : null;
}
const CROWD_WORDS = ['quiet', 'busy', 'busier', 'packed'];
function later(s) {
  const y = s.clock.year, rows = [];
  // [C] next year's fad is noise until the Table opens (rulings R11)
  if (y >= 2 || s.unlocks.patch) rows.push(el('div.row-item', {}, el('span', { html: icon('sparkle') }), el('div.grow', {}, el('div.title', { text: 'The fad' }),
    el('div.desc', { text: y >= 2 ? 'Edna prints the fad forecast in the winter Crier.' : 'From year 2, Edna forecasts which pumpkin the city will want.' }))));
  rows.push(el('div.row-item', {}, el('span', { html: icon('judge') }), el('div.grow', {}, el('div.title', { text: 'The judges' }),
    el('div.desc', { text: s.unlocks.crier ? 'Mayor Pouch loves colour, Edna loves tall, Sasha loves even skin.' : 'Announced in the September Crier.' }))));
  if (y >= W.archetypeFromYear) rows.push(el('div.row-item', {}, el('span', { html: icon('moon') }), el('div.grow', {}, el('div.title', { text: "Marlene's mood" }),
    el('div.desc', { text: `Old Moss: "${LINES.moss.mood[s.weather.hint] || LINES.moss.mood.normal}"` }))));
  return rows;
}

registerSheet('almanac', {
  eyebrow: () => 'KQSC 46.0 · The Ridge',
  title: () => 'Almanac',
  build(body, s, arg, api) {
    this._sig = null; this.update(body, s, arg, api);
    if (s.story.goal?.id === 'marlene') api.dispatch({ type: 'story/goalDone', id: 'marlene' });
  },
  update(body, s) {
    const sig = `${s.clock.year}|${s.clock.day}|${s.clock.phase}|${s.weather.f}|${!!s.unlocks.marlene}|${Object.keys(s.mischief?.met || {}).join()}|${!!s.unlocks.patch}|${(s.patch?.rows || []).map((r) => (r.plan ? 'p' : r.plantedDay != null ? 'i' : '-')).join('')}`;
    if (sig === this._sig) return;
    this._sig = sig;
    const top = body.scrollTop;
    body.innerHTML = '';
    const sec = (title, ic, ...kids) => el('div.section', {}, el('div.eyebrow', { html: `${icon(ic, 's')}${title}` }), ...kids);
    // the fog report, Hal's forecast and Marlene's year mean nothing until Hal has introduced her (plan §3.6, rulings R11):
    // before that the Almanac says when the report starts, without naming anyone the player hasn't met
    const met = !!s.unlocks.marlene;
    if (s.clock.phase !== 'winter' && !met) body.append(sec('The fog report', 'fog',
      el('div.empty-note', { html: `${icon('radio')}<span>The fog report starts ${label(dayOf(T.story.y1.marlene))}, on the radio.</span>` })));
    else if (s.clock.phase !== 'winter') {
      body.append(sec('Today', 'fog', today(s)), sec("Hal's forecast", 'radio', forecast(s)));
      const ex = expect(s);
      if (ex) body.append(sec('Who to expect', 'sparkle', ex));
    }
    if (met) body.append(sec('Marlene this year', 'calendar', sparkline(s)));
    body.append(sec('October', 'pumpkin', october(s)), sec('Coming up', 'sparkle', ...later(s)));
    body.scrollTop = top;
  },
});
registerStation({ id: 'almanac', label: 'Almanac', icon: 'almanac', order: 90, key: 'a',
  visible: (s) => s.clock.phase === 'grow' || s.clock.sub === 'weekday' || s.clock.phase === 'winter', onTap: (api) => api.openSheet('almanac') });

// ------------------------------------------------------------ Ledger (the winter slice adds report cards)
registerSheet('ledger', {
  eyebrow: (s) => `Year ${s.ledger.year.y}`,
  title: () => 'Ledger',
  build(body, s) { this._sig = null; this.update(body, s); },
  update(body, s) {
    const L = s.ledger.year, sig = JSON.stringify(L) + s.ledger.history.length;
    if (sig === this._sig) return;
    this._sig = sig;
    body.innerHTML = '';
    const rows = (obj, neg) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => el('div.ledger-row', {}, el('span', { text: k[0].toUpperCase() + k.slice(1) }), el('span.v', { class: neg ? 'neg' : null, text: (neg ? '−' : '') + fmt.cents(v) })));
    const inc = rows(L.income), exp = rows(L.expense, true);
    body.append(
      el('div.section', {}, el('div.eyebrow', { text: 'Income' }), inc.length ? inc : el('div.empty-note', { text: 'Nothing sold yet. October is coming.' })),
      el('div.section', {}, el('div.eyebrow', { text: 'Spending' }), exp.length ? exp : el('div.empty-note', { text: 'Nothing spent yet.' })),
      el('div.ledger-total', {}, el('span', { text: 'Net so far' }), el('span.num', { text: fmt.money(ledgerNet(L)) })));
    if (s.loan.owed > 0) body.append(el('div.section', {}, el('div.empty-note', { html: `${icon('coin')}<span>Gran's cookie tin: ${fmt.money(s.loan.owed)} still owed, repaid from 20% of season sales.</span>` })));
    if (s.ledger.history.length) body.append(el('div.section', {}, el('div.eyebrow', { text: 'Past years' }),
      s.ledger.history.slice().reverse().map((h) => el('div.ledger-row', {}, el('span', { text: `Year ${h.year}` }), el('span.v', { class: h.net < 0 ? 'neg' : null, text: fmt.money(h.net) })))));
  },
});

// ------------------------------------------------------------ the scale: the Cove record board
registerSheet('record', {
  eyebrow: () => 'Q.S.C. Official Scale', title: () => 'Cove record board',
  build(body, s) {
    const r = T.rivals.record;
    body.append(el('div.today', {}, el('div.glyph', { html: icon('scale') }), el('div', {}, el('div.big', { text: fmt.lb(r.W) }), el('div.muted', { text: `${r.who}, ${r.year}. "Nothing like '87."` }))));
    const pages = s.scrapbook || [];
    body.append(el('div.section', {}, el('div.eyebrow', { text: 'Your entries' }),
      pages.length ? pages.map((p) => el('div.ledger-row', {}, el('span', { text: `Year ${p.year} · ${p.name || 'your giant'}` }), el('span.v', { text: p.weight ? fmt.lb(p.weight) : '—' })))
        : el('div.empty-note', { text: 'Grandpa won this scale in a bet in \'79. Your first weigh-off is Mon Oct 26.' })));
  },
});
registerTap('scale', (hit, api) => api.openSheet('record'));
// (the growing-season whale is a delight now: its gold ✦ pin is track A's, ui/mischief.js)
