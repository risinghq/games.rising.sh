// The bottom tray (design §12): the station bar (56px) above the dock (64px) with speed controls on the left and
// the contextual FAB on the right, in the thumb zone. Stations and FAB modes come from the registries.
import { $, el, icon } from './dom.js';
import { REG } from './registry.js';
import { speedRules } from '../sim/game.js';
import { T } from '../sim/tuning.js';
import type { Action, State } from '../sim/types.js';
import type { Api, FabDef } from './types.js';

// what the dock says in the beat-driven phases, where there are no speed controls
const NOTES = {
  weighoff: (s: State) => (s.weighoff?.stage === 'eve' ? 'The eve of the weigh-off. Big day tomorrow.' : 'Weigh-off day. The Weighmaster awaits.'),
  halloween: () => 'Halloween night on the farm.', winter: () => 'Winter. The farm sleeps until spring.',
};

export function createDock(api: Api) {
  const stationsEl = $('#stations'), dock = $('#dock');
  const sp = (k: string, html: string, tip: string, act: () => Action) => el('button', { data: { k }, html, 'aria-label': tip, 'data-tip': tip, onclick: () => api.dispatch(act()) });
  const B = {
    0: sp('0', icon('pause'), 'Pause (Space)', () => ({ type: 'clock/pause', on: true })),
    1: sp('1', '1x', 'Normal speed (1)', () => ({ type: 'clock/speed', speed: 1 })),
    2: sp('2', '2x', 'Double speed (2)', () => ({ type: 'clock/speed', speed: 2 })),
    4: sp('4', '4x', 'Fast (4)', () => ({ type: 'clock/speed', speed: 4 })),
    skip: sp('skip', icon('skip'), 'Skip to the next thing (S)', () => ({ type: 'clock/skip' })),
  };
  B.skip.classList.add('skip');
  B[4].dataset.target = 'speed:4';
  const speed = el('div.seg.speed', { role: 'group', 'aria-label': 'Game speed' }, B[0], B[1], B[2], B[4], B.skip);
  const note = el('div.dock-note');
  const home = el('button.iconbtn.round.home-btn', { html: icon('home'), 'aria-label': 'Home view (H)', 'data-tip': 'Home view (H)', onclick: () => api.home() });
  const fab = el('button.fab', { 'aria-label': 'Action' });
  dock.append(speed, note, home, fab);

  let fabDef: FabDef|null = null, sig = {}, nudge = false;
  fab.addEventListener('click', () => fabDef?.onTap(api));

  function syncSpeed(s: State) {
    const r = speedRules(s), v = s.clock.speed, key = `${r.speeds}|${r.skip}|${v}|${s.clock.phase}|${s.clock.sub}|${s.weighoff?.stage}|${nudge}`;
    if (key === sig.speed) return;
    sig.speed = key;
    speed.hidden = !r.speeds.length;
    note.hidden = !!r.speeds.length;
    note.textContent = NOTES[s.clock.phase]?.(s) ?? '';
    for (const k of [0, 1, 2, 4]) { B[k].hidden = !r.speeds.includes(k); B[k].classList.toggle('on', v === k); }
    B.skip.hidden = !r.skip;
    B.skip.classList.toggle('on', v === T.clock.skip);
    const tip = s.clock.sub === 'weekday' ? 'Skip to Saturday (S)' : 'Skip to the next thing (S)';
    B.skip.setAttribute('aria-label', tip); B.skip.dataset.tip = tip;
    B[4].classList.toggle('nudge', nudge && !B[4].hidden);
  }

  function syncFab(s: State) {
    const def = REG.fabs.find((f) => { try { return f.when(s); } catch { return false; } }) || null;
    const ring = def?.ring ? def.ring(s) : null, badge = def?.badge ? def.badge(s) : null;
    const label = def ? def.label(s) : '', ic = def ? (def.icon ? def.icon(s) : 'next') : '';
    const key = def ? `${def.id}|${label}|${ic}|${ring == null ? '' : ring.toFixed(2)}|${badge ?? ''}|${def.cls?.(s) ?? ''}` : '';
    fabDef = def;
    if (key === sig.fab) return;
    sig.fab = key;
    fab.hidden = !def;
    if (!def) return;
    fab.className = `fab ${def.cls?.(s) || ''}`;
    fab.dataset.target = `fab:${def.id}`;
    fab.setAttribute('aria-label', label);
    const C = 2 * Math.PI * 33;
    fab.innerHTML = (ring == null ? '' : `<svg class="ring" viewBox="0 0 74 74"><circle class="bg" cx="37" cy="37" r="33"/><circle class="fg ${ring < 0.3 ? 'low' : ''}" cx="37" cy="37" r="33" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.max(0, Math.min(1, ring)))}"/></svg>`)
      + icon(ic) + `<span class="fab-label${/\s/.test(label) && label.length > 8 ? ' two' : ''}">${label}</span>` + (badge ? `<span class="badge">${badge}</span>` : '');
  }

  // Stations are diffed in place: a new one pops in once, and opening a sheet or a badge changing never rebuilds the bar
  // (a rebuild replayed the pop and restarted a goal's pulse on the station it points at)
  function syncStations(s: State) {
    const vis = REG.stations.filter((d) => { try { return d.visible(s); } catch { return false; } });
    const open = api.currentSheet();
    const key = vis.map((d) => `${d.id}:${d.badge?.(s) ?? ''}`).join(',') + '|' + open;
    if (key === sig.st) return;
    sig.st = key;
    const have = new Map([...stationsEl.children].map((n) => [n.dataset.id, n]));
    for (const [id, n] of have) if (!vis.some((d) => d.id === id)) n.remove();
    vis.forEach((d, i) => {
      let n = have.get(d.id);
      if (!n) {
        n = el('button.station', { data: { target: `station:${d.id}`, id: d.id }, 'aria-label': d.label, 'data-tip': d.key ? `${d.label} (${d.key.toUpperCase()})` : d.label },
          el('span', { html: icon(d.icon) }), el('span', { text: d.label }));
        n.addEventListener('click', () => {
          const def = REG.stations.find((x) => x.id === d.id);
          if (n.classList.contains('on')) api.closeSheet(); else def?.onTap(api);
        });
        if (sig.stReady) n.classList.add('new');
      }
      n.classList.toggle('on', !!(open && (open === (d.sheet || d.id) || d.active?.(s))));
      const b = d.badge?.(s), bn = n.querySelector('.badge');
      if (b == null && bn) bn.remove();
      else if (b != null && !bn) n.append(el('span.badge', { text: b }));
      else if (b != null && bn.textContent !== String(b)) bn.textContent = b;
      if (stationsEl.children[i] !== n) stationsEl.insertBefore(n, stationsEl.children[i] || null);
    });
    sig.stReady = true;
  }

  return {
    sync(s: State) { syncSpeed(s); syncFab(s); syncStations(s); },
    setNudge(on: boolean) { nudge = on; },
    triggerFab(id: any) { if (fabDef && (!id || fabDef.id === id)) { fab.classList.remove('squash'); void fab.offsetWidth; fab.classList.add('squash'); fabDef.onTap(api); return true; } return false; },
    stationByKey(k: string|undefined) { return REG.stations.find((d) => d.key === k); },
    reset() { for (const k in sig) delete sig[k]; stationsEl.innerHTML = ''; },
  };
}
