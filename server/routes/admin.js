import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { rpc } from "../db.js";
import { route } from "../route.js";
import { deleteUserCompletely, PIN_REGEX, studentListItem } from "../users.js";
import { actorOf, APP_ORIGIN, fromAppOrigin, hashToken, logAction, publicStaff, staffSessionFromRequest } from "../staffAuth.js";
import { clientKey } from "../clientKey.js";
import { EMAIL_REGEX } from "./staff.js";

// Admin access is either the passkey kept in the ADMIN_PASSKEY environment
// variable (see .env.example) or a signed-in staff account with the "admin"
// role (routes/staff.js). A correct passkey returns a short-lived admin token
// that the admin page sends with every request; an admin account's own
// session cookie works the same way for an hour after signing in.
const router = express.Router();

const ADMIN_TOKEN_MINUTES = 60;
// An admin account's cookie opens the admin page this long after sign-in.
const ADMIN_COOKIE_MINUTES = 60;
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

async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expiresAt = adminTokens.get(token);
  if (expiresAt && expiresAt >= Date.now()) return next();
  adminTokens.delete(token);
  try {
    if (!fromAppOrigin(req)) return res.status(403).json({ error: "Not allowed." });
    const session = await staffSessionFromRequest(req);
    if (session?.staff.role === "admin" && Date.now() - session.signedInAt < ADMIN_COOKIE_MINUTES * 60_000) {
      req.staff = session.staff;
      return next();
    }
  } catch (err) {
    return next(err);
  }
  res.status(401).json({ error: "Admin session expired. Enter the passkey, or sign in to your admin account again." });
}

/** Who to name in the activity log: the admin account, or null for the passkey. */
const actor = (req) => actorOf(req.staff);

router.use(requireAdmin);

// How this admin is signed in: with the passkey, or as an admin account.
router.get("/session", (req, res) => {
  res.json(req.staff ? { via: "staff", fullName: req.staff.full_name } : { via: "passkey" });
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

// ---- Staff and volunteer accounts ----

const ROLES = ["admin", "staff", "volunteer"];
const SETUP_LINK_DAYS = 7;

/** A new one-time set-up link for an account, or null if it doesn't exist.
 *  With `by` (actorOf, null for the passkey) it goes in the activity log. */
async function setupLink(staffId, by) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + SETUP_LINK_DAYS * 864e5;
  const staff = await rpc("stem_staff_setup_create", {
    p_staff_id: staffId,
    p_token: hashToken(token),
    p_expires_at: expiresAt,
    p_now: now,
    p_actor: by ?? null,
    p_log: by !== undefined,
  });
  if (!staff) return null;
  // The token goes after "#", which browsers never send to a server.
  return { url: `${APP_ORIGIN}/#/staff/setup?t=${token}`, expiresAt: new Date(expiresAt).toISOString() };
}

/** Checks the account fields sent; `partial` allows leaving any of them out. */
function staffFields(body, partial) {
  const out = {};
  const has = (k) => body?.[k] !== undefined;
  if (!partial || has("fullName")) {
    const name = typeof body?.fullName === "string" ? body.fullName.trim() : "";
    if (!name || name.length > NAME_MAX) return { error: `Give a name of 1 to ${NAME_MAX} characters.` };
    // The activity log names the passkey this way.
    if (name.toLowerCase() === "admin passkey") return { error: "Use the person's own name." };
    out.fullName = name;
  }
  if (!partial || has("email")) {
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    if (email.length > 254 || !EMAIL_REGEX.test(email)) return { error: "Give a valid email address." };
    out.email = email;
  }
  if (!partial || has("role")) {
    if (!ROLES.includes(body?.role)) return { error: "Role must be admin, staff or volunteer." };
    out.role = body.role;
  }
  if (!partial || has("allCentres")) {
    if (typeof (body?.allCentres ?? false) !== "boolean") return { error: "allCentres must be true or false." };
    out.allCentres = body?.allCentres ?? false;
  }
  if (!partial || has("centreIds")) {
    const ids = body?.centreIds ?? [];
    if (!Array.isArray(ids) || ids.length > 50 || !ids.every((id) => Number.isSafeInteger(id) && id > 0)) {
      return { error: "centreIds must be a list of centre ids." };
    }
    out.centreIds = ids;
  }
  if (partial && has("disabled")) {
    if (typeof body.disabled !== "boolean") return { error: "disabled must be true or false." };
    out.disabled = body.disabled;
  }
  return { fields: out };
}

// Volunteers follow the centres they help at, never every centre (also a
// rule on the staff table, so two changes at once can't get round it).
const VOLUNTEER_ALL_CENTRES = "Volunteers follow the centres they help at. Pick those centres instead of all of them.";
const STAFF_ERRORS = {
  taken: "Someone already has an account with that email.",
  centre: "Pick centres from the list.",
  volunteer: VOLUNTEER_ALL_CENTRES,
};

router.get("/staff", route(async (req, res) => {
  const rows = await rpc("stem_staff_list");
  res.json({ staff: rows.map(publicStaff) });
}));

// Adds an account and returns its first set-up link.
router.post("/staff", route(async (req, res) => {
  const { fields, error } = staffFields(req.body, false);
  if (error) return res.status(400).json({ error });
  if (fields.role === "volunteer" && fields.allCentres) return res.status(400).json({ error: VOLUNTEER_ALL_CENTRES });
  const result = await rpc("stem_staff_create", {
    p_full_name: fields.fullName,
    p_email: fields.email,
    p_role: fields.role,
    p_all_centres: fields.allCentres,
    p_org_ids: fields.centreIds,
    p_actor: actor(req),
  });
  if (result.error) return res.status(400).json({ error: STAFF_ERRORS[result.error] ?? "Couldn't add that account." });
  const link = await setupLink(result.staff.staff_id);
  // Deleted again straight away (another admin, at the same moment).
  if (!link) return res.status(404).json({ error: "Account not found." });
  res.json({ staff: publicStaff(result.staff), setupLink: link });
}));

/** The account in the URL, or answers 404. */
async function staffRow(req, res) {
  const id = Number(req.params.id);
  const row = Number.isSafeInteger(id) && id > 0 ? (await rpc("stem_staff_list")).find((s) => s.staff_id === id) : null;
  if (!row) res.status(404).json({ error: "Account not found." });
  return row ?? null;
}

/** True (after answering 400) when an admin account tries to lock itself out. */
function lockingSelfOut(req, res, id, fields) {
  const self = req.staff?.staff_id === id;
  if (self && (fields === null || fields.disabled === true || (fields.role && fields.role !== "admin"))) {
    res.status(400).json({ error: "You can't remove your own admin access. Ask another admin, or use the passkey." });
    return true;
  }
  return false;
}

router.patch("/staff/:id", route(async (req, res) => {
  const row = await staffRow(req, res);
  if (!row) return;
  const id = row.staff_id;
  const { fields, error } = staffFields(req.body, true);
  if (error) return res.status(400).json({ error });
  if (Object.keys(fields).length === 0) return res.status(400).json({ error: "Nothing to change." });
  if (lockingSelfOut(req, res, id, fields)) return;
  if ((fields.role ?? row.role) === "volunteer" && (fields.allCentres ?? row.all_centres)) {
    return res.status(400).json({ error: VOLUNTEER_ALL_CENTRES });
  }
  const result = await rpc("stem_staff_update", {
    p_staff_id: id,
    p_full_name: fields.fullName,
    p_email: fields.email,
    p_role: fields.role,
    p_all_centres: fields.allCentres,
    p_disabled: fields.disabled,
    p_org_ids: fields.centreIds,
    // Each thing that changes gets its line in the activity log, in the same step.
    p_actor: actor(req),
  });
  if (!result) return res.status(404).json({ error: "Account not found." });
  if (result.error) return res.status(400).json({ error: STAFF_ERRORS[result.error] ?? "Couldn't change that account." });
  // A new email voids the account's set-up link (stem_staff_update).
  res.json({ staff: publicStaff(result.staff), linkVoided: result.link_voided === true });
}));

// A fresh one-time link (the old one stops working), e.g. for a forgotten password.
router.post("/staff/:id/setup-link", route(async (req, res) => {
  const row = await staffRow(req, res);
  if (!row) return;
  // Whoever uses a set-up link chooses the account's password, so each one is recorded.
  const link = await setupLink(row.staff_id, actor(req));
  if (!link) return res.status(404).json({ error: "Account not found." });
  res.json({ setupLink: link });
}));

router.delete("/staff/:id", route(async (req, res) => {
  const row = await staffRow(req, res);
  if (!row) return;
  const id = row.staff_id;
  if (lockingSelfOut(req, res, id, null)) return;
  await rpc("stem_staff_delete", { p_staff_id: id, p_actor: actor(req) });
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
