// Serves the built site on localhost the way the Workers serve it: each game
// under /<name>/, the front page at /. It stages the targets first.
//
//   bun run serve                 build every target and serve them
//   bun run serve emberwick ...   build only these targets
import { existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import { INDEX, listTargets, stage } from "./deploy";

const PORT = Number(process.env.PORT ?? 8000);

/** The staged file for a URL path, or a redirect to the path with a slash. */
export function resolve(
  root: string,
  pathname: string,
): { file: string } | { redirect: string } | null {
  const path = normalize(decodeURIComponent(pathname));
  if (path.includes("..")) return null;
  const game = /^\/([^/]+)(\/.*)?$/.exec(path);
  const name = game?.[1];
  const assets =
    name && existsSync(join(root, ".deploy", name, "assets", name))
      ? join(root, ".deploy", name, "assets")
      : join(root, ".deploy", INDEX, "assets");
  let file = join(assets, path);
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith("/")) return { redirect: `${path}/` };
    file = join(file, "index.html");
  }
  return existsSync(file) ? { file } : null;
}

if (import.meta.main) {
  const root = join(import.meta.dir, "..");
  const named = Bun.argv.slice(2);
  for (const target of named.length ? named : listTargets(root))
    await stage(root, target);
  Bun.serve({
    port: PORT,
    fetch(request) {
      const { pathname, search } = new URL(request.url);
      const hit = resolve(root, pathname);
      if (!hit) return new Response("Not found", { status: 404 });
      if ("redirect" in hit)
        return Response.redirect(`${hit.redirect}${search}`, 307);
      return new Response(Bun.file(hit.file));
    },
  });
  console.log(`serving http://localhost:${PORT}/`);
}
