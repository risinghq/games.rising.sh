import { seededPick } from "@rising/sim-kit";
import {
  ARMY,
  EDGE,
  FORDS,
  legalOrders,
  other,
  type Ford,
  type Orders,
  type Side,
} from "./sim";

export type Personality =
  | "spreader"
  | "raider"
  | "mirror"
  | "gambler"
  | "warden"
  | "feinter";
export const PERSONALITIES: Personality[] = [
  "spreader",
  "raider",
  "mirror",
  "gambler",
  "warden",
  "feinter",
];

const fords = [...Array(FORDS).keys()];

/** Positive values mean the line is closer to `side`'s bank. */
const lead = (t: Ford, side: Side, ford: number): number =>
  (side === "blue" ? 1 : -1) * t.line[ford]!;

/** Split `total` in proportion to `weights`, assigning remainders by weight. */
function split(total: number, weights: number[]): Orders {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const out = weights.map((w) => Math.floor((total * w) / sum));
  const order = weights
    .map((w, i) => [w, i] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  let rest = total - out.reduce((a, b) => a + b, 0);
  for (let k = 0; rest > 0; k = (k + 1) % FORDS, rest--) out[order[k]![1]]!++;
  return out;
}

/**
 * Orders depend only on the shared state. The state includes the lines and
 * every finished turn.
 * A personality reads `history` for what the other side sent before.
 */
export function choose(t: Ford, side: Side, who: Personality): Orders {
  const foe = other(side);
  const last = t.history.at(-1)?.clashes;
  const roll = (salt: string, n: number, ...keys: number[]) =>
    seededPick(t.seed, n, `${who}-${side}-${salt}`, t.turn, ...keys);
  const orders = ((): Orders => {
    switch (who) {
      case "spreader":
        // Share troops evenly. Send the spare troop to a ford chosen by the
        // seed.
        return split(
          ARMY,
          fords.map((i) => 6 + (i === roll("spare", FORDS) ? 1 : 0)),
        );
      case "raider": {
        // Concentrate troops on the two fords where the other side sent least
        // last turn.
        const seen = last
          ? last.map((c) => c.sent[foe])
          : fords.map((i) => roll("open", 3, i));
        const out = [...fords].sort((a, b) => seen[a]! - seen[b]! || a - b);
        return split(
          ARMY,
          fords.map((i) => (out.slice(0, 2).includes(i) ? 1 : 0)),
        );
      }
      case "mirror":
        // Send one more than the other side sent at each ford last turn.
        if (!last) return split(ARMY, [1, 1, 1]);
        return fords.map((i) => last[i]!.sent[foe] + 1);
      case "gambler":
        return split(
          ARMY,
          fords.map((i) => roll("weight", 5, i)),
        );
      case "warden":
        // Troops where the other side stands closest to its bank.
        return split(
          ARMY,
          fords.map((i) => 1 + lead(t, foe, i) + EDGE),
        );
      case "feinter": {
        // Troops where it sent least last turn, so it never repeats itself.
        if (!last) return split(ARMY, [1, 1, 1]);
        const top = Math.max(...last.map((c) => c.sent[side]));
        return split(
          ARMY,
          last.map((c) => 1 + top - c.sent[side]),
        );
      }
    }
  })();
  return legalOrders(orders);
}
