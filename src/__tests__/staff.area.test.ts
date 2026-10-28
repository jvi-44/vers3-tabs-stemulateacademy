// @vitest-environment jsdom
// Leaving the staff and admin pages signs out (src/lib/staffArea.ts), by any
// way, the browser's Back included; moving between the two pages doesn't; and
// a sign-out that couldn't reach the server is finished before either page
// shows anything.
import { afterEach, describe, expect, it, vi } from "vitest";
import { finishPendingSignOut, signOutStaff, watchStaffArea } from "../lib/staffArea";

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const go = (hash: string) => {
  window.history.replaceState(null, "", hash || "/");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("leaving the staff and admin pages", () => {
  it("signs out on the way back to the Academy, not between the two pages", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        calls.push(url);
        return json(200, { success: true });
      }),
    );
    window.history.replaceState(null, "", "#/staff");
    sessionStorage.setItem("stemulate_admin_token", "a-passkey-token");
    const stop = watchStaffArea();
    go("#/admin");
    go("#/staff/setup");
    expect(calls).toEqual([]);
    go("");
    await vi.waitFor(() => expect(calls).toEqual(["/api/staff/logout"]));
    expect(sessionStorage.getItem("stemulate_admin_token")).toBeNull();
    // Already in the Academy: nothing more to do.
    go("#/lessons");
    stop();
    expect(calls).toHaveLength(1);
  });

  it("finishes a sign-out that couldn't reach the server, before anything shows", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    expect(await signOutStaff()).toBe(false);
    expect(await finishPendingSignOut()).toBe(false);
    vi.stubGlobal("fetch", vi.fn(() => json(200, { success: true })));
    expect(await finishPendingSignOut()).toBe(true);
    // Nothing left waiting: no more calls.
    const quiet = vi.fn(() => json(200, {}));
    vi.stubGlobal("fetch", quiet);
    expect(await finishPendingSignOut()).toBe(true);
    expect(quiet).not.toHaveBeenCalled();
  });
});
