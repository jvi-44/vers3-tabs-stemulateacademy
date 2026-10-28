// Shape checks for the P1–2 and P3–4 question banks in src/content/. They keep each
// bank in step with the original quizzes in src/data/lessonContent.ts and with what
// each game expects, so a typo in new content fails here instead of in a game.
import { describe, expect, it } from "vitest";
import { GAME_LESSONS } from "../data/lessonContent";
import { QUIZ_BANDS } from "./quizzes";
import { DROP_DASH_BANKS } from "./dropDash";
import { BLASTER_BANKS } from "./asteroidBlasters";
import { BUZZER_BANKS } from "./buzzerRound";
import { MATTER_ITEMS } from "./matterSorter";
import type { DropZoneKey, NewBand, QuizBeatId } from "./types";

const BANDS: NewBand[] = ["p12", "p34"];
const ZONES: DropZoneKey[] = ["evaporation", "transpiration", "condensation", "precipitation", "collection"];
/** BuzzerRound.tsx asks this many questions (its QUESTIONS list). */
const BUZZER_COUNT = 3;

const filled = (s: unknown) => typeof s === "string" && s.trim().length > 0;
const distinct = (xs: string[]) => new Set(xs.map((x) => x.trim().toLowerCase())).size === xs.length;
const validIndex = (i: number, list: unknown[]) => Number.isInteger(i) && i >= 0 && i < list.length;
const wordCount = (s: string) => s.trim().split(/\s+/).length;

const quizBeats = GAME_LESSONS.flatMap((l) => l.beats).filter((b) => b.quizQuestions?.length);

describe("QUIZ_BANDS", () => {
  it("has both bands for every quiz beat, each as long as the original quiz", () => {
    expect(Object.keys(QUIZ_BANDS).sort()).toEqual(quizBeats.map((b) => b.id).sort());
    for (const beat of quizBeats) {
      const entry = QUIZ_BANDS[beat.id as QuizBeatId];
      expect(Object.keys(entry).sort(), beat.id).toEqual([...BANDS].sort());
      for (const band of BANDS) expect(entry[band].length, `${beat.id} ${band}`).toBe(beat.quizQuestions!.length);
    }
  });

  it("every question has a valid answer, distinct options and an explanation", () => {
    for (const [id, entry] of Object.entries(QUIZ_BANDS)) {
      for (const band of BANDS) {
        for (const q of entry[band]) {
          const where = `${id} ${band}: ${q.question}`;
          expect(filled(q.question), where).toBe(true);
          expect(q.options.length, where).toBeGreaterThanOrEqual(2);
          expect(q.options.every(filled), where).toBe(true);
          expect(distinct(q.options), where).toBe(true);
          expect(validIndex(q.correctAnswer, q.options), where).toBe(true);
          expect(filled(q.explanation), where).toBe(true);
        }
      }
    }
  });
});

describe("DROP_DASH_BANKS", () => {
  it.each(BANDS)("%s has all five zones, at least 3 questions each", (band) => {
    expect(Object.keys(DROP_DASH_BANKS[band]).sort()).toEqual([...ZONES].sort());
    for (const zone of ZONES) {
      const qs = DROP_DASH_BANKS[band][zone];
      expect(qs.length, `${band} ${zone}`).toBeGreaterThanOrEqual(3);
      for (const q of qs) {
        expect(filled(q.q) && filled(q.why), q.q).toBe(true);
        expect(q.a, q.q).toHaveLength(3);
        expect(q.a.every(filled), q.q).toBe(true);
        // a[0] is the right answer, so it must not repeat among the wrong ones
        expect(distinct(q.a), q.q).toBe(true);
        // each answer sits in a lane on the canvas
        for (const opt of q.a) expect(opt.length, opt).toBeLessThanOrEqual(24);
      }
    }
  });
});

describe("BLASTER_BANKS", () => {
  it.each(BANDS)("%s has 7 forces and 7 energy questions", (band) => {
    const bank = BLASTER_BANKS[band];
    expect(bank.forces).toHaveLength(7);
    expect(bank.energy).toHaveLength(7);
    for (const q of [...bank.forces, ...bank.energy]) {
      expect([q.q, q.a, q.why, ...q.wrong].every(filled), q.q).toBe(true);
      expect(q.wrong, q.q).toHaveLength(2);
      // the answer never repeats in `wrong`
      expect(distinct([q.a, ...q.wrong]), q.q).toBe(true);
      // labels ride on asteroids
      for (const label of [q.a, ...q.wrong]) expect(label.length, label).toBeLessThanOrEqual(16);
    }
  });
});

describe("BUZZER_BANKS", () => {
  it.each(BANDS)("%s has as many questions as the original round, four options each", (band) => {
    const qs = BUZZER_BANKS[band];
    expect(qs).toHaveLength(BUZZER_COUNT);
    for (const q of qs) {
      expect(filled(q.q) && filled(q.why), q.q).toBe(true);
      // A–D buttons; the lifeline knocks out two wrong answers
      expect(q.options, q.q).toHaveLength(4);
      expect(q.options.every(filled), q.q).toBe(true);
      expect(distinct(q.options), q.q).toBe(true);
      expect(validIndex(q.answer, q.options), q.q).toBe(true);
    }
  });
});

describe("MATTER_ITEMS", () => {
  it.each(BANDS)("%s has 12+ items, 3+ of each state, with #rrggbb colours", (band) => {
    const items = MATTER_ITEMS[band];
    expect(items.length).toBeGreaterThanOrEqual(12);
    for (const state of ["solid", "liquid", "gas"] as const) {
      expect(items.filter((i) => i.state === state).length, state).toBeGreaterThanOrEqual(3);
    }
    expect(distinct(items.map((i) => i.name))).toBe(true);
    for (const item of items) {
      expect(filled(item.name) && filled(item.why), item.name).toBe(true);
      expect(item.color, item.name).toMatch(/^#[0-9a-f]{6}$/i);
      expect(item.name.length, item.name).toBeLessThanOrEqual(20);
    }
  });
});

describe("P1–2 reading level", () => {
  it("keeps every P1–2 question to 12 words or fewer", () => {
    const questions = [
      ...Object.values(QUIZ_BANDS).flatMap((entry) => entry.p12.map((q) => q.question)),
      ...ZONES.flatMap((zone) => DROP_DASH_BANKS.p12[zone].map((q) => q.q)),
      ...[...BLASTER_BANKS.p12.forces, ...BLASTER_BANKS.p12.energy].map((q) => q.q),
      ...BUZZER_BANKS.p12.map((q) => q.q),
    ];
    for (const text of questions) expect(wordCount(text), text).toBeLessThanOrEqual(12);
  });
});
