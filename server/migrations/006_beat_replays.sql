-- 006: log of rewarded game replays (GamesTab "Play Again"), used to cap
-- replay rewards at 3 per game per student per 24 hours.
-- Applied by server/db.js; safe to re-run.
CREATE TABLE IF NOT EXISTS beat_replays (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(user_id),
    beat_id      TEXT NOT NULL,
    replayed_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_beat_replays_user_beat_time
    ON beat_replays(user_id, beat_id, replayed_at);
