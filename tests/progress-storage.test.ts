import { beforeEach, describe, expect, it } from "vitest";
import { loadProgress, saveProgress } from "../src/storage/progressStorage";
import type { GameProgress } from "../src/logic/GameProgress";

/** Minimal in-memory Storage stand-in — avoids pulling in jsdom just for
 * localStorage. Also lets us simulate a throwing storage (private browsing /
 * quota exceeded) which a real browser's localStorage can't easily do in Node. */
class FakeStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

class ThrowingStorage implements Storage {
  get length(): number {
    return 0;
  }
  clear(): void {
    throw new Error("storage disabled");
  }
  getItem(): string | null {
    throw new Error("storage disabled");
  }
  key(): string | null {
    throw new Error("storage disabled");
  }
  removeItem(): void {
    throw new Error("storage disabled");
  }
  setItem(): void {
    throw new Error("storage disabled");
  }
}

beforeEach(() => {
  globalThis.localStorage = new FakeStorage();
});

describe("progressStorage", () => {
  it("returns null when nothing has been saved yet", () => {
    expect(loadProgress()).toBeNull();
  });

  it("round-trips a saved progress object", () => {
    const progress: GameProgress = { highestUnlocked: 4, stars: { 1: 3, 2: 1 } };

    saveProgress(progress);

    expect(loadProgress()).toEqual(progress);
  });

  it("falls back to null on corrupted JSON", () => {
    localStorage.setItem("sweet-cascade:progress", "{not valid json");

    expect(loadProgress()).toBeNull();
  });

  it("falls back to null on well-formed JSON that isn't a GameProgress shape", () => {
    localStorage.setItem("sweet-cascade:progress", JSON.stringify({ foo: "bar" }));

    expect(loadProgress()).toBeNull();
  });

  it("does not throw when storage access fails (private browsing safety)", () => {
    globalThis.localStorage = new ThrowingStorage();

    expect(() => saveProgress({ highestUnlocked: 1, stars: {} })).not.toThrow();
    expect(() => loadProgress()).not.toThrow();
    expect(loadProgress()).toBeNull();
  });
});
