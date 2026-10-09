// Drawn game art: little outlined stickers (custom SVG) and icon chips (lucide in an
// outlined tile), styled like the rest of the Academy instead of emoji.
import type { CSSProperties, ReactNode } from "react";
import {
  Bike,
  BookOpen,
  Building2,
  Bus,
  ChefHat,
  Coffee,
  Compass,
  Dices,
  Drumstick,
  FlaskConical,
  Flower2,
  Gem,
  Gift,
  Hand,
  HelpCircle,
  Hotel,
  House,
  Landmark,
  Lightbulb,
  type LucideIcon,
  Music,
  Package,
  Palette,
  PartyPopper,
  PawPrint,
  Plane,
  Receipt,
  Rocket,
  Sailboat,
  SatelliteDish,
  ShoppingBag,
  ShoppingCart,
  Smile,
  Snowflake,
  Sprout,
  Store,
  Tag,
  Ticket,
  TrainFront,
  TreePalm,
  Trees,
  Trophy,
  Umbrella,
  BedDouble,
  CupSoda,
  Frown,
  Check,
  Wallet,
  ThumbsUp,
  FerrisWheel as Ferris,
} from "lucide-react";
import { cn } from "../../components/ui/utils";

export const INK = "#2a1f0c";

const line = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" } as const;
const thin = { ...line, strokeWidth: 1.4 } as const;
/** Soft white shine used on most stickers. */
const shine = { fill: "none", stroke: "#fff", strokeWidth: 1.6, strokeLinecap: "round", opacity: 0.7 } as const;

// ── Stickers (viewBox 0 0 32 32) ─────────────────────
const STICKERS = {
  rocks: (
    <>
      <path d="M4 26c-1-4 2-7 6-7s6 3 5 7z" fill="#9ca3af" {...line} />
      <path d="M13 26c0-6 4-10 9-10s7 5 6 10z" fill="#b8bec7" {...line} />
      <path d="M9 13c0-3 2-5 5-5s5 2 4 5c-2 2-7 2-9 0z" fill="#8b929c" {...line} />
      <path d="M17 20c1-1 3-2 5-1" {...shine} />
    </>
  ),
  perlite: (
    <>
      {[
        [10, 21, 5],
        [21, 22, 5.5],
        [15, 13, 4.5],
        [24, 12, 3.5],
        [7, 11, 3],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? "#f1f5f9" : "#fff"} {...line} />
      ))}
      <path d="M8 19.5c.6-.8 1.4-1.2 2.4-1.2M19 20c.6-.8 1.6-1.3 2.6-1.2" stroke="#cbd5e1" strokeWidth={1.4} strokeLinecap="round" fill="none" />
    </>
  ),
  soil: (
    <>
      <path d="M3 26c1-8 6-13 13-13s12 5 13 13z" fill="#6b4423" {...line} />
      <g fill="#3f2712">
        <circle cx="11" cy="21" r="1.3" />
        <circle cx="17" cy="18" r="1.2" />
        <circle cx="21" cy="23" r="1.3" />
        <circle cx="14" cy="24" r="1" />
      </g>
      <path d="M9 17c1.5-1.5 3.5-2.5 5.5-2.8" {...shine} opacity={0.35} />
    </>
  ),
  sand: (
    <>
      <path d="M3 26c1-8 6-13 13-13s12 5 13 13z" fill="#f2cf74" {...line} />
      <g fill="#c9a24a">
        <circle cx="11" cy="21" r="1" />
        <circle cx="17" cy="18" r="1" />
        <circle cx="21" cy="23" r="1" />
        <circle cx="14" cy="24" r=".8" />
        <circle cx="24" cy="19.5" r=".8" />
      </g>
      <path d="M9 17c1.5-1.5 3.5-2.5 5.5-2.8" {...shine} />
    </>
  ),
  wetsoil: (
    <>
      <path d="M3 27c1-7 6-11 13-11s12 4 13 11z" fill="#5a4122" {...line} />
      <path d="M16 3c-3 5-5 7.5-5 10a5 5 0 0 0 10 0c0-2.5-2-5-5-10z" fill="#38bdf8" {...line} />
      <path d="M14 11.5c-.4 1.2-.2 2.4.6 3.2" {...shine} />
    </>
  ),
  fern: (
    <>
      <path d="M16 29V9" {...line} fill="none" />
      {[11, 15, 19, 23].map((y, i) => (
        <g key={y}>
          <path d={`M16 ${y}c-3-1-6-1-${9 - i} ${i + 1}c3 1 6 1 ${9 - i}-${i + 1}z`} fill="#4ade80" {...thin} />
          <path d={`M16 ${y}c3-1 6-1 ${9 - i} ${i + 1}c-3 1-6 1-${9 - i}-${i + 1}z`} fill="#22c55e" {...thin} />
        </g>
      ))}
      <path d="M16 9c-1.5-2-1.5-4 0-6 1.5 2 1.5 4 0 6z" fill="#4ade80" {...thin} />
    </>
  ),
  moss: (
    <>
      <path d="M3 25c-1-4 2-6 4-6 0-3 3-5 6-4 1-3 5-4 7-2 3-1 6 1 6 4 3 0 4 4 3 8z" fill="#4ade80" {...line} />
      <g fill="#16a34a">
        <circle cx="9" cy="22" r="1.5" />
        <circle cx="15" cy="19" r="1.5" />
        <circle cx="21" cy="21" r="1.5" />
        <circle cx="25" cy="24" r="1.2" />
      </g>
      <path d="M8 18.5c.8-.8 2-1.2 3-1" {...shine} />
    </>
  ),
  leafy: (
    <>
      <path d="M16 22c-1-6-6-9-11-8 0 5 4 9 11 8z" fill="#22c55e" {...line} />
      <path d="M16 22c1-6 6-9 11-8 0 5-4 9-11 8z" fill="#4ade80" {...line} />
      <path d="M16 20c-3-4-3-9 0-15 3 6 3 11 0 15z" fill="#34d399" {...line} />
      <path d="M9 22h14l-2 7H11z" fill="#f97316" {...line} />
      <path d="M8 21h16v2.5H8z" fill="#fb923c" {...line} />
    </>
  ),
  cactus: (
    <>
      <path d="M12.5 29V8a3.5 3.5 0 0 1 7 0v21z" fill="#22c55e" {...line} />
      <path d="M12.5 18H9a3 3 0 0 1-3-3v-3a1.75 1.75 0 0 1 3.5 0v2.5h3" fill="#22c55e" {...line} />
      <path d="M19.5 21H23a3 3 0 0 0 3-3v-4a1.75 1.75 0 0 0-3.5 0v3.5h-3" fill="#22c55e" {...line} />
      <path d="M16 8v18" stroke="#15803d" strokeWidth={1.3} strokeLinecap="round" />
      <path d="M14.5 6.5c.4-.8 1-1.2 1.8-1.3" {...shine} />
      <circle cx="16" cy="4.6" r="1.6" fill="#f472b6" {...thin} />
    </>
  ),
  pebbles: (
    <>
      <ellipse cx="10" cy="22" rx="6" ry="4.5" fill="#a8a29e" {...line} />
      <ellipse cx="21.5" cy="23" rx="5.5" ry="4" fill="#d6c7a1" {...line} />
      <ellipse cx="16" cy="15" rx="4.5" ry="3.5" fill="#94a3b8" {...line} />
      <path d="M7 20.5c.8-.7 1.8-1 2.8-1M14 13.6c.6-.5 1.3-.7 2-.7" {...shine} />
    </>
  ),
  deadbush: (
    <>
      <path d="M16 28V17M16 20l-6-6M10 14l-3-1M10 14l-1-4M16 18l6-7M22 11l1-4M22 11l4 0M16 23l-5-2M16 22l5-2M19 14.5l1-3" stroke="#8b5a2b" strokeWidth={2.4} strokeLinecap="round" fill="none" />
      <path d="M16 28V17M16 20l-6-6M16 18l6-7" stroke={INK} strokeWidth={0.8} strokeLinecap="round" fill="none" opacity={0.5} />
      <ellipse cx="16" cy="28" rx="7" ry="1.6" fill="#d6b77a" {...thin} />
    </>
  ),
  lilypad: (
    <>
      <path d="M16 20 L26.9 17 A12 7 0 1 0 28 20.6 Z" fill="#22c55e" {...line} />
      <path d="M16 20l-9 2M16 20l2 6M16 20l-7-4M16 20l8 4" stroke="#15803d" strokeWidth={1.2} strokeLinecap="round" />
      <path d="M11 16c-2.5-3-2-6.5 0-8 2 1.5 2.5 5 0 8zM11 16c.5-3.5 3.5-5.5 6-5-1 2.5-3 4.5-6 5zM11 16c-.5-3.5-3.5-5.5-6-5 1 2.5 3 4.5 6 5z" fill="#f9a8d4" {...thin} />
      <circle cx="11" cy="14.5" r="1.4" fill="#fde047" {...thin} />
    </>
  ),
  log: (
    <>
      <path d="M8 12h17a4 7 0 0 1 0 14H8z" fill="#a16207" {...line} />
      <ellipse cx="8" cy="19" rx="4" ry="7" fill="#e7c38b" {...line} />
      <ellipse cx="8" cy="19" rx="2" ry="3.6" fill="none" stroke="#a16207" strokeWidth={1.2} />
      <path d="M13 16h9M15 21h8" stroke="#78350f" strokeWidth={1.3} strokeLinecap="round" />
      <path d="M22 9c1-2 3-3 5-3-1 2-3 3-5 3z" fill="#4ade80" {...thin} />
    </>
  ),
  mushroom: (
    <>
      <path d="M13 17h6l1 10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" fill="#fef3c7" {...line} />
      <path d="M3.5 17.5C4 10 9.5 5 16 5s12 5 12.5 12.5c-4 1.5-21 1.5-25 0z" fill="#ef4444" {...line} />
      <g fill="#fff" {...thin}>
        <circle cx="11" cy="11" r="2" />
        <circle cx="19" cy="9" r="1.7" />
        <circle cx="23" cy="14" r="1.6" />
        <circle cx="8" cy="15.5" r="1.2" />
      </g>
    </>
  ),
  snow: (
    <>
      <path d="M5 12l11-6 11 6v12l-11 6-11-6z" fill="#eff6ff" {...line} />
      <path d="M5 12l11 6 11-6M16 18v12" fill="none" {...line} />
      <path d="M16 18l11-6v12l-11 6z" fill="#bfdbfe" {...line} />
      <path d="M10.5 18.5v6M8 20l5 3M13 20l-5 3" stroke="#60a5fa" strokeWidth={1.3} strokeLinecap="round" />
    </>
  ),
  flower: (
    <>
      <path d="M16 29V16" stroke="#16a34a" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M16 24c-2-3-5-3-7-2 2 3 5 3 7 2z" fill="#22c55e" {...thin} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx="16" cy="6.5" rx="3" ry="4" fill="#fde047" {...thin} transform={`rotate(${a} 16 11)`} />
      ))}
      <circle cx="16" cy="11" r="3" fill="#f97316" {...line} />
    </>
  ),
  pine: (
    <>
      <path d="M14 25h4v5h-4z" fill="#92400e" {...line} />
      <path d="M16 3l7 9h-3l6 7h-4l5 7H5l5-7H6l6-7H9z" fill="#22c55e" {...line} />
      <path d="M14 8l-2 3M12 15l-2 3" {...shine} />
    </>
  ),
  dune: (
    <>
      <circle cx="23" cy="9" r="4.5" fill="#fde047" {...line} />
      <path d="M2 27c4-8 9-12 14-12s8 4 14 12z" fill="#f2cf74" {...line} />
      <path d="M12 27c2-4 5-6 8-6" stroke="#c9a24a" strokeWidth={1.4} strokeLinecap="round" fill="none" />
      <path d="M8 27V19a2 2 0 0 1 4 0v8" fill="#22c55e" {...thin} />
    </>
  ),
  frog: (
    <>
      <path d="M4 22c0-6 5-10 12-10s12 4 12 10c0 4-5 6-12 6S4 26 4 22z" fill="#4ade80" {...line} />
      <circle cx="10" cy="11" r="4.5" fill="#4ade80" {...line} />
      <circle cx="22" cy="11" r="4.5" fill="#4ade80" {...line} />
      <circle cx="10" cy="11" r="2" fill="#fff" {...thin} />
      <circle cx="22" cy="11" r="2" fill="#fff" {...thin} />
      <circle cx="10.4" cy="11.3" r=".9" fill={INK} />
      <circle cx="22.4" cy="11.3" r=".9" fill={INK} />
      <path d="M11 21c3 2 7 2 10 0" fill="none" {...line} />
      <circle cx="8" cy="19" r="1.4" fill="#f9a8d4" />
      <circle cx="24" cy="19" r="1.4" fill="#f9a8d4" />
    </>
  ),
  jar: (
    <>
      <rect x="9" y="3" width="14" height="5" rx="1.5" fill="#f59e0b" {...line} />
      <path d="M8 8h16v2c3 2 3 4 3 7v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-8c0-3 0-5 3-7z" fill="#e0f2fe" fillOpacity={0.85} {...line} />
      <path d="M5.5 21c4-2 7-1 10.5 0s7 2 10.5 0V25a4 4 0 0 1-4 4H9.5a4 4 0 0 1-4-4z" fill="#6b4423" {...thin} />
      <path d="M13 21c0-3-2-5-3-5 0 2 1 4 3 5zM17 20c0-4 2-6 4-6 0 2-1 5-4 6z" fill="#22c55e" {...thin} />
      <path d="M9 12v5" {...shine} />
    </>
  ),
  sun: (
    <>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <path key={a} d="M16 2.5v4" stroke="#f59e0b" strokeWidth={2.6} strokeLinecap="round" transform={`rotate(${a} 16 16)`} />
      ))}
      <circle cx="16" cy="16" r="7.5" fill="#fde047" {...line} />
      <path d="M12.5 13.5c.8-1.2 2-2 3.4-2.2" {...shine} />
    </>
  ),
  earth: (
    <>
      <circle cx="16" cy="16" r="12.5" fill="#3b82f6" {...line} />
      <path d="M7 10c3-1 5 1 5 3s-3 2-3 5-3 2-4 1M18 5c-1 2 1 3 3 3s3 2 2 4-3 2-3 4 2 3 1 5-3 3-4 2" fill="#22c55e" stroke="#15803d" strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M8.5 9c1.5-2 3.5-3.4 6-4" {...shine} />
    </>
  ),
  moon: (
    <>
      <circle cx="16" cy="16" r="12.5" fill="#e5e7eb" {...line} />
      <circle cx="11" cy="12" r="3" fill="#cbd5e1" {...thin} />
      <circle cx="20" cy="20" r="4" fill="#cbd5e1" {...thin} />
      <circle cx="21" cy="9.5" r="1.8" fill="#cbd5e1" {...thin} />
      <circle cx="10" cy="21" r="1.5" fill="#cbd5e1" {...thin} />
      <path d="M8.5 9c1.5-2 3.5-3.4 6-4" {...shine} />
    </>
  ),
  mars: (
    <>
      <circle cx="16" cy="16" r="12.5" fill="#f97316" {...line} />
      <path d="M6 13c4 1 8-1 12 0s7 2 9 1M5.5 20c4-1 7 1 11 0s7-1 10 0" stroke="#c2410c" strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <circle cx="12" cy="24" r="1.6" fill="#c2410c" />
      <circle cx="21" cy="8" r="1.4" fill="#c2410c" />
      <path d="M8.5 9c1.5-2 3.5-3.4 6-4" {...shine} />
    </>
  ),
  ringed: (
    <>
      <g transform="rotate(-14 16 17)">
        <path d="M1.5 17A14.5 4.5 0 0 1 30.5 17" fill="none" stroke={INK} strokeWidth={4.2} strokeLinecap="round" />
        <path d="M1.5 17A14.5 4.5 0 0 1 30.5 17" fill="none" stroke="#fcd34d" strokeWidth={2} strokeLinecap="round" />
      </g>
      <circle cx="16" cy="16" r="9" fill="#a78bfa" {...line} />
      <path d="M8.5 12.5c3-1 9-1 15 1" stroke="#7c3aed" strokeWidth={1.3} strokeLinecap="round" fill="none" />
      <g transform="rotate(-14 16 17)">
        <path d="M1.5 17A14.5 4.5 0 0 0 30.5 17" fill="none" stroke={INK} strokeWidth={4.2} strokeLinecap="round" />
        <path d="M1.5 17A14.5 4.5 0 0 0 30.5 17" fill="none" stroke="#fcd34d" strokeWidth={2} strokeLinecap="round" />
      </g>
      <path d="M11 10c1.3-1.2 3-2 4.8-2.2" {...shine} />
    </>
  ),
  darkmoon: (
    <>
      <circle cx="16" cy="16" r="12" fill="#64748b" {...line} />
      <circle cx="11" cy="12" r="3" fill="#475569" {...thin} />
      <circle cx="20" cy="20" r="3.5" fill="#475569" {...thin} />
      <circle cx="21" cy="10" r="1.6" fill="#475569" {...thin} />
    </>
  ),
  flame: (
    <>
      <path d="M16 3c2 5 9 8 9 16a9 9 0 0 1-18 0c0-4 2-6 4-8 0 3 1 4 2 4 0-5 1-9 3-12z" fill="#f97316" {...line} />
      <path d="M16 15c1 3 4 4 4 8a4 4 0 0 1-8 0c0-3 2-4 4-8z" fill="#fde047" {...thin} />
    </>
  ),
  fuel: (
    <>
      <rect x="7" y="7" width="15" height="22" rx="3" fill="#0ea5e9" {...line} />
      <rect x="10" y="11" width="9" height="6" rx="1.5" fill="#e0f2fe" {...thin} />
      <path d="M11 3h7v4h-7z" fill="#64748b" {...line} />
      <path d="M22 13h2a2 2 0 0 1 2 2v8a2 2 0 0 0 2 2" fill="none" {...line} />
      <path d="M10 21v5" {...shine} />
    </>
  ),
  rocket: (
    <>
      <path d="M16 2c5 4 7 10 6 18H10C9 12 11 6 16 2z" fill="#f8fafc" {...line} />
      <path d="M10 15l-5 5v6l5-3zM22 15l5 5v6l-5-3z" fill="#ef4444" {...line} />
      <circle cx="16" cy="11" r="3" fill="#38bdf8" {...line} />
      <path d="M12 20h8l-1 4h-6z" fill="#64748b" {...line} />
      <path d="M13.5 24.5c0 2 1 4 2.5 5.5 1.5-1.5 2.5-3.5 2.5-5.5z" fill="#f97316" {...thin} />
    </>
  ),
  star: (
    <>
      <path d="M16 3l3.8 8 8.7 1-6.4 6 1.7 8.6L16 22.4l-7.8 4.2L9.9 18 3.5 12l8.7-1z" fill="#fcd34d" {...line} />
      <path d="M13.5 12.5l1.3-2.7" {...shine} />
    </>
  ),
  burst: (
    <>
      <path d="M16 2l3 7 7-3-3 7 7 3-7 3 3 7-7-3-3 7-3-7-7 3 3-7-7-3 7-3-3-7 7 3z" fill="#f97316" {...line} />
      <path d="M16 9l1.8 4.5 4.5-1.6-1.8 4.1 4.1 1.8-4.5 1.6 1.6 4.4-4.1-1.9-1.6 4.5-1.8-4.5-4.4 1.8 1.8-4.4-4.5-1.6 4.4-1.8-1.6-4.5 4.4 1.8z" fill="#fde047" stroke="none" />
    </>
  ),
  coin: (
    <>
      <circle cx="16" cy="16" r="12" fill="#fbbf24" {...line} />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="#d97706" strokeWidth={1.4} />
      <path d="M18.5 12.5c-.6-1-1.5-1.5-2.7-1.5-1.6 0-2.8.9-2.8 2.2 0 3 5.8 1.6 5.8 4.6 0 1.4-1.3 2.3-3 2.3-1.3 0-2.4-.6-3-1.6M15.8 9.5v2M15.8 20v2" fill="none" stroke="#92400e" strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  lantern: (
    <>
      <path d="M16 2v4" {...line} />
      <rect x="11" y="5" width="10" height="3" rx="1" fill="#facc15" {...line} />
      <path d="M8 16c0-5 3.5-8 8-8s8 3 8 8-3.5 8-8 8-8-3-8-8z" fill="#ef4444" {...line} />
      <path d="M16 8v16M11.5 9.5c-2 4-2 9 0 13M20.5 9.5c2 4 2 9 0 13" stroke="#b91c1c" strokeWidth={1.3} fill="none" />
      <rect x="11" y="23" width="10" height="3" rx="1" fill="#facc15" {...line} />
      <path d="M14 26v4M16 26v5M18 26v4" stroke="#facc15" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M11 13c.5-1.5 1.5-2.6 2.8-3.2" {...shine} />
    </>
  ),
  merlion: (
    <>
      <path d="M9 30V19c0-3 2-5 4-5h6c2 0 4 2 4 5v11z" fill="#f8fafc" {...line} />
      <path d="M12 30c0-3 2-5 4-5s4 2 4 5" fill="#cbd5e1" {...thin} />
      <path d="M7 13a9 9 0 0 1 18 0c0 3-1 5-3 6H10c-2-1-3-3-3-6z" fill="#e5e7eb" {...line} />
      <circle cx="16" cy="12" r="5.5" fill="#f8fafc" {...line} />
      <circle cx="14" cy="11" r=".9" fill={INK} />
      <circle cx="18" cy="11" r=".9" fill={INK} />
      <path d="M14.5 14.5c1 .8 2 .8 3 0" fill="none" {...thin} />
      <path d="M16 17c-.5 3 0 5 1 8" stroke="#38bdf8" strokeWidth={2} strokeLinecap="round" fill="none" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type StickerName = keyof typeof STICKERS;

/** A drawn sticker. `size` in px. */
export function Sticker({ name, size = 28, className, style }: { name: StickerName; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={cn("inline-block shrink-0 drop-shadow-[0_1.5px_0_rgba(42,31,12,0.25)]", className)} style={style} aria-hidden>
      {STICKERS[name]}
    </svg>
  );
}

/** A lucide icon on a soft coloured, outlined tile: the same look as the Academy's own icon tiles. */
export function IconChip({
  icon: Icon,
  color = "#fde68a",
  size = 28,
  className,
  round,
  style,
}: {
  icon: LucideIcon;
  color?: string;
  size?: number;
  className?: string;
  round?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0", round ? "rounded-full" : "rounded-[30%]", className)}
      style={{
        width: size,
        height: size,
        background: color,
        border: `${Math.max(1.5, size / 18)}px solid ${INK}`,
        boxShadow: `0 ${Math.max(1.5, size / 16)}px 0 ${INK}`,
        color: INK,
        ...style,
      }}
      aria-hidden
    >
      <Icon size={size * 0.58} strokeWidth={2.4} />
    </span>
  );
}

// ── Named chips, so game data can keep a plain string id ──
const CHIPS = {
  bedroom: [BedDouble, "#c4b5fd"],
  library: [BookOpen, "#93c5fd"],
  kitchen: [ChefHat, "#fecaca"],
  petroom: [PawPrint, "#fed7aa"],
  musicroom: [Music, "#f9a8d4"],
  potionlab: [FlaskConical, "#a7f3d0"],
  storage: [Package, "#fde68a"],
  greenhouse: [Sprout, "#bbf7d0"],
  trophy: [Trophy, "#fcd34d"],
  // Monopoly squares
  payday: [Wallet, "#bbf7d0"],
  satay: [Drumstick, "#fed7aa"],
  chance: [HelpCircle, "#ddd6fe"],
  garland: [Flower2, "#fed7aa"],
  mosque: [Landmark, "#fde68a"],
  sale: [ShoppingBag, "#fbcfe8"],
  boat: [Sailboat, "#bae6fd"],
  mrt: [TrainFront, "#e2e8f0"],
  zoo: [PawPrint, "#fde68a"],
  gst: [Receipt, "#fed7aa"],
  bike: [Bike, "#bbf7d0"],
  kopi: [Coffee, "#e7c9a9"],
  orchard: [ShoppingCart, "#bae6fd"],
  island: [TreePalm, "#a5f3fc"],
  tax: [Building2, "#fed7aa"],
  plane: [Plane, "#ddd6fe"],
  gardens: [Trees, "#bbf7d0"],
  tag: [Tag, "#fbcfe8"],
  gem: [Gem, "#a5f3fc"],
  hotel: [Hotel, "#fbcfe8"],
  // Chance cards and results
  gift: [Gift, "#fecaca"],
  drink: [CupSoda, "#fbcfe8"],
  bus: [Bus, "#bae6fd"],
  umbrella: [Umbrella, "#c4b5fd"],
  palette: [Palette, "#fde68a"],
  food: [Drumstick, "#fed7aa"],
  idea: [Lightbulb, "#fde68a"],
  ticket: [Ticket, "#ddd6fe"],
  house: [House, "#bbf7d0"],
  rent: [Wallet, "#fecaca"],
  shop: [Store, "#bae6fd"],
  party: [PartyPopper, "#fde68a"],
  yes: [Check, "#bbf7d0"],
  oops: [Frown, "#fecaca"],
  wave: [Hand, "#e2e8f0"],
  thumbs: [ThumbsUp, "#bbf7d0"],
  dice: [Dices, "#fff"],
  smile: [Smile, "#e2e8f0"],
  ferris: [Ferris, "#ddd6fe"],
  // Spaceship systems
  nav: [Compass, "#bae6fd"],
  comms: [SatelliteDish, "#ddd6fe"],
  engine: [Rocket, "#fed7aa"],
  cooling: [Snowflake, "#a5f3fc"],
} satisfies Record<string, [LucideIcon, string]>;

export type ChipName = keyof typeof CHIPS;
export type ArtName = StickerName | ChipName;

/** Draw any named piece of game art: a sticker or an icon chip. */
export function Art({ name, size = 28, className, style }: { name: ArtName; size?: number; className?: string; style?: CSSProperties }) {
  if (name in STICKERS) return <Sticker name={name as StickerName} size={size} className={className} style={style} />;
  const [icon, color] = CHIPS[name as ChipName];
  return <IconChip icon={icon} color={color} size={size * 0.9} className={className} style={style} />;
}
