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
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-soft-1 border-2 border-ink shadow-[0_3px_0_var(--ink-line)] min-w-0 transition-transform hover:-translate-y-0.5 hover:-rotate-[0.5deg]">
      <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground border-2 border-ink shadow-[0_2px_0_var(--ink-line)] flex items-center justify-center shrink-0 -rotate-6">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display font-semibold text-foreground truncate">{value}</p>
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
      <div className="flex items-center justify-between mb-5 gap-3">
        <h2 className="font-display text-foreground !text-xl flex items-center gap-2">
          <AtSign size={20} className="text-primary" strokeWidth={2.5} /> My details
        </h2>
        <button onClick={startEdit} className="btn-pop btn-pop-sm btn-primary rotate-[2deg] hover-wiggle">
          <Pencil size={14} strokeWidth={2.5} /> Edit
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DetailRow icon={<Pencil size={17} strokeWidth={2.5} />} label="Name" value={authUser.fullName} />
        <DetailRow icon={<AtSign size={17} strokeWidth={2.5} />} label="Username" value={authUser.username} />
        <DetailRow icon={<Building2 size={17} strokeWidth={2.5} />} label="Organisation" value={authUser.orgName ?? "—"} />
        <DetailRow icon={<GraduationCap size={17} strokeWidth={2.5} />} label="School level" value={authUser.schoolLevelName ?? "—"} />
        <DetailRow icon={<CalendarDays size={17} strokeWidth={2.5} />} label="Member since" value={memberSince(authUser.createdAt)} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit my details</DialogTitle>
            <DialogDescription>
              Friends see your username. Your name is only shown to you and your teachers.
            </DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5">
            <span className="text-sm font-bold text-foreground">Name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={60}
              className="pop-field w-full h-11 px-3.5 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-bold text-foreground">Username</span>
            <input
              value={username}
              onChange={(e) => USERNAME_PATTERN.test(e.target.value) && setUsername(e.target.value)}
              maxLength={20}
              aria-invalid={!usernameValid}
              className="pop-field w-full h-11 px-3.5 text-sm"
            />
            <span className={cn("block text-[11px] font-semibold", usernameValid ? "text-muted-foreground" : "text-destructive")}>
              3–20 letters, numbers or underscores. You'll sign in with the new one.
            </span>
          </label>
          <DialogFooter>
            <button onClick={() => setOpen(false)} className="btn-pop btn-pop-sm">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !usernameValid || !fullName.trim()}
              className="btn-pop btn-pop-sm btn-primary"
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
                "relative rounded-[1.4rem] overflow-hidden text-left transition-all border-[2.5px] border-ink",
                active
                  ? "shadow-[0_7px_0_var(--ink-line)] -translate-y-1.5 ring-4 ring-offset-2 ring-offset-card ring-[var(--primary)]"
                  : "shadow-[0_3px_0_var(--ink-line)] hover:-translate-y-1 hover:shadow-[0_5px_0_var(--ink-line)]",
                i % 2 ? "rotate-[1deg]" : "rotate-[-1deg]",
              )}
            >
              <div className="h-24 flex items-end justify-center bg-hero relative">
                <img src={t.bot} alt="" className="h-20 w-auto -mb-2 die-cut" />
              </div>
              <div className="flex items-center justify-between gap-1 px-3 py-2 bg-white border-t-[2.5px] border-ink">
                <p className="text-sm font-black text-[#1c1a17]">{t.name}</p>
                <span className="flex -space-x-1">
                  {t.swatch.map((c) => (
                    <span key={c} className="w-3.5 h-3.5 rounded-full border-[1.5px] border-[#1c1a17]" style={{ background: c }} />
                  ))}
                </span>
              </div>
              {active && (
                <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-pop-2 text-[#1c1a17] border-2 border-[#1c1a17] shadow-[0_2px_0_#1c1a17] flex items-center justify-center rotate-[-8deg]">
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
      <h2 className="font-display text-foreground !text-xl mb-1 flex items-center gap-2">
        <ShieldCheck size={20} className="text-primary" strokeWidth={2.5} /> Privacy &amp; account
      </h2>
      <p className="text-sm font-semibold text-muted-foreground mb-5">
        We keep your name, username, centre, school level, lesson progress, friends and chat messages so the Academy
        works. You can download a copy or delete everything at any time.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={download} className="btn-pop btn-pop-sm btn-pop3">
          <Download size={16} strokeWidth={2.5} /> Download my data
        </button>
        <button onClick={() => setStep("confirm")} className="btn-pop btn-pop-sm !bg-destructive !text-white">
          <Trash2 size={16} strokeWidth={2.5} /> Delete my account
        </button>
      </div>

      {/* Step 1: are you sure? Step 2: type your PIN. */}
      <AlertDialog open={step !== "closed"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <img src={stembotRed} alt="" className="h-24 w-24 object-contain mx-auto sm:mx-0 die-cut -rotate-6" />
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
              className="pop-field w-full h-14 px-3 text-center text-2xl font-bold tracking-[0.6em] focus-visible:!shadow-[0_0_0_4px_color-mix(in_srgb,var(--destructive)_30%,transparent),0_3px_0_var(--ink-line)]"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my account</AlertDialogCancel>
            {step === "confirm" ? (
              <button onClick={() => setStep("pin")} className="btn-pop btn-pop-sm !bg-destructive !text-white">
                Yes, delete it
              </button>
            ) : (
              <button
                onClick={doDelete}
                disabled={pin.length !== 4 || busy}
                className="btn-pop btn-pop-sm !bg-destructive !text-white"
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
