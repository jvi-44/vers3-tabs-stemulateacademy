// Sessions for staff and volunteer accounts, kept apart from students'
// (auth.js). On sign-in we mint a random token, keep only its SHA-256 hash in
// `staff_sessions`, and hand the raw token to the browser in a signed,
// httpOnly cookie sent only to the API. Centre tablets are shared with
// children, so the cookie isn't kept after the browser closes (though some
// browsers bring it back when they restore tabs), and the session always ends
// after an hour unused or 12 hours after sign-in.
import crypto from "crypto";
import { rpc } from "./db.js";

export const STAFF_COOKIE = "stem_staff";
const STAFF_SESSION_MS = 12 * 3600_000;
const STAFF_IDLE_MS = 60 * 60_000;

/** The Academy's own address (APP_ORIGIN; the Vite dev server on your own
 *  computer). The API's CORS rule, staff set-up links and the checks below use it. */
export const APP_ORIGIN = (process.env.APP_ORIGIN || "http://localhost:5173").replace(/\/+$/, "");
if (process.env.NODE_ENV === "production" && !process.env.APP_ORIGIN) {
  console.warn("[staff] APP_ORIGIN is not set: staff sign-in and set-up links won't work until it is.");
}

export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api",
  };
}

/**
 * True for requests a cookie may change things on: reads, or writes sent from
 * the Academy's own pages. Browsers send Origin with every POST, PATCH and
 * DELETE. SameSite alone isn't enough: the website (projstemulate.com) counts
 * as the same site as the Academy (academy.projstemulate.com).
 */
export function fromAppOrigin(req) {
  return ["GET", "HEAD", "OPTIONS"].includes(req.method) || req.get("origin") === APP_ORIGIN;
}

/**
 * Signs `staffId` in with the password hash that was just checked: creates the
 * session and sets the staff cookie on `res`. False (and no cookie) when that
 * password stopped being the account's meanwhile, e.g. a set-up link was used.
 */
export async function createStaffSession(res, staffId, passwordHash) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const signedIn = await rpc("stem_staff_session_create", {
    p_token: hashToken(token),
    p_staff_id: staffId,
    p_expires_at: now + STAFF_SESSION_MS,
    p_now: now,
    p_password_hash: passwordHash,
  });
  if (!signedIn) return false;
  // No maxAge: the cookie goes when the browser closes.
  res.cookie(STAFF_COOKIE, token, { ...cookieOptions(), signed: true });
  return true;
}

function sessionToken(req) {
  // cookie-parser puts `false` here when the signature doesn't match.
  const token = req.signedCookies?.[STAFF_COOKIE];
  return typeof token === "string" && token.length > 0 ? token : null;
}

/**
 * The signed-in staff account (stem_staff_json) and when it signed in (Unix
 * ms), or null. Counts as activity for the idle timeout.
 */
export async function staffSessionFromRequest(req) {
  const token = sessionToken(req);
  if (!token) return null;
  const row = await rpc("stem_staff_session_staff", {
    p_token: hashToken(token),
    p_now: Date.now(),
    p_idle_ms: STAFF_IDLE_MS,
  });
  return row ? { staff: row.staff, signedInAt: Number(row.signed_in_at) } : null;
}

/** Express middleware: 401 unless a staff account is signed in. */
export async function requireStaff(req, res, next) {
  try {
    if (!fromAppOrigin(req)) return res.status(403).json({ error: "Not allowed." });
    const session = await staffSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: "Please sign in again." });
    req.staff = session.staff;
    next();
  } catch (err) {
    next(err);
  }
}

/** A staff account (stem_staff_json) as the API sends it. */
export function publicStaff(row) {
  return {
    staffId: row.staff_id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    allCentres: row.all_centres,
    disabled: row.disabled,
    hasPassword: row.has_password,
    centres: row.centres,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

/** Who did something, for the activity log: a signed-in account (stem_staff_json)
 *  as it was when the request came in, or null for the admin passkey. */
export const actorOf = (staff) => (staff ? { id: staff.staff_id, name: staff.full_name, email: staff.email } : null);

/** Records in the activity log what `actor` (actorOf) looked at, to a student
 *  or not. Changes are recorded by their own database call (stem_log_as). */
export function logAction(actor, userId, action) {
  return rpc("stem_staff_log_action", {
    p_staff_id: actor?.id ?? null,
    p_staff_name: actor?.name ?? null,
    p_staff_email: actor?.email ?? null,
    p_user_id: userId ?? null,
    p_action: action,
  });
}

/** Clears the cookie and deletes the current staff session (if any). */
export async function destroyStaffSession(req, res) {
  // Cleared first, so this browser is signed out even if the delete fails.
  res.clearCookie(STAFF_COOKIE, cookieOptions());
  const token = sessionToken(req);
  if (token) await rpc("stem_staff_session_delete", { p_token: hashToken(token) });
}
