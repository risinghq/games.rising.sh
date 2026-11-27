// ============================================================================
//  SCENES — the night, one conversation at a time
// ============================================================================
const MEMORIES: any = {};
const HEART_TINT: any = 0xffd070;
const STONE_ORDER: any = [2, 3, 4, 5, 6, 0, 1];   // sunwise from the stone where the sun rises
const STATE: any = { stoneStep: 0, stoneFails: 0, wave: null };
function heartMesh(s: any = 1) : any {
  const g: any = new THREE.Group();
  const core: any = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075 * s, 1), new THREE.MeshBasicMaterial({ color: 0xffb050 }));
  const shell: any = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11 * s, 1), new THREE.MeshBasicMaterial({ color: 0xff6a20, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(core); g.add(shell);
  return g;
}
const echoLook: any = (id: any) => N(id)?.rig.look;
function partyNear(x: any, z: any, fc: any) : any { teleportParty(x, z, fc); fixPartyY(); }

// ---- act one: the village at dusk ---------------------------------------------------------------------------------
async function sceneOpening(): Promise<any> {
  await cutscene('opening', async () => {
    UI.fade(1, 0);
    TIME.h = 17.3;
    partyNear(-3.6, -14.4, 0.1);
    await wait(0.5);
    await fadeIn(1.6);
    UI.showBanner('Emberwick', 'Harvest Eve');
    await say(BR(), `That cider was everything they promised. I can't feel my teeth.`);
    await say(EL(), `The Elder lights the festival lanterns at dusk. We should be in the square.`);
    await say(BR(), `You said that about the cider.`);
    await say(EL(), `And was I wrong?`);
  });
  qSet('main', 0);
  UI.toast('How to play', IS_TOUCH ? 'Drag anywhere to walk, or tap where you want to go. Tap people and fires to talk and kindle, or use the F button. Spells are the round buttons.' : 'Walk with W A S D (or click the ground). Talk and use things with F. Turn the view with Q and E.', 'info', 7);
}
async function sceneAlarm(): Promise<any> {
  if (q('main') !== 0 || SCENE.active) return;
  const thom: any = N('thom'), pell: any = N('pell'), rook: any = N('rook');
  await cutscene('alarm', async () => {
    if (Math.hypot(player.x - thom.x, player.z - thom.z) > 3) await walkTo(player, thom.x + 1.6, thom.z - 1.8, { speed: 3.2 });
    face(player, thom); face(thom, player);
    camFocus((player.x + thom.x) / 2, thom.y + 1.1, (player.z + thom.z) / 2, 15);
    await say(thom, `Travellers! Welcome to Emberwick, on the best night of the year.`);
    await say(thom, `At dusk we light the lanterns from the Hearthstone, and at midnight, on the Long Field, every fire in the vale is lit anew from it. You've come on the right night.`);
    await say(BR(), `Is there food at this lighting?`);
    await say(thom, `There is a great deal of food at this lighting.`);
    putAt(pell, -16, -14, 0.8); putAt(rook, -14.5, 2, PI * 0.6, { act: 'spear' });
    AUDIO.bell?.(3);
    await say(pell, `ELDER! Elder Thom!`);
    walkTo(rook, thom.x - 2.0, thom.z - 0.4, { speed: 3 });
    await walkTo(pell, thom.x - 0.6, thom.z - 2.1, { speed: 5 });
    face(pell, thom); face(thom, pell); face(rook, thom);
    await say(pell, `The Hearthstone — the cradle's empty! It's gone! And Master Orrin's gone, his bed's not been slept in, and the cage is… well, the cage is fine, Fizzwick's still in it, but—`);
    await say(thom, `Gone? Gone where? Pell. Breathe.`);
    await say(rook, `I'll tell you where. Wil's prize pumpkins went missing last night, and there are footprints the size of washtubs all up the cave road. Troll.`);
    thom.act = 'shiver';
    await say(thom, `…Without the Hearthstone there's no Kindling. At midnight every fire in Emberwick goes out. And none of them will light again.`);
    await say(BR(), `Won't light? Fire's fire. You strike a flint—`);
    await say(thom, `Not in this vale, Master Dwarf. For three hundred years every flame here has been the Hearthstone's child. When the year turns, it calls them home. And they go.`);
    await say(EL(), `…So it is true.`);
    await say(rook, `I'm taking the watch up the cave road. If that troll's got it, I'll—`);
    await say(thom, `Gently, Captain. Nobody goes into that cave with a spear.`);
    face(pell, player);
    await say(pell, `You… you're the travellers? A dwarf and an elf? Master Orrin left something. For you, I think. Please — come to the tower.`);
    walkTo(pell, -24, -19, { speed: 4 });
    await say('nar', `Pell hurries off toward Orrin's tower, at the north-west corner of the village.`);
  });
  goHome(pell); goHome(rook); thom.act = 'shiver';
  qSet('main', 1);
  qSet('troll', 0);
}
async function sceneLantern(): Promise<any> {
  const pell: any = N('pell');
  await cutscene('lantern', async () => {
    face(pell, player);
    await say(pell, `He left it on his workbench, with a note. Here.`);
    await say('nar', `“For the stranger who walks with a dwarf and an elf. If it lights in your hand, you are the one I wrote to. If it doesn't, Pell, give it to the next one. And feed Fizzwick. —O.”`);
    await say(pell, `He never said who. Or why. He never says why.`);
    G.flags.lantern = true; giveLantern(); UI.buildSpellbar();
    await say('nar', `The lantern is old brass and older glass, and it is cold. But when your hand closes on the handle, something in it stirs, like a cat that has heard its name.`);
    await say(pell, `It's a wick-lantern. It drinks fire. It never once lit for me, in four years.`);
    await say(pell, `Try the fire under my cauldron. Hold it close and… want it. That's all he ever told me.`);
    await say(BR(), `You're very calm about the magic lantern.`);
    await say(EL(), `I am calm about most things.`);
  });
  qSet('main', 2);
  UI.toast('Your lantern', 'Stand by a fire and press F to draw its flame. Every kind of fire teaches the lantern something.', 'info', 6);
}
async function sceneLit(): Promise<any> {
  const pell: any = N('pell');
  await cutscene('lit', async () => {
    await say(pell, `It… it LIT. Oh. Oh, he was right about you.`);
    await say(pell, `The undercroft — the cradle's down there, under us. There were candles burning beside it when it happened. Master always says candles remember. If you lit them again…`);
    await say(EL(), `Hearth-flame mends. If the cold ever gets into you, your lantern can drive it out again.`);
  });
  qSet('main', 3);
}
MEMORIES.inn = {
  async play(f: any): Promise<any> {
    const I: any = V.inn, p1: any = I.localY(-4.9, I.levels[0], -0.4), p2: any = I.localY(-4.7, I.levels[0], 1.5);
    const th: any = makeEcho({ id: 'e_thom', name: 'Thom', title: 'a memory', look: echoLook('thom'), x: p1.x, z: p1.z, y: p1.y, b: I, f: 0 });
    const or: any = makeEcho({ id: 'e_orrin', name: 'Orrin', title: 'a memory', look: echoLook('orrin'), x: p2.x, z: p2.z, y: p2.y, b: I, f: 0 });
    face(th, f); th.act = 'warm'; face(or, th);
    camFocus((p1.x + p2.x) / 2, p1.y + 1.2, (p1.z + p2.z) / 2, 11);
    await wait(0.6);
    await say(or, `Eleven Kindlings, Thom. Look at your hands.`);
    await say(th, `They're old hands, Orrin. Old hands are cold. That's all it is.`);
    await say(or, `Maud did seven. Her father did four. Ada didn't finish one.`);
    await say(th, `Then I'm doing better than Ada. Pour me another.`);
    await say(or, `Let somebody else carry it this year. Let ME carry it.`);
    await say(th, `You? You'd leave it in a hat.`);
    await say(or, `…That is a fair point, and I resent it.`);
    await wait(0.4);
    removeEcho(th); removeEcho(or);
  },
  async after(): Promise<any> { await say(BR(), `Kindlings. Cold hands. I'm starting to think this festival has a catch.`); },
};
MEMORIES.vault = {
  async play(): Promise<any> {
    const T: any = V.tower, c: any = T.local(0.75, 0.2), y: any = UGP.VY, door: any = T.local(3.4, 0);
    const or: any = makeEcho({ id: 'e_orrin', name: 'Orrin', title: 'a memory', look: echoLook('orrin'), x: c[0] - 1.9, z: c[1] + 1.1, y, ug: true });
    camFocus(c[0], y + 1.1, c[1], 10);
    await wait(0.5);
    await walkTo(or, c[0] - 0.6, c[1] + 0.35, { speed: 1.1 });
    face(or, { x: c[0], z: c[1] });
    await say(or, `There you are. Three hundred years in a box, and still warm.`);
    const h: any = heartMesh(); h.position.set(0, -0.68, 0.12); or.rig.armR.add(h); or.act = 'point';
    await say(or, `Forgive me, Thom. Not this year. Not you.`);
    or.act = null; h.parent.remove(h);
    await say('nar', `He wraps the glowing coal in a cloth and stows it in his satchel. He takes a hat from the shelf and puts it on. Then a second hat, on top of the first. Then, after some thought, a third.`);
    await say(or, `Not a word, Fizz.`);
    await walkTo(or, door[0], door[1], { speed: 1.7 });
    removeEcho(or);
  },
  async after(): Promise<any> {
    await say(BR(), `The wizard stole his own village's fire.`);
    await say(EL(), `Or carried it away from something.`);
    if (!G.spells.reveal) await say(EL(), `That candle-flame is old, and it saw clearly. Draw from it, and your lantern will learn to see clearly too.`);
    if (q('main') < 4) qSet('main', 4);
  },
};
async function sceneReport(): Promise<any> {
  const thom: any = N('thom'), rook: any = N('rook');
  await cutscene('report', async () => {
    face(thom, player);
    await say(thom, `You've been down in the tower. Pell's face says you found something.`);
    await choose(['Orrin took the Hearthstone himself.', 'The candles showed us: Orrin took it.']);
    await say(thom, `Orrin? No. No, he wouldn't…`);
    await say(thom, `…He would. The old fool. He's been at me about it all year.`);
    await say(EL(), `About what?`);
    await say(thom, `About whether I'm too old to carry it. Whether it's too cold a job for an old man.`);
    await say(BR(), `Your hands are shaking.`);
    await say(thom, `It's autumn, Master Dwarf. Everybody's hands are shaking.`);
    await fadeOut(0.7);
    TIME.h = Math.max(TIME.h, 18.7);
    gatherSquare();
    partyNear(2.6, -5.2, -PI * 0.7);
    await wait(0.2);
    await fadeIn(0.9);
    camFocus(0, 1.6, -6.6, 21);
    await say(thom, `Friends. Friends! Listen to me.`);
    await say(thom, `The Hearthstone has been taken out of Emberwick. Not by any troll. By Orrin, for reasons of his own, which I mean to hear from him myself.`);
    await say(thom, `These three are going to find him. Until they do: keep your hearths fed. Light every lamp you own.`);
    await say(thom, `At midnight we gather on the Long Field, as we always have. If the stone comes home, we will have our Kindling. If it doesn't…`);
    await wait(0.9);
    await say(thom, `…then we will be cold together. And that is better than being cold alone.`);
    await say(N('greta'), `And the gloam, Elder? It's nearly dark.`);
    await say(rook, `The watch will hold the cave road. The rest of you stay inside the lamplight.`);
    face(rook, player);
    await say(rook, `And you. You're going out there with a lantern and good intentions? You'll want fire with teeth. Hilda's forge, east side of the square. Tell her I sent you.`);
    await fadeOut(0.7);
    for (const c of CHARS) if (!PARTY.includes(c) && c.spawn && !c.echo && c.id !== 'troll' && c.id !== 'orrin') goHome(c);
    thom.act = 'shiver';
    await wait(0.2);
    await fadeIn(0.8);
  });
  qSet('main', 5);
}
const SQUARE_CROWD: any = [['marta', -5.6, -6.4], ['hilda', -4.4, -9.6], ['mira', -2.5, -10.7], ['agnes', 0.2, -10.9], ['bess', 2.0, -9.8], ['wil', 4.6, -9.9], ['greta', 5.7, -7.0],
  ['pip', -6.2, -8.6], ['nell', 6.8, -9.1], ['tobias', 0.9, -6.6], ['hob', -2.0, -6.0], ['ned', -4.0, -11.6], ['lyle', 3.6, -11.8], ['tamsin', -0.9, -12.6], ['pell', 1.9, -12.5], ['rook', 4.0, -5.6]];
function gatherSquare() : any {
  const thom: any = N('thom');
  putAt(thom, 0, -3.5, PI, { act: null });
  for (const [id, x, z] of SQUARE_CROWD) { const c: any = N(id); if (c) putAt(c, x, z, Math.atan2(0 - x, -3.5 - z), { act: id === 'rook' ? 'spear' : null }); }
}
async function sceneAxe(): Promise<any> {
  const h: any = N('hilda'), br: any = BR();
  await cutscene('axe', async () => {
    face(h, player);
    await say(h, `Rook sent you. Course he did. And my forge took to your lantern like a cat to a lap. Good.`);
    await say(h, `Now. You, dwarf. That's a fine axe. Dwarf-work. But it's cold iron, and cold iron's no use against cold things. Give it here.`);
    await say(br, `Nobody touches the axe.`);
    await say(h, `Give it here.`);
    await say(br, `…Mind the edge.`);
    await say(h, `Into the coals… and you: give it a breath of that lantern-flame. Just a breath.`);
    const fg: any = fireById('forge');
    MAGIC.core.getWorldPosition(_lp);
    for (let i: any = 0; i < 30; i++) { const u: any = i / 30; PS.a.spawn(lerp(_lp.x, fg.x, u), lerp(_lp.y, fg.y, u) + Math.sin(u * PI) * 0.6, lerp(_lp.z, fg.z, u), 0, 0.3, 0, 0.7, 0.12, 0.02, _pc.set(0xffc060), 1.5, 0, { shape: 2 }); }
    AUDIO.whoosh?.('forge'); burst(fg.x, fg.y + 0.3, fg.z, 40); CAM.shake = 0.4;
    await wait(1.1);
    G.flags.axeKindled = true;
    await say('nar', `The axe comes out of the forge glowing along its edge, and it doesn't stop glowing.`);
    await say(br, `…I think I'm in love.`);
    await say(h, `With the axe, I hope.`);
    await say(h, `One more thing. Old custom: on Harvest Eve you give a spark of your hearth to a friend. It means: if your fire ever goes out, come to mine.`);
    giveSpark('hilda', 'Hilda');
    await say(h, `Sparks don't burn in a lantern. They just remember who gave them. Collect enough and you're never cold anywhere in this valley.`);
    await say(h, `Pell's been telling everyone Orrin walked out the west road every evening this week. Toward the Barrow Downs. Start there.`);
    await say(EL(), `Night is falling. Wayfires stand along the roads; kindle them as you find them, and you can travel between them from your map.`);
  });
  qSet('main', 6);
  if (q('watch') < 0) qSet('watch', 0);
}

// ---- the North Watch ---------------------------------------------------------------------------------------------------
async function sceneWatchStart(): Promise<any> {
  const r: any = N('rook');
  await cutscene('watch', async () => {
    face(r, player);
    await say(r, `You. Good. They're coming down off the mountain tonight like I've never seen. Threes and fours.`);
    await say(r, `If they get past me they get to the Long Field, and the Long Field's where everyone will be at midnight. Hold the road with me. Burn anything with eyes.`);
    await say(BR(), `Finally. Something to hit.`);
  });
  if (q('watch') < 0) qSet('watch', 0, { quiet: true });
  qSet('watch', 1);
  STATE.wave = { t: 0, spawned: 0, n: 8, x: SITES.watch.x - 3, z: SITES.watch.z - 15, list: [], zone: { id: 'wave', inside: true } };
  AUDIO.roar?.();
}
async function sceneWaveDone(): Promise<any> {
  const r: any = N('rook');
  await cutscene('wavedone', async () => {
    face(r, player);
    await say(r, `…Not bad, for a lantern-carrier.`);
    await say(r, `There are four beacons on the hills round the vale: the Heath, the Meadow, the Gloamridge and the Westridge. In the old days they were lit every Harvest Night, so the watch could see the cold coming.`);
    await say(r, `Nobody's bothered in twenty years. Light them, and I'll see them coming from here. Then I'll owe you.`);
    await say(EL(), `Lit beacons are wayfires too. They would carry us home.`);
  });
  qSet('watch', 2);
}

// ---- act two: the vale by night --------------------------------------------------------------------------------------------
MEMORIES.camp = {
  async play(): Promise<any> {
    const C: any = SITES.camp;
    const or: any = makeEcho({ id: 'e_orrin', name: 'Orrin', title: 'a memory', look: echoLook('orrin'), x: C.x - 1.0, z: C.z + 0.3, y: C.y });
    or.pose = 'sit'; or.sitY = 0.28; or.act = 'read'; face(or, C);
    const el: any = makeEcho({ id: 'e_elf', name: 'A tall stranger', title: 'a memory', look: EL().rig.look, x: C.x + 7, z: C.z - 6, y: terrainH(C.x + 7, C.z - 6) });
    el.act = 'staff';
    camFocus(C.x, C.y + 1, C.z, 13);
    await wait(0.6);
    await say(or, `“The fire was never ours.” Ada, you could have been a little less cryptic.`);
    await walkTo(el, C.x + 1.5, C.z - 1.1, { speed: 1.2 });
    or.pose = 'stand'; or.act = null; face(el, or); face(or, el);
    await say(or, `You came. I half thought I'd dreamed your letters.`);
    await say(el, `The year turns in three nights. Will you do it?`);
    await say(or, `I've read her stones a hundred times. The words don't change. Yes. I'll take it back, before the Kindling. Before Thom—`);
    await say(el, `And the village?`);
    await say(or, `I'll think of something. I always think of something. Usually it's a hat.`);
    await say(or, `But I can't carry it into the Wood. Not far. It knows whose heir I am. It needs a wick.`);
    await say(el, `Then I will bring you one.`);
    await wait(0.6);
    removeEcho(or); removeEcho(el);
  },
  async after(): Promise<any> {
    const el: any = EL(), br: any = BR();
    face(br, el); face(el, player);
    await say(br, `Tall. Pale. Staff. Talks like a poem.`);
    await say(el, `Yes.`);
    await say(br, `That was you.`);
    await say(el, `Yes.`);
    await say(el, `I will tell you everything. But not here, by a cold fire, in a hurry. Orrin went to the founders' barrow. Let the founders hear it too.`);
    const i: any = await choose(['Tell us now.', 'The barrow, then. But you will tell us.']);
    if (i === 0) {
      await say(el, `Then a little, now: I knew Orrin. We wrote to each other for a year. I asked him to do this. And I brought you here because he needed you.`);
      await say(br, `Needed us for WHAT?`);
      await say(el, `Not “us”. Please. The barrow.`);
    } else await say(el, `I will. I promise you.`);
    await say(el, `The barrow is sealed. Orrin wrote that the Kindling Stones open it: the ring of standing stones just south-west of here.`);
    if (q('main') < 7) qSet('main', 7);
  },
};
MEMORIES.farm = {
  async play(): Promise<any> {
    const F: any = V.farm, a: any = F.localY(-1.6, F.levels[0], 2.4), b: any = F.localY(-0.4, F.levels[0], 2.7), door: any = F.localY(1.6, F.levels[0], 4.6);
    const pip: any = makeEcho({ id: 'e_pip', name: 'A small thief', title: 'a memory', look: echoLook('pip'), x: a.x, z: a.z, y: a.y, b: F, f: 0 });
    const nell: any = makeEcho({ id: 'e_nell', name: 'Another small thief', title: 'a memory', look: echoLook('nell'), x: b.x, z: b.z, y: b.y, b: F, f: 0 });
    camFocus((a.x + b.x) / 2, a.y + 0.9, (a.z + b.z) / 2, 10);
    await wait(0.5);
    await say(nell, `Shh! He'll hear!`);
    await say(pip, `He's not here, he's out looking for them. That's the POINT.`);
    await say(nell, `Dad's old boots. Stomp, stomp. Everyone'll think it's the troll.`);
    await say(pip, `Bertha's too heavy. Get Big Bertha's other end.`);
    await say(nell, `Which one's Big Bertha?`);
    await say(pip, `The BIG one.`);
    walkTo(nell, door.x, door.z, { speed: 1.4 }); await walkTo(pip, door.x + 0.6, door.z, { speed: 1.4 });
    removeEcho(pip); removeEcho(nell);
  },
  async after(): Promise<any> { await say(BR(), `Two very small trolls. They rolled them toward that old barn.`); if (q('pumpkins') < 1) { if (q('pumpkins') < 0) qSet('pumpkins', 0, { quiet: true }); qSet('pumpkins', 1); } },
};
function stoneKindled(f: any) : any {
  if (G.flags.stonesSolved) return;
  const k: any = f.puzzle;
  if (k === STONE_ORDER[STATE.stoneStep]) {
    STATE.stoneStep++;
    AUDIO.chime?.(STATE.stoneStep);
    if (STATE.stoneStep === 7) sceneStones();
    return;
  }
  STATE.stoneStep = 0; STATE.stoneFails++;
  setTimeout(() => {
    for (const s of SITES.circle.stones) if (s.fire.lit) { setFireLit(s.fire, false, true); for (let i: any = 0; i < 10; i++) PS.n.spawn(s.fire.x, s.fire.y + 0.2, s.fire.z, rnd(-0.5, 0.5), rnd(0.5, 1.2), rnd(-0.5, 0.5), 0.9, 0.2, 0.5, _pc.set(0x8aa8c8), 0.5, 0, {}); }
    AUDIO.fizzle?.();
    UI.toast('The stones go dark', 'The ghost-fires gutter out together. Not that order.', 'cold', 3);
    if (STATE.stoneFails === 2) UI.bubble(EL(), G.flags.readAltar ? 'East first, where the sun rises. Then round the way the sun goes.' : 'The altar. There is something carved on the altar.', 5);
  }, 350);
}
async function sceneStones(): Promise<any> {
  G.flags.stonesSolved = true;
  await cutscene('stones', async () => {
    const C: any = SITES.circle, D: any = SITES.barrowDoor;
    camFocus(C.x, C.y + 1.5, C.z, 21);
    AUDIO.chime?.(6); ring(C.x, C.y + 0.1, C.z, 1, 12, 1.6, 0x9ad8ff);
    await wait(1.3);
    await say('nar', `All seven fires burn blue and steady. Somewhere to the north-west, stone grinds on stone.`);
    camFocus(D.x + 2, D.y + 1.2, D.z, 16);
    await wait(0.8);
    openSlab();
    await wait(2.6);
    await say(EL(), `The founders' door is open.`);
    await say(BR(), `I want it noted that I am not happy about this.`);
  });
  qSet('main', 8);
}
async function sceneAda(): Promise<any> {
  const T: any = UGP.adaTomb, ada: any = N('ada');
  await cutscene('ada', async () => {
    camFocus(T.x, T.y + 1.2, T.z, 10);
    UI.vision(true); AUDIO.vision?.(); AUDIO.forceMood = 'hush';
    ada.away = false;
    for (let i: any = 0; i < 40; i++) PS.a.spawn(ada.x + rnd(-0.4, 0.4), ada.y + rnd(0, 1.8), ada.z + rnd(-0.4, 0.4), 0, rnd(0.2, 0.6), 0, rnd(1, 2), 0.12, 0.02, _pc.set(0xbfe0ff), 1.2, 0, { shape: 2, kind: 1, ly: 1 });
    await wait(1.4);
    face(ada, player);
    await say(ada, `Three hundred years I have waited for a warm hand on my candles.`);
    await say(ada, `You carry my lantern.`);
    const i: any = await choose(['Your lantern?', 'Who are you?']);
    if (i === 0) await say(ada, `I carried it over the mountain. Orrin found it in my barrow, years ago, and wondered why it never lit. It only lights for a wick.`);
    await say(ada, `I am Ada Emberwick. I brought my people over the mountain in the worst winter the world remembers. We were dying in the snow.`);
    await say(ada, `And in the Wood there was a tree, and in the tree there was a fire that had never once gone out.`);
    await say(ada, `I took it. I cut it out of the heart of the tree with a bronze knife, and I carried it home in that lantern, and my people lived.`);
    await say(BR(), `Sounds like a good night's work.`);
    await say(ada, `The Wood died of it. Not at once — trees are slow, and so is grief. Its warmth ran out of the roots of the vale, and its cold grew teeth. You have met them. The gloam are the Wood, longing for its heart.`);
    await say(ada, `And once a year, on the night the year turns, the Wood calls its fire home. Every flame that came from the heart goes out to answer it.`);
    await say(ada, `Unless someone holds the heart fast through midnight, and gives the fire a reason to stay.`);
    await choose(['The Kindling.']);
    await say(ada, `The Kindling. The heart is held, the fire stays, and the holder pays. It draws its warmth from whoever holds it.`);
    await say(ada, `I held it first. I did not see the morning.`);
    await say(EL(), `…And every Elder since.`);
    await say(ada, `Every one. Some lasted ten winters, some three. Your Thom has carried it eleven. Touch his hands, if you doubt me.`);
    await say(ada, `Orrin came to me a month ago and asked what I would do, if I could do it again. I told him the truth. “The fire was never ours.”`);
    const j: any = await choose(['What should we do?', 'Why did you never tell them?']);
    if (j === 1) await say(ada, `I was dead, child. The dead are not much asked.`);
    await say(ada, `Give it back, if you can. Or carry it, if you must. But do not let another Kindler freeze for my theft.`);
    UI.vision(false); AUDIO.forceMood = null;
  });
  G.flags.adaMet = true;
  qSet('main', 9);
}
async function sceneConfession(): Promise<any> {
  const el: any = EL(), br: any = BR();
  await cutscene('confession', async () => {
    face(el, player); face(br, el); face(player, el);
    camFocus((el.x + player.x) / 2, el.y + 1.1, (el.z + player.z) / 2, 12);
    el.act = null;
    await say(el, `My people were the Wood's keepers. The green in it. The songs in the branches.`);
    await say(el, `When the heart was taken we did not die. We did something slower. Most of us became what you call gloam: cold, and hungry, and not remembering why.`);
    await say(el, `I am one of the last who remembers being green. I have been cold for three hundred years.`);
    await say(br, `…You're three hundred years old?`);
    await say(el, `Three hundred and forty.`);
    await say(br, `You don't look a day over two hundred.`);
    await say(el, `Orrin wrote to the scholars at Coldwater asking about the Kindling, and I answered him instead. For a year we wrote. He wanted the Kindlings to end. I wanted my Wood back.`);
    await say(el, `But neither of us could carry the heart home. It burns the gloam-kin, and the Wood will not let a thief's village carry it. It needed a wick.`);
    await say(el, `Someone the fire loves, who belongs to neither the Wood nor the village. I went looking. I found you in Coldwater, in the snow, warming your hands at a brazier that had gone out an hour before.`);
    await say(el, `And I hired Brakka, because I thought you would want a friend, and I could not be one honestly.`);
    await say(br, `I was hired to be a FRIEND?`);
    await say(el, `You were hired to carry the bags. The friend part you did by yourself.`);
    await say(el, `I lied to you both. I am sorry. I would do it again; the Wood is dying. But I am sorry.`);
    const i: any = await choose(['You should have asked.', 'We came this far together. We’ll finish it.', 'I don’t know if I can trust you.']);
    if (i === 0) { G.flags.trust = 1; await say(el, `Yes. I should have. So: I am asking now. Help me finish what Orrin started.`); }
    else if (i === 1) { G.flags.trust = 2; await say(el, `…Thank you.`); }
    else { G.flags.trust = 0; await say(el, `Then don't. Trust the fire. It has never lied to you.`); }
    await say(br, `Well. I'm still getting paid, I hope.`);
    await say(el, `Double.`);
    await say(br, `Then I forgive everyone.`);
    el.act = 'staff';
    await say(el, `Orrin went into the Gloamwood to give the heart back, and he hasn't come out. The old path in is warded with wisp-lamps, the Wood's own lights. They only take wisp-fire.`);
    await say(el, `Mother Hesk, out on the Wisp Fen south of the Downs, catches wisps. She is… particular. But she will teach you.`);
  });
  qSet('main', 10);
}
async function sceneHesk(): Promise<any> {
  const h: any = N('hesk');
  await cutscene('hesk', async () => {
    face(h, player);
    await say(h, `Don't touch the jars. If you're here about the wizard, he owes me a tank lid.`);
    face(h, EL());
    await say(h, `Hm. You're one of the green ones. Thought you'd all gone cold.`);
    await say(EL(), `Nearly.`);
    face(h, player);
    await say(h, `And you've got Ada's lantern. Well, well. You want a wisp.`);
    await say(h, `They're not spirits, whatever the songs say. They're the Wood's last warmth, leaking up through the fen like breath on a cold morning.`);
    await say(h, `They don't like being chased. They like being let. Stand still with your lantern out and they'll come to warm themselves. Then draw, gently.`);
    G.flags.wispTaught = true;
    await say(h, `Off you go. And if you see a large, offended toad on the western hummocks, his name is Bartholomew, and he owes me an apology.`);
  });
  if (q('toad') < 0) qSet('toad', 0);
  qSet('main', 11);
}
async function sceneWispLearned(): Promise<any> {
  await cutscene('wisp', async () => {
    await say(EL(), `There. Now you can send a light ahead of you: to a lamp, to a stone, or to lead the gloam astray.`);
    await say(EL(), `The Gloamwood path begins north of the mill, past the wayfire at the wood's edge.`);
  }, { noBars: true });
  qSet('main', 12);
  UI.toast('Wisp (4)', 'Press 4 to send a wisp where you’re pointing, or right-click a spot. It lights lamps, raises wisp-stones and lures gloam away.', 'info', 7);
}

// ---- act three: the Gloamwood -------------------------------------------------------------------------------------------------
async function sceneHollow(): Promise<any> {
  const T: any = SITES.greatTree, o: any = N('orrin');
  await cutscene('hollow', async () => {
    camFocus(SITES.cocoon.x, T.y + 1.8, SITES.cocoon.z + 1, 17);
    await wait(1.0);
    await say(BR(), `That's a wizard. That's a wizard in a gloam pudding.`);
    await say(o, `Mmf! Don't— the braziers! Light the BRAZIERS!`);
    G.flags.hollowAwake = true;
    const e: any = spawnBoss();
    CAM.shake = 1.2; AUDIO.roar?.();
    camFocus(e.x, e.y + 3.5, e.z, 22);
    await wait(1.6);
    await say(EL(), `It's the Wood's grief, knotted round him. It can't hold its shape in firelight. Kindle the braziers, all four, then strike!`);
  });
  qSet('main', 13);
}
async function sceneRescue(): Promise<any> {
  const o: any = N('orrin'), C: any = SITES.cocoon;
  G.flags.bossDead = true;
  await cutscene('rescue', async () => {
    camFocus(C.x, C.y + 1, C.z, 12);
    for (let i: any = 0; i < 80; i++) PS.n.spawn(C.x + rnd(-1, 1), C.y + rnd(0, 2), C.z + rnd(-1, 1), rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1), rnd(1, 2), 0.3, 0.8, _pc.set(0x140c1c), 0.7, 0, { drag: 0.8 });
    if (STORY.cocoon) STORY.cocoon.visible = false;
    await wait(1.2);
    o.talkable = true;
    await say(o, `Oh, good. Oh, very good. Hello.`);
    o.pose = 'stand'; face(o, player);
    await say(o, `You must be the wick. You're taller than in her letters.`);
    face(o, EL());
    await say(o, `You found one.`);
    await say(EL(), `I found one.`);
    face(o, player);
    await say(o, `I tried, you know. I got it all the way here. I put it to the tree, and the tree… is dead. Properly dead. You can't push a heart back into a corpse. I tried for an hour. I have never felt so silly.`);
    await say(o, `And then the Wood's grief noticed me, and wrapped me up like a sausage roll, and I've been listening to it cry ever since.`);
    await say(o, `A heart has to be given. To something living, that will take it. And the Wood is all gloam now: cold, and scattered. It won't gather in one place until it's called.`);
    await say(EL(), `Midnight. When the year turns, it comes for its fire.`);
    await say(o, `To wherever the fire is held. To the Long Field, where Thom will be standing with his whole village, waiting to hold a stone he hasn't got.`);
    await say(o, `Every year we leave the last sheaf standing on that field. For luck, we say. It was Ada's custom. It's an apology. We forgot it was an apology.`);
    await say('nar', `Orrin takes a cloth bundle from his satchel and unwraps it. The Hearthstone is not a stone at all. It is a coal the size of a fist, and it is beating, very slowly.`);
    await say(o, `You carry it. It likes you.`);
    giveHeart();
    await say(BR(), `Question. If the Wood gets its fire back, what does the village burn?`);
    await say(o, `Nothing. Not one ember descended from the heart will stay lit past midnight.`);
    await say(BR(), `Then we strike a new one. Dwarves don't borrow fire. We make it.`);
    await say(BR(), `But a new fire on a cold night needs feeding. Something warm for it to catch on.`);
    await say(EL(), `Sparks. Freely given.`);
    await say(o, `The old custom! Oh, that's— Thom will hate it. It might even work.`);
    await say(o, `Go on ahead. I'll be on the Long Field before you. I have a hat for…`);
    await say('nar', `He pats his head. There is no hat on it.`);
    await say(o, `…I had a hat for this.`);
    burst(o.x, o.y + 1, o.z, 60); AUDIO.whoosh?.('ghost');
    o.away = true;
    await wait(0.6);
  });
  qSet('main', 14);
  placeFieldCrowd();
  UI.toast('Midnight is coming', 'The whole village has gone to the Long Field. Gather what sparks you can on the way.', 'quest', 6);
}
function giveHeart() : any {
  G.items.heart = true;
  MAGIC.tint = HEART_TINT;
  G.flameMax += 4; G.flame = G.flameMax;
  UI.toast('The heart of the Wood', 'It beats in your lantern, slow and warm. Your lantern holds more flame than ever.', 'spell', 5);
  saveGame();
}
async function sceneTrollWake(): Promise<any> {
  const tr: any = N('troll');
  await cutscene('troll', async () => {
    camFocus(tr.hx, tr.y + 2.2, tr.hz + 1.8, 12);
    await say('nar', `The fire crackles. Something the size of a haystack stirs, sniffs, and opens one enormous yellow eye.`);
    if (tr.headG) tr.headG.rotation.set(0.15, 0, 0.1);
    CAM.shake = 0.5;
    await say(tr, `WHO LIT TROLL'S FIRE.`);
    await say(BR(), `…Them.`);
    await say(tr, `…Oh. Small warm one. Hello. Troll was dreaming. Of pumpkins. Is it pumpkins?`);
    const i: any = await choose(['They say you stole the Hearthstone.', 'They say you stole Wil’s pumpkins.']);
    if (i === 1) {
      await say(tr, `Troll take pumpkins that roll past the north fence. That is the deal.`);
      await say(tr, `Ada make the deal. “Keep the cold up top, Grumblethorn,” Ada say, “and the pumpkins at the north fence are yours.” Troll say: deal.`);
    } else await say(tr, `Troll not take fire. Fire hurts troll. Troll only like fire for warming feet.`);
    await say(tr, `Troll keep the high pass. Three hundred years. The cold comes down off the mountain, and troll sits on it.`);
    await say(tr, `Nobody leave pumpkins now. Nobody remember. So troll collects. Troll is not thief. Troll is… owed.`);
    await say(tr, `The sheep was lost. Sheep was cold. Troll keep sheep warm. Sheep is friend now. Name is Duchess.`);
    await say(tr, `Fire? Wizard take fire. Wizard walk past cave three nights ago, with too many hats. Wizard leave this for troll. Too small.`);
    giveHat('diplomacy'); trollAwakePose(tr);
    await say(tr, `And. Troll keep a little fire in belly, for emergencies. Small warm one is an emergency. Here.`);
    await say('nar', `Grumblethorn coughs, delicately, into his enormous hand, and offers you a single glowing ember.`);
    giveSpark('troll', 'Grumblethorn');
    await say(BR(), `That is the most disgusting kind thing I have ever seen.`);
    await say(tr, `At midnight the cold comes down for the fire. Troll come down too. Troll not like gloam.`);
  });
  G.flags.trollAwake = true; trollAwakePose(tr);
  qSet('troll', 3);
}

// ---- the story's reactions to fire, spells and places ---------------------------------------------------------------------------
HOOK.fire.push((ev: any, f: any, learned: any) => {
  const m: any = q('main');
  if (ev === 'draw') {
    if (m === 2) sceneLit();
    if (learned === 'wisp' && m === 11) sceneWispLearned();
    if (learned && SPELLS[learned]) AUDIO.chime?.(5);
    if (learned === 'reveal') UI.toast('Reveal (3)', 'Press 3 to throw candle-light around you. Hidden things show; false things fade.', 'info', 6);
    if (learned === 'flare') UI.toast('Flare (2)', 'Press 2 for a burst of white heat around you: it scatters gloam and burns brambles.', 'info', 6);
    if (learned === 'mend') UI.toast('Mend (1)', 'Press 1 to warm the whole party. Warmth is your health; the gloam steal it.', 'info', 6);
  }
  if (ev === 'kindle') {
    if (f.puzzle !== undefined) stoneKindled(f);
    if (f.id === 'ada' && m === 8) sceneAda();
    if (f.id === 'oven' && q('oven') === 0) qSet('oven', 1);
    if (f.id === 'oven' && q('oven') < 0) { qSet('oven', 0, { quiet: true }); qSet('oven', 1); }
    if (f.id === 'grate_basil') { const b: any = N('basil'); if (q('basil') < 0) qSet('basil', 0, { quiet: true }); if (q('basil') === 0) { qSet('basil', 1); if (b) { b.lines = []; UI.bubble(b, 'WHAT? Is it the dragon? …Oh. Harvest Eve. Splendid.', 4); } } }
    if (f.id === 'shrine' && q('shrine') <= 0) { if (q('shrine') < 0) qSet('shrine', 0, { quiet: true }); qSet('shrine', 1); }
    if (f.id === 'troll_fire' && q('troll') <= 1) { if (q('troll') < 0) qSet('troll', 0, { quiet: true }); qSet('troll', 2); UI.bubble(N('troll'), '…hrrmmf… warm…', 3); }
    if (f.beacon) { const n: any = ['heath', 'meadow', 'gloamridge', 'westridge'].filter((b: any) => fireLit('bc_' + b)).length; UI.toast('Beacon lit', `${f.label} burns. You can travel here from the map (M). ${n}/4 beacons lit.`, 'flame', 4); if (q('watch') === 2 && n === 4) qSet('watch', 3); }
    if (f.wayfire) UI.toast('Wayfire lit', `${f.label}: you can travel here from the map (M).`, 'flame', 4);
    if (f.id.startsWith('hollow')) AUDIO.whoosh?.('ghost');
  }
  if (ev === 'break' && f.id === 'collapse' && q('tunnel') <= 0) { if (q('tunnel') < 0) qSet('tunnel', 0, { quiet: true }); qSet('tunnel', 1); }
  if (ev === 'boss') { dropHats(f.x, f.y, f.z); wait(1.8).then(() => sceneRescue()); }
  if (ev === 'lamp') { const n: any = LAMPS.filter((l: any) => l.lit).length; UI.toast('Wisp-lamp', `${n}/${LAMPS.length} lamps burn along the Gloamwood path. The gloam keep clear of them.`, 'flame', 3); UI.updateTracker(); }
  if (ev === 'stones') UI.toast('Wisp-stones', 'Old stepping stones rise out of the water.', 'flame', 3);
});
HOOK.quest.push((id: any, stage: any) => {
  if (id === 'main' && stage >= 6) G.flags.campOpen = true;
  if (id === 'main' && stage === 6) { const rook: any = N('rook'); if (rook) putAt(rook, SITES.watch.x + 2.4, SITES.watch.z + 4.3, PI, { act: 'spear' }); }
  if (id === 'main' && stage === 7) G.flags.stonesOpen = true;
  if (id === 'main') { UI.updateTracker(); }
});

// ---- per frame ---------------------------------------------------------------------------------------------------------------------
function storyUpdate(dt: any, t: any) : any {
  if (!G.started) return;
  G.stats.play += dt;
  updateFenWisps(dt, t); updateHats(t); updateSlab(dt); updateHart(dt, t); updateHartDissolve(dt);
  finaleUpdate(dt);
  if (SITES.barrowCurtain) { const d: any = Math.hypot(player.x - SITES.barrowDoor.x, player.z - SITES.barrowDoor.z); const o: any = G.flags.slabOpen ? clamp(1 - UG.k * 1.6, 0, 1) * (d < 6 ? 1 : 1) : 1; SITES.barrowCurtain.material.opacity = o; SITES.barrowCurtain.visible = o > 0.01 && !UG.surfHidden; }
  if (STORY.toad) STORY.toad.visible = !UG.surfHidden && (STORY.toad.userData.home ? true : q('toad') < 1);
  if (STORY.cocoon) { STORY.cocoon.visible = q('main') < 14 && !UG.surfHidden; STORY.cocoon.material.uniforms.uT.value = t; }
  if (STORY.slab && STORY.slab.mesh) STORY.slab.mesh.visible = !UG.surfHidden && (!STORY.slab.open || STORY.slab.t !== null && STORY.slab.t !== undefined);
  if (STORY.hart && STORY.hart.g.visible && UG.surfHidden) STORY.hart.g.visible = false;
  for (const st of STONESETS) if (st.meshes) for (const mm of st.meshes) mm.visible = !!st.up && !UG.surfHidden;
  for (const l of LAMPS) if (l.glow) l.glow.visible = !!l.lit && !UG.surfHidden;
  UI.trackT = (UI.trackT || 0) - dt; if (UI.trackT <= 0) { UI.trackT = 1.5; UI.updateTracker(); }
  STORY.saveT = (STORY.saveT || 0) + dt;
  if (STORY.saveT > 15 && !SCENE.active && !COMBAT.down) { STORY.saveT = 0; saveGame(true); }
  if (SCENE.active || DLG.active || UI.paused) return;
  const m: any = q('main');
  // triggers
  if (m === 0) { const th: any = N('thom'); if (th && Math.hypot(player.x - th.x, player.z - th.z) < 6.5) sceneAlarm(); }
  // what the story waits for may already have happened: a fire lit early, or a page closed halfway through a scene
  if (m === 2 && G.spells.mend) { sceneLit(); return; }
  if (m === 8 && UG.zone === 'crypt' && fireLit('ada') && UGP.adaTomb && Math.hypot(player.x - UGP.adaTomb.x, player.z - UGP.adaTomb.z) < 6.5) { sceneAda(); return; }
  if (m === 11 && G.spells.wisp) { sceneWispLearned(); return; }
  if (q('watch') === 2 && ['heath', 'meadow', 'gloamridge', 'westridge'].every((b: any) => fireLit('bc_' + b))) qSet('watch', 3);
  if (m === 9 && !UG.zone && Math.hypot(player.x - SITES.barrowDoor.x, player.z - SITES.barrowDoor.z) < 14) sceneConfession();
  if (m === 12 && Math.hypot(player.x - SITES.hollow.x, player.z - SITES.hollow.z) < 21) sceneHollow();
  // the village on the Long Field is free to mingle with; the night ends at the bonfire, where Thom waits
  if (m === 14 && Math.hypot(player.x - SITES.bonfire.x, player.z - SITES.bonfire.z) < 2.5 && t - STORY.lastFieldAsk > 6) askField();
  // the watch wave
  const W: any = STATE.wave;
  if (W && q('watch') === 1) {
    W.t += dt;
    const bursts: any = [0.5, 7, 14];
    for (let k: any = 0; k < bursts.length; k++) if (W.t > bursts[k] && W.spawned <= k * 3 && W.spawned < W.n) {
      const n: any = k === 2 ? 2 : 3;
      for (let i: any = 0; i < n; i++) { const e: any = spawnEnemy(k === 2 && i === 0 ? 'shade' : 'gloamling', W.x + rnd(-5, 5), W.z + rnd(-3, 3), { zone: W.zone }); e.fade = 0.2; W.list.push(e); W.spawned++; }
    }
    if (W.spawned >= W.n && W.list.every((e: any) => !e.alive)) { STATE.wave = null; sceneWaveDone(); }
    if (Math.hypot(player.x - SITES.watch.x, player.z - SITES.watch.z) > 60) { for (const e of W.list) if (e.alive) killEnemy(e, true); STATE.wave = null; qSet('watch', 0, { quiet: true }); UI.toast('The watch', 'You left Rook to it. He’ll want your help again.', 'info'); }
  }
  // gentle nudges for the stuck
  STORY.hintT = (STORY.hintT || 0) + dt;
  if (STORY.hintT > 90 && !UI.modalOpen()) { STORY.hintT = 0; storyHint(); }
}
function storyHint() : any {
  const m: any = q('main');
  const h: any = m === 2 ? [EL(), 'Hold the lantern to the cauldron fire. F, by the fire.'] : m === 3 ? [BR(), 'Down the stairs in the tower. Candles. Let’s get it over with.']
    : m === 5 && !G.spells.flare ? [BR(), 'The forge. East side of the square. Draw from it.'] : m === 7 && !G.spells.reveal ? [EL(), 'We need candle-light to read that altar. The chapel’s candles are old enough.']
      : m === 11 ? [EL(), 'Stand still by a wisp. Let it come to you.'] : null;
  if (h) UI.bubble(h[0], h[1], 4.5);
}

// ---- starting, continuing, travelling ------------------------------------------------------------------------------------------------
function startGame(save: any) : any {
  G = save ? Object.assign(newGame(), save) : newGame();
  G.started = true;
  restoreWorld();
  UI.buildSpellbar();
  if (save) {
    const m: any = q('main');
    if (m >= 15 && !G.ending) G.q.main = 14;   // the finale replays from the edge of the field
    if (m === 13 && !G.flags.bossDead) { G.flags.hollowAwake = true; spawnBoss(); }
    const p: any = G.pos;
    if (p && Number.isFinite(p.x)) { teleportParty(p.x, p.z, p.face ?? 0, p.y); fixPartyY(); }
    else teleportParty(-3.6, -14.4, 0);
    TIME.h = G.ending ? 6.6 : (G.time ?? 17.3);
    UI.updateTracker();
    UI.showBanner('Emberwick', G.ending ? 'The morning after' : 'Harvest Eve');
  } else sceneOpening();
  UI.updateTracker();
}
function restoreWorld() : any {
  if (q('oven') === 1 && G.sparks.includes('mira')) G.q.oven = 2;   // saves from before the oven had a hand-in step
  for (const f of KFIRES) if (G.fires[f.id] !== undefined && f.lit !== G.fires[f.id]) setFireLit(f, G.fires[f.id], true);
  for (const l of LAMPS) if (G.lamps[l.id] && !l.lit) lightLamp(l, true);
  for (const s of STONESETS) if (G.stones[s.id] && !s.up) raiseStones(s, true);
  for (const tt of THORNS) if (G.thorns[tt.id] && !tt.burnt) burnThorns(tt, true);
  for (const b of BREAKABLES) if (G.flags['broke_' + b.id] && !b.broken) breakIt(b, true);
  for (const h of G.hats) hideHat(h);
  if (G.flags.slabOpen) openSlab(true);
  if (G.flags.cryptWall) dispelCryptWall(true);
  if (G.flags.lantern) giveLantern();
  if (G.items.heart) MAGIC.tint = HEART_TINT;
  if (G.flags.stonesSolved) {
    for (const s of SITES.circle.stones) setFireLit(s.fire, true, true);
    if (!G.flags.slabOpen) openSlab(true);
    if (q('main') === 7) G.q.main = 8;
  } else {
    // pick the puzzle up where it was left: the stones lit so far in the right order count, anything else starts over
    const byK: any = {}; for (const s of SITES.circle.stones) byK[s.fire.puzzle ?? s.k] = s.fire;
    let k: any = 0; while (k < STONE_ORDER.length && byK[STONE_ORDER[k]]?.lit) k++;
    if (SITES.circle.stones.filter((s: any) => s.fire.lit).length !== k) { for (const s of SITES.circle.stones) setFireLit(s.fire, false, true); k = 0; }
    STATE.stoneStep = k;
  }
  applyNPCState();
  if (q('main') >= 4 && !G.ending) { const th: any = N('thom'); if (th && q('main') < 14) th.act = 'shiver'; }
  if (G.ending) applyMorning();
}
async function fastTravel(f: any): Promise<any> {
  await cutscene('travel', async () => {
    await fadeOut(0.5);
    const a: any = Math.atan2(-f.x - 4, -f.z + 10), x: any = f.x + Math.sin(a) * 2.4, z: any = f.z + Math.cos(a) * 2.4;
    teleportParty(x, z, a);
    fixPartyY();
    for (const e of COMBAT.enemies) if (e.alive && !e.boss && Math.hypot(e.x - x, e.z - z) < 30) killEnemy(e, true);
    await wait(0.25);
    await fadeIn(0.6);
  }, { noBars: true });
  saveGame();
}
