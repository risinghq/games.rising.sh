import type { Summary } from "./batch";

/** The limits a game's batch playtest must stay inside. */
export interface Thresholds {
  /** Most undecided matches allowed, as a share of all matches. */
  maxDrawRate: number;
  /** How far the first side's share of decided wins may sit from half. */
  maxSideSkew: number;
  /** Fewest matches that make the numbers worth judging. */
  minMatches: number;
}

/** Reasons the batch fails the gate; empty means it passes. */
export function gateFailures(
  s: Summary,
  sides: [string, string],
  t: Thresholds,
): string[] {
  const out: string[] = [];
  if (s.matches < t.minMatches)
    out.push(`only ${s.matches} matches, need ${t.minMatches}`);
  if (!(s.drawRate <= t.maxDrawRate))
    out.push(
      `draw rate ${(100 * s.drawRate).toFixed(1)}% is over ${100 * t.maxDrawRate}%`,
    );
  const share = s.winShare[sides[0]] ?? NaN;
  if (!(Math.abs(share - 0.5) <= t.maxSideSkew))
    out.push(
      `${sides[0]} wins ${(100 * share).toFixed(1)}% of decided matches, more than ${100 * t.maxSideSkew} points from 50%`,
    );
  return out;
}
