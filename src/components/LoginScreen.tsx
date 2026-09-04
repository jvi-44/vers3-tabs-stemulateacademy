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
const USERNAME_PATTERN = /^[A-Za-z0-9_]*$/;

export function LoginScreen({
  onLogin,
}: {
  onLogin: (user: AuthUser) => void;
}) {
  const [view, setView] = useState<View>("signin");
  const [refData, setRefData] = useState<ReferenceData | null>(null);

  useEffect(() => {
    fetchReferenceData()
      .then(setRefData)
      .catch(() => toast.error("Couldn't reach the server. Is the backend running?"));
  }, []);

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
        <Label className="text-sm font-bold text-slate-600 mb-2 block">
          Username
        </Label>
        <Input
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
        <Label className="text-sm font-bold text-slate-600 mb-2 block">
          4-Digit PIN
        </Label>
        <Input
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
    return <p className="text-center text-slate-500 py-8">Loading form...</p>;
  }

  return (
    <div className="space-y-4">
      <Field label="Full Name">
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
          className="rounded-xl border-2 border-lime-200 bg-lime-50/50 py-3 h-auto"
        />
      </Field>

      <Field label="Primary School Level">
        <Select value={schoolLevelId} onValueChange={setSchoolLevelId}>
          <SelectTrigger className="rounded-xl border-2 border-lime-200 bg-lime-50/50 h-11">
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
          <SelectTrigger className="rounded-xl border-2 border-lime-200 bg-lime-50/50 h-11">
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
            className="rounded-xl border-2 border-lime-200 bg-lime-50/50 py-3 h-auto mt-2"
          />
        )}
      </Field>

      <Field label="Username">
        <Input
          value={username}
          onChange={(e) =>
            USERNAME_PATTERN.test(e.target.value) && setUsername(e.target.value)
          }
          placeholder="Letters, numbers, underscore only"
          className="rounded-xl border-2 border-lime-200 bg-lime-50/50 py-3 h-auto"
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
            className="rounded-xl border-2 border-lime-200 bg-lime-50/50 py-3 h-auto text-center tracking-[0.5em]"
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
    return <p className="text-center text-slate-500 py-8">Loading...</p>;
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
            <Field label="New PIN">
              <Input
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => PIN_PATTERN.test(e.target.value) && setNewPin(e.target.value)}
                maxLength={4}
                className="rounded-xl border-2 border-lime-200 bg-lime-50/50 py-3 h-auto text-center tracking-[0.5em]"
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="text-sm font-bold text-slate-600 mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
