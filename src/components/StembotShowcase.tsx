import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Heart, Sparkles } from "lucide-react";
import { STEMBOTS } from "../data/mock";
import { cn } from "./ui/utils";

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
    <div className="bg-card rounded-3xl border border-border shadow-sm p-5">
      <h3 className="font-black text-foreground mb-4 flex items-center gap-1.5">
        Meet the STEMbots! <Sparkles size={16} className="text-amber-500" />
      </h3>
      <div className="grid grid-cols-4 gap-3">
        {bots.map(([key, bot]) => (
          <button
            key={key}
            onClick={() => setOpen(key)}
            className="flex flex-col items-center gap-2 group"
          >
            <div
              className={cn(
                "w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-white border-2 shadow-sm transition-transform group-hover:scale-105 group-active:scale-95",
                DISCIPLINE_STYLE[bot.discipline].split(" ")[2],
              )}
            >
              <img src={bot.avatar} alt={bot.name} className="w-full h-full object-contain p-1" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-foreground">{bot.name}</span>
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
                    className="bg-card rounded-3xl shadow-2xl max-w-sm w-full p-6 relative border border-border"
                  >
                    <button
                      onClick={() => setOpen(null)}
                      className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                    >
                      <X size={20} />
                    </button>
                    <div className="flex flex-col items-center text-center gap-2 mb-4">
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-white border-2 border-border">
                        <img src={bot.avatar} alt={bot.name} className="w-full h-full object-contain p-1" />
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
    </div>
  );
}
