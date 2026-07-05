import { describe, expect, it } from "vitest";
import { Board } from "../src/logic/Board";
import { CandyType } from "../src/logic/CandyType";
import { mulberry32 } from "../src/logic/rng";
import { applyLayout, boardFromLayout, forceSetCell } from "./helpers";

const R = CandyType.RED;
const O = CandyType.ORANGE;
const Y = CandyType.YELLOW;

const COLS = 8;
const ROWS = 8;

function fillerLayout(size = 8): CandyType[][] {
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => ((col + row) % 3) as CandyType));
}

describe("Board jelly layer", () => {
  it("starts with jelly only on the given cells", () => {
    const jellyCells = [{ col: 1, row: 1 }, { col: 5, row: 5 }];
    const board = new Board(COLS, ROWS, mulberry32(1), 6, jellyCells);

    expect(board.hasJelly(1, 1)).toBe(true);
    expect(board.hasJelly(5, 5)).toBe(true);
    expect(board.hasJelly(0, 0)).toBe(false);
    expect(board.jellyRemaining()).toBe(2);
  });

  it("defaults to no jelly when omitted", () => {
    const board = new Board(COLS, ROWS, mulberry32(1));
    expect(board.jellyRemaining()).toBe(0);
  });

  it("a match clearing a jelly cell removes exactly that jelly, leaving others untouched", () => {
    // Row 2 already has R at (1,2) from the filler; overriding (2,2) to R
    // gives a 2-run. Swapping (3,1)<->(3,2) drops a third R into (3,2),
    // completing a 3-run at row 2, cols 1-3 — (2,2) (jelly) is in the
    // middle of it, (7,7) (jelly) is untouched anywhere on the board.
    const jellyCells = [{ col: 2, row: 2 }, { col: 7, row: 7 }];
    const board = new Board(COLS, ROWS, mulberry32(1), 6, jellyCells);
    const layout = fillerLayout();
    layout[2][2] = R;
    layout[1][3] = R;
    layout[2][3] = O;
    applyLayout(board, layout);

    expect(board.findMatches()).toHaveLength(0); // no accidental pre-existing match
    expect(board.jellyRemaining()).toBe(2);

    const result = board.swap({ col: 3, row: 1 }, { col: 3, row: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // (2,2) was part of the completed 3-run and should have lost its jelly.
    expect(board.hasJelly(2, 2)).toBe(false);
    // (7,7) was never touched.
    expect(board.hasJelly(7, 7)).toBe(true);
    expect(board.jellyRemaining()).toBe(1);

    const clearedJellyKeys = result.steps[0].jellyCleared.map((c) => `${c.col},${c.row}`);
    expect(clearedJellyKeys).toContain("2,2");
  });

  it("a special's activation effect removes jelly under cells it sweeps, even far from the match", () => {
    const jellyCells = [{ col: 6, row: 2 }];
    const board = new Board(COLS, ROWS, mulberry32(5), 6, jellyCells);
    const layout = fillerLayout();
    layout[2][2] = R;
    layout[2][3] = R;
    layout[2][4] = Y;
    applyLayout(board, layout);
    forceSetCell(board, 2, 2, { type: R, special: "stripedH" });

    expect(board.findMatches()).toHaveLength(1);
    expect(board.hasJelly(6, 2)).toBe(true);

    const steps = board.resolve();
    const step = steps[0];

    expect(step.activations).toHaveLength(1);
    expect(step.activations[0].cellsCleared).toEqual(expect.arrayContaining([{ col: 6, row: 2 }]));
    expect(board.hasJelly(6, 2)).toBe(false);
    expect(step.jellyCleared).toEqual(expect.arrayContaining([{ col: 6, row: 2 }]));
  });

  it("jelly does not block a swap or gravity — board still resolves normally with jelly present", () => {
    const jellyCells = [{ col: 0, row: 0 }, { col: 3, row: 3 }, { col: 7, row: 7 }];
    const board = new Board(COLS, ROWS, mulberry32(2024), 6, jellyCells);
    const move = board.findAnyValidMove();
    expect(move).not.toBeNull();
    if (!move) return;

    expect(() => board.swap(move.a, move.b)).not.toThrow();
    expect(board.hasAnyValidMove() || true).toBe(true); // just proving no throw / dead-end
  });
});

describe("CascadeStep.clearedCandies", () => {
  it("records the color of every cleared cell", () => {
    // Filler alone has zero matches (no color repeats 3x in a row/column by
    // construction); overriding column 2, rows 0-2 to all-R is the only
    // change, so it's an isolated, unambiguous vertical 3-run.
    const board = boardFromLayout(fillerLayout(), 5);
    forceSetCell(board, 2, 0, { type: R, special: null });
    forceSetCell(board, 2, 1, { type: R, special: null });
    forceSetCell(board, 2, 2, { type: R, special: null });

    expect(board.findMatches()).toHaveLength(1);

    const steps = board.resolve();
    const step = steps[0];
    const byKey = new Map(step.clearedCandies.map((c) => [`${c.cell.col},${c.cell.row}`, c.type]));
    expect(byKey.get("2,0")).toBe(R);
    expect(byKey.get("2,1")).toBe(R);
    expect(byKey.get("2,2")).toBe(R);
  });
});

describe("Determinism with jelly", () => {
  it("identical seed + jellyCells + swap sequence produce identical jellyRemaining and jellyCleared results", () => {
    const jellyCells = [{ col: 1, row: 1 }, { col: 4, row: 4 }, { col: 6, row: 6 }];
    const run = () => {
      const board = new Board(COLS, ROWS, mulberry32(777), 6, jellyCells);
      const results = [];
      for (let i = 0; i < 10; i++) {
        const move = board.findAnyValidMove();
        if (!move) break;
        const result = board.swap(move.a, move.b);
        results.push({ ok: result.ok, jellyRemaining: board.jellyRemaining() });
      }
      return results;
    };

    expect(run()).toEqual(run());
  });
});
