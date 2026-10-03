// The server keeps its own copy of the lesson beats and card packs (so it
// never trusts the browser for rewards or prompts). This test fails if those
// copies drift from the frontend data files.
import { describe, expect, it } from "vitest";
import { GAME_LESSONS } from "../data/lessonContent";
import { PHENOMENA_CARDS, FIGURE_CARDS, ALBUM_PACKS } from "../data/cardData";
// @ts-ignore -- plain JS module shared with the Node server
import { BEATS, LESSONS } from "../../server/lessons.js";
// @ts-ignore -- plain JS module shared with the Node server
import { CARD_POOLS, ALBUM_PACKS as SERVER_PACKS } from "../../server/cards.js";

describe("server/lessons.js mirrors src/data/lessonContent.ts", () => {
  it("has the same lessons", () => {
    expect(Object.keys(LESSONS).sort()).toEqual(GAME_LESSONS.map((l) => l.id).sort());
    for (const lesson of GAME_LESSONS) expect(LESSONS[lesson.id].title).toBe(lesson.title);
  });

  it("has the same beats", () => {
    const client = GAME_LESSONS.flatMap((l) =>
      l.beats.map((b) => ({
        id: b.id,
        lessonId: l.id,
        type: b.type,
        subject: b.subject,
        title: b.title,
        description: b.description,
      })),
    );
    const server = (BEATS as any[]).map((b) => ({
      id: b.id,
      lessonId: b.lessonId,
      type: b.type,
      subject: b.subject,
      title: b.title,
      description: b.description,
    }));
    expect(server).toEqual(client);
  });
});

describe("server/cards.js mirrors src/data/cardData.ts", () => {
  it("has the same card ids and rarities", () => {
    const pick = (cards: { id: string; rarity: string }[]) => cards.map(({ id, rarity }) => ({ id, rarity }));
    expect(CARD_POOLS.phenomena).toEqual(pick(PHENOMENA_CARDS));
    expect(CARD_POOLS.figures).toEqual(pick(FIGURE_CARDS));
  });

  it("has the same packs, costs and card counts", () => {
    for (const album of ["phenomena", "figures"] as const) {
      const client = ALBUM_PACKS[album].map(({ id, cost, cardsCount }) => ({ id, cost, cardsCount }));
      expect(SERVER_PACKS[album]).toEqual(client);
    }
  });
});
