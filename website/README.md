# Project STEMulate website (projstemulate.com)

A static site: plain HTML, CSS and JS with no build step. On Render it is the
`stemulate-website` static site in `render.yaml`, at https://projstemulate.com
(see DEPLOY.md in the repo root). The Academy lives at
https://academy.projstemulate.com.

| Page | What's on it |
|---|---|
| `index.html` | Home: a real session photo, the numbers, the STEM x workshops as collectible cards, how a workshop runs, partners, the slide decks, STEMulate Academy, testimonials, the team, ways to get involved |
| `workshops.html` | The STEM x series, 1-to-1 sessions, learning journeys and enrichment activities, what changes for the children |
| `curriculum.html` | The three STEM x Games slide decks (one click to full screen), how a workshop runs, each workshop in detail, the curriculum map |
| `impact.html` | Numbers, growth, how we measure it, every partner and what we do together, testimonials |
| `about.html` | Mission, our story 2023–2026, the current committee, starting a chapter, FAQ |
| `404.html` | Shown by Render for a page that doesn't exist |

`robots.txt` and `sitemap.xml` tell search engines about the five pages.

## Preview on your own computer

```bash
python -m http.server 8000 --directory website
```

Then open http://localhost:8000. Or run the whole project with `npm run dev:all`
and open http://localhost:4000/site/. The "Enter STEMulate Academy" buttons open
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
  on `index.html` and `workshops.html`. Most cards show only a photo and the name;
  to add a description, put a `<p>` after the `<h3>`.
- **Partners**: logos are in `assets/partners/`. Add a partner to the wall on
  `index.html` (`.partner-wall`) and to the list on `impact.html`
  (`.partner-list`, with what we do together).
- **Committee**: each person is an `<li class="member">` on `about.html`.
- **Workshop slides** live in `assets/slides/<workshop>/`, named by slide number
  in the original deck. Each deck on `curriculum.html` has `data-deck="..."`;
  links like `curriculum.html#open-minecraft` open that deck full screen.
- **Forms**: the newsletter and chapter application are Google Forms
  (`forms.gle/...` links); partner and volunteer enquiries go to
  proj.stemulate@gmail.com.
- Slogan options are in `SLOGANS.md`.
