// Marlene, the marine layer (design §5). One daily fog number f in [0, 1] drives the fog shader and every
// system, plus heat-wave and rain flags. The whole year is generated on Apr 1 from its own stream,
// hash(seed, year, 'weather'), so Marlene never depends on what the player does: every bot faces the same
// weather (fair A/B tests) and nobody can save-scum the sky.
//
// s.weather = { f, heat, rain, archetype, hint, forecast: [{ f, heat, rain, sd }] x3, days: [{ f, heat, rain }] x214, script }
// Out-events: { type: 'weather', f, heat, rain } each day; alert 'heatForecast' when Hal calls heat for tomorrow.
import { T, type FogWord } from './tuning.js';
import { dayOf, monthOf, LAST_DAY } from './calendar.js';
import { makeRng, next, gauss, weighted, chance, pick } from './rng.js';
import { clamp, round3, hash32, fill, words, entries, keys } from './util.js';
import { LINES, line, fresh } from './story.js';
import { HAL } from './lines-mischief.js';
import type { SimModule, State, Ctx } from "./types.js";
import type { ArchetypeId, WeatherDay, WeatherForecast } from './state.js';

const W = T.weather;
const days = (list: (string|number)[]) => new Set(list.map(dayOf));

// Generate a year of weather. Always draws the same number of values per day so scripting and
// overrides never shift the stream.
export function genYear(seed: number, year: number) {
  const r = makeRng(hash32(seed, year, 'weather'));
  const arch: ArchetypeId = year < W.archetypeFromYear ? 'normal' : weighted(r, entries(W.archetypes).map(([k, a]) => [k, a.p] as const)) ?? 'normal';
  const A = W.archetypes[arch];
  const b = A.b || 0, sigma = A.sigma || W.sigma, heatMul = A.heatMul || 1, rainMul = A.rainMul || 1;
  const y1 = year === 1;
  const scriptHeat = y1 ? days([...W.y1.heat, ...W.y1.heatW3]) : new Set<number>();
  const calm = y1 ? days(W.y1.calm) : new Set<number>();
  const noHeatBefore = y1 ? dayOf(W.y1.noRandomHeatBefore) : -1;
  const out: WeatherDay[] = [];
  let prev = W.mu.Apr + b, heatLeft = 0;
  for (let d = 0; d <= LAST_DAY; d++) {
    const m = monthOf(d), mu = W.mu[m] + b;
    const z = gauss(r), uStart = next(r), uLen = next(r), uRain = next(r);
    let f = clamp(mu + W.phi * (prev - mu) + sigma * z, 0, 1);
    let heat = 0;
    if (scriptHeat.has(d)) { heat = 1; heatLeft = 0; }
    else if (heatLeft > 0) { heat = 1; heatLeft--; }
    else if (d >= noHeatBefore && !calm.has(d) && uStart < W.heatStart[m] * heatMul) {
      heat = 1; heatLeft = (uLen < 0.5 ? W.heatDays[0] : W.heatDays[1]) - 1;
    }
    if (calm.has(d)) { heat = 0; heatLeft = 0; }
    const rain = !heat && !calm.has(d) && uRain < W.rain[m] * rainMul ? 1 : 0;
    if (heat) f = Math.min(f, W.heatF);
    if (rain) f = Math.max(f, W.rainF);
    if (calm.has(d)) f = clamp(f, W.y1.calmF[0], W.y1.calmF[1]);
    out.push({ f: round3(f), heat, rain });
    prev = f;
  }
  // Old Moss hints at the archetype in the spring Almanac and is right 70% of the time.
  const others = keys(W.archetypes).filter((k) => k !== arch);
  const hint = chance(r, W.hintAccuracy) ? arch : pick(r, others);
  return { archetype: arch, hint, days: out };
}

// Hal's 3-day forecast as seen on day d: f + N(0, sigma_k); heat called right 80/65/50% of the time with
// 5% false alarms (only in months where heat or rain can happen at all, so he never calls rain in July).
// A call shapes his number too: "heat" reads under 10% fog, "rain" over 75%, right or wrong.
// Noise is keyed by (day, k) so reopening the Almanac shows the same forecast, and it narrows as the day nears.
export function forecastFor(s: State, d: number) {
  const out: WeatherForecast[] = [];
  for (const [i, { sd, hit }] of W.forecast.days.entries()) {
    const k = i + 1, t = d + k;
    const real = s.weather.days[t];
    if (t > LAST_DAY || !real) break;
    const m = monthOf(t), r = makeRng(hash32(s.seed, s.clock.year, 'forecast', t, k));
    const call = (on: number, possible: boolean) => (on ? chance(r, hit) : chance(r, W.forecast.falseAlarm) && possible) ? 1 : 0;
    let f = clamp(real.f + sd * gauss(r), 0, 1);
    const heat = call(real.heat, W.heatStart[m] > 0), rain = heat ? 0 : call(real.rain, W.rain[m] > 0);
    if (heat) f = Math.min(f, W.heatF);
    if (rain) f = Math.max(f, W.rainF);
    out.push({ day: t, f: round3(f), heat, rain, sd });
  }
  return out;
}

// The HUD chip: word plus %.
export function word(f: number): FogWord { for (const [lim, w] of W.words) if (f < lim) return w; return 'Sulking'; }
export function chip(s: State) {
  const { f, heat } = s.weather;
  return { f, pct: Math.round(f * 100), word: heat ? 'Heat' as const : word(f), heat: !!heat, rain: !!s.weather.rain,
    line: heat ? W.heatLine : (W.words.find(([lim]) => f < lim)?.[2] || '') };
}
// Climatology for ghost bars and the Almanac: the month mean plus this year's bias.
export const expectedF = (s: State, d: number) => clamp(W.mu[monthOf(d)] + W.archetypes[s.weather.archetype].b, 0, 1);
// Share of days so far with Marlene in (f > 0.5), for the Crier and the Almanac.
export function inShare(s: State, upto = s.clock.day) {
  const ds = s.weather.days.slice(0, Math.max(1, upto + 1));
  return ds.filter((x) => x.f > W.inThreshold).length / ds.length;
}

function setYear(s: State) {
  const y = genYear(s.seed, s.clock.year);
  Object.assign(s.weather, { archetype: y.archetype, hint: y.hint, days: y.days,
    script: s.clock.year === 1 ? { kelp: dayOf(W.y1.kelp), heat: W.y1.heat.map(dayOf), heatW3: W.y1.heatW3.map(dayOf) } : null });
  today(s);
}
function today(s: State) {
  const d = s.weather.days[Math.min(s.clock.day, LAST_DAY)];
  if (!d) throw new Error(`weather: no day ${s.clock.day} in year ${s.clock.year}`);
  Object.assign(s.weather, { f: d.f, heat: d.heat, rain: d.rain });
}

// Beat 2 (§3): Howlin' Hal introduces Marlene, the fog chip and the forecast on Apr 18 of year 1.
const halIntro = {
  id: 'weather.marlene', year: 1, order: 2, at: T.story.y1.marlene,
  when: (s: State) => s.clock.phase === 'grow' && s.clock.day >= dayOf(T.story.y1.marlene),
  run(s: State, ctx: Ctx) {
    ctx.unlock('marlene');
    const c = chip(s);
    ctx.say('hal', [fill(LINES.hal.marlene[c.word], { pct: words(c.pct) }), LINES.hal.forecast],
      { goal: { id: 'marlene', target: { kind: 'hud', id: 'fog' } } });
  },
};

export default {
  id: 'weather',
  beats: [halIntro],
  // Bots check the forecast the way a player does: opening the Almanac completes Hal's goal (so ?jump states don't
  // carry it all year).
  bot(s: State, _ctx, P) { if (P.name !== 'idle' && s.story.goal?.id === 'marlene') return { type: 'story/goalDone', id: 'marlene' }; },
  init(s: State) { s.weather = { f: W.mu.Apr, heat: 0, rain: 0, archetype: 'normal', hint: 'normal', forecast: [], days: [], script: null }; setYear(s); },
  newYear(s) { setYear(s); },
  dayStart(s: State, ctx: Ctx) {
    today(s);
    s.weather.forecast = forecastFor(s, s.clock.day);
    ctx.emit({ type: 'weather', f: s.weather.f, heat: s.weather.heat, rain: s.weather.rain });
    // Hal phones it in the day before a heat wave (an alert: auto-slows the clock). Not on the second day of
    // a wave, and in year 1 only after the shade intro (the giant slice's Aug 10 beat says it in person).
    const tm = s.weather.forecast[0];
    const ready = s.unlocks.marlene && (s.clock.year > 1 || s.unlocks.shade);
    if (ready && tm?.heat && !s.weather.heat && s.clock.phase !== 'newgame') {
      // [A] a keyed no-repeat pick (fresh): the weather stream never moves for a line
      const said = fresh(s, makeRng(hash32(s.seed, s.clock.year, s.clock.day, 'heatTomorrow')), 'hal.heatTomorrow', HAL.heatTomorrow);
      if (said) ctx.alert('heatForecast', { text: line(s, said), speaker: 'hal', cls: 'warn' });
    }
  },
} satisfies SimModule;
