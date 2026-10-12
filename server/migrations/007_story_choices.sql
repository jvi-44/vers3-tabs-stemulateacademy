-- 007: choices a student made in the interactive intro episodes (who they
-- picked as their buddy, etc.), so later episodes can remember them.
-- Applied by server/db.js; safe to re-run.
CREATE TABLE IF NOT EXISTS story_choices (
    user_id     INTEGER NOT NULL REFERENCES users(user_id),
    beat_id     TEXT NOT NULL,
    choices     TEXT NOT NULL,
    updated_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, beat_id)
);
