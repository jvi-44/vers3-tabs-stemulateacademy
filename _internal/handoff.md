# STEMulate (Janhvi) BugHunt v4 quick wins (2026-11-16): handoff

## State
- Uncommitted on `main`, on top of 67b4d5b: 5 files changed, 6 images added (marked with `git add -N`, so they show as added).
- Patch: `_internal/quickwins-2026-11-16.patch` (11 file diffs, binary, about 550 KB).
- Hooks: pre-commit = commit gate, pre-push = push gate. Nothing was committed or pushed.
- `_internal/` is untracked and not in .gitignore: leave it out when you stage.

## What changed and why
- **V4-07 privacy label contrast** (`website/styles.css`): `.policy .crumb { color: var(--forest) }`. The "Privacy" label on
  privacy.html is now forest on cream, 9.82:1 (it was lime, 1.27:1). The second half of the finding: the
  "About STEMulate Academy" link on curriculum.html's lilac band is forest, `.band-lilac .text-link`, 8.52:1 (was
  leaf-deep, 4.21:1). Same token the lime band's links already use. The labels on the other pages are unchanged (lime on
  forest, 7.76:1).
- **V4-08 Esc closes the mobile menu** (`website/script.js`): Escape closes the open menu, sets aria-expanded "false" and
  the label back to "Open menu", and moves focus to the menu button when it was on a menu link.
- **V4-09 phone-sized images**:
  - Home hero (`website/index.html`) and the same photo on Impact (`website/impact.html`): `<picture>` with
    `session-floor-800/1200/1800.webp` (69/116/190 KB) and `sizes`. The original JPEG (314 KB) stays as the fallback.
    The WebP files are resized copies of the existing photo, with no new picture.
  - `website/academy.html`: the three slide covers in "Keep exploring at home" use 336×189 thumbnails
    (`assets/slides/<deck>/01-thumb.jpg`, 9–13 KB) instead of the 1280 px slides (75–88 KB). They are shown 112 px wide.
    The same list on curriculum.html keeps the full slides, because that page already loads each `01.jpg` at full size
    (deck covers and tabs), so thumbnails there would only add requests.
- No wording changes.

## Checks
- The website is Render static (`website/`, no build step). `node --check website/script.js`: OK.
- Repo scripts in the `_build` copy (`npm ci` frozen, changed files copied in, then restored to HEAD): `npm run build` OK;
  `npm test` OK: 227/227 server tests, 59/59 client tests (14 files). They don't read the changed files.
- Browser (Playwright on a local static server, 390 px at 3x and 1440 px at 1x, fresh context each):
  - V4-07: the contrast figures above, measured from computed colours.
  - V4-08: menu open, then Tab to "Home", then Escape: menu closed, aria-expanded "false", label "Open menu", focus on
    the button. The button still opens it again, and Escape with focus on the button closes it too. At 1440 there is no
    menu button and the desktop nav is unaffected.
  - V4-09: at 390@3x the Home hero loads `session-floor-1200.webp`, 119 KB (it was `session-floor.jpg`, 322 KB), as a
    single request. At 1440 it loads `session-floor-1800.webp`, 195 KB. The academy covers load 9–13 KB each. Image
    boxes are identical to before at both widths (Home 375×281 / 1425×720, Impact 343×257 / 518×389, covers 112×63).
    LCP was not re-measured on slow 3G. No console errors.
  - Screenshots (photos hidden): `qa-evidence/BugHunt_v4/Janhvi/fixes/` V4-07-privacy-390/1440, V4-07-curriculum-390/1440,
    V4-08-390/1440, V4-09-home-390/1440, V4-09-academy-390/1440, plus measurements.json.
- lint_repo: 0 FAIL, 1 WARN (`supabase/schema.sql` p_xp, existing and untouched).
- /project-cleanup: not run in this window. It is the house rule before a push.

## Before Herdy pushes
- [ ] What deploys from main: render.yaml. `stemulate-website` (static `website/`) redeploys on push. `stemulate-academy`
      (`branch: main`, autoDeploy not turned off) rebuilds too. Nothing in it changed, and it is still down (V4-01).
- [ ] Photo consent (V4-04): `session-floor.jpg` shows children, with no consent on record. This round ships the same
      photo in three WebP sizes as well. If V4-04 replaces or removes the photo, also delete
      `session-floor-800/1200/1800.webp` and update the `<picture>` in index.html and impact.html.
- [ ] Media shipping: no new photo. The same `session-floor` photo now ships as the JPEG plus 3 WebP sizes. The slide
      thumbnails are workshop slides.
- [ ] Run /project-cleanup, then the push gate (`push_gate.mjs approve` after your "push").
- [ ] Suggested commit message:
      ```
      Website: privacy label contrast, Esc closes the menu, smaller hero images

      - Privacy page label and the Academy link on the lilac band use forest
        (9.8:1 and 8.5:1; were 1.3:1 and 4.2:1)
      - Escape closes the mobile menu and returns focus to the menu button
      - Home and Impact hero: WebP 800/1200/1800 via <picture> and sizes
        (a phone gets 119 KB instead of 322 KB); 336 px slide-cover
        thumbnails on the Academy page

      BugHunt v4: V4-07, V4-08, V4-09

      Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
      ```

## Open
- V4-01 to V4-06 are unchanged (Academy down, Gemini/privacy mismatch, photo consent, partner count, staff lockout).
  They are Herdy's or the student's per the quick-wins plan.
