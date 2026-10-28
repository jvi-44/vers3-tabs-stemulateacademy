// Admin page → Staff & volunteers: the people who may sign in on the staff page. An admin
// adds each one with the centres they follow and hands them a one-time set-up
// link; volunteers see progress only, centre staff can also reset PINs, and
// admins also get this admin page.
import { useEffect, useState } from "react";
import { Copy, Link2, Plus, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import {
  adminCreateStaff,
  adminDeleteStaff,
  adminNewSetupLink,
  adminStaffList,
  adminUpdateStaff,
  type SetupLink,
  type StaffAccount,
  type StaffFields,
  type StaffRole,
} from "../../api/admin";
import { fetchReferenceData } from "../../api/auth";
import { EMAIL_REGEX } from "../../api/staff";
import type { ReferenceOption } from "../../types-auth";
import { cn } from "../ui/utils";
import { Modal, shortDate, useBusy } from "./shared";
import stembotGreen from "../../assets/stembot_green.png";
import stembotRed from "../../assets/stembot_red.png";

const ROLES: { id: StaffRole; label: string; hint: string }[] = [
  { id: "volunteer", label: "Volunteer", hint: "Sees progress at the centres picked" },
  { id: "staff", label: "Centre staff", hint: "Also resets forgotten PINs" },
  { id: "admin", label: "Admin", hint: "Everything, including this admin page" },
];
const roleLabel = (r: StaffRole) => ROLES.find((x) => x.id === r)?.label ?? r;

const EMPTY: StaffFields = { fullName: "", email: "", role: "volunteer", allCentres: false, centreIds: [] };

export function StaffAccounts({ token, onError }: { token: string; onError: (e: unknown) => void }) {
  const [staff, setStaff] = useState<StaffAccount[] | null>(null);
  const [centres, setCentres] = useState<ReferenceOption[]>([]);
  const [editing, setEditing] = useState<StaffAccount | "new" | null>(null);
  const [link, setLink] = useState<{ who: StaffAccount; link: SetupLink } | null>(null);
  const [deleting, setDeleting] = useState<StaffAccount | null>(null);

  const load = () =>
    adminStaffList(token)
      .then((r) => setStaff(r.staff))
      .catch(onError);
  useEffect(() => {
    load();
    fetchReferenceData()
      .then((r) => setCentres(r.organisations))
      .catch(onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const replace = (s: StaffAccount) => setStaff((list) => list?.map((x) => (x.staffId === s.staffId ? s : x)) ?? list);

  return (
    <section className="admin-card overflow-hidden" aria-label="Staff and volunteer accounts">
      <div className="p-4 sm:p-5 border-b-[2.5px] border-ink bg-soft-1/60 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display">Staff &amp; volunteers</h2>
          <p className="text-sm font-semibold text-muted-foreground">
            They sign in at <code className="font-bold">/#/staff</code> to follow their centres' students.
          </p>
        </div>
        <button onClick={() => setEditing("new")} className="btn-pop btn-primary">
          <Plus size={17} strokeWidth={2.6} /> Add someone
        </button>
      </div>

      {staff === null ? (
        <p className="p-10 text-center font-bold text-muted-foreground">Loading accounts…</p>
      ) : staff.length === 0 ? (
        <div className="p-10 text-center">
          <p className="font-display text-lg font-semibold">No accounts yet</p>
          <p className="text-sm font-semibold text-muted-foreground">Add centre staff and volunteers so they can follow their students.</p>
        </div>
      ) : (
        <ul className="divide-y-2 divide-ink/10">
          {staff.map((s) => (
            <li key={s.staffId} className={cn("px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3", s.disabled && "opacity-60")}>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold truncate">
                  {s.fullName} <span className="chip-ink text-[11px] ml-1 align-middle">{roleLabel(s.role)}</span>
                  {s.disabled && <span className="chip-ink text-[11px] ml-1 align-middle">Switched off</span>}
                </p>
                <p className="text-xs font-semibold text-muted-foreground truncate">
                  {s.email} · {s.role === "admin" || s.allCentres ? "All centres" : s.centres.map((c) => c.name).join(", ") || "No centres"} ·{" "}
                  {s.hasPassword ? `last signed in ${shortDate(s.lastLoginAt)}` : "hasn't set a password yet"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    adminNewSetupLink(token, s.staffId)
                      .then((r) => setLink({ who: s, link: r.setupLink }))
                      .catch(onError)
                  }
                  className="btn-pop btn-pop-sm"
                  title="A new one-time link (the old one stops working)"
                >
                  <Link2 size={15} strokeWidth={2.6} /> Set-up link
                </button>
                <button onClick={() => setEditing(s)} className="btn-pop btn-pop-sm">
                  <UserCog size={15} strokeWidth={2.6} /> Edit
                </button>
                <button
                  onClick={() =>
                    adminUpdateStaff(token, s.staffId, { disabled: !s.disabled })
                      .then((r) => {
                        replace(r.staff);
                        toast.success(
                          r.staff.disabled
                            ? `${s.fullName} can't sign in now.`
                            : r.staff.hasPassword
                              ? `${s.fullName} can sign in again.`
                              : `${s.fullName} is switched on. Make a set-up link so they can choose a password.`,
                        );
                      })
                      .catch(onError)
                  }
                  className="btn-pop btn-pop-sm"
                >
                  {s.disabled ? "Switch on" : "Switch off"}
                </button>
                <button onClick={() => setDeleting(s)} className="btn-pop btn-pop-sm btn-danger" aria-label={`Delete ${s.fullName}`}>
                  <Trash2 size={15} strokeWidth={2.6} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <StaffForm
        key={editing === "new" ? "new" : editing?.staffId ?? "closed"}
        open={editing !== null}
        account={editing === "new" ? null : editing}
        centres={centres}
        onClose={() => setEditing(null)}
        onSave={async (fields) => {
          try {
            if (editing === "new") {
              const r = await adminCreateStaff(token, fields);
              setStaff((list) => [...(list ?? []), r.staff].sort((a, b) => a.fullName.localeCompare(b.fullName)));
              setLink({ who: r.staff, link: r.setupLink });
            } else if (editing) {
              const r = await adminUpdateStaff(token, editing.staffId, fields);
              replace(r.staff);
              toast.success(
                r.linkVoided
                  ? `Saved ${r.staff.fullName}. The set-up link sent to the old email stopped working: make a new one if they still need it.`
                  : `Saved ${r.staff.fullName}.`,
                { duration: r.linkVoided ? 8000 : 4000 },
              );
            }
            setEditing(null);
          } catch (e) {
            onError(e);
          }
        }}
      />
      <LinkBox shown={link} onClose={() => setLink(null)} />
      <ConfirmDeleteStaff
        who={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await adminDeleteStaff(token, deleting.staffId);
            setStaff((list) => list?.filter((x) => x.staffId !== deleting.staffId) ?? list);
            toast.success(`Deleted ${deleting.fullName}'s account.`);
            setDeleting(null);
          } catch (e) {
            onError(e);
          }
        }}
      />
    </section>
  );
}

function StaffForm({
  open,
  account,
  centres,
  onClose,
  onSave,
}: {
  open: boolean;
  account: StaffAccount | null;
  centres: ReferenceOption[];
  onClose: () => void;
  onSave: (f: StaffFields) => Promise<void>;
}) {
  const [f, setF] = useState<StaffFields>(() =>
    account
      ? { fullName: account.fullName, email: account.email, role: account.role, allCentres: account.allCentres, centreIds: account.centres.map((c) => c.id) }
      : EMPTY,
  );
  const [busy, run] = useBusy();
  const set = (patch: Partial<StaffFields>) => setF((x) => ({ ...x, ...patch }));
  const everyCentre = f.role === "admin" || f.allCentres;
  const ok = f.fullName.trim() && EMAIL_REGEX.test(f.email.trim());

  return (
    <Modal open={open} onClose={onClose} bot={stembotGreen} title={account ? `Edit ${account.fullName}` : "Add staff or a volunteer"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) run(() => onSave({ ...f, fullName: f.fullName.trim(), email: f.email.trim(), allCentres: f.role === "volunteer" ? false : f.allCentres }));
        }}
        className="space-y-4 max-h-[60vh] overflow-y-auto pr-1"
      >
        <div>
          <label htmlFor="staff-name" className="block text-sm font-bold mb-1">
            Name
          </label>
          <input id="staff-name" value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} maxLength={80} className="ink-input" autoFocus />
        </div>
        <div>
          <label htmlFor="staff-mail" className="block text-sm font-bold mb-1">
            Email
          </label>
          <input id="staff-mail" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} maxLength={254} className="ink-input" />
        </div>
        <fieldset>
          <legend className="text-sm font-bold mb-1">Role</legend>
          <div className="grid gap-2">
            {ROLES.map((r) => (
              <label key={r.id} className="flex items-start gap-2.5 rounded-xl border-2 border-ink/20 p-2.5 cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-soft-1">
                <input type="radio" name="staff-role" checked={f.role === r.id} onChange={() => set({ role: r.id })} className="mt-1" />
                <span>
                  <span className="block font-semibold text-sm">{r.label}</span>
                  <span className="block text-xs font-semibold text-muted-foreground">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={f.role === "admin"}>
          <legend className="text-sm font-bold mb-1">Centres they follow</legend>
          {f.role !== "volunteer" && (
            <label className="flex items-center gap-2 text-sm font-semibold mb-2">
              <input type="checkbox" checked={everyCentre} onChange={(e) => set({ allCentres: e.target.checked })} />
              All centres (including students under "Others")
            </label>
          )}
          {!everyCentre && (
            <div className="grid sm:grid-cols-2 gap-1.5">
              {centres.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={f.centreIds.includes(c.id)}
                    onChange={(e) => set({ centreIds: e.target.checked ? [...f.centreIds, c.id] : f.centreIds.filter((id) => id !== c.id) })}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
          {f.role === "volunteer" && <p className="text-xs font-semibold text-muted-foreground mt-2">Volunteers follow only the centres they help at.</p>}
        </fieldset>
        <div className="flex gap-2.5 pt-1">
          <button type="button" onClick={onClose} className="btn-pop flex-1">
            Cancel
          </button>
          <button type="submit" disabled={!ok || busy} className="btn-pop btn-primary flex-1">
            {busy ? "Saving…" : account ? "Save" : "Add and get link"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LinkBox({ shown, onClose }: { shown: { who: StaffAccount; link: SetupLink } | null; onClose: () => void }) {
  return (
    <Modal open={!!shown} onClose={onClose} bot={stembotGreen} title="Their set-up link">
      {shown && (
        <>
          <p className="text-sm font-semibold text-muted-foreground text-center mb-3">
            Send this to <b className="text-foreground">{shown.who.fullName}</b> only. It works once, until{" "}
            {new Date(shown.link.expiresAt).toLocaleDateString([], { day: "numeric", month: "short" })}, and lets them choose their own password.
          </p>
          <input readOnly value={shown.link.url} onFocus={(e) => e.currentTarget.select()} aria-label="Set-up link" className="ink-input text-xs mb-4" />
          <div className="flex gap-2.5">
            <button onClick={onClose} className="btn-pop flex-1">
              Done
            </button>
            <button
              onClick={() =>
                navigator.clipboard
                  .writeText(shown.link.url)
                  .then(() => toast.success("Link copied."))
                  .catch(() => toast.error("Couldn't copy. Select the link and copy it."))
              }
              className="btn-pop btn-primary flex-1"
            >
              <Copy size={16} strokeWidth={2.6} /> Copy link
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function ConfirmDeleteStaff({ who, onClose, onConfirm }: { who: StaffAccount | null; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, run] = useBusy();
  return (
    <Modal open={!!who} onClose={onClose} bot={stembotRed} title={`Delete ${who?.fullName ?? ""}'s account?`}>
      <p className="text-sm font-semibold text-muted-foreground text-center mb-5">
        They're signed out and can't sign in again. The activity log keeps their name. To pause an account instead, switch it off.
      </p>
      <div className="flex gap-2.5">
        <button onClick={onClose} className="btn-pop flex-1">
          Keep it
        </button>
        <button onClick={() => run(onConfirm)} disabled={busy} className="btn-pop btn-danger flex-1">
          <Trash2 size={16} strokeWidth={2.6} /> {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}
