-- STEMulate Academy — Login & Progress Tracking Schema
-- SQLite (via better-sqlite3)

CREATE TABLE IF NOT EXISTS organisations (
    org_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    org_name    TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS school_levels (
    level_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    level_name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS recovery_colours (
    colour_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    colour_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS recovery_subjects (
    subject_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
    user_id             INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name           TEXT NOT NULL,
    username            TEXT NOT NULL UNIQUE,
    pin_hash            TEXT NOT NULL,
    school_level_id     INTEGER NOT NULL REFERENCES school_levels(level_id),
    org_id              INTEGER NOT NULL REFERENCES organisations(org_id),
    recovery_colour_id  INTEGER NOT NULL REFERENCES recovery_colours(colour_id),
    recovery_subject_id INTEGER NOT NULL REFERENCES recovery_subjects(subject_id),
    xp                  INTEGER NOT NULL DEFAULT 0,
    level               INTEGER NOT NULL DEFAULT 1,
    atoms               INTEGER NOT NULL DEFAULT 0,
    avatar              TEXT,
    created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS lesson_progress (
    progress_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(user_id),
    lesson_id       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'not_started',
    score           INTEGER,
    last_accessed   TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at    TEXT,
    UNIQUE(user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS login_attempts (
    attempt_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT NOT NULL,
    success      INTEGER NOT NULL,
    attempted_at TEXT DEFAULT CURRENT_TIMESTAMP
);
