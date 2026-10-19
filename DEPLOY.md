# Putting STEMulate online

Three pieces, all on free plans to start:

| What | Where | Address |
|---|---|---|
| The public website (`website/`) | Render static site `stemulate-website` | https://projstemulate.com (www redirects there) |
| STEMulate Academy, the app and its API | Render web service `stemulate-academy` (Singapore) | https://academy.projstemulate.com |
| Students' data (accounts, progress, cards, chats) | Supabase project (Singapore) | used by the Academy only |

`render.yaml` sets up both Render services; `supabase/schema.sql` sets up the
database. Only the GitHub repo's owner (Janhvi) can connect it to Render, so do
steps 1–3 together.

## 1. Supabase: the database (10 minutes)

1. In Supabase, open the project, or create one with **Region: Southeast Asia
   (Singapore)** (our data-protection note asks for Singapore,
   docs/DATA_PRIVACY.md). Keep the Data API on, using the `public` schema (the
   default): the Academy reaches its data only through it.
2. **SQL Editor → New query**, paste all of `supabase/schema.sql`, press **Run**.
   It should end with "Success. No rows returned". It's safe to run again.
   - If the editor warns about destructive operations, confirm. The file has
     `DROP` and `DELETE` lines for upgrades and inside its functions; on a new
     project it deletes nothing.
   - Afterwards **Advisors → Security Advisor** lists "RLS Enabled No Policy" for
     all 18 tables. That's intended: with no policies, only the server's secret
     key can reach students' data.
3. **Project Settings → API Keys**. You need two values for Render:
   - **Project URL**, like `https://abcdefghijkl.supabase.co` (nothing after `.co`).
   - A **secret key**, starting `sb_secret_` (create one if the list is empty).
     Not the publishable key: the tables are locked to the server, and the server
     refuses to start with a publishable key. Keep the secret key out of the repo,
     chats and the browser.
4. Optional 5-second check from your own computer: put both values in `.env` and
   run `npm run db:check`. It should say "Schema is installed: 7 centres, 6 school
   levels, …". Then take them out of `.env` again, so testing on your computer
   never writes into the real database.

## 2. Render: the website and the Academy (15 minutes)

1. Open https://render.com/deploy?repo=https://github.com/jvi-44/vers3-tabs-stemulateacademy
   and sign in with GitHub (Janhvi's account, so Render can read the repo).
2. Render lists two services from `render.yaml`. Fill in:
   - `ADMIN_PASSKEY`: a long password for the Academy's admin page (`/#/admin`).
   - `SUPABASE_URL` and `SUPABASE_SECRET_KEY`: the two values from step 1.

   Render asks for these only now, on the first deploy. To change one later, open
   the service's **Environment** tab.
3. Click **Deploy Blueprint** and wait for both services to say **Live** (the
   Academy takes 5–10 minutes the first time).
4. Check it works before touching the domain:
   - Open the Academy's `….onrender.com` address (shown on the service), create
     a test account, then look in Supabase **Table Editor → users**: the account
     is there. Then delete it (**Me → Privacy & account → Delete my account**),
     so no test data stays among the students' accounts.
   - The Academy's **Logs** start with `[db] Saving to Supabase project https://….supabase.co`.
     If it says the tables aren't there, redo step 1.2, then press **Manual
     Deploy → Deploy latest commit** (Render doesn't retry a failed start on
     its own).
   - Open the website's `….onrender.com` address.

Every push to `main` redeploys both services.

## 3. The domain: projstemulate.com and academy.projstemulate.com

**Where the DNS lives.** A lookup on 17 Oct 2026 showed that projstemulate.com
uses **Cloudflare** name servers (`lilyana.ns.cloudflare.com`,
`oswald.ns.cloudflare.com`), and the registry lists **Tucows** as the
registrar. It may have been bought through GoDaddy or Yola, but the records are
edited wherever that Cloudflare zone is managed. The registration runs until
30 March 2027, so renew it before then. The domain has no email (MX) records, so
nothing else depends on it.

First, in Render, each service already lists its custom domain from
`render.yaml` (**Settings → Custom Domains**): `projstemulate.com` (with
`www.projstemulate.com` redirecting to it) on the website and
`academy.projstemulate.com` on the Academy. Note each service's
`….onrender.com` address.

### If you can log in to Cloudflare (the usual case)

In Cloudflare, open projstemulate.com → **DNS → Records**:

1. Delete the old records that point to Yola: the `A` (and any `AAAA`) records
   for `projstemulate.com` and `www`.
2. Add three records, each with **Proxy status: DNS only** (grey cloud):

   | Type | Name | Target |
   |---|---|---|
   | CNAME | `@` (projstemulate.com) | the website's `….onrender.com` address |
   | CNAME | `www` | the website's `….onrender.com` address |
   | CNAME | `academy` | the Academy's `….onrender.com` address |

3. **SSL/TLS → Overview**: set the mode to **Full**.
4. Back in Render, press **Verify** on each domain. Render issues the HTTPS
   certificates itself, usually within minutes.

Keep the `academy` record on **DNS only**. Behind Cloudflare's proxy every
student would appear to come from one of Cloudflare's addresses, and the
sign-in limit would treat a whole class as one person.

### If nobody can log in to that Cloudflare account

The name servers were probably set by Yola or by whoever set the site up. Log in
where the domain is registered (GoDaddy, Yola's Domains page or the Tucows
reseller), switch the **name servers** back to that registrar's default, then
add these records there:

| Type | Name | Value |
|---|---|---|
| A | `@` | `216.24.57.1` (Render's address for root domains) |
| CNAME | `www` | the website's `….onrender.com` address |
| CNAME | `academy` | the Academy's `….onrender.com` address |

Changing name servers can take a few hours to spread.

### Then

- Check https://projstemulate.com, https://www.projstemulate.com and
  https://academy.projstemulate.com. The website's "Enter STEMulate Academy"
  buttons already point at the academy address.
- In Yola, remove the domain from the old site (or cancel the plan) once the new
  site is live, so Yola stops serving it.
- Render's free workspace includes two custom domains, which is what this
  needs. If Render counts the automatic `www` redirect as a third and asks to
  pay, remove `www`.
- Add https://projstemulate.com to Google Search Console and submit
  `https://projstemulate.com/sitemap.xml`.

## Before the November workshops

- **The free Academy server sleeps.** After 15 minutes without visitors, the
  next visit takes about a minute to wake it. Open the Academy a few minutes
  before each session.
- **A whole class signing in at once is slow on the free plan.** It has a tenth
  of a CPU, so checking each PIN takes about 1.5 seconds, and 30 children signing
  in together wait in a queue. For the November–December workshops, switch
  `stemulate-academy` to a paid instance type (**Settings → Instance Type**) and
  back afterwards. The website is served from Render's CDN and never sleeps.
- `AUTH_RATE_LIMIT_PER_MIN` is 200 because a whole centre shares one Wi-Fi
  address. Each username still locks after 5 wrong PINs.
- **Supabase pauses free projects after a week without activity.** The data
  stays; press **Restore** in the Supabase dashboard if the Academy can't reach
  the database after a quiet week.
- **The AI lesson helper** stays off until `GEMINI_API_KEY` is added to the
  Academy's Environment tab. Everything else works without it.

## When the code changes

- Push to `main` and Render redeploys. Pushing is the owner's call.
- If `supabase/schema.sql` changed, run it again in the SQL Editor first. The
  Academy checks the schema version when it starts and stops with a message
  saying to run the file if they don't match.
- To check a database connection from your own computer, put `SUPABASE_URL` and
  `SUPABASE_SECRET_KEY` in your own `.env` (it's gitignored) and run
  `npm run db:check`. It only reads.
