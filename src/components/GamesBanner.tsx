// The STEM x Games module banner: the four STEMbots each busy with one of the
// games from the lessons, on a blocky grass strip, in the theme colour.
import { motion } from "motion/react";
import { ArrowRight, Award, ChevronDown, Gamepad2 } from "lucide-react";
import stembotGreen from "../assets/stembot_green.png";
import stembotBlue from "../assets/stembot_blue.png";
import stembotCream from "../assets/stembot_cream.png";
import stembotRed from "../assets/stembot_red.png";
import { GAMES, GAMES_BY_ID } from "../games/registry";
import { cn } from "./ui/utils";

const INK = "var(--ink-line)";

/** Glass terrarium with a grass block, a sapling and a tiny cloud. */
function Terrarium() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <ellipse cx="60" cy="112" rx="44" ry="6" fill="rgba(0,0,0,.18)" />
      <path d="M22 34h76v62a14 14 0 0 1-14 14H36a14 14 0 0 1-14-14Z" fill="rgba(210,240,255,.55)" stroke={INK} strokeWidth="4" />
      <rect x="16" y="24" width="88" height="14" rx="5" fill="#a8693a" stroke={INK} strokeWidth="4" />
      <path d="M26 82h68v14a10 10 0 0 1-10 10H36a10 10 0 0 1-10-10Z" fill="#8a5129" />
      <path d="M26 74h68v10H26Z" fill="#7cc242" stroke={INK} strokeWidth="3" />
      <path d="M33 90h6M52 96h6M74 90h6" stroke="#5c3416" strokeWidth="4" strokeLinecap="round" />
      <path d="M60 74V54" stroke="#5c3416" strokeWidth="4" strokeLinecap="round" />
      <rect x="48" y="40" width="24" height="18" rx="3" fill="#5fa32e" stroke={INK} strokeWidth="3" />
      <path d="M36 74c0-8 4-12 8-12M84 74c0-6-3-10-7-10" stroke="#5fa32e" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M32 44h8M30 50h6" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <circle cx="84" cy="50" r="3" fill="#5cc8ff" stroke={INK} strokeWidth="2" />
      <circle cx="90" cy="60" r="2.5" fill="#5cc8ff" stroke={INK} strokeWidth="2" />
    </svg>
  );
}

/** A Monopoly-style board corner with dice and a coin. */
function BoardAndDice() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <ellipse cx="60" cy="112" rx="46" ry="6" fill="rgba(0,0,0,.18)" />
      <path d="M8 86 60 66l52 20-52 22Z" fill="#fffbe6" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M8 86 60 66l9 3.5L17 89.6ZM103 82.5 112 86l-52 22-9-3.8Z" fill="#ef5b5b" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M30 77.5 39 81M82 74l9 3.5" stroke={INK} strokeWidth="2.5" />
      <g transform="rotate(-14 42 48)">
        <rect x="26" y="32" width="32" height="32" rx="7" fill="#fff" stroke={INK} strokeWidth="4" />
        <circle cx="35" cy="41" r="3.4" fill={INK} />
        <circle cx="42" cy="48" r="3.4" fill={INK} />
        <circle cx="49" cy="55" r="3.4" fill={INK} />
      </g>
      <g transform="rotate(12 82 40)">
        <rect x="66" y="24" width="30" height="30" rx="7" fill="#fff" stroke={INK} strokeWidth="4" />
        <circle cx="75" cy="33" r="3.2" fill={INK} />
        <circle cx="87" cy="33" r="3.2" fill={INK} />
        <circle cx="75" cy="45" r="3.2" fill={INK} />
        <circle cx="87" cy="45" r="3.2" fill={INK} />
      </g>
      <circle cx="94" cy="78" r="9" fill="#ffd23f" stroke={INK} strokeWidth="3" />
      <text x="94" y="82" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="11" fill={INK}>
        $
      </text>
    </svg>
  );
}

/** Rocket mid-launch with a puffy exhaust cloud. */
function LaunchRocket() {
  return (
    <svg viewBox="0 0 120 150" className="w-full h-full overflow-visible">
      <g className="banner-rocket">
        <path d="M60 10c17 12 22 36 15 62H45c-7-26-2-50 15-62Z" fill="#fff" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
        <path d="M45 72 30 88l4-22 12-9M75 72l15 16-4-22-12-9" fill="#ef5b5b" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <circle cx="60" cy="38" r="9" fill="#5cc8ff" stroke={INK} strokeWidth="4" />
        <path d="M48 72h24v8H48Z" fill="#9aa4ad" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <path className="banner-flame" d="M50 80c-2 12 4 20 10 28 6-8 12-16 10-28Z" fill="#ffb02e" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M55 82c0 8 2 12 5 16 3-4 5-8 5-16Z" fill="#ffe066" />
      </g>
      <g fill="#fff" stroke={INK} strokeWidth="4">
        <circle cx="38" cy="130" r="14" />
        <circle cx="60" cy="126" r="17" />
        <circle cx="84" cy="131" r="13" />
      </g>
    </svg>
  );
}

/** A spaceship task console showing a BODMAS sum. */
function TaskConsole() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      <ellipse cx="60" cy="112" rx="42" ry="6" fill="rgba(0,0,0,.18)" />
      <path d="M28 70h64l8 40H20Z" fill="#9aa4ad" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <rect x="12" y="14" width="96" height="62" rx="10" fill="#2b2f45" stroke={INK} strokeWidth="4" />
      <rect x="20" y="22" width="80" height="46" rx="6" fill="#1b2a3a" />
      <text x="60" y="44" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="15" fill="#7cf2a6">
        (2+3)×4
      </text>
      <text x="60" y="61" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="13" fill="#ffd23f">
        = 20 ✓
      </text>
      <circle cx="40" cy="92" r="6" fill="#ef5b5b" stroke={INK} strokeWidth="3" />
      <circle cx="60" cy="92" r="6" fill="#ffd23f" stroke={INK} strokeWidth="3" />
      <circle cx="80" cy="92" r="6" fill="#7cc242" stroke={INK} strokeWidth="3" />
      <path d="M100 18 112 6" stroke="#ffd23f" strokeWidth="4" strokeLinecap="round" />
      <path d="M104 30h12" stroke="#ffd23f" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** A row of pixel grass blocks along the bottom of the banner. */
function GrassStrip() {
  return (
    <div className="banner-grass" aria-hidden="true">
      <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 400 40">
        <defs>
          <pattern id="grassBlocks" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#a8693a" />
            <rect width="40" height="12" fill="#7cc242" />
            <path d="M0 12h6v4h6v-4h8v5h6v-5h14" fill="#7cc242" />
            <rect x="8" y="24" width="5" height="5" fill="#8a5129" />
            <rect x="26" y="30" width="5" height="5" fill="#8a5129" />
            <path d="M40 0v40" stroke="rgba(0,0,0,.18)" strokeWidth="2" />
          </pattern>
        </defs>
        <rect width="400" height="40" fill="url(#grassBlocks)" />
      </svg>
    </div>
  );
}

const SCENE = [
  { bot: stembotGreen, name: "Sophia", game: "mm-sci-sim", Prop: Terrarium, botCls: "h-[50%] left-[-4%]", propCls: "w-[58%] right-[-2%] bottom-[-2%]", ratio: "1", tilt: -6 },
  { bot: stembotBlue, name: "Timothy", game: "mi-math-sim", Prop: BoardAndDice, botCls: "h-[54%] right-[-2%]", propCls: "w-[64%] left-[-6%] bottom-[-3%]", ratio: "1", tilt: 5 },
  { bot: stembotCream, name: "Emily", game: "sb-sci-sim", Prop: LaunchRocket, botCls: "h-[48%] left-[-4%]", propCls: "w-[64%] right-[-12%] bottom-[0%]", ratio: "120/150", tilt: -4 },
  { bot: stembotRed, name: "Matthew", game: "sb-math-sim", Prop: TaskConsole, botCls: "h-[52%] right-[-4%]", propCls: "w-[58%] left-[-4%] bottom-[-2%]", ratio: "1", tilt: 7 },
];

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
  return (
    <div className="games-banner">
      {/* Floating bits from the games */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <span className="banner-float left-[38%] top-[10%]">★</span>
        <span className="banner-float left-[62%] top-[6%] [animation-delay:-1.5s]">✦</span>
        <span className="banner-float right-[4%] top-[14%] [animation-delay:-3s]">★</span>
        <div className="absolute left-[4%] top-[8%] w-10 h-10 motif-icon opacity-40 rotate-[-12deg]" />
      </div>

      <div className="relative z-10 grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)] items-end">
        {/* Words */}
        <div className="px-6 pt-7 pb-6 sm:px-9 sm:pt-9 lg:pb-14 order-2 lg:order-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="kicker kicker-on">
              <Gamepad2 size={13} /> Module
            </span>
            {moduleComplete && (
              <span className="chip-ink !text-xs !py-1 bg-pop-2 !text-[#1b1b12]">
                <Award size={13} /> Completed
              </span>
            )}
          </div>
          <h2 className="font-display font-bold !text-[clamp(2.2rem,1.4rem+2.6vw,3.6rem)] !leading-[0.98] mt-3">
            {title.split(" x ")[0]} <span className="mark-pop">x</span> {title.split(" x ")[1] ?? ""}
          </h2>
          <p className="font-bold mt-3 opacity-90 max-w-sm">
            Learn science and maths, then play {GAMES.length} games with the STEMbots.
          </p>
          <div className="flex items-center gap-3 mt-4 max-w-sm">
            <div className="meter flex-1 !h-4 !bg-card">
              <span style={{ width: `${pct}%` }} className="!bg-pop-2" />
            </div>
            <span className="chip-ink !text-sm !py-1">{pct}%</span>
          </div>
          <p className="text-xs font-extrabold mt-2 opacity-80">
            {lessonCount} lessons · {done}/{total} checkpoints cleared
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <button onClick={onContinue} className="btn-pop">
              {continueLabel} <ArrowRight size={17} strokeWidth={2.6} />
            </button>
            <button onClick={onToggle} className="btn-pop btn-pop3" aria-expanded={expanded}>
              {expanded ? "Hide lessons" : "See lessons"}
              <ChevronDown size={17} className={cn("transition-transform", expanded && "rotate-180")} />
            </button>
            <button onClick={onCertificate} className="btn-pop btn-pop2">
              <Award size={17} /> {moduleComplete ? "My certificate" : "Certificate"}
            </button>
          </div>
        </div>

        {/* Scene */}
        <div className="relative order-1 lg:order-2 h-[230px] sm:h-[290px] lg:h-[340px] mx-3 lg:mx-0 lg:mr-4">
          <div className="absolute inset-x-0 bottom-[22px] top-0 grid grid-cols-4">
            {SCENE.map((s, i) => {
              const game = GAMES_BY_ID[s.game];
              return (
                <motion.div
                  key={s.name}
                  className="relative h-full"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 + i * 0.1, type: "spring", stiffness: 200, damping: 18 }}
                >
                  <div className={cn("absolute z-[2]", s.propCls)} style={{ aspectRatio: s.ratio }}>
                    <s.Prop />
                  </div>
                  <img
                    src={s.bot}
                    alt={s.name}
                    className={cn("absolute bottom-0 die-cut bob", s.botCls)}
                    style={{ rotate: `${s.tilt}deg`, animationDelay: `${-i * 1.1}s` }}
                  />
                  {game && (
                    <span
                      className="banner-tag hidden sm:inline-flex"
                      style={{ rotate: `${i % 2 ? 3 : -3}deg`, top: i % 2 ? "14%" : "4%" }}
                    >
                      <span aria-hidden>{game.icon}</span> {game.title}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
          <GrassStrip />
        </div>
      </div>
    </div>
  );
}
