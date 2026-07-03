import type { LevelDef } from "./LevelDef";

/** Hand-authored difficulty curve — trivially editable, Caroline will retune
 * after playtesting. L1-2 ease in with only 5 candy types (more matches);
 * L3 introduces the 6th type as the first real difficulty step; L4 is the
 * originally-tuned standalone game. L5-10 flattened to a gentler ~800/level
 * climb, all at 15 moves (no move-budget dip — with specials coming in
 * SLICE 6B, move pressure isn't needed yet; L8's ~9200/15 is hard-but-doable
 * pre-specials and should feel right once specials land). */
export const LEVELS: LevelDef[] = [
  { id: 1, targetScore: 3000, maxMoves: 15, candyTypes: 5 },
  { id: 2, targetScore: 4500, maxMoves: 15, candyTypes: 5 },
  { id: 3, targetScore: 4500, maxMoves: 15, candyTypes: 6 },
  { id: 4, targetScore: 6000, maxMoves: 15, candyTypes: 6 },
  { id: 5, targetScore: 6800, maxMoves: 15, candyTypes: 6 },
  { id: 6, targetScore: 7600, maxMoves: 15, candyTypes: 6 },
  { id: 7, targetScore: 8400, maxMoves: 15, candyTypes: 6 },
  { id: 8, targetScore: 9200, maxMoves: 15, candyTypes: 6 },
  { id: 9, targetScore: 10000, maxMoves: 15, candyTypes: 6 },
  { id: 10, targetScore: 11000, maxMoves: 15, candyTypes: 6 },
];

export const LEVEL_COUNT = LEVELS.length;

export function getLevelById(id: number): LevelDef | undefined {
  return LEVELS.find((level) => level.id === id);
}
