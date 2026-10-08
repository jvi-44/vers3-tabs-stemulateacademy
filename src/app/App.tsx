import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Trophy,
  Search,
  Star,
  Lock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Package,
  Menu,
  Award,
  ArrowRight,
  User as UserIcon,
  Palette,
  Moon,
  Sun,
  LogOut,
  LogIn,
  UserPlus,
  Gamepad2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import confetti from "canvas-confetti";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import {
  MOCK_USER,
  MOCK_COURSES,
  AVATAR_OPTIONS,
  STEMBOTS,
} from "../data/mock";
import { GAME_LESSONS, pointsFor, POINTS_LEGEND, type LessonBeat } from "../data/lessonContent";
import { Course, Module, User as UserType } from "../types";
import { LoginScreen } from "../components/LoginScreen";
import { Sidebar, MobileTabBar, type Page } from "../components/Sidebar";
import { TagFilterBar, EMPTY_SELECTION, hasAnySelection, type TagSelection } from "../components/TagFilterBar";
import { GameLessonExplorer, BeatPlayer, firstIncompleteBeat } from "../components/GameLessonExplorer";
import { StembotShowcase } from "../components/StembotShowcase";
import { Certificate } from "../components/Certificate";
import { GamesTab } from "../components/GamesTab";
import { FriendsTab } from "../components/FriendsTab";
import { CardsHub } from "../components/CardsHub";
import { PHENOMENA_CARDS, FIGURE_CARDS, ALBUM_PACKS, type CollectibleCard, type Rarity } from "../data/cardData";
import stemulateLogo from "../assets/stemulate_logo.png";
import stembotBlue from "../assets/stembot_blue.png";
import stembotRed from "../assets/stembot_red.png";
import stembotGreen from "../assets/stembot_green.png";
import stembotCream from "../assets/stembot_cream.png";
import type { AuthUser } from "../types-auth";
import { getMe, logout } from "../api/auth";
import { getToken } from "../api/client";
import { getProgress, postProgress, postXP, postAvatar } from "../api/progress";
import { setGamePlayer } from "../games/kit/player";
import { syncHighScores } from "../games/kit/scores";
import { getLeaderboard, sendFriendRequest } from "../api/social";
import { useColourTheme, THEMES, type ThemeId } from "../lib/theme";
import { ProfileDetails, PrivacyAndAccount, ThemePicker } from "../components/ProfileSettings";
import { AdminPage } from "../components/AdminPage";
import { avatarFor } from "../components/FriendsTab";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function AtomIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
    </svg>
  );
}

function getSingaporeGreeting() {
  const hourStr = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Singapore",
    hour: "numeric",
    hour12: false,
  });
  const hour = parseInt(hourStr, 10);
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const DARK_MODE_KEY = "stemulate_dark_mode";
const BEATS_KEY_PREFIX = "stemulate_beats_"; // fallback local cache per user

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // Guest mode: look around without an account. Nothing is sent to or saved
  // on the server, and members-only pages (leaderboard, chat) stay locked.
  const [isGuest, setIsGuest] = useState(false);
  const [loginView, setLoginView] = useState<"signin" | "signup">("signin");
  const [user, setUser] = useState<UserType>(MOCK_USER);
  const [userCards, setUserCards] = useState<Record<string, number>>({});
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [completedBeats, setCompletedBeats] = useState<Record<string, boolean>>({});
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [colourTheme, setColourTheme] = useColourTheme();
  const [isAdminRoute, setIsAdminRoute] = useState(() => window.location.hash === "#/admin");
  const mainRef = useRef<HTMLElement>(null);
  const allGameBeatIds = useMemo(() => GAME_LESSONS.flatMap((l) => l.beats.map((b) => b.id)), []);

  // ---- Admin page lives at /#/admin ----
  useEffect(() => {
    const onHash = () => setIsAdminRoute(window.location.hash === "#/admin");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Each page starts at the top, not where the last page was scrolled to.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [currentPage]);

  // ---- Dark mode ----
  useEffect(() => {
    const saved = localStorage.getItem(DARK_MODE_KEY);
    if (saved === "1") setDarkMode(true);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem(DARK_MODE_KEY, darkMode ? "1" : "0");
  }, [darkMode]);

  // ---- Auth ----
  // Lets the lesson games know who is playing (for high scores and live rooms).
  useEffect(() => {
    if (!authUser) return;
    // Other players in live games see the username, never the full name.
    setGamePlayer({ id: String(authUser.userId), userId: authUser.userId, name: authUser.username, avatar: user.avatar });
    syncHighScores(authUser.userId);
  }, [authUser, user.avatar]);

  const applyAuthUser = (u: AuthUser) => {
    setIsGuest(false);
    setAuthUser(u);
    setUser((prev) => ({
      ...prev,
      username: u.fullName,
      xp: u.xp,
      level: u.level,
      atoms: u.atoms,
      avatar: u.avatar || prev.avatar,
    }));
    setIsLoggedIn(true);

    // Fill in organisation / school level for the profile page.
    getMe()
      .then(({ user: full }) => setAuthUser(full))
      .catch(() => {});

    // Pull lesson progress from SQLite so completed beats persist across
    // devices / refreshes (see SQL_EXPLAINED.md for how this is stored).
    getProgress(u.userId)
      .then(({ progress }) => {
        const map: Record<string, boolean> = {};
        progress.forEach((p) => {
          if (p.status === "completed") map[p.lesson_id] = true;
        });
        setCompletedBeats(map);
      })
      .catch(() => {
        const cached = localStorage.getItem(BEATS_KEY_PREFIX + u.userId);
        if (cached) setCompletedBeats(JSON.parse(cached));
      });
  };

  const handleLogin = (u: AuthUser) => applyAuthUser(u);

  // Restore the sign-in after a refresh, using the saved session token.
  useEffect(() => {
    localStorage.removeItem("stemulate_user_id"); // pre-token sign-ins: sign in again
    if (!getToken()) return;
    getMe()
      .then(({ user: u }) => applyAuthUser(u))
      .catch(() => {});
  }, []);

  const resetLocalState = () => {
    setUser(MOCK_USER);
    setCompletedBeats({});
    setUserCards({});
    setCurrentPage("home");
  };

  const handleLogout = () => {
    if (!isGuest) logout();
    setAuthUser(null);
    setIsGuest(false);
    setIsLoggedIn(false);
    setLoginView("signin");
    resetLocalState();
  };

  const handleGuest = () => {
    resetLocalState();
    setUser({ ...MOCK_USER, username: "Guest", xp: 0, level: 1, atoms: 0, badges: [] });
    setGamePlayer({ id: "guest", name: "Guest", avatar: MOCK_USER.avatar });
    setIsGuest(true);
    setIsLoggedIn(true);
  };

  // From guest mode back to the sign-in / sign-up screen.
  const leaveGuest = (view: "signin" | "signup") => {
    handleLogout();
    setLoginView(view);
  };

  // ---- Points ----
  const handleEarnXP = (amount: number) => {
    if (!amount) return 1;
    const newXP = user.xp + amount;
    const newLevel = Math.floor(newXP / 1000) + 1;
    if (newLevel > user.level) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      toast.success(`LEVEL UP! You are now Level ${newLevel}!`);
    } else {
      toast.success(`+${amount} XP Earned!`);
    }
    setUser((prev) => ({ ...prev, xp: newXP, level: newLevel }));
    return newLevel;
  };

  const handleEarnAtoms = (amount: number) => {
    if (!amount) return;
    setUser((prev) => ({ ...prev, atoms: prev.atoms + amount }));
    toast.success(`+${amount} Atoms Earned! ⚛️`);
  };

  const handleUpdateAvatar = (avatar: string) => {
    setUser((prev) => ({ ...prev, avatar }));
    if (authUser) {
      postAvatar(authUser.userId, avatar).catch(() =>
        toast.error("Avatar changed here, but couldn't save it to your account."),
      );
    }
    toast.success("Avatar updated!");
  };

  const handleBeatComplete = (beat: LessonBeat, scoreRatio?: number, reflection?: string) => {
    const p = pointsFor(beat);
    let xp = p.xp;
    if (beat.type === "quiz" && typeof scoreRatio === "number") {
      const min = (p as any).xpMin ?? 50;
      xp = Math.round(min + (100 - min) * scoreRatio);
    }
    const newLevel = handleEarnXP(xp);
    handleEarnAtoms(p.atoms);

    if (beat.type === "exit" && reflection) {
      toast.success(
        isGuest ? "Lovely reflection! Create an account to keep your progress." : "Reflection saved. Great thinking! 🎉",
      );
    }

    setCompletedBeats((prev) => {
      const next = { ...prev, [beat.id]: true };
      if (authUser) localStorage.setItem(BEATS_KEY_PREFIX + authUser.userId, JSON.stringify(next));
      return next;
    });

    if (authUser) {
      const score = beat.type === "quiz" && typeof scoreRatio === "number" ? Math.round(scoreRatio * 100) : null;
      postProgress(authUser.userId, beat.id, "completed", score).catch(() => {});
      postXP(authUser.userId, user.xp + xp, newLevel, user.atoms + p.atoms).catch(() => {});
    }
  };

  const openBeat = (lessonId: string, beatId: string) => {
    setSelectedLessonId(lessonId);
    setSelectedBeatId(beatId);
    setCurrentPage("lesson");
  };

  const RARITY_WEIGHTS: Record<Rarity, number> = { common: 55, rare: 28, epic: 13, legendary: 4 };

  const handleOpenPack = (albumKey: "phenomena" | "figures", packId: string): CollectibleCard[] | null => {
    const pool = albumKey === "phenomena" ? PHENOMENA_CARDS : FIGURE_CARDS;
    const pack = ALBUM_PACKS[albumKey].find((p) => p.id === packId);
    if (!pack) return null;
    if (user.atoms < pack.cost) {
      toast.error("Not enough Atoms for that pack!");
      return null;
    }

    const drawOne = (): CollectibleCard => {
      const total = pool.reduce((sum, c) => sum + RARITY_WEIGHTS[c.rarity], 0);
      let roll = Math.random() * total;
      for (const card of pool) {
        roll -= RARITY_WEIGHTS[card.rarity];
        if (roll <= 0) return card;
      }
      return pool[0];
    };

    const drawn = Array.from({ length: pack.cardsCount }, drawOne);
    setUser((prev) => ({ ...prev, atoms: prev.atoms - pack.cost }));
    setUserCards((prev) => {
      const next = { ...prev };
      drawn.forEach((c) => {
        next[c.id] = (next[c.id] ?? 0) + 1;
      });
      return next;
    });
    return drawn;
  };

  const handleAccountDeleted = () => {
    if (authUser) localStorage.removeItem(BEATS_KEY_PREFIX + authUser.userId);
    if (authUser) localStorage.removeItem(`stemulate_game_best_${authUser.userId}`);
    setAuthUser(null);
    setIsLoggedIn(false);
    setCompletedBeats({});
    setUser(MOCK_USER);
    setCurrentPage("home");
    toast.success("Your account and all its data have been deleted.");
  };

  if (isAdminRoute) return <AdminPage onExit={() => (window.location.hash = "")} />;

  if (!isLoggedIn)
    return <LoginScreen key={loginView} onLogin={handleLogin} onGuest={handleGuest} initialView={loginView} />;

  const activeLesson = GAME_LESSONS.find((l) => l.id === selectedLessonId);

  if (currentPage === "lesson" && activeLesson && selectedBeatId) {
    return (
      <>
        <Toaster position="top-center" />
        <BeatPlayer
          lesson={activeLesson}
          activeBeatId={selectedBeatId}
          completedBeats={completedBeats}
          onSelectBeat={(id) => setSelectedBeatId(id)}
          onComplete={handleBeatComplete}
          onBack={() => setCurrentPage("home")}
        />
      </>
    );
  }

  const progressPct = (user.xp % 1000) / 1000;
  const xpIntoLevel = user.xp % 1000;
  const xpToGo = 1000 - xpIntoLevel;

  const gamesModuleComplete = allGameBeatIds.length > 0 && allGameBeatIds.every((id) => completedBeats[id]);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background text-foreground">
      <Toaster position="top-center" />

      <Sidebar
        avatar={user.avatar}
        level={user.level}
        progressPct={progressPct}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onLogout={handleLogout}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
        logoutLabel={isGuest ? "Leave guest mode" : "Log Out"}
        theme={colourTheme}
      />

      <div className="flex-1 min-w-0 h-screen flex flex-col overflow-hidden">
        {/* Top bar: greeting and level progress on the left, XP, Atoms and
            the account menu on the right. Paper-coloured like the website nav. */}
        <header className="shrink-0 h-[76px] bg-background/90 backdrop-blur border-b-2 border-border px-4 md:px-8 flex items-center justify-between gap-4 relative z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden p-2 -ml-2 text-foreground"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <img src={stemulateLogo} alt="" className="w-9 h-9 object-contain md:hidden shrink-0" />
            <div className="min-w-0">
              <p className="font-display font-bold text-lg sm:text-xl text-foreground truncate leading-tight">
                <span className="hidden sm:inline">{getSingaporeGreeting()}, </span>
                <span className="sm:hidden">Hi, </span>
                {user.username.split(" ")[0]}!
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="meter w-24 sm:w-40 !h-2.5 !border-[1.5px]">
                  <span style={{ width: `${progressPct * 100}%` }} />
                </div>
                <span className="text-[11px] font-extrabold text-muted-foreground whitespace-nowrap hidden sm:inline">
                  {xpToGo} XP to Level {user.level + 1}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <div className="chip-ink bg-soft-1 text-sm rotate-[-2deg]" title="Your XP">
              <Star size={16} className="fill-amber-400 text-amber-500" strokeWidth={2.5} />
              {user.xp.toLocaleString()}
              <span className="hidden sm:inline text-xs opacity-70">XP</span>
            </div>
            <div className="chip-ink bg-soft-3 text-sm rotate-[2deg] hidden sm:inline-flex" title="Your Atoms">
              <AtomIcon size={16} className="text-pop-3" />
              {user.atoms.toLocaleString()}
            </div>
            <AccountMenu
              avatar={user.avatar}
              name={authUser?.username ?? user.username}
              theme={colourTheme}
              onTheme={setColourTheme}
              darkMode={darkMode}
              onToggleDark={() => setDarkMode((d) => !d)}
              onProfile={() => setCurrentPage("profile")}
              onLogout={handleLogout}
              isGuest={isGuest}
              onSignUp={() => leaveGuest("signup")}
              onSignIn={() => leaveGuest("signin")}
            />
          </div>
        </header>

        {isGuest && (
          <div className="shrink-0 bg-soft-3 text-foreground border-b-2 border-border px-4 md:px-8 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm font-bold">
            <span className="min-w-0">👀 You're exploring as a guest. Your progress won't be saved.</span>
            <button onClick={() => leaveGuest("signup")} className="btn-pop btn-pop-sm btn-primary shrink-0">
              Create account
            </button>
          </div>
        )}

        <main ref={mainRef} className="flex-1 overflow-y-auto bg-playful p-4 md:p-8 pb-28 md:pb-10">
          {/* One fixed content width for every page, so screens don't jump
              around in size as you move between tabs. */}
          <div className="max-w-6xl mx-auto w-full min-h-full">
          {currentPage === "home" && (
            <Dashboard
              courses={MOCK_COURSES}
              firstName={user.username.split(" ")[0]}
              completedBeats={completedBeats}
              onOpenBeat={openBeat}
              gamesModuleComplete={gamesModuleComplete}
              onShowCertificate={() => setShowCertificate(true)}
            />
          )}
          {currentPage === "profile" && authUser && (
            <Profile
              authUser={authUser}
              onAuthUserChange={(u) => {
                setAuthUser(u);
                setUser((prev) => ({ ...prev, username: u.fullName }));
              }}
              onAccountDeleted={handleAccountDeleted}
              theme={colourTheme}
              onTheme={setColourTheme}
              user={user}
              onUpdateAvatar={handleUpdateAvatar}
              gamesModuleComplete={gamesModuleComplete}
              onShowCertificate={() => setShowCertificate(true)}
            />
          )}
          {isGuest && (currentPage === "leaderboard" || currentPage === "friends" || currentPage === "profile") && (
            <MembersOnly
              page={currentPage}
              onSignUp={() => leaveGuest("signup")}
              onSignIn={() => leaveGuest("signin")}
            />
          )}
          {currentPage === "leaderboard" && !isGuest && (
            <Leaderboard myUserId={authUser?.userId ?? 0} />
          )}
          {currentPage === "games" && (
            <GamesTab
              completedBeats={completedBeats}
              onOpenBeat={openBeat}
              onReplay={(xp, atoms) => {
                handleEarnXP(xp);
                handleEarnAtoms(atoms);
              }}
              isGuest={isGuest}
            />
          )}
          {currentPage === "friends" && authUser && <FriendsTab myUserId={authUser.userId} />}
          {currentPage === "cards" && (
            <CardsHub ownedCounts={userCards} userAtoms={user.atoms} onOpenPack={handleOpenPack} />
          )}
          </div>
        </main>
      </div>

      <MobileTabBar currentPage={currentPage} onNavigate={setCurrentPage} avatar={user.avatar} />

      {/* Mobile slide-out drawer for profile ring / dark mode / logout */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed top-0 left-0 bottom-0 w-64 bg-sidebar z-50 md:hidden flex flex-col"
            >
              <Sidebar
                variant="mobile"
                avatar={user.avatar}
                level={user.level}
                progressPct={progressPct}
                currentPage={currentPage}
                onNavigate={(p) => {
                  setCurrentPage(p);
                  setMobileMenuOpen(false);
                }}
                onLogout={handleLogout}
                darkMode={darkMode}
                onToggleDark={() => setDarkMode((d) => !d)}
                logoutLabel={isGuest ? "Leave guest mode" : "Log Out"}
                theme={colourTheme}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {showCertificate && (
        <Certificate
          studentName={user.username}
          moduleName="STEM x Games"
          onClose={() => setShowCertificate(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const COMING_SOON_STYLE: Record<string, { emoji: string; bg: string; tilt: string }> = {
  sports: { emoji: "⚽", bg: "bg-soft-2", tilt: "-rotate-1" },
  magic: { emoji: "🪄", bg: "bg-soft-3", tilt: "rotate-1" },
  content: { emoji: "🎬", bg: "bg-soft-1", tilt: "-rotate-[0.6deg]" },
};

function Dashboard({
  courses,
  firstName,
  completedBeats,
  onOpenBeat,
  gamesModuleComplete,
  onShowCertificate,
}: {
  courses: Course[];
  firstName: string;
  completedBeats: Record<string, boolean>;
  onOpenBeat: (lessonId: string, beatId: string) => void;
  gamesModuleComplete: boolean;
  onShowCertificate: () => void;
}) {
  const [gamesExpanded, setGamesExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagSelection, setTagSelection] = useState<TagSelection>(EMPTY_SELECTION());

  const activeFilters = hasAnySelection(tagSelection) || searchQuery.trim().length > 0;

  const matches = useMemo(() => {
    if (!activeFilters) return [];
    const q = searchQuery.trim().toLowerCase();
    const subjectTags = [...tagSelection.science, ...tagSelection.math];
    const results: { lessonTitle: string; lessonId: string; beat: LessonBeat }[] = [];
    GAME_LESSONS.forEach((lesson) => {
      lesson.beats.forEach((beat) => {
        const matchesText =
          !q ||
          beat.title.toLowerCase().includes(q) ||
          beat.topicLabel.toLowerCase().includes(q) ||
          beat.description.toLowerCase().includes(q);
        const matchesLevel =
          tagSelection.level.length === 0 || beat.levelTags.some((t) => tagSelection.level.includes(t));
        const matchesSubject =
          subjectTags.length === 0 || beat.subjectTags.some((t) => subjectTags.includes(t));
        if (matchesText && matchesLevel && matchesSubject) {
          results.push({ lessonTitle: lesson.title, lessonId: lesson.id, beat });
        }
      });
    });
    return results;
  }, [activeFilters, searchQuery, tagSelection]);

  const gamesCourse = courses.find((c) => c.id === "games");
  const lockedCourses = courses.filter((c) => c.id !== "games");
  const allGameBeats = GAME_LESSONS.flatMap((l) => l.beats);
  const gamesDone = allGameBeats.filter((b) => completedBeats[b.id]).length;
  const gamesPct = Math.round((gamesDone / allGameBeats.length) * 100);

  // Where "Keep going" takes you: the first unfinished activity.
  const nextLesson = GAME_LESSONS.find((l) => l.beats.some((b) => !completedBeats[b.id])) ?? GAME_LESSONS[0];
  const nextBeat = firstIncompleteBeat(nextLesson, completedBeats);

  return (
    <div className="space-y-7 w-full">
      {/* Welcome banner: theme colour with its doodles, the four STEMbots
          as die-cut stickers, and one big button back into the lessons. */}
      <section className="panel-pop overflow-hidden px-6 py-7 sm:px-9 sm:py-9">
        <div className="relative z-10 max-w-[30rem]">
          <span className="kicker kicker-on">STEM x Games</span>
          <h1 className="font-display !text-[clamp(1.9rem,1.2rem+2.2vw,3rem)] !leading-[1.05] mt-4 mb-3">
            Ready for a new <span className="mark-pop">why?</span> today, {firstName}?
          </h1>
          <p className="font-semibold opacity-90 mb-5">
            {gamesDone === 0
              ? "Your first adventure is waiting. Watch, play and earn Atoms for your card albums!"
              : gamesDone === allGameBeats.length
                ? "You finished every activity. Replay the games to beat your high scores!"
                : `You're ${gamesPct}% through. Up next: ${nextBeat.title}.`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => onOpenBeat(nextLesson.id, nextBeat.id)} className="btn-pop text-base">
              {gamesDone === 0 ? "Start learning" : "Keep going"} <ArrowRight size={18} strokeWidth={2.6} />
            </button>
            {gamesModuleComplete && (
              <button onClick={onShowCertificate} className="btn-pop btn-pop2 text-base">
                <Award size={18} /> My certificate
              </button>
            )}
          </div>
        </div>
        <div className="hidden md:block absolute right-3 lg:right-8 bottom-0 top-6 w-[44%] max-w-[480px] pointer-events-none" aria-hidden="true">
          {[
            { src: stembotGreen, cls: "left-[0%] h-[50%] rotate-[-8deg]", delay: "0s" },
            { src: stembotBlue, cls: "left-[24%] h-[58%] rotate-[4deg]", delay: "-1.2s" },
            { src: stembotCream, cls: "left-[49%] h-[52%] rotate-[-4deg]", delay: "-2.4s" },
            { src: stembotRed, cls: "left-[73%] h-[56%] rotate-[7deg]", delay: "-3.6s" },
          ].map((b, i) => (
            <img key={i} src={b.src} alt="" className={cn("absolute bottom-[-4%] die-cut bob", b.cls)} style={{ animationDelay: b.delay }} />
          ))}
        </div>
      </section>

      <StembotShowcase />

      {/* Search + tag filters */}
      <section className="sticker p-4 sm:p-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} strokeWidth={2.5} />
          <input
            type="text"
            placeholder="Search for topics or lessons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-5 py-3.5 bg-input-background border-2 border-border rounded-full focus:border-primary outline-none font-bold placeholder:text-muted-foreground/70 transition-colors"
          />
        </div>
        <TagFilterBar selection={tagSelection} onChange={setTagSelection} />
      </section>

      {/* Filtered topic results */}
      {activeFilters && (
        <div className="space-y-3">
          <p className="kicker">
            {matches.length} matching topic{matches.length === 1 ? "" : "s"}
          </p>
          {matches.length === 0 && (
            <p className="sticker text-sm font-semibold text-muted-foreground p-5">
              No topics match those filters yet. More modules are on the way!
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matches.map(({ lessonTitle, lessonId, beat }) => (
              <button
                key={beat.id}
                onClick={() => onOpenBeat(lessonId, beat.id)}
                className="sticker text-left p-4 hover:-translate-y-1 hover:border-primary transition-all"
              >
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary">{lessonTitle}</p>
                <p className="font-display font-semibold text-foreground">{beat.title}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {[...beat.levelTags, ...beat.subjectTags].map((t) => (
                    <span key={t} className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-soft-1 text-foreground/80">
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!activeFilters && (
        <>
          {/* The one open module: STEM x Games. Lessons expand right here. */}
          {gamesCourse && (
            <section className="sticker overflow-hidden">
              <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground border-[2.5px] border-ink shadow-[0_4px_0_var(--ink-line)] flex items-center justify-center shrink-0 rotate-[-4deg]">
                  <Gamepad2 size={28} strokeWidth={2.4} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display text-foreground !text-2xl">{gamesCourse.title}</h2>
                    {gamesModuleComplete && (
                      <span className="chip-ink !text-xs !py-0.5 bg-pop-2 text-[#1b1b12]">
                        <Award size={13} /> Badge earned
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-bold">
                    {gamesCourse.modules.length} lessons · {gamesDone}/{allGameBeats.length} activities done
                  </p>
                  <div className="meter mt-2.5 max-w-md">
                    <span style={{ width: `${gamesPct}%` }} />
                  </div>
                </div>
                <button onClick={() => setGamesExpanded((v) => !v)} className="btn-pop btn-pop-sm self-start sm:self-center">
                  {gamesExpanded ? "Hide lessons" : "Show lessons"}
                  {gamesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              <AnimatePresence initial={false}>
                {gamesExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 sm:px-6 pb-6 pt-1 border-t-2 border-dashed border-border bg-background/60">
                      <div className="pt-5">
                        <GameLessonExplorer lessons={GAME_LESSONS} completedBeats={completedBeats} onOpenBeat={onOpenBeat} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}

          {/* Modules on the way */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-display text-foreground !text-xl">Coming soon</h2>
              <span className="kicker kicker-3">New modules</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {lockedCourses.map((course) => {
                const st = COMING_SOON_STYLE[course.id] ?? { emoji: "✨", bg: "bg-soft-1", tilt: "" };
                return (
                  <div
                    key={course.id}
                    className={cn("relative rounded-[1.6rem] border-2 border-dashed border-foreground/25 p-5 overflow-hidden", st.bg, st.tilt)}
                  >
                    <div className="absolute -right-3 -bottom-3 w-20 h-20 motif-icon opacity-30 rotate-12" aria-hidden="true" />
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-4xl drop-shadow-sm">{st.emoji}</span>
                      <span className="chip-ink !text-[11px] !py-0.5">
                        <Lock size={12} /> Soon
                      </span>
                    </div>
                    <h3 className="font-display text-foreground">{course.title}</h3>
                    <p className="text-xs text-muted-foreground font-bold">{course.modules.length} modules</p>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function StatsCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-soft-1 px-5 py-3 rounded-2xl text-center border-2 border-ink shadow-[0_3px_0_var(--ink-line)] odd:rotate-[-1.5deg] even:rotate-[1.5deg]">
      <p className="text-xl font-black text-foreground">{value}</p>
      <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

const LEVEL_NAMES = [
  "Curious Newbie",
  "Young Explorer",
  "Keen Investigator",
  "Rising Innovator",
  "Sharp Discoverer",
  "STEM Trailblazer",
  "Master Scientist",
  "Academy Star",
  "STEMulate Legend",
  "Grandmaster Explorer",
];

function levelName(level: number) {
  return LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1] ?? `Level ${level} Explorer`;
}

function Profile({
  authUser,
  onAuthUserChange,
  onAccountDeleted,
  theme,
  onTheme,
  user,
  onUpdateAvatar,
  gamesModuleComplete,
  onShowCertificate,
}: {
  authUser: AuthUser;
  onAuthUserChange: (u: AuthUser) => void;
  onAccountDeleted: () => void;
  theme: ThemeId;
  onTheme: (t: ThemeId) => void;
  user: UserType;
  onUpdateAvatar: (avatar: string) => void;
  gamesModuleComplete: boolean;
  onShowCertificate: () => void;
}) {
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const xpIntoLevel = user.xp % 1000;
  const xpToGo = 1000 - xpIntoLevel;

  return (
    <div className="w-full space-y-6">
      <div className="panel-pop p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 overflow-hidden">
        <div className="relative shrink-0">
          <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-ink bg-card shadow-[0_6px_0_var(--ink-line)]">
            <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <button
            onClick={() => setIsEditingAvatar(!isEditingAvatar)}
            className="absolute -bottom-1 -right-1 bg-card w-11 h-11 rounded-full flex items-center justify-center border-[2.5px] border-ink shadow-[0_3px_0_var(--ink-line)] hover:-translate-y-0.5 transition-transform"
            aria-label="Change avatar"
          >
            ✏️
          </button>
        </div>

        <div className="text-center md:text-left flex-1 w-full">
          <div className="flex flex-col md:flex-row items-center gap-3 mb-1">
            <h1 className="font-display !text-[clamp(1.6rem,1.2rem+1.2vw,2.3rem)] truncate max-w-full">{authUser.fullName}</h1>
            <span className="kicker kicker-on">
              Level {user.level} · {levelName(user.level)}
            </span>
          </div>
          <p className="font-bold opacity-85 mb-3 truncate">
            @{authUser.username}
            {authUser.orgName ? ` · ${authUser.orgName}` : ""}
          </p>
          <div className="max-w-xs mx-auto md:mx-0 mb-6">
            <div className="meter">
              <span style={{ width: `${(xpIntoLevel / 1000) * 100}%` }} className="!bg-[#ffe066]" />
            </div>
            <p className="text-xs font-extrabold opacity-85 mt-1.5">
              {xpToGo} XP to Level {user.level + 1} ({levelName(user.level + 1)})
            </p>
          </div>
          <div className="flex flex-wrap justify-center md:justify-start gap-3 text-foreground">
            <StatsCard label="Total XP" value={user.xp.toLocaleString()} />
            <StatsCard label="Atoms" value={user.atoms.toLocaleString()} />
            <StatsCard label="Badges" value={String(user.badges.length + (gamesModuleComplete ? 1 : 0))} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isEditingAvatar && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="sticker p-6 overflow-hidden"
          >
            <p className="font-bold text-foreground mb-4">Choose your avatar</p>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {AVATAR_OPTIONS.map((src) => (
                <button
                  key={src}
                  onClick={() => {
                    onUpdateAvatar(src);
                    setIsEditingAvatar(false);
                  }}
                  className={cn(
                    "aspect-square rounded-2xl overflow-hidden ring-2 transition-all hover:ring-primary",
                    user.avatar === src ? "ring-primary" : "ring-transparent",
                  )}
                >
                  <img src={src} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProfileDetails authUser={authUser} onChange={onAuthUserChange} />

      <ThemePicker theme={theme} onTheme={onTheme} />

      <div className="sticker p-6">
        <h2 className="font-display text-foreground !text-xl mb-4">Badges &amp; certificates</h2>
        <div className="flex flex-wrap gap-4">
          {user.badges.map((b) => (
            <div key={b.id} className="flex flex-col items-center gap-1 w-20">
              <div className="w-14 h-14 rounded-2xl bg-soft-1 border-2 border-ink shadow-[0_3px_0_var(--ink-line)] flex items-center justify-center text-2xl">{b.icon}</div>
              <p className="text-[10px] font-bold text-center text-muted-foreground">{b.name}</p>
            </div>
          ))}
          {gamesModuleComplete && (
            <button onClick={onShowCertificate} className="flex flex-col items-center gap-1 w-20">
              <div className="w-14 h-14 rounded-2xl bg-pop-2 border-2 border-ink shadow-[0_3px_0_var(--ink-line)] flex items-center justify-center text-[#1b1b12]">
                <Award size={24} />
              </div>
              <p className="text-[10px] font-bold text-center text-muted-foreground">STEM x Games</p>
            </button>
          )}
          {!gamesModuleComplete && user.badges.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Complete a module to earn your first badge and certificate!
            </p>
          )}
        </div>
      </div>

      <div className="sticker p-6">
        <h2 className="font-display text-foreground !text-xl mb-4">Levels</h2>
        <div className="space-y-2">
          {LEVEL_NAMES.map((name, i) => {
            const lvl = i + 1;
            const reached = user.level >= lvl;
            const current = user.level === lvl;
            return (
              <div
                key={lvl}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-2xl",
                  current ? "bg-soft-1 border-2 border-ink shadow-[0_3px_0_var(--ink-line)]" : "border-2 border-transparent",
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0",
                    reached ? "bg-primary text-primary-foreground border-2 border-ink" : "bg-muted text-muted-foreground",
                  )}
                >
                  {lvl}
                </div>
                <p className={cn("text-sm font-bold", reached ? "text-foreground" : "text-muted-foreground")}>{name}</p>
                <span className="text-[10px] text-muted-foreground ml-auto">{(lvl - 1) * 1000}+ XP</span>
              </div>
            );
          })}
        </div>
      </div>

      <PrivacyAndAccount authUser={authUser} onDeleted={onAccountDeleted} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

function Leaderboard({ myUserId }: { myUserId: number }) {
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof getLeaderboard>>["entries"]>([]);
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState<Record<number, boolean>>({});

  useEffect(() => {
    getLeaderboard()
      .then(({ entries }) => setEntries(entries))
      .catch(() => toast.error("Couldn't load the leaderboard."))
      .finally(() => setLoading(false));
  }, []);

  // Friend requests from here go to real accounts only (the server checks).
  const addFriend = async (username: string, userId: number) => {
    try {
      const res = await sendFriendRequest(username);
      setRequested((r) => ({ ...r, [userId]: true }));
      toast.success(
        res.status === "friends" ? `You and ${username} are now friends! 🎉` : `Friend request sent to ${username}!`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  // Podium order on screen: 2nd, 1st, 3rd.
  const PODIUM = [
    { place: 2, h: "h-24", bg: "bg-slate-200", medal: "🥈" },
    { place: 1, h: "h-32", bg: "bg-amber-300", medal: "🥇" },
    { place: 3, h: "h-16", bg: "bg-orange-300", medal: "🥉" },
  ];

  const friendButton = (entry: (typeof entries)[number]) => (
    <button
      onClick={() => addFriend(entry.username, entry.userId)}
      disabled={entry.isFriend || !!requested[entry.userId]}
      className="btn-pop btn-pop-sm !text-xs !px-2.5 !py-1.5 shrink-0"
    >
      {entry.isFriend ? "Friends" : requested[entry.userId] ? "Sent" : "+ Friend"}
    </button>
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="kicker">
            <Trophy size={13} /> Leaderboard
          </span>
          <h1 className="font-display text-foreground !text-[clamp(1.8rem,1.3rem+1.5vw,2.6rem)] mt-3 mb-1">Top explorers</h1>
          <p className="text-muted-foreground font-semibold">Ranked by total XP. Finish lessons and replay games to climb!</p>
        </div>
      </div>

      {loading && <p className="sticker p-5 text-sm font-semibold text-muted-foreground">Loading…</p>}
      {!loading && entries.length === 0 && (
        <p className="sticker p-5 text-sm font-semibold text-muted-foreground">No one on the board yet. Finish a lesson to be first!</p>
      )}

      {podium.length > 0 && (
        <section className="panel-pop px-4 pt-8 sm:px-10 overflow-hidden">
          <div className="flex items-end justify-center gap-3 sm:gap-6 max-w-xl mx-auto">
            {PODIUM.map(({ place, h, bg, medal }) => {
              const entry = podium[place - 1];
              if (!entry) return <div key={place} className="flex-1" />;
              const isMe = entry.userId === myUserId;
              return (
                <div key={place} className="flex-1 flex flex-col items-center min-w-0">
                  <div className="relative">
                    <img
                      src={avatarFor(entry)}
                      alt=""
                      className={cn(
                        "rounded-full bg-card border-[3px] border-ink object-cover shadow-[0_4px_0_var(--ink-line)]",
                        place === 1 ? "w-20 h-20 sm:w-24 sm:h-24" : "w-14 h-14 sm:w-16 sm:h-16",
                      )}
                    />
                    <span className="absolute -bottom-2 -right-2 text-2xl drop-shadow">{medal}</span>
                  </div>
                  <p className="font-display font-bold mt-3 truncate max-w-full text-center">
                    {entry.username}
                    {isMe && " (you)"}
                  </p>
                  <p className="text-xs font-extrabold opacity-85 mb-2">{entry.xp.toLocaleString()} XP</p>
                  {!isMe && <div className="mb-3 text-foreground">{friendButton(entry)}</div>}
                  <div
                    className={cn(
                      "w-full rounded-t-2xl border-[2.5px] border-b-0 border-ink flex items-start justify-center pt-2 font-display font-bold text-3xl text-[#1c1a17]",
                      h,
                      bg,
                    )}
                  >
                    {place}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <div className="sticker divide-y-2 divide-dashed divide-border overflow-hidden">
          {rest.map((entry, i) => {
            const isMe = entry.userId === myUserId;
            return (
              <div key={entry.userId} className={cn("flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3", isMe && "bg-soft-1")}>
                <span className="w-8 text-center font-display font-bold text-lg text-muted-foreground">{i + 4}</span>
                <img src={avatarFor(entry)} className="w-11 h-11 rounded-full bg-soft-1 border-2 border-ink" />
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-foreground truncate">
                    {entry.username} {isMe && <span className="text-muted-foreground font-medium">(you)</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase font-extrabold tracking-wide">
                    Level {Math.floor(entry.xp / 1000) + 1}
                  </p>
                </div>
                <span className="font-display font-bold text-foreground whitespace-nowrap">{entry.xp.toLocaleString()} XP</span>
                {!isMe && friendButton(entry)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Members-only pages, shown to guests instead of the leaderboard, chat and
// profile (they hold other students' data or need an account to save).
// ---------------------------------------------------------------------------

const MEMBERS_ONLY_TEXT: Partial<Record<Page, { title: string; body: string }>> = {
  leaderboard: {
    title: "The leaderboard is for members",
    body: "Create a free account to earn XP, climb the leaderboard and see how you rank against other explorers.",
  },
  friends: {
    title: "Friends and chat are for members",
    body: "To keep everyone safe, only students with an account can add friends and chat.",
  },
  profile: {
    title: "Make it yours with an account",
    body: "Pick an avatar, collect badges and keep your progress by creating a free account.",
  },
};

function MembersOnly({ page, onSignUp, onSignIn }: { page: Page; onSignUp: () => void; onSignIn: () => void }) {
  const text = MEMBERS_ONLY_TEXT[page] ?? MEMBERS_ONLY_TEXT.profile!;
  return (
    <div className="w-full flex justify-center pt-6">
      <div className="sticker p-8 pt-0 max-w-md w-full text-center mt-14">
        <div className="flex justify-center -space-x-5 -mt-14 mb-3">
          {[stembotGreen, stembotBlue, stembotRed].map((src, i) => (
            <img key={i} src={src} alt="" className={cn("h-24 w-24 object-contain die-cut bob", i === 1 && "-translate-y-3")} style={{ animationDelay: `${-i * 1.1}s` }} />
          ))}
        </div>
        <span className="kicker kicker-3">
          <Lock size={12} /> Members only
        </span>
        <h2 className="font-display text-foreground !text-2xl mt-3 mb-2">{text.title}</h2>
        <p className="text-sm font-semibold text-muted-foreground mb-6">{text.body}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={onSignUp} className="btn-pop btn-primary">
            Create an account
          </button>
          <button onClick={onSignIn} className="btn-pop">
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account menu (avatar drop-down in the top bar)
// ---------------------------------------------------------------------------

function AccountMenu({
  avatar,
  name,
  theme,
  onTheme,
  darkMode,
  onToggleDark,
  onProfile,
  onLogout,
  isGuest,
  onSignUp,
  onSignIn,
}: {
  avatar: string;
  name: string;
  theme: ThemeId;
  onTheme: (t: ThemeId) => void;
  darkMode: boolean;
  onToggleDark: () => void;
  onProfile: () => void;
  onLogout: () => void;
  isGuest: boolean;
  onSignUp: () => void;
  onSignIn: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-11 h-11 rounded-full overflow-hidden border-[2.5px] border-ink shadow-[0_3px_0_var(--ink-line)] bg-soft-1 shrink-0 hover:-translate-y-0.5 transition-transform"
          aria-label="Account menu"
        >
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl">
        <DropdownMenuLabel className="truncate">{isGuest ? "Guest" : `@${name}`}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isGuest ? (
          <>
            <DropdownMenuItem onSelect={onSignUp}>
              <UserPlus size={15} /> Create an account
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onSignIn}>
              <LogIn size={15} /> Sign in
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={onProfile}>
            <UserIcon size={15} /> View profile
          </DropdownMenuItem>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Palette size={15} className="text-muted-foreground" /> Colour theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="rounded-2xl">
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => onTheme(v as ThemeId)}>
              {THEMES.map((t) => (
                <DropdownMenuRadioItem key={t.id} value={t.id}>
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ background: `linear-gradient(135deg, ${t.swatch.join(", ")})` }}
                  />
                  {t.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={(e) => (e.preventDefault(), onToggleDark())}>
          {darkMode ? <Sun size={15} /> : <Moon size={15} />} {darkMode ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onLogout}>
          <LogOut size={15} /> {isGuest ? "Leave guest mode" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
