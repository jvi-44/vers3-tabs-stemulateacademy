// Talks to the same Express + SQLite backend as auth.ts. See server/index.js
// for the routes and SQL_EXPLAINED.md (project root) for a walkthrough of how
// this all persists to disk.

const BASE_URL = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    // The server identifies the user from the httpOnly session cookie.
    credentials: "include",
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data as T;
}

export interface ProgressRow {
  lesson_id: string;
  status: "not_started" | "in_progress" | "completed";
  score: number | null;
}

export function getProgress(): Promise<{ progress: ProgressRow[] }> {
  return request("/progress");
}

export function postProgress(
  lessonId: string,
  status: "in_progress" | "completed",
  score?: number | null,
): Promise<{ success: true }> {
  return request("/progress", {
    method: "POST",
    body: JSON.stringify({ lessonId, status, score: score ?? null }),
  });
}

export function postXP(xp: number, level: number, atoms: number): Promise<{ success: true }> {
  return request("/user/xp", {
    method: "POST",
    body: JSON.stringify({ xp, level, atoms }),
  });
}

export function postAvatar(avatar: string): Promise<{ success: true }> {
  return request("/user/avatar", {
    method: "POST",
    body: JSON.stringify({ avatar }),
  });
}

// ---- Collectible cards (rolled and paid for on the server) ----

export function getCards(): Promise<{ owned: Record<string, number> }> {
  return request("/cards");
}

export function openPack(
  albumKey: "phenomena" | "figures",
  packId: string,
): Promise<{ cards: string[]; atoms: number }> {
  return request("/packs/open", {
    method: "POST",
    body: JSON.stringify({ albumKey, packId }),
  });
}
