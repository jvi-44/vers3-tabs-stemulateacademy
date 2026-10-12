import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { sfx } from "../../games/kit/audio";
import { STEMBOTS } from "../../data/mock";
import type { GameResult } from "../types";
import { HelperTip, Hud, Meter, MiniGameFrame, Pill, useFrame, type MiniGameProps } from "./kit";

// Game-show buzzer round: hit BUZZ before the rival contestant does, then pick
// the right answer. The lifeline STEMbot can knock out two wrong answers once.

interface Q {
  q: string;
  options: string[];
  answer: number;
  why: string;
}

const QUESTIONS: Q[] = [
  {
    q: "Plants make their own food using sunlight. What is this called?",
    options: ["Photosynthesis", "Evaporation", "Digestion", "Hibernation"],
    answer: 0,
    why: "Photosynthesis! Plants use sunlight, water and air to make food.",
  },
  {
    q: "A drink costs $2.50 and a sandwich costs $3.20. How much altogether?",
    options: ["$5.20", "$5.70", "$6.70", "$5.07"],
    answer: 1,
    why: "$2.50 + $3.20 = $5.70. Add the dollars, then the cents!",
  },
  {
    q: "How many cents make one dollar?",
    options: ["10 cents", "50 cents", "100 cents", "1000 cents"],
    answer: 2,
    why: "100 cents make $1.",
  },
];

const RIVAL_SECONDS = 7;
const TO_WIN = 2;

type Stage = "buzz" | "answer" | "reveal";

export function BuzzerRound({ onDone, helper }: MiniGameProps) {
  const [i, setI] = useState(0);
  const [stage, setStage] = useState<Stage>("buzz");
  const [rival, setRival] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [rivalWon, setRivalWon] = useState(false);
  const [hidden, setHidden] = useState<number[]>([]);
  const [lifelineUsed, setLifelineUsed] = useState(false);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const rivalRef = useRef(0);

  const q = QUESTIONS[i];
  const bot = STEMBOTS[helper];

  const next = (gotIt: boolean) => {
    const s = score + (gotIt ? 1 : 0);
    if (gotIt) setScore(s);
    setTimeout(() => {
      if (i + 1 >= QUESTIONS.length) {
        setResult({ won: s >= TO_WIN, score: Math.round((s / QUESTIONS.length) * 100) });
        return;
      }
      setI((n) => n + 1);
      setStage("buzz");
      rivalRef.current = 0;
      setRival(0);
      setPicked(null);
      setRivalWon(false);
      setHidden([]);
    }, 2200);
  };

  useFrame(
    (dt) => {
      const v = Math.min(1, rivalRef.current + dt / RIVAL_SECONDS);
      rivalRef.current = v;
      setRival(v);
      if (v >= 1) {
        sfx.alarm();
        setRivalWon(true);
        setStage("reveal");
        next(false);
      }
    },
    playing && stage === "buzz" && !result,
  );

  const buzz = () => {
    if (!playing || stage !== "buzz") return;
    sfx.pop();
    sfx.tick();
    setStage("answer");
  };

  const choose = (k: number) => {
    if (stage !== "answer") return;
    setPicked(k);
    setStage("reveal");
    const ok = k === q.answer;
    if (ok) sfx.correct();
    else sfx.wrong();
    next(ok);
  };

  const lifeline = () => {
    if (lifelineUsed || stage !== "answer") return;
    sfx.whoosh();
    setLifelineUsed(true);
    const wrong = q.options.map((_, k) => k).filter((k) => k !== q.answer);
    setHidden(wrong.sort(() => Math.random() - 0.5).slice(0, 2));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        buzz();
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 4 && !hidden.includes(n - 1)) choose(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tip =
    stage === "answer" && !lifelineUsed
      ? `Stuck? Use me as your lifeline!`
      : stage === "reveal" && (rivalWon || picked !== q.answer)
        ? q.why
        : null;

  return (
    <MiniGameFrame
      title="Buzzer Round"
      result={result}
      onDone={onDone}
      onPlaying={setPlaying}
      howTo={
        <>
          <p>Three questions. Your rival is fast!</p>
          <p>
            Hit <b>BUZZ</b> before the rival bar fills up, then pick the right answer. {bot.name} is your lifeline: use them once to remove
            two wrong answers. Get {TO_WIN} right to win!
          </p>
        </>
      }
    >
      <div className="absolute inset-0 flex flex-col">
        <Hud>
          <Pill>
            Question {Math.min(i + 1, QUESTIONS.length)} / {QUESTIONS.length}
          </Pill>
          <div className="flex-1 min-w-0">
            <Meter value={rival} max={1} color="linear-gradient(90deg,#f43f5e,#a855f7)" label="Rival" />
          </div>
          <Pill className="bg-[#bbf7d0]">✓ {score}</Pill>
        </Hud>

        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 sm:gap-4 px-3 pt-12 pb-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="w-full max-w-xl rounded-2xl border-[3px] border-[#1f1a17] bg-[#1e1b4b] px-4 py-3 sm:py-4 text-center shadow-[4px_4px_0_#1f1a17]"
            >
              <p className="font-display text-lg sm:text-2xl font-bold leading-snug text-white">{q.q}</p>
            </motion.div>
          </AnimatePresence>

          {stage === "buzz" ? (
            <motion.button
              onClick={buzz}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 0.9 }}
              className="mt-2 grid place-items-center w-36 h-36 sm:w-44 sm:h-44 rounded-full border-[5px] border-[#1f1a17] bg-[radial-gradient(circle_at_35%_30%,#fca5a5,#dc2626_60%,#991b1b)] shadow-[0_8px_0_#1f1a17] active:translate-y-1 active:shadow-[0_4px_0_#1f1a17]"
            >
              <span className="font-display text-3xl sm:text-4xl font-bold text-white drop-shadow-[2px_2px_0_#1f1a17]">BUZZ!</span>
            </motion.button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full max-w-xl">
              {q.options.map((opt, k) => {
                const gone = hidden.includes(k);
                const reveal = stage === "reveal";
                const isRight = k === q.answer;
                const bg = reveal ? (isRight ? "bg-[#86efac]" : k === picked ? "bg-[#fca5a5]" : "bg-white/70") : "bg-white";
                return (
                  <motion.button
                    key={k}
                    initial={{ opacity: 0, x: k % 2 ? 20 : -20 }}
                    animate={{ opacity: gone ? 0.25 : 1, x: 0 }}
                    transition={{ delay: k * 0.06 }}
                    disabled={gone || reveal}
                    onClick={() => choose(k)}
                    className={`ep-btn !justify-start text-left !py-2.5 ${bg}`}
                  >
                    <span className="mr-2 grid place-items-center w-7 h-7 shrink-0 rounded-full border-2 border-[#1f1a17] bg-[#fde047] text-sm font-black">
                      {"ABCD"[k]}
                    </span>
                    <span className={gone ? "line-through" : ""}>{opt}</span>
                  </motion.button>
                );
              })}
            </div>
          )}

          {rivalWon && (
            <span className="rounded-xl border-[3px] border-[#1f1a17] bg-[#fde68a] px-3 py-1 font-bold text-[#1f1a17]">
              The rival buzzed first!
            </span>
          )}

          {stage === "answer" && !lifelineUsed && (
            <button onClick={lifeline} className="ep-btn !py-1.5 text-sm bg-[#c4b5fd]">
              Lifeline: ask {bot.name} (50:50)
            </button>
          )}
        </div>

        <HelperTip bot={helper} text={tip} className="right-2 bottom-2 flex-row-reverse" />
      </div>
    </MiniGameFrame>
  );
}
