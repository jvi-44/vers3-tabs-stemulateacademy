# STEMulate Academy

React + Vite + Tailwind frontend, with a Node/Express + SQLite backend for
real accounts and progress tracking (replacing the old mock login).

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
| `DB_PATH` | Where the SQLite file lives | `server/stemulate.db` |
| `PORT` | API port | `4000` |
| `ADMIN_PASSKEY` | The admin page at `/#/admin` (use something long) | none (admin page switched off) |
| `AUTH_RATE_LIMIT_PER_MIN` | Per-IP sign-in / sign-up / Forgot PIN / admin-login requests per minute | `20` |

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

The SQLite database file is created automatically at `server/stemulate.db`
(or `DB_PATH`) the first time the server starts — no manual setup needed.
`server/schema.sql` runs first, then every file in `server/migrations/` in
filename order (see `server/db.js`). Delete the database file to reset all
accounts and progress during testing.

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
  `/api/leaderboard`, `/api/chat`. Schema lives in `server/schema.sql` plus
  `server/migrations/`; PINs are bcrypt-hashed, never stored in plaintext.
- **`src/components/LoginScreen.tsx`** — replaces the old mock login with
  Sign In / Create Account / Forgot PIN, wired to the API above.
- **`src/components/StembotPattern.tsx`** — the tiled STEMbot background.
- **`src/app/App.tsx`** — login state comes from the server session cookie, so
  it survives a refresh without storing anything about the student in
  `localStorage`.

## Tests

```bash
npm test             # both suites
npm run test:server  # node:test against a throwaway SQLite file (server/test/)
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

The Express server can serve the built frontend and the API from one origin.

1. **Build** the frontend:
   ```bash
   npm ci
   npm run build        # writes dist/
   ```
2. **Set env vars** on the host (not in the repo):
   - `NODE_ENV=production` (secure cookies, trusts the host's proxy for client IPs)
   - `SESSION_SECRET=<32+ random bytes>`
   - `APP_ORIGIN=<your site URL, e.g. https://stemulate.example>`
   - `DB_PATH=<path on a persistent disk>` — e.g. `/var/data/stemulate.db`
   - `GEMINI_API_KEY=<restricted key>` (optional; chat shows a "resting"
     message without it)
3. **Attach a persistent disk/volume** and point `DB_PATH` at it. Most hosts
   (Render, Railway, ...) wipe the app folder on every deploy, which would
   delete every account.
4. **Start** the server:
   ```bash
   npm start            # node server/index.js — app + API on $PORT (default 4000)
   ```

Before launch, remove `<meta name="robots" content="noindex, nofollow" />`
from `index.html` if the site should appear in search results.

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
