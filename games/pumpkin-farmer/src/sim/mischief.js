// [Track A] Visitors: the Cove notices your farm (plan §3.2, §3.3; rulings R4, R5, R15, R16). Biscuit digs up Grandpa's old
// biscuit tin, a harbor seal naps in the pea soup, an otter floats by with her pup, a possum plays dead in a grey-day row,
// skunks shelter under your sail in the heat, and Pamela from next door hops the fence on sunny days. Each is a delight in
// the lane (events.js): caused by the weather or the farm, a ✦ pin over it, a camera moment when you tap it, and a "left
// alone" outcome that is always fine.
//
// What the player should feel, and what makes it so (tests/sim/dropins.test.js, pamela.test.js, balance/mischief.test.js):
//   Apr 7-12  Biscuit trots out of the bramble with a rusty tin: "oh, the dog!" Tap: Gran on Grandpa's biscuit tin, and
//             his first note (track D's find). The ✦ is learned on something lovely, with nothing to manage.
//   fog       a seal on the beach (or in a damp aisle, or by the giant) only in pea soup or rain, and she leaves when
//             Marlene lifts: "who's that? oh, it's foggy". Tap: she barks, and her coat goes in the book (5 to meet).
//   sun       Pamela hops the fence only when Marlene's out (f < 0.45). The bubble's two buttons look the same; grazing
//             the bramble shows at once (its lumps vanish, Gran says how much of the row is clear) and takes $50 a day off
//             that row in the winter shop; whistling sends Biscuit to walk her home. Year 1 she only finds the bramble and
//             the washing line (nothing she does hurts a row or the giant in year 1, rulings R5, R16), so in year 1 the
//             choice is flavour (graze is the better deal and says so); from year 2 rows and the giant are on her menu and
//             the bubble says plainly what she'll eat, so reading it is the skill.
//   grey day  a possum keels over in a planted row; she insists she is dead. Year 1 there's no bubble (rulings R5): tap,
//             her line, the joeys wave. Once bugs are unlocked her joeys herd them off that row while she rests.
//   heat      skunks under the sail you raised: "I did the right thing, and the world noticed". Lower the sail on them
//             (or sound three foghorns) and the corner is skunked for a week.
// Nothing here drops the speed; Skip stops at each delight (its event carries pin: true).
//
// State: s.mischief = { pin: { id, x, y, z, label, until1x } | null (the ✦, events.js), visit: { id, x, z, day, ... } |
//   null (the one visitor on screen besides Pamela), met: { [id]: { y, n } }, coats: [coat ids you've met], clips: [],
//   skunkedUntil (day), iou, look: { id, x, y, z, day } | null (the swarm on the scarecrow), porch: { day, kind } | null,
//   pamela: { visit: { spot, row, x, z, day, days, choice, drift } | null, goatDays: { [row]: n }, escapes (this year),
//   fullUntil (day), shawl (this year: she ate it) } }.
// Out-events: { type: 'mischief/look', id, x, z } (a ✦ tap: the visitor's one animation), { type: 'mischief/leave', id, x, z,
//   why }, { type: 'mischief/whistle', x, z }, { type: 'mischief/startle', x, z }, plus toasts and dialogue.
// Exports: startle(s, ctx, cause), brambleGrazed(s, r), priceCut(s, r), whoToExpect(s, f), botChoice(card, s, P).
import { T } from './tuning.js';
import { dayOf, monthOf } from './calendar.js';
import { rowZ, aisleZ, MISCHIEF_ENTRY } from './layout.js';
import { makeRng, next, weighted } from './rng.js';
import { hash32, fill } from './util.js';
import { catalogue, fireNow, slotNear } from './events.js';
import { line, fresh, quietForChatter } from './story.js';
import { hurt, bugSpot, yieldOf } from './patch.js';
import { addScar, alive, tipDue, tipDoze } from './giant.js';
import { find } from './pokes.js';
import { LINES as ML, COATS, COAT_WORDS, FRACTIONS } from './lines-mischief.js';

const M = T.mischief, PM = M.pamela, SPOT = MISCHIEF_ENTRY.spots;
const grows = (s) => s.clock.phase === 'grow';
const inMonths = (s, months) => months.includes(monthOf(s.clock.day));
const yr = (arr, s) => arr[Math.min(s.clock.year, arr.length) - 1];
// keyed dice (a hash of seed, year, day and what for): visitors never move a stream, so the farm under them plays the same
const u = (s, ...k) => next(makeRng(hash32(s.seed, s.clock.year, s.clock.day, 'mischief', ...k)));
const keyed = (s, ...k) => makeRng(hash32(s.seed, s.clock.year, s.clock.day, 'mischief', ...k));
const say = (s, ctx, key, list, rng = keyed(s, key)) => line(s, fresh(s, rng, key, list));
const toast = (ctx, text, icon = 'sparkle', cls = 'event') => ctx.emit({ type: 'toast', text, cls, icon });
const metThisYear = (s, id) => s.mischief.met[id]?.y === s.clock.year;
function meet(s, id) { const m = (s.mischief.met[id] ||= { y: 0, n: 0, first: s.clock.year }); m.y = s.clock.year; m.n++; return m.n === 1; }
const rowsOf = (s) => s.patch?.rows || [];
const growingRow = (row) => row?.open && row.plantedDay != null && ['sprouts', 'vines', 'flowers', 'green'].includes(row.stage);
const at = (x, z, y = 0.6) => ({ x, y, z });

// The visitor leaves (her own way, or startled): the ✦ goes with her if it is still up (she was seen, not met).
function endVisit(s, ctx, why, text) {
  const v = s.mischief.visit;
  if (!v) return;
  s.mischief.visit = null;
  if (s.mischief.pin?.id === v.id) s.mischief.pin = null;
  ctx.emit({ type: 'mischief/leave', id: v.id, x: v.x, z: v.z, why });
  if (text) toast(ctx, text, 'sparkle', '');
}

// ------------------------------------------------------------ the visitors (delights in the lane: events.js)
const visitor = (o) => ({ cls: 'delight', per: 'day', visit: true, ...o });
const EVENTS = [
  // Biscuit's dig (slot A in year 1, Apr 7-12): Grandpa's old biscuit tin of notes (rulings R15). He digs on a dry morning,
  // or the morning after rain when the ground is soft (not in the rain itself: that keeps him on the porch; the slot's
  // last chance doesn't wait). Years 2+: now and then in spring he digs up something silly (the wider finds pool is Wave 2).
  visitor({
    id: 'biscuit_dig', capYear: 2, capByYear: [1, 2], cooldownDays: 20,
    when: (s) => grows(s) && (s.clock.year === 1 || inMonths(s, M.dig.months)) && digCause(s) != null,
    base: (s) => grows(s) && (s.clock.year === 1 || inMonths(s, M.dig.months)),
    rate: (s) => (s.clock.year === 1 ? 0 : M.dig.rate),
    cause: (s) => digCause(s),
    text: (s) => ML.dig.arrive,
    fire(s) {
      const p = SPOT.bramble;
      s.mischief.visit = { id: 'biscuit_dig', x: p.x, z: p.z, day: s.clock.day, tin: s.clock.year === 1 && !s.mischief.met.biscuit_dig };
      meet(s, 'biscuit_dig');
      return { at: at(p.x, p.z, 0.7), label: 'Biscuit' };
    },
    look(s, ctx) {
      const v = s.mischief.visit, tin = v?.tin;
      if (v) v.until = s.clock.day + 1;                              // he trots off with it in the morning (the camera saw it)
      if (tin) {
        const id = ctx.say('gran', ML.dig.tin, { pause: true });
        find(s, ctx, 'dig', { mine: true });                         // (track D: the note answers the tap, shown at once)
        return { dialog: id };
      }
      return { caption: say(s, ctx, 'dig.later', ML.dig.later) };
    },
    leftAlone(s, ctx) {
      const tin = s.mischief.visit?.tin;
      endVisit(s, ctx, 'porch');
      s.mischief.porch = { day: s.clock.day + 1, tin: !!tin };      // he leaves it on the porch next morning (same result)
    },
  }),
  // The harbor seal (plan §3.2): pea soup or rain; she naps on the beach, in a planted row's damp aisle, or by the giant
  // when the sail is down; Biscuit sits guarding her; she stays until Marlene lifts (2-6 days). Tap: her coat is logged.
  visitor({
    id: 'seal_haulout', needs: ['marlene'], cooldownDays: M.seal.cooldown, capYear: Math.max(...M.seal.cap), capByYear: M.seal.cap,
    when: (s) => grows(s) && (s.weather.f >= M.seal.f || !!s.weather.rain),
    rate: (s) => (s.weather.rain ? M.seal.rateRain : M.seal.rate),
    cause: (s) => (s.weather.rain ? 'rain' : s.weather.f >= M.seal.f ? 'fog' : null),
    text: (s) => sealText(s),
    fire(s, ctx) {
      const coat = sealCoat(s), spot = sealSpot(s);
      s.mischief.visit = { id: 'seal_haulout', x: spot.x, z: spot.z, day: s.clock.day, coat, spot: spot.kind, row: spot.row ?? null };
      // Hal announces the first one ever on the radio; the cause is real (pea soup or rain), never a fallback's claim (R4)
      if (meet(s, 'seal_haulout') && s.clock.year === 1) ctx.say('hal', [s.weather.rain ? ML.seal.firstRain : ML.seal.first]);
      return { at: at(spot.x, spot.z, 0.7), label: 'A seal' };
    },
    look(s, ctx) {
      const v = s.mischief.visit;
      ctx.emit({ type: 'sound', name: 'bark', pitch: 0.7 });
      if (!v?.coat) return {};
      const first = !s.mischief.coats.includes(v.coat);
      if (first) s.mischief.coats.push(v.coat);
      const coat = COAT_WORDS[v.coat] || v.coat;
      return { caption: fill(first ? ML.seal.met : ML.seal.again, { coat, n: s.mischief.coats.length }) };
    },
  }),
  // The otter and her pup float in the cove on a clear spring day; Biscuit loses his mind on the shore.
  visitor({
    id: 'otter_look', cooldownDays: 20, capYear: 2,
    when: (s) => grows(s) && inMonths(s, M.otter.months) && s.weather.f < M.otter.f,
    base: (s) => grows(s),
    rate: () => M.otter.rate,
    cause: (s) => (inMonths(s, M.otter.months) && s.weather.f < M.otter.f ? 'clear' : null),
    text: () => ML.otter.look,
    fire(s) {
      const p = SPOT.cove;
      s.mischief.visit = { id: 'otter_look', x: p.x, z: p.z, day: s.clock.day };
      meet(s, 'otter_look');
      return { at: at(p.x, p.z, -0.2), label: 'An otter' };
    },
    look(s, ctx) { const v = s.mischief.visit; if (v) v.until = s.clock.day + 1; return { caption: ML.otter.wave }; },
    leftAlone(s, ctx) { endVisit(s, ctx, 'gone', ML.otter.leave); },
  }),
  // The possum plays dead (plan §3.2; rulings R5): a grey day, a planted row (the buggiest one). Year 1: no bubble; years
  // 2+: let her rest (her joeys herd bugs off the row) or ask what's in her pouch. Year 1's first visit is slot E (Jul 9-11),
  // before the bugs lesson, so it never shields; later visits do once bugs are unlocked.
  visitor({
    id: 'possum_nap', needs: ['patch'], cooldownDays: M.possum.cooldown, capYear: Math.max(...M.possum.cap), capByYear: M.possum.cap,
    when: (s) => grows(s) && s.weather.f >= M.possum.f && possumRow(s) != null && possumReady(s),
    base: (s) => grows(s) && possumReady(s),
    rate: (s) => M.possum.rate * (rowsOf(s).some((r) => r.bugs > 0) ? M.possum.bugsMul : 1),
    // (a grey day brings her; a planted row is where she plays dead, else "by the patch", slot E's fallback on a bare farm)
    cause: (s) => (rowsOf(s).some((r) => r.bugs > 0) ? 'bugs' : s.weather.f >= M.possum.f ? 'grey' : null),
    text: (s) => { const v = s.mischief.visit; return v?.row != null ? fill(ML.possum.arrive, { r: v.row + 1 }) : ML.possum.arriveBare; },
    fire(s, ctx) {
      const r = possumRow(s), x = r != null ? bugSpot(r) + 1.4 : 1.2, z = r != null ? aisleZ(r) + 0.15 : -2.3;
      s.mischief.visit = { id: 'possum_nap', x, z, day: s.clock.day, until: s.clock.day + M.possum.stay, row: r, rest: true, told: false };
      if (meet(s, 'possum_nap')) ctx.say('gran', [ML.possum.first]);
      shield(s, ctx);
      return { at: at(x, z, 0.5), label: 'A possum' };
    },
    look(s, ctx) {
      const v = s.mischief.visit;
      if (s.clock.year > 1 && v?.row != null) { possumCard(s, ctx, v); return {}; }
      return { dialog: ctx.say('possumMom', [say(s, ctx, 'possum.dead', ML.possum.dead)], { pause: true }) };
    },
  }),
  // Skunks under the sail (plan §3.2): a heat day (or nearly no fog) with the sail up. They leave when the heat breaks;
  // lowering the sail on them, three foghorns or Pamela wandering over startles them (the corner is skunked for a week).
  visitor({
    id: 'skunk_shade', needs: ['shade'], cooldownDays: M.skunks.cooldown, capYear: M.skunks.cap, chain: 'heat_wave',
    when: (s) => grows(s) && !!s.giant?.shade && (!!s.weather.heat || s.weather.f < M.skunks.f),
    rate: () => M.skunks.rate,
    cause: (s) => (s.giant?.shade && (s.weather.heat || s.weather.f < M.skunks.f) ? 'heat' : null),
    text: () => ML.skunks.arrive,
    fire(s) {
      const p = SPOT.sail;
      s.mischief.visit = { id: 'skunk_shade', x: p.x, z: p.z, day: s.clock.day };
      return { at: at(p.x, p.z, 0.6), label: 'Skunks' };
    },
    look(s, ctx) {
      if (meet(s, 'skunk_shade')) return { dialog: ctx.say('gran', [ML.skunks.first], { pause: true }) };
      return { caption: say(s, ctx, 'skunks.look', ML.skunks.look) };
    },
  }),
  // Pamela's summer (plan §3.3; rulings R5, R16)
  {
    id: 'pamela', cls: 'delight', per: 'day', needs: ['patch'], capYear: Math.max(...PM.cap), capByYear: PM.cap,
    when: (s) => pamelaFree(s) && s.weather.f < PM.f,
    base: (s) => pamelaFree(s),
    rate: () => PM.rate,
    // the sun brings her (Marlene's out); her first escape of year 1 is slot C's, for the bramble whatever the weather (plan
    // §6.2: "slot C aside"): the bramble row is the farm state that brings her, and her bubble's title names it
    cause: (s) => (s.weather.f < PM.f ? 'sun' : s.clock.year === 1 && !s.mischief.pamela.escapes && brambleRow(s) != null ? 'bramble' : null),
    text: (s) => pamelaTitle(s),
    fire(s, ctx) {
      const P = s.mischief.pamela, spot = pamelaSpot(s), pos = pamelaPos(s, spot);
      P.visit = { spot: spot.kind, row: spot.row ?? null, x: pos.x, z: pos.z, day: s.clock.day, days: 0, choice: null, drift: spot.drift ?? null };
      P.escapes++;
      if (meet(s, 'pamela')) ctx.say('gran', [ML.pamela.first]);
      return { at: at(pos.x, pos.z, 0.9), label: 'Pamela!' };
    },
    look(s, ctx) { if (s.mischief.pamela.visit) pamelaCard(s, ctx); return {}; },
    leftAlone(s, ctx) { const v = s.mischief.pamela.visit; if (v && !v.choice) pamelaChoose(s, ctx, pamelaDefault(v), true); },
  },
];

// ------------------------------------------------------------ Biscuit's dig
function digCause(s) {
  if (s.weather.rain) return null;
  if ((s.weather.days[s.clock.day - 1]?.rain)) return 'soft';
  return s.weather.f < M.dig.dryF ? 'dry' : null;
}

// ------------------------------------------------------------ the seal
function sealCoat(s) {
  const met = new Set(s.mischief.coats);
  return weighted(keyed(s, 'coat'), COATS.map((c) => [c, met.has(c) ? 1 : M.seal.newCoat]));
}
function sealSpot(s) {
  const g = s.giant;
  if (g && !g.shade && alive(g) && s.unlocks.patch && u(s, 'sealGiant') < 0.35) return { kind: 'giant', ...SPOT.giantSide };
  const rows = rowsOf(s).map((r, i) => [r, i]).filter(([r]) => growingRow(r));
  if (rows.length && s.unlocks.patch && u(s, 'sealRow') < 0.5) { const [, i] = rows[Math.floor(u(s, 'sealRowI') * rows.length)]; return { kind: 'row', row: i, x: 6.0, z: aisleZ(i) + 0.1 }; }
  return { kind: 'beach', ...SPOT.beach };
}
function sealText(s) {
  const v = s.mischief.visit;
  if (v?.spot === 'row') return fill(ML.seal.row, { r: v.row + 1 });
  return v?.spot === 'giant' ? ML.seal.giant : ML.seal.beach;
}
// she stays at least stay[0] days, then leaves the first morning Marlene lifts (f < liftF), and at most stay[1] days
function sealDay(s, ctx, v) {
  const n = s.clock.day - v.day;
  if ((n >= M.seal.stay[0] && s.weather.f < M.seal.liftF && !s.weather.rain) || n >= M.seal.stay[1]) endVisit(s, ctx, 'lift', ML.seal.leave);
}

// ------------------------------------------------------------ the possum
// year 1: her first visit is slot E's (Jul 9-11); years 2+: any grey day
const possumReady = (s) => s.clock.year > 1 || s.clock.day >= dayOf(T.lane.y1.slots.E[0][0]);
function possumRow(s) {
  const rows = rowsOf(s).map((r, i) => [r, i]).filter(([r]) => growingRow(r));
  if (!rows.length) return null;
  const buggy = rows.filter(([r]) => r.bugs > 0).sort((a, b) => b[0].bugs - a[0].bugs);
  return buggy.length ? buggy[0][1] : rows[Math.floor(u(s, 'possumRow') * rows.length)][1];
}
// While she rests (bugs unlocked): her joeys herd that row's bugs off and no cluster starts there for shieldDays.
function shield(s, ctx) {
  const v = s.mischief.visit;
  if (v?.id !== 'possum_nap' || !v.rest || v.row == null || !(s.unlocks.bugs || s.clock.year > 1)) return;
  const row = rowsOf(s)[v.row];
  if (!row) return;
  row.shieldUntil = Math.max(row.shieldUntil || 0, s.clock.day + M.possum.shieldDays);
  if (row.bugs > 0) {
    row.bugs = Math.max(0, Math.round((row.bugs - M.possum.shrink) * 1000) / 1000);
    if (!v.told) { v.told = true; toast(ctx, ML.possum.shield, 'patch', 'good'); }
    if (row.bugs <= 0) ctx.emit({ type: 'patch/bugsCleared', row: v.row, by: 'possum' });
  }
}
function possumCard(s, ctx, v) {
  const bugs = !!(s.unlocks.bugs || s.clock.year > 1), r = v.row + 1;
  ctx.card('mischief', { kind: 'possum', title: fill(ML.possum.title, { r }), defaultChoice: 'rest', at: at(v.x, v.z, 0.5),
    choices: [{ id: 'rest', label: ML.possum.rest, sub: fill(bugs ? ML.possum.restSubBugs : ML.possum.restSub, { r }) },
      { id: 'ask', label: ML.possum.ask, sub: fill(ML.possum.askSub, { n: M.possum.coupon }) }] });
}
function possumAnswer(s, ctx, choice) {
  const v = s.mischief.visit;
  if (v?.id !== 'possum_nap') return;
  if (choice === 'ask') {
    ctx.say('possumMom', [ML.possum.asked]);
    if (!find(s, ctx, 'pouch', { mine: true })) { ctx.money(M.possum.coupon, 'gifts'); toast(ctx, fill(ML.possum.coupon, { n: M.possum.coupon }), 'coin', 'good'); }
    endVisit(s, ctx, 'ask');
    return;
  }
  v.rest = true;
  ctx.say('possumMom', [say(s, ctx, 'possum.dead', ML.possum.dead)]);
  shield(s, ctx);
}

// ------------------------------------------------------------ the skunks
function skunkStartle(s, ctx) {
  const v = s.mischief.visit;
  if (v?.id !== 'skunk_shade') return false;
  s.mischief.skunkedUntil = s.clock.day + M.skunks.skunkedDays;
  ctx.emit({ type: 'mischief/startle', x: v.x, z: v.z });
  endVisit(s, ctx, 'startle');
  toast(ctx, ML.skunks.startle, 'alert', 'warn');
  toast(ctx, ML.skunks.skunked, 'sparkle', '');
  return true;
}

// ------------------------------------------------------------ Pamela
const pamelaFrom = (s) => dayOf(yr(PM.from, s));
function pamelaFree(s) {
  const P = s.mischief.pamela;
  return grows(s) && !P.visit && s.clock.day >= pamelaFrom(s) && s.clock.day >= (P.fullUntil || 0) && pamelaSpots(s).length > 0;
}
// the lowest bramble row (Row 5 in year 1, then Row 6 once Row 5 is bought...), while it still has bramble to eat
function brambleRow(s) {
  const rows = rowsOf(s);
  for (let r = 0; r < rows.length; r++) if (!rows[r].open && (s.mischief.pamela.goatDays[r] || 0) < cutDays()) return r;
  return null;
}
const cutDays = () => Math.ceil(PM.discountCap / PM.discountPerDay);
// The spots she can pick right now, weighted (plan §3.3). Year 1: only the bramble and the washing line (rulings R5, R16).
function pamelaSpots(s) {
  const W = PM.weights, out = [], b = brambleRow(s), y1 = s.clock.year === 1;
  if (b != null) out.push([{ kind: 'bramble', row: b }, W.bramble]);
  if (!s.mischief.pamela.shawl) out.push([{ kind: 'washing' }, W.washing]);
  if (y1) return out;
  rowsOf(s).forEach((r, i) => {
    if (!growingRow(r)) return;
    if (r.stage === 'flowers') out.push([{ kind: 'row', row: i }, W.rowFlowers]);
    else if (r.stage === 'vines') out.push([{ kind: 'row', row: i }, W.rowVines]);
  });
  if (alive(s.giant) || (s.giant?.transplantDay != null && s.giant.stage !== 'tin')) {
    if ((s.mischief.skunkedUntil || 0) <= s.clock.day) out.push([{ kind: 'giant' }, W.giant]);
  }
  return out;
}
function pamelaSpot(s) {
  const P = s.mischief.pamela, list = pamelaSpots(s);
  // her first escape of year 1 is slot C's, into the bramble (plan §3.3)
  let spot = s.clock.year === 1 && P.escapes === 0 ? list.find(([x]) => x.kind === 'bramble')?.[0] : null;
  spot ||= weighted(keyed(s, 'pamelaSpot'), list) || { kind: 'washing' };
  // years 2+: a planted row next to the bramble she's in may tempt her (announced up front in the bubble)
  if (spot.kind === 'bramble' && s.clock.year > 1) { const n = spot.row - 1, nr = rowsOf(s)[n]; if (growingRow(nr)) spot = { ...spot, drift: n }; }
  return spot;
}
function pamelaPos(s, spot) {
  if (spot.kind === 'bramble') {
    const k = brambleGrazed(s, spot.row) / M.pamela.lumpsPerDay / cutDays();
    return { x: 5.6 - k * 13.5, z: rowZ(spot.row) - 0.3 };
  }
  if (spot.kind === 'row') return { x: -1.2 + u(s, 'pamelaX') * 4, z: rowZ(spot.row) };
  if (spot.kind === 'giant') return SPOT.giantSide;
  return { ...SPOT.washing };
}
function pamelaTitle(s) {
  const v = s.mischief.pamela.visit;
  return v ? fill(ML.pamela.title[v.spot], { r: (v.row ?? 0) + 1 }) : '';
}
// what a day of grazing there costs, in the bubble's words (computed from T so a retune can't make it lie)
const rowBite = (s, r) => Math.max(1, Math.round(yieldOf(rowsOf(s)[r]?.variety) * PM.rowHurt));
function grazeSub(s, v) {
  if (v.spot === 'bramble') return v.drift != null ? fill(ML.pamela.sub.drift, { r: v.drift + 1 }) : ML.pamela.sub.bramble;
  if (v.spot === 'row') return fill(ML.pamela.sub.row, { n: rowBite(s, v.row) });
  return ML.pamela.sub[v.spot];
}
// the "left alone" choice: she grazes where grazing is harmless, Biscuit walks her home from a row or the giant
const pamelaDefault = (v) => (v.spot === 'row' || v.spot === 'giant' ? 'whistle' : 'graze');
// Both buttons look the same (rulings R5): neither is styled primary; a tap outside is the left-alone choice. Pamela has her
// say in it, the only thing she ever says (plan §2.5): "Mehh."
function pamelaCard(s, ctx) {
  const v = s.mischief.pamela.visit;
  ctx.card('mischief', { kind: 'pamela', spot: v.spot, title: pamelaTitle(s), text: say(s, ctx, 'pamela.meh', ML.pamela.meh), defaultChoice: pamelaDefault(v), at: at(v.x, v.z, 0.9),
    choices: [{ id: 'graze', label: ML.pamela.graze, sub: grazeSub(s, v) }, { id: 'whistle', label: ML.pamela.whistle, sub: ML.pamela.whistleSub }] });
}
function pamelaChoose(s, ctx, choice, alone = false) {
  const v = s.mischief.pamela.visit;
  if (!v || v.choice) return;
  if (choice === 'whistle') { pamelaHome(s, ctx, 'whistle'); return; }
  v.choice = 'graze';
  grazeDay(s, ctx, !alone);                          // the payoff shows at once: lumps vanish, Gran says how much is clear
}
// One day of Pamela grazing her spot (at most maxDays). now: the player just chose it (Gran comments).
function grazeDay(s, ctx, now = false) {
  const P = s.mischief.pamela, v = P.visit;
  v.days++;
  if (v.spot === 'bramble') {
    P.goatDays[v.row] = Math.min(cutDays(), (P.goatDays[v.row] || 0) + 1);
    const pos = pamelaPos(s, v);
    v.x = pos.x; v.z = pos.z;
    const n = P.goatDays[v.row], frac = FRACTIONS[Math.min(FRACTIONS.length - 1, Math.round((n * PM.lumpsPerDay / ML_LUMPS) * 6))];
    if (n >= cutDays()) { ctx.say('gran', [fill(ML.pamela.cleared, { r: v.row + 1 })]); pamelaHome(s, ctx, 'full'); return; }
    if (now) ctx.say('gran', [fill(ML.pamela.clear, { r: v.row + 1, frac })]);
    else toast(ctx, ML.pamela.bit, 'patch', 'good');
  } else if (v.spot === 'row') {
    const row = rowsOf(s)[v.row];
    if (row && growingRow(row)) { hurt(s, row, PM.rowHurt, 'goat'); toast(ctx, fill(ML.pamela.ate, { n: rowBite(s, v.row), r: v.row + 1 }), 'patch', 'warn'); }
  } else if (v.spot === 'giant') {
    if (alive(s.giant)) addScar(s, s.giant, 'goat');
    if (s.mischief.visit?.id === 'skunk_shade') { skunkStartle(s, ctx); pamelaHome(s, ctx, 'skunks'); return; }
  } else if (v.spot === 'washing') {
    P.shawl = true;
    ctx.say('gran', [ML.pamela.shawl]);
    pamelaHome(s, ctx, 'full');
    return;
  }
  if (v.days >= PM.maxDays) pamelaHome(s, ctx, 'full');
}
const ML_LUMPS = 18;                                 // render/patch.js BRAM: a bramble row's lumps
// She goes home (Biscuit walks her, she's full, the bees or a foghorn sent her): the cooldown is longer after a feast.
function pamelaHome(s, ctx, why) {
  const P = s.mischief.pamela, v = P.visit;
  if (!v) return;
  P.visit = null;
  if (s.mischief.pin?.id === 'pamela') s.mischief.pin = null;
  P.fullUntil = s.clock.day + (v.days >= PM.fullDays ? PM.cooldown[1] : PM.cooldown[0]);
  if (why === 'whistle') ctx.emit({ type: 'mischief/whistle', x: v.x, z: v.z });
  ctx.emit({ type: 'mischief/leave', id: 'pamela', x: v.x, z: v.z, why });
  const text = { whistle: ML.pamela.home, full: ML.pamela.full, bees: ML.pamela.bees, foghorn: ML.pamela.foghorn, skunks: ML.pamela.skunks, gone: ML.pamela.gone }[why];
  if (text && !(why === 'full' && v.spot === 'washing')) toast(ctx, text, 'sparkle', why === 'whistle' ? 'good' : '');
}
// Each morning she's out: the bees may send her home on day 1 (a bee day with full hives), she may drift into the planted
// row next to the bramble (years 2+; the pin re-arms), and she grazes another day.
function pamelaDay(s, ctx) {
  const P = s.mischief.pamela, v = P.visit;
  if (!v || !v.choice || v.day === s.clock.day) return;
  const pa = s.patch;
  if (v.days === 1 && s.unlocks.hives && s.weather.f < T.patch.bees.f && pa && pa.honeyReady >= PM.beeFull * pa.hives * T.patch.hives.cap
    && u(s, 'bees') < PM.beeChase) { pamelaHome(s, ctx, 'bees'); return; }
  if (v.spot === 'bramble' && v.drift != null && growingRow(rowsOf(s)[v.drift]) && u(s, 'drift') < PM.drift) {
    const r = v.drift, pos = { x: 4.4, z: rowZ(r) };
    Object.assign(v, { spot: 'row', row: r, x: pos.x, z: pos.z, choice: null, drift: null });
    toast(ctx, fill(ML.pamela.drift, { r: r + 1 }), 'sparkle', 'warn');
    if (!s.mischief.pin) s.mischief.pin = { id: 'pamela', ...at(pos.x, pos.z, 0.9), label: 'Pamela!', until1x: s.clock.clock1x + T.lane.pinLife1x };
    return;
  }
  grazeDay(s, ctx);
}

// ------------------------------------------------------------ startles (the after hooks, and the foghorn poke)
// Something startled the farm ('foghorn': three foghorns; 'sail': the sail came down; 'pamela': she wandered over): Pamela
// goes home, the seal flumps off, the skunks leave in a huff and the corner is skunked for a week.
export function startle(s, ctx, cause) {
  const m = s.mischief;
  if (!m) return;
  if (cause === 'foghorn' && m.pamela.visit) pamelaHome(s, ctx, 'foghorn');
  if (cause === 'foghorn' && m.visit?.id === 'seal_haulout') { ctx.emit({ type: 'mischief/startle', x: m.visit.x, z: m.visit.z }); endVisit(s, ctx, 'startle', ML.seal.startle); }
  if (m.visit?.id === 'skunk_shade' && (cause === 'foghorn' || cause === 'sail' || cause === 'pamela')) skunkStartle(s, ctx);
}

// ------------------------------------------------------------ helpers other tracks read
// lumps of bramble row r Pamela has eaten (render/patch.js hides them, east end first)
export const brambleGrazed = (s, r) => Math.min(ML_LUMPS, (s?.mischief?.pamela?.goatDays?.[r] || 0) * PM.lumpsPerDay);
// dollars off bramble row r's shop price (economy.js priceOf; the winter shop says "Pamela cleared some")
export const priceCut = (s, r) => Math.min(PM.discountCap, (s?.mischief?.pamela?.goatDays?.[r] || 0) * PM.discountPerDay);
// The Almanac's "who to expect" (plan §6.2): a forecast day's weather word, and its visitor once met. f: the day's fog.
export function whoToExpect(s, d) {
  if (!s.unlocks.marlene || !d) return null;
  const F = ML.flags, met = (id) => !!s.mischief?.met?.[id];
  if (d.f >= M.seal.f || d.rain) return { id: 'soup', word: F.soup.word, who: met('seal_haulout') ? F.soup.who : null };
  // the days before it: what Marlene did (up to today), or what Hal forecasts (never the year's hidden weather)
  const fAt = (day) => (day <= s.clock.day ? s.weather.days[day]?.f : s.weather.forecast?.find((x) => x.day === day)?.f) ?? 0;
  const prev = [1, 2, 3].map((k) => fAt(d.day - k));
  if (d.f < M.swarm.clearF && prev.every((f) => f >= M.swarm.sulkF)) return { id: 'bees', word: F.bees.word, who: met('swarm') ? F.bees.who : null };
  if (d.f < PM.f) return { id: 'out', word: F.out.word, who: met('pamela') ? F.out.who : null };
  return null;
}
// How a bot answers a visitor's bubble (bots.js: P.pamela 'smart' | 'whistle' | 'graze', P.possum 'smart' | 'rest' | 'ask').
// Smart reads only what the bubble shows: the spot (a row or the giant means whistle), and whether the possum's row has bugs.
export function botChoice(card, s, P) {
  const k = card.data?.kind;
  if (k === 'pamela') {
    const p = P.pamela || 'smart';
    if (p === 'smart') return card.data.spot === 'row' || card.data.spot === 'giant' ? 'whistle' : 'graze';   // the title's spot
    return p;
  }
  if (k === 'possum') {
    const p = P.possum || 'smart', v = s.mischief?.visit;
    if (p === 'smart') return v?.row != null && rowsOf(s)[v.row]?.bugs > 0 ? 'rest' : 'ask';
    return p;
  }
  return undefined;
}

// ------------------------------------------------------------ Old Moss's tips and year 1's otter kelp, through the queue
// (f-notes: track A routes them through ctx.moment). A tip is due (giant.tipDue) -> a 'tip' moment, the lowest prio: it
// says its line when a quiet window comes. Year 1's kelp (Aug 18) is the otter's delivery, a delight moment that never
// waits behind chatter and is never lost (its drop fires it).
function kelpDue(s) {
  const d = s.clock.day, at0 = s.weather.script?.kelp, g = s.giant;
  if (s.clock.year !== 1 || at0 == null || d < at0 || s.events.year.kelp || !s.unlocks.feed || !alive(g)) return false;
  return !(g.creaking && s.story.beats['giant.creak'] === undefined);     // never on a creak Old Moss has yet to explain
}
function otterKelp(s, ctx) {
  if (s.events.year.kelp || !fireNow(s, ctx, 'kelp')) return;
  if (find(s, ctx, 'bottle', { mine: true })) toast(ctx, ML.otter.bottle, 'sparkle', 'event');   // (part of the beat showing)
}

// ------------------------------------------------------------ the module
const fresh0 = () => ({ pin: null, visit: null, met: {}, coats: [], clips: [], skunkedUntil: 0, iou: 0, look: null, porch: null,
  pamela: { visit: null, goatDays: {}, escapes: 0, fullUntil: 0, shawl: false } });
const fail = (reason) => ({ ok: false, reason });
export default {
  id: 'mischief',
  events: EVENTS,
  init(s) { s.mischief = fresh0(); },
  newYear(s) {
    const m = (s.mischief ||= fresh0());
    Object.assign(m, { pin: null, visit: null, look: null, porch: null, skunkedUntil: 0 });
    Object.assign(m.pamela, { visit: null, escapes: 0, fullUntil: 0, shawl: false });
    // a bramble row that was bought is no longer bramble: its goat-days are spent
    for (const r of Object.keys(m.pamela.goatDays)) if (s.patch?.rows?.[r]?.open) delete m.pamela.goatDays[r];
  },
  phase(s, ctx, from) {
    if (from !== 'grow' || !s.mischief) return;
    s.mischief.visit = null; s.mischief.look = null; s.mischief.pamela.visit = null;   // the summer's visitors go home
  },
  dayStart(s, ctx) {
    const m = s.mischief;
    if (!m || !grows(s)) return;
    m.look ??= null; m.porch ??= null;
    const v = m.visit;
    if (v?.id === 'seal_haulout') sealDay(s, ctx, v);
    else if (v?.id === 'possum_nap') { shield(s, ctx); if (s.clock.day >= v.until) endVisit(s, ctx, 'rested', ML.possum.leave); }
    else if (v?.id === 'skunk_shade' && !s.weather.heat && s.weather.f >= M.skunks.f) endVisit(s, ctx, 'cool', ML.skunks.leave);
    else if ((v?.id === 'biscuit_dig' || v?.id === 'otter_look') && v.until != null && s.clock.day >= v.until) endVisit(s, ctx, 'looked');
    pamelaDay(s, ctx);
    if (m.porch && s.clock.day >= m.porch.day) {
      const p = m.porch; m.porch = null;
      toast(ctx, p.tin ? ML.dig.porch : ML.dig.porchLater, 'sparkle', 'event');
      if (p.tin) find(s, ctx, 'porch');
    }
    // a tip joins the queue only on a morning that is quiet now (no lesson due, nothing waiting), so it shows today and never
    // sits in the queue holding back a toast-only lesson (the honey) or a slot's window
    const tipOk = !slotNear(s) && quietForChatter(s, ctx);
    if (tipOk && tipDue(s)) ctx.moment({ id: 'moss_tip', kind: 'tip', handler: 'mossTip', maxWaitDays: 0 });
    else if (tipOk && s.giant?.tipPending && s.clock.day >= s.giant.tipPending.day) ctx.moment({ id: 'moss_doze', kind: 'tip', handler: 'mossDoze', maxWaitDays: 0 });
    if (kelpDue(s)) ctx.moment({ id: 'otter_kelp', kind: 'delight', handler: 'otterKelp', maxWaitDays: 30, stop: true });
  },
  moments: {
    mossTip: { run(s, ctx) { if (tipDue(s)) fireNow(s, ctx, 'moss_tip'); } },
    mossDoze: { run(s, ctx) { tipDoze(s, ctx); } },
    otterKelp: { run: otterKelp, drop(s, ctx) { if (grows(s)) otterKelp(s, ctx); } },
  },
  after: {
    // lowering the sail on the skunks startles them; three foghorns (track D's lighthouse poke) startle everybody
    'giant/shade': (s, a, res, ctx) => { if (!s.giant?.shade) startle(s, ctx, 'sail'); },
    'world/poke': (s, a, res, ctx) => { if (a.id === 'lighthouse' && (a.burst ?? 1) >= 3) startle(s, ctx, 'foghorn'); },
  },
  actions: {
    // The ✦ tap (ui/mischief.js): the visitor plays its one animation and says its line, or opens its bubble. Returns where
    // to look ({ at, fit }) and what to show (caption, or the id of a dialogue line to wait for).
    'mischief/tap': (s, a, ctx) => {
      const pin = s.mischief?.pin;
      if (!pin) return fail('nothing there any more');
      const ev = catalogue(ctx.modules).find((e) => e.id === pin.id);
      s.mischief.pin = null;
      ctx.emit({ type: 'mischief/look', id: pin.id, x: pin.x, z: pin.z });
      const r = ev?.look?.(s, ctx, pin) || {};
      return { ok: true, id: pin.id, at: { x: pin.x, y: pin.y, z: pin.z }, fit: M.look[pin.id] ?? M.look.fit, caption: r.caption ?? null, dialog: r.dialog ?? null };
    },
  },
  cards: {
    mischief(s, card, choice, ctx) {
      if (card.data.kind === 'pamela') pamelaChoose(s, ctx, choice);
      else if (card.data.kind === 'possum') possumAnswer(s, ctx, choice);
    },
  },
  // Bots tap a share of the ✦ pins (P.mischief.taps, keyed so a replay taps the same ones); their bubbles are answered by
  // botChoice through each policy's answer (bots.js).
  bot(s, ctx, P) {
    const pin = s.mischief?.pin, taps = P.mischief?.taps ?? 0;
    if (pin && taps > 0 && !s.story.cards.length && u(s, 'tap', pin.id) < taps) return { type: 'mischief/tap' };
  },
};
export { EVENTS as DELIGHTS };
export const isVisiting = (s, id) => s.mischief?.visit?.id === id || (id === 'pamela' && !!s.mischief?.pamela?.visit);
