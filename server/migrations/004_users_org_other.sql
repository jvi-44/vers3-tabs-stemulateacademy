-- 004: free-text centre name for students who pick "Others (please specify)".
-- Sign-up no longer creates organisation rows; it points org_id at the fixed
-- "Other" row (seeded in db.js) and keeps the typed name here.
-- SQLite has no ADD COLUMN IF NOT EXISTS, so server/db.js skips this file
-- once PRAGMA table_info(users) shows org_other (see COLUMN_GUARDS).
ALTER TABLE users ADD COLUMN org_other TEXT;
