// The staff page's calls (server/routes/staff.js). Staff and volunteers sign
// in with an email and password; their session is an httpOnly cookie the
// browser sends only to the API, so no token is readable by page scripts.
import { request } from "./client";
import type { AdminGameRow, AdminProgressRow, AdminUser, StaffAccount } from "./admin";

export const staffLogin = (email: string, password: string) =>
  request<{ staff: StaffAccount }>("/staff/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const staffLogout = () => request("/staff/logout", { method: "POST" });

export const staffMe = () => request<{ staff: StaffAccount }>("/staff/me");

/** Who a one-time set-up link is for. */
export const staffSetupCheck = (token: string) =>
  request<{ fullName: string; email: string }>("/staff/setup/check", { method: "POST", body: JSON.stringify({ token }) });

/** Sets the password from a set-up link and signs in. */
export const staffSetup = (token: string, password: string) =>
  request<{ staff: StaffAccount }>("/staff/setup", { method: "POST", body: JSON.stringify({ token, password }) });

export const staffStudents = () => request<{ students: AdminUser[] }>("/staff/students");

export const staffStudentProgress = (userId: number) =>
  request<{ progress: AdminProgressRow[]; games: AdminGameRow[] }>(`/staff/students/${userId}/progress`);

export const staffResetPin = (userId: number, pin: string) =>
  request<{ success: true; signedOut: number }>(`/staff/students/${userId}/reset-pin`, {
    method: "POST",
    body: JSON.stringify({ pin }),
  });

/** The password rules the server checks (routes/staff.js passwordProblem). */
export const PASSWORD_MIN = 10;

/** The email rule the server checks (routes/staff.js EMAIL_REGEX). */
export const EMAIL_REGEX = /^[A-Za-z0-9._+'-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
