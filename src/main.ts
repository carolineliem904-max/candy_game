import Phaser from "phaser";
import { BoardScene } from "./scenes/BoardScene";
import { LevelMapScene } from "./scenes/LevelMapScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { DESIGN_WIDTH, GAME_HEIGHT, GAME_WIDTH, UI_SCALE } from "./scenes/layout";

// The CSS max-width the game canvas is ever allowed to occupy (mirrors
// index.html's `#app { max-width: 480px }`) — used below to work out how
// much to shrink on a narrower viewport.
const MAX_CSS_WIDTH = 480;

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

/** `NONE` mode has no automatic "shrink to fit a narrow viewport" behavior
 * (unlike the `FIT` mode this replaces), so it's reimplemented here: `zoom`
 * always includes the `1/UI_SCALE` DPI-compensation factor, further scaled
 * down if the viewport is narrower than the game's own design width. */
function applyResponsiveZoom(): void {
  const availableWidth = Math.min(window.innerWidth, MAX_CSS_WIDTH);
  const shrink = Math.min(1, availableWidth / DESIGN_WIDTH);
  game.scale.setZoom(shrink / UI_SCALE);
}

game.events.once(Phaser.Core.Events.READY, applyResponsiveZoom);
window.addEventListener("resize", applyResponsiveZoom);
