// @vitest-environment jsdom
// The admin page on a shared centre tablet: an admin account can sign out
// from it and leaving signs it out; the passkey is locked on the way out; and
// the gate says when an admin account's hour on the page is up.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminPage } from "../components/AdminPage";

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
});

const SLOW = { timeout: 5000 };
const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const stats = { users: 0, activeThisWeek: 0, activitiesCompleted: 0, messages: 0, groups: 0 };
const admin = {
  staffId: 9,
  fullName: "Ms Tan",
  email: "tan@example.org",
  role: "admin",
  allCentres: false,
  disabled: false,
  hasPassword: true,
  centres: [],
  createdAt: "2026-10-28 08:00:00",
  lastLoginAt: "2026-10-28 08:00:00",
};

/** Answers the admin dashboard's first calls, plus `extra` (url -> response). */
function serve(extra: Record<string, () => Promise<Response>>) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      calls.push(url);
      if (extra[url]) return extra[url]();
      if (url === "/api/admin/stats") return json(200, stats);
      if (url === "/api/admin/users") return json(200, { users: [] });
      return json(404, {});
    }),
  );
  return calls;
}

describe("AdminPage", () => {
  it("an admin account can sign out here, and leaving signs it out", async () => {
    const calls = serve({
      "/api/admin/session": () => json(200, { via: "staff", fullName: "Ms Tan" }),
      "/api/staff/logout": () => json(200, { success: true }),
    });
    const onExit = vi.fn();
    render(<AdminPage onExit={onExit} />);
    expect(await screen.findByText(/Signed in as Ms Tan \(Admin\)/, {}, SLOW)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to Academy" }));
    await waitFor(() => expect(onExit).toHaveBeenCalled(), SLOW);
    expect(calls).toContain("/api/staff/logout");
  }, 20_000);

  it("the passkey is locked on the way out", async () => {
    sessionStorage.setItem("stemulate_admin_token", "a-passkey-token");
    serve({ "/api/admin/session": () => json(200, { via: "passkey" }) });
    const onExit = vi.fn();
    render(<AdminPage onExit={onExit} />);
    expect(await screen.findByText(/Opened with the admin passkey/, {}, SLOW)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to Academy" }));
    await waitFor(() => expect(onExit).toHaveBeenCalled(), SLOW);
    expect(sessionStorage.getItem("stemulate_admin_token")).toBeNull();
  }, 20_000);

  it("a passkey token from before the server restarted gives way to the admin account", async () => {
    sessionStorage.setItem("stemulate_admin_token", "an-old-token");
    serve({ "/api/admin/session": () => json(200, { via: "staff", fullName: "Ms Tan" }) });
    render(<AdminPage onExit={() => {}} />);
    expect(await screen.findByText(/Signed in as Ms Tan \(Admin\)/, {}, SLOW)).toBeTruthy();
    expect(sessionStorage.getItem("stemulate_admin_token")).toBeNull();
  }, 20_000);

  it("the gate says when an admin account's hour on this page is up", async () => {
    serve({
      "/api/admin/session": () => json(401, { error: "Admin session expired." }),
      "/api/staff/me": () => json(200, { staff: admin }),
    });
    render(<AdminPage onExit={() => {}} />);
    expect(await screen.findByText(/opens this page for an hour after you sign in/, {}, SLOW)).toBeTruthy();
  }, 20_000);
});
