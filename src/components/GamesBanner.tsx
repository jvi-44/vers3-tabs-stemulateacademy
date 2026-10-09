// The STEM x Games module banner: a slim strip in the theme colour with four
// matching "game windows", one per STEMbot, each with the game they host.
import { motion } from "motion/react";
import { ArrowRight, Award, ChevronDown } from "lucide-react";
import stembotGreen from "../assets/stembot_green.png";
import stembotBlue from "../assets/stembot_blue.png";
import stembotCream from "../assets/stembot_cream.png";
import stembotRed from "../assets/stembot_red.png";
import { GAMES_BY_ID } from "../games/registry";
import { cn } from "./ui/utils";
import { Terrarium, BoardAndDice, LaunchRocket, TaskConsole } from "./GameArt";

const WINDOWS = [
  { bot: stembotGreen, name: "Sophia", game: "mm-sci-sim", Prop: Terrarium, tint: "#dcf5c8" },
  { bot: stembotBlue, name: "Timothy", game: "mi-math-sim", Prop: BoardAndDice, tint: "#d3ecfc" },
  { bot: stembotCream, name: "Emily", game: "sb-sci-sim", Prop: LaunchRocket, tint: "#fdf0c9" },
  { bot: stembotRed, name: "Matthew", game: "sb-math-sim", Prop: TaskConsole, tint: "#ffdcdc" },
];

/** One STEMbot in a little window with the game they host. */
function GameWindow({ w, i }: { w: (typeof WINDOWS)[number]; i: number }) {
  const game = GAMES_BY_ID[w.game];
  return (
    <motion.div
      className="game-window"
      style={{ background: w.tint, rotate: `${i % 2 ? 2 : -2}deg` }}
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.05 + i * 0.07, type: "spring", stiffness: 220, damping: 18 }}
      title={game ? `${w.name} hosts ${game.title}` : w.name}
    >
      <div className="absolute right-[2%] top-[8%] w-[62%]" style={{ aspectRatio: w.Prop === LaunchRocket ? "120/150" : "1" }}>
        <w.Prop />
      </div>
      <img src={w.bot} alt={w.name} className="absolute left-[-8%] bottom-[-14%] h-[82%] die-cut" />
    </motion.div>
  );
}

export function GamesBanner({
  title,
  lessonCount,
  done,
  total,
  expanded,
  onToggle,
  onContinue,
  continueLabel,
  moduleComplete,
  onCertificate,
}: {
  title: string;
  lessonCount: number;
  done: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onContinue: () => void;
  continueLabel: string;
  moduleComplete: boolean;
  onCertificate: () => void;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const [first, second] = title.split(" x ");
  return (
    <div className="games-banner">
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-5 px-5 py-5 sm:px-7">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display font-bold !text-[clamp(1.7rem,1.3rem+1.2vw,2.3rem)] !leading-none">
              {first} <span className="mark-pop !text-[0.85em]">x</span> {second ?? ""}
            </h2>
            {moduleComplete && (
              <span className="chip-ink !text-xs !py-1 bg-pop-2 !text-[#1b1b12]">
                <Award size={13} /> Completed
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-3 max-w-md">
            <div className="meter flex-1 !h-3.5">
              <span style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-extrabold whitespace-nowrap">
              {done}/{total} · {lessonCount} lessons
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5 mt-4">
            <button onClick={onContinue} className="btn-pop btn-pop-sm">
              {continueLabel} <ArrowRight size={15} strokeWidth={2.6} />
            </button>
            <button onClick={onCertificate} className="btn-pop btn-pop-sm">
              <Award size={15} /> {moduleComplete ? "My certificate" : "Certificate"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2.5 sm:gap-3.5 lg:w-[27rem] shrink-0">
          {WINDOWS.map((w, i) => (
            <GameWindow key={w.name} w={w} i={i} />
          ))}
        </div>

        <button
          onClick={onToggle}
          aria-expanded={expanded}
          className="self-stretch lg:self-center flex lg:flex-col items-center justify-center gap-1.5 rounded-2xl lg:rounded-full border-[2.5px] border-ink bg-card text-[color:var(--card-foreground)] shadow-[0_3px_0_var(--ink-line)] px-4 py-2 lg:p-0 lg:w-12 lg:h-12 font-display font-semibold text-sm hover:-translate-y-0.5 transition-transform"
        >
          <span className="lg:hidden">{expanded ? "Hide lessons" : "Show lessons"}</span>
          <ChevronDown size={20} strokeWidth={2.6} className={cn("transition-transform", expanded && "rotate-180")} />
          <span className="sr-only">{expanded ? "Hide lessons" : "Show lessons"}</span>
        </button>
      </div>
    </div>
  );
}
