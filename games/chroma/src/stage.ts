import Phaser from "phaser";
import { HEIGHT, LANES, SURFACE_OFFSET, WIDTH } from "./run";

export { HEIGHT, WIDTH };
// Ducks hang from this point at the water line; the rest sits below the strip.
export const DUCK_ORIGIN_Y = 0.9;
export const FONT = '"Kenney Future", "Trebuchet MS", sans-serif';

// Draw order from the back of the booth to the player. Lane k's layers sit at
// laneDepth(k) + offset: its ducks' shadows on the strip behind, the ducks, then
// the strip, whose texture carries its own shadow onto those ducks.
export const DEPTH = {
  backdrop: 0,
  clouds: 1,
  counter: 20,
  curtains: 21,
  bulbs: 22,
  paint: 40,
  tray: 48,
  hud: 50,
  crosshair: 60,
  float: 65,
  banner: 70,
  panel: 90,
  panelContent: 95,
  button: 100,
} as const;
export const LANE = { duckShadow: 0, duck: 1, sign: 1.2, strip: 2 } as const;
const laneDepth = (k: number) => 10 + 3 * k;

// One warm lamp hangs above the counter, in front and to the left, so every
// cut-out casts its shadow down and to the right onto whatever stands behind it.
export const SHADOW = { color: 0x0b0d24, alpha: 0.45, dx: 9, dy: 7 } as const;
const SHADOW_CSS = `rgba(11,13,36,${SHADOW.alpha})`;

export interface Lane {
  // Water line the duck sits in; anything below it is hidden by the strip.
  surface: number;
  scale: number;
  dir: 1 | -1;
  speed: number;
  depth: number;
}

export interface Stage {
  lanes: Lane[];
  update(dt: number): void;
}

// A colour grade: keep `sat` of the saturation, then multiply by the light that
// reaches the layer. Far layers are greyer, darker and bluer, so the paint
// colours of the ducks stay the brightest thing on screen.
interface Grade {
  sat: number;
  light: [number, number, number];
}

const GRADES = {
  backdrop: { sat: 0.3, light: [0.4, 0.42, 0.62] },
  cloud: { sat: 0.2, light: [0.8, 0.76, 0.82] },
  tree: { sat: 0.4, light: [0.38, 0.5, 0.56] },
  lane0: { sat: 0.4, light: [0.46, 0.56, 0.52] },
  lane1: { sat: 0.32, light: [0.36, 0.5, 0.58] },
  lane2: { sat: 0.36, light: [0.42, 0.58, 0.66] },
  counter: { sat: 0.75, light: [0.72, 0.56, 0.46] },
  curtain: { sat: 1, light: [0.56, 0.13, 0.2] },
} satisfies Record<string, Grade>;

// One strip per lane in LANES, in the same order.
const STRIPS: { frame: string; scale: number; grade: Grade }[] = [
  { frame: "grass1.png", scale: 0.72, grade: GRADES.lane0 },
  { frame: "water1.png", scale: 0.88, grade: GRADES.lane1 },
  { frame: "water2.png", scale: 1.04, grade: GRADES.lane2 },
];

const TREES: [string, number, number][] = [
  ["tree_oak.png", 150, 0.9],
  ["tree_pine.png", 330, 0.8],
  ["tree_oak.png", 900, 0.75],
  ["tree_pine.png", 1080, 0.95],
  ["tree_pine.png", 620, 0.7],
];

// Every layer is composited once into a canvas texture: grade, shading and
// shadow included. Play then draws a handful of large images instead of
// stacking overlays, which keeps fill rate low on weak school GPUs.

function newCanvas(
  w: number,
  h: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext("2d", { willReadFrequently: true })!];
}

function grade(ctx: CanvasRenderingContext2D, g: Grade): void {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  const [lr, lg, lb] = g.light;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i]!;
    const gr = d[i + 1]!;
    const b = d[i + 2]!;
    const l = 0.3 * r + 0.59 * gr + 0.11 * b;
    d[i] = (l + (r - l) * g.sat) * lr;
    d[i + 1] = (l + (gr - l) * g.sat) * lg;
    d[i + 2] = (l + (b - l) * g.sat) * lb;
  }
  ctx.putImageData(img, 0, 0);
}

// An atlas frame, tiled to `w` by `h` when given, then graded. Tiling into a
// canvas avoids the seam a TileSprite over an atlas frame shows at each repeat.
function framed(
  scene: Phaser.Scene,
  frameName: string,
  g: Grade,
  w?: number,
  h?: number,
) {
  const frame = scene.textures.getFrame("stall", frameName);
  const [canvas, ctx] = newCanvas(w ?? frame.cutWidth, h ?? frame.cutHeight);
  const image = frame.source.image as CanvasImageSource;
  for (let y = 0; y < canvas.height; y += frame.cutHeight) {
    for (let x = 0; x < canvas.width; x += frame.cutWidth) {
      ctx.drawImage(
        image,
        frame.cutX,
        frame.cutY,
        frame.cutWidth,
        frame.cutHeight,
        x,
        y,
        frame.cutWidth,
        frame.cutHeight,
      );
    }
  }
  grade(ctx, g);
  return canvas;
}

// Darkens the drawn pixels from `top` to `bottom` alpha: the lamp is above, so
// each layer is brighter at its top edge.
function topLit(
  ctx: CanvasRenderingContext2D,
  top: number,
  bottom: number,
): void {
  const { width, height } = ctx.canvas;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, `rgba(8,8,24,${top})`);
  gradient.addColorStop(1, `rgba(8,8,24,${bottom})`);
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// Darkens the drawn pixels towards the screen's side edges, where the lamp
// reaches least. `left` is the screen x of the canvas's left edge.
function sideFalloff(ctx: CanvasRenderingContext2D, left: number): void {
  const { width, height } = ctx.canvas;
  const gradient = ctx.createLinearGradient(-left, 0, WIDTH - left, 0);
  gradient.addColorStop(0, "rgba(8,8,24,0.55)");
  gradient.addColorStop(0.25, "rgba(8,8,24,0)");
  gradient.addColorStop(0.75, "rgba(8,8,24,0)");
  gradient.addColorStop(1, "rgba(8,8,24,0.55)");
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// Draws a cut-out with its flat shadow, offset away from the lamp by `reach`.
function withShadow(
  ctx: CanvasRenderingContext2D,
  reach: number,
  draw: () => void,
): void {
  ctx.save();
  ctx.shadowColor = SHADOW_CSS;
  ctx.shadowOffsetX = SHADOW.dx * reach;
  ctx.shadowOffsetY = SHADOW.dy * reach;
  draw();
  ctx.restore();
}

function texture(
  scene: Phaser.Scene,
  key: string,
  build: () => HTMLCanvasElement,
): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, build());
  return key;
}

// The back wall: striped backdrop, the lamp's pool of light, painted trees and
// their shadows, darkening towards the edges. Static, so it is one image.
function backdrop(scene: Phaser.Scene): HTMLCanvasElement {
  const [canvas, ctx] = newCanvas(WIDTH, HEIGHT);
  ctx.drawImage(
    framed(scene, "bg_blue.png", GRADES.backdrop, WIDTH, HEIGHT),
    0,
    0,
  );
  topLit(ctx, 0.35, 0);
  const pool = ctx.createRadialGradient(WIDTH / 2, 120, 0, WIDTH / 2, 120, 700);
  pool.addColorStop(0, "rgba(255,206,140,0.42)");
  pool.addColorStop(0.45, "rgba(255,190,120,0.14)");
  pool.addColorStop(1, "rgba(255,190,120,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();
  for (const [frameName, x, s] of TREES) {
    const tree = framed(scene, frameName, GRADES.tree);
    const w = tree.width * s;
    const h = tree.height * s;
    withShadow(ctx, 0.6, () => ctx.drawImage(tree, x - w / 2, 360 - h, w, h));
  }
  sideFalloff(ctx, 0);
  return canvas;
}

// A cut-out frame with room for its shadow baked in.
function cutOut(
  scene: Phaser.Scene,
  frameName: string,
  g: Grade,
  reach: number,
  w?: number,
) {
  const art = framed(scene, frameName, g, w);
  const [canvas, ctx] = newCanvas(
    art.width + SHADOW.dx * reach,
    art.height + SHADOW.dy * reach,
  );
  withShadow(ctx, reach, () => ctx.drawImage(art, 0, 0));
  return { canvas, ctx };
}

// The fairground booth at dusk: backdrop, painted clouds and trees, three lanes,
// counter, curtains and a string of bulbs.
export function buildStage(scene: Phaser.Scene): Stage {
  scene.add
    .image(
      0,
      0,
      texture(scene, "stage-backdrop", () => backdrop(scene)),
    )
    .setOrigin(0)
    .setDepth(DEPTH.backdrop);

  const cloudKeys = ["cloud1.png", "cloud2.png"].map((name) =>
    texture(
      scene,
      `stage-${name}`,
      () => cutOut(scene, name, GRADES.cloud, 0.6).canvas,
    ),
  );
  const clouds = (
    [
      [0, 200, 150, 1],
      [1, 720, 110, 1],
      [0, 1100, 190, 0.8],
    ] as const
  ).map(([k, x, y, s]) =>
    scene.add.image(x, y, cloudKeys[k]!).setScale(s).setDepth(DEPTH.clouds),
  );

  // Strips are one tile wider on each side so they can sway without showing an
  // edge. The texture carries the strip's shadow onto the ducks behind it.
  const strips: { strip: Phaser.GameObjects.Image; x: number }[] = [];
  const lanes: Lane[] = STRIPS.map((s, k) => {
    const { top, dir, speed } = LANES[k]!;
    const tile = scene.textures.getFrame("stall", s.frame).cutWidth;
    const x = -tile + k * 40 - 40;
    const key = texture(scene, `stage-lane${k}`, () => {
      const { canvas, ctx } = cutOut(
        scene,
        s.frame,
        s.grade,
        1,
        WIDTH + 2 * tile,
      );
      topLit(ctx, 0, 0.4);
      sideFalloff(ctx, x);
      return canvas;
    });
    const base = laneDepth(k);
    const strip = scene.add
      .image(x, top, key)
      .setOrigin(0)
      .setDepth(base + LANE.strip);
    strips.push({ strip, x });
    return {
      surface: top + SURFACE_OFFSET,
      scale: s.scale,
      dir,
      speed,
      depth: base,
    };
  });

  const counterKey = texture(scene, "stage-counter", () => {
    const [canvas, ctx] = newCanvas(WIDTH, 80);
    ctx.drawImage(
      framed(scene, "bg_wood.png", GRADES.counter, WIDTH, 80),
      0,
      0,
    );
    topLit(ctx, 0, 0.5);
    sideFalloff(ctx, 0);
    // The lamp catches the counter's front lip.
    ctx.fillStyle = "rgba(255,217,160,0.55)";
    ctx.fillRect(0, 0, WIDTH, 4);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, 4, WIDTH, 10);
    return canvas;
  });
  scene.add.image(0, 640, counterKey).setOrigin(0).setDepth(DEPTH.counter);

  const valanceKey = texture(scene, "stage-valance", () => {
    const { canvas, ctx } = cutOut(
      scene,
      "curtain_straight.png",
      GRADES.curtain,
      0.8,
      WIDTH,
    );
    topLit(ctx, 0.3, 0);
    return canvas;
  });
  scene.add.image(0, 0, valanceKey).setOrigin(0).setDepth(DEPTH.curtains);
  // The left curtain's shadow falls on the stage. The right one's would fall
  // off screen, so it is drawn without one.
  const curtainKey = (shadow: boolean) =>
    texture(scene, `stage-curtain${shadow ? "-shadow" : ""}`, () => {
      const { canvas, ctx } = cutOut(
        scene,
        "curtain.png",
        GRADES.curtain,
        shadow ? 0.8 : 0,
      );
      topLit(ctx, 0, 0.45);
      return canvas;
    });
  scene.add
    .image(0, 40, curtainKey(true))
    .setOrigin(0)
    .setDepth(DEPTH.curtains);
  scene.add
    .image(WIDTH, 40, curtainKey(false))
    .setOrigin(1, 0)
    .setFlipX(true)
    .setDepth(DEPTH.curtains);

  const bulbs = stringOfBulbs(scene);

  let time = 0;
  return {
    lanes,
    update(dt) {
      time += dt;
      strips.forEach(({ strip, x }, k) => {
        if (k > 0) strip.x = x + Math.sin(time * (0.9 + k * 0.3)) * 14;
      });
      for (const cloud of clouds) {
        cloud.x += dt * 8;
        if (cloud.x > WIDTH + 100) cloud.x = -100;
      }
      bulbs.forEach((bulb, i) =>
        bulb.setAlpha(0.75 + 0.25 * Math.sin(time * 2.2 + i * 1.7)),
      );
    },
  };
}

// Warm bulbs hang along the valance's scalloped hem; they are the lamp.
function stringOfBulbs(scene: Phaser.Scene): Phaser.GameObjects.Image[] {
  const glowKey = texture(scene, "stage-bulb", () => {
    const [canvas, ctx] = newCanvas(64, 64);
    const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, "rgba(255,230,170,0.9)");
    glow.addColorStop(0.25, "rgba(255,200,120,0.45)");
    glow.addColorStop(1, "rgba(255,180,100,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 64, 64);
    return canvas;
  });
  const glows: Phaser.GameObjects.Image[] = [];
  const count = 15;
  for (let i = 0; i < count; i++) {
    const x = 150 + (i * (WIDTH - 300)) / (count - 1);
    const y = 74;
    glows.push(
      scene.add
        .image(x, y, glowKey)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.bulbs),
    );
    scene.add
      .circle(x, y, 5, 0xfff1c9)
      .setStrokeStyle(2, 0x3a2410)
      .setDepth(DEPTH.bulbs);
  }
  return glows;
}

// A flat dark copy of a moving cut-out, offset away from the lamp.
export function castShadow(
  scene: Phaser.Scene,
  source: Phaser.GameObjects.Image,
  depth: number,
): Phaser.GameObjects.Image {
  return scene.add
    .image(
      source.x + SHADOW.dx,
      source.y + SHADOW.dy,
      source.texture.key,
      source.frame.name,
    )
    .setOrigin(source.originX, source.originY)
    .setScale(source.scaleX, source.scaleY)
    .setFlip(source.flipX, source.flipY)
    .setTint(SHADOW.color)
    .setTintMode(Phaser.TintModes.FILL)
    .setAlpha(SHADOW.alpha)
    .setDepth(depth);
}
