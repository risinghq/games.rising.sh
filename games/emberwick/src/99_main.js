// ============================================================================
//  Boot & main loop
// ============================================================================
const FPS = { ms: 16, acc: 0, n: 0, win: 0, cool: 3 };
const MAX_DPR = Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.75 : 2);
let READY = false;
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 46 : 36;
  camera.updateProjectionMatrix();
  PUni.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * DEG / 2));
}

const BOOT_T0 = performance.now();
const btime = (label) => console.debug(`[boot] ${label} ${((performance.now() - BOOT_T0) / 1000).toFixed(2)}s`);
async function boot() {
  const stage = $('stage');
  stage.appendChild(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.setPixelRatio(Math.min(MAX_DPR, IS_TOUCH ? 1.5 : 1.75));
  resize();
  addEventListener('resize', resize);
  applyTime(0);
  UI.init();
  UI.status('laying foundations · raising walls'); await nextFrame();
  buildVillage(); btime('buildVillage');
  defineVegKinds();
  buildRegionStructures(); btime('buildRegionStructures');
  UI.status('levelling the land'); await nextFrame();
  bakeTerrain(); btime('bakeTerrain');
  UI.status('cobbling the square · stringing lanterns'); await nextFrame();
  buildOutdoors(); btime('buildOutdoors');
  UI.status('ploughing the Southfields'); await nextFrame();
  buildSouthfields(); buildNorthWatch(); buildBeacons(); btime('buildSouthfields');
  UI.status('flooding the fen'); await nextFrame();
  buildFen(); btime('buildFen');
  UI.status('raising the barrows'); await nextFrame();
  buildDowns(); btime('buildDowns');
  UI.status('growing the Gloamwood'); await nextFrame();
  buildGloamwood(); btime('buildGloamwood');
  UI.status('planting the orchard'); await nextFrame();
  scatterVegetation(); btime('scatterVegetation');
  UI.status('raising the mountain'); await nextFrame();
  buildMountain(); buildCaveMouth(); buildIVeg(); btime('buildMountain');
  UI.status('shaping hills and the river'); await nextFrame();
  buildTerrain(); buildWater(); btime('buildTerrain');
  buildGrass(IS_TOUCH ? 0.55 : 1); btime('buildGrass');
  UI.status('merging geometry'); await nextFrame();
  for (const g of fadeGroups) { g.build(scene); for (const m of g.extra) scene.add(m); }
  OUT.build(scene, worldMat());
  VEG.build(scene, worldMat({ rough: 0.92 }));
  collectSurface(); btime('collectSurface');
  UI.status('digging the tunnels'); await nextFrame();
  buildUnderground(); btime('buildUnderground');
  UI.status('waking the villagers'); await nextFrame();
  spawnPeople(); spawnAnimals(); spawnUnderground(); spawnUgAnimals(); btime('spawnPeople');
  B.reset();
  ORB.e = addEmitter(0, 0, 0, { color: 0xa8dcff, int: 1.5, range: 6, flick: 0.05, glow: 0.5, prio: 4 });
  ORB.e.dynamic = true;
  UI.status('waking the story'); await nextFrame();
  initFires(); initMagic(); setupStory(); initMagicWorld(); btime('story');
  initParticles(); initGlows();
  UI.status('building your own places'); await nextFrame();
  try { AREAS.boot(); } catch (e) { console.error('custom areas', e); }
  btime('areas');
  teleportParty(-3.6, -14.4, 0); btime('initFx');
  bindInput(renderer.domElement);
  UI.buildPortraits(); btime('UI.buildPortraits');
  UI.buildMap(); btime('UI.buildMap');
  UI.status('compiling shaders'); await nextFrame();
  try { await renderer.compileAsync(scene, camera); } catch (e) { renderer.compile(scene, camera); }
  READY = true;
  UI.ready();
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  if (window.__hold) { last = now; return; }
  const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
  last = now;
  const t = (SU.uTime.value += dt);
  SU.uWind.value = 0.75 + 0.35 * Math.sin(t * 0.21) + 0.2 * Math.sin(t * 0.53 + 1.3);
  applyTime(dt);
  if (READY) step(dt, t);
  else updateCamera(dt);
  sky.position.copy(camera.position);
  renderer.render(scene, camera);
  // adaptive resolution
  FPS.ms = FPS.ms * 0.95 + dt * 1000 * 0.05;
  FPS.win += dt; FPS.cool -= dt;
  if (READY && FPS.win > 2 && FPS.cool < 0) {
    FPS.win = 0;
    const pr = renderer.getPixelRatio();
    if (FPS.ms > 26 && pr > 1) { renderer.setPixelRatio(Math.max(1, pr - 0.25)); resize(); FPS.cool = 3; }
    else if (FPS.ms < 13 && pr < MAX_DPR) { renderer.setPixelRatio(Math.min(MAX_DPR, pr + 0.25)); resize(); FPS.cool = 5; }
  }
}
const _focus0 = new V3(0, 0, 0);
function step(dt, t) {
  if (UI.paused) { updateCamera(dt); UI.update(dt, t); return; }
  updateWaits(dt);
  if (!EDIT.on) updateClock(dt);
  updateMovers(dt);
  updatePlayer(dt);
  updateCompanions(dt);
  updateNPCs(dt, t);
  updateAnimals(dt, t);
  updateDoors(dt);
  updateCutaway(dt);
  updateUnderground(dt);
  if (G.started && !EDIT.on) { updateMagic(dt, t); updateEnemies(dt, t); storyUpdate(dt, t); }
  else if (EDIT.on) updateFires(dt, t);
  if (EDIT.on) INTERACT.cur = null; else updateInteract();
  updateCamera(dt);
  updateOcclusionUniforms();
  DARK.k = dampf(DARK.k, DARK.to, 1.4, dt);
  updateLights(dt, t);
  updateEffects(dt, t);
  PS.n.update(dt, t); PS.a.update(dt, t);
  updateGlows(t);
  for (const a of ANIMS) a(dt, t);
  updateSun(CAM.intro ? _focus0 : CAM.tgt);
  AUDIO.update(dt);
  if (EDIT.on) updateEditor(dt, t);
  UI.update(dt, t);
}

// small debug surface (used by the engine panel, the tests, and handy from the console)
window.__ew = { THREE, pool, GRASS, HC, REG, WORLD, SITES, KFIRES, LAMPS, THORNS, STONESETS, IVEG, V, CUT, CAM, TIME, INPUT, teleportParty, fixPartyY, player: () => player, PARTY, CHARS, UI, renderer, scene, camera, fadeGroups, emitters, PHYS, UG, UGP, UGR, UGM, SU, MOUTH, terrainH, groundAt, ANIMALS,
  G: () => G, q, qSet, flag, setFlag, DLG, SCENE, COMBAT, MAGIC, STORY, STATE, FINALE, DARK, QUESTS, TALK, SPOTS, INTERACT, HATS, WISPS, BREAKABLES, REVEALS, CLOCK,
  fireById, setFireLit, cast, learn, giveSpark, giveHat, kindleFire, drawFlame, sceneField, askField, endGame, applyNPCState, placeFieldCrowd, FIELD, startTalk, interact, dlgAdvance, pickChoice, startGame, fastTravel, spawnEnemy, spawnBoss, killEnemy, hurtEnemy, N, AUDIO,
  walkTo: (x, z) => { INPUT.target = new V3(x, player.y, z); INPUT.goal = null; },
  sim: (sec, fn) => { const dt = 1 / 30; for (let i = 0; i < sec * 30; i++) { const t = (SU.uTime.value += dt); applyTime(dt); step(dt, t); if (fn && fn()) break; } return { x: +player.x.toFixed(2), y: +player.y.toFixed(2), z: +player.z.toFixed(2), b: CUT.b && CUT.b.id, f: CUT.f, ug: UG.zone, m: q('main'), scene: SCENE.name, dlg: DLG.active }; },
  KEYS, pipTest: pip, ugRegionAt, ugZoneAt, inCarve, AREAS, AK, EDIT, aparse, aserialize, AREA_EXAMPLE, areaTemplate, editOpen, editClose, edGround, edPick, edScreen, edSetTool, edPlaceAt, edAreaAt, edUndo, raiseStones, WATER_Y, castWisp, BASEVEG, PADS, PATHS, BUILDINGS, DOORS, SMOKES, FIRES, ANIMS, terrainRefresh, refreshGrass,
  // async run for the tests: steps the game, letting scenes and conversations move on between frames
  run: async (sec, o = {}) => {
    window.__hold = true; DLG.auto = !!o.auto; if (o.choices) DLG.autoQ = o.choices.slice();
    const dt = 1 / 30; let i = 0;
    try {
      for (; i < sec * 30; i++) {
        const t = (SU.uTime.value += dt); applyTime(dt); step(dt, t);
        for (let k = 0; k < 4; k++) await null;
        if (i % 45 === 44) await new Promise(r => setTimeout(r, 0));
        if (o.until && o.until()) break;
      }
    } finally { window.__hold = false; DLG.auto = false; }
    return { t: +(i / 30).toFixed(1), x: +player.x.toFixed(2), y: +player.y.toFixed(2), z: +player.z.toFixed(2), b: CUT.b && CUT.b.id, ug: UG.zone, m: q('main'), scene: SCENE.name, dlg: DLG.active, flame: +G.flame.toFixed(1), warm: +(player.warmth ?? 10).toFixed(1), log: DLG.log.slice(-3) };
  },
  render: () => { renderer.render(scene, camera); return 1; } };

addEventListener('visibilitychange', () => { if (document.hidden && G.started && !SCENE.active) saveGame(true); });
addEventListener('pagehide', () => { if (G.started && !SCENE.active) saveGame(true); });
requestAnimationFrame(frame);
boot().catch(err => { console.error(err); UI.status('Something went wrong while building the valley: ' + err.message); });
