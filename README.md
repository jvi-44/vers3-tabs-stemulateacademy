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
