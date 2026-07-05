import type { CandyType } from "./CandyType";
import type { Cell } from "./Board";

/** A level's primary objective. Score is always tracked regardless of kind
 * (it still drives the level's stars for "score" levels — see
 * GameProgress.starsForLevel), but only a "score" goal uses it as the win
 * condition. v1 keeps exactly one goal kind per level (no combined goals). */
export type LevelGoal =
  | { kind: "score" }
  | { kind: "collect"; pieces: Partial<Record<CandyType, number>> }
  | { kind: "jelly"; jellyCells: Cell[] };
