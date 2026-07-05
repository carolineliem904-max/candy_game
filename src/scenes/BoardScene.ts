import Phaser from "phaser";
import type { Candy, Cell, CascadeStep, Move, SpecialActivation, SpecialCreation, Spawn } from "../logic/Board";
import { CandyType } from "../logic/CandyType";
import { BOARD_COLS, BOARD_ROWS } from "../logic/constants";
import { GameState } from "../logic/GameState";
import { completeLevel, createInitialProgress, starsForScore } from "../logic/GameProgress";
import { getLevelById, LEVEL_COUNT } from "../logic/levels";
import { scoreForStep } from "../logic/ScoreRules";
import { SoundEngine } from "../audio/SoundEngine";
import { loadProgress, saveProgress } from "../storage/progressStorage";
import { BOARD_MARGIN, CELL_PADDING, CELL_SIZE, DRAG_THRESHOLD, HUD_HEIGHT } from "./layout";
import { PARTICLE_COLORS, TRAFFIC_LIGHT_ASSET, THEME, VEHICLE_ASSETS, type VehicleAsset } from "./theme";
import { drawSkyBackground } from "./background";
import { drawGlossyButton } from "./uiKit";

/** Matches `drawTiles()`'s tile size exactly (the visible white square, not
 * the full 44px cell) — the two must stay in sync or pieces overflow their
 * own tile. That's exactly the bug this constant fixes: `PIECE_TARGET_SIZE`
 * was previously computed from `CELL_SIZE` (44) instead of this, so at 85%
 * it came out to ~37px against a 36px tile — a hair too big, leaving zero
 * clearance for the speed-line decoration beside a striped piece and
 * making the lines read as misaligned/overlapping the sprite. */
const TILE_SIZE = CELL_SIZE - 8;

/** ~85% of the tile width. Was 0.68, but that ratio was tuned before the
 * vehicle PNGs had their transparent margins trimmed — once trimmed, the
 * visible artwork fills its own bounding box, so the same 0.68 made pieces
 * read as too small; 0.85 is the "fills the tile" size Caroline asked for
 * against the now-tight sprite bounds. Sprites have varying native aspect
 * ratios, so this is the *larger* dimension's target; see `makeSprite()`. */
const PIECE_TARGET_SIZE = Math.round(TILE_SIZE * 0.85);

const MOVES_URGENT_THRESHOLD = 5;
const MOVES_URGENT_COLOR = THEME.hud.urgent;
const MOVES_NORMAL_COLOR = THEME.hud.text;

// Animation timing (see playCascadeSteps for the >3-step compression rule
// that keeps a full sequence under ~4s even for deep cascades).
const SWAP_DURATION = 150;
const CLEAR_DURATION = 200;
const GRAVITY_MS_PER_ROW = 80;
const GRAVITY_MAX_DURATION = 400;
const SPAWN_MS_PER_ROW = 80;
const SPAWN_MAX_DURATION = 400;
const CASCADE_COMPRESS_THRESHOLD = 3;
const HINT_IDLE_MS = 5000;
const ACTIVATION_DURATION = 260;
const BOMB_ZAP_TOTAL_MS = 400;
const SPECIAL_CREATED_DURATION = 160;

interface DragStart extends Cell {
  x: number;
  y: number;
}

export class BoardScene extends Phaser.Scene {
  private levelId!: number;
  private gameState!: GameState;
  private soundEngine = new SoundEngine();
  private offsetX = 0;
  private offsetY = 0;
  private candyObjects: (Phaser.GameObjects.Container | null)[][] = [];
  private boardLayer!: Phaser.GameObjects.Container;
  private selected: Cell | null = null;
  private selectionRing: Phaser.GameObjects.Arc | null = null;
  private selectionTween: Phaser.Tweens.Tween | null = null;
  private dragStart: DragStart | null = null;
  private scoreText!: Phaser.GameObjects.Text;
  private scoreTargetText!: Phaser.GameObjects.Text;
  private movesText!: Phaser.GameObjects.Text;
  private muteButton!: Phaser.GameObjects.Text;
  private mapButton!: Phaser.GameObjects.Text;
  private animating = false;
  private hintTimer: Phaser.Time.TimerEvent | null = null;
  private hintTweens: Phaser.Tweens.Tween[] = [];

  constructor() {
    super("BoardScene");
  }

  /** Phaser re-runs init()+create() on this same scene instance every time
   * it's (re)started, so any per-run state below must be reset here rather
   * than relying on field-initializer defaults (those only run once, at
   * true construction time). */
  init(data: { levelId: number }): void {
    this.levelId = data.levelId;
    this.selected = null;
    this.selectionRing = null;
    this.selectionTween = null;
    this.dragStart = null;
    this.animating = false;
    this.hintTimer = null;
    this.hintTweens = [];
  }

  create(): void {
    const level = getLevelById(this.levelId);
    if (!level) {
      throw new Error(`BoardScene: unknown levelId ${this.levelId}`);
    }

    const boardPixelSize = BOARD_COLS * CELL_SIZE;
    this.offsetX = (this.scale.width - boardPixelSize) / 2;
    this.offsetY = HUD_HEIGHT + BOARD_MARGIN / 2;

    drawSkyBackground(this, this.scale.width, this.scale.height);
    this.drawBoardPanel(boardPixelSize);
    this.drawTiles();

    this.createHud();
    this.createMuteButton();
    this.createMapButton();

    this.boardLayer = this.add.container(0, 0);

    this.gameState = new GameState({ level, seed: Date.now() });
    this.drawBoard();
    this.updateHud();

    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointerup", this.onPointerUp, this);

    this.resetHintTimer();
  }

  /** Light-cream board panel with a gentle drop shadow, replacing the
   * cooler blue-gray SLICE 7 follow-up panel — "polished mobile casual
   * game" pass. */
  private drawBoardPanel(boardPixelSize: number): void {
    const panelSize = boardPixelSize + BOARD_MARGIN;
    const panelX = this.scale.width / 2 - panelSize / 2;
    const panelY = HUD_HEIGHT;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.1);
    shadow.fillRoundedRect(panelX, panelY + 5, panelSize, panelSize, 16);

    const g = this.add.graphics();
    g.fillStyle(THEME.boardPanel.fill, 1);
    g.fillRoundedRect(panelX, panelY, panelSize, panelSize, 16);
    g.lineStyle(3, THEME.boardPanel.stroke, 1);
    g.strokeRoundedRect(panelX, panelY, panelSize, panelSize, 16);
  }

  /** A light rounded tile behind every cell (drawn once, outside
   * `boardLayer` so `drawBoard()`'s redraws never touch it) — the classic
   * white-tile match-3 backing, with a small gap between tiles and a very
   * soft shadow for a touch of depth. */
  private drawTiles(): void {
    const radius = 8;
    const g = this.add.graphics();
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const { x, y } = this.cellCenter(col, row);
        const left = x - TILE_SIZE / 2;
        const top = y - TILE_SIZE / 2;
        g.fillStyle(THEME.tile.shadow, 0.35);
        g.fillRoundedRect(left, top + 1.5, TILE_SIZE, TILE_SIZE, radius);
        g.fillStyle(THEME.tile.fill, 1);
        g.fillRoundedRect(left, top, TILE_SIZE, TILE_SIZE, radius);
        g.lineStyle(1.5, THEME.tile.stroke, 1);
        g.strokeRoundedRect(left, top, TILE_SIZE, TILE_SIZE, radius);
      }
    }
  }

  /** Rounded cream "pill" HUD with 3 segments (Level / Score / Moves),
   * each a small caption label over a large colorful number — replacing
   * the old two-line plain-text HUD. */
  private createHud(): void {
    const centerX = this.scale.width / 2;
    const pillW = 260;
    const pillH = 58;
    const pillY = 6;
    const pillX = centerX - pillW / 2;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.1);
    shadow.fillRoundedRect(pillX, pillY + 3, pillW, pillH, pillH / 2);

    const chip = this.add.graphics();
    chip.fillStyle(THEME.hud.chip, 1);
    chip.fillRoundedRect(pillX, pillY, pillW, pillH, pillH / 2);
    chip.lineStyle(2, THEME.hud.chipStroke, 1);
    chip.strokeRoundedRect(pillX, pillY, pillW, pillH, pillH / 2);

    const segW = pillW / 3;
    chip.lineStyle(2, THEME.hud.chipStroke, 0.5);
    chip.lineBetween(pillX + segW, pillY + 10, pillX + segW, pillY + pillH - 10);
    chip.lineBetween(pillX + segW * 2, pillY + 10, pillX + segW * 2, pillY + pillH - 10);

    const segCenterX = (i: number) => pillX + segW * i + segW / 2;
    const labelY = pillY + 13;
    const numberY = pillY + 35;

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "sans-serif",
      fontSize: "10px",
      color: THEME.hud.label,
      fontStyle: "bold",
    };
    const numberStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "sans-serif",
      fontSize: "20px",
      fontStyle: "bold",
    };

    this.add.text(segCenterX(0), labelY, "LEVEL", labelStyle).setOrigin(0.5);
    this.add.text(segCenterX(1), labelY, "SCORE", labelStyle).setOrigin(0.5);
    this.add.text(segCenterX(2), labelY, "MOVES", labelStyle).setOrigin(0.5);

    this.add
      .text(segCenterX(0), numberY, String(this.levelId), { ...numberStyle, color: THEME.hudNumbers.level })
      .setOrigin(0.5);
    this.scoreText = this.add
      .text(segCenterX(1), numberY, "0", { ...numberStyle, color: THEME.hudNumbers.score })
      .setOrigin(0.5);
    this.scoreTargetText = this.add
      .text(segCenterX(1), numberY + 15, "", { fontFamily: "sans-serif", fontSize: "9px", color: THEME.hud.label })
      .setOrigin(0.5);
    this.movesText = this.add
      .text(segCenterX(2), numberY, "0", { ...numberStyle, color: MOVES_NORMAL_COLOR })
      .setOrigin(0.5);
  }

  private createMuteButton(): void {
    const x = this.scale.width - 30;
    const y = 35;
    drawGlossyButton(this, x, y, 38, 38, THEME.hud.chip, THEME.hud.chipStroke).setDepth(14);
    this.muteButton = this.add
      .text(x, y, "🔊", { fontSize: "16px" })
      .setOrigin(0.5)
      .setDepth(15)
      .setInteractive({ useHandCursor: true });

    this.muteButton.on("pointerup", () => {
      const muted = this.soundEngine.toggleMuted();
      this.muteButton.setText(muted ? "🔇" : "🔊");
    });
  }

  private createMapButton(): void {
    const x = 30;
    const y = 35;
    drawGlossyButton(this, x, y, 38, 38, THEME.hud.chip, THEME.hud.chipStroke).setDepth(14);
    this.mapButton = this.add
      .text(x, y, "☰", { fontFamily: "sans-serif", fontSize: "16px", color: THEME.hud.text, fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(15)
      .setInteractive({ useHandCursor: true });

    this.mapButton.on("pointerup", () => this.scene.start("LevelMapScene"));
  }

  private updateHud(): void {
    const level = this.gameState.level;
    this.scoreText.setText(String(this.gameState.score));
    this.scoreTargetText.setText(`of ${level.targetScore}`);
    const moves = this.gameState.movesRemaining;
    this.movesText.setText(String(moves));
    this.movesText.setColor(moves <= MOVES_URGENT_THRESHOLD ? MOVES_URGENT_COLOR : MOVES_NORMAL_COLOR);
  }

  private drawBoard(): void {
    this.boardLayer.removeAll(true);
    this.candyObjects = [];

    for (let row = 0; row < BOARD_ROWS; row++) {
      this.candyObjects[row] = [];
      for (let col = 0; col < BOARD_COLS; col++) {
        const cell = this.gameState.board.getCell(col, row);
        const { x, y } = this.cellCenter(col, row);

        if (cell === null) {
          const socketRadius = (CELL_SIZE - CELL_PADDING * 2) / 2 - 4;
          const socket = this.add.circle(x, y, socketRadius, THEME.socket.fill).setStrokeStyle(2, THEME.socket.stroke);
          this.boardLayer.add(socket);
          this.candyObjects[row][col] = null;
          continue;
        }

        const candy = this.drawCandyVisual(x, y, col, row, cell);
        this.boardLayer.add(candy);
        this.candyObjects[row][col] = candy;
      }
    }
  }

  /** Builds a candy's visual as a two-layer Container: the outer layer is
   * what game logic tweens for board position (swap/gravity/spawn), the
   * inner `visual` layer holds the sprite (plus, for striped/wrapped, an
   * effect overlay) and is what the idle bob loop and selection wiggle
   * animate — keeping those cosmetic loops on a separate transform from the
   * ones game logic drives avoids the two fighting over the same
   * x/y/angle. Specials are overlays on the base vehicle sprite, not
   * separate images — except the color bomb, which has no underlying color
   * to decorate and so is fully replaced by the traffic-light sprite. */
  private drawCandyVisual(x: number, y: number, col: number, row: number, cell: Candy): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const visual = this.add.container(0, 0);
    container.add(visual);
    container.setData("visual", visual);

    if (cell.special === "bomb") {
      visual.add(this.makeSprite(TRAFFIC_LIGHT_ASSET));
      container.setData("color", 0xffffff);
    } else {
      const asset = VEHICLE_ASSETS[cell.type as CandyType];
      if (cell.special === "stripedH" || cell.special === "stripedV") {
        this.addSpeedLines(visual, cell.special === "stripedH");
      }
      if (cell.special === "wrapped") {
        this.addWrappedGlow(visual);
      }
      visual.add(this.makeSprite(asset));
      container.setData("color", PARTICLE_COLORS[cell.type as CandyType]);
    }

    this.attachIdleMotion(visual, col, row);

    return container;
  }

  /** A vehicle sprite scaled so its larger native dimension matches
   * `PIECE_TARGET_SIZE`, preserving aspect ratio (sprites aren't uniformly
   * square, unlike the old emoji glyphs). */
  private makeSprite(asset: VehicleAsset): Phaser.GameObjects.Image {
    const scale = PIECE_TARGET_SIZE / Math.max(asset.width, asset.height);
    return this.add.image(0, 0, asset.key).setDisplaySize(asset.width * scale, asset.height * scale);
  }

  /** Animated speed-lines *behind* the sprite (added to `visual` before the
   * sprite itself, so it renders underneath), oriented to the clear
   * direction: horizontal bars for a row-clearing stripe, vertical for a
   * column-clearing one. The continuous shimmer (alpha + slight slide) is
   * what makes them read as "speed" rather than a static decoration;
   * tracked in `decorTweens` so `destroyCandy` can stop it. */
  private addSpeedLines(visual: Phaser.GameObjects.Container, horizontal: boolean): void {
    const tweens: Phaser.Tweens.Tween[] = [];
    const lengths = [22, 16, 10];
    lengths.forEach((len, i) => {
      const offset = (i - 1) * 7;
      const bar = horizontal
        ? this.add.rectangle(-18, offset, len, 2.6, THEME.speedLine)
        : this.add.rectangle(offset, -18, 2.6, len, THEME.speedLine);
      bar.setAlpha(0.75);
      visual.add(bar);
      tweens.push(
        this.tweens.add({
          targets: bar,
          alpha: 1,
          x: horizontal ? bar.x - 4 : bar.x,
          y: horizontal ? bar.y : bar.y - 4,
          duration: 260 + i * 40,
          delay: i * 80,
          yoyo: true,
          repeat: -1,
          ease: "Sine.InOut",
        }),
      );
    });
    visual.setData("decorTweens", tweens);
  }

  /** A pulsing golden ring behind the sprite standing in for a "glow" —
   * a subtle dark edge ring sits just behind the saturated gold ring for
   * contrast against the white tiles (a plain gold ring alone read as too
   * washed out there). Both continuously scale/fade together, tracked in
   * `decorTweens` for cleanup. */
  private addWrappedGlow(visual: Phaser.GameObjects.Container): void {
    const radius = PIECE_TARGET_SIZE * 0.44;
    const edge = this.add.circle(0, 0, radius, 0x000000, 0).setStrokeStyle(5, THEME.wrappedGlowEdge, 0.4);
    const ring = this.add.circle(0, 0, radius, 0x000000, 0).setStrokeStyle(4, THEME.wrappedGlow, 1);
    visual.add(edge);
    visual.add(ring);
    const tween = this.tweens.add({
      targets: [edge, ring],
      scale: 1.25,
      alpha: 0.4,
      duration: 550,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    visual.setData("decorTweens", [tween]);
  }

  /** Tiny desynced-per-cell bob loop — "engine idling" charm. Only animates
   * local `y`, never `angle`, so it never fights the selection wiggle
   * (which only animates `angle`) even when both run at once. */
  private attachIdleMotion(visual: Phaser.GameObjects.Container, col: number, row: number): void {
    const seed = (col * 131 + row * 977) % 997;
    const tween = this.tweens.add({
      targets: visual,
      y: -1.6,
      duration: 1500 + (seed % 7) * 110,
      delay: seed % 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    visual.setData("idleTween", tween);
  }

  private destroyCandy(container: Phaser.GameObjects.Container | null): void {
    if (!container) {
      return;
    }
    const visual = container.getData("visual") as Phaser.GameObjects.Container | undefined;
    if (visual) {
      this.tweens.killTweensOf(visual);
      const decorTweens = visual.getData("decorTweens") as Phaser.Tweens.Tween[] | undefined;
      decorTweens?.forEach((tween) => tween.stop());
    }
    container.destroy();
  }

  private cellCenter(col: number, row: number): { x: number; y: number } {
    return {
      x: this.offsetX + col * CELL_SIZE + CELL_SIZE / 2,
      y: this.offsetY + row * CELL_SIZE + CELL_SIZE / 2,
    };
  }

  private pixelToCell(x: number, y: number): Cell | null {
    const col = Math.floor((x - this.offsetX) / CELL_SIZE);
    const row = Math.floor((y - this.offsetY) / CELL_SIZE);
    if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) {
      return null;
    }
    return { col, row };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.stopHintWiggle();
    this.resetHintTimer();

    if (this.animating || this.gameState.status !== "playing") {
      return;
    }
    const cell = this.pixelToCell(pointer.x, pointer.y);
    if (!cell) {
      return;
    }
    this.dragStart = { ...cell, x: pointer.x, y: pointer.y };
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const start = this.dragStart;
    this.dragStart = null;
    if (!start || this.animating || this.gameState.status !== "playing") {
      return;
    }

    const dx = pointer.x - start.x;
    const dy = pointer.y - start.y;
    const dragDistance = Math.max(Math.abs(dx), Math.abs(dy));

    if (dragDistance >= DRAG_THRESHOLD) {
      const target = this.dragTargetCell(start, dx, dy);
      this.clearSelection();
      if (target) {
        void this.attemptSwap({ col: start.col, row: start.row }, target);
      }
      return;
    }

    this.handleTap({ col: start.col, row: start.row });
  }

  private handleTap(tapped: Cell): void {
    if (!this.selected) {
      this.select(tapped);
      return;
    }

    if (this.selected.col === tapped.col && this.selected.row === tapped.row) {
      this.clearSelection();
      return;
    }

    if (this.isAdjacentCell(this.selected, tapped)) {
      const from = this.selected;
      this.clearSelection();
      void this.attemptSwap(from, tapped);
      return;
    }

    this.select(tapped);
  }

  private dragTargetCell(start: Cell, dx: number, dy: number): Cell | null {
    const dCol = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0;
    const dRow = dCol === 0 ? Math.sign(dy) : 0;
    const col = start.col + dCol;
    const row = start.row + dRow;
    if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) {
      return null;
    }
    return { col, row };
  }

  private isAdjacentCell(a: Cell, b: Cell): boolean {
    const dCol = Math.abs(a.col - b.col);
    const dRow = Math.abs(a.row - b.row);
    return (dCol === 1 && dRow === 0) || (dCol === 0 && dRow === 1);
  }

  /** Plays the swap slide, then (on success) the full cascade animation
   * sequence, keeping input locked throughout. */
  private async attemptSwap(a: Cell, b: Cell): Promise<void> {
    const objA = this.candyObjects[a.row]?.[a.col];
    const objB = this.candyObjects[b.row]?.[b.col];
    if (!objA || !objB) {
      return;
    }

    this.animating = true;
    this.cancelHintTimer();

    const posA = this.cellCenter(a.col, a.row);
    const posB = this.cellCenter(b.col, b.row);

    await Promise.all([
      this.tweenAsync({ targets: objA, x: posB.x, y: posB.y, duration: SWAP_DURATION, ease: "Quad.InOut" }),
      this.tweenAsync({ targets: objB, x: posA.x, y: posA.y, duration: SWAP_DURATION, ease: "Quad.InOut" }),
    ]);

    const result = this.gameState.attemptSwap(a, b);

    if (!result.ok) {
      this.soundEngine.invalid();
      await Promise.all([
        this.tweenAsync({ targets: objA, x: posA.x, y: posA.y, duration: SWAP_DURATION, ease: "Quad.InOut" }),
        this.tweenAsync({ targets: objB, x: posB.x, y: posB.y, duration: SWAP_DURATION, ease: "Quad.InOut" }),
      ]);
      this.animating = false;
      this.resetHintTimer();
      return;
    }

    this.soundEngine.swap();
    this.candyObjects[a.row][a.col] = objB;
    this.candyObjects[b.row][b.col] = objA;
    this.updateHud();

    await this.playCascadeSteps(result.steps);

    if (result.reshuffled) {
      this.showPopupText("Shuffled!");
      await this.reshuffleTransition();
    }

    this.animating = false;

    if (result.status !== "playing") {
      this.soundEngine[result.status === "won" ? "win" : "lose"]();
      this.showEndOverlay();
    } else {
      this.resetHintTimer();
    }
  }

  /** Replays a resolved cascade's steps in order: clear (pop + score popup),
   * gravity (fall), spawn (drop in). Compresses timing past 3 steps so a
   * deep cascade never runs long (see the >3-step scale below). */
  private async playCascadeSteps(steps: CascadeStep[]): Promise<void> {
    if (steps.length === 0) {
      return;
    }

    const scale = steps.length > CASCADE_COMPRESS_THRESHOLD ? CASCADE_COMPRESS_THRESHOLD / steps.length : 1;
    const clearDuration = CLEAR_DURATION * scale;
    const gravityPerRow = GRAVITY_MS_PER_ROW * scale;
    const gravityMax = GRAVITY_MAX_DURATION * scale;
    const spawnPerRow = SPAWN_MS_PER_ROW * scale;
    const spawnMax = SPAWN_MAX_DURATION * scale;

    if (steps.length > 1) {
      this.showPopupText(`Cascade x${steps.length}!`);
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepNumber = i + 1;
      const points = scoreForStep(step, stepNumber);
      const centroidCells = step.cleared.length > 0 ? step.cleared : [{ col: BOARD_COLS / 2, row: BOARD_ROWS / 2 }];
      const { x, y } = this.centroidOf(centroidCells);
      this.showPopupText(`+${points}`, x, y, 18);
      this.soundEngine.pop(stepNumber);
      this.spawnClearBurst(step.cleared);

      if (step.activations.length > 0) {
        await this.playActivations(step.activations, scale);
      }
      await this.playClear(step.cleared, clearDuration);
      await this.playSpecialsCreated(step.specialsCreated);
      await this.playGravity(step.moves, gravityPerRow, gravityMax);
      await this.playSpawns(step.spawns, spawnPerRow, spawnMax);
    }
  }

  /** Plays each activated special's distinct effect animation + sound
   * concurrently: a lane-sweep flash (with a trailing motion-blur streak)
   * for striped, an expanding "puff cloud" for wrapped, per-candy "beep"
   * zaps staggered across the cleared set for a color bomb (total stagger
   * time capped so a huge bomb clear can't blow the ~4s budget). */
  private async playActivations(activations: SpecialActivation[], scale: number): Promise<void> {
    await Promise.all(activations.map((activation) => this.playActivationEffect(activation, scale)));
  }

  private async playActivationEffect(activation: SpecialActivation, scale: number): Promise<void> {
    const { x, y } = this.cellCenter(activation.cell.col, activation.cell.row);

    if (activation.special === "stripedH" || activation.special === "stripedV") {
      this.soundEngine.striped();
      const horizontal = activation.special === "stripedH";
      const boardPixelW = BOARD_COLS * CELL_SIZE;
      const boardPixelH = BOARD_ROWS * CELL_SIZE;

      const streak = this.add
        .rectangle(
          horizontal ? this.offsetX + boardPixelW / 2 : x,
          horizontal ? y : this.offsetY + boardPixelH / 2,
          horizontal ? boardPixelW : CELL_SIZE * 0.9,
          horizontal ? CELL_SIZE * 0.9 : boardPixelH,
          THEME.stripe,
        )
        .setAlpha(0)
        .setDepth(7);
      const rect = this.add
        .rectangle(
          horizontal ? this.offsetX + boardPixelW / 2 : x,
          horizontal ? y : this.offsetY + boardPixelH / 2,
          horizontal ? boardPixelW : CELL_SIZE * 0.6,
          horizontal ? CELL_SIZE * 0.6 : boardPixelH,
          THEME.pathColor,
        )
        .setAlpha(0)
        .setDepth(8);
      this.boardLayer.add(streak);
      this.boardLayer.add(rect);
      await Promise.all([
        this.tweenAsync({ targets: streak, alpha: 0.25, duration: ACTIVATION_DURATION * 0.45 * scale, yoyo: true }),
        this.tweenAsync({ targets: rect, alpha: 0.6, duration: ACTIVATION_DURATION * 0.35 * scale, yoyo: true }),
      ]);
      streak.destroy();
      rect.destroy();
      return;
    }

    if (activation.special === "wrapped") {
      this.soundEngine.wrapped();
      const puffs: [number, number][] = [
        [0, 0],
        [10, -6],
        [-10, -6],
        [8, 8],
        [-8, 8],
      ];
      const cloud = puffs.map(([dx, dy]) =>
        this.add.circle(x + dx, y + dy, CELL_SIZE * 0.22, 0xffffff, 0.9).setDepth(8),
      );
      cloud.forEach((c) => this.boardLayer.add(c));
      await this.tweenAsync({
        targets: cloud,
        scale: 2.4,
        alpha: 0,
        duration: ACTIVATION_DURATION * scale,
        ease: "Cubic.Out",
      });
      cloud.forEach((c) => c.destroy());
      return;
    }

    // bomb — little "beep" sparkle zaps
    this.soundEngine.bomb();
    const cells = activation.cellsCleared;
    const perCellDelay = cells.length > 0 ? Math.min(30, BOMB_ZAP_TOTAL_MS / cells.length) * scale : 0;
    await Promise.all(
      cells.map(
        (cell, i) =>
          new Promise<void>((resolve) => {
            this.time.delayedCall(i * perCellDelay, () => {
              const p = this.cellCenter(cell.col, cell.row);
              const zap = this.add.container(p.x, p.y).setDepth(8);
              const barA = this.add.rectangle(0, 0, 12, 2.4, THEME.accent.primary);
              const barB = this.add.rectangle(0, 0, 12, 2.4, THEME.accent.primary).setAngle(90);
              zap.add([barA, barB]);
              zap.setAlpha(0.95);
              this.boardLayer.add(zap);
              this.tweens.add({
                targets: zap,
                scale: 1.8,
                alpha: 0,
                angle: 45,
                duration: 180 * scale,
                onComplete: () => {
                  zap.destroy();
                  resolve();
                },
              });
            });
          }),
      ),
    );
  }

  /** A newly-created special replaces the plain candy at its spawn cell
   * (which was excluded from this step's `cleared` set) with a little
   * pop-into-existence flourish. */
  private async playSpecialsCreated(creations: SpecialCreation[]): Promise<void> {
    if (creations.length === 0) {
      return;
    }
    this.soundEngine.specialCreated();

    await Promise.all(
      creations.map((creation) => {
        this.destroyCandy(this.candyObjects[creation.cell.row]?.[creation.cell.col] ?? null);

        const { x, y } = this.cellCenter(creation.cell.col, creation.cell.row);
        const pieceContainer = this.drawCandyVisual(x, y, creation.cell.col, creation.cell.row, {
          type: creation.type,
          special: creation.special,
        });
        this.boardLayer.add(pieceContainer);
        this.candyObjects[creation.cell.row][creation.cell.col] = pieceContainer;
        pieceContainer.setScale(0.3);

        return this.tweenAsync({ targets: pieceContainer, scale: 1.15, duration: SPECIAL_CREATED_DURATION, ease: "Back.Out" }).then(
          () => this.tweenAsync({ targets: pieceContainer, scale: 1, duration: SPECIAL_CREATED_DURATION * 0.6 }),
        );
      }),
    );
  }

  private async playClear(cells: Cell[], duration: number): Promise<void> {
    const objs = cells
      .map((cell) => this.candyObjects[cell.row]?.[cell.col])
      .filter((obj): obj is Phaser.GameObjects.Container => obj !== null && obj !== undefined);

    await Promise.all(
      objs.map((obj) =>
        this.tweenAsync({ targets: obj, scale: 1.3, duration: duration * 0.35, ease: "Sine.Out" }).then(() =>
          this.tweenAsync({ targets: obj, scale: 0, alpha: 0, duration: duration * 0.65, ease: "Sine.In" }),
        ),
      ),
    );

    for (const cell of cells) {
      const obj = this.candyObjects[cell.row]?.[cell.col];
      this.destroyCandy(obj ?? null);
      if (this.candyObjects[cell.row]) {
        this.candyObjects[cell.row][cell.col] = null;
      }
    }
  }

  private async playGravity(moves: Move[], msPerRow: number, maxDuration: number): Promise<void> {
    await Promise.all(
      moves.map((move) => {
        const obj = this.candyObjects[move.from.row]?.[move.from.col];
        if (!obj) {
          return Promise.resolve();
        }
        this.candyObjects[move.from.row][move.from.col] = null;
        this.candyObjects[move.to.row][move.to.col] = obj;

        const rowsFallen = move.to.row - move.from.row;
        const duration = Math.min(maxDuration, msPerRow * rowsFallen);
        const target = this.cellCenter(move.to.col, move.to.row);
        return this.tweenAsync({ targets: obj, y: target.y, duration, ease: "Bounce.Out" });
      }),
    );
  }

  private async playSpawns(spawns: Spawn[], msPerRow: number, maxDuration: number): Promise<void> {
    const byColumn = new Map<number, Spawn[]>();
    for (const spawn of spawns) {
      const list = byColumn.get(spawn.cell.col) ?? [];
      list.push(spawn);
      byColumn.set(spawn.cell.col, list);
    }

    const tasks: Promise<void>[] = [];
    for (const columnSpawns of byColumn.values()) {
      const holeCount = columnSpawns.length;
      for (const spawn of columnSpawns) {
        const { x, y } = this.cellCenter(spawn.cell.col, spawn.cell.row);
        const startY = this.offsetY - CELL_SIZE * (holeCount - spawn.cell.row);
        // Refill always spawns plain (non-special) candies, per spec.
        const obj = this.drawCandyVisual(x, startY, spawn.cell.col, spawn.cell.row, { type: spawn.type, special: null });
        this.boardLayer.add(obj);
        this.candyObjects[spawn.cell.row][spawn.cell.col] = obj;

        const rowsFallen = holeCount - spawn.cell.row;
        const duration = Math.min(maxDuration, msPerRow * rowsFallen);
        tasks.push(this.tweenAsync({ targets: obj, y, duration, ease: "Bounce.Out" }));
      }
    }
    await Promise.all(tasks);
  }

  /** A small optional flourish: a handful of dots scatter from each cleared
   * cell and fade. Fire-and-forget — doesn't block the cascade sequence. */
  private spawnClearBurst(cells: Cell[]): void {
    const directions = [
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 1 },
    ];
    for (const cell of cells) {
      const obj = this.candyObjects[cell.row]?.[cell.col];
      if (!obj) {
        continue;
      }
      const { x, y } = this.cellCenter(cell.col, cell.row);
      const color = (obj.getData("color") as number | undefined) ?? 0xffffff;
      for (const { dx, dy } of directions) {
        const particle = this.add.circle(x, y, 4, color).setDepth(9);
        this.boardLayer.add(particle);
        this.tweens.add({
          targets: particle,
          x: x + dx * 22,
          y: y + dy * 22,
          alpha: 0,
          scale: 0,
          duration: 260,
          ease: "Cubic.Out",
          onComplete: () => particle.destroy(),
        });
      }
    }
  }

  private async reshuffleTransition(): Promise<void> {
    await this.tweenAsync({ targets: this.boardLayer, alpha: 0, duration: 150 });
    this.drawBoard();
    this.boardLayer.setAlpha(0);
    await this.tweenAsync({ targets: this.boardLayer, alpha: 1, duration: 150 });
  }

  private tweenAsync(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...config, onComplete: () => resolve() });
    });
  }

  private centroidOf(cells: Cell[]): { x: number; y: number } {
    const sum = cells.reduce(
      (acc, cell) => {
        const p = this.cellCenter(cell.col, cell.row);
        return { x: acc.x + p.x, y: acc.y + p.y };
      },
      { x: 0, y: 0 },
    );
    return { x: sum.x / cells.length, y: sum.y / cells.length };
  }

  private showPopupText(text: string, x = this.scale.width / 2, y = this.scale.height / 2, fontSize = 26): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: "sans-serif",
        fontSize: `${fontSize}px`,
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setScale(0.6)
      .setAlpha(0);

    this.tweens.add({
      targets: label,
      alpha: 1,
      scale: 1,
      duration: 150,
      ease: "Back.Out",
      onComplete: () => {
        this.tweens.add({
          targets: label,
          alpha: 0,
          y: y - 20,
          delay: 500,
          duration: 400,
          onComplete: () => label.destroy(),
        });
      },
    });
  }

  private select(cell: Cell): void {
    this.clearSelection();
    this.selected = cell;
    const { x, y } = this.cellCenter(cell.col, cell.row);
    const radius = (CELL_SIZE - CELL_PADDING * 2) / 2 + 4;
    this.selectionRing = this.add.circle(x, y, radius).setStrokeStyle(3, THEME.selectionRing);
    this.selectionTween = this.tweens.add({
      targets: this.selectionRing,
      scale: 1.15,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    this.startSelectionWiggle(cell);
  }

  private clearSelection(): void {
    if (this.selected) {
      this.stopSelectionWiggle(this.selected);
    }
    this.selected = null;
    this.selectionTween?.stop();
    this.selectionTween = null;
    this.selectionRing?.destroy();
    this.selectionRing = null;
  }

  /** "Engine revving" tilt-wiggle layered on top of the selected piece's
   * idle bob — only ever touches `angle`, so it never fights the idle
   * loop's `y`-only bob even while both run simultaneously. */
  private startSelectionWiggle(cell: Cell): void {
    const container = this.candyObjects[cell.row]?.[cell.col];
    const visual = container?.getData("visual") as Phaser.GameObjects.Container | undefined;
    if (!visual) {
      return;
    }
    const wiggle = this.tweens.add({
      targets: visual,
      angle: 7,
      duration: 130,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    visual.setData("wiggleTween", wiggle);
  }

  private stopSelectionWiggle(cell: Cell): void {
    const container = this.candyObjects[cell.row]?.[cell.col];
    const visual = container?.getData("visual") as Phaser.GameObjects.Container | undefined;
    if (!visual) {
      return;
    }
    const wiggle = visual.getData("wiggleTween") as Phaser.Tweens.Tween | undefined;
    wiggle?.stop();
    visual.setData("wiggleTween", undefined);
    visual.angle = 0;
  }

  private resetHintTimer(): void {
    this.hintTimer?.remove();
    this.hintTimer = this.time.delayedCall(HINT_IDLE_MS, () => this.showHint());
  }

  private cancelHintTimer(): void {
    this.hintTimer?.remove();
    this.hintTimer = null;
    this.stopHintWiggle();
  }

  private stopHintWiggle(): void {
    this.hintTweens.forEach((tween) => tween.stop());
    this.hintTweens = [];
  }

  /** After 5s of no input, subtly wiggle (scale-pulse) one valid move to
   * nudge the player — purely cosmetic, doesn't touch game state. */
  private showHint(): void {
    if (this.animating || this.gameState.status !== "playing") {
      this.resetHintTimer();
      return;
    }

    const move = this.gameState.board.findAnyValidMove();
    if (move) {
      for (const cell of [move.a, move.b]) {
        const obj = this.candyObjects[cell.row]?.[cell.col];
        if (!obj) {
          continue;
        }
        this.hintTweens.push(
          this.tweens.add({
            targets: obj,
            scale: 1.15,
            duration: 180,
            yoyo: true,
            repeat: 3,
            ease: "Sine.InOut",
          }),
        );
      }
    }

    this.resetHintTimer();
  }

  /** Win -> Level Complete (stars animated in one by one, persisted via
   * completeLevel + saveProgress right here, confetti drop); on the final
   * level, a "you finished everything" state with only a Level Map button.
   * Lose -> Out of Moves with Try Again + Level Map. Both keep the map
   * always reachable. */
  private showEndOverlay(): void {
    const level = this.gameState.level;
    const won = this.gameState.status === "won";
    const isFinalLevel = level.id >= LEVEL_COUNT;
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    let starsEarned = 0;
    if (won) {
      starsEarned = starsForScore(level, this.gameState.score);
      const progress = loadProgress() ?? createInitialProgress();
      saveProgress(completeLevel(progress, level.id, this.gameState.score));
    }

    const elements: Phaser.GameObjects.GameObject[] = [];

    const backdrop = this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x4a3f5c, 0.55);
    elements.push(backdrop);

    if (won) {
      this.spawnConfetti();
    }

    const panelHeight = won ? 300 : 210;
    const panelTop = centerY - panelHeight / 2;
    const panelGraphics = this.add.graphics().setDepth(20);
    panelGraphics.fillStyle(THEME.overlayPanel.fill, 1);
    panelGraphics.fillRoundedRect(centerX - 135, centerY - panelHeight / 2, 270, panelHeight, 20);
    panelGraphics.lineStyle(3, THEME.overlayPanel.stroke, 1);
    panelGraphics.strokeRoundedRect(centerX - 135, centerY - panelHeight / 2, 270, panelHeight, 20);
    elements.push(panelGraphics);

    const title = won ? (isFinalLevel ? "All Levels Complete!" : `Level ${level.id} Complete!`) : "Out of Moves";
    const titleText = this.add
      .text(centerX, panelTop + 36, title, {
        fontFamily: "sans-serif",
        fontSize: isFinalLevel ? "20px" : "23px",
        color: THEME.overlayPanel.text,
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 236 },
      })
      .setOrigin(0.5);
    elements.push(titleText);

    const subtitle = won
      ? `Score: ${this.gameState.score}`
      : `Score: ${this.gameState.score} / ${this.gameState.targetScore}`;
    const subtitleText = this.add
      .text(centerX, panelTop + (isFinalLevel ? 68 : 72), subtitle, {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: THEME.overlayPanel.subtext,
      })
      .setOrigin(0.5);
    elements.push(subtitleText);

    if (won) {
      const starY = panelTop + 110;
      for (let i = 0; i < 3; i++) {
        const star = this.add
          .text(centerX + (i - 1) * 34, starY, "★", {
            fontFamily: "sans-serif",
            fontSize: "30px",
            color: "#e4d7ba",
          })
          .setOrigin(0.5);
        elements.push(star);
        if (i < starsEarned) {
          star.setScale(0.4);
          this.time.delayedCall(300 + i * 250, () => {
            star.setColor("#ffd700");
            this.tweens.add({ targets: star, scale: 1, duration: 220, ease: "Back.Out" });
          });
        }
      }
    }

    const primaryLabel = won ? (isFinalLevel ? "Level Map" : "Next Level") : "Try Again";
    const primaryY = panelTop + (won ? 160 : 110);
    const primaryButton = drawGlossyButton(this, centerX, primaryY, 180, 42, THEME.accent.primary, 0xffffff);
    const primaryHit = this.add
      .rectangle(centerX, primaryY, 180, 42, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    const primaryText = this.add
      .text(centerX, primaryY, primaryLabel, {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    elements.push(primaryButton, primaryHit, primaryText);

    primaryHit.on("pointerup", () => {
      if (won && isFinalLevel) {
        this.scene.start("LevelMapScene");
      } else if (won) {
        this.scene.start("BoardScene", { levelId: level.id + 1 });
      } else {
        this.scene.start("BoardScene", { levelId: level.id });
      }
    });

    if (!(won && isFinalLevel)) {
      const secondaryY = primaryY + 54;
      const secondaryButton = drawGlossyButton(this, centerX, secondaryY, 180, 38, 0xffffff, THEME.accent.primary);
      const secondaryHit = this.add
        .rectangle(centerX, secondaryY, 180, 38, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      const secondaryText = this.add
        .text(centerX, secondaryY, "Level Map", {
          fontFamily: "sans-serif",
          fontSize: "15px",
          color: THEME.overlayPanel.text,
        })
        .setOrigin(0.5);
      elements.push(secondaryButton, secondaryHit, secondaryText);
      secondaryHit.on("pointerup", () => this.scene.start("LevelMapScene"));
    }

    this.add.container(0, 0, elements).setDepth(20);
  }

  /** Confetti recolored to the vehicle palette, falling behind the win
   * panel (depth 19, just under the panel's depth 20). Fire-and-forget. */
  private spawnConfetti(): void {
    for (let i = 0; i < 26; i++) {
      const x = Phaser.Math.Between(16, this.scale.width - 16);
      const color = THEME.confetti[i % THEME.confetti.length];
      const piece = this.add
        .rectangle(x, -16, 6, 10, color)
        .setDepth(19)
        .setAngle(Phaser.Math.Between(0, 360));
      this.tweens.add({
        targets: piece,
        y: this.scale.height + 20,
        angle: piece.angle + Phaser.Math.Between(180, 540) * (i % 2 === 0 ? 1 : -1),
        duration: Phaser.Math.Between(900, 1600),
        delay: Phaser.Math.Between(0, 400),
        ease: "Cubic.In",
        onComplete: () => piece.destroy(),
      });
    }
  }
}
