// Cash, the ledger, Gran's loan, the shop catalogue and hires (design §9).
//
// ctx.money(delta, cat) is the only way cash changes, so the ledger always explains the balance:
//   invariant (tested): sum(ledger.year.income) - sum(ledger.year.expense) === cash - ledger.year.cashStart
// The ledger year rolls when winter starts, so winter shopping counts against the year it is for.
//
// s.cash; s.loan = { owed, total, repaidPct, lentOn? (year * 400 + day of the last mid-season loan), warned? }; s.ledger = { year: { y, cashStart, income: {}, expense: {} }, history: [] }
// s.owned = { [item]: true | count | yearCoveredFor | { y, d } }; s.hires = { [who]: yearCoveredFor }
// Out-events: { type: 'cash', delta, cat }, { type: 'bought', item }, { type: 'hired', who, on }.
import { T } from './tuning.js';
import { round2, sum } from './util.js';
import { LINES } from './story.js';

const EC = T.economy;

// ------------------------------------------------------------ the catalogue (numbers live in T.shop / T.hires)
const TEXT = {
  row5: ['Clear Row 5', 'One more row next year. The bramble had a good run.'],
  row6: ['Clear Row 6', 'Another row out of the bramble.'],
  row7: ['Clear Row 7', 'The last of the bramble. The whole patch is yours.'],
  wagons: ['Wagons +4', 'Fewer families carrying pumpkins in their arms. Up to 14.'],
  loft: ['Barn loft', 'The barn holds 180 instead of 60.'],
  irrigation: ['Irrigation timer', 'Waters the patch when it dips under 35%. You still pay the bill.'],
  tape: ['Fancy tape', 'Measures to 0.2% instead of 0.6%.'],
  hive: ['Extra hive', 'More bees, more honey, a little more yield. Up to 6 hives.'],
  shadeMotor: ['Shade motor', 'Raises the sail when Hal calls heat. Hal is right 80% of the time.'],
  compost: ['Compost program', 'Yield x1.08; bugs and mildew x0.8. Paid each year.'],
  gravel: ['Gravel overflow lot', `+${T.season.parking.gravel} parking spaces. No sand in anyone's hubcaps.`],
  soaker: ['Soaker hose', 'The giant holds her water target. No sudden gulps, no split risk from them.'],
  plot2: ['Second giant plot', 'Two giants: sib crosses, selection, two entries.'],
  ring: ['Lifting ring', 'Every lift is Perfect (0.3% risk).'],
  floodlights: ['Floodlights', 'Night Watch: every other pair of eyes caught for you.'],
  billboard: ['Billboard on Route 46', 'More families over the ridge all year.'],
  cables: ['Soil-heating cables', 'Transplant and first flower a week earlier; a touch more potential.'],
  clubdb: ['Club database', "Seed cards show each line's % vs chart and creak rate."],
  radio: ['Radio spot', 'Hal talks you up all weekend. More families.'],
  shuttle: ['Shuttle from town', 'A quarter of arrivals from 11:00 need no parking. Per day.'],
  forklift: ['Forklift rental', 'Skip the lift (0.3% risk). Lightly sat on by the Weighmaster.'],
  dez: ['Dez, cashier', 'A raccoon. Rings up 1 family per 8 ticks. No Rush tips. Wanders off.'],
  bea: ['Bea, farmhand', 'A beaver. Overnight restock of 40 plus daytime trips. Never Sundays.'],
  howie: ['Howie, parking attendant', 'A coyote. +4 spaces, road patience x1.3. Howls at cars.'],
  mavis: ['Officer Mavis, night guard', "A possum (yes, that Mavis). Catches 80% of the Night Watch. Naps."],
  ladybug: ['Ladybug Lady, pest patrol', 'A fox. Clears bugs and mildew; keeps the bee bonus. Talks to ladybugs.'],
};
export const CATALOGUE = Object.fromEntries([
  ...Object.entries(T.shop).map(([id, n]) => [id, { id, kind: 'item', per: 'once', where: 'winter', max: 1, ...n, name: TEXT[id][0], desc: TEXT[id][1] }]),
  ...Object.entries(T.hires).map(([id, n]) => [id, { id, kind: 'hire', tab: 'hardware', per: 'season', where: 'winter', ...n, name: TEXT[id][0], desc: TEXT[id][1] }]),
]);

// [A] the bramble shop price (plan §3.3): every day Pamela grazed a bramble row takes T.mischief.pamela.discountPerDay off
// clearing it, up to discountCap a row ("Row 5 · $620 (Pamela cleared some)" in the winter shop).
export const BRAMBLE_ROW = { row5: 4, row6: 5, row7: 6 };
export function goatCut(s, id) {
  const r = BRAMBLE_ROW[id], PM = T.mischief.pamela;
  return r == null ? 0 : Math.min(PM.discountCap, (s.mischief?.pamela?.goatDays?.[r] || 0) * PM.discountPerDay);
}
export const priceOf = (s, id) => Math.max(0, (CATALOGUE[id]?.price ?? 0) - goatCut(s, id));

// The year a purchase made now is for: winter shopping is for next year.
export const forYear = (s) => (s.clock.phase === 'winter' || s.clock.phase === 'halloween' ? s.clock.year + 1 : s.clock.year);
// Is this item in effect this year? (Slices read it: has(s, 'loft'), has(s, 'compost'), hired(s, 'dez').)
export function has(s, id, year = s.clock.year) {
  const o = s.owned[id], it = CATALOGUE[id];
  if (!o) return false;
  if (it?.per === 'year') return o === year;
  return true;
}
export const count = (s, id) => (typeof s.owned[id] === 'number' && CATALOGUE[id]?.per !== 'year' ? s.owned[id] : s.owned[id] ? 1 : 0);
export const hired = (s, who, year = s.clock.year) => s.hires[who] === year;
export const canAfford = (s, n) => s.cash >= n - 1e-9;

// Why an item cannot be bought right now (null if it can).
export function blocker(s, id) {
  const it = CATALOGUE[id];
  if (!it) return 'unknown item';
  const y = forYear(s);
  if (it.from > y) return `available from year ${it.from}`;
  if (it.where === 'winter' && s.clock.phase !== 'winter') return 'in the winter shop';
  if (it.where === 'october' && s.clock.phase !== 'october') return 'during the season';
  if (it.where === 'grow' && s.clock.phase !== 'grow') return 'during September prep';
  if (it.needs && !s.owned[it.needs]) return `needs ${CATALOGUE[it.needs].name}`;
  if (it.kind === 'hire' && hired(s, id, y)) return 'already hired';
  if (it.per === 'year' && has(s, id, y)) return 'already paid this year';
  if (it.per === 'once' && count(s, id) >= (it.max || 1)) return 'sold out';
  if (!canAfford(s, priceOf(s, id))) return 'not enough cash';
  return null;
}
export const shopFor = (s, tab) => Object.values(CATALOGUE).filter((it) => it.from <= forYear(s) && (!tab || it.tab === tab));

// ------------------------------------------------------------ money and the ledger
export function money(s, ctx, delta, cat) {
  delta = round2(delta);
  if (!delta || !Number.isFinite(delta)) return 0;
  const L = s.ledger.year;
  s.cash = round2(s.cash + delta);
  if (delta > 0) L.income[cat] = round2((L.income[cat] || 0) + delta);
  else L.expense[cat] = round2((L.expense[cat] || 0) - delta);
  ctx.emit({ type: 'cash', delta, cat });
  // Gran's loan is repaid automatically from 20% of season revenue.
  if (delta > 0 && s.loan.owed > 0 && EC.revenueCats.includes(cat)) {
    const pay = round2(Math.min(s.loan.owed, delta * EC.loan.repay));
    s.loan.owed = round2(s.loan.owed - pay);
    s.loan.repaidPct = s.loan.total ? round2(1 - s.loan.owed / s.loan.total) : 1;
    s.cash = round2(s.cash - pay);
    L.expense.loan = round2((L.expense.loan || 0) + pay);
  }
  return delta;
}
// Spend if affordable; false otherwise (running costs like kelp stop when the tin is empty).
export const spend = (s, ctx, n, cat) => (canAfford(s, n) ? (money(s, ctx, -n, cat), true) : false);
export const ledgerNet = (L) => round2(sum(Object.values(L.income)) - sum(Object.values(L.expense)));

function rollLedger(s) {
  const L = s.ledger.year;
  s.ledger.history.push({ year: L.y, income: L.income, expense: L.expense, net: ledgerNet(L), cashStart: L.cashStart, cashEnd: s.cash });
  s.ledger.year = { y: L.y + 1, cashStart: s.cash, income: {}, expense: {} };
}

// The farm's bills (property tax, the truck, Biscuit's kibble), paid when the year closes: a flat amount plus a little per
// tilled row. Doing nothing is never free, so an idle farm drifts into Gran's cookie tin instead of banking prize money.
export const billsFor = (s) => EC.bills.base + EC.bills.perRow * (s.patch?.rows?.filter((r) => r.open).length ?? 0);
function payBills(s, ctx) {
  const n = billsFor(s);
  if (!(n > 0)) return;
  money(s, ctx, -n, 'bills');
  ctx.emit({ type: 'toast', text: LINES.gran.bills?.replace('{amt}', `$${n}`) || `Farm bills: $${n}.`, cls: '', icon: 'coin' });
}

// Gran's cookie tin (no game over, ever). If the bills overdrew the tin she covers that too, so winter opens with $500.
function maybeLoan(s, ctx) {
  if (s.cash >= EC.loan.below) return;
  lend(s, ctx, round2(EC.loan.amount + Math.max(0, -s.cash)), LINES.gran.loan);
}
// Mid-season the tin opens whenever you're broke at dawn, so no summer is spent unable to buy kelp, water or seed. A warning
// comes first, while there's still time to rein in. Repaid like any loan, from 20% of the season's sales.
function midSeason(s, ctx) {
  const Lo = EC.loan, l = s.loan, now = s.clock.year * 400 + s.clock.day;
  if (s.cash >= Lo.warn * 1.5) l.warned = false;
  if (s.cash < Lo.broke && now - (l.lentOn ?? -1e9) >= Lo.midGap) {
    lend(s, ctx, Lo.midAmount, LINES.gran.loanMid);
    l.lentOn = now; l.warned = false;
  } else if (s.cash < Lo.warn && !l.warned) {
    l.warned = true;
    ctx.alert('tinLow', { text: LINES.gran.tinLow.replace('{amt}', `$${Math.floor(s.cash)}`), cls: 'warn' });
  }
}
function lend(s, ctx, amount, lines) {
  money(s, ctx, amount, 'loan');
  s.loan.owed = round2(s.loan.owed + amount);
  s.loan.total = round2(s.loan.total + amount);
  s.loan.repaidPct = round2(1 - s.loan.owed / s.loan.total);
  ctx.say('gran', lines);
  ctx.story('loan', T.story.loanCrierScore);
}

// ------------------------------------------------------------ bots: shopping in an investment order
// Each policy shops down its own order (design §14 "Investment orders": Operator hires and handling, Showman crowds and
// minis, Grower the giant and the rows), buying whatever it can afford while keeping back next spring's running costs.
// The Balanced player buys the whole catalogue in its own order and hires only Dez, once the crowds outgrow Gran's till: it
// restocks, cuts, squishes and keeps watch itself, so the other hires cost it more than they earn (economy.test.js).
const SHOP_ORDER = {
  balanced: ['row5', 'irrigation', 'wagons', 'loft', 'compost', 'tape', 'hive', 'shadeMotor', 'row6', 'gravel', 'dez', 'soaker',
    'billboard', 'floodlights', 'plot2', 'ring', 'row7', 'cables', 'clubdb'],
  // the Operator runs the farm through staff (Dez at the till, Bea in the barn: it hires instead of minding the stand, see
  // bots.js), then handling. It squishes its own bugs and works its own lot, so the Ladybug Lady and Howie would be paid twice.
  operator: ['row5', 'dez', 'bea', 'wagons', 'loft', 'row6', 'irrigation', 'gravel', 'compost', 'shadeMotor', 'hive',
    'tape', 'row7', 'floodlights', 'billboard', 'soaker', 'plot2', 'ring', 'cables', 'clubdb'],
  // the Showman grows the crowd and the kids' row: compost, hives, rows, the billboard early (and Hal's radio on big weekends)
  showman: ['compost', 'hive', 'row5', 'wagons', 'billboard', 'row6', 'gravel', 'tape', 'loft', 'irrigation', 'row7',
    'shadeMotor', 'floodlights', 'soaker', 'plot2', 'ring', 'cables', 'clubdb'],
  // the Grower puts the giant first: rows for the money, then the giant's gear (and Grange pollen every winter)
  grower: ['row5', 'shadeMotor', 'tape', 'row6', 'soaker', 'plot2', 'cables', 'clubdb', 'ring', 'row7', 'floodlights', 'mavis', 'compost',
    'hive', 'irrigation', 'loft', 'wagons', 'gravel', 'billboard'],
  novice: ['row5', 'wagons'],
};
/**
 * What next year costs before October brings money in: seed, water and sprays for every open row (plus rows being bought
 * now), the giant's feed for every plot, and some slack (T.economy.botRunning). The shopping bots keep this back.
 */
export function springCosts(s, { rows: extra = 0, plot2 = false } = {}) {
  const B = EC.botRunning, rows = (s.patch?.rows?.filter((r) => r.open).length ?? T.patch.openY1) + extra;
  const plots = plot2 || has(s, 'plot2', forYear(s)) ? 2 : 1;
  return B.base + B.perRow * rows + B.perPlot * plots;
}

const fail = (reason) => ({ ok: false, reason });
export default {
  id: 'economy',
  init(s) {
    s.cash = EC.startCash;
    s.loan = { owed: 0, total: 0, repaidPct: 1 };
    s.ledger = { year: { y: 1, cashStart: s.cash, income: {}, expense: {} }, history: [] };
    s.owned = {}; s.hires = {};
  },
  phase(s, ctx, from, to) {
    if (to === 'winter') { payBills(s, ctx); rollLedger(s); maybeLoan(s, ctx); }
  },
  dayStart(s, ctx) { if (s.clock.phase === 'grow' || s.clock.phase === 'october') midSeason(s, ctx); },
  actions: {
    'economy/buy': (s, a, ctx) => {
      const it = CATALOGUE[a.item];
      if (!it || it.kind !== 'item') return fail('unknown item');
      const why = blocker(s, a.item);
      if (why) return fail(why);
      money(s, ctx, -priceOf(s, it.id), it.cat || 'shop');
      const y = forYear(s);
      if (it.per === 'year') s.owned[it.id] = y;
      else if (it.per === 'once') s.owned[it.id] = (it.max || 1) > 1 ? count(s, it.id) + 1 : true;
      else s.owned[it.id] = { y, d: s.clock.day, n: (s.owned[it.id]?.n || 0) + 1 }; // consumables: last purchase
      ctx.emit({ type: 'bought', item: it.id });
      ctx.emit({ type: 'sound', name: 'ching' });
      return { ok: true };
    },
    'economy/hire': (s, a, ctx) => {
      const it = CATALOGUE[a.who];
      if (!it || it.kind !== 'hire') return fail('nobody by that name');
      const y = forYear(s);
      if (a.on === false) {                     // changed your mind before the season: full refund
        if (!hired(s, a.who, y) || s.clock.phase !== 'winter') return fail('not hired for next season');
        delete s.hires[a.who];
        money(s, ctx, it.price, 'hires');
        ctx.emit({ type: 'hired', who: a.who, on: false });
        return { ok: true };
      }
      const why = blocker(s, a.who);
      if (why) return fail(why);
      money(s, ctx, -it.price, 'hires');
      s.hires[a.who] = y;
      ctx.emit({ type: 'hired', who: a.who, on: true });
      return { ok: true };
    },
  },
  bot(s, ctx, policy) {
    if (s.clock.phase !== 'winter' || !policy.shop) return;
    const order = policy.shopList || SHOP_ORDER[policy.shop] || [];
    let cash = s.cash, rows = 0, plot2 = false;
    const acts = [];
    for (const id of order) {
      const it = CATALOGUE[id];
      if (it.per === 'year' && has(s, id, forYear(s))) continue;
      const more = id.startsWith('row') ? 1 : 0, p2 = plot2 || id === 'plot2';
      const reserve = (policy.reserve ?? EC.botReserve) + springCosts(s, { rows: rows + more, plot2: p2 });
      if (blocker(s, id) || cash - priceOf(s, id) < reserve) continue;
      cash -= priceOf(s, id); rows += more; plot2 = p2;
      acts.push(it.kind === 'hire' ? { type: 'economy/hire', who: id } : { type: 'economy/buy', item: id });
    }
    return acts;
  },
};
