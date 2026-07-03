export interface LevelDef {
  id: number;
  targetScore: number;
  maxMoves: number;
  /** Number of distinct candy types in play (5 = easier/more matches, 6 = standard). */
  candyTypes: number;
}
