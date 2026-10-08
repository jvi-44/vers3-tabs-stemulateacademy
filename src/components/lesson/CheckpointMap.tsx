// A winding treasure-map trail of a lesson's checkpoints. Finished stretches
// of the trail are painted in; the rest is a dotted line. A pin with the
// learner's avatar marks where they are now.
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { GameLesson } from "../../data/lessonContent";
import { pointsFor } from "../../data/lessonContent";
import { BEAT_KIND, BeatGlyph, FinishGlyph, LESSON_ART, SceneryItem } from "./LessonArt";
import { cn } from "../ui/utils";

type Pt = { x: number; y: number; row: number; col: number };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const ROW_H = 168;
const TOP = 74;

function layout(count: number, width: number) {
  const cols = width >= 900 ? 5 : width >= 660 ? 4 : width >= 440 ? 3 : 2;
  const padX = width >= 660 ? 78 : 52;
  const span = Math.max(1, width - padX * 2);
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const k = i % cols;
    const col = row % 2 === 0 ? k : cols - 1 - k;
    const x = padX + (cols === 1 ? span / 2 : (col * span) / (cols - 1));
    const y = TOP + row * ROW_H + (col % 2 ? 16 : -4);
    pts.push({ x, y, row, col });
  }
  const rows = Math.ceil(count / cols);
  return { pts, cols, height: TOP + (rows - 1) * ROW_H + 112 };
}

function segment(a: Pt, b: Pt, i: number, width: number) {
  if (a.row !== b.row) {
    // U-turn round the edge of the map.
    const dir = a.x > width / 2 ? 1 : -1;
    const bulge = 64 * dir;
    return `M${a.x},${a.y} C${a.x + bulge},${a.y + 6} ${b.x + bulge},${b.y - 6} ${b.x},${b.y}`;
  }
  const mx = (a.x + b.x) / 2;
  const wave = i % 2 ? 26 : -26;
  return `M${a.x},${a.y} C${mx},${a.y + wave} ${mx},${b.y - wave} ${b.x},${b.y}`;
}

export function CheckpointMap({
  lesson,
  completedBeats,
  onOpenBeat,
  avatar,
  highlightBeatId,
}: {
  lesson: GameLesson;
  completedBeats: Record<string, boolean>;
  onOpenBeat: (beatId: string) => void;
  avatar?: string;
  highlightBeatId?: string | null;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const beats = lesson.beats;
  const allDone = beats.every((b) => completedBeats[b.id]);
  const currentIdx = allDone ? beats.length : beats.findIndex((b) => !completedBeats[b.id]);
  const { pts, cols, height } = useMemo(() => layout(beats.length + 1, width || 900), [beats.length, width]);
  const scenery = LESSON_ART[lesson.id]?.scenery ?? "blocks";

  // Scenery sits under the trail, halfway between two checkpoints, where
  // there are no labels.
  const decor = useMemo(() => {
    const items: { x: number; y: number; s: number; r: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (a.row !== b.row || i % 2 === 1) continue;
      items.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 58, s: 30 + (i % 3) * 5, r: ((i * 7) % 20) - 10 });
    }
    return items;
  }, [pts]);

  return (
    <div ref={ref} className="map-paper relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <>
          {decor.map((d, i) => (
            <div
              key={i}
              className="absolute pointer-events-none opacity-80"
              style={{ left: d.x - d.s / 2, top: d.y - d.s / 2, width: d.s, height: d.s, transform: `rotate(${d.r}deg)` }}
              aria-hidden="true"
            >
              <SceneryItem kind={scenery} i={i} />
            </div>
          ))}

          <svg className="absolute inset-0 pointer-events-none" width={width} height={height} aria-hidden="true">
            {/* Soft road under the trail */}
            {pts.slice(1).map((p, i) => (
              <path key={`road-${i}`} d={segment(pts[i], p, i, width)} className="map-road" />
            ))}
            {/* Dotted trail still to walk */}
            {pts.slice(1).map((p, i) =>
              completedBeats[beats[i]?.id] ? null : (
                <path key={`dot-${i}`} d={segment(pts[i], p, i, width)} className="map-dots" />
              ),
            )}
            {/* Painted trail already walked */}
            {pts.slice(1).map((p, i) =>
              completedBeats[beats[i]?.id] ? (
                <g key={`done-${i}`}>
                  <path d={segment(pts[i], p, i, width)} className="map-done-ink" />
                  <path d={segment(pts[i], p, i, width)} className="map-done" />
                </g>
              ) : null,
            )}
          </svg>

          {/* Start flag (the "you're here" pin takes its place on a fresh map) */}
          {currentIdx !== 0 && <div
            className="absolute chip-ink !text-[11px] !py-1 !px-2.5 bg-pop-2 !text-[#1b1b12] rotate-[-6deg] pointer-events-none"
            style={{ left: 12, top: 12 }}
          >
            Start
          </div>}

          {beats.map((beat, i) => {
            const p = pts[i];
            const done = !!completedBeats[beat.id];
            const current = i === currentIdx;
            const highlighted = highlightBeatId === beat.id;
            const k = BEAT_KIND[beat.type];
            const pts_ = pointsFor(beat);
            const size = current ? 66 : 56;
            const labelW = Math.min(150, (width - 40) / cols);
            return (
              <div key={beat.id} className="absolute" style={{ left: p.x, top: p.y }}>
                {current && (
                  <motion.div
                    className="map-pin"
                    initial={{ y: -14, opacity: 0 }}
                    animate={{ y: [0, -6, 0], opacity: 1 }}
                    transition={{ y: { repeat: Infinity, duration: 2.2, ease: "easeInOut" }, opacity: { duration: 0.3 } }}
                    aria-hidden="true"
                  >
                    <span className="map-pin-head">
                      {avatar ? <img src={avatar} alt="" /> : <span className="text-lg">★</span>}
                    </span>
                    <span className="map-pin-tag">You're here!</span>
                  </motion.div>
                )}
                <button
                  onClick={() => onOpenBeat(beat.id)}
                  className={cn("map-node", current && "map-node-current", highlighted && "map-node-highlight")}
                  style={{ width: size, height: size }}
                  aria-label={`Checkpoint ${i + 1}: ${beat.title}${done ? " (done)" : ""}`}
                >
                  <BeatGlyph beat={beat} size={size} done={done} filled={done || current} />
                  <span className="map-node-num">{i + 1}</span>
                </button>
                <div className="map-label" style={{ width: labelW }}>
                  <span className="map-label-kind" style={{ background: k.bg, color: k.fg }}>
                    {k.label}
                  </span>
                  <span className="map-label-title">{beat.title}</span>
                  {!!pts_.xp && <span className="map-label-xp">+{beat.type === "quiz" ? "50–100" : pts_.xp} XP</span>}
                </div>
              </div>
            );
          })}

          {/* Finish: the treasure at the end of the trail */}
          {(() => {
            const p = pts[beats.length];
            return (
              <div className="absolute" style={{ left: p.x, top: p.y }}>
                <div className={cn("map-node map-finish", allDone && "map-node-current")} style={{ width: 60, height: 60 }}>
                  <FinishGlyph size={60} done={allDone} />
                </div>
                <div className="map-label" style={{ width: 140 }}>
                  <span className="map-label-title">{allDone ? "Lesson complete!" : "Finish line"}</span>
                  <span className="map-label-xp">{allDone ? "Game unlocked in Games" : "Unlocks the live game"}</span>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

/** Compact vertical trail for the lesson player's sidebar. */
export function CheckpointTrail({
  lesson,
  completedBeats,
  activeBeatId,
  onSelect,
}: {
  lesson: GameLesson;
  completedBeats: Record<string, boolean>;
  activeBeatId: string;
  onSelect: (beatId: string) => void;
}) {
  return (
    <ol className="trail">
      {lesson.beats.map((beat, i) => {
        const done = !!completedBeats[beat.id];
        const active = beat.id === activeBeatId;
        const nextDone = done && i < lesson.beats.length - 1;
        const k = BEAT_KIND[beat.type];
        return (
          <li key={beat.id} className={cn("trail-step", nextDone && "trail-step-done")}>
            <button
              onClick={() => onSelect(beat.id)}
              className={cn("trail-btn", active && "trail-btn-active")}
              aria-current={active ? "step" : undefined}
            >
              <BeatGlyph beat={beat} size={active ? 42 : 36} done={done} filled={done || active} />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] opacity-70">
                  {i + 1} · {k.label}
                </span>
                <span className="block font-display font-semibold text-[0.92rem] leading-tight truncate">{beat.title}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
