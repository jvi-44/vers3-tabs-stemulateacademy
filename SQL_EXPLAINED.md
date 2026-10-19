# How the database works (a plain-English walkthrough)

You don't need to know SQL to run STEMulate Academy, but here's what's
happening under the hood.

## 1. What kind of database is this?

It's **Postgres**, one of the most widely used databases. It runs in two places:

- **On the host (Render):** in a **Supabase** project, Supabase's hosted Postgres
  in Singapore. Accounts and progress survive restarts and redeploys there.
- **On your own computer and in the tests:** in **PGlite**, a complete copy of
  Postgres that runs inside the server process and keeps its data in the
  `server/.pglite/` folder (or only in memory, for the tests). Nothing to install.

The server picks one when it starts (`server/db.js`):

- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` set (the host): Supabase.
- Neither set (your laptop): PGlite.

## 2. Where the tables come from

Everything lives in one file: **`supabase/schema.sql`**. It has:

1. `CREATE TABLE IF NOT EXISTS ...` for every table. Think of each table as a
   spreadsheet and each `CREATE TABLE` as its column headers.
2. The fixed lists for the sign-up form (centres, school levels, recovery
   colours and subjects).
3. The **functions** (section 3).
4. The locks (section 5).

On your laptop the server runs this file itself every time it starts. On
Supabase you paste it into the **SQL Editor** and press Run, and again whenever
it changes. It's safe to run more than once: it never deletes students' data.

| Table | What it stores | One row = |
|---|---|---|
| `users` | Every account | One student: first name, username, **hashed** PIN, school level, centre, XP, level, atoms, avatar |
| `sessions` | Who is signed in | One signed-in browser (only a scrambled copy of the cookie is kept) |
| `login_attempts` | A security log | One sign-in or Forgot-PIN try, used for the "5 wrong tries, wait 15 minutes" rule |
| `lesson_progress` | Progress per activity | One (student, activity) pair: `in_progress` or `completed`, and the score |
| `game_scores`, `beat_replays` | Games | Best score per game; replays that paid a small reward |
| `user_cards` | Card albums | How many of each card a student owns |
| `reflections` | Exit cards (only their author gets them back, in "Download my data") | One exit-card reflection |
| `story_choices` | Intro episodes | The choices a student made in an episode |
| `friend_requests`, `friendships`, `conversations`, `conversation_members`, `messages` | Friends and chats | Requests, friendships, chats and their messages |
| `organisations`, `school_levels`, `recovery_colours`, `recovery_subjects` | Sign-up lists | The options in the sign-up form |

## 3. The functions: every read and write has a name

The server never writes SQL itself. Each job is a Postgres function in
`schema.sql`, named `stem_...`, and the server calls it by name:

```js
// server/routes/story.js
const rows = await rpc("stem_story_choices", { p_user_id: req.userId });
```

On Supabase, `rpc` goes through `supabase-js` over HTTPS; on your laptop it calls
PGlite directly. Either way the same function runs. Some examples:

| Function | What it does |
|---|---|
| `stem_signup` | Checks the form's choices exist and the username is free, then saves the new account |
| `stem_user_for_login` | Finds an account by username (ignoring capital letters) for signing in |
| `stem_progress_save` | Records progress and pays XP and atoms only the first time an activity is completed |
| `stem_pack_open` | Takes the atoms for a card pack and adds the cards, all at once or not at all |
| `stem_user_delete` | "Delete my account": removes the student and everything tied to them |

Doing each job inside one function means it happens all at once: two quick
taps can't pay a reward twice, and a pack can't be paid for without its cards.

## 4. How a new account gets saved

When someone signs up (`POST /api/signup` in `server/app.js`):

1. The 4-digit PIN is **hashed** with bcrypt. Only an irreversible scrambled
   version is stored, which is why a forgotten PIN needs the Forgot-PIN
   questions rather than "show my PIN".
2. `stem_signup` inserts the row into `users`, starting at 0 XP, level 1 and
   0 atoms.
3. A session is created and the browser gets an httpOnly cookie, so the student
   stays signed in for 30 days without the page ever seeing a password or token.

## 5. Who can see the data

On Supabase every table has **Row Level Security** switched on with no rules,
and the browser's roles may not use the tables or call the functions. So the
project's **publishable key** (the one that's safe to put in a website) can't
read or change anything. Only the server, using the **secret key** kept in
Render, can reach students' data. `server/test/database.test.js` checks this on
every test run.

## 6. How to look at the data yourself

- **On Supabase:** open the project → **Table Editor**, pick a table. You can
  also run queries in the **SQL Editor**, for example:
  ```sql
  SELECT username, xp, level, atoms FROM users ORDER BY xp DESC;
  ```
- **The admin page:** set `ADMIN_PASSKEY`, open `/#/admin` in the Academy and
  enter the passkey to see every student and their progress.
- **On your laptop:** the local database is a folder, not a file you can open.
  The easiest view is the admin page above.

## 7. Resetting your local data

Stop the server and delete the `server/.pglite` folder. The next start creates
empty tables again. This only affects your own computer; the Supabase data is
untouched.
