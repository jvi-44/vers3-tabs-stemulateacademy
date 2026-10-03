// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../app/App";
import type { AuthUser } from "../types-auth";

// --- jsdom gaps used by the UI libraries ---------------------------------
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
  Element.prototype.scrollIntoView ||= () => {};
  window.scrollTo = (() => {}) as any; // jsdom only has a "not implemented" stub
});

// --- A tiny fake of the API, with a server-side "current session" ----------
const USERS: Record<string, AuthUser> = {
  alice: {
    userId: 1,
    fullName: "Alice",
    username: "alice",
    schoolLevelId: 1,
    orgId: 1,
    xp: 0,
    level: 1,
    atoms: 500,
    avatar: "girl_pink_ponytail",
  },
  bob: {
    userId: 2,
    fullName: "Bob",
    username: "bob",
    schoolLevelId: 1,
    orgId: 1,
    xp: 0,
    level: 1,
    atoms: 0,
    avatar: null,
  },
};
const OWNED: Record<string, Record<string, number>> = {
  alice: { "phen-1": 2, "phen-3": 1 },
  bob: {},
};

let session: string | null = null;

function json(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
}

const fakeFetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (url === "/api/reference-data") {
    return json(200, { organisations: [], schoolLevels: [], recoveryColours: [], recoverySubjects: [] });
  }
  if (url === "/api/login" && method === "POST") {
    session = body.username;
    return json(200, { user: USERS[body.username] });
  }
  if (url === "/api/logout") {
    session = null;
    return json(200, { success: true });
  }
  if (!session) return json(401, { error: "Please sign in again." });
  if (url === "/api/user/me") return json(200, { user: USERS[session] });
  if (url === "/api/progress") return json(200, { progress: [] });
  if (url === "/api/cards") return json(200, { owned: OWNED[session] });
  return json(404, { error: "Not found." });
});

beforeEach(() => {
  session = null;
  localStorage.clear();
  vi.stubGlobal("fetch", fakeFetch);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function signIn(username: string) {
  fireEvent.change(await screen.findByPlaceholderText("Enter your username"), {
    target: { value: username },
  });
  fireEvent.change(screen.getByPlaceholderText("••••"), { target: { value: "1234" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
  await screen.findByRole("button", { name: "Log Out" });
}

function openCards() {
  fireEvent.click(screen.getAllByRole("button", { name: /Cards/ })[0]);
}

const sidebarAvatar = () => screen.getAllByAltText("Your avatar")[0] as HTMLImageElement;

describe("logout", () => {
  it("logging out clears cards and avatar before the next login", async () => {
    render(<App />);

    // Alice: has cards and a custom avatar.
    await signIn("alice");
    await waitFor(() => expect(sidebarAvatar().src).toContain("avatar_girl_pink_ponytail"));
    openCards();
    expect(await screen.findByText("2/16 collected")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Log Out" })[0]);
    await screen.findByPlaceholderText("Enter your username");
    expect(session).toBeNull(); // POST /api/logout was called

    // Bob on the same device: no cards, default avatar, his own name.
    await signIn("bob");
    openCards();
    expect(await screen.findAllByText("0/16 collected")).toHaveLength(1);
    expect(screen.queryByText("2/16 collected")).toBeNull();
    expect(sidebarAvatar().src).toContain("avatar_boy_teal");
    expect(sidebarAvatar().src).not.toContain("pink_ponytail");
    expect(screen.queryByText(/Alice/)).toBeNull();
  });

  it("rehydrates from the session cookie, not localStorage", async () => {
    localStorage.setItem("stemulate_user_id", "1"); // the old, forgeable key
    render(<App />);
    expect(await screen.findByPlaceholderText("Enter your username")).toBeTruthy();
    expect(fakeFetch).toHaveBeenCalledWith("/api/user/me", expect.anything());
    expect(localStorage.getItem("stemulate_user_id")).toBeNull();

    session = "bob";
    cleanup();
    render(<App />);
    expect(await screen.findByRole("button", { name: "Log Out" })).toBeTruthy();
  });
});
