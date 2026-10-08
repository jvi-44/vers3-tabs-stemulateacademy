# STEMulate Academy

React + Vite + Tailwind frontend, with a Node/Express + SQLite backend for
real accounts and progress tracking (replacing the old mock login).

## Setup

```bash
npm install
```

## Keys and secrets

Copy `.env.example` to `.env` and fill in the values you need. `.env` is
gitignored, so keys stay on your own computer and never reach GitHub. The
server loads it automatically when it starts.

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
the first time the server starts — no manual setup needed. Delete that file
to reset all accounts and progress during testing.

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

- **`server/`** — new Express API: `/api/signup`, `/api/login`,
  `/api/recover/verify`, `/api/recover/reset`, `/api/progress`, `/api/user/:id`.
  Schema lives in `server/schema.sql`; PINs are bcrypt-hashed, never stored
  in plaintext.
- **`src/components/LoginScreen.tsx`** — replaces the old mock login with
  Sign In / Create Account / Forgot PIN, wired to the API above.
- **`src/components/StembotPattern.tsx`** — the tiled STEMbot background.
- **`src/App.tsx`** — login state now comes from the real backend and
  persists across refresh via `localStorage` (just the user id — no
  sensitive data is stored client-side).

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

## Comic voices

Every speech bubble in the lesson intro comics is pre-recorded in its
STEMbot's voice (`public/comic-audio/`), using the same Kokoro voices as the
lesson videos. After editing a line in `src/data/comicStrips.ts`, re-record:

```bash
npm run comic:lines --silent | python3 scripts/comic-voices/generate.py --models ~/kokoro
```

Setup steps are at the top of `scripts/comic-voices/generate.py`. Until a line
is re-recorded, the comic reads it with the browser's built-in voice.
