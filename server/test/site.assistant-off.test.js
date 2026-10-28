// ASSISTANT_DAILY_LIMIT=0 keeps the website's assistant off even when the
// lesson chat has a key (its own file: the limit is read when the server starts).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./helpers.js";

const realFetch = globalThis.fetch;
let geminiCalls = 0;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://generativelanguage.googleapis.com/")) geminiCalls += 1;
  return realFetch(url, init);
};

let srv;
before(async () => {
  process.env.ASSISTANT_DAILY_LIMIT = "0";
  srv = await startServer();
  process.env.GEMINI_API_KEY = "test-key";
});
after(async () => {
  globalThis.fetch = realFetch;
  await srv.close();
});

test("ASSISTANT_DAILY_LIMIT=0: the assistant says it's off and asks nobody", async () => {
  const res = await fetch(`${srv.base}/api/site/assistant`, {
    method: "POST",
    headers: { origin: "http://localhost:8000", "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", parts: [{ text: "Hello?" }] }] }),
  });
  assert.equal(res.status, 503);
  assert.equal(geminiCalls, 0);
});
