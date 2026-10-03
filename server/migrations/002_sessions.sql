-- 002: server-side login sessions + faster lockout lookups.
-- Applied by server/db.js after schema.sql. Safe to re-run.

-- One row per signed-in browser. `token` holds the SHA-256 hash of the
-- random value in the httpOnly `stem_session` cookie, so a leaked database
-- file can't be replayed as live sessions. `expires_at` is a Unix time in ms.
CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(user_id),
    expires_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Used by the "5 failures in 15 minutes" lockout on /api/login and
-- /api/recover/verify.
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_time ON login_attempts(username, attempted_at);
