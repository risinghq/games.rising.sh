// Plays seeded runs for every scripted shooter and prints their pacing.
//   bun run batch [--seeds N]
import { formatSummary, playBatch, summarize } from "./pacing";

const flag = process.argv.indexOf("--seeds");
const seeds = flag >= 0 ? Number(process.argv[flag + 1]) : 200;
for (const runs of playBatch(seeds))
  console.log(formatSummary(summarize(runs)));
