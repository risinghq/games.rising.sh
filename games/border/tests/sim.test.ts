import { seededRandom } from "@rising/sim-kit";
import { describe, expect, it } from "vitest";
import { PERSONALITIES } from "../src/ai";
import { playMatch } from "../src/play";
import {
  FOG_CATCH,
  MAX_LOAD,
  PASSES,
  ROUNDS,
  STOCK,
  borderHash,
  fogOf,
  newBorder,
  other,
  runnerOf,
  step,
  worth,
  type Border,
} from "../src/sim";

/** A fresh game whose first round has the wanted fog and fog coin. */
function seedWhere(fogCatches: boolean): number {
  for (let seed = 0; ; seed++) {
    const heads = seededRandom(seed, "fog-coin", 0) < FOG_CATCH;
    if (heads === fogCatches) return seed;
  }
}

describe("border", () => {
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
            expect(borderHash(a.final)).toBe(borderHash(b.final));
          }
    } finally {
      Math.random = random;
      Date.now = now;
    }
  });

  it("changes the game when the seed changes", () => {
    const hashes = new Set(
      Array.from({ length: 30 }, (_, s) =>
        borderHash(playMatch("gambler", "gambler", s).final),
      ),
    );
    expect(hashes.size).toBeGreaterThan(25);
  });

  it("ends every match within the turn cap", () => {
    for (const p of PERSONALITIES)
      for (const q of PERSONALITIES)
        for (let seed = 0; seed < 10; seed++) {
          const m = playMatch(p, q, seed);
          expect(m.minutes).toBeLessThanOrEqual(ROUNDS);
          expect(m.winner).not.toBeNull();
        }
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

  it("alternates the runner, five runs each, with either side first", () => {
    const firsts = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const m = playMatch("gambler", "gambler", seed);
      const runners = m.final.history.map((r) => r.runner);
      firsts.add(runners[0]!);
      expect(runners.filter((r) => r === "blue")).toHaveLength(ROUNDS / 2);
      runners.forEach((r, i) =>
        expect(r).toBe(i % 2 ? other(runners[0]!) : runners[0]),
      );
    }
    expect(firsts.size).toBe(2);
  });

  describe("a round", () => {
    /** The first round and its seed-selected fog pass. */
    const start = (seed: number): { t: Border; fog: number; open: number } => {
      const t = newBorder(seed);
      const fog = fogOf(t);
      return { t, fog, open: (fog + 1) % PASSES };
    };
    const cases: {
      name: string;
      coin?: boolean;
      load: number;
      pass: "open" | "fog";
      guard: "open" | "fog" | "other";
      scorer: "runner" | "watcher";
      points: number;
    }[] = [
      {
        name: "a guard on the pass catches the crates",
        load: 3,
        pass: "open",
        guard: "open",
        scorer: "watcher",
        points: worth(3),
      },
      {
        name: "a guard elsewhere lets the runner through",
        load: 3,
        pass: "open",
        guard: "fog",
        scorer: "runner",
        points: worth(3),
      },
      {
        name: "fog and a heads coin catch",
        coin: true,
        load: 2,
        pass: "fog",
        guard: "fog",
        scorer: "watcher",
        points: worth(2),
      },
      {
        name: "fog and a tails coin let the runner through",
        coin: false,
        load: 2,
        pass: "fog",
        guard: "fog",
        scorer: "runner",
        points: worth(2),
      },
      {
        name: "a load above the cap is cut to the cap",
        load: 99,
        pass: "open",
        guard: "fog",
        scorer: "runner",
        points: worth(MAX_LOAD),
      },
    ];
    for (const c of cases)
      it(c.name, () => {
        const { t, fog, open } = start(seedWhere(c.coin ?? true));
        const runner = runnerOf(t);
        const at = { open, fog, other: (fog + 2) % PASSES };
        step(t, c.load, at[c.pass], at[c.guard]);
        const scorer = c.scorer === "runner" ? runner : other(runner);
        expect(t.points[scorer]).toBe(c.points);
        expect(t.points[other(scorer)]).toBe(0);
        expect(t.stock[runner]).toBe(STOCK - Math.min(c.load, MAX_LOAD));
        expect(t.history[0]!.caught).toBe(c.scorer === "watcher");
      });

    it("breaks a points tie by catches, then calls a draw", () => {
      const tied = (caught: boolean): Border => {
        const t = newBorder(1);
        t.turn = ROUNDS - 1;
        t.points = { blue: 4, red: 4 };
        const runner = runnerOf(t);
        t.history = [{ runner, fog: 0, load: 0, pass: 1, guard: 1, caught }];
        step(t, 0, 1, 2);
        return t;
      };
      const t = tied(true);
      expect(t.winner).toBe(other(t.history[0]!.runner));
      expect(tied(false).winner).toBe("draw");
    });
  });
});
