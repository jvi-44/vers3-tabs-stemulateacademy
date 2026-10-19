import { rpc } from "./db.js";

export const PIN_REGEX = /^\d{4}$/;
// New usernames (sign-up and renames). Older accounts may have usernames
// outside 3–20 characters, so sign-in uses the looser check in app.js.
export const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;
export const USERNAME_RULE = "Usernames are 3–20 letters, numbers or underscores.";

export function publicUser(row) {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    username: row.username,
    schoolLevelId: row.school_level_id,
    orgId: row.org_id,
    // The centre typed for "Others (please specify)"; null for a listed centre.
    orgOther: row.org_other ?? null,
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

export function usernameTaken(username, exceptUserId) {
  return rpc("stem_username_taken", { p_username: username, p_except_user_id: exceptUserId });
}

// Removes an account and everything tied to it, sessions included. Used by
// "Delete my account" and by the admin page. Group chats the user was in stay,
// minus the user; chats left with fewer than two people are removed.
export function deleteUserCompletely(userId) {
  return rpc("stem_user_delete", { p_user_id: userId });
}
