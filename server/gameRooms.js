// ---------------------------------------------------------
// Live game rooms + game high scores
// ---------------------------------------------------------
// Live play uses Server-Sent Events (one long-lived GET per player) for
// server → client updates and plain POSTs for client → server actions, so it
// needs no extra packages and works through the Vite /api proxy.
//
// Rooms live in memory: they only matter while a match is being played.
// High scores are stored in SQLite (game_scores table in schema.sql).
//
// Every route needs a signed-in student. A player's id, name and avatar come
// from their account on the server, never from the request, so nobody can
// act as someone else or show a made-up name or picture to other children.

import { requireUser } from "./auth.js";

const MAX_PLAYERS = 4;
const MAX_ROOMS = 200;
const MAX_GAMES_PER_USER = 100;
const GAME_ID_REGEX = /^[a-z0-9-]{1,40}$/;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // drop rooms idle for 2 hours

const rooms = new Map(); // code -> room

function makeCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function publicRoom(room) {
  return {
    code: room.code,
    version: room.version,
    gameId: room.gameId,
    hostId: room.hostId,
    status: room.status,
    seed: room.seed,
    startedAt: room.startedAt,
    players: room.players.map(({ id, name, avatar, ready, score, progress, done, connected }) => ({
      id,
      name,
      avatar,
      ready,
      score,
      progress,
      done,
      connected,
    })),
  };
}

function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcast(room, event, data) {
  room.touchedAt = Date.now();
  for (const client of room.clients) send(client.res, event, data);
}

function broadcastRoom(room) {
  room.version++;
  broadcast(room, "room", publicRoom(room));
}

/** The live-play identity for the signed-in student. `avatar` is a stored
 *  avatar key (the client turns it into an image). */
function playerFor(db, userId) {
  const row = db.prepare("SELECT username, avatar FROM users WHERE user_id = ?").get(userId);
  return row ? { id: String(userId), name: row.username, avatar: row.avatar ?? "" } : null;
}

const findRoom = (code) => rooms.get(String(code).toUpperCase());

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.touchedAt > ROOM_TTL_MS || (room.clients.size === 0 && now - room.touchedAt > 60_000)) {
      for (const c of room.clients) c.res.end();
      rooms.delete(code);
    }
  }
}, 30_000).unref();

export function registerGameRoutes(app, db) {
  // ── High scores (0–100 per game) ──────────────────────────
  // Signed-in player only (the user comes from the session cookie).
  app.get("/api/game-scores", requireUser, (req, res) => {
    const rows = db
      .prepare("SELECT game_id, best_score, plays FROM game_scores WHERE user_id = ?")
      .all(req.userId);
    res.json({ scores: rows });
  });

  app.post("/api/game-scores", requireUser, (req, res) => {
    const userId = req.userId;
    const { gameId, score } = req.body || {};
    const s = Math.max(0, Math.min(100, Math.round(Number(score))));
    if (typeof gameId !== "string" || !GAME_ID_REGEX.test(gameId) || Number.isNaN(s)) {
      return res.status(400).json({ error: "Missing fields." });
    }
    const known = db.prepare("SELECT 1 FROM game_scores WHERE user_id = ? AND game_id = ?").get(userId, gameId);
    if (!known) {
      const { n } = db.prepare("SELECT COUNT(*) AS n FROM game_scores WHERE user_id = ?").get(userId);
      if (n >= MAX_GAMES_PER_USER) return res.status(400).json({ error: "Unknown game." });
    }
    db.prepare(
      `INSERT INTO game_scores (user_id, game_id, best_score) VALUES (?, ?, ?)
       ON CONFLICT(user_id, game_id) DO UPDATE SET
         best_score = MAX(best_score, excluded.best_score),
         plays = plays + 1,
         updated_at = datetime('now')`,
    ).run(userId, gameId, s);
    const row = db
      .prepare("SELECT best_score, plays FROM game_scores WHERE user_id = ? AND game_id = ?")
      .get(userId, gameId);
    res.json({ best: row.best_score, plays: row.plays });
  });

  // ── Live rooms ────────────────────────────────────────────
  app.use("/api/game-rooms", requireUser);

  app.get("/api/game-rooms", (req, res) => {
    const { gameId } = req.query;
    const open = [...rooms.values()]
      .filter((r) => r.status === "lobby" && (!gameId || r.gameId === gameId) && r.players.length < MAX_PLAYERS)
      .map(publicRoom);
    res.json({ rooms: open });
  });

  app.post("/api/game-rooms", (req, res) => {
    const { gameId } = req.body || {};
    const p = playerFor(db, req.userId);
    if (typeof gameId !== "string" || !GAME_ID_REGEX.test(gameId) || !p) {
      return res.status(400).json({ error: "Missing game or player." });
    }
    // One open lobby per host, and a ceiling on rooms held in memory.
    for (const r of rooms.values()) {
      if (r.hostId === p.id && r.status === "lobby") {
        for (const c of r.clients) c.res.end();
        rooms.delete(r.code);
      }
    }
    if (rooms.size >= MAX_ROOMS) {
      return res.status(503).json({ error: "The game server is busy. Try again in a minute." });
    }
    const code = makeCode();
    const room = {
      code,
      gameId: String(gameId),
      hostId: p.id,
      status: "lobby",
      seed: Math.floor(Math.random() * 1e9),
      startedAt: null,
      players: [{ ...p, ready: true, score: 0, progress: 0, done: false, connected: false }],
      clients: new Set(),
      touchedAt: Date.now(),
      version: 0,
    };
    rooms.set(code, room);
    res.json({ room: publicRoom(room) });
  });

  app.post("/api/game-rooms/:code/join", (req, res) => {
    const room = findRoom(req.params.code);
    if (!room) return res.status(404).json({ error: "No game with that code. Check it and try again." });
    const p = playerFor(db, req.userId);
    if (!p) return res.status(400).json({ error: "Missing player." });
    const existing = room.players.find((x) => x.id === p.id);
    if (!existing) {
      if (room.status !== "lobby") return res.status(409).json({ error: "That game has already started." });
      if (room.players.length >= MAX_PLAYERS) return res.status(409).json({ error: "That game is full (4 players max)." });
      room.players.push({ ...p, ready: false, score: 0, progress: 0, done: false, connected: false });
    }
    broadcastRoom(room);
    res.json({ room: publicRoom(room) });
  });

  app.get("/api/game-rooms/:code/events", (req, res) => {
    const room = findRoom(req.params.code);
    const playerId = String(req.userId);
    if (!room || !room.players.some((p) => p.id === playerId)) return res.status(404).end();
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
    const client = { res, playerId };
    room.clients.add(client);
    const player = room.players.find((p) => p.id === playerId);
    if (player) player.connected = true;
    send(res, "room", publicRoom(room));
    broadcastRoom(room);

    const ping = setInterval(() => res.write(": ping\n\n"), 20_000);
    req.on("close", () => {
      clearInterval(ping);
      room.clients.delete(client);
      const stillHere = [...room.clients].some((c) => c.playerId === playerId);
      const pl = room.players.find((p) => p.id === playerId);
      if (pl && !stillHere) {
        pl.connected = false;
        if (room.status === "lobby") {
          room.players = room.players.filter((p) => p.id !== playerId);
          if (room.hostId === playerId && room.players[0]) room.hostId = room.players[0].id;
        }
      }
      broadcastRoom(room);
    });
  });

  app.post("/api/game-rooms/:code/action", (req, res) => {
    const room = findRoom(req.params.code);
    if (!room) return res.status(404).json({ error: "Game not found." });
    const { type, payload } = req.body || {};
    const player = room.players.find((p) => p.id === String(req.userId));
    if (!player) return res.status(403).json({ error: "You are not in this game." });

    switch (type) {
      case "ready":
        player.ready = !!payload?.ready;
        break;
      case "start":
        if (player.id !== room.hostId) return res.status(403).json({ error: "Only the host can start." });
        if (room.players.length < 2) return res.status(409).json({ error: "Need at least 2 players." });
        room.status = "playing";
        room.seed = Math.floor(Math.random() * 1e9);
        room.startedAt = Date.now() + 3500; // everyone counts down together
        room.players.forEach((p) => Object.assign(p, { score: 0, progress: 0, done: false }));
        break;
      case "progress":
        player.score = Math.max(0, Math.min(100, Math.round(Number(payload?.score) || 0)));
        player.progress = Math.max(0, Math.min(1, Number(payload?.progress) || 0));
        break;
      case "finish":
        player.score = Math.max(0, Math.min(100, Math.round(Number(payload?.score) || 0)));
        player.progress = 1;
        player.done = true;
        if (room.players.every((p) => p.done || !p.connected)) room.status = "finished";
        break;
      case "rematch":
        if (player.id !== room.hostId) return res.status(403).json({ error: "Only the host can restart." });
        room.status = "lobby";
        room.players.forEach((p) => Object.assign(p, { score: 0, progress: 0, done: false, ready: p.id === room.hostId }));
        break;
      case "relay":
        // Game-specific message (e.g. a turn-based game's state). Sent to everyone.
        broadcast(room, "relay", { from: player.id, data: payload });
        return res.json({ ok: true });
      case "leave":
        room.players = room.players.filter((p) => p.id !== player.id);
        if (room.hostId === player.id && room.players[0]) room.hostId = room.players[0].id;
        if (room.players.length === 0) rooms.delete(room.code);
        break;
      default:
        return res.status(400).json({ error: "Unknown action." });
    }
    broadcastRoom(room);
    res.json({ room: publicRoom(room) });
  });
}
