// Shared test harness: boots the real Express app against a throwaway SQLite
// file and gives each test a tiny fetch client with its own cookie jar.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export async function startServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stemulate-test-"));
  process.env.DB_PATH = path.join(dir, "test.db");
  process.env.SESSION_SECRET ||= "test-secret-not-for-production";
  // Never call the real Gemini API from tests (dotenv won't override this).
  process.env.GEMINI_API_KEY = "";

  // Imported only after DB_PATH is set, because db.js opens the file on load.
  const { default: app } = await import("../app.js");
  const { default: db } = await import("../db.js");

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    base,
    db,
    client: () => makeClient(base),
    async close() {
      await new Promise((resolve) => server.close(resolve));
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function makeClient(base) {
  let cookie = "";
  async function call(method, urlPath, body) {
    const res = await fetch(base + urlPath, {
      method,
      headers: {
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
