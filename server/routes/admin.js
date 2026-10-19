import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { rpc } from "../db.js";
import { route } from "../route.js";
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

router.get("/stats", route(async (req, res) => {
  const s = await rpc("stem_admin_stats");
  res.json({
    users: s.users,
    activeThisWeek: s.activeThisWeek,
    activitiesCompleted: s.activitiesCompleted,
    messages: s.messages,
    groups: s.groups,
  });
}));

router.get("/users", route(async (req, res) => {
  // Newest first, with lessons completed and when each student was last active.
  const rows = await rpc("stem_admin_users");
  res.json({
    users: rows.map((r) => ({
      userId: r.user_id,
      fullName: r.full_name,
      username: r.username,
      orgName: r.org_name,
      // The centre typed for "Others (please specify)"; orgName is then "Other".
      orgOther: r.org_other,
      schoolLevelName: r.level_name,
      xp: r.xp,
      level: r.level,
      atoms: r.atoms,
      avatar: r.avatar,
      completed: r.completed,
      lastActive: r.last_active,
      createdAt: r.created_at,
    })),
  });
}));

router.get("/users/:id/progress", route(async (req, res) => {
  const user = await findUser(req, res);
  if (!user) return;
  const { progress, games } = await rpc("stem_admin_user_progress", { p_user_id: user.user_id });
  res.json({ progress, games });
}));

// ---- Admin operations on one student ----

async function findUser(req, res) {
  const id = Number(req.params.id);
  const user = Number.isSafeInteger(id) && id > 0 ? await rpc("stem_user", { p_user_id: id }) : null;
  if (!user) res.status(404).json({ error: "User not found." });
  return user;
}

const STAT_LIMITS = { xp: [0, 10_000_000], level: [1, 10_000], atoms: [0, 10_000_000] };

// Change a student's XP, level and/or atoms. Only the fields sent are changed.
router.patch("/users/:id", route(async (req, res) => {
  const user = await findUser(req, res);
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
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Nothing to change." });

  const row = await rpc("stem_admin_set_stats", {
    p_user_id: user.user_id,
    p_xp: updates.xp ?? null,
    p_level: updates.level ?? null,
    p_atoms: updates.atoms ?? null,
  });
  res.json({ success: true, user: row });
}));

// Wipe a student's lesson progress and lesson-game scores. XP, atoms, friends
// and chats are left alone.
router.post("/users/:id/reset-progress", route(async (req, res) => {
  const user = await findUser(req, res);
  if (!user) return;
  const removed = await rpc("stem_admin_reset_progress", { p_user_id: user.user_id });
  res.json({ success: true, removed });
}));

// Set a new 4-digit PIN (hashed exactly like sign-up) and sign the student out
// everywhere, so the old PIN's sessions stop working.
router.post("/users/:id/reset-pin", route(async (req, res) => {
  const user = await findUser(req, res);
  if (!user) return;
  const pin = typeof req.body?.pin === "string" ? req.body.pin : "";
  if (!PIN_REGEX.test(pin)) return res.status(400).json({ error: "PIN must be exactly 4 digits." });
  const pinHash = await bcrypt.hash(pin, 10);
  const signedOut = await rpc("stem_admin_set_pin", { p_user_id: user.user_id, p_pin_hash: pinHash });
  res.json({ success: true, signedOut });
}));

// Delete a student and everything tied to them. The admin must type the
// username back as a last check against deleting the wrong account.
router.delete("/users/:id", route(async (req, res) => {
  const user = await findUser(req, res);
  if (!user) return;
  if (String(req.body?.confirm ?? "").toLowerCase() !== user.username.toLowerCase()) {
    return res.status(400).json({ error: "Type the username exactly to confirm deleting it." });
  }
  await deleteUserCompletely(user.user_id);
  res.json({ success: true });
}));

export default router;
