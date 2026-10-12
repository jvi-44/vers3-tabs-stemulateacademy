import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { sfx } from "../../games/kit/audio";
import { STEMBOTS } from "../../data/mock";
import type { BotId, GameResult } from "../types";

export interface MiniGameProps {
  onDone: (result: GameResult) => void;
  /** The STEMbot helping in this game (gives hints). */
  helper: BotId;
}

/** Calls `fn` every animation frame with the seconds since the last frame. */
export function useFrame(fn: (dt: number) => void, running: boolean) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let id = requestAnimationFrame(function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ref.current(dt);
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [running]);
}

type Phase = "howto" | "countdown" | "play" | "done";

/**
 * Shared frame for every mini-game: a "how to play" card, a 3-2-1 countdown,
 * then the game itself, then a result banner before handing back to the story.
 */
export function MiniGameFrame({
  title,
  howTo,
  children,
  result,
  onDone,
  onPlaying,
}: {
  title: string;
  howTo: ReactNode;
  children: ReactNode;
  /** Told when the game clock should run (after the countdown, before the result). */
  onPlaying: (playing: boolean) => void;
  /** Set by the game when it ends. */
  result: GameResult | null;
  onDone: (r: GameResult) => void;
}) {
  const [phase, setPhase] = useState<Phase>("howto");
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (count === 0) {
      sfx.go();
      setPhase("play");
      return;
    }
    sfx.countdown();
    const t = setTimeout(() => setCount((c) => c - 1), 650);
    return () => clearTimeout(t);
  }, [phase, count]);

  useEffect(() => {
    onPlaying(phase === "play");
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!result || phase === "done") return;
    setPhase("done");
    if (result.won) sfx.fanfare();
    else sfx.wrong();
    const t = setTimeout(() => onDone(result), 1800);
    return () => clearTimeout(t);
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0 z-30 flex flex-col">
      <div className="relative flex-1 min-h-0">{children}</div>

      <AnimatePresence>
        {phase === "howto" && (
          <motion.div
            key="howto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 grid place-items-center bg-black/55 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -3 }}
              animate={{ scale: 1, rotate: 0 }}
              className="ep-card max-w-md w-full text-center"
            >
              <p className="ep-kicker">Mini-game</p>
              <h3 className="font-display font-bold text-2xl sm:text-3xl mb-2">{title}</h3>
              <div className="text-[0.98rem] font-semibold leading-snug text-[#3b2f1a] space-y-1.5">{howTo}</div>
              <button
                autoFocus
                onClick={() => {
                  sfx.click();
                  setPhase("countdown");
                }}
                className="ep-btn ep-btn-go mt-4 w-full"
              >
                I'm ready!
              </button>
            </motion.div>
          </motion.div>
        )}
        {phase === "countdown" && count > 0 && (
          <motion.div
            key={`c${count}`}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="absolute inset-0 z-40 grid place-items-center pointer-events-none"
          >
            <span className="ep-countdown">{count}</span>
          </motion.div>
        )}
        {phase === "done" && result && (
          <motion.div
            key="done"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 z-40 grid place-items-center bg-black/40 pointer-events-none"
          >
            <span className={`ep-banner ${result.won ? "ep-banner-win" : "ep-banner-try"}`}>{result.won ? "Brilliant!" : "Good try!"}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A thin bar along the top of a game. */
export function Meter({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2 min-w-0">
      {label && <span className="text-[11px] font-black uppercase tracking-wider text-white drop-shadow shrink-0">{label}</span>}
      <div className="h-3.5 flex-1 rounded-full bg-black/40 border-2 border-[#1f1a17] overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function Hud({ children }: { children: ReactNode }) {
  return <div className="absolute inset-x-0 top-0 z-10 p-2 sm:p-3 flex items-center gap-2 sm:gap-3">{children}</div>;
}

export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`shrink-0 rounded-full border-2 border-[#1f1a17] bg-white px-2.5 py-0.5 text-xs sm:text-sm font-black text-[#1f1a17] shadow-[2px_2px_0_#1f1a17] ${className}`}
    >
      {children}
    </span>
  );
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The helper STEMbot peeking in from a corner with a short tip. */
export function HelperTip({ bot, text, className = "" }: { bot: BotId; text: string | null; className?: string }) {
  const b = STEMBOTS[bot];
  return (
    <div className={`absolute z-20 flex items-end gap-1.5 pointer-events-none ${className}`}>
      <img src={b.avatar} alt={b.name} className="w-12 h-12 sm:w-16 sm:h-16 object-contain drop-shadow-lg" />
      <AnimatePresence mode="wait">
        {text && (
          <motion.span
            key={text}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mb-3 max-w-[13rem] rounded-xl rounded-bl-none border-2 border-[#1f1a17] bg-white px-2 py-1 text-[11px] sm:text-xs font-bold leading-snug text-[#1f1a17] shadow-[2px_2px_0_#1f1a17]"
          >
            <span className="block text-[9px] uppercase tracking-wider text-[#6b5a3a]">{b.name}</span>
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
