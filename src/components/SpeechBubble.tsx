import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
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

/** The STEMbots' chat before a checkpoint, one line at a time in a single
 * bubble. Every line is laid out in the same spot so the bubble is always as
 * tall as the longest line, and the video or quiz below never moves. */
export function SpeechBubbles({
  lines,
  onAllDone,
}: {
  lines: DialogueLine[];
  onAllDone?: () => void;
}) {
  const [active, setActive] = useState(0);
  const [typed, setTyped] = useState(false);
  const [paused, setPaused] = useState(false);
  const onAllDoneRef = useRef(onAllDone);
  onAllDoneRef.current = onAllDone;

  useEffect(() => {
    setActive(0);
    setTyped(false);
    setPaused(false);
  }, [lines]);

  // Once a line is typed, give time to read it, then move to the next one.
  useEffect(() => {
    if (!typed || paused) return;
    if (active + 1 >= lines.length) {
      onAllDoneRef.current?.();
      return;
    }
    const words = lines[active]?.text.split(/\s+/).length ?? 0;
    const t = setTimeout(() => {
      setActive((a) => a + 1);
      setTyped(false);
    }, 1600 + words * 140);
    return () => clearTimeout(t);
  }, [typed, paused, active, lines]);

  const go = (i: number) => {
    setActive(i);
    setTyped(true);
    setPaused(true);
  };

  const valid = lines.filter((l) => STEMBOTS[l.bot]);
  if (valid.length === 0) return null;

  return (
    <div className="flex items-start gap-3 sm:gap-4">
      {/* Speaker faces, stacked in the same spot */}
      <div className="grid shrink-0">
        {lines.map((line, i) => {
          const bot = STEMBOTS[line.bot];
          if (!bot) return null;
          return (
            <motion.div
              key={i}
              className="[grid-area:1/1] w-14 h-14 rounded-full overflow-hidden border-[2.5px] border-ink shadow-[0_3px_0_var(--ink-line)]"
              style={{ background: BOT_TINT[line.bot] }}
              animate={{ opacity: i === active ? 1 : 0, scale: i === active ? 1 : 0.8, rotate: i === active ? 0 : -8 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              aria-hidden={i !== active}
            >
              <img src={bot.avatar} alt={bot.name} className="w-full h-full object-contain p-0.5" />
            </motion.div>
          );
        })}
      </div>

      <div className="bubble bubble-left flex-1 min-w-0 px-4 py-3">
        <div className="grid">
          {lines.map((line, i) => {
            const bot = STEMBOTS[line.bot];
            if (!bot) return null;
            const on = i === active;
            return (
              <div key={i} className={on ? "[grid-area:1/1]" : "[grid-area:1/1] invisible"} aria-hidden={!on}>
                <span
                  className="inline-block text-[11px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full border-2 border-ink mb-1.5 text-[#1b1b12]"
                  style={{ background: BOT_TINT[line.bot] }}
                >
                  {bot.name}
                </span>
                <p className="text-[0.98rem] text-[color:var(--card-foreground)] leading-relaxed font-semibold">
                  {on && !typed ? (
                    <TypewriterText key={i} text={line.text} onDone={() => setTyped(true)} />
                  ) : (
                    line.text
                  )}
                </p>
              </div>
            );
          })}
        </div>

        {lines.length > 1 && (
          <div className="flex items-center gap-1.5 mt-2.5">
            {lines.map((line, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                className="h-2.5 rounded-full border-[1.5px] border-ink transition-all"
                style={{
                  width: i === active ? 22 : 10,
                  background: i === active ? BOT_TINT[line.bot] ?? "var(--primary)" : i < active ? "var(--ink-line)" : "transparent",
                }}
                aria-label={`Line ${i + 1}`}
              />
            ))}
            <span className="ml-auto text-[11px] font-extrabold text-muted-foreground">
              {active + 1} / {lines.length}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
