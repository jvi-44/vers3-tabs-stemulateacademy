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

export const adminUserProgress = (token: string, userId: number) =>
  request<{ progress: AdminProgressRow[] }>(`/admin/users/${userId}/progress`, {}, token);

export const adminDeleteUser = (token: string, userId: number) =>
  request(`/admin/users/${userId}`, { method: "DELETE" }, token);
