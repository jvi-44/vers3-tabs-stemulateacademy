// High scores, normalised to 0–100 for every game.
// Kept in localStorage so they work offline, and synced to the Express API
// (game_scores table) so they follow the player across devices.

const KEY = (userId: string | number | undefined) => `stemulate_game_best_${userId ?? "guest"}`;

type BestMap = Record<string, number>;

function read(userId?: string | number): BestMap {
  try {
    return JSON.parse(localStorage.getItem(KEY(userId)) || "{}");
  } catch {
    return {};
  }
}

function write(userId: string | number | undefined, map: BestMap) {
  try {
    localStorage.setItem(KEY(userId), JSON.stringify(map));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent("stemulate-highscores"));
}

export function getHighScore(gameId: string, userId?: string | number): number | null {
  const v = read(userId)[gameId];
  return typeof v === "number" ? v : null;
}

export function getAllHighScores(userId?: string | number): BestMap {
  return read(userId);
}

/** Saves a finished run. Returns the best score and whether this run beat it. */
export function recordScore(gameId: string, score: number, userId?: string | number) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const map = read(userId);
  const prev = map[gameId];
  const isNew = prev === undefined || s > prev;
  if (isNew) {
    map[gameId] = s;
    write(userId, map);
  }
  if (userId !== undefined) {
    fetch("/api/game-scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, gameId, score: s }),
    }).catch(() => {});
  }
  return { best: isNew ? s : prev!, previous: prev ?? null, isNew };
}

/** Pulls server-side bests into local storage (keeps whichever is higher). */
export async function syncHighScores(userId: string | number) {
  try {
    const res = await fetch(`/api/game-scores/${userId}`);
    if (!res.ok) return;
    const { scores } = (await res.json()) as { scores: { game_id: string; best_score: number }[] };
    const map = read(userId);
    let changed = false;
    scores.forEach(({ game_id, best_score }) => {
      if ((map[game_id] ?? -1) < best_score) {
        map[game_id] = best_score;
        changed = true;
      }
    });
    if (changed) write(userId, map);
  } catch {
    /* offline is fine */
  }
}

/** 0–100 → 0–3 stars. */
export function starsFor(score: number) {
  return score >= 90 ? 3 : score >= 65 ? 2 : score >= 35 ? 1 : 0;
}

/** Deterministic random numbers, so everyone in a live match gets the same puzzles. */
export function seededRandom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}
