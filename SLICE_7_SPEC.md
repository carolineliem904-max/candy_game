# SLICE 7 SPEC — Theme & Art Pass: "Beep Beep!" (vehicles)

## Objective
Replace placeholder circles with a cute vehicle theme. Kid-friendly, bright,
readable. ZERO logic-layer changes — this is a render/asset slice only.

## Theme
- Working title: "Beep Beep!" (Caroline may rename)
- The 6 match pieces are vehicles. CRITICAL readability rule for match-3:
  each piece must differ in BOTH color AND silhouette so matches read at a
  glance (young kids + color-blind friendly):
  1. Red car          4. Yellow taxi/bus
  2. Blue plane       5. Purple helicopter
  3. Green tractor    6. Orange boat
  (builder may adjust the exact set to whatever assets look best, but must
  keep 6 distinct color+shape combos)

## Asset strategy (in preference order)
1. Kenney.nl CC0 packs (e.g. "Racing Pack", "Pixel Vehicle Pack", "Transport
   Pack") — download, pick 6 vehicles, recolor if needed. CC0 = no
   attribution required, zero licensing risk. Document pack names + URLs in
   HANDOFF and keep a LICENSES.md in the repo anyway (good practice).
2. If no pack gives a cute cohesive set: draw the vehicles as Phaser
   Graphics/SVG-style programmatic art — chunky rounded shapes, big
   windows, simple wheels. Cute comes from proportions (fat, rounded,
   slightly squished), not detail.
3. Do NOT mix sources — all 6 pieces from one visual family.

## Deliverables

### 1. Piece rendering
- Replace circles with vehicle sprites/graphics, sized with padding so they
  don't touch (breathing room reads cuter)
- Subtle idle: pieces very slightly bob or tilt on a slow loop, desynced
  per cell (this alone adds huge charm; keep amplitude tiny)
- Selected piece: existing pulse, plus a slight tilt-wiggle ("engine
  revving" feel)

### 2. Specials re-skinned (same logic, themed visuals)
- Striped (row/col clear) → vehicle with speed lines / racing stripes;
  effect stays a directional sweep, add tiny motion-blur streak
- Wrapped (3×3) → vehicle with a star badge; explosion becomes a cartoon
  puff cloud
- Color bomb → traffic light or police beacon piece (distinct, colorless);
  zap effect becomes little beep icons — builder's choice, document it
- Creation/activation sounds: pitch existing tones cuter (higher, shorter);
  add a soft "beep beep" honk on special creation (still Web Audio,
  procedural)

### 3. Board & UI theming
- Board panel: road/asphalt texture feel or soft sky — keep contrast HIGH
  so pieces pop; test with a screenshot squint-check
- Background: soft gradient sky + simple programmatic clouds/hills
- HUD + overlays + level map restyled to match (rounded, chunky, bright;
  win overlay confetti recolored)
- Level map nodes: little road signs or wheels instead of plain circles
- Page title + <h1> to the new name; favicon (simple emoji-style car works)

### 4. Config hygiene
- All piece-to-asset mapping in ONE file (`src/scenes/theme.ts` or similar)
  so future re-theming is a one-file job
- Sprite loading via Phaser preloader with a minimal loading state

### 5. Tests
- All 73 logic tests must pass UNCHANGED (proves zero logic drift)
- No new logic tests expected; visual QA is Caroline + her son

## Acceptance Criteria
- The game reads as a cute, cohesive kids' vehicle game, not recolored circles
- Each piece instantly distinguishable by shape alone (squint test / grayscale
  screenshot test — builder: actually do this and include it in verification)
- Specials visually distinct from normal pieces at a glance
- 73/73 tests pass; build succeeds; deploy via git push
- LICENSES.md present if any downloaded assets are used

## Out of Scope
- Level goals & new levels (SLICE 8); character/mascot; music (post-v1 nice-
  to-have); renaming repo/URL (cosmetic, later)

## After Completion
Update HANDOFF (asset sources, theme decisions, new name if changed).
The REAL acceptance test: Caroline's son plays it. Report his verdict.
