import { PERSONALITIES, choose, type Personality } from "./ai";
import {
  ARMY,
  EDGE,
  FORDS,
  MAX_TURNS,
  ROUT,
  held,
  newFord,
  step,
  type Ford,
  type Turn,
} from "./sim";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;
let game: Ford = newFord(newSeed());

const foe = $<HTMLSelectElement>("foe");
for (const p of PERSONALITIES) foe.add(new Option(p, p));

const fords = Array.from({ length: FORDS }, (_, i) => {
  const box = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = `Ford ${i + 1}`;
  const track = document.createElement("div");
  track.className = "track";
  track.setAttribute("aria-hidden", "true");
  const cells = Array.from({ length: 2 * EDGE + 1 }, (_, k) => {
    const c = document.createElement("span");
    if (k === 0) c.classList.add("bank-red");
    if (k === 2 * EDGE) c.classList.add("bank-blue");
    track.append(c);
    return c;
  });
  const state = document.createElement("div");
  state.className = "state";
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = String(ARMY);
  input.value = "0";
  input.name = `ford-${i}`;
  input.oninput = renderCount;
  label.append("Troops ", input);
  box.append(legend, track, state, label);
  return { box, cells, state, input };
});
$("fords").append(...fords.map((f) => f.box));

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const sending = () =>
  fords.map((f) => Math.max(0, Math.floor(Number(f.input.value) || 0)));

function describeLine(line: number): string {
  if (line === EDGE) return "On your bank";
  if (line === -EDGE) return "On red's bank";
  if (line === 0) return "Even";
  return `${plural(Math.abs(line), "step")} toward ${line > 0 ? "you" : "red"}`;
}

function describe(turn: Turn): string {
  const parts = turn.clashes.map((c, i) => {
    const result = c.pushed
      ? `${c.pushed === "blue" ? "you push" : "red pushes"} ${c.steps === 2 ? "two steps (a rout)" : "one step"}`
      : "a tie";
    return `Ford ${i + 1}: you sent ${c.sent.blue}, red sent ${c.sent.red}, ${result}.`;
  });
  return parts.join(" ");
}

function outcome(): string {
  if (game.winner === "draw") return "Draw.";
  return game.winner === "blue" ? "You win." : "Red wins.";
}

function renderCount(): void {
  const total = sending().reduce((a, b) => a + b, 0);
  $("count").textContent = `Sending ${total} of ${plural(ARMY, "troop")}. ${
    total > ARMY
      ? "Too many."
      : ARMY - total
        ? `${ARMY - total} stay home.`
        : ""
  }`;
  $<HTMLButtonElement>("go").disabled = game.winner !== null || total > ARMY;
}

function render(): void {
  fords.forEach((f, i) => {
    const line = game.line[i]!;
    f.cells.forEach((c, k) => c.classList.toggle("line", k === line + EDGE));
    f.state.textContent = describeLine(line);
    f.input.disabled = game.winner !== null;
  });
  $("hint").textContent = game.winner
    ? outcome()
    : `Turn ${game.turn + 1} of ${MAX_TURNS}. You hold ${held(game, "blue")} of ${FORDS} fords at your bank, red ${held(game, "red")}. A margin of ${ROUT} is a rout.`;
  renderCount();
}

$("turn").onsubmit = (e) => {
  e.preventDefault();
  if (game.winner) return;
  step(game, sending(), choose(game, "red", foe.value as Personality));
  for (const f of fords) f.input.value = "0";
  render();
  $("log").textContent = describe(game.history.at(-1)!);
};
$("again").onclick = () => {
  game = newFord(newSeed());
  for (const f of fords) f.input.value = "0";
  $("log").textContent = "";
  render();
};
render();
