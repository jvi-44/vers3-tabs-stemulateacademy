import express from "express";
import bcrypt from "bcryptjs";
import { rpc } from "../db.js";
import { route } from "../route.js";
import { oneTryAtATime } from "../oneTryAtATime.js";
import { requireUser, destroySession, sessionHash } from "../auth.js";
import {
  publicUser,
  PIN_REGEX,
  USERNAME_REGEX,
  USERNAME_RULE,
  usernameTaken,
  deleteUserCompletely,
} from "../users.js";

const NAME_MAX = 80;
const LOCKOUT_FAILURES = 5;

const router = express.Router();
router.use(["/me", "/user/me"], requireUser);

async function profileFor(userId) {
  const row = await rpc("stem_user_profile", { p_user_id: userId });
  if (!row) return null;
  return {
    ...publicUser(row.user),
    orgName: row.org_name,
    schoolLevelName: row.level_name,
    createdAt: row.user.created_at,
  };
}

// Who am I? Used to restore a sign-in after a page refresh.
// /user/me is the older path, kept for existing clients.
router.get(["/me", "/user/me"], route(async (req, res) => {
  const user = await profileFor(req.userId);
  if (!user) return res.status(401).json({ error: "Please sign in again." });
  res.json({ user });
}));

// Change username, display name and/or school level. The centre is changed by
// an admin, not here.
router.patch("/me", route(async (req, res) => {
  const { username, fullName, schoolLevelId } = req.body || {};
  const current = await rpc("stem_user", { p_user_id: req.userId });
  if (!current) return res.status(404).json({ error: "User not found." });

  // Checked first, so a bad level leaves the name and username unchanged too.
  if (schoolLevelId !== undefined) {
    const levelId = Number(schoolLevelId);
    const moved =
      Number.isSafeInteger(levelId) && levelId > 0 &&
      (await rpc("stem_user_set_level", { p_user_id: req.userId, p_level_id: levelId }));
    if (!moved) return res.status(400).json({ error: "Please pick your school level." });
  }

  let nextUsername = current.username;
  let nextFullName = current.full_name;

  if (username !== undefined) {
    const trimmed = typeof username === "string" ? username.trim() : "";
    if (!USERNAME_REGEX.test(trimmed)) {
      return res.status(400).json({ error: USERNAME_RULE });
    }
    if (await usernameTaken(trimmed, req.userId)) {
      return res.status(409).json({ error: "That username is already taken." });
    }
    nextUsername = trimmed;
  }

  if (fullName !== undefined) {
    const trimmed = typeof fullName === "string" ? fullName.trim() : "";
    if (!trimmed || trimmed.length > NAME_MAX) {
      return res.status(400).json({ error: `Please enter a name (up to ${NAME_MAX} characters).` });
    }
    nextFullName = trimmed;
  }

  // Failed sign-in tries move to the new username too, so a rename can't reset the lockout.
  const renamed = await rpc("stem_user_rename", {
    p_user_id: req.userId,
    p_username: nextUsername,
    p_full_name: nextFullName,
  });
  if (renamed.error) return res.status(409).json({ error: "That username is already taken." });

  res.json({ user: await profileFor(req.userId) });
}));

// Change the PIN while signed in. Needs the current PIN; wrong tries count
// toward the same 5-in-15-minutes lockout as sign-in. Every other device is
// signed out; this one stays signed in.
router.post("/me/pin", route(async (req, res) => {
  const { currentPin, newPin } = req.body || {};
  if (typeof currentPin !== "string" || typeof newPin !== "string" || !PIN_REGEX.test(newPin)) {
    return res.status(400).json({ error: "Your new PIN must be exactly 4 digits." });
  }

  const current = await rpc("stem_user", { p_user_id: req.userId });
  const pinHash = await rpc("stem_user_pin_hash", { p_user_id: req.userId });
  if (!current || !pinHash) return res.status(404).json({ error: "User not found." });

  // One try at a time per username, shared with sign-in (see oneTryAtATime.js).
  await oneTryAtATime(current.username, async () => {
    if ((await rpc("stem_recent_failures", { p_username: current.username })) >= LOCKOUT_FAILURES) {
      return res.status(429).json({ error: "Too many tries — ask your teacher or wait 15 minutes" });
    }
    if (!PIN_REGEX.test(currentPin) || !(await bcrypt.compare(currentPin, pinHash))) {
      await rpc("stem_log_attempt", { p_username: current.username, p_success: false });
      return res.status(401).json({ error: "That PIN isn't right." });
    }

    const signedOut = await rpc("stem_user_change_pin", {
      p_user_id: req.userId,
      p_pin_hash: await bcrypt.hash(newPin, 10),
      p_keep_token: sessionHash(req),
    });
    res.json({ success: true, otherDevicesSignedOut: signedOut });
  });
}));

// "Download my data": everything we hold about this account, as JSON.
// Supports the access obligation under Singapore's PDPA (and GDPR Art. 15/20).
router.get("/me/export", route(async (req, res) => {
  const profile = await profileFor(req.userId);
  if (!profile) return res.status(404).json({ error: "User not found." });

  const data = await rpc("stem_user_export", { p_user_id: req.userId });

  res.setHeader("Content-Disposition", `attachment; filename="stemulate-${profile.username}-data.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    profile,
    progress: data.progress,
    gameScores: data.gameScores,
    cards: data.cards,
    reflections: data.reflections,
    storyChoices: data.storyChoices,
    friends: data.friends,
    messagesSent: data.messagesSent,
    loginHistory: data.loginHistory,
  });
}));

// Permanently delete the account. Needs the PIN again so nobody can do this
// from a device that was left signed in.
router.delete("/me", route(async (req, res) => {
  const { pin } = req.body || {};
  const pinHash = await rpc("stem_user_pin_hash", { p_user_id: req.userId });
  if (!pinHash) return res.status(404).json({ error: "User not found." });
  if (typeof pin !== "string" || !(await bcrypt.compare(pin, pinHash))) {
    return res.status(401).json({ error: "That PIN isn't right." });
  }

  // Removes every session too, so all devices are signed out.
  await deleteUserCompletely(req.userId);
  await destroySession(req, res);
  res.json({ success: true });
}));

export default router;
