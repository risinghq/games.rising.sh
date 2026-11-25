import Phaser from "phaser";
import { Boot } from "./scenes/boot";
import { Menu } from "./scenes/menu";
import { Play } from "./scenes/play";
import { Stats } from "./scenes/stats";
import { HEIGHT, WIDTH } from "./stage";

// Phaser measures text when it is created, so the font must be ready first.
await document.fonts.load('32px "Kenney Future"').catch(() => undefined);

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "#1a1d3a",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { powerPreference: "high-performance" },
  scene: [Boot, Menu, Play, Stats],
});
