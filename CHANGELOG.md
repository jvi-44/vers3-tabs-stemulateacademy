# What changed in this update (round 7: Me page and lesson videos)

- Students can change their own school level on the Me page (Edit → School
  level), so they can move up each January. The centre is still changed by an
  admin.
- New "Change my PIN" button under Privacy & account: type the current PIN,
  then the new one twice. Any other device that's signed in gets signed out;
  this one stays signed in. Wrong current PINs count toward the same
  "too many tries" lockout as sign-in.
- The Area and Volume lessons now play their videos from the Project STEMulate
  YouTube channel, so every video lesson has one.
- Database: `supabase/schema.sql` is now version 3 (two new functions). Run
  the whole file again in the Supabase SQL Editor before this code goes live;
  the server won't start against a version-2 database. Nothing is deleted.

# What changed in this update (round 6: website layout)

- The website menu is now six tabs: Home, Curriculum, Impact, About us,
  Get involved and STEMulate Academy. The Academy is a normal last tab instead
  of a bright button.
- Every page leads with our in-person workshops since 2023. STEMulate Academy
  is shown as a new add-on: a small "New in 2026" band near the bottom of Home
  and its own page (`academy.html`), which holds the "Enter STEMulate Academy"
  buttons.
- The Workshops page is gone: what we do (1-to-1 sessions, learning journeys,
  monthly activities) and "what changes for the children" moved to Home; the
  STEM x series and "bring a workshop to your centre" are on Curriculum. Old
  `workshops.html` links redirect to Home (`render.yaml`).
- New Get involved page: volunteering, partnering, starting a chapter (moved
  from About us) and the newsletter.
- FAQ: "Is STEMulate Academy replacing your workshops?" (no), and event dates
  now point to the newsletter and Instagram.

# What changed in this update (round 5: checks before going live)

- Exit-card reflections are private now. Nothing lists other students'
  reflections or first names anymore; each student finds their own in Download my data.
- A centre typed under "Others (please specify)" shows on the Me page, in
  Download my data and on the admin page ("Other: Little Stars Centre"),
  instead of just "Other".
- The admin page shows **Last active** (the latest sign-in, lesson or game
  score, or else when the student joined) instead of a "Last sign-in" that
  said "Never" for students who stayed signed in. The student list also loads
  quickly however many sign-ins pile up.
- Every response carries basic browser protections, and HTTPS-only on the host.
- `supabase/schema.sql` is now version 2 (new indexes, the changes above).
  Run it in the SQL Editor before the Academy starts with this code.
- DEPLOY.md covers the first-day details: the SQL Editor's confirm prompt,
  the Security Advisor's expected notes, `npm run db:check`, and redeploying
  after a failed first start.

# What changed in this update (round 4: Supabase, going online, new website)

## Database: Supabase
- Students' data now lives in Postgres: a Supabase project on the host (set
  `SUPABASE_URL` and `SUPABASE_SECRET_KEY`), PGlite on your own computer
  (nothing to install). SQLite and its migration files are gone.
- Every table and every database job is in `supabase/schema.sql`, as `stem_*`
  functions the server calls by name. Paste it into Supabase's SQL Editor once,
  and again whenever it changes. How it works: SQL_EXPLAINED.md.
- Only the server can reach the data: every table is locked to the secret key,
  and the publishable key can't read or change anything.
- The API behaves exactly as before: 39 new endpoint tests were written against
  the SQLite version first, and all 115 server tests now pass twice, against the
  local database and through supabase-js.
- `npm run db:check` shows which database the server reaches.

## Going online
- `render.yaml` now deploys two services: the website at projstemulate.com and
  the Academy at academy.projstemulate.com. Step by step, including the domain:
  DEPLOY.md.
- The server stops with a clear message if the database settings are missing
  or wrong (for example the publishable key), instead of saving accounts to a
  disk that's wiped on every restart.
- Sign-in limit raised to 200 a minute per address for workshops, where a whole
  centre shares one Wi-Fi address.

## Website
- Redesigned around real photos from our sessions, in the same colours. The
  STEM x workshops are collectible cards, like the ones in the Academy.
- New Workshops page; partners shown with their logos and what we do with each;
  the slide decks open full screen in one click; the story so far, 2023 to 2026.
- The visible "Name to add" placeholders and empty metric rows are gone.
- Search-engine basics: page descriptions, link previews, `robots.txt`,
  `sitemap.xml` and a 404 page.

# What changed in this update (round 3)

## Login page
- Fixed the pattern seam — the STEMbot background now uses fixed-width rows
  so it tiles with zero gap, however far it scrolls.
- "Others (please specify)" option added to Organisation/Centre (backed by
  a real `POST /api/organisations` endpoint).
- The recovery question (favourite colour / subject) is now tappable image
  blocks instead of dropdowns, used in both sign-up and the forgot-PIN flow.

## Top bar & sidebar
- STEMulate logo added to the left of the greeting; green-yellow gradient
  throughout; bigger, bolder XP/Atom pills.
- Progress-to-next-level bar now lives permanently in the top bar, next to
  the greeting.
- Sidebar profile photo and progress ring enlarged and more prominent.
- Added **Games** and **Friends** tabs to both the sidebar and mobile nav.

## Dashboard
- "Meet the STEMbots!" row added just below the top bar — tap any STEMbot
  for a popup with their hobbies, interests, and a fun fact.
- Icon + XP/Atom legend bar moved to just below the tag filters, explaining
  what each numbered icon means so lesson items don't need labels like
  "Math Topic 1" anymore. "Interactive Simulation" renamed to "Game"
  everywhere.
- STEM x Games is now a featured, full-width card with a banner (composited
  from the 4 STEMbot mascots — no separate banner artwork was supplied, so
  this is a built stand-in rather than custom illustration). Lessons now
  expand **inline inside this same card** (previously they rendered below
  all the module cards), in a two-column layout with contextual titles
  (e.g. "Cycles in Matter" instead of "Science Topic 1"), a status label
  (Not started / In progress / Completed), and a Start Lesson / Continue /
  Review button so students can jump around freely.
- Completing every activity in STEM x Games now shows a "Badge earned!"
  ribbon and a "View Certificate" button, opening a certificate (same
  STEMbot pattern background as login) with a colour picker and
  print/save-as-PDF.
- The 3 locked modules now show a small banner treatment too, with the
  "Coming Soon!" lock overlay.

## Lesson pages
- Every lesson page now opens with a STEMbot dialogue bubble introducing
  that intro/video/quiz/game/exit-card and how many XP/Atoms it's worth.
- New "Ask about this lesson" panel at the top — ask a question and one of
  the 4 STEMbots replies. This is a lightweight rule-based responder using
  the beat's own title/description, not a live AI call (there's no LLM
  backend wired into this app yet) — swap `respond()` in
  `AskStembots.tsx` for a real API call whenever you're ready to connect one.

## Profile
- Shows XP remaining to the next level, plus a full list of all levels and
  their names (Curious Newbie → STEMulate Legend, etc.).
- Badges & Certificates section, including the STEM x Games certificate
  once earned.

## Gallery
- Every post now has a like button (toggleable, count updates live).
- Exit-card reflections submitted from a lesson are automatically
  published here as a distinct "Exit Card Reflection" post.

## New: Games tab
- Lists every game across every lesson, tagged with which lesson it
  belongs to. Locked until that lesson is completed; once unlocked, replay
  any game for a smaller top-up (10 XP + 5 Atoms).

## New: Friends tab
- Discord-style layout: individual + group chats, an "Add friend by
  username" box, and a "Trade Cards" modal. This runs on local mock state
  for now — there's no real-time multiplayer backend behind it yet, so
  messages/trades aren't actually sent to anyone. The Leaderboard also
  gained a "+ Friend" button per entry.

## Cards — full overhaul
- Extracted all 16 phenomena cards and 14 figure cards from your two PDFs
  as real images (front = question/portrait side, back = explanation side)
  and converted them to compressed JPEGs to keep the app light.
- Two proper albums (Phenomena, Figures) with cover pages you tap into,
  each showing collected-count and a progress bar.
- Packs now "unlock" with a tap-and-wait animation (progress fill,
  sparkle, confetti burst) instead of an instant purchase, then reveal
  drawn cards one-by-one with a flip-in animation.
- Rarity is real: figures use the Legendary/Epic/Rare split printed on
  your cards; phenomena cards were assigned a sensible common/rare/epic
  spread. Duplicates can be drawn (shown as "x2", "x3", etc.).
- Tap any owned card to flip between its front and back.

## Known simplifications (flagged honestly, not hidden)
- **Friends tab**: local-only state — no real backend, so friend
  requests/messages/trades don't reach another real user yet.
- **Ask-a-STEMbot**: rule-based canned responses, not a live model call.
- **Module banner**: composited from existing mascot art, since no
  dedicated banner illustration was supplied.
- **Leaderboard "centre"**: not shown — the mock leaderboard data doesn't
  currently carry each student's organisation, only username/XP/avatar.
