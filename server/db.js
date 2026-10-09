import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In production, point DB_PATH at a persistent disk/volume — most hosts wipe
// the app folder on every redeploy, which would delete every account.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "stemulate.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Apply schema (idempotent — CREATE TABLE IF NOT EXISTS)
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
db.exec(schema);

// ---------------------------------------------------------------------------
// Migrations — every file in server/migrations/, applied in filename order
// after schema.sql. They are written to be safe to re-run on every start
// (CREATE ... IF NOT EXISTS). ALTER TABLE ... ADD COLUMN can't be written
// that way in SQLite, so those files are listed here with the column they
// add and skipped once PRAGMA table_info shows the column already exists.
// ---------------------------------------------------------------------------
const COLUMN_GUARDS = {
  "004_users_org_other.sql": { table: "users", column: "org_other" },
};

function hasColumn(table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);
}

// A database created by the short-lived bearer-token build has a `sessions`
// table keyed by token_hash. Sessions are disposable, so drop it and let
// 002_sessions.sql recreate the cookie-session shape (everyone signs in again).
if (hasColumn("sessions", "token_hash")) db.exec("DROP TABLE sessions");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
if (fs.existsSync(MIGRATIONS_DIR)) {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const guard = COLUMN_GUARDS[file];
    if (guard && hasColumn(guard.table, guard.column)) continue;
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
}

// Fixed reference data — matches the dropdown options exactly.
// Order here determines the ids returned to the frontend.
export const ORGANISATIONS = [
  "Brighton Connection",
  "Caritas Singapore",
  "CDAC",
  "Faithacts",
  "New Life Care Centre",
  "Sheng Hong Student Care",
  "VIVA Foundation",
];

// Row used for "Others (please specify)". The centre name the student types is
// stored as free text in users.org_other — sign-up never creates new rows here.
export const OTHER_ORG_NAME = "Other";

const SCHOOL_LEVELS = [
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
];

const RECOVERY_COLOURS = [
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Pink",
];

const RECOVERY_SUBJECTS = [
  "Mathematics",
  "Science",
  "English",
  "Mother Tongue",
  "Art",
  "Music",
  "Physical Education",
];

function seed(table, idCol, nameCol, values) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO ${table} (${nameCol}) VALUES (?)`,
  );
  const insertMany = db.transaction((rows) => {
    for (const v of rows) insert.run(v);
  });
  insertMany(values);
}

seed("organisations", "org_id", "org_name", [...ORGANISATIONS, OTHER_ORG_NAME]);
seed("school_levels", "level_id", "level_name", SCHOOL_LEVELS);
seed("recovery_colours", "colour_id", "colour_name", RECOVERY_COLOURS);
seed("recovery_subjects", "subject_id", "subject_name", RECOVERY_SUBJECTS);

export default db;
