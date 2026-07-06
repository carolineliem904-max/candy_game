import Phaser from "phaser";
import { VEHICLE_ASSET_LIST } from "./theme";
import { GAME_HEIGHT, GAME_WIDTH, UI_SCALE } from "./layout";
import { THEME } from "./theme";

/** Minimal loading state: a road-colored bar fills in as the 7 sprites
 * (6 vehicles + traffic light) load, then hands off to the level map. Back
 * for Caroline's final custom sprite set, having been removed during the
 * brief emoji-piece interlude (which needed nothing to load). */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    this.cameras.main.setBackgroundColor(THEME.sky.top);

    this.add
      .text(centerX, centerY - 30 * UI_SCALE, "Beep Beep!", {
        fontFamily: "sans-serif",
        fontSize: `${22 * UI_SCALE}px`,
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const barWidth = 160 * UI_SCALE;
    const barBg = this.add
      .rectangle(centerX, centerY + 10 * UI_SCALE, barWidth, 14 * UI_SCALE, 0xffffff, 0.35)
      .setStrokeStyle(2 * UI_SCALE, 0xffffff);
    const barFill = this.add
      .rectangle(centerX - barWidth / 2, centerY + 10 * UI_SCALE, 1, 10 * UI_SCALE, THEME.pathColor)
      .setOrigin(0, 0.5);

    this.load.on("progress", (fraction: number) => {
      barFill.width = Math.max(1, barWidth * fraction);
    });

    for (const asset of VEHICLE_ASSET_LIST) {
      this.load.image(asset.key, asset.path);
    }

    barBg.setDepth(1);
  }

  create(): void {
    this.scene.start("LevelMapScene");
  }
}
