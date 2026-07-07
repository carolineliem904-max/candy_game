# SLICE 8 SPEC — Level Goals & Expanded Levels

## Objective
Levels get real objectives beyond score: collection goals ("collect 20 red
cars") and jelly-clearing goals, plus an expanded 20-level set designed
around them. This is what makes levels feel DIFFERENT, not just harder.

## Checkpoint 0 — Sprite quality fix (before anything else)
- Sprites render pixelated: almost certainly `pixelArt: true` left in the
  Phaser config from the old pixel-sprite era — remove it (and any
  nearest-neighbor texture filter settings) so high-res sprites scale
  smoothly
- Verify trimmed PNGs retain enough resolution (source ≥ 2x the ~38px
  render size is fine; they are, at ~300px)
- Screenshot before/after crop for Caroline

## Goal Types (logic layer)

### 1. Score goal (existing — unchanged)
`{ kind: 'score', target: number }`

### 2. Collection goal (NEW)
`{ kind: 'collect', pieces: { [CandyType]: count } }`
e.g. collect 20 RED + 15 BLUE. Every cleared piece of that type counts,
regardless of how it cleared (match, special effect, cascade).
Win when all counts reached (moves remaining allowed to be > 0).

### 3. Jelly goal (NEW)
`{ kind: 'jelly' }` — some cells start covered in jelly (single layer, v1).
Clearing a match/special effect ON a jelly cell removes its jelly.
Win when zero jelly remains.

Combined goals: a level has ONE primary goal kind (keep v1 simple).
All goal kinds still have maxMoves; lose = moves out before goal met.
Score is always tracked and still drives stars (see Stars below).

## Build Checkpoints (in order, tests green at each)

### Checkpoint 1 — Goal engine (logic only)
- `LevelGoal` union type on LevelDef; GameState tracks goal progress
- Collection: resolve() steps already report cleared cells — tally by type
- Jelly: Board gains a jelly layer `boolean[][]` initialized from LevelDef
  (`jellyCells: {col,row}[]`); any clear event on that cell removes jelly;
  jelly does NOT block swapping/falling in v1 (visual layer + win condition
  only — blockers are post-v1)
- Win checks per goal kind; lose unchanged
- Stars for goal levels: based on moves REMAINING at win (0 left = 1 star,
  1-3 left = 2 stars, 4+ = 3 stars); score levels keep score thresholds
- Tests: collection tally incl. cascade/special clears; jelly removal incl.
  via special effects; win/lose per kind; star boundaries per kind;
  determinism; regression 73/73

### Checkpoint 2 — Level set expansion (data + tuning)
- Expand levels.ts to 20 levels, interleaving goal kinds:
  L1-4 existing score levels (unchanged); L5 first collect level (gentle:
  one type, generous moves); L6-20 mix: ~7 score, ~7 collect, ~6 jelly,
  difficulty via targets/move budgets/jelly coverage patterns (corners and
  edges are harder to hit — use for later levels)
- Keep ALL numbers in the one table; Caroline retunes after playtest
- Builder: auto-playthrough sanity check — every level must be winnable by
  the random-move bot within 200 attempts (proves no impossible levels)

### Checkpoint 3 — Rendering & UX
- HUD shows goal instead of just score for goal levels:
  collect: piece icon + "12/20" counters (tick down live, small pop on
  progress); jelly: "Jelly: 14 left" counter
- Jelly cells: translucent wobbly blue-ish overlay on the tile (programmatic,
  cute not gross), removal gets a splat/pop animation + sound
- Level map: small icon per node showing goal kind (⭐ score / 🚗 collect /
  🟦 jelly)
- Level intro popup on start: goal statement in one line ("Collect 20 red
  cars!") with piece sprite, tap to begin
- Win overlay: goal-aware message

### Checkpoint 4 — Verification & ship
- Full headless pass: one level of each kind played to win and to lose
- All tests green (expect ~90+), build clean, commit, deploy
- HANDOFF updated: goal engine design, level table, bot-winnability results

## Out of Scope (post-v1 backlog, unchanged)
Boosters (sprites already waiting in /future/), blockers that affect
gameplay (multi-layer jelly, chocolate), combined goals, timed levels,
level goal editor.

## After Completion
Caroline + son playtest L1-L20. Son's favorite goal kind determines
what post-v1 leans into.
