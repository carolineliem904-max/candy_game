import { describe, expect, it } from "vitest";
import { Board } from "../src/logic/Board";
import { mulberry32 } from "../src/logic/rng";

const COLS = 8;
const ROWS = 8;
const SEED_COUNT = 100;

function hasAnyMatchOnBoard(board: Board): boolean {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (board.hasMatchAt(col, row)) {
        return true;
      }
    }
  }
  return false;
}

describe("Board", () => {
  it("has the correct dimensions", () => {
    const board = new Board(COLS, ROWS, mulberry32(1));
    expect(board.cols).toBe(COLS);
    expect(board.rows).toBe(ROWS);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        expect(() => board.getCell(col, row)).not.toThrow();
      }
    }
  });

  it("generates boards with no pre-existing matches across many seeds", () => {
    for (let seed = 0; seed < SEED_COUNT; seed++) {
      const board = new Board(COLS, ROWS, mulberry32(seed));
      expect(hasAnyMatchOnBoard(board)).toBe(false);
    }
  });

  it("always generates a board with at least one valid move across many seeds", () => {
    for (let seed = 0; seed < SEED_COUNT; seed++) {
      const board = new Board(COLS, ROWS, mulberry32(seed));
      expect(board.hasAnyValidMove()).toBe(true);
    }
  });

  it("is deterministic for a given seed", () => {
    const boardA = new Board(COLS, ROWS, mulberry32(42));
    const boardB = new Board(COLS, ROWS, mulberry32(42));

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        expect(boardA.getCell(col, row)).toEqual(boardB.getCell(col, row));
      }
    }
  });
});
