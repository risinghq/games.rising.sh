// [C] Track C's lines (plan §8; rulings R5, R9, R11): Moving Day, the dawn card, the consequence lines on the giant's
// choices, the receipts, the pace line, the first tape at the Vine Crawl and Edna's Sunday tape. story.js LINES keeps the
// giant's older lines; these replace the ones the growing-year plan rewrote. Every line is <= 110 characters once its
// template is filled with typical values (tests/sim/consequence.test.js), at most 3 to a card, and each character keeps
// their tic: Gran "sweet pea" / "Ask me how I know", Old Moss dozes off "... zzz.", Hal "Awooo!", Vance "rookie" /
// "Not that I care", Edna CAPS and "Correction:", Big Tom "Pfft".
// Numbers in a line ({pct}, {cost}, {n}, ...) are filled from T by giant.consequence(), never written here, so a retune
// can't make a line lie.
export const CL = {
  // ---------------------------------------------------------------- the tin (three plain taps on the giant sheet, R0)
  tin: {
    steps: [['Slide the lid off', "Grandpa's tin. Two seeds inside."], ['Nick the edge', 'A little nick, so the water gets in.'],
      ['Tuck her in on the mat', 'Warm, damp, dark. Up in a few days.']],
    seed: '{seed}, saved by Grandpa',
    started: 'Nicked, soaked, kept warm. Up in a few days.',
    toast: 'Nicked, soaked and tucked onto the heat mat. The spare stays in the tin.',
  },
  // ---------------------------------------------------------------- Moving Day (plan §3.11, rulings R7)
  moving: {
    title: 'Moving day',
    eyebrow: "Gran · Hal's forecast",
    text: 'Out to her corner. On a clear morning she roots in a day. On a foggy one she sulks, and a sulk costs her size.',
    replay: "Moving day's on a clear morning if you can. A foggy one, she sulks. Ask me how I know.",
    when: ['This morning', 'Tomorrow', '{dow}'],
    today: '{when} · {word}, {pct}%',
    ahead: '{when} · {word}, about {pct}% give or take {sd}',
    days: { 1: 'roots in a day', 3: 'sulks about 3 days', 5: 'sulks about 5 days' },
    likely: '{a}, likely', either: '{a}, or {b}', range: 'sulks {a} to {b} days', short: { 1: 'roots in a day', 3: 'sulks 3', 5: 'sulks 5' },
    picked: 'Moving day: {day}. Gran has the trowel out already.',
    out: 'Out she goes, under the hoop house. Rooted by {day}.',
    outSulk: 'Out she goes. Marlene came in: she sulks till {day}.',
    leaf: '+1 leaf',
    fuss: ['Gran fusses with the hoop house. Still sulking.', 'Gran tucks the soil in round her. Still sulking.',
      'Gran tells her a story about Grandpa. Still sulking.', 'Gran checks on her twice before breakfast. Still sulking.'],
    rooted: "She's rooted. A new leaf, at last.",
    hal: ['gran', 'Hal said clear. Hal says a lot of things.'] satisfies [string, string],
    // the receipt rides her first flower (a toast, no window of its own): how many days the move gave or cost her
    flower: { early: 'First flower, {n} early. That clear moving morning paid, sweet pea.', even: 'First flower, right on time.',
      late: "First flower, {n} late. That's the sulk from moving day.", fog: 'First flower, {n} late. That foggy moving day. Ask me how I know.' },
  },
  // ---------------------------------------------------------------- the stage line on the giant sheet (plain words)
  stage: {
    tin: ["Grandpa's tin", 'Two seeds: one for the corner, one spare.'],
    sprout: ["Up on Gran's windowsill", 'Moving day is {date}. Hal will say which morning.'],
    sproutPicked: ["Up on Gran's windowsill", 'Out to her corner {date}.'],
    sulking: ['Sulking under the hoop house', 'Rooted by {date}, if she feels like it.'],
    seedling: ['Under the hoop house', 'Roots first. Then everything else.'],
    vine: ['Vining', 'Her first flower opens around {date}.'],
    flower: ['First flower!', 'At dawn you decide how she takes.'],
    set: ['She took! Three on the vine', 'Keep one of three in {n} days.'],
    setNow: ['She took! Three on the vine', 'Time to keep one of three.'],
  },
  // ---------------------------------------------------------------- the dawn (plan §3.12, rulings R5: no odds in year 1)
  dawn: {
    moss: ["Dawn. A flower opens... she won't wait... the bees might... if Marlene lets 'em.", 'Tomorrow at dawn, we choose. Count the bees... zzz.'],
    text: 'Her first flower is open, and she will not wait.',
    textAgain: 'Another dawn. Another flower, and she still will not wait.',
    moon: "Moon's full in {n} days. Just saying... zzz.", moonFull: "Moon's full tonight. Just saying... zzz.",
    bees: 'Let the bees', paws: 'Your own paws', wait: 'Not today',
    beesSub: { many: '{n} bees out, busy as anything', one: 'One bee out. Just the one.', some: '{n} bees out' },
    pawsSub: 'A soft brush and a steady paw',
    waitSub: 'Hal says tomorrow: {word}, about {pct}%',
    lastSub: 'Last dawn before the bees decide for you',
    // years 2+: the odds come back, and the father matters (bees bring fresh blood; paws keep Grandpa's line)
    beesOdds: '{n} bees out · about {p} in 10 take · fresh blood',
    pawsOdds: "About {p} in 10, any dawn · keeps the line",
    crossOdds: 'By paw · about {p} in 10 · new blood',
    waitOdds: 'Hal says tomorrow ~{pct}% · costs a day',
  },
  // ---------------------------------------------------------------- the consequence lines (plan §3.12), filled from T
  feed: {
    none: 'Free. She does fine on dirt and sunshine.',
    kelp: '${cost} a day, about ${total} to the weigh-off · she weighs in about {pct}% heavier',
  },
  shade: {
    off: 'Down: full sun, full growth. A heat day scalds her.',
    on: 'Up: no scald. About {pct}% slower on a foggy day, {clear}% on a clear one.',
    heat: 'Heat today! Sail up, or she scalds.', heatTomorrow: 'Hal calls heat tomorrow. Sail up tonight?',
  },
  dial: {
    title: 'Water',
    light: 'Ease: about {slow}% slower. She creaks about {less}.',
    normal: "Normal: Gran's way.",
    heavy: 'Push: about {fast}% faster. She creaks about {more}. Ride one and she may split.',
    names: { light: 'Ease', normal: 'Normal', heavy: 'Push' },
  },
  soak: { label: "She's parched", sub: 'Soak · sudden water can split a big girl' },
  crier: {
    tell: ['Tell the Crier: {est}', 'More folks come W1 and W2: have pumpkins for them. And raccoons.'],
    secret: ['Keep it secret', 'Old Moss says she grows better unwatched.'],
  },
  // ---------------------------------------------------------------- the creak lesson adds the dial (plan §8.1)
  creak: ["She's... talking. Not nicely.", 'Ease, Normal, Push. Push grows her faster... creaks her twice as often... your call... zzz.'],
  heal: { light: 'She creaked. You eased off. She thanked you. Quietly.', heavy: 'She creaked. She healed. Push held.' },
  // ---------------------------------------------------------------- kelp: Old Moss's first visit (plan §8.1)
  kelp: ['Old Moss. Pumpkin whisperer. Retired. Mostly... zzz.', "Kelp tea... from the cove. She'll drink it. They always drink it.",
    'Two dollars a day. She grows... about {frac} more. I measured once... zzz.'],
  // ---------------------------------------------------------------- receipts: only at a visible event (rulings R9)
  receipts: {
    dawn: {
      clearBees: ['moss', 'First try. Clear dawns... the bees know... I told you... zzz.'],
      fogBees: ['moss', 'One bee did all that. Give her a medal... zzz.'],
      fogPaws: ['moss', 'Took on a fog dawn. Lucky paws.'],
      clearPaws: ['moss', 'Bees have six legs. You have... enthusiasm.'],
      late: ['moss', 'Took her a few dawns. They all take a few dawns... most of them... zzz.'],
    },
    heat: { clean: ['hal', 'Three days of heat and not a scald on her, Cove! Smart cookie. Awooo!'],
      scald: ['hal', 'She took a scald in that heat, Cove. Ouch. Sail up next time. Awooo!'] },
    cull: {
      stumpCreak: ['vance', "Stump girl's creaking. Told you, rookie. Not that I care."],
      stumpQuiet: ['vance', "Stump girl's holding. Beginner's luck, rookie. Not that I care."],
      safeCreak: ['vance', 'Creaking at ninety degrees? Happens. Ease off, rookie.'],
      safeQuiet: ['vance', "Ninety degrees. Smart. Don't let it go to your head, rookie."],
      roundCreak: ['vance', "Even the round one creaks, rookie. Pretty doesn't mean quiet."],
      roundQuiet: ['vance', "The round one. Pretty. Pretty doesn't win the scale, rookie. Not that I care."],
      twinsCreak: ['vance', 'Twins, creaking in stereo. My father warned me. Not that I care.'],
      twinsQuiet: ['vance', "Twins, both quiet. Weird. I don't like it, rookie."],
    },
  },
  // ---------------------------------------------------------------- the tape: the pace line (plan §3.12; R9: kelp folds in)
  pace: {
    line: 'On pace for about {lb} lb, give or take {give}.',
    vance: 'Vance usually grows about {v}.',
    kelp: "Kelp's added about {k} lb.",
    none: 'One tape is a guess. Two make a pace.',
  },
  measure: { cooldown: 'She hates the tape. Next tape {day}.', next: 'Next tape {day}', button: 'Measure', knock: 'Knock' },
  // ---------------------------------------------------------------- the first tape, in public (rulings R0, R5)
  crawl: {
    hal: 'KQSC is LIVE from the Vine Crawl! First stop: the rookie\'s corner. Awooo!',
    vance: "Eyeball says {n}. My eyeball's been at this since '79. Not that I care.",
    tom: "Pfft. {n}, easy. I've got one twice that at home. Resting.",
    title: 'Your guess?', tapeTitle: 'The tape', revealTitle: 'The tape says',
    eyebrow: 'The Vine Crawl · Aug 1',
    text: 'The whole Cove is at your fence. Vance says {v}. Big Tom says {t}. What do you say?',
    knock: 'Knock first', knockSub: 'The Cove hushes. Deep means heavier than she looks',
    knockWords: { deep: 'THOONK. Deep.', mid: 'Thunk.', high: 'Tonk. Hollow-ish.' },
    under: 'Under {a}', mid: '{a} to {b}', over: 'Over {b}',
    tape: 'The Crier needs a NUMBER. Over the top, ground to ground. You hold that end.',
    pull: 'PULL THE TAPE',
    right: 'ROOKIE GUESSES RIGHT. Correction: rookie guesses EXACTLY right. Stop the press.',
    wrong: "Vance's eyeball wins this one. The Crier prints {est}. Correction: the Crier prints it BIG.",
    nobody: 'NOBODY GUESSED IT. The Crier prints {est}. Correction: everybody was wrong. Even Vance.',
    tomOff: "Big Tom was only {pct}% off. That's a personal best, Tom.",
    done: 'Done',
    gran: "Every grower in the Cove looked over your fence, and you didn't hide. Your grandpa hid. Every year.",
    you: 'You',
  },
  // ---------------------------------------------------------------- Edna's Sunday tape (rulings R4)
  // a toast pill, in Edna's voice (the first Sunday was explained at the Crawl)
  sunday: [
    "Edna's Sunday tape: {NAME}, {est}. {delta} on the week. The Crier likes a number that goes UP.",
    "Edna's Sunday tape: {est}. {delta} in a week. Correction: in a GLORIOUS week.",
    "Edna's Sunday tape: {est} for {NAME}, {delta}. Vance asked. I didn't tell him. I told him.",
    "Edna's Sunday tape: {NAME} reads {est}, {delta} on the week. Hold still, dear. Not you. Her.",
    "Edna's Sunday tape: {est}, {delta}. {NAME} is front page. Well. Page three.",
  ],
  sundayFirst: "I'll tape her every Sunday for the Crier, rookie. You tape her whenever you can't wait.",
};
export default CL;
