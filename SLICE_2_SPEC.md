# SLICE 2 SPEC — Swap Input + Match Detection + Clear (Instant)

## Objective
Player can swap two adjacent candies. Valid swaps clear matches instantly
(cleared cells become EMPTY holes). Invalid swaps revert. No gravity/refill
yet — that's SLICE 3. The board will fill with holes as you play; that's fine.

## Prerequisite
SLICE 1 complete and eyeball-verified.

## Deliverables

### 1. Logic layer additions (`src/logic/`, still zero Phaser imports)

- Extend cell model to allow `EMPTY` (either add to CandyType enum or use
  `CandyType | null` — builder's choice, document in HANDOFF).
- `Board.findMatches(): Match[]`
  - Scans all rows and columns for runs of 3+ identical (non-empty) candies
  - A `Match` is `{ cells: {col, row}[], type: CandyType }`
  - A candy belonging to both a horizontal and vertical run appears in both
    matches (dedupe happens at clear time)
- `Board.swap(a: Cell, b: Cell): SwapResult`
  - Only adjacent (orthogonal) cells are swappable; non-adjacent → `{ ok: false, reason: 'not-adjacent' }`
  - Swapping with an EMPTY cell is not allowed
  - Perform swap, run findMatches:
    - If matches found: clear all matched cells (set EMPTY), return
      `{ ok: true, cleared: Cell[], matches: Match[] }`
    - If none: revert the swap, return `{ ok: false, reason: 'no-match' }`
- Pure functions where possible; swap mutates board state only on success.

### 2. Render/input layer (`src/scenes/BoardScene`)

- Input mode A (tap-tap): tap candy 1 (highlight it), tap adjacent candy 2 → attempt swap.
  Tapping a non-adjacent candy moves the highlight instead.
- Input mode B (drag): drag a candy one cell in any orthogonal direction → attempt swap.
  Implement BOTH modes; they coexist naturally on touch + mouse.
- On successful swap: re-render board (cleared cells show as empty slots on the panel).
- On failed swap: brief visual shake or flash on the two cells (simple tween is fine,
  full animation polish is SLICE 5).
- EMPTY cells render as subtle empty sockets, not invisible.

### 3. Tests (Vitest, logic only)

- findMatches: horizontal 3, vertical 3, run of 4/5 counted as one match,
  L/T intersections produce both matches, empty cells never match
- swap: non-adjacent rejected, no-match swap reverts board to identical state,
  valid swap clears exactly the matched cells and leaves rest untouched
- Regression: SLICE 1 tests still pass
- Determinism: same seed + same swap sequence → identical board state

## Acceptance Criteria
- I can play in the browser: make matches, see them vanish, invalid swaps bounce back
- All tests green; still zero Phaser imports in src/logic/ (grep check)
- `npm run build` succeeds

## Out of Scope
- Gravity, refill, cascades (SLICE 3); score (SLICE 4); real animations/sound (SLICE 5)

## After Completion
Update HANDOFF.md STATUS + DECISIONS (note EMPTY representation choice).
