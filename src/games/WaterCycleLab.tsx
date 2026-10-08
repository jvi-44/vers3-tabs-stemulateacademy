// Water Cycle Biome Lab — Minecraft Masterminds science game.
// Control temperature, rainfall and sunlight over a 3D block island. Clear
// missions (make a biome, survive a heatwave, balance the lake) and answer
// quick water-cycle questions for bonus points.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Droplets, Sun, Thermometer, Timer } from "lucide-react";
import { cn } from "../components/ui/utils";
import { sfx } from "./kit/audio";
import { seededRandom } from "./kit/scores";
import { BLOCKS, Voxel, VoxelWorld, type BlockColors } from "./kit/Voxel";
import type { GameProps } from "./kit/types";

type BiomeId = "tundra" | "taiga" | "plains" | "forest" | "swamp" | "desert" | "savanna" | "jungle";

const BIOMES: Record<BiomeId, { name: string; emoji: string; ground: BlockColors; tip: string }> = {
  tundra: { name: "Snowy Tundra", emoji: "❄️", ground: BLOCKS.snow, tip: "Freezing and fairly dry" },
  taiga: { name: "Snowy Taiga", emoji: "🌲", ground: BLOCKS.snow, tip: "Freezing with lots of snow" },
  plains: { name: "Plains", emoji: "🌾", ground: BLOCKS.grass, tip: "Mild and dry" },
  forest: { name: "Forest", emoji: "🌳", ground: BLOCKS.grass, tip: "Mild with medium rain" },
  swamp: { name: "Swamp", emoji: "🐸", ground: BLOCKS.mud, tip: "Mild and very wet" },
  desert: { name: "Desert", emoji: "🏜️", ground: BLOCKS.sand, tip: "Hot and dry" },
  savanna: { name: "Savanna", emoji: "🦒", ground: BLOCKS.redSand, tip: "Hot with medium rain" },
  jungle: { name: "Jungle", emoji: "🌴", ground: BLOCKS.grass, tip: "Hot and very wet" },
};

function biomeFor(temp: number, rain: number): BiomeId {
  if (temp < 5) return rain < 50 ? "tundra" : "taiga";
  if (temp <= 25) return rain < 35 ? "plains" : rain <= 65 ? "forest" : "swamp";
  return rain < 35 ? "desert" : rain <= 65 ? "savanna" : "jungle";
}

type Mission =
  | { kind: "biome"; target: BiomeId }
  | { kind: "survive"; event: "heatwave" | "drought" | "freeze" }
  | { kind: "lake" };

const EVENTS = {
  heatwave: { name: "HEATWAVE!", text: "The temperature keeps climbing! Keep the forest alive.", emoji: "🔥" },
  drought: { name: "DROUGHT!", text: "The rain keeps stopping! Keep the forest alive.", emoji: "🌵" },
  freeze: { name: "COLD SNAP!", text: "It keeps getting colder! Keep the forest alive.", emoji: "🥶" },
} as const;

const QUESTIONS = [
  { q: "Water turning into vapour and rising from the lake is called…", options: ["Evaporation", "Condensation", "Precipitation"], a: 0 },
  { q: "Vapour cooling down to form clouds is called…", options: ["Collection", "Condensation", "Evaporation"], a: 1 },
  { q: "Rain or snow falling from clouds is called…", options: ["Precipitation", "Evaporation", "Melting"], a: 0 },
  { q: "Water gathering in lakes, rivers and oceans is called…", options: ["Condensation", "Freezing", "Collection"], a: 2 },
  { q: "At 0°C and below, water becomes a…", options: ["Gas", "Solid (ice)", "Liquid"], a: 1 },
  { q: "What makes water evaporate faster?", options: ["More heat and sunlight", "More clouds", "Colder air"], a: 0 },
  { q: "Plants giving off water vapour from their leaves is called…", options: ["Transpiration", "Precipitation", "Freezing"], a: 0 },
  { q: "Above 100°C, water is a…", options: ["Solid", "Liquid", "Gas"], a: 2 },
  { q: "Ice melting into water is a change from…", options: ["Gas to liquid", "Solid to liquid", "Liquid to gas"], a: 1 },
];

const ROUND_SECONDS = 120;
const MISSION_POINTS = 12;
const QUESTION_POINTS = 7;
const MAX_QUESTION_POINTS = 28;

const N = 7;
const LAKE = new Set(["2,3", "3,3", "4,3", "3,4", "2,4", "4,4", "3,2"]);
const TREE_SPOTS: [number, number][] = [
  [1, 1],
  [5, 1],
  [1, 5],
  [5, 5],
  [0, 3],
  [6, 3],
];

function mix(a: string, b: string, t: number) {
  const pa = a.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return "#" + pa.slice(0, 3).map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

export function WaterCycleLab({ seed, reportProgress, finish }: GameProps) {
  const rnd = useMemo(() => seededRandom(seed), [seed]);

  const missions = useMemo<Mission[]>(() => {
    const pool: BiomeId[] = ["desert", "jungle", "tundra", "swamp", "savanna", "taiga", "plains"];
    const picks: BiomeId[] = [];
    while (picks.length < 4) {
      const b = pool[Math.floor(rnd() * pool.length)];
      if (!picks.includes(b)) picks.push(b);
    }
    const events = ["heatwave", "drought", "freeze"] as const;
    const ev = events[Math.floor(rnd() * events.length)];
    return [
      { kind: "biome", target: picks[0] },
      { kind: "biome", target: picks[1] },
      { kind: "survive", event: ev },
      { kind: "biome", target: picks[2] },
      { kind: "lake" },
      { kind: "biome", target: picks[3] },
    ];
  }, [rnd]);

  const questionOrder = useMemo(() => [...QUESTIONS].sort(() => rnd() - 0.5), [rnd]);

  // Climate controls
  const [temp, setTemp] = useState(18); // °C, -10..40
  const [rain, setRain] = useState(50); // 0..100
  const [sun, setSun] = useState(50); // 0..100

  // Simulation + game state
  const [sim, setSim] = useState({ water: 0.5, health: 0.85 });
  const [missionIdx, setMissionIdx] = useState(0);
  const [hold, setHold] = useState(0); // seconds held at goal for current mission
  const [missionClock, setMissionClock] = useState(0);
  const [goodTime, setGoodTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [missionPts, setMissionPts] = useState(0);
  const [qPts, setQPts] = useState(0);
  const [qCorrect, setQCorrect] = useState(0);
  const [question, setQuestion] = useState<{ idx: number; left: number; picked: number | null } | null>(null);
  const [nextQAt, setNextQAt] = useState(12);
  const [qCount, setQCount] = useState(0);
  const [discovered, setDiscovered] = useState<Set<BiomeId>>(() => new Set());
  const [flash, setFlash] = useState<string | null>(null);

  const biome = biomeFor(temp, rain);
  const mission = missions[missionIdx];

  const state = useRef({ temp, rain, sun });
  state.current = { temp, rain, sun };

  useEffect(() => {
    setDiscovered((d) => {
      if (d.has(biome)) return d;
      const n = new Set(d);
      n.add(biome);
      if (d.size > 0) sfx.pop();
      return n;
    });
  }, [biome]);

  const done = missionIdx >= missions.length || elapsed >= ROUND_SECONDS;
  const score = Math.min(100, Math.round(missionPts + Math.min(MAX_QUESTION_POINTS, qPts)));

  useEffect(() => {
    reportProgress(score, Math.min(1, missionIdx / missions.length));
  }, [score, missionIdx, missions.length, reportProgress]);

  const finishedRef = useRef(false);
  useEffect(() => {
    if (!done || finishedRef.current) return;
    finishedRef.current = true;
    const t = setTimeout(
      () =>
        finish(score, [
          { label: "Missions", value: `${Math.min(missionIdx, missions.length)}/${missions.length}` },
          { label: "Questions", value: `${qCorrect} correct` },
          { label: "Biomes found", value: `${discovered.size}/8` },
          { label: "Time", value: `${Math.round(elapsed)}s` },
        ]),
      700,
    );
    return () => clearTimeout(t);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const completeMission = (pts: number, label: string) => {
    setMissionPts((p) => p + pts);
    setMissionIdx((i) => i + 1);
    setHold(0);
    setMissionClock(0);
    setGoodTime(0);
    setFlash(`${label} +${Math.round(pts)}`);
    sfx.correct();
    setTimeout(() => setFlash(null), 1400);
  };

  // Main loop, 10 ticks per second
  useEffect(() => {
    if (done) return;
    const DT = 0.1;
    const id = setInterval(() => {
      const { temp: t, rain: r, sun: s } = state.current;
      setElapsed((e) => e + DT);

      // Water cycle physics
      setSim((prev) => {
        const frozen = t < 0;
        const evap = (Math.max(0, Math.min(1, (t + 10) / 50)) * 0.6 + (s / 100) * 0.4) * (frozen ? 0.25 : 1);
        const precip = r / 100;
        const water = Math.max(0.05, Math.min(1, prev.water + (precip - evap * 0.95) * DT * 0.11));
        let target = 1;
        if (water < 0.25) target -= (0.25 - water) * 3;
        if (water > 0.85) target -= (water - 0.85) * 3;
        if (t > 30) target -= (t - 30) / 12;
        if (t < 2) target -= (2 - t) / 10;
        if (s < 20) target -= (20 - s) / 40;
        target = Math.max(0, Math.min(1, target));
        const health = prev.health + (target - prev.health) * DT * 0.6;
        return { water, health };
      });

      // Weather events push the controls around
      const m = missions[missionIdxRef.current];
      if (m?.kind === "survive") {
        if (m.event === "heatwave") setTemp((v) => Math.min(40, v + 0.3));
        if (m.event === "drought") setRain((v) => Math.max(0, v - 0.5));
        if (m.event === "freeze") setTemp((v) => Math.max(-10, v - 0.3));
      }
      setMissionClock((c) => c + DT);
    }, 100);
    return () => clearInterval(id);
  }, [done, missions]);

  const missionIdxRef = useRef(missionIdx);
  missionIdxRef.current = missionIdx;

  // Mission goal checks (run on every tick via missionClock)
  useEffect(() => {
    if (done || !mission) return;
    const DT = 0.1;
    if (mission.kind === "biome") {
      if (biome === mission.target) {
        const h = hold + DT;
        if (h >= 1.5) {
          const pts = MISSION_POINTS * Math.max(0.35, Math.min(1, 1 - (missionClock - 4) / 22));
          completeMission(pts, `${BIOMES[mission.target].name} made!`);
        } else setHold(h);
      } else if (hold) setHold(0);
    } else if (mission.kind === "lake") {
      if (sim.water >= 0.4 && sim.water <= 0.6) {
        const h = hold + DT;
        if (h >= 4) {
          const pts = MISSION_POINTS * Math.max(0.35, Math.min(1, 1 - (missionClock - 8) / 25));
          completeMission(pts, "Lake balanced!");
        } else setHold(h);
      } else if (hold) setHold(Math.max(0, hold - DT * 2));
    } else if (mission.kind === "survive") {
      const good = sim.health >= 0.5;
      const g = goodTime + (good ? DT : 0);
      setGoodTime(g);
      if (missionClock >= 12) completeMission(MISSION_POINTS * (g / 12), `Survived the ${EVENTS[mission.event].name.replace("!", "").toLowerCase()}!`);
    }
  }, [missionClock]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pop quiz questions
  useEffect(() => {
    if (done) return;
    if (!question && elapsed >= nextQAt && qCount < questionOrder.length) {
      setQuestion({ idx: qCount, left: 8, picked: null });
      setQCount((c) => c + 1);
      sfx.alarm();
      return;
    }
    if (question && question.picked === null) {
      const left = Math.max(0, 8 - (elapsed - (nextQAt)));
      if (left <= 0) {
        setQuestion(null);
        setNextQAt(elapsed + 10 + rnd() * 5);
      } else if (Math.abs(left - question.left) >= 0.1) setQuestion({ ...question, left });
    }
  }, [elapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (i: number) => {
    if (!question || question.picked !== null) return;
    const q = questionOrder[question.idx];
    const right = i === q.a;
    if (right) {
      sfx.correct();
      setQPts((p) => p + QUESTION_POINTS * Math.max(0.5, question.left / 8));
      setQCorrect((c) => c + 1);
    } else sfx.wrong();
    setQuestion({ ...question, picked: i });
    setTimeout(() => {
      setQuestion(null);
      setNextQAt(elapsedRef.current + 10 + rnd() * 5);
    }, 1100);
  };
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;

  // ── Visuals ────────────────────────────────────────────
  const cold = temp < 5;
  const frozen = temp < 0;
  const b = BIOMES[biome];
  const dry = 1 - sim.health;
  const groundTop = biome === "plains" || biome === "forest" || biome === "jungle" ? mix(b.ground.top, "#c9b458", dry * 0.9) : b.ground.top;
  const ground: BlockColors = { ...b.ground, top: groundTop };
  const leafBase =
    biome === "jungle" ? BLOCKS.jungleLeaves : biome === "taiga" || biome === "swamp" ? BLOCKS.darkLeaves : BLOCKS.leaves;
  const leaves: BlockColors = {
    top: cold ? "#f8fafc" : mix(leafBase.top, "#a0782c", dry * 0.85),
    side: mix(leafBase.side, "#8a6424", dry * 0.85),
    side2: mix(leafBase.side2!, "#6e501c", dry * 0.85),
  };
  const treeCount = { tundra: 0, taiga: 5, plains: 2, forest: 5, swamp: 3, desert: 0, savanna: 2, jungle: 6 }[biome];
  const trunkH = biome === "jungle" ? 3 : biome === "savanna" ? 2 : 2;
  const cactusCount = biome === "desert" ? 3 : 0;
  const waterColors: BlockColors = frozen ? BLOCKS.ice : biome === "swamp" ? { top: "#4d7c5acc", side: "#3f6a4bcc", side2: "#33573dcc" } : BLOCKS.water;
  const clouds = Math.round(rain / 18);
  const evapLevel = Math.max(0, Math.min(1, ((temp + 10) / 50) * 0.6 + (sun / 100) * 0.4)) * (frozen ? 0.25 : 1);
  const skyTop = cold ? "#a5c8ff" : temp > 28 ? "#ffcf7a" : "#7cc8ff";
  const skyBottom = cold ? "#e0ecff" : temp > 28 ? "#ffe9b8" : "#d4f1ff";
  const rainDrops = rain > 30 ? Math.round((rain - 30) / 3) : 0;

  const missionText = (() => {
    if (!mission) return { title: "All missions done!", sub: "Great climate science!", emoji: "🏆" };
    if (mission.kind === "biome") {
      const t = BIOMES[mission.target];
      return { title: `Build the ${t.name}`, sub: `${t.tip}. Hold it for a moment!`, emoji: t.emoji };
    }
    if (mission.kind === "lake") return { title: "Balance the lake", sub: "Keep the water level in the green zone for 4 seconds.", emoji: "💧" };
    const e = EVENTS[mission.event];
    return { title: e.name, sub: e.text, emoji: e.emoji };
  })();

  const holdPct =
    mission?.kind === "biome" ? hold / 1.5 : mission?.kind === "lake" ? hold / 4 : mission?.kind === "survive" ? missionClock / 12 : 1;

  const timeLeft = Math.max(0, Math.ceil(ROUND_SECONDS - elapsed));

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: `linear-gradient(${skyTop}, ${skyBottom})` }}>
      {/* HUD */}
      <div className="relative z-10 flex items-stretch gap-2 p-3">
        <div className={cn("flex-1 bg-white/95 rounded-2xl game-panel px-3 py-2 flex items-center gap-3", mission?.kind === "survive" && "bg-rose-50")}>
          <span className="text-3xl">{missionText.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="game-pixel text-[9px] text-slate-500">
              MISSION {Math.min(missionIdx + 1, missions.length)}/{missions.length}
            </p>
            <p className="game-fun font-bold text-slate-900 leading-tight">{missionText.title}</p>
            <p className="text-[11px] text-slate-600 leading-tight truncate">{missionText.sub}</p>
            <div className="h-2 bg-slate-200 rounded-full mt-1 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", mission?.kind === "survive" ? "bg-rose-400" : "bg-emerald-500")}
                style={{ width: `${Math.min(1, holdPct) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="bg-slate-900/85 text-white rounded-2xl game-panel px-3 py-2 flex flex-col items-center justify-center min-w-[84px]">
          <Timer size={14} className="text-amber-300" />
          <span className={cn("game-pixel text-sm", timeLeft <= 15 && "text-rose-400")}>{timeLeft}</span>
        </div>
        <div className="bg-slate-900/85 text-white rounded-2xl game-panel px-3 py-2 flex flex-col items-center justify-center min-w-[84px]">
          <span className="text-[9px] font-bold text-amber-300">SCORE</span>
          <span className="game-pixel text-sm text-yellow-300">{score}</span>
        </div>
      </div>

      {/* World */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* Sun */}
        <div
          className="absolute right-10 top-2 rounded-full transition-all duration-500"
          style={{
            width: 34 + sun * 0.5,
            height: 34 + sun * 0.5,
            background: "radial-gradient(circle, #fff7ae, #fde047 55%, #f59e0b)",
            boxShadow: `0 0 ${20 + sun * 0.6}px ${sun * 0.25}px rgba(253, 224, 71, 0.6)`,
            opacity: 0.35 + (sun / 100) * 0.65,
          }}
        />
        {/* Clouds */}
        {Array.from({ length: clouds }, (_, i) => (
          <div
            key={i}
            className="absolute transition-all duration-700"
            style={{ left: `${8 + ((i * 37) % 80)}%`, top: 6 + (i % 3) * 16, animation: `game-float ${3 + (i % 3)}s ease-in-out ${i * 0.3}s infinite` }}
          >
            <div className="flex">
              {[0, 1, 2].map((k) => (
                <span
                  key={k}
                  className="block"
                  style={{
                    width: 22,
                    height: k === 1 ? 22 : 14,
                    marginTop: k === 1 ? 0 : 8,
                    background: rain > 70 ? "#94a3b8" : "#ffffff",
                    boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.08)",
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        {/* Rain / snow */}
        {Array.from({ length: rainDrops }, (_, i) => (
          <span
            key={i}
            className="absolute block"
            style={{
              left: `${(i * 53) % 100}%`,
              top: 30,
              width: cold ? 6 : 3,
              height: cold ? 6 : 12,
              background: cold ? "#ffffff" : "#3b82f6",
              borderRadius: cold ? 2 : 1,
              animation: `game-rain ${cold ? 2.4 : 0.9}s linear ${(i * 0.13) % 1.5}s infinite`,
              opacity: 0.8,
            }}
          />
        ))}
        {/* Evaporation wisps */}
        {Array.from({ length: Math.round(evapLevel * 6) }, (_, i) => (
          <span
            key={`ev-${i}`}
            className="absolute text-lg"
            style={{
              left: `${44 + (i % 3) * 5}%`,
              bottom: "38%",
              animation: `game-rain 2.4s linear ${i * 0.4}s infinite reverse`,
              opacity: 0.6,
            }}
          >
            〰️
          </span>
        ))}

        <VoxelWorld cols={N} rows={N} size={44} className="absolute inset-0" style={{ paddingTop: 70 }}>
          {Array.from({ length: N * N }, (_, i) => {
            const x = i % N;
            const y = Math.floor(i / N);
            if (LAKE.has(`${x},${y}`)) {
              return (
                <Voxel key={`g${i}`} x={x} y={y} z={-0.2} size={44} colors={BLOCKS.dirt} heightScale={0.6}>
                  <Voxel x={0} y={0} z={0.6} size={44} colors={waterColors} heightScale={Math.max(0.08, sim.water * 0.9)} textured={false} />
                </Voxel>
              );
            }
            return <Voxel key={`g${i}`} x={x} y={y} size={44} colors={ground} heightScale={1} />;
          })}
          {TREE_SPOTS.slice(0, treeCount).map(([x, y], t) => (
            <Fragment key={`t${t}`}>
              {Array.from({ length: trunkH }, (_, k) => (
                <Voxel key={k} x={x} y={y} z={1 + k} size={44} colors={BLOCKS.log} />
              ))}
              <Voxel x={x} y={y} z={1 + trunkH} size={44} colors={leaves} />
              {biome !== "taiga" && sim.health > 0.25 && (
                <>
                  <Voxel x={x - 0.5} y={y} z={trunkH + 0.6} size={44} colors={leaves} heightScale={0.7} />
                  <Voxel x={x + 0.5} y={y} z={trunkH + 0.6} size={44} colors={leaves} heightScale={0.7} />
                </>
              )}
              {biome === "taiga" && <Voxel x={x} y={y} z={2 + trunkH} size={44} colors={leaves} heightScale={0.8} />}
            </Fragment>
          ))}
          {Array.from({ length: cactusCount }, (_, c) => {
            const [x, y] = TREE_SPOTS[c * 2];
            return (
              <Fragment key={`c${c}`}>
                <Voxel x={x} y={y} z={1} size={44} colors={BLOCKS.cactus} />
                <Voxel x={x} y={y} z={2} size={44} colors={BLOCKS.cactus} />
              </Fragment>
            );
          })}
        </VoxelWorld>

        {/* Biome tag */}
        <div className="absolute left-3 bottom-3 bg-white/90 rounded-xl px-3 py-1.5 game-panel flex items-center gap-2">
          <span className="text-xl">{b.emoji}</span>
          <div>
            <p className="text-[9px] font-bold text-slate-500 uppercase">Biome now</p>
            <p className="game-fun font-bold text-slate-900 text-sm leading-tight">{b.name}</p>
          </div>
        </div>
        {/* Discovered biomes */}
        <div className="absolute right-3 bottom-3 bg-white/90 rounded-xl px-2 py-1.5 game-panel flex gap-0.5">
          {(Object.keys(BIOMES) as BiomeId[]).map((id) => (
            <span key={id} title={BIOMES[id].name} className={cn("text-base", !discovered.has(id) && "grayscale opacity-30")}>
              {BIOMES[id].emoji}
            </span>
          ))}
        </div>

        {flash && (
          <div className="absolute inset-x-0 top-8 flex justify-center z-10">
            <span className="game-bounce-in bg-emerald-500 text-white game-fun font-bold px-4 py-2 rounded-2xl game-panel">{flash}</span>
          </div>
        )}

        {/* Pop quiz */}
        {question && (
          <div className="absolute inset-x-3 top-3 z-20 flex justify-center">
            <div className="bg-indigo-600 text-white rounded-2xl game-panel p-3 w-full max-w-lg game-bounce-in">
              <div className="flex items-center justify-between mb-1">
                <span className="game-pixel text-[9px] text-indigo-200">⚡ BONUS QUESTION</span>
                <span className="game-pixel text-[9px] text-yellow-300">{Math.ceil(question.left)}s</span>
              </div>
              <p className="game-fun font-bold text-sm mb-2">{questionOrder[question.idx].q}</p>
              <div className="grid grid-cols-3 gap-2">
                {questionOrder[question.idx].options.map((o, i) => {
                  const q = questionOrder[question.idx];
                  const show = question.picked !== null;
                  return (
                    <button
                      key={o}
                      onClick={() => answer(i)}
                      className={cn(
                        "game-btn text-xs py-2 px-2",
                        !show && "bg-white text-indigo-700",
                        show && i === q.a && "bg-emerald-400 text-white",
                        show && i === question.picked && i !== q.a && "bg-rose-500 text-white game-shake",
                        show && i !== q.a && i !== question.picked && "bg-white/40 text-indigo-900",
                      )}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-10 bg-slate-900/90 text-white p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Control
          icon={<Thermometer size={14} />}
          label="Temperature"
          value={`${Math.round(temp)}°C`}
          min={-10}
          max={40}
          v={temp}
          onChange={setTemp}
          track="linear-gradient(90deg,#93c5fd,#86efac,#fdba74,#f87171)"
          thumb="#fb923c"
        />
        <Control
          icon={<Droplets size={14} />}
          label="Rainfall"
          value={rain < 35 ? "Dry" : rain <= 65 ? "Medium" : "Heavy"}
          min={0}
          max={100}
          v={rain}
          onChange={setRain}
          track="linear-gradient(90deg,#fde68a,#7dd3fc,#2563eb)"
          thumb="#38bdf8"
        />
        <Control
          icon={<Sun size={14} />}
          label="Sunlight"
          value={sun < 30 ? "Dim" : sun < 70 ? "Bright" : "Blazing"}
          min={0}
          max={100}
          v={sun}
          onChange={setSun}
          track="linear-gradient(90deg,#475569,#fde047)"
          thumb="#facc15"
        />
        <div className="sm:col-span-3 grid grid-cols-2 gap-3">
          <Meter label="💧 Lake water" value={sim.water} zone={mission?.kind === "lake" ? [0.4, 0.6] : undefined} color="#3b82f6" />
          <Meter label="🌱 Plant health" value={sim.health} zone={[0.5, 1]} color={sim.health < 0.5 ? "#f43f5e" : "#22c55e"} />
        </div>
      </div>
    </div>
  );
}

function Control({
  icon,
  label,
  value,
  min,
  max,
  v,
  onChange,
  track,
  thumb,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  min: number;
  max: number;
  v: number;
  onChange: (n: number) => void;
  track: string;
  thumb: string;
}) {
  const last = useRef(0);
  return (
    <label className="block">
      <div className="flex items-center justify-between text-xs font-bold mb-1.5">
        <span className="flex items-center gap-1.5 text-white/90">
          {icon} {label}
        </span>
        <span className="game-pixel text-[9px] text-yellow-300">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={v}
        onChange={(e) => {
          onChange(Number(e.target.value));
          if (Date.now() - last.current > 90) {
            last.current = Date.now();
            sfx.tick();
          }
        }}
        className="game-range"
        style={{ "--track": track, "--thumb": thumb } as React.CSSProperties}
      />
    </label>
  );
}

function Meter({ label, value, zone, color }: { label: string; value: number; zone?: [number, number]; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] font-bold text-white/80 mb-1">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <div className="relative h-3 rounded-full bg-white/10 overflow-hidden border-2 border-black/30">
        {zone && (
          <div className="absolute inset-y-0 bg-emerald-400/30" style={{ left: `${zone[0] * 100}%`, width: `${(zone[1] - zone[0]) * 100}%` }} />
        )}
        <div className="h-full rounded-full transition-all duration-200" style={{ width: `${value * 100}%`, background: color }} />
      </div>
    </div>
  );
}
