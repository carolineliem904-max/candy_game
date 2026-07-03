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
- [ ] SLICE 6B: Special candies

## STATUS
- Current slice: SLICE 6A complete, deployed. Ready for SLICE 6B (special candies) once Caroline
  playtests the L1-L10 difficulty curve.
- Deployed URL: https://candygame-six.vercel.app (Vercel project `caroline-liem/candygame`, connected
  to GitHub `carolineliem904-max/candy_game` on `main` — every push auto-deploys)

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

## OPEN QUESTIONS
- Final game name and candy theme (Caroline to decide before the SLICE 6B art/specials pass)
- Default level curve (L1-L10 in `src/logic/levels.ts`) still hasn't had a real human playthrough —
  the L5-L10 flattening above was a judgment call from reasoning about the numbers, not from actual
  play. Caroline should playtest the whole curve, especially L8's ~610/move pinch point.
- No sound assets or persistence were added beyond `localStorage` for progress (procedural Web
  Audio tones only, mute state in-memory only) — matches spec exactly, but worth confirming the
  placeholder tones feel "juicy enough" or whether a later slice should revisit them.
