// Tries sent together for one username must take turns (see oneTryAtATime.js),
// so a burst can't get more than 5 wrong guesses past the 5-in-15-minutes
// lockout by having every request read the count before any try is logged.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, signUp } from "./helpers.js";
import { oneTryAtATime } from "../oneTryAtATime.js";

const LOCKOUT = /ask your teacher or wait 15 minutes/;

let srv;
before(async () => {
  // A centre may put many children behind one IP, so the per-IP limit (20 a
  // minute) can be raised on the host. Raise it here too, before app.js loads,
  // so these replies come from the per-username lockout alone.
  process.env.AUTH_RATE_LIMIT_PER_MIN = "1000";
  srv = await startServer();
});
after(async () => {
  await srv.close();
});

/** Starts every request at once and waits for all the replies. */
const together = (requests) => Promise.all(requests.map((send) => send()));

/** How many replies had each status, e.g. { 401: 5, 429: 15 }. */
function countStatuses(replies) {
  const counts = {};
  for (const { status } of replies) counts[status] = (counts[status] ?? 0) + 1;
  return counts;
}

/** Every 429 is the username lockout, not the per-IP limit. */
function assertLockouts(replies) {
  for (const r of replies) if (r.status === 429) assert.match(r.json.error, LOCKOUT);
}

/** Wrong tries logged for a username in any letter case: the ones that reached the check. */
async function failuresLogged(username) {
  const [row] = await srv.sql(
    "SELECT count(*)::int AS n FROM login_attempts WHERE lower(username) = lower($1) AND NOT success",
    [username],
  );
  return row.n;
}

test("20 wrong PINs sent together: 5 are checked, the rest are locked out", async () => {
  const { body } = await signUp(srv.client(), { pin: "4321" });
  const c = srv.client();
  const replies = await together(
    Array.from({ length: 20 }, () => () => c.post("/api/login", { username: body.username, pin: "0000" })),
  );
  assert.deepEqual(countStatuses(replies), { 401: 5, 429: 15 });
  assertLockouts(replies);
  assert.equal(await failuresLogged(body.username), 5);

  const right = await c.post("/api/login", { username: body.username, pin: "4321" });
  assert.equal(right.status, 429);
  assert.equal(c.cookie, "", "no session while locked out");
});

test("all 49 Forgot-PIN answers sent together: 5 are checked and no reset token comes back", async () => {
  const ref = (await srv.client().get("/api/reference-data")).json;
  const colours = ref.recoveryColours.map((x) => x.id);
  const subjects = ref.recoverySubjects.map((x) => x.id);
  assert.equal(colours.length * subjects.length, 49);

  // The real answer is the last pair sent. Only the Supabase run (TEST_DB=supabase)
  // shows this race on the old code: on PGlite each of these tries finished before
  // the next one started.
  const { body } = await signUp(srv.client(), {
    recoveryColourId: colours.at(-1),
    recoverySubjectId: subjects.at(-1),
  });
  const c = srv.client();
  const replies = await together(
    colours.flatMap((colour) =>
      subjects.map((subject) => () =>
        c.post("/api/recover/verify", { username: body.username, recoveryColourId: colour, recoverySubjectId: subject }),
      ),
    ),
  );
  assert.deepEqual(countStatuses(replies), { 401: 5, 429: 44 });
  assertLockouts(replies);
  assert.ok(replies.every((r) => r.json.resetToken === undefined), "no reset token");
  assert.equal(await failuresLogged(body.username), 5);
});

test("20 wrong current PINs sent together to change PIN: 5 are checked", async () => {
  const me = srv.client();
  const { body } = await signUp(me, { pin: "4321" });
  const replies = await together(
    Array.from({ length: 20 }, () => () => me.post("/api/me/pin", { currentPin: "0000", newPin: "5678" })),
  );
  assert.deepEqual(countStatuses(replies), { 401: 5, 429: 15 });
  assertLockouts(replies);
  assert.equal(await failuresLogged(body.username), 5);

  const right = await me.post("/api/me/pin", { currentPin: "4321", newPin: "5678" });
  assert.equal(right.status, 429, "locked out, so the PIN stays the same");
});

test("sign-in, Forgot PIN and change PIN share the turns, in any letter case", async () => {
  const me = srv.client();
  const { body } = await signUp(me, { pin: "4321", recoveryColourId: 2, recoverySubjectId: 2 });
  const name = body.username;
  const other = srv.client();
  const requests = [];
  for (let i = 0; i < 6; i++) {
    requests.push(
      () => other.post("/api/login", { username: name.toUpperCase(), pin: "0000" }),
      () => other.post("/api/login", { username: name, pin: "0000" }),
      () => other.post("/api/recover/verify", { username: name, recoveryColourId: 1, recoverySubjectId: 1 }),
      () => me.post("/api/me/pin", { currentPin: "0000", newPin: "5678" }),
    );
  }
  const replies = await together(requests);
  assert.deepEqual(countStatuses(replies), { 401: 5, 429: 19 });
  assertLockouts(replies);
  assert.equal(await failuresLogged(name), 5);
});

test("a try that fails still lets the next one go, and other usernames don't wait", async () => {
  const order = [];
  let finishFirst;
  const first = oneTryAtATime("Ava", () => new Promise((resolve) => (finishFirst = resolve)).then(() => order.push("ava 1")));
  const failing = oneTryAtATime("AVA", async () => {
    order.push("ava 2");
    throw new Error("database down");
  });
  const third = oneTryAtATime("ava", async () => order.push("ava 3"));

  await oneTryAtATime("Ben", async () => order.push("ben"));
  assert.deepEqual(order, ["ben"], "Ben's try didn't wait for Ava's");

  finishFirst();
  await first;
  await assert.rejects(failing, /database down/);
  await third;
  assert.deepEqual(order, ["ben", "ava 1", "ava 2", "ava 3"]);
});
