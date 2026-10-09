// Project STEMulate site behaviour: Academy link, mobile menu, tabs, quiz
// answer reveals, slide decks with a full-screen viewer, number count-ups and
// gentle scroll-in animations. Shared by every page. No dependencies.

// ─── Set this to the live STEMulate Academy address once it's deployed. ───
// Every "Enter STEMulate Academy" button on the site uses it. While it's
// empty, those buttons go to the Academy section on the home page instead.
// When you open the website on your own computer (localhost), the buttons
// go to the Academy app running locally with `npm run dev:all`.
const LIVE_ACADEMY_URL = "";
const LOCAL_ACADEMY_URL = "http://localhost:5173";
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname) || location.protocol === "file:";
const ACADEMY_URL = LIVE_ACADEMY_URL || (isLocal ? LOCAL_ACADEMY_URL : "");

document.documentElement.classList.add("js");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (ACADEMY_URL) {
  document.querySelectorAll("[data-academy-link]").forEach((a) => {
    a.href = ACADEMY_URL;
    a.target = "_blank";
    a.rel = "noopener";
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
  document.querySelectorAll(".slide-open").forEach((btn) => {
    btn.addEventListener("click", () => {
      const deck = btn.closest(".deck");
      list = deck._slides;
      show(list.indexOf(btn.closest(".slide")));
      lightbox.showModal();
    });
  });
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
  ".section-head, .fact, .prog, .bot-card, .flow, .lesson-info, .lesson-side, .curr, .totals, .tile, .timeline li, .quote, .join, .stat, .steps li, .mgroup, .member, .value, .milestones li, .growth, .deck, .ws-card"
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
