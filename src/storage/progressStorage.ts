import type { GameProgress } from "../logic/GameProgress";

const STORAGE_KEY = "sweet-cascade:progress";

/** Returns saved progress, or null if there's nothing saved, storage is
 * unavailable (e.g. private browsing), or the saved data is corrupted. */
export function loadProgress(): GameProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isValidProgress(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Best-effort save. Swallows failures (quota exceeded, storage disabled) so
 * the game keeps working in-memory for the rest of the session either way. */
export function saveProgress(progress: GameProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignored — see doc comment above
  }
}

function isValidProgress(value: unknown): value is GameProgress {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<GameProgress>;
  return typeof candidate.highestUnlocked === "number" && typeof candidate.stars === "object" && candidate.stars !== null;
}
