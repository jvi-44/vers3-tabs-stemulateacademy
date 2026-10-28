// "Ask us": a small chat on every page that answers questions about Project
// STEMulate. script.js loads this file. Questions go to the Academy's server
// (POST /api/site/assistant), which asks Google's Gemini using only the facts
// in llms.txt; nothing typed here is stored. Replies are shown as plain text.
(() => {
  const here = document.currentScript?.src || location.href;
  const asset = (path) => new URL(path, here).href;
  const base = (window.STEMULATE?.academyUrl || "https://academy.projstemulate.com/").replace(/\/+$/, "");
  const endpoint = `${base}/api/site/assistant`;
  const EMAIL = "proj.stemulate@gmail.com";
  const MAX_CHARS = 400;
  // Its own earlier replies go back as context; the server takes up to 2000
  // characters of each (server/routes/site.js ASSISTANT_MAX_REPLY_CHARS).
  const MAX_REPLY_CHARS = 2000;
  /** At most `max` characters, without cutting an emoji in half. */
  const cut = (text, max) => (text.length <= max ? text : text.slice(0, max).replace(/[\uD800-\uDBFF]$/, ""));
  const SUGGESTIONS = ["How can I volunteer?", "What happens at a workshop?", "What is STEMulate Academy?"];

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = asset("assistant.css");
  document.head.appendChild(css);

  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    node.append(...children);
    return node;
  };

  const launcher = el("button", { class: "ask-launcher", type: "button", "aria-expanded": "false", "aria-controls": "ask-panel" },
    el("img", { src: asset("assets/bots/stembot_green.png"), alt: "", width: "40", height: "40" }),
    el("span", { text: "Ask us" }));

  const log = el("div", { class: "ask-log", role: "log", "aria-live": "polite", "aria-label": "Conversation" });
  const input = el("textarea", { id: "ask-input", rows: "2", maxlength: String(MAX_CHARS), placeholder: "Type a question", "aria-label": "Your question" });
  const send = el("button", { type: "submit", class: "ask-send" }, "Send");
  const form = el("form", { class: "ask-form" }, input, send);
  const chips = el("div", { class: "ask-chips" }, ...SUGGESTIONS.map((q) => el("button", { type: "button", class: "ask-chip", text: q })));
  const closeBtn = el("button", { type: "button", class: "ask-close", "aria-label": "Close" }, "×");
  const privacy = el("a", { href: asset("privacy.html#assistant"), text: "Privacy" });
  const note = el("p", { class: "ask-note" },
    "Answers are written by AI (Google Gemini) from this website and can be wrong. Please don't type personal details. ", privacy);
  const panel = el("section", { id: "ask-panel", class: "ask-panel", role: "dialog", "aria-modal": "false", "aria-labelledby": "ask-title", hidden: "" },
    el("header", { class: "ask-head" }, el("h2", { id: "ask-title", text: "Ask Project STEMulate" }), closeBtn),
    log,
    chips,
    form,
    note);

  const say = (who, text) => {
    const bubble = el("p", { class: `ask-msg ask-${who}` });
    bubble.textContent = text;
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  };
  say("bot", "Hi! Ask me about our workshops, volunteering, partnering or STEMulate Academy.");

  /** The conversation so far, in the shape the server (and Gemini) expects. */
  const history = [];
  let busy = false;

  const ask = async (question) => {
    const text = cut(question.trim(), MAX_CHARS);
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    chips.hidden = true;
    say("you", text);
    history.push({ role: "user", parts: [{ text }] });
    const waiting = say("bot ask-wait", "Thinking…");
    // The Academy's free server sleeps when it isn't used.
    const slow = setTimeout(() => (waiting.textContent = "Waking up… this can take up to a minute."), 4000);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-8).map((m) => (m.role === "model" ? { role: "model", parts: [{ text: cut(m.parts[0].text, MAX_REPLY_CHARS) }] } : m)),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && typeof json.reply === "string") {
        waiting.textContent = json.reply;
        waiting.classList.remove("ask-wait");
        history.push({ role: "model", parts: [{ text: json.reply }] });
      } else {
        history.pop();
        // Anything but "slow down" or "switched off" may be down to the
        // conversation itself, so the next question starts a fresh one.
        if (res.status !== 429 && res.status !== 503) history.length = 0;
        waiting.classList.remove("ask-wait");
        waiting.textContent =
          res.status === 503
            ? `The assistant isn't switched on yet. Please email us at ${EMAIL}.`
            : json.error || `Sorry, I can't answer right now. Please email us at ${EMAIL}.`;
      }
    } catch {
      history.pop();
      waiting.classList.remove("ask-wait");
      waiting.textContent = `Sorry, I can't reach our server right now. Please email us at ${EMAIL}.`;
    } finally {
      clearTimeout(slow);
      busy = false;
      send.disabled = false;
    }
  };

  const open = () => {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    input.focus();
  };
  const close = () => {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  };

  launcher.addEventListener("click", () => (panel.hidden ? open() : close()));
  closeBtn.addEventListener("click", close);
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  chips.addEventListener("click", (e) => {
    const chip = e.target.closest(".ask-chip");
    if (chip) ask(chip.textContent);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    // While an answer is on its way, the next question waits in the box.
    if (busy || !input.value.trim()) return;
    const q = input.value;
    input.value = "";
    ask(q);
  });
  // Enter sends; Shift+Enter makes a new line.
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  document.body.append(panel, launcher);
})();
