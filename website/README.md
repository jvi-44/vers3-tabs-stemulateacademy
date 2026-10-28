# Project STEMulate website (projstemulate.com)

A static site: plain HTML, CSS and JS with no build step. On Render it is the
`stemulate-website` static site in `render.yaml`, at https://projstemulate.com
(see DEPLOY.md in the repo root). The Academy lives at
https://academy.projstemulate.com.

| Page | What's on it |
|---|---|
| `index.html` | Home: a real session photo, the numbers, what we do in person, the six STEM x workshops as collectible cards, how a workshop runs (short), what changes for the children, partners, a small "New in 2026" Academy band, the team, ways to get involved |
| `curriculum.html` | The STEM x series, how a workshop runs, the three STEM x Games slide decks (one click to full screen) and each workshop in detail, the curriculum map, the matching Academy lessons, booking a workshop |
| `impact.html` | Numbers, growth, year by year 2023–2026, the workshops with each partner, other events, recognitions & grants, how we measure it, testimonials |
| `about.html` | Mission, our story 2023–2026, the current committee (team cards), FAQ |
| `get-involved.html` | Sign-up forms: volunteering, partnering, starting a chapter, the newsletter |
| `privacy.html` | What the forms, the assistant and STEMulate Academy keep, and who can see it |
| `academy.html` | STEMulate Academy: an online add-on to the workshops, how it fits, what's inside, the STEMbots, sign-in for parents and centres |
| `404.html` | Shown by Render for a page that doesn't exist |

`robots.txt` and `sitemap.xml` tell search engines about the seven pages. The old
`workshops.html` redirects to the home page (a route in `render.yaml`).

The site's main message: Project STEMulate runs free, in-person STEM workshops
with children, and has since 2023. STEMulate Academy is a new add-on that keeps
the learning going between workshops, so it never opens a page except its own
and is a normal last tab in the menu.

## Preview on your own computer

```bash
python -m http.server 8000 --directory website
```

Then open http://localhost:8000. Or run the whole project with `npm run dev:all`
and open http://localhost:4000/site/. The "Enter STEMulate Academy" buttons (on `academy.html`) open
the Academy running locally; on projstemulate.com they open
https://academy.projstemulate.com (`LIVE_ACADEMY_URL` at the top of `script.js`).

## Updating content

- **Numbers** (450+, 80+, 10, 50) are on `index.html` and `impact.html`: search
  for `data-count` and change both the attribute and the text.
- **Photos** live in `assets/photos/`. They came from the old Yola site,
  resized for the web with phone location data removed. To swap one, keep the
  file name (or update the `src`), and keep photos around 1,100 px wide (hero:
  1,800 px). Only use photos of children whose families agreed to it.
- **Workshop cards**: each STEM x workshop is a `<article class="wcard x-...">`
  on `index.html` and `curriculum.html`. Most cards show only a photo and the name;
  to add a description, put a `<p>` after the `<h3>`.
- **Partners**: logos are in `assets/partners/`. Add a partner to the wall on
  `index.html` (`.partner-wall`) and to the list on `impact.html`
  (`.partner-list`, with what we do together). A new partner card on
  `impact.html` also needs its own empty `<ul class="org-workshops" data-collection>` (copy one).
- **Committee**: each person is an `<li class="team-card" data-member="…">` on `about.html` (see "Adding content" below for photos and bios).
- **Menu and footer**: the same six tabs are on every page (and `404.html`); change all of them together.
- **Workshop slides** live in `assets/slides/<workshop>/`, named by slide number
  in the original deck. Each deck on `curriculum.html` has `data-deck="..."`;
  links like `curriculum.html#open-minecraft` open that deck full screen.
- **Forms**: the volunteer, partner, chapter and newsletter forms on
  `get-involved.html` send to STEMulate Academy (`forms.js`, `forms.css`); the
  team reads them on the Academy's admin page under **Website sign-ups**.
  Without JavaScript they still work as normal form posts. The old Google Forms
  (newsletter and chapter application) were closed in October 2026.
- **The "Ask us" assistant** (`assistant.js`, `assistant.css`, loaded by
  `script.js` on every page) answers from `llms.txt`, so keep that file up to
  date. Its button stays hidden until `ASSISTANT_ON` in `script.js` is true,
  which waits for an AI service to be chosen and its key to be on the Academy
  (DEPLOY.md "AI chat: decide first").
- Slogan options are in `SLOGANS.md`.

## Adding content

Some lists start empty and stay hidden until they hold something: any element marked
`data-collection` shows as soon as it contains one `data-item` (CSS `:has()`, with a
fallback in `script.js` for older browsers). Each has an HTML comment
with a ready-made line. Copy it, paste it below the comment (outside `<!-- -->`) and fill
it in. Never leave the template words (NUMBER, Month YYYY, YEAR, LINK) in place.

- **A year's figures** (`impact.html#years`): in that year's `<ul class="year-figures">` add
  `<li data-item><b>120</b> children reached</li>` (or workshops, volunteers, partners).
- **Workshops with a partner** (`impact.html#partners`): in that partner's
  `<ul class="org-workshops">` add
  `<li data-item><b>STEM x Games: Minecraft Masterminds</b><span>March 2025</span></li>`.
  A new partner card needs its own empty `org-workshops` list (copy one).
- **Other events** (`impact.html#events`): copy the commented card (date, name, one sentence).
- **Recognitions & grants** (`impact.html#recognitions`): copy the commented card (year, name,
  who gave it, optional "Read more" link). The section appears with the first one.
- **Team** (`about.html#exco`): each person is `<li class="team-card" data-member="firstname">`.
  For a photo, save a square image (at least 320 × 320 px, with their permission) as
  `assets/team/<firstname>.jpg` and replace their `<span class="m-initial" …>J</span>` with
  `<img src="assets/team/janhvi.jpg" alt="Janhvi" width="320" height="320" loading="lazy">`.
  For a bio, add `<p class="team-bio">One or two sentences.</p>` after the role.
- **Curriculum library** (`curriculum.html#library`): one row per workshop. Put the PDF in
  `website/files/curriculum/` as `<slug>-slides.pdf`, `<slug>-lesson-plan.pdf` or
  `<slug>-worksheet.pdf` (slugs: minecraft-masterminds, mission-millionaire, space-busters,
  stem-x-sports, stem-x-coding, stem-x-nature, stem-x-magic, stem-x-content-creation), then
  move the matching `<a data-item href="files/curriculum/…">` line out of that row's comment.
  A row with no links stays hidden.
