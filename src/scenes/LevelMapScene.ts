import Phaser from "phaser";
import { createInitialProgress, type GameProgress } from "../logic/GameProgress";
import { LEVELS } from "../logic/levels";
import { loadProgress } from "../storage/progressStorage";

const NODE_RADIUS = 16;
const NODE_SPACING = 36;
const TOP_MARGIN = 56;
const ZIGZAG_OFFSET = 54;
const PATH_COLOR = 0x453f63;
const LOCKED_COLOR = 0x3a3550;
const UNLOCKED_COLOR = 0x6b4fbb;
const COMPLETED_COLOR = 0x3f9e63;

/** The always-reachable start screen: a winding path of level nodes. Locked
 * levels are grayed with a lock icon; unlocked ones are tappable and show
 * stars once completed. */
export class LevelMapScene extends Phaser.Scene {
  private progress!: GameProgress;

  constructor() {
    super("LevelMapScene");
  }

  create(): void {
    this.progress = loadProgress() ?? createInitialProgress();

    const centerX = this.scale.width / 2;

    this.add
      .text(centerX, 22, "Select Level", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#f1e9ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const positions = LEVELS.map((level, index) => ({
      level,
      x: centerX + (index % 2 === 0 ? -ZIGZAG_OFFSET : ZIGZAG_OFFSET),
      y: TOP_MARGIN + index * NODE_SPACING,
    }));

    const path = this.add.graphics();
    path.lineStyle(3, PATH_COLOR, 1);
    for (let i = 0; i < positions.length - 1; i++) {
      path.beginPath();
      path.moveTo(positions[i].x, positions[i].y);
      path.lineTo(positions[i + 1].x, positions[i + 1].y);
      path.strokePath();
    }

    for (const { level, x, y } of positions) {
      this.drawNode(level.id, x, y);
    }
  }

  private drawNode(levelId: number, x: number, y: number): void {
    const unlocked = levelId <= this.progress.highestUnlocked;
    const stars = this.progress.stars[levelId] ?? 0;

    const fillColor = !unlocked ? LOCKED_COLOR : stars > 0 ? COMPLETED_COLOR : UNLOCKED_COLOR;
    const circle = this.add
      .circle(x, y, NODE_RADIUS, fillColor)
      .setStrokeStyle(2, 0xffffff, unlocked ? 0.9 : 0.25);

    this.add
      .text(x, y, unlocked ? String(levelId) : "🔒", {
        fontFamily: "sans-serif",
        fontSize: unlocked ? "13px" : "11px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    if (unlocked && stars > 0) {
      const starChars = "★★★".slice(0, stars) + "☆☆☆".slice(0, 3 - stars);
      this.add
        .text(x, y + NODE_RADIUS + 9, starChars, {
          fontFamily: "sans-serif",
          fontSize: "10px",
          color: "#ffd700",
        })
        .setOrigin(0.5);
    }

    if (unlocked) {
      circle.setInteractive({ useHandCursor: true }).on("pointerup", () => {
        this.scene.start("BoardScene", { levelId });
      });
    }
  }
}
