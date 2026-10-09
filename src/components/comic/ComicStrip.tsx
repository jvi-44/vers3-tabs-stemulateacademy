import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type TargetAndTransition } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play, Settings2, Volume2, X } from "lucide-react";
import { STEMBOTS } from "../../data/mock";
import type { ComicBubble, ComicCastMember, ComicPanel, ComicPose, ComicSpeaker, ComicStrip as ComicStripData } from "../../data/comicStrips";
import { ComicSceneArt } from "./ComicScenes";
import { VOICE_SPEAKERS, useComicVoices } from "./useComicVoices";
import { cn } from "../ui/utils";

const SPEAKER_LABEL: Record<ComicSpeaker, string> = {
  sophia: "Sophia",
  timothy: "Timothy",
  emily: "Emily",
  matthew: "Matthew",
  host: "Game Show Host",
  system: "System Message",
  mission: "Mission Control",
  impostor: "???",
  all: "All STEMbots",
};

// Bubble fill + name colour per speaker, matching each STEMbot's suit.
const SPEAKER_STYLE: Record<ComicSpeaker, { bubble: string; name: string }> = {
  sophia:   { bubble: "bg-[#eaffd6]", name: "text-emerald-700" },
  timothy:  { bubble: "bg-[#e0f0ff]", name: "text-blue-700" },
  emily:    { bubble: "bg-[#fff6e0]", name: "text-amber-700" },
  matthew:  { bubble: "bg-[#ffe4dc]", name: "text-red-700" },
  host:     { bubble: "bg-[#fff59e]", name: "text-purple-800" },
  system:   { bubble: "bg-[#0b1a12] text-[#7CFFB2] font-mono", name: "text-[#7CFFB2]" },
  mission:  { bubble: "bg-[#dff4ff]", name: "text-sky-800" },
  impostor: { bubble: "bg-[#2b1240] text-white", name: "text-fuchsia-300" },
  all:      { bubble: "bg-white", name: "text-primary" },
};

const SIZE_HEIGHT = { sm: "62%", md: "80%", lg: "100%" } as const;

const POSE_ANIM: Record<ComicPose, TargetAndTransition> = {
  idle: { y: [0, -2, 0], transition: { duration: 2.4, repeat: Infinity } },
  bounce: { y: [0, -8, 0], transition: { duration: 0.9, repeat: Infinity } },
  jump: { y: [0, -16, 0], transition: { duration: 0.7, repeat: Infinity, repeatDelay: 0.4 } },
  shake: { x: [0, -4, 4, -3, 3, 0], transition: { duration: 0.5, repeat: Infinity, repeatDelay: 0.6 } },
  tilt: { rotate: [-5, 5, -5], transition: { duration: 2, repeat: Infinity } },
};

/** Where along the bottom a speaker stands (0 = left edge, 1 = right edge). */
function speakerSlot(panel: ComicPanel, speaker: ComicSpeaker): number | null {
  const i = panel.cast.findIndex((c) => c.bot === speaker);
  if (i === -1) return null;
  return (i + 0.5) / panel.cast.length;
}

function CastMember({ member, castSize }: { member: ComicCastMember; castSize: number }) {
  const bot = STEMBOTS[member.bot];
  const pose = member.pose ?? "idle";
  return (
    <motion.img
      src={bot.avatar}
      alt={bot.name}
      draggable={false}
      animate={POSE_ANIM[pose]}
      style={{ height: SIZE_HEIGHT[member.size ?? "md"], maxWidth: `${Math.min(30, 94 / castSize)}%`, scaleX: member.flip ? -1 : 1 }}
      className="w-auto object-contain drop-shadow-[3px_4px_0_rgba(31,26,23,0.35)] select-none"
    />
  );
}

function Bubble({ bubble, panel, onSpeak }: { bubble: ComicBubble; panel: ComicPanel; onSpeak?: () => void }) {
  const slot = speakerSlot(panel, bubble.speaker);
  const align = slot === null ? "center" : slot < 0.4 ? "start" : slot > 0.6 ? "end" : "center";
  const style = SPEAKER_STYLE[bubble.speaker];
  const kind = bubble.kind ?? "speech";
  const isScreen = bubble.speaker === "system";
  // Off-panel voices (host, mission control, system) have no tail.
  const hasTail = slot !== null || bubble.speaker === "all";

  return (
    <motion.button
      type="button"
      onClick={onSpeak}
      initial={{ opacity: 0, scale: 0.85, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={cn(
        "relative max-w-[78%] text-left border-[3px] border-[#1f1a17] px-[2.4cqw] py-[1.4cqw] shadow-[3px_3px_0_#1f1a17] cursor-pointer",
        "text-[clamp(11px,3cqw,17px)] leading-snug text-[#1f1a17]",
        align === "start" && "self-start",
        align === "end" && "self-end",
        align === "center" && "self-center",
        isScreen ? "rounded-md" : kind === "thought" ? "rounded-[2em] border-dashed" : "rounded-[1.4em]",
        kind === "shout" && "font-black uppercase tracking-wide -rotate-1",
        style.bubble,
      )}
      title="Tap to hear this line"
    >
      <span className={cn("block text-[0.72em] font-black uppercase tracking-wider mb-0.5", style.name)}>
        {SPEAKER_LABEL[bubble.speaker]}
      </span>
      <span className="font-semibold">{bubble.text}</span>
      {hasTail && kind !== "thought" && (
        <span
          aria-hidden
          className={cn(
            "absolute -bottom-[9px] w-4 h-4 rotate-45 border-r-[3px] border-b-[3px] border-[#1f1a17]",
            align === "start" ? "left-6" : align === "end" ? "right-6" : "left-1/2 -translate-x-1/2",
            style.bubble,
          )}
        />
      )}
      {hasTail && kind === "thought" && (
        <span aria-hidden className={cn("absolute -bottom-3 flex gap-1", align === "end" ? "right-6" : "left-6")}>
          <span className={cn("w-2.5 h-2.5 rounded-full border-2 border-[#1f1a17]", style.bubble)} />
          <span className={cn("w-1.5 h-1.5 rounded-full border-2 border-[#1f1a17] mt-2", style.bubble)} />
        </span>
      )}
    </motion.button>
  );
}

function Panel({ panel, index, onSpeakBubble }: { panel: ComicPanel; index: number; onSpeakBubble: (b: ComicBubble) => void }) {
  return (
    <div className="@container relative w-full aspect-[4/5] sm:aspect-[4/3] overflow-hidden rounded-2xl border-4 border-[#1f1a17] bg-white shadow-[6px_6px_0_#1f1a17]">
      <ComicSceneArt scene={panel.scene} screen={panel.screen} />

      {/* Characters stand along the bottom */}
      <div className="absolute inset-x-0 bottom-[3%] h-[50%] flex items-end justify-evenly px-[3%] pointer-events-none">
        {panel.cast.map((m, i) => (
          <CastMember key={`${m.bot}-${i}`} member={m} castSize={panel.cast.length} />
        ))}
      </div>

      {/* Sound effect lettering */}
      {panel.sfx && (
        <motion.span
          initial={{ scale: 0.4, opacity: 0, rotate: -14 }}
          animate={{ scale: 1, opacity: 1, rotate: -8 }}
          transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.15 }}
          className="absolute right-[4%] bottom-[4%] z-20 font-black text-[clamp(14px,5cqw,30px)] text-[#ffd84d] [-webkit-text-stroke:2px_#1f1a17] [paint-order:stroke] drop-shadow-[3px_3px_0_#1f1a17] pointer-events-none"
        >
          {panel.sfx}
        </motion.span>
      )}

      {/* Caption + speech bubbles */}
      <div className="absolute inset-x-0 top-0 z-10 flex flex-col gap-[2.2cqw] p-[3cqw] max-h-[78%]">
        {panel.caption && (
          <p className="self-start max-w-[85%] bg-[#ffe14d] border-[3px] border-[#1f1a17] px-[2cqw] py-[1cqw] text-[clamp(10px,2.6cqw,15px)] font-bold italic text-[#1f1a17] shadow-[3px_3px_0_#1f1a17]">
            {panel.caption}
          </p>
        )}
        {panel.bubbles.map((b, i) => (
          <Bubble key={i} bubble={b} panel={panel} onSpeak={() => onSpeakBubble(b)} />
        ))}
      </div>

      <span className="absolute left-2 bottom-2 z-20 bg-white border-2 border-[#1f1a17] rounded-full px-2 text-[11px] font-black text-[#1f1a17]">
        {index + 1}
      </span>
    </div>
  );
}

function VoiceSettings({ voicesApi, onClose }: { voicesApi: ReturnType<typeof useComicVoices>; onClose: () => void }) {
  const { voices, setVoice, systemVoices, speak } = voicesApi;
  return (
    <div className="bg-card border-2 border-border rounded-2xl p-4 shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-black text-foreground">Character voices</p>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent" aria-label="Close voice settings">
          <X size={16} />
        </button>
      </div>
      {VOICE_SPEAKERS.map((s) => (
        <div key={s} className="flex flex-wrap items-center gap-2">
          <span className={cn("w-32 text-sm font-bold", SPEAKER_STYLE[s].name, s === "system" && "text-emerald-600")}>{SPEAKER_LABEL[s]}</span>
          <select
            value={voices[s].voiceURI}
            onChange={(e) => setVoice(s, { voiceURI: e.target.value })}
            className="flex-1 min-w-0 text-sm bg-input-background border border-border rounded-lg px-2 py-1"
          >
            <option value="">Default voice</option>
            {systemVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            Pitch
            <input
              type="range"
              min={0.2}
              max={2}
              step={0.05}
              value={voices[s].pitch}
              onChange={(e) => setVoice(s, { pitch: Number(e.target.value) })}
              className="w-20 accent-[var(--primary)]"
            />
          </label>
          <button
            onClick={() => speak([{ speaker: s, text: `Hi! I'm ${SPEAKER_LABEL[s]}.` }])}
            className="p-1.5 rounded-lg bg-accent hover:opacity-80"
            aria-label={`Test ${SPEAKER_LABEL[s]}'s voice`}
          >
            <Volume2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ComicStrip({ strip, onFinished }: { strip: ComicStripData; onFinished?: () => void }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [showVoices, setShowVoices] = useState(false);
  const voicesApi = useComicVoices();
  const { speak, stop, supported } = voicesApi;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const total = strip.panels.length;
  const panel = strip.panels[index];
  const isLast = index === total - 1;

  // A new strip (different lesson) starts from the first panel.
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
    stop();
  }, [strip, stop]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= total) return;
      setDirection(next > index ? 1 : -1);
      setIndex(next);
    },
    [index, total],
  );

  // Story mode: read the panel aloud, then turn the page.
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    (async () => {
      const finished = supported ? await speak(panel.bubbles) : await new Promise<boolean>((r) => setTimeout(() => r(true), 4000));
      if (cancelled || !finished || !playingRef.current) return;
      await new Promise((r) => setTimeout(r, 700));
      if (cancelled || !playingRef.current) return;
      if (index < total - 1) {
        setDirection(1);
        setIndex(index + 1);
      } else {
        setPlaying(false);
        onFinished?.();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playing, index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") { stop(); setPlaying(false); goTo(index + 1); }
      if (e.key === "ArrowLeft") { stop(); setPlaying(false); goTo(index - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, stop]);

  const manualNav = (next: number) => {
    stop();
    setPlaying(false);
    goTo(next);
  };

  const togglePlay = () => {
    if (playing) {
      stop();
      setPlaying(false);
    } else {
      if (isLast) setIndex(0);
      setPlaying(true);
    }
  };

  return (
    <section aria-label={`${strip.title} comic`} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Intro Comic</p>
          <h2 className="text-xl font-black text-foreground truncate">{strip.title}</h2>
        </div>
        <button
          onClick={togglePlay}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-sm hover:opacity-90"
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
          {playing ? "Pause" : supported ? "Read to me" : "Auto-play"}
        </button>
        {supported && (
          <button
            onClick={() => setShowVoices((v) => !v)}
            className={cn("p-2 rounded-xl border-2 border-border hover:bg-accent", showVoices && "bg-accent")}
            aria-label="Character voices"
            title="Character voices"
          >
            <Settings2 size={16} />
          </button>
        )}
      </div>

      {showVoices && <VoiceSettings voicesApi={voicesApi} onClose={() => setShowVoices(false)} />}

      <div className="relative">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={index}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40, rotate: direction * 1.5 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: direction * -40, rotate: direction * -1.5 }}
            transition={{ duration: 0.25 }}
          >
            <Panel panel={panel} index={index} onSpeakBubble={(b) => { setPlaying(false); speak([b]); }} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => manualNav(index - 1)}
          disabled={index === 0}
          className="p-2.5 rounded-xl border-2 border-[#1f1a17] bg-card shadow-[2px_2px_0_#1f1a17] disabled:opacity-30"
          aria-label="Previous panel"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 flex flex-wrap justify-center gap-1.5">
          {strip.panels.map((_, i) => (
            <button
              key={i}
              onClick={() => manualNav(i)}
              aria-label={`Go to panel ${i + 1}`}
              className={cn(
                "h-2.5 rounded-full transition-all border border-[#1f1a17]/40",
                i === index ? "w-6 bg-primary" : i < index ? "w-2.5 bg-primary/50" : "w-2.5 bg-accent",
              )}
            />
          ))}
        </div>
        <button
          onClick={() => manualNav(index + 1)}
          disabled={isLast}
          className="p-2.5 rounded-xl border-2 border-[#1f1a17] bg-card shadow-[2px_2px_0_#1f1a17] disabled:opacity-30"
          aria-label="Next panel"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Panel {index + 1} of {total} · tap a speech bubble to hear it
      </p>
    </section>
  );
}
