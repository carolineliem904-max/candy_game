import { describe, expect, it } from "vitest";
import { CandyType } from "../src/logic/CandyType";
import { pointsPerCandy, scoreForStep, scoreForSteps } from "../src/logic/ScoreRules";
import type { CascadeStep, Match } from "../src/logic/Board";

function matchOfSize(size: number, type: CandyType = CandyType.RED): Match {
  return {
    type,
    cells: Array.from({ length: size }, (_, i) => ({ col: i, row: 0 })),
  };
}

function stepWithMatches(...matches: Match[]): CascadeStep {
  return { matches, cleared: [], moves: [], spawns: [] };
}

describe("ScoreRules", () => {
  it("awards base points for a 3-match", () => {
    expect(pointsPerCandy(3)).toBe(60);
    const step = stepWithMatches(matchOfSize(3));
    expect(scoreForStep(step, 1)).toBe(3 * 60);
  });

  it("awards the run-4 bonus", () => {
    expect(pointsPerCandy(4)).toBe(100); // 60 base + 40 bonus
    const step = stepWithMatches(matchOfSize(4));
    expect(scoreForStep(step, 1)).toBe(4 * 100);
  });

  it("awards the run-5+ bonus", () => {
    expect(pointsPerCandy(5)).toBe(160); // 60 base + 100 bonus
    expect(pointsPerCandy(6)).toBe(160);
    const step = stepWithMatches(matchOfSize(5));
    expect(scoreForStep(step, 1)).toBe(5 * 160);
  });

  it("applies the cascade multiplier per step (x1, x2, x3...)", () => {
    const step1 = stepWithMatches(matchOfSize(3));
    const step2 = stepWithMatches(matchOfSize(3));
    const step3 = stepWithMatches(matchOfSize(3));

    expect(scoreForStep(step1, 1)).toBe(180 * 1);
    expect(scoreForStep(step2, 2)).toBe(180 * 2);
    expect(scoreForStep(step3, 3)).toBe(180 * 3);
  });

  it("sums a full cascade's steps with their respective multipliers", () => {
    const steps: CascadeStep[] = [stepWithMatches(matchOfSize(3)), stepWithMatches(matchOfSize(3))];
    // step1: 3*60*1 = 180, step2: 3*60*2 = 360, total 540
    expect(scoreForSteps(steps)).toBe(540);
  });

  it("sums multiple matches within the same step", () => {
    const step = stepWithMatches(matchOfSize(3), matchOfSize(4));
    // (3*60 + 4*100) * 1 = 580
    expect(scoreForStep(step, 1)).toBe(580);
  });
});
