import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { sfx } from "../../games/kit/audio";
import type { GameResult } from "../types";
import { Hud, MiniGameFrame, Pill, shuffle, useFrame, type MiniGameProps } from "./kit";
import { orOriginal } from "../../data/levels";
import { MATTER_ITEMS } from "../../content/matterSorter";

// States of matter: blocks float up out of the ground; tap SOLID, LIQUID or GAS
// before each one drifts off the top.

type State = "solid" | "liquid" | "gas";

interface Item {
  name: string;
  state: State;
  color: string;
  why: string;
}

const ITEMS: Item[] = [
  { name: "Ice block", state: "solid", color: "#bae6fd", why: "Ice is frozen water, a solid with a fixed shape." },
  { name: "Lava", state: "liquid", color: "#f97316", why: "Lava is melted rock. It flows, so it's a liquid." },
  { name: "Steam", state: "gas", color: "#e2e8f0", why: "Steam is water as a gas. It spreads out to fill space." },
  { name: "Stone", state: "solid", color: "#a3a3a3", why: "Stone keeps its shape, so it's a solid." },
  { name: "Bucket of water", state: "liquid", color: "#3b82f6", why: "Water takes the shape of its bucket: a liquid." },
  { name: "Milk", state: "liquid", color: "#fffaf0", why: "Milk pours and flows, so it's a liquid." },
  { name: "Smoke", state: "gas", color: "#94a3b8", why: "Smoke drifts and spreads everywhere: a gas." },
  { name: "Snowball", state: "solid", color: "#ffffff", why: "Snow is frozen water, so it's a solid." },
  { name: "Wood log", state: "solid", color: "#a0703c", why: "Wood has a fixed shape and volume: a solid." },
  { name: "Water vapour", state: "gas", color: "#dbeafe", why: "Water vapour is invisible water gas in the air." },
  { name: "Honey", state: "liquid", color: "#f59e0b", why: "Honey flows slowly, but it still flows. Liquid!" },
  { name: "Air", state: "gas", color: "#e0f2fe", why: "Air is a mix of gases all around us." },
];

const ROUNDS = 10;
const TO_WIN = 7;
const BUTTONS: Array<{ state: State; label: string; easy: string; key: string; cls: string }> = [
  { state: "solid", label: "Solid", easy: "Solid (hard)", key: "1", cls: "bg-[#a3a3a3]" },
  { state: "liquid", label: "Liquid", easy: "Liquid (runny)", key: "2", cls: "bg-[#60a5fa]" },
  { state: "gas", label: "Gas", easy: "Gas (floaty)", key: "3", cls: "bg-[#e2e8f0]" },
];

export function MatterSorter({ onDone, band }: MiniGameProps) {
  // The original items are the P5–6 set; P1–2 and P3–4 have their own.
  const deck = useMemo(() => shuffle(band === "p56" ? ITEMS : orOriginal(MATTER_ITEMS[band], ITEMS)).slice(0, ROUNDS), [band]);
  const [i, setI] = useState(0);
  const [y, setY] = useState(0); // 0 = ground, 1 = top
  const yRef = useRef(0);
  const locked = useRef(false);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [playing, setPlaying] = useState(false);

  const item = deck[i];
  // Each block rises a little faster than the last.
  const riseSeconds = 6 - (i / ROUNDS) * 2.5;

  const answer = (picked: State | null) => {
    if (!playing || locked.current || result) return;
    locked.current = true;
    const ok = picked === item.state;
    if (ok) {
      sfx.correct();
      setScore((s) => s + 1);
    } else sfx.wrong();
    setFeedback({ ok, text: ok ? `${item.name}: ${item.state}!` : item.why });
    setTimeout(
      () => {
        setFeedback(null);
        locked.current = false;
        yRef.current = 0;
        setY(0);
        if (i + 1 >= ROUNDS) {
          const final = score + (ok ? 1 : 0);
          setResult({ won: final >= TO_WIN, score: Math.round((final / ROUNDS) * 100) });
        } else setI((n) => n + 1);
      },
      ok ? 650 : 1500,
    );
  };

  useFrame(
    (dt) => {
      if (feedback || result) return;
      const next = Math.min(1, yRef.current + dt / riseSeconds);
      yRef.current = next;
      setY(next);
      if (next >= 1) answer(null);
    },
    playing && !feedback && !result,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const b = BUTTONS.find((x) => x.key === e.key);
      if (b) answer(b.state);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <MiniGameFrame
      title="Phase Fixer"
      result={result}
      onDone={onDone}
      onPlaying={setPlaying}
      howTo={
        <>
          <p>The glitch scrambled the blocks! Each one floats up out of the ground.</p>
          <p>
            Tap <b>Solid</b>, <b>Liquid</b> or <b>Gas</b> before it floats away. Get {TO_WIN} of {ROUNDS} right to reboot the water cycle!
          </p>
        </>
      }
    >
      <div className="absolute inset-0">
        <Hud>
          <Pill>
            Block {Math.min(i + 1, ROUNDS)} / {ROUNDS}
          </Pill>
          <Pill className="bg-[#bbf7d0]">✓ {score}</Pill>
        </Hud>

        {/* The floating block */}
        <div className="absolute inset-x-0 top-[10%] bottom-[30%]">
          <AnimatePresence mode="popLayout">
            {item && !result && (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={feedback ? (feedback.ok ? { scale: 1.3, opacity: 0 } : { x: [0, -10, 10, -6, 6, 0] }) : { scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: feedback ? 0.5 : 0.25 }}
                className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
                style={{ bottom: `${y * 80}%` }}
              >
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-[#1f1a17] shadow-[5px_5px_0_#1f1a17] rotate-[-4deg]"
                  style={{
                    background: item.color,
                    opacity: item.state === "gas" ? 0.75 : 1,
                    borderRadius: item.state === "gas" ? "40%" : item.state === "liquid" ? "45% 45% 12% 12%" : 6,
                  }}
                />
                <span className="mt-2 rounded-lg bg-white border-2 border-[#1f1a17] px-2 py-0.5 font-black text-sm sm:text-base text-[#1f1a17]">
                  {item.name}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {feedback && (
          <div className="absolute inset-x-0 top-[18%] flex justify-center px-4 z-10">
            <span
              className={`max-w-sm text-center rounded-xl border-[3px] border-[#1f1a17] px-3 py-1.5 font-bold text-sm sm:text-base ${feedback.ok ? "bg-[#bbf7d0]" : "bg-[#fde68a]"}`}
            >
              {feedback.text}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 grid grid-cols-3 gap-2 sm:gap-3">
          {BUTTONS.map((b) => (
            <button key={b.state} onClick={() => answer(b.state)} className={`ep-btn !py-3 sm:!py-4 text-base sm:text-xl ${b.cls}`}>
              {band === "p12" ? b.easy : b.label}
              <span className="hidden sm:inline text-xs opacity-60 ml-1">[{b.key}]</span>
            </button>
          ))}
        </div>
      </div>
    </MiniGameFrame>
  );
}
