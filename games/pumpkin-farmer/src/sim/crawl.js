// [C] The first tape, in public (plan §3.13 lean, rulings R0, R4, R5): the Vine Crawl on Aug 1 of year 1, and Edna's Sunday
// tape every week after it.
//
// What the player should feel, step by step:
//   The Crawl (Aug 1)   "The whole Cove came. For me." Hal is live on the radio; Vance and Big Tom lean on the fence and
//                       call her weight by eye (Tom always far too high, Vance close-ish); you knock if you like (a deep
//                       knock means she'll tape heavier than she looks: the one good hint, nobody gives an answer key),
//                       pick a range, then PULL THE TAPE: the inches count up, it converts to pounds, and you see who
//                       was right. The ladder's first rung lands ("She outweighs the dog"). No rigs, no review, no buzz.
//   Sunday tapes        Measuring stops being a chore: Edna tapes her every Sunday for the Crier (a moment in the queue),
//                       which moves the sign, the pace line and the ladder for everyone. Your own Measure is still there,
//                       every few days, for when you can't wait.
//
// State: s.crawl = { year, step: null | 'guess' | 'taped' | 'done', guesses: [{ who, n }], pick, tape: { ott, est } | null,
//   range: [a, b], right, closest, review: null, ribbons: [], gags: [] } (review, ribbons and gags: Wave 2, kept for the save).
// Actions: crawl/pull { pick } (PULL THE TAPE while the card is up: takes the real tape, the card stays for the reveal).
// Card: 'crawl' { title, eyebrow, speaker, text, hal, guesses, range, choices: under | mid | over, defaultChoice: 'mid' }.
// Out-events: crawl/tape { ott, est, right, closest, guesses, pick, range } (the reveal), giant/measure(d) (the tape).
// Moments: Edna's Sunday tape is a toast moment (the number; the Crawl's reveal explains it once, in Edna's own words).
import { T } from './tuning.js';
import { dayOf, dow } from './calendar.js';
import { makeRng, gauss, next } from './rng.js';
import { hash32, fill, clamp } from './util.js';
import { line } from './story.js';
import { CL } from './lines-giant.js';
import { tape, takeTape, hasFruit, alive, knockPitch, commas, pace, GLIDE } from './giant.js';

const TC = T.crawl, D = dayOf;
const fail = (reason) => ({ ok: false, reason });

// ------------------------------------------------------------ the guesses (keyed: never the rivals stream)
// A rival's eyeball: est x (1 + bias + sd x z). Vance's error is partly her density (T.crawl.guess.look): a dense one sits
// low and looks small, so a deep knock (knockPitch < 1) means the tape will come out over his line.
function guesses(s, p, est) {
  const G = TC.guess, z = (k) => gauss(makeRng(hash32(s.seed, s.clock.year, 'crawl', k)));
  const zr = clamp((p.secret.rho - 1) / T.giant.knock.rhoSd, -3, 3), rd = (x) => Math.max(G.round, Math.round(x / G.round) * G.round);
  const v = rd(est * (1 + G.vance[0] + G.vance[1] * (-G.look * zr + Math.sqrt(1 - G.look ** 2) * z('vance'))));
  const t = rd(est * (1 + G.tom[0] + G.tom[1] * z('tom')));
  return [{ who: 'vance', n: v }, { who: 'tom', n: t }];
}
const rangeOf = (v) => { const r = TC.guess.round, rd = (x) => Math.max(r, Math.round(x / r) * r); return [rd(v * TC.range[0]), rd(v * TC.range[1])]; };
export const pickRight = (pick, [a, b], est) => (pick === 'under' ? est < a : pick === 'over' ? est > b : est >= a && est <= b);

function crawlCard(s, ctx) {
  const p = s.giant, { est } = tape(s, p), gs = guesses(s, p, est), [a, b] = rangeOf(gs[0].n), C = CL.crawl;
  s.crawl = { year: s.clock.year, step: 'guess', guesses: gs, pick: null, tape: null, range: [a, b], right: null, closest: null,
    review: null, ribbons: [], gags: [] };
  ctx.card('crawl', {
    title: C.title, eyebrow: C.eyebrow, speaker: 'edna', hal: C.hal,
    text: fill(C.text, { v: commas(gs[0].n), t: commas(gs[1].n) }),
    guesses: gs.map((g) => ({ ...g, speaker: g.who, line: fill(C[g.who], { n: commas(g.n) }) })),
    range: [a, b], knock: C.knock, knockSub: C.knockSub, tapeLine: C.tape, pull: C.pull,
    choices: [{ id: 'under', label: fill(C.under, { a: commas(a) }) }, { id: 'mid', label: fill(C.mid, { a: commas(a), b: commas(b) }) },
      { id: 'over', label: fill(C.over, { b: commas(b) }) }],
    defaultChoice: 'mid',
  });
}

// PULL THE TAPE: the real tape (the year's first measures entry), and the reveal: who was within T.crawl.green, who was
// closest, and whether your range held it.
function pull(s, ctx, pick) {
  const c = s.crawl, p = s.giant;
  if (c.tape) return c.tape;
  c.pick = ['under', 'mid', 'over'].includes(pick) ? pick : 'mid';
  const r = takeTape(s, ctx, p, 'crawl'), est = r.est, near = (n) => Math.abs(n - est) <= TC.green * est;
  c.right = pickRight(c.pick, c.range, est);
  const mid = (c.range[0] + c.range[1]) / 2, you = c.pick === 'under' ? c.range[0] : c.pick === 'over' ? c.range[1] : mid;
  const all = [...c.guesses.map((g) => ({ who: g.who, n: g.n })), { who: 'you', n: you }];
  c.closest = c.right ? 'you' : all.sort((x, y) => Math.abs(x.n - est) - Math.abs(y.n - est))[0].who;
  c.tape = { ott: r.ott, est, green: Object.fromEntries(c.guesses.map((g) => [g.who, near(g.n)])) };
  c.step = 'taped';
  const C = CL.crawl, vanceNear = c.tape.green.vance;
  const verdict = c.right ? C.right : fill(vanceNear ? C.wrong : C.nobody, { est: `${commas(est)} lb` });
  ctx.emit({ type: 'crawl/tape', ott: r.ott, est, right: c.right, closest: c.closest, pick: c.pick, range: c.range,
    guesses: c.guesses, green: c.tape.green, verdict, pace: r.pace });
  return c.tape;
}

// The ladder's first rung (rulings R0): through track D's firsts.tape when it is there, else its marks (the foundation's seam).
function ladder(s, ctx, est, mine) {
  const F = ctx.mod('firsts');
  if (F?.tape) return F.tape(s, ctx, { mine, est });
  const crossed = T.firsts.ladder.filter(([lb, id]) => est >= lb && !s.firsts?.career?.[id]).map(([, id]) => id);
  for (const id of crossed) F?.mark?.(s, ctx, id, { mine, lb: Math.round(est), silent: id !== crossed.at(-1) });
  return crossed.at(-1) ?? null;
}

// ------------------------------------------------------------ Edna's Sunday tape (rulings R4)
// Every Sunday after the Crawl (years 2+: from Aug 1), unless the last tape is fresher than skipWithin days. The tape itself
// happens that morning, whatever else is going on (late summer's lessons sit 25 s apart and leave the queue few windows): the
// sign, the chart, the pace line and the ladder move for everyone. Edna's line is a moment in the queue (kind 'tape'); if
// no quiet window comes for it, the tape still happened.
const sunday = (d) => dow(d) === 0;
function sundayDue(s) {
  const g = s.giant, d = s.clock.day;
  if (s.clock.phase !== 'grow' || !sunday(d) || !s.unlocks.measure || !alive(g)) return false;
  if (s.clock.year === 1 ? s.story.beats['crawl.crawl'] === undefined : d < D(T.story.y1.crawl)) return false;
  const last = g.measures.at(-1);
  return !last || d - last.day >= TC.sunday.skipWithin;
}

// ------------------------------------------------------------ bots: how a bot guesses (bots.js wraps every policy's answer)
// P.crawlGuess: 'mid' (the card's default) | 'knock' (reads the knock: deep -> over, hollow -> under) | 'blind' (keyed coin)
export function botChoice(c, s, P) {
  if (c.kind !== 'crawl' || !P.crawlGuess || P.crawlGuess === 'mid') return undefined;
  if (P.crawlGuess === 'blind') return ['under', 'mid', 'over'][Math.floor(next(makeRng(hash32(s.seed, s.clock.year, 'blindGuess'))) * 3)];
  const k = knockPitch(s, s.giant, TC.hush), th = TC.knockRead;   // the Crawl's hushed knock, as the player hears it
  return k < 1 - th ? 'over' : k > 1 + th ? 'under' : 'mid';
}

export default {
  id: 'crawl',
  // (the save v4 migration's shape: the Crawl's card fills in tape, range, right and closest when it comes)
  init(s) { s.crawl = { year: 0, step: null, guesses: [], pick: null, review: null, ribbons: [], gags: [] }; },
  dayStart(s, ctx) {
    if (!sundayDue(s)) return;
    const p = s.giant, prev = p.measures.at(-1), first = !p.measures.some((x) => x.by === 'edna'), r = takeTape(s, ctx, p, 'edna');
    const delta = prev ? r.est - prev.est : 0;
    ladder(s, ctx, r.est, false);                     // a rung it crossed waits for its own window (track D's Firsts)
    // the number is news, not a scene: a low-salience toast that never takes one of late summer's few quiet windows
    const text = ctx.fresh('edna.sunday', CL.sunday, makeRng(hash32(s.seed, s.clock.year, s.clock.day, 'sunday')));
    ctx.moment({ id: `tape:${s.clock.year}:${s.clock.day}`, kind: 'toast', maxWaitDays: TC.sunday.wait, data: { est: r.est, delta, first },
      toast: { text: line(s, text, { est: `${commas(r.est)} lb`, delta: `${delta >= 0 ? '+' : '−'}${commas(Math.abs(delta))} lb` }), icon: 'scale', cls: 'good' } });
  },
  beats: [
    // the Vine Crawl replaces Edna's Aug 1 tape lesson (order 10): the beat is the card, and the card brings the tape
    { id: 'crawl.crawl', year: 1, order: 10, at: T.story.y1.crawl,
      when: (s) => s.clock.phase === 'grow' && s.clock.day >= D(T.story.y1.crawl) && hasFruit(s.giant) && alive(s.giant),
      run(s, ctx) {
        ctx.unlock('measure');
        // the bug lesson's deadline was the Crawl ("squish 'em by the Vine Crawl"): its goal lets go here, quietly
        ctx.goalLapse('bugs', false);
        crawlCard(s, ctx);
        s.story.replay['crawl.crawl'] = { speaker: 'edna', lines: [CL.crawl.tape] };
        ctx.emit({ type: 'glide', ...GLIDE });
      } },
  ],
  actions: {
    'crawl/pull': (s, a, ctx) => {
      if (s.crawl?.step !== 'guess' && s.crawl?.step !== 'taped') return fail('no Vine Crawl today');
      if (!s.story.cards.some((c) => c.kind === 'crawl')) return fail('no Vine Crawl today');
      const tp = pull(s, ctx, a.pick);
      return { ok: true, ott: tp.ott, est: tp.est, right: s.crawl.right, closest: s.crawl.closest, pace: pace(s, s.giant) };
    },
  },
  cards: {
    crawl(s, card, choice, ctx) {
      const c = s.crawl;
      if (!c || c.step === 'done') return;
      if (!c.tape) pull(s, ctx, choice);                 // a bot (or a tap outside) answers without pulling first
      c.step = 'done';
      if (c.right) ctx.stamp('eagleEye');
      ladder(s, ctx, c.tape.est, true);
      ctx.say('gran', [CL.crawl.gran]);                 // (Edna's Sunday-tape promise is in the card's reveal)
      return { est: c.tape.est, right: c.right };
    },
  },
  summary(s) { return { crawlRight: s.crawl?.right ? 1 : 0 }; },
};
