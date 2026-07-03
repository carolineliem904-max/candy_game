import type { CascadeStep, Match } from "./Board";

/**
 * Scoring formula (tune here — nothing else needs to change):
 *   points per cleared candy = BASE_POINTS_PER_CANDY + runBonusPerCandy(run length)
 *   step's run score = sum over every match in the step of (match size * points per candy)
 *   step's bonus score = (cells cleared by special effects, excluding cells
 *     already counted by a match this step) * BASE_POINTS_PER_CANDY, no run bonus
 *   step's creation score = (specials created this step) * SPECIAL_CREATION_BONUS
 *   step score = (run + bonus + creation) * cascade multiplier for that step
 * A candy in a match of size 4+ gets both the base and the run bonus. A candy
 * that belongs to two runs at once (an L/T intersection) is scored once per
 * run it's part of, matching each run's own bonus. A cell cleared by both a
 * match and a special effect in the same step is only scored once (as the
 * match), not double-counted as a bonus clear too.
 */
export const BASE_POINTS_PER_CANDY = 60;
export const RUN_BONUS_4_PER_CANDY = 40;
export const RUN_BONUS_5_PLUS_PER_CANDY = 100;
export const SPECIAL_CREATION_BONUS = 200;

function runBonusPerCandy(runLength: number): number {
  if (runLength >= 5) {
    return RUN_BONUS_5_PLUS_PER_CANDY;
  }
  if (runLength === 4) {
    return RUN_BONUS_4_PER_CANDY;
  }
  return 0;
}

export function pointsPerCandy(runLength: number): number {
  return BASE_POINTS_PER_CANDY + runBonusPerCandy(runLength);
}

/** Cascade multiplier for a 1-indexed step number: step 1 = x1, step 2 = x2, ... */
export function cascadeMultiplier(stepNumber: number): number {
  return stepNumber;
}

function matchedCellKeySet(matches: Match[]): Set<string> {
  const keys = new Set<string>();
  for (const match of matches) {
    for (const cell of match.cells) keys.add(`${cell.col},${cell.row}`);
  }
  return keys;
}

/** Score earned by a single cascade step, given its 1-indexed position in the cascade. */
export function scoreForStep(step: CascadeStep, stepNumber: number): number {
  const runScore = step.matches.reduce((sum, match) => sum + match.cells.length * pointsPerCandy(match.cells.length), 0);

  const matchedKeys = matchedCellKeySet(step.matches);
  const bonusCellCount = step.cleared.filter((cell) => !matchedKeys.has(`${cell.col},${cell.row}`)).length;
  const bonusScore = bonusCellCount * BASE_POINTS_PER_CANDY;

  const creationScore = step.specialsCreated.length * SPECIAL_CREATION_BONUS;

  return (runScore + bonusScore + creationScore) * cascadeMultiplier(stepNumber);
}

/** Total score earned across an ordered list of cascade steps (1-indexed internally). */
export function scoreForSteps(steps: CascadeStep[]): number {
  return steps.reduce((sum, step, index) => sum + scoreForStep(step, index + 1), 0);
}
