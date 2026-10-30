import { PERSONALITIES, choose, type Personality } from "./ai";
import {
  MAX_LOAD,
  PASSES,
  ROUNDS,
  fogOf,
  newBorder,
  runnerOf,
  step,
  worth,
  type Border,
  type Round,
} from "./sim";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let game: Border = newBorder(Date.now() >>> 0);

const foe = $<HTMLSelectElement>("foe");
for (const p of PERSONALITIES) foe.add(new Option(p, p));
const slider = $<HTMLInputElement>("load");
const passName = (p: number) => String.fromCharCode(65 + p);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

for (let p = 0; p < PASSES; p++) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "pass";
  input.value = String(p);
  input.checked = p === 0;
  label.append(input, ` Pass ${passName(p)}`);
  label.dataset.pass = String(p);
  $("passes").append(label);
}

const picked = (): number =>
  Number(
    document.querySelector<HTMLInputElement>("[name=pass]:checked")!.value,
  );

function describe(r: Round): string {
  const you = r.runner === "blue";
  const route = `pass ${passName(r.pass)}`;
  const guard = `pass ${passName(r.guard)}`;
  const crates = plural(r.load, "crate");
  if (r.caught)
    return you
      ? `You ran ${crates} through ${route}. Red guarded ${guard} and seized them for ${worth(r.load)}.`
      : `Red ran ${crates} through ${route}. You guarded ${guard} and seized them for ${worth(r.load)}.`;
  return you
    ? `You ran ${crates} through ${route}. Red guarded ${guard}. You deliver them for ${worth(r.load)}.`
    : `Red ran ${crates} through ${route}. You guarded ${guard}. Red delivers them for ${worth(r.load)}.`;
}

function outcome(): string {
  if (game.winner === "draw") return "Draw.";
  return game.winner === "blue" ? "You win." : "Red wins.";
}

function render(): void {
  const over = game.winner !== null;
  const runner = runnerOf(game);
  const runs = runner === "blue";
  const items = Array.from({ length: ROUNDS }, (_, i) => {
    const li = document.createElement("li");
    const r = game.history[i];
    if (r) {
      const scorer = r.caught
        ? r.runner === "blue"
          ? "red"
          : "blue"
        : r.runner;
      li.className = scorer;
      li.innerHTML = `<strong>+${worth(r.load)}</strong>${r.runner === "blue" ? "you ran" : "red ran"}`;
    } else {
      li.innerHTML = `<strong>?</strong>${(i % 2 === 0) === (game.first === "blue") ? "you run" : "red runs"}`;
    }
    if (!over && i === game.turn) li.setAttribute("aria-current", "step");
    return li;
  });
  $("rounds").replaceChildren(...items);
  for (const side of ["blue", "red"] as const) {
    $(`points-${side}`).textContent = String(game.points[side]);
    $(`stock-${side}`).textContent = String(game.stock[side]);
  }
  const fog = fogOf(game);
  for (const l of Array.from($("passes").children) as HTMLElement[])
    l.classList.toggle("fog", Number(l.dataset.pass) === fog && !over);
  const most = Math.min(MAX_LOAD, game.stock.blue);
  slider.max = String(most);
  slider.value = String(Math.min(Number(slider.value), most));
  $("amount").textContent = slider.value;
  $("load-row").hidden = over || !runs;
  $<HTMLButtonElement>("go").disabled = over;
  $("go").textContent = runs ? "Run" : "Guard";
  $("legend").textContent = runs ? "Run through" : "Guard";
  $("hint").textContent = over
    ? ""
    : `Round ${game.turn + 1} of ${ROUNDS}: you ${runs ? "run" : "guard"}. Fog lies on pass ${passName(fog)}.`;
}

slider.oninput = () => ($("amount").textContent = slider.value);
$("order").onsubmit = (e) => {
  e.preventDefault();
  if (game.winner) return;
  const runs = runnerOf(game) === "blue";
  const red = choose(game, "red", foe.value as Personality);
  const you = { load: Number(slider.value), pass: picked() };
  const [run, watch] = runs ? [you, red] : [red, you];
  step(game, run.load, run.pass, watch.pass);
  render();
  const last = describe(game.history.at(-1)!);
  $("log").textContent = game.winner ? `${last} ${outcome()}` : last;
};
$("again").onclick = () => {
  game = newBorder(Date.now() >>> 0);
  $("log").textContent = "";
  render();
};
render();
