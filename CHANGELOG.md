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
