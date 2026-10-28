// Admin page → Sign-ups: what people sent through the website's forms
// (website/get-involved.html). Volunteer, partner and chapter sign-ups are deleted
// after 12 months; newsletter emails stay until someone asks to come off.
import { useEffect, useMemo, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminDeleteSignup, adminSignups, type SiteSignup } from "../../api/admin";
import { cn } from "../ui/utils";
import { csvCell, savedFileToast, shortDate } from "./shared";

const KINDS: { id: SiteSignup["kind"] | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "volunteer", label: "Volunteers" },
  { id: "partner", label: "Partners" },
  { id: "chapter", label: "Chapters" },
  { id: "newsletter", label: "Newsletter" },
];

/** A mailto: link with the address encoded on each side of the "@", so
 *  nothing in it can add recipients or a message (see EMAIL_REGEX too). */
export function mailtoHref(email: string) {
  const at = email.lastIndexOf("@");
  return `mailto:${encodeURIComponent(email.slice(0, at))}@${encodeURIComponent(email.slice(at + 1))}`;
}

function exportSignups(rows: SiteSignup[]) {
  const header = ["Form", "Name", "Email", "Organisation", "School", "Phone", "Interests", "Message", "Sent (UTC)"];
  const lines = rows.map((r) => [r.kind, r.name, r.email, r.organisation, r.school, r.phone, r.interests, r.message, r.createdAt]);
  const csv = [header, ...lines].map((l) => l.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `stemulate-signups-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SignupsList({ token, onError }: { token: string; onError: (e: unknown) => void }) {
  const [rows, setRows] = useState<SiteSignup[] | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("all");

  useEffect(() => {
    adminSignups(token)
      .then((r) => setRows(r.signups))
      .catch(onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const shown = useMemo(() => (rows ?? []).filter((r) => kind === "all" || r.kind === kind), [rows, kind]);

  const remove = async (r: SiteSignup) => {
    if (!window.confirm(`Delete ${r.email}'s ${r.kind} sign-up?`)) return;
    try {
      await adminDeleteSignup(token, r.signupId);
      setRows((list) => list?.filter((x) => x.signupId !== r.signupId) ?? list);
      toast.success("Deleted.");
    } catch (e) {
      onError(e);
    }
  };

  return (
    <section className="admin-card overflow-hidden" aria-label="Website sign-ups">
      <div className="p-4 sm:p-5 border-b-[2.5px] border-ink bg-soft-1/60 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display">Website sign-ups</h2>
          <p className="text-sm font-semibold text-muted-foreground">From the forms on the Get involved page.</p>
        </div>
        <button
          onClick={() => {
            exportSignups(shown);
            savedFileToast(`${shown.length} sign-up${shown.length === 1 ? "" : "s"}`);
          }}
          disabled={shown.length === 0}
          className="btn-pop"
        >
          <Download size={17} strokeWidth={2.6} /> Export CSV
        </button>
      </div>
      <div className="px-4 sm:px-5 pt-4 flex flex-wrap gap-2" role="group" aria-label="Show">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            aria-pressed={kind === k.id}
            className={cn("chip-ink text-sm", kind === k.id && "!bg-pop-2 text-[#1b1b12]")}
          >
            {k.label}
          </button>
        ))}
      </div>
      {rows === null ? (
        <p className="p-10 text-center font-bold text-muted-foreground">Loading sign-ups…</p>
      ) : shown.length === 0 ? (
        <p className="p-10 text-center font-semibold text-muted-foreground">No sign-ups here yet.</p>
      ) : (
        <ul className="divide-y-2 divide-ink/10 mt-3">
          {shown.map((r) => (
            <li key={r.signupId} className="px-4 sm:px-5 py-4 flex gap-3">
              <div className="flex-1 min-w-0 text-sm">
                <p className="font-display font-semibold">
                  {r.name || r.email} <span className="chip-ink text-[11px] ml-1 align-middle capitalize">{r.kind}</span>
                </p>
                <p className="font-semibold text-muted-foreground break-words">
                  <a href={mailtoHref(r.email)} className="underline">
                    {r.email}
                  </a>
                  {r.organisation && ` · ${r.organisation}`}
                  {r.school && ` · ${r.school}`}
                  {r.phone && ` · ${r.phone}`} · {shortDate(r.createdAt)}
                </p>
                {r.interests && <p className="font-semibold mt-1">Interested in: {r.interests}</p>}
                {r.message && <p className="mt-1 whitespace-pre-line break-words">{r.message}</p>}
              </div>
              <button onClick={() => remove(r)} className="btn-pop btn-pop-sm btn-danger self-start" aria-label={`Delete ${r.email}'s sign-up`}>
                <Trash2 size={15} strokeWidth={2.6} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
