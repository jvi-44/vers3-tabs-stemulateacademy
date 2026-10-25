// Endpoint-by-endpoint checks of what the API returns. They talk to the server
// over HTTP only (no direct database access), so the same file checks the
// server whichever database it runs on.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, signUp } from "./helpers.js";

// Times come back as "YYYY-MM-DD HH:MM:SS" in UTC (stem_ts in schema.sql, the
// format the API has always sent); the admin page and the chat parse exactly this.
const SQL_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const PASSKEY = "test-admin-passkey-long-enough";
const USER_KEYS = ["atoms", "avatar", "fullName", "level", "orgId", "orgOther", "schoolLevelId", "userId", "username", "xp"].sort();
const PROFILE_KEYS = [...USER_KEYS, "createdAt", "orgName", "schoolLevelName"].sort();
const OTHER_USER_KEYS = ["avatar", "level", "userId", "username"];

let srv;
let adminToken;
before(async () => {
  process.env.ADMIN_PASSKEY = PASSKEY;
  // Every sign-up and sign-in here comes from one IP address.
  process.env.AUTH_RATE_LIMIT_PER_MIN = "1000";
  srv = await startServer();
  adminToken = (await srv.client().post("/api/admin/login", { passkey: PASSKEY })).json.token;
});
after(async () => {
  await srv.close();
});

const keys = (o) => Object.keys(o).sort();
const idOf = (signed) => signed.json.user.userId;

async function admin(method, path, body) {
  const res = await fetch(`${srv.base}/api/admin${path}`, {
    method,
    headers: {
      authorization: `Bearer ${adminToken}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

/** Makes two signed-up students friends (a request each way). */
async function befriend(x, X, y, Y) {
  await x.post("/api/friends/requests", { username: Y.body.username });
  await y.post("/api/friends/requests", { username: X.body.username });
}

test("reference data lists the fixed sign-up options in order", async () => {
  const { status, json } = await srv.client().get("/api/reference-data");
  assert.equal(status, 200);
  assert.deepEqual(keys(json), ["organisations", "recoveryColours", "recoverySubjects", "schoolLevels"]);
  assert.deepEqual(json.organisations, [
    { id: 1, name: "Brighton Connection" },
    { id: 2, name: "Caritas Singapore" },
    { id: 3, name: "CDAC" },
    { id: 4, name: "Faithacts" },
    { id: 5, name: "New Life Care Centre" },
    { id: 6, name: "Sheng Hong Student Care" },
    { id: 7, name: "VIVA Foundation" },
  ]);
  assert.deepEqual(
    json.schoolLevels.map((l) => [l.id, l.name]),
    [1, 2, 3, 4, 5, 6].map((n) => [n, `Primary ${n}`]),
  );
  assert.deepEqual(
    json.recoveryColours.map((c) => c.name),
    ["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Pink"],
  );
  assert.deepEqual(
    json.recoverySubjects.map((s) => s.name),
    ["Mathematics", "Science", "English", "Mother Tongue", "Art", "Music", "Physical Education"],
  );
});

test("every response carries the basic browser protections", async () => {
  for (const path of ["/api/reference-data", "/api/does-not-exist", "/site/"]) {
    const res = await fetch(srv.base + path);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff", path);
    assert.equal(res.headers.get("x-frame-options"), "DENY", path);
    assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin", path);
    // HTTPS-only is for the host; here, as on your own computer, it's plain http.
    assert.equal(res.headers.get("strict-transport-security"), null, path);
  }
});

test("on your own computer the website is previewed at /site", async () => {
  const res = await fetch(`${srv.base}/site/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  assert.equal((await fetch(`${srv.base}/site`, { redirect: "manual" })).headers.get("location"), "/site/");
});

test("sign-up, sign-in and lockout details", async (t) => {
  const kid = srv.client();
  const { status, json, body } = await signUp(kid, { pin: "5555" });

  await t.test("a new account starts at zero", () => {
    assert.equal(status, 201);
    assert.deepEqual(keys(json.user), USER_KEYS);
    assert.equal(typeof json.user.userId, "number");
    assert.deepEqual(
      [json.user.xp, json.user.level, json.user.atoms, json.user.avatar, json.user.orgId, json.user.schoolLevelId],
      [0, 1, 0, null, 1, 1],
    );
  });

  await t.test("usernames are unique ignoring case", async () => {
    assert.equal((await signUp(srv.client(), { username: body.username.toUpperCase() })).status, 409);
  });

  await t.test("unknown drop-down ids are rejected", async () => {
    for (const bad of [{ schoolLevelId: 99 }, { recoveryColourId: 99 }, { recoverySubjectId: 99 }, { schoolLevelId: "abc" }]) {
      assert.equal((await signUp(srv.client(), bad)).status, 400, JSON.stringify(bad));
    }
  });

  await t.test("sign-in ignores the username's case and returns the account", async () => {
    const c = srv.client();
    assert.equal((await c.post("/api/login", { username: body.username, pin: "0000" })).status, 401);
    const res = await c.post("/api/login", { username: body.username.toUpperCase(), pin: "5555" });
    assert.equal(res.status, 200);
    assert.deepEqual(keys(res.json.user), USER_KEYS);
    assert.equal(res.json.user.username, body.username);
    assert.match(c.cookie, /^stem_session=/);
    assert.equal((await c.get("/api/me")).json.user.userId, json.user.userId);
  });

  await t.test("an empty PIN counts as a wrong try", async () => {
    const { body: other } = await signUp(srv.client(), { pin: "7777" });
    const c = srv.client();
    for (let i = 0; i < 5; i++) {
      assert.equal((await c.post("/api/login", { username: other.username, pin: "" })).status, 400);
    }
    assert.equal((await c.post("/api/login", { username: other.username, pin: "7777" })).status, 429);
  });
});

test("Forgot PIN: exact username, one-time token, signs out everywhere", async () => {
  const kid = srv.client();
  const { body } = await signUp(kid, { pin: "1111", recoveryColourId: 3, recoverySubjectId: 4 });
  const c = srv.client();
  const answers = { recoveryColourId: 3, recoverySubjectId: 4 };

  assert.equal((await c.post("/api/recover/verify", { username: body.username.toUpperCase(), ...answers })).status, 401);
  assert.equal(
    (await c.post("/api/recover/verify", { username: body.username, recoveryColourId: 3, recoverySubjectId: 5 })).status,
    401,
  );
  const ok = await c.post("/api/recover/verify", { username: body.username, ...answers });
  assert.equal(ok.status, 200);
  assert.equal(typeof ok.json.resetToken, "string");

  const reset = await c.post("/api/recover/reset", { username: body.username, resetToken: ok.json.resetToken, newPin: "2222" });
  assert.equal(reset.status, 200);
  assert.deepEqual(reset.json, { success: true });
  assert.equal(
    (await c.post("/api/recover/reset", { username: body.username, resetToken: ok.json.resetToken, newPin: "3333" })).status,
    401,
  );

  assert.equal((await kid.get("/api/me")).status, 401);
  assert.equal((await c.post("/api/login", { username: body.username, pin: "1111" })).status, 401);
  assert.equal((await c.post("/api/login", { username: body.username, pin: "2222" })).status, 200);
});

test("lesson progress: in-progress pays nothing, completed stays completed", async () => {
  const kid = srv.client();
  await signUp(kid);

  let res = await kid.post("/api/progress", { lessonId: "mm-sci1-quiz", status: "in_progress", score: 40 });
  assert.equal(res.status, 200);
  assert.deepEqual(keys(res.json), ["awarded", "success", "user"]);
  assert.deepEqual(keys(res.json.user), USER_KEYS);
  assert.deepEqual(res.json.awarded, { xp: 0, atoms: 0 });
  assert.deepEqual((await kid.get("/api/progress")).json.progress, [
    { lesson_id: "mm-sci1-quiz", status: "in_progress", score: 40 },
  ]);

  res = await kid.post("/api/progress", { lessonId: "mm-sci1-quiz", status: "completed" });
  assert.deepEqual(res.json.awarded, { xp: 50, atoms: 25 });
  assert.deepEqual([res.json.user.xp, res.json.user.atoms, res.json.user.level], [50, 25, 1]);

  res = await kid.post("/api/progress", { lessonId: "mm-sci1-quiz", status: "in_progress", score: 90 });
  assert.deepEqual(res.json.awarded, { xp: 0, atoms: 0 });
  assert.deepEqual((await kid.get("/api/progress")).json.progress, [
    { lesson_id: "mm-sci1-quiz", status: "completed", score: 90 },
  ]);

  assert.equal((await kid.post("/api/progress", { lessonId: "mm-sci1-quiz", status: "done" })).status, 400);
  assert.equal((await kid.post("/api/progress", { status: "completed" })).status, 400);
});

test("profile, rename and the data export", async (t) => {
  const kid = srv.client();
  const K = await signUp(kid, { fullName: "Priya Raman", schoolLevelId: 3, orgId: 2 });
  const pal = srv.client();
  const P = await signUp(pal);

  await t.test("GET /api/me and /api/user/me return the profile", async () => {
    for (const path of ["/api/me", "/api/user/me"]) {
      const me = (await kid.get(path)).json.user;
      assert.deepEqual(keys(me), PROFILE_KEYS);
      assert.deepEqual([me.fullName, me.orgName, me.schoolLevelName], ["Priya Raman", "Caritas Singapore", "Primary 3"]);
      assert.match(me.createdAt, SQL_TIME);
    }
  });

  // One of everything the export covers.
  await kid.post("/api/progress", { lessonId: "mm-sci-sim", status: "completed" });
  await kid.post("/api/packs/open", { albumKey: "phenomena", packId: "phen-p1" });
  await kid.post("/api/reflections", { beatId: "mm-exit", caption: "Rain!" });
  await kid.put("/api/story/mm-intro", { choices: { buddy: "emily" } });
  await kid.post("/api/game-scores", { gameId: "mm-sci-sim", score: 70 });
  await befriend(kid, K, pal, P);
  const direct = (await kid.post("/api/conversations", { isGroup: false, memberIds: [idOf(P)] })).json.conversation;
  await kid.post(`/api/conversations/${direct.id}/messages`, { body: "hi pal" });
  const group = (await kid.post("/api/conversations", { isGroup: true, name: "Rain Squad", memberIds: [idOf(P)] })).json
    .conversation;
  await kid.post(`/api/conversations/${group.id}/messages`, { body: "hi squad" });

  await t.test("failed sign-ins follow a rename", async () => {
    const stranger = srv.client();
    assert.equal((await stranger.post("/api/login", { username: K.body.username, pin: "0000" })).status, 401);
    const newName = `${K.body.username}_r`;
    const res = await kid.patch("/api/me", { username: newName, fullName: "Priya R" });
    assert.equal(res.status, 200);
    assert.deepEqual(keys(res.json.user), PROFILE_KEYS);
    assert.deepEqual([res.json.user.username, res.json.user.fullName], [newName, "Priya R"]);
    assert.equal((await stranger.post("/api/login", { username: newName, pin: "1234" })).status, 200);
    const { loginHistory } = (await kid.get("/api/me/export")).json;
    assert.deepEqual(
      loginHistory.map((h) => h.success),
      [0, 1],
    );
    for (const h of loginHistory) {
      assert.deepEqual(keys(h), ["attempted_at", "success"]);
      assert.match(h.attempted_at, SQL_TIME);
    }
  });

  await t.test("name rules", async () => {
    assert.equal((await kid.patch("/api/me", { fullName: "   " })).status, 400);
    assert.equal((await kid.patch("/api/me", { fullName: "x".repeat(81) })).status, 400);
    assert.equal((await kid.patch("/api/me", { username: "ab" })).status, 400);
    assert.equal((await kid.patch("/api/me", { username: P.body.username.toUpperCase() })).status, 409);
    const me = (await kid.get("/api/me")).json.user;
    const upper = await kid.patch("/api/me", { username: me.username.toUpperCase() });
    assert.equal(upper.status, 200);
    assert.equal(upper.json.user.username, me.username.toUpperCase());
  });

  await t.test("school level can be changed; a bad level changes nothing", async () => {
    const res = await kid.patch("/api/me", { schoolLevelId: 4 });
    assert.equal(res.status, 200);
    assert.deepEqual([res.json.user.schoolLevelId, res.json.user.schoolLevelName], [4, "Primary 4"]);
    const before = (await kid.get("/api/me")).json.user;
    for (const bad of [999, 0, "x", 1.5]) {
      const r = await kid.patch("/api/me", { schoolLevelId: bad, fullName: "Changed" });
      assert.equal(r.status, 400, `level ${bad}`);
    }
    assert.deepEqual((await kid.get("/api/me")).json.user, before);
  });

  await t.test("the export holds every table in its usual shape", async () => {
    const res = await kid.get("/api/me/export");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-disposition"), /^attachment; filename="stemulate-.+-data\.json"$/);
    const exp = res.json;
    assert.deepEqual(keys(exp), [
      "cards",
      "exportedAt",
      "friends",
      "gameScores",
      "loginHistory",
      "messagesSent",
      "profile",
      "progress",
      "reflections",
      "storyChoices",
    ]);
    assert.deepEqual(keys(exp.profile), PROFILE_KEYS);

    assert.deepEqual(exp.progress.map(keys), [["completed_at", "last_accessed", "lesson_id", "score", "status"]]);
    assert.deepEqual([exp.progress[0].lesson_id, exp.progress[0].status, exp.progress[0].score], ["mm-sci-sim", "completed", null]);
    assert.match(exp.progress[0].completed_at, SQL_TIME);
    assert.match(exp.progress[0].last_accessed, SQL_TIME);

    assert.deepEqual(exp.gameScores.map(keys), [["best_score", "game_id", "plays", "updated_at"]]);
    assert.deepEqual([exp.gameScores[0].game_id, exp.gameScores[0].best_score, exp.gameScores[0].plays], ["mm-sci-sim", 70, 1]);
    assert.match(exp.gameScores[0].updated_at, SQL_TIME);

    assert.deepEqual(keys(exp.cards[0]), ["card_id", "count"]);
    assert.equal(exp.cards.reduce((n, c) => n + c.count, 0), 2);

    assert.deepEqual(exp.reflections.map(keys), [["beat_id", "caption", "created_at"]]);
    assert.deepEqual([exp.reflections[0].beat_id, exp.reflections[0].caption], ["mm-exit", "Rain!"]);
    assert.match(exp.reflections[0].created_at, SQL_TIME);

    // Stored as the JSON text the story route wrote.
    assert.deepEqual(exp.storyChoices.map(keys), [["beat_id", "choices", "updated_at"]]);
    assert.deepEqual([exp.storyChoices[0].beat_id, exp.storyChoices[0].choices], ["mm-intro", '{"buddy":"emily"}']);
    assert.match(exp.storyChoices[0].updated_at, SQL_TIME);

    assert.deepEqual(exp.friends.map(keys), [["friends_since", "username"]]);
    assert.equal(exp.friends[0].username, P.body.username);
    assert.match(exp.friends[0].friends_since, SQL_TIME);

    assert.deepEqual(exp.messagesSent.map(keys), [
      ["body", "chat", "conversation_id", "created_at"],
      ["body", "chat", "conversation_id", "created_at"],
    ]);
    assert.deepEqual(
      exp.messagesSent.map((m) => [m.chat, m.body, m.conversation_id]),
      [
        ["Direct chat", "hi pal", direct.id],
        ["Rain Squad", "hi squad", group.id],
      ],
    );
    assert.match(exp.messagesSent[0].created_at, SQL_TIME);
  });
});

test("friends: search, requests and their answers", async (t) => {
  const tag = `s${process.pid}`;
  const [a, b, c] = [srv.client(), srv.client(), srv.client()];
  const A = await signUp(a);
  const B = await signUp(b, { username: `${tag}ab_cd` });
  const C = await signUp(c, { username: `${tag}abxcd` });
  await signUp(srv.client(), { username: `${tag}ab` });
  const statusesFor = async (client, q) =>
    Object.fromEntries((await client.get(`/api/users/search?q=${q}`)).json.users.map((u) => [u.username, u.status]));

  await t.test("search escapes wildcards, puts the exact name first and shows each status", async () => {
    let { users } = (await a.get(`/api/users/search?q=${tag}AB`)).json;
    assert.deepEqual(
      users.map((u) => u.username),
      [`${tag}ab`, `${tag}ab_cd`, `${tag}abxcd`],
    );
    assert.deepEqual(keys(users[0]), [...OTHER_USER_KEYS, "status"].sort());
    assert.ok(users.every((u) => u.status === "none"));
    users = (await a.get(`/api/users/search?q=${tag}ab_`)).json.users;
    assert.deepEqual(
      users.map((u) => u.username),
      [`${tag}ab_cd`],
    );
    assert.deepEqual((await a.get("/api/users/search?q=x")).json, { users: [] });
    assert.ok(!(await a.get(`/api/users/search?q=${A.body.username}`)).json.users.some((u) => u.userId === idOf(A)));
  });

  await t.test("requests: send, see, refuse duplicates and strangers", async () => {
    assert.equal((await a.post("/api/friends/requests", { username: "" })).status, 400);
    assert.equal((await a.post("/api/friends/requests", { username: A.body.username })).status, 400);
    const missing = await a.post("/api/friends/requests", { username: "nobody_here" });
    assert.equal(missing.status, 404);
    assert.match(missing.json.error, /nobody_here/);

    const sent = await a.post("/api/friends/requests", { username: `${tag}AB_CD` });
    assert.equal(sent.status, 201);
    assert.deepEqual(keys(sent.json), ["status", "user"]);
    assert.equal(sent.json.status, "requested");
    assert.deepEqual(keys(sent.json.user), OTHER_USER_KEYS);
    assert.equal(sent.json.user.username, `${tag}ab_cd`);
    assert.equal((await a.post("/api/friends/requests", { username: `${tag}ab_cd` })).status, 409);

    assert.equal((await statusesFor(a, `${tag}ab_`))[`${tag}ab_cd`], "requested");
    assert.equal((await statusesFor(b, A.body.username))[A.body.username], "incoming");

    const mine = (await a.get("/api/friends")).json;
    assert.deepEqual(keys(mine), ["friends", "incoming", "outgoing"]);
    assert.deepEqual([mine.friends.length, mine.incoming.length, mine.outgoing.length], [0, 0, 1]);
    assert.deepEqual(keys(mine.outgoing[0]), ["createdAt", "requestId", "user"]);
    assert.match(mine.outgoing[0].createdAt, SQL_TIME);
    assert.equal(mine.outgoing[0].user.userId, idOf(B));
    assert.equal((await b.get("/api/friends")).json.incoming[0].user.userId, idOf(A));
  });

  await t.test("asking someone who already asked you makes you friends", async () => {
    const res = await b.post("/api/friends/requests", { username: A.body.username });
    assert.equal(res.status, 200);
    assert.equal(res.json.status, "friends");
    assert.deepEqual(keys(res.json.user), OTHER_USER_KEYS);
    assert.equal((await a.post("/api/friends/requests", { username: B.body.username })).status, 409);
    const mine = (await a.get("/api/friends")).json;
    assert.deepEqual(
      mine.friends.map((f) => f.userId),
      [idOf(B)],
    );
    assert.deepEqual(keys(mine.friends[0]), OTHER_USER_KEYS);
    assert.deepEqual([mine.incoming.length, mine.outgoing.length], [0, 0]);
    assert.equal((await statusesFor(a, `${tag}ab_`))[`${tag}ab_cd`], "friends");
  });

  await t.test("decline, cancel, and nobody else can answer", async () => {
    await c.post("/api/friends/requests", { username: A.body.username });
    const { incoming } = (await a.get("/api/friends")).json;
    assert.equal(incoming.length, 1);
    const id = incoming[0].requestId;
    assert.equal((await b.post(`/api/friends/requests/${id}/accept`)).status, 404);
    assert.equal((await c.post(`/api/friends/requests/${id}/accept`)).status, 404);
    assert.equal((await a.post(`/api/friends/requests/${id}/cancel`)).status, 404);
    assert.equal((await a.post(`/api/friends/requests/${id}/explode`)).status, 400);
    assert.equal((await a.post(`/api/friends/requests/${id}/decline`)).status, 200);
    assert.equal((await a.get("/api/friends")).json.incoming.length, 0);
    assert.equal((await a.post(`/api/friends/requests/${id}/decline`)).status, 404);

    await c.post("/api/friends/requests", { username: A.body.username });
    const again = (await c.get("/api/friends")).json.outgoing[0].requestId;
    assert.equal((await c.post(`/api/friends/requests/${again}/cancel`)).status, 200);
    assert.equal((await a.get("/api/friends")).json.incoming.length, 0);
    assert.deepEqual((await c.get("/api/friends")).json.outgoing, []);
  });

  await t.test("removing a friend", async () => {
    assert.equal((await a.del(`/api/friends/${idOf(B)}`)).status, 200);
    assert.deepEqual((await a.get("/api/friends")).json.friends, []);
    assert.deepEqual((await b.get("/api/friends")).json.friends, []);
    assert.equal((await a.del("/api/friends/abc")).status, 400);
  });
});

test("friend lists ignore case when sorting; the leaderboard sorts by XP, then name", async () => {
  const tag = `o${process.pid}`;
  const v = srv.client();
  const V = await signUp(v);
  const zed = srv.client();
  const Z = await signUp(zed, { username: `${tag}Zed` });
  const amy = srv.client();
  const M = await signUp(amy, { username: `${tag}amy` });
  await befriend(v, V, zed, Z);
  await befriend(v, V, amy, M);

  assert.deepEqual(
    (await v.get("/api/friends")).json.friends.map((f) => f.username),
    [`${tag}amy`, `${tag}Zed`],
  );

  for (const u of [Z, M]) {
    assert.equal((await admin("PATCH", `/users/${idOf(u)}`, { xp: 9_000_000 })).status, 200);
  }
  const { entries } = (await v.get("/api/leaderboard")).json;
  assert.deepEqual(
    entries.slice(0, 2).map((e) => [e.username, e.xp, e.isFriend]),
    [
      [`${tag}Zed`, 9_000_000, true],
      [`${tag}amy`, 9_000_000, true],
    ],
  );
  assert.equal(entries.find((e) => e.userId === idOf(V))?.isFriend, false);
});

test("chats: direct and group chats, messages, members, leaving, search", async (t) => {
  const [a, b, c, d] = [srv.client(), srv.client(), srv.client(), srv.client()];
  const A = await signUp(a);
  const B = await signUp(b);
  const C = await signUp(c);
  const D = await signUp(d);
  await befriend(a, A, b, B);
  await befriend(a, A, c, C);
  let direct;
  let group;

  await t.test("creating chats", async () => {
    assert.equal((await a.post("/api/conversations", { isGroup: false, memberIds: [] })).status, 400);
    assert.equal((await a.post("/api/conversations", { isGroup: false, memberIds: [idOf(D)] })).status, 403);
    assert.equal((await a.post("/api/conversations", { isGroup: false, memberIds: [idOf(B), idOf(C)] })).status, 400);

    const res = await a.post("/api/conversations", { isGroup: false, memberIds: [idOf(B)] });
    assert.equal(res.status, 201);
    direct = res.json.conversation;
    assert.deepEqual(keys(direct), ["avatar", "createdBy", "id", "isGroup", "lastMessage", "members", "name"]);
    assert.deepEqual(
      [direct.isGroup, direct.name, direct.avatar, direct.createdBy, direct.lastMessage],
      [false, B.body.username, null, idOf(A), null],
    );
    assert.deepEqual(direct.members.map((m) => m.userId).sort(), [idOf(A), idOf(B)].sort());
    assert.deepEqual(keys(direct.members[0]), OTHER_USER_KEYS);

    const again = await a.post("/api/conversations", { isGroup: false, memberIds: [idOf(B)] });
    assert.equal(again.status, 200);
    assert.equal(again.json.conversation.id, direct.id);
    const fromB = await b.post("/api/conversations", { isGroup: false, memberIds: [idOf(A)] });
    assert.deepEqual([fromB.status, fromB.json.conversation.id, fromB.json.conversation.name], [200, direct.id, A.body.username]);

    assert.equal((await a.post("/api/conversations", { isGroup: true, name: " ", memberIds: [idOf(B)] })).status, 400);
    assert.equal((await a.post("/api/conversations", { isGroup: true, name: "x".repeat(41), memberIds: [idOf(B)] })).status, 400);
    const g = await a.post("/api/conversations", { isGroup: true, name: "  Rocket Crew ", memberIds: [idOf(B), idOf(C), idOf(B)] });
    assert.equal(g.status, 201);
    group = g.json.conversation;
    assert.deepEqual([group.isGroup, group.name, group.avatar, group.createdBy, group.members.length], [true, "Rocket Crew", null, idOf(A), 3]);
    const names = group.members.map((m) => m.username);
    assert.deepEqual(names, [...names].sort((x, y) => (x.toLowerCase() < y.toLowerCase() ? -1 : 1)));
  });

  let first;
  let second;
  await t.test("messages", async () => {
    assert.equal((await a.post(`/api/conversations/${group.id}/messages`, { body: "  " })).status, 400);
    assert.equal((await a.post(`/api/conversations/${group.id}/messages`, { body: "x".repeat(501) })).status, 400);
    assert.equal((await d.post(`/api/conversations/${group.id}/messages`, { body: "let me in" })).status, 404);

    first = await a.post(`/api/conversations/${group.id}/messages`, { body: "50% done!" });
    assert.equal(first.status, 201);
    assert.deepEqual(keys(first.json), ["message"]);
    assert.deepEqual(keys(first.json.message), ["id"]);
    second = await b.post(`/api/conversations/${group.id}/messages`, { body: "500 more to go" });

    const { messages } = (await c.get(`/api/conversations/${group.id}/messages`)).json;
    assert.deepEqual(
      messages.map((m) => [m.id, m.body, m.senderId, m.senderName, m.senderAvatar]),
      [
        [first.json.message.id, "50% done!", idOf(A), A.body.username, null],
        [second.json.message.id, "500 more to go", idOf(B), B.body.username, null],
      ],
    );
    assert.deepEqual(keys(messages[0]), ["body", "createdAt", "id", "senderAvatar", "senderId", "senderName"]);
    assert.match(messages[0].createdAt, SQL_TIME);

    const newer = (await c.get(`/api/conversations/${group.id}/messages?after=${first.json.message.id}`)).json.messages;
    assert.deepEqual(
      newer.map((m) => m.id),
      [second.json.message.id],
    );
    assert.equal((await d.get(`/api/conversations/${group.id}/messages`)).status, 404);
    assert.equal((await a.get("/api/conversations/abc/messages")).status, 404);
  });

  await t.test("the chat list puts the latest message first", async () => {
    await b.post(`/api/conversations/${direct.id}/messages`, { body: "psst" });
    const { conversations } = (await a.get("/api/conversations")).json;
    assert.deepEqual(
      conversations.map((x) => x.id),
      [direct.id, group.id],
    );
    assert.deepEqual(keys(conversations[0].lastMessage), ["body", "createdAt", "id", "sender"]);
    assert.deepEqual([conversations[0].lastMessage.body, conversations[0].lastMessage.sender], ["psst", B.body.username]);
    assert.match(conversations[0].lastMessage.createdAt, SQL_TIME);
    assert.equal(conversations[1].lastMessage.body, "500 more to go");
    assert.deepEqual((await d.get("/api/conversations")).json.conversations, []);
  });

  await t.test("search only covers your own chats and escapes wildcards", async () => {
    const pct = (await a.get("/api/messages/search?q=0%25")).json.results;
    assert.deepEqual(
      pct.map((m) => m.body),
      ["50% done!"],
    );
    assert.deepEqual(keys(pct[0]), ["body", "conversationId", "createdAt", "messageId", "senderName"]);
    assert.deepEqual([pct[0].conversationId, pct[0].messageId, pct[0].senderName], [group.id, first.json.message.id, A.body.username]);
    assert.match(pct[0].createdAt, SQL_TIME);
    assert.deepEqual(
      (await a.get("/api/messages/search?q=50")).json.results.map((m) => m.body),
      ["500 more to go", "50% done!"],
    );
    assert.deepEqual(
      (await a.get("/api/messages/search?q=PS")).json.results.map((m) => [m.body, m.senderName]),
      [["psst", B.body.username]],
    );
    assert.deepEqual((await d.get("/api/messages/search?q=50")).json.results, []);
    assert.deepEqual((await a.get("/api/messages/search?q=5")).json, { results: [] });
  });

  await t.test("adding members to a group", async () => {
    assert.equal((await a.post(`/api/conversations/${direct.id}/members`, { memberIds: [idOf(C)] })).status, 404);
    assert.equal((await d.post(`/api/conversations/${group.id}/members`, { memberIds: [idOf(D)] })).status, 404);
    assert.equal((await a.post(`/api/conversations/${group.id}/members`, { memberIds: [] })).status, 403);
    assert.equal((await a.post(`/api/conversations/${group.id}/members`, { memberIds: ["x"] })).status, 403);
    assert.equal((await a.post(`/api/conversations/${group.id}/members`, { memberIds: [idOf(D)] })).status, 403);
    await befriend(a, A, d, D);
    const res = await a.post(`/api/conversations/${group.id}/members`, { memberIds: [idOf(D), idOf(B)] });
    assert.equal(res.status, 200);
    assert.equal(res.json.conversation.members.length, 4);
    assert.equal(res.json.conversation.lastMessage.body, "500 more to go");
  });

  await t.test("leaving", async () => {
    assert.equal((await a.post(`/api/conversations/${direct.id}/leave`)).status, 400);
    const e = srv.client();
    await signUp(e);
    assert.equal((await e.post(`/api/conversations/${group.id}/leave`)).status, 404);
    for (const x of [a, b, c]) {
      assert.equal((await x.post(`/api/conversations/${group.id}/leave`)).status, 200);
    }
    assert.equal((await d.get(`/api/conversations/${group.id}/messages`)).json.messages.length, 2);
    assert.equal((await d.post(`/api/conversations/${group.id}/leave`)).status, 200);
    assert.equal((await d.get(`/api/conversations/${group.id}/messages`)).status, 404);
    assert.deepEqual((await d.get("/api/conversations")).json.conversations, []);
  });
});

test("deleting an account cleans up friends, requests and chats", async () => {
  const [a, b, c, d] = [srv.client(), srv.client(), srv.client(), srv.client()];
  const A = await signUp(a);
  const B = await signUp(b);
  const C = await signUp(c);
  const D = await signUp(d);
  await befriend(a, A, b, B);
  await befriend(a, A, c, C);
  await a.post("/api/friends/requests", { username: D.body.username });
  const direct = (await a.post("/api/conversations", { isGroup: false, memberIds: [idOf(B)] })).json.conversation;
  const group = (await a.post("/api/conversations", { isGroup: true, name: "Trio", memberIds: [idOf(B), idOf(C)] })).json
    .conversation;
  await a.post(`/api/conversations/${group.id}/messages`, { body: "from a" });
  await b.post(`/api/conversations/${group.id}/messages`, { body: "from b" });

  const res = await a.del("/api/me", { pin: "1234" });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { success: true });
  assert.equal(a.cookie, "");

  const { conversations } = (await b.get("/api/conversations")).json;
  assert.deepEqual(
    conversations.map((x) => x.id),
    [group.id],
  );
  assert.deepEqual(conversations[0].members.map((m) => m.userId).sort(), [idOf(B), idOf(C)].sort());
  assert.deepEqual(
    (await b.get(`/api/conversations/${group.id}/messages`)).json.messages.map((m) => m.body),
    ["from b"],
  );
  assert.equal((await b.get(`/api/conversations/${direct.id}/messages`)).status, 404);
  assert.deepEqual((await b.get("/api/friends")).json.friends, []);
  assert.deepEqual((await d.get("/api/friends")).json.incoming, []);
});

test("game scores: best kept, plays counted, at most 100 games each", async () => {
  const kid = srv.client();
  await signUp(kid);
  await kid.post("/api/game-scores", { gameId: "drop-dash", score: 40 });
  assert.deepEqual((await kid.post("/api/game-scores", { gameId: "drop-dash", score: 30 })).json, { best: 40, plays: 2 });
  assert.deepEqual((await kid.get("/api/game-scores")).json, { scores: [{ game_id: "drop-dash", best_score: 40, plays: 2 }] });
  for (let i = 1; i < 100; i++) {
    assert.equal((await kid.post("/api/game-scores", { gameId: `g-${i}`, score: i })).status, 200);
  }
  assert.equal((await kid.post("/api/game-scores", { gameId: "one-too-many", score: 1 })).status, 400);
  assert.deepEqual((await kid.post("/api/game-scores", { gameId: "drop-dash", score: 90 })).json, { best: 90, plays: 3 });
  assert.equal((await kid.get("/api/game-scores")).json.scores.length, 100);
});

test("reflections: the author gets theirs back, and nobody can list them", async () => {
  const [x, y] = [srv.client(), srv.client()];
  await signUp(x, { fullName: "Lee Wei Ming" });
  await signUp(y, { fullName: "Sara" });
  await x.post("/api/reflections", { beatId: "mi-exit", caption: "Budgets!" });
  const made = await y.post("/api/reflections", { beatId: "sb-exit", caption: "Space!" });
  assert.equal(made.status, 201);
  assert.deepEqual(keys(made.json), ["reflection"]);
  assert.deepEqual(keys(made.json.reflection), ["avatar", "beatTitle", "caption", "createdAt", "firstName", "id"]);
  const r = made.json.reflection;
  assert.deepEqual([r.caption, r.firstName, r.beatTitle, r.avatar], ["Space!", "Sara", "Exit Card", null]);
  assert.match(r.createdAt, SQL_TIME);
  // Lee can't list Sara's (or anyone's); each student only finds their own, in their data export.
  assert.equal((await x.get("/api/reflections")).status, 404);
  assert.deepEqual((await x.get("/api/me/export")).json.reflections.map((e) => e.caption), ["Budgets!"]);
});

test("admin: stats, students, progress and the student tools", async (t) => {
  const before = (await admin("GET", "/stats")).json;
  assert.deepEqual(keys(before), ["activeThisWeek", "activitiesCompleted", "groups", "messages", "users"]);
  const kid = srv.client();
  const K = await signUp(kid, { fullName: "Admin Test", schoolLevelId: 6, orgId: 7 });
  const kidId = idOf(K);
  await kid.post("/api/progress", { lessonId: "mm-exit", status: "completed" });
  await kid.post("/api/game-scores", { gameId: "mm-sci-sim", score: 55 });
  await kid.post("/api/login", { username: K.body.username, pin: "1234" });

  await t.test("stats count everyone", async () => {
    const now = (await admin("GET", "/stats")).json;
    assert.deepEqual(
      [now.users, now.activitiesCompleted, now.activeThisWeek, now.messages, now.groups],
      [before.users + 1, before.activitiesCompleted + 1, before.activeThisWeek + 1, before.messages, before.groups],
    );
  });

  await t.test("the student list", async () => {
    const quiet = await signUp(srv.client());
    const typed = await signUp(srv.client(), { orgId: undefined, orgOther: "Little Stars Centre" });
    const { users } = (await admin("GET", "/users")).json;
    const row = users.find((u) => u.userId === kidId);
    assert.deepEqual(keys(row), [
      "atoms",
      "avatar",
      "completed",
      "createdAt",
      "fullName",
      "lastActive",
      "level",
      "orgName",
      "orgOther",
      "schoolLevelName",
      "userId",
      "username",
      "xp",
    ]);
    assert.deepEqual(
      [row.fullName, row.username, row.orgName, row.orgOther, row.schoolLevelName, row.completed, row.xp, row.level, row.atoms],
      ["Admin Test", K.body.username, "VIVA Foundation", null, "Primary 6", 1, 100, 1, 50],
    );
    assert.match(row.createdAt, SQL_TIME);
    assert.match(row.lastActive, SQL_TIME);
    assert.ok(row.lastActive >= row.createdAt);
    // Signed up and stayed signed in (no typed PIN since): active since joining, not "Never".
    const quietRow = users.find((u) => u.userId === idOf(quiet));
    assert.equal(quietRow.lastActive, quietRow.createdAt);
    // A centre typed under "Others" is shown, not just "Other".
    const typedRow = users.find((u) => u.userId === idOf(typed));
    assert.deepEqual([typedRow.orgName, typedRow.orgOther], ["Other", "Little Stars Centre"]);
  });

  await t.test("one student's progress", async () => {
    const res = await admin("GET", `/users/${kidId}/progress`);
    assert.equal(res.status, 200);
    assert.deepEqual(keys(res.json), ["games", "progress"]);
    assert.deepEqual(res.json.progress.map(keys), [["completed_at", "last_accessed", "lesson_id", "score", "status"]]);
    assert.deepEqual([res.json.progress[0].lesson_id, res.json.progress[0].status, res.json.progress[0].score], ["mm-exit", "completed", null]);
    assert.deepEqual(res.json.games.map(keys), [["best_score", "game_id", "plays", "updated_at"]]);
    assert.deepEqual([res.json.games[0].game_id, res.json.games[0].best_score, res.json.games[0].plays], ["mm-sci-sim", 55, 1]);
    assert.match(res.json.games[0].updated_at, SQL_TIME);
    assert.equal((await admin("GET", "/users/999999/progress")).status, 404);
  });

  await t.test("changing XP, level and atoms", async () => {
    let res = await admin("PATCH", `/users/${kidId}`, { atoms: 77 });
    assert.deepEqual(res.json, { success: true, user: { xp: 100, level: 1, atoms: 77 } });
    res = await admin("PATCH", `/users/${kidId}`, { xp: 2500, level: 4 });
    assert.deepEqual(res.json, { success: true, user: { xp: 2500, level: 4, atoms: 77 } });
    for (const bad of [{ xp: -1 }, { level: 0 }, { atoms: 1.5 }, { xp: "lots" }, {}]) {
      assert.equal((await admin("PATCH", `/users/${kidId}`, bad)).status, 400, JSON.stringify(bad));
    }
    assert.equal((await kid.get("/api/me")).json.user.level, 4);
    assert.equal((await admin("PATCH", "/users/999999", { xp: 1 })).status, 404);
  });

  await t.test("resetting progress keeps XP", async () => {
    const res = await admin("POST", `/users/${kidId}/reset-progress`);
    assert.deepEqual(res.json, { success: true, removed: { lessons: 1, games: 1 } });
    assert.deepEqual((await kid.get("/api/progress")).json.progress, []);
    assert.deepEqual((await kid.get("/api/game-scores")).json.scores, []);
    assert.equal((await kid.get("/api/me")).json.user.xp, 2500);
  });

  await t.test("a new PIN signs the student out", async () => {
    assert.equal((await admin("POST", `/users/${kidId}/reset-pin`, { pin: "12" })).status, 400);
    const res = await admin("POST", `/users/${kidId}/reset-pin`, { pin: "9876" });
    assert.deepEqual(res.json, { success: true, signedOut: 2 });
    assert.equal((await kid.get("/api/me")).status, 401);
    assert.equal((await kid.post("/api/login", { username: K.body.username, pin: "1234" })).status, 401);
    assert.equal((await kid.post("/api/login", { username: K.body.username, pin: "9876" })).status, 200);
  });

  await t.test("deleting a student needs their username typed back", async () => {
    assert.equal((await admin("DELETE", `/users/${kidId}`, { confirm: "nope" })).status, 400);
    const res = await admin("DELETE", `/users/${kidId}`, { confirm: K.body.username.toUpperCase() });
    assert.deepEqual([res.status, res.json], [200, { success: true }]);
    assert.equal((await kid.get("/api/me")).status, 401);
    assert.ok(!(await admin("GET", "/users")).json.users.some((u) => u.userId === kidId));
    assert.equal((await admin("DELETE", `/users/${kidId}`, { confirm: K.body.username })).status, 404);
  });
});

test("changing the PIN while signed in", async (t) => {
  const kid = srv.client();
  const K = await signUp(kid, { pin: "1234" });
  const tablet = srv.client();
  assert.equal((await tablet.post("/api/login", { username: K.body.username, pin: "1234" })).status, 200);

  await t.test("the new PIN must be 4 digits", async () => {
    for (const newPin of ["12", "12345", "abcd", 1234, undefined]) {
      assert.equal((await kid.post("/api/me/pin", { currentPin: "1234", newPin })).status, 400, `newPin ${newPin}`);
    }
  });

  await t.test("a wrong current PIN is rejected", async () => {
    const res = await kid.post("/api/me/pin", { currentPin: "0000", newPin: "5678" });
    assert.equal(res.status, 401);
    assert.equal((await tablet.post("/api/login", { username: K.body.username, pin: "1234" })).status, 200);
  });

  await t.test("the right PIN changes it and signs out other devices only", async () => {
    const res = await kid.post("/api/me/pin", { currentPin: "1234", newPin: "5678" });
    assert.deepEqual([res.status, res.json.success], [200, true]);
    assert.ok(res.json.otherDevicesSignedOut >= 1);
    assert.equal((await kid.get("/api/me")).status, 200);
    assert.equal((await tablet.get("/api/me")).status, 401);
    const fresh = srv.client();
    assert.equal((await fresh.post("/api/login", { username: K.body.username, pin: "1234" })).status, 401);
    assert.equal((await fresh.post("/api/login", { username: K.body.username, pin: "5678" })).status, 200);
  });

  await t.test("wrong current PINs share the sign-in lockout", async () => {
    // Two failures so far (a wrong current PIN, then the old PIN at sign-in);
    // three more wrong tries here make five.
    for (let i = 0; i < 3; i++) {
      assert.equal((await kid.post("/api/me/pin", { currentPin: "0000", newPin: "1111" })).status, 401);
    }
    const locked = await kid.post("/api/me/pin", { currentPin: "5678", newPin: "1111" });
    assert.equal(locked.status, 429);
    assert.match(locked.json.error, /Too many tries/);
  });
});
