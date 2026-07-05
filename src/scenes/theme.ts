import { CandyType } from "../logic/CandyType";

/** SLICE 7 ("Beep Beep!" vehicle theme) — every piece-to-asset mapping and
 * shared visual constant lives in this one file so a future re-theme only
 * touches here. Nothing in `src/logic/` reads this file; it's render-layer
 * only, per the slice's "zero logic changes" mandate.
 *
 * Pieces are Caroline's final custom sprite set (transparent PNGs, background
 * removed, dropped in `public/vehicles/`) — replacing the emoji-text pieces
 * from the previous two follow-ups. Each `CandyType`'s literal name now
 * matches its sprite's actual color exactly (red car, yellow bus, green
 * tractor, blue truck, purple helicopter, orange excavator) — unlike the
 * emoji-era mapping, there's no reassigned-slot caveat to document here.
 *
 * `public/vehicles/future/` holds 3 more sprites (rocket, propeller, cone)
 * that arrived in the same drop but aren't wired up anywhere — reserved for
 * a future booster/power-up slice (explicitly out of scope here), so they're
 * deliberately absent from `VEHICLE_ASSET_LIST` and never preloaded.
 */
export interface VehicleAsset {
  /** Phaser texture key, also used as the loader key. */
  key: string;
  /** Path under `public/`, passed straight to `this.load.image`. */
  path: string;
  /** Native pixel size, used to scale the sprite to `PIECE_TARGET_SIZE`
   * (in BoardScene.ts) while preserving its aspect ratio. */
  width: number;
  height: number;
}

/** Widths/heights below are post-trim (see HANDOFF's follow-up entry): the
 * source exports had a near-invisible alpha noise margin (values of 1-3,
 * not exactly 0) that a naive alpha>0 crop wouldn't catch, so the actual
 * trim used an alpha>12 threshold with 2px padding. These dimensions must
 * stay in sync with the files in `public/vehicles/` — they're what
 * `makeSprite()` uses to scale each sprite to `PIECE_TARGET_SIZE`. */
export const VEHICLE_ASSETS: Record<CandyType, VehicleAsset> = {
  [CandyType.RED]: { key: "car-red", path: "/vehicles/car-red.png", width: 331, height: 251 },
  [CandyType.YELLOW]: { key: "bus-yellow", path: "/vehicles/bus-yellow.png", width: 358, height: 269 },
  [CandyType.GREEN]: { key: "tractor-green", path: "/vehicles/tractor-green.png", width: 323, height: 261 },
  [CandyType.BLUE]: { key: "truck-blue", path: "/vehicles/truck-blue.png", width: 273, height: 239 },
  [CandyType.PURPLE]: { key: "helicopter-purple", path: "/vehicles/helicopter-purple.png", width: 295, height: 216 },
  [CandyType.ORANGE]: { key: "excavator-orange", path: "/vehicles/excavator-orange.png", width: 293, height: 227 },
};

/** The color bomb is colorless (`type: null`, no CandyType slot above) and
 * renders as this traffic-light sprite instead of any vehicle — unlike
 * striped/wrapped, it fully replaces the piece rather than decorating it,
 * since there's no base vehicle color to decorate. */
export const TRAFFIC_LIGHT_ASSET: VehicleAsset = {
  key: "traffic-light",
  path: "/vehicles/traffic-light.png",
  width: 133,
  height: 212,
};

export const VEHICLE_ASSET_LIST: VehicleAsset[] = [...Object.values(VEHICLE_ASSETS), TRAFFIC_LIGHT_ASSET];

/** Flat accent color per piece, used for the clear-burst particles and
 * anywhere else a single representative swatch (not the full sprite) is
 * useful. */
export const PARTICLE_COLORS: Record<CandyType, number> = {
  [CandyType.RED]: 0xe0453a,
  [CandyType.BLUE]: 0x3d6fd1,
  [CandyType.GREEN]: 0x5aa851,
  [CandyType.YELLOW]: 0xf4c430,
  [CandyType.ORANGE]: 0x9b59b6,
  [CandyType.PURPLE]: 0x8a8f99,
};

export const THEME = {
  sky: { top: 0x8ecbe8, bottom: 0xcdeef8 },
  /** Soft, low-contrast distant skyline — "keep it subtle so the board
   * pops" per the UI-restyle spec; sits behind the hills. */
  skyline: 0xcdd9e8,
  hills: { back: 0x8fd17a, front: 0x6cbf5c },
  /** A thin literal "road" strip at the very bottom of the background,
   * mostly visible in the new footer strip below the board. */
  road: { surface: 0xd8dbe0, dash: 0xfff6e0 },
  cloud: 0xffffff,
  /** Classic light match-3 board look: a light-cream rounded panel (was a
   * cooler blue-gray) with a warm-white rounded tile behind every cell,
   * both restyled toward "polished mobile casual game" pastel warmth. */
  boardPanel: { fill: 0xfff6e0, stroke: 0xe6d6ac },
  tile: { fill: 0xfffdf8, stroke: 0xf0e6d2, shadow: 0xd8cead },
  socket: { fill: 0xf3ede0, stroke: 0xe0d5ba },
  pathColor: 0xffb238,
  hud: { chip: 0xfff6e0, chipStroke: 0xffb238, text: "#3d2b1f", urgent: "#e63946", label: "#a8916f" },
  /** Big colorful numbers in the HUD's Level/Score/Moves pill segments. */
  hudNumbers: { level: "#4a90d9", score: "#3fae5a" },
  overlayPanel: { fill: 0xfff6e0, stroke: 0xffb238, text: "#3d2b1f", subtext: "#7a6a55" },
  accent: { primary: 0xff6b4a, secondary: 0x3fae5a },
  selectionRing: 0xffffff,
  stripe: 0xffffff,
  /** Deep navy for the striped piece's speed-line decoration — the original
   * white read as invisible against the white tiles (Caroline's follow-up
   * catch); navy reads clearly against both the tile and every vehicle
   * color in the set. Distinct from `stripe` above, which is the striped
   * *activation* sweep's flash color (already has contrast via a colored
   * second layer, so it wasn't part of this complaint). */
  speedLine: 0x1f3a5c,
  /** Wrapped piece's pulsing halo, drawn behind the sprite: a saturated
   * gold ring with a subtle dark edge ring behind it for contrast on the
   * white tiles (a plain gold-on-white ring read as too washed out). */
  wrappedGlow: 0xffb300,
  wrappedGlowEdge: 0x6b4a1f,
  confetti: [0xff6b4a, 0xf4c430, 0x3fae5a, 0x4a90d9, 0x9b59b6, 0xffffff],
} as const;
