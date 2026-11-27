// ============================================================================
//  GAME STATE — flags, quests, the lantern's contents, world changes, saving,
//  and the story clock (time only moves within the window the story allows)
// ============================================================================
const SAVE_KEY: any = 'emberwick.save.v2';
function newGame() : any {
  return {
    v: 2, flags: {}, q: { main: 0 }, track: 'main', spells: {}, flame: 0, flameMax: 8,
    sparks: [], hats: [], glass: [], fires: {}, lamps: {}, thorns: {}, stones: {}, travel: [],
    time: 17.3, pos: null, warmth: { player: 10, brakka: 10, elowen: 10 }, items: {},
    stats: { gloam: 0, faints: 0, play: 0, casts: 0 }, ending: null, seen: {},
  };
}
let G: any = newGame();
const flag: any = (k: any) => !!G.flags[k];
function setFlag(k: any, v: any = true) : any { G.flags[k] = v; }
const q: any = (id: any) => G.q[id] ?? -1;
const HOOK: any = { quest: [], fire: [], spell: [], spark: [] };   // story listeners
function qSet(id: any, stage: any, o: any = {}) : any {
  const prev: any = q(id);
  if (prev === stage) return;
  G.q[id] = stage;
  const Q: any = QUESTS[id];
  if (Q && !o.quiet) {
    const st: any = Q.stages[stage];
    if (prev < 0) UI.toast(Q.side ? 'New errand' : 'New quest', Q.title, 'quest');
    else if (st && st.done) UI.toast(Q.side ? 'Errand complete' : 'Quest complete', Q.title, 'done');
    else UI.toast('Journal updated', st ? st.short || Q.title : Q.title, 'quest');
    if (st?.done && G.track === id) G.track = 'main';
  }
  for (const h of HOOK.quest) h(id, stage, prev);
  UI.updateTracker?.();
  saveGame();
}
function giveSpark(id: any, who: any) : any {
  if (G.sparks.includes(id)) return;
  G.sparks.push(id);
  UI.toast(`Heartspark ${G.sparks.length}/${SPARK_TOTAL}`, `From ${who}, freely given. It glows in your lantern.`, 'spark');
  for (const h of HOOK.spark) h(id);
  saveGame();
}
const SPARK_TOTAL: any = 10;
function learn(spell: any) : any {
  if (G.spells[spell]) return false;
  G.spells[spell] = true;
  for (const h of HOOK.spell) h(spell);
  UI.buildSpellbar?.();
  saveGame();
  return true;
}

// ---- saving -------------------------------------------------------------------------------------------
let _saveT: any = 0;
function saveGame(force?: any) : any {
  // nothing is written while the finale plays out: a reload replays it from the edge of the Long Field
  if (!G.started || (q('main') >= 15 && !G.ending)) return;
  // nor halfway through a scene: a reload picks the story up from just before it, and it plays again
  if (SCENE.active) return;
  if (!force && performance.now() - _saveT < 800) { clearTimeout((saveGame as any)._t); (saveGame as any)._t = setTimeout(() => saveGame(true), 900); return; }
  _saveT = performance.now();
  try {
    if (player && !UG.zone && !CUT.b && !SCENE.active) G.pos = { x: +player.x.toFixed(2), y: +player.y.toFixed(2), z: +player.z.toFixed(2), face: +player.face.toFixed(2) };
    else if (player && !SCENE.active) G.pos = { x: +player.x.toFixed(2), y: +player.y.toFixed(2), z: +player.z.toFixed(2), face: +player.face.toFixed(2) };
    G.time = TIME.h;
    for (const c of PARTY) G.warmth[c.id] = Math.round(c.warmth ?? 10);
    localStorage.setItem(SAVE_KEY, JSON.stringify(G));
  } catch (e: any) { /* private mode or storage full: the game just doesn't remember */ }
}
function readSave() : any {
  try { const s: any = localStorage.getItem(SAVE_KEY); if (!s) return null; const d: any = JSON.parse(s); return d && d.v === 2 ? d : null; } catch (e: any) { return null; }
}
function clearSave() : any { try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(SAVE_KEY + '.field'); } catch (e: any) { } }
// a checkpoint taken as the finale begins, so an ending can be chosen again
function saveFieldCheckpoint() : any { saveGame(true); try { const s: any = localStorage.getItem(SAVE_KEY); if (s) localStorage.setItem(SAVE_KEY + '.field', s); } catch (e: any) { } }
function hasFieldCheckpoint() : any { try { return !!localStorage.getItem(SAVE_KEY + '.field'); } catch (e: any) { return false; } }
function loadFieldCheckpoint() : any {
  try { const s: any = localStorage.getItem(SAVE_KEY + '.field'); if (s) localStorage.setItem(SAVE_KEY, s); } catch (e: any) { }
  G.started = false;   // so nothing overwrites it on the way out
  location.reload();
}

// ---- the story clock -------------------------------------------------------------------------------------
// [from, to] hours for each stretch of the main quest; the clock creeps within it and waits at the end
const CLOCK: any = { rate: 1 / 150, frozen: false };
function clockWindow() : any {
  const m: any = q('main');
  if (G.ending) return [6.4, 7.6];
  if (m < 1) return [17.3, 17.75];
  if (m < 6) return [17.75, 19.0];
  if (m < 12) return [19.6, 21.4];
  if (m < 15) return [21.4, 23.2];
  return [23.62, 23.995];
}
function updateClock(dt: any) : any {
  if (CAM.intro || TIME.paused || CLOCK.frozen || !G.started) return;
  const [a, b]: any = clockWindow();
  let h: any = TIME.h;
  if (h < 5) h += 24;
  if (h < a - 0.01) h = Math.min(a, h + dt * 0.5);   // the story moved on: night falls quickly
  else h = Math.min(b, h + dt * CLOCK.rate);
  TIME.h = h % 24;
}
