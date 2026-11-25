// A whole run played without Phaser by a scripted shooter. It follows the play
// scene's rules: the same spawns, speeds, scoring, lives and sprite pool. The
// batch and the gate judge the game's pacing with it.
import { Fnv } from "@rising/sim-kit";
import {
  basePoints,
  difficulty,
  MUD,
  multiplier,
  PAINTS,
  resolveShot,
  START_LIVES,
  type DuckSpec,
} from "./rules";
import {
  FIRST_SPAWN_DELAY_MS,
  FLEE_RISE,
  LANES,
  MAX_DUCKS,
  nextSpawn,
  OFFSCREEN,
  stream,
  SURFACE_OFFSET,
  WIDTH,
} from "./run";

// The play scene steps at the display rate; 60 Hz is the common case.
const DT = 1 / 60;
// A knocked-down duck holds its sprite this long.
const DOWN_SECONDS = 0.18;
// A run still going after this long counts as capped.
export const MAX_SECONDS = 900;

export interface Shooter {
  name: string;
  // Time from a duck appearing, or changing colour, to the shooter aiming at it.
  reactMs: number;
  // Fastest the shooter fires again.
  gapMs: number;
  // Chance a shot at a colour duck uses a wrong paint.
  wrongRate: number;
  // Chance the shooter reads the word on a sign instead of the duck's colour.
  wordRate: number;
  // Chance the shooter fires at a given decoy.
  decoyRate: number;
}

export const SHOOTERS: readonly Shooter[] = [
  {
    name: "novice",
    reactMs: 650,
    gapMs: 500,
    wrongRate: 0.2,
    wordRate: 0.5,
    decoyRate: 0.3,
  },
  {
    name: "regular",
    reactMs: 450,
    gapMs: 330,
    wrongRate: 0.08,
    wordRate: 0.25,
    decoyRate: 0.1,
  },
  {
    name: "sharp",
    reactMs: 300,
    gapMs: 220,
    wrongRate: 0.03,
    wordRate: 0.08,
    decoyRate: 0.03,
  },
];

interface SimDuck {
  spec: DuckSpec;
  lane: number;
  x: number;
  speed: number;
  state: "swim" | "down" | "flee";
  // Seconds left in "down", or height above the screen top in "flee".
  timer: number;
  seenAt: number;
  tempted: boolean;
}

export interface RunResult {
  shooter: string;
  seed: number;
  score: number;
  seconds: number;
  wave: number;
  shots: number;
  hits: number;
  escapes: number;
  decoysShot: number;
  capped: boolean;
  hash: string;
}

export function playRun(shooter: Shooter, seed: number): RunResult {
  const spawnRng = stream(seed, "spawn");
  const aim = stream(seed, `shooter:${shooter.name}`);
  const ducks: SimDuck[] = [];
  const fnv = new Fnv();
  let lives = START_LIVES;
  let score = 0;
  let streak = 0;
  let elapsed = 0;
  let spawnTimer = -FIRST_SPAWN_DELAY_MS;
  let nextShot = 0;
  let shots = 0;
  let hits = 0;
  let escapes = 0;
  let decoysShot = 0;

  const loseLife = () => {
    lives--;
    streak = 0;
  };

  while (lives > 0 && elapsed < MAX_SECONDS) {
    elapsed += DT;
    const d = difficulty(elapsed);

    spawnTimer += DT * 1000;
    if (spawnTimer >= d.spawnMs) {
      spawnTimer = 0;
      const s = nextSpawn(d, spawnRng);
      if (ducks.length < MAX_DUCKS) {
        const lane = LANES[s.lane]!;
        ducks.push({
          spec: s.spec,
          lane: s.lane,
          x: lane.dir > 0 ? -OFFSCREEN : WIDTH + OFFSCREEN,
          speed: s.speed,
          state: "swim",
          timer: 0,
          seenAt: elapsed,
          tempted: aim() < shooter.decoyRate,
        });
        fnv.num(elapsed);
        fnv.num(s.spec.mask);
        fnv.str(s.spec.kind);
      }
    }

    for (let i = ducks.length - 1; i >= 0; i--) {
      const duck = ducks[i]!;
      const lane = LANES[duck.lane]!;
      if (duck.state === "down") {
        duck.timer -= DT;
        if (duck.timer <= 0) ducks.splice(i, 1);
      } else if (duck.state === "flee") {
        duck.timer -= FLEE_RISE * DT;
        if (duck.timer <= 0) ducks.splice(i, 1);
      } else {
        duck.x += lane.dir * duck.speed * DT;
        const gone =
          lane.dir > 0 ? duck.x > WIDTH + OFFSCREEN : duck.x < -OFFSCREEN;
        if (!gone) continue;
        ducks.splice(i, 1);
        if (duck.spec.kind !== "color") continue;
        escapes++;
        loseLife();
        if (lives <= 0) break;
      }
    }
    if (lives <= 0 || elapsed < nextShot) continue;

    const target = pickTarget(ducks, elapsed, shooter);
    if (!target) continue;
    nextShot = elapsed + shooter.gapMs / 1000;
    shots++;
    const outcome = resolveShot(
      target.spec,
      choosePaint(target.spec, shooter, aim),
    );
    switch (outcome.kind) {
      case "hit":
      case "golden":
        hits++;
        streak++;
        score += basePoints(target.spec) * multiplier(streak);
        knockDown(target);
        break;
      case "decoy":
        decoysShot++;
        knockDown(target);
        loseLife();
        break;
      case "mix":
        streak = 0;
        target.spec = { kind: "color", mask: outcome.mask };
        target.seenAt = elapsed;
        break;
      case "ruin":
        streak = 0;
        target.spec = { kind: "color", mask: MUD };
        target.state = "flee";
        target.timer = LANES[target.lane]!.top + SURFACE_OFFSET + 120;
        break;
      case "waste":
        streak = 0;
        break;
    }
  }

  fnv.num(score);
  fnv.num(elapsed);
  return {
    shooter: shooter.name,
    seed,
    score,
    seconds: elapsed,
    wave: difficulty(elapsed).wave,
    shots,
    hits,
    escapes,
    decoysShot,
    capped: lives > 0,
    hash: fnv.hex(),
  };
}

function knockDown(duck: SimDuck) {
  duck.state = "down";
  duck.timer = DOWN_SECONDS;
}

// The swimming duck nearest its exit that the shooter has had time to see.
// Decoys count only when they tempt this shooter.
function pickTarget(
  ducks: SimDuck[],
  now: number,
  shooter: Shooter,
): SimDuck | undefined {
  let best: SimDuck | undefined;
  let bestLeft = Infinity;
  for (const duck of ducks) {
    if (duck.state !== "swim") continue;
    if (now - duck.seenAt < shooter.reactMs / 1000) continue;
    if (duck.spec.kind === "decoy" && !duck.tempted) continue;
    const left =
      LANES[duck.lane]!.dir > 0
        ? WIDTH + OFFSCREEN - duck.x
        : duck.x + OFFSCREEN;
    if (left < bestLeft) {
      best = duck;
      bestLeft = left;
    }
  }
  return best;
}

function choosePaint(
  spec: DuckSpec,
  shooter: Shooter,
  aim: () => number,
): number {
  if (spec.kind !== "color") return PAINTS[0]!.mask;
  if (spec.word !== undefined && aim() < shooter.wordRate) return spec.word;
  if (aim() >= shooter.wrongRate) return spec.mask;
  const others = PAINTS.filter((p) => p.mask !== spec.mask);
  return others[Math.floor(aim() * others.length)]!.mask;
}
