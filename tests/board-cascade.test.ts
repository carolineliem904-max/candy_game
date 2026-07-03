import { describe, expect, it } from "vitest";
import { Board } from "../src/logic/Board";
import { CandyType } from "../src/logic/CandyType";
import { mulberry32 } from "../src/logic/rng";
import { allNull, boardFromLayout, colorAt, colorSnapshot, snapshot } from "./helpers";

const COLS = 8;
const ROWS = 8;

const R = CandyType.RED;
const O = CandyType.ORANGE;
const Y = CandyType.YELLOW;

describe("Board.applyGravity", () => {
  it("drops a single hole to the top of its column", () => {
    const layout = allNull(3, 5);
    layout[0][0] = R;
    layout[1][0] = O;
    layout[2][0] = null;
    layout[3][0] = Y;
    layout[4][0] = CandyType.GREEN;
    const board = boardFromLayout(layout);

    const moves = board.applyGravity();

    expect(moves).toEqual(
      expect.arrayContaining([
        { from: { col: 0, row: 1 }, to: { col: 0, row: 2 } },
        { from: { col: 0, row: 0 }, to: { col: 0, row: 1 } },
      ]),
    );
    expect(moves).toHaveLength(2);

    const col0 = [0, 1, 2, 3, 4].map((row) => colorAt(board, 0, row));
    expect(col0).toEqual([null, R, O, Y, CandyType.GREEN]);
  });

  it("compacts multiple holes in the same column to the top, preserving order", () => {
    const layout = allNull(3, 5);
    layout[0][0] = null;
    layout[1][0] = R;
    layout[2][0] = null;
    layout[3][0] = O;
    layout[4][0] = null;
    const board = boardFromLayout(layout);

    board.applyGravity();

    const col0 = [0, 1, 2, 3, 4].map((row) => colorAt(board, 0, row));
    expect(col0).toEqual([null, null, null, R, O]);
  });

  it("leaves a fully empty column empty, with no moves", () => {
    const layout = allNull(3, 5);
    const board = boardFromLayout(layout);

    const moves = board.applyGravity();

    expect(moves).toHaveLength(0);
    const col0 = [0, 1, 2, 3, 4].map((row) => colorAt(board, 0, row));
    expect(col0).toEqual([null, null, null, null, null]);
  });

  it("resolves holes in multiple columns independently, without candies drifting sideways", () => {
    const layout = allNull(3, 4);
    // col0: hole at top only
    layout[0][0] = null;
    layout[1][0] = R;
    layout[2][0] = O;
    layout[3][0] = Y;
    // col1: hole in the middle
    layout[0][1] = R;
    layout[1][1] = null;
    layout[2][1] = O;
    layout[3][1] = Y;
    // col2: no holes at all
    layout[0][2] = R;
    layout[1][2] = O;
    layout[2][2] = Y;
    layout[3][2] = CandyType.GREEN;
    const board = boardFromLayout(layout);

    board.applyGravity();

    expect([0, 1, 2, 3].map((row) => colorAt(board, 0, row))).toEqual([null, R, O, Y]);
    expect([0, 1, 2, 3].map((row) => colorAt(board, 1, row))).toEqual([null, R, O, Y]);
    expect([0, 1, 2, 3].map((row) => colorAt(board, 2, row))).toEqual([R, O, Y, CandyType.GREEN]);
  });
});

describe("Board.refill", () => {
  it("leaves zero EMPTY cells after gravity + refill, spawning exactly the holes", () => {
    const layout = allNull(6, 6);
    layout[5][0] = R;
    layout[3][0] = O;
    layout[5][1] = CandyType.GREEN;
    const board = boardFromLayout(layout, 7);

    board.applyGravity();
    const spawns = board.refill();

    const grid = snapshot(board);
    expect(grid.flat().every((cell) => cell !== null)).toBe(true);
    expect(spawns).toHaveLength(6 * 6 - 3);
    for (const spawn of spawns) {
      expect(colorAt(board, spawn.cell.col, spawn.cell.row)).toBe(spawn.type);
    }
  });
});

describe("Board.resolve", () => {
  it("resolves a known 2-step cascade with the expected first-step match", () => {
    // 6x6 board. Columns 1-5 are an inert filler pattern ((c+r)%3, using types
    // that never repeat 3-in-a-row) so they're never touched by clear/gravity/
    // refill, isolating the cascade to column 0.
    const layout = allNull(6, 6);
    for (let row = 0; row < 6; row++) {
      for (let col = 1; col < 6; col++) {
        layout[row][col] = ((col + row) % 3) as CandyType;
      }
    }
    // Column 0: two O's above a pre-existing R-run, one O below it. Clearing
    // the R-run and letting gravity run pulls all three O's together.
    layout[0][0] = O;
    layout[1][0] = O;
    layout[2][0] = R;
    layout[3][0] = R;
    layout[4][0] = R;
    layout[5][0] = O;
    const board = boardFromLayout(layout, 123);

    expect(board.findMatches()).toHaveLength(1);

    const steps = board.resolve();

    expect(steps).toHaveLength(2);

    expect(steps[0].matches).toHaveLength(1);
    expect(steps[0].matches[0].type).toBe(R);
    expect(new Set(steps[0].cleared)).toEqual(
      new Set([
        { col: 0, row: 2 },
        { col: 0, row: 3 },
        { col: 0, row: 4 },
      ]),
    );
    expect(steps[0].moves).toEqual(
      expect.arrayContaining([
        { from: { col: 0, row: 1 }, to: { col: 0, row: 4 } },
        { from: { col: 0, row: 0 }, to: { col: 0, row: 3 } },
      ]),
    );
    expect(steps[0].spawns).toHaveLength(3);
    expect(steps[0].spawns.every((spawn) => spawn.cell.col === 0 && spawn.cell.row <= 2)).toBe(true);

    expect(steps[1].matches).toHaveLength(1);
    expect(steps[1].matches[0].type).toBe(O);
    expect(new Set(steps[1].cleared)).toEqual(
      new Set([
        { col: 0, row: 3 },
        { col: 0, row: 4 },
        { col: 0, row: 5 },
      ]),
    );

    // Columns 1-5 (the inert filler) are never touched.
    for (let row = 0; row < 6; row++) {
      for (let col = 1; col < 6; col++) {
        expect(colorAt(board, col, row)).toBe((col + row) % 3);
      }
    }

    expect(snapshot(board).flat().every((cell) => cell !== null)).toBe(true);
    expect(board.findMatches()).toHaveLength(0);
  });

  it("never leaves holes and never exceeds the cascade cap across a 50-move seeded playthrough", () => {
    const board = new Board(COLS, ROWS, mulberry32(2024));
    const pick = mulberry32(555);

    for (let i = 0; i < 50; i++) {
      const col = Math.floor(pick() * COLS);
      const row = Math.floor(pick() * ROWS);
      const horizontal = pick() < 0.5;
      const a = { col, row };
      const b = horizontal ? { col: Math.min(col + 1, COLS - 1), row } : { col, row: Math.min(row + 1, ROWS - 1) };
      if (a.col === b.col && a.row === b.row) {
        continue;
      }

      expect(() => board.swap(a, b)).not.toThrow();

      const grid = snapshot(board);
      expect(grid.flat().every((cell) => cell !== null)).toBe(true);
    }
  });
});

describe("Board.reshuffle", () => {
  it("reshuffles a dead board into one with a valid move, preserving the multiset and creating no matches", () => {
    // A diagonal-stripe 3-coloring: type(c,r) = (c+r) % 3. No 3-in-a-row ever
    // occurs (consecutive cells always differ), and no adjacent swap can
    // create one either (classic "dead board" construction).
    const size = 6;
    const layout = allNull(size, size);
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        layout[row][col] = ((col + row) % 3) as CandyType;
      }
    }
    const board = boardFromLayout(layout, 42);

    expect(board.findMatches()).toHaveLength(0);
    expect(board.hasAnyValidMove()).toBe(false);

    const before = countByType(colorSnapshot(board));

    board.reshuffle();

    expect(board.findMatches()).toHaveLength(0);
    expect(board.hasAnyValidMove()).toBe(true);
    expect(countByType(colorSnapshot(board))).toEqual(before);
  });
});

describe("Board.findAnyValidMove", () => {
  it("returns a move that actually creates a match when swapped", () => {
    const board = new Board(COLS, ROWS, mulberry32(5));
    const move = board.findAnyValidMove();

    expect(move).not.toBeNull();
    if (!move) return;

    const result = board.swap(move.a, move.b);
    expect(result.ok).toBe(true);
  });

  it("stays consistent with hasAnyValidMove", () => {
    const board = new Board(COLS, ROWS, mulberry32(9));
    expect(board.hasAnyValidMove()).toBe(board.findAnyValidMove() !== null);
  });

  it("returns null on a dead board", () => {
    const size = 6;
    const layout = allNull(size, size);
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        layout[row][col] = ((col + row) % 3) as CandyType;
      }
    }
    const board = boardFromLayout(layout, 42);

    expect(board.findAnyValidMove()).toBeNull();
  });
});

describe("Board cascade determinism", () => {
  it("same seed + same swap sequence produces identical cascade steps", () => {
    const swaps: [{ col: number; row: number }, { col: number; row: number }][] = [
      [{ col: 0, row: 0 }, { col: 1, row: 0 }],
      [{ col: 3, row: 4 }, { col: 3, row: 5 }],
      [{ col: 6, row: 2 }, { col: 7, row: 2 }],
      [{ col: 2, row: 6 }, { col: 2, row: 7 }],
    ];

    const boardA = new Board(COLS, ROWS, mulberry32(2024));
    const boardB = new Board(COLS, ROWS, mulberry32(2024));

    const resultsA = swaps.map(([a, b]) => boardA.swap(a, b));
    const resultsB = swaps.map(([a, b]) => boardB.swap(a, b));

    expect(resultsA).toEqual(resultsB);
    expect(snapshot(boardA)).toEqual(snapshot(boardB));
  });
});

function countByType(grid: (CandyType | null)[][]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const row of grid) {
    for (const cell of row) {
      if (cell === null) {
        continue;
      }
      counts[cell] = (counts[cell] ?? 0) + 1;
    }
  }
  return counts;
}
