// A colour is a bitmask of the three painter's primaries. Mixing paints is a
// bitwise OR, so red + blue = purple and all three together make mud.
export const RED = 1;
export const YELLOW = 2;
export const BLUE = 4;
export const ORANGE = RED | YELLOW;
export const PURPLE = RED | BLUE;
export const GREEN = YELLOW | BLUE;
export const MUD = RED | YELLOW | BLUE;

export interface Paint {
  mask: number;
  name: string;
  hex: number;
}

export const PAINTS: readonly Paint[] = [
  { mask: RED, name: "Rojo", hex: 0xe8383d },
  { mask: YELLOW, name: "Amarillo", hex: 0xffd23f },
  { mask: BLUE, name: "Azul", hex: 0x2f80ed },
  { mask: ORANGE, name: "Naranja", hex: 0xff8c1a },
  { mask: GREEN, name: "Verde", hex: 0x3cb44b },
  { mask: PURPLE, name: "Morado", hex: 0x9b51e0 },
];

export const MUD_HEX = 0x7a5a3a;
export const GOLD_HEX = 0xffb300;

export function paintOf(mask: number): Paint | undefined {
  return PAINTS.find((p) => p.mask === mask);
}

export function isPrimary(mask: number): boolean {
  return mask === RED || mask === YELLOW || mask === BLUE;
}

export type DuckKind = "color" | "golden" | "decoy";

export interface DuckSpec {
  kind: DuckKind;
  mask: number;
  // A colour word on a sign the duck carries; it never names the duck's colour.
  word?: number;
}

export type Outcome =
  | { kind: "hit" }
  | { kind: "golden" }
  | { kind: "decoy" }
  | { kind: "mix"; mask: number }
  | { kind: "ruin" }
  | { kind: "waste" };

export function resolveShot(duck: DuckSpec, paint: number): Outcome {
  if (duck.kind === "golden") return { kind: "golden" };
  if (duck.kind === "decoy") return { kind: "decoy" };
  if (paint === duck.mask) return { kind: "hit" };
  const mixed = duck.mask | paint;
  if (mixed === duck.mask) return { kind: "waste" };
  if (mixed === MUD) return { kind: "ruin" };
  return { kind: "mix", mask: mixed };
}

export function multiplier(streak: number): number {
  return Math.min(5, 1 + Math.floor(streak / 5));
}

export function basePoints(duck: DuckSpec): number {
  if (duck.kind === "golden") return 500;
  return isPrimary(duck.mask) ? 100 : 150;
}

export const WAVE_SECONDS = 30;
export const START_LIVES = 3;

export interface Difficulty {
  wave: number;
  spawnMs: number;
  speed: number;
  secondaryChance: number;
  decoyChance: number;
  goldenChance: number;
  wordChance: number;
}

export function difficulty(elapsedSeconds: number): Difficulty {
  const wave = 1 + Math.floor(elapsedSeconds / WAVE_SECONDS);
  return {
    wave,
    spawnMs: Math.max(420, 1500 - wave * 130),
    speed: 110 + wave * 28,
    secondaryChance: wave >= 3 ? Math.min(0.5, 0.15 * (wave - 2)) : 0,
    decoyChance: wave >= 2 ? 0.12 : 0,
    goldenChance: 0.03,
    wordChance: wave >= 4 ? Math.min(0.45, 0.12 * (wave - 3)) : 0,
  };
}

const PRIMARIES = [RED, YELLOW, BLUE];
const SECONDARIES = [ORANGE, GREEN, PURPLE];

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function pickDuck(d: Difficulty, rng: () => number): DuckSpec {
  const roll = rng();
  if (roll < d.goldenChance) return { kind: "golden", mask: 0 };
  if (roll < d.goldenChance + d.decoyChance) return { kind: "decoy", mask: 0 };
  const mask =
    rng() < d.secondaryChance ? pick(SECONDARIES, rng) : pick(PRIMARIES, rng);
  if (rng() >= d.wordChance) return { kind: "color", mask };
  const others = PAINTS.map((p) => p.mask).filter((m) => m !== mask);
  return { kind: "color", mask, word: pick(others, rng) };
}

export const WAVE_HINTS: Record<number, string> = {
  1: "Dispara a cada pato con la pintura de su color",
  2: "¡No les dispares a los señuelos grises!",
  3: "Llegan patos de colores mezclados",
  4: "Fíjate en el color del pato, no en la palabra",
};
