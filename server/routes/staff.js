import express from "express";
import bcrypt from "bcryptjs";
import { rpc } from "../db.js";
import { route } from "../route.js";
import { PIN_REGEX, studentListItem } from "../users.js";
import { actorOf, APP_ORIGIN, createStaffSession, destroyStaffSession, hashToken, logAction, publicStaff, requireStaff } from "../staffAuth.js";

// Centre staff and STEMulate volunteers: sign in with an email and their own
// password (set from a one-time link an admin gives them), then follow the
// students at their centres. Everyone sees progress; staff (not volunteers)
// can also reset a forgotten PIN. Everything else stays on the admin page.
const router = express.Router();

// Signing in and setting a password only work from the Academy's own pages.
router.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && origin !== APP_ORIGIN) return res.status(403).json({ error: "Not allowed." });
  next();
});

export const PASSWORD_MIN = 10;
// bcrypt only uses the first 72 bytes of a password.
export const PASSWORD_MAX_BYTES = 72;
// Plain addresses only (an apostrophe is fine, as in o'brien@): nothing, like
// ?bcc=, that could ride along in a mailto: link on the admin page. The
// website's forms (website/forms.js) use the same rule.
export const EMAIL_REGEX = /^[A-Za-z0-9._+'-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const EMAIL_MAX = 254;
const LOCKOUT_FAILURES = 5;
const SIGN_IN_ERROR =
  "That email and password don't match. New here? Use the set-up link your admin sent you.";

// Compared against when the email is unknown, so a wrong email takes as long
// as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

/** Why a new password can't be used, or null when it's fine. */
export function passwordProblem(password, email = "") {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    return `Use at least ${PASSWORD_MIN} characters.`;
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) return "Use at most 72 characters.";
  if (!password.trim()) return "A password can't be only spaces.";
  if (email && password.toLowerCase() === email.toLowerCase()) return "Don't use your email as your password.";
  return null;
}

const cleanEmail = (value) => (typeof value === "string" ? value.trim() : "");
const plausibleEmail = (email) => email.length <= EMAIL_MAX && EMAIL_REGEX.test(email);

router.post("/login", route(async (req, res) => {
  const email = cleanEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  // Junk is refused without being written to staff_login_attempts.
  if (!plausibleEmail(email) || !password) return res.status(401).json({ error: SIGN_IN_ERROR });

  // The try is counted as a wrong password before the password is checked,
  // in one step per email, so tries sent at the same moment can't all get
  // past the lockout (stem_staff_login_begin).
  const attempt = await rpc("stem_staff_login_begin", { p_email: email, p_max_failures: LOCKOUT_FAILURES });
  if (attempt.locked) {
    return res.status(429).json({ error: "Too many tries. Wait 15 minutes, or ask an admin for a new set-up link." });
  }

  const row = await rpc("stem_staff_for_login", { p_email: email });
  const matches = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  const ok = Boolean(row && row.password_hash && !row.staff.disabled && matches);
  if (!ok) return res.status(401).json({ error: SIGN_IN_ERROR });

  // Only while that password is still the account's (a set-up link may have
  // been used while it was being checked).
  if (!(await createStaffSession(res, row.staff.staff_id, row.password_hash))) {
    return res.status(401).json({ error: SIGN_IN_ERROR });
  }
  await rpc("stem_staff_login_succeeded", { p_attempt_id: attempt.attempt_id });
  res.json({ staff: publicStaff(row.staff) });
}));

router.post("/logout", route(async (req, res) => {
  await destroyStaffSession(req, res);
  res.json({ success: true });
}));

// The set-up link carries its token in the address after "#", which browsers
// never send to a server; the page posts it here instead.
const setupToken = (body) => (typeof body?.token === "string" && /^[0-9a-f]{64}$/.test(body.token) ? body.token : null);

// Who the link is for, so the page can greet them.
router.post("/setup/check", route(async (req, res) => {
  const token = setupToken(req.body);
  const who = token ? await rpc("stem_staff_setup_check", { p_token: hashToken(token), p_now: Date.now() }) : null;
  if (!who) return res.status(404).json({ error: "This set-up link has expired or was already used. Ask your admin for a new one." });
  res.json({ fullName: who.full_name, email: who.email });
}));

// Sets the password, uses up the link and signs them in.
router.post("/setup", route(async (req, res) => {
  const token = setupToken(req.body);
  const password = req.body?.password;
  const who = token ? await rpc("stem_staff_setup_check", { p_token: hashToken(token), p_now: Date.now() }) : null;
  if (!who) return res.status(404).json({ error: "This set-up link has expired or was already used. Ask your admin for a new one." });
  const problem = passwordProblem(password, who.email);
  if (problem) return res.status(400).json({ error: problem });

  const hash = await bcrypt.hash(password, 10);
  const staff = await rpc("stem_staff_setup_use", { p_token: hashToken(token), p_password_hash: hash, p_now: Date.now() });
  if (!staff) return res.status(404).json({ error: "This set-up link has expired or was already used. Ask your admin for a new one." });
  if (!(await createStaffSession(res, staff.staff_id, hash))) {
    return res.status(409).json({ error: "Your password changed again just now. Sign in with the newest one." });
  }
  res.json({ staff: publicStaff(staff) });
}));

router.use(requireStaff);

router.get("/me", (req, res) => {
  res.json({ staff: publicStaff(req.staff) });
});

// The students this account may see, newest first.
router.get("/students", route(async (req, res) => {
  await logAction(actorOf(req.staff), null, "viewed the student list");
  const rows = await rpc("stem_students_for", { p_staff_id: req.staff.staff_id });
  res.json({ students: rows.map(studentListItem) });
}));

/** The student in the URL if this account may see them; otherwise answers 404. */
async function studentInScope(req, res) {
  const id = Number(req.params.id);
  const ok =
    Number.isSafeInteger(id) && id > 0 &&
    (await rpc("stem_staff_can_see", { p_staff_id: req.staff.staff_id, p_user_id: id }));
  if (!ok) res.status(404).json({ error: "Student not found." });
  return ok ? id : null;
}

router.get("/students/:id/progress", route(async (req, res) => {
  const id = await studentInScope(req, res);
  if (!id) return;
  await logAction(actorOf(req.staff), id, "viewed progress");
  const { progress, games } = await rpc("stem_admin_user_progress", { p_user_id: id });
  res.json({ progress, games });
}));

// A forgotten PIN in class: set a new 4-digit one (hashed like sign-up) and
// sign the student out everywhere.
// Volunteers can't: whoever sets a PIN could sign in as the child.
router.post("/students/:id/reset-pin", route(async (req, res) => {
  if (req.staff.role === "volunteer") return res.status(403).json({ error: "Ask centre staff or an admin to reset a PIN." });
  const id = await studentInScope(req, res);
  if (!id) return;
  const pin = typeof req.body?.pin === "string" ? req.body.pin : "";
  if (!PIN_REGEX.test(pin)) return res.status(400).json({ error: "PIN must be exactly 4 digits." });
  const pinHash = await bcrypt.hash(pin, 10);
  // The new PIN and its line in the activity log are saved together.
  const signedOut = await rpc("stem_admin_set_pin", { p_user_id: id, p_pin_hash: pinHash, p_actor: actorOf(req.staff), p_action: "reset PIN" });
  res.json({ success: true, signedOut });
}));

export default router;
