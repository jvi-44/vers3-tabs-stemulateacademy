// A shelf of mini certificate "trophies" for the Profile page: earned ones
// shine, in-progress ones show how far along they are, coming-soon ones are
// locked.
import { useMemo } from "react";
import { Lock, Sparkles, Hourglass } from "lucide-react";
import {
  type CertificateModule,
  type CertPalette,
  burstPath,
  formatShortDate,
  loadChoices,
  paletteById,
  scallopPath,
  starPath,
} from "./certificateKit";
import { cn } from "./ui/utils";
import "../styles/certificate.css";

export type CertificateShelfItem = {
  module: CertificateModule;
  completedAt: string | null;
  /** 0-100 */
  progressPct: number;
  comingSoon?: boolean;
};

export type CertificateShelfProps = {
  modules: CertificateShelfItem[];
  onOpen: (moduleId: string) => void;
};

export function CertificateShelf({ modules, onOpen }: CertificateShelfProps) {
  return (
    <div className="cert-shelf">
      {modules.map((item) => (
        <Trophy key={item.module.id} item={item} onOpen={onOpen} />
      ))}
    </div>
  );
}

function Trophy({ item, onOpen }: { item: CertificateShelfItem; onOpen: (id: string) => void }) {
  const { module, completedAt, comingSoon } = item;
  const pct = Math.max(0, Math.min(100, Math.round(item.progressPct || 0)));
  const earned = !!completedAt && !comingSoon;
  const palette = useMemo(() => paletteById(loadChoices(module.id).palette), [module.id]);
  const state = comingSoon ? "soon" : earned ? "earned" : "progress";

  const body = (
    <>
      <div className="cert-trophy-card">
        <MiniCertificate palette={palette} state={state} pct={pct} emoji={module.emoji} />
        {state === "earned" && <span className="cert-shine" aria-hidden />}
        {state === "soon" && (
          <span className="absolute inset-0 grid place-items-center" aria-hidden>
            <span className="w-10 h-10 rounded-full bg-card border-[2.5px] border-ink shadow-[0_3px_0_var(--ink-line)] grid place-items-center">
              <Lock size={18} />
            </span>
          </span>
        )}
      </div>
      <div className="min-w-0 px-0.5">
        <p className="font-display font-semibold text-foreground leading-tight truncate">
          {module.emoji && <span aria-hidden>{module.emoji} </span>}
          {module.name}
        </p>
        {state === "earned" && (
          <p className="text-xs font-bold text-muted-foreground mt-1 inline-flex items-center gap-1">
            <Sparkles size={12} className="text-primary" /> Earned {formatShortDate(completedAt)}
          </p>
        )}
        {state === "progress" && (
          <div className="mt-1.5">
            <div className="meter !h-2.5">
              <span style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs font-bold text-muted-foreground mt-1 inline-flex items-center gap-1">
              <Hourglass size={12} /> {pct}% there
            </p>
          </div>
        )}
        {state === "soon" && <p className="text-xs font-bold text-muted-foreground mt-1">Coming soon</p>}
      </div>
    </>
  );

  if (state === "soon") {
    return (
      <div className="cert-trophy is-locked" aria-label={`${module.name}: coming soon`}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="cert-trophy group"
      onClick={() => onOpen(module.id)}
      aria-label={earned ? `Open ${module.name} certificate` : `Preview ${module.name} certificate (${pct}% done)`}
    >
      {body}
    </button>
  );
}

const MW = 297;
const MH = 210;

function MiniCertificate({
  palette: p,
  state,
  pct,
  emoji,
}: {
  palette: CertPalette;
  state: "earned" | "progress" | "soon";
  pct: number;
  emoji?: string;
}) {
  const earned = state === "earned";
  const frame = earned ? p.primary : state === "progress" ? p.soft1 : "#e5e5e5";
  const sx = MW / 2;
  const sy = 162;
  const ringR = 22;
  const circ = 2 * Math.PI * ringR;
  return (
    <svg viewBox={`-4 -4 ${MW + 8} ${MH + 12}`} aria-hidden>
      <path d={scallopPath(6, 10, MW - 12, MH - 12, 7)} fill={p.ink} />
      <path d={scallopPath(6, 4, MW - 12, MH - 12, 7)} fill={frame} stroke={p.ink} strokeWidth={2.5} strokeLinejoin="round" />
      <rect x={20} y={18} width={MW - 40} height={MH - 40} rx={10} fill={p.paper} stroke={p.ink} strokeWidth={2.5} />
      {earned && (
        <>
          <path d={starPath(40, 38, 8)} fill={p.pop2} opacity={0.8} />
          <path d={starPath(MW - 42, 40, 6)} fill={p.pop3} opacity={0.8} />
          <path d={starPath(44, 140, 5)} fill={p.pop3} opacity={0.7} />
          <path d={starPath(MW - 40, 136, 8)} fill={p.primary} opacity={0.7} />
        </>
      )}
      {/* text lines */}
      <rect x={sx - 52} y={34} width={104} height={8} rx={4} fill={p.ink} opacity={0.75} />
      <rect x={sx - 34} y={50} width={68} height={5} rx={2.5} fill={p.ink} opacity={0.3} />
      <rect x={sx - 66} y={70} width={132} height={11} rx={5.5} fill={earned ? p.pop2 : p.ink} opacity={earned ? 0.6 : 0.12} />
      <rect x={sx - 56} y={66} width={112} height={12} rx={6} fill={p.ink} opacity={earned ? 0.85 : 0.25} />
      <rect x={sx - 50} y={94} width={100} height={18} rx={6} fill={earned ? p.primary : p.soft1} stroke={p.ink} strokeWidth={2} />
      <rect x={60} y={156} width={48} height={3} rx={1.5} fill={p.ink} opacity={0.5} />
      <rect x={MW - 108} y={156} width={48} height={3} rx={1.5} fill={p.ink} opacity={0.5} />

      {/* seal */}
      {earned ? (
        <>
          <path d={`M${sx - 12},${sy + 10} l-8,26 l8,-4 l5,8 l7,-24 Z`} fill={p.pop3} stroke={p.ink} strokeWidth={2} strokeLinejoin="round" />
          <path d={`M${sx + 12},${sy + 10} l8,26 l-8,-4 l-5,8 l-7,-24 Z`} fill={p.primary} stroke={p.ink} strokeWidth={2} strokeLinejoin="round" />
          <path d={burstPath(sx, sy, 28, 23, 16)} fill={p.pop2} stroke={p.ink} strokeWidth={2} strokeLinejoin="round" />
          <circle cx={sx} cy={sy} r={18} fill="#fff" stroke={p.ink} strokeWidth={2} />
          {emoji ? (
            <text x={sx} y={sy + 7} textAnchor="middle" fontSize={19}>
              {emoji}
            </text>
          ) : (
            <path d={starPath(sx, sy, 11)} fill={p.primary} stroke={p.ink} strokeWidth={1.5} />
          )}
        </>
      ) : (
        <>
          <circle cx={sx} cy={sy} r={ringR + 6} fill="#fff" stroke={p.ink} strokeWidth={2} strokeDasharray={state === "soon" ? "4 4" : undefined} />
          {state === "progress" && (
            <circle
              cx={sx}
              cy={sy}
              r={ringR}
              fill="none"
              stroke={p.primary}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={`${(circ * pct) / 100} ${circ}`}
              transform={`rotate(-90 ${sx} ${sy})`}
            />
          )}
          {state === "progress" && (
            <text x={sx} y={sy + 5} textAnchor="middle" fontFamily="Fredoka, Nunito, sans-serif" fontWeight={700} fontSize={14} fill={p.ink}>
              {pct}%
            </text>
          )}
        </>
      )}
    </svg>
  );
}

export default CertificateShelf;
