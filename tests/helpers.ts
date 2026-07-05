import { Board } from "../src/logic/Board";
import type { Candy, SpecialKind } from "../src/logic/Board";
import { CandyType } from "../src/logic/CandyType";
import type { LevelDef } from "../src/logic/LevelDef";
import { mulberry32 } from "../src/logic/rng";

/** Shorthand for building a plain (non-special) Candy in a layout. */
export function candy(type: CandyType, special: SpecialKind | null = null): Candy {
  return { type, special };
}

/** Builds a Board and overwrites its cells from a row-major layout of candy
 * types (or null for EMPTY), bypassing generate()'s no-match constraint so
 * tests can set up specific scenarios. Plain colors only — use applyLayout
 * with forceSetCell directly for layouts that need specials. */
export function boardFromLayout(layout: (CandyType | null)[][], seed = 1): Board {
  const rows = layout.length;
  const cols = layout[0].length;
  const board = new Board(cols, rows, mulberry32(seed));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      forceSetCell(board, col, row, layout[row][col] === null ? null : candy(layout[row][col] as CandyType));
    }
  }
  return board;
}

/** Like boardFromLayout, but the layout cells are full Candy objects (or
 * null), so specials can be placed directly. */
export function boardFromCandyLayout(layout: (Candy | null)[][], seed = 1): Board {
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

export function forceSetCell(board: Board, col: number, row: number, cell: Candy | null): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (board as any).setCell(col, row, cell);
}

/** Overwrites every cell of an already-constructed Board from a row-major
 * layout of plain candy types, bypassing generate()'s no-match constraint. */
export function applyLayout(board: Board, layout: (CandyType | null)[][]): void {
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      const type = layout[row][col];
      forceSetCell(board, col, row, type === null ? null : candy(type));
    }
  }
}

export function allNull(cols: number, rows: number): (CandyType | null)[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

export function allEmpty(cols: number, rows: number): (Candy | null)[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

/** Builds a LevelDef for tests, with sensible defaults overridable per-field. */
export function makeLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return { id: 1, targetScore: 1000, maxMoves: 10, candyTypes: 6, goal: { kind: "score" }, ...overrides };
}

/** Full-board snapshot of Candy objects (or null), for equality/regression checks. */
export function snapshot(board: Board): (Candy | null)[][] {
  const b = board as unknown as { rows: number; cols: number };
  const rows: (Candy | null)[][] = [];
  for (let row = 0; row < b.rows; row++) {
    const cols: (Candy | null)[] = [];
    for (let col = 0; col < b.cols; col++) {
      cols.push(board.getCell(col, row));
    }
    rows.push(cols);
  }
  return rows;
}

/** Full-board snapshot of just colors (Candy.type, or null for EMPTY) —
 * convenient for tests that only care about color, not special state. */
export function colorSnapshot(board: Board): (CandyType | null)[][] {
  return snapshot(board).map((row) => row.map((cell) => (cell === null ? null : cell.type)));
}

export function colorAt(board: Board, col: number, row: number): CandyType | null {
  const cell = board.getCell(col, row);
  return cell === null ? null : cell.type;
}

export function specialAt(board: Board, col: number, row: number): SpecialKind | null {
  const cell = board.getCell(col, row);
  return cell === null ? null : cell.special;
}
