// Shared test harness: boots the real Express app against a throwaway database
// and gives each test a tiny fetch client with its own cookie jar.
//
// By default the database is an in-memory PGlite. With TEST_DB=supabase
// (npm run test:server runs both) the server instead talks to a stand-in for
// Supabase over HTTP through supabase-js, exactly as it does on the host.
import { startFakeSupabase, TEST_SECRET_KEY } from "./fakeSupabase.js";

export async function startServer() {
  process.env.SESSION_SECRET ||= "test-secret-not-for-production";
  // Never call the real Gemini API, or a real Supabase project, from tests.
  // Empty rather than unset, because dotenv won't override an empty value.
  process.env.GEMINI_API_KEY = "";
  process.env.GEMINI_SITE_API_KEY = "";
  process.env.GEMINI_MODEL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";

  const fake = process.env.TEST_DB === "supabase" ? await startFakeSupabase() : null;
  process.env.SUPABASE_URL = fake ? fake.url : "";
  process.env.SUPABASE_SECRET_KEY = fake ? TEST_SECRET_KEY : "";
  process.env.DB_PATH = "memory://";

  // Imported only now, because db.js picks the database when it loads.
  const { default: app } = await import("../app.js");
  const database = await import("../db.js");
  await database.ready;
  const db = fake ? fake.db : database.localDatabase();

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    base,
    /** Runs SQL straight against the test database (Postgres, $1-style
     *  parameters) and returns the rows. For setting up and checking state. */
    sql: async (text, params = []) => (await db.query(text, params)).rows,
    client: () => makeClient(base),
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await database.closeDatabase();
      await fake?.close();
    },
  };
}

function makeClient(base) {
  let cookie = "";
  async function call(method, urlPath, body) {
    const res = await fetch(base + urlPath, {
      method,
      headers: {
        // What a browser on the Academy's own pages sends (APP_ORIGIN's default).
        origin: "http://localhost:5173",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) {
      const pair = c.split(";")[0];
      // A cleared cookie comes back with an empty value.
      cookie = pair.endsWith("=") ? "" : pair;
    }
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: res.status, json, text, headers: res.headers };
  }
  return {
    get: (p) => call("GET", p),
    post: (p, body = {}) => call("POST", p, body),
    del: (p, body) => call("DELETE", p, body),
    patch: (p, body = {}) => call("PATCH", p, body),
    put: (p, body = {}) => call("PUT", p, body),
    get cookie() {
      return cookie;
    },
  };
}

let counter = 0;
/** Signs up a fresh user on `client` (which then holds its session cookie). */
export async function signUp(client, overrides = {}) {
  counter += 1;
  const body = {
    fullName: "Ava",
    username: `kid_${process.pid}_${counter}`,
    pin: "1234",
    schoolLevelId: 1,
    orgId: 1,
    recoveryColourId: 1,
    recoverySubjectId: 1,
    consent: true,
    ...overrides,
  };
  const res = await client.post("/api/signup", body);
  return { ...res, body };
}
