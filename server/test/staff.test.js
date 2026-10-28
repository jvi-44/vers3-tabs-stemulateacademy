// Staff and volunteer accounts: added by an admin, set up from a one-time
// link, signed in with a password, and only ever shown their centres' students.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, signUp } from "./helpers.js";

const PASSKEY = "test-admin-passkey-long-enough";
const PASSWORD = "correct horse battery";

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
/** Adds an account through the admin API and returns it with its link's token. */
async function addStaff(overrides = {}) {
  counter += 1;
  const res = await admin("POST", "/staff", {
    fullName: `Staff ${counter}`,
    email: `staff${counter}@example.org`,
    role: "staff",
    allCentres: false,
    centreIds: [1],
    ...overrides,
  });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const token = new URL(res.json.setupLink.url.replace("#/", "")).searchParams.get("t");
  return { staff: res.json.staff, token, link: res.json.setupLink };
}

/** A client signed in as a new account (set-up link used). */
async function signedInStaff(overrides) {
  const added = await addStaff(overrides);
  const client = srv.client();
  const res = await client.post("/api/staff/setup", { token: added.token, password: PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  return { client, ...added };
}

test("an admin adds accounts with checked fields", async (t) => {
  await t.test("the new account has no password and gets a 7-day set-up link", async () => {
    const { staff, link, token } = await addStaff({ fullName: "  Ms Tan  ", centreIds: [1, 2, 2] });
    assert.deepEqual(
      [staff.fullName, staff.role, staff.allCentres, staff.disabled, staff.hasPassword, staff.lastLoginAt],
      ["Ms Tan", "staff", false, false, false, null],
    );
    assert.deepEqual(staff.centres.map((c) => c.id), [1, 2]);
    assert.match(link.url, /^http:\/\/localhost:5173\/#\/staff\/setup\?t=[0-9a-f]{64}$/);
    const days = (Date.parse(link.expiresAt) - Date.now()) / 864e5;
    assert.ok(days > 6.9 && days <= 7, String(days));
    // Only the hash is stored.
    const rows = await srv.sql("SELECT token FROM staff_setup_tokens WHERE staff_id = $1", [staff.staffId]);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].token, token);
  });

  await t.test("bad fields are refused", async () => {
    const other = (await srv.sql("SELECT org_id FROM organisations WHERE org_name = 'Other'"))[0].org_id;
    for (const bad of [
      { email: "not-an-email" },
      { fullName: "" },
      { role: "owner" },
      { centreIds: [9999] },
      { centreIds: [Number(other)] },
      { centreIds: "1" },
      { allCentres: "yes" },
    ]) {
      const res = await admin("POST", "/staff", { fullName: "X", email: `x${counter++}@example.org`, role: "staff", centreIds: [], ...bad });
      assert.equal(res.status, 400, JSON.stringify(bad));
    }
  });

  await t.test("emails are unique ignoring case", async () => {
    await addStaff({ email: "Same@Example.org" });
    const res = await admin("POST", "/staff", { fullName: "Y", email: "same@example.ORG", role: "volunteer", centreIds: [] });
    assert.deepEqual([res.status, res.json.error], [400, "Someone already has an account with that email."]);
  });

  await t.test("the account list", async () => {
    const { staff } = (await admin("GET", "/staff")).json;
    assert.ok(staff.length >= 2);
    assert.deepEqual(Object.keys(staff[0]).sort(), [
      "allCentres", "centres", "createdAt", "disabled", "email", "fullName", "hasPassword", "lastLoginAt", "role", "staffId",
    ]);
    assert.ok(!JSON.stringify(staff).includes("password_hash"));
  });
});

test("set-up links work once, expire and can be replaced", async (t) => {
  const { staff, token } = await addStaff({ email: "setup@example.org" });

  await t.test("checking a link greets the person", async () => {
    const res = await srv.client().post("/api/staff/setup/check", { token });
    assert.deepEqual([res.status, res.json], [200, { fullName: staff.fullName, email: "setup@example.org" }]);
    assert.equal((await srv.client().post("/api/staff/setup/check", { token: "0".repeat(64) })).status, 404);
    assert.equal((await srv.client().post("/api/staff/setup/check", { token: "short" })).status, 404);
  });

  await t.test("weak passwords are refused", async () => {
    for (const password of ["short", " ".repeat(12), "setup@example.org", "x".repeat(73), 12345678901]) {
      const res = await srv.client().post("/api/staff/setup", { token, password });
      assert.equal(res.status, 400, String(password));
    }
  });

  await t.test("a good password signs them in and uses up the link", async () => {
    const client = srv.client();
    const res = await client.post("/api/staff/setup", { token, password: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.json.staff.hasPassword, true);
    assert.match(client.cookie, /^stem_staff=/);
    assert.equal((await client.get("/api/staff/me")).json.staff.email, "setup@example.org");
    assert.equal((await srv.client().post("/api/staff/setup", { token, password: PASSWORD })).status, 404);
  });

  await t.test("the cookie is httpOnly, strict and only sent to the API", async () => {
    const { token: fresh } = await addStaff();
    const res = await fetch(`${srv.base}/api/staff/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: fresh, password: PASSWORD }),
    });
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("stem_staff="));
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.match(cookie, /Path=\/api/);
    // Gone when the browser closes (centre tablets are shared).
    assert.doesNotMatch(cookie, /Max-Age|Expires/i);
  });

  await t.test("a new link replaces the old one; expired links fail", async () => {
    const { staff: s, token: first } = await addStaff();
    const second = (await admin("POST", `/staff/${s.staffId}/setup-link`)).json.setupLink.url.split("t=")[1];
    assert.equal((await srv.client().post("/api/staff/setup/check", { token: first })).status, 404);
    assert.equal((await srv.client().post("/api/staff/setup/check", { token: second })).status, 200);
    await srv.sql("UPDATE staff_setup_tokens SET expires_at = 1 WHERE staff_id = $1", [s.staffId]);
    assert.equal((await srv.client().post("/api/staff/setup", { token: second, password: PASSWORD })).status, 404);
    assert.equal((await admin("POST", "/staff/999999/setup-link")).status, 404);
  });

  await t.test("using a new link signs the account out elsewhere", async () => {
    const { client, staff: s } = await signedInStaff();
    const again = (await admin("POST", `/staff/${s.staffId}/setup-link`)).json.setupLink.url.split("t=")[1];
    assert.equal((await srv.client().post("/api/staff/setup", { token: again, password: "a brand new password" })).status, 200);
    assert.equal((await client.get("/api/staff/me")).status, 401);
  });
});

test("signing in, wrong passwords and the lockout", async (t) => {
  const { staff } = await signedInStaff({ email: "login@example.org" });

  await t.test("the right password works, ignoring the email's case", async () => {
    const client = srv.client();
    const res = await client.post("/api/staff/login", { email: " LOGIN@example.org ", password: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.json.staff.staffId, staff.staffId);
    assert.ok(res.json.staff.lastLoginAt);
    assert.equal((await client.post("/api/staff/logout")).status, 200);
    assert.equal((await client.get("/api/staff/me")).status, 401);
  });

  await t.test("unknown emails, no password yet and wrong passwords get the same answer", async () => {
    const { staff: fresh } = await addStaff();
    const answers = await Promise.all([
      srv.client().post("/api/staff/login", { email: "nobody@example.org", password: PASSWORD }),
      srv.client().post("/api/staff/login", { email: fresh.email, password: PASSWORD }),
      srv.client().post("/api/staff/login", { email: "login@example.org", password: "wrong password!" }),
      srv.client().post("/api/staff/login", { email: "login@example.org" }),
    ]);
    assert.deepEqual(answers.map((r) => r.status), [401, 401, 401, 401]);
    assert.equal(new Set(answers.map((r) => r.json.error)).size, 1);
  });

  await t.test("5 wrong passwords in 15 minutes lock the email, even with the right one", async () => {
    const { staff: s } = await signedInStaff();
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await srv.client().post("/api/staff/login", { email: s.email.toUpperCase(), password: "nope nope nope" })).status, 401);
    }
    assert.equal((await srv.client().post("/api/staff/login", { email: s.email, password: PASSWORD })).status, 429);
  });

  await t.test("wrong passwords sent at the same moment can't get past the lockout", async () => {
    const { staff: s } = await signedInStaff();
    const answers = await Promise.all(
      Array.from({ length: 20 }, () => srv.client().post("/api/staff/login", { email: s.email, password: "nope nope nope" })),
    );
    const statuses = answers.map((r) => r.status);
    assert.deepEqual(
      [statuses.filter((x) => x === 401).length, statuses.filter((x) => x === 429).length],
      [5, 15],
      statuses.join(),
    );
    assert.equal((await srv.client().post("/api/staff/login", { email: s.email, password: PASSWORD })).status, 429);
  });

  await t.test("signing in with the right password doesn't count as a wrong try", async () => {
    const { staff: s } = await signedInStaff();
    for (let i = 0; i < 6; i += 1) {
      assert.equal((await srv.client().post("/api/staff/login", { email: s.email, password: PASSWORD })).status, 200);
    }
    assert.equal((await srv.client().post("/api/staff/login", { email: s.email, password: "nope nope nope" })).status, 401);
  });

  await t.test("tries for one email take turns in the database", async () => {
    // The test databases run one call at a time anyway; on Supabase this lock
    // is what stops tries sent together from all getting past the count.
    const [{ def }] = await srv.sql("SELECT pg_get_functiondef('stem_staff_login_begin'::regproc) AS def");
    assert.match(def, /pg_advisory_xact_lock\(hashtextextended\('stem_staff_login:' \|\| lower\(p_email\), 0\)\)/);
  });

  await t.test("a right password among wrong ones sent together marks only its own try", async () => {
    const { staff: s } = await signedInStaff();
    const answers = await Promise.all(
      ["first wrong one", PASSWORD, "second wrong one"].map((password) => srv.client().post("/api/staff/login", { email: s.email, password })),
    );
    const rows = await srv.sql("SELECT success FROM staff_login_attempts WHERE lower(email) = lower($1)", [s.email]);
    assert.deepEqual(answers.map((r) => r.status), [401, 200, 401]);
    assert.deepEqual(rows.map((r) => r.success).sort(), [false, false, true]);
  });

  await t.test("a disabled account is signed out and can't sign in", async () => {
    const { client, staff: s } = await signedInStaff();
    assert.equal((await admin("PATCH", `/staff/${s.staffId}`, { disabled: true })).json.staff.disabled, true);
    assert.equal((await client.get("/api/staff/me")).status, 401);
    assert.equal((await srv.client().post("/api/staff/login", { email: s.email, password: PASSWORD })).status, 401);
    assert.equal((await admin("PATCH", `/staff/${s.staffId}`, { disabled: false })).status, 200);
    assert.equal((await srv.client().post("/api/staff/login", { email: s.email, password: PASSWORD })).status, 200);
  });
});

test("staff only ever see their own centres' students", async (t) => {
  const atOne = await signUp(srv.client(), { fullName: "Centre One Kid", orgId: 1, schoolLevelId: 2 });
  const atTwo = await signUp(srv.client(), { fullName: "Centre Two Kid", orgId: 2 });
  const typed = await signUp(srv.client(), { orgId: undefined, orgOther: "Little Stars Centre" });
  const kidOne = atOne.json.user.userId;
  const kidTwo = atTwo.json.user.userId;
  const kidOther = typed.json.user.userId;
  const ids = (res) => res.json.students.map((s) => s.userId);

  const { client: one } = await signedInStaff({ centreIds: [1] });
  const { client: everyone } = await signedInStaff({ role: "staff", allCentres: true, centreIds: [] });

  await t.test("the list holds only their centres, with the admin list's fields", async () => {
    const res = await one.get("/api/staff/students");
    assert.equal(res.status, 200);
    assert.ok(ids(res).includes(kidOne));
    assert.ok(!ids(res).includes(kidTwo));
    assert.ok(!ids(res).includes(kidOther));
    assert.ok(res.json.students.every((s) => s.orgName === "Brighton Connection"));
    const adminRow = (await admin("GET", "/users")).json.users.find((u) => u.userId === kidOne);
    assert.deepEqual(res.json.students.find((s) => s.userId === kidOne), adminRow);
    const all = ids(await everyone.get("/api/staff/students"));
    assert.ok([kidOne, kidTwo, kidOther].every((id) => all.includes(id)));
  });

  await t.test("progress and PIN resets for another centre's student answer 404", async () => {
    assert.equal((await one.get(`/api/staff/students/${kidOne}/progress`)).status, 200);
    assert.equal((await one.get(`/api/staff/students/${kidTwo}/progress`)).status, 404);
    assert.equal((await one.get("/api/staff/students/abc/progress")).status, 404);
    assert.equal((await one.post(`/api/staff/students/${kidTwo}/reset-pin`, { pin: "1111" })).status, 404);
  });

  await t.test("a forgotten PIN can be reset for their own student", async () => {
    assert.equal((await one.post(`/api/staff/students/${kidOne}/reset-pin`, { pin: "12" })).status, 400);
    const res = await one.post(`/api/staff/students/${kidOne}/reset-pin`, { pin: "4321" });
    assert.equal(res.status, 200);
    assert.equal((await srv.client().post("/api/login", { username: atOne.body.username, pin: "4321" })).status, 200);
  });

  await t.test("changing an account's centres changes what it sees at once", async () => {
    const { staff } = (await one.get("/api/staff/me")).json;
    await admin("PATCH", `/staff/${staff.staffId}`, { centreIds: [2] });
    const now = ids(await one.get("/api/staff/students"));
    assert.ok(now.includes(kidTwo) && !now.includes(kidOne));
  });

  await t.test("no staff route works signed out", async () => {
    for (const path of ["/api/staff/me", "/api/staff/students", `/api/staff/students/${kidOne}/progress`]) {
      assert.equal((await srv.client().get(path)).status, 401, path);
    }
  });
});

test("volunteers can look but not reset PINs, and follow chosen centres", async (t) => {
  const kid = await signUp(srv.client(), { orgId: 1 });
  const kidId = kid.json.user.userId;
  const { client: helper, staff } = await signedInStaff({ role: "volunteer", centreIds: [1] });

  await t.test("they see their centre's students and progress", async () => {
    assert.ok((await helper.get("/api/staff/students")).json.students.some((s) => s.userId === kidId));
    assert.equal((await helper.get(`/api/staff/students/${kidId}/progress`)).status, 200);
  });

  await t.test("a PIN reset is refused (whoever sets a PIN can sign in as the child)", async () => {
    assert.equal((await helper.post(`/api/staff/students/${kidId}/reset-pin`, { pin: "1111" })).status, 403);
    assert.equal((await srv.client().post("/api/login", { username: kid.body.username, pin: "1234" })).status, 200);
  });

  await t.test("a volunteer can't follow every centre", async () => {
    const res = await admin("POST", "/staff", { fullName: "V", email: "everywhere@example.org", role: "volunteer", allCentres: true, centreIds: [] });
    assert.equal(res.status, 400);
    assert.equal((await admin("PATCH", `/staff/${staff.staffId}`, { allCentres: true })).status, 400);
    const { staff: s } = await addStaff({ role: "staff", allCentres: true, centreIds: [] });
    assert.equal((await admin("PATCH", `/staff/${s.staffId}`, { role: "volunteer" })).status, 400);
  });

  await t.test("the database itself refuses a volunteer following every centre", async () => {
    await assert.rejects(
      srv.sql("UPDATE staff SET all_centres = true WHERE staff_id = $1", [staff.staffId]),
      /staff_volunteer_not_all_centres/,
    );
    const [row] = await srv.sql("SELECT stem_staff_update($1, NULL, NULL, NULL, true, NULL, NULL, NULL)::text AS r", [staff.staffId]);
    assert.deepEqual(JSON.parse(row.r), { error: "volunteer" });
    const [made] = await srv.sql("SELECT stem_staff_create('V', 'v-sql@example.org', 'volunteer', true, '[1]', NULL)::text AS r");
    assert.deepEqual(JSON.parse(made.r), { error: "volunteer" });
    // Two admin changes at once that are each fine alone: one is refused.
    const { staff: s } = await addStaff({ role: "staff", allCentres: false, centreIds: [1] });
    const both = await Promise.all([
      admin("PATCH", `/staff/${s.staffId}`, { allCentres: true }),
      admin("PATCH", `/staff/${s.staffId}`, { role: "volunteer" }),
    ]);
    assert.deepEqual(both.map((r) => r.status).sort(), [200, 400]);
    const [now] = await srv.sql("SELECT role, all_centres FROM staff WHERE staff_id = $1", [s.staffId]);
    assert.ok(!(now.role === "volunteer" && now.all_centres), JSON.stringify(now));
  });
});

test("the activity log records who looked at or changed a student", async () => {
  const kid = await signUp(srv.client(), { orgId: 1 });
  const kidId = kid.json.user.userId;
  const { client: ms, staff } = await signedInStaff({ fullName: "Ms Logger", centreIds: [1] });
  await ms.get(`/api/staff/students/${kidId}/progress`);
  await ms.post(`/api/staff/students/${kidId}/reset-pin`, { pin: "2468" });
  await admin("POST", `/users/${kidId}/reset-pin`, { pin: "1357" });

  const { activity } = (await admin("GET", "/activity")).json;
  const mine = activity.filter((a) => a.userId === kidId);
  assert.deepEqual(
    mine.map((a) => [a.staffName, a.action]),
    [["Admin passkey", "reset PIN"], ["Ms Logger", "reset PIN"], ["Ms Logger", "viewed progress"]],
  );
  assert.ok(mine.every((a) => a.username === kid.body.username));
  assert.equal(mine[1].staffId, staff.staffId);
  // Not something staff can read.
  assert.equal((await ms.get("/api/admin/activity")).status, 401);
});

test("the activity log also records list views and changes to staff accounts", async () => {
  const { client: ms, staff: lister } = await signedInStaff({ fullName: "Ms Lister", centreIds: [1] });
  const listViews = async () =>
    (await admin("GET", "/activity")).json.activity.filter((a) => a.staffId === lister.staffId && a.action === "viewed the student list");
  await ms.get("/api/staff/students");
  await ms.get("/api/staff/students");
  // Looking again within the hour isn't recorded again.
  assert.deepEqual((await listViews()).map((a) => [a.staffName, a.staffEmail]), [["Ms Lister", lister.email]]);

  const { staff: s } = await addStaff({ fullName: "Mr Newcomer" });
  await admin("PATCH", `/staff/${s.staffId}`, { role: "admin" });
  await admin("PATCH", `/staff/${s.staffId}`, { role: "staff", fullName: "Mr Newman", email: `newman${s.staffId}@example.org`, centreIds: [1, 2] });
  // The same values again: nothing changes, so nothing is recorded.
  await admin("PATCH", `/staff/${s.staffId}`, { fullName: "Mr Newman", centreIds: [2, 1] });
  await admin("POST", `/staff/${s.staffId}/setup-link`);
  await admin("PATCH", `/staff/${s.staffId}`, { disabled: true, role: "volunteer" });
  await admin("DELETE", `/staff/${s.staffId}`);

  const { activity } = (await admin("GET", "/activity")).json;
  assert.deepEqual(
    activity.slice(0, 10).map((a) => [a.staffName, a.action, a.userId]),
    [
      ["Admin passkey", "deleted the account of Mr Newman", null],
      ["Admin passkey", "switched off the account of Mr Newman", null],
      ["Admin passkey", "made Mr Newman a volunteer", null],
      ["Admin passkey", "made a new set-up link for Mr Newman", null],
      ["Admin passkey", "changed the centres of Mr Newman", null],
      ["Admin passkey", "made Mr Newman centre staff", null],
      ["Admin passkey", "changed the email of Mr Newman", null],
      ["Admin passkey", "renamed Mr Newcomer to Mr Newman", null],
      ["Admin passkey", "made Mr Newcomer an admin", null],
      ["Admin passkey", "added an account for Mr Newcomer (staff)", null],
    ],
  );
  assert.ok(activity.slice(0, 10).every((a) => a.staffId === null && a.staffEmail === null));
});

test("an admin account's changes carry its own name and email, as they were", async () => {
  const { client: boss, staff } = await signedInStaff({ fullName: "Bob Admin", role: "admin" });
  const kid = await signUp(srv.client(), { orgId: 1 });
  assert.equal((await boss.post(`/api/admin/users/${kid.json.user.userId}/reset-pin`, { pin: "1111" })).status, 200);
  // The passkey's name in the log is kept for the passkey.
  assert.equal((await boss.patch(`/api/admin/staff/${staff.staffId}`, { fullName: " admin PASSKEY " })).status, 400);
  assert.equal((await boss.patch(`/api/admin/staff/${staff.staffId}`, { fullName: "Ms Tan" })).status, 200);
  const { activity } = (await admin("GET", "/activity")).json;
  assert.deepEqual(
    activity.slice(0, 2).map((a) => [a.staffId, a.staffName, a.staffEmail, a.action]),
    [
      [staff.staffId, "Bob Admin", staff.email, "renamed Bob Admin to Ms Tan"],
      [staff.staffId, "Bob Admin", staff.email, "reset PIN"],
    ],
  );
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

test("a change is still recorded when its student or account was deleted meanwhile", async () => {
  await srv.sql("SELECT stem_staff_log_action(NULL, NULL, NULL, 999999999, 'reset PIN')");
  await srv.sql("SELECT stem_staff_log_action(999999999, 'Gone Person', 'gone@example.org', NULL, 'reset progress')");
  const rows = await srv.sql("SELECT staff_id, staff_name, staff_email, user_id, action FROM staff_actions ORDER BY action_id DESC LIMIT 2");
  assert.deepEqual(rows, [
    { staff_id: null, staff_name: "Gone Person", staff_email: "gone@example.org", user_id: null, action: "reset progress" },
    { staff_id: null, staff_name: "Admin passkey", staff_email: null, user_id: null, action: "reset PIN" },
  ]);
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
  const { client } = await signedInStaff();
  assert.equal((await client.get("/api/staff/students")).headers.get("cache-control"), "no-store");
  const res = await fetch(`${srv.base}/api/admin/users`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(res.headers.get("cache-control"), "no-store");
  // Nor a student's own download, or a refusal.
  const kid = srv.client();
  await signUp(kid);
  assert.equal((await kid.get("/api/me/export")).headers.get("cache-control"), "no-store");
  assert.equal((await srv.client().get("/api/staff/students")).headers.get("cache-control"), "no-store");
});

test("the daily clean-up deletes what's past its keeping time", async () => {
  const now = Date.now();
  await srv.sql(`INSERT INTO site_signups (kind, name, email, created_at) VALUES
    ('partner', 'Old', 'purge.partner@example.org', now() - interval '13 months'),
    ('newsletter', NULL, 'purge.reader@example.org', now() - interval '13 months')`);
  await srv.sql("INSERT INTO staff_actions (staff_name, action, at) VALUES ('Purge Me', 'reset PIN', now() - interval '13 months')");
  await srv.sql(`INSERT INTO staff_login_attempts (email, success, attempted_at) VALUES
    ('purge@example.org', false, now() - interval '31 days'), ('keep@example.org', false, now() - interval '29 days')`);
  await srv.sql("INSERT INTO site_counters (name, window_start, uses) VALUES ('purge-test', now() - interval '3 days', 5)");
  const { staff: s } = await addStaff();
  await srv.sql("INSERT INTO staff_sessions (token, staff_id, expires_at, created_at, last_seen) VALUES ('ended-session', $1, $2, $2, $2)", [s.staffId, now - 1000]);
  await srv.sql("UPDATE staff_setup_tokens SET expires_at = $2 WHERE staff_id = $1", [s.staffId, now - 1000]);

  // Imported now: db.js picks the database when it loads (helpers.js).
  const { purgeExpired } = await import("../retention.js");
  await purgeExpired();
  const left = async (sql, params = []) => (await srv.sql(sql, params)).length;
  assert.equal(await left("SELECT 1 FROM site_signups WHERE email = 'purge.partner@example.org'"), 0);
  assert.equal(await left("SELECT 1 FROM site_signups WHERE email = 'purge.reader@example.org'"), 1);
  assert.equal(await left("SELECT 1 FROM staff_actions WHERE staff_name = 'Purge Me'"), 0);
  assert.equal(await left("SELECT 1 FROM staff_login_attempts WHERE email = 'purge@example.org'"), 0);
  assert.equal(await left("SELECT 1 FROM staff_login_attempts WHERE email = 'keep@example.org'"), 1);
  assert.equal(await left("SELECT 1 FROM site_counters WHERE name = 'purge-test'"), 0);
  assert.equal(await left("SELECT 1 FROM staff_sessions WHERE token = 'ended-session'"), 0);
  assert.equal(await left("SELECT 1 FROM staff_setup_tokens WHERE staff_id = $1", [s.staffId]), 0);
});

test("a PIN reset that can't be recorded doesn't happen", async () => {
  const kid = await signUp(srv.client(), { orgId: 1 });
  const { client: ms } = await signedInStaff({ centreIds: [1] });
  // The change and its line in the activity log are one step: no log, no change.
  await srv.sql("ALTER TABLE staff_actions RENAME TO staff_actions_away");
  try {
    assert.equal((await ms.post(`/api/staff/students/${kid.json.user.userId}/reset-pin`, { pin: "9999" })).status, 500);
    assert.equal((await admin("POST", `/users/${kid.json.user.userId}/reset-pin`, { pin: "8888" })).status, 500);
  } finally {
    await srv.sql("ALTER TABLE staff_actions_away RENAME TO staff_actions");
  }
  assert.equal((await srv.client().post("/api/login", { username: kid.body.username, pin: "1234" })).status, 200);
});

test("an account has one set-up link at a time, even when two are made at once", async () => {
  const { staff: s, token: first } = await addStaff();
  const both = await Promise.all([admin("POST", `/staff/${s.staffId}/setup-link`), admin("POST", `/staff/${s.staffId}/setup-link`)]);
  assert.deepEqual(both.map((r) => r.status), [200, 200]);
  const [{ n }] = await srv.sql("SELECT count(*)::int AS n FROM staff_setup_tokens WHERE staff_id = $1", [s.staffId]);
  assert.equal(n, 1);
  const tokenOf = (r) => new URL(r.json.setupLink.url.replace("#/", "")).searchParams.get("t");
  const working = [];
  for (const token of [first, ...both.map(tokenOf)]) {
    working.push((await srv.client().post("/api/staff/setup/check", { token })).status);
  }
  assert.equal(working.filter((status) => status === 200).length, 1);
  const [{ unique }] = await srv.sql("SELECT indexdef LIKE 'CREATE UNIQUE INDEX%' AS unique FROM pg_indexes WHERE indexname = 'idx_staff_setup_tokens_one'");
  assert.equal(unique, true);
});

test("a sign-in that checked the old password can't start a session after a reset", async () => {
  const { staff: s } = await signedInStaff();
  const [{ hash }] = await srv.sql("SELECT password_hash AS hash FROM staff WHERE staff_id = $1", [s.staffId]);
  // A set-up link was used while that sign-in was checking the password.
  await srv.sql("UPDATE staff SET password_hash = 'reset-meanwhile' WHERE staff_id = $1", [s.staffId]);
  const now = Date.now();
  const [row] = await srv.sql("SELECT stem_staff_session_create('late-session', $1, $2, $3, $4)::text AS r", [s.staffId, now + 3600_000, now, hash]);
  assert.equal(row.r, "false");
  assert.deepEqual(await srv.sql("SELECT 1 FROM staff_sessions WHERE token = 'late-session'"), []);
});

test("a new email voids the account's set-up link", async () => {
  const { staff: s, token } = await addStaff();
  const moved = await admin("PATCH", `/staff/${s.staffId}`, { email: `moved${s.staffId}@example.org` });
  assert.equal(moved.json.linkVoided, true);
  assert.equal((await srv.client().post("/api/staff/setup/check", { token })).status, 404);
  // Other changes, and the same address in other capitals, leave the link alone.
  const other = await addStaff();
  assert.equal((await admin("PATCH", `/staff/${other.staff.staffId}`, { role: "volunteer" })).json.linkVoided, false);
  assert.equal((await admin("PATCH", `/staff/${other.staff.staffId}`, { email: other.staff.email.toUpperCase() })).json.linkVoided, false);
  assert.equal((await srv.client().post("/api/staff/setup/check", { token: other.token })).status, 200);
});

test("a set-up link for an account being deleted is never recorded without the link", async () => {
  let made = 0;
  for (let i = 0; i < 10; i += 1) {
    const { staff: s } = await addStaff({ fullName: `Racer ${i}` });
    const [, link] = await Promise.all([admin("DELETE", `/staff/${s.staffId}`), admin("POST", `/staff/${s.staffId}/setup-link`)]);
    if (link.status === 200) {
      assert.ok(link.json.setupLink?.url);
      made += 1;
    } else {
      assert.equal(link.status, 404);
    }
  }
  const [{ n }] = await srv.sql("SELECT count(*)::int AS n FROM staff_actions WHERE action LIKE 'made a new set-up link for Racer %'");
  assert.equal(n, made);
});

test("shared tablets: idle sessions end, and admin access by cookie lasts an hour", async (t) => {
  await t.test("an hour without use signs the account out", async () => {
    const { client, staff } = await signedInStaff();
    await srv.sql("UPDATE staff_sessions SET last_seen = last_seen - 3601000 WHERE staff_id = $1", [staff.staffId]);
    assert.equal((await client.get("/api/staff/me")).status, 401);
  });

  await t.test("each use keeps the session alive", async () => {
    const { client, staff } = await signedInStaff();
    await srv.sql("UPDATE staff_sessions SET last_seen = last_seen - 3000000 WHERE staff_id = $1", [staff.staffId]);
    assert.equal((await client.get("/api/staff/me")).status, 200);
    const [row] = await srv.sql("SELECT last_seen FROM staff_sessions WHERE staff_id = $1", [staff.staffId]);
    assert.ok(Date.now() - Number(row.last_seen) < 60_000);
  });

  await t.test("an admin account must sign in again for the admin page after an hour", async () => {
    const { client, staff } = await signedInStaff({ role: "admin" });
    assert.equal((await client.get("/api/admin/users")).status, 200);
    await srv.sql("UPDATE staff_sessions SET created_at = created_at - 3601000 WHERE staff_id = $1", [staff.staffId]);
    assert.equal((await client.get("/api/admin/users")).status, 401);
    // Its staff page still works until the 12 hours or an idle hour.
    assert.equal((await client.get("/api/staff/students")).status, 200);
  });
});

test("cookie-signed changes only come from the Academy's own pages", async () => {
  const kid = await signUp(srv.client(), { orgId: 1 });
  const kidId = kid.json.user.userId;
  const { client: boss } = await signedInStaff({ role: "admin" });
  const { client: centre } = await signedInStaff({ centreIds: [1] });
  const from = (client, origin, method, path, body) =>
    fetch(srv.base + path, {
      method,
      headers: { cookie: client.cookie, "content-type": "application/json", ...(origin ? { origin } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  // The website is the same "site" as the Academy, so SameSite alone wouldn't stop these.
  for (const origin of ["https://projstemulate.com", null]) {
    assert.equal((await from(centre, origin, "POST", `/api/staff/students/${kidId}/reset-pin`, { pin: "1111" })).status, 403);
    assert.equal((await from(boss, origin, "POST", `/api/admin/users/${kidId}/reset-progress`)).status, 403);
  }
  assert.equal((await from(boss, "http://localhost:5173", "POST", `/api/admin/users/${kidId}/reset-progress`)).status, 200);
  // Reads are fine from anywhere the cookie goes, and sign-in only from the Academy.
  assert.equal((await from(centre, null, "GET", "/api/staff/students")).status, 200);
  assert.equal((await from(srv.client(), "https://evil.example", "POST", "/api/staff/login", { email: "a@b.co", password: "x" })).status, 403);
});

test("moving a student to another centre moves who can see them", async () => {
  const kid = await signUp(srv.client(), { orgId: 1 });
  const kidId = kid.json.user.userId;
  const { client: one } = await signedInStaff({ centreIds: [1] });
  const { client: two } = await signedInStaff({ centreIds: [2] });
  const sees = async (c) => (await c.get("/api/staff/students")).json.students.some((s) => s.userId === kidId);
  assert.deepEqual([await sees(one), await sees(two)], [true, false]);

  let res = await admin("PATCH", `/users/${kidId}/centre`, { orgId: 2 });
  assert.deepEqual(res.json, { success: true, orgName: "Caritas Singapore", orgOther: null });
  assert.deepEqual([await sees(one), await sees(two)], [false, true]);

  res = await admin("PATCH", `/users/${kidId}/centre`, { orgOther: "Little Stars Centre" });
  assert.deepEqual(res.json, { success: true, orgName: "Other", orgOther: "Little Stars Centre" });
  assert.deepEqual([await sees(one), await sees(two)], [false, false]);

  const other = (await srv.sql("SELECT org_id FROM organisations WHERE org_name = 'Other'"))[0].org_id;
  for (const bad of [{}, { orgId: 9999 }, { orgId: Number(other) }, { orgOther: "x".repeat(81) }]) {
    assert.equal((await admin("PATCH", `/users/${kidId}/centre`, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await admin("PATCH", "/users/999999/centre", { orgId: 1 })).status, 404);
});

test("admin accounts reach the admin page; others don't", async (t) => {
  const { client: boss, staff: bossStaff } = await signedInStaff({ role: "admin", centreIds: [] });
  const { client: helper } = await signedInStaff({ role: "volunteer", centreIds: [1] });

  await t.test("an admin account's cookie opens /api/admin without the passkey", async () => {
    assert.equal((await boss.get("/api/admin/users")).status, 200);
    assert.deepEqual((await boss.get("/api/admin/session")).json, { via: "staff", fullName: bossStaff.fullName });
    assert.deepEqual((await admin("GET", "/session")).json, { via: "passkey" });
    // Admin accounts follow every centre.
    assert.equal((await boss.get("/api/staff/students")).json.students.length, (await admin("GET", "/users")).json.users.length);
  });

  await t.test("staff and volunteer accounts get 401 there", async () => {
    for (const path of ["/api/admin/users", "/api/admin/staff", "/api/admin/signups"]) {
      assert.equal((await helper.get(path)).status, 401, path);
    }
  });

  await t.test("an admin account can't lock itself out", async () => {
    const self = `/api/admin/staff/${bossStaff.staffId}`;
    assert.equal((await boss.patch(self, { role: "staff" })).status, 400);
    assert.equal((await boss.patch(self, { disabled: true })).status, 400);
    assert.equal((await boss.del(self)).status, 400);
    assert.equal((await boss.patch(self, { fullName: "The Boss" })).json.staff.fullName, "The Boss");
  });

  await t.test("demoting an account takes effect on its next request", async () => {
    const { client: temp, staff } = await signedInStaff({ role: "admin" });
    assert.equal((await temp.get("/api/admin/users")).status, 200);
    await admin("PATCH", `/staff/${staff.staffId}`, { role: "staff" });
    assert.equal((await temp.get("/api/admin/users")).status, 401);
  });

  await t.test("deleting an account removes it and its sessions", async () => {
    const { client: gone, staff } = await signedInStaff();
    assert.deepEqual((await admin("DELETE", `/staff/${staff.staffId}`)).json, { success: true });
    assert.equal((await gone.get("/api/staff/me")).status, 401);
    assert.equal((await admin("DELETE", `/staff/${staff.staffId}`)).status, 404);
    assert.deepEqual(await srv.sql("SELECT 1 FROM staff_sessions WHERE staff_id = $1", [staff.staffId]), []);
  });
});
