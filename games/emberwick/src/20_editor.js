// ============================================================================
//  THE AREA EDITOR — inside the game. Pick a thing from the palette and click
//  the ground to place it; drag to move; R to turn; Delete to remove. The text
//  beside it is the same area, written out: edit either and the other follows.
//  Everything is kept in this browser (localStorage), with export and import.
// ============================================================================
const EDIT = {
  on: false, fromTitle: false, area: null, sel: -1, hover: null, tool: null, ghost: null, drag: null,
  cam: { tx: 0, ty: 0, tz: 0, yaw: PI / 4, yawT: PI / 4, pitch: 0.95, pitchT: 0.95, dist: 34, distT: 34 },
  keys: new Set(), touches: new Map(), snap: 0.5, hist: new Map(), mx: -1, my: -1, mT: 0, pickT: 0, ver: -1, ov: null, mats: null, ui: null,
  textT: null, savedTime: 17.3, typing: false, view: 'angled', bound: false,
};
const ED_NAMES = ['Maud', 'Edwin', 'Rosalind', 'Aldous', 'Wynn', 'Hester', 'Bram', 'Tilda', 'Osric', 'Mabel', 'Cuthbert', 'Agatha', 'Godfrey', 'Elsie', 'Rufus', 'Ivy', 'Barnaby', 'Petra', 'Gideon', 'Nettle', 'Hob', 'Winifred', 'Jory', 'Alys'];
const ED_ICONS = {
  house: '<path d="M3 10 10 4l7 6M5 9v7h10V9"/><path d="M8.5 16v-4h3v4"/>', stall: '<path d="M3 8h14l-1.5-4h-11zM4.5 8v8M15.5 8v8M4.5 12h11"/>', well: '<path d="M4 11h12v5H4zM5 11V5h10v6M3 5h14"/>',
  tent: '<path d="M2 16 10 4l8 12zM10 4v12"/>', prop: '<path d="M6 4h8c1 3 1 9 0 12H6c-1-3-1-9 0-12zM5.5 8h9M5.5 12h9"/>', sign: '<path d="M10 17V9M4 4h12v5H4z"/>',
  flag: '<path d="M5 17V3M5 4h10l-2 3 2 3H5"/>', pumpkin: '<path d="M10 6c-4 0-6 2.5-6 5.5S6 17 10 17s6-2.5 6-5.5S14 6 10 6zM10 6V3.5M10 6v11"/>',
  tree: '<circle cx="10" cy="8" r="5"/><path d="M10 13v5"/>', bush: '<path d="M3 15c0-3 2-5 4-5 0-2 2-4 4-3 2-1 5 1 5 4 1 1 1 3 1 4z"/>', rock: '<path d="M3 15l2-6 4-3 5 2 3 7z"/>',
  reeds: '<path d="M6 17C6 11 5 7 4 4M10 17V3M14 17c0-6 1-10 2-13"/>', shroom: '<path d="M4 10a6 5 0 0 1 12 0zM8.5 10v6h3v-6"/>', flower: '<path d="M10 17v-7"/><circle cx="10" cy="7" r="3"/><circle cx="10" cy="7" r=".8"/>',
  grove: '<circle cx="7" cy="8" r="4"/><circle cx="14" cy="9" r="3.5"/><path d="M7 12v5M14 12.5V17"/>', fire: '<path d="M10 17c-3 0-5-2-5-4.5 0-3 3-4 3-7 2 1 3 3 3 4.5 1-1 1.5-2 1.5-3 2 1.5 2.5 3.5 2.5 5.5 0 2.5-2 4.5-5 4.5z"/>',
  wayfire: '<path d="M7 17h6M8 17V9h4v8M6.5 9h7M10 7c-1 0-1.5-.8-1.5-1.6 0-1 1.5-1.5 1.5-3 1 .6 1.5 1.6 1.5 2.6S11 7 10 7z"/>', lamp: '<path d="M8 17h4M10 17V5M10 5h4v3M12.5 8h3v3h-3z"/>',
  torch: '<path d="M10 17V9M8 9h4l-1-2H9zM10 7c-1 0-1.6-.8-1.6-1.7C8.4 4 10 3.5 10 2c1 .6 1.6 1.7 1.6 2.8S11 7 10 7z"/>', candle: '<path d="M6 17v-6h3v6M11 17V9h3v8M7.5 11V9.5M12.5 9V7.5"/>',
  light: '<circle cx="10" cy="10" r="3"/><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.3 4.3l2 2M13.7 13.7l2 2M4.3 15.7l2-2M13.7 6.3l2-2"/>',
  lanterns: '<path d="M3 17V5M17 17V5M3 6q7 5 14 0"/><circle cx="7" cy="8.6" r="1.3"/><circle cx="10" cy="9.3" r="1.3"/><circle cx="13" cy="8.6" r="1.3"/>',
  person: '<circle cx="10" cy="5.5" r="2.5"/><path d="M5 17c0-4 2-7 5-7s5 3 5 7"/>', chicken: '<path d="M5 9c0 4 2 7 6 7s5-3 4-6l-3-1V5a2 2 0 0 0-4 0v3z"/><path d="M8 6.5H6"/>',
  sheep: '<path d="M4 13c-1-3 1-6 4-6 1-1 4-1 5 0 3 0 4 3 3 6zM6 13v3M14 13v3"/>', duck: '<path d="M3 13c0 3 3 4 7 4s7-1 7-4l-6 .5V9a2.5 2.5 0 0 0-5 0v2"/>',
  cat: '<path d="M4 16c0-4 2-7 6-7s6 3 6 7zM7 9 6 5l3 3M13 9l1-4-3 3"/>', bat: '<path d="M2 8c3 0 4 2 5 4 1-1 2-1 3-1s2 0 3 1c1-2 2-4 5-4-1 3-3 6-8 6S3 11 2 8z"/>',
  path: '<path d="M5 17c0-4 3-5 3-8S6 5 7 3M15 17c0-4-3-5-3-8s2-4 1-6"/>', fence: '<path d="M4 17V6l1.5-2L7 6v11M13 17V6l1.5-2L16 6v11M4 9h12M4 14h12"/>',
  wall: '<path d="M2 15h16M2 11h16M2 15v-4M6 11v4M10 11v4M14 11v4M18 11v4M4 11V7h12v4M8 7v4M12 7v4"/>', hedge: '<path d="M2 15c0-3 2-4 3-4 0-2 2-3 3-2 1-2 4-2 5 0 1-1 3 0 3 2 1 0 2 1 2 4z"/>',
  flatten: '<path d="M2 14h16M5 14l2-6h6l2 6"/>', water: '<path d="M2 9q2-2 4 0t4 0 4 0 4 0M2 13q2-2 4 0t4 0 4 0 4 0"/>',
  barrel: '<path d="M6 4h8c1 3 1 9 0 12H6c-1-3-1-9 0-12zM5.5 8h9M5.5 12h9"/>', crate: '<path d="M4 6h12v10H4zM4 6l12 10M16 6 4 16"/>',
  sack: '<path d="M7 5h6l-1 2c3 1 4 4 4 6 0 3-2 4-6 4s-6-1-6-4c0-2 1-5 4-6z"/>', chest: '<path d="M3 9h14v7H3zM3 9c0-3 3-4 7-4s7 1 7 4M9 11h2v2H9z"/>',
  bench: '<path d="M2 9h16M3 9v6M17 9v6M4 12h12"/>', table: '<path d="M2 8h16M4 8v8M16 8v8"/>', chair: '<path d="M6 3v14M6 10h8v7"/>', stool: '<path d="M5 8h10M7 8l-2 9M13 8l2 9M10 8v9"/>',
  haybale: '<path d="M3 7h14v9H3zM7 7v9M13 7v9"/>', woodpile: '<circle cx="6" cy="13.5" r="2.2"/><circle cx="10.5" cy="13.5" r="2.2"/><circle cx="15" cy="13.5" r="2.2"/><circle cx="8.2" cy="9.3" r="2.2"/><circle cx="12.8" cy="9.3" r="2.2"/>',
  cart: '<path d="M2 7h13v5H2zM15 9h3"/><circle cx="6.5" cy="15" r="2.3"/>', scarecrow: '<circle cx="10" cy="4.5" r="2"/><path d="M10 6.5V18M3 9h14M7 9v5h6V9"/>',
  plantpot: '<path d="M6 11h8l-1 6H7zM10 11V7M10 8c-2-3-5-2-5-1 2 1 4 1 5 1M10 8c1-3 4-3 5-2-1 2-3 2-5 2"/>', anvil: '<path d="M3 6h13c0 2-2 3-4 3v3h2v3H6v-3h2V9C5 9 3 8 3 6z"/>',
  grindstone: '<circle cx="10" cy="9" r="5"/><circle cx="10" cy="9" r="1"/><path d="M6 17l2-4M14 17l-2-4"/>', cauldron: '<path d="M4 8h12c0 5-2 8-6 8s-6-3-6-8zM6 16l-1 2M14 16l1 2M7 5q1-2 2 0t2 0"/>',
  gravestone: '<path d="M6 17V8a4 4 0 0 1 8 0v9zM4 17h12M10 9v4M8.5 10.5h3"/>', weaponrack: '<path d="M3 17h14M4 17V5M16 17V5M3 7h14M7 15V4M10 15V3M13 15V4"/>',
  armorstand: '<circle cx="10" cy="4" r="2"/><path d="M6 7h8l-1 6H7zM10 13v4M7 17h6"/>', telescope: '<path d="M3 9l11-5 2 4-11 5zM9 11l-3 7M9 11l3 7"/>', lectern: '<path d="M5 6l10-2v4L5 10zM10 9v8M7 17h6"/>',
  standingstone: '<path d="M7 18 6 8l2-5h4l2 5-1 10z"/>', noticeboard: '<path d="M3 4h14v9H3zM5 13v5M15 13v5M6 6h4v3H6zM11 7h4v4h-4z"/>', signpost: '<path d="M10 18V3M10 5h6l2 2-2 2h-6M10 10H4l-2 2 2 2h6"/>',
  clear: '<circle cx="10" cy="10" r="7" stroke-dasharray="2 2"/><path d="M7 7l6 6M13 7l-6 6"/>', area: '<path d="M10 18s-5-5.5-5-9a5 5 0 0 1 10 0c0 3.5-5 9-5 9z"/><circle cx="10" cy="9" r="1.8"/>', gloam: '<circle cx="10" cy="10" r="7" stroke-dasharray="2 2"/><circle cx="8" cy="9" r="1"/><circle cx="12" cy="9" r="1"/><path d="M8 13q2 1 4 0"/>',
};
const edIcon = k => `<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ED_ICONS[k] || ED_ICONS.prop}</svg>`;
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- opening and closing --------------------------------------------------------------------------------------------------
function editAllowed() {
  if (EDIT.on) return true;
  if (SCENE.active || DLG.active) return 'Not in the middle of a scene.';
  if (UG.zone) return 'Come back up into the open air first.';
  if (COMBAT.down) return 'Not right now.';
  return true;
}
function editOpen(o = {}) {
  if (EDIT.on) return;
  const ok = o.fromTitle ? true : editAllowed();
  if (ok !== true) { UI.toast('Area editor', ok, 'info'); return; }
  edInit();
  UI.closeModals();
  EDIT.on = true; EDIT.fromTitle = !!o.fromTitle;
  for (const e of COMBAT.enemies.slice()) if (e.alive && !e.boss) killEnemy(e, true);
  EDIT.savedTime = TIME.h;
  INPUT.target = null; INPUT.goal = null; KEYS.clear(); EDIT.keys.clear();
  const C = EDIT.cam;
  C.tx = CAM.intro ? -3 : CAM.tgt.x; C.tz = CAM.intro ? 8 : CAM.tgt.z; C.ty = terrainH(C.tx, C.tz) + 1;
  C.yaw = C.yawT = CAM.intro ? PI / 4 : CAM.yaw; C.pitch = C.pitchT = 0.95; C.dist = C.distT = 36;
  if (o.fromTitle) { CAM.intro = false; $('intro').classList.add('gone'); }
  $('hud').classList.add('editing');
  $('editor').hidden = false;
  if (innerWidth < 760) $('editor').classList.add('side-off');   // small screens start with the view, not the panel
  scene.add(EDIT.ov);
  // the area you're standing in; else the last one you worked on (flying to it from the title, or if it's close by)
  const here = AREAS.at(C.tx, C.tz), last = AREAS.byId(AREAS.cur) || AREAS.list[AREAS.list.length - 1] || null;
  const lastNear = last && last.hdr && Math.hypot(last.hdr.x - C.tx, last.hdr.z - C.tz) < last.hdr.r + 90;
  edSetArea(here || (o.fromTitle || lastNear ? last : null), { fly: !here && !!o.fromTitle && !!last });
  edSetTool(null);
  edRefreshAll();
  edHint();
  renderer.domElement.focus?.({ preventScroll: true });
}
function editClose(o = {}) {
  if (!EDIT.on) return;
  edFlushText();
  edSetTool(null); edSelect(-1);
  EDIT.on = false; EDIT.drag = null; EDIT.hover = null;
  $('editor').hidden = true; $('hud').classList.remove('editing');
  scene.remove(EDIT.ov);
  edCloseModal();
  TIME.h = EDIT.savedTime;
  AREAS.cur = EDIT.area?.id ?? AREAS.cur; AREAS.save(true);
  if (o.walkHere && G.started) {
    const C = EDIT.cam; teleportParty(C.tx, C.tz, player.face);
  }
  for (const c of PARTY) pushOut(c, c.r || 0.34, c.y + 0.3, c.y + 1.55);   // in case something was built on top of us
  fixPartyY();
  CAM.tgt.set(player.x, player.smoothY + 1, player.z);
  if (EDIT.fromTitle) { CAM.intro = true; $('intro').classList.remove('gone'); $('hud').classList.add('off'); }
  renderer.domElement.focus?.({ preventScroll: true });
}

// ---- the camera -------------------------------------------------------------------------------------------------------------
function editorCamera(dt) {
  const C = EDIT.cam, K = EDIT.keys, typing = EDIT.typing;
  let fw = 0, rt = 0, turn = 0;
  if (!typing) {
    if (K.has('KeyW') || K.has('ArrowUp')) fw += 1; if (K.has('KeyS') || K.has('ArrowDown')) fw -= 1;
    if (K.has('KeyD') || K.has('ArrowRight')) rt += 1; if (K.has('KeyA') || K.has('ArrowLeft')) rt -= 1;
    if (K.has('KeyE')) turn += 1; if (K.has('KeyQ')) turn -= 1;
  }
  const sp = (8 + C.dist * 0.9) * (K.has('ShiftLeft') || K.has('ShiftRight') ? 2.4 : 1);
  const fx = -Math.sin(C.yaw), fz = -Math.cos(C.yaw), rx = Math.cos(C.yaw), rz = -Math.sin(C.yaw);
  if (fw || rt) C.goal = null;
  if (C.goal) { C.tx = dampf(C.tx, C.goal.x, 5, dt); C.tz = dampf(C.tz, C.goal.z, 5, dt); if (Math.hypot(C.tx - C.goal.x, C.tz - C.goal.z) < 0.05) C.goal = null; }
  C.tx += (fx * fw + rx * rt) * sp * dt; C.tz += (fz * fw + rz * rt) * sp * dt;
  C.yawT += turn * 1.7 * dt;
  const wx = C.tx - WORLD.cx, wz = C.tz - WORLD.cz, wr = Math.hypot(wx, wz), lim = WORLD.r + 10;
  if (wr > lim) { C.tx = WORLD.cx + wx / wr * lim; C.tz = WORLD.cz + wz / wr * lim; }
  C.yaw = dampA(C.yaw, C.yawT, 12, dt); C.pitch = dampf(C.pitch, C.pitchT, 10, dt); C.dist = dampf(C.dist, C.distT, 10, dt);
  C.ty = dampf(C.ty, Math.max(terrainH(C.tx, C.tz), WATER_Y) + 1, 6, dt);
  const cp = Math.cos(C.pitch), d = C.dist;
  camera.position.set(C.tx + Math.sin(C.yaw) * cp * d, C.ty + Math.sin(C.pitch) * d, C.tz + Math.cos(C.yaw) * cp * d);
  camera.lookAt(C.tx, C.ty, C.tz);
  CAM.tgt.set(C.tx, C.ty, C.tz); CAM.yaw = C.yaw;
}
function edFly(x, z, dist) { const C = EDIT.cam; C.goal = { x, z }; if (dist) C.distT = clamp(dist, 6, 140); }

// ---- picking: what's under the mouse ------------------------------------------------------------------------------------------
const _eray = new THREE.Raycaster(), _endc = new THREE.Vector2(), _ev = new V3();
function edRay(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  _endc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  _eray.setFromCamera(_endc, camera);
  return _eray.ray;
}
// where the mouse ray meets the ground (marching over the height field)
function edGround(cx, cy) {
  const ray = edRay(cx, cy), o = ray.origin, d = ray.direction;
  let t = 0.5, prev = 0;
  const above = t2 => o.y + d.y * t2 - Math.max(terrainH(o.x + d.x * t2, o.z + d.z * t2), WATER_Y);
  if (above(t) < 0) return null;
  while (t < 900) {
    const step = 0.4 + t * 0.012;
    prev = t; t += step;
    if (above(t) < 0) {
      let a = prev, b = t;
      for (let i = 0; i < 12; i++) { const m = (a + b) / 2; if (above(m) < 0) b = m; else a = m; }
      const x = o.x + d.x * b, z = o.z + d.z * b;
      return { x, z, y: Math.max(terrainH(x, z), WATER_Y) };
    }
  }
  return null;
}
function edScreen(x, y, z) {
  const r = renderer.domElement.getBoundingClientRect();
  _ev.set(x, y, z).project(camera);
  if (_ev.z > 1) return null;
  return { x: r.left + (_ev.x * 0.5 + 0.5) * r.width, y: r.top + (-_ev.y * 0.5 + 0.5) * r.height };
}
function edPick(cx, cy) {
  // the area's own pin first
  const a = EDIT.area;
  if (a && a.hdr) { const s = edScreen(a.hdr.x, terrainH(a.hdr.x, a.hdr.z) + 3.2, a.hdr.z); if (s && Math.hypot(s.x - cx, s.y - cy) < 16) return { pin: a }; }
  // handles on the selected line
  const sh = edSelHandle();
  if (sh && AK[sh.obj.kind].multi) { const pts = sh.obj.p.points || []; for (let i = 0; i < pts.length; i++) { const x = a.hdr.x + pts[i][0], z = a.hdr.z + pts[i][1], s = edScreen(x, terrainH(x, z) + 0.3, z); if (s && Math.hypot(s.x - cx, s.y - cy) < 13) return { point: i, h: sh }; } }
  // anything solid under the mouse
  const ray = edRay(cx, cy);
  const groups = [];
  for (const ar of AREAS.list) for (const h of ar.handles) if (h.group && h.group.children.length) groups.push(h.group);
  let hit = null;
  if (groups.length) { const hits = _eray.intersectObjects(groups, true); for (const it of hits) { let g = it.object; while (g && !g.userData.h) g = g.parent; if (g && g.visible !== false) { hit = { h: g.userData.h, d: it.distance }; break; } } }
  // things you can't see (lights, haunts, cleared or levelled ground) by their markers; lines on the ground by where they run
  const gp = edGround(cx, cy);
  let mark = null, md = 1e9, line = null, ld = 1e9;
  for (const ar of AREAS.list) for (const h of ar.handles) {
    if (!h.anchor) continue;
    const K = AK[h.obj.kind];
    if (K.multi && gp && h.o && h.o.pts) {
      const w = h.obj.kind === 'path' ? (h.o.P.width / 2 + 0.3) : 0.7;
      for (let i = 0; i < h.o.pts.length - 1; i++) { const d = segDist(gp.x, gp.z, h.o.pts[i], h.o.pts[i + 1]) / w; if (d < 1 && d < ld) { ld = d; line = h; } }
      continue;
    }
    if (ED_MARKED.has(h.obj.kind)) {
      const s = edScreen(h.anchor.x, h.anchor.y + 0.5, h.anchor.z); if (!s) continue;
      const d = Math.hypot(s.x - cx, s.y - cy);
      if (d < 16 && d < md) { md = d; mark = h; }
    }
  }
  if (mark) return { h: mark };
  if (hit) return { h: hit.h };
  if (line) return { h: line };
  return null;
}
const ED_MARKED = new Set(['light', 'gloam', 'clear', 'flatten', 'pond', 'flowers', 'grove', 'chickens', 'sheep', 'ducks', 'bats']);

// ---- the overlay: rings, outlines, handles, the ghost of what you're placing ---------------------------------------------------
function edMat(color, opacity, depthTest = true) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest, depthWrite: false, side: THREE.DoubleSide, fog: false });
}
// a flat ribbon lying on the ground along a line (dashed if asked)
function edRibbon(pts, closed, w, mat, o = {}) {
  const P = [], step = o.step ?? 0.8, lift = o.lift ?? 0.07, dash = o.dash || 0;
  const seq = closed ? [...pts, pts[0]] : pts;
  let run = 0;
  for (let i = 0; i < seq.length - 1; i++) {
    const [x0, z0] = seq[i], [x1, z1] = seq[i + 1], L = Math.hypot(x1 - x0, z1 - z0); if (L < 1e-4) continue;
    const n = Math.max(1, Math.ceil(L / step)), nx = -(z1 - z0) / L * w / 2, nz = (x1 - x0) / L * w / 2;
    for (let k = 0; k < n; k++) {
      const ta = k / n, tb = (k + 1) / n;
      if (dash && Math.floor((run + ta * L) / dash) % 2 === 1) continue;
      const xa = lerp(x0, x1, ta), za = lerp(z0, z1, ta), xb = lerp(x0, x1, tb), zb = lerp(z0, z1, tb);
      const ya = Math.max(terrainH(xa, za), WATER_Y) + lift, yb = Math.max(terrainH(xb, zb), WATER_Y) + lift;
      P.push(xa + nx, ya, za + nz, xa - nx, ya, za - nz, xb + nx, yb, zb + nz, xb + nx, yb, zb + nz, xa - nx, ya, za - nz, xb - nx, yb, zb - nz);
    }
    run += L;
  }
  if (o.round) for (const [x, z] of seq) {   // round joints, so a bent line doesn't crack at its corners
    const y = Math.max(terrainH(x, z), WATER_Y) + lift, r = w / 2;
    for (let k = 0; k < 12; k++) { const a0 = k / 12 * TAU, a1 = (k + 1) / 12 * TAU; P.push(x, y, z, x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, x + Math.cos(a1) * r, y, z + Math.sin(a1) * r); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  const m = new THREE.Mesh(g, mat); m.renderOrder = o.order ?? 20; m.frustumCulled = false;
  return m;
}
const edCircle = (x, z, r, n = 48) => { const out = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; out.push([x + Math.cos(a) * r, z + Math.sin(a) * r]); } return out; };
function edOutline(h) {   // the shape an object is drawn round with
  const o = h.o; if (!o) return null;
  const K = AK[h.obj.kind];
  if (K.multi) return { pts: o.pts, closed: false, w: h.obj.kind === 'path' ? o.P.width : K.r * 2 };
  if (h.building) return { pts: h.building.footprint, closed: true, pad: 0.35 };
  if (h.fp) return { pts: h.fp, closed: true, pad: 0.3 };
  const r = (K.pickR ? K.pickR(o.P) : K.r) + 0.25;
  return { pts: edCircle(o.x, o.z, Math.max(0.45, r), r > 6 ? 72 : 36), closed: true };
}
function padPoly(pts, d) {   // push a convex polygon out by d
  let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
  return pts.map(([x, z]) => { const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1; return [x + dx / l * d * 1.41, z + dz / l * d * 1.41]; });
}
function capsule(pts, r) {   // a closed outline round a line of points, with rounded ends — so a selected path stays visible
  const P = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-3);
  if (P.length < 2) return P.length ? edCircle(P[0][0], P[0][1], r, 24) : [];
  const dir = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const side = seq => {   // offset down the left of seq: mitred at gentle bends, bevelled at sharp ones
    const out = [];
    for (let i = 0; i < seq.length; i++) {
      const b = seq[i], d1 = i > 0 ? dir(seq[i - 1], b) : null, d2 = i < seq.length - 1 ? dir(b, seq[i + 1]) : null;
      const n1 = d1 && [-d1[1], d1[0]], n2 = d2 && [-d2[1], d2[0]];
      if (!n1 || !n2) { const n = n1 || n2; out.push([b[0] + n[0] * r, b[1] + n[1] * r]); continue; }
      let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const ml = Math.hypot(mx, mz), cos = ml / 2;
      if (cos < 0.55) { out.push([b[0] + n1[0] * r, b[1] + n1[1] * r], [b[0] + n2[0] * r, b[1] + n2[1] * r]); continue; }
      mx /= ml; mz /= ml; out.push([b[0] + mx * r / cos, b[1] + mz * r / cos]);
    }
    return out;
  };
  const cap = (e, d) => {   // half a circle round the end e, from the left of d round to its right
    const out = [], a0 = Math.atan2(d[1], d[0]);
    for (let k = 1; k < 10; k++) { const a = a0 + Math.PI / 2 - k / 10 * Math.PI; out.push([e[0] + Math.cos(a) * r, e[1] + Math.sin(a) * r]); }
    return out;
  };
  const n = P.length, R = P.slice().reverse();
  return [...side(P), ...cap(P[n - 1], dir(P[n - 2], P[n - 1])), ...side(R), ...cap(P[0], dir(P[1], P[0]))];
}
function edClearOv() { const ov = EDIT.ov; for (let i = ov.children.length - 1; i >= 0; i--) { const c = ov.children[i]; if (c === EDIT.ghost?.group) continue; ov.remove(c); c.traverse(m => { if (m.geometry && !m.userData.keepGeo) m.geometry.dispose(); }); } }
function edRebuildOv() {
  edClearOv();
  const M = EDIT.mats, ov = EDIT.ov, a = EDIT.area;
  // every area's edge, yours brightest
  for (const ar of AREAS.list) {
    if (!ar.hdr) continue;
    const cur = ar === a;
    const ring = edRibbon(edCircle(ar.hdr.x, ar.hdr.z, ar.hdr.r, Math.max(48, Math.round(ar.hdr.r * 3))), true, cur ? 0.32 : 0.22, cur ? M.ring : M.ringDim, { dash: 1.6, step: 0.8, lift: 0.1, order: 18 });
    ring.userData.area = ar; ov.add(ring);
  }
  if (a && a.hdr) {   // the pin in the middle: drag it to move the whole area
    const y = terrainH(a.hdr.x, a.hdr.z);
    const pin = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), M.pin); pole.position.y = 1.3;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), M.pinGem); gem.position.y = 3.2; gem.scale.y = 1.4; EDIT.pinGem = gem;
    pin.add(pole, gem); pin.position.set(a.hdr.x, y, a.hdr.z); pin.renderOrder = 22; pole.renderOrder = gem.renderOrder = 22;
    pin.userData.area = a; pin.userData.base = pin.position.clone(); ov.add(pin);
    // markers for the things that have no body: lights, haunts, cleared and levelled ground
    for (const h of a.handles) {
      if (!h.o) continue;
      const k = h.obj.kind, o = h.o;
      const add = m => { m.userData.area = a; ov.add(m); };
      if (ED_MARKED.has(k) && h.anchor) { const m = new THREE.Mesh(EDIT.markGeo, M.mark); m.userData.keepGeo = true; m.position.set(h.anchor.x, h.anchor.y + 0.5, h.anchor.z); m.userData.base = m.position.clone(); m.renderOrder = 21; add(m); }
      if (k === 'light') add(edRibbon(edCircle(o.x, o.z, 0.6, 20), true, 0.14, M.light, { order: 19 }));
      if (k === 'gloam') add(edRibbon(edCircle(o.x, o.z, o.P.radius, 64), true, 0.3, M.gloam, { dash: 1.2, order: 19 }));
      if (k === 'clear') add(edRibbon(edCircle(o.x, o.z, o.P.radius, 48), true, 0.18, M.clear, { dash: 0.8, order: 19 }));
      if (k === 'flatten' && h.fp) add(edRibbon(h.fp, true, 0.18, M.clear, { dash: 0.8, order: 19 }));
      if (k === 'pond') add(edRibbon(edCircle(o.x, o.z, o.P.radius, 48), true, 0.16, M.water, { dash: 0.8, order: 19 }));
    }
  }
  // the hovered thing, and the selected one (always on top)
  const hh = EDIT.hover && !EDIT.hover.dead && EDIT.hover !== edSelHandle() ? EDIT.hover : null;
  const olPts = ol => ol.closed ? (ol.pad ? padPoly(ol.pts, ol.pad) : ol.pts) : capsule(ol.pts, ol.w / 2 + 0.2);   // lines get a band drawn round them
  if (hh) { const ol = edOutline(hh); if (ol) ov.add(edRibbon(olPts(ol), true, 0.12, M.hover, { order: 23, lift: 0.12 })); }
  const sh = edSelHandle();
  if (sh) {
    const ol = edOutline(sh);
    if (ol) { const m = edRibbon(olPts(ol), true, 0.16, M.sel, { order: 24, lift: 0.14 }); ov.add(m); EDIT.selMesh = m; }
    if (AK[sh.obj.kind].multi && sh.o) for (const [x, z] of sh.o.pts) { const s = new THREE.Mesh(EDIT.dotGeo, M.dot); s.userData.keepGeo = true; s.position.set(x, terrainH(x, z) + 0.3, z); s.renderOrder = 25; ov.add(s); }
  }
  // a line being drawn
  const T = EDIT.tool;
  if (T && T.multi && T.pts.length) {
    const pts = T.pts.slice(); if (T.cur) pts.push([T.cur.x, T.cur.z]);
    if (pts.length > 1) {   // the line itself, thin, and the band it will cover
      ov.add(edRibbon(pts, false, 0.14, M.draw, { order: 24, lift: 0.12, round: true }));
      const w = T.kind === 'path' ? 2.4 : AK[T.kind].r * 2;
      ov.add(edRibbon(capsule(pts, w / 2), true, 0.1, M.draw, { order: 24, lift: 0.12, dash: 0.7, step: 0.35 }));
    }
    for (const [x, z] of T.pts) { const s = new THREE.Mesh(EDIT.dotGeo, M.dot); s.userData.keepGeo = true; s.position.set(x, terrainH(x, z) + 0.3, z); s.renderOrder = 25; ov.add(s); }
  }
  EDIT.ver = AREAS.version;
}

// ---- the ghost: a see-through copy of what you're about to place -------------------------------------------------------------
function edGhostClear() {
  const g = EDIT.ghost; if (!g) return;
  if (g.group) { EDIT.ov.remove(g.group); disposeGroup(g.group); }
  EDIT.ghost = null;
}
function edGhostBuild(at) {
  edGhostClear();
  const T = EDIT.tool, a = EDIT.area; if (!T || T.multi) return;
  const hdr = a && a.hdr ? a.hdr : { x: at.x, z: at.z, r: 24, name: 'New place' };
  const obj = { kind: T.kind, variant: T.variant, name: '', p: { at: [at.x - hdr.x, at.z - hdr.z] }, key: 'ghost' };
  edToolLooks(T, obj);
  const fake = { id: 'ghost', hdr, handles: [] };
  const h = { area: fake, obj, sig: '', fid: 'ghost:' + T.kind, group: null, cap: null, veg: [], pads: [], paths: [], plants: new Map(), gb: null };
  AREAS.buildPass(h);
  release(h.cap);
  for (const c of h.cap.chars) c.root.visible = true;
  h.group.parent?.remove(h.group);
  h.group.traverse(m => { if (m.isMesh || m.isInstancedMesh) { m.material = EDIT.mats.ghost; m.castShadow = false; } });
  EDIT.ov.add(h.group);
  EDIT.ghost = { group: h.group, x: at.x, z: at.z, y: terrainH(at.x, at.z), rot: T.rot || 0, shape: T.shape, kind: T.kind, variant: T.variant };
}
function edGhostMove(p) {
  const g = EDIT.ghost, T = EDIT.tool;
  if (!T || T.multi) return;
  if (!g || g.kind !== T.kind || g.variant !== T.variant || g.rot !== (T.rot || 0) || g.shape !== T.shape || Math.hypot(p.x - g.x, p.z - g.z) > 40) { edGhostBuild(p); return; }
  g.group.position.set(p.x - g.x, terrainH(p.x, p.z) - g.y, p.z - g.z);
  g.group.visible = true;
}

// ---- areas, selection, tools --------------------------------------------------------------------------------------------------
function edSelHandle() { const a = EDIT.area; if (!a || EDIT.sel < 0) return null; const o = a.objs[EDIT.sel]; return o ? a.handles.find(h => h.obj === o) || null : null; }
function edSetArea(a, o = {}) {
  edFlushText();
  EDIT.area = a; EDIT.sel = -1; EDIT.hover = null;
  if (a) { edHist(a); AREAS.cur = a.id; if (o.fly !== false && a.hdr) edFly(a.hdr.x, a.hdr.z, Math.max(30, a.hdr.r * 1.6)); }
  edRefreshAll();
}
function edSelect(i, o = {}) {
  EDIT.sel = i;
  edRenderInspector(); edHint();
  if (i >= 0 && EDIT.area && EDIT.area.objs[i]) edKeyHelp(EDIT.area.objs[i].kind);
  edCodeMarks();
  if (i >= 0 && o.reveal !== false) edRevealLine();
  edRebuildOv();
}
function edSetTool(t) {
  edGhostClear();
  EDIT.tool = t ? { ...t, pts: [], rot: t.rot || 0 } : null;
  if (t && AK[t.kind]) { EDIT.tool.multi = AK[t.kind].multi; edRollLooks(EDIT.tool); }
  for (const b of document.querySelectorAll('.ed-item')) b.setAttribute('aria-pressed', !!t && b.dataset.kind === t.kind);
  renderer.domElement.style.cursor = t ? 'copy' : '';
  if (EDIT.ui) edRenderInspector();
  edHint(); edRebuildOv();
}
// change the text (from the gui): rebuild, keep history, refresh the panels
function edCommit(text, o = {}) {
  const a = EDIT.area; if (!a) return;
  if (text === a.text) return;
  AREAS.setText(a, text);
  if (!o.noHist) edPushHist(a);
  if (o.sel !== undefined) EDIT.sel = o.sel;
  if (EDIT.sel >= a.objs.length) EDIT.sel = -1;
  edRefreshAll(o);
}
function edLines(a) { return a.text.split('\n'); }
function edReplaceObj(i, obj) {   // write one object back into its own lines, leaving the rest of the text alone
  const a = EDIT.area, old = a.objs[i]; if (!old) return;
  const L = edLines(a);
  L.splice(old.line0, old.line1 - old.line0 + 1, ...aserialize(obj).split('\n'));
  edCommit(edFit(a, L, obj).join('\n'), { sel: i });
}
// keep an area's ring round everything in it: when something lands outside, the radius grows in the same edit
function edFit(a, L, obj) {
  if (!a.hdr || a.hdr.r >= 120) return L;
  let far = 0; for (const [x, z] of obj.p.points || (obj.p.at ? [obj.p.at] : [])) far = Math.max(far, Math.hypot(x, z));
  if (obj.p.radius && obj.kind !== 'npc') far += obj.p.radius;   // groves, ponds and flocks spread round their middle
  if (far <= a.hdr.r - 1) return L;
  const h2 = { ...a.hdr, r: Math.min(120, Math.ceil(far + 3)) };
  if (a.hdr.line !== undefined && /^\s*area\b/i.test(L[a.hdr.line] || '')) L[a.hdr.line] = aheader(h2); else L.unshift(aheader(h2));
  return L;
}
// the area a new thing at x, z goes in: the current one if it's inside it, else the one it's inside,
// else the current one stretched to reach — or, if that's too far, a new place right there
function edAreaAt(x, z) {
  let a = EDIT.area;
  const inside = ar => ar && ar.hdr && Math.hypot(x - ar.hdr.x, z - ar.hdr.z) < ar.hdr.r;
  if (!inside(a)) {
    const other = AREAS.at(x, z);
    if (other) { edSetArea(other, { fly: false }); a = other; }
    else if (a && a.hdr && Math.hypot(x - a.hdr.x, z - a.hdr.z) > 112) a = null;
  }
  return a || edNewArea(null, { x, z, quiet: true });
}
function edAddObj(obj, o = {}) {
  let a = EDIT.area;
  if (!a) a = edNewArea(null, { x: EDIT.cam.tx, z: EDIT.cam.tz, quiet: true });
  const L = a.text.replace(/\s*$/, '').split('\n');
  L.push(...aserialize(obj).split('\n'));
  edCommit(edFit(a, L, obj).join('\n') + '\n', { sel: -1 });
  EDIT.sel = o.select === false ? -1 : a.objs.length - 1;
  EDIT.lastAdded = a.objs.length - 1;
  edRenderInspector(); edCodeMarks(); EDIT.sel >= 0 ? edRevealLine() : edRevealLast(); edRebuildOv(); edHint();
}
function edRevealLast() { const a = EDIT.area, o = a && a.objs[a.objs.length - 1], ta = EDIT.ui.ta; if (o) { const top = edLineTop(o.line0); if (top > ta.scrollTop + ta.clientHeight - 30) ta.scrollTop = top - ta.clientHeight * 0.6; } }
function edDeleteSel() {
  const a = EDIT.area, i = EDIT.sel; if (!a || i < 0) return;
  const o = a.objs[i], L = edLines(a);
  L.splice(o.line0, o.line1 - o.line0 + 1);
  edCommit(L.join('\n'), { sel: -1 });
}
function edDuplicate() {
  const a = EDIT.area, o = a && a.objs[EDIT.sel]; if (!o) return;
  const c = JSON.parse(JSON.stringify({ kind: o.kind, variant: o.variant, name: o.name, p: o.p }));
  if (c.name) c.name = c.name.replace(/( \d+)?$/, m => ' ' + ((parseInt(m) || 1) + 1));
  if (c.p.at) c.p.at = [c.p.at[0] + 2, c.p.at[1] + 2];
  if (c.p.points) c.p.points = c.p.points.map(([x, z]) => [x + 2, z + 2]);
  edAddObj(c);
}
function edObjCopy(i) { const o = EDIT.area.objs[i]; return { kind: o.kind, variant: o.variant, name: o.name, p: JSON.parse(JSON.stringify(o.p)), comment: o.comment }; }
function edRotateSel(d) {
  const T = EDIT.tool;
  if (T && !T.multi) { T.rot = (((T.rot || 0) + d) % 360 + 360) % 360; if (EDIT.ghost) edGhostBuild({ x: EDIT.ghost.x + EDIT.ghost.group.position.x, z: EDIT.ghost.z + EDIT.ghost.group.position.z }); edHint(); return; }
  const i = EDIT.sel, a = EDIT.area; if (!a || i < 0 || !AK[a.objs[i].kind].rot) return;
  const c = edObjCopy(i); c.p.rot = (((c.p.rot || 0) + d) % 360 + 360) % 360; if (!c.p.rot) delete c.p.rot;
  edReplaceObj(i, c);
}
const edSnap = v => EDIT.snap ? Math.round(v / EDIT.snap) * EDIT.snap : Math.round(v * 100) / 100;
function edNewArea(kind, at) {
  const x = Math.round(at?.x ?? EDIT.cam.tx), z = Math.round(at?.z ?? EDIT.cam.tz);
  let n = 1; while (AREAS.list.some(a => a.hdr && a.hdr.name === (n === 1 ? 'New place' : 'New place ' + n))) n++;
  const name = n === 1 ? 'New place' : 'New place ' + n;
  const a = AREAS.add(kind === 'example' ? AREA_EXAMPLE(x, z) : areaTemplate(name, x, z));
  edSetArea(a, { fly: !at?.quiet });
  UI.toast('A new place', kind === 'example' ? 'An example hamlet, to take apart.' : at?.quiet ? `Everything you put here belongs to “${a.hdr.name}”. Click empty ground to name it.` : `“${a.hdr.name}” — pick things on the left and click to place them.`, 'info', 4);
  return a;
}
function edPlaceAt(p) {
  const T = EDIT.tool; if (!T) return;
  const a = edAreaAt(p.x, p.z);
  const K = AK[T.kind];
  const obj = { kind: T.kind, variant: T.variant || (K.variants ? K.def : null), name: '', p: { at: [edSnap(p.x - a.hdr.x), edSnap(p.z - a.hdr.z)] } };
  edToolLooks(T, obj);
  if (T.kind === 'npc') { const used = new Set(AREAS.handles().map(h => h.obj.name)); obj.name = ED_NAMES.find(n => !used.has(n)) || 'Stranger'; }
  edAddObj(obj, { select: !K.sticky });
  if (!K.sticky) edSetTool(null);
  else { edRollLooks(T); edGhostClear(); }   // the next one comes out a little different
}
// trees and rocks come out with a random turn and shape (shown in the ghost, kept in the text)
function edRollLooks(T) { const K = AK[T.kind]; T.autoRot = K.cat === 'Nature' && K.rot ? Math.floor(Math.random() * 24) * 15 : 0; const n = K.plant ? IVEG.kinds.get(K.plant({ variant: T.variant || K.def }))?.length || 1 : 1; T.shape = n > 1 ? 1 + Math.floor(Math.random() * n) : 0; }
function edToolLooks(T, obj) { const r = T.rot || T.autoRot || 0; if (r) obj.p.rot = r; if (T.shape) obj.p.shape = T.shape; }
function edFinishLine() {
  const T = EDIT.tool; if (!T || !T.multi) return;
  if (T.pts.length < 2) { UI.toast('Not yet', 'Click at least two points along the line, then press Enter.', 'info', 2.5); return; }
  const a = edAreaAt(T.pts[0][0], T.pts[0][1]);
  const obj = { kind: T.kind, variant: null, name: '', p: { points: T.pts.map(([x, z]) => [edSnap(x - a.hdr.x), edSnap(z - a.hdr.z)]) } };
  T.pts = []; T.cur = null;
  edAddObj(obj);
  edSetTool(null);
}

// ---- history ---------------------------------------------------------------------------------------------------------------------
function edHist(a) { let H = EDIT.hist.get(a.id); if (!H) EDIT.hist.set(a.id, H = { stack: [a.text], i: 0 }); return H; }
function edPushHist(a) { const H = edHist(a); if (H.stack[H.i] === a.text) return; H.stack.length = H.i + 1; H.stack.push(a.text); H.i++; if (H.stack.length > 300) { H.stack.shift(); H.i--; } edBarState(); }
function edUndo(dir) {
  const ae = document.activeElement; if (ae && EDIT.ui && EDIT.ui.insp.contains(ae)) ae.blur();   // so the panel shows what the undo brought back
  edFlushText();
  const a = EDIT.area; if (!a) return;
  const H = edHist(a), j = H.i + dir;
  if (j < 0 || j >= H.stack.length) return;
  H.i = j;
  const sel = EDIT.sel;
  edCommit(H.stack[j], { noHist: true, sel });
  edBarState();
}

// ---- input --------------------------------------------------------------------------------------------------------------------
function edBind() {
  if (EDIT.bound) return; EDIT.bound = true;
  const el = renderer.domElement;
  addEventListener('keydown', e => {
    if (e.code === 'F2' && !e.repeat) { e.preventDefault(); if (EDIT.on) editClose(); else if (!CAM.intro && !UI.modalOpen() && $('ending').hidden) editOpen(); return; }
    if (!EDIT.on) return;
    const inField = e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.code === 'KeyZ' || e.code === 'KeyY')) { e.preventDefault(); edUndo(e.code === 'KeyY' || e.shiftKey ? 1 : -1); return; }
    if (EDIT.modal) { if (e.code === 'Escape') { e.preventDefault(); edCloseModal(); } return; }
    if (inField) { if (e.code === 'Escape') e.target.blur(); return; }
    if (e.target && e.target.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
    EDIT.keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.code === 'Escape') { if (EDIT.tool) edSetTool(null); else if (EDIT.sel >= 0) edSelect(-1); return; }
    if ((e.code === 'Delete' || e.code === 'Backspace')) { e.preventDefault(); if (EDIT.tool && EDIT.tool.multi && EDIT.tool.pts.length) { EDIT.tool.pts.pop(); edRebuildOv(); } else edDeleteSel(); return; }
    if (e.code === 'Enter' && EDIT.tool && EDIT.tool.multi) { edFinishLine(); return; }
    if (e.code === 'KeyR' && !mod) { edRotateSel(e.shiftKey ? -15 : 15); return; }
    if (e.code === 'KeyD' && mod) { e.preventDefault(); edDuplicate(); return; }
    if (e.code === 'KeyF' && !mod) { const h = edSelHandle(); if (h && h.anchor) edFly(h.anchor.x, h.anchor.z, Math.max(14, h.anchor.r * 4)); else if (EDIT.area) edFly(EDIT.area.hdr.x, EDIT.area.hdr.z); return; }
    if (e.code === 'KeyT' && !mod) { edToggleView(); return; }
    if (e.code === 'Equal' || e.code === 'NumpadAdd') EDIT.cam.distT = clamp(EDIT.cam.distT * 0.85, 6, 140);
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') EDIT.cam.distT = clamp(EDIT.cam.distT * 1.18, 6, 140);
  });
  addEventListener('keyup', e => EDIT.keys.delete(e.code));
  addEventListener('resize', () => { if (EDIT.on && EDIT.ui) { clearTimeout(EDIT.rsT); EDIT.rsT = setTimeout(() => { edHighlight(); edHint(); }, 150); } });
  addEventListener('blur', () => EDIT.keys.clear());
  el.addEventListener('wheel', e => { if (!EDIT.on) return; e.preventDefault(); EDIT.cam.distT = clamp(EDIT.cam.distT * (e.deltaY > 0 ? 1.12 : 0.89), 6, 140); }, { passive: false });
  el.addEventListener('dblclick', e => { if (!EDIT.on) return; if (EDIT.tool && EDIT.tool.multi) { edFinishLine(); return; } const p = edPick(e.clientX, e.clientY); if (p && p.h && p.h.anchor) edFly(p.h.anchor.x, p.h.anchor.z); });
  el.addEventListener('pointerdown', e => {
    if (!EDIT.on) return;
    try { el.setPointerCapture(e.pointerId); } catch (er) { /* synthetic events */ }
    if (e.pointerType === 'touch') {   // two fingers: pinch to zoom, twist to turn
      EDIT.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (EDIT.touches.size === 2) {
        const [p, q] = [...EDIT.touches.values()];
        if (EDIT.drag && EDIT.drag.preview) { EDIT.ov.remove(EDIT.drag.preview); }
        if (EDIT.drag && EDIT.drag.h && EDIT.drag.h.group) EDIT.drag.h.group.position.set(0, 0, 0);
        EDIT.drag = { mode: 'pinch', d0: Math.hypot(p.x - q.x, p.y - q.y), a0: Math.atan2(q.y - p.y, q.x - p.x), dist0: EDIT.cam.distT, yaw0: EDIT.cam.yawT, moved: 99 };
        return;
      }
      if (EDIT.touches.size > 2) return;
    }
    EDIT.mx = e.clientX; EDIT.my = e.clientY;
    const d = { id: e.pointerId, btn: e.button, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: 0, mode: null, touch: e.pointerType === 'touch' };
    EDIT.drag = d;
    if (e.button === 2 || e.button === 1) { d.mode = e.button === 2 ? 'orbit' : 'pan'; d.g = edGround(e.clientX, e.clientY); return; }
    if (EDIT.tool) { d.mode = 'tool'; return; }
    const p = edPick(e.clientX, e.clientY);
    d.pick = p;
    if (p && p.pin) d.mode = 'area?';
    else if (p && p.point !== undefined) d.mode = 'point?';
    else if (p && p.h) d.mode = 'move?';
    else { d.mode = 'pan'; d.g = edGround(e.clientX, e.clientY); }
  });
  el.addEventListener('pointermove', e => {
    if (!EDIT.on) return;
    if (e.pointerType === 'touch' && EDIT.touches.has(e.pointerId)) EDIT.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (EDIT.drag && EDIT.drag.mode === 'pinch') {
      if (EDIT.touches.size < 2) return;
      const [p, q] = [...EDIT.touches.values()], d = EDIT.drag;
      EDIT.cam.distT = clamp(d.dist0 * d.d0 / Math.max(20, Math.hypot(p.x - q.x, p.y - q.y)), 6, 140);
      EDIT.cam.yawT = d.yaw0 - (Math.atan2(q.y - p.y, q.x - p.x) - d.a0);
      return;
    }
    EDIT.mx = e.clientX; EDIT.my = e.clientY; EDIT.mT = performance.now();
    const d = EDIT.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy);
    const C = EDIT.cam;
    if (d.mode === 'orbit') { C.yawT -= dx * 0.006; C.pitchT = clamp(C.pitchT + dy * 0.005, 0.3, 1.5); return; }
    if (d.mode === 'pan') {
      if (!d.g) return;
      C.goal = null;
      // keep the grabbed point of ground under the mouse
      C.yaw = C.yawT; C.pitch = C.pitchT; C.dist = C.distT; editorCamera(0); camera.updateMatrixWorld();
      const g = edGround(e.clientX, e.clientY); if (!g) return;
      C.tx += d.g.x - g.x; C.tz += d.g.z - g.z; return;
    }
    if (d.moved < 5) return;
    if (d.mode === 'move?' || d.mode === 'point?' || d.mode === 'area?') edDragStart(d);
    if (d.mode === 'move' || d.mode === 'point' || d.mode === 'area') edDragMove(d, e.clientX, e.clientY);
  });
  const up = e => {
    if (!EDIT.on) return;
    EDIT.touches.delete(e.pointerId);
    if (EDIT.drag && EDIT.drag.mode === 'pinch') { if (!EDIT.touches.size) EDIT.drag = null; return; }
    const d = EDIT.drag;
    if (!d || d.id !== e.pointerId) return;
    EDIT.drag = null;
    if (d.mode === 'tool' && d.moved < 8) {
      const p = edGround(e.clientX, e.clientY); if (!p) return;
      if (EDIT.tool.multi) { EDIT.tool.pts.push([edSnapW(p.x, 'x'), edSnapW(p.z, 'z')]); edRebuildOv(); edHint(); }
      else edPlaceAt(p);
      return;
    }
    if (d.mode === 'tool' && d.moved >= 8 && d.btn === 0) return;
    if (d.btn === 2 && d.moved < 6 && EDIT.tool) { if (EDIT.tool.multi && EDIT.tool.pts.length >= 2) edFinishLine(); else edSetTool(null); return; }
    if (d.mode === 'move' || d.mode === 'point' || d.mode === 'area') { edDragEnd(d); return; }
    if (d.moved < 6 && d.btn === 0) {
      const p = d.pick;
      if (p && p.h) { if (p.h.area !== EDIT.area) edSetArea(p.h.area, { fly: false }); edSelect(EDIT.area.objs.indexOf(p.h.obj)); }
      else if (p && p.pin) edSelect(-1);
      else if (!p) edSelect(-1);
    }
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', () => { if (EDIT.ghost) EDIT.ghost.group.visible = false; });
}
// snap world points relative to the area's centre, so they come out round in the text
function edSnapW(v, axis) { const a = EDIT.area, o = a && a.hdr ? (axis === 'x' ? a.hdr.x : a.hdr.z) : 0; return o + edSnap(v - o); }
function edDragStart(d) {
  const p = d.pick, g0 = edGround(d.x0, d.y0);
  if (!g0) { d.mode = null; return; }
  d.g0 = g0;
  if (d.mode === 'area?') { d.mode = 'area'; d.a = p.pin; return; }
  if (d.mode === 'point?') { d.mode = 'point'; d.h = p.h; d.i = p.point; if (EDIT.area.objs.indexOf(p.h.obj) !== EDIT.sel) edSelect(EDIT.area.objs.indexOf(p.h.obj), { reveal: false }); return; }
  d.mode = 'move'; d.h = p.h;
  if (d.h.area !== EDIT.area) edSetArea(d.h.area, { fly: false });
  edSelect(EDIT.area.objs.indexOf(d.h.obj), { reveal: false });
}
function edDragMove(d, cx, cy) {
  const g = edGround(cx, cy); if (!g) return;
  const dx = g.x - d.g0.x, dz = g.z - d.g0.z;
  d.dx = dx; d.dz = dz;
  if (d.mode === 'move') {
    const h = d.h, sx = edSnapRel(h, dx, 'x'), sz = edSnapRel(h, dz, 'z');
    const ax = h.anchor ? h.anchor.x : g.x, az = h.anchor ? h.anchor.z : g.z;
    if (h.group) h.group.position.set(sx, terrainH(ax + sx, az + sz) - terrainH(ax, az), sz);
    d.sx = sx; d.sz = sz;
    if (EDIT.selMesh) EDIT.selMesh.position.set(sx, 0, sz);
  } else if (d.mode === 'area') {
    const a = d.a, sx = Math.round(dx), sz = Math.round(dz);
    for (const h of a.handles) if (h.group) h.group.position.set(sx, 0, sz);
    for (const c of EDIT.ov.children) if (c.userData.area === a) { const b = c.userData.base; if (b) c.position.set(b.x + sx, b.y, b.z + sz); else c.position.set(sx, 0, sz); }
    d.sx = sx; d.sz = sz;
  } else if (d.mode === 'point') {
    const a = EDIT.area, o = a.objs[EDIT.sel]; if (!o || !o.p.points) return;
    const pt = o.p.points[d.i], x = edSnap(pt[0] + dx), z = edSnap(pt[1] + dz);
    d.np = [x, z];
    // redraw just the line being bent
    const pts = o.p.points.map((q, k) => k === d.i ? [a.hdr.x + x, a.hdr.z + z] : [a.hdr.x + q[0], a.hdr.z + q[1]]);
    if (d.preview) { EDIT.ov.remove(d.preview); d.preview.geometry.dispose(); }
    d.preview = edRibbon(pts, false, o.kind === 'path' ? (o.p.width ?? 2.4) : 0.35, EDIT.mats.draw, { order: 26, lift: 0.15, round: true });
    EDIT.ov.add(d.preview);
  }
}
function edSnapRel(h, v, axis) {   // move by an amount that leaves the object's own position on the snap grid
  const at = h.obj.p.at || (h.obj.p.points && h.obj.p.points[0]) || [0, 0], base = axis === 'x' ? at[0] : at[1];
  return edSnap(base + v) - base;
}
function edDragEnd(d) {
  const a = EDIT.area;
  if (d.preview) { EDIT.ov.remove(d.preview); d.preview.geometry.dispose(); }
  if (d.mode === 'move' && d.sx !== undefined) {
    const i = a.objs.indexOf(d.h.obj);
    if (i < 0 || (!d.sx && !d.sz)) { if (d.h.group) d.h.group.position.set(0, 0, 0); edRebuildOv(); return; }
    const c = edObjCopy(i);
    if (c.p.at) c.p.at = [edSnap(c.p.at[0] + d.sx), edSnap(c.p.at[1] + d.sz)];
    if (c.p.points) c.p.points = c.p.points.map(([x, z]) => [edSnap(x + d.sx), edSnap(z + d.sz)]);
    if (c.p.route) c.p.route = c.p.route.map(([x, z]) => [edSnap(x + d.sx), edSnap(z + d.sz)]);
    edReplaceObj(i, c);
  } else if (d.mode === 'point' && d.np) {
    const c = edObjCopy(EDIT.sel); c.p.points[d.i] = d.np; edReplaceObj(EDIT.sel, c);
  } else if (d.mode === 'area' && (d.sx || d.sz)) {
    const L = edLines(a), hd = { ...a.hdr, x: a.hdr.x + d.sx, z: a.hdr.z + d.sz };
    if (a.hdr.line !== undefined && /^\s*area\b/i.test(L[a.hdr.line] || '')) L[a.hdr.line] = aheader(hd); else L.unshift(aheader(hd));
    edCommit(L.join('\n'));
  } else edRebuildOv();
}

// ---- every frame ----------------------------------------------------------------------------------------------------------------
function updateEditor(dt, t) {
  if (!EDIT.ui) return;
  const now = performance.now();
  if (!EDIT.drag && now - EDIT.pickT > 90 && EDIT.mx >= 0) {
    EDIT.pickT = now;
    // where the mouse is, in the area's own numbers (handy when writing the text by hand)
    const gp = edGround(EDIT.mx, EDIT.my), a = EDIT.area;
    const cs = gp ? (a && a.hdr ? `at ${fnum(edSnap(gp.x - a.hdr.x), 2)}, ${fnum(edSnap(gp.z - a.hdr.z), 2)}` : `${Math.round(gp.x)}, ${Math.round(gp.z)} in the valley`) : '';
    if (cs !== EDIT.coordS) { EDIT.coordS = cs; EDIT.ui.coord.textContent = cs; }
    if (EDIT.tool) {
      const p = edGround(EDIT.mx, EDIT.my);
      if (p) {
        if (EDIT.tool.multi) { EDIT.tool.cur = p; if (EDIT.tool.pts.length) edRebuildOv(); }
        else edGhostMove({ x: edSnapW(p.x, 'x'), z: edSnapW(p.z, 'z') });
      }
      if (EDIT.hover) { EDIT.hover = null; edRebuildOv(); }
    } else if (now - EDIT.mT > 1500 && EDIT.hover) { EDIT.hover = null; edHoverTip(null); edRebuildOv(); }
    else if (now - EDIT.mT < 1500) {
      const p = edPick(EDIT.mx, EDIT.my), h = p && p.h ? p.h : null;
      renderer.domElement.style.cursor = p ? (p.pin || p.point !== undefined || p.h ? 'grab' : '') : '';
      if (h !== EDIT.hover) { EDIT.hover = h; edRebuildOv(); edHoverTip(h); }
      else if (h) { const tip = EDIT.ui.tip; tip.style.left = Math.min(innerWidth - 240, EDIT.mx + 16) + 'px'; tip.style.top = (EDIT.my + 14) + 'px'; }
    }
  }
  if (EDIT.ver !== AREAS.version && !EDIT.drag) edRebuildOv();
  if (EDIT.selMesh) EDIT.selMesh.material.opacity = 0.75 + Math.sin(t * 5) * 0.2;
  if (EDIT.pinGem) EDIT.pinGem.rotation.y += dt * 1.2;
  if (AREAS.saveErr && !EDIT.saveWarned) { EDIT.saveWarned = true; UI.toast('Not saved', 'This browser won’t let the game store your areas. Use Export to keep a copy.', 'info', 6); }
}

// ---- the panels -------------------------------------------------------------------------------------------------------------------
function edInit() {
  if (EDIT.ui) return;
  edDownloads();
  EDIT.ov = new THREE.Group(); EDIT.ov.name = 'editor-overlay';
  EDIT.mats = {
    ring: edMat(0xf0a541, 0.85), ringDim: edMat(0xb9ab8f, 0.35), sel: edMat(0xffd38a, 0.9, false), hover: edMat(0xf1e6cf, 0.45, false), draw: edMat(0xffd38a, 0.65, false),
    dot: edMat(0xffd38a, 0.95, false), mark: edMat(0xf1e6cf, 0.8, false), pin: edMat(0xf0a541, 0.9), pinGem: edMat(0xffd38a, 0.95), light: edMat(0xffe08a, 0.8, false), gloam: edMat(0x9a7ad8, 0.6), clear: edMat(0xf1e6cf, 0.45), water: edMat(0x6ab8ff, 0.6),
    ghost: worldMat({ transparent: true, opacity: 0.55, depthWrite: false }),
  };
  EDIT.dotGeo = new THREE.SphereGeometry(0.28, 12, 8);
  EDIT.markGeo = new THREE.OctahedronGeometry(0.32, 0);
  const ui = EDIT.ui = { bar: $('edBar'), pal: $('edPal'), insp: $('edInsp'), ta: $('edText'), hl: $('edHl'), gut: $('edGut'), errs: $('edErrs'), hint: $('edHint'), areaSel: $('edArea'), tip: $('edTip'), coord: $('edCoord'), keys: $('edKeys'), fab: $('edFab') };
  // palette
  const pal = $('edPalList');
  for (const cat of ACATS) {
    const sec = document.createElement('section'); sec.className = 'ed-cat';
    sec.innerHTML = `<h3>${cat}</h3>`;
    const grid = document.createElement('div'); grid.className = 'ed-grid';
    for (const K of Object.values(AK)) {
      if (K.cat !== cat) continue;
      const b = document.createElement('button');
      b.className = 'ed-item'; b.dataset.kind = K.name; b.title = K.desc;
      b.innerHTML = `${edIcon(K.icon)}<span>${K.label}</span>`;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => { if (EDIT.tool && EDIT.tool.kind === K.name) edSetTool(null); else edSetTool({ kind: K.name, variant: K.variants ? (EDIT.lastVar?.[K.name] || K.def) : null }); b.blur(); if (EDIT.tool && matchMedia('(max-width: 900px)').matches) $('editor').classList.remove('pal-on'); });
      grid.appendChild(b);
    }
    sec.appendChild(grid); pal.appendChild(sec);
  }
  $('edSearch').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    for (const b of pal.querySelectorAll('.ed-item')) { const K = AK[b.dataset.kind]; b.hidden = !!q && !(K.name.includes(q) || K.label.toLowerCase().includes(q) || K.desc.toLowerCase().includes(q) || (K.variants || []).some(v => v.includes(q))); }
    for (const s of pal.querySelectorAll('.ed-cat')) s.hidden = ![...s.querySelectorAll('.ed-item')].some(b => !b.hidden);
  });
  // top bar
  ui.areaSel.addEventListener('change', () => { const v = ui.areaSel.value; if (v === '+new') { ui.areaSel.value = EDIT.area?.id || ''; edNewArea(); } else if (v === '+example') { ui.areaSel.value = EDIT.area?.id || ''; edNewArea('example'); } else edSetArea(AREAS.byId(v)); ui.areaSel.blur(); });
  $('edUndo').addEventListener('click', () => edUndo(-1)); $('edRedo').addEventListener('click', () => edUndo(1));
  $('edSnap').addEventListener('change', e => { EDIT.snap = +e.target.value; e.target.blur(); });
  for (const b of document.querySelectorAll('[data-edtime]')) b.addEventListener('click', () => { TIME.h = +b.dataset.edtime; edBarState(); b.blur(); });
  $('edView').addEventListener('click', e => { edToggleView(); e.currentTarget.blur(); });
  $('edExport').addEventListener('click', () => edExport()); $('edImport').addEventListener('click', () => edImport()); $('edHelp').addEventListener('click', () => edHelp());
  $('edWalk').addEventListener('click', () => editClose({ walkHere: true })); $('edDone').addEventListener('click', () => editClose());
  $('edModal').addEventListener('click', e => { if (e.target.id === 'edModal' || e.target.closest('[data-edclose]')) edCloseModal(); });
  // the text
  const ta = ui.ta;
  ta.addEventListener('input', () => { edHighlight(); clearTimeout(EDIT.textT); EDIT.textT = setTimeout(edApplyText, 450); });
  ta.addEventListener('scroll', () => { ui.hl.scrollTop = ta.scrollTop; ui.hl.scrollLeft = ta.scrollLeft; ui.gut.scrollTop = ta.scrollTop; });
  ta.addEventListener('focus', () => { EDIT.typing = true; EDIT.keys.clear(); });
  ta.addEventListener('blur', () => { EDIT.typing = false; edFlushText(); });
  const caret = () => setTimeout(() => {   // the object under the caret is the one selected
    edKeyHelp();
    if (!EDIT.area) return;
    const line = ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
    const i = EDIT.area.objs.findIndex(o => line >= o.line0 && line <= o.line1);
    if (i !== EDIT.sel && ta.value === EDIT.area.text) { EDIT.sel = i; edRenderInspector(); edCodeMarks(); edRebuildOv(); }
  }, 0);
  ta.addEventListener('click', caret); ta.addEventListener('keyup', e => { if (/Arrow|Page|Home|End/.test(e.key)) caret(); else edKeyHelp(); });
  ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); document.execCommand?.('insertText', false, '  ') || ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); } });
  ui.errs.addEventListener('click', e => { const li = e.target.closest('[data-line]'); if (li) edGotoLine(+li.dataset.line); });
  // on a phone the list and the side panel each take most of the screen, so only one is out at a time
  const narrow = () => matchMedia('(max-width: 560px)').matches;
  $('edCollapse').addEventListener('click', () => { const ed = $('editor'); ed.classList.toggle('side-off'); if (!ed.classList.contains('side-off') && narrow()) ed.classList.remove('pal-on'); });
  ui.fab.addEventListener('click', e => {   // the buttons a finger needs where a keyboard would do
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const f = b.dataset.f, T = EDIT.tool;
    if (f === 'back' && T && T.pts.length) { T.pts.pop(); edRebuildOv(); edHint(); }
    if (f === 'finish') edFinishLine();
    if (f === 'stop') edSetTool(null);
    if (f === 'turn') edRotateSel(45);
    if (f === 'dup') edDuplicate();
    if (f === 'del') edDeleteSel();
    if (f === 'more') { $('editor').classList.remove('side-off'); if (narrow()) $('editor').classList.remove('pal-on'); }
    b.blur();
  });
  $('edPalToggle').addEventListener('click', () => { const ed = $('editor'); ed.classList.toggle('pal-on'); if (ed.classList.contains('pal-on') && narrow()) ed.classList.add('side-off'); });
}
function edToggleView() { const C = EDIT.cam; EDIT.view = EDIT.view === 'top' ? 'angled' : 'top'; C.pitchT = EDIT.view === 'top' ? 1.5 : 0.95; edBarState(); }
function edRefreshAll(o = {}) {
  if (!EDIT.ui) return;
  const ae = document.activeElement, typingInsp = ae && ae.tagName === 'INPUT' && EDIT.ui.insp.contains(ae);
  edAreaSelect(); edBarState(); if (!typingInsp) edRenderInspector();
  if (!o.keepText) edSetTextarea();
  edCodeMarks(); edRebuildOv(); edHint();
}
function edAreaSelect() {
  const s = EDIT.ui.areaSel;
  s.innerHTML = (AREAS.list.length ? (EDIT.area ? '' : '<option value="">Go to a place…</option>') : '<option value="">No places yet</option>') + AREAS.list.map(a => `<option value="${a.id}">${escH(a.hdr ? a.hdr.name : a.id)}</option>`).join('') + '<option value="+new">＋ New empty area here</option><option value="+example">＋ Example hamlet here</option>';
  s.value = EDIT.area ? EDIT.area.id : '';
}
function edBarState() {
  const a = EDIT.area, H = a && edHist(a);
  $('edUndo').disabled = !H || H.i <= 0; $('edRedo').disabled = !H || H.i >= H.stack.length - 1;
  for (const b of document.querySelectorAll('[data-edtime]')) b.setAttribute('aria-pressed', Math.abs(TIME.h - +b.dataset.edtime) < 0.3);
  $('edView').setAttribute('aria-pressed', EDIT.view === 'top');
  $('edWalk').hidden = !G.started;
  $('edDone').textContent = EDIT.fromTitle ? 'Back to title' : 'Done';
}
const edTouchUI = () => matchMedia('(pointer: coarse)').matches || innerWidth <= 900;
function edFab() {
  const box = EDIT.ui.fab, T = EDIT.tool, sel = EDIT.area && EDIT.sel >= 0;
  let html = '';
  if (edTouchUI()) {
    if (T && T.multi) html = `<button class="btn" data-f="back"${T.pts.length ? '' : ' disabled'}>Back</button><button class="btn" data-f="finish"${T.pts.length >= 2 ? '' : ' disabled'}>Finish</button><button class="btn" data-f="stop">Cancel</button>`;
    else if (T) html = '<button class="btn" data-f="stop">Stop placing</button>';
    else if (sel) html = `${AK[EDIT.area.objs[EDIT.sel].kind].rot ? '<button class="btn" data-f="turn">Turn</button>' : ''}<button class="btn" data-f="dup">Copy</button><button class="btn danger" data-f="del">Remove</button><button class="btn" data-f="more">Details</button>`;
  }
  if (html !== EDIT.fabHtml) { EDIT.fabHtml = html; box.innerHTML = html; box.hidden = !html; }
}
function edHint() {
  if (!EDIT.ui) return;
  edFab();
  const T = EDIT.tool, a = EDIT.area;
  let s;
  if (edTouchUI() && matchMedia('(pointer: coarse)').matches) {   // no keys on a phone: say what the fingers do
    if (T && T.multi) s = T.pts.length ? `${T.pts.length} point${T.pts.length > 1 ? 's' : ''} · tap for more, then Finish` : `Tap along the ground to lay out the ${AK[T.kind].label.toLowerCase()}`;
    else if (T) s = `Tap the ground to place ${T.variant ? T.variant + ' ' : ''}${AK[T.kind].label.toLowerCase()}`;
    else if (!a) s = 'Tap ＋ to pick something, then tap the ground';
    else s = EDIT.sel >= 0 ? 'Drag it to move it' : 'Tap a thing to select it · drag to look around · pinch to zoom';
    EDIT.ui.hint.innerHTML = s; return;
  }
  if (T && T.multi) s = T.pts.length ? `${T.pts.length} point${T.pts.length > 1 ? 's' : ''} · click for more · <kbd>Enter</kbd> finishes · <kbd>Backspace</kbd> takes one back` : `Click along the ground to lay out the ${AK[T.kind].label.toLowerCase()}, point by point`;
  else if (T) s = `Click to place ${T.variant ? T.variant + ' ' : ''}${AK[T.kind].label.toLowerCase()} · <kbd>R</kbd> turns it${T.rot ? ' (' + T.rot + '°)' : ''} · <kbd>Esc</kbd> stops`;
  else if (!a) s = 'Pick something on the left and click the ground — a new area starts where you place it';
  else s = EDIT.sel >= 0 ? 'Drag to move · <kbd>R</kbd> turn · <kbd>Del</kbd> remove · <kbd>Ctrl</kbd>+<kbd>D</kbd> copy · <kbd>Esc</kbd> deselect' : 'Click a thing to select it · drag the ground to look around · right-drag to turn';
  EDIT.ui.hint.innerHTML = s;
}
function edHoverTip(h) {
  const tip = EDIT.ui.tip;
  if (!h) { tip.hidden = true; return; }
  const K = AK[h.obj.kind];
  tip.innerHTML = `<b>${escH(h.obj.name || K.label)}</b><span>${escH(K.variants ? h.obj.variant : K.label.toLowerCase())}${h.area !== EDIT.area ? ' · ' + escH(h.area.hdr.name) : ''}</span>${h.err ? `<em>${escH(h.err)}</em>` : ''}`;
  tip.hidden = false;
  tip.style.left = Math.min(innerWidth - 220, EDIT.mx + 16) + 'px'; tip.style.top = (EDIT.my + 14) + 'px';
}

// ---- the inspector -------------------------------------------------------------------------------------------------------------
function edRenderInspector() {
  const box = EDIT.ui.insp, a = EDIT.area;
  box.innerHTML = '';
  if (EDIT.tool) return edToolInspector(box);
  if (!a) {
    box.innerHTML = AREAS.list.length
      ? `<div class="ed-empty"><p>None of your places is here.</p><p>Choose one from the list at the top to go to it, or pick something on the left and click the ground to start a new place right here. There’s also <button class="btn" id="edEx">an example hamlet</button> to take apart.</p></div>`
      : `<div class="ed-empty"><p>You haven’t made any places yet.</p><p>Choose something from the list on the left and click the ground: a new place begins wherever you put it. Or start from <button class="btn" id="edEx">an example hamlet</button>.</p></div>`;
    $('edEx').addEventListener('click', () => edNewArea('example'));
    return;
  }
  const o = a.objs[EDIT.sel];
  if (!o) return edAreaInspector(box, a);
  const K = AK[o.kind], h = a.handles.find(x => x.obj === o);
  const head = document.createElement('div'); head.className = 'ed-ihead';
  head.innerHTML = `<span class="ed-iicon">${edIcon(K.icon)}</span><div><div class="ed-ikind">${escH(K.label)}</div><div class="ed-idesc">${escH(K.desc)}</div></div>`;
  box.appendChild(head);
  if (h && h.err) { const e = document.createElement('div'); e.className = 'ed-ierr'; e.textContent = 'It couldn’t be built: ' + h.err; box.appendChild(e); }
  const f = document.createElement('div'); f.className = 'ed-fields'; box.appendChild(f);
  const set = (fn, delay) => { const c = edObjCopy(EDIT.sel); fn(c); clearTimeout(EDIT.inspT); const go = () => edReplaceObj(EDIT.area.objs.indexOf(o) >= 0 ? EDIT.area.objs.indexOf(o) : EDIT.sel, c); if (delay) EDIT.inspT = setTimeout(go, delay); else go(); };
  if (K.variants) f.appendChild(edField('kind', edChoice(K.variants, o.variant || K.def, v => { (EDIT.lastVar ||= {})[K.name] = v; set(c => { c.variant = v; if (K.name === 'house') { delete c.p.size; delete c.p.roof; delete c.p.wall; delete c.p.roofcolor; delete c.p.door; } }); })));
  if (K.named) f.appendChild(edField('name', edInput('text', o.name, v => set(c => { c.name = v.trim(); }, 500), { placeholder: K.name === 'npc' ? 'Stranger' : 'no name' })));
  if (!K.multi) {
    const at = o.p.at || [0, 0], row = document.createElement('div'); row.className = 'ed-row2';
    row.appendChild(edNum(at[0], -400, 400, EDIT.snap || 0.1, v => set(c => { c.p.at = [v, c.p.at[1]]; }, 300), 'east'));
    row.appendChild(edNum(at[1], -400, 400, EDIT.snap || 0.1, v => set(c => { c.p.at = [c.p.at[0], v]; }, 300), 'south'));
    f.appendChild(edField('at', row));
  }
  if (K.rot) f.appendChild(edField('rot', edRot(o.p.rot || 0, v => set(c => { if (v) c.p.rot = v; else delete c.p.rot; }, 120))));
  if (K.scale) f.appendChild(edField('scale', edSlider(o.p.scale ?? K.scale.def, K.scale, v => set(c => { c.p.scale = v; }, 250))));
  if (K.lift) f.appendChild(edField('lift', edSlider(o.p.y ?? 0, K.keys.y, v => set(c => { if (v) c.p.y = v; else delete c.p.y; }, 250))));
  const P = aprops(o);
  for (const [k, sp] of Object.entries(K.props)) {
    const lab = sp.label || k;
    if (k === 'roam' && P.mode !== 'wander') continue;
    if (k === 'route' && P.mode !== 'patrol') continue;
    const cur = P[k];
    let ctl = null;
    if (sp.t === 'num' || sp.t === 'int') ctl = edSlider(cur, sp, v => set(c => { c.p[k] = v; }, 250));
    else if (sp.t === 'enum') ctl = edChoice(sp.opts, cur, v => set(c => { c.p[k] = v; }));
    else if (sp.t === 'color') ctl = edColor(cur, sp.none, v => set(c => { if (v === null) delete c.p[k]; else c.p[k] = v; }, 200));
    else if (sp.t === 'text') ctl = edInput('text', cur || '', v => set(c => { if (v.trim()) c.p[k] = v; else delete c.p[k]; }, 500));
    else if (sp.t === 'size') { ctl = document.createElement('div'); ctl.className = 'ed-row2'; ctl.appendChild(edNum(cur[0], sp.min[0], sp.max[0], 0.5, v => set(c => { c.p[k] = [v, (c.p[k] || cur)[1]]; }, 300), 'wide')); ctl.appendChild(edNum(cur[1], sp.min[1], sp.max[1], 0.5, v => set(c => { c.p[k] = [(c.p[k] || cur)[0], v]; }, 300), 'deep')); }
    else if (sp.t === 'lines') ctl = edLinesCtl((o.p[k] || []).map(s => [null, s]), false, L => set(c => { if (L.length) c.p[k] = L.map(x => x[1]); else delete c.p[k]; }, 500));
    else if (sp.t === 'script') ctl = edLinesCtl(o.p[k] || [], true, L => set(c => { if (L.length) c.p[k] = L; else delete c.p[k]; }, 500));
    else if (sp.t === 'points') { ctl = document.createElement('div'); ctl.className = 'ed-note'; ctl.textContent = (o.p[k] || []).length ? `${o.p[k].length} points` : 'none yet — write them in the text: route 0,0 6,0 6,6'; }
    if (ctl) f.appendChild(edField(lab, ctl, sp.t === 'lines' || sp.t === 'script'));
  }
  if (K.multi) {
    const n = (o.p.points || []).length, note = document.createElement('div'); note.className = 'ed-note';
    note.innerHTML = `${n} points. Drag the dots in the view to bend it.`;
    const add = document.createElement('button'); add.className = 'btn'; add.textContent = 'Add a point'; add.addEventListener('click', () => set(c => { const p = c.p.points, l = p[p.length - 1], q = p[p.length - 2] || [l[0] - 3, l[1]]; p.push([edSnap(l[0] + (l[0] - q[0])), edSnap(l[1] + (l[1] - q[1]))]); }));
    const rem = document.createElement('button'); rem.className = 'btn'; rem.textContent = 'Remove last'; rem.disabled = n <= 2; rem.addEventListener('click', () => set(c => { c.p.points.pop(); }));
    const row = document.createElement('div'); row.className = 'ed-btns'; row.append(add, rem); note.appendChild(row);
    f.appendChild(edField('points', note));
  }
  const btns = document.createElement('div'); btns.className = 'ed-btns ed-foot';
  btns.innerHTML = `<button class="btn" data-a="dup" title="Ctrl+D">Duplicate</button><button class="btn" data-a="focus" title="F">Look at it</button><button class="btn danger" data-a="del" title="Delete">Remove</button>`;
  btns.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'dup') edDuplicate(); if (b.dataset.a === 'del') edDeleteSel(); if (b.dataset.a === 'focus') { const hh = edSelHandle(); if (hh && hh.anchor) edFly(hh.anchor.x, hh.anchor.z, Math.max(14, hh.anchor.r * 4)); } });
  box.appendChild(btns);
}
function edToolInspector(box) {
  const T = EDIT.tool, K = AK[T.kind];
  const head = document.createElement('div'); head.className = 'ed-ihead';
  head.innerHTML = `<span class="ed-iicon">${edIcon(K.icon)}</span><div><div class="ed-ikind">${escH(K.label)}</div><div class="ed-idesc">${escH(K.desc)}</div></div>`;
  box.appendChild(head);
  const f = document.createElement('div'); f.className = 'ed-fields'; box.appendChild(f);
  if (K.variants) f.appendChild(edField('kind', edChoice(K.variants, T.variant || K.def, v => { T.variant = v; (EDIT.lastVar ||= {})[K.name] = v; edRollLooks(T); edGhostClear(); edHint(); })));
  if (K.rot && !K.multi) f.appendChild(edField('turn', edRot(T.rot || 0, v => { T.rot = v; edGhostClear(); edHint(); })));
  const n = document.createElement('p'); n.className = 'ed-note';
  n.innerHTML = K.multi ? 'Click along the ground to set its points, then press <kbd>Enter</kbd> (or double-click). <kbd>Backspace</kbd> takes back the last point.'
    : K.sticky ? 'Click the ground as many times as you like' + (K.plant ? ' — each comes out with its own shape and turn, unless you set one here' : '') + '. <kbd>Esc</kbd> or right-click when you’re done.' : 'Click the ground to place it. You can change everything about it afterwards.';
  f.appendChild(n);
  const b = document.createElement('div'); b.className = 'ed-btns ed-foot';
  const stop = document.createElement('button'); stop.className = 'btn'; stop.textContent = K.multi && T.pts.length >= 2 ? 'Finish' : 'Stop placing';
  stop.addEventListener('click', () => { if (K.multi && T.pts.length >= 2) edFinishLine(); else edSetTool(null); });
  b.appendChild(stop); box.appendChild(b);
}
function edCount(kind, n) {   // "2 houses", "a clearing", "chickens ×2"
  const l = AK[kind].label.toLowerCase();
  if (kind === 'clear') return n > 1 ? n + ' clearings' : 'a clearing';
  if (kind === 'flatten') return n > 1 ? n + ' levelled patches' : 'a levelled patch';
  if (kind === 'npc') return n > 1 ? n + ' people' : '1 person';
  if (/s$/.test(l) || kind === 'sheep') return n > 1 ? `${l} ×${n}` : l;   // already a crowd: reeds, chickens, candles…
  return n > 1 ? n + ' ' + l + (/(ch|sh|x)$/.test(l) ? 'es' : 's') : '1 ' + l;
}
function edAreaInspector(box, a) {
  const hd = a.hdr;
  const head = document.createElement('div'); head.className = 'ed-ihead';
  const counts = {}; for (const o of a.objs) counts[o.kind] = (counts[o.kind] || 0) + 1;
  head.innerHTML = `<span class="ed-iicon">${edIcon('area')}</span><div><div class="ed-ikind">${escH(hd.name)}</div><div class="ed-idesc">${a.objs.length ? a.objs.length + (a.objs.length > 1 ? ' things · ' : ' thing · ') + Object.entries(counts).slice(0, 4).map(([k, n]) => edCount(k, n)).join(', ') + (Object.keys(counts).length > 4 ? '…' : '') : 'Nothing here yet. Pick something on the left.'}</div></div>`;
  box.appendChild(head);
  const f = document.createElement('div'); f.className = 'ed-fields'; box.appendChild(f);
  const setH = (fn, delay) => { clearTimeout(EDIT.inspT); const go = () => { const h2 = { ...a.hdr }; fn(h2); const L = edLines(a); if (a.hdr.line !== undefined && /^\s*area\b/i.test(L[a.hdr.line] || '')) L[a.hdr.line] = aheader(h2); else L.unshift(aheader(h2)); edCommit(L.join('\n'), { sel: -1 }); }; if (delay) EDIT.inspT = setTimeout(go, delay); else go(); };
  f.appendChild(edField('area name', edInput('text', hd.name, v => setH(h => { h.name = v.trim() || 'Unnamed place'; }, 600))));
  f.appendChild(edField('subtitle', edInput('text', hd.title, v => setH(h => { h.title = v.trim(); }, 600), { placeholder: 'shown under the name as you arrive' })));
  f.appendChild(edField('radius', edSlider(hd.r, { min: 4, max: 120, step: 1, t: 'num', unit: ' m' }, v => setH(h => { h.r = v; }, 250))));
  const row = document.createElement('div'); row.className = 'ed-row2';
  row.appendChild(edNum(hd.x, -200, 200, 1, v => setH(h => { h.x = v; }, 500), 'east')); row.appendChild(edNum(hd.z, -200, 200, 1, v => setH(h => { h.z = v; }, 500), 'south'));
  f.appendChild(edField('centre', row));
  const note = document.createElement('p'); note.className = 'ed-note'; note.innerHTML = 'Drag the gold pin in the middle to move the whole area. Things keep their places relative to it.';
  f.appendChild(note);
  const btns = document.createElement('div'); btns.className = 'ed-btns ed-foot';
  btns.innerHTML = `<button class="btn" data-a="go">Look at the middle</button><button class="btn danger" data-a="del">Delete this area…</button>`;
  btns.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'go') edFly(hd.x, hd.z, Math.max(30, hd.r * 1.6)); if (b.dataset.a === 'del') edConfirmDelete(a); });
  box.appendChild(btns);
}
function edField(label, ctl, wide) { const d = document.createElement('div'); d.className = 'ed-field' + (wide ? ' wide' : ''); const l = document.createElement('label'); l.textContent = label; d.append(l, ctl); return d; }
function edInput(type, val, on, o = {}) { const i = document.createElement('input'); i.type = type; i.value = val ?? ''; i.spellcheck = false; if (o.placeholder) i.placeholder = o.placeholder; i.addEventListener('input', () => on(i.value)); i.addEventListener('keydown', e => { if (e.key === 'Enter') i.blur(); }); return i; }
function edNum(val, min, max, step, on, unit) {
  const w = document.createElement('div'); w.className = 'ed-num';
  const i = document.createElement('input'); i.type = 'number'; i.value = fnum(val); i.min = min; i.max = max; i.step = step;
  i.addEventListener('input', () => { const v = parseFloat(i.value); if (!isNaN(v)) on(clamp(v, min, max)); });
  i.addEventListener('keydown', e => { if (e.key === 'Enter') i.blur(); });
  w.appendChild(i); if (unit) { const u = document.createElement('span'); u.textContent = unit; w.appendChild(u); }
  return w;
}
function edSlider(val, sp, on) {
  const w = document.createElement('div'); w.className = 'ed-slider';
  const r = document.createElement('input'); r.type = 'range'; r.min = sp.min; r.max = sp.max; r.step = sp.step || (sp.t === 'int' ? 1 : 0.1); r.value = val;
  const n = document.createElement('input'); n.type = 'number'; n.min = sp.min; n.max = sp.max; n.step = r.step; n.value = fnum(val);
  r.addEventListener('input', () => { n.value = r.value; on(+r.value); });
  n.addEventListener('input', () => { const v = parseFloat(n.value); if (!isNaN(v)) { r.value = v; on(clamp(v, sp.min, sp.max)); } });
  n.addEventListener('keydown', e => { if (e.key === 'Enter') n.blur(); });
  w.append(r, n);
  return w;
}
function edRot(val, on) {
  const w = document.createElement('div'); w.className = 'ed-rot';
  const dial = document.createElement('div'); dial.className = 'ed-dial'; dial.title = 'Drag to turn';
  dial.innerHTML = '<span class="n">N</span><span class="e">E</span><span class="s">S</span><span class="w">W</span><i></i>';
  const needle = dial.querySelector('i');
  // on the map north is up: rot 0 faces south (down), 90 east (right)
  const show = v => { needle.style.transform = `rotate(${-v}deg)`; };
  const n = document.createElement('input'); n.type = 'number'; n.min = 0; n.max = 359; n.step = 15; n.value = Math.round(val);
  const setv = v => { v = ((Math.round(v) % 360) + 360) % 360; n.value = v; show(v); on(v); };
  show(val);
  const fromEv = e => { const r = dial.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); let deg = Math.atan2(dx, dy) * 180 / Math.PI; deg = (deg + 360) % 360; if (!e.shiftKey) deg = Math.round(deg / 15) * 15; setv(deg); };
  dial.addEventListener('pointerdown', e => { dial.setPointerCapture(e.pointerId); fromEv(e); dial.onpointermove = fromEv; });
  dial.addEventListener('pointerup', () => { dial.onpointermove = null; });
  n.addEventListener('input', () => { const v = parseFloat(n.value); if (!isNaN(v)) setv(v); });
  const l = document.createElement('button'); l.className = 'btn'; l.textContent = '↺'; l.title = 'Turn left 15° (Shift+R)'; l.addEventListener('click', () => setv(+n.value - 15));
  const r = document.createElement('button'); r.className = 'btn'; r.textContent = '↻'; r.title = 'Turn right 15° (R)'; r.addEventListener('click', () => setv(+n.value + 15));
  w.append(dial, l, n, r);
  return w;
}
function edChoice(opts, cur, on) {
  if (opts.length <= 4 && opts.join('').length <= 24) {
    const w = document.createElement('div'); w.className = 'ed-seg';
    for (const v of opts) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = v; b.setAttribute('aria-pressed', v === cur); b.addEventListener('click', () => { for (const x of w.children) x.setAttribute('aria-pressed', x === b); on(v); }); w.appendChild(b); }
    return w;
  }
  const s = document.createElement('select'); s.innerHTML = opts.map(v => `<option${v === cur ? ' selected' : ''}>${v}</option>`).join('');
  s.addEventListener('change', () => { on(s.value); s.blur(); });
  return s;
}
function edColor(cur, none, on) {
  const w = document.createElement('div'); w.className = 'ed-color';
  const c = document.createElement('input'); c.type = 'color'; c.value = cur || '#8a6a48';
  const t = document.createElement('input'); t.type = 'text'; t.value = cur || ''; t.placeholder = none ? 'none' : ''; t.maxLength = 7; t.spellcheck = false;
  c.addEventListener('input', () => { t.value = c.value; on(c.value); });
  t.addEventListener('input', () => { const v = t.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) { c.value = v; on(v.toLowerCase()); } else if (!v && none) on(null); });
  w.append(c, t);
  if (none) { const x = document.createElement('button'); x.className = 'btn'; x.textContent = 'none'; x.addEventListener('click', () => { t.value = ''; on(null); }); w.appendChild(x); }
  return w;
}
function edLinesCtl(list, script, on) {
  const w = document.createElement('div'); w.className = 'ed-lines';
  const L = list.map(x => x.slice());
  const draw = () => {
    w.innerHTML = '';
    L.forEach((it, i) => {
      const row = document.createElement('div'); row.className = 'ed-line';
      if (script) { const who = document.createElement('button'); who.className = 'btn who'; who.textContent = it[0] === 'reply' ? 'you' : 'they'; who.title = 'Who says it'; who.addEventListener('click', () => { it[0] = it[0] === 'reply' ? 'say' : 'reply'; who.textContent = it[0] === 'reply' ? 'you' : 'they'; on(L); }); row.appendChild(who); }
      const inp = document.createElement('input'); inp.type = 'text'; inp.value = it[1]; inp.addEventListener('input', () => { it[1] = inp.value; on(L.filter(x => x[1].trim())); });
      const x = document.createElement('button'); x.className = 'btn'; x.textContent = '✕'; x.title = 'Remove'; x.addEventListener('click', () => { L.splice(i, 1); on(L); draw(); });
      row.append(inp, x); w.appendChild(row);
    });
    const add = document.createElement('button'); add.className = 'btn ed-add'; add.textContent = script ? '＋ Add a line' : '＋ Add a line';
    add.addEventListener('click', () => { L.push([script ? (L.length && L[L.length - 1][0] === 'say' ? 'reply' : 'say') : null, '']); draw(); w.querySelectorAll('input')[L.length - 1]?.focus(); });
    w.appendChild(add);
  };
  draw();
  return w;
}

// ---- the text panel -----------------------------------------------------------------------------------------------------------
function edSetTextarea() {
  const ta = EDIT.ui.ta, a = EDIT.area, v = a ? a.text : '';
  if (ta.value !== v) { const st = ta.scrollTop, sl = ta.scrollLeft, ss = ta.selectionStart, se = ta.selectionEnd; ta.value = v; ta.scrollTop = st; ta.scrollLeft = sl; if (document.activeElement === ta) ta.setSelectionRange(Math.min(ss, v.length), Math.min(se, v.length)); }
  ta.disabled = !a;
  edHighlight();
  const so = a && a.objs[EDIT.sel]; edKeyHelp(so ? so.kind : undefined);
}
function edApplyText() {
  clearTimeout(EDIT.textT); EDIT.textT = null;
  const a = EDIT.area, ta = EDIT.ui.ta; if (!a || ta.value === a.text) return;
  AREAS.setText(a, ta.value);
  edPushHist(a);
  if (EDIT.sel >= a.objs.length) EDIT.sel = -1;
  edAreaSelect(); edRenderInspector(); edHighlight(); edRebuildOv();
}
function edFlushText() { if (EDIT.textT) edApplyText(); }
const ED_KEYW = new Set();
function edHighlight() {
  const ui = EDIT.ui, a = EDIT.area, text = ui.ta.value, lines = text.split('\n');
  const errs = a && text === a.text ? a.errs : [];
  const byLine = new Map(); for (const e of errs) { const L = byLine.get(e.line) || []; L.push(e); byLine.set(e.line, L); }
  let html = '', gut = '';
  let kindHere = null;
  lines.forEach((ln, li) => {
    const { toks, comment } = atokenize(ln);
    const marks = byLine.get(li) || [];
    const first = toks[0], indented = /^[ \t]/.test(ln);
    if (first && first.t === 'word' && !indented) kindHere = AK[first.v] || AK[AKA[first.v]] || null;
    const K = kindHere;
    let out = '', pos = 0;
    const cls = (t, i) => {
      if (t.t === 'num') return 'n'; if (t.t === 'str') return 's'; if (t.t === 'col') return 'c';
      if (i === 0 && !indented) return t.v === 'area' ? 'a' : (AK[t.v] || AK[AKA[t.v]]) ? 'k' : 'x';
      if (K && ((K.variants || []).includes(t.v) || K.bare[t.v])) return 'v';
      if (K && (K.keys[t.v] || K.keys[K.alias[t.v]])) return 'p';
      if (!K && ['at', 'radius', 'title'].includes(t.v)) return 'p';
      if (K) for (const sp of Object.values(K.props)) if (sp.t === 'enum' && sp.opts.includes(t.v)) return 'v';
      if (AC_NAMES[t.v]) return 'v';
      return 'w';
    };
    toks.forEach((t, i) => {
      out += escH(ln.slice(pos, t.c0));
      const bad = marks.some(m => !m.warn && m.c0 <= t.c0 && m.c1 >= t.c1 && m.c1 > m.c0);
      const warn = marks.some(m => m.warn && m.c0 <= t.c0 && m.c1 >= t.c1 && m.c1 > m.c0);
      const st = t.t === 'col' ? ` style="--sw:${t.v}"` : '';
      out += `<span class="${cls(t, i)}${bad ? ' e' : warn ? ' wn' : ''}"${st}>${escH(ln.slice(t.c0, t.c1))}</span>`;
      pos = t.c1;
    });
    if (comment) { out += escH(ln.slice(pos, comment.c0)) + `<span class="m">${escH(comment.text)}</span>`; }
    else out += escH(ln.slice(pos));
    html += `<div class="l" data-l="${li}">${out || ' '}</div>`;
    gut += `<div class="${marks.some(m => !m.warn) ? 'bad' : marks.length ? 'warn' : ''}">${li + 1}</div>`;
  });
  ui.hl.innerHTML = `<div class="hl-in">${html}</div>`;
  ui.gut.innerHTML = gut;
  const ls = ui.hl.querySelectorAll('.l'), gs = ui.gut.children;
  for (let i = 0; i < ls.length; i++) { const hh = ls[i].offsetHeight; if (hh > 19 && gs[i]) gs[i].style.height = hh + 'px'; }
  ui.gut.style.paddingBottom = (ui.ta.scrollHeight > ui.ta.clientHeight ? 40 : 8) + 'px';
  ui.hl.scrollTop = ui.ta.scrollTop; ui.hl.scrollLeft = ui.ta.scrollLeft; ui.gut.scrollTop = ui.ta.scrollTop;
  edCodeMarks(true);
  // the problems, listed under the text
  const E = ui.errs;
  if (!errs.length) { E.innerHTML = a && text === a.text ? '<div class="ok">No problems.</div>' : '<div class="wait">…</div>'; $('edErrN').textContent = ''; }
  else {
    E.innerHTML = errs.slice(0, 30).map(e => `<button class="err${e.warn ? ' warn' : ''}" data-line="${e.line}"><span>${e.line + 1}</span>${escH(e.msg)}</button>`).join('');
    const nb = errs.filter(e => !e.warn).length; $('edErrN').textContent = nb ? nb + (nb === 1 ? ' problem' : ' problems') : errs.length + ' note' + (errs.length > 1 ? 's' : '');
  }
}
function edCodeMarks(noHl) {   // shade the selected object's lines
  const ui = EDIT.ui, a = EDIT.area; if (!ui) return;
  for (const d of ui.hl.querySelectorAll('.l.sel')) d.classList.remove('sel');
  const o = a && a.objs[EDIT.sel];
  if (o && ui.ta.value === a.text) for (let li = o.line0; li <= o.line1; li++) ui.hl.querySelector(`.l[data-l="${li}"]`)?.classList.add('sel');
}
const edLineTop = li => { const el = EDIT.ui.hl.querySelector(`.l[data-l="${li}"]`); return el ? el.offsetTop : li * 19; };
function edRevealLine() {
  const a = EDIT.area, o = a && a.objs[EDIT.sel], ta = EDIT.ui.ta; if (!o) return;
  const top = edLineTop(o.line0), bot = edLineTop(o.line1 + 1) || top + 19;
  if (top < ta.scrollTop + 8 || bot > ta.scrollTop + ta.clientHeight - 8) ta.scrollTop = Math.max(0, top - ta.clientHeight * 0.35);
  EDIT.ui.hl.scrollTop = ta.scrollTop; EDIT.ui.gut.scrollTop = ta.scrollTop;
}
function edGotoLine(li) {
  const ta = EDIT.ui.ta, L = ta.value.split('\n'); let p = 0; for (let i = 0; i < li && i < L.length; i++) p += L[i].length + 1;
  ta.focus(); ta.setSelectionRange(p, p + (L[li] || '').length);
  ta.scrollTop = Math.max(0, edLineTop(li) - ta.clientHeight * 0.35);
}

// ---- export, import, help, confirm ---------------------------------------------------------------------------------------------
function edModal(title, html, wide) {
  const m = $('edModal');
  m.querySelector('.ed-mtitle').textContent = title;
  const body = m.querySelector('.ed-mbody'), inner = document.createElement('div');
  inner.innerHTML = html; body.replaceChildren(inner);
  m.querySelector('.ed-sheet').classList.toggle('wide', !!wide);
  m.hidden = false; EDIT.modal = true;
  return inner;
}
function edCloseModal() { const m = $('edModal'); if (m) m.hidden = true; EDIT.modal = false; }
function edAllText() { return AREAS.list.map(a => a.text.replace(/\s*$/, '')).join('\n\n') + '\n'; }
function edExport() {
  const text = edAllText();
  const b = edModal('Export your areas', `<p class="ed-mnote">All ${AREAS.list.length} of your areas as text. Keep it somewhere safe, or give it to a friend to import.</p><textarea class="ed-mtext" readonly spellcheck="false"></textarea><div class="ed-btns"><button class="go" data-x="copy">Copy to clipboard</button><button class="btn" data-x="dl">Download .txt</button></div>`);
  const ta = b.querySelector('textarea'); ta.value = text;
  b.addEventListener('click', async e => {
    const x = e.target.closest('[data-x]')?.dataset.x;
    if (x === 'copy') { ta.select(); let ok = false; try { await navigator.clipboard.writeText(text); ok = true; } catch (er) { try { ok = document.execCommand('copy'); } catch (er2) { ok = false; } } e.target.textContent = ok ? 'Copied' : 'Select the text and copy it'; }
    if (x === 'dl') {
      const dl = await edDownloads();
      if (dl) {   // inside the claude.ai viewer: it asks the player, then saves
        try { await dl.save({ filename: 'emberwick-areas.txt', data: text }); dlBtn.textContent = 'Saved'; }
        catch (er) { if (er && er.code === 'declined') return; dlBtn.textContent = er && er.code === 'rate_limited' ? 'Try again in a moment' : 'Can’t save here — copy it instead'; }
        return;
      }
      if (dl === null || window.top !== window) return;
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); const l = document.createElement('a'); l.href = url; l.download = 'emberwick-areas.txt'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  });
  const dlBtn = b.querySelector('[data-x="dl"]');
  edDownloads().then(dl => { if (dl === null || (dl === undefined && window.top !== window)) dlBtn.hidden = true; });   // a framed page can't hand out files without the viewer's help; copying still works
}
// saving a file: the claude.ai viewer offers it through its downloads capability (null there = not possible in this view);
// a copy of the page opened on its own has no window.claude and just uses a download link (undefined)
function edDownloads() {
  if (!EDIT.dlP) {
    let p = Promise.resolve(undefined);
    try { if (window.claude && typeof window.claude.use === 'function') p = Promise.resolve(window.claude.use('downloads')).catch(() => null); } catch (er) { p = Promise.resolve(null); }
    EDIT.dlP = p;
  }
  return EDIT.dlP;
}
function edSplitAreas(text) {   // one chunk of text per area line
  const L = text.replace(/\r/g, '').split('\n'), out = []; let cur = [];
  for (const ln of L) { if (/^area\b/i.test(ln) && cur.some(x => /^area\b/i.test(x))) { out.push(cur.join('\n')); cur = []; } cur.push(ln); }
  if (cur.join('').trim()) out.push(cur.join('\n'));
  return out.filter(t => /^area\b/im.test(t));
}
function edImport() {
  const b = edModal('Import areas', `<p class="ed-mnote">Paste text from an export. Each <code>area</code> line starts a new area; they’re added alongside the ones you have.</p><textarea class="ed-mtext" spellcheck="false" placeholder='area "Somewhere" at 40, 60 radius 24&#10;house cottage at 0, 0'></textarea><div class="ed-btns"><button class="go" data-x="go">Add these areas</button><span class="ed-mmsg"></span></div>`);
  const ta = b.querySelector('textarea'); setTimeout(() => ta.focus(), 30);
  b.querySelector('[data-x="go"]').addEventListener('click', () => {
    const chunks = edSplitAreas(ta.value);
    if (!chunks.length) { b.querySelector('.ed-mmsg').textContent = 'There’s no line starting with “area” in that.'; return; }
    let last = null;
    for (let t of chunks) {
      const P = aparse(t); let nm = P.hdr ? P.hdr.name : 'Imported'; const base = nm; let k = 2;
      while (AREAS.list.some(a => a.hdr && a.hdr.name === nm)) nm = `${base} (${k++})`;
      if (nm !== base) t = t.replace(/^area\s+("(?:[^"\\]|\\.)*"|\S+)/im, 'area ' + fq(nm));
      last = AREAS.add(t);
    }
    initGlows();
    edCloseModal();
    edSetArea(last);
    UI.toast('Imported', `${chunks.length} area${chunks.length > 1 ? 's' : ''} added.`, 'done', 3);
  });
}
function edConfirmDelete(a) {
  const b = edModal('Delete this area?', `<p class="ed-mnote">“${escH(a.hdr.name)}” and everything in it (${a.objs.length} things) will be gone from your game. There’s no undo for this — export first if you might want it back.</p><div class="ed-btns"><button class="btn danger" data-x="del">Delete it</button><button class="btn" data-edclose>Keep it</button></div>`);
  b.querySelector('[data-x="del"]').addEventListener('click', () => { AREAS.remove(a); EDIT.hist.delete(a.id); edCloseModal(); edSetArea(AREAS.list[AREAS.list.length - 1] || null, { fly: false }); });
}
// under the text: what the thing on the caret's line can be told
function edKeySig(K) {
  return K.korder.map(k => { const sp = K.keys[k]; if (k === 'at') return 'at x, z'; if (k === 'rot') return 'rot °'; if (k === 'y') return 'y lift';
    if (sp.t === 'enum') return sp.bare ? sp.opts.join('|') : `${k} ${sp.opts.join('|')}`; if (sp.t === 'script') return 'say "…" reply "…"';
    return `${k} ${sp.t === 'num' || sp.t === 'int' ? sp.min + '–' + sp.max : sp.t === 'size' ? 'WxD' : sp.t === 'color' ? '#hex' : sp.t === 'points' ? 'x,z x,z…' : '"…"'}`; }).join(' · ');
}
function edKeyHelp(kind) {
  const ui = EDIT.ui; if (!ui || !ui.keys) return;
  let w = kind;
  if (!w) {
    const ta = ui.ta, L = ta.value.split('\n'); let li = ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
    while (li > 0 && /^[ \t]/.test(L[li] || '')) li--;   // a carried-on line belongs to the one above
    w = (L[li] || '').trim().split(/\s+/)[0].toLowerCase();
  }
  const K = AK[w] || AK[AKA[w]];
  const html = w === 'area' ? '<b>area</b> "name" · at x, z · radius 4–120 · title "…"'
    : K ? `<b>${K.name}</b>${K.variants ? ' ' + K.variants.join('|') : ''}${K.named ? ' "name"' : ''} · ${escH(edKeySig(K))}`
      : 'Start a line with what it is: ' + ACATS.map(c => Object.values(AK).filter(k => k.cat === c).slice(0, 3).map(k => k.name).join(', ')).join(' · ') + '…';
  if (html !== EDIT.keyHtml) { EDIT.keyHtml = html; ui.keys.innerHTML = html; }
}
function edHelp() {
  const kinds = ACATS.map(cat => `<h4>${cat}</h4>` + Object.values(AK).filter(K => K.cat === cat).map(K => {
    const keys = K.korder.filter(k => k !== 'at').map(k => { const sp = K.keys[k]; if (k === 'rot') return '<code>rot 0–359</code>'; if (k === 'y') return '<code>y 0–12</code> (lift)'; return sp.t === 'enum' ? `<code>${sp.bare ? sp.opts.join(' | ') : k + ' ' + sp.opts.join('|')}</code>` : sp.t === 'script' ? '<code>say "…"</code> <code>reply "…"</code>' : `<code>${k}${sp.t === 'num' || sp.t === 'int' ? ' ' + sp.min + '–' + sp.max : sp.t === 'size' ? ' WxD' : sp.t === 'color' ? ' #hex' : sp.t === 'points' ? ' x,z x,z…' : sp.t === 'lines' ? ' "…"' : sp.t === 'text' ? ' "…"' : ''}</code>`; }).join(' ');
    return `<div class="ed-hk"><b>${K.name}${K.variants ? ' <i>' + K.variants.join(' | ') + '</i>' : ''}${K.named ? ' <i>"name"</i>' : ''}</b><span>${escH(K.desc)}</span><span class="ed-hkeys">${keys}</span></div>`;
  }).join('')).join('');
  edModal('How areas are written', `
    <div class="ed-help">
      <section>
        <p>Each area is a few lines of text. The first line names it and says where it is; every other line is one thing in it — <em>what</em> it is, then <em>where</em> and <em>how</em>.</p>
<pre class="ed-pre">area "Hollyhock Green" at 92, 40 radius 26 title "a hamlet"
house cottage "Rose Cottage" at 4, -6 rot 90 hearth lit
npc "Old Tam" at 2, -2 look farmer
  say "Fine evening for it."
  reply "Is it always this quiet?"
tree oak at -8, 10 scale 1.2
path width 2.4 points 0,0 10,4 20,4   # a comment</pre>
        <ul>
          <li><code>at 4, -6</code> — metres from the area’s middle: 4 east, 6 north. <b>South is +</b>, north is −.</li>
          <li><code>rot 90</code> — turns it. At 0 its front (a house’s door) faces south; 90 east; 180 north; 270 west.</li>
          <li>Indented lines carry on the line above: what people <code>say</code>, what signs read (<code>text</code>).</li>
          <li><code>#</code> starts a comment. Colours are <code>#rrggbb</code> or a name like <code>red</code>.</li>
          <li>Things can be named in quotes. Names of fires become their labels; a wayfire’s name shows on the travel map.</li>
        </ul>
        <h4>In the view</h4>
        <ul>
          <li>Click something on the left, then the ground. <kbd>R</kbd> turns it first. <kbd>Esc</kbd> stops.</li>
          <li>The dashed ring is the area’s edge. Put something just outside it and the ring grows to fit; inside another area’s ring, it joins that one instead.</li>
          <li>Paths, fences, walls, hedges and lanterns: click point by point, <kbd>Enter</kbd> to finish.</li>
          <li>Click to select, drag to move, <kbd>Del</kbd> to remove, <kbd>Ctrl</kbd>+<kbd>D</kbd> to copy, <kbd>Ctrl</kbd>+<kbd>Z</kbd> to undo.</li>
          <li>Drag empty ground to slide the view, right-drag to turn it, wheel to zoom. <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> and <kbd>Q</kbd> <kbd>E</kbd> work too; <kbd>T</kbd> looks straight down; <kbd>F</kbd> finds the selection.</li>
          <li><kbd>F2</kbd> opens and closes the editor. Everything saves in this browser as you go.</li>
        </ul>
      </section>
      <section class="ed-kinds"><h3>Everything you can place</h3>${kinds}</section>
    </div>`, true);
}

// ---- for the map: what custom areas look like from above ---------------------------------------------------------------------------
function drawAreasOnMap(g, W, k, big) {
  if (!AREAS.list.length) return;
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const a of AREAS.list) for (const h of a.handles) {
    if (!h.o) continue;
    const kind = h.obj.kind;
    if (kind === 'path' && h.o.pts) { g.strokeStyle = 'rgba(160,128,86,0.9)'; g.lineWidth = h.o.P.width / k; g.beginPath(); h.o.pts.forEach((p, i) => { const q = W(p[0], p[1]); if (i) g.lineTo(...q); else g.moveTo(...q); }); g.stroke(); }
  }
  for (const a of AREAS.list) for (const h of a.handles) {
    if (!h.o) continue;
    const kind = h.obj.kind;
    if ((kind === 'fence' || kind === 'wall' || kind === 'hedgerow') && h.o.pts) { g.strokeStyle = kind === 'hedgerow' ? 'rgba(40,70,30,0.9)' : 'rgba(60,46,32,0.9)'; g.lineWidth = Math.max(1, 0.5 / k); g.beginPath(); h.o.pts.forEach((p, i) => { const q = W(p[0], p[1]); if (i) g.lineTo(...q); else g.moveTo(...q); }); g.stroke(); }
    if (h.building) { const b = h.building; g.beginPath(); b.footprint.forEach((p, i) => { const q = W(p[0], p[1]); if (i) g.lineTo(...q); else g.moveTo(...q); }); g.closePath(); g.fillStyle = '#' + col(b.mapColor).getHexString(); g.fill(); g.lineWidth = Math.max(1, 0.35 / k); g.strokeStyle = 'rgba(20,14,10,0.85)'; g.stroke(); }
    else if (kind === 'pond' && h.o) { g.fillStyle = 'rgba(70,130,160,0.85)'; g.beginPath(); g.arc(...W(h.o.x, h.o.z), h.o.P.radius * 0.85 / k, 0, TAU); g.fill(); }
    else if ((kind === 'tree' || kind === 'grove') && h.o) { g.fillStyle = 'rgba(30,50,24,0.55)'; const r = kind === 'grove' ? h.o.P.radius : 1.4 * h.o.s; g.beginPath(); g.arc(...W(h.o.x, h.o.z), r / k, 0, TAU); g.fill(); }
    else if (['well', 'stall', 'tent', 'campfire'].includes(kind)) { g.fillStyle = kind === 'campfire' ? '#e08a3a' : '#8a7a68'; g.beginPath(); g.arc(...W(h.o.x, h.o.z), 1.2 / k, 0, TAU); g.fill(); }
  }
  if (big) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const a of AREAS.list) {
      if (!a.hdr) continue;
      const [x, y] = W(a.hdr.x, a.hdr.z - a.hdr.r * 0.55);
      g.font = '700 20px "Alegreya Sans SC", sans-serif'; g.lineWidth = 5; g.strokeStyle = 'rgba(14,10,6,0.75)'; g.strokeText(a.hdr.name, x, y); g.fillStyle = '#ffd38a'; g.fillText(a.hdr.name, x, y);
    }
  }
  g.restore();
}

edBind();   // F2 works from the moment the game is up
