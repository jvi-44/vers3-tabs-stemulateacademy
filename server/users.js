import db from "./db.js";

export const PIN_REGEX = /^\d{4}$/;
export const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;

export function publicUser(row) {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    username: row.username,
    schoolLevelId: row.school_level_id,
    orgId: row.org_id,
    xp: row.xp,
    level: row.level,
    atoms: row.atoms,
    avatar: row.avatar,
  };
}

// What other students can see about an account: never the full name or
// organisation, only the username and avatar they chose.
export function otherUser(row) {
  return { userId: row.user_id, username: row.username, avatar: row.avatar, level: row.level };
}

export function usernameTaken(username, exceptUserId = 0) {
  return !!db
    .prepare("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE AND user_id != ?")
    .get(username, exceptUserId);
}

// Removes an account and everything tied to it. Used by "Delete my account"
// and by the admin page. Group chats the user was in stay, minus the user;
// chats left with fewer than two people are removed.
export const deleteUserCompletely = db.transaction((userId) => {
  const user = db.prepare("SELECT username FROM users WHERE user_id = ?").get(userId);
  if (!user) return false;

  db.prepare("DELETE FROM messages WHERE sender_id = ?").run(userId);
  db.prepare("DELETE FROM conversation_members WHERE user_id = ?").run(userId);
  db.prepare(
    `DELETE FROM conversations WHERE conversation_id IN (
       SELECT c.conversation_id FROM conversations c
       LEFT JOIN conversation_members m ON m.conversation_id = c.conversation_id
       GROUP BY c.conversation_id
       HAVING COUNT(m.user_id) < 2 AND (c.is_group = 0 OR COUNT(m.user_id) = 0)
     )`,
  ).run();
  db.prepare("DELETE FROM friend_requests WHERE from_user_id = ? OR to_user_id = ?").run(userId, userId);
  db.prepare("DELETE FROM friendships WHERE user_a = ? OR user_b = ?").run(userId, userId);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM lesson_progress WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM login_attempts WHERE username = ?").run(user.username);
  db.prepare("UPDATE conversations SET created_by = NULL WHERE created_by = ?").run(userId);
  db.prepare("DELETE FROM users WHERE user_id = ?").run(userId);
  return true;
});
