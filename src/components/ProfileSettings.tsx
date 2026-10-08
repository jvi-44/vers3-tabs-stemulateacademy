import { useState } from "react";
import { Pencil, Building2, GraduationCap, AtSign, CalendarDays, Download, Trash2, ShieldCheck, Palette, Check } from "lucide-react";
import { toast } from "sonner";
import type { AuthUser } from "../types-auth";
import { updateMe, deleteMe, downloadMyData } from "../api/auth";
import { THEMES, type ThemeId } from "../lib/theme";
import { cn } from "./ui/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import stembotRed from "../assets/stembot_red.png";

const USERNAME_PATTERN = /^[A-Za-z0-9_]*$/;

function memberSince(createdAt?: string) {
  if (!createdAt) return "—";
  const d = new Date(createdAt.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-accent/40 min-w-0">
      <div className="w-9 h-9 rounded-xl bg-card text-primary flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// My details: name, username, organisation, school level. Name and username
// can be changed; organisation and level are set by the centre.
// ---------------------------------------------------------------------------

export function ProfileDetails({ authUser, onChange }: { authUser: AuthUser; onChange: (u: AuthUser) => void }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(authUser.username);
  const [fullName, setFullName] = useState(authUser.fullName);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setUsername(authUser.username);
    setFullName(authUser.fullName);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const changes: { username?: string; fullName?: string } = {};
      if (username.trim() !== authUser.username) changes.username = username.trim();
      if (fullName.trim() !== authUser.fullName) changes.fullName = fullName.trim();
      if (Object.keys(changes).length) {
        const { user } = await updateMe(changes);
        onChange(user);
        toast.success("Profile updated!");
      }
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const usernameValid = /^[A-Za-z0-9_]{3,20}$/.test(username.trim());

  return (
    <div className="sticker p-6 ">
      <div className="flex items-center justify-between mb-4 gap-3">
        <p className="font-bold text-foreground">My details</p>
        <button
          onClick={startEdit}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90"
        >
          <Pencil size={13} /> Edit
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DetailRow icon={<Pencil size={16} />} label="Name" value={authUser.fullName} />
        <DetailRow icon={<AtSign size={16} />} label="Username" value={authUser.username} />
        <DetailRow icon={<Building2 size={16} />} label="Organisation" value={authUser.orgName ?? "—"} />
        <DetailRow icon={<GraduationCap size={16} />} label="School level" value={authUser.schoolLevelName ?? "—"} />
        <DetailRow icon={<CalendarDays size={16} />} label="Member since" value={memberSince(authUser.createdAt)} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit my details</DialogTitle>
            <DialogDescription>
              Friends see your username. Your name is only shown to you and your teachers.
            </DialogDescription>
          </DialogHeader>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-muted-foreground">Name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={60}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-muted-foreground">Username</span>
            <input
              value={username}
              onChange={(e) => USERNAME_PATTERN.test(e.target.value) && setUsername(e.target.value)}
              maxLength={20}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <span className={cn("text-[11px]", usernameValid ? "text-muted-foreground" : "text-destructive")}>
              3–20 letters, numbers or underscores. You'll sign in with the new one.
            </span>
          </label>
          <DialogFooter>
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-sm font-bold hover:bg-accent">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !usernameValid || !fullName.trim()}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colour themes
// ---------------------------------------------------------------------------

export function ThemePicker({ theme, onTheme }: { theme: ThemeId; onTheme: (t: ThemeId) => void }) {
  return (
    <div className="sticker p-6">
      <h2 className="font-display text-foreground !text-xl mb-1 flex items-center gap-2">
        <Palette size={20} className="text-primary" /> Colour theme
      </h2>
      <p className="text-sm font-semibold text-muted-foreground mb-5">
        Each theme has its own STEMbot, colours and doodles. Works in dark mode too.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {THEMES.map((t, i) => {
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTheme(t.id)}
              // Each preview sets data-theme so its doodle pattern and colour
              // come from that theme, whatever theme is active.
              data-theme={t.id}
              className={cn(
                "relative rounded-[1.4rem] overflow-hidden text-left transition-all border-[2.5px]",
                active
                  ? "border-ink shadow-[0_5px_0_var(--ink-line)] -translate-y-1"
                  : "border-transparent hover:-translate-y-1 hover:border-border",
                i % 2 ? "rotate-[1deg]" : "rotate-[-1deg]",
              )}
            >
              <div className="h-24 flex items-end justify-center bg-hero relative">
                <img src={t.bot} alt="" className="h-20 w-auto -mb-2 die-cut" />
              </div>
              <div className="flex items-center justify-between gap-1 px-3 py-2 bg-white">
                <p className="text-sm font-black text-[#1c1a17]">{t.name}</p>
                <span className="flex -space-x-1">
                  {t.swatch.map((c) => (
                    <span key={c} className="w-3 h-3 rounded-full border border-black/20" style={{ background: c }} />
                  ))}
                </span>
              </div>
              {active && (
                <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white text-[#1c1a17] border-2 border-[#1c1a17] flex items-center justify-center">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Privacy & account: download my data, delete my account
// ---------------------------------------------------------------------------

export function PrivacyAndAccount({ authUser, onDeleted }: { authUser: AuthUser; onDeleted: () => void }) {
  const [step, setStep] = useState<"closed" | "confirm" | "pin">("closed");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setStep("closed");
    setPin("");
  };

  const download = async () => {
    try {
      await downloadMyData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await deleteMe(pin);
      close();
      onDeleted();
    } catch (e) {
      toast.error((e as Error).message);
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sticker p-6 ">
      <p className="font-bold text-foreground mb-1 flex items-center gap-2">
        <ShieldCheck size={18} className="text-primary" /> Privacy &amp; account
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        We keep your name, username, centre, school level, lesson progress, friends and chat messages so the Academy
        works. You can download a copy or delete everything at any time.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={download}
          className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-2xl bg-accent text-accent-foreground hover:opacity-90"
        >
          <Download size={16} /> Download my data
        </button>
        <button
          onClick={() => setStep("confirm")}
          className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/20"
        >
          <Trash2 size={16} /> Delete my account
        </button>
      </div>

      {/* Step 1: are you sure? Step 2: type your PIN. */}
      <AlertDialog open={step !== "closed"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <img src={stembotRed} alt="" className="h-20 w-20 object-contain mx-auto sm:mx-0" />
            <AlertDialogTitle>
              {step === "confirm" ? "Are you sure you want to delete your account?" : "Type your PIN to delete"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {step === "confirm" ? (
                <>
                  This deletes <b>@{authUser.username}</b> forever: your XP, atoms, badges, lesson progress, friends and
                  every message you've sent. It can't be undone.
                </>
              ) : (
                "Enter your 4-digit PIN to confirm it's really you."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {step === "pin" && (
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              maxLength={4}
              onChange={(e) => /^\d{0,4}$/.test(e.target.value) && setPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && pin.length === 4 && doDelete()}
              placeholder="••••"
              className="w-full px-3 py-3 rounded-xl border border-border bg-background text-center text-lg tracking-[0.5em] outline-none focus:ring-2 focus:ring-destructive/40"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my account</AlertDialogCancel>
            {step === "confirm" ? (
              <button
                onClick={() => setStep("pin")}
                className="px-4 py-2 rounded-md text-sm font-bold bg-destructive text-white hover:bg-destructive/90"
              >
                Yes, delete it
              </button>
            ) : (
              <button
                onClick={doDelete}
                disabled={pin.length !== 4 || busy}
                className="px-4 py-2 rounded-md text-sm font-bold bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Delete forever"}
              </button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
