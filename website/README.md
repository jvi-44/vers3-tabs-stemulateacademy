# Project STEMulate website

A static site (plain HTML, CSS and JS, no build step) with four pages:

| Page | What's on it |
|---|---|
| `index.html` | Home: slogan, impact numbers, programmes, STEMbots, lessons, Academy |
| `curriculum.html` | Workshop flow, the three STEM x Games workshops with their slides, curriculum map |
| `impact.html` | Headline numbers, growth, evaluation metrics, partners, testimonials |
| `about.html` | Our story, values, and the EXCO by batch |

Preview locally with `python3 -m http.server` from this folder.

## Updating content

- **Numbers:** search for `data-count` (home and impact pages). Change both the
  attribute and the text.
- **Metrics still being collected** are `<li class="metric tbc">` on
  `impact.html`. To fill one in, remove `tbc` and put the figure in its `<b>`.
- **EXCO:** each person is an `<li class="member">` on `about.html`. Placeholder
  cards are `member-tbc`. To add a photo, put it in `assets/team/` and replace
  the `m-initial` span with `<img class="m-photo-img" src="assets/team/name.jpg" alt="">`.
- **Workshop slides** live in `assets/slides/<workshop>/`, named by slide number
  in the original deck.
- **Academy link:** set `ACADEMY_URL` at the top of `script.js`.
- Slogan options are in `SLOGANS.md`.
