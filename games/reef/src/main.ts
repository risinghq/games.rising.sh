import { PERSONALITIES, choose, viewOf, type Personality } from "./ai";
import { MAX_TURNS, newReef, step, type Dive, type Reef } from "./sim";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let game: Reef = newReef(Date.now() >>> 0);

const foe = $<HTMLSelectElement>("foe");
for (const p of PERSONALITIES) foe.add(new Option(p, p));
const slider = $<HTMLInputElement>("send");

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function describe(d: Dive): string {
  const who = d.taker === "blue" ? "You take" : "Red takes";
  const how = d.coin
    ? `both sent ${d.bids.blue}; the tide gave it`
    : `you sent ${d.bids.blue}, red ${d.bids.red}`;
  return `${who} ${plural(d.gain, "pearl")} (${how}).`;
}

function outcome(): string {
  if (game.winner === "draw") return "Draw.";
  return game.winner === "blue" ? "You win." : "Red wins.";
}

function render(): void {
  const v = viewOf(game, "blue");
  const over = game.winner !== null;
  const items = Array.from({ length: MAX_TURNS }, (_, i) => {
    const li = document.createElement("li");
    const dive = game.dives[i];
    if (dive) {
      li.className = dive.taker;
      li.innerHTML = `<strong>+${dive.gain}</strong>${dive.bids.blue}:${dive.bids.red}`;
    } else if (i === game.turn || i === game.turn + 1) {
      const value = i === game.turn ? v.value : v.next;
      li.innerHTML = `<strong>${value}</strong>${i === game.turn ? "now" : "next"}`;
    } else {
      li.innerHTML = "<strong>?</strong>hidden";
    }
    if (!over && i === game.turn) li.setAttribute("aria-current", "step");
    return li;
  });
  $("dives").replaceChildren(...items);
  for (const [id, side] of [
    ["blue", "blue"],
    ["red", "red"],
  ] as const) {
    $(`pearls-${id}`).textContent = String(game.pearls[side]);
    $(`divers-${id}`).textContent = String(game.divers[side]);
  }
  slider.max = String(v.mine.divers);
  slider.value = String(Math.min(Number(slider.value), v.mine.divers));
  $("sent").textContent = slider.value;
  slider.disabled = $<HTMLButtonElement>("dive").disabled = over;
  $("hint").textContent = over
    ? ""
    : `Dive ${game.turn + 1} of ${MAX_TURNS}: ${plural(v.value, "pearl")}${
        v.myStreak ? ", plus 1 if you take it again" : ""
      }${v.theirStreak ? ". Red is on a streak: taking it stops that" : ""}.`;
}

slider.oninput = () => ($("sent").textContent = slider.value);
$("bid").onsubmit = (e) => {
  e.preventDefault();
  if (game.winner) return;
  step(
    game,
    Number(slider.value),
    choose(game, "red", foe.value as Personality),
  );
  render();
  const last = describe(game.dives.at(-1)!);
  $("log").textContent = game.winner ? `${last} ${outcome()}` : last;
};
$("again").onclick = () => {
  game = newReef(Date.now() >>> 0);
  $("log").textContent = "";
  render();
};
render();
