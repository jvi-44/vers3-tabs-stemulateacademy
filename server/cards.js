// Server-side copy of the card pools and packs from src/data/cardData.ts
// (ids, rarity, cost and card count only — images stay in the frontend).
// Packs are rolled here so the browser can't pick its own cards or skip
// paying for them. Keep in sync with src/data/cardData.ts —
// src/__tests__/server-mirror.test.ts fails if the two drift apart.
import crypto from "crypto";

const phen = (n, rarity) => ({ id: `phen-${n}`, rarity });
const fig = (n, rarity) => ({ id: `fig-${n}`, rarity });

export const CARD_POOLS = {
  phenomena: [
    phen(1, "epic"), phen(2, "common"), phen(3, "common"), phen(4, "common"),
    phen(5, "rare"), phen(6, "common"), phen(7, "common"), phen(8, "rare"),
    phen(9, "common"), phen(10, "rare"), phen(11, "common"), phen(12, "common"),
    phen(13, "rare"), phen(14, "epic"), phen(15, "common"), phen(16, "epic"),
  ],
  figures: [
    fig(1, "legendary"), fig(2, "legendary"), fig(3, "legendary"), fig(4, "legendary"),
    fig(5, "legendary"), fig(6, "epic"), fig(7, "epic"), fig(8, "epic"),
    fig(9, "epic"), fig(10, "epic"), fig(11, "epic"), fig(12, "rare"),
    fig(13, "rare"), fig(14, "rare"),
  ],
};

export const ALBUM_PACKS = {
  phenomena: [
    { id: "phen-p1", cost: 50, cardsCount: 2 },
    { id: "phen-p2", cost: 100, cardsCount: 3 },
  ],
  figures: [
    { id: "fig-p1", cost: 75, cardsCount: 2 },
    { id: "fig-p2", cost: 150, cardsCount: 3 },
  ],
};

// Same weights the frontend used (App.tsx RARITY_WEIGHTS).
export const RARITY_WEIGHTS = { common: 55, rare: 28, epic: 13, legendary: 4 };

export const ALL_CARD_IDS = new Set(
  Object.values(CARD_POOLS).flatMap((pool) => pool.map((c) => c.id)),
);

/** The pack definition, or null if albumKey/packId isn't a real pack. */
export function findPack(albumKey, packId) {
  if (typeof albumKey !== "string" || typeof packId !== "string") return null;
  if (!Object.hasOwn(ALBUM_PACKS, albumKey)) return null;
  return ALBUM_PACKS[albumKey].find((p) => p.id === packId) ?? null;
}

/** Draws `pack.cardsCount` card ids from the album's pool, weighted by rarity. */
export function rollPack(albumKey, pack) {
  const pool = CARD_POOLS[albumKey];
  const total = pool.reduce((sum, c) => sum + RARITY_WEIGHTS[c.rarity], 0);
  const drawOne = () => {
    let roll = crypto.randomInt(total);
    for (const card of pool) {
      roll -= RARITY_WEIGHTS[card.rarity];
      if (roll < 0) return card.id;
    }
    return pool[0].id;
  };
  return Array.from({ length: pack.cardsCount }, drawOne);
}
