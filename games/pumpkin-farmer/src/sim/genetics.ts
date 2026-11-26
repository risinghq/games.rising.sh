// Seeds and genetics (design §6 "Seeds and genetics"): an 8-locus diploid genome with linkage and recombination,
// mutation, inbreeding F, founder-line ancestry, hybrid vigour, the POT formula, phenotype and Prettiest features,
// Grandpa's seed, founder lines for rivals / the Cove pool / pollen packs, seed lots of 6 with a plumpness hint,
// pedigree names, the Grange, seed sales and the winter seed choice.
//
// What the player should feel (design §13), and the numbers that make it so (tests/sim/genetics.test.js,
// tests/balance/giant-breeding.test.js):
//   Grandpa's tin    lineage and hope: "1,147 Okafor ('98)". His seeds average far less than 1,147 (POT 828):
//                    regression to the mean hands you a goal, beat Grandpa.
//   Seed lot of 6    legacy, next year's bet: six cards, each a little different; "Plump" is tempting and right
//                    only some of the time (correlation ~0.3).
//   Self             the trap: F climbs 0.125 -> 0.56 -> 0.78, so each year is quietly lighter (>= 12% by Y4).
//                    A quarter of the seeds come out tan: heavier but plainer, so heavy-vs-pretty appears by itself.
//   Open             a safe step up: Cove fathers are weak but fresh blood (F stays ~0).
//   Buy (Grange)     the catch-up tool: a known heavy line, at a price that climbs with the cube of its weight.
//   Cross            the get-ahead tool: new blood gets hybrid vigour; with two plots (Y3) you select the better
//                    line, and crossing + selection overtakes buying by Y5.
//   Heavy vs pretty  pale and flat add potential; S1 rides with tan, S3 with blotchy skin. corr(POT, pretty) over
//                    founder genomes sits between -0.45 and -0.2, so a Double Crown line takes deliberate crosses.
//
// Genome (plain JSON): { a: [S1, COL, S2, DEN, S3, EVN, TGH, SHP], b: [...], F, het, anc: { line: share }, stripe, mut? }
//   S1-S3, DEN, EVN 0..3; TGH 0..2; COL 'O' | 'S' | 'T' | 'W' (O > S > T > W, white only when WW); SHP 't' | 'f';
//   stripe 0..2 striped haplotypes (cosmetic, dominant); mut 'white' | 'stripe' when a gamete mutated.
// Seed (plain JSON): { id, name, short, year, source: 'tin'|'own'|'grange'|'mystery'|'moss', genome, F, plump,
//   mother: { short, seed, weight, est, pct, colour, shape, stripe, dmg, name, year }, father: { kind, name, line } }
// Pollen pack: { id, line, W, name, price, genome }
// s.genetics = { seeds: [seed], pollen: [pack], plant: [seedId | null, seedId | null] (next spring's plot 1 / plot 2),
//               offers: [offer] (this winter's Grange), lotYear, sold (seeds sold this winter), nextId }
//
// Exports other slices call (the weigh-off / winter slice builds the Seeds and Grange screens on these):
//   makeSeedLot(s, giant, opts?) -> seeds        scoopSeeds(s, ctx, giant) -> seeds (idempotent per year; adds to the tin)
//   seedCard(seed) -> display data               pedigreeName({ surname, weight, est, dmg, seedShort, father }) -> { short, name }
//   founderGenome(line, rng, { W, sub }?)        rivalGenome(id, rng, W?)        cross(mother, father, rng, kind)
//   phenotype(genome)   potential(genome)   potentialEff(genome)   prettyFeatures(s, giant)   judgeScores(features)
//   prettyScore(features)   grangeOffers(s, year, rng?)   seedPrice(W)   pollenPrice(W)   saleValue(W, place)
// Actions: genetics/choose { id, plot }, genetics/buy { id }, genetics/sell { id }.
// Out-events: { type: 'genetics/lot', n, name }, { type: 'genetics/bought', id, kind }.
import { T, rivalOf, type Colour, type Founder, type FounderId, type Shape } from './tuning.js';
import { makeRng, next, gauss, weighted, int, shuffle, type Rng } from './rng.js';
import { clamp, round3, round5, hash32 } from './util.js';
import { has, forYear, canAfford } from './economy.js';
import { LINES } from './story.js';
import type { Action, SimModule, State, Ctx, Breed } from './types.js';
import type { GeneticsOffer, GeneticsSeed, GiantFather, GiantPlant, GiantScarsBy, Genome, Haplotype, Plump } from './state.js';
/** The loci that hold a number (COL and SHP hold letters). */
type NumLocus = 0 | 2 | 3 | 4 | 5 | 6;
type Anc = Record<string, number>;
const G = T.genetics, N = 8, LINK = G.link, COLS = G.colours;
const I = { S1: 0, COL: 1, S2: 2, DEN: 3, S3: 4, EVN: 5, TGH: 6, SHP: 7 } as const;
const SIZE = [I.S1, I.S2, I.S3] as const;
const MUTATING = [0, 2, 3, 4, 5, 6] as const;
const STEP: Record<NumLocus, number> = { 0: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2 };          // loci that mutate by +-1, and their max
export const LINE_NAMES: Readonly<Record<string, string>> = { vance: 'Vance', tom: 'Big Tom', mavis: 'Mavis', hoot: 'Hoot', vale: 'Vale', lindqvist: 'Lindqvist' };
export const COLOUR_NAMES: Readonly<Record<string, string>> = { O: 'Orange', S: 'Salmon', T: 'Tan', W: 'White' };
export const SHAPE_NAMES: Readonly<Record<string, string>> = { tall: 'Tall', round: 'Round', flat: 'Flat' };
export const commas = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ------------------------------------------------------------ genome basics
const sum2 = (g: Genome, i: NumLocus) => g.a[i] + g.b[i];
const ri = (x: number, hi: number) => clamp(Math.round(x), 0, hi) || 0;     // an allele (never -0, so genomes round-trip JSON)
export const sizeSum = (g: Genome) => SIZE.reduce<number>((t, i) => t + sum2(g, i), 0);
const rank = (c: string) => COLS.findIndex((x) => x === c);
export const colourOf = (g: Genome): Colour => COLS[Math.min(rank(g.a[I.COL]), rank(g.b[I.COL]))] ?? 'W';
export function shapeOf(g: Genome): Shape {
  const t = Number(g.a[I.SHP] === 't') + Number(g.b[I.SHP] === 't');
  return t === 2 ? 'tall' : t === 1 ? 'round' : 'flat';
}
// POT = 500 + 60 sizeSum + colourBonus + shapeBonus (raw); potentialEff adds inbreeding and hybrid vigour.
export const potential = (g: Genome) => G.pot.base + G.pot.perSize * sizeSum(g) + G.pot.colour[colourOf(g)] + G.pot.shape[shapeOf(g)];
export const potentialEff = (g: Genome) => potential(g) * (1 - G.inbreeding * (g.F || 0)) * (g.het ? G.hybridVigour : 1);
export function phenotype(g: Genome) {
  const colour = colourOf(g), shape = shapeOf(g), tgh = sum2(g, I.TGH);
  return { colour, shape, stripe: (g.stripe || 0) > 0, size: sizeSum(g), den: sum2(g, I.DEN), evenness: sum2(g, I.EVN) / 6,
    tgh, tough: G.tgh[tgh] ?? 1, pot: potential(g), F: g.F || 0 };
}
export const grandpaGenome = (): Genome => ({ a: [...G.grandpa.a], b: [...G.grandpa.b], F: G.grandpa.F, het: false, anc: { grandpa: 1 }, stripe: 0 });

// ------------------------------------------------------------ inheritance
// A gamete starts on a random haplotype and switches after locus i with probability LINK[i]. Mutation: 2% per allele
// on the stepped loci (+-1), 0.4% COL -> W, 0.2% a new stripe.
export function gamete(g: Genome, rng: Rng): { h: Haplotype; stripe: number; mut: string | null } {
  let h = next(rng) < 0.5 ? g.a : g.b, o = h === g.a ? g.b : g.a;
  const from: Haplotype[] = [];
  for (let i = 0; i < N; i++) {
    from.push(h);
    if (i < N - 1 && next(rng) < (LINK[i] ?? 0)) [h, o] = [o, h];
  }
  const at = (i: number) => from[i] ?? h;
  const out: Haplotype = [at(0)[0], at(1)[1], at(2)[2], at(3)[3], at(4)[4], at(5)[5], at(6)[6], at(7)[7]];
  let mut: string | null = null;
  for (const i of MUTATING) if (next(rng) < G.mutate.step) out[i] = clamp(out[i] + (next(rng) < 0.5 ? -1 : 1), 0, STEP[i]);
  if (next(rng) < G.mutate.white && out[I.COL] !== 'W') { out[I.COL] = 'W'; mut = 'white'; }
  let stripe = (g.stripe || 0) > 0 && next(rng) < g.stripe / 2 ? 1 : 0;
  if (next(rng) < G.mutate.stripe && !stripe) { stripe = 1; mut ??= 'stripe'; }
  return { h: out, stripe, mut };
}
// Founder-line shares, averaged at each cross; overlap is the shared share.
export function overlap(A: Anc = {}, B: Anc = {}) {
  let o = 0;
  for (const [k, a] of Object.entries(A)) { const b = B[k]; if (b) o += Math.min(a, b); }
  return round3(Math.min(1, o));
}
function mix(A: Anc = {}, B: Anc = {}) {
  const out: Anc = {};
  for (const [k, v] of Object.entries(A)) out[k] = (out[k] || 0) + v / 2;
  for (const [k, v] of Object.entries(B)) out[k] = (out[k] || 0) + v / 2;
  const keep = Object.entries(out).filter(([, v]) => v >= 0.01), t = keep.reduce((a, [, v]) => a + v, 0) || 1;
  return Object.fromEntries(keep.map(([k, v]) => [k, round3(v / t)]));
}
// kind: 'self' F = 0.5 (1 + F_mother) · 'open' / 'cross' F = 0.5 overlap (1 + F̄) · 'sib' F = 0.25 (1 + 2 F̄).
// Hybrid vigour (x1.03) for a cross whose ancestries barely overlap.
export function cross(mother: Genome, father: Genome, rng: Rng, kind = 'cross'): Genome {
  const ga = gamete(mother, rng), gb = gamete(father, rng);
  const Fbar = ((mother.F || 0) + (father.F || 0)) / 2;
  const ov = kind === 'self' ? 1 : overlap(mother.anc, father.anc);
  const F = kind === 'self' ? 0.5 * (1 + (mother.F || 0)) : kind === 'sib' ? 0.25 * (1 + 2 * Fbar) : 0.5 * ov * (1 + Fbar);
  const g: Genome = { a: ga.h, b: gb.h, F: Math.round(F * 1e4) / 1e4, het: kind === 'cross' && ov < G.hybridOverlap,
    anc: kind === 'self' ? { ...mother.anc } : mix(mother.anc, father.anc), stripe: ga.stripe + gb.stripe };
  const mut = ga.mut || gb.mut;
  if (mut) g.mut = mut;
  return g;
}

// ------------------------------------------------------------ founder lines
// Allele mean m = (W - 500 - 60 h) / 360; heavy haplotypes (chance h) carry +heavyShift on S1 and S3, a pale colour
// and low evenness, so heavy and pretty pull apart; the base mean is lowered so the line still averages m.
const isFounder = (id: string): id is FounderId => Object.hasOwn(G.founders, id);
const founderOf = (line: string): Founder => G.founders[isFounder(line) ? line : 'cove'];
export function founderGenome(line: string, rng: Rng, opts: { W?: number; sub?: number } = {}): Genome {
  const L = founderOf(line);
  const W = opts.W ?? (Array.isArray(L.W) ? L.W[0] + next(rng) * (L.W[1] - L.W[0]) : L.W);
  const m = (W - G.pot.base - 60 * L.h) / G.founderDiv, mb = m - (2 / 3) * L.h * G.heavyShift, sd = L.sizeSd ?? G.sizeSd;
  const hap = (): Haplotype => {
    const heavy = next(rng) < L.h;
    const size = (shift: number) => ri(mb + shift + sd * gauss(rng), 3);
    const s1 = size(heavy ? G.heavyShift : 0), s2 = size(0), s3 = size(heavy ? G.heavyShift : 0);
    const col = weighted(rng, Object.entries(heavy ? L.heavyCol : L.col)) ?? 'O';
    const den = ri(L.den + 0.8 * gauss(rng), 3);
    const evn = ri(L.evn + (heavy ? G.evnHeavy : 0) + 0.7 * gauss(rng), 3);
    const tgh = ri(L.tgh + 0.5 * gauss(rng), 2);
    return [s1, col, s2, den, s3, evn, tgh, next(rng) < L.t[heavy ? 1 : 0] ? 't' : 'f'];
  };
  const id = line === 'cove' ? `cove${opts.sub ?? int(rng, 1, L.subLines ?? 1)}` : line;
  return { a: hap(), b: hap(), F: 0, het: false, anc: { [id]: 1 }, stripe: 0 };
}
export const rivalGenome = (id: string, rng: Rng, W?: number) => founderGenome(id, rng, { W: W ?? rivalOf(id)?.W0 });

// ------------------------------------------------------------ Prettiest (the weigh-off slice scores the judges)
// Features 0..1 from the phenotype and her care (design §8 Prettiest scoring). Scar marks: sunscald 1 each, surface
// crack 2, heist scratch 1 each, lift scuff 1 (giant.scarsBy holds marks, already weighted).
/** Judging features, each 0..1 except the scar marks. */
export interface PrettyFeatures {
  colour: number; colourKind: Colour; striped: boolean; evenness: number; shape: number; shapeKind: Shape;
  symmetry: number; stem: number; scars: number; scarsBy: GiantScarsBy; mustache: boolean;
}
export function prettyFeatures(s: State, g: GiantPlant): PrettyFeatures {
  const P = T.weighoff.pretty, sy = P.symmetry, ph = phenotype(g.genome);
  let sym = sy.base;
  if (g.rotated) sym += sy.rotated; else if ((s?.clock?.year ?? 1) >= T.giant.rotateFromYear) sym += sy.flatBottom;
  if (g.cull === 'round') sym += sy.roundCull;
  sym += sy.heavy * (g.days?.set ? g.days.heavy / g.days.set : 0);
  if (g.wc > sy.slumpFrom) sym += sy.slump * (g.wc - sy.slumpFrom) / sy.slumpPer;
  const { scarsBy } = g;
  return { colour: ph.stripe ? P.colour.striped : P.colour[ph.colour], colourKind: ph.colour, striped: ph.stripe,
    evenness: clamp(ph.evenness, 0, 1), shape: P.shape[ph.shape], shapeKind: ph.shape,
    symmetry: clamp(sym, 0, 1), stem: g.stemCrack ? P.stem.crack : g.cull === 'stump' ? P.stem.stump : P.stem.base,
    scars: Object.values(scarsBy).reduce((a, b) => a + b, 0), scarsBy, mustache: !!g.mustache };
}
// judge score = 10 x sum(w x) / sum(w) - 0.6 x scar marks; Edna scores shape on her own table.
const judgeRow = (id: string) => {
  const J = T.weighoff.pretty.judges;
  switch (id) {
    case 'mayor': case 'edna': case 'sasha': case 'vance': return J[id];
    default: return {};
  }
};
export function judgeScores(f: PrettyFeatures, judges = ['mayor', 'edna', 'sasha']) {
  return judges.map((id) => {
    const j = judgeRow(id), w = { colour: j.colour ?? 1, evenness: j.evenness ?? 1, shape: j.shape ?? 1, symmetry: j.symmetry ?? 1, stem: j.stem ?? 1 };
    const x = { colour: f.colour, evenness: f.evenness, shape: j.shapes ? j.shapes[f.shapeKind] : f.shape, symmetry: f.symmetry, stem: f.stem };
    const sw = w.colour + w.evenness + w.shape + w.symmetry + w.stem;
    const dot = w.colour * x.colour + w.evenness * x.evenness + w.shape * x.shape + w.symmetry * x.symmetry + w.stem * x.stem;
    return { id, score: clamp(10 * dot / sw - T.weighoff.pretty.scarK * f.scars, 0, 10) };
  });
}
export const prettyScore = (f: PrettyFeatures, judges?: string[]) => judgeScores(f, judges).reduce((a, j) => a + j.score, 0);

// ------------------------------------------------------------ names, seeds and cards
export const grandpaName = (surname: string) => `${commas(T.giant.tin.mother)} ${surname} (${T.giant.tin.year})`;
// "1,034 Okafor (1,147 Okafor × 950 Vance)"; "(self)" / "(open)" / "(sib)"; exhibition only "1,180 est. Okafor (DMG)"
interface PedigreeIn {
  surname: string; weight: number | null; est: number | null; dmg: boolean; seedShort?: string; father?: { kind: string; name: string } | null;
}
export function pedigreeName({ surname, weight, est, dmg, seedShort, father }: PedigreeIn) {
  const w = weight ?? 0;
  if (dmg || !(w > 0)) { const short = `${commas(est || w)} est. ${surname}`; return { short, name: `${short} (DMG)` }; }
  const short = `${commas(w)} ${surname}`, k = father?.kind;
  const tail = k === 'cross' ? ` (${seedShort || '?'} × ${father?.name})` : k === 'self' ? ' (self)' : k === 'sib' ? ' (sib)' : ' (open)';
  return { short, name: short + tail };
}
const newId = (s: State, p = 's') => `${p}${s.genetics.nextId++}`;
// A noisy read of the seed's size alleles: Plump / Average / Thin (correlation ~0.3 with sizeSum).
export function plumpHint(genome: Genome, rng: Rng): Plump {
  const P = G.plump, score = (sizeSum(genome) - P.centre) / P.scale + P.noise * gauss(rng);
  return score > P.cut ? 'Plump' : score < -P.cut ? 'Thin' : 'Average';
}
function seedOf(s: State, genome: Genome, rng: Rng, extra: Pick<GeneticsSeed, 'name' | 'short' | 'source' | 'mother' | 'father'>): GeneticsSeed {
  return { id: newId(s), year: s.clock.year, genome, F: genome.F, plump: plumpHint(genome, rng), ...extra };
}
export function tinSeeds(s: State): GeneticsSeed[] {
  const name = grandpaName(s.meta.surname), short = name;
  const mother: GeneticsSeed['mother'] = { short: `${commas(T.giant.tin.mother)} ${s.meta.surname}`, seed: null, weight: T.giant.tin.mother, est: null, pct: null,
    colour: 'O', shape: 'round', stripe: false, dmg: false, name: 'Grandpa\'s', year: 0 };
  return Array.from({ length: T.giant.tin.seeds }, (_, i): GeneticsSeed => ({ id: newId(s), name, short, year: 0, source: 'tin', genome: grandpaGenome(),
    F: G.grandpa.F, plump: 'Average', mother, father: { kind: 'open', name: 'open', line: null }, backup: i > 0 }));
}

// The seed lot of a giant (6 seeds). The mother is named by her official weight (g.result.W, recorded after the
// weigh-off) or, if she was damaged / never weighed, by her estimate with (DMG). Open seeds each have a Cove father.
export function makeSeedLot(s: State, g: GiantPlant, opts: { rng?: Rng; n?: number } = {}): GeneticsSeed[] {
  const rng = opts.rng ?? s.rng.genetics ?? makeRng(hash32(s.seed, s.clock.year, 'genetics')), n = opts.n ?? T.giant.lotSize, res = g.result, W = res?.W ?? 0;
  const dmg = !!(res?.exhibition || res?.dq || g.split === 'blowout' || !(W > 0));
  const father: GiantFather = g.father ?? { kind: 'open', name: 'open' };
  const { short, name } = pedigreeName({ surname: s.meta.surname, weight: res?.W ?? null, est: g.est || g.wc, dmg, seedShort: g.seed?.short, father });
  const ph = phenotype(g.genome);
  const mother: GeneticsSeed['mother'] = { short, seed: g.seed?.short || null, weight: dmg ? null : Math.round(W), est: Math.round(g.est || g.wc || 0), pct: res?.pct ?? null,
    colour: ph.colour, shape: ph.shape, stripe: ph.stripe, dmg, name: g.name ?? '', year: s.clock.year };
  const seeds: GeneticsSeed[] = [];
  for (let i = 0; i < n; i++) {
    const kind = ['self', 'cross', 'sib'].includes(father.kind) ? father.kind : 'open';
    const dad = kind === 'self' ? g.genome : kind === 'open' || !father.genome ? founderGenome('cove', rng) : father.genome;
    const genome = cross(g.genome, dad, rng, kind);
    seeds.push(seedOf(s, genome, rng, { name, short, source: 'own', mother, father: { kind, name: kind === 'cross' ? father.name : kind, line: father.line || null } }));
  }
  return seeds;
}
// Halloween: scoop the carved giant's lot into the tin (once a year). A blowout before t = 60 gives none.
export function scoopSeeds(s: State, ctx: Ctx | undefined, g: GiantPlant | undefined) {
  const S = s.genetics;
  if (S.lotYear === s.clock.year) return S.seeds.filter((x) => x.source === 'own' && x.year === s.clock.year);
  S.lotYear = s.clock.year;
  if (!g?.genome || g.setDay == null || (g.split === 'blowout' && !g.seedsOk)) { ctx?.emit({ type: 'genetics/lot', n: 0 }); return []; }
  const seeds = makeSeedLot(s, g);
  S.seeds.push(...seeds);
  trim(s);
  ctx?.emit({ type: 'genetics/lot', n: seeds.length, name: seeds[0]?.short });
  return seeds;
}
function trim(s: State) {
  const S = s.genetics, keep = 36;
  if (S.seeds.length <= keep) return;
  const chosen = new Set(S.plant), drop = S.seeds.filter((x) => x.source === 'own' && !chosen.has(x.id)).sort((a, b) => a.year - b.year);
  while (S.seeds.length > keep) {
    const d = drop.shift();
    if (!d) break;
    S.seeds.splice(S.seeds.indexOf(d), 1);
  }
}
// Display data for a seed card (winter Seeds screen, the Giant notebook).
export function seedCard(seed: GeneticsSeed) {
  const m = seed.mother, f = seed.father;
  return {
    id: seed.id, title: seed.short, pedigree: seed.name, source: seed.source, year: seed.year, plump: seed.plump,
    mother: m.seed ? `${m.short}, from ${m.seed}` : m.short, motherName: m.name, weight: m.weight, est: m.est, dmg: !!m.dmg,
    weightText: m.dmg ? `est. ${commas(m.est ?? 0)} lb (damaged)` : m.weight ? `${commas(m.weight)} lb` : '',
    pct: m.pct == null ? null : `${m.pct >= 0 ? '+' : '−'}${Math.abs(m.pct * 100).toFixed(1)}% vs chart`,
    colour: (COLOUR_NAMES[m.colour] ?? m.colour) + (m.stripe ? ', striped' : ''), shape: SHAPE_NAMES[m.shape] ?? m.shape,
    father: f.kind === 'open' || !f.kind ? 'open' : f.kind === 'self' ? 'self' : f.kind === 'sib' ? 'sib' : f.name,
    inbred: seed.F >= G.inbredBadge ? LINES.genetics.inbred : null, F: seed.F,
  };
}

// ------------------------------------------------------------ the Grange
export const seedPrice = (W: number) => round5(G.grange.seedK * (W / 1000) ** 3);
export const pollenPrice = (W: number) => round5(G.grange.pollenK * seedPrice(W));
export const saleValue = (W: number, place: number|null|undefined) => round5(G.sales.k * seedPrice(W) * (G.sales.place[(place || 0) - 1] ?? 1));
// STAND-IN until the weigh-off slice records each rival line's last official weight in s.weighoff.lines[id] = { W, year }:
// design §8 W = W0 (1 + g)^(y - 1) exp(N(0, sd)), from a private stream so it never shifts anybody's rolls.
export function rivalStandIn(s: State, id: string, y: number) {
  const R = rivalOf(id), r = makeRng(hash32(s.seed, y, 'rivalStandIn', id));
  if (!R) return 0;
  return Math.round(R.W0 * (1 + R.g) ** (Math.max(1, y) - 1) * Math.exp(R.sd * gauss(r)));
}
// Ingrid's pollen reaches the Grange only in winters when the ferry runs (a private roll, so it never shifts anybody's
// dice): the legend's genes arrive in a different year for every farm, and the Cove record stays a multi-year chase.
const ferryRan = (s: State, year: number) => next(makeRng(hash32(s.seed, year, 'ferry'))) < (G.founders.lindqvist.ferry ?? 0);
const RIVALS = ['vance', 'tom', 'mavis', 'hoot', 'vale'] as const;
export function lineWeights(s: State, year: number) {
  const out: Record<string, number> = {};
  for (const id of RIVALS) out[id] = s.weighoff?.lines?.[id]?.W ?? rivalStandIn(s, id, year - 1);
  const L = G.founders.lindqvist;
  if (year >= (L.fromYear ?? 0) && (L.ferry == null || ferryRan(s, year))) out.lindqvist = Array.isArray(L.W) ? L.W[0] : L.W;
  return out;
}
// Seeds carry the line, not the luck (regression to the mean, the lesson of Grandpa's tin): a line named by one official
// weight breeds like popMean + h2 (W - popMean), so a lucky year's label and a visiting legend's record overstate the genes.
export const breedingWeight = (W: number, R = G.regress) => (R ? Math.round(R.mean + R.h2 * (W - R.mean)) : W);
// 3 seed lots and 3 pollen packs from rival lines named by their last official weights, Lindqvist's pollen from Y4 when
// the ferry runs, and the mystery packet. Offers carry their genomes, so what you see is what you get.
export function grangeOffers(s: State, year: number, rng = makeRng(hash32(s.seed, year, 'grange'))): GeneticsOffer[] {
  const W = lineWeights(s, year), lines = Object.keys(W).filter((k) => k !== 'lindqvist'), Gr = G.grange, out: GeneticsOffer[] = [];
  const wOf = (id: string) => W[id] ?? 0;
  const label = (id: string) => `${commas(wOf(id))} ${LINE_NAMES[id] ?? id}`;
  for (const id of shuffle(rng, lines).slice(0, Gr.lots)) {
    const seeds = Array.from({ length: Gr.lotSeeds }, () => founderGenome(id, rng, { W: breedingWeight(wOf(id)) }));
    out.push({ id: `g${year}s${id}`, kind: 'seed', line: id, W: wOf(id), name: label(id), price: seedPrice(wOf(id)), genomes: seeds });
  }
  const pl = shuffle(rng, lines).slice(0, Gr.pollen);
  if (W.lindqvist) pl.push('lindqvist');
  for (const id of pl) out.push({ id: `g${year}p${id}`, kind: 'pollen', line: id, W: wOf(id), name: label(id), price: pollenPrice(wOf(id)), genome: founderGenome(id, rng, { W: breedingWeight(wOf(id)) }) });
  out.push({ id: `g${year}m`, kind: 'mystery', line: 'mystery', W: null, name: LINES.genetics.mystery, price: Gr.mystery, genomes: [founderGenome('mystery', rng)] });
  return out;
}

// ------------------------------------------------------------ choosing next spring's seeds
const PLUMP: Record<Plump, number> = { Plump: 0, Average: 1, Thin: 2 };
// Best default: this year's own lot (plumpest, then least inbred), then Grange seeds (heaviest line), then the tin,
// then a seed Old Moss leaves on the porch (no dead ends).
export function autoPick(s: State, exclude: (string | null)[] = []): GeneticsSeed {
  const S = s.genetics, ex = new Set(exclude.filter(Boolean)), pool = S.seeds.filter((x) => !ex.has(x.id));
  const own = pool.filter((x) => x.source === 'own').sort((a, b) => b.year - a.year || PLUMP[a.plump] - PLUMP[b.plump] || a.F - b.F);
  const newest = own[0], latest = newest ? own.filter((x) => x.year === newest.year) : [];
  const bought = pool.filter((x) => x.source === 'grange' || x.source === 'mystery').sort((a, b) => (b.mother.weight || 0) - (a.mother.weight || 0));
  return latest[0] || bought[0] || pool.find((x) => x.source === 'tin') || own[0] || pool[0] || mossSeed(s);
}
function mossSeed(s: State): GeneticsSeed {
  const r = makeRng(hash32(s.seed, s.clock.year, 'moss-seed')), genome = founderGenome('cove', r);
  const seed = seedOf(s, genome, r, { name: LINES.genetics.mossSeed, short: LINES.genetics.mossSeed, source: 'moss',
    mother: { short: LINES.genetics.mossSeed, seed: null, weight: null, est: null, pct: null, colour: colourOf(genome), shape: shapeOf(genome), stripe: false, dmg: false, name: 'unknown', year: s.clock.year },
    father: { kind: 'open', name: 'open', line: null } });
  s.genetics.seeds.push(seed);
  return seed;
}
// The seeds to start this spring: [plot 1, plot 2 | null], filled in by autoPick where the player chose nothing.
export function seedsForSpring(s: State): [GeneticsSeed, GeneticsSeed | null] {
  const S = s.genetics, find = (id: string | null | undefined) => S.seeds.find((x) => x.id === id);
  const a = find(S.plant[0]) || autoPick(s, [S.plant[1]]), second = find(S.plant[1]);
  const b = has(s, 'plot2') ? (second && S.plant[1] !== a.id ? second : autoPick(s, [a.id])) : null;
  S.plant = [a.id, b?.id || null];
  return [a, b];
}
// Take a seed out of the tin (it is in the ground now). The backup for a failed germination is the next best seed.
export function takeSeed(s: State, id: string) {
  const S = s.genetics, i = S.seeds.findIndex((x) => x.id === id);
  return i >= 0 ? S.seeds.splice(i, 1)[0] ?? null : null;
}

// ------------------------------------------------------------ module
const fail = (reason: string) => ({ ok: false as const, reason });
// Breeding preferences per bot policy (policies may carry their own `breed` object; tests pass custom ones):
//   pick: 'plump' | 'first'   buy: 'pollen' | 'seed' | null   (the pollination card's default uses an owned pack)
//   sell: n   sell up to n of your own weighed seeds a winter (from the winter before Y3), keeping the best `keep` (default 3)
const BREED: Record<string, Breed> = { balanced: { pick: 'plump', buy: 'pollen', sell: 3 }, novice: { pick: 'first', buy: null } };

export default {
  id: 'genetics',
  init(s) {
    s.genetics = { seeds: [], pollen: [], plant: [null, null], offers: [], lotYear: 0, sold: 0, nextId: 1 };
    s.genetics.seeds = tinSeeds(s);
    s.genetics.plant = [s.genetics.seeds[0]?.id ?? null, null];
  },
  phase(s, _ctx, _from, to) {
    if (to === 'winter') {
      s.genetics.offers = s.clock.year + 1 >= G.grange.fromYear ? grangeOffers(s, s.clock.year + 1) : [];
      s.genetics.sold = 0;
      s.genetics.plant = [null, null];
    }
  },
  newYear(s) { seedsForSpring(s); },
  actions: {
    'genetics/choose': (s, a, ctx) => {
      const S = s.genetics, plot = a.plot === 2 ? 2 : 1, slot = plot === 2 ? 1 : 0, other = plot === 2 ? 0 : 1, seed = S.seeds.find((x) => x.id === a.id);
      if (!seed) return fail('no such seed in the tin');
      if (s.clock.phase !== 'winter') return fail('seeds are chosen in winter');
      if (plot === 2 && !has(s, 'plot2', forYear(s))) return fail('needs the second giant plot');
      if (S.plant[other] === seed.id) S.plant[other] = null;
      S.plant[slot] = seed.id;
      ctx.goalDone('pickSeed');                       // the Halloween goal's second half (winter.js)
      return { ok: true };
    },
    'genetics/buy': (s, a, ctx) => {
      const S = s.genetics, o = S.offers.find((x) => x.id === a.id);
      if (s.clock.phase !== 'winter') return fail('the Grange opens in winter');
      if (!o || o.bought) return fail(o ? 'already bought' : 'not on offer');
      const head = o.kind === 'pollen' ? null : o.genomes[0];
      if (o.kind !== 'pollen' && !head) return fail('an empty lot');
      if (!canAfford(s, o.price)) return fail('not enough cash');
      ctx.money(-o.price, o.kind === 'pollen' ? 'pollen' : 'seed');
      o.bought = true;
      const r = makeRng(hash32(s.seed, s.clock.year, 'grange-buy', o.id));
      if (o.kind === 'pollen') S.pollen.push({ id: newId(s, 'p'), line: o.line, W: o.W, name: o.name, price: o.price, genome: o.genome });
      else if (head) {
        const mother: GeneticsSeed['mother'] = { short: o.name, seed: null, weight: o.W, est: null, pct: null, colour: colourOf(head), shape: shapeOf(head), stripe: false, dmg: false, name: LINE_NAMES[o.line] || 'mystery', year: s.clock.year };
        const fresh = o.genomes.map((genome) => seedOf(s, genome, r, { name: o.name, short: o.name, source: o.kind === 'mystery' ? 'mystery' : 'grange', mother, father: { kind: 'open', name: 'open', line: o.line } }));
        S.seeds.push(...fresh);
        const first = fresh[0];
        if (a.plant && first) S.plant[0] = first.id;          // "buy and plant this one"
      }
      ctx.emit({ type: 'genetics/bought', id: o.id, kind: o.kind });
      ctx.emit({ type: 'sound', name: 'ching' });
      return { ok: true };
    },
    'genetics/sell': (s, a, ctx) => {
      const S = s.genetics, seed = S.seeds.find((x) => x.id === a.id);
      if (s.clock.phase !== 'winter' || forYear(s) < G.sales.fromYear) return fail('seed sales open in the winter before year 3');
      if (!seed || seed.source !== 'own' || !seed.mother.weight) return fail('only your own weighed seeds sell');
      if (S.sold >= G.sales.max) return fail('three a winter. Folks talk.');
      const v = saleValue(seed.mother.weight, s.giant?.result?.place);
      S.seeds.splice(S.seeds.indexOf(seed), 1);
      S.sold++;
      ctx.money(v, 'seedSales');
      return { ok: true, value: v };
    },
  },
  // Winter: buy what the policy likes (a bought seed lot is planted at once), else plant per the policy's pick. The
  // pollination card's default answer uses an owned pollen pack, so buying pollen is all a crossing bot needs.
  bot(s, _ctx, P) {
    if (s.clock.phase !== 'winter') return;
    const B = P.breed ?? BREED[P.name];
    if (!B) return;
    const S = s.genetics, acts: Action[] = [];
    // one pollen pack per giant plot (a pack is used up on a successful set), else one lot of seed; all in one step,
    // because the winter bot begins the year as soon as the shopping is done
    const want = B.buy === 'pollen' && has(s, 'plot2', forYear(s)) ? 2 : 1;
    let have = S.offers.filter((o) => o.bought && o.kind === B.buy).length, cash = s.cash;
    // "the best pollen" weighs fresh blood: a line already in next spring's seed costs inbreeding and hybrid vigour
    const mother = B.buy === 'pollen' && S.seeds.length ? (S.seeds.find((x) => x.id === S.plant[0]) || autoPick(s, [])).genome : null;
    const value = (o: GeneticsOffer) => {
      if (B.prefer === 'pretty') return (rivalOf(o.line)?.beauty ?? 0.5) * 1e4 + (o.W || 0);   // looks first, then weight
      if (!mother || o.kind !== 'pollen') return o.W ?? 0;
      const ov = overlap(mother.anc, o.genome.anc), F = 0.5 * ov * (1 + (mother.F || 0) / 2);
      return breedingWeight(o.W) * (1 - G.inbreeding * F) * (ov < G.hybridOverlap ? G.hybridVigour : 1);
    };
    const pool = B.buy ? S.offers.filter((o) => o.kind === B.buy && !o.bought).sort((a, b) => value(b) - value(a)) : [];
    for (const o of pool) {
      if (have >= want) break;
      if (o.price > cash - (B.reserve ?? 300)) continue;
      acts.push({ type: 'genetics/buy', id: o.id, plant: true });
      cash -= o.price; have++;
    }
    // the seeds you won't plant go to the Grange: the latest lot's best stay in the tin for the plots and a backup, and the
    // spares from the heaviest mothers sell (three a winter; a decent grower never leaves that money in the tin)
    if (B.sell && forYear(s) >= G.sales.fromYear && S.sold < G.sales.max) {
      const own = S.seeds.filter((x) => x.source === 'own').sort((a, b) => b.year - a.year || PLUMP[a.plump] - PLUMP[b.plump] || a.F - b.F);
      const spare = own.slice(B.keep ?? 3).filter((x) => x.mother.weight).sort((a, b) => (b.mother.weight ?? 0) - (a.mother.weight ?? 0));
      for (const x of spare.slice(0, Math.min(B.sell, G.sales.max) - S.sold)) acts.push({ type: 'genetics/sell', id: x.id });
    }
    if (acts.length) return acts;
    if (B.pick === 'first' && !S.plant[0]) {
      const own = S.seeds.filter((x) => x.source === 'own' && x.year === s.clock.year);
      const first = own[0];
      if (first) acts.push({ type: 'genetics/choose', id: first.id, plot: 1 });
    }
    return acts;
  },
} satisfies SimModule;
