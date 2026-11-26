// The contracts between game.ts and the sim modules: the context every hook receives, the module shape, actions and
// out-events. State itself is in state.ts.
import type { T } from './tuning.js';
import type cal from './calendar.js';
import type * as layout from './layout.js';
import type { NS } from './modules.js';
import type { EventsActive, FeedId, Glide, ItemId, MischiefPin, Rng, SlotKey, State, StoryGoal } from './state.js';
import type { ShopPlan } from './economy.js';
import type { Card, CardIn, CardKind, CardOf } from './cards.js';
import type { RoadMeta } from './road-lines.js';

export type { Card, CardData, CardIn, CardKind, CardOf } from './cards.js';

export type { State } from './state.js';
export type { Action, ActionOf, ActionType, Actions } from './action.js';
export type { OutEvent, OutEventOf, OutEventType, AlertOpts, Shot, Pace } from './out-event.js';
import type { Action, ActionOf, ActionType } from './action.js';
import type { OutEvent, AlertOpts } from './out-event.js';

export type Tuning = typeof T;
export type Vars = Record<string, string | number | boolean | null | undefined>;
/** A line said by one speaker, or a toast line. */
export type Lapse = string | [speaker: string, text: string] | false | null;

/** What a goal points at: a HUD chip, a station control, a pin, a row. */
export interface Target {
  kind: string;
  id?: number | string;
  control?: string;
  x?: number;
  y?: number;
  z?: number;
  zoom?: number;
}

export interface SayOpts {
  vars?: Vars;
  pause?: boolean;
  glide?: Glide;
  goal?: GoalOpts & { id: string; text?: string; target?: Target | null };
}

export interface GoalOpts {
  until?: number | null;
  lapse?: Lapse;
  quiet?: boolean;
}

/** One entry for ctx.fresh: plain text, or text gated on state and weighted. */
export type FreshEntry = string | { t: string; when?: (s: State) => boolean; w?: number };

/** A speaker and a line or lines. */
export type Said = [speaker: string, lines: string | string[]];
export type MomentToast = string | { text: string; cls?: string; icon?: string };

/** Why the Giant's receipt is said: how the dawn went, how a heat wave went, how the cull held up. */
export type GiantReceipt =
  | { which: 'dawn'; how: 'bees' | 'paws'; fog: boolean; late: boolean }
  | { which: 'heat'; scalds: number }
  | { which: 'cull'; creaked: boolean };

/** What a moment carries to its registered handler, by handler name. null: the handler needs nothing. */
export interface MomentData {
  mossTip: null;
  mossDoze: null;
  otterKelp: null;
  honeyLesson: null;
  sowing: { row: number; v: string; ts: number[]; seed: number };
  first: { first: string; mine: boolean; vars: Vars };
  delight: { id: string; slot: SlotKey | null; fallback: boolean; cause: string | null };
  note: { n: number; via: string; mine: boolean };
  giantReceipt: GiantReceipt & { receipt?: string };
}
export type MomentHandlerId = keyof MomentData;
type DataFor<H extends MomentHandlerId> = MomentData[H] extends null ? { data?: null } : { data: MomentData[H] };
/** The handler a moment runs and its data; a moment with no handler only says its say and toasts its toast. */
export type MomentCall =
  | { [H in MomentHandlerId]: { handler: H } & DataFor<H> }[MomentHandlerId]
  | { handler?: undefined; data?: undefined };

interface MomentInBase {
  id: string;
  /** salience and prio; 'toast' never takes a quiet window */
  kind: string;
  prio?: number;
  maxWaitDays?: number;
  merge?: string | null;
  say?: Said | null;
  toast?: MomentToast | null;
  stop?: boolean;
  mine?: boolean;
  threat?: boolean;
}
export type MomentIn = MomentInBase & MomentCall;

interface MomentBase {
  id: string;
  kind: string;
  prio: number;
  day: number;
  wait: number;
  merge: string | null;
  say: Said | null;
  toast: MomentToast | null;
  stop: boolean;
  seq: number;
  with: MomentItem[];
}
export type MomentOf<H extends MomentHandlerId> = MomentBase & { handler: H } & DataFor<H>;
export type MomentItem = MomentBase & MomentCall;
/** A queued moment that names a handler; H stays correlated with its data. */
export type MomentRun<H extends MomentHandlerId = MomentHandlerId> = { [P in H]: MomentOf<P> }[H];

export type ReceiptKind = { [H in MomentHandlerId]: 'receipt' extends keyof MomentData[H] ? H : never }[MomentHandlerId];
type OmitEach<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type ReceiptIn = { [K in ReceiptKind]: { id: string; kind: K; due?: number; data: OmitEach<MomentData[K], 'receipt'>; say?: Said | null } }[ReceiptKind];
export type Receipt = ReceiptIn & { due: number; say: Said | null };

export interface Ctx {
  T: Tuning;
  cal: typeof cal;
  layout: typeof layout;
  modules: readonly SimModule[];
  out: OutEvent[];
  rng(name: string): Rng;
  emit(ev: OutEvent): void;
  say(speaker: string, lines: string | string[], opts?: SayOpts): string;
  card(c: CardIn): string;
  goal(id: string | null, text?: string | null, target?: Target | null, opts?: GoalOpts): void;
  goalDone(id: string): boolean;
  goalLapse(id: string, line?: Lapse): boolean;
  story(id: string, score?: number, vars?: Vars): void;
  money(delta: number, cat: string): void;
  unlock(flag: string): void;
  mod<K extends keyof typeof NS>(id: K): (typeof NS)[K];
  line(str: string, vars?: Vars): string;
  alert(id: string, opts?: AlertOpts): void;
  setPhase(to: string): void;
  markIntro(): void;
  moment(m: MomentIn): MomentItem | null;
  receipt(r: ReceiptIn): boolean;
  stamp(id: string): boolean;
  fresh(key: string, list: readonly FreshEntry[], rng?: string | Rng): string | null;
}

export interface ActionResult {
  ok: boolean;
  reason?: string;
  [k: string]: unknown;
}
// A handler that returns nothing succeeded.
export type ActionHandler<K extends ActionType = ActionType> = (s: State, a: ActionOf<K>, ctx: Ctx) => ActionResult | undefined;
export type ActionHandlers = { [K in ActionType]?: ActionHandler<K> };
/** Runs after an action of its type succeeded, in module order. */
export type AfterHook<K extends ActionType> = (s: State, a: ActionOf<K>, r: ActionResult, ctx: Ctx) => void;
export type AfterHooks = { [K in ActionType]?: AfterHook<K> };
export type Hook = (s: State, ctx: Ctx) => void;

/** An onboarding beat; the contract is at story.ts runBeats. */
export interface Beat {
  id: string;
  year?: number;
  years?: [from: number, to: number];
  order?: number;
  /** the trigger date ('Sep 1'), or the sim day the state gives, null while not known */
  at?: string | ((s: State) => number | null | undefined);
  when: (s: State, ctx: Ctx) => boolean;
  run: (s: State, ctx: Ctx) => void;
  /** the date can't move: it goes first when due */
  pin?: boolean;
  soon?: (s: State, ctx: Ctx) => boolean;
  /** false: a toast-only lesson that neither waits for nor resets the intro gap */
  gap?: false;
  urgent?: (s: State) => boolean;
  road?: RoadMeta;
  /** the Road's estimate of the day when at gives none */
  est?: (s: State) => number | null | undefined;
}

export interface MomentHandler<H extends MomentHandlerId> {
  run(s: State, ctx: Ctx, m: MomentOf<H>, group: MomentItem[]): void;
  drop?(s: State, ctx: Ctx, m: MomentOf<H>): void;
}
export type MomentHandlers = { [H in MomentHandlerId]?: MomentHandler<H> };
export type CardHandler<K extends CardKind> = (s: State, card: CardOf<K>, choice: string, ctx: Ctx, a: ActionOf<'card/answer'>) => ActionResult | undefined;
export type CardHandlers = { [K in CardKind]?: CardHandler<K> };

export interface SimModule {
  id: string;
  init?: Hook;
  newYear?: Hook;
  dayStart?: Hook;
  dayEnd?: Hook;
  tick?: Hook;
  phase?: (s: State, ctx: Ctx, from: string, to: string) => void;
  actions?: ActionHandlers;
  after?: AfterHooks;
  bot?: (s: State, ctx: Ctx, policy: Policy) => Action | Action[] | null | undefined | false;
  beats?: Beat[];
  moments?: MomentHandlers;
  cards?: CardHandlers;
  events?: DirectorEvent[];
  goals?: Record<string, (s: State, g: StoryGoal) => boolean>;
  summary?: (s: State, ...rest: never[]) => unknown;
}

/** How a bot grows the giant; see giant.ts bot. */
export interface GiantPolicy {
  regime: 'light' | 'normal' | 'heavy';
  feed: FeedId;
  shade: boolean | 'forecast' | 'always' | 'never';
  stepUp?: boolean;
  ease?: boolean;
  treat?: boolean;
  respond: boolean;
  rotate?: boolean;
  talk?: boolean;
  /** days between the bot's own tape measurements */
  measure?: number;
}

/** A bot policy's knobs; see bots.ts. */
/** A bot's breeding preferences: which seed to plant, what to buy at the Grange, how many seeds to sell. */
export interface Breed {
  pick: 'plump' | 'first';
  buy?: 'seed' | 'pollen' | null;
  prefer?: 'pretty';
  /** sell up to this many of your own weighed seeds a winter */
  sell?: number;
  /** own seeds kept back from the sale */
  keep?: number;
  /** cash kept back after the Grange */
  reserve?: number;
}

export interface Policy {
  name: string;
  id?: string;
  /** weekend minutes between a bot's looks */
  tickStep: number;
  shop: ShopPlan | null;
  shopList?: ItemId[];
  /** cash kept back after shopping, on top of springCosts */
  reserve?: number;
  reliability?: number;
  waterBelow?: number;
  squish?: number;
  /** 'spray' sprays every bug cluster instead of squishing */
  bugs?: 'spray';
  serve?: number;
  bubbles?: number;
  /** false: never touch the traffic levers */
  levers?: boolean;
  lift?: number;
  giant?: GiantPolicy;
  pollinate?: 'open';
  plan?: 'gran' | 'gransUsual' | [number, string, string][];
  /** a fixed `plan` repeats every year, not only in year 1 */
  everyYear?: boolean;
  /** the variety for each row from year 2 (default: botMix) */
  mix?: string[];
  /** each row's target weekend day, as 'Mon D' */
  targets?: string[];
  /** ignore the watering ring until the crates first slip */
  waterAfterSlip?: boolean;
  hands?: { skill: number; diligence: number };
  season?: 'attentive' | 'realistic' | 'lazy';
  watch?: number;
  table?: 'random' | 'chips' | 'careless';
  delegate?: boolean;
  marketing?: boolean;
  breed?: Breed;
  /** a card answer; undefined falls through to the next answerer */
  answer?: (this: Policy, c: Card, s: State) => string | undefined;
  mischief?: { taps: number };
  pamela?: 'smart' | 'whistle' | 'graze';
  possum?: 'smart' | 'rest' | 'ask';
  moving?: 'now' | 'best' | 'worst';
  dawn?: 'bees' | 'read' | 'paws' | 'clear';
  crawlGuess?: 'mid' | 'knock' | 'blind';
}

/** What a caller hands a director event's fire(): the fields its entry reads. */
export interface FireData {
  row?: number;
  v?: string;
  life?: number;
  state?: string;
  id?: number;
  x?: number;
  z?: number;
  fam?: number;
  spot?: string;
  ticks?: number;
  slot?: SlotKey | null;
  fallback?: boolean;
  cause?: string | null;
}
/** Where a delight put itself, for its ✦ pin. pin: false puts up none; taskPin: it has its own task pin instead. */
export interface DelightShown { at?: { x: number; y?: number; z: number } | null; label?: string; pin?: boolean; taskPin?: boolean }
/** What a ✦ tap shows: a caption, or a dialog id to open. */
export interface DelightLook { caption?: string; dialog?: string }
type When = (s: State, ctx: Ctx) => boolean;

/** A director catalogue entry; the contract is at the top of events.ts. */
export interface DirectorEvent {
  id: string;
  cls: 'notable' | 'minor' | 'story' | 'chain' | 'delight';
  per?: 'day' | 'tick';
  when?: When;
  /** a delight slot's fallback: what it still needs without its weather */
  base?: When;
  rate?: (s: State, ctx: Ctx) => number;
  cause?: (s: State) => string | null;
  cooldownDays?: number;
  cooldownTicks?: number;
  capYear?: number;
  capSeason?: number;
  /** a cap that grows with the farm: [year 1, year 2, ...] */
  capByYear?: readonly number[];
  urgent?: boolean;
  quiet?: boolean;
  needs?: readonly string[];
  visit?: boolean;
  chain?: string;
  own?: boolean;
  text?: (s: State) => string | null;
  fire?: (s: State, ctx: Ctx, data: FireData) => DelightShown | void;
  tap?: (s: State, ctx: Ctx, active: EventsActive, a: ActionOf<'events/tap'>) => void;
  look?: (s: State, ctx: Ctx, pin: MischiefPin) => DelightLook;
  leftAlone?: (s: State, ctx: Ctx, pin: MischiefPin) => void;
}
