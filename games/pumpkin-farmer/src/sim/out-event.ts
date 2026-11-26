// What the sim tells the renderer and the UI: the fields of each out-event type. A consumer narrows on `type`
// and reads that type's fields.
import type { MomentItem } from './types.js';
import type { CrawlGuesse, CrawlTapeGreen, Glide, SeasonReview } from './state.js';

/** A camera glide target with its zoom. */
export type Shot = Required<Glide>;

/** The pace line from a measurement: where the giant is headed and what Vance usually weighs. */
export interface Pace { lb: number; give: number; left: number; vance: number; kelp: number }

/** The options an alert carries; `threat` is decided from them and the alert's history. */
export interface AlertOpts {
  threat?: boolean;
  calm?: boolean;
  kind?: string;
  cls?: string;
  speaker?: string;
  text?: string;
  w?: number;
  cause?: string;
  row?: number;
}

/** A first's banner text. */
export interface FirstText { title: string; sub: string | null; speaker: string | null; line: string | null }

type Spot = { x: number; z: number };

export interface OutEvents {
  'alert': AlertOpts & { id: string; threat: boolean };
  'beat': { id: string };
  'bought': { item: string };
  'card': { id: string; kind: string };
  'cardDone': { id: string; kind: string; choice: string };
  'cash': { delta: number; cat: string };
  'cast': { who: string; act: string };
  'coins': Spot & { amount: number };
  'crawl/tape': {
    ott: number; est: number; right: boolean; closest: string; pick: string; range: [number, number];
    guesses: CrawlGuesse[]; green: CrawlTapeGreen; verdict: string; pace: Pace | null;
  };
  'day': { day: number };
  'dayEnd': { day: number };
  'dialog': { id?: string; speaker: string };
  'dialogDone': { id: string; beat?: string };
  'event': {
    id: string; cls: string; urgent?: boolean; text: string | null; x?: number | null; z?: number | null;
    pin?: boolean; cause?: string | null; slot?: string | null; fallback?: boolean;
  };
  'first': FirstText & {
    id: string; big: boolean; mine: boolean; stamp: string; glide: Shot | null; at: string; row: number | null;
  };
  'firstFiled': { id: string };
  'genetics/bought': { id: string; kind: string };
  'genetics/lot': { n: number; name?: string };
  'giant/creak': { plot: number; practice: boolean; soft: boolean };
  'giant/crier': { told: boolean };
  'giant/cull': { plot: number; choice: string };
  'giant/flower': { plot: number };
  'giant/germinated': { plot: number };
  'giant/grow': { plot: number; gain: number };
  'giant/heal': { plot: number };
  'giant/knock': { plot: number; pitch: number };
  'giant/measure': { plot: number; by: string };
  'giant/measured': {
    plot: number; ott: number; est: number; delta: number; days: number; perDay: number; record: boolean; by: string;
    pace: Pace | null;
  };
  'giant/moving': { day: number; pick: number; text: string };
  'giant/noset': { plot: number };
  'giant/rooted': { plot: number; leaf: boolean; sulked: boolean };
  'giant/rotate': { plot: number; crack: boolean };
  'giant/scald': { plot: number };
  'giant/set': { plot: number; father: string };
  'giant/setting': { key: string; value: string | boolean | null };
  'giant/soak': { swing: boolean };
  'giant/split': { plot: number; kind: string };
  'giant/start': object;
  'giant/sulk': { plot: number; left: number; text: string };
  'giant/swing': { plot: number };
  'giant/talk': { phrase: number; text: string };
  'giant/thanks': object;
  'giant/transplant': { plot: number; rootDays: number; rootedDay: number; sulk: boolean };
  'glide': Shot;
  'goal': { id: string | null; text?: string; quiet?: boolean };
  'goalDone': { id: string };
  'goalLapse': { id: string };
  'hired': { who: string; on: boolean };
  'lane/skip': { slot: string; day: number };
  'meta': object;
  'mischief/leave': Spot & { id: string; why: string };
  'mischief/look': Spot & { id: string };
  'mischief/startle': Spot;
  'mischief/whistle': Spot;
  'moment': {
    id: string; kind: string; group: string[]; kinds: string[]; waited: number; data: MomentItem['data'];
    stop: boolean; mine: boolean;
  };
  'momentDrop': { id: string; kind: string; group: string[]; waited: number };
  'note': { n: number; via: string; mine: boolean };
  'notePorch': { n: number };
  'patch/bugs': { row: number };
  'patch/bugsCleared': { row: number; by?: string };
  'patch/cleared': { row: number };
  'patch/crate': { i: number; stage: string; level: number; was: number };
  'patch/cut': { row: number; n: number; by?: string };
  'patch/focus': Shot;
  'patch/honey': { ready: number };
  'patch/honeyCollected': { jars: number };
  'patch/hunt': { row: number; n: number; hits: number; left: number };
  'patch/mildew': { row: number };
  'patch/planted': { row: number; variety: string; scheduled: boolean; day?: number };
  'patch/restock': { row: number; n: number; by?: string };
  'patch/ripe': { row: number; first: boolean; weekend: boolean; n: number };
  'patch/shiny': { id: string; row: number | null; kind: string; state: string };
  'patch/sowing': Shot & { rows: number[] };
  'patch/sprayed': { row: number; kind: string };
  'patch/squish': { row: number; left: number };
  'patch/swarm': { state: string; spot?: string };
  'patch/trucked': { n: number };
  'patch/volunteer': { state: string; spot: string };
  'patch/watered': { auto: boolean; M: number };
  'phase': { from: string; to: string };
  'pop': Spot & { color: number; n: number };
  'road': { id: string; day: number };
  'season/answer': { id: number; ok: boolean | null; how: string; v: string; x?: number; z?: number };
  'season/arrive': { id: number; species: string; park: string };
  'season/bubble': { id: number; v: string; kind: string };
  'season/car': { kind: string; lot: string };
  'season/goat': Spot & { state: string; row?: number };
  'season/howl': { level: number };
  'season/joey': Spot & { state: string; spot?: string; fam?: number };
  'season/lever': { id: string; on: boolean };
  'season/load': { n: number };
  'season/panic': { n: number; sold: number; amt: number };
  'season/puff': Spot;
  'season/raft': Spot & { a: number; b: number };
  'season/review': SeasonReview;
  'season/runaway': Spot & { state: string };
  'season/rush': { n: number };
  'season/served': Spot & { id: number; by: string; amount: number; rush: number; tips: number; n: number };
  'season/splash': Spot & { id: number };
  'season/task': { k: string; state: string };
  'season/walkoff': Spot & { id: number };
  'season/weekday': { n: number; amt: number };
  'sound': { name: string; pitch?: number };
  'stamp': { id: string };
  'toast': { text: string; cls: string; icon?: string; key?: string };
  'unlock': { flag: string };
  'weather': { f: number; heat: number; rain: number };
  'weighoff/arrive': object;
  'weighoff/giggle': { y1: boolean };
  'weighoff/heaved': { plot: number; grades: string[]; scuff: boolean; crack: boolean };
  'weighoff/inspected': { plot: number; pass: boolean; brow: string };
  'weighoff/results': { place: number | null; total: number };
  'weighoff/stage': { stage: string; step: string; i: number };
  'weighoff/watched': { misses: number; scratches: number; mustache: boolean };
  'weighoff/weighed': { id: string };
  'winter/carved': { plot: number; n: number; skipped: boolean };
  'winter/stage': { stage: string | null };
  'winter/treat': { group: number; candy: number };
}

export type OutEventType = keyof OutEvents;
/** mine: the UI sets it on the events that answer the player's own action, so their toasts show at once. */
export type OutEvent = { [P in OutEventType]: { type: P; mine?: boolean } & OutEvents[P] }[OutEventType];
export type OutEventOf<K extends OutEventType> = Extract<OutEvent, { type: K }>;

