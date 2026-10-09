import express from "express";
import { rateLimit } from "express-rate-limit";
import db from "../db.js";
import { requireUser } from "../auth.js";
import { otherUser } from "../users.js";

const router = express.Router();
router.use(["/users", "/leaderboard", "/friends", "/conversations", "/messages"], requireUser);

// Per-student caps so one account can't flood others with requests or messages.
const perUser = (limit, windowMs, error) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator: (req) => String(req.userId),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error },
  });
const friendRequestLimiter = perUser(20, 3600_000, "That's a lot of friend requests! Try again later.");
const messageLimiter = perUser(30, 60_000, "Slow down a little — try again in a minute.");
const createChatLimiter = perUser(20, 3600_000, "That's a lot of new chats! Try again later.");

/** Positive integer id from a route param or body value, else null. */
function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const MAX_MESSAGE_LENGTH = 500;
const MAX_GROUP_NAME = 40;

const pair = (a, b) => (a < b ? [a, b] : [b, a]);

function areFriends(a, b) {
  const [x, y] = pair(a, b);
  return !!db.prepare("SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?").get(x, y);
}

function isMember(conversationId, userId) {
  return !!db
    .prepare("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?")
    .get(conversationId, userId);
}

function friendsOf(userId) {
  return db
    .prepare(
      `SELECT u.* FROM friendships f
         JOIN users u ON u.user_id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
        WHERE f.user_a = ? OR f.user_b = ?
        ORDER BY u.username COLLATE NOCASE`,
    )
    .all(userId, userId, userId)
    .map(otherUser);
}

function makeFriends(a, b) {
  const [x, y] = pair(a, b);
  db.prepare("INSERT OR IGNORE INTO friendships (user_a, user_b) VALUES (?, ?)").run(x, y);
  db.prepare(
    "DELETE FROM friend_requests WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)",
  ).run(a, b, b, a);
}

// ---------------------------------------------------------
// People search, used by the "Add friend" box. Only real accounts come back,
// so a request can only ever go to someone who exists.
// ---------------------------------------------------------
router.get("/users/search", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 40) : "";
  if (q.length < 2) return res.json({ users: [] });
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = db
    .prepare(
      `SELECT * FROM users
        WHERE username LIKE ? ESCAPE '\\' COLLATE NOCASE AND user_id != ?
        ORDER BY (username = ? COLLATE NOCASE) DESC, username COLLATE NOCASE
        LIMIT 8`,
    )
    .all(`%${escaped}%`, req.userId, q);
  res.json({
    users: rows.map((r) => {
      const outgoing = db
        .prepare("SELECT 1 FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?")
        .get(req.userId, r.user_id);
      const incoming = db
        .prepare("SELECT 1 FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?")
        .get(r.user_id, req.userId);
      return {
        ...otherUser(r),
        status: areFriends(req.userId, r.user_id)
          ? "friends"
          : outgoing
            ? "requested"
            : incoming
              ? "incoming"
              : "none",
      };
    }),
  });
});

// Real users ranked by XP, for the leaderboard.
router.get("/leaderboard", (req, res) => {
  const rows = db.prepare("SELECT * FROM users ORDER BY xp DESC, username LIMIT 50").all();
  res.json({
    entries: rows.map((r) => ({
      ...otherUser(r),
      xp: r.xp,
      isFriend: r.user_id !== req.userId && areFriends(req.userId, r.user_id),
    })),
  });
});

// ---------------------------------------------------------
// Friends & requests
// ---------------------------------------------------------
router.get("/friends", (req, res) => {
  const incoming = db
    .prepare(
      `SELECT r.request_id, r.created_at, u.* FROM friend_requests r
         JOIN users u ON u.user_id = r.from_user_id
        WHERE r.to_user_id = ? ORDER BY r.request_id DESC`,
    )
    .all(req.userId)
    .map((r) => ({ requestId: r.request_id, createdAt: r.created_at, user: otherUser(r) }));
  const outgoing = db
    .prepare(
      `SELECT r.request_id, r.created_at, u.* FROM friend_requests r
         JOIN users u ON u.user_id = r.to_user_id
        WHERE r.from_user_id = ? ORDER BY r.request_id DESC`,
    )
    .all(req.userId)
    .map((r) => ({ requestId: r.request_id, createdAt: r.created_at, user: otherUser(r) }));

  res.json({ friends: friendsOf(req.userId), incoming, outgoing });
});

router.post("/friends/requests", friendRequestLimiter, (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  if (!username) return res.status(400).json({ error: "Type a username first." });

  const target = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);
  if (!target) {
    return res.status(404).json({ error: `We couldn't find anyone called "${username}".` });
  }
  if (target.user_id === req.userId) {
    return res.status(400).json({ error: "That's you! Try a friend's username." });
  }
  if (areFriends(req.userId, target.user_id)) {
    return res.status(409).json({ error: `You and ${target.username} are already friends.` });
  }

  // They already asked us: accept straight away instead of making a second request.
  const reverse = db
    .prepare("SELECT request_id FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?")
    .get(target.user_id, req.userId);
  if (reverse) {
    makeFriends(req.userId, target.user_id);
    return res.json({ status: "friends", user: otherUser(target) });
  }

  const info = db
    .prepare("INSERT OR IGNORE INTO friend_requests (from_user_id, to_user_id) VALUES (?, ?)")
    .run(req.userId, target.user_id);
  if (info.changes === 0) {
    return res.status(409).json({ error: `You've already sent ${target.username} a request.` });
  }
  res.status(201).json({ status: "requested", user: otherUser(target) });
});

router.post("/friends/requests/:id/:action", (req, res) => {
  const { action } = req.params;
  const id = toId(req.params.id);
  if (!id || !["accept", "decline", "cancel"].includes(action)) {
    return res.status(400).json({ error: "Unknown action." });
  }
  const request = db.prepare("SELECT * FROM friend_requests WHERE request_id = ?").get(id);
  const mine =
    request &&
    (action === "cancel" ? request.from_user_id === req.userId : request.to_user_id === req.userId);
  if (!mine) return res.status(404).json({ error: "That request isn't there any more." });

  if (action === "accept") makeFriends(request.from_user_id, request.to_user_id);
  else db.prepare("DELETE FROM friend_requests WHERE request_id = ?").run(id);
  res.json({ success: true });
});

router.delete("/friends/:userId", (req, res) => {
  const other = toId(req.params.userId);
  if (!other) return res.status(400).json({ error: "Unknown friend." });
  const [x, y] = pair(req.userId, other);
  db.prepare("DELETE FROM friendships WHERE user_a = ? AND user_b = ?").run(x, y);
  res.json({ success: true });
});

// ---------------------------------------------------------
// Conversations: one-to-one chats and group chats
// ---------------------------------------------------------
function conversationSummary(row, userId) {
  const members = db
    .prepare(
      `SELECT u.* FROM conversation_members m JOIN users u ON u.user_id = m.user_id
        WHERE m.conversation_id = ? ORDER BY u.username COLLATE NOCASE`,
    )
    .all(row.conversation_id)
    .map(otherUser);
  const last = db
    .prepare(
      `SELECT m.message_id, m.body, m.created_at, u.username AS sender
         FROM messages m LEFT JOIN users u ON u.user_id = m.sender_id
        WHERE m.conversation_id = ? ORDER BY m.message_id DESC LIMIT 1`,
    )
    .get(row.conversation_id);
  const others = members.filter((m) => m.userId !== userId);
  return {
    id: row.conversation_id,
    isGroup: !!row.is_group,
    name: row.is_group ? row.name : (others[0]?.username ?? "Chat"),
    avatar: row.is_group ? null : (others[0]?.avatar ?? null),
    createdBy: row.created_by,
    members,
    lastMessage: last
      ? { id: last.message_id, body: last.body, createdAt: last.created_at, sender: last.sender }
      : null,
  };
}

router.get("/conversations", (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*, COALESCE(MAX(msg.message_id), 0) AS last_id FROM conversations c
         JOIN conversation_members me ON me.conversation_id = c.conversation_id AND me.user_id = ?
         LEFT JOIN messages msg ON msg.conversation_id = c.conversation_id
        GROUP BY c.conversation_id
        ORDER BY last_id DESC, c.conversation_id DESC`,
    )
    .all(req.userId);
  res.json({ conversations: rows.map((r) => conversationSummary(r, req.userId)) });
});

router.post("/conversations", createChatLimiter, (req, res) => {
  const { isGroup, name, memberIds } = req.body || {};
  const ids = [...new Set((Array.isArray(memberIds) ? memberIds : []).map(toId))].filter(
    (id) => id && id !== req.userId,
  );
  if (ids.length === 0) return res.status(400).json({ error: "Pick at least one friend." });
  const notFriends = ids.filter((id) => !areFriends(req.userId, id));
  if (notFriends.length) {
    return res.status(403).json({ error: "You can only chat with people on your friends list." });
  }

  if (!isGroup) {
    if (ids.length !== 1) return res.status(400).json({ error: "A chat is between two people." });
    const existing = db
      .prepare(
        `SELECT c.* FROM conversations c
           JOIN conversation_members a ON a.conversation_id = c.conversation_id AND a.user_id = ?
           JOIN conversation_members b ON b.conversation_id = c.conversation_id AND b.user_id = ?
          WHERE c.is_group = 0 LIMIT 1`,
      )
      .get(req.userId, ids[0]);
    if (existing) return res.json({ conversation: conversationSummary(existing, req.userId) });
  }

  const groupName = typeof name === "string" ? name.trim() : "";
  if (isGroup && (!groupName || groupName.length > MAX_GROUP_NAME)) {
    return res.status(400).json({ error: `Give your group a name (up to ${MAX_GROUP_NAME} characters).` });
  }

  const create = db.transaction(() => {
    const info = db
      .prepare("INSERT INTO conversations (is_group, name, created_by) VALUES (?, ?, ?)")
      .run(isGroup ? 1 : 0, isGroup ? groupName : null, req.userId);
    const add = db.prepare("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)");
    for (const id of [req.userId, ...ids]) add.run(info.lastInsertRowid, id);
    return info.lastInsertRowid;
  });
  const id = create();
  const row = db.prepare("SELECT * FROM conversations WHERE conversation_id = ?").get(id);
  res.status(201).json({ conversation: conversationSummary(row, req.userId) });
});

// Messages, oldest first. Pass ?after=<message id> to fetch only new ones,
// which is what the chat polls with to stay live.
router.get("/conversations/:id/messages", (req, res) => {
  const id = Number(req.params.id);
  if (!isMember(id, req.userId)) return res.status(404).json({ error: "Chat not found." });
  const after = Number(req.query.after) || 0;
  const rows = db
    .prepare(
      `SELECT m.message_id, m.body, m.created_at, m.sender_id, u.username, u.avatar
         FROM messages m LEFT JOIN users u ON u.user_id = m.sender_id
        WHERE m.conversation_id = ? AND m.message_id > ?
        ORDER BY m.message_id LIMIT 200`,
    )
    .all(id, after);
  res.json({
    messages: rows.map((r) => ({
      id: r.message_id,
      body: r.body,
      createdAt: r.created_at,
      senderId: r.sender_id,
      senderName: r.username ?? "Deleted account",
      senderAvatar: r.avatar,
    })),
  });
});

router.post("/conversations/:id/messages", messageLimiter, (req, res) => {
  const id = Number(req.params.id);
  if (!isMember(id, req.userId)) return res.status(404).json({ error: "Chat not found." });
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!body) return res.status(400).json({ error: "Type a message first." });
  if (body.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Messages can be up to ${MAX_MESSAGE_LENGTH} characters.` });
  }
  const info = db
    .prepare("INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)")
    .run(id, req.userId, body);
  res.status(201).json({ message: { id: info.lastInsertRowid } });
});

router.post("/conversations/:id/leave", (req, res) => {
  const id = Number(req.params.id);
  const convo = db.prepare("SELECT * FROM conversations WHERE conversation_id = ?").get(id);
  if (!convo || !isMember(id, req.userId)) return res.status(404).json({ error: "Chat not found." });
  if (!convo.is_group) return res.status(400).json({ error: "You can only leave group chats." });
  db.prepare("DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?").run(id, req.userId);
  const left = db.prepare("SELECT COUNT(*) AS n FROM conversation_members WHERE conversation_id = ?").get(id);
  if (left.n === 0) db.prepare("DELETE FROM conversations WHERE conversation_id = ?").run(id);
  res.json({ success: true });
});

router.post("/conversations/:id/members", (req, res) => {
  const id = Number(req.params.id);
  const convo = db.prepare("SELECT * FROM conversations WHERE conversation_id = ?").get(id);
  if (!convo || !convo.is_group || !isMember(id, req.userId)) {
    return res.status(404).json({ error: "Group not found." });
  }
  const ids = [...new Set((Array.isArray(req.body?.memberIds) ? req.body.memberIds : []).map(toId))];
  if (ids.length === 0 || ids.some((m) => !m || !areFriends(req.userId, m))) {
    return res.status(403).json({ error: "You can only add people on your friends list." });
  }
  const add = db.prepare("INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)");
  for (const m of ids) add.run(id, m);
  res.json({ conversation: conversationSummary(convo, req.userId) });
});

// Search across every message in the chats you belong to.
router.get("/messages/search", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (q.length < 2) return res.json({ results: [] });
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = db
    .prepare(
      `SELECT m.message_id, m.body, m.created_at, m.conversation_id, u.username
         FROM messages m
         JOIN conversation_members me ON me.conversation_id = m.conversation_id AND me.user_id = ?
         LEFT JOIN users u ON u.user_id = m.sender_id
        WHERE m.body LIKE ? ESCAPE '\\' COLLATE NOCASE
        ORDER BY m.message_id DESC LIMIT 30`,
    )
    .all(req.userId, `%${escaped}%`);
  res.json({
    results: rows.map((r) => ({
      messageId: r.message_id,
      conversationId: r.conversation_id,
      body: r.body,
      createdAt: r.created_at,
      senderName: r.username ?? "Deleted account",
    })),
  });
});

export default router;
