// @vitest-environment jsdom
// The website's sign-up forms (website/forms.js): the form's address names it,
// and a server error about a field shows next to it, or under the button when
// the field has no place for one.
import { afterEach, expect, it, vi } from "vitest";
import forms from "../../website/forms.js?raw";

afterEach(() => vi.unstubAllGlobals());

it("shows the server's error for a field, wherever there's room", async () => {
  document.body.innerHTML = `
    <form data-signup novalidate>
      <input type="hidden" name="kind" value="partner" />
      <input id="p-email" name="email" type="email" value="ana@example.org" /><p id="p-email-error" hidden></p>
      <input id="p-phone" name="phone" value="6123 4567 ext 12" />
      <button type="submit">Send</button>
      <p class="form-status"></p><p class="form-sent"></p>
    </form>`;
  (globalThis as any).CSS ??= { escape: (s: string) => s };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: "Please enter a phone number, or leave it empty.", field: "phone" }), { status: 400 })),
  );
  new Function(forms)();
  const form = document.querySelector("form") as HTMLFormElement;
  expect(form.action).toBe("https://academy.projstemulate.com/api/site/signup?kind=partner");
  form.dispatchEvent(new Event("submit", { cancelable: true }));
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
  expect(document.querySelector(".form-status")?.textContent).toBe("Please enter a phone number, or leave it empty.");
  expect(document.getElementById("p-phone")?.getAttribute("aria-invalid")).toBe("true");
});
