// Bot policies, runBot and jumpTo (architecture §3.9, design §14). A bot acts only through dispatch, using
// actions the UI can produce. Each step it reads queued dialogue, answers cards (policy.answer(card, s), else the
// card's defaultChoice), asks every module's bot(s, ctx, policy) hook for actions (a hook returns an action, an
// array of actions, or nothing), then advances one day or policy.tickStep weekend minutes.
//
// Policy objects are plain data that slices read in their own bot hooks; add fields in your slice's section.
import { dispatch, advanceDays, advanceTicks, makeCtx, startGame, isBlocked, type NewGameOpts } from './game.js';
import { MODULES } from './modules.js';
import { dayOf, isWeekend, OPEN } from './calendar.js';
import { T, rivalOf } from './tuning.js';
import { own } from './util.js';
import { botChoice } from './mischief.js';
import { botChoice as giantChoice } from './giant.js';
import { botChoice as crawlChoice } from './crawl.js';
import type { Action, Card, GiantPolicy, OutEvent, Policy, State } from './types.js';

// Weekend looks: tickStep is how many weekend minutes pass between a bot's looks. A person looks up about twice a real
// second (LOOK), the idle bot once a second, the attentive one every minute.
const TPS = T.calendar.weekend.ticksPerSecond, LOOK = Math.max(1, Math.round(TPS / 2));
// The balanced farm reads the forecast, the bees and the knock on the giant's cards ([C] giant.botChoice, crawl.botChoice):
// moving 'now' | 'best' | 'worst' (Moving Day's morning), dawn 'bees' | 'read' | 'paws' | 'clear' (the dawn card),
// crawlGuess 'mid' | 'knock' | 'blind' (the first tape's guess). The novice and the breeders take the defaults.
const READS = { moving: 'best', dawn: 'read', crawlGuess: 'knock' } as const;
// Default answers to blocking cards only; still taps "Continue" through the beat-driven phases.
const idle: Policy = { name: 'idle', shop: null, tickStep: TPS };
// Random planting dates, waters late and unreliably, half the bugs, normal water, no feed, open pollination. [E] its thumb
// on the bug hunt (hunt.js playHunt) is slower and misses more, and often lets a pin sit a day or two. [B] It plans with
// random taps on the Planting Table. [A] It taps half the ✦ pins and lets the possum rest.
const novice: Policy = { name: 'novice', shop: 'novice', reserve: 500, reliability: 0.7, waterBelow: 0.25, squish: 0.5, serve: 0.5, bubbles: 0.4,
  lift: 0.5, giant: { regime: 'normal', feed: 'none', shade: false, respond: false }, pollinate: 'open', tickStep: LOOK,
  hands: { skill: 0.4, diligence: 0.3 }, table: 'random', mischief: { taps: 0.5 }, pamela: 'smart', possum: 'rest' };
// Gran's waves adjusted by the forecast, minis in front, kelp, shade by forecast, eases off on creaks, greedy-ROI shop.
const farm: Policy = { name: 'balanced', shop: 'balanced', reserve: 300, reliability: 1, waterBelow: 0.35, squish: 1, serve: 1, bubbles: 1,
  lift: 0.85, giant: { regime: 'normal', feed: 'kelp', shade: 'forecast', respond: true }, pollinate: 'open', plan: 'gran', tickStep: LOOK,
  hands: { skill: 0.8, diligence: 0.8 } };
// [giant] the breeders' care: the balanced farm's, rotating her and talking to her
const care: GiantPolicy = { regime: 'normal', feed: 'kelp', shade: 'forecast', respond: true, rotate: true, talk: true };
// with Edna taping her every Sunday (rulings R4), the balanced player measures her own about once a week, not every 3 days
const balanced: Policy = { ...farm, giant: { regime: 'normal', feed: 'kelp', shade: 'forecast', respond: true, measure: 5 }, ...READS };
// [season slice] the weekend attention models (design §14): the balanced farm, played on weekends by an Attentive (instant,
// unlimited), Realistic (1.5-4 s, <= 25 actions/min; the balanced bot's own) or Lazy (never taps) player: a person looks
// up twice a second, the attentive bot every minute, and the idle bot never acts on weekends at all.
const watcher = (season: 'attentive' | 'realistic' | 'lazy'): Policy => ({ ...balanced, season, id: season, tickStep: season === 'attentive' ? 1 : LOOK });
// [B] the Planting Table's players (plan §3.8; patch.js tablePlan): the balanced farm, planning with the Table instead of
// Gran's waves. chips fills October's crates greedily, randomChips taps a random weekend span and variety, careless puts
// every row on W1.
const planner = (id: string, table: 'random' | 'chips' | 'careless'): Policy => ({ ...balanced, id, table });
// [economy] investment orders (design §14 "Builds"): the balanced farm, shopping in a different order (economy.js SHOP_ORDER).
// The Operator delegates: once Dez is hired it leaves the till to him and works the floor, and Bea keeps the barn. The
// Showman's money goes on the crowd (the billboard early; Hal's radio on big weekends, like Balanced: a spot every weekend
// loses money while the field is what runs out). The Hoarder never spends a cent it doesn't have to (no shop, hires,
// marketing or Grange pollen; seed, water and kelp only).
const investor = (shop: 'operator' | 'showman' | 'grower'): Policy => ({ ...balanced, id: shop, shop, ...(shop === 'operator' ? { delegate: true } : {}) });
// [giant] the breeders (design §14 bot table): the Balanced farm with a different breeding plan. Open and Buy are
// single-plot plans with no shop (the second plot belongs to "Cross + second plot", which is Balanced itself); Pretty
// crosses for looks (the prettiest lines' pollen, Vale first), culls the round one, rotates, and keeps the sail up.
const packOf = (s: State, choice: string) => s.genetics.pollen.find((p) => `cross:${p.id}` === choice);
const beautyOf = (s: State, choice: string) => {
  const p = packOf(s, choice);
  return (p && rivalOf(p.line)?.beauty) || 0;
};
const prettiest = (c: Card, s: State) => {
  if (c.kind === 'cull') return 'round';
  if (c.kind !== 'pollinate') return undefined;
  const packs = c.data.choices.filter((x) => packOf(s, x.id)).sort((a, b) => beautyOf(s, b.id) - beautyOf(s, a.id));
  return packs[0]?.id ?? 'open';
};
const openOnly = (c: Card) => (c.kind === 'pollinate' ? 'open' : undefined);
// [A] the visitors (plan §3.2, §3.3): mischief.taps is the share of ✦ pins a bot taps (keyed, so a replay taps the same
// ones; an untapped pin's "left alone" outcome runs); pamela 'smart' | 'whistle' | 'graze' and possum 'smart' | 'rest' |
// 'ask' answer their bubbles (smart reads only what the bubble shows). The tapper and the ignorer are the balanced farm
// tapping every ✦, or none (the fun tests compare them).
export const POLICIES = {
  idle, novice, balanced,
  attentive: watcher('attentive'), realistic: watcher('realistic'),
  // the Night Watch is a weekend night too (W4 Sunday): the lazy player sleeps through it
  lazy: { ...watcher('lazy'), watch: 0 },
  chips: planner('chips', 'chips'), randomChips: planner('randomChips', 'random'), careless: planner('careless', 'careless'),
  operator: investor('operator'), showman: investor('showman'), grower: investor('grower'),
  hoarder: { ...balanced, id: 'hoarder', shop: null, marketing: false, breed: { pick: 'plump', buy: null } },
  open: { ...farm, name: 'open', id: 'open', shop: null, giant: care, breed: { pick: 'plump' }, answer: openOnly },
  buy: { ...farm, name: 'buy', id: 'buy', shop: null, giant: care, breed: { pick: 'plump', buy: 'seed' }, answer: openOnly },
  pretty: { ...farm, name: 'pretty', id: 'pretty', shop: null, breed: { pick: 'plump', buy: 'pollen', prefer: 'pretty' }, answer: prettiest,
    giant: { regime: 'light', feed: 'kelp', shade: true, respond: true, rotate: true, talk: true } },
  tapper: { ...balanced, id: 'tapper', mischief: { taps: 1 } },
  ignorer: { ...balanced, id: 'ignorer', mischief: { taps: 0 } },
} satisfies Record<string, Policy>;
for (const P of Object.values<Policy>(POLICIES)) {
  // everyone but the idle bot looks at what turns up (the balanced farm and its variants tap every ✦)
  P.mischief ??= { taps: P.name === 'idle' ? 0 : 1 }; P.pamela ??= 'smart'; P.possum ??= 'smart';
  const mine = P.answer;
  // `this` is the policy the bot plays (a test's { ...POLICIES.balanced, pamela: 'graze' } reads its own fields)
  P.answer = function answer(c, s) {
    return c.kind === 'mischief' ? botChoice(c, s, this) : mine?.call(this, c, s) ?? giantChoice(c, s, this) ?? crawlChoice(c, s, this);
  };
}
export const policyOf = (p: string | Policy | undefined): Policy => (typeof p === 'string' ? own<Policy>(POLICIES, p) : p) ?? POLICIES.idle;

/** opts: maxSteps, events (collects out-events), strict (throw on refused actions), game (startGame's options). */
export interface BotOpts { maxSteps?: number; events?: OutEvent[]; strict?: boolean; game?: NewGameOpts }

function act(s: State, a: Action, opts: BotOpts) {
  const r = dispatch(s, a);
  if (opts.events) opts.events.push(...r.events);
  if (!r.ok && opts.strict) throw new Error(`bot action ${a.type} failed: ${r.reason}`);
  return r;
}

const BOT_HOOKS = MODULES.flatMap((m) => (m.bot ? [m.bot] : []));   // hook order, without the modules that never act

// Run until until(s) is true.
export function runBot(s: State, policy: string | Policy = 'balanced', until: (s: State) => boolean = () => false, opts: BotOpts = {}) {
  const P = policyOf(policy);
  const maxSteps = opts.maxSteps ?? 1e6;
  let steps = 0, idle = 0;
  const hookOut: OutEvent[] = [], ctx = makeCtx(s, hookOut);   // one ctx for the bot hooks (their out-events are dropped each step)
  while (!until(s)) {
    if (++steps > maxSteps) throw new Error(`runBot: no progress after ${maxSteps} steps (${s.clock.phase} day ${s.clock.day})`);
    const c0 = s.clock, y0 = c0.year, p0 = c0.phase, d0 = c0.day, m0 = c0.minute;
    let acted = 0;
    if (s.clock.phase === 'newgame') { act(s, { type: 'newgame/start' }, opts); continue; }
    for (let d = s.story.dialog[0]; d; d = s.story.dialog[0]) act(s, { type: 'story/dialogSeen', id: d.id }, opts);
    for (let k = 0, c = s.story.cards[0]; c && k < 50; k++, c = s.story.cards[0]) {
      const choice = P.answer?.(c, s) ?? c.data.defaultChoice ?? c.data.choices?.[0]?.id;
      const r = act(s, { type: 'card/answer', id: c.id, choice }, opts);
      if (!r.ok) throw new Error(`runBot: card ${c.kind} refused ${choice}: ${r.reason}`);
      acted++;
    }
    hookOut.length = 0;
    for (const bot of BOT_HOOKS) {
      const out = bot(s, ctx, P);
      if (Array.isArray(out)) for (const a of out) { act(s, a, opts); acted++; }
      else if (out) { act(s, out, opts); acted++; }
      if (until(s)) return s;
    }
    if (!isBlocked(s)) {
      const evs = s.clock.phase === 'october' && isWeekend(s.clock.day) ? advanceTicks(s, P.tickStep || 1) : advanceDays(s, 1);
      if (opts.events) opts.events.push(...evs);
    }
    const c = s.clock, same = c.year === y0 && c.phase === p0 && c.day === d0 && c.minute === m0;
    idle = same && !acted ? idle + 1 : 0;
    if (idle > 20) throw new Error(`runBot: stuck in ${s.clock.phase} on day ${s.clock.day} (nothing advanced the game)`);
  }
  return s;
}

// ------------------------------------------------------------ jump targets
// 'y1-jun1', 'y1-aug1', 'y1-sep20', 'y1-oct3' (W1 Saturday 9:00), 'y1-oct17', 'y1-weighoff', 'y1-halloween',
// 'y1-winter', 'y2-jun1', 'y3-oct3' ... any 'y<N>-<mon><day>' or 'y<N>-<phase>'.
const ORDER: Record<string, number> = { newgame: 0, grow: 1, october: 1, weighoff: 2, halloween: 3, winter: 4 };
const orderOf = (phase: string) => own(ORDER, phase) ?? 0;
export function targetFn(target: string) {
  const m = /^y(\d+)-([a-z]+)(\d*)$/i.exec(String(target).trim());
  if (!m) throw new Error(`jump: bad target ${target}`);
  const [, y = '', w = '', num] = m, year = +y, word = w.toLowerCase();
  if (!num) {
    const at = own(ORDER, word);
    if (at === undefined) throw new Error(`jump: unknown phase ${word}`);
    return (s: State) => s.clock.year > year || (s.clock.year === year && orderOf(s.clock.phase) >= at);
  }
  const day = dayOf(word.charAt(0).toUpperCase() + word.slice(1) + ' ' + num);
  const weekend = day >= dayOf('Oct 1') && isWeekend(day);
  return (s: State) => {
    if (s.clock.year !== year) return s.clock.year > year;
    if (orderOf(s.clock.phase) > 1) return true;
    if (s.clock.phase === 'newgame' || s.clock.day < day) return false;
    return !weekend || s.clock.day > day || s.clock.minute === OPEN;
  };
}

// Run the balanced bot from s (or a fresh game) to the target, then hand over. Returns s.
export function jumpTo(s: State, target: string, policy: string | Policy = 'balanced') {
  if (s.clock.phase === 'newgame') dispatch(s, { type: 'newgame/start' });
  return runBot(s, policy, targetFn(target));
}

// Convenience for tools and tests: a fresh game run for N years.
export function runYears(seed: number | string, years: number, policy: string | Policy = 'balanced', opts: BotOpts = {}) {
  const s = startGame({ seed, ...opts.game });
  runBot(s, policy, (x) => x.clock.year > years || (x.clock.year === years && x.clock.phase === 'winter'), opts);
  return s;
}
