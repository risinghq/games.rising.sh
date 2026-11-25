// ============================================================================
//  THE STORY — quests, the people of the vale and what they have to say.
//  (Scenes, memories and the night's events are in 16_scenes.js.)
// ============================================================================
const N = id => CHARS.find(c => c.id === id);
const BR = () => PARTY[1], EL = () => PARTY[2];
const act = () => { const m = q('main'); return G.ending ? 'E' : m < 1 ? 'A0' : m < 6 ? 'A1' : m < 12 ? 'A2' : m < 15 ? 'A3' : 'F'; };
const near = (x, z, r) => Math.hypot(player.x - x, player.z - z) < r;
const fireLit = id => !!fireById(id)?.lit;

// ---- quests ------------------------------------------------------------------------------------------------
// stage: { short, text, log (what the journal remembers once you've moved on), at() -> {x, z, ug} }
const at = (x, z, ug) => ({ x, z, ug: !!ug });
const atC = id => () => { const c = N(id); return c && !c.away ? at(c.x, c.z, c.ug) : null; };
const atF = id => () => { const f = fireById(id); return f ? at(f.x, f.z, f.ug) : null; };
const QUESTS = {
  main: { title: 'The Long Night', stages: [
    { short: 'Harvest Eve', text: 'The Harvest festival is about to begin. Find Elder Thom in the village square.', log: 'Arrived in Emberwick for the Harvest festival.', at: atC('thom') },
    { short: 'The Warm Lantern', text: 'The Hearthstone is gone, and so is the wizard Orrin. His apprentice Pell wants you in the tower.', log: 'The Hearthstone was stolen. Without it, every fire in Emberwick dies at midnight.', at: () => at(-30, -24.6) },
    { short: 'Fill the Lantern', text: 'Orrin left you a lantern. Hold it to the fire under Pell’s cauldron and draw its flame (F).', log: 'Orrin left a lantern for “a stranger who walks with a dwarf and an elf”. It lit for you.', at: atF('cauldron') },
    { short: 'The Empty Cradle', text: 'Go down to Orrin’s undercroft beneath the tower. Kindle the cold candles beside the empty cradle (F).', log: 'Pell says candles remember.', at: () => UG.zone === 'vault' ? atF('vault')() : CUT.b === V.tower ? (p => at(p[0], p[1]))(V.tower.local(-2.55, 0)) : at(-30, -24.6) },
    { short: 'What Orrin Did', text: 'The candles remembered: Orrin took the Hearthstone himself. Tell Elder Thom.', log: 'Orrin took the Hearthstone himself. “Forgive me, Thom. Not this year.”', at: atC('thom') },
    { short: 'Forge-fire', text: 'Captain Rook says you’ll want fire with teeth before dark. Draw flame from Hilda’s forge, then talk to Hilda.', log: 'Thom asked us to find Orrin before midnight.', at: () => fireLit('forge') && !G.spells.flare ? atF('forge')() : atC('hilda')() },
    { short: 'The West Road', text: 'Orrin walked the west road toward the Barrow Downs every evening this week. Find where he camped, and kindle his campfire.', log: 'Hilda put forge-fire in Brakka’s axe, and gave us a spark of her hearth.', at: atF('camp_orrin') },
    { short: 'The Kindling Stones', text: () => `Light the seven stone braziers of the Kindling Stones in the right order to open the founders' barrow. The altar holds a clue${G.spells.reveal ? ' — Reveal (3) will show it' : ' that only candle-light (Reveal) can show: draw from any old candle first'}.`, log: 'At Orrin’s camp the fire showed him meeting a tall elf with a staff. Elowen.', at: () => at(REG.circle.x, REG.circle.z) },
    { short: 'The Founders’ Barrow', text: 'The stones have opened the founders’ barrow. Go down to the founders and kindle the candles on Ada’s tomb.', log: 'The Kindling Stones answered. The barrow stands open.', at: () => UG.zone === 'crypt' && UGP.adaTomb ? at(UGP.adaTomb.x, UGP.adaTomb.z, true) : at(SITES.barrowDoor.x + 2, SITES.barrowDoor.z) },
    { short: 'Elowen', text: 'Elowen wants to talk, away from the dead. Leave the barrow.', log: 'Ada Emberwick cut the Hearthstone from the heart of the Wood. Every Kindler since has paid for it with their warmth.', at: () => at(SITES.barrowDoor.x + 3, SITES.barrowDoor.z) },
    { short: 'Mother Hesk', text: 'Orrin went into the Gloamwood, whose path is warded with wisp-lamps. Mother Hesk, out in the Wisp Fen, knows how to catch a wisp.', log: 'Elowen is of the Wood. She brought us here for its heart.', at: atC('hesk') },
    { short: 'Catch a Wisp', text: 'Stand still near a wisp over the fen pools and let it come to your lantern. Then draw its flame (F).', log: 'Mother Hesk: wisps come to warm things that hold still.', at: () => { const w = nearestWispFire(); return w ? at(w.x, w.z) : null; } },
    { short: 'The Gloamwood', text: () => { const n = LAMPS.filter(l => l.lit).length; return `Follow the old path into the Gloamwood, north of the mill. Light its wisp-lamps with Wisp (4) — ${n}/${LAMPS.length} lit — and burn the brambles with Flare (2).`; }, log: 'We learned to send a wisp ahead of us.', at: () => { const l = LAMPS.find(l2 => !l2.lit); if (l && Math.hypot(player.x - SITES.hollow.x, player.z - SITES.hollow.z) > 30) return at(l.x, l.z); return at(SITES.hollow.x, SITES.hollow.z); } },
    { short: 'The Hollow', text: () => `The Hollow is a knot of the Wood’s grief, wrapped around Orrin. Kindle its four cold braziers (${SITES.hollow.braziers.filter(f => f.lit).length}/4) to burn away its shroud, then strike with Flare.`, log: 'In the heart of the Gloamwood, the Hollow rose.', at: () => { const b = SITES.hollow.braziers.find(f => !f.lit); return b ? at(b.x, b.z) : at(SITES.hollow.x, SITES.hollow.z); } },
    { short: 'Before Midnight', text: () => `Midnight is coming. A new fire will need sparks freely given — you carry ${G.sparks.length} of ${SPARK_TOTAL} (seven would be plenty). The village is waiting on the Long Field in the Southfields: talk to anyone there, then join Thom at the bonfire when you're ready.`, log: 'We freed Orrin. The heart of the Wood is in your lantern.', at: () => near(SITES.sheaf.x, SITES.sheaf.z, 18) ? at(SITES.bonfire.x - 1.7, SITES.bonfire.z + 0.8) : at(SITES.sheaf.x + 15.5, SITES.sheaf.z - 3) },
    { short: 'The Long Field', text: 'The whole village is on the Long Field, and the Wood has come for its heart.', log: 'At midnight, on the Long Field, the Wood came for its heart.', at: () => at(SITES.sheaf.x, SITES.sheaf.z) },
    { short: 'Midnight', text: 'Hold on until midnight.', log: 'The year turned.', at: null },
    { short: 'Morning', text: 'The long night is over.', log: '', done: true, at: null },
  ] },
  oven: { side: true, title: 'A Cold Oven', stages: [
    { text: 'Mira’s oven went out when she ran to the square, for the first time in twenty years. Kindle it.', at: atF('oven') },
    { text: () => `Mira’s oven is warm again. Go and tell her${q('main') >= 14 ? ' — she’s with everyone on the Long Field' : ''}.`, at: atC('mira') },
    { text: 'Mira’s oven is warm again.', done: true, log: 'Mira’s oven, warm again.' },
  ] },
  basil: { side: true, title: 'The Sleeping Knight', stages: [
    { text: 'Sir Basil has slept upstairs at the Gilded Goose since noon, and his grate has gone cold. Marta wants it lit.', at: atF('grate_basil') },
    { text: 'The grate is lit and Sir Basil is awake. Tell Marta.', at: atC('marta') },
    { text: 'Sir Basil is awake, warm and very confused.', done: true },
  ] },
  shrine: { side: true, title: 'A Light for Travellers', stages: [
    { text: 'Sister Agnes asks you to carry a flame to the travellers’ shrine at the crossroads, south of the Long Field, so anyone walking home tonight has a light.', at: atF('shrine') },
    { text: 'The shrine is lit. Tell Sister Agnes.', at: atC('agnes') },
    { text: 'The travellers’ shrine burns at the crossroads.', done: true },
  ] },
  pumpkins: { side: true, title: 'The Three Berthas', stages: [
    { text: 'Farmer Wil’s prize pumpkins are gone and Rook blames the troll. Look around Wil’s farm in the Southfields — his hearth went cold while he was out searching.', at: atF('hearth_farm') },
    { text: 'Wil’s hearth remembered two small thieves in very big boots. They rolled the pumpkins toward the old barn.', at: () => SITES.stash ? at(SITES.stash.x, SITES.stash.z) : null },
    { text: () => `The Berthas are hidden under the hay in the barn. Have a word with Pip and Nell ${q('main') >= 14 ? 'on the Long Field' : 'in the village square'}.`, at: atC('pip') },
    { text: 'Tell Farmer Wil where his pumpkins are.', at: atC('wil') },
    { text: 'The Three Berthas are home.', done: true },
  ] },
  watch: { side: true, title: 'The North Watch', stages: [
    { text: 'Captain Rook is holding the North Watch on the cave road alone. Help him.', at: atC('rook') },
    { text: 'Hold the watch until the gloam break.', at: atC('rook') },
    { text: () => `Light the four hill beacons so the watch can see the gloam coming: ${['heath', 'meadow', 'gloamridge', 'westridge'].filter(b => fireLit('bc_' + b)).length}/4 lit.`, at: () => { let best = null, bd = 1e9; for (const b of ['heath', 'meadow', 'gloamridge', 'westridge']) { const f = fireById('bc_' + b); if (!f.lit) { const d = Math.hypot(f.x - player.x, f.z - player.z); if (d < bd) { bd = d; best = f; } } } return best ? at(best.x, best.z) : null; } },
    { text: 'All four beacons burn. Tell Captain Rook.', at: atC('rook') },
    { text: 'The beacons burn on the hills.', done: true },
  ] },
  toad: { side: true, title: 'Bartholomew', stages: [
    { text: 'Bartholomew, Mother Hesk’s toad, is sulking on an island in the west of the fen. Send a wisp to the old stepping stones to raise them.', at: () => at(SITES.toadIsle.x, SITES.toadIsle.z) },
    { text: 'Carry Bartholomew home to Mother Hesk.', at: atC('hesk') },
    { text: 'Bartholomew is home, and still offended.', done: true },
  ] },
  cat: { side: true, title: 'There’s Always a Cat', stages: [
    { text: 'Old Bess’s cat Smudge hasn’t come home. Ned the fisherman might have seen him.', at: atC('ned') },
    { text: 'Ned saw a cat on a little island at the end of the old boardwalk in the fen, where the planks have rotted. Wisp-stones might bridge the gap.', at: () => at(SITES.catIsle.x, SITES.catIsle.z) },
    { text: 'Carry Smudge home to Old Bess.', at: atC('bess') },
    { text: 'Smudge is home, by the fire, as if he never left.', done: true },
  ] },
  troll: { side: true, title: 'The Troll Did It?', stages: [
    { text: 'Everyone blames Grumblethorn the troll. His cave is up the cave road north of the village. Hear his side — gently.', at: () => UG.zone === 'cave' ? atF('troll_fire')() : at(MOUTH.x, MOUTH.z + 4) },
    { text: 'Grumblethorn’s fire has gone out. Trolls sleep deeper in the cold. Kindle it.', at: () => UG.zone === 'cave' ? atF('troll_fire')() : at(MOUTH.x, MOUTH.z + 4) },
    { text: 'The fire is lit. Wake Grumblethorn.', at: () => UG.zone === 'cave' && UGP.troll ? at(UGP.troll.x, UGP.troll.z + 3.4, true) : at(MOUTH.x, MOUTH.z + 4) },
    { text: 'Grumblethorn has guarded the high pass for three hundred years. He’ll come down at midnight.', done: true },
  ] },
  tunnel: { side: true, title: 'The North Tunnel', stages: [
    { text: 'Nettle the smuggler left a sack on the far side of the north tunnel when the roof came down. A flare might shift the rubble.', at: () => UG.zone ? at(UGP.collapse[0], UGP.collapse[1], true) : at(-4.5, -15.6) },
    { text: 'The way is clear. Fetch Nettle’s sack.', at: () => UG.zone ? at(UGP.nettleSack.x, UGP.nettleSack.z, true) : at(-4.5, -15.6) },
    { text: 'Bring Nettle her sack. She’s in the smugglers’ den, through the Gilded Goose’s cellar.', at: () => UG.zone ? atC('nettle')() : at(-4.5, -15.6) },   // on the surface, point at the Goose's door
    { text: 'Nettle has her sack back.', done: true },
  ] },
};
const SPARK_NAMES = {
  hilda: 'Hilda’s forge-spark', mira: 'Mira’s oven-spark', marta: 'the Goose’s hearth-spark', agnes: 'the chapel’s candle-spark', wil: 'Wil’s hearth-spark',
  twins: 'Pip and Nell’s sparkler', rook: 'the watch-fire’s spark', hesk: 'Hesk’s cauldron-spark', bess: 'Bess’s hearth-spark', troll: 'Grumblethorn’s belly-ember',
};
const HATS = [
  { id: 'thinking', name: 'The Thinking Hat', note: 'smells faintly of worry and toast' },
  { id: 'invisible', name: 'The Invisible Hat', note: 'only there if you look properly' },
  { id: 'camping', name: 'The Camping Hat', note: 'a pocket for biscuits; no biscuits' },
  { id: 'visiting', name: 'The Visiting Hat', note: 'for calling on the dead politely' },
  { id: 'garden', name: 'The Gardening Hat', note: 'Gerald the scarecrow looks colder without it' },
  { id: 'disguise', name: 'The Disguise Hat', note: 'a false beard is sewn inside' },
  { id: 'diplomacy', name: 'The Hat of Diplomacy', note: 'it has tooth marks' },
  { id: 'worry1', name: 'The First Hat of Worry', note: 'still cold from the Hollow' },
  { id: 'worry2', name: 'The Second Hat of Worry', note: 'even colder' },
  { id: 'worry3', name: 'The Third Hat of Worry', note: 'never trust a man with more than three hats' },
];
const ITEMS = {
  toad: { name: 'Bartholomew', note: 'a toad of enormous dignity' },
  cat: { name: 'Smudge', note: 'purring like a kettle' },
  sack: { name: 'Nettle’s sack', note: 'clinks; best not to ask' },
  heart: { name: 'The heart of the Wood', note: 'it beats, very slowly, in your lantern' },
};
function giveHat(id) {
  if (G.hats.includes(id)) return;
  G.hats.push(id);
  G.flameMax += 1; G.flame = Math.min(G.flameMax, G.flame + 1);
  const H = HATS.find(h => h.id === id);
  UI.toast(`Orrin’s hat (${G.hats.length}/${HATS.length})`, `${H.name} — ${H.note}. Your lantern holds a little more flame.`, 'spark');
  hideHat(id);
  saveGame();
}

// ---- conversations -------------------------------------------------------------------------------------------
// TALK[id](c) returns an async conversation (or null to fall back on chatter)
async function oneOf(c, lines) { c._li = ((c._li ?? -1) + 1) % lines.length; await say(c, lines[c._li]); }
const TALK = {
  // -- the Elder --
  thom: c => {
    const m = q('main');
    if (m === 0) return () => sceneAlarm();
    if (m === 4) return () => sceneReport();
    if (G.ending) return async () => oneOf(c, ENDLINES.thom());
    if (m === 14) return () => askField();
    if (m >= 15) return null;
    return async () => {
      if (m >= 9 && !G.flags.thomPrice) {
        await say(c, m >= 12 ? `The Long Field at midnight. I'll be there, stone or no stone.` : `Any word of Orrin? Of the stone?`);
        const i = await choose(['Ada told us what the Kindling costs.', 'Not yet.']);
        if (i === 0) {
          G.flags.thomPrice = true;
          await say(c, `Did she.`);
          await say(c, `...Then you know why it has to be me. I'm seventy-one. I've buried a wife and a brother. Better me than someone with a life still in front of them.`);
          await say(BR(), `That's not how it works. You don't get to be cold so they can be warm.`);
          await say(c, `That is exactly how it works, Master Dwarf. That's what an Elder is for.`);
          c.act = 'warm';
        } else await say(c, `Then hurry. Please.`);
        return;
      }
      await oneOf(c, m < 4 ? [
        `Go with Pell. If Orrin left you something, he meant you to have it.`,
        `Eleven Harvests I've carried that stone. I don't know what to do with my hands without it.`,
        `Rook will tear the mountain apart looking for that troll. Let him. It keeps him warm.`,
      ] : m < 12 ? [
        `Find Orrin. Find the stone. And come back, the three of you. The gloam are worse every year.`,
        `My hands? Old man's hands. Always cold. Don't fuss.`,
        `Keep to the paths after dark. The wayfires will see you home.`,
      ] : [
        `The Long Field at midnight. I'll be there, stone or no stone.`,
        `If you find him, tell that old fool I'm not angry. Tell him I'm furious, but I'm not angry.`,
      ]);
    };
  },
  // -- the apprentice --
  pell: c => {
    const m = q('main');
    if (m === 1) return () => sceneLantern();
    if (G.ending) return async () => oneOf(c, ENDLINES.pell());
    return async () => {
      if (m === 2) return void await say(c, `Hold it to the fire under the cauldron and… want it. That's all Master ever told me. You have to want it.`);
      if (m === 3) return void await say(c, `The undercroft stairs are behind me. Mind Fizzwick, he bites. Verbally.`);
      if (m >= 4 && m < 7 && !G.flags.pellWest) {
        G.flags.pellWest = true;
        await say(c, `He took it himself? …He must have had a reason. He always has a reason. Usually it's a terrible reason, but it's a reason.`);
        await say(c, `He's been walking out the west road every evening this week. Toward the Downs. Said he was “reading old stones”. He came back frozen every night.`);
        return;
      }
      await oneOf(c, m < 14 ? [
        `Master Orrin has a hat for everything. Thinking, walking, telling the Elder he's wrong. He took three with him. Three is a bad sign.`,
        `The top floor's his study. If he left a clue, it's up there, under a hat.`,
        `I've kept the cauldron going. It's the only thing in this tower I know how to do.`,
      ] : [
        `You found him! Is he— is he wearing a hat? He's not wearing a hat. Oh no.`,
        `I'll be on the Long Field with everyone. I'm bringing the cauldron. Don't ask.`,
      ]);
    };
  },
  // -- the captain --
  rook: c => {
    const m = q('main'), w = q('watch');
    if (G.ending) return async () => oneOf(c, ENDLINES.rook());
    if (m >= 6 && m < 15 && w <= 0) return () => sceneWatchStart();
    if (w === 3) return async () => {
      await say(c, `Four beacons. I can see the Heath from here, and the ridge, and the meadow. Like the old days.`);
      await say(c, `I don't hand these out. Hilda says it's a custom. I say it's a soft custom. Here.`);
      giveSpark('rook', 'Captain Rook'); qSet('watch', 4);
      await say(c, `If your fire ever goes out, come to mine. …Don't tell anyone I said that.`);
    };
    return async () => {
      if (G.flags.trollAwake && !G.flags.rookTroll && m >= 6) {
        G.flags.rookTroll = true;
        await say(c, `The troll guards the pass? Has guarded it for three hundred years? And nobody told the watch?`);
        await say(BR(), `To be fair, you'd have tried to arrest him.`);
        await say(c, `…I would have tried to arrest him.`);
        return;
      }
      await oneOf(c, m === 0 ? [`Evening. Keep your companions close after dark.`, `Quiet patrol. Lost goats, loud bards. The usual.`]
        : m < 5 ? [`If that troll's got the stone I'll have it back if I have to pull it out of his teeth.`, `Footprints the size of washtubs, all up the cave road. You tell me that's not a troll.`]
          : m === 5 ? [`Hilda. Forge. Now. You want fire with teeth before dark.`]
            : w === 2 ? [`Four beacons, four hills. The Heath by the fen, the Meadow over the river, the Gloamridge east of the wood and the Westridge on the downs.`]
              : [`They come down off the mountain in threes and fours. If they get past me, they get to the Long Field.`, `Keep your lantern full. They go for the light first.`]);
    };
  },
  // -- the smith --
  hilda: c => {
    const m = q('main');
    if (m === 5 && G.spells.flare) return () => sceneAxe();
    if (G.ending) return async () => oneOf(c, ENDLINES.hilda());
    return async () => {
      if (m === 5) return void await say(c, `Rook sent you. Course he did. Draw from the forge first — go on, it doesn't bite. Much.`);
      await oneOf(c, m < 5 ? [`Mind the sparks. They don't mind you.`, `Nine years that forge has burned. I'm not letting it go out for a festival, and I'm not letting it go out for a wizard.`]
        : [`How's the axe, dwarf?`, `If the fires go out at midnight, mine goes with them. Nine years. Gone in a breath. Find that stone.`, `Sparks are for friends. Don't waste them.`]);
      if (c._li === 0 && m > 5) await say(BR(), `Singing.`);
    };
  },
  // -- the innkeeper and her sleeping guest --
  marta: c => async () => {
    const b = q('basil');
    if (G.ending) return void await oneOf(c, ENDLINES.marta());
    if (b < 0 && q('main') >= 1) {
      await say(c, `Oh, love, you've a lantern — a working one? Then you can help me. Sir Basil's been asleep upstairs since noon and the grate in his room's gone cold.`);
      await say(c, `If the fires die at midnight I don't want him dying with them, the daft old knight. Light it for me? Room at the west end.`);
      qSet('basil', 0); return;
    }
    if (b === 1) {
      await say(c, `He's up? Talking about dragons? That's him, then. Bless you.`);
      await say(c, `Here. My hearth's been lit from the Hearthstone every year since I was a girl. Take a spark of it. Old custom.`);
      giveSpark('marta', 'Marta'); qSet('basil', 2); return;
    }
    await oneOf(c, q('main') === 0 ? [`Welcome to the Gilded Goose, loves! Hot cider's on the hob, and the stew's only slightly haunted.`, `Elder Thom will light the lanterns at dusk. You don't want to miss it.`]
      : [`Hot cider, on the house tonight. Nobody's paying for anything on a night like this.`, `Dunstan's in the cellar counting barrels. He counts when he's scared.`, `If you're going out after dark, take a scarf. Take two.`]);
  },
  basil: c => async () => {
    if (q('basil') === 1 || q('basil') === 2) { await oneOf(c, [`A dragon! I was dreaming of a dragon. It was very polite.`, `Harvest Eve already? Splendid. Is there cider? There's always cider.`, `I am a knight. Retired. Mostly from being awake.`]); return; }
    await say('nar', 'Sir Basil is asleep. He is snoring in a way that suggests he has done it professionally for years.');
  },
  // -- the baker --
  mira: c => async () => {
    const o = q('oven');
    if (G.ending) return void await oneOf(c, ENDLINES.mira());
    if (q('main') >= 1 && o < 0 && !fireLit('oven')) {
      await say(c, `My oven! I ran out when the bell rang and it went out. It's not been out in twenty years. Twenty! I could weep into the dough.`);
      if (G.flags.lantern) await say(c, `Is that a wick-lantern? Like Orrin's? Oh, please — kindle it for me. Just a breath of flame, it'll do the rest.`);
      else await say(c, `If only somebody could carry a flame in here without it blowing out…`);
      qSet('oven', 0); return;
    }
    if (o === 1) {
      await say(c, q('main') >= 14 ? `You lit it? Even with all this? Thank you, thank you. Take a spark — it's custom, and anyway you've earned a whole loaf.` : `Listen to it. Purring. Thank you, thank you. Take a spark — it's custom, and anyway you've earned a whole loaf.`);
      giveSpark('mira', 'Mira'); qSet('oven', 2); return;
    }
    await oneOf(c, [`Pumpkin loaf, fresh! Careful, it's hotter than gossip.`, `I've been baking since before dawn. The oven never sleeps, so neither do I.`, `If the fires go out at midnight, I'm going to hug this oven until it lights again.`]);
  },
  // -- the chapel --
  agnes: c => async () => {
    const s = q('shrine'), m = q('main');
    if (G.ending) return void await oneOf(c, ENDLINES.agnes());
    if (m >= 1 && s < 0) {
      await say(c, `Every Harvest Eve I carry a flame from this altar to the travellers' shrine at the crossroads, so anyone walking home tonight has a light.`);
      await say(c, `I can't leave the chapel tonight — too many frightened people with candles. Would you carry it for me? South road, past the Long Field.`);
      qSet('shrine', 0); return;
    }
    if (s === 1) {
      await say(c, `You lit it. Then somebody, somewhere tonight, will find their way home. That's a better prayer than any I know.`);
      giveSpark('agnes', 'Sister Agnes'); qSet('shrine', 2); return;
    }
    if (m >= 9 && !G.flags.agnesAda) {
      G.flags.agnesAda = true;
      await say(c, `You've been to the founders. I can see it on you — the dead leave a chill.`);
      await say(c, `We pray for Ada Emberwick every Harvest. “She brought the fire over the mountain.” I wonder now if we were praying for the right thing.`);
      return;
    }
    await oneOf(c, [`Light a candle for the harvest, traveller.`, `The candles on this altar were lit from the Hearthstone last Harvest. Old candle-flame sees clearly. That is what the Book says, anyway.`, `Fear is a cold thing. Stand by the candles a moment.`]);
  },
  // -- the weaver --
  bess: c => async () => {
    const k = q('cat');
    if (G.ending) return void await oneOf(c, ENDLINES.bess());
    if (k < 0 && q('main') >= 1) {
      await say(c, `Sit, sit. Mind the cat. …There's no cat. That's the trouble. Smudge hasn't come home and it's nearly dark.`);
      await say(c, `Grey, one white sock, opinions about everything. Ned the fisherman sees everything that moves on the water. Ask him.`);
      qSet('cat', 0); return;
    }
    if (k === 2) {
      await say(c, `SMUDGE. You wretched, wandering… oh, come here.`);
      await say('nar', 'Smudge pours himself out of your arms and onto the hearthrug, as if he has been there all evening.');
      await say(c, `I've nothing to give you but a spark of my hearth. It's old, and it's mine, and it's yours.`);
      G.carry = null; carryShow(null); G.items.cat = false;
      giveSpark('bess', 'Old Bess'); qSet('cat', 3); placeCatHome(); return;
    }
    await oneOf(c, [`Fifty years at that loom. My fingers know the pattern better than I do.`, `There's always a cat. Except tonight.`, `Out on the fen after dark? Take a stick. For the wisps, not for Smudge.`]);
  },
  ned: c => async () => {
    if (G.ending) return void await oneOf(c, ENDLINES.ned());
    if (q('cat') === 0) {
      await say(c, `A grey cat? One white sock? Aye. Out on the fen this afternoon, at the end of the old cat-walk, on the little island. Sitting there like he'd paid for it.`);
      await say(c, `Planks have rotted through near the end. You'd want stepping stones. The old wisp-stones, if you can wake them.`);
      qSet('cat', 1); return;
    }
    await oneOf(c, [`Shh. You'll scare the fish. And the fish are already very nervous.`, `Caught a boot this morning. Left boot. Still waiting on the right one.`, `The wisps are out on the fen tonight. Pretty. Don't follow them.`]);
  },
  // -- the farmer and the twins --
  wil: c => async () => {
    const p = q('pumpkins');
    if (G.ending) return void await oneOf(c, ENDLINES.wil());
    if (p < 0 && q('main') >= 1) {
      await say(c, `My prize pumpkins are gone. Bertha, Big Bertha and the Other Bertha. Judging's tomorrow.`);
      await say(c, `Rook says troll. There's footprints, right enough. Big as washtubs. But I've lived under that mountain fifty years and the troll's never once taken a Bertha.`);
      await say(c, `Would you look about my farm? South road, past the Long Field. My hearth'll have gone cold, I've been out looking since noon.`);
      qSet('pumpkins', 0); return;
    }
    if (p === 3) {
      await say(c, `In the barn? Under the hay? All three of 'em?`);
      if (G.flags.twinsConfess) { await say(c, `…And the twins told me themselves, the little horrors. In my old boots, they said. I laughed till I cried.`); }
      else await say(c, `Must've been the troll moved them. Very considerate troll.`);
      await say(c, `You've done me a kindness on a cold night. Take a spark of my hearth.`);
      giveSpark('wil', 'Farmer Wil'); qSet('pumpkins', 4); return;
    }
    await oneOf(c, [`Biggest pumpkin contest is tomorrow. If there is a tomorrow.`, `That scarecrow on the Long Field's called Gerald. He's doing his best.`, `We always leave the last sheaf standing on the Long Field. For luck. My granddad did, and his.`]);
  },
  pip: c => () => twinsTalk(c),
  nell: c => () => twinsTalk(c),
  // -- the provisioners, the grocer, the regulars --
  tobias: c => async () => oneOf(c, G.ending ? ENDLINES.minor() : act() === 'A0' ? [`Tobias & Daughters: rope, lamp oil, pumpkin seeds and potions of questionable origin.`, `My girls run things upstairs. I just count the coppers.`] : [`Lamp oil's half price tonight. Everyone's buying. Nobody's laughing.`, `Thirty years I've sold lamp oil. Never thought it'd matter.`]),
  wren: c => async () => oneOf(c, G.ending ? ENDLINES.minor() : [`Sewing festival banners. Twelve down, forty to go. I don't know why I'm still sewing. My hands like it.`, `Papa says the gloam can't come into the village while the lamps are lit. Papa says a lot of things.`]),
  greta: c => async () => oneOf(c, G.ending ? ENDLINES.minor() : act() === 'A0' ? [`Apples! Three for a copper! Pumpkins, two for a smile!`, `The lanterns are lit at dusk. Best view's right here by the fountain.`] : [`Take an apple. Take two. Nobody's buying, and I can't stand still.`, `My gran said the Wood used to be green. I thought it was a story.`]),
  hob: c => async () => oneOf(c, G.ending ? ENDLINES.minor() : [`Off to Mira's for a pumpkin loaf. Don't tell my wife.`, `If the fires go out I'm sleeping at the bakery. The oven stays warm for hours.`]),
  fennick: c => async () => oneOf(c, G.ending ? ENDLINES.minor() : [`Sixty Harvests I've sat on this stool. Sixty! The stool's held up better than I have.`, `In my day smugglers ran brandy under this very floor. Tunnels everywhere. Still are.`, `The Kindling, eh? I saw old Elder Maud do it, when I was a lad. She never came to the next one. Nobody talked about it.`]),
  lyle: c => async () => oneOf(c, G.ending ? ENDLINES.minor() : [`Oh, the goose was gold and the ale was brown… I'm still working on the second verse.`, `I'm writing a song about tonight. It doesn't have an ending yet.`]),
  quill: c => async () => oneOf(c, G.ending ? ENDLINES.minor() : [`I'm writing to my sister about Emberwick. She'll never believe the part about the troll.`, `Room three has the best view. Of the stairwell, mostly.`]),
  tamsin: c => async () => oneOf(c, G.ending ? ENDLINES.minor() : [`…and bless the bakers, and the brewers, and whoever keeps fixing the fountain, and please, please let the fires stay lit…`]),
  dunstan: c => async () => oneOf(c, G.ending ? ENDLINES.minor() : [`Dunstan. I keep the cellar. Forty barrels of cider, nineteen of ale, and one Marta says not to ask about.`, `That wine rack has always stood open like that. Nothing behind it. Just a draught. A very long, very old draught.`, `…thirty-eight, thirty-nine… I count when I'm frightened. Don't mind me.`]),
  // -- under the village --
  nettle: c => async () => {
    const t = q('tunnel');
    if (t < 0) {
      await say(c, `You didn't see me, I didn't see you. Lovely arrangement.`);
      await say(c, `East tunnel runs to the inn cellar. West goes under the wizard's tower. North… north is where the snoring comes from. We stopped going north when the roof came down.`);
      await say(c, `Left my sack on the far side, too. If you've got anything in that lantern that goes bang, I'd be grateful. Grateful-ish.`);
      qSet('tunnel', 0); return;
    }
    if (t === 2) {
      await say(c, `My sack! Don't look in it. Here — for your trouble. Found it in the tunnels years back. Pointy. Not my style.`);
      G.items.sack = false; G.carry = null; carryShow(null);
      qSet('tunnel', 3); giveHat('disguise');
      await say(c, `It's got a beard sewn in it. Smugglers' wizard, I reckon. Or a wizard's smuggler.`);
      return;
    }
    await oneOf(c, [`The north tunnel comes out in the troll's cave. We used to bring brandy down off the mountain that way. Then something big moved in and ate the delivery. And the mule.`, `Raise you a copper.`]);
  },
  fizz: c => async () => {
    const m = q('main');
    if (m >= 3 && m < 5 && !G.flags.fizzSaw) {
      G.flags.fizzSaw = true;
      await say(c, `I said NOTHING. For the record. I was asleep. Upside down. With my eyes open.`);
      await say(c, `…He said “not a word, Fizz.” So I'm not saying a word. I'm saying several hundred. He went down the west tunnel, toward the den. Then out. With three hats on. Three!`);
      return;
    }
    await oneOf(c, [`Psst! You! Open the cage and I'll grant you three wishes!`, `Fine. Two wishes. One and a half. A strongly worded suggestion?`, `Orrin calls me “a lesson in reading the small print”. The small print was VERY small.`]);
  },
  troll: c => {
    const t = q('troll');
    if (!G.flags.trollAwake && fireLit('troll_fire')) return () => sceneTrollWake();
    if (G.flags.trollAwake) return async () => oneOf(c, G.ending ? ENDLINES.troll() : [`Troll come down at midnight. Troll not like gloam.`, `Duchess is sheep. Duchess is friend. Do not eat Duchess.`, `Small Ada asked troll to keep the cold up top. Troll keep it. Three hundred years. Nobody say thank you. Troll not mind. Much.`]);
    return async () => {
      await say(c, `ZZZZzzzzz… *SNNNNRRRRK*… zzz…`);
      if (q('troll') < 0) qSet('troll', 0);
      if (!fireLit('troll_fire')) { await say(EL(), `His fire has gone out. Trolls sleep deepest in the cold. Kindle it, and he might wake kindly.`); if (q('troll') === 0) qSet('troll', 1); }
    };
  },
  // -- the fen --
  hesk: c => {
    const m = q('main'), td = q('toad');
    if (m === 10) return () => sceneHesk();
    return async () => {
      if (G.ending) return void await oneOf(c, ENDLINES.hesk());
      if (td === 1) {
        await say(c, `Bartholomew. You absolute pudding.`);
        await say('nar', 'Bartholomew is lowered into his tank. He turns his back on everyone, with enormous dignity.');
        await say(c, `He'll sulk till spring. Thank you. A spark of my cauldron for your trouble. It's green, but it's warm.`);
        G.carry = null; carryShow(null); G.items.toad = false;
        giveSpark('hesk', 'Mother Hesk'); qSet('toad', 2); placeToadHome(); return;
      }
      if (m < 10) {
        await say(c, `Don't touch the jars. If you're here about the wizard, he owes me a tank lid.`);
        if (td < 0) { await say(c, `And if you see a large, offended toad on the western hummocks, his name is Bartholomew, and he owes me an apology.`); qSet('toad', 0); }
        return;
      }
      if (td < 0) { await say(c, `If you see a large, offended toad on the western hummocks, his name is Bartholomew, and he owes me an apology.`); qSet('toad', 0); return; }
      await oneOf(c, [`Wisps come to warm things that hold still. Most people can't hold still. Most people are idiots.`, `The Gloamwood path starts north of the mill. Light the lamps as you go. The gloam hate a lit lamp.`, `Don't touch the jars.`]);
    };
  },
  brakka: c => async () => {
    const errands = [];
    if (q('oven') === 0) errands.push(`Mira's oven's still cold. A bakery with a cold oven is a crime, I'm fairly sure.`);
    if (q('oven') === 1) errands.push(`Mira doesn't know her oven's lit yet. Somebody should tell her. Somebody with a lantern.`);
    if (q('shrine') === 1) errands.push(`The shrine's burning. Sister Agnes will want to hear it.`);
    if (q('basil') === 0) errands.push(`Marta wanted that sleeping knight's grate lit. Upstairs at the Goose.`);
    if (q('shrine') === 0) errands.push(`Sister Agnes asked us to light the shrine at the crossroads. South road.`);
    if (q('cat') >= 0 && q('cat') < 2) errands.push(`Somebody's cat is sitting on an island in the fen, being smug about it.`);
    if (q('pumpkins') === 0) errands.push(`Wil's farm's down the south road. Cold hearth, he said. Cold hearths remember things, apparently.`);
    if (q('watch') === 2) errands.push(`Four beacons, four hills. Rook'll owe us. I like being owed.`);
    if (q('troll') >= 0 && !G.flags.trollAwake && q('main') >= 1) errands.push(`If everyone blames the troll, maybe someone should ask the troll. Politely. From a distance.`);
    if (G.carry) errands.push(G.carry === 'toad' ? `The toad is staring at me.` : G.carry === 'cat' ? `That cat has opinions about how you're holding it.` : `What's in the sack? …Don't tell me.`);
    const base = [`Lead on. I'll be right behind you. Well — slightly behind, and a bit below.`, `If anything in this valley needs hitting, I'm your dwarf.`, `I'm not cold. Dwarves don't get cold. We get grumpy, which is warmer.`];
    await oneOf(c, errands.length && R() < 0.7 ? errands : base);
  },
  elowen: c => async () => { await say(c, elowenHint()); },
  ada: c => async () => oneOf(c, [`Give it back, if you can. Or carry it, if you must.`, `I was so cold, child. You cannot know how cold. That is not an excuse. It is only the truth.`, `My lantern suits you.`]),
  orrin: c => async () => {
    if (G.ending) return void await oneOf(c, ENDLINES.orrin());
    await oneOf(c, [`Go on, go on. I'll catch up. I'm old, not slow. Well. I'm both.`, `Thom will be on the Long Field with his whole village. Stubborn as a gatepost and twice as wooden.`, `You've found ${G.hats.length} of my hats. ${G.hats.length >= 8 ? 'Remarkable. Keep them. I am done worrying.' : 'There are more. I lose hats the way other people lose arguments.'}`]);
  },
};

async function twinsTalk(c) {
  const p = q('pumpkins'), pip = N('pip'), nell = N('nell');
  if (G.ending) return void await oneOf(c, ENDLINES.twins());
  if (p === 2) {
    await say(pip, `We didn't do anything.`);
    await say(nell, `We especially didn't do anything in Dad's old boots.`);
    await say(BR(), `You hid three prize pumpkins under the hay in Wil's barn so everyone would blame the troll.`);
    await say(pip, `…It was a GOOD plan.`);
    await say(nell, `We were going to give them back! After the judging! So Wil would win next year instead, because everyone would feel sorry for him.`);
    const i = await choose([
      { t: 'Go and tell Wil yourselves.', sub: 'and I won’t say a word about the boots' },
      { t: 'Your secret’s safe. But they go back.', sub: 'I’ll tell Wil where they are' },
      { t: 'I’m telling Wil.' },
    ]);
    if (i === 0) {
      await say(nell, `…Fine. FINE. Come on, Pip.`);
      await say(pip, `If we're doing this we're doing it properly. Here — a sparkler. From the festival box. It's a spark. That counts.`);
      giveSpark('twins', 'Pip and Nell'); G.flags.twinsConfess = true; G.flags.twinsFate = 'confess';
    } else if (i === 1) {
      await say(pip, `You're the best grown-up we've ever met. Here, a sparkler. It's a spark. That counts.`);
      giveSpark('twins', 'Pip and Nell'); G.flags.twinsFate = 'secret';
    } else {
      await say(nell, `Traitor.`); await say(pip, `TRAITOR.`);
      G.flags.twinsFate = 'told';
    }
    qSet('pumpkins', 3);
    return;
  }
  await oneOf(c, act() === 'A0' ? [`You can't catch us!`, `Tag! You're it!`] : [`Is the troll coming? Rook says the troll's coming.`, `We're not scared of the dark. Pip is.`, `Nell cheats. Don't tell her I said that.`]);
}

function elowenHint() {
  const m = q('main');
  if (G.ending) return G.ending === 'newfire' || G.ending === 'smallfire' ? `Can you feel it? The Wood is warm at its edges. I am going home soon. Walk with me a little first.` : `…`;
  if (UG.zone === 'crypt' && m === 8 && !G.flags.cryptWall) return `That wall is too clean for a barrow. Barrows lie. Look at it properly — Reveal.`;
  return [
    `Elder Thom will be in the square, by the fountain. He lights the lanterns.`,
    `Orrin's tower is the round one at the north-west edge of the village. Pell will be inside.`,
    `Hold the lantern to the cauldron fire, and want it. Stand by the fire and press F.`,
    `The undercroft stairs go down from the tower's ground floor. Kindle the candles beside the cradle.`,
    `Thom should hear this from us, not from rumour. He was by the fountain.`,
    G.spells.flare ? `Hilda is waiting for us at the forge.` : `Hilda's forge is on the east side of the square. Draw from it, then speak to her.`,
    `Orrin's camp is out on the Barrow Downs, along the west road. Look for a cold campfire, and kindle it.`,
    G.flags.readAltar ? `East first, where the sun rises; then round the way the sun goes — south, west, and north last.` : G.spells.reveal ? `Stand by the altar in the middle of the stones and use Reveal (3).` : `We need old candle-light to read that altar. The chapel's altar candles, or the candles under the tower: draw from them.`,
    `The founders' barrow is the great mound west of the stones. Its door faces east.`,
    `Outside. Please. Under the sky.`,
    `Mother Hesk lives on an island in the Wisp Fen, south of the Downs. Follow the boardwalk out from the fen's edge.`,
    `Stand still near a wisp, lantern out, and let it come to you. Then draw its flame.`,
    `The Gloamwood path begins north of the mill. Light the lamps with Wisp (4), and burn the brambles with Flare (2).`,
    `The braziers, all four! Then strike while its shroud is down.`,
    `The Long Field is in the Southfields, south of the village, past the farms. If anyone owes us thanks, now is the time to ask for a spark.`,
    `Whatever you choose, I am glad it is you choosing.`,
    `Hold on. It is nearly midnight.`,
  ][Math.min(m, 16)];
}
