// Pieces shared by the admin page (AdminPage.tsx) and the staff page
// (StaffPortal.tsx): dates, labels, the students CSV, a student's progress
// card, the stat tiles, the confirm box, the new-PIN box and the shared-tablet
// safeguards.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Dices, KeyRound } from "lucide-react";
import type { AdminGameRow, AdminProgressRow, AdminUser } from "../../api/admin";
import { GAME_LESSONS } from "../../data/lessonContent";
import { cn } from "../ui/utils";
import stembotGreen from "../../assets/stembot_green.png";

export const BEATS: Record<string, { lesson: string; title: string }> = Object.fromEntries(
  GAME_LESSONS.flatMap((l) => l.beats.map((b) => [b.id, { lesson: l.title, title: b.title }])),
);
export const TOTAL_BEATS = GAME_LESSONS.reduce((n, l) => n + l.beats.length, 0);

export function parseSql(sql: string | null) {
  if (!sql) return null;
  const d = new Date(sql.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function shortDate(sql: string | null) {
  const d = parseSql(sql);
  if (!d) return sql ? sql : "Never";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export function prettyId(id: string) {
  return BEATS[id]?.title ?? id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const pctDone = (u: AdminUser) => Math.round((Math.min(u.completed, TOTAL_BEATS) / Math.max(TOTAL_BEATS, 1)) * 100);

/** A listed centre, or "Other: <name>" for one typed under "Others (please specify)". */
export const centreLabel = (u: Pick<AdminUser, "orgName" | "orgOther">) => (u.orgOther ? `Other: ${u.orgOther}` : u.orgName);

// ---------------------------------------------------------------------------
// CSV export (client side, of the students currently shown)
// ---------------------------------------------------------------------------
export function csvCell(value: unknown) {
  let s = value === null || value === undefined ? "" : String(value);
  // Stop spreadsheet apps from running a cell as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Says a file of names was saved, with a reminder for shared devices (centre tablets). */
export function savedFileToast(what: string) {
  toast.success(`Saved ${what} to a CSV file. Delete it from shared devices when you're done.`, { duration: 8000 });
}

// ---------------------------------------------------------------------------
// Shared tablets: an unused page clears itself
// ---------------------------------------------------------------------------
/** Calls `onIdle` once nobody has touched the page for `ms` (an hour, like the
 *  server's idle limit), so children's names don't stay on a shared tablet. */
export function useIdle(active: boolean, onIdle: () => void, ms = 60 * 60_000) {
  const latest = useRef(onIdle);
  latest.current = onIdle;
  useEffect(() => {
    if (!active) return;
    let timer = window.setTimeout(() => latest.current(), ms);
    const nudge = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => latest.current(), ms);
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, nudge, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, nudge));
    };
  }, [active, ms]);
}

/** Runs `check` whenever the page comes back into view (a tablet woken up). */
export function useOnVisible(active: boolean, check: () => void) {
  const latest = useRef(check);
  latest.current = check;
  useEffect(() => {
    if (!active) return;
    const onChange = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [active]);
}

export function exportCsv(users: AdminUser[]) {
  const header = [
    "User ID",
    "Full name",
    "Username",
    "Organisation",
    "School level",
    "Level",
    "XP",
    "Atoms",
    "Activities completed",
    "Last active (UTC)",
    "Joined (UTC)",
  ];
  const rows = users.map((u) => [
    u.userId,
    u.fullName,
    u.username,
    centreLabel(u),
    u.schoolLevelName,
    u.level,
    u.xp,
    u.atoms,
    u.completed,
    u.lastActive ?? "",
    u.createdAt,
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stemulate-students-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProgressCard({
  user,
  progress,
  games,
}: {
  user: AdminUser;
  progress: AdminProgressRow[] | null;
  games: AdminGameRow[];
}) {
  const done = progress ? progress.filter((p) => p.status === "completed").length : user.completed;
  const pct = Math.round((Math.min(done, TOTAL_BEATS) / Math.max(TOTAL_BEATS, 1)) * 100);
  return (
    <section className="admin-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-display !text-lg">Lesson progress</h3>
        <span className="chip-ink text-xs">{pct}%</span>
      </div>
      <div className="meter mb-1.5">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs font-bold text-muted-foreground mb-4">
        {done} of {TOTAL_BEATS} activities complete
      </p>

      {progress === null ? (
        <p className="text-sm font-semibold text-muted-foreground">Loading…</p>
      ) : progress.length === 0 && games.length === 0 ? (
        <div className="rounded-2xl bg-soft-1 border-2 border-dashed border-ink/25 p-4 text-center">
          <p className="font-display font-semibold">Nothing yet</p>
          <p className="text-xs font-semibold text-muted-foreground">No lesson activity for this student.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {progress.length > 0 && (
            <ul className="space-y-2.5">
              {progress.map((p) => (
                <li key={p.lesson_id} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={cn(
                      "w-3 h-3 rounded-full border-2 border-ink shrink-0",
                      p.status === "completed" ? "bg-pop-2" : "bg-primary",
                    )}
                    title={p.status === "completed" ? "Completed" : "In progress"}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-semibold leading-tight">{prettyId(p.lesson_id)}</span>
                    {BEATS[p.lesson_id] && (
                      <span className="block truncate text-[11px] font-semibold text-muted-foreground">{BEATS[p.lesson_id].lesson}</span>
                    )}
                  </span>
                  {p.score !== null && <span className="font-display font-bold tabular-nums">{p.score}%</span>}
                  <span className="text-xs font-semibold text-muted-foreground shrink-0">
                    {shortDate(p.completed_at ?? p.last_accessed)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {games.length > 0 && (
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground mb-2">Game high scores</p>
              <ul className="space-y-1.5">
                {games.map((g) => (
                  <li key={g.game_id} className="flex items-center gap-2.5 text-sm">
                    <span className="flex-1 min-w-0 truncate font-semibold">{prettyId(g.game_id)}</span>
                    <span className="font-display font-bold tabular-nums">{g.best_score}</span>
                    <span className="text-xs font-semibold text-muted-foreground w-16 text-right">
                      {g.plays} play{g.plays === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Confirm boxes
// ---------------------------------------------------------------------------
export function Modal({
  open,
  onClose,
  bot,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  bot: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_50%,transparent)]" onClick={onClose} />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 30, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 30, scale: 0.96 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            className="relative w-full max-w-[420px] admin-card px-6 pb-6 pt-14"
          >
            <img src={bot} alt="" className="absolute -top-14 left-1/2 -translate-x-1/2 h-24 die-cut" />
            <h3 className="font-display !text-xl text-center mb-2">{title}</h3>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return [busy, run] as const;
}

const randomPin = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");

export function ConfirmPin({
  open,
  user,
  onClose,
  onConfirm,
}: {
  open: boolean;
  user: { username: string };
  onClose: () => void;
  onConfirm: (pin: string) => Promise<void>;
}) {
  const [pin, setPin] = useState("");
  const [busy, run] = useBusy();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setTimeout(() => ref.current?.focus(), 50);
    }
  }, [open]);

  const ok = /^\d{4}$/.test(pin);
  return (
    <Modal open={open} onClose={onClose} bot={stembotGreen} title="Set a new PIN">
      <p className="text-sm font-semibold text-muted-foreground text-center mb-4">
        Pick 4 digits for <b className="text-foreground">@{user.username}</b>. They'll be signed out and need the new PIN to get
        back in.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) run(() => onConfirm(pin));
        }}
      >
        <div className="flex gap-2.5 mb-5">
          <input
            ref={ref}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="••••"
            aria-label="New 4-digit PIN"
            className="ink-input pin-input flex-1 min-w-0"
          />
          <button type="button" onClick={() => setPin(randomPin())} className="btn-pop btn-pop2 !px-4 !rounded-[1.25rem]" aria-label="Random PIN" title="Random PIN">
            <Dices size={20} strokeWidth={2.4} />
          </button>
        </div>
        <div className="flex gap-2.5">
          <button type="button" onClick={onClose} className="btn-pop flex-1">
            Cancel
          </button>
          <button type="submit" disabled={!ok || busy} className="btn-pop btn-primary flex-1">
            <KeyRound size={16} strokeWidth={2.6} /> {busy ? "Saving…" : "Set PIN"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const TONES = {
  1: "bg-soft-1 text-foreground",
  2: "bg-soft-2 text-[var(--soft-2-ink)]",
  3: "bg-soft-3 text-[var(--soft-3-ink)]",
} as const;

/** A number on the admin and staff dashboards; `undefined` shows a dash while loading. */
export function StatTile({
  icon,
  label,
  value,
  tone,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: number | undefined;
  tone: keyof typeof TONES;
  className?: string;
}) {
  return (
    <div className={cn("admin-card !rounded-[1.4rem] p-3.5 sm:p-5 flex items-center sm:items-start sm:flex-col gap-3", className)}>
      <div className={cn("w-10 h-10 sm:w-11 sm:h-11 rounded-2xl border-2 border-ink flex items-center justify-center shrink-0", TONES[tone])}>{icon}</div>
      <div className="min-w-0">
        <p className="font-display font-bold text-[1.6rem] sm:text-[1.9rem] leading-none tabular-nums">
          {value === undefined ? "–" : value.toLocaleString()}
        </p>
        <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.1em] sm:tracking-[0.12em] leading-tight text-muted-foreground sm:truncate">{label}</p>
      </div>
    </div>
  );
}
