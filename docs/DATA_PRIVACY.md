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
| Sign-in attempts (username, success, time) | Spotting misuse | `login_attempts` |
| Lesson progress, quiz scores, XP, atoms, avatar | Learning features | `lesson_progress`, `users` |
| Best score per lesson game | High scores in the Games tab | `game_scores` |
| Friends, friend requests, chats, messages | Social features | `friendships`, `friend_requests`, `conversations`, `messages` |

Other students only ever see a username, avatar and level, never the full name
or centre (see `otherUser()` in `server/users.js`).

## What the PDPA and the children's guidelines ask for

1. **Consent from a parent or guardian.** The guidelines treat children under
   13 as generally unable to give valid consent, so for our 7 to 12 year olds a
   parent or guardian (in practice, through the partner centre) must consent.
   *To do:* add a consent step at sign-up, or have each centre collect consent
   forms before creating accounts.
2. **Purpose and notification.** Tell parents and children, in child-friendly
   words, what we collect and why. *To do:* a short privacy notice linked from
   the sign-up screen. The Privacy & account card on the Profile page is a
   start.
3. **Access and correction.** People can ask what data we hold and correct it.
   *Done:* Profile shows the stored details, name and username can be edited,
   and **Download my data** exports everything as JSON (`GET /api/me/export`).
4. **Retention limitation and withdrawing consent.** The PDPA has no
   GDPR-style "right to be forgotten", but data must not be kept once it is no
   longer needed, and consent can be withdrawn. *Done:* **Delete my account**
   (with an "are you sure?" pop-up and the PIN) permanently removes the user and
   every row tied to them: progress, sessions, sign-in attempts, friends,
   requests and sent messages (`deleteUserCompletely()` in `server/users.js`).
   Admins can delete an account from the admin page in the same way.
   *To do:* decide how long inactive accounts are kept (for example, delete
   after 12 months without a sign-in) and when a centre leaves.
5. **Protection.** Children's data needs a higher standard of care. *Done:*
   PINs and session tokens are hashed, chat and friend data need a signed-in
   session, friend requests only go to real accounts, and chats are only
   possible between accepted friends. *To do:* HTTPS everywhere when deployed,
   and keep the database in the Singapore region (see the Supabase guide).
6. **Data breach notification.** A notifiable breach must be reported to the
   PDPC (and usually the affected people) within 3 calendar days of assessing
   it as notifiable. *To do:* name who handles this.
7. **Accountability.** Appoint a Data Protection Officer and write down these
   policies.

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
