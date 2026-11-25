// Bot policies, runBot and jumpTo (architecture §3.9, design §14). A bot acts only through dispatch, using
// actions the UI can produce. Each step it reads queued dialogue, answers cards (policy.answer(card, s), else the
// card's defaultChoice), asks every module's bot(s, ctx, policy) hook for actions (a hook returns an action, an
// array of actions, or nothing), then advances one day or policy.tickStep weekend minutes.
//
// Policy objects are plain data that slices read in their own bot hooks; add fields in your slice's section.
import { dispatch, advanceDays, advanceTicks, makeCtx, startGame, isBlocked } from './game.js';
import { MODULES } from './modules.js';
import { dayOf, isWeekend, OPEN } from './calendar.js';
import { T } from './tuning.js';
import { botChoice } from './mischief.js';
import { botChoice as giantChoice } from './giant.js';
import { botChoice as crawlChoice } from './crawl.js';

// Weekend looks: tickStep is how many weekend minutes pass between a bot's looks. A person looks up about twice a real
// second (LOOK), the idle bot once a second, the attentive one every minute.
const TPS = T.calendar.weekend.ticksPerSecond, LOOK = Math.max(1, Math.round(TPS / 2));
export const POLICIES = {
  // Default answers to blocking cards only; still taps "Continue" through the beat-driven phases.
  idle: { name: 'idle', shop: null, tickStep: TPS },
  // Random planting dates, waters late and unreliably, half the bugs, normal water, no feed, open pollination.
  novice: { name: 'novice', shop: 'novice', reserve: 500, reliability: 0.7, waterBelow: 0.25, squish: 0.5, serve: 0.5, bubbles: 0.4,
    lift: 0.5, giant: { regime: 'normal', feed: 'none', shade: false, respond: false }, pollinate: 'open', tickStep: LOOK },
  // Gran's waves adjusted by the forecast, minis in front, kelp, shade by forecast, eases off on creaks, greedy-ROI shop.
  balanced: { name: 'balanced', shop: 'balanced', reserve: 300, reliability: 1, waterBelow: 0.35, squish: 1, serve: 1, bubbles: 1,
    lift: 0.85, giant: { regime: 'normal', feed: 'kelp', shade: 'forecast', respond: true }, pollinate: 'open', plan: 'gran', tickStep: LOOK },
};
// [E] the bug hunt (plan §3.14): a thumb's skill (hunt.js playHunt plays the close-up with it) and the chance it gets to a
// bug pin on a given day. The novice is slower and misses more, and often lets a pin sit a day or two.
POLICIES.novice.hands = { skill: 0.4, diligence: 0.3 };
POLICIES.balanced.hands = { skill: 0.8, diligence: 0.8 };
// [season slice] the weekend attention models (design §14): the balanced farm, played on weekends by an Attentive (instant,
// unlimited), Realistic (1.5-4 s, <= 25 actions/min; the balanced bot's own) or Lazy (never taps) player: a person looks
// up twice a second, the attentive bot every minute, and the idle bot never acts on weekends at all.
for (const season of ['attentive', 'realistic', 'lazy']) POLICIES[season] = { ...POLICIES.balanced, season, id: season, tickStep: season === 'attentive' ? 1 : LOOK };
POLICIES.lazy.watch = 0;          // the Night Watch is a weekend night too (W4 Sunday): the lazy player sleeps through it
// [B] the Planting Table's players (plan §3.8; patch.js tablePlan): the balanced farm, planning with the Table instead of
// Gran's waves. chips fills October's crates greedily, randomChips taps a random weekend span and variety (the novice plans
// this way too), careless puts every row on W1.
POLICIES.novice.table = 'random';
for (const [id, table] of [['chips', 'chips'], ['randomChips', 'random'], ['careless', 'careless']]) POLICIES[id] = { ...POLICIES.balanced, id, table };
// [economy] investment orders (design §14 "Builds"): the balanced farm, shopping in a different order (economy.js SHOP_ORDER).
// The Operator delegates: once Dez is hired it leaves the till to him and works the floor, and Bea keeps the barn. The
// Showman's money goes on the crowd (the billboard early; Hal's radio on big weekends, like Balanced: a spot every weekend
// loses money while the field is what runs out). The Hoarder never spends a cent it doesn't have to (no shop, hires,
// marketing or Grange pollen; seed, water and kelp only).
for (const b of ['operator', 'showman', 'grower']) POLICIES[b] = { ...POLICIES.balanced, id: b, shop: b, ...(b === 'operator' ? { delegate: true } : {}) };
POLICIES.hoarder = { ...POLICIES.balanced, id: 'hoarder', shop: null, marketing: false, breed: { pick: 'plump', buy: null } };
// [giant] the breeders (design §14 bot table): the Balanced farm with a different breeding plan. Open and Buy are
// single-plot plans with no shop (the second plot belongs to "Cross + second plot", which is Balanced itself); Pretty
// crosses for looks (the prettiest lines' pollen, Vale first), culls the round one, rotates, and keeps the sail up.
const packOf = (s, choice) => s.genetics.pollen.find((p) => `cross:${p.id}` === choice);
const prettiest = (c, s) => {
  if (c.kind === 'cull') return 'round';
  if (c.kind !== 'pollinate') return undefined;
  const packs = c.data.choices.filter((x) => packOf(s, x.id)).sort((a, b) => (T.rivals[packOf(s, b.id).line]?.beauty ?? 0) - (T.rivals[packOf(s, a.id).line]?.beauty ?? 0));
  return packs[0]?.id ?? 'open';
};
const openOnly = (c) => (c.kind === 'pollinate' ? 'open' : undefined);
const care = { ...POLICIES.balanced.giant, rotate: true, talk: true };
Object.assign(POLICIES, {
  open: { ...POLICIES.balanced, name: 'open', id: 'open', shop: null, giant: care, breed: { pick: 'plump' }, answer: openOnly },
  buy: { ...POLICIES.balanced, name: 'buy', id: 'buy', shop: null, giant: care, breed: { pick: 'plump', buy: 'seed' }, answer: openOnly },
  pretty: { ...POLICIES.balanced, name: 'pretty', id: 'pretty', shop: null, breed: { pick: 'plump', buy: 'pollen', prefer: 'pretty' }, answer: prettiest,
    giant: { regime: 'light', feed: 'kelp', shade: true, respond: true, rotate: true, talk: true } },
});
// [A] the visitors (plan §3.2, §3.3): mischief.taps is the share of ✦ pins a bot taps (keyed, so a replay taps the same
// ones; an untapped pin's "left alone" outcome runs); pamela 'smart' | 'whistle' | 'graze' and possum 'smart' | 'rest' |
// 'ask' answer their bubbles (smart reads only what the bubble shows). The tapper and the ignorer are the balanced farm
// tapping every ✦, or none (the fun tests compare them).
Object.assign(POLICIES.novice, { mischief: { taps: 0.5 }, pamela: 'smart', possum: 'rest' });
POLICIES.tapper = { ...POLICIES.balanced, name: 'balanced', id: 'tapper', mischief: { taps: 1 } };
POLICIES.ignorer = { ...POLICIES.balanced, name: 'balanced', id: 'ignorer', mischief: { taps: 0 } };
// [C] the giant's cards (giant.botChoice, crawl.botChoice): moving 'now' | 'best' | 'worst' (Moving Day's morning), dawn
// 'bees' | 'read' | 'paws' | 'clear' (the dawn card), crawlGuess 'mid' | 'knock' | 'blind' (the first tape's guess). The
// balanced farm reads the forecast, the bees and the knock; the novice takes the defaults. A policy's own answer goes first.
Object.assign(POLICIES.balanced, { moving: 'best', dawn: 'read', crawlGuess: 'knock' });
// with Edna taping her every Sunday (rulings R4), the balanced player measures her own about once a week, not every 3 days
POLICIES.balanced.giant.measure = 5;
for (const P of Object.values(POLICIES)) {
  // everyone but the idle bot looks at what turns up (the balanced farm and its variants tap every ✦)
  P.mischief ??= { taps: P.name === 'idle' ? 0 : 1 }; P.pamela ??= 'smart'; P.possum ??= 'smart';
  if (P !== POLICIES.balanced && P.name === 'balanced') Object.assign(P, { moving: 'best', dawn: 'read', crawlGuess: 'knock', ...P });
  const own = P.answer;
  // `this` is the policy the bot plays (a test's { ...POLICIES.balanced, pamela: 'graze' } reads its own fields)
  P.answer = function answer(c, s) {
    return c.kind === 'mischief' ? botChoice(c, s, this) : own?.call(this, c, s) ?? giantChoice(c, s, this) ?? crawlChoice(c, s, this);
  };
}
export const policyOf = (p) => (typeof p === 'string' ? POLICIES[p] : p) || POLICIES.idle;

function act(s, a, opts) {
  const r = dispatch(s, a);
  if (opts.events) opts.events.push(...r.events);
  if (!r.ok && opts.strict) throw new Error(`bot action ${a.type} failed: ${r.reason}`);
  return r;
}

const BOT_MODULES = MODULES.filter((m) => typeof m.bot === 'function');   // hook order, without the modules that never act

// Run until until(s) is true. opts: { maxSteps, events: [] (collects out-events), strict (throw on refused actions) }.
export function runBot(s, policy = 'balanced', until = () => false, opts = {}) {
  const P = policyOf(policy);
  const maxSteps = opts.maxSteps ?? 1e6;
  let steps = 0, idle = 0;
  const hookOut = [], ctx = makeCtx(s, hookOut);   // one ctx for the bot hooks (their out-events are dropped each step)
  while (!until(s)) {
    if (++steps > maxSteps) throw new Error(`runBot: no progress after ${maxSteps} steps (${s.clock.phase} day ${s.clock.day})`);
    const c0 = s.clock, y0 = c0.year, p0 = c0.phase, d0 = c0.day, m0 = c0.minute;
    let acted = 0;
    if (s.clock.phase === 'newgame') { act(s, { type: 'newgame/start' }, opts); continue; }
    while (s.story.dialog.length) { act(s, { type: 'story/dialogSeen', id: s.story.dialog[0].id }, opts); }
    for (let k = 0; s.story.cards.length && k < 50; k++) {
      const c = s.story.cards[0];
      const choice = P.answer?.(c, s) ?? c.data.defaultChoice ?? c.data.choices?.[0]?.id;
      const r = act(s, { type: 'card/answer', id: c.id, choice }, opts);
      if (!r.ok) throw new Error(`runBot: card ${c.kind} refused ${choice}: ${r.reason}`);
      acted++;
    }
    hookOut.length = 0;
    for (const m of BOT_MODULES) {
      const out = m.bot(s, ctx, P);
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
const ORDER = { newgame: 0, grow: 1, october: 1, weighoff: 2, halloween: 3, winter: 4 };
export function targetFn(target) {
  const m = /^y(\d+)-([a-z]+)(\d*)$/i.exec(String(target).trim());
  if (!m) throw new Error(`jump: bad target ${target}`);
  const year = +m[1], word = m[2].toLowerCase(), num = m[3];
  if (!num) {
    if (!(word in ORDER)) throw new Error(`jump: unknown phase ${word}`);
    return (s) => s.clock.year > year || (s.clock.year === year && ORDER[s.clock.phase] >= ORDER[word]);
  }
  const day = dayOf(word[0].toUpperCase() + word.slice(1) + ' ' + num);
  const weekend = day >= dayOf('Oct 1') && isWeekend(day);
  return (s) => {
    if (s.clock.year !== year) return s.clock.year > year;
    if (ORDER[s.clock.phase] > 1) return true;
    if (s.clock.phase === 'newgame' || s.clock.day < day) return false;
    return !weekend || s.clock.day > day || s.clock.minute === OPEN;
  };
}

// Run the balanced bot from s (or a fresh game) to the target, then hand over. Returns s.
export function jumpTo(s, target, policy = 'balanced') {
  if (s.clock.phase === 'newgame') dispatch(s, { type: 'newgame/start' });
  return runBot(s, policy, targetFn(target));
}

// Convenience for tools and tests: a fresh game run for N years.
export function runYears(seed, years, policy = 'balanced', opts = {}) {
  const s = startGame({ seed, ...opts.game });
  runBot(s, policy, (x) => x.clock.year > years || (x.clock.year === years && x.clock.phase === 'winter'), opts);
  return s;
}
