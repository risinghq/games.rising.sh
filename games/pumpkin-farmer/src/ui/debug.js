// The ?debug overlay (design §14 human playtest hooks): phase, day, 1x clock, current beat and goal, the event log,
// actions per minute, FPS, draw calls and RNG stream positions, so human runs can be compared with bot targets.
import { $ } from './dom.js';
import { label, clockLabel } from '../sim/calendar.js';
import { isHeld, isBlocked } from '../sim/game.js';
import { hashState } from '../sim/save.js';

const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function createDebug(api) {
  const root = $('#debug');
  root.hidden = false;
  let frames = 0, fps = 0, t0 = performance.now(), n = 0, beat = '-', hash = '';
  const actions = [];
  return {
    action() { actions.push(performance.now()); },
    beat(id) { beat = id; },
    sync(s) {
      const now = performance.now();
      frames++;
      if (now - t0 > 500) { fps = (frames * 1000) / (now - t0); frames = 0; t0 = now; }
      if (n++ % 8) return;
      while (actions.length && now - actions[0] > 60000) actions.shift();
      if (n % 240 === 1) hash = hashState(s);
      const c = s.clock, st = api.R?.info?.() || api.R?.stats?.();
      root.textContent = [
        `${c.phase}${c.sub ? '/' + c.sub : ''}  Y${c.year} ${label(Math.min(c.day, 213))}${c.phase === 'october' && c.minute ? ' ' + clockLabel(c.minute) : ''}`,
        `1x ${mmss(c.clock1x)}  speed ${c.speed}${isHeld(s) ? ' held' : ''}${isBlocked(s) ? ' blocked' : ''}`,
        `f ${s.weather.f.toFixed(2)}${s.weather.heat ? ' HEAT' : ''}${s.weather.rain ? ' rain' : ''}  ${s.weather.archetype}`,
        `beat ${beat}  goal ${s.story.goal?.id || '-'}`,
        `cash ${s.cash.toFixed(2)}  R ${s.rep.R.toFixed(2)}  buzz ${s.rep.buzz.toFixed(2)}`,
        `actions/min ${actions.length}  fps ${fps.toFixed(0)}${st ? `  calls ${st.calls} tris ${st.triangles}` : ''}`,
        `rng ${Object.entries(s.rng).map(([k, v]) => `${k.slice(0, 3)}:${(v.s % 10000).toString().padStart(4, '0')}`).join(' ')}`,
        `hash ${hash}  notables ${s.events.notables}`,
        ...s.events.log.slice(-6).reverse().map((e) => `  ${mmss(e.t)} Y${e.y} ${label(e.d)} ${e.id}${e.cls === 'notable' ? ' *' : ''}`),
      ].join('\n');
    },
  };
}
