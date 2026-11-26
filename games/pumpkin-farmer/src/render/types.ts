// The renderer's contracts: R (what the app and the UI call, documented in index.ts) and K (the kit context every view
// module is built with). dev/stub-render.ts implements Renderer too, so members it lacks are optional.
import type * as THREE from 'three';
import type * as kit from './kit.js';
import type * as layout from '../sim/layout.js';
import type * as folk from './folk.js';
import type { OutEvent, State, Tuning } from '../sim/types.js';
import type { Settings } from '../ui/types.js';
import type { Hunt } from '../sim/hunt.js';
import type { createSky, PresetName } from './sky.js';
import type { createWorld } from './world.js';
import type { createCamera } from './camera.js';
import type { createHit } from './hit.js';
import type { createFx } from './fx.js';
import type createCast from './cast.js';

/** What a world tap landed on. A tap with no hitbox reports kind 'ground' and a null id. */
export interface Hit { kind: string; id: string | number | null; x: number; z: number; [k: string]: unknown }
export type HitHandler = (hit: Hit, e: PointerEvent) => void;
export interface Projected { x: number; y: number; visible: boolean }
export interface PhotoOpts { crisp?: boolean; focus?: { x: number; y?: number; z: number } | null; tight?: number }

export interface RendererCam {
  glide(x: number, z: number, zoom?: number, ms?: number, az?: number, polar?: number): void;
  frame(kind: string, ms?: number): unknown;
  home(ms?: number): void;
  setInset(px?: number, top?: number, right?: number): void;
  stroll(on?: boolean): void;
  title(on: boolean): void;
  readonly view: string;
  follow?(obj: THREE.Object3D | null): void;
  setJoy?(x?: number, y?: number): void;
  rotate?(a?: number, ms?: number): void;
  zoomFor?(fit: number): number;
  readonly zoom?: number;
  readonly target?: THREE.Vector3;
  readonly azimuth?: number;
}

export interface Renderer {
  /** Update from state and render one frame. */
  sync(s: State, rdt?: number): void;
  fx(ev: FxEvent): void;
  pick(x: number, y: number): Hit | null;
  /** Container-relative CSS px of a world point. */
  project(x: number, y: number, z: number): Projected;
  /** A data URL of the current view (the scrapbook photo). */
  photo(w?: number, h?: number, type?: string, quality?: number, opts?: PhotoOpts): string;
  portrait(key: string, opts?: folk.PortraitOpts): string;
  cam: RendererCam;
  setFogOverride(d: number): void;
  on(type: string, fn: HitHandler): (() => void) | void;
  /** Calls fn with the camera view's name each time it changes. */
  onView?(fn: (view: string) => void): () => void;
  info(): Record<string, number | undefined>;
  dispose(): void;
  sky?: { override(x: number | PresetName | null): void; readonly hour: number; readonly fog: number };
  readonly bg?: string;
  K?: Kit;
}

/** Effects the UI asks for directly. A type the sim also emits lists the sim's fields plus the UI's optional ones. */
export interface LocalFx {
  'tap': { x: number; z: number; kind: string; id: string | number | null };
  'ripple': { x: number; z: number; color?: number };
  'squash': { id: string; kind?: string; amount?: number };
  'pop': { x: number; y?: number; z: number; color?: number; n?: number; sparkles?: number };
  'sparkle': { x: number; y?: number; z: number; n?: number };
  'float': { text: string; x: number; y?: number; z: number; cls?: string };
  'dust': { x: number; z: number; color?: number; n?: number };
  'cast': { who: string; act: string; secs?: number };
  'hunt/start': { row: number; hunt: Hunt };
  'hunt/end': object;
}
type LocalFxType = keyof LocalFx;
/** What R.fx and every view hear: the sim's out-events and the UI's local effects. */
export type FxEvent = Exclude<OutEvent, { type: LocalFxType }> | { [P in LocalFxType]: { type: P } & LocalFx[P] }[LocalFxType];

/** A view module: built once with K, synced every frame, told every out-event. */
export interface View { sync(s: State | null, dt: number, t: number): void; fx?(ev: FxEvent): void; dispose?(): void }

/** The kit context. index.ts fills sky..fx in order after construction; cast and the slice views attach themselves. */
export interface Kit {
  THREE: typeof THREE;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  container: HTMLElement;
  kit: typeof kit;
  layout: typeof layout;
  folk: typeof folk;
  phone: boolean;
  settings: Partial<Settings>;
  T: Tuning | null;
  squashables: Record<string, THREE.Object3D>;
  t(): number;
  emit(type: 'view', view: string): void;
  sky: ReturnType<typeof createSky>;
  world: ReturnType<typeof createWorld>;
  cam: ReturnType<typeof createCamera>;
  hit: ReturnType<typeof createHit>;
  fx: ReturnType<typeof createFx>;
  cast: ReturnType<typeof createCast>;
  hunt?: { row: number; H: Hunt } | null;
  bloom?: THREE.Vector3[] | null;
  seasonView?: Record<string, unknown>;
  mischief?: Record<string, unknown>;
}
