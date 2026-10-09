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
  SlidersHorizontal,
  Music,
  VolumeX,
  ShieldCheck,
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
  avatarToUrl,
  urlToAvatarKey,
} from "../data/mock";
import { GAME_LESSONS, pointsFor, POINTS_LEGEND, REPLAY_REWARD, type LessonBeat } from "../data/lessonContent";
import type { Course, Module, User as UserType } from "../types";
import { LoginScreen } from "../components/LoginScreen";
import { Sidebar, MobileTabBar, type Page } from "../components/Sidebar";
import { TagFilterBar, EMPTY_SELECTION, hasAnySelection, type TagSelection } from "../components/TagFilterBar";
import { GameLessonExplorer, BeatPlayer, firstIncompleteBeat } from "../components/GameLessonExplorer";
import { StembotShowcase } from "../components/StembotShowcase";
import { GamesBanner } from "../components/GamesBanner";
import { BeatGlyph } from "../components/lesson/LessonArt";
import { Certificate, type CertificateModule } from "../components/Certificate";
import { CertificateShelf } from "../components/CertificateShelf";
import { GamesTab } from "../components/GamesTab";
import { FriendsTab } from "../components/FriendsTab";
import { CardsHub } from "../components/CardsHub";
import { PHENOMENA_CARDS, FIGURE_CARDS, ALBUM_PACKS, type CollectibleCard } from "../data/cardData";
import stemulateLogo from "../assets/stemulate_logo.png";
import stembotBlue from "../assets/stembot_blue.png";
import stembotRed from "../assets/stembot_red.png";
import stembotGreen from "../assets/stembot_green.png";
import stembotCream from "../assets/stembot_cream.png";
import type { AuthUser } from "../types-auth";
import { getMe, logout } from "../api/auth";
import {
  getProgress,
  postProgress,
  replayGame,
  postAvatar,
  getCards,
  openPack,
  postReflection,
  type Reward,
} from "../api/progress";
import { setGamePlayer } from "../games/kit/player";
import { syncHighScores } from "../games/kit/scores";
import { getLeaderboard, sendFriendRequest } from "../api/social";
import { useColourTheme, THEMES, type ThemeId } from "../lib/theme";
import { ProfileDetails, PrivacyAndAccount, ThemePicker } from "../components/ProfileSettings";
import { AdminPage } from "../components/AdminPage";
import { startLobbyMusic, stopLobbyMusic, toggleLobbyMusic, onMusicChange, isLobbyMusicPlaying, musicEnabled, lobbyMusicUnlocked } from "../lib/lobbyMusic";
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
  const [certModuleId, setCertModuleId] = useState<string | null>(null);
  const [musicOn, setMusicOn] = useState(isLobbyMusicPlaying);
  useEffect(() => onMusicChange(setMusicOn), []);
  const [colourTheme, setColourTheme] = useColourTheme();
  const [isAdminRoute, setIsAdminRoute] = useState(() => window.location.hash === "#/admin");
  const mainRef = useRef<HTMLElement>(null);
  const allGameBeatIds = useMemo(() => GAME_LESSONS.flatMap((l) => l.beats.map((b) => b.id)), []);
  // Bumped on every sign-in/sign-out so late responses for a previous user
  // (on a shared centre device) are ignored instead of leaking into the next.
  const authGen = useRef(0);

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

  // The dashboard tune makes way for lesson videos and game music, then
  // comes back (if it was playing and hasn't been switched off).
  useEffect(() => {
    if (!isLoggedIn) return;
    if (currentPage === "lesson" || currentPage === "games") stopLobbyMusic();
    else if (lobbyMusicUnlocked() && musicEnabled()) startLobbyMusic();
  }, [currentPage, isLoggedIn]);

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
    const gen = ++authGen.current;
    setIsGuest(false);
    setAuthUser(u);
    setUser((prev) => ({
      ...prev,
      username: u.fullName,
      xp: u.xp,
      level: u.level,
      atoms: u.atoms,
      avatar: u.avatar ? avatarToUrl(u.avatar) : MOCK_USER.avatar,
    }));
    setIsLoggedIn(true);

    // Fill in organisation / school level for the profile page.
    getMe()
      .then(({ user: full }) => {
        if (gen === authGen.current) setAuthUser(full);
      })
      .catch(() => {});

    // Pull lesson progress from SQLite so completed beats persist across
    // devices / refreshes (see SQL_EXPLAINED.md for how this is stored).
    getProgress()
      .then(({ progress }) => {
        if (gen !== authGen.current) return;
        const map: Record<string, boolean> = {};
        progress.forEach((p) => {
          if (p.status === "completed") map[p.lesson_id] = true;
        });
        setCompletedBeats(map);
      })
      .catch(() => {
        if (gen !== authGen.current) return;
        const cached = localStorage.getItem(BEATS_KEY_PREFIX + u.userId);
        if (cached) setCompletedBeats(JSON.parse(cached));
      });

    // Owned cards live in SQLite too (see POST /api/packs/open).
    getCards()
      .then(({ owned }) => {
        if (gen === authGen.current) setUserCards(owned);
      })
      .catch(() => {});
  };

  const handleLogin = (u: AuthUser) => {
    startLobbyMusic();
    applyAuthUser(u);
  };

  // Rehydrate from the httpOnly session cookie. Who is signed in is decided
  // by the server, never by anything stored in the browser.
  useEffect(() => {
    localStorage.removeItem("stemulate_user_id"); // legacy key, no longer used
    localStorage.removeItem("stemulate_token"); // bearer-token builds; sign-in is a cookie now
    const gen = authGen.current;
    getMe()
      .then(({ user: u }) => {
        if (gen === authGen.current) applyAuthUser(u);
      })
      .catch(() => {});
  }, []);

  // Clear every piece of per-student state, so the next child on a shared
  // device starts clean.
  const resetLocalState = () => {
    authGen.current += 1;
    setUser(MOCK_USER);
    setCompletedBeats({});
    setUserCards({});
    setSelectedLessonId(null);
    setSelectedBeatId(null);
    setCertModuleId(null);
    setMobileMenuOpen(false);
    setCurrentPage("home");
  };

  const handleLogout = () => {
    stopLobbyMusic();
    if (!isGuest) logout();
    setAuthUser(null);
    setIsGuest(false);
    setIsLoggedIn(false);
    setLoginView("signin");
    resetLocalState();
  };

  const handleGuest = () => {
    startLobbyMusic();
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
  // For a signed-in student the server decides and saves every reward; the
  // browser only shows what it was told. `quiet` skips the toasts when the
  // screen already shows the reward (the lesson player's "Checkpoint cleared!").
  const applyRewards = (u: AuthUser, awarded: Reward, prevLevel: number, quiet = false) => {
    setUser((prev) => ({ ...prev, xp: u.xp, level: u.level, atoms: u.atoms }));
    if (u.level > prevLevel) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      toast.success(`LEVEL UP! You are now Level ${u.level}!`);
    } else if (!quiet && awarded.xp) {
      toast.success(`+${awarded.xp} XP Earned!`);
    }
    if (!quiet && awarded.atoms) toast.success(`+${awarded.atoms} Atoms Earned! ⚛️`);
  };

  // Guests: points only live on this screen and vanish when they leave.
  const addGuestPoints = (xp: number, atoms: number) => {
    setUser((prev) => {
      const newXp = prev.xp + xp;
      return { ...prev, xp: newXp, level: Math.floor(newXp / 1000) + 1, atoms: prev.atoms + atoms };
    });
  };

  const handleUpdateAvatar = (avatar: string) => {
    setUser((prev) => ({ ...prev, avatar }));
    if (authUser) {
      postAvatar(urlToAvatarKey(avatar)).catch(() =>
        toast.error("Avatar changed here, but couldn't save it to your account."),
      );
    }
    toast.success("Avatar updated!");
  };

  const handleBeatComplete = (beat: LessonBeat, scoreRatio?: number, reflection?: string) => {
    setCompletedBeats((prev) => {
      const next = { ...prev, [beat.id]: true };
      if (authUser) localStorage.setItem(BEATS_KEY_PREFIX + authUser.userId, JSON.stringify(next));
      return next;
    });

    if (!authUser) {
      const p = pointsFor(beat);
      let xp = p.xp;
      if (beat.type === "quiz" && typeof scoreRatio === "number") {
        const min = p.xpMin ?? 50;
        xp = Math.round(min + (100 - min) * scoreRatio);
      }
      addGuestPoints(xp, p.atoms);
      if (beat.type === "exit" && reflection) {
        toast.success("Lovely reflection! Create an account to keep your progress.");
      }
      return;
    }

    const gen = authGen.current;
    const prevLevel = user.level;
    const score = beat.type === "quiz" && typeof scoreRatio === "number" ? Math.round(scoreRatio * 100) : null;
    // The server decides what this beat is worth and only pays out once.
    postProgress(beat.id, "completed", score)
      .then(({ user: u, awarded }) => {
        if (gen === authGen.current) applyRewards(u, awarded, prevLevel, true);
      })
      .catch(() => toast.error("Couldn't save your progress. Please check your connection."));

    if (beat.type === "exit" && reflection) {
      postReflection(beat.id, reflection)
        .then(() => {
          if (gen === authGen.current) toast.success("Reflection saved. Great thinking! 🎉");
        })
        .catch((err) => toast.error((err as Error).message));
    }
  };

  // A finished game was played again from the Games tab: a small top-up,
  // which the server pays at most 3 times per game per day.
  const handleReplay = (beatId: string) => {
    if (!authUser) {
      addGuestPoints(REPLAY_REWARD.xp, REPLAY_REWARD.atoms);
      return;
    }
    const gen = authGen.current;
    const prevLevel = user.level;
    replayGame(beatId)
      .then(({ user: u, awarded }) => {
        if (gen !== authGen.current) return;
        if (!awarded.xp && !awarded.atoms) {
          toast("You've already had today's replay bonus for this game. Come back tomorrow!");
          return;
        }
        applyRewards(u, awarded, prevLevel);
      })
      .catch((err) => toast.error((err as Error).message));
  };

  const openBeat = (lessonId: string, beatId: string) => {
    setSelectedLessonId(lessonId);
    setSelectedBeatId(beatId);
    setCurrentPage("lesson");
  };

  // Packs are paid for and rolled on the server so atoms and cards survive a
  // refresh and can't be granted by the browser.
  const handleOpenPack = async (
    albumKey: "phenomena" | "figures",
    packId: string,
  ): Promise<CollectibleCard[] | null> => {
    const pack = ALBUM_PACKS[albumKey].find((p) => p.id === packId);
    if (!pack) return null;
    if (!authUser) {
      toast("Create a free account to open card packs and keep your cards!");
      return null;
    }
    if (user.atoms < pack.cost) {
      toast.error("Not enough Atoms for that pack!");
      return null;
    }

    const gen = authGen.current;
    try {
      const { cards, atoms } = await openPack(albumKey, packId);
      if (gen !== authGen.current) return null;
      const pool = albumKey === "phenomena" ? PHENOMENA_CARDS : FIGURE_CARDS;
      const drawn = cards
        .map((id) => pool.find((c) => c.id === id))
        .filter((c): c is CollectibleCard => !!c);
      setUser((prev) => ({ ...prev, atoms }));
      setUserCards((prev) => {
        const next = { ...prev };
        cards.forEach((id) => {
          next[id] = (next[id] ?? 0) + 1;
        });
        return next;
      });
      return drawn;
    } catch (err) {
      toast.error((err as Error).message);
      return null;
    }
  };

  const handleAccountDeleted = () => {
    if (authUser) localStorage.removeItem(BEATS_KEY_PREFIX + authUser.userId);
    if (authUser) localStorage.removeItem(`stemulate_game_best_${authUser.userId}`);
    stopLobbyMusic();
    setAuthUser(null);
    setIsLoggedIn(false);
    resetLocalState();
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

  // Certificates: one per module. STEM x Games is the only open module; the
  // date it was finished is remembered on this device.
  const doneKey = `stemulate_module_done_${authUser?.userId ?? "guest"}_games`;
  let gamesDoneAt: string | null = null;
  if (gamesModuleComplete) {
    try {
      gamesDoneAt = localStorage.getItem(doneKey);
      if (!gamesDoneAt) {
        gamesDoneAt = new Date().toISOString();
        localStorage.setItem(doneKey, gamesDoneAt);
      }
    } catch {
      gamesDoneAt = new Date().toISOString();
    }
  }
  const gamesPctAll = allGameBeatIds.length
    ? Math.round((allGameBeatIds.filter((id) => completedBeats[id]).length / allGameBeatIds.length) * 100)
    : 0;
  const certItems: { module: CertificateModule; completedAt: string | null; progressPct: number; comingSoon?: boolean }[] =
    MOCK_COURSES.map((c) =>
      c.id === "games"
        ? {
            module: { id: "games", name: c.title, emoji: "🎮", lessons: GAME_LESSONS.map((l) => l.title) },
            completedAt: gamesDoneAt,
            progressPct: gamesPctAll,
          }
        : {
            module: { id: c.id, name: c.title, emoji: COMING_SOON_STYLE[c.id]?.emoji ?? "✨", lessons: c.modules.map((m) => m.title) },
            completedAt: null,
            progressPct: 0,
            comingSoon: true,
          },
    );

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
        <header className="theme-bar shrink-0 h-[76px] px-4 md:px-8 flex items-center justify-between gap-4 z-20">
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
            <button
              onClick={toggleLobbyMusic}
              className={cn(
                "w-10 h-10 rounded-full border-2 border-ink shadow-[0_3px_0_var(--ink-line)] items-center justify-center hidden sm:flex transition-transform hover:-translate-y-0.5",
                musicOn ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
              )}
              aria-label={musicOn ? "Turn music off" : "Turn music on"}
              title={musicOn ? "Music on" : "Music off"}
            >
              {musicOn ? <Music size={17} strokeWidth={2.6} className="hover-wiggle" /> : <VolumeX size={17} strokeWidth={2.6} />}
            </button>
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
              musicOn={musicOn}
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
              onShowCertificate={() => setCertModuleId("games")}
              avatar={user.avatar}
              theme={colourTheme}
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
              onShowCertificate={() => setCertModuleId("games")}
              certItems={certItems}
              onOpenCertificate={setCertModuleId}
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
              onReplay={handleReplay}
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

      {certModuleId && (() => {
        const item = certItems.find((c) => c.module.id === certModuleId);
        if (!item) return null;
        return (
          <Certificate
            studentName={user.username}
            fullName={authUser?.fullName}
            module={item.module}
            completedAt={item.completedAt}
            onClose={() => setCertModuleId(null)}
          />
        );
      })()}
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
  avatar,
  theme,
}: {
  courses: Course[];
  firstName: string;
  completedBeats: Record<string, boolean>;
  onOpenBeat: (lessonId: string, beatId: string) => void;
  gamesModuleComplete: boolean;
  onShowCertificate: () => void;
  avatar: string;
  theme: ThemeId;
}) {
  // Whether the lessons under the STEM x Games banner are showing (remembered).
  const [gamesExpanded, setGamesExpandedState] = useState(() => {
    try {
      return localStorage.getItem("stemulate_games_open") !== "0";
    } catch {
      return true;
    }
  });
  const setGamesExpanded = (fn: (v: boolean) => boolean) =>
    setGamesExpandedState((v) => {
      const next = fn(v);
      try {
        localStorage.setItem("stemulate_games_open", next ? "1" : "0");
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      <section className="panel-pop overflow-hidden px-6 py-8 sm:px-10 sm:py-11 min-h-[19rem] sm:min-h-[21rem]">
        <div className="relative z-10 max-w-[32rem]">
          <span className="kicker kicker-on">Turning every why? into wow!</span>
          <h1 className="font-display !text-[clamp(2rem,1.2rem+2.6vw,3.3rem)] !leading-[1.03] mt-4 mb-3">
            Ready for a new <span className="mark-pop">why?</span> today, {firstName}?
          </h1>
          <p className="font-semibold opacity-90 mb-6">
            {gamesDone === 0
              ? "Your first adventure is waiting. Watch, play and earn Atoms for your card albums!"
              : gamesDone === allGameBeats.length
                ? "You finished every checkpoint. Replay the games to beat your high scores!"
                : `You're ${gamesPct}% through STEM x Games. Keep that streak going!`}
          </p>
          <button
            onClick={() => onOpenBeat(nextLesson.id, nextBeat.id)}
            className="group flex items-center gap-3 text-left rounded-[1.4rem] border-[2.5px] border-ink bg-card text-[color:var(--card-foreground)] px-3.5 py-3 pr-4 shadow-[0_4px_0_var(--ink-line)] hover:-translate-y-0.5 transition-transform max-w-[24rem] w-full"
          >
            <BeatGlyph beat={nextBeat} size={46} filled />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                {gamesDone === 0 ? "Start here" : "Up next"} · {nextLesson.title}
              </span>
              <span className="block font-display font-semibold text-lg leading-tight truncate">{nextBeat.title}</span>
            </span>
            <span className="w-10 h-10 rounded-full bg-primary text-primary-foreground border-[2.5px] border-ink flex items-center justify-center shrink-0 group-hover:translate-x-0.5 transition-transform">
              <ArrowRight size={18} strokeWidth={2.8} />
            </span>
          </button>
        </div>
        <div className="hidden md:block absolute right-3 lg:right-8 bottom-0 top-6 w-[46%] max-w-[500px] pointer-events-none" aria-hidden="true">
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

      {/* Search + tag filters (filters fold away until you want them) */}
      <section className="sticker !rounded-[1.8rem] p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} strokeWidth={2.5} />
            <input
              type="text"
              placeholder="Search for topics or lessons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-5 py-3 bg-input-background border-2 border-ink rounded-full focus:ring-4 focus:ring-primary/30 outline-none font-bold placeholder:text-muted-foreground/70"
            />
          </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn("btn-pop btn-pop-sm shrink-0", (filtersOpen || hasAnySelection(tagSelection)) && "btn-primary")}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal size={15} /> <span className="hidden sm:inline">Filters</span>
          </button>
        </div>
        <AnimatePresence initial={false}>
          {filtersOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="pt-4 px-1">
                <TagFilterBar selection={tagSelection} onChange={setTagSelection} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
          {/* The one open module: STEM x Games, with its lessons right underneath. */}
          {gamesCourse && (
            <section className="space-y-5">
              <GamesBanner
                title={gamesCourse.title}
                lessonCount={GAME_LESSONS.length}
                done={gamesDone}
                total={allGameBeats.length}
                expanded={gamesExpanded}
                onToggle={() => setGamesExpanded((v) => !v)}
                onContinue={() => onOpenBeat(nextLesson.id, nextBeat.id)}
                continueLabel={gamesDone === 0 ? "Start learning" : "Keep going"}
                moduleComplete={gamesModuleComplete}
                onCertificate={onShowCertificate}
              />
              <AnimatePresence initial={false}>
                {gamesExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden px-0.5 pb-2"
                  >
                    <GameLessonExplorer lessons={GAME_LESSONS} completedBeats={completedBeats} onOpenBeat={onOpenBeat} avatar={avatar} />
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
                    className={cn("relative rounded-[1.6rem] border-[2.5px] border-ink shadow-[0_5px_0_var(--ink-line)] p-5 overflow-hidden", st.bg, st.tilt)}
                  >
                    <div className="absolute -right-3 -bottom-3 w-24 h-24 motif-icon opacity-60 rotate-12" aria-hidden="true" />
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent_0_14px,rgba(0,0,0,.035)_14px_28px)]" aria-hidden="true" />
                    <div className="flex items-center justify-between mb-6">
                      <span className="w-14 h-14 rounded-2xl bg-card border-[2.5px] border-ink shadow-[0_3px_0_var(--ink-line)] flex items-center justify-center text-3xl rotate-[-6deg]">{st.emoji}</span>
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

          <StembotShowcase />
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
  certItems,
  onOpenCertificate,
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
  certItems: React.ComponentProps<typeof CertificateShelf>["modules"];
  onOpenCertificate: (moduleId: string) => void;
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
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h2 className="font-display text-foreground !text-xl">Certificates</h2>
          <span className="kicker kicker-3">One per module</span>
        </div>
        <p className="text-sm font-semibold text-muted-foreground mb-5">
          Finish every lesson in a module to unlock its certificate. You can pick its colours and STEMbots, then print or download it.
        </p>
        <CertificateShelf modules={certItems} onOpen={onOpenCertificate} />
        {user.badges.length > 0 && (
          <>
            <h3 className="font-display text-foreground !text-lg mt-7 mb-3">Badges</h3>
            <div className="flex flex-wrap gap-4">
              {user.badges.map((b) => (
                <div key={b.id} className="flex flex-col items-center gap-1 w-20">
                  <div className="w-14 h-14 rounded-2xl bg-soft-1 border-2 border-ink shadow-[0_3px_0_var(--ink-line)] flex items-center justify-center text-2xl">{b.icon}</div>
                  <p className="text-[10px] font-bold text-center text-muted-foreground">{b.name}</p>
                </div>
              ))}
            </div>
          </>
        )}
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

  const [view, setView] = useState<"all" | "friends">("all");
  const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));
  const shown = view === "all" ? ranked : ranked.filter((e) => e.isFriend || e.userId === myUserId);
  const podium = shown.slice(0, 3);
  const rest = shown.slice(3);
  const topXp = Math.max(1, shown[0]?.xp ?? 1);
  const me = ranked.find((e) => e.userId === myUserId);
  const above = me && me.rank > 1 ? ranked[me.rank - 2] : null;

  // Podium order on screen: 2nd, 1st, 3rd.
  const PODIUM = [
    { place: 2, h: "h-28 sm:h-32", bg: "var(--soft-3)", fg: "var(--foreground)", medal: "🥈", tilt: "-rotate-2" },
    { place: 1, h: "h-36 sm:h-44", bg: "var(--pop-2)", fg: "#1c1a17", medal: "🥇", tilt: "" },
    { place: 3, h: "h-20 sm:h-24", bg: "var(--soft-1)", fg: "var(--foreground)", medal: "🥉", tilt: "rotate-2" },
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
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <span className="kicker">
            <Trophy size={13} /> Leaderboard
          </span>
          <h1 className="font-display text-foreground !text-[clamp(1.8rem,1.3rem+1.5vw,2.6rem)] mt-3 mb-1">Top explorers</h1>
          <p className="text-muted-foreground font-semibold">Ranked by total XP. Finish lessons and replay games to climb!</p>
          <div className="inline-flex mt-4 p-1 rounded-full border-[2.5px] border-ink bg-card shadow-[0_3px_0_var(--ink-line)]" role="tablist">
            {(["all", "friends"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "px-4 py-1.5 rounded-full font-display font-semibold text-sm transition-colors",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "all" ? "Everyone" : "My friends"}
              </button>
            ))}
          </div>
        </div>
        {me && (
          <div className="sticker !rounded-[1.6rem] flex items-center gap-4 px-5 py-4 lg:min-w-[22rem] rotate-[-1deg]">
            <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground border-[2.5px] border-ink shadow-[0_3px_0_var(--ink-line)] flex flex-col items-center justify-center shrink-0">
              <span className="text-[10px] font-extrabold uppercase tracking-widest leading-none">Rank</span>
              <span className="font-display font-bold text-2xl leading-none mt-0.5">#{me.rank}</span>
            </div>
            <div className="min-w-0">
              <p className="font-display font-bold text-lg leading-tight">You have {me.xp.toLocaleString()} XP</p>
              <p className="text-sm font-semibold text-muted-foreground">
                {above
                  ? `${(above.xp - me.xp + 1).toLocaleString()} XP more to pass ${above.username}!`
                  : "You're at the very top. Keep it up!"}
              </p>
            </div>
          </div>
        )}
      </div>

      {loading && <p className="sticker p-5 text-sm font-semibold text-muted-foreground">Loading…</p>}
      {!loading && shown.length === 0 && (
        <p className="sticker p-5 text-sm font-semibold text-muted-foreground">
          {view === "friends" ? "Add some friends to race them up the board!" : "No one on the board yet. Finish a lesson to be first!"}
        </p>
      )}

      {podium.length > 0 && (
        <section className="panel-pop px-4 pt-10 sm:px-10 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,.45),transparent_60%)] pointer-events-none" aria-hidden="true" />
          <img src={stembotGreen} alt="" className="hidden md:block absolute left-4 bottom-0 h-32 die-cut bob rotate-[-8deg]" aria-hidden="true" />
          <img src={stembotRed} alt="" className="hidden md:block absolute right-4 bottom-0 h-32 die-cut bob rotate-[8deg] [animation-delay:-2s]" aria-hidden="true" />
          <div className="relative flex items-end justify-center gap-2 sm:gap-5 max-w-2xl mx-auto">
            {PODIUM.map(({ place, h, bg, fg, medal, tilt }) => {
              const entry = podium[place - 1];
              if (!entry) return <div key={place} className="flex-1" />;
              const isMe = entry.userId === myUserId;
              return (
                <motion.div
                  key={place}
                  className="flex-1 flex flex-col items-center min-w-0"
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: place === 1 ? 0.35 : place === 2 ? 0.2 : 0.05, type: "spring", stiffness: 200, damping: 16 }}
                >
                  <div className="relative">
                    {place === 1 && <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-4xl rotate-[-8deg] drop-shadow">👑</span>}
                    <img
                      src={avatarFor(entry)}
                      alt=""
                      className={cn(
                        "rounded-full bg-card border-[3px] border-ink object-cover shadow-[0_4px_0_var(--ink-line)]",
                        place === 1 ? "w-20 h-20 sm:w-28 sm:h-28" : "w-14 h-14 sm:w-20 sm:h-20",
                      )}
                    />
                    <span className="absolute -bottom-2 -right-2 text-2xl drop-shadow">{medal}</span>
                  </div>
                  <p className="font-display font-bold mt-3 truncate max-w-full text-center">
                    {entry.username}
                    {isMe && " (you)"}
                  </p>
                  <span className="chip-ink !text-xs !py-0.5 !px-2 mt-1 mb-2 text-foreground">{entry.xp.toLocaleString()} XP</span>
                  {!isMe && <div className="mb-3 text-foreground">{friendButton(entry)}</div>}
                  <div
                    className={cn(
                      "w-full rounded-t-[1.4rem] border-[2.5px] border-b-0 border-ink flex flex-col items-center justify-start pt-3 font-display font-bold text-4xl shadow-[inset_0_-10px_0_rgba(0,0,0,.08)]",
                      h,
                      tilt,
                    )}
                    style={{ background: bg, color: fg }}
                  >
                    {place}
                    <span className="text-[10px] font-body font-extrabold uppercase tracking-widest opacity-70 mt-1">
                      {place === 1 ? "Champion" : place === 2 ? "Runner-up" : "Third"}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <div className="space-y-3">
          {rest.map((entry, i) => {
            const isMe = entry.userId === myUserId;
            return (
              <motion.div
                key={entry.userId}
                initial={{ x: -16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: Math.min(i, 10) * 0.04 }}
                className={cn(
                  "sticker !rounded-[1.4rem] flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 !shadow-[0_4px_0_var(--ink-line)]",
                  isMe && "!bg-soft-1 ring-4 ring-primary/40",
                )}
              >
                <span
                  className={cn(
                    "w-10 h-10 rounded-xl border-[2.5px] border-ink flex items-center justify-center font-display font-bold text-base shrink-0",
                    i % 2 ? "rotate-3" : "-rotate-3",
                    isMe ? "bg-primary text-primary-foreground" : "bg-card",
                  )}
                >
                  {entry.rank}
                </span>
                <img src={avatarFor(entry)} alt="" className="w-11 h-11 rounded-full bg-soft-1 border-2 border-ink shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-semibold text-foreground truncate">{entry.username}</p>
                    {isMe && <span className="chip-ink !text-[10px] !py-0 !px-2 bg-pop-2 !text-[#1b1b12]">You</span>}
                    <span className="hidden sm:inline text-[10px] text-muted-foreground uppercase font-extrabold tracking-wide">
                      Lv {Math.floor(entry.xp / 1000) + 1}
                    </span>
                  </div>
                  <div className="meter !h-2.5 !border-[1.5px] mt-1.5 max-w-xs">
                    <span style={{ width: `${Math.round((entry.xp / topXp) * 100)}%` }} />
                  </div>
                </div>
                <span className="font-display font-bold text-foreground whitespace-nowrap">{entry.xp.toLocaleString()} XP</span>
                {!isMe && friendButton(entry)}
              </motion.div>
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
  musicOn,
}: {
  musicOn: boolean;
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
            <Palette size={15} /> Colour theme
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
        <DropdownMenuItem onSelect={(e) => (e.preventDefault(), toggleLobbyMusic())}>
          {musicOn ? <VolumeX size={15} /> : <Music size={15} />} {musicOn ? "Music off" : "Music on"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => (window.location.hash = "#/admin")}>
          <ShieldCheck size={15} /> Teacher &amp; admin
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onLogout}>
          <LogOut size={15} /> {isGuest ? "Leave guest mode" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
