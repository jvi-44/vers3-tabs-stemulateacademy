// The lesson chat when Gemini runs out: the key's Render name (GEMINI_API),
// the fallback model, and the hint the student gets when every model is out.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startServer, signUp } from "./helpers.js";
import { resetGeminiCooldowns } from "../gemini.js";

const realFetch = globalThis.fetch;
const calls = [];
// Model name -> HTTP status it answers with (200 when not listed).
let statusFor = {};
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://generativelanguage.googleapis.com/")) {
    const model = decodeURIComponent(String(url).match(/models\/([^:]+):/)[1]);
    calls.push({ model, key: init.headers["x-goog-api-key"] });
    const status = statusFor[model] ?? 200;
    if (status !== 200) return new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }), { status });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: `from ${model}` }] } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(url, init);
};

let srv;
let kid;
before(async () => {
  srv = await startServer();
  delete process.env.GEMINI_API_KEY;
  process.env.GEMINI_API = "render-name-key";
  kid = srv.client();
  await signUp(kid);
});
beforeEach(() => {
  calls.length = 0;
  statusFor = {};
  resetGeminiCooldowns();
});
after(async () => {
  globalThis.fetch = realFetch;
  delete process.env.GEMINI_API;
  await srv.close();
});

const ask = { beatId: "mm-sci1-video", messages: [{ role: "user", parts: [{ text: "What is a cycle?" }] }] };

test("a key saved as GEMINI_API switches the chat on", async () => {
  const res = await kid.post("/api/chat", ask);
  assert.equal(res.status, 200);
  assert.equal(res.json.reply, "from gemini-2.5-flash");
  assert.equal(calls[0].key, "render-name-key");
});

test("out of quota on the main model -> the fallback model answers", async () => {
  statusFor = { "gemini-2.5-flash": 429 };
  const res = await kid.post("/api/chat", ask);
  assert.equal(res.status, 200);
  assert.equal(res.json.reply, "from gemini-2.5-flash-lite");
  // The used-up model is skipped for a while instead of being hit every time.
  await kid.post("/api/chat", ask);
  assert.deepEqual(calls.map((c) => c.model), ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash-lite"]);
});

test("an overloaded main model (503) also falls back", async () => {
  statusFor = { "gemini-2.5-flash": 503 };
  const res = await kid.post("/api/chat", ask);
  assert.equal(res.status, 200);
  assert.equal(res.json.reply, "from gemini-2.5-flash-lite");
});

test("every model out of quota -> 429 with a hint from the lesson, not a blank", async () => {
  statusFor = { "gemini-2.5-flash": 429, "gemini-2.5-flash-lite": 429 };
  const res = await kid.post("/api/chat", ask);
  assert.equal(res.status, 429);
  assert.equal(res.json.fallback, true);
  assert.match(res.json.reply, /quick break, so here's a hint/);
  assert.match(res.json.reply, /Ask me again in a minute!$/);
  // While both cool down, no further calls go to Google.
  calls.length = 0;
  assert.equal((await kid.post("/api/chat", ask)).status, 429);
  assert.equal(calls.length, 0);
});

test("a student over the hourly limit gets a friendly reply", async () => {
  const other = srv.client();
  await signUp(other);
  let res;
  for (let i = 0; i < 31; i++) res = await other.post("/api/chat", ask);
  assert.equal(res.status, 429);
  assert.match(res.json.reply, /lots of great questions/);
});
