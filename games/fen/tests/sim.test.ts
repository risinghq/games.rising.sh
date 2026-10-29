import { describe, expect, it } from "vitest";
import { PERSONALITIES, choose } from "../src/ai";
import { playMatch } from "../src/play";
import {
  FLAT_TURN,
  MAX_AMMO,
  MAX_TURNS,
  START_HP,
  canShoot,
  fenHash,
  newFen,
  step,
  type Action,
  type Fen,
} from "../src/sim";

const hold: Action = { move: 0, shot: null };
const shoot = (shot: number, move: Action["move"] = 0): Action => ({
  move,
  shot,
});

/** A marsh with no reeds, blue on tile 2 and red on tile 4, unless told. */
function marsh(over: Partial<Fen> = {}): Fen {
  return {
    ...newFen(1),
    reeds: [],
    pos: { blue: 2, red: 4 },
    ...over,
  };
}

describe("fen rules", () => {
  it.each([
    ["hits a side that stays", marsh(), shoot(4), hold, { red: 1 }],
    [
      "misses a side that steps away",
      marsh(),
      shoot(4),
      { move: 1, shot: null },
      {},
    ],
    [
      "hits the tile a side steps onto",
      marsh(),
      shoot(5),
      { move: 1, shot: null },
      { red: 1 },
    ],
    [
      "does not hit through reeds from two tiles",
      marsh({ reeds: [4] }),
      shoot(4),
      hold,
      {},
    ],
    [
      "hits through reeds from the next tile",
      marsh({ reeds: [4], pos: { blue: 3, red: 4 } }),
      shoot(4),
      hold,
      { red: 1 },
    ],
    [
      "hits through reeds once they lie flat",
      marsh({ reeds: [4], turn: FLAT_TURN }),
      shoot(4),
      hold,
      { red: 1 },
    ],
    [
      "measures reed cover from where the shooter stood",
      marsh({ reeds: [3], pos: { blue: 2, red: 4 } }),
      shoot(3, 1),
      { move: -1, shot: null },
      {},
    ],
    [
      "lets both sides hit each other",
      marsh(),
      shoot(4),
      shoot(2),
      { blue: 1, red: 1 },
    ],
  ] as const)("%s", (_name, state, blue, red, damage) => {
    const t = structuredClone(state) as Fen;
    step(t, blue, red);
    expect(START_HP - t.hp.blue).toBe((damage as { blue?: number }).blue ?? 0);
    expect(START_HP - t.hp.red).toBe((damage as { red?: number }).red ?? 0);
  });

  it.each([
    [
      "both step onto one tile",
      { blue: 2, red: 4 },
      1,
      -1,
      { blue: 2, red: 4 },
    ],
    ["two sides swap tiles", { blue: 3, red: 4 }, 1, -1, { blue: 3, red: 4 }],
    [
      "one steps off the marsh",
      { blue: 0, red: 4 },
      -1,
      1,
      { blue: 0, red: 5 },
    ],
  ] as const)("moves when %s", (_name, pos, blue, red, end) => {
    const t = marsh({ pos: { ...pos } });
    step(t, { move: blue, shot: null }, { move: red, shot: null });
    expect(t.pos).toEqual(end);
  });

  it("spends a round per shot and reloads when fire is held", () => {
    const t = marsh();
    step(t, shoot(0), hold);
    expect(t.ammo).toEqual({ blue: 1, red: 3 });
    step(t, hold, hold);
    step(t, hold, hold);
    expect(t.ammo).toEqual({ blue: MAX_AMMO, red: MAX_AMMO });
  });

  it("holds a shot with no round or out of range", () => {
    const t = marsh({ ammo: { blue: 0, red: 2 }, pos: { blue: 0, red: 4 } });
    expect(canShoot(t, "blue", 0)).toBe(false);
    expect(canShoot(t, "red", 7)).toBe(false);
    expect(canShoot(t, "red", 0)).toBe(false);
    step(t, shoot(4), shoot(0));
    expect(t.hp).toEqual({ blue: START_HP, red: START_HP });
    expect(t.ammo).toEqual({ blue: 1, red: 3 });
  });

  it.each([
    [
      "the last side standing wins",
      { blue: 3, red: 1 },
      { blue: 2, red: 2 },
      1,
      shoot(4),
      hold,
      "blue",
    ],
    [
      "both falling together is a draw",
      { blue: 1, red: 1 },
      { blue: 2, red: 2 },
      1,
      shoot(4),
      shoot(2),
      "draw",
    ],
    [
      "more hp wins at the cap",
      { blue: 3, red: 2 },
      { blue: 2, red: 2 },
      MAX_TURNS,
      hold,
      hold,
      "blue",
    ],
    [
      "more rounds break an hp tie at the cap",
      { blue: 2, red: 2 },
      { blue: 0, red: 2 },
      MAX_TURNS,
      hold,
      hold,
      "red",
    ],
    [
      "equal hp and rounds at the cap is a draw",
      { blue: 2, red: 2 },
      { blue: 2, red: 2 },
      MAX_TURNS,
      hold,
      hold,
      "draw",
    ],
  ] as const)(
    "ends the match: %s",
    (_name, hp, ammo, turns, blue, red, winner) => {
      const t = marsh({ hp: { ...hp }, ammo: { ...ammo }, turn: turns - 1 });
      step(t, blue, red);
      expect(t.winner).toBe(winner);
    },
  );
});

describe("fen simulation", () => {
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
            expect(fenHash(a.final)).toBe(fenHash(b.final));
          }
    } finally {
      Math.random = real;
    }
  });

  it("changes the game when the seed changes", () => {
    const hashes = new Set(
      Array.from({ length: 30 }, (_, s) =>
        fenHash(playMatch("gambler", "gambler", s).final),
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

  it("has every personality hold fire rather than shoot illegally", () => {
    for (const p of PERSONALITIES)
      for (let seed = 0; seed < 20; seed++) {
        const t = newFen(seed);
        while (!t.winner) {
          for (const side of ["blue", "red"] as const) {
            const { shot } = choose(t, side, p);
            if (shot !== null) expect(canShoot(t, side, shot)).toBe(true);
          }
          step(t, choose(t, "blue", p), choose(t, "red", "gambler"));
        }
      }
  });
});
