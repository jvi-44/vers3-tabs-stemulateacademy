// Types for the level-banded question banks in src/content/. The P5–6 sets are the
// original questions, kept in src/data/lessonContent.ts and in each game file; these
// banks add the P1–2 and P3–4 sets.
import type { QuizQuestion } from "../data/lessonContent";

export type LevelBand = "p12" | "p34" | "p56";
/** The bands these banks add. */
export type NewBand = "p12" | "p34";
export type Banded<T> = Record<NewBand, T>;

export type { QuizQuestion };

/** Quiz beats in src/data/lessonContent.ts that have a quiz. */
export type QuizBeatId =
  | "mm-sci1-quiz" | "mm-sci2-quiz" | "mm-math1-quiz" | "mm-math2-quiz"
  | "mi-math1-quiz" | "mi-math2-quiz"
  | "sb-sci1-quiz" | "sb-sci2-quiz" | "sb-math1-quiz";

/** Drippy's Water Cycle Dash (src/games/DropDash.tsx): `a[0]` is the right answer. */
export type DropZoneKey = "evaporation" | "transpiration" | "condensation" | "precipitation" | "collection";
export interface DropQuestion {
  q: string;
  a: [string, string, string];
  why: string;
}

/** Asteroid Blasters (src/games/AsteroidBlasters.tsx). */
export interface BlasterQuestion {
  q: string;
  a: string;
  wrong: [string, string];
  why: string;
}

/** Buzzer round (src/episodes/minigames/BuzzerRound.tsx): `answer` indexes `options`. */
export interface BuzzerQuestion {
  q: string;
  options: string[];
  answer: number;
  why: string;
}

/** Matter sorter (src/episodes/minigames/MatterSorter.tsx). `color` is a #rrggbb fill. */
export interface MatterItem {
  name: string;
  state: "solid" | "liquid" | "gas";
  color: string;
  why: string;
}
