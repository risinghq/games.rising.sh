import { expect, test } from "bun:test";
import { affectedTargets, workerConfig } from "./deploy";

const targets = ["chroma", "emberwick", "index"];

test("a game change deploys that game", () => {
  expect(affectedTargets(["games/chroma/src/main.ts"], targets)).toEqual([
    "chroma",
  ]);
});

test("a game.json change also deploys the front page", () => {
  expect(affectedTargets(["games/emberwick/game.json"], targets)).toEqual([
    "emberwick",
    "index",
  ]);
});

test("a shared change deploys everything", () => {
  expect(affectedTargets(["README.md", "bun.lock"], targets)).toEqual(targets);
  expect(affectedTargets(["packages/sim-kit/src/rng.ts"], targets)).toEqual(
    targets,
  );
});

test("docs and other workflows deploy nothing", () => {
  expect(
    affectedTargets(["README.md", ".github/workflows/pr.yml"], targets),
  ).toEqual([]);
});

test("a game serves under its own path; the front page takes the rest", () => {
  expect(workerConfig("chroma").routes.map((r) => r.pattern)).toEqual([
    "games.rising.sh/chroma",
    "games.rising.sh/chroma/*",
  ]);
  expect(workerConfig("index").routes.map((r) => r.pattern)).toEqual([
    "games.rising.sh/*",
  ]);
});
