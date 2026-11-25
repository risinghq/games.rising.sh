import Phaser from "phaser";
import { BLUE, GOLD_HEX, MUD, MUD_HEX, PAINTS, RED, YELLOW } from "./rules";

// Colour textures are baked once at boot from the pack's yellow duck, so play
// never recolours a sprite and every colour keeps the original shading.

export function duckKey(mask: number, colorblind: boolean): string {
  return `duck-${mask}${colorblind ? "-cb" : ""}`;
}
export const GOLD_DUCK = "duck-gold";
export const DECOY_DUCK = "duck-decoy";

export function swatchKey(mask: number, colorblind: boolean): string {
  return `swatch-${mask}${colorblind ? "-cb" : ""}`;
}
export const DOT = "dot";

const SOURCE = "duck_outline_yellow.png";
// The pack's pale grey-blue duck reads as unpainted metal: the decoy.
const DECOY_SOURCE = "duck_outline_white.png";

function rgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

// Repaints the yellow body and keeps its light and shade: value carries the
// shading, saturation decides how much of the new colour shows in highlights.
function recolor(data: Uint8ClampedArray, hex: number): void {
  const [tr, tg, tb] = rgb(hex);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === 0 || max === min) continue;
    const s = (max - min) / max;
    if (s < 0.3) continue;
    let h = 0;
    if (max === r) h = 60 * (((g - b) / (max - min)) % 6);
    else if (max === g) h = 60 * ((b - r) / (max - min) + 2);
    else h = 60 * ((r - g) / (max - min) + 4);
    if (h < 0) h += 360;
    if (h < 38 || h > 65) continue;
    const v = max / 255;
    data[i] = v * (tr * s + 255 * (1 - s));
    data[i + 1] = v * (tg * s + 255 * (1 - s));
    data[i + 2] = v * (tb * s + 255 * (1 - s));
  }
}

type Shape = "triangle" | "circle" | "square" | "cross";

function shapesFor(mask: number): Shape[] {
  if (mask === MUD) return ["cross"];
  const shapes: Shape[] = [];
  if (mask & RED) shapes.push("triangle");
  if (mask & YELLOW) shapes.push("circle");
  if (mask & BLUE) shapes.push("square");
  return shapes;
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  x: number,
  y: number,
  r: number,
) {
  ctx.beginPath();
  if (shape === "circle") ctx.arc(x, y, r, 0, Math.PI * 2);
  if (shape === "square")
    ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  if (shape === "triangle") {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y + r * 0.8);
    ctx.lineTo(x - r, y + r * 0.8);
    ctx.closePath();
  }
  if (shape === "cross") {
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.lineWidth = r * 0.6;
    ctx.strokeStyle = "#1d1d1d";
    ctx.stroke();
    return;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.35);
  ctx.strokeStyle = "#1d1d1d";
  ctx.stroke();
}

// Each primary has a shape and a mix shows the shapes of its parts, so the
// colorblind marks also teach the mixing rule.
function drawSymbols(
  ctx: CanvasRenderingContext2D,
  mask: number,
  x: number,
  y: number,
  r: number,
) {
  const shapes = shapesFor(mask);
  const gap = r * 2.3;
  const start = x - ((shapes.length - 1) * gap) / 2;
  shapes.forEach((shape, i) => drawShape(ctx, shape, start + i * gap, y, r));
}

function bakeDuck(
  scene: Phaser.Scene,
  key: string,
  hex: number | null,
  mask: number,
) {
  const decoy = hex === null;
  const source = scene.textures.getFrame(
    "objects",
    decoy ? DECOY_SOURCE : SOURCE,
  );
  const w = source.cutWidth;
  const h = source.cutHeight;
  const tex = scene.textures.createCanvas(key, w, h)!;
  const ctx = tex.context;
  ctx.drawImage(
    source.source.image as CanvasImageSource,
    source.cutX,
    source.cutY,
    w,
    h,
    0,
    0,
    w,
    h,
  );
  if (!decoy) {
    const img = ctx.getImageData(0, 0, w, h);
    recolor(img.data, hex);
    ctx.putImageData(img, 0, 0);
  }
  if (mask > 0) drawSymbols(ctx, mask, w * 0.42, h * 0.6, 9);
  tex.refresh();
}

function bakeSwatch(
  scene: Phaser.Scene,
  key: string,
  hex: number,
  mask: number,
) {
  const size = 72;
  const tex = scene.textures.createCanvas(key, size, size)!;
  const ctx = tex.context;
  const [r, g, b] = rgb(hex);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  if (mask > 0) drawSymbols(ctx, mask, size / 2, size / 2, 10);
  tex.refresh();
}

export function bakeArt(scene: Phaser.Scene): void {
  for (const paint of PAINTS) {
    bakeDuck(scene, duckKey(paint.mask, false), paint.hex, 0);
    bakeDuck(scene, duckKey(paint.mask, true), paint.hex, paint.mask);
    bakeSwatch(scene, swatchKey(paint.mask, false), paint.hex, 0);
    bakeSwatch(scene, swatchKey(paint.mask, true), paint.hex, paint.mask);
  }
  bakeDuck(scene, duckKey(MUD, false), MUD_HEX, 0);
  bakeDuck(scene, duckKey(MUD, true), MUD_HEX, MUD);
  bakeDuck(scene, GOLD_DUCK, GOLD_HEX, 0);
  bakeDuck(scene, DECOY_DUCK, null, 0);

  const dot = scene.make.graphics({}, false);
  dot.fillStyle(0xffffff).fillCircle(8, 8, 8);
  dot.generateTexture(DOT, 16, 16);
  dot.destroy();
}
