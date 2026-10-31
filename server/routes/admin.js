import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { rpc } from "../db.js";
import { route } from "../route.js";
import { deleteUserCompletely, PIN_REGEX, studentListItem } from "../users.js";
import { logAction } from "../staffAuth.js";
import { clientKey } from "../clientKey.js";
import { generatePasskey, passkeyProblem } from "./staff.js";

// Admin access is the passkey kept in the ADMIN_PASSKEY environment variable
// (see .env.example). A correct passkey returns a short-lived admin token that
// the admin page sends with every request.
const router = express.Router();

const ADMIN_TOKEN_MINUTES = 60;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const adminTokens = new Map(); // token -> expiresAt
const failedAttempts = new Map(); // address (clientKey) -> { count, lockedUntil }

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
  const ip = clientKey(req);
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
  if (expiresAt && expiresAt >= Date.now()) return next();
  adminTokens.delete(token);
  res.status(401).json({ error: "Admin session expired. Enter the passkey again." });
}

/** Who to name in the activity log: null, the admin passkey (stem_staff_log_action). */
const actor = () => null;

router.use(requireAdmin);

// Whether this tab's admin token still works.
router.get("/session", (req, res) => {
  res.json({ via: "passkey" });
});

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
  await logAction(actor(req), null, "viewed the student list");
  const rows = await rpc("stem_admin_users");
  res.json({ users: rows.map(studentListItem) });
}));

router.get("/users/:id/progress", route(async (req, res) => {
  const user = await findUser(req, res);
  if (!user) return;
  await logAction(actor(req), user.user_id, "viewed progress");
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
const NAME_MAX = 80;

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

  // Each change to a student is saved with its line in the activity log.
  const row = await rpc("stem_admin_set_stats", {
    p_user_id: user.user_id,
    p_xp: updates.xp ?? null,
    p_level: updates.level ?? null,
    p_atoms: updates.atoms ?? null,
    p_actor: actor(req),
    p_action: "changed XP, level or atoms",
  });
  res.json({ success: true, user: row });
}));

// Wipe a student's lesson progress and lesson-game scores. XP, atoms, friends
// and chats are left alone.
router.post("/users/:id/reset-progress", route(async (req, res) => {
  const user = await findUser(req, res);
  if (!user) return;
  const removed = await rpc("stem_admin_reset_progress", { p_user_id: user.user_id, p_actor: actor(req), p_action: "reset progress" });
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
  const signedOut = await rpc("stem_admin_set_pin", { p_user_id: user.user_id, p_pin_hash: pinHash, p_actor: actor(req), p_action: "reset PIN" });
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
  await deleteUserCompletely(user.user_id, { actor: actor(req), action: "deleted a student" });
  res.json({ success: true });
}));

// Moves a student to another centre (a listed one, or "Others" with a name),
// e.g. after a wrong pick at sign-up. Staff see students by centre.
router.patch("/users/:id/centre", route(async (req, res) => {
  const user = await findUser(req, res);
  if (!user) return;
  const other = typeof req.body?.orgOther === "string" ? req.body.orgOther.trim() : "";
  const orgId = Number(req.body?.orgId);
  if (other.length > NAME_MAX) return res.status(400).json({ error: `Keep the centre's name under ${NAME_MAX} characters.` });
  if (!other && !(Number.isSafeInteger(orgId) && orgId > 0)) return res.status(400).json({ error: "Pick a centre." });
  const result = await rpc("stem_admin_set_centre", {
    p_user_id: user.user_id,
    p_org_id: other ? null : orgId,
    p_org_other: other || null,
    p_actor: actor(req),
    p_action: "changed the centre",
  });
  if (!result) return res.status(404).json({ error: "User not found." });
  if (result.error) return res.status(400).json({ error: "Pick a centre from the list." });
  res.json({ success: true, orgName: result.org_name, orgOther: result.org_other });
}));

// The activity log, newest first, a page at a time: ?before=<actionId> for
// the next page, ?changes=1 to leave out the "viewed ..." rows.
const ACTIVITY_PAGE = 100;
router.get("/activity", route(async (req, res) => {
  const before = Number(req.query.before);
  const rows = await rpc("stem_staff_actions", {
    p_limit: ACTIVITY_PAGE + 1,
    p_before: Number.isSafeInteger(before) && before > 0 ? before : null,
    p_changes_only: req.query.changes === "1",
  });
  res.json({
    activity: rows.slice(0, ACTIVITY_PAGE).map((r) => ({
      actionId: r.action_id,
      staffId: r.staff_id,
      staffName: r.staff_name,
      staffEmail: r.staff_email,
      userId: r.user_id,
      username: r.username,
      action: r.action,
      at: r.at,
    })),
    hasMore: rows.length > ACTIVITY_PAGE,
  });
}));

// ---- Centres and their passkeys ----

const CENTRE_NAME_MAX = 80;

router.get("/centres", route(async (req, res) => {
  const rows = await rpc("stem_centres");
  res.json({
    centres: rows.map((r) => ({
      id: r.org_id,
      name: r.org_name,
      hasPasskey: r.has_passkey,
      passkeySetAt: r.passkey_set_at,
      students: r.students,
    })),
  });
}));

// Adds a centre to the list students pick from at sign-up.
router.post("/centres", route(async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > CENTRE_NAME_MAX) return res.status(400).json({ error: `Give a name of 1 to ${CENTRE_NAME_MAX} characters.` });
  const result = await rpc("stem_centre_add", { p_name: name, p_actor: actor(req) });
  if (result.error) return res.status(400).json({ error: "That centre is already on the list." });
  res.json({ centre: { id: result.org_id, name, hasPasskey: false, passkeySetAt: null, students: 0 } });
}));

/** The centre id in the URL, or null after answering 404. */
function centreId(req, res) {
  const id = Number(req.params.id);
  if (Number.isSafeInteger(id) && id > 0) return id;
  res.status(404).json({ error: "Centre not found." });
  return null;
}

// Sets a centre's passkey: the one typed, or a new random one. It's only ever
// shown in this answer (the database keeps a hash), and everyone signed in
// with the old one is signed out.
router.post("/centres/:id/passkey", route(async (req, res) => {
  const id = centreId(req, res);
  if (!id) return;
  const typed = req.body?.passkey;
  if (typed !== undefined && typed !== null && typed !== "") {
    const problem = passkeyProblem(typed);
    if (problem) return res.status(400).json({ error: problem });
  }
  const passkey = typed ? typed : generatePasskey();
  const hash = await bcrypt.hash(passkey, 10);
  const ok = await rpc("stem_centre_set_passkey", { p_org_id: id, p_passkey_hash: hash, p_actor: actor(req) });
  if (!ok) return res.status(404).json({ error: "Centre not found." });
  res.json({ passkey });
}));

// Turns a centre's sign-in off (and signs everyone out) until a new passkey is set.
router.delete("/centres/:id/passkey", route(async (req, res) => {
  const id = centreId(req, res);
  if (!id) return;
  const ok = await rpc("stem_centre_set_passkey", { p_org_id: id, p_passkey_hash: null, p_actor: actor(req) });
  if (!ok) return res.status(404).json({ error: "Centre not found." });
  res.json({ success: true });
}));

// ---- Sign-ups from the website's forms ----

router.get("/signups", route(async (req, res) => {
  const rows = await rpc("stem_site_signups");
  res.json({
    signups: rows.map((r) => ({
      signupId: r.signup_id,
      kind: r.kind,
      name: r.name,
      email: r.email,
      organisation: r.organisation,
      school: r.school,
      phone: r.phone,
      interests: r.interests,
      message: r.message,
      createdAt: r.created_at,
    })),
  });
}));

router.delete("/signups/:id", route(async (req, res) => {
  const id = Number(req.params.id);
  const gone = Number.isSafeInteger(id) && id > 0 && (await rpc("stem_site_signup_delete", { p_signup_id: id, p_actor: actor(req) }));
  if (!gone) return res.status(404).json({ error: "Sign-up not found." });
  res.json({ success: true });
}));

export default router;
