import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import db from "../db.js";
import { deleteUserCompletely, PIN_REGEX } from "../users.js";

// Admin access is a single passkey kept in the ADMIN_PASSKEY environment
// variable (see .env.example). A correct passkey returns a short-lived admin
// token that the admin page sends with every request.
const router = express.Router();

const ADMIN_TOKEN_MINUTES = 60;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const adminTokens = new Map(); // token -> expiresAt
const failedAttempts = new Map(); // ip -> { count, lockedUntil }

function passkeyMatches(given) {
  const expected = process.env.ADMIN_PASSKEY || "";
  const a = crypto.createHash("sha256").update(String(given)).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

router.post("/login", (req, res) => {
  if (!process.env.ADMIN_PASSKEY) {
    return res.status(503).json({ error: "Admin access isn't set up. Add ADMIN_PASSKEY to your .env file." });
  }
  const ip = req.ip;
  const record = failedAttempts.get(ip);
  if (record?.lockedUntil > Date.now()) {
    return res.status(429).json({ error: "Too many wrong tries. Please wait a few minutes." });
  }

  if (!passkeyMatches(req.body?.passkey || "")) {
    const count = (record?.count ?? 0) + 1;
    failedAttempts.set(ip, {
      count,
      lockedUntil: count >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MINUTES * 60 * 1000 : 0,
    });
    return res.status(401).json({ error: "That passkey isn't right." });
  }

  failedAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString("hex");
  adminTokens.set(token, Date.now() + ADMIN_TOKEN_MINUTES * 60 * 1000);
  res.json({ token, expiresInMinutes: ADMIN_TOKEN_MINUTES });
});

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expiresAt = adminTokens.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    adminTokens.delete(token);
    return res.status(401).json({ error: "Admin session expired. Enter the passkey again." });
  }
  next();
}

router.use(requireAdmin);

router.get("/stats", (req, res) => {
  const one = (sql) => db.prepare(sql).get().n;
  res.json({
    users: one("SELECT COUNT(*) AS n FROM users"),
    activeThisWeek: one(
      "SELECT COUNT(DISTINCT user_id) AS n FROM lesson_progress WHERE last_accessed >= datetime('now', '-7 days')",
    ),
    activitiesCompleted: one("SELECT COUNT(*) AS n FROM lesson_progress WHERE status = 'completed'"),
    messages: one("SELECT COUNT(*) AS n FROM messages"),
    groups: one("SELECT COUNT(*) AS n FROM conversations WHERE is_group = 1"),
  });
});

router.get("/users", (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.user_id, u.full_name, u.username, u.xp, u.level, u.atoms, u.avatar, u.created_at,
              o.org_name, s.level_name,
              (SELECT COUNT(*) FROM lesson_progress p WHERE p.user_id = u.user_id AND p.status = 'completed') AS completed,
              (SELECT MAX(attempted_at) FROM login_attempts a WHERE a.username = u.username AND a.success = 1) AS last_login
         FROM users u
         JOIN organisations o ON o.org_id = u.org_id
         JOIN school_levels s ON s.level_id = u.school_level_id
        ORDER BY u.created_at DESC`,
    )
    .all();
  res.json({
    users: rows.map((r) => ({
      userId: r.user_id,
      fullName: r.full_name,
      username: r.username,
      orgName: r.org_name,
      schoolLevelName: r.level_name,
      xp: r.xp,
      level: r.level,
      atoms: r.atoms,
      avatar: r.avatar,
      completed: r.completed,
      lastLogin: r.last_login,
      createdAt: r.created_at,
    })),
  });
});

router.get("/users/:id/progress", (req, res) => {
  const user = findUser(req, res);
  if (!user) return;
  const progress = db
    .prepare(
      `SELECT lesson_id, status, score, last_accessed, completed_at FROM lesson_progress
        WHERE user_id = ? ORDER BY last_accessed DESC`,
    )
    .all(user.user_id);
  const games = db
    .prepare("SELECT game_id, best_score, plays, updated_at FROM game_scores WHERE user_id = ? ORDER BY updated_at DESC")
    .all(user.user_id);
  res.json({ progress, games });
});

// ---- Admin operations on one student ----

function findUser(req, res) {
  const id = Number(req.params.id);
  const user = Number.isInteger(id) ? db.prepare("SELECT user_id, username FROM users WHERE user_id = ?").get(id) : null;
  if (!user) res.status(404).json({ error: "User not found." });
  return user;
}

const STAT_LIMITS = { xp: [0, 10_000_000], level: [1, 10_000], atoms: [0, 10_000_000] };

// Change a student's XP, level and/or atoms. Only the fields sent are changed.
router.patch("/users/:id", (req, res) => {
  const user = findUser(req, res);
  if (!user) return;
  const updates = {};
  for (const [field, [min, max]] of Object.entries(STAT_LIMITS)) {
    if (req.body?.[field] === undefined) continue;
    const value = Number(req.body[field]);
    if (!Number.isInteger(value) || value < min || value > max) {
      return res.status(400).json({ error: `${field.toUpperCase()} must be a whole number from ${min} to ${max}.` });
    }
    updates[field] = value;
  }
  const fields = Object.keys(updates);
  if (fields.length === 0) return res.status(400).json({ error: "Nothing to change." });

  db.prepare(
    `UPDATE users SET ${fields.map((f) => `${f} = @${f}`).join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = @userId`,
  ).run({ ...updates, userId: user.user_id });
  const row = db.prepare("SELECT xp, level, atoms FROM users WHERE user_id = ?").get(user.user_id);
  res.json({ success: true, user: row });
});

// Wipe a student's lesson progress and lesson-game scores. XP, atoms, friends
// and chats are left alone.
router.post("/users/:id/reset-progress", (req, res) => {
  const user = findUser(req, res);
  if (!user) return;
  const reset = db.transaction((userId) => ({
    lessons: db.prepare("DELETE FROM lesson_progress WHERE user_id = ?").run(userId).changes,
    games: db.prepare("DELETE FROM game_scores WHERE user_id = ?").run(userId).changes,
  }));
  res.json({ success: true, removed: reset(user.user_id) });
});

// Set a new 4-digit PIN (hashed exactly like sign-up) and sign the student out
// everywhere, so the old PIN's sessions stop working.
router.post("/users/:id/reset-pin", async (req, res, next) => {
  const user = findUser(req, res);
  if (!user) return;
  const pin = typeof req.body?.pin === "string" ? req.body.pin : "";
  if (!PIN_REGEX.test(pin)) return res.status(400).json({ error: "PIN must be exactly 4 digits." });
  let pinHash;
  try {
    pinHash = await bcrypt.hash(pin, 10);
  } catch (err) {
    return next(err);
  }
  db.prepare("UPDATE users SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(pinHash, user.user_id);
  const signedOut = db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.user_id).changes;
  res.json({ success: true, signedOut });
});

// Delete a student and everything tied to them. The admin must type the
// username back as a last check against deleting the wrong account.
router.delete("/users/:id", (req, res) => {
  const user = findUser(req, res);
  if (!user) return;
  if (String(req.body?.confirm ?? "").toLowerCase() !== user.username.toLowerCase()) {
    return res.status(400).json({ error: "Type the username exactly to confirm deleting it." });
  }
  deleteUserCompletely(user.user_id);
  res.json({ success: true });
});

export default router;
