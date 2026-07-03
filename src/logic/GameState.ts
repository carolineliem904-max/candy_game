import { Board, type Cell, type CascadeStep } from "./Board";
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

  constructor(config: GameStateConfig) {
    this.level = config.level;
    this._board = new Board(BOARD_COLS, BOARD_ROWS, mulberry32(config.seed), config.level.candyTypes);
    this._movesRemaining = config.level.maxMoves;
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

  /** Delegates to Board.swap. Failed swaps cost nothing; successful swaps
   * consume a move and score the cascade (fully, even past the win target).
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

    if (this._score >= this.targetScore) {
      this._status = "won";
    } else if (this._movesRemaining <= 0) {
      this._status = "lost";
    }

    return { ...result, scoreGained, status: this._status };
  }

  /** Restarts the same level with a fresh board. */
  reset(seed: number = Date.now()): void {
    this._board = new Board(BOARD_COLS, BOARD_ROWS, mulberry32(seed), this.level.candyTypes);
    this._score = 0;
    this._movesRemaining = this.maxMoves;
    this._status = "playing";
  }
}
