import { describe, expect, it } from "vitest";
import { difficulty } from "../src/rules";
import { nextSpawn, stream } from "../src/run";
import { MAX_SECONDS, playRun, SHOOTERS } from "../src/sim";

describe("chroma runs", () => {
  it("replays the same run from the same seed, and never calls Math.random", () => {
    const real = Math.random;
    Math.random = () => {
      throw new Error("Math.random called");
    };
    try {
      for (const s of SHOOTERS)
        for (let seed = 0; seed < 10; seed++)
          expect(playRun(s, seed).hash).toBe(playRun(s, seed).hash);
    } finally {
      Math.random = real;
    }
  });

  it("changes the run when the seed changes", () => {
    const hashes = new Set(
      Array.from({ length: 30 }, (_, seed) => playRun(SHOOTERS[0]!, seed).hash),
    );
    expect(hashes.size).toBe(30);
  });

  it("gives the play scene and the simulation the same ducks from a seed", () => {
    const d = difficulty(200);
    const a = stream(42, "spawn");
    const b = stream(42, "spawn");
    for (let i = 0; i < 50; i++)
      expect(nextSpawn(d, a)).toEqual(nextSpawn(d, b));
  });

  it("ends every run within the time cap", () => {
    for (let seed = 0; seed < 20; seed++)
      expect(playRun(SHOOTERS[2]!, seed).seconds).toBeLessThanOrEqual(
        MAX_SECONDS + 1,
      );
  });
});
