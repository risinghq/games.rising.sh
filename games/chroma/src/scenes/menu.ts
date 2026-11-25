import Phaser from "phaser";
import { duckKey } from "../art";
import {
  setIntensity,
  setMusicEnabled,
  setSfxEnabled,
  startMusic,
} from "../audio";
import { profile, updateSettings } from "../profile";
import { PAINTS } from "../rules";
import {
  buildStage,
  castShadow,
  DEPTH,
  DUCK_ORIGIN_Y,
  LANE,
  WIDTH,
  type Stage,
} from "../stage";
import { button, formatNumber, setButtonLabel, text } from "../ui";

const onOff = (on: boolean) => (on ? "Sí" : "No");

export class Menu extends Phaser.Scene {
  private stage!: Stage;

  constructor() {
    super("menu");
  }

  create() {
    this.stage = buildStage(this);
    this.parade();
    setIntensity(1);
    startMusic();

    const title = "CHROMA";
    const letters = [...title];
    letters.forEach((letter, i) => {
      const hex = PAINTS[i % PAINTS.length]!.hex.toString(16).padStart(6, "0");
      const x = WIDTH / 2 + (i - (letters.length - 1) / 2) * 92;
      const glyph = text(this, x, 150, letter, 110, `#${hex}`).setDepth(
        DEPTH.banner,
      );
      this.tweens.add({
        targets: glyph,
        y: 140,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: i * 120,
      });
    });
    text(this, WIDTH / 2, 235, "Pinta cada pato con su color", 30).setDepth(
      DEPTH.banner,
    );

    const { settings, stats } = profile();
    if (stats.bestScore > 0) {
      text(
        this,
        WIDTH / 2,
        280,
        `Récord: ${formatNumber(stats.bestScore)}`,
        24,
        "#ffd23f",
      ).setDepth(DEPTH.banner);
    }

    button(this, WIDTH / 2, 350, "Jugar", () => this.scene.start("play"));
    button(this, WIDTH / 2, 430, "Estadísticas", () =>
      this.scene.start("stats"),
    );
    const music = button(
      this,
      WIDTH / 2 - 215,
      510,
      `Música: ${onOff(settings.music)}`,
      () => {
        const next = updateSettings({ music: !profile().settings.music });
        setMusicEnabled(next.settings.music);
        setButtonLabel(music, `Música: ${onOff(next.settings.music)}`);
      },
      410,
    );
    const effects = button(
      this,
      WIDTH / 2 + 215,
      510,
      `Efectos: ${onOff(settings.sfx)}`,
      () => {
        const next = updateSettings({ sfx: !profile().settings.sfx });
        setSfxEnabled(next.settings.sfx);
        setButtonLabel(effects, `Efectos: ${onOff(next.settings.sfx)}`);
      },
      410,
    );
    const cb = button(
      this,
      WIDTH / 2,
      590,
      `Modo daltónico: ${onOff(settings.colorblind)}`,
      () => {
        const next = updateSettings({
          colorblind: !profile().settings.colorblind,
        });
        setButtonLabel(
          cb,
          `Modo daltónico: ${onOff(next.settings.colorblind)}`,
        );
      },
      410,
    );

    text(
      this,
      WIDTH / 2,
      680,
      "Ratón: apuntar y disparar · 1 a 6, rueda o clic derecho: cambiar pintura · Esc: pausa",
      18,
    ).setDepth(DEPTH.banner);
  }

  // A few ducks drift across the lanes behind the menu.
  private parade() {
    this.stage.lanes.forEach((lane, k) => {
      for (let i = 0; i < 3; i++) {
        const paint = PAINTS[(k * 3 + i) % PAINTS.length]!;
        const startX = lane.dir > 0 ? -100 - i * 420 : WIDTH + 100 + i * 420;
        const duck = this.add
          .image(startX, lane.surface, duckKey(paint.mask, false))
          .setOrigin(0.5, DUCK_ORIGIN_Y)
          .setScale(lane.scale)
          .setFlipX(lane.dir < 0)
          .setDepth(lane.depth + LANE.duck);
        const shadow = castShadow(this, duck, lane.depth + LANE.duckShadow);
        const span = WIDTH + 200 + 2 * 420;
        this.tweens.add({
          targets: [duck, shadow],
          x: `+=${lane.dir * span}`,
          duration: (span / (60 * lane.speed)) * 1000,
          repeat: -1,
        });
      }
    });
  }

  update(_time: number, delta: number) {
    this.stage.update(delta / 1000);
  }
}
