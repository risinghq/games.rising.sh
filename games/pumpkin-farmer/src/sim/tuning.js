// T: every gameplay number in docs/design-v1.md, one section per module, so the balance sims can sweep
// them. Comments cite the design section (§n). Dates are 'Mon D' strings; convert with cal.dayOf().
// Slices own their sections and may extend them; keep edits inside your own section.

export const T = {
  // ------------------------------------------------------------ §2 year loop and pacing
  calendar: {
    months: [['Apr', 30], ['May', 31], ['Jun', 30], ['Jul', 31], ['Aug', 31], ['Sep', 30], ['Oct', 31]],
    oct1Dow: 4,                                   // Oct 1 is always a Thursday (0 = Sun)
    lastDay: 213,                                 // Oct 31
    // real seconds per in-game day at 1x (§2 table)
    secondsPerDay: [['Apr 1', 2.0], ['Jun 1', 3.6], ['Sep 1', 2.5]],
    weekdaySeconds: 1.5,                          // October weekdays (summary toast)
    // 9:00, 16:00, 17:00. 6 game-minutes a real second: an 80 s day at 1x, 40 s at 2x (design 8 and 60 s: at 8 the crowd
    // had to stride ~10 world units a second to fit a visit in; see the motion notes in T.season)
    weekend: { open: 540, gateClose: 960, close: 1020, ticksPerSecond: 6 },
    weekends: [                                   // W1-W4 Saturdays and demand multipliers (§7 WK)
      { id: 'W1', sat: 'Oct 3', mult: 0.8 }, { id: 'W2', sat: 'Oct 10', mult: 1.0 },
      { id: 'W3', sat: 'Oct 17', mult: 1.15 }, { id: 'W4', sat: 'Oct 24', mult: 1.3 },
    ],
    dayMult: { sat: 1.0, sun: 0.9 },              // §7 DAY
    weighoff: 'Oct 26', eve: 'Oct 25', halloween: 'Oct 31',
    panicNight: { date: 'Oct 30', fromYear: 3, seconds: 30, start: 1080, end: 1200 }, // 18:00-20:00
    winterMonths: 'Nov-Mar',
  },
  clock: {
    speeds: { grow: [0, 1, 2, 4], weekday: [0, 1], weekend: [0, 1, 2] }, // §2 speed controls
    skip: 16,                                     // Skip runs at 16x until the next beat
    bulletTime: 0.5,                              // weekend clock while any sheet is open
    idleNudge: 8,                                 // s at 1x with nothing urgent before the 4x button pulses (the second idle)
    // [foundation] only threats drop the speed to 1x (plan §2.3). id -> 0: always a threat; 'year': only the year's first;
    // n: only when the same alert hasn't come in the last n days (the first THIRSTY of a dry spell). Anything else (tinLow,
    // honeyFull, kelp, later bug clusters) is news and keeps the speed. An alert may say { threat: true | false } itself.
    threats: { heatForecast: 0, heat_wave: 0, creak: 0, giantThirsty: 0, shelfSlip: 0, bugs: 'year', thirsty: 5 },
  },

  // ------------------------------------------------------------ §5 Marlene
  weather: {
    mu: { Apr: 0.45, May: 0.55, Jun: 0.66, Jul: 0.70, Aug: 0.62, Sep: 0.36, Oct: 0.42 },
    phi: 0.65, sigma: 0.17,                       // AR(1) persistence and daily noise
    heatStart: { Apr: 0, May: 0, Jun: 0.005, Jul: 0.01, Aug: 0.02, Sep: 0.04, Oct: 0.04 },
    heatDays: [2, 3],                             // 50/50
    heatF: 0.10,                                  // while on, f = min(f, 0.10)
    rain: { Apr: 0.10, May: 0.06, Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0.06 },
    rainF: 0.75,                                  // on rain days f = max(f, 0.75)
    archetypes: {                                 // "Marlene's mood", drawn from Y3; Y1-Y2 are normal
      normal: { p: 0.5, b: 0 },
      fog: { p: 0.2, b: 0.10 },
      vacation: { p: 0.2, b: -0.15, heatMul: 2 },
      wild: { p: 0.1, b: 0, sigma: 0.24, rainMul: 2 },
    },
    archetypeFromYear: 3,
    hintAccuracy: 0.7,                            // Old Moss's Almanac hint
    y1: {                                         // year-1 scripting
      heat: ['Aug 11', 'Aug 12', 'Aug 13'],       // shade intro
      noRandomHeatBefore: 'Aug 11',               // heat never arrives before the shade intro (interpretation)
      kelp: 'Aug 18',                             // scripted kelp wash-up (giant slice fires it)
      calm: ['Oct 3', 'Oct 4'], calmF: [0.35, 0.6], // calm first weekend
      heatW3: ['Oct 16', 'Oct 17'],               // W3 Saturday is a heat wave (Route 46 intro)
    },
    words: [[0.25, 'Out', "Marlene's out"], [0.5, 'Patchy', ''], [0.75, 'In', "Marlene's in"], [Infinity, 'Sulking', "Marlene's sulking"]],
    heatLine: 'Heat over the hill',
    forecast: { sigma: [0.08, 0.14, 0.20], hit: [0.8, 0.65, 0.5], falseAlarm: 0.05 },
    inThreshold: 0.5,                             // Crier: "Marlene was in on 71% of days" (f > 0.5)
    burnOff: 0.1,                                 // cosmetic morning burn-off on weekend days, fades by noon
    revealThicken: 0.2, easeSeconds: 1,
    // effects on other systems (§5 table); owning slices read these
    effects: {
      cosyF: 0.7, goldenF: 0.3, goldenAt: 900, goldenChance: 0.5, peaSoupF: 0.85,
      beesFlyF: 0.6, honeyF: 0.5, swarmF: 0.4, whaleF: 0.5, quarterSunF: 0.08,
      sunscaldF: 0.2, pollinateFogF: 0.5,
    },
  },

  // ------------------------------------------------------------ §3, §5.3 onboarding and story
  story: {
    introGap1x: 25,                               // no two intros less than 25 s of 1x clock apart
    chatterGap1x: 12,                             // Old Moss's tips keep this far from an intro, before and after
    lapseWait: 3,                                 // days a lapsing goal waits for a quiet moment to say its line
    maxY1Beats: 26,
    laterYearSpacingDays: 6,                      // Y2+ intros: no two in the same 6 game days
    lineMax: 110, linesPerCard: 3,                // voice rules (§11)
    y1: {                                         // §3 year-1 schedule (triggers; owning slices read these)
      // Every date keeps the 25 s intro gap from the one before it at 1x (design §3 table): kelp May 19 (1:36, so planting
      // is Jun 1 at 2:02), and September's three at exactly 25 s: Crier Sep 1 (7:33), rituals Sep 11, barn Sep 21. Honey
      // (a toast, not an intro) fills the quiet week between Edna's tape and Hal's heat warning, not the busy late August.
      // The growing-year plan (plan §4.1) re-dates some of these. One key per line so each owner changes only its own:
      // the owner moves its beat to the new key or value and deletes the old one in the same commit.
      seed: 'Apr 1', marlene: 'Apr 18',
      moving: 'May 1',                            // [C] Moving Day: Gran's card, three mornings by Hal's forecast (was water May 6)
      kelp: 'Jun 5',                              // [C] Old Moss's first visit: kelp tea (was May 19)
      plant: 'May 20',                            // [B] the Planting Table: plan October before the sowing window (Jun 1)
      // [B] the watering lesson follows the first sowing: the first dry morning (M < below) from afterSow days after it,
      // forced (Hal's "dry week") at forceAfterSow, so it always lands while the first row is young
      patchWater: { below: 0.35, afterSow: 5, forceAfterSow: 8 },
      pollinate: 'Jul 1', cullAfterSet: 10, bugs: 'Jul 20',
      crawl: 'Aug 1',                             // [C] the Vine Crawl: the first tape, in public (was Edna's measure lesson)
      shade: 'Aug 10',
      creak: { after: 'Aug 10', practice: 'Aug 25' }, honey: 'Aug 5', crier: 'Sep 1', rituals: 'Sep 11', barn: 'Sep 21',
      ringUp: 'Oct 3', wants: 'Oct 4', restock: 'Oct 10', wagons: 'Oct 11', route46: 'Oct 17', pins: 'Oct 18',
      granStock: 12,                              // Gran's "own little patch" if the barn is empty at the restock intro
    },
    y2plus: { seedLetter: 'Apr 20' },             // [B] years 2+: Gran opens the Table with last October's crates (rulings R13)
    receiptGapDays: 7,                            // a receipt (the consequence of a choice, said later) at most once a week
    loanCrierScore: 25,
  },

  // ------------------------------------------------------------ [foundation] the moments queue (plan §2.1, rulings R2)
  // Every chatter-class moment (a delight's arrival, a First, a sowing day, a tally, a receipt, a note) waits here for a quiet
  // window: 12 s of 1x clock (story.chatterGap1x) clear of lessons and of each other. Higher prio goes first, ties oldest
  // first; a moment that can't find a window in maxWaitDays game days is dropped (its drop handler may file it silently).
  moments: {
    maxWaitDays: 3,
    toastsPerPass: 2,                             // low-salience toasts never take a window; at most this many a day
    receiptWaitDays: 4,                           // a receipt waits this long for its window
    prio: { delight: 50, first: 40, sowing: 40, tape: 30, note: 30, receipt: 20, tally: 10, tip: 0, toast: 0 },
  },

  // ------------------------------------------------------------ §10 surprise director
  events: {
    gap: { grow: 45, weekend: 30 },               // notables at least this far apart (1x-seconds)
    afterIntro: 20,                               // no random notable within 20 s after an intro
    pity: { grow: 150, weekend: 80, mul: 3 },     // rates x3 after this long without a notable (weekend: one selling day, design 100)
    novelty: 0.6,                                 // lambda x 0.6^(times seen in the last two years)
    maxShare: 0.25,                               // no type above 25% of a year's notables
    y1Gap: 90, y1MaxGap: 150,                     // year 1: random notables only fill gaps
    target: { grow: [0.4, 0.65], weekend: [0.6, 1.0], minorPerMin: 1, storyPerYear: 2, notablesPerYear: [13, 16] },
    toastGap: 30,                                 // at most one notable toast per 30 real seconds (UI)
    logKeep: 400,
    // catalogue numbers by event id (owning module in brackets)
    cat: {
      // [A] the catchable swarm stays the director's notable (its free hive or jars); in year 1 it waits for the honey lesson,
      // and before that the bees' swarm is a look-only delight, a "bee day after a sulk" at the scarecrow (T.mischief.swarm)
      swarm: { months: ['Jun', 'Jul', 'Aug', 'Sep'], f: 0.4, hives: 4, rate: 0.03, weighoff: 0.15, cooldown: 20, cap: 2, tapSeconds: 15, jars: 6, maxHives: 6 }, // [patch]
      kelp: { months: ['Jul', 'Aug', 'Sep'], rate: 0.04, breakRate: 0.25, cooldown: 15, cap: 3, tapDays: 2, freeDays: 7 }, // [giant] breakRate: the day after rain or a heat wave's end
      // [A] a delight in the growing year (a ✦ pin; tap it to log her): 0.04 a clear day in year 1, 0.025 later
      whale: { months: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], f: 0.5, rate: 0.025, y1Rate: 0.04, weekendRate: 0.06, cooldown: 25, capGrow: 2, capSeason: 1, tapDays: 2, crowdTicks: 72, crowdShare: 0.5, returnSat: 8 }, // [events + season] crowdTicks: ~5 s at the shore after a ~5 s stroll there (design 40)
      quarter_sun: { months: ['Jun', 'Jul', 'Aug'], f: 0.08, cooldown: 14, cap: 3, growth: 1.15, sunscald: 2 }, // [events]
      heat_wave: { arrivals: 1.6 },               // [events; weather-driven]
      moss_tip: { every: [18, 30], cap: 6, now: 0.5, late: 0.3, wrong: 0.2, doze: 0.3, dozeDays: 7, lateDays: 7 }, // [giant]
      // [A] the vine itself stays the director's story event (these odds and window: as a lane delight it came a third as often);
      // once it has sprouted, the lane puts a quiet ✦ over it on its own odds (patch.js volunteer_look)
      volunteer_vine: { window: ['Jun 1', 'Jun 20'], chance: 0.35, shiny: 0.3, ripe: 'Oct 1' }, // [patch]
      twin_fruit: { chance: 0.08, pot: 1.06, stress: 2 }, // [giant]
      mutation: { white: 0.004, stripe: 0.002 }, // [genetics]
      // weekend chances are per 60 s of selling day (season.js scales them by the day's real length). With 80 s days the
      // season's caps and cooldowns bound the count, so a few open up to keep ~0.6+ notables a weekend minute (§14):
      // the goat 20% a day and 3 a season (was 15%, 2), Big Tom 14% every other day (was 10%, 3 days), lost joeys 10% (was 8%)
      goat: { fromWeekend: 2, after: 660, rate: 0.2, cooldown: 3, capSeason: 3, eatTicks: 15, taps: 3, hop: 4 }, // [season] Y1: after the pins lesson
      skunk_startle: { cooldownTicks: 60, radius: 4, ticks: 30, foghornTaps: 3, foghornSeconds: 5 }, // [season]
      lost_joey: { rate: 0.1, cooldown: 1, cap: 3, barkSeconds: 3, findTicks: 60, family: 25, everyone: 5, buzz: 0.1, lessonTicks: 120 }, // [season]
      // 1 per 600 fruit (design 400): the same ~1 a season (27% of seasons none) from the bigger rows of the economy pass
      shiny: { perFruit: 600, cooldown: 5, capSeason: 3, kidGrab: 0.2, sellMul: 10, displayBuzz: 0.1, displaySat: 5, auction: [150, 600], // [patch]
        months: ['Sep', 'Oct'], kinds: { sphere: 150, heart: 250, smiley: 200, twins: 350, beak: 450, weighmaster: 600 } }, // auction $ by kind
      golden_hour: { from: 900, to: 990, f: 0.3, chance: 0.65, sat: 8, photoSat: 15, viralMul: 1.5 }, // [season] (design 50%: §14's weekend pace)
      viral: { chance: 0.3, capWeekend: 1, arrivals: 1.35, buzz: 0.35 }, // [season]
      pea_soup: { f: 0.85, arrivals: 0.65, linger: 1.2, sat: 3 }, // [season]
      big_tom_backfire: { rate: 0.14, cooldown: 2, arrivals: 1.15 }, // [season]
      runaway_pumpkin: { perHour: 0.02, cooldown: 1, tapSeconds: 5, price: 8, roll: [-1.5, 9.6] }, // [season] Biscuit fetches it: no farmer trip
      // Y3 (design §3 table; §10 says Y2+): Y2's season already adds the morning card and two customer types
      // gawkTicks: the day's chance is spread over this many minutes with someone gawking (fewer stroll over to her now)
      toddler_giant: { fromYear: 3, est: 500, rate: 0.25, gawkTicks: 60, cooldown: 1, poseTicks: 20, sat: 20, buzz: 0.05, ignore: -5, window: 48 }, // [season]
      possum_carpool: { chance: 0.03 },           // [season]
      proposal: { fromYear: 2, R: 3.5, chance: 0.2, ticks: 30, dR: 0.1, window: 60 }, // [season]
      heist_scouts: { fromYear: 2, interest: 0.5 }, // [weighoff]
      dez_wanders: { rate: 0.08, from: 600, to: 900 }, // [season]
      old_timer: { perWeekend: 1 },               // [season]
      parking_lot_offer: { date: 'Sep 15', until: 'Sep 30', below: 0.6, lot: 40, price: 200, maxLots: 3 }, // [patch]
      decorator_order: { fromYear: 3, date: 'Sep 5', chance: 0.5, n: 40, due: 'Oct 9', mul: 1.3, failR: -0.1 }, // [season]
      dedication: { talks: 10 },                  // [giant]
      thanks: { odds: 60, seconds: 0.6 },         // [giant]
    },
    toys: { weighmasterStop: 10, foghornTaps: 3 },
  },

  // ------------------------------------------------------------ §9 economy, shop and hires
  economy: {
    startCash: 800,
    loan: { below: 150, amount: 500, repay: 0.2,  // Gran's cookie tin: at the year's close, under $150 becomes $500
      broke: 40, midAmount: 300, midGap: 14,     // mid-season: under $40 at dawn (no seed packet), Gran lends $300, at most fortnightly
      warn: 120 },                               // "Tin's getting light" under $120, once per dip (it re-arms over $180)
    bills: { base: 400, perRow: 75 },                // the farm's bills, paid as the year closes: base + perRow x tilled rows
    revenueCats: ['pumpkins', 'weekday', 'honey', 'tips', 'shiny'], // "next season's revenue" repays the loan
    botReserve: 300,                              // bots shop down to next spring's costs (springCosts) plus this slack
    botRunning: { base: 150, perRow: 110, perPlot: 350 }, // next spring's costs: seed, water, sprays a row; feed a giant plot
    // §14 year-1 net from the patch and the season (ledger net less weigh-off prizes); prizes land on top ($100-2,700).
    // novice: re-pinned with the Planting Table (rulings R16): the novice now plans by tapping random weekend chips; measured
    // $856 over 100 seeds, +-25% (docs/balance-report.md)
    y1Net: { diligent: [1500, 2800], novice: [640, 1070] },
    oneTimeTotal: 13560, recurringTotal: 2050,    // the whole catalogue (§9 money curve)
  },
  // from: first year the item is in effect (it appears in the winter before that year)
  shop: {
    row5: { tab: 'hardware', price: 800, from: 2 },
    row6: { tab: 'hardware', price: 1200, from: 3, needs: 'row5' },
    row7: { tab: 'hardware', price: 1800, from: 4, needs: 'row6' },
    wagons: { tab: 'hardware', price: 200, from: 2, max: 2, add: 4, base: 6 },
    loft: { tab: 'hardware', price: 700, from: 2 },
    irrigation: { tab: 'hardware', price: 800, from: 2, below: 0.35 },
    tape: { tab: 'hardware', price: 60, from: 2, noise: 0.002 },
    hive: { tab: 'hardware', price: 250, from: 2, max: 2 },
    shadeMotor: { tab: 'hardware', price: 450, from: 2 },
    compost: { tab: 'hardware', price: 300, from: 2, per: 'year', yield: 1.08, spawn: 0.8 },
    gravel: { tab: 'hardware', price: 900, from: 3, spaces: 4 },   // spaces: the season reads T.season.parking.gravel
    soaker: { tab: 'grange', price: 600, from: 3 },
    plot2: { tab: 'grange', price: 2000, from: 3 },
    ring: { tab: 'hardware', price: 1500, from: 3, risk: 0.003 },
    floodlights: { tab: 'hardware', price: 450, from: 3 },
    // billboard $400 a year (design $600) [integration]: at $600 it lost ~$290 a year on a farm whose field sells out, and
    // the one-way road had cost the crowd builds (Operator, Showman) ~4% of their weekend sales, so the Grower was best
    // in 51 of 100 seeds (limit 50). With the beach lot at +4 the phone's crowd has room for it (Y4 4.4% over 16, limit 5%).
    billboard: { tab: 'kqsc', price: 400, from: 3, per: 'year', arrivals: 1.15 },
    cables: { tab: 'grange', price: 1000, from: 4, earlyDays: 7, pot: 1.03 },
    clubdb: { tab: 'grange', price: 400, from: 4 },
    // radio $100 a weekend (design $150): the field, not the crowd, runs out from Y2, so at $150 a spot lost money on every
    // weekend for every build, the Showman included (-$45 on W1, a full field, was the best case; -$200 on the big ones).
    // At $100 a spot on a full field pays a little; one on a weekend that sells out still loses: advertise what you can sell.
    radio: { tab: 'kqsc', price: 100, from: 2, per: 'weekend', where: 'october', arrivals: 1.15 },
    // shuttle $60 a day (design $100): at $100 the heat-wave levers lost money even on the days they are for
    shuttle: { tab: 'kqsc', price: 60, from: 2, per: 'day', where: 'october', share: 0.27, from11: 660 }, // polish: 0.25
    forklift: { tab: 'prep', price: 200, from: 2, per: 'use', where: 'grow', risk: 0.003 },
  },
  hires: {
    // Dez $300 (design $400) and Bea $200 (design $450): at $400 / $300 they lost $170-430 a season for everyone but a Lazy
    // stand (Dez) or a Novice (Bea), and most for the Operator who hires both. Now Dez is about even for a Realistic player
    // and Bea pays a Novice; both still cost an Attentive one (§9: "attentive manual play stays better").
    dez: { price: 300, from: 2, rate: 8, wander: 0.08 },             // cashier: 1 family / 8 ticks
    bea: { price: 200, from: 2, overnight: 40, tripTicks: 40, below: 0.3 }, // never Sundays; cuts what would go soft nightly
    howie: { price: 250, from: 3, spaces: 4, patience: 1.5 },        // design $350: he pays only on traffic-heavy weekends
    mavis: { price: 300, from: 3, catch: 0.8, naps: 0.1 },
    ladybug: { price: 300, from: 3, clears: 0.4 },
  },

  // ------------------------------------------------------------ §4 the commercial patch
  varieties: {
    // Large rows yield 25% more than the design table (Classic 80 -> 100 ...): with the design's yields every field ran ~25%
    // short of the crowd every year, so the season always ended on bare rows and supply was the only constraint that bound.
    classic: { unlock: 1, seed: 60, dtm: 88, fruit: 100, prime: 10, soft: 5, price: 8, mildew: 1.0, large: true },
    // Mini: 300 a row at $2 (design 200 at $2.50). Kids want ~1.5 minis a family, so one 200-fruit row sold out by W3 of
    // year 1 for every plan and the season ended on bare rows; 300 lets one row carry a year-1 farm's kids.
    mini: { unlock: 1, seed: 40, dtm: 78, fruit: 300, prime: 16, soft: 5, price: 2, mildew: 0.7, large: false },
    white: { unlock: 2, seed: 90, dtm: 82, fruit: 62, prime: 7, soft: 4, price: 13, mildew: 1.5, large: true },
    warty: { unlock: 2, seed: 90, dtm: 92, fruit: 68, prime: 13, soft: 6, price: 12, mildew: 0.7, large: true },
    cinderella: { unlock: 3, seed: 110, dtm: 96, fruit: 56, prime: 10, soft: 5, price: 15, mildew: 1.1, large: true },
    blue: { unlock: 3, seed: 120, dtm: 104, fruit: 56, prime: 22, soft: 7, price: 15, mildew: 0.4, large: true, lastPlant: 'Jun 5' },
  },
  patch: {
    rows: 7, openY1: 4,
    window: ['Jun 1', 'Jul 10'],                  // earlier needs Gran's confirm; later is flagged "won't make it"
    plantNudge: 'Jun 22',                         // the planting goal says what's at stake if nothing is in yet
    // Classic waves Jun 12 / Jul 3 / Jul 10 and the minis last, Jul 10: the kids come at the end of October, and W4 is the
    // biggest weekend, so Gran keeps two late waves for it. (Polish wave: Jun 12 / Jun 26 / Jul 8 + Mini Jul 6 left the
    // field bare by 3 pm on W4 Sunday in ~40% of years, every warm September; now ~10%, at the same money.)
    gransPlan: [['classic', 'Jun 12'], ['classic', 'Jul 3'], ['classic', 'Jul 10'], ['mini', 'Jul 10']],
    gransRows: [0, 2, 3, 1],                      // which row each plan entry fills: Classic and Mini up front (§4)
    gransExtra: [['classic', 'Jun 19'], ['mini', 'Jun 30'], ['classic', 'Jul 2']], // "Gran's usual" for rows 5-7 (Y2+): no fads
    ghostWhisker: [3, 0.06],                      // +/-(3 + 0.06 x DTM) days; narrows to +/-0 as real weather comes in
    ghostSettle: 15,                              // the fixed +3 shrinks over the last 15 growth units
    growth: { base: 1.15, fog: 0.6, heat: 1.25, dryBelow: 0.3, dryMul: 0.6 },
    stages: [[0, 'seeded'], [5, 'sprouts'], [20, 'vines'], [40, 'flowers'], [55, 'green']], // then ripe at DTM + offset
    fruitSetAt: 55, beeWindow: [40, 55],
    cohorts: { offsets: [-6, -3, 0, 3, 6], shares: [0.1, 0.2, 0.4, 0.2, 0.1] },
    bees: { perHive: 0.03, f: 0.6 },              // n x (1 + 0.03 x hives x beeFrac)
    compost: 1.08,
    health: { start: 1.0, floor: 0.5 },
    // after fruit set a sick vine drops green fruit in proportion to the health it loses (so late bugs still matter)
    aging: { prime: 1, heat: 1.5, mildewLife: 0.7, barn: 0.35, softSlump: 0.8, softPrice: 0.5, rottenShow: 4 },
    moisture: { start: 0.7, base: 0.03, sun: 0.06, heat: 0.04, rain: 0.35, dry: 0.3, wet: 0.85, wetMildew: 2, dryHealth: 0.01,
      thirsty: 0.35, frozenFrom: 'Oct 1' },       // from Oct 1 Gran keeps the hose going (the FAB is RING UP by then)
    water: { add: 0.5, perRow: 2 },               // Water All: M += 0.5 for $2 x planted rows
    bugs: { from: 'Jul 1', minAge: 25, rate: 0.025, clearMul: 1.4, clearF: 0.3, fogMul: 0.7, fogF: 0.6, neighbour: 0.03, infested: 0.5,
      grow: 0.07, health: 0.012, squish: 0.35, buttons: 3, buttonSeconds: 3, chainSeconds: 1.5, spray: 15, block: 14,
      start: 0.15, forced: 0.3, compost: 0.8 },   // a new cluster starts at 0.15; Gran's Jul 20 teaching cluster at 0.3
    mildew: { fromYear: 2, window: ['Jul 1', 'Sep 30'], base: 0.01, fog2: 0.05, health: 0.004, primeMul: 0.7, spray: 10, cure: 0.8, protect: 10,
      start: 0.35, grow: 0.04, gone: 0.1, compost: 0.8, forceBy: 'Jul 25' }, // milk leaves 20% of it; under 0.1 it's gone
    barn: { cap: 60, loft: 180, cutFrom: 'Sep 1', restockN: 12, lessonUntil: 'Sep 30' },
    display: { large: 16, mini: 28 },             // pumpkins drawn per row = round(slots x stock / yield)
    fullness: { frontBonus: 1.3, frontRows: 2, good: 0.6, goodSat: 5, bad: 0.25, badSat: -8, firstImpression: 0.3, firstSat: -3,
      varietySat: 3, varietyMax: 9 },
    trucked: { n: 40, price: 200, notice: 0.25, beaver: 0.4, owl: 0.35, pelican: 0.1, sat: -15, menuFromYear: 4, deliverDays: 1 },
    // honey accrues on f < 0.5 days, 0.1 jar per hive; a hive holds 3 jars ("full"), then waits for you
    hives: { start: 4, max: 6, honeyF: 0.5, honeyPrice: 10, honeyBuy: 0.15, fullBy: 'Aug 24', jarPerDay: 0.1, cap: 3,
      // [B] honey after its lesson is a chore, not a game (rulings R4): in year 1 Gran shelves the jars once a week (one
      // toast); from year 2 the hives ask for you at most once a week. The year-1 lesson waits for a quiet window (lessonWait
      // days at most, then it runs anyway: a lesson is never lost).
      shelveEvery: 7, pinEvery: 7, lessonPrio: 30, lessonWait: 10 },
    // the projection behind the Sep 15 parking-lot offer and the forecast bar's weekend dots (season.js may replace it)
    project: { coveredGood: 0.7, coveredThin: 0.3 },
    // [B] the Planting Table (plan §3.8, rulings R3): you drag a row's ripe window onto October's weekends with the clock
    // stopped; the weekends are magnets (the sowing day snaps to the best one for the weekends the window covers). A row is
    // "ripe for" a weekend when its projected prime fruit on that Saturday is at least max(labelMin, labelShare x its set).
    // Gran teaches rows 1 and 2 in year 1 (lesson), then hands over. Years 2+: Gran opens it on Apr 20 (T.story.y2plus) and
    // her usual fills the empty rows if nothing is planned by y2Until.
    // maxVh: the Table's height on a phone (69: it reaches just under the Next-up chip, with Plant and the chips above the fold).
    // plateau: sowing days whose worst target weekend is within this many fruit of the best tie (the Table takes the middle).
    // y2Short / y2Soft: last October's line names a weekend that ran out (that many unmet wants) or went soft (that many).
    table: { maxVh: 69, nudgeDays: 2, labelMin: 20, labelShare: 0.25, maxGestures: 12, lesson: [['classic', [0, 0]], ['mini', null]],
      plateau: 0.5, y2Until: 'Jun 1', y2Short: 10, y2Soft: 15 },
    // [B] the October crates (plan §3.9, rulings R9): each weekend's wants (projectDemand x demandK, calibrated against the
    // real season in tests/balance/shelf.test.js) and what the rows will have ripe for it. Levels: thin, good, full. A slip (a
    // threat) is a weekend losing a level, >= slipMin of its met, to something you can fix (slipCauses), at most one a weekend
    // every slipEveryDays. Gran's tally speaks every everyDays when a level moved. A sowing waits sowingLateDays for its window.
    // fogF: a growing day this foggy counts toward a row's lost fog days. feedShare: a row feeds a weekend's crate when it
    // gives it this share of its supply (the causes, the stake flag's label).
    shelf: { demandK: { large: 1.4, mini: 1.4 }, demandW: { y1: [0.74, 0.73, 1.5, 1.12], later: [0.77, 0.87, 1.1, 0.99] }, levels: [0.3, 0.6, 0.9], slipMin: 0.08, slipEveryDays: 5, slipCauses: ['dry', 'bugs', 'mildew'],
      tally: { everyDays: 14, until: 'Sep 20' }, healthScale: 0.5, sowingLateDays: 5, fogF: 0.75, feedShare: 0.2, slipDry: 1,
      hurtMin: 0.01, hyst: 0.04, spread: [0.5, 0.25], dryAhead: 5, slipGapDays: 3, windowWaitDays: 7 },
    // (sowingLateDays 5, not 3: a lesson keeps moments 12 s clear behind it, 3.3 June days, so 3 days could never outwait one.
    // spread [a, b]: fruit still to ripen counts b of itself a x its whisker early and b as late. dryAhead: on a thirsty
    // morning the projection lets the next days grow at the dry rate (if nobody waters this week). slipGapDays: between slips.
    // windowWaitDays: how long the Jun 1 "window's open" toast may wait for a quiet morning when nothing is planned yet.)
    // [B] the June fog job (rulings R8): a scheduled sowing morning in pea soup asks "sow anyway or wait a day". on: false
    // when the harness says the two don't differ materially (tests/balance/shelf.test.js measures it either way).
    fogJob: { on: false, f: 0.82, perYear: 2, slowDays: 4, slowMul: 0.5 },
  },

  // ------------------------------------------------------------ §6 the giant pumpkin
  giant: {
    germination: 0.95, backupDelay: 4,            // Y1 scripted to succeed
    transplant: 'May 6',
    preSet: { base: 0.96, water: 0.04, kelp: 0.015 }, // preSet = 0.96 + 0.04 goodWaterFrac + 0.015 kelpFrac (design 0.03: lazy care sat at the -10% edge)
    firstFlower: ['Jul 1', 3],                    // ~Jul 1 +/- 3
    dawns: 6, failedSetDelay: 3, beesAfterDawns: 5,
    // [C] pollination (plan §3.12, rulings R5): the bees come out by the fog (8 on a clear dawn, 1 when f >= beesOutF) and take
    // 92% / 50%; your own paws (self, a cross, a sib) take 80% any dawn. Reading the bees beats always trusting them.
    set: { bees: { clear: 0.92, fog: 0.50 }, paws: 0.80, beesOutF: 0.6, beesShown: [8, 0.15] },
    cullAfter: 10, rotateWindow: [5, 25], rotateFromYear: 2,
    regime: { light: 0.45, normal: 0.62, heavy: 0.82, maxRefill: 0.22 },
    soak: 0.35, swing: { rise: 0.25, days: 3, mul: 3 },
    feedResumeDays: 7,                             // feed switched off for want of cash comes back on once a week of it is in the tin
    feed: { none: { cost: 0, mul: 1 }, kelp: { cost: 2, mul: 1.05 }, fish: { cost: 4, mul: 1.09, fromYear: 2 }, both: { cost: 6, mul: 1.12, fromYear: 2 } },
    kelpDensity: 0.012, fishStress: 1.25, fishHeist: 0.2, fishSkunkSat: 3,
    // [C] upFog: the sail up on a foggy day (f > fogF) costs growth (plan §3.12 retune 1: "always up" loses to "by forecast")
    shade: { upGrowth: 0.96, upFog: 0.90, fogF: 0.5, heatDownGrowth: 0.75, heatDownStress: 2.5, sunscald: 0.04, maxScald: 3, scaldFrom: 'Aug 1' },
    rotate: { symmetry: 0.25, crack: 0.01, crackPer100: 0.01, growth: 0.5, stem: 0.3 },
    treat: { cost: 20, cavity: 0.25, treated: 0.10 },
    vigorSd: 0.08,
    // risk dial (wave 3): the stump cull was a losing bet (design 1.04 growth for x1.6 stress put greedy-stump 14% under the
    // safe styles' EV); it is now a gamble on looks (stem 0.8 for Prettiest) for a little growth
    // [C] stumpStress 1.0 -> 1.35 (plan §3.12 retune 2): "creaks more" is true, and the stump stops winning 78% of seeds
    cull: { safe: 1.00, stump: 1.03, round: 0.97, twins: 1.06, stumpStress: 1.35 },
    logistic: { k: 0.085, mid: 55 },              // L(t) = 1 / (1 + e^(-0.085 (t - 55)))
    slowdown: { from: 'Sep 20', to: 'Oct 20', floor: 0.3 },
    qNoise: 0.05,
    water: [[0.25, 0.5], [0.45, 0.85]],           // C_water below 0.25 -> 0.5; below 0.45 -> 0.85; else 0.95 + 0.15 min(1, (m - .45)/.40)
    waterTop: { base: 0.95, add: 0.14, from: 0.45, span: 0.40 }, // add (design 0.15): intact Heavy sat at +5.4% of a +3-6% band
    light: { k: 0.12, mid: 0.5 },
    cracked: 0.6, peakDiv: 4,                     // peakGain = POT x 0.085 / 4
    moisture: { base: 0.06, sun: 0.10, growth: 0.05, heat: 0.08, rain: 0.30 },
    stress: { dry: [0.5, 0.16], mid: [0.72, 0.35], wetSlope: 3.5, fog: 0.3, F: 0.5, cap: 3 }, // dry (design .12): Light split 0.8% against a 0.5% floor
    // two-stage creaks. Design: base .045, split [.03, .12], heal [.40, .30]; retuned so most Balanced years have a creak
    // (design §14 >= 70%) while the split bands hold: more creaks, each a little more forgiving at low stress.
    creak: { fromT: 15, base: 0.13, split: [0.0, 0.10], heal: [0.50, 0.25] },
    split: { blowout: 0.4, crackScars: 2, cavity: 0.25, seedsAfter: 60 },
    softSpot: { rate: 0.0004, from: 'Oct 1' },
    ott: { a: 5.8e-5, b: 2.87, noise: 0.006, round: 0.5, drift: 0.85 }, // drift: share of the tape error that wanders weekly
    rho: { den: 0.015, offset: 0, kelp: 0.012, heavy: -0.02, sd: 0.05 }, // offset (design -.005) 0: neutral care reveals heavy ~50% of the time
    rituals: { weeks: 0.8, radioDays: 0.8, moonCycle: 29.5, moonWindow: 1, hintsPerYear: 2, hintRight: 0.5 },
    secret: { growth: 1.02, creak: 0.85, rho: 0.015 },
    // [C] buzzWeekends: telling buys buzz for W1 and W2 only (plan §3.12 retune 4): more folks early, so have pumpkins for them
    crier: { buzz: 0.10, buzzWeekends: 2, gawk: 0.10, gawkSat: 5, gawkEst: 1000, heist: 0.3 },
    nameMax: 18, nameChoices: 3,
    tin: { mother: 1147, year: "'98", seeds: 2 },
    lotSize: 6,
    soaker: 400,
    knockCorr: 0.5,
    // slice additions: the seed's first weeks, pacing guards and small feedback thresholds
    germDays: 3, autoStart: 7, vineAfter: 18, minFlowerAfter: 30, maxSetFails: 3, cablesDays: 7, cablesPot: 1.03,
    soakerRefill: 0.35,                           // the soaker hose holds the target (no swings from regimen changes)
    practice: { heal: 0.5, maxDays: 3 },          // the year-1 practice creak always heals
    knock: { rhoSd: 0.055, k: 2.2, range: [0.7, 1.3] }, // pitch = 1 - k (rho - 1 + noise); denser thunks deeper
    thirsty: [0.25, 0.35],                        // alert under, re-arm over
    vigorHint: [0.96, 1.04],                      // "so-so" under, "vigorous" over
    tips: { firstY1: 'Jun 10', first: 'Apr 20' }, // Old Moss's first tip of the year (Y1: after he appears)
    goodWater: [0.45, 0.85],                      // a "good water" day before set (preSet)
    regimeStepDays: 3,                            // bots step back up gently after a creak heals
    // [C] Moving Day (plan §3.11, rulings R7): she roots in 1, 3 or 5 days by that morning's actual fog (clear / patchy /
    // foggy); her first flower moves by rootDays + flowerShift, and her potential moves by sulkPot a day either side of
    // pivot root days: a clear move (+1 leaf, a head start) is +2.5%, a patchy one -2.5%, a foggy one -7.5% (the shock of a
    // cold move: what makes the forecast read worth pounds at the scale, tests/balance/choices.test.js). pivot is the
    // root days a forecast reader gets on average (2.0 over 200 springs), so reading Hal costs nothing over the old fixed
    // May 6 move, and the careers' prizes (tests/balance/economy.test.js) keep their growth
    moving: { offer: 3, rootDays: [[0.5, 1], [0.75, 3], [Infinity, 5]], flowerShift: -2, sulkPot: 0.025, pivot: 2, likely: 0.6 },
    // [C] the water dial (plan §3.12): hidden in year 1 until Old Moss's creak lesson, live from Moving Day in years 2+;
    // Soak shows only when she is parched; the tape rests measureEvery days between tapes (rulings R4)
    regimeHiddenUntilCreak: true, soakShowBelow: 0.3, measureEvery: 3,
    // [C] the germination block: giant/start { file } (a future close-up's filing strokes) moves her up a day early or late
    tinFile: { good: [3, 5], over: 8 },
    // [C] the pace line (plan §3.12): the tape's estimate projected on the public growth curve to the weigh-off, give or take
    // err x the share of her growth still to come, at least min (the tape can't see her density: the scale lands ~5% off
    // the curve all season), rounded to round lb. About 3 weigh-ins in 4 land inside it (tests/balance/choices.test.js)
    pace: { err: 0.15, min: 0.07, round: 10, kelpMin: 10 },
    // [C] Vance's cull receipt waits for her first creak until cullBy; the Notebook keeps 12; a receipt's line is said at
    // most once in `fresh` years (a repeat is filed in the Notebook without a word)
    receipts: { cullBy: 'Sep 1', keep: 12, fresh: 3 },
  },

  // ------------------------------------------------------------ §6 seeds and genetics
  genetics: {
    loci: ['S1', 'COL', 'S2', 'DEN', 'S3', 'EVN', 'TGH', 'SHP'],
    link: [0.15, 0.5, 0.5, 0.5, 0.2, 0.5, 0.5], // recombination fraction to the next locus
    colours: ['O', 'S', 'T', 'W'],                // dominance O > S > T > W
    pot: { base: 500, perSize: 60, colour: { O: 0, S: 40, T: 80, W: 40 }, shape: { tall: -40, round: 0, flat: 80 } },
    tgh: [1.6, 1.3, 1.0, 0.8, 0.6],               // stress multiplier by TGH sum 0..4
    mutate: { step: 0.02, white: 0.004, stripe: 0.002 },
    grandpa: { a: [1, 'O', 1, 1, 1, 2, 1, 't'], b: [2, 'T', 1, 2, 0, 1, 1, 'f'], F: 0.125, pot: 828 },
    // Founder lines. Allele mean m = (W_line - 500 - 60 h) / 360. Each haplotype is "heavy" with chance h: it carries
    // high S1 in phase with a pale colour (heavyCol) and high S3 in phase with low EVN, so heavy-vs-pretty is built in.
    // col: colour weights of light haplotypes; t: chance of a tall SHP allele [light, heavy]; tgh/evn/den: allele means.
    founders: {
      vance: { h: 0.5, W: 950, col: { O: 0.55, S: 0.45 }, heavyCol: { T: 0.6, S: 0.4 }, t: [0.5, 0.4], tgh: 1, evn: 2, den: 1.8, note: 'pale-ish, round' },
      tom: { h: 0.9, W: 900, col: { O: 1 }, heavyCol: { T: 0.75, S: 0.25 }, t: [0.35, 0.2], tgh: 0.3, evn: 1.6, den: 1.2, note: 'tan, flat, TGH low' },
      mavis: { h: 0.5, W: 850, col: { O: 0.8, S: 0.2 }, heavyCol: { T: 0.7, S: 0.3 }, t: [0.5, 0.35], tgh: 1, evn: 1.8, den: 1.5 },
      hoot: { h: 0.2, W: 760, col: { O: 1 }, heavyCol: { T: 0.5, O: 0.5 }, t: [0.85, 0.6], tgh: 1, evn: 2.1, den: 1.5, note: 'orange, tall' },
      vale: { h: 0.0, W: 540, col: { O: 1 }, heavyCol: { O: 1 }, t: [0.8, 0.8], tgh: 1, evn: 2.7, den: 1.5, note: 'orange, even, tall' },
      // ferry: the chance her pollen reaches the Grange in a winter (from Y4), so the legend's genes land in a different year
      // on every farm (one cross used to jump the Balanced breeder +23% in Y5 and hand it the record by Y8 in 64% of careers)
      lindqvist: { h: 0.6, W: 2105, fromYear: 4, ferry: 0.7, col: { S: 0.6, O: 0.4 }, heavyCol: { T: 0.7, S: 0.3 }, t: [0.3, 0.1], tgh: 1.1, evn: 1.6, den: 1.8, note: 'huge, tan-salmon, flat' },
      // the Cove pool: open pollination's fathers, a weak and varied founder mix split into sub-lines so that open
      // pollinating year after year rarely meets the same family twice (F stays near 0)
      // W (design 900): open pollination is a safe step, not a road to the record, and a Grange line beats it in Y2
      cove: { h: 0.3, W: 780, sizeSd: 0.9, subLines: 8, col: { O: 0.75, S: 0.2, W: 0.05 }, heavyCol: { T: 0.6, S: 0.4 }, t: [0.5, 0.4], tgh: 1, evn: 1.7, den: 1.5, note: 'the Cove pool' },
      mystery: { h: 0.4, W: [550, 1250], sizeSd: 1.0, col: { O: 0.5, S: 0.2, T: 0.2, W: 0.1 }, heavyCol: { T: 0.6, W: 0.4 }, t: [0.5, 0.3], tgh: 1, evn: 1.5, den: 1.5, note: 'from a trench coat' },
    },
    founderDiv: 360, heavyShift: 0.5, sizeSd: 1.0, evnHeavy: -0.9,
    hybridVigour: 1.03, hybridOverlap: 0.1, inbredBadge: 0.4, plumpCorr: 0.3,
    plump: { noise: 3.2, cut: 1.4, centre: 6, scale: 1.4 },   // hint score = (sizeSum - centre)/scale + N(0, noise); |score| > cut
    grange: { lots: 3, pollen: 3, mystery: 20, fromYear: 2, seedK: 80, pollenK: 0.4, lotSeeds: 3 }, // seed = round5(80 (W/1000)^3)
    sales: { fromYear: 3, max: 3, k: 0.4, place: [2, 1.5, 1.2] },
    inbreeding: 0.3,                              // POT_eff x (1 - 0.3 F)
    regress: { mean: 900, h2: 0.45 },              // Grange genomes breed like mean + h2 (W - mean): seeds carry the line, not the luck
  },

  // ------------------------------------------------------------ §7 pumpkin season
  season: {
    // Base_y = 17 (1 + 0.12 (y - 1)), capped at y = 8 (design 22): the design's own ~20-24 families a year-1 day (with
    // R ~4 and buzz), growing to ~38 a day by Y5, which a 7-row field and a phone screen can both still hold
    base: 17, growth: 0.12, capYear: 8,
    rep: [0.7, 0.1],                              // REP = 0.7 + 0.1 R (design 0.55 + 0.15 R): a gentler in-season word-of-mouth loop
    wx: { base: 1.15, fog: 0.5, heat: 1.6, rain: 0.5 },
    buzz: [-0.2, 0.6],
    parkingLotPatch: { fromYear: 4, arrivals: 0.95 },
    weekday: 0.15,                                // weekday families = 0.15 x Base x REP x WX
    panic: 0.5,                                   // Panic Night = 0.5 x Base families in 30 s
    hourly: [0.8, 1.0, 1.15, 1.2, 1.15, 1.05, 0.95, 0.7], // arrival weights 9:00-16:00
    owlsFrom: 900,
    dwell: [70, 90], visibleCap: { phone: 16, desktop: 24 },
    expectedY1: { day: 20, W1: 16, W4: 26, heat: [40, 45], season: 230 },
    // the lot is what keeps the crowd legible on a phone: 9 + gravel 4 = 13 on foot on an ordinary busy day (design 10,
    // gravel 6, beach 6); past that, cars wait on Route 46. Howie (+4), the beach (+4) and Gran (+3) are the busy-day valves.
    // [integration] the beach is +4 again (the motion pass had made it +5): on the one-way road a heat-wave crowd with the
    // shuttle running put 5.1% of Y4 weekend minutes over the phone's 16 on foot (limit 5%); at +4 it is 4.4% and the
    // heat wave with every lever pulled still turns only ~13% of cars away (band 5-15%). layout ROAD.sand has one space each.
    parking: { y1: 9, beach: 4, gravel: 4, howie: 4, gran: 3 },
    road: { patience: [30, 60], heat: 0.7, howie: 1.5, gran: 1.5, turnR: -0.005, meterCars: 12, amber: 5, red: 10, howls: [0.5, 0.75] },
    tellHal: { mul: 0.5, ticks: 60 },
    beachSat: -3, beachPelicanSat: 3,
    family: { kids: 2 },
    // A visit is ~100 game-minutes from the car pulling in to it pulling away (the lot and the phone's crowd both count
    // it), with families strolling at 2.6 u/s: picking 6-11 minutes a row (design 10-20) keeps time to walk
    walkToGate: 8, pickTicks: [4, 9], possumPick: 1.33,
    // Detours at a stroll (design: the giant always for Photo Families and 40% of the rest, the maze 35%, raccoon kits
    // to the hay fort 80%): the giant corner is a ~25-unit round trip from the front rows, ~10 s of walking, so half the
    // Photo Families and a few fans make it, plus half the families who end up in the back rows (from row 5, beside
    // her); kits climb the hay fort beside the stand while their parent waits in line (raccoons 80%, others 25%;
    // possum joeys stay on mom's back) instead of walking the family there
    detour: { giantPhoto: 0.5, giant: 0.08, giantNear: 0.3, nearRow: 4, maze: 0.12, mazeTicks: 12, mazeKids: 5, fortKids: 5 },
    premium: { chance: -0.12, sensitive: -0.35 },
    bubbleTicks: 24, substitute: 0.5, softInstead: 0.5,   // a [?] lasts 4 s at 1x (design 30 ticks: 3.75 s)
    queue: { spots: 8, patience: 37, waitFree: 15, perTicks: 3, maxPenalty: 30 },
    strays: 0.3, strayRadius: 2,
    servers: { gran: 18, dez: 8 },
    you: { buffer: 2 },
    rush: { window: 12, max: 5, tip: 0.05 },
    tiers: { bargain: 0.85, fair: 1, premium: 1.25, fromYear: 2 },
    // Your sprint, in world units per real second at 1x like the rest of the motion numbers below: twice a family's
    // stroll, so a dash across the yard reads as running; stations are 1.3-3 s apart (the giant corner 3 s, by the
    // corral gate). A loaded wagon is hauled at a walk, 0.7 of it (4.2 u/s): a long, leaning stride with a hand back on
    // the handle, never a run (render/folk.js `pull`).
    farmer: { speed: 6, wagon: 0.7 },
    // restockLoad 1 (design 8): the barn has the wagon loaded and waiting, so your farmer grabs it and turns round; with
    // the farm's short cuts a restock is 4.8-5.7 s from the tap at the stand to the first fruit popping in at 1x
    actions: { tryAccept: 0.7, tryRegular: 0.85, trySat: 8, fetchSat: 15, restockLoad: 1, restockN: 12, popMs: 40, cutTicks: 10, treatTicks: 10 },
    wagons: { y1: 6, add: 4, price: 150, max: 14 },
    overnight: { n: 30, bea: 40, below: 0.5 },    // Fri and Sat nights only (design 20 every night)
    density: { y1: [8, 15], y3: [18, 28], y3hires: [12, 20] },
    sat: {
      start: 60, min: 0, max: 100, adult: 15, kid: 10, soft: 3, suggested: 8, alone: 3, adultMiss: -10, kidMiss: -10,
      noWagon: -5, bargain: 5, premiumSensitive: -10, premiumOther: -3, gawk: 5, golden: 8, goldenPhoto: 15,
      kidsFun: 5, cosy: 3, beach: -3, beachPelican: 3, trucked: -15, joey: 25, joeyAll: 5, playDead: -10,
    },
    stars: { div: 20, min: 1, max: 5 },
    R: { start: 3.0, k: 0.02, weekdayWeight: 0.25, carryMid: 3, carry: 0.75 },
    // photo5 0.02 (design 0.04): buzz counts happy Photo Families, so it grew with the crowd and pinned at +0.6 from year 3
    buzzK: { decay: 0.6, photo5: 0.02, low: -0.03 },
    // ---- [season slice] numbers the design leaves to the build (movement, pacing, the bots' attention)
    // ---- motion: what the eye sees at 1x, in world units per real second (adults are ~1.5-1.8 units tall). The sim moves
    // a walker speed / ticksPerSecond each tick, so the weekend's length in real time never changes how fast anyone looks.
    walk: 2.8,                        // a family's stroll (x species walk: possums 2.1, coyotes 3.4); kids keep up with a hop
    crossHurry: 1.6,                  // ...and they hurry across the road (after waiting at the kerb for a gap)
    // cars (sim/traffic.js, layout ROAD) cruise the lane at 8 u/s, pull away at 12 u/s/s and brake at 16 (never harder),
    // take the bend at the lane's end at 6.5, drive the beach road at 8, use the spur to the beach lot at 6 and back out
    // of a space on the sand at 3, and keep a gap of 0.5 behind the car ahead (they are 1.5 long). A car off the spur
    // waits for a gap to join, and after 0.5 s asks the cars that can still stop to let it in. A walker within 0.6 of a
    // car's path up to 3 ahead (a family crossing at a gate) stops it. At a space a family is out in 1 tick, and in in
    // 1. A pick-up car waits in the fog until its family is within 14 ticks (2.3 s) of walking out of the stand
    // (the queue ahead of them, the till, and the walk), so it pulls up as they come out.
    car: { speed: 8, accel: 12, brake: 16, bend: 6.5, sand: 8, bay: 6, back: 3, ask: 0.5, length: 1.5, gap: 0.5, lat: 0.6, look: 3, drop: 1, board: 1, call: 14 },
    maxRows: 3,                       // rows a family browses before it settles (Perfect Seekers browse all 3)
    fort: { raccoon: 0.8, others: 0.25, ticks: 10 }, giantTicks: 8, mazeShow: 0.2, // kits climb the fort; gawking; maze kids peek
    closing: 990,                     // 16:30: browsers head for the stand so the last families leave by 17:00
    queueReady: 1.4,                  // a family this close to the counter can be rung up
    bubbleHold: 24,                   // ticks a tapped [?] waits while you choose
    answerWait: 90,                   // a family waits this long for your farmer to arrive with an answer
    noWagonTicks: 16,                 // the "no wagon" bubble is only a sigh
    honeyPrice: 10, beaverTip: [2, 5],
    review: { chance: 0.45, keep: 12, fresh: 40 },   // fresh: lines remembered so the ticker doesn't repeat itself
    candidates: 160,                  // families pre-drawn per weekend day (common random numbers: N picks the first N)
    weekdayLast: 'Oct 23',            // weekday trickle Oct 1-23
    // year-1 lessons; first: the family already at the curb when the gate opens on the first Saturday (RING UP)
    scripted: { first: 'raccoon', foxAt: 546, possumAt: 547, joeyAfter: 26, wagons: 3, wagonRow: 3, granStock: 12 },
    howlCooldown: 40,                 // ticks between Hal's traffic howls
    bot: {                            // design §14 attention models (bots only). A person's timings are real seconds at 1x.
      attentive: { serveWait: 20, rows: 1 },  // ring up when two are waiting; a lone family is Gran's (18 ticks) unless she is
                                              // slow; checks the rows every second
      realistic: { react: [1.5, 4], perWindow: 5, window: 12, rows: 3 }, // 1.5-4 s reaction, <= 25 actions/min, rows every ~3 s
      novice: { serveEvery: 1, bubbles: 0.4, react: [2, 4] },
      restockBelow: 0.3, strayAt: 2, roadAt: 5,
    },
  },
  species: {                                      // §7 families; walk and patience multipliers, preference weights
    list: ['possum', 'skunk', 'raccoon', 'beaver', 'coyote', 'fox', 'owl', 'pelican', 'otter', 'seal'],
    possum: { walk: 0.75, patience: 1.0, kidMini: 0.9, prefs: { classic: 5, white: 1, warty: 1, cinderella: 1, blue: 1 } },
    skunk: { walk: 1.0, patience: 1.0, prefs: { classic: 4, white: 1, warty: 3, cinderella: 1, blue: 1 } },
    raccoon: { walk: 1.1, patience: 1.0, prefs: { classic: 3, white: 4, warty: 1, cinderella: 1, blue: 1 } },
    beaver: { walk: 1.0, patience: 1.1, tips: [2, 5], tipFull: 0.6, trucked: 0.4, prefs: { classic: 4, white: 1, warty: 1, cinderella: 1, blue: 3 } },
    coyote: { walk: 1.2, patience: 0.8, howlSat: 3, prefs: { classic: 3, white: 1, warty: 4, cinderella: 1, blue: 1 } },
    fox: { walk: 1.0, patience: 1.0, photo: 0.6, viral: 2, prefs: { classic: 2, white: 3, warty: 1, cinderella: 4, blue: 1 } },
    owl: { walk: 0.9, patience: 1.5, from: 900, prefs: { classic: 2, white: 1, warty: 3, cinderella: 1, blue: 3 } },
    pelican: { walk: 0.9, patience: 1.0, kidMini: 0.75, noWagon: true, prefs: { classic: 6, white: 1, warty: 1, cinderella: 1, blue: 1 } },
    // one pup, riding on mom's chest; two otter families in the patch at once raft up (hold paws): both +raftSat
    otter: { walk: 0.9, patience: 1.0, kids: 1, kidMini: 0.9, raftSat: 6, prefs: { classic: 3, white: 2, warty: 3, cinderella: 1, blue: 2 } },
    // harbor seals come by sea: they swim in, flump up the beach and go home rolling their pumpkins in front of them, so
    // they never take a parking space, queue on Route 46 or need a wagon (+seaSat: no parking!). Quick in the water
    // (swim x walk), happy to lie in a long line, bark back at the foghorn like the coyote pups, like them round and
    // grey-blue. (walk 0.7 held the Y4 phone crowd past its band: the flump reads slow, the sim keeps an amble.)
    // haulOut: seal families ashore at once. Seals skip the lot's cap, so each one ashore is an extra family on foot
    // (and a seal walks the whole farm, stand to sea): 3 put 8.2% of Y4 minutes over the phone's 16, 2 5.9%, 1 4.8%.
    seal: { walk: 0.9, swim: 1.2, patience: 1.3, barkSat: 3, seaSat: 3, haulOut: 1, noWagon: true, prefs: { classic: 4, white: 2, warty: 1, cinderella: 1, blue: 4 } },
    // kids want a mini 60% of the time (design 70%; joeys 90%, chicks 75%): ~1.3 mini wants a family, which one 300-mini row
    // covers in year 1 and two rows cover in the busiest later years
    wants: { adultLarge: 0.9, two: 0.2, kidMini: 0.6, weirdFromYear: 2, weird: 0.15 },
    types: {
      photo: { share: 0.15, fox: 0.6, weights: { white: 2, cinderella: 2 }, minFull: 0.5 },
      dayTripper: { share: 0.4, patience: 0.6, large: 2 },        // heat-wave days only
      seeker: { fromYear: 2, share: 0.10, rows: 3, dwell: 20, minFull: 0.6 },
      oldTimer: { fromYear: 2, share: 0.10, beaver: 0.3, owl: 0.3, premium: -0.35, trucked: 0.35 },
      panic: { fromYear: 3 },
    },
    fads: { confidence: [0.55, 0.85], hold: 1.8, priceTolerance: 0.25, fizzle: 0.8, viral: 0.25, viralMul: 1.5, viralWeekend: 2, reveal: 'Jul 1' },
  },

  // ------------------------------------------------------------ §8 the weigh-off
  weighoff: {
    eveSeconds: { y1: 10, later: 25 }, dawnSeconds: 4,
    lift: { beats: 4, neighbourPer: 15, minNeighbours: 6, ring: 0.9, ringPer500: 0.1, perfect: 0.08, good: 0.2,
      scuffAt: 2, crackChance: 0.15, cavityShare: 1 / 3, forklift: 200, forkliftFrom: 2, ringFrom: 3, autoRisk: 0.003 },
    reveal: { readCard: 3, lower: 3, count: 7, countTo: 0.85, crawlMs: 40, stall: 1, lock: 2, board: 3 },
    rivalSeconds: [5, 8], rivalSkipFrom: 2, rivalDigitsMs: 2800,   // a rival weigh-in: digits climb for 2.8 s, then a Next pumpkin button
    nightWatch: { seconds: 15, pairs: 8, visible: 1.4, visibleY4: 1.1, free: 2, mustache: 6,
      interest: { base: 0.3, crier: 0.3, fish: 0.2, top2: 0.2 }, floodlights: 2, mavis: 0.8, mavisNap: 0.1 },
    pretty: {
      colour: { O: 1.0, S: 0.75, T: 0.45, W: 0.7, striped: 0.85 },
      shape: { tall: 0.8, round: 1.0, flat: 0.4 },
      evenMildew: -0.1,
      // big ones slump (design -0.05 per 300 lb over 1,200): from 900 lb, -0.08 per 100 lb, so a Heaviest winner is rarely the
      // prettiest (Double Crown was 4% of Balanced years against a 5% cap and 27% of careers by Y8: no holy grail)
      symmetry: { base: 0.7, rotated: 0.25, flatBottom: -0.2, roundCull: 0.1, heavy: -0.1, slumpPer: 100, slumpFrom: 900, slump: -0.08 },
      stem: { base: 1.0, stump: 0.8, crack: 0.3 },
      scars: { sunscald: 1, crack: 2, heist: 1, scuff: 1 }, scarK: 0.6,
      rivalSd: 2.0,                             // design 1.5: with year-1 scars Grandpa's line won 11%, under the design's own 15-20%
      judges: {
        mayor: { colour: 2 }, edna: { shape: 2, shapes: { tall: 1.0, round: 0.6, flat: 0.2 } }, sasha: { evenness: 1.5, symmetry: 1.5 },
        guestFromYear: 3, moss: { asleep: 0.5, scores: [5.0, 9.5] }, vance: { stem: 3 },
      },
    },
    y1Pretty: { you: 24, vale: 25.5, winChance: [0.15, 0.2] },
    // [weighoff slice] additions
    dawnMinute: 360,                              // the clock reads 6:00 am on weigh-off morning
    rivalTape: 0.045,                             // rivals' own tape vs their true weight (yours averages ~4%)
    gag: { W: { 1: 147, 2: 2, 3: 46, 4: 61 }, beauty: 0.4 },   // the raccoons' disguises weigh what they weigh; legit beauty Y5+
    lift2: { minRing: 0.45, gap: 0.55, mavisBeat: 2, lead: 0.9 }, // ring floor, pause between beats, Mavis plays dead on beat 3
    brow: { up: 1, slight: 2 },                   // his eyebrow: her published estimate tops the field / is second
    verdict: { heavy: 0.03, light: -0.03 },       // "Dense. Like my patience." / "Air. Mostly air."
    forkliftCard: 'Sep 25',                       // the Y2+ September prep card offering the forklift
    scouts: { rate: 0.3 },                        // heist_scouts per eligible October weekday (once a year)
    // the Night Watch layout: 8 spots around the giant corner (x, y, z, where), the first pair at 0.8 s, then every 1.75 s
    nightWatchLayout: {
      first: 0.8, gap: 1.75, jitter: 0.35,
      spots: [[-19.0, 0.5, 7.4, 'hedge'], [-18.9, 0.5, 11.2, 'hedge'], [-17.4, 0.45, 13.9, 'fence'], [-13.6, 0.45, 13.8, 'hay'],
        [-11.6, 0.5, 11.4, 'corn'], [-11.5, 0.5, 7.2, 'corn'], [-13.4, 0.45, 4.4, 'hay'], [-17.6, 0.45, 4.6, 'fence'],
        [-12.2, 0.55, 9.3, 'corn'], [-18.6, 0.55, 9.2, 'hedge']],
    },
    reveal2: { stall: 1000, chartFlash: 900, hundredHaptic: 18 }, // ms: the stall short of the chart, CHART! flash, haptic per hundred
    photo: { w: 240, h: 180 },
  },
  rivals: {
    // wave 3: Vance 930 +3.8%/yr and Big Tom +3.5%/yr (design 950 / 900, +5%) keep year 1 winnable (~13%) and the Grange
    // lines a catch-up tool; the raccoons' first legit giant 1,100 (design 1,150); Lindqvist at her 1,450 peak (design +2%/yr)
    // and 45% attendance (design 50%) so she is the boss you sometimes beat. Balanced P(1st) 13/24/40/29/40% (Y1-Y5).
    vance: { name: 'Augustus Vance', farm: 'Vance Family Pumpkins', species: 'beaver', W0: 930, sd: 0.09, g: 0.038, dq: 0.05, beauty: 0.62, boast: 0 },
    tom: { name: 'Big Tom', farm: "Big Tom's Pumpkin Ranch", species: 'coyote', W0: 900, sd: 0.18, g: 0.035, dq: 0.25, beauty: 0.45, boast: 0.2 },
    mavis: { name: 'Mavis', farm: "Playin' Possum Pumpkins", species: 'possum', W0: 850, sd: 0.12, g: 0.04, dq: 0.08, beauty: 0.60, noShow: 0.4, boast: null },
    hoot: { name: 'Prof. Hoot', farm: 'Hootenanny Hollow', species: 'owl', W0: 760, sd: 0.08, g: 0.03, dq: 0.08, beauty: 0.70, boast: 0.05, last: true },
    vale: { name: 'Sienna Vale', farm: 'Gourdgeous', species: 'fox', W0: 540, sd: 0.08, g: 0.02, dq: 0.05, beauty: 0.85, boast: -0.05 },
    raccoons: { name: 'The Parking Lot Patch', farm: 'The Parking Lot Patch', species: 'raccoon', gag: true, legitFromYear: 5, W0: 1100, sd: 0.10, g: 0.03, dq: 0.08 },
    lindqvist: { name: 'Ingrid Lindqvist', farm: 'visiting legend', species: 'skunk', W0: 1450, sd: 0.10, g: 0, dq: 0.15, beauty: 0.50, fromYear: 4, attends: 0.45 },
    rubberBand: 0.06,
    record: { W: 1612, who: 'Vance Sr.', year: 1987 },
  },
  prizes: {
    heaviest: { perLb: [3, 0.8, 0.4], ribbon: 50, ribbonPlaces: [4, 6] },
    firstTimer: 100, personalBest: 200, personalBestFrom: 2, record: 2500,
    pretty: [400, 150, 50], doubleCrown: 1000, shinyAuction: [150, 600],
  },

  // ------------------------------------------------------------ §9 between years
  winter: {
    epilogueSeconds: 90, stencils: 4, trickOrTreaters: [2, 3],
    halloweenMinute: 1140,                        // [weighoff slice] 7 pm on Halloween: night falls on the porch
    scrapbook: { w: 240, h: 180, keep: 12, kb: 12 },
  },

  // ------------------------------------------------------------ §12 UI numbers the sim and UI share
  ui: {
    hud: 52, nextUp: 36, weekendRow: 32, station: 56, dock: 64, fab: 64, pin: 48, maxPins: 12,
    marleneIntroFog: 0.6,            // extra fog while the Mayor introduces Marlene on the dock (new-farm intro)
    sheetMax: 0.46, dialogMax: 0.30, decisionButton: 56, tapMin: 44, desktop: 900, textScale: [1, 1.15, 1.3],
    tap: { px: 10, ms: 300, hitPx: 24 }, zoom: { patch: 1.1, giant: 1.8, stand: 1.8, home: 0.55 },
    glide: { seconds: 0.6, touchedWithin: 2, toward: 0.65, back: 4 }, autosaveWeekend: 20,   // back: s before the director's look returns
    // [foundation] the shared moment components (plan §2.2, rulings R12): a banner shows 1.8 s (2.6 s BIG) plus reading time
    // for the character's line inside it; titles <= 16 characters at 28 px; a poke caption lives 1.8 s + 40 ms a character
    banner: { ms: 1800, bigMs: 2600, perChar: 40, maxMs: 6500, titleMax: 16, shieldMs: 450, queue: 4 },
    caption: { ms: 1800, perChar: 40, maxChars: 110 },
    bubble: { width: 320, gutter: 16 },
  },

  // ------------------------------------------------------------ growing-year tracks (plan §7.1, as amended by the rulings)
  // Skeletons with starting values. Each track owns its section and re-fits it; Wave 2 items (rulings R1) are left out.
  // [A] the delight lane (plan §3.1; rulings R0, R4, R10): a surprise with a ✦ pin, caused by the farm's state, spaced on its own
  // cadence and kept 12 s of 1x clear of lessons (the moments queue). Year 1 has five guaranteed slots (about one delight per
  // 60-75 s of 1x clock Apr-Jul with the caused ones inside the gap). gap1x: since the last delight or notable; slotGap1x: a
  // slot's own (shorter) gap; pity: rates x pityMul after this long without a surprise; novelty: x 0.5 per sighting in the
  // last two years; share: no id over max(floor, ceil(max x max(of, the year's delights))); pinLife1x: a ✦ pin's life, then
  // its "left alone" outcome; slotHold1x: a random delight keeps clear of a year-1 slot due within this long (its pin or its
  // visit would block the slot); fallbacks: how often a year one id may be a slot's fallback (the otter, rulings R4).
  lane: {
    // (slotGap1x is short: a heat wave's or Quarter Sun Day's toast the day before mustn't cost a slot its window; random
    // delights already keep slotHold1x clear of a slot, so two surprises in 60 s is the most it allows, rulings R10)
    // Years 2+: surprises (delights + notables) 0.5-0.8 a 1x minute while growing (rulings R10), and none of the months
    // under 0.4. The notables make ~0.5 of it, mostly from July (heat, Quarter Sun Day...), so the lane's long gap fills
    // the spring, which has none; first1x: the spring's first visitor waits this long (April isn't all of it). Measured
    // 0.79 (0.24 delights) over 40 farms' years 2-3 with no other track's moments (tests/balance/foundation.test.js).
    gap1x: { y1: 35, later: 135 }, slotGap1x: 10, pity1x: { y1: 75, later: 200 }, first1x: 40, pityMul: 3, novelty: 0.5,
    surprises: [0.5, 0.8],                        // years 2+: delights + notables a 1x minute while growing (rulings R10)
    share: { max: 0.2, floor: 2, of: 10 }, pinLife1x: 30, slotHold1x: 30,
    crowd1x: 60,                                  // rulings R10, year 1: at most two surprises (delights + notables) in any crowd1x
    // the regulars wear off slower than the rest (their bubbles are years 2+'s decisions: Pamela's menu, the possum's pouch)
    regulars: { pamela: 0.85, possum_nap: 0.85 },
    slotYield: 30,                                // a slot goes before waiting moments below this prio (T.moments.prio: tips, tallies, receipts)
    // a slot waits for its cause this share of its window; after that its first quiet day takes the fallback (a sowing day
    // can close the rest of a June window without notice: the watering lesson then says it's coming any day). Slot C waits
    // least: Pamela's first escape doesn't wait for the sun (plan §6.2: "slot C aside"); June is Marlene's month anyway.
    patience: { all: 0.5, C: 0 },
    // The summer windows are wider than plan §7.1's because the lessons around them move with the farm (the dawn, the
    // cull ten days after she sets, the bug lesson's forced cluster) and each closes 12 s of 1x on either side of it; a
    // slot fires on its first quiet day whose cause holds, and its fallback on its last chance (events.js slotPass: the
    // window's last day, its patience out, or the window about to close). F ends Jul 28: Jul 29 is 10.8 s before the Vine
    // Crawl (Aug 1). A fallback is never an id already seen this year (rulings R4, R19), so F, whose Pamela came in C,
    // lists the July weathers' visitors: sun, pea soup, a bee day after a sulk, then a clear day's whale as the fallback
    // (the owlets that held this slot are Wave 2).
    y1: { slots: {   // [first day, last day], ids in order; the last id is the fallback (fired without its weather precondition)
      A: [['Apr 7', 'Apr 12'], ['biscuit_dig']], B: [['Apr 24', 'Apr 25'], ['seal_haulout', 'otter_look']],
      C: [['Jun 8', 'Jun 16'], ['pamela']], E: [['Jul 3', 'Jul 14'], ['possum_nap']],
      F: [['Jul 17', 'Jul 28'], ['pamela', 'seal_haulout', 'swarm_look', 'whale']],
    } },
  },
  // [A] visitors (plan §3.2, §3.3). Year-1 effects are cosmetic or bounded (rulings R5, R16): no giant visits and no row hurt
  // in year 1; the possum's shield only helps. cap/cooldown per year [year 1, years 2+] where they differ.
  mischief: {
    // the camera's close frame on a ✦ tap (rulings R4: FRAMES.visit): world units that fit across the screen, by visitor
    look: { fit: 12, biscuit_dig: 9, otter_look: 7, skunk_shade: 9, whale: 18, volunteer_look: 14, pamela: 13 },
    dig: { months: ['Apr', 'May'], rate: 0.025, dryF: 0.6 },   // he digs on a dry morning (f < dryF); years 2+ now and then
    // fog visitors: pea soup or rain; she stays until Marlene lifts (f < liftF), 2-6 days; a coat you haven't met is newCoat
    // times likelier; she naps by the giant (sail down, giant at vines or later) or in a planted row's damp aisle
    seal: { f: 0.82, rate: 0.1, rateRain: 0.2, cooldown: 20, cap: [2, 3], stay: [2, 6], liftF: 0.6, newCoat: 3 },
    otter: { f: 0.6, months: ['Apr', 'May', 'Jun'], rate: 0.02 },
    // a grey-day visitor in a planted row (the buggiest one); once bugs are unlocked her joeys herd them off: the row's bugs
    // shrink a day while she rests and no cluster starts there for shieldDays. Years 2+: a bubble, rest or the pouch (coupon $).
    possum: { f: 0.45, rate: 0.07, bugsMul: 2, cooldown: 18, cap: [2, 3], stay: 4, shrink: 0.15, shieldDays: 10, coupon: 20 },
    // a heat day (or f < f) with the sail up; they leave when the heat breaks; startled, the corner is skunked for 7 days
    skunks: { rate: 0.12, f: 0.1, cooldown: 10, cap: 2, skunkedDays: 7 },
    // year 1 before the honey lesson: a look-only swarm on the scarecrow, the first f < clearF morning after sulkDays of f >= sulkF
    swarm: { sulkDays: 3, sulkF: 0.75, clearF: 0.4, months: ['Jun', 'Jul', 'Aug', 'Sep'] },
    // Pamela hops the fence on sunny days (f < f): from Jun 6 in year 1 (her first escape is slot C, into the bramble), May 1
    // later. cooldown [days, days after a visit of fullDays or more]; cap a year [Y1, Y2, Y3+]; she stays up to maxDays.
    // Each bramble day clears lumpsPerDay of the row's lumps (render) and takes discountPerDay off its shop price (capped).
    // Years 2+ only: rows (hurt rowHurt a day), the giant's leaves (a scuff) and the drift from the bramble into a planted
    // neighbour. beeChase: on a bee day with the hives at least beeFull of their cap, the bees send her home on day 1.
    pamela: { from: ['Jun 6', 'May 1'], f: 0.45, rate: 0.15, cooldown: [12, 18], fullDays: 3, cap: [3, 4, 5], maxDays: 4, lumpsPerDay: 3,
      weights: { bramble: 3, rowFlowers: 2, rowVines: 1.5, giant: 1, washing: 1 }, rowHurt: 0.06, drift: 0.2,
      discountPerDay: 50, discountCap: 300, beeChase: 0.3, beeFull: 0.67 },
  },
  // [D] pokes, Grandpa's notes, Firsts and the Next-stop chip
  pokes: {
    idleSparkle: { afterS: 6, ms: 3000, until: 'Jun 1', waitMs: 8000 },   // year 1's April and May: the first idle sparkles a poke
                                                  // target (waiting up to waitMs for a banner on screen to go)
    fetchOn: 3,                                   // Biscuit's third poke of a game day is a fetch
    digEvery: 8,                                  // Biscuit digs in the bramble at most once in this many game days
    burst: { n: 3, ms: 5000 },                    // three foghorns in five seconds is a burst (startles the visitors)
    // Grandpa's six notes from his old biscuit tin (plan §3.5, rulings R0, R15), each a few days before its system. A note
    // rides the first carrier that comes for it (`via`: from `from` on, or once `rows` rows are sown), at most one a day,
    // in order; failing that, Biscuit leaves it by the stand on the `by` morning (it waits porchWait days for a quiet
    // moment, then sits there as a pin until it's read). Note 1's `by` is the morning after track A's dig slot (Apr 7-12),
    // so the porch never beats the dog to the tin.
    notes: [
      { by: 'Apr 13', from: 'Apr 1', via: ['dig'] },        // 1: Biscuit's dig (track A's slot A) turns up the tin
      { by: 'Jun 16', rows: 1, via: ['sowing'] },            // 2: watering, on the first sowing day
      { by: 'Jun 28', rows: 2, via: ['sowing'] },            // 3: fog and the bees, before the dawn
      { by: 'Jul 18', rows: 4, via: ['sowing'] },            // 4: squash bugs, before the bug lesson
      { by: 'Aug 21', from: 'Aug 14', via: ['bottle'] },     // 5: creaks, in the otter's kelp (track A) or the kelp pin
      { by: 'Sep 15', from: 'Sep 1', via: ['bramble', 'fetch'] },   // 6: '87, before the weigh-off
    ],
    porchWait: 2,
  },
  // A First shows at once when it answers the player's own tap or card; any other waits up to waitDays for a quiet window
  // (the moments queue), and past that it is filed silently (rulings R2, R19). Ladder rungs read the tape's estimate.
  firsts: { waitDays: 3,
    ladder: [[60, 'lb60'], [100, 'lb100'], [300, 'lb300'], [500, 'lb500'], [750, 'lb750'], [1000, 'lb1000'], [1147, 'lb1147']],
    seedling: { leafDays: 6, leaves: 6 },         // her seedling grows a true leaf every 6 days in the pot (render/giant.js)
    signPaintS: 1.2 },                            // MEET {NAME}: the sign paints her name over this many seconds
  road: { quiet: { mul: 2, lookahead: 2 }, stops: 3, chipMax: 26 },
  // [C] the Vine Crawl, lean (rulings R0, R5): guesses only, no review or buzz in Wave 1. Each rival's eyeball is
  // est x (1 + bias + sd x z), keyed (never the rivals stream); look is how much of Vance's error is her density (a dense one
  // sits low and looks small, so a deep knock means the tape beats his eyeball: the knock is the one good hint). Your guess is
  // a range around Vance's line; green: a guess within 10% of the tape. Edna's Sunday tape (rulings R4): every Sunday after
  // the Crawl, unless the last tape is fewer than skipWithin days old; it waits wait days for a quiet window.
  // hush: at the Crawl the whole Cove goes quiet for your knock, so it is the clearest knock of the year (the mean of
  // `hush` knocks' noise).
  // knockRead: a knock deeper than 1 - this reads THOONK (she'll tape over), higher than 1 + this reads tonk (under), else
  // thunk. Measured over 300 farms (tests/sim/crawl.test.js): reading the hushed knock 61% right, the middle 55%, blind 34%.
  crawl: { guess: { tom: [0.40, 0.15], vance: [0, 0.12], look: 0.8, round: 5 }, range: [0.92, 1.08], green: 0.10,
    hush: 4, knockRead: 0.15,
    sunday: { skipWithin: 2, wait: 2 } },
  // [E] the hands-on close-ups: the bug hunt (rulings R0)
  // The close-up looks at the row's cluster from the front (az 0) with fit world units across: fit 4.2 on a 390 px phone is
  // ppu 93 px a unit, and the camera squashes the ground's depth to squashZ of that on screen. A row shows up to `bugs`.
  hands: { fit: 4.2, ppu: 93, squashZ: 0.75, bugs: 14,
    reachPx: 28, leafReachPx: 40, comboS: 0.7, comboGran: 5, timerS: 10, simpleTimer: 1.5,
    crawl: 0.2, wander: 2.2, area: [1.1, 0.5], flee: { r: 1.2, speed: 0.9, ms: 600 }, speedUp: 0.1, speedCap: 0.6,
    // the big leaves a bug can run under: a cluster of n bugs has those whose leavesFrom <= n (a settled-in cluster has
    // more cover: answering early is easier), each holding at most leafCap
    leaves: [[0.1, -0.65], [-1.45, 0.55], [1.5, 0.5]], leavesFrom: [0, 6, 10], hideR: 0.12, leafCap: 3,
    // the headless thumb (hunt.js playerOf): [skill 0, skill 1] ends of the tap gap, eye-thumb lag, miss (px), first tap (s)
    player: { gap: [0.75, 0.3], react: [0.4, 0.16], aim: [18, 6], first: [0.9, 0.45] },
    // the clock a hunt holds: the camera coming in and the ending (base) plus the play, measured from playHunt at the
    // balanced thumb (about half a second a bug), never more than the ring (the pacing harness charges this)
    session: { base: 1.9, perBug: 0.5 },
    bot: { sessions: 2 },                                 // a bot's hunts a row a day (bugs left when the ring ran out: again)
    grace: 5,                                             // days a row cleared by hand stays clear (a spray: T.patch.bugs.block)
    maxExtraDraws: 8 },
};
export default T;
