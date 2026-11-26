// The UI root (architecture §5.1): wires the Game, the renderer and the UI, runs the frame loop
// (game.tickReal(dt x uiSpeedMul) -> drain events -> R.fx / UI handlers -> R.sync -> UI sync), owns the save
// cadence, settings and the title / new farm / continue flows, and exposes `api` to the slice UIs.
export * from './registry.js';
import { REG, registerFab } from './registry.js';
import { el, bump, need } from './dom.js';
import * as audio from './audio.js';
import { createHud } from './hud.js';
import { createDock } from './dock.js';
import { createSheets } from './sheets.js';
import { createCards, confirmModal } from './cards.js';
import { createDialog, warmPortraits } from './dialog.js';
import { createToasts } from './toasts.js';
import { createPins } from './pins.js';
import { createInput } from './input.js';
import { createDebug } from './debug.js';
import { showTitle, hideTitle, newFarmFlow, frameTitle } from './title.js';
import { createBanner } from './banner.js';
import { openBubble } from './bubble.js';
import { createCaption } from './caption.js';
import { clockMul } from './clock.js';
import './almanac.js';
// slice UIs register themselves on import (stubs until the slices land)
import './patch.js';
import './giant.js';
import './season.js';
import './weighoff.js';
import './winter.js';
// the growing-year tracks' UIs (plan §6.0; stubs from the foundation until each track lands)
import './mischief.js';
import './shelf.js';
import './crawl.js';
import './firsts.js';
import './pokes.js';
import './road.js';
import './hands.js';
import { T } from '../sim/tuning.js';
import { Game, createGame, isBlocked, speedRules, makeCtx } from '../sim/game.js';
import { quiet } from '../sim/story.js';
import { serialize, deserialize, summary, SAVE_KEY } from '../sim/save.js';
import { jumpTo } from '../sim/bots.js';
import type { State, Action } from '../sim/types.js';
import type { NewGameOpts } from '../sim/game.js';
import type { Prefs, StoryGoal } from '../sim/state.js';
import type { Renderer } from '../render/types.js';
import { isUiEvent } from './types.js';
import type { Api, ScreenDef, Settings, SettingKey, UiEvent, UiEventOf } from './types.js';

const SETTINGS_KEY = 'qsc.settings';
// toast look for catalogued events (slices may add their own ids here or style them in registerEvent handlers)
// (tracks add their own with registerEventStyle(id, { cls, ic }))
const EVENT_STYLE: Record<string, { cls?: string; ic?: string }> = { heat_wave: { cls: 'heat', ic: 'heat' }, quarter_sun: { ic: 'sun' }, whale: { ic: 'whale' } };
// hurryQuiet: quiet growing days run at 2x (off by default, rulings R10); simpleGestures: close-ups take taps instead of
// drags and rubs (track E)
export const DEFAULT_SETTINGS = { sound: true, haptics: true, captions: false, reduceMotion: false, autoSlowCreaks: true, relaxedRegister: false, textScale: 1,
  hurryQuiet: false, simpleGestures: false };
const SIM_PREFS: readonly (keyof Prefs & SettingKey)[] = ['autoSlowCreaks', 'relaxedRegister'];
const QUIET_FAIL = new Set(['story/dialogSeen', 'story/goalDone', 'events/tap', 'clock/pause', 'hands/close']);
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
  keys() { try { return Object.keys(localStorage); } catch { return []; } },
};
// Storage full: the farm matters more than the pictures. Drop scrapbook photos (oldest first, the newest last) and the
// carving mask until the write fits; if it never does, put them back. Returns whether it was written.
function setOrMakeRoom(k: string, v: string) {
  if (store.set(k, v)) return true;
  const spare = store.keys().filter((x) => x.startsWith('qsc.photo.') && x !== k).sort((a, b) => +(a.split('.').pop() ?? '') - +(b.split('.').pop() ?? ''));
  const dropped: [string, string][] = [];
  for (const x of ['qsc.carve', ...spare]) {
    const old = store.get(x);
    if (old == null) continue;
    store.del(x); dropped.push([x, old]);
    if (store.set(k, v)) return true;
  }
  for (const [x, old] of dropped) store.set(x, old);
  return false;
}
export function loadSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(store.get(SETTINGS_KEY) || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
}
export function readSave(): State | null {
  const raw = store.get(SAVE_KEY);
  if (!raw) return null;
  try { return deserialize(raw); } catch (e) { console.warn('Quarter Sun Cove: the save could not be read', e); return null; }
}

// The foundation's fallback FAB: steps through the beat-driven phases until the weigh-off and winter slices
// register their own (higher priority) modes.
registerFab({
  id: 'continue', priority: -100, cls: () => 'sage', icon: () => 'next',
  when: (s: State) => s.clock.phase === 'weighoff' || s.clock.phase === 'halloween' || s.clock.phase === 'winter',
  label: (s: State) => (s.clock.phase === 'winter' ? `Year ${s.clock.year + 1}` : 'Next'),
  onTap: (api) => {
    const p = api.s()?.clock.phase;
    api.dispatch({ type: p === 'weighoff' ? 'weighoff/next' : p === 'halloween' ? 'winter/next' : 'winter/beginYear' });
  },
});

interface AppParams {
  seed?: number; new?: boolean; jump?: string | null; speed?: string | null;
  debug?: boolean; mute?: boolean; render?: string;
}
/** The app object the UI hangs off: game/title lifecycle, frame state, and the slice UIs once built. */
interface App {
  R: Renderer; settings: Settings; params: AppParams; api: Api;
  game: Game | null; preview: State | null; mode: string;
  touchedAt: number; lastInput: number; lastAlert: number;
  glides?: number;
  director?: { back: { x: number; z: number; zoom: number | undefined }; t: number; glides: number | undefined } | null;
  debug?: ReturnType<typeof createDebug>;
  savedAt?: number; saveWarned?: boolean; pausedByHide?: boolean;
  start?(): void; startNow?(opts?: NewGameOpts): Game;
  attach?(g: Game): void; detach?(): void; showTitleScreen?(): void; save?(): boolean;
  continueGame?(): void; newFarm?(): Promise<void>;
  hud?: ReturnType<typeof createHud>; dock?: ReturnType<typeof createDock>;
  sheets?: ReturnType<typeof createSheets>; cards?: ReturnType<typeof createCards>;
  dialog?: ReturnType<typeof createDialog>; toasts?: ReturnType<typeof createToasts>; pins?: ReturnType<typeof createPins>;
}

export function createApp({ R, settings = loadSettings(), params = {} }: { R: Renderer; settings?: Settings; params?: AppParams }) {
  const app: App = {
    R, settings, params,
    game: null, preview: null, mode: 'boot', touchedAt: -1e9, lastInput: performance.now(), lastAlert: -1e9,
    api: {
      R, settings,
      get game() { return app.game; },
      s: () => app.game?.s || null,
      dispatch(a: Action) {
        if (!app.game) return { ok: false, reason: 'no game', events: [] };
        const r = app.game.dispatch(a);
        for (const ev of r.events) ev.mine = true;   // the answer to a tap: its toasts show at once (toasts.js)
        app.debug?.action();
        if (!r.ok && r.reason && !QUIET_FAIL.has(a.type) && !a.quiet) { toasts.toast(r.reason.charAt(0).toUpperCase() + r.reason.slice(1), 'bad'); audio.play('thunk'); }
        return r;
      },
      openSheet: (id, arg) => sheets.open(id, arg),
      closeSheet: () => sheets.close(),
      currentSheet: () => sheets.id,
      openScreen, closeScreen,
      toast: (text, cls, ic) => toasts.toast(text, cls, ic),
      notable: (text, opts) => toasts.notable(text, opts),
      caption: (text) => toasts.caption(text),
      sound(name, opts) { const cap = audio.play(name, opts ? { type: 'sound', name, ...(typeof opts.pitch === 'number' ? { pitch: opts.pitch } : {}), ...(typeof opts.mine === 'boolean' ? { mine: opts.mine } : {}) } : undefined); if (cap) toasts.caption(cap); },
      haptic: (ms) => audio.haptic(ms),
      glide(x, z, zoom, ms = 600) { app.glides = (app.glides ?? 0) + 1; R.cam?.glide?.(x, z, zoom, settings.reduceMotion ? 0 : ms); },
      home() { R.cam?.home?.(settings.reduceMotion ? 0 : undefined); },
      confirm: (text, opts) => confirmModal(text, opts).then((v) => v === true),
      markTouched() { app.touchedAt = performance.now(); app.lastInput = app.touchedAt; },
      followGoal,
      setSetting,
      saveAndQuit,
      save,
      // scrapbook reveal photos live in their own keys so a failed photo write never loses the save (§3.10)
      photo: {
        save(year, url) {
          const ok = store.set(`qsc.photo.${year}`, url);   // (never at the save's expense: no making room for a photo)
          for (let y = year - T.winter.scrapbook.keep; y > 0 && store.get(`qsc.photo.${y}`) != null; y--) store.del(`qsc.photo.${y}`);
          return ok;
        },
        load: (year) => store.get(`qsc.photo.${year}`),
      },
      closeTop() { if (screen) { closeScreen(); return true; } if (sheets.id) { sheets.close(); return true; } if (dialog.open) { dialog.tap(); return true; } return false; },
      blockedByUi: () => app.mode !== 'play' || cards.open,
      // a tap that closed a dialogue card or a banner must not land on the farm behind it (input.js asks before every world tap)
      dialogJustTapped: () => dialog.justTapped || banner.justTapped,
      // [foundation] the shared moment components (plan §2.2): a banner for good news, a quick bubble, a caption over a thing
      payoff: (o) => banner.payoff(o),
      bubble: (d) => openBubble(api, { ...d, at: d.at == null ? { x: 0, y: 0, z: 0 } : { x: d.at.x, y: d.at.y, z: d.at.z }, lift: d.lift }).then((v) => String(v)),
      captionAt(at, text, opts) {
        const n = caption.show({ x: at.x, y: at.y, z: at.z }, text, { onTap: null, cls: null, ...(opts?.ms === undefined ? {} : { ms: opts.ms }) });
        if (n) {
          if (opts?.cls) n.classList.add(...opts.cls.split(' ').filter(Boolean));
          if (opts?.onTap) { n.classList.add('tappable'); n.addEventListener('click', (e: Event) => { e.stopPropagation(); caption.hide(); opts.onTap?.(); }); }
        }
        return n;
      },
      reinset: () => sheets.inset(),
    },
  };
  const api = app.api;
  const errors = new Set<string>();
  // A bug in one slice's UI must not stop the frame loop: log it once and carry on.
  const guard = <T>(where: string, fn: () => T): T | undefined => { try { return fn(); } catch (e) { const k = `${where}: ${e instanceof Error ? e.message : e}`; if (!errors.has(k)) { errors.add(k); console.error(`[ui] ${k}`, e); } } };


  const hud = createHud(api), dock = createDock(api), sheets = createSheets(api), cards = createCards(api);
  // news waits while an intro is being read (it holds the clock; the morning's other news comes after, one at a time)
  // (and while a banner is up: the morning's news comes after the good news)
  const hold: () => boolean = () => !!app.game?.s.story.dialog[0]?.pause || !!banner.showing;
  const dialog = createDialog(api), toasts = createToasts(api, { hold }), pins = createPins(api);
  const banner = createBanner(api, { touchedRecently: (): boolean => performance.now() - lastTouch() < T.ui.glide.touchedWithin * 1000 }), caption = createCaption(api);
  createInput(api, dock);
  if (params.debug) app.debug = createDebug(api);

  // ---------------------------------------------------------- full-screen flows (registerScreen)
  let screen: { id: string; def: ScreenDef; node: HTMLElement } | null = null;
  function openScreen(id: string) {
    const def = REG.screens.get(id);
    if (!def) return false;
    closeScreen();
    const node = el('div.screen', { data: { screen: id } });
    need('#screens').append(node);
    screen = { id, def, node };
    guard(`screen ${id}`, () => def.build(node, app.game?.s, api));
    document.body.classList.add('screen-open');
    return true;
  }
  function closeScreen() { if (!screen) return; screen.def.onClose?.(api); screen.node.remove(); screen = null; document.body.classList.remove('screen-open'); }
  // screens with auto(s) open themselves when their moment comes (the weigh-off, Halloween, the winter flow), also
  // after a load or a ?jump, and close when it passes; a screen opened by hand stays until it is closed
  function autoScreens(s: State) {
    let want = null;
    for (const [id, def] of REG.screens) if (def.auto?.(s)) { want = id; break; }
    if (want && screen?.id !== want) openScreen(want);
    else if (!want && screen?.def.auto) closeScreen();
  }

  // ---------------------------------------------------------- settings
  function applySettings() {
    audio.configure(settings);
    document.body.classList.toggle('reduce-motion', !!settings.reduceMotion);
    document.documentElement.style.setProperty('--ts', String(settings.textScale || 1));
  }
  function setSetting<K extends SettingKey>(key: K, value: Settings[K]) {
    settings[key] = value;
    store.set(SETTINGS_KEY, JSON.stringify(settings));
    applySettings();
    if ((key === 'autoSlowCreaks' || key === 'relaxedRegister') && app.game) api.dispatch({ type: 'prefs/set', key, value: !!value, quiet: true });
    if (key === 'textScale') requestAnimationFrame(() => sheets.inset());
  }
  applySettings();

  // ---------------------------------------------------------- goals: tapping the Next-up chip shows you where
  // It points and never taps for you (plan P10: the "Water the patch" chip used to water): it opens the station's sheet,
  // where the taught control pulses and scrolls into view, or glides to the place, and pings the control it means.
  function followGoal(g: StoryGoal | null) {
    const t = g?.target;
    api.markTouched();
    if (!t) return;
    const key = `${t.kind}:${t.id}`;
    if (t.kind === 'station') {
      // opening a station's sheet is what tapping the station does: navigation, never the lesson's action
      const st = REG.stations.find((x) => x.id === t.id), sheet = st?.sheet || t.id, cur = api.s();
      if (sheets.id !== sheet) { if (cur && st?.visible?.(cur)) st.onTap(api); else if (typeof sheet === 'string' && REG.sheets.has(sheet)) api.openSheet(sheet, 'arg' in t ? t.arg : undefined); }
    } else if (t.kind === 'row' && REG.sheets.has('row')) api.openSheet('row', t.id);   // squish row N, cut row N: its sheet
    else if (t.x != null && t.z != null) api.glide(t.x, t.z, t.zoom);
    else if (t.kind !== 'fab' && t.kind !== 'hud' && typeof t.id === 'string' && REG.sheets.has(t.id)) api.openSheet(t.id, 'arg' in t ? t.arg : undefined);
    else if (t.kind !== 'fab' && t.kind !== 'hud') R.cam?.frame?.(t.kind);
    requestAnimationFrame(() => document.querySelectorAll(`[data-target="${CSS.escape(key)}"]${t.control ? `, [data-control="${CSS.escape(t.control)}"]` : ''}`)
      .forEach((n) => { if (!(n instanceof HTMLElement) || n.offsetParent === null) return; bump(n, 'goal-ping'); setTimeout(() => n.classList.remove('goal-ping'), 1600); }));
  }

  // ---------------------------------------------------------- out-events
  const ON = {
    toast: (ev: UiEventOf<'toast'>) => toasts.news(ev.text, ev.cls, ev.icon ?? 'sparkle', { mine: ev.mine, ...(ev.key === undefined ? {} : { key: ev.key }) }),
    sound: (ev: UiEventOf<'sound'>) => api.sound(ev.name, ev),
    alert(ev: UiEventOf<'alert'>) {
      // only a threat buzzes and counts as "something urgent" (it is also the only kind that dropped the speed)
      if (ev.threat) { app.lastAlert = performance.now(); audio.haptic(20); }
      if (ev.text) toasts.news(ev.text, ev.cls || 'warn', ev.cls === 'heat' ? 'heat' : 'alert', { mine: ev.mine });
      api.sound(ev.kind === 'creak' ? 'creak' : 'alert');
    },
    event(ev: UiEventOf<'event'>) {
      const st = EVENT_STYLE[ev.id] || REG.eventStyles.get(ev.id) || {};
      if (ev.text && ev.cls !== 'chain') (ev.cls === 'notable' ? toasts.notable(ev.text, { urgent: ev.urgent, mine: ev.mine, ...st }) : toasts.news(ev.text, st.cls || 'event', st.ic || 'sparkle', { mine: ev.mine }));
      // camera director: glide toward a notable unless the player touched the screen in the last 2 s. Toward, not
      // onto: most of the way, so an event out on the water or at the tile's edge comes into view with the farm
      if (ev.cls === 'notable' && ev.x != null && ev.z != null && performance.now() - lastTouch() > T.ui.glide.touchedWithin * 1000) {
        const t = R.cam?.target, k = T.ui.glide.toward;
        const back = t ? { x: t.x, z: t.z, zoom: R.cam?.zoom } : null;
        api.glide(t ? t.x + (ev.x - t.x) * k : ev.x, t ? t.z + (ev.z - t.z) * k : ev.z);
        if (back && !settings.reduceMotion) app.director = { back, t: performance.now(), glides: app.glides };
      }
    },
    cash: (ev: UiEventOf<'cash'>) => hud.onCash(ev.delta),
    goal: (ev: UiEventOf<'goal'>) => { if (ev.id && !ev.quiet) api.sound('goal'); },
    goalDone: () => { hud.goalDone(); api.sound('done'); audio.haptic(15); },
    goalLapse: () => hud.goalLapse(),
    beat: (ev: UiEventOf<'beat'>) => app.debug?.beat(ev.id),
    phase(ev: UiEventOf<'phase'>) {
      save();
      if (ev.to === 'grow' && ev.from === 'winter') { toasts.notable(`Year ${app.game?.s.clock.year}. Spring on the farm.`, { urgent: true, ic: 'patch' }); api.home(); }
      sheets.close();
    },
    dayEnd() { if (performance.now() - (app.savedAt || 0) > 5000) save(); },
  };
  function handle(ev: UiEvent) {
    if (ev.type !== 'ui/idle') guard('R.fx', () => R.fx?.(ev));
    const run = <K extends UiEvent['type']>(e: UiEventOf<K>, fn: (e: UiEventOf<K>) => void) => {
      guard(`event ${e.type}`, () => fn(e));
      for (const f of REG.events.get(e.type) || []) guard(`event ${e.type}`, () => f(e, api));
    };
    if (isUiEvent(ev, 'toast')) run(ev, ON.toast);
    else if (isUiEvent(ev, 'sound')) run(ev, ON.sound);
    else if (isUiEvent(ev, 'alert')) run(ev, ON.alert);
    else if (isUiEvent(ev, 'event')) run(ev, ON.event);
    else if (isUiEvent(ev, 'cash')) run(ev, ON.cash);
    else if (isUiEvent(ev, 'goal')) run(ev, ON.goal);
    else if (isUiEvent(ev, 'goalDone')) run(ev, ON.goalDone);
    else if (isUiEvent(ev, 'goalLapse')) run(ev, ON.goalLapse);
    else if (isUiEvent(ev, 'beat')) run(ev, ON.beat);
    else if (isUiEvent(ev, 'phase')) run(ev, ON.phase);
    else if (isUiEvent(ev, 'dayEnd')) run(ev, ON.dayEnd);
    else for (const fn of REG.events.get(ev.type) || []) guard(`event ${ev.type}`, () => fn(ev, api));
  }

  // ---------------------------------------------------------- saves (one slot; every write is best effort)
  // A save that can't be written (private mode, storage full or blocked) never loses the farm in this tab, but the
  // player must know before they close it: one warning, again only after a save has worked in between.
  function save() {
    if (!app.game || app.game.s.clock.phase === 'newgame') return false;
    app.savedAt = performance.now();
    const ok = setOrMakeRoom(SAVE_KEY, serialize(app.game.s));
    if (!ok && !app.saveWarned) { app.saveWarned = true; toasts.toast("Can't save on this device right now (storage is full or blocked). Keep this tab open.", 'bad', 'alert'); }
    if (ok) app.saveWarned = false;
    return ok;
  }
  function saveAndQuit() {
    save();
    sheets.close();
    detach();
    showTitleScreen();
  }
  addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !app.game || app.mode !== 'play') return;
    save();
    // (only where the dock has a play button: the weigh-off, Halloween and winter wait for taps anyway)
    if (app.game.s.clock.speed > 0 && speedRules(app.game.s).speeds.length) { api.dispatch({ type: 'clock/pause', on: true }); app.pausedByHide = true; }
  });
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && app.pausedByHide) { app.pausedByHide = false; toasts.toast('Paused while you were away. Tap play when ready.', '', 'pause'); }
  });
  addEventListener('pagehide', () => save());

  // ---------------------------------------------------------- attaching a game
  function attach(game: Game) {
    app.game = game;
    app.preview = null;
    app.mode = 'play';
    app.lastInput = performance.now();
    hideTitle();
    need('#game-ui').hidden = false;
    hud.reset(); dock.reset();
    for (const k of SIM_PREFS) if (game.s.prefs[k] !== settings[k]) game.dispatch({ type: 'prefs/set', key: k, value: settings[k] });
    game.drain();
    R.cam?.title?.(false);
    // frame the whole farm for the game's HUD and tray (the new-farm flow left the camera on the stand); an intro's
    // glide, shown by the dialog in the next frame, takes over from here
    sheets.inset(); api.home();
    requestAnimationFrame(() => sheets.inset());
    warmPortraitsIdle(['gran', 'hal', 'moss'], game.s.meta.species);   // year 1's first speakers
  }
  function detach() {
    app.game = null; app.mode = 'title';
    need('#game-ui').hidden = true;
    cards.hide(); pins.clear(); toasts.clear(); banner.clear(); caption.hide(); closeScreen();
  }
  function showTitleScreen() {
    const s = readSave();
    app.mode = 'title';
    app.preview = s || createGame({ seed: params.seed ?? 1 });
    showTitle({ ...app, game: null, preview: null }, { save: s ? summary(s) : null });   // frames the camera between the title and the buttons
    R.cam?.title?.(true);
    warmPortraitsIdle(['mayor', ...T.species.list]);        // the new-farm flow's Mayor and species picker
  }
  // Each portrait is drawn on a little offscreen renderer (tens of ms on a phone; then cached). Draw the ones the next
  // minutes need one at a time while nothing else is happening, so a dialogue card or the species picker never stalls.
  function warmPortraitsIdle(keys: string[], species?: string) {
    const idle = globalThis.requestIdleCallback || ((fn) => setTimeout(fn, 250));
    const next = () => { const k = keys.shift(); if (!k) return; guard('portrait', () => R.portrait?.(k, species ? { species } : {})); idle(next, { timeout: 3000 }); };
    idle(next, { timeout: 3000 });
  }
  addEventListener('resize', () => { if (app.mode === 'title') frameTitle(api); });
  app.continueGame = () => { const s = readSave(); if (s) { warmPortraits(api, s); curtain(() => attach(new Game(s))); } };
  app.newFarm = async () => {
    // (any save at all, even one this version can't read, is somebody's farm: ask before replacing it)
    if (store.get(SAVE_KEY) && !(await api.confirm('Your current farm will be replaced. Start a new one?', { yes: 'New farm', no: 'Keep my farm', title: 'Start over?' }))) return;
    const s = createGame({ seed: params.seed ?? (Math.floor(Math.random() * 1e9) + 1) });
    app.game = new Game(s); app.preview = null; app.mode = 'newfarm';
    newFarmFlow({ ...app, game: null, preview: null }, s, () => {
      app.game?.dispatch({ type: 'newgame/start' });
      warmPortraits(api, s);                       // while Marlene's curtain is down (Gran speaks the moment it lifts)
      const g0 = app.game;
      if (g0) curtain(() => attach(g0), 900);
    });
  };
  app.startNow = (opts: NewGameOpts = {}) => {
    const s = createGame({ seed: params.seed ?? 1, ...opts });
    const g = new Game(s);
    g.dispatch({ type: 'newgame/start' });
    if (params.jump) jumpTo(s, params.jump);
    attach(g);
    if (params.speed != null) api.dispatch({ type: 'clock/speed', speed: +params.speed, quiet: true });
    return g;
  };
  // the fog curtain: Marlene rolls in over the change of scene, then lifts. The 3D fog thickens with the CSS veil
  // and eases back to the day's own fog as it lifts, so the farm comes out of real fog.
  function curtain(mid: () => void, hold = 450) {
    const c = need('#curtain');
    if (settings.reduceMotion) { mid(); return; }
    c.classList.add('on');
    R.setFogOverride?.(0.75);
    setTimeout(() => { mid(); setTimeout(() => { c.classList.remove('on'); R.setFogOverride?.(0); }, hold); }, 500);
  }

  // ---------------------------------------------------------- the frame loop
  let last = performance.now(), nudged = false, quietAt = -1e9, quietNow = false, mulShown = 1;
  // The clock's multiplier (clock.js): 0 while a planning sheet is open (the Table), 0.5 on an October weekend with a sheet
  // open, 2 on a quiet growing day when "Hurry quiet days" is on (quiet() is checked a few times a second, not every frame).
  function uiMul(s: State, now: number) {
    if (settings.hurryQuiet && now - quietAt > 250) { quietAt = now; quietNow = s.clock.phase === 'grow' && quiet(s, makeCtx(s)); }
    const mulArgs = { sheetId: sheets.id, sheetArg: sheets.arg, settings, livePins: pins.count, quietNow };
    const mul = clockMul(s, mulArgs);
    if (mul !== mulShown) {
      mulShown = mul;
      document.body.classList.toggle('clock-stopped', mul === 0);
      document.body.classList.toggle('hurrying', mul > 1);
    }
    return mul;
  }
  function frame(now: number) {
    const rdt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const g = app.game, s = g?.s;
    if (g && app.mode === 'play' && s) {
      const mul = guard('clockMul', () => uiMul(s, now)) ?? 1;
      if (!screen?.def.pauses) guard('tickReal', () => g.tickReal(rdt * mul));
      for (const ev of g.drain()) handle(ev);
      idleNudge(s, now);
      directorReturn(now);
    } else if (g) for (const ev of g.drain()) guard('R.fx', () => R.fx?.(ev));
    const view = g?.s || app.preview;
    if (view) guard('R.sync', () => R.sync(view, rdt));
    if (g && app.mode === 'play' && s) {
      guard('hud', () => hud.sync(s, rdt));
      guard('dock', () => dock.sync(s));
      guard('sheet', () => sheets.sync(s));
      guard('cards', () => cards.sync(s));
      guard('dialog', () => dialog.sync(s, rdt));
      guard('pins', () => pins.sync(s));
      guard('toasts', () => toasts.sync());
      guard('screens', () => autoScreens(s));
      const upd = screen?.def.update, sc = screen;
      if (upd && sc) guard('screen', () => upd(sc.node, s, api));
      const dbg = app.debug;
      if (dbg) guard('debug', () => dbg.sync(s));
      if (s.clock.sub === 'weekend' && now - (app.savedAt || 0) > T.ui.autosaveWeekend * 1000) save();
    }
    requestAnimationFrame(frame);
  }
  // The director's glide was a look, not a move: after a beat the camera goes back to where the player had it, unless they
  // touched the screen, opened a sheet, or something else (an intro) took the camera meanwhile.
  const lastTouch = () => Math.max(app.touchedAt, R.cam?.touchedAt ?? -1e9);
  function directorReturn(now: number) {
    const d = app.director;
    if (!d || now - d.t < T.ui.glide.back * 1000) return;
    app.director = null;
    if (lastTouch() > d.t || app.glides !== d.glides || sheets.id || screen || R.cam?.view !== 'overhead') return;
    api.glide(d.back.x, d.back.z, d.back.zoom, 900);
  }
  // Sitting idle at 1x with nothing urgent and no input: the first time (after T.pokes.idleSparkle.afterS) the world gets a
  // turn (an out-event { type: 'ui/idle', n } for registerEvent: track D sparkles a poke target); from the second idle
  // (after T.clock.idleNudge) the 4x button pulses.
  let idleN = 0, idleSince: number|null = null, calmSince = 0;     // idleSince: the last input before the current idle stretch
  function idleNudge(s: State, now: number) {
    // (not while a Next-up goal waits: "Nothing urgent" next to "Squish the bugs" reads as a contradiction)
    const calm = s.clock.phase === 'grow' && s.clock.speed === 1 && !s.story.dialog.length && !s.story.goal && !isBlocked(s) && !sheets.id;
    if (!calm) calmSince = now;
    if (idleSince != null && (!calm || app.lastInput !== idleSince)) idleSince = null;   // a tap or a lesson ends it
    const need = (idleN === 0 ? T.pokes.idleSparkle.afterS : T.clock.idleNudge) * 1000;
    if (idleSince == null && calm && now - Math.max(app.lastInput, app.lastAlert, calmSince) > need) {
      idleSince = app.lastInput; idleN++;
      handle({ type: 'ui/idle', n: idleN });
    }
    const nudge = idleSince != null && idleN >= 2;
    dock.setNudge(nudge);
    if (nudge && !nudged) { nudged = true; toasts.toast('Nothing urgent. Fast-forward?', '', 'ff'); }
  }
  addEventListener('pointerdown', (e) => {
    app.lastInput = performance.now();
    const b = e.target instanceof Element ? e.target.closest('button') : null;
    if (b instanceof HTMLButtonElement && !b.disabled) { audio.play('tick'); audio.haptic(8); }
  }, { capture: true, passive: true });
  addEventListener('keydown', () => { app.lastInput = performance.now(); }, { capture: true });

  app.start = () => { document.body.classList.remove('booting'); requestAnimationFrame((t) => { last = t; frame(t); }); };
  Object.assign(app, { attach, detach, showTitleScreen, save, hud, dock, sheets, cards, dialog, toasts, pins });
  return app;
}
