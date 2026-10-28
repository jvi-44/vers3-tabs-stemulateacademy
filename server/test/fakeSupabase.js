// A stand-in for a Supabase project, so the tests can run the server exactly as
// it runs against Supabase (supabase-js, HTTP, the secret key) without a real
// project. It answers POST /rest/v1/rpc/<function> like Supabase's API
// (PostgREST): each call runs in its own transaction as service_role, against a
// PGlite database set up with Supabase's roles and their default grants.
import fs from "node:fs";
import http from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { SCHEMA_FILE } from "../dbConfig.js";
import { callFunction } from "../pgFunctions.js";

export const TEST_SECRET_KEY = "sb_secret_test_only_not_a_real_key";

// What a new Supabase project starts with: the API roles, and default grants
// that let them use every new table, sequence and function in `public`.
const SUPABASE_ROLES = `
  CREATE ROLE anon NOLOGIN NOINHERIT;
  CREATE ROLE authenticated NOLOGIN NOINHERIT;
  CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`;

/** A PGlite database that looks like a Supabase project with supabase/schema.sql installed. */
export async function createSupabaseLikeDatabase() {
  const db = await PGlite.create();
  await db.exec("SET TimeZone = 'UTC'");
  await db.exec(SUPABASE_ROLES);
  await db.exec(fs.readFileSync(SCHEMA_FILE, "utf8"));
  return db;
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export async function startFakeSupabase() {
  const db = await createSupabaseLikeDatabase();
  const server = http.createServer(async (req, res) => {
    if (req.headers.apikey !== TEST_SECRET_KEY) {
      return send(res, 401, { message: "Invalid API key" });
    }
    const match = /^\/rest\/v1\/rpc\/([A-Za-z0-9_]+)$/.exec(req.url.split("?")[0]);
    if (req.method !== "POST" || !match) {
      return send(res, 404, { code: "PGRST125", message: `Invalid path: ${req.url}` });
    }
    let args;
    try {
      const text = await readBody(req);
      args = text ? JSON.parse(text) : {};
    } catch {
      return send(res, 400, { code: "PGRST102", message: "Empty or invalid json" });
    }
    try {
      const result = await db.transaction(async (tx) => {
        // Like PostgREST: a STABLE or IMMUTABLE function runs read-only.
        const fn = await tx.query("SELECT provolatile FROM pg_proc WHERE proname = $1 AND pronamespace = 'public'::regnamespace", [match[1]]);
        if (fn.rows[0] && fn.rows[0].provolatile !== "v") await tx.query("SET TRANSACTION READ ONLY");
        await tx.query("SET LOCAL ROLE service_role");
        return callFunction(tx, match[1], args);
      });
      send(res, 200, result ?? null);
    } catch (err) {
      send(res, err.code === "PGRST202" ? 404 : 400, {
        code: err.code ?? "P0001",
        message: err.message,
        details: null,
        hint: null,
      });
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    db,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}
