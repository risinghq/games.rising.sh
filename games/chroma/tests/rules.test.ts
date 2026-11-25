import { describe, expect, test } from "vitest";
import {
  BLUE,
  difficulty,
  GREEN,
  multiplier,
  ORANGE,
  PAINTS,
  pickDuck,
  PURPLE,
  RED,
  resolveShot,
  YELLOW,
} from "../src/rules";

const color = (mask: number) => ({ kind: "color" as const, mask });

describe("resolveShot", () => {
  test("matching paint paints the duck", () => {
    expect(resolveShot(color(RED), RED)).toEqual({ kind: "hit" });
    expect(resolveShot(color(GREEN), GREEN)).toEqual({ kind: "hit" });
  });

  test("a different primary mixes into the secondary", () => {
    expect(resolveShot(color(RED), BLUE)).toEqual({
      kind: "mix",
      mask: PURPLE,
    });
    expect(resolveShot(color(YELLOW), RED)).toEqual({
      kind: "mix",
      mask: ORANGE,
    });
    expect(resolveShot(color(YELLOW), GREEN)).toEqual({
      kind: "mix",
      mask: GREEN,
    });
  });

  test("a paint already in the duck's colour changes nothing", () => {
    expect(resolveShot(color(PURPLE), RED)).toEqual({ kind: "waste" });
  });

  test("all three primaries make mud", () => {
    expect(resolveShot(color(GREEN), RED)).toEqual({ kind: "ruin" });
    expect(resolveShot(color(RED), GREEN)).toEqual({ kind: "ruin" });
    expect(resolveShot(color(ORANGE), PURPLE)).toEqual({ kind: "ruin" });
  });

  test("golden takes any paint and decoys punish every shot", () => {
    for (const paint of PAINTS) {
      expect(resolveShot({ kind: "golden", mask: 0 }, paint.mask).kind).toBe(
        "golden",
      );
      expect(resolveShot({ kind: "decoy", mask: 0 }, paint.mask).kind).toBe(
        "decoy",
      );
    }
  });
});

test("the multiplier grows every five in a row and stops at five", () => {
  expect([0, 4, 5, 9, 10, 24, 100].map(multiplier)).toEqual([
    1, 1, 2, 2, 3, 5, 5,
  ]);
});

describe("pickDuck", () => {
  function sequence(values: number[]) {
    let i = 0;
    return () => values[i++ % values.length]!;
  }

  test("wave one sends only primary colour ducks without signs", () => {
    const d = difficulty(0);
    for (let i = 0; i < 200; i++) {
      const duck = pickDuck(d, Math.random);
      if (duck.kind !== "color") {
        expect(duck.kind).toBe("golden");
        continue;
      }
      expect([RED, YELLOW, BLUE]).toContain(duck.mask);
      expect(duck.word).toBeUndefined();
    }
  });

  test("a sign never names the duck's own colour", () => {
    const d = {
      ...difficulty(600),
      goldenChance: 0,
      decoyChance: 0,
      wordChance: 1,
    };
    for (let i = 0; i < 500; i++) {
      const duck = pickDuck(d, Math.random);
      expect(duck.word).toBeDefined();
      expect(duck.word).not.toBe(duck.mask);
    }
  });

  test("later waves bring decoys and secondary ducks", () => {
    const d = difficulty(120);
    expect(pickDuck(d, sequence([0.05])).kind).toBe("decoy");
    expect(pickDuck(d, sequence([0.9, 0.01, 0.5, 0.99])).mask).toBe(GREEN);
  });

  test("ducks come faster as waves pass", () => {
    expect(difficulty(0).wave).toBe(1);
    expect(difficulty(95).wave).toBe(4);
    expect(difficulty(95).spawnMs).toBeLessThan(difficulty(0).spawnMs);
    expect(difficulty(95).speed).toBeGreaterThan(difficulty(0).speed);
  });
});
