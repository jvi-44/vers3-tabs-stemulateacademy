// Primary levels in three bands, for questions and the STEMbot chat's wording.
// Same rule as bandFor() in src/data/levels.ts; src/__tests__/server-mirror.test.ts
// checks the two agree.

/** "Primary 1"/"Primary 2" -> "p12", "Primary 3"/"Primary 4" -> "p34", else "p56". */
export function bandForLevelName(levelName) {
  const n = Number(/^Primary\s+([1-6])$/i.exec(String(levelName ?? "").trim())?.[1]);
  if (n === 1 || n === 2) return "p12";
  if (n === 3 || n === 4) return "p34";
  return "p56";
}

export const BANDS = ["p12", "p34", "p56"];
