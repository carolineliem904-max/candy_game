import { describe, expect, it } from "vitest";
import { GameState } from "../src/logic/GameState";
import { BOARD_COLS, BOARD_ROWS } from "../src/logic/constants";
import { LEVELS } from "../src/logic/levels";
import { mulberry32 } from "../src/logic/rng";

const MAX_ATTEMPTS = 200;
/** Random tries per turn before falling back to a guaranteed valid move —
 * keeps the bot mostly-random (per spec: "random-move bot") while still
 * making forward progress every turn, since a Board always has at least one
 * valid move (generate()/reshuffle() guarantee it). */
const RANDOM_TRIES_PER_TURN = 40;

/** Plays one full attempt at a level with a bot that, each turn, tries
 * random adjacent-cell swaps (free retries — a non-matching swap costs no
 * move) and falls back to the board's own findAnyValidMove() if none of the
 * random tries land a match. Returns whether that attempt won. */
function botPlaythroughWins(levelId: number, attemptSeed: number): boolean {
  const level = LEVELS.find((l) => l.id === levelId)!;
  const game = new GameState({ level, seed: attemptSeed });
  const pick = mulberry32(attemptSeed * 7919 + 13);

  while (game.status === "playing") {
    let moved = false;
    for (let tries = 0; tries < RANDOM_TRIES_PER_TURN && !moved; tries++) {
      const col = Math.floor(pick() * BOARD_COLS);
      const row = Math.floor(pick() * BOARD_ROWS);
      const horizontal = pick() < 0.5;
      const b = horizontal ? { col: col + 1, row } : { col, row: row + 1 };
      if (b.col >= BOARD_COLS || b.row >= BOARD_ROWS) {
        continue;
      }
      if (game.attemptSwap({ col, row }, b).ok) {
        moved = true;
      }
    }
    if (!moved) {
      const fallback = game.board.findAnyValidMove();
      if (!fallback) {
        return false; // unreachable in practice: Board always guarantees a valid move
      }
      game.attemptSwap(fallback.a, fallback.b);
    }
  }

  return game.status === "won";
}

describe("Level winnability (bot sanity check)", () => {
  for (const level of LEVELS) {
    it(`level ${level.id} (${level.goal.kind}) is winnable by a random-move bot within ${MAX_ATTEMPTS} attempts`, () => {
      let won = false;
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !won; attempt++) {
        won = botPlaythroughWins(level.id, attempt);
      }
      expect(won).toBe(true);
    });
  }
});
