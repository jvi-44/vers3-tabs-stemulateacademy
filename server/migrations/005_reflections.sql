-- 005: exit-card reflections shown in the Gallery.
-- One reflection per student per exit card. Applied by server/db.js; safe to re-run.
CREATE TABLE IF NOT EXISTS reflections (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(user_id),
    beat_id     TEXT NOT NULL,
    caption     TEXT NOT NULL CHECK (length(caption) <= 280),
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, beat_id)
);
