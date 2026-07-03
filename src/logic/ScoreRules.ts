import type { CascadeStep } from "./Board";

/**
 * Scoring formula (tune here — nothing else needs to change):
 *   points per cleared candy = BASE_POINTS_PER_CANDY + runBonusPerCandy(run length)
 *   step score = sum over every match in the step of (match size * points per candy)
 *   step score is then multiplied by the cascade multiplier for that step
 * A candy in a match of size 4+ gets both the base and the run bonus. A candy
 * that belongs to two runs at once (an L/T intersection) is scored once per
 * run it's part of, matching each run's own bonus.
 */
export const BASE_POINTS_PER_CANDY = 60;
export const RUN_BONUS_4_PER_CANDY = 40;
export const RUN_BONUS_5_PLUS_PER_CANDY = 100;

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

/** Score earned by a single cascade step, given its 1-indexed position in the cascade. */
export function scoreForStep(step: CascadeStep, stepNumber: number): number {
  const raw = step.matches.reduce((sum, match) => sum + match.cells.length * pointsPerCandy(match.cells.length), 0);
  return raw * cascadeMultiplier(stepNumber);
}

/** Total score earned across an ordered list of cascade steps (1-indexed internally). */
export function scoreForSteps(steps: CascadeStep[]): number {
  return steps.reduce((sum, step, index) => sum + scoreForStep(step, index + 1), 0);
}
