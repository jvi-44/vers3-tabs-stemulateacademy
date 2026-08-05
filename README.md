# STEMulate Academy

React + Vite + Tailwind frontend, with a Node/Express + SQLite backend for
real accounts and progress tracking (replacing the old mock login).

## Setup

```bash
npm install
```

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

## Build

```bash
npm run build
```
