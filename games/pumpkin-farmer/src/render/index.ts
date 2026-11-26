// createRenderer(): the Three.js view of the game (architecture §4). It reads sim state every frame and
// never mutates it. The app calls R.sync(s, rdt) once per frame (it updates every view module and renders),
// R.fx(ev) for each out-event, and listens for world taps with R.on('tap', fn).
//
//   const R = await createRenderer({ container, phone, settings, T })
//   R.sync(s, rdt)            update from state (s may be null: the title diorama) and render one frame
//   R.fx(ev)                  out-events: fx.js types (tap, ripple, squash, coins, pop, sparkle, float, dust),
//                             plus any slice type (patch/ripe, giant/measure, season/served, ...)
//   R.pick(clientX, clientY)  -> { kind, id, x, z } | null   (analytic hitboxes, nearest within 24 px)
//   R.project(x, y, z)        -> { x, y, visible }  container-relative CSS px (for DOM pins)
//   R.cam                     { glide(x, z, zoom, ms), frame(kind), home(), setInset(px, top?), view,
//                               stroll(on), title(on), follow(obj), setJoy(x, y), rotate(rad), zoomFor(fit) }
//                             frame kinds: patch giant stand barn lot scale hives maze beach (camera.FRAMES)
//   R.setFogOverride(delta)   e.g. +0.2 while the Weighmaster reads the card
//   R.sky.override(x)         an hour, a preset ('dawn' | 'day' | 'golden' | 'dusk' | 'night') or null
//   R.photo(w, h, type?, q?, { crisp }) -> JPEG data URL of the current view (scrapbook reveal photo, 240 x 180);
//                             crisp renders it in the day's own fog, without a beat's thickening
//   R.portrait(key, opts)     -> PNG data URL head-and-shoulders portrait (folk.portrait), cached
//   R.on(type, fn)            'tap' | 'longpress' | 'doubletap' fn(hit, event)
//   R.onView(fn)              fn(view) each time the camera view changes; returns its unsubscribe
//                             a tap with no hitbox reports { kind: 'ground', id: null, x, z }
//   R.info()                  { calls, triangles, ... } of the last frame (calls include the shadow pass)
//   R.dispose()
//
// View modules (cast, patch, giant, season, weighoff) are created with the kit context K:
//   K = { THREE, scene, renderer, container, kit, layout, folk, hit, cam, fx, sky, world, cast, phone,
//         settings, T, squashables, t() }
// and return { sync(s, dt, t), fx(ev), dispose() }. Slices fill in their own module; this list is fixed.
import * as THREE from 'three';
import * as kit from './kit.js';
import * as layout from '../sim/layout.js';
import * as folk from './folk.js';
import { fogU, applyFog } from './fog.js';
import { createSky } from './sky.js';
import { createWorld } from './world.js';
import { createCamera } from './camera.js';
import { createHit } from './hit.js';
import { createFx } from './fx.js';
import createCast from './cast.js';
import createPatchView from './patch.js';
import createGiantView from './giant.js';
import createSeasonView from './season.js';
import createWeighoffView from './weighoff.js';
// the growing-year tracks' views (plan §6.0; stubs from the foundation until each track lands)
import createMischiefView from './mischief.js';
import createCrawlView from './crawl.js';
import createHandsView from './hands.js';
import type { State, Tuning } from '../sim/types.js';
import type { Settings } from '../ui/types.js';
import type { FxEvent, HitHandler, Kit, PhotoOpts, Renderer, View } from './types.js';

export const VIEWS = [createCast, createPatchView, createGiantView, createSeasonView, createWeighoffView, createMischiefView, createCrawlView, createHandsView];

export function detectPhone() {
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  return touch && Math.min(innerWidth, innerHeight) < 820;
}

export interface RendererOpts { container?: HTMLElement; phone?: boolean; settings?: Partial<Settings>; T?: Tuning | null }

export async function createRenderer({ container = document.body, phone = detectPhone(), settings = {}, T = null }: RendererOpts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, phone ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  // three resets info after the shadow pass; reset it ourselves so calls include shadow-map draws
  renderer.info.autoReset = false;
  const dom = renderer.domElement;
  dom.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%;touch-action:none;outline:none;-webkit-tap-highlight-color:transparent';
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(dom);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd3dcdb);
  scene.fog = new THREE.Fog(0xd3dcdb, 1e4, 2e4);
  let time = 0, lastS: State | null = null;
  let viewListeners: ((view: string) => void)[] = [];
  // The kit's later members are built from the kit itself, so each is read through a getter that fails until it exists.
  let sky: Kit['sky'] | undefined, world: Kit['world'] | undefined, cam: Kit['cam'] | undefined;
  let hit: Kit['hit'] | undefined, fx: Kit['fx'] | undefined, cast: Kit['cast'] | undefined;
  const built = <T>(part: T | undefined, name: string): T => {
    if (part === undefined) throw new Error(`K.${name} is read before it is built`);
    return part;
  };
  const K: Kit = {
    THREE, scene, renderer, container, kit, layout, folk, phone, settings, T, squashables: {},
    t: () => time,
    emit: (_type, view) => viewListeners.forEach((fn) => fn(view)),
    get sky() { return built(sky, 'sky'); },
    get world() { return built(world, 'world'); },
    get cam() { return built(cam, 'cam'); },
    get hit() { return built(hit, 'hit'); },
    get fx() { return built(fx, 'fx'); },
    get cast() { return built(cast, 'cast'); },
    set cast(v: Kit['cast']) { cast = v; },
  };
  sky = createSky(K);
  world = createWorld(K);
  Object.assign(K.squashables, world.heroes);
  const size = (): [number, number] => [container.clientWidth || innerWidth, container.clientHeight || innerHeight];
  renderer.setSize(...size(), false);
  cam = createCamera(K);
  hit = createHit(K);
  fx = createFx(K);
  const views: View[] = VIEWS.map((make) => make(K));
  Object.assign(K.squashables, { weighmaster: K.cast.weighmaster.root, biscuit: K.cast.biscuit.root });

  const resize = () => { const [w, h] = size(); renderer.setSize(w, h, false); K.cam.resize(w, h); };
  const ro = new ResizeObserver(resize); ro.observe(container);
  resize();
  // Compile every material's shaders now, behind the boot curtain, rather than in the first frame: that froze the title
  // for seconds on slow GPUs, and the weigh-off's and Halloween's materials would have stalled their first frames too.
  // With KHR_parallel_shader_compile it waits (at most 4 s) while the GPU compiles in the background; without it,
  // starting the compiles here still lets them finish while the UI builds the title.
  try {
    if (renderer.extensions.has('KHR_parallel_shader_compile')) await Promise.race([renderer.compileAsync(scene, K.cam.active), new Promise((ok) => setTimeout(ok, 4000))]);
    else renderer.compile(scene, K.cam.active);
  } catch { /* the first frame compiles instead */ }

  function sync(s: State, rdt = 1 / 60) {
    const dt = Math.min(Math.max(rdt, 0), 0.1);
    time += dt; fogU.uFogTime.value = time; lastS = s;
    K.sky.sync(s, rdt);
    K.world.sync(s, dt, time);
    for (const v of views) v.sync(s, dt, time);
    K.fx.update(dt);
    K.cam.update(rdt);
    renderer.info.reset();
    renderer.render(scene, K.cam.active);
  }
  function fxEvent(ev: FxEvent) {
    if (ev.type === 'tap' && (ev.kind === 'toy' || ev.kind === 'hives')) K.world.toy(String(ev.id));   // hives puff bees too
    K.fx.handle(ev);
    for (const v of views) v.fx?.(ev);
  }
  const proj = new THREE.Vector3();
  function project(x: number, y: number, z: number) {
    proj.set(x, y, z).project(K.cam.active);
    const [w, h] = size();
    return { x: (proj.x + 1) / 2 * w, y: (1 - proj.y) / 2 * h, visible: Math.abs(proj.x) <= 1 && Math.abs(proj.y) <= 1 && proj.z <= 1 };
  }
  // crisp: the day's own fog, without a beat's thickening and at most patchy, so the reveal photo is the moment, not
  // Marlene rolling in over it (the next frame's sky sync puts the fog back)
  // focus: a world point the crop centres on (on a phone the subject sits above the bottom panel, not mid-canvas); tight:
  // the crop as a share of the largest one that fits (0.75 frames the giant on the scale, not the tile's rocky edge)
  function photo(w = 240, h = 180, type = 'image/jpeg', quality = 0.8, { crisp = false, focus = null, tight = 1 }: PhotoOpts = {}) {
    if (crisp) applyFog(scene, Math.min(K.sky.baseFog, 0.35));
    renderer.info.reset();
    renderer.render(scene, K.cam.active); // read back in the same task, before the buffer is presented
    if (crisp) applyFog(scene, K.sky.fog);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const sw = dom.width, sh = dom.height, k = Math.min(sw / w, sh / h) * kit.clamp(tight, 0.3, 1), cw = w * k, ch = h * k;
    let cx = sw / 2, cy = sh / 2;
    if (focus) { const p = project(focus.x, focus.y ?? 0, focus.z), dpr = sw / size()[0]; cx = p.x * dpr; cy = p.y * dpr; }
    const x0 = kit.clamp(cx - cw / 2, 0, sw - cw), y0 = kit.clamp(cy - ch / 2, 0, sh - ch);
    const g = c.getContext('2d');
    if (!g) throw new Error('no 2d canvas context');
    g.drawImage(dom, x0, y0, cw, ch, 0, 0, w, h);
    return c.toDataURL(type, quality);
  }
  const kc = K.cam;
  const R = {
    sync, fx: fxEvent, project, photo,
    pick: (x: number, y: number) => K.hit.pick(x, y),
    cam: {
      glide: kc.glide, frame: kc.frame, home: kc.home, setInset: kc.setInset, stroll: kc.stroll, title: kc.title,
      follow: kc.follow, setJoy: kc.setJoy, zoomFor: kc.zoomFor, rotate: kc.rotate,
      get view() { return kc.view; }, get zoom() { return kc.zoom; }, get target() { return kc.target; }, get azimuth() { return kc.azimuth; },
    },
    sky: { override: (x: Parameters<Kit['sky']['override']>[0]) => K.sky.override(x), get hour() { return K.sky.hour; }, get fog() { return K.sky.fog; } },
    setFogOverride: (d: number) => K.sky.setFogOverride(d),
    portrait: (key: string, opts = {}) => folk.portrait(key, { species: lastS?.meta?.species, ...opts }),
    on: (type: string, fn: HitHandler) => K.hit.on(type, fn),
    onView(fn: (view: string) => void) {
      viewListeners.push(fn);
      return () => { viewListeners = viewListeners.filter((f) => f !== fn); };
    },
    info: () => ({ ...renderer.info.render, programs: renderer.info.programs?.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
    get bg() { return '#' + K.sky.cur.bg.getHexString(); },
    renderer, scene, K,
    dispose() {
      for (const v of views) v.dispose?.();
      K.fx.dispose(); K.hit.dispose(); K.cam.dispose(); ro.disconnect(); folk.disposePortraits();
      kit.disposeTree(scene);
      renderer.dispose(); dom.remove();
    },
  };
  return R satisfies Renderer;
}
