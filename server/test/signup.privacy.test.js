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

test("sign-up limits, organisations, reflections, leaderboard and account deletion", async (t) => {
  await t.test("POST /api/organisations is gone", async () => {
    const res = await srv.client().post("/api/organisations", { name: "Spam Centre" });
    assert.equal(res.status, 404);
  });

  await t.test("names over 80 characters are rejected", async () => {
    assert.equal((await signUp(srv.client(), { fullName: "A".repeat(200) })).status, 400);
    assert.equal((await signUp(srv.client(), { orgOther: "B".repeat(81) })).status, 400);
  });

  await t.test("consent is required", async () => {
    assert.equal((await signUp(srv.client(), { consent: false })).status, 400);
    assert.equal((await signUp(srv.client(), { consent: "yes" })).status, 400);
  });

  await t.test("'Others' stores free text and never adds to the dropdown", async () => {
    const res = await signUp(srv.client(), { orgId: undefined, orgOther: "Little Stars Centre" });
    assert.equal(res.status, 201);
    const row = srv.db
      .prepare("SELECT u.org_other, o.org_name FROM users u JOIN organisations o ON o.org_id = u.org_id WHERE u.user_id = ?")
      .get(res.json.user.userId);
    assert.deepEqual(row, { org_other: "Little Stars Centre", org_name: "Other" });

    const names = (await srv.client().get("/api/reference-data")).json.organisations.map((o) => o.name);
    assert.equal(names.length, 7);
    assert.ok(!names.includes("Other"));
    assert.ok(!names.includes("Little Stars Centre"));
  });

  await t.test("unknown organisation ids are rejected", async () => {
    const otherId = srv.db.prepare("SELECT org_id FROM organisations WHERE org_name = 'Other'").get().org_id;
    assert.equal((await signUp(srv.client(), { orgId: 999 })).status, 400);
    assert.equal((await signUp(srv.client(), { orgId: otherId })).status, 400);
  });

  const kid = srv.client();
  const { json } = await signUp(kid, { fullName: "Maya Tan" });
  const userId = json.user.userId;

  await t.test("reflections persist and only show first name + avatar", async () => {
    assert.equal((await srv.client().get("/api/reflections")).status, 401);
    assert.equal((await kid.post("/api/reflections", { beatId: "mm-exit", caption: "x".repeat(281) })).status, 400);
    assert.equal((await kid.post("/api/reflections", { beatId: "mm-intro", caption: "hi" })).status, 400);

    const created = await kid.post("/api/reflections", { beatId: "mm-exit", caption: "Water cycles!" });
    assert.equal(created.status, 201);
    assert.equal((await kid.post("/api/reflections", { beatId: "mm-exit", caption: "again" })).status, 409);

    // Another student (or the same one after a refresh) sees it.
    const viewer = srv.client();
    await signUp(viewer);
    const { reflections } = (await viewer.get("/api/reflections")).json;
    assert.equal(reflections.length, 1);
    assert.equal(reflections[0].caption, "Water cycles!");
    assert.equal(reflections[0].firstName, "Maya");
    assert.equal(reflections[0].beatTitle, "Exit Card");
    assert.deepEqual(Object.keys(reflections[0]).sort(), ["avatar", "beatTitle", "caption", "createdAt", "firstName", "id"]);
  });

  await t.test("leaderboard is backed by users.xp", async () => {
    srv.db.prepare("UPDATE users SET xp = 4321 WHERE user_id = ?").run(userId);
    const { entries } = (await kid.get("/api/leaderboard")).json;
    assert.ok(entries.length <= 50);
    assert.equal(entries[0].xp, 4321);
    // Never the full name or centre — only what other students may see.
    assert.deepEqual(Object.keys(entries[0]).sort(), ["avatar", "isFriend", "level", "userId", "username", "xp"]);
  });

  await t.test("DELETE /api/me needs the PIN and removes the student's rows", async () => {
    await kid.post("/api/progress", { lessonId: "mm-intro", status: "completed" });
    srv.db.prepare("UPDATE users SET atoms = 100 WHERE user_id = ?").run(userId);
    await kid.post("/api/packs/open", { albumKey: "phenomena", packId: "phen-p1" });

    assert.equal((await kid.del("/api/me", { pin: "0000" })).status, 401);
    assert.equal((await kid.del("/api/me")).status, 401);
    const res = await kid.del("/api/me", { pin: "1234" });
    assert.equal(res.status, 200);
    for (const table of ["users", "lesson_progress", "user_cards", "reflections", "sessions", "beat_replays", "game_scores"]) {
      const { n } = srv.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).get(userId);
      assert.equal(n, 0, table);
    }
    assert.equal((await kid.get("/api/user/me")).status, 401);
  });
});
