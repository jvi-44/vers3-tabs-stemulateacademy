import { useCallback, useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
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
import {
  fetchReferenceData,
  login as apiLogin,
  signup as apiSignup,
  verifyRecovery,
  resetPin,
} from "../api/auth";
import type { AuthUser, ReferenceData } from "../types-auth";

type View = "signin" | "signup" | "forgot";
type ForgotStep = "verify" | "reset";

const PIN_PATTERN = /^\d{0,4}$/;
const NAME_MAX = 80; // matches the server limit
const USERNAME_PATTERN = /^[A-Za-z0-9_]*$/;

export function LoginScreen({
  onLogin,
}: {
  onLogin: (user: AuthUser) => void;
}) {
  const [view, setView] = useState<View>("signin");
  const [refData, setRefData] = useState<ReferenceData | null>(null);
  const [loadError, setLoadError] = useState(false);

  const loadRefData = useCallback(() => {
    setLoadError(false);
    fetchReferenceData()
      .then(setRefData)
      .catch(() => {
        setLoadError(true);
        toast.error("Couldn't reach the server. Is the backend running?");
      });
  }, []);

  useEffect(() => {
    loadRefData();
  }, [loadRefData]);

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-gradient-to-br from-lime-100 via-yellow-50 to-lime-200">
      {/* Fills the entire viewport (not just one side) and slowly, continuously
          auto-scrolls sideways in a seamless loop. */}
      <StembotPattern className="opacity-25" />
      <div className="fixed inset-0 bg-gradient-to-br from-lime-100/40 via-yellow-50/30 to-lime-200/40 pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-t from-white/50 via-transparent to-white/30 pointer-events-none" />


      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 bg-white/95 backdrop-blur rounded-3xl p-8 md:p-10 w-full max-w-md shadow-2xl border-2 border-lime-200"
      >
        <div className="text-center mb-6">
          <img
            src={stemulateLogo}
            alt="STEMulate Academy"
            className="w-20 h-20 object-contain mx-auto mb-3"
          />
          <h2 className="text-3xl font-bold text-slate-900">STEMulate Academy</h2>
          <p className="text-slate-500">Your STEM journey awaits!</p>
        </div>

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
                loadError={loadError}
                onRetry={loadRefData}
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
              <ForgotPinForm
                refData={refData}
                loadError={loadError}
                onRetry={loadRefData}
                onDone={() => setView("signin")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
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
        <Label htmlFor="signin-username" className="text-sm font-bold text-slate-600 mb-2 block">
          Username
        </Label>
        <Input
          id="signin-username"
          value={username}
          onChange={(e) =>
            USERNAME_PATTERN.test(e.target.value) && setUsername(e.target.value)
          }
          placeholder="Enter your username"
          className="w-full px-4 py-4 h-auto rounded-2xl border-2 border-lime-200 focus-visible:border-lime-500 font-bold bg-lime-50/50"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </div>

      <div>
        <Label htmlFor="signin-pin" className="text-sm font-bold text-slate-600 mb-2 block">
          4-Digit PIN
        </Label>
        <Input
          id="signin-pin"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => PIN_PATTERN.test(e.target.value) && setPin(e.target.value)}
          placeholder="••••"
          maxLength={4}
          className="w-full px-4 py-4 h-auto rounded-2xl border-2 border-lime-200 focus-visible:border-lime-500 font-bold text-center text-2xl tracking-[1em] bg-lime-50/50"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </div>

      <button
        onClick={onForgot}
        className="text-sm text-lime-700 font-bold hover:underline block"
        type="button"
      >
        Forgot your PIN?
      </button>

      <Button
        disabled={!username.trim() || pin.length !== 4 || loading}
        onClick={handleSubmit}
        className="w-full py-4 h-auto bg-gradient-to-r from-lime-500 to-yellow-500 text-white rounded-2xl font-bold text-lg hover:from-lime-600 hover:to-yellow-600 shadow-lg disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign In"}
      </Button>

      <p className="text-center text-sm text-slate-500">
        Don't have an account?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="text-lime-700 font-bold hover:underline"
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
  loadError,
  onRetry,
  onLogin,
  onSwitch,
}: {
  refData: ReferenceData | null;
  loadError: boolean;
  onRetry: () => void;
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
  const [consent, setConsent] = useState(false);
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
    recoverySubjectId &&
    consent;

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
      // "Others": the typed centre name is saved on the account as text;
      // it no longer creates a new entry in everyone's dropdown.
      const { user } = await apiSignup({
        fullName: fullName.trim(),
        schoolLevelId: Number(schoolLevelId),
        ...(isOtherOrg ? { orgOther: customOrgName.trim() } : { orgId: Number(orgId) }),
        username: username.trim(),
        pin,
        recoveryColourId: Number(recoveryColourId),
        recoverySubjectId: Number(recoverySubjectId),
        consent,
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
    return loadError ? (
      <FormLoadError onRetry={onRetry} />
    ) : (
      <p className="text-center text-slate-500 py-8">Loading form...</p>
    );
  }

  return (
    <div className="space-y-4">
      <Field label="First Name" id="signup-first-name">
        <Input
          id="signup-first-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={NAME_MAX}
          placeholder="Your first name"
          className="rounded-xl border-2 border-lime-200 bg-lime-50/50 py-3 h-auto"
        />
      </Field>

      <Field label="Primary School Level" id="signup-level">
        <Select value={schoolLevelId} onValueChange={setSchoolLevelId}>
          <SelectTrigger id="signup-level" className="rounded-xl border-2 border-lime-200 bg-lime-50/50 h-11">
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

      <Field label="Organisation / Centre" id="signup-org">
        <Select value={orgId} onValueChange={setOrgId}>
          <SelectTrigger id="signup-org" className="rounded-xl border-2 border-lime-200 bg-lime-50/50 h-11">
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
            aria-label="Organisation name"
            value={customOrgName}
            onChange={(e) => setCustomOrgName(e.target.value)}
            maxLength={NAME_MAX}
            placeholder="Type your organisation's name"
            className="rounded-xl border-2 border-lime-200 bg-lime-50/50 py-3 h-auto mt-2"
          />
        )}
      </Field>

      <Field label="Username" id="signup-username">
        <Input
          id="signup-username"
          maxLength={32}
          value={username}
          onChange={(e) =>
            USERNAME_PATTERN.test(e.target.value) && setUsername(e.target.value)
          }
          placeholder="Letters, numbers, underscore only"
          className="rounded-xl border-2 border-lime-200 bg-lime-50/50 py-3 h-auto"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="4-Digit PIN" id="signup-pin">
          <Input
            id="signup-pin"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => PIN_PATTERN.test(e.target.value) && setPin(e.target.value)}
            maxLength={4}
            placeholder="••••"
            className="rounded-xl border-2 border-lime-200 bg-lime-50/50 py-3 h-auto text-center tracking-[0.5em]"
          />
        </Field>
        <Field label="Confirm PIN" id="signup-confirm-pin">
          <Input
            id="signup-confirm-pin"
            type="password"
            inputMode="numeric"
            value={confirmPin}
            onChange={(e) =>
              PIN_PATTERN.test(e.target.value) && setConfirmPin(e.target.value)
            }
            maxLength={4}
            placeholder="••••"
            className="rounded-xl border-2 border-lime-200 bg-lime-50/50 py-3 h-auto text-center tracking-[0.5em]"
          />
        </Field>
      </div>

      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide pt-2">
        Recovery Questions
      </p>
      <p className="text-xs text-slate-400 -mt-3">
        Used to reset your PIN if you forget it.
      </p>

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

      <p className="text-xs text-slate-500 pt-2">
        We save your first name, school level and centre so your teacher can see your progress.
      </p>
      <div className="flex items-start gap-2.5">
        <Checkbox
          id="signup-consent"
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          className="mt-0.5 border-lime-300"
        />
        <Label htmlFor="signup-consent" className="text-sm font-bold text-slate-600 leading-snug">
          My parent or teacher said I can join
        </Label>
      </div>

      <Button
        disabled={!canSubmit || loading}
        onClick={handleSubmit}
        className="w-full py-4 h-auto bg-gradient-to-r from-lime-500 to-yellow-500 text-white rounded-2xl font-bold text-lg hover:from-lime-600 hover:to-yellow-600 shadow-lg disabled:opacity-50 mt-2"
      >
        {loading ? "Creating account..." : "Create Account"}
      </Button>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="text-lime-700 font-bold hover:underline"
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
  loadError,
  onRetry,
  onDone,
}: {
  refData: ReferenceData | null;
  loadError: boolean;
  onRetry: () => void;
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
    return loadError ? (
      <FormLoadError onRetry={onRetry} />
    ) : (
      <p className="text-center text-slate-500 py-8">Loading...</p>
    );
  }

  return (
    <div className="space-y-5">
      {step === "verify" ? (
        <>
          <Field label="Username" id="forgot-username">
            <Input
              id="forgot-username"
              value={username}
              onChange={(e) =>
                USERNAME_PATTERN.test(e.target.value) && setUsername(e.target.value)
              }
              className="rounded-xl border-2 border-lime-200 bg-lime-50/50 py-3 h-auto"
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
            className="w-full py-4 h-auto bg-gradient-to-r from-lime-500 to-yellow-500 text-white rounded-2xl font-bold text-lg shadow-lg"
          >
            {loading ? "Checking..." : "Verify"}
          </Button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="New PIN" id="forgot-new-pin">
              <Input
                id="forgot-new-pin"
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => PIN_PATTERN.test(e.target.value) && setNewPin(e.target.value)}
                maxLength={4}
                className="rounded-xl border-2 border-lime-200 bg-lime-50/50 py-3 h-auto text-center tracking-[0.5em]"
              />
            </Field>
            <Field label="Confirm PIN" id="forgot-confirm-pin">
              <Input
                id="forgot-confirm-pin"
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) =>
                  PIN_PATTERN.test(e.target.value) && setConfirmPin(e.target.value)
                }
                maxLength={4}
                className="rounded-xl border-2 border-lime-200 bg-lime-50/50 py-3 h-auto text-center tracking-[0.5em]"
              />
            </Field>
          </div>
          <Button
            onClick={handleReset}
            disabled={loading}
            className="w-full py-4 h-auto bg-gradient-to-r from-lime-500 to-yellow-500 text-white rounded-2xl font-bold text-lg shadow-lg"
          >
            {loading ? "Saving..." : "Set New PIN"}
          </Button>
        </>
      )}

      <button
        type="button"
        onClick={onDone}
        className="text-sm text-slate-500 font-bold hover:underline block text-center w-full"
      >
        Back to Sign In
      </button>
    </div>
  );
}

/** `id` ties the label to its input (pass the same id to the input). */
function Field({ label, id, children }: { label: string; id?: string; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-bold text-slate-600 mb-1.5 block">
        {label}
      </Label>
      {children}
    </div>
  );
}

function FormLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-8 space-y-3">
      <p className="text-slate-500">Couldn't load the form.</p>
      <Button
        type="button"
        onClick={onRetry}
        className="px-6 py-3 h-auto bg-gradient-to-r from-lime-500 to-yellow-500 text-white rounded-2xl font-bold shadow-lg hover:from-lime-600 hover:to-yellow-600"
      >
        Retry
      </Button>
    </div>
  );
}
