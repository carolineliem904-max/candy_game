import { describe, expect, it } from "vitest";
import { CandyType } from "../src/logic/CandyType";
import { SPECIAL_CREATION_BONUS, pointsPerCandy, scoreForStep, scoreForSteps } from "../src/logic/ScoreRules";
import type { Cell, CascadeStep, Match, SpecialCreation } from "../src/logic/Board";

function matchOfSize(size: number, type: CandyType = CandyType.RED): Match {
  return {
    type,
    orientation: "horizontal",
    cells: Array.from({ length: size }, (_, i) => ({ col: i, row: 0 })),
  };
}

function stepWithMatches(...matches: Match[]): CascadeStep {
  const cleared = matches.flatMap((m) => m.cells);
  return { matches, activations: [], specialsCreated: [], cleared, moves: [], spawns: [] };
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

  it("adds a flat +200 per special created, multiplied by the cascade multiplier", () => {
    const match = matchOfSize(4);
    const creation: SpecialCreation = { cell: { col: 0, row: 0 }, special: "stripedH", type: CandyType.RED };
    const step: CascadeStep = {
      matches: [match],
      activations: [],
      specialsCreated: [creation],
      cleared: match.cells.slice(1), // the spawn cell (col0) isn't cleared, it becomes the special
      moves: [],
      spawns: [],
    };
    // run: 4*100=400, creation: +200 -> (400+200)*1 = 600
    expect(scoreForStep(step, 1)).toBe(600);
    expect(SPECIAL_CREATION_BONUS).toBe(200);

    // same step at cascade position 3: (400+200)*3 = 1800
    expect(scoreForStep(step, 3)).toBe(1800);
  });

  it("scores cells cleared by a special effect at flat base (no run bonus), not double-counting matched cells", () => {
    const effectCells: Cell[] = [
      { col: 0, row: 5 },
      { col: 1, row: 5 },
      { col: 2, row: 5 },
      { col: 3, row: 5 },
    ];
    const step: CascadeStep = {
      matches: [],
      activations: [
        { cell: { col: 0, row: 5 }, special: "stripedH", type: CandyType.RED, cellsCleared: effectCells },
      ],
      specialsCreated: [],
      cleared: effectCells,
      moves: [],
      spawns: [],
    };
    // 4 cells at flat 60, no run bonus: 4*60*1 = 240
    expect(scoreForStep(step, 1)).toBe(240);
  });
});
