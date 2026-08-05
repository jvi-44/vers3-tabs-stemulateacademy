# How the database works (a plain-English walkthrough)

You don't need to know SQL to run STEMulate Academy, but here's what's
actually happening under the hood, since you asked.

## 1. What kind of database is this?

It's **SQLite** — the whole database is just **one file on disk**, not a
server you install separately. That file lives at:

```
server/stemulate.db
```

It's created **automatically** the very first time you run `npm run server`
or `npm run dev:all`. You don't create it by hand. Look at `server/db.js`:

```js
const DB_PATH = path.join(__dirname, "stemulate.db");
export const db = new Database(DB_PATH);
```

That single line either opens the existing file or creates a brand new,
empty one if it doesn't exist yet.

## 2. How the tables get created

Right after opening the file, `db.js` runs everything inside
`server/schema.sql`:

```js
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
db.exec(schema);
```

`schema.sql` is just a list of `CREATE TABLE IF NOT EXISTS ...` statements —
think of each table as a spreadsheet, and each `CREATE TABLE` as defining the
column headers for that spreadsheet. Because every statement says
`IF NOT EXISTS`, it's safe to run every time the server starts — it only
creates tables the first time, and does nothing on later restarts.

The tables, in plain English:

| Table | What it stores | One row = |
|---|---|---|
| `users` | Every account | One student — name, username, **hashed** PIN, school level, organisation, and their current `xp`, `level`, `atoms`, `avatar` |
| `lesson_progress` | Progress per lesson/beat | One (student, lesson) pair — its status (`not_started` / `in_progress` / `completed`) and score |
| `login_attempts` | A security log | One login attempt, success or fail |
| `organisations`, `school_levels`, `recovery_colours`, `recovery_subjects` | Dropdown reference lists | The options shown in the sign-up form |

## 3. How a new account gets saved

When someone signs up (`POST /api/signup` in `server/index.js`):

1. The 4-digit PIN is **hashed** with bcrypt (`bcrypt.hash(pin, 10)`) —
   the real PIN is never written to disk, only an irreversible scrambled
   version. This is why forgetting your PIN needs a recovery flow instead of
   "show my password".
2. A new row is inserted into `users`:
   ```sql
   INSERT INTO users (full_name, username, pin_hash, school_level_id, org_id, recovery_colour_id, recovery_subject_id)
   VALUES (?, ?, ?, ?, ?, ?, ?)
   ```
   The `?`s are placeholders that better-sqlite3 fills in safely (this
   prevents SQL injection — never string-concatenate user input into SQL).
3. That row now has default `xp = 0`, `level = 1`, `atoms = 0`.

## 4. How progress and points get saved

Every time you finish a beat (intro story, video, quiz, simulation, exit
card) in the app, two things happen automatically (see
`src/app/api/progress.ts` and the handlers in `App.tsx`):

- **`POST /api/progress`** writes/updates a row in `lesson_progress`:
  ```sql
  INSERT INTO lesson_progress (user_id, lesson_id, status, score, ...)
  VALUES (?, ?, ?, ?, ...)
  ON CONFLICT(user_id, lesson_id) DO UPDATE SET status = excluded.status, ...
  ```
  The `ON CONFLICT ... DO UPDATE` part means: if that student already has a
  row for that exact lesson, update it in place instead of creating a
  duplicate. That's how a lesson can go from `in_progress` to `completed`.

- **`POST /api/user/xp`** updates the student's running totals directly on
  their `users` row:
  ```sql
  UPDATE users SET xp = ?, level = ?, atoms = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?
  ```

So: **lesson-by-lesson completion** lives in `lesson_progress`, and
**running totals** (XP/level/Atoms shown in the top bar and profile ring)
live directly on the `users` row.

## 5. How logging in "remembers" you

`getUser(userId)` (`GET /api/user/:userId`) just re-reads that one row from
`users`. The frontend only stores the numeric `userId` in the browser's
`localStorage` (nothing sensitive) — on refresh, it asks the server "give me
the current data for this id", so XP/atoms/progress are always fresh from
the database, never stale in the browser.

## 6. How to look at the database yourself

Since it's a single file, you have a few easy options:

**Option A — a free GUI app (easiest):**
Download **[DB Browser for SQLite](https://sqlitebrowser.org/)** (free, Mac/Windows/Linux),
open it, and choose "Open Database" → pick `server/stemulate.db`. You'll see
every table, and can click "Browse Data" to view every user, their XP,
Atoms, and lesson progress in a spreadsheet-like view. You can even edit
values directly here if you ever need to.

**Option B — command line (`sqlite3`):**
```bash
# from the project root, after the server has run at least once
sqlite3 server/stemulate.db

.tables                          -- lists every table
.headers on
.mode column
SELECT * FROM users;             -- every account + their XP/level/atoms
SELECT * FROM lesson_progress WHERE user_id = 1;   -- one student's progress
.quit
```
(If `sqlite3` isn't installed: macOS usually has it already; otherwise
`brew install sqlite3` on Mac, or `apt install sqlite3` on Linux.)

**Option C — VS Code extension:**
Install the "SQLite Viewer" or "SQLite" extension in VS Code, then just
click on `server/stemulate.db` in the file explorer to browse it visually.

## 7. Resetting everything

Since the whole database is one file, wiping it is one delete:
```bash
rm server/stemulate.db
```
The next time the server starts, it recreates empty tables from
`schema.sql` — every account and every student's progress will be gone, so
only do this in testing, not in production with real workshop attendees.

## 8. A note on "every user"

There is currently no admin dashboard — "every user" means every row in the
`users` table, viewable with either option above. If down the line you want
a proper in-app admin view (e.g. a teacher's dashboard listing every
attendee and their progress), that would be a new page that calls a new
`GET /api/admin/users` endpoint returning all rows — happy to build that if
it'd be useful for running the workshop.
