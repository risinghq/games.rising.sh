import { describe, expect, it } from "vitest";
import { formatSummary, jobSeed, planBatch, summarize } from "../src";

describe("planBatch", () => {
  it("splits the job list across shards with no overlap and no gap", () => {
    const roster = ["a", "b", "c"];
    const all = planBatch(roster, 4).map((j) => j.job.index);
    const sharded = [0, 1, 2, 3, 4].flatMap((s) =>
      planBatch(roster, 4, s, 5).map((j) => j.job.index),
    );
    expect(sharded.sort((a, b) => a - b)).toEqual(all);
  });

  it("gives every job its own seed", () => {
    const seeds = planBatch(["a", "b", "c"], 50).map(({ job }) =>
      jobSeed(7000, job),
    );
    expect(new Set(seeds).size).toBe(seeds.length);
  });
});

describe("summarize", () => {
  it("reports draws and the win share of decided matches", () => {
    const s = summarize(
      [
        { winner: "blue", minutes: 4, ms: 40 },
        { winner: "blue", minutes: 6, ms: 60 },
        { winner: "red", minutes: 5, ms: 50 },
        { winner: "draw", minutes: 25, ms: 250 },
      ],
      ["blue", "red"],
    );
    expect(s.draws).toBe(1);
    expect(s.drawRate).toBe(0.25);
    expect(s.winShare.blue).toBeCloseTo(2 / 3);
    expect(s.msPerMinute).toBe(10);
    expect(formatSummary(s)).toContain("blue 67%");
  });
});
