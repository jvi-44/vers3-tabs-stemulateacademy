import express from "express";
import bcrypt from "bcryptjs";
import db from "../db.js";
import { requireUser, destroySession, destroyAllSessionsFor } from "../auth.js";
import {
  publicUser,
  USERNAME_REGEX,
  USERNAME_RULE,
  usernameTaken,
  deleteUserCompletely,
} from "../users.js";

const NAME_MAX = 80;

const router = express.Router();
router.use(["/me", "/user/me"], requireUser);

function profileFor(userId) {
  const row = db
    .prepare(
      `SELECT u.*, o.org_name, s.level_name
         FROM users u
         JOIN organisations o ON o.org_id = u.org_id
         JOIN school_levels s ON s.level_id = u.school_level_id
        WHERE u.user_id = ?`,
    )
    .get(userId);
  if (!row) return null;
  return {
    ...publicUser(row),
    orgName: row.org_name,
    schoolLevelName: row.level_name,
    createdAt: row.created_at,
  };
}

// Who am I? Used to restore a sign-in after a page refresh.
// /user/me is the older path, kept for existing clients.
router.get(["/me", "/user/me"], (req, res) => {
  const user = profileFor(req.userId);
  if (!user) return res.status(401).json({ error: "Please sign in again." });
  res.json({ user });
});

// Change username and/or display name.
router.patch("/me", (req, res) => {
  const { username, fullName } = req.body || {};
  const current = db.prepare("SELECT * FROM users WHERE user_id = ?").get(req.userId);
  if (!current) return res.status(404).json({ error: "User not found." });

  let nextUsername = current.username;
  let nextFullName = current.full_name;

  if (username !== undefined) {
    const trimmed = typeof username === "string" ? username.trim() : "";
    if (!USERNAME_REGEX.test(trimmed)) {
      return res.status(400).json({ error: USERNAME_RULE });
    }
    if (usernameTaken(trimmed, req.userId)) {
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

  db.prepare(
    "UPDATE users SET username = ?, full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
  ).run(nextUsername, nextFullName, req.userId);
  if (nextUsername !== current.username) {
    db.prepare("UPDATE login_attempts SET username = ? WHERE username = ? COLLATE NOCASE").run(
      nextUsername,
      current.username,
    );
  }

  res.json({ user: profileFor(req.userId) });
});

// "Download my data": everything we hold about this account, as JSON.
// Supports the access obligation under Singapore's PDPA (and GDPR Art. 15/20).
router.get("/me/export", (req, res) => {
  const profile = profileFor(req.userId);
  if (!profile) return res.status(404).json({ error: "User not found." });

  const progress = db
    .prepare(
      "SELECT lesson_id, status, score, last_accessed, completed_at FROM lesson_progress WHERE user_id = ?",
    )
    .all(req.userId);
  const gameScores = db
    .prepare("SELECT game_id, best_score, plays, updated_at FROM game_scores WHERE user_id = ?")
    .all(req.userId);
  const friends = db
    .prepare(
      `SELECT u.username, f.created_at AS friends_since FROM friendships f
         JOIN users u ON u.user_id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
        WHERE f.user_a = ? OR f.user_b = ?`,
    )
    .all(req.userId, req.userId, req.userId);
  const messages = db
    .prepare(
      `SELECT c.conversation_id, COALESCE(c.name, 'Direct chat') AS chat, m.body, m.created_at
         FROM messages m JOIN conversations c ON c.conversation_id = m.conversation_id
        WHERE m.sender_id = ? ORDER BY m.message_id`,
    )
    .all(req.userId);
  const loginHistory = db
    .prepare(
      "SELECT success, attempted_at FROM login_attempts WHERE username = ? COLLATE NOCASE ORDER BY attempt_id",
    )
    .all(profile.username);
  const cards = db
    .prepare("SELECT card_id, count FROM user_cards WHERE user_id = ? AND count > 0")
    .all(req.userId);
  const reflections = db
    .prepare("SELECT beat_id, caption, created_at FROM reflections WHERE user_id = ? ORDER BY id")
    .all(req.userId);

  res.setHeader("Content-Disposition", `attachment; filename="stemulate-${profile.username}-data.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    profile,
    progress,
    gameScores,
    cards,
    reflections,
    friends,
    messagesSent: messages,
    loginHistory,
  });
});

// Permanently delete the account. Needs the PIN again so nobody can do this
// from a device that was left signed in.
router.delete("/me", async (req, res, next) => {
  try {
    await deleteMe(req, res);
  } catch (err) {
    next(err);
  }
});

async function deleteMe(req, res) {
  const { pin } = req.body || {};
  const user = db.prepare("SELECT pin_hash FROM users WHERE user_id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  if (typeof pin !== "string" || !(await bcrypt.compare(pin, user.pin_hash))) {
    return res.status(401).json({ error: "That PIN isn't right." });
  }

  deleteUserCompletely(req.userId);
  destroyAllSessionsFor(req.userId);
  destroySession(req, res);
  res.json({ success: true });
}

export default router;
