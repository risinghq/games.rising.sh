// UI registries (architecture §5.1). Slice UI files call these at import time; app.ts re-exports them, so
// `import { registerSheet } from './app.js'` works too. Kept in their own module so slice files can import them
// while app.ts is still importing the slices. The entry shapes are in types.ts.
import type {
  SheetDef, CardDef, StationDef, FabDef, TapHandler, PinDef, EventHandler, ScreenDef, KeyHandler, PlanningWhen, EventStyle, HandsDef,
  UiEventType,
} from './types.js';
import { isUiEvent } from './types.js';

export const REG = {
  sheets: new Map<string, SheetDef>(),
  /** Unregistered kinds use cards.ts genericCard. */
  cards: new Map<string, CardDef>(),
  stations: [] as StationDef[],
  fabs: [] as FabDef[],
  /** Hitbox kind -> handler. */
  taps: new Map<string, TapHandler>(),
  /** Hitbox kind -> handler; falls back to the tap handler. */
  longpress: new Map<string, TapHandler>(),
  pins: [] as PinDef[],
  /** Out-event type -> handlers. */
  events: new Map<UiEventType, EventHandler[]>(),
  screens: new Map<string, ScreenDef>(),
  keys: new Map<string, KeyHandler>(),
  /** Sheet id -> when the clock stops while it is open (x0). */
  planning: new Map<string, PlanningWhen>(),
  /** Catalogued event id -> the toast look of a director event (delights, visitors). */
  eventStyles: new Map<string, EventStyle>(),
  /** Hands-on close-ups; the sim side is hands/open { verb } and hands/close. */
  hands: new Map<string, HandsDef>(),
};

export function registerSheet<A>(id: string, def: SheetDef<A>) { REG.sheets.set(id, def); }
export function registerCard(kind: string, def: CardDef) { REG.cards.set(kind, def); }
export function registerStation(def: StationDef) {
  const i = REG.stations.findIndex((x) => x.id === def.id);
  if (i >= 0) REG.stations[i] = def; else REG.stations.push(def);
  REG.stations.sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
}
export function registerFab(def: FabDef) {
  const i = REG.fabs.findIndex((x) => x.id === def.id);
  if (i >= 0) REG.fabs[i] = def; else REG.fabs.push(def);
  REG.fabs.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}
export function registerTap(kind: string, fn: TapHandler) { REG.taps.set(kind, fn); }
export function registerLongPress(kind: string, fn: TapHandler) { REG.longpress.set(kind, fn); }
export function registerPin(def: PinDef) {
  const i = REG.pins.findIndex((x) => x.id === def.id);
  if (i >= 0) REG.pins[i] = def; else REG.pins.push(def);
}
export function registerEvent<K extends UiEventType>(type: K, fn: EventHandler<K>) {
  const run: EventHandler = (ev, api) => { if (isUiEvent(ev, type)) fn(ev, api); };
  const list = REG.events.get(type);
  if (list) list.push(run); else REG.events.set(type, [run]);
}
export function registerScreen(id: string, def: ScreenDef) { REG.screens.set(id, def); }
export function registerKey(key: string, fn: KeyHandler) { REG.keys.set(key, fn); }
// A planning sheet stops the clock while it is open (the Planting Table: rulings R3). when(s, arg) narrows it (the Row sheet
// stops the clock only while it is planning); the sheet shows clockStrip() (banner.ts) so the player knows.
export function registerPlanning(sheetId: string, when: PlanningWhen = () => true) { REG.planning.set(sheetId, when); }
export function registerHands(def: HandsDef) { REG.hands.set(def.id, def); }
export function registerEventStyle(id: string, style: EventStyle) { REG.eventStyles.set(id, style); }
