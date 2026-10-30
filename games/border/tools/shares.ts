import { PERSONALITIES, type Personality } from "../src/ai";
import type { Match } from "../src/play";

/** Share of decided matches against different personalities, on either side. */
export function personalityShares(
  matches: Match[],
): Record<Personality, { won: number; decided: number }> {
  const out = {} as Record<Personality, { won: number; decided: number }>;
  for (const p of PERSONALITIES) {
    const decided = matches.filter(
      (m) =>
        m.winner !== "draw" &&
        m.blue !== m.red &&
        (m.blue === p || m.red === p),
    );
    const won = decided.filter((m) => m[m.winner as "blue" | "red"] === p);
    out[p] = { won: won.length, decided: decided.length };
  }
  return out;
}
