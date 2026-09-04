import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { STEMBOTS } from "../data/mock";
import type { DialogueLine } from "../data/lessonContent";

const BOT_COLORS: Record<string, string> = {
  sophia: "bg-emerald-100 border-emerald-300 dark:bg-emerald-900/40 dark:border-emerald-700",
  timothy: "bg-blue-100 border-blue-300 dark:bg-blue-900/40 dark:border-blue-700",
  emily: "bg-amber-100 border-amber-300 dark:bg-amber-900/40 dark:border-amber-700",
  matthew: "bg-rose-100 border-rose-300 dark:bg-rose-900/40 dark:border-rose-700",
};

const BOT_NAME_COLORS: Record<string, string> = {
  sophia: "text-emerald-700 dark:text-emerald-400",
  timothy: "text-blue-700 dark:text-blue-400",
  emily: "text-amber-700 dark:text-amber-500",
  matthew: "text-rose-700 dark:text-rose-400",
};

const TYPING_SPEED_MS = 18; // ms per character
const LINE_DELAY_MS = 600;  // pause before next line starts

function TypewriterText({ text, onDone }: { text: string; onDone: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        if (!doneRef.current) {
          doneRef.current = true;
          setTimeout(onDone, LINE_DELAY_MS);
        }
      }
    }, TYPING_SPEED_MS);
    return () => clearInterval(interval);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span>{displayed}<span className="inline-block w-0.5 h-4 bg-current align-middle ml-0.5 animate-pulse">{displayed.length < text.length ? "▊" : ""}</span></span>;
}

export function SpeechBubbles({
  lines,
  onAllDone,
}: {
  lines: DialogueLine[];
  onAllDone?: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [typingIdx, setTypingIdx] = useState(0);
  const onAllDoneRef = useRef(onAllDone);
  onAllDoneRef.current = onAllDone;

  useEffect(() => {
    setVisibleCount(0);
    setTypingIdx(0);
    const t = setTimeout(() => setVisibleCount(1), 200);
    return () => clearTimeout(t);
  }, [lines]);

  const handleLineDone = (idx: number) => {
    if (idx + 1 < lines.length) {
      setTypingIdx(idx + 1);
      setVisibleCount(idx + 2);
    } else {
      onAllDoneRef.current?.();
    }
  };

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {lines.slice(0, visibleCount).map((line, i) => {
          const bot = STEMBOTS[line.bot];
          if (!bot) return null;
          return (
            <motion.div
              key={`${line.bot}-${i}`}
              initial={{ opacity: 0, x: -24, y: 8 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="flex items-start gap-3"
            >
              <div className="w-11 h-11 rounded-full overflow-hidden bg-white border-2 border-border shrink-0 shadow-sm">
                <img src={bot.avatar} alt={bot.name} className="w-full h-full object-contain p-0.5" />
              </div>
              <div className={`flex-1 rounded-3xl rounded-tl-sm border px-4 py-3 shadow-sm ${BOT_COLORS[line.bot]}`}>
                <p className={`text-[11px] font-black mb-1 ${BOT_NAME_COLORS[line.bot]}`}>{bot.name}</p>
                <p className="text-sm text-foreground leading-relaxed">
                  {i < typingIdx ? (
                    line.text
                  ) : i === typingIdx ? (
                    <TypewriterText text={line.text} onDone={() => handleLineDone(i)} />
                  ) : null}
                </p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
