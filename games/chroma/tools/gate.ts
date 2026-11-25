// The pacing gate: plays SEEDS runs per scripted shooter and exits 1 when the
// batch breaks the thresholds that RULES.md justifies. The PR check runs it.
//   bun run gate
import {
  formatSummary,
  playBatch,
  summarize,
  type ShooterSummary,
} from "./pacing";

const SEEDS = 200;
const MIN_NOVICE_SECONDS = 60;
const MIN_SCORE_STEP = 1.5;
const MAX_CAPPED_RATE = 0.15;

function gateFailures(summaries: ShooterSummary[]): string[] {
  const out: string[] = [];
  for (const s of summaries) {
    if (s.runs < SEEDS)
      out.push(`${s.shooter}: only ${s.runs} runs, need ${SEEDS}`);
    if (s.cappedRate > MAX_CAPPED_RATE)
      out.push(
        `${s.shooter}: ${(100 * s.cappedRate).toFixed(1)}% of runs never end, over ${100 * MAX_CAPPED_RATE}%`,
      );
  }
  const novice = summaries[0];
  if (novice && novice.medianSeconds < MIN_NOVICE_SECONDS)
    out.push(
      `${novice.shooter}: median run ${Math.round(novice.medianSeconds)} s, under ${MIN_NOVICE_SECONDS} s`,
    );
  for (let i = 1; i < summaries.length; i++) {
    const [weak, strong] = [summaries[i - 1]!, summaries[i]!];
    if (!(strong.meanScore >= weak.meanScore * MIN_SCORE_STEP))
      out.push(
        `${strong.shooter} scores ${Math.round(strong.meanScore)}, under ${MIN_SCORE_STEP}x ${weak.shooter}'s ${Math.round(weak.meanScore)}`,
      );
  }
  return out;
}

const summaries = playBatch(SEEDS).map(summarize);
for (const s of summaries) console.log(formatSummary(s));
const failures = gateFailures(summaries);
for (const f of failures) console.error(`GATE FAILED: ${f}`);
process.exit(failures.length ? 1 : 0);
