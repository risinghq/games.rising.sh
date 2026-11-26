// Story: the dialogue queue, blocking decision cards, the single Next-up goal, the onboarding beat runner,
// the story log (Crier and scrapbook material) and the shared line pools (design §3, §11, §12).
//
// s.story = { dialog: [{ id, speaker, lines, beat?, pause?, glide?, highlight? }], cards: [{ id, kind, data }],
//             goal: { id, text, target, since } | null, beats: { [beatId]: clock1x }, lastIntro1x,
//             log: [{ year, day, id, score, vars }], replay: { [beatId]: { speaker, lines } }, seq }
// Card data convention: { title, text, speaker?, choices: [{ id, label, sub }], defaultChoice }. The owning
// module's cards[kind](s, card, choice, ctx, action) resolves it; unknown kinds just close.
// Out-events: dialog, card, cardDone, goal, goalDone, beat.
//
// [foundation] the growing-year helpers (plan §6.1, rulings R2; contract in docs/architecture.md §3.5):
//   s.story.moments  the moments queue: ctx.moment({ id, kind, prio, maxWaitDays, merge, ... }), one per quiet window
//   s.story.receipts [{ id, kind, due, data, say? }]: the consequence of a choice, said later through the queue
//   s.story.said     fresh()'s memory: { [key]: [indices said since the bag was last refilled] } (across years, <= 400 keys)
//   s.story.heard    [[text, year]]: the Giant's receipt lines lately said (giant.ts receiptFresh)
//   s.story.stamps   { [id]: { y, d } }: stamps, recorded silently in Wave 1 (stamp())
//   s.story.alerts   { [alertId]: [year, day] }: the last time each alert came (the threat rule in game.js, quiet())
//   s.story.receiptDay  the day the last receipt was said (at most one every T.story.receiptGapDays)
// More out-events: moment { id, kind, group, kinds, waited, data, stop?, mine? }, momentDrop { id, kind, waited },
//   road { id, day } (a non-beat stop on the Road was reached: a planned row went in), stamp { id }.
import { T } from './tuning.js';
import { fill, own } from './util.js';
import { next, Rng } from './rng.js';
import { dayOf, realSeconds, weekends, WEIGHOFF } from './calendar.js';
import { ROAD, ROAD_STOPS, type DatedStop, type RoadStop } from './road-lines.js';
import type { ActionOf, ActionResult, Beat, SimModule, State, Ctx, MomentItem, Card, CardIn, CardKind, CardOf, FreshEntry, GoalOpts, MomentHandlerId, MomentHandlers, MomentRun, ReceiptIn, Lapse, MomentIn, SayOpts, Target, Vars } from "./types.js";
import type { StoryDialog, StoryGoal } from './state.js';
// ------------------------------------------------------------ the cast (portrait keys for the UI)
// species: null means "the player's species" (Gran is family). portrait: the renderer's portrait key when it
// differs from the speaker id.
export const SPEAKERS = {
  gran: { name: 'Gran', species: null, role: 'Your grandmother', accent: '#d9782d' },
  moss: { name: 'Old Moss', species: 'possum', role: 'The Pumpkin Whisperer', accent: '#8a9a7b' },
  hal: { name: "Howlin' Hal", species: 'coyote', role: 'KQSC 46.0 · The Ridge', accent: '#c9553a' },
  mayor: { name: 'Mayor Percival Pouch', species: 'pelican', role: 'Mayor of Quarter Sun Cove', accent: '#e5c66b' },
  edna: { name: 'Edna Hootley', species: 'owl', role: 'Editor, the Quarter Sun Crier', accent: '#7d6a58' },
  sasha: { name: 'Sasha', species: 'fox', role: 'Barista and judge', accent: '#c4532a' },
  weighmaster: { name: 'The Weighmaster', species: 'weighmaster', role: 'Q.S.C. Official Scale', accent: '#34445a' },
  vance: { name: 'Augustus Vance', species: 'beaver', role: 'Vance Family Pumpkins, est. 1952', accent: '#8a5a4a' },
  dez: { name: 'Dez', species: 'raccoon', role: 'Cashier (mostly)', accent: '#8f8b86' },
  bea: { name: 'Bea', species: 'beaver', role: 'Farmhand', accent: '#9b8774' },
  howie: { name: 'Howie', species: 'coyote', role: 'Parking attendant', accent: '#c79a62' },
  mavis: { name: 'Officer Mavis', species: 'possum', role: "Playin' Possum Pumpkins", accent: '#a9a8ad' },
  ladybug: { name: 'Ladybug Lady', species: 'fox', role: 'Pest patrol', accent: '#b5543f' },
  possumMom: { name: 'A possum mom', species: 'possum', role: 'Visitor', accent: '#e9a3a7' },
  tom: { name: 'Big Tom', species: 'coyote', role: "Big Tom's Pumpkin Ranch", accent: '#a6574a', portrait: 'bigtom' },
  hoot: { name: 'Prof. Hoot', species: 'owl', role: 'Hootenanny Hollow', accent: '#5d6168' },
  vale: { name: 'Sienna Vale', species: 'fox', role: 'Gourdgeous', accent: '#e2a68f' },
  ingrid: { name: 'Ingrid Lindqvist', species: 'skunk', role: 'Visiting legend', accent: '#2a2a30', portrait: 'lindqvist' },
  raccoons: { name: 'The Parking Lot Patch', species: 'raccoon', role: 'Definitely one grower', accent: '#3c3836', portrait: 'raccoon' },
  // [foundation] the growing year's new voices (plan §2.5). Grandpa is a note in his hand, never a character: no portrait.
  owlets: { name: "Edna's nephews", species: 'owl', role: 'The Crier, junior desk', accent: '#9a8466' },
  grandpa: { name: 'Grandpa', species: null, role: 'A note in his hand', accent: '#a4794a', portrait: false },
  kits: { name: 'The raccoon kits', species: 'raccoon', role: 'Two kits, one trench coat', accent: '#6d6a66', portrait: 'raccoon' },
};
export const SPECIES = {
  possum: { one: 'possum', many: 'possums' }, skunk: { one: 'skunk', many: 'skunks' }, raccoon: { one: 'raccoon', many: 'raccoons' },
  beaver: { one: 'beaver', many: 'beavers' }, coyote: { one: 'coyote', many: 'coyotes' }, fox: { one: 'fox', many: 'foxes' },
  owl: { one: 'owl', many: 'owls' }, pelican: { one: 'pelican', many: 'pelicans' },
  otter: { one: 'sea otter', many: 'sea otters' }, seal: { one: 'harbor seal', many: 'harbor seals' },
};
export const SURNAMES = ['Okafor', 'Haverford', 'Moreno', 'Lindgren', 'Tanaka', 'Abernathy', 'Kowalski', 'Delacroix', 'Nakamura', 'Fairweather', 'Oyelaran', 'Brightwater'];
export const DEFAULT_FARM = 'Quarter Sun Cove Pumpkins';

// ------------------------------------------------------------ line pools ({template} variables)
// Voice rules (§11): lines <= 110 characters, at most 3 per card, never explain a number the UI shows.
export const LINES = {
  mayor: {
    welcome: 'Welcome to Quarter Sun Cove! The sun shows up here about a quarter of the time.',
    // the new-farm intro's second step: Marlene is named as the fog while the 3D fog rolls in over the dock
    marlene: 'The rest of the time, we have Marlene. Marlene is our fog: the marine layer, rolling in off the sea.',
    marlene2: 'Locals talk about her like a neighbour. Speak of her and... ah. Here she comes now.',
    marleneHello: 'Hello, Marlene!',
    marleneTag: 'Marlene · the fog',
    who: 'And you are...?',
    species: "A {species}! Splendid. We've been short on {species_pl} since the incident.",
    surname: "And the family name, for the official record? I keep the record in my pouch. Safest place in town.",
    farm: "What shall we paint on the stand? Your Gran favours '{farm}'. She favours a great many things.",
    open: 'By the power vested in me by absolutely nobody, I declare this farm open! Mind the fog.',
    seasonOpens: 'October first! Your field is now a store. A store with dirt. Wonderful.',
    weighoff: 'Welcome to the weigh-off, the one day the Weighmaster is *not* the heaviest thing here. Allegedly.',
  },
  hal: {
    marlene: {
      Out: "Goooood morning, Cove! Fog report: Marlene's OUT, just {pct} percent. Sun on the pumpkins. Awooo!",
      Patchy: "Goooood morning, Cove! Fog report: Marlene's PATCHY, {pct} percent and making up her mind. Awooo!",
      In: "Goooood morning, Cove! Fog report: Marlene's IN, {pct} percent. Nothing grows fast in a sulk. Awooo!",
      Sulking: "Goooood morning, Cove! Fog report: Marlene's SULKING, {pct} percent. Nothing grows in a sulk. Awooo!",
      Heat: "Goooood morning, Cove! Fog report: Marlene's gone inland, {pct} percent, and it's HOT. Awooo!",
    },
    forecast: "That's Marlene, our fog. Gran wants a clear morning for moving day. My forecast's up top. Awooo!",
    heatTomorrow: 'Heat over the hill tomorrow! Put a hat on anything you love.',
    heatToday: "It's a scorcher inland and Marlene packed her bags. Shade your sweethearts! Awooo!",
    heatSeason: "It's a hundred and four in the valley and EVERYBODY is coming over the ridge! Awooo!",
    watering: "Dry week ahead, Cove! If your leaves are drooping, that's not sadness. Probably.",
    wateringFog: "Marlene's in, but fog's no drink. Young vines are thirsty, Cove: drooping leaves mean water. Awooo!",
    shade: 'Heat over the hill tomorrow! Put a hat on anything you love.',
    route46: "It's a hundred and four in the valley and EVERYBODY is coming over the ridge! Awooo!",
    peaSoup: 'Visibility zero, vibes immaculate. Drive slow, Cove.',
    viral: 'Your patch is on the INTERNET. The internet is coming. Over the ridge. Awooo.',
    howl50: 'Backed up past the artichokes!', howl75: 'To the ridge! Awooo!',
    dedication: 'This one goes out to {name}, from someone who loves her very much.',
  },
  gran: {
    seed: ["Your grandpa grew an 1,147-pounder in that corner. Then he went sensible. Don't.",
      'Two seeds in the tin. Always start two, sweet pea. Pumpkins are like that.'],
    water: "Normal's fine. Wetter grows faster. Wetter also splits. Ask me how I know.",
    plant: 'Classics take about a hundred days and stay good about ten. Folks come in October. Do the math, or let me.',
    plantEarly: "Bit early, sweet pea. They'll be soft before anyone comes to buy. Sure?",
    bugs: "Squash bugs. Squish 'em. Yes, with your paws.",
    barn: "Anything that'd go soft before opening day, cut it now. The barn keeps 'em three times longer.",
    ringUp: "When they line up, ring 'em up. I'm slow on purpose. Builds character.",
    wants: "That fox wants a white one. We don't have white ones. Sell her a story.",
    restock: 'Row {row} looks picked over. A full patch sells. Bring some out from the barn.',
    ownPatch: "Barn's empty? Here's twelve from my own little patch. Don't tell anyone.",
    shop: "Spend wisely. Or don't. I'll be in the kitchen.",
    loan: ["Cookie tin's got five hundred in it, sweet pea. Take it.", "Pay me back from the pumpkins. I'll know."],
    bills: "Farm bills paid: {amt}. Property tax, the truck, Biscuit's kibble.",
    loanMid: ["Heard your tin rattle from the kitchen. Three hundred, sweet pea. Kelp's not optional.", "Pay me back from the pumpkins. I'll know."],
    tinLow: "Tin's getting light: {amt} left. Kelp and water add up, sweet pea.",
  },
  moss: {
    kelp: "Kelp tea... from the cove. She'll drink it. They always drink it... zzz.",
    pollinate: "Dawn. Choose the father. The bees won't wait... they never... wear the hat...",
    creak: "She's... talking. Not nicely.",
    rituals: "Some growers sing to 'em. Some wear hats. Don't ask me if it works... it works... zzz.",
    eve: 'Big day. Get some sleep. I hear... giggling?',
    carving: "Every grower carves the one they're proudest of. Or the one that got away.",
    hintRight: "Your girl wants shade on Thursday... Thursday... what's a Thursday...",
    hintLate: "Should've eased off last week. Could've. Would've. Pumpkin.",
    doze: "She's thirsty... no... thirsty for... zzz.",
    listen: 'Listen to her.',
    mood: { normal: 'Marlene seems... herself this year. Mostly.', fog: "Marlene's settling in. Bring a sweater... for the pumpkins.",
      vacation: "Marlene's got a suitcase out. Sun's coming... zzz.", wild: "Marlene's in a mood. A wild one. Hold onto your hat." },
  },
  edna: {
    measure: 'The *Crier* needs a NUMBER. Over the top, ground to ground. Then we argue about it.',
    crier: "Will you tell our readers your ESTIMATE? Some growers say it's bad luck. Our readers say it's news.",
  },
  // [giant slice] the giant pumpkin (design §6, §10, §11 voices). {name} is her name, {lb}/{est} numbers.
  giant: {
    feedOff: "The feed tin is empty. Feed is off until there's money for it.",
    feedBack: 'Money in the tin again: {feed} is back on.',
    feedName: { kelp: 'kelp tea', fish: 'fish emulsion', both: 'kelp and fish' },
    autoStart: "I started Grandpa's seed for you, sweet pea. Couldn't stand watching the tin.",
    germFail: "That one didn't wake up. The backup did. Always start two.",
    flowerTomorrow: "First female flower's open. Tomorrow at dawn... we choose.",
    cullTomorrow: 'Three on the vine. Tomorrow you keep one. Pick a name while you sleep on it.',
    fish: 'Fish emulsion... smells like the bottom of the cove. They love it. So do skunks... zzz.',
    rotate: "Turn her a quarter, gentle, before she settles her bottom. Earlier's safer, sweet pea.",
    plot2: "Two corners, two girls. Sib 'em, or keep the better line. Your grandpa never could choose.",
    practiceHealed: "There. She's quiet. This time... zzz.",
    healed: '{name} has gone quiet. Phew.',
    blowout: "She's gone... the one that got away... I'm sorry, kid.",
    crack: "A crack. She'll live. She'll be judged, but she'll live.",
    stemCrack: 'A crack at the stem! {name} will sulk the rest of the year.',
    rotated: '{name} turned a quarter. Her good side is now her front side.',
    thirsty: '{name} looks thirsty.',
    swing: 'Big gulp! Water that sudden triples her split risk for 3 days.',
    took: 'She took! {father}.',
    noSet: "She didn't take. The next flower opens in three days.",
    bees: 'The bees got there first. Open pollinated it is.',
    waited: 'You wait for a clearer dawn. The flower waits too. Mostly.',
    meet: 'Meet {name}.',
    twins: 'Twins. Huh. My father had twins once. Once.',
    kelpTaken: 'Free kelp tea for a week. Old Moss looks smug.',
    knock: 'Listen to her.',
    tellCrier: "FRONT PAGE. Well. Page three. Thank you, grower.",
    keepSecret: 'Mysterious. Readers LOVE mysterious. Readers hate mysterious.',
    treated: 'Crack cleaned and sealed. Fingers crossed for the inspection.',
    softSpot: 'The glowing line is a soft spot on {name}! Treat it, or ride it out.',
    softTreated: 'Soft spot dried out and dusted. She looks relieved.',
    scald: 'Sunscald on {name}. A pale patch where the sun got her.',
    noSeeds: 'No seeds survived. The tin has a backup, and the Grange has opinions.',
    recordDays: "+{lb} lb a day since you last checked! {name}'s best stretch yet.",
    brow: { up: 'One eyebrow went up. Up.', slight: 'One eyebrow moved. Slightly.', none: 'Neither eyebrow moved. Not even a little.' },
    mutationStripe: "STRIPED GIANT BAFFLES GRANGE; GROWER 'DIDN'T DO ANYTHING DIFFERENT'",
    goalSeed: "Start this year's giant seed",
    goalRotate: 'Rotate her before day 25 (Care tab)',
  },
  // Old Moss's cryptic tips, built from real hidden state (design §10 moss_tip). Some are a week late; some are wrong.
  tips: {
    tense: ["She's tense... tight as a drum. Ease her... ease...", 'Her skin is humming. Not a happy hum... zzz.'],
    easy: ["She's loose as a sock. Happy girl... zzz.", 'Easy breathing out there. Easy... easy...'],
    tenseLate: ["Should've eased off last week. Could've. Would've. Pumpkin.", 'Last week she was a drum. Bang. Bang... zzz.'],
    easyLate: ['Last week she was happy. Was. Is? Who knows... zzz.'],
    dense: ['Heavy bones on that one. Heavy bones...', "She's packing it in. Solid. Like a good bread."],
    airy: ["She's... airy. Like a cloud with opinions.", "Hollow-ish. Fluffy. Don't tell her I said."],
    ritual: {
      talk: 'She likes a chat... they all like a chat... every week...', hat: 'Your grandpa never took that hat off at dawn. Never...',
      moon: 'Full moon babies... grow like rumours... zzz.', radio: 'She hums along to the radio. I swear she hums...',
      secret: "Don't tell Edna. Numbers out loud... jinx a pumpkin... zzz.",
    },
    rowEarly: "Row {row}'s early... soft before the second weekend... cut them into the barn... zzz.", rowLate: "Row {row}'s late... green on weigh-off day... zzz.",
    doze: '... zzz.', dozeEnd: '...where was I. Oh yes:',
  },
  genetics: {
    inbred: 'Selfed twice: these run small', mystery: 'Mystery packet from the Parking Lot Patch',
    mossSeed: "Old Moss's porch seed",
  },
  // card text for the giant's decisions (§12: one-line consequences on each button)
  giantCards: {
    dawn: 'Dawn in the giant corner', pollinateEyebrow: 'Pollination · dawn {n} of {max}',
    fogDawn: 'A fog dawn: flowers take about 7 times in 10.', clearDawn: 'A clear dawn: flowers take about 9 times in 10.',
    open: ['Open', "Let the Cove's bees decide. Fresh blood, unknown father."], self: ['Self', 'Her own pollen. Keeps the line. Inbreeds it too.'],
    cross: ['{pack} pollen', 'From your Grange pack. New blood.'], sib: ['Sib', 'Pollen from her sister in the other plot.'],
    wait: ['Wait for a clearer dawn', 'The flower holds a few days. The bees are impatient.'],
    lastDawn: 'Last dawn before the bees decide for you.',
    moon: { full: 'Full moon tonight.', near: 'The moon is {n} days from full.' },
    hatOn: "Grandpa's lucky hat: on", hatOff: "Grandpa's lucky hat: off",
    cull: 'Keep one of three', cullEyebrow: 'Cull and name',
    safe: ['The one at ninety degrees', "Sound and steady. Vance nods (he'll deny it)."], stump: ['The one by the stump', 'Grows bigger. Creaks more. Her stem suffers.'],
    round: ['The round one', 'Prettiest of the three. A touch smaller.'], twinsC: ['The twins', 'Heavier together. Riskier. Weirder.'],
    nameIt: 'Name her', reroll: 'More names',
    crier: 'The September Crier', crierEyebrow: 'Edna Hootley · the Quarter Sun Crier',
    judges: "Judges this year: the Mayor loves colour, Edna loves tall, Sasha loves even skin.",
    tell: ['Tell the Crier: {est}', 'Buzz all season. Folks come to gawk. So do raccoons.'], secret: ['Keep it secret', 'Bad luck to say it. Or so they say.'],
    boast: '{who}: {est}', wontSay: "{who}: won't say",
  },
  vance: {
    cull: 'Keep the one at ninety degrees to the vine, rookie. Not that I care.',
    beaten: 'Enjoy it, rookie. My father grew sixteen-twelve on worse dirt.',
    heckle: 'Lift with your tail, rookie!',
  },
  dez: { wagons: "Uh. The wagons are all in row four? I didn't do it. I mean I did. Uh." },
  possumMom: { lostJoey: 'One of my joeys is gone! Pip! PIP!' },
  weighmaster: {
    intro: 'I am the Weighmaster. I weigh things. Your pumpkin is a thing. Proceed.',
    read: "Grower {Surname}. Entry: '{name}.' The chart says one thousand and... something. We shall see.",
    mass: 'Mass is mass.', adequate: 'Adequate.', air: 'Air. Mostly air.', heavy: 'Dense. Like my patience.', record: '...Noted.',
    exhibition: 'EXHIBITION ONLY. Exhibit it somewhere else.', mini: 'One mini. Adequate.',
    hmph: 'Hmph.', stop: 'Stop that.',
  },
  raccoons: { entry: 'We would like to enter... one pumpkin. One. Large. Pumpkin.', offer: "Pumpkins. From... a farm. Don't ask which." },
  // director catalogue flavour (§10)
  events: {
    swarm: "Your bees have moved onto the scarecrow's head. He seems fine with it.",
    kelp: 'Kelp on the beach! Old Moss swears by it. Old Moss swears by a lot of things.',
    whale: 'Thar she blows! Hal is beside himself.',
    whaleLogged: 'Whale logged. {n} in the logbook now.',
    quarter_sun: "Quarter Sun Day! Marlene's gone to Reno.",
    heat_wave: "It's a hundred and four in the valley and EVERYBODY is coming over the ridge!",
    volunteer_vine: 'A pumpkin is growing on the barn roof. Nobody planted it.',
    record_day: "+{lb} lb since yesterday! {name}'s best day yet.",
    twin_fruit: 'Twins! Joined at the hip. Heavy, risky, weird.',
    goat: 'Pamela from next door is eating your inventory.',
    skunk_startle: 'Everybody calm down. Especially the skunks.',
    lost_joey: 'One of my joeys is gone! Pip! PIP!',
    shiny: "A pumpkin shaped exactly like the Mayor's beak. He has been informed.",
    golden_hour: 'Marlene burned off. Golden hour!',
    viral: "A fox's video of your patch has 40,000 likes.",
    pea_soup: "Pea soup. You can't see the barn. Nobody minds.",
    big_tom_backfire: "BOOM. Big Tom's pumpkin cannon again.",
    runaway_pumpkin: 'Runaway pumpkin!',
    toddler_giant: ['I WANT THAT ONE.', 'Sweetie, that one has a name.'],
    possum_carpool: 'Is that... four joeys?',
    proposal: 'She said yes! In row {row}!',
    heist_scouts: "Two raccoon kits were measuring {name}. 'For school.'",
    dez_wanders: "Dez is 'on break' in the hay fort.",
    old_timer: "This is nothing like '87.", old_timer_record: "Okay, this is a little like '87.",
    raccoon_entry: "Entry #7: 'Definitely One Pumpkin.'",
    parking_lot_offer: "Pumpkins. From... a farm. Don't ask which.",
    decorator_order: "The lobby must be 'aggressively autumnal.'",
    dedication: 'This one goes out to {name}, from someone who loves her very much.',
    thanks: '...thanks',
  },
  reviews: {
    possum: '★★★★★ Both joeys got minis. I played dead in the hay for twenty minutes. Bliss.',
    skunk: '★★ Waited so long my stripe faded.',
    pelican: '★★★★ Pouch full. Heart full. Parking: sandy.',
    beaver: "★★★ Rows looked a bit thin. Tipped anyway. I'm a beaver, not a monster.",
    trucked: 'These came from the valley. I can tell.',
  },
  // [season slice] October at the stand (design §7, §10, §11). Reviews state their dominant cause in species voice:
  // reviewsSp[species][cause] (the species' voice, about half the time) or reviewsBy[cause]; season.js avoids recent repeats.
  season: {
    open: ['October first! Your field is now a store. A store with dirt. Wonderful.',
      'Gran minds the stand on weekdays. Weekends, the whole valley comes over the ridge. Weekends are yours.'],
    gate: 'By the power vested in me by absolutely nobody: the season is OPEN! Families, form an orderly line.',
    ringUp2: 'Tap RING UP while folks wait. Quick paws make a Rush, and Rushes make tips.',
    wants2: 'Tap the [?] over her head. Fetch one from the barn if we have it, or offer her something we do.',
    restock2: 'Tap Barn, then Restock. Your wagon brings twelve out to the emptiest row.',
    wagons2: "Uh. Tap the wagon pins and walk 'em back? Folks buying two big ones need a wagon. I think.",
    route46b: "Your Lot station's open: the beach lot, Gran on traffic, or phone me and I'll say you're full. Awooo!",
    joey2: "He hides when he's nervous. Or bored. Or it's Tuesday. Follow the dog!",
    y2morning: "New this year: a price board, a shuttle from town and radio spots. Set 'em over coffee. Awooo!",
    y2types: 'Picky ones this year, sweet pea. Seekers want full rows. Old-timers want 1987.',
    y3panic: 'Halloween panic! Folks who forgot a pumpkin will buy anything. Even the squishy ones.',
    weekday: "{day}: Gran sold to {fam} for {amt}. 'Builds character.'",
    weekdayNone: "{day}: a quiet day. Gran read the paper at the till.",
    howl50: ['Backed up past the artichokes! Awooo!', 'Route 46 is a parking lot, folks. A slow, foggy parking lot.'],
    howl50clear: ['Backed up past the artichokes! Awooo!', 'Route 46 is a parking lot, folks. A hot, shiny, honking parking lot.'],
    howl75: ['To the ridge! Awooo!', 'Brake lights all the way to the valley! Somebody open a beach! Awooo!'],
    uturn: 'A car gave up on Route 46 and turned around.',
    halFull: "On KQSC: 'The patch is FULL, folks. Come back after lunch.' Fewer cars for a while.",
    granDirect: "Gran's out on Route 46 with a clipboard and a whistle.",
    granBack: "Gran's back at the till. 'Somebody honked. I remember faces.'",
    beachOpen: 'Beach lot open: four more spaces, some sand in the hubcaps.',
    beachClosed: 'Beach lot closed.',
    shuttle: 'The shuttle runs from town today.',
    radio: 'Hal is talking you up on KQSC all weekend.',
    fetched: 'Fetched from the barn! The kids are hopping.',
    tryYes: "'{variety}? ...Fine.' Sold, with a smile.",
    tryNo: "'It isn't {want}.' They'll keep looking.",
    noBarn: 'The barn ran out of {variety}.',
    loadEmpty: 'The barn is empty. Nothing to load.',
    strayBack: 'Wagon back in the corral.',
    playDead: 'A possum mom keeled over in the line. Ring her up and she will gasp awake.',
    walkoff: 'A family of {many} gave up on the line.',
    noWagon: 'No wagons left in the corral.',
    kidShiny: 'A kid grabbed the shiny on row {row}. Sold as a plain pumpkin. Nobody noticed.',
    soldOut: 'Row {row} is picked clean.',
    goatShoo: ['Shoo! Pamela hops a row over.', 'Mehh. Pamela relocates. Slightly.'],
    goatGone: 'Pamela goes home. She ate {n}. She regrets nothing.',
    joeyFound: 'Found him! Pip was by the {spot}, playing dead. Mom is crying. Everyone is crying.',
    joeyMissed: "Mom found Pip by the {spot}, playing dead. 'He does this.'",
    runawaySaved: 'Biscuit caught it! Sold to a grateful pelican for $8.',
    runawaySplash: 'Splash. A pelican fished it out and kept it.',
    toddlerPose: "'THAT ONE!' Photo taken. Somebody will frame it.",
    toddlerIgnored: 'The toddler did not get a photo. The toddler has notes.',
    proposal: 'A fox couple in row {row}. One of them is kneeling. Tap to give them the row.',
    proposalGiven: 'Row {row} is theirs for half an hour. Everyone pretends not to look.',
    dezBack: "Dez is back at the register. 'I was... inventorying the hay.'",
    whaleGo: 'Half the patch runs to the bluff to see the whale.',
    whaleBack: 'Everybody wanders back, glowing. Whales do that.',
    viralNext: 'The internet is coming over the ridge tomorrow.',
    foghornHowl: 'The coyote pups howl back at the foghorn.',
    foghornBark: 'The harbor seals bark back at the foghorn. They think it is a very large seal.',
    foghornBoth: 'Coyote pups howling, harbor seals barking. The foghorn has never felt so heard.',
    raft: 'Two sea otter families are holding paws in the rows so nobody drifts off.',
    skunkPuff: 'A green puff over by row {row}. Everybody gives it room.',
    carpool: 'Is that... four joeys? And the other mom is playing dead in a wagon.',
    oldTimer: ["This is nothing like '87.", "Back in '87 the pumpkins were bigger. So was the fog.", "'87 had a goat too. Better goat."],
    oldTimerRecord: "Okay, this is a little like '87.",
    decorator: { eyebrow: 'Hotel Marlene', title: 'An order from the lobby',
      text: "The lobby must be 'aggressively autumnal.' Forty {Variety} by Friday, Oct 9, at 1.3 times the price.",
      yes: 'Take the order', yesSub: '40 {Variety} from your barn by Oct 9', no: 'Politely decline', noSub: 'The lobby will cope' },
    decoratorDone: 'Hotel Marlene took 40 {Variety} for {amt}. The lobby is now aggressively autumnal.',
    decoratorFail: "Hotel Marlene's lobby is only mildly autumnal. They have told everyone.",
    panic: { eyebrow: 'Friday, Oct 30', title: 'Halloween Panic Night', text: '{n} families who forgot a pumpkin. They bought {sold}, soft ones too, for {amt}.',
      none: '{n} families who forgot a pumpkin. The field was bare. They took photos of the bare field.', ok: 'Happy Halloween' },
    evening: { title: '{day} · closing time', best: 'Best moment', tomorrow: 'Tomorrow', weighoff: 'Tomorrow: the weigh-off.', ok: 'Close up' },
    moments: {
      joey: 'Pip turned up by the {spot}. Mom says he was fine.', rush: 'Rush ×{n} at the till.', golden: 'Golden hour over the patch.',
      viral: "A fox's video of your patch went viral.", fetch: 'You sprinted to the barn for a family of {many}.', goat: 'Pamela the goat ate {n}.',
      whale: 'A whale off the bluff. Everybody ran.', proposal: 'She said yes. In row {row}.', soldOut: 'Row {row} sold out by noon.',
      traffic: 'Route 46 backed up to the ridge.', toddler: "A toddler posed with your giant. 'THAT ONE.'",
      raft: 'Two otter families shopped holding paws.',
    },
    morning: { title: '{day} morning', tiers: { bargain: ['Bargain', 'x0.85 · old-timers love it'], fair: ['Fair', 'List price'], premium: ['Premium', 'x1.25 · some will walk'] },
      shuttle: ['Shuttle from town', `$${T.shop.shuttle.price} today · a quarter skip the lot`], radio: ['Radio spot on KQSC', `$${T.shop.radio.price} this weekend · more families`],
      radioOn: 'On air all weekend', open: 'Open the gate' },
    // Review pools (design §7 reviews ticker). season.js picks a line nobody has posted recently.
    reviewsBy: {
      adult: [
        'Found exactly the one I wanted. Round, orange, slightly judgmental. Perfect.',
        'Carried our pumpkin like a baby. It was heavier than the baby.',
        'Carried it to the car like a newborn. Strapped it in like one too.',
        'This pumpkin has better posture than me. Bringing it home anyway.',
        'Picked the one that looked back at me. Felt right.',
        'Found the pumpkin of my dreams in row two. My dreams are very specific.',
        'Big, round, a little lopsided. Like all the best things.',
        'Knocked on it like a door. It sounded like home.',
        'Named it before we reached the stand. We are a family of six now.',
        'Ideal heft. Ideal stem. Ideal everything. I may frame the receipt.',
        'Our pumpkin rode home in the front seat. The kids rode in the back.',
        'Best pumpkin of my life, and I have had a long, pumpkin-filled life.',
      ],
      kids: [
        'Both kids got a mini. Nobody cried. That never happens.',
        'Two minis, two happy kits. Retiring from parenting on a high.',
        'The kids each got a tiny pumpkin and named them both Gerald.',
        'Minis for both kids. They have not put them down. Bath time will be interesting.',
        'My two have been whispering to their minis since lunch. Should I be worried?',
        'Kids got minis. I got eleven minutes of total silence. Priceless.',
        'One mini each, no squabbles. Is this farm magic? Probably fog-related.',
        'The little ones carried their minis like eggs. Very serious. Very cute.',
        'Tiny pumpkins for tiny hands. The kids felt enormous. Ten out of ten.',
      ],
      full: [
        'Rows so full it looked like a painting. A painting you can buy.',
        'Full rows, full hearts, full trunk.',
        'Every row stocked to the brim. Like a pumpkin sea, but dry.',
        'So many pumpkins I forgot what I came for. Then I remembered: pumpkins.',
        'The patch was bursting. Felt like walking into a harvest postcard.',
        'Never seen a patch this full. It looked proud of itself.',
        'Full rows, short walk, happy family. That is the whole review.',
      ],
      variety: [
        'So many kinds! We stood in the aisle and argued for twenty minutes. Best day.',
        'Warty ones, pale ones, flat ones. A pumpkin for every personality in our family.',
        'Came for orange, discovered there are other colours. Life changed.',
        'Every row a different pumpkin. Like a library, but you can carve the books.',
        'We bought one of each kind. We have no room in the car. No regrets.',
        'Variety is the spice of life. Pumpkin is the spice of variety. Lovely farm.',
      ],
      fetch: [
        "They'd run out, so the farmer RAN to the barn for one. Ran.",
        'Farmer sprinted to the barn for us. Five stars for cardio.',
        'Asked for one they did not have out. The farmer was gone and back in a blink.',
        'The farmer fetched ours from the barn at full gallop. Felt like royalty.',
        "Watched the farmer run to the barn just for us. The dog ran too. Teamwork.",
        'Personal pumpkin delivery, by sprint. Never had service like it.',
      ],
      suggested: [
        "Came for one kind, left with another. The farmer was right. Don't tell my mother.",
        'Farmer talked me into a different pumpkin. I now love it more than my car.',
        'Took the farmer’s suggestion. Turns out I am a warty pumpkin person. Who knew?',
        "Didn't get my usual. Got a better one. Growth is hard but good.",
        'The farmer recommended this one like a fine wine. It tastes like... pumpkin. Great.',
      ],
      golden: [
        'Golden hour over the pumpkins. I took 400 photos. I posted 399.',
        'The fog lifted and everything went gold. My phone nearly melted.',
        'Sun came out for exactly forty minutes. We were there for all of them.',
        'Golden light, orange pumpkins, my kids actually smiling. Framed it already.',
        'Marlene stepped out and the whole patch glowed. Stunning. Do not tell Marlene.',
      ],
      joey: [
        'Lost a joey, found a joey, cried in a hay bale. Would visit again.',
        'Somebody found our little one in two minutes flat. The dog helped. Bless that dog.',
        'Brief panic, happy ending, free hug from a stranger. Great farm.',
        'Our youngest wandered off. The farmer brought him back with a mini. Spoiled now.',
      ],
      fort: [
        'Kids climbed the hay fort for an hour. I sat down for an hour. Bliss.',
        'The hay fort is a kid magnet. I got to finish a whole thought.',
        'Kids came home with hay in places hay should not go. They loved it.',
        'The hay fort kept my two busy long enough for me to pick a pumpkin. Genius.',
      ],
      maze: [
        'Lost the kids in the corn maze for fifteen minutes. Highly recommend.',
        'The corn maze ate us. We were spat out an hour later, happier.',
        'Found the exit of the maze by following a confident chicken. No regrets.',
        'Corn maze was just hard enough to be fun and just easy enough to leave.',
      ],
      gawk: [
        "Saw the giant. It's bigger than our car. Possibly bigger than our house.",
        'The giant pumpkin in the corner has its own sign. And its own fans. I am one.',
        'Stood by the giant for ten minutes. It did not do anything. Still riveted.',
        'That giant pumpkin could crush a canoe. I would trust it with my life.',
        'Kids asked if the giant pumpkin was a house. Honestly, not a bad idea.',
      ],
      cosy: [
        "Foggy and cosy. Couldn't see the barn. Didn't need to.",
        'Thick fog, warm cider smell, pumpkins appearing out of nowhere. Magical.',
        'Couldn’t see past row three. Felt like the patch went on forever.',
        'Grey, damp and perfect. This is what autumn is supposed to feel like.',
      ],
      bargain: [
        'Prices like it is still 1987. Bless this farm.',
        'Cheap enough that I bought a spare. And a spare for the spare.',
        'Paid so little I checked the receipt twice. Then bought more.',
        'Bargain prices. My wallet and I are still friends.',
      ],
      shiny: [
        'There is a pumpkin on display shaped like a FACE. I laughed so hard.',
        'Saw a perfectly round pumpkin on display. Like a planet. Moved me.',
        'They had a heart-shaped pumpkin by the stand. I got emotional. Twice.',
        'The odd pumpkin by the stand looks like somebody I know. Will not say who.',
      ],
      wait: [
        'Waited so long in line I aged a season.',
        'The line moved at the speed of fog.',
        'By the time we reached the front, the pumpkin had grown.',
        'Long wait. Read a whole leaflet about squash bugs. I know too much now.',
        'Queue was so slow my kids learned to whistle. Both of them. Badly.',
        'Lovely farm, glacial line. Bring a snack. Bring two.',
        'I have been in shorter lines for the ferry.',
      ],
      unmet: [
        'Wanted one particular pumpkin. Did not get one particular pumpkin.',
        'Lovely farm. Nothing I came for.',
        'Came for a pumpkin I had in mind. That pumpkin remains in my mind.',
        'They had everything except the thing. You know the thing.',
        'Searched every row for my pumpkin. My pumpkin is out there somewhere.',
        'Left empty-pawed. The fog was nice, though.',
        'Not quite what I wanted. Not quite what anyone wanted, judging by the faces.',
      ],
      kidsMiss: [
        'No minis left. The kids staged a sit-in. I joined them.',
        'Out of minis. Two small faces fell so far they hit the ground.',
        'No tiny pumpkins for the tiny people. The ride home was very quiet.',
        'Kids wanted minis. Kids got a talk about disappointment. Thanks, I guess.',
        'Minis sold out. My kits are drafting a strongly worded drawing.',
      ],
      thin: [
        'Rows looked a bit picked over. Like a sale rack, but outside.',
        'Slim pickings. Found a good one eventually, under a leaf, sulking.',
        'The patch looked tired. So did we, after searching it.',
        'Half the rows were bare dirt. Very nice dirt, though.',
        'Picked over by the time we got there. The early bird gets the pumpkin.',
      ],
      noWagon: [
        'No wagons. Carried two pumpkins to the car. My arms are a memory now.',
        'Every wagon taken. I carried ours like a sack of very round potatoes.',
        'No wagon free. My back has filed a complaint.',
        'Hauled our pumpkins by paw. Skipped the gym this week. And next week.',
      ],
      beach: [
        'Parked on the beach. Sand in the hubcaps, sand in my soul.',
        'Overflow parking on the sand. Nice view. Sandy shoes. Fair trade.',
        'Parked by the waves. The car smells like seaweed now. Not mad about it.',
      ],
      trucked: [
        'These came from the valley. I can tell.',
        'Something about these pumpkins says “highway”. Not local. I know my pumpkins.',
        'Tasted the air. These were trucked in. Still bought one. Still suspicious.',
      ],
      premium: [
        'Fancy prices for a field. I paid. I grumbled. I paid.',
        'Premium pumpkin prices. Premium pumpkin, to be fair. Still winced.',
        'Expensive, but the pumpkin is lovely. My wallet is in the fog somewhere.',
        'Cost more than my hat. My hat is not round or orange, so fine.',
      ],
      playDead: [
        'Waited so long I played dead in line. Woke up at the register. Efficient, actually.',
        'Line was so slow I keeled over for a bit. Nobody minded. Lovely people.',
      ],
      walkoff: [
        'Never reached the front of the line. Left with nothing but feelings.',
        'Gave up on the line. Took a picture of a pumpkin instead. It is not the same.',
        'We left before we paid. Not on purpose. The line just never ended.',
        'Queued, waited, sighed, went home. The pumpkins looked nice from a distance.',
      ],
      first: [
        'First row was bare as a plucked owl. Not much of a welcome.',
        'Walked in to empty front rows. Thought we had the wrong day.',
        'The rows by the gate were bare. Had to hike for a pumpkin. Earned it, I suppose.',
      ],
      soft: [
        'Got a squishy one at half price. It is fine. It is a vibe.',
        'Bought a soft pumpkin, cheap. It sags a little. So do I.',
        'Half-price softie. Carving it tonight before it carves itself.',
      ],
      toddler: [
        "Our toddler posed with the giant. 'THAT ONE.' Framing it.",
        "Toddler tried to adopt the giant pumpkin. The farmer let her hug it. Tears of joy.",
        'Our little one pointed at the giant and refused to leave. Made her whole year.',
      ],
    },
    // species voices: used about half the time (else the general pool) so a species never says the same thing all day
    reviewsSp: {
      possum: {
        kids: ['Both joeys got minis. I played dead in the hay for twenty minutes. Bliss.', 'Joeys each got a mini and rode home on my back holding them. Heavy. Happy.'],
        wait: ['Waited so long I played dead twice. Once on purpose.', 'The line was long. I lay down in it. Nobody stepped on me. Five-star manners.'],
        joey: ['Lost Pip for a minute. He was playing dead by the hay. Of course he was.', 'Pip went missing again. Found him in a wagon, asleep. Classic Pip.'],
        cosy: ['Fog so thick I took a nap standing up. Wonderful afternoon.'],
        adult: ['Carried my pumpkin, two joeys and a snack. Possum mothers can do anything.'],
      },
      skunk: {
        wait: ['Waited so long my stripe faded.', 'Long line. I stayed calm. Everyone near me stayed very, very calm.'],
        full: ['Calm, full rows. Nobody startled me. Rare.', 'Plenty of pumpkins, plenty of space. Nobody got sprayed. A good day for all.'],
        cosy: ['Fog, quiet, no sudden noises. Skunk heaven.', 'Muffled, foggy, peaceful. My tail stayed down the whole visit.'],
        kids: ['Kits walked single file to the minis and back. Proudest moment of my life.'],
      },
      raccoon: {
        shiny: ['A SHINY pumpkin. I wanted to wash it. I was not allowed to wash it.'],
        fort: ['Kits went up the hay fort and I went up after them. Worth it.', 'Climbed the hay fort. Climbed the fence. Climbed a stack of crates. Great farm.'],
        adult: ['Got the white one. Gleams like a hubcap. Mine now.', 'White pumpkin, pale as the moon. Washed it in the trough. They let me. Love.'],
        unmet: ['No white ones left. I checked the bins too. Professionally.'],
      },
      beaver: {
        thin: ["Rows looked a bit thin. Tipped anyway. I'm a beaver, not a monster."],
        full: ['Rows packed tight as a good dam. Tipped generously.', 'Neat rows, sturdy stems, honest work. Left a tip and a compliment.'],
        trucked: ['These came from the valley. I can tell. I can ALWAYS tell.'],
        gawk: ['Measured the giant with my tail. Would not fit in my lodge. Respect.'],
      },
      coyote: {
        adult: ['Got the warty one. Looks like my uncle. Awooo.', 'Warty, bumpy, magnificent. Howled at it in the car. It approved.'],
        wait: ['Line so long I howled at it. It did not move.'],
        kids: ['Pups got minis and howled the whole way home. Neighbours have notes. Worth it.'],
      },
      fox: {
        golden: ['The light at golden hour. The pumpkins. My tail. Iconic.', 'Golden hour, perfect pumpkin, my good side. The algorithm will be pleased.'],
        variety: ['This patch is giving heirloom. This patch is giving everything.'],
        thin: ['Rows too bare for the photos. Posted a sunset instead.'],
        full: ['Every row camera-ready. Took 212 photos of one aisle. No notes.'],
      },
      owl: {
        cosy: ['Came at dusk, as one does. Fog, lanterns, pumpkins. Who could ask for more? Who indeed.'],
        unmet: ['Who sells out before dusk? WHO?'],
        variety: ['A fine selection of blue and warty specimens. Studied them at length. Bought two.'],
      },
      pelican: {
        adult: ['Pouch full. Heart full. Orange as a traffic cone.', 'Carried my pumpkin home in my pouch. Did not drop it once. Mostly.'],
        beach: ['Parked on the beach. Felt like home. Five stars for the sand.'],
        noWagon: ["Wagon? I have a pouch. Nobody asked."],
        kids: ['Chicks each got a mini. Fit three in my pouch for the ride home. Snug.'],
      },
      otter: {
        raft: ['Met another otter mom in row two. Held paws the whole visit so we would not drift. Lovely.',
          'Rafted up with the Kelpwoods by the minis. Pups compared pumpkins. Mine won.'],
        kids: ['Pup got a mini and held it on her tummy all the way home. Would not let go. Same.'],
        adult: ['Knocked on every one with my lucky rock. This one knocked back.', 'Kept my pumpkin in my armpit pouch. Do not ask.'],
        wait: ['Long line. Floated on my back in it. Pup napped. Not bad, actually.'],
      },
      seal: {
        sea: ['Swam in, flumped up the beach. No parking. No Route 46. Why does anyone drive?',
          'Hauled out on the sand for an hour first. Then pumpkins. Then another hour on the sand.',
          'Nosed my pumpkin all the way down the beach. It floats! Nobody tells you it floats.'],
        adult: ['Got the blue one. Matches my spots. We are basically twins.', 'Round and grey-blue, like a seal with a stem. Perfect.'],
        wait: ['Long line, but I was lying down anyway. I am always lying down anyway.'],
        cosy: ['Foggy, damp, a foghorn to bark at. Felt like home.', 'Barked back at the foghorn. It barked first. Great day.'],
        kids: ['Pups got minis and rolled them down the beach with their noses. Into the sea. On purpose.'],
        thin: ["Rows looked thin. My big cousin from Año Nuevo would be unimpressed. He always is."],
      },
    },
    // a species line that names a variety is only said by a family that took one home (else the general line for the
    // cause): the first family of the game is a raccoon who buys a Classic, in a year with no White pumpkins
    reviewsSpNeed: { 'raccoon.adult': 'white', 'coyote.adult': 'warty', 'seal.adult': 'blue' },
  },
  // Year-end Crier headlines by trigger, with scores (§9). The top logged beat is the headline.
  crier: {
    record: { score: 100, text: "GRANDPA'S SCALE, VANCE'S RECORD: {NAME} TIPS {W} LB", alt: "OLD-TIMER: 'OKAY, THIS IS A LITTLE LIKE '87'" },
    doubleCrown: { score: 95, text: "{NAME} TAKES BOTH RIBBONS; WEIGHMASTER 'MILDLY AWARE'" },
    heaviest: { score: 85, text: "'{NAME}' TIPS SCALES AT {W} LB; WEIGHMASTER 'MILDLY ROUSED'" },
    heartbreak: { score: 80, text: "HEARTBREAK AT {FARM}: {NAME} SPLITS {N} DAYS BEFORE WEIGH-OFF; GROWER SAYS 'I'M FINE' FOUR TIMES" },
    mustache: { score: 70, text: 'RACCOONS DEFACE GIANT; WEIGHMASTER UNMOVED' },
    prettiest: { score: 65, text: "'{NAME}' NAMED PRETTIEST; SASHA CALLS SKIN 'BASICALLY A FLAT WHITE'" },
    goat: { score: 60, text: 'LOCAL GOAT EATS {N} PUMPKINS, SHOWS NO REMORSE' },
    viral: { score: 55, text: "FOX'S PATCH VIDEO HITS {K} LIKES; ROUTE 46 REGRETS EVERYTHING" },
    waste: { score: 50, text: "PUMPKINS GO SOFT AT {FARM}; LOCALS SAY 'PLANT LATER'" },
    soldOut: { score: 50, text: '{FARM} SELLS OUT BY NOON' },
    traffic: { score: 45, text: 'ROUTE 46 BACKED UP TO THE RIDGE; DJ HOWLS FOR 40 MINUTES' },
    shiny: { score: 40, text: "PUMPKIN SHAPED LIKE MAYOR'S BEAK FETCHES ${P}" },
    joey: { score: 35, text: "JOEY FOUND IN ROW {R}; 'HE WAS FINE,' SAYS MOM, 'HE WAS PLAYING DEAD'" },
    whale: { score: 30, text: 'WHALE EMPTIES PUMPKIN PATCH FOR AN HOUR' },
    loan: { score: 25, text: 'LOCAL FARMER BORROWS FROM GRANDMA, AGAIN' },
    raccoonEntry: { score: 20, text: "RACCOON ENTRY RULED 'THREE PUMPKINS IN A TRENCH COAT'" },
    marlene: { score: 10, text: 'MARLENE IN {X}% OF DAYS; LOCALS SHRUG' },
    mutation: { score: 0, text: "WHITE GIANT BAFFLES GRANGE; GROWER 'DIDN'T DO ANYTHING DIFFERENT'" },
  },
  giantNames: ['Big Earl', 'The Duchess', 'Auntie Ballast', 'Moonpie', 'Captain Heft', 'Lady Marlene', 'Gourd Almighty', 'Squashzilla',
    'Sir Plumpsalot', 'Chonkers', 'Tiny', 'Dale', 'Kevin', "Marlene's Revenge", 'Old Faithful', 'The Bishop', 'Sweet Pea'],
  rituals: { talk: ["You're doing great.", 'Think heavy thoughts.', 'Marlene says hi.'], radio: ['shanties', 'smooth jazz', 'The Vine Borers'] },
  // Next-up goals from the §3 year-1 table
  goals: {
    seed: "Start Grandpa's seed in the giant corner", marlene: 'Tap the fog chip to see the forecast', water: 'Pick a water setting for the giant',
    kelp: "Turn on kelp tea, or don't", plant: 'Plant your first row (tap the patch)', plantLate: 'Plant a row by Jul 10, or October has nothing to sell', patchWater: 'Water the patch',
    bugs: "Squish the bugs on row {row}", measure: 'Measure your giant', shade: 'Raise the shade before the heat',
    creak: "She's creaking. Ease off, or ride it?", honey: 'Collect honey', rituals: 'Talk to your giant (press and hold)',
    barn: 'Cut {n} {Variety} from row {row} before they go soft', ringUp: 'Ring up the queue', wants: "Help the fox who can't find her pumpkin",
    restock: 'Restock row {row}, the emptiest', wagons: 'Fetch the stray wagons', route46: 'Open the beach lot before the road jams',
    pins: 'Find the joey!', heave: 'HEAVE on the beat', carve: "Carve her, then pick next year's seed",
    pickSeed: "Pick next year's seed (the Seeds tab, after the Crier)",
  },
  toys: { foghorn: 'BWAAAMP', foghorn3: 'Somewhere, a skunk is very startled.', boat: 'toot toot', scarecrow: 'The scarecrow tips his hat.',
    biscuit: 'Biscuit rolls over.', hives: 'bzzz' },
  // [weighoff slice] the weigh-off (design §8): the Mayor emcees, the Weighmaster weighs, everyone else heckles
  wo: {
    // a spectator by the scale, on every weigh-in; 'gurt' (very, in the West Country) for the biggest of the day
    spectator: { big: "That's a big pumpkin.", gurt: "That's a GURT big pumpkin!" },
    eve: {
      later: ['Big day tomorrow. Sleep... sleep is for pumpkins... zzz.', "Weigh-off eve. She's ready. Are you? I'm not. zzz.",
        "Quiet night. Good. Quiet's good... what was that?"],
      uneasy: ['I hear... giggling? In the corn. Get the flashlight, kid.'],
    },
    watch: {
      intro: ['Raccoons! Eyes in the corn, after your girl.', 'Flash the light on every pair you see. Quick, quick... zzz.'],
      goal: 'Flash your light at the eyes',
      clean: 'Not a scratch on {name}. The raccoons have gone home to sulk.',
      scratches: '{n} little scratches on {name}. The judges will notice. She was very brave.',
      mustache: "Oh, sweet pea. Somebody painted a mustache on {name}. It's... a good mustache.",
      biscuit: 'Biscuit barks at the first pair. Good dog.', flood: 'The floodlights catch every other pair.',
      mavis: "Officer Mavis on duty. 'I wasn't asleep. I was *pretending*.'", nap: 'Officer Mavis is asleep. Actually asleep.',
      caught: 'Flash! A kit scampers off.', missed: 'Too slow. Giggling, retreating.',
      title: 'Night Watch', hint: 'Tap the eyes before they blink out',
    },
    eveNote: { y1: 'The night before the weigh-off. Somewhere in the corn, something giggles.', heist: 'Something is moving in the corn.',
      quiet: 'Big day tomorrow. The farm is very quiet.' },
    footprints: 'Raccoon footprints all around {name} this morning. Tiny ones. Lots of them.',
    dawn: 'Dawn. The trucks rumble in: giants on pallets, all along the north fence.',
    noShow: "Mavis sent word: Playin' Possum Pumpkins 'looked closed'. Nobody is sure what that means.",
    lindqvist: 'Ingrid Lindqvist came over on the ferry. Everyone pretends not to stare.',
    noEntry: 'No giant of yours on the scale this year. You can still cheer. Loudly.',
    gasp: 'OOOOOH!',
    mayorOpen: ['Welcome back to the weigh-off! The scale is warm. The coffee is not.',
      "Growers, neighbours, raccoons: welcome! Today, we weigh. Tomorrow, we argue.",
      'Another year, another scale-tipping spectacular! I have written a speech. I will spare you.'],
    wmOpen: ['I am still the Weighmaster. Proceed.', 'Things will be weighed. Proceed.', 'The scale is ready. I am always ready. Proceed.'],
    lift: {
      call: 'Neighbours, to the lifting ring! On my count. My count is HEAVE.',
      forklift: 'The forklift beeps. It has been lightly sat on by the Weighmaster.',
      ring: 'The lifting ring takes her weight. Smooth as a sermon.',
      mavis: 'Mavis plays dead mid-lift. Extra heave!', chant: 'HEAVE!',
    },
    heave: {
      perfect: 'Textbook lift! The crowd applauds itself.', good: 'Up and onto the scale. Nicely done.',
      scuff: 'A scuff on the way up. The judges will spot it.', crack: "CRACK. Everyone heard it. Everyone pretends they didn't.",
    },
    pass: 'PASS.',
    pretty: {
      open: 'And now, the Prettiest! Judges, your cards, please.',
      guest: { moss: 'Our guest judge: Old Moss! Somebody nudge him at the right moment.', vance: 'Our guest judge: Augustus Vance, who will be looking at stems. Only stems.' },
      mustache: "Not eligible for Prettiest. The judges can't stop staring at the mustache.",
      quips: {
        mayor: { high: 'Orange as a traffic cone.', mid: 'A respectable orange.', low: 'Is that... tan? Bold.' },
        edna: { high: 'Tall and upright, like a good headline.', mid: 'Solid. Page two.', low: 'FLAT. Er. Flattish.' },
        sasha: { high: 'Skin like latte foam.', mid: 'A decent pour.', low: 'A bit of a burnt roast.' },
        moss: { high: 'She speaks to me. Nine and a half.', mid: 'zzz... five.', low: 'zzz... five.' },
        vance: { high: 'Now THAT is a stem.', mid: 'A stem is a stem.', low: 'Rookie stem.' },
      },
      ribbons: ['Third', 'Second', 'First'],
    },
    heavy: 'And now... the HEAVIEST! In order of their boasts, smallest first.',
    hoot: 'Prof. Hoot insists on going last. By lantern. It is ten in the morning.',
    read: "Grower {Surname}. Entry: '{name}.' The chart says {chart} and... something. We shall see.",
    gag: {
      1: { name: 'Definitely One Pumpkin', note: 'A tarp. Under it: three pumpkins, standing very still. Disqualified.',
        headline: 'THREE PUMPKINS UNDER A TARP' },
      2: { name: 'Pumpkin (Round)', note: 'A beach ball, painted orange. It bounced. Disqualified.', headline: 'A BEACH BALL, PAINTED ORANGE' },
      3: { name: 'Mr. Pumpkin, Esq.', note: 'Three raccoons in a trench coat. It sneezed in three places. Disqualified.',
        headline: 'THREE RACCOONS IN A TRENCH COAT' },
      4: { name: 'Hollow Hal', note: 'A hollow pumpkin. With a kit inside it. Waving. Disqualified.', headline: 'A KIT IN A HOLLOW PUMPKIN' },
      legit: "It's... real. A real giant pumpkin. The raccoons look as surprised as anyone.",
    },
    dq: { tom: 'It exploded. Big Tom says that should count extra.', any: 'A crack to the cavity. EXHIBITION ONLY.' },
    giantNames: {
      vance: ['Old Faithful', 'The Senator', 'Sixteen-Twelve Jr.', 'Steady Eddie'],
      tom: ['The Big Tom', 'Kaboom', 'Bigger Tom', 'Tom Thumb (Ironic)'],
      mavis: ['Sleepy Sue', 'Dead Weight', 'Possum Pie'],
      hoot: ['The Professor', 'Midnight Oil', 'Tall Order'],
      vale: ['Heirloom Honey', 'Pumpkin Spice Era', 'Golden Hour'],
      raccoons: ['Totally Legit', 'Our Pumpkin', 'Not Stolen'],
      lindqvist: ['Fjord', 'The Ferry', 'Northern Light'],
    },
    stamp: { heavy: 'HEAVY', light: 'LIGHT', chart: 'CHART!', exhibition: 'EXHIBITION ONLY', pass: 'PASS', dq: 'DISQUALIFIED',
      pb: 'PERSONAL BEST', record: 'COVE RECORD' },
    winner: '{who} takes the Heaviest with {w} pounds! Polite applause! Some impolite applause!',
    youWin: "And the Heaviest is... {name}! {w} pounds! Grandpa's scale has never been prouder.",
    seeds: "Six seeds of '{short}' will be saved. Folks are already asking.",
    shinyNames: { sphere: 'perfect sphere', heart: 'heart', smiley: 'smiley scar', twins: 'fused twins', beak: "Mayor's beak", weighmaster: "Weighmaster's face" },
    forklift: {
      title: 'Forklift rental', eyebrow: 'September prep', text: "Grange rents a forklift for weigh-off day. It's been sat on. Not by me.",
      rent: ['Rent it: ${price}', 'Skips the HEAVE. A 0.3% chance of a bump.'] satisfies [string, string], heave: ["We'll HEAVE", 'Neighbours, a ring and four good beats. Free.'] satisfies [string, string],
      rented: 'Forklift booked for the weigh-off. It smells faintly of seal.',
    },
    crier: {
      second: { score: 48, text: "'{NAME}' TAKES SECOND AT {W} LB; GROWER ALREADY PLANNING NEXT YEAR" },
      third: { score: 38, text: "'{NAME}' THIRD AT {W} LB; 'A RIBBON IS A RIBBON,' SAYS GRAN" },
      pb: { score: 42, text: "PERSONAL BEST FOR {FARM}: '{NAME}' TIPS {W} LB" },
      vows: { score: 22, text: '{WHO} VOWS REVENGE' },
      exhibition: { score: 80, text: "HEARTBREAK AT {FARM}: '{NAME}' FAILS INSPECTION; GROWER SAYS 'I'M FINE' FOUR TIMES" },
      auction: { score: 40, text: 'PUMPKIN SHAPED LIKE {KIND} FETCHES ${P} AT AUCTION' },
      raccoonEntry: { score: 20, text: "RACCOON ENTRY RULED '{DISGUISE}'" },
      scouts: { score: 6, text: "RACCOON KITS SEEN 'MEASURING' LOCAL GIANT; PARENTS CLAIM HOMEWORK" },
    },
  },
  // [weighoff slice] between years (design §9): carving, trick-or-treaters, the ledger, the Crier, the shop
  winter: {
    carve: { later: ['Another one for the porch. Carve her kindly... zzz.', 'Carve what she was. Or what she meant. Or a face... zzz.'] },
    stencils: { grin: 'Classic grin', whiskers: "Weighmaster's whiskers", cloud: 'Marlene cloud', possum: 'Possum' },
    brushes: { shave: ['Shave', 'Soft glow'], punch: ['Punch', 'Blaze'] },
    seeds: 'Six seeds of {short}. Next year\'s bet.', noSeeds: 'No good seeds this year. The tin has a backup.',
    skipped: 'Seeds scooped and saved. She stays whole on the porch.',
    treats: 'Trick-or-treaters! Tap them to hand out candy.', candy: 'Candy! The {kids} hop with joy.',
    kids: { raccoon: 'raccoon kits', possum: 'joeys', owl: 'owlets' },
    edna: "Hot off the press! Well. Warm. The *Crier* prints at midnight, and you're on it.",
    ednaLater: 'The year-end *Crier*. Read it before Edna reads it to you.',
    cats: {
      pumpkins: 'Pumpkins', weekday: 'Weekday sales', honey: 'Honey', tips: 'Tips', prizes: 'Weigh-off prizes', auction: 'Shiny auction',
      seedSales: 'Seed sales', loan: "Gran's cookie tin", shiny: 'Shiny sales', seed: 'Seed', water: 'Water bill', spray: 'Sprays',
      feed: 'Kelp and fish', hires: 'Hires', shop: 'Shop', rentals: 'Rentals', trucked: 'Trucked-in fruit', pollen: 'Pollen', giant: 'Giant care',
      marketing: 'Marketing', compost: 'Compost', bills: 'Farm bills',
    },
    masthead: 'The Quarter Sun Crier', motto: "All the news that's fit to print, and some that's merely heavy",
    price: '25¢ or one small gourd', edition: 'Year-end edition · Year {year}',
    marlene: "Marlene was in on {pct}% of days. Her favourite month: {month}. Heat waves: {heat}. Rain days: {rain}.",
    marleneHead: "MARLENE'S YEAR",
    fad: 'FAD FORECAST: {Variety}, {conf}% sure. Edna is never wrong. Edna is sometimes wrong.',
    judges: 'Next year\'s judges: {judges}.', mood: 'Old Moss on next year\'s Marlene: "{hint}"',
    letters: {
      talk: 'Talking to your pumpkin is SCIENCE. I talk to mine daily. It has never once interrupted. A. Possum, Dune Rd',
      hat: "It's the hat. It was always the hat. Name withheld (a beaver)",
      moon: 'Full-moon pollination or nothing. The moon knows things. Moonstruck, Ridge Rd',
      radio: 'Smooth jazz. Trust me. My giant went up forty pounds during the saxophone solo. Hal\'s #1 Fan',
      secret: 'Never tell Edna your estimate. I did once. Never again. Bitter in Row 3',
      parking: 'Who parked a pelican in the overflow lot? He was there four hours. Concerned, Route 46',
      fog: 'Marlene was MAGNIFICENT this year. That is all. A Fan',
      raccoons: 'Lock up your giants. I am not saying who. I am saying they wear masks. Worried, Hollow Ln',
      gourd: 'Is a gourd a pumpkin? Asking for a gourd. Curious, Beach Rd',
    },
    oldTimer: {
      head: "THE OLD-TIMER: 'NOTHING LIKE '87'", by: "by Gus, who was there in '87",
      lines: ["This year's weigh-off was fine. Fine! But it was nothing like '87.",
        "In '87 Vance Sr. lifted sixteen-twelve onto Grandpa's scale with a borrowed tractor and a hymn.",
        "Kids these days measure their pumpkins. In '87 we guessed, and we were usually wrong, and we liked it.",
        "Marlene was thicker in '87. You could lean on her.", "The Weighmaster was already the Weighmaster in '87. He looked exactly the same."],
      record: "Okay. Okay, fine. This year was a little like '87.",
    },
    classifieds: {
      head: 'CLASSIFIEDS',
      forklift: 'FOR SALE: forklift, lightly sat on by Weighmaster. Rents by the day at the Grange.',
      ring: 'WANTED: strong neighbours, or a lifting ring. Ask at the hardware store.',
      floodlights: 'FLOODLIGHTS: see raccoons before they see you. Hardware, aisle 3.',
      mavis: 'NIGHT GUARD AVAILABLE. Mostly awake. Ask for Officer Mavis.',
      loft: 'BARN LOFT KITS: room for 120 more pumpkins. Bats not included.',
      irrigation: 'IRRIGATION TIMERS: water your patch while you nap. Hardware, aisle 1.',
      row5: 'BRAMBLE REMOVAL: your Row 5 cleared by spring. The bramble had a good run.',
      row6: 'MORE BRAMBLE REMOVAL: Row 6 this time. Same bramble, different row.',
      row7: 'THE LAST OF THE BRAMBLE: Row 7. The whole patch, finally yours.',
      wagons: 'WAGONS: four red wagons, slightly squeaky. Families love them.',
      plot2: 'SECOND GIANT PLOT: twice the giants, twice the worry. Grange.',
      billboard: 'BILLBOARD SPACE on Route 46. Hal approves. Hal approves of everything.',
      soaker: 'SOAKER HOSE: steady water, no swings, no drama. Grange.',
      cables: 'SOIL-HEATING CABLES: a week ahead of everybody. Grange.',
      clubdb: 'CLUB DATABASE: every line, every creak, every excuse. Grange.',
      compost: 'COMPOST PROGRAM: smells like success. Mostly smells.',
      hive: 'BEEHIVES: one careful owner (the bees).',
      tape: 'FANCY TAPE: measures to 0.2%. Arguments not included.',
      shadeMotor: 'SHADE MOTOR: raises your sail when Hal says heat. Hal is right 80% of the time.',
      gravel: 'GRAVEL: four more parking spaces, zero sand in the hubcaps.',
      dez: 'CASHIER SEEKS WORK: fast hands, short attention span. Ask for Dez.',
      bea: 'FARMHAND: strong, punctual, never on Sundays (dam). Ask for Bea.',
      howie: 'PARKING ATTENDANT: whistles, howls, parks. Ask for Howie.',
      ladybug: 'PEST PATROL: speaks fluent ladybug. Ask for the Ladybug Lady.',
    },
    briefs: {
      named: "'{name}' NAMED IN A QUIET CEREMONY AT THE GIANT CORNER", swarm: 'BEES RELOCATE THEMSELVES; NOBODY CONSULTED',
      whale: 'WHALE SIGHTED OFF THE BLUFF; HAL "BESIDE HIMSELF"', crierTold: 'GROWER TELLS THE CRIER AN ESTIMATE; READERS DELIGHTED',
      carved: 'GIANT CARVED ON THE PORCH; TRICK-OR-TREATERS IMPRESSED', candy: '{N} CANDIES HANDED OUT ON HALLOWEEN',
      shiny: 'SHINY PUMPKIN FOUND IN ROW {R}; COLLECTORS CIRCLE', arrive: 'NEW FARM OPENS AT QUARTER SUN COVE',
      volunteer: 'PUMPKIN VINE SPROUTS SOMEWHERE SILLY; NOBODY PLANTED IT', volunteerHarvest: 'VOLUNTEER PUMPKIN HARVESTED, BARELY',
      fad: 'THE FAD HELD (OR DID IT?); EDNA STANDS BY HER FORECAST', trucked: 'RACCOONS DELIVER PUMPKINS; "DON\'T ASK," THEY SAY',
      mutation: 'GIANT CHANGES COLOUR; GRANGE BAFFLED', scouts: "RACCOON KITS SEEN 'MEASURING' A GIANT; PARENTS CLAIM HOMEWORK",
      loan: 'LOCAL FARMER BORROWS FROM GRANDMA, AGAIN',
    },
    noPhoto: 'The photographer was asleep.',
    split: 'The One That Got Away',
    hubTabs: { seeds: 'Seeds', grange: 'Grange', hardware: 'Hardware', kqsc: 'KQSC', almanac: 'Almanac' },
    begin: 'Begin year {n}', autoSeed: 'If you pick nothing, Gran plants the plumpest of your seeds.',
  },
  // the graceful line when a Next-up goal's moment passes (goalLapse): [speaker, line], a toast line, or false. Voice
  // rules (§11): <= 110 characters.
  lapse: {
    marlene: ['hal', "The forecast lives on the fog chip, Cove. Tap it any morning. Awooo!"],
    water: ['gran', "Normal it is, then. Normal's fine, sweet pea."],
    kelp: ['moss', "No kelp, then. She'll manage... most of 'em manage... zzz."],
    plant: ['gran', "No rows this year? The giant will have to carry us, sweet pea."],
    patchWater: 'The Water button is always there when the ring runs low.',
    bugs: ['gran', 'The bugs moved on. They always come back, mind.'],
    measure: ['edna', "No number? Then the *Crier* prints 'about yay big'. Measure her any time."],
    shade: ['hal', "Heat's broken, Cove! Next heat wave, up goes the sail. Awooo!"],
    creak: false,
    honey: 'The bees will keep it. Collect honey any time at the Hives.',
    rituals: ['moss', "She'll be there when you want a chat... zzz."],
    barn: ['gran', "The barn's there whenever a row won't last to Saturday, sweet pea."],
    ringUp: ['gran', "I rang 'em all up myself. Slowly. Your turn tomorrow."],
    wants: ['gran', 'The fox made do. Next time, tap the [?] over their heads.'],
    restock: ['gran', "I'll bring some out overnight. Tomorrow, try Barn, then Restock."],
    wagons: ['dez', "I'll... get the wagons. Later. Probably."],
    route46: ['hal', 'Next heat wave, open that beach lot early, Cove. Awooo!'],
    pins: false,
    milk: ['moss', 'The dust settled... for now... zzz.'],
    rotate: ['gran', "She's settled her bottom now. Next year, turn her early."],
  } satisfies Record<string, Lapse>,
};

// Template variables every line can use.
export function vars(s: State, extra?: Vars): Vars {
  const sp = own(SPECIES, s.meta.species) ?? SPECIES.possum;
  const name = s.giant?.name || 'her';
  return { surname: s.meta.surname, Surname: s.meta.surname, species: sp.one, species_pl: sp.many, farm: s.meta.farmName,
    FARM: s.meta.farmName.toUpperCase(), year: s.clock.year, name, NAME: name.toUpperCase(), ...extra };
}
export const line = (s: State, str: string, extra?: Vars) => fill(str, vars(s, extra));

// ------------------------------------------------------------ dialogue, cards, goals, log
let inBeat: string | null = null; // set while a beat's run() executes: its dialogue is an intro (holds the clock, replayable)
const MAX_CHATTER = 6;

export function say(s: State, ctx: Ctx, speaker: string, lines: string | string[], opts: SayOpts = {}) {
  const L = (Array.isArray(lines) ? lines : [lines]).slice(0, T.story.linesPerCard).map((l) => line(s, l, opts.vars));
  const item: StoryDialog = { id: 'd' + ++s.story.seq, speaker, lines: L };
  if (inBeat) {
    item.beat = inBeat; item.pause = true; s.story.replay[inBeat] = { speaker, lines: L };
    // a lesson takes the stage: chatter still waiting its turn (a tip, a lapse line queued under fast-forward) is old news
    s.story.dialog = s.story.dialog.filter((d, i) => i === 0 || d.pause);
  }
  if (opts.pause) item.pause = true;
  if (opts.glide) item.glide = opts.glide;
  s.story.dialog.push(item);
  // Chatter that nobody reads must not pile up forever (intros are kept).
  while (s.story.dialog.filter((d) => !d.pause).length > MAX_CHATTER) s.story.dialog.splice(s.story.dialog.findIndex((d) => !d.pause), 1);
  if (opts.goal) goal(s, ctx, opts.goal.id, opts.goal.text, opts.goal.target, opts.goal);
  ctx.emit({ type: 'dialog', id: item.id, speaker });
  return item.id;
}

export function card(s: State, ctx: Ctx, raised: CardIn) {
  const c: Card = { id: 'c' + ++s.story.seq, ...raised };
  s.story.cards.push(c);
  if (s.clock.speed > 4) s.clock.speed = 1; // a card ends a Skip
  ctx.emit({ type: 'card', id: c.id, kind: c.kind });
  return c.id;
}

// opts: { until (the last sim day it is worth doing), lapse: [speaker, line] or a toast line, quiet (re-targeting the
// same goal: no chime) }. A goal never goes stale (design §12): the player completes it, it re-targets, or its day passes
// and it lapses with a graceful line (goalLapse).
export function goal(s: State, ctx: Ctx, id: string | null, text?: string | null, target?: Target | null, opts: GoalOpts = {}) {
  if (id == null) { if (s.story.goal) ctx.emit({ type: 'goal', id: null }); s.story.goal = null; return; }
  const lapse = opts.lapse ?? own(LAPSE, id) ?? null;
  const g: StoryGoal = { id, text: line(s, text ?? own(LINES.goals, id) ?? id), target: target || null, since: s.clock.clock1x,
    until: opts.until ?? untilOf(s, id), lapse };
  s.story.goal = g;
  ctx.emit({ type: 'goal', id, text: g.text, quiet: !!opts.quiet });
}
// Clear the goal only if it is still the one the player just completed.
export function goalDone(s: State, ctx: Ctx, id: string) {
  if (s.story.goal?.id !== id) return false;
  s.story.goal = null;
  ctx.emit({ type: 'goalDone', id });
  return true;
}
// The moment for a goal has passed (its day ended, the bugs moved on, the fox made do): clear it without a "Done" and
// say so kindly. line: false for no line, a string, or [speaker, text]; default the goal's own lapse line.
export function goalLapse(s: State, ctx: Ctx, id: string, ln?: Lapse) {
  const g = s.story.goal;
  if (!g || g.id !== id) return false;
  s.story.goal = null;
  ctx.emit({ type: 'goalLapse', id });
  // the kind word is chatter: said only when it keeps clear of a lesson (else the lesson itself takes over the chip)
  const L = ln === undefined ? g.lapse : ln;
  if (!L || !quietForChatter(s, ctx)) return true;
  if (Array.isArray(L)) say(s, ctx, L[0], [L[1]]);
  else ctx.emit({ type: 'toast', text: line(s, L), cls: '', icon: 'next' });
  markChatter(s);
  return true;
}
// How long each year-1 Next-up goal stays worth doing, as a last sim day (inclusive). Weekend goals last their day.
function untilOf(s: State, id: string) {
  const d = s.clock.day, w = own(LAPSE_DAYS, id);
  if (w === 'day') return d;
  if (typeof w === 'string') return Math.max(d, dayOf(w));
  return w != null && w > 0 ? d + w : null;
}
// (Spring and late-summer goals lapse about halfway to the next lesson, so their line keeps clear of both.)
const LAPSE_DAYS: Record<string, number | string | undefined> = {
  marlene: 8, water: 6, kelp: 6, plant: T.patch.window[1], patchWater: 10, measure: 6, shade: T.weather.y1.heat.at(-1),
  honey: 8, rituals: 5, ringUp: 'day', wants: 'day', restock: 'day', wagons: 'day', route46: 'day', pins: 'day',
  milk: 10, rotate: 14,
};
const LAPSE: Record<string, Lapse> = LINES.lapse;
// The goal's day has passed: let it go gracefully (a day's end, before tomorrow's lesson sets a new one).
// A goal with a line waits for a quiet moment to say it (tomorrow, or the next lesson re-aims the chip); weekend lessons
// end with their day regardless.
function lapseDue(s: State, ctx: Ctx, force = false) {
  const g = s.story.goal;
  if (g?.until == null || s.clock.day < g.until) return;
  const late = s.clock.day >= g.until + T.story.lapseWait;     // no quiet moment came: let it go silently
  if (force || late || !g.lapse || quietForChatter(s, ctx) || s.clock.phase !== 'grow') goalLapse(s, ctx, g.id);
}
// Modules may declare goals: { [id]: (s, goal) => still worth doing? } (the fox made do, the joey turned up on his own);
// the current goal is checked every morning and every weekend minute, and lets go when its moment has passed.
type GoalLive = NonNullable<SimModule['goals']>;
const liveCache = new WeakMap<readonly SimModule[], GoalLive>();
function goalLive(s: State, ctx: Ctx) {
  const g = s.story.goal;
  if (!g) return;
  let m = liveCache.get(ctx.modules);
  if (!m) { m = {}; for (const mod of ctx.modules) Object.assign(m, mod.goals); liveCache.set(ctx.modules, m); }
  const live = own(m, g.id);
  if (live && !live(s, g)) goalLapse(s, ctx, g.id);
}

export function log(s: State, _ctx: Ctx, id: string, score = 0, v: Vars = {}) {
  s.story.log.push({ year: s.clock.year, day: s.clock.day, id, score, vars: v });
  if (s.story.log.length > 300) s.story.log.splice(0, s.story.log.length - 300);
}
export const yearLog = (s: State, year = s.clock.year) => s.story.log.filter((e) => e.year === year).sort((a, b) => b.score - a.score);

// ------------------------------------------------------------ onboarding beats
// Beats: { id, year?, years?: [a, b], order?, gap?: false, urgent?(s), at?, pin?, when(s, ctx), run(s, ctx) }, declared by
// the module that owns the system. at: the trigger date ('Sep 1'), so chatter keeps clear before it is due; pin: the
// date can't move (the story leans on it), so it goes first when due and the other intros make way in the gap before it.
// Due beats run one at a time in (year, order, declaration) order, at least introGap1x of 1x clock apart while the clock
// is running; beat-driven phases (weigh-off, winter) are paced by the player instead.
// gap: false beats (toast-only lessons) neither wait for nor reset the gap. An urgent(s) beat explains something that
// is happening right now (a live creak), so it skips the wait but still resets the gap for the intros after it.
type Ordered = Beat & { k: number };
const beatCache = new WeakMap<readonly SimModule[], Ordered[]>();
export function allBeats(modules: readonly SimModule[]) {
  let list = beatCache.get(modules);
  if (!list) {
    // one object shape for every beat (runBeats walks them every weekend minute)
    list = modules.flatMap((m, mi) => (m.beats ?? []).map((b, bi) => ({ id: b.id, year: b.year, years: b.years, order: b.order,
      gap: b.gap, urgent: b.urgent, at: b.at, pin: b.pin, soon: b.soon, when: b.when, run: b.run, road: b.road, est: b.est, k: mi * 100 + bi })));
    list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.k - b.k);
    beatCache.set(modules, list);
  }
  return list;
}
const yearOk = (b: Beat, y: number) => (b.years ? y >= b.years[0] && y <= b.years[1] : b.year === undefined || b.year === y);
const clocked = (s: State) => s.clock.phase === 'grow' || s.clock.phase === 'october';
// allBeats(modules) narrowed to one year, in the same order (runBeats walks it every weekend minute).
const yearBeatCache = new WeakMap<readonly SimModule[], Map<number, Beat[]>>();
function beatsOfYear(modules: readonly SimModule[], y: number) {
  let byYear = yearBeatCache.get(modules);
  if (!byYear) yearBeatCache.set(modules, (byYear = new Map()));
  let list = byYear.get(y);
  if (!list) byYear.set(y, (list = allBeats(modules).filter((b) => yearOk(b, y))));
  return list;
}
const pinCache = new WeakMap<readonly SimModule[], Map<number, Beat[]>>();
function pinsOfYear(modules: readonly SimModule[], y: number) {
  let byYear = pinCache.get(modules);
  if (!byYear) pinCache.set(modules, (byYear = new Map()));
  let list = byYear.get(y);
  if (!list) byYear.set(y, (list = beatsOfYear(modules, y).filter((b) => b.pin)));
  return list;
}

export function runBeats(s: State, ctx: Ctx, beats?: readonly Beat[]) {
  if (s.clock.hands) return null;                    // a hands-on close-up is open: lessons wait until it closes
  const now = s.clock.clock1x, last = s.story.lastIntro1x, y = s.clock.year, done = s.story.beats;
  const gapOk = !clocked(s) || last == null || now - last >= T.story.introGap1x - 1e-9;
  const list = beats ?? beatsOfYear(ctx.modules, y), pins = beats ? beats.filter((b) => b.pin) : pinsOfYear(ctx.modules, y);
  let soon: boolean | undefined;                     // a pinned date is less than an intro gap away (computed lazily)
  // pinned beats (dates the story can't move: Hal's shade warning the day before the scripted heat) go first when due,
  // then the rest in order (one walk over both lists: runBeats runs every weekend minute)
  for (const [pinned, b] of [...pins.map((b) => [true, b] as const), ...list.map((b) => [false, b] as const)]) {
    if ((b.pin && !pinned) || done[b.id] !== undefined || (beats && !yearOk(b, y))) continue;
    if (!b.when(s, ctx)) continue;
    if (b.gap !== false && !b.urgent?.(s)) {
      if (!gapOk) return null;                       // held by spacing: fires as soon as the gap allows
      if (!pinned && (soon ??= pinnedSoon(s, pins))) return null;   // makes way for a pinned date
    }
    s.story.beats[b.id] = now;
    if (b.gap !== false) s.story.lastIntro1x = now; else s.story.lastChatter1x = now;   // a toast-only lesson is chatter
    inBeat = b.id;
    try { b.run(s, ctx); } finally { inBeat = null; }
    if (s.clock.speed > 4) s.clock.speed = 1;        // Skip stops at a beat
    ctx.emit({ type: 'beat', id: b.id });
    return b.id;
  }
  return null;
}
function pinnedSoon(s: State, pins: readonly Beat[]) {
  if (!clocked(s) || !pins.length) return false;
  const d = s.clock.day;
  for (const b of pins) {
    const t = atDay(s, b);
    if (t == null || s.story.beats[b.id] !== undefined) continue;
    if (t > d && realSeconds(d, t) < T.story.introGap1x - 1e-9) return true;
  }
  return false;
}
// A beat's trigger day: `at` is a date ('Sep 1') or, for a lesson that follows the plant, a function of the state
// (the giant's first flower) that returns a sim day or null while it is not known yet.
function atDay(s: State, b: Beat) {
  if (b.at == null) return null;
  return typeof b.at === 'function' ? b.at(s) ?? null : dayOf(b.at);
}
// Scripted teaching events (the W3 heat wave, the W3 lost joey) count as intros for spacing.
export function markIntro(s: State) { s.story.lastIntro1x = s.clock.clock1x; }
// Unprompted chatter (a tip, the kelp wash-up, the honey toast) keeps clear of other chatter too.
export function markChatter(s: State) { s.story.lastChatter1x = s.clock.clock1x; }
// Does an intro (a beat with spacing) wait to fire right now, or fall within `ahead` 1x-seconds? A beat may declare
// `at`, its trigger date ('Sep 12'), so chatter can keep clear of it before it is due.
// (A toast-only lesson counts here too: it is a new thing for the player, and Old Moss waits for it.)
export function introNear(s: State, ctx: Ctx, ahead = T.story.chatterGap1x, self: string | null = null) {
  const d = s.clock.day, done = s.story.beats;
  for (const b of beatsOfYear(ctx.modules, s.clock.year)) {
    if (done[b.id] !== undefined || b.id === self) continue;
    const t = atDay(s, b);
    if (t != null && t > d && realSeconds(d, t) < ahead) return true;
    if (clocked(s) && b.when(s, ctx)) return true;
  }
  return false;
}
// Old Moss's tips and other unprompted chatter keep clear of the lessons (design §3: one new thing at a time): not in
// the chatterGap1x after an intro, nor in the chatterGap1x before a dated one, nor while one waits for its slot, nor
// while a lesson that waits on the farm (the first dry week) says it may come any day now (its `soon(s)`).
// A moment waiting in the queue has the next window: chatter that isn't queued (a tip, a lapse line) makes way for it.
export function quietForChatter(s: State, ctx: Ctx, self: string | null = null) {
  return quietWindow(s, ctx, self) && !momentWaiting(s);
}
// (exported for the delight lane: a year-1 slot's delight takes the next window even while lower-prio moments wait)
export function quietWindow(s: State, ctx: Ctx, self: string | null = null) {
  const last = s.story.lastIntro1x, chat = s.story.lastChatter1x, gap = T.story.chatterGap1x, now = s.clock.clock1x;
  if ((last != null && now - last < gap) || (chat != null && now - chat < gap)) return false;
  if (introNear(s, ctx, gap, self)) return false;
  if (!clocked(s)) return true;
  const done = s.story.beats;
  return !beatsOfYear(ctx.modules, s.clock.year).some((b) => b.soon && done[b.id] === undefined && b.id !== self && b.soon(s, ctx));
}

// ------------------------------------------------------------ [foundation] the moments queue (plan §2.1, rulings R2)
// Every chatter-class moment from every track goes through ctx.moment(m): a delight's arrival, a First, a sowing day, a
// tally, a receipt, Grandpa's notes. The growing year has about 8 quiet windows in June and July, not one for every row of
// the calendar, so they take turns: one moment per quiet window (quietWindow: 12 s of 1x clear of lessons, dated lessons
// ahead and other moments), the highest prio first, oldest first among equals. The calendar is what the queue delivers.
//   m = { id, kind, prio = T.moments.prio[kind] ?? 0, maxWaitDays = T.moments.maxWaitDays, merge = null,
//         say = null ([speaker, line | lines]), toast = null (text | { text, cls, icon }), stop = false,
//         mine = false, handler?, data? }
//   - merge: moments queued the same game day with the same key become one beat (sowing + note + row-in + sprouts)
//   - kind 'toast' is low salience ("window open", a minor milestone): it never takes a window, only waits for the lesson
//   - past maxWaitDays a moment is dropped; its handler's drop(s, ctx, m) may file it silently (a First with no banner)
//   - mine: the answer to the player's own tap or card shows at once (it still counts for the 12 s after it)
//   - stop: Skip stops when it shows (a sowing day, a ✦ pin)
//   - threats (heat, creak, slips) are alerts (ctx.alert), never moments: moment() refuses them
// When a moment runs, the handler named by m.handler runs: a module declares
// moments: { [name]: { run(s, ctx, m, group), drop?(s, ctx, m) } }. A moment with no handler just says its `say` and toasts
// its `toast`. Either way one out-event { type: 'moment', id, kind, group, kinds, waited, data, stop?, mine? } goes to the UI.
const THREAT_KINDS = new Set(['alert', 'threat']);
export function moment(s: State, ctx: Ctx, m: MomentIn) {
  const { id, kind, prio, maxWaitDays, merge, say: sayIt, toast, stop, mine, threat, ...call } = m;
  if (!id || threat || THREAT_KINDS.has(kind) || own(T.clock.threats, id) !== undefined) return null;
  const q = s.story.moments, d = s.clock.day;
  const item: MomentItem = { ...call, id, kind, prio: prio ?? own(T.moments.prio, kind) ?? 0, day: d,
    wait: maxWaitDays ?? (kind === 'receipt' ? T.moments.receiptWaitDays : T.moments.maxWaitDays), merge: merge ?? null,
    say: sayIt ?? null, toast: toast ?? null, stop: !!stop, seq: ++s.story.seq, with: [] };
  if (mine) { runGroup(s, ctx, item, [item], true); markChatter(s); return item; }
  if (q.some((x) => x.id === item.id || x.with.some((w) => w.id === item.id))) return null;   // already waiting
  const lead = item.merge && q.find((x) => x.merge === item.merge && x.day === d);
  if (lead) {
    lead.with.push(item);
    lead.prio = Math.max(lead.prio, item.prio); lead.stop ||= item.stop;
    if (lead.kind === 'toast' && kind !== 'toast') lead.kind = kind;   // a toast that merges into a moment takes a window
    return lead;
  }
  q.push(item);
  return item;
}
export const momentWaiting = (s: State) => !!s.story.moments?.some((m) => m.kind !== 'toast');

// One pass of the queue (game.js: every morning and weekend minute, after the beats and the director).
export function runMoments(s: State, ctx: Ctx) {
  const q = s.story.moments;
  if (!q?.length) return null;
  const d = s.clock.day;
  const late = q.filter((m) => d - m.day > m.wait);
  if (late.length) { s.story.moments = q.filter((m) => !late.includes(m)); for (const m of late) dropMoment(s, ctx, m); }
  if (s.clock.hands) return null;                                     // nothing shows over a close-up
  // low-salience toasts: never a window, only clear of the lesson just said and the one due now
  const last = s.story.lastIntro1x, now = s.clock.clock1x;
  if ((last == null || now - last >= T.story.chatterGap1x) && !introNear(s, ctx, 0)) {
    for (let n = 0; n < T.moments.toastsPerPass; n++) {
      const t = s.story.moments.find((m) => m.kind === 'toast');
      if (!t) break;
      take(s, t); runGroup(s, ctx, t, [t, ...t.with]);
    }
  }
  if (!momentWaiting(s) || !quietWindow(s, ctx)) return null;
  let best: MomentItem | undefined;
  for (const m of s.story.moments) if (m.kind !== 'toast' && (!best || m.prio > best.prio || (m.prio === best.prio && m.seq < best.seq))) best = m;
  if (!best) return null;
  take(s, best);
  runGroup(s, ctx, best, [best, ...best.with]);
  markChatter(s);
  return best.id;
}
const take = (s: State, m: MomentItem) => { s.story.moments = s.story.moments.filter((x) => x !== m); };

const handlerCache = new WeakMap<readonly SimModule[], MomentHandlers>();
function handlersOf(ctx: Ctx) {
  let h = handlerCache.get(ctx.modules);
  if (!h) { h = {}; for (const mod of ctx.modules) Object.assign(h, mod.moments); handlerCache.set(ctx.modules, h); }
  return h;
}
function answerCard<K extends CardKind>(s: State, c: CardOf<K>, choice: string, ctx: Ctx, a: ActionOf<'card/answer'>): ActionResult | undefined {
  for (const m of ctx.modules) { const h = m.cards?.[c.kind]; if (h) return h(s, c, choice, ctx, a); }
  return undefined;
}
function runHandler<H extends MomentHandlerId>(s: State, ctx: Ctx, m: MomentRun<H>, group: MomentItem[]) {
  handlersOf(ctx)[m.handler]?.run(s, ctx, m, group);
}
function dropHandler<H extends MomentHandlerId>(s: State, ctx: Ctx, m: MomentRun<H>) {
  handlersOf(ctx)[m.handler]?.drop?.(s, ctx, m);
}
function runGroup(s: State, ctx: Ctx, lead: MomentItem, group: MomentItem[], mine = false) {
  const d = s.clock.day, order = [...group].sort((a, b) => b.prio - a.prio || a.seq - b.seq);
  const said: Record<string, string[]> = {};                          // one card per speaker: their lines merge (<= 3)
  for (const m of order) {
    if (m.handler !== undefined) runHandler(s, ctx, m, order);
    if (m.say) { const [who, ln] = m.say; (said[who] ||= []).push(...(Array.isArray(ln) ? ln : [ln])); }
    if (m.toast) { const o = typeof m.toast === 'string' ? { text: m.toast } : m.toast; ctx.emit({ type: 'toast', text: line(s, o.text), cls: o.cls || '', icon: o.icon || 'sparkle' }); }
    if (m.kind === 'receipt') s.story.receiptDay = d;
  }
  for (const [who, lines] of Object.entries(said)) say(s, ctx, who, lines.slice(0, T.story.linesPerCard));
  ctx.emit({ type: 'moment', id: lead.id, kind: lead.kind, group: order.map((m) => m.id), kinds: order.map((m) => m.kind),
    waited: d - Math.min(...order.map((m) => m.day)), data: lead.data, stop: order.some((m) => m.stop), mine });
}
function dropMoment(s: State, ctx: Ctx, m: MomentItem) {
  for (const x of [m, ...m.with]) if (x.handler !== undefined) dropHandler(s, ctx, x);
  ctx.emit({ type: 'momentDrop', id: m.id, kind: m.kind, group: [m.id, ...m.with.map((x) => x.id)], waited: s.clock.day - m.day });
}
// Everything still waiting goes (a new year, the end of the season): each is dropped through its handler.
export function dropMoments(s: State, ctx: Ctx) {
  const q = s.story.moments || [];
  s.story.moments = [];
  for (const m of q) dropMoment(s, ctx, m);
}

// ------------------------------------------------------------ [foundation] receipts (plan §3.12)
// The consequence of a choice, said later at a visible event ("Stump girl's creaking. Told you."). The choice handler files it
// with its due day; on that day it joins the moments queue (kind 'receipt', handler r.kind), at most one every
// T.story.receiptGapDays, and the handler (or its say) words it from the state then.
export function receipt(s: State, r: ReceiptIn) {
  if (!r.id) return false;
  const R = s.story.receipts;
  if (R.some((x) => x.id === r.id)) return false;
  R.push({ ...r, due: r.due ?? s.clock.day, say: r.say ?? null });
  R.sort((a, b) => a.due - b.due);
  return true;
}
function receiptsDue(s: State, ctx: Ctx) {
  const R = s.story.receipts, d = s.clock.day, r = R[0];
  if (!r || r.due > d || s.story.moments.some((m) => m.kind === 'receipt')) return;
  if (s.story.receiptDay != null && d - s.story.receiptDay < T.story.receiptGapDays) return;
  R.shift();
  moment(s, ctx, { id: `receipt:${r.id}`, kind: 'receipt', handler: r.kind, data: { ...r.data, receipt: r.id }, say: r.say });
}

// ------------------------------------------------------------ [foundation] never the same line twice (plan §3.1)
// fresh(s, rng, key, list): a pick from list that never repeats until the pool is used up (a shuffled round), then starts a
// new round that never opens with the line just said. Entries are strings or { t, when?(s), w? } (state-gated, weighted). The memory lives
// in s.story.said[key] across years (capped at 400 keys). rng: a stream (ctx.rng('chatter')) or a keyed makeRng(...): pass
// the stream whose timing the line follows, never weather, crowd or rivals. Returns the entry's text (fill it with ctx.line).
export function fresh(s: State, rng: Rng, key: string, list: readonly FreshEntry[]) {
  const said = s.story.said;
  const pool: [FreshLine, number][] = [];
  list.forEach((e, i) => { const o = typeof e === 'string' ? { t: e } : e; if (!o.when || o.when(s)) pool.push([o, i]); });
  const first = pool[0];
  if (!first) return null;
  let mem = said[key] ?? [];
  const free = (ex: readonly number[]) => pool.filter(([, i]) => !ex.includes(i)), heavy = (c: [FreshLine, number][]) => c.filter(([o]) => (o.w ?? 1) > 0);
  let cand = heavy(free(mem));
  if (!cand.length) {                              // the round is used up: a new one, never opening with the line just said
    const last = mem.slice(-1);
    mem = [];
    cand = heavy(free(last));
    if (!cand.length) cand = free(last);           // (a weightless line only when it is the one way not to repeat)
    if (!cand.length) cand = pool;                 // a pool of one
  }
  let total = 0;
  for (const [o] of cand) total += Math.max(0, o.w ?? 1);
  let x = next(rng) * total, pickI = cand[cand.length - 1] ?? first;
  for (const c of cand) { x -= Math.max(0, c[0].w ?? 1); if (x < 0) { pickI = c; break; } }
  delete said[key];                                   // re-insert: the oldest keys go first when the memory is full
  said[key] = [...mem, pickI[1]];
  for (const k of Object.keys(said).slice(0, -FRESH_KEYS)) delete said[k];
  return pickI[0].t;
}
type FreshLine = Exclude<FreshEntry, string>;
const FRESH_KEYS = 400;

// ------------------------------------------------------------ [foundation] stamps (recorded silently in Wave 1)
export function stamp(s: State, ctx: Ctx, id: string) {
  const st = s.story.stamps;
  if (own(st, id)) return false;
  st[id] = { y: s.clock.year, d: s.clock.day };
  ctx.emit({ type: 'stamp', id });
  return true;
}

// ------------------------------------------------------------ [foundation] the Road: what's next (plan §3.6)
// road(s, ctx): this year's stops in date order, [{ id, kind: 'beat' | 'sow' | 'weekend' | 'weighoff', day, est, done,
// title, why?, icon }]. Beats are stops when they carry road: { title, why, icon } (or ROAD[id] in road-lines.js); their day is
// `at` (a date or a function of the state), else est(s), else null (shown last, "soon"). Planned rows' sowing days, the
// October weekends and the weigh-off are stops too. A stop's title is a template: {r} row, {w} weekend.
export function road(s: State, ctx: Ctx) {
  const d = s.clock.day, out: RoadStop[] = [];
  for (const b of beatsOfYear(ctx.modules, s.clock.year)) {
    const meta = b.road ?? own(ROAD, b.id);
    if (!meta) continue;
    let day = atDay(s, b), est = false;
    if (day == null && b.est) { day = b.est(s) ?? null; est = day != null; }
    out.push({ id: b.id, kind: 'beat', day, est, done: s.story.beats[b.id] !== undefined, title: meta.title, why: meta.why ?? null, icon: meta.icon });
  }
  s.patch.rows.forEach((r, i) => {
    // a scheduled row, or one that went in this morning (patch.dayStart sows scheduled rows before story.dayStart)
    const day = r.plan ? r.plan.day : r.plantedDay === d && s.clock.phase === 'grow' ? d : null;
    if (day == null) return;
    out.push({ id: `sow:${i}`, kind: 'sow', day, est: false, done: !r.plan, row: i, title: fill(ROAD_STOPS.sow.title, { r: i + 1 }), why: null, icon: ROAD_STOPS.sow.icon });
  });
  for (const w of weekends()) out.push({ id: `wk:${w.id}`, kind: 'weekend', day: w.sat, est: false, done: d > w.sun || s.clock.phase === 'weighoff',
    title: fill(ROAD_STOPS.weekend.title, { w: w.id }), why: null, icon: ROAD_STOPS.weekend.icon });
  out.push({ id: 'weighoff', kind: 'weighoff', day: WEIGHOFF, est: false, done: d > WEIGHOFF || ['halloween', 'winter'].includes(s.clock.phase),
    title: ROAD_STOPS.weighoff.title, why: null, icon: ROAD_STOPS.weighoff.icon });
  return out.sort((a, b) => (a.day ?? 1e9) - (b.day ?? 1e9));   // stable: same-day stops keep their order
}
// The next stop not yet reached: the Next-stop chip's subject and its ⏭ target (dispatch clock/skip { to: stop.day }).
export function nextStop(s: State, ctx: Ctx) {
  const d = s.clock.day;
  return road(s, ctx).find((x): x is DatedStop => !x.done && x.day != null && x.day >= d) ?? null;
}
// A planned row went in this morning: the Road's stop is reached (Skip stops on it, game.js).
function roadReached(s: State, ctx: Ctx) {
  if (s.clock.phase !== 'grow' || !s.patch.rows.some((r) => r.plantedDay === s.clock.day)) return;
  for (const x of road(s, ctx)) if (x.kind === 'sow' && x.day === s.clock.day) ctx.emit({ type: 'road', id: x.id, day: x.day });
}

// quiet(s, ctx): a quiet day the clock may hurry through (plan §2.3; the setting is off by default, rulings R10). Nothing
// on screen or waiting (no goal, dialogue, card, close-up, queued moment or active pin), no alert since yesterday, and no
// beat or Road stop due within T.road.quiet.lookahead days. The UI adds its own checks (no open sheet, no live pin).
export function quiet(s: State, ctx: Ctx) {
  const c = s.clock, st = s.story, d = c.day, la = T.road.quiet.lookahead;
  if (c.phase !== 'grow' || c.hands || st.goal || st.dialog.length || st.cards.length || st.moments.length) return false;
  if (s.events.active.length || s.mischief.pin || s.mischief.visit) return false;
  for (const a of Object.values(st.alerts)) if (a[0] === c.year && d - a[1] <= 1) return false;
  for (const b of beatsOfYear(ctx.modules, c.year)) {
    if (st.beats[b.id] !== undefined) continue;
    const t = atDay(s, b);
    if ((t != null && t <= d + la) || b.when(s, ctx) || b.soon?.(s, ctx)) return false;
  }
  const r = st.receipts[0];
  if (r && r.due <= d + la) return false;
  return !road(s, ctx).some((x) => !x.done && x.day != null && x.day <= d + la);
}

// ------------------------------------------------------------ [foundation] the needs lint (plan §3.1)
// mentions(text) -> the unlocks a line leans on: unlock flags, or 'beat:<id>' for a lesson that unlocks nothing. A delight,
// a poke or a Road title must never name a system the farm hasn't met: needsMet(s, mentions(text)) in the owner's tests.
const MENTIONS: [RegExp, string][] = [
  [/\bmarlene\b|\bfog\b|\bforecast/i, 'marlene'],
  [/\brows?\b|\bsow(ing|n)?\b|\bcrates?\b|\bplanting\b/i, 'patch'],
  [/\bthirsty\b|\bdroop|\bwater (the|your) (patch|rows?)\b/i, 'patchWater'],
  [/\bbugs?\b|\bsquish/i, 'bugs'],
  [/\bhoney\b|\bjars?\b/i, 'hives'],
  [/\bbarn\b/i, 'barn'],
  [/\bkelp\b|\bfeed\b/i, 'feed'],
  [/\btape\b|\bmeasur(e|ing)\b|\b\d+ ?lb\b/i, 'measure'],
  [/\bshade\b|\bsail\b/i, 'shade'],
  [/\bcrier\b/i, 'crier'],
  [/\bcreak/i, 'beat:giant.creak'],
  [/\britual|\blucky hat\b/i, 'rituals'],
  [/\bmildew\b/i, 'mildew'],
];
export function mentions(text: string) {
  const out: string[] = [];
  for (const [re, need] of MENTIONS) if (re.test(String(text)) && !out.includes(need)) out.push(need);
  return out;
}
export const needsMet = (s: State, needs: readonly string[] = []) => needs.every((n) => (n.startsWith('beat:') ? s.story.beats[n.slice(5)] !== undefined : !!s.unlocks[n]));

// ------------------------------------------------------------ module
const fail = (reason: string) => ({ ok: false, reason });
export default {
  id: 'story',
  init(s: State) {
    s.story = { dialog: [], cards: [], goal: null, beats: {}, lastIntro1x: null, log: [], replay: {}, seq: 0,
      moments: [], receipts: [], receiptDay: null, said: {}, heard: [], stamps: {}, alerts: {} };
  },
  newYear(s: State, ctx) {
    s.story.lastIntro1x = null; s.story.lastChatter1x = null; s.story.goal = null; s.story.receiptDay = null;
    dropMoments(s, ctx);
    s.story.receipts = [];                           // a receipt belongs to its year's choice
  },
  dayStart(s, ctx) { goalLive(s, ctx); roadReached(s, ctx); receiptsDue(s, ctx); },
  tick(s: State, ctx) { if (s.story.goal) goalLive(s, ctx); },
  dayEnd(s, ctx) { lapseDue(s, ctx); },
  phase(s: State, ctx, from, to) {
    if (from === 'newgame' && to === 'grow') log(s, ctx, 'arrive', 1, { farm: s.meta.farmName });
    if (to === 'weighoff' || to === 'winter') { lapseDue(s, ctx, true); dropMoments(s, ctx); }   // nothing from the season outlives it
  },
  actions: {
    'story/dialogSeen': (s, a, ctx) => {
      const i = a.id ? s.story.dialog.findIndex((d) => d.id === a.id) : 0;
      if (i < 0 || !s.story.dialog.length) return fail('no such dialog');
      const [d] = s.story.dialog.splice(i, 1);
      if (!d) return fail('no such dialog');
      ctx.emit({ type: 'dialogDone', id: d.id, beat: d.beat });
      return { ok: true };
    },
    'card/answer': (s, a, ctx) => {
      const i = s.story.cards.findIndex((c) => c.id === a.id);
      if (i < 0) return fail('no such card');
      const c = s.story.cards[i];
      if (!c) return fail('no such card');
      const choices = c.data.choices;
      const choice = a.choice ?? c.data.defaultChoice ?? choices?.[0]?.id;
      if (choices?.length && !c.data.free && !choices.some((ch) => ch.id === choice)) return fail('not a choice on this card');
      s.story.cards.splice(i, 1);
      const r = answerCard(s, c, choice, ctx, a);
      ctx.emit({ type: 'cardDone', id: c.id, kind: c.kind, choice });
      return { ok: true, ...(r || {}) };
    },
    'story/goalDone': (s, a, ctx) => (goalDone(s, ctx, a.id) ? { ok: true } : fail('not the current goal')),
    'story/replay': (s, a, ctx) => {
      const r = s.story.replay[a.id];
      if (!r) return fail('nothing to replay');
      s.story.dialog.push({ id: 'd' + ++s.story.seq, speaker: r.speaker, lines: r.lines, replay: a.id });
      ctx.emit({ type: 'dialog', speaker: r.speaker });
      return { ok: true };
    },
  },
} satisfies SimModule;
