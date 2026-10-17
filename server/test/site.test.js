// On the host the website is its own static site (WEBSITE_URL), so the
// Academy sends old /site links there instead of serving a second copy.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./helpers.js";

let srv;
before(async () => {
  process.env.WEBSITE_URL = "https://projstemulate.com/";
  srv = await startServer();
});
after(async () => {
  await srv.close();
});

test("with WEBSITE_URL set, /site links redirect to the website", async () => {
  for (const [from, to] of [
    ["/site", "https://projstemulate.com/"],
    ["/site/", "https://projstemulate.com/"],
    ["/site/curriculum.html", "https://projstemulate.com/curriculum.html"],
  ]) {
    const res = await fetch(srv.base + from, { redirect: "manual" });
    assert.equal(res.status, 301, from);
    assert.equal(res.headers.get("location"), to, from);
  }
  // The API is unaffected.
  assert.equal((await srv.client().get("/api/reference-data")).status, 200);
});
