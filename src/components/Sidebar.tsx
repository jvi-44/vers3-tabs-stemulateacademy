import { Home, Trophy, Image as ImageIcon, Package, LogOut, Moon, Sun, Gamepad2, Users } from "lucide-react";
import { cn } from "./ui/utils";

export type Page = "home" | "profile" | "leaderboard" | "gallery" | "cards" | "games" | "friends" | "lesson";

const RING_RADIUS = 42;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

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
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 group w-full"
      aria-label="Go to profile"
    >
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 96 96" className="w-28 h-28 -rotate-90">
          <circle
            cx="48"
            cy="48"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--sidebar-accent)"
            strokeWidth="6"
          />
          <circle
            cx="48"
            cy="48"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.7s ease" }}
          />
        </svg>
        <div
          className={cn(
            "absolute inset-[8px] rounded-full overflow-hidden ring-2 transition-all",
            active ? "ring-primary" : "ring-transparent group-hover:ring-primary/50",
          )}
        >
          <img src={avatar} alt="Your avatar" className="w-full h-full object-cover" />
        </div>
      </div>
      <span className="text-sm font-black text-sidebar-foreground/70">
        Level <span className="text-primary">{level}</span>
      </span>
    </button>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
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
  variant = "desktop",
}: {
  avatar: string;
  level: number;
  progressPct: number;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
  /** "desktop" = the permanent md+ rail (hidden below md).
   *  "mobile" = embedded inside the slide-out drawer, always visible there. */
  variant?: "desktop" | "mobile";
}) {
  return (
    <aside
      className={cn(
        "flex flex-col w-60 shrink-0 bg-sidebar px-4 py-6 gap-6",
        variant === "desktop"
          ? "hidden md:flex h-screen sticky top-0 border-r border-sidebar-border"
          : "flex h-full w-full",
      )}
    >
      <ProfileRing
        avatar={avatar}
        progressPct={progressPct}
        level={level}
        onClick={() => onNavigate("profile")}
        active={currentPage === "profile"}
      />

      <nav className="flex flex-col gap-1.5 flex-1">
        <NavButton
          icon={<Home size={20} />}
          label="Home"
          active={currentPage === "home"}
          onClick={() => onNavigate("home")}
        />
        <NavButton
          icon={<Package size={20} />}
          label="Cards"
          active={currentPage === "cards"}
          onClick={() => onNavigate("cards")}
        />
        <NavButton
          icon={<Trophy size={20} />}
          label="Leaderboard"
          active={currentPage === "leaderboard"}
          onClick={() => onNavigate("leaderboard")}
        />
        <NavButton
          icon={<ImageIcon size={20} />}
          label="Gallery"
          active={currentPage === "gallery"}
          onClick={() => onNavigate("gallery")}
        />
        <NavButton
          icon={<Gamepad2 size={20} />}
          label="Games"
          active={currentPage === "games"}
          onClick={() => onNavigate("games")}
        />
        <NavButton
          icon={<Users size={20} />}
          label="Friends"
          active={currentPage === "friends"}
          onClick={() => onNavigate("friends")}
        />
      </nav>

      <div className="flex flex-col gap-1.5 pt-3 border-t border-sidebar-border">
        <button
          onClick={onToggleDark}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
        >
          {darkMode ? <Sun size={17} /> : <Moon size={17} />}
          <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <LogOut size={17} />
          <span>Log Out</span>
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
  const items: { page: Page; icon: React.ReactNode; label: string }[] = [
    { page: "home", icon: <Home size={22} />, label: "Home" },
    { page: "cards", icon: <Package size={22} />, label: "Cards" },
    { page: "leaderboard", icon: <Trophy size={22} />, label: "Ranks" },
    { page: "gallery", icon: <ImageIcon size={22} />, label: "Gallery" },
    { page: "games", icon: <Gamepad2 size={22} />, label: "Games" },
    { page: "friends", icon: <Users size={22} />, label: "Friends" },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around px-2 py-2 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <button
        onClick={() => onNavigate("profile")}
        className="flex flex-col items-center gap-0.5 px-2 py-1"
      >
        <div
          className={cn(
            "w-7 h-7 rounded-full overflow-hidden ring-2",
            currentPage === "profile" ? "ring-primary" : "ring-transparent",
          )}
        >
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        </div>
        <span
          className={cn(
            "text-[10px] font-bold",
            currentPage === "profile" ? "text-primary" : "text-muted-foreground",
          )}
        >
          Profile
        </span>
      </button>
      {items.map((item) => (
        <button
          key={item.page}
          onClick={() => onNavigate(item.page)}
          className={cn(
            "flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors",
            currentPage === item.page ? "text-primary" : "text-muted-foreground",
          )}
        >
          {item.icon}
          <span className="text-[10px] font-bold">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
