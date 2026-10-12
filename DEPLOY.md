# Putting STEMulate online (Render)

One free Render web service runs both:

- **STEMulate Academy:** `https://stemulate-academy.onrender.com`
- **STEMulate website:** `https://stemulate-academy.onrender.com/site/`

The website's "Enter STEMulate Academy" buttons open the Academy on the same address.
Settings live in `render.yaml` at the repo root.

## First-time setup (about 5 minutes)

1. Open https://render.com/deploy?repo=https://github.com/jvi-44/vers3-tabs-stemulateacademy
2. Sign in with GitHub and allow Render to read this repository.
3. Render shows the `stemulate-academy` service. Fill in **ADMIN_PASSKEY**
   (a long password for the admin page), then click **Deploy Blueprint**.
4. Wait for the build to say **Live** (5–10 minutes the first time).

Every push to `main` redeploys automatically.

If Render says the name `stemulate-academy` is taken, it gives the service a
slightly different address. Use that address instead, and change
`LIVE_ACADEMY_URL` at the top of `website/script.js` to match.

## Things to know about the free plan

- **It sleeps.** After 15 minutes with no visitors the server sleeps, and the
  next visit takes about a minute to wake it.
- **Saved data resets.** The free plan has no permanent disk, so the SQLite
  database (accounts, progress, cards, chats) is wiped whenever the server
  restarts, sleeps or redeploys. Guest mode is unaffected. To keep data, either
  upgrade to a paid Render plan with a disk (set `DB_PATH` to a file on it) or
  finish the planned move to Supabase.
- The AI lesson helper stays off until an AI key is added (the rest works).
