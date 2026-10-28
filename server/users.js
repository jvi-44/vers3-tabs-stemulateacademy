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

// A row of stem_students_for(), as the admin and staff pages list students.
export function studentListItem(r) {
  return {
    userId: r.user_id,
    fullName: r.full_name,
    username: r.username,
    orgName: r.org_name,
    // The centre typed for "Others (please specify)"; orgName is then "Other".
    orgOther: r.org_other,
    schoolLevelName: r.level_name,
    xp: r.xp,
    level: r.level,
    atoms: r.atoms,
    avatar: r.avatar,
    completed: r.completed,
    lastActive: r.last_active,
    createdAt: r.created_at,
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
// "Delete my account" and by the admin page, which passes who did it (`actor`,
// staffAuth.js actorOf) and `action` for the activity log, saved in the same
// step. Group chats the user was in stay, minus the user; chats left with
// fewer than two people are removed.
export function deleteUserCompletely(userId, { actor = null, action = null } = {}) {
  return rpc("stem_user_delete", { p_user_id: userId, p_actor: actor, p_action: action });
}
