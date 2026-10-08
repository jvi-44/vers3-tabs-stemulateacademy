import { useEffect, useMemo, useState } from "react";
import { KeyRound, LogOut, Search, Trash2, Users, Activity, CheckCircle2, MessageSquare, Hash, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { toast, Toaster } from "sonner";
import { ApiError } from "../api/client";
import {
  adminLogin,
  adminStats,
  adminUsers,
  adminUserProgress,
  adminDeleteUser,
  type AdminStats,
  type AdminUser,
  type AdminProgressRow,
} from "../api/admin";
import { GAME_LESSONS } from "../data/lessonContent";
import { avatarFor } from "./FriendsTab";
import { cn } from "./ui/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import stemulateLogo from "../assets/stemulate_logo.png";
import stembotCream from "../assets/stembot_cream.png";

// The admin token lasts for this browser tab only.
const ADMIN_TOKEN_KEY = "stemulate_admin_token";

const BEAT_TITLES: Record<string, string> = Object.fromEntries(
  GAME_LESSONS.flatMap((l) => l.beats.map((b) => [b.id, `${l.title} · ${b.title}`])),
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

function shortDate(sql: string | null) {
  if (!sql) return "Never";
  const d = new Date(sql.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? sql : d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export function AdminPage({ onExit }: { onExit: () => void }) {
  const [token, setToken] = useState<string | null>(readToken);

  const signOut = () => {
    saveToken(null);
    setToken(null);
  };

  return (
    <div className="min-h-screen bg-playful text-foreground">
      <Toaster position="top-center" />
      <header className="h-[76px] bg-hero px-4 md:px-8 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <img src={stemulateLogo} alt="" className="w-10 h-10 object-contain drop-shadow" />
          <p className="font-black text-white truncate">STEMulate Academy · Admin</p>
        </div>
        <div className="flex items-center gap-2">
          {token && (
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 bg-white/90 text-foreground text-xs font-bold px-3 py-2 rounded-xl"
            >
              <LogOut size={14} /> Lock
            </button>
          )}
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 bg-white text-foreground text-xs font-bold px-3 py-2 rounded-xl"
          >
            <ArrowLeft size={14} /> Back to Academy
          </button>
        </div>
      </header>
      <main className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {token ? (
            <AdminDashboard token={token} onExpired={signOut} />
          ) : (
            <PasskeyForm
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

function PasskeyForm({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [passkey, setPasskey] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!passkey) return;
    setBusy(true);
    try {
      const { token } = await adminLogin(passkey);
      onSuccess(token);
    } catch (e) {
      toast.error((e as Error).message);
      setPasskey("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10 bg-card rounded-3xl border border-border shadow-lg p-8 text-center">
      <img src={stembotCream} alt="" className="h-24 w-auto mx-auto mb-3" />
      <h1 className="font-black text-foreground mb-1">Admin sign in</h1>
      <p className="text-sm text-muted-foreground mb-5">Enter the admin passkey to manage students.</p>
      <div className="relative mb-3">
        <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="password"
          autoFocus
          value={passkey}
          onChange={(e) => setPasskey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Passkey"
          autoComplete="current-password"
          className="w-full pl-9 pr-3 py-3 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <button
        onClick={submit}
        disabled={!passkey || busy}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
      >
        {busy ? "Checking…" : "Unlock"}
      </button>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card rounded-3xl border border-border shadow-sm p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xl font-black text-foreground">{value.toLocaleString()}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

function AdminDashboard({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [org, setOrg] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [progress, setProgress] = useState<Record<number, AdminProgressRow[]>>({});
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);

  const handle = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) onExpired();
    toast.error((e as Error).message);
  };

  const load = () => {
    adminStats(token).then(setStats).catch(handle);
    adminUsers(token)
      .then(({ users }) => setUsers(users))
      .catch(handle);
  };

  useEffect(load, [token]);

  const orgs = useMemo(() => [...new Set(users.map((u) => u.orgName))].sort(), [users]);
  const shown = users.filter((u) => {
    const q = query.trim().toLowerCase();
    const matchesText = !q || u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    return matchesText && (org === "all" || u.orgName === org);
  });

  const toggle = (u: AdminUser) => {
    if (expanded === u.userId) return setExpanded(null);
    setExpanded(u.userId);
    if (!progress[u.userId]) {
      adminUserProgress(token, u.userId)
        .then(({ progress: rows }) => setProgress((p) => ({ ...p, [u.userId]: rows })))
        .catch(handle);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await adminDeleteUser(token, toDelete.userId);
      toast.success(`Deleted @${toDelete.username} and all their data.`);
      load();
    } catch (e) {
      handle(e);
    }
    setToDelete(null);
  };

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatTile icon={<Users size={18} />} label="Students" value={stats.users} />
          <StatTile icon={<Activity size={18} />} label="Active this week" value={stats.activeThisWeek} />
          <StatTile icon={<CheckCircle2 size={18} />} label="Activities done" value={stats.activitiesCompleted} />
          <StatTile icon={<MessageSquare size={18} />} label="Messages" value={stats.messages} />
          <StatTile icon={<Hash size={18} />} label="Group chats" value={stats.groups} />
        </div>
      )}

      <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-border">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or username"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <select
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-background text-sm font-semibold outline-none"
          >
            <option value="all">All organisations</option>
            {orgs.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        {shown.length === 0 && <p className="p-6 text-sm text-muted-foreground">No students match.</p>}
        <div className="divide-y divide-border">
          {shown.map((u) => {
            const pct = Math.round((Math.min(u.completed, TOTAL_BEATS) / TOTAL_BEATS) * 100);
            return (
              <div key={u.userId}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <img src={avatarFor(u)} alt="" className="w-10 h-10 rounded-xl bg-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">
                      {u.fullName} <span className="text-muted-foreground font-medium">@{u.username}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {u.orgName} · {u.schoolLevelName} · last sign-in {shortDate(u.lastLogin)}
                    </p>
                  </div>
                  <div className="hidden md:block w-40">
                    <div className="h-2 bg-accent rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {u.completed}/{TOTAL_BEATS} activities · {u.xp.toLocaleString()} XP
                    </p>
                  </div>
                  <button
                    onClick={() => toggle(u)}
                    className="p-2 rounded-xl hover:bg-accent"
                    aria-label={`Show progress for ${u.username}`}
                  >
                    {expanded === u.userId ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <button
                    onClick={() => setToDelete(u)}
                    className="p-2 rounded-xl text-destructive hover:bg-destructive/10"
                    aria-label={`Delete ${u.username}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {expanded === u.userId && (
                  <div className="px-4 pb-4">
                    <div className="bg-accent/40 rounded-2xl p-3">
                      <p className="text-[11px] text-muted-foreground mb-2">
                        Joined {shortDate(u.createdAt)} · Level {u.level} · {u.atoms.toLocaleString()} atoms
                      </p>
                      {!progress[u.userId] ? (
                        <p className="text-xs text-muted-foreground">Loading…</p>
                      ) : progress[u.userId].length === 0 ? (
                        <p className="text-xs text-muted-foreground">No lesson activity yet.</p>
                      ) : (
                        <div className="space-y-1">
                          {progress[u.userId].map((p) => (
                            <div key={p.lesson_id} className="flex items-center gap-2 text-xs">
                              <span
                                className={cn(
                                  "w-2 h-2 rounded-full shrink-0",
                                  p.status === "completed" ? "bg-emerald-500" : "bg-amber-400",
                                )}
                              />
                              <span className="flex-1 truncate text-foreground">{BEAT_TITLES[p.lesson_id] ?? p.lesson_id}</span>
                              {p.score !== null && <span className="font-bold text-primary">{p.score}%</span>}
                              <span className="text-muted-foreground">{shortDate(p.completed_at ?? p.last_accessed)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete @{toDelete?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {toDelete?.fullName}'s account, progress, friends and messages. It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
