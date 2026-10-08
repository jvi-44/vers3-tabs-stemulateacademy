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

-- ---------------------------------------------------------
-- Sessions — a random token per sign-in. Only a SHA-256 hash of the token
-- is stored, so a copy of the database can't be used to log in as anyone.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ---------------------------------------------------------
-- Friends. A request only exists between two real accounts; once accepted,
-- one friendships row is stored with the smaller user_id in user_a.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS friend_requests (
    request_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id  INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    to_user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_user_id, to_user_id)
);

CREATE TABLE IF NOT EXISTS friendships (
    user_a      INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    user_b      INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_a, user_b),
    CHECK (user_a < user_b)
);

-- ---------------------------------------------------------
-- Chats. A conversation is either a one-to-one chat (is_group = 0, exactly
-- two members) or a named group chat (is_group = 1).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    conversation_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    is_group         INTEGER NOT NULL DEFAULT 0,
    name             TEXT,
    created_by       INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id  INTEGER NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    user_id          INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    joined_at        TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_user ON conversation_members(user_id);

CREATE TABLE IF NOT EXISTS messages (
    message_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id  INTEGER NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    sender_id        INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    body             TEXT NOT NULL,
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages(conversation_id, message_id);

-- Best score (0-100) per lesson game, see server/gameRooms.js
CREATE TABLE IF NOT EXISTS game_scores (
    user_id     INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    game_id     TEXT    NOT NULL,
    best_score  INTEGER NOT NULL,
    plays       INTEGER NOT NULL DEFAULT 1,
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, game_id)
);
