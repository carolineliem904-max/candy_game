import Phaser from "phaser";

/** A rounded, glossy button body: soft drop shadow, filled rounded rect
 * (or a perfect circle when `w === h`), border, and a cheap highlight
 * ellipse in the upper half to fake a glossy sheen — the "rounded, glossy,
 * no default HTML styling" look asked for across the corner buttons and
 * the win/lose overlay's buttons. Purely decorative: callers still need
 * their own interactive hit target (a transparent shape) layered on top,
 * since a Graphics object's default hit area doesn't match custom shapes. */
export function drawGlossyButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: number,
  borderColor: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const radius = h / 2;

  g.fillStyle(0x000000, 0.12);
  g.fillRoundedRect(x - w / 2, y - h / 2 + 3, w, h, radius);

  g.fillStyle(fillColor, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.lineStyle(2, borderColor, 1);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);

  g.fillStyle(0xffffff, 0.3);
  g.fillEllipse(x, y - h * 0.18, w * 0.78, h * 0.46);

  return g;
}
