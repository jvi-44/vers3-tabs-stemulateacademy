// The website's sign-up forms: only from the website's own addresses, checked
// fields, a honeypot, form posts without JavaScript, and the admin list.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./helpers.js";

const PASSKEY = "test-admin-passkey-long-enough";
const SITE = "http://localhost:8000";

let srv;
let adminToken;
before(async () => {
  process.env.ADMIN_PASSKEY = PASSKEY;
  process.env.AUTH_RATE_LIMIT_PER_MIN = "1000";
  // The per-address limit has its own file (site.ratelimit.test.js).
  process.env.SIGNUPS_PER_15_MIN = "1000";
  srv = await startServer();
  adminToken = (await srv.client().post("/api/admin/login", { passkey: PASSKEY })).json.token;
});
after(async () => {
  await srv.close();
});

const signups = async () =>
  (await (await fetch(`${srv.base}/api/admin/signups`, { headers: { authorization: `Bearer ${adminToken}` } })).json()).signups;

function send(body, { origin = SITE, form = false } = {}) {
  return fetch(`${srv.base}/api/site/signup`, {
    method: "POST",
    redirect: "manual",
    headers: {
      ...(origin ? { origin } : {}),
      "content-type": form ? "application/x-www-form-urlencoded" : "application/json",
    },
    body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
  });
}

test("volunteer, partner and newsletter sign-ups are saved and listed", async () => {
  const before = (await signups()).length;
  let res = await send({
    kind: "volunteer", name: "Wei Ling", email: "weiling@example.org", school: "Raffles Institution",
    interests: ["workshops", "dev", "workshops"], message: "I love robotics.", organisation: "ignored", phone: "ignored too",
  });
  assert.deepEqual([res.status, await res.json()], [200, { success: true }]);
  res = await send({ kind: "partner", name: "Mr Lim", email: "lim@centre.sg", organisation: "Sunshine SCC", phone: "+65 6123 4567" });
  assert.equal(res.status, 200);
  res = await send({ kind: "chapter", name: "Aiko", email: "aiko@example.org", school: "Hillside Secondary", message: "Three of us want to start one." });
  assert.equal(res.status, 200);
  res = await send({ kind: "newsletter", email: "parent@example.org" });
  assert.equal(res.status, 200);
  // The same newsletter email twice is one subscriber.
  assert.equal((await send({ kind: "newsletter", email: "PARENT@example.org" })).status, 200);

  const list = await signups();
  assert.equal(list.length, before + 4);
  const [newsletter, chapter, partner, volunteer] = list;
  assert.deepEqual([chapter.kind, chapter.school, chapter.phone, chapter.organisation], ["chapter", "Hillside Secondary", null, null]);
  assert.deepEqual(
    [volunteer.kind, volunteer.name, volunteer.school, volunteer.interests, volunteer.organisation, volunteer.phone, volunteer.message],
    ["volunteer", "Wei Ling", "Raffles Institution", "workshops, dev", null, null, "I love robotics."],
  );
  assert.deepEqual([partner.kind, partner.organisation, partner.phone, partner.school], ["partner", "Sunshine SCC", "+65 6123 4567", null]);
  assert.deepEqual([newsletter.kind, newsletter.email, newsletter.name, newsletter.message], ["newsletter", "parent@example.org", null, null]);
  assert.deepEqual(Object.keys(volunteer).sort(), [
    "createdAt", "email", "interests", "kind", "message", "name", "organisation", "phone", "school", "signupId",
  ]);
});

test("bad sign-ups are refused with the field to fix", async () => {
  for (const [body, field] of [
    [{ kind: "volunteer", name: "A", email: "nope" }, "email"],
    [{ kind: "volunteer", email: "a@example.org" }, "name"],
    [{ kind: "partner", name: "A", email: "a@example.org" }, "organisation"],
    [{ kind: "partner", name: "A", email: "a@example.org", organisation: "B", phone: "call me" }, "phone"],
    [{ kind: "volunteer", name: "A", email: "a@example.org", interests: ["hacking"] }, "interests"],
    [{ kind: "volunteer", name: "x".repeat(81), email: "a@example.org" }, "name"],
    [{ kind: "spam", email: "a@example.org" }, "kind"],
    [{ kind: "constructor", email: "a@example.org" }, "kind"],
    [{ kind: "__proto__", email: "a@example.org" }, "kind"],
    // Nothing that could add to the admin page's mailto: link.
    [{ kind: "newsletter", email: "a@x.co?bcc=attacker%40evil.example" }, "email"],
    [{ kind: "newsletter", email: "a@x.co&body=hello" }, "email"],
    [{ kind: "newsletter", email: "a b@example.org" }, "email"],
    [{ kind: "newsletter", email: "<a>@example.org" }, "email"],
    [{ kind: "newsletter", email: "a@example" }, "email"],
  ]) {
    const res = await send(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal((await res.json()).field, field, JSON.stringify(body));
  }
});

test("ordinary addresses are accepted, apostrophes and all", async () => {
  for (const email of ["a+tag@gmail.com", "First.Last@Mail.School.edu.sg", "a-b@my-school.edu.sg", "x@example.academy", "mary.o'brien@school.ie"]) {
    const res = await send({ kind: "newsletter", email });
    assert.equal(res.status, 200, email);
  }
});

test("without JavaScript a line break counts once, as the browser counted it", async () => {
  // 10 lines of 99 letters: 999 characters as the page counts them, 1009 with the \r\n a form post sends.
  const message = Array.from({ length: 10 }, () => "a".repeat(99)).join("\r\n");
  const res = await send({ kind: "volunteer", name: "Lines", email: "lines@example.org", message }, { form: true });
  assert.equal(res.headers.get("location"), "/site/get-involved.html#volunteer-sent");
  const [row] = (await signups()).filter((s) => s.email === "lines@example.org");
  assert.equal(row.message, Array.from({ length: 10 }, () => "a".repeat(99)).join("\n"));
});

test("without JavaScript every refusal comes back to the form", async () => {
  const post = (query, body, headers = {}) =>
    fetch(`${srv.base}/api/site/signup${query}`, {
      method: "POST",
      redirect: "manual",
      headers: { origin: SITE, "content-type": "application/x-www-form-urlencoded", ...headers },
      body,
    });
  // A browser that hides where the form was (Origin: null).
  let res = await post("?kind=partner", "kind=partner&name=A&email=a%40example.org&organisation=B", { origin: "null" });
  assert.deepEqual([res.status, res.headers.get("location")], [303, "/site/get-involved.html#partner-error"]);
  // Too long to read: the form's address still says which form it was.
  res = await post("?kind=chapter", `kind=chapter&message=${"x".repeat(11_000)}`);
  assert.deepEqual([res.status, res.headers.get("location")], [303, "/site/get-involved.html#chapter-error"]);
  // A database error.
  await srv.sql("ALTER FUNCTION stem_site_signup_add(text, text, text, text, text, text, text, text) RENAME TO stem_site_signup_add_off");
  try {
    res = await post("", "kind=newsletter&email=down%40example.org");
    assert.deepEqual([res.status, res.headers.get("location")], [303, "/site/get-involved.html#newsletter-error"]);
  } finally {
    await srv.sql("ALTER FUNCTION stem_site_signup_add_off(text, text, text, text, text, text, text, text) RENAME TO stem_site_signup_add");
  }
  // JSON callers still get JSON.
  res = await send({ kind: "volunteer", name: "A", email: "a@example.org" }, { origin: "https://evil.example" });
  assert.deepEqual([res.status, await res.json()], [403, { error: "Not allowed." }]);
});

test("only the website's addresses may send", async () => {
  const before = (await signups()).length;
  for (const origin of [null, "https://evil.example", "https://projstemulate.com.evil.example"]) {
    const res = await send({ kind: "newsletter", email: "x@example.org" }, { origin });
    assert.equal(res.status, 403, String(origin));
  }
  assert.equal((await signups()).length, before);

  // The browser's preflight for the website's own address is answered.
  const ok = await fetch(`${srv.base}/api/site/signup`, {
    method: "OPTIONS",
    headers: { origin: SITE, "access-control-request-method": "POST", "access-control-request-headers": "content-type" },
  });
  assert.equal(ok.headers.get("access-control-allow-origin"), SITE);
  assert.equal(ok.headers.get("access-control-allow-credentials"), null);
  const evil = await fetch(`${srv.base}/api/site/signup`, {
    method: "OPTIONS",
    headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
  });
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
});

test("a sign-up over 10 kB is refused", async () => {
  const res = await send({ kind: "volunteer", name: "A", email: "a@example.org", extra: "x".repeat(11_000) });
  assert.equal(res.status, 413);
});

test("the honeypot field pretends to work and saves nothing", async () => {
  const before = (await signups()).length;
  const res = await send({ kind: "newsletter", email: "bot@example.org", website: "http://spam.example" });
  assert.deepEqual([res.status, await res.json()], [200, { success: true }]);
  assert.equal((await signups()).length, before);
});

test("without JavaScript the form posts and comes back to the page", async () => {
  const before = (await signups()).length;
  let res = await send({ kind: "partner", name: "Ms Goh", email: "goh@example.org", organisation: "Hope Centre" }, { form: true });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("location"), "/site/get-involved.html#partner-sent");
  res = await send({ kind: "partner", name: "Ms Goh", email: "bad" }, { form: true });
  assert.equal(res.headers.get("location"), "/site/get-involved.html#partner-error");
  // Several ticked boxes arrive as repeated fields.
  const params = new URLSearchParams([["kind", "volunteer"], ["name", "Ana"], ["email", "ana@example.org"], ["interests", "graphics"], ["interests", "curriculum"]]);
  res = await fetch(`${srv.base}/api/site/signup`, {
    method: "POST",
    redirect: "manual",
    headers: { origin: SITE, "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  assert.equal(res.status, 303);
  const list = await signups();
  assert.equal(list.length, before + 2);
  assert.equal(list[0].interests, "graphics, curriculum");
});

test("an admin can delete a sign-up", async () => {
  const [latest] = await signups();
  const del = (id) =>
    fetch(`${srv.base}/api/admin/signups/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal((await del(latest.signupId)).status, 200);
  assert.ok(!(await signups()).some((s) => s.signupId === latest.signupId));
  assert.equal((await del(latest.signupId)).status, 404);
  assert.equal((await fetch(`${srv.base}/api/admin/signups`)).status, 401);
  const { activity } = await (await fetch(`${srv.base}/api/admin/activity`, { headers: { authorization: `Bearer ${adminToken}` } })).json();
  assert.deepEqual([activity[0].staffName, activity[0].action], ["Admin passkey", "deleted a website sign-up"]);
});

test("sign-ups older than 12 months are deleted; newsletter emails stay", async () => {
  await srv.sql(`INSERT INTO site_signups (kind, name, email, created_at) VALUES
    ('volunteer', 'Old Volunteer', 'old.volunteer@example.org', now() - interval '13 months'),
    ('newsletter', NULL, 'old.reader@example.org', now() - interval '13 months')`);
  const emails = (await signups()).map((s) => s.email);
  assert.ok(!emails.includes("old.volunteer@example.org"));
  assert.ok(emails.includes("old.reader@example.org"));
  assert.deepEqual(await srv.sql("SELECT 1 FROM site_signups WHERE email = 'old.volunteer@example.org'"), []);
});
