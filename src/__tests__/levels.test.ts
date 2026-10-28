// Picking each band's questions: the original set for P5–6, the band's own
// set for P1–2 and P3–4, and the original again whenever a band's set is
// missing or empty, so no game runs out of questions.
import { describe, expect, it } from "vitest";
import { forBand, orOriginal } from "../data/levels";

describe("forBand", () => {
  const original = ["original"];
  const banded = { p12: ["easy"], p34: [] as string[] };

  it("gives P5–6 the original questions", () => {
    expect(forBand(banded, "p56", original)).toBe(original);
  });

  it("gives P1–2 and P3–4 their own, falling back to the original", () => {
    expect(forBand(banded, "p12", original)).toEqual(["easy"]);
    expect(forBand(banded, "p34", original)).toBe(original);
    expect(forBand(undefined, "p12", original)).toBe(original);
    expect(forBand({}, "p34", original)).toBe(original);
  });
});

describe("orOriginal", () => {
  it("keeps a set with questions in it, else the original", () => {
    expect(orOriginal(["a"], ["b"])).toEqual(["a"]);
    expect(orOriginal([], ["b"])).toEqual(["b"]);
    expect(orOriginal(undefined, ["b"])).toEqual(["b"]);
  });
});
