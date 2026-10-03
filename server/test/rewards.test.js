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

test("rewards are computed by the server and paid once", async (t) => {
  const kid = srv.client();
  await signUp(kid);

  await t.test("completing the same beat twice adds XP once", async () => {
    const first = await kid.post("/api/progress", { lessonId: "mm-sci-sim", status: "completed" });
    assert.equal(first.status, 200);
    assert.deepEqual(first.json.awarded, { xp: 500, atoms: 300 });
    assert.equal(first.json.user.xp, 500);
    assert.equal(first.json.user.atoms, 300);

    const second = await kid.post("/api/progress", { lessonId: "mm-sci-sim", status: "completed" });
    assert.deepEqual(second.json.awarded, { xp: 0, atoms: 0 });
    assert.equal(second.json.user.xp, 500);
    assert.equal(second.json.user.atoms, 300);
  });

  await t.test("client-sent XP and unknown lessons are ignored / rejected", async () => {
    const res = await kid.post("/api/progress", {
      lessonId: "mm-exit",
      status: "completed",
      xp: 999999,
      atoms: 999999,
    });
    assert.deepEqual(res.json.awarded, { xp: 100, atoms: 50 });
    assert.equal((await kid.post("/api/progress", { lessonId: "fake", status: "completed" })).status, 400);
    assert.equal((await kid.post("/api/user/xp", { xp: 999999, level: 99, atoms: 1 })).status, 404);
  });

  await t.test("quiz XP follows the clamped score; video without a URL gives no XP", async () => {
    const quiz = await kid.post("/api/progress", { lessonId: "mm-sci1-quiz", status: "completed", score: 5000 });
    assert.deepEqual(quiz.json.awarded, { xp: 100, atoms: 25 });
    const quiz2 = await kid.post("/api/progress", { lessonId: "mm-sci2-quiz", status: "completed", score: 0 });
    assert.deepEqual(quiz2.json.awarded, { xp: 50, atoms: 25 });
    const video = await kid.post("/api/progress", { lessonId: "mm-sci1-video", status: "completed" });
    assert.deepEqual(video.json.awarded, { xp: 0, atoms: 100 });
  });

  await t.test("level is recomputed from XP", async () => {
    // 500 + 100 + 100 + 50 = 750 XP so far; a second game takes it past 1000.
    const res = await kid.post("/api/progress", { lessonId: "mm-math-sim", status: "completed" });
    assert.equal(res.json.user.xp, 1250);
    assert.equal(res.json.user.level, 2);
  });

  await t.test("replays pay only for finished games, at most 3 a day", async () => {
    const notDone = await kid.post("/api/progress", { lessonId: "sb-sci-sim", replay: true });
    assert.equal(notDone.status, 400);
    const notGame = await kid.post("/api/progress", { lessonId: "mm-exit", replay: true });
    assert.equal(notGame.status, 400);

    const before = (await kid.get("/api/user/me")).json.user;
    const results = [];
    for (let i = 0; i < 20; i++) {
      results.push((await kid.post("/api/progress", { lessonId: "mm-sci-sim", replay: true })).json.awarded);
    }
    assert.equal(results.filter((a) => a.xp > 0).length, 3);
    const afterUser = (await kid.get("/api/user/me")).json.user;
    assert.equal(afterUser.xp - before.xp, 30);
    assert.equal(afterUser.atoms - before.atoms, 15);
  });

  await t.test("avatars must be one of the built-in keys", async () => {
    assert.equal((await kid.post("/api/user/avatar", { avatar: "https://evil.example/x.png" })).status, 400);
    assert.equal((await kid.post("/api/user/avatar", { avatar: "girl_yellow_flower" })).status, 200);
    assert.equal((await kid.get("/api/user/me")).json.user.avatar, "girl_yellow_flower");
  });
});
