// The staff page's calls (server/routes/staff.js). Centre staff sign in with
// their centre's passkey; the session is an httpOnly cookie the browser sends
// only to the API, so no token is readable by page scripts.
import { request } from "./client";
import type { AdminGameRow, AdminProgressRow, AdminUser } from "./admin";

/** The centre signed in on the staff page. */
export interface StaffCentre {
  id: number;
  name: string;
}

export const staffLogin = (centreId: number, passkey: string) =>
  request<{ centre: StaffCentre }>("/staff/login", { method: "POST", body: JSON.stringify({ centreId, passkey }) });

export const staffLogout = () => request("/staff/logout", { method: "POST" });

export const staffMe = () => request<{ centre: StaffCentre }>("/staff/me");

export const staffStudents = () => request<{ students: AdminUser[] }>("/staff/students");

export const staffStudentProgress = (userId: number) =>
  request<{ progress: AdminProgressRow[]; games: AdminGameRow[] }>(`/staff/students/${userId}/progress`);

export const staffResetPin = (userId: number, pin: string) =>
  request<{ success: true; signedOut: number }>(`/staff/students/${userId}/reset-pin`, {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
