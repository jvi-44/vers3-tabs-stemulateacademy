// The database. All SQL lives in supabase/schema.sql as functions named
// stem_*, and the server only ever calls them by name:
//
//   const user = await rpc("stem_user", { p_user_id: 1 });
//
// With SUPABASE_URL and SUPABASE_SECRET_KEY set (on the host), the calls go to
// the Supabase project's Postgres through its API. Without them (your own
// computer, the tests) the same schema.sql runs in PGlite, a copy of Postgres
// kept in a folder (DB_PATH, default server/.pglite) or in memory, so there is
// nothing to install. See dbConfig.js for which settings are accepted.
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { PGlite } from "@electric-sql/pglite";
import { databaseConfig, SCHEMA_FILE } from "./dbConfig.js";
import { callFunction } from "./pgFunctions.js";

/** Must match stem_schema_version() in supabase/schema.sql. */
export const SCHEMA_VERSION = 6;

// Half-finished settings don't throw here (that would print a stack trace
// while the app loads); they fail `ready` below, which index.js reports.
let config;
let configError = null;
try {
  config = databaseConfig();
} catch (err) {
  configError = err;
  config = { kind: "none" };
}
let callDatabase;
let localDb = null;

if (configError) {
  callDatabase = async () => {
    throw configError;
  };
} else if (config.kind === "supabase") {
  const supabase = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Don't let a slow database hold a request open forever.
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15_000) }) },
  });
  callDatabase = async (fn, args) => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      const err = new Error(`Database call ${fn} failed: ${error.message}`);
      err.code = error.code;
      throw err;
    }
    return data;
  };
} else {
  const opened = (async () => {
    localDb = await PGlite.create(config.dataDir === "memory://" ? undefined : config.dataDir);
    // Supabase runs in UTC; keep the local copy the same.
    await localDb.exec("SET TimeZone = 'UTC'");
    await localDb.exec(fs.readFileSync(SCHEMA_FILE, "utf8"));
  })();
  callDatabase = async (fn, args) => {
    await opened;
    return callFunction(localDb, fn, args);
  };
}

/** Calls stem_<name>(...) in the database and returns its JSON result. */
export function rpc(fn, args = {}) {
  // Send exactly what supabase-js would: undefined becomes null (a missing
  // argument would make Postgres look for a different function) and NaN null.
  return callDatabase(fn, JSON.parse(JSON.stringify(args, (_key, value) => (value === undefined ? null : value))));
}

/** One line for the start-up log saying where students' data is kept. */
export const databaseDescription =
  config.kind === "supabase"
    ? `Supabase project ${config.url}`
    : config.kind === "none"
      ? "no database (the settings are incomplete)"
      : config.dataDir === "memory://"
        ? "a temporary in-memory database"
        : `the local database in ${path.relative(process.cwd(), config.dataDir) || config.dataDir}`;

/**
 * Resolves once the database answers with the schema this code expects.
 * Rejects with a plain explanation otherwise (index.js stops the server).
 */
export const ready = (async () => {
  if (configError) throw configError;
  let version;
  try {
    version = await rpc("stem_schema_version");
  } catch (err) {
    if (config.kind === "supabase" && err.code === "PGRST202") {
      throw new Error(
        "Connected to Supabase, but the STEMulate tables aren't there yet. Open the project's SQL Editor, " +
          "paste supabase/schema.sql and press Run.",
      );
    }
    throw new Error(`Can't reach ${databaseDescription}: ${err.message}`);
  }
  if (version !== SCHEMA_VERSION) {
    throw new Error(
      `${databaseDescription} has schema version ${version}, but this code needs ${SCHEMA_VERSION}. ` +
        "Run supabase/schema.sql in the SQL Editor again.",
    );
  }
})();
// Callers that never await `ready` (scripts, the tests' imports) still get an
// error from each database call itself; this only stops an unhandled-rejection warning.
ready.catch(() => {});

/** The PGlite database when running locally (the tests use it), else null. */
export const localDatabase = () => localDb;

export async function closeDatabase() {
  await localDb?.close();
}
