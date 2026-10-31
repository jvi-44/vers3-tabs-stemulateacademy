// Admin page calls. The admin token comes from the passkey login. It is kept
// for this browser tab only (sessionStorage), until the admin page is locked
// or left, someone signs out on the staff page, or the tab closes; never
// alongside a student's sign-in.
import { request } from "./client";

const ADMIN_TOKEN_KEY = "stemulate_admin_token";

export function readAdminToken() {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveAdminToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // Not saved: the admin signs in again after a refresh.
  }
}

export interface AdminUser {
  userId: number;
  fullName: string;
  username: string;
  orgName: string;
  /** The centre typed for "Others (please specify)"; orgName is then "Other". */
  orgOther: string | null;
  schoolLevelName: string;
  xp: number;
  level: number;
  atoms: number;
  avatar: string | null;
  completed: number;
  /** Latest sign-in, lesson or game score, or when they joined (UTC). */
  lastActive: string | null;
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

/** A listed centre (`orgId`) or "Others" with a typed name (`orgOther`). */
export const adminSetCentre = (token: string, userId: number, centre: { orgId: number } | { orgOther: string }) =>
  request<{ success: true; orgName: string; orgOther: string | null }>(
    `/admin/users/${userId}/centre`,
    { method: "PATCH", body: JSON.stringify(centre) },
    token,
  );

/** Whether this tab's admin token still works. */
export const adminSession = (token: string) => request<{ via: "passkey" }>("/admin/session", {}, token);

// ---- Centres and their passkeys ----

export interface AdminCentre {
  id: number;
  name: string;
  hasPasskey: boolean;
  /** When its passkey was last set, or null without one. */
  passkeySetAt: string | null;
  students: number;
}

export const adminCentres = (token: string) => request<{ centres: AdminCentre[] }>("/admin/centres", {}, token);

export const adminAddCentre = (token: string, name: string) =>
  request<{ centre: AdminCentre }>("/admin/centres", { method: "POST", body: JSON.stringify({ name }) }, token);

/** Sets a centre's passkey: `passkey` as typed, or a new random one when it's
 *  left out. The answer is the only time the passkey can be seen. */
export const adminSetCentrePasskey = (token: string, centreId: number, passkey?: string) =>
  request<{ passkey: string }>(
    `/admin/centres/${centreId}/passkey`,
    { method: "POST", body: JSON.stringify(passkey ? { passkey } : {}) },
    token,
  );

/** Turns a centre's sign-in off until a new passkey is set. */
export const adminTurnOffCentrePasskey = (token: string, centreId: number) =>
  request(`/admin/centres/${centreId}/passkey`, { method: "DELETE" }, token);

/** The passkey rule the server checks (routes/staff.js passkeyProblem). */
export const PASSKEY_MIN = 10;

/** The email rule the server checks (routes/site.js EMAIL_REGEX). */
export const EMAIL_REGEX = /^[A-Za-z0-9._+'-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

// ---- Website sign-ups and the activity log ----

export interface SiteSignup {
  signupId: number;
  kind: "volunteer" | "partner" | "chapter" | "newsletter";
  name: string | null;
  email: string;
  organisation: string | null;
  school: string | null;
  phone: string | null;
  interests: string | null;
  message: string | null;
  createdAt: string;
}

export const adminSignups = (token: string) => request<{ signups: SiteSignup[] }>("/admin/signups", {}, token);

export const adminDeleteSignup = (token: string, signupId: number) =>
  request(`/admin/signups/${signupId}`, { method: "DELETE" }, token);

export interface ActivityRow {
  actionId: number;
  /** Only on rows from before centre passkeys, when staff had accounts. */
  staffId: number | null;
  /** Who did this: "Admin passkey", "<centre> passkey", or an old account's name. */
  staffName: string;
  staffEmail: string | null;
  userId: number | null;
  username: string | null;
  action: string;
  at: string;
}

/** A page of the activity log, newest first: older than `before` (an
 *  actionId) when given, and without the "viewed ..." rows when `changesOnly`. */
export const adminActivity = (token: string, { before, changesOnly }: { before?: number; changesOnly?: boolean } = {}) => {
  const q = new URLSearchParams();
  if (before) q.set("before", String(before));
  if (changesOnly) q.set("changes", "1");
  const query = q.toString();
  return request<{ activity: ActivityRow[]; hasMore: boolean }>(`/admin/activity${query ? `?${query}` : ""}`, {}, token);
};
