// The staff page at /#/staff: centre staff and STEMulate volunteers follow
// the students at their centres. An admin adds each person (admin page →
// Staff & volunteers) and gives them a one-time set-up link
// (/#/staff/setup?t=…) to choose their own password. Staff see progress and
// can reset a forgotten PIN; volunteers only see progress
// (server/routes/staff.js). Centre tablets are shared with children, so the
// page clears itself after an hour unused and leaving it signs out.
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Download, Eye, EyeOff, KeyRound, LogOut, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { toast, Toaster } from "sonner";
import { ApiError } from "../api/client";
import type { AdminGameRow, AdminProgressRow, AdminUser, StaffAccount } from "../api/admin";
import {
  PASSWORD_MIN,
  staffLogin,
  staffMe,
  staffResetPin,
  staffSetup,
  staffSetupCheck,
  staffStudentProgress,
  staffStudents,
} from "../api/staff";
import { clearPendingSignOut, finishPendingSignOut, signOutStaff } from "../lib/staffArea";
import { avatarFor } from "./FriendsTab";
import { cn } from "./ui/utils";
import {
  ConfirmPin,
  ProgressCard,
  TOTAL_BEATS,
  centreLabel,
  exportCsv,
  pctDone,
  savedFileToast,
  shortDate,
  useIdle,
  useOnVisible,
} from "./admin/shared";
import stemulateLogo from "../assets/stemulate_logo.png";
import stembotGreen from "../assets/stembot_green.png";
import "../styles/admin.css";

const ROLE_LABEL: Record<StaffAccount["role"], string> = { admin: "Admin", staff: "Centre staff", volunteer: "Volunteer" };
const SIGNED_OUT = "You were signed out (after an hour without use, 12 hours after signing in, or by an admin). Please sign in again.";
const IDLE = "You were signed out after an hour without use. Please sign in again.";

/** The set-up token in "#/staff/setup?t=<token>", or null. */
function setupTokenFromHash() {
  const m = /^#\/staff\/setup\?t=([0-9a-f]{64})$/.exec(window.location.hash);
  return m ? m[1] : null;
}

type View =
  | { kind: "loading"; label?: string }
  | { kind: "signin"; notice?: string }
  | { kind: "setup"; token: string }
  | { kind: "dashboard"; staff: StaffAccount };

export function StaffPortal({ onExit }: { onExit: () => void }) {
  const [view, setView] = useState<View>(() => {
    const token = setupTokenFromHash();
    return token ? { kind: "setup", token } : { kind: "loading" };
  });

  useEffect(() => {
    if (view.kind === "setup") {
      // Keep the one-time token out of the address bar and history.
      window.history.replaceState(null, "", "#/staff/setup");
      return;
    }
    // A sign-out that couldn't reach the server before is finished first.
    finishPendingSignOut()
      .then((clear) => (clear ? staffMe() : Promise.reject(new Error("Signed out."))))
      .then(({ staff }) => setView({ kind: "dashboard", staff }))
      .catch(() => setView({ kind: "signin" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Students' names leave the screen at once, toasts (a new PIN) included,
  // while this waits for the server (which can take a minute to wake). True
  // once signed out; if the server can't be reached, back to the list.
  const signOut = async () => {
    if (view.kind !== "dashboard") return true;
    const { staff } = view;
    toast.dismiss();
    setView({ kind: "loading", label: "Signing out…" });
    // The admin page's passkey token in this tab goes too (staffArea.ts).
    if (await signOutStaff()) {
      setView({ kind: "signin", notice: "Signed out. See you next time!" });
      return true;
    }
    setView({ kind: "dashboard", staff });
    toast.error("Couldn't sign out. Check the internet connection and try again.");
    return false;
  };
  const signedInAs = (staff: StaffAccount) => {
    clearPendingSignOut();
    setView({ kind: "dashboard", staff });
  };
  // Back to the Academy signs out first, so the next person can't come back in.
  const leave = async () => {
    if (await signOut()) onExit();
  };
  const signedOut = (notice: string) => {
    toast.dismiss();
    setView({ kind: "signin", notice });
  };
  const expired = () => signedOut(SIGNED_OUT);

  const signedIn = view.kind === "dashboard";
  useIdle(signedIn, () => {
    signedOut(IDLE);
    void signOutStaff();
  });
  // A tablet woken up hours later: check the session is still there.
  useOnVisible(signedIn, () => {
    staffMe().catch((e) => {
      if (e instanceof ApiError && e.status === 401) expired();
    });
  });

  return (
    <div className="min-h-screen bg-playful text-foreground">
      <Toaster position="top-center" richColors closeButton />
      <header className="sticky top-0 z-30 bg-card border-b-[2.5px] border-ink">
        <div className="max-w-6xl mx-auto min-h-[68px] px-4 md:px-8 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={stemulateLogo} alt="" className="w-10 h-10 object-contain shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="font-display font-bold text-lg truncate">STEMulate Academy</p>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Staff &amp; volunteers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view.kind === "dashboard" && (
              <>
                {view.staff.role === "admin" && (
                  <a href="#/admin" className="btn-pop btn-pop-sm">
                    <ShieldCheck size={15} strokeWidth={2.6} />
                    <span className="hidden sm:inline">Admin page</span>
                  </a>
                )}
                <button onClick={signOut} className="btn-pop btn-pop-sm" aria-label="Sign out">
                  <LogOut size={15} strokeWidth={2.6} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            )}
            <button onClick={leave} className="btn-pop btn-pop-sm btn-primary" aria-label="Back to Academy">
              <ArrowLeft size={15} strokeWidth={2.6} />
              <span className="hidden sm:inline">Back to Academy</span>
            </button>
          </div>
        </div>
        {view.kind === "dashboard" && (
          // Always on screen, because centre tablets are shared with children.
          <p className="bg-soft-1 border-t-2 border-ink/15 px-4 md:px-8 py-1.5 text-center text-xs font-bold">
            Signed in as {view.staff.fullName} ({ROLE_LABEL[view.staff.role]}). Sign out before you hand this device to a student.
          </p>
        )}
      </header>
      <main className="px-4 py-6 md:px-8 md:py-8">
        <div className="max-w-6xl mx-auto">
          {view.kind === "loading" && <p className="p-10 text-center font-bold text-muted-foreground">{view.label ?? "Loading…"}</p>}
          {view.kind === "signin" && <SignIn notice={view.notice} onSignedIn={signedInAs} />}
          {view.kind === "setup" && <SetUp token={view.token} onDone={signedInAs} onBadLink={() => setView({ kind: "signin" })} />}
          {view.kind === "dashboard" && <Dashboard staff={view.staff} onExpired={expired} />}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------
function SignIn({ notice, onSignedIn }: { notice?: string; onSignedIn: (s: StaffAccount) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { staff } = await staffLogin(email.trim(), password);
      toast.success(`Welcome, ${staff.fullName}!`);
      onSignedIn(staff);
    } catch (err) {
      setError((err as Error).message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-2 sm:pt-8">
      <form onSubmit={submit} className="admin-card px-6 pt-8 pb-7 sm:px-8" noValidate>
        <div className="text-center mb-6">
          <span className="kicker kicker-3">
            <ShieldCheck size={13} strokeWidth={3} /> Staff &amp; volunteers
          </span>
          <h1 className="font-display mt-3 mb-1.5">Sign in</h1>
          <p className="text-sm font-semibold text-muted-foreground">Follow your centre's students and their progress.</p>
        </div>
        {notice && <p className="mb-4 rounded-2xl bg-soft-1 border-2 border-ink/20 p-3 text-sm font-semibold">{notice}</p>}
        <label htmlFor="staff-email" className="block text-sm font-bold mb-1.5">
          Email
        </label>
        <input
          id="staff-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          autoFocus
          required
          aria-invalid={!!error}
          aria-describedby={error ? "staff-signin-error" : undefined}
          className="ink-input mb-4"
        />
        <label htmlFor="staff-password" className="block text-sm font-bold mb-1.5">
          Password
        </label>
        <div className="relative mb-2">
          <input
            id="staff-password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            aria-invalid={!!error}
            aria-describedby={error ? "staff-signin-error" : undefined}
            className="ink-input pr-12"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff size={17} strokeWidth={2.5} /> : <Eye size={17} strokeWidth={2.5} />}
          </button>
        </div>
        <p id="staff-signin-error" role="alert" className="min-h-5 px-1 mb-3 text-sm font-bold text-destructive">
          {error}
        </p>
        <button type="submit" disabled={!email.trim() || !password || busy} className="btn-pop btn-primary w-full text-base">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-5 text-center text-xs font-semibold text-muted-foreground">
          New here, or forgot your password? Ask a STEMulate admin for a set-up link.
        </p>
        <p className="mt-2 text-center text-xs font-semibold text-muted-foreground">
          Have the admin passkey?{" "}
          <a href="#/admin" className="underline font-bold">
            Open the admin page
          </a>
          .
        </p>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Set-up link: choose a password
// ---------------------------------------------------------------------------
function SetUp({ token, onDone, onBadLink }: { token: string; onDone: (s: StaffAccount) => void; onBadLink: () => void }) {
  const [who, setWho] = useState<{ fullName: string; email: string } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    staffSetupCheck(token)
      .then(setWho)
      .catch((e) => setLinkError((e as Error).message));
  }, [token]);

  const rules = [
    { ok: password.length >= PASSWORD_MIN, text: `At least ${PASSWORD_MIN} characters` },
    { ok: !!password && !!who && password.toLowerCase() !== who.email.toLowerCase(), text: "Not your email address" },
    { ok: !!password && password === again, text: "Both passwords match" },
  ];
  const ready = rules.every((r) => r.ok);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { staff } = await staffSetup(token, password);
      toast.success("Password set. You're signed in!");
      window.history.replaceState(null, "", "#/staff");
      onDone(staff);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (linkError) {
    return (
      <div className="max-w-md mx-auto pt-8 admin-card p-7 text-center">
        <h1 className="font-display mb-2">This link doesn't work</h1>
        <p className="text-sm font-semibold text-muted-foreground mb-5">{linkError}</p>
        <button onClick={onBadLink} className="btn-pop btn-primary">
          Go to sign in
        </button>
      </div>
    );
  }
  if (!who) return <p className="p-10 text-center font-bold text-muted-foreground">Checking your link…</p>;

  return (
    <div className="max-w-md mx-auto pt-2 sm:pt-8">
      <form onSubmit={submit} className="admin-card px-6 pt-8 pb-7 sm:px-8">
        <div className="text-center mb-6">
          <img src={stembotGreen} alt="" className="h-20 mx-auto die-cut mb-2" />
          <h1 className="font-display mb-1.5">Hi, {who.fullName}!</h1>
          <p className="text-sm font-semibold text-muted-foreground">Choose a password for your STEMulate Academy staff account.</p>
        </div>
        {/* For password managers: the account this password belongs to. */}
        <label htmlFor="setup-email" className="block text-sm font-bold mb-1.5">
          Email
        </label>
        <input id="setup-email" type="email" value={who.email} readOnly autoComplete="username" className="ink-input mb-4 opacity-80" />
        <label htmlFor="setup-password" className="block text-sm font-bold mb-1.5">
          New password
        </label>
        <div className="relative mb-4">
          <input
            id="setup-password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
            aria-describedby="setup-rules"
            className="ink-input pr-12"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label={show ? "Hide passwords" : "Show passwords"}
          >
            {show ? <EyeOff size={17} strokeWidth={2.5} /> : <Eye size={17} strokeWidth={2.5} />}
          </button>
        </div>
        <label htmlFor="setup-again" className="block text-sm font-bold mb-1.5">
          Type it again
        </label>
        <input
          id="setup-again"
          type={show ? "text" : "password"}
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          autoComplete="new-password"
          aria-describedby="setup-rules"
          className="ink-input mb-3"
        />
        <ul id="setup-rules" className="mb-3 space-y-1 text-sm font-semibold" aria-live="polite">
          {rules.map((r) => (
            <li key={r.text} className={cn("flex items-center gap-2", r.ok ? "text-[var(--soft-3-ink)]" : "text-muted-foreground")}>
              {r.ok ? <Check size={15} strokeWidth={3} aria-hidden /> : <X size={15} strokeWidth={3} aria-hidden />}
              <span>
                {r.text}
                <span className="sr-only">{r.ok ? " (done)" : " (not yet)"}</span>
              </span>
            </li>
          ))}
        </ul>
        <p role="alert" className="min-h-5 px-1 mb-3 text-sm font-bold text-destructive">
          {error}
        </p>
        <button type="submit" disabled={!ready || busy} className="btn-pop btn-primary w-full text-base">
          {busy ? "Saving…" : "Set password and sign in"}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Students at their centres
// ---------------------------------------------------------------------------
type Sort = "lastActive" | "name" | "progress";

function Dashboard({ staff, onExpired }: { staff: StaffAccount; onExpired: () => void }) {
  const [students, setStudents] = useState<AdminUser[] | null>(null);
  const [query, setQuery] = useState("");
  const [centre, setCentre] = useState("all");
  const [sort, setSort] = useState<Sort>("lastActive");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handle = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) onExpired();
    else toast.error((e as Error).message);
  };

  const load = async () => {
    setRefreshing(true);
    try {
      setStudents((await staffStudents()).students);
    } catch (e) {
      handle(e);
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const all = students ?? [];
  const centres = useMemo(() => [...new Set(all.map(centreLabel))].sort(), [all]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((u) => (!q || u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)) && (centre === "all" || centreLabel(u) === centre))
      .sort((a, b) =>
        sort === "name"
          ? a.fullName.localeCompare(b.fullName)
          : sort === "progress"
            ? b.completed - a.completed
            : (b.lastActive ?? "").localeCompare(a.lastActive ?? ""),
      );
  }, [all, query, centre, sort]);
  const following = staff.role === "admin" || staff.allCentres ? "every centre" : staff.centres.map((c) => c.name).join(", ");
  const selected = all.find((u) => u.userId === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <section className="panel-pop px-6 py-6 sm:px-8">
        <h1 className="font-display !text-[clamp(1.6rem,1.2rem+1.6vw,2.4rem)] mb-2">Hello, {staff.fullName.split(" ")[0]}!</h1>
        <p className="font-semibold opacity-90 mb-4">
          {following ? `You follow ${following}.` : "You don't follow any centres yet. Ask a STEMulate admin to add yours."}{" "}
          {students && `${all.length} student${all.length === 1 ? "" : "s"}.`}
        </p>
        <div className="flex flex-wrap gap-3">
          {/* A file of children's names stays on the device, so the page
              offers one to centre staff and admins, not volunteers. */}
          {staff.role !== "volunteer" && (
            <button
              onClick={() => {
                exportCsv(shown);
                savedFileToast(`${shown.length} student${shown.length === 1 ? "" : "s"}`);
              }}
              disabled={!students || shown.length === 0}
              className="btn-pop"
              title="Saves a file with these students' names. Don't keep it on a shared device."
            >
              <Download size={17} strokeWidth={2.6} /> Export CSV
            </button>
          )}
          <button onClick={load} disabled={refreshing} className="btn-pop btn-pop2">
            <RefreshCw size={17} strokeWidth={2.6} className={cn(refreshing && "animate-spin")} /> Refresh
          </button>
        </div>
      </section>

      <section className="admin-card overflow-hidden" aria-label="Students">
        <div className="p-4 sm:p-5 border-b-[2.5px] border-ink bg-soft-1/60 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={17} strokeWidth={2.6} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or username" aria-label="Search students" className="ink-input pl-11" />
          </div>
          <div className="flex gap-3">
            {centres.length > 1 && (
              <select value={centre} onChange={(e) => setCentre(e.target.value)} aria-label="Filter by centre" className="ink-input sm:w-56 min-w-0">
                <option value="all">All my centres</option>
                {centres.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort students" className="ink-input min-w-0">
              <option value="lastActive">Last active</option>
              <option value="name">Name</option>
              <option value="progress">Progress</option>
            </select>
          </div>
        </div>

        {students === null ? (
          <div className="p-10 text-center font-bold text-muted-foreground">Loading students…</div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-display text-lg font-semibold">{all.length === 0 ? "No students yet" : "No one matches that"}</p>
            <p className="text-sm font-semibold text-muted-foreground">
              {all.length === 0 ? "Students who sign up at your centres show up here." : "Try a different name."}
            </p>
          </div>
        ) : (
          <ul className="divide-y-2 divide-ink/10">
            {shown.map((u) => (
              <li key={u.userId}>
                <button
                  onClick={() => setSelectedId(u.userId)}
                  className="admin-row w-full text-left px-4 sm:px-5 py-3.5 grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_110px] items-center gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={avatarFor(u)} alt="" className="w-11 h-11 rounded-2xl bg-soft-1 border-2 border-ink object-cover shrink-0" />
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-[15px] truncate">{u.fullName}</p>
                      <p className="text-xs font-semibold text-muted-foreground truncate">
                        @{u.username} · {u.schoolLevelName} · {centreLabel(u)}
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:flex items-center gap-2.5 min-w-0">
                    <span className="meter flex-1 !h-2.5">
                      <span style={{ width: `${pctDone(u)}%` }} />
                    </span>
                    <span className="text-xs font-extrabold text-muted-foreground tabular-nums w-11 text-right">
                      {u.completed}/{TOTAL_BEATS}
                    </span>
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-muted-foreground text-right">{shortDate(u.lastActive)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StudentPanel key={selected?.userId ?? "none"} student={selected} canResetPin={staff.role !== "volunteer"} onClose={() => setSelectedId(null)} onError={handle} />
    </div>
  );
}

function StudentPanel({
  student,
  canResetPin,
  onClose,
  onError,
}: {
  student: AdminUser | null;
  canResetPin: boolean;
  onClose: () => void;
  onError: (e: unknown) => void;
}) {
  const [progress, setProgress] = useState<AdminProgressRow[] | null>(null);
  const [games, setGames] = useState<AdminGameRow[]>([]);
  const [pinOpen, setPinOpen] = useState(false);

  useEffect(() => {
    if (!student) return;
    staffStudentProgress(student.userId)
      .then((r) => {
        setProgress(r.progress);
        setGames(r.games);
      })
      .catch(onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.userId]);

  useEffect(() => {
    if (!student) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pinOpen) setPinOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [student, pinOpen, onClose]);

  return (
    <AnimatePresence>
      {student && (
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
            aria-label={`${student.fullName}'s progress`}
            initial={{ x: "105%" }}
            animate={{ x: 0 }}
            exit={{ x: "105%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute right-0 top-0 bottom-0 w-full sm:w-[460px] bg-background bg-playful sm:border-l-[2.5px] border-ink flex flex-col"
          >
            <div className="panel-pop !rounded-none !border-0 !border-b-[2.5px] !shadow-none px-5 pt-5 pb-6">
              <div className="flex items-start justify-between gap-3">
                <span className="kicker kicker-on">{student.schoolLevelName}</span>
                <button onClick={onClose} className="btn-pop btn-pop-sm !p-2" aria-label="Close" autoFocus>
                  <X size={17} strokeWidth={2.8} />
                </button>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <img src={avatarFor(student)} alt="" className="w-[72px] h-[72px] rounded-[1.4rem] bg-card border-[2.5px] border-ink object-cover shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-display !text-2xl truncate">{student.fullName}</h2>
                  <p className="font-bold opacity-85 truncate">@{student.username}</p>
                </div>
              </div>
              <p className="mt-3 text-xs font-bold opacity-85">
                {centreLabel(student)} · joined {shortDate(student.createdAt)} · last active {shortDate(student.lastActive)}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <ProgressCard user={student} progress={progress} games={games} />
              <section className="admin-card p-5">
                <h3 className="font-display !text-lg mb-1">Forgot their PIN?</h3>
                {canResetPin ? (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground mb-4">Set a new 4-digit PIN and tell the student. They're signed out everywhere.</p>
                    <button onClick={() => setPinOpen(true)} className="btn-pop">
                      <KeyRound size={16} strokeWidth={2.6} /> Reset PIN
                    </button>
                  </>
                ) : (
                  <p className="text-xs font-semibold text-muted-foreground">Ask centre staff or a STEMulate admin to reset it.</p>
                )}
              </section>
            </div>
            <ConfirmPin
              open={pinOpen}
              user={student}
              onClose={() => setPinOpen(false)}
              onConfirm={async (pin) => {
                try {
                  await staffResetPin(student.userId, pin);
                  toast.success(`@${student.username}'s new PIN is ${pin}. They've been signed out everywhere.`, { duration: 10000 });
                  setPinOpen(false);
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
