// Plays every shooter over the same seeds and summarizes each one's runs.
import { playRun, SHOOTERS, type RunResult } from "../src/sim";

export interface ShooterSummary {
  shooter: string;
  runs: number;
  meanScore: number;
  medianSeconds: number;
  medianWave: number;
  cappedRate: number;
  accuracy: number;
}

export function playBatch(seeds: number, base = 9000): RunResult[][] {
  return SHOOTERS.map((s) =>
    Array.from({ length: seeds }, (_, i) => playRun(s, base + i)),
  );
}

export function summarize(runs: RunResult[]): ShooterSummary {
  const median = (xs: number[]) =>
    [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const shots = runs.reduce((n, r) => n + r.shots, 0);
  return {
    shooter: runs[0]?.shooter ?? "",
    runs: runs.length,
    meanScore: runs.reduce((n, r) => n + r.score, 0) / runs.length,
    medianSeconds: median(runs.map((r) => r.seconds)),
    medianWave: median(runs.map((r) => r.wave)),
    cappedRate: runs.filter((r) => r.capped).length / runs.length,
    accuracy: shots ? runs.reduce((n, r) => n + r.hits, 0) / shots : 0,
  };
}

export function formatSummary(s: ShooterSummary): string {
  return [
    s.shooter.padEnd(8),
    `runs ${s.runs}`,
    `score ${Math.round(s.meanScore)}`.padEnd(12),
    `median ${Math.round(s.medianSeconds)} s (wave ${s.medianWave})`.padEnd(26),
    `capped ${(100 * s.cappedRate).toFixed(1)}%`,
    `accuracy ${(100 * s.accuracy).toFixed(1)}%`,
  ].join("  ");
}
