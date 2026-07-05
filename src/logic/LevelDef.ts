import type { LevelGoal } from "./LevelGoal";

export interface LevelDef {
  id: number;
  targetScore: number;
  maxMoves: number;
  /** Number of distinct candy types in play (5 = easier/more matches, 6 = standard). */
  candyTypes: number;
  /** The level's primary objective. Defaults to a plain score goal for every
   * pre-SLICE-8 level (see levels.ts). */
  goal: LevelGoal;
}
