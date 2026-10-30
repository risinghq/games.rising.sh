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
import { personalityShares } from "./shares";

const SEEDS = 100;
const THRESHOLDS: Thresholds = {
  maxDrawRate: 0.06,
  maxSideSkew: 0.04,
  minMatches: 3000,
};
const MAX_DOMINANCE = 0.75;

const pairs = PERSONALITIES.flatMap((b) =>
  PERSONALITIES.map((r) => [b, r] as const),
);
const matches = planBatch(pairs, SEEDS).map(({ item: [b, r], job }) =>
  playMatch(b, r, jobSeed(7000, job)),
);
const summary = summarize(matches, ["blue", "red"]);
console.log(formatSummary(summary));
const failures = gateFailures(summary, ["blue", "red"], THRESHOLDS);
for (const [p, { won, decided }] of Object.entries(
  personalityShares(matches),
)) {
  const share = won / decided;
  console.log(`${p}: won ${won} of ${decided} (${(100 * share).toFixed(1)}%)`);
  if (!(share <= MAX_DOMINANCE))
    failures.push(
      `${p} wins ${(100 * share).toFixed(1)}% of decided matches against the others, over ${100 * MAX_DOMINANCE}%`,
    );
}
for (const f of failures) console.error(`GATE FAILED: ${f}`);
process.exit(failures.length ? 1 : 0);
