import { BOARD_COLS } from "../logic/constants";

export const CELL_SIZE = 44;
export const CELL_PADDING = 4;
export const BOARD_MARGIN = 16;
/** Taller than SLICE 1-7's 50px to fit the 3-segment Level/Score/Moves pill
 * (label + big number) from the "polished mobile casual game" UI pass. */
export const HUD_HEIGHT = 64;
/** Footer strip below the board: mostly just reveals the background's
 * skyline/road in `BoardScene` (the board panel is top-anchored and doesn't
 * grow into it), and gives `LevelMapScene` room for the mascot speech
 * bubble below the last node. */
export const FOOTER_HEIGHT = 70;
export const DRAG_THRESHOLD = CELL_SIZE * 0.3;

export const BOARD_PIXEL_SIZE = BOARD_COLS * CELL_SIZE;
export const GAME_WIDTH = Math.min(BOARD_PIXEL_SIZE + BOARD_MARGIN, 380);
export const GAME_HEIGHT = HUD_HEIGHT + BOARD_PIXEL_SIZE + BOARD_MARGIN + FOOTER_HEIGHT;
