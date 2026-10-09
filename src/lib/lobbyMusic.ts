// Cheerful background tune for the Academy dashboard. It starts when a
// learner logs in (a click, so browsers allow sound) and can be switched off
// from the header. Synthesised in code like the game music, no audio files.
import { isMuted, onMuteChange } from "../games/kit/audio";

const PREF_KEY = "stemulate_music";

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let timer: number | null = null;
let playing = false;
const listeners = new Set<(on: boolean) => void>();

export function musicEnabled() {
  try {
    return localStorage.getItem(PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

function setPref(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

export function onMusicChange(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;

// 64 eighth-note steps: a bouncy C-major tune over C, A minor, F and G.
const LEAD: (number | null)[] = [
  72, _, 76, _, 79, _, 76, _, 77, _, 76, 74, 72, _, _, _,
  69, _, 72, _, 76, _, 74, 72, 74, _, 72, _, 69, _, _, _,
  65, _, 69, _, 72, _, 74, _, 76, _, 74, 72, 69, _, 72, _,
  67, _, 71, _, 74, _, 77, _, 76, _, 74, _, 72, _, _, _,
];
const CHORDS = [
  [48, 55, 64],
  [45, 52, 60],
  [41, 48, 57],
  [43, 50, 59],
];
const BPM = 104;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function note(freq: number, at: number, dur: number, type: OscillatorType, vol: number) {
  if (!ctx || !bus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g);
  g.connect(bus);
  o.start(at);
  o.stop(at + dur + 0.05);
}

/** Start the tune (only if the learner hasn't switched music off). */
export function startLobbyMusic() {
  if (playing || !musicEnabled()) return;
  const a = ensure();
  if (!a || !bus) return;
  playing = true;
  bus.gain.cancelScheduledValues(a.currentTime);
  bus.gain.setTargetAtTime(isMuted() ? 0 : 0.16, a.currentTime, 0.8);
  const step = 60 / BPM / 2;
  let i = 0;
  let next = a.currentTime + 0.15;
  const tick = () => {
    if (!ctx) return;
    while (next < ctx.currentTime + 0.3) {
      const s = i % 64;
      const lead = LEAD[s];
      if (lead !== null) note(midi(lead), next, step * 1.6, "triangle", 0.22);
      if (s % 16 === 0) CHORDS[s / 16].forEach((n) => note(midi(n), next, step * 15, "sine", 0.08));
      if (s % 4 === 0) note(midi(CHORDS[Math.floor(s / 16)][0] - 12), next, step * 2.5, "triangle", 0.2);
      if (s % 4 === 2) note(midi(CHORDS[Math.floor(s / 16)][2] + 12), next, step * 0.6, "square", 0.025);
      next += step;
      i++;
    }
  };
  tick();
  timer = window.setInterval(tick, 90);
  listeners.forEach((fn) => fn(true));
}

export function stopLobbyMusic(fade = true) {
  if (!playing) return;
  playing = false;
  const t = timer;
  timer = null;
  if (ctx && bus) {
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setTargetAtTime(0, ctx.currentTime, fade ? 0.4 : 0.02);
  }
  window.setTimeout(() => t !== null && window.clearInterval(t), fade ? 1200 : 50);
  listeners.forEach((fn) => fn(false));
}

export function isLobbyMusicPlaying() {
  return playing;
}

/** Header toggle: switches the tune off (and remembers it), or back on. */
export function toggleLobbyMusic() {
  if (playing) {
    setPref(false);
    stopLobbyMusic();
  } else {
    setPref(true);
    startLobbyMusic();
  }
}

// Follow the games' global mute switch too.
onMuteChange((m) => {
  if (ctx && bus && playing) bus.gain.setTargetAtTime(m ? 0 : 0.16, ctx.currentTime, 0.1);
});

/** True once the tune has been started by a click this session. */
export function lobbyMusicUnlocked() {
  return ctx !== null;
}
