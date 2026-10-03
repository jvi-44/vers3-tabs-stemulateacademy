// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LoginScreen } from "../components/LoginScreen";

beforeAll(() => {
  window.matchMedia ||= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as any;
  (globalThis as any).ResizeObserver ||= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.scrollTo = (() => {}) as any;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const REF_DATA = {
  organisations: [{ id: 1, name: "CDAC" }],
  schoolLevels: [{ id: 1, name: "Primary 1" }],
  recoveryColours: [{ id: 1, name: "Red" }],
  recoverySubjects: [{ id: 1, name: "Science" }],
};

describe("LoginScreen", () => {
  it("shows a Retry button instead of loading forever when reference data fails", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        calls += 1;
        return Promise.resolve(
          calls === 1
            ? new Response("{}", { status: 500 })
            : new Response(JSON.stringify(REF_DATA), { status: 200 }),
        );
      }),
    );

    render(<LoginScreen onLogin={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Create One" }));

    expect(await screen.findByText("Couldn't load the form.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    // Labels are tied to their inputs, and the form asks for a first name + consent.
    expect(await screen.findByLabelText("First Name")).toBeTruthy();
    expect(screen.getByLabelText("Username")).toBeTruthy();
    expect(screen.getByLabelText("4-Digit PIN")).toBeTruthy();
    expect(screen.getByText(/We save your first name, school level and centre/)).toBeTruthy();
    const consent = screen.getByRole("checkbox", { name: "My parent or teacher said I can join" });
    expect(consent.getAttribute("aria-checked")).toBe("false");
    expect((screen.getByRole("button", { name: "Create Account" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
