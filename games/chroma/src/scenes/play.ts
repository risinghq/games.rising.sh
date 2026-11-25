import Phaser from "phaser";
import { DECOY_DUCK, DOT, duckKey, GOLD_DUCK, swatchKey } from "../art";
import { duckMusic, setIntensity, sfx, startMusic, stopMusic } from "../audio";
import { commitRun, profile } from "../profile";
import {
  basePoints,
  difficulty,
  MUD,
  multiplier,
  PAINTS,
  paintOf,
  resolveShot,
  START_LIVES,
  WAVE_HINTS,
  type DuckSpec,
} from "../rules";
import {
  FIRST_SPAWN_DELAY_MS,
  MAX_DUCKS,
  newSeed,
  nextSpawn,
  stream,
  type Spawn,
} from "../run";
import { accuracy } from "../save";
import {
  buildStage,
  DEPTH,
  DUCK_ORIGIN_Y,
  FONT,
  HEIGHT,
  LANE,
  SHADOW,
  WIDTH,
  type Stage,
} from "../stage";
import { button, formatNumber, panel, text } from "../ui";

const COUNTER_TOP = 640;

interface Duck {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  sign: Phaser.GameObjects.Text;
  spec: DuckSpec;
  lane: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
  state: "idle" | "swim" | "down" | "flee";
}

export class Play extends Phaser.Scene {
  private stage!: Stage;
  private ducks: Duck[] = [];
  private emitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private crosshair!: Phaser.GameObjects.Image;
  private swatches: Phaser.GameObjects.Image[] = [];
  private selector!: Phaser.GameObjects.Arc;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private hearts: Phaser.GameObjects.Image[] = [];
  private pauseLayer: Phaser.GameObjects.GameObject[] = [];

  private colorblind = false;
  private paint = 0;
  private lives = START_LIVES;
  private score = 0;
  private streak = 0;
  private bestStreak = 0;
  private shots = 0;
  private hits = 0;
  private mixes = 0;
  private ruins = 0;
  private painted: Record<string, number> = {};
  private elapsed = 0;
  private spawnTimer = 0;
  private spawnRng: () => number = () => 0;
  private wave = 1;
  private paused = false;
  private over = false;

  constructor() {
    super("play");
  }

  create() {
    this.colorblind = profile().settings.colorblind;
    this.ducks = [];
    this.swatches = [];
    this.hearts = [];
    this.pauseLayer = [];
    this.paint = 0;
    this.lives = START_LIVES;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.shots = 0;
    this.hits = 0;
    this.mixes = 0;
    this.ruins = 0;
    this.painted = {};
    this.elapsed = 0;
    this.spawnTimer = -FIRST_SPAWN_DELAY_MS;
    this.spawnRng = stream(newSeed(), "spawn");
    this.wave = 1;
    this.paused = false;
    this.over = false;

    this.stage = buildStage(this);
    this.emitter = this.add
      .particles(0, 0, DOT, {
        speed: { min: 120, max: 420 },
        scale: { start: 1, end: 0 },
        lifespan: 520,
        gravityY: 900,
        emitting: false,
      })
      .setDepth(DEPTH.paint);

    this.buildHud();
    this.bindInput();
    this.selectPaint(0);
    this.banner(1);
    setIntensity(1);
    duckMusic(false);
    startMusic();

    this.input.setDefaultCursor("none");
    const onBlur = () => this.setPaused(true);
    this.game.events.on(Phaser.Core.Events.BLUR, onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, onBlur);
      this.input.setDefaultCursor("default");
      duckMusic(false);
    });
  }

  private buildHud() {
    this.scoreText = text(this, 160, 40, "0", 34)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud);
    this.comboText = text(this, 160, 80, "", 24, "#ffd23f")
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud);
    this.waveText = text(this, WIDTH / 2, 40, "Oleada 1", 30).setDepth(
      DEPTH.hud,
    );
    for (let i = 0; i < START_LIVES; i++) {
      this.hearts.push(
        this.add
          .image(WIDTH - 170 - i * 46, 40, "hud", "icon_duck.png")
          .setScale(1.1)
          .setDepth(DEPTH.hud),
      );
    }

    this.add
      .graphics()
      .fillStyle(0x0b0d24, 0.55)
      .fillRoundedRect(162, 646, 6 * 92 + 24, 68, 34)
      .setDepth(DEPTH.tray);
    this.selector = this.add.circle(0, 680, 40, 0xfff1c9).setDepth(DEPTH.tray);
    PAINTS.forEach((paint, i) => {
      const x = 220 + i * 92;
      const swatch = this.add
        .image(x, 680, swatchKey(paint.mask, this.colorblind))
        .setScale(0.8)
        .setDepth(DEPTH.hud)
        .setInteractive({ useHandCursor: false });
      swatch.on("pointerdown", () => this.selectPaint(i));
      this.swatches.push(swatch);
      text(this, x + 26, 704, `${i + 1}`, 16).setDepth(DEPTH.hud);
    });

    this.crosshair = this.add
      .image(WIDTH / 2, HEIGHT / 2, "hud", "crosshair_white_large.png")
      .setDepth(DEPTH.crosshair);
  }

  private bindInput() {
    this.input.mouse?.disableContextMenu();
    this.input.on("pointermove", (p: Phaser.Input.Pointer) =>
      this.aim(p.x, p.y),
    );
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.paused || this.over) return;
      this.aim(p.x, p.y);
      if (p.rightButtonDown()) {
        this.cyclePaint(1);
        return;
      }
      if (p.y >= COUNTER_TOP) return;
      this.shoot(p.x, p.y);
    });
    this.input.on(
      "wheel",
      (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        if (!this.paused && !this.over) this.cyclePaint(Math.sign(dy));
      },
    );
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        if (!this.over) this.setPaused(!this.paused);
        return;
      }
      if (this.paused || this.over) return;
      const n = Number(e.key);
      if (n >= 1 && n <= PAINTS.length) this.selectPaint(n - 1);
      if (e.key === "q" || e.key === "Q") this.cyclePaint(-1);
      if (e.key === "e" || e.key === "E") this.cyclePaint(1);
    });
  }

  private aim(x: number, y: number) {
    this.crosshair.setPosition(x, y);
  }

  private selectPaint(index: number) {
    this.paint = index;
    const paint = PAINTS[index]!;
    this.crosshair.setTint(paint.hex);
    const swatch = this.swatches[index]!;
    this.selector.x = swatch.x;
    this.swatches.forEach((s, i) => s.setScale(i === index ? 0.95 : 0.8));
  }

  private cyclePaint(step: number) {
    if (step === 0) return;
    this.selectPaint((this.paint + step + PAINTS.length) % PAINTS.length);
  }

  private shoot(x: number, y: number) {
    const paint = PAINTS[this.paint]!;
    this.shots++;
    sfx.shoot();
    this.tweens.add({
      targets: this.crosshair,
      scale: 1.25,
      duration: 60,
      yoyo: true,
    });
    this.emitter.setParticleTint(paint.hex);

    const duck = this.hitTest(x, y);
    if (!duck) {
      this.emitter.explode(6, x, y);
      this.breakStreak();
      return;
    }
    this.emitter.explode(18, x, y);
    this.splash(x, y, paint.hex);

    const outcome = resolveShot(duck.spec, paint.mask);
    switch (outcome.kind) {
      case "hit":
      case "golden": {
        this.hits++;
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        const points = basePoints(duck.spec) * multiplier(this.streak);
        this.score += points;
        if (outcome.kind === "hit") {
          this.painted[duck.spec.mask] =
            (this.painted[duck.spec.mask] ?? 0) + 1;
        }
        if (outcome.kind === "golden") sfx.golden();
        else sfx.splat(this.streak);
        this.float(x, y - 30, `+${points}`, "#ffffff");
        this.knockDown(duck);
        break;
      }
      case "decoy":
        this.breakStreak();
        sfx.decoy();
        this.cameras.main.shake(180, 0.008);
        this.float(x, y - 30, "¡Señuelo!", "#ff6b6b");
        this.knockDown(duck);
        this.loseLife();
        break;
      case "mix": {
        this.breakStreak();
        this.mixes++;
        duck.spec = { kind: "color", mask: outcome.mask };
        duck.sign.setVisible(false);
        duck.sprite.setTexture(duckKey(outcome.mask, this.colorblind));
        duck.shadow.setTexture(duck.sprite.texture.key);
        this.tweens.add({
          targets: duck.sprite,
          scaleX: duck.sprite.scaleX * 1.2,
          duration: 80,
          yoyo: true,
        });
        const mixed = paintOf(outcome.mask)!;
        sfx.mix();
        this.float(
          x,
          y - 30,
          `¡Ahora es ${mixed.name.toLowerCase()}!`,
          hexString(mixed.hex),
        );
        break;
      }
      case "ruin":
        this.breakStreak();
        this.ruins++;
        duck.spec = { kind: "color", mask: MUD };
        duck.sign.setVisible(false);
        duck.sprite.setTexture(duckKey(MUD, this.colorblind));
        duck.shadow.setVisible(false);
        duck.state = "flee";
        sfx.ruin();
        this.float(x, y - 30, "¡Arruinado!", "#c8a27a");
        break;
      case "waste":
        this.breakStreak();
        this.float(x, y - 30, "Ya tiene ese color", "#ffffff");
        break;
    }
    this.refreshScore();
  }

  // Front lanes first: a nearer duck covers the ones behind it. The water strip
  // hides each duck's lower body, so a click on the water misses.
  private hitTest(x: number, y: number): Duck | undefined {
    for (let lane = this.stage.lanes.length - 1; lane >= 0; lane--) {
      const surface = this.stage.lanes[lane]!.surface;
      if (y > surface + 8) continue;
      for (const duck of this.ducks) {
        if (duck.state !== "swim" || duck.lane !== lane) continue;
        const s = duck.sprite;
        const halfW = s.displayWidth * 0.42;
        const top = s.y - s.displayHeight * DUCK_ORIGIN_Y;
        if (Math.abs(x - s.x) < halfW && y > top) return duck;
      }
    }
    return undefined;
  }

  // A blob of paint that bursts where the shot lands.
  private splash(x: number, y: number, hex: number) {
    const blob = this.add
      .image(x, y, DOT)
      .setTint(hex)
      .setScale(0.6)
      .setDepth(DEPTH.paint);
    this.tweens.add({
      targets: blob,
      scale: 4.5,
      alpha: 0,
      duration: 220,
      ease: "Quad.easeOut",
      onComplete: () => blob.destroy(),
    });
  }

  private breakStreak() {
    this.streak = 0;
  }

  private knockDown(duck: Duck) {
    duck.state = "down";
    duck.sign.setVisible(false);
    this.tweens.add({
      targets: [duck.sprite, duck.shadow],
      scaleY: 0,
      y: "+=24",
      duration: 180,
      ease: "Quad.easeIn",
      onComplete: () => this.retire(duck),
    });
  }

  private retire(duck: Duck) {
    duck.state = "idle";
    duck.sprite.setVisible(false);
    duck.shadow.setVisible(false);
    duck.sign.setVisible(false);
  }

  private loseLife() {
    this.lives--;
    this.hearts.forEach((h, i) => h.setAlpha(i < this.lives ? 1 : 0.25));
    if (this.lives <= 0) this.gameOver();
  }

  private refreshScore() {
    this.scoreText.setText(formatNumber(this.score));
    const m = multiplier(this.streak);
    this.comboText.setText(m > 1 ? `x${m}  racha ${this.streak}` : "");
  }

  private float(x: number, y: number, value: string, color: string) {
    const label = text(this, x, y, value, 26, color).setDepth(DEPTH.float);
    this.tweens.add({
      targets: label,
      y: y - 50,
      alpha: 0,
      duration: 800,
      ease: "Quad.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private banner(wave: number) {
    const title = text(this, WIDTH / 2, 250, `Oleada ${wave}`, 72)
      .setDepth(DEPTH.banner)
      .setAlpha(0);
    const items: Phaser.GameObjects.Text[] = [title];
    const hint = WAVE_HINTS[wave];
    if (hint)
      items.push(
        text(this, WIDTH / 2, 320, hint, 30, "#ffd23f")
          .setDepth(DEPTH.banner)
          .setAlpha(0),
      );
    this.tweens.add({
      targets: items,
      alpha: 1,
      duration: 250,
      hold: 1800,
      yoyo: true,
      onComplete: () => items.forEach((i) => i.destroy()),
    });
  }

  private spawn({ spec, lane: laneIndex, speed, phase }: Spawn) {
    let duck = this.ducks.find((d) => d.state === "idle");
    if (!duck) {
      if (this.ducks.length >= MAX_DUCKS) return;
      const sprite = this.add
        .image(0, 0, GOLD_DUCK)
        .setOrigin(0.5, DUCK_ORIGIN_Y);
      const shadow = this.add
        .image(0, 0, GOLD_DUCK)
        .setOrigin(0.5, DUCK_ORIGIN_Y)
        .setTint(SHADOW.color)
        .setTintMode(Phaser.TintModes.FILL)
        .setAlpha(SHADOW.alpha);
      const sign = this.add
        .text(0, 0, "", {
          fontFamily: FONT,
          fontSize: "20px",
          color: "#1d1d1d",
          backgroundColor: "#fff4e0",
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5, 1);
      duck = {
        sprite,
        shadow,
        sign,
        spec,
        lane: 0,
        dir: 1,
        speed: 0,
        phase: 0,
        state: "idle",
      };
      this.ducks.push(duck);
    }
    const lane = this.stage.lanes[laneIndex]!;
    duck.spec = spec;
    duck.lane = laneIndex;
    duck.dir = lane.dir;
    duck.speed = speed;
    duck.phase = phase;
    duck.state = "swim";
    const key =
      spec.kind === "golden"
        ? GOLD_DUCK
        : spec.kind === "decoy"
          ? DECOY_DUCK
          : duckKey(spec.mask, this.colorblind);
    duck.sprite
      .setTexture(key)
      .setVisible(true)
      .setScale(lane.scale)
      .setRotation(0)
      .setFlipX(lane.dir < 0)
      .setDepth(lane.depth + LANE.duck)
      .setPosition(lane.dir > 0 ? -80 : WIDTH + 80, lane.surface);
    duck.shadow
      .setTexture(key)
      .setVisible(true)
      .setScale(lane.scale)
      .setFlipX(lane.dir < 0)
      .setDepth(lane.depth + LANE.duckShadow);
    const word = spec.word === undefined ? undefined : paintOf(spec.word);
    duck.sign.setVisible(word !== undefined).setDepth(lane.depth + LANE.sign);
    if (word) duck.sign.setText(word.name.toUpperCase());
  }

  private gameOver() {
    this.over = true;
    const previousBest = profile().stats.bestScore;
    commitRun({
      score: this.score,
      shots: this.shots,
      hits: this.hits,
      bestStreak: this.bestStreak,
      wave: this.wave,
      mixes: this.mixes,
      ruins: this.ruins,
      playMs: Math.round(this.elapsed * 1000),
      painted: this.painted,
    });
    stopMusic();
    sfx.gameOver();
    this.input.setDefaultCursor("default");
    this.crosshair.setVisible(false);

    panel(this, 640, 500);
    text(this, WIDTH / 2, 170, "Fin del juego", 52).setDepth(
      DEPTH.panelContent,
    );
    const record = this.score > previousBest && this.score > 0;
    text(
      this,
      WIDTH / 2,
      240,
      formatNumber(this.score),
      64,
      record ? "#ffd23f" : "#ffffff",
    ).setDepth(DEPTH.panelContent);
    if (record) {
      text(this, WIDTH / 2, 295, "¡Nuevo récord!", 28, "#ffd23f").setDepth(
        DEPTH.panelContent,
      );
      sfx.record();
    }
    const lines = [
      `Precisión: ${accuracy(this.shots, this.hits)} %`,
      `Mejor racha: ${this.bestStreak}`,
      `Oleada: ${this.wave}`,
    ];
    lines.forEach((line, i) =>
      text(this, WIDTH / 2, 345 + i * 36, line, 26).setDepth(
        DEPTH.panelContent,
      ),
    );
    button(
      this,
      WIDTH / 2 - 150,
      520,
      "Otra vez",
      () => this.scene.restart(),
      260,
    );
    button(
      this,
      WIDTH / 2 + 150,
      520,
      "Menú",
      () => this.scene.start("menu"),
      260,
    );
  }

  private setPaused(paused: boolean) {
    if (this.over || paused === this.paused) return;
    this.paused = paused;
    duckMusic(paused);
    if (paused) {
      this.tweens.pauseAll();
      this.input.setDefaultCursor("default");
      this.crosshair.setVisible(false);
      this.pauseLayer = [
        panel(this, 520, 340),
        text(this, WIDTH / 2, 260, "Pausa", 56).setDepth(DEPTH.panelContent),
        button(this, WIDTH / 2, 350, "Continuar", () => this.setPaused(false)),
        button(this, WIDTH / 2, 430, "Salir al menú", () =>
          this.scene.start("menu"),
        ),
      ];
    } else {
      this.tweens.resumeAll();
      this.input.setDefaultCursor("none");
      this.crosshair.setVisible(true);
      this.pauseLayer.forEach((o) => o.destroy());
      this.pauseLayer = [];
    }
  }

  update(_time: number, delta: number) {
    if (this.paused || this.over) return;
    // A long frame (tab switch, GC pause) must not teleport ducks off screen.
    const dt = Math.min(delta, 50) / 1000;
    this.elapsed += dt;
    this.stage.update(dt);

    const d = difficulty(this.elapsed);
    if (d.wave !== this.wave) {
      this.wave = d.wave;
      this.waveText.setText(`Oleada ${d.wave}`);
      setIntensity(d.wave);
      sfx.wave();
      this.banner(d.wave);
    }

    this.spawnTimer += dt * 1000;
    if (this.spawnTimer >= d.spawnMs) {
      this.spawnTimer = 0;
      this.spawn(nextSpawn(d, this.spawnRng));
    }

    for (const duck of this.ducks) {
      if (duck.state === "swim") this.swim(duck, dt);
      else if (duck.state === "flee") this.flee(duck, dt);
      if (this.over) return;
    }
  }

  private swim(duck: Duck, dt: number) {
    const s = duck.sprite;
    const lane = this.stage.lanes[duck.lane]!;
    s.x += duck.dir * duck.speed * dt;
    s.y = lane.surface + Math.sin(this.elapsed * 5 + duck.phase) * 4;
    duck.shadow.setPosition(s.x + SHADOW.dx, s.y + SHADOW.dy);
    if (duck.sign.visible)
      duck.sign.setPosition(s.x, s.y - s.displayHeight * DUCK_ORIGIN_Y - 2);
    const gone = duck.dir > 0 ? s.x > WIDTH + 80 : s.x < -80;
    if (!gone) return;
    this.retire(duck);
    if (duck.spec.kind !== "color") return;
    this.breakStreak();
    this.refreshScore();
    sfx.escape();
    this.float(
      duck.dir > 0 ? WIDTH - 200 : 200,
      lane.surface - 60,
      "¡Se escapó!",
      "#ff6b6b",
    );
    this.loseLife();
  }

  private flee(duck: Duck, dt: number) {
    const s = duck.sprite;
    s.x += duck.dir * duck.speed * 1.5 * dt;
    s.y -= 320 * dt;
    s.rotation += duck.dir * 3 * dt;
    if (s.y < -120) this.retire(duck);
  }
}

function hexString(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}
