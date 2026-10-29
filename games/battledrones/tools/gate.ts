// The balance gate: plays a fixed seeded roster of AI-vs-AI skirmishes with the
// pacing panel's sim and exits 1 when the batch breaks THRESHOLDS. The PR check
// runs it. It splits the roster across one process per core.
//   bun run gate [--rounds N]
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import {
  formatSummary,
  gateFailures,
  jobSeed,
  planBatch,
  summarize,
  type Outcome,
  type Thresholds,
} from "@rising/sim-kit";
import { STRATEGIES, type StrategyName } from "../src/sim/ai/commander";
import { MAPS } from "../src/sim/maps";
import { playMatch } from "./pacing-match";

const ROUNDS = 1;
const PAIRS_PER_MAP = 4;
const THRESHOLDS: Thresholds = {
  maxDrawRate: 0.15,
  maxSideSkew: 0.2,
  minMatches: 56,
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const names = Object.keys(STRATEGIES) as StrategyName[];
const pairs = names.flatMap((a, i) => names.slice(i + 1).map((b) => [a, b] as const));
const roster = MAPS.flatMap((m, i) =>
  Array.from({ length: PAIRS_PER_MAP }, (_, k) => pairs[(i * PAIRS_PER_MAP + k) % pairs.length]!).flatMap(
    ([a, b]) => [[m.id, a, b] as const, [m.id, b, a] as const],
  ),
);
const rounds = Number(arg("--rounds") ?? ROUNDS);

function play(shard: number, shards: number): Outcome[] {
  return planBatch(roster, rounds, shard, shards).map(({ item: [map, b, r], job }) => {
    const m = playMatch(map, b, r, jobSeed(7000, job), 11 + job.index * 2);
    return { winner: m.winner, minutes: m.min };
  });
}

function worker(shard: number, shards: number): Promise<Outcome[]> {
  const script = fileURLToPath(import.meta.url);
  const args = [process.argv[1]!, script, "--rounds", String(rounds), "--shard", `${shard}/${shards}`];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(out.split("\n").filter(Boolean).map((l) => JSON.parse(l) as Outcome))
        : reject(new Error(`gate worker ${shard}/${shards} exited ${code}`)),
    );
  });
}

const shardArg = arg("--shard");
if (shardArg) {
  const [shard, shards] = shardArg.split("/").map(Number) as [number, number];
  for (const o of play(shard, shards)) console.log(JSON.stringify(o));
} else {
  const shards = availableParallelism();
  const matches = (await Promise.all(Array.from({ length: shards }, (_, i) => worker(i, shards)))).flat();
  const summary = summarize(matches, ["blue", "red"]);
  console.log(formatSummary(summary));
  const failures = gateFailures(summary, ["blue", "red"], THRESHOLDS);
  for (const f of failures) console.error(`GATE FAILED: ${f}`);
  process.exit(failures.length ? 1 : 0);
}
