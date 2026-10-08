import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

import { StembotPattern } from "./StembotPattern";
import { ColourBlockPicker, SubjectBlockPicker } from "./RecoveryPicker";
import stemulateLogo from "../assets/stemulate_logo.png";
import stembotBlue from "../assets/stembot_blue.png";
import stembotRed from "../assets/stembot_red.png";
import stembotGreen from "../assets/stembot_green.png";
import stembotCream from "../assets/stembot_cream.png";
import {
  fetchReferenceData,
  login as apiLogin,
  signup as apiSignup,
  verifyRecovery,
  resetPin,
  createOrganisation,
} from "../api/auth";
import type { AuthUser, ReferenceData } from "../types-auth";

type View = "signin" | "signup" | "forgot";
type ForgotStep = "verify" | "reset";

const PIN_PATTERN = /^\d{0,4}$/;

// The login page keeps the website's fixed forest palette whatever colour
// theme or dark mode is saved, so fields and buttons pin their colours here.
const FIELD =
  "!border-[#1b2e1c] !bg-[#fffdf3] !text-[#1b2e1c] placeholder:!text-[#4e5f50]/60 !rounded-2xl focus-visible:!bg-white focus-visible:!shadow-[0_0_0_4px_rgba(124,194,66,0.5),0_3px_0_#1b2e1c] data-[state=open]:!shadow-[0_0_0_4px_rgba(124,194,66,0.5),0_3px_0_#1b2e1c]";
const BIG_BUTTON =
  "w-full !py-4 h-auto text-lg !bg-[#7cc242] hover:!bg-[#8fd152] !text-[#1b2e1c] !border-[#1b2e1c] shadow-[0_4px_0_#1b2e1c] hover:shadow-[0_6px_0_#1b2e1c] active:shadow-[0_1px_0_#1b2e1c]";
const USERNAME_PATTERN = /^[A-Za-z0-9_]*$/;

export function LoginScreen({
  onLogin,
  onGuest,
  initialView = "signin",
}: {
  onLogin: (user: AuthUser) => void;
  /** Look around without an account. Nothing is saved. */
  onGuest: () => void;
  initialView?: "signin" | "signup";
}) {
  const [view, setView] = useState<View>(initialView);
  const [refData, setRefData] = useState<ReferenceData | null>(null);

  useEffect(() => {
    fetchReferenceData()
      .then(setRefData)
      .catch(() => toast.error("Couldn't reach the server. Is the backend running?"));
  }, []);

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 py-10 bg-[#fffbea] text-[#1b2e1c] overflow-hidden">
      {/* Same drifting STEMbot pattern as the website's hero */}
      <StembotPattern className="opacity-[0.22]" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(60%_70%_at_50%_50%,rgba(255,251,234,0.92)_30%,rgba(255,251,234,0.35)_80%)]" />

      <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
        {/* Website-style welcome, desktop only */}
        <div className="hidden lg:block">
          <span className="kicker !bg-[#c6ef72] !text-[#1e4a24]">Project STEMulate</span>
          <h1 className="font-display !text-[3.6rem] !leading-[1.02] mt-5 mb-5">
            Learn, play and <span className="mark-pop !bg-[#7c4dff]">collect</span> with the{" "}
            <span className="mark-pop mark-pop-2 !bg-[#c6ef72]">STEMbots!</span>
          </h1>
          <p className="text-lg font-semibold text-[#4e5f50] max-w-md mb-8">
            Story lessons, Minecraft-style games and card albums to fill, made for curious primary schoolers.
          </p>
          <div className="flex items-end gap-1">
            {[stembotGreen, stembotBlue, stembotCream, stembotRed].map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className="h-28 die-cut bob"
                style={{ animationDelay: `${-i * 1.2}s`, rotate: `${[-8, 5, -4, 9][i]}deg` }}
              />
            ))}
          </div>
        </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white rounded-[2rem] p-8 md:p-10 w-full max-w-md mx-auto border-[3px] border-[#1b2e1c] shadow-[0_8px_0_#1b2e1c]"
      >
        <div className="text-center mb-6">
          <img
            src={stemulateLogo}
            alt="STEMulate Academy"
            className="w-20 h-20 object-contain mx-auto mb-3"
          />
          <h2 className="font-display !text-3xl text-[#1b2e1c]">
            STEMulate <span className="text-[#4f9a26]">Academy</span>
          </h2>
          <p className="text-[#4e5f50] font-semibold">Your STEM adventure awaits!</p>
        </div>

        {view === "forgot" ? (
          <div className="flex justify-center mb-6">
            <span className="kicker !bg-[#ffe1f0] !text-[#9d174d] border-2 border-[#1b2e1c] !text-[0.75rem]">
              Forgot your PIN? Let's fix it
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1 p-1 mb-6 rounded-full bg-[#eaf8d8] border-[2.5px] border-[#1b2e1c] shadow-[0_3px_0_#1b2e1c]">
            {(
              [
                ["signin", "Sign in"],
                ["signup", "New here? Join"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-pressed={view === id}
                className={
                  "font-display font-semibold text-sm py-2 rounded-full border-2 transition-all " +
                  (view === id
                    ? "bg-[#7c4dff] text-white border-[#1b2e1c] shadow-[0_2px_0_#1b2e1c] -rotate-[1.5deg]"
                    : "border-transparent text-[#4e5f50] hover:text-[#1b2e1c]")
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === "signin" && (
            <motion.div
              key="signin"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
            >
              <SignInForm
                onLogin={onLogin}
                onForgot={() => setView("forgot")}
                onSwitch={() => setView("signup")}
              />
            </motion.div>
          )}

          {view === "signup" && (
            <motion.div
              key="signup"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
            >
              <SignUpForm
                refData={refData}
                onLogin={onLogin}
                onSwitch={() => setView("signin")}
              />
            </motion.div>
          )}

          {view === "forgot" && (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
            >
              <ForgotPinForm refData={refData} onDone={() => setView("signin")} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 pt-5 border-t-2 border-dashed border-[#1b2e1c]/10 text-center">
          <button
            onClick={onGuest}
            className="w-full py-3 rounded-full border-2 border-dashed border-[#7c4dff]/50 text-[#5a2fd8] font-display font-semibold hover:bg-[#efe7ff] transition-colors"
          >
            Just looking? Continue as guest
          </button>
          <p className="text-xs text-[#4e5f50]/80 mt-2">
            Guests can explore lessons and games, but progress isn't saved and the leaderboard and chat are
            for members only.
          </p>
        </div>
      </motion.div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// Sign in
// ---------------------------------------------------------
function SignInForm({
  onLogin,
  onForgot,
  onSwitch,
}: {
  onLogin: (user: AuthUser) => void;
  onForgot: () => void;
  onSwitch: () => void;
}) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || pin.length !== 4) {
      toast.error("Please enter your username and 4-digit PIN.");
      return;
    }
    setLoading(true);
    try {
      const { user } = await apiLogin(username.trim(), pin);
      toast.success(`Welcome back, ${user.fullName.split(" ")[0]}!`);
      onLogin(user);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-bold text-[#1b2e1c] mb-2 block">
          Username
        </Label>
        <Input
          value={username}
          onChange={(e) =>
            USERNAME_PATTERN.test(e.target.value) && setUsername(e.target.value)
          }
          placeholder="Enter your username"
          className={`${FIELD} w-full px-4 py-4 h-auto font-bold`}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </div>

      <div>
        <Label className="text-sm font-bold text-[#1b2e1c] mb-2 block">
          4-Digit PIN
        </Label>
        <Input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => PIN_PATTERN.test(e.target.value) && setPin(e.target.value)}
          placeholder="••••"
          maxLength={4}
          className={`${FIELD} w-full px-4 py-4 h-auto font-bold text-center text-2xl tracking-[1em]`}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </div>

      <button
        onClick={onForgot}
        className="text-sm text-[#5a2fd8] font-bold hover:underline block"
        type="button"
      >
        Forgot your PIN?
      </button>

      <Button
        disabled={!username.trim() || pin.length !== 4 || loading}
        onClick={handleSubmit}
        className={BIG_BUTTON}
      >
        {loading ? "Signing in..." : "Sign In"}
      </Button>

      <p className="text-center text-sm text-[#4e5f50]">
        Don't have an account?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="text-[#5a2fd8] font-bold hover:underline"
        >
          Create One
        </button>
      </p>
    </div>
  );
}

// ---------------------------------------------------------
// Sign up
// ---------------------------------------------------------
function SignUpForm({
  refData,
  onLogin,
  onSwitch,
}: {
  refData: ReferenceData | null;
  onLogin: (user: AuthUser) => void;
  onSwitch: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [schoolLevelId, setSchoolLevelId] = useState<string>("");
  const [orgId, setOrgId] = useState<string>("");
  const [customOrgName, setCustomOrgName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [recoveryColourId, setRecoveryColourId] = useState<string>("");
  const [recoverySubjectId, setRecoverySubjectId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const isOtherOrg = orgId === "OTHER";

  const canSubmit =
    fullName.trim() &&
    schoolLevelId &&
    orgId &&
    (!isOtherOrg || customOrgName.trim()) &&
    username.trim() &&
    pin.length === 4 &&
    pin === confirmPin &&
    recoveryColourId &&
    recoverySubjectId;

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (pin.length === 4 && pin !== confirmPin) {
        toast.error("PINs don't match.");
      } else {
        toast.error("Please complete every field.");
      }
      return;
    }
    setLoading(true);
    try {
      let resolvedOrgId = Number(orgId);
      if (isOtherOrg) {
        const { organisation } = await createOrganisation(customOrgName.trim());
        resolvedOrgId = organisation.id;
      }
      const { user } = await apiSignup({
        fullName: fullName.trim(),
        schoolLevelId: Number(schoolLevelId),
        orgId: resolvedOrgId,
        username: username.trim(),
        pin,
        recoveryColourId: Number(recoveryColourId),
        recoverySubjectId: Number(recoverySubjectId),
      });
      toast.success(`Welcome to STEMulate Academy, ${user.fullName.split(" ")[0]}!`);
      onLogin(user);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!refData) {
    return <LoadingBlock text="Loading form..." />;
  }

  return (
    <div className="space-y-4">
      <Field label="Full Name">
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
          className={`${FIELD} py-3 h-auto`}
        />
      </Field>

      <Field label="Primary School Level">
        <Select value={schoolLevelId} onValueChange={setSchoolLevelId}>
          <SelectTrigger className={`${FIELD} h-11 [&>span:last-child]:!bg-[#c6ef72] [&>span:last-child]:!text-[#1b2e1c] [&>span:last-child]:!border-[#1b2e1c]`}>
            <SelectValue placeholder="Select your level" />
          </SelectTrigger>
          <SelectContent>
            {refData.schoolLevels.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Organisation / Centre">
        <Select value={orgId} onValueChange={setOrgId}>
          <SelectTrigger className={`${FIELD} h-11 [&>span:last-child]:!bg-[#c6ef72] [&>span:last-child]:!text-[#1b2e1c] [&>span:last-child]:!border-[#1b2e1c]`}>
            <SelectValue placeholder="Select your organisation" />
          </SelectTrigger>
          <SelectContent>
            {refData.organisations.map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>
                {o.name}
              </SelectItem>
            ))}
            <SelectItem value="OTHER">Others (please specify)</SelectItem>
          </SelectContent>
        </Select>
        {isOtherOrg && (
          <Input
            value={customOrgName}
            onChange={(e) => setCustomOrgName(e.target.value)}
            placeholder="Type your organisation's name"
            className={`${FIELD} py-3 h-auto mt-2`}
          />
        )}
      </Field>

      <Field label="Username">
        <Input
          value={username}
          onChange={(e) =>
            USERNAME_PATTERN.test(e.target.value) && setUsername(e.target.value)
          }
          placeholder="3–20 letters, numbers or _"
          maxLength={20}
          className={`${FIELD} py-3 h-auto`}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="4-Digit PIN">
          <Input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => PIN_PATTERN.test(e.target.value) && setPin(e.target.value)}
            maxLength={4}
            placeholder="••••"
            className={`${FIELD} py-3 h-auto text-center tracking-[0.5em]`}
          />
        </Field>
        <Field label="Confirm PIN">
          <Input
            type="password"
            inputMode="numeric"
            value={confirmPin}
            onChange={(e) =>
              PIN_PATTERN.test(e.target.value) && setConfirmPin(e.target.value)
            }
            maxLength={4}
            placeholder="••••"
            className={`${FIELD} py-3 h-auto text-center tracking-[0.5em]`}
          />
        </Field>
      </div>

      <div className="pt-3 mt-1 border-t-2 border-dashed border-[#1b2e1c]/15">
        <span className="kicker !bg-[#efe7ff] !text-[#5a2fd8] border-2 border-[#1b2e1c]">
          Recovery questions
        </span>
        <p className="text-xs font-semibold text-[#4e5f50] mt-2">
          Used to reset your PIN if you forget it. Pick ones you'll remember!
        </p>
      </div>

      <Field label="Favourite Colour">
        <ColourBlockPicker
          options={refData.recoveryColours}
          value={recoveryColourId}
          onChange={setRecoveryColourId}
        />
      </Field>

      <Field label="Favourite Subject">
        <SubjectBlockPicker
          options={refData.recoverySubjects}
          value={recoverySubjectId}
          onChange={setRecoverySubjectId}
        />
      </Field>

      <Button
        disabled={!canSubmit || loading}
        onClick={handleSubmit}
        className={BIG_BUTTON}
      >
        {loading ? "Creating account..." : "Create Account"}
      </Button>

      <p className="text-center text-sm text-[#4e5f50]">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="text-[#5a2fd8] font-bold hover:underline"
        >
          Sign In
        </button>
      </p>
    </div>
  );
}

// ---------------------------------------------------------
// Forgot PIN
// ---------------------------------------------------------
function ForgotPinForm({
  refData,
  onDone,
}: {
  refData: ReferenceData | null;
  onDone: () => void;
}) {
  const [step, setStep] = useState<ForgotStep>("verify");
  const [username, setUsername] = useState("");
  const [recoveryColourId, setRecoveryColourId] = useState<string>("");
  const [recoverySubjectId, setRecoverySubjectId] = useState<string>("");
  const [resetToken, setResetToken] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!username.trim() || !recoveryColourId || !recoverySubjectId) {
      toast.error("Please complete all fields.");
      return;
    }
    setLoading(true);
    try {
      const { resetToken } = await verifyRecovery(
        username.trim(),
        Number(recoveryColourId),
        Number(recoverySubjectId),
      );
      setResetToken(resetToken);
      setStep("reset");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (newPin.length !== 4 || newPin !== confirmPin) {
      toast.error("Enter matching 4-digit PINs.");
      return;
    }
    setLoading(true);
    try {
      await resetPin(username.trim(), resetToken, newPin);
      toast.success("PIN updated! You can sign in now.");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!refData) {
    return <LoadingBlock text="Loading..." />;
  }

  return (
    <div className="space-y-5">
      {step === "verify" ? (
        <>
          <Field label="Username">
            <Input
              value={username}
              onChange={(e) =>
                USERNAME_PATTERN.test(e.target.value) && setUsername(e.target.value)
              }
              className={`${FIELD} py-3 h-auto`}
            />
          </Field>
          <Field label="Favourite Colour">
            <ColourBlockPicker
              options={refData.recoveryColours}
              value={recoveryColourId}
              onChange={setRecoveryColourId}
            />
          </Field>
          <Field label="Favourite Subject">
            <SubjectBlockPicker
              options={refData.recoverySubjects}
              value={recoverySubjectId}
              onChange={setRecoverySubjectId}
            />
          </Field>
          <Button
            onClick={handleVerify}
            disabled={loading}
            className={BIG_BUTTON}
          >
            {loading ? "Checking..." : "Verify"}
          </Button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="New PIN">
              <Input
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => PIN_PATTERN.test(e.target.value) && setNewPin(e.target.value)}
                maxLength={4}
                className={`${FIELD} py-3 h-auto text-center tracking-[0.5em]`}
              />
            </Field>
            <Field label="Confirm PIN">
              <Input
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) =>
                  PIN_PATTERN.test(e.target.value) && setConfirmPin(e.target.value)
                }
                maxLength={4}
                className={`${FIELD} py-3 h-auto text-center tracking-[0.5em]`}
              />
            </Field>
          </div>
          <Button
            onClick={handleReset}
            disabled={loading}
            className={BIG_BUTTON}
          >
            {loading ? "Saving..." : "Set New PIN"}
          </Button>
        </>
      )}

      <button
        type="button"
        onClick={onDone}
        className="text-sm text-[#4e5f50] font-bold hover:underline block text-center w-full"
      >
        Back to Sign In
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="text-sm font-bold text-[#1b2e1c] mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

function LoadingBlock({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <img src={stembotCream} alt="" className="h-16 die-cut bob" />
      <p className="font-display font-semibold text-[#4e5f50]">{text}</p>
    </div>
  );
}
