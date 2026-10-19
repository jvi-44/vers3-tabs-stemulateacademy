// Project STEMulate site behaviour: Academy link, mobile menu, tabs, quiz
// answer reveals, slide decks with a full-screen viewer, number count-ups and
// gentle scroll-in animations. Shared by every page. No dependencies.

// ─── The live STEMulate Academy address (hosted on Render, see DEPLOY.md). ───
// Every "Enter STEMulate Academy" button on the site uses it, or the Render
// address until the real domain answers (see below). When the site is
// served by the Academy itself (at /site, on your own computer), the buttons
// open that same host. When you open the website on its own on your computer
// (localhost:8000 or a file), they go to the Academy running locally with
// `npm run dev:all`.
const LIVE_ACADEMY_URL = "https://academy.projstemulate.com";
// The Academy's Render address. The buttons use it until academy.projstemulate.com
// answers (its DNS isn't set up yet), so they never lead to an error page.
const FALLBACK_ACADEMY_URL = "https://stemulate-academy.onrender.com";
const LOCAL_ACADEMY_URL = "http://localhost:5173";
const servedByAcademy = location.pathname.startsWith("/site/");
const isLocal = !servedByAcademy && (["localhost", "127.0.0.1"].includes(location.hostname) || location.protocol === "file:");
const ACADEMY_URL = servedByAcademy ? location.origin + "/" : isLocal ? LOCAL_ACADEMY_URL : FALLBACK_ACADEMY_URL;

document.documentElement.classList.add("js");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const academyLinks = document.querySelectorAll("[data-academy-link]");
academyLinks.forEach((a) => {
  a.href = ACADEMY_URL;
  a.target = "_blank";
  a.rel = "noopener";
});

// On the live site, switch the buttons to the real domain once the Academy
// answers there. The check loads academy-check.png, a tiny image only the
// Academy serves (public/ in this repo): a missing domain, a parked page or a
// host's error page can't load as that image, so the fallback stays until the
// Academy itself is live on academy.projstemulate.com. It runs only when
// someone reaches for a button, so page loads and search crawlers never request
// an address that may not exist yet (a console error).
if (ACADEMY_URL === FALLBACK_ACADEMY_URL) {
  let checked = false;
  const checkLiveAcademy = () => {
    if (checked) return;
    checked = true;
    const probe = new Image();
    probe.onload = () => academyLinks.forEach((a) => (a.href = LIVE_ACADEMY_URL));
    probe.src = `${LIVE_ACADEMY_URL}/academy-check.png?${Date.now()}`;
  };
  academyLinks.forEach((a) => {
    for (const type of ["pointerenter", "focus", "touchstart"]) {
      a.addEventListener(type, checkLiveAcademy, { once: true, passive: true });
    }
  });
}

// Mobile menu
const toggle = document.querySelector(".nav-toggle");
const links = document.getElementById("nav-links");
toggle.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});
links.addEventListener("click", (e) => {
  if (e.target.closest("a")) {
    links.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }
});

// Tabs (each tablist works on its own; arrow keys move between tabs, per the
// WAI-ARIA tabs pattern)
document.querySelectorAll('[role="tablist"]').forEach((list) => {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  function selectTab(tab) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (e) => {
      const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!dir) return;
      const next = tabs[(i + dir + tabs.length) % tabs.length];
      selectTab(next);
      next.focus();
    });
  });
});

// Quiz answer reveals
document.querySelectorAll(".reveal").forEach((btn) => {
  btn.addEventListener("click", () => {
    const answer = btn.nextElementSibling;
    const show = answer.hidden;
    answer.hidden = !show;
    btn.setAttribute("aria-expanded", String(show));
    btn.textContent = show ? "Hide answer" : "Reveal answer";
  });
});

// Slide decks: arrow buttons scroll one slide at a time and the counter
// follows whichever slide is in view
document.querySelectorAll(".deck").forEach((deck) => {
  const track = deck.querySelector(".deck-track");
  const slides = [...track.querySelectorAll(".slide")];
  const count = deck.querySelector(".deck-count b");
  const [prev, next] = deck.querySelectorAll(".deck-nav .deck-btn");

  // Slide i is "current" when its left edge is nearest the track's scroll position
  const pos = (i) => slides[i].offsetLeft - slides[0].offsetLeft;
  const current = () => {
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) return slides.length - 1;
    let best = 0;
    slides.forEach((_, i) => {
      if (Math.abs(pos(i) - track.scrollLeft) < Math.abs(pos(best) - track.scrollLeft)) best = i;
    });
    return best;
  };
  const update = () => {
    const i = current();
    count.textContent = i + 1;
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
  };
  const go = (i) => track.scrollTo({ left: pos(Math.max(0, Math.min(slides.length - 1, i))) });
  prev.addEventListener("click", () => go(current() - 1));
  next.addEventListener("click", () => go(current() + 1));
  track.addEventListener("keydown", (e) => {
    const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (dir) { e.preventDefault(); go(current() + dir); }
  });
  let t;
  track.addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(update, 60); }, { passive: true });
  update();
  deck._slides = slides;
});

// Full-screen slide viewer
const lightbox = document.querySelector(".lightbox");
if (lightbox && typeof lightbox.showModal === "function") {
  const img = lightbox.querySelector(".lb-img");
  const cap = lightbox.querySelector(".lb-cap");
  let list = [];
  let at = 0;
  const show = (i) => {
    at = (i + list.length) % list.length;
    const fig = list[at];
    const src = fig.querySelector("img");
    img.src = src.src;
    img.alt = src.alt;
    cap.textContent = `${at + 1} / ${list.length} · ${fig.dataset.caption}`;
  };
  const openDeck = (deck, i = 0) => {
    if (!deck?._slides) return;
    list = deck._slides;
    show(i);
    lightbox.showModal();
  };
  document.querySelectorAll(".slide-open").forEach((btn) => {
    btn.addEventListener("click", () => {
      const deck = btn.closest(".deck");
      openDeck(deck, deck._slides.indexOf(btn.closest(".slide")));
    });
  });
  // "Full screen" on a deck starts at the slide in view
  document.querySelectorAll(".deck-full").forEach((btn) => {
    btn.addEventListener("click", () => {
      const deck = btn.closest(".deck");
      openDeck(deck, Number(deck.querySelector(".deck-count b").textContent) - 1);
    });
  });
  // The deck covers at the top of the curriculum page, and links such as
  // curriculum.html#open-minecraft from the home page, open a deck from slide 1
  const deckNamed = (name) => document.querySelector(`.deck[data-deck="${CSS.escape(name)}"]`);
  document.querySelectorAll("[data-open-deck]").forEach((btn) => {
    btn.addEventListener("click", () => openDeck(deckNamed(btn.dataset.openDeck)));
  });
  const fromLink = /^#open-([a-z]+)$/.exec(location.hash);
  if (fromLink) openDeck(deckNamed(fromLink[1]));
  lightbox.querySelector(".lb-prev").addEventListener("click", () => show(at - 1));
  lightbox.querySelector(".lb-next").addEventListener("click", () => show(at + 1));
  lightbox.querySelector(".lb-close").addEventListener("click", () => lightbox.close());
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.close(); });
  lightbox.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") show(at + 1);
    if (e.key === "ArrowLeft") show(at - 1);
  });
}

// Number count-ups. The final figure is already in the HTML, so nothing is
// lost if this never runs.
function countUp(el) {
  const end = Number(el.dataset.count);
  const suffix = el.dataset.suffix || "";
  const start = performance.now();
  const dur = 1100;
  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur);
    el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + (p === 1 ? suffix : "");
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Scroll-in animations. Anything already on screen shows straight away, and
// a safety timer reveals the rest so no section can stay blank (for example
// in previews and screenshots that never scroll).
const revealTargets = document.querySelectorAll(
  ".intro, .intro-centred, .wcard, .number, .rhythm li, .partner, .partner-row, .deck-cover, .screens figure, .bots-row li, .pullquote, .quote, .split-photo, .year, .way, .member, .methods li, .growth, .deck, .ws-card, .curr, .total, .faq details, .cta-band, .steps-3 li, .poster"
);
const counters = document.querySelectorAll("[data-count]");
if ("IntersectionObserver" in window && !reduceMotion) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0, rootMargin: "0px 0px -6% 0px" }
  );
  revealTargets.forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.classList.add("reveal-up");
    io.observe(el);
  });
  setTimeout(() => revealTargets.forEach((el) => el.classList.add("in")), 4000);

  const co = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      countUp(entry.target);
      co.unobserve(entry.target);
    });
  }, { threshold: 0.6 });
  counters.forEach((el) => co.observe(el));
}
