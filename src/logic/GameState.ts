import { Board, type Cell, type CascadeStep } from "./Board";
import { CandyType } from "./CandyType";
import { BOARD_COLS, BOARD_ROWS } from "./constants";
import type { LevelDef } from "./LevelDef";
import { mulberry32 } from "./rng";
import { scoreForSteps } from "./ScoreRules";

export interface GameStateConfig {
  level: LevelDef;
  seed: number;
}

export type GameStatus = "playing" | "won" | "lost";

export type GameSwapResult =
  | { ok: true; steps: CascadeStep[]; reshuffled: boolean; scoreGained: number; status: GameStatus }
  | { ok: false; reason: "not-adjacent" | "empty-cell" | "no-match" | "game-over" };

/** Wraps a Board with score, moves, and win/lose state for a single level playthrough. */
export class GameState {
  readonly level: LevelDef;

  private _board: Board;
  private _score = 0;
  private _movesRemaining: number;
  private _status: GameStatus = "playing";
  /** Live remaining-count copy of a "collect" goal's targets, decremented as
   * matching pieces clear; unused (stays empty) for other goal kinds. */
  private _collectRemaining: Partial<Record<CandyType, number>>;

  constructor(config: GameStateConfig) {
    this.level = config.level;
    const goal = config.level.goal;
    this._board = new Board(
      BOARD_COLS,
      BOARD_ROWS,
      mulberry32(config.seed),
      config.level.candyTypes,
      goal.kind === "jelly" ? goal.jellyCells : [],
    );
    this._movesRemaining = config.level.maxMoves;
    this._collectRemaining = goal.kind === "collect" ? { ...goal.pieces } : {};
  }

  get targetScore(): number {
    return this.level.targetScore;
  }

  get maxMoves(): number {
    return this.level.maxMoves;
  }

  get board(): Board {
    return this._board;
  }

  get score(): number {
    return this._score;
  }

  get movesRemaining(): number {
    return this._movesRemaining;
  }

  get status(): GameStatus {
    return this._status;
  }

  /** Remaining counts for a "collect" goal (empty for other goal kinds). A
   * copy — mutating it has no effect on game state. */
  get collectRemaining(): Partial<Record<CandyType, number>> {
    return { ...this._collectRemaining };
  }

  /** Cells still carrying jelly (0 for non-jelly goals, since the board
   * never had any). */
  get jellyRemaining(): number {
    return this._board.jellyRemaining();
  }

  /** Delegates to Board.swap. Failed swaps cost nothing; successful swaps
   * consume a move, score the cascade (fully, even past the win target),
   * and tally any goal-specific progress (collected pieces, jelly cleared).
   * Rejected once the game is no longer 'playing'. */
  attemptSwap(a: Cell, b: Cell): GameSwapResult {
    if (this._status !== "playing") {
      return { ok: false, reason: "game-over" };
    }

    const result = this._board.swap(a, b);
    if (!result.ok) {
      return result;
    }

    this._movesRemaining -= 1;
    const scoreGained = scoreForSteps(result.steps);
    this._score += scoreGained;
    this.tallyCollected(result.steps);

    if (this.isGoalMet()) {
      this._status = "won";
    } else if (this._movesRemaining <= 0) {
      this._status = "lost";
    }

    return { ...result, scoreGained, status: this._status };
  }

  /** Every cleared piece of a tracked type counts, regardless of how it
   * cleared (color match, special activation sweep, or a further cascade
   * step) — `clearedCandies` already carries type info per cleared cell. */
  private tallyCollected(steps: CascadeStep[]): void {
    if (this.level.goal.kind !== "collect") {
      return;
    }
    for (const step of steps) {
      for (const { type } of step.clearedCandies) {
        if (type !== null && this._collectRemaining[type] !== undefined) {
          this._collectRemaining[type] = Math.max(0, (this._collectRemaining[type] ?? 0) - 1);
        }
      }
    }
  }

  private isGoalMet(): boolean {
    switch (this.level.goal.kind) {
      case "score":
        return this._score >= this.targetScore;
      case "collect":
        return Object.values(this._collectRemaining).every((remaining) => (remaining ?? 0) <= 0);
      case "jelly":
        return this._board.jellyRemaining() === 0;
    }
  }

  /** Restarts the same level with a fresh board. */
  reset(seed: number = Date.now()): void {
    const goal = this.level.goal;
    this._board = new Board(
      BOARD_COLS,
      BOARD_ROWS,
      mulberry32(seed),
      this.level.candyTypes,
      goal.kind === "jelly" ? goal.jellyCells : [],
    );
    this._score = 0;
    this._movesRemaining = this.maxMoves;
    this._status = "playing";
    this._collectRemaining = goal.kind === "collect" ? { ...goal.pieces } : {};
  }
}
