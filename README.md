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
