// Frame shared by every lesson game: start screen with the host STEMbot,
// 3-2-1 countdown, music, live/rival scoreboard, and the results screen with
// the 0–100 score and high score.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crown, LogOut, Music, Play, RotateCcw, Trophy, Users, Volume2, VolumeX, X } from "lucide-react";
import { STEMBOTS } from "../../data/mock";
import { cn } from "../../components/ui/utils";
import { isMuted, onMuteChange, primeAudio, setMuted, sfx, startMusic, stopMusic } from "./audio";
import { getHighScore, recordScore, seededRandom, starsFor } from "./scores";
import { useLiveRoom, type LiveRoom, type PlayerIdentity } from "./live";
import type { BotId, GameDef, GameSummaryItem } from "./types";
import "./games.css";

type Phase = "intro" | "lobby" | "countdown" | "playing" | "results";

interface Rival {
  id: string;
  name: string;
  avatar: string;
  score: number;
  progress: number;
  done: boolean;
  isMe?: boolean;
  isBot?: boolean;
}

export function MuteButton({ className }: { className?: string }) {
  const [m, setM] = useState(isMuted());
  useEffect(() => {
    const off = onMuteChange(setM);
    return () => {
      off();
    };
  }, []);
  return (
    <button
      onClick={() => setMuted(!m)}
      className={cn("w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white", className)}
      aria-label={m ? "Turn sound on" : "Turn sound off"}
      title={m ? "Sound off" : "Sound on"}
    >
      {m ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  );
}

export function BotBubble({ bot, text, className }: { bot: BotId; text: string; className?: string }) {
  const b = STEMBOTS[bot];
  return (
    <div className={cn("flex items-end gap-3", className)}>
      <img src={b.avatar} alt={b.name} className="w-20 h-20 object-contain drop-shadow-lg game-float shrink-0" />
      <div className="relative bg-white text-slate-800 rounded-2xl px-4 py-3 game-panel text-sm leading-snug game-fun">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">{b.name}</span>
        {text}
        <span className="absolute -left-2 bottom-4 w-4 h-4 bg-white rotate-45 border-l-[3px] border-b-[3px] border-black/15" />
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 1.8 + Math.random() * 1.4,
        dx: `${(Math.random() - 0.5) * 200}px`,
        color: ["#facc15", "#22c55e", "#3b82f6", "#ef4444", "#a855f7", "#f97316"][i % 6],
        size: 6 + Math.random() * 8,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-30">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-sm"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.6,
              background: p.color,
              animation: `game-confetti ${p.dur}s ${p.delay}s ease-in forwards`,
              "--dx": p.dx,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function Stars({ n, size = 34 }: { n: number; size?: number }) {
  return (
    <div className="flex gap-1 justify-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("game-bounce-in", i < n ? "" : "grayscale opacity-30")}
          style={{ fontSize: size, animationDelay: `${0.3 + i * 0.2}s` }}
        >
          ⭐
        </span>
      ))}
    </div>
  );
}

function Scoreboard({ rows, title }: { rows: Rival[]; title: string }) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  return (
    <div className="bg-slate-900/85 text-white rounded-2xl p-3 game-panel w-full">
      <p className="game-pixel text-[9px] text-amber-300 mb-2 flex items-center gap-1.5">
        <Trophy size={12} /> {title}
      </p>
      <div className="space-y-2">
        {sorted.map((r, i) => (
          <div key={r.id} className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5", r.isMe ? "bg-amber-400/25 ring-2 ring-amber-300" : "bg-white/5")}>
            <span className="game-pixel text-[9px] w-4 text-white/70">{i + 1}</span>
            {r.avatar ? (
              <img src={r.avatar} alt="" className="w-7 h-7 rounded-lg object-contain bg-white/10" />
            ) : (
              <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-xs">🙂</span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">
                {r.name}
                {r.isBot && <span className="text-white/50 font-medium"> · bot</span>}
              </p>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-0.5">
                <div className="h-full bg-gradient-to-r from-lime-400 to-yellow-300 transition-all duration-500" style={{ width: `${r.progress * 100}%` }} />
              </div>
            </div>
            <span className="game-pixel text-[10px] text-yellow-300 w-8 text-right">{r.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const BOT_IDS: BotId[] = ["sophia", "timothy", "emily", "matthew"];

export function GameShell({
  def,
  me,
  userId,
  context,
  liveCode = null,
  onExit,
  onFinished,
  onContinue,
  finishLabel,
}: {
  def: GameDef;
  me: PlayerIdentity;
  userId?: number | string;
  /** "lesson": first try inside a lesson (always solo). "arcade": the Games tab. */
  context: "lesson" | "arcade";
  /** Room code when playing live. */
  liveCode?: string | null;
  onExit: () => void;
  onFinished?: (score: number, isNewBest: boolean) => void;
  /** Results-screen main button. Defaults to leaving the game. */
  onContinue?: (score: number) => void;
  finishLabel?: string;
}) {
  const isLive = !!liveCode;
  const live = useLiveRoom(liveCode, me);
  const room = live.room;
  const isHost = !!room && room.hostId === me.id;

  const [phase, setPhase] = useState<Phase>(isLive ? "lobby" : "intro");
  const [count, setCount] = useState(3);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [runKey, setRunKey] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [myProgress, setMyProgress] = useState(0);
  const [result, setResult] = useState<{ score: number; summary: GameSummaryItem[]; isNew: boolean; previous: number | null } | null>(null);
  const [best, setBest] = useState<number | null>(() => getHighScore(def.id, userId));

  // ── Rival STEMbots for solo play ─────────────────────────
  const rivalPlan = useMemo(() => {
    const rnd = seededRandom(seed + 7);
    return BOT_IDS.filter((b) => b !== def.bot).map((b) => ({
      id: `bot-${b}`,
      name: STEMBOTS[b].name,
      avatar: STEMBOTS[b].avatar,
      target: Math.round(42 + rnd() * 50),
      pace: 0.85 + rnd() * 0.3,
    }));
  }, [seed, def.bot]);

  const rivals: Rival[] = useMemo(() => {
    const meRow: Rival = { id: me.id, name: "You", avatar: me.avatar, score: myScore, progress: myProgress, done: phase === "results", isMe: true };
    if (isLive && room) {
      return room.players.map((p) =>
        p.id === me.id
          ? { ...meRow, name: `${p.name} (you)` }
          : { id: p.id, name: p.name, avatar: p.avatar, score: p.score, progress: p.progress, done: p.done },
      );
    }
    if (def.ownBots) return [meRow];
    const finished = phase === "results";
    return [
      meRow,
      ...rivalPlan.map((r) => {
        const prog = finished ? 1 : Math.min(1, myProgress * r.pace);
        return { id: r.id, name: r.name, avatar: r.avatar, isBot: true, done: finished, progress: prog, score: Math.round(r.target * prog) };
      }),
    ];
  }, [isLive, room, me, myScore, myProgress, phase, rivalPlan, def.ownBots]);

  // ── Music / cleanup ──────────────────────────────────────
  useEffect(() => () => stopMusic(), []);

  // ── Live: follow the room's status ───────────────────────
  const handledStart = useRef<number | null>(null);
  useEffect(() => {
    if (!isLive || !room) return;
    if (room.status === "playing" && room.startedAt && handledStart.current !== room.startedAt) {
      handledStart.current = room.startedAt;
      setSeed(room.seed);
      setResult(null);
      setMyScore(0);
      setMyProgress(0);
      setRunKey((k) => k + 1);
      const msLeft = room.startedAt - Date.now();
      setCount(Math.max(1, Math.min(3, Math.ceil(msLeft / 1000))));
      setPhase("countdown");
    }
    if (room.status === "lobby" && phase === "results") setPhase("lobby");
  }, [isLive, room, phase]);

  // ── Countdown ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "countdown") return;
    startMusic(def.music);
    sfx.countdown();
    if (count <= 0) {
      sfx.go();
      setPhase("playing");
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 850);
    return () => clearTimeout(t);
  }, [phase, count, def.music]);

  const startSolo = () => {
    primeAudio();
    sfx.click();
    setSeed(Math.floor(Math.random() * 1e9));
    setResult(null);
    setMyScore(0);
    setMyProgress(0);
    setRunKey((k) => k + 1);
    setCount(3);
    setPhase("countdown");
  };

  // ── Reporting from the game ──────────────────────────────
  const lastSent = useRef(0);
  const reportProgress = useCallback(
    (score: number, progress: number) => {
      const s = Math.max(0, Math.min(100, Math.round(score)));
      const p = Math.max(0, Math.min(1, progress));
      setMyScore(s);
      setMyProgress(p);
      if (isLive && Date.now() - lastSent.current > 400) {
        lastSent.current = Date.now();
        live.act("progress", { score: s, progress: p });
      }
    },
    [isLive, live],
  );

  const finishedRef = useRef(false);
  useEffect(() => {
    finishedRef.current = false;
  }, [runKey]);

  const finish = useCallback(
    (score: number, summary: GameSummaryItem[] = []) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const s = Math.max(0, Math.min(100, Math.round(score)));
      const rec = recordScore(def.id, s, userId);
      setBest(rec.best);
      setMyScore(s);
      setMyProgress(1);
      setResult({ score: s, summary, isNew: rec.isNew && rec.previous !== null, previous: rec.previous });
      setPhase("results");
      stopMusic();
      if (rec.isNew && rec.previous !== null) sfx.levelUp();
      else sfx.fanfare();
      if (isLive) live.act("finish", { score: s });
      onFinished?.(s, rec.isNew);
    },
    [def.id, userId, isLive, live, onFinished],
  );

  const leave = () => {
    stopMusic();
    if (isLive) live.act("leave");
    onExit();
  };

  const bot = STEMBOTS[def.bot];
  const Game = def.Component;

  const liveApi = useMemo(
    () =>
      isLive && room
        ? {
            room: room as LiveRoom,
            isHost,
            send: (data: unknown) => {
              live.act("relay", data);
            },
            onRelay: live.onRelay,
          }
        : undefined,
    // Only re-create when identity-relevant parts change, so games don't re-subscribe on every progress tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLive, room?.code, room?.hostId, room?.players.length, room?.status, isHost],
  );

  const showBoard = phase === "playing" || phase === "results" || phase === "countdown";
  const boardTitle = isLive ? "LIVE" : def.ownBots ? "YOUR SCORE" : "VS STEMBOTS";

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header band */}
      <div className={cn("relative rounded-t-3xl px-4 sm:px-6 py-3 flex items-center gap-3 text-white overflow-hidden game-checker", def.gradient)}>
        <span className="text-3xl drop-shadow">{def.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/80 truncate">{def.lessonTitle}</p>
          <h2 className="game-fun text-xl sm:text-2xl font-bold leading-tight truncate drop-shadow">{def.title}</h2>
        </div>
        <div className="hidden sm:flex flex-col items-end mr-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">High score</span>
          <span className="game-pixel text-sm text-yellow-200 drop-shadow">{best ?? "--"}/100</span>
        </div>
        {isLive && room && (
          <span className="hidden sm:flex items-center gap-1 bg-white/20 rounded-xl px-3 py-2 text-xs font-bold">
            <Users size={14} /> {room.code}
          </span>
        )}
        <MuteButton />
        <button onClick={leave} className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center" aria-label="Exit game">
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 bg-slate-950 rounded-b-3xl p-3">
        {/* Stage: fixed size so every game feels the same */}
        <div className="relative flex-1 min-w-0 rounded-2xl overflow-hidden bg-slate-900 h-[600px]">
          {phase === "intro" && (
            <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-6 p-6 game-checker", def.gradient)}>
              <BotBubble bot={def.bot} text={def.intro} className="max-w-xl" />
              <div className="bg-white/95 text-slate-800 rounded-2xl p-4 game-panel max-w-xl w-full">
                <p className="game-pixel text-[10px] text-slate-500 mb-2">HOW TO PLAY</p>
                <ul className="space-y-1.5 text-sm game-fun">
                  {def.howTo.map((h) => (
                    <li key={h} className="flex gap-2">
                      <span>▸</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 text-xs font-bold text-slate-500">
                  <span>{context === "lesson" ? "Single player · first try" : def.ownBots ? "Single player vs bots" : "Single player vs STEMbots"}</span>
                  <span>Best: {best ?? "--"}/100</span>
                </div>
              </div>
              <button onClick={startSolo} className="game-btn bg-yellow-400 text-slate-900 text-xl px-10 py-4 flex items-center gap-2 game-pulse">
                <Play size={22} fill="currentColor" /> PLAY
              </button>
              <p className="text-white/80 text-xs flex items-center gap-1.5">
                <Music size={12} /> Music and sound on. Use the speaker button to mute.
              </p>
            </div>
          )}

          {phase === "lobby" && (
            <LiveLobby room={room} me={me} error={live.error} isHost={isHost} act={live.act} def={def} />
          )}

          {(phase === "countdown" || phase === "playing" || phase === "results") && (
            <div className="absolute inset-0">
              <Game
                key={runKey}
                mode={isLive ? "live" : "solo"}
                seed={seed}
                me={me}
                live={liveApi}
                reportProgress={phase === "playing" ? reportProgress : () => {}}
                finish={finish}
              />
            </div>
          )}

          {phase === "countdown" && (
            <div className="absolute inset-0 z-20 bg-slate-950/60 flex items-center justify-center">
              <span key={count} className="game-pixel text-7xl text-yellow-300 drop-shadow-[0_6px_0_rgba(0,0,0,0.5)] game-bounce-in">
                {count > 0 ? count : "GO!"}
              </span>
            </div>
          )}

          {phase === "results" && result && (
            <div className="absolute inset-0 z-20 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
              {result.isNew && <Confetti />}
              <div className="relative bg-white text-slate-800 rounded-3xl game-panel p-6 w-full max-w-md text-center game-bounce-in">
                {result.isNew && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-fuchsia-500 to-orange-400 text-white game-pixel text-[10px] px-4 py-2 rounded-xl shadow-lg whitespace-nowrap">
                    NEW HIGH SCORE!
                  </div>
                )}
                <img src={bot.avatar} alt="" className="w-16 h-16 mx-auto object-contain game-float" />
                <p className="game-pixel text-[10px] text-slate-500 mt-2">YOUR SCORE</p>
                <p className="game-pixel text-5xl text-slate-900 my-2">
                  {result.score}
                  <span className="text-lg text-slate-400">/100</span>
                </p>
                <Stars n={starsFor(result.score)} />
                <p className="text-sm text-slate-500 mt-2 game-fun">
                  {result.previous === null
                    ? "First score saved! Replay to beat it."
                    : result.isNew
                      ? `You beat your old best of ${result.previous}!`
                      : `Best: ${best}. ${best! - result.score <= 10 ? "So close!" : "Have another go!"}`}
                </p>
                {result.summary.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {result.summary.map((s) => (
                      <div key={s.label} className="bg-slate-100 rounded-xl px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-slate-500">{s.label}</p>
                        <p className="font-bold game-fun">{s.value}</p>
                      </div>
                    ))}
                  </div>
                )}
                {isLive && room && <LiveResults room={room} meId={me.id} />}
                <div className="flex flex-col sm:flex-row gap-2 mt-5">
                  {!isLive && (
                    <button onClick={startSolo} className="game-btn bg-yellow-400 text-slate-900 flex-1 flex items-center justify-center gap-2">
                      <RotateCcw size={16} /> Play again
                    </button>
                  )}
                  {isLive && isHost && room?.status === "finished" && (
                    <button onClick={() => live.act("rematch")} className="game-btn bg-yellow-400 text-slate-900 flex-1 flex items-center justify-center gap-2">
                      <RotateCcw size={16} /> Rematch
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (onContinue) {
                        stopMusic();
                        if (isLive) live.act("leave");
                        onContinue(result.score);
                      } else leave();
                    }}
                    className="game-btn bg-emerald-500 text-white flex-1"
                  >
                    {finishLabel ?? (context === "lesson" ? "Continue" : "Back to games")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scoreboard */}
        {showBoard && rivals.length > 1 && (
          <div className="lg:w-60 shrink-0">
            <Scoreboard rows={rivals} title={boardTitle} />
          </div>
        )}
      </div>
    </div>
  );
}

function LiveResults({ room, meId }: { room: LiveRoom; meId: string }) {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const waiting = room.players.filter((p) => !p.done && p.connected).length;
  return (
    <div className="mt-4 text-left">
      <p className="game-pixel text-[9px] text-slate-500 mb-2">{waiting ? `WAITING FOR ${waiting} PLAYER${waiting > 1 ? "S" : ""}…` : "FINAL RESULTS"}</p>
      {sorted.map((p, i) => (
        <div key={p.id} className={cn("flex items-center gap-2 py-1", p.id === meId && "font-bold")}>
          <span className="w-5">{i === 0 && !waiting ? <Crown size={14} className="text-amber-500" /> : i + 1}</span>
          <span className="flex-1 truncate text-sm">{p.name}</span>
          <span className="game-pixel text-[10px]">{p.done ? p.score : "…"}</span>
        </div>
      ))}
    </div>
  );
}

function LiveLobby({
  room,
  me,
  error,
  isHost,
  act,
  def,
}: {
  room: LiveRoom | null;
  me: PlayerIdentity;
  error: string | null;
  isHost: boolean;
  act: (type: string, payload?: unknown) => Promise<LiveRoom | null>;
  def: GameDef;
}) {
  if (!room) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-white game-fun">
        {error ?? "Connecting to the game room…"}
      </div>
    );
  }
  const mePlayer = room.players.find((p) => p.id === me.id);
  const others = room.players.filter((p) => p.id !== room.hostId);
  const canStart = room.players.length >= 2 && others.every((p) => p.ready);
  return (
    <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 game-checker", def.gradient)}>
      <div className="bg-white/95 text-slate-800 rounded-3xl game-panel p-5 w-full max-w-lg text-center">
        <p className="game-pixel text-[10px] text-slate-500">GAME CODE</p>
        <p className="game-pixel text-4xl tracking-[0.3em] text-slate-900 my-2">{room.code}</p>
        <p className="text-xs text-slate-500 game-fun">Friends join from the Games tab with this code. 2 to 4 players.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {Array.from({ length: 4 }, (_, i) => room.players[i]).map((p, i) => (
            <div key={p?.id ?? `empty-${i}`} className={cn("rounded-2xl p-2 border-2", p ? "border-emerald-300 bg-emerald-50" : "border-dashed border-slate-300")}>
              {p ? (
                <>
                  {p.avatar ? <img src={p.avatar} alt="" className="w-12 h-12 mx-auto object-contain" /> : <div className="w-12 h-12 mx-auto text-3xl">🙂</div>}
                  <p className="text-xs font-bold truncate mt-1">{p.name}</p>
                  <p className={cn("text-[10px] font-bold", p.id === room.hostId ? "text-amber-600" : p.ready ? "text-emerald-600" : "text-slate-400")}>
                    {p.id === room.hostId ? "HOST" : p.ready ? "READY" : "not ready"}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-400 py-5">Waiting…</p>
              )}
            </div>
          ))}
        </div>
        {error && <p className="text-xs text-rose-600 mt-3">{error}</p>}
        <div className="mt-5 flex gap-2 justify-center">
          {isHost ? (
            <button
              disabled={!canStart}
              onClick={() => {
                primeAudio();
                sfx.click();
                act("start");
              }}
              className="game-btn bg-yellow-400 text-slate-900 flex items-center gap-2"
            >
              <Play size={16} fill="currentColor" /> {room.players.length < 2 ? "Waiting for players" : canStart ? "Start game" : "Waiting for ready"}
            </button>
          ) : (
            <button
              onClick={() => {
                primeAudio();
                sfx.click();
                act("ready", { ready: !mePlayer?.ready });
              }}
              className={cn("game-btn", mePlayer?.ready ? "bg-emerald-500 text-white" : "bg-yellow-400 text-slate-900")}
            >
              {mePlayer?.ready ? "Ready! ✓" : "I'm ready"}
            </button>
          )}
        </div>
      </div>
      <p className="text-white/90 text-xs flex items-center gap-1.5 game-fun">
        <LogOut size={12} /> Use the X button to leave the room.
      </p>
    </div>
  );
}
