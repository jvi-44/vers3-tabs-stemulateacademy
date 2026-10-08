import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import {
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Star,
  Map as MapIcon,
  Play,
  RotateCcw,
  Sparkles,
  MessageCircle,
  Clock,
} from "lucide-react";
import { cn } from "./ui/utils";
import type { GameLesson, LessonBeat } from "../data/lessonContent";
import { pointsFor } from "../data/lessonContent";
import { SpeechBubbles } from "./SpeechBubble";
import { ComicStrip } from "./comic/ComicStrip";
import { COMIC_STRIPS } from "../data/comicStrips";
import { AskStembots } from "./AskStembots";
import { LessonGame } from "../games/LessonGame";
import { botFor } from "./StembotDialogue";
import { sfx } from "../games/kit/audio";
import { BEAT_KIND, BeatGlyph, LessonBadge } from "./lesson/LessonArt";
import { CheckpointMap, CheckpointTrail } from "./lesson/CheckpointMap";

function AtomIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
    </svg>
  );
}

function RewardChips({ beat, className, xpOverride }: { beat: LessonBeat; className?: string; xpOverride?: number }) {
  const p = pointsFor(beat);
  const xpLabel = xpOverride ?? (beat.type === "quiz" ? "50–100" : p.xp || null);
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {xpLabel ? (
        <span className="chip-ink !text-sm !py-1">
          <Star size={14} className="fill-[#f5c518] text-[#b07d00]" /> +{xpLabel} XP
        </span>
      ) : null}
      {!!p.atoms && (
        <span className="chip-ink !text-sm !py-1">
          <AtomIcon size={14} className="text-[#3b82f6]" /> +{p.atoms} Atoms
        </span>
      )}
    </div>
  );
}

/** First not-yet-completed beat in a lesson, or the first beat if the whole
 * lesson is already done (so "Start Lesson" always goes somewhere useful). */
export function firstIncompleteBeat(lesson: GameLesson, completedBeats: Record<string, boolean>) {
  return lesson.beats.find((b) => !completedBeats[b.id]) ?? lesson.beats[0];
}

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

function Donut({ pct, size = 64 }: { pct: number; size?: number }) {
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <circle cx="32" cy="32" r={RING_R} className="donut-track" />
        <circle cx="32" cy="32" r={RING_R} className="donut-gap" />
        <circle
          cx="32"
          cy="32"
          r={RING_R}
          className="donut-fill"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - pct / 100)}
        />
      </svg>
      <span className="absolute font-display font-bold text-sm">{pct}%</span>
    </div>
  );
}

export function GameLessonExplorer({
  lessons,
  completedBeats,
  onOpenBeat,
  highlightBeatId,
  avatar,
}: {
  lessons: GameLesson[];
  completedBeats: Record<string, boolean>;
  onOpenBeat: (lessonId: string, beatId: string) => void;
  highlightBeatId?: string | null;
  avatar?: string;
}) {
  // Open the lesson the learner is part-way through, else the first one.
  const [expanded, setExpanded] = useState<string | null>(
    () =>
      lessons.find((l) => l.beats.some((b) => completedBeats[b.id]) && !l.beats.every((b) => completedBeats[b.id]))?.id ??
      lessons[0]?.id ??
      null,
  );

  return (
    <div className="space-y-5">
      {lessons.map((lesson, li) => {
        const doneCount = lesson.beats.filter((b) => completedBeats[b.id]).length;
        const total = lesson.beats.length;
        const pct = Math.round((doneCount / total) * 100);
        const isOpen = expanded === lesson.id;
        const status = doneCount === 0 ? "Not started" : doneCount === total ? "Completed" : "In progress";
        const xpTotal = lesson.beats.reduce((n, b) => n + (pointsFor(b).xp ?? 0), 0);
        const games = lesson.beats.filter((b) => b.type === "simulation").length;
        const cta = doneCount === 0 ? "Start lesson" : doneCount === total ? "Replay" : "Continue";
        return (
          <div key={lesson.id} className={cn("sticker !rounded-[2rem] overflow-hidden", isOpen && "!shadow-[0_7px_0_var(--ink-line)]")}>
            <div className="flex items-center gap-4 sm:gap-5 p-4 sm:p-5">
              <button
                onClick={() => setExpanded(isOpen ? null : lesson.id)}
                className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0 text-left group"
                aria-expanded={isOpen}
              >
                <LessonBadge lesson={lesson} size={78} tilt={li % 2 ? 4 : -5} className="group-hover:rotate-0 transition-transform !w-[58px] !h-[58px] sm:!w-[78px] sm:!h-[78px]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn("kicker !text-[10px] !py-1", li % 2 && "kicker-3")}>{lesson.flagLabel}</span>
                    <span
                      className={cn(
                        "text-[10px] font-extrabold uppercase tracking-widest",
                        doneCount === total ? "text-[color:var(--soft-2-ink)]" : "text-muted-foreground",
                      )}
                    >
                      {status}
                      <span className="sm:hidden"> · {pct}%</span>
                    </span>
                  </div>
                  <h4 className="font-display font-bold text-xl sm:text-[1.4rem] text-foreground leading-tight">{lesson.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-1 sm:line-clamp-none">{lesson.blurb}</p>
                  <div className="hidden sm:flex items-center gap-2 mt-2 text-xs font-bold text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapIcon size={13} /> {total} checkpoints
                    </span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Star size={13} /> {xpTotal}+ XP
                    </span>
                    {games > 0 && (
                      <>
                        <span aria-hidden>·</span>
                        <span>
                          {games} game{games > 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </button>
              <div className="hidden sm:block">
                <Donut pct={pct} size={62} />
              </div>
              <div className="hidden md:flex flex-col items-stretch gap-2 shrink-0">
                <button
                  onClick={() => onOpenBeat(lesson.id, firstIncompleteBeat(lesson, completedBeats).id)}
                  className="btn-pop btn-pop-sm btn-primary"
                >
                  {cta} <ArrowRight size={14} />
                </button>
                <button onClick={() => setExpanded(isOpen ? null : lesson.id)} className="btn-pop btn-pop-sm !shadow-[0_2px_0_var(--ink-line)]">
                  <MapIcon size={14} /> {isOpen ? "Hide map" : "Show map"}
                </button>
              </div>
              <button
                onClick={() => setExpanded(isOpen ? null : lesson.id)}
                className="md:hidden w-9 h-9 rounded-full border-2 border-ink flex items-center justify-center bg-card shrink-0"
                aria-label={isOpen ? "Hide map" : "Show map"}
              >
                <ChevronDown size={18} className={cn("transition-transform", isOpen && "rotate-180")} />
              </button>
            </div>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 30 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 sm:px-5 pb-5">
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-3 px-1">
                      <p className="font-display font-semibold text-foreground">
                        Checkpoint map{" "}
                        <span className="text-muted-foreground font-body text-sm font-bold">
                          · {doneCount} of {total} cleared
                        </span>
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(["intro", "video", "quiz", "simulation", "exit"] as const).map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                            <BeatGlyph beat={{ type: t }} size={20} />
                            {BEAT_KIND[t].label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <CheckpointMap
                      lesson={lesson}
                      completedBeats={completedBeats}
                      onOpenBeat={(beatId) => onOpenBeat(lesson.id, beatId)}
                      avatar={avatar}
                      highlightBeatId={highlightBeatId}
                    />
                    <button
                      onClick={() => onOpenBeat(lesson.id, firstIncompleteBeat(lesson, completedBeats).id)}
                      className="md:hidden btn-pop btn-primary w-full mt-4"
                    >
                      {cta} <ArrowRight size={15} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Beat Player: the full-screen lesson player for one checkpoint
// ---------------------------------------------------------------------------

type Cleared = { xp: number; atoms: number; title: string; last: boolean };

export function BeatPlayer({
  lesson,
  activeBeatId,
  completedBeats,
  onSelectBeat,
  onComplete,
  onBack,
}: {
  lesson: GameLesson;
  activeBeatId: string;
  completedBeats: Record<string, boolean>;
  onSelectBeat: (beatId: string) => void;
  onComplete: (beat: LessonBeat, scoreRatio?: number, reflection?: string) => void;
  onBack: () => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [cleared, setCleared] = useState<Cleared | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const activeBeat = lesson.beats.find((b) => b.id === activeBeatId) ?? lesson.beats[0];
  const idx = lesson.beats.findIndex((b) => b.id === activeBeat.id);
  const doneCount = lesson.beats.filter((b) => completedBeats[b.id]).length;
  const pct = Math.round((doneCount / lesson.beats.length) * 100);
  const done = !!completedBeats[activeBeat.id];
  const k = BEAT_KIND[activeBeat.type];
  const host = botFor(activeBeat.subject, activeBeat.type);
  const isGame = activeBeat.type === "simulation";

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [activeBeat.id]);

  const goNext = () => {
    if (idx < lesson.beats.length - 1) onSelectBeat(lesson.beats[idx + 1].id);
    else onBack();
  };
  const goPrev = () => idx > 0 && onSelectBeat(lesson.beats[idx - 1].id);

  const finish = (scoreRatio?: number, reflection?: string) => {
    if (done) return goNext();
    onComplete(activeBeat, scoreRatio, reflection);
    const p = pointsFor(activeBeat);
    const xp =
      activeBeat.type === "quiz" && typeof scoreRatio === "number"
        ? Math.round((p.xpMin ?? 50) + (100 - (p.xpMin ?? 50)) * scoreRatio)
        : p.xp;
    const last = lesson.beats.every((b) => b.id === activeBeat.id || completedBeats[b.id]);
    setCleared({ xp, atoms: p.atoms, title: activeBeat.title, last });
    sfx.levelUp();
    confetti({ particleCount: last ? 220 : 90, spread: last ? 110 : 70, origin: { y: 0.55 }, scalar: 1.1 });
  };

  const closeCleared = () => {
    const wasLast = cleared?.last;
    setCleared(null);
    if (wasLast) onBack();
    else goNext();
  };

  return (
    <div className="min-h-screen bg-playful flex flex-col md:flex-row">
      {/* Left: the checkpoint trail */}
      <aside className="player-side hidden md:flex flex-col w-[19rem] shrink-0 h-screen sticky top-0">
        <div className="p-5 pb-4 space-y-4">
          <button onClick={onBack} className="btn-pop btn-pop-sm">
            <ArrowLeft size={15} /> Back to map
          </button>
          <div className="flex items-center gap-3">
            <LessonBadge lesson={lesson} size={56} />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">{lesson.flagLabel}</p>
              <h2 className="font-display font-bold text-xl leading-tight text-foreground">{lesson.title}</h2>
            </div>
          </div>
          <div className="sticker !rounded-2xl p-3 !shadow-[0_3px_0_var(--ink-line)]">
            <div className="flex items-center justify-between text-xs font-extrabold mb-1.5">
              <span>
                {doneCount}/{lesson.beats.length} checkpoints
              </span>
              <span className="text-primary">{pct}%</span>
            </div>
            <div className="meter">
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <CheckpointTrail lesson={lesson} completedBeats={completedBeats} activeBeatId={activeBeat.id} onSelect={onSelectBeat} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 bg-background/95 backdrop-blur border-b-[2.5px] border-ink px-4 pt-3 pb-3 space-y-2.5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 rounded-full border-2 border-ink bg-card flex items-center justify-center shrink-0" aria-label="Back to map">
            <ArrowLeft size={18} />
          </button>
          <LessonBadge lesson={lesson} size={38} />
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold leading-tight truncate">{lesson.title}</p>
            <p className="text-[11px] font-bold text-muted-foreground">
              Checkpoint {idx + 1} of {lesson.beats.length}
            </p>
          </div>
        </div>
        <div className="dots-strip">
          {lesson.beats.map((b) => (
            <button
              key={b.id}
              onClick={() => onSelectBeat(b.id)}
              data-done={!!completedBeats[b.id]}
              data-active={b.id === activeBeat.id}
              aria-label={b.title}
            />
          ))}
        </div>
      </div>

      {/* Centre: the checkpoint itself */}
      <main ref={mainRef} className="flex-1 min-w-0 px-4 sm:px-8 md:px-10 pt-6 md:pt-8 pb-28 md:pb-12 overflow-x-hidden">
        <div className={cn("mx-auto space-y-6", isGame ? "max-w-5xl" : "max-w-3xl")}>
          {/* Checkpoint header */}
          <motion.header
            key={`head-${activeBeat.id}`}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="stage-head px-6 sm:px-8 py-6 sm:py-7 pr-28 sm:pr-44"
          >
            <div className="flex items-center gap-2 flex-wrap mb-2.5">
              <span className="kicker kicker-on !py-1.5">
                Checkpoint {idx + 1} of {lesson.beats.length}
              </span>
              <span className="chip-ink !text-xs !py-1 !px-2.5" style={{ background: k.bg, color: k.fg }}>
                <k.Icon size={13} strokeWidth={2.6} /> {k.label}
              </span>
              {activeBeat.duration && (
                <span className="chip-ink !text-xs !py-1 !px-2.5">
                  <Clock size={12} /> {activeBeat.duration}
                </span>
              )}
              {done && <span className="chip-ink !text-xs !py-1 !px-2.5 bg-pop-2 !text-[#1b1b12]">✓ Cleared</span>}
            </div>
            <h1 className="font-display font-bold text-[1.7rem] sm:text-[2.2rem] leading-[1.05]">{activeBeat.title}</h1>
            {activeBeat.topicLabel && activeBeat.topicLabel !== activeBeat.title && activeBeat.topicLabel !== k.label && (
              <p className="mt-1 font-bold opacity-80 text-sm">{activeBeat.topicLabel}</p>
            )}
            {!done && <RewardChips beat={activeBeat} className="mt-3" />}
            <img
              src={host.avatar}
              alt={host.name}
              className="absolute right-2 sm:right-5 -bottom-3 h-[7.5rem] sm:h-[10rem] die-cut bob rotate-[6deg] pointer-events-none"
            />
          </motion.header>

          {/* Dialogue: intro beats with a comic tell the story in panels instead */}
          {activeBeat.dialogue && activeBeat.dialogue.length > 0 && !COMIC_STRIPS[activeBeat.id] && (
            <SpeechBubbles lines={activeBeat.dialogue} />
          )}

          <BeatContent key={`body-${activeBeat.id}`} beat={activeBeat} done={done} onFinish={finish} onNext={goNext} host={host} />

          {/* Prev / next */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button onClick={goPrev} disabled={idx === 0} className="btn-pop btn-pop-sm">
              <ArrowLeft size={15} /> Back
            </button>
            <span className="text-xs font-extrabold text-muted-foreground hidden sm:block">
              {idx < lesson.beats.length - 1 ? `Up next: ${lesson.beats[idx + 1].title}` : "Last checkpoint!"}
            </span>
            <button onClick={goNext} className="btn-pop btn-pop-sm">
              {idx < lesson.beats.length - 1 ? "Skip" : "Map"} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </main>

      <AskStembots beat={activeBeat} open={chatOpen} onToggle={() => setChatOpen((v) => !v)} />

      {/* Checkpoint cleared! */}
      <AnimatePresence>
        {cleared && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-[color:var(--ink)]/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCleared}
          >
            <motion.div
              className="stamp relative w-full max-w-sm px-7 pt-14 pb-7 text-center"
              initial={{ scale: 0.4, rotate: -14 }}
              animate={{ scale: 1, rotate: -3 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 16 }}
              onClick={(e) => e.stopPropagation()}
            >
              <img src={host.avatar} alt="" className="absolute left-1/2 -translate-x-1/2 -top-16 h-28 die-cut bob" />
              <p className="kicker mx-auto">{cleared.last ? "Lesson complete" : "Checkpoint cleared"}</p>
              <h3 className="font-display font-bold text-3xl mt-3 leading-tight">
                {cleared.last ? "You did it!" : "Awesome work!"}
              </h3>
              <p className="text-sm font-bold text-muted-foreground mt-1 line-clamp-2">{cleared.title}</p>
              <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
                {!!cleared.xp && (
                  <motion.span initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="chip-ink bg-pop-2 !text-[#1b1b12]">
                    <Star size={15} className="fill-[#f5c518] text-[#1b1b12]" /> +{cleared.xp} XP
                  </motion.span>
                )}
                {!!cleared.atoms && (
                  <motion.span initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="chip-ink">
                    <AtomIcon size={15} className="text-[#3b82f6]" /> +{cleared.atoms} Atoms
                  </motion.span>
                )}
              </div>
              {cleared.last && (
                <p className="text-sm font-bold mt-4">The live game for this lesson is now unlocked in the Games tab!</p>
              )}
              <button onClick={closeCleared} className="btn-pop btn-primary w-full mt-5">
                {cleared.last ? "Back to the map" : "Next checkpoint"} <ArrowRight size={16} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type Host = { name: string; avatar: string };

function HostSays({ host, children }: { host: Host; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-14 h-14 rounded-full border-[2.5px] border-ink bg-soft-1 overflow-hidden shrink-0 shadow-[0_3px_0_var(--ink-line)]">
        <img src={host.avatar} alt={host.name} className="w-full h-full object-contain p-0.5" />
      </div>
      <div className="bubble bubble-left flex-1 px-4 py-3">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-0.5">{host.name}</p>
        <div className="text-[0.98rem] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function BeatContent({
  beat,
  done,
  onFinish,
  onNext,
  host,
}: {
  beat: LessonBeat;
  done: boolean;
  onFinish: (scoreRatio?: number, reflection?: string) => void;
  onNext: () => void;
  host: Host;
}) {
  if (beat.type === "intro") {
    const comic = COMIC_STRIPS[beat.id];
    return (
      <div className="space-y-6">
        {comic && <ComicStrip strip={comic} />}
        <div className="sticker p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 motif-icon opacity-50 rotate-12" aria-hidden />
          <p className="kicker kicker-3 mb-3">The story so far</p>
          <p className="text-[1.08rem] leading-relaxed font-semibold relative">{beat.description}</p>
        </div>
        <button onClick={() => onFinish()} className="btn-pop btn-primary w-full !py-4 text-lg">
          {done ? "Continue" : "On with the adventure!"} <ArrowRight size={18} />
        </button>
      </div>
    );
  }

  if (beat.type === "video") return <VideoBeat beat={beat} done={done} onFinish={onFinish} host={host} />;
  if (beat.type === "quiz") return <QuizBeat beat={beat} done={done} onFinish={onFinish} host={host} />;
  if (beat.type === "simulation") {
    return (
      <div className="sticker !rounded-[2rem] p-2 sm:p-3 bg-ink">
        <LessonGame key={beat.id} beatId={beat.id} done={done} onContinue={(score) => (done ? onNext() : onFinish(score / 100))} />
      </div>
    );
  }
  return <ExitCardBeat beat={beat} done={done} onSubmit={(text) => onFinish(undefined, text)} host={host} />;
}

function VideoBeat({
  beat,
  done,
  onFinish,
  host,
}: {
  beat: LessonBeat;
  done: boolean;
  onFinish: () => void;
  host: Host;
}) {
  const [pressed, setPressed] = useState(false);
  const p = pointsFor(beat);
  return (
    <div className="space-y-6">
      <div className="tv mx-1 mt-14">
        <span className="tv-antenna left-[38%] rotate-[-24deg]" aria-hidden />
        <span className="tv-antenna left-[60%] rotate-[22deg]" aria-hidden />
        <div className="tv-screen flex items-center justify-center">
          <img src={host.avatar} alt="" className="absolute left-[5%] bottom-0 h-[52%] die-cut" />
          <AnimatePresence mode="wait">
            {!pressed ? (
              <motion.button
                key="play"
                onClick={() => setPressed(true)}
                className="relative w-24 h-24 rounded-full bg-card border-[3px] border-ink shadow-[0_6px_0_var(--ink-line)] flex items-center justify-center hover:scale-105 transition-transform"
                aria-label="Play video"
                exit={{ scale: 0 }}
              >
                <Play size={40} className="fill-[color:var(--ink)] ml-1.5" />
              </motion.button>
            ) : (
              <motion.div
                key="soon"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bubble max-w-xs mx-auto px-5 py-4 text-center ml-[34%] sm:ml-auto"
              >
                <p className="font-display font-bold text-lg leading-tight">Lights, camera… almost!</p>
                <p className="text-sm font-semibold mt-1 text-muted-foreground">
                  This video is still being filmed. Read {host.name}'s notes below for now.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {beat.duration && (
            <span className="absolute top-3 right-3 chip-ink !text-xs !py-1 !px-2.5">
              <Clock size={12} /> {beat.duration}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between px-2 pt-3" aria-hidden>
          <div className="flex gap-2">
            <span className="w-4 h-4 rounded-full bg-pop-2 border-2 border-black" />
            <span className="w-4 h-4 rounded-full bg-primary border-2 border-black" />
          </div>
          <span className="font-display text-xs font-bold tracking-[0.3em] text-white/70">STEM TV</span>
        </div>
      </div>

      <HostSays host={host}>{beat.description}</HostSays>

      <button onClick={() => onFinish()} className="btn-pop btn-primary w-full !py-4 text-lg">
        {done ? (
          <>
            Continue <ArrowRight size={18} />
          </>
        ) : (
          <>
            I watched it!
            <span className="flex items-center gap-1.5 text-sm opacity-90 ml-1">
              <Star size={14} className="fill-current" /> +{p.xp}
              <AtomIcon size={14} /> +{p.atoms}
            </span>
          </>
        )}
      </button>
    </div>
  );
}

const LETTERS = ["A", "B", "C", "D", "E"];
const LETTER_BG = ["var(--primary)", "var(--pop-2)", "var(--pop-3)", "var(--soft-1)", "var(--soft-2)"];

function QuizBeat({
  beat,
  done,
  onFinish,
  host,
}: {
  beat: LessonBeat;
  done: boolean;
  onFinish: (scoreRatio: number) => void;
  host: Host;
}) {
  const questions = beat.quizQuestions ?? [];
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const q = questions[qi];
  const p = pointsFor(beat);

  const pick = (oi: number) => {
    if (picked !== null) return;
    setPicked(oi);
    if (oi === q.correctAnswer) {
      setScore((s) => s + 1);
      sfx.correct();
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 }, scalar: 0.8 });
    } else {
      sfx.wrong();
      setShakeKey((k) => k + 1);
    }
  };

  const next = () => {
    if (qi < questions.length - 1) {
      setQi(qi + 1);
      setPicked(null);
    } else setFinished(true);
  };

  const restart = () => {
    setQi(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  };

  if (!questions.length) return null;

  if (finished) {
    const ratio = score / questions.length;
    const stars = ratio === 1 ? 3 : ratio >= 0.6 ? 2 : ratio > 0 ? 1 : 0;
    const xp = Math.round((p.xpMin ?? 50) + (100 - (p.xpMin ?? 50)) * ratio);
    return (
      <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="sticker !rounded-[2rem] p-7 sm:p-9 text-center">
        <div className="flex justify-center gap-2 mb-3">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: i === 1 ? 0 : i === 0 ? -12 : 12 }}
              transition={{ delay: 0.15 + i * 0.15, type: "spring", stiffness: 300, damping: 12 }}
            >
              <Star
                size={i === 1 ? 64 : 50}
                strokeWidth={2.2}
                className={cn(i < stars ? "fill-[#f5c518] text-[color:var(--ink)]" : "fill-[color:var(--muted)] text-[color:var(--ink)] opacity-60")}
              />
            </motion.span>
          ))}
        </div>
        <p className="font-display font-bold text-3xl">
          {score} of {questions.length} correct!
        </p>
        <p className="text-muted-foreground font-bold mt-1">
          {ratio === 1 ? "Perfect score. You're a STEM superstar!" : ratio >= 0.6 ? "Great job! Nearly perfect." : "Good try! Every mistake helps your brain grow."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button onClick={restart} className="btn-pop flex-1">
            <RotateCcw size={16} /> Try again
          </button>
          <button onClick={() => onFinish(ratio)} className="btn-pop btn-primary flex-[2]">
            {done ? (
              <>
                Continue <ArrowRight size={16} />
              </>
            ) : (
              <>
                Collect +{xp} XP <AtomIcon size={15} /> +{p.atoms}
              </>
            )}
          </button>
        </div>
      </motion.div>
    );
  }

  const answered = picked !== null;
  const right = answered && picked === q.correctAnswer;

  return (
    <div className="space-y-5">
      {/* Question progress */}
      <div className="flex items-center gap-3">
        <span className="chip-ink !text-sm !py-1 shrink-0">
          Q{qi + 1}/{questions.length}
        </span>
        <div className="flex-1 flex gap-1.5">
          {questions.map((_, i) => (
            <span
              key={i}
              className="h-3 flex-1 rounded-full border-2 border-ink"
              style={{ background: i < qi || (i === qi && answered) ? "var(--primary)" : "var(--card)" }}
            />
          ))}
        </div>
        <span className="chip-ink !text-sm !py-1 shrink-0">
          <Star size={13} className="fill-[#f5c518]" /> {score}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={qi}
          initial={{ x: 40, opacity: 0, rotate: 1 }}
          animate={{ x: 0, opacity: 1, rotate: 0 }}
          exit={{ x: -40, opacity: 0, rotate: -1 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="sticker !rounded-[2rem] p-5 sm:p-7 space-y-5"
        >
          <p className="font-display font-bold text-[1.35rem] sm:text-[1.6rem] leading-snug">{q.question}</p>
          <div key={shakeKey} className={cn("grid gap-3", q.options.length > 2 && "sm:grid-cols-2", shakeKey > 0 && answered && !right && "shake")}>
            {q.options.map((opt, oi) => {
              const isRight = oi === q.correctAnswer;
              const state = !answered ? "" : isRight ? "answer-right" : oi === picked ? "answer-wrong" : "answer-dim";
              return (
                <button key={oi} disabled={answered} onClick={() => pick(oi)} className={cn("answer", state)}>
                  <span className="answer-letter" style={{ background: LETTER_BG[oi % LETTER_BG.length], color: "var(--ink)" }}>
                    {answered && isRight ? "✓" : answered && oi === picked ? "✗" : LETTERS[oi]}
                  </span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {answered && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-4">
            <HostSays host={host}>
              <span className="font-display font-bold text-lg block leading-tight mb-0.5">
                {right ? "Yes! That's right." : `Not quite. It's "${q.options[q.correctAnswer]}".`}
              </span>
              {q.explanation}
            </HostSays>
            <button onClick={next} className="btn-pop btn-primary w-full !py-4 text-lg">
              {qi < questions.length - 1 ? "Next question" : "See my score"} <ArrowRight size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExitCardBeat({
  beat,
  done,
  onSubmit,
  host,
}: {
  beat: LessonBeat;
  done: boolean;
  onSubmit: (reflection: string) => void;
  host: Host;
}) {
  const [learnt, setLearnt] = useState("");
  const [facts, setFacts] = useState("");
  const [question, setQuestion] = useState("");
  const canSubmit = done || (learnt.trim() && facts.trim() && question.trim());
  const p = pointsFor(beat);
  const fields = useMemo(
    () => [
      { n: 3, label: "things I learnt", value: learnt, set: setLearnt, placeholder: "1. …\n2. …\n3. …", rows: 3, bg: "var(--primary)" },
      { n: 2, label: "cool facts or connections", value: facts, set: setFacts, placeholder: "1. …\n2. …", rows: 2, bg: "var(--pop-2)" },
      { n: 1, label: "question I still have", value: question, set: setQuestion, placeholder: "I wonder…", rows: 2, bg: "var(--pop-3)" },
    ],
    [learnt, facts, question],
  );

  return (
    <div className="space-y-6">
      <HostSays host={host}>{beat.description}</HostSays>

      <div className="space-y-5">
        {fields.map(({ n, label, value, set, placeholder, rows, bg }, i) => (
          <div key={label} className="sticker !rounded-[1.6rem] p-4 sm:p-5" style={{ rotate: `${i === 1 ? 0.6 : -0.4}deg` }}>
            <label className="flex items-center gap-3 mb-2">
              <span
                className="w-11 h-11 rounded-2xl border-[2.5px] border-ink shadow-[0_3px_0_var(--ink-line)] flex items-center justify-center font-display font-bold text-2xl shrink-0"
                style={{ background: bg, color: n === 1 ? "#fff" : "var(--ink)" }}
              >
                {n}
              </span>
              <span className="font-display font-bold text-xl">{label}</span>
            </label>
            <textarea
              value={value}
              onChange={(e) => set(e.target.value)}
              disabled={done}
              rows={rows}
              className="paper-lined w-full px-3 rounded-xl border-2 border-dashed border-[color:var(--ink-line)]/30 text-[1rem] font-semibold resize-none disabled:opacity-70"
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => onSubmit(`3 things I learnt: ${learnt}\n2 interesting facts: ${facts}\n1 question I still have: ${question}`)}
        disabled={!canSubmit}
        className="btn-pop btn-primary w-full !py-4 text-lg"
      >
        {done ? (
          <>
            Continue <ArrowRight size={18} />
          </>
        ) : (
          <>
            <Sparkles size={18} /> Hand in my exit card
            <span className="flex items-center gap-1.5 text-sm opacity-90 ml-1">
              <Star size={14} className="fill-current" /> +{p.xp}
              <AtomIcon size={14} /> +{p.atoms}
            </span>
          </>
        )}
      </button>
      {!canSubmit && (
        <p className="text-center text-xs font-bold text-muted-foreground -mt-3">
          <MessageCircle size={12} className="inline -mt-0.5" /> Fill in all three boxes to hand it in.
        </p>
      )}
    </div>
  );
}
