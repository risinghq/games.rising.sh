// UI registries (architecture §5.1). Slice UI files call these at import time; app.js re-exports them, so
// `import { registerSheet } from './app.js'` works too. Kept in their own module so slice files can import them
// while app.js is still importing the slices.
// Fields marked ? are optional additions to the §5.1 contract.
export const REG = {
  sheets: new Map(),     // id -> { title(s, arg), eyebrow?(s, arg), build(el, s, arg, api), update?(el, s, arg, api), onClose?(api) }
                         //   update runs every frame while open: diff against what you drew (see almanac.js)
  cards: new Map(),      // kind -> { build(el, s, card, api) }; unregistered kinds use cards.js genericCard
  stations: [],          // { id, label, icon (dom.js icon name), order, visible(s), onTap(api), key?: 'g', sheet?: id it opens,
                         //   badge?(s), active?(s) }
  fabs: [],              // { id, priority, when(s), label(s) (<= 8 chars), icon?(s), ring?(s) -> 0..1, badge?(s), cls?(s), onTap(api) }
  taps: new Map(),       // hitbox kind -> (hit, api, event) => {}
  longpress: new Map(),  // hitbox kind -> (hit, api, event) => {} (falls back to the tap handler)
  pins: [],              // { id, when(s), pos(s) -> { x, y, z }, icon, onTap(api), urgent?(s), label? }
  events: new Map(),     // out-event type -> [(ev, api) => {}]
  screens: new Map(),    // id -> { build(el, s, api), update?(el, s, api), onClose?(api), pauses?: true (holds the sim clock),
                         //   auto?(s) (opens itself while true, closes when false: the weigh-off, Halloween, winter) }
  keys: new Map(),       // key -> (api, event) => {} (slices may add shortcuts)
  // [foundation] growing-year seams (plan §6.1; docs/architecture.md §5.1)
  planning: new Map(),   // sheet id -> when(s, arg) -> bool: while that sheet is open and when() holds, the clock stops (x0)
  eventStyles: new Map(),// catalogued event id -> { cls?, ic? }: the toast look of a director event (delights, visitors)
  hands: new Map(),      // id -> { frame(s), hint(s), timer?, start(api, arg), down, move, up, update(dt), finish() -> action }
                         //   track E's close-up layer reads this; the sim side is hands/open { verb } and hands/close
};

export function registerSheet(id, def) { REG.sheets.set(id, def); }
export function registerCard(kind, def) { REG.cards.set(kind, def); }
export function registerStation(def) {
  const i = REG.stations.findIndex((x) => x.id === def.id);
  if (i >= 0) REG.stations[i] = def; else REG.stations.push(def);
  REG.stations.sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
}
export function registerFab(def) {
  const i = REG.fabs.findIndex((x) => x.id === def.id);
  if (i >= 0) REG.fabs[i] = def; else REG.fabs.push(def);
  REG.fabs.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}
export function registerTap(kind, fn) { REG.taps.set(kind, fn); }
export function registerLongPress(kind, fn) { REG.longpress.set(kind, fn); }
export function registerPin(def) {
  const i = REG.pins.findIndex((x) => x.id === def.id);
  if (i >= 0) REG.pins[i] = def; else REG.pins.push(def);
}
export function registerEvent(type, fn) {
  if (!REG.events.has(type)) REG.events.set(type, []);
  REG.events.get(type).push(fn);
}
export function registerScreen(id, def) { REG.screens.set(id, def); }
export function registerKey(key, fn) { REG.keys.set(key, fn); }
// A planning sheet stops the clock while it is open (the Planting Table: rulings R3). when(s, arg) narrows it (the Row sheet
// stops the clock only while it is planning); the sheet shows clockStrip() (banner.js) so the player knows.
export function registerPlanning(sheetId, when = () => true) { REG.planning.set(sheetId, when); }
// A hands-on close-up (track E): registerHands({ id, frame, hint, timer?, start, down, move, up, update, finish }).
export function registerHands(def) { REG.hands.set(def.id, def); }
export function registerEventStyle(id, style) { REG.eventStyles.set(id, style); }
