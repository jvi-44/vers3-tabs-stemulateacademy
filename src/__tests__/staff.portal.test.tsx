// @vitest-environment jsdom
// The staff page (/#/staff): a set-up link greets the person, leaves the
// address bar, and only allows a password that passes the rules; a volunteer
// sees a student's progress but can't reset their PIN or export the list; and
// signing out (or going back to the Academy) takes the list off the screen.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StaffPortal } from "../components/StaffPortal";

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
  window.scrollTo = (() => {}) as any;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

// Generous waits: this file can run right after the server tests, on a busy machine.
const SLOW = { timeout: 5000 };
const TOKEN = "a".repeat(64);
const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const account = (role: "staff" | "volunteer") => ({
  staffId: 7,
  fullName: "Ms Tan",
  email: "tan@example.org",
  role,
  allCentres: false,
  disabled: false,
  hasPassword: true,
  centres: [{ id: 1, name: "Brighton Connection" }],
  createdAt: "2026-10-28 08:00:00",
  lastLoginAt: "2026-10-28 08:00:00",
});
const student = {
  userId: 3,
  fullName: "Ava Lim",
  username: "ava_l",
  orgName: "Brighton Connection",
  orgOther: null,
  schoolLevelName: "Primary 2",
  xp: 0,
  level: 1,
  atoms: 0,
  avatar: null,
  completed: 0,
  lastActive: "2026-10-28 08:00:00",
  createdAt: "2026-10-28 08:00:00",
};

describe("StaffPortal", () => {
  it("sets a password from a one-time link and signs in", async () => {
    window.history.replaceState(null, "", `/#/staff/setup?t=${TOKEN}`);
    const calls: { url: string; body: any }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
        if (url === "/api/staff/setup/check") return json(200, { fullName: "Ms Tan", email: "tan@example.org" });
        if (url === "/api/staff/setup") return json(200, { staff: account("staff") });
        if (url === "/api/staff/students") return json(200, { students: [student] });
        return json(404, {});
      }),
    );

    render(<StaffPortal onExit={() => {}} />);
    expect(await screen.findByText("Hi, Ms Tan!", {}, SLOW)).toBeTruthy();
    // The token leaves the address bar (and the history) straight away.
    expect(window.location.hash).toBe("#/staff/setup");
    expect(calls[0]).toEqual({ url: "/api/staff/setup/check", body: { token: TOKEN } });

    const submit = screen.getByRole("button", { name: "Set password and sign in" }) as HTMLButtonElement;
    const password = screen.getByLabelText("New password");
    const again = screen.getByLabelText("Type it again");
    fireEvent.change(password, { target: { value: "short" } });
    fireEvent.change(again, { target: { value: "short" } });
    expect(submit.disabled).toBe(true);
    fireEvent.change(password, { target: { value: "tan@example.org" } });
    fireEvent.change(again, { target: { value: "tan@example.org" } });
    expect(submit.disabled).toBe(true);
    fireEvent.change(password, { target: { value: "orange kite 42" } });
    fireEvent.change(again, { target: { value: "orange kite 42" } });
    expect(submit.disabled).toBe(false);

    fireEvent.click(submit);
    expect(await screen.findByText("Ava Lim", {}, SLOW)).toBeTruthy();
    expect(calls.find((c) => c.url === "/api/staff/setup")?.body).toEqual({ token: TOKEN, password: "orange kite 42" });
    expect(screen.getByText(/Signed in as Ms Tan \(Centre staff\)/)).toBeTruthy();
    expect(window.location.hash).toBe("#/staff");
    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeTruthy();
  }, 20_000);

  it("shows a volunteer a student's progress but no PIN reset", async () => {
    window.history.replaceState(null, "", "/#/staff");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/staff/me") return json(200, { staff: account("volunteer") });
        if (url === "/api/staff/students") return json(200, { students: [student] });
        if (url === "/api/staff/students/3/progress") return json(200, { progress: [], games: [] });
        return json(404, {});
      }),
    );

    render(<StaffPortal onExit={() => {}} />);
    fireEvent.click(await screen.findByText("Ava Lim", {}, SLOW));
    // A file of children's names isn't offered to volunteers.
    expect(screen.queryByRole("button", { name: /Export CSV/ })).toBeNull();
    expect(await screen.findByText("Lesson progress", {}, SLOW)).toBeTruthy();
    expect(screen.getByText(/Ask centre staff or a STEMulate admin/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset PIN" })).toBeNull();
  }, 20_000);

  it("signs out only once the server agrees, taking the admin passkey's token too", async () => {
    window.history.replaceState(null, "", "/#/staff");
    sessionStorage.setItem("stemulate_admin_token", "a-passkey-token");
    let online = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/staff/me") return json(200, { staff: account("staff") });
        if (url === "/api/staff/students") return json(200, { students: [student] });
        if (url === "/api/staff/logout") return online ? json(200, { success: true }) : Promise.reject(new TypeError("Failed to fetch"));
        return json(404, {});
      }),
    );

    render(<StaffPortal onExit={() => {}} />);
    await screen.findByText("Ava Lim", {}, SLOW);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    // No connection: still signed in, and it says so.
    expect(await screen.findByText(/Couldn't sign out/, {}, SLOW)).toBeTruthy();
    expect(await screen.findByText("Ava Lim", {}, SLOW)).toBeTruthy();
    expect(sessionStorage.getItem("stemulate_admin_token")).toBeNull();

    online = true;
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" }, SLOW)).toBeTruthy();
    expect(screen.queryByText("Ava Lim")).toBeNull();
  }, 20_000);

  it("going back to the Academy signs out first", async () => {
    window.history.replaceState(null, "", "/#/staff");
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        calls.push(url);
        if (url === "/api/staff/me") return json(200, { staff: account("volunteer") });
        if (url === "/api/staff/students") return json(200, { students: [student] });
        if (url === "/api/staff/logout") return json(200, { success: true });
        return json(404, {});
      }),
    );
    const onExit = vi.fn();
    render(<StaffPortal onExit={onExit} />);
    await screen.findByText("Ava Lim", {}, SLOW);
    fireEvent.click(screen.getByRole("button", { name: "Back to Academy" }));
    await vi.waitFor(() => expect(onExit).toHaveBeenCalled(), SLOW);
    expect(calls).toContain("/api/staff/logout");
  }, 20_000);

  it("shows sign-in, not the list, while an earlier sign-out still can't reach the server", async () => {
    window.history.replaceState(null, "", "/#/staff");
    localStorage.setItem("stemulate_staff_signout_pending", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/staff/logout") return Promise.reject(new TypeError("Failed to fetch"));
        if (url === "/api/staff/me") return json(200, { staff: account("staff") });
        if (url === "/api/staff/students") return json(200, { students: [student] });
        return json(404, {});
      }),
    );
    render(<StaffPortal onExit={() => {}} />);
    expect(await screen.findByRole("heading", { name: "Sign in" }, SLOW)).toBeTruthy();
    expect(screen.queryByText("Ava Lim")).toBeNull();
  }, 20_000);

  it("sends a signed-out visitor to sign in", async () => {
    window.history.replaceState(null, "", "/#/staff");
    vi.stubGlobal("fetch", vi.fn(() => json(401, { error: "Please sign in again." })));
    render(<StaffPortal onExit={() => {}} />);
    expect(await screen.findByRole("heading", { name: "Sign in" }, SLOW)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
