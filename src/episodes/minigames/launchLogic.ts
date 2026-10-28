// The forces in Solar Escape (ThrustEscape.tsx), kept apart so they can be
// tested: the engines' thrust pushes the SKELD up, the Sun's pull (weight)
// and, for P5–6, drag from a dust cloud pull it down. Thrust must beat the
// pull; one more than the pull is "just enough" and saves fuel.
import type { LevelBand } from "../../data/levels";

export interface Launch {
  /** The Sun's pull on the ship. */
  weight: number;
  /** Drag from the dust cloud the ship flies through (P5–6 only, else 0). */
  drag: number;
  /** The most engine power the controls allow. */
  maxThrust: number;
}

export type Outcome = "perfect" | "climb" | "hover" | "sink";

export const LAUNCHES = 3;
export const TRIES = 2;

/** What the ship does when the engines fire with `thrust`. */
export function outcomeFor(thrust: number, launch: Launch): Outcome {
  const down = launch.weight + launch.drag;
  if (thrust === down + 1) return "perfect";
  if (thrust > down) return "climb";
  if (thrust === down) return "hover";
  return "sink";
}

export const escaped = (o: Outcome) => o === "perfect" || o === "climb";

/** Points for one launch: 2 for just enough thrust first time, 1 for any other escape. */
export function launchPoints(outcome: Outcome, attempt: number): number {
  if (!escaped(outcome)) return 0;
  return outcome === "perfect" && attempt === 0 ? 2 : 1;
}

export const MAX_POINTS = LAUNCHES * 2;

/** Three launches for a band, each pulling a little harder than the last. */
export function launchesFor(band: LevelBand, rnd: () => number = Math.random): Launch[] {
  const ri = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  if (band === "p12") {
    return [ri(2, 3), ri(3, 4), ri(4, 5)].map((weight) => ({ weight, drag: 0, maxThrust: weight + 3 }));
  }
  if (band === "p34") {
    return [ri(3, 5), ri(5, 7), ri(7, 9)].map((weight) => ({ weight, drag: 0, maxThrust: weight + 4 }));
  }
  return [
    { weight: ri(4, 6), drag: 0 },
    { weight: ri(5, 7), drag: ri(1, 2) },
    { weight: ri(6, 8), drag: ri(2, 3) },
  ].map((l) => ({ ...l, maxThrust: l.weight + l.drag + 4 }));
}

/** Read out (for screen readers) as a launch starts. */
export function launchLine(li: number, band: LevelBand): string {
  return `Launch ${li + 1} of ${LAUNCHES}. ${band === "p12" ? "Add blocks, then fire!" : "Set the power, then fire."}`;
}

/** Read out after a launch that didn't escape, with a try left. */
export const retryLine = (attempt: number) => `Try ${attempt + 1} of ${TRIES}.`;

/** Read out at the end. */
export const doneLine = (won: boolean) => `All ${LAUNCHES} launches done. ${won ? "Brilliant!" : "Good try!"}`;

/** What the helper says after a launch, in words for the band. */
export function launchTip(outcome: Outcome, thrust: number, launch: Launch, band: LevelBand): string {
  const { weight: w, drag: d } = launch;
  const down = w + d;
  if (band === "p12") {
    switch (outcome) {
      case "perfect":
        return "Perfect! One block more than the Sun's pull. Just enough!";
      case "climb":
        return "We escaped, but used extra fuel. Try one block more than the pull.";
      case "hover":
        return "Up and down are the same, so we just float. Add one more block!";
      case "sink":
        return "The Sun pulls harder than our engines push. Add more blocks!";
    }
  }
  const pull = d > 0 ? `weight + drag = ${w} + ${d} = ${down}` : `weight ${w}`;
  switch (outcome) {
    case "perfect":
      return `Perfect! Thrust ${thrust} beats ${pull}, with no fuel wasted.`;
    case "climb":
      return `Thrust ${thrust} beats ${pull}, but just enough is ${down + 1}. Save fuel next time!`;
    case "hover":
      return `Thrust ${thrust} equals ${pull}. Balanced forces, so we don't move. Add 1 more!`;
    case "sink":
      return `Thrust ${thrust} is less than ${pull}. The Sun wins. Add more thrust!`;
  }
}
