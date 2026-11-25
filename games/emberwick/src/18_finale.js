// ============================================================================
//  MIDNIGHT — the Long Field, the Wood's coming, the choice, and the morning
// ============================================================================
const FINALE = { ring: [], battle: null, resolve: null };
const DARK = { k: 0, to: 0 };

async function askField() {
  STORY.lastFieldAsk = SU.uTime.value;
  let go = false;
  await cutscene('fieldAsk', async () => {
    await say('nar', `Thom is waiting beside the unlit bonfire, with the whole village around him and lanterns in their hands. Once you join him there, the night will end, one way or another.`);
    if (G.sparks.length < 7) await say(EL(), `You carry ${G.sparks.length} sparks. Whatever we choose, more would help. But the choice is yours.`);
    const i = await choose(['Walk out among them.', 'Not yet.']);
    go = i === 0;
  }, { noBars: true });
  if (go) sceneField();
  else { const B = SITES.bonfire, dx = player.x - B.x, dz = player.z - B.z, d = Math.hypot(dx, dz) || 1; INPUT.target = new V3(B.x + dx / d * 5.6, player.y, B.z + dz / d * 5.6); }   // a few steps back into the crowd
}
function spawnRing(n = 24) {
  const F = FIELD();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd(-0.1, 0.1), r = rnd(15, 18.5), x = F.x + Math.cos(a) * r, z = F.z + Math.sin(a) * r;
    const e = spawnEnemy(i % 6 === 0 ? 'shade' : 'gloamling', x, z, { zone: 'ring' });
    e.ring = { cx: F.x, cz: F.z, r, a, sp: rnd(0.03, 0.06) * (i % 2 ? 1 : -1) }; e.fade = 0;
    FINALE.ring.push(e);
  }
}
async function sceneField() {
  if (q('main') !== 14) return;
  const F = FIELD(), th = N('thom'), o = N('orrin'), rk = N('rook'), tr = N('troll');
  saveFieldCheckpoint();
  if (rk) putAt(rk, F.bx + 0.4, F.bz + 2.2, -PI * 0.75, { act: 'spear' });   // in from the watch, whatever became of it
  G.track = 'main';   // midnight is the only errand left
  qSet('main', 15, { quiet: true });
  CLOCK.frozen = true; TIME.h = 23.62; G.flags.noTravel = true;
  for (const e of COMBAT.enemies) if (e.alive) killEnemy(e, true);
  COMBAT.calm = true;
  if (G.flags.trollAwake && tr) trollToField(tr);
  await cutscene('field', async () => {
    AUDIO.forceMood = 'hush';
    await walkTo(player, F.bx + 1.3, F.bz + 2.4, { speed: 2.4 });
    face(player, th); face(th, player);
    camFocus(F.bx - 1, terrainH(F.bx, F.bz) + 1.4, F.bz + 1.5, 17);
    await say(th, `There you are.`);
    face(th, o);
    await say(th, `Orrin! You daft old— you're alive. You're ALIVE. And you have NO HAT ON.`);
    await say(o, `I've been in a pudding, Thom. Eleven Kindlings. Look at your hands. They're blue.`);
    await say(th, `And look at theirs.`);
    await say('nar', `He nods at the villagers behind him: Marta, Hilda, the twins, Sister Agnes. Their hands are pink with cold, and warm underneath.`);
    await say(th, `Every winter. Every one of them. That's what the stone is for.`);
    face(th, player);
    await say(th, `You have it. I can see it in your lantern; I'd know that light anywhere. Give it to me, friend. It's nearly time.`);
    await say(EL(), `Thom. It isn't yours to hold. It never was.`);
    await say(rk, `Careful, elf.`);
    if (G.flags.trollAwake && tr) {
      camFocus(tr.hx, tr.y + 2.5, tr.hz, 16); await wait(0.6);
      await say(tr, `ELF IS RIGHT.`);
      await say(rk, `…Is that the troll?`);
      await say(tr, `Hello.`);
    }
    // the Wood comes for its heart
    spawnRing();
    const H = STORY.hart, hx = F.x - 9.5, hz = F.z - 3.5, base = terrainH(hx, hz);
    H.y = base - 9; H.g.position.set(hx, H.y, hz); H.g.rotation.y = Math.atan2(F.bx - hx, F.bz - hz); H.g.visible = true; H.heal = 0; H.fade = 1; H.bow = 0;
    H.mat.uniforms.uFade.value = 1;
    AUDIO.roar?.(); CAM.shake = 1.5; AUDIO.forceMood = 'gloam';
    camFocus(hx, base + 5, hz, 26);
    for (let i = 0; i <= 60; i++) { const k = i / 60; H.y = lerp(base - 9, base, 1 - (1 - k) ** 3); await wait(1 / 30); }
    await say('nar', `All round the Long Field the dark stands up. Gloam, hundreds of them, in a ring along the walls. And where the ring is thickest something gathers itself out of them: tall as a barn, antlered like a dead tree.`);
    await say(N('agnes'), `Bless us…`);
    await say(o, `There. That's the Wood. All of it that's left. It's come for its heart.`);
    camFocus(F.bx - 1, terrainH(F.bx, F.bz) + 1.4, F.bz + 1.5, 17);
    await say(th, `If the fires die tonight, we'll freeze by spring.`);
    await say(BR(), `Not if we make our own.`);
    await say('nar', `Brakka holds up a flint and a steel, the way another man might hold up a key.`);
    // swing round so the Wood stands on one side of the screen and the bonfire on the other
    { const B = SITES.bonfire, ux = B.x - hx, uz = B.z - hz, l = Math.hypot(ux, uz) || 1; CAM.yawT = Math.atan2(-uz / l, ux / l); camFocus((hx + B.x) / 2, base + 3, (hz + B.z) / 2, 25); }
    const n = G.sparks.length;
    await say(BR(), `Dwarves don't borrow fire. We strike it. And this one's carrying ${n === 0 ? 'not one spark' : n === 1 ? 'one spark' : n + ' sparks'} of your hearths, freely given. ${n >= 7 ? 'That’s a fire, that is.' : n >= 4 ? 'Might be enough. Might not.' : 'It’s not much to catch on, I’ll be honest.'}`);
    await say(N('hilda'), `A new fire? Not from the stone?`);
    await say(o, `Not from any stone. From us.`);
    TIME.h = 23.8;
    const i = await choose([
      { t: 'Give the heart to Thom.', sub: 'the old way: he holds it through midnight, as he has eleven times' },
      { t: 'I’ll hold it myself.', sub: 'you are a wick; the fire loves you' },
      { t: 'Give the heart back to the Wood.', sub: n ? `and let Brakka strike a new fire from the ${n === 1 ? 'one spark' : n + ' sparks'} you carry` : 'and strike a new fire from nothing at all' },
    ]);
    STORY.choice = ['old', 'wick', 'wood'][i];
  });
  if (STORY.choice === 'wood') finaleWood(); else finaleHold(STORY.choice);
}

// ---- holding the heart through midnight: the Wood's last, worst grab ---------------------------------------------
async function finaleHold(kind) {
  const F = FIELD(), th = N('thom'), o = N('orrin');
  qSet('main', 16, { quiet: true });
  await cutscene('hold', async () => {
    if (kind === 'old') {
      await say(th, `Thank you.`);
      G.items.heart = false; MAGIC.tint = null;
      const h = heartMesh(1.3); h.position.set(0, -0.66, 0.15); th.rig.armR.add(h); STORY.thomHeart = h; th.act = 'point';
      await walkTo(th, F.bx - 1.4, F.bz - 0.4, { speed: 1.2 });
      face(th, STORY.hart.g.position);
      await say(th, `Stand close, everyone. It's going to be cold.`);
    } else {
      await say(th, `You? You'd do that? For us?`);
      await say(EL(), `…If you must.`);
      await say(BR(), `Then I'm standing right here.`);
    }
    await say(o, `Here it comes!`);
    AUDIO.roar?.(); CAM.shake = 1;
  });
  COMBAT.calm = false; AUDIO.forceMood = 'combat';
  COMBAT.faintHook = () => { teleportParty(F.bx + 2.6, F.bz + 2.2, -PI / 2); fixPartyY(); };
  UI.toast('Midnight', 'Hold on until the year turns. Keep the gloam off the Long Field.', 'combat', 5);
  await new Promise(res => { FINALE.battle = { t: 0, dur: 46, next: 1.5, slam: 4, res }; });
  COMBAT.faintHook = null; AUDIO.forceMood = 'hush';
  await cutscene('midnight', async () => {
    COMBAT.calm = true;
    const bf0 = SITES.bonfire;
    camFrame(kind === 'old' ? [th, bf0, player] : [player, bf0, BR(), EL()], { yaw: fireYaw(), min: 12, max: 30 });   // wherever the fight left us, look to the bonfire
    await midnightOut();
    await say('nar', kind === 'old' ? `In the dark, Thom lifts the heart over his head, the way he has eleven times before.` : `In the dark, the heart in your lantern goes cold — and then, slowly, it remembers you, and grows warm again.`);
    await wait(0.8);
    const bf = SITES.bonfire;
    setFireLit(bf, true); burst(bf.x, bf.y + 1, bf.z, 80); CAM.shake = 0.6;
    DARK.to = 0; UI.fade(0, 2.2);
    camFrame(kind === 'old' ? [bf, th, o, N('marta')] : [bf, player, BR(), EL(), N('marta')], { min: 12, max: 28, rate: 1.4 });
    for (const e of COMBAT.enemies) if (e.alive) { e.ring = null; killEnemy(e); }
    dissolveHart(false);
    await wait(2.2);
    relightAll();
    await say(N('marta'), `It's lit. Oh, it's lit…`);
    if (kind === 'old') {
      th.pose = 'kneel';
      await say(th, `…There. That's twelve.`);
      await say(o, `Thom? Thom. Somebody, blankets. ALL the blankets.`);
    } else {
      await say(BR(), `You alright? You're… you're glowing a bit.`);
      await say(EL(), `It has taken hold of you. You will not be cold again. And you will not leave.`);
    }
  });
  endGame(kind === 'old' ? 'old' : 'wick');
}
function finaleUpdate(dt) {
  const B2 = FINALE.battle; if (!B2) return;
  B2.t += dt;
  TIME.h = lerp(23.8, 23.995, clamp(B2.t / B2.dur, 0, 1));
  B2.next -= dt; B2.slam -= dt;
  if (B2.next <= 0) {
    B2.next = B2.t > 30 ? 3.2 : 4.6;
    const free = FINALE.ring.filter(e => e.alive && e.ring).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
    for (const e of free.slice(0, B2.t > 24 ? 3 : 2)) e.ring = null;
    if (free.length < 6) { const F = FIELD(); for (let i = 0; i < 3; i++) { const a = rnd(0, TAU), e = spawnEnemy('gloamling', F.x + Math.cos(a) * 17, F.z + Math.sin(a) * 17, { zone: 'ring' }); e.fade = 0; } }
  }
  if (B2.slam <= 0 && !COMBAT.down) { B2.slam = B2.t > 30 ? 3.6 : 5.2; shadowSlam(player.x + rnd(-0.5, 0.5), player.z + rnd(-0.5, 0.5), 2.2, 1.25, 2); AUDIO.roar?.(); }
  if (B2.t >= B2.dur && !COMBAT.down && !SCENE.active) { FINALE.battle = null; B2.res(); }
}
async function midnightOut() {
  TIME.h = 23.998; AUDIO.forceMood = 'hush';
  AUDIO.bell?.(12);
  await wait(0.8);
  for (const f of KFIRES) if (f.lit && !['ghost', 'wisp', 'gloam'].includes(f.kind)) { f.wasLit = true; setFireLit(f, false, true); }
  DARK.to = 1; UI.fade(0.62, 1.4);
  await say('nar', `Midnight. Every flame on the Long Field goes out at once, as if something had breathed in. Then every window in Emberwick, far off up the road. Then the stars seem the only lights left in the world.`);
  await wait(0.6);
}
function relightAll() {
  for (const f of KFIRES) if (f.wasLit && !f.lit) setFireLit(f, true, true);
  DARK.to = 0;
}
function dissolveHart(healed) {
  const H = STORY.hart; if (!H || !H.g.visible) return;
  H.dissolve = { t: 0, healed };
}
function updateHartDissolve(dt) {
  const H = STORY.hart; if (!H || !H.dissolve) return;
  const d = H.dissolve; d.t += dt;
  const k = clamp(d.t / 3, 0, 1);
  H.fade = 1 - k; H.heal = d.healed ? Math.max(H.heal, 1) : H.heal; H.mat.uniforms.uFade.value = 1 - k;
  const p = H.g.position;
  for (let i = 0; i < 6; i++) {
    const c = d.healed ? pick([0x7affa0, 0xd8ffb0, 0xffe08a]) : pick([0x140c1c, 0x24183a]);
    const sp = d.healed ? PS.a : PS.n;
    sp.spawn(p.x + rnd(-2, 2), p.y + rnd(1, 7), p.z + rnd(-2.5, 2.5), rnd(0.5, 2.5), rnd(0.5, 2), rnd(-3, -0.8), rnd(2, 4), d.healed ? 0.18 : 0.4, 0.05, _pc.set(c), d.healed ? 1.2 : 0.7, 0, { shape: d.healed ? 2 : 0, drag: 0.3 });
  }
  if (k >= 1) { H.g.visible = false; H.dissolve = null; }
}

// the bonfire, shot from beyond it so the village gathered behind it is facing the camera
const fireYaw = () => { const F = FIELD(), bf = SITES.bonfire; return Math.atan2(bf.x - (F.x + 2.6), bf.z - (F.z + 6)); };

// ---- giving the heart back ---------------------------------------------------------------------------------------------
async function finaleWood() {
  const F = FIELD(), th = N('thom'), o = N('orrin'), H = STORY.hart;
  qSet('main', 16, { quiet: true });
  await cutscene('wood', async () => {
    face(th, player);
    await say(th, `…No. No, please, friend—`);
    await say(o, `Thom. Let it go. Let them go. Let yourself go home warm, for once.`);
    await walkTo(player, F.x - 2.4, F.z - 1.4, { speed: 1.3 });
    face(player, H.g.position);
    camFocus((player.x + H.g.position.x) / 2, H.y + 3, (player.z + H.g.position.z) / 2, 17);
    for (let i = 0; i <= 40; i++) { H.bow = i / 40; await wait(1 / 30); }
    await say('nar', `The great shape bends its head down to you, so close you could touch the dark of it. It is not angry. It is only cold, and it has been cold for a very long time.`);
    // the heart goes home
    G.items.heart = false; MAGIC.tint = null;
    MAGIC.core.getWorldPosition(_lp);
    const hm = heartMesh(1.4); hm.position.copy(_lp); scene.add(hm);
    const tgt = new V3(); H.head.getWorldPosition(tgt); tgt.y -= 1.6;
    for (let i = 0; i <= 60; i++) { const k = i / 60; hm.position.lerpVectors(_lp, tgt, k * k * (3 - 2 * k)); hm.position.y += Math.sin(k * PI) * 0.8; await wait(1 / 30); }
    scene.remove(hm);
    AUDIO.mend?.(); AUDIO.bossDie?.();
    for (let i = 0; i < 90; i++) { H.heal = i / 90; await wait(1 / 30); }
    for (const e of COMBAT.enemies) if (e.alive) { e.mat.uniforms.uRim.value.set(0x7affa0); e.mat.uniforms.uCore.value.set(0x0a1a08); }
    await say(EL(), `…Oh. Oh, there you are.`);
    await say('nar', `The dark of it goes green, and then gold, and then it is not dark at all: a stag made of the light that comes through leaves. All round the field, the gloam go green with it.`);
    G.flags.woodHealed = true;
    dissolveHart(true);
    for (const e of COMBAT.enemies) if (e.alive) { e.ring = null; e.homeward = true; }
    await wait(3.2);
    for (const e of COMBAT.enemies) if (e.alive) killEnemy(e, true);
    await midnightOut();
    const bf = SITES.bonfire, br = BR();
    camFrame([player, th, bf, br, N('mira')], { yaw: fireYaw(), min: 12, max: 24 });   // over to the bonfire, where it happens now
    await say(th, `…So.`);
    await say(BR(), `Right. Everyone who gave this wick a spark: hold up your hands. Doesn't matter if nobody can see you.`);
    await walkTo(br, bf.x + 1.2, bf.z + 0.6, { speed: 2 });
    face(br, bf);
    camFrame([player, bf, br], { min: 11, max: 20 });   // in close: the lantern, the dwarf and the tinder
    await say('nar', `Brakka kneels by the bonfire. Steel scrapes on flint, and a thread of sparks falls into the tinder.`);
    for (let i = 0; i < 3; i++) { PS.a.spawn(bf.x + 0.5, bf.y - 0.2, bf.z + 0.3, rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1), 0.4, 0.08, 0.02, _pc.set(0xfff0c0), 1.6, 0, { shape: 2, grav: 6 }); AUDIO.thud?.(); await wait(0.35); }
    // the sparks pour out of the lantern into the tinder, one from each hearth
    MAGIC.core.getWorldPosition(_lp);
    for (const s of G.sparks) {
      for (let k = 0; k < 14; k++) { const u = k / 14; PS.a.spawn(lerp(_lp.x, bf.x, u), lerp(_lp.y, bf.y, u) + Math.sin(u * PI) * 1.2, lerp(_lp.z, bf.z, u), 0, 0.2, 0, 0.8, 0.14, 0.03, _pc.set(0xffc060), 1.6, 0, { shape: 2 }); }
      AUDIO.chime?.(1);
      await wait(0.35);
    }
    if (G.sparks.length >= 7) {
      bf.color = 0xfff0c0;
      if (bf.e) bf.e.color.set(0xfff0d0);
      setFireLit(bf, true); burst(bf.x, bf.y + 1, bf.z, 120); CAM.shake = 0.8;
      DARK.to = 0; UI.fade(0, 2.5);
      camFrame([bf, br, th, N('mira'), o, player], { min: 13, max: 26, rate: 1.4 });   // and back, slowly, to take in everyone it warms
      await wait(1.8);
      relightAll();
      await say(N('mira'), `It caught. It CAUGHT!`);
      await say(th, `…That's not the Hearthstone's fire.`);
      await say(o, `No. It's ours. It's everybody's. Light your lanterns, Thom.`);
      th.act = null;
      await say(th, `My hands are warm.`);
      endGame('newfire');
    } else {
      bf.small = true;
      setFireLit(bf, true); if (bf.e) { bf.e.int = 5; bf.e.range = 7; }
      DARK.to = 0.55; UI.fade(0.3, 2);
      camFrame([bf, br, N('hilda'), th], { min: 10, max: 18, rate: 1.4 });   // a small fire wants a close shot
      await wait(1.4);
      await say(N('hilda'), `…It's tiny.`);
      await say(BR(), `It's alive. That's the part that matters. Cup your hands round it, all of you. Nobody breathe on it.`);
      await say(th, `Then we'll carry it home together. A little at a time.`);
      endGame('smallfire');
    }
  });
}

// ---- endings ------------------------------------------------------------------------------------------------------------------
async function endGame(kind) {
  G.ending = kind; G.q.main = 17; G.flags.noTravel = false;
  FINALE.battle = null; COMBAT.calm = false;
  await wait(1.2);
  UI.fade(1, 2.2);
  await wait(2.4);
  AUDIO.forceMood = 'end';
  UI.showEnding(ENDINGS[kind]());
  applyMorning();
  saveGame(true);
}
function applyMorning() {
  CLOCK.frozen = false; TIME.h = 6.5; DARK.k = DARK.to = 0;
  for (const e of COMBAT.enemies) if (e.alive) killEnemy(e, true);
  COMBAT.boss = null; COMBAT.calm = false; FINALE.ring.length = 0;
  if (STORY.hart) STORY.hart.g.visible = false;
  if (STORY.thomHeart) { STORY.thomHeart.parent?.remove(STORY.thomHeart); STORY.thomHeart = null; }
  for (const f of KFIRES) {
    if (['ghost', 'wisp', 'gloam'].includes(f.kind)) continue;
    if (f.wasLit || G.fires[f.id] || ['hearth_inn', 'forge', 'chapel', 'cauldron', 'hearth_bess', 'wf_square', 'bonfire'].includes(f.id)) setFireLit(f, true, true);
  }
  if (G.ending === 'wick') MAGIC.tint = HEART_TINT;
  if (G.ending === 'newfire') { const bf = SITES.bonfire; if (bf.e) bf.e.color.set(0xfff0d0); }
  if (G.ending === 'smallfire') SITES.bonfire.small = true;
  applyNPCState();
  for (const c of CHARS) if (c.id === 'thom') { c.act = null; if (G.ending === 'old' && G.sparks.length < 5) c.away = true; }
  teleportParty(0.5, 10.6, PI); fixPartyY();
  UI.updateTracker();
  setTimeout(() => { AUDIO.forceMood = null; }, 30000);
}
const ENDINGS = {
  newfire: () => ({ eyebrow: 'The New Fire', title: 'A Fire of Our Own', text: [
    `The heart went back to the Wood. At midnight every fire in Emberwick went out, every hearth and candle and lamp, and for one long breath the whole vale was dark.`,
    `Then Brakka struck his flint over the bonfire, and the sparks you had carried all night poured out of the lantern — ${sparkList()} — and they caught. A new fire, belonging to no one and to everyone, and Emberwick lit its lanterns from it one by one.`,
    `In the morning the Gloamwood was green at its edges for the first time in three hundred years. Thom’s hands were warm. Orrin bought him a hat.`,
    `Elowen walked into the Wood at sunrise. She waved once, without looking back, which Brakka said was very elvish of her.`,
    ...epilogue(),
    `Next Harvest Eve, nobody carried a stone. Everybody carried a spark.`,
  ] }),
  smallfire: () => ({ eyebrow: 'The Small Fire', title: 'A Light the Size of a Candle', text: [
    `The heart went back to the Wood, and at midnight every fire in Emberwick went out.`,
    `Brakka struck his flint over the bonfire, and the few sparks you carried caught — barely. A flame the size of a candle, in the middle of a dark field, with a whole village around it holding its breath.`,
    `It was enough. Not for the bonfire, not that night. But they carried it home cupped in their hands, and by dawn there was a fire in the Goose's hearth, and by noon there were twelve, and by the first snow every chimney in Emberwick was smoking.`,
    `It was a hard winter. They spent most of it in each other's kitchens. Nobody minded as much as they expected to.`,
    ...epilogue(),
    `The Gloamwood was green again by spring, and Elowen with it.`,
  ] }),
  old: () => ({ eyebrow: 'The Old Fire', title: 'The Twelfth Kindling', text: [
    `You gave the heart to Thom, and at midnight he held it, as he had eleven times before. Every fire in the vale guttered out, and every fire in the vale came back.`,
    `The Wood's great shape stood at the edge of the field until the bonfire roared, and then it came apart into a thousand cold shadows that drifted home toward the mountain.`,
    G.sparks.length >= 5 ? `Thom saw the morning, wrapped in four blankets, with a spark from every hearth you had gathered held to his hands. He said it was the warmest he'd been in eleven years. He was lying, a little.` : `Thom did not see the morning. They buried him by the chapel, and Orrin stood at the grave all day in no hat at all.`,
    `Elowen was gone before dawn. She left her staff leaning against the bonfire's ashes. Orrin kept it, and never said why.`,
    ...epilogue(),
    `Emberwick is warm. The Gloamwood is cold. Next Harvest Eve, someone will hold the stone again.`,
  ] }),
  wick: () => ({ eyebrow: 'The Wick', title: 'The Stranger Who Stayed', text: [
    `You held the heart yourself. It was colder than anything you had ever touched, and it did not freeze you — the fire loves a wick — but it did something slower. When midnight passed and the bonfire roared back, you found you could not let go of the lantern.`,
    `You stayed. You became Emberwick's Kindler, and then simply Emberwick's: the stranger who never left, who lights the lanterns at dusk, whose hands are always warm.`,
    `Thom grew old by the fire, and stopped shivering. Brakka stayed too, “to keep you in boots”.`,
    `Elowen went back into the cold Wood alone. Once a year, on Harvest Night, a wisp comes down out of the Gloamwood and sits on your windowsill until morning.`,
    ...epilogue(),
  ] }),
};
function sparkList() {
  const names = { hilda: 'Hilda’s', mira: 'Mira’s', marta: 'Marta’s', agnes: 'Agnes’s', wil: 'Wil’s', twins: 'the twins’ sparkler', rook: 'Rook’s', hesk: 'Mother Hesk’s', bess: 'Old Bess’s', troll: 'Grumblethorn’s belly-ember' };
  const l = G.sparks.map(s => names[s] || s);
  return l.length > 1 ? l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1] : l[0] || 'the one you had';
}
function epilogue() {
  const out = [];
  if (G.flags.trollAwake) out.push(`Grumblethorn came down for the pumpkin judging. Nobody had the nerve to tell him he couldn't enter. Rook shook his hand, which took both of Rook's.`);
  else out.push(`Up on the mountain Grumblethorn slept on, sitting on the cold, and the pumpkins at the north fence went on disappearing.`);
  if (G.flags.twinsFate === 'confess') out.push(`Pip and Nell confessed about the Berthas, and spent the winter mucking out Wil's barn. Big Bertha won.`);
  else if (G.flags.twinsFate === 'secret') out.push(`Nobody ever found out who hid the Berthas. Pip and Nell grew up to be excellent at keeping secrets, which worried everyone.`);
  else if (G.flags.twinsFate === 'told') out.push(`Wil forgave the twins by spring. The twins did not forgive you.`);
  if (q('cat') >= 3) out.push(`Smudge never wandered off again, or at least never got caught.`);
  if (q('toad') >= 2) out.push(`Bartholomew is still sulking.`);
  if (G.hats.length) out.push(`Orrin got back ${G.hats.length === HATS.length ? 'every one' : ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][G.hats.length] || G.hats.length} of his hats. ${G.hats.length >= 8 ? 'He wore them all at once at the Harvest feast, and nobody trusted him for a week.' : 'He says the rest are on adventures of their own.'}`);
  if (G.flags.trust === 0) out.push(`You never quite forgave Elowen. She never quite asked you to.`);
  return out;
}
const ENDLINES = {
  thom: () => G.ending === 'old' ? [`Twelve. I'll stop at twelve. Orrin says I'm stopping at twelve.`, `Go and eat something. That's an order from your Elder.`] : [`Warm hands. Do you know how long it's been?`, `We'll need a new custom, I suppose. Every Harvest Eve, everybody gives a spark. I like it better.`],
  pell: () => [`Master Orrin is wearing ${Math.max(1, G.hats.length)} hat${G.hats.length === 1 ? '' : 's'} today. It's a good sign. I think.`, `He says I can learn to carry a lantern now. Not a wick-lantern. An ordinary one. It's a start.`],
  rook: () => [`Quiet night, they'll call it. Quiet.`, G.flags.trollAwake ? `I'm going up the mountain later. With pumpkins. Don't laugh.` : `If you ever want a job on the watch, there's one going.`],
  hilda: () => [G.ending === 'newfire' || G.ending === 'smallfire' ? `My forge went out for the first time in nine years. And I lit it again from a fire my own hands helped make. Strange feeling.` : `Nine years and a night. Still burning.`, `Tell your dwarf his axe is welcome back any time.`],
  marta: () => [`Breakfast's on the house. Everything's on the house. I may never charge anyone again.`, `Sir Basil slept through the whole thing. Of course he did.`],
  mira: () => [`First loaf of the morning. Take it, take it, it's yours.`, `The oven's never been warmer. I think it was worried.`],
  agnes: () => [`I've stopped praying for the founders. I've started praying for the Wood.`, `Somebody walked home by the crossroads shrine last night. Somebody always does.`],
  bess: () => [q('cat') >= 3 ? `Smudge says thank you. Well, he doesn't. But he would.` : `Still no cat. There's always a cat. Somewhere.`, `Mind the step.`],
  ned: () => [`Fish are biting. Even the fish feel better.`],
  wil: () => [`Big Bertha's the biggest she's ever been. Judging's at noon.`],
  twins: () => [`Did you see the fire? Did you SEE it?`, `We're not allowed near the barn any more.`],
  hesk: () => [`The wisps are brighter this morning. Don't touch the jars.`],
  troll: () => [`Troll is going to the pumpkin judging. Troll is going to win.`, `Duchess says good morning.`],
  orrin: () => [`I have decided to take up gardening. In the Wood. With permission.`, `Thank you. That's all. Thank you. I've never been very good at it, so I'm practising.`],
  minor: () => [`What a night. What a night.`, `I'm going to sleep for a week.`, `Did you hear? They say the Gloamwood's gone green at the edges.`],
};
