// The balance gate: plays every ordered pair of personalities `SEEDS` times
// and exits 1 when the batch breaks THRESHOLDS. The PR check runs it.
//   bun run gate
import {
  formatSummary,
  gateFailures,
  jobSeed,
  planBatch,
  summarize,
  type Thresholds,
} from "@rising/sim-kit";
import { PERSONALITIES } from "../src/ai";
import { playMatch } from "../src/play";

const SEEDS = 100;
const THRESHOLDS: Thresholds = {
  maxDrawRate: 0.1,
  maxSideSkew: 0.05,
  minMatches: 1000,
};

const pairs = PERSONALITIES.flatMap((b) =>
  PERSONALITIES.map((r) => [b, r] as const),
);
const matches = planBatch(pairs, SEEDS).map(({ item: [b, r], job }) =>
  playMatch(b, r, jobSeed(7000, job)),
);
const summary = summarize(matches, ["blue", "red"]);
console.log(formatSummary(summary));
const failures = gateFailures(summary, ["blue", "red"], THRESHOLDS);
for (const f of failures) console.error(`GATE FAILED: ${f}`);
process.exit(failures.length ? 1 : 0);
