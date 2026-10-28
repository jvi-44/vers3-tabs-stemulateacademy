// The staff and admin pages (/#/staff, /#/admin) on shared centre tablets.
// Leaving them for the Academy by any way (a button, the browser's Back, a
// link) ends staff and admin access in this browser, so the next child can't
// come back in. A sign-out that can't reach the server is finished by the next
// visit to either page before it shows anything.
import { saveAdminToken } from "../api/admin";
import { staffLogout } from "../api/staff";

const PENDING_KEY = "stemulate_staff_signout_pending";

export const isStaffArea = (hash: string) => hash === "#/admin" || hash.startsWith("#/staff");

function setPending(on: boolean) {
  try {
    if (on) localStorage.setItem(PENDING_KEY, "1");
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // Not kept: the server's idle hour still ends the session.
  }
}

function pending() {
  try {
    return localStorage.getItem(PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

/** Someone signed in again (staff page or passkey): nothing left to finish. */
export const clearPendingSignOut = () => setPending(false);

/** Signs the staff session out and forgets the passkey token. True once the server agreed. */
export async function signOutStaff() {
  saveAdminToken(null);
  try {
    await staffLogout();
    setPending(false);
    return true;
  } catch {
    setPending(true);
    return false;
  }
}

/** Before either page shows anything: true when no sign-out is waiting, or once
 *  a waiting one has now reached the server. */
export async function finishPendingSignOut() {
  return !pending() || (await signOutStaff());
}

/** Signs out whenever the address leaves the staff and admin pages; moving
 *  between them doesn't. Returns the function that stops watching. */
export function watchStaffArea() {
  let inside = isStaffArea(window.location.hash);
  const onHash = () => {
    const now = isStaffArea(window.location.hash);
    if (inside && !now) void signOutStaff();
    inside = now;
  };
  window.addEventListener("hashchange", onHash);
  return () => window.removeEventListener("hashchange", onHash);
}
