import type { T, RivalId } from './tuning.js';

/** A feed plan: none, kelp, fish or both. */
export type FeedId = keyof typeof T.giant.feed;
import type { Card } from './cards.js';
import type { Lapse, MomentItem, Receipt, Target, Vars } from './types.js';

export interface Meta {
  species: string;
  surname: string;
  farmName: string;
  firstPlay: boolean;
}

/** One seeded stream; see rng.ts. */
export interface Rng {
  s: number;
}

export interface Clock {
  year: number;
  day: number;
  minute: number;
  phase: string;
  sub: string | null;
  speed: number;
  prevSpeed: number;
  dayFrac: number;
  clock1x: number;
  acc: number;
  skipTo: number | null;
  /** A hands-on close-up holding the clock. Saved as null. */
  hands: { verb: string; at: number } | null;
}

export interface Rep {
  R: number;
  buzz: number;
}

export interface Prefs {
  autoSlowCreaks: boolean;
  relaxedRegister: boolean;
}

export interface WeatherForecast {
  day: number;
  f: number;
  heat: number;
  rain: number;
  sd: number;
}

export interface WeatherDay {
  f: number;
  heat: number;
  rain: number;
}

export interface WeatherScript {
  kelp: number;
  heat: number[];
  heatW3: number[];
}

export type ArchetypeId = keyof typeof T.weather.archetypes;

export interface Weather {
  f: number;
  heat: number;
  rain: number;
  archetype: ArchetypeId;
  hint: ArchetypeId;
  forecast: WeatherForecast[];
  days: WeatherDay[];
  script: WeatherScript | null;
}

export interface Loan {
  owed: number;
  total: number;
  repaidPct: number;
  warned: boolean;
  /** year * 400 + day of the last mid-season loan */
  lentOn?: number;
}

export interface LedgerYear {
  y: number;
  cashStart: number;
  income: Record<string, number>;
  expense: Record<string, number>;
}

export interface LedgerHistory {
  year: number;
  income: Record<string, number>;
  expense: Record<string, number>;
  net: number;
  cashStart: number;
  cashEnd: number;
}

export interface Ledger {
  year: LedgerYear;
  history: LedgerHistory[];
}

export type ShopId = keyof typeof T.shop;
export type HireId = keyof typeof T.hires;
export type ItemId = ShopId | HireId;

/** The last purchase of a consumable: year, day, and how many bought so far. */
export interface Consumable {
  y: number;
  d: number;
  n: number;
}

/** What the farm owns. A once item is true or a count (max > 1), a yearly one the year paid for. */
export interface Owned extends Partial<Record<ShopId, true | number | Consumable>> {
  row5?: true;
  row6?: true;
  row7?: true;
  wagons?: number;
  loft?: true;
  irrigation?: true;
  tape?: true;
  hive?: number;
  shadeMotor?: true;
  compost?: number;
  gravel?: true;
  soaker?: true;
  plot2?: true;
  ring?: true;
  floodlights?: true;
  billboard?: number;
  cables?: true;
  clubdb?: true;
  radio?: Consumable;
  shuttle?: Consumable;
  forklift?: Consumable;
}

/** The year each hand is hired for. */
export type Hires = Partial<Record<HireId, number>>;

export interface PatchRowStock {
  green: number;
  prime: number;
  soft: number;
  rotten: number;
}

export interface PatchRowShiny {
  id: string;
  kind: string;
}

export interface PatchRowPlan {
  variety: string;
  day: number;
  waited?: boolean;
}

export interface PatchRowBy {
  green: number;
  prime: number;
  soft: number;
}

/** Fruit goes green, then prime, then soft; it leaves the row when it rots. */
export type FruitStage = 'green' | 'prime' | 'soft';

export interface PatchRowFruit {
  v: string;
  n: number;
  off: number | null;
  st: FruitStage;
  age: number;
  sa: number;
  tr: boolean;
  rd?: number;
  o?: number;
}

export interface PatchRowRot {
  n: number;
  d: number;
  v: string;
}

export interface PatchRowLost {
  dry: number;
  fog: number;
}

export interface PatchRow {
  open: boolean;
  variety: string | null;
  plantedDay: number | null;
  progress: number;
  stage: string;
  stock: PatchRowStock;
  health: number;
  bugs: number;
  mildew: number;
  shiny: PatchRowShiny | null;
  late: boolean;
  plan: PatchRowPlan | null;
  set: number;
  beeFrac: number;
  by: Record<string, PatchRowBy>;
  fruit: PatchRowFruit[];
  rot: PatchRowRot[];
  beeDays: number;
  beeGood: number;
  sprayed: boolean;
  sprayUntil: number;
  milkUntil: number;
  drop: number;
  ripeDay: number | null;
  midDay: number | null;
  lost: PatchRowLost;
  told: number;
  slow: number;
  shieldUntil: number;
  setDay?: number;
}

export interface PatchBarnLot {
  v: string;
  n: number;
  age: number;
  st: FruitStage;
  sa: number;
  tr: boolean;
  o?: number;
}

export interface PatchFad {
  year: number;
  variety: string;
  confidence: number;
  held: boolean;
  viral: string | null;
  revealed: boolean;
}

export interface PatchShiny {
  id: string;
  row: number | null;
  v: string;
  kind: string;
  state: string;
  day: number;
  until: number;
  year: number;
  value?: number;
}

export interface PatchVolunteer {
  spot: string;
  day: number;
  shiny: boolean;
  state: string;
  seen?: boolean;
}

export interface PatchSwarm {
  spot: string;
  day: number;
}

export interface PatchReportRowLost {
  bugs: number;
  dry: number;
  mildew: number;
  goat: number;
}

export interface PatchReportRow {
  variety: string;
  plantedDay: number | null;
  ripeDay: number | null;
  set: number;
  beeFrac: number;
  sold: number;
  soldSoft: number;
  soft: number;
  softDaySum: number;
  rotten: number;
  green: number;
  cut: number;
  restocked: number;
  truckedSold: number;
  clusters: number;
  mildew: number;
  soldOutDay: number | null;
  lost: PatchReportRowLost;
  wk?: number[];
}

export interface PatchReportBarn {
  cut: number;
  out: number;
  soft: number;
  rotten: number;
}

export interface PatchReportTrucked {
  lots: number;
  n: number;
}

export interface PatchReportOct {
  big: number;
  small: number;
  missBig: number;
  missSmall: number;
  soft: number;
}

export interface PatchReport {
  y: number;
  rows: (PatchReportRow | null)[];
  unmet: Record<string, number>;
  barn: PatchReportBarn;
  trucked: PatchReportTrucked;
  oct: PatchReportOct[];
  wkd: PatchReportOct;
}


export interface PatchShelfLast {
  lvl: number[];
  stage: string[];
  hi: number[];
  feed: number[][];
  at: number[][][];
  slip: number[];
  tally: number;
  tLvl: number[];
  tAt: number[][];
  tWater: number;
  tSlip: boolean;
}

export interface PatchB {
  handover: boolean;
  planned: boolean;
  honey: boolean;
  honeyLast: number | null;
  safety: boolean;
  window: boolean;
  lapse: boolean;
  fogJobs: number;
  sowAt: number | null;
}

export interface Patch {
  rows: PatchRow[];
  moisture: number;
  wet: boolean;
  watered: number;
  firstPlant: number | null;
  barn: Record<string, number>;
  barnLots: PatchBarnLot[];
  hives: number;
  freeHives: number;
  honeyJars: number;
  honeyReady: number;
  honeyTotal: number;
  fad: PatchFad | null;
  nextFad: PatchFad | null;
  shinies: PatchShiny[];
  volunteer: PatchVolunteer | null;
  swarm: PatchSwarm | null;
  trucked: { day: number; n: number }[];
  barnGoal: string | null;
  seq: number;
  hist: Record<string, number[][]>;
  report: PatchReport;
  lastReport: PatchReport | null;
  shelfLast: PatchShelfLast | null;
  sown: Record<string, number>;
  b: PatchB;
  barnDay?: number | null;
}

export type Plump = 'Plump' | 'Average' | 'Thin';

/** One haplotype, the loci in order S1, COL, S2, DEN, S3, EVN, TGH, SHP (genetics.ts names them). */
export type Haplotype = [number, string, number, number, number, number, number, string];

/** A diploid genome: plain JSON. `mut` names the mutation a gamete carried ('white' or 'stripe'). */
export interface Genome {
  a: Haplotype;
  b: Haplotype;
  F: number;
  het: boolean;
  anc: Record<string, number>;
  stripe: number;
  mut?: string;
}

export interface GeneticsSeedMother {
  short: string;
  seed: string | null;
  weight: number | null;
  est: number | null;
  pct: number | null;
  colour: string;
  shape: string;
  stripe: boolean;
  dmg: boolean;
  name: string;
  year: number;
}

export interface GeneticsSeedFather {
  kind: string;
  name: string;
  line: string | null;
}

export interface GeneticsSeed {
  id: string;
  name: string;
  short: string;
  year: number;
  source: string;
  genome: Genome;
  F: number;
  plump: Plump;
  mother: GeneticsSeedMother;
  father: GeneticsSeedFather;
  backup?: boolean;
}

export interface GeneticsPollen {
  id: string;
  line: string;
  W: number;
  name: string;
  price: number;
  genome: Genome;
}

interface GeneticsOfferBase {
  id: string;
  line: string;
  name: string;
  price: number;
  bought?: boolean;
}

/** A Grange pollen pack. */
export interface GeneticsPollenOffer extends GeneticsOfferBase {
  kind: 'pollen';
  W: number;
  genome: Genome;
}

/** A Grange seed lot, or the mystery packet (W is null). */
export interface GeneticsSeedOffer extends GeneticsOfferBase {
  kind: 'seed' | 'mystery';
  W: number | null;
  genomes: Genome[];
}

export type GeneticsOffer = GeneticsPollenOffer | GeneticsSeedOffer;

export interface Genetics {
  seeds: GeneticsSeed[];
  pollen: GeneticsPollen[];
  plant: [string | null, string | null];
  offers: GeneticsOffer[];
  lotYear: number;
  sold: number;
  nextId: number;
}

export interface GiantSeed {
  id: string;
  short: string;
  name: string;
  source: string;
}

export interface GiantFather {
  kind: string;
  name: string;
  line?: string;
  genome?: Genome;
}

export interface GiantPre {
  days: number;
  good: number;
  kelp: number;
}

export interface GiantDays {
  set: number;
  kelp: number;
  heavy: number;
  radio: number;
}

export interface GiantMeasure {
  day: number;
  ott: number;
  est: number;
  by: string;
}

export interface GiantCreak {
  day: number;
  end: number | null;
  outcome: string | null;
  practice: boolean;
  soft: boolean;
}

export interface GiantScarsBy {
  sunscald: number;
  crack: number;
  heist: number;
  goat: number;
  scuff: number;
}

export interface GiantResult {
  W: number | null;
  place: number | null;
  exhibition: boolean;
  dq: boolean;
  pct: number | null;
  pretty?: number | null;
  fallback?: boolean;
}

export interface GiantSecret {
  vigor: number;
  potEff: number;
  rhoZ: number;
  cavityU: number;
  rho: number;
  wTrue: number;
}

export interface GiantCrier {
  pending?: boolean;
  told: boolean;
  est: number | null;
  day: number;
}

export interface GiantLastRecord {
  lb: number;
  days: number;
  name: string;
}

export interface GiantTipPending {
  day: number;
  text: string;
}

export interface GiantHistoryMeasure {
  t: number;
  est: number;
}

export interface GiantHistoryResult {
  W: number | null;
  place: number | null;
  exhibition: boolean;
}

export interface GiantHistory {
  year: number;
  name: string | null;
  measures: GiantHistoryMeasure[];
  result: GiantHistoryResult | null;
  split: string | null;
  creaks: number;
}

export interface GiantMoving {
  day: number;
  pick: number;
  fc: number | null;
  f: number | null;
  rootDays: number | null;
  rootedDay: number | null;
  foggier: boolean;
}

export interface GiantNotebookChoice {
  d: number;
  id: string;
  text: string;
}

export interface GiantNotebook {
  choices: GiantNotebookChoice[];
}

export interface GiantWave {
  from: number;
  scalds: number;
}

/** One plant: the main giant (plot 1) or the second plot. */
export interface GiantPlant {
  plot: number;
  stage: string;
  seed: GiantSeed;
  genome: Genome;
  F: number;
  het: boolean;
  color: string;
  shape: string;
  stripe: boolean;
  evenness: number;
  name: string | null;
  startDay: number | null;
  germDay: number | null;
  failed: boolean;
  transplantDay: number | null;
  vineDay: number | null;
  flowerDay: number | null;
  cardDay: number | null;
  dawn: number;
  fails: number;
  setDay: number | null;
  cullDay: number | null;
  t: number;
  father: GiantFather | null;
  hat: boolean;
  moon: number | null;
  cull: string | null;
  twins: boolean;
  vigorHint: string | null;
  pre: GiantPre;
  days: GiantDays;
  m: number;
  mHist: number[];
  swing: number;
  stressHist: number[];
  wc: number;
  gain: number;
  est: number;
  ottShown: number;
  measures: GiantMeasure[];
  bestPerDay: number;
  creaking: boolean;
  creakDays: number;
  practice: boolean;
  softSpot: boolean;
  creaks: GiantCreak[];
  split: string | null;
  splitDay: number | null;
  cracked: boolean;
  treated: boolean;
  seedsOk: boolean;
  scars: number;
  scarsBy: GiantScarsBy;
  rotated: boolean;
  stemCrack: boolean;
  mustache: boolean;
  mutationShown: boolean;
  result: GiantResult | null;
  secret: GiantSecret;
  rootedDay?: number;
  liftCrack?: boolean;
  liftCavity?: boolean;
}

/** The main giant: the plant plus the corner it grows in (care, rituals, notebook) and the optional second plot. */
export interface Giant extends GiantPlant {
  regime: string;
  regimeDay: number;
  feedWanted: FeedId | null;
  feed: FeedId;
  fedToday: FeedId;
  shade: boolean;
  motor: boolean;
  motorCall: number;
  radio: string | null;
  kelpFree: number;
  crier: GiantCrier | null;
  talks: Record<string, number>;
  talkCount: number;
  thanked: boolean;
  knocks: number;
  thirsty: boolean;
  lastRecord: GiantLastRecord | null;
  mutation: 'white' | 'stripe' | null;
  tipNext: number;
  tipPending: GiantTipPending | null;
  tipRitual: number;
  moodYear?: number;
  history: GiantHistory[];
  moving: GiantMoving | null;
  notebook: GiantNotebook;
  receipts: Record<string, number>;
  wave: GiantWave | null;
  plot2: GiantPlant | null;
}

export interface SeasonFarmerTarget {
  x: number;
  z: number;
}

export interface SeasonFarmerTask {
  k: string;
  to: string | null;
  row: number | null;
  fam: number | null;
  want: string | null;
  v: string | null;
  id: string | null;
  on: boolean | null;
  ev: string | null;
  plot: number | null;
  step: number;
  wait: number;
}

export interface SeasonFarmerHome {
  x: number;
  z: number;
}

export interface SeasonFarmer {
  x: number;
  z: number;
  heading: number;
  target: SeasonFarmerTarget | null;
  busy: boolean;
  at: string | null;
  tasks: SeasonFarmerTask[];
  path: number[][];
  pi: number;
  carry: string | null;
  home: SeasonFarmerHome;
  since: number;
}

export interface SeasonParking {
  used: number;
  cap: number;
  main: number;
  beach: number;
  beachOpen: boolean;
}

export interface SeasonRoad {
  q: number;
  turned: number;
  cars: { e: CrowdEntry; pat: number }[];
}

export interface SeasonWagonsStray {
  id: string;
  x: number;
  z: number;
  lesson: boolean;
}

export interface SeasonWagons {
  total: number;
  free: number;
  strays: SeasonWagonsStray[];
}

export interface SeasonGran {
  t: number;
  direct: boolean;
}

export interface SeasonDez {
  t: number;
  away: boolean;
}

export interface SeasonYou {
  buffer: number;
  rush: number;
  last: number;
  auto: number;
}

export interface SeasonReview {
  stars: number;
  species: string;
  text: string;
  cause: string;
  d: number;
  m: number;
}

export interface SeasonNext {
  viral: number;
  backfire: number;
}

export interface SeasonDayBest {
  score: number;
  text: string;
}

export interface SeasonDay {
  d: number;
  rStart: number;
  n: number;
  sched: CrowdEntry[];
  ptr: number;
  arrived: number;
  served: number;
  byYou: number;
  turned: number;
  walkoffs: number;
  queued: number;
  halSkipped: number;
  rev: number;
  byV: Record<string, number>;
  tips: number;
  honey: number;
  starsSum: number;
  starsN: number;
  photo5: number;
  low: number;
  best: SeasonDayBest | null;
  firstBad: boolean;
  golden: boolean;
  acts: number;
  maxRush: number;
  howl: number;
  howlAt: number;
  fetches: number;
  rafts: number;
  soldOut: number[];
}

export interface SeasonTotalsWeekday {
  families: number;
  amt: number;
}

export interface SeasonTotalsBind {
  supply: number;
  checkout: number;
  wagons: number;
  parking: number;
  road: number;
}

export interface SeasonTotals {
  families: number;
  served: number;
  turned: number;
  walkoffs: number;
  weekday: SeasonTotalsWeekday;
  revenue: number;
  byV: Record<string, number>;
  tips: number;
  honey: number;
  starsSum: number;
  starsN: number;
  rStart: number;
  buzzPeak: number;
  goatAte: number;
  uturnDays: number;
  bind: SeasonTotalsBind;
  acts: number[];
  conc: number[];
  fetched: number;
  rushTips: number;
  rafts: number;
  raftDays: number;
  why: Record<string, number>;
  starsHist: number[];
}

export interface SeasonCensus {
  on: number;
  gawk: number;
  possums: number;
  want?: number;
}

// One planned arrival: the game-minute, the crowd index its dice come from, the species, a scripted visit.
export type CrowdEntry = [minute: number, i: number, species: string, script?: string | null];

export interface FamilyWant {
  v: string;
  kid: boolean;
  k: number;
  st: string;
  got: string | null;
}
export interface FamilyKid {
  v: string | null;
  got: boolean;
  hop: number;
}
export interface FamilyBubble {
  v: string | null;
  kind: string;
  t: number;
  held: number;
  t0: number;
  looked: boolean;
}
export interface FamilyCartItem {
  v: string;
  soft: boolean;
  tr: boolean;
  kid: boolean;
}
export interface FamilyResume {
  state: string;
  go: string | null;
  t: number;
}

/** What the path walker moves: a family, or your farmer (the one with tasks). */
export interface Walker {
  x: number;
  z: number;
  heading: number;
  path: number[][];
  pi: number;
  target: { x: number; z: number } | null;
  kerb?: boolean;
  tasks?: SeasonFarmerTask[];
}

// A visiting family, from its car to the till and back (sim/season.ts).
export interface Family {
  id: number;
  species: string;
  type: string;
  state: string;
  x: number;
  z: number;
  heading: number;
  path: number[][];
  pi: number;
  target: { x: number; z: number } | null;
  spd: number;
  wants: FamilyWant[];
  kids: FamilyKid[];
  want: string | null;
  bubble: FamilyBubble | null;
  cart: FamilyCartItem[];
  sat: number;
  why: Record<string, number>;
  rows: number[];
  fulls: number[];
  t: number;
  wait: number;
  pat: number;
  park: string;
  wagon: number;
  noWagon: boolean;
  dets: string[];
  rng: Rng;
  arr: number;
  script: string | null;
  joey: boolean;
  carpool: boolean;
  raft: number;
  dead: boolean;
  golden: boolean;
  bubbled: boolean;
  fort: number;
  near: boolean;
  kerb: boolean;
  car: number | null;
  go: string | null;
  row: number;
  noticed: boolean;
  stars: number;
  resume: FamilyResume | null;
}

// A car on the road (sim/traffic.ts): its route r, distance s along it, speed v and the space it holds.
export interface Car {
  id: number;
  fam: number;
  k: string;
  r: string;
  s: number;
  v: number;
  slot: number;
  wait: number;
  t: number;
  q: number;
  bx: number;
  bz: number;
}

export interface SeasonPuff {
  x: number;
  z: number;
  until: number;
}
export interface SeasonGoat {
  x: number;
  z: number;
  row: number;
  ate: number;
  shoo: number;
  t: number;
}
export interface SeasonRunaway {
  x: number;
  z: number;
  v: string;
  end: number;
}
export interface SeasonDecorator {
  v: string;
  n: number;
  due: string;
  mul: number;
  state: string;
}
export interface SeasonPanic {
  y: number;
  n: number;
  sold: number;
  amt: number;
}

export interface Season {
  families: Family[];
  queue: number[];
  seq: number;
  cars: Car[];
  carSeq: number;
  fogSeq: number;
  farmer: SeasonFarmer;
  parking: SeasonParking;
  road: SeasonRoad;
  wagons: SeasonWagons;
  gran: SeasonGran;
  dez: SeasonDez;
  you: SeasonYou;
  tier: string;
  shuttleOn: boolean;
  radioW: number;
  halUntil: number;
  golden: boolean;
  puffs: SeasonPuff[];
  goat: SeasonGoat | null;
  runaway: SeasonRunaway | null;
  whale: { end: number } | null;
  closed: Record<string, number>;
  reviews: SeasonReview[];
  next: SeasonNext;
  viralW: number;
  oldTimerW: number;
  decorator: SeasonDecorator | null;
  panic: SeasonPanic | null;
  day: SeasonDay;
  totals: SeasonTotals;
  acts: number[];
  bea: number;
  census: SeasonCensus;
  recentLines?: string[];
  soldOutNoon?: number;
  shuttlePlan?: boolean;
  radioPlan?: boolean;
  goatLogged?: boolean;
  /** switches the season off for this year (no crowd, weekday sales or overnight restock): balance harnesses bring their own demand */
  offstage?: boolean;
}

export type Grade = 'perfect' | 'good' | 'wobble';
export type Brow = 'up' | 'slight' | 'none';
export type LiftAuto = 'ring' | 'forklift' | null;

/** One pair of eyes in the Night Watch: when it shows, where, and who covers it without the player. */
export interface WatchPair {
  k: number; at: number; vis: number; x: number; y: number; z: number; where: string;
  auto: 'biscuit' | 'flood' | 'mavis' | null;
}
export interface WatchResult { caught: boolean[]; misses: number; scratches: number; mustache: boolean }
export interface LiftResult { grades: Grade[]; scuff: boolean; crack: boolean; perfect: boolean }
export interface Standing { id: string; place: number; W: number }
export interface Prize { cat: string; label: string; amount: number; id?: string; shiny?: string }

/** One step of the weigh-off day, tagged by `k`. The fields besides `k` are filled when the step is entered. */
export type WeighoffStep =
  | { k: 'eve' | 'dawn' | 'arrive' | 'welcome' }
  | { k: 'watch'; pairs: WatchPair[]; seconds: number; flood: boolean; mavis: boolean; nap: boolean;
      done?: boolean; result?: WatchResult }
  | { k: 'lift'; plot: number; id: string; auto: LiftAuto; beats: number; mavisAt: number; ring: number;
      neighbours: number; done?: boolean; result?: LiftResult }
  | { k: 'inspect'; plot: number; id: string; pass: boolean; brow: Brow; lines: string[] }
  | { k: 'pretty'; judges: string[] }
  | { k: 'weigh'; id: string; read?: string; note?: string; standings: Standing[]; dq: boolean;
      pb?: boolean; record?: boolean; verdict?: string }
  | { k: 'results'; place: number | null; prizes: Prize[]; total: number; pb: boolean; record: boolean; crown: boolean;
      best: string | null; W: number | null; pct: number | null; prettyPlace: number | null; winner: string | null;
      vows: RivalId | null; exhibition: boolean; seeds?: string };
export type WeighoffStepOf<K extends WeighoffStep['k']> = Extract<WeighoffStep, { k: K }>;

export interface WeighoffEntry {
  id: string;
  you: boolean;
  plot?: number;
  name: string;
  grower: string;
  farm: string;
  species: string;
  est: number | null;
  sortEst: number;
  dq: boolean;
  weighed: boolean;
  pallet: number;
  gag?: boolean;
  beauty?: number;
  exhibition?: boolean;
  W?: number;
  chart?: number;
  pct?: number;
  place?: number | null;
}

export interface WeighoffRival {
  id: RivalId;
  W: number;
  chart: number;
  est: number | null;
  dq: boolean;
  show: boolean;
  gag: boolean;
  vows: boolean;
  pretty: number;
  name: string;
}

export type WeighoffRivals = Record<RivalId, WeighoffRival>;

export interface WeighoffRolls {
  heist: number;
  swarm: number;
}

export interface WeighoffPrettyBoard {
  id: string;
  cards: number[] | null;
  total: number;
  mustache?: boolean;
  place?: number;
}

export interface WeighoffPretty {
  judges: string[];
  board: WeighoffPrettyBoard[];
  ranked: string[];
  place: number | null;
  asleep: boolean;
}

export interface WeighoffLine {
  W: number;
  year: number;
}

export interface WeighoffHistoryWinner {
  id: string;
  W: number;
}

export interface WeighoffHistory {
  year: number;
  place: number | null;
  W: number | null;
  pct: number | null;
  name: string | null;
  exhibition: boolean;
  pretty: number | null;
  total: number;
  winner: WeighoffHistoryWinner | null;
  crown: boolean;
  record: boolean;
}

export interface WeighoffBest {
  W: number;
  year: number;
  name: string;
}

export interface WeighoffRecord {
  W: number;
  who: string;
  year: number;
  you?: boolean;
  name?: string;
}

export interface Weighoff {
  year: number;
  stage: string | null;
  i: number;
  steps: WeighoffStep[];
  entries: WeighoffEntry[];
  order: string[];
  rivals: WeighoffRivals;
  rolls: WeighoffRolls;
  heist: boolean;
  pretty: WeighoffPretty | null;
  results: null;
  lines: Partial<Record<RivalId, WeighoffLine>>;
  history: WeighoffHistory[];
  best: WeighoffBest | null;
  record: WeighoffRecord;
  vows: RivalId | null;
  forklift: number;
}

export interface WinterEditionMarlene {
  pct: number;
  month: string;
  heat: number;
  rain: number;
  text: string;
  spark: number[];
}

export interface WinterEdition {
  year: number;
  headline: string;
  sub: string | null;
  briefs: string[];
  marlene: WinterEditionMarlene;
  fad: string | null;
  judges: string;
  mood: string | null;
  letters: string[];
  column: string[];
  classified: string;
  classifiedItem: string;
}

export interface Winter {
  stage: string | null;
  year: number;
  plot: number;
  carved: boolean;
  skipped: boolean;
  stencil: string | null;
  ink: number;
  lot: string[];
  candy: number;
  repStart: number;
  edition: WinterEdition | null;
}

export interface Scrapbook {
  year: number;
  headline: string;
  name: string | null;
  weight: number | null;
  pct: number | null;
  place: number | null;
  pretty: number | null;
  stars: number;
  net: number;
  moment: string | null;
  split: 'blowout' | null;
  exhibition: boolean;
  mustache: boolean;
  est: number | null;
}

export interface FirstsCareer {
  y: number;
  d: number;
}

export interface Firsts {
  career: Record<string, FirstsCareer>;
  year: Record<string, number>;
}

export interface MischiefPin {
  id: string;
  x: number;
  y: number;
  z: number;
  label: string;
  until1x: number;
}

export interface MischiefVisit {
  id: string;
  x: number;
  z: number;
  day: number;
  tin?: boolean;
  coat?: string;
  spot?: string;
  row?: number | null;
  until?: number;
  rest?: boolean;
  told?: boolean;
}

export interface MischiefMetBiscuitDig {
  y: number;
  n: number;
  first: number;
}

export interface MischiefMetSwarm {
  y: number;
  n: number;
}

/** A visitor id to how often (n) and when (y: the year) you last met it; first is the year of the first meeting. */
export type MischiefMet = Record<string, MischiefMetBiscuitDig | MischiefMetSwarm>;

export interface MischiefLook {
  id: string;
  x: number;
  y: number;
  z: number;
  day: number;
}

export interface MischiefPorch {
  day: number;
  tin: boolean;
}

export interface MischiefPamelaVisit {
  spot: string;
  row: number | null;
  x: number;
  z: number;
  day: number;
  days: number;
  choice: string | null;
  drift: number | null;
}

export interface MischiefPamela {
  visit: MischiefPamelaVisit | null;
  goatDays: Record<string, number>;
  escapes: number;
  fullUntil: number;
  shawl: boolean;
}

export interface Mischief {
  pin: MischiefPin | null;
  visit: MischiefVisit | null;
  met: MischiefMet;
  coats: string[];
  clips: unknown[];
  skunkedUntil: number;
  iou: number;
  look: MischiefLook | null;
  porch: MischiefPorch | null;
  pamela: MischiefPamela;
}

export interface PokesNote {
  n: number;
  y: number;
  d: number;
  via: string;
  read: number | null;
}

/** How often a thing was poked on day d. */
export interface PokesCount {
  d: number;
  n: number;
}

export interface Pokes {
  counts: Record<string, PokesCount>;
  noticed: Record<string, unknown>;
  finds: unknown[];
  notes: PokesNote[];
  pile: number[];
  digNext: number;
}

export type CrawlRival = 'vance' | 'tom';
export type CrawlPick = 'under' | 'mid' | 'over';

export interface CrawlGuesse {
  who: CrawlRival;
  n: number;
}

export type CrawlTapeGreen = Record<CrawlRival, boolean>;

export interface CrawlTape {
  ott: number;
  est: number;
  green: CrawlTapeGreen;
}

export interface Crawl {
  year: number;
  step: 'guess' | 'taped' | 'done' | null;
  guesses: CrawlGuesse[];
  pick: CrawlPick | null;
  review: null;
  ribbons: unknown[];
  gags: unknown[];
  tape?: CrawlTape | null;
  range?: [number, number];
  right?: boolean | null;
  closest?: string | null;
}

/** A camera move: centre on (x, z), at zoom if given. */
export interface Glide { x: number; z: number; zoom?: number }

export interface StoryDialog {
  id: string;
  speaker: string;
  lines: string[];
  /** the beat whose intro this is: it holds the clock and can be replayed */
  beat?: string;
  pause?: boolean;
  glide?: Glide;
  /** the beat this dialog replays */
  replay?: string;
}

export interface StoryGoal {
  id: string;
  text: string;
  target: Target | null;
  /** clock1x when it was set */
  since: number;
  /** the last sim day it is worth doing */
  until: number | null;
  lapse: Lapse;
}

export interface StoryLog {
  year: number;
  day: number;
  id: string;
  score: number;
  vars: Vars;
}

export interface StoryReplay {
  speaker: string;
  lines: string[];
}

export interface Story {
  dialog: StoryDialog[];
  cards: Card[];
  goal: StoryGoal | null;
  beats: Record<string, number>;
  lastIntro1x: number | null;
  log: StoryLog[];
  replay: Record<string, StoryReplay>;
  seq: number;
  moments: MomentItem[];
  receipts: Receipt[];
  receiptDay: number | null;
  /** fresh()'s memory: the entry indices said since each key's bag was refilled */
  said: Record<string, number[]>;
  /** the Giant's receipt lines lately said, oldest first */
  heard: [text: string, year: number][];
  stamps: Record<string, FirstsCareer>;
  alerts: Record<string, [year: number, day: number]>;
  lastChatter1x?: number | null;
}

export interface EventsLast {
  y: number;
  d: number;
  t: number;
}

/** What an active event carries: the swarm's spot, a lost joey's family and timers, a proposal's row. Which fields are set depends on the event id. */
export interface EventsActiveData {
  spot?: string;
  y?: number;
  fam?: number;
  end?: number;
  bark?: number;
  posing?: boolean;
  row?: number;
}

export interface EventsActive {
  id: string;
  until: number;
  x?: number;
  z?: number;
  data?: EventsActiveData | null;
}

export interface EventsLog {
  y: number;
  d: number;
  m: number;
  t: number;
  id: string;
  cls: string;
}

export interface EventsLogbook {
  whales?: number;
}

export interface EventsDelight {
  id: string;
  d: number;
  t: number;
  cause: string | null;
  slot: SlotKey | null;
  fallback: boolean;
}

/** Year 1's delight slots (T.lane.y1.slots). */
export type SlotKey = 'A' | 'B' | 'C' | 'E' | 'F';
/** A slot's outcome: its delight fired (or a fallback), an earlier delight filled it, it was skipped, or one is queued. */
export type EventsSlot =
  | { id: string; d: number; fallback: boolean }
  | { id: string; d: number; filled: true }
  | { skipped: true; d: number }
  | { pending: number };
export type EventsSlots = Partial<Record<SlotKey, EventsSlot>>;

export interface Events {
  last: Record<string, EventsLast>;
  count: Record<string, number>;
  year: Record<string, number>;
  season: Record<string, number>;
  byYear: Record<string, Record<string, number>>;
  notables: number;
  lastNotable1x: number | null;
  active: EventsActive[];
  log: EventsLog[];
  logbook: EventsLogbook;
  lastDelight1x: number;
  delights: EventsDelight[];
  slots: EventsSlots;
}

export interface State {
  v: number;
  seed: number;
  meta: Meta;
  rng: Record<string, Rng>;
  clock: Clock;
  rep: Rep;
  unlocks: Record<string, boolean>;
  prefs: Prefs;
  weather: Weather;
  cash: number;
  loan: Loan;
  ledger: Ledger;
  owned: Owned;
  hires: Hires;
  patch: Patch;
  genetics: Genetics;
  giant: Giant;
  season: Season;
  weighoff: Weighoff;
  winter: Winter;
  scrapbook: Scrapbook[];
  firsts: Firsts;
  mischief: Mischief;
  pokes: Pokes;
  crawl: Crawl;
  story: Story;
  events: Events;
}
