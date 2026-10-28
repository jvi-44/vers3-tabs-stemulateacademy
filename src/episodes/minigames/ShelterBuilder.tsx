import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { sfx } from "../../games/kit/audio";
import type { GameResult } from "../types";
import { HelperTip, Hud, Meter, MiniGameFrame, Pill, useFrame, type MiniGameProps } from "./kit";
import type { LevelBand } from "../../data/levels";

// Area: the storm is coming. Mark out a shelter floor with exactly the area asked
// for by tapping one corner block, then the opposite corner.

const COLS = 7;
const ROWS = 5;
// Floor areas to build. P1–2 count small floors of squares; P3–6 use length × width.
const TARGETS_BY_BAND: Record<LevelBand, number[]> = { p12: [4, 6, 8], p34: [12, 15, 18], p56: [12, 15, 18] };
const TO_WIN = 2;
const SECONDS = 75;

type Cell = { c: number; r: number };

function rect(a: Cell, b: Cell) {
  const c0 = Math.min(a.c, b.c);
  const c1 = Math.max(a.c, b.c);
  const r0 = Math.min(a.r, b.r);
  const r1 = Math.max(a.r, b.r);
  return { c0, c1, r0, r1, len: c1 - c0 + 1, wid: r1 - r0 + 1 };
}

const TIPS: Record<number, string> = {
  4: "4 squares could be 2 long and 2 wide. Count them: 1, 2, 3, 4!",
  6: "Try 3 squares in a row, then another row of 3. That's 6!",
  8: "Try 4 squares in a row, then another row of 4. That's 8!",
  12: "12 could be 4 long and 3 wide. 4 × 3 = 12!",
  15: "Which two numbers multiply to make 15? Try 5 and 3.",
  18: "18 = 6 × 3. Six blocks long, three blocks wide!",
};

export function ShelterBuilder({ onDone, helper, band }: MiniGameProps) {
  const TARGETS = TARGETS_BY_BAND[band];
  const [round, setRound] = useState(0);
  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);
  const [built, setBuilt] = useState<ReturnType<typeof rect> | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [wins, setWins] = useState(0);
  const [misses, setMisses] = useState(0);
  const [time, setTime] = useState(SECONDS);
  const [result, setResult] = useState<GameResult | null>(null);
  const [playing, setPlaying] = useState(false);

  const target = TARGETS[round];
  const preview = anchor ? rect(anchor, hover ?? anchor) : null;
  const shown = built ?? preview;

  const finish = (w: number) => setResult({ won: w >= TO_WIN, score: Math.round((w / TARGETS.length) * 100) });

  useFrame((dt) => {
    setTime((t) => Math.max(0, t - dt));
  }, playing && !result);

  useEffect(() => {
    if (playing && !result && time <= 0) finish(wins);
  }, [time <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (cell: Cell) => {
    if (!playing || result || built) return;
    if (!anchor) {
      sfx.place();
      setAnchor(cell);
      setHover(cell);
      return;
    }
    const r = rect(anchor, cell);
    setAnchor(null);
    setHover(null);
    const area = r.len * r.wid;
    const ok = area === target;
    setBuilt(r);
    if (ok) {
      sfx.levelUp();
      setFeedback({ ok, text: `${r.len} × ${r.wid} = ${area}. Perfect fit!` });
    } else {
      sfx.wrong();
      setMisses((m) => m + 1);
      setFeedback({ ok, text: `${r.len} × ${r.wid} = ${area}. We need ${target}! Try again.` });
    }
    setTimeout(
      () => {
        setBuilt(null);
        setFeedback(null);
        if (!ok) return;
        const w = wins + 1;
        setWins(w);
        if (round + 1 >= TARGETS.length) finish(w);
        else {
          setRound((n) => n + 1);
          setMisses(0);
        }
      },
      ok ? 1100 : 1400,
    );
  };

  const inShown = (c: number, r: number) => shown && c >= shown.c0 && c <= shown.c1 && r >= shown.r0 && r <= shown.r1;

  return (
    <MiniGameFrame
      title="Storm Shelter"
      result={result}
      onDone={onDone}
      onPlaying={setPlaying}
      howTo={
        <>
          <p>A storm is coming! Build shelter floors with exactly the right area.</p>
          <p>
            Tap one corner block, then the opposite corner.{" "}
            <b>{band === "p12" ? "Count the squares inside." : "Area = length × width."}</b> Build {TO_WIN} of {TARGETS.length} before the sun
            sets!
          </p>
        </>
      }
    >
      <div className="absolute inset-0 flex flex-col">
        <Hud>
          <Pill>
            Floor {Math.min(round + 1, TARGETS.length)} / {TARGETS.length}
          </Pill>
          <div className="flex-1 min-w-0">
            <Meter value={time} max={SECONDS} color="linear-gradient(90deg,#f97316,#facc15)" label="Sunset" />
          </div>
          <Pill className="bg-[#bbf7d0]">✓ {wins}</Pill>
        </Hud>

        <div className="mt-12 sm:mt-14 flex justify-center px-3">
          <motion.div
            key={round}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border-[3px] border-[#1f1a17] bg-[#fef3c7] px-4 py-1.5 text-center shadow-[3px_3px_0_#1f1a17]"
          >
            <span className="block text-[11px] font-black uppercase tracking-wider text-[#7c5a1a]">Build a floor with area</span>
            <span className="font-display text-3xl sm:text-4xl font-bold text-[#1f1a17]">{target ?? "-"}</span>
            <span className="ml-1 text-sm font-bold text-[#7c5a1a]">blocks</span>
          </motion.div>
        </div>

        <div className="flex-1 min-h-0 grid place-items-center p-3 pb-16">
          <div
            className="grid gap-1 sm:gap-1.5 w-full max-w-[min(30rem,62vh)] select-none touch-none"
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
            onPointerLeave={() => anchor && setHover(anchor)}
          >
            {Array.from({ length: ROWS * COLS }, (_, k) => {
              const c = k % COLS;
              const r = Math.floor(k / COLS);
              const on = inShown(c, r);
              const isAnchor = anchor && anchor.c === c && anchor.r === r;
              const plank = built && on && feedback?.ok;
              return (
                <button
                  key={k}
                  aria-label={`Block ${c + 1}, ${r + 1}`}
                  onPointerEnter={() => anchor && setHover({ c, r })}
                  onClick={() => tap({ c, r })}
                  className="aspect-square rounded-[4px] border-2 border-[#1f1a17] transition-transform active:scale-90"
                  style={{
                    background: plank
                      ? "repeating-linear-gradient(0deg,#c08a4a 0 30%,#a0703c 30% 34%)"
                      : on
                        ? built && !feedback?.ok
                          ? "#fca5a5"
                          : "#fde047"
                        : "linear-gradient(#5fb63a 0 28%, #8b5a2b 28%)",
                    boxShadow: isAnchor ? "0 0 0 3px #fff, 0 0 0 6px #1f1a17" : "inset -3px -3px 0 rgba(0,0,0,0.18)",
                  }}
                />
              );
            })}
          </div>
        </div>

        {(shown || feedback) && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center px-4 z-10 pointer-events-none">
            <span
              className={`rounded-xl border-[3px] border-[#1f1a17] px-3 py-1.5 font-bold text-sm sm:text-base text-[#1f1a17] shadow-[3px_3px_0_#1f1a17] ${
                feedback ? (feedback.ok ? "bg-[#bbf7d0]" : "bg-[#fde68a]") : "bg-white"
              }`}
            >
              {feedback ? feedback.text : shown && `${shown.len} long × ${shown.wid} wide = ${shown.len * shown.wid}`}
            </span>
          </div>
        )}

        <HelperTip bot={helper} text={misses > 0 && target ? TIPS[target] : null} className="left-2 bottom-12 sm:bottom-14" />
      </div>
    </MiniGameFrame>
  );
}
