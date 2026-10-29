import { describe, expect, it } from "vitest";
import { PERSONALITIES, choose } from "../src/ai";
import { playMatch } from "../src/play";
import {
  MAX_TURNS,
  START_DIVERS,
  newReef,
  pearlValue,
  reefHash,
  step,
  type Reef,
} from "../src/sim";

describe("reef", () => {
  it("replays the same game from the same seed, and never calls Math.random or Date.now", () => {
    const { random, now } = { random: Math.random, now: Date.now };
    Math.random = Date.now = () => {
      throw new Error("nondeterministic call");
    };
    try {
      for (const p of PERSONALITIES)
        for (const q of PERSONALITIES)
          for (let seed = 0; seed < 20; seed++) {
            const a = playMatch(p, q, seed);
            const b = playMatch(p, q, seed);
            expect(reefHash(a.final)).toBe(reefHash(b.final));
          }
    } finally {
      Math.random = random;
      Date.now = now;
    }
  });

  it("changes the game when the seed changes", () => {
    const pearls = new Set(
      Array.from({ length: 30 }, (_, s) =>
        playMatch("steady", "steady", s)
          .final.dives.map((d) => d.value)
          .join(""),
      ),
    );
    expect(pearls.size).toBeGreaterThan(20);
  });

  it("ends every match within the turn cap", () => {
    for (const p of PERSONALITIES)
      for (let seed = 0; seed < 20; seed++)
        expect(playMatch(p, "steady", seed).minutes).toBeLessThanOrEqual(
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
    expect(Math.abs(blue / decided - 0.5)).toBeLessThan(0.04);
  });

  it("chooses bids from the next dive and no later one", () => {
    for (let turn = 0; turn <= 3; turn++) {
      // Two seeds whose pearls agree up to the next dive and differ after it.
      const seen = new Map<string, number>();
      let pair: [number, number] | undefined;
      for (let seed = 0; seed < 5000 && !pair; seed++) {
        const key = Array.from({ length: turn + 2 }, (_, i) =>
          pearlValue(seed, i),
        ).join();
        const earlier = seen.get(key);
        if (earlier === undefined) seen.set(key, seed);
        else if (pearlValue(earlier, turn + 2) !== pearlValue(seed, turn + 2))
          pair = [earlier, seed];
      }
      expect(pair, `no seed pair for turn ${turn}`).toBeDefined();
      const [a, b] = [newReef(pair![0]), newReef(pair![1])];
      for (let i = 0; i < turn; i++) {
        step(a, 3, 2);
        step(b, 3, 2);
      }
      for (const p of PERSONALITIES)
        for (const side of ["blue", "red"] as const)
          expect(choose(a, side, p), `${p} ${side} turn ${turn}`).toBe(
            choose(b, side, p),
          );
    }
  });

  describe("a dive", () => {
    const value = pearlValue(1, 0);

    it.each([
      ["the higher bid takes it", 5, 3, "blue", 5],
      ["red takes it with the higher bid", 2, 7, "red", 7],
      ["a bid above the purse is the whole purse", 99, 0, "blue", START_DIVERS],
      ["a fraction is rounded down", 4.9, 5.1, "red", 5],
    ] as const)("%s", (_name, blue, red, taker, paid) => {
      const t = newReef(1);
      step(t, blue, red);
      const dive = t.dives[0]!;
      expect(dive.taker).toBe(taker);
      expect(dive.coin).toBe(false);
      expect(t.pearls[taker]).toBe(value);
      expect(t.divers[taker]).toBe(START_DIVERS - paid);
      expect(t.divers[taker === "blue" ? "red" : "blue"]).toBe(START_DIVERS);
    });

    it("counts a negative or broken bid as nothing", () => {
      const t = newReef(1);
      step(t, -4, Number.NaN);
      expect(t.dives[0]!.bids).toEqual({ blue: 0, red: 0 });
      expect(t.dives[0]!.coin).toBe(true);
    });

    it("hands an equal bid to a coin that favours neither side", () => {
      let blue = 0;
      for (let seed = 0; seed < 1000; seed++) {
        const t = newReef(seed);
        step(t, 3, 3);
        expect(t.dives[0]!.coin).toBe(true);
        if (t.dives[0]!.taker === "blue") blue++;
      }
      expect(Math.abs(blue / 1000 - 0.5)).toBeLessThan(0.06);
    });

    it("pays one pearl more for a second dive in a row", () => {
      const t = newReef(1);
      step(t, 2, 0);
      step(t, 2, 0);
      step(t, 0, 2);
      const [first, second, third] = t.dives;
      expect(first!.gain).toBe(first!.value);
      expect(second!.gain).toBe(second!.value + 1);
      expect(third!.gain).toBe(third!.value);
    });
  });

  describe("the last dive", () => {
    // Blue takes the last dive for one diver; the lead before it is set so
    // that blue ends level on pearls with red.
    function lastDive(redDivers: number): Reef {
      const t = newReef(1);
      t.turn = MAX_TURNS - 1;
      t.divers = { blue: 10, red: redDivers };
      t.pearls = { blue: 0, red: pearlValue(1, MAX_TURNS - 1) };
      step(t, 1, 0);
      return t;
    }

    it.each([
      [
        "goes to the side with more divers left when pearls are level",
        8,
        "blue",
      ],
      ["goes to red when red has more divers left", 20, "red"],
      ["is a draw when pearls and divers are level", 9, "draw"],
    ])("%s", (_name, redDivers, winner) => {
      expect(lastDive(redDivers).winner).toBe(winner);
    });

    it("ends the match and refuses further dives", () => {
      const t = lastDive(9);
      const hash = reefHash(t);
      step(t, 5, 0);
      expect(reefHash(t)).toBe(hash);
    });
  });
});
