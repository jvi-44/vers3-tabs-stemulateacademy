// Primary levels in three bands. Each band gets its own quiz and game
// questions: new P1–2 and P3–4 sets in src/content/, and the original
// questions (written for the P5–6 workshops) for P5–6. Same rule as
// bandForLevelName() in server/levels.js; src/__tests__/server-mirror.test.ts
// checks the two agree.
import type { Banded, LevelBand } from "../content/types";

export type { LevelBand };

export const LEVEL_BANDS: { id: LevelBand; label: string }[] = [
  { id: "p12", label: "Primary 1–2" },
  { id: "p34", label: "Primary 3–4" },
  { id: "p56", label: "Primary 5–6" },
];

/** "Primary 1"/"Primary 2" -> "p12", "Primary 3"/"Primary 4" -> "p34", anything else -> "p56". */
export function bandFor(levelName?: string | null): LevelBand {
  const n = Number(/^Primary\s+([1-6])$/i.exec(String(levelName ?? "").trim())?.[1]);
  if (n === 1 || n === 2) return "p12";
  if (n === 3 || n === 4) return "p34";
  return "p56";
}

/**
 * The questions for a band: the new set from src/content/ for P1–2 and P3–4,
 * else the original ones. A missing or empty set falls back to the original,
 * so a game never runs out of questions.
 */
export function forBand<T>(banded: Partial<Banded<T>> | undefined, band: LevelBand, original: T): T {
  if (band === "p56") return original;
  const set = banded?.[band];
  if (set === undefined || set === null) return original;
  if (Array.isArray(set) && set.length === 0) return original;
  return set;
}

/** `set` unless it's missing or empty, else `original`. */
export function orOriginal<T>(set: T[] | undefined, original: T[]): T[] {
  return set && set.length > 0 ? set : original;
}
