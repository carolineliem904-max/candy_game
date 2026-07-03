import type { LevelDef } from "./LevelDef";
import { getLevelById } from "./levels";

export interface GameProgress {
  highestUnlocked: number;
  stars: Partial<Record<number, 1 | 2 | 3>>;
}

export function createInitialProgress(): GameProgress {
  return { highestUnlocked: 1, stars: {} };
}

/** Star thresholds: 1 = reached target, 2 = target*1.3, 3 = target*1.6.
 * Rounds each threshold so a future non-round target (Caroline will retune
 * these) can't miss an exact-boundary score to floating-point drift. */
export function starsForScore(level: LevelDef, score: number): 0 | 1 | 2 | 3 {
  if (score >= Math.round(level.targetScore * 1.6)) {
    return 3;
  }
  if (score >= Math.round(level.targetScore * 1.3)) {
    return 2;
  }
  if (score >= level.targetScore) {
    return 1;
  }
  return 0;
}

/** Records a level attempt: unlocks the next level once any stars are
 * earned, and keeps the best stars ever earned for that level — a replay
 * that scores worse never downgrades stars or re-locks anything. */
export function completeLevel(progress: GameProgress, levelId: number, score: number): GameProgress {
  const level = getLevelById(levelId);
  if (!level) {
    return progress;
  }

  const earned = starsForScore(level, score);
  const existing = progress.stars[levelId] ?? 0;
  const stars = { ...progress.stars };
  if (earned > existing) {
    // earned > existing >= 0 implies earned is at least 1 here.
    stars[levelId] = earned as 1 | 2 | 3;
  }

  const highestUnlocked = earned > 0 ? Math.max(progress.highestUnlocked, levelId + 1) : progress.highestUnlocked;

  return { highestUnlocked, stars };
}
