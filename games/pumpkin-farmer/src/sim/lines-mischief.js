// [Track A] The visitors' lines and the "never the same line twice" pools (plan §3.1, §3.2, §3.3, §8.4; rulings R5, R15).
// Every line is at most 110 characters with typical values filled in (tests/sim/dropins.test.js lints them), and each
// voice keeps its tic: Gran "sweet pea", Hal "Cove!" and "Awooo!", Old Moss dozes off ("... zzz."), Edna shouts and
// corrects herself, the possum mom insists she is dead, Pamela says only "Mehh." The seal, the otter and the skunks are
// seen, not heard: their lines are captions and toasts with no speaker. Pools are picked with story.fresh(), so nobody
// says the same thing twice in a row and a pool is used up before any line comes round again.
//
// Templates: {r} a row number, {n} a count, {name} the giant (story.vars), {coat} a seal's coat, {frac} how much of a
// bramble row Pamela has cleared, {spot} a place.

// The harbor seals' coats, in render/folk.js SPECIES.seal.coats order (a test keeps the two lists equal).
export const COATS = ['silver', 'sandy', 'charcoal', 'grey', 'cocoa'];
export const COAT_WORDS = { silver: 'Silver, with dark spots', sandy: 'Sandy, not a spot on her', charcoal: 'Charcoal, freckled white',
  grey: 'Grey and dappled', cocoa: 'Cocoa, faintly spotted' };

export const LINES = {
  // Biscuit's dig (slot A): Grandpa's old biscuit tin of notes (rulings R15: never "Grandpa's tin", that is the seed tin)
  dig: {
    arrive: 'Biscuit dug something up in the bramble.',
    tin: ['Grandpa\'s old biscuit tin. "BISCUITS (NOT THE DOG)." He labelled it himself, sweet pea.',
      'He buried it every spring. Said the dirt kept secrets better than he did.'],
    porch: 'Biscuit left a rusty tin on the porch. "BISCUITS (NOT THE DOG)." He looks very pleased.',
    // years 2+: Biscuit still digs in the bramble now and then (the wider finds pool is Wave 2)
    later: ['Biscuit dug up one boot. Just the one. He is so proud.', 'Biscuit dug up a bone older than the barn. He is keeping it.',
      "Biscuit dug up Gran's trowel. She lost it in '94. She is not ready to talk about it.", 'Biscuit dug up a tennis ball. Nobody here plays tennis.',
      'Biscuit dug a very good hole. There was nothing in it. He is delighted anyway.'],
    porchLater: 'Biscuit left his find on the porch. It is muddy. He is not sorry.',
  },
  seal: {
    first: "Pea soup on the beach, Cove! And a harbor seal napping in it. Seals love a sulk. Awooo!",
    firstRain: 'Rain on the beach, Cove! And a harbor seal napping in it. Seals love a wet one. Awooo!',
    beach: 'A harbor seal has hauled out on your beach. Biscuit is guarding her.',
    row: "There's a seal in Row {r}'s aisle. She found the damp bit.",
    giant: 'A seal is napping by the giant. She likes the warm.',
    met: 'Hrmf. She has met you now. {coat}. That makes {n} of 5 coats.',
    again: 'Hrmf. You two have met. {coat}, same as before.',
    leave: 'Marlene lifted, and so did the seal.',
    startle: 'BWAAAMP. The seal flumped back into the sea in a huff.',
  },
  otter: {
    look: 'A sea otter is floating in the cove with her pup on her chest.',
    wave: 'She waves. The pup waves. Biscuit loses his mind.',
    leave: 'The otter drifted off with the tide.',
    kelp: ['The otter left you kelp. The pup waved. You waved back. Very civilised.', 'Kelp delivery! The otter would like you to know it was heavy.',
      'The otter patted a bundle of kelp onto the sand and floated off. She does this.'],
    bottle: "There's a bottle tangled in the kelp.",
  },
  possum: {
    arrive: 'A possum is playing dead in Row {r}.',
    arriveBare: 'A possum is playing dead by the patch.',
    first: "That's a possum, sweet pea. She's fine. They do that.",                                   // Gran
    dead: ["I'm not dead. I'm resting. Different thing.", "Joeys, shh. We're dead.", "Five more minutes. Then I'll be alive again.",
      "Don't mind us. We're very dead today.", 'This is a nap. A dead nap. Very official.', "We're not here. We're scenery."],   // possumMom
    asked: "Oh! You can see us. Fine. It was in my pouch. Not mine. Probably.",                          // possumMom
    coupon: 'The possum gave you a crumpled seed coupon: ${n} off at the Grange. Cash, really.',
    shield: 'The joeys are herding squash bugs into the corn. Nobody asked them to.',
    leave: 'The possum came back to life and wandered off. The joeys waved.',
    // the year-2+ bubble (rulings R5: no bubble in year 1)
    title: 'A possum is playing dead in Row {r}.',
    rest: 'Let her rest', restSub: "She'll get up when she's ready", restSubBugs: 'Her joeys chase bugs off Row {r}',
    ask: "Ask what's in her pouch", askSub: 'She has a ${n} seed coupon. Probably',
  },
  skunks: {
    arrive: 'A skunk family is lying in the shade under the sail. Tails up, like parasols.',
    first: 'Skunks in the shade. Leave the sail up, sweet pea. Trust me on this one.',               // Gran
    look: ['Three skunks, one sail, zero problems. So far.', 'The skunks brought snacks. They are not sharing.',
      'Everybody is very calm. Especially the skunks.'],
    startle: 'Everybody calm down. Especially the skunks.',
    skunked: "The giant's corner smells skunky. It'll pass. In about a week.",
    leave: 'The heat broke, and the skunks went home. Single file.',
  },
  swarm: {
    look: "The bees swarmed onto the scarecrow. He's thrilled.",
    gran: "They'll go home by supper. Bees do that after a sulk.",                                     // Gran
    home: 'The bees went home for supper. The scarecrow misses them.',
  },
  volunteer: { gran: "Volunteers. The birds plant 'em. Leave her be." },                                // Gran
  whale: { gone: 'The whale dived and was gone. Hal is still beside himself.' },
  pamela: {
    title: { bramble: "Pamela's in the bramble.", row: "Pamela's in Row {r}.", washing: "Pamela's at the washing line.", giant: "Pamela's in the giant's leaves." },
    graze: 'Let her graze', whistle: 'Whistle for Biscuit', whistleSub: "He'll walk her home",
    sub: { bramble: 'She eats bramble, not pumpkins. Free weeding', drift: 'She eats bramble, not pumpkins. Might wander into Row {r}',
      row: "She'll eat about {n} pumpkins a day", washing: "Gran's shawl is in danger", giant: "She'll nibble the leaves. A scuff on the giant" },
    first: "That's Pamela. From next door. She does what she likes.",                                   // Gran
    gran: ['That goat. Sweet pea, that goat.', 'Let her have the bramble. Grandpa paid a man to do that once. The man was worse.'],
    // the visible payoff of a grazed bramble row (rulings R5), in Gran's voice
    clear: "Row {r}'s {frac} clear. That goat works cheaper than your grandpa did.",
    cleared: "Row {r}'s clear of bramble. Pamela did that. I'm baking her something.",
    shawl: "She ate my good shawl. She has taste, I'll give her that.",
    meh: ['Mehh.', 'MEHH.', 'Meh?', '...mehhh.'],
    home: "Biscuit walked Pamela home. He'd like a medal.",
    ate: "Pamela ate about {n} pumpkins' worth of Row {r}. She has no regrets.",
    bit: 'Pamela cleared another bite of bramble. Free weeding.',
    drift: 'Pamela wandered into Row {r}. Of course she did.',
    full: 'Pamela wandered home on her own. Full of bramble.',
    bees: 'Pamela has met the bees. Pamela has gone home.',
    foghorn: 'Three foghorns. Pamela has decided to be elsewhere.',
    skunks: 'Pamela met the skunks. Everybody left in a hurry.',
    gone: 'Pamela ambled home before anyone could whistle.',
  },
  // the Almanac's "who to expect" flags (plan §6.2): a weather word, then its visitor's name once you've met them
  flags: {
    soup: { word: 'Pea soup', who: 'seal weather' }, out: { word: 'Out', who: 'goat weather' }, bees: { word: 'Bee day', who: 'swarm weather' },
  },
};

// The fraction words for a bramble row Pamela has cleared (lumps cleared out of the row's 18, in sixths).
export const FRACTIONS = ['', 'a sixth', 'a third', 'half', 'two thirds', 'five sixths', 'all'];

// ------------------------------------------------------------ Old Moss's tips (giant.js tipText reads these)
// The topic pools grow so a farm's five years rarely hear a line twice in 12 months (plan §3.1: tense 8, easy 8, tenseLate 6,
// easyLate 6, dense 6, airy 6, ritual 3 each, rowEarly 4, rowLate 4); they add to story.js LINES.tips, which keeps the
// originals. The mood topic (Marlene's archetype) is years 3+ only and once a year; years 1-2 fall back to lore and notice.
export const MOSS = {
  tense: ['Tight as a fiddle string. Somebody ease her... zzz.', 'She\'s clenching. Pumpkins clench. Ask anyone... zzz.',
    'Too much, too fast... she\'s holding her breath.', 'I can hear her worrying from here. Ease off... ease...',
    'She\'s wound up like a clock. A pumpkin clock... zzz.', 'Strain in the stem. Mm. Mm-hm. Ease her... zzz.'],
  easy: ['Happy as a clam. A big orange clam... zzz.', "She's humming. Good hum. The good kind.", 'Not a care in the world, that one... zzz.',
    "Loose skin, easy days. That's a happy pumpkin.", "She's lounging. Pumpkins lounge... when they're happy.", 'Calm as a pond. A round orange pond... zzz.'],
  tenseLate: ['Last week she was a knot. A knot... zzz.', 'Week before last she was a drum. I meant to mention it.',
    'Earlier... she was worried. I was asleep. We both were... zzz.', 'She was tight a while back. Should have said. Did I say?'],
  easyLate: ['Last week she was easy. Easy then... who knows now... zzz.', 'She was calm a while back. I wrote it down. Somewhere.',
    'A week ago, a happy girl. Might still be. Might... zzz.', 'Last week? Loose as a sock. This week, ask me next week.',
    'She was humming last week. I hummed back... zzz.'],
  dense: ['Solid. Like a good cheese. A heavy cheese... zzz.', 'Dense as a fruitcake. A good fruitcake. Rare.',
    "She's packing it in tight. Heavy girl... zzz.", 'Heavier than she looks. They all say that. She means it.'],
  airy: ['Light on her feet, that one. Too light... zzz.', "She's a souffle. Big and... mostly air.", 'Puffy. Like a cloud in a pumpkin suit.',
    "Roomy inside. Room for a cat. Not that I'd check... zzz."],
  ritual: {
    talk: ['She likes it when you talk to her... about anything...', 'Every grower talks to theirs... the good ones listen too... zzz.'],
    hat: ['That old hat... at dawn... your grandpa swore by it...', 'A hat at dawn... keeps the luck in... zzz.'],
    moon: ['Plant your hopes by the moon... she grows by it...', 'Full moon... big night for pumpkins... zzz.'],
    radio: ['Music... she likes music... shanties, maybe...', "Put the radio on for her... she's lonely out there... zzz."],
    secret: ["Don't say her number out loud... bad luck... zzz.", 'Keep her weight to yourself... numbers jinx a pumpkin...'],
  },
  rowEarly: ["Row {row}'s racing ahead... soft before the second weekend... zzz.", "Row {row}'ll be ripe too soon... early birds go soft...",
    'Row {row}... in a hurry. October isn\'t... zzz.'],
  rowLate: ["Row {row}'s dawdling... still green when the crowds come... zzz.", "Row {row} won't be ready... not by the last weekend...",
    "Row {row}'s a late bloomer. Too late... zzz."],
  // years 1-2's fallback: Old Moss remembers things (plan §3.1: 20 lines)
  lore: [
    "Your grandpa... talked to his. Every morning. In '79 she talked back... zzz.",
    "Eighty-seven. Vance's father. Sixteen-twelve. Nobody's forgiven the weather.",
    "Fog's a blanket... a wet blanket... still a blanket.",
    "Bees don't fly in Marlene. Can't see the flowers... can't see their own feet.",
    'The sea brings things. Kelp... bottles... once, a canoe. Nobody asked for the canoe.',
    'I grew a giant once. Named her Doris. Doris was... a lot... zzz.',
    "Your gran beat me at the fair in '71. Pie. Not pumpkins. Still stings.",
    'Pumpkins listen. Mostly to the weather... but they listen... zzz.',
    'A pumpkin is mostly water. So am I. We get along.',
    "Hal howls at the moon. The moon's never once howled back... zzz.",
    "Don't trust a pumpkin that's too round. Round is... suspicious.",
    "The Cove's had a giant every year since '52. Some years... small giants... zzz.",
    'Vines know things. Where the water is. Where the sun is. Where I left my hat.',
    "I've been retired thirty years. Busiest thirty years of my life... zzz.",
    'Augustus Vance waters by moonlight. I\'ve seen him. In a cape. Probably a cape.',
    "Pumpkins don't like to be rushed. Neither do I... zzz.",
    "Edna printed my name wrong in '83. 'Old Moth.' Some folks still call me that.",
    'Your grandpa had a song for his. Terrible song. She loved it... zzz.',
    "A good vine is like a good nap. Long... and you don't want it to end.",
    "Biscuit's grandmother was a good dog too. Dug up my turnips. Every one... zzz.",
  ],
};
// Old Moss notices the farm (plan §3.1: 12 lines built from its state). Each entry's when(s) says whether it is true today;
// fresh() only offers the ones that are.
const seenThisYear = (s, id) => (s.mischief?.met?.[id]?.y ?? 0) === s.clock.year;
export const MOSS_NOTICE = [
  { t: 'Your bees were out this week. Bees know things... zzz.', when: (s) => !!s.unlocks.marlene && [1, 2, 3].some((k) => (s.weather.days[s.clock.day - k]?.f ?? 1) < 0.6) },
  { t: 'Pea soup today. Good day for seals... and for napping... zzz.', when: (s) => !!s.unlocks.marlene && s.weather.f >= 0.82 },
  { t: 'That seal likes you. Seals like... nobody.', when: (s) => seenThisYear(s, 'seal_haulout') },
  { t: "Somebody's been eating the bramble. Goats are... a choice.", when: (s) => Object.values(s.mischief?.pamela?.goatDays || {}).some((n) => n > 0) },
  { t: 'That possum in your row... my niece. Plays dead better than anyone... zzz.', when: (s) => seenThisYear(s, 'possum_nap') },
  { t: '{name}... good name. Strong name. Heavy name... zzz.', when: (s) => !!s.giant?.name },
  { t: "She's thinking about flowers. Don't rush her.", when: (s) => s.giant?.transplantDay != null && s.giant?.setDay == null },
  { t: "Lot of rows going in. Your gran's going to need a bigger stand... zzz.", when: (s) => (s.patch?.rows || []).filter((r) => r.plantedDay != null).length >= 3 },
  { t: 'Bare rows... bare rows make me sad. Plant something... anything... zzz.', when: (s) => !!s.unlocks.patch && (s.patch?.rows || []).every((r) => r.plantedDay == null && !r.plan) },
  { t: "She's drinking her kelp. Good girl. I can tell... zzz.", when: (s) => s.giant?.feed === 'kelp' || s.giant?.feed === 'both' },
  { t: "No kelp? She'll manage. Kelp's a habit... a good one... zzz.", when: (s) => !!s.unlocks.feed && (s.giant?.feed ?? 'none') === 'none' },
  { t: "Marlene's off somewhere sunny... she'll be back. She always is.", when: (s) => !!s.unlocks.marlene && s.weather.f < 0.25 },
  { t: 'Skunked corner... weighs honest. Old saying. I made it up.', when: (s) => (s.mischief?.skunkedUntil ?? 0) > s.clock.day },
  { t: 'The otter waved at me once. I waved back. We\'re close now... zzz.', when: (s) => seenThisYear(s, 'otter_look') },
];

// ------------------------------------------------------------ Hal's heat lines (weather.js, events.js heat_wave)
// heatToday: the first day of a heat wave; heatTomorrow: the alert the day before. {n} the year's heat wave count.
export const HAL = {
  heatToday: [
    { t: "It's a scorcher inland and Marlene packed her bags. Shade your sweethearts! Awooo!" },
    { t: "Marlene's gone to Reno, Cove. Didn't say goodbye. Sails up, hats on. Awooo!", when: (s) => !!s.unlocks.shade },
    { t: "Heat wave number {n}! Marlene's not answering her phone. Leave a message after the howl. Awooo!", when: (s) => heatCount(s) >= 2 },
    { t: "No fog, folks. Repeat: NO FOG. This is not a drill. Well. It's a little bit a drill." },
    { t: "Hot one, Cove! I see a sail up in Grandpa's corner. Smart cookie. Awooo!", when: (s) => !!s.unlocks.shade && !!s.giant?.shade },
    { t: "Scorcher, Cove! {name}'s out there with no hat. Just saying. Awooo!", when: (s) => !!s.unlocks.shade && !s.giant?.shade && !!s.giant?.name },
    { t: "The valley's frying, Cove. Marlene's on a beach somewhere. Probably ours. Awooo!" },
    { t: 'Ninety-eight on the ridge and climbing! Water your pumpkins, then water yourselves. Awooo!' },
    { t: 'Hot enough to fry an egg on a mailbox, Cove. Please do not. Awooo!' },
    { t: "Marlene left a note: 'Back in a few days.' That's all it says. Awooo!" },
  ],
  heatTomorrow: [
    'Heat over the hill tomorrow! Put a hat on anything you love.',
    { t: "Valley's cooking tomorrow, Cove. Marlene's packing. Sails at the ready.", when: (s) => !!s.unlocks.shade },
    "Tomorrow: hot. Tonight: suspiciously nice. Don't trust it. Awooo!",
    'My ears are hot, and my ears are never wrong. Mostly never. Heat tomorrow!',
    "Heat's coming over the ridge tomorrow, Cove. Marlene's already got her sunglasses on.",
    { t: 'Big heat tomorrow! Raise your sails tonight and sleep like a baby. A hot baby. Awooo!', when: (s) => !!s.unlocks.shade },
  ],
};
// how many heat waves have started this year (today's included)
export function heatCount(s) {
  const ds = s.weather?.days || [];
  let n = 0;
  for (let d = 0; d <= Math.min(s.clock.day, ds.length - 1); d++) if (ds[d]?.heat && !ds[d - 1]?.heat) n++;
  return n;
}

// ------------------------------------------------------------ Edna's record day (giant.js record_day): 8 templates
// {lb} the overnight gain, {name}/{NAME} the giant.
export const EDNA = {
  record: [
    "+{lb} lb since yesterday! {name}'s best day yet.",
    '{name} put on {lb} lb overnight. The Crier is printing an EXTRA. Well. A paragraph.',
    'Best day yet: +{lb} lb. Somewhere, Augustus Vance feels a chill.',
    '+{lb} lb. The tape SQUEAKED.',
    '+{lb} lb in a day! Correction: in a NIGHT. She grows while you sleep.',
    '+{lb} lb! THE CRIER IS OUT OF EXCLAMATION MARKS. Correction: we found one.',
    { t: "+{lb} lb overnight. That's a whole Biscuit. Correction: most of a Biscuit.", when: (s) => (s.giant?.lastRecord?.lb ?? 0) >= 20 },
    { t: '+{lb} lb overnight. {NAME} IS NOT MESSING AROUND.', when: (s) => (s.giant?.lastRecord?.lb ?? 0) >= 15 },
  ],
};
