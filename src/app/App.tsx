import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import confetti from "canvas-confetti";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import {
  MOCK_USER,
  MOCK_COURSES,
  MOCK_GALLERY,
  MOCK_LEADERBOARD,
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
import { getUser } from "../api/auth";
import { getProgress, postProgress, postXP, postAvatar } from "../api/progress";

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
  const [user, setUser] = useState<UserType>(MOCK_USER);
  const [userCards, setUserCards] = useState<Record<string, number>>({});
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [completedBeats, setCompletedBeats] = useState<Record<string, boolean>>({});
  const [submittedExitCards, setSubmittedExitCards] = useState<
    { id: string; username: string; avatar: string; caption: string; likes: number; tags: string[] }[]
  >([]);
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const allGameBeatIds = useMemo(() => GAME_LESSONS.flatMap((l) => l.beats.map((b) => b.id)), []);

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
  const applyAuthUser = (u: AuthUser) => {
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
    localStorage.setItem("stemulate_user_id", String(u.userId));

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

  useEffect(() => {
    const savedId = localStorage.getItem("stemulate_user_id");
    if (!savedId) return;
    getUser(savedId)
      .then(({ user: u }) => applyAuthUser(u))
      .catch(() => localStorage.removeItem("stemulate_user_id"));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("stemulate_user_id");
    setAuthUser(null);
    setIsLoggedIn(false);
    setCurrentPage("home");
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
      setSubmittedExitCards((prev) => [
        {
          id: `exit-${beat.id}-${Date.now()}`,
          username: user.username,
          avatar: user.avatar,
          caption: reflection,
          likes: 0,
          tags: [beat.title],
        },
        ...prev,
      ]);
      toast.success("Your reflection was published to the Gallery! 🎉");
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
    toast.success(`Opened ${pack.name}!`);
    return drawn;
  };

  if (!isLoggedIn) return <LoginScreen onLogin={handleLogin} />;

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
      />

      <div className="flex-1 min-w-0 h-screen flex flex-col overflow-hidden">
        {/* Top bar — logo, greeting (Singapore time) + progress to next level, XP + Atoms */}
        <header className="shrink-0 bg-gradient-to-r from-lime-500 via-lime-400 to-yellow-400 dark:from-lime-700 dark:via-lime-800 dark:to-yellow-800 px-4 md:px-8 py-4 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden p-2 -ml-2 text-white"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <img src={stemulateLogo} alt="" className="w-10 h-10 object-contain hidden sm:block shrink-0 drop-shadow" />
            <div className="min-w-0">
              <p className="font-black text-white truncate drop-shadow-sm">
                {getSingaporeGreeting()}, {user.username.split(" ")[0]}! 👋
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-28 sm:w-40 h-1.5 bg-white/30 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progressPct * 100}%` }} />
                </div>
                <span className="text-[11px] font-bold text-white/90 whitespace-nowrap">
                  {xpToGo} XP to Level {user.level + 1}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <div className="flex items-center gap-1.5 bg-white text-amber-600 px-3.5 py-2 rounded-full font-black text-sm shadow-md">
              <Star size={16} className="fill-amber-500 text-amber-500" />
              {user.xp.toLocaleString()} XP
            </div>
            <div className="flex items-center gap-1.5 bg-white text-sky-600 px-3.5 py-2 rounded-full font-black text-sm shadow-md">
              <AtomIcon size={16} />
              {user.atoms.toLocaleString()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          {currentPage === "home" && (
            <Dashboard
              courses={MOCK_COURSES}
              completedBeats={completedBeats}
              onOpenBeat={openBeat}
              gamesModuleComplete={gamesModuleComplete}
              onShowCertificate={() => setShowCertificate(true)}
            />
          )}
          {currentPage === "profile" && (
            <Profile
              user={user}
              onUpdateAvatar={handleUpdateAvatar}
              gamesModuleComplete={gamesModuleComplete}
              onShowCertificate={() => setShowCertificate(true)}
            />
          )}
          {currentPage === "leaderboard" && (
            <Leaderboard entries={MOCK_LEADERBOARD} currentUser={user} />
          )}
          {currentPage === "gallery" && <Gallery posts={MOCK_GALLERY} reflectionPosts={submittedExitCards} />}
          {currentPage === "games" && (
            <GamesTab
              completedBeats={completedBeats}
              onOpenBeat={openBeat}
              onReplay={(xp, atoms) => {
                handleEarnXP(xp);
                handleEarnAtoms(atoms);
              }}
            />
          )}
          {currentPage === "friends" && <FriendsTab myAtoms={user.atoms} />}
          {currentPage === "cards" && (
            <CardsHub ownedCounts={userCards} userAtoms={user.atoms} onOpenPack={handleOpenPack} />
          )}
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
              className="fixed top-0 left-0 bottom-0 w-64 bg-sidebar z-50 md:hidden p-5 flex flex-col gap-6"
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

function Dashboard({
  courses,
  completedBeats,
  onOpenBeat,
  gamesModuleComplete,
  onShowCertificate,
}: {
  courses: Course[];
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <StembotShowcase />

      {/* Search + tag filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <input
            type="text"
            placeholder="Search for topics or lessons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-5 py-4 bg-card border border-border rounded-3xl focus:ring-2 focus:ring-primary/40 outline-none font-semibold shadow-sm"
          />
        </div>
        <div className="bg-card rounded-3xl border border-border p-4 shadow-sm">
          <TagFilterBar selection={tagSelection} onChange={setTagSelection} />
        </div>
      </div>

      {/* Filtered topic results */}
      {activeFilters && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {matches.length} matching topic{matches.length === 1 ? "" : "s"}
          </p>
          {matches.length === 0 && (
            <p className="text-sm text-muted-foreground bg-card border border-border rounded-2xl p-4">
              No topics match those filters yet — more modules are on the way!
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matches.map(({ lessonTitle, lessonId, beat }) => (
              <button
                key={beat.id}
                onClick={() => onOpenBeat(lessonId, beat.id)}
                className="text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/50 hover:shadow-md transition-all"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{lessonTitle}</p>
                <p className="font-bold text-foreground text-sm">{beat.title}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {[...beat.levelTags, ...beat.subjectTags].map((t) => (
                    <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
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
          {/* Featured module — STEM x Games, the only unlocked one. Banner
              composites the 4 STEMbot mascots since no dedicated banner
              artwork was supplied. Lessons expand inline, right here. */}
          {gamesCourse && (
            <div className="rounded-3xl border border-primary/30 shadow-sm bg-card overflow-hidden">
              <div className="relative h-36 sm:h-44 bg-gradient-to-br from-lime-400 via-yellow-300 to-lime-500 flex items-end justify-center gap-2 overflow-hidden">
                <Sparkles className="absolute top-3 left-4 text-white/70" size={20} />
                <Sparkles className="absolute top-6 right-8 text-white/50" size={14} />
                {[stembotGreen, stembotBlue, stembotCream, stembotRed].map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="h-28 sm:h-36 object-contain drop-shadow-lg"
                    style={{ transform: `translateY(${i % 2 === 0 ? 8 : 0}px)` }}
                  />
                ))}
                {gamesModuleComplete && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/95 text-emerald-600 text-xs font-black px-3 py-1.5 rounded-full shadow-md">
                    <Award size={14} /> Badge earned!
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-black text-lg text-foreground">{gamesCourse.title}</h3>
                    <p className="text-xs text-muted-foreground font-medium">
                      {gamesCourse.modules.length} lessons · {gamesDone}/{allGameBeats.length} activities complete
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {gamesModuleComplete && (
                      <button
                        onClick={onShowCertificate}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-emerald-500 text-white hover:opacity-90"
                      >
                        <Award size={14} /> View Certificate
                      </button>
                    )}
                    <button
                      onClick={() => setGamesExpanded((v) => !v)}
                      className="flex items-center gap-1 text-primary font-bold text-sm px-3 py-2 rounded-xl hover:bg-accent"
                    >
                      Explore
                      {gamesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>
                <div className="w-full h-2 bg-accent rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${gamesPct}%` }} />
                </div>

                <AnimatePresence>
                  {gamesExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-5">
                        <GameLessonExplorer
                          lessons={GAME_LESSONS}
                          completedBeats={completedBeats}
                          onOpenBeat={onOpenBeat}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Locked modules — banner-style cards, 2 per row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {lockedCourses.map((course) => (
              <div
                key={course.id}
                className="relative rounded-3xl border border-border shadow-sm overflow-hidden bg-card"
              >
                <div className={cn("relative h-24 flex items-center justify-center gap-1.5", course.color)}>
                  {[stembotBlue, stembotRed, stembotGreen].map((src, i) => (
                    <img key={i} src={src} alt="" className="h-16 object-contain opacity-90" />
                  ))}
                </div>
                <div className="absolute inset-0 bg-card/85 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-muted-foreground">
                    <Lock size={22} />
                  </div>
                  <p className="font-black text-foreground">Coming Soon!</p>
                </div>
                <div className="p-5 pt-4">
                  <h3 className="font-bold text-foreground">{course.title}</h3>
                  <p className="text-xs text-muted-foreground font-medium">{course.modules.length} Modules</p>
                </div>
              </div>
            ))}
          </div>
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
    <div className="bg-accent/60 px-5 py-3 rounded-2xl text-center">
      <p className="text-xl font-black text-foreground">{value}</p>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
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
  user,
  onUpdateAvatar,
  gamesModuleComplete,
  onShowCertificate,
}: {
  user: UserType;
  onUpdateAvatar: (avatar: string) => void;
  gamesModuleComplete: boolean;
  onShowCertificate: () => void;
}) {
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const xpIntoLevel = user.xp % 1000;
  const xpToGo = 1000 - xpIntoLevel;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-card rounded-3xl p-8 border border-border shadow-sm flex flex-col md:flex-row items-center gap-8">
        <div className="relative shrink-0">
          <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-primary/20 bg-muted">
            <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <button
            onClick={() => setIsEditingAvatar(!isEditingAvatar)}
            className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground w-10 h-10 rounded-full flex items-center justify-center font-black border-4 border-card shadow-md hover:opacity-90 transition-all"
          >
            ✏️
          </button>
        </div>

        <div className="text-center md:text-left flex-1 w-full">
          <div className="flex flex-col md:flex-row items-center gap-3 mb-1">
            <h2 className="text-2xl font-black text-foreground">{user.username}</h2>
            <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-black uppercase">
              Level {user.level} · {levelName(user.level)}
            </span>
          </div>
          <p className="text-muted-foreground font-medium mb-3">STEMulate Academy Member</p>
          <div className="max-w-xs mx-auto md:mx-0 mb-6">
            <div className="w-full h-2.5 bg-accent rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(xpIntoLevel / 1000) * 100}%` }} />
            </div>
            <p className="text-xs font-bold text-muted-foreground mt-1.5">
              {xpToGo} XP to Level {user.level + 1} ({levelName(user.level + 1)})
            </p>
          </div>
          <div className="flex flex-wrap justify-center md:justify-start gap-3">
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
            className="bg-card rounded-3xl p-6 border border-border shadow-sm overflow-hidden"
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

      <div className="bg-card rounded-3xl p-6 border border-border shadow-sm">
        <p className="font-bold text-foreground mb-4">Badges &amp; Certificates</p>
        <div className="flex flex-wrap gap-4">
          {user.badges.map((b) => (
            <div key={b.id} className="flex flex-col items-center gap-1 w-20">
              <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-2xl">{b.icon}</div>
              <p className="text-[10px] font-bold text-center text-muted-foreground">{b.name}</p>
            </div>
          ))}
          {gamesModuleComplete && (
            <button onClick={onShowCertificate} className="flex flex-col items-center gap-1 w-20">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600">
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

      <div className="bg-card rounded-3xl p-6 border border-border shadow-sm">
        <p className="font-bold text-foreground mb-4">Levels</p>
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
                  current ? "bg-primary/10 ring-1 ring-primary/40" : "",
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0",
                    reached ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground",
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

function Leaderboard({ entries, currentUser }: { entries: any[]; currentUser: UserType }) {
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-gradient-to-r from-amber-500 to-yellow-500 rounded-3xl p-6 text-white shadow-md flex items-center gap-4">
        <Trophy size={32} />
        <div>
          <h2 className="text-xl font-black">Leaderboard</h2>
          <p className="text-amber-100 text-sm">Ranked by total XP</p>
        </div>
      </div>
      <div className="bg-card rounded-3xl border border-border shadow-sm divide-y divide-border overflow-hidden">
        {entries
          .sort((a, b) => b.xp - a.xp)
          .map((entry, i) => {
            const isMe = entry.username === currentUser.username;
            return (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center gap-4 px-5 py-3.5",
                  isMe && "bg-accent/60",
                )}
              >
                <span className={cn("w-7 text-center font-black", i < 3 ? "text-amber-500" : "text-muted-foreground")}>
                  {i + 1}
                </span>
                <img src={entry.avatar} className="w-10 h-10 rounded-xl bg-muted" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground truncate">{entry.username}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">
                    Level {Math.floor(entry.xp / 1000) + 1}
                  </p>
                </div>
                <span className="font-black text-foreground">{entry.xp.toLocaleString()} XP</span>
                {!isMe && (
                  <button
                    onClick={() => {
                      setRequested((r) => ({ ...r, [entry.id]: true }));
                      toast.success(`Friend request sent to ${entry.username}!`);
                    }}
                    disabled={!!requested[entry.id]}
                    className="ml-1 shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-xl bg-accent text-accent-foreground disabled:opacity-50"
                  >
                    {requested[entry.id] ? "Sent" : "+ Friend"}
                  </button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

function Gallery({ posts, reflectionPosts }: { posts: any[]; reflectionPosts: any[] }) {
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const toggleLike = (id: string, base: number) => {
    setLiked((prev) => {
      const next = !prev[id];
      setLikes((l) => ({ ...l, [id]: (l[id] ?? base) + (next ? 1 : -1) }));
      return { ...prev, [id]: next };
    });
  };

  const allPosts = [...reflectionPosts, ...posts];

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5 max-w-6xl mx-auto">
      {allPosts.map((post) => {
        const isReflection = !post.imageUrl;
        const likeCount = likes[post.id] ?? post.likes;
        return (
          <div key={post.id} className="break-inside-avoid bg-card rounded-3xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-all group">
            {isReflection ? (
              <div className="p-5 bg-gradient-to-br from-lime-50 to-yellow-50 dark:from-lime-500/10 dark:to-yellow-500/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Exit Card Reflection</p>
                <p className="text-sm font-medium text-foreground whitespace-pre-line leading-relaxed">{post.caption}</p>
              </div>
            ) : (
              <div className="relative">
                <img src={post.imageUrl} alt={post.caption} className="w-full h-auto object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 text-center">
                  <p className="text-white font-bold mb-3">{post.caption}</p>
                </div>
              </div>
            )}
            <div className="p-5 pt-4">
              <div className="flex items-center gap-3 mb-3">
                <img src={post.avatar} className="w-9 h-9 rounded-xl bg-muted" />
                <span className="text-sm font-bold text-foreground">{post.username}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map((tag: string) => (
                    <span key={tag} className="text-[10px] font-bold bg-accent text-accent-foreground px-2 py-0.5 rounded-lg">
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => toggleLike(post.id, post.likes)}
                  className={cn(
                    "flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full transition-all shrink-0",
                    liked[post.id] ? "bg-rose-500 text-white" : "bg-muted text-muted-foreground hover:bg-rose-100 hover:text-rose-500",
                  )}
                >
                  <Star size={12} className={liked[post.id] ? "fill-white" : ""} /> {likeCount}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

