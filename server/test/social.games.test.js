import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, signUp } from "./helpers.js";

let srv;
before(async () => {
  process.env.ADMIN_PASSKEY = "test-admin-passkey-long-enough";
  srv = await startServer();
});
after(async () => {
  await srv.close();
});

test("friends, chats, live rooms, game scores and admin use the cookie session", async (t) => {
  const anon = srv.client();
  const ava = srv.client();
  const ben = srv.client();
  const a = await signUp(ava);
  const b = await signUp(ben);
  const avaId = a.json.user.userId;
  const benId = b.json.user.userId;

  await t.test("every new route is 401 without a session", async () => {
    for (const [method, path] of [
      ["get", "/api/me"],
      ["get", "/api/me/export"],
      ["get", "/api/friends"],
      ["post", "/api/friends/requests"],
      ["get", "/api/conversations"],
      ["get", "/api/leaderboard"],
      ["get", "/api/users/search?q=kid"],
      ["get", "/api/game-scores"],
      ["post", "/api/game-scores"],
      ["get", "/api/game-rooms"],
      ["post", "/api/game-rooms"],
    ]) {
      const res = await anon[method](path);
      assert.equal(res.status, 401, `${method.toUpperCase()} ${path}`);
    }
  });

  await t.test("a bearer header from the old token build is ignored", async () => {
    const res = await fetch(srv.base + "/api/me", { headers: { authorization: "Bearer abc" } });
    assert.equal(res.status, 401);
  });

  await t.test("friend request, accept, then chat; strangers can't chat", async () => {
    let res = await ava.post("/api/conversations", { isGroup: false, memberIds: [benId] });
    assert.equal(res.status, 403);

    res = await ava.post("/api/friends/requests", { username: b.body.username.toUpperCase() });
    assert.equal(res.status, 201);
    const { incoming } = (await ben.get("/api/friends")).json;
    assert.equal(incoming.length, 1);
    assert.deepEqual(Object.keys(incoming[0].user).sort(), ["avatar", "level", "userId", "username"]);
    assert.equal((await ben.post(`/api/friends/requests/${incoming[0].requestId}/accept`)).status, 200);

    res = await ava.post("/api/conversations", { isGroup: false, memberIds: [benId] });
    assert.equal(res.status, 201);
    const convoId = res.json.conversation.id;
    assert.equal((await ava.post(`/api/conversations/${convoId}/messages`, { body: "hi!" })).status, 201);
    const { messages } = (await ben.get(`/api/conversations/${convoId}/messages`)).json;
    assert.equal(messages[0].body, "hi!");

    // A third student can't read it.
    const cy = srv.client();
    await signUp(cy);
    assert.equal((await cy.get(`/api/conversations/${convoId}/messages`)).status, 404);
    assert.equal((await ava.post("/api/friends/requests/abc/accept")).status, 400);
  });

  await t.test("game scores: validated id, capped 0-100, best kept", async () => {
    assert.equal((await ava.post("/api/game-scores", { gameId: "<script>", score: 50 })).status, 400);
    assert.equal((await ava.post("/api/game-scores", { gameId: "mm-sci-sim", score: 500 })).json.best, 100);
    assert.equal((await ava.post("/api/game-scores", { gameId: "mm-sci-sim", score: 10 })).json.best, 100);
  });

  await t.test("live rooms take the player from the session, not the request", async () => {
    let res = await ava.post("/api/game-rooms", {
      gameId: "mm-sci-sim",
      player: { id: String(benId), name: "Anything I like", avatar: "https://evil.example/x.png" },
    });
    assert.equal(res.status, 200);
    const room = res.json.room;
    assert.equal(room.hostId, String(avaId));
    assert.equal(room.players[0].name, a.body.username);
    assert.ok(!room.players[0].avatar.startsWith("http"));

    res = await ben.post(`/api/game-rooms/${room.code}/join`, { player: { id: String(avaId) } });
    assert.equal(res.json.room.players.length, 2);
    assert.deepEqual(res.json.room.players.map((p) => p.id).sort(), [String(avaId), String(benId)].sort());

    // Ben can't start (not host), even claiming Ava's id.
    res = await ben.post(`/api/game-rooms/${room.code}/action`, { playerId: String(avaId), type: "start" });
    assert.equal(res.status, 403);

    // Someone not in the room can't act in it or listen to it.
    const cy = srv.client();
    await signUp(cy);
    assert.equal((await cy.post(`/api/game-rooms/${room.code}/action`, { type: "relay" })).status, 403);
    assert.equal((await cy.get(`/api/game-rooms/${room.code}/events`)).status, 404);
  });

  await t.test("account: rename rules, export includes cards", async () => {
    assert.equal((await ava.patch("/api/me", { username: "ab" })).status, 400);
    assert.equal((await ava.patch("/api/me", { username: b.body.username })).status, 409);
    const exp = (await ava.get("/api/me/export")).json;
    assert.ok(Array.isArray(exp.cards) && Array.isArray(exp.reflections) && Array.isArray(exp.gameScores));
  });

  await t.test("admin needs the passkey; a student session is not enough", async () => {
    assert.equal((await ava.get("/api/admin/users")).status, 401);
    assert.equal((await anon.post("/api/admin/login", { passkey: "wrong" })).status, 401);
    const { token } = (await anon.post("/api/admin/login", { passkey: process.env.ADMIN_PASSKEY })).json;
    const res = await fetch(srv.base + "/api/admin/users", { headers: { authorization: `Bearer ${token}` } });
    assert.equal(res.status, 200);
    assert.equal((await fetch(srv.base + "/api/admin/users/abc/progress", { headers: { authorization: `Bearer ${token}` } })).status, 404);
  });
});

test("changing the username's case doesn't reset the sign-in lockout", async () => {
  const c = srv.client();
  const { body } = await signUp(c);
  for (let i = 0; i < 5; i++) {
    const name = i % 2 ? body.username.toUpperCase() : body.username;
    assert.equal((await c.post("/api/login", { username: name, pin: "0000" })).status, 401);
  }
  const res = await c.post("/api/login", { username: body.username.toUpperCase(), pin: "1234" });
  assert.equal(res.status, 429);
});
