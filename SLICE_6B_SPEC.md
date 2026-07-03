# SLICE 6B SPEC — Special Candies

## Objective
Match-4/5 patterns create special candies with powerful clear effects,
raising player scoring power so the level curve's upper half becomes
genuinely beatable with skill. This is the final v1 slice.

## Prerequisite
SLICE 6A + curve retune deployed.

## The Three Specials (classic match-3 rules)

| Created by | Special | Effect when cleared/activated |
|---|---|---|
| Match of exactly 4 in a line | STRIPED (H or V) | Clears its entire row (if horizontal stripe) or column (vertical) |
| L or T shaped intersection match | WRAPPED | Explodes 3×3 area around itself |
| Match of 5+ in a straight line | COLOR BOMB | Swapped with any normal candy: clears ALL candies of that color on the board |

Creation details:
- Special spawns at the cell the player moved (for player-made matches) or
  at the run's center (for cascade-made matches)
- Stripe orientation: vertical swap → vertical stripe, horizontal → horizontal;
  cascade-created stripes pick orientation of the run
- If a single move creates both a 4-run and an L/T, priority: 5-line > L/T > 4-run
- Specials ALSO count as normal candies of their color for future matching
  (except color bomb, which has no color)

Activation details:
- A special clears (activates) when it's part of a match, or when hit by
  another special's effect (chain reactions REQUIRED — striped hitting a
  wrapped sets it off, etc.)
- Color bomb activates by being swapped with any candy (this swap always
  "succeeds" and consumes a move even though it's not a pattern match)
- Special-special swaps: v1 supports ONE combo only — colorbomb + colorbomb
  clears the whole board. Other special+special swaps just activate both
  individually. (Full combo matrix like striped+wrapped is post-v1.)

Scoring:
- Cells cleared by special effects score base 60 × current cascade-step
  multiplier (no run bonus)
- Creating a special adds a flat +200
- Cascade multiplier applies to special chain reactions as normal steps

## Build Checkpoints (builder: complete IN ORDER, tests green at each)

### Checkpoint 1 — Data model & creation (logic only)
- Cell model gains special info: `{ type: CandyType|null, special?: 'stripedH'|'stripedV'|'wrapped'|'bomb' }`
  (builder may restructure GridCell; document choice)
- findMatches extended to classify each match: run length, L/T intersection,
  and the cell where a special should spawn
- clear step creates specials per rules above
- Tests: 4-run → striped with correct orientation; L/T → wrapped; 5-line →
  bomb; priority ordering; cascade-created specials; +200 creation score

### Checkpoint 2 — Activation & chains (logic only)
- Clearing a special triggers its effect within the SAME cascade step;
  effects that hit other specials queue their activations (BFS, each special
  activates at most once)
- Color bomb swap flow in Board.swap/GameState.attemptSwap
- Bomb+bomb full-board clear
- Tests: striped row/column clear; wrapped 3×3 (incl. board-edge clipping);
  bomb clears exact color set; chain striped→wrapped→striped; bomb+bomb;
  activation scoring with cascade multipliers; determinism with specials;
  50-move seeded playthrough with specials never errors/leaves holes

### Checkpoint 3 — Rendering & animation
- Distinct visuals (still programmatic shapes): striped = stripe lines on
  the candy (H/V match orientation), wrapped = double ring, bomb = dark
  multi-dot circle
- Effect animations: row/column sweep flash for striped, expanding ring for
  wrapped, per-candy zap for bomb (staggered ~30ms), reuse pop/particles
- Distinct sounds per special (reuse SoundEngine, new tones)
- Animation cap still ~4s worst case
- Input lock still holds through chain reactions

### Checkpoint 4 — Balance pass
- Builder: run 20 seeded auto-playthroughs (random valid moves) on L4 and
  L8; report average score/move vs pre-specials baseline in HANDOFF
- Expectation: specials should raise average score/move noticeably (rough
  target +30-60%); if higher, reduce special creation bonus or bomb
  frequency is NOT adjustable (5-runs are rare naturally) — flag for
  Architect instead of self-tuning beyond the +200 knob

## Acceptance Criteria
- I can create and use all three specials in the browser and see/hear
  distinct effects; chains work; bomb+bomb clears the board
- All prior tests + new tests green; logic still Phaser-free; build succeeds
- Auto-deploy ships it; HANDOFF updated with balance report

## Out of Scope (post-v1 backlog)
- Full special+special combo matrix; level goals (jelly etc.); blockers;
  real candy art; mobile PWA packaging

## After Completion
Caroline replays L1–L10 for the real difficulty verdict. Star thresholds
may need a final retune AFTER specials (expected — don't pre-tune).
