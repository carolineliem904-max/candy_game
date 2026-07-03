# SLICE 5 SPEC — Animations, Sound, Polish

## Objective
The game looks and feels finished: animated swaps, falls, clears, sound
effects, and visual polish. Uses the CascadeStep data pipeline built in
SLICE 3. Zero logic-layer changes expected.

## Prerequisite
SLICE 4 complete + difficulty tuned (6000/15 locked in).

## Deliverables

### 1. Animation system (`src/scenes/`)

Replace "redraw final state instantly" with an animation queue that plays
the SwapResult step by step:

- Swap: the two candies slide into each other's cells (~150ms ease)
- Failed swap: slide there and back (replaces the shake)
- For each CascadeStep, in order:
  a. Clear: matched candies pop — quick scale-up then shrink-to-zero
     (~200ms), optionally a small particle burst per candy
  b. Gravity: candies slide down to their new cells using the Move[] data
     (~80ms per row fallen, capped ~400ms, slight bounce on landing)
  c. Spawn: new candies drop in from above the board top using Spawn[] data
- Cascade steps play sequentially — the player watches the chain happen
- Score popups ("+240") appear per step in sync with the clear animation
- Input is LOCKED during the entire animation sequence, unlocked after
- A hard cap: full sequence should never exceed ~4s even for deep cascades
  (compress per-step timing if steps > 3)

### 2. Sound (`src/audio/` or scene-level)

- Generate simple sounds with Web Audio API programmatically (no downloaded
  asset files — avoids licensing and keeps repo clean). Suggested set:
  - swap (short blip), invalid (low buzz), pop (per clear step, pitch rises
    with cascade depth — step 1 low, step 2 higher... this is the classic
    juicy touch), win (short ascending arpeggio), lose (short descending)
- Mute toggle button in a corner, state persisted in a JS variable only
  (no localStorage — Claude.ai artifact constraint doesn't apply here since
  this is a standalone Vite app, but keep v1 simple anyway)

### 3. Visual polish

- Candy hover/selected state: selected candy gently pulses
- Valid-move hint: after 5s of no input, subtly wiggle one valid move
  (Board.hasAnyValidMove can be extended to return the move it found —
  small logic-layer addition, keep it pure)
- Overlay backdrop: dark semi-transparent panel behind win/lose text
  (flagged from SLICE 4 screenshots)
- HUD: tighten spacing between HUD and board (flagged from screenshots)
- Page: centered layout, page title, subtle background gradient
- Bump `build.chunkSizeWarningLimit` to 1600 in vite config to silence the
  known Phaser chunk warning (documented decision, not a fix)

### 4. Tests

- Logic layer: if hasAnyValidMove is extended to findAnyValidMove(), test it
  (returns an actual valid move; null on dead board)
- Animation/sound are NOT unit-tested (visual QA territory) — but the
  36 existing tests must still pass unchanged, proving zero logic drift

## Acceptance Criteria
- Swaps, clears, falls, and cascades are fully animated and readable
- Sounds play; pitch rises with cascade depth; mute works
- Input locked during animations (builder: verify with simulated rapid clicks)
- Hint wiggle appears after idle; overlays have backdrop; HUD tightened
- 36/36 tests pass; build succeeds; zero Phaser imports in src/logic/
  (except the one small pure findAnyValidMove addition)

## Out of Scope
- Special candies, levels (SLICE 6); real candy art (post-SLICE 6 art pass);
  persistence/high scores

## After Completion
Update HANDOFF.md. This is the "show your friends" milestone — consider
deploying to Vercel after this slice.
