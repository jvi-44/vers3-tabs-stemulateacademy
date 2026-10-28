-- STEMulate Academy database (Postgres).
--
-- On Supabase: open the project > SQL Editor > New query, paste this whole
-- file and press Run. Run it again whenever this file changes: it is safe to
-- run more than once and never deletes students' data. The server checks at
-- start-up that stem_schema_version() below matches its code.
--
-- On your own computer and in the tests the server runs this same file in
-- PGlite, a copy of Postgres that lives in a folder or in memory, so there is
-- nothing to set up there.
--
-- All reading and writing happens in the stem_* functions further down. The
-- Express server calls them by name through Supabase's API with the project's
-- secret key (server/db.js). Row Level Security is on for every table with no
-- policies, and the browser roles (anon, authenticated) may not use the tables
-- or call the functions, so the publishable key can't read or change anything:
-- only the server can reach students' data.
--
-- Changing a function's arguments? DROP the old one first, otherwise Postgres
-- keeps both and the API can't tell them apart.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organisations (
    org_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    org_name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS school_levels (
    level_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    level_name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS recovery_colours (
    colour_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    colour_name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS recovery_subjects (
    subject_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
    user_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name           TEXT NOT NULL,
    username            TEXT NOT NULL,
    pin_hash            TEXT NOT NULL,
    school_level_id     BIGINT NOT NULL REFERENCES school_levels(level_id),
    org_id              BIGINT NOT NULL REFERENCES organisations(org_id),
    -- The centre name typed for "Others (please specify)"; org_id is then "Other".
    org_other           TEXT,
    recovery_colour_id  BIGINT NOT NULL REFERENCES recovery_colours(colour_id),
    recovery_subject_id BIGINT NOT NULL REFERENCES recovery_subjects(subject_id),
    xp                  INTEGER NOT NULL DEFAULT 0,
    level               INTEGER NOT NULL DEFAULT 1,
    atoms               INTEGER NOT NULL DEFAULT 0,
    avatar              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Older copies of this file had no org_other.
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_other TEXT;

-- Usernames are unique ignoring capital letters ("Alice" and "alice" clash).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(username));

-- Every foreign key has an index (here and below), so deleting a row never
-- scans a whole table to find what points at it. Supabase's Performance
-- Advisor checks for these.
CREATE INDEX IF NOT EXISTS idx_users_school_level ON users (school_level_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON users (org_id);
CREATE INDEX IF NOT EXISTS idx_users_recovery_colour ON users (recovery_colour_id);
CREATE INDEX IF NOT EXISTS idx_users_recovery_subject ON users (recovery_subject_id);

-- Deleting a user removes every row tied to them (PDPA, see
-- docs/DATA_PRIVACY.md), hence ON DELETE CASCADE below. stem_user_delete()
-- also removes them one by one, so the cascades are a safety net for deletes
-- made in the Supabase dashboard.
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
    attempt_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      TEXT NOT NULL,
    success       BOOLEAN NOT NULL,
    attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Used by the "5 failures in 15 minutes" lockout.
DROP INDEX IF EXISTS idx_login_attempts_username;
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_time ON login_attempts (lower(username), attempted_at);

-- Older copies of this file had a sessions table with a different layout.
-- Sessions are disposable (everyone just signs in again), so it is replaced.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'token_hash') THEN
    DROP TABLE public.sessions;
  END IF;
END $$;

-- One row per signed-in browser. `token` is the SHA-256 hash of the random
-- value in the httpOnly stem_session cookie, so a leaked database can't be
-- replayed as live sessions. `expires_at` is a Unix time in milliseconds.
CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expires_at);

-- A request only exists between two real accounts.
CREATE TABLE IF NOT EXISTS friend_requests (
    request_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    from_user_id  BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    to_user_id    BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests (to_user_id);

-- One row per friendship, smaller user_id first.
CREATE TABLE IF NOT EXISTS friendships (
    user_a      BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    user_b      BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_a, user_b),
    CHECK (user_a < user_b)
);

CREATE INDEX IF NOT EXISTS idx_friendships_b ON friendships (user_b);

-- A one-to-one chat (is_group = false, exactly two members) or a named group chat.
CREATE TABLE IF NOT EXISTS conversations (
    conversation_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    is_group         BOOLEAN NOT NULL DEFAULT false,
    name             TEXT,
    created_by       BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations (created_by);

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
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id);

-- Best score (0-100) per lesson game (server/gameRooms.js).
CREATE TABLE IF NOT EXISTS game_scores (
    user_id     BIGINT  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    game_id     TEXT    NOT NULL,
    best_score  INTEGER NOT NULL CHECK (best_score BETWEEN 0 AND 100),
    plays       INTEGER NOT NULL DEFAULT 1,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, game_id)
);

-- Collectible cards owned by each student (one row per student + card).
CREATE TABLE IF NOT EXISTS user_cards (
    user_id  BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    card_id  TEXT NOT NULL,
    count    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, card_id)
);

-- Exit-card reflections, one per student per exit card. Only the student who
-- wrote one gets it back ("Download my data"); other students never see them.
CREATE TABLE IF NOT EXISTS reflections (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    beat_id     TEXT NOT NULL,
    caption     TEXT NOT NULL CHECK (char_length(caption) <= 280),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, beat_id)
);

-- Rewarded game replays (Games tab "Play Again"), capped per game per day.
CREATE TABLE IF NOT EXISTS beat_replays (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    beat_id      TEXT NOT NULL,
    replayed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beat_replays_user_beat_time ON beat_replays (user_id, beat_id, replayed_at);

-- Choices made in the interactive intro episodes (who they picked as their
-- buddy, etc.), kept as the JSON text the story route writes.
CREATE TABLE IF NOT EXISTS story_choices (
    user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    beat_id     TEXT NOT NULL,
    choices     TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, beat_id)
);

-- ---------------------------------------------------------------------------
-- Fixed lists for the sign-up drop-downs. The order sets the ids the app
-- uses. "Other" is the row behind "Others (please specify)".
-- ---------------------------------------------------------------------------

INSERT INTO organisations (org_name) VALUES
    ('Brighton Connection'),
    ('Caritas Singapore'),
    ('CDAC'),
    ('Faithacts'),
    ('New Life Care Centre'),
    ('Sheng Hong Student Care'),
    ('VIVA Foundation'),
    ('Other')
ON CONFLICT (org_name) DO NOTHING;

INSERT INTO school_levels (level_name) VALUES
    ('Primary 1'), ('Primary 2'), ('Primary 3'), ('Primary 4'), ('Primary 5'), ('Primary 6')
ON CONFLICT (level_name) DO NOTHING;

INSERT INTO recovery_colours (colour_name) VALUES
    ('Red'), ('Orange'), ('Yellow'), ('Green'), ('Blue'), ('Purple'), ('Pink')
ON CONFLICT (colour_name) DO NOTHING;

INSERT INTO recovery_subjects (subject_name) VALUES
    ('Mathematics'), ('Science'), ('English'), ('Mother Tongue'), ('Art'), ('Music'), ('Physical Education')
ON CONFLICT (subject_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Bump this, and SCHEMA_VERSION in server/db.js, whenever this file changes.
CREATE OR REPLACE FUNCTION stem_schema_version() RETURNS json
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT to_json(3)
$$;

-- Times go out the way the API has always sent them: "2026-10-17 08:30:00",
-- in UTC. The admin page and the chat read exactly this format.
CREATE OR REPLACE FUNCTION stem_ts(t timestamptz) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT to_char(t AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
$$;

-- A student's account as the server uses it, without the PIN hash or the
-- recovery answers.
CREATE OR REPLACE FUNCTION stem_user_json(u users) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN u.user_id IS NULL THEN NULL ELSE json_build_object(
    'user_id', u.user_id,
    'full_name', u.full_name,
    'username', u.username,
    'school_level_id', u.school_level_id,
    'org_id', u.org_id,
    'org_other', u.org_other,
    'xp', u.xp,
    'level', u.level,
    'atoms', u.atoms,
    'avatar', u.avatar,
    'created_at', stem_ts(u.created_at),
    'updated_at', stem_ts(u.updated_at)) END
$$;

-- What other students may see of an account: never the full name or centre.
CREATE OR REPLACE FUNCTION stem_public_user(u users) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT json_build_object('user_id', u.user_id, 'username', u.username, 'avatar', u.avatar, 'level', u.level)
$$;

-- Adds XP and atoms and works the level out again: one level per 1000 XP, the
-- same rule the app shows (src/app/App.tsx). Nothing changes for a 0/0 reward.
CREATE OR REPLACE FUNCTION stem_add_rewards(p_user_id bigint, p_xp integer, p_atoms integer) RETURNS void
LANGUAGE sql SET search_path = public AS $$
  UPDATE users
     SET xp = xp + p_xp, level = (xp + p_xp) / 1000 + 1, atoms = atoms + p_atoms, updated_at = now()
   WHERE user_id = p_user_id AND (p_xp <> 0 OR p_atoms <> 0);
$$;

CREATE OR REPLACE FUNCTION stem_make_friends(p_a bigint, p_b bigint) RETURNS void
LANGUAGE sql SET search_path = public AS $$
  INSERT INTO friendships (user_a, user_b) VALUES (least(p_a, p_b), greatest(p_a, p_b)) ON CONFLICT DO NOTHING;
  DELETE FROM friend_requests
   WHERE (from_user_id = p_a AND to_user_id = p_b) OR (from_user_id = p_b AND to_user_id = p_a);
$$;

-- True when p_user_id is friends with every id in p_ids (a JSON array). An
-- empty array, a null or a stranger makes it false.
CREATE OR REPLACE FUNCTION stem_friends_with_all(p_user_id bigint, p_ids json) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT json_array_length(p_ids) > 0 AND NOT EXISTS (
    SELECT 1 FROM json_array_elements_text(p_ids) AS e(id)
     WHERE e.id IS NULL OR NOT EXISTS (
       SELECT 1 FROM friendships f
        WHERE f.user_a = least(p_user_id, e.id::bigint) AND f.user_b = greatest(p_user_id, e.id::bigint)))
$$;

-- A chat as the chat list shows it: its row, the members (sorted by name,
-- ignoring case) and the latest message. The server works out the title and
-- picture for whoever is asking.
CREATE OR REPLACE FUNCTION stem_conversation_summary(p_conversation_id bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT json_build_object(
    'conversation_id', c.conversation_id,
    'is_group', c.is_group,
    'name', c.name,
    'created_by', c.created_by,
    'members', (SELECT coalesce(json_agg(stem_public_user(u) ORDER BY lower(u.username) COLLATE "C"), '[]')
                  FROM conversation_members m JOIN users u ON u.user_id = m.user_id
                 WHERE m.conversation_id = c.conversation_id),
    'last', (SELECT json_build_object('message_id', m.message_id, 'body', m.body,
                                      'created_at', stem_ts(m.created_at), 'sender', u.username)
               FROM messages m LEFT JOIN users u ON u.user_id = m.sender_id
              WHERE m.conversation_id = c.conversation_id
              ORDER BY m.message_id DESC LIMIT 1))
    FROM conversations c
   WHERE c.conversation_id = p_conversation_id
$$;

-- ---------------------------------------------------------------------------
-- Sign-up, sign-in, sessions and Forgot PIN
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION stem_reference_data() RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT json_build_object(
    -- "Other" is a separate option on the form.
    'organisations', (SELECT coalesce(json_agg(json_build_object('id', org_id, 'name', org_name) ORDER BY org_id), '[]')
                        FROM organisations WHERE org_name <> 'Other'),
    'schoolLevels', (SELECT coalesce(json_agg(json_build_object('id', level_id, 'name', level_name) ORDER BY level_id), '[]')
                       FROM school_levels),
    'recoveryColours', (SELECT coalesce(json_agg(json_build_object('id', colour_id, 'name', colour_name) ORDER BY colour_id), '[]')
                          FROM recovery_colours),
    'recoverySubjects', (SELECT coalesce(json_agg(json_build_object('id', subject_id, 'name', subject_name) ORDER BY subject_id), '[]')
                           FROM recovery_subjects))
$$;

-- Creates an account. Returns {user}, or {error: 'incomplete'} for a drop-down
-- id that doesn't exist, or {error: 'taken'} when the username is in use.
CREATE OR REPLACE FUNCTION stem_signup(
  p_full_name text, p_username text, p_pin_hash text, p_school_level_id bigint, p_org_id bigint,
  p_org_other text, p_recovery_colour_id bigint, p_recovery_subject_id bigint) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_org bigint;
  u users;
BEGIN
  -- "Others (please specify)" points at the fixed "Other" row and keeps the typed name.
  IF p_org_other IS NOT NULL THEN
    SELECT org_id INTO v_org FROM organisations WHERE org_name = 'Other';
  ELSE
    SELECT org_id INTO v_org FROM organisations WHERE org_id = p_org_id AND org_name <> 'Other';
  END IF;
  IF v_org IS NULL
     OR NOT EXISTS (SELECT 1 FROM school_levels WHERE level_id = p_school_level_id)
     OR NOT EXISTS (SELECT 1 FROM recovery_colours WHERE colour_id = p_recovery_colour_id)
     OR NOT EXISTS (SELECT 1 FROM recovery_subjects WHERE subject_id = p_recovery_subject_id) THEN
    RETURN json_build_object('error', 'incomplete');
  END IF;
  IF EXISTS (SELECT 1 FROM users WHERE lower(username) = lower(p_username)) THEN
    RETURN json_build_object('error', 'taken');
  END IF;
  INSERT INTO users (full_name, username, pin_hash, school_level_id, org_id, org_other,
                     recovery_colour_id, recovery_subject_id)
  VALUES (p_full_name, p_username, p_pin_hash, p_school_level_id, v_org, p_org_other,
          p_recovery_colour_id, p_recovery_subject_id)
  RETURNING * INTO u;
  RETURN json_build_object('user', stem_user_json(u));
EXCEPTION WHEN unique_violation THEN
  -- Two sign-ups raced for the same name; the unique index decided.
  RETURN json_build_object('error', 'taken');
END $$;

-- The account for a typed username (exact match first, then ignoring case),
-- with its PIN hash. Sign-in only.
CREATE OR REPLACE FUNCTION stem_user_for_login(p_username text) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT json_build_object('user', stem_user_json(u), 'pin_hash', u.pin_hash)
    FROM users u
   WHERE lower(u.username) = lower(p_username)
   ORDER BY u.username = p_username DESC
   LIMIT 1
$$;

-- Failed sign-in and Forgot-PIN tries for a username in the last 15 minutes,
-- ignoring case, so changing the case can't reset the count.
CREATE OR REPLACE FUNCTION stem_recent_failures(p_username text) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT to_json(count(*)) FROM login_attempts
   WHERE lower(username) = lower(p_username) AND NOT success
     AND attempted_at > now() - interval '15 minutes'
$$;

CREATE OR REPLACE FUNCTION stem_log_attempt(p_username text, p_success boolean) RETURNS json
LANGUAGE sql SET search_path = public AS $$
  INSERT INTO login_attempts (username, success) VALUES (p_username, p_success);
  SELECT NULL::json;
$$;

-- Forgot PIN, step 1: the recovery answers for an exact username.
CREATE OR REPLACE FUNCTION stem_recovery_answers(p_username text) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT json_build_object('user_id', user_id, 'recovery_colour_id', recovery_colour_id,
                           'recovery_subject_id', recovery_subject_id)
    FROM users WHERE username = p_username
$$;

-- Forgot PIN, step 2: a new PIN hash for an exact username. A new PIN signs
-- the account out of every device. Returns the user id, or null.
CREATE OR REPLACE FUNCTION stem_set_pin_for_username(p_username text, p_pin_hash text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_user_id bigint;
BEGIN
  UPDATE users SET pin_hash = p_pin_hash, updated_at = now()
   WHERE username = p_username
  RETURNING user_id INTO v_user_id;
  DELETE FROM sessions WHERE user_id = v_user_id;
  RETURN to_json(v_user_id);
END $$;

-- p_token is the SHA-256 hash of the cookie's value; times are Unix
-- milliseconds from the server. Clears out expired sessions as it goes.
CREATE OR REPLACE FUNCTION stem_session_create(p_token text, p_user_id bigint, p_expires_at bigint, p_now bigint) RETURNS json
LANGUAGE sql SET search_path = public AS $$
  DELETE FROM sessions WHERE expires_at <= p_now;
  INSERT INTO sessions (token, user_id, expires_at) VALUES (p_token, p_user_id, p_expires_at);
  SELECT NULL::json;
$$;

-- The signed-in user's id for a session token, or null.
CREATE OR REPLACE FUNCTION stem_session_user(p_token text, p_now bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT to_json(user_id) FROM sessions WHERE token = p_token AND expires_at > p_now
$$;

CREATE OR REPLACE FUNCTION stem_session_delete(p_token text) RETURNS json
LANGUAGE sql SET search_path = public AS $$
  DELETE FROM sessions WHERE token = p_token;
  SELECT NULL::json;
$$;

-- ---------------------------------------------------------------------------
-- The signed-in student's own account
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION stem_user(p_user_id bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT stem_user_json(u) FROM users u WHERE u.user_id = p_user_id
$$;

CREATE OR REPLACE FUNCTION stem_user_profile(p_user_id bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT json_build_object('user', stem_user_json(u), 'org_name', o.org_name, 'level_name', s.level_name)
    FROM users u
    JOIN organisations o ON o.org_id = u.org_id
    JOIN school_levels s ON s.level_id = u.school_level_id
   WHERE u.user_id = p_user_id
$$;

CREATE OR REPLACE FUNCTION stem_user_pin_hash(p_user_id bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT to_json(pin_hash) FROM users WHERE user_id = p_user_id
$$;

CREATE OR REPLACE FUNCTION stem_username_taken(p_username text, p_except_user_id bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT to_json(EXISTS (SELECT 1 FROM users
                          WHERE lower(username) = lower(p_username) AND user_id <> p_except_user_id))
$$;

-- Changes the username and display name. Failed sign-in tries move to the new
-- username, so a rename can't reset the lockout. {ok} or {error: 'taken'}.
CREATE OR REPLACE FUNCTION stem_user_rename(p_user_id bigint, p_username text, p_full_name text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_old text;
BEGIN
  SELECT username INTO v_old FROM users WHERE user_id = p_user_id FOR UPDATE;
  UPDATE users SET username = p_username, full_name = p_full_name, updated_at = now()
   WHERE user_id = p_user_id;
  IF v_old IS DISTINCT FROM p_username THEN
    UPDATE login_attempts SET username = p_username WHERE lower(username) = lower(v_old);
  END IF;
  RETURN json_build_object('ok', true);
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('error', 'taken');
END $$;

CREATE OR REPLACE FUNCTION stem_set_avatar(p_user_id bigint, p_avatar text) RETURNS json
LANGUAGE sql SET search_path = public AS $$
  UPDATE users SET avatar = p_avatar, updated_at = now() WHERE user_id = p_user_id;
  SELECT NULL::json;
$$;

-- Moves a student to another school level (they move up every January).
-- True, or null if there is no such level.
CREATE OR REPLACE FUNCTION stem_user_set_level(p_user_id bigint, p_level_id bigint) RETURNS json
LANGUAGE sql SET search_path = public AS $$
  UPDATE users SET school_level_id = p_level_id, updated_at = now()
   WHERE user_id = p_user_id AND EXISTS (SELECT 1 FROM school_levels WHERE level_id = p_level_id)
  RETURNING to_json(true);
$$;

-- A new PIN hash the student chose while signed in. Signs out every other
-- device: every session except p_keep_token (the hash of this browser's
-- cookie). Returns how many sessions ended.
CREATE OR REPLACE FUNCTION stem_user_change_pin(p_user_id bigint, p_pin_hash text, p_keep_token text) RETURNS json
LANGUAGE sql SET search_path = public AS $$
  UPDATE users SET pin_hash = p_pin_hash, updated_at = now() WHERE user_id = p_user_id;
  WITH gone AS (DELETE FROM sessions WHERE user_id = p_user_id AND token <> p_keep_token RETURNING 1)
  SELECT to_json(count(*)) FROM gone;
$$;

-- "Download my data": everything stored about one student, in the shapes the
-- export has always used (the server adds the profile).
CREATE OR REPLACE FUNCTION stem_user_export(p_user_id bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT json_build_object(
    'progress', (SELECT coalesce(json_agg(json_build_object(
                     'lesson_id', lesson_id, 'status', status, 'score', score,
                     'last_accessed', stem_ts(last_accessed), 'completed_at', stem_ts(completed_at))
                   ORDER BY lesson_id COLLATE "C"), '[]')
                   FROM lesson_progress WHERE user_id = p_user_id),
    'gameScores', (SELECT coalesce(json_agg(json_build_object(
                       'game_id', game_id, 'best_score', best_score, 'plays', plays, 'updated_at', stem_ts(updated_at))
                     ORDER BY game_id COLLATE "C"), '[]')
                     FROM game_scores WHERE user_id = p_user_id),
    'friends', (SELECT coalesce(json_agg(json_build_object('username', u.username, 'friends_since', stem_ts(f.created_at))
                  ORDER BY f.created_at, u.user_id), '[]')
                  FROM friendships f
                  JOIN users u ON u.user_id = CASE WHEN f.user_a = p_user_id THEN f.user_b ELSE f.user_a END
                 WHERE f.user_a = p_user_id OR f.user_b = p_user_id),
    'messagesSent', (SELECT coalesce(json_agg(json_build_object(
                         'conversation_id', c.conversation_id, 'chat', coalesce(c.name, 'Direct chat'),
                         'body', m.body, 'created_at', stem_ts(m.created_at))
                       ORDER BY m.message_id), '[]')
                       FROM messages m JOIN conversations c ON c.conversation_id = m.conversation_id
                      WHERE m.sender_id = p_user_id),
    'loginHistory', (SELECT coalesce(json_agg(json_build_object(
                         'success', CASE WHEN a.success THEN 1 ELSE 0 END, 'attempted_at', stem_ts(a.attempted_at))
                       ORDER BY a.attempt_id), '[]')
                       FROM login_attempts a JOIN users u ON lower(a.username) = lower(u.username)
                      WHERE u.user_id = p_user_id),
    'cards', (SELECT coalesce(json_agg(json_build_object('card_id', card_id, 'count', count)
                ORDER BY card_id COLLATE "C"), '[]')
                FROM user_cards WHERE user_id = p_user_id AND count > 0),
    'reflections', (SELECT coalesce(json_agg(json_build_object(
                        'beat_id', beat_id, 'caption', caption, 'created_at', stem_ts(created_at))
                      ORDER BY id), '[]')
                      FROM reflections WHERE user_id = p_user_id),
    'storyChoices', (SELECT coalesce(json_agg(json_build_object(
                         'beat_id', beat_id, 'choices', choices, 'updated_at', stem_ts(updated_at))
                       ORDER BY beat_id COLLATE "C"), '[]')
                       FROM story_choices WHERE user_id = p_user_id))
$$;

-- Removes an account and everything tied to it ("Delete my account" and the
-- admin page). Group chats the student was in stay, minus them; chats left
-- with fewer than two people go. False if there was no such account.
CREATE OR REPLACE FUNCTION stem_user_delete(p_user_id bigint) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_username text;
BEGIN
  SELECT username INTO v_username FROM users WHERE user_id = p_user_id FOR UPDATE;
  IF v_username IS NULL THEN
    RETURN to_json(false);
  END IF;
  DELETE FROM messages WHERE sender_id = p_user_id;
  DELETE FROM conversation_members WHERE user_id = p_user_id;
  DELETE FROM conversations WHERE conversation_id IN (
    SELECT c.conversation_id FROM conversations c
      LEFT JOIN conversation_members m ON m.conversation_id = c.conversation_id
     GROUP BY c.conversation_id
    HAVING count(m.user_id) < 2 AND (NOT c.is_group OR count(m.user_id) = 0));
  DELETE FROM friend_requests WHERE from_user_id = p_user_id OR to_user_id = p_user_id;
  DELETE FROM friendships WHERE user_a = p_user_id OR user_b = p_user_id;
  DELETE FROM sessions WHERE user_id = p_user_id;
  DELETE FROM lesson_progress WHERE user_id = p_user_id;
  DELETE FROM game_scores WHERE user_id = p_user_id;
  DELETE FROM user_cards WHERE user_id = p_user_id;
  DELETE FROM reflections WHERE user_id = p_user_id;
  DELETE FROM beat_replays WHERE user_id = p_user_id;
  DELETE FROM story_choices WHERE user_id = p_user_id;
  DELETE FROM login_attempts WHERE lower(username) = lower(v_username);
  UPDATE conversations SET created_by = NULL WHERE created_by = p_user_id;
  DELETE FROM users WHERE user_id = p_user_id;
  RETURN to_json(true);
END $$;

-- ---------------------------------------------------------------------------
-- Lessons, rewards, cards, reflections, story choices and game scores
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION stem_progress_list(p_user_id bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(json_agg(json_build_object('lesson_id', lesson_id, 'status', status, 'score', score)
           ORDER BY lesson_id COLLATE "C"), '[]')
    FROM lesson_progress WHERE user_id = p_user_id
$$;

-- Records progress on a beat. p_xp and p_atoms come from the server's lesson
-- table (server/lessons.js) and are paid only the first time the beat is
-- completed. Returns what was paid and the account.
CREATE OR REPLACE FUNCTION stem_progress_save(p_user_id bigint, p_lesson_id text, p_status text,
  p_score integer, p_xp integer, p_atoms integer) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_was_done boolean;
  v_status text;
  v_paid boolean;
BEGIN
  -- One save at a time per student, so two quick taps can't both be paid.
  PERFORM 1 FROM users WHERE user_id = p_user_id FOR UPDATE;
  SELECT status = 'completed' INTO v_was_done
    FROM lesson_progress WHERE user_id = p_user_id AND lesson_id = p_lesson_id;
  v_was_done := coalesce(v_was_done, false);
  v_status := CASE WHEN v_was_done THEN 'completed' ELSE p_status END;

  INSERT INTO lesson_progress (user_id, lesson_id, status, score, last_accessed, completed_at)
  VALUES (p_user_id, p_lesson_id, v_status, p_score, now(), CASE WHEN v_status = 'completed' THEN now() END)
  ON CONFLICT (user_id, lesson_id) DO UPDATE SET
    status = excluded.status,
    score = coalesce(excluded.score, lesson_progress.score),
    last_accessed = now(),
    completed_at = coalesce(lesson_progress.completed_at, excluded.completed_at);

  v_paid := v_status = 'completed' AND NOT v_was_done;
  IF v_paid THEN
    PERFORM stem_add_rewards(p_user_id, p_xp, p_atoms);
  END IF;
  RETURN json_build_object(
    'awarded', json_build_object('xp', CASE WHEN v_paid THEN p_xp ELSE 0 END,
                                 'atoms', CASE WHEN v_paid THEN p_atoms ELSE 0 END),
    'user', (SELECT stem_user_json(u) FROM users u WHERE u.user_id = p_user_id));
END $$;

-- Replaying a finished game pays a small top-up, at most p_max_per_day times
-- per game in 24 hours. Null if the game was never finished.
CREATE OR REPLACE FUNCTION stem_progress_replay(p_user_id bigint, p_lesson_id text, p_max_per_day integer,
  p_xp integer, p_atoms integer) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_paid boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lesson_progress
                  WHERE user_id = p_user_id AND lesson_id = p_lesson_id AND status = 'completed') THEN
    RETURN NULL;
  END IF;
  PERFORM 1 FROM users WHERE user_id = p_user_id FOR UPDATE;
  v_paid := (SELECT count(*) FROM beat_replays
              WHERE user_id = p_user_id AND beat_id = p_lesson_id
                AND replayed_at > now() - interval '1 day') < p_max_per_day;
  IF v_paid THEN
    INSERT INTO beat_replays (user_id, beat_id) VALUES (p_user_id, p_lesson_id);
    PERFORM stem_add_rewards(p_user_id, p_xp, p_atoms);
  END IF;
  RETURN json_build_object(
    'awarded', json_build_object('xp', CASE WHEN v_paid THEN p_xp ELSE 0 END,
                                 'atoms', CASE WHEN v_paid THEN p_atoms ELSE 0 END),
    'user', (SELECT stem_user_json(u) FROM users u WHERE u.user_id = p_user_id));
END $$;

CREATE OR REPLACE FUNCTION stem_cards_owned(p_user_id bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(json_agg(json_build_object('card_id', card_id, 'count', count) ORDER BY card_id COLLATE "C"), '[]')
    FROM user_cards WHERE user_id = p_user_id AND count > 0
$$;

-- Opens a card pack: takes the cost from the student's atoms and adds the
-- cards the server rolled (server/cards.js). Null if they can't afford it.
CREATE OR REPLACE FUNCTION stem_pack_open(p_user_id bigint, p_cost integer, p_cards json) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_atoms integer;
BEGIN
  UPDATE users SET atoms = atoms - p_cost, updated_at = now()
   WHERE user_id = p_user_id AND atoms >= p_cost
  RETURNING atoms INTO v_atoms;
  IF v_atoms IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO user_cards (user_id, card_id, count)
  SELECT p_user_id, card_id, count(*) FROM json_array_elements_text(p_cards) AS c(card_id) GROUP BY card_id
  ON CONFLICT (user_id, card_id) DO UPDATE SET count = user_cards.count + excluded.count;
  RETURN json_build_object('atoms', v_atoms);
END $$;

-- Saves an exit-card reflection and returns it for its author, or null if the
-- student already shared one for that exit card.
CREATE OR REPLACE FUNCTION stem_reflection_add(p_user_id bigint, p_beat_id text, p_caption text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r reflections;
BEGIN
  INSERT INTO reflections (user_id, beat_id, caption) VALUES (p_user_id, p_beat_id, p_caption)
  ON CONFLICT (user_id, beat_id) DO NOTHING
  RETURNING * INTO r;
  IF r.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (SELECT json_build_object('id', r.id, 'beat_id', r.beat_id, 'caption', r.caption,
                                   'created_at', stem_ts(r.created_at), 'full_name', u.full_name, 'avatar', u.avatar)
            FROM users u WHERE u.user_id = r.user_id);
END $$;

-- Older copies of this file listed every student's reflections, with first
-- names, for a Gallery the app no longer has.
DROP FUNCTION IF EXISTS stem_reflections_recent(integer);

CREATE OR REPLACE FUNCTION stem_story_choices(p_user_id bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(json_agg(json_build_object('beat_id', beat_id, 'choices', choices) ORDER BY beat_id COLLATE "C"), '[]')
    FROM story_choices WHERE user_id = p_user_id
$$;

CREATE OR REPLACE FUNCTION stem_story_save(p_user_id bigint, p_beat_id text, p_choices text) RETURNS json
LANGUAGE sql SET search_path = public AS $$
  INSERT INTO story_choices (user_id, beat_id, choices, updated_at) VALUES (p_user_id, p_beat_id, p_choices, now())
  ON CONFLICT (user_id, beat_id) DO UPDATE SET choices = excluded.choices, updated_at = now();
  SELECT NULL::json;
$$;

CREATE OR REPLACE FUNCTION stem_game_scores(p_user_id bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(json_agg(json_build_object('game_id', game_id, 'best_score', best_score, 'plays', plays)
           ORDER BY game_id COLLATE "C"), '[]')
    FROM game_scores WHERE user_id = p_user_id
$$;

-- Keeps a student's best score (0-100) per lesson game and counts the plays.
-- A student has scores for at most p_max_games games; null when over that.
CREATE OR REPLACE FUNCTION stem_game_score_record(p_user_id bigint, p_game_id text, p_score integer,
  p_max_games integer) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE g game_scores;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM game_scores WHERE user_id = p_user_id AND game_id = p_game_id)
     AND (SELECT count(*) FROM game_scores WHERE user_id = p_user_id) >= p_max_games THEN
    RETURN NULL;
  END IF;
  INSERT INTO game_scores (user_id, game_id, best_score) VALUES (p_user_id, p_game_id, p_score)
  ON CONFLICT (user_id, game_id) DO UPDATE SET
    best_score = greatest(game_scores.best_score, excluded.best_score),
    plays = game_scores.plays + 1,
    updated_at = now()
  RETURNING * INTO g;
  RETURN json_build_object('best', g.best_score, 'plays', g.plays);
END $$;

-- ---------------------------------------------------------------------------
-- Friends, the leaderboard and people search
-- ---------------------------------------------------------------------------

-- Up to 8 accounts whose username contains the search, for the "Add friend"
-- box: p_pattern is a LIKE pattern the server already escaped, the exact name
-- comes first, and each row says how it relates to the searcher.
CREATE OR REPLACE FUNCTION stem_users_search(p_user_id bigint, p_pattern text, p_query text) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(json_agg(json_build_object(
      'user_id', u.user_id, 'username', u.username, 'avatar', u.avatar, 'level', u.level,
      'status', CASE
        WHEN EXISTS (SELECT 1 FROM friendships f
                      WHERE f.user_a = least(p_user_id, u.user_id) AND f.user_b = greatest(p_user_id, u.user_id)) THEN 'friends'
        WHEN EXISTS (SELECT 1 FROM friend_requests r WHERE r.from_user_id = p_user_id AND r.to_user_id = u.user_id) THEN 'requested'
        WHEN EXISTS (SELECT 1 FROM friend_requests r WHERE r.from_user_id = u.user_id AND r.to_user_id = p_user_id) THEN 'incoming'
        ELSE 'none' END)
    ORDER BY lower(u.username) = lower(p_query) DESC, lower(u.username) COLLATE "C"), '[]')
    FROM (SELECT * FROM users
           WHERE username ILIKE p_pattern ESCAPE '\' AND user_id <> p_user_id
           ORDER BY lower(username) = lower(p_query) DESC, lower(username) COLLATE "C"
           LIMIT 8) u
$$;

-- The top students by XP (ties by username), each marked if they're a friend.
CREATE OR REPLACE FUNCTION stem_leaderboard(p_user_id bigint, p_limit integer) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(json_agg(json_build_object(
      'user_id', u.user_id, 'username', u.username, 'avatar', u.avatar, 'level', u.level, 'xp', u.xp,
      'is_friend', u.user_id <> p_user_id AND EXISTS (
        SELECT 1 FROM friendships f
         WHERE f.user_a = least(p_user_id, u.user_id) AND f.user_b = greatest(p_user_id, u.user_id)))
    ORDER BY u.xp DESC, u.username COLLATE "C"), '[]')
    FROM (SELECT * FROM users ORDER BY xp DESC, username COLLATE "C" LIMIT p_limit) u
$$;

-- Friends (sorted by name, ignoring case) and requests in and out, newest first.
CREATE OR REPLACE FUNCTION stem_friends_overview(p_user_id bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT json_build_object(
    'friends', (SELECT coalesce(json_agg(stem_public_user(u) ORDER BY lower(u.username) COLLATE "C"), '[]')
                  FROM friendships f
                  JOIN users u ON u.user_id = CASE WHEN f.user_a = p_user_id THEN f.user_b ELSE f.user_a END
                 WHERE f.user_a = p_user_id OR f.user_b = p_user_id),
    'incoming', (SELECT coalesce(json_agg(json_build_object('request_id', r.request_id,
                                   'created_at', stem_ts(r.created_at), 'user', stem_public_user(u))
                   ORDER BY r.request_id DESC), '[]')
                   FROM friend_requests r JOIN users u ON u.user_id = r.from_user_id
                  WHERE r.to_user_id = p_user_id),
    'outgoing', (SELECT coalesce(json_agg(json_build_object('request_id', r.request_id,
                                   'created_at', stem_ts(r.created_at), 'user', stem_public_user(u))
                   ORDER BY r.request_id DESC), '[]')
                   FROM friend_requests r JOIN users u ON u.user_id = r.to_user_id
                  WHERE r.from_user_id = p_user_id))
$$;

-- A friend request to the account called p_username (any case). If that
-- student already asked p_user_id, the two become friends instead. outcome is
-- one of: not_found, self, already_friends, duplicate, friends, requested.
CREATE OR REPLACE FUNCTION stem_friend_request_send(p_user_id bigint, p_username text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE t users;
BEGIN
  SELECT * INTO t FROM users WHERE lower(username) = lower(p_username) LIMIT 1;
  IF t.user_id IS NULL THEN
    RETURN json_build_object('outcome', 'not_found');
  END IF;
  IF t.user_id = p_user_id THEN
    RETURN json_build_object('outcome', 'self');
  END IF;
  IF EXISTS (SELECT 1 FROM friendships
              WHERE user_a = least(p_user_id, t.user_id) AND user_b = greatest(p_user_id, t.user_id)) THEN
    RETURN json_build_object('outcome', 'already_friends', 'user', stem_public_user(t));
  END IF;
  IF EXISTS (SELECT 1 FROM friend_requests WHERE from_user_id = t.user_id AND to_user_id = p_user_id) THEN
    PERFORM stem_make_friends(p_user_id, t.user_id);
    RETURN json_build_object('outcome', 'friends', 'user', stem_public_user(t));
  END IF;
  INSERT INTO friend_requests (from_user_id, to_user_id) VALUES (p_user_id, t.user_id) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN json_build_object('outcome', 'duplicate', 'user', stem_public_user(t));
  END IF;
  RETURN json_build_object('outcome', 'requested', 'user', stem_public_user(t));
END $$;

-- Accept or decline a request sent to p_user_id, or cancel one they sent.
-- False if there is no such request for them.
CREATE OR REPLACE FUNCTION stem_friend_request_respond(p_user_id bigint, p_request_id bigint, p_action text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r friend_requests;
BEGIN
  SELECT * INTO r FROM friend_requests WHERE request_id = p_request_id;
  IF r.request_id IS NULL
     OR (p_action = 'cancel' AND r.from_user_id <> p_user_id)
     OR (p_action <> 'cancel' AND r.to_user_id <> p_user_id) THEN
    RETURN to_json(false);
  END IF;
  IF p_action = 'accept' THEN
    PERFORM stem_make_friends(r.from_user_id, r.to_user_id);
  ELSE
    DELETE FROM friend_requests WHERE request_id = p_request_id;
  END IF;
  RETURN to_json(true);
END $$;

CREATE OR REPLACE FUNCTION stem_friend_remove(p_user_id bigint, p_other_id bigint) RETURNS json
LANGUAGE sql SET search_path = public AS $$
  DELETE FROM friendships WHERE user_a = least(p_user_id, p_other_id) AND user_b = greatest(p_user_id, p_other_id);
  SELECT NULL::json;
$$;

CREATE OR REPLACE FUNCTION stem_all_friends(p_user_id bigint, p_ids json) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT to_json(stem_friends_with_all(p_user_id, p_ids))
$$;

-- ---------------------------------------------------------------------------
-- Chats
-- ---------------------------------------------------------------------------

-- The student's chats, the one with the newest message first.
CREATE OR REPLACE FUNCTION stem_conversations_for(p_user_id bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(json_agg(stem_conversation_summary(x.conversation_id) ORDER BY x.last_id DESC, x.conversation_id DESC), '[]')
    FROM (SELECT c.conversation_id, coalesce(max(msg.message_id), 0) AS last_id
            FROM conversations c
            JOIN conversation_members me ON me.conversation_id = c.conversation_id AND me.user_id = p_user_id
            LEFT JOIN messages msg ON msg.conversation_id = c.conversation_id
           GROUP BY c.conversation_id) x
$$;

-- The one-to-one chat between two students, if they already have one.
CREATE OR REPLACE FUNCTION stem_direct_conversation(p_a bigint, p_b bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT stem_conversation_summary(c.conversation_id)
    FROM conversations c
    JOIN conversation_members a ON a.conversation_id = c.conversation_id AND a.user_id = p_a
    JOIN conversation_members b ON b.conversation_id = c.conversation_id AND b.user_id = p_b
   WHERE NOT c.is_group
   ORDER BY c.conversation_id
   LIMIT 1
$$;

-- A new chat with p_user_id and the friends in p_member_ids (the server has
-- already checked they're friends).
CREATE OR REPLACE FUNCTION stem_conversation_create(p_user_id bigint, p_is_group boolean, p_name text, p_member_ids json) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_id bigint;
BEGIN
  INSERT INTO conversations (is_group, name, created_by) VALUES (p_is_group, p_name, p_user_id)
  RETURNING conversation_id INTO v_id;
  INSERT INTO conversation_members (conversation_id, user_id)
  SELECT v_id, m FROM (SELECT p_user_id AS m
                       UNION SELECT e::bigint FROM json_array_elements_text(p_member_ids) AS e) ids;
  RETURN stem_conversation_summary(v_id);
END $$;

CREATE OR REPLACE FUNCTION stem_is_member(p_conversation_id bigint, p_user_id bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT to_json(EXISTS (SELECT 1 FROM conversation_members
                          WHERE conversation_id = p_conversation_id AND user_id = p_user_id))
$$;

-- Messages in a chat, oldest first, newer than message id p_after (the chat
-- polls with the last id it has). Null if p_user_id isn't in the chat.
CREATE OR REPLACE FUNCTION stem_messages_after(p_user_id bigint, p_conversation_id bigint, p_after bigint,
  p_limit integer) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM conversation_members
                      WHERE conversation_id = p_conversation_id AND user_id = p_user_id) THEN NULL
    ELSE (SELECT coalesce(json_agg(json_build_object(
                     'message_id', x.message_id, 'body', x.body, 'created_at', stem_ts(x.created_at),
                     'sender_id', x.sender_id, 'username', x.username, 'avatar', x.avatar)
                   ORDER BY x.message_id), '[]')
            FROM (SELECT m.message_id, m.body, m.created_at, m.sender_id, u.username, u.avatar
                    FROM messages m LEFT JOIN users u ON u.user_id = m.sender_id
                   WHERE m.conversation_id = p_conversation_id AND m.message_id > p_after
                   ORDER BY m.message_id LIMIT p_limit) x)
  END
$$;

-- The new message's id, or null if p_user_id isn't in the chat.
CREATE OR REPLACE FUNCTION stem_message_send(p_user_id bigint, p_conversation_id bigint, p_body text) RETURNS json
LANGUAGE sql SET search_path = public AS $$
  INSERT INTO messages (conversation_id, sender_id, body)
  SELECT p_conversation_id, p_user_id, p_body
   WHERE EXISTS (SELECT 1 FROM conversation_members
                  WHERE conversation_id = p_conversation_id AND user_id = p_user_id)
  RETURNING to_json(message_id);
$$;

-- p_user_id leaves a group chat; the chat goes once nobody is left.
-- Returns 'ok', 'not_found' (no such chat for them) or 'not_group'.
CREATE OR REPLACE FUNCTION stem_conversation_leave(p_user_id bigint, p_conversation_id bigint) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c conversations;
BEGIN
  SELECT * INTO c FROM conversations WHERE conversation_id = p_conversation_id;
  IF c.conversation_id IS NULL OR NOT EXISTS (
       SELECT 1 FROM conversation_members WHERE conversation_id = p_conversation_id AND user_id = p_user_id) THEN
    RETURN to_json('not_found'::text);
  END IF;
  IF NOT c.is_group THEN
    RETURN to_json('not_group'::text);
  END IF;
  DELETE FROM conversation_members WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
  IF NOT EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = p_conversation_id) THEN
    DELETE FROM conversations WHERE conversation_id = p_conversation_id;
  END IF;
  RETURN to_json('ok'::text);
END $$;

-- Adds p_user_id's friends to a group chat they're in. Returns {conversation},
-- or {error: 'not_found'} (not a group they're in) or {error: 'not_friends'}.
CREATE OR REPLACE FUNCTION stem_group_add_members(p_user_id bigint, p_conversation_id bigint, p_member_ids json) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM conversations c
                   JOIN conversation_members m ON m.conversation_id = c.conversation_id AND m.user_id = p_user_id
                  WHERE c.conversation_id = p_conversation_id AND c.is_group) THEN
    RETURN json_build_object('error', 'not_found');
  END IF;
  IF NOT stem_friends_with_all(p_user_id, p_member_ids) THEN
    RETURN json_build_object('error', 'not_friends');
  END IF;
  INSERT INTO conversation_members (conversation_id, user_id)
  SELECT p_conversation_id, e::bigint FROM json_array_elements_text(p_member_ids) AS e
  ON CONFLICT DO NOTHING;
  RETURN json_build_object('conversation', stem_conversation_summary(p_conversation_id));
END $$;

-- Up to p_limit messages, newest first, matching a LIKE pattern the server
-- escaped, from the chats p_user_id is in.
CREATE OR REPLACE FUNCTION stem_messages_search(p_user_id bigint, p_pattern text, p_limit integer) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(json_agg(json_build_object(
      'message_id', x.message_id, 'body', x.body, 'created_at', stem_ts(x.created_at),
      'conversation_id', x.conversation_id, 'username', x.username)
    ORDER BY x.message_id DESC), '[]')
    FROM (SELECT m.message_id, m.body, m.created_at, m.conversation_id, u.username
            FROM messages m
            JOIN conversation_members me ON me.conversation_id = m.conversation_id AND me.user_id = p_user_id
            LEFT JOIN users u ON u.user_id = m.sender_id
           WHERE m.body ILIKE p_pattern ESCAPE '\'
           ORDER BY m.message_id DESC LIMIT p_limit) x
$$;

-- ---------------------------------------------------------------------------
-- Admin page (server/routes/admin.js, behind ADMIN_PASSKEY)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION stem_admin_stats() RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT json_build_object(
    'users', (SELECT count(*) FROM users),
    'activeThisWeek', (SELECT count(DISTINCT user_id) FROM lesson_progress
                        WHERE last_accessed >= now() - interval '7 days'),
    'activitiesCompleted', (SELECT count(*) FROM lesson_progress WHERE status = 'completed'),
    'messages', (SELECT count(*) FROM messages),
    'groups', (SELECT count(*) FROM conversations WHERE is_group))
$$;

-- Every student, newest first, with their centre (and the name typed for
-- "Others"), level, lessons completed and when they were last active: the
-- latest sign-in, lesson or game score, or else when they joined. Students
-- stay signed in for 30 days, so sign-ins alone would say "Never" for most.
CREATE OR REPLACE FUNCTION stem_admin_users() RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(json_agg(json_build_object(
      'user_id', u.user_id, 'full_name', u.full_name, 'username', u.username,
      'xp', u.xp, 'level', u.level, 'atoms', u.atoms, 'avatar', u.avatar,
      'created_at', stem_ts(u.created_at), 'org_name', o.org_name, 'org_other', u.org_other,
      'level_name', s.level_name,
      'completed', (SELECT count(*) FROM lesson_progress p WHERE p.user_id = u.user_id AND p.status = 'completed'),
      'last_active', stem_ts(greatest(
        -- lower() on both sides uses idx_login_attempts_user_time, so this
        -- stays quick however many sign-ins pile up.
        (SELECT max(a.attempted_at) FROM login_attempts a WHERE lower(a.username) = lower(u.username) AND a.success),
        (SELECT max(p.last_accessed) FROM lesson_progress p WHERE p.user_id = u.user_id),
        (SELECT max(g.updated_at) FROM game_scores g WHERE g.user_id = u.user_id),
        u.created_at)))
    ORDER BY u.created_at DESC, u.user_id DESC), '[]')
    FROM users u
    JOIN organisations o ON o.org_id = u.org_id
    JOIN school_levels s ON s.level_id = u.school_level_id
$$;

CREATE OR REPLACE FUNCTION stem_admin_user_progress(p_user_id bigint) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT json_build_object(
    'progress', (SELECT coalesce(json_agg(json_build_object(
                     'lesson_id', lesson_id, 'status', status, 'score', score,
                     'last_accessed', stem_ts(last_accessed), 'completed_at', stem_ts(completed_at))
                   ORDER BY last_accessed DESC, progress_id DESC), '[]')
                   FROM lesson_progress WHERE user_id = p_user_id),
    'games', (SELECT coalesce(json_agg(json_build_object(
                  'game_id', game_id, 'best_score', best_score, 'plays', plays, 'updated_at', stem_ts(updated_at))
                ORDER BY updated_at DESC, game_id COLLATE "C"), '[]')
                FROM game_scores WHERE user_id = p_user_id))
$$;

-- Sets a student's XP, level and/or atoms (null leaves that one as it is).
CREATE OR REPLACE FUNCTION stem_admin_set_stats(p_user_id bigint, p_xp integer, p_level integer, p_atoms integer) RETURNS json
LANGUAGE sql SET search_path = public AS $$
  UPDATE users
     SET xp = coalesce(p_xp, xp), level = coalesce(p_level, level), atoms = coalesce(p_atoms, atoms), updated_at = now()
   WHERE user_id = p_user_id
  RETURNING json_build_object('xp', xp, 'level', level, 'atoms', atoms);
$$;

-- Wipes a student's lesson progress and game scores (XP, atoms, friends and
-- chats stay). Returns how many rows went.
CREATE OR REPLACE FUNCTION stem_admin_reset_progress(p_user_id bigint) RETURNS json
LANGUAGE sql SET search_path = public AS $$
  WITH lessons AS (DELETE FROM lesson_progress WHERE user_id = p_user_id RETURNING 1),
       games AS (DELETE FROM game_scores WHERE user_id = p_user_id RETURNING 1)
  SELECT json_build_object('lessons', (SELECT count(*) FROM lessons), 'games', (SELECT count(*) FROM games))
$$;

-- A new PIN hash; signs the student out everywhere. Returns how many sessions ended.
CREATE OR REPLACE FUNCTION stem_admin_set_pin(p_user_id bigint, p_pin_hash text) RETURNS json
LANGUAGE sql SET search_path = public AS $$
  UPDATE users SET pin_hash = p_pin_hash, updated_at = now() WHERE user_id = p_user_id;
  WITH gone AS (DELETE FROM sessions WHERE user_id = p_user_id RETURNING 1)
  SELECT to_json(count(*)) FROM gone;
$$;

-- ---------------------------------------------------------------------------
-- Lock everything to the server
-- ---------------------------------------------------------------------------

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
ALTER TABLE user_cards           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE beat_replays         ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_choices        ENABLE ROW LEVEL SECURITY;

-- On Supabase the browser roles (anon, authenticated) can use every new table
-- and function by default. Take that away from ours and give it to the
-- server's role (service_role, used with the secret key). Outside Supabase
-- these roles don't exist and this block does nothing.
DO $$
DECLARE
  item text;
  role text;
BEGIN
  FOR item IN
    SELECT format('FUNCTION %s', p.oid::regprocedure)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname LIKE 'stem\_%'
    UNION ALL
    SELECT format('TABLE public.%I', t)
      FROM unnest(ARRAY['organisations', 'school_levels', 'recovery_colours', 'recovery_subjects', 'users',
                        'lesson_progress', 'login_attempts', 'sessions', 'friend_requests', 'friendships',
                        'conversations', 'conversation_members', 'messages', 'game_scores', 'user_cards',
                        'reflections', 'beat_replays', 'story_choices']) AS t
  LOOP
    IF item LIKE 'FUNCTION %' THEN
      EXECUTE format('REVOKE ALL ON %s FROM PUBLIC', item);
    END IF;
    FOREACH role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role) THEN
        EXECUTE format('REVOKE ALL ON %s FROM %I', item, role);
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT %s ON %s TO service_role',
                     CASE WHEN item LIKE 'FUNCTION %' THEN 'EXECUTE' ELSE 'ALL' END, item);
    END IF;
  END LOOP;
END $$;

-- Tell Supabase's API to pick up new or changed functions straight away.
NOTIFY pgrst, 'reload schema';
