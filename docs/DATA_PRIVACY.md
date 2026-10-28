# Data privacy and account deletion

STEMulate Academy is used by children aged 7 to 12 at partner centres in
Singapore, so Singapore's **Personal Data Protection Act 2012 (PDPA)** is the
main law that applies, together with the PDPC's **Advisory Guidelines on the
PDPA for Children's Personal Data in the Digital Environment** (March 2024).
This note is a working summary for the team, not legal advice. Check it with
the partner centres or a lawyer before real classes start.

## What the Academy stores

| Data | Why | Where |
| --- | --- | --- |
| Full name, username, centre, school level | Account and progress reports | `users` |
| 4-digit PIN (bcrypt hash only), recovery colour + subject | Sign-in and PIN reset | `users` |
| Sign-in sessions (SHA-256 hash of the token only) | Staying signed in | `sessions` |
| Sign-in attempts and PIN changes (username, success, kind, time) | Spotting misuse; closing Forgot PIN after 3 wrong answers | `login_attempts` |
| Lesson progress, quiz scores, XP, atoms, avatar | Learning features | `lesson_progress`, `users` |
| Best score per lesson game | High scores in the Games tab | `game_scores` |
| Friends, friend requests, chats, messages | Social features | `friendships`, `friend_requests`, `conversations`, `messages` |
| Staff and volunteer accounts: name, email, bcrypt password hash, role, centres | Staff page sign-in | `staff`, `staff_centres` |
| Staff sessions, one-time set-up links (SHA-256 hashes only), sign-in attempts | Signing in safely | `staff_sessions`, `staff_setup_tokens`, `staff_login_attempts` (30 days) |
| Who opened the student list, looked at or changed a student, a staff account, a set-up link or a website sign-up, and when (with the account's name and email then) | Accountability | `staff_actions` (12 months) |
| Website sign-ups: name, email, and school, organisation, phone, message or the volunteer form's "I'd like to help with" choices when given | Replying to volunteers, partners and chapter applicants; the newsletter | `site_signups` (12 months; newsletter until removed) |

Other students only ever see a username, avatar and level, never the full name
or centre (see `otherUser()` in `server/users.js`).

## Staff and volunteer access (round 8)

- An admin adds each account and picks the centres it follows; nobody signs up
  themselves. Each person sets their own password from a one-time link (7
  days). An account has one link at a time, and a new email on an account
  stops its old link working.
- **Volunteers** see the students at the centres they follow: name, username,
  school level, centre, progress, scores and last active. **Centre staff** see
  the same and can set a new PIN for a student who forgot it. The staff page
  never shows chats, friends or reflections, but whoever sets a new PIN could
  sign in as the student, which is why PIN resets are logged. **Admins** see
  everything, as on the admin page.
- An admin can let a centre-staff account follow **all centres** (one of
  STEMulate's own coordinators, say). It then sees every student, "Others"
  included, and can reset their PINs. Volunteers can't follow all centres:
  the admin page refuses it and so does the database (a CHECK on `staff`).
  Students under "Others" are visible only to all-centres accounts and admins.
- The staff page offers centre staff (not volunteers) an **Export CSV** button
  and reminds them after saving to delete the file from shared devices.
  Volunteers still see the same list on screen, so this is a nudge, not a lock.
  Exported files (of students or website sign-ups) are copies outside these
  rules: delete them when you're done.
- `staff_actions` records who did what and when, with the account's name and
  email at the time: opening the student list, each progress view, PIN reset
  and change to or deletion of a student, each change to a staff account
  (including new set-up links), and deleting a website sign-up. Looking at the
  same thing again within an hour is recorded once. Each change is saved
  together with its line, in one database call, so a change can't happen
  without its record (looks are recorded before the page shows them). Anything done with the
  admin passkey shows as "Admin passkey", which doesn't say who used it, so
  once named admin accounts exist, keep the passkey for emergencies. The admin
  page's Activity tab shows the newest 100 first, with **Show older** to go
  back and **Only changes** to leave out the looks.
- The activity log and website sign-ups (except newsletter emails) older than
  12 months, and staff sign-in tries older than 30 days, are deleted when the
  server starts and once a day (`stem_retention_purge`), and also whenever
  those tables are written or listed.
- Centre tablets are shared with children. The staff cookie isn't kept when
  the browser closes (though some browsers bring it back with their tabs), and
  every session ends after an hour unused or 12 hours after sign-in. The staff
  and admin pages also clear themselves after an hour without use, check the
  session when the tablet wakes up and always show who is signed in. Leaving
  them for the Academy by any way, the browser's Back button included, signs
  out; if the tablet is offline then, the next visit to either page finishes
  the sign-out before showing anything (`src/lib/staffArea.ts`).
- Students see this in child-friendly words at sign-up and on the Me page,
  with a link to `website/privacy.html`.

## AI chat providers

Both chats are switched off for now. The lesson helper sends the question to
Google's Gemini once `GEMINI_API_KEY` is set, with the lesson's topic and the
student's school level, never a name or account. The website's "Ask us" uses
`GEMINI_SITE_API_KEY` (or `GEMINI_API_KEY` when that isn't set), and its button
only shows once `ASSISTANT_ON` is true in `website/script.js`;
`ASSISTANT_DAILY_LIMIT=0` keeps it off on the server too. Google's Gemini API
terms don't allow services likely to be used by under-18s, and unpaid keys let
Google use what's sent to improve its products, with people who may read it.
Decide on a provider and plan that allow it before adding either key (DEPLOY.md
"AI chat: decide first"), and name it in `website/privacy.html`.

## What the PDPA and the children's guidelines ask for

1. **Consent from a parent or guardian.** The guidelines treat children under
   13 as generally unable to give valid consent, so for our 7 to 12 year olds a
   parent or guardian (in practice, through the partner centre) must consent.
   *Partly done:* sign-up asks the child to tick "My parent or teacher said I
   can join", which is the child's own word, not checked consent. *To do:* have
   each centre collect parents' consent before children sign up.
2. **Purpose and notification.** Tell parents and children, in child-friendly
   words, what we collect and why. *Done:* `website/privacy.html` (with a
   section on the Academy), linked from the sign-up screen and the Me page,
   which both also say it in a child-friendly line.
3. **Access and correction.** People can ask what data we hold and correct it.
   *Done:* Profile shows the stored details, name and username can be edited,
   and **Download my data** exports everything as JSON (`GET /api/me/export`).
4. **Retention limitation and withdrawing consent.** The PDPA has no
   GDPR-style "right to be forgotten", but data must not be kept once it is no
   longer needed, and consent can be withdrawn. *Done:* **Delete my account**
   (with an "are you sure?" pop-up and the PIN) permanently removes the user and
   every row tied to them: progress, sessions, sign-in attempts, friends,
   requests and sent messages (`stem_user_delete()` in `supabase/schema.sql`,
   called by `deleteUserCompletely()` in `server/users.js`).
   Admins can delete an account from the admin page in the same way.
   *To do:* decide how long inactive accounts are kept (for example, delete
   after 12 months without a sign-in) and when a centre leaves.
5. **Protection.** Children's data needs a higher standard of care. *Done:*
   PINs and session tokens are hashed, chat and friend data need a signed-in
   session, friend requests only go to real accounts, and chats are only
   possible between accepted friends. HTTPS everywhere on Render, students' data in a
   Supabase project in Singapore that only the server can reach (every table is
   locked to the server's secret key; see DEPLOY.md and SQL_EXPLAINED.md).
6. **Data breach notification.** A notifiable breach must be reported to the
   PDPC (and usually the affected people) within 3 calendar days of assessing
   it as notifiable. *To do:* name who handles this.
7. **Accountability.** Appoint a Data Protection Officer and write down these
   policies.

## Guest mode

"Continue as guest" on the sign-in screen lets anyone look around without an
account. Guests send nothing to the server and nothing is stored: XP, lesson
progress and game scores live only in the open tab and vanish on refresh. The
leaderboard, friends, chat and live games stay locked for guests, because they
show other students' usernames.

## If users come from outside Singapore

- **EU/UK (GDPR, UK Children's Code):** explicit right to erasure (Art. 17)
  and data portability (Art. 20); the deletion and export features above cover
  both.
- **US (COPPA):** verifiable parental consent for under-13s and deletion on a
  parent's request.

## Sources

- [PDPC Advisory Guidelines on Children's Personal Data (Rajah & Tann summary)](https://www.rajahtannasia.com/viewpoints/pdpc-issues-advisory-guidelines-on-childrens-personal-data-in-the-digital-environment/)
- [Bird & Bird summary of the same guidelines](https://twobirds.com/en/insights/2024/singapore/singapore-pdpc-issues-advisory-guidelines-on-the-pdpa)
- [PDPC guidelines index](https://www.pdpc.gov.sg/guidelines-and-consultation)
