import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Flag,
  BookOpen,
  Play,
  HelpCircle,
  Gamepad2,
  PenLine,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Star,
} from "lucide-react";
import { cn } from "./ui/utils";
import type { GameLesson, LessonBeat } from "../data/lessonContent";
import { pointsFor } from "../data/lessonContent";
import { SpeechBubbles } from "./SpeechBubble";
import { AskStembots } from "./AskStembots";
import { LessonGame } from "../games/LessonGame";

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

function iconFor(beat: LessonBeat) {
  if (beat.type === "intro") return { icon: <BookOpen size={16} />, num: 1, color: "bg-rose-500" };
  if (beat.type === "video" && beat.subject === "science")
    return { icon: <Play size={16} />, num: 2, color: "bg-emerald-500" };
  if (beat.type === "quiz") return { icon: <HelpCircle size={16} />, num: 3, color: "bg-amber-500" };
  if (beat.type === "video" && beat.subject === "math")
    return { icon: <Play size={16} />, num: 4, color: "bg-sky-500" };
  if (beat.type === "simulation") return { icon: <Gamepad2 size={16} />, num: 5, color: "bg-purple-500" };
  return { icon: <PenLine size={16} />, num: 6, color: "bg-slate-500" };
}

function PointsBadges({ beat }: { beat: LessonBeat }) {
  const p = pointsFor(beat);
  const xpLabel = beat.type === "quiz" ? "50–100" : p.xp ? String(p.xp) : null;
  return (
    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
      {xpLabel && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-full">
          <Star size={9} className="fill-amber-500 text-amber-500" /> {xpLabel} XP
        </span>
      )}
      {!!p.atoms && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 px-1.5 py-0.5 rounded-full">
          <AtomIcon size={9} className="text-sky-500" /> {p.atoms}
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

export function GameLessonExplorer({
  lessons,
  completedBeats,
  onOpenBeat,
  highlightBeatId,
}: {
  lessons: GameLesson[];
  completedBeats: Record<string, boolean>;
  onOpenBeat: (lessonId: string, beatId: string) => void;
  highlightBeatId?: string | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(lessons[0]?.id ?? null);

  return (
    <div className="space-y-4">
      {lessons.map((lesson) => {
        const doneCount = lesson.beats.filter((b) => completedBeats[b.id]).length;
        const pct = Math.round((doneCount / lesson.beats.length) * 100);
        const isOpen = expanded === lesson.id;
        const status = doneCount === 0 ? "Not started" : doneCount === lesson.beats.length ? "Completed" : "In progress";
        const statusColor =
          doneCount === 0
            ? "text-muted-foreground"
            : doneCount === lesson.beats.length
              ? "text-emerald-600"
              : "text-amber-600";
        return (
          <div
            key={lesson.id}
            className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden"
          >
            <div className="w-full flex items-center gap-4 p-5">
              <button
                onClick={() => setExpanded(isOpen ? null : lesson.id)}
                className="flex items-center gap-4 flex-1 min-w-0 text-left"
              >
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center text-white shrink-0 shadow-md">
                  <Flag size={20} fill="white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {lesson.flagLabel}
                  </p>
                  <h4 className="font-bold text-foreground leading-tight truncate">{lesson.title}</h4>
                  <p className="text-xs text-muted-foreground truncate">{lesson.blurb}</p>
                </div>
              </button>
              <div className="hidden sm:flex flex-col items-end gap-1 w-28 shrink-0">
                <div className="w-full h-1.5 bg-accent rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className={cn("text-[10px] font-bold", statusColor)}>{status}</span>
              </div>
              <button
                onClick={() => onOpenBeat(lesson.id, firstIncompleteBeat(lesson, completedBeats).id)}
                className="hidden md:flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl bg-primary text-primary-foreground shrink-0 hover:opacity-90"
              >
                {doneCount === 0 ? "Start Lesson" : doneCount === lesson.beats.length ? "Review" : "Continue"}
                <ArrowRight size={13} />
              </button>
              <button onClick={() => setExpanded(isOpen ? null : lesson.id)} className="shrink-0">
                {isOpen ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
              </button>
            </div>
            <div className="px-5 pb-3 sm:hidden flex items-center justify-between gap-3">
              <div className="flex-1 h-1.5 bg-accent rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className={cn("text-[10px] font-bold shrink-0", statusColor)}>{status}</span>
              <button
                onClick={() => onOpenBeat(lesson.id, firstIncompleteBeat(lesson, completedBeats).id)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-primary text-primary-foreground shrink-0"
              >
                {doneCount === 0 ? "Start" : "Continue"}
              </button>
            </div>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-border/60">
                    {lesson.beats.map((beat) => {
                      const done = !!completedBeats[beat.id];
                      const meta = iconFor(beat);
                      const highlighted = highlightBeatId === beat.id;
                      return (
                        <button
                          key={beat.id}
                          onClick={() => onOpenBeat(lesson.id, beat.id)}
                          className={cn(
                            "flex items-start gap-3 p-3 mt-2 rounded-2xl transition-all text-left",
                            highlighted ? "ring-2 ring-primary bg-accent/50" : "hover:bg-accent/40",
                          )}
                        >
                          <div
                            className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5",
                              done ? "bg-emerald-500" : meta.color,
                            )}
                          >
                            {done ? <CheckCircle2 size={16} /> : meta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{beat.title}</p>
                            <PointsBadges beat={beat} />
                          </div>
                        </button>
                      );
                    })}
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
// Beat Player — full-screen player for a single beat within a lesson
// ---------------------------------------------------------------------------

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
  const activeBeat = lesson.beats.find((b) => b.id === activeBeatId) ?? lesson.beats[0];
  const idx = lesson.beats.findIndex((b) => b.id === activeBeat.id);
  const doneCount = lesson.beats.filter((b) => completedBeats[b.id]).length;
  const pct = Math.round((doneCount / lesson.beats.length) * 100);

  const goNext = () => {
    if (idx < lesson.beats.length - 1) onSelectBeat(lesson.beats[idx + 1].id);
    else onBack();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Left: lesson nav sidebar */}
      <aside className="w-full md:w-72 shrink-0 bg-card border-r border-border md:h-screen md:sticky md:top-0 overflow-y-auto">
        <div className="p-6 border-b border-border">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-4 text-sm font-bold"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <h2 className="text-lg font-black text-foreground leading-tight">{lesson.title}</h2>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-primary">{pct}%</span>
          </div>
        </div>
        <nav className="p-4 space-y-1.5">
          {lesson.beats.map((beat) => {
            const done = !!completedBeats[beat.id];
            const meta = iconFor(beat);
            const active = beat.id === activeBeat.id;
            return (
              <button
                key={beat.id}
                onClick={() => onSelectBeat(beat.id)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-all",
                  active ? "bg-accent shadow-sm" : "hover:bg-accent/50",
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5",
                    done ? "bg-emerald-500" : meta.color,
                  )}
                >
                  {done ? <CheckCircle2 size={16} /> : meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-bold truncate", active ? "text-primary" : "text-foreground")}>
                    {beat.title}
                  </p>
                  <PointsBadges beat={beat} />
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Centre: main content */}
      <main className="flex-1 min-w-0 p-6 md:p-10 pb-24 md:pb-10 overflow-x-hidden">
        <div className={cn("mx-auto space-y-5", activeBeat.type === "simulation" ? "max-w-5xl" : "max-w-2xl")}>
          {/* Dialogue / speech bubbles */}
          {activeBeat.dialogue && activeBeat.dialogue.length > 0 && (
            <SpeechBubbles lines={activeBeat.dialogue} />
          )}
          <BeatContent beat={activeBeat} done={!!completedBeats[activeBeat.id]} onComplete={onComplete} onNext={goNext} />
        </div>
      </main>

      {/* Right: expandable Gemini chatbot panel */}
      <AskStembots beat={activeBeat} open={chatOpen} onToggle={() => setChatOpen((v) => !v)} />
    </div>
  );
}

function BeatContent({
  beat,
  done,
  onComplete,
  onNext,
}: {
  beat: LessonBeat;
  done: boolean;
  onComplete: (beat: LessonBeat, scoreRatio?: number, reflection?: string) => void;
  onNext: () => void;
}) {
  const markAndNext = (scoreRatio?: number, reflection?: string) => {
    if (!done) onComplete(beat, scoreRatio, reflection);
    onNext();
  };

  if (beat.type === "intro") {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-rose-400 to-orange-400 rounded-3xl p-8 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2">Intro Story</p>
          <h2 className="text-2xl font-black mb-3">{beat.title}</h2>
          <p className="leading-relaxed font-medium opacity-95">{beat.description}</p>
        </div>
        <button
          onClick={() => markAndNext()}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-md hover:opacity-90 transition-all"
        >
          Continue the Story
        </button>
      </div>
    );
  }

  if (beat.type === "video") {
    const p = pointsFor(beat);
    return (
      <div className="space-y-6">
        <div className="aspect-video w-full bg-slate-900 rounded-3xl overflow-hidden shadow-lg relative flex items-center justify-center">
          <button className="w-20 h-20 bg-white/90 text-primary rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-all">
            <Play size={32} fill="currentColor" className="ml-1" />
          </button>
          {beat.duration && (
            <span className="absolute bottom-4 right-4 text-white text-xs font-bold bg-black/50 px-2 py-1 rounded-lg">
              {beat.duration}
            </span>
          )}
        </div>
        <div className="bg-card rounded-3xl p-6 border border-border shadow-sm">
          <h2 className="text-xl font-black text-foreground mb-1">{beat.title}</h2>
          <p className="text-sm text-muted-foreground mb-4">{beat.description}</p>
          <button
            onClick={() => markAndNext()}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-2xl font-bold hover:opacity-90 transition-all shadow-md flex items-center justify-center gap-2"
          >
            {done ? "Continue" : (
              <>
                Mark Watched
                <span className="flex items-center gap-1 text-sm opacity-90">
                  <Star size={13} className="fill-white" /> +{p.xp} XP
                  <AtomIcon size={13} className="text-white" /> +{p.atoms}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (beat.type === "quiz") {
    return <QuizBeat beat={beat} done={done} onSubmit={markAndNext} />;
  }

  if (beat.type === "simulation") {
    return <LessonGame key={beat.id} beatId={beat.id} done={done} onContinue={(score) => markAndNext(score / 100)} />;
  }

  // exit card
  return <ExitCardBeat beat={beat} done={done} onSubmit={(text) => markAndNext(undefined, text)} />;
}

function AtomIcon2({ size = 13, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
    </svg>
  );
}

function QuizBeat({
  beat,
  done,
  onSubmit,
}: {
  beat: LessonBeat;
  done: boolean;
  onSubmit: (scoreRatio: number) => void;
}) {
  const questions = beat.quizQuestions ?? [];
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(done);
  const p = pointsFor(beat);

  const correctCount = questions.reduce(
    (acc, q, i) => acc + (answers[i] === q.correctAnswer ? 1 : 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
          <Star size={30} className="fill-amber-600" />
        </div>
        <h2 className="text-2xl font-black text-foreground">{beat.title}</h2>
      </div>

      <div className="space-y-5">
        {questions.map((q, qi) => (
          <div key={qi} className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-3">
            <p className="font-bold text-foreground">
              {qi + 1}. {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const selected = answers[qi] === oi;
                const showResult = submitted;
                const isCorrect = oi === q.correctAnswer;
                return (
                  <button
                    key={oi}
                    disabled={submitted}
                    onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                    className={cn(
                      "w-full p-3.5 rounded-2xl text-left font-semibold border transition-all",
                      showResult && isCorrect && "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
                      showResult && selected && !isCorrect && "border-rose-400 bg-rose-50 dark:bg-rose-500/10",
                      !showResult && selected && "border-primary bg-accent",
                      !showResult && !selected && "border-border hover:border-primary/50",
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {submitted && q.explanation && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-700 rounded-2xl px-4 py-3"
              >
                <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-0.5">Explanation</p>
                <p className="text-sm text-blue-900 dark:text-blue-300 leading-snug">{q.explanation}</p>
              </motion.div>
            )}
          </div>
        ))}
      </div>

      {!submitted ? (
        <button
          onClick={() => setSubmitted(true)}
          disabled={Object.keys(answers).length < questions.length}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-md disabled:opacity-40 transition-all"
        >
          Submit Quiz
        </button>
      ) : (
        <button
          onClick={() => onSubmit(questions.length ? correctCount / questions.length : 1)}
          className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-md transition-all flex items-center justify-center gap-2"
        >
          {done ? "Continue" : (
            <>
              Got {correctCount}/{questions.length} right — Continue
              <span className="flex items-center gap-1 text-sm opacity-90">
                <Star size={13} className="fill-white" /> +{p.xp}
                <AtomIcon2 size={13} className="text-white" /> +{p.atoms}
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

function ExitCardBeat({
  beat,
  done,
  onSubmit,
}: {
  beat: LessonBeat;
  done: boolean;
  onSubmit: (reflection: string) => void;
}) {
  const [learnt, setLearnt] = useState("");
  const [facts, setFacts] = useState("");
  const [question, setQuestion] = useState("");
  const canSubmit = done || (learnt.trim() && facts.trim() && question.trim());
  const p = pointsFor(beat);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl flex items-center justify-center mx-auto">
          <PenLine size={28} />
        </div>
        <h2 className="text-2xl font-black text-foreground">{beat.title}</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">{beat.description}</p>
      </div>

      <div className="bg-card rounded-3xl p-6 border border-border shadow-sm space-y-5">
        {[
          { label: "3 things I learnt", value: learnt, set: setLearnt, placeholder: "1. ... 2. ... 3. ...", rows: 3 },
          { label: "2 interesting facts or connections", value: facts, set: setFacts, placeholder: "1. ... 2. ...", rows: 2 },
          { label: "1 question I still have", value: question, set: setQuestion, placeholder: "?", rows: 2 },
        ].map(({ label, value, set, placeholder, rows }) => (
          <div key={label}>
            <label className="text-sm font-bold text-foreground mb-1.5 block">{label}</label>
            <textarea
              value={value}
              onChange={(e) => set(e.target.value)}
              disabled={done}
              rows={rows}
              className="w-full p-3 rounded-2xl border border-border bg-input-background focus:ring-2 focus:ring-primary/40 outline-none text-sm"
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => onSubmit(`3 things I learnt: ${learnt}\n2 interesting facts: ${facts}\n1 question I still have: ${question}`)}
        disabled={!canSubmit}
        className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-md disabled:opacity-40 transition-all flex items-center justify-center gap-2"
      >
        {done ? "Continue" : (
          <>
            Submit Reflection
            <span className="flex items-center gap-1 text-sm opacity-90">
              <Star size={13} className="fill-white" /> +{p.xp}
              <AtomIcon2 size={13} className="text-white" /> +{p.atoms}
            </span>
          </>
        )}
      </button>
    </div>
  );
}
