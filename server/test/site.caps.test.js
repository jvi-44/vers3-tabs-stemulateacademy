// Caps for everyone together (website sign-ups an hour, the assistant's answers
// a day) are counted in the database, so they still hold after the free server
// sleeps and restarts. Their own file, with low caps.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./helpers.js";

const SITE = "http://localhost:8000";

// Intercept the server's outgoing Gemini calls (same process), as chat.test.js does.
const realFetch = globalThis.fetch;
let geminiCalls = 0;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://generativelanguage.googleapis.com/")) {
    geminiCalls += 1;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Hello!" }] } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(url, init);
};

let srv;
before(async () => {
  process.env.SIGNUPS_PER_15_MIN = "1000";
  process.env.SIGNUPS_PER_HOUR = "2";
  process.env.ASSISTANT_DAILY_LIMIT = "1";
  srv = await startServer();
});
after(async () => {
  globalThis.fetch = realFetch;
  await srv.close();
});

function volunteer(email, { form = false } = {}) {
  const body = { kind: "volunteer", name: "Ana", email };
  return fetch(`${srv.base}/api/site/signup`, {
    method: "POST",
    redirect: "manual",
    headers: { origin: SITE, "content-type": form ? "application/x-www-form-urlencoded" : "application/json" },
    body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
  });
}

const uses = async (name) =>
  (await srv.sql("SELECT coalesce(sum(uses), 0)::int AS n FROM site_counters WHERE name = $1", [name]))[0].n;

/** Sets `name`'s count in the window `offset` windows from the current one. */
const seed = (name, seconds, offset, count) =>
  srv.sql(
    `INSERT INTO site_counters (name, window_start, uses)
     VALUES ($1, to_timestamp((floor(extract(epoch FROM now()) / $2) + $3) * $2), $4)
     ON CONFLICT (name, window_start) DO UPDATE SET uses = EXCLUDED.uses`,
    [name, seconds, offset, count],
  );

test("each sign-up is counted in the database; refused ones aren't", async () => {
  await srv.sql("DELETE FROM site_counters");
  assert.equal((await volunteer("one@example.org")).status, 200);
  assert.equal((await volunteer("not an email")).status, 400);
  assert.equal(await uses("signups"), 1);
});

test("a full hour refuses sign-ups; the hour before doesn't count", async () => {
  await srv.sql("DELETE FROM site_counters");
  // The last hour was full: this hour starts again.
  await seed("signups", 3600, -1, 2);
  assert.equal((await volunteer("two@example.org")).status, 200);
  // This hour (and the next, should it start meanwhile) is full.
  await seed("signups", 3600, 0, 2);
  await seed("signups", 3600, 1, 2);
  const refused = await volunteer("three@example.org");
  assert.equal(refused.status, 429);
  assert.match((await refused.json()).error, /a lot of sign-ups/);
  // Without JavaScript: back to the form's error box.
  const form = await volunteer("four@example.org", { form: true });
  assert.deepEqual([form.status, form.headers.get("location")], [303, "/site/get-involved.html#volunteer-error"]);
  assert.deepEqual((await srv.sql("SELECT email FROM site_signups ORDER BY signup_id")).map((r) => r.email), ["one@example.org", "two@example.org"]);
});

test("the assistant stops after ASSISTANT_DAILY_LIMIT questions a day", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  const ask = () =>
    fetch(`${srv.base}/api/site/assistant`, {
      method: "POST",
      headers: { origin: SITE, "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", parts: [{ text: "Can I volunteer?" }] }] }),
    });
  await srv.sql("DELETE FROM site_counters");
  await seed("assistant", 86400, -1, 1);
  assert.equal((await ask()).status, 200);
  assert.equal(geminiCalls, 1);
  await seed("assistant", 86400, 0, 1);
  await seed("assistant", 86400, 1, 1);
  const refused = await ask();
  assert.equal(refused.status, 429);
  assert.match((await refused.json()).error, /resting for today/);
  assert.equal(geminiCalls, 1);
});

test("caps from the environment must be whole numbers", async () => {
  // Imported now: db.js picks the database when it loads (helpers.js).
  const { envCount } = await import("../routes/site.js");
  const warn = console.warn;
  console.warn = () => {};
  try {
    const read = (value, min) => {
      process.env.TEST_CAP = value;
      return envCount("TEST_CAP", 7, min);
    };
    assert.deepEqual(
      ["", " 12 ", "0", "1.5", "1e10", "-1", "Infinity", "ten"].map((v) => read(v)),
      [7, 12, 7, 7, 7, 7, 7, 7],
    );
    assert.equal(read("0", 0), 0);
  } finally {
    console.warn = warn;
    delete process.env.TEST_CAP;
  }
});
