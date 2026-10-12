import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type TargetAndTransition } from "motion/react";
import confetti from "canvas-confetti";
import { Check, ChevronRight, Play, X } from "lucide-react";
import { STEMBOTS } from "../data/mock";
import { isMuted, onMuteChange, primeAudio, sfx, startMusic, stopMusic } from "../games/kit/audio";
import { MuteButton } from "../games/kit/GameShell";
import { castFor, linesFor, matches, recapFor, resolveNext } from "./engine";
import { DEFAULT_HELPER, MINI_GAMES } from "./minigames";
import { SceneArt } from "./SceneArt";
import { useStoryVoice } from "./useStoryVoice";
import type {
  BotId,
  Camera,
  CastMember,
  ChoiceOption,
  Episode,
  Flags,
  Fx,
  GameResult,
  Hands,
  Line,
  Speaker,
  Spot,
  StoryNode,
} from "./types";
import "./episodes.css";

// Plays one intro episode full screen, from the player's own point of view:
// the STEMbots talk to you, you pick what to say and do, and mini-games drop
// you right into the action. Choices are flags that later lines react to.

type Then = { go: string } | { choose: true } | { game: true } | { recap: true };
type View =
  | { kind: "title" }
  | { kind: "lines"; lines: Line[]; idx: number; then: Then }
  | { kind: "choose" }
  | { kind: "game" }
  | { kind: "recap" };

const BOT_IDS = new Set<string>(["sophia", "timothy", "emily", "matthew"]);
const isBot = (v: unknown): v is BotId => typeof v === "string" && BOT_IDS.has(v);

const SPOT_X: Record<Spot, number> = { farleft: 13, left: 31, center: 50, right: 69, farright: 87 };

const SPEAKER_STYLE: Partial<Record<Speaker, { name: string; color: string }>> = {
  sophia: { name: "Sophia", color: "#86efac" },
  timothy: { name: "Timothy", color: "#93c5fd" },
  emily: { name: "Emily", color: "#fde68a" },
  matthew: { name: "Matthew", color: "#fca5a5" },
  all: { name: "Everyone", color: "#f9a8d4" },
  host: { name: "The Host", color: "#c4b5fd" },
  system: { name: "Ship Computer", color: "#a5f3fc" },
  mission: { name: "Mission Control", color: "#bae6fd" },
  impostor: { name: "???", color: "#475569" },
  you: { name: "You", color: "#facc15" },
};

const CAMERA: Record<Camera, TargetAndTransition> = {
  still: { scale: [1.04, 1.06, 1.04], transition: { duration: 9, repeat: Infinity, ease: "easeInOut" } },
  pushIn: { scale: [1.02, 1.16], transition: { duration: 7, ease: "easeOut" } },
  pullOut: { scale: [1.22, 1.04], transition: { duration: 3.2, ease: "easeOut" } },
  panLeft: { scale: 1.14, x: ["5%", "-5%"], transition: { duration: 8, ease: "easeInOut" } },
  panRight: { scale: 1.14, x: ["-5%", "5%"], transition: { duration: 6, ease: "easeInOut" } },
  shake: {
    scale: 1.08,
    x: [0, -14, 12, -10, 8, -4, 0],
    y: [0, 6, -8, 5, -3, 0, 0],
    transition: { duration: 0.8, repeat: 2, repeatDelay: 1.2 },
  },
  tiltUp: { scale: 1.1, y: ["6%", "-2%"], transition: { duration: 4, ease: "easeOut" } },
  wake: { scale: [1.2, 1.05], filter: ["blur(10px)", "blur(0px)"], transition: { duration: 3, ease: "easeOut" } },
};

export interface EpisodePlayerProps {
  episode: Episode;
  /** Flags carried over from earlier episodes (e.g. your buddy). */
  carried?: Flags;
  /** Shown on your own lines. */
  playerName?: string;
  /** The story is over: here are the choices made. */
  onFinish: (flags: Flags) => void;
  /** Closed early (skipped). */
  onClose: () => void;
}

export function EpisodePlayer({ episode, carried, playerName, onFinish, onClose }: EpisodePlayerProps) {
  const [nodeId, setNodeId] = useState(episode.start);
  const [flags, setFlags] = useState<Flags>(() => ({ ...carried }));
  const [view, setView] = useState<View>({ kind: "title" });
  const [shown, setShown] = useState(0); // typewriter characters revealed
  const [toast, setToast] = useState<string | null>(null);
  const [muted, setMutedState] = useState(isMuted());
  const voice = useStoryVoice(!muted);
  const prevCast = useRef<Set<BotId>>(new Set());

  const node: StoryNode = episode.nodes[nodeId];
  const cast = castFor(node, flags);

  useEffect(() => {
    const off = onMuteChange(setMutedState);
    return () => {
      off();
      stopMusic();
    };
  }, []);

  // Remember who was on stage so only newcomers make an entrance.
  useEffect(() => {
    const id = setTimeout(() => (prevCast.current = new Set(cast.map((c) => c.bot))), 50);
    return () => clearTimeout(id);
  }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const enter = (id: string, f: Flags) => {
    const n = episode.nodes[id];
    setNodeId(id);
    if (n.fx?.includes("confetti")) fireConfetti();
    if (n.camera === "shake") sfx.explode();
    const show = (lines: Line[], then: Then) => (lines.length ? setView({ kind: "lines", lines, idx: 0, then }) : follow(then, f));
    switch (n.type) {
      case "talk":
        return show(linesFor(n.lines, f), { go: resolveNext(n.next, f) });
      case "choice":
        return show(n.prompt ? linesFor([n.prompt], f) : [], { choose: true });
      case "game":
        return show(linesFor(n.intro, f), { game: true });
      case "end":
        return show(linesFor(n.lines, f), { recap: true });
    }
  };

  const follow = (then: Then, f: Flags) => {
    if ("go" in then) return enter(then.go, f);
    if ("choose" in then) return setView({ kind: "choose" });
    if ("game" in then) return setView({ kind: "game" });
    sfx.fanfare();
    fireConfetti();
    setView({ kind: "recap" });
  };

  const start = () => {
    primeAudio();
    sfx.click();
    startMusic(episode.music);
    enter(episode.start, flags);
  };

  // Typewriter + voice for the current line.
  const line = view.kind === "lines" ? view.lines[view.idx] : null;
  useEffect(() => {
    if (!line) return;
    setShown(0);
    voice.say(line);
    const id = setInterval(() => setShown((n) => (n >= line.text.length ? n : n + 2)), 28);
    return () => clearInterval(id);
  }, [line]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = () => {
    if (view.kind !== "lines" || !line) return;
    if (shown < line.text.length) return setShown(line.text.length);
    sfx.tick();
    voice.stop();
    if (view.idx + 1 < view.lines.length) setView({ ...view, idx: view.idx + 1 });
    else follow(view.then, flags);
  };

  const pick = (opt: ChoiceOption) => {
    sfx.pop();
    const f = { ...flags, ...opt.set };
    setFlags(f);
    const remembered = Object.values(opt.set ?? {}).find(isBot);
    setToast(remembered ? `${STEMBOTS[remembered].name} will remember that.` : "The story will remember that.");
    setTimeout(() => setToast(null), 2200);
    const then: Then = { go: resolveNext(opt.next, f) };
    if (opt.say) setView({ kind: "lines", lines: [{ speaker: "you", text: opt.say }], idx: 0, then });
    else follow(then, f);
  };

  const gameDone = (r: GameResult) => {
    if (node.type !== "game") return;
    const f = { ...flags, ...(r.won ? node.setOnWin : {}), [`${node.game}Score`]: r.score };
    setFlags(f);
    const lines = linesFor(r.won ? node.win : node.lose, f);
    const then: Then = { go: resolveNext(node.next, f) };
    if (lines.length) setView({ kind: "lines", lines, idx: 0, then });
    else follow(then, f);
  };

  // Keyboard: Enter/Space to continue, number keys to choose.
  const options = node.type === "choice" ? node.options.filter((o) => matches(o.when, flags)) : [];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view.kind === "lines" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        advance();
      } else if (view.kind === "choose") {
        const n = Number(e.key);
        if (n >= 1 && n <= options.length) pick(options[n - 1]);
      } else if (view.kind === "title" && e.key === "Enter") start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const speaker = line?.speaker;
  const helper: BotId = useMemo(() => {
    for (const k of ["buddy", "lifeline", "lead"]) if (isBot(flags[k])) return flags[k] as BotId;
    return node.type === "game" ? DEFAULT_HELPER[node.game] : "sophia";
  }, [flags, node]);
  const Game = node.type === "game" ? MINI_GAMES[node.game] : null;
  const recap = view.kind === "recap" ? recapFor(episode, flags) : [];

  return (
    <div
      className="ep-root fixed inset-0 z-[200] overflow-hidden bg-[#0b0a14] text-[#1f1a17]"
      role="dialog"
      aria-label={`Episode ${episode.number}: ${episode.title}`}
    >
      {/* The world, seen through your eyes */}
      <motion.div key={nodeId} className="absolute inset-0 origin-center" initial={false} animate={CAMERA[node.camera ?? "still"]}>
        <div className="ep-sway absolute inset-0">
          <SceneArt scene={node.scene} screen={node.screen} />
          <Cast cast={cast} speaker={speaker} entered={prevCast.current} />
        </div>
      </motion.div>

      <FxLayer fx={node.fx ?? []} />
      {node.camera === "wake" && <Eyelids key={nodeId} />}
      {view.kind === "lines" && <PovHands hands={node.hands ?? "none"} />}

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-[60] flex items-center gap-2 p-2 sm:p-3 bg-gradient-to-b from-black/60 to-transparent">
        <span className="ep-chip">Episode {episode.number}</span>
        <span className="truncate font-display font-semibold text-white text-sm sm:text-base drop-shadow">{episode.title}</span>
        <span className="flex-1" />
        <MuteButton className="!w-9 !h-9 !bg-black/40 hover:!bg-black/60 border-2 border-white/70" />
        <button
          onClick={() => {
            voice.stop();
            onClose();
          }}
          className="h-9 rounded-xl border-2 border-white/70 bg-black/40 hover:bg-black/60 px-2.5 text-white text-sm font-bold flex items-center gap-1"
        >
          <X size={16} /> <span className="hidden sm:inline">{view.kind === "title" ? "Not now" : "Exit"}</span>
        </button>
      </div>

      {/* Mini-game */}
      {view.kind === "game" && Game && (
        <div className="absolute inset-0 z-50 bg-black/30 pt-12 sm:pt-14">
          <div className="relative w-full h-full">
            <Game key={nodeId} helper={helper} onDone={gameDone} />
          </div>
        </div>
      )}

      {/* Dialogue */}
      <AnimatePresence>
        {view.kind === "lines" && line && (
          <motion.button
            key="dialog"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            onClick={advance}
            className="absolute inset-x-0 bottom-0 z-[55] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-left"
          >
            <Dialogue line={line} shown={shown} playerName={playerName} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Choices */}
      <AnimatePresence>
        {view.kind === "choose" && (
          <motion.div
            key={`choose-${nodeId}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-0 z-[55] flex flex-col items-center gap-2 sm:gap-2.5 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16 bg-gradient-to-t from-black/70 via-black/40 to-transparent"
          >
            <span className="ep-kicker !text-white/85 mb-0.5">Your choice</span>
            {options.map((o, k) => (
              <motion.button
                key={o.text}
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.08 * k }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => pick(o)}
                className="ep-choice w-full max-w-xl"
              >
                <span className="flex-1">{o.text}</span>
                {o.tag && <span className="ep-tag">{o.tag}</span>}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 -translate-x-1/2 top-14 z-[70] ep-toast"
          >
            <Check size={16} strokeWidth={3} /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title card */}
      <AnimatePresence>
        {view.kind === "title" && (
          <motion.div key="title" exit={{ opacity: 0 }} className="absolute inset-0 z-[65] grid place-items-center bg-black/55 p-4">
            <motion.div
              initial={{ scale: 0.85, rotate: -2, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              className="ep-card max-w-md w-full text-center"
            >
              <p className="ep-kicker">Episode {episode.number}</p>
              <h2 className="font-display font-bold text-3xl sm:text-4xl leading-tight mb-2">{episode.title}</h2>
              <p className="font-semibold text-[#3b2f1a] mb-1">{episode.tagline}</p>
              <p className="text-sm font-bold text-[#6b5a3a]">Your choices change the story. Get ready to play!</p>
              <div className="flex justify-center -space-x-3 my-3">
                {(["sophia", "timothy", "emily", "matthew"] as const).map((b) => (
                  <img key={b} src={STEMBOTS[b].avatar} alt={STEMBOTS[b].name} className="w-16 h-16 object-contain drop-shadow-md" />
                ))}
              </div>
              <button autoFocus onClick={start} className="ep-btn ep-btn-go w-full">
                <Play size={20} fill="currentColor" /> Start episode
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recap */}
      <AnimatePresence>
        {view.kind === "recap" && (
          <motion.div
            key="recap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[65] grid place-items-center bg-black/55 p-4 overflow-y-auto"
          >
            <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} className="ep-card max-w-md w-full">
              <p className="ep-kicker text-center">Episode {episode.number} complete</p>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-center mb-3">{episode.title}</h2>
              <p className="text-xs font-black uppercase tracking-wider text-[#6b5a3a] mb-1.5">Your story</p>
              <ul className="space-y-1.5 mb-4">
                {recap.map((t) => (
                  <li
                    key={t}
                    className="flex gap-2 items-start rounded-xl border-2 border-[#1f1a17] bg-[#fef9ec] px-2.5 py-1.5 text-sm font-semibold leading-snug"
                  >
                    <span className="mt-0.5 grid place-items-center w-5 h-5 shrink-0 rounded-full border-2 border-[#1f1a17] bg-[#86efac]">
                      <Check size={12} strokeWidth={4} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <button autoFocus onClick={() => onFinish(flags)} className="ep-btn ep-btn-go w-full">
                Start the lesson <ChevronRight size={20} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function fireConfetti() {
  const colors = ["#facc15", "#22c55e", "#3b82f6", "#ef4444", "#a855f7"];
  confetti({ particleCount: 90, spread: 80, origin: { x: 0.2, y: 0.6 }, colors, zIndex: 300 });
  confetti({ particleCount: 90, spread: 80, origin: { x: 0.8, y: 0.6 }, colors, zIndex: 300 });
}

function Cast({ cast, speaker, entered }: { cast: CastMember[]; speaker?: Speaker; entered: Set<BotId> }) {
  const many = cast.length >= 4;
  return (
    <div className="absolute inset-0 pointer-events-none">
      {cast.map((c, k) => {
        const talking = speaker === c.bot || speaker === "all";
        const quiet = speaker && !talking && speaker !== "narrator" && speaker !== "you";
        const from = entered.has(c.bot) ? undefined : c.enter;
        const initial =
          from === "left"
            ? { x: "-60vw" }
            : from === "right"
              ? { x: "60vw" }
              : from === "pop"
                ? { scale: 0 }
                : from === "drop"
                  ? { y: "-80vh" }
                  : false;
        return (
          <motion.div
            key={c.bot}
            initial={initial}
            animate={{ x: 0, y: 0, scale: talking ? 1.08 : 1 }}
            transition={{ type: "spring", stiffness: 140, damping: 16, delay: from ? 0.15 + k * 0.12 : 0 }}
            className="absolute -translate-x-1/2"
            style={{
              left: `${SPOT_X[c.at]}%`,
              bottom: "22%",
              width: many ? "min(23vw, 30vh)" : "min(34vw, 40vh)",
              zIndex: talking ? 5 : 1,
            }}
          >
            <div className="ep-bob" style={{ animationDelay: `${k * -0.7}s` }}>
              <img
                src={STEMBOTS[c.bot].avatar}
                alt={STEMBOTS[c.bot].name}
                className="w-full object-contain transition-[filter] duration-300"
                style={{ filter: `drop-shadow(0 10px 6px rgba(0,0,0,0.35))${quiet ? " brightness(0.7) saturate(0.8)" : ""}` }}
              />
            </div>
            <span className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-[70%] h-3 rounded-[50%] bg-black/25 blur-[2px] -z-10" />
          </motion.div>
        );
      })}
    </div>
  );
}

function Dialogue({ line, shown, playerName }: { line: Line; shown: number; playerName?: string }) {
  const done = shown >= line.text.length;
  const text = line.text.slice(0, shown);
  if (line.speaker === "narrator") {
    return (
      <div className="ep-narration w-full max-w-2xl">
        <p>{text}</p>
        {done && <ChevronRight className="ep-next" size={22} />}
      </div>
    );
  }
  const st = SPEAKER_STYLE[line.speaker] ?? { name: line.speaker, color: "#fff" };
  const you = line.speaker === "you";
  const bot = isBot(line.speaker) ? line.speaker : null;
  return (
    <div className={`ep-dialog w-full max-w-2xl ${you ? "ep-dialog-you" : ""} ${line.speaker === "impostor" ? "ep-dialog-dark" : ""}`}>
      <span
        className={`ep-name ${you ? "right-4" : "left-4"}`}
        style={{ background: st.color, color: line.speaker === "impostor" ? "#fff" : undefined }}
      >
        {bot && <img src={STEMBOTS[bot].avatar} alt="" className="w-7 h-7 -my-2 -ml-1 object-contain" />}
        {you ? playerName || "You" : st.name}
      </span>
      <p className="font-display text-[1.08rem] sm:text-[1.3rem] font-semibold leading-snug min-h-[2.6em]">
        {text}
        <span className="opacity-0">{line.text.slice(shown)}</span>
      </p>
      {done && <ChevronRight className="ep-next" size={22} />}
    </div>
  );
}

function FxLayer({ fx }: { fx: Fx[] }) {
  return (
    <div className="absolute inset-0 z-[40] pointer-events-none overflow-hidden">
      {fx.includes("dim") && <div className="absolute inset-0 bg-[#0b0a20]/60" />}
      {fx.includes("heat") && <div className="ep-heat absolute inset-0" />}
      {fx.includes("alarm") && <div className="ep-alarm absolute inset-0" />}
      {fx.includes("rain") && <div className="ep-rain absolute inset-0" />}
      {fx.includes("snow") && <div className="ep-snow absolute inset-0" />}
      {fx.includes("sparkle") &&
        Array.from({ length: 14 }, (_, k) => (
          <span
            key={k}
            className="ep-sparkle"
            style={{ left: `${(k * 37) % 100}%`, top: `${(k * 23 + 11) % 70}%`, animationDelay: `${(k % 5) * 0.4}s` }}
          />
        ))}
    </div>
  );
}

function Eyelids() {
  return (
    <div className="absolute inset-0 z-[45] pointer-events-none">
      <motion.div
        className="absolute inset-x-0 top-0 bg-[#0b0a14] rounded-b-[50%]"
        initial={{ height: "52%" }}
        animate={{ height: ["52%", "30%", "48%", "12%", "50%", "0%"] }}
        transition={{ duration: 2.6, times: [0, 0.25, 0.4, 0.6, 0.72, 1], ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 bg-[#0b0a14] rounded-t-[50%]"
        initial={{ height: "52%" }}
        animate={{ height: ["52%", "30%", "48%", "12%", "50%", "0%"] }}
        transition={{ duration: 2.6, times: [0, 0.25, 0.4, 0.6, 0.72, 1], ease: "easeInOut" }}
      />
    </div>
  );
}

/** Your own gloved hands at the bottom of the screen, holding the scene's prop. */
function PovHands({ hands }: { hands: Hands }) {
  if (hands === "none") return null;
  return (
    <motion.div
      key={hands}
      initial={{ y: 120 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 14 }}
      className="absolute right-[4%] bottom-[24%] sm:bottom-[20%] z-[50] w-[26vw] max-w-[180px] pointer-events-none"
    >
      <div className="ep-bob" style={{ animationDuration: "2.4s" }}>
        <svg viewBox="0 0 100 110" className="w-full drop-shadow-[0_6px_4px_rgba(0,0,0,0.35)]" aria-hidden>
          {hands === "pickaxe" && (
            <g stroke="#1f1a17" strokeWidth="4" strokeLinejoin="round">
              <rect x="44" y="18" width="10" height="80" fill="#a0703c" transform="rotate(-25 49 58)" />
              <path d="M14 30 Q50 0 86 22 L80 32 Q50 14 22 40 Z" fill="#7dd3fc" />
            </g>
          )}
          {hands === "buzzer" && (
            <g stroke="#1f1a17" strokeWidth="4">
              <rect x="20" y="52" width="60" height="22" rx="6" fill="#334155" />
              <path d="M28 54 Q50 16 72 54 Z" fill="#ef4444" />
            </g>
          )}
          {hands === "wrench" && (
            <g stroke="#1f1a17" strokeWidth="4" strokeLinejoin="round">
              <rect x="44" y="30" width="12" height="62" rx="4" fill="#cbd5e1" transform="rotate(20 50 60)" />
              <path d="M40 8 a16 16 0 1 0 26 6 l-8 8 l-8 -2 l-2 -8 z" fill="#cbd5e1" transform="rotate(20 50 60)" />
            </g>
          )}
          {hands === "tablet" && <rect x="14" y="14" width="72" height="56" rx="8" fill="#1e293b" stroke="#1f1a17" strokeWidth="4" />}
          {/* Glove */}
          <path
            d="M24 70 Q22 58 34 58 H66 Q78 58 76 70 L74 96 Q72 106 60 106 H40 Q28 106 26 96 Z"
            fill="#f97316"
            stroke="#1f1a17"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M34 70 H66 M34 80 H66" stroke="#1f1a17" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
        </svg>
      </div>
    </motion.div>
  );
}
