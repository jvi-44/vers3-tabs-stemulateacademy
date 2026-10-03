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

test("opening a pack deducts atoms and persists cards; insufficient atoms returns 400", async (t) => {
  const kid = srv.client();
  const { json } = await signUp(kid);
  const userId = json.user.userId;

  await t.test("a new account (0 atoms) can't open a pack", async () => {
    const res = await kid.post("/api/packs/open", { albumKey: "phenomena", packId: "phen-p1" });
    assert.equal(res.status, 400);
    assert.deepEqual((await kid.get("/api/cards")).json.owned, {});
  });

  await t.test("unknown or malformed packs are rejected", async () => {
    for (const body of [
      { albumKey: "phenomena", packId: "nope" },
      { albumKey: "__proto__", packId: "phen-p1" },
      { albumKey: ["phenomena"], packId: "phen-p1" },
      {},
    ]) {
      assert.equal((await kid.post("/api/packs/open", body)).status, 400);
    }
  });

  await t.test("opening a pack charges the cost and stores the cards", async () => {
    srv.db.prepare("UPDATE users SET atoms = 200 WHERE user_id = ?").run(userId);

    const res = await kid.post("/api/packs/open", { albumKey: "phenomena", packId: "phen-p1" });
    assert.equal(res.status, 200);
    assert.equal(res.json.atoms, 150);
    assert.equal(res.json.cards.length, 2);
    for (const id of res.json.cards) assert.match(id, /^phen-\d+$/);

    // "Refresh": everything comes back from the server.
    const me = await kid.get("/api/user/me");
    assert.equal(me.json.user.atoms, 150);
    const { owned } = (await kid.get("/api/cards")).json;
    const total = Object.values(owned).reduce((a, b) => a + b, 0);
    assert.equal(total, 2);
    for (const id of res.json.cards) assert.ok(owned[id] >= 1);
  });

  await t.test("can't overspend", async () => {
    // 150 atoms left: the 150-atom Legends pack works once, then 0 atoms.
    const ok = await kid.post("/api/packs/open", { albumKey: "figures", packId: "fig-p2" });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.atoms, 0);
    const broke = await kid.post("/api/packs/open", { albumKey: "figures", packId: "fig-p1" });
    assert.equal(broke.status, 400);
    assert.equal((await kid.get("/api/user/me")).json.user.atoms, 0);
  });

  await t.test("cards belong to their owner only", async () => {
    const other = srv.client();
    await signUp(other);
    assert.deepEqual((await other.get("/api/cards")).json.owned, {});
  });
});
