// Minecraft Terrarium Builder — Minecraft Masterminds science game.
// Based on the workshop's "build your own mini ecosystem" activity.
// Three jars, one per biome (Forest, Desert, Swamp). For each jar the player:
//   1. fills the layers from the bottom up (rocks, perlite, then soil/sand/wet soil),
//   2. picks the 3 things that belong in that biome,
//   3. seals the lid,
//   4. watches the water cycle inside the closed jar and names each stage.
// One clear job at a time, picked from a Minecraft-style hotbar.

import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Timer } from "lucide-react";
import { cn } from "../components/ui/utils";
import { STEMBOTS } from "../data/mock";
import { sfx } from "./kit/audio";
import { seededRandom } from "./kit/scores";
import { BLOCKS, Voxel, VoxelWorld, type BlockColors } from "./kit/Voxel";
import type { GameProps } from "./kit/types";

const ROUND_SECONDS = 300;
const START_DELAY = 2600;
const GRID = 6; // jar inside is 4×4 at cells 1..4
const JAR_H = 4; // jar height in blocks
const PTS_PER_JAR = 100 / 3;

// ── Items ─────────────────────────────────────────────
type LayerId = "rocks" | "perlite" | "soil" | "sand" | "wetsoil";
type DecorId = "fern" | "moss" | "leafy" | "cactus" | "pebbles" | "deadbush" | "lilypad" | "log" | "mushroom" | "snow" | "flower";

interface Item {
  label: string;
  emoji: string;
}

const LAYERS: Record<LayerId, Item & { colors: BlockColors[]; thick: number }> = {
  rocks: {
    label: "Rocks",
    emoji: "🪨",
    thick: 0.55,
    colors: [BLOCKS.stone, { top: "#8f8f8f", side: "#7a7a7a", side2: "#636363" }, { top: "#b5b5b5", side: "#9c9c9c", side2: "#808080" }],
  },
  perlite: {
    label: "Perlite",
    emoji: "⚪",
    thick: 0.4,
    colors: [{ top: "#f8fafc", side: "#e2e8f0", side2: "#cbd5e1" }, { top: "#e5e7eb", side: "#d1d5db", side2: "#b7bcc4" }],
  },
  soil: {
    label: "Soil",
    emoji: "🟫",
    thick: 0.9,
    colors: [{ top: "#5b3a1e", side: "#6b4423", side2: "#54351b" }, { top: "#4a2f17", side: "#6b4423", side2: "#54351b" }],
  },
  sand: {
    label: "Sand",
    emoji: "🟨",
    thick: 0.9,
    colors: [BLOCKS.sand, { top: "#efd27a", side: "#e6c96c", side2: "#cfb257" }],
  },
  wetsoil: {
    label: "Wet soil",
    emoji: "💧",
    thick: 0.9,
    colors: [BLOCKS.mud, { top: "#5a4325", side: "#5a4122", side2: "#47331b" }],
  },
};

const DECOR: Record<DecorId, Item> = {
  fern: { label: "Fern", emoji: "🌿" },
  moss: { label: "Moss", emoji: "🟩" },
  leafy: { label: "Leafy plant", emoji: "🪴" },
  cactus: { label: "Cactus", emoji: "🌵" },
  pebbles: { label: "Small rocks", emoji: "🪨" },
  deadbush: { label: "Dry bush", emoji: "🥀" },
  lilypad: { label: "Lily pad", emoji: "🪷" },
  log: { label: "Mini log", emoji: "🪵" },
  mushroom: { label: "Mushroom", emoji: "🍄" },
  snow: { label: "Snow block", emoji: "❄️" },
  flower: { label: "Desert flower", emoji: "🌼" },
};

// ── Biomes ────────────────────────────────────────────
interface Biome {
  key: "forest" | "desert" | "swamp";
  name: string;
  emoji: string;
  ground: LayerId;
  groundTip: string;
  good: DecorId[];
  bad: DecorId[];
  why: Partial<Record<DecorId, string>>;
  sky: string;
}

const BIOMES: Biome[] = [
  {
    key: "forest",
    name: "Forest",
    emoji: "🌲",
    ground: "soil",
    groundTip: "Forest plants grow in rich, dark soil.",
    good: ["fern", "moss", "leafy"],
    bad: ["cactus", "snow", "deadbush"],
    why: {
      cactus: "A cactus likes hot, dry deserts, not a shady forest.",
      snow: "Snow would freeze our forest plants!",
      deadbush: "A dry bush belongs in the desert. Forests are green and damp.",
    },
    sky: "linear-gradient(#7dd3fc, #c7f0d8 70%, #e7f9ee)",
  },
  {
    key: "desert",
    name: "Desert",
    emoji: "🏜️",
    ground: "sand",
    groundTip: "Deserts are dry and sandy.",
    good: ["cactus", "pebbles", "flower"],
    bad: ["moss", "lilypad", "mushroom"],
    why: {
      moss: "Moss needs lots of water. A desert is too dry!",
      lilypad: "Lily pads float on water. There's no pond in a desert.",
      mushroom: "Mushrooms like dark, damp places, not hot sand.",
    },
    sky: "linear-gradient(#fcd34d, #fde9b3 70%, #fff6dc)",
  },
  {
    key: "swamp",
    name: "Swamp",
    emoji: "🐸",
    ground: "wetsoil",
    groundTip: "Swamps are soggy! The bottom is moist soil.",
    good: ["moss", "lilypad", "log"],
    bad: ["cactus", "deadbush", "snow"],
    why: {
      cactus: "A cactus would rot in a soggy swamp.",
      deadbush: "A dry bush needs a dry desert, not a wet swamp.",
      snow: "Swamps are warm and wet, not snowy!",
    },
    sky: "linear-gradient(#86b8a0, #b9d8c4 70%, #dcefe3)",
  },
];

const LAYER_HOTBAR: LayerId[] = ["soil", "rocks", "sand", "perlite", "wetsoil"];
const recipeFor = (b: Biome): LayerId[] => ["rocks", "perlite", b.ground];

// ── Water cycle questions (one set per jar) ───────────
type Stage = "evaporation" | "condensation" | "precipitation";
interface Question {
  q: string;
  options: string[];
  answer: number;
  explain: string;
}

const STAGES: Stage[] = ["evaporation", "condensation", "precipitation"];

const QUESTIONS: Record<Stage, Question[]> = {
  evaporation: [
    {
      q: "The sun warms the water. It turns into vapour and floats up. What is this called?",
      options: ["Evaporation", "Condensation", "Precipitation"],
      answer: 0,
      explain: "Evaporation: water gains heat and turns into water vapour.",
    },
    {
      q: "Water vapour is floating up in the jar. Which state is water vapour?",
      options: ["Solid", "Liquid", "Gas"],
      answer: 2,
      explain: "Water vapour is water as a gas, like in the air we breathe.",
    },
    {
      q: "What gives the water the heat it needs to evaporate?",
      options: ["The sun", "The lid", "The rocks"],
      answer: 0,
      explain: "Heat from the sun makes the water evaporate.",
    },
  ],
  condensation: [
    {
      q: "The vapour touches the cool glass and turns into tiny drops. What is this called?",
      options: ["Precipitation", "Condensation", "Evaporation"],
      answer: 1,
      explain: "Condensation: vapour loses heat and turns back into water drops.",
    },
    {
      q: "The little drops on the glass are water in which state?",
      options: ["Liquid", "Gas", "Solid"],
      answer: 0,
      explain: "The drops are liquid water, just like the water we drink.",
    },
    {
      q: "Why does the vapour turn into drops on the glass?",
      options: ["The glass is hot", "It loses heat on the cool glass", "The plants drink it"],
      answer: 1,
      explain: "The vapour loses heat on the cool glass, so it condenses into drops.",
    },
  ],
  precipitation: [
    {
      q: "The drops get too heavy and fall back on the plants. What is this called?",
      options: ["Evaporation", "Condensation", "Precipitation"],
      answer: 2,
      explain: "Precipitation: heavy drops fall back down, like rain.",
    },
    {
      q: "The jar is sealed with only a little water. Will the plants survive?",
      options: ["Yes! The water keeps cycling", "No, the water runs out", "Only if it snows"],
      answer: 0,
      explain: "Yes! The lid keeps the water inside, so it goes round and round the water cycle.",
    },
    {
      q: "Rain, snow and hail are all kinds of...",
      options: ["Condensation", "Precipitation", "Evaporation"],
      answer: 1,
      explain: "Rain, snow and hail are all precipitation: water falling from the clouds.",
    },
  ],
};

type Step = "layers" | "decor" | "seal" | "cycle" | "done";
const STEP_LABELS: { key: Step; label: string }[] = [
  { key: "layers", label: "Layers" },
  { key: "decor", label: "Plants" },
  { key: "seal", label: "Lid" },
  { key: "cycle", label: "Water cycle" },
];

function shuffle<T>(arr: T[], rnd: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function TerrariumBuilder({ seed, reportProgress, finish }: GameProps) {
  // Same seed → same hotbar order and answer order for everyone in a live game.
  const plan = useMemo(() => {
    const rnd = seededRandom(seed);
    return BIOMES.map((b, i) => ({
      decorBar: shuffle([...b.good, ...b.bad], rnd),
      questions: STAGES.map((s) => {
        const q = QUESTIONS[s][i];
        const order = shuffle([0, 1, 2], rnd);
        return { ...q, options: order.map((k) => q.options[k]), answer: order.indexOf(q.answer) };
      }),
    }));
  }, [seed]);

  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [jar, setJar] = useState(0);
  const [step, setStep] = useState<Step>("layers");
  const [layers, setLayers] = useState<LayerId[]>([]);
  const [decor, setDecor] = useState<DecorId[]>([]);
  const [triedBad, setTriedBad] = useState<DecorId[]>([]);
  const [missesThisPick, setMissesThisPick] = useState(0);
  const [sealed, setSealed] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [pts, setPts] = useState(0);
  const [perfectPicks, setPerfectPicks] = useState(0);
  const [rightAnswers, setRightAnswers] = useState(0);
  const [jarStart, setJarStart] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ text: string; good: boolean; id: number } | null>(null);
  const [shakeId, setShakeId] = useState(0);

  const biome = BIOMES[Math.min(jar, BIOMES.length - 1)];
  const recipe = recipeFor(biome);
  const jarPlan = plan[Math.min(jar, plan.length - 1)];
  const allDone = jar >= BIOMES.length;
  const timeUp = elapsed >= ROUND_SECONDS;
  const over = allDone || timeUp;
  const score = Math.min(100, Math.round(pts));

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), START_DELAY);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!started || over) return;
    const id = setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => clearInterval(id);
  }, [started, over]);

  const stepFrac = { layers: layers.length / 12, decor: 0.25 + decor.length / 12, seal: 0.5, cycle: 0.6 + stageIdx / 10, done: 1 }[step];
  const progress = Math.min(1, (jar + stepFrac) / BIOMES.length);
  useEffect(() => {
    reportProgress(score, progress);
  }, [score, progress, reportProgress]);

  const finishedRef = useRef(false);
  useEffect(() => {
    if (!over || finishedRef.current) return;
    finishedRef.current = true;
    if (timeUp && !allDone) sfx.alarm();
    const t = setTimeout(
      () =>
        finish(score, [
          { label: "Terrariums built", value: `${Math.min(jar, 3)}/3` },
          { label: "First-try picks", value: `${perfectPicks}/18` },
          { label: "Water cycle answers", value: `${rightAnswers}/9` },
          { label: "Time", value: `${Math.round(elapsed)}s` },
        ]),
      900,
    );
    return () => clearTimeout(t);
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps

  const showFlash = (text: string, good: boolean) => {
    const id = Date.now() + Math.random();
    setFlash({ text, good, id });
    setTimeout(() => setFlash((f) => (f?.id === id ? null : f)), 1400);
  };

  const miss = (msg: string) => {
    sfx.wrong();
    setMissesThisPick((m) => m + 1);
    setHint(msg);
    setShakeId((s) => s + 1);
    showFlash("Not quite!", false);
  };

  const goodPick = (label: string) => {
    const first = missesThisPick === 0;
    const gained = first ? 3 : 1;
    setPts((p) => p + gained);
    if (first) setPerfectPicks((n) => n + 1);
    setMissesThisPick(0);
    setHint(null);
    sfx.place();
    setTimeout(() => sfx.coin(), 120);
    showFlash(`${label}! +${gained}`, true);
  };

  const canPlay = started && !over;

  // ── Step 1: layers ──────────────────
  const pickLayer = (id: LayerId) => {
    if (!canPlay || step !== "layers") return;
    const k = layers.length;
    const want = recipe[k];
    if (id !== want) {
      if (k === 0) miss("Start at the very bottom with ROCKS. They let extra water drain away so the roots don't rot.");
      else if (k === 1) miss("Next comes PERLITE, the little white balls. They keep the soil light so roots can breathe.");
      else miss(`${biome.groundTip} Pick ${LAYERS[biome.ground].label.toUpperCase()}.`);
      return;
    }
    goodPick(LAYERS[id].label);
    const next = [...layers, id];
    setLayers(next);
    if (next.length === recipe.length) setTimeout(() => setStep("decor"), 650);
  };

  // ── Step 2: plants & decorations ────
  const pickDecor = (id: DecorId) => {
    if (!canPlay || step !== "decor" || decor.includes(id) || triedBad.includes(id)) return;
    if (!biome.good.includes(id)) {
      setTriedBad((t) => [...t, id]);
      miss(biome.why[id] ?? `That doesn't belong in a ${biome.name.toLowerCase()}.`);
      return;
    }
    goodPick(DECOR[id].label);
    const next = [...decor, id];
    setDecor(next);
    if (next.length === 3) setTimeout(() => setStep("seal"), 700);
  };

  // ── Step 3: seal ────────────────────
  const seal = () => {
    if (!canPlay || step !== "seal") return;
    setSealed(true);
    setPts((p) => p + 2);
    sfx.pop();
    showFlash("Sealed tight! +2", true);
    setTimeout(() => {
      setStep("cycle");
      setStageIdx(0);
      setAnswer(null);
    }, 800);
  };

  // ── Step 4: water cycle questions ───
  const question = step === "cycle" ? jarPlan.questions[stageIdx] : null;
  const answerQ = (i: number) => {
    if (!question || answer !== null || !canPlay) return;
    setAnswer(i);
    if (i === question.answer) {
      sfx.correct();
      setPts((p) => p + 4);
      setRightAnswers((n) => n + 1);
      showFlash("Correct! +4", true);
    } else {
      sfx.wrong();
    }
    setTimeout(() => {
      setAnswer(null);
      if (stageIdx < 2) {
        setStageIdx((s) => s + 1);
        sfx.whoosh();
      } else {
        completeJar();
      }
    }, i === question.answer ? 1500 : 2800);
  };

  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;
  const completeJar = () => {
    // Up to the jar's remaining points for speed (most points come from right answers).
    const took = elapsedRef.current - jarStart;
    const bonus = Math.max(0, Math.min(1, (90 - took) / 50)) * (PTS_PER_JAR - 31);
    setPts((p) => p + bonus);
    setStep("done");
    sfx.levelUp();
    setTimeout(() => {
      setJar((j) => j + 1);
      setStep("layers");
      setLayers([]);
      setDecor([]);
      setTriedBad([]);
      setMissesThisPick(0);
      setSealed(false);
      setStageIdx(0);
      setHint(null);
      setJarStart(elapsedRef.current);
    }, 2600);
  };

  // Number keys pick from the hotbar; 1–3 answer questions.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    const n = Number(e.key);
    if (!Number.isInteger(n) || n < 1) {
      if ((e.key === "Enter" || e.key === " ") && step === "seal") seal();
      return;
    }
    if (step === "layers" && n <= LAYER_HOTBAR.length) pickLayer(LAYER_HOTBAR[n - 1]);
    else if (step === "decor" && n <= jarPlan.decorBar.length) pickDecor(jarPlan.decorBar[n - 1]);
    else if (step === "seal" && n === 1) seal();
    else if (step === "cycle" && n <= 3) answerQ(n - 1);
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  // ── Layout sizing ─────────────────────
  const worldRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 700, h: 360 });
  useEffect(() => {
    const el = worldRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const S = Math.max(16, Math.min(54, Math.floor(Math.min(box.w / 10.5, box.h / 7.8))));

  const sophia = STEMBOTS.sophia;
  const timeLeft = Math.max(0, Math.ceil(ROUND_SECONDS - elapsed));
  const stage = step === "cycle" ? STAGES[stageIdx] : null;

  const objective = (() => {
    if (allDone) return "All 3 terrariums are alive! You're a real ecosystem builder!";
    if (!started) return `Let's build a ${biome.name} terrarium!`;
    switch (step) {
      case "layers":
        return layers.length === 0
          ? "Fill the jar from the BOTTOM up. What goes in first?"
          : `Great! Now pick layer ${layers.length + 1} of 3.`;
      case "decor":
        return `Pick 3 things that belong in a ${biome.name.toUpperCase()} ${biome.emoji}  (${decor.length}/3)`;
      case "seal":
        return "Put the lid on to seal the jar!";
      case "cycle":
        return "Watch the water inside the closed jar, then answer!";
      case "done":
        return `Your ${biome.name} terrarium is alive! 🎉`;
    }
  })();

  return (
    <div
      data-game="terrarium"
      className="absolute inset-0 flex flex-col overflow-hidden transition-[background] duration-700"
      style={{ background: biome.sky }}
    >
      {/* Pixel clouds */}
      {[
        [8, 30, 1],
        [62, 18, 0.8],
        [84, 40, 1.1],
      ].map(([left, top, sc], i) => (
        <div key={i} className="absolute pointer-events-none" style={{ left: `${left}%`, top: top + 96, transform: `scale(${sc})`, animation: `game-float ${4 + i}s ease-in-out infinite` }}>
          <div className="flex items-end">
            <span className="block w-8 h-5 -ml-3 rounded-full bg-white/80 blur-[1px]" />
            <span className="block w-10 h-8 -ml-3 rounded-full bg-white/90 blur-[1px]" />
            <span className="block w-12 h-6 -ml-3 rounded-full bg-white/80 blur-[1px]" />
          </div>
        </div>
      ))}

      {/* HUD: objective + score */}
      <div className="relative z-10 flex items-stretch gap-2 p-2 sm:p-3">
        <div key={`${jar}-${step}`} className="flex-1 min-w-0 bg-white/95 rounded-2xl game-panel px-2 sm:px-3 py-2 flex items-center gap-2 sm:gap-3 game-bounce-in">
          <div key={`s${shakeId}`} className={cn("relative shrink-0 rounded-2xl p-1 bg-emerald-500", shakeId > 0 && "game-shake")}>
            <img src={sophia.avatar} alt={sophia.name} className="w-10 h-10 sm:w-14 sm:h-14 object-contain drop-shadow" />
            <span className="absolute -bottom-1 -right-1 text-lg">{biome.emoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="game-pixel text-[8px] sm:text-[9px] text-slate-500 truncate">
              {allDone ? "ALL JARS DONE" : `JAR ${jar + 1}/3 · ${biome.name.toUpperCase()}`}
            </p>
            <p className="game-fun font-bold text-slate-900 leading-snug text-[14px] sm:text-[17px]">{objective}</p>
            {!allDone && (
              <div className="flex flex-wrap gap-1 mt-1">
                {STEP_LABELS.map((s, i) => {
                  const cur = STEP_LABELS.findIndex((x) => x.key === step);
                  const doneStep = step === "done" || i < cur;
                  return (
                    <span
                      key={s.key}
                      className={cn(
                        "game-fun font-bold text-[11px] rounded-md px-1.5 py-0.5 flex items-center gap-0.5",
                        doneStep ? "bg-emerald-100 text-emerald-700" : i === cur ? "bg-amber-300 text-slate-900" : "bg-slate-100 text-slate-400",
                      )}
                    >
                      {doneStep ? <Check size={11} strokeWidth={3} /> : `${i + 1}.`} {s.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex-1 bg-slate-900/85 text-white rounded-2xl game-panel px-2 py-1 flex items-center justify-center gap-1.5 min-w-[64px] sm:min-w-[78px]">
            <Timer size={14} className="text-amber-300" />
            <span className={cn("game-pixel text-xs", timeLeft <= 30 && "text-rose-400")}>{timeLeft}</span>
          </div>
          <div className="flex-1 bg-slate-900/85 text-white rounded-2xl game-panel px-2 py-1 flex items-center justify-center gap-1.5 min-w-[64px] sm:min-w-[78px]">
            <span className="text-[8px] font-bold text-amber-300">PTS</span>
            <span className="game-pixel text-xs text-yellow-300">{score}</span>
          </div>
        </div>
      </div>

      {/* 3D jar */}
      <div ref={worldRef} className="relative flex-1 min-h-0">
        <VoxelWorld cols={GRID} rows={GRID} size={S} className="absolute inset-0" style={{ paddingTop: S * 2.6 }}>
          <Table S={S} />
          <JarContents S={S} biome={biome} layers={layers} decor={decor} />
          {stage && <WaterCycleFX S={S} stage={stage} top={layersTop(layers)} />}
          <GlassJar S={S} sealed={sealed} />
        </VoxelWorld>

        {/* Sun (heats the jar during evaporation) */}
        <div
          className={cn(
            "absolute right-3 top-2 text-5xl sm:text-6xl transition-all duration-700 pointer-events-none",
            stage === "evaporation" ? "opacity-100 scale-110 drop-shadow-[0_0_24px_rgba(250,204,21,0.9)]" : "opacity-60 scale-90",
          )}
          style={stage === "evaporation" ? { animation: "game-spin-slow 8s linear infinite" } : undefined}
        >
          ☀️
        </div>

        {/* Recipe card */}
        {!allDone && (
          <div className="absolute left-2 top-2 z-10 bg-amber-50/95 rounded-2xl game-panel px-2.5 py-2 w-[150px] sm:w-[170px]">
            <p className="game-pixel text-[8px] text-amber-700 mb-1">JAR RECIPE</p>
            <ol className="space-y-0.5">
              {recipe.map((id, i) => {
                const have = layers.length > i;
                // First jar shows the whole recipe; later jars only show what's already in.
                const show = have || jar === 0 || i < layers.length;
                return (
                  <li key={i} className={cn("game-fun font-bold text-[12px] flex items-center gap-1", have ? "text-emerald-700" : "text-slate-500")}>
                    <span className="w-4 text-right">{i + 1}.</span>
                    {show ? (
                      <>
                        <span>{LAYERS[id].emoji}</span> {LAYERS[id].label}
                      </>
                    ) : (
                      <span className="text-slate-400">? ? ?</span>
                    )}
                    {have && <Check size={12} strokeWidth={3} className="ml-auto" />}
                  </li>
                );
              })}
              <li className={cn("game-fun font-bold text-[12px] flex items-center gap-1", decor.length === 3 ? "text-emerald-700" : "text-slate-500")}>
                <span className="w-4 text-right">4.</span> 🌱 3 {biome.name.toLowerCase()} things
                {decor.length === 3 && <Check size={12} strokeWidth={3} className="ml-auto" />}
              </li>
              <li className={cn("game-fun font-bold text-[12px] flex items-center gap-1", sealed ? "text-emerald-700" : "text-slate-500")}>
                <span className="w-4 text-right">5.</span> 🫙 Seal the lid
                {sealed && <Check size={12} strokeWidth={3} className="ml-auto" />}
              </li>
            </ol>
          </div>
        )}

        {/* Water cycle stage label */}
        {stage && (
          <div className="absolute inset-x-0 bottom-2 flex justify-center z-10 pointer-events-none">
            <div className="flex gap-1.5">
              {STAGES.map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    "game-pixel text-[8px] sm:text-[9px] px-2 py-1.5 rounded-lg game-panel",
                    i === stageIdx ? "bg-sky-500 text-white" : i < stageIdx ? "bg-emerald-500 text-white" : "bg-white/70 text-slate-400",
                  )}
                >
                  {i < stageIdx || (i === stageIdx && answer !== null) ? s.toUpperCase() : `STAGE ${i + 1}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Flash */}
        {flash && (
          <div className="absolute inset-x-0 top-24 flex justify-center z-20 pointer-events-none">
            <span key={flash.id} className={cn("game-bounce-in text-white game-fun font-bold px-4 py-2 rounded-2xl game-panel text-lg", flash.good ? "bg-emerald-500" : "bg-rose-500")}>
              {flash.text}
            </span>
          </div>
        )}

        {/* Hint */}
        {hint && (step === "layers" || step === "decor") && (
          <div className="absolute right-2 bottom-2 z-10 max-w-[280px] sm:max-w-[320px]">
            <div key={shakeId} className="bg-rose-50 border-rose-300 text-rose-900 rounded-2xl game-panel px-3 py-2 game-shake flex gap-2">
              <img src={sophia.avatar} alt="" className="w-9 h-9 object-contain shrink-0" />
              <p className="text-[13px] font-semibold leading-snug">{hint}</p>
            </div>
          </div>
        )}

        {/* Jar complete */}
        {step === "done" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="bg-emerald-500 text-white rounded-3xl game-panel px-6 py-4 text-center game-bounce-in">
              <p className="text-5xl">{biome.emoji}</p>
              <p className="game-pixel text-[11px] mt-2">TERRARIUM {jar + 1} DONE!</p>
              <p className="game-fun font-bold text-sm mt-1">The water keeps cycling, so the plants stay alive.</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: hotbar or question */}
      <div className="relative z-10 bg-slate-900/90 text-white px-2 sm:px-3 py-2 min-h-[104px] flex items-center justify-center">
        {step === "layers" && (
          <Hotbar
            items={LAYER_HOTBAR.map((id) => ({ key: id, ...LAYERS[id], picked: layers.includes(id) }))}
            disabled={!canPlay}
            onPick={(id) => pickLayer(id as LayerId)}
          />
        )}
        {step === "decor" && (
          <Hotbar
            items={jarPlan.decorBar.map((id) => ({ key: id, ...DECOR[id], picked: decor.includes(id), crossed: triedBad.includes(id) }))}
            disabled={!canPlay}
            onPick={(id) => pickDecor(id as DecorId)}
          />
        )}
        {step === "seal" && (
          <button onClick={seal} disabled={!canPlay} className="game-btn bg-yellow-400 text-slate-900 text-lg sm:text-xl px-8 py-3 flex items-center gap-2 game-pulse">
            🫙 Put the lid on!
          </button>
        )}
        {step === "cycle" && question && (
          <div key={`${jar}-${stageIdx}`} className="w-full max-w-3xl game-bounce-in">
            <p className="game-fun font-bold text-[14px] sm:text-[16px] text-center mb-2 leading-snug">{question.q}</p>
            <div className="grid grid-cols-3 gap-2">
              {question.options.map((o, i) => {
                const reveal = answer !== null;
                const right = i === question.answer;
                return (
                  <button
                    key={o}
                    onClick={() => answerQ(i)}
                    disabled={reveal || !canPlay}
                    className={cn(
                      "game-btn text-[13px] sm:text-[15px] px-2 py-2.5 leading-tight !opacity-100",
                      !reveal && "bg-white text-slate-900",
                      reveal && right && "bg-emerald-400 text-slate-900",
                      reveal && !right && i === answer && "bg-rose-500 text-white",
                      reveal && !right && i !== answer && "bg-white/40 text-slate-700",
                    )}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
            {answer !== null && (
              <p className="text-center text-[12px] sm:text-[13px] text-sky-100 mt-1.5 game-bounce-in">{question.explain}</p>
            )}
          </div>
        )}
        {(step === "done" || allDone) && <p className="game-fun font-bold text-lg">{allDone ? "🎉 All done!" : "Next jar coming up..."}</p>}
      </div>
    </div>
  );
}

// ── Pieces ────────────────────────────────────────────

function Hotbar({
  items,
  disabled,
  onPick,
}: {
  items: { key: string; label: string; emoji: string; picked?: boolean; crossed?: boolean }[];
  disabled: boolean;
  onPick: (key: string) => void;
}) {
  return (
    <div className="flex gap-1.5 sm:gap-2 bg-black/40 p-1.5 rounded-lg">
      {items.map((it, i) => (
        <button
          key={it.key}
          onClick={() => {
            sfx.click();
            onPick(it.key);
          }}
          disabled={disabled || it.picked || it.crossed}
          aria-label={it.label}
          className={cn("game-slot relative w-[58px] h-[74px] sm:w-[78px] sm:h-[82px] flex flex-col items-center justify-center", it.picked && "picked !opacity-100")}
        >
          <span className="absolute top-0.5 left-1 game-pixel text-[8px] text-white/80 drop-shadow">{i + 1}</span>
          <span className={cn("text-2xl sm:text-3xl leading-none drop-shadow", it.crossed && "grayscale")}>{it.emoji}</span>
          <span className="game-fun font-bold text-[10px] sm:text-[11px] text-white mt-1 leading-tight text-center px-0.5 drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]">
            {it.label}
          </span>
          {it.crossed && <span className="absolute inset-0 flex items-center justify-center text-rose-500 text-4xl font-black">✕</span>}
          {it.picked && (
            <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 rounded-full w-5 h-5 flex items-center justify-center">
              <Check size={13} strokeWidth={3} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** A block in "S units": position and size in blocks, so small pieces line up. */
function B({ x, y, z, s, colors, hs = 1, textured = true, style }: { x: number; y: number; z: number; s: number; colors: BlockColors; hs?: number; textured?: boolean; style?: CSSProperties }) {
  const S = useContext_S();
  return <Voxel x={x / s} y={y / s} z={z / s} size={S * s} colors={colors} heightScale={hs} textured={textured} style={style} />;
}

// Tiny context so the piece components don't need S threaded everywhere.
const SCtx = createContext(32);
const useContext_S = () => useContext(SCtx);

function layersTop(layers: LayerId[]) {
  return layers.reduce((z, id) => z + LAYERS[id].thick, 0);
}

function Table({ S }: { S: number }) {
  const blocks: ReactNode[] = [];
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++)
      blocks.push(<Voxel key={`${x},${y}`} x={x} y={y} z={-0.35} size={S} heightScale={0.35} colors={(x + y) % 2 ? BLOCKS.plank : { top: "#c99a68", side: "#c08552", side2: "#a26c3c" }} />);
  return <>{blocks}</>;
}

function JarContents({ S, biome, layers, decor }: { S: number; biome: Biome; layers: LayerId[]; decor: DecorId[] }) {
  let z = 0;
  const top = layersTop(layers);
  return (
    <SCtx.Provider value={S}>
      {layers.map((id, li) => {
        const L = LAYERS[id];
        const z0 = z;
        z += L.thick;
        return (
          <div key={`${biome.key}-${li}`} className="vx-group vx-drop" style={{ "--from": `${S * 4}px` } as CSSProperties}>
            {Array.from({ length: 16 }, (_, k) => {
              const x = 1 + (k % 4);
              const y = 1 + Math.floor(k / 4);
              return <Voxel key={k} x={x} y={y} z={z0} size={S} heightScale={L.thick} colors={L.colors[(x * 7 + y * 3 + li) % L.colors.length]} />;
            })}
          </div>
        );
      })}
      {/* Swamp puddle sits in the wet soil */}
      {biome.key === "swamp" && layers.length === 3 && (
        <B x={3} y={3} z={top - 0.1} s={1} hs={0.15} colors={BLOCKS.water} textured={false} />
      )}
      {decor.map((id, i) => (
        <div key={`${biome.key}-${id}`} className="vx-group vx-drop" style={{ "--from": `${S * 3}px` } as CSSProperties}>
          <div className="vx-group" style={decorScale(S, id, i, top, biome.key === "swamp")}>
            <DecorModel id={id} slot={i} z={top} swamp={biome.key === "swamp"} />
          </div>
        </div>
      ))}
    </SCtx.Provider>
  );
}

// Where each decoration goes on the 4×4 top (block units).
const SLOTS: [number, number][] = [
  [1.15, 1.2],
  [3.2, 1.25],
  [1.3, 3.15],
];
const DECOR_SCALE = 1.6;

function slotOf(id: DecorId, slot: number, swamp: boolean): [number, number] {
  return id === "lilypad" && swamp ? [3.15, 3.15] : SLOTS[slot];
}

/** Grows a decoration about its own base so it reads clearly inside the jar. */
function decorScale(S: number, id: DecorId, slot: number, top: number, swamp: boolean): CSSProperties {
  const [x, y] = slotOf(id, slot, swamp);
  const k = id === "lilypad" ? 1.3 : DECOR_SCALE;
  return { transformOrigin: `${x * S}px ${y * S}px ${top * S}px`, transform: `scale3d(${k}, ${k}, ${k})` };
}

function DecorModel({ id, slot, z, swamp }: { id: DecorId; slot: number; z: number; swamp: boolean }) {
  const [x, y] = slotOf(id, slot, swamp);
  const G = BLOCKS.leaves;
  const G2 = BLOCKS.jungleLeaves;
  switch (id) {
    case "fern":
      return (
        <>
          <B x={x + 0.3} y={y + 0.3} z={z} s={0.2} hs={2.5} colors={G2} />
          <B x={x} y={y + 0.25} z={z + 0.3} s={0.3} colors={G} />
          <B x={x + 0.5} y={y + 0.25} z={z + 0.3} s={0.3} colors={G} />
          <B x={x + 0.25} y={y} z={z + 0.45} s={0.3} colors={G2} />
          <B x={x + 0.25} y={y + 0.5} z={z + 0.45} s={0.3} colors={G2} />
        </>
      );
    case "moss":
      return (
        <>
          <B x={x - 0.1} y={y - 0.1} z={z} s={0.5} hs={0.25} colors={{ top: "#4d7c0f", side: "#3f6212", side2: "#365314" }} />
          <B x={x + 0.4} y={y - 0.1} z={z} s={0.5} hs={0.3} colors={{ top: "#65a30d", side: "#4d7c0f", side2: "#3f6212" }} />
          <B x={x - 0.1} y={y + 0.4} z={z} s={0.5} hs={0.35} colors={{ top: "#65a30d", side: "#4d7c0f", side2: "#3f6212" }} />
          <B x={x + 0.4} y={y + 0.4} z={z} s={0.5} hs={0.2} colors={{ top: "#4d7c0f", side: "#3f6212", side2: "#365314" }} />
        </>
      );
    case "leafy":
      return (
        <>
          <B x={x + 0.3} y={y + 0.3} z={z} s={0.2} hs={3} colors={BLOCKS.log} />
          <B x={x} y={y} z={z + 0.55} s={0.8} hs={0.8} colors={G} />
          <B x={x + 0.2} y={y + 0.2} z={z + 1.15} s={0.4} colors={G2} />
        </>
      );
    case "cactus":
      return (
        <>
          <B x={x + 0.2} y={y + 0.2} z={z} s={0.4} hs={4} colors={BLOCKS.cactus} />
          <B x={x + 0.6} y={y + 0.3} z={z + 0.7} s={0.2} hs={1} colors={BLOCKS.cactus} />
          <B x={x + 0.8} y={y + 0.3} z={z + 0.7} s={0.2} hs={2.5} colors={BLOCKS.cactus} />
          <B x={x + 0.3} y={y + 0.3} z={z + 1.6} s={0.2} colors={{ top: "#f472b6", side: "#ec4899", side2: "#db2777" }} />
        </>
      );
    case "pebbles":
      return (
        <>
          <B x={x} y={y} z={z} s={0.35} colors={BLOCKS.stone} />
          <B x={x + 0.45} y={y + 0.15} z={z} s={0.25} colors={{ top: "#78716c", side: "#57534e", side2: "#44403c" }} />
          <B x={x + 0.1} y={y + 0.5} z={z} s={0.3} colors={{ top: "#d6d3d1", side: "#a8a29e", side2: "#78716c" }} />
        </>
      );
    case "flower":
      return (
        <>
          <B x={x + 0.35} y={y + 0.35} z={z} s={0.12} hs={5} colors={BLOCKS.cactus} />
          <B x={x + 0.2} y={y + 0.2} z={z + 0.6} s={0.4} hs={0.4} colors={{ top: "#facc15", side: "#eab308", side2: "#ca8a04" }} />
          <B x={x + 0.32} y={y + 0.32} z={z + 0.76} s={0.16} colors={{ top: "#ea580c", side: "#c2410c", side2: "#9a3412" }} />
        </>
      );
    case "deadbush":
      return (
        <>
          <B x={x + 0.3} y={y + 0.3} z={z} s={0.1} hs={6} colors={{ top: "#92400e", side: "#78350f", side2: "#5c2a0b" }} />
          <B x={x + 0.1} y={y + 0.3} z={z + 0.4} s={0.1} hs={3} colors={{ top: "#a16207", side: "#854d0e", side2: "#713f12" }} />
          <B x={x + 0.5} y={y + 0.3} z={z + 0.3} s={0.1} hs={3} colors={{ top: "#a16207", side: "#854d0e", side2: "#713f12" }} />
        </>
      );
    case "lilypad":
      return (
        <>
          <B x={x} y={y} z={z + 0.06} s={0.7} hs={0.08} colors={{ top: "#16a34a", side: "#15803d", side2: "#166534" }} textured={false} />
          <B x={x + 0.25} y={y + 0.25} z={z + 0.12} s={0.2} colors={{ top: "#f9a8d4", side: "#f472b6", side2: "#ec4899" }} />
        </>
      );
    case "log":
      return (
        <>
          <B x={x - 0.2} y={y + 0.1} z={z} s={0.45} colors={BLOCKS.log} />
          <B x={x + 0.25} y={y + 0.1} z={z} s={0.45} colors={BLOCKS.log} />
          <B x={x + 0.7} y={y + 0.1} z={z} s={0.45} colors={BLOCKS.log} />
          <B x={x + 0.3} y={y + 0.2} z={z + 0.45} s={0.25} hs={0.4} colors={{ top: "#65a30d", side: "#4d7c0f", side2: "#3f6212" }} />
        </>
      );
    case "mushroom":
      return (
        <>
          <B x={x + 0.3} y={y + 0.3} z={z} s={0.2} hs={2} colors={{ top: "#fef3c7", side: "#fde68a", side2: "#fcd34d" }} />
          <B x={x + 0.1} y={y + 0.1} z={z + 0.4} s={0.6} hs={0.4} colors={{ top: "#dc2626", side: "#b91c1c", side2: "#991b1b" }} />
        </>
      );
    case "snow":
      return <B x={x} y={y} z={z} s={0.7} colors={BLOCKS.snow} />;
  }
}

function GlassJar({ S, sealed }: { S: number; sealed: boolean }) {
  const W = 4 * S;
  const H = JAR_H * S;
  const glass = "linear-gradient(135deg, rgba(255,255,255,0.35), rgba(186,230,253,0.18) 40%, rgba(186,230,253,0.12))";
  const face = (extra: CSSProperties): CSSProperties => ({
    position: "absolute",
    background: glass,
    border: "2px solid rgba(255,255,255,0.75)",
    boxSizing: "border-box",
    pointerEvents: "none",
    ...extra,
  });
  return (
    <div className="vx-group" style={{ left: S, top: S, width: W, height: W }}>
      {/* back walls first (north, west), then the front ones */}
      <div style={face({ left: 0, top: 0, width: W, height: H, transformOrigin: "top", transform: "rotateX(90deg)" })} />
      <div style={face({ left: 0, top: 0, width: H, height: W, transformOrigin: "left", transform: "rotateY(-90deg)" })} />
      <div style={face({ left: 0, top: W - H, width: W, height: H, transformOrigin: "bottom", transform: "rotateX(-90deg)" })} />
      <div style={face({ left: W - H, top: 0, width: H, height: W, transformOrigin: "right", transform: "rotateY(90deg)" })} />
      {/* Lid */}
      <div
        className="vx-group"
        style={{
          transform: `translateZ(${sealed ? H : H + S * 3}px)`,
          visibility: sealed ? "visible" : "hidden",
          transition: "transform 500ms cubic-bezier(0.4,0,0.6,1)",
        }}
      >
        {[0, 1, 2, 3].flatMap((y) =>
          [0, 1, 2, 3].map((x) => (
            <Voxel key={`${x}${y}`} x={x} y={y} z={0} size={S} colors={{ top: "rgba(224,242,254,0.35)", side: "#b07d45cc", side2: "#8f6233cc" }} heightScale={0.18} textured={false} />
          )),
        )}
      </div>
    </div>
  );
}

function WaterCycleFX({ S, stage, top }: { S: number; stage: Stage; top: number }) {
  const span = (JAR_H - top - 0.5) * S;
  // Puffs and drops spread over the jar floor (block units).
  const spots: [number, number][] = [
    [1.3, 1.6],
    [2.5, 1.2],
    [3.9, 1.9],
    [1.6, 3.7],
    [3.4, 3.5],
    [2.4, 2.5],
    [4.2, 3.0],
    [1.2, 2.6],
  ];
  const vapour: BlockColors = { top: "#ffffff", side: "#e0e7ff", side2: "#c7d2fe" };
  const drop: BlockColors = { top: "#7dd3fc", side: "#38bdf8", side2: "#0ea5e9" };
  const rain: BlockColors = { top: "#60a5fa", side: "#2563eb", side2: "#1d4ed8" };
  // Drops of water on the two back walls and under the lid.
  const wallDrops: [number, number, number][] = [];
  for (let i = 0; i < 5; i++) {
    wallDrops.push([1.3 + i * 0.75, 1.02, JAR_H - 0.9 - (i % 2) * 0.7]);
    wallDrops.push([1.02, 1.4 + i * 0.75, JAR_H - 1.1 - ((i + 1) % 2) * 0.6]);
    wallDrops.push([1.5 + i * 0.7, 2.2 + (i % 3) * 0.8, JAR_H - 0.45]);
  }
  return (
    <SCtx.Provider value={S}>
      {stage === "evaporation" &&
        spots.map(([x, y], i) => (
          <div key={`e${i}`} className="vx-group vx-rise" style={{ "--dur": "2.6s", "--delay": `${i * 0.32}s`, "--to": `${span}px` } as CSSProperties}>
            <B x={x} y={y} z={top} s={0.55} hs={0.7} colors={vapour} textured={false} />
          </div>
        ))}
      {(stage === "condensation" || stage === "precipitation") &&
        wallDrops.map(([x, y, z], i) => (
          <div key={`c${i}`} className="vx-group">
            <B x={x} y={y} z={z} s={0.24} hs={1.4} colors={drop} textured={false} />
          </div>
        ))}
      {stage === "condensation" &&
        spots.slice(0, 4).map(([x, y], i) => (
          <div key={`cv${i}`} className="vx-group vx-rise" style={{ "--dur": "3s", "--delay": `${i * 0.6}s`, "--to": `${span}px` } as CSSProperties}>
            <B x={x} y={y} z={top} s={0.35} hs={0.8} colors={vapour} textured={false} />
          </div>
        ))}
      {stage === "precipitation" &&
        spots.map(([x, y], i) => (
          <div key={`p${i}`} className="vx-group vx-fall" style={{ "--delay": `${i * 0.17}s`, "--from": `${span}px` } as CSSProperties}>
            <B x={x} y={y} z={top} s={0.22} hs={2} colors={rain} textured={false} />
          </div>
        ))}
    </SCtx.Provider>
  );
}
