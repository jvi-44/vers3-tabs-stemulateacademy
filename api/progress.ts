// Talks to the same Express + SQLite backend as auth.ts. See server/index.js
// for the routes and SQL_EXPLAINED.md (project root) for a walkthrough of how
// this all persists to disk.

const BASE_URL = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
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

export function getProgress(userId: number | string): Promise<{ progress: ProgressRow[] }> {
  return request(`/progress/${userId}`);
}

export function postProgress(
  userId: number | string,
  lessonId: string,
  status: "in_progress" | "completed",
  score?: number | null,
): Promise<{ success: true }> {
  return request("/progress", {
    method: "POST",
    body: JSON.stringify({ userId, lessonId, status, score: score ?? null }),
  });
}

export function postXP(
  userId: number | string,
  xp: number,
  level: number,
  atoms: number,
): Promise<{ success: true }> {
  return request("/user/xp", {
    method: "POST",
    body: JSON.stringify({ userId, xp, level, atoms }),
  });
}

export function postAvatar(
  userId: number | string,
  avatar: string,
): Promise<{ success: true }> {
  return request("/user/avatar", {
    method: "POST",
    body: JSON.stringify({ userId, avatar }),
  });
}
