import type { AuthUser, ReferenceData, SignupPayload } from "../types-auth";

// In dev, Vite proxies /api to the Express server (see vite.config.ts).
const BASE_URL = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    // Send/receive the httpOnly session cookie set by /login and /signup.
    credentials: "include",
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data as T;
}

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

export function signup(payload: SignupPayload): Promise<{ user: AuthUser }> {
  return request("/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** The signed-in user, from the session cookie. Rejects (401) when signed out. */
export function getUser(): Promise<{ user: AuthUser }> {
  return request("/user/me");
}

export function logout(): Promise<{ success: true }> {
  return request("/logout", { method: "POST" });
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
