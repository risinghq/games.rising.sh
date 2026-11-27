// ============================================================================
//  SOUND — everything is synthesised: a little generative music that follows
//  the place and the hour, the valley's ambience, and the game's effects.
// ============================================================================
const AUDIO: any = {
  ctx: null, on: false, vol: { master: 0.8, music: 0.55, sfx: 0.8, amb: 0.7 }, mute: false, mood: 'village', beat: 0, nextT: 0,
  init() : any {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC: any = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c: any = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.mute ? 0 : this.vol.master;
    const comp: any = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(comp); comp.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = this.vol.music * 0.42; this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = this.vol.sfx * 0.7; this.sfx.connect(this.master);
    this.amb = c.createGain(); this.amb.gain.value = this.vol.amb * 0.5; this.amb.connect(this.master);
    // a soft echo for the music and the magic
    this.echo = c.createDelay(1.2); this.echo.delayTime.value = 0.36;
    const fb: any = c.createGain(); fb.gain.value = 0.32; const ef: any = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 2200;
    this.echo.connect(ef); ef.connect(fb); fb.connect(this.echo);
    const ew: any = c.createGain(); ew.gain.value = 0.35; ef.connect(ew); ew.connect(this.master);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d: any = this.noiseBuf.getChannelData(0); for (let i: any = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // ambience beds: wind, water, an underground hum
    this.bed = {};
    for (const [k, type, f, q] of [['wind', 'bandpass', 520, 0.7], ['water', 'lowpass', 900, 0.4], ['deep', 'lowpass', 140, 1.2]]) {
      const src: any = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const fl: any = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g: any = c.createGain(); g.gain.value = 0;
      src.connect(fl); fl.connect(g); g.connect(this.amb); src.start();
      this.bed[k] = { g, fl };
    }
    this.on = true; this.nextT = c.currentTime + 0.3;
  },
  setVol(k: any, v: any) : any { this.vol[k] = v; if (!this.ctx) return; if (k === 'master') this.master.gain.value = this.mute ? 0 : v; if (k === 'music') this.music.gain.value = v * 0.42; if (k === 'sfx') this.sfx.gain.value = v * 0.7; if (k === 'amb') this.amb.gain.value = v * 0.5; },
  toggleMute() : any { this.mute = !this.mute; if (this.master) this.master.gain.setTargetAtTime(this.mute ? 0 : this.vol.master, this.ctx.currentTime, 0.05); return this.mute; },
  // ---- primitives
  tone(f: any, dur: any, o: any = {}) : any {
    if (!this.on) return;
    const c: any = this.ctx, t: any = (o.at ?? c.currentTime) + (o.delay || 0);
    if (!Number.isFinite(f) || !Number.isFinite(t) || !Number.isFinite(dur)) return;   // a bad note is silence, not a crash
    const osc: any = c.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f * o.slide), t + dur);
    const g: any = c.createGain(), a: any = o.a ?? 0.005, peak: any = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: any = osc;
    if (o.lp) { const fl: any = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; osc.connect(fl); node = fl; }
    node.connect(g); g.connect(o.bus || this.sfx);
    if (o.echo) g.connect(this.echo);
    osc.start(t); osc.stop(t + dur + 0.05);
  },
  noise(dur: any, o: any = {}) : any {
    if (!this.on) return;
    const c: any = this.ctx, t: any = (o.at ?? c.currentTime) + (o.delay || 0);
    const src: any = c.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = o.rate || 1;
    const fl: any = c.createBiquadFilter(); fl.type = o.ft || 'bandpass'; fl.frequency.setValueAtTime(o.f || 1200, t); fl.Q.value = o.q ?? 0.8;
    if (o.fTo) fl.frequency.exponentialRampToValueAtTime(o.fTo, t + dur);
    const g: any = c.createGain(), peak: any = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + (o.a ?? 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(o.bus || this.sfx);
    if (o.echo) g.connect(this.echo);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },
  // ---- effects
  blip(v: any = 2) : any { this.tone(300 + v * 46, 0.05, { type: 'triangle', vol: 0.035, lp: 1800 }); },
  click() : any { this.tone(880, 0.04, { type: 'triangle', vol: 0.06 }); },
  whoosh(kind: any) : any { this.noise(0.7, { f: 300, fTo: 2400, vol: 0.18, a: 0.05, q: 0.6 }); this.tone(kind === 'ghost' ? 523 : 392, 0.9, { type: 'sine', vol: 0.06, delay: 0.1, echo: true }); },
  draw() : any { for (let i: any = 0; i < 5; i++) this.tone(440 * Math.pow(1.122, i * 2), 0.35, { type: 'sine', vol: 0.05, delay: i * 0.12, echo: true }); this.noise(0.9, { f: 600, fTo: 3000, vol: 0.06, a: 0.2 }); },
  fizzle() : any { this.noise(0.25, { f: 2400, fTo: 300, vol: 0.08 }); },
  mend() : any { for (const [f, dl] of [[523, 0], [659, 0.08], [784, 0.16], [1046, 0.3]]) this.tone(f, 1.2, { type: 'sine', vol: 0.07, delay: dl, echo: true }); },
  flare() : any { this.noise(0.5, { f: 900, fTo: 4000, vol: 0.3, a: 0.01, q: 0.4 }); this.tone(110, 0.5, { type: 'sine', vol: 0.3, slide: 0.5 }); this.tone(880, 0.4, { type: 'triangle', vol: 0.05, delay: 0.02, echo: true }); },
  reveal() : any { for (let i: any = 0; i < 8; i++) this.tone(1200 + i * 180, 0.6, { type: 'sine', vol: 0.025, delay: i * 0.05, echo: true }); this.tone(330, 1.6, { type: 'sine', vol: 0.06, a: 0.3 }); },
  wisp() : any { this.tone(660, 0.8, { type: 'sine', vol: 0.06, slide: 2.2, echo: true }); this.tone(990, 0.6, { type: 'triangle', vol: 0.03, delay: 0.1, slide: 1.6, echo: true }); },
  chime(n: any = 3) : any { const sc: any = [523, 587, 659, 784, 880, 1046]; for (let i: any = 0; i < n; i++) this.tone(sc[i % sc.length], 0.9, { type: 'sine', vol: 0.06, delay: i * 0.09, echo: true }); },
  hurt() : any { this.tone(90, 0.3, { type: 'sine', vol: 0.25, slide: 0.6 }); this.noise(0.3, { f: 400, vol: 0.12, ft: 'lowpass' }); },
  gloamDie() : any { this.noise(0.9, { f: 2600, fTo: 200, vol: 0.12, q: 2 }); this.tone(330, 0.7, { type: 'sine', vol: 0.05, slide: 0.4 }); },
  burn() : any { for (let i: any = 0; i < 12; i++) this.noise(0.08, { f: rnd(800, 3000), vol: 0.1, delay: i * 0.07 }); this.noise(1.2, { f: 400, fTo: 1600, vol: 0.12, a: 0.2 }); },
  crash() : any { this.noise(1.0, { f: 300, fTo: 80, vol: 0.4, ft: 'lowpass', q: 0.5 }); for (let i: any = 0; i < 6; i++) this.noise(0.12, { f: rnd(500, 1500), vol: 0.15, delay: 0.1 + i * 0.09 }); },
  slam() : any { this.tone(55, 0.6, { type: 'sine', vol: 0.4, slide: 0.5 }); this.noise(0.4, { f: 200, vol: 0.2, ft: 'lowpass' }); },
  roar() : any { this.noise(1.6, { f: 160, fTo: 90, vol: 0.35, q: 3, a: 0.2 }); this.tone(70, 1.4, { type: 'sawtooth', vol: 0.06, lp: 300, slide: 0.7 }); },
  bossDie() : any { this.roar(); for (let i: any = 0; i < 6; i++) this.tone(262 * Math.pow(1.26, i), 1.6, { type: 'sine', vol: 0.06, delay: 0.8 + i * 0.15, echo: true }); },
  faint() : any { this.tone(220, 2.2, { type: 'sine', vol: 0.1, slide: 0.5, a: 0.4 }); },
  vision() : any { this.noise(2.0, { f: 300, fTo: 3000, vol: 0.08, a: 1.2, q: 3 }); for (let i: any = 0; i < 4; i++) this.tone(392 * Math.pow(1.5, i % 3), 2.5, { type: 'sine', vol: 0.035, delay: 0.3 + i * 0.4, echo: true }); },
  quest() : any { this.tone(587, 0.4, { type: 'triangle', vol: 0.07 }); this.tone(880, 0.7, { type: 'triangle', vol: 0.07, delay: 0.14, echo: true }); },
  spark() : any { for (const [f, d] of [[392, 0], [494, 0.1], [587, 0.2], [784, 0.32]]) this.tone(f, 1.0, { type: 'triangle', vol: 0.06, delay: d, echo: true }); },
  thud() : any { this.tone(120, 0.15, { type: 'sine', vol: 0.18, slide: 0.6 }); this.noise(0.1, { f: 900, vol: 0.06 }); },
  bolt() : any { this.tone(1400, 0.25, { type: 'sine', vol: 0.04, slide: 0.5 }); },
  bell(n: any = 3) : any { for (let i: any = 0; i < n; i++) { const d: any = i * 1.15; this.tone(196, 3.2, { type: 'sine', vol: 0.16, delay: d, a: 0.005, echo: true }); this.tone(196 * 2.76, 2.0, { type: 'sine', vol: 0.05, delay: d, echo: true }); this.tone(196 * 5.4, 1.0, { type: 'sine', vol: 0.025, delay: d }); } },
  dash() : any { this.noise(0.22, { f: 700, fTo: 2400, vol: 0.09, a: 0.01, q: 0.7 }); },
  step(surface: any) : any { this.noise(0.07, { f: surface === 'wood' ? 900 : surface === 'stone' ? 1800 : 500, vol: 0.035, ft: 'bandpass', q: 1.2 }); },
  // ---- music: a slow pluck melody over a pad, in a mode that suits where you are
  MOODS: {
    village: { root: 62, scale: [0, 2, 4, 7, 9], tempo: 84, pad: [0, 7, 16], density: 0.55, oct: 12 },
    night: { root: 57, scale: [0, 3, 5, 7, 10], tempo: 70, pad: [0, 7, 15], density: 0.4, oct: 12 },
    wild: { root: 55, scale: [0, 2, 3, 7, 9], tempo: 74, pad: [0, 7, 14], density: 0.42, oct: 12 },
    gloam: { root: 50, scale: [0, 1, 5, 6, 10], tempo: 58, pad: [0, 6, 13], density: 0.3, oct: 12 },
    under: { root: 45, scale: [0, 3, 5, 7, 8], tempo: 60, pad: [0, 7, 12], density: 0.28, oct: 12 },
    combat: { root: 52, scale: [0, 3, 5, 7, 10], tempo: 118, pad: [0, 7, 12], density: 0.75, oct: 12, drum: true },
    end: { root: 60, scale: [0, 2, 4, 7, 9], tempo: 76, pad: [0, 4, 7, 11], density: 0.6, oct: 12 },
    hush: { root: 50, scale: [0, 5, 7], tempo: 50, pad: [0, 7], density: 0.15, oct: 12 },
  },
  midi: (n: any) => 440 * Math.pow(2, (n - 69) / 12),
  update(dt: any) : any {
    if (!this.on) return;
    const c: any = this.ctx;
    // ambience follows the surroundings
    const ug: any = !!UG.zone, gl: any = wGloam(player.x, player.z), fen: any = wFen(player.x, player.z);
    const river: any = clamp(1 - (riverDist(player.x, player.z) - 6) / 18, 0, 1);
    const set: any = (b: any, v: any) => { if (Number.isFinite(v)) this.bed[b].g.gain.setTargetAtTime(v, c.currentTime, 0.6); };
    set('wind', ug ? 0.02 : (0.05 + 0.05 * Math.sin(performance.now() / 4300) + NIGHT * 0.03 + mountainH(player.x, player.z) * 0.006));
    set('water', ug ? 0 : Math.max(river * 0.12, fen * 0.07));
    set('deep', ug ? 0.22 : gl * 0.1);
    if (!ug && NIGHT > 0.55 && gl < 0.3 && R() < dt * 2.2) { const f: any = rnd(4200, 5200); for (let i: any = 0; i < 3; i++) this.tone(f, 0.04, { type: 'sine', vol: 0.012, delay: i * 0.06, bus: this.amb }); }
    if (ug && R() < dt * 0.5) this.tone(rnd(1800, 2600), 0.18, { type: 'sine', vol: 0.03, slide: 0.6, bus: this.amb, echo: true });
    // a fire nearby crackles
    let fd: any = 99; for (const f of KFIRES) if (f.lit) fd = Math.min(fd, Math.hypot(f.x - player.x, f.z - player.z));
    if (fd < 7 && R() < dt * 6 * (1 - fd / 7)) this.noise(0.05, { f: rnd(1500, 4000), vol: 0.05 * (1 - fd / 7), bus: this.amb });
    // pick the mood
    let mood: any = ug ? 'under' : gl > 0.5 ? 'gloam' : NIGHT > 0.5 ? 'night' : Math.hypot(player.x, player.z) > 70 ? 'wild' : 'village';
    if (COMBAT.enemies.some((e: any) => e.alive && Math.hypot(e.x - player.x, e.z - player.z) < 16)) mood = 'combat';
    if (this.forceMood) mood = this.forceMood;
    this.mood = mood;
    const M: any = this.MOODS[mood], spb: any = 60 / M.tempo / 2;
    while (this.nextT < c.currentTime + 0.25) {
      const t: any = this.nextT, b: any = this.beat++;
      if (b % 16 === 0) for (const iv of M.pad) this.tone(this.midi(M.root - 12 + iv + (b % 64 >= 32 && M.scale.length > 3 ? M.scale[3] - 7 : 0)), spb * 16, { type: 'sawtooth', vol: 0.022, a: 1.4, lp: 700, at: t, bus: this.music });
      if (b % 4 === 0) this.tone(this.midi(M.root - 24 + (b % 32 >= 16 ? M.scale[2] : 0)), spb * 3.5, { type: 'sine', vol: 0.07, a: 0.02, at: t, bus: this.music });
      if (R() < M.density * (b % 2 === 0 ? 1 : 0.5)) {
        this.walk = clamp((this.walk ?? 5) + pick([-2, -1, -1, 1, 1, 2, 0]), 0, M.scale.length * 2 - 1);
        const deg: any = this.walk, n: any = M.root + M.scale[deg % M.scale.length] + Math.floor(deg / M.scale.length) * 12;
        this.tone(this.midi(n), spb * 3, { type: 'triangle', vol: 0.05, a: 0.01, lp: 2400, at: t, bus: this.music, echo: true });
      }
      if (M.drum && b % 2 === 0) this.noise(0.08, { f: b % 4 === 0 ? 120 : 2000, vol: b % 4 === 0 ? 0.12 : 0.04, ft: b % 4 === 0 ? 'lowpass' : 'highpass', at: t, bus: this.music });
      this.nextT += spb;
    }
  },
};
