// Sessions for the staff page, kept apart from students' (auth.js). Centre
// staff sign in with their centre's passkey (routes/staff.js); on sign-in we
// mint a random token, keep only its SHA-256 hash in `centre_sessions`, and
// hand the raw token to the browser in a signed, httpOnly cookie sent only to
// the API. Centre tablets are shared with children, so the cookie isn't kept
// after the browser closes (though some browsers bring it back when they
// restore tabs), and the session always ends after an hour unused or 12 hours
// after sign-in. A new passkey for the centre ends it at once.
import crypto from "crypto";
import { rpc } from "./db.js";

export const STAFF_COOKIE = "stem_staff";
const STAFF_SESSION_MS = 12 * 3600_000;
const STAFF_IDLE_MS = 60 * 60_000;

/** The Academy's own address (APP_ORIGIN; the Vite dev server on your own
 *  computer). The API's CORS rule and the checks below use it. */
export const APP_ORIGIN = (process.env.APP_ORIGIN || "http://localhost:5173").replace(/\/+$/, "");
if (process.env.NODE_ENV === "production" && !process.env.APP_ORIGIN) {
  console.warn("[staff] APP_ORIGIN is not set: staff sign-in won't work until it is.");
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
 * Signs centre `orgId` in with the passkey hash that was just checked: creates
 * the session and sets the staff cookie on `res`. False (and no cookie) when
 * that passkey stopped being the centre's meanwhile (an admin changed it).
 */
export async function createCentreSession(res, orgId, passkeyHash) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const signedIn = await rpc("stem_centre_session_create", {
    p_token: hashToken(token),
    p_org_id: orgId,
    p_passkey_hash: passkeyHash,
    p_expires_at: now + STAFF_SESSION_MS,
    p_now: now,
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

/** The signed-in centre ({org_id, org_name}), or null. Counts as activity for the idle timeout. */
export async function centreFromRequest(req) {
  const token = sessionToken(req);
  if (!token) return null;
  const row = await rpc("stem_centre_session", {
    p_token: hashToken(token),
    p_now: Date.now(),
    p_idle_ms: STAFF_IDLE_MS,
  });
  return row ? row.centre : null;
}

/** Express middleware: 401 unless a centre is signed in; puts it on req.centre. */
export async function requireCentre(req, res, next) {
  try {
    if (!fromAppOrigin(req)) return res.status(403).json({ error: "Not allowed." });
    const centre = await centreFromRequest(req);
    if (!centre) return res.status(401).json({ error: "Please sign in again." });
    req.centre = centre;
    next();
  } catch (err) {
    next(err);
  }
}

/** A signed-in centre as the API sends it. */
export const publicCentre = (centre) => ({ id: centre.org_id, name: centre.org_name });

/** Who did something, for the activity log: the signed-in centre's passkey, or
 *  null for the admin passkey. */
export const actorOf = (centre) => (centre ? { name: `${centre.org_name} passkey` } : null);

/** Records in the activity log what `actor` (actorOf) looked at, to a student
 *  or not. Changes are recorded by their own database call (stem_log_as). */
export function logAction(actor, userId, action) {
  return rpc("stem_staff_log_action", {
    p_staff_id: null,
    p_staff_name: actor?.name ?? null,
    p_staff_email: null,
    p_user_id: userId ?? null,
    p_action: action,
  });
}

/** Clears the cookie and deletes the current staff session (if any). */
export async function destroyCentreSession(req, res) {
  // Cleared first, so this browser is signed out even if the delete fails.
  res.clearCookie(STAFF_COOKIE, cookieOptions());
  const token = sessionToken(req);
  if (token) await rpc("stem_centre_session_delete", { p_token: hashToken(token) });
}
