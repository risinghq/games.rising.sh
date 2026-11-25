// The top of the screen (design §12): HUD (menu, date + year, fog chip, cash), the single Next-up chip and the
// weekend second row. Everything diffs against what it last drew, so syncing every frame is cheap.
import { $, el, fmt, icon, bump, weatherIcon } from './dom.js';
import { chip } from '../sim/weather.js';
import { T } from '../sim/tuning.js';
import { createNextStop } from './road.js';

const FOG_PHASES = new Set(['grow', 'october', 'weighoff']);

export function createHud(api) {
  const root = $('#hud'), nextup = $('#nextup'), wkrow = $('#wkrow');
  const dateB = el('b'), dateS = el('span');
  const fog = el('button.fogchip', { 'data-target': 'hud:fog', 'aria-label': 'Marlene: fog report and forecast', 'data-tip': 'Fog report (A)', onclick: () => api.openSheet('almanac') });
  const cashV = el('span.v.num');
  const cash = el('button.cash', { 'data-target': 'hud:cash', 'data-coin-target': '', 'aria-label': 'Cash: open the ledger', 'data-tip': 'Ledger', onclick: () => api.openSheet('ledger') }, el('span.coin', { text: '$' }), cashV);
  root.append(
    el('button.iconbtn.menu', { 'aria-label': 'Menu', 'data-tip': 'Menu', onclick: () => api.openSheet('menu'), html: icon('menu') }),
    el('div.hud-date', {}, dateB, dateS), el('div.spacer'), fog, cash,
  );

  const sig = {};
  let shown = null, goalNode = null, goalId = null, doneTimer = 0;
  // [D] when there's no goal, the Next-up slot says what's next (road.js): never both
  const stop = createNextStop(api, nextup);

  function syncDate(s) {
    const d = fmt.date(s), sub = fmt.sub(s);
    if (d !== sig.d) { dateB.textContent = sig.d = d; }
    if (sub !== sig.sub) { dateS.textContent = sig.sub = sub; }
  }
  function syncFog(s) {
    const on = !!s.unlocks.marlene && FOG_PHASES.has(s.clock.phase);
    const c = chip(s), key = `${on}|${c.word}|${c.pct}`;
    if (key === sig.fog) return;
    sig.fog = key;
    fog.hidden = !on;
    fog.className = `fogchip w-${c.word.toLowerCase()}`;
    fog.innerHTML = `${icon(weatherIcon(c.f, c.heat, c.rain))}<span class="txt"><span class="w">${c.word}</span><span class="pct">${c.pct}% fog</span></span>`;
    fog.setAttribute('aria-label', `${c.line || c.word}, ${c.pct}% fog. Open the forecast`);
  }
  // Cash rolls toward the real number so income feels like income.
  function syncCash(s, rdt) {
    if (shown == null) shown = s.cash;
    if (shown !== s.cash) {
      shown += (s.cash - shown) * Math.min(1, rdt * 7);
      if (Math.abs(s.cash - shown) < 0.5) shown = s.cash;
    }
    const t = fmt.money(shown);
    if (t !== sig.cash) cashV.textContent = sig.cash = t;
  }

  // ---------------------------------------------------------- Next-up: exactly one goal
  function syncGoal(s) {
    const g = s.story.goal, id = g ? `${g.id}|${g.text}` : null;
    if (id === goalId) return;
    if (!g && goalNode && doneTimer) return;            // let the "Done" animation finish
    goalId = id;
    // the same goal re-aimed (the barn lesson's count grows as cohorts ripen): new words, same chip
    if (g && goalNode && !doneTimer && goalNode.dataset.gid === g.id) {
      goalNode.querySelector('.text').textContent = g.text;
      goalNode.setAttribute('aria-label', `Next up: ${g.text}`);
      goalNode.onclick = () => api.followGoal(api.s()?.story.goal);
      return;
    }
    goalNode?.remove(); goalNode = null;
    if (!g) return;
    goalNode = el('button.goal', { 'aria-label': `Next up: ${g.text}`, data: { gid: g.id } },
      el('span.tag', { html: `${icon('next', 's')}Next up` }), el('span.text', { text: g.text }));
    goalNode.onclick = () => api.followGoal(api.s()?.story.goal || g);
    nextup.append(goalNode);
  }
  function goalDone() {
    if (!goalNode) return;
    const n = goalNode;
    n.querySelector('.tag').innerHTML = `${icon('check', 's')}Done`;
    n.classList.add('ok');
    n.querySelector('.tag').style.background = 'var(--good)';
    doneTimer = setTimeout(() => { n.classList.add('done'); setTimeout(() => { n.remove(); if (goalNode === n) goalNode = null; doneTimer = 0; goalId = undefined; }, 320); }, 900);
  }
  // The moment passed (story.js goalLapse): the chip just bows out, no "Done"; a townsperson says why.
  function goalLapse() {
    if (!goalNode) return;
    const n = goalNode;
    goalNode = null; goalId = undefined;
    n.classList.add('done');
    setTimeout(() => n.remove(), 320);
  }
  // Pulse whatever control the goal teaches ([data-target="kind:id"]).
  function syncHighlight(s) {
    const t = s.story.goal?.target, key = t ? `${t.kind}:${t.id}` : '';
    if (key === sig.hl && sig.hlCount === document.querySelectorAll('[data-target]').length) return;
    sig.hl = key; sig.hlCount = document.querySelectorAll('[data-target]').length;
    document.querySelectorAll('[data-target].pulse').forEach((n) => n.classList.remove('pulse'));
    if (key) document.querySelectorAll(`[data-target="${CSS.escape(key)}"]`).forEach((n) => n.classList.add('pulse'));
  }

  // ---------------------------------------------------------- weekend row: Route 46 · stars · time · prime stock
  function syncWeekend(s) {
    const c = s.clock, on = c.phase === 'october' && c.sub !== 'weekday' && s.clock.minute >= 540;
    const q = s.season?.road?.q || 0, prime = (s.patch?.rows || []).reduce((a, r) => a + (r.stock?.prime || 0), 0);
    const showRoad = !!s.unlocks.route46 || c.year > 1;
    // [season] the trend since the gate opened, and the cars that gave up today
    const dR = s.rep.R - (s.season?.day?.rStart ?? s.rep.R), trend = dR > 0.015 ? '↑' : dR < -0.015 ? '↓' : '', turned = s.season?.day?.turned || 0;
    const key = `${on}|${q}|${s.rep.R.toFixed(1)}|${c.minute}|${prime}|${showRoad}|${trend}|${turned}`;
    if (key === sig.wk) return;
    sig.wk = key;
    wkrow.innerHTML = '';
    if (on !== sig.wkOn) { sig.wkOn = on; requestAnimationFrame(() => api.reinset?.()); }   // the camera's top inset follows the row
    if (!on) return;
    const R = T.season.road, bars = Math.min(4, Math.ceil((q / R.meterCars) * 4));
    const level = q >= R.red ? 'red' : q >= R.amber ? 'amber' : '';
    const meter = el('span.meter', { class: level, 'aria-label': `Route 46: ${q} cars waiting` }, [0, 1, 2, 3].map((i) => el('i', { class: i < bars ? 'on' : null })));
    wkrow.append(el('div.wk', {},
      showRoad ? [meter, el('span', { text: turned ? `Route 46 · ↩${turned}` : 'Route 46' }), el('span.sep')] : null,
      el('span', { html: `<span class="star">★</span> ${s.rep.R.toFixed(1)}${trend ? `<span class="trend ${dR > 0 ? 'up' : 'down'}">${trend}</span>` : ''}` }), el('span.sep'),
      el('span.num', { text: fmt.time(c.minute) }), el('span.sep'),
      el('span', { text: `Prime ${fmt.int(prime)}` })));
  }

  // If the one-line HUD still overflows (huge cash, big text), drop the secondary lines rather than clip.
  // (Measuring forces a layout, so only when the HUD's lengths change: never for cash rolling up digit by digit. And only
  // once the HUD is laid out and the web fonts are in: after a fast ?jump the first measure ran against the wider fallback
  // font or a hidden HUD and stuck in the compact form.)
  function fit() {
    const ready = root.clientWidth > 0 && (document.fonts?.status ?? 'loaded') === 'loaded';
    const key = `${sig.d}|${sig.sub}|${sig.fog}|${sig.cash?.length}|${innerWidth}|${api.settings.textScale}|${ready}`;
    if (key === sig.fit) return;
    sig.fit = key;
    root.classList.remove('tight');
    if (ready && root.scrollWidth > root.clientWidth + 1) root.classList.add('tight');
  }
  return {
    sync(s, rdt) { syncDate(s); syncFog(s); syncCash(s, rdt); syncGoal(s); stop.sync(s, !!goalNode); syncHighlight(s); syncWeekend(s); fit(); },
    onCash(delta) { bump(cash, delta >= 0 ? 'up' : 'down'); },
    goalDone,
    goalLapse,
    reset() { shown = null; goalId = null; goalNode?.remove(); goalNode = null; for (const k in sig) delete sig[k]; },
  };
}
