import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, signUp } from "./helpers.js";

let srv;
before(async () => {
  srv = await startServer();
});
after(async () => {
  await srv.close();
});

test("protected routes return 401 without a session and ignore body userId", async (t) => {
  const anon = srv.client();

  await t.test("no session -> 401 on every per-user route", async () => {
    for (const [method, path] of [
      ["get", "/api/user/me"],
      ["get", "/api/progress"],
      ["post", "/api/progress"],
      ["post", "/api/user/avatar"],
      ["post", "/api/chat"],
      ["get", "/api/cards"],
      ["post", "/api/packs/open"],
    ]) {
      const res = await anon[method](path);
      assert.equal(res.status, 401, `${method.toUpperCase()} ${path}`);
    }
  });

  await t.test("the old id-based lookup routes are gone", async () => {
    assert.equal((await anon.get("/api/user/1")).status, 404);
    assert.equal((await anon.get("/api/progress/1")).status, 404);
  });

  const alice = srv.client();
  const bob = srv.client();
  const a = await signUp(alice, { fullName: "Alice" });
  const b = await signUp(bob, { fullName: "Bob" });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.match(alice.cookie, /^stem_session=/);
  const aliceId = a.json.user.userId;

  await t.test("a session identifies its own user only", async () => {
    const me = await alice.get("/api/user/me");
    assert.equal(me.status, 200);
    assert.equal(me.json.user.username, a.body.username);
  });

  await t.test("body userId is ignored on progress writes", async () => {
    const res = await bob.post("/api/progress", {
      userId: aliceId,
      lessonId: "mm-intro",
      status: "completed",
    });
    assert.equal(res.status, 200);
    const aliceProgress = await alice.get("/api/progress");
    assert.deepEqual(aliceProgress.json.progress, []);
    const bobProgress = await bob.get("/api/progress");
    assert.equal(bobProgress.json.progress.length, 1);
  });

  await t.test("body userId is ignored on avatar writes", async () => {
    const res = await bob.post("/api/user/avatar", { userId: aliceId, avatar: "girl_teal_buns" });
    assert.equal(res.status, 200);
    assert.equal((await alice.get("/api/user/me")).json.user.avatar, null);
    assert.equal((await bob.get("/api/user/me")).json.user.avatar, "girl_teal_buns");
  });

  await t.test("a tampered cookie is rejected", async () => {
    const forged = await fetch(srv.base + "/api/user/me", {
      headers: { cookie: alice.cookie.replace(/.$/, (c) => (c === "A" ? "B" : "A")) },
    });
    assert.equal(forged.status, 401);
  });

  await t.test("logout deletes the session server-side", async () => {
    const oldCookie = alice.cookie;
    assert.equal((await alice.post("/api/logout")).status, 200);
    assert.equal(alice.cookie, "");
    const replay = await fetch(srv.base + "/api/user/me", { headers: { cookie: oldCookie } });
    assert.equal(replay.status, 401);
  });
});
