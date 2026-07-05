import Phaser from "phaser";
import { createInitialProgress, type GameProgress } from "../logic/GameProgress";
import { LEVELS } from "../logic/levels";
import { loadProgress } from "../storage/progressStorage";
import { THEME } from "./theme";
import { drawSkyBackground } from "./background";

const NODE_RADIUS = 16;
const NODE_SPACING = 36;
const TOP_MARGIN = 60;
const ZIGZAG_OFFSET = 54;
const PATH_COLOR = THEME.pathColor;
const TIRE_COLOR = 0x2b2f36;
const LOCKED_COLOR = 0xc9c2b3;
const UNLOCKED_COLOR = THEME.accent.primary;
const COMPLETED_COLOR = THEME.accent.secondary;

/** The always-reachable start screen: a winding path of level nodes, each
 * drawn as a little wheel (dark tire ring + colored hub) instead of a plain
 * circle. Locked levels are grayed with a lock icon; unlocked ones are
 * tappable and show stars once completed. */
export class LevelMapScene extends Phaser.Scene {
  private progress!: GameProgress;

  constructor() {
    super("LevelMapScene");
  }

  create(): void {
    this.progress = loadProgress() ?? createInitialProgress();

    const centerX = this.scale.width / 2;

    drawSkyBackground(this, this.scale.width, this.scale.height);

    this.add
      .text(centerX, 24, "Select Level", {
        fontFamily: "sans-serif",
        fontSize: "19px",
        color: "#3d2b1f",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const positions = LEVELS.map((level, index) => ({
      level,
      x: centerX + (index % 2 === 0 ? -ZIGZAG_OFFSET : ZIGZAG_OFFSET),
      y: TOP_MARGIN + index * NODE_SPACING,
    }));

    const path = this.add.graphics();
    path.lineStyle(4, PATH_COLOR, 0.9);
    for (let i = 0; i < positions.length - 1; i++) {
      path.beginPath();
      path.moveTo(positions[i].x, positions[i].y);
      path.lineTo(positions[i + 1].x, positions[i + 1].y);
      path.strokePath();
    }

    for (const { level, x, y } of positions) {
      this.drawNode(level.id, x, y);
    }

    this.drawMascotBubble(centerX, positions[positions.length - 1].y);
  }

  /** Small charm, visual only: a mascot + speech bubble in the footer strip
   * below the last node, nudging new players toward the core mechanic. */
  private drawMascotBubble(centerX: number, lastNodeY: number): void {
    const y = lastNodeY + 62;
    const bubbleW = 250;
    const bubbleH = 46;
    const mascotX = centerX - bubbleW / 2 - 4;

    this.add.text(mascotX, y, "🚗", { fontSize: "26px" }).setOrigin(0.5);

    const bubbleX = centerX + 14;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.08);
    g.fillRoundedRect(bubbleX - bubbleW / 2, y - bubbleH / 2 + 3, bubbleW, bubbleH, bubbleH / 2);
    g.fillStyle(THEME.hud.chip, 1);
    g.fillRoundedRect(bubbleX - bubbleW / 2, y - bubbleH / 2, bubbleW, bubbleH, bubbleH / 2);
    g.lineStyle(2, THEME.hud.chipStroke, 1);
    g.strokeRoundedRect(bubbleX - bubbleW / 2, y - bubbleH / 2, bubbleW, bubbleH, bubbleH / 2);
    // little pointer tail toward the mascot
    g.fillStyle(THEME.hud.chip, 1);
    g.fillTriangle(
      bubbleX - bubbleW / 2 + 2,
      y - 6,
      bubbleX - bubbleW / 2 + 2,
      y + 6,
      bubbleX - bubbleW / 2 - 9,
      y,
    );
    g.lineStyle(2, THEME.hud.chipStroke, 1);
    g.lineBetween(bubbleX - bubbleW / 2 + 2, y - 6, bubbleX - bubbleW / 2 - 9, y);
    g.lineBetween(bubbleX - bubbleW / 2 + 2, y + 6, bubbleX - bubbleW / 2 - 9, y);

    this.add
      .text(bubbleX, y, "Match 3 or more vehicles\nto clear them!", {
        fontFamily: "sans-serif",
        fontSize: "11px",
        color: THEME.hud.text,
        fontStyle: "bold",
        align: "center",
        lineSpacing: 3,
      })
      .setOrigin(0.5);
  }

  private drawNode(levelId: number, x: number, y: number): void {
    const unlocked = levelId <= this.progress.highestUnlocked;
    const stars = this.progress.stars[levelId] ?? 0;

    const hubColor = !unlocked ? LOCKED_COLOR : stars > 0 ? COMPLETED_COLOR : UNLOCKED_COLOR;

    // Tire (dark ring) + hub (colored disc) reads as a little wheel.
    const tire = this.add.circle(x, y, NODE_RADIUS, TIRE_COLOR).setStrokeStyle(2, 0x14161a);
    const hub = this.add
      .circle(x, y, NODE_RADIUS - 6, hubColor)
      .setStrokeStyle(2, 0xffffff, unlocked ? 0.9 : 0.4);

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
      hub.setInteractive({ useHandCursor: true }).on("pointerup", () => {
        this.scene.start("BoardScene", { levelId });
      });
      tire.setInteractive({ useHandCursor: true }).on("pointerup", () => {
        this.scene.start("BoardScene", { levelId });
      });
    }
  }
}
