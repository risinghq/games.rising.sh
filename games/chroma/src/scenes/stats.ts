import Phaser from "phaser";
import { swatchKey } from "../art";
import { profile, resetStats } from "../profile";
import { PAINTS } from "../rules";
import { accuracy } from "../save";
import { buildStage, DEPTH, FONT, WIDTH } from "../stage";
import {
  button,
  formatDuration,
  formatNumber,
  panel,
  setButtonLabel,
  text,
} from "../ui";

export class Stats extends Phaser.Scene {
  constructor() {
    super("stats");
  }

  create() {
    buildStage(this);
    panel(this, 900, 600);
    this.render();
  }

  private render() {
    const { stats, settings } = profile();
    const dark = "#3a2a1a";
    const rows: [string, string][] = [
      ["Partidas", formatNumber(stats.runs)],
      ["Récord", formatNumber(stats.bestScore)],
      ["Precisión", `${accuracy(stats.shots, stats.hits)} %`],
      ["Mejor racha", formatNumber(stats.bestStreak)],
      ["Oleada máxima", formatNumber(stats.bestWave)],
      ["Disparos", formatNumber(stats.shots)],
      ["Mezclas", formatNumber(stats.mixes)],
      ["Patos arruinados", formatNumber(stats.ruins)],
      ["Tiempo jugado", formatDuration(stats.playMs)],
    ];

    text(this, WIDTH / 2, 110, "Estadísticas", 44).setDepth(DEPTH.panelContent);
    rows.forEach(([label, value], i) => {
      const y = 175 + i * 38;
      this.add
        .text(260, y, label, {
          fontFamily: FONT,
          fontSize: "24px",
          color: dark,
        })
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.panelContent);
      this.add
        .text(640, y, value, {
          fontFamily: FONT,
          fontSize: "24px",
          color: dark,
        })
        .setOrigin(1, 0.5)
        .setDepth(DEPTH.panelContent);
    });

    this.add
      .text(860, 175, "Patos pintados", {
        fontFamily: FONT,
        fontSize: "24px",
        color: dark,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.panelContent);
    PAINTS.forEach((paint, i) => {
      const y = 225 + i * 52;
      this.add
        .image(790, y, swatchKey(paint.mask, settings.colorblind))
        .setScale(0.6)
        .setDepth(DEPTH.panelContent);
      this.add
        .text(
          830,
          y,
          `${paint.name}: ${formatNumber(stats.painted[paint.mask] ?? 0)}`,
          {
            fontFamily: FONT,
            fontSize: "22px",
            color: dark,
          },
        )
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.panelContent);
    });

    button(
      this,
      WIDTH / 2 - 190,
      600,
      "Volver",
      () => this.scene.start("menu"),
      320,
    );
    let armed = false;
    const reset = button(
      this,
      WIDTH / 2 + 190,
      600,
      "Borrar datos",
      () => {
        if (!armed) {
          armed = true;
          setButtonLabel(reset, "¿Seguro?");
          return;
        }
        resetStats();
        this.scene.restart();
      },
      320,
    );
  }
}
