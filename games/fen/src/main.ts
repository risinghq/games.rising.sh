import { PERSONALITIES, choose, type Personality } from "./ai";
import {
  FLAT_TURN,
  MAX_TURNS,
  RANGE,
  SIDES,
  TILES,
  canShoot,
  newFen,
  step,
  type Fen,
  type Move,
  type Side,
  type Turn,
} from "./sim";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;
let game: Fen = newFen(newSeed());
/** The tile you aim at this turn; null holds fire. */
let target: number | null = null;

const foe = $<HTMLSelectElement>("foe");
for (const p of PERSONALITIES) foe.add(new Option(p, p));
const tiles = Array.from({ length: TILES }, (_, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.onclick = () => {
    target = target === i ? null : i;
    render();
  };
  return b;
});
$("board").append(...tiles);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const name = (s: Side) => (s === "blue" ? "You" : "Red");

const say = (s: Side, verb: string) => (s === "blue" ? verb : `${verb}s`);

function describe(turn: Turn): string {
  const parts = SIDES.map((s) => {
    const stays = turn.to[s] === turn.from[s];
    const move = stays
      ? `${say(s, "stay")} on tile ${turn.to[s]}`
      : `${say(s, "move")} to tile ${turn.to[s]}`;
    const fire = turn.fired[s]
      ? `${say(s, "fire")} at tile ${turn.actions[s].shot}`
      : `${say(s, "hold")} fire`;
    return `${name(s)} ${move} and ${fire}.`;
  });
  const hits = SIDES.filter((s) => turn.hit[s]).map(
    (s) => `${name(s)} ${s === "blue" ? "are" : "is"} hit.`,
  );
  return [...parts, hits.length ? hits.join(" ") : "No hits."].join(" ");
}

function outcome(): string {
  if (game.winner === "draw") return "Draw.";
  return game.winner === "blue" ? "You win." : "Red wins.";
}

function render(): void {
  const over = game.winner !== null;
  if (target !== null && !canShoot(game, "blue", target)) target = null;
  const standing = game.turn < FLAT_TURN;
  tiles.forEach((b, i) => {
    const here = SIDES.filter((s) => game.pos[s] === i);
    const reeds = standing && game.reeds.includes(i);
    b.className = reeds ? "reeds" : "";
    b.disabled = over || !canShoot(game, "blue", i);
    b.setAttribute("aria-pressed", String(target === i));
    const who = here
      .map((s) => `<span class="${s}">${name(s)}</span>`)
      .join(" ");
    b.innerHTML = `<small>${i}</small><strong>${who || "&middot;"}</strong>${reeds ? "reeds" : ""}`;
    b.setAttribute(
      "aria-label",
      `Tile ${i}${reeds ? ", reeds" : ""}${here.length ? `, ${here.map(name).join(" and ")} here` : ""}${b.disabled ? "" : target === i ? ", aimed" : ", aim here"}`,
    );
  });
  for (const s of SIDES) {
    $(`hp-${s}`).textContent = String(game.hp[s]);
    $(`ammo-${s}`).textContent = String(game.ammo[s]);
  }
  $<HTMLButtonElement>("go").disabled = $<HTMLButtonElement>("hold").disabled =
    over;
  $("hint").textContent = over
    ? outcome()
    : `Turn ${game.turn + 1} of ${MAX_TURNS}. You shoot from tile ${game.pos.blue}, up to ${plural(RANGE, "tile")} away. ${
        target === null ? "Holding fire reloads." : `Aiming at tile ${target}.`
      }${standing ? ` Reeds lie flat from turn ${FLAT_TURN + 1}.` : " The reeds lie flat."}`;
}

$("hold").onclick = () => {
  target = null;
  render();
};
$("turn").onsubmit = (e) => {
  e.preventDefault();
  if (game.winner) return;
  const form = new FormData(e.target as HTMLFormElement);
  const move = Number(form.get("move")) as Move;
  step(
    game,
    { move, shot: target },
    choose(game, "red", foe.value as Personality),
  );
  target = null;
  render();
  $("log").textContent = describe(game.last!);
};
$("again").onclick = () => {
  game = newFen(newSeed());
  target = null;
  $("log").textContent = "";
  render();
};
render();
