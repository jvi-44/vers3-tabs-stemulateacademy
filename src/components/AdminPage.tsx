import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Atom,
  CheckCircle2,
  Dices,
  Download,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Lock,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { ApiError } from "../api/client";
import {
  adminLogin,
  adminStats,
  adminUsers,
  adminUserProgress,
  adminUpdateUser,
  adminResetProgress,
  adminResetPin,
  adminDeleteUser,
  type AdminStats,
  type AdminUser,
  type AdminProgressRow,
  type AdminGameRow,
} from "../api/admin";
import { GAME_LESSONS } from "../data/lessonContent";
import { avatarFor } from "./FriendsTab";
import { cn } from "./ui/utils";
import stemulateLogo from "../assets/stemulate_logo.png";
import stembotGreen from "../assets/stembot_green.png";
import stembotBlue from "../assets/stembot_blue.png";
import stembotCream from "../assets/stembot_cream.png";
import stembotRed from "../assets/stembot_red.png";
import "../styles/admin.css";

// The admin token lasts for this browser tab only.
const ADMIN_TOKEN_KEY = "stemulate_admin_token";

// Same rule the Academy uses when a student earns XP (App.tsx handleEarnXP).
const XP_PER_LEVEL = 1000;
const levelForXp = (xp: number) => Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;

const BEATS: Record<string, { lesson: string; title: string }> = Object.fromEntries(
  GAME_LESSONS.flatMap((l) => l.beats.map((b) => [b.id, { lesson: l.title, title: b.title }])),
);
const TOTAL_BEATS = GAME_LESSONS.reduce((n, l) => n + l.beats.length, 0);

function readToken() {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // Not saved: the admin signs in again after a refresh.
  }
}

function parseSql(sql: string | null) {
  if (!sql) return null;
  const d = new Date(sql.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

function shortDate(sql: string | null) {
  const d = parseSql(sql);
  if (!d) return sql ? sql : "Never";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function prettyId(id: string) {
  return BEATS[id]?.title ?? id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const pctDone = (u: AdminUser) => Math.round((Math.min(u.completed, TOTAL_BEATS) / Math.max(TOTAL_BEATS, 1)) * 100);

// ---------------------------------------------------------------------------
// CSV export (client side, of the students currently shown)
// ---------------------------------------------------------------------------
function csvCell(value: unknown) {
  let s = value === null || value === undefined ? "" : String(value);
  // Stop spreadsheet apps from running a cell as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(users: AdminUser[]) {
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
    "Last sign-in (UTC)",
    "Joined (UTC)",
  ];
  const rows = users.map((u) => [
    u.userId,
    u.fullName,
    u.username,
    u.orgName,
    u.schoolLevelName,
    u.level,
    u.xp,
    u.atoms,
    u.completed,
    u.lastLogin ?? "",
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

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------
export function AdminPage({ onExit }: { onExit: () => void }) {
  const [token, setToken] = useState<string | null>(readToken);

  const signOut = () => {
    saveToken(null);
    setToken(null);
  };

  return (
    <div className="min-h-screen bg-playful text-foreground">
      <Toaster position="top-center" richColors closeButton />
      <header className="sticky top-0 z-30 bg-card border-b-[2.5px] border-ink">
        <div className="max-w-6xl mx-auto h-[68px] px-4 md:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={stemulateLogo} alt="" className="w-10 h-10 object-contain shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="font-display font-bold text-lg truncate">STEMulate Academy</p>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Admin HQ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {token && (
              <button onClick={signOut} className="btn-pop btn-pop-sm" aria-label="Lock admin">
                <Lock size={15} strokeWidth={2.6} />
                <span className="hidden sm:inline">Lock</span>
              </button>
            )}
            <button onClick={onExit} className="btn-pop btn-pop-sm btn-primary" aria-label="Back to Academy">
              <ArrowLeft size={15} strokeWidth={2.6} />
              <span className="hidden sm:inline">Back to Academy</span>
            </button>
          </div>
        </div>
      </header>
      <main className="px-4 py-6 md:px-8 md:py-8">
        <div className="max-w-6xl mx-auto">
          {token ? (
            <AdminDashboard token={token} onExpired={signOut} />
          ) : (
            <PasskeyGate
              onSuccess={(t) => {
                saveToken(t);
                setToken(t);
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Passkey gate
// ---------------------------------------------------------------------------
function PasskeyGate({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [passkey, setPasskey] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!passkey || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { token } = await adminLogin(passkey);
      toast.success("Welcome back to Admin HQ!");
      onSuccess(token);
    } catch (err) {
      setError((err as Error).message);
      setShake((n) => n + 1);
      setPasskey("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-2 sm:pt-8">
      <div className="flex flex-col items-center">
        <div className="admin-bubble px-5 py-3 mb-4 text-center max-w-[19rem]">
          <p className="font-display font-semibold leading-snug">
            {error ? "Hmm, that's not it. Try again?" : "Psst! What's the secret passkey?"}
          </p>
        </div>
        <img src={stembotCream} alt="Emily the STEMbot" className="h-32 sm:h-36 w-auto die-cut bob -mb-7 relative z-10" />
      </div>

      <form
        key={shake}
        onSubmit={submit}
        className={cn("admin-card relative px-6 pt-10 pb-7 sm:px-8", shake > 0 && "admin-shake")}
      >
        <div className="text-center mb-6">
          <span className="kicker kicker-3">
            <ShieldCheck size={13} strokeWidth={3} /> Grown-ups only
          </span>
          <h1 className="font-display mt-3 mb-1.5">
            Admin <span className="mark-pop">sign in</span>
          </h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Enter the admin passkey to look after students and their progress.
          </p>
        </div>

        <label htmlFor="admin-passkey" className="sr-only">
          Passkey
        </label>
        <div className="relative mb-2">
          <KeyRound size={18} strokeWidth={2.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            id="admin-passkey"
            type={show ? "text" : "password"}
            autoFocus
            value={passkey}
            onChange={(e) => {
              setPasskey(e.target.value);
              setError(null);
            }}
            placeholder="Passkey"
            autoComplete="current-password"
            aria-invalid={!!error}
            aria-describedby={error ? "admin-passkey-error" : undefined}
            className="ink-input pl-11 pr-12"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label={show ? "Hide passkey" : "Show passkey"}
          >
            {show ? <EyeOff size={17} strokeWidth={2.5} /> : <Eye size={17} strokeWidth={2.5} />}
          </button>
        </div>
        <p id="admin-passkey-error" role="alert" className="min-h-5 px-2 mb-3 text-sm font-bold text-destructive">
          {error}
        </p>
        <button type="submit" disabled={!passkey || busy} className="btn-pop btn-primary w-full text-base">
          {busy ? "Checking…" : "Unlock Admin HQ"}
        </button>
        <p className="mt-5 text-center text-xs font-semibold text-muted-foreground">
          The passkey lives in the server's <code className="font-bold">.env</code> file as{" "}
          <code className="font-bold">ADMIN_PASSKEY</code>.
        </p>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
type SortKey = "name" | "level" | "xp" | "atoms" | "progress" | "lastLogin" | "joined";

const SORTS: { key: SortKey; label: string; get: (u: AdminUser) => string | number }[] = [
  { key: "joined", label: "Newest joined", get: (u) => u.createdAt },
  { key: "name", label: "Name", get: (u) => u.fullName.toLowerCase() },
  { key: "level", label: "Level", get: (u) => u.level },
  { key: "xp", label: "XP", get: (u) => u.xp },
  { key: "atoms", label: "Atoms", get: (u) => u.atoms },
  { key: "progress", label: "Progress", get: (u) => u.completed },
  { key: "lastLogin", label: "Last sign-in", get: (u) => u.lastLogin ?? "" },
];

function AdminDashboard({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [query, setQuery] = useState("");
  const [org, setOrg] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "joined", dir: "desc" });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handle = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) onExpired();
    toast.error((e as Error).message);
  };

  const load = async () => {
    setRefreshing(true);
    try {
      const [s, u] = await Promise.all([adminStats(token), adminUsers(token)]);
      setStats(s);
      setUsers(u.users);
    } catch (e) {
      handle(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const all = users ?? [];
  const orgs = useMemo(() => [...new Set(all.map((u) => u.orgName))].sort(), [all]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const def = SORTS.find((s) => s.key === sort.key)!;
    return all
      .filter((u) => {
        const matchesText =
          !q ||
          u.fullName.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.orgName.toLowerCase().includes(q);
        return matchesText && (org === "all" || u.orgName === org);
      })
      .sort((a, b) => {
        const x = def.get(a);
        const y = def.get(b);
        const c = x < y ? -1 : x > y ? 1 : 0;
        return sort.dir === "asc" ? c : -c;
      });
  }, [all, query, org, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" },
    );

  const selected = all.find((u) => u.userId === selectedId) ?? null;

  const patchUser = (userId: number, patch: Partial<AdminUser>) =>
    setUsers((list) => list?.map((u) => (u.userId === userId ? { ...u, ...patch } : u)) ?? list);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Hero */}
      <section className="panel-pop overflow-hidden px-6 py-7 sm:px-9 sm:py-8">
        <div className="relative z-10 max-w-[34rem]">
          <span className="kicker kicker-on">
            <Sparkles size={13} strokeWidth={3} /> Admin HQ
          </span>
          <h1 className="font-display !text-[clamp(1.8rem,1.2rem+2vw,2.75rem)] !leading-[1.08] mt-4 mb-2.5">
            Hello, <span className="mark-pop">Admin!</span>
          </h1>
          <p className="font-semibold opacity-90 mb-5">
            {users === null
              ? "Gathering everyone's progress…"
              : `${all.length.toLocaleString()} student${all.length === 1 ? "" : "s"} across ${orgs.length} organisation${
                  orgs.length === 1 ? "" : "s"
                }. Tap a student to edit their stats, reset things or remove them.`}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                exportCsv(shown);
                toast.success(`Exported ${shown.length} student${shown.length === 1 ? "" : "s"} to CSV.`);
              }}
              disabled={!users || shown.length === 0}
              className="btn-pop"
            >
              <Download size={17} strokeWidth={2.6} /> Export CSV
            </button>
            <button onClick={load} disabled={refreshing} className="btn-pop btn-pop2">
              <RefreshCw size={17} strokeWidth={2.6} className={cn(refreshing && "animate-spin")} /> Refresh
            </button>
          </div>
        </div>
        <div className="hidden md:block absolute right-4 lg:right-10 bottom-0 top-4 w-[40%] max-w-[420px] pointer-events-none" aria-hidden="true">
          {[
            { src: stembotGreen, cls: "left-[0%] h-[52%] rotate-[-8deg]", delay: "0s" },
            { src: stembotBlue, cls: "left-[25%] h-[60%] rotate-[4deg]", delay: "-1.2s" },
            { src: stembotCream, cls: "left-[50%] h-[54%] rotate-[-4deg]", delay: "-2.4s" },
            { src: stembotRed, cls: "left-[74%] h-[58%] rotate-[7deg]", delay: "-3.6s" },
          ].map((b, i) => (
            <img key={i} src={b.src} alt="" className={cn("absolute bottom-[-5%] die-cut bob", b.cls)} style={{ animationDelay: b.delay }} />
          ))}
        </div>
      </section>

      {/* Stat tiles */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4" aria-label="Academy numbers">
        <StatTile tone={1} icon={<Users size={20} strokeWidth={2.6} />} label="Students" value={stats?.users} />
        <StatTile tone={2} icon={<Activity size={20} strokeWidth={2.6} />} label="Active this week" value={stats?.activeThisWeek} />
        <StatTile tone={3} icon={<CheckCircle2 size={20} strokeWidth={2.6} />} label="Activities done" value={stats?.activitiesCompleted} />
        <StatTile tone={1} icon={<MessageSquare size={20} strokeWidth={2.6} />} label="Messages sent" value={stats?.messages} />
        <StatTile
          tone={2}
          icon={<Hash size={20} strokeWidth={2.6} />}
          label="Group chats"
          value={stats?.groups}
          className="col-span-2 md:col-span-1"
        />
      </section>

      {/* Student table */}
      <section className="admin-card overflow-hidden" aria-label="Students">
        <div className="p-4 sm:p-5 border-b-[2.5px] border-ink bg-soft-1/60">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-display">Students</h2>
            <span className="chip-ink text-sm">
              {shown.length}
              <span className="font-semibold text-muted-foreground">/ {all.length}</span>
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={17} strokeWidth={2.6} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, username or organisation"
                aria-label="Search students"
                className="ink-input pl-11"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                aria-label="Filter by organisation"
                className="ink-input sm:w-56 min-w-0"
              >
                <option value="all">All orgs</option>
                {orgs.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              {/* Phones have no column headers, so sorting lives here. */}
              <select
                value={`${sort.key}:${sort.dir}`}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split(":") as [SortKey, "asc" | "desc"];
                  setSort({ key, dir });
                }}
                aria-label="Sort students"
                className="ink-input md:hidden min-w-0"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={`${s.key}:${s.key === "name" ? "asc" : "desc"}`}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="hidden md:grid md:grid-cols-[minmax(0,2.4fr)_72px_96px_96px_minmax(0,1.5fr)_120px] gap-4 px-5 py-3 border-b-2 border-ink/15 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
          <SortHeader label="Student" k="name" sort={sort} onSort={toggleSort} />
          <SortHeader label="Level" k="level" sort={sort} onSort={toggleSort} />
          <SortHeader label="XP" k="xp" sort={sort} onSort={toggleSort} />
          <SortHeader label="Atoms" k="atoms" sort={sort} onSort={toggleSort} />
          <SortHeader label="Progress" k="progress" sort={sort} onSort={toggleSort} />
          <SortHeader label="Last sign-in" k="lastLogin" sort={sort} onSort={toggleSort} />
        </div>

        {users === null ? (
          <div className="p-10 text-center font-bold text-muted-foreground">Loading students…</div>
        ) : shown.length === 0 ? (
          <div className="p-10 flex flex-col items-center text-center">
            <img src={stembotBlue} alt="" className="h-24 die-cut mb-3" />
            <p className="font-display text-lg font-semibold">{all.length === 0 ? "No students yet" : "No one matches that"}</p>
            <p className="text-sm font-semibold text-muted-foreground">
              {all.length === 0 ? "New sign-ups will show up here." : "Try a different name or organisation."}
            </p>
          </div>
        ) : (
          <ul className="divide-y-2 divide-ink/10">
            {shown.map((u) => (
              <li key={u.userId}>
                <button
                  onClick={() => setSelectedId(u.userId)}
                  data-active={selectedId === u.userId}
                  className="admin-row w-full text-left px-4 sm:px-5 py-3.5 grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,2.4fr)_72px_96px_96px_minmax(0,1.5fr)_120px] items-center gap-3 md:gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={avatarFor(u)}
                      alt=""
                      className="w-11 h-11 rounded-2xl bg-soft-1 border-2 border-ink object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-[15px] truncate">{u.fullName}</p>
                      <p className="text-xs font-semibold text-muted-foreground truncate">
                        @{u.username} · {u.orgName}
                      </p>
                    </div>
                  </div>
                  {/* Phone summary */}
                  <div className="md:hidden flex flex-col items-end gap-1">
                    <span className="chip-ink text-xs !py-1 !px-2.5 !shadow-[0_2px_0_var(--ink-line)]">Lv {u.level}</span>
                    <span className="text-[11px] font-bold text-muted-foreground">{u.xp.toLocaleString()} XP</span>
                  </div>
                  <div className="md:hidden col-span-2 flex items-center gap-3">
                    <div className="meter flex-1 !h-2.5">
                      <span style={{ width: `${pctDone(u)}%` }} />
                    </div>
                    <span className="text-[11px] font-extrabold text-muted-foreground w-24 text-right">
                      {u.completed}/{TOTAL_BEATS} done
                    </span>
                  </div>
                  {/* Desktop columns */}
                  <span className="hidden md:block">
                    <span className="inline-flex items-center justify-center min-w-9 h-8 px-2 rounded-full border-2 border-ink bg-pop-2 font-display font-bold text-sm text-[#1b1b12]">
                      {u.level}
                    </span>
                  </span>
                  <span className="hidden md:block font-display font-semibold tabular-nums">{u.xp.toLocaleString()}</span>
                  <span className="hidden md:block font-display font-semibold tabular-nums">{u.atoms.toLocaleString()}</span>
                  <span className="hidden md:flex items-center gap-2.5 min-w-0">
                    <span className="meter flex-1 !h-2.5">
                      <span style={{ width: `${pctDone(u)}%` }} />
                    </span>
                    <span className="text-xs font-extrabold text-muted-foreground tabular-nums w-11 text-right">
                      {u.completed}/{TOTAL_BEATS}
                    </span>
                  </span>
                  <span className="hidden md:block text-sm font-semibold text-muted-foreground">{shortDate(u.lastLogin)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <UserDrawer
        key={selected?.userId ?? "none"}
        user={selected}
        token={token}
        onClose={() => setSelectedId(null)}
        onError={handle}
        onPatched={patchUser}
        onDeleted={(id) => {
          setSelectedId(null);
          setUsers((list) => list?.filter((u) => u.userId !== id) ?? list);
          adminStats(token).then(setStats).catch(handle);
        }}
        onProgressReset={(id) => {
          patchUser(id, { completed: 0 });
          adminStats(token).then(setStats).catch(handle);
        }}
      />
    </div>
  );
}

function SortHeader({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      onClick={() => onSort(k)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "inline-flex items-center gap-1 !text-[11px] !font-extrabold uppercase tracking-[0.12em] whitespace-nowrap text-left hover:text-foreground transition-colors justify-self-start",
        active && "text-foreground",
      )}
    >
      {label} <Icon size={13} strokeWidth={3} className={cn(!active && "opacity-40")} />
    </button>
  );
}

const TONES = {
  1: "bg-soft-1 text-foreground",
  2: "bg-soft-2 text-[var(--soft-2-ink)]",
  3: "bg-soft-3 text-[var(--soft-3-ink)]",
} as const;

function StatTile({
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

// ---------------------------------------------------------------------------
// Student drawer
// ---------------------------------------------------------------------------
type Confirm = "progress" | "pin" | "delete" | null;

function UserDrawer({
  user,
  token,
  onClose,
  onError,
  onPatched,
  onDeleted,
  onProgressReset,
}: {
  user: AdminUser | null;
  token: string;
  onClose: () => void;
  onError: (e: unknown) => void;
  onPatched: (userId: number, patch: Partial<AdminUser>) => void;
  onDeleted: (userId: number) => void;
  onProgressReset: (userId: number) => void;
}) {
  const [progress, setProgress] = useState<AdminProgressRow[] | null>(null);
  const [games, setGames] = useState<AdminGameRow[]>([]);
  const [confirm, setConfirm] = useState<Confirm>(null);

  useEffect(() => {
    if (!user) return;
    adminUserProgress(token, user.userId)
      .then((r) => {
        setProgress(r.progress);
        setGames(r.games ?? []);
      })
      .catch(onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, token]);

  // Esc closes the drawer (or the open confirm box first).
  useEffect(() => {
    if (!user) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirm) setConfirm(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, confirm, onClose]);

  return (
    <AnimatePresence>
      {user && (
        <motion.div className="fixed inset-0 z-40" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.div
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`${user.fullName}'s details`}
            initial={{ x: "105%" }}
            animate={{ x: 0 }}
            exit={{ x: "105%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute right-0 top-0 bottom-0 w-full sm:w-[460px] bg-background bg-playful sm:border-l-[2.5px] border-ink flex flex-col"
          >
            {/* Header */}
            <div className="panel-pop !rounded-none !border-0 !border-b-[2.5px] !shadow-none px-5 pt-5 pb-6">
              <div className="flex items-start justify-between gap-3">
                <span className="kicker kicker-on">Student #{user.userId}</span>
                <button onClick={onClose} className="btn-pop btn-pop-sm !p-2" aria-label="Close">
                  <X size={17} strokeWidth={2.8} />
                </button>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <img
                  src={avatarFor(user)}
                  alt=""
                  className="w-[72px] h-[72px] rounded-[1.4rem] bg-card border-[2.5px] border-ink shadow-[0_4px_0_var(--ink-line)] object-cover shrink-0 rotate-[-3deg]"
                />
                <div className="min-w-0">
                  <h2 className="font-display !text-2xl truncate">{user.fullName}</h2>
                  <p className="font-bold opacity-85 truncate">@{user.username}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="chip-ink text-xs">{user.orgName}</span>
                <span className="chip-ink text-xs">{user.schoolLevelName}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <p className="text-xs font-bold text-muted-foreground">
                Joined {shortDate(user.createdAt)} · last sign-in {shortDate(user.lastLogin)}
              </p>

              <StatsEditor
                user={user}
                onSave={async (patch) => {
                  try {
                    const { user: row } = await adminUpdateUser(token, user.userId, patch);
                    onPatched(user.userId, row);
                    toast.success(`Saved @${user.username}'s stats.`);
                  } catch (e) {
                    onError(e);
                  }
                }}
              />

              <ProgressCard user={user} progress={progress} games={games} />

              {/* Danger zone */}
              <section className="admin-card p-5">
                <h3 className="font-display !text-lg mb-1">Account tools</h3>
                <p className="text-xs font-semibold text-muted-foreground mb-4">Each one asks you to confirm first.</p>
                <div className="grid gap-2.5">
                  <ToolButton
                    icon={<KeyRound size={18} strokeWidth={2.6} />}
                    title="Reset PIN"
                    hint="Set a new 4-digit PIN and sign them out"
                    onClick={() => setConfirm("pin")}
                  />
                  <ToolButton
                    icon={<RotateCcw size={18} strokeWidth={2.6} />}
                    title="Reset lesson progress"
                    hint="Clear activities and game high scores"
                    onClick={() => setConfirm("progress")}
                  />
                  <ToolButton
                    danger
                    icon={<Trash2 size={18} strokeWidth={2.6} />}
                    title="Delete account"
                    hint="Removes the student and all their data"
                    onClick={() => setConfirm("delete")}
                  />
                </div>
              </section>
            </div>

            <ConfirmProgress
              open={confirm === "progress"}
              user={user}
              onClose={() => setConfirm(null)}
              onConfirm={async () => {
                try {
                  const { removed } = await adminResetProgress(token, user.userId);
                  setProgress([]);
                  setGames([]);
                  onProgressReset(user.userId);
                  toast.success(
                    `Reset @${user.username}: ${removed.lessons} activit${removed.lessons === 1 ? "y" : "ies"} and ${
                      removed.games
                    } game score${removed.games === 1 ? "" : "s"} cleared.`,
                  );
                  setConfirm(null);
                } catch (e) {
                  onError(e);
                }
              }}
            />
            <ConfirmPin
              open={confirm === "pin"}
              user={user}
              onClose={() => setConfirm(null)}
              onConfirm={async (pin) => {
                try {
                  await adminResetPin(token, user.userId, pin);
                  toast.success(`@${user.username}'s new PIN is ${pin}. They've been signed out everywhere.`, {
                    duration: 10000,
                  });
                  setConfirm(null);
                } catch (e) {
                  onError(e);
                }
              }}
            />
            <ConfirmDelete
              open={confirm === "delete"}
              user={user}
              onClose={() => setConfirm(null)}
              onConfirm={async (typed) => {
                try {
                  await adminDeleteUser(token, user.userId, typed);
                  toast.success(`Deleted @${user.username} and all their data.`);
                  setConfirm(null);
                  onDeleted(user.userId);
                } catch (e) {
                  onError(e);
                }
              }}
            />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToolButton({
  icon,
  title,
  hint,
  onClick,
  danger,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 w-full text-left p-3 rounded-2xl border-2 border-ink bg-card shadow-[0_3px_0_var(--ink-line)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_var(--ink-line)]",
        danger && "bg-[color-mix(in_srgb,var(--destructive)_8%,var(--card))]",
      )}
    >
      <span
        className={cn(
          "w-10 h-10 rounded-xl border-2 border-ink flex items-center justify-center shrink-0",
          danger ? "bg-destructive text-white" : "bg-soft-1",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className={cn("block font-display font-semibold", danger && "text-destructive")}>{title}</span>
        <span className="block text-xs font-semibold text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function StatsEditor({
  user,
  onSave,
}: {
  user: AdminUser;
  onSave: (patch: { xp: number; level: number; atoms: number }) => Promise<void>;
}) {
  const [xp, setXp] = useState(String(user.xp));
  const [level, setLevel] = useState(String(user.level));
  const [atoms, setAtoms] = useState(String(user.atoms));
  const [autoLevel, setAutoLevel] = useState(user.level === levelForXp(user.xp));
  const [busy, setBusy] = useState(false);

  // Keep the fields in step when the saved values change.
  useEffect(() => {
    setXp(String(user.xp));
    setLevel(String(user.level));
    setAtoms(String(user.atoms));
  }, [user.xp, user.level, user.atoms]);

  const num = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);
  const xpN = num(xp);
  const levelN = autoLevel ? (Number.isNaN(xpN) ? NaN : levelForXp(xpN)) : num(level);
  const atomsN = num(atoms);
  const valid = !Number.isNaN(xpN) && !Number.isNaN(levelN) && levelN >= 1 && !Number.isNaN(atomsN);
  const dirty = xpN !== user.xp || levelN !== user.level || atomsN !== user.atoms;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !dirty) return;
    setBusy(true);
    await onSave({ xp: xpN, level: levelN, atoms: atomsN });
    setBusy(false);
  };

  return (
    <form onSubmit={save} className="admin-card p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-display !text-lg">Stats</h3>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Edit & save</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <NumberField label="XP" icon={<Zap size={14} strokeWidth={3} />} value={xp} onChange={setXp} />
        <NumberField
          label="Level"
          icon={<Star size={14} strokeWidth={3} />}
          value={autoLevel ? (Number.isNaN(levelN) ? "" : String(levelN)) : level}
          onChange={setLevel}
          disabled={autoLevel}
        />
        <NumberField label="Atoms" icon={<Atom size={14} strokeWidth={3} />} value={atoms} onChange={setAtoms} />
      </div>
      <label className="flex items-center gap-2.5 mt-3.5 cursor-pointer select-none !text-sm">
        <input
          type="checkbox"
          checked={autoLevel}
          onChange={(e) => {
            setAutoLevel(e.target.checked);
            if (!e.target.checked && !Number.isNaN(levelN)) setLevel(String(levelN));
          }}
          className="w-5 h-5 accent-[var(--primary)] cursor-pointer"
        />
        <span className="font-semibold">
          Level follows XP <span className="text-muted-foreground">(1 level per 1,000 XP)</span>
        </span>
      </label>
      <div className="flex items-center justify-end gap-2.5 mt-4">
        {dirty && (
          <button
            type="button"
            className="btn-pop btn-pop-sm"
            onClick={() => {
              setXp(String(user.xp));
              setLevel(String(user.level));
              setAtoms(String(user.atoms));
              setAutoLevel(user.level === levelForXp(user.xp));
            }}
          >
            Undo
          </button>
        )}
        <button type="submit" disabled={!valid || !dirty || busy} className="btn-pop btn-pop-sm btn-primary">
          <Save size={15} strokeWidth={2.6} /> {busy ? "Saving…" : "Save stats"}
        </button>
      </div>
    </form>
  );
}

function NumberField({
  label,
  icon,
  value,
  onChange,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground mb-1.5 pl-1">
        {icon} {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
        className={cn("ink-input !rounded-2xl !px-3 font-display !text-lg tabular-nums", disabled && "opacity-60 cursor-not-allowed")}
      />
    </label>
  );
}

function ProgressCard({
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
function Modal({
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

function useBusy() {
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

function ConfirmProgress({
  open,
  user,
  onClose,
  onConfirm,
}: {
  open: boolean;
  user: AdminUser;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, run] = useBusy();
  return (
    <Modal open={open} onClose={onClose} bot={stembotBlue} title="Reset lesson progress?">
      <p className="text-sm font-semibold text-muted-foreground text-center mb-5">
        Timothy will clear every activity and game high score for <b className="text-foreground">@{user.username}</b>. Their
        XP, Atoms, friends and chats stay as they are.
      </p>
      <div className="flex gap-2.5">
        <button onClick={onClose} className="btn-pop flex-1">
          Cancel
        </button>
        <button onClick={() => run(onConfirm)} disabled={busy} className="btn-pop btn-primary flex-1">
          <RotateCcw size={16} strokeWidth={2.6} /> {busy ? "Resetting…" : "Reset"}
        </button>
      </div>
    </Modal>
  );
}

const randomPin = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");

function ConfirmPin({
  open,
  user,
  onClose,
  onConfirm,
}: {
  open: boolean;
  user: AdminUser;
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

function ConfirmDelete({
  open,
  user,
  onClose,
  onConfirm,
}: {
  open: boolean;
  user: AdminUser;
  onClose: () => void;
  onConfirm: (typed: string) => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, run] = useBusy();
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  const matches = typed.trim().toLowerCase() === user.username.toLowerCase();
  return (
    <Modal open={open} onClose={onClose} bot={stembotRed} title={`Delete @${user.username}?`}>
      <p className="text-sm font-semibold text-muted-foreground text-center mb-4">
        Matthew says: this permanently removes <b className="text-foreground">{user.fullName}</b>'s account, progress, friends
        and messages. It can't be undone.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (matches) run(() => onConfirm(typed.trim()));
        }}
      >
        <label htmlFor="admin-delete-confirm" className="block !text-sm font-bold mb-2 text-center">
          Type <code className="px-1.5 py-0.5 rounded-md bg-soft-1 border border-ink/20">{user.username}</code> to confirm
        </label>
        <input
          id="admin-delete-confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder={user.username}
          className="ink-input text-center mb-5"
        />
        <div className="flex gap-2.5">
          <button type="button" onClick={onClose} className="btn-pop flex-1">
            Keep them
          </button>
          <button type="submit" disabled={!matches || busy} className="btn-pop btn-danger flex-1">
            <Trash2 size={16} strokeWidth={2.6} /> {busy ? "Deleting…" : "Delete forever"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
