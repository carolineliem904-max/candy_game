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

const CANDY_COLORS: Record<CandyType, number> = {
  [CandyType.RED]: 0xe74c3c,
  [CandyType.ORANGE]: 0xe67e22,
  [CandyType.YELLOW]: 0xf1c40f,
  [CandyType.GREEN]: 0x2ecc71,
  [CandyType.BLUE]: 0x3498db,
  [CandyType.PURPLE]: 0x9b59b6,
};

const BOMB_COLOR = 0x1c1a24;
const STRIPE_COLOR = 0xffffff;
const WRAPPED_RING_COLOR = 0xffd700;

const SELECTION_COLOR = 0xffffff;
const EMPTY_SOCKET_COLOR = 0x13111d;
const MOVES_URGENT_THRESHOLD = 5;
const MOVES_URGENT_COLOR = "#ff4d4d";
const MOVES_NORMAL_COLOR = "#ffffff";

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

    this.add
      .rectangle(
        this.scale.width / 2,
        HUD_HEIGHT + (boardPixelSize + BOARD_MARGIN) / 2,
        boardPixelSize + BOARD_MARGIN,
        boardPixelSize + BOARD_MARGIN,
        0x2b2640,
      )
      .setStrokeStyle(2, 0x453f63);

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

  private createHud(): void {
    const centerX = this.scale.width / 2;
    this.scoreText = this.add
      .text(centerX, 15, "", {
        fontFamily: "sans-serif",
        fontSize: "15px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.movesText = this.add
      .text(centerX, 35, "", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: MOVES_NORMAL_COLOR,
      })
      .setOrigin(0.5);
  }

  private createMuteButton(): void {
    this.muteButton = this.add
      .text(this.scale.width - 10, 8, "🔊", { fontSize: "16px" })
      .setOrigin(1, 0)
      .setDepth(15)
      .setInteractive({ useHandCursor: true });

    this.muteButton.on("pointerup", () => {
      const muted = this.soundEngine.toggleMuted();
      this.muteButton.setText(muted ? "🔇" : "🔊");
    });
  }

  private createMapButton(): void {
    this.mapButton = this.add
      .text(10, 8, "☰ Map", { fontFamily: "sans-serif", fontSize: "12px", color: "#ffffff" })
      .setOrigin(0, 0)
      .setDepth(15)
      .setInteractive({ useHandCursor: true });

    this.mapButton.on("pointerup", () => this.scene.start("LevelMapScene"));
  }

  private updateHud(): void {
    const level = this.gameState.level;
    this.scoreText.setText(`Level ${level.id} · Score: ${this.gameState.score} / ${this.gameState.targetScore}`);
    const moves = this.gameState.movesRemaining;
    this.movesText.setText(`Moves left: ${moves}`);
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
          const socket = this.add.circle(x, y, socketRadius, EMPTY_SOCKET_COLOR).setStrokeStyle(2, 0x2b2640);
          this.boardLayer.add(socket);
          this.candyObjects[row][col] = null;
          continue;
        }

        const candy = this.drawCandyVisual(x, y, cell);
        this.boardLayer.add(candy);
        this.candyObjects[row][col] = candy;
      }
    }
  }

  /** Builds a candy's visual as a Container so specials can layer distinct,
   * still-programmatic decoration on top of the base circle: striped gets a
   * stripe bar (oriented H/V), wrapped gets a second gold ring, a color bomb
   * is a dark multi-dot circle instead of a colored one. The base circle's
   * fill color is stashed via setData so callers (e.g. the clear-burst
   * particles) don't need to know which special this is. */
  private drawCandyVisual(x: number, y: number, cell: Candy): Phaser.GameObjects.Container {
    const radius = (CELL_SIZE - CELL_PADDING * 2) / 2;
    const color = cell.special === "bomb" ? BOMB_COLOR : CANDY_COLORS[cell.type as CandyType];

    const container = this.add.container(x, y);
    const base = this.add.circle(0, 0, radius, color).setStrokeStyle(2, 0x1e1a2e);
    container.add(base);
    container.setData("color", color);

    switch (cell.special) {
      case "stripedH":
        container.add(this.add.rectangle(0, 0, radius * 1.7, 5, STRIPE_COLOR).setAlpha(0.9));
        break;
      case "stripedV":
        container.add(this.add.rectangle(0, 0, 5, radius * 1.7, STRIPE_COLOR).setAlpha(0.9));
        break;
      case "wrapped":
        container.add(this.add.circle(0, 0, radius + 3, 0x000000, 0).setStrokeStyle(3, WRAPPED_RING_COLOR));
        break;
      case "bomb": {
        const dots = [
          [-5, -5],
          [5, -5],
          [0, 0],
          [-5, 5],
          [5, 5],
        ];
        for (const [dx, dy] of dots) {
          container.add(this.add.circle(dx, dy, 2.5, 0xffffff).setAlpha(0.85));
        }
        break;
      }
      default:
        break;
    }

    return container;
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
   * concurrently: a row/column flash sweep for striped, an expanding ring
   * for wrapped, per-candy zaps staggered across the cleared set for a
   * color bomb (total stagger time capped so a huge bomb clear can't blow
   * the ~4s budget). */
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
      const rect = this.add
        .rectangle(
          horizontal ? this.offsetX + boardPixelW / 2 : x,
          horizontal ? y : this.offsetY + boardPixelH / 2,
          horizontal ? boardPixelW : CELL_SIZE * 0.6,
          horizontal ? CELL_SIZE * 0.6 : boardPixelH,
          STRIPE_COLOR,
        )
        .setAlpha(0)
        .setDepth(8);
      this.boardLayer.add(rect);
      await this.tweenAsync({ targets: rect, alpha: 0.55, duration: ACTIVATION_DURATION * 0.35 * scale, yoyo: true });
      rect.destroy();
      return;
    }

    if (activation.special === "wrapped") {
      this.soundEngine.wrapped();
      const ring = this.add.circle(x, y, CELL_SIZE * 0.3, 0x000000, 0).setStrokeStyle(4, WRAPPED_RING_COLOR).setDepth(8);
      this.boardLayer.add(ring);
      ring.setAlpha(1);
      await this.tweenAsync({ targets: ring, scale: 2.2, alpha: 0, duration: ACTIVATION_DURATION * scale, ease: "Cubic.Out" });
      ring.destroy();
      return;
    }

    // bomb
    this.soundEngine.bomb();
    const cells = activation.cellsCleared;
    const perCellDelay = cells.length > 0 ? Math.min(30, BOMB_ZAP_TOTAL_MS / cells.length) * scale : 0;
    await Promise.all(
      cells.map(
        (cell, i) =>
          new Promise<void>((resolve) => {
            this.time.delayedCall(i * perCellDelay, () => {
              const p = this.cellCenter(cell.col, cell.row);
              const zap = this.add.circle(p.x, p.y, 6, 0xffffff).setAlpha(0.9).setDepth(8);
              this.boardLayer.add(zap);
              this.tweens.add({
                targets: zap,
                scale: 2,
                alpha: 0,
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
        const old = this.candyObjects[creation.cell.row]?.[creation.cell.col];
        old?.destroy();

        const { x, y } = this.cellCenter(creation.cell.col, creation.cell.row);
        const visual = this.drawCandyVisual(x, y, { type: creation.type, special: creation.special });
        this.boardLayer.add(visual);
        this.candyObjects[creation.cell.row][creation.cell.col] = visual;
        visual.setScale(0.3);

        return this.tweenAsync({ targets: visual, scale: 1.15, duration: SPECIAL_CREATED_DURATION, ease: "Back.Out" }).then(
          () => this.tweenAsync({ targets: visual, scale: 1, duration: SPECIAL_CREATED_DURATION * 0.6 }),
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
      obj?.destroy();
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
        const obj = this.drawCandyVisual(x, startY, { type: spawn.type, special: null });
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
    this.selectionRing = this.add.circle(x, y, radius).setStrokeStyle(3, SELECTION_COLOR);
    this.selectionTween = this.tweens.add({
      targets: this.selectionRing,
      scale: 1.15,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  private clearSelection(): void {
    this.selected = null;
    this.selectionTween?.stop();
    this.selectionTween = null;
    this.selectionRing?.destroy();
    this.selectionRing = null;
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
   * completeLevel + saveProgress right here); on the final level, a "you
   * finished everything" state with only a Level Map button. Lose -> Out of
   * Moves with Try Again + Level Map. Both keep the map always reachable. */
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

    const backdrop = this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.72);
    elements.push(backdrop);

    const panelHeight = won ? 300 : 210;
    const panelTop = centerY - panelHeight / 2;
    const panel = this.add
      .rectangle(centerX, centerY, 270, panelHeight, 0x2b2640, 0.97)
      .setStrokeStyle(2, 0x6b4fbb);
    elements.push(panel);

    const title = won ? (isFinalLevel ? "All Levels Complete!" : `Level ${level.id} Complete!`) : "Out of Moves";
    const titleText = this.add
      .text(centerX, panelTop + 36, title, {
        fontFamily: "sans-serif",
        fontSize: isFinalLevel ? "20px" : "23px",
        color: "#ffffff",
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
        color: "#e6e1f5",
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
            color: "#4a4560",
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
    const primaryBg = this.add
      .rectangle(centerX, primaryY, 180, 42, 0x6b4fbb)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });
    const primaryText = this.add
      .text(centerX, primaryY, primaryLabel, {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    elements.push(primaryBg, primaryText);

    primaryBg.on("pointerup", () => {
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
      const secondaryBg = this.add
        .rectangle(centerX, secondaryY, 180, 38, 0x3a3550)
        .setStrokeStyle(2, 0x6b4fbb)
        .setInteractive({ useHandCursor: true });
      const secondaryText = this.add
        .text(centerX, secondaryY, "Level Map", {
          fontFamily: "sans-serif",
          fontSize: "15px",
          color: "#e6e1f5",
        })
        .setOrigin(0.5);
      elements.push(secondaryBg, secondaryText);
      secondaryBg.on("pointerup", () => this.scene.start("LevelMapScene"));
    }

    this.add.container(0, 0, elements).setDepth(20);
  }
}
