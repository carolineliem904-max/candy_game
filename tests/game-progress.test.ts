import { describe, expect, it } from "vitest";
import { completeLevel, createInitialProgress, starsForScore } from "../src/logic/GameProgress";
import { getLevelById, LEVELS } from "../src/logic/levels";
import { makeLevel } from "./helpers";

describe("starsForScore", () => {
  it("gives exact boundary thresholds: target -> 1, target*1.3 -> 2, target*1.6 -> 3", () => {
    const level = makeLevel({ targetScore: 1000 });

    expect(starsForScore(level, 999)).toBe(0);
    expect(starsForScore(level, 1000)).toBe(1);
    expect(starsForScore(level, 1299)).toBe(1);
    expect(starsForScore(level, 1300)).toBe(2);
    expect(starsForScore(level, 1599)).toBe(2);
    expect(starsForScore(level, 1600)).toBe(3);
    expect(starsForScore(level, 5000)).toBe(3);
  });

  it("holds the same boundaries for every hand-authored level", () => {
    for (const level of LEVELS) {
      const target130 = Math.round(level.targetScore * 1.3);
      const target160 = Math.round(level.targetScore * 1.6);
      expect(starsForScore(level, level.targetScore - 1)).toBe(0);
      expect(starsForScore(level, level.targetScore)).toBe(1);
      expect(starsForScore(level, target130 - 1)).toBe(1);
      expect(starsForScore(level, target130)).toBe(2);
      expect(starsForScore(level, target160 - 1)).toBe(2);
      expect(starsForScore(level, target160)).toBe(3);
    }
  });
});

describe("completeLevel", () => {
  it("unlocks the next level once any stars are earned", () => {
    const level1 = getLevelById(1)!;
    const progress = createInitialProgress();

    const next = completeLevel(progress, 1, level1.targetScore);

    expect(next.highestUnlocked).toBe(2);
    expect(next.stars[1]).toBe(1);
  });

  it("does not unlock the next level (or record stars) on a score below target", () => {
    const level1 = getLevelById(1)!;
    const progress = createInitialProgress();

    const next = completeLevel(progress, 1, level1.targetScore - 1);

    expect(next.highestUnlocked).toBe(1);
    expect(next.stars[1]).toBeUndefined();
  });

  it("keeps the best stars ever earned — replaying worse never downgrades", () => {
    const level1 = getLevelById(1)!;
    let progress = createInitialProgress();

    progress = completeLevel(progress, 1, Math.round(level1.targetScore * 1.6)); // 3 stars
    expect(progress.stars[1]).toBe(3);

    progress = completeLevel(progress, 1, level1.targetScore); // replay with only 1 star
    expect(progress.stars[1]).toBe(3);
  });

  it("upgrades stars on a better replay", () => {
    const level1 = getLevelById(1)!;
    let progress = createInitialProgress();

    progress = completeLevel(progress, 1, level1.targetScore); // 1 star
    expect(progress.stars[1]).toBe(1);

    progress = completeLevel(progress, 1, Math.round(level1.targetScore * 1.6)); // 3 stars
    expect(progress.stars[1]).toBe(3);
  });

  it("never re-locks: a losing replay of an already-unlocked frontier keeps highestUnlocked", () => {
    const level1 = getLevelById(1)!;
    let progress = createInitialProgress();
    progress = completeLevel(progress, 1, level1.targetScore); // unlocks level 2
    expect(progress.highestUnlocked).toBe(2);

    // Replaying level 1 and failing to reach target this time.
    progress = completeLevel(progress, 1, 0);

    expect(progress.highestUnlocked).toBe(2);
    expect(progress.stars[1]).toBe(1);
  });

  it("does not advance highestUnlocked past what's already unlocked for a lower level", () => {
    const level2 = getLevelById(2)!;
    let progress = createInitialProgress();
    progress = { ...progress, highestUnlocked: 5 };

    progress = completeLevel(progress, 2, level2.targetScore);

    expect(progress.highestUnlocked).toBe(5);
  });

  it("returns the same progress unchanged for an unknown level id", () => {
    const progress = createInitialProgress();
    const next = completeLevel(progress, 9999, 1_000_000);
    expect(next).toEqual(progress);
  });
});
