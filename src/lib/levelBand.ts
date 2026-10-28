// The player's school-level band (src/data/levels.ts). App.tsx sets it from
// the signed-in student's account, or from the level a guest picks, so
// quizzes, lesson games and story games ask questions at the right level
// without prop drilling. Nothing about a guest's pick is stored.

import { useSyncExternalStore } from "react";
import type { LevelBand } from "../data/levels";

let current: LevelBand = "p56";
const listeners = new Set<() => void>();

export function setLevelBand(band: LevelBand) {
  if (band === current) return;
  current = band;
  listeners.forEach((l) => l());
}

export function useLevelBand(): LevelBand {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
