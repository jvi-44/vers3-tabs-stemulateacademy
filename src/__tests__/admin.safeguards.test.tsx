// @vitest-environment jsdom
// The admin and staff pages' safeguards: an unused page clears itself, the
// Activity tab pages back, mailto: links can't be stretched, and the rules the
// pages check match the server's.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useIdle } from "../components/admin/shared";
import { ActivityLog, STUDENT_ACTIONS } from "../components/admin/ActivityLog";
import { mailtoHref } from "../components/admin/SignupsList";
import { EMAIL_REGEX } from "../api/staff";
// The server's and the website's own files, as text.
import adminRoutes from "../../server/routes/admin.js?raw";
import staffRoutes from "../../server/routes/staff.js?raw";
import websiteForms from "../../website/forms.js?raw";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));

function Idle({ onIdle }: { onIdle: () => void }) {
  useIdle(true, onIdle, 1000);
  return null;
}

describe("shared tablets", () => {
  it("an unused page clears itself; any touch or key starts the hour again", () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    render(<Idle onIdle={onIdle} />);
    vi.advanceTimersByTime(900);
    window.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(900);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});

describe("Activity tab", () => {
  it("pages back, and can leave out who looked", async () => {
    const row = (actionId: number, action: string) => ({
      actionId,
      staffId: 4,
      staffName: "Ms Tan",
      staffEmail: "tan@example.org",
      userId: 1,
      username: "ava_l",
      action,
      at: "2026-10-28 08:00:00",
    });
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        calls.push(url);
        if (url === "/api/admin/activity") return json(200, { activity: [row(3, "viewed progress"), row(2, "reset PIN")], hasMore: true });
        if (url === "/api/admin/activity?before=2") return json(200, { activity: [row(1, "changed the centre")], hasMore: false });
        if (url === "/api/admin/activity?changes=1") return json(200, { activity: [row(2, "reset PIN")], hasMore: false });
        return json(404, {});
      }),
    );
    render(<ActivityLog token="t" onError={(e) => { throw e; }} />);
    expect(await screen.findByText(/viewed progress/)).toBeTruthy();
    expect(screen.getAllByText(/tan@example\.org/).length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Show older" }));
    expect(await screen.findByText(/changed the centre/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show older" })).toBeNull();
    fireEvent.click(screen.getByLabelText(/Only changes/));
    await waitFor(() => expect(screen.queryByText(/viewed progress/)).toBeNull());
    expect(screen.getByText(/reset PIN/)).toBeTruthy();
    expect(calls).toEqual(["/api/admin/activity", "/api/admin/activity?before=2", "/api/admin/activity?changes=1"]);
  });

  it("knows every action the server records against one student", () => {
    const server = adminRoutes + staffRoutes;
    // Looks are recorded on their own; a change to a student carries its action.
    const looks = [...server.matchAll(/logAction\([^,]+,\s*([^,]+),\s*"([^"]+)"\)/g)]
      .filter((m) => m[1].trim() !== "null")
      .map((m) => m[2]);
    const changes = [...server.matchAll(/p_action:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(looks.length && changes.length).toBeTruthy();
    expect(new Set([...looks, ...changes])).toEqual(STUDENT_ACTIONS);
  });
});

describe("email addresses", () => {
  it("mailto: links keep the address to one recipient", () => {
    expect(mailtoHref("a+tag@gmail.com")).toBe("mailto:a%2Btag@gmail.com");
    expect(mailtoHref("mary.o'brien@school.ie")).toBe("mailto:mary.o'brien@school.ie");
    // Even an address from before the stricter rule can't add a ?bcc=.
    expect(mailtoHref("a@x.co?bcc=b@evil.example")).toBe("mailto:a%40x.co%3Fbcc%3Db@evil.example");
  });

  it("the admin page, the website's forms and the server check addresses the same way", () => {
    const server = /export const EMAIL_REGEX = (\/.+\/);/.exec(staffRoutes)?.[1];
    const website = /const EMAIL = (\/.+\/);/.exec(websiteForms)?.[1];
    expect(server).toBe(String(EMAIL_REGEX));
    expect(website).toBe(String(EMAIL_REGEX));
  });
});
