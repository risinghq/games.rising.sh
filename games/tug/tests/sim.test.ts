import { describe, expect, it } from "vitest";
import { PERSONALITIES } from "../src/ai";
import { playMatch } from "../src/play";
import { MAX_TURNS } from "../src/sim";
import { tugHash } from "../src/sim";

describe("tug", () => {
  it("replays the same game from the same seed, and never calls Math.random", () => {
    const real = Math.random;
    Math.random = () => {
      throw new Error("Math.random called");
    };
    try {
      for (const p of PERSONALITIES)
        for (const q of PERSONALITIES)
          for (let seed = 0; seed < 20; seed++) {
            const a = playMatch(p, q, seed);
            const b = playMatch(p, q, seed);
            expect(tugHash(a.final)).toBe(tugHash(b.final));
          }
    } finally {
      Math.random = real;
    }
  });

  it("changes the game when the seed changes", () => {
    const hashes = new Set(
      Array.from({ length: 30 }, (_, s) =>
        tugHash(playMatch("gambler", "gambler", s).final),
      ),
    );
    expect(hashes.size).toBeGreaterThan(20);
  });

  it("ends every match within the turn cap", () => {
    for (let seed = 0; seed < 50; seed++)
      expect(playMatch("burst", "saver", seed).minutes).toBeLessThanOrEqual(
        MAX_TURNS,
      );
  });

  it("is fair between sides: a mirror batch splits close to even", () => {
    let blue = 0;
    let decided = 0;
    for (const p of PERSONALITIES)
      for (let seed = 0; seed < 500; seed++) {
        const m = playMatch(p, p, seed);
        if (m.winner === "draw") continue;
        decided++;
        if (m.winner === "blue") blue++;
      }
    expect(Math.abs(blue / decided - 0.5)).toBeLessThan(0.05);
  });
});
