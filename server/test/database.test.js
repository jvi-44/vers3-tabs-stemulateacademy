// The database layer itself: who may reach students' data on Supabase, which
// settings the server accepts, and that every database call it makes names a
// real stem_* function with the right arguments.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSupabaseLikeDatabase } from "./fakeSupabase.js";
import { databaseConfig, DEFAULT_LOCAL_DIR } from "../dbConfig.js";

const SERVER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let db;
before(async () => {
  db = await createSupabaseLikeDatabase();
});
after(async () => {
  await db.close();
});

const rows = async (sql, params) => (await db.query(sql, params)).rows;

async function stemFunctions() {
  return rows(
    `SELECT p.proname AS name, p.oid::regprocedure::text AS signature, to_json(p.proargnames) AS args
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'stem\\_%'`,
  );
}

const tables = async () =>
  (await rows("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")).map((r) => r.tablename);

test("on Supabase only the server's role can reach students' data", async (t) => {
  const fns = await stemFunctions();
  assert.ok(fns.length > 40, "the stem_* functions are installed");

  await t.test("every table has Row Level Security switched on", async () => {
    const open = await rows(
      `SELECT relname FROM pg_class
        WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND NOT relrowsecurity`,
    );
    assert.deepEqual(open, []);
  });

  await t.test("the publishable key's roles can't use any table or function", async () => {
    for (const role of ["anon", "authenticated"]) {
      for (const table of await tables()) {
        const [{ ok }] = await rows(
          "SELECT has_table_privilege($1, $2, 'SELECT, INSERT, UPDATE, DELETE') AS ok",
          [role, `public.${table}`],
        );
        assert.equal(ok, false, `${role} on ${table}`);
      }
      for (const fn of fns) {
        const [{ ok }] = await rows("SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok", [role, fn.signature]);
        assert.equal(ok, false, `${role} on ${fn.signature}`);
      }
    }
  });

  await t.test("and trying anyway is refused", async () => {
    await db.exec("SET ROLE anon");
    try {
      await assert.rejects(db.query("SELECT stem_reference_data()"), /permission denied/);
      await assert.rejects(db.query("SELECT count(*) FROM users"), /permission denied/);
    } finally {
      await db.exec("RESET ROLE");
    }
  });

  await t.test("the server's role (the secret key) can use all of it", async () => {
    for (const table of await tables()) {
      const [{ ok }] = await rows(
        "SELECT has_table_privilege('service_role', $1, 'SELECT, INSERT, UPDATE, DELETE') AS ok",
        [`public.${table}`],
      );
      assert.equal(ok, true, table);
    }
    for (const fn of fns) {
      const [{ ok }] = await rows("SELECT has_function_privilege('service_role', $1, 'EXECUTE') AS ok", [fn.signature]);
      assert.equal(ok, true, fn.signature);
    }
  });

  await t.test("running schema.sql again changes nothing", async () => {
    await db.exec(fs.readFileSync(path.join(SERVER_DIR, "../supabase/schema.sql"), "utf8"));
    const [{ n }] = await rows("SELECT count(*)::int AS n FROM organisations");
    assert.equal(n, 8);
    assert.equal((await stemFunctions()).length, fns.length);
  });
});

test("every database call in the server names a real function and its arguments", async () => {
  const files = [
    ...fs.readdirSync(SERVER_DIR).filter((f) => f.endsWith(".js")).map((f) => path.join(SERVER_DIR, f)),
    ...fs.readdirSync(path.join(SERVER_DIR, "routes")).map((f) => path.join(SERVER_DIR, "routes", f)),
  ];
  const fns = new Map((await stemFunctions()).map((f) => [f.name, [...(f.args ?? [])].sort()]));
  const calls = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    // Every call must name its function as a plain string, so it can be checked
    // here (supabase.rpc() inside db.js is the client's own method, not a call).
    const everyCall = source.match(/(?<![.\w])(?<!function )rpc\(/g) ?? [];
    const named = [...source.matchAll(/(?<![.\w])rpc\(\s*"([a-z0-9_]+)"/g)];
    assert.equal(named.length, everyCall.length, `${path.basename(file)}: an rpc() call without a plain function name`);
    for (const m of named) {
      // The argument object, if any, read up to its matching closing brace.
      let args = [];
      const start = /^\s*,\s*\{/.exec(source.slice(m.index + m[0].length));
      if (start) {
        const from = m.index + m[0].length + start[0].length;
        let depth = 1;
        let end = from;
        for (; end < source.length && depth > 0; end++) {
          if (source[end] === "{") depth++;
          else if (source[end] === "}") depth--;
        }
        args = [...source.slice(from, end).matchAll(/\b(p_[a-z0-9_]+)\s*:/g)].map((a) => a[1]).sort();
      }
      calls.push({ where: `${path.basename(file)}: ${m[1]}`, fn: m[1], args });
    }
  }
  assert.ok(calls.length > 40, `found ${calls.length} calls`);
  for (const call of calls) {
    assert.ok(fns.has(call.fn), `${call.where} doesn't exist in supabase/schema.sql`);
    assert.deepEqual(call.args, fns.get(call.fn), `${call.where} arguments`);
  }
});

test("the server only accepts complete database settings", () => {
  const secret = "sb_secret_abc";
  const url = "https://abcdefgh.supabase.co";
  const legacy = (role) =>
    `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;

  assert.deepEqual(databaseConfig({ SUPABASE_URL: `${url}/`, SUPABASE_SECRET_KEY: secret }), {
    kind: "supabase",
    url,
    key: secret,
  });
  assert.equal(databaseConfig({ SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: legacy("service_role") }).kind, "supabase");
  assert.deepEqual(databaseConfig({}), { kind: "local", dataDir: DEFAULT_LOCAL_DIR });
  assert.deepEqual(databaseConfig({ DB_PATH: "memory://" }), { kind: "local", dataDir: "memory://" });
  assert.equal(databaseConfig({ NODE_ENV: "production", DB_PATH: "/var/data/pglite" }).kind, "local");

  for (const [env, message] of [
    [{ SUPABASE_URL: url }, /SUPABASE_SECRET_KEY isn't/],
    [{ SUPABASE_URL: url, SUPABASE_SECRET_KEY: "sb_publishable_abc" }, /publishable/],
    [{ SUPABASE_URL: url, SUPABASE_SECRET_KEY: legacy("anon") }, /publishable/],
    [{ SUPABASE_URL: `${url}/rest/v1`, SUPABASE_SECRET_KEY: secret }, /should look like/],
    [{ SUPABASE_SECRET_KEY: secret }, /SUPABASE_URL isn't/],
    [{ NODE_ENV: "production" }, /No database is set up for production/],
    [{ DB_PATH: "server/stemulate.db" }, /SQLite file/],
  ]) {
    assert.throws(() => databaseConfig(env), message, JSON.stringify(env));
  }
});
