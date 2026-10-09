// Shared fetch helper for every call to the Express backend. In dev, Vite
// proxies /api to the server (see vite.config.ts).
//
// A student's sign-in is an httpOnly session cookie set by /login and /signup,
// so no token is ever readable by page scripts. Only the admin page passes a
// bearer token (its short-lived passkey token).
const BASE_URL = "/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function request<T>(path: string, options: RequestInit = {}, bearer?: string | null): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || "Something went wrong. Please try again.", res.status);
  }
  return data as T;
}
