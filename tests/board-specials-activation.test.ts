import { describe, expect, it } from "vitest";
import { Board } from "../src/logic/Board";
import { CandyType } from "../src/logic/CandyType";
import { mulberry32 } from "../src/logic/rng";
import { boardFromLayout, colorSnapshot, forceSetCell, snapshot } from "./helpers";

const R = CandyType.RED;
const O = CandyType.ORANGE;
const Y = CandyType.YELLOW;

const COLS = 8;
const ROWS = 8;

function fillerBoard(size = 8): CandyType[][] {
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => ((col + row) % 3) as CandyType));
}

function cellsOfColor(layout: CandyType[][], color: CandyType): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = [];
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      if (layout[row][col] === color) cells.push({ col, row });
    }
  }
  return cells;
}

describe("Special activation & chains (Checkpoint 2)", () => {
  it("a pre-existing striped candy caught in a match activates and clears its whole row", () => {
    const layout = fillerBoard();
    layout[2][2] = R;
    layout[2][3] = R;
    layout[2][4] = Y; // caps the run at cols1-3
    const board = boardFromLayout(layout, 5);
    forceSetCell(board, 2, 2, { type: R, special: "stripedH" });

    expect(board.findMatches()).toHaveLength(1);
    const steps = board.resolve();

    const step = steps[0];
    expect(step.matches).toHaveLength(1);
    expect(step.specialsCreated).toHaveLength(0);
    expect(step.activations).toHaveLength(1);
    expect(step.activations[0].special).toBe("stripedH");
    expect(step.activations[0].cell).toEqual({ col: 2, row: 2 });
    expect(step.activations[0].cellsCleared).toHaveLength(COLS);

    const expectedCleared = Array.from({ length: COLS }, (_, col) => ({ col, row: 2 }));
    expect(new Set(step.cleared)).toEqual(new Set(expectedCleared));
  });

  it("a wrapped candy activates a 3x3 explosion, clipped at the board edge", () => {
    const layout = fillerBoard();
    layout[0][0] = O;
    layout[0][2] = O;
    const board = boardFromLayout(layout, 5);
    forceSetCell(board, 0, 0, { type: O, special: "wrapped" });

    expect(board.findMatches()).toHaveLength(1);
    const steps = board.resolve();

    const step = steps[0];
    expect(step.activations).toHaveLength(1);
    expect(step.activations[0].special).toBe("wrapped");
    // 3x3 around a corner cell clips to the 2x2 region that actually exists.
    expect(new Set(step.activations[0].cellsCleared)).toEqual(
      new Set([
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 0, row: 1 },
        { col: 1, row: 1 },
      ]),
    );
    expect(new Set(step.cleared)).toEqual(
      new Set([
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 2, row: 0 },
        { col: 0, row: 1 },
        { col: 1, row: 1 },
      ]),
    );
  });

  it("chains: striped hitting a wrapped hitting a striped all activate in one step", () => {
    const layout = fillerBoard();
    layout[2][1] = R;
    layout[2][2] = R;
    layout[2][3] = R;
    layout[2][4] = Y; // caps the row2 run at cols1-3
    const board = boardFromLayout(layout, 5);
    forceSetCell(board, 2, 2, { type: R, special: "stripedH" });
    forceSetCell(board, 5, 2, { type: O, special: "wrapped" });
    forceSetCell(board, 5, 3, { type: Y, special: "stripedV" });

    const steps = board.resolve();
    const step = steps[0];

    expect(step.activations.map((a) => a.special)).toEqual(["stripedH", "wrapped", "stripedV"]);

    // row2 (8 cells) ∪ 3x3 around (5,2) (9 cells) ∪ column5 (8 cells), deduped.
    expect(step.cleared).toEqual(expect.arrayContaining([{ col: 0, row: 2 }]));
    expect(step.cleared).toEqual(expect.arrayContaining([{ col: 4, row: 1 }]));
    expect(step.cleared).toEqual(expect.arrayContaining([{ col: 5, row: 7 }]));
  });

  it("a color bomb swapped with a normal candy clears every candy of that color", () => {
    const layout = fillerBoard();
    const board = boardFromLayout(layout, 5);
    forceSetCell(board, 2, 2, { type: null, special: "bomb" });
    forceSetCell(board, 3, 2, { type: R, special: null });

    const redCellsBeforeSwap = cellsOfColor(layout, R);

    const result = board.swap({ col: 2, row: 2 }, { col: 3, row: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const step = result.steps[0];
    expect(step.matches).toHaveLength(0);
    expect(step.activations).toHaveLength(1);
    expect(step.activations[0].special).toBe("bomb");

    // Every original R cell clears (the forced (3,2)=R isn't in the filler
    // `layout` array since it was set via forceSetCell after construction),
    // plus (2,2) which received the R candy via the swap itself (so it's R
    // at activation time too).
    const expected = new Set(redCellsBeforeSwap.map((c) => `${c.col},${c.row}`));
    expected.add("2,2");
    expected.add("3,2");
    expect(new Set(step.cleared.map((c) => `${c.col},${c.row}`))).toEqual(expected);
  });

  it("bomb + bomb swap clears the entire board", () => {
    const layout = fillerBoard();
    const board = boardFromLayout(layout, 5);
    forceSetCell(board, 3, 3, { type: null, special: "bomb" });
    forceSetCell(board, 4, 3, { type: null, special: "bomb" });

    const result = board.swap({ col: 3, row: 3 }, { col: 4, row: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const step = result.steps[0];
    expect(step.cleared).toHaveLength(COLS * ROWS);
    expect(step.activations).toHaveLength(2);
    expect(step.activations.every((a) => a.special === "bomb")).toBe(true);

    // Gravity/refill after a full-board clear must leave zero holes.
    expect(colorSnapshot(board).flat().every((cell) => cell !== null)).toBe(true);
  });

  it("other special+special swaps (non-bomb) just activate both individually", () => {
    const layout = fillerBoard();
    const board = boardFromLayout(layout, 5);
    forceSetCell(board, 2, 2, { type: R, special: "stripedH" });
    forceSetCell(board, 3, 2, { type: Y, special: "stripedV" });

    const result = board.swap({ col: 2, row: 2 }, { col: 3, row: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const step = result.steps[0];
    expect(step.matches).toHaveLength(0);
    expect(step.activations).toHaveLength(2);
    expect(step.activations.map((a) => a.special).sort()).toEqual(["stripedH", "stripedV"]);
  });

  it("a bomb always has a valid move available, even with no color-based move on the board", () => {
    // A diagonal-stripe dead board (no color match possible via any swap),
    // but with a bomb planted on it — a bomb swap always succeeds, so this
    // must count as a valid move rather than forcing an (identity-destroying
    // for the bomb, though not actually destructive) reshuffle.
    const size = 6;
    const layout: CandyType[][] = Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => ((col + row) % 3) as CandyType),
    );
    const board = boardFromLayout(layout, 5);
    forceSetCell(board, 0, 0, { type: null, special: "bomb" });

    expect(board.hasAnyValidMove()).toBe(true);
    const move = board.findAnyValidMove();
    expect(move).not.toBeNull();
  });

  it("never leaves holes or throws across a 50-move seeded playthrough that includes forced specials", () => {
    const board = new Board(COLS, ROWS, mulberry32(2024));
    const pick = mulberry32(777);

    for (let i = 0; i < 50; i++) {
      if (i === 10) {
        forceSetCell(board, 1, 1, { type: null, special: "bomb" });
      }
      if (i === 25) {
        forceSetCell(board, 6, 6, { type: R, special: "wrapped" });
        forceSetCell(board, 6, 5, { type: R, special: null });
        forceSetCell(board, 6, 7, { type: R, special: null });
      }

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

  it("same seed + same swap sequence (including a bomb swap) produces identical results", () => {
    const buildBoard = () => {
      const board = new Board(COLS, ROWS, mulberry32(4242));
      forceSetCell(board, 1, 1, { type: null, special: "bomb" });
      forceSetCell(board, 2, 1, { type: R, special: null });
      return board;
    };

    const boardA = buildBoard();
    const boardB = buildBoard();

    const swaps: [{ col: number; row: number }, { col: number; row: number }][] = [
      [{ col: 1, row: 1 }, { col: 2, row: 1 }],
      [{ col: 4, row: 4 }, { col: 4, row: 5 }],
      [{ col: 6, row: 2 }, { col: 7, row: 2 }],
    ];

    const resultsA = swaps.map(([a, b]) => boardA.swap(a, b));
    const resultsB = swaps.map(([a, b]) => boardB.swap(a, b));

    expect(resultsA).toEqual(resultsB);
    expect(snapshot(boardA)).toEqual(snapshot(boardB));
  });
});
