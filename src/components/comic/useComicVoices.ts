import { useCallback, useEffect, useRef, useState } from "react";
import type { ComicBubble, ComicSpeaker } from "../../data/comicStrips";

// Read-aloud for comic bubbles using the browser's built-in speech synthesis
// (no API key, works offline). Each speaker gets their own pitch/rate so the
// characters sound different, and kids can pick a different system voice for
// any character from the Voices menu.

export interface SpeakerVoice {
  pitch: number;
  rate: number;
  /** `SpeechSynthesisVoice.voiceURI` chosen by the user; empty = browser default. */
  voiceURI: string;
}

export const VOICE_SPEAKERS: ComicSpeaker[] = ["sophia", "timothy", "emily", "matthew", "host", "system", "mission"];

const DEFAULT_VOICES: Record<ComicSpeaker, SpeakerVoice> = {
  sophia:   { pitch: 1.35, rate: 1.0,  voiceURI: "" },
  timothy:  { pitch: 1.0,  rate: 1.08, voiceURI: "" },
  emily:    { pitch: 1.2,  rate: 1.02, voiceURI: "" },
  matthew:  { pitch: 0.8,  rate: 0.95, voiceURI: "" },
  host:     { pitch: 0.9,  rate: 1.1,  voiceURI: "" },
  system:   { pitch: 0.5,  rate: 0.9,  voiceURI: "" },
  mission:  { pitch: 0.75, rate: 1.05, voiceURI: "" },
  impostor: { pitch: 0.3,  rate: 0.8,  voiceURI: "" },
  all:      { pitch: 1.1,  rate: 1.0,  voiceURI: "" },
};

const STORAGE_KEY = "stemulate.comicVoices";

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
  // Drop sound-effect asterisks and give ellipses a proper pause.
  return text.replace(/\*/g, "").replace(/…/g, "... ");
}

export function useComicVoices() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voices, setVoices] = useState<Record<ComicSpeaker, SpeakerVoice>>(loadSaved);
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const queueId = useRef(0);

  useEffect(() => {
    if (!supported) return;
    const refresh = () => setSystemVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en")));
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

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
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  /** Speak bubbles in order; resolves true if it finished, false if interrupted. */
  const speak = useCallback(
    (bubbles: ComicBubble[]) =>
      new Promise<boolean>((resolve) => {
        if (!supported || bubbles.length === 0) return resolve(true);
        window.speechSynthesis.cancel();
        const id = ++queueId.current;
        setSpeaking(true);
        let i = 0;
        const next = () => {
          if (id !== queueId.current) return resolve(false);
          if (i >= bubbles.length) {
            setSpeaking(false);
            return resolve(true);
          }
          const b = bubbles[i++];
          const v = voices[b.speaker];
          const u = new SpeechSynthesisUtterance(speakable(b.text));
          u.pitch = v.pitch;
          u.rate = v.rate;
          const chosen = systemVoices.find((sv) => sv.voiceURI === v.voiceURI);
          if (chosen) u.voice = chosen;
          u.onend = next;
          u.onerror = next;
          window.speechSynthesis.speak(u);
        };
        next();
      }),
    [supported, voices, systemVoices],
  );

  return { supported, voices, setVoice, systemVoices, speak, stop, speaking };
}
