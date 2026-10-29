// Run every ordered personality pair and print the batch summary and each
// personality's share of decided matches.
// Usage: bun run batch [--seeds N] [--shard i/n]
import { formatSummary, jobSeed, planBatch, summarize } from "@rising/sim-kit";
import { PERSONALITIES } from "../src/ai";
import { playMatch } from "../src/play";
import { personalityShares } from "./shares";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const seeds = Number(arg("--seeds") ?? 200);
const [shard, shards] = (arg("--shard") ?? "0/1").split("/").map(Number) as [
  number,
  number,
];
const pairs = PERSONALITIES.flatMap((b) =>
  PERSONALITIES.map((r) => [b, r] as const),
);
const matches = planBatch(pairs, seeds, shard, shards).map(
  ({ item: [b, r], job }) => playMatch(b, r, jobSeed(7000, job)),
);
console.log(formatSummary(summarize(matches, ["blue", "red"])));
for (const [p, { won, decided }] of Object.entries(personalityShares(matches)))
  console.log(`${p}: won ${won} of ${decided} decided against others`);
