// Forgot PIN has only 49 possible answers (7 colours × 7 subjects), so 3 wrong
// answers close it for that username until the student signs in with their PIN
// or a new PIN is set (stem_recovery_misses in supabase/schema.sql).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, signUp } from "./helpers.js";

const PASSKEY = "test-admin-passkey-long-enough";
const CLOSED = /^Too many wrong answers — ask your teacher to reset your PIN\.$/;
const RIGHT = { recoveryColourId: 2, recoverySubjectId: 3 };
const WRONG = { recoveryColourId: 1, recoverySubjectId: 1 };

let srv;
let adminToken;
before(async () => {
  process.env.ADMIN_PASSKEY = PASSKEY;
  process.env.AUTH_RATE_LIMIT_PER_MIN = "1000";
  srv = await startServer();
  adminToken = (await srv.client().post("/api/admin/login", { passkey: PASSKEY })).json.token;
});
after(async () => {
  await srv.close();
});

async function admin(method, path, body) {
  const res = await fetch(`${srv.base}/api/admin${path}`, {
    method,
    headers: { authorization: `Bearer ${adminToken}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

/** A new student (PIN 4321, Forgot-PIN answers RIGHT); `me` holds their session. */
async function student() {
  const me = srv.client();
  const { body, json } = await signUp(me, { pin: "4321", ...RIGHT });
  return { me, username: body.username, userId: json.user.userId };
}

const verify = (username, answers) => srv.client().post("/api/recover/verify", { username, ...answers });

/** Gives `n` wrong answers, each still checked (and refused as wrong). */
async function miss(username, n) {
  for (let i = 0; i < n; i++) assert.equal((await verify(username, WRONG)).status, 401, `wrong answer ${i + 1}`);
}

/** Even the right answers get no reset token. */
async function assertClosed(username) {
  const res = await verify(username, RIGHT);
  assert.equal(res.status, 403);
  assert.match(res.json.error, CLOSED);
  assert.equal(res.json.resetToken, undefined);
}

async function assertOpen(username) {
  const res = await verify(username, RIGHT);
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(typeof res.json.resetToken, "string");
}

/** Moves a username's tries an hour back: the 15-minute lockout is over, the closure isn't. */
const anHourPasses = (username) =>
  srv.sql("UPDATE login_attempts SET attempted_at = attempted_at - interval '1 hour' WHERE lower(username) = lower($1)", [
    username,
  ]);

test("3 wrong answers close Forgot PIN, even for the right answers, and an hour later it's still closed", async () => {
  const { username } = await student();
  await miss(username, 3);
  await assertClosed(username);
  await anHourPasses(username);
  await assertClosed(username);
});

test("signing in with the PIN still works while Forgot PIN is closed, and reopens it", async () => {
  const { username } = await student();
  await miss(username, 3);
  await assertClosed(username);
  assert.equal((await srv.client().post("/api/login", { username, pin: "4321" })).status, 200);
  await assertOpen(username);
});

test("a new PIN reopens Forgot PIN", async (t) => {
  await t.test("changed on the Me page", async () => {
    const { me, username } = await student();
    await miss(username, 3);
    assert.equal((await me.post("/api/me/pin", { currentPin: "4321", newPin: "5678" })).status, 200);
    await assertOpen(username);
  });

  await t.test("reset by an admin", async () => {
    const { username, userId } = await student();
    await miss(username, 3);
    assert.equal((await admin("POST", `/users/${userId}/reset-pin`, { pin: "1111" })).status, 200);
    await assertOpen(username);
  });

  await t.test("reset by centre staff", async () => {
    const { username, userId } = await student();
    await miss(username, 3);
    const added = await admin("POST", "/staff", {
      fullName: "Ms Lim",
      email: "lim@example.org",
      role: "staff",
      allCentres: false,
      centreIds: [1],
    });
    assert.equal(added.status, 200, JSON.stringify(added.json));
    const token = new URL(added.json.setupLink.url.replace("#/", "")).searchParams.get("t");
    const staff = srv.client();
    assert.equal((await staff.post("/api/staff/setup", { token, password: "correct horse battery" })).status, 200);
    assert.equal((await staff.post(`/api/staff/students/${userId}/reset-pin`, { pin: "2222" })).status, 200);
    await assertOpen(username);
  });

  await t.test("set through Forgot PIN, which starts the count again", async () => {
    const { username } = await student();
    await miss(username, 2);
    const ok = await verify(username, RIGHT);
    assert.equal(ok.status, 200);
    const reset = await srv.client().post("/api/recover/reset", { username, resetToken: ok.json.resetToken, newPin: "2468" });
    assert.equal(reset.status, 200);
    await miss(username, 2);
    await assertOpen(username);
  });
});

test("wrong PINs at sign-in don't close Forgot PIN", async () => {
  const { username } = await student();
  const c = srv.client();
  for (let i = 0; i < 4; i++) assert.equal((await c.post("/api/login", { username, pin: "0000" })).status, 401);
  await assertOpen(username);
});

test("a wrong-case username counts toward the closure, and a new username keeps it", async () => {
  const { me, username } = await student();
  // Forgot PIN needs the exact username, but these still count for it.
  await miss(username.toUpperCase(), 3);
  await assertClosed(username);
  const renamed = `${username}_r`;
  assert.equal((await me.patch("/api/me", { username: renamed })).status, 200);
  await assertClosed(renamed);
});

test("a username nobody has closes the same way, so the reply doesn't say whether it exists", async () => {
  const nobody = `nobody_${process.pid}`;
  await miss(nobody, 3);
  const res = await verify(nobody, RIGHT);
  assert.equal(res.status, 403);
  assert.match(res.json.error, CLOSED);
});

test("a new PIN from an admin or staff doesn't make the student look active", async () => {
  const { userId } = await student();
  await srv.sql("UPDATE users SET created_at = now() - interval '1 day' WHERE user_id = $1", [userId]);
  const lastActive = async () =>
    (await srv.sql("SELECT stem_students_for(NULL) AS j"))[0].j.find((s) => s.user_id === userId).last_active;
  const before = await lastActive();
  assert.equal((await admin("POST", `/users/${userId}/reset-pin`, { pin: "1111" })).status, 200);
  assert.equal(await lastActive(), before);
});

test("Download my data says what each record was", async () => {
  const { me, username } = await student();
  await miss(username, 1);
  assert.equal((await srv.client().post("/api/login", { username, pin: "4321" })).status, 200);
  assert.equal((await me.post("/api/me/pin", { currentPin: "4321", newPin: "5678" })).status, 200);
  const { loginHistory } = (await me.get("/api/me/export")).json;
  assert.deepEqual(
    loginHistory.map((h) => [h.kind, h.success]),
    [["recovery", 0], ["sign_in", 1], ["new_pin", 1]],
  );
});
