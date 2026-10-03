-- 003: collectible cards owned by each student (one row per user + card).
-- Applied by server/db.js after schema.sql. Safe to re-run.
CREATE TABLE IF NOT EXISTS user_cards (
    user_id  INTEGER NOT NULL REFERENCES users(user_id),
    card_id  TEXT NOT NULL,
    count    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, card_id)
);
