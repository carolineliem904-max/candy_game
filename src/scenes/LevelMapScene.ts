import Phaser from "phaser";
import { createInitialProgress, type GameProgress } from "../logic/GameProgress";
import { LEVELS } from "../logic/levels";
import type { LevelDef } from "../logic/LevelDef";
import { loadProgress } from "../storage/progressStorage";
import { THEME } from "./theme";
import { drawSkyBackground } from "./background";
import { MIN_TOUCH_TARGET, UI_SCALE } from "./layout";

/** All pixel-based constants below are scaled by `UI_SCALE` (see layout.ts)
 * because `this.scale.width`/`height` — used throughout this scene for
 * centering — now report the backing-store size (already UI_SCALE times
 * bigger for Retina sharpness), not the original design size. A literal
 * left unscaled here would render at half its intended size relative to
 * everything else on Retina, and (worse) tap-hit math against `x`/`y` built
 * from a mix of scaled and unscaled numbers would land in the wrong place. */
const NODE_RADIUS = 16 * UI_SCALE;
const NODE_SPACING = 36 * UI_SCALE;
const TOP_MARGIN = 60 * UI_SCALE;
const ZIGZAG_OFFSET = 54 * UI_SCALE;
const PATH_COLOR = THEME.pathColor;
const TIRE_COLOR = 0x2b2f36;
const LOCKED_COLOR = 0xc9c2b3;
const UNLOCKED_COLOR = THEME.accent.primary;
const COMPLETED_COLOR = THEME.accent.secondary;
/** Minimum pointer movement (px) before a gesture counts as a scroll drag
 * rather than a node tap — mirrors BoardScene's DRAG_THRESHOLD pattern. */
const SCROLL_DRAG_THRESHOLD = 6 * UI_SCALE;

function px(size: number): string {
  return `${size * UI_SCALE}px`;
}

/** The always-reachable start screen: a winding path of level nodes, each
 * drawn as a little wheel (dark tire ring + colored hub) instead of a plain
 * circle. Locked levels are grayed with a lock icon; unlocked ones are
 * tappable and show stars once completed. 20 levels no longer fit the
 * canvas in one screen (SLICE 8's level expansion), so the whole path
 * scrolls vertically via camera drag — see setupDragScroll(). */
export class LevelMapScene extends Phaser.Scene {
  private progress!: GameProgress;
  private dragStartPointerY = 0;
  private dragStartScrollY = 0;
  private dragMoved = false;

  constructor() {
    super("LevelMapScene");
  }

  create(): void {
    this.progress = loadProgress() ?? createInitialProgress();
    this.dragMoved = false;

    const centerX = this.scale.width / 2;

    const positions = LEVELS.map((level, index) => ({
      level,
      x: centerX + (index % 2 === 0 ? -ZIGZAG_OFFSET : ZIGZAG_OFFSET),
      y: TOP_MARGIN + index * NODE_SPACING,
    }));
    const lastY = positions[positions.length - 1].y;
    const mascotY = lastY + 62 * UI_SCALE;
    // The whole scene (background included) is drawn at full content height
    // and scrolls together as one piece — simpler and more thematic (a long
    // winding road) than pinning a fixed header/background layer.
    const contentHeight = Math.max(mascotY + 50 * UI_SCALE, this.scale.height);

    drawSkyBackground(this, this.scale.width, contentHeight);

    this.add
      .text(centerX, 24 * UI_SCALE, "Select Level", {
        fontFamily: "sans-serif",
        fontSize: px(19),
        color: "#3d2b1f",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const path = this.add.graphics();
    path.lineStyle(4 * UI_SCALE, PATH_COLOR, 0.9);
    for (let i = 0; i < positions.length - 1; i++) {
      path.beginPath();
      path.moveTo(positions[i].x, positions[i].y);
      path.lineTo(positions[i + 1].x, positions[i + 1].y);
      path.strokePath();
    }

    for (const { level, x, y } of positions) {
      this.drawNode(level, x, y);
    }

    this.drawMascotBubble(centerX, lastY);

    this.cameras.main.setBounds(0, 0, this.scale.width, contentHeight);
    this.setupDragScroll(contentHeight);
    this.scrollToFrontier(contentHeight);
  }

  /** Lets the player drag the map vertically when 20 levels don't fit one
   * screen. Tracks whether the gesture actually moved (past a small
   * threshold) so drawNode's tap handlers can ignore a drag that happens to
   * end on top of a node, rather than spuriously navigating. */
  private setupDragScroll(contentHeight: number): void {
    const maxScroll = Math.max(0, contentHeight - this.scale.height);
    if (maxScroll <= 0) {
      return;
    }

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.dragStartPointerY = pointer.y;
      this.dragStartScrollY = this.cameras.main.scrollY;
      this.dragMoved = false;
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) {
        return;
      }
      const dy = pointer.y - this.dragStartPointerY;
      if (Math.abs(dy) > SCROLL_DRAG_THRESHOLD) {
        this.dragMoved = true;
      }
      this.cameras.main.scrollY = Phaser.Math.Clamp(this.dragStartScrollY - dy, 0, maxScroll);
    });
  }

  /** Auto-scrolls so the highest-unlocked level starts roughly centered,
   * so a returning player doesn't have to scroll down from the top every
   * time to find where they left off. */
  private scrollToFrontier(contentHeight: number): void {
    const maxScroll = Math.max(0, contentHeight - this.scale.height);
    if (maxScroll <= 0) {
      return;
    }
    const index = Math.min(this.progress.highestUnlocked, LEVELS.length) - 1;
    const y = TOP_MARGIN + index * NODE_SPACING;
    this.cameras.main.scrollY = Phaser.Math.Clamp(y - this.scale.height / 2, 0, maxScroll);
  }

  /** Small charm, visual only: a mascot + speech bubble in the footer strip
   * below the last node, nudging new players toward the core mechanic. */
  private drawMascotBubble(centerX: number, lastNodeY: number): void {
    const y = lastNodeY + 62 * UI_SCALE;
    const bubbleW = 250 * UI_SCALE;
    const bubbleH = 46 * UI_SCALE;
    const mascotX = centerX - bubbleW / 2 - 4 * UI_SCALE;

    this.add.text(mascotX, y, "🚗", { fontSize: px(26) }).setOrigin(0.5);

    const bubbleX = centerX + 14 * UI_SCALE;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.08);
    g.fillRoundedRect(bubbleX - bubbleW / 2, y - bubbleH / 2 + 3 * UI_SCALE, bubbleW, bubbleH, bubbleH / 2);
    g.fillStyle(THEME.hud.chip, 1);
    g.fillRoundedRect(bubbleX - bubbleW / 2, y - bubbleH / 2, bubbleW, bubbleH, bubbleH / 2);
    g.lineStyle(2 * UI_SCALE, THEME.hud.chipStroke, 1);
    g.strokeRoundedRect(bubbleX - bubbleW / 2, y - bubbleH / 2, bubbleW, bubbleH, bubbleH / 2);
    // little pointer tail toward the mascot
    g.fillStyle(THEME.hud.chip, 1);
    g.fillTriangle(
      bubbleX - bubbleW / 2 + 2 * UI_SCALE,
      y - 6 * UI_SCALE,
      bubbleX - bubbleW / 2 + 2 * UI_SCALE,
      y + 6 * UI_SCALE,
      bubbleX - bubbleW / 2 - 9 * UI_SCALE,
      y,
    );
    g.lineStyle(2 * UI_SCALE, THEME.hud.chipStroke, 1);
    g.lineBetween(bubbleX - bubbleW / 2 + 2 * UI_SCALE, y - 6 * UI_SCALE, bubbleX - bubbleW / 2 - 9 * UI_SCALE, y);
    g.lineBetween(bubbleX - bubbleW / 2 + 2 * UI_SCALE, y + 6 * UI_SCALE, bubbleX - bubbleW / 2 - 9 * UI_SCALE, y);

    this.add
      .text(bubbleX, y, "Match 3 or more vehicles\nto clear them!", {
        fontFamily: "sans-serif",
        fontSize: px(11),
        color: THEME.hud.text,
        fontStyle: "bold",
        align: "center",
        lineSpacing: 3,
      })
      .setOrigin(0.5);
  }

  private drawNode(level: LevelDef, x: number, y: number): void {
    const levelId = level.id;
    const unlocked = levelId <= this.progress.highestUnlocked;
    const stars = this.progress.stars[levelId] ?? 0;

    const hubColor = !unlocked ? LOCKED_COLOR : stars > 0 ? COMPLETED_COLOR : UNLOCKED_COLOR;

    // Tire (dark ring) + hub (colored disc) reads as a little wheel.
    this.add.circle(x, y, NODE_RADIUS, TIRE_COLOR).setStrokeStyle(2 * UI_SCALE, 0x14161a);
    this.add
      .circle(x, y, NODE_RADIUS - 6 * UI_SCALE, hubColor)
      .setStrokeStyle(2 * UI_SCALE, 0xffffff, unlocked ? 0.9 : 0.4);

    this.add
      .text(x, y, unlocked ? String(levelId) : "🔒", {
        fontFamily: "sans-serif",
        fontSize: unlocked ? px(13) : px(11),
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Small goal-kind badge (score/collect/jelly) in a white circle chip at
    // the node's top-right corner, so the map previews level variety at a
    // glance without opening each one.
    const badgeX = x + NODE_RADIUS * 0.75;
    const badgeY = y - NODE_RADIUS * 0.75;
    this.add.circle(badgeX, badgeY, 9 * UI_SCALE, 0xffffff, 0.95).setStrokeStyle(1.5 * UI_SCALE, THEME.hud.chipStroke, 0.8);
    this.add.text(badgeX, badgeY, THEME.goalBadge[level.goal.kind], { fontSize: px(10) }).setOrigin(0.5);

    if (unlocked && stars > 0) {
      const starChars = "★★★".slice(0, stars) + "☆☆☆".slice(0, 3 - stars);
      this.add
        .text(x, y + NODE_RADIUS + 9 * UI_SCALE, starChars, {
          fontFamily: "sans-serif",
          fontSize: px(10),
          color: "#ffd700",
        })
        .setOrigin(0.5);
    }

    if (unlocked) {
      const goToLevel = () => {
        if (this.dragMoved) {
          return;
        }
        this.scene.start("BoardScene", { levelId });
      };
      // The wheel's own drawn radius (32px diameter) is well under the
      // ~44px comfortable-touch-target floor — rather than draw a bigger
      // wheel, an invisible hit circle carries the actual tap target so the
      // art stays the same size.
      const hitRadius = Math.max(NODE_RADIUS, MIN_TOUCH_TARGET / 2);
      this.add
        .circle(x, y, hitRadius, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", goToLevel);
    }
  }
}
