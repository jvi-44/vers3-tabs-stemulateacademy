import { useEffect, useState } from "react";
import { Lock, Gamepad2, Star, Users, Play, Trophy, LogIn, RefreshCw, Zap } from "lucide-react";
import { STEMBOTS } from "../data/mock";
import { GAMES } from "../games/registry";
import { GameShell } from "../games/kit/GameShell";
import { useGamePlayer } from "../games/kit/player";
import { getAllHighScores, starsFor } from "../games/kit/scores";
import { createRoom, joinRoom, listRooms, type LiveRoom } from "../games/kit/live";
import { primeAudio, sfx } from "../games/kit/audio";
import type { GameDef } from "../games/kit/types";
import { REPLAY_REWARD } from "../data/lessonContent";
import { cn } from "./ui/utils";
import { GAME_ART, GameProp } from "./GameArt";
import "../games/kit/games.css";

// Paid by the server (POST /api/progress with replay: true), at most 3 times
// per game per day; these are only for the label.
const REPLAY_XP = REPLAY_REWARD.xp;
const REPLAY_ATOMS = REPLAY_REWARD.atoms;

type Session = { def: GameDef; liveCode: string | null };

export function GamesTab({
  completedBeats,
  onOpenBeat,
  onReplay,
  isGuest = false,
}: {
  completedBeats: Record<string, boolean>;
  onOpenBeat: (lessonId: string, beatId: string) => void;
  /** A finished replay of a game; the server decides whether it earns a top-up. */
  onReplay: (beatId: string) => void;
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
        onFinished={() => onReplay(session.def.id)}
      />
    );
  }

  const totalStars = GAMES.reduce((n, g) => n + (best[g.id] !== undefined ? starsFor(best[g.id]) : 0), 0);

  return (
    <div className="w-full space-y-5">
      <div className="sticker relative overflow-hidden p-5 sm:p-6 flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex-1 min-w-0">
          <span className="kicker">
            <Gamepad2 size={13} /> Games arcade
          </span>
          <h1 className="font-display text-[color:var(--card-foreground)] !text-[clamp(1.8rem,1.3rem+1.5vw,2.6rem)] mt-3 mb-1">
            Play, replay, <span className="mark-pop">beat your best</span>
          </h1>
          <p className="text-sm font-semibold text-muted-foreground max-w-xl">
            Play each game in its lesson first, then come back to beat your high score, alone against the STEMbots or live with 2 to 4
            friends.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="chip-ink !text-xs">
              <Star size={14} className="fill-amber-400 text-amber-500" />
              {totalStars} / {GAMES.length * 3} stars
            </span>
            <span className="chip-ink !text-xs">
              <Zap size={14} /> +{REPLAY_XP} XP and {REPLAY_ATOMS} Atoms a replay (3 a day)
            </span>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2 md:w-[22rem] shrink-0" aria-hidden>
          {GAMES.map((g, i) => (
            <div
              key={g.id}
              className="arcade-tile"
              style={{ backgroundColor: GAME_ART[g.id]?.tint, rotate: `${i % 2 ? 3 : -3}deg` }}
            >
              <GameProp id={g.id} className="w-[88%] max-h-[88%]" />
            </div>
          ))}
        </div>
      </div>

      {/* Join a live game */}
      {isGuest ? (
        <div className="rounded-[1.6rem] bg-soft-3 border-2 border-dashed border-foreground/20 p-4 flex items-center gap-3">
          <Lock size={18} className="text-muted-foreground shrink-0" />
          <p className="text-sm font-semibold text-foreground">
            Live games with friends are for members. Create a free account to play live.
          </p>
        </div>
      ) : (
        <div className="games-banner p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-3 flex-1">
              <span className="w-10 h-10 rounded-2xl bg-card text-[color:var(--card-foreground)] border-[2.5px] border-ink flex items-center justify-center shrink-0 rotate-[-6deg]">
                <Users size={19} strokeWidth={2.5} />
              </span>
              <div>
                <p className="font-display font-bold text-lg leading-tight">Play live with friends</p>
                <p className="text-xs font-semibold opacity-85">Pick Live on a game to host and share its code, or join a friend's game here.</p>
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
                className="w-28 rounded-xl px-3 py-2 font-black tracking-[0.3em] text-center bg-white text-[#1b1b12] placeholder:text-[#1b1b12]/35 border-[2.5px] border-ink"
              />
              <button disabled={busy || joinCode.length < 4} className="btn-pop btn-pop-sm btn-pop2">
                <LogIn size={15} /> Join
              </button>
            </form>
          </div>
          {joinError && (
            <p className="mt-3 text-xs font-bold rounded-xl px-3 py-2 bg-card text-[color:var(--card-foreground)] border-2 border-ink">{joinError}</p>
          )}
          {openRooms.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {openRooms.map((r) => {
                const def = GAMES.find((g) => g.id === r.gameId);
                const host = r.players.find((p) => p.id === r.hostId);
                if (!def) return null;
                return (
                  <button
                    key={r.code}
                    onClick={() => join(r.code)}
                    className="flex items-center gap-2 rounded-2xl pl-1.5 pr-3 py-1.5 text-left bg-card text-[color:var(--card-foreground)] border-2 border-ink shadow-[0_3px_0_var(--ink-line)] hover:-translate-y-0.5 transition-transform"
                  >
                    <span className="w-9 h-9 rounded-xl border-2 border-ink flex items-center justify-center" style={{ backgroundColor: GAME_ART[def.id]?.tint }}>
                      <GameProp id={def.id} className="w-[85%] max-h-[85%]" />
                    </span>
                    <span className="text-xs font-semibold">
                      <span className="font-black block">{def.title}</span>
                      {host?.name ?? "Someone"} · {r.players.length}/4 players · {r.code}
                    </span>
                  </button>
                );
              })}
              <button onClick={refreshRooms} className="btn-pop btn-pop-sm !px-2.5" aria-label="Refresh open games">
                <RefreshCw size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {GAMES.map((def, i) => {
          const isUnlocked = unlocked(def);
          const score = best[def.id];
          const stars = score !== undefined ? starsFor(score) : 0;
          const bot = STEMBOTS[def.bot];
          const art = GAME_ART[def.id];
          return (
            <div key={def.id} className="group relative sticker overflow-hidden flex flex-col transition-transform duration-300 hover:-translate-y-1">
              <div className="arcade-art" style={{ backgroundColor: art?.tint }}>
                <GameProp
                  id={def.id}
                  className={cn(
                    "absolute right-[6%] top-[10%] h-[80%] transition-transform duration-300 group-hover:scale-105",
                    i % 2 ? "group-hover:rotate-3" : "group-hover:-rotate-3",
                  )}
                />
                <img src={bot.avatar} alt={bot.name} className="absolute left-[4%] bottom-[-12%] h-[78%] die-cut bob" />
                <span className="arcade-host">Hosted by {bot.name}</span>
                {score !== undefined && (
                  <span className="absolute right-3 top-3 chip-ink !text-xs !py-1 !px-2">
                    <Trophy size={12} /> {score}/100
                  </span>
                )}
              </div>
              <div className="p-4 flex flex-col flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{def.lessonTitle}</p>
                <h3 className="font-display font-bold text-lg text-[color:var(--card-foreground)] leading-tight">{def.title}</h3>
                <p className="text-xs font-semibold text-muted-foreground mt-1 min-h-[2rem]">{def.tagline}</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex gap-0.5" aria-label={`${stars} of 3 stars`}>
                    {[0, 1, 2].map((n) => (
                      <Star
                        key={n}
                        size={17}
                        strokeWidth={2.4}
                        className={n < stars ? "fill-amber-400 text-[color:var(--ink-line)]" : "text-muted-foreground/40"}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground">Best: {score ?? "--"}/100</span>
                </div>
                <div className="meter mt-1.5 !h-2.5 !border-[1.5px]">
                  <span style={{ width: `${score ?? 0}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-auto pt-4">
                  <button
                    disabled={!isUnlocked}
                    onClick={() => {
                      primeAudio();
                      sfx.click();
                      setSession({ def, liveCode: null });
                    }}
                    className="btn-pop btn-pop-sm btn-primary justify-center"
                  >
                    <Play size={14} fill="currentColor" /> Solo
                  </button>
                  <button
                    disabled={!isUnlocked || busy || isGuest}
                    title={isGuest ? "Live play is for members" : undefined}
                    onClick={() => startLive(def)}
                    className="btn-pop btn-pop-sm justify-center"
                  >
                    <Users size={14} /> Live
                  </button>
                </div>
              </div>

              {!isUnlocked && (
                <div className="absolute inset-0 bg-card/85 backdrop-blur-[3px] flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-soft-1 border-[2.5px] border-ink shadow-[0_3px_0_var(--ink-line)] flex items-center justify-center text-[#1b1b12] rotate-[-6deg]">
                    <Lock size={22} strokeWidth={2.5} />
                  </div>
                  <p className="text-sm font-black text-[color:var(--card-foreground)]">{def.title}</p>
                  <p className="text-xs font-bold text-muted-foreground">Play it first in the "{def.lessonTitle}" lesson to unlock it here.</p>
                  <button onClick={() => onOpenBeat(lessonIdFor(def), def.id)} className="btn-pop btn-pop-sm btn-primary mt-1">
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
