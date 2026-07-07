import Phaser from "phaser";
import { BoardScene } from "./scenes/BoardScene";
import { LevelMapScene } from "./scenes/LevelMapScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { DESIGN_HEIGHT, DESIGN_WIDTH, GAME_HEIGHT, GAME_WIDTH, UI_SCALE } from "./scenes/layout";

/** SLICE 9: the game now scales UP on big screens (iPad/desktop), not just
 * down on narrow phones — the old logic only ever shrunk to fit
 * `MAX_CSS_WIDTH`, which is why an iPad rendered the design-size board with
 * huge unused margins. Capped so desktop monitors don't get a comically
 * oversized board — tuned by eye against an iPad's viewport, per spec. */
const MAX_SCALE = 2.2;
/** Small breathing-room margin (CSS px) so the canvas never touches the
 * viewport edge exactly. */
const VIEWPORT_MARGIN = 16;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  // GAME_WIDTH/GAME_HEIGHT already bake in UI_SCALE (see layout.ts), so the
  // canvas backing store renders at devicePixelRatio pixel density.
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#8ecbe8",
  scale: {
    // `FIT` was the culprit for the Retina blur: it recomputes CSS size from
    // the parent on every resize and never consults `zoom`, so there's no
    // way to keep a bigger backing store at the same on-screen size under
    // it (verified against the Phaser source, not assumed). `NONE` keeps
    // the backing store fixed at the raw config size above and lets `zoom`
    // control CSS size independently (via `game.scale.setZoom`, called
    // below) — exactly the decoupling we need.
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 1 / UI_SCALE,
  },
  scene: [PreloadScene, LevelMapScene, BoardScene],
});

/** How much CSS space is actually available for the canvas: the full
 * viewport (preferring `visualViewport`, which iOS Safari keeps accurate
 * across on-screen-keyboard/URL-bar chrome changes) minus room for the
 * on-page `<h1>` title and body's flex `gap`, so the height budget doesn't
 * assume a title height that may differ per-browser/font-load state. */
function getAvailableSize(): { width: number; height: number } {
  const vv = window.visualViewport;
  const viewportWidth = vv?.width ?? window.innerWidth;
  const viewportHeight = vv?.height ?? window.innerHeight;

  const title = document.querySelector("h1");
  const chromeHeight = title ? title.getBoundingClientRect().height : 0;
  const gap = parseFloat(getComputedStyle(document.body).rowGap || "0") || 0;

  return {
    width: viewportWidth - VIEWPORT_MARGIN,
    height: viewportHeight - chromeHeight - gap - VIEWPORT_MARGIN,
  };
}

/** `NONE` mode has no automatic "fit the viewport" behavior (unlike the
 * `FIT` mode this replaces), so it's reimplemented here: scale UP to fill
 * available space on a big screen (iPad, desktop) as well as DOWN on a
 * narrow phone, maintaining aspect ratio, capped at `MAX_SCALE`. `zoom`
 * always folds in the `1/UI_SCALE` DPI-compensation factor on top of this
 * responsive scale so the two compose instead of fighting (see layout.ts's
 * header comment for why backing-store size and CSS zoom are decoupled). */
function applyResponsiveZoom(): void {
  const { width, height } = getAvailableSize();
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT, MAX_SCALE);
  game.scale.setZoom(scale / UI_SCALE);
}

game.events.once(Phaser.Core.Events.READY, applyResponsiveZoom);
window.addEventListener("resize", applyResponsiveZoom);
// iOS Safari sometimes reports stale viewport dimensions for a brief moment
// right after `orientationchange` fires (before it settles post-rotation),
// so re-measure on a short delay in addition to the immediate `resize`.
window.addEventListener("orientationchange", () => setTimeout(applyResponsiveZoom, 50));
window.visualViewport?.addEventListener("resize", applyResponsiveZoom);
