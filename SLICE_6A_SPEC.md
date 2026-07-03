# SLICE 6A SPEC — Level System & Progression

## Objective
Candy Crush-style progression: numbered levels with increasing difficulty,
a level-complete screen that advances to the next level, a simple level map,
and progress saved in the browser.

## Prerequisite
SLICE 5 complete. Vercel deploy live.

## Deliverables

### 1. Logic layer (`src/logic/`)

- `LevelDef` type: `{ id, targetScore, maxMoves, candyTypes }`
  - `candyTypes`: number of candy types in play (5 = easier, 6 = standard).
    Board already takes types via enum — parameterize count used in
    generation/refill.
- `levels.ts`: hand-authored array of 10 levels, difficulty curve:
  - L1: 5 types, 3000 target, 15 moves  (gentle intro — 5 types = more matches)
  - L2: 5 types, 4500 / 15
  - L3: 6 types, 4500 / 15  (6th type introduced = real difficulty step)
  - L4: 6 types, 6000 / 15  (current tuned game = level 4)
  - L5–L10: escalate target (+~1200/level) with moves 15, dipping to 14 at
    L8+. Builder: keep numbers in one table, trivially editable — Caroline
    WILL retune after playtesting.
- `GameState` takes a `LevelDef` instead of hardcoded config
- `GameProgress` (pure logic, storage-agnostic):
  - `{ highestUnlocked: number, stars: Record<levelId, 1|2|3> }`
  - Stars: 1 = reached target, 2 = target ×1.3, 3 = target ×1.6
    (computed by pure function, tested)
  - `completeLevel(progress, levelId, score)` returns NEW progress object
    (pure; persistence handled by adapter below)

### 2. Persistence adapter (`src/storage/`)

- Small wrapper over `localStorage` (fine here — standalone Vite app, not a
  Claude artifact): `loadProgress()`, `saveProgress(p)` with try/catch
  fallback to in-memory (private browsing safety)
- Logic layer never imports it directly — scenes wire it together

### 3. Scenes

- `LevelMapScene` (new start screen):
  - Simple vertical/winding path of numbered level nodes (drawn shapes fine)
  - Locked levels grayed with lock icon; unlocked tappable; stars shown
    under completed levels
  - Tapping a node starts that level
- `BoardScene` gains level context:
  - HUD shows "Level N" + that level's target/moves
  - Win overlay becomes Level Complete: stars earned (animated in one by
    one), score, [Next Level] + [Level Map] buttons; on final level, a
    simple "You finished all levels!" state with [Level Map]
  - Lose overlay: [Try Again] + [Level Map]
  - Completing a level unlocks the next and persists progress
- Keyboard/back: level map is always reachable; no dead ends

### 4. Tests
- Star thresholds (boundaries exact: score == target×1.3 → 2 stars, etc.)
- completeLevel: unlocks next, keeps best stars (replaying and scoring worse
  never downgrades stars), never re-locks
- GameState with different LevelDefs (5-type board generates only 5 types)
- Storage adapter: save/load roundtrip, corrupted JSON falls back cleanly
- Regression: all 39 prior tests pass (update any that assumed hardcoded
  6000/15 config)

## Acceptance Criteria
- Fresh browser: only L1 unlocked → play → Level Complete with stars →
  Next Level → L2, and progress survives a page reload
- Losing never unlocks; replaying can improve stars but not lose them
- All tests green; build succeeds; logic layer still Phaser-free

## Out of Scope
- Special candies (SLICE 6B), level-specific goals like "clear the jelly"
  (post-v1 — note: these are what make real Candy Crush levels distinct;
  v1 levels differ by numbers only, and that's OK)

## After Completion
Update HANDOFF.md. Deploy. Caroline playtests the difficulty curve L1–L10.
