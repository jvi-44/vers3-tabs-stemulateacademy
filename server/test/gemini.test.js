// The Gemini helpers on their own: how much each model may think, and what a
// conversation may hold.
import { test } from "node:test";
import assert from "node:assert/strict";
import { geminiContents, thinkingFor } from "../gemini.js";

test("thinking is switched off where it can be, and turned down with room elsewhere", () => {
  assert.deepEqual(thinkingFor("gemini-2.5-flash"), { config: { thinkingBudget: 0 }, room: 0 });
  assert.deepEqual(thinkingFor("gemini-2.5-flash-lite"), { config: { thinkingBudget: 0 }, room: 0 });
  assert.deepEqual(thinkingFor("gemini-2.5-pro"), { config: { thinkingBudget: 128 }, room: 256 });
  for (const model of ["gemini-3-pro-preview", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-4-argon"]) {
    assert.deepEqual(thinkingFor(model), { config: { thinkingLevel: "low" }, room: 1024 }, model);
  }
  // Unknown names (aliases, older models) get no setting, only the room.
  for (const model of ["gemini-flash-latest", "gemini-2.0-flash"]) {
    assert.deepEqual(thinkingFor(model), { config: null, room: 1024 }, model);
  }
});

test("model turns get their own limit only when asked for", () => {
  const talk = (reply) => [
    { role: "user", parts: [{ text: "hi" }] },
    { role: "model", parts: [{ text: reply }] },
    { role: "user", parts: [{ text: "more" }] },
  ];
  assert.equal(geminiContents(talk("x".repeat(501)), { maxMessages: 10, maxChars: 500 }), null);
  assert.equal(geminiContents(talk("x".repeat(2000)), { maxMessages: 10, maxChars: 400, maxModelChars: 2000 }).length, 3);
  assert.equal(geminiContents(talk("x".repeat(2001)), { maxMessages: 10, maxChars: 400, maxModelChars: 2000 }), null);
});
