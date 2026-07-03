# SLICE 1 SPEC — Project Setup + Board Model + Static Render

## Objective
A deployable page showing a valid 8×8 candy board. No interaction yet.

## Deliverables

### 1. Project scaffold
- Vite + TypeScript + Phaser 3 project
- Vitest configured for unit tests
- Scripts: `dev`, `build`, `test`
- Folder structure:
  ```
  src/
    logic/      (pure TS, NO Phaser imports)
    scenes/     (Phaser scenes)
    main.ts
  tests/
  ```

### 2. Logic layer (`src/logic/`)
- `CandyType` enum with 6 values (e.g. RED, ORANGE, YELLOW, GREEN, BLUE, PURPLE)
- `Board` class:
  - Constructor takes `(cols: number, rows: number, rng: () => number)`
  - `generate()`: fills grid with random candies such that:
    - NO pre-existing 3-in-a-row matches (horizontal or vertical)
    - At least one valid move exists (a swap that would create a match)
    - If no valid move after generation, regenerate
  - `getCell(col, row): CandyType`
  - `hasMatchAt(col, row): boolean` (helper used by generation)
  - `hasAnyValidMove(): boolean`
- Seeded RNG utility (`mulberry32` or similar) so tests are reproducible

### 3. Render layer (`src/scenes/`)
- Single Phaser scene `BoardScene`
- Renders the 8×8 board using simple colored rounded rectangles or circles
  (NO sprite assets yet — placeholder shapes only, one color per CandyType)
- Board centered in the canvas, responsive enough for mobile width (~380px)

### 4. Tests (Vitest, logic layer only)
- Board dimensions correct
- Generated board contains no matches (run 100 seeds)
- Generated board always has at least one valid move (run 100 seeds)
- Same seed → identical board (determinism)

## Acceptance Criteria
- `npm run dev` shows the board in browser
- `npm run test` passes all tests
- `npm run build` produces a static bundle deployable to Vercel
- Zero Phaser imports anywhere inside `src/logic/` (grep check)

## Out of Scope (do NOT build yet)
- Swapping, input handling, animation, score, sound, real art

## After Completion
Update HANDOFF.md STATUS + DECISIONS, note any deviations.
