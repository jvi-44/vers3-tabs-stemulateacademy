import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { rpc } from "../db.js";
import { route } from "../route.js";
import { PIN_REGEX, studentListItem } from "../users.js";
import { clientKey } from "../clientKey.js";
import {
  actorOf,
  APP_ORIGIN,
  createCentreSession,
  destroyCentreSession,
  hashToken,
  logAction,
  publicCentre,
  requireCentre,
} from "../staffAuth.js";

// The staff page: centre staff sign in with their centre's passkey (one per
// centre, shared by everyone there, set by an admin on the admin page) and
// follow that centre's students: progress, and a new PIN when one is
// forgotten. Everything else stays on the admin page.
const router = express.Router();

// Signing in only works from the Academy's own pages.
router.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && origin !== APP_ORIGIN) return res.status(403).json({ error: "Not allowed." });
  next();
});

export const PASSKEY_MIN = 10;
// bcrypt only uses the first 72 bytes.
export const PASSKEY_MAX_BYTES = 72;
// Wrong tries in 15 minutes before a centre's sign-in waits: from one address,
// and for the centre from anywhere (so guessing from many addresses is slow too).
const LOCKOUT_PER_ADDRESS = 5;
const LOCKOUT_PER_CENTRE = 30;
const SIGN_IN_ERROR = "That passkey isn't right for this centre. Ask a STEMulate admin if you don't have it.";

// Compared against when the centre has no passkey, so that takes as long as a wrong one.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-passkey", 10);

/** Why a passkey an admin typed can't be used, or null when it's fine. */
export function passkeyProblem(passkey) {
  if (typeof passkey !== "string" || passkey.length < PASSKEY_MIN) return `Use at least ${PASSKEY_MIN} characters.`;
  if (Buffer.byteLength(passkey, "utf8") > PASSKEY_MAX_BYTES) return "Use at most 72 characters.";
  if (passkey.trim() !== passkey) return "Don't start or end it with a space.";
  return null;
}

// No 0/O, 1/l/I: passkeys get read out and typed on tablets.
const PASSKEY_LETTERS = "abcdefghjkmnpqrstuvwxyz23456789";

/** A new random passkey like "kq7m-x3vd-9pna" (about 59 bits). */
export function generatePasskey() {
  const groups = [];
  for (let g = 0; g < 3; g++) {
    let part = "";
    for (let i = 0; i < 4; i++) part += PASSKEY_LETTERS[crypto.randomInt(PASSKEY_LETTERS.length)];
    groups.push(part);
  }
  return groups.join("-");
}

router.post("/login", route(async (req, res) => {
  const centreId = Number(req.body?.centreId);
  const passkey = typeof req.body?.passkey === "string" ? req.body.passkey : "";
  if (!Number.isSafeInteger(centreId) || centreId <= 0) return res.status(400).json({ error: "Pick your centre." });
  if (!passkey || Buffer.byteLength(passkey, "utf8") > 200) return res.status(401).json({ error: SIGN_IN_ERROR });

  const centre = await rpc("stem_centre_for_login", { p_org_id: centreId });
  if (!centre) return res.status(400).json({ error: "Pick your centre." });

  // The try is counted as a wrong passkey before the passkey is checked, in
  // one step per centre, so tries sent at the same moment can't all get past
  // the lockout (stem_centre_login_begin). Only a hash of the address is kept.
  const attempt = await rpc("stem_centre_login_begin", {
    p_org_id: centreId,
    p_client: hashToken(clientKey(req)),
    p_max_client: LOCKOUT_PER_ADDRESS,
    p_max_centre: LOCKOUT_PER_CENTRE,
  });
  if (attempt.locked) return res.status(429).json({ error: "Too many wrong tries. Wait 15 minutes and try again." });

  const matches = await bcrypt.compare(passkey, centre.passkey_hash ?? DUMMY_HASH);
  if (!centre.passkey_hash || !matches) return res.status(401).json({ error: SIGN_IN_ERROR });

  // Only while that passkey is still the centre's (an admin may have changed
  // it while it was being checked).
  if (!(await createCentreSession(res, centreId, centre.passkey_hash))) {
    return res.status(401).json({ error: SIGN_IN_ERROR });
  }
  await rpc("stem_centre_login_succeeded", { p_attempt_id: attempt.attempt_id });
  res.json({ centre: publicCentre(centre) });
}));

router.post("/logout", route(async (req, res) => {
  await destroyCentreSession(req, res);
  res.json({ success: true });
}));

router.use(requireCentre);

router.get("/me", (req, res) => {
  res.json({ centre: publicCentre(req.centre) });
});

// The centre's students, newest first.
router.get("/students", route(async (req, res) => {
  await logAction(actorOf(req.centre), null, "viewed the student list");
  const rows = await rpc("stem_students_for", { p_org_id: req.centre.org_id });
  res.json({ students: rows.map(studentListItem) });
}));

/** The student in the URL if they're at this centre; otherwise answers 404. */
async function studentInScope(req, res) {
  const id = Number(req.params.id);
  const ok =
    Number.isSafeInteger(id) && id > 0 &&
    (await rpc("stem_centre_can_see", { p_org_id: req.centre.org_id, p_user_id: id }));
  if (!ok) res.status(404).json({ error: "Student not found." });
  return ok ? id : null;
}

router.get("/students/:id/progress", route(async (req, res) => {
  const id = await studentInScope(req, res);
  if (!id) return;
  await logAction(actorOf(req.centre), id, "viewed progress");
  const { progress, games } = await rpc("stem_admin_user_progress", { p_user_id: id });
  res.json({ progress, games });
}));

// A forgotten PIN in class: set a new 4-digit one (hashed like sign-up) and
// sign the student out everywhere.
router.post("/students/:id/reset-pin", route(async (req, res) => {
  const id = await studentInScope(req, res);
  if (!id) return;
  const pin = typeof req.body?.pin === "string" ? req.body.pin : "";
  if (!PIN_REGEX.test(pin)) return res.status(400).json({ error: "PIN must be exactly 4 digits." });
  const pinHash = await bcrypt.hash(pin, 10);
  // The new PIN and its line in the activity log are saved together.
  const signedOut = await rpc("stem_admin_set_pin", { p_user_id: id, p_pin_hash: pinHash, p_actor: actorOf(req.centre), p_action: "reset PIN" });
  res.json({ success: true, signedOut });
}));

export default router;
