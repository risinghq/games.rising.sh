/**
 * World hashes: battle records pin one every 100 ticks (AGENT-BATTLES.md),
 * and sound duels fold one into a trail every tick to catch two phones
 * drifting apart (SOUND-DUEL.md). Never change what worldHash covers: saved
 * records pin its values.
 */
import { Fnv } from "@rising/sim-kit";
import type { World } from "./types";
import { sidesOf } from "./sides";

/** A hash of everything that matters in the world: any drift shows up within 100 ticks. */
export function worldHash(w: World): string {
  const h = new Fnv();
  h.num(w.tick);
  h.num(w.nextId);
  // (the sides playing: blue and red in every duel and every saved record)
  for (const f of sidesOf(w)) {
    h.num(w.factions[f].scrap);
    h.num(w.powers.meter[f]);
    h.num(w.factions[f].pending?.remaining ?? -1);
  }
  for (const id of [...w.units.keys()].sort((a, b) => a - b)) {
    const u = w.units.get(id)!;
    h.num(id);
    h.str(u.kind);
    h.num(u.x);
    h.num(u.y);
    h.num(u.hp);
    h.str(u.order.type);
    h.num(u.cargo);
  }
  for (const id of [...w.buildings.keys()].sort((a, b) => a - b)) {
    const b = w.buildings.get(id)!;
    h.num(id);
    h.num(b.hp);
    h.num(b.queue.length);
    h.num(b.queue[0]?.remaining ?? -1);
  }
  h.num(w.projectiles.length);
  h.num(w.wrecks.length);
  for (const l of w.objectives.uplinks) {
    h.num(l.progress);
    if (l.bar !== undefined) h.str(l.bar ?? "-"); // (a free-for-all's: whose bar it is)
  }
  if (w.out) for (const o of w.out) h.str(o.faction);
  h.str(w.winner ?? "-");
  return h.hex();
}
