import { Home, Trophy, Package, LogOut, Moon, Sun, Gamepad2, Users } from "lucide-react";
import { cn } from "./ui/utils";
import stemulateLogo from "../assets/stemulate_logo.png";
import { THEMES, type ThemeId } from "../lib/theme";

export type Page = "home" | "profile" | "leaderboard" | "cards" | "games" | "friends" | "lesson";

const RING_RADIUS = 42;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const NAV: { page: Page; icon: React.ReactNode; label: string; short: string }[] = [
  { page: "home", icon: <Home size={20} strokeWidth={2.4} />, label: "Home", short: "Home" },
  { page: "cards", icon: <Package size={20} strokeWidth={2.4} />, label: "Cards", short: "Cards" },
  { page: "games", icon: <Gamepad2 size={20} strokeWidth={2.4} />, label: "Games", short: "Games" },
  { page: "leaderboard", icon: <Trophy size={20} strokeWidth={2.4} />, label: "Leaderboard", short: "Ranks" },
  { page: "friends", icon: <Users size={20} strokeWidth={2.4} />, label: "Friends", short: "Friends" },
];

function ProfileRing({
  avatar,
  progressPct,
  level,
  onClick,
  active,
}: {
  avatar: string;
  progressPct: number;
  level: number;
  onClick: () => void;
  active: boolean;
}) {
  const offset = RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progressPct)));
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 group w-full" aria-label="Go to profile">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 96 96" className="w-28 h-28 -rotate-90">
          <circle cx="48" cy="48" r={RING_RADIUS} fill="var(--card)" stroke="var(--ink-line)" strokeWidth="9" />
          <circle cx="48" cy="48" r={RING_RADIUS} fill="none" stroke="var(--card)" strokeWidth="5" />
          <circle
            cx="48"
            cy="48"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.7s ease" }}
          />
        </svg>
        <div
          className={cn(
            "absolute inset-[11px] rounded-full overflow-hidden bg-soft-1 transition-transform group-hover:scale-105",
            active && "ring-[3px] ring-primary ring-offset-2 ring-offset-sidebar",
          )}
        >
          <img src={avatar} alt="Your avatar" className="w-full h-full object-cover" />
        </div>
        <span className="chip-ink absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs !py-0.5 !px-2.5 bg-pop-2 text-[#1b1b12] rotate-[-4deg]">
          Lv {level}
        </span>
      </div>
    </button>
  );
}

export function Sidebar({
  avatar,
  level,
  progressPct,
  currentPage,
  onNavigate,
  onLogout,
  darkMode,
  onToggleDark,
  theme,
  variant = "desktop",
  logoutLabel = "Log Out",
}: {
  avatar: string;
  level: number;
  progressPct: number;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
  theme: ThemeId;
  /** "desktop" = the permanent md+ rail (hidden below md).
   *  "mobile" = embedded inside the slide-out drawer, always visible there. */
  variant?: "desktop" | "mobile";
  logoutLabel?: string;
}) {
  const themeInfo = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  return (
    <aside
      className={cn(
        "relative flex flex-col w-64 shrink-0 theme-rail px-4 pt-5 pb-4 gap-5 overflow-hidden",
        variant === "desktop"
          ? "hidden md:flex h-screen sticky top-0"
          : "flex h-full w-full !border-r-0",
      )}
    >
      {/* Wordmark, like the website's nav */}
      <div className="flex items-center gap-2 px-1">
        <img src={stemulateLogo} alt="" className="w-10 h-10 object-contain" />
        <div className="leading-none">
          <p className="font-display font-semibold text-[1.05rem] text-sidebar-foreground">STEMulate</p>
          <p className="font-display font-bold text-[1.05rem] text-primary -mt-0.5">Academy</p>
        </div>
      </div>

      <ProfileRing
        avatar={avatar}
        progressPct={progressPct}
        level={level}
        onClick={() => onNavigate("profile")}
        active={currentPage === "profile"}
      />

      <nav className="flex flex-col gap-1.5 flex-1 pt-2">
        {NAV.map((item, i) => {
          const active = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl font-display font-semibold text-[0.98rem] transition-all border-2",
                active
                  ? "bg-primary text-primary-foreground border-ink shadow-[0_4px_0_var(--ink-line)]"
                  : "border-transparent text-sidebar-foreground/75 hover:bg-card hover:text-sidebar-foreground hover:border-sidebar-border",
              )}
              style={active ? { transform: `rotate(${i % 2 ? 1.2 : -1.2}deg)` } : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* The theme's STEMbot waves from the corner, standing on its doodles */}
      <div className="relative h-24 -mx-4 pointer-events-none" aria-hidden="true">
        <div className="absolute left-3 bottom-1 w-12 h-12 motif-icon opacity-60 rotate-[-12deg]" />
        <div className="absolute left-16 bottom-10 w-7 h-7 motif-icon-2 opacity-50 rotate-12" />
        <img src={themeInfo.bot} alt="" className="absolute right-3 -bottom-3 h-24 die-cut bob rotate-[-8deg]" />
        <span className="absolute right-[6.2rem] top-0 bg-card text-[11px] font-black px-2.5 py-1 rounded-full border-2 border-ink">
          Hi!
        </span>
      </div>

      <div className="flex flex-col gap-1 pt-3 border-t-2 border-dashed border-sidebar-border">
        <button
          onClick={onToggleDark}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-2xl text-sm font-bold text-sidebar-foreground/60 hover:bg-card hover:text-sidebar-foreground transition-all"
        >
          {darkMode ? <Sun size={17} /> : <Moon size={17} />}
          <span>{darkMode ? "Light mode" : "Dark mode"}</span>
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-2xl text-sm font-bold text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <LogOut size={17} />
          <span>{logoutLabel}</span>
        </button>
      </div>
    </aside>
  );
}

export function MobileTabBar({
  currentPage,
  onNavigate,
  avatar,
}: {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  avatar: string;
}) {
  return (
    <nav className="md:hidden fixed bottom-3 left-3 right-3 bg-card border-2 border-ink rounded-[1.6rem] shadow-[0_5px_0_var(--ink-line)] flex items-center justify-around px-1.5 py-1.5 z-40">
      {NAV.map((item) => {
        const active = currentPage === item.page;
        return (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-2xl transition-colors min-w-0",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {item.icon}
            <span className="text-[10px] font-black">{item.short}</span>
          </button>
        );
      })}
      <button
        onClick={() => onNavigate("profile")}
        className={cn(
          "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-2xl",
          currentPage === "profile" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
        )}
      >
        <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-ink bg-soft-1">
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        </div>
        <span className="text-[10px] font-black">Me</span>
      </button>
    </nav>
  );
}
