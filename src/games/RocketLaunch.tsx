// Launching a Spaceship — Space Busters science game.
// Three missions (Earth orbit, the Moon, Mars). For each one the player:
//   1. builds a rocket: enough ENGINES so thrust beats weight, enough FUEL to get there,
//   2. launches it (too heavy = it can't lift off, too little fuel = it falls back),
//   3. flies through space: switch lanes to dodge asteroids and grab energy stars,
//   4. answers one question about forces or energy.
// Two simple rules, shown as big arrows and a checklist the whole time.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Minus, Plus, Rocket, Timer, X } from "lucide-react";
import { cn } from "../components/ui/utils";
import { STEMBOTS } from "../data/mock";
import { sfx } from "./kit/audio";
import { seededRandom } from "./kit/scores";
import { BLOCKS, Voxel, VoxelWorld, type BlockColors } from "./kit/Voxel";
import type { GameProps } from "./kit/types";

const ROUND_SECONDS = 300;
const START_DELAY = 2600;

// ── Rocket maths (kept to small whole numbers) ────────
const THRUST_PER_ENGINE = 4;
const CAPSULE_WEIGHT = 2;
const ENGINE_WEIGHT = 1;
const TANK_WEIGHT = 2;
const MAX_ENGINES = 5;
const MAX_TANKS = 5;

const thrustOf = (e: number) => e * THRUST_PER_ENGINE;
const weightOf = (e: number, t: number) => CAPSULE_WEIGHT + e * ENGINE_WEIGHT + t * TANK_WEIGHT;
/** Fewest engines that lift `t` tanks. */
const minEngines = (t: number) => {
  for (let e = 1; e <= MAX_ENGINES; e++) if (thrustOf(e) > weightOf(e, t)) return e;
  return MAX_ENGINES;
};

interface Mission {
  name: string;
  short: string;
  emoji: string;
  tanks: number;
  planet: BlockColors;
  space: string;
}

const MISSIONS: Mission[] = [
  { name: "Orbit the Earth", short: "Earth orbit", emoji: "🌍", tanks: 2, planet: { top: "#3b82f6", side: "#22c55e", side2: "#1d4ed8" }, space: "linear-gradient(#0b1033, #1e1b4b 60%, #312e81)" },
  { name: "Fly to the Moon", short: "the Moon", emoji: "🌕", tanks: 3, planet: { top: "#e5e7eb", side: "#cbd5e1", side2: "#94a3b8" }, space: "linear-gradient(#020617, #0f172a 60%, #1e293b)" },
  { name: "Fly to Mars", short: "Mars", emoji: "🔴", tanks: 4, planet: { top: "#f97316", side: "#ea580c", side2: "#c2410c" }, space: "linear-gradient(#1c0a1e, #3b0d2e 60%, #6b1d2a)" },
];

interface Question {
  q: string;
  options: string[];
  answer: number;
  explain: string;
}

const QUESTIONS: Question[] = [
  {
    q: "What force pulls the rocket back down to the ground?",
    options: ["Gravity", "Thrust", "Magnetism"],
    answer: 0,
    explain: "Gravity pulls everything down. That pull is the rocket's weight.",
  },
  {
    q: "A rocket's thrust is the SAME as its weight. What happens?",
    options: ["It zooms up fast", "It just hovers, it can't climb", "It falls through the floor"],
    answer: 1,
    explain: "Balanced forces: the push up equals the pull down, so it can't climb. Thrust must be BIGGER.",
  },
  {
    q: "The rocket burns its fuel to move. The fuel's chemical energy turns into...",
    options: ["Kinetic (movement) energy", "Elastic energy", "Magnetic energy"],
    answer: 0,
    explain: "Chemical energy in the fuel changes into kinetic energy (movement), plus heat and sound.",
  },
];

type Step = "build" | "launch" | "fly" | "quiz" | "done";
type LaunchResult = "ok" | "heavy" | "hover" | "fuel";

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: "build", label: "Build" },
  { key: "launch", label: "Launch" },
  { key: "fly", label: "Fly" },
  { key: "quiz", label: "Quiz" },
];

// ── Flight (lane runner) ──────────────────────────────
const LANES = 3;
const TRACK = 10; // rows from far (0) to near
const ROCKET_ROW = TRACK - 2.6;
const FLY_SECONDS = 13;

interface Thing {
  id: number;
  lane: number;
  y: number;
  kind: "rock" | "star";
  gone?: boolean;
}

function shuffle<T>(arr: T[], rnd: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function RocketLaunch({ seed, reportProgress, finish }: GameProps) {
  const quiz = useMemo(() => {
    const rnd = seededRandom(seed);
    return QUESTIONS.map((q) => {
      const order = shuffle([0, 1, 2], rnd);
      return { ...q, options: order.map((k) => q.options[k]), answer: order.indexOf(q.answer) };
    });
  }, [seed]);

  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mi, setMi] = useState(0);
  const [step, setStep] = useState<Step>("build");
  const [engines, setEngines] = useState(1);
  const [tanks, setTanks] = useState(1);
  const [attempts, setAttempts] = useState(0);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [lift, setLift] = useState(0); // rocket height above the pad during launch, in blocks
  const [pts, setPts] = useState(0);
  const [firstTryLaunches, setFirstTryLaunches] = useState(0);
  const [starsTotal, setStarsTotal] = useState(0);
  const [hitsTotal, setHitsTotal] = useState(0);
  const [rightAnswers, setRightAnswers] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ text: string; good: boolean; id: number } | null>(null);
  const [shakeId, setShakeId] = useState(0);

  const mission = MISSIONS[Math.min(mi, MISSIONS.length - 1)];
  const allDone = mi >= MISSIONS.length;
  const timeUp = elapsed >= ROUND_SECONDS;
  const over = allDone || timeUp;
  const score = Math.min(100, Math.round(pts));
  const canPlay = started && !over;

  const thrust = thrustOf(engines);
  const weight = weightOf(engines, tanks);
  const liftsOff = thrust > weight;
  const enoughFuel = tanks >= mission.tanks;

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), START_DELAY);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!started || over) return;
    const id = setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => clearInterval(id);
  }, [started, over]);

  const stepFrac = { build: 0.05, launch: 0.2, fly: 0.35, quiz: 0.85, done: 1 }[step];
  const progress = Math.min(1, (mi + stepFrac) / MISSIONS.length);
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
          { label: "Missions done", value: `${Math.min(mi, 3)}/3` },
          { label: "First-try launches", value: `${firstTryLaunches}/3` },
          { label: "Energy stars", value: `${starsTotal} (${hitsTotal} bumps)` },
          { label: "Quiz answers", value: `${rightAnswers}/3` },
        ]),
      900,
    );
    return () => clearTimeout(t);
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps

  const showFlash = (text: string, good: boolean) => {
    const id = Date.now() + Math.random();
    setFlash({ text, good, id });
    setTimeout(() => setFlash((f) => (f?.id === id ? null : f)), 1500);
  };

  // ── Build ─────────────────────────
  const change = (which: "e" | "t", d: number) => {
    if (!canPlay || step !== "build") return;
    if (which === "e") setEngines((v) => Math.max(1, Math.min(MAX_ENGINES, v + d)));
    else setTanks((v) => Math.max(1, Math.min(MAX_TANKS, v + d)));
    sfx.place();
  };

  // ── Launch ────────────────────────
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const launch = () => {
    if (!canPlay || step !== "build") return;
    const res: LaunchResult = thrust < weight ? "heavy" : thrust === weight ? "hover" : !enoughFuel ? "fuel" : "ok";
    setAttempts((a) => a + 1);
    setResult(res);
    setStep("launch");
    sfx.launch();
    const t0 = performance.now();
    const dur = res === "ok" ? 2300 : 2600;
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      if (res === "ok") setLift(1.2 * t * t * 3);
      else if (res === "hover") setLift(Math.min(0.35, t * 0.6));
      else if (res === "fuel") setLift(t < 1.3 ? 1.6 * t * t * 2 : Math.max(0, 5.4 - (t - 1.3) * 4.2));
      else setLift(0);
      if (now - t0 < dur) raf.current = requestAnimationFrame(tick);
      else afterLaunch(res);
    };
    raf.current = requestAnimationFrame(tick);
    if (res === "heavy" || res === "hover") setShakeId((s) => s + 1);
  };

  const attemptsRef = useRef(0);
  attemptsRef.current = attempts;
  const afterLaunch = (res: LaunchResult) => {
    if (res !== "ok") {
      sfx.wrong();
      setLift(0);
      setStep("build");
      return;
    }
    const tries = attemptsRef.current;
    const gained = tries <= 1 ? 12 : tries === 2 ? 8 : 4;
    const perfect = tanks === mission.tanks && engines === minEngines(tanks);
    setPts((p) => p + gained + (perfect ? 4 : 0));
    if (tries <= 1) setFirstTryLaunches((n) => n + 1);
    sfx.correct();
    showFlash(perfect ? `Perfect rocket! +${gained + 4}` : `Lift-off! +${gained}`, true);
    setResult(null);
    setLift(0);
    startFlight();
  };

  // ── Flight ────────────────────────
  const [lane, setLane] = useState(1);
  const laneRef = useRef(1);
  const [things, setThings] = useState<Thing[]>([]);
  const [flyT, setFlyT] = useState(0);
  const [flyStars, setFlyStars] = useState(0);
  const [flyHits, setFlyHits] = useState(0);
  const [bump, setBump] = useState(0);
  const flyRaf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(flyRaf.current), []);

  const startFlight = () => {
    setStep("fly");
    setLane(1);
    laneRef.current = 1;
    setFlyT(0);
    setFlyStars(0);
    setFlyHits(0);
    const rnd = seededRandom(seed + mi * 7919);
    const speed = 5.5 + mi * 1.2; // rows per second
    let list: Thing[] = [];
    let nextSpawn = 0.6;
    let id = 0;
    let stars = 0;
    let hits = 0;
    let last = performance.now();
    const t0 = last;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000;
      // spawn a row: one rock or star, sometimes a rock + star
      if (t >= nextSpawn && t < FLY_SECONDS - 1.5) {
        const l = Math.floor(rnd() * LANES);
        list.push({ id: id++, lane: l, y: -1, kind: rnd() < 0.42 ? "star" : "rock" });
        if (rnd() < 0.35) list.push({ id: id++, lane: (l + 1 + Math.floor(rnd() * 2)) % LANES, y: -1, kind: rnd() < 0.5 ? "star" : "rock" });
        nextSpawn += Math.max(0.5, 0.95 - mi * 0.12 - t * 0.012);
      }
      list = list.map((o) => ({ ...o, y: o.y + speed * dt }));
      for (const o of list) {
        if (o.gone || o.lane !== laneRef.current) continue;
        if (Math.abs(o.y - ROCKET_ROW) < 0.55) {
          o.gone = true;
          if (o.kind === "star") {
            stars++;
            sfx.coin();
          } else {
            hits++;
            sfx.explode();
            setBump((b) => b + 1);
          }
        }
      }
      list = list.filter((o) => o.y < TRACK + 1 && !o.gone);
      setThings(list);
      setFlyT(t);
      setFlyStars(stars);
      setFlyHits(hits);
      if (t < FLY_SECONDS) flyRaf.current = requestAnimationFrame(tick);
      else endFlight(stars, hits);
    };
    flyRaf.current = requestAnimationFrame(tick);
  };

  const endFlight = (stars: number, hits: number) => {
    const gained = Math.max(0, Math.min(9, stars) - hits);
    setPts((p) => p + gained);
    setStarsTotal((n) => n + stars);
    setHitsTotal((n) => n + hits);
    setThings([]);
    sfx.fanfare();
    showFlash(`Arrived at ${mission.short}! +${gained}`, true);
    setAnswer(null);
    setStep("quiz");
  };

  const moveLane = (d: number) => {
    if (step !== "fly") return;
    const nl = Math.max(0, Math.min(LANES - 1, laneRef.current + d));
    if (nl === laneRef.current) return;
    laneRef.current = nl;
    setLane(nl);
    sfx.tick();
  };

  // ── Quiz ──────────────────────────
  const question = quiz[Math.min(mi, quiz.length - 1)];
  const answerQ = (i: number) => {
    if (step !== "quiz" || answer !== null || !canPlay) return;
    setAnswer(i);
    const right = i === question.answer;
    if (right) {
      sfx.correct();
      setPts((p) => p + 9);
      setRightAnswers((n) => n + 1);
      showFlash("Correct! +9", true);
    } else sfx.wrong();
    setTimeout(() => {
      setStep("done");
      sfx.levelUp();
      setTimeout(() => {
        setMi((m) => m + 1);
        setStep("build");
        setEngines(1);
        setTanks(1);
        setAttempts(0);
        setAnswer(null);
      }, 1800);
    }, right ? 1800 : 3200);
  };

  // ── Keyboard ──────────────────────
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    const k = e.key;
    if (step === "fly") {
      if (k === "ArrowLeft" || k === "a" || k === "A") moveLane(-1);
      else if (k === "ArrowRight" || k === "d" || k === "D") moveLane(1);
      else return;
    } else if (step === "build") {
      if (k === "ArrowRight") change("e", 1);
      else if (k === "ArrowLeft") change("e", -1);
      else if (k === "ArrowUp") change("t", 1);
      else if (k === "ArrowDown") change("t", -1);
      else if (k === "Enter" || k === " ") launch();
      else return;
    } else if (step === "quiz" && ["1", "2", "3"].includes(k)) answerQ(Number(k) - 1);
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  // ── Layout sizing ─────────────────
  const worldRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 700, h: 380 });
  useEffect(() => {
    const el = worldRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const emily = STEMBOTS.emily;
  const timeLeft = Math.max(0, Math.ceil(ROUND_SECONDS - elapsed));
  const flying = step === "fly";

  const objective = (() => {
    if (allDone) return "All 3 missions done! You're a real rocket scientist!";
    if (!started) return `Mission ${mi + 1}: ${mission.name}!`;
    switch (step) {
      case "build":
        return `Build a rocket that can reach ${mission.short} ${mission.emoji}. Make both checks green, then LAUNCH!`;
      case "launch":
        return result === "ok" ? "3... 2... 1... LIFT-OFF!" : "Launching...";
      case "fly":
        return "Tap ◀ ▶ to dodge the asteroids and grab the ⭐ energy stars!";
      case "quiz":
        return `You reached ${mission.short}! One quick question:`;
      case "done":
        return `Mission ${mi + 1} complete! 🎉`;
    }
  })();

  const failMsg =
    step === "build" && result && result !== "ok"
      ? result === "heavy"
        ? `Too heavy! Weight (${weightOf(engines, tanks)}) pulls down harder than thrust (${thrustOf(engines)}) pushes up. Add engines or take away fuel.`
        : result === "hover"
          ? `It just hovered! Thrust and weight are both ${thrustOf(engines)}. Balanced forces can't climb. Thrust must be BIGGER.`
          : `Out of fuel! ${mission.short} needs ${mission.tanks} fuel tanks of energy. You had ${tanks}.`
      : null;

  return (
    <div
      data-game="rocket"
      className="absolute inset-0 flex flex-col overflow-hidden transition-[background] duration-700"
      style={{ background: flying || step === "quiz" || step === "done" ? mission.space : "linear-gradient(#38bdf8, #a5e1ff 60%, #e0f6ff)" }}
    >
      <Starfield dim={!(flying || step === "quiz" || step === "done")} moving={flying} />

      {/* HUD */}
      <div className="relative z-10 flex items-stretch gap-2 p-2 sm:p-3">
        <div key={`${mi}-${step}`} className="flex-1 min-w-0 bg-white/95 rounded-2xl game-panel px-2 sm:px-3 py-2 flex items-center gap-2 sm:gap-3 game-bounce-in">
          <div className="relative shrink-0 rounded-2xl p-1 bg-violet-500">
            <img src={emily.avatar} alt={emily.name} className="w-10 h-10 sm:w-14 sm:h-14 object-contain drop-shadow" />
            <span className="absolute -bottom-1 -right-1 text-lg">{mission.emoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="game-pixel text-[8px] sm:text-[9px] text-slate-500 truncate">
              {allDone ? "ALL MISSIONS DONE" : `MISSION ${mi + 1}/3 · ${mission.name.toUpperCase()}`}
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

      {/* Scene */}
      <div ref={worldRef} className="relative flex-1 min-h-0">
        {(step === "build" || step === "launch") && (
          <PadScene box={box} engines={engines} tanks={tanks} lift={lift} firing={step === "launch"} result={result} shakeId={shakeId} mission={mission} />
        )}
        {flying && <FlightScene box={box} things={things} lane={lane} bump={bump} />}
        {(step === "quiz" || step === "done") && <ArrivalScene box={box} mission={mission} />}

        {/* Build: forces + fuel panels */}
        {(step === "build" || step === "launch") && (
          <>
            <div className="absolute left-2 top-2 z-10 bg-white/95 rounded-2xl game-panel p-2.5 w-[168px] sm:w-[190px]">
              <p className="game-pixel text-[8px] text-slate-500 mb-1.5">FORCES</p>
              <ForceBar label="Thrust (push up)" value={thrust} max={22} color="bg-emerald-500" icon={<ArrowUp size={14} strokeWidth={3} />} />
              <ForceBar label="Weight (pull down)" value={weight} max={22} color="bg-rose-500" icon={<ArrowDown size={14} strokeWidth={3} />} />
              <p className="text-[10px] text-slate-500 leading-tight mt-1">
                Each engine: +{THRUST_PER_ENGINE} thrust, +{ENGINE_WEIGHT} weight. Each fuel tank: +{TANK_WEIGHT} weight.
              </p>
            </div>
            <div className="absolute right-2 top-2 z-10 bg-white/95 rounded-2xl game-panel p-2.5 w-[168px] sm:w-[190px]">
              <p className="game-pixel text-[8px] text-slate-500 mb-1.5">CHECKLIST</p>
              <CheckRow ok={liftsOff} text={liftsOff ? "Thrust is bigger than weight" : "Thrust must beat weight"} />
              <CheckRow ok={enoughFuel} text={enoughFuel ? `Enough fuel for ${mission.short}` : `Fuel: ${tanks} of ${mission.tanks} tanks needed`} />
              <FuelRoute tanks={tanks} mission={mission} />
            </div>
          </>
        )}

        {/* Flight HUD */}
        {flying && (
          <>
            <div className="absolute left-2 top-2 z-10 bg-slate-900/80 text-white rounded-2xl game-panel px-3 py-2">
              <p className="game-pixel text-[8px] text-amber-300">ENERGY STARS</p>
              <p className="game-pixel text-lg text-yellow-300">⭐ {flyStars}</p>
              {flyHits > 0 && <p className="game-fun font-bold text-xs text-rose-300 mt-0.5">Bumps: {flyHits}</p>}
            </div>
            <div className="absolute right-3 top-3 bottom-3 z-10 w-9 bg-slate-900/70 rounded-full game-panel flex flex-col items-center justify-between py-2">
              <span className="text-xl">{mission.emoji}</span>
              <div className="relative flex-1 w-2 my-2 bg-white/20 rounded-full">
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-amber-400 to-lime-300 rounded-full" style={{ height: `${Math.min(100, (flyT / FLY_SECONDS) * 100)}%` }} />
              </div>
              <span className="text-lg">🚀</span>
            </div>
          </>
        )}

        {/* Failed launch explanation */}
        {failMsg && (
          <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center px-2">
            <div key={attempts} className="bg-rose-50 border-rose-300 text-rose-900 rounded-2xl game-panel px-3 py-2 game-shake flex gap-2 max-w-md">
              <img src={emily.avatar} alt="" className="w-9 h-9 object-contain shrink-0" />
              <p className="text-[13px] font-semibold leading-snug">{failMsg}</p>
            </div>
          </div>
        )}

        {/* Flash */}
        {flash && (
          <div className="absolute inset-x-0 top-16 flex justify-center z-20 pointer-events-none">
            <span key={flash.id} className={cn("game-bounce-in text-white game-fun font-bold px-4 py-2 rounded-2xl game-panel text-lg", flash.good ? "bg-emerald-500" : "bg-rose-500")}>
              {flash.text}
            </span>
          </div>
        )}

        {step === "done" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="bg-violet-600 text-white rounded-3xl game-panel px-6 py-4 text-center game-bounce-in">
              <p className="text-5xl">{mission.emoji}</p>
              <p className="game-pixel text-[11px] mt-2">MISSION {mi + 1} COMPLETE!</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-10 bg-slate-900/90 text-white px-2 sm:px-3 py-2 min-h-[104px] flex items-center justify-center">
        {(step === "build" || step === "launch") && (
          <div className="w-full grid grid-cols-[1fr_1fr_auto] gap-2 sm:gap-4 items-center max-w-3xl">
            <Stepper label="Engines" emoji="🔥" value={engines} max={MAX_ENGINES} color="#f97316" disabled={!canPlay || step !== "build"} onChange={(d) => change("e", d)} />
            <Stepper label="Fuel tanks" emoji="⛽" value={tanks} max={MAX_TANKS} color="#0ea5e9" disabled={!canPlay || step !== "build"} onChange={(d) => change("t", d)} />
            <button
              onClick={launch}
              disabled={!canPlay || step !== "build"}
              className={cn("game-btn bg-yellow-400 text-slate-900 text-lg sm:text-xl px-5 sm:px-8 py-3 sm:py-4 flex items-center gap-2", liftsOff && enoughFuel && step === "build" && "game-pulse")}
            >
              <Rocket size={20} /> LAUNCH!
            </button>
          </div>
        )}
        {flying && (
          <div className="w-full grid grid-cols-2 gap-3 max-w-xl">
            <button onPointerDown={() => moveLane(-1)} className="game-btn bg-sky-400 text-slate-900 py-4 flex items-center justify-center text-lg" aria-label="Move left">
              <ChevronLeft size={28} strokeWidth={3} /> LEFT
            </button>
            <button onPointerDown={() => moveLane(1)} className="game-btn bg-sky-400 text-slate-900 py-4 flex items-center justify-center text-lg" aria-label="Move right">
              RIGHT <ChevronRight size={28} strokeWidth={3} />
            </button>
          </div>
        )}
        {step === "quiz" && (
          <div key={mi} className="w-full max-w-3xl game-bounce-in">
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
            {answer !== null && <p className="text-center text-[12px] sm:text-[13px] text-sky-100 mt-1.5 game-bounce-in">{question.explain}</p>}
          </div>
        )}
        {(step === "done" || allDone) && <p className="game-fun font-bold text-lg">{allDone ? "🎉 All missions done!" : "Next mission coming up..."}</p>}
      </div>
    </div>
  );
}

// ── Scenes ────────────────────────────────────────────

const BODY: BlockColors = { top: "#f8fafc", side: "#e2e8f0", side2: "#cbd5e1" };
const BODY_ALT: BlockColors = { top: "#f1f5f9", side: "#dbeafe", side2: "#bfdbfe" };
const CAPSULE: BlockColors = { top: "#ef4444", side: "#dc2626", side2: "#b91c1c" };
const ENGINE: BlockColors = { top: "#475569", side: "#334155", side2: "#1e293b" };
const PAD: BlockColors = { top: "#94a3b8", side: "#64748b", side2: "#475569" };
const FLAME: BlockColors = { top: "#fde047", side: "#f97316", side2: "#ea580c" };
const TANK_STRIPE: BlockColors = { top: "#0ea5e9", side: "#0284c7", side2: "#0369a1" };

/** The rocket, standing at (x, y) with its base at height z (block units, size S). */
function RocketModel({ S, x, y, z, engines, tanks, firing }: { S: number; x: number; y: number; z: number; engines: number; tanks: number; firing: boolean }) {
  const parts: ReactNode[] = [];
  const s = S * 0.5; // engines and nose are half blocks
  const enginePos: [number, number][] = [
    [0.5, 0.5],
    [0, 0],
    [1, 1],
    [1, 0],
    [0, 1],
  ];
  for (let i = 0; i < engines; i++) {
    const [ex, ey] = enginePos[i];
    parts.push(<Voxel key={`e${i}`} x={(x + ex * 0.5) * 2} y={(y + ey * 0.5) * 2} z={z * 2} size={s} heightScale={1.2} colors={ENGINE} />);
    if (firing)
      parts.push(
        <Voxel key={`f${i}`} x={(x + ex * 0.5) * 2 + 0.15} y={(y + ey * 0.5) * 2 + 0.15} z={z * 2 - 1.1} size={s * 0.7} heightScale={1.5} colors={FLAME} textured={false} className="rocket-flame" />,
      );
  }
  let zz = z + 0.6;
  for (let i = 0; i < tanks; i++) {
    parts.push(<Voxel key={`t${i}`} x={x} y={y} z={zz} size={S} heightScale={0.82} colors={i % 2 ? BODY_ALT : BODY} />);
    parts.push(<Voxel key={`ts${i}`} x={x} y={y} z={zz + 0.82} size={S} heightScale={0.18} colors={TANK_STRIPE} textured={false} />);
    zz += 1;
  }
  parts.push(<Voxel key="cap" x={x} y={y} z={zz} size={S} heightScale={0.9} colors={CAPSULE} />);
  parts.push(<Voxel key="nose" x={x * 2 + 0.5} y={y * 2 + 0.5} z={(zz + 0.9) * 2} size={s} heightScale={1.1} colors={CAPSULE} />);
  return <>{parts}</>;
}

function PadScene({
  box,
  engines,
  tanks,
  lift,
  firing,
  result,
  shakeId,
  mission,
}: {
  box: { w: number; h: number };
  engines: number;
  tanks: number;
  lift: number;
  firing: boolean;
  result: LaunchResult | null;
  shakeId: number;
  mission: Mission;
}) {
  const G = 5;
  const S = Math.max(16, Math.min(40, Math.floor(Math.min(box.w / 9, box.h / 10.5))));
  const shaking = firing && (result === "heavy" || result === "hover");
  const ground: ReactNode[] = [];
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      const pad = x >= 1 && x <= 3 && y >= 1 && y <= 3;
      ground.push(<Voxel key={`${x},${y}`} x={x} y={y} z={-0.4} size={S} heightScale={0.4} colors={pad ? PAD : BLOCKS.grass} />);
    }
  return (
    <div key={shakeId} className="absolute inset-0" style={shaking ? { animation: "vx-wobble 120ms linear infinite" } : undefined}>
      <VoxelWorld cols={G} rows={G} size={S} className="absolute inset-0" style={{ paddingTop: S * 4.2 }}>
        {ground}
        {/* Launch tower */}
        {Array.from({ length: Math.max(3, tanks + 1) }, (_, i) => (
          <Voxel key={`tw${i}`} x={3.5 * 2} y={1 * 2} z={i * 2} size={S * 0.5} heightScale={2} colors={{ top: "#f59e0b", side: "#d97706", side2: "#b45309" }} />
        ))}
        <div className="vx-group" style={{ transform: `translateZ(${lift * S}px)` }}>
          <RocketModel S={S} x={2} y={2} z={0} engines={engines} tanks={tanks} firing={firing && result !== "heavy"} />
        </div>
        {/* Smoke puffs when firing */}
        {firing &&
          [0, 1, 2, 3, 4, 5].map((i) => (
            <div key={`sm${i}`} className="vx-group vx-rise" style={{ "--dur": "1.4s", "--delay": `${i * 0.2}s`, "--to": `${S * 1.4}px` } as CSSProperties}>
              <Voxel x={(1.4 + (i % 3) * 0.7) / 0.6} y={(1.4 + Math.floor(i / 3) * 1.2) / 0.6} z={0} size={S * 0.6} colors={{ top: "#f8fafc", side: "#e2e8f0", side2: "#cbd5e1" }} textured={false} />
            </div>
          ))}
      </VoxelWorld>
      <span className="absolute left-1/2 -translate-x-1/2 bottom-1 game-pixel text-[9px] text-slate-700/70">TARGET: {mission.short.toUpperCase()}</span>
    </div>
  );
}

function FlightScene({ box, things, lane, bump }: { box: { w: number; h: number }; things: Thing[]; lane: number; bump: number }) {
  const S = Math.max(20, Math.min(50, Math.floor(Math.min(box.w / 6.5, box.h / 7))));
  const tiles: ReactNode[] = [];
  for (let y = 0; y < TRACK; y++)
    for (let x = 0; x < LANES; x++)
      tiles.push(
        <div
          key={`${x},${y}`}
          className="absolute"
          style={{ left: x * S, top: y * S, width: S, height: S, border: "1px solid rgba(165,180,252,0.25)", background: (x + y) % 2 ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.05)" }}
        />,
      );
  return (
    <div key={bump} className="absolute inset-0" style={bump ? { animation: "game-shake 300ms ease" } : undefined}>
      <VoxelWorld cols={LANES} rows={TRACK} size={S} tilt={62} spin={0} className="absolute inset-x-0 top-0" style={{ bottom: S * 1.2, perspective: 900, perspectiveOrigin: "50% 30%" }}>
        {tiles}
        {things.map((o) =>
          o.kind === "rock" ? (
            <Voxel key={o.id} x={(o.lane + 0.1) / 0.8} y={o.y / 0.8} z={0.1} size={S * 0.8} colors={{ top: "#a8a29e", side: "#78716c", side2: "#57534e" }} />
          ) : (
            <Voxel key={o.id} x={(o.lane + 0.25) / 0.5} y={(o.y + 0.25) / 0.5} z={0.8} size={S * 0.5} colors={BLOCKS.gold} textured={false} className="flight-star" />
          ),
        )}
        <div className="vx-group" style={{ transform: `translateX(${lane * S}px)`, transition: "transform 120ms ease-out" }}>
          <RocketModel S={S * 0.7} x={0.21 / 0.7} y={ROCKET_ROW / 0.7} z={0.3} engines={3} tanks={1} firing />
        </div>
      </VoxelWorld>
    </div>
  );
}

function ArrivalScene({ box, mission }: { box: { w: number; h: number }; mission: Mission }) {
  const S = Math.max(16, Math.min(40, Math.floor(Math.min(box.w / 10, box.h / 8))));
  // A blocky planet: a 3×3×3 cube with corners knocked off.
  const blocks: ReactNode[] = [];
  for (let z = 0; z < 3; z++)
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++) {
        const corner = (x !== 1 ? 1 : 0) + (y !== 1 ? 1 : 0) + (z !== 1 ? 1 : 0);
        if (corner === 3) continue;
        blocks.push(<Voxel key={`${x}${y}${z}`} x={x + 1} y={y + 1} z={z} size={S} colors={mission.planet} />);
      }
  return (
    <div className="absolute inset-0">
      <VoxelWorld cols={5} rows={5} size={S} className="absolute inset-0 game-float" style={{ paddingTop: S * 2.5 }}>
        <div className="vx-group" style={{ animation: "planet-spin 14s linear infinite", transformOrigin: `${2.5 * S}px ${2.5 * S}px` }}>
          {blocks}
        </div>
        <div className="vx-group">
          <RocketModel S={S * 0.5} x={8.2} y={1.2} z={8} engines={1} tanks={1} firing={false} />
        </div>
      </VoxelWorld>
    </div>
  );
}

function Starfield({ dim, moving }: { dim: boolean; moving: boolean }) {
  const stars = useMemo(() => {
    const rnd = seededRandom(42);
    return Array.from({ length: 40 }, () => ({ x: rnd() * 100, y: rnd() * 100, s: 1 + Math.floor(rnd() * 3) }));
  }, []);
  if (dim) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {stars.map((st, i) => (
        <span
          key={i}
          className="absolute bg-white"
          style={{
            left: `${st.x}%`,
            top: `${st.y}%`,
            width: st.s * 2,
            height: moving ? st.s * 8 : st.s * 2,
            opacity: 0.7,
            animation: moving ? `star-streak ${0.6 + st.s * 0.3}s ${-(i % 7) * 0.2}s linear infinite` : undefined,
          }}
        />
      ))}
    </div>
  );
}

// ── Controls & panels ─────────────────────────────────

function ForceBar({ label, value, max, color, icon }: { label: string; value: number; max: number; color: string; icon: ReactNode }) {
  return (
    <div className="mb-1.5">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
        <span className="flex items-center gap-1">
          {icon} {label}
        </span>
        <span className="game-pixel text-[10px]">{value}</span>
      </div>
      <div className="h-3.5 bg-slate-200 rounded-full overflow-hidden mt-0.5">
        <div className={cn("h-full rounded-full transition-all duration-300", color)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function CheckRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={cn("flex items-start gap-1.5 rounded-lg px-1.5 py-1 mb-1 text-[12px] font-bold leading-tight", ok ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800")}>
      <span className={cn("shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white mt-px", ok ? "bg-emerald-500" : "bg-rose-500")}>
        {ok ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
      </span>
      {text}
    </div>
  );
}

function FuelRoute({ tanks, mission }: { tanks: number; mission: Mission }) {
  const stops = [
    { label: "Earth orbit", emoji: "🌍", need: 2 },
    { label: "Moon", emoji: "🌕", need: 3 },
    { label: "Mars", emoji: "🔴", need: 4 },
  ];
  return (
    <div className="mt-1.5">
      <p className="text-[10px] font-bold text-slate-500 mb-0.5">FUEL TANKS REACH:</p>
      <div className="flex items-center gap-1">
        {stops.map((s) => (
          <div
            key={s.label}
            className={cn(
              "flex-1 rounded-lg text-center py-0.5 border-2",
              tanks >= s.need ? "bg-sky-100 border-sky-400" : "bg-slate-100 border-transparent opacity-50",
              s.need === mission.tanks && "ring-2 ring-amber-400",
            )}
          >
            <p className="text-sm leading-none">{s.emoji}</p>
            <p className="text-[9px] font-bold text-slate-600">{s.need} tanks</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stepper({
  label,
  emoji,
  value,
  max,
  color,
  disabled,
  onChange,
}: {
  label: string;
  emoji: string;
  value: number;
  max: number;
  color: string;
  disabled: boolean;
  onChange: (d: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 bg-white/5 rounded-2xl px-2 py-1.5">
      <button aria-label={`Fewer ${label}`} disabled={disabled || value <= 1} onClick={() => onChange(-1)} className="game-btn !p-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-white" style={{ background: color }}>
        <Minus size={20} strokeWidth={3} />
      </button>
      <div className="text-center min-w-0">
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-white/70">{label}</p>
        <p className="text-lg sm:text-xl leading-none mt-0.5 whitespace-nowrap">
          {Array.from({ length: value }, () => emoji).join("")}
        </p>
        <p className="game-pixel text-[11px] mt-0.5" style={{ color }}>
          {value}
        </p>
      </div>
      <button aria-label={`More ${label}`} disabled={disabled || value >= max} onClick={() => onChange(1)} className="game-btn !p-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-white" style={{ background: color }}>
        <Plus size={20} strokeWidth={3} />
      </button>
    </div>
  );
}
