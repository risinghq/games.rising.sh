// The title screen (Continue / New farm / Settings over the slowly orbiting diorama), the new-farm flow (Mayor
// Pouch on the dock -> meet Marlene (named as the fog while the 3D fog rolls in) -> species with live preview
// -> surname -> farm name, the stand sign repaints -> the fog curtain lifts), and the menu, settings and help sheets (design §12 screen flow).
import { $, el, icon, fmt, need } from './dom.js';
import { registerSheet } from './registry.js';
import { portraitEl } from './dialog.js';
import { LINES, SPEAKERS, SPECIES, SURNAMES, DEFAULT_FARM, line } from '../sim/story.js';
import { T } from '../sim/tuning.js';
import type { State } from '../sim/types.js';
import type { Game } from '../sim/game.js';
import type { Api, Settings } from './types.js';

/** The save summary the title's Continue button shows. */
interface SaveInfo { farm: string; year: number; when: string }
/** Speaker entries by id, for rows that store only the id. */
const SPEAKER_NAMES: Record<string, { name: string }> = SPEAKERS;

// ------------------------------------------------------------ title
export function showTitle(app: { api: Api; continueGame?: () => void; newFarm?: () => void; game?: Game | null; preview?: State | null }, { save }: { save?: SaveInfo | null } = {}) {
  const root = need('#title');
  root.innerHTML = '';
  const cont = save ? el('button.btn.primary.cont', { onclick: () => app.continueGame?.() },
    el('span', { text: 'Continue' }), el('span.sub', { text: `${save.farm} · Year ${save.year} · ${save.when}` })) : null;
  root.append(
    el('div.veil'),
    el('div.title-head', {},
      el('div.eyebrow', { text: 'A foggy little pumpkin farm' }),
      el('h1', { html: 'Quarter Sun Cove<i>.</i>' }),
      el('p', { text: 'The sun shows up about a quarter of the time. The rest belongs to Marlene, our fog.' })),
    el('div.title-bottom', {},
      el('div.card.title-card', {}, cont,
        el('button.btn', { class: save ? null : 'primary', onclick: () => app.newFarm?.() }, el('span', { html: icon('pumpkin') }), 'New farm'),
        el('button.btn.ghost', { onclick: () => app.api.openSheet('settings') }, el('span', { html: icon('settings') }), 'Settings')),
      el('div.title-foot', { text: 'v1 · best with sound on' })));
  document.body.classList.add('on-title');
  frameTitle(app.api);
}
// The diorama orbits in the clear band between the title and the buttons.
export function frameTitle(api: Api) {
  const head = $('#title .title-head')?.getBoundingClientRect(), card = $('#title .title-card')?.getBoundingClientRect();
  if (head && card) api.R?.cam.setInset(innerHeight - card.top + 8, head.bottom + 8, 0);
}
export function hideTitle() { const t = $('#title'); if (t) t.innerHTML = ''; document.body.classList.remove('on-title'); }

// ------------------------------------------------------------ new farm
// The flow edits a real 'newgame' state through newgame/set, so the renderer shows the choice live (the farmer
// changes species on the dock, the stand sign repaints) before newgame/start lifts the fog.
export function newFarmFlow(app: { api: Api; game?: Game | null; preview?: State | null }, s: State, onDone: () => void) {
  const api = app.api, root = need('#title');
  const steps = ['welcome', 'marlene', 'species', 'surname', 'farm'];
  let i = 0, picked = false;
  root.innerHTML = '';
  const card = el('div.card.newfarm');
  root.append(el('div.veil', { style: { background: 'linear-gradient(180deg, rgba(211,220,219,0.55), rgba(211,220,219,0) 30%, rgba(211,220,219,0) 55%, rgba(211,220,219,0.85))' } }), el('div'), card);
  api.R.cam.title?.(false);

  const say = (text: string) => el('div.say', {}, portraitEl(api, 'mayor', s), el('div', {}, el('div.who', { text: SPEAKERS.mayor.name }), el('div.line', { text })));
  const nav = (primary: string, onNext: () => void, back = true) => el('div.nav', {},
    back && i > 0 ? el('button.btn', { 'aria-label': 'Back', onclick: () => go(i - 1), html: icon('back') }) : null,
    el('button.btn.primary', { onclick: onNext }, primary, el('span', { html: icon('next') })));

  // keep the camera's subject (the Mayor and your farmer on the dock, then the stand's sign) in the clear area
  // above the card; the card's height changes per step, so frame after it is laid out
  const frameAbove = (kind: string) => requestAnimationFrame(() => {
    api.R.cam.setInset(innerHeight - card.getBoundingClientRect().top + 12, 0, 0);
    if (api.settings.reduceMotion) api.R.cam.frame?.(kind, 0); else api.R.cam.frame?.(kind, kind === shot ? 450 : 1100);
    shot = kind;
  });
  let shot: string | null = null;
  let fogT: ReturnType<typeof setTimeout> | undefined;
  function go(k: number) {
    i = k;
    clearTimeout(fogT);
    api.R.setFogOverride?.(0);   // Marlene drifts back out whenever we leave her step
    frameAbove(steps[k] === 'farm' ? 'sign' : 'dock');
    card.innerHTML = '';
    card.append(el('div.steps', {}, steps.map((_, j) => el('i', { class: j <= i ? 'on' : null }))));
    const step = steps[i];
    if (step === 'welcome') {
      api.R.fx?.({ type: 'cast', who: 'mayor', act: 'wave', secs: 2.4 });
      card.append(say(LINES.mayor.welcome), nav('Hello!', () => go(1), false));
    } else if (step === 'marlene') {
      // Name her first, then let her roll in over the dock: the player meets the fog as a character
      // both lines are laid out from the start (the second invisible) so the camera framing never jumps
      const line2 = el('div.line.later', { text: LINES.mayor.marlene2 });
      const tag = el('div.marlene-tag', {}, el('span', { html: icon('fog') }), el('span', { text: LINES.mayor.marleneTag }));
      card.append(el('div.say', {}, portraitEl(api, 'mayor', s), el('div', {}, el('div.who', { text: SPEAKERS.mayor.name }),
        el('div.line', { text: LINES.mayor.marlene }), tag, line2)), nav(LINES.mayor.marleneHello, () => go(2)));
      fogT = setTimeout(() => {
        line2.classList.add('shown');
        api.R.setFogOverride?.(T.ui.marleneIntroFog);
        api.R.fx?.({ type: 'cast', who: 'mayor', act: 'nod', secs: 1 });
        api.sound('foghorn');
      }, 2600);
    } else if (step === 'species') {
      const lineEl = el('div.line', { text: picked ? line(s, LINES.mayor.species) : LINES.mayor.who });
      const grid = el('div.species-grid', { role: 'radiogroup', 'aria-label': 'Your species' }, T.species.list.map((sp) =>
        el('button.sp', { class: picked && s.meta.species === sp ? 'on' : null, role: 'radio', 'aria-checked': String(picked && s.meta.species === sp),
          onclick: (e) => {
            api.dispatch({ type: 'newgame/set', species: sp });
            picked = true;
            grid.querySelectorAll('.sp').forEach((b) => { b.classList.toggle('on', b === e.currentTarget); b.setAttribute('aria-checked', String(b === e.currentTarget)); });
            lineEl.textContent = line(s, LINES.mayor.species);
            api.sound('pop');
          } }, portraitEl(api, sp, s), el('span', { text: SPECIES[sp].one }))));
      card.append(el('div.say', {}, portraitEl(api, 'mayor', s), el('div', {}, el('div.who', { text: SPEAKERS.mayor.name }), lineEl)),
        el('div.controls', {}, grid), nav("That's me", () => {
          if (!picked) { api.dispatch({ type: 'newgame/set', species: s.meta.species }); picked = true; }
          api.R.fx?.({ type: 'cast', who: 'farmer', act: 'cheer', secs: 1.2 });
          go(3);
        }));
    } else if (step === 'surname') {
      const input = el('input.field', { value: s.meta.surname, maxlength: 18, autocomplete: 'off', autocapitalize: 'words', 'aria-label': 'Family name', enterkeyhint: 'next' });
      if (!(input instanceof HTMLInputElement)) return;
      const commit = () => api.dispatch({ type: 'newgame/set', surname: input.value });
      input.addEventListener('input', commit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { commit(); go(4); } });
      const dice = el('button.iconbtn', { 'aria-label': 'Suggest a name', html: icon('dice'), onclick: () => {
        const opts = SURNAMES.filter((n) => n !== input.value);
        input.value = opts[Math.floor(Math.random() * opts.length)] ?? input.value; commit(); api.sound('plink');
      } });
      card.append(say(LINES.mayor.surname), el('div.controls', {}, el('div.namefield', {}, input, dice)), nav('Next', () => { commit(); go(4); }));
    } else {
      const input = el('input.field', { value: s.meta.farmName, maxlength: 32, autocomplete: 'off', autocapitalize: 'words', 'aria-label': 'Farm name', enterkeyhint: 'done' });
      if (!(input instanceof HTMLInputElement)) return;
      const commit = () => api.dispatch({ type: 'newgame/set', farmName: input.value || DEFAULT_FARM });
      input.addEventListener('input', commit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(); });
      const finish = () => { commit(); onDone(); };
      card.append(say(line(s, LINES.mayor.farm, { farm: DEFAULT_FARM })), el('div.controls', {}, input), nav('Open the farm', finish));
    }
  }
  go(0);
}

// ------------------------------------------------------------ menu, settings, help
registerSheet('menu', {
  title: (s: State) => s.meta.farmName, eyebrow: (s: State) => `${s.meta.surname} farm · Year ${s.clock.year}`,
  build(body, s: State, _arg, api: Api) {
    const item = (ic: string, title: string, desc: string, fn: () => void, cls?: string) => el('button.row-item', { class: cls || null, onclick: fn },
      el('span', { html: icon(ic) }), el('div.grow', {}, el('div.title', { text: title }), desc ? el('div.desc', { text: desc }) : null), el('span', { html: icon('next', 's') }));
    body.append(el('div.menu-grid', {},
      item('ledger', 'Ledger', `${fmt.money(s.cash)} in the tin`, () => api.openSheet('ledger')),
      item('scrapbook', 'Scrapbook', 'One page per year', () => api.openSheet('scrapbook')),
      item('stroll', 'Stroll', 'Walk the farm in first person (F)', () => { api.closeSheet(); api.R.cam?.stroll?.(true); }),
      item('help', 'Help', 'Replay a tutorial, controls', () => api.openSheet('help')),
      item('settings', 'Settings', 'Sound, haptics, motion, text size', () => api.openSheet('settings')),
      item('exit', 'Save & quit', 'Back to the title screen', () => api.saveAndQuit())));
  },
});

registerSheet('scrapbook', {
  title: () => 'Scrapbook', eyebrow: (s: State) => s.meta.farmName,
  build(body, s: State) {
    const pages = s.scrapbook || [];
    body.append(...(pages.length ? pages.map((p) => el('div.row-item', {}, el('span', { html: icon('scrapbook') }),
      el('div.grow', {}, el('div.title', { text: `Year ${p.year}: ${p.headline || ''}` }), el('div.desc', { text: p.name ? `${p.name} · ${p.weight ? fmt.lb(p.weight) : ''}` : '' }))))
      : [el('div.empty-note', { html: `${icon('scrapbook')}<span>Your first page is printed after the weigh-off: one photo, one headline, one year.</span>` })]));
  },
});

/** The boolean settings the Settings sheet lists as toggles. */
type BoolSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
const SETTINGS: [BoolSetting, string, string][] = [
  ['sound', 'Sound', 'Synthesised blips and the foghorn'],
  ['haptics', 'Haptics', 'A little buzz on every tap'],
  ['captions', 'Captions', 'Show a caption for every sound cue'],
  ['reduceMotion', 'Reduce motion', 'No camera glides, shakes or flashes'],
  ['autoSlowCreaks', 'Auto-slow on creaks', 'Drop to 1x when the giant creaks'],
  ['relaxedRegister', 'Relaxed register', 'Gran rings up at her own pace; no Rush'],
  ['hurryQuiet', 'Hurry quiet days', 'Empty summer days run at 2x until something happens'],
  ['simpleGestures', 'Simple gestures', 'Close-ups take plain taps, and their timers run half as long again'],   // [E]
];
registerSheet('settings', {
  title: () => 'Settings',
  build(body, _s, _arg, api: Api) {
    const st = api.settings;
    for (const [key, title, desc] of SETTINGS) {
      const t = el('button.toggle', { class: st[key] ? 'on' : null, role: 'switch', 'aria-checked': String(!!st[key]), 'aria-label': title });
      t.addEventListener('click', (e) => { e.stopPropagation(); api.setSetting(key, !st[key]); t.classList.toggle('on', !!st[key]); t.setAttribute('aria-checked', String(!!st[key])); });
      // the whole 56px row is the tap target, not just the 32px switch
      body.append(el('div.setting.tap', { onclick: () => t.click() }, el('div.grow', {}, el('div.title', { text: title }), el('div.desc', { text: desc })), t));
    }
    const seg = el('div.seg', { role: 'group', 'aria-label': 'Text size' }, T.ui.textScale.map((v) => el('button', { class: st.textScale === v ? 'on' : null, text: `${Math.round(v * 100)}%`,
      onclick: (e) => { api.setSetting('textScale', v); seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); } })));
    body.append(el('div.setting', {}, el('div.grow', {}, el('div.title', { text: 'Text size' })), seg));
  },
});

const CONTROLS_TOUCH = [['Drag', 'pan the farm'], ['Pinch', 'zoom'], ['Twist', 'rotate (snaps to 4 angles)'], ['Tap', 'anything with a story'], ['Hold', 'the giant, to talk to her']];
const CONTROLS_KEYS = [['Space', 'pause'], ['1 2 4', 'speed'], ['S', 'skip'], ['R', 'ring up'], ['W', 'water the patch'], ['G P B L T', 'giant, patch, barn, lot, stand'], ['A', 'almanac'], ['H', 'home view'], ['F', 'stroll'], ['Esc', 'close']];
registerSheet('help', {
  title: () => 'Help',
  build(body, s: State, _arg, api: Api) {
    const seen = Object.entries(s.story.replay || {});
    body.append(el('div.section', {}, el('div.eyebrow', { text: 'Replay a tutorial' }),
      seen.length ? seen.map(([id, r]) => el('button.row-item', { onclick: () => { api.closeSheet(); api.dispatch({ type: 'story/replay', id }); } },
        portraitEl(api, r.speaker, s), el('div.grow', {}, el('div.title', { text: SPEAKER_NAMES[r.speaker]?.name || r.speaker }), el('div.desc', { text: r.lines[0] ?? '' })), el('span', { html: icon('play', 's') })))
        : el('div.empty-note', { text: 'Townsfolk will drop by as the year goes on. Anything they teach you can be replayed here.' })));
    const keys = (list: string[][]) => list.map(([k, v]) => el('div.ledger-row', {}, el('span', {}, ...(k || '').split(' ').map((x) => el('span.kbd', { text: x })), ' '), el('span.muted', { text: v || '' })));
    body.append(el('div.section', {}, el('div.eyebrow', { text: 'Touch' }), keys(CONTROLS_TOUCH)));
    if (matchMedia('(hover: hover)').matches) body.append(el('div.section', {}, el('div.eyebrow', { text: 'Keyboard' }), keys(CONTROLS_KEYS)));
  },
});
