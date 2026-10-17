# STEMulate Academy

React + Vite + Tailwind frontend, with a Node/Express backend for real accounts
and progress tracking. Students' data is stored in Postgres: a Supabase project on
the host, and PGlite (a copy of Postgres inside the server) on your own computer.
How the database works: [SQL_EXPLAINED.md](SQL_EXPLAINED.md). Putting it online:
[DEPLOY.md](DEPLOY.md).

## Setup

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and fill in what you need:

```bash
cp .env.example .env
```

The server loads `.env` automatically (via `dotenv`, imported at the top of
`server/app.js`). `.env` is gitignored, and none of these values ever go into
the frontend.

| Variable | Needed for | Default |
|---|---|---|
| `GEMINI_API_KEY` | The in-lesson "Ask STEMbots" chat | none (chat replies "STEMbots are resting right now") |
| `GEMINI_MODEL` | Chat model | `gemini-2.5-flash` |
| `SESSION_SECRET` | Signing the login cookie (32+ random bytes) | random per start (everyone is signed out on restart) |
| `APP_ORIGIN` | CORS: the only origin allowed to call the API with the login cookie | `http://localhost:5173` |
| `SUPABASE_URL` | The Supabase project to save students' data in (on the host) | none (the local database is used) |
| `SUPABASE_SECRET_KEY` | That project's secret key (`sb_secret_...`), server-only. Never the publishable key | none |
| `DB_PATH` | Folder for the local database when Supabase isn't set (`memory://` keeps it in memory) | `server/.pglite` |
| `PORT` | API port | `4000` |
| `ADMIN_PASSKEY` | The admin page at `/#/admin` (use something long) | none (admin page switched off) |
| `AUTH_RATE_LIMIT_PER_MIN` | Per-IP sign-in / sign-up / Forgot PIN / admin-login requests per minute | `20` |
| `WEBSITE_URL` | On the host: where old `/site` links redirect (the public website) | none (`/site` serves `website/`) |

### Gemini (STEMbot chat)

1. Create a key at https://aistudio.google.com/apikey, restrict it to the
   Generative Language API and give it a low daily quota.
2. Put it in `.env` as `GEMINI_API_KEY=...` and restart the server.

The key is only ever used by the server (`POST /api/chat`, sent in the
`x-goog-api-key` header). The system prompt and child-safety rules live in
`server/app.js`; the browser only sends which lesson beat the student is on
and the last few messages. Chat requires a signed-in student and is limited
to 30 questions per student per hour. If the key is missing or Gemini fails,
the student sees "STEMbots are resting right now — try again soon!".

## Running it

You need **both** the frontend and the backend running.

**Option A — one command (recommended):**
```bash
npm run dev:all
```

**Option B — two terminals:**
```bash
npm run server   # starts the API on http://localhost:4000
npm run dev      # starts Vite on http://localhost:5173
```

Vite proxies `/api/*` requests to the Express server (see `vite.config.ts`),
so the frontend just calls fetch("/api/...") without needing to know the port.

Without Supabase settings the server keeps its data in a local Postgres
(PGlite) in `server/.pglite/`, created on the first start with every table from
`supabase/schema.sql`. Nothing to install. Delete that folder to reset all
accounts and progress during testing. With `SUPABASE_URL` and
`SUPABASE_SECRET_KEY` in your `.env`, it uses that Supabase project instead;
`npm run db:check` shows which database it reaches.

## Lesson games

Each lesson has a game (`src/games/`, one file per game, listed in
`src/games/registry.ts`). They share a kit in `src/games/kit/`: 3D voxel
blocks, chiptune music and sound effects made in code, a score out of 100
with saved high scores, and rival STEMbots for solo play.

- **In a lesson** the game is always single player.
- **In the Games tab** you can replay it solo, or press **Live** to host a
  2 to 4 player match and share its 4-letter code. Live rooms run on the
  Express server (`server/gameRooms.js`, Server-Sent Events), so the API must
  be running.
- **Testing live play alone:** host a Live game, then in another terminal run
  `npm run simulate:game -- ABCD 2` (the room code, and 1 to 3 pretend
  players). They join, get ready, and play along when you press Start.

## What changed from the original mock version

- **`server/`** — Express API (`server/app.js`): `/api/signup`, `/api/login`,
  `/api/logout`, `/api/recover/verify`, `/api/recover/reset`, `/api/user/me`,
  `/api/progress`, `/api/cards`, `/api/packs/open`, `/api/reflections`,
  `/api/leaderboard`, `/api/chat`. Every table and query lives in
  `supabase/schema.sql` (as `stem_*` functions the server calls by name); PINs
  are bcrypt-hashed, never stored in plaintext.
- **`src/components/LoginScreen.tsx`** — replaces the old mock login with
  Sign In / Create Account / Forgot PIN, wired to the API above.
- **`src/components/StembotPattern.tsx`** — the tiled STEMbot background.
- **`src/app/App.tsx`** — login state comes from the server session cookie, so
  it survives a refresh without storing anything about the student in
  `localStorage`.

## Tests

```bash
npm test             # both suites
npm run test:server  # node:test against a throwaway Postgres (PGlite), then again
                     # through supabase-js and a stand-in for Supabase's API
npm run test:client  # vitest + Testing Library (src/__tests__/)
npm run typecheck
```

## How accounts and data are protected

- **Sessions** — signing in or up sets an httpOnly, signed `stem_session`
  cookie (30 days). Every per-student route (`/api/user/me`, `/api/progress`,
  `/api/cards`, `/api/packs/open`, `/api/reflections`, `/api/leaderboard`,
  `/api/chat`, ...) works out who you are from that cookie; user ids sent by
  the browser are ignored. `POST /api/logout` ends the session.
- **PIN guessing** — 5 wrong PINs or Forgot-PIN answers lock that username
  for 15 minutes, and sign-in/sign-up/recovery are rate-limited per IP.
- **Rewards** — XP, levels, atoms, card packs and game replays are worked out
  on the server (`server/lessons.js`, `server/cards.js`); the browser can't
  set them.
- **Privacy** — sign-up asks for a first name only, shows what is saved, and
  needs the "My parent or teacher said I can join" box ticked.
  `DELETE /api/user/me` deletes a student and everything stored about them.

## Deploy

The website (`website/`) and the Academy go on Render, with students' data in
Supabase: step-by-step in [DEPLOY.md](DEPLOY.md), including the
projstemulate.com and academy.projstemulate.com domains. In short:

1. Run `supabase/schema.sql` in the Supabase project's SQL Editor.
2. Create the Render Blueprint from `render.yaml` and give it `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY` and `ADMIN_PASSKEY`.
3. Point the domains at Render.

`npm start` serves the built app and the API on one port (`npm run build` first).
In production the server refuses to start without a database setting, so
accounts can't silently land on a temporary disk.

## Admin page

Set `ADMIN_PASSKEY` in `.env`, start the app, and open
`http://localhost:5173/#/admin`. Enter the passkey to see every student, their
progress, and to delete accounts.

## Testing friends and live chat with two players

With the server running:

```bash
npm run simulate                       # two bot players befriend each other and chat
npm run simulate -- --with your_name   # the bots also friend-request you and chat with you live
```

The bots are real accounts (PIN 1111), so you can also sign in as one in a
second browser window. The script prints the command to delete them afterwards.

## Privacy

See [docs/DATA_PRIVACY.md](docs/DATA_PRIVACY.md) for what is stored, the
Singapore PDPA rules for children's data, and how account deletion works.

## Build

```bash
npm run build
npm start      # serves the built site and the API together on one port
```

## Intro episodes and their voices

Each lesson opens with an interactive episode (`src/episodes/`): a first-person
animated story where the player makes choices and plays mini-games with the
STEMbots. Stories live in `src/episodes/stories/`, mini-games in
`src/episodes/minigames/`. Every spoken line is pre-recorded in its STEMbot's
voice (`public/story-audio/`), using the same Kokoro voices as the lesson
videos. After editing a story line, re-record:

```bash
npm run story:lines --silent | python3 scripts/story-voices/generate.py --models ~/kokoro
```

Setup steps are at the top of `scripts/story-voices/generate.py`. Until a line
is re-recorded, the episode reads it with the browser's built-in voice.
