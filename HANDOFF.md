# HANDOFF.md — Match-3 Game ("Sweet Cascade" — working title)

> Living project memory. Architect (Claude) designs slices; Builder (Claude Code / Codex) implements.
> Update the STATUS and DECISIONS sections after every slice.

## Project Overview
A browser-based match-3 puzzle game (Candy Crush-style mechanics, original art/name).
Built by Caroline (product owner / QA) with Claude Code as builder.

## Goals
- Learn game development fundamentals through a working, deployable game
- Portfolio piece deployed on Vercel
- NOT a Candy Crush clone for release: original name, original candy designs

## Tech Stack (LOCKED — do not change without Architect approval)
- Language: TypeScript
- Framework: Phaser 3 (latest stable) + Vite for bundling
- No backend for v1. Fully client-side.
- Deploy target: Vercel (static build)
- No external state libraries. Game state lives in plain TS classes.

## Architecture Principles
- Separate GAME LOGIC from RENDERING.
  - `src/logic/` — pure TypeScript, no Phaser imports. Board, matching, cascades, scoring.
  - `src/scenes/` — Phaser scenes that render logic state and forward input.
  - This makes logic unit-testable without a browser.
- Logic must be deterministic given a seeded RNG (pass RNG in, never call Math.random directly in logic).
- Every slice ships with tests for the logic layer (Vitest).

## Game Constants (v1)
- Grid: 8 columns × 8 rows
- Candy types: 6 (identified by enum, colors decided at render layer)
- Match rule: 3+ same type in a row or column
- Board must spawn with ZERO pre-existing matches and at least one valid move

## Slice Plan
- [x] SLICE 1: Board model + static rendering
- [x] SLICE 2: Swap input + match detection + clear (instant, no animation)
- [x] SLICE 3: Gravity, refill, cascade chains
- [x] SLICE 4: Score, move counter, win/lose screens
- [x] SLICE 5: Animations (tweens), sound, polish
- [x] SLICE 6A: Level system & progression (numbered levels, stars, localStorage)
- [x] SLICE 6B: Special candies
- [x] SLICE 7: Theme & art pass — "Beep Beep!" (vehicles)

## STATUS
- Current slice: SLICE 7 (vehicle theme/art pass, "Beep Beep!") — UI restyle and final custom sprite
  set both approved by Caroline, speed-line alignment bug fixed, committed and pushed to `main`.
  73/73 tests pass, build clean.
- Deployed URL: https://candygame-six.vercel.app — pushed to `main`, Vercel auto-deploy should pick up
  the new bundle shortly after the push; not yet independently re-verified against the live URL in
  this session (see Open Questions).

## DECISIONS LOG
- 2026-07-03: Stack locked (Phaser 3 + TS + Vite). Logic/render separation mandated.
- 2026-07-03: Loop.md workflow rejected for v1 (project too small, plan limits).
- 2026-07-03: SLICE 1 implemented — Vite/TS/Phaser scaffold, `Board` class with mulberry32-seeded
  RNG, cell-by-cell generation that tries a shuffled candy order per cell and rejects any choice
  `hasMatchAt` flags, then rejects whole boards via `hasAnyValidMove` (regenerates up to 1000
  attempts). `BoardScene` renders the 8×8 board as colored circles, canvas capped at 380px wide.
  4 Vitest tests (dimensions, no-match over 100 seeds, valid-move over 100 seeds, determinism) all
  pass; `npm run build` succeeds; grep confirms zero Phaser imports in `src/logic/`. Verified
  visually via a headless-Chromium screenshot (no console errors, no matches visible) since there's
  no interactive browser available in this session — Caroline should still eyeball `npm run dev`
  once. No deviations from spec.
- 2026-07-03: SLICE 2 implemented — EMPTY represented as `CandyType | null` (the `GridCell` type
  in `Board.ts`), not a 7th enum value, so match/generation logic only special-cases `null` at
  read/compare sites. `Board.findMatches()` scans rows then columns for runs ≥3, returning one
  `Match` per run (a cell at an L/T intersection appears in two separate matches, per spec).
  `Board.swap(a, b)` validates adjacency and rejects EMPTY-cell swaps before mutating, performs the
  swap, and either clears the union of all matched cells to EMPTY (`{ok:true, cleared, matches}`)
  or reverts (`{ok:false, reason:'no-match'}`). `BoardScene` now redraws the full board via a
  `Container` after any successful swap (no partial-diff rendering yet — fine for instant-clear,
  will need to change for SLICE 5 animations); EMPTY cells render as dark stroked sockets, not
  gaps. Both input modes coexist: tap-tap (pointerdown+pointerup with ~0 movement selects/swaps)
  and drag (movement past a `CELL_SIZE*0.3` threshold swaps in the dominant direction), driven by
  scene-level pointer listeners rather than per-candy hit areas (simpler to keep correct across
  full-board redraws). Failed swaps get a small x-axis shake tween on both candies. 10 new Vitest
  tests (findMatches: horizontal/vertical/run-of-4-5/L-T-intersection/no-empty-match; swap:
  non-adjacent/empty-cell/no-match-revert/exact-clear; determinism with a swap sequence) plus all
  4 SLICE 1 tests pass (14 total); `npm run build` succeeds; grep confirms zero Phaser imports in
  `src/logic/`. Verified interactively in headless Chromium via simulated mouse events (not just a
  static screenshot) — tap-tap valid swap clears the match, tap-tap invalid swap leaves the board
  byte-for-byte unchanged, and drag-swap clears a match too, across several repeated runs with
  fresh random boards; no console errors. No deviations from spec.
- 2026-07-03: SLICE 3 implemented — `Board.applyGravity()` compacts each column's non-null cells
  to the bottom independently (bottom-up scan, single write pointer per column), returning `Move[]`
  and preserving relative fall order. `Board.refill()` fills remaining EMPTY cells top-down with
  `rng()`-chosen candies (no match-avoidance, per spec — cascades from refill are intended).
  `Board.resolve()` loops findMatches → clear → gravity → refill until no matches remain, capped at
  50 iterations (throws past that, signaling a bug rather than looping forever); returns
  `CascadeStep[]`. `Board.swap()` was refactored: on a match it now calls `resolve()` and returns
  `{ok:true, steps, reshuffled}` instead of the old `{cleared, matches}` — a breaking shape change,
  so the SLICE 2 tests that asserted on `result.cleared`/`result.matches` were updated to read
  `result.steps[0]` instead (moved shared test fixtures into `tests/helpers.ts` to avoid duplicating
  the layout-builder across files). Dead-board handling: after `resolve()`, if `hasAnyValidMove()`
  is false, `Board.reshuffle()` re-shuffles the existing multiset of candies in place (Fisher-Yates
  via the seeded RNG) until both no-matches and a-valid-move-exists hold; `swap()` records this as
  `reshuffled: boolean`. `BoardScene` redraws the final stable state after a swap and shows a
  fading "Cascade x2!"-style popup when `steps.length > 1`, and/or a "Shuffled!" popup when
  `reshuffled` — queued sequentially (700ms apart) if both fire. 9 new Vitest tests in
  `tests/board-cascade.test.ts` (gravity: single/multiple/full-empty/multi-column holes with order
  preservation; refill: zero holes remain; resolve: a hand-constructed board — inert
  diagonal-stripe filler in columns 1-5, an R-run sandwiched between two O's in column 0 — verified
  to resolve in exactly 2 steps with the expected first-step match/cleared/moves, deterministic
  regardless of refill randomness; resolve: 50-move seeded playthrough never leaves holes or throws;
  reshuffle: a constructed dead board (diagonal `(col+row)%3` stripe pattern — a classic
  no-match/no-valid-move construction) reshuffles into a playable one with the same type multiset;
  determinism: identical seed + swap sequence → identical `SwapResult` including cascade steps) plus
  all 14 prior tests pass (23 total). `npm run build` succeeds; grep confirms zero Phaser imports in
  `src/logic/`. Verified in the browser two ways: (1) headless-Chromium simulated clicks on a live
  random board confirm an ordinary valid swap leaves no holes; (2) directly engineered the same
  2-step cascade scenario from the unit test into the live board and drove it through the real
  swap→resolve→render path, screenshotting the "Cascade x2!" popup rendering correctly over a fully
  refilled (no-holes) board, and separately confirmed the "Shuffled!" popup renders and a
  cascade+shuffle message pair queues correctly. No deviations from spec.
- 2026-07-03: SLICE 4 implemented — `ScoreRules.ts` (pure functions): points per candy = 60 base +
  run bonus (+40 for a run of 4, +100 for 5+), a step's score = sum over its matches of
  `match.cells.length * pointsPerCandy(match.cells.length)`, then multiplied by that step's
  1-indexed cascade multiplier (step1 x1, step2 x2...); a candy in two runs at once (L/T
  intersection) scores once per run, not deduped like `cleared` is — documented in the file's
  header comment for future tuning. `GameState` wraps a `Board` (constructed at the shared
  `BOARD_COLS`/`BOARD_ROWS` from the new `src/logic/constants.ts`, replacing the hardcoded 8s that
  used to live separately in `BoardScene`) with `score`/`movesRemaining`/`status` and
  `attemptSwap()`: delegates to `Board.swap`, costs a move only on success, sums
  `scoreForSteps(result.steps)` in full before checking win/lose (so a winning move's cascade is
  never truncated), checks win before lose, and rejects further swaps once not `'playing'`
  (`{ok:false, reason:'game-over'}`). `reset(seed = Date.now())` restarts the same level with a
  fresh board — the `Date.now()` default is the one deliberate exception to "no ambient randomness
  in logic," since it's just a convenience default for interactive callers and every test passes an
  explicit seed. Default level: targetScore 2500, maxMoves 20 (unchanged from spec's suggestion) —
  a 5-move sanity playthrough during verification reached 1620 points already, suggesting the
  default may be on the easy side; flagged in Open Questions for Caroline to playtest and retune
  rather than guessing at numbers. Render layer: `BoardScene` now drives a `GameState` instead of a
  bare `Board`; added a HUD strip above the board (score/target, moves-remaining — turns red at
  <=5, confirmed visually in a screenshot), floating "+N" score popups positioned at the centroid of
  each cascade step's cleared cells (staggered ~250ms apart, queued before the existing
  Cascade/Shuffled banner), and a win/lose overlay (backdrop + title + final score +
  Play Again/Try Again button) that blocks board input via a `status !== 'playing'` guard in the
  pointerdown/up handlers — a real simulated click during the overlay was confirmed to leave score
  and moves unchanged. Layout constants were pulled into `src/scenes/layout.ts` (also fixing a
  pre-existing duplication where `main.ts` hardcoded its own copy of the canvas size math) and the
  canvas grew taller to fit the new HUD strip. 13 new Vitest tests: 6 in `score-rules.test.ts`
  (base/run-4/run-5+ points per candy, per-step and multi-step cascade multipliers, multiple
  matches within one step) using synthetic `CascadeStep`/`Match` fixtures (no board needed — pure
  function tests); 7 in `game-state.test.ts` (failed swap costs no move; successful swap costs
  exactly one; win triggers and blocks further swaps; a winning move's full multi-step cascade
  score is verified against the independent `scoreForSteps` formula rather than a hardcoded number,
  since incidental refill-triggered extra cascade steps are seed-dependent and would make a
  hardcoded total flaky; lose triggers and blocks further swaps; reset returns to a fresh valid
  board with score/moves/status all reset, both with an explicit and an omitted seed) — all 23
  prior tests still pass (36 total). `npm run build` succeeds; grep confirms zero Phaser imports in
  `src/logic/`. Verified in the browser end-to-end via headless Chromium: engineered a win (low
  target, guaranteed match) and a loss (1 move, unreachable target) via the same
  layout-injection technique as SLICE 3, screenshotted the HUD, the "+400" score popup, the "You
  Win!" and "Out of Moves" overlays (moves-left visibly red at 0 in the lose screenshot), confirmed
  a real click during the overlay doesn't change game state, confirmed Play Again/Try Again clear
  the overlay and restore a fresh playable board with the same level config, and ran a 5-move
  playthrough on the default (non-engineered) config to confirm the whole HUD/score/moves pipeline
  holds up under normal play with no console errors. No other deviations from spec.
- 2026-07-03: Retuned the default level per Caroline's playtest feedback — `DEFAULT_TARGET_SCORE`
  2500→6000 and `DEFAULT_MAX_MOVES` 20→15 in `src/logic/GameState.ts` (the SLICE 4 defaults were
  flagged as too easy). No test asserted on the old default values (all `GameState` tests construct
  explicit `GameConfig`s), so no test changes were needed. 36/36 tests still pass; build succeeds.
- 2026-07-03: SLICE 5 implemented. Logic-layer addition (the one allowed exception this slice):
  `Board.hasAnyValidMove()` was refactored to delegate to a new `Board.findAnyValidMove(): ValidMove
  | null` (same row-major scan, now returning the `{a, b}` cell pair instead of just a boolean) so
  there's one scan implementation instead of two. 3 new tests in `board-cascade.test.ts` (returns a
  move that actually creates a match when swapped; stays consistent with `hasAnyValidMove`; null on
  the existing dead-board fixture) — 39/39 tests total, zero Phaser imports in `src/logic/` still
  holds.
  Animation: replaced the old "redraw final state instantly" in `BoardScene` with an async
  step-by-step player (`tweenAsync()` wraps `this.tweens.add` in a Promise so the whole sequence
  reads as sequential `await`s instead of nested callbacks). `attemptSwap` now: slides the two
  candies into each other's cells (150ms) → calls `GameState.attemptSwap` → on failure, slides them
  back (replacing the old shake) → on success, replays each `CascadeStep` in order (clear: pop
  scale-up-then-shrink ~200ms + a small 4-dot particle burst per cleared candy, using the candy's
  own fill color; gravity: each `Move` slides the *existing* candy object to its new cell with a
  `Bounce.Out` ease, ~80ms/row capped at 400ms; spawn: new candies are created above the board and
  drop in, staggered per column by how many holes stacked above them so multi-hole columns cascade
  naturally instead of overlapping). `candyObjects` (the col/row → GameObject map) is now
  incrementally updated across all three phases instead of being torn down and rebuilt every
  redraw, since the animation needs to keep tweening the *same* objects across steps. Deep cascades
  are compressed: past `CASCADE_COMPRESS_THRESHOLD` (3) steps, all per-step durations scale by
  `3/steps.length`, which holds total step time near a constant ~2.55s regardless of depth, keeping
  the whole sequence (swap + steps) comfortably under the ~4s spec cap. Score popups now fire
  exactly when each step's clear animation starts (previously guessed `time.delayedCall` offsets in
  SLICE 3/4 approximated this; now it's inherent to the `await` sequencing, so `showMessageQueue`'s
  old delay-array approach was removed). Reshuffle has no positional diff data to animate (it's a
  full in-place shuffle, not `Move[]`), so it gets a simple fade-out/redraw/fade-in cross-fade
  instead of per-candy tweens. Input is locked for the whole sequence via an `animating` boolean
  checked in both pointer handlers (verified with rapid simulated clicks mid-animation — game state
  provably didn't change until the sequence finished).
  Sound: `src/audio/SoundEngine.ts` — procedural Web Audio API tones (oscillator + gain envelope
  per hit), no asset files. `swap`/`invalid`/`pop(cascadeStep)` (pitch rises 90Hz per cascade
  depth)/`win` (ascending arpeggio)/`lose` (descending phrase). Field named `soundEngine`, not
  `sound`, to avoid shadowing Phaser's built-in `Scene.sound` manager. Mute state lives only in the
  instance field (no persistence, per spec); a 🔊/🔇 text button in the top-right corner toggles it.
  Polish: selected candy now has a continuously pulsing selection ring (was a static stroke);
  win/lose overlay got a proper panel/card background behind the text (previously text floated
  directly on the dimmed board — flagged from SLICE 4 screenshots); HUD_HEIGHT tightened 64→50 with
  hand-positioned (not ratio-based) text y's for a snugger fit; `index.html` got an on-page `<h1>`
  title and a radial-gradient background (browser-tab title already existed from SLICE 1); bumped
  `chunkSizeWarningLimit` to 1600 in `vite.config.ts` to silence the Phaser chunk warning (a
  documented decision, not a real fix — noted in a code comment). Idle hint: after 5s with no
  pointerdown, `findAnyValidMove()` result gets a subtle scale-pulse wiggle (angle/rotation would be
  invisible on a plain circle, so scale was used instead); any pointerdown resets the idle clock and
  stops an in-flight wiggle. Also switched `vite.config.ts`'s `defineConfig` import from `vite` to
  `vitest/config` — unrelated pre-existing type gap (the `test` field isn't in plain Vite's
  `UserConfig` type) that the IDE flagged once noticed; `tsc -b` never caught it because
  `vite.config.ts` isn't in `tsconfig.json`'s `include`, so it was silently un-checked before.
  Verified in headless Chromium end-to-end, including with genuine tap-tap clicks (not just
  debug-injected swaps): a real valid swap animates, scores, and consumes a move; a real invalid
  swap slides back leaving state untouched (screenshotted mid-slide-back); an engineered 2-step
  cascade was screenshotted mid-swap (candies overlapping mid-slide), mid-cascade ("+180"/"+800"
  popups and the "Cascade x2!" banner rendering together over a fully-refilled board), and at the
  win overlay (new panel background); confirmed candy count stays at 64 (no holes) throughout an
  animated cascade; confirmed total animation time (~1.2-1.4s for a 2-step cascade) comfortably
  under the 4s cap; confirmed rapid simulated clicks mid-animation don't change score/moves
  (input lock); confirmed the mute button toggles its icon and internal state; polled the hint
  wiggle's live tween count and scale value to confirm it actually fires at the 5s mark (not just a
  lucky single screenshot) rather than trusting a static frame. No console errors in any pass. No
  deviations from spec.

- 2026-07-03: SLICE 6A implemented. `Board` now takes an optional 4th constructor param
  `candyTypeCount` (defaults to `CANDY_TYPE_COUNT`=6, so every existing call site — GameState,
  tests — is unaffected unless it opts in), used by both `shuffledTypeOrder()` (generation) and
  `refill()` so a 5-type level's board and every refill during play never spawns the 6th type.
  New `src/logic/LevelDef.ts` (`{id, targetScore, maxMoves, candyTypes}`) and `src/logic/levels.ts`
  — a hand-authored `LEVELS` array (L1-2: 5 types easing in; L3: 6th type as the first real
  difficulty step; L4: the exact 6000/15 config from SLICE 4/the retune, now "level 4" rather than
  a hardcoded default; L5-L10: +1200 target/level, moves dipping 15→14 at L8) plus `getLevelById`/
  `LEVEL_COUNT` — a single editable table per spec, since Caroline will retune after playtesting.
  `GameState`'s constructor now takes `{level: LevelDef, seed}` instead of the old flat
  `{targetScore, maxMoves, seed}` — a breaking shape change, so `tests/game-state.test.ts` was
  updated to build configs via a new `makeLevel()` test helper in `tests/helpers.ts`.
  `src/logic/GameProgress.ts` (pure, storage-agnostic): `starsForScore` rounds each threshold
  (`Math.round(target*1.3)`/`*1.6`) before comparing — guards against float drift on a future
  non-round target Caroline picks, even though all 10 current targets happen to multiply out
  exactly; `completeLevel(progress, levelId, score)` matches the spec's literal signature by
  looking up the `LevelDef` internally via `getLevelById` rather than taking one as a parameter,
  keeps the *best* stars ever earned per level (never downgrades on a worse replay), and only
  advances `highestUnlocked` when stars are actually earned (never re-locks, never unlocks on a
  loss). `src/storage/progressStorage.ts` wraps `localStorage` with try/catch on both read and
  write, falling back to `null`/silently-ignored respectively — tested against a hand-rolled
  in-memory `Storage` stand-in (avoided adding jsdom as a dependency just for this) covering
  roundtrip, corrupted JSON, wrong-shape JSON, and a throwing storage.
  Scenes: new `LevelMapScene` (now the game's actual start scene, registered before `BoardScene` in
  `main.ts`) draws a compact zigzag path of 10 nodes within the existing canvas size (locked =
  gray + lock emoji, unlocked = purple, completed = green + star string, all computed fresh from
  `loadProgress()` every time the scene starts) and starts `BoardScene` with `{levelId}` data on
  tap. `BoardScene` gained an `init(data)` lifecycle method — Phaser reuses the *same* scene
  instance across restarts (it does NOT re-run the constructor or field initializers), so `init()`
  now explicitly resets every per-run field (`selected`, `dragStart`, `animating`, hint timer/
  tweens, etc.) that used to only get its default via field-initializer syntax; `soundEngine` is
  deliberately left alone so mute state survives level transitions. The win/lose overlay is now
  level-aware: a win shows "Level N Complete!" with stars animated in one-by-one (reusing the
  `starsForScore` formula) and persists progress via `completeLevel`+`saveProgress` the moment the
  overlay appears; buttons are Next Level + Level Map, except on the final level where a "Level Map"-
  only "All Levels Complete!" state replaces Next Level (nothing to advance to); a loss shows Try
  Again + Level Map. Both `Next Level`/`Try Again`/level-map-node-tap now navigate via
  `this.scene.start(...)` instead of the old manual `gameState.reset()`-plus-redraw dance, since a
  full scene restart is simpler and Phaser handles GameObject/tween/timer cleanup for the outgoing
  scene automatically. A small "☰ Map" button (top-left, mirroring the mute button's top-right
  corner) is always present during play so the map is reachable with no dead ends, per spec.
  9 new tests in `tests/game-progress.test.ts` (exact star-threshold boundaries, both against a
  synthetic level and against every real hand-authored level; unlock-on-earn vs. no-unlock-below-
  target; best-stars-kept on a worse replay; stars upgrade on a better replay; never-re-locks on a
  losing replay of an already-unlocked level; unaffected by an unrelated already-higher
  `highestUnlocked`; graceful no-op on an unknown level id); 5 in `tests/progress-storage.test.ts`;
  3 new `GameState` tests (5-candy-type board never generates type 5; a 6-type level still
  generates validly; the instance surfaces the level's targetScore/maxMoves) — all 39 SLICE 1-5
  tests plus these total 56/56 passing. `npm run build` succeeds; grep confirms zero Phaser imports
  in `src/logic/`. Verified end-to-end in headless Chromium: a fresh (cleared-localStorage) session
  shows only L1 unlocked; tapping it starts a genuine 5-type/3000/15 board (screenshotted — visibly
  only 5 candy colors); forced a 3-star win and screenshotted the animated "Level 1 Complete!"
  overlay; Next Level correctly advanced to L2's board; the map correctly showed L1 green with 3
  stars and L2 newly unlocked; progress survived a full page reload; losing L2 did not unlock L3;
  replaying L1 with a worse score kept the existing 3 stars; forced level 10's win screen showed
  "All Levels Complete!" with only a Level Map button (no Next Level, since there's nothing next).
  Also ran a final pass against the production build with all debug scaffolding removed, using
  genuine pixel-mapped clicks (no debug hooks) end-to-end from a cleared session through the board
  and back to the map, with zero console errors. One test-methodology note, not a product bug: an
  earlier pass produced a one-off visual ghosting artifact (stale text bleeding through a new
  scene) that only reproduced when the *test script* called `scene.start()` via a stale, detached
  reference to an already-stopped scene instance — a call pattern no real user input can ever
  trigger, since every in-game button handler calls `this.scene.start()` from the scene that is
  actually active at the time. Confirmed clean with the correct (currently-active) scene reference,
  and confirmed via `children.list.length` that no scene's display list leaks objects across
  restarts. No other deviations from spec.
- 2026-07-03: Flattened the L5-L10 curve per Caroline's playtest read on the original (which
  escalated ~1200/level and dipped to 14 moves at L8): now 6800/7600/8400/9200/10000/11000, all at
  15 moves — no move-budget dip, since move pressure isn't wanted yet with SLICE 6B's specials
  still ahead (L8 at ~9200/15 ≈ 610/move is meant to land as hard-but-humanly-possible
  pre-specials, and ease once specials arrive). All target values still multiply out to exact
  integers at both the ×1.3 and ×1.6 star thresholds, so no float-boundary risk. The star-threshold
  tests in `game-progress.test.ts` iterate `LEVELS` directly rather than hardcoding old values, so
  they validated the new curve with no test changes needed. 56/56 tests pass; build succeeds.
- 2026-07-03: Deployed to Vercel, closing out the outstanding prerequisite flagged above. Initialized
  git (this project had none before), pushed to the GitHub repo Caroline had already created
  (`carolineliem904-max/candy_game`, `main` branch), then used the Vercel CLI (`vercel link` /
  `vercel --prod`) — it auto-detected the Vite project, created the `caroline-liem/candygame`
  project, and auto-connected the GitHub repo, so every future push to `main` will auto-deploy with
  no manual redeploy step needed. Verified the live URL loads with zero console errors via a
  headless-Chromium pass against the actual deployed site (not just the local build).

- 2026-07-03: SLICE 6B implemented — all 4 checkpoints (data model/creation, activation/chains,
  rendering/animation/sound, balance pass), tests green at each stage per spec.
  **Data model**: `Board.ts`'s `GridCell` is now `Candy | null` where `Candy = {type: CandyType|null,
  special: SpecialKind|null}` (`SpecialKind = 'stripedH'|'stripedV'|'wrapped'|'bomb'`) — `type: null`
  is reserved for a color bomb (colorless, per spec), distinct from `GridCell = null` (EMPTY socket).
  This was the exact shape the spec sketched in Checkpoint 1 ("builder may restructure GridCell;
  document choice"). It's a breaking change to `Board.getCell()`'s return type, so every existing
  test that compared `getCell()`/`snapshot()` output directly to a `CandyType` was updated to compare
  `.type` instead (new `colorAt`/`colorSnapshot` helpers in `tests/helpers.ts`); `boardFromLayout`
  keeps its old `(CandyType|null)[][]` input shape for backward compat (wraps each cell in
  `{type, special: null}` internally) so almost no test *data* needed to change, just the assertions
  that read cells back out. All 56 pre-SLICE-6B tests pass unmodified in spirit (56/56 → 73/73 with
  new tests added).
  **Creation** (`Board.computeSpecialCreations`): groups a step's color-matches into clusters via
  union-find on shared cells (an L/T is a 2+-match cluster); per cluster, checks in priority order —
  any match ≥5 cells → bomb; cluster has 2+ matches → wrapped at the shared/intersection cell; lone
  4-run → striped — which naturally encodes the spec's "5-line > L/T > 4-run" priority without a
  separate tie-break step. Spawn location is the moved cell if it's part of the match (player-swap
  first step only), else the run's center index; cascade-created 4-runs (no swap context) use the
  run's own orientation. One deliberate literal reading of a spec nuance, called out because it's
  easy to assume the opposite: "vertical swap → vertical stripe, horizontal → horizontal" is
  swap-*direction*-based, not run-orientation-based — a vertical swap that happens to complete a
  *horizontal* 4-run still produces a vertical stripe. Covered explicitly in
  `tests/board-specials-creation.test.ts`. The spawn cell is excluded from that step's `cleared` set
  (it becomes the special in place, not nulled) via a `specialsCreated`/`spawnKeys` exclusion in the
  new `Board.runCascadeStep`, which replaced the old standalone `clearMatches`.
  **Activation & chains** (`Board.runCascadeStep`'s BFS): any pre-existing special caught in a color
  match, or explicitly seeded (bomb/special swap), activates — computing its effect's cell set via
  `effectCellsFor` (striped: full row/column; wrapped: 3x3 clipped to the board edge; bomb: every cell
  of a target color, only when a target color is known) — and any *other* not-yet-activated special
  whose cell falls inside that effect gets enqueued too, each activating at most once, all within the
  same cascade step (same clear→gravity→refill pass), exactly matching "chain reactions REQUIRED".
  **Bomb swap / special+special swap** (`Board.swap`): a swap where *both* cells are specials always
  succeeds — both-bomb triggers a `forcedClearAll` (whole board), any other combo (including
  bomb+non-bomb) seeds each side's activation with the *other* side's color as `targetColor` (ignored
  by non-bomb specials, consumed by a bomb to pick its cleared color) — this one seeding rule
  correctly produces every case in the spec's matrix (bomb+bomb, bomb+striped, bomb+wrapped,
  striped+wrapped, etc.) without special-casing each pairing separately. A swap where exactly one
  side is a bomb (and the other is a plain candy) takes the same seeded-activation path, always
  succeeding without needing a color match. Caught and fixed a real bug here during testing: the
  bomb's post-swap *position* is the cell it swapped *into* (`b` when it started at `a`), not where it
  started — an early version used the pre-swap position and would have applied the bomb's clear at
  the wrong cell.
  **Scoring** (`ScoreRules.ts`): run-based scoring is unchanged; a step's cells cleared by an
  activation effect but *not* already part of a color match this step score flat
  `BASE_POINTS_PER_CANDY` (60, no run bonus) each; each special created adds a flat
  `SPECIAL_CREATION_BONUS` (200); all three components are summed *before* applying that step's
  cascade multiplier (builder decision: the spec says the multiplier "applies to special chain
  reactions as normal steps" but doesn't say explicitly whether the flat +200 is included in that
  multiplication — treating the whole step uniformly was the simplest, most consistent reading).
  A cell that's both part of a match and swept by an effect this step is scored once, not twice
  (dedup by cell key against the step's `matches`, not by whether an effect happened to also touch it).
  One more documented simplification: a color bomb chain-activated by *being hit* (not swapped) has no
  color context to draw on, so it just self-clears (pops) rather than picking some color — this can
  only happen via chain (bombs never join a color-based match, since they're colorless), and it's
  flagged here rather than silently assumed correct.
  **Rendering/animation/sound** (`BoardScene.ts`, `SoundEngine.ts`): `candyObjects` is now
  `Container[]`, not `Arc[]` — each candy is a small Container (`drawCandyVisual`) so specials can
  layer decoration on the base circle: striped gets a white bar (H or V), wrapped gets a second gold
  ring, a bomb is a dark circle with 5 small white dots, still all programmatic shapes (no image
  assets, consistent with the rest of the project). `spawnClearBurst`'s particle color now reads from
  `container.getData('color')` (stashed at draw time) instead of `Arc.fillColor`, since a Container has
  no fill color of its own. Per-step playback order: activation effects (row/column flash sweep for
  striped, expanding ring for wrapped, per-candy zaps staggered across the affected cells for a bomb,
  capped at 400ms total stagger regardless of how many cells a bomb clears so a huge clear can't blow
  the animation budget) play concurrently via `playActivations`, *then* the normal clear-pop, *then*
  `playSpecialsCreated` swaps the spawn cell's visual from plain candy to special with a small
  scale-pop flourish, *then* gravity/spawn as before. All of it inherits the existing
  `CASCADE_COMPRESS_THRESHOLD` time-scaling for deep cascades, so the ~4s worst-case budget still
  holds. Distinct sounds per special added to `SoundEngine` (`striped` whoosh via a new `playSweep`
  frequency-ramp helper, `wrapped` low boom, `bomb` bigger boom + descending sweep, `specialCreated`
  bright two-note sparkle) — reused the existing procedural Web Audio approach, no new asset files.
  Input lock (`this.animating`) required no changes — it already wraps the whole `attemptSwap`
  sequence regardless of how many activation/creation phases run inside it.
  **Balance pass** (Checkpoint 4): wrote a throwaway comparison script (not committed — extracted the
  pre-SLICE-6B `src/logic/` via `git show HEAD:...` into a temp dir, ran it side-by-side with the
  current code) that plays 20 seeded playthroughs each on L4 and L8, always taking the board's own
  `findAnyValidMove()` pick each turn as a simple, deterministic-per-seed stand-in for "random valid
  moves," applied identically to old and new code so the *comparison* is fair even though it isn't a
  uniform sample of all valid moves (a real player who deliberately hunts 4/5-runs, L/T shapes, and
  swaps directly into existing specials to trigger chains would very likely see a bigger lift than
  this naive baseline, since it never *seeks out* combos). Results: **L4: 360.0 → 413.5 pts/move
  (+14.9%)**, **L8: 356.7 → 438.5 pts/move (+22.9%)** — both positive but below the spec's rough
  +30-60% target. Tried the one authorized self-tuning knob (`SPECIAL_CREATION_BONUS`) at 300 and 400
  (vs. the spec's suggested 200): even doubling it to 400 only reached L4 +20.0% / L8 +29.7%, with
  visibly diminishing returns, because most of a special's *potential* value is in its activation
  effect (row/column/3x3/color clears), which this naive move-picker rarely chains into on purpose.
  Reverted to the spec's original 200 rather than push the flat bonus to an unrealistic value chasing
  a naive-play metric — **flagging this for the Architect** per the spec's explicit instruction
  ("flag for Architect instead of self-tuning beyond the +200 knob") rather than self-tuning further.
  **Testing**: 17 new tests across `tests/board-specials-creation.test.ts` (Checkpoint 1: striped H/V
  via swap direction incl. the direction-overrides-run-orientation case, wrapped from an L/T, bomb
  from a 5-run, the priority ordering, a cascade-created special with no swap context) and
  `tests/board-specials-activation.test.ts` (Checkpoint 2: striped row clear, wrapped 3x3 with
  board-edge clipping, a 3-special chain, bomb-swap color clear, bomb+bomb full-board clear,
  non-bomb special+special "activate individually," a bomb making `hasAnyValidMove` true on an
  otherwise-dead board, a 50-move seeded playthrough with specials forced in partway through that
  never throws or leaves holes, and swap-sequence determinism including a bomb swap) plus 2 in
  `score-rules.test.ts` for the new scoring components — 73/73 tests pass, `npm run build` succeeds,
  grep confirms zero Phaser imports in `src/logic/`. Verified end-to-end in a real (non-headless-only)
  Chromium session via Playwright, driving the actual `BoardScene.attemptSwap` method (not a
  logic-only harness) with engineered board states for each special and the chain scenario,
  screenshotting mid-animation and settled states for all of: striped row clear, wrapped 3x3
  (visible ring, correctly clipped at a corner), the 3-special chain (row sweep + column sweep +
  wrapped ring all visible firing together in one screenshot), a color-bomb swap, and a bomb+bomb
  full-board clear (all 64 cells zapping, board fully refilled with no holes afterward); confirmed
  zero console/page errors across every scenario; confirmed via 5 rapid real mouse clicks mid-animation
  that input stays locked (exactly one move consumed, no extra state change) through a full
  activation+chain sequence. One methodology note from this pass, not a product bug: two early
  screenshot passes showed no visible change after a swap — turned out to be bugs in the *verification
  harness* itself (a punctuation-level `type === null` check that conflated "EMPTY cell" with "bomb,
  which is colorless," and forgetting that engineered high-scoring scenarios can legitimately blow
  past a level's win target and lock further swaps) rather than product issues; fixed the harness and
  re-verified clean. All debug scaffolding (a temporary `window.__game` hook in `main.ts`, the
  scratch Playwright script) was removed before finishing — `git status` shows no stray files.
  No other deviations from spec.
- 2026-07-04: Committed SLICE 6B (`7b891e1`, "Implement SLICE 6B: special candies (striped, wrapped,
  color bomb)") and pushed to `main`, triggering the existing auto-deploy. Confirmed via `vercel ls`
  that the resulting production deployment reached `Ready`, then confirmed the production alias
  (candygame-six.vercel.app) serves the exact bundle hash (`index-CeKtRyOd.js`) produced by the local
  build, and did a final headless-Chromium pass against the *live* URL (not just local) showing the
  level map loads cleanly with zero console errors. Left `SLICE_7_SPEC.md` (present in the working
  tree, not authored as part of this slice) out of the commit — untouched, for Caroline/Architect to
  pick up separately.

- 2026-07-04: SLICE 7 implemented — vehicle theme/art pass, render-layer only (zero `src/logic/`
  changes; 73/73 pre-existing tests pass unmodified, grep confirms zero Phaser imports in
  `src/logic/` still holds).
  **Asset sourcing**: went with the spec's preferred option 1 (a real CC0 pack) rather than
  programmatic graphics, per Caroline's explicit call when asked. Downloaded 4 Kenney.nl candidate
  packs (`car-kit`, `toy-car-kit` — 3D isometric toy renders — and `pixel-vehicle-pack`, plus
  `racing-pack` ruled out early for being cars-only); `car-kit`/`toy-car-kit` turned out to be
  3D-model-only downloads (FBX/OBJ/GLB, no usable flat sprites) so **only `pixel-vehicle-pack`**
  (2D side-view pixel art, individually-named PNGs) shipped. Iterated the exact 6-piece set with
  Caroline over 3 published comparison Artifacts (isometric vs. pixel side-by-side, then two
  refinement passes) rather than guessing: swapped the initial school-bus/hot-dog-truck picks for a
  taxi and an SUV so all six pieces share a consistent ~24-33px-wide footprint (the bus and hot dog
  truck were outliers), then recolored the SUV (originally yellow-orange, too close to the taxi's
  yellow) to purple via a Pillow HSV hue-shift — only saturated body panels shift hue, wheels/window
  gray stays put, so the source pixel-art shading is preserved; documented as a derivative CC0 asset
  in `LICENSES.md`. Final set: red sports car, blue sedan, green tractor, yellow taxi, purple
  (recolored) SUV, monochrome black/white police car — 6 distinct color+silhouette combos, confirmed
  via an actual grayscale/squint-test screenshot (see Verification) that shape alone is enough to
  tell them apart.
  **Rendering**: sprites are native pixel art (12-20px tall) with `pixelArt: true` set on the Phaser
  game config and rendered at exactly **1x scale, no stretching** — the only integer scale factor
  that fits every piece inside the 44px cell without overlap (2x would blow past the cell for the
  widest sprites). This was an explicit Caroline call after seeing a fractional-scale version look
  blurry in an early review pass. `drawCandyVisual` now builds a **two-layer container**: the outer
  layer is what game logic already tweens for board position (swap/gravity/spawn — unchanged from
  SLICE 5/6B), and a new inner `visual` sub-container holds the sprite/decorations and is the only
  thing the new idle-bob loop (`attachIdleMotion`, per-cell desynced via a `col*131+row*977` hash,
  `y`-only) and the new selection tilt-wiggle (`angle`-only, "engine revving" feel) ever touch —
  splitting the axes (`y` for bob, `angle` for wiggle) that way means the two cosmetic loops never
  fight each other or the position tweens, with no pause/resume juggling needed. Verified live via
  `scene.tweens.getTweens().length` polling (64, matching one idle tween per board cell) rather than
  trusting a single screenshot frame.
  **Specials re-skin** (same logic/activation code from SLICE 6B, visuals only): striped gets small
  white "speed-line" bars trailing one corner, and its activation sweep gained a second wider/fainter
  companion rectangle behind the main flash for a motion-blur feel; wrapped gets a small gold star
  badge in the corner, and its activation changed from a single expanding ring to a 5-circle "puff
  cloud" cluster that scales/fades together; the color bomb (colorless, no CandyType slot to skin) is
  now a small programmatic **traffic-light icon** (dark body + red/yellow/green dots) rather than the
  old dot-pattern circle — deliberately not a downloaded sprite, since it's one piece and needed to
  read as obviously different from every vehicle at a glance — and its per-cell zap effect became a
  small orange "spark" cross instead of a plain white dot, closer to the spec's "beep icon" idea.
  **Sound**: `SoundEngine` tones pitched up and shortened across the board (swap, invalid, pop, win,
  lose, striped, wrapped, bomb) for a "cuter" feel; `specialCreated()` replaced the old sparkle with
  a two-note same-pitch square-wave "beep beep" honk.
  **Board/UI theming**: new `src/scenes/theme.ts` centralizes the CandyType→sprite mapping (with a
  header comment flagging that `CandyType.ORANGE` intentionally renders as the purple SUV and
  `PURPLE` as the police car — the enum's member *names* are a SLICE-1 logic-layer artifact, not a
  visual source of truth post-SLICE-7) plus every shared palette constant (sky/hills/road/HUD/panel/
  confetti colors) so a future re-theme is a one-file job, per spec. `BoardScene` gained
  `drawBackground()` (sky gradient + two hill ellipses + two puff-cloud clusters, Graphics-only, no
  assets) and `drawRoadPanel()` (asphalt-gray rounded panel with a dashed yellow lane-marking accent,
  replacing the old flat purple rectangle); HUD score/moves text now sits on a rounded cream chip.
  Win/lose overlay recolored from the dark-purple panel to a cream/orange rounded panel with dark
  warm text (necessary, not just cosmetic — the old white-on-dark text would've been unreadable
  against the new light sky background), plus a new `spawnConfetti()` (26 falling/rotating rectangles
  in the theme's confetti palette, depth-layered just under the modal panel) on a win. `LevelMapScene`
  got the same sky/hills/clouds background and its plain circular nodes became little **wheels** (dark
  tire ring + colored hub) per the spec's "road signs or wheels" suggestion.
  **Config/loading**: new `src/scenes/PreloadScene.ts` (first scene in `main.ts`'s scene list) loads
  the 6 vehicle PNGs from `public/vehicles/` with a minimal branded loading bar, then hands off to
  `LevelMapScene`. `index.html` title/`<h1>` updated to "Beep Beep!" (kept the spec's working title —
  Caroline didn't ask for a different one during the review passes) with a 🚗 emoji favicon via an
  inline SVG data URI (no icon file needed) and the page's own CSS background swapped from the old
  dark-purple radial gradient to match the new sky gradient.
  **Verification**: `npm run test` 73/73 unchanged, `npm run build` clean, `dist/vehicles/*.png`
  confirmed present post-build. End-to-end in headless Chromium (Playwright, installed locally via
  `npm install --no-save` and uninstalled again afterward — not a project dependency): level map and
  board screenshots with zero console errors; a grayscale filter applied to a full-board screenshot
  as the spec's explicit squint-test requirement, confirming every piece is still identifiable by
  silhouette alone with color removed. Specials were verified by temporarily exposing the scene on
  `window` (same `window.__game`-hook pattern SLICE 6B used, removed before finishing — `git status`
  confirms no stray files/deps) to force striped/wrapped/bomb pieces onto a live board and drive a
  real `attemptSwap`: screenshotted idle decorations (speed lines, star badges, traffic-light icon)
  and a live bomb-triggered chain (lane sweep + puff clouds firing together, "Cascade x3!"/"+1680"
  popups, board fully refilled with no holes afterward); separately forced the win overlay via the
  same hook and screenshotted the recolored panel, buttons, animated stars, and confetti. No console
  errors in any pass.
  **Not done this slice**: no commit/deploy yet (see STATUS) — Caroline wants her son's playtest
  verdict first, per the spec's own "After Completion" instruction, before this goes live.
- 2026-07-04: **SLICE 7 follow-up — pixel sprites replaced with emoji pieces.** The son's-playtest
  verdict on the pixel-vehicle-pack sprites came back: too small/samey on a full 8x8 board. Replaced
  them with native emoji text glyphs (🚗🚌🚜🚁⛵🚂, one per `CandyType` in plain enum-declaration order —
  same "names aren't a color guarantee" caveat as before, now documented in `theme.ts`'s header
  instead of a mismatch-per-slot comment) rendered at `CELL_SIZE * 0.85` font size — visibly bigger
  and more distinct than the old ~24-33px sprites, confirmed in a live screenshot. Specials
  simplified to **3 fixed glyphs regardless of underlying color** (Caroline's call, not a per-color
  variant): 🚓 striped (same glyph for H/V — the vertical variant rotates just the glyph 90°, not the
  whole `visual` sub-container, so it still can't collide with the selection wiggle's `angle` tween),
  🚒 wrapped, 🚦 color bomb — the traffic-light bomb concept survived from the original SLICE 7 pass,
  just as an emoji now instead of a hand-drawn icon. Removed everything the old sprite pipeline
  needed and nothing else uses: `PreloadScene.ts` (deleted — emoji are system-font text, nothing to
  load), `public/vehicles/*.png` and `LICENSES.md` (deleted — no more downloaded assets, so nothing
  to license), the `pixelArt: true` Phaser config flag (deleted — that flag disables antialiasing,
  which helped crisp 1x pixel-art sprites but would make emoji/text/rounded-rect UI look worse now
  that there's no pixel art left to protect), and `main.ts`'s scene list dropped back to
  `[LevelMapScene, BoardScene]`. Background, idle bob/selection wiggle (unchanged — still animate the
  same `visual` sub-container, now holding a Text object instead of an Image), activation effects,
  sounds, HUD/panel/road-panel theming, and confetti are all untouched from the original SLICE 7 pass.
  73/73 tests still pass (zero logic changes, same as before); build clean. Verified in headless
  Chromium via the same temporary `window.__scene` debug-hook pattern (removed before finishing): a
  natural Level 3 board (all 6 types, no debug forcing) and a forced striped/wrapped/bomb board,
  screenshotted and published to Caroline for approval — **still not committed**, waiting on her
  go-ahead per her explicit "screenshot before committing" instruction.
- 2026-07-04: **SLICE 7 follow-up #2 — light match-3 tiles + emoji candidate review.** Two asks in
  one pass, still uncommitted. (1) **Board re-skin**: replaced the asphalt-road board panel (dark
  surface + dashed lane markings) with the classic light match-3 look — a light neutral panel
  (`THEME.boardPanel`) and a white rounded tile with a soft drop shadow behind every one of the 64
  cells (`THEME.tile`, new `BoardScene.drawTiles()`). Tiles are drawn once, outside `boardLayer`
  (which `drawBoard()` tears down and rebuilds on every redraw/reshuffle), so they never need
  repainting — only the pieces sitting on top of them do. Empty-cell sockets got the same lightening
  (`THEME.socket`, light gray instead of near-black). Sky/hills/clouds background explicitly kept
  as-is per Caroline's instruction. Renamed `THEME.panel` → `THEME.overlayPanel` while touching this
  file, to stop it colliding in meaning with the new `THEME.boardPanel` (win/lose overlay styling
  itself is unchanged, just the constant's name). The level-map path line and the striped-activation
  sweep's second overlay rect both used to reuse the road's lane-marking color; both now pull from a
  new standalone `THEME.pathColor` instead of a `road.*` namespace that no longer exists.
  (2) **Emoji candidate review**: Caroline flagged that vehicle emoji render with heavily overlapping
  colors on Apple's emoji set specifically (confirmed live — this dev machine is macOS, so headless
  Chromium resolves emoji through the real system Apple Color Emoji font, not a bundled substitute,
  so what got screenshotted is what Caroline's own devices show). Built a temporary on-board grid via
  the same `window.__scene` debug-hook pattern (added, used, removed within this session) rendering
  12 vehicle candidates (🚗🚕🚙🚜🚢🚌🚚🏍️🚂🚁✈️🚀) plus the 3 already-shipped special glyphs
  (🚓🚒🚦), each with a text caption, using the *exact* same `this.add.text(...)` call and font size
  the real pieces use, on the new light tiles — not an HTML mockup, so what Caroline sees is exactly
  what the game would render. Screenshot confirmed the complaint: several candidates cluster into
  near-identical red+gray (car/tractor/helicopter/moto) or yellow+gray (taxi/bus/truck) palettes on
  this emoji set. Published for Caroline to pick the final 6 — **no code changes to the actual piece
  mapping yet**, `theme.ts`'s `PIECE_EMOJI` still holds the original 🚗🚌🚜🚁⛵🚂 set pending her
  answer. 73/73 tests pass, build clean (only `theme.ts`/`BoardScene.ts`/`LevelMapScene.ts` touched,
  same zero-logic-change guarantee as every SLICE 7 pass).
- 2026-07-04: **SLICE 7 final pass — "polished mobile casual game" UI restyle.** A full separate spec
  (not the SLICE 7 doc itself), still render-layer only, 73/73 tests pass unchanged. Still uncommitted.
  **New shared modules** (extracted rather than duplicated per-scene, since both `BoardScene` and
  `LevelMapScene` needed the same look): `src/scenes/background.ts` exports `drawSkyBackground(scene,
  w, h)` — sky gradient, clouds, a new low-alpha distant-skyline silhouette (soft rounded rectangles,
  deliberately muted so it doesn't compete with the board), the existing green hills, and a new literal
  dashed road strip at the very bottom edge; replaces the two scenes' near-identical
  `drawBackground()`/`drawCloud()` copies. `src/scenes/uiKit.ts` exports `drawGlossyButton(scene, x, y,
  w, h, fill, border)` — shadow + rounded-rect (or perfect circle when `w === h`) + border + a cheap
  highlight ellipse for a glossy sheen; used for the map/mute corner buttons and the win/lose overlay's
  two buttons (which were previously sharp-cornered `Rectangle` GameObjects — Phaser's plain
  `add.rectangle` has no rounded-corner option, so "rounded, glossy" required switching to
  Graphics-drawn shapes with a separate invisible interactive `Rectangle` layered on top for hit-testing,
  same pattern in both places it's used).
  **Layout**: `HUD_HEIGHT` 50→64 (`layout.ts`) to fit the new 3-segment pill's label+number+subtext
  stack; new `FOOTER_HEIGHT` (70) added into `GAME_HEIGHT` — the board panel stays top-anchored and
  doesn't grow into this extra space, so in `BoardScene` it just reveals a strip of the new
  road/hills background below the board (nice unplanned synergy: the "city and road low in the
  background" ask becomes literally visible there instead of fully hidden), and in `LevelMapScene`
  it's exactly where the new mascot bubble lives.
  **Board & tiles**: `THEME.boardPanel` recolored cool-blue-gray → cream (matches the HUD chip color)
  with a new soft drop-shadow graphic behind it; `drawTiles()`'s tile size shrank from `CELL_SIZE -
  CELL_PADDING` (40px, 4px total gap) to `CELL_SIZE - 8` (36px, 8px total gap) for a clearer gap
  between tiles, shadow softened (alpha 0.5→0.35, offset 2px→1.5px), and tile/socket colors warmed
  from cool gray to match the cream panel. `PIECE_FONT_SIZE` dropped from `CELL_SIZE * 0.85` to
  `CELL_SIZE * 0.68` (37px→30px) — the explicit "current pieces are cramped" complaint from the spec;
  confirmed visually the pieces now sit with real breathing room inside their tiles.
  **HUD**: replaced the old 2-line plain-text HUD ("Level N · Score: X / Y" / "Moves left: Z") with a
  3-segment cream pill — LEVEL / SCORE / MOVES, each a small caption label over a large bold colorful
  number (level in blue, score in green, moves in the existing dark/red-when-low color), thin
  dividers between segments, plus a small "of {target}" caption under the score number so the goal is
  still visible without needing 3 lines of text. `updateHud()` now just sets the bare numbers
  (`setText(String(...))`) instead of building a sentence.
  **Buttons**: map/mute corner buttons are now circular glossy chips (cream fill, orange-gold border,
  same colors as the HUD chip) instead of bare unstyled text — map button's icon simplified from
  "☰ Map" text to just "☰" now that it has its own circular chip to sit in. Win/lose overlay's
  Next-Level/Try-Again and Level-Map buttons switched from sharp rectangles to `drawGlossyButton` pills;
  the modal backdrop scrim was also softened from a near-black navy to a warm translucent plum
  (`0x4a3f5c` @ 0.55) so no part of the screen reads as a harsh dark background, per the spec's "no
  dark backgrounds anywhere."
  **Background**: distant skyline + road strip described above under Layout; both scenes now call the
  one shared `drawSkyBackground` instead of keeping their own copies, which also means the hills
  changed from `LevelMapScene`'s old scattered mid-canvas decorative blobs to the same bottom-anchored
  horizon treatment `BoardScene` already used — a consistency improvement, not just new content.
  **Logo**: `index.html`'s `<h1>` restyled with `font-weight: 900`, a white `-webkit-text-stroke`
  outline (`paint-order: stroke fill` so the fill sits on top of the stroke, not fighting it), a
  layered soft drop-shadow via `text-shadow`, and the 🚗 emoji pulled into its own `.logo-car` span so
  it doesn't inherit the outline stroke (an emoji glyph with a CSS text-stroke applied looks wrong —
  the stroke tries to outline the emoji's bounding glyph shape). Firefox doesn't support
  `-webkit-text-stroke`, so it degrades gracefully there to plain bold colored text with a shadow, no
  broken layout.
  **Mascot bubble** (the spec's "optional charm"): added to `LevelMapScene` only (not `BoardScene` —
  the board scene has zero spare canvas space below the board by design, since its panel is sized to
  fit exactly; the level map has the new footer room and is seen before every level, so it's the
  natural single home for a persistent tip). A 🚗 emoji "mascot" (no dedicated mascot character exists
  yet — out of scope, per the spec's own "piece sprites are arriving separately" note) next to a
  rounded speech-bubble (cream, same chip styling as the HUD, with a small drawn pointer triangle)
  reading "Match 3 or more vehicles to clear them!", positioned in the new footer strip below the last
  level node.
  **Explicitly not touched**: no booster/power-up bar, no pause system, and `theme.ts`'s
  `PIECE_EMOJI`/`SPECIAL_EMOJI` mappings are byte-for-byte unchanged (still the placeholder set from
  the previous entry, pending Caroline's final 6-piece pick) — all three were explicit out-of-scope
  items in this pass's spec.
  **Verification**: 73/73 tests pass, build clean, zero Phaser imports in `src/logic/` still holds.
  Verified end-to-end in headless Chromium via the same temporary `window.__scene` debug-hook pattern
  (added, used, removed): full-page screenshots of the level map (mascot bubble, skyline, road, wheel
  nodes all rendering), a fresh board (HUD pill, tiles, piece sizing), a board after a **real** tap-tap
  swap (not just a static screenshot — confirmed the HUD pill's score/moves numbers actually update
  live and a cascade-created special renders correctly on the new tile background), and a forced win
  overlay (glossy buttons, animated stars, softened backdrop). No console errors in any pass.
  Screenshots published to Caroline; still not committed.
- 2026-07-06: **SLICE 7 final pass — Caroline's own custom sprite set wired in, emoji pieces retired.**
  Still uncommitted, still zero logic changes, 73/73 tests pass. Caroline supplied 10 transparent
  (background-removed) PNGs — 6 vehicles (red car, yellow bus, green tractor, blue truck, purple
  helicopter, orange excavator), a traffic light, and 3 future-booster sprites (rocket, propeller,
  cone) — dropped in a `car/` folder in the repo root (her raw WhatsApp exports, left in place, not
  committed as part of this change — see below). Copied the 7 in-use files into `public/vehicles/`
  with clean names and the 3 unused ones into `public/vehicles/future/`.
  **theme.ts**: replaced the emoji-era `PIECE_EMOJI`/`SPECIAL_EMOJI` tables with a
  `VEHICLE_ASSETS: Record<CandyType, VehicleAsset>` (key/path/native width+height, mirroring the very
  first SLICE 7 pass's asset-loading design before it got swapped for emoji) plus a standalone
  `TRAFFIC_LIGHT_ASSET`. Worth flagging since it reverses something documented twice before: every
  `CandyType`'s literal name now matches its sprite's actual color exactly (no more "ORANGE renders
  purple" style reassignment) — Caroline's own set happened to line up 1:1, so that whole caveat is
  gone from the file's header comment.
  **Preloading is back**: `PreloadScene.ts` recreated (same loading-bar design as the first SLICE 7
  pass) and re-added to `main.ts`'s scene list — needed again now that there are real images to load;
  it was deleted during the emoji interlude specifically because emoji-as-text needed nothing to load.
  **Rendering** (`BoardScene.drawCandyVisual`): specials are now overlays on the base vehicle sprite,
  not separate glyphs, per this pass's explicit instruction — a striped bus is still visibly a bus,
  just with decoration, whereas the emoji era swapped the whole piece for a police-car glyph regardless
  of color. Striped adds `addSpeedLines()` — 3 white bars *behind* the sprite (added to `visual` before
  the sprite image, so container z-order puts them underneath), oriented horizontal for `stripedH` /
  vertical for `stripedV`, each continuously shimmering (alpha pulse + small slide, staggered per bar)
  via tweens tracked in a new `visual.getData("decorTweens")` array. Wrapped adds `addWrappedGlow()` —
  a gold ring behind the sprite, continuously scale/alpha-pulsing, same `decorTweens` tracking. Bomb is
  the one case with no base sprite to decorate (colorless, `type: null`), so it fully replaces the
  piece with the traffic-light image, same as every previous iteration's bomb treatment. `destroyCandy`
  now also stops any `decorTweens` before destroying (previously only killed tweens on `visual` itself,
  which wouldn't have caught tweens targeting the decoration child objects directly).
  **Sizing**: `PIECE_TARGET_SIZE = CELL_SIZE * 0.68` (same ratio as the emoji era) is now applied via a
  new `makeSprite()` helper that scales each image so its *larger* native dimension (sprites range
  from 263 to 422px, all different aspect ratios) hits that target while preserving proportions —
  `setDisplaySize`, not a uniform scale factor, since a uniform scale would either stretch or
  under/oversize non-square sprites relative to each other.
  **Not touched**: the "polished mobile casual game" UI restyle from the previous entry (board panel,
  tiles, HUD pill, glossy buttons, background, mascot bubble) — this pass only touched
  `theme.ts`/`BoardScene.ts`/`main.ts`/new `PreloadScene.ts`. No `LICENSES.md` entry needed — these are
  Caroline's own original art, not a downloaded CC0 pack, so nothing to attribute.
  **Verification**: 73/73 tests, clean build, `dist/vehicles/**` confirmed to include all 7 in-use
  PNGs plus the 3 untouched future/ ones. Verified in headless Chromium via the same temporary
  `window.__scene` debug-hook pattern (added, used, removed): a natural Level 3 board (all 6 sprites
  rendering at the intended size) and a forced striped/wrapped/bomb board, screenshotted and zoomed —
  confirmed the speed-lines render behind and oriented correctly per direction, the wrapped glow ring
  is clearly visible, and the traffic-light bomb sprite is correctly sized/centered. Zero console
  errors. Screenshots published to Caroline; still not committed.
  **Cleanup note for next session**: the raw `car/` folder (10 original WhatsApp export PNGs, ~1.2MB)
  is still sitting in the repo root, untracked — it's Caroline's source material, not something this
  pass created, so it was left alone rather than deleted; worth asking her whether to `.gitignore` it,
  delete it now that the clean copies live in `public/vehicles/`, or keep it as an archive before the
  next commit.
- 2026-07-06: **SLICE 7 sprite-fix pass — trim + resize + special-visual contrast.** Still uncommitted,
  still zero logic changes, 73/73 tests pass. Two fixes from Caroline's feedback on the just-wired-in
  sprite set.
  **`.gitignore`**: added `/car/` — the raw WhatsApp export folder from the previous entry is now
  gitignored rather than just "left alone," per her explicit ask; confirmed via `git status` that it
  no longer shows up untracked.
  **Trim + resize**: the previous entry's "pieces read too small" turned out to be a trim bug, not
  just a ratio choice — the source PNGs had a near-invisible alpha-noise margin (values of 1-3, not
  exactly 0) that a naive `alpha > 0` bounding-box crop couldn't see past, so the first trim attempt
  was a no-op (dimensions unchanged) even though there was a real ~10% transparent margin on every
  side. Re-ran the trim with `alpha > 12` (plus 2px padding to avoid clipping antialiased edges,
  verified visually on a few files afterward) — every sprite shrank meaningfully (e.g. the car
  401×300 → 331×251). Updated all 7 in-use assets' `width`/`height` in `theme.ts`'s `VEHICLE_ASSETS`/
  `TRAFFIC_LIGHT_ASSET` to match (these values drive `makeSprite()`'s scale-to-fit math, so they have
  to stay in sync with the actual files — noted directly in a theme.ts comment this time). Also
  bumped `PIECE_TARGET_SIZE` from `CELL_SIZE * 0.68` to `CELL_SIZE * 0.85` — the 0.68 ratio was tuned
  against the *untrimmed* bounding boxes, so once those shrank to the real artwork size, 0.68 of the
  cell was rendering noticeably smaller than intended.
  **Special-visual contrast**: the striped decoration's speed-lines were `THEME.stripe` (plain white)
  — invisible against the white tiles introduced in the UI-restyle pass (an interaction between two
  separate follow-ups that hadn't been screenshotted together until Caroline caught it). Added a new
  `THEME.speedLine` (deep navy, `0x1f3a5c`) used only for this decoration — left the *activation*
  sweep's white flash (`THEME.stripe`) alone, since that already layers a colored second rectangle on
  top and wasn't part of the complaint. Wrapped's glow ring got a saturation bump (`0xffd700` →
  `0xffb300`) plus a new second ring drawn just behind it at a larger radius in a dark edge color
  (`THEME.wrappedGlowEdge`, `0x6b4a1f`, low alpha) — the "subtle dark edge" Caroline asked for; both
  rings pulse together as one tween target array.
  **Verification**: 73/73 tests, clean build. Headless Chromium via the same temporary
  `window.__scene` hook (added, used, removed): full board screenshot confirming visibly bigger
  pieces with no overlap between neighbors, plus cropped close-ups of a striped-H, striped-V, and
  wrapped piece (navy lines and the gold-with-dark-edge ring both clearly legible against the white
  tile in the crops) and the traffic-light bomb. Zero console errors. Screenshots published to
  Caroline; still not committed.
- 2026-07-06: **UI restyle + sprite set both approved; speed-line alignment bug fixed; SLICE 7
  committed and deployed.** Caroline approved the "polished mobile casual game" restyle and the final
  sprite set, then asked for one more look at speed-line alignment before shipping. Found a real bug,
  not just a tuning nit: `PIECE_TARGET_SIZE` (`BoardScene.ts`) was computed as `CELL_SIZE * 0.85` (the
  full 44px cell), but `drawTiles()` draws the actual white tile 8px smaller (`CELL_SIZE - 8` = 36px) —
  two different numbers for what should've been the same "tile" concept. At 85% of the *cell*, pieces
  came out ~37px against a 36px tile: a 1px overflow past the tile's own edge, which ate the entire
  clearance the speed-line decoration needed to sit beside (not on top of) the sprite. Fixed by
  extracting a shared `TILE_SIZE = CELL_SIZE - 8` constant, used by both `drawTiles()` and
  `PIECE_TARGET_SIZE` (now correctly `TILE_SIZE * 0.85` ≈ 31px) — the two can no longer drift apart.
  Re-verified via the same temporary debug-hook screenshot pattern: pieces now sit with visible margin
  inside their tile, and the navy speed-lines read as clearly beside the vehicle rather than
  overlapping its edge. 73/73 tests, clean build, zero console errors.
  **Committed and pushed**: `git add -A` (excludes the now-gitignored `car/` and any leftover debug
  scaffolding — `git status` was clean of stray files before staging), single commit covering the
  full SLICE 7 arc (vehicle theme → emoji retry → UI restyle → final custom sprites → contrast/
  alignment fixes), pushed to `main`, triggering the existing Vercel auto-deploy.

## OPEN QUESTIONS
- **SLICE 7 committed and pushed — one thing left before calling it fully done**: confirm the Vercel
  auto-deploy actually picked up the new bundle (including `public/vehicles/**`) against the live URL,
  and get Caroline's son's actual playtest verdict — the spec's own literal acceptance test for this
  slice, still not collected. The UI restyle and final custom sprite set are both approved; the raw
  `car/` source folder is gitignored; the asset pipeline (`public/vehicles/*.png`, `PreloadScene`) is
  loading her real sprites correctly per the latest DECISIONS LOG entries.
- Final game name: "Beep Beep!" shipped as-is in SLICE 7 (the spec's working title) — repo/URL
  renaming was explicitly out of scope for SLICE 7 and stays cosmetic/later per that spec.
- Per SLICE 6B's spec ("After Completion"): Caroline should replay L1-L10 for the real difficulty
  verdict now that specials exist — star thresholds may need a final retune (expected, not
  pre-tuned). This folds in the pre-existing curve-playtest question below.
- Default level curve (L1-L10 in `src/logic/levels.ts`) still hasn't had a real human playthrough —
  the L5-L10 flattening was a judgment call from reasoning about the numbers, not from actual play.
  Caroline should playtest the whole curve, especially L8's ~610/move pinch point, now with specials
  in play (which are expected to ease that pinch point — see the balance pass finding below).
- **Balance pass came in under target — flagged for Architect**: SLICE 6B's Checkpoint 4 measured
  specials raising naive-play score/move by +14.9% (L4) and +22.9% (L8), against the spec's rough
  +30-60% target. The one authorized self-tuning knob (`SPECIAL_CREATION_BONUS`) was tried at 300 and
  400 (vs. shipped value 200) and only reached +20.0%/+29.7% at 400, with diminishing returns — kept
  at 200 rather than push it further on a naive-play metric. The measurement methodology (always
  taking the board's first available valid move, not deliberately hunting combos or chains) likely
  understates real achievable lift; worth an Architect call on whether to: (a) accept this as
  directionally fine given skilled play does much better, (b) adjust something structural (activation
  scoring, run-length thresholds) beyond the +200 knob, or (c) re-measure with a smarter auto-player
  before deciding anything needs to change.
- No sound assets or persistence were added beyond `localStorage` for progress (procedural Web
  Audio tones only, mute state in-memory only) — matches spec exactly, but worth confirming the
  placeholder tones (now including 4 new special-candy tones from SLICE 6B) feel "juicy enough" or
  whether a later slice should revisit them.
