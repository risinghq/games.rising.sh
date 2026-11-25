import Phaser from "phaser";
import { sfx } from "./audio";
import { DEPTH, FONT } from "./stage";

const BUTTON = 0x8a4b2a;
const BUTTON_HOVER = 0xa8613a;

export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number,
  color = "#ffffff",
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, value, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color,
      stroke: "#1d1d1d",
      strokeThickness: Math.max(3, Math.round(size / 7)),
      align: "center",
    })
    .setOrigin(0.5);
}

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 340,
): Phaser.GameObjects.Container {
  const height = 64;
  const bg = scene.add.graphics();
  const draw = (fill: number) => {
    bg.clear();
    bg.fillStyle(0x1d1d1d, 0.35).fillRoundedRect(
      -width / 2 + 4,
      -height / 2 + 6,
      width,
      height,
      16,
    );
    bg.fillStyle(fill).fillRoundedRect(
      -width / 2,
      -height / 2,
      width,
      height,
      16,
    );
    bg.lineStyle(4, 0x1d1d1d).strokeRoundedRect(
      -width / 2,
      -height / 2,
      width,
      height,
      16,
    );
  };
  // Varnished wood, not a paint colour, so a button never reads as a target.
  draw(BUTTON);
  const caption = text(scene, 0, 0, label, 28);
  const box = scene.add
    .container(x, y, [bg, caption])
    .setSize(width, height)
    .setDepth(DEPTH.button);
  box.setInteractive({ useHandCursor: true });
  box.on("pointerover", () => draw(BUTTON_HOVER));
  box.on("pointerout", () => draw(BUTTON));
  box.on("pointerup", () => {
    sfx.click();
    onClick();
  });
  box.setData("caption", caption);
  return box;
}

export function setButtonLabel(
  box: Phaser.GameObjects.Container,
  label: string,
): void {
  (box.getData("caption") as Phaser.GameObjects.Text).setText(label);
}

export function panel(
  scene: Phaser.Scene,
  width: number,
  height: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(DEPTH.panel);
  g.fillStyle(0x000000, 0.45).fillRect(
    0,
    0,
    scene.scale.width,
    scene.scale.height,
  );
  const x = (scene.scale.width - width) / 2;
  const y = (scene.scale.height - height) / 2;
  g.fillStyle(0xfff4e0).fillRoundedRect(x, y, width, height, 24);
  g.lineStyle(6, 0x1d1d1d).strokeRoundedRect(x, y, width, height, 24);
  return g;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("es-PE");
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
