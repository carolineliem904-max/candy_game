import { CandyType, CANDY_TYPE_COUNT } from "./CandyType";
import type { RNG } from "./rng";

const MAX_GENERATION_ATTEMPTS = 1000;
const MAX_CASCADE_ITERATIONS = 50;

export interface Cell {
  col: number;
  row: number;
}

export interface Match {
  cells: Cell[];
  type: CandyType;
}

export interface Move {
  from: Cell;
  to: Cell;
}

export interface Spawn {
  cell: Cell;
  type: CandyType;
}

export interface CascadeStep {
  matches: Match[];
  cleared: Cell[];
  moves: Move[];
  spawns: Spawn[];
}

export type SwapResult =
  | { ok: true; steps: CascadeStep[]; reshuffled: boolean }
  | { ok: false; reason: "not-adjacent" | "empty-cell" | "no-match" };

export interface ValidMove {
  a: Cell;
  b: Cell;
}

/** A grid cell holds a candy, or null for an EMPTY (cleared) socket. */
export type GridCell = CandyType | null;

export class Board {
  readonly cols: number;
  readonly rows: number;
  private rng: RNG;
  private candyTypeCount: number;
  private grid: GridCell[][]; // grid[row][col]

  constructor(cols: number, rows: number, rng: RNG, candyTypeCount: number = CANDY_TYPE_COUNT) {
    this.cols = cols;
    this.rows = rows;
    this.rng = rng;
    this.candyTypeCount = candyTypeCount;
    this.grid = [];
    this.generate();
  }

  generate(): void {
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      this.fillWithoutMatches();
      if (this.hasAnyValidMove()) {
        return;
      }
    }
    throw new Error(
      `Board.generate: failed to produce a board with a valid move after ${MAX_GENERATION_ATTEMPTS} attempts`,
    );
  }

  private fillWithoutMatches(): void {
    this.grid = [];
    for (let row = 0; row < this.rows; row++) {
      this.grid[row] = [];
    }

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const order = this.shuffledTypeOrder();
        let chosen = order[0];
        for (const candidate of order) {
          this.setCell(col, row, candidate);
          if (!this.hasMatchAt(col, row)) {
            chosen = candidate;
            break;
          }
        }
        this.setCell(col, row, chosen);
      }
    }
  }

  private shuffledTypeOrder(): CandyType[] {
    const types = Array.from({ length: this.candyTypeCount }, (_, i) => i as CandyType);
    this.shuffleInPlace(types);
    return types;
  }

  private shuffleInPlace<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }

  private safeGet(col: number, row: number): GridCell | undefined {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return undefined;
    }
    return this.grid[row]?.[col];
  }

  getCell(col: number, row: number): GridCell {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      throw new RangeError(`getCell: (${col}, ${row}) is out of bounds`);
    }
    return this.grid[row][col];
  }

  private setCell(col: number, row: number, type: GridCell): void {
    this.grid[row][col] = type;
  }

  hasMatchAt(col: number, row: number): boolean {
    const type = this.safeGet(col, row);
    if (type === undefined || type === null) {
      return false;
    }

    let horizontalRun = 1;
    for (let c = col - 1; this.safeGet(c, row) === type; c--) horizontalRun++;
    for (let c = col + 1; this.safeGet(c, row) === type; c++) horizontalRun++;
    if (horizontalRun >= 3) {
      return true;
    }

    let verticalRun = 1;
    for (let r = row - 1; this.safeGet(col, r) === type; r--) verticalRun++;
    for (let r = row + 1; this.safeGet(col, r) === type; r++) verticalRun++;
    return verticalRun >= 3;
  }

  /** Scans the whole board for runs of 3+ identical candies. Cells shared by a
   * horizontal and vertical run appear in both matches. */
  findMatches(): Match[] {
    const matches: Match[] = [];

    for (let row = 0; row < this.rows; row++) {
      let col = 0;
      while (col < this.cols) {
        const type = this.safeGet(col, row);
        if (type === null || type === undefined) {
          col++;
          continue;
        }
        let runEnd = col;
        while (runEnd + 1 < this.cols && this.safeGet(runEnd + 1, row) === type) runEnd++;
        if (runEnd - col + 1 >= 3) {
          const cells: Cell[] = [];
          for (let c = col; c <= runEnd; c++) cells.push({ col: c, row });
          matches.push({ cells, type });
        }
        col = runEnd + 1;
      }
    }

    for (let col = 0; col < this.cols; col++) {
      let row = 0;
      while (row < this.rows) {
        const type = this.safeGet(col, row);
        if (type === null || type === undefined) {
          row++;
          continue;
        }
        let runEnd = row;
        while (runEnd + 1 < this.rows && this.safeGet(col, runEnd + 1) === type) runEnd++;
        if (runEnd - row + 1 >= 3) {
          const cells: Cell[] = [];
          for (let r = row; r <= runEnd; r++) cells.push({ col, row: r });
          matches.push({ cells, type });
        }
        row = runEnd + 1;
      }
    }

    return matches;
  }

  /** Swaps two orthogonally adjacent, non-empty cells. On a match, clears and
   * cascades via resolve() (reshuffling if that leaves a dead board); reverts
   * the swap if it creates no match. */
  swap(a: Cell, b: Cell): SwapResult {
    if (!this.isAdjacent(a, b)) {
      return { ok: false, reason: "not-adjacent" };
    }

    const typeA = this.getCell(a.col, a.row);
    const typeB = this.getCell(b.col, b.row);
    if (typeA === null || typeB === null) {
      return { ok: false, reason: "empty-cell" };
    }

    this.setCell(a.col, a.row, typeB);
    this.setCell(b.col, b.row, typeA);

    if (this.findMatches().length === 0) {
      this.setCell(a.col, a.row, typeA);
      this.setCell(b.col, b.row, typeB);
      return { ok: false, reason: "no-match" };
    }

    const steps = this.resolve();

    let reshuffled = false;
    if (!this.hasAnyValidMove()) {
      this.reshuffle();
      reshuffled = true;
    }

    return { ok: true, steps, reshuffled };
  }

  private clearMatches(matches: Match[]): Cell[] {
    const clearedByKey = new Map<string, Cell>();
    for (const match of matches) {
      for (const cell of match.cells) {
        clearedByKey.set(`${cell.col},${cell.row}`, cell);
      }
    }
    const cleared = Array.from(clearedByKey.values());
    for (const cell of cleared) {
      this.setCell(cell.col, cell.row, null);
    }
    return cleared;
  }

  /** Lets candies fall straight down into EMPTY cells below them, column by
   * column, preserving relative order. Returns the moves that occurred. */
  applyGravity(): Move[] {
    const moves: Move[] = [];
    for (let col = 0; col < this.cols; col++) {
      let writeRow = this.rows - 1;
      for (let row = this.rows - 1; row >= 0; row--) {
        const type = this.grid[row][col];
        if (type === null) {
          continue;
        }
        if (writeRow !== row) {
          this.setCell(col, writeRow, type);
          this.setCell(col, row, null);
          moves.push({ from: { col, row }, to: { col, row: writeRow } });
        }
        writeRow--;
      }
    }
    return moves;
  }

  /** Fills remaining EMPTY cells with random candies. Does not avoid creating
   * matches — cascades formed by refill are intentional. */
  refill(): Spawn[] {
    const spawns: Spawn[] = [];
    for (let col = 0; col < this.cols; col++) {
      for (let row = 0; row < this.rows; row++) {
        if (this.grid[row][col] !== null) {
          continue;
        }
        const type = Math.floor(this.rng() * this.candyTypeCount) as CandyType;
        this.setCell(col, row, type);
        spawns.push({ cell: { col, row }, type });
      }
    }
    return spawns;
  }

  /** Runs findMatches → clear → gravity → refill until no matches remain.
   * Throws if it can't stabilize within MAX_CASCADE_ITERATIONS (likely a bug). */
  resolve(): CascadeStep[] {
    const steps: CascadeStep[] = [];

    while (true) {
      const matches = this.findMatches();
      if (matches.length === 0) {
        return steps;
      }
      if (steps.length >= MAX_CASCADE_ITERATIONS) {
        throw new Error(`Board.resolve: exceeded ${MAX_CASCADE_ITERATIONS} cascade iterations`);
      }

      const cleared = this.clearMatches(matches);
      const moves = this.applyGravity();
      const spawns = this.refill();
      steps.push({ matches, cleared, moves, spawns });
    }
  }

  /** Reshuffles the existing candies in place (same multiset of types) until
   * the board has no pre-existing matches and at least one valid move. */
  reshuffle(): void {
    const types: CandyType[] = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const type = this.grid[row][col];
        if (type !== null) {
          types.push(type);
        }
      }
    }

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      this.shuffleInPlace(types);
      let i = 0;
      for (let row = 0; row < this.rows; row++) {
        for (let col = 0; col < this.cols; col++) {
          if (this.grid[row][col] !== null) {
            this.setCell(col, row, types[i]);
            i++;
          }
        }
      }
      if (this.hasAnyValidMove() && this.findMatches().length === 0) {
        return;
      }
    }
    throw new Error(`Board.reshuffle: failed to find a valid arrangement after ${MAX_GENERATION_ATTEMPTS} attempts`);
  }

  private isAdjacent(a: Cell, b: Cell): boolean {
    const dCol = Math.abs(a.col - b.col);
    const dRow = Math.abs(a.row - b.row);
    return (dCol === 1 && dRow === 0) || (dCol === 0 && dRow === 1);
  }

  hasAnyValidMove(): boolean {
    return this.findAnyValidMove() !== null;
  }

  /** Scans for an adjacent swap that would create a match, returning the
   * first one found (in row-major, right-then-down order), or null if the
   * board is dead. */
  findAnyValidMove(): ValidMove | null {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (col + 1 < this.cols && this.wouldSwapCreateMatch(col, row, col + 1, row)) {
          return { a: { col, row }, b: { col: col + 1, row } };
        }
        if (row + 1 < this.rows && this.wouldSwapCreateMatch(col, row, col, row + 1)) {
          return { a: { col, row }, b: { col, row: row + 1 } };
        }
      }
    }
    return null;
  }

  private wouldSwapCreateMatch(colA: number, rowA: number, colB: number, rowB: number): boolean {
    const a = this.getCell(colA, rowA);
    const b = this.getCell(colB, rowB);
    this.setCell(colA, rowA, b);
    this.setCell(colB, rowB, a);

    const created = this.hasMatchAt(colA, rowA) || this.hasMatchAt(colB, rowB);

    this.setCell(colA, rowA, a);
    this.setCell(colB, rowB, b);

    return created;
  }
}
