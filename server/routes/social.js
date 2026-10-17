import express from "express";
import { rateLimit } from "express-rate-limit";
import { rpc } from "../db.js";
import { route } from "../route.js";
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
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const MAX_MESSAGE_LENGTH = 500;
const MAX_GROUP_NAME = 40;
const MAX_MESSAGES_PER_FETCH = 200;

/** True when userId is friends with every id in ids. */
const friendsWithAll = (userId, ids) => rpc("stem_all_friends", { p_user_id: userId, p_ids: ids });

// ---------------------------------------------------------
// People search, used by the "Add friend" box. Only real accounts come back,
// so a request can only ever go to someone who exists.
// ---------------------------------------------------------
router.get("/users/search", route(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 40) : "";
  if (q.length < 2) return res.json({ users: [] });
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  // Up to 8 matches, the exact name first, each with "friends", "requested",
  // "incoming" or "none".
  const rows = await rpc("stem_users_search", { p_user_id: req.userId, p_pattern: `%${escaped}%`, p_query: q });
  res.json({ users: rows.map((r) => ({ ...otherUser(r), status: r.status })) });
}));

// Real users ranked by XP, for the leaderboard.
router.get("/leaderboard", route(async (req, res) => {
  const rows = await rpc("stem_leaderboard", { p_user_id: req.userId, p_limit: 50 });
  res.json({
    entries: rows.map((r) => ({ ...otherUser(r), xp: r.xp, isFriend: r.is_friend })),
  });
}));

// ---------------------------------------------------------
// Friends & requests
// ---------------------------------------------------------
router.get("/friends", route(async (req, res) => {
  const { friends, incoming, outgoing } = await rpc("stem_friends_overview", { p_user_id: req.userId });
  const request = (r) => ({ requestId: r.request_id, createdAt: r.created_at, user: otherUser(r.user) });
  res.json({ friends: friends.map(otherUser), incoming: incoming.map(request), outgoing: outgoing.map(request) });
}));

router.post("/friends/requests", friendRequestLimiter, route(async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  if (!username) return res.status(400).json({ error: "Type a username first." });

  // If they already asked us, this accepts their request instead of making a second one.
  const { outcome, user } = await rpc("stem_friend_request_send", { p_user_id: req.userId, p_username: username });
  switch (outcome) {
    case "not_found":
      return res.status(404).json({ error: `We couldn't find anyone called "${username}".` });
    case "self":
      return res.status(400).json({ error: "That's you! Try a friend's username." });
    case "already_friends":
      return res.status(409).json({ error: `You and ${user.username} are already friends.` });
    case "duplicate":
      return res.status(409).json({ error: `You've already sent ${user.username} a request.` });
    case "friends":
      return res.json({ status: "friends", user: otherUser(user) });
    default:
      return res.status(201).json({ status: "requested", user: otherUser(user) });
  }
}));

router.post("/friends/requests/:id/:action", route(async (req, res) => {
  const { action } = req.params;
  const id = toId(req.params.id);
  if (!id || !["accept", "decline", "cancel"].includes(action)) {
    return res.status(400).json({ error: "Unknown action." });
  }
  // Only the receiver can accept or decline, only the sender can cancel.
  const done = await rpc("stem_friend_request_respond", { p_user_id: req.userId, p_request_id: id, p_action: action });
  if (!done) return res.status(404).json({ error: "That request isn't there any more." });
  res.json({ success: true });
}));

router.delete("/friends/:userId", route(async (req, res) => {
  const other = toId(req.params.userId);
  if (!other) return res.status(400).json({ error: "Unknown friend." });
  await rpc("stem_friend_remove", { p_user_id: req.userId, p_other_id: other });
  res.json({ success: true });
}));

// ---------------------------------------------------------
// Conversations: one-to-one chats and group chats
// ---------------------------------------------------------

/** The chat list's view of a conversation (from stem_conversation_summary)
 *  for `userId`: a one-to-one chat is named after the other student. */
function conversationSummary(row, userId) {
  const members = row.members.map(otherUser);
  const last = row.last;
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

router.get("/conversations", route(async (req, res) => {
  // Newest message first.
  const rows = await rpc("stem_conversations_for", { p_user_id: req.userId });
  res.json({ conversations: rows.map((r) => conversationSummary(r, req.userId)) });
}));

router.post("/conversations", createChatLimiter, route(async (req, res) => {
  const { isGroup, name, memberIds } = req.body || {};
  const ids = [...new Set((Array.isArray(memberIds) ? memberIds : []).map(toId))].filter(
    (id) => id && id !== req.userId,
  );
  if (ids.length === 0) return res.status(400).json({ error: "Pick at least one friend." });
  if (!(await friendsWithAll(req.userId, ids))) {
    return res.status(403).json({ error: "You can only chat with people on your friends list." });
  }

  if (!isGroup) {
    if (ids.length !== 1) return res.status(400).json({ error: "A chat is between two people." });
    const existing = await rpc("stem_direct_conversation", { p_a: req.userId, p_b: ids[0] });
    if (existing) return res.json({ conversation: conversationSummary(existing, req.userId) });
  }

  const groupName = typeof name === "string" ? name.trim() : "";
  if (isGroup && (!groupName || groupName.length > MAX_GROUP_NAME)) {
    return res.status(400).json({ error: `Give your group a name (up to ${MAX_GROUP_NAME} characters).` });
  }

  const row = await rpc("stem_conversation_create", {
    p_user_id: req.userId,
    p_is_group: !!isGroup,
    p_name: isGroup ? groupName : null,
    p_member_ids: ids,
  });
  res.status(201).json({ conversation: conversationSummary(row, req.userId) });
}));

// Messages, oldest first. Pass ?after=<message id> to fetch only new ones,
// which is what the chat polls with to stay live.
router.get("/conversations/:id/messages", route(async (req, res) => {
  const id = toId(req.params.id);
  const after = Math.min(Math.max(Math.floor(Number(req.query.after) || 0), 0), Number.MAX_SAFE_INTEGER);
  // Null when the student isn't in this chat.
  const rows =
    id &&
    (await rpc("stem_messages_after", {
      p_user_id: req.userId,
      p_conversation_id: id,
      p_after: after,
      p_limit: MAX_MESSAGES_PER_FETCH,
    }));
  if (!rows) return res.status(404).json({ error: "Chat not found." });
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
}));

router.post("/conversations/:id/messages", messageLimiter, route(async (req, res) => {
  const id = toId(req.params.id);
  if (!id || !(await rpc("stem_is_member", { p_conversation_id: id, p_user_id: req.userId }))) {
    return res.status(404).json({ error: "Chat not found." });
  }
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!body) return res.status(400).json({ error: "Type a message first." });
  if (body.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Messages can be up to ${MAX_MESSAGE_LENGTH} characters.` });
  }
  // Null if they left the chat a moment ago.
  const messageId = await rpc("stem_message_send", { p_user_id: req.userId, p_conversation_id: id, p_body: body });
  if (!messageId) return res.status(404).json({ error: "Chat not found." });
  res.status(201).json({ message: { id: messageId } });
}));

router.post("/conversations/:id/leave", route(async (req, res) => {
  const id = toId(req.params.id);
  // The group goes once its last member leaves.
  const result = id ? await rpc("stem_conversation_leave", { p_user_id: req.userId, p_conversation_id: id }) : "not_found";
  if (result === "not_found") return res.status(404).json({ error: "Chat not found." });
  if (result === "not_group") return res.status(400).json({ error: "You can only leave group chats." });
  res.json({ success: true });
}));

router.post("/conversations/:id/members", route(async (req, res) => {
  const id = toId(req.params.id);
  const ids = [...new Set((Array.isArray(req.body?.memberIds) ? req.body.memberIds : []).map(toId))];
  const result = id
    ? await rpc("stem_group_add_members", { p_user_id: req.userId, p_conversation_id: id, p_member_ids: ids })
    : { error: "not_found" };
  if (result.error === "not_found") return res.status(404).json({ error: "Group not found." });
  if (result.error) return res.status(403).json({ error: "You can only add people on your friends list." });
  res.json({ conversation: conversationSummary(result.conversation, req.userId) });
}));

// Search across every message in the chats you belong to.
router.get("/messages/search", route(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (q.length < 2) return res.json({ results: [] });
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await rpc("stem_messages_search", { p_user_id: req.userId, p_pattern: `%${escaped}%`, p_limit: 30 });
  res.json({
    results: rows.map((r) => ({
      messageId: r.message_id,
      conversationId: r.conversation_id,
      body: r.body,
      createdAt: r.created_at,
      senderName: r.username ?? "Deleted account",
    })),
  });
}));

export default router;
