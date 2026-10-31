// The staff page: one passkey per centre, set by an admin, shared by the
// centre's staff, and only ever showing that centre's students.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { startServer, signUp } from "./helpers.js";

const PASSKEY = "test-admin-passkey-long-enough";
const WRONG = "not-the-passkey-at-all";

let srv;
let adminToken;
before(async () => {
  process.env.ADMIN_PASSKEY = PASSKEY;
  process.env.AUTH_RATE_LIMIT_PER_MIN = "1000";
  srv = await startServer();
  adminToken = (await srv.client().post("/api/admin/login", { passkey: PASSKEY })).json.token;
});
after(async () => {
  await srv.close();
});

async function admin(method, path, body) {
  const res = await fetch(`${srv.base}/api/admin${path}`, {
    method,
    headers: { authorization: `Bearer ${adminToken}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

let counter = 0;
/** A new centre of its own (so tests don't sign each other out), with a passkey. */
async function addCentre({ passkey = true } = {}) {
  counter += 1;
  const res = await admin("POST", "/centres", { name: `Test Centre ${process.pid} ${counter}` });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const centre = res.json.centre;
  const key = passkey ? (await admin("POST", `/centres/${centre.id}/passkey`)).json.passkey : null;
  return { ...centre, passkey: key };
}

/** A client signed in for `centre`. */
async function signedIn(centre) {
  const client = srv.client();
  const res = await client.post("/api/staff/login", { centreId: centre.id, passkey: centre.passkey });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  return client;
}

/** A centre, a client signed in for it, and a student there. */
async function centreWithStudent() {
  const centre = await addCentre();
  const kid = await signUp(srv.client(), { orgId: centre.id });
  assert.equal(kid.status, 201, JSON.stringify(kid.json));
  return { centre, client: await signedIn(centre), kidId: kid.json.user.userId, kid };
}

test("an admin lists and adds centres", async (t) => {
  await t.test("the list leaves out \"Other\" and counts each centre's students", async () => {
    const centre = await addCentre({ passkey: false });
    await signUp(srv.client(), { orgId: centre.id });
    const { centres } = (await admin("GET", "/centres")).json;
    assert.ok(!centres.some((c) => c.name === "Other"));
    const mine = centres.find((c) => c.id === centre.id);
    assert.deepEqual(mine, { id: centre.id, name: centre.name, hasPasskey: false, passkeySetAt: null, students: 1 });
  });

  await t.test("a new centre is offered at sign-up", async () => {
    const res = await admin("POST", "/centres", { name: "  Little   Stars  Hub " });
    assert.equal(res.json.centre.name, "Little Stars Hub");
    const ref = (await srv.client().get("/api/reference-data")).json;
    assert.ok(ref.organisations.some((o) => o.id === res.json.centre.id && o.name === "Little Stars Hub"));
  });

  await t.test("names already listed (ignoring case), empty or too long are refused", async () => {
    for (const name of ["little stars hub", "OTHER", "", "   ", "x".repeat(81)]) {
      assert.equal((await admin("POST", "/centres", { name })).status, 400, name);
    }
  });

  await t.test("only the admin passkey can", async () => {
    const { client } = await centreWithStudent();
    assert.equal((await client.get("/api/admin/centres")).status, 401);
    assert.equal((await srv.client().post("/api/admin/centres", { name: "Sneaky" })).status, 401);
  });
});

test("an admin sets, changes and turns off a centre's passkey", async (t) => {
  await t.test("a new random passkey is easy to read out, and only its hash is kept", async () => {
    const centre = await addCentre();
    assert.match(centre.passkey, /^[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}$/);
    const [row] = await srv.sql("SELECT passkey_hash, passkey_set_at FROM organisations WHERE org_id = $1", [centre.id]);
    assert.notEqual(row.passkey_hash, centre.passkey);
    assert.ok(await bcrypt.compare(centre.passkey, row.passkey_hash));
    assert.ok(row.passkey_set_at);
    const listed = (await admin("GET", "/centres")).json.centres.find((c) => c.id === centre.id);
    assert.equal(listed.hasPasskey, true);
  });

  await t.test("an admin can type their own passkey", async () => {
    const centre = await addCentre({ passkey: false });
    const res = await admin("POST", `/centres/${centre.id}/passkey`, { passkey: "StemulateNewLife2026" });
    assert.deepEqual(res.json, { passkey: "StemulateNewLife2026" });
    assert.equal((await srv.client().post("/api/staff/login", { centreId: centre.id, passkey: "StemulateNewLife2026" })).status, 200);
  });

  await t.test("short, padded or over-long passkeys are refused", async () => {
    const centre = await addCentre({ passkey: false });
    for (const passkey of ["short", " padded-passkey", "padded-passkey ", "é".repeat(37)]) {
      assert.equal((await admin("POST", `/centres/${centre.id}/passkey`, { passkey })).status, 400, passkey);
    }
  });

  await t.test("\"Other\" and unknown centres have no passkey", async () => {
    const [{ org_id: other }] = await srv.sql("SELECT org_id FROM organisations WHERE org_name = 'Other'");
    for (const id of [Number(other), 999999, "abc"]) {
      assert.equal((await admin("POST", `/centres/${id}/passkey`)).status, 404, String(id));
      assert.equal((await admin("DELETE", `/centres/${id}/passkey`)).status, 404, String(id));
    }
  });

  await t.test("a new passkey signs everyone out, and the old one stops working", async () => {
    const centre = await addCentre();
    const client = await signedIn(centre);
    const fresh = (await admin("POST", `/centres/${centre.id}/passkey`)).json.passkey;
    assert.equal((await client.get("/api/staff/me")).status, 401);
    assert.equal((await srv.client().post("/api/staff/login", { centreId: centre.id, passkey: centre.passkey })).status, 401);
    assert.equal((await srv.client().post("/api/staff/login", { centreId: centre.id, passkey: fresh })).status, 200);
  });

  await t.test("turning a passkey off signs everyone out until a new one is set", async () => {
    const centre = await addCentre();
    const client = await signedIn(centre);
    assert.equal((await admin("DELETE", `/centres/${centre.id}/passkey`)).status, 200);
    assert.equal((await client.get("/api/staff/me")).status, 401);
    assert.equal((await srv.client().post("/api/staff/login", { centreId: centre.id, passkey: centre.passkey })).status, 401);
    const listed = (await admin("GET", "/centres")).json.centres.find((c) => c.id === centre.id);
    assert.deepEqual([listed.hasPasskey, listed.passkeySetAt], [false, null]);
  });
});

test("signing in with a centre's passkey", async (t) => {
  await t.test("the right passkey signs in as that centre", async () => {
    const centre = await addCentre();
    const client = srv.client();
    const res = await client.post("/api/staff/login", { centreId: centre.id, passkey: centre.passkey });
    assert.deepEqual(res.json, { centre: { id: centre.id, name: centre.name } });
    assert.deepEqual((await client.get("/api/staff/me")).json, { centre: { id: centre.id, name: centre.name } });
  });

  await t.test("the cookie is httpOnly, strict, only sent to the API and gone when the browser closes", async () => {
    const centre = await addCentre();
    const res = await fetch(`${srv.base}/api/staff/login`, {
      method: "POST",
      headers: { origin: "http://localhost:5173", "content-type": "application/json" },
      body: JSON.stringify({ centreId: centre.id, passkey: centre.passkey }),
    });
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("stem_staff="));
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.match(cookie, /Path=\/api/);
    assert.doesNotMatch(cookie, /Max-Age|Expires/i);
  });

  await t.test("a wrong passkey, another centre's passkey and a centre without one get the same answer", async () => {
    const one = await addCentre();
    const two = await addCentre();
    const none = await addCentre({ passkey: false });
    const answers = [];
    for (const [centreId, passkey] of [[one.id, WRONG], [one.id, two.passkey], [none.id, WRONG]]) {
      const res = await srv.client().post("/api/staff/login", { centreId, passkey });
      answers.push([res.status, res.json.error]);
    }
    assert.equal(new Set(answers.map(String)).size, 1, JSON.stringify(answers));
    assert.equal(answers[0][0], 401);
  });

  await t.test("no centre, \"Other\" or an unknown centre is refused", async () => {
    const [{ org_id: other }] = await srv.sql("SELECT org_id FROM organisations WHERE org_name = 'Other'");
    for (const centreId of [undefined, 0, Number(other), 999999, "1; drop"]) {
      assert.equal((await srv.client().post("/api/staff/login", { centreId, passkey: WRONG })).status, 400, String(centreId));
    }
  });

  await t.test("signing out ends the session", async () => {
    const centre = await addCentre();
    const client = await signedIn(centre);
    assert.equal((await client.post("/api/staff/logout")).status, 200);
    assert.equal((await client.get("/api/staff/me")).status, 401);
  });
});

test("wrong passkeys and the lockout", async (t) => {
  await t.test("5 wrong tries from one address lock that centre for it, even with the right passkey", async () => {
    const centre = await addCentre();
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await srv.client().post("/api/staff/login", { centreId: centre.id, passkey: WRONG })).status, 401);
    }
    assert.equal((await srv.client().post("/api/staff/login", { centreId: centre.id, passkey: centre.passkey })).status, 429);
    // Other centres aren't affected.
    const other = await addCentre();
    assert.equal((await srv.client().post("/api/staff/login", { centreId: other.id, passkey: other.passkey })).status, 200);
  });

  await t.test("30 wrong tries for a centre from anywhere lock it too", async () => {
    const centre = await addCentre();
    await srv.sql(
      "INSERT INTO centre_login_attempts (org_id, client, success) SELECT $1, 'elsewhere-' || g, false FROM generate_series(1, 30) g",
      [centre.id],
    );
    assert.equal((await srv.client().post("/api/staff/login", { centreId: centre.id, passkey: centre.passkey })).status, 429);
  });

  await t.test("wrong tries sent at the same moment can't get past the lockout", async () => {
    const centre = await addCentre();
    const burst = await Promise.all(
      Array.from({ length: 12 }, () => srv.client().post("/api/staff/login", { centreId: centre.id, passkey: WRONG })),
    );
    assert.equal(burst.filter((r) => r.status === 401).length, 5);
    assert.equal(burst.filter((r) => r.status === 429).length, 7);
  });

  await t.test("a right passkey doesn't count as a wrong try, and only a hash of the address is kept", async () => {
    const centre = await addCentre();
    for (let i = 0; i < 6; i += 1) await signedIn(centre);
    const rows = await srv.sql("SELECT client, success FROM centre_login_attempts WHERE org_id = $1", [centre.id]);
    assert.equal(rows.length, 6);
    assert.ok(rows.every((r) => r.success && /^[0-9a-f]{64}$/.test(r.client)));
  });
});

test("a centre only ever sees its own students", async (t) => {
  const a = await centreWithStudent();
  const b = await centreWithStudent();

  await t.test("the list holds only its students, with the admin list's fields", async () => {
    const { students } = (await a.client.get("/api/staff/students")).json;
    assert.deepEqual(students.map((s) => s.userId), [a.kidId]);
    const fromAdmin = (await admin("GET", "/users")).json.users.find((u) => u.userId === a.kidId);
    assert.deepEqual(students[0], fromAdmin);
  });

  await t.test("progress and PIN resets for another centre's student answer 404", async () => {
    assert.equal((await a.client.get(`/api/staff/students/${b.kidId}/progress`)).status, 404);
    assert.equal((await a.client.post(`/api/staff/students/${b.kidId}/reset-pin`, { pin: "1111" })).status, 404);
    assert.equal((await a.client.get("/api/staff/students/abc/progress")).status, 404);
  });

  await t.test("a forgotten PIN can be reset for their own student", async () => {
    assert.equal((await a.client.get(`/api/staff/students/${a.kidId}/progress`)).status, 200);
    assert.equal((await a.client.post(`/api/staff/students/${a.kidId}/reset-pin`, { pin: "12" })).status, 400);
    assert.equal((await a.client.post(`/api/staff/students/${a.kidId}/reset-pin`, { pin: "2468" })).status, 200);
    assert.equal((await srv.client().post("/api/login", { username: a.kid.body.username, pin: "2468" })).status, 200);
  });

  await t.test("moving a student to another centre moves who can see them", async () => {
    const sees = async (c, id) => (await c.get("/api/staff/students")).json.students.some((s) => s.userId === id);
    assert.equal((await admin("PATCH", `/users/${a.kidId}/centre`, { orgId: b.centre.id })).status, 200);
    assert.deepEqual([await sees(a.client, a.kidId), await sees(b.client, a.kidId)], [false, true]);
    assert.equal((await admin("PATCH", `/users/${a.kidId}/centre`, { orgOther: "Somewhere Else" })).status, 200);
    assert.deepEqual([await sees(a.client, a.kidId), await sees(b.client, a.kidId)], [false, false]);
  });

  await t.test("no staff route works signed out, and a centre can't open the admin page", async () => {
    const out = srv.client();
    for (const path of ["/api/staff/me", "/api/staff/students", `/api/staff/students/${b.kidId}/progress`]) {
      assert.equal((await out.get(path)).status, 401, path);
    }
    assert.equal((await out.post(`/api/staff/students/${b.kidId}/reset-pin`, { pin: "1111" })).status, 401);
    assert.equal((await b.client.get("/api/admin/users")).status, 401);
  });
});

test("the activity log names the centre's passkey and the admin passkey", async () => {
  const { centre, client, kidId, kid } = await centreWithStudent();
  await client.get("/api/staff/students");
  await client.get("/api/staff/students");
  await client.get(`/api/staff/students/${kidId}/progress`);
  await client.post(`/api/staff/students/${kidId}/reset-pin`, { pin: "2468" });
  await admin("POST", `/users/${kidId}/reset-pin`, { pin: "1357" });
  await admin("DELETE", `/centres/${centre.id}/passkey`);

  const { activity } = (await admin("GET", "/activity")).json;
  const name = `${centre.name} passkey`;
  assert.deepEqual(
    activity.slice(0, 5).map((a) => [a.staffName, a.action, a.userId]),
    [
      ["Admin passkey", `turned off the passkey for ${centre.name}`, null],
      ["Admin passkey", "reset PIN", kidId],
      [name, "reset PIN", kidId],
      [name, "viewed progress", kidId],
      // Looking again within the hour isn't recorded again.
      [name, "viewed the student list", null],
    ],
  );
  assert.equal(activity[1].username, kid.body.username);
  const setUp = activity.filter((a) => a.action === `set a new passkey for ${centre.name}` || a.action === `added the centre ${centre.name}`);
  assert.deepEqual(setUp.map((a) => a.staffName), ["Admin passkey", "Admin passkey"]);
});

test("the admin page's own changes to a student are all recorded", async () => {
  const kid = await signUp(srv.client(), { orgId: 1 });
  const id = kid.json.user.userId;
  await admin("GET", `/users/${id}/progress`);
  await admin("PATCH", `/users/${id}`, { xp: 5 });
  await admin("POST", `/users/${id}/reset-progress`);
  await admin("PATCH", `/users/${id}/centre`, { orgId: 2 });
  const mine = (await admin("GET", "/activity")).json.activity.filter((a) => a.userId === id).map((a) => a.action);
  assert.deepEqual(mine, ["changed the centre", "reset progress", "changed XP, level or atoms", "viewed progress"]);
  assert.equal((await admin("DELETE", `/users/${id}`, { confirm: kid.body.username })).status, 200);
  assert.equal((await admin("GET", "/activity")).json.activity[0].action, "deleted a student");
});

test("a change is still recorded when its student was deleted meanwhile", async () => {
  await srv.sql("SELECT stem_staff_log_action(NULL, NULL, NULL, 999999999, 'reset PIN')");
  const [row] = await srv.sql("SELECT staff_name, user_id, action FROM staff_actions ORDER BY action_id DESC LIMIT 1");
  assert.deepEqual(row, { staff_name: "Admin passkey", user_id: null, action: "reset PIN" });
});

test("the Activity tab pages back and can leave out the looks", async () => {
  await srv.sql("INSERT INTO staff_actions (staff_name, action) SELECT 'Paging Test', 'reset progress' FROM generate_series(1, 105)");
  await srv.sql("INSERT INTO staff_actions (staff_name, action) VALUES ('Looker', 'viewed the student list')");
  const first = (await admin("GET", "/activity")).json;
  assert.deepEqual([first.activity.length, first.hasMore, first.activity[0].staffName], [100, true, "Looker"]);
  const last = first.activity.at(-1).actionId;
  const next = (await admin("GET", `/activity?before=${last}`)).json;
  assert.ok(next.activity.length > 0 && next.activity.every((a) => a.actionId < last));
  assert.ok(next.activity[0].actionId === last - 1);
  const changes = (await admin("GET", "/activity?changes=1")).json;
  assert.ok(changes.activity.every((a) => !a.action.startsWith("viewed ")));
  assert.equal(changes.activity[0].staffName, "Paging Test");
});

test("activity older than 12 months is deleted", async () => {
  await srv.sql("INSERT INTO staff_actions (staff_name, action, at) VALUES ('Long Gone', 'viewed progress', now() - interval '13 months')");
  const { activity } = (await admin("GET", "/activity")).json;
  assert.ok(!activity.some((a) => a.staffName === "Long Gone"));
  assert.deepEqual(await srv.sql("SELECT 1 FROM staff_actions WHERE staff_name = 'Long Gone'"), []);
});

test("staff and admin answers aren't kept in the browser's cache", async () => {
  const { client } = await centreWithStudent();
  assert.equal((await client.get("/api/staff/students")).headers.get("cache-control"), "no-store");
  const res = await fetch(`${srv.base}/api/admin/users`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(res.headers.get("cache-control"), "no-store");
  const kid = srv.client();
  await signUp(kid);
  assert.equal((await kid.get("/api/me/export")).headers.get("cache-control"), "no-store");
  assert.equal((await srv.client().get("/api/staff/students")).headers.get("cache-control"), "no-store");
});

test("the daily clean-up deletes what's past its keeping time", async () => {
  const now = Date.now();
  const centre = await addCentre();
  await srv.sql(`INSERT INTO site_signups (kind, name, email, created_at) VALUES
    ('partner', 'Old', 'purge.partner@example.org', now() - interval '13 months'),
    ('newsletter', NULL, 'purge.reader@example.org', now() - interval '13 months')`);
  await srv.sql("INSERT INTO staff_actions (staff_name, action, at) VALUES ('Purge Me', 'reset PIN', now() - interval '13 months')");
  await srv.sql(
    `INSERT INTO centre_login_attempts (org_id, client, success, attempted_at) VALUES
       ($1, 'purge', false, now() - interval '31 days'), ($1, 'keep', false, now() - interval '29 days')`,
    [centre.id],
  );
  await srv.sql("INSERT INTO site_counters (name, window_start, uses) VALUES ('purge-test', now() - interval '3 days', 5)");
  await srv.sql(
    "INSERT INTO centre_sessions (token, org_id, passkey_hash, expires_at, created_at, last_seen) VALUES ('ended-session', $1, 'x', $2, $2, $2)",
    [centre.id, now - 1000],
  );

  // Imported now: db.js picks the database when it loads (helpers.js).
  const { purgeExpired } = await import("../retention.js");
  await purgeExpired();
  const left = async (sql) => (await srv.sql(sql)).length;
  assert.equal(await left("SELECT 1 FROM site_signups WHERE email = 'purge.partner@example.org'"), 0);
  assert.equal(await left("SELECT 1 FROM site_signups WHERE email = 'purge.reader@example.org'"), 1);
  assert.equal(await left("SELECT 1 FROM staff_actions WHERE staff_name = 'Purge Me'"), 0);
  assert.equal(await left("SELECT 1 FROM centre_login_attempts WHERE client = 'purge'"), 0);
  assert.equal(await left("SELECT 1 FROM centre_login_attempts WHERE client = 'keep'"), 1);
  assert.equal(await left("SELECT 1 FROM site_counters WHERE name = 'purge-test'"), 0);
  assert.equal(await left("SELECT 1 FROM centre_sessions WHERE token = 'ended-session'"), 0);
});

test("a PIN reset that can't be recorded doesn't happen", async () => {
  const { client, kidId, kid } = await centreWithStudent();
  // The change and its line in the activity log are one step: no log, no change.
  await srv.sql("ALTER TABLE staff_actions RENAME TO staff_actions_away");
  try {
    assert.equal((await client.post(`/api/staff/students/${kidId}/reset-pin`, { pin: "9999" })).status, 500);
    assert.equal((await admin("POST", `/users/${kidId}/reset-pin`, { pin: "8888" })).status, 500);
  } finally {
    await srv.sql("ALTER TABLE staff_actions_away RENAME TO staff_actions");
  }
  assert.equal((await srv.client().post("/api/login", { username: kid.body.username, pin: "1234" })).status, 200);
});

test("a sign-in that checked the old passkey can't start a session after a change", async () => {
  const centre = await addCentre();
  const [{ hash }] = await srv.sql("SELECT passkey_hash AS hash FROM organisations WHERE org_id = $1", [centre.id]);
  // An admin set a new passkey while that sign-in was checking the old one.
  await admin("POST", `/centres/${centre.id}/passkey`);
  const now = Date.now();
  const [row] = await srv.sql("SELECT stem_centre_session_create('late-session', $1, $2, $3, $4)::text AS r", [
    centre.id,
    hash,
    now + 3600_000,
    now,
  ]);
  assert.equal(row.r, "false");
  assert.deepEqual(await srv.sql("SELECT 1 FROM centre_sessions WHERE token = 'late-session'"), []);
});

test("shared tablets: idle sessions end", async (t) => {
  await t.test("an hour without use signs the centre out", async () => {
    const centre = await addCentre();
    const client = await signedIn(centre);
    await srv.sql("UPDATE centre_sessions SET last_seen = last_seen - 3601000 WHERE org_id = $1", [centre.id]);
    assert.equal((await client.get("/api/staff/me")).status, 401);
  });

  await t.test("each use keeps the session alive", async () => {
    const centre = await addCentre();
    const client = await signedIn(centre);
    await srv.sql("UPDATE centre_sessions SET last_seen = last_seen - 3000000 WHERE org_id = $1", [centre.id]);
    assert.equal((await client.get("/api/staff/me")).status, 200);
    const [row] = await srv.sql("SELECT last_seen FROM centre_sessions WHERE org_id = $1", [centre.id]);
    assert.ok(Date.now() - Number(row.last_seen) < 60_000);
  });

  await t.test("12 hours after signing in the session ends", async () => {
    const centre = await addCentre();
    const client = await signedIn(centre);
    await srv.sql("UPDATE centre_sessions SET expires_at = $2 WHERE org_id = $1", [centre.id, Date.now() - 1]);
    assert.equal((await client.get("/api/staff/me")).status, 401);
  });
});

test("cookie-signed changes only come from the Academy's own pages", async () => {
  const { centre, client, kidId } = await centreWithStudent();
  const from = (origin, method, path, body, cookie = client.cookie) =>
    fetch(srv.base + path, {
      method,
      headers: { cookie, "content-type": "application/json", ...(origin ? { origin } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  // The website is the same "site" as the Academy, so SameSite alone wouldn't stop these.
  for (const origin of ["https://projstemulate.com", null]) {
    assert.equal((await from(origin, "POST", `/api/staff/students/${kidId}/reset-pin`, { pin: "1111" })).status, 403);
  }
  // Reads are fine from anywhere the cookie goes, and sign-in only from the Academy.
  assert.equal((await from(null, "GET", "/api/staff/students")).status, 200);
  const evil = await from("https://evil.example", "POST", "/api/staff/login", { centreId: centre.id, passkey: centre.passkey }, "");
  assert.equal(evil.status, 403);
});

test("staff accounts from before schema 6 are gone", async () => {
  const left = await srv.sql(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('staff', 'staff_centres', 'staff_sessions', 'staff_setup_tokens', 'staff_login_attempts')",
  );
  assert.deepEqual(left, []);
  assert.equal((await srv.client().post("/api/staff/setup/check", { token: "a".repeat(64) })).status, 401);
  assert.equal((await admin("GET", "/staff")).status, 404);
});
