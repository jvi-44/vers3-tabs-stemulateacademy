// Server-side sessions. On sign-in/sign-up we mint a random token, keep only
// its SHA-256 hash in the `sessions` table, and hand the raw token to the
// browser in a signed, httpOnly cookie. Every protected route derives the
// user from that cookie — the client never gets to say who it is.
import crypto from "crypto";
import { rpc } from "./db.js";

export const SESSION_COOKIE = "stem_session";
const SESSION_TTL_MS = 30 * 864e5; // 30 days

if (!process.env.SESSION_SECRET) {
  console.warn(
    "[auth] SESSION_SECRET is not set — using a random secret for this process. " +
      "Everyone will be signed out whenever the server restarts. Set SESSION_SECRET in .env / host secrets.",
  );
}

/** Secret used by cookie-parser to sign the session cookie. */
export const COOKIE_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

/** Creates a session row for `userId` and sets the session cookie on `res`. */
export async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  // Also clears out expired sessions so the table doesn't grow forever.
  await rpc("stem_session_create", {
    p_token: hashToken(token),
    p_user_id: userId,
    p_expires_at: now + SESSION_TTL_MS,
    p_now: now,
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), signed: true, maxAge: SESSION_TTL_MS });
}

function sessionToken(req) {
  // cookie-parser puts `false` here when the signature doesn't match.
  const token = req.signedCookies?.[SESSION_COOKIE];
  return typeof token === "string" && token.length > 0 ? token : null;
}

/** The stored form (SHA-256) of this browser's session token, or null. */
export function sessionHash(req) {
  const token = sessionToken(req);
  return token ? hashToken(token) : null;
}

/** The signed-in user's id, or null if there's no valid, unexpired session. */
export async function userIdFromRequest(req) {
  const token = sessionToken(req);
  if (!token) return null;
  return rpc("stem_session_user", { p_token: hashToken(token), p_now: Date.now() });
}

/** Express middleware: 401 unless the request carries a valid session. */
export async function requireUser(req, res, next) {
  try {
    const userId = await userIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Please sign in again." });
    }
    req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}

/** Deletes the current session (if any) and clears the cookie. */
export async function destroySession(req, res) {
  const token = sessionToken(req);
  if (token) await rpc("stem_session_delete", { p_token: hashToken(token) });
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}
