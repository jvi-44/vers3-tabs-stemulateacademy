import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { sfx } from "../../games/kit/audio";
import type { GameResult } from "../types";
import { HelperTip, Hud, MiniGameFrame, Pill, shuffle, useFrame, type MiniGameProps } from "./kit";

// BODMAS: each asteroid is locked with a code. Solve it and blast the asteroid
// showing the right answer. The others show common order-of-operations slips.

interface Puzzle {
  expr: string;
  answer: number;
  wrong: number[];
  tip: string;
}

const r = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

const MAKERS: Array<() => Puzzle> = [
  () => {
    const [a, b, c] = [r(2, 9), r(2, 5), r(2, 5)];
    return { expr: `${a} + ${b} × ${c}`, answer: a + b * c, wrong: [(a + b) * c, a * b + c], tip: "Multiply before you add!" };
  },
  () => {
    const [a, b, c] = [r(2, 6), r(2, 6), r(2, 4)];
    return { expr: `(${a} + ${b}) × ${c}`, answer: (a + b) * c, wrong: [a + b * c, a * c + b], tip: "Brackets first, always!" };
  },
  () => {
    const [c, q] = [r(2, 5), r(2, 6)];
    const b = c * q;
    const a = b + r(2, 10);
    return { expr: `${a} − ${b} ÷ ${c}`, answer: a - q, wrong: [Math.round((a - b) / c), a - b + c], tip: "Divide before you subtract." };
  },
  () => {
    const [a, b] = [r(2, 5), r(1, 9)];
    return { expr: `${a}² + ${b}`, answer: a * a + b, wrong: [2 * a + b, a * a * b], tip: `${a}² means ${a} × ${a}, not ${a} × 2.` };
  },
  () => {
    const [a, b, c, d] = [r(6, 12), r(1, 5), r(2, 4), r(1, 6)];
    return {
      expr: `(${a} − ${b}) × ${c} + ${d}`,
      answer: (a - b) * c + d,
      wrong: [(a - b) * (c + d), a - b * c + d],
      tip: "Brackets, then ×, then +.",
    };
  },
  () => {
    const [a, b, c, d] = [r(2, 6), r(2, 6), r(2, 5), r(2, 5)];
    return {
      expr: `${a} × ${b} + ${c} × ${d}`,
      answer: a * b + c * d,
      wrong: [(a * b + c) * d, a * (b + c) * d],
      tip: "Do both multiplications, then add.",
    };
  },
];

function makePuzzle(k: number): Puzzle {
  const p = MAKERS[k % MAKERS.length]();
  // Make sure the distractors are different from the answer and each other.
  const wrong = [...new Set(p.wrong.filter((w) => w !== p.answer))];
  while (wrong.length < 2) {
    const w = p.answer + (Math.random() < 0.5 ? -1 : 1) * r(1, 4);
    if (w !== p.answer && !wrong.includes(w)) wrong.push(w);
  }
  return { ...p, wrong };
}

const ROUNDS = 6;
const TO_WIN = 4;
const LANES = [0.22, 0.5, 0.78];

export function AsteroidMiner({ onDone, helper }: MiniGameProps) {
  const puzzles = useMemo(() => shuffle(Array.from({ length: ROUNDS }, (_, k) => makePuzzle(k))), []);
  const [i, setI] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [missed, setMissed] = useState<number[]>([]);
  const [blasted, setBlasted] = useState<number | null>(null);
  const [t, setT] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const tRef = useRef(0);

  const p = puzzles[i];
  const rocks = useMemo(() => (p ? shuffle([p.answer, ...p.wrong.slice(0, 2)]) : []), [p]);

  useFrame((dt) => {
    tRef.current += dt;
    setT(tRef.current);
  }, playing && !result);

  const shoot = (value: number) => {
    if (!playing || blasted !== null || result || missed.includes(value)) return;
    sfx.launch();
    if (value === p.answer) {
      setTimeout(() => sfx.explode(), 120);
      setBlasted(value);
      const ft = firstTry + (missed.length === 0 ? 1 : 0);
      setFirstTry(ft);
      setTimeout(() => {
        setBlasted(null);
        setMissed([]);
        if (i + 1 >= ROUNDS) setResult({ won: ft >= TO_WIN, score: Math.round((ft / ROUNDS) * 100) });
        else setI((n) => n + 1);
      }, 900);
    } else {
      sfx.wrong();
      setMissed((m) => [...m, value]);
    }
  };

  return (
    <MiniGameFrame
      title="Asteroid Miner"
      result={result}
      onDone={onDone}
      onPlaying={setPlaying}
      howTo={
        <>
          <p>Each asteroid holds fuel, but it's locked with a BODMAS code.</p>
          <p>
            Solve the code, then tap the asteroid with the right answer. <b>B</b>rackets, <b>O</b>rders, <b>D</b>ivide, <b>M</b>ultiply,{" "}
            <b>A</b>dd, <b>S</b>ubtract! Crack {TO_WIN} of {ROUNDS} first time to fill the tanks.
          </p>
        </>
      }
    >
      <div className="absolute inset-0 overflow-hidden select-none">
        <Hud>
          <Pill>
            Code {Math.min(i + 1, ROUNDS)} / {ROUNDS}
          </Pill>
          <span className="flex-1" />
          <Pill className="bg-[#fde68a]">Fuel {firstTry}</Pill>
        </Hud>

        {p && (
          <div className="absolute inset-x-0 top-12 sm:top-14 flex justify-center px-3 z-10">
            <motion.div
              key={i}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-2xl border-[3px] border-[#1f1a17] bg-[#0f172a] px-5 py-2 text-center shadow-[4px_4px_0_#1f1a17]"
            >
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#7dd3fc]">Unlock code</span>
              <span className="font-mono text-2xl sm:text-4xl font-bold text-white tracking-wide">{p.expr} = ?</span>
            </motion.div>
          </div>
        )}

        {rocks.map((v, k) => {
          const bob = Math.sin(t * 1.4 + k * 2.1) * 4;
          const drift = Math.sin(t * 0.6 + k * 1.7) * 5;
          const isMiss = missed.includes(v);
          const isHit = blasted === v;
          return (
            <motion.button
              key={`${i}-${v}`}
              initial={{ scale: 0, rotate: -40 }}
              animate={isHit ? { scale: 1.6, opacity: 0, rotate: 30 } : { scale: 1, rotate: 0, opacity: isMiss ? 0.35 : 1 }}
              transition={{ duration: isHit ? 0.5 : 0.35, delay: isHit ? 0 : k * 0.08 }}
              onClick={() => shoot(v)}
              className="absolute -translate-x-1/2 -translate-y-1/2 grid place-items-center w-24 h-24 sm:w-32 sm:h-32"
              style={{ left: `${LANES[k] * 100 + drift}%`, top: `${58 + bob}%` }}
            >
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-[4px_4px_0_#1f1a17]" aria-hidden>
                <path
                  d="M50 6 L78 14 L94 40 L88 72 L64 92 L32 90 L10 70 L8 36 L26 14 Z"
                  fill={isMiss ? "#64748b" : "#a8a29e"}
                  stroke="#1f1a17"
                  strokeWidth="5"
                  strokeLinejoin="round"
                />
                <circle cx="34" cy="34" r="8" fill="#78716c" stroke="#1f1a17" strokeWidth="3" />
                <circle cx="70" cy="64" r="6" fill="#78716c" stroke="#1f1a17" strokeWidth="3" />
                <path d="M60 22 l6 10 l-8 4 z" fill="#fbbf24" stroke="#1f1a17" strokeWidth="2.5" />
              </svg>
              <span className="relative font-display text-2xl sm:text-3xl font-bold text-white drop-shadow-[2px_2px_0_#1f1a17]">{v}</span>
            </motion.button>
          );
        })}

        <HelperTip bot={helper} text={missed.length > 0 && p ? p.tip : null} className="left-2 bottom-2" />
      </div>
    </MiniGameFrame>
  );
}
