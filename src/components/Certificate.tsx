// Certificate of completion for a whole module, with a customise panel
// (colours, STEMbot buddies, border pattern, display name), print and PNG
// download. Choices are saved per module in localStorage.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import { X, Printer, Download, Lock, RotateCcw, Check, Loader2, Sparkles, Palette, Bot, Shapes, PenLine } from "lucide-react";
import { CertificateArt } from "./CertificateArt";
import { downloadCertificatePng, embeddedFontCss, toDataUrl } from "./certificateExport";
import {
  CERT_BOTS,
  CERT_PALETTES,
  CERT_PATTERNS,
  MAX_BOTS,
  type CertBotId,
  type CertChoices,
  type CertPatternId,
  clearChoices,
  defaultChoices,
  formatCertDate,
  loadChoices,
  paletteById,
  saveChoices,
  seeded,
  starPath,
} from "./certificateKit";
import stemulateLogo from "../assets/stemulate_logo.png";
import { cn } from "./ui/utils";
import "../styles/certificate.css";

export type { CertificateModule } from "./certificateKit";
import type { CertificateModule } from "./certificateKit";

export type CertificateProps = {
  /** Short name (e.g. first name / username) used when no full name is set. */
  studentName: string;
  /** Preferred default for the name printed on the certificate. */
  fullName?: string;
  module: CertificateModule;
  /** ISO date the module was finished. null/undefined = not earned yet (preview). */
  completedAt?: string | null;
  onClose: () => void;
};

export function Certificate({ studentName, fullName, module, completedAt, onClose }: CertificateProps) {
  const [choices, setChoices] = useState<CertChoices>(() => loadChoices(module.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const earned = !!completedAt;
  const dateText = formatCertDate(completedAt);
  const defaultName = (fullName?.trim() || studentName.trim() || "Super Scientist").slice(0, 40);
  const name = choices.name ?? defaultName;
  const palette = paletteById(choices.palette);

  // Reload saved choices if the module changes while open.
  useEffect(() => {
    setChoices(loadChoices(module.id));
  }, [module.id]);

  const update = (patch: Partial<CertChoices>) => {
    setChoices((prev) => {
      const next = { ...prev, ...patch };
      saveChoices(module.id, next);
      return next;
    });
  };

  // Close on Escape, lock page scroll, warm up the PNG export.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (earned) {
      embeddedFontCss();
      [stemulateLogo, ...CERT_BOTS.map((b) => b.src)].forEach((u) => toDataUrl(new URL(u, location.href).href).catch(() => undefined));
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, earned]);

  // Celebrate when an earned certificate opens.
  useEffect(() => {
    if (!earned) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const colors = [palette.primary, palette.pop2, palette.pop3, "#ffffff"];
    const t = setTimeout(() => {
      confetti({ particleCount: 90, spread: 70, startVelocity: 45, origin: { x: 0.2, y: 0.7 }, angle: 60, colors, zIndex: 200 });
      confetti({ particleCount: 90, spread: 70, startVelocity: 45, origin: { x: 0.8, y: 0.7 }, angle: 120, colors, zIndex: 200 });
    }, 250);
    return () => clearTimeout(t);
    // Only once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earned, module.id]);

  const toggleBot = (id: CertBotId) => {
    const has = choices.bots.includes(id);
    let bots = has ? choices.bots.filter((b) => b !== id) : [...choices.bots, id];
    if (bots.length > MAX_BOTS) bots = bots.slice(bots.length - MAX_BOTS);
    update({ bots });
  };

  const fileName = useMemo(() => {
    const slug = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    return `stemulate-certificate-${slug(module.name) || "module"}-${slug(name) || "student"}.png`;
  }, [module.name, name]);

  const onDownload = async () => {
    if (!svgRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      await downloadCertificatePng(svgRef.current, fileName);
    } catch (e) {
      console.error(e);
      setError("Sorry, the picture could not be made. Try Print → Save as PDF instead.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    clearChoices(module.id);
    setChoices(defaultChoices(module.id));
  };

  return createPortal(
    <div className="cert-portal" role="dialog" aria-modal="true" aria-label={`${module.name} certificate`}>
      <div className="cert-backdrop cert-noprint" onClick={onClose} />
      <motion.div
        className="cert-sheet bg-playful"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        {/* Header */}
        <div className="cert-noprint flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <span className={cn("kicker", !earned && "kicker-3")}>
              {earned ? (
                <>
                  <Sparkles size={12} /> You earned it
                </>
              ) : (
                <>
                  <Lock size={12} /> Sneak peek
                </>
              )}
            </span>
            <h2 className="font-display text-foreground !text-2xl mt-2 flex items-center gap-2">
              {module.emoji && <span aria-hidden>{module.emoji}</span>}
              {module.name} certificate
            </h2>
            <p className="text-sm text-muted-foreground font-semibold">
              {earned
                ? "You did it! Make it yours, then print it or save it as a picture."
                : "Design it now. It unlocks when you finish every lesson in this module."}
            </p>
          </div>
          <button onClick={onClose} className="btn-pop btn-pop-sm !p-2 shrink-0" aria-label="Close certificate">
            <X size={20} />
          </button>
        </div>

        <div className="cert-layout">
          {/* Certificate + actions */}
          <div className="min-w-0">
            <motion.div
              key={earned ? "earned" : "locked"}
              className="cert-print-target"
              initial={{ rotate: -2, scale: 0.94 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.08 }}
            >
              <CertificateArt
                ref={svgRef}
                className="cert-svg"
                name={name}
                moduleName={module.name}
                moduleId={module.id}
                lessons={module.lessons}
                dateText={dateText}
                palette={palette}
                bots={choices.bots}
                pattern={choices.pattern}
                locked={!earned}
              />
            </motion.div>

            <div className="cert-noprint mt-5 flex flex-wrap items-center gap-3">
              <button className="btn-pop btn-primary" onClick={onDownload} disabled={!earned || busy}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                {busy ? "Making picture…" : "Download PNG"}
              </button>
              <button className="btn-pop" onClick={() => window.print()} disabled={!earned}>
                <Printer size={18} /> Print / PDF
              </button>
              {!earned && (
                <span className="chip-ink text-sm">
                  <Lock size={14} /> Finish all {module.lessons.length} lessons to unlock
                </span>
              )}
              {error && <p className="text-sm font-bold text-destructive w-full">{error}</p>}
            </div>
          </div>

          {/* Customise panel */}
          <aside className="cert-noprint sticker p-5 flex flex-col gap-5 self-start">
            <div className="flex items-center justify-between">
              <h3 className="font-display !text-lg text-foreground">Make it yours</h3>
              <button
                onClick={reset}
                className="text-xs font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>

            <Section icon={<PenLine size={14} />} title="Name on certificate">
              <input
                value={name}
                maxLength={40}
                onChange={(e) => update({ name: e.target.value })}
                onBlur={() => {
                  if (!name.trim()) update({ name: undefined });
                }}
                className="w-full rounded-2xl border-[2.5px] border-ink bg-input-background px-3 py-2 font-display font-semibold text-foreground outline-none focus:ring-4 focus:ring-ring/30"
                aria-label="Name on certificate"
              />
            </Section>

            <Section icon={<Palette size={14} />} title="Colours">
              <div className="grid grid-cols-5 gap-2">
                {CERT_PALETTES.map((pal) => {
                  const on = pal.id === choices.palette;
                  return (
                    <button
                      key={pal.id}
                      onClick={() => update({ palette: pal.id })}
                      className={cn("cert-swatch", on && "is-on")}
                      style={{ background: pal.primary }}
                      aria-pressed={on}
                      title={pal.name}
                    >
                      <span className="cert-swatch-dots">
                        <i style={{ background: pal.pop2 }} />
                        <i style={{ background: pal.pop3 }} />
                      </span>
                      {on && (
                        <span className="cert-swatch-tick">
                          <Check size={11} strokeWidth={4} />
                        </span>
                      )}
                      <span className="sr-only">{pal.name}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground font-bold mt-1.5">{palette.name}</p>
            </Section>

            <Section icon={<Bot size={14} />} title={`STEMbot buddies (up to ${MAX_BOTS})`}>
              <div className="grid grid-cols-4 gap-2">
                {CERT_BOTS.map((b) => {
                  const on = choices.bots.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      onClick={() => toggleBot(b.id)}
                      className={cn("cert-bot", on && "is-on")}
                      aria-pressed={on}
                    >
                      <img src={b.src} alt="" className="w-full aspect-square object-contain" />
                      <span className="text-[11px] font-display font-semibold leading-none">{b.name}</span>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section icon={<Shapes size={14} />} title="Border pattern">
              <div className="grid grid-cols-2 gap-2">
                {CERT_PATTERNS.map((pt) => {
                  const on = pt.id === choices.pattern;
                  return (
                    <button
                      key={pt.id}
                      onClick={() => update({ pattern: pt.id })}
                      className={cn("cert-pattern", on && "is-on")}
                      aria-pressed={on}
                    >
                      <PatternIcon kind={pt.id} colours={[palette.primary, palette.pop2, palette.pop3]} ink={palette.ink} />
                      <span>{pt.name}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
          </aside>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground mb-2 flex items-center gap-1.5">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function PatternIcon({ kind, colours, ink }: { kind: CertPatternId; colours: string[]; ink: string }) {
  const rnd = seeded(kind);
  return (
    <svg viewBox="0 0 40 28" className="w-10 h-7 shrink-0" aria-hidden>
      {kind === "stars" && (
        <>
          <path d={starPath(11, 12, 8)} fill={colours[0]} stroke={ink} strokeWidth={1.2} strokeLinejoin="round" />
          <path d={starPath(28, 17, 6)} fill={colours[2]} stroke={ink} strokeWidth={1.2} strokeLinejoin="round" />
          <path d={starPath(31, 5, 3.5)} fill={colours[1]} />
        </>
      )}
      {kind === "confetti" &&
        Array.from({ length: 9 }, (_, i) => (
          <rect
            key={i}
            x={4 + rnd() * 30}
            y={3 + rnd() * 20}
            width={6}
            height={3}
            rx={1}
            fill={colours[i % 3]}
            transform={`rotate(${rnd() * 180} ${8 + i * 3} 14)`}
          />
        ))}
      {kind === "waves" &&
        [7, 14, 21].map((y, i) => (
          <path key={y} d={`M2,${y} q4.5,-5 9,0 t9,0 t9,0 t9,0`} fill="none" stroke={colours[i]} strokeWidth={2.6} strokeLinecap="round" />
        ))}
      {kind === "blocks" &&
        [
          [4, 16],
          [12, 16],
          [20, 16],
          [12, 8],
          [20, 8],
          [20, 0],
          [28, 16],
        ].map(([x, y], i) => (
          <rect key={i} x={x} y={y + 3} width={8} height={8} fill={colours[i % 3]} stroke={ink} strokeWidth={1.2} />
        ))}
    </svg>
  );
}

export default Certificate;
