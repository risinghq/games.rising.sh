import { choose } from "./ai";
import {
  EFFORTS,
  MAX_STAMINA,
  MAX_TURNS,
  ROPE_END,
  newTug,
  step,
  type Tug,
} from "./sim";

const $ = (id: string) => document.getElementById(id)!;
let game: Tug = newTug(Date.now() >>> 0);

function render(): void {
  // blue (you) pulls toward the right end
  $("knot").style.left = `${50 + (game.rope / ROPE_END) * 50}%`;
  const over = game.winner;
  $("status").textContent = over
    ? over === "draw"
      ? "Draw."
      : over === "blue"
        ? "You win."
        : "Red wins."
    : `Turn ${game.turn + 1} of ${MAX_TURNS}. Your stamina ${game.stamina.blue} of ${MAX_STAMINA}; red's ${game.stamina.red}.`;
  for (const b of Array.from($("buttons").querySelectorAll("button")))
    b.disabled = over !== null;
}

for (const effort of EFFORTS) {
  const b = document.createElement("button");
  b.textContent = `Pull ${effort}`;
  b.onclick = () => {
    step(game, effort, choose(game, "red", "saver"));
    render();
  };
  $("buttons").append(b);
}
$("again").onclick = () => {
  game = newTug(Date.now() >>> 0);
  render();
};
render();
