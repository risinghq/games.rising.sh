import { describe, expect, it } from "vitest";
import { Fnv, hash32, seededPick, seededRandom } from "../src";

describe("seeded randomness", () => {
  it("repeats for the same seed, salt and keys, and never calls Math.random", () => {
    const real = Math.random;
    Math.random = () => {
      throw new Error("Math.random called");
    };
    try {
      const run = () =>
        Array.from({ length: 100 }, (_, i) => seededRandom(42, "x", i));
      expect(run()).toEqual(run());
    } finally {
      Math.random = real;
    }
  });

  it("stays in range and differs by seed", () => {
    for (let i = 0; i < 1000; i++) {
      const r = seededRandom(1, "r", i);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
      expect(seededPick(1, 6, "d", i)).toBeLessThan(6);
    }
    expect(seededRandom(1, "r", 0)).not.toBe(seededRandom(2, "r", 0));
  });

  it("hashes the same way every time", () => {
    expect(hash32(1, 2, 3)).toBe(hash32(1, 2, 3));
    const f = new Fnv();
    f.num(1.5);
    f.str("abc");
    expect(f.hex()).toMatch(/^[0-9a-f]{8}$/);
  });
});
