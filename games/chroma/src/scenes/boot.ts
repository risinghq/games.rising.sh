import Phaser from "phaser";
import { bakeArt } from "../art";
import { initAudio, SAMPLES } from "../audio";
import { profile } from "../profile";

export class Boot extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    const { width, height } = this.scale;
    const bar = this.add
      .rectangle(width / 2 - 200, height / 2, 0, 16, 0xffd23f)
      .setOrigin(0, 0.5);
    this.add
      .rectangle(width / 2, height / 2, 404, 20)
      .setStrokeStyle(2, 0xffffff);
    this.load.on("progress", (p: number) => (bar.width = 400 * p));

    for (const atlas of ["objects", "stall", "hud"]) {
      this.load.atlasXML(atlas, `atlas/${atlas}.png`, `atlas/${atlas}.xml`);
    }
    for (const sound of SAMPLES) this.load.audio(sound, `sfx/${sound}.ogg`);
  }

  create() {
    bakeArt(this);
    const { settings } = profile();
    initAudio(this, settings.music, settings.sfx);
    this.scene.start("menu");
  }
}
