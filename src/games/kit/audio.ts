// Tiny Web Audio synth for game music and sound effects.
// Everything is generated in code (no audio files), chiptune style.

export type MusicTheme = "minecraft" | "builder" | "gameshow" | "space" | "spaceship";

const MUTE_KEY = "stemulate_game_muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();
const muteListeners = new Set<(m: boolean) => void>();

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.22;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.5;
    sfxBus.connect(master);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
  muteListeners.forEach((fn) => fn(m));
}

export function onMuteChange(fn: (m: boolean) => void) {
  muteListeners.add(fn);
  return () => muteListeners.delete(fn);
}

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function tone(
  freq: number,
  dur: number,
  {
    type = "square" as OscillatorType,
    vol = 0.3,
    slide,
    delay = 0,
    bus,
  }: { type?: OscillatorType; vol?: number; slide?: number; delay?: number; bus?: GainNode | null } = {},
) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(bus ?? sfxBus!);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, { vol = 0.2, delay = 0, hp = 1000, bus }: { vol?: number; delay?: number; hp?: number; bus?: GainNode | null } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = hp;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(bus ?? sfxBus!);
  src.start(t);
}

/** One-shot sound effects. Safe to call anywhere; they no-op without audio support. */
export const sfx = {
  click: () => tone(880, 0.05, { vol: 0.15 }),
  tick: () => tone(1200, 0.03, { type: "triangle", vol: 0.12 }),
  pop: () => tone(500, 0.08, { type: "triangle", vol: 0.3, slide: 900 }),
  place: () => {
    tone(160, 0.08, { type: "square", vol: 0.2, slide: 90 });
    noise(0.05, { vol: 0.15, hp: 2000 });
  },
  coin: () => {
    tone(988, 0.07, { vol: 0.2 });
    tone(1319, 0.18, { vol: 0.2, delay: 0.07 });
  },
  correct: () => {
    [72, 76, 79].forEach((n, i) => tone(midiToFreq(n), 0.12, { type: "square", vol: 0.18, delay: i * 0.07 }));
  },
  wrong: () => {
    tone(220, 0.15, { type: "sawtooth", vol: 0.18 });
    tone(165, 0.25, { type: "sawtooth", vol: 0.18, delay: 0.12 });
  },
  whoosh: () => noise(0.35, { vol: 0.25, hp: 600 }),
  splash: () => {
    noise(0.25, { vol: 0.2, hp: 3000 });
    tone(700, 0.15, { type: "sine", vol: 0.15, slide: 300 });
  },
  dice: () => {
    for (let i = 0; i < 6; i++) noise(0.03, { vol: 0.2, hp: 2500, delay: i * 0.06 });
  },
  launch: () => {
    noise(1.6, { vol: 0.35, hp: 200 });
    tone(80, 1.6, { type: "sawtooth", vol: 0.15, slide: 400 });
  },
  explode: () => {
    noise(0.8, { vol: 0.4, hp: 100 });
    tone(120, 0.6, { type: "square", vol: 0.2, slide: 40 });
  },
  alarm: () => {
    tone(880, 0.18, { type: "square", vol: 0.15 });
    tone(660, 0.18, { type: "square", vol: 0.15, delay: 0.2 });
  },
  countdown: () => tone(660, 0.12, { type: "square", vol: 0.2 }),
  go: () => tone(1320, 0.3, { type: "square", vol: 0.22 }),
  levelUp: () => {
    [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(midiToFreq(n), 0.1, { vol: 0.16, delay: i * 0.06 }));
  },
  fanfare: () => {
    [67, 67, 67, 72].forEach((n, i) => tone(midiToFreq(n), i === 3 ? 0.6 : 0.12, { vol: 0.2, delay: i * 0.14 }));
    [55, 55, 55, 60].forEach((n, i) => tone(midiToFreq(n), i === 3 ? 0.6 : 0.12, { type: "triangle", vol: 0.25, delay: i * 0.14 }));
  },
};

// ── Background music ──────────────────────────────────────
// Each theme is a 32-step loop: lead melody, bass line and a hat pattern.
type Song = { bpm: number; lead: (number | null)[]; bass: (number | null)[]; hat: string; leadType: OscillatorType };

const _ = null;
const SONGS: Record<MusicTheme, Song> = {
  // Calm, sunny overworld vibes
  minecraft: {
    bpm: 96,
    leadType: "triangle",
    lead: [76, _, 79, _, 81, _, 79, 76, 74, _, 72, _, 74, _, _, _, 76, _, 79, _, 84, _, 83, 79, 81, _, 79, _, 76, _, _, _],
    bass: [48, _, _, _, 55, _, _, _, 53, _, _, _, 55, _, _, _, 48, _, _, _, 55, _, _, _, 53, _, _, _, 50, _, 55, _],
    hat: "x...x...x...x...x...x...x...x.x.",
  },
  // Bouncy building tune
  builder: {
    bpm: 116,
    leadType: "square",
    lead: [72, 74, 76, _, 76, _, 79, _, 77, 76, 74, _, 72, _, _, _, 74, 76, 77, _, 77, _, 81, _, 79, 77, 76, _, 74, _, 72, _],
    bass: [48, _, 48, _, 55, _, 55, _, 53, _, 53, _, 55, _, 55, _, 50, _, 50, _, 57, _, 57, _, 55, _, 55, _, 48, _, 48, _],
    hat: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.xxxx",
  },
  // Game-show swing
  gameshow: {
    bpm: 128,
    leadType: "square",
    lead: [79, _, 79, 81, 83, _, 79, _, 84, _, 83, _, 81, _, _, _, 79, _, 79, 81, 83, _, 86, _, 84, _, 83, 81, 79, _, _, _],
    bass: [43, _, 50, _, 43, _, 50, _, 48, _, 55, _, 48, _, 55, _, 43, _, 50, _, 43, _, 50, _, 50, _, 57, _, 43, _, 50, _],
    hat: "x.xxx.xxx.xxx.xxx.xxx.xxx.xxx.xx",
  },
  // Spacey arpeggios
  space: {
    bpm: 108,
    leadType: "sawtooth",
    lead: [69, 72, 76, 72, 69, 72, 76, 81, 67, 71, 74, 71, 67, 71, 74, 79, 65, 69, 72, 69, 65, 69, 72, 77, 64, 68, 71, 68, 64, 68, 71, 76],
    bass: [45, _, _, _, _, _, 45, _, 43, _, _, _, _, _, 43, _, 41, _, _, _, _, _, 41, _, 40, _, _, _, 40, _, 40, _],
    hat: "..x...x...x...x...x...x...x...xx",
  },
  // Tense-but-fun spaceship tasks
  spaceship: {
    bpm: 120,
    leadType: "square",
    lead: [69, _, _, 72, _, _, 71, _, 69, _, 67, _, 69, _, _, _, 69, _, _, 72, _, _, 74, _, 76, _, 74, _, 72, _, 71, _],
    bass: [45, 45, _, 45, 45, _, 45, _, 43, 43, _, 43, 43, _, 43, _, 41, 41, _, 41, 41, _, 41, _, 40, 40, _, 40, 44, _, 44, _],
    hat: "x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.",
  },
};

let musicTimer: number | null = null;
let currentTheme: MusicTheme | null = null;

export function startMusic(theme: MusicTheme) {
  const a = audio();
  if (!a || !musicBus) return;
  if (currentTheme === theme && musicTimer !== null) return;
  stopMusic();
  currentTheme = theme;
  const song = SONGS[theme];
  const stepDur = 60 / song.bpm / 2; // eighth notes
  let step = 0;
  let nextTime = a.currentTime + 0.1;
  const schedule = () => {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.25) {
      const i = step % 32;
      const delay = Math.max(0, nextTime - ctx.currentTime);
      const lead = song.lead[i];
      const bass = song.bass[i];
      if (lead !== null) tone(midiToFreq(lead), stepDur * 0.9, { type: song.leadType, vol: 0.18, delay, bus: musicBus });
      if (bass !== null) tone(midiToFreq(bass), stepDur * 1.8, { type: "triangle", vol: 0.35, delay, bus: musicBus });
      if (song.hat[i] === "x") noise(0.03, { vol: 0.06, hp: 7000, delay, bus: musicBus });
      nextTime += stepDur;
      step++;
    }
  };
  schedule();
  musicTimer = window.setInterval(schedule, 80);
}

export function stopMusic() {
  if (musicTimer !== null) window.clearInterval(musicTimer);
  musicTimer = null;
  currentTheme = null;
}

/** Unlocks audio on the first user gesture (browsers block autoplay). */
export function primeAudio() {
  audio();
}
