import crypto from "crypto";
import db from "./db.js";

// Sign-ins last 30 days. The browser keeps the raw token; the database only
// keeps its SHA-256 hash.
const SESSION_DAYS = 30;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    userId,
    expiresAt,
  );
  return token;
}

export function destroySession(token) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

function bearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

// Express middleware: sets req.userId, or answers 401.
export function requireAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: "Please sign in again." });

  const row = db
    .prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?")
    .get(hashToken(token));
  if (!row || new Date(row.expires_at) < new Date()) {
    if (row) destroySession(token);
    return res.status(401).json({ error: "Your sign-in has expired. Please sign in again." });
  }

  req.userId = row.user_id;
  req.sessionToken = token;
  next();
}
