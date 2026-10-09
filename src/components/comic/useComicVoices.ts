import { useCallback, useEffect, useRef, useState } from "react";
import type { ComicBubble, ComicSpeaker } from "../../data/comicStrips";
import { comicLineKey } from "../../data/comicAudioKey";

// Read-aloud for comic bubbles. Every line is pre-recorded in its STEMbot's own
// voice (public/comic-audio, made by scripts/comic-voices), the same voices as
// the lesson videos. A line without a recording (e.g. text edited since the
// last recording run) falls back to the browser's speech synthesis, using the
// most natural voice of the right gender the device has.

export interface SpeakerVoice {
  pitch: number;
  rate: number;
  /** `SpeechSynthesisVoice.voiceURI` chosen by the user; empty = picked automatically. */
  voiceURI: string;
}

export const VOICE_SPEAKERS: ComicSpeaker[] = ["sophia", "timothy", "emily", "matthew", "host", "system", "mission"];

const FEMALE = new Set<ComicSpeaker>(["sophia", "emily", "mission"]);

// Gentle pitch/rate only: big pitch shifts are what make browser voices sound robotic.
const DEFAULT_VOICES: Record<ComicSpeaker, SpeakerVoice> = {
  sophia:   { pitch: 1.1,  rate: 1.05, voiceURI: "" },
  timothy:  { pitch: 1.05, rate: 1.08, voiceURI: "" },
  emily:    { pitch: 1.15, rate: 1.08, voiceURI: "" },
  matthew:  { pitch: 0.95, rate: 1.02, voiceURI: "" },
  host:     { pitch: 1.0,  rate: 1.1,  voiceURI: "" },
  system:   { pitch: 0.7,  rate: 0.95, voiceURI: "" },
  mission:  { pitch: 1.0,  rate: 1.05, voiceURI: "" },
  impostor: { pitch: 0.5,  rate: 0.85, voiceURI: "" },
  all:      { pitch: 1.1,  rate: 1.05, voiceURI: "" },
};

const STORAGE_KEY = "stemulate.comicVoices.v2";
const AUDIO_BASE = "/comic-audio/";

const FEMALE_NAMES = /female|aria|jenny|ana\b|sonia|libby|maisie|emma|michelle|samantha|karen|moira|tessa|serena|zira|hazel|susan|victoria|allison|ava|nicky|kate/i;
const MALE_NAMES = /male|guy|ryan|christopher|eric|andrew|brian|thomas|daniel|alex\b|fred|tom\b|oliver|arthur|david|mark|george|aaron|evan|nathan|rishi/i;
const NATURAL = /natural|neural|online|premium|enhanced|google/i;

/** Best-sounding installed voices for each gender, most natural first. */
function rankVoices(all: SpeechSynthesisVoice[], female: boolean) {
  const gender = female ? FEMALE_NAMES : MALE_NAMES;
  return all
    // "female" contains "male", so rule out the other gender's label explicitly.
    .filter((v) => gender.test(v.name) && !(female ? /\bmale\b/i : /female/i).test(v.name))
    .map((v) => ({ v, score: (NATURAL.test(v.name) ? 10 : 0) + (/en-(US|GB|AU)/i.test(v.lang) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.v);
}

/** Give each speaker a distinct, gender-matched voice where the device has enough. */
function autoAssign(all: SpeechSynthesisVoice[]): Partial<Record<ComicSpeaker, SpeechSynthesisVoice>> {
  const out: Partial<Record<ComicSpeaker, SpeechSynthesisVoice>> = {};
  for (const [female, order] of [
    [true, ["sophia", "emily", "mission"]],
    [false, ["timothy", "matthew", "host", "system"]],
  ] as const) {
    const ranked = rankVoices(all, female);
    order.forEach((s, i) => {
      if (ranked.length) out[s] = ranked[i % ranked.length];
    });
  }
  out.all = out.sophia;
  out.impostor = out.system;
  return out;
}

function loadSaved(): Record<ComicSpeaker, SpeakerVoice> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_VOICES, ...JSON.parse(raw) };
  } catch {
    // Storage blocked (private window etc.) — defaults are fine.
  }
  return DEFAULT_VOICES;
}

function speakable(text: string) {
  // Drop sound-effect asterisks, give ellipses a proper pause, and stop
  // shouted capitals being spelled out letter by letter.
  return text
    .replace(/\*/g, "")
    .replace(/…/g, "... ")
    .replace(/STEM/g, "Stem")
    .replace(/\b[A-Z][A-Z']+\b/g, (w) => (w === "MRT" ? w : w[0] + w.slice(1).toLowerCase()));
}

let manifestPromise: Promise<Set<string>> | null = null;
function loadManifest() {
  manifestPromise ??= fetch(`${AUDIO_BASE}manifest.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((keys: string[]) => new Set(keys))
    .catch(() => new Set<string>());
  return manifestPromise;
}

export function useComicVoices() {
  const synthSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voices, setVoices] = useState<Record<ComicSpeaker, SpeakerVoice>>(loadSaved);
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [recorded, setRecorded] = useState<Set<string>>(new Set());
  const [speaking, setSpeaking] = useState(false);
  const queueId = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let alive = true;
    loadManifest().then((s) => alive && setRecorded(s));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!synthSupported) return;
    const refresh = () => setSystemVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en")));
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
      window.speechSynthesis.cancel();
    };
  }, [synthSupported]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const isRecorded = useCallback((b: ComicBubble) => recorded.has(comicLineKey(b.speaker, b.text)), [recorded]);

  const setVoice = useCallback((speaker: ComicSpeaker, patch: Partial<SpeakerVoice>) => {
    setVoices((prev) => {
      const next = { ...prev, [speaker]: { ...prev[speaker], ...patch } };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    queueId.current++;
    audioRef.current?.pause();
    if (synthSupported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [synthSupported]);

  /** Speak bubbles in order; resolves true if it finished, false if interrupted. */
  const speak = useCallback(
    (bubbles: ComicBubble[]) =>
      new Promise<boolean>((resolve) => {
        if (bubbles.length === 0) return resolve(true);
        audioRef.current?.pause();
        if (synthSupported) window.speechSynthesis.cancel();
        const id = ++queueId.current;
        const auto = autoAssign(systemVoices);
        setSpeaking(true);
        let i = 0;

        const synth = (b: ComicBubble, done: () => void) => {
          if (!synthSupported) return done();
          const v = voices[b.speaker];
          const u = new SpeechSynthesisUtterance(speakable(b.text));
          u.pitch = v.pitch;
          u.rate = v.rate;
          const chosen = systemVoices.find((sv) => sv.voiceURI === v.voiceURI) ?? auto[b.speaker];
          if (chosen) u.voice = chosen;
          u.onend = done;
          u.onerror = done;
          window.speechSynthesis.speak(u);
        };

        const next = () => {
          if (id !== queueId.current) return resolve(false);
          if (i >= bubbles.length) {
            setSpeaking(false);
            return resolve(true);
          }
          const b = bubbles[i++];
          if (!isRecorded(b)) return synth(b, next);
          const audio = new Audio(`${AUDIO_BASE}${comicLineKey(b.speaker, b.text)}.mp3`);
          audioRef.current = audio;
          audio.onended = () => setTimeout(next, 250);
          audio.onerror = () => synth(b, next);
          audio.play().catch(() => synth(b, next));
        };
        next();
      }),
    [synthSupported, voices, systemVoices, isRecorded],
  );

  return {
    /** Something can read aloud: recordings, or the browser's voices. */
    supported: synthSupported || recorded.size > 0,
    synthSupported,
    isRecorded,
    voices,
    setVoice,
    systemVoices,
    speak,
    stop,
    speaking,
  };
}
