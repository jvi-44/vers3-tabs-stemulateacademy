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

test("story choices are saved per student and checked", async (t) => {
  const kid = srv.client();
  const signed = await signUp(kid);

  await t.test("needs a signed-in student", async () => {
    const guest = srv.client();
    assert.equal((await guest.get("/api/story")).status, 401);
    assert.equal((await guest.put("/api/story/mm-intro", { choices: { buddy: "emily" } })).status, 401);
  });

  await t.test("saves, updates and reads back", async () => {
    assert.deepEqual((await kid.get("/api/story")).json, { choices: {} });
    const first = await kid.put("/api/story/mm-intro", { choices: { buddy: "emily", sorterWon: true, matterSorterScore: 80 } });
    assert.equal(first.status, 200);
    await kid.put("/api/story/mm-intro", { choices: { buddy: "sophia" } });
    await kid.put("/api/story/sb-intro", { choices: { lead: "you" } });
    assert.deepEqual((await kid.get("/api/story")).json.choices, { "mm-intro": { buddy: "sophia" }, "sb-intro": { lead: "you" } });
  });

  await t.test("rejects unknown episodes and odd values", async () => {
    assert.equal((await kid.put("/api/story/mm-quiz", { choices: {} })).status, 400);
    assert.equal((await kid.put("/api/story/mm-intro", { choices: { buddy: { nested: 1 } } })).status, 400);
    assert.equal((await kid.put("/api/story/mm-intro", { choices: { "bad key": 1 } })).status, 400);
    assert.equal((await kid.put("/api/story/mm-intro", { choices: { buddy: "x".repeat(40) } })).status, 400);
    assert.equal((await kid.put("/api/story/mm-intro", { choices: ["emily"] })).status, 400);
  });

  await t.test("included in the data export and removed with the account", async () => {
    const exp = await kid.get("/api/me/export");
    assert.equal(exp.json.storyChoices.length, 2);
    const del = await kid.del("/api/me", { pin: signed.body.pin });
    assert.equal(del.status, 200);
    const left = srv.db.prepare("SELECT COUNT(*) AS n FROM story_choices").get().n;
    assert.equal(left, 0);
  });
});
