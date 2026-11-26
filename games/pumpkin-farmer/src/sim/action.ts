// One player or bot action: the fields of each action type. A handler in game.ts or a sim module's actions[type]
// receives its own type's fields.
import type { Prefs, ShopId, HireId, Grade } from './state.js';
import type { T } from './tuning.js';


export interface Actions {
  'card/answer': { id: string; choice?: string; name?: string };
  'clock/pause': { on?: boolean };
  /** to: a day to stop at even if nothing else stops it first */
  'clock/skip': { to?: number };
  'clock/speed': { speed: number };
  'crawl/pull': { pick?: string | null };
  'economy/buy': { item: ShopId };
  'economy/hire': { who: HireId; on?: boolean };
  'events/tap': { id: string };
  'genetics/buy': { id: string; plant?: boolean };
  'genetics/choose': { id: string; plot: number };
  'genetics/sell': { id: string };
  'giant/feed': { feed: keyof typeof T.giant.feed };
  'giant/hat': { on?: boolean };
  'giant/knock': { plot: number };
  'giant/measure': { plot: number };
  'giant/motor': { on?: boolean };
  'giant/name': { plot: number; name: string };
  'giant/radio': { station: string | null };
  'giant/regime': { regime: 'light' | 'normal' | 'heavy' };
  'giant/rotate': { plot: number };
  'giant/shade': { on?: boolean };
  'giant/soak': object;
  /** file: which of Grandpa's seed files to start, else the first */
  'giant/start': { file?: number };
  'giant/talk': { phrase: number };
  'giant/treat': { plot: number };
  'hands/close': object;
  'hands/open': { verb: string };
  'mischief/tap': object;
  'newgame/set': { species?: string; surname?: string; farmName?: string };
  'newgame/start': object;
  'patch/clear': { row: number };
  'patch/cut': { row: number; n?: number };
  'patch/gran': object;
  'patch/honey': object;
  'patch/hunt': { row: number; hits: number };
  'patch/milk': { row: number };
  'patch/order': { lots: number };
  /** early: Gran's early-sowing question was answered yes. replant: pull it up and start again. gran: Gran plans it. */
  'patch/plant': { row: number; variety: string; day?: number | null; early?: boolean; replant?: boolean; gran?: boolean };
  'patch/restock': { row?: number; n?: number; variety?: string };
  'patch/shinyTap': { id: string };
  'patch/spray': { row: number };
  'patch/squish': { row: number };
  'patch/unplan': { row: number };
  'patch/volunteer': object;
  'patch/water': object;
  'pokes/read': object;
  'prefs/set': { key: keyof Prefs; value: boolean };
  'season/answer': { id: number; choice: string };
  'season/chase': { id: string };
  'season/cut': { row: number };
  'season/foghorn': object;
  /** to: a farmer spot, or 'row' with row */
  'season/go': { to: string; row?: number };
  'season/lever': { id: string; on?: boolean };
  'season/panic': object;
  'season/plan': { tier?: string; shuttle?: boolean; radio?: boolean };
  'season/restock': { row?: number };
  'season/ringUp': object;
  /** id: the wagon, else the nearest one nobody is fetching */
  'season/stray': { id?: string };
  'season/treat': { plot?: number };
  /** id: the dialog seen, else the first */
  'story/dialogSeen': { id?: string };
  'story/goalDone': { id: string };
  'story/replay': { id: string };
  'weighoff/heave': { plot: number; beats: Grade[] };
  'weighoff/next': object;
  'weighoff/skipRivals': object;
  /** hits: the pair indexes the player caught */
  'weighoff/watch': { hits: number[] };
  'winter/beginYear': object;
  'winter/carve': { plot?: number; stencil: string | null; ink: number };
  'winter/next': { plot?: number };
  'winter/skipCarve': { plot?: number };
  'winter/treat': { group: number };
  /** id: the thing poked. row: the row under it. burst: taps in a quick run. */
  'world/poke': { id: string | number | null; row?: number | null; burst?: number };
}

export type ActionType = keyof Actions;
/** quiet: the UI shows no toast when the action fails. */
export type ActionOf<K extends ActionType> = { [P in K]: { type: P; quiet?: boolean } & Actions[P] }[K];
export type Action = ActionOf<ActionType>;
