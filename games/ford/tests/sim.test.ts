import { describe, expect, it } from "vitest";
import { PERSONALITIES, choose } from "../src/ai";
import { playMatch } from "../src/play";
import {
  ARMY,
  EDGE,
  FORDS,
  MAX_TURNS,
  fordHash,
  legalOrders,
  newFord,
  openingLine,
  step,
  type Ford,
  type Orders,
} from "../src/sim";

function at(line: number[]): Ford {
  const t = newFord(1);
  t.line = line;
  return t;
}

describe("ford", () => {
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
            expect(fordHash(a.final)).toBe(fordHash(b.final));
          }
    } finally {
      Math.random = real;
    }
  });

  it("changes the game when the seed changes", () => {
    const hashes = new Set(
      Array.from({ length: 30 }, (_, s) =>
        fordHash(playMatch("gambler", "gambler", s).final),
      ),
    );
    expect(hashes.size).toBeGreaterThan(20);
  });

  it("ends every match within the turn cap", () => {
    for (const p of PERSONALITIES)
      for (const q of PERSONALITIES)
        for (let seed = 0; seed < 10; seed++)
          expect(playMatch(p, q, seed).minutes).toBeLessThanOrEqual(MAX_TURNS);
  });

  it("opens with one ford toward each side, so neither side starts ahead", () => {
    for (let seed = 0; seed < 200; seed++)
      expect([...openingLine(seed)].sort()).toEqual([-1, 0, 1]);
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

  describe("a turn", () => {
    const cases: {
      name: string;
      line: number[];
      blue: Orders;
      red: Orders;
      after: number[];
    }[] = [
      {
        name: "the larger force pushes one step toward its bank",
        line: [0, 0, 0],
        blue: [3, 0, 4],
        red: [2, 0, 3],
        after: [1, 0, 1],
      },
      {
        name: "a tie moves nothing",
        line: [1, 0, -1],
        blue: [2, 3, 2],
        red: [2, 3, 2],
        after: [1, 0, -1],
      },
      {
        name: "a margin of four is a rout and pushes two steps",
        line: [0, 0, 0],
        blue: [5, 0, 2],
        red: [1, 0, 6],
        after: [2, 0, -2],
      },
      {
        name: "a line stops at the bank",
        line: [EDGE, -EDGE, 0],
        blue: [1, 6, 0],
        red: [0, 0, 0],
        after: [EDGE, 0, 0],
      },
      {
        name: "troops beyond the army are cut from the later fords",
        line: [0, 0, 0],
        blue: [3, 3, 3],
        red: [2, 2, 2],
        after: [1, 1, -1],
      },
    ];
    it.each(cases)("$name", ({ line, blue, red, after }) => {
      const t = at(line);
      step(t, blue, red);
      expect(t.line).toEqual(after);
    });

    it("bad orders are made legal", () => {
      expect(legalOrders([NaN, -2, 2.9])).toEqual([0, 0, 2]);
      expect(legalOrders([ARMY + 3, 1])).toEqual([ARMY, 0, 0]);
      expect(legalOrders([])).toHaveLength(FORDS);
    });
  });

  describe("the end", () => {
    const cases: {
      name: string;
      line: number[];
      blue: Orders;
      red: Orders;
      winner: Ford["winner"];
    }[] = [
      {
        name: "two banks held end the match at once",
        line: [EDGE - 1, EDGE - 1, 0],
        blue: [2, 2, 0],
        red: [0, 0, 0],
        winner: "blue",
      },
      {
        name: "one bank held does not end it",
        line: [EDGE - 1, 0, 0],
        blue: [1, 0, 0],
        red: [0, 0, 0],
        winner: null,
      },
      {
        name: "red wins by holding two banks",
        line: [-(EDGE - 1), 0, -(EDGE - 1)],
        blue: [0, 0, 0],
        red: [1, 0, 1],
        winner: "red",
      },
      {
        name: "both reaching two banks together falls to the lines, then the draw",
        line: [EDGE - 1, EDGE - 1, -EDGE + 1],
        blue: [2, 2, 0],
        red: [0, 0, 1],
        winner: "blue",
      },
    ];
    it.each(cases)("$name", ({ line, blue, red, winner }) => {
      const t = at(line);
      step(t, blue, red);
      expect(t.winner).toBe(winner);
    });

    it("the cap decides by the lines, then fords won, then a draw", () => {
      const lines = (line: number[], blue: Orders, red: Orders) => {
        const t = at(line);
        t.turn = MAX_TURNS - 1;
        step(t, blue, red);
        return t.winner;
      };
      expect(lines([1, 0, 0], [0, 0, 0], [0, 0, 0])).toBe("blue");
      expect(lines([-1, 0, 0], [0, 0, 0], [0, 0, 0])).toBe("red");
      expect(lines([0, 0, 0], [0, 0, 0], [0, 0, 0])).toBe("draw");
      const t = at([0, 0, 0]);
      t.turn = MAX_TURNS - 1;
      t.history.push({
        clashes: [
          { sent: { blue: 1, red: 0 }, pushed: "blue", steps: 1 },
          { sent: { blue: 0, red: 0 }, pushed: null, steps: 0 },
          { sent: { blue: 0, red: 0 }, pushed: null, steps: 0 },
        ],
      });
      step(t, [0, 0, 0], [0, 0, 0]);
      expect(t.winner).toBe("blue");
    });
  });

  describe("the personalities", () => {
    it.each(PERSONALITIES)(
      "%s sends no more than the army and chooses from the state alone",
      (who) => {
        for (let seed = 0; seed < 20; seed++) {
          const t = newFord(seed);
          while (!t.winner) {
            for (const side of ["blue", "red"] as const) {
              const a = choose(t, side, who);
              expect(a).toHaveLength(FORDS);
              expect(a.reduce((x, y) => x + y, 0)).toBeLessThanOrEqual(ARMY);
              expect(choose(structuredClone(t), side, who)).toEqual(a);
            }
            step(t, choose(t, "blue", who), choose(t, "red", "warden"));
          }
        }
      },
    );
  });
});
