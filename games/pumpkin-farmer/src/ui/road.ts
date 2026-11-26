// [D] The short Next-stop chip (plan §3.6, rulings R12). When there is no Next-up goal in the growing months, the Next-up
// slot says what's coming and when: "May 20 · Plan October ⏭". It is one tap target: the dock's Skip aimed at that stop
// (clock/skip { to: stop.day }), which still stops earlier for a card, a lesson, a threat or a ✦ (game.js stopsSkip). The
// Coming-up sheet behind it is Wave 2 (rulings R0), so the chip is the whole of it.
// What the player should feel: "I know what's next, and I can skip to it." Never "what am I waiting for?"
// hud.js hosts it in #nextup (createNextStop) and hides it whenever a goal chip shows: never both.
import { el, icon } from './dom.js';
import { road } from '../sim/story.js';
import { makeCtx } from '../sim/game.js';
import { ROAD, whenText, daysText } from '../sim/road-lines.js';
import type { DatedStop } from '../sim/road-lines.js';
import type { Action, State } from '../sim/types.js';
import type { Api } from './types.js';

// The next stop worth naming: the Road's next stop not yet reached (story.nextStop), skipping one whose ROAD entry says it
// won't come on this farm (no rows, no bugs).
export function stopAhead(s: State, ctx = makeCtx(s)): DatedStop | null {
  const d = s.clock.day;
  return road(s, ctx).find((x): x is DatedStop => !x.done && x.day != null && x.day >= d && (ROAD[x.id]?.when?.(s) ?? true)) || null;
}
// The stop the chip shows, or null: in the growing months, whenever there is no goal (pure: tests/sim/road.test.js).
export const chipStop = (s: State, ctx = makeCtx(s)) => (s.clock.phase === 'grow' && !s.story.goal ? stopAhead(s, ctx) : null);
// The chip's ⏭: the dock's Skip with this stop as its target. A stop that says "Today" (a lesson waiting out the gap after
// the last one) skips to it too, and no further than tomorrow: a tap that did nothing would read as a broken button.
export const chipSkip = (stop: { day: number; }, day: number): Action => ({ type: 'clock/skip', to: Math.max(stop.day, day + 1), quiet: true });

// What road() depends on, so the stop is only looked up when one of these changes (not every frame).
const keyOf = (s: State) => {
  const g = s.giant, rows = s.patch?.rows || [];
  return [s.clock.year, s.clock.day, s.clock.phase, Object.keys(s.story.beats).length, g?.flowerDay, g?.cullDay, g?.stage,
    rows.map((r) => `${r.plan?.day ?? ''}:${r.plantedDay ?? ''}`).join(',')].join('|');
};

export function createNextStop(api: Api, host: Element|null) {
  const when = el('b.ns-when'), title = el('span.ns-title');
  const node = el('button.goal.nextstop', { 'data-target': 'hud:nextstop', 'aria-label': 'Next stop' },
    el('span.ns-text', {}, when, el('span.ns-dot', { text: '·' }), title), el('span.ns-skip', { html: icon('skip') }));
  node.hidden = true;
  host?.append(node);
  let key: string|null = null, stop: DatedStop|null = null, shown: string|null = null;
  node.addEventListener('click', () => {
    const s = api.s();
    if (!s || !stop) return;
    api.markTouched();
    api.dispatch(chipSkip(stop, s.clock.day));
    node.classList.remove('go'); void node.offsetWidth; node.classList.add('go');
  });
  return {
    get stop() { return stop; },
    // goalShown: the goal chip is in the slot (or finishing its "Done"): the slot is the goal's
    sync(s: State, goalShown: boolean) {
      const k = keyOf(s);
      if (k !== key) { key = k; stop = s.clock.phase === 'grow' ? stopAhead(s) : null; }
      const show = !!stop && !goalShown && !s.story.goal && s.clock.phase === 'grow';
      const sig = show && stop ? `${stop.id}|${stop.day}|${s.clock.day}|${s.clock.speed > 4}` : '';
      if (sig === shown) return;
      shown = sig;
      node.hidden = !show;
      if (!show || !stop) return;
      when.textContent = whenText(stop, s.clock.day);
      title.textContent = stop.title;
      node.classList.toggle('skipping', s.clock.speed > 4);
      node.setAttribute('aria-label', `Next: ${stop.title}, ${whenText(stop, s.clock.day)} (${daysText(stop, s.clock.day)}). Skip to it`);
      node.dataset.tip = `Skip to ${stop.title} (${daysText(stop, s.clock.day)})`;
    },
  };
}
