import { CandyType, CANDY_TYPE_COUNT } from "./CandyType";
import type { RNG } from "./rng";

const MAX_GENERATION_ATTEMPTS = 1000;
const MAX_CASCADE_ITERATIONS = 50;

export interface Cell {
  col: number;
  row: number;
}

/** Special candy kinds. Orientation for striped is baked into the kind
 * (stripedH clears its row, stripedV clears its column) rather than stored
 * as a separate field — simpler for the many switch sites that need it. */
export type SpecialKind = "stripedH" | "stripedV" | "wrapped" | "bomb";

/** An occupied cell. `type` is null only for a color bomb (it has no color
 * of its own, per spec, so it never joins a color-based match). */
export interface Candy {
  type: CandyType | null;
  special: SpecialKind | null;
}

/** A grid cell holds a Candy, or null for an EMPTY (cleared) socket. */
export type GridCell = Candy | null;

export interface Match {
  cells: Cell[];
  type: CandyType;
  orientation: "horizontal" | "vertical";
}

export interface Move {
  from: Cell;
  to: Cell;
}

export interface Spawn {
  cell: Cell;
  type: CandyType;
}

export interface SpecialCreation {
  cell: Cell;
  special: SpecialKind;
  type: CandyType;
}

/** A special that activated (fired its effect) during a cascade step, either
 * because it was part of a color match or because another special's effect
 * hit its cell. `cellsCleared` includes the special's own cell. */
export interface SpecialActivation {
  cell: Cell;
  special: SpecialKind;
  type: CandyType | null;
  cellsCleared: Cell[];
}

export interface CascadeStep {
  matches: Match[];
  activations: SpecialActivation[];
  specialsCreated: SpecialCreation[];
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

interface CascadeSeedActivation {
  cell: Cell;
  targetColor: CandyType | null;
}

function cellKey(cell: Cell): string {
  return `${cell.col},${cell.row}`;
}

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
          this.setCell(col, row, { type: candidate, special: null });
          if (!this.hasMatchAt(col, row)) {
            chosen = candidate;
            break;
          }
        }
        this.setCell(col, row, { type: chosen, special: null });
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

  /** The color at a cell for matching purposes: undefined if out of bounds,
   * null if EMPTY or an occupied-but-colorless candy (a color bomb). */
  private colorAt(col: number, row: number): CandyType | null | undefined {
    const cell = this.safeGet(col, row);
    if (cell === undefined) {
      return undefined;
    }
    return cell === null ? null : cell.type;
  }

  getCell(col: number, row: number): GridCell {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      throw new RangeError(`getCell: (${col}, ${row}) is out of bounds`);
    }
    return this.grid[row][col];
  }

  private setCell(col: number, row: number, cell: GridCell): void {
    this.grid[row][col] = cell;
  }

  hasMatchAt(col: number, row: number): boolean {
    const color = this.colorAt(col, row);
    if (color === undefined || color === null) {
      return false;
    }

    let horizontalRun = 1;
    for (let c = col - 1; this.colorAt(c, row) === color; c--) horizontalRun++;
    for (let c = col + 1; this.colorAt(c, row) === color; c++) horizontalRun++;
    if (horizontalRun >= 3) {
      return true;
    }

    let verticalRun = 1;
    for (let r = row - 1; this.colorAt(col, r) === color; r--) verticalRun++;
    for (let r = row + 1; this.colorAt(col, r) === color; r++) verticalRun++;
    return verticalRun >= 3;
  }

  /** Scans the whole board for runs of 3+ same-colored candies (specials
   * count as their own color, per spec). Cells shared by a horizontal and
   * vertical run appear in both matches. */
  findMatches(): Match[] {
    const matches: Match[] = [];

    for (let row = 0; row < this.rows; row++) {
      let col = 0;
      while (col < this.cols) {
        const color = this.colorAt(col, row);
        if (color === null || color === undefined) {
          col++;
          continue;
        }
        let runEnd = col;
        while (runEnd + 1 < this.cols && this.colorAt(runEnd + 1, row) === color) runEnd++;
        if (runEnd - col + 1 >= 3) {
          const cells: Cell[] = [];
          for (let c = col; c <= runEnd; c++) cells.push({ col: c, row });
          matches.push({ cells, type: color, orientation: "horizontal" });
        }
        col = runEnd + 1;
      }
    }

    for (let col = 0; col < this.cols; col++) {
      let row = 0;
      while (row < this.rows) {
        const color = this.colorAt(col, row);
        if (color === null || color === undefined) {
          row++;
          continue;
        }
        let runEnd = row;
        while (runEnd + 1 < this.rows && this.colorAt(col, runEnd + 1) === color) runEnd++;
        if (runEnd - row + 1 >= 3) {
          const cells: Cell[] = [];
          for (let r = row; r <= runEnd; r++) cells.push({ col, row: r });
          matches.push({ cells, type: color, orientation: "vertical" });
        }
        row = runEnd + 1;
      }
    }

    return matches;
  }

  /** Swaps two orthogonally adjacent, non-empty cells.
   * - Both cells special: always succeeds (bomb+bomb clears the whole
   *   board; any other special+special pair just activates both in place).
   * - Exactly one cell a color bomb: always succeeds, clearing every candy
   *   of the other candy's color.
   * - Otherwise: normal color-match swap, reverting if it creates no match. */
  swap(a: Cell, b: Cell): SwapResult {
    if (!this.isAdjacent(a, b)) {
      return { ok: false, reason: "not-adjacent" };
    }

    const cellA = this.getCell(a.col, a.row);
    const cellB = this.getCell(b.col, b.row);
    if (cellA === null || cellB === null) {
      return { ok: false, reason: "empty-cell" };
    }

    if (cellA.special !== null && cellB.special !== null) {
      this.setCell(a.col, a.row, cellB);
      this.setCell(b.col, b.row, cellA);
      const steps = this.resolveFromSpecialSwap(a, cellB, b, cellA);
      return this.finishSwap(steps);
    }

    if (cellA.special === "bomb" || cellB.special === "bomb") {
      this.setCell(a.col, a.row, cellB);
      this.setCell(b.col, b.row, cellA);
      // cellA (originally at `a`) now lives at `b`, and vice versa — the
      // bomb's post-swap position is the *other* cell from where it started.
      const bombCell = cellA.special === "bomb" ? b : a;
      const targetColor = cellA.special === "bomb" ? cellB.type : cellA.type;
      const steps = this.resolveFromBombSwap(bombCell, targetColor as CandyType);
      return this.finishSwap(steps);
    }

    this.setCell(a.col, a.row, cellB);
    this.setCell(b.col, b.row, cellA);

    if (this.findMatches().length === 0) {
      this.setCell(a.col, a.row, cellA);
      this.setCell(b.col, b.row, cellB);
      return { ok: false, reason: "no-match" };
    }

    const steps = this.resolve([a, b]);
    return this.finishSwap(steps);
  }

  private finishSwap(steps: CascadeStep[]): SwapResult {
    let reshuffled = false;
    if (!this.hasAnyValidMove()) {
      this.reshuffle();
      reshuffled = true;
    }
    return { ok: true, steps, reshuffled };
  }

  private resolveFromBombSwap(bombCell: Cell, targetColor: CandyType): CascadeStep[] {
    const first = this.runCascadeStep({ matches: [], seedActivations: [{ cell: bombCell, targetColor }] });
    return [first, ...this.resolve()];
  }

  private resolveFromSpecialSwap(posA: Cell, candyAtA: Candy, posB: Cell, candyAtB: Candy): CascadeStep[] {
    const bothBombs = candyAtA.special === "bomb" && candyAtB.special === "bomb";
    const first = bothBombs
      ? this.runCascadeStep({ matches: [], forcedClearAll: true, forcedClearAllOrigins: [posA, posB] })
      : this.runCascadeStep({
          matches: [],
          seedActivations: [
            { cell: posA, targetColor: candyAtB.type },
            { cell: posB, targetColor: candyAtA.type },
          ],
        });
    return [first, ...this.resolve()];
  }

  /** Runs findMatches → runCascadeStep until no matches remain. `movedCells`
   * (if given) is only consulted for the very first step — every step after
   * that is cascade-created. Throws if it can't stabilize within
   * MAX_CASCADE_ITERATIONS (likely a bug). */
  resolve(movedCells?: [Cell, Cell]): CascadeStep[] {
    const steps: CascadeStep[] = [];
    let first = true;

    while (true) {
      const matches = this.findMatches();
      if (matches.length === 0) {
        return steps;
      }
      if (steps.length >= MAX_CASCADE_ITERATIONS) {
        throw new Error(`Board.resolve: exceeded ${MAX_CASCADE_ITERATIONS} cascade iterations`);
      }

      const step = this.runCascadeStep({ matches, movedCells: first ? movedCells : undefined });
      steps.push(step);
      first = false;
    }
  }

  /** Resolves one cascade step: classifies matches into new specials,
   * activates any specials caught in the match or seeded explicitly (BFS
   * chain through further specials hit by an effect), clears everything,
   * then applies gravity + refill. */
  private runCascadeStep(params: {
    matches: Match[];
    movedCells?: [Cell, Cell];
    seedActivations?: CascadeSeedActivation[];
    forcedClearAll?: boolean;
    forcedClearAllOrigins?: Cell[];
  }): CascadeStep {
    const matchedCells = new Map<string, Cell>();
    for (const match of params.matches) {
      for (const cell of match.cells) matchedCells.set(cellKey(cell), cell);
    }

    const specialsCreated = this.computeSpecialCreations(params.matches, params.movedCells);
    const spawnKeys = new Set(specialsCreated.map((s) => cellKey(s.cell)));

    const activations: SpecialActivation[] = [];
    const toClear = new Map<string, Cell>();

    if (params.forcedClearAll) {
      for (let row = 0; row < this.rows; row++) {
        for (let col = 0; col < this.cols; col++) {
          if (this.grid[row][col] !== null) {
            toClear.set(`${col},${row}`, { col, row });
          }
        }
      }
      const wholeBoard = Array.from(toClear.values());
      for (const origin of params.forcedClearAllOrigins ?? []) {
        activations.push({ cell: origin, special: "bomb", type: null, cellsCleared: wholeBoard });
      }
    } else {
      const activated = new Set<string>();
      const queue: CascadeSeedActivation[] = [];

      for (const [, cell] of matchedCells) {
        const candy = this.getCell(cell.col, cell.row);
        if (candy && candy.special !== null) {
          queue.push({ cell, targetColor: null });
        }
      }
      if (params.seedActivations) {
        queue.push(...params.seedActivations);
      }

      while (queue.length > 0) {
        const { cell, targetColor } = queue.shift()!;
        const key = cellKey(cell);
        if (activated.has(key)) {
          continue;
        }
        const candy = this.getCell(cell.col, cell.row);
        if (!candy || candy.special === null) {
          continue;
        }
        activated.add(key);

        const effectCells = this.effectCellsFor(cell, candy, targetColor);
        activations.push({ cell, special: candy.special, type: candy.type, cellsCleared: effectCells });

        for (const effectCell of effectCells) {
          const effectKey = cellKey(effectCell);
          toClear.set(effectKey, effectCell);
          if (!activated.has(effectKey)) {
            const effectCandy = this.getCell(effectCell.col, effectCell.row);
            if (effectCandy && effectCandy.special !== null) {
              queue.push({ cell: effectCell, targetColor: null });
            }
          }
        }
      }
    }

    const clearedMap = new Map<string, Cell>();
    for (const [key, cell] of matchedCells) clearedMap.set(key, cell);
    for (const [key, cell] of toClear) clearedMap.set(key, cell);
    for (const key of spawnKeys) clearedMap.delete(key);
    const cleared = Array.from(clearedMap.values());

    for (const cell of cleared) {
      this.setCell(cell.col, cell.row, null);
    }
    for (const creation of specialsCreated) {
      this.setCell(creation.cell.col, creation.cell.row, { type: creation.type, special: creation.special });
    }

    const moves = this.applyGravity();
    const spawns = this.refill();

    return { matches: params.matches, activations, specialsCreated, cleared, moves, spawns };
  }

  /** Returns the cells a special's effect clears (including its own cell).
   * `targetColor` is only meaningful for a bomb: null means it was chain-hit
   * with no color context, so it just pops itself. */
  private effectCellsFor(cell: Cell, candy: Candy, targetColor: CandyType | null): Cell[] {
    switch (candy.special) {
      case "stripedH": {
        const cells: Cell[] = [];
        for (let c = 0; c < this.cols; c++) cells.push({ col: c, row: cell.row });
        return cells;
      }
      case "stripedV": {
        const cells: Cell[] = [];
        for (let r = 0; r < this.rows; r++) cells.push({ col: cell.col, row: r });
        return cells;
      }
      case "wrapped": {
        const cells: Cell[] = [];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const c = cell.col + dc;
            const r = cell.row + dr;
            if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
              cells.push({ col: c, row: r });
            }
          }
        }
        return cells;
      }
      case "bomb": {
        if (targetColor === null) {
          return [cell];
        }
        const cells: Cell[] = [cell];
        for (let row = 0; row < this.rows; row++) {
          for (let col = 0; col < this.cols; col++) {
            if (col === cell.col && row === cell.row) continue;
            if (this.colorAt(col, row) === targetColor) cells.push({ col, row });
          }
        }
        return cells;
      }
      default:
        return [cell];
    }
  }

  /** Groups matches that share a cell into clusters (an L/T intersection is
   * a 2+-match cluster), then decides what special (if any) each cluster
   * creates: 5-line -> bomb, multi-match cluster -> wrapped, lone 4-run ->
   * striped, lone 3-run -> nothing. Priority (5-line > L/T > 4-run) falls
   * out of checking in that order. */
  private computeSpecialCreations(matches: Match[], movedCells?: [Cell, Cell]): SpecialCreation[] {
    const clusters = this.clusterMatches(matches);
    const creations: SpecialCreation[] = [];

    for (const cluster of clusters) {
      const bombMatch = cluster.find((m) => m.cells.length >= 5);
      if (bombMatch) {
        const cell = this.pickSpawnCell(bombMatch.cells, movedCells);
        creations.push({ cell, special: "bomb", type: bombMatch.type });
        continue;
      }

      if (cluster.length >= 2) {
        const intersection = this.findIntersectionCell(cluster);
        const cell = intersection ?? this.pickSpawnCell(cluster[0].cells, movedCells);
        creations.push({ cell, special: "wrapped", type: cluster[0].type });
        continue;
      }

      const match = cluster[0];
      if (match.cells.length === 4) {
        const movedIn = movedCells?.find((mc) => match.cells.some((c) => c.col === mc.col && c.row === mc.row));
        let orientation: "stripedH" | "stripedV";
        let cell: Cell;
        if (movedIn && movedCells) {
          const [a, b] = movedCells;
          orientation = a.row === b.row ? "stripedH" : "stripedV";
          cell = movedIn;
        } else {
          orientation = match.orientation === "horizontal" ? "stripedH" : "stripedV";
          cell = match.cells[Math.floor((match.cells.length - 1) / 2)];
        }
        creations.push({ cell, special: orientation, type: match.type });
      }
    }

    return creations;
  }

  private pickSpawnCell(cells: Cell[], movedCells?: [Cell, Cell]): Cell {
    const found = movedCells?.find((mc) => cells.some((c) => c.col === mc.col && c.row === mc.row));
    return found ?? cells[Math.floor((cells.length - 1) / 2)];
  }

  private findIntersectionCell(cluster: Match[]): Cell | null {
    const seenCount = new Map<string, number>();
    const cellByKey = new Map<string, Cell>();
    for (const match of cluster) {
      for (const cell of match.cells) {
        const key = cellKey(cell);
        seenCount.set(key, (seenCount.get(key) ?? 0) + 1);
        cellByKey.set(key, cell);
      }
    }
    for (const [key, count] of seenCount) {
      if (count >= 2) return cellByKey.get(key)!;
    }
    return null;
  }

  /** Union-find grouping of matches that share at least one cell. */
  private clusterMatches(matches: Match[]): Match[][] {
    const n = matches.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (i: number): number => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
    const union = (i: number, j: number) => {
      const ri = find(i);
      const rj = find(j);
      if (ri !== rj) parent[ri] = rj;
    };

    const cellToMatch = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      for (const cell of matches[i].cells) {
        const key = cellKey(cell);
        const existing = cellToMatch.get(key);
        if (existing !== undefined) {
          union(i, existing);
        } else {
          cellToMatch.set(key, i);
        }
      }
    }

    const groups = new Map<number, Match[]>();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      const list = groups.get(root) ?? [];
      list.push(matches[i]);
      groups.set(root, list);
    }
    return Array.from(groups.values());
  }

  /** Lets candies fall straight down into EMPTY cells below them, column by
   * column, preserving relative order. Returns the moves that occurred. */
  applyGravity(): Move[] {
    const moves: Move[] = [];
    for (let col = 0; col < this.cols; col++) {
      let writeRow = this.rows - 1;
      for (let row = this.rows - 1; row >= 0; row--) {
        const cell = this.grid[row][col];
        if (cell === null) {
          continue;
        }
        if (writeRow !== row) {
          this.setCell(col, writeRow, cell);
          this.setCell(col, row, null);
          moves.push({ from: { col, row }, to: { col, row: writeRow } });
        }
        writeRow--;
      }
    }
    return moves;
  }

  /** Fills remaining EMPTY cells with random (non-special) candies. Does not
   * avoid creating matches — cascades formed by refill are intentional. */
  refill(): Spawn[] {
    const spawns: Spawn[] = [];
    for (let col = 0; col < this.cols; col++) {
      for (let row = 0; row < this.rows; row++) {
        if (this.grid[row][col] !== null) {
          continue;
        }
        const type = Math.floor(this.rng() * this.candyTypeCount) as CandyType;
        this.setCell(col, row, { type, special: null });
        spawns.push({ cell: { col, row }, type });
      }
    }
    return spawns;
  }

  /** Reshuffles the existing candies in place (same multiset of Candy
   * objects, specials included) until the board has no pre-existing matches
   * and at least one valid move. */
  reshuffle(): void {
    const candies: Candy[] = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cell = this.grid[row][col];
        if (cell !== null) {
          candies.push(cell);
        }
      }
    }

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      this.shuffleInPlace(candies);
      let i = 0;
      for (let row = 0; row < this.rows; row++) {
        for (let col = 0; col < this.cols; col++) {
          if (this.grid[row][col] !== null) {
            this.setCell(col, row, candies[i]);
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
   * board is dead. A cell holding a color bomb always has a valid move
   * available (any adjacent swap always succeeds), so it short-circuits the
   * scan rather than requiring a color-based match nearby. */
  findAnyValidMove(): ValidMove | null {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cell = this.grid[row]?.[col];
        if (cell?.special === "bomb") {
          if (col + 1 < this.cols) return { a: { col, row }, b: { col: col + 1, row } };
          if (row + 1 < this.rows) return { a: { col, row }, b: { col, row: row + 1 } };
          if (col - 1 >= 0) return { a: { col, row }, b: { col: col - 1, row } };
          if (row - 1 >= 0) return { a: { col, row }, b: { col, row: row - 1 } };
        }
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
