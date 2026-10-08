import express from "express";
import crypto from "crypto";
import db from "../db.js";
import { deleteUserCompletely } from "../users.js";

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
  const progress = db
    .prepare(
      `SELECT lesson_id, status, score, last_accessed, completed_at FROM lesson_progress
        WHERE user_id = ? ORDER BY last_accessed DESC`,
    )
    .all(req.params.id);
  res.json({ progress });
});

router.delete("/users/:id", (req, res) => {
  const ok = deleteUserCompletely(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: "User not found." });
  res.json({ success: true });
});

export default router;
