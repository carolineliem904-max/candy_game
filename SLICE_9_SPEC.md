# SLICE 9 SPEC — Mobile & Tablet Pass

## Objective
The game feels native on phone and iPad: scales UP on big screens, touch
targets are comfortable, and it can be installed to the home screen like a
real app. Driven by the successful kid playtest (primary device: iPad/phone).

## Checkpoint 1 — Responsive scale-up (the iPad fix)
- Current behavior: manual shrink-to-fit only scales DOWN below the ~368px
  design width; on iPad the game renders small with huge margins
- Fix: scale BOTH directions — game fills available viewport (maintain
  aspect ratio), with:
  - Max scale cap ~2.2x design size (avoids comical size on desktop
    monitors; tune by eye on iPad)
  - Recheck on orientation change and window resize (already partly there)
  - The DPI backing-store logic from the Retina fix must compose correctly
    with the new scale factor — this is the risky interaction, verify on:
    non-Retina desktop, Retina Mac, iPhone, iPad (Caroline has all four)
- Result: iPad shows a big board; phone unchanged; desktop pleasantly larger

## Checkpoint 2 — Touch comfort
- Audit touch targets: map nodes, Map/mute buttons, overlay buttons —
  minimum ~44px physical on phone
- Drag-swap threshold: verify it feels right with small fingers (currently
  CELL_SIZE*0.3) — consider slightly lower on touch devices
- Disable double-tap-zoom / pinch-zoom on the game page (viewport meta +
  touch-action CSS), disable pull-to-refresh interference on the board
- iOS Safari quirks: no rubber-band scroll behind the game; audio unlock on
  first touch (Web Audio requires a user gesture on iOS — verify sounds
  actually play on iPhone/iPad, fix with a resume-on-first-touch if not)

## Checkpoint 3 — PWA install ("real app" feel)
- Web app manifest: name "Beep Beep!", icons (generate from the red car
  sprite: 192px, 512px, maskable variant), portrait orientation preference,
  standalone display mode, theme color matching the sky
- Minimal service worker: cache-first for the built assets so the game
  loads instantly and works offline after first visit (vite-plugin-pwa is
  the standard tool — allowed as a devDependency)
- iOS: apple-touch-icon + status bar meta tags
- Result: "Add to Home Screen" on the iPad gives a full-screen, iconed,
  offline-capable Beep Beep!

## Checkpoint 4 — Verify & ship
- Test matrix: iPhone Safari, iPad Safari, desktop Chrome (Retina + non),
  each: board renders correct size, swaps work, sounds play, PWA installs
- 114/114 tests unchanged (this slice is render/platform only)
- Commit, deploy, HANDOFF update

## Out of Scope
Boosters (next in backlog), blockers, combos, juice pass. Also out: Android
testing beyond what Caroline has available — note as untested in HANDOFF.

## After Completion
Re-playtest with the boss on iPad. His session length is the metric.
