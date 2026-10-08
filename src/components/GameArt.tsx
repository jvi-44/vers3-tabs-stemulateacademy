// Hand-drawn game props shared by the STEM x Games banner and the Games tab,
// so every game has its own picture instead of an emoji.
import type { ReactElement } from "react";

const INK = "var(--ink-line)";

/** Glass terrarium with a grass block, a sapling and a tiny cloud. */
export function Terrarium() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <ellipse cx="60" cy="112" rx="44" ry="6" fill="rgba(0,0,0,.18)" />
      <path d="M22 34h76v62a14 14 0 0 1-14 14H36a14 14 0 0 1-14-14Z" fill="rgba(210,240,255,.55)" stroke={INK} strokeWidth="4" />
      <rect x="16" y="24" width="88" height="14" rx="5" fill="#a8693a" stroke={INK} strokeWidth="4" />
      <path d="M26 82h68v14a10 10 0 0 1-10 10H36a10 10 0 0 1-10-10Z" fill="#8a5129" />
      <path d="M26 74h68v10H26Z" fill="#7cc242" stroke={INK} strokeWidth="3" />
      <path d="M33 90h6M52 96h6M74 90h6" stroke="#5c3416" strokeWidth="4" strokeLinecap="round" />
      <path d="M60 74V54" stroke="#5c3416" strokeWidth="4" strokeLinecap="round" />
      <rect x="48" y="40" width="24" height="18" rx="3" fill="#5fa32e" stroke={INK} strokeWidth="3" />
      <path d="M36 74c0-8 4-12 8-12M84 74c0-6-3-10-7-10" stroke="#5fa32e" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M32 44h8M30 50h6" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <circle cx="84" cy="50" r="3" fill="#5cc8ff" stroke={INK} strokeWidth="2" />
      <circle cx="90" cy="60" r="2.5" fill="#5cc8ff" stroke={INK} strokeWidth="2" />
    </svg>
  );
}

/** A Monopoly-style board corner with dice and a coin. */
export function BoardAndDice() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <ellipse cx="60" cy="112" rx="46" ry="6" fill="rgba(0,0,0,.18)" />
      <path d="M8 86 60 66l52 20-52 22Z" fill="#fffbe6" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M8 86 60 66l9 3.5L17 89.6ZM103 82.5 112 86l-52 22-9-3.8Z" fill="#ef5b5b" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M30 77.5 39 81M82 74l9 3.5" stroke={INK} strokeWidth="2.5" />
      <g transform="rotate(-14 42 48)">
        <rect x="26" y="32" width="32" height="32" rx="7" fill="#fff" stroke={INK} strokeWidth="4" />
        <circle cx="35" cy="41" r="3.4" fill={INK} />
        <circle cx="42" cy="48" r="3.4" fill={INK} />
        <circle cx="49" cy="55" r="3.4" fill={INK} />
      </g>
      <g transform="rotate(12 82 40)">
        <rect x="66" y="24" width="30" height="30" rx="7" fill="#fff" stroke={INK} strokeWidth="4" />
        <circle cx="75" cy="33" r="3.2" fill={INK} />
        <circle cx="87" cy="33" r="3.2" fill={INK} />
        <circle cx="75" cy="45" r="3.2" fill={INK} />
        <circle cx="87" cy="45" r="3.2" fill={INK} />
      </g>
      <circle cx="94" cy="78" r="9" fill="#ffd23f" stroke={INK} strokeWidth="3" />
      <text x="94" y="82" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="11" fill={INK}>
        $
      </text>
    </svg>
  );
}

/** Rocket mid-launch with a puffy exhaust cloud. */
export function LaunchRocket() {
  return (
    <svg viewBox="0 0 120 150" className="w-full h-full overflow-visible">
      <g className="banner-rocket">
        <path d="M60 10c17 12 22 36 15 62H45c-7-26-2-50 15-62Z" fill="#fff" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
        <path d="M45 72 30 88l4-22 12-9M75 72l15 16-4-22-12-9" fill="#ef5b5b" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <circle cx="60" cy="38" r="9" fill="#5cc8ff" stroke={INK} strokeWidth="4" />
        <path d="M48 72h24v8H48Z" fill="#9aa4ad" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <path className="banner-flame" d="M50 80c-2 12 4 20 10 28 6-8 12-16 10-28Z" fill="#ffb02e" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M55 82c0 8 2 12 5 16 3-4 5-8 5-16Z" fill="#ffe066" />
      </g>
      <g fill="#fff" stroke={INK} strokeWidth="4">
        <circle cx="38" cy="130" r="14" />
        <circle cx="60" cy="126" r="17" />
        <circle cx="84" cy="131" r="13" />
      </g>
    </svg>
  );
}

/** A spaceship task console showing a BODMAS sum. */
export function TaskConsole() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <ellipse cx="60" cy="112" rx="42" ry="6" fill="rgba(0,0,0,.18)" />
      <path d="M28 70h64l8 40H20Z" fill="#9aa4ad" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <rect x="12" y="14" width="96" height="62" rx="10" fill="#2b2f45" stroke={INK} strokeWidth="4" />
      <rect x="20" y="22" width="80" height="46" rx="6" fill="#1b2a3a" />
      <text x="60" y="44" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="15" fill="#7cf2a6">
        (2+3)×4
      </text>
      <text x="60" y="61" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="13" fill="#ffd23f">
        = 20 ✓
      </text>
      <circle cx="40" cy="92" r="6" fill="#ef5b5b" stroke={INK} strokeWidth="3" />
      <circle cx="60" cy="92" r="6" fill="#ffd23f" stroke={INK} strokeWidth="3" />
      <circle cx="80" cy="92" r="6" fill="#7cc242" stroke={INK} strokeWidth="3" />
      <path d="M100 18 112 6" stroke="#ffd23f" strokeWidth="4" strokeLinecap="round" />
      <path d="M104 30h12" stroke="#ffd23f" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** A blocky bedroom corner: bed, lamp and a picture frame. */
function RoomBlocks() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <ellipse cx="60" cy="112" rx="46" ry="6" fill="rgba(0,0,0,.18)" />
      <path d="M10 30 60 12l50 18v56L60 106 10 86Z" fill="#fff6dc" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M10 86 60 66l50 20-50 20Z" fill="#c98a52" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M35 76l50 20M60 66v40" stroke="#a8693a" strokeWidth="2.5" />
      <path d="M60 12v54" stroke={INK} strokeWidth="3" />
      <path d="M20 42 44 33.4v16L20 58Z" fill="#5cc8ff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M32 37.7v16" stroke={INK} strokeWidth="2.5" />
      <path d="M66 70l26-10 14 6-26 10Z" fill="#ef5b5b" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M66 70v8l14 6v-8ZM80 76v8l26-10v-8Z" fill="#b23a3a" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M68 66l8-3 6 2.5-8 3Z" fill="#fff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M90 34v22" stroke={INK} strokeWidth="3" />
      <path d="M82 34h16l-3-10h-10Z" fill="#ffd23f" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <rect x="86" y="54" width="8" height="4" rx="1" fill="#7a7a7a" stroke={INK} strokeWidth="2" />
    </svg>
  );
}

/** Picture and tint for each game, keyed by game id. */
export const GAME_ART: Record<string, { Prop: () => ReactElement; tint: string; tall?: boolean }> = {
  "mm-sci-sim": { Prop: Terrarium, tint: "#dcf5c8" },
  "mm-math-sim": { Prop: RoomBlocks, tint: "#e6dcff" },
  "mi-math-sim": { Prop: BoardAndDice, tint: "#d3ecfc" },
  "sb-sci-sim": { Prop: LaunchRocket, tint: "#fdf0c9", tall: true },
  "sb-math-sim": { Prop: TaskConsole, tint: "#ffdcdc" },
};

/** A game's picture in a box that keeps its shape. */
export function GameProp({ id, className }: { id: string; className?: string }) {
  const art = GAME_ART[id];
  if (!art) return null;
  return (
    <div className={className} style={{ aspectRatio: art.tall ? "120/150" : "1" }}>
      <art.Prop />
    </div>
  );
}
