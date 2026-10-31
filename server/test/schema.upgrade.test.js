// supabase/schema.sql is run again on the live database for every update, so
// it must upgrade an older copy that already has students without losing
// anything. This installs the version 3 file (fixtures/schema-v3.sql, from
// round 7), adds a student with progress and sign-in tries, then runs today's
// file twice.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { PGlite } from "@electric-sql/pglite";
import { SCHEMA_FILE } from "../dbConfig.js";

test("today's schema upgrades a version 3 database and keeps its students", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(fs.readFileSync(new URL("./fixtures/schema-v3.sql", import.meta.url), "utf8"));
    const one = async (sql, params) => (await db.query(sql, params)).rows[0];

    const { user_id: id } = await one(
      `INSERT INTO users (full_name, username, pin_hash, school_level_id, org_id, recovery_colour_id, recovery_subject_id, xp, atoms)
       VALUES ('Old Kid', 'old_kid', 'pin-hash', 2, 1, 1, 1, 1234, 56) RETURNING user_id`,
    );
    await db.query("INSERT INTO lesson_progress (user_id, lesson_id, status, score) VALUES ($1, 'mm-sci1-quiz', 'completed', 80)", [id]);
    await db.query("INSERT INTO game_scores (user_id, game_id, best_score) VALUES ($1, 'mm-sci-sim', 70)", [id]);
    await db.query("INSERT INTO sessions (token, user_id, expires_at) VALUES ('hashed-token', $1, 9999999999999)", [id]);
    await db.query("INSERT INTO login_attempts (username, success) VALUES ('old_kid', false), ('old_kid', true)");
    const orgsBefore = (await one("SELECT count(*)::int AS n FROM organisations")).n;

    const schema = fs.readFileSync(SCHEMA_FILE, "utf8");
    await db.exec(schema);
    await db.exec(schema);

    assert.equal((await one("SELECT stem_schema_version() AS v")).v, 6);
    const kid = await one("SELECT full_name, pin_hash, school_level_id, org_id, xp, atoms FROM users WHERE user_id = $1", [id]);
    assert.deepEqual(kid, { full_name: "Old Kid", pin_hash: "pin-hash", school_level_id: 2, org_id: 1, xp: 1234, atoms: 56 });
    assert.equal((await one("SELECT score FROM lesson_progress WHERE user_id = $1", [id])).score, 80);
    assert.equal((await one("SELECT best_score FROM game_scores WHERE user_id = $1", [id])).best_score, 70);
    // Students stay signed in.
    assert.equal((await one("SELECT count(*)::int AS n FROM sessions WHERE user_id = $1", [id])).n, 1);
    // Old tries are kept as sign-in tries, so they don't close Forgot PIN.
    assert.deepEqual(
      (await db.query("SELECT success, kind FROM login_attempts ORDER BY attempt_id")).rows,
      [{ success: false, kind: "sign_in" }, { success: true, kind: "sign_in" }],
    );
    assert.equal((await one("SELECT stem_recovery_misses('old_kid') AS n")).n, 0);
    // The fixed lists keep their ids.
    assert.equal((await one("SELECT count(*)::int AS n FROM organisations")).n, orgsBefore);
    // The new tables start empty, and the student shows up in the new list.
    for (const t of ["centre_sessions", "centre_login_attempts", "staff_actions", "site_signups", "site_counters"]) {
      assert.equal((await one(`SELECT count(*)::int AS n FROM ${t}`)).n, 0, t);
    }
    const listed = (await one("SELECT stem_students_for(NULL) AS j")).j;
    assert.deepEqual(listed.map((s) => [s.username, s.completed]), [["old_kid", 1]]);
  } finally {
    await db.close();
  }
});

test("a schema 5 database: staff accounts go, the activity log and centres stay", async () => {
  const db = await PGlite.create();
  try {
    // As live on 31 Oct 2026 (fixtures/schema-v5.sql), with an account that did things.
    await db.exec(fs.readFileSync(new URL("./fixtures/schema-v5.sql", import.meta.url), "utf8"));
    const one = async (sql, params) => (await db.query(sql, params)).rows[0];
    const { staff_id: staffId } = await one(
      "INSERT INTO staff (full_name, email, role, password_hash) VALUES ('Ms Tan', 'tan@example.org', 'staff', 'hash') RETURNING staff_id",
    );
    await db.query("INSERT INTO staff_centres (staff_id, org_id) VALUES ($1, 1)", [staffId]);
    await db.query("INSERT INTO staff_sessions (token, staff_id, expires_at, created_at, last_seen) VALUES ('t', $1, 1, 1, 1)", [staffId]);
    await db.query("SELECT stem_staff_log_action($1, 'Ms Tan', 'tan@example.org', NULL, 'viewed the student list')", [staffId]);

    const schema = fs.readFileSync(SCHEMA_FILE, "utf8");
    await db.exec(schema);
    await db.exec(schema);

    assert.equal((await one("SELECT stem_schema_version() AS v")).v, 6);
    const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'staff%' ORDER BY 1")).rows;
    assert.deepEqual(tables.map((r) => r.tablename), ["staff_actions"]);
    // The log keeps who did what, as they were.
    assert.deepEqual(await one("SELECT staff_id, staff_name, staff_email, action FROM staff_actions"), {
      staff_id: staffId,
      staff_name: "Ms Tan",
      staff_email: "tan@example.org",
      action: "viewed the student list",
    });
    // No old staff functions are left, and one version of each that stays.
    const old = (await db.query("SELECT proname FROM pg_proc WHERE proname ~ '^stem_staff_' ORDER BY 1")).rows;
    assert.deepEqual(old.map((r) => r.proname), ["stem_staff_actions", "stem_staff_log_action"]);
    const listing = (await db.query("SELECT pronargs FROM pg_proc WHERE proname = 'stem_students_for'")).rows;
    assert.deepEqual(listing.map((r) => r.pronargs), [1]);
    // Centres keep their ids and start with no passkey.
    assert.deepEqual(await one("SELECT org_name, passkey_hash FROM organisations WHERE org_id = 1"), { org_name: "Brighton Connection", passkey_hash: null });
  } finally {
    await db.close();
  }
});
