-- STEMulate Academy: Postgres version of server/schema.sql, for Supabase.
--
-- How to use: open your Supabase project > SQL Editor > New query, paste this
-- whole file and press Run. Then do the same with seed.sql. Both files are
-- safe to run more than once.
--
-- Row Level Security is switched on for every table with no policies, so the
-- browser (publishable key) can't read or write anything. Only the Express
-- server, using the secret key, can reach students' data.

CREATE TABLE IF NOT EXISTS organisations (
    org_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    org_name    TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS school_levels (
    level_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    level_name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS recovery_colours (
    colour_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    colour_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS recovery_subjects (
    subject_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
    user_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name           TEXT NOT NULL,
    username            TEXT NOT NULL,
    pin_hash            TEXT NOT NULL,
    school_level_id     BIGINT NOT NULL REFERENCES school_levels(level_id),
    org_id              BIGINT NOT NULL REFERENCES organisations(org_id),
    recovery_colour_id  BIGINT NOT NULL REFERENCES recovery_colours(colour_id),
    recovery_subject_id BIGINT NOT NULL REFERENCES recovery_subjects(subject_id),
    xp                  INTEGER NOT NULL DEFAULT 0,
    level               INTEGER NOT NULL DEFAULT 1,
    atoms               INTEGER NOT NULL DEFAULT 0,
    avatar              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usernames are unique ignoring capital letters ("Alice" and "alice" clash),
-- matching the COLLATE NOCASE checks in the SQLite version.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(username));

-- Deleting a user removes every row tied to them (PDPA retention, see
-- docs/DATA_PRIVACY.md), hence ON DELETE CASCADE below.
CREATE TABLE IF NOT EXISTS lesson_progress (
    progress_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    lesson_id       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'not_started'
                    CHECK (status IN ('not_started', 'in_progress', 'completed')),
    score           INTEGER,
    last_accessed   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS login_attempts (
    attempt_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username     TEXT NOT NULL,
    success      BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts (lower(username));

-- Only a SHA-256 hash of each sign-in token is stored.
CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS friend_requests (
    request_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    from_user_id  BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    to_user_id    BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (from_user_id, to_user_id)
);

-- One row per friendship, smaller user_id first.
CREATE TABLE IF NOT EXISTS friendships (
    user_a      BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    user_b      BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_a, user_b),
    CHECK (user_a < user_b)
);

-- A one-to-one chat (is_group = false) or a named group chat.
CREATE TABLE IF NOT EXISTS conversations (
    conversation_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    is_group         BOOLEAN NOT NULL DEFAULT false,
    name             TEXT,
    created_by       BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id  BIGINT NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    user_id          BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_user ON conversation_members (user_id);

-- A deleted account's messages are removed too (CASCADE, not SET NULL).
CREATE TABLE IF NOT EXISTS messages (
    message_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id  BIGINT NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    sender_id        BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
    body             TEXT NOT NULL CHECK (char_length(body) <= 500),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages (conversation_id, message_id);

-- Best score (0-100) per lesson game.
CREATE TABLE IF NOT EXISTS game_scores (
    user_id     BIGINT  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    game_id     TEXT    NOT NULL,
    best_score  INTEGER NOT NULL CHECK (best_score BETWEEN 0 AND 100),
    plays       INTEGER NOT NULL DEFAULT 1,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, game_id)
);

-- Lock every table to the server's secret key (no policies = no browser access).
ALTER TABLE organisations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_levels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_colours     ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_subjects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress      ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships          ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_scores          ENABLE ROW LEVEL SECURITY;
