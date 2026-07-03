# SLICE 3 SPEC — Gravity, Refill, Cascades

## Objective
After a match clears, candies above fall down to fill holes, new candies
spawn from the top, and any new matches formed by falling candies clear
again — chaining until the board is stable. The board never has holes
after a move resolves.

## Prerequisite
SLICE 2 complete and eyeball-verified.

## Deliverables

### 1. Logic layer additions (`src/logic/`, still zero Phaser imports)

- `Board.applyGravity(): Move[]`
  - Per column, candies fall straight down into EMPTY cells below them
  - Returns list of moves `{ from: {col,row}, to: {col,row} }` (render layer
    will animate these in SLICE 5; for now they document what moved)
- `Board.refill(): Spawn[]`
  - Fills remaining EMPTY cells (all at top of columns after gravity) with
    random candies from the seeded RNG
  - Returns list of spawns `{ cell: {col,row}, type: CandyType }`
  - NOTE: refill does NOT need to avoid creating matches — matches formed
    by refill are part of cascade fun
- `Board.resolve(): CascadeStep[]`
  - The full loop: findMatches → clear → gravity → refill → repeat until
    findMatches returns empty
  - Returns ordered steps, each `{ matches, cleared, moves, spawns }`
  - Safety: hard cap at 50 iterations, throw if exceeded (indicates a bug)
- Refactor `Board.swap` to call `resolve()` after a successful initial clear,
  returning the cascade steps in SwapResult
- Dead-board rule: after resolve completes, if `hasAnyValidMove()` is false,
  reshuffle existing candies (same multiset of types) until a valid move
  exists AND no matches exist. Add `Board.reshuffle()` for this. Record
  `reshuffled: boolean` in the resolve result.

### 2. Render layer

- After a successful swap, re-render the final stable board state
- Instant rendering is fine (no fall animation yet — SLICE 5)
- BUT: display a brief cascade indicator, e.g. "Cascade x2!", "Cascade x3!"
  text popup when resolve returned more than one step (simple fade-out text)
- If reshuffle happened, show "Shuffled!" text briefly

### 3. Tests (Vitest, logic only)

- Gravity: single hole column, multiple holes same column, full column empty,
  holes in multiple columns; candies preserve relative order when falling
- Refill: after gravity+refill, zero EMPTY cells remain
- Resolve: constructed board where one clear triggers a known 2-step cascade
  resolves in exactly 2 steps with expected final state
- Resolve: seeded random playthrough of 50 moves never leaves holes and
  never exceeds iteration cap
- Reshuffle: constructed dead board reshuffles into one with a valid move,
  same candy multiset, no pre-existing matches
- Determinism: same seed + same swaps → identical cascade steps
- Regression: all SLICE 1 + 2 tests still pass

## Acceptance Criteria
- Playing in browser: matches clear, board fills back up, occasional lucky
  cascades happen with the "Cascade x2!" popup
- No holes ever remain visible after a move
- All tests green; zero Phaser imports in src/logic/; build succeeds

## Out of Scope
- Score/moves/win-lose (SLICE 4), animations & sound (SLICE 5), specials (SLICE 6)

## After Completion
Update HANDOFF.md STATUS + DECISIONS.
