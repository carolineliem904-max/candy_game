import { BOARD_COLS } from "../logic/constants";

export const CELL_SIZE = 44;
export const CELL_PADDING = 4;
export const BOARD_MARGIN = 16;
export const HUD_HEIGHT = 50;
export const DRAG_THRESHOLD = CELL_SIZE * 0.3;

export const BOARD_PIXEL_SIZE = BOARD_COLS * CELL_SIZE;
export const GAME_WIDTH = Math.min(BOARD_PIXEL_SIZE + BOARD_MARGIN, 380);
export const GAME_HEIGHT = HUD_HEIGHT + BOARD_PIXEL_SIZE + BOARD_MARGIN;
