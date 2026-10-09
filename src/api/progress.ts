// Talks to the same Express + SQLite backend as auth.ts. See server/index.js
// for the routes and SQL_EXPLAINED.md (project root) for a walkthrough of how
// this all persists to disk.

import { request } from "./client";

import type { AuthUser } from "../types-auth";

export interface ProgressRow {
  lesson_id: string;
  status: "not_started" | "in_progress" | "completed";
  score: number | null;
}

export function getProgress(): Promise<{ progress: ProgressRow[] }> {
  return request("/progress");
}

/** XP and atoms the server granted for a request. */
export interface Reward {
  xp: number;
  atoms: number;
}

export interface ProgressResult {
  success: true;
  awarded: Reward;
  /** The student's totals after the server applied the reward. */
  user: AuthUser;
}

/** Saves progress. The server works out (and caps) the XP/atoms itself. */
export function postProgress(
  lessonId: string,
  status: "in_progress" | "completed",
  score?: number | null,
): Promise<ProgressResult> {
  return request("/progress", {
    method: "POST",
    body: JSON.stringify({ lessonId, status, score: score ?? null }),
  });
}

/** Finished a game again from the Games tab (server caps this at 3 per game per day). */
export function replayGame(lessonId: string): Promise<ProgressResult> {
  return request("/progress", {
    method: "POST",
    body: JSON.stringify({ lessonId, replay: true }),
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

// ---- Gallery reflections (the leaderboard is in social.ts) ----

export interface Reflection {
  id: number;
  firstName: string;
  avatar: string | null;
  caption: string;
  beatTitle: string;
  createdAt: string;
}

export function getReflections(): Promise<{ reflections: Reflection[] }> {
  return request("/reflections");
}

export function postReflection(beatId: string, caption: string): Promise<{ reflection: Reflection }> {
  return request("/reflections", {
    method: "POST",
    body: JSON.stringify({ beatId, caption }),
  });
}
