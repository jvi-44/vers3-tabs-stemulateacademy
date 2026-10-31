// Admin page → Centres & passkeys: each centre has one passkey, shared by its
// staff, to sign in on the staff page (/#/staff) and follow that centre's
// students. The passkey is shown once when it's set (only a hash is kept), so
// to share it again, set a new one: that signs everyone out with the old one.
import { useEffect, useState } from "react";
import { Copy, KeyRound, Plus, PowerOff } from "lucide-react";
import { toast } from "sonner";
import {
  adminAddCentre,
  adminCentres,
  adminSetCentrePasskey,
  adminTurnOffCentrePasskey,
  PASSKEY_MIN,
  type AdminCentre,
} from "../../api/admin";
import { Modal, shortDate, useBusy } from "./shared";
import stembotBlue from "../../assets/stembot_blue.png";
import stembotGreen from "../../assets/stembot_green.png";
import stembotRed from "../../assets/stembot_red.png";

export function CentrePasskeys({ token, onError }: { token: string; onError: (e: unknown) => void }) {
  const [centres, setCentres] = useState<AdminCentre[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [setting, setSetting] = useState<AdminCentre | null>(null);
  const [shown, setShown] = useState<{ centre: AdminCentre; passkey: string } | null>(null);
  const [turningOff, setTurningOff] = useState<AdminCentre | null>(null);

  const load = () =>
    adminCentres(token)
      .then((r) => setCentres(r.centres))
      .catch(onError);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <section className="admin-card overflow-hidden" aria-label="Centres and passkeys">
      <div className="p-4 sm:p-5 border-b-[2.5px] border-ink bg-soft-1/60 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display">Centres &amp; passkeys</h2>
          <p className="text-sm font-semibold text-muted-foreground">
            A centre's staff sign in at <code className="font-bold">/#/staff</code> with its passkey and see only its students.
          </p>
        </div>
        <button onClick={() => setAdding(true)} className="btn-pop btn-primary">
          <Plus size={17} strokeWidth={2.6} /> Add a centre
        </button>
      </div>

      {centres === null ? (
        <p className="p-10 text-center font-bold text-muted-foreground">Loading centres…</p>
      ) : (
        <ul className="divide-y-2 divide-ink/10">
          {centres.map((c) => (
            <li key={c.id} className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold truncate">
                  {c.name}{" "}
                  <span className="chip-ink text-[11px] ml-1 align-middle">
                    {c.hasPasskey ? "Passkey on" : "No passkey"}
                  </span>
                </p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {c.students} student{c.students === 1 ? "" : "s"} ·{" "}
                  {c.hasPasskey ? `passkey set ${shortDate(c.passkeySetAt)}` : "staff can't sign in yet"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSetting(c)} className="btn-pop btn-pop-sm">
                  <KeyRound size={15} strokeWidth={2.6} /> {c.hasPasskey ? "Change passkey" : "Set passkey"}
                </button>
                {c.hasPasskey && (
                  <button onClick={() => setTurningOff(c)} className="btn-pop btn-pop-sm" aria-label={`Turn off the passkey for ${c.name}`}>
                    <PowerOff size={15} strokeWidth={2.6} /> Turn off
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddCentre
        key={adding ? "add-open" : "add-closed"}
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={async (name) => {
          try {
            const { centre } = await adminAddCentre(token, name);
            setCentres((list) => [...(list ?? []), centre]);
            setAdding(false);
            toast.success(`${centre.name} is on the list. Set its passkey so its staff can sign in.`);
          } catch (e) {
            onError(e);
          }
        }}
      />
      <SetPasskey
        key={setting ? `set-${setting.id}` : "set-closed"}
        centre={setting}
        onClose={() => setSetting(null)}
        onSet={async (typed) => {
          if (!setting) return;
          try {
            const { passkey } = await adminSetCentrePasskey(token, setting.id, typed || undefined);
            setShown({ centre: setting, passkey });
            setSetting(null);
            load();
          } catch (e) {
            onError(e);
          }
        }}
      />
      <ShowPasskey shown={shown} onClose={() => setShown(null)} />
      <TurnOff
        centre={turningOff}
        onClose={() => setTurningOff(null)}
        onConfirm={async () => {
          if (!turningOff) return;
          try {
            await adminTurnOffCentrePasskey(token, turningOff.id);
            toast.success(`${turningOff.name}'s staff can't sign in now.`);
            setTurningOff(null);
            load();
          } catch (e) {
            onError(e);
          }
        }}
      />
    </section>
  );
}

function AddCentre({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, run] = useBusy();
  return (
    <Modal open={open} onClose={onClose} bot={stembotBlue} title="Add a centre">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void run(() => onAdd(name.trim()));
        }}
      >
        <p className="text-sm font-semibold text-muted-foreground text-center mb-3">Students can pick it when they sign up.</p>
        <label htmlFor="centre-name" className="block text-sm font-bold mb-1">
          Centre's name
        </label>
        <input id="centre-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="ink-input mb-4" autoFocus />
        <div className="flex gap-2.5">
          <button type="button" onClick={onClose} className="btn-pop flex-1">
            Cancel
          </button>
          <button type="submit" disabled={!name.trim() || busy} className="btn-pop btn-primary flex-1">
            <Plus size={16} strokeWidth={2.6} /> Add
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SetPasskey({ centre, onClose, onSet }: { centre: AdminCentre | null; onClose: () => void; onSet: (typed: string) => Promise<void> }) {
  const [typed, setTyped] = useState("");
  const [busy, run] = useBusy();
  const tooShort = typed.length > 0 && typed.length < PASSKEY_MIN;
  return (
    <Modal open={!!centre} onClose={onClose} bot={stembotGreen} title={`Passkey for ${centre?.name ?? ""}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!tooShort) void run(() => onSet(typed.trim()));
        }}
      >
        <p className="text-sm font-semibold text-muted-foreground text-center mb-3">
          {centre?.hasPasskey
            ? "A new passkey signs out everyone using the old one."
            : "Its staff share this passkey to sign in on the staff page."}
        </p>
        <label htmlFor="centre-passkey" className="block text-sm font-bold mb-1">
          Type one, or leave it empty for a random one
        </label>
        <input
          id="centre-passkey"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={tooShort}
          aria-describedby="centre-passkey-rule"
          className="ink-input mb-1"
          autoFocus
        />
        <p id="centre-passkey-rule" className="text-xs font-semibold text-muted-foreground mb-4">
          At least {PASSKEY_MIN} characters.
        </p>
        <div className="flex gap-2.5">
          <button type="button" onClick={onClose} className="btn-pop flex-1">
            Cancel
          </button>
          <button type="submit" disabled={tooShort || busy} className="btn-pop btn-primary flex-1">
            <KeyRound size={16} strokeWidth={2.6} /> {typed ? "Use this" : "Make one"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ShowPasskey({ shown, onClose }: { shown: { centre: AdminCentre; passkey: string } | null; onClose: () => void }) {
  return (
    <Modal open={!!shown} onClose={onClose} bot={stembotGreen} title={`${shown?.centre.name ?? ""}'s passkey`}>
      {shown && (
        <>
          <p className="text-sm font-semibold text-muted-foreground text-center mb-3">
            Give this to the centre's staff only. It isn't shown again: to share it later, set a new one.
          </p>
          <input
            readOnly
            value={shown.passkey}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Passkey"
            className="ink-input font-mono text-center text-lg mb-4"
          />
          <div className="flex gap-2.5">
            <button onClick={onClose} className="btn-pop flex-1">
              Done
            </button>
            <button
              onClick={() =>
                navigator.clipboard
                  .writeText(shown.passkey)
                  .then(() => toast.success("Passkey copied."))
                  .catch(() => toast.error("Couldn't copy. Select the passkey and copy it."))
              }
              className="btn-pop btn-primary flex-1"
            >
              <Copy size={16} strokeWidth={2.6} /> Copy
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function TurnOff({ centre, onClose, onConfirm }: { centre: AdminCentre | null; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, run] = useBusy();
  return (
    <Modal open={!!centre} onClose={onClose} bot={stembotRed} title={`Turn off ${centre?.name ?? ""}'s passkey?`}>
      <p className="text-sm font-semibold text-muted-foreground text-center mb-5">
        Its staff are signed out and can't sign in until you set a new passkey.
      </p>
      <div className="flex gap-2.5">
        <button onClick={onClose} className="btn-pop flex-1">
          Cancel
        </button>
        <button onClick={() => run(onConfirm)} disabled={busy} className="btn-pop btn-danger flex-1">
          <PowerOff size={16} strokeWidth={2.6} /> Turn off
        </button>
      </div>
    </Modal>
  );
}
