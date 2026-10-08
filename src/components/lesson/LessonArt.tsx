// Hand-drawn lesson and checkpoint art, in the same ink-outline sticker style
// as the rest of the Academy. Colours come from the active theme's tokens, so
// every badge and map re-tints when the colour theme changes.
import { BookOpen, Clapperboard, CircleHelp, Gamepad2, PenLine, Trophy } from "lucide-react";
import type { BeatType, GameLesson, LessonBeat } from "../../data/lessonContent";
import { cn } from "../ui/utils";

const INK = "var(--ink-line)";

/** Little isometric grass block, Minecraft style. */
function GrassBlock() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden="true">
      <path d="M32 8 56 20 32 32 8 20Z" fill="#7cc242" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M8 20 32 32v24L8 44Z" fill="#a8693a" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M56 20 32 32v24l24-12Z" fill="#8a5129" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M8 20 32 32l24-12v7L32 39 8 27Z" fill="#5fa32e" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 30v4M22 38v4M40 40v4M48 33v4M18 44v3M44 46v3" stroke="#5c3416" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 15h5M36 20h5M30 25h4" stroke="#b6e38c" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Money bag with a coin stack for Mission Millionaire. */
function MoneyBag() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden="true">
      <ellipse cx="46" cy="52" rx="11" ry="4" fill="#f5c518" stroke={INK} strokeWidth="2.5" />
      <path d="M35 46v6c0 2.2 4.9 4 11 4s11-1.8 11-4v-6" fill="#f5c518" stroke={INK} strokeWidth="2.5" />
      <ellipse cx="46" cy="46" rx="11" ry="4" fill="#ffe066" stroke={INK} strokeWidth="2.5" />
      <path d="M24 14c-3-4 1-7 4-5 2-3 6-3 8 0 3-2 7 1 4 5" fill="#e8b04a" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path
        d="M25 16h14c9 6 14 15 14 24 0 9-8 14-21 14S11 49 11 40c0-9 5-18 14-24Z"
        fill="#ef5b5b"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M24 16c3 2 13 2 16 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
      <text x="32" y="45" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="20" fill="#fff" stroke={INK} strokeWidth="1.2">
        $
      </text>
    </svg>
  );
}

/** Rocket blasting off for Space Busters. */
function Rocket() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden="true">
      <circle cx="50" cy="14" r="7" fill="#c9b6ff" stroke={INK} strokeWidth="2.5" />
      <path d="M41 16c4-1 14-1 18 1" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M26 46c-4 6-4 10-2 14 4-2 8-2 10-8" fill="#ffb02e" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M31 6c10 7 13 20 9 34H22C18 26 21 13 31 6Z" fill="#fff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M22 40 14 48l2-12 7-5M40 40l8 8-2-12-7-5" fill="#ef5b5b" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="31" cy="22" r="5" fill="#5cc8ff" stroke={INK} strokeWidth="2.5" />
      <path d="M25 40h12v5H25Z" fill="#ef5b5b" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M6 30h5M9 27v6M52 36h4M54 34v4" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FlagArt() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden="true">
      <path d="M18 8v50" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M19 10h30l-7 10 7 10H19Z" fill="#fff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export const LESSON_ART: Record<string, { Art: () => JSX.Element; tint: string; scenery: "blocks" | "city" | "space" }> = {
  "minecraft-masterminds": { Art: GrassBlock, tint: "var(--soft-2)", scenery: "blocks" },
  "mission-millionaire": { Art: MoneyBag, tint: "var(--soft-1)", scenery: "city" },
  "space-busters": { Art: Rocket, tint: "var(--soft-3)", scenery: "space" },
};

/** The illustrated badge that represents a whole lesson. */
export function LessonBadge({
  lesson,
  size = 72,
  className,
  tilt = -5,
}: {
  lesson: Pick<GameLesson, "id">;
  size?: number;
  className?: string;
  tilt?: number;
}) {
  const art = LESSON_ART[lesson.id];
  const Art = art?.Art ?? FlagArt;
  return (
    <div
      className={cn("lesson-badge shrink-0", className)}
      style={{ width: size, height: size, transform: `rotate(${tilt}deg)` }}
      aria-hidden="true"
    >
      <div className="absolute inset-[12%]">
        <Art />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkpoint kinds
// ---------------------------------------------------------------------------

export const BEAT_KIND: Record<
  BeatType,
  { label: string; verb: string; Icon: typeof BookOpen; bg: string; fg: string }
> = {
  intro: { label: "Story", verb: "Read the story", Icon: BookOpen, bg: "var(--pop-3)", fg: "var(--pop-3-ink)" },
  video: { label: "Watch", verb: "Watch & learn", Icon: Clapperboard, bg: "var(--primary)", fg: "var(--primary-foreground)" },
  quiz: { label: "Quiz", verb: "Quick quiz", Icon: CircleHelp, bg: "var(--pop-2)", fg: "#1b1b12" },
  simulation: { label: "Game", verb: "Play the game", Icon: Gamepad2, bg: "var(--ink)", fg: "#fff" },
  exit: { label: "Reflect", verb: "Exit card", Icon: PenLine, bg: "var(--card)", fg: "var(--card-foreground)" },
};

/** Round, ink-outlined checkpoint icon in the colour of its kind. */
export function BeatGlyph({
  beat,
  size = 44,
  done,
  filled = true,
  className,
}: {
  beat: Pick<LessonBeat, "type">;
  size?: number;
  done?: boolean;
  filled?: boolean;
  className?: string;
}) {
  const k = BEAT_KIND[beat.type];
  return (
    <span
      className={cn("beat-glyph", className)}
      style={{
        width: size,
        height: size,
        background: filled ? k.bg : "var(--card)",
        color: filled ? k.fg : "var(--card-foreground)",
      }}
    >
      <k.Icon size={Math.round(size * 0.46)} strokeWidth={2.6} />
      {done && (
        <span className="beat-glyph-check" aria-label="Done">
          <svg viewBox="0 0 16 16" width="100%" height="100%">
            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </span>
  );
}

export function FinishGlyph({ size = 52, done }: { size?: number; done: boolean }) {
  return (
    <span
      className="beat-glyph"
      style={{ width: size, height: size, background: done ? "var(--pop-2)" : "var(--card)", color: done ? "#1b1b12" : "var(--card-foreground)" }}
    >
      <Trophy size={Math.round(size * 0.46)} strokeWidth={2.6} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Scenery doodles for the checkpoint maps
// ---------------------------------------------------------------------------

export function SceneryItem({ kind, i }: { kind: "blocks" | "city" | "space"; i: number }) {
  const v = i % 3;
  if (kind === "blocks") {
    if (v === 0)
      // Pixel tree
      return (
        <svg viewBox="0 0 40 48" className="w-full h-full">
          <rect x="16" y="28" width="8" height="18" fill="#8a5129" stroke={INK} strokeWidth="2.5" />
          <rect x="4" y="4" width="32" height="26" rx="2" fill="#5fa32e" stroke={INK} strokeWidth="2.5" />
          <rect x="10" y="10" width="7" height="7" fill="#7cc242" />
          <rect x="22" y="16" width="7" height="7" fill="#4a8a22" />
        </svg>
      );
    if (v === 1)
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <rect x="4" y="4" width="32" height="32" rx="3" fill="#9aa4ad" stroke={INK} strokeWidth="2.5" />
          <rect x="10" y="10" width="7" height="6" fill="#7b858e" />
          <rect x="22" y="22" width="8" height="7" fill="#7b858e" />
          <rect x="22" y="9" width="5" height="5" fill="#5cc8ff" />
        </svg>
      );
    return (
      <svg viewBox="0 0 40 40" className="w-full h-full">
        <path d="M20 6 34 32H6Z" fill="#7cc242" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M20 16 30 34H10Z" fill="#5fa32e" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "city") {
    if (v === 0)
      // Coin
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <circle cx="20" cy="20" r="15" fill="#ffd23f" stroke={INK} strokeWidth="2.5" />
          <circle cx="20" cy="20" r="9.5" fill="none" stroke="#e0a400" strokeWidth="2" />
          <text x="20" y="25" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="14" fill={INK}>
            $
          </text>
        </svg>
      );
    if (v === 1)
      // Tiny shophouse
      return (
        <svg viewBox="0 0 40 44" className="w-full h-full">
          <path d="M5 16 20 5l15 11v24H5Z" fill="#ffb3c7" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="15" y="27" width="10" height="13" fill="#fff" stroke={INK} strokeWidth="2.2" />
          <rect x="9" y="18" width="7" height="6" fill="#5cc8ff" stroke={INK} strokeWidth="2" />
          <rect x="24" y="18" width="7" height="6" fill="#5cc8ff" stroke={INK} strokeWidth="2" />
        </svg>
      );
    return (
      // Price tag
      <svg viewBox="0 0 40 40" className="w-full h-full">
        <path d="M6 18 18 6h14v14L20 32a3 3 0 0 1-4 0L6 22a3 3 0 0 1 0-4Z" fill="#7cc242" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="26" cy="12" r="2.5" fill="#fff" stroke={INK} strokeWidth="2" />
        <text x="17" y="23" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="9" fill={INK}>
          %
        </text>
      </svg>
    );
  }
  if (v === 0)
    return (
      <svg viewBox="0 0 40 40" className="w-full h-full">
        <circle cx="20" cy="20" r="11" fill="#ff9f68" stroke={INK} strokeWidth="2.5" />
        <ellipse cx="20" cy="21" rx="18" ry="5" fill="none" stroke={INK} strokeWidth="2.5" transform="rotate(-14 20 21)" />
        <circle cx="16" cy="17" r="2.5" fill="#ffc29c" />
      </svg>
    );
  if (v === 1)
    return (
      <svg viewBox="0 0 40 40" className="w-full h-full">
        <path d="M20 3c1 9 5 13 14 14-9 1-13 5-14 14-1-9-5-13-14-14 9-1 13-5 14-14Z" fill="#ffd23f" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 40 40" className="w-full h-full">
      <circle cx="20" cy="20" r="14" fill="#d9dde3" stroke={INK} strokeWidth="2.5" />
      <circle cx="15" cy="16" r="3.5" fill="#b8bec7" />
      <circle cx="25" cy="25" r="4.5" fill="#b8bec7" />
    </svg>
  );
}
