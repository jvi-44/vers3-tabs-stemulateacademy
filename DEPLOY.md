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
     all 26 tables. That's intended: with no policies, only the server's secret
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
- **The AI chats** (the lesson helper and the website's "Ask us") stay off until
  `GEMINI_API_KEY` is added to the Academy's Environment tab. Decide first: see
  "AI chat: decide first" below. Everything else works without it.

## Round 8 going live (staff accounts, sign-up forms, school levels)

1. **Database first.** In Supabase's SQL Editor, run the whole of
   `supabase/schema.sql` again (it is now version 4; nothing is deleted). Do it
   outside class time: from then until the new code is live, the old Academy
   can't start, and the free instance restarts every time it wakes up.
2. **Then push straight away**, and watch the `stemulate-academy` deploy in
   Render reach **Live** (5 to 10 minutes). If a visit failed while it was
   building, press **Manual Deploy → Deploy latest commit**. The website is
   live within a minute, so until the Academy is Live its new forms show an
   error.
3. **The first admin account.** Open `https://academy.projstemulate.com/#/admin`,
   sign in with the passkey, open **Staff & volunteers → Add someone**, add
   yourself with the **Admin** role and copy the set-up link it shows. Open it
   to choose your password. From then on you can sign in at `/#/staff` and
   open the admin page from there (for an hour at a time) without the passkey.
   Keep the passkey for emergencies: anything done with it shows in the
   Activity tab as "Admin passkey", not as a person.
4. **Add centre staff and volunteers** the same way, with the centres each one
   follows. Send each person their own link (it works once, for 7 days).
   Volunteers only see progress; centre staff can also reset a PIN.
5. **Check the students' centres.** Staff see students by the centre picked at
   sign-up. On the admin page, open a student and use **Move to another
   centre** for anyone at the wrong one, including the "Other: …" students.
6. **Before mailing the newsletter list**, confirm the addresses: anyone can
   type someone else's email into the form. Import the list into a mail tool
   that sends a confirmation email first (double opt-in), and mail only the
   people who confirm.
7. Re-record the story line that changed in Space Busters (Emily before the
   launch game) with `npm run story:lines`, then `scripts/story-voices/generate.py`;
   until then it plays in the browser's own voice.
8. **To roll back**, revert the code *and* run the previous `supabase/schema.sql`
   (version 3) in the SQL Editor again: the old server won't start on a version
   4 database. The new tables stay, unused; nothing is deleted. A few functions
   then exist in both their old and new forms, which the old server doesn't
   mind; running version 4 again removes the old ones. The website then links
   to the closed Google Forms again (point people to email meanwhile), and
   sign-ups already sent stay in `site_signups` (Table Editor).

## AI chat: decide first

Google's Gemini API terms (https://ai.google.dev/gemini-api/terms) say the API
mustn't be used in a service "directed towards or is likely to be accessed by"
people under 18. STEMulate Academy is for 7 to 12 year olds, and the website is
read by teenage volunteers. Unpaid keys also let Google use what's sent to
improve its products, and people at Google may read it. So before adding
`GEMINI_API_KEY` or `GEMINI_SITE_API_KEY` (either one switches on the website's
assistant):

- choose a provider and plan whose terms allow services used by children and
  that don't train on what's sent (a paid plan with a data processing
  agreement), and name it in `website/privacy.html`; or
- keep both chats switched off (no key): the lesson chat says so politely,
  the website's "Ask us" button stays hidden, and nothing is sent to an AI
  service.

If you do add a key:

1. **Cap it on Google's side first (required).** In Google Cloud console, open
   APIs & Services → Generative Language API → Quotas and lower the requests
   per day to what you're happy to pay for, and add a budget alert under
   Billing → Budgets & alerts. The Academy stops the website's assistant after
   `ASSISTANT_DAILY_LIMIT` questions a day (300 by default, for everyone
   together, counted in the database; the day starts at 8 a.m. Singapore
   time), and each address may ask 10 a minute and 60 a day (counted in
   memory, so they start again when the server restarts). Only Google's quota
   caps the bill.
2. Give the website its own key (`GEMINI_SITE_API_KEY`), so a busy day on the
   website can't use up the children's lesson chat, or keep
   `ASSISTANT_DAILY_LIMIT` under half the key's daily quota (Google's day and
   the Academy's start at different times).
3. Name the AI service in `website/privacy.html` (the "Ask us" and "Ask
   STEMbots" sections) before switching anything on.
4. To show the website's "Ask us" button, set `ASSISTANT_ON = true` in
   `website/script.js` and push. `ASSISTANT_DAILY_LIMIT=0` keeps the website's
   assistant off even when the lesson chat has a key.

## When the code changes

- Push to `main` and Render redeploys. Pushing is the owner's call.
- If `supabase/schema.sql` changed, run it again in the SQL Editor first. The
  Academy checks the schema version when it starts and stops with a message
  saying to run the file if they don't match.
- To check a database connection from your own computer, put `SUPABASE_URL` and
  `SUPABASE_SECRET_KEY` in your own `.env` (it's gitignored) and run
  `npm run db:check`. It only reads.
