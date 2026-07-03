import { describe, expect, it } from "vitest";
import { Board } from "../src/logic/Board";
import { CandyType } from "../src/logic/CandyType";
import { mulberry32 } from "../src/logic/rng";
import { allNull, boardFromLayout, snapshot } from "./helpers";

const COLS = 8;
const ROWS = 8;

const R = CandyType.RED;
const O = CandyType.ORANGE;
const Y = CandyType.YELLOW;
const G = CandyType.GREEN;
const B = CandyType.BLUE;

describe("Board.findMatches", () => {
  it("finds a horizontal run of 3", () => {
    const layout = allNull(5, 5);
    layout[2][1] = R;
    layout[2][2] = R;
    layout[2][3] = R;
    const board = boardFromLayout(layout);

    const matches = board.findMatches();
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe(R);
    expect(matches[0].cells).toEqual(
      expect.arrayContaining([
        { col: 1, row: 2 },
        { col: 2, row: 2 },
        { col: 3, row: 2 },
      ]),
    );
  });

  it("finds a vertical run of 3", () => {
    const layout = allNull(5, 5);
    layout[1][2] = B;
    layout[2][2] = B;
    layout[3][2] = B;
    const board = boardFromLayout(layout);

    const matches = board.findMatches();
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe(B);
    expect(matches[0].cells).toEqual(
      expect.arrayContaining([
        { col: 2, row: 1 },
        { col: 2, row: 2 },
        { col: 2, row: 3 },
      ]),
    );
  });

  it("counts a run of 4 or 5 as a single match", () => {
    const layout = allNull(6, 5);
    layout[2][0] = G;
    layout[2][1] = G;
    layout[2][2] = G;
    layout[2][3] = G;
    layout[2][4] = G;
    const board = boardFromLayout(layout);

    const matches = board.findMatches();
    expect(matches).toHaveLength(1);
    expect(matches[0].cells).toHaveLength(5);
  });

  it("produces both matches for an L/T intersection", () => {
    const layout = allNull(5, 5);
    // horizontal run
    layout[2][1] = Y;
    layout[2][2] = Y;
    layout[2][3] = Y;
    // vertical run sharing the cell at (2,2)
    layout[1][2] = Y;
    layout[3][2] = Y;
    const board = boardFromLayout(layout);

    const matches = board.findMatches();
    expect(matches).toHaveLength(2);
    const shared = { col: 2, row: 2 };
    expect(matches[0].cells).toEqual(expect.arrayContaining([shared]));
    expect(matches[1].cells).toEqual(expect.arrayContaining([shared]));
  });

  it("never matches empty cells", () => {
    const board = boardFromLayout(allNull(COLS, ROWS));
    expect(board.findMatches()).toHaveLength(0);
  });
});

describe("Board.swap", () => {
  it("rejects non-adjacent swaps without mutating the board", () => {
    const board = new Board(COLS, ROWS, mulberry32(7));
    const before = snapshot(board);

    const result = board.swap({ col: 0, row: 0 }, { col: 2, row: 2 });

    expect(result).toEqual({ ok: false, reason: "not-adjacent" });
    expect(snapshot(board)).toEqual(before);
  });

  it("rejects swaps involving an EMPTY cell", () => {
    const layout = allNull(4, 4);
    layout[0][0] = R;
    const board = boardFromLayout(layout);

    const result = board.swap({ col: 0, row: 0 }, { col: 1, row: 0 });

    expect(result).toEqual({ ok: false, reason: "empty-cell" });
  });

  it("reverts a swap that creates no match, leaving the board identical", () => {
    const layout = [
      [R, O, Y],
      [G, B, R],
      [O, Y, G],
    ];
    const board = boardFromLayout(layout);
    const before = snapshot(board);

    const result = board.swap({ col: 0, row: 0 }, { col: 1, row: 0 });

    expect(result).toEqual({ ok: false, reason: "no-match" });
    expect(snapshot(board)).toEqual(before);
  });

  it("clears exactly the matched cells in the first cascade step, then leaves no holes", () => {
    // Swap (2,0)=O with (2,1)=R -> row 0 becomes R,R,R (match); (2,1) becomes O.
    const layout = [
      [R, R, O],
      [B, Y, R],
      [O, Y, B],
    ];
    const board = boardFromLayout(layout);

    const result = board.swap({ col: 2, row: 0 }, { col: 2, row: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The swap-triggered match is deterministic regardless of what refill
    // spawns afterward, since it's identified before any refill happens.
    expect(result.steps.length).toBeGreaterThanOrEqual(1);
    expect(result.steps[0].matches).toHaveLength(1);
    expect(result.steps[0].matches[0].type).toBe(R);
    expect(new Set(result.steps[0].cleared)).toEqual(
      new Set([
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 2, row: 0 },
      ]),
    );

    // Whatever cascaded afterward, gravity + refill must leave zero holes.
    expect(snapshot(board).flat().every((cell) => cell !== null)).toBe(true);
  });
});

describe("Board determinism with swaps", () => {
  it("same seed + same swap sequence produces identical board state", () => {
    const swaps: [
      { col: number; row: number },
      { col: number; row: number },
    ][] = [
      [{ col: 0, row: 0 }, { col: 1, row: 0 }],
      [{ col: 3, row: 4 }, { col: 3, row: 5 }],
      [{ col: 6, row: 2 }, { col: 7, row: 2 }],
    ];

    const boardA = new Board(COLS, ROWS, mulberry32(99));
    const boardB = new Board(COLS, ROWS, mulberry32(99));

    for (const [a, b] of swaps) {
      boardA.swap(a, b);
      boardB.swap(a, b);
    }

    expect(snapshot(boardA)).toEqual(snapshot(boardB));
  });
});
