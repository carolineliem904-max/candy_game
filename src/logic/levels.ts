import type { Cell } from "./Board";
import { CandyType } from "./CandyType";
import { BOARD_COLS, BOARD_ROWS } from "./constants";
import type { LevelDef } from "./LevelDef";
import type { LevelGoal } from "./LevelGoal";

const R = CandyType.RED;
const O = CandyType.ORANGE;
const Y = CandyType.YELLOW;
const G = CandyType.GREEN;
const B = CandyType.BLUE;
const P = CandyType.PURPLE;

function score(): LevelGoal {
  return { kind: "score" };
}

function collect(pieces: Partial<Record<CandyType, number>>): LevelGoal {
  return { kind: "collect", pieces };
}

function jelly(cells: Cell[]): LevelGoal {
  return { kind: "jelly", jellyCells: cells };
}

/** A centered w x h rectangle of jelly. The first (mildest) jelly pattern —
 * every covered cell has plenty of matchable neighbors around it. */
function centerBlock(w: number, h: number): Cell[] {
  const colStart = Math.floor((BOARD_COLS - w) / 2);
  const rowStart = Math.floor((BOARD_ROWS - h) / 2);
  const cells: Cell[] = [];
  for (let row = rowStart; row < rowStart + h; row++) {
    for (let col = colStart; col < colStart + w; col++) {
      cells.push({ col, row });
    }
  }
  return cells;
}

/** Top + bottom rows. Edge cells are harder to clear than center ones (fewer
 * directions a match can approach from), per spec's difficulty guidance. */
function edgeRows(): Cell[] {
  const cells: Cell[] = [];
  for (let col = 0; col < BOARD_COLS; col++) {
    cells.push({ col, row: 0 });
    cells.push({ col, row: BOARD_ROWS - 1 });
  }
  return cells;
}

/** Left + right columns — same "edge" difficulty as edgeRows, orthogonal. */
function edgeColumns(): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    cells.push({ col: 0, row });
    cells.push({ col: BOARD_COLS - 1, row });
  }
  return cells;
}

/** size x size squares at all 4 corners — corners are the hardest single
 * cells on the board (only 2 match directions instead of 4), per spec. */
function cornerClusters(size: number): Cell[] {
  const cells: Cell[] = [];
  const starts = [
    [0, 0],
    [BOARD_COLS - size, 0],
    [0, BOARD_ROWS - size],
    [BOARD_COLS - size, BOARD_ROWS - size],
  ];
  for (const [colStart, rowStart] of starts) {
    for (let row = rowStart; row < rowStart + size; row++) {
      for (let col = colStart; col < colStart + size; col++) {
        cells.push({ col, row });
      }
    }
  }
  return cells;
}

/** The full outer ring (every edge cell, corners included once) — the
 * hardest, most spread-out coverage, reserved for the finale. */
function borderRing(): Cell[] {
  const seen = new Set<string>();
  const cells: Cell[] = [];
  const add = (cell: Cell) => {
    const key = `${cell.col},${cell.row}`;
    if (!seen.has(key)) {
      seen.add(key);
      cells.push(cell);
    }
  };
  for (const cell of edgeRows()) add(cell);
  for (const cell of edgeColumns()) add(cell);
  return cells;
}

/** Hand-authored difficulty curve — trivially editable, Caroline will retune
 * after playtesting. L1-4 are the original score-only game, unchanged.
 * L5 is the first collect level (gentle: one type, generous moves) and
 * L6-20 interleave collect/jelly/score on a repeating 5-slot cycle
 * (collect, jelly, score, collect, jelly) x3, which works out to the spec's
 * target mix of ~7 score / ~7 collect / ~6 jelly across all 20 levels.
 * Jelly coverage gets harder (center -> edges -> corners -> full ring) and
 * collect targets/move budgets tighten as the curve progresses; targetScore
 * is still recorded for every level (HUD/stats always show a score) but
 * only actually gates a win for "score" goal levels — see LevelGoal. */
export const LEVELS: LevelDef[] = [
  { id: 1, targetScore: 3000, maxMoves: 15, candyTypes: 5, goal: score() },
  { id: 2, targetScore: 4500, maxMoves: 15, candyTypes: 5, goal: score() },
  { id: 3, targetScore: 4500, maxMoves: 15, candyTypes: 6, goal: score() },
  { id: 4, targetScore: 6000, maxMoves: 15, candyTypes: 6, goal: score() },
  { id: 5, targetScore: 4000, maxMoves: 20, candyTypes: 6, goal: collect({ [R]: 12 }) },
  { id: 6, targetScore: 5000, maxMoves: 19, candyTypes: 6, goal: collect({ [R]: 15, [B]: 10 }) },
  { id: 7, targetScore: 5500, maxMoves: 18, candyTypes: 6, goal: jelly(centerBlock(4, 2)) },
  { id: 8, targetScore: 7000, maxMoves: 15, candyTypes: 6, goal: score() },
  { id: 9, targetScore: 6500, maxMoves: 18, candyTypes: 6, goal: collect({ [G]: 16, [Y]: 14 }) },
  { id: 10, targetScore: 7000, maxMoves: 18, candyTypes: 6, goal: jelly(edgeRows()) },
  { id: 11, targetScore: 7500, maxMoves: 18, candyTypes: 6, goal: collect({ [O]: 18, [P]: 14 }) },
  { id: 12, targetScore: 8000, maxMoves: 17, candyTypes: 6, goal: jelly(edgeColumns()) },
  { id: 13, targetScore: 8500, maxMoves: 15, candyTypes: 6, goal: score() },
  { id: 14, targetScore: 8500, maxMoves: 19, candyTypes: 6, goal: collect({ [R]: 18, [G]: 14, [B]: 10 }) },
  { id: 15, targetScore: 9000, maxMoves: 18, candyTypes: 6, goal: jelly(cornerClusters(2)) },
  { id: 16, targetScore: 9500, maxMoves: 18, candyTypes: 6, goal: collect({ [Y]: 20, [P]: 16 }) },
  { id: 17, targetScore: 10000, maxMoves: 18, candyTypes: 6, goal: jelly(cornerClusters(2).concat(centerBlock(2, 2))) },
  { id: 18, targetScore: 10500, maxMoves: 15, candyTypes: 6, goal: score() },
  { id: 19, targetScore: 11000, maxMoves: 20, candyTypes: 6, goal: collect({ [R]: 20, [B]: 16, [O]: 12 }) },
  { id: 20, targetScore: 11500, maxMoves: 20, candyTypes: 6, goal: jelly(borderRing()) },
];

export const LEVEL_COUNT = LEVELS.length;

export function getLevelById(id: number): LevelDef | undefined {
  return LEVELS.find((level) => level.id === id);
}
