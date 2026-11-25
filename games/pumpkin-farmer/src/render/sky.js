// Time of day and Marlene, driven continuously by sim state (architecture §4.5, design §5).
//
// Light is a blend of five presets (the prototype's day / golden / night plus a new dawn and dusk):
// - growing days (and October weekdays): dawn -> day -> dusk over s.clock.dayFrac, but held near
//   midday for most of the day and only a gentle "day pulse" at the edges. The pulse fades out when
//   a day lasts under ~2 real seconds (fast-forward), so the farm never strobes.
// - weekend days (s.clock.minute 540..1020): a soft morning, readable midday, warm light from ~15:00.
//   It turns fully golden when the golden_hour event is active (s.events.active) or Marlene is thin,
//   then slides toward dusk at closing.
// - the eve (s.weighoff.stage 'eve' / 'night') and Halloween are night; the weigh-off morning is dawn.
// Fog: uFogAmt = s.weather.f (the gameplay number is the rendered fog), eased over ~1 s, plus a
// cosmetic morning burn-off (+0.1 fading by noon) on weekend days and R.setFogOverride(delta).
import * as THREE from 'three';
import { applyFog } from './fog.js';
import { clamp, lerp, smooth, damp } from './kit.js';

const PRESETS = {
  dawn: { bg: 0xdcd5d4, sun: 0xffd6b8, sunI: 2.0, pos: [30, 9, 12], sky: 0xe8dfe2, gnd: 0x8a8272, hemiI: 1.2, glow: 0.1, water: 0x8fb5b8 },
  day: { bg: 0xd3dcdb, sun: 0xfff4e2, sunI: 2.6, pos: [18, 30, 14], sky: 0xe3ecee, gnd: 0x8c8a6c, hemiI: 1.3, glow: 0, water: 0x8cbdb6 },
  golden: { bg: 0xe9c8a7, sun: 0xffad66, sunI: 3.1, pos: [-30, 10, 14], sky: 0xf5d2ad, gnd: 0x7d6a55, hemiI: 1.0, glow: 0.3, water: 0x7fb0b8 },
  dusk: { bg: 0x9b97ab, sun: 0xe0957e, sunI: 1.5, pos: [-30, 6, 2], sky: 0xb3a9c2, gnd: 0x4e4a52, hemiI: 0.95, glow: 0.62, water: 0x6d8a98 },
  night: { bg: 0x1a2130, sun: 0x8ea6d8, sunI: 0.75, pos: [12, 26, -16], sky: 0x3d4d70, gnd: 0x1a1c22, hemiI: 0.75, glow: 1, water: 0x4d6f7a },
};
const state = () => ({ bg: new THREE.Color(), sun: new THREE.Color(), sky: new THREE.Color(), gnd: new THREE.Color(), water: new THREE.Color(), pos: new THREE.Vector3(), sunI: 0, hemiI: 0, glow: 0 });
const L = Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => {
  const st = state();
  for (const c of ['bg', 'sun', 'sky', 'gnd', 'water']) st[c].setHex(p[c]);
  st.pos.set(...p.pos); st.sunI = p.sunI; st.hemiI = p.hemiI; st.glow = p.glow;
  return [k, st];
}));
function mix(out, a, b, k) {
  for (const c of ['bg', 'sun', 'sky', 'gnd', 'water']) out[c].copy(a[c]).lerp(b[c], k);
  out.pos.copy(a.pos).lerp(b.pos, k);
  out.sunI = lerp(a.sunI, b.sunI, k); out.hemiI = lerp(a.hemiI, b.hemiI, k); out.glow = lerp(a.glow, b.glow, k);
  return out;
}
const copy = (out, a) => mix(out, a, a, 0);

// keyframes [hour, preset]; smoothstepped between neighbours
const DAY_KEYS = [[4.5, 'night'], [6.2, 'dawn'], [8.4, 'day'], [15.2, 'day'], [16.7, 'golden'], [17.9, 'dusk'], [19.4, 'night']];
const WEEKEND_KEYS = [[7.6, 'dawn'], [10.4, 'day'], [24, 'day']];
function atKeys(out, keys, h) {
  if (h <= keys[0][0]) return copy(out, L[keys[0][1]]);
  for (let i = 1; i < keys.length; i++) {
    const [h1, p1] = keys[i];
    if (h <= h1) { const [h0, p0] = keys[i - 1]; return mix(out, L[p0], L[p1], smooth(h, h0, h1)); }
  }
  return copy(out, L[keys.at(-1)[1]]);
}
// growing days spend most of their dayFrac at a readable midday
const fracHour = (f) => (f < 0.12 ? lerp(6, 9.5, f / 0.12) : f < 0.86 ? lerp(9.5, 14.5, (f - 0.12) / 0.74) : lerp(14.5, 18.2, (f - 0.86) / 0.14));
const minuteHour = (m) => (m ?? 600) / 60;  // s.clock.minute is minutes since midnight
const goldenActive = (s) => !!(s?.season?.golden || s?.events?.active?.some?.((e) => (e?.id ?? e) === 'golden_hour'));

export function createSky(K) {
  const { scene, phone } = K;
  const hemi = new THREE.HemisphereLight(0xe3ecee, 0x8c8a6c, 1.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e2, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(phone ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 120 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const cur = state(), tgt = state(), noon = state(), tmp = state();
  let first = true, fog = 0.35, fogOverride = 0, fogOvCur = 0, override = null, hour = 12;
  let spd = 3.6, dayAcc = 0, lastDay = null;

  // the light this state asks for (into tgt); returns the fog target
  function target(s, rdt) {
    const c = s?.clock, f = clamp(s?.weather?.f ?? 0.35, 0, 1);
    let burn = 0;
    if (override != null) {
      if (typeof override === 'number') atKeys(tgt, DAY_KEYS, (hour = override));
      else copy(tgt, L[override] || L.day);
      return f;
    }
    const ph = c?.phase;
    if (ph === 'halloween') { hour = 21; copy(tgt, L.night); }
    else if (ph === 'weighoff') {
      const st = String(s?.weighoff?.stage ?? '');
      if (/eve|night|watch/.test(st)) { hour = 21.5; copy(tgt, L.night); }
      else if (/dawn|swoop/.test(st)) { hour = 6.8; copy(tgt, L.dawn); }
      else atKeys(tgt, DAY_KEYS, (hour = 11));
    } else if (ph === 'october' && (c.sub === 'weekend' || (c.sub === 'card' && (c.minute ?? 0) >= 540))) {
      // a weekend day, or a card that paused one (the morning card at 9:00, the evening card at 17:00)
      hour = minuteHour(c.minute);
      atKeys(tgt, WEEKEND_KEYS, hour);
      const gs = goldenActive(s) ? 1 : lerp(0.75, 0.3, smooth(f, 0.25, 0.75));
      mix(tgt, tgt, L.golden, smooth(hour, 15, 15.8) * gs);
      mix(tgt, tgt, L.dusk, smooth(hour, 16.4, 17.4) * 0.55);
      burn = 0.1 * (1 - smooth(hour, 9, 12));
    } else if (ph === 'grow' || ph === 'october') {
      // estimate real seconds per sim day, so fast-forward holds midday instead of strobing
      dayAcc += rdt;
      if (lastDay !== c.day) { if (lastDay != null) spd = lerp(spd, Math.min(dayAcc, 8), 0.5); dayAcc = 0; lastDay = c.day; }
      hour = fracHour(clamp(c.dayFrac ?? 0.5, 0, 1));
      atKeys(noon, DAY_KEYS, 12); atKeys(tmp, DAY_KEYS, hour);
      mix(tgt, noon, tmp, 0.4 * smooth(spd, 1.8, 5));
    } else { hour = 12; copy(tgt, L.day); }
    return clamp(f + burn, 0, 1);
  }

  function sync(s, rdt) {
    const want = target(s, rdt);
    const k = first ? 1 : damp(rdt, 3);
    mix(cur, cur, tgt, k);
    fogOvCur = first ? fogOverride : lerp(fogOvCur, fogOverride, damp(rdt, 3));
    fog = first ? want : lerp(fog, want, damp(rdt, 3));
    first = false;
    applyFog(scene, fog + fogOvCur);
    scene.background.copy(cur.bg); scene.fog.color.copy(cur.bg);
    sun.color.copy(cur.sun); sun.intensity = cur.sunI; sun.position.copy(cur.pos).normalize().multiplyScalar(50);
    hemi.color.copy(cur.sky); hemi.groundColor.copy(cur.gnd); hemi.intensity = cur.hemiI;
    K.world?.setLight(cur);
    if (K.container) K.container.style.background = '#' + cur.bg.getHexString();
  }

  return {
    sync, cur, hemi, sun, PRESETS,
    get fog() { return clamp(fog + fogOvCur, 0, 1); },
    get baseFog() { return clamp(fog, 0, 1); },     // Marlene herself, without a scripted beat's override
    get hour() { return hour; },
    get night() { return cur.glow > 0.6; },
    // scripted beats and dev tools: an hour (number), a preset name, or null to follow the clock
    override(x) { override = x ?? null; },
    setFogOverride(d) { fogOverride = +d || 0; },
    snap() { first = true; },
  };
}
