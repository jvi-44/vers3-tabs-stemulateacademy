import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Volume2, Square, Sparkles, Leaf, Bug, FlaskConical, Wrench, Camera, Cpu, Home as HouseIcon, Bike, Cog, Puzzle, Flower2, Dices } from "lucide-react";
import { STEMBOTS } from "../data/mock";
import { cn } from "./ui/utils";

/** Each STEMbot's own look and voice: colours, catchphrase, a short intro
 * they read aloud (recorded in public/stembot-voices/), and an icon for each
 * hobby so the cards read at a glance. */
const PROFILE: Record<
  string,
  {
    tint: string;
    deep: string;
    catchphrase: string;
    intro: string;
    hobbyIcons: (typeof Leaf)[];
    stamp: string;
  }
> = {
  sophia: {
    tint: "#dcf5c8",
    deep: "#5fa32e",
    catchphrase: "But why does it do that?",
    intro:
      "Hi, I'm Sophia, the Science STEMbot! I grow tiny terrariums, spot bugs on nature walks, and ask “why?” about absolutely everything. I can name every layer of the Earth in under five seconds. Come on, let's go explore!",
    hobbyIcons: [Leaf, Bug, FlaskConical],
    stamp: "S",
  },
  timothy: {
    tint: "#d3ecfc",
    deep: "#1f7fc4",
    catchphrase: "If it beeps, I'm in!",
    intro:
      "Hey hey, Timothy here, your Technology STEMbot! I tinker with old gadgets, snap photos of everything, and my very first circuit ran on a potato. If it beeps, blinks or connects, I want to know how it works!",
    hobbyIcons: [Cpu, Camera, Wrench],
    stamp: "T",
  },
  emily: {
    tint: "#fdf0c9",
    deep: "#a86d00",
    catchphrase: "Got a problem? Let's build a fix!",
    intro:
      "Hello! I'm Emily, the Engineering STEMbot. I design treehouses, build marble runs, and fix squeaky hinges. I even redesigned my own bicycle gears to climb the steepest hill in town. Got a problem? Let's build a fix!",
    hobbyIcons: [Wrench, HouseIcon, Bike],
    stamp: "E",
  },
  matthew: {
    tint: "#ffdcdc",
    deep: "#d33b3b",
    catchphrase: "Numbers are hiding everywhere!",
    intro:
      "Hi, I'm Matthew, the Maths STEMbot! I speed-solve puzzles, count rose petals, and love board games with tricky odds. I can do square roots faster than a calculator... well, I think so! Numbers are hiding everywhere. Let's find them together.",
    hobbyIcons: [Puzzle, Flower2, Dices],
    stamp: "M",
  },
};

/** Plays a bot's recorded intro. Falls back to the browser's voice only if
 * the recording can't be loaded. */
function useBotVoice() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);

  const stop = () => {
    audio.current?.pause();
    audio.current = null;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* no speech support */
    }
    setSpeaking(null);
  };

  const play = (key: string) => {
    stop();
    const a = new Audio(`/stembot-voices/${key}.mp3`);
    audio.current = a;
    setSpeaking(key);
    a.onended = () => setSpeaking((k) => (k === key ? null : k));
    a.play().catch(() => {
      // No recording yet: read it with the browser's voice instead.
      try {
        const u = new SpeechSynthesisUtterance(PROFILE[key].intro);
        u.rate = 1.02;
        u.pitch = key === "sophia" || key === "emily" ? 1.35 : 1.15;
        u.onend = () => setSpeaking((k) => (k === key ? null : k));
        window.speechSynthesis.speak(u);
      } catch {
        setSpeaking(null);
      }
    });
  };

  useEffect(() => stop, []);
  return { speaking, play, stop };
}

function VoiceButton({ botKey, name, voice, className }: { botKey: string; name: string; voice: ReturnType<typeof useBotVoice>; className?: string }) {
  const on = voice.speaking === botKey;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        on ? voice.stop() : voice.play(botKey);
      }}
      className={cn("btn-pop btn-pop-sm", on && "btn-primary", className)}
      aria-label={on ? `Stop ${name}` : `Hear ${name}`}
    >
      {on ? (
        <>
          <Square size={13} className="fill-current" /> Stop
          <span className="voice-bars" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </>
      ) : (
        <>
          <Volume2 size={15} /> Hear me
        </>
      )}
    </button>
  );
}

export function StembotShowcase() {
  const [open, setOpen] = useState<string | null>(null);
  const voice = useBotVoice();
  const bots = Object.entries(STEMBOTS);

  const close = () => {
    voice.stop();
    setOpen(null);
  };

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-display text-foreground !text-xl">Meet the STEMbots</h2>
        <span className="kicker">Tap one to say hi</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {bots.map(([key, bot], i) => {
          const p = PROFILE[key];
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => setOpen(key)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(key)}
              className="bot-card group"
              style={{ ["--bot" as string]: p.deep, ["--bot-tint" as string]: p.tint }}
            >
              <div className="bot-card-top">
                <span className="bot-card-stamp">{p.stamp}</span>
                <span className="bot-card-role">{bot.discipline}</span>
                <img
                  src={bot.avatar}
                  alt=""
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 bottom-[-14%] h-[118%] die-cut transition-transform duration-300 group-hover:-translate-y-1.5",
                    i % 2 ? "group-hover:rotate-3" : "group-hover:-rotate-3",
                  )}
                />
              </div>
              <div className="px-4 pt-3 pb-4 flex flex-col items-start gap-2 flex-1">
                <div>
                  <p className="font-display font-bold text-xl leading-none text-[color:var(--card-foreground)]">{bot.name}</p>
                  <p className="text-xs font-extrabold text-muted-foreground mt-1">{bot.role}</p>
                </div>
                <p className="bot-quote">“{p.catchphrase}”</p>
                <VoiceButton botKey={key} name={bot.name} voice={voice} className="mt-auto" />
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[color:var(--ink)]/50"
            onClick={close}
          >
            {(() => {
              const bot = STEMBOTS[open];
              const p = PROFILE[open];
              return (
                <motion.div
                  initial={{ scale: 0.9, y: 24, rotate: -2 }}
                  animate={{ scale: 1, y: 0, rotate: 0 }}
                  exit={{ scale: 0.92, y: 16, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bot-profile"
                  style={{ ["--bot" as string]: p.deep, ["--bot-tint" as string]: p.tint }}
                  role="dialog"
                  aria-label={`${bot.name} the STEMbot`}
                >
                  <button onClick={close} className="bot-profile-close" aria-label="Close">
                    <X size={18} strokeWidth={2.6} />
                  </button>

                  {/* Portrait side */}
                  <div className="bot-profile-art">
                    <span className="bot-card-stamp !w-12 !h-12 !text-2xl">{p.stamp}</span>
                    <img src={bot.avatar} alt={bot.name} className="relative h-[92%] max-h-80 die-cut bob" />
                    <span className="bot-profile-plate">
                      {bot.name} · {bot.discipline}
                    </span>
                  </div>

                  {/* About side */}
                  <div className="p-5 sm:p-7 flex flex-col gap-4 min-w-0">
                    <div>
                      <p className="kicker" style={{ background: p.tint, color: "#1b1b12" }}>
                        {bot.role}
                      </p>
                      <h3 className="font-display font-bold text-3xl mt-2 leading-none text-[color:var(--card-foreground)]">
                        Hi, I'm {bot.name}!
                      </h3>
                    </div>

                    <div className="bubble px-4 py-3">
                      <p className="text-[0.95rem] font-semibold leading-relaxed text-[color:var(--card-foreground)]">{p.intro}</p>
                      <VoiceButton botKey={open} name={bot.name} voice={voice} className="mt-3" />
                    </div>

                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground mb-2">My hobbies</p>
                      <ul className="grid gap-2">
                        {bot.hobbies.map((h, i) => {
                          const Icon = p.hobbyIcons[i] ?? Cog;
                          return (
                            <li key={h} className="flex items-center gap-2.5 text-sm font-bold text-[color:var(--card-foreground)]">
                              <span className="w-8 h-8 rounded-xl border-2 border-ink flex items-center justify-center shrink-0" style={{ background: p.tint, color: "#1b1b12" }}>
                                <Icon size={15} strokeWidth={2.4} />
                              </span>
                              {h}
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {bot.interests.map((t) => (
                        <span key={t} className="chip-ink !text-xs !py-1 !px-2.5">
                          {t}
                        </span>
                      ))}
                    </div>

                    <p className="flex items-start gap-2 text-sm font-bold rounded-2xl border-2 border-dashed border-ink/40 px-3 py-2.5 text-[color:var(--card-foreground)]">
                      <Sparkles size={16} className="shrink-0 mt-0.5" style={{ color: p.deep }} />
                      {bot.funFact}
                    </p>
                  </div>
                </motion.div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
