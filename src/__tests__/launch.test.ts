// Solar Escape's forces (src/episodes/minigames/launchLogic.ts).
import { describe, expect, it } from "vitest";
import {
  LAUNCHES,
  MAX_POINTS,
  doneLine,
  escaped,
  launchLine,
  launchPoints,
  launchTip,
  launchesFor,
  outcomeFor,
  retryLine,
} from "../episodes/minigames/launchLogic";

const launch = { weight: 5, drag: 2, maxThrust: 11 };

describe("thrust against the pull", () => {
  it("sinks below the pull, hovers when equal, climbs above it", () => {
    expect([4, 6, 7, 8, 11].map((t) => outcomeFor(t, launch))).toEqual(["sink", "sink", "hover", "perfect", "climb"]);
    expect(escaped("perfect") && escaped("climb")).toBe(true);
    expect(escaped("hover") || escaped("sink")).toBe(false);
  });

  it("scores 2 for just enough first time, 1 for any other escape", () => {
    expect([launchPoints("perfect", 0), launchPoints("climb", 0), launchPoints("perfect", 1), launchPoints("hover", 0), launchPoints("sink", 1)]).toEqual([2, 1, 1, 0, 0]);
    expect(MAX_POINTS).toBe(LAUNCHES * 2);
  });
});

describe("launches by band", () => {
  const many = (band: "p12" | "p34" | "p56") => Array.from({ length: 200 }, () => launchesFor(band));

  it("P1–2 and P3–4 have no drag; P5–6 add drag after the first launch", () => {
    for (const set of [...many("p12"), ...many("p34")]) expect(set.every((l) => l.drag === 0)).toBe(true);
    for (const set of many("p56")) {
      expect(set[0].drag).toBe(0);
      expect(set[1].drag).toBeGreaterThan(0);
      expect(set[2].drag).toBeGreaterThan(0);
    }
  });

  it("keeps numbers small for the youngest and pulls harder each launch", () => {
    for (const set of many("p12")) {
      expect(set.every((l) => l.weight >= 2 && l.weight <= 5)).toBe(true);
      expect(set[0].weight).toBeLessThanOrEqual(set[2].weight);
    }
    for (const set of many("p34")) expect(set.every((l) => l.weight >= 3 && l.weight <= 9)).toBe(true);
  });

  it("always lets you reach just enough thrust, and a bit more", () => {
    for (const band of ["p12", "p34", "p56"] as const) {
      for (const set of many(band)) {
        expect(set).toHaveLength(LAUNCHES);
        for (const l of set) expect(l.maxThrust).toBeGreaterThan(l.weight + l.drag + 1);
      }
    }
  });
});

describe("tips", () => {
  it("use no numbers for P1–2 and the sums for P3–6", () => {
    expect(launchTip("sink", 3, { weight: 4, drag: 0, maxThrust: 7 }, "p12")).not.toMatch(/\d/);
    expect(launchTip("hover", 7, launch, "p56")).toContain("weight + drag = 5 + 2 = 7");
    expect(launchTip("climb", 9, { weight: 6, drag: 0, maxThrust: 10 }, "p34")).toContain("just enough is 7");
  });
});

describe("what's read out for screen readers", () => {
  it("names the launch, the try and the end, in words for the band", () => {
    expect(launchLine(0, "p12")).toBe("Launch 1 of 3. Add blocks, then fire!");
    expect(launchLine(2, "p56")).toBe("Launch 3 of 3. Set the power, then fire.");
    expect(retryLine(1)).toBe("Try 2 of 2.");
    expect([doneLine(true), doneLine(false)]).toEqual(["All 3 launches done. Brilliant!", "All 3 launches done. Good try!"]);
  });
});
