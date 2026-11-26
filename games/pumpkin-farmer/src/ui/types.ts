// The UI's contracts: the api object app.ts hands to every slice UI, the settings, and the shapes the registries hold
// (registry.ts). A slice UI is written against these, never against app.ts's internals.
import type { Action, ActionResult, Card, OutEvent, State } from '../sim/types.js';
import type { StoryGoal } from '../sim/state.js';
import type { Game } from '../sim/game.js';
import type { Renderer, Hit } from '../render/types.js';
import type { DEFAULT_SETTINGS } from './app.js';

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

/** A world point the UI anchors to or glides toward. */
export interface At { x: number; y?: number; z: number }

export interface NotableOpts { urgent?: boolean; ic?: string; cls?: string; mine?: boolean }
export interface PayoffOpts {
  title: string; sub?: string; stamp?: string; big?: boolean; speaker?: string; line?: string;
  glide?: { x: number; z: number; zoom?: number }; ms?: number;
}
export interface CaptionOpts { onTap?: (() => void) | null; cls?: string | null; ms?: number }
export interface ConfirmOpts { yes?: string; no?: string; title?: string }
export interface BubbleChoice { id: string; label: string; [k: string]: unknown }
export interface BubbleSpec {
  text?: string; title?: string; speaker?: string; choices?: BubbleChoice[]; defaultChoice?: string;
  at?: At | null; lift?: number;
}

export interface Api {
  R: Renderer;
  settings: Settings;
  readonly game: Game | null;
  s(): State | null;
  dispatch(a: Action): ActionResult & { events: OutEvent[] };
  openSheet(id: string, arg?: unknown): void;
  closeSheet(): void;
  currentSheet(): string | null;
  openScreen(id: string): boolean;
  closeScreen(): void;
  toast(text: string, cls?: string, ic?: string): void;
  notable(text: string, opts?: NotableOpts): void;
  caption(text: string): void;
  sound(name: string, opts?: Record<string, unknown>): void;
  haptic(ms?: number): void;
  glide(x: number, z: number, zoom?: number, ms?: number): void;
  home(): void;
  confirm(text: string, opts?: ConfirmOpts): Promise<boolean>;
  markTouched(): void;
  followGoal(g: StoryGoal | null): void;
  setSetting<K extends SettingKey>(key: K, value: Settings[K]): void;
  saveAndQuit(): void;
  save(): boolean;
  photo: { save(year: number, url: string): boolean; load(year: number): string | null };
  closeTop(): boolean;
  blockedByUi(): boolean;
  dialogJustTapped(): boolean;
  payoff(o: PayoffOpts): void;
  bubble(d: BubbleSpec): Promise<string>;
  captionAt(at: At, text: string, opts?: CaptionOpts): HTMLElement | null;
  /** Re-measure the open sheet's inset (after its content changes height). Set once the sheets exist. */
  reinset(): void;
}

// ------------------------------------------------------------ registry entries (registry.ts)
// Method syntax keeps parameters bivariant, so a sheet whose arg is a row number still registers as SheetDef.
export interface SheetDef<A = unknown> {
  title(s: State, arg: A): string;
  eyebrow?(s: State, arg: A): string | null | undefined;
  build(el: HTMLElement, s: State, arg: A, api: Api): void;
  /** Runs every frame while open: diff against what you drew. */
  update?(el: HTMLElement, s: State, arg?: A, api?: Api): void;
  onClose?(api: Api): void;
  wide?: boolean;
}
export interface CardDef { build(el: HTMLElement, s: State, card: Card, api: Api): void }
export interface StationDef {
  id: string; label: string; icon: string; order?: number; key?: string; sheet?: string;
  visible(s: State): boolean;
  onTap(api: Api): void;
  badge?(s: State): string | number | boolean | null | undefined;
  active?(s: State): boolean;
}
export interface FabDef {
  id: string; priority?: number;
  when(s: State): boolean;
  label(s: State): string;
  icon?(s: State): string;
  ring?(s: State): number | null | undefined;
  badge?(s: State): string | number | boolean | null | undefined;
  cls?(s: State): string | null | undefined;
  onTap(api: Api): void;
}
export type TapHandler = (hit: Hit, api: Api, e: PointerEvent) => void;
export interface PinDef {
  id: string; icon: string; label?: string; cls?: string;
  when(s: State): boolean;
  pos(s: State): At | null;
  onTap(api: Api): void;
  urgent?(s: State): boolean;
}
/** What registered UI handlers hear: the sim's out-events and the UI's own. */
export type UiEvent = OutEvent | { type: 'ui/idle'; n: number };
export type UiEventType = UiEvent['type'];
export type UiEventOf<K extends UiEventType> = Extract<UiEvent, { type: K }>;
export type EventHandler<K extends UiEventType = UiEventType> = (ev: UiEventOf<K>, api: Api) => void;
export const isUiEvent = <K extends UiEventType>(ev: UiEvent, type: K): ev is UiEventOf<K> => ev.type === type;
export interface ScreenDef {
  build(el: HTMLElement, s: State | undefined, api: Api): void;
  update?(el: HTMLElement, s: State, api: Api): void;
  onClose?(api: Api): void;
  /** Holds the sim clock while open. */
  pauses?: boolean;
  /** Opens itself while true, closes when false. */
  auto?(s: State): boolean;
}
export type KeyHandler = (api: Api, e: KeyboardEvent) => void;
export type PlanningWhen = (s: State, arg: unknown) => boolean;
export interface EventStyle { cls?: string; ic?: string }
export interface HandsDef {
  id: string;
  frame(s: State): unknown;
  hint(s: State): string;
  timer?: number;
  start(api: Api, arg: unknown): void;
  down(e: PointerEvent): void;
  move(e: PointerEvent): void;
  up(e: PointerEvent): void;
  update(dt: number): void;
  finish(): Action | null;
}
