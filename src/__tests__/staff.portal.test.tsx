// @vitest-environment jsdom
// The staff page (/#/staff): centre staff pick their centre and type its
// passkey; a wrong one says so and clears the box; signed in, they see their
// centre's numbers and students and can reset a PIN; and signing out (or going
// back to the Academy) takes the list off the screen.
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
const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const centre = { id: 1, name: "Brighton Connection" };
const reference = {
  organisations: [centre, { id: 2, name: "Caritas Singapore" }],
  schoolLevels: [],
  recoveryColours: [],
  recoverySubjects: [],
};
const sqlTime = (msAgo: number) => new Date(Date.now() - msAgo).toISOString().slice(0, 19).replace("T", " ");
const student = (userId: number, fullName: string, completed: number, lastActive: string) => ({
  userId,
  fullName,
  username: fullName.toLowerCase().replace(" ", "_"),
  orgName: centre.name,
  orgOther: null,
  schoolLevelName: "Primary 2",
  xp: 0,
  level: 1,
  atoms: 0,
  avatar: null,
  completed,
  lastActive,
  createdAt: "2026-10-28 08:00:00",
});
const ava = student(3, "Ava Lim", 4, sqlTime(3_600_000));

describe("StaffPortal", () => {
  it("signs in with the centre and its passkey, and a wrong passkey says so", async () => {
    window.history.replaceState(null, "", "/#/staff");
    const logins: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url === "/api/staff/me") return json(401, { error: "Please sign in again." });
        if (url === "/api/reference-data") return json(200, reference);
        if (url === "/api/staff/login") {
          const body = JSON.parse(String(init?.body));
          logins.push(body);
          return body.passkey === "kq7m-x3vd-9pna"
            ? json(200, { centre })
            : json(401, { error: "That passkey isn't right for this centre. Ask a STEMulate admin if you don't have it." });
        }
        if (url === "/api/staff/students") return json(200, { students: [ava] });
        return json(404, {});
      }),
    );

    render(<StaffPortal onExit={() => {}} />);
    const submit = (await screen.findByRole("button", { name: "Sign in" }, SLOW)) as HTMLButtonElement;
    const select = (await screen.findByRole("option", { name: "Caritas Singapore" }, SLOW)).closest("select")!;
    expect(submit.disabled).toBe(true);
    fireEvent.change(select, { target: { value: "1" } });
    const passkey = screen.getByLabelText("Centre passkey") as HTMLInputElement;
    fireEvent.change(passkey, { target: { value: "wrong-passkey" } });
    fireEvent.click(submit);
    expect(await screen.findByText(/That passkey isn't right/, {}, SLOW)).toBeTruthy();
    expect(passkey.value).toBe("");

    fireEvent.change(passkey, { target: { value: "kq7m-x3vd-9pna" } });
    fireEvent.click(submit);
    expect(await screen.findByText("Ava Lim", {}, SLOW)).toBeTruthy();
    expect(logins.at(-1)).toEqual({ centreId: 1, passkey: "kq7m-x3vd-9pna" });
    expect(screen.getByText(/Signed in for Brighton Connection/)).toBeTruthy();
  }, 20_000);

  it("shows the centre's numbers, a student's progress and a PIN reset", async () => {
    window.history.replaceState(null, "", "/#/staff");
    const resets: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url === "/api/staff/me") return json(200, { centre });
        if (url === "/api/staff/students") {
          return json(200, { students: [ava, student(4, "Ben Ong", 0, sqlTime(30 * 864e5))] });
        }
        if (url === "/api/staff/students/3/progress") return json(200, { progress: [], games: [] });
        if (url === "/api/staff/students/3/reset-pin") {
          resets.push(JSON.parse(String(init?.body)));
          return json(200, { success: true, signedOut: 1 });
        }
        return json(404, {});
      }),
    );

    render(<StaffPortal onExit={() => {}} />);
    await screen.findByText("Ava Lim", {}, SLOW);
    const numbers = screen.getByRole("region", { name: "Centre numbers" });
    // Each tile is its number, then its label.
    const tile = (label: string) => [...numbers.querySelectorAll("p")].find((p) => p.textContent === label)?.previousElementSibling?.textContent;
    expect(tile("Students")).toBe("2");
    expect(tile("Active this week")).toBe("1");
    expect(tile("Activities done")).toBe("4");
    expect(screen.getByRole("heading", { name: "Brighton Connection" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeTruthy();

    fireEvent.click(screen.getByText("Ava Lim"));
    expect(await screen.findByText("Lesson progress", {}, SLOW)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset PIN" }));
    expect(await screen.findByRole("alertdialog", {}, SLOW)).toBeTruthy();
  }, 20_000);

  it("signs out only once the server agrees, taking the admin passkey's token too", async () => {
    window.history.replaceState(null, "", "/#/staff");
    sessionStorage.setItem("stemulate_admin_token", "a-passkey-token");
    let online = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/staff/me") return json(200, { centre });
        if (url === "/api/staff/students") return json(200, { students: [ava] });
        if (url === "/api/reference-data") return json(200, reference);
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
        if (url === "/api/staff/me") return json(200, { centre });
        if (url === "/api/staff/students") return json(200, { students: [ava] });
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
        if (url === "/api/staff/me") return json(200, { centre });
        if (url === "/api/staff/students") return json(200, { students: [ava] });
        if (url === "/api/reference-data") return json(200, reference);
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
