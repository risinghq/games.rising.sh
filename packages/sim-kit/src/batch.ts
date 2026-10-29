/** What a batch needs to know about one finished match. */
export interface Outcome {
  /** The winning side, or "draw" when the match hit its cap undecided. */
  winner: string;
  /** Simulated minutes the match covered. */
  minutes: number;
  /** Wall-clock milliseconds the match took, when timed. */
  ms?: number;
}

export interface Job {
  /** Position in the full job list; sharding and seeds derive from it. */
  index: number;
  /** Which pass over the roster this is, 0-based. */
  round: number;
}

/** The seed of job `index` in a batch based at `base`: distinct and reproducible. */
export function jobSeed(base: number, job: Job): number {
  return base + job.index * 13 + job.round * 1000;
}

/**
 * Play `rounds` passes over `roster`, keeping the jobs of shard `shard` of
 * `shards`. Every shard counts the same job list, so shards never overlap and
 * together cover it.
 */
export function planBatch<T>(
  roster: T[],
  rounds: number,
  shard = 0,
  shards = 1,
): { item: T; job: Job }[] {
  const out: { item: T; job: Job }[] = [];
  let index = 0;
  for (let round = 0; round < rounds; round++)
    for (const item of roster) {
      const job = { index: index++, round };
      if (job.index % shards === shard) out.push({ item, job });
    }
  return out;
}

export interface Summary {
  matches: number;
  draws: number;
  drawRate: number;
  /** Share of decided matches each side won. */
  winShare: Record<string, number>;
  medianMinutes: number;
  /** Median wall-clock cost per simulated minute; NaN when nothing was timed. */
  msPerMinute: number;
}

const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)]! : NaN;
};

export function summarize(outcomes: Outcome[], sides: string[]): Summary {
  const decided = outcomes.filter((o) => o.winner !== "draw");
  const winShare: Record<string, number> = {};
  for (const s of sides)
    winShare[s] = decided.length
      ? decided.filter((o) => o.winner === s).length / decided.length
      : NaN;
  return {
    matches: outcomes.length,
    draws: outcomes.length - decided.length,
    drawRate: outcomes.length
      ? (outcomes.length - decided.length) / outcomes.length
      : NaN,
    winShare,
    medianMinutes: median(outcomes.map((o) => o.minutes)),
    msPerMinute: median(
      outcomes
        .filter((o) => o.ms !== undefined)
        .map((o) => o.ms! / Math.max(1e-9, o.minutes)),
    ),
  };
}

export function formatSummary(s: Summary): string {
  const pct = (x: number) =>
    Number.isNaN(x) ? "-" : `${Math.round(100 * x)}%`;
  const shares = Object.entries(s.winShare)
    .map(([k, v]) => `${k} ${pct(v)}`)
    .join(", ");
  const cost = Number.isNaN(s.msPerMinute)
    ? "-"
    : `${Math.round(s.msPerMinute)} ms`;
  return `matches ${s.matches}, draws ${s.draws} (${pct(s.drawRate)}), decided wins: ${shares}, median ${s.medianMinutes.toFixed(1)} sim-min, cost ${cost} per sim-minute`;
}
