import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "stemulate.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Apply schema (idempotent — CREATE TABLE IF NOT EXISTS)
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
db.exec(schema);

// Fixed reference data — matches the dropdown options exactly.
// Order here determines the ids returned to the frontend.
const ORGANISATIONS = [
  "Brighton Connection",
  "Caritas Singapore",
  "CDAC",
  "Faithacts",
  "New Life Care Centre",
  "Sheng Hong Student Care",
  "VIVA Foundation",
];

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

seed("organisations", "org_id", "org_name", ORGANISATIONS);
seed("school_levels", "level_id", "level_name", SCHOOL_LEVELS);
seed("recovery_colours", "colour_id", "colour_name", RECOVERY_COLOURS);
seed("recovery_subjects", "subject_id", "subject_name", RECOVERY_SUBJECTS);

export default db;
