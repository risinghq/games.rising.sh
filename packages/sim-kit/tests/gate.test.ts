import { describe, expect, it } from "vitest";
import { gateFailures, summarize, type Outcome } from "../src";

const t = { maxDrawRate: 0.1, maxSideSkew: 0.05, minMatches: 100 };
const batch = (blue: number, red: number, draw: number): Outcome[] => [
  ...Array.from({ length: blue }, () => ({ winner: "blue", minutes: 5 })),
  ...Array.from({ length: red }, () => ({ winner: "red", minutes: 5 })),
  ...Array.from({ length: draw }, () => ({ winner: "draw", minutes: 25 })),
];
const run = (b: Outcome[]) =>
  gateFailures(summarize(b, ["blue", "red"]), ["blue", "red"], t);

describe("gateFailures", () => {
  it("passes a fair, decided batch", () =>
    expect(run(batch(48, 48, 4))).toEqual([]));
  it("fails a skewed batch", () =>
    expect(run(batch(70, 26, 4))).toHaveLength(1));
  it("fails too many draws", () =>
    expect(run(batch(40, 40, 20))[0]).toContain("draw rate"));
  it("fails a batch too small to judge", () =>
    expect(run(batch(10, 10, 0))[0]).toContain("only 20"));
});
