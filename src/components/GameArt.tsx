// Hand-drawn game props shared by the STEM x Games banner and the Games tab,
// so every game has its own picture instead of an emoji.
import type { ReactElement } from "react";

const INK = "var(--ink-line)";

/** Drippy the water drop flapping between blocky pillars, with a cloud above. */
export function DropFlight() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <ellipse cx="60" cy="112" rx="46" ry="6" fill="rgba(0,0,0,.18)" />
      <rect
        x="10"
        y="70"
        width="22"
        height="38"
        fill="#e8cf8a"
        stroke={INK}
        strokeWidth="4"
      />
      <rect
        x="10"
        y="92"
        width="22"
        height="16"
        fill="#9aa4ad"
        stroke={INK}
        strokeWidth="4"
      />
      <rect
        x="88"
        y="58"
        width="22"
        height="50"
        fill="#7cc242"
        stroke={INK}
        strokeWidth="4"
      />
      <rect
        x="88"
        y="70"
        width="22"
        height="38"
        fill="#a8693a"
        stroke={INK}
        strokeWidth="4"
      />
      <g fill="#fff" stroke={INK} strokeWidth="4">
        <rect x="70" y="10" width="42" height="18" rx="4" />
        <rect x="80" y="2" width="22" height="14" rx="4" />
      </g>
      <rect x="82" y="12" width="18" height="8" fill="#fff" />
      <g className="banner-rocket">
        <path
          d="M58 30c10 14 18 24 18 34a18 18 0 0 1-36 0c0-10 8-20 18-34Z"
          fill="#4fb8ff"
          stroke={INK}
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <path
          d="M48 58c0-5 3-10 6-14"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
          opacity=".85"
        />
        <circle cx="53" cy="64" r="3" fill={INK} />
        <circle cx="65" cy="64" r="3" fill={INK} />
        <path
          d="M54 72c3 3 7 3 10 0"
          stroke={INK}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M76 58c8-6 14-4 16 0-4 2-9 4-16 4Z"
          fill="#fff"
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>
      <circle
        cx="30"
        cy="40"
        r="3.5"
        fill="#4fb8ff"
        stroke={INK}
        strokeWidth="2"
      />
      <circle
        cx="20"
        cy="52"
        r="2.5"
        fill="#4fb8ff"
        stroke={INK}
        strokeWidth="2"
      />
    </svg>
  );
}

/** A Monopoly-style board corner with dice and a coin. */
export function BoardAndDice() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <ellipse cx="60" cy="112" rx="46" ry="6" fill="rgba(0,0,0,.18)" />
      <path
        d="M8 86 60 66l52 20-52 22Z"
        fill="#fffbe6"
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M8 86 60 66l9 3.5L17 89.6ZM103 82.5 112 86l-52 22-9-3.8Z"
        fill="#ef5b5b"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M30 77.5 39 81M82 74l9 3.5" stroke={INK} strokeWidth="2.5" />
      <g transform="rotate(-14 42 48)">
        <rect
          x="26"
          y="32"
          width="32"
          height="32"
          rx="7"
          fill="#fff"
          stroke={INK}
          strokeWidth="4"
        />
        <circle cx="35" cy="41" r="3.4" fill={INK} />
        <circle cx="42" cy="48" r="3.4" fill={INK} />
        <circle cx="49" cy="55" r="3.4" fill={INK} />
      </g>
      <g transform="rotate(12 82 40)">
        <rect
          x="66"
          y="24"
          width="30"
          height="30"
          rx="7"
          fill="#fff"
          stroke={INK}
          strokeWidth="4"
        />
        <circle cx="75" cy="33" r="3.2" fill={INK} />
        <circle cx="87" cy="33" r="3.2" fill={INK} />
        <circle cx="75" cy="45" r="3.2" fill={INK} />
        <circle cx="87" cy="45" r="3.2" fill={INK} />
      </g>
      <circle
        cx="94"
        cy="78"
        r="9"
        fill="#ffd23f"
        stroke={INK}
        strokeWidth="3"
      />
      <text
        x="94"
        y="82"
        textAnchor="middle"
        fontFamily="Fredoka, sans-serif"
        fontWeight="700"
        fontSize="11"
        fill={INK}
      >
        $
      </text>
    </svg>
  );
}

/** A crewmate with a blaster aiming at a labelled asteroid. */
export function AsteroidBlast() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
      <ellipse cx="76" cy="112" rx="34" ry="6" fill="rgba(0,0,0,.18)" />
      <g className="banner-rocket" transform="translate(-64 8)">
        <path
          d="M92 6l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z"
          fill="#ffd23f"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
          opacity=".9"
          transform="translate(-6 0) scale(.6)"
        />
        <path
          d="M74 14l14-4 14 6 6 14-6 13-15 4-13-6-5-14Z"
          fill="#b08968"
          stroke={INK}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <circle cx="84" cy="22" r="4" fill="#6f4e37" />
        <circle cx="98" cy="34" r="3" fill="#6f4e37" />
        <rect
          x="70"
          y="30"
          width="40"
          height="13"
          rx="6.5"
          fill="#fff"
          stroke="#facc15"
          strokeWidth="3"
        />
        <text
          x="90"
          y="40"
          textAnchor="middle"
          fontFamily="Fredoka, sans-serif"
          fontWeight="700"
          fontSize="10"
          fill={INK}
        >
          Gravity
        </text>
      </g>
      <g transform="translate(120 0) scale(-1 1)">
        <path
          d="M58 66 76 52"
          stroke="#ff7a3d"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
          <rect x="16" y="56" width="10" height="28" rx="4" fill="#c2410c" />
          <rect x="24" y="44" width="40" height="54" rx="18" fill="#f97316" />
          <rect x="26" y="88" width="14" height="20" rx="5" fill="#c2410c" />
          <rect x="46" y="88" width="14" height="20" rx="5" fill="#c2410c" />
          <rect x="38" y="52" width="28" height="16" rx="8" fill="#9ee6ff" />
          <g transform="rotate(-48 56 72)">
            <rect x="50" y="66" width="30" height="12" rx="4" fill="#475569" />
          </g>
        </g>
        <rect
          x="44"
          y="55"
          width="10"
          height="4"
          rx="2"
          fill="#fff"
          opacity=".85"
        />
      </g>
    </svg>
  );
}

/** A spaceship task console showing a BODMAS sum. */
export function TaskConsole() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <ellipse cx="60" cy="112" rx="42" ry="6" fill="rgba(0,0,0,.18)" />
      <path
        d="M28 70h64l8 40H20Z"
        fill="#9aa4ad"
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <rect
        x="12"
        y="14"
        width="96"
        height="62"
        rx="10"
        fill="#2b2f45"
        stroke={INK}
        strokeWidth="4"
      />
      <rect x="20" y="22" width="80" height="46" rx="6" fill="#1b2a3a" />
      <text
        x="60"
        y="44"
        textAnchor="middle"
        fontFamily="Fredoka, sans-serif"
        fontWeight="700"
        fontSize="15"
        fill="#7cf2a6"
      >
        (2+3)×4
      </text>
      <text
        x="60"
        y="61"
        textAnchor="middle"
        fontFamily="Fredoka, sans-serif"
        fontWeight="700"
        fontSize="13"
        fill="#ffd23f"
      >
        = 20 ✓
      </text>
      <circle
        cx="40"
        cy="92"
        r="6"
        fill="#ef5b5b"
        stroke={INK}
        strokeWidth="3"
      />
      <circle
        cx="60"
        cy="92"
        r="6"
        fill="#ffd23f"
        stroke={INK}
        strokeWidth="3"
      />
      <circle
        cx="80"
        cy="92"
        r="6"
        fill="#7cc242"
        stroke={INK}
        strokeWidth="3"
      />
      <path
        d="M100 18 112 6"
        stroke="#ffd23f"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M104 30h12"
        stroke="#ffd23f"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A blocky bedroom corner: bed, lamp and a picture frame. */
function RoomBlocks() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <ellipse cx="60" cy="112" rx="46" ry="6" fill="rgba(0,0,0,.18)" />
      <path
        d="M10 30 60 12l50 18v56L60 106 10 86Z"
        fill="#fff6dc"
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M10 86 60 66l50 20-50 20Z"
        fill="#c98a52"
        stroke={INK}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M35 76l50 20M60 66v40" stroke="#a8693a" strokeWidth="2.5" />
      <path d="M60 12v54" stroke={INK} strokeWidth="3" />
      <path
        d="M20 42 44 33.4v16L20 58Z"
        fill="#5cc8ff"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M32 37.7v16" stroke={INK} strokeWidth="2.5" />
      <path
        d="M66 70l26-10 14 6-26 10Z"
        fill="#ef5b5b"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M66 70v8l14 6v-8ZM80 76v8l26-10v-8Z"
        fill="#b23a3a"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M68 66l8-3 6 2.5-8 3Z"
        fill="#fff"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M90 34v22" stroke={INK} strokeWidth="3" />
      <path
        d="M82 34h16l-3-10h-10Z"
        fill="#ffd23f"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x="86"
        y="54"
        width="8"
        height="4"
        rx="1"
        fill="#7a7a7a"
        stroke={INK}
        strokeWidth="2"
      />
    </svg>
  );
}

/** Picture and tint for each game, keyed by game id. */
export const GAME_ART: Record<
  string,
  { Prop: () => ReactElement; tint: string; tall?: boolean }
> = {
  "mm-sci-sim": { Prop: DropFlight, tint: "#d3ecfc" },
  "mm-math-sim": { Prop: RoomBlocks, tint: "#e6dcff" },
  "mi-math-sim": { Prop: BoardAndDice, tint: "#d3ecfc" },
  "sb-sci-sim": { Prop: AsteroidBlast, tint: "#e6dcff" },
  "sb-math-sim": { Prop: TaskConsole, tint: "#ffdcdc" },
};

/** A game's picture in a box that keeps its shape. */
export function GameProp({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const art = GAME_ART[id];
  if (!art) return null;
  return (
    <div
      className={className}
      style={{ aspectRatio: art.tall ? "120/150" : "1" }}
    >
      <art.Prop />
    </div>
  );
}
