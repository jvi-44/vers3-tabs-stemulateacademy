// Works out which database the server uses, from its environment variables,
// and refuses settings that would quietly put students' data in the wrong place.
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Every table and stem_* function, for Supabase and the local database alike. */
export const SCHEMA_FILE = path.join(__dirname, "../supabase/schema.sql");

/** Where the local database lives when DB_PATH isn't set (gitignored). */
export const DEFAULT_LOCAL_DIR = path.join(__dirname, ".pglite");

/** The `role` inside a legacy Supabase key (a JWT), or null. */
function jwtRole(key) {
  const payload = key.split(".")[1];
  if (!key.startsWith("eyJ") || !payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
}

/**
 * { kind: "supabase", url, key } when SUPABASE_URL and SUPABASE_SECRET_KEY are
 * set, otherwise { kind: "local", dataDir } (a PGlite folder, or "memory://").
 * Throws with a plain explanation for anything half set up.
 */
export function databaseConfig(env = process.env) {
  const url = (env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (url) {
    if (!/^https?:\/\/[^/\s]+$/.test(url)) {
      throw new Error(`SUPABASE_URL should look like https://<project-ref>.supabase.co (got "${url}").`);
    }
    if (!key) {
      throw new Error(
        "SUPABASE_URL is set but SUPABASE_SECRET_KEY isn't. The server needs the project's secret key " +
          "(Supabase > Project Settings > API Keys > Secret keys, starts with sb_secret_). " +
          "The publishable key can't be used here: every table is locked to the server so students' data stays private.",
      );
    }
    if (key.startsWith("sb_publishable_") || jwtRole(key) === "anon") {
      throw new Error(
        "SUPABASE_SECRET_KEY holds the publishable (anon) key. Use the secret key instead " +
          "(Supabase > Project Settings > API Keys > Secret keys, starts with sb_secret_).",
      );
    }
    return { kind: "supabase", url, key };
  }

  if (key) throw new Error("SUPABASE_SECRET_KEY is set but SUPABASE_URL isn't. Set both, or neither.");

  const dataDir = (env.DB_PATH ?? "").trim();
  if (env.NODE_ENV === "production" && !dataDir) {
    throw new Error(
      "No database is set up for production. Set SUPABASE_URL and SUPABASE_SECRET_KEY (see DEPLOY.md), " +
        "or DB_PATH to a folder on a permanent disk.",
    );
  }
  if (/\.db$/i.test(dataDir)) {
    throw new Error(
      `DB_PATH points at a SQLite file (${dataDir}). The local database is now a folder: ` +
        "remove DB_PATH, or point it at a folder such as server/.pglite.",
    );
  }
  return { kind: "local", dataDir: dataDir || DEFAULT_LOCAL_DIR };
}
