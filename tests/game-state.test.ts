import { describe, expect, it } from "vitest";
import { GameState } from "../src/logic/GameState";
import { CandyType } from "../src/logic/CandyType";
import { BOARD_COLS, BOARD_ROWS } from "../src/logic/constants";
import { scoreForSteps } from "../src/logic/ScoreRules";
import { allNull, applyLayout, makeLevel, snapshot } from "./helpers";

const R = CandyType.RED;
const O = CandyType.ORANGE;

function inertFilledLayout(): (CandyType | null)[][] {
  const layout = allNull(BOARD_COLS, BOARD_ROWS);
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      layout[row][col] = ((col + row) % 3) as CandyType;
    }
  }
  return layout;
}

/** A layout with a single guaranteed 3-match at (0,0)-(2,0) via swapping
 * (2,0) and (2,1), and no other matches anywhere else on the board. */
function singleMatchLayout(): (CandyType | null)[][] {
  const layout = inertFilledLayout();
  layout[0][0] = R;
  layout[0][1] = R;
  layout[0][2] = O;
  layout[1][2] = R;
  return layout;
}

/** Column 0: two O's above a pre-existing R-run, one O below -> a guaranteed
 * 2-step cascade (see tests/board-cascade.test.ts for the derivation). Any
 * adjacent swap elsewhere triggers it, since Board.swap checks for matches
 * globally. Total score: step1 3*60*1=180, step2 3*60*2=360, total 540. */
function twoStepCascadeLayout(): (CandyType | null)[][] {
  const layout = inertFilledLayout();
  layout[0][0] = O;
  layout[1][0] = O;
  layout[2][0] = R;
  layout[3][0] = R;
  layout[4][0] = R;
  layout[5][0] = O;
  return layout;
}

/** A layout where swapping the given pair creates no match. */
function noMatchLayout(): (CandyType | null)[][] {
  return inertFilledLayout();
}

describe("GameState.attemptSwap", () => {
  it("does not consume a move on a failed swap", () => {
    const game = new GameState({ level: makeLevel({ targetScore: 100000, maxMoves: 10 }), seed: 1 });
    applyLayout(game.board, noMatchLayout());

    const before = game.movesRemaining;
    const result = game.attemptSwap({ col: 0, row: 6 }, { col: 0, row: 7 });

    expect(result.ok).toBe(false);
    expect(game.movesRemaining).toBe(before);
    expect(game.status).toBe("playing");
    expect(game.score).toBe(0);
  });

  it("consumes exactly one move on a successful swap", () => {
    const game = new GameState({ level: makeLevel({ targetScore: 100000, maxMoves: 10 }), seed: 1 });
    applyLayout(game.board, singleMatchLayout());

    const result = game.attemptSwap({ col: 2, row: 0 }, { col: 2, row: 1 });

    expect(result.ok).toBe(true);
    expect(game.movesRemaining).toBe(9);
    expect(game.status).toBe("playing");
  });

  it("sets status 'won' once score crosses targetScore, and rejects further swaps", () => {
    const game = new GameState({ level: makeLevel({ targetScore: 100, maxMoves: 10 }), seed: 1 });
    applyLayout(game.board, singleMatchLayout());

    const result = game.attemptSwap({ col: 2, row: 0 }, { col: 2, row: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The guaranteed match is 3 cells at step1 (x1); refill may coincidentally
    // trigger further cascade steps, so compare against the same ScoreRules
    // formula rather than a hardcoded total (see scoreForSteps below).
    expect(result.scoreGained).toBeGreaterThanOrEqual(3 * 60);
    expect(result.scoreGained).toBe(scoreForSteps(result.steps));
    expect(game.score).toBe(result.scoreGained);
    expect(game.status).toBe("won");

    const rejected = game.attemptSwap({ col: 3, row: 3 }, { col: 4, row: 3 });
    expect(rejected).toEqual({ ok: false, reason: "game-over" });
    expect(game.score).toBe(result.scoreGained);
  });

  it("counts a winning move's full cascade even past the target mid-cascade", () => {
    // Target of 100 is crossed by step1 alone (>=180); the cascade continues
    // to step2 anyway (a guaranteed 2-step minimum by construction), and the
    // final score must reflect every step in full, not just enough to cross
    // the target. Verified against the independent scoreForSteps formula
    // rather than a hardcoded total, since refill may add further steps.
    const game = new GameState({ level: makeLevel({ targetScore: 100, maxMoves: 10 }), seed: 1 });
    applyLayout(game.board, twoStepCascadeLayout());

    // Any adjacent swap in the inert filler triggers the pre-set cascade,
    // since Board.swap checks for matches across the whole board.
    const result = game.attemptSwap({ col: 6, row: 6 }, { col: 7, row: 6 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect(result.scoreGained).toBe(scoreForSteps(result.steps));
    expect(result.scoreGained).toBeGreaterThan(100);
    expect(game.score).toBe(result.scoreGained);
    expect(game.status).toBe("won");
  });

  it("sets status 'lost' when moves run out below target, and rejects further swaps", () => {
    const game = new GameState({ level: makeLevel({ targetScore: 1_000_000, maxMoves: 1 }), seed: 1 });
    applyLayout(game.board, singleMatchLayout());

    const result = game.attemptSwap({ col: 2, row: 0 }, { col: 2, row: 1 });
    expect(result.ok).toBe(true);

    expect(game.movesRemaining).toBe(0);
    expect(game.status).toBe("lost");

    const rejected = game.attemptSwap({ col: 3, row: 3 }, { col: 4, row: 3 });
    expect(rejected).toEqual({ ok: false, reason: "game-over" });
  });
});

describe("GameState.reset", () => {
  it("returns to a fresh playable state with a new board", () => {
    const game = new GameState({ level: makeLevel({ targetScore: 100, maxMoves: 1 }), seed: 1 });
    applyLayout(game.board, singleMatchLayout());
    game.attemptSwap({ col: 2, row: 0 }, { col: 2, row: 1 });
    expect(game.status).not.toBe("playing");

    game.reset(999);

    expect(game.status).toBe("playing");
    expect(game.score).toBe(0);
    expect(game.movesRemaining).toBe(game.maxMoves);
    expect(game.board.findMatches()).toHaveLength(0);
    expect(game.board.hasAnyValidMove()).toBe(true);
  });

  it("accepts an omitted seed for a fresh random board", () => {
    const game = new GameState({ level: makeLevel({ targetScore: 100, maxMoves: 1 }), seed: 1 });
    expect(() => game.reset()).not.toThrow();
    expect(game.status).toBe("playing");
    expect(game.score).toBe(0);
  });
});

describe("GameState with different LevelDefs", () => {
  it("generates a board using only the level's candyTypes count", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const game = new GameState({ level: makeLevel({ candyTypes: 5 }), seed });
      const grid = snapshot(game.board);
      expect(grid.flat().every((cell) => cell === null || cell < 5)).toBe(true);
    }
  });

  it("still generates a fully-typed board when candyTypes is 6", () => {
    const game = new GameState({ level: makeLevel({ candyTypes: 6 }), seed: 1 });
    expect(game.board.findMatches()).toHaveLength(0);
    expect(game.board.hasAnyValidMove()).toBe(true);
  });

  it("carries the level's targetScore/maxMoves", () => {
    const game = new GameState({ level: makeLevel({ targetScore: 4242, maxMoves: 7 }), seed: 1 });
    expect(game.targetScore).toBe(4242);
    expect(game.maxMoves).toBe(7);
    expect(game.movesRemaining).toBe(7);
  });
});
