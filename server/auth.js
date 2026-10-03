// Server-side sessions. On sign-in/sign-up we mint a random token, keep only
// its SHA-256 hash in the `sessions` table, and hand the raw token to the
// browser in a signed, httpOnly cookie. Every protected route derives the
// user from that cookie — the client never gets to say who it is.
import crypto from "crypto";
import db from "./db.js";

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
export function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  // Opportunistic clean-up so the table doesn't grow forever.
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    userId,
    now + SESSION_TTL_MS,
  );
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), signed: true, maxAge: SESSION_TTL_MS });
}

function sessionToken(req) {
  // cookie-parser puts `false` here when the signature doesn't match.
  const token = req.signedCookies?.[SESSION_COOKIE];
  return typeof token === "string" && token.length > 0 ? token : null;
}

/** The signed-in user's id, or null if there's no valid, unexpired session. */
export function userIdFromRequest(req) {
  const token = sessionToken(req);
  if (!token) return null;
  const row = db
    .prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?")
    .get(hashToken(token), Date.now());
  return row ? row.user_id : null;
}

/** Express middleware: 401 unless the request carries a valid session. */
export function requireUser(req, res, next) {
  try {
    const userId = userIdFromRequest(req);
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
export function destroySession(req, res) {
  const token = sessionToken(req);
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(hashToken(token));
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

/** Signs a user out everywhere (e.g. after a PIN reset or account deletion). */
export function destroyAllSessionsFor(userId) {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}
