import { describe, expect, it } from "vitest";
import { GameState } from "../src/logic/GameState";
import { CandyType } from "../src/logic/CandyType";
import { BOARD_COLS, BOARD_ROWS } from "../src/logic/constants";
import { allNull, applyLayout, makeLevel } from "./helpers";

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

/** A layout with a single guaranteed 3-match of RED at (0,0)-(2,0) via
 * swapping (2,0) and (2,1), and no other matches anywhere else. Same
 * fixture shape as tests/game-state.test.ts. */
function singleRedMatchLayout(): (CandyType | null)[][] {
  const layout = inertFilledLayout();
  layout[0][0] = R;
  layout[0][1] = R;
  layout[0][2] = O;
  layout[1][2] = R;
  return layout;
}

describe("GameState collect goal", () => {
  it("wins once every tracked type's count is reached, with moves to spare", () => {
    const level = makeLevel({ maxMoves: 10, goal: { kind: "collect", pieces: { [R]: 3 } } });
    const game = new GameState({ level, seed: 1 });
    applyLayout(game.board, singleRedMatchLayout());

    const result = game.attemptSwap({ col: 2, row: 0 }, { col: 2, row: 1 });

    expect(result.ok).toBe(true);
    expect(game.collectRemaining[R]).toBe(0);
    expect(game.status).toBe("won");
    expect(game.movesRemaining).toBeGreaterThan(0);
  });

  it("tallies cleared pieces across cascade steps, not just the first", () => {
    const level = makeLevel({ maxMoves: 10, goal: { kind: "collect", pieces: { [R]: 3 } } });
    const game = new GameState({ level, seed: 1 });
    applyLayout(game.board, singleRedMatchLayout());

    expect(game.collectRemaining[R]).toBe(3);
    const result = game.attemptSwap({ col: 2, row: 0 }, { col: 2, row: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const redCleared = result.steps.flatMap((s) => s.clearedCandies).filter((c) => c.type === R).length;
    expect(game.collectRemaining[R]).toBe(Math.max(0, 3 - redCleared));
  });

  it("does not win while any tracked type still has remaining count, and loses when moves run out", () => {
    const level = makeLevel({ maxMoves: 1, goal: { kind: "collect", pieces: { [R]: 1000 } } });
    const game = new GameState({ level, seed: 1 });
    applyLayout(game.board, singleRedMatchLayout());

    const result = game.attemptSwap({ col: 2, row: 0 }, { col: 2, row: 1 });
    expect(result.ok).toBe(true);
    expect(game.status).toBe("lost");
  });

  it("ignores untracked colors — clearing them doesn't affect remaining counts", () => {
    const level = makeLevel({ maxMoves: 10, goal: { kind: "collect", pieces: { [O]: 3 } } });
    const game = new GameState({ level, seed: 1 });
    applyLayout(game.board, singleRedMatchLayout());

    const before = game.collectRemaining[O];
    game.attemptSwap({ col: 2, row: 0 }, { col: 2, row: 1 }); // clears RED, not ORANGE
    expect(game.collectRemaining[O]).toBe(before);
    expect(game.status).toBe("playing");
  });
});

describe("GameState jelly goal", () => {
  it("wins once all jelly is cleared", () => {
    const level = makeLevel({ maxMoves: 10, goal: { kind: "jelly", jellyCells: [{ col: 0, row: 0 }] } });
    const game = new GameState({ level, seed: 1 });
    applyLayout(game.board, singleRedMatchLayout());

    expect(game.jellyRemaining).toBe(1);
    const result = game.attemptSwap({ col: 2, row: 0 }, { col: 2, row: 1 });

    expect(result.ok).toBe(true);
    expect(game.jellyRemaining).toBe(0);
    expect(game.status).toBe("won");
  });

  it("stays in play while jelly remains uncleared, and loses when moves run out", () => {
    const level = makeLevel({
      maxMoves: 1,
      goal: { kind: "jelly", jellyCells: [{ col: 7, row: 7 }] }, // far from the match
    });
    const game = new GameState({ level, seed: 1 });
    applyLayout(game.board, singleRedMatchLayout());

    const result = game.attemptSwap({ col: 2, row: 0 }, { col: 2, row: 1 });
    expect(result.ok).toBe(true);
    expect(game.jellyRemaining).toBe(1);
    expect(game.status).toBe("lost");
  });

  it("reset() restores the level's original jelly layout", () => {
    const level = makeLevel({ maxMoves: 10, goal: { kind: "jelly", jellyCells: [{ col: 0, row: 0 }] } });
    const game = new GameState({ level, seed: 1 });
    applyLayout(game.board, singleRedMatchLayout());
    game.attemptSwap({ col: 2, row: 0 }, { col: 2, row: 1 });
    expect(game.jellyRemaining).toBe(0);

    game.reset(2);

    expect(game.jellyRemaining).toBe(1);
    expect(game.status).toBe("playing");
  });
});

describe("GameState score goal (regression)", () => {
  it("still uses score as the win condition and ignores collect/jelly state", () => {
    const level = makeLevel({ targetScore: 100, maxMoves: 10, goal: { kind: "score" } });
    const game = new GameState({ level, seed: 1 });
    applyLayout(game.board, singleRedMatchLayout());

    const result = game.attemptSwap({ col: 2, row: 0 }, { col: 2, row: 1 });
    expect(result.ok).toBe(true);
    expect(game.status).toBe("won");
    expect(game.collectRemaining).toEqual({});
    expect(game.jellyRemaining).toBe(0);
  });
});

describe("Determinism with goals", () => {
  it("identical seed + goal + swap sequence produce identical collectRemaining/jellyRemaining/status", () => {
    const run = () => {
      const level = makeLevel({
        maxMoves: 20,
        goal: { kind: "collect", pieces: { [R]: 5, [O]: 5 } },
      });
      const game = new GameState({ level, seed: 42 });
      const outcomes = [];
      for (let i = 0; i < 15; i++) {
        const move = game.board.findAnyValidMove();
        if (!move || game.status !== "playing") break;
        game.attemptSwap(move.a, move.b);
        outcomes.push({ status: game.status, collectRemaining: game.collectRemaining, score: game.score });
      }
      return outcomes;
    };

    expect(run()).toEqual(run());
  });
});
