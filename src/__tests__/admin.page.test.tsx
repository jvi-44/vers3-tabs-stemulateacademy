// @vitest-environment jsdom
// The admin page on a shared centre tablet: the passkey is locked on the way
// out, an old token gives way to the passkey gate, and the Centres & passkeys
// tab shows a new passkey once.
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

/** Answers the admin dashboard's first calls, plus `extra` (url -> response). */
function serve(extra: Record<string, (init?: RequestInit) => Promise<Response>>) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      calls.push(url);
      if (extra[url]) return extra[url](init);
      if (url === "/api/admin/stats") return json(200, stats);
      if (url === "/api/admin/users") return json(200, { users: [] });
      return json(404, {});
    }),
  );
  return calls;
}

describe("AdminPage", () => {
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

  it("a passkey token from before the server restarted gives way to the gate", async () => {
    sessionStorage.setItem("stemulate_admin_token", "an-old-token");
    serve({ "/api/admin/session": () => json(401, { error: "Admin session expired. Enter the passkey again." }) });
    render(<AdminPage onExit={() => {}} />);
    expect(await screen.findByRole("button", { name: "Unlock Admin HQ" }, SLOW)).toBeTruthy();
    expect(sessionStorage.getItem("stemulate_admin_token")).toBeNull();
  }, 20_000);

  it("sets a centre's passkey and shows it once", async () => {
    sessionStorage.setItem("stemulate_admin_token", "a-passkey-token");
    const sent: unknown[] = [];
    serve({
      "/api/admin/session": () => json(200, { via: "passkey" }),
      "/api/admin/centres": () =>
        json(200, { centres: [{ id: 1, name: "Brighton Connection", hasPasskey: false, passkeySetAt: null, students: 3 }] }),
      "/api/admin/centres/1/passkey": (init) => {
        sent.push(JSON.parse(String(init?.body)));
        return json(200, { passkey: "kq7m-x3vd-9pna" });
      },
    });
    render(<AdminPage onExit={() => {}} />);
    fireEvent.click(await screen.findByRole("tab", { name: "Centres & passkeys" }, SLOW));
    expect(await screen.findByText(/3 students · staff can't sign in yet/, {}, SLOW)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Set passkey/ }));
    const box = await screen.findByLabelText(/Type one, or leave it empty/, {}, SLOW);
    fireEvent.change(box, { target: { value: "short" } });
    expect((screen.getByRole("button", { name: /Use this/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Make one/ }));
    expect(((await screen.findByLabelText("Passkey", {}, SLOW)) as HTMLInputElement).value).toBe("kq7m-x3vd-9pna");
    expect(sent).toEqual([{}]);
  }, 20_000);
});
