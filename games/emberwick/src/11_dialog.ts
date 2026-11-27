// ============================================================================
//  CONVERSATIONS & CUTSCENES — conversations are async functions:
//    await say(who, 'line');  const i = await choose(['a', 'b']);
//  Waits run on game time (so the headless tests can fast-forward them).
// ============================================================================
const DLG: any = { active: false, c: null, res: null, choices: null, sel: 0, auto: false, autoQ: [], log: [] };
const WAITS: any = [];
function wait(sec: any) : any { return new Promise((r: any) => WAITS.push({ t: sec, r })); }
function updateWaits(dt: any) : any {
  for (let i: any = WAITS.length - 1; i >= 0; i--) { const w: any = WAITS[i]; w.t -= dt; if (w.t <= 0) { WAITS.splice(i, 1); w.r(); } }
  if (DLG.auto && UI.typing()) UI.finishTyping();
  if (DLG.auto && DLG.res && !UI.typing()) { DLG.autoT = (DLG.autoT || 0) + dt; if (DLG.autoT > 0.05) { DLG.autoT = 0; dlgAdvance(); } }
  if (DLG.auto && DLG.choices) pickChoice(DLG.autoQ.length ? DLG.autoQ.shift() : 0);
}
const speakerOf: any = (who: any) => who === 'you' ? { name: 'You', title: '', cls: 'you' } : who === 'nar' ? { name: '', title: '', cls: 'nar' }
  : typeof who === 'string' ? { name: who, title: '', cls: '' } : { name: who.name, title: who.title || '', cls: PARTY.includes(who) ? 'party' : who.ghost ? 'ghost' : '' };
function say(who: any, text: any, o: any = {}) : any {
  return new Promise((res: any) => {
    DLG.res = res;
    DLG.log.push(`${speakerOf(who).name || '~'}: ${text}`);
    if (DLG.log.length > 400) DLG.log.shift();
    UI.dlgLine(who, text, o);
    if (SCENE.active && CAM.focus && who && who.root) camKeep(who);
    if (who && who.root && !PARTY.includes(who)) { who.talking = true; who.talkT = 1.6; }
    AUDIO.blip?.(who === 'you' ? 0 : who && who.id ? (who.id.charCodeAt(0) % 5) + 1 : 2);
  });
}
function choose(opts: any) : any {
  return new Promise((res: any) => {
    const list: any = opts.map((o: any) => typeof o === 'string' ? { t: o } : o).filter((o: any) => o.if === undefined || o.if);
    const map: any = []; opts.forEach((o: any, i: any) => { if (typeof o === 'string' || o.if === undefined || o.if) map.push(i); });
    DLG.choices = { list, res: (i: any) => res(map[i]) }; DLG.sel = 0;
    UI.dlgChoices(list);
  });
}
function dlgAdvance() : any {
  if (!DLG.active) return;
  if (DLG.choices) { pickChoice(DLG.sel); return; }
  if (UI.typing()) { UI.finishTyping(); return; }
  const r: any = DLG.res; DLG.res = null;
  if (r) r();
}
function pickChoice(i: any) : any {
  const c: any = DLG.choices;
  if (!c || i < 0 || i >= c.list.length) return;
  DLG.choices = null; UI.dlgChoices(null);
  DLG.log.push(`> ${c.list[i].t}`);
  AUDIO.click?.();
  c.res(i);
}
async function converse(c: any, fn: any): Promise<any> {
  if (DLG.active || !fn) return false;
  DLG.active = true; DLG.c = c;
  INPUT.target = null; INPUT.goal = null; PV.vx = PV.vz = 0;
  if (c && c.root) c.talking = true;
  CAM.talk = c && c.root ? c : null;
  try { await fn(c); }
  catch (e: any) { console.error('conversation', e); }
  finally {
    DLG.active = false;
    for (const ch of CHARS) if (ch.talking && !ch.fixedTalk) ch.talking = false;
    DLG.c = null; CAM.talk = null; DLG.res = null; DLG.choices = null;
    UI.hideDialog();
  }
  return true;
}
// one line at a time from an NPC's list, for folk with nothing more pressing to say
async function chatter(c: any): Promise<any> {
  const lines: any = typeof c.lines === 'function' ? c.lines() : c.lines;
  if (!lines || !lines.length) return;
  await say(c, lines[(c.lineIdx = (c.lineIdx || 0)) % lines.length]);
  c.lineIdx++;
}
// the old engine entry points, now routed through the conversation system
function startTalk(c: any) : any {
  if (DLG.active || SCENE.active) return;
  if (!c) return;
  const fn: any = (TALK[c.id] && TALK[c.id](c)) || c.talkFn || chatter;   // talkFn: folk from custom areas
  converse(c, fn);
}
function advanceTalk() : any { dlgAdvance(); }
function endTalk() : any { /* conversations end themselves */ }

// ---- cutscenes -----------------------------------------------------------------------------------------
const SCENE: any = { active: false, name: '', movers: [], skip: false };
async function cutscene(name: any, fn: any, o: any = {}) : Promise<any> {
  if (SCENE.active) return false;
  SCENE.active = true; SCENE.name = name;
  const wasDlg: any = DLG.active; DLG.active = true;
  INPUT.target = null; INPUT.goal = null; PV.vx = PV.vz = 0;
  if (!o.noBars) UI.letterbox(true);
  try { await fn(); }
  catch (e: any) { console.error('cutscene', name, e); }
  finally {
    SCENE.active = false; SCENE.name = ''; CAM.focus = null; UI.letterbox(false);
    for (const m of SCENE.movers) m.done(); SCENE.movers.length = 0;
    DLG.active = wasDlg; DLG.res = null; DLG.choices = null; UI.hideDialog();
    if (!wasDlg) { CAM.talk = null; for (const ch of CHARS) if (ch.talking && !ch.fixedTalk) ch.talking = false; }
  }
  return true;
}
// walk a character to a point (game time); resolves on arrival
function walkTo(c: any, x: any, z: any, o: any = {}) : any {
  return new Promise((res: any) => {
    SCENE.movers = SCENE.movers.filter((m: any) => m.c !== c);
    const m: any = { c, x, z, sp: o.speed ?? 1.6, face: o.face, t: 0, lim: Math.hypot(x - c.x, z - c.z) / (o.speed ?? 1.6) * 1.8 + 1.5, done: () => { if (!m.fin) { m.fin = true; res(); } } };
    SCENE.movers.push(m);
  });
}
function updateMovers(dt: any) : any {
  for (let i: any = SCENE.movers.length - 1; i >= 0; i--) {
    const m: any = SCENE.movers[i], c: any = m.c, dx: any = m.x - c.x, dz: any = m.z - c.z, d: any = Math.hypot(dx, dz);
    m.t += dt;
    if (m.t > m.lim && d >= 0.12) { c.x = m.x; c.z = m.z; c.y = groundAt(c.x, c.z, c.y + 1).h; c.smoothY = c.y; }
    if (d < 0.12 || m.t > m.lim) {
      c.speed = dampf(c.speed, 0, 10, dt);
      if (m.face !== undefined) c.face = dampA(c.face, m.face, 6, dt);
      SCENE.movers.splice(i, 1); m.done(); continue;
    }
    const st: any = Math.min(d, m.sp * dt);
    if (c === player || PARTY.includes(c)) moveChar(c, dx / d * st, dz / d * st, dt);
    else { c.x += dx / d * st; c.z += dz / d * st; c.y = groundAt(c.x, c.z, c.y + 0.4).h; }
    c.speed = dampf(c.speed, m.sp, 8, dt);
    c.face = dampA(c.face, Math.atan2(dx, dz), 8, dt);
    if (c === player) trailPush(player.x, player.y, player.z);
  }
}
function isMoving(c: any) : any { return SCENE.movers.some((m: any) => m.c === c); }
function camFocus(x: any, y: any, z: any, dist: any) : any { CAM.focus = { x, y, z, dist, pts: [{ x, y, z, raw: true }] }; }
// frame several things at once: centre on them and stand back just far enough that they all fit above the dialogue box
function camFrame(list: any, o: any = {}) : any {
  const P: any = list.filter(Boolean).map((p: any) => ({ x: p.x, z: p.z, raw: true, y: p.raw ? p.y : p.root ? (p.smoothY ?? p.y) + 1.2 : (p.y ?? terrainH(p.x, p.z)) + 0.4 }));
  if (!P.length) return;
  if (o.yaw !== undefined) CAM.yawT = o.yaw;
  const yaw: any = CAM.yawT, pt: any = CAM.pitch, rx: any = Math.cos(yaw), rz: any = -Math.sin(yaw), fx: any = Math.sin(yaw), fz: any = Math.cos(yaw);
  let cx: any = 0, cy: any = 0, cz: any = 0; for (const q of P) { cx += q.x; cy += q.y; cz += q.z; } cx /= P.length; cy /= P.length; cz /= P.length;
  let w: any = 0, h: any = 0;   // how far they spread across the screen, and up it
  for (const q of P) { const dx: any = q.x - cx, dz: any = q.z - cz; w = Math.max(w, Math.abs(dx * rx + dz * rz)); h = Math.max(h, Math.abs((dx * fx + dz * fz) * Math.sin(pt) - (q.y - cy) * Math.cos(pt))); }
  const tv: any = Math.tan(camera.fov * Math.PI / 360), th: any = tv * camera.aspect;
  const dist: any = clamp(Math.max(w / (th * 0.7), h / (tv * 0.5)) + 4, o.min ?? 11, o.max ?? 34);
  CAM.focus = { x: cx, y: cy, z: cz, dist, rate: o.rate, pts: P };
}
// in a cutscene, whoever speaks from outside the shot is brought into it, along with what the shot was already on
const _ckv: any = new V3();
function camKeep(c: any) : any {
  const F: any = CAM.focus; if (!F || F.lock || !c || !c.root || !c.root.visible) return;
  _ckv.set(c.x, (c.smoothY ?? c.y) + 1.6, c.z).project(camera);
  const inShot: any = (p: any) => p.z < 1 && Math.abs(p.x) < 0.82 && p.y > -0.2 && p.y < 0.84;   // the dialogue box covers the bottom of the screen
  if (inShot(_ckv)) { _ckv.set(F.x, F.y, F.z).project(camera); if (inShot(_ckv)) return; }   // (the camera may still be on its way)
  if (Math.hypot(c.x - F.x, c.z - F.z) > 32) return;   // too far away to share a shot
  camFrame([...(F.pts || [{ x: F.x, y: F.y, z: F.z }]), c], { min: F.dist || 11, max: Math.max(F.dist || 0, 30) });
}
function camRelease() : any { CAM.focus = null; }
async function fadeOut(sec: any = 0.6) : Promise<any> { UI.fade(1, sec); await wait(sec); }
async function fadeIn(sec: any = 0.6) : Promise<any> { UI.fade(0, sec); await wait(sec); }
