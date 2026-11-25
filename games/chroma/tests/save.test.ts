import { expect, test } from "vitest";
import {
  accuracy,
  emptySave,
  parseSave,
  recordRun,
  type RunResult,
} from "../src/save";

const run: RunResult = {
  score: 1200,
  shots: 20,
  hits: 15,
  bestStreak: 7,
  wave: 3,
  mixes: 2,
  ruins: 1,
  playMs: 61000,
  painted: { "1": 5, "6": 2 },
};

test("a missing or broken save starts fresh", () => {
  expect(parseSave(null)).toEqual(emptySave());
  expect(parseSave("{not json")).toEqual(emptySave());
  expect(parseSave("[1,2]")).toEqual(emptySave());
});

test("a save survives a round trip through JSON", () => {
  const save = recordRun(emptySave(), run);
  expect(parseSave(JSON.stringify(save))).toEqual(save);
});

test("fields of the wrong type fall back and the rest are kept", () => {
  const text = JSON.stringify({
    settings: { colorblind: "yes", music: false, sfx: 1 },
    stats: { runs: 4, bestScore: "lots" },
  });
  const save = parseSave(text);
  expect(save.settings).toEqual({ colorblind: false, music: false, sfx: true });
  expect(save.stats.runs).toBe(4);
  expect(save.stats.bestScore).toBe(0);
});

test("a save muted by the first release stays quiet", () => {
  const save = parseSave(
    JSON.stringify({ settings: { colorblind: true, muted: true } }),
  );
  expect(save.settings).toEqual({ colorblind: true, music: false, sfx: false });
});

test("runs add up and bests keep the maximum", () => {
  const first = recordRun(emptySave(), run);
  const second = recordRun(first, {
    ...run,
    score: 300,
    bestStreak: 12,
    painted: { "1": 1 },
  });
  expect(second.stats.runs).toBe(2);
  expect(second.stats.shots).toBe(40);
  expect(second.stats.bestScore).toBe(1200);
  expect(second.stats.bestStreak).toBe(12);
  expect(second.stats.painted).toEqual({ "1": 6, "6": 2 });
});

test("accuracy is a whole percentage and zero before any shot", () => {
  expect(accuracy(0, 0)).toBe(0);
  expect(accuracy(3, 2)).toBe(67);
});
