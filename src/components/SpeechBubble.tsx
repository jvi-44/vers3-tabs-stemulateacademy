import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { STEMBOTS } from "../data/mock";
import type { DialogueLine } from "../data/lessonContent";

// Each STEMbot's own colour, used behind their face and as the name tag.
const BOT_TINT: Record<string, string> = {
  sophia: "#bfe89a",
  timothy: "#a9dcfb",
  emily: "#fbe7b0",
  matthew: "#ffb8b8",
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
              className="flex items-start gap-4"
            >
              <div
                className="w-14 h-14 rounded-full overflow-hidden border-[2.5px] border-ink shrink-0 shadow-[0_3px_0_var(--ink-line)]"
                style={{ background: BOT_TINT[line.bot] }}
              >
                <img src={bot.avatar} alt={bot.name} className="w-full h-full object-contain p-0.5" />
              </div>
              <div className="bubble bubble-left flex-1 px-4 py-3">
                <span
                  className="inline-block text-[11px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full border-2 border-ink mb-1.5 text-[#1b1b12]"
                  style={{ background: BOT_TINT[line.bot] }}
                >
                  {bot.name}
                </span>
                <p className="text-[0.98rem] text-foreground leading-relaxed font-semibold">
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
