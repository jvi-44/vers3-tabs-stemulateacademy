import { useCallback, useEffect, useRef, useState } from "react";
import { storyLineKey } from "./audioKey";
import type { Line, Speaker } from "./types";

// Read-aloud for episode lines. Every line is pre-recorded in its speaker's own
// voice (public/story-audio, made by scripts/story-voices), the same STEMbot
// voices as the lesson videos. A line without a recording (text edited since
// the last recording run) falls back to the browser's speech synthesis, using
// the most natural voice of the right gender the device has.

const AUDIO_BASE = "/story-audio/";
const SILENT = new Set<Speaker>(["you", "narrator"]);
const FEMALE = new Set<Speaker>(["sophia", "emily", "mission", "all"]);

// Gentle pitch and rate only: big shifts are what make browser voices sound robotic.
const SYNTH: Partial<Record<Speaker, { pitch: number; rate: number }>> = {
  sophia: { pitch: 1.1, rate: 1.05 },
  timothy: { pitch: 1.05, rate: 1.08 },
  emily: { pitch: 1.15, rate: 1.08 },
  matthew: { pitch: 0.95, rate: 1.02 },
  host: { pitch: 1.0, rate: 1.1 },
  system: { pitch: 0.7, rate: 0.95 },
  mission: { pitch: 1.0, rate: 1.05 },
  impostor: { pitch: 0.5, rate: 0.85 },
  all: { pitch: 1.1, rate: 1.05 },
};

const FEMALE_NAMES =
  /female|aria|jenny|sonia|libby|maisie|emma|michelle|samantha|karen|moira|tessa|serena|zira|hazel|susan|victoria|allison|ava|nicky|kate/i;
const MALE_NAMES =
  /male|guy|ryan|christopher|eric|andrew|brian|thomas|daniel|alex\b|fred|tom\b|oliver|arthur|david|mark|george|aaron|evan|nathan|rishi/i;
const NATURAL = /natural|neural|online|premium|enhanced|google/i;

function pickVoice(all: SpeechSynthesisVoice[], speaker: Speaker) {
  const female = FEMALE.has(speaker);
  const gender = female ? FEMALE_NAMES : MALE_NAMES;
  const ranked = all
    // "female" contains "male", so rule out the other gender's label explicitly.
    .filter((v) => v.lang.startsWith("en") && gender.test(v.name) && !(female ? /\bmale\b/i : /female/i).test(v.name))
    .sort((a, b) => Number(NATURAL.test(b.name)) - Number(NATURAL.test(a.name)));
  // Spread the bots across different voices where the device has several.
  const order: Speaker[] = female ? ["sophia", "emily", "mission", "all"] : ["timothy", "matthew", "host", "system", "impostor"];
  return ranked.length ? ranked[Math.max(0, order.indexOf(speaker)) % ranked.length] : undefined;
}

function speakable(text: string) {
  return text
    .replace(/…/g, "... ")
    .replace(/STEM/g, "Stem")
    .replace(/\b[A-Z][A-Z']+\b/g, (w) => (w === "MRT" || w === "OK" ? w : w[0] + w.slice(1).toLowerCase()));
}

let manifestPromise: Promise<Set<string>> | null = null;
function loadManifest() {
  manifestPromise ??= fetch(`${AUDIO_BASE}manifest.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((keys: string[]) => new Set(keys))
    .catch(() => new Set<string>());
  return manifestPromise;
}

export function useStoryVoice(enabled: boolean) {
  const [recorded, setRecorded] = useState<Set<string>>(new Set());
  const audio = useRef<HTMLAudioElement | null>(null);
  const token = useRef(0);
  const synth = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    let alive = true;
    loadManifest().then((s) => alive && setRecorded(s));
    return () => {
      alive = false;
    };
  }, []);

  const stop = useCallback(() => {
    token.current++;
    audio.current?.pause();
    if (synth) window.speechSynthesis.cancel();
  }, [synth]);

  useEffect(() => stop, [stop]);
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  /** Says a line; resolves when it finishes (or straight away if muted or silent). */
  const say = useCallback(
    (line: Line) =>
      new Promise<void>((resolve) => {
        stop();
        if (!enabled || SILENT.has(line.speaker)) return resolve();
        const id = token.current;
        const done = () => id === token.current && resolve();

        const fallback = () => {
          if (!synth || id !== token.current) return done();
          const u = new SpeechSynthesisUtterance(speakable(line.text));
          const s = SYNTH[line.speaker] ?? { pitch: 1, rate: 1 };
          u.pitch = s.pitch;
          u.rate = s.rate;
          const v = pickVoice(window.speechSynthesis.getVoices(), line.speaker);
          if (v) u.voice = v;
          u.onend = done;
          u.onerror = done;
          window.speechSynthesis.speak(u);
        };

        const key = storyLineKey(line.speaker, line.text);
        if (!recorded.has(key)) return fallback();
        const a = new Audio(`${AUDIO_BASE}${key}.mp3`);
        audio.current = a;
        a.onended = done;
        a.onerror = fallback;
        a.play().catch(fallback);
      }),
    [enabled, recorded, stop, synth],
  );

  return { say, stop };
}
