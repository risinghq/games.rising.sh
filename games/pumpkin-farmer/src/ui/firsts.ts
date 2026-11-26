// [D] Firsts on screen (plan §3.7, rulings R12): each { type: 'first' } out-event becomes a banner (api.payoff, banner.js) in
// the lower third, its character's line inside it, with a small burst at the subject. The camera glides there unless the
// player touched the screen in the last 2 s. It never changes the speed; a BIG one also ends a Skip (the sim does that).
// The seedling in her pot and the sign painting her name are drawn by render/giant.js.
// Grandpa's notes: the note shows in the dialogue band (speaker 'grandpa', a hand-written initial); one waiting by the stand
// is a pin there until it's read (pokes/read).
import { registerEvent, registerPin } from './registry.js';
import { PLACES, ROWS, rowZ } from '../sim/layout.js';
import { T } from '../sim/tuning.js';
import type { OutEvent, State } from '../sim/types.js';
import type { Api } from './types.js';

const GIANT = { x: PLACES.giant.x, z: PLACES.giant.z };
const rowMid = (r: unknown) => ({ x: (ROWS.x0 + ROWS.x1) / 2, z: rowZ(r) });

// With a sheet open the banner sits on top of it, which is where a dialogue card hangs down from the HUD: the banner waits
// (a few seconds at most) for the line to finish, so the two never overlap (rulings R12).
function whenClear(api: Api, fn: { (): void; (): void; }, waited = 0) {
  const busy = document.body.classList.contains('talking') && !!api.currentSheet();
  if (busy && waited < T.ui.banner.maxMs) setTimeout(() => whenClear(api, fn, waited + 250), 250);
  else fn();
}

registerEvent('first', (ev: OutEvent, api: Api) => {
  whenClear(api, () => api.payoff({ title: ev.title, sub: ev.sub, stamp: ev.stamp, big: ev.big, speaker: ev.speaker, line: ev.line, glide: ev.glide }));
  const fx = api.R?.fx;
  if (!fx) return;
  if (ev.at === 'giant' || ev.at === 'pot' || ev.at === 'sign') fx({ type: 'sparkle', x: GIANT.x, y: ev.at === 'pot' ? 0.7 : 1.4, z: GIANT.z, n: ev.big ? 16 : 9 });
  if (ev.at === 'row' && ev.row) {
    const p = rowMid(ev.row - 1);
    fx({ type: ev.id === 'ripe' ? 'pop' : 'dust', x: p.x, z: p.z, color: ev.id === 'ripe' ? 0xe0843a : undefined, n: 8 });
    fx({ type: 'sparkle', x: p.x, y: 0.5, z: p.z, n: 8 });
  }
  if (ev.id === 'lb1147') for (let i = 0; i < 3; i++) setTimeout(() => fx({ type: 'sparkle', x: GIANT.x, y: 2, z: GIANT.z, n: 14 }), i * 300);
});

// a note from the biscuit tin: the sound of paper
registerEvent('note', (ev, api: Api) => { api.sound('plink', { pitch: 1.6 }); api.haptic(8); });

// a note left by the stand (no quiet moment came for it): tap to read
registerPin({ id: 'note-porch', icon: 'scrapbook', label: "A note from Grandpa's biscuit tin",
  when: (s: State) => (s.pokes?.pile?.length ?? 0) > 0 && s.clock.phase === 'grow',
  pos: () => ({ x: PLACES.gran.x, y: 1.5, z: PLACES.gran.z }),
  onTap: (api: Api) => api.dispatch({ type: 'pokes/read' }) });
