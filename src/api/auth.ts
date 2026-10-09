import type { AuthUser, ReferenceData, SignupPayload } from "../types-auth";
import { request } from "./client";

export function fetchReferenceData(): Promise<ReferenceData> {
  return request<ReferenceData>("/reference-data");
}

export function signup(payload: SignupPayload): Promise<{ user: AuthUser }> {
  return request("/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(username: string, pin: string): Promise<{ user: AuthUser }> {
  return request("/login", {
    method: "POST",
    body: JSON.stringify({ username, pin }),
  });
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
// The signed-in account (identified by the session cookie from login/signup)
// ---------------------------------------------------------------------------

/** The signed-in user. Rejects (401) when signed out. */
export function getMe(): Promise<{ user: AuthUser }> {
  return request("/me");
}

export function updateMe(changes: { username?: string; fullName?: string }): Promise<{ user: AuthUser }> {
  return request("/me", { method: "PATCH", body: JSON.stringify(changes) });
}

export async function deleteMe(pin: string): Promise<void> {
  await request("/me", { method: "DELETE", body: JSON.stringify({ pin }) });
}

export async function logout(): Promise<void> {
  await request("/logout", { method: "POST" }).catch(() => {});
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
