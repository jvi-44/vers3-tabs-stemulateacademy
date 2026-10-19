# Search and AI answers: the public website

How projstemulate.com gets found by Google and Bing and quoted by AI assistants
(ChatGPT, Claude, Perplexity, Gemini, Copilot). The website is plain HTML in
`website/`, so crawlers get the full text without running any JavaScript.

## What's set up

| Piece | Where |
|---|---|
| A title (60 characters or fewer) and a description (155 or fewer) per page | each page's `<head>` |
| One address per page (`<link rel="canonical">` on https://projstemulate.com), and links to `./`, never `index.html` | each page |
| `index, follow, max-image-preview:large, max-snippet:-1`, so search and AI answers may show big images and full snippets | each page |
| Share previews: image, size and alt text (`og:` and `twitter:` tags) | each page; the main image is `assets/social/og.jpg`, 1200×630, 155 KB |
| Structured data (JSON-LD): Organization, WebSite and WebPage on Home; a typed page and a breadcrumb on every inner page | each page. Organization, not NGO or charity: claim a legal status only with written proof |
| `robots.txt`: everyone may crawl, AI search bots listed explicitly, sitemap linked | `website/robots.txt` |
| `sitemap.xml` with the date each page last changed | `website/sitemap.xml` |
| `llms.txt`: a plain summary of the facts and pages for AI assistants | `website/llms.txt` |
| Icons: favicon, Apple home-screen icon, web manifest | `website/favicon.ico`, `website/assets/icons/`, `website/site.webmanifest` |
| A real 404 that search engines skip (`noindex`) | `website/404.html` |

## When the site moves to projstemulate.com

Every absolute address already uses https://projstemulate.com. Until the DNS
moves (DEPLOY.md §3), share previews of the onrender.com copy show no image,
because the image address points at the old Yola site.

After the move:

1. Check https://projstemulate.com/assets/social/og.jpg opens, then paste the
   home address into a WhatsApp chat to see the preview.
2. Run the playbook's site check on https://projstemulate.com and fix any FAIL.
3. **Google Search Console**: add projstemulate.com as a *Domain* property
   (Google gives a TXT record; add it in Cloudflare DNS). Submit
   `https://projstemulate.com/sitemap.xml`, then request indexing for Home,
   Workshops and About. If you use the HTML-file method instead, never delete
   that `google….html` file.
4. **Bing Webmaster Tools**: import the site from Search Console (one click).
   Its *AI Performance* report shows when Copilot cites the site.

If the address ever changes again, find and replace `https://projstemulate.com`
across `website/` (canonicals, share tags, JSON-LD, sitemap, robots, llms.txt).

## When the content changes

- Update the `<lastmod>` date of that page in `sitemap.xml`.
- Keep the same facts everywhere: the numbers (450+ children, 80+ workshops,
  10 partners, 50 volunteers), the name **Project STEMulate**, the one-line
  description and Singapore must match on the pages, in `llms.txt`, in the
  JSON-LD and on Instagram. Consistent facts are how search engines and AI
  assistants recognise the project.
- A new page: give it a title, a description, a canonical, the share tags, a
  JSON-LD page block like the others, a line in `llms.txt` and an entry in the
  sitemap.

## What to expect

- A new site ranks for its own name first ("Project STEMulate"), then for name
  plus topic ("STEM workshops Singapore students"). Broad phrases take long.
- Early visitors come from links: Instagram, partners' pages, newsletters and
  QR codes on flyers. Put the address on every one of them.
- Search Console shows data after a few days; ranking takes weeks. AI
  assistants cite pages that are indexed and specific; there is no switch.
