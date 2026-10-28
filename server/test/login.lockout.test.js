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

test("6th attempt after 5 failures returns 429; recover/verify closes after 3 wrong answers", async (t) => {
  await t.test("login locks after 5 wrong PINs, even for the right PIN", async () => {
    const { body } = await signUp(srv.client(), { pin: "4321" });
    const c = srv.client();
    for (let i = 0; i < 5; i++) {
      const res = await c.post("/api/login", { username: body.username, pin: "0000" });
      assert.equal(res.status, 401, `attempt ${i + 1}`);
    }
    const sixth = await c.post("/api/login", { username: body.username, pin: "4321" });
    assert.equal(sixth.status, 429);
    assert.match(sixth.json.error, /Too many tries/);
    assert.equal(c.cookie, "", "no session is issued while locked out");
  });

  await t.test("recover/verify closes after 3 wrong answers, even for the right ones", async () => {
    const { body } = await signUp(srv.client(), { recoveryColourId: 2, recoverySubjectId: 3 });
    const c = srv.client();
    for (let i = 0; i < 3; i++) {
      const res = await c.post("/api/recover/verify", {
        username: body.username,
        recoveryColourId: 1,
        recoverySubjectId: 1,
      });
      assert.equal(res.status, 401, `attempt ${i + 1}`);
    }
    const fourth = await c.post("/api/recover/verify", {
      username: body.username,
      recoveryColourId: 2,
      recoverySubjectId: 3,
    });
    assert.equal(fourth.status, 403);
    assert.match(fourth.json.error, /ask your teacher to reset your PIN/);
    assert.equal(fourth.json.resetToken, undefined);
  });

  await t.test("5 wrong PINs lock Forgot PIN too", async () => {
    const { body } = await signUp(srv.client(), { pin: "4321", recoveryColourId: 2, recoverySubjectId: 3 });
    const c = srv.client();
    for (let i = 0; i < 5; i++) {
      assert.equal((await c.post("/api/login", { username: body.username, pin: "0000" })).status, 401);
    }
    const res = await c.post("/api/recover/verify", {
      username: body.username,
      recoveryColourId: 2,
      recoverySubjectId: 3,
    });
    assert.equal(res.status, 429);
    assert.equal(res.json.resetToken, undefined);
  });
});
