import { BOARD_COLS } from "../logic/constants";

/** Retina/high-DPI fix: the Phaser canvas backing store must render at
 * `devicePixelRatio` physical pixels per CSS pixel, or every sprite (and
 * everything else) comes out visibly blurred once the browser upscales a
 * too-small canvas bitmap to fill the screen — this was diagnosed directly
 * (canvas backing store == CSS size while devicePixelRatio was 2) rather
 * than assumed.
 *
 * Phaser 3.90 removed its old global `resolution` config, and there is no
 * remaining built-in way to decouple backing-store resolution from CSS
 * display size under `Phaser.Scale.FIT` — tested directly against the
 * bundled source: FIT recomputes the CSS size from the parent element on
 * every resize and never consults `zoom` at all, so `zoom` only ever
 * enlarges the CSS size while leaving the backing store fixed (confirmed
 * empirically, not assumed) — the exact opposite of what's needed. The
 * combination that *does* work, verified the same way: `Phaser.Scale.NONE`
 * (whose backing store is set once from the raw config width/height and
 * never touched again) plus `zoom` (which, under NONE only, scales the CSS
 * style size independently via `ScaleManager.setZoom`, still callable any
 * time after boot). So every constant in this file is scaled by `UI_SCALE`
 * (bigger backing store), and `main.ts` sets `zoom: 1 / UI_SCALE` to bring
 * the CSS size back down to the original design size — then, since NONE
 * mode drops FIT's automatic "shrink to fit a narrow viewport" behavior,
 * `main.ts` re-derives and re-applies `zoom` on load and on window resize
 * (see `DESIGN_WIDTH`/`DESIGN_HEIGHT` below) to restore that responsiveness
 * without reintroducing FIT's backing-store problem. Falls back to 1
 * outside a browser (e.g. under Vitest, which never renders Phaser). */
export const UI_SCALE = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

export const CELL_SIZE = 44 * UI_SCALE;
export const CELL_PADDING = 4 * UI_SCALE;
export const BOARD_MARGIN = 16 * UI_SCALE;
/** Taller than SLICE 1-7's 50px to fit the 3-segment Level/Score/Moves pill
 * (label + big number) from the "polished mobile casual game" UI pass. */
export const HUD_HEIGHT = 64 * UI_SCALE;
/** Footer strip below the board: mostly just reveals the background's
 * skyline/road in `BoardScene` (the board panel is top-anchored and doesn't
 * grow into it), and gives `LevelMapScene` room for the mascot speech
 * bubble below the last node. */
export const FOOTER_HEIGHT = 70 * UI_SCALE;
export const DRAG_THRESHOLD = CELL_SIZE * 0.3;

export const BOARD_PIXEL_SIZE = BOARD_COLS * CELL_SIZE;
export const GAME_WIDTH = Math.min(BOARD_PIXEL_SIZE + BOARD_MARGIN, 380 * UI_SCALE);
export const GAME_HEIGHT = HUD_HEIGHT + BOARD_PIXEL_SIZE + BOARD_MARGIN + FOOTER_HEIGHT;

/** The original (pre-DPI-fix) design size in CSS pixels — what `main.ts`
 * targets when computing how much to shrink for a narrow viewport. */
export const DESIGN_WIDTH = GAME_WIDTH / UI_SCALE;
export const DESIGN_HEIGHT = GAME_HEIGHT / UI_SCALE;
