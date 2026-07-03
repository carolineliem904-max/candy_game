import { Board } from "../src/logic/Board";
import { CandyType } from "../src/logic/CandyType";
import type { LevelDef } from "../src/logic/LevelDef";
import { mulberry32 } from "../src/logic/rng";

/** Builds a Board and overwrites its cells from a row-major layout of candy
 * types (or null for EMPTY), bypassing generate()'s no-match constraint so
 * tests can set up specific scenarios. */
export function boardFromLayout(layout: (CandyType | null)[][], seed = 1): Board {
  const rows = layout.length;
  const cols = layout[0].length;
  const board = new Board(cols, rows, mulberry32(seed));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      forceSetCell(board, col, row, layout[row][col]);
    }
  }
  return board;
}

export function forceSetCell(board: Board, col: number, row: number, type: CandyType | null): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (board as any).setCell(col, row, type);
}

/** Overwrites every cell of an already-constructed Board from a row-major
 * layout, bypassing generate()'s no-match constraint. */
export function applyLayout(board: Board, layout: (CandyType | null)[][]): void {
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      forceSetCell(board, col, row, layout[row][col]);
    }
  }
}

/** Builds a LevelDef for tests, with sensible defaults overridable per-field. */
export function makeLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return { id: 1, targetScore: 1000, maxMoves: 10, candyTypes: 6, ...overrides };
}

export function allNull(cols: number, rows: number): (CandyType | null)[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

export function snapshot(board: Board): (CandyType | null)[][] {
  const b = board as unknown as { rows: number; cols: number };
  const rows: (CandyType | null)[][] = [];
  for (let row = 0; row < b.rows; row++) {
    const cols: (CandyType | null)[] = [];
    for (let col = 0; col < b.cols; col++) {
      cols.push(board.getCell(col, row));
    }
    rows.push(cols);
  }
  return rows;
}
