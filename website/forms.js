// Inline sign-up forms (get-involved.html). Each form also works without
// JavaScript: it posts to the Academy, which sends the browser back to the
// form's "sent" or "error" box. With JavaScript the fields are checked here
// first, errors show next to their field, and the form is sent in the
// background. The Academy keeps sign-ups for the team (privacy.html#forms).
(() => {
  const base = (window.STEMULATE?.academyUrl || "https://academy.projstemulate.com/").replace(/\/+$/, "");
  const endpoint = `${base}/api/site/signup`;
  // The same rule as the Academy's (server/routes/staff.js EMAIL_REGEX).
  const EMAIL = /^[A-Za-z0-9._+'-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
  const FALLBACK = "Something went wrong. Please try again, or email proj.stemulate@gmail.com.";

  document.querySelectorAll("form[data-signup]").forEach((form) => {
    // The form's kind rides in its address too, so even a post the Academy
    // can't read comes back to the right form.
    const kind = form.querySelector('input[name="kind"]')?.value;
    form.action = kind ? `${endpoint}?kind=${encodeURIComponent(kind)}` : endpoint;
    const status = form.querySelector(".form-status");
    const button = form.querySelector('button[type="submit"]');
    const sent = form.querySelector(".form-sent");

    /** Shows (or clears) a field's error; false if the field has no place for one. */
    const showError = (input, message) => {
      const box = document.getElementById(`${input.id}-error`);
      input.setAttribute("aria-invalid", message ? "true" : "false");
      if (box) {
        box.textContent = message || "";
        box.hidden = !message;
      }
      return Boolean(box);
    };

    /** The first field that needs fixing, after marking every one. */
    const firstProblem = () => {
      let first = null;
      form.querySelectorAll("input[required], input[type='email']").forEach((input) => {
        const value = input.value.trim();
        const message =
          input.required && !value
            ? input.dataset.required || "Please fill this in."
            : input.type === "email" && value && !EMAIL.test(value)
              ? "Please enter a valid email address."
              : "";
        showError(input, message);
        if (message && !first) first = input;
      });
      return first;
    };

    form.addEventListener("input", (e) => {
      if (e.target.getAttribute?.("aria-invalid") === "true") showError(e.target, "");
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const problem = firstProblem();
      if (problem) {
        problem.focus();
        return;
      }
      const data = new FormData(form);
      const body = {};
      for (const key of new Set(data.keys())) body[key] = key === "interests" ? data.getAll(key) : data.get(key);

      button.disabled = true;
      status.textContent = "Sending…";
      // The Academy's free server sleeps when it isn't used.
      const slow = setTimeout(() => {
        status.textContent = "Sending… this can take up to a minute while our server wakes up.";
      }, 4000);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          form.classList.add("is-done");
          status.textContent = "";
          sent.classList.add("is-shown");
          sent.focus();
          return;
        }
        const field = typeof json.field === "string" ? form.querySelector(`[name="${CSS.escape(json.field)}"]`) : null;
        if (field?.id) {
          // Next to the field when it has a place for it, else under the button.
          status.textContent = showError(field, json.error) ? "" : json.error || FALLBACK;
          field.focus();
        } else {
          status.textContent = json.error || FALLBACK;
        }
      } catch {
        status.textContent = "We couldn't send that. Check your connection and try again, or email proj.stemulate@gmail.com.";
      } finally {
        clearTimeout(slow);
        button.disabled = false;
      }
    });
  });
})();
