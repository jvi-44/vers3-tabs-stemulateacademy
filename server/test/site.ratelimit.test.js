// The website's sign-up form takes at most 30 sign-ups per 15 minutes from one
// address, enough for a class after a school talk (its own file, so the other
// tests can raise the limit).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./helpers.js";

let srv;
before(async () => {
  delete process.env.SIGNUPS_PER_15_MIN;
  srv = await startServer();
});
after(async () => {
  await srv.close();
});

test("the 31st sign-up in 15 minutes from one address -> 429", async () => {
  const statuses = [];
  for (let i = 0; i < 31; i += 1) {
    const res = await fetch(`${srv.base}/api/site/signup`, {
      method: "POST",
      headers: { origin: "http://localhost:8000", "content-type": "application/json" },
      body: JSON.stringify({ kind: "newsletter", email: `reader${i}@example.org` }),
    });
    statuses.push(res.status);
  }
  assert.deepEqual(statuses, [...Array(30).fill(200), 429]);
});

test("without JavaScript, a refused sign-up goes back to the form's error box", async () => {
  const res = await fetch(`${srv.base}/api/site/signup`, {
    method: "POST",
    redirect: "manual",
    headers: { origin: "http://localhost:8000", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ kind: "newsletter", email: "late@example.org" }).toString(),
  });
  assert.deepEqual([res.status, res.headers.get("location")], [303, "/site/get-involved.html#newsletter-error"]);
});
