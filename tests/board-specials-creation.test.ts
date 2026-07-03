import { describe, expect, it } from "vitest";
import { CandyType } from "../src/logic/CandyType";
import { boardFromLayout } from "./helpers";

const R = CandyType.RED;
const O = CandyType.ORANGE;
const Y = CandyType.YELLOW;

/** An 8x8 (col+row)%3 filler never contains a 3-run (consecutive cells
 * always cycle through 3 distinct residues), and its abundant color
 * repetition means Board.reshuffle() always has plenty of room to work with
 * — unlike the tiny hand-built boards these creation tests care about, which
 * are too small to guarantee a post-cascade valid move exists. Embedding the
 * scenario's overridden cells inside this filler keeps the interesting part
 * hand-verified and small while keeping reshuffle safe. */
function fillerBoard(size = 8): CandyType[][] {
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => ((col + row) % 3) as CandyType));
}

describe("Special creation (Checkpoint 1)", () => {
  it("a horizontal swap completing a 4-run creates a horizontal striped candy at the moved cell", () => {
    const layout = fillerBoard();
    layout[0][0] = O;
    layout[0][1] = O;
    layout[0][2] = O;
    layout[0][3] = Y;
    layout[0][4] = O;
    const board = boardFromLayout(layout, 5);
    expect(board.findMatches()).toHaveLength(1);

    // Swap (3,0)<->(4,0): row0 becomes O,O,O,O,Y,... (a 4-run).
    const result = board.swap({ col: 3, row: 0 }, { col: 4, row: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const step = result.steps[0];
    expect(step.matches).toHaveLength(1);
    expect(step.matches[0].cells).toHaveLength(4);
    expect(step.specialsCreated).toEqual([{ cell: { col: 3, row: 0 }, special: "stripedH", type: O }]);
    expect(new Set(step.cleared)).toEqual(
      new Set([
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 2, row: 0 },
      ]),
    );
  });

  it("a vertical swap that completes a horizontal 4-run still creates a VERTICAL stripe (swap direction wins over run orientation)", () => {
    const layout = fillerBoard();
    layout[1][0] = R;
    layout[1][1] = R;
    layout[1][2] = R;
    layout[1][3] = O;
    layout[2][3] = R;
    const board = boardFromLayout(layout, 5);
    expect(board.findMatches()).toHaveLength(1);

    // Swap (3,1)=O with (3,2)=R -> row1 becomes R,R,R,R,... via a *vertical*
    // swap. Per spec, stripe orientation follows swap direction, not the
    // (horizontal) run's own orientation.
    const result = board.swap({ col: 3, row: 1 }, { col: 3, row: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const step = result.steps[0];
    expect(step.matches).toHaveLength(1);
    expect(step.matches[0].cells).toHaveLength(4);
    expect(step.specialsCreated).toEqual([{ cell: { col: 3, row: 1 }, special: "stripedV", type: R }]);
  });

  it("an L/T intersection creates a wrapped candy at the intersection cell", () => {
    const layout = fillerBoard();
    layout[1][2] = Y; // swap source
    layout[2][0] = R; // breaks the filler's coincidental Y at this cell
    layout[2][1] = Y;
    layout[2][2] = O; // pre-swap: not yet part of either run
    layout[2][3] = Y;
    layout[3][2] = Y;
    layout[4][2] = Y;
    const board = boardFromLayout(layout, 5);
    expect(board.findMatches()).toHaveLength(0);

    // Swap (2,1)<->(2,2): fills the shared cell (2,2), completing both
    // row2 cols1-3 (horizontal) and col2 rows2-4 (vertical).
    const result = board.swap({ col: 2, row: 1 }, { col: 2, row: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const step = result.steps[0];
    expect(step.matches).toHaveLength(2);
    expect(step.specialsCreated).toEqual([{ cell: { col: 2, row: 2 }, special: "wrapped", type: Y }]);
    expect(new Set(step.cleared)).toEqual(
      new Set([
        { col: 1, row: 2 },
        { col: 3, row: 2 },
        { col: 2, row: 3 },
        { col: 2, row: 4 },
      ]),
    );
  });

  it("a run of 5+ creates a color bomb at the moved cell", () => {
    const layout = fillerBoard();
    layout[0][0] = O;
    layout[0][1] = O;
    layout[0][2] = O;
    layout[0][3] = O;
    layout[0][4] = Y;
    layout[0][5] = O;
    const board = boardFromLayout(layout, 5);
    expect(board.findMatches()).toHaveLength(1);

    const result = board.swap({ col: 4, row: 0 }, { col: 5, row: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const step = result.steps[0];
    expect(step.matches).toHaveLength(1);
    expect(step.matches[0].cells).toHaveLength(5);
    expect(step.specialsCreated).toEqual([{ cell: { col: 4, row: 0 }, special: "bomb", type: O }]);
    expect(new Set(step.cleared)).toEqual(
      new Set([
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 2, row: 0 },
        { col: 3, row: 0 },
      ]),
    );
  });

  it("priority: a single move creating both a 4-run and an L/T produces wrapped, not striped", () => {
    const layout = fillerBoard();
    layout[0][1] = Y;
    layout[1][1] = Y;
    layout[2][0] = Y;
    layout[2][1] = O; // pre-swap: not yet part of either run
    layout[2][2] = Y;
    layout[2][3] = Y;
    layout[3][1] = Y; // swap source
    const board = boardFromLayout(layout, 5);
    expect(board.findMatches()).toHaveLength(0);

    // Swap (1,2)<->(1,3): completes row2 cols0-3 (4-run, horizontal) AND
    // col1 rows0-2 (3-run, vertical), sharing cell (1,2).
    const result = board.swap({ col: 1, row: 2 }, { col: 1, row: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const step = result.steps[0];
    expect(step.matches).toHaveLength(2);
    expect(step.matches.some((m) => m.cells.length === 4)).toBe(true);
    expect(step.specialsCreated).toEqual([{ cell: { col: 1, row: 2 }, special: "wrapped", type: Y }]);
  });

  it("a match formed by gravity (cascade-created, no swap direction) picks the run's own orientation and spawns at the run's center", () => {
    // Column 0: two O's above a 3-run of R, two more O's below. Clearing
    // the R's and letting gravity run stacks all four O's into one
    // contiguous vertical run — no swap direction is available for it.
    const layout = fillerBoard();
    layout[0][0] = O;
    layout[1][0] = O;
    layout[2][0] = R;
    layout[3][0] = R;
    layout[4][0] = R;
    layout[5][0] = O;
    layout[6][0] = O;
    layout[7][0] = Y; // breaks the filler's coincidental O just past the run
    const board = boardFromLayout(layout, 314);

    expect(board.findMatches()).toHaveLength(1);
    const steps = board.resolve();
    expect(steps.length).toBeGreaterThanOrEqual(2);

    const cascadeStep = steps.find((s) => s.specialsCreated.some((c) => c.type === O));
    expect(cascadeStep).toBeDefined();
    if (!cascadeStep) return;

    const creation = cascadeStep.specialsCreated.find((c) => c.type === O)!;
    const match = cascadeStep.matches.find((m) => m.type === O)!;
    expect(match.cells).toHaveLength(4);
    expect(match.orientation).toBe("vertical");
    expect(creation.special).toBe("stripedV");
    expect(creation.cell).toEqual(match.cells[Math.floor((match.cells.length - 1) / 2)]);
  });
});
