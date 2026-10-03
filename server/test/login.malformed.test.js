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

test("non-string username/pin returns 400 and the server stays up (follow-up request succeeds)", async (t) => {
  const { body } = await signUp(srv.client(), { pin: "2468" });
  const c = srv.client();

  const cases = [
    ["/api/login", { username: {}, pin: "1" }],
    ["/api/login", { username: body.username, pin: 1234 }],
    ["/api/login", { username: ["a"], pin: ["1234"] }],
    ["/api/signup", { ...body, username: { $gt: "" } }],
    ["/api/signup", { ...body, username: "fresh_name", pin: 1234 }],
    ["/api/recover/verify", { username: {}, recoveryColourId: 1, recoverySubjectId: 1 }],
    ["/api/recover/reset", { username: body.username, resetToken: "x", newPin: 1234 }],
    ["/api/recover/reset", { username: 7, resetToken: {}, newPin: "1234" }],
  ];

  for (const [path, payload] of cases) {
    await t.test(`${path} ${JSON.stringify(payload).slice(0, 60)}`, async () => {
      const res = await c.post(path, payload);
      assert.equal(res.status, 400);
      assert.equal(typeof res.json?.error, "string");
      // The process is still alive and serving.
      const ping = await c.get("/api/reference-data");
      assert.equal(ping.status, 200);
    });
  }

  await t.test("broken JSON gets a JSON 400, not an HTML stack trace", async () => {
    const res = await c.post("/api/login", "{not json");
    assert.equal(res.status, 400);
    assert.equal(typeof res.json?.error, "string");
    assert.doesNotMatch(res.text, /at .*\.js/);
  });

  await t.test("junk usernames are not written to login_attempts", async () => {
    const before = srv.db.prepare("SELECT COUNT(*) AS n FROM login_attempts").get().n;
    const res = await c.post("/api/login", { username: "x".repeat(5000), pin: "1234" });
    assert.equal(res.status, 401);
    const res2 = await c.post("/api/login", { username: "<script>", pin: "1234" });
    assert.equal(res2.status, 401);
    assert.equal(srv.db.prepare("SELECT COUNT(*) AS n FROM login_attempts").get().n, before);
    assert.equal((await signUp(srv.client(), { username: "u".repeat(33) })).status, 400);
  });

  await t.test("a real sign-in still works afterwards", async () => {
    const res = await c.post("/api/login", { username: body.username, pin: "2468" });
    assert.equal(res.status, 200);
  });
});
