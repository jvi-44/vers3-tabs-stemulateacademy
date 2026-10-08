import { useEffect, useState } from "react";
import { Lock, Gamepad2, Star, Users, Play, Trophy, LogIn, RefreshCw } from "lucide-react";
import { STEMBOTS } from "../data/mock";
import { GAMES } from "../games/registry";
import { GameShell } from "../games/kit/GameShell";
import { useGamePlayer } from "../games/kit/player";
import { getAllHighScores, starsFor } from "../games/kit/scores";
import { createRoom, joinRoom, listRooms, type LiveRoom } from "../games/kit/live";
import { primeAudio, sfx } from "../games/kit/audio";
import type { GameDef } from "../games/kit/types";
import { cn } from "./ui/utils";
import "../games/kit/games.css";

const REPLAY_XP = 10;
const REPLAY_ATOMS = 5;
const NEW_BEST_BONUS_XP = 25;

type Session = { def: GameDef; liveCode: string | null };

export function GamesTab({
  completedBeats,
  onOpenBeat,
  onReplay,
  isGuest = false,
}: {
  completedBeats: Record<string, boolean>;
  onOpenBeat: (lessonId: string, beatId: string) => void;
  onReplay: (amountXp: number, amountAtoms: number) => void;
  /** Guests play solo only: live rooms show other players' names. */
  isGuest?: boolean;
}) {
  const player = useGamePlayer();
  const [session, setSession] = useState<Session | null>(null);
  const [best, setBest] = useState(() => getAllHighScores(player.userId));
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [openRooms, setOpenRooms] = useState<LiveRoom[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const refresh = () => setBest(getAllHighScores(player.userId));
    refresh();
    window.addEventListener("stemulate-highscores", refresh);
    return () => window.removeEventListener("stemulate-highscores", refresh);
  }, [player.userId]);

  // Open live rooms anyone can join, refreshed every few seconds.
  const refreshRooms = () =>
    listRooms("")
      .then((rooms) => setOpenRooms(rooms.filter((r) => !r.players.some((p) => p.id === player.id))))
      .catch(() => setOpenRooms([]));
  useEffect(() => {
    if (session || isGuest) return;
    refreshRooms();
    const id = setInterval(refreshRooms, 4000);
    return () => clearInterval(id);
  }, [session, isGuest]); // eslint-disable-line react-hooks/exhaustive-deps

  const unlocked = (def: GameDef) => !!completedBeats[def.id];
  const lessonIdFor = (def: GameDef) =>
    ({ "mm-": "minecraft-masterminds", "mi-": "mission-millionaire", "sb-": "space-busters" })[def.id.slice(0, 3)] ?? "";

  const startLive = async (def: GameDef) => {
    primeAudio();
    sfx.click();
    setBusy(true);
    setJoinError(null);
    try {
      const room = await createRoom(def.id, player);
      setSession({ def, liveCode: room.code });
    } catch (e) {
      setJoinError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const join = async (code: string) => {
    primeAudio();
    sfx.click();
    setBusy(true);
    setJoinError(null);
    try {
      const room = await joinRoom(code.trim(), player);
      const def = GAMES.find((g) => g.id === room.gameId);
      if (!def) throw new Error("That game isn't available here.");
      if (!unlocked(def)) throw new Error(`Play "${def.title}" in its lesson first, then you can join live games.`);
      setSession({ def, liveCode: room.code });
      setJoinCode("");
    } catch (e) {
      setJoinError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (session) {
    return (
      <GameShell
        key={`${session.def.id}-${session.liveCode ?? "solo"}`}
        def={session.def}
        me={player}
        userId={player.userId}
        context="arcade"
        liveCode={session.liveCode}
        onExit={() => setSession(null)}
        onFinished={(_, isNewBest) => onReplay(REPLAY_XP + (isNewBest ? NEW_BEST_BONUS_XP : 0), REPLAY_ATOMS)}
      />
    );
  }

  const totalStars = GAMES.reduce((n, g) => n + (best[g.id] !== undefined ? starsFor(best[g.id]) : 0), 0);

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Gamepad2 className="text-primary" /> Games Arcade
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            Play each game in its lesson first, then come back to beat your high score, alone against the STEMbots or live with 2 to 4
            friends. Every replay earns {REPLAY_XP} XP + {REPLAY_ATOMS} Atoms, and a new high score adds {NEW_BEST_BONUS_XP} XP.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-2 shadow-sm">
          <Star size={18} className="fill-amber-400 text-amber-400" />
          <span className="font-black text-foreground">{totalStars}</span>
          <span className="text-xs font-bold text-muted-foreground">/ {GAMES.length * 3} stars</span>
        </div>
      </div>

      {/* Join a live game */}
      {isGuest ? (
        <div className="rounded-3xl bg-accent/60 border border-border p-4 flex items-center gap-3">
          <Lock size={18} className="text-muted-foreground shrink-0" />
          <p className="text-sm font-semibold text-foreground">
            Live games with friends are for members. Create a free account to play live.
          </p>
        </div>
      ) : (
      <div className="rounded-3xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 p-4 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Users size={20} />
            <div>
              <p className="font-black">Play live with friends</p>
              <p className="text-xs text-white/85">Pick Live on a game to host and share its code, or join a friend's game here.</p>
            </div>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (joinCode.trim().length >= 4) join(joinCode);
            }}
          >
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="CODE"
              aria-label="Game code"
              className="w-28 rounded-xl px-3 py-2 text-slate-900 font-black tracking-[0.3em] text-center bg-white placeholder:text-slate-300"
            />
            <button disabled={busy || joinCode.length < 4} className="game-btn bg-yellow-400 text-slate-900 py-2 flex items-center gap-1.5">
              <LogIn size={15} /> Join
            </button>
          </form>
        </div>
        {joinError && <p className="mt-2 text-xs font-bold bg-white/15 rounded-xl px-3 py-2">{joinError}</p>}
        {openRooms.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {openRooms.map((r) => {
              const def = GAMES.find((g) => g.id === r.gameId);
              const host = r.players.find((p) => p.id === r.hostId);
              if (!def) return null;
              return (
                <button
                  key={r.code}
                  onClick={() => join(r.code)}
                  className="flex items-center gap-2 bg-white/15 hover:bg-white/25 rounded-xl px-3 py-2 text-left"
                >
                  <span className="text-lg">{def.icon}</span>
                  <span className="text-xs">
                    <span className="font-black block">{def.title}</span>
                    {host?.name ?? "Someone"} · {r.players.length}/4 players · {r.code}
                  </span>
                </button>
              );
            })}
            <button onClick={refreshRooms} className="text-white/80 hover:text-white p-2" aria-label="Refresh open games">
              <RefreshCw size={14} />
            </button>
          </div>
        )}
      </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAMES.map((def) => {
          const isUnlocked = unlocked(def);
          const score = best[def.id];
          const stars = score !== undefined ? starsFor(score) : 0;
          const bot = STEMBOTS[def.bot];
          return (
            <div
              key={def.id}
              className="group relative rounded-3xl border border-border shadow-sm bg-card overflow-hidden transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className={cn("relative h-32 flex items-center justify-center overflow-hidden game-checker", def.gradient)}>
                <span className="text-6xl drop-shadow-[0_6px_0_rgba(0,0,0,0.25)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                  {def.icon}
                </span>
                <img src={bot.avatar} alt={bot.name} className="absolute right-2 bottom-0 w-16 h-16 object-contain drop-shadow-lg game-float" />
                {score !== undefined && (
                  <span className="absolute left-3 top-3 flex items-center gap-1 bg-black/30 text-yellow-200 rounded-xl px-2 py-1 text-xs font-black">
                    <Trophy size={12} /> {score}/100
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{def.lessonTitle}</p>
                <h3 className="font-black text-foreground leading-tight">{def.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 min-h-[2rem]">{def.tagline}</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex gap-0.5" aria-label={`${stars} of 3 stars`}>
                    {[0, 1, 2].map((i) => (
                      <Star key={i} size={16} className={i < stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"} />
                    ))}
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground">Best: {score ?? "--"}/100</span>
                </div>
                <div className="h-2 bg-accent rounded-full overflow-hidden mt-1.5">
                  <div className="h-full bg-gradient-to-r from-lime-400 to-amber-400 rounded-full" style={{ width: `${score ?? 0}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    disabled={!isUnlocked}
                    onClick={() => {
                      primeAudio();
                      sfx.click();
                      setSession({ def, liveCode: null });
                    }}
                    className="game-btn bg-amber-400 text-slate-900 py-2 text-sm flex items-center justify-center gap-1.5"
                  >
                    <Play size={14} fill="currentColor" /> Solo
                  </button>
                  <button
                    disabled={!isUnlocked || busy || isGuest}
                    title={isGuest ? "Live play is for members" : undefined}
                    onClick={() => startLive(def)}
                    className="game-btn bg-violet-500 text-white py-2 text-sm flex items-center justify-center gap-1.5"
                  >
                    <Users size={14} /> Live
                  </button>
                </div>
              </div>

              {!isUnlocked && (
                <div className="absolute inset-0 bg-card/85 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-muted-foreground">
                    <Lock size={22} />
                  </div>
                  <p className="text-sm font-black text-foreground">{def.title}</p>
                  <p className="text-xs font-bold text-muted-foreground">Play it first in the "{def.lessonTitle}" lesson to unlock it here.</p>
                  <button onClick={() => onOpenBeat(lessonIdFor(def), def.id)} className="game-btn bg-primary text-primary-foreground py-2 text-sm mt-1">
                    Go to lesson
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
