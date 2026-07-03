# SLICE 4 SPEC — Score, Move Counter, Win/Lose

## Objective
The game becomes a real level: a target score, limited moves, win and lose
screens, restart. Still one hardcoded level (level system comes in SLICE 6).

## Prerequisite
SLICE 3 complete and eyeball-verified.

## Deliverables

### 1. Logic layer additions (`src/logic/`, still zero Phaser imports)

- `ScoreRules` (pure functions / constants module):
  - Base: 60 points per cleared candy
  - Run bonus: match of 4 = +40 per candy in that run; match of 5+ = +100 per candy
  - Cascade multiplier: step 1 = x1, step 2 = x2, step 3 = x3... applied to
    all points earned in that step
  - Document formula in code comments so tuning later is easy
- `GameState` class (wraps a Board):
  - Config: `{ targetScore: number, maxMoves: number, seed: number }`
  - Hardcoded default level for v1: targetScore 2500, maxMoves 20
    (builder: playtest-tune this if it's way too easy/hard, note in HANDOFF)
  - `attemptSwap(a, b)`:
    - Delegates to Board.swap
    - Failed/invalid swaps DO NOT consume a move
    - Successful swaps consume 1 move and add score from cascade steps
  - `status: 'playing' | 'won' | 'lost'`
    - won: score >= targetScore (check after each move resolves)
    - lost: moves exhausted and score < targetScore
    - Once won/lost, further swaps are rejected
  - Score keeps accumulating past target on the winning move (final cascade
    counts fully)
- `GameState.reset(seed?)` for restart

### 2. Render layer

- HUD above/below board: current score, target score, moves remaining
  - Moves remaining turns visually urgent (e.g. red) at <= 5
- Score popup on each cascade step near the matched cells: "+240" style
  floating text (simple fade/rise, polish later)
- Win screen overlay: "You Win!", final score, [Play Again] button
- Lose screen overlay: "Out of Moves", final score vs target, [Try Again] button
- Play Again / Try Again resets with a NEW random seed
- Board input disabled while an overlay is shown

### 3. Tests (Vitest, logic only)

- Scoring: 3-match base points; 4-run and 5-run bonuses; constructed 2-step
  cascade applies x1 then x2 multiplier correctly
- Moves: failed swap consumes nothing; successful swap consumes exactly 1
- Win: crossing targetScore sets status 'won'; further swaps rejected
- Lose: exhausting moves below target sets 'lost'; further swaps rejected
- Winning-move cascade: score counts all cascade steps even if target is
  crossed mid-cascade
- Reset: returns to fresh playable state
- Regression: all 23 prior tests still pass

## Acceptance Criteria
- In browser: I can win a game and lose a game (builder: verify both paths
  headlessly by seeding/engineering states, plus normal playthrough)
- HUD updates live; overlays block input; restart works repeatedly
- All tests green; zero Phaser imports in src/logic/; build succeeds

## Out of Scope
- Multiple levels & level select (SLICE 6), animations/sound (SLICE 5),
  special candies (SLICE 6), persistence/high scores (post-v1)

## After Completion
Update HANDOFF.md STATUS + DECISIONS (note any score tuning changes).
