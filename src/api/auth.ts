import type { AuthUser, ReferenceData, SignupPayload } from "../types-auth";
import { request, setToken } from "./client";

export function fetchReferenceData(): Promise<ReferenceData> {
  return request<ReferenceData>("/reference-data");
}

export function createOrganisation(
  name: string,
): Promise<{ organisation: { id: number; name: string } }> {
  return request("/organisations", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

type SessionResponse = { user: AuthUser; token: string };

export async function signup(payload: SignupPayload): Promise<{ user: AuthUser }> {
  const res = await request<SessionResponse>("/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setToken(res.token);
  return res;
}

export function getUser(userId: string | number): Promise<{ user: AuthUser }> {
  return request(`/user/${userId}`);
}

export async function login(username: string, pin: string): Promise<{ user: AuthUser }> {
  const res = await request<SessionResponse>("/login", {
    method: "POST",
    body: JSON.stringify({ username, pin }),
  });
  setToken(res.token);
  return res;
}

export function verifyRecovery(
  username: string,
  recoveryColourId: number,
  recoverySubjectId: number,
): Promise<{ resetToken: string }> {
  return request("/recover/verify", {
    method: "POST",
    body: JSON.stringify({ username, recoveryColourId, recoverySubjectId }),
  });
}

export function resetPin(
  username: string,
  resetToken: string,
  newPin: string,
): Promise<{ success: true }> {
  return request("/recover/reset", {
    method: "POST",
    body: JSON.stringify({ username, resetToken, newPin }),
  });
}

// ---------------------------------------------------------------------------
// The signed-in account (needs the session token from login/signup)
// ---------------------------------------------------------------------------

export function getMe(): Promise<{ user: AuthUser }> {
  return request("/me");
}

export function updateMe(changes: { username?: string; fullName?: string }): Promise<{ user: AuthUser }> {
  return request("/me", { method: "PATCH", body: JSON.stringify(changes) });
}

export async function deleteMe(pin: string): Promise<void> {
  await request("/me", { method: "DELETE", body: JSON.stringify({ pin }) });
  setToken(null);
}

export async function logout(): Promise<void> {
  await request("/logout", { method: "POST" }).catch(() => {});
  setToken(null);
}

// Downloads everything the Academy stores about this account as a JSON file.
export async function downloadMyData(): Promise<void> {
  const data = await request<Record<string, unknown> & { profile: { username: string } }>("/me/export");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stemulate-${data.profile.username}-data.json`;
  a.click();
  URL.revokeObjectURL(url);
}
