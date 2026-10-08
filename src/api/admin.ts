// Admin page calls. The admin token comes from the passkey login and is kept
// only in memory (sessionStorage), never alongside a student's sign-in.
import { request } from "./client";

export interface AdminUser {
  userId: number;
  fullName: string;
  username: string;
  orgName: string;
  schoolLevelName: string;
  xp: number;
  level: number;
  atoms: number;
  avatar: string | null;
  completed: number;
  lastLogin: string | null;
  createdAt: string;
}

export interface AdminStats {
  users: number;
  activeThisWeek: number;
  activitiesCompleted: number;
  messages: number;
  groups: number;
}

export interface AdminProgressRow {
  lesson_id: string;
  status: string;
  score: number | null;
  last_accessed: string;
  completed_at: string | null;
}

export const adminLogin = (passkey: string) =>
  request<{ token: string }>("/admin/login", { method: "POST", body: JSON.stringify({ passkey }) }, null);

export const adminStats = (token: string) => request<AdminStats>("/admin/stats", {}, token);

export const adminUsers = (token: string) => request<{ users: AdminUser[] }>("/admin/users", {}, token);

export interface AdminGameRow {
  game_id: string;
  best_score: number;
  plays: number;
  updated_at: string;
}

export const adminUserProgress = (token: string, userId: number) =>
  request<{ progress: AdminProgressRow[]; games?: AdminGameRow[] }>(`/admin/users/${userId}/progress`, {}, token);

export type AdminStatsPatch = Partial<Pick<AdminUser, "xp" | "level" | "atoms">>;

export const adminUpdateUser = (token: string, userId: number, patch: AdminStatsPatch) =>
  request<{ success: true; user: { xp: number; level: number; atoms: number } }>(
    `/admin/users/${userId}`,
    { method: "PATCH", body: JSON.stringify(patch) },
    token,
  );

export const adminResetProgress = (token: string, userId: number) =>
  request<{ success: true; removed: { lessons: number; games: number } }>(
    `/admin/users/${userId}/reset-progress`,
    { method: "POST" },
    token,
  );

export const adminResetPin = (token: string, userId: number, pin: string) =>
  request<{ success: true; signedOut: number }>(
    `/admin/users/${userId}/reset-pin`,
    { method: "POST", body: JSON.stringify({ pin }) },
    token,
  );

// `confirm` must be the account's username, typed by the admin.
export const adminDeleteUser = (token: string, userId: number, confirm: string) =>
  request(`/admin/users/${userId}`, { method: "DELETE", body: JSON.stringify({ confirm }) }, token);
