import Phaser from "phaser";
import { THEME } from "./theme";

/** Shared "pastel sky + soft city-and-road scene" background, used by both
 * `BoardScene` and `LevelMapScene` so the two never drift into looking like
 * different apps. Layered back-to-front: sky gradient, clouds, a
 * low-contrast distant skyline, green hills, then a literal road strip at
 * the very bottom edge — all Graphics/text, no image assets. */
export function drawSkyBackground(scene: Phaser.Scene, w: number, h: number): void {
  const sky = scene.add.graphics();
  sky.fillGradientStyle(THEME.sky.top, THEME.sky.top, THEME.sky.bottom, THEME.sky.bottom, 1);
  sky.fillRect(0, 0, w, h);

  drawCloud(scene, w * 0.18, h * 0.06, 1);
  drawCloud(scene, w * 0.82, h * 0.1, 0.75);

  drawSkyline(scene, w, h);

  const hills = scene.add.graphics();
  hills.fillStyle(THEME.hills.back, 0.9);
  hills.fillEllipse(w * 0.22, h - 34, w * 0.9, 80);
  hills.fillStyle(THEME.hills.front, 0.9);
  hills.fillEllipse(w * 0.78, h - 26, w * 1.05, 90);

  drawRoad(scene, w, h);
}

/** A handful of soft, low-alpha rounded-top rectangles standing in for a
 * distant skyline — deliberately muted so it reads as background haze, not
 * a foreground element competing with the board. */
function drawSkyline(scene: Phaser.Scene, w: number, h: number): void {
  const skyline = scene.add.graphics();
  skyline.fillStyle(THEME.skyline, 0.45);
  const bandBottom = h - 92;
  const buildings: { xf: number; wf: number; height: number }[] = [
    { xf: 0.04, wf: 0.09, height: 42 },
    { xf: 0.15, wf: 0.07, height: 26 },
    { xf: 0.24, wf: 0.1, height: 56 },
    { xf: 0.6, wf: 0.08, height: 34 },
    { xf: 0.7, wf: 0.11, height: 54 },
    { xf: 0.85, wf: 0.08, height: 30 },
  ];
  for (const b of buildings) {
    const bw = w * b.wf;
    const bx = w * b.xf;
    skyline.fillRoundedRect(bx, bandBottom - b.height, bw, b.height, 4);
  }
}

/** A thin literal "road" at the very bottom of the canvas with a dashed
 * centerline — mostly visible in the new footer strip below the board. */
function drawRoad(scene: Phaser.Scene, w: number, h: number): void {
  const roadHeight = 26;
  const road = scene.add.graphics();
  road.fillStyle(THEME.road.surface, 1);
  road.fillRect(0, h - roadHeight, w, roadHeight);

  road.fillStyle(THEME.road.dash, 0.9);
  const dashWidth = 14;
  const gap = 10;
  for (let x = 6; x < w; x += dashWidth + gap) {
    road.fillRect(x, h - roadHeight / 2 - 1.5, dashWidth, 3);
  }
}

function drawCloud(scene: Phaser.Scene, x: number, y: number, scale: number): void {
  const g = scene.add.graphics();
  g.fillStyle(THEME.cloud, 0.85);
  const puffs: [number, number, number][] = [
    [0, 0, 9],
    [9, -3, 7],
    [-9, -2, 7],
    [16, 2, 5],
    [-15, 3, 5],
  ];
  for (const [dx, dy, r] of puffs) {
    g.fillCircle(x + dx * scale, y + dy * scale, r * scale);
  }
}
