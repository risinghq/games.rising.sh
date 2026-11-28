// ============================================================================
//  HUD: clock, place, objective tracker, minimap, party & warmth, spells,
//  dialogue & choices, toasts, journal, world map, menu, title & ending
// ============================================================================
const $: any = (id: any) => document.getElementById(id);
// straight quotes → typographic ones, for everything the player reads
const curly: any = (s: any) => typeof s !== 'string' || (s.indexOf("'") < 0 && s.indexOf('"') < 0) ? s :
  s.replace(/(^|[\s(\[{\u2014\u2013-])'(?=(em|til|tis|twas|cause|round|n|ere|neath)\b)/gi, '$1\u2019')
    .replace(/(^|[\s(\[{\u2014\u2013-])'/g, '$1\u2018').replace(/'/g, '\u2019')
    .replace(/(^|[\s(\[{\u2014\u2013-])"/g, '$1\u201C').replace(/"/g, '\u201D');
const MAPR: any = { x0: -178, z0: -168, size: 356 };   // the square of the world the maps cover
const MAPDOTS: any = [];                                 // extra map marks (rocks, stones, beacons)
const MAP_LABELS: any = [
  ['Emberwick', 0, 2, 1], ['Southfields', 26, 82, 0.8], ['The Long Field', -13, 122, 0.7], ['Wisp Fen', -112, 66, 0.9],
  ['Barrow Downs', -118, -20, 0.9], ['Kindling Stones', -112, -72, 0.6], ['The Gloamwood', 98, -42, 0.9], ['The Hollow', 118, -100, 0.6],
  ["Grumblethorn's Mountain", -10, -92, 0.8], ['North Watch', 12, -45, 0.55], ['Orchard', 74, 62, 0.6], ['Crossroads', 6, 143, 0.55],
  ["Founders' Barrow", -140, -27, 0.55], ["Hesk's Isle", -118, 99, 0.55],
];
const SPELL_ICON: any = {
  mend: '<svg viewBox="0 0 32 32"><path d="M16 29c-6 0-10-4-10-9.5 0-5 4-8 6-13 1 3 3 4.5 4 4.5 0-3 1.5-6 4-8 1 5 6 8.5 6 16.5 0 5.5-4 9.5-10 9.5z" fill="#ffb04a"/><path d="M16 14v10M11 19h10" stroke="#5a2a08" stroke-width="2.6" stroke-linecap="round"/></svg>',
  flare: '<svg viewBox="0 0 32 32"><g stroke="#fff0c0" stroke-width="2.2" stroke-linecap="round"><path d="M16 3v6M16 23v6M3 16h6M23 16h6M6.8 6.8l4.2 4.2M21 21l4.2 4.2M6.8 25.2l4.2-4.2M21 11l4.2-4.2"/></g><circle cx="16" cy="16" r="5" fill="#ffe08a"/></svg>',
  reveal: '<svg viewBox="0 0 32 32"><path d="M2.5 16C6 9.5 10.5 6.5 16 6.5S26 9.5 29.5 16C26 22.5 21.5 25.5 16 25.5S6 22.5 2.5 16z" fill="none" stroke="#bfe0ff" stroke-width="2"/><circle cx="16" cy="16" r="5.2" fill="#bfe0ff"/><circle cx="16" cy="16" r="2.2" fill="#1a2a3a"/></svg>',
  wisp: '<svg viewBox="0 0 32 32"><path d="M8 26c3-1 6-3 8-7" stroke="#7affa8" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/><path d="M5 22c2 0 4-1 6-3" stroke="#7affa8" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".4"/><circle cx="20" cy="12" r="6.5" fill="#7affa8" opacity=".35"/><circle cx="20" cy="12" r="3.8" fill="#d0ffe0"/></svg>',
};
const REGION_NAMES: any = {
  village: ['Emberwick', 'a village with one fire'], fields: ['Southfields', 'the farms of the valley floor'], field: ['The Long Field', 'where the last sheaf stands'],
  fen: ['The Wisp Fen', 'reeds, pools and little lights'], downs: ['The Barrow Downs', 'old graves on the high grass'], gloam: ['The Gloamwood', 'the wood that went cold'],
  mountain: ['Under the Mountain', 'the cliffs of Grumblethorn’s fell'], vale: ['The Vale', 'between the village and the wild'],
};
function regionAt(x: any, z: any) : any {
  if (UG.zone) return null;
  if (longFieldK(x, z) > 0.5) return 'field';
  if (wGloam(x, z) > 0.45) return 'gloam';
  if (wFen(x, z) > 0.45) return 'fen';
  if (wDowns(x, z) > 0.45) return 'downs';
  if (Math.hypot(x, z) < 56) return 'village';
  if (mountainH(x, z) > 1.2) return 'mountain';
  if (wFields(x, z) > 0.5) return 'fields';
  return 'vale';
}

const UI: any = {
  bubbles: [], dlgTyping: null, mapBase: null, colliderLines: null, bannerT: 0, lastPlace: '', toasts: [], region: null, regionT: 0,
  status(s: any) : any { $('status').textContent = s; },

  // ---- title -------------------------------------------------------------------------------------
  ready() : any {
    const go: any = $('go'), nw: any = $('goNew'), save: any = readSave();
    go.disabled = false; $('goEdit').hidden = false; $('goRestore').hidden = false;
    if (save) {
      const m: any = save.q?.main ?? 0;
      go.textContent = 'Continue';
      go.title = `${QUESTS.main.stages[m]?.short || 'Harvest Eve'} · ${String(Math.floor(save.time || 17)).padStart(2, '0')}:${String(Math.floor(((save.time || 17) % 1) * 60)).padStart(2, '0')}`;
      UI.status(`Saved: ${go.title}`);
      nw.hidden = false;
      nw.onclick = () => { if (nw.dataset.armed) { clearSave(); UI.begin(null); } else { nw.dataset.armed = 1; nw.textContent = 'Start over? Click again'; setTimeout(() => { delete nw.dataset.armed; nw.textContent = 'New game'; }, 3000); } };
      go.onclick = () => UI.begin(save);
    } else {
      go.textContent = 'Begin';
      UI.status('');
      go.onclick = () => UI.begin(null);
    }
    go.focus({ preventScroll: true });
  },
  begin(save: any) : any {
    if (!CAM.intro || $('go').disabled) return;
    AUDIO.init();
    CAM.intro = false;
    $('intro').classList.add('gone');
    $('hud').classList.remove('off');
    renderer.domElement.focus?.({ preventScroll: true });
    startGame(save);
    setTimeout(() => { if (!$('help').classList.contains('open')) { $('help').classList.add('tucked'); $('helpToggle').classList.add('show'); } }, 60000);
  },
  toTitle() : any {
    saveGame(true);
    location.reload();
  },

  init() : any {
    qsaAll('[data-time]').forEach((b: any) => b.addEventListener('click', () => { TIME.h = parseFloat(b.dataset.time); b.blur(); }));
    $('pauseBtn').addEventListener('click', (e: any) => { TIME.paused = !TIME.paused; e.currentTarget.setAttribute('aria-pressed', TIME.paused); e.currentTarget.blur(); });
    $('tCut').addEventListener('click', (e: any) => { UI.toggleCutaway(); e.currentTarget.blur(); });
    $('tOcc').addEventListener('click', (e: any) => { CUT.occ = !CUT.occ; e.currentTarget.setAttribute('aria-pressed', CUT.occ); e.currentTarget.blur(); });
    $('tCol').addEventListener('click', (e: any) => { const on: any = UI.toggleColliders(); e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.blur(); });
    $('dialog').addEventListener('click', (e: any) => { if (e.target.closest('li')) return; dlgAdvance(); });
    $('prompt').addEventListener('click', () => interact());
    $('helpToggle').addEventListener('click', (e: any) => { const h: any = $('help'); h.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', h.classList.contains('open')); });
    $('rotL').addEventListener('click', () => CAM.yawT -= PI / 4);
    $('rotR').addEventListener('click', () => CAM.yawT += PI / 4);
    $('tAct').addEventListener('click', () => { if (DLG.active) dlgAdvance(); else interact(); });
    $('tDash').addEventListener('click', () => dash());
    $('jBtn').addEventListener('click', (e: any) => { UI.openJournal(); e.currentTarget.blur(); });
    $('mBtn').addEventListener('click', (e: any) => { UI.openMap(); e.currentTarget.blur(); });
    $('mapBtn').addEventListener('click', () => UI.openMap());
    $('menuBtn').addEventListener('click', (e: any) => { UI.openMenu(); e.currentTarget.blur(); });
    $('eBtn').addEventListener('click', (e: any) => { e.currentTarget.blur(); editOpen(); });
    $('mEdit').addEventListener('click', () => { UI.closeModals(); editOpen(); });
    $('goEdit').addEventListener('click', () => { if (CAM.intro && !$('go').disabled) { AUDIO.init(); editOpen({ fromTitle: true }); } });
    // a save you can carry: browser storage can be lost, so the game copies out as a code and pastes back in
    $('mBackup').addEventListener('click', () => UI.openSaveCode());
    $('goRestore').addEventListener('click', () => { if (CAM.intro && !$('go').disabled) UI.openSaveCode(); });
    $('scCopy').addEventListener('click', async (e: any) => { const b: any = e.currentTarget, ta: any = $('scOut'); ta.select(); let ok: any = false; try { await navigator.clipboard.writeText(ta.value); ok = true; } catch (er: any) { try { ok = document.execCommand('copy'); } catch (er2: any) { ok = false; } } b.textContent = ok ? 'Copied — keep it somewhere safe' : 'Select the code and copy it'; });
    $('scRestore').addEventListener('click', () => {
      const d: any = UI.parseSaveCode($('scIn').value);
      if (!d) { $('scMsg').textContent = 'That doesn’t look like an Emberwick save code.'; return; }
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (er: any) { $('scMsg').textContent = 'This browser won’t let the game keep a save here.'; return; }
      G.started = false;   // so nothing overwrites it on the way out
      location.reload();
    });
    $('tracker').addEventListener('click', () => UI.openJournal());
    for (const m of qsaAll('.modal')) {
      m.addEventListener('click', (e: any) => { if (e.target === m || e.target.closest('[data-close]')) UI.closeModals(); });
    }
    $('mResume').addEventListener('click', () => UI.closeModals());
    $('mJournal').addEventListener('click', () => UI.openJournal());
    $('mMap').addEventListener('click', () => UI.openMap());
    $('mMute').addEventListener('click', (e: any) => { const m: any = AUDIO.toggleMute(); e.currentTarget.setAttribute('aria-pressed', m); e.currentTarget.textContent = m ? 'Sound off' : 'Mute all'; });
    $('mQuit').addEventListener('click', () => UI.toTitle());
    for (const [id, k] of [['vMusic', 'music'], ['vSfx', 'sfx'], ['vAmb', 'amb']]) {
      const el: any = $(id);
      try { const v: any = localStorage.getItem('emberwick.vol.' + k); if (v !== null) { el.value = v; AUDIO.vol[k] = +v; } } catch (e: any) { }
      el.addEventListener('input', () => { AUDIO.setVol(k, +el.value); try { localStorage.setItem('emberwick.vol.' + k, el.value); } catch (e: any) { } });
    }
    $('bigmap').addEventListener('click', (e: any) => UI.mapClick(e));
    $('bigmap').addEventListener('mousemove', (e: any) => UI.mapHover(e));
    $('endWander').addEventListener('click', () => { $('ending').hidden = true; UI.fade(0, 1.5); });
    $('endTitleBtn').addEventListener('click', () => UI.toTitle());
    $('endAgain').addEventListener('click', () => loadFieldCheckpoint());
    const travel: any = [
      ['Square', () => teleportParty(0, 10.4, PI)], ['Tower', () => teleportParty(-30, -24.5, PI)], ['Forge', () => teleportParty(25.5, 2.4, PI)],
      ['Cave mouth', () => teleportParty(MOUTH.x + 0.6, MOUTH.z + 6.5, PI)], ['Long Field', () => teleportParty(2, 105, -PI / 2)], ['Farm', () => teleportParty(30, 106, PI)],
      ['Fen', () => teleportParty(-112, 85, PI)], ['Stones', () => teleportParty(-112, -50, PI)], ['Barrow', () => teleportParty(-128, -38, -PI / 2)],
      ['Gloamwood', () => teleportParty(72, -20, PI)], ['Hollow', () => teleportParty(118, -76, PI)],
    ];
    for (const [n, fn] of travel) { const b: any = document.createElement('button'); b.className = 'btn'; b.textContent = n; b.addEventListener('click', () => { fn(); b.blur(); }); $('travel').appendChild(b); }
    HOOKS.enter.push((b: any, f: any) => { if (b) { UI.showBanner(b.name, `${b.sub} · ${b.floorNames[f] || 'Floor ' + (f + 1)}`); UI.partyBanter(b); } });
    HOOKS.floor.push((b: any, f: any) => UI.showBanner(b.name, `${b.floorNames[f] || 'Floor ' + (f + 1)}`, true));
  },
  toggleCutaway() : any { CUT.enabled = !CUT.enabled; $('tCut').setAttribute('aria-pressed', CUT.enabled); UI.toast('View', CUT.enabled ? 'Walls between you and the camera fade away.' : 'Walls, floors and roofs stay solid.', 'info', 2); },
  togglePanel() : any { const p: any = $('panel'); p.hidden = !p.hidden; },
  cycleTime() : any { const stops: any = [6.3, 12, 18.1, 22.5]; const h: any = TIME.h; TIME.h = stops.find((s: any) => s > h + 0.05) ?? stops[0]; },
  showBanner(name: any, sub: any, quick: any) : any {
    $('bannerName').textContent = name; $('bannerSub').textContent = sub;
    const b: any = $('banner'); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    UI.bannerT = quick ? 2.2 : 3.6;
  },
  partyBanter(b: any) : any {
    const lines: any = BANTER[b.id]; if (!lines || DLG.active || SCENE.active) return;
    const who: any = R() < 0.5 ? 1 : 2;
    if (lines[who - 1]) setTimeout(() => UI.bubble(PARTY[who], lines[who - 1], 3.6), 900);
    if (lines[2 - who] && R() < 0.6) setTimeout(() => UI.bubble(PARTY[3 - who], lines[2 - who], 3.6), 4300);
  },
  bubble(c: any, text: any, dur: any = 3) : any {
    if (!c || !text) return;
    for (const b of UI.bubbles) if (b.c === c) b.el.remove();
    UI.bubbles = UI.bubbles.filter((b: any) => b.c !== c);
    const el: any = document.createElement('div');
    el.className = 'bubble' + (PARTY.includes(c) ? ' party' : '');
    el.textContent = curly(text);
    $('bubbles').appendChild(el);
    UI.bubbles.push({ c, el, t: dur });
  },

  // ---- dialogue ---------------------------------------------------------------------------------------
  dlgLine(who: any, text: any, o: any = {}) : any {
    const sp: any = speakerOf(who), d: any = $('dialog');
    d.hidden = false; $('prompt').hidden = true; $('hud').classList.add('talking');
    d.classList.toggle('nar', sp.cls === 'nar');
    const nm: any = $('dlgName'); nm.textContent = sp.name; nm.className = 'dialog-name ' + sp.cls;
    $('dlgTitle').textContent = sp.title;
    $('dlgChoices').hidden = true; $('dlgMore').hidden = false;
    const el: any = $('dlgText'); el.textContent = '';
    UI.dlgTyping = { text: curly(text), el, acc: 0 };
  },
  dlgChoices(list: any) : any {
    const ol: any = $('dlgChoices');
    if (!list) { ol.hidden = true; ol.innerHTML = ''; $('dlgMore').hidden = false; return; }
    UI.finishTyping();
    $('dialog').hidden = false; $('hud').classList.add('talking');
    ol.innerHTML = '';
    list.forEach((c: any, i: any) => {
      const li: any = document.createElement('li');
      li.innerHTML = '';
      const sp: any = document.createElement('span'); sp.textContent = curly(c.t); li.appendChild(sp);
      if (c.sub) { const s: any = document.createElement('small'); s.textContent = curly(c.sub); sp.appendChild(s); }
      li.addEventListener('click', (e: any) => { e.stopPropagation(); pickChoice(i); });
      li.addEventListener('mouseenter', () => { DLG.sel = i; UI.selChoice(); });
      ol.appendChild(li);
    });
    ol.hidden = false; $('dlgMore').hidden = true;
    UI.selChoice();
  },
  selChoice() : any { [...$('dlgChoices').children].forEach((li: any, i: any) => li.classList.toggle('sel', i === DLG.sel)); },
  typing() : any { return !!UI.dlgTyping; },
  finishTyping() : any { if (UI.dlgTyping) { UI.dlgTyping.el.textContent = UI.dlgTyping.text; UI.dlgTyping = null; } },
  hideDialog() : any { $('dialog').hidden = true; UI.dlgTyping = null; $('dlgChoices').hidden = true; $('hud').classList.remove('talking'); },

  // ---- toasts, screen effects ------------------------------------------------------------------------------
  toast(title: any, text: any, kind: any = 'info', dur: any = 4) : any {
    const wrap: any = $('toasts');
    if (UI.toasts.some((t: any) => t.title === title && t.text === text)) return;
    const el: any = document.createElement('div');
    el.className = 'toast ' + kind;
    const b: any = document.createElement('b'); b.textContent = curly(title); el.appendChild(b);
    const s: any = document.createElement('span'); s.textContent = curly(text); el.appendChild(s);
    wrap.appendChild(el);
    const t: any = { el, title, text, t: dur + Math.min(3, text.length / 40) };
    UI.toasts.push(t);
    while (UI.toasts.length > 4) { const o: any = UI.toasts.shift(); o.el.remove(); }
    if (kind === 'quest' || kind === 'done') AUDIO.quest?.();
    if (kind === 'spark') AUDIO.spark?.();
    if (kind === 'spell') AUDIO.chime?.(5);
  },
  letterbox(on: any) : any { $('letterbox').classList.toggle('on', !!on); $('hud').classList.toggle('cine', !!on); },
  fade(to: any, sec: any = 0.6) : any { const f: any = $('fader'); f.style.transition = `opacity ${sec}s`; f.style.opacity = to; f.style.pointerEvents = to > 0.5 ? 'auto' : 'none'; },
  vision(on: any) : any { $('vision').classList.toggle('on', !!on); },
  flash(kind: any) : any { if (kind === 'flame') { const f: any = $('flameFill').parentElement.parentElement; f.classList.remove('low'); void f.offsetWidth; f.classList.add('low'); setTimeout(() => f.classList.remove('low'), 900); } },
  boss(on: any, k: any = 1, name: any) : any { const b: any = $('bossbar'); b.hidden = !on; if (name) b.querySelector('.bossname').textContent = name; $('bossHp').style.width = (clamp(k, 0, 1) * 100).toFixed(1) + '%'; },

  // ---- spells -------------------------------------------------------------------------------------------
  buildSpellbar() : any {
    const wrap: any = $('spells'); wrap.innerHTML = '';
    $('spellbar').hidden = !G.flags.lantern;
    for (const id of SPELL_ORDER) {
      const S: any = SPELLS[id], b: any = document.createElement('button');
      b.className = 'spell' + (G.spells[id] ? '' : ' locked');
      b.dataset.spell = id;
      b.title = G.spells[id] ? `${S.name} (${S.key}) — ${S.desc}. Costs ${S.cost} flame.` : 'Not yet learned. Draw from a new kind of fire.';
      b.innerHTML = `${G.spells[id] ? SPELL_ICON[id] : ''}<span class="key">${S.key}</span>${G.spells[id] ? `<span class="cost">${S.cost}</span><span class="nm">${S.name}</span>` : ''}<i class="cdv"></i>`;
      b.addEventListener('click', (e: any) => { e.currentTarget.blur(); castSpellKey(S.key); });
      wrap.appendChild(b);
    }
  },
  updateSpellbar() : any {
    if (!G.flags.lantern) return;
    const k: any = G.flame / G.flameMax;
    $('flameFill').style.width = (k * 100).toFixed(1) + '%';
    const n: any = G.flame.toFixed(G.flame < 10 ? 1 : 0);
    if (UI._fn !== n) { $('flameNum').textContent = `${Math.floor(G.flame)}/${G.flameMax}`; UI._fn = n; }
    for (const b of $('spells').children) {
      const id: any = b.dataset.spell, S: any = SPELLS[id];
      if (!G.spells[id]) continue;
      b.classList.toggle('poor', G.flame < S.cost);
      const cd: any = MAGIC.cd[id] > 0 ? MAGIC.cd[id] / S.cd : 0;
      b.lastElementChild.style.setProperty('--cd', (cd * 100).toFixed(0) + '%');
    }
  },

  // ---- objective tracker ------------------------------------------------------------------------------
  updateTracker() : any {
    const tr: any = $('tracker');
    const id: any = G.track && QUESTS[G.track] && q(G.track) >= 0 && !QUESTS[G.track].stages[q(G.track)]?.done ? G.track : (q('main') >= 0 && !QUESTS.main.stages[q('main')]?.done ? 'main' : null);
    if (!id || !G.started || G.ending) { tr.hidden = true; return; }
    const Q: any = QUESTS[id], st: any = Q.stages[q(id)];
    tr.hidden = false;
    $('trackTitle').textContent = Q.title;
    $('trackText').textContent = curly(typeof st.text === 'function' ? st.text() : st.text);
    UI.trackId = id;
  },
  trackTarget() : any {
    const id: any = UI.trackId; if (!id) return null;
    const st: any = QUESTS[id]?.stages[q(id)];
    if (!st || !st.at) return null;
    const t: any = typeof st.at === 'function' ? st.at() : st.at;
    return t || null;
  },

  // ---- journal ------------------------------------------------------------------------------------------
  modalOpen() : any { return [...qsaAll('.modal')].some((m: any) => !m.hidden); },
  closeModals() : any { for (const m of qsaAll('.modal')) m.hidden = true; UI.paused = false; renderer.domElement.focus?.({ preventScroll: true }); },
  openJournal() : any {
    UI.closeModals(); UI.paused = true;
    const jq: any = $('jQuests'); jq.innerHTML = '';
    const ids: any = Object.keys(QUESTS).filter((k: any) => q(k) >= 0).sort((a: any, b: any) => (a === 'main' ? -1 : b === 'main' ? 1 : (QUESTS[a].stages[q(a)]?.done ? 1 : 0) - (QUESTS[b].stages[q(b)]?.done ? 1 : 0)));
    for (const id of ids) {
      const Q: any = QUESTS[id], s: any = q(id), st: any = Q.stages[s], done: any = !!st?.done;
      const d: any = document.createElement('div');
      d.className = 'jq' + (UI.trackId === id ? ' tracked' : '') + (done ? ' done' : '');
      const h: any = document.createElement('h4'); h.textContent = Q.title;
      const sm: any = document.createElement('small'); sm.textContent = done ? 'done' : Q.side ? (UI.trackId === id ? 'errand · tracked' : 'errand · click to track') : (UI.trackId === id ? 'the story · tracked' : 'the story · click to track');
      h.appendChild(sm); d.appendChild(h);
      const p: any = document.createElement('p'); p.textContent = curly(typeof st.text === 'function' ? st.text() : st.text); d.appendChild(p);
      const past: any = []; for (let i: any = 0; i < s; i++) { const ps: any = Q.stages[i]; if (ps && ps.log) past.push(ps.log); }
      if (past.length) { const ul: any = document.createElement('ul'); for (const l of past.slice(-6)) { const li: any = document.createElement('li'); li.textContent = curly(l); ul.appendChild(li); } d.appendChild(ul); }
      if (!done) d.addEventListener('click', () => { G.track = id; UI.updateTracker(); UI.openJournal(); });
      jq.appendChild(d);
    }
    const jl: any = $('jLantern'); jl.innerHTML = '';
    if (!G.flags.lantern) jl.innerHTML = '<div class="jline"><span>No lantern yet.</span></div>';
    else {
      const l: any = document.createElement('div'); l.className = 'jline'; l.innerHTML = `<span>Flame</span><span>${Math.floor(G.flame)} / ${G.flameMax}</span>`; jl.appendChild(l);
      for (const id of SPELL_ORDER) { const S: any = SPELLS[id], e: any = document.createElement('div'); e.className = 'jline'; e.innerHTML = `<span>${S.key}. ${G.spells[id] ? S.name : '—'}</span><span>${G.spells[id] ? S.desc : 'draw from ' + ({ hearth: 'a hearth', forge: 'a forge', candle: 'old candles', wisp: 'a wisp' } as any)[S.kind]}</span>`; jl.appendChild(e); }
    }
    const js: any = $('jSparks'); js.innerHTML = '';
    const sl: any = document.createElement('div'); sl.className = 'jline'; sl.innerHTML = `<span>Carried in your lantern</span><span>${G.sparks.length} of ${SPARK_TOTAL}</span>`; js.appendChild(sl);
    for (const s of G.sparks) { const e: any = document.createElement('div'); e.className = 'jline'; e.innerHTML = `<span>✦ ${SPARK_NAMES[s] || s}</span><span></span>`; js.appendChild(e); }
    const jf: any = $('jFinds'); jf.innerHTML = '';
    const hl: any = document.createElement('div'); hl.className = 'jline'; hl.innerHTML = `<span>Orrin’s hats</span><span>${G.hats.length} of ${HATS.length}</span>`; jf.appendChild(hl);
    for (const h of G.hats) { const H: any = HATS.find((x: any) => x.id === h); if (!H) continue; const e: any = document.createElement('div'); e.className = 'jline'; e.innerHTML = `<span>${H.name}</span><span>${H.note}</span>`; jf.appendChild(e); }
    for (const [k, v] of entriesAny(G.items)) if (v && ITEMS[k]) { const e: any = document.createElement('div'); e.className = 'jline'; e.innerHTML = `<span>${ITEMS[k].name}</span><span>${ITEMS[k].note}</span>`; jf.appendChild(e); }
    $('journal').hidden = false;
  },

  // ---- maps ----------------------------------------------------------------------------------------------
  buildMap() : any {
    // the whole valley painted once into a canvas; the minimap and the world map draw from it
    const M: any = MAPR, N: any = 1024, PX: any = 2.4, cells: any = Math.round(M.size / PX);
    const base: any = document.createElement('canvas'); base.width = base.height = cells;
    const g0: any = base.getContext('2d'), img: any = g0.createImageData(cells, cells), D: any = img.data;
    for (let j: any = 0; j < cells; j++) for (let i: any = 0; i < cells; i++) {
      const x: any = M.x0 + (i + 0.5) * PX, z: any = M.z0 + (j + 0.5) * PX, h: any = terrainH(x, z);
      let c: any;
      if (h < WATER_Y) c = _c1.set(0x2f5f74).lerp(_c2.set(0x5a94a8), clamp((h - WATER_Y + 1.4) / 1.4, 0, 1) * 0.6);
      else {
        const sl: any = Math.hypot(terrainH(x + PX, z) - terrainH(x - PX, z), terrainH(x, z + PX) - terrainH(x, z - PX)) / (2 * PX);
        c = groundColor(x, z, h, pathInfo(x, z), sl);
        c.multiplyScalar(clamp(1 + (terrainH(x - PX, z - PX) - terrainH(x + PX, z + PX)) * 0.12, 0.6, 1.3));
        if (wGloam(x, z) > 0.3) c.lerp(_c2.set(0x1a1a24), wGloam(x, z) * 0.35);
      }
      if (!inWorld(x, z)) c.multiplyScalar(0.45);
      const o: any = (j * cells + i) * 4;
      D[o] = clamp(Math.sqrt(c.r) * 255, 0, 255); D[o + 1] = clamp(Math.sqrt(c.g) * 255, 0, 255); D[o + 2] = clamp(Math.sqrt(c.b) * 255, 0, 255); D[o + 3] = 255;
    }
    g0.putImageData(img, 0, 0);
    const cv: any = document.createElement('canvas'); cv.width = cv.height = N;
    const g: any = cv.getContext('2d'); g.imageSmoothingEnabled = true;
    g.drawImage(base, 0, 0, N, N);
    const S: any = M.size / N, W: any = (x: any, z: any) => [(x - M.x0) / S, (z - M.z0) / S];
    g.fillStyle = '#9a9488'; g.beginPath(); g.arc(...W(0, 0), PLAZA.r / S, 0, TAU); g.fill();
    for (const c of CANOPIES) { g.fillStyle = 'rgba(30,50,24,0.55)'; g.beginPath(); g.arc(...W(c.x, c.z), (c.r * 0.9) / S, 0, TAU); g.fill(); }
    for (const c of MAPDOTS) { g.fillStyle = c.c; g.beginPath(); g.arc(...W(c.x, c.z), c.r / S, 0, TAU); g.fill(); }
    for (const b of BUILDINGS) {
      if (!b.footprint) continue;
      g.beginPath(); b.footprint.forEach((p, i) => { const q2: any = W(p[0], p[1]); if (i) g.lineTo(...q2); else g.moveTo(...q2); }); g.closePath();
      g.fillStyle = '#' + col(b.mapColor).getHexString(); g.fill();
      g.lineWidth = 2; g.strokeStyle = 'rgba(20,14,10,0.85)'; g.stroke();
    }
    UI.mapBase = cv;
    // the underground map: passages and rooms carved out of the dark
    const cu: any = document.createElement('canvas'); cu.width = cu.height = N;
    const gu: any = cu.getContext('2d');
    gu.fillStyle = '#17130f'; gu.fillRect(0, 0, N, N);
    const fill: any = { earth: '#7a6247', masonry: '#8a8274', arcane: '#6c6e80', rock: '#6a625a', crypt: '#7e8074' };
    for (const r of UGR) {
      if (!r.floor && !r.stairs) continue;
      const key: any = Object.keys(UGS).find((k: any) => UGS[k] === r.style) || 'earth';
      gu.beginPath(); r.pts.forEach((p: any, i: any) => { const q2: any = W(p[0], p[1]); if (i) gu.lineTo(...q2); else gu.moveTo(...q2); }); gu.closePath();
      gu.fillStyle = fill[key] || '#7a6247'; gu.fill();
    }
    gu.strokeStyle = 'rgba(10,8,6,0.9)'; gu.lineWidth = 3; gu.lineCap = 'round';
    for (const [a, b] of UGP.walls || []) { gu.beginPath(); gu.moveTo(...W(a[0], a[1])); gu.lineTo(...W(b[0], b[1])); gu.stroke(); }
    UI.mapUG = cu;
  },
  drawMap() : any {
    const cv: any = $('minimap'), g: any = cv.getContext('2d'), w: any = cv.width, R2: any = w / 2, zoom: any = 3.4 * (w / 344);
    g.clearRect(0, 0, w, w);
    g.save();
    g.beginPath(); g.arc(R2, R2, R2, 0, TAU); g.clip();
    g.fillStyle = UG.zone ? '#17130f' : '#2a3a22'; g.fillRect(0, 0, w, w);
    g.translate(R2, R2); g.rotate(CAM.yaw); g.scale(zoom, zoom); g.translate(-player.x, -player.z);
    const base: any = UG.zone && UI.mapUG ? UI.mapUG : UI.mapBase;
    if (base) g.drawImage(base, MAPR.x0, MAPR.z0, MAPR.size, MAPR.size);
    if (!UG.zone) drawAreasOnMap(g, (x: any, z: any) => [x, z], 1, false);
    if (!UG.zone) for (const f of KFIRES) {
      if (!(f.wayfire || f.beacon) || Math.abs(f.x - player.x) > 60 || Math.abs(f.z - player.z) > 60) continue;
      g.fillStyle = f.lit ? '#ffb04a' : '#5a5a5a'; g.beginPath(); g.arc(f.x, f.z, 1.3, 0, TAU); g.fill();
    }
    for (const c of CHARS) {
      if (c === player || !c.root.visible || c.away) continue;
      if (Math.abs(c.x - player.x) > 60 || Math.abs(c.z - player.z) > 60) continue;
      const party: any = PARTY.includes(c);
      g.fillStyle = party ? '#9cc07a' : '#f1e6cf';
      g.beginPath(); g.arc(c.x, c.z, party ? 0.75 : 0.55, 0, TAU); g.fill();
    }
    for (const e of COMBAT.enemies) { if (!e.alive || !e.g.visible) continue; g.fillStyle = e.boss ? '#c8a0ff' : '#9a7ad8'; g.beginPath(); g.arc(e.x, e.z, e.boss ? 2.2 : 0.8, 0, TAU); g.fill(); }
    const tg: any = UI.trackTarget();
    if (tg && !!tg.ug === !!UG.zone) {
      const dx: any = tg.x - player.x, dz: any = tg.z - player.z, d: any = Math.hypot(dx, dz), lim: any = (R2 - 12) / zoom;
      const k: any = d > lim ? lim / d : 1, mx: any = player.x + dx * k, mz: any = player.z + dz * k;
      g.save(); g.translate(mx, mz); g.rotate(-CAM.yaw); g.rotate(PI / 4);
      g.fillStyle = '#ffd38a'; g.strokeStyle = '#2a1a0a'; g.lineWidth = 0.4; g.fillRect(-1.3, -1.3, 2.6, 2.6); g.strokeRect(-1.3, -1.3, 2.6, 2.6);
      g.restore();
    }
    // player arrow
    const fx: any = Math.sin(player.face), fz: any = Math.cos(player.face);
    g.fillStyle = '#f0a541'; g.strokeStyle = '#1a120a'; g.lineWidth = 0.35;
    g.beginPath(); g.moveTo(player.x + fx * 1.9, player.z + fz * 1.9); g.lineTo(player.x - fx * 1.1 + fz * 1.1, player.z - fz * 1.1 - fx * 1.1); g.lineTo(player.x - fx * 0.5, player.z - fz * 0.5); g.lineTo(player.x - fx * 1.1 - fz * 1.1, player.z - fz * 1.1 + fx * 1.1); g.closePath(); g.fill(); g.stroke();
    g.restore();
    const nx: any = R2 + Math.sin(CAM.yaw) * (R2 - 14), ny: any = R2 - Math.cos(CAM.yaw) * (R2 - 14);
    g.fillStyle = 'rgba(20,17,13,0.85)'; g.beginPath(); g.arc(nx, ny, 11 * (w / 344), 0, TAU); g.fill();
    g.fillStyle = '#ffd38a'; g.font = `700 ${14 * (w / 344)}px "Alegreya Sans SC", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', nx, ny + 1);
  },
  openMap() : any {
    UI.closeModals(); UI.paused = true;
    $('worldmap').hidden = false;
    UI.mapHoverF = null;
    UI.drawBigMap();
  },
  travelSpots() : any { return KFIRES.filter((f: any) => (f.wayfire || f.beacon) && f.lit); },
  canTravel() : any { return !SCENE.active && !DLG.active && !COMBAT.down && !UG.zone && !COMBAT.enemies.some((e: any) => e.alive && Math.hypot(e.x - player.x, e.z - player.z) < 14) && !G.flags.noTravel; },
  drawBigMap() : any {
    const cv: any = $('bigmap'), g: any = cv.getContext('2d'), N: any = cv.width, M: any = MAPR, S: any = M.size / N, W: any = (x: any, z: any) => [(x - M.x0) / S, (z - M.z0) / S];
    g.clearRect(0, 0, N, N);
    g.drawImage(UI.mapBase, 0, 0, N, N);
    g.fillStyle = 'rgba(10,8,6,0.18)'; g.fillRect(0, 0, N, N);
    drawAreasOnMap(g, W, S, true);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [name, x, z, k] of MAP_LABELS) {
      g.font = `700 ${Math.round(28 * k)}px "Alegreya Sans SC", sans-serif`;
      g.lineWidth = 5; g.strokeStyle = 'rgba(14,10,6,0.75)'; g.strokeText(name, ...W(x, z)); g.fillStyle = '#f1e6cf'; g.fillText(name, ...W(x, z));
    }
    for (const f of KFIRES) {
      if (!(f.wayfire || f.beacon)) continue;
      const [px, pz]: any = W(f.x, f.z), hov: any = UI.mapHoverF === f;
      g.beginPath(); g.arc(px, pz, hov ? 13 : f.beacon ? 10 : 8, 0, TAU);
      g.fillStyle = f.lit ? '#ffb04a' : '#4a4640'; g.fill(); g.lineWidth = 3; g.strokeStyle = hov ? '#fff4d0' : '#1a120a'; g.stroke();
      if (f.lit) { g.beginPath(); g.arc(px, pz, hov ? 20 : 15, 0, TAU); g.strokeStyle = 'rgba(255,190,90,0.45)'; g.lineWidth = 2; g.stroke(); }
    }
    const tg: any = UI.trackTarget();
    if (tg) { const [tx, tz]: any = W(tg.x, tg.z); g.save(); g.translate(tx, tz); g.rotate(PI / 4); g.fillStyle = '#ffd38a'; g.strokeStyle = '#2a1a0a'; g.lineWidth = 3; g.fillRect(-9, -9, 18, 18); g.strokeRect(-9, -9, 18, 18); g.restore(); }
    const [pxx, pzz]: any = W(player.x, player.z), fx: any = Math.sin(player.face), fz: any = Math.cos(player.face);
    g.fillStyle = '#f0a541'; g.strokeStyle = '#1a120a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(pxx + fx * 16, pzz + fz * 16); g.lineTo(pxx - fx * 9 + fz * 9, pzz - fz * 9 - fx * 9); g.lineTo(pxx - fx * 4, pzz - fz * 4); g.lineTo(pxx - fx * 9 - fz * 9, pzz - fz * 9 + fx * 9); g.closePath(); g.fill(); g.stroke();
    const n: any = UI.travelSpots().length;
    $('mapHint').textContent = UI.mapHoverF ? (UI.mapHoverF.lit ? (UI.canTravel() ? `travel to ${UI.mapHoverF.label}` : 'you can’t travel right now') : `${UI.mapHoverF.label} · unlit`) : n > 1 ? 'click a lit wayfire to travel there' : 'kindle wayfires and beacons to travel between them';
  },
  mapPick(e: any) : any {
    const cv: any = $('bigmap'), r: any = cv.getBoundingClientRect(), N: any = cv.width, S: any = MAPR.size / N;
    const x: any = MAPR.x0 + ((e.clientX - r.left) / r.width) * N * S, z: any = MAPR.z0 + ((e.clientY - r.top) / r.height) * N * S;
    let best: any = null, bd: any = 7;
    for (const f of KFIRES) if (f.wayfire || f.beacon) { const d: any = Math.hypot(f.x - x, f.z - z); if (d < bd) { bd = d; best = f; } }
    return best;
  },
  mapHover(e: any) : any { const f: any = UI.mapPick(e); if (f !== UI.mapHoverF) { UI.mapHoverF = f; UI.drawBigMap(); } },
  mapClick(e: any) : any {
    const f: any = UI.mapPick(e);
    if (!f || !f.lit) return;
    if (!UI.canTravel()) { UI.toast('Not now', UG.zone ? 'Find your way back up to the open sky first.' : 'Not with the gloam this close.', 'info'); return; }
    UI.closeModals();
    fastTravel(f);
  },
  saveCodeOf(json: any) : any { const b: any = new TextEncoder().encode(json); let s: any = ''; for (let i: any = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return 'EMBERWICK-SAVE-1:' + btoa(s); },
  parseSaveCode(code: any) : any {
    const t: any = (code || '').trim();
    if (t.startsWith('{')) { try { const d: any = JSON.parse(t); return d && d.v === 2 && d.q ? d : null; } catch (e: any) { return null; } }   // a save written out as plain JSON
    const m: any = /EMBERWICK-SAVE-1:([A-Za-z0-9+/=\s]+)/.exec(t); if (!m) return null;
    try { const bin: any = atob(m[1].replace(/\s+/g, '')); const d: any = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c: any) => c.charCodeAt(0)))); return d && d.v === 2 && d.q ? d : null; } catch (e: any) { return null; }
  },
  openSaveCode() : any {
    const live: any = G.started && !CAM.intro;
    UI.closeModals(); UI.paused = live;
    if (live) saveGame(true);
    let json: any = null; try { json = localStorage.getItem(SAVE_KEY); } catch (e: any) { json = null; }
    if (!json && live) json = JSON.stringify(G);
    $('scBackup').hidden = !json;
    $('scOut').value = json ? UI.saveCodeOf(json) : '';
    $('scCopy').textContent = 'Copy save code';
    $('scIn').value = ''; $('scMsg').textContent = '';
    $('savecode').hidden = false;
  },
  openMenu() : any { UI.closeModals(); UI.paused = true; $('menu').hidden = false; $('mResume').focus({ preventScroll: true }); },

  // ---- ending ---------------------------------------------------------------------------------------------
  showEnding(e: any) : any {
    $('endEyebrow').textContent = e.eyebrow || 'An ending';
    $('endTitle').textContent = e.title;
    const t: any = $('endText'); t.innerHTML = '';
    for (const para of e.text) { const p: any = document.createElement('p'); p.textContent = curly(para); t.appendChild(p); }
    const st: any = $('endStats'); st.innerHTML = '';
    const mins: any = Math.round(G.stats.play / 60);
    const errands: any = entriesAny(G.q).filter(([k, v]: any) => QUESTS[k]?.side && QUESTS[k].stages[v]?.done).length;
    for (const s of [`${G.sparks.length}/${SPARK_TOTAL} heartsparks`, `${G.hats.length}/${HATS.length} hats`, `${errands} errands run`, `${G.stats.gloam} gloam unravelled`, `${mins} min`]) { const sp: any = document.createElement('span'); sp.textContent = s; st.appendChild(sp); }
    $('endAgain').hidden = !hasFieldCheckpoint();
    $('endAgain').title = 'Go back to the edge of the Long Field and make the choice again';
    $('ending').hidden = false;
  },

  // ---- touch, debug ------------------------------------------------------------------------------------------
  joyShow(x: any, y: any) : any { const j: any = $('joy'); j.style.left = x + 'px'; j.style.top = y + 'px'; j.classList.add('on'); j.firstElementChild.style.transform = ''; },
  joyMove(dx: any, dy: any) : any { const l: any = Math.hypot(dx, dy), m: any = Math.min(l, 40) / (l || 1); $('joy').firstElementChild.style.transform = `translate(${dx * m}px, ${dy * m}px)`; },
  joyHide() : any { $('joy').classList.remove('on'); },
  toggleColliders() : any {
    if (!UI.colliderLines) {
      const pts: any = [], wp: any = [];
      const seg: any = (a: any, b: any, arr: any) => arr.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      for (const c of PHYS.cols) {
        if (c.y1 - c.y0 > 30 || Math.hypot(c.cx - player.x, c.cz - player.z) > 70) continue;
        if (c.t === 1) { for (let i: any = 0; i < 12; i++) { const a0: any = i / 12 * TAU, a1: any = (i + 1) / 12 * TAU; for (const y of [c.y0 + 0.02, Math.min(c.y1, c.y0 + 2.2)]) seg([c.cx + Math.cos(a0) * c.r, y, c.cz + Math.sin(a0) * c.r], [c.cx + Math.cos(a1) * c.r, y, c.cz + Math.sin(a1) * c.r], pts); } continue; }
        const corners: any = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]: any) => [c.cx + sx * c.hx * c.c - sz * c.hz * c.s, c.cz + sx * c.hx * c.s + sz * c.hz * c.c]);
        const y0: any = Math.max(c.y0, -0.2) + 0.02, y1: any = Math.min(c.y1, c.y0 + 3.2);
        for (let i: any = 0; i < 4; i++) { const a: any = corners[i], b: any = corners[(i + 1) % 4]; seg([a[0], y0, a[1]], [b[0], y0, b[1]], pts); seg([a[0], y1, a[1]], [b[0], y1, b[1]], pts); seg([a[0], y0, a[1]], [a[0], y1, a[1]], pts); }
      }
      const mk: any = (arr: any, c: any) => { const g: any = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); const l: any = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthTest: false })); l.renderOrder = 20; l.frustumCulled = false; scene.add(l); return l; };
      UI.colliderLines = [mk(pts, 0xff5a4a), mk(wp, 0x6ae0ff)];
      return true;
    }
    const on: any = !UI.colliderLines[0].visible;
    UI.colliderLines.forEach((l: any) => l.visible = on);
    return on;
  },
  buildPortraits() : any {
    const wrap: any = $('party');
    const mini: any = new THREE.Scene();
    mini.add(new THREE.HemisphereLight(0xfff0dc, 0x40342a, 1.6));
    const key: any = new THREE.DirectionalLight(0xffe2b8, 2.2); key.position.set(1.2, 1.6, 2); mini.add(key);
    const rt: any = new THREE.WebGLRenderTarget(256, 256);
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const cam: any = new THREE.PerspectiveCamera(24, 1, 0.05, 20);
    const buf: any = new Uint8Array(256 * 256 * 4);
    PARTY.forEach((c: any, i: any) => {
      const clone: any = c.root.clone(true);
      clone.position.set(0, 0, 0); clone.rotation.set(0, 0, 0);
      clone.traverse((o: any) => { if (o.material === blobMat) o.visible = false; });
      mini.add(clone);
      const hy: any = c.rig.headY - 0.12;
      cam.position.set(0.42, hy + 0.1, 1.05); cam.lookAt(0, hy - 0.07, 0);
      mini.background = new THREE.Color(0x2a231b);
      renderer.setRenderTarget(rt); renderer.render(mini, cam); renderer.readRenderTargetPixels(rt, 0, 0, 256, 256, buf); renderer.setRenderTarget(null);
      mini.remove(clone);
      const src: any = document.createElement('canvas'); src.width = src.height = 256;
      const sx: any = src.getContext('2d'), img: any = sx.createImageData(256, 256);
      for (let y: any = 0; y < 256; y++) img.data.set(buf.subarray((255 - y) * 1024, (256 - y) * 1024), y * 1024);
      sx.putImageData(img, 0, 0);
      const cv: any = document.createElement('canvas'); cv.width = cv.height = 116;
      cv.getContext('2d').drawImage(src, 0, 0, 116, 116);
      const el: any = document.createElement('button');
      el.className = 'member' + (i === 0 ? ' lead' : '');
      el.setAttribute('aria-label', i === 0 ? 'You' : 'Talk to ' + c.name);
      el.appendChild(cv);
      const s: any = document.createElement('span'); s.textContent = i === 0 ? 'You' : c.name; el.appendChild(s);
      if (i === 0) { const w: any = document.createElement('div'); w.className = 'warm'; w.title = 'Warmth: the cold of the gloam takes it, fire gives it back'; w.innerHTML = '<i></i>'; el.appendChild(w); UI.warmEl = w; }
      if (i > 0) el.addEventListener('click', () => { if (!DLG.active && !SCENE.active) startTalk(c); el.blur(); });
      wrap.appendChild(el);
    });
    rt.dispose();
  },

  // ---- per frame -------------------------------------------------------------------------------------------------
  update(dt: any, t: any) : any {
    const h: any = TIME.h, hh: any = Math.floor(h), mm: any = Math.floor((h - hh) * 60);
    $('clockTime').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const dayK: any = clamp((h - 5.6) / 13.3, 0, 1), night: any = h < 5.6 || h > 18.9;
    const a: any = night ? (((h < 12 ? h + 24 : h) - 18.9) / 10.7) : dayK;
    const dot: any = $('arcDot');
    dot.setAttribute('cx', (32 - Math.cos(a * PI) * 28).toFixed(1)); dot.setAttribute('cy', (28 - Math.sin(a * PI) * 24).toFixed(1));
    dot.setAttribute('fill', night ? '#c8d8ff' : '#f0a541');
    const dl: any = G.ending ? 'The morning after' : h < 5 || h > 23.5 ? 'Midnight' : night ? 'Harvest Night' : 'Harvest Eve';
    { const pw: any = $('party').children; for (let i: any = 1; i < PARTY.length && i < pw.length; i++) { const gone: any = !!PARTY[i].away; if (pw[i].hidden !== gone) pw[i].hidden = gone; } }
    if (UI._dl !== dl) { $('dayLabel').textContent = dl; UI._dl = dl; }
    const uz: any = UG.zone && UGZ[UG.zone];
    UI.regionT -= dt;
    if (UI.regionT <= 0 && !CAM.intro) {
      UI.regionT = 0.5;
      const rg: any = regionAt(player.x, player.z);
      if (rg && rg !== UI.region) { const prev: any = UI.region; UI.region = rg; if (prev && !CUT.b && !SCENE.active && !UI.areaIn) UI.showBanner(...REGION_NAMES[rg]); }
      const ar: any = UG.zone || EDIT.on ? null : AREAS.at(player.x, player.z);   // one of your own places
      if (ar !== UI.areaIn) { UI.areaIn = ar; if (ar && !CUT.b && !SCENE.active) UI.showBanner(ar.hdr.name, ar.hdr.title || 'a place of your own'); }
    }
    const rn: any = REGION_NAMES[UI.region || 'village'];
    const place: any = uz ? `<small>Underground · ${uz.sub}</small>${uz.name}` : CUT.b ? `<small>${escH(CUT.b.sub)} · ${CUT.b.floorNames[CUT.f]}</small>${escH(CUT.b.name)}`
      : UI.areaIn ? `<small>${escH(UI.areaIn.hdr.title || 'a place of your own')}</small>${escH(UI.areaIn.hdr.name)}` : `<small>${UI.region === 'village' ? 'Outdoors' : rn[1]}</small>${rn[0]}`;
    if (place !== UI.lastPlace) { $('place').innerHTML = place; UI.lastPlace = place; }
    if (UI.bannerT > 0) { UI.bannerT -= dt; if (UI.bannerT <= 0) $('banner').classList.remove('show'); }
    // the interaction prompt
    const pr: any = $('prompt'), it: any = INTERACT.cur;
    if (it && !DLG.active && !SCENE.active && !CAM.intro && !COMBAT.down) {
      pr.hidden = false;
      if (UI._pv !== it.verb) { $('promptVerb').textContent = it.verb; UI._pv = it.verb; }
      if (UI._pn !== it.name) { $('promptName').textContent = it.name; UI._pn = it.name; }
      if (UI._pt !== (it.title || '')) { $('promptTitle').textContent = it.title || ''; UI._pt = it.title || ''; }
    } else pr.hidden = true;
    // typewriter
    const ty: any = UI.dlgTyping;
    if (ty) { ty.acc += dt * 72; const n: any = Math.min(ty.text.length, Math.floor(ty.acc)); ty.el.textContent = ty.text.slice(0, n); if (n >= ty.text.length) UI.dlgTyping = null; }
    // toasts
    for (let i: any = UI.toasts.length - 1; i >= 0; i--) {
      const tt: any = UI.toasts[i]; tt.t -= dt;
      if (tt.t < 0.5 && !tt.out) { tt.out = true; tt.el.classList.add('out'); }
      if (tt.t <= 0) { tt.el.remove(); UI.toasts.splice(i, 1); }
    }
    // bubbles (projected above heads, nudged apart when they overlap)
    const r: any = renderer.domElement.getBoundingClientRect();
    UI.bubbles = UI.bubbles.filter((b: any) => {
      b.t -= dt;
      if (b.t <= 0 || !b.c.root.visible) { b.el.remove(); return false; }
      const p: any = b.c.head(_pv).add(UPV).project(camera);
      b.off = p.z > 1;
      b.sx = (p.x * 0.5 + 0.5) * r.width; b.sy = (-p.y * 0.5 + 0.5) * r.height - 4;
      b.w = b.el.offsetWidth || 160; b.h = b.el.offsetHeight || 30;
      return true;
    });
    const vis: any = UI.bubbles.filter((b: any) => !b.off).sort((a2: any, b: any) => b.sy - a2.sy);
    for (let i: any = 0; i < vis.length; i++) for (let j: any = 0; j < i; j++) {
      const a2: any = vis[i], o: any = vis[j];
      if (Math.abs(a2.sx - o.sx) < (a2.w + o.w) / 2 + 6 && a2.sy > o.sy - o.h - 8) a2.sy = o.sy - o.h - 8;
    }
    for (const b of UI.bubbles) {
      b.el.style.opacity = b.off || DLG.active ? 0 : (b.t < 0.4 ? b.t / 0.4 : 1);
      b.el.style.left = clamp(b.sx, b.w / 2 + 8, r.width - b.w / 2 - 8).toFixed(1) + 'px'; b.el.style.top = Math.max(b.sy, b.h + 8).toFixed(1) + 'px';
    }
    // the way to the objective: a small arrow beside the player
    const tg: any = UI.trackTarget(), pe: any = $('pointer');
    if (tg && !DLG.active && !SCENE.active && !!tg.ug === !!UG.zone && Math.hypot(tg.x - player.x, tg.z - player.z) > 9) {
      _pv.set(player.x, player.smoothY + 0.9, player.z).project(camera);
      const sx: any = (_pv.x * 0.5 + 0.5) * r.width, sy: any = (-_pv.y * 0.5 + 0.5) * r.height;
      _pv2.set(player.x + (tg.x - player.x) * 0.01, player.smoothY + 0.9, player.z + (tg.z - player.z) * 0.01).project(camera);
      const ex: any = (_pv2.x * 0.5 + 0.5) * r.width - sx, ey: any = (-_pv2.y * 0.5 + 0.5) * r.height - sy, ang: any = Math.atan2(ey, ex);
      pe.style.display = 'block';
      pe.style.left = (sx + Math.cos(ang) * 46).toFixed(1) + 'px'; pe.style.top = (sy + Math.sin(ang) * 46).toFixed(1) + 'px';
      pe.style.transform = `rotate(${ang.toFixed(3)}rad)`;
      $('trackDist').textContent = `${Math.round(Math.hypot(tg.x - player.x, tg.z - player.z))} m`;
    } else { pe.style.display = 'none'; $('trackDist').textContent = tg && !!tg.ug !== !!UG.zone ? (tg.ug ? 'below ground' : 'up on the surface') : ''; }
    // warmth & hurt
    if (UI.warmEl) {
      const k: any = (player.warmth ?? 10) / (player.warmthMax ?? 10);
      UI.warmEl.firstElementChild.style.width = (k * 100).toFixed(1) + '%';
      UI.warmEl.classList.toggle('cold', k < 0.4);
    }
    $('frost').style.opacity = clamp(COMBAT.hurtFx * 0.9 + (1 - (player.warmth ?? 10) / (player.warmthMax ?? 10)) * 0.55, 0, 1).toFixed(2);
    if (COMBAT.boss && COMBAT.boss.alive && Math.hypot(COMBAT.boss.x - player.x, COMBAT.boss.z - player.z) < 45) UI.boss(true, COMBAT.boss.hp / COMBAT.boss.hpMax); else if (!$('bossbar').hidden) UI.boss(false);
    UI.updateSpellbar();
    // idle party chatter
    UI.idle = (UI.idle || 0) + (player.speed < 0.2 && !DLG.active && !SCENE.active && !CAM.intro ? dt : -UI.idle);
    if (UI.idle > 16) { UI.idle = -22; const c: any = PARTY[1 + Math.floor(R() * 2)]; const pool: any = idleLines(c); if (pool.length) UI.bubble(c, pick(pool), 3.8); }
    UI.mapT = (UI.mapT || 0) - dt;
    if (UI.mapT <= 0 && !window.__hold) { UI.mapT = 1 / 20; UI.drawMap(); }
    if (!$('panel').hidden) UI.updateStats(dt);
  },
  updateStats(dt: any) : any {
    UI.statT = (UI.statT || 0) - dt;
    if (UI.statT > 0) return;
    UI.statT = 0.25;
    const info: any = renderer.info.render, lit: any = pool.filter((l: any) => l.intensity > 0.05).length;
    const zone: any = UG.zone ? `under: ${UG.zone}` : CUT.b ? `${CUT.b.id}/${CUT.f}` : 'outdoors';
    const rows: any = [
      ['frame', `${FPS.ms.toFixed(1)} ms · ${Math.round(1000 / FPS.ms)} fps`], ['resolution', `${renderer.getPixelRatio().toFixed(2)}× dpr`],
      ['draw calls', info.calls], ['triangles', (info.triangles / 1000).toFixed(0) + 'k'],
      ['point lights', `${lit} / ${pool.length} of ${emitters.length}`], ['zone', zone], ['main quest', q('main')],
      ['gloam', COMBAT.enemies.filter((e: any) => e.alive).length], ['particles', PS.n.n + PS.a.n], ['pos', `${player.x.toFixed(1)}, ${player.z.toFixed(1)}`],
    ];
    $('stats').innerHTML = rows.map(([k, v]: any) => `<span>${k}</span><span>${v}</span>`).join('');
  },
};
const _pv2: any = new V3();
function fixPartyY() : any { for (const c of PARTY) { c.y = groundAt(c.x, c.z, player.y + 0.5).h; c.smoothY = c.y; } CAM.tgt.y = player.y + 1; }

const BANTER: any = {
  inn: ['Ale! Finally, a building with priorities.', 'Woodsmoke, cider and stew. Even worried, this place is warm.'],
  smithy: ['Ahh. Proper heat. Smell that? Craftsmanship.', 'Too loud. Too hot. I will admire it from here.'],
  tower: ['Wizards. Never trust a man with more than three hats.', 'Orrin’s tower. It smells of ink and burnt sugar. Just as he… as I imagined.'],
  chapel: ['I’ll wait by the door. Quietly. Ish.', 'The glass sings when the light comes through.'],
  bakery: ['If anyone asks, I was never here and neither were these buns.', 'Oh. Cinnamon.'],
  store: ['Do they sell beard oil? Asking for me.', 'Moonpetal oil! …at those prices they can keep it.'],
  weaver: ['Cosy. Mind your head, tall folk.', 'Look at that loom. Such patience.'],
  fisher: ['Smells of river and old boots.', 'Nets, oars and a very stubborn stove.'],
  farm: ['Smells of apples and wet dog. Lovely.', 'A cold hearth in a farmhouse. That is the saddest thing I know.'],
  barn: ['Hay. Everywhere. In my beard, already.', 'Something small was hiding in here. Two somethings.'],
  hesk: ['Don’t touch the jars. Any of them. I mean it.', 'It smells like the fen, bottled.'],
  cellar: ['Now THIS is a cellar. I could live here.', 'Barrels, bottles… and is that wine rack hiding a door?'],
  tunnels: ['Mind your heads. Mine fits fine.', 'Smugglers’ tunnels. You can smell the brandy in the walls.'],
  den: ['Cards, coin and a warm mug. Someone left in a hurry.', '…or someone is still here.'],
  vault: ['Don’t touch the circle. Don’t touch anything.', 'The cradle is empty. You can feel where it was, like a missing tooth.'],
  cave: ['Shh! Troll. A big one. Nobody wake him.', 'The missing pumpkins… and the missing sheep.'],
  crypt: ['Dead people. Old dead people. I’ll be over here.', 'The founders. Every stone here is cold but one.'],
};
const IDLE_UG: any = {
  brakka: ['Proper stone overhead. Feels like home.', 'If that troll wakes up, I’m blaming the elf.', 'Smell that? Old brandy and older mud.', 'Tunnels! Now we’re talking.'],
  elowen: ['Walk softly. Some things down here are better left sleeping.', 'The way back up is behind us. I am only mentioning it.', 'Listen. Water, somewhere. And breathing.'],
};
function idleLines(c: any) : any {
  if (UG.zone) return IDLE_UG[c.id] || [];
  const m: any = q('main'), L: any = [];
  if (c.id === 'brakka') {
    L.push('Are we standing here for a reason?', 'My beard is getting cold.', 'I could eat a whole pumpkin. Raw.');
    if (G.flags.lantern && G.flame < 2) L.push('Your lantern’s low. Find a fire, there’s a good wick.');
    if (m >= 5 && !G.flags.axeKindled) L.push('Hilda said she’d put fire in my axe. I am thinking about it a great deal.');
    if (m >= 10) L.push('Tall, pale and full of secrets. I knew it. I said nothing, but I knew it.');
    if (G.sparks.length >= 3) L.push(`That’s ${G.sparks.length} sparks in your lantern now. You’re collecting friends like I collect splinters.`);
  } else if (c.id === 'elowen') {
    L.push('The cold is coming down off the mountain early tonight.', 'Your lantern burns cleaner than most. Interesting.');
    if (m < 3) L.push('Orrin’s wards are on every door of that tower. Old work. Kind work.');
    if (m >= 6 && m < 10) L.push('…Forgive me. I am only cold. I am always cold.');
    if (m >= 10) L.push('Thank you for still walking beside me.', 'The Wood is listening. It has been listening for three hundred years.');
    if (NIGHT > 0.6 && !G.spells.flare) L.push('After dark the gloam come. We will want more than candle-light.');
  }
  return L;
}
