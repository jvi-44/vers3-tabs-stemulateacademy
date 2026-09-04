import { useState } from "react";
import { Lock, Gamepad2, Star, RotateCcw } from "lucide-react";
import { GAME_LESSONS, type LessonBeat } from "../data/lessonContent";
import { cn } from "./ui/utils";

function AtomIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
    </svg>
  );
}

const REPLAY_XP = 10;
const REPLAY_ATOMS = 5;

export function GamesTab({
  completedBeats,
  onOpenBeat,
  onReplay,
}: {
  completedBeats: Record<string, boolean>;
  onOpenBeat: (lessonId: string, beatId: string) => void;
  onReplay: (amountXp: number, amountAtoms: number) => void;
}) {
  const [justPlayed, setJustPlayed] = useState<string | null>(null);

  const games: { lesson: (typeof GAME_LESSONS)[number]; beat: LessonBeat }[] = [];
  GAME_LESSONS.forEach((lesson) => {
    lesson.beats
      .filter((b) => b.type === "simulation")
      .forEach((beat) => games.push({ lesson, beat }));
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-black text-foreground flex items-center gap-2">
          <Gamepad2 className="text-primary" /> Games
        </h2>
        <p className="text-sm text-muted-foreground">
          Every game from every lesson, all in one place. Complete a lesson to unlock its game — after
          that, replay it anytime for a smaller top-up of {REPLAY_XP} XP + {REPLAY_ATOMS} Atoms.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {games.map(({ lesson, beat }) => {
          const lessonDone = lesson.beats.every((b) => completedBeats[b.id]);
          const unlocked = lessonDone || completedBeats[beat.id];
          return (
            <div
              key={beat.id}
              className={cn(
                "relative rounded-3xl border shadow-sm p-5 bg-card transition-all",
                unlocked ? "border-border" : "border-border opacity-90",
              )}
            >
              {!unlocked && (
                <div className="absolute inset-0 bg-card/85 backdrop-blur-[2px] rounded-3xl flex flex-col items-center justify-center gap-2 z-10">
                  <div className="w-11 h-11 rounded-2xl bg-accent flex items-center justify-center text-muted-foreground">
                    <Lock size={20} />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground text-center px-4">
                    Complete "{lesson.title}" to unlock
                  </p>
                </div>
              )}
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{lesson.title}</p>
              <h3 className="font-bold text-foreground mt-0.5">{beat.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{beat.description}</p>
              <div className="flex items-center justify-between mt-4">
                <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                  <Star size={12} className="fill-amber-500 text-amber-500" /> {REPLAY_XP} XP
                  <AtomIcon size={12} /> {REPLAY_ATOMS}
                </span>
                <button
                  onClick={() => {
                    if (!completedBeats[beat.id]) {
                      onOpenBeat(lesson.id, beat.id);
                    } else {
                      onReplay(REPLAY_XP, REPLAY_ATOMS);
                      setJustPlayed(beat.id);
                      setTimeout(() => setJustPlayed(null), 1200);
                    }
                  }}
                  disabled={!unlocked}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
                >
                  <RotateCcw size={13} />
                  {completedBeats[beat.id] ? (justPlayed === beat.id ? "Nice!" : "Play Again") : "Play"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
