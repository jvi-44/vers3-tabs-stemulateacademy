import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Heart } from "lucide-react";
import { STEMBOTS } from "../data/mock";
import { cn } from "./ui/utils";

// Pale backdrop behind each bot, in the bot's own colour.
const BOT_TINT: Record<string, string> = {
  Science: "bg-[#dcf5c8] dark:bg-green-500/15",
  Technology: "bg-[#d3ecfc] dark:bg-sky-500/15",
  Engineering: "bg-[#fdf0c9] dark:bg-amber-500/15",
  Mathematics: "bg-[#ffdcdc] dark:bg-red-500/15",
};

const DISCIPLINE_STYLE: Record<string, string> = {
  Science: "bg-green-100 text-green-700 border-green-300",
  Technology: "bg-blue-100 text-blue-700 border-blue-300",
  Engineering: "bg-amber-100 text-amber-800 border-amber-300",
  Mathematics: "bg-red-100 text-red-700 border-red-300",
};

export function StembotShowcase() {
  const [open, setOpen] = useState<string | null>(null);
  const bots = Object.entries(STEMBOTS);

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-display text-foreground !text-xl">Meet the STEMbots</h2>
        <span className="kicker">Tap to say hi</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {bots.map(([key, bot], i) => (
          <button
            key={key}
            onClick={() => setOpen(key)}
            className={cn(
              "group relative sticker !rounded-[1.5rem] pt-3 pb-3 px-3 flex flex-col items-center overflow-hidden transition-transform hover:-translate-y-1",
              i % 2 ? "rotate-[0.8deg]" : "rotate-[-0.8deg]",
            )}
          >
            <div className={cn("absolute inset-x-0 top-0 h-[58%]", BOT_TINT[bot.discipline])} />
            <img
              src={bot.avatar}
              alt=""
              className="relative h-20 sm:h-24 object-contain die-cut transition-transform group-hover:scale-110 group-hover:-rotate-6"
            />
            <span className="relative font-display font-bold text-foreground mt-1.5">{bot.name}</span>
            <span className="relative text-[11px] font-extrabold text-muted-foreground">{bot.role}</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setOpen(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={() => setOpen(null)}
            >
              {(() => {
                const bot = STEMBOTS[open];
                return (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="sticker max-w-sm w-full p-6 relative !border-ink !border-[2.5px] !shadow-[0_6px_0_var(--ink-line)]"
                  >
                    <button
                      onClick={() => setOpen(null)}
                      className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                    >
                      <X size={20} />
                    </button>
                    <div className="flex flex-col items-center text-center gap-2 mb-4">
                      <div className={cn("w-28 h-28 rounded-full flex items-center justify-center -mt-16 border-[2.5px] border-ink", BOT_TINT[bot.discipline])}>
                        <img src={bot.avatar} alt={bot.name} className="h-28 object-contain die-cut bob" />
                      </div>
                      <h3 className="text-xl font-black text-foreground">{bot.name}</h3>
                      <span
                        className={cn(
                          "text-xs font-bold px-3 py-1 rounded-full border",
                          DISCIPLINE_STYLE[bot.discipline],
                        )}
                      >
                        {bot.role} · {bot.discipline}
                      </span>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-bold text-foreground mb-1">Hobbies</p>
                        <ul className="text-muted-foreground space-y-0.5">
                          {bot.hobbies.map((h) => (
                            <li key={h}>• {h}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-bold text-foreground mb-1">Loves learning about</p>
                        <div className="flex flex-wrap gap-1.5">
                          {bot.interests.map((i) => (
                            <span
                              key={i}
                              className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                            >
                              {i}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-500/10 rounded-2xl p-3 flex items-start gap-2">
                        <Heart size={16} className="text-amber-500 shrink-0 mt-0.5" fill="currentColor" />
                        <p className="text-amber-700 dark:text-amber-300 font-semibold text-xs">
                          Fun fact: {bot.funFact}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
